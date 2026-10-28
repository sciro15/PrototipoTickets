import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ALLOWED_TRANSITIONS, canTransition, validateStateTransition } from './ticket-transitions';

const USER_SELECT = { id: true, name: true, email: true, role: true } satisfies Prisma.UserSelect;
const TICKET_INCLUDE = {
  requester: { select: USER_SELECT },
  assignee: { select: USER_SELECT },
} satisfies Prisma.TicketInclude;

/**
 * Permisos por rol:
 *  - ADMIN / SOPORTE: ven y gestionan todos los tickets, asignan y cambian estados.
 *  - SOLICITANTE: crea tickets propios; solo ve los suyos; solo edita los suyos
 *    mientras estén ABIERTO; no asigna ni cambia estados.
 * Un solicitante que consulta un ticket ajeno recibe 404 (no se revela su existencia).
 */
@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryTicketsDto, user: AuthUser) {
    const where: Prisma.TicketWhereInput = {};
    if (user.role === 'SOLICITANTE') where.requesterId = user.id;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.search) where.title = { contains: query.search };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: TICKET_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async findOne(id: number, user: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, include: TICKET_INCLUDE });
    if (!ticket || (user.role === 'SOLICITANTE' && ticket.requesterId !== user.id)) {
      throw new NotFoundException(`Ticket con id ${id} no encontrado`);
    }
    return ticket;
  }

  async create(dto: CreateTicketDto, user: AuthUser) {
    let requesterId: number;
    if (user.role === 'SOLICITANTE') {
      if (dto.assigneeId != null) {
        throw new ForbiddenException('Un solicitante no puede asignar responsable');
      }
      requesterId = user.id;
    } else {
      if (dto.requesterId == null) throw new BadRequestException('requesterId es obligatorio');
      requesterId = dto.requesterId;
      await this.ensureRequester(requesterId);
    }
    if (dto.assigneeId != null) await this.ensureAssignee(dto.assigneeId);

    return this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        priority: dto.priority,
        requesterId,
        assigneeId: dto.assigneeId ?? null,
        // status: siempre ABIERTO (valor por defecto); no es editable por el cliente
      },
      include: TICKET_INCLUDE,
    });
  }

  async update(id: number, dto: UpdateTicketDto, user: AuthUser) {
    const ticket = await this.findOne(id, user);

    if (ticket.status === 'CERRADO') {
      throw new BadRequestException('No se puede modificar un ticket que se encuentra en estado CERRADO');
    }

    if (user.role === 'SOLICITANTE') {
      if (ticket.status !== 'ABIERTO') {
        throw new ForbiddenException('Solo puede editar tickets en estado ABIERTO');
      }
      if (dto.assigneeId !== undefined) {
        throw new ForbiddenException('Un solicitante no puede asignar responsable');
      }
    } else if (user.role === 'SOPORTE') {
      if (dto.assigneeId !== undefined && dto.assigneeId !== null && dto.assigneeId !== user.id) {
        throw new ForbiddenException('El perfil de soporte únicamente puede asignarse tickets a sí mismo');
      }
    }
    if (dto.assigneeId != null) await this.ensureAssignee(dto.assigneeId);

    return this.prisma.ticket.update({
      where: { id },
      data: {
        // Los campos obligatorios ignoran null/undefined
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        category: dto.category ?? undefined,
        priority: dto.priority ?? undefined,
        // assigneeId: undefined = sin cambio, null = quitar responsable
        assigneeId: dto.assigneeId,
      },
      include: TICKET_INCLUDE,
    });
  }

  /**
   * Asignación de tickets:
   * - ADMIN: puede asignar a cualquier agente (SOPORTE o ADMIN) o quitar la asignación (null).
   * - SOPORTE: puede asignarse a sí mismo ("Asignarme a mí") o desasignarse a sí mismo.
   */
  async assign(id: number, dto: AssignTicketDto, user: AuthUser) {
    const ticket = await this.findOne(id, user);

    if (ticket.status === 'CERRADO') {
      throw new BadRequestException('No se puede asignar un ticket que se encuentra en estado CERRADO');
    }

    if (user.role === 'SOLICITANTE') {
      throw new ForbiddenException('Un solicitante no puede asignar tickets');
    }

    if (user.role === 'SOPORTE') {
      if (dto.assigneeId !== undefined && dto.assigneeId !== null && dto.assigneeId !== user.id) {
        throw new ForbiddenException('El perfil de soporte únicamente puede asignarse tickets a sí mismo');
      }
      if (dto.assigneeId === null && ticket.assigneeId !== user.id) {
        throw new ForbiddenException('Solo puede desasignarse de tickets asignados a usted');
      }
    }

    const targetAssigneeId = dto.assigneeId !== undefined ? dto.assigneeId : user.id;

    if (targetAssigneeId != null) {
      await this.ensureAssignee(targetAssigneeId);
    }

    return this.prisma.ticket.update({
      where: { id },
      data: { assigneeId: targetAssigneeId },
      include: TICKET_INCLUDE,
    });
  }

  /** Cambia el estado y registra el historial (con el usuario del token) en una única transacción. */
  async changeStatus(id: number, dto: ChangeStatusDto, user: AuthUser) {
    const ticket = await this.findOne(id, user);

    // Validación estricta del flujo de transición de estados
    validateStateTransition(ticket.status, dto.status);

    // Si pasa a EN_PROGRESO o RESUELTO y el ticket no tenía responsable,
    // se asigna automáticamente al usuario de soporte/admin que inicia la acción
    const autoAssign =
      (dto.status === 'EN_PROGRESO' || dto.status === 'RESUELTO') && !ticket.assigneeId;

    return this.prisma.$transaction(async (tx) => {
      // Actualización condicionada al estado leído: evita carreras entre cambios simultáneos
      const result = await tx.ticket.updateMany({
        where: { id, status: ticket.status },
        data: {
          status: dto.status,
          ...(autoAssign ? { assigneeId: user.id } : {}),
        },
      });
      if (result.count === 0) {
        throw new ConflictException('El ticket fue modificado por otro usuario; recargue e intente de nuevo');
      }
      await tx.ticketHistory.create({
        data: {
          ticketId: id,
          previousStatus: ticket.status,
          newStatus: dto.status,
          changedById: user.id,
        },
      });
      return tx.ticket.findUniqueOrThrow({ where: { id }, include: TICKET_INCLUDE });
    });
  }

  async getHistory(id: number, user: AuthUser) {
    await this.findOne(id, user);
    return this.prisma.ticketHistory.findMany({
      where: { ticketId: id },
      include: { changedBy: { select: USER_SELECT } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  private async ensureRequester(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Solicitante con id ${id} no existe`);
  }

  private async ensureAssignee(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Responsable con id ${id} no existe`);
    if (user.role === 'SOLICITANTE') {
      throw new BadRequestException('El responsable debe tener rol SOPORTE o ADMIN');
    }
  }
}

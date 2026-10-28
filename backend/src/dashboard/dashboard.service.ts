import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';

const RECENT_LIMIT = 5;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Un SOLICITANTE solo ve indicadores de sus propios tickets. */
  async getSummary(user: AuthUser) {
    const statuses: Status[] = ['ABIERTO', 'EN_PROGRESO', 'RESUELTO', 'CERRADO'];
    const scope: Prisma.TicketWhereInput = user.role === 'SOLICITANTE' ? { requesterId: user.id } : {};

    const [total, counts, recent] = await Promise.all([
      this.prisma.ticket.count({ where: scope }),
      Promise.all(
        statuses.map((status) => this.prisma.ticket.count({ where: { ...scope, status } })),
      ),
      this.prisma.ticket.findMany({
        where: scope,
        take: RECENT_LIMIT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          requester: { select: { id: true, name: true, email: true, role: true } },
          assignee: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

    const byStatus = Object.fromEntries(statuses.map((s, i) => [s, counts[i]])) as Record<Status, number>;
    return { total, byStatus, recent };
  }
}

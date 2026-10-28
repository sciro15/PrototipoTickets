import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../src/auth/auth-user';
import { TicketsService } from '../src/tickets/tickets.service';
import { ALLOWED_TRANSITIONS, canTransition } from '../src/tickets/ticket-transitions';

describe('TicketsService - cambio de estado e historial', () => {
  const tx = {
    ticket: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    ticketHistory: { create: jest.fn() },
  };
  const prisma = {
    ticket: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    ticketHistory: { findMany: jest.fn() },
    $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new TicketsService(prisma as any);
  const soporte: AuthUser = { id: 2, name: 'Carlos', email: 'c@x.test', role: 'SOPORTE' };
  const solicitante: AuthUser = { id: 4, name: 'Luis', email: 'l@x.test', role: 'SOLICITANTE' };

  beforeEach(() => jest.clearAllMocks());

  it('cambia el estado y registra el historial con el usuario del token', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: 1, status: 'ABIERTO', requesterId: 4 });
    tx.ticket.updateMany.mockResolvedValue({ count: 1 });
    tx.ticket.findUniqueOrThrow.mockResolvedValue({ id: 1, status: 'EN_PROGRESO' });

    const result = await service.changeStatus(1, { status: 'EN_PROGRESO' }, soporte);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.ticketHistory.create).toHaveBeenCalledWith({
      data: { ticketId: 1, previousStatus: 'ABIERTO', newStatus: 'EN_PROGRESO', changedById: 2 },
    });
    expect(result.status).toBe('EN_PROGRESO');
  });

  it('rechaza transiciones inválidas sin abrir transacción ni escribir historial', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: 1, status: 'CERRADO', requesterId: 4 });
    await expect(service.changeStatus(1, { status: 'ABIERTO' }, soporte)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.ticketHistory.create).not.toHaveBeenCalled();
  });

  it('devuelve conflicto si el estado cambió concurrentemente', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: 1, status: 'ABIERTO', requesterId: 4 });
    tx.ticket.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.changeStatus(1, { status: 'EN_PROGRESO' }, soporte)).rejects.toThrow(
      'modificado por otro usuario',
    );
    expect(tx.ticketHistory.create).not.toHaveBeenCalled();
  });

  it('consulta el historial de un ticket existente', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: 1, status: 'ABIERTO', requesterId: 4 });
    prisma.ticketHistory.findMany.mockResolvedValue([{ id: 1 }]);
    await expect(service.getHistory(1, soporte)).resolves.toHaveLength(1);
  });

  it('un solicitante no puede ver el historial de un ticket ajeno', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: 1, status: 'ABIERTO', requesterId: 99 });
    await expect(service.getHistory(1, solicitante)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.ticketHistory.findMany).not.toHaveBeenCalled();
  });

  it('un solicitante solo edita sus tickets en estado ABIERTO', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: 1, status: 'EN_PROGRESO', requesterId: 4 });
    await expect(service.update(1, { title: 'nuevo' }, solicitante)).rejects.toThrow('ABIERTO');
  });

  it('un usuario de soporte puede autoasignarse un ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: 1, status: 'ABIERTO', requesterId: 4, assigneeId: null });
    prisma.user.findUnique.mockResolvedValue({ id: 2, role: 'SOPORTE' });
    prisma.ticket.update = jest.fn().mockResolvedValue({ id: 1, assigneeId: 2 });

    const res = await service.assign(1, { assigneeId: 2 }, soporte);
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { assigneeId: 2 } }),
    );
    expect(res.assigneeId).toBe(2);
  });

  it('un usuario de soporte no puede asignar un ticket a otro usuario', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: 1, status: 'ABIERTO', requesterId: 4, assigneeId: null });
    await expect(service.assign(1, { assigneeId: 99 }, soporte)).rejects.toThrow('únicamente puede asignarse tickets a sí mismo');
  });

  it('no se puede asignar un ticket CERRADO', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: 1, status: 'CERRADO', requesterId: 4, assigneeId: null });
    await expect(service.assign(1, { assigneeId: 2 }, soporte)).rejects.toThrow('CERRADO');
  });
});

describe('Matriz de transiciones', () => {
  it('permite las transiciones definidas y bloquea el resto', () => {
    expect(canTransition('ABIERTO', 'EN_PROGRESO')).toBe(true);
    expect(canTransition('EN_PROGRESO', 'RESUELTO')).toBe(true);
    expect(canTransition('RESUELTO', 'CERRADO')).toBe(true);
    expect(canTransition('ABIERTO', 'RESUELTO')).toBe(false);
    expect(canTransition('ABIERTO', 'ABIERTO')).toBe(false);
    expect(ALLOWED_TRANSITIONS.CERRADO).toEqual([]);
  });
});

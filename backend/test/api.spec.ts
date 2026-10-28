import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthUser } from '../src/auth/auth-user';
import { RolesGuard } from '../src/auth/roles.guard';
import { configureApp } from '../src/app.setup';
import { DashboardController } from '../src/dashboard/dashboard.controller';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TicketsController } from '../src/tickets/tickets.controller';
import { TicketsService } from '../src/tickets/tickets.service';

/**
 * Pruebas HTTP con Prisma simulado. JwtAuthGuard se sustituye por un middleware
 * que fija `req.user`; RolesGuard sí es el real.
 */
describe('API REST (HTTP, Prisma simulado)', () => {
  let app: INestApplication;
  const admin: AuthUser = { id: 1, name: 'Ana', email: 'a@x.test', role: 'ADMIN' };
  const soporte: AuthUser = { id: 2, name: 'Carlos', email: 'c@x.test', role: 'SOPORTE' };
  const solicitante: AuthUser = { id: 4, name: 'Luis', email: 'l@x.test', role: 'SOLICITANTE' };
  let currentUser: AuthUser = admin;

  const prismaMock = {
    ticket: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)({}),
    ),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TicketsController, DashboardController],
      providers: [
        TicketsService,
        DashboardService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: { user?: AuthUser }, _res: unknown, next: () => void) => {
      req.user = currentUser;
      next();
    });
    configureApp(app);
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = admin;
  });

  it('POST /tickets rechaza datos obligatorios ausentes (400)', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/tickets').send({ requesterId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining(['El título es obligatorio', 'La descripción es obligatoria']),
    );
    expect(prismaMock.ticket.create).not.toHaveBeenCalled();
  });

  it('POST /tickets crea un ticket válido (201) sin permitir enviar estado', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 1, role: 'SOLICITANTE' });
    prismaMock.ticket.create.mockResolvedValue({ id: 10, status: 'ABIERTO', title: 'Falla' });

    const ok = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .send({ title: ' Falla ', description: 'No enciende', category: 'Hardware', requesterId: 1 });
    expect(ok.status).toBe(201);
    expect(ok.body.status).toBe('ABIERTO');
    expect(prismaMock.ticket.create.mock.calls[0][0].data.title).toBe('Falla');

    const forbidden = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .send({ title: 'x', description: 'y', category: 'z', requesterId: 1, status: 'CERRADO' });
    expect(forbidden.status).toBe(400);
  });

  it('POST /tickets por staff sin requesterId responde 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .send({ title: 'a', description: 'b', category: 'c' });
    expect(res.status).toBe(400);
  });

  it('POST /tickets con solicitante inexistente responde 404', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .send({ title: 'a', description: 'b', category: 'c', requesterId: 99 });
    expect(res.status).toBe(404);
  });

  it('SOLICITANTE crea tickets a su nombre (ignora requesterId enviado)', async () => {
    currentUser = solicitante;
    prismaMock.ticket.create.mockResolvedValue({ id: 11, status: 'ABIERTO' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .send({ title: 'a', description: 'b', category: 'c', requesterId: 99 });
    expect(res.status).toBe(201);
    expect(prismaMock.ticket.create.mock.calls[0][0].data.requesterId).toBe(4);
  });

  it('SOLICITANTE no puede asignar responsable (403)', async () => {
    currentUser = solicitante;
    const res = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .send({ title: 'a', description: 'b', category: 'c', assigneeId: 2 });
    expect(res.status).toBe(403);
    expect(prismaMock.ticket.create).not.toHaveBeenCalled();
  });

  it('GET /tickets filtra por estado en el backend', async () => {
    prismaMock.ticket.count.mockResolvedValue(1);
    prismaMock.ticket.findMany.mockResolvedValue([{ id: 1, status: 'ABIERTO' }]);

    const res = await request(app.getHttpServer()).get('/api/v1/tickets?status=ABIERTO&search=impresora');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(prismaMock.ticket.findMany.mock.calls[0][0].where).toEqual({
      status: 'ABIERTO',
      title: { contains: 'impresora' },
    });
  });

  it('GET /tickets como SOLICITANTE solo consulta sus propios tickets', async () => {
    currentUser = solicitante;
    prismaMock.ticket.count.mockResolvedValue(0);
    prismaMock.ticket.findMany.mockResolvedValue([]);
    const res = await request(app.getHttpServer()).get('/api/v1/tickets');
    expect(res.status).toBe(200);
    expect(prismaMock.ticket.findMany.mock.calls[0][0].where).toEqual({ requesterId: 4 });
  });

  it('GET /tickets con filtro inválido responde 400', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/tickets?status=INVENTADO');
    expect(res.status).toBe(400);
  });

  it('GET /tickets/:id inexistente responde 404 con formato coherente', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(null);
    const res = await request(app.getHttpServer()).get('/api/v1/tickets/999');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ statusCode: 404, path: '/api/v1/tickets/999' });
  });

  it('SOLICITANTE recibe 404 al consultar un ticket ajeno', async () => {
    currentUser = solicitante;
    prismaMock.ticket.findUnique.mockResolvedValue({ id: 7, requesterId: 5, status: 'ABIERTO' });
    const res = await request(app.getHttpServer()).get('/api/v1/tickets/7');
    expect(res.status).toBe(404);
  });

  it('GET /tickets/:id con id no numérico responde 400', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/tickets/abc');
    expect(res.status).toBe(400);
  });

  it('PATCH /tickets/:id/status rechaza transición inválida (400)', async () => {
    currentUser = soporte;
    prismaMock.ticket.findUnique.mockResolvedValue({ id: 1, status: 'ABIERTO' });
    const res = await request(app.getHttpServer())
      .patch('/api/v1/tickets/1/status')
      .send({ status: 'RESUELTO' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Transición no permitida');
  });

  it('PATCH /tickets/:id/status está prohibido para SOLICITANTE (403)', async () => {
    currentUser = solicitante;
    const res = await request(app.getHttpServer())
      .patch('/api/v1/tickets/1/status')
      .send({ status: 'EN_PROGRESO' });
    expect(res.status).toBe(403);
    expect(prismaMock.ticket.findUnique).not.toHaveBeenCalled();
  });

  it('GET /dashboard/summary devuelve indicadores del backend', async () => {
    prismaMock.ticket.count.mockImplementation(({ where }: { where?: { status?: string } } = {}) =>
      Promise.resolve(
        where?.status ? { ABIERTO: 3, EN_PROGRESO: 2, RESUELTO: 1, CERRADO: 4 }[where.status] : 10,
      ),
    );
    prismaMock.ticket.findMany.mockResolvedValue([{ id: 1 }]);

    const res = await request(app.getHttpServer()).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(10);
    expect(res.body.byStatus).toEqual({ ABIERTO: 3, EN_PROGRESO: 2, RESUELTO: 1, CERRADO: 4 });
    expect(res.body.recent).toHaveLength(1);
  });

  it('GET /dashboard/summary de SOLICITANTE se limita a sus tickets', async () => {
    currentUser = solicitante;
    prismaMock.ticket.count.mockResolvedValue(0);
    prismaMock.ticket.findMany.mockResolvedValue([]);
    await request(app.getHttpServer()).get('/api/v1/dashboard/summary').expect(200);
    expect(prismaMock.ticket.findMany.mock.calls[0][0].where).toEqual({ requesterId: 4 });
    expect(prismaMock.ticket.count.mock.calls[0][0].where).toEqual({ requesterId: 4 });
  });
});

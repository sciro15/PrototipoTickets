import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';

describe('AuthService.login', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  const jwt = { signAsync: jest.fn().mockResolvedValue('token.jwt.firmado') };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new AuthService(prisma as any, jwt as any);
  let hash: string;

  beforeAll(async () => {
    hash = await bcrypt.hash('Secreta123', 4);
  });
  beforeEach(() => jest.clearAllMocks());

  it('devuelve token y usuario (sin hash) con credenciales correctas', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1, name: 'Ana', email: 'a@x.test', role: 'ADMIN', passwordHash: hash,
    });
    const res = await service.login({ email: 'a@x.test', password: 'Secreta123' });
    expect(res.accessToken).toBe('token.jwt.firmado');
    expect(res.user).toEqual({ id: 1, name: 'Ana', email: 'a@x.test', role: 'ADMIN' });
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 1, role: 'ADMIN' });
  });

  it('rechaza contraseña incorrecta', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, role: 'ADMIN', passwordHash: hash });
    await expect(service.login({ email: 'a@x.test', password: 'otra' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza correo inexistente con el mismo mensaje', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'no@x.test', password: 'x' })).rejects.toThrow('Credenciales inválidas');
  });

  it('rechaza usuarios con hash vacío', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, role: 'ADMIN', passwordHash: '' });
    await expect(service.login({ email: 'a@x.test', password: 'relleno-no-valido' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('RolesGuard', () => {
  const ctxFor = (user?: { role: string }) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const guardWith = (roles?: string[]) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new RolesGuard({ getAllByOverride: undefined, getAllAndOverride: () => roles } as any);

  it('permite cualquier usuario autenticado si no hay @Roles', () => {
    expect(guardWith(undefined).canActivate(ctxFor({ role: 'SOLICITANTE' }))).toBe(true);
  });
  it('permite un rol incluido', () => {
    expect(guardWith(['ADMIN', 'SOPORTE']).canActivate(ctxFor({ role: 'SOPORTE' }))).toBe(true);
  });
  it('rechaza un rol no incluido con 403', () => {
    expect(() => guardWith(['ADMIN']).canActivate(ctxFor({ role: 'SOLICITANTE' }))).toThrow(ForbiddenException);
  });
});

describe('JwtAuthGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const jwt = { verifyAsync: jest.fn() };
  const prisma = { user: { findUnique: jest.fn() } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guard = new JwtAuthGuard(reflector as any, jwt as any, prisma as any);
  const ctx = (headers: Record<string, string>) => {
    const req: { headers: Record<string, string>; user?: unknown } = { headers };
    return {
      ctx: {
        getHandler: () => undefined,
        getClass: () => undefined,
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext,
      req,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
  });

  it('deja pasar rutas públicas sin token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(ctx({}).ctx)).resolves.toBe(true);
  });

  it('rechaza peticiones sin token (401)', async () => {
    await expect(guard.canActivate(ctx({}).ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza tokens inválidos o expirados (401)', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    await expect(guard.canActivate(ctx({ authorization: 'Bearer malo' }).ctx)).rejects.toThrow('inválido o expirado');
  });

  it('adjunta el usuario de la BD a la petición con token válido', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 3 });
    prisma.user.findUnique.mockResolvedValue({ id: 3, name: 'X', email: 'x@x.test', role: 'SOPORTE' });
    const { ctx: c, req } = ctx({ authorization: 'Bearer bueno' });
    await expect(guard.canActivate(c)).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: 3, role: 'SOPORTE' });
  });

  it('rechaza si el usuario del token ya no existe', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 99 });
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(ctx({ authorization: 'Bearer bueno' }).ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

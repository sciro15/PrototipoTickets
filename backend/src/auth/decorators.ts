import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from './auth-user';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marca una ruta como pública (sin token). Por defecto todas las rutas exigen JWT. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restringe una ruta a los roles indicados. Sin @Roles basta con estar autenticado. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Inyecta el usuario autenticado en el parámetro del controlador. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);

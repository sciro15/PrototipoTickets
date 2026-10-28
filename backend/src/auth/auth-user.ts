import { Role } from '@prisma/client';

/** Usuario autenticado adjuntado a la petición por JwtAuthGuard. */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

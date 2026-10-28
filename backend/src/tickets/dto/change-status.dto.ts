import { Status } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeStatusDto {
  @IsEnum(Status, { message: 'El estado debe ser ABIERTO, EN_PROGRESO, RESUELTO o CERRADO' })
  status: Status;
  // El usuario que realiza el cambio se toma del token JWT, no del cliente.
}

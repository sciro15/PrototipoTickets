import { Type } from 'class-transformer';
import { IsInt, IsPositive, ValidateIf } from 'class-validator';

export class AssignTicketDto {
  /** Id del agente (ADMIN o SOPORTE) a asignar, o null para dejar sin asignar. */
  @ValidateIf((o) => o.assigneeId != null)
  @Type(() => Number)
  @IsInt({ message: 'assigneeId debe ser un entero' })
  @IsPositive({ message: 'assigneeId debe ser un identificador positivo' })
  assigneeId?: number | null;
}

import { Priority } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/transformers/trim.transformer';

export class CreateTicketDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(150, { message: 'El título no puede superar 150 caracteres' })
  title: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(2000, { message: 'La descripción no puede superar 2000 caracteres' })
  description: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  @MaxLength(60, { message: 'La categoría no puede superar 60 caracteres' })
  category: string;

  @IsOptional()
  @IsEnum(Priority, { message: 'La prioridad debe ser BAJA, MEDIA, ALTA o CRITICA' })
  priority?: Priority;

  /** Obligatorio para ADMIN/SOPORTE. Para SOLICITANTE se ignora (se usa su propio id). */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'requesterId debe ser un entero' })
  @IsPositive()
  requesterId?: number;

  /** Opcional. `null` o ausente = sin responsable. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'assigneeId debe ser un entero' })
  @IsPositive()
  assigneeId?: number | null;
}

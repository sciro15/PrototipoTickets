import { Priority, Status } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Trim } from '../../common/transformers/trim.transformer';

export class QueryTicketsDto {
  @IsOptional()
  @IsEnum(Status, { message: 'Filtro status inválido' })
  status?: Status;

  @IsOptional()
  @IsEnum(Priority, { message: 'Filtro priority inválido' })
  priority?: Priority;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100, { message: 'La búsqueda no puede superar 100 caracteres' })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

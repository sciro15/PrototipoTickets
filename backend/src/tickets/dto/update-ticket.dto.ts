import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateTicketDto } from './create-ticket.dto';

/** El solicitante no es editable una vez creado el ticket. */
export class UpdateTicketDto extends PartialType(OmitType(CreateTicketDto, ['requesterId'] as const)) {}

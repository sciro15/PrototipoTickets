import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser, Roles } from '../auth/decorators';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(@Query() query: QueryTicketsDto, @CurrentUser() user: AuthUser) {
    return this.ticketsService.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.ticketsService.findOne(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthUser) {
    return this.ticketsService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.update(id, dto, user);
  }

  /**
   * Asignación de tickets:
   * - ADMIN: puede asignar a cualquier agente (SOPORTE o ADMIN) o quitar asignación (null).
   * - SOPORTE: puede asignarse a sí mismo ("Asignarme a mí") o desasignarse.
   */
  @Roles('ADMIN', 'SOPORTE')
  @Patch(':id/assign')
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.assign(id, dto, user);
  }

  /** Solo personal de soporte y administración puede cambiar estados. */
  @Roles('ADMIN', 'SOPORTE')
  @Patch(':id/status')
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.changeStatus(id, dto, user);
  }

  @Get(':id/history')
  getHistory(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.ticketsService.getHistory(id, user);
  }
}

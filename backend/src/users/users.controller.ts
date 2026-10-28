import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** ADMIN y SOPORTE (SOPORTE lo necesita para elegir responsables). */
  @Roles('ADMIN', 'SOPORTE')
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Roles('ADMIN', 'SOPORTE')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Roles('ADMIN')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}

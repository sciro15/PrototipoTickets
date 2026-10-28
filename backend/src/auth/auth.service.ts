import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

// Hash de relleno: se compara aunque el correo no exista, para no revelar
// por tiempo de respuesta qué correos están registrados.
const DUMMY_HASH = bcrypt.hashSync('relleno-no-valido', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const matches = await bcrypt.compare(dto.password, user?.passwordHash || DUMMY_HASH);

    // Mensaje único para correo inexistente, contraseña errónea o hash vacío
    if (!user || !user.passwordHash || !matches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }
}

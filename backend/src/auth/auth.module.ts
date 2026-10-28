import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 16) {
          throw new Error('JWT_SECRET es obligatorio y debe tener al menos 16 caracteres');
        }
        return {
          secret,
          signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '8h' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  // Se exporta JwtModule para que JwtAuthGuard (registrado en AppModule) obtenga JwtService
  exports: [JwtModule],
})
export class AuthModule {}

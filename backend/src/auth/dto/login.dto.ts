import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(150)
  email: string;

  @IsString()
  @MinLength(1, { message: 'La contraseña es obligatoria' })
  @MaxLength(72) // límite efectivo de bcrypt
  password: string;
}

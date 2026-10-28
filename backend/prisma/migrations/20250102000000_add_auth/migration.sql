-- Agrega el hash de contraseña. El DEFAULT temporal permite migrar filas existentes
-- (hash vacío = no puede iniciar sesión hasta que el seed/administrador asigne contraseña).
ALTER TABLE `User` ADD COLUMN `passwordHash` VARCHAR(255) NOT NULL DEFAULT '';

-- Se retira el DEFAULT para que coincida con schema.prisma (campo obligatorio sin valor por defecto).
ALTER TABLE `User` ALTER COLUMN `passwordHash` DROP DEFAULT;

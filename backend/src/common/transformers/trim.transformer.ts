import { Transform } from 'class-transformer';

/** Elimina espacios al inicio y final de cadenas; deja otros tipos intactos. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

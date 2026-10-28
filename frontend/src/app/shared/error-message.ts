import { HttpErrorResponse } from '@angular/common/http';

/** Convierte un error HTTP en un mensaje legible para el usuario. */
export function extractErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Verifique que la API esté en ejecución.';
    }
    const message = err.error?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string') return message;
    return `Error ${err.status}: ${err.statusText || 'solicitud fallida'}`;
  }
  return 'Ocurrió un error inesperado.';
}

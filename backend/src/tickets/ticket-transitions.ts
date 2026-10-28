import { BadRequestException } from '@nestjs/common';
import { Status } from '@prisma/client';

/**
 * Matriz estricta de transiciones de estados permitidas en el ciclo de vida del Ticket:
 *
 *  [ABIERTO]     ──> [EN_PROGRESO] (Inicio de atención por soporte)
 *  [ABIERTO]     ──> [CERRADO]     (Cierre o descarte directo sin atención)
 *  [EN_PROGRESO] ──> [RESUELTO]    (Solución aplicada)
 *  [EN_PROGRESO] ──> [ABIERTO]     (Devuelto a cola sin resolver)
 *  [RESUELTO]    ──> [CERRADO]     (Confirmación de cierre)
 *  [RESUELTO]    ──> [EN_PROGRESO] (Reapertura: el problema persiste)
 *  [CERRADO]     ──> (Estado final inmutable: no admite ninguna transición)
 */
export const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  ABIERTO: ['EN_PROGRESO', 'CERRADO'],
  EN_PROGRESO: ['ABIERTO', 'RESUELTO'],
  RESUELTO: ['EN_PROGRESO', 'CERRADO'],
  CERRADO: [],
};

export function canTransition(from: Status, to: Status): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Valida la transición de estado y lanza una excepción clara si no es permitida.
 */
export function validateStateTransition(current: Status, target: Status): void {
  if (current === target) {
    throw new BadRequestException(
      `El ticket ya se encuentra en estado ${current}. Seleccione un estado diferente.`,
    );
  }

  if (current === 'CERRADO') {
    throw new BadRequestException(
      'El ticket se encuentra CERRADO. Es un estado final inmutable y no admite más transiciones.',
    );
  }

  if (!canTransition(current, target)) {
    const allowed = ALLOWED_TRANSITIONS[current];
    const allowedText =
      allowed.length > 0 ? allowed.join(', ') : 'ninguna (estado final)';
    throw new BadRequestException(
      `Flujo inválido: No está permitido pasar de ${current} a ${target}. Transiciones válidas desde ${current}: [${allowedText}].`,
    );
  }
}

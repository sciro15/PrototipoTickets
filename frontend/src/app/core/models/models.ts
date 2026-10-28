// Modelos conceptualmente compartidos con el backend (ver backend/prisma/schema.prisma).

export type Role = 'ADMIN' | 'SOPORTE' | 'SOLICITANTE';
export type Priority = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
export type Status = 'ABIERTO' | 'EN_PROGRESO' | 'RESUELTO' | 'CERRADO';

export const ROLES: Role[] = ['ADMIN', 'SOPORTE', 'SOLICITANTE'];
export const PRIORITIES: Priority[] = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
export const STATUSES: Status[] = ['ABIERTO', 'EN_PROGRESO', 'RESUELTO', 'CERRADO'];

export const STATUS_LABELS: Record<Status, string> = {
  ABIERTO: 'Abierto',
  EN_PROGRESO: 'En progreso',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

/**
 * Transiciones permitidas. Es solo una ayuda visual: la regla real
 * se valida en el backend (backend/src/tickets/ticket-transitions.ts).
 */
export const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  ABIERTO: ['EN_PROGRESO', 'CERRADO'],
  EN_PROGRESO: ['ABIERTO', 'RESUELTO'],
  RESUELTO: ['EN_PROGRESO', 'CERRADO'],
  CERRADO: [],
};

export interface UserRef {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface User extends UserRef {
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  user: UserRef;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: Status;
  requesterId: number;
  assigneeId: number | null;
  requester: UserRef;
  assignee: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketPayload {
  title: string;
  description: string;
  category: string;
  priority: Priority;
  /** Solo ADMIN/SOPORTE. Los solicitantes no lo envían. */
  assigneeId?: number | null;
}

export interface CreateTicketPayload extends TicketPayload {
  /** Solo ADMIN/SOPORTE. Para SOLICITANTE el backend usa el usuario del token. */
  requesterId?: number;
}

export interface TicketHistory {
  id: number;
  ticketId: number;
  previousStatus: Status;
  newStatus: Status;
  changedById: number | null;
  changedBy: UserRef | null;
  createdAt: string;
}

export interface TicketFilters {
  status?: Status | '';
  priority?: Priority | '';
  search?: string;
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface DashboardSummary {
  total: number;
  byStatus: Record<Status, number>;
  recent: Ticket[];
}

import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ALLOWED_TRANSITIONS,
  STATUS_LABELS,
  Status,
  Ticket,
  TicketHistory,
  User,
} from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { TicketsService } from '../../core/services/tickets.service';
import { UsersService } from '../../core/services/users.service';
import { PriorityBadgeComponent, StatusBadgeComponent } from '../../shared/badges.component';
import { extractErrorMessage } from '../../shared/error-message';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, StatusBadgeComponent, PriorityBadgeComponent],
  template: `
    <p><a routerLink="/tickets">← Volver al listado</a></p>

    @if (loading()) {
      <p class="state" role="status">Cargando ticket…</p>
    }
    @if (error()) {
      <div class="alert alert-error" role="alert">{{ error() }}</div>
    }
    @if (message()) {
      <div class="alert alert-ok" role="status">{{ message() }}</div>
    }

    @if (ticket(); as t) {
      <div class="section-head">
        <h1>#{{ t.id }} · {{ t.title }}</h1>
        @if (canEdit()) {
          <a class="btn" [routerLink]="['/tickets', t.id, 'editar']">Editar</a>
        }
      </div>

      <section class="card">
        <dl class="details">
          <div><dt>Estado</dt><dd><app-status-badge [status]="t.status" /></dd></div>
          <div><dt>Prioridad</dt><dd><app-priority-badge [priority]="t.priority" /></dd></div>
          <div><dt>Categoría</dt><dd>{{ t.category }}</dd></div>
          <div><dt>Solicitante</dt><dd>{{ t.requester.name }}</dd></div>
          <div>
            <dt>Responsable</dt>
            <dd>
              {{ t.assignee?.name ?? 'Sin asignar' }}
              @if (auth.isStaff() && t.assigneeId === auth.user()?.id) {
                <span class="badge" style="margin-left: 0.35rem; background: #e0f2fe; color: #0369a1;">(Tú)</span>
              }
            </dd>
          </div>
          <div><dt>Creado</dt><dd>{{ t.createdAt | date: 'dd/MM/yyyy HH:mm' }}</dd></div>
          <div><dt>Última actualización</dt><dd>{{ t.updatedAt | date: 'dd/MM/yyyy HH:mm' }}</dd></div>
        </dl>
        <h2>Descripción</h2>
        <p class="description">{{ t.description }}</p>
      </section>

      <!-- Gestión de Asignación de Responsable (ADMIN y SOPORTE) -->
      @if (auth.isStaff() && t.status !== 'CERRADO') {
        <section class="card">
          <h2>Asignación de responsable</h2>

          <!-- Perfil SOPORTE: botón para autoasignarse -->
          @if (auth.hasRole('SOPORTE')) {
            <div class="actions" style="align-items: center;">
              @if (t.assigneeId !== auth.user()?.id) {
                <button type="button" class="btn btn-primary" [disabled]="assigning()" (click)="assignToMe()">
                  {{ assigning() ? 'Asignando…' : 'Asignarme a mí' }}
                </button>
              } @else {
                <span class="badge" style="background: #e6f5ec; color: #135c35; padding: 0.4rem 0.8rem; font-size: 0.88rem;">
                  ✓ Estás asignado como responsable
                </span>
                <button type="button" class="btn" [disabled]="assigning()" (click)="unassign()">
                  {{ assigning() ? 'Procesando…' : 'Liberar asignación' }}
                </button>
              }
            </div>
          }

          <!-- Perfil ADMIN: selector para asignar a cualquier agente de soporte o admin -->
          @if (auth.hasRole('ADMIN')) {
            <form class="inline-form" [formGroup]="assignForm" (ngSubmit)="submitAdminAssign()">
              <label>
                Seleccionar agente responsable
                <select formControlName="assigneeId">
                  <option [ngValue]="null">Sin asignar</option>
                  @for (u of assignees(); track u.id) {
                    <option [ngValue]="u.id">{{ u.name }} ({{ u.role }})</option>
                  }
                </select>
              </label>
              <button type="submit" class="btn btn-primary" [disabled]="assigning()">
                {{ assigning() ? 'Guardando…' : 'Asignar agente' }}
              </button>
              @if (t.assigneeId !== auth.user()?.id) {
                <button type="button" class="btn" [disabled]="assigning()" (click)="assignToMe()">
                  Asignarme a mí
                </button>
              }
            </form>
          }

          @if (assignError()) {
            <div class="alert alert-error" style="margin-top: 0.75rem;" role="alert">{{ assignError() }}</div>
          }
        </section>
      }

      <!-- Solo ADMIN y SOPORTE pueden cambiar estados (el backend también lo exige) -->
      @if (auth.isStaff()) {
        <section class="card">
          <h2>Gestión del flujo de estado</h2>
          <p class="muted small">
            Estado actual: <strong>{{ labels[t.status] }}</strong>.
            @if (t.status === 'CERRADO') {
              El ticket está <strong>CERRADO</strong> (estado final inmutable; no admite más transiciones).
            } @else {
              Transiciones válidas desde este estado:
              @for (st of nextStatuses(); track st; let last = $last) {
                <span><strong>{{ labels[st] }}</strong>{{ last ? '.' : ', ' }}</span>
              }
            }
          </p>

          @if (nextStatuses().length === 0) {
            <div class="alert alert-info">
              Este ticket se encuentra cerrado definitivamente. No es posible realizar cambios de estado adicionales.
            </div>
          } @else {
            <form class="inline-form" [formGroup]="statusForm" (ngSubmit)="changeStatus()">
              <label>
                Nuevo estado permitido
                <select formControlName="status">
                  <option value="" disabled>Seleccione una opción válida…</option>
                  @for (s of nextStatuses(); track s) { <option [value]="s">{{ labels[s] }}</option> }
                </select>
              </label>
              <button type="submit" class="btn btn-primary" [disabled]="statusForm.invalid || changing()">
                {{ changing() ? 'Guardando…' : 'Aplicar cambio de estado' }}
              </button>
            </form>
          }
        </section>
      }

      <section class="card">
        <h2>Historial de estados</h2>
        @if (history().length === 0) {
          <p class="empty">Este ticket aún no tiene cambios de estado.</p>
        } @else {
          <ol class="timeline">
            @for (h of history(); track h.id) {
              <li>
                <strong>{{ labels[h.previousStatus] }} → {{ labels[h.newStatus] }}</strong>
                <span>{{ h.createdAt | date: 'dd/MM/yyyy HH:mm' }} · {{ h.changedBy?.name ?? 'Usuario no especificado' }}</span>
              </li>
            }
          </ol>
        }
      </section>
    }
  `,
})
export class TicketDetailComponent implements OnInit {
  private readonly api = inject(TicketsService);
  private readonly usersApi = inject(UsersService);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  readonly labels = STATUS_LABELS;

  readonly ticket = signal<Ticket | null>(null);
  readonly history = signal<TicketHistory[]>([]);
  readonly assignees = signal<User[]>([]);
  readonly loading = signal(false);
  readonly changing = signal(false);
  readonly assigning = signal(false);
  readonly error = signal<string | null>(null);
  readonly assignError = signal<string | null>(null);
  readonly message = signal<string | null>(window.history.state?.message ?? null);

  readonly nextStatuses = computed<Status[]>(() => {
    const t = this.ticket();
    return t ? ALLOWED_TRANSITIONS[t.status] : [];
  });

  /** Un ticket CERRADO no se edita nunca. Solicitante solo si está ABIERTO. Staff si no está CERRADO. */
  readonly canEdit = computed(() => {
    const t = this.ticket();
    if (!t || t.status === 'CERRADO') return false;
    return this.auth.isStaff() || t.status === 'ABIERTO';
  });

  readonly statusForm = this.fb.group({
    status: ['', Validators.required],
  });

  readonly assignForm = this.fb.group({
    assigneeId: [null as number | null],
  });

  ngOnInit(): void {
    this.loading.set(true);
    if (this.auth.hasRole('ADMIN')) {
      this.usersApi.list().subscribe({
        next: (users) => this.assignees.set(users.filter((u) => u.role !== 'SOLICITANTE')),
        error: () => {},
      });
    }
    this.reload();
  }

  private reload(): void {
    const id = Number(this.id());
    this.api.get(id).subscribe({
      next: (t) => {
        this.ticket.set(t);
        this.assignForm.patchValue({ assigneeId: t.assigneeId });
        this.loading.set(false);
        this.api.history(id).subscribe({ next: (h) => this.history.set(h) });
      },
      error: (e) => {
        this.error.set(extractErrorMessage(e));
        this.loading.set(false);
      },
    });
  }

  assignToMe(): void {
    const user = this.auth.user();
    if (!user) return;
    this.doAssign(user.id, 'Te has asignado el ticket correctamente.');
  }

  unassign(): void {
    this.doAssign(null, 'Se ha liberado la asignación del ticket.');
  }

  submitAdminAssign(): void {
    const { assigneeId } = this.assignForm.getRawValue();
    this.doAssign(assigneeId, 'Responsable asignado correctamente.');
  }

  private doAssign(assigneeId: number | null, successMessage: string): void {
    this.assigning.set(true);
    this.assignError.set(null);
    this.message.set(null);
    this.api.assign(Number(this.id()), assigneeId).subscribe({
      next: (updatedTicket) => {
        this.assigning.set(false);
        this.ticket.set(updatedTicket);
        this.assignForm.patchValue({ assigneeId: updatedTicket.assigneeId });
        this.message.set(successMessage);
      },
      error: (e) => {
        this.assigning.set(false);
        this.assignError.set(extractErrorMessage(e));
      },
    });
  }

  changeStatus(): void {
    const { status } = this.statusForm.getRawValue();
    if (!status) return;

    // Validación preventiva en cliente contra la matriz de transiciones permitidas
    if (!this.nextStatuses().includes(status as Status)) {
      this.error.set('La transición seleccionada no es válida para el estado actual del ticket.');
      return;
    }

    this.changing.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.changeStatus(Number(this.id()), status as Status).subscribe({
      next: () => {
        this.changing.set(false);
        this.statusForm.reset({ status: '' });
        this.message.set('Estado actualizado correctamente.');
        this.reload();
      },
      error: (e) => {
        this.error.set(extractErrorMessage(e));
        this.changing.set(false);
      },
    });
  }
}

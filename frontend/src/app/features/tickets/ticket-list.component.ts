import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  Paginated,
  STATUSES,
  STATUS_LABELS,
  Ticket,
  User,
} from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { TicketsService } from '../../core/services/tickets.service';
import { UsersService } from '../../core/services/users.service';
import { PriorityBadgeComponent, StatusBadgeComponent } from '../../shared/badges.component';
import { extractErrorMessage } from '../../shared/error-message';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, StatusBadgeComponent, PriorityBadgeComponent],
  template: `
    <div class="section-head">
      <h1>{{ auth.isStaff() ? 'Tickets' : 'Mis tickets' }}</h1>
      <a routerLink="/tickets/nuevo" class="btn btn-primary">Nuevo ticket</a>
    </div>

    @if (actionMessage()) {
      <div class="alert alert-ok" role="status">{{ actionMessage() }}</div>
    }
    @if (actionError()) {
      <div class="alert alert-error" role="alert">{{ actionError() }}</div>
    }

    <form class="card filters" [formGroup]="filters" role="search" aria-label="Filtros de tickets">
      <label>
        Buscar por título
        <input type="search" formControlName="search" maxlength="100" placeholder="Ej.: impresora" />
      </label>
      <label>
        Estado
        <select formControlName="status">
          <option value="">Todos</option>
          @for (s of statuses; track s) { <option [value]="s">{{ statusLabels[s] }}</option> }
        </select>
      </label>
      <label>
        Prioridad
        <select formControlName="priority">
          <option value="">Todas</option>
          @for (p of priorities; track p) { <option [value]="p">{{ priorityLabels[p] }}</option> }
        </select>
      </label>
    </form>

    @if (loading()) {
      <p class="state" role="status">Cargando tickets…</p>
    }
    @if (error()) {
      <div class="alert alert-error" role="alert">
        {{ error() }} <button type="button" class="btn btn-link" (click)="load()">Reintentar</button>
      </div>
    }

    @if (!loading() && !error() && result(); as r) {
      @if (r.data.length === 0) {
        <p class="empty card">No se encontraron tickets con los criterios indicados.</p>
      } @else {
        <div class="card table-wrap">
          <table>
            <caption class="sr-only">Listado de tickets</caption>
            <thead>
              <tr>
                <th class="nowrap">#</th>
                <th>Título</th>
                <th class="nowrap">Categoría</th>
                <th class="nowrap">Prioridad</th>
                <th class="nowrap">Estado</th>
                <th>Solicitante</th>
                <th>{{ auth.isStaff() ? 'Responsable / Asignación' : 'Responsable' }}</th>
                <th class="nowrap">Fecha</th>
              </tr>
            </thead>
            <tbody>
              @for (t of r.data; track t.id) {
                <tr>
                  <td class="nowrap"><strong>#{{ t.id }}</strong></td>
                  <td style="min-width: 170px;"><a [routerLink]="['/tickets', t.id]">{{ t.title }}</a></td>
                  <td class="nowrap">{{ t.category }}</td>
                  <td class="nowrap"><app-priority-badge [priority]="t.priority" /></td>
                  <td class="nowrap"><app-status-badge [status]="t.status" /></td>
                  <td>{{ t.requester.name }}</td>
                  <td>
                    @if (auth.isStaff()) {
                      @if (t.status === 'CERRADO') {
                        <span class="muted">{{ t.assignee?.name ?? 'Sin asignar' }}</span>
                      } @else if (auth.hasRole('SOPORTE')) {
                        <div class="inline-actions">
                          <span>
                            {{ t.assignee?.name ?? 'Sin asignar' }}
                            @if (t.assigneeId === auth.user()?.id) {
                              <span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 0.72rem; margin-left: 0.2rem;">(Tú)</span>
                            }
                          </span>
                          @if (t.assigneeId !== auth.user()?.id) {
                            <button
                              type="button"
                              class="btn btn-small btn-primary"
                              [disabled]="assigningId() === t.id"
                              (click)="assignToMe(t)"
                            >
                              {{ assigningId() === t.id ? '…' : 'Asignarme a mí' }}
                            </button>
                          } @else {
                            <button
                              type="button"
                              class="btn btn-small"
                              [disabled]="assigningId() === t.id"
                              (click)="unassign(t)"
                              title="Liberar asignación"
                            >
                              {{ assigningId() === t.id ? '…' : 'Liberar' }}
                            </button>
                          }
                        </div>
                      } @else if (auth.hasRole('ADMIN')) {
                        <div class="inline-actions">
                          <select
                            class="select-small"
                            [disabled]="assigningId() === t.id"
                            (change)="onAdminSelect(t, $event)"
                            aria-label="Asignar responsable"
                          >
                            <option value="" [selected]="t.assigneeId === null">Sin asignar</option>
                            @for (u of assignees(); track u.id) {
                              <option [value]="u.id" [selected]="t.assigneeId === u.id">{{ u.name }} ({{ u.role }})</option>
                            }
                          </select>
                          @if (t.assigneeId !== auth.user()?.id) {
                            <button
                              type="button"
                              class="btn btn-small"
                              title="Asignarme a mí"
                              [disabled]="assigningId() === t.id"
                              (click)="assignToMe(t)"
                            >
                              Asignarme
                            </button>
                          }
                        </div>
                      }
                    } @else {
                      {{ t.assignee?.name ?? '—' }}
                    }
                  </td>
                  <td class="nowrap">{{ t.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <nav class="pager" aria-label="Paginación">
          <button type="button" class="btn" [disabled]="r.meta.page <= 1" (click)="goTo(r.meta.page - 1)">Anterior</button>
          <span>Página {{ r.meta.page }} de {{ r.meta.totalPages }} · {{ r.meta.total }} tickets</span>
          <button type="button" class="btn" [disabled]="r.meta.page >= r.meta.totalPages" (click)="goTo(r.meta.page + 1)">Siguiente</button>
        </nav>
      }
    }
  `,
})
export class TicketListComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(TicketsService);
  private readonly usersApi = inject(UsersService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = STATUSES;
  readonly priorities = PRIORITIES;
  readonly statusLabels = STATUS_LABELS;
  readonly priorityLabels = PRIORITY_LABELS;

  readonly filters = this.fb.nonNullable.group({ search: '', status: '', priority: '' });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<Paginated<Ticket> | null>(null);
  readonly assignees = signal<User[]>([]);
  readonly assigningId = signal<number | null>(null);
  readonly actionMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  private page = 1;

  ngOnInit(): void {
    if (this.auth.hasRole('ADMIN')) {
      this.usersApi.list().subscribe({
        next: (users) => this.assignees.set(users.filter((u) => u.role !== 'SOLICITANTE')),
        error: () => {},
      });
    }

    this.filters.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page = 1;
        this.load();
      });
    this.load();
  }

  goTo(page: number): void {
    this.page = page;
    this.load();
  }

  load(): void {
    const v = this.filters.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.api
      .list({
        search: v.search.trim(),
        status: v.status as never,
        priority: v.priority as never,
        page: this.page,
        limit: 10,
      })
      .subscribe({
        next: (r) => {
          this.result.set(r);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(extractErrorMessage(e));
          this.loading.set(false);
        },
      });
  }

  assignToMe(t: Ticket): void {
    const me = this.auth.user();
    if (!me) return;
    this.doAssign(t, me.id, `Ticket #${t.id} asignado a ${me.name}.`);
  }

  unassign(t: Ticket): void {
    this.doAssign(t, null, `Se liberó la asignación del ticket #${t.id}.`);
  }

  onAdminSelect(t: Ticket, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const val = select.value;
    const targetId = val === '' ? null : Number(val);
    const targetName = targetId
      ? (this.assignees().find((u) => u.id === targetId)?.name ?? `Agente #${targetId}`)
      : 'Sin asignar';
    this.doAssign(t, targetId, `Ticket #${t.id} asignado a: ${targetName}.`);
  }

  private doAssign(t: Ticket, assigneeId: number | null, successMsg: string): void {
    this.assigningId.set(t.id);
    this.actionError.set(null);
    this.actionMessage.set(null);
    this.api.assign(t.id, assigneeId).subscribe({
      next: (updatedTicket) => {
        this.assigningId.set(null);
        this.actionMessage.set(successMsg);
        const curr = this.result();
        if (curr) {
          const newData = curr.data.map((item) => (item.id === updatedTicket.id ? updatedTicket : item));
          this.result.set({ ...curr, data: newData });
        }
      },
      error: (e) => {
        this.assigningId.set(null);
        this.actionError.set(extractErrorMessage(e));
      },
    });
  }
}

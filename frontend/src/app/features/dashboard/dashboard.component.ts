import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardSummary, STATUSES, STATUS_LABELS } from '../../core/models/models';
import { DashboardService } from '../../core/services/dashboard.service';
import { PriorityBadgeComponent, StatusBadgeComponent } from '../../shared/badges.component';
import { extractErrorMessage } from '../../shared/error-message';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe, StatusBadgeComponent, PriorityBadgeComponent],
  template: `
    <h1>Panel principal</h1>

    @if (loading()) {
      <p class="state" role="status">Cargando indicadores…</p>
    }
    @if (error()) {
      <div class="alert alert-error" role="alert">
        {{ error() }} <button type="button" class="btn btn-link" (click)="load()">Reintentar</button>
      </div>
    }

    @if (summary(); as s) {
      <section class="cards" aria-label="Indicadores">
        <article class="card stat">
          <span class="stat-label">{{ auth.isStaff() ? 'Total de tickets' : 'Mis tickets' }}</span>
          <span class="stat-value" id="stat-total">{{ s.total }}</span>
        </article>
        @for (st of statuses; track st) {
          <article class="card stat" [class]="'card stat stat-' + st">
            <span class="stat-label">{{ labels[st] }}</span>
            <span class="stat-value">{{ s.byStatus[st] }}</span>
          </article>
        }
      </section>

      <section class="card">
        <div class="section-head">
          <h2>{{ auth.isStaff() ? 'Tickets más recientes' : 'Mis tickets más recientes' }}</h2>
          <a routerLink="/tickets/nuevo" class="btn btn-primary">Nuevo ticket</a>
        </div>
        @if (s.recent.length === 0) {
          <p class="empty">Aún no hay tickets registrados.</p>
        } @else {
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Título</th><th>Prioridad</th><th>Estado</th><th>Solicitante</th><th>Creado</th></tr>
              </thead>
              <tbody>
                @for (t of s.recent; track t.id) {
                  <tr>
                    <td><a [routerLink]="['/tickets', t.id]">{{ t.title }}</a></td>
                    <td><app-priority-badge [priority]="t.priority" /></td>
                    <td><app-status-badge [status]="t.status" /></td>
                    <td>{{ t.requester.name }}</td>
                    <td>{{ t.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    }
  `,
})
export class DashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(DashboardService);
  readonly statuses = STATUSES;
  readonly labels = STATUS_LABELS;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly summary = signal<DashboardSummary | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.summary().subscribe({
      next: (s) => {
        this.summary.set(s);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(extractErrorMessage(e));
        this.loading.set(false);
      },
    });
  }
}

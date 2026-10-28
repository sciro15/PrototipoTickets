import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a class="skip-link" href="#contenido">Saltar al contenido</a>
    <header class="app-header">
      <div class="container header-inner">
        <a routerLink="/dashboard" class="brand">
          <span class="brand-mark" aria-hidden="true">◆</span>
          Soluciones Andinas · Tickets
        </a>
        @if (auth.user(); as u) {
          <nav aria-label="Navegación principal">
            <a routerLink="/dashboard" routerLinkActive="active">Panel</a>
            <a routerLink="/tickets" routerLinkActive="active">
              {{ auth.isStaff() ? 'Tickets' : 'Mis tickets' }}
            </a>
            @if (auth.hasRole('ADMIN')) {
              <a routerLink="/usuarios" routerLinkActive="active">Usuarios</a>
            }
          </nav>
          <div class="session">
            <span class="session-name">{{ u.name }} <span class="badge role">{{ u.role }}</span></span>
            <button type="button" class="btn btn-small" (click)="auth.logout()">Cerrar sesión</button>
          </div>
        }
      </div>
    </header>
    <main id="contenido" class="container">
      <router-outlet />
    </main>
  `,
})
export class AppComponent {
  readonly auth = inject(AuthService);
}

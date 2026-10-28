import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    title: 'Iniciar sesión',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    title: 'Panel principal',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'tickets',
    title: 'Tickets',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tickets/ticket-list.component').then((m) => m.TicketListComponent),
  },
  {
    path: 'tickets/nuevo',
    title: 'Nuevo ticket',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tickets/ticket-form.component').then((m) => m.TicketFormComponent),
  },
  {
    path: 'tickets/:id/editar',
    title: 'Editar ticket',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tickets/ticket-form.component').then((m) => m.TicketFormComponent),
  },
  {
    path: 'tickets/:id',
    title: 'Detalle del ticket',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tickets/ticket-detail.component').then((m) => m.TicketDetailComponent),
  },
  {
    path: 'usuarios',
    title: 'Usuarios',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () =>
      import('./features/users/user-list.component').then((m) => m.UserListComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];

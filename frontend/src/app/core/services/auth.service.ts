import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginResponse, Role, UserRef } from '../models/models';

export const TOKEN_KEY = 'tickets_token';
const USER_KEY = 'tickets_user';

/**
 * Sesión del usuario. El token JWT se guarda en localStorage (simple para el
 * prototipo; en producción sería preferible una cookie httpOnly).
 * La autorización REAL ocurre en el backend: aquí solo se adapta la interfaz.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly user = signal<UserRef | null>(this.restoreUser());
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);
  /** ADMIN o SOPORTE: personal que gestiona tickets de todos. */
  readonly isStaff = computed(() => this.role() === 'ADMIN' || this.role() === 'SOPORTE');

  hasRole(...roles: Role[]): boolean {
    const r = this.role();
    return r !== null && roles.includes(r);
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap((res) => this.setSession(res.accessToken, res.user)));
  }

  setSession(token: string, user: UserRef): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.user.set(user);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  private restoreUser(): UserRef | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw && localStorage.getItem(TOKEN_KEY) ? (JSON.parse(raw) as UserRef) : null;
    } catch {
      return null;
    }
  }
}

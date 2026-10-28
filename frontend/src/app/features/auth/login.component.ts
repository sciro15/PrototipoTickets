import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { extractErrorMessage } from '../../shared/error-message';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="card login-card">
      <h1>Iniciar sesión</h1>
      <p class="muted">Acceda con su correo corporativo y contraseña.</p>

      @if (error()) {
        <div class="alert alert-error" role="alert">{{ error() }}</div>
      }

      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label>
          Correo electrónico
          <input type="email" formControlName="email" autocomplete="username" />
          @if (invalid('email')) {
            <span class="field-error" role="alert">Ingrese un correo válido.</span>
          }
        </label>
        <label>
          Contraseña
          <input type="password" formControlName="password" autocomplete="current-password" />
          @if (invalid('password')) {
            <span class="field-error" role="alert">La contraseña es obligatoria.</span>
          }
        </label>
        <button type="submit" class="btn btn-primary" [disabled]="loading()">
          {{ loading() ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>

      <p class="muted small">
        Cuentas de demostración y contraseña: consulte el README (sección «Credenciales de demostración»).
      </p>
    </section>
  `,
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) this.router.navigate(['/dashboard']);
  }

  invalid(name: 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email.trim(), password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (e) => {
        this.error.set(extractErrorMessage(e));
        this.loading.set(false);
      },
    });
  }
}

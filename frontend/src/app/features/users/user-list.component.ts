import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ROLES, Role, User } from '../../core/models/models';
import { UsersService } from '../../core/services/users.service';
import { extractErrorMessage } from '../../shared/error-message';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <h1>Usuarios</h1>
    <div class="alert alert-info" role="note">
      Vista exclusiva del rol <strong>ADMIN</strong>. Las contraseñas se almacenan cifradas (bcrypt).
    </div>

    @if (message()) { <div class="alert alert-ok" role="status">{{ message() }}</div> }
    @if (error()) { <div class="alert alert-error" role="alert">{{ error() }}</div> }

    <section class="card">
      <h2>Crear usuario</h2>
      <form class="inline-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label>
          Nombre *
          <input type="text" formControlName="name" maxlength="100" />
          @if (invalid('name')) { <span class="field-error" role="alert">El nombre es obligatorio.</span> }
        </label>
        <label>
          Correo electrónico *
          <input type="email" formControlName="email" maxlength="150" />
          @if (invalid('email')) {
            <span class="field-error" role="alert">
              @if (form.controls.email.errors?.['required']) { El correo es obligatorio. } @else { Correo no válido. }
            </span>
          }
        </label>
        <label>
          Contraseña * (mínimo 8 caracteres)
          <input type="password" formControlName="password" maxlength="72" autocomplete="new-password" />
          @if (invalid('password')) {
            <span class="field-error" role="alert">La contraseña debe tener entre 8 y 72 caracteres.</span>
          }
        </label>
        <label>
          Rol
          <select formControlName="role">
            @for (r of roles; track r) { <option [value]="r">{{ r }}</option> }
          </select>
        </label>
        <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Guardando…' : 'Crear' }}</button>
      </form>
    </section>

    <section class="card">
      <h2>Usuarios registrados</h2>
      @if (loading()) {
        <p class="state" role="status">Cargando usuarios…</p>
      } @else if (users().length === 0) {
        <p class="empty">No hay usuarios registrados.</p>
      } @else {
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Creado</th></tr></thead>
            <tbody>
              @for (u of users(); track u.id) {
                <tr>
                  <td>{{ u.id }}</td><td>{{ u.name }}</td><td>{{ u.email }}</td>
                  <td><span class="badge role">{{ u.role }}</span></td>
                  <td>{{ u.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class UserListComponent implements OnInit {
  private readonly api = inject(UsersService);
  private readonly fb = inject(FormBuilder);

  readonly roles = ROLES;
  readonly users = signal<User[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    role: this.fb.nonNullable.control<Role>('SOLICITANTE'),
  });

  ngOnInit(): void {
    this.load();
  }

  invalid(name: 'name' | 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (u) => {
        this.users.set(u);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(extractErrorMessage(e));
        this.loading.set(false);
      },
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    const v = this.form.getRawValue();
    this.api
      .create({ name: v.name.trim(), email: v.email.trim(), password: v.password, role: v.role })
      .subscribe({
      next: (u) => {
        this.saving.set(false);
        this.message.set(`Usuario "${u.name}" creado correctamente.`);
        this.form.reset({ name: '', email: '', password: '', role: 'SOLICITANTE' });
        this.load();
      },
      error: (e) => {
        this.error.set(extractErrorMessage(e));
        this.saving.set(false);
      },
    });
  }
}

import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PRIORITIES, PRIORITY_LABELS, Priority, User } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { TicketsService } from '../../core/services/tickets.service';
import { UsersService } from '../../core/services/users.service';
import { extractErrorMessage } from '../../shared/error-message';

@Component({
  selector: 'app-ticket-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <h1>{{ isEdit() ? 'Editar ticket #' + id() : 'Nuevo ticket' }}</h1>

    @if (loading()) {
      <p class="state" role="status">Cargando…</p>
    }
    @if (error()) {
      <div class="alert alert-error" role="alert">{{ error() }}</div>
    }

    <form class="card form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <label>
        Título *
        <input type="text" formControlName="title" maxlength="150" aria-describedby="err-title" />
        @if (invalid('title')) {
          <span class="field-error" id="err-title" role="alert">
            @if (form.controls.title.errors?.['required']) { El título es obligatorio. }
            @if (form.controls.title.errors?.['maxlength']) { Máximo 150 caracteres. }
          </span>
        }
      </label>

      <label>
        Descripción *
        <textarea rows="5" formControlName="description" maxlength="2000" aria-describedby="err-description"></textarea>
        @if (invalid('description')) {
          <span class="field-error" id="err-description" role="alert">
            @if (form.controls.description.errors?.['required']) { La descripción es obligatoria. }
            @if (form.controls.description.errors?.['maxlength']) { Máximo 2000 caracteres. }
          </span>
        }
      </label>

      <div class="grid-2">
        <label>
          Categoría *
          <input type="text" formControlName="category" maxlength="60" list="categorias" aria-describedby="err-category" />
          <datalist id="categorias">
            <option value="Hardware"></option><option value="Software"></option>
            <option value="Accesos"></option><option value="Infraestructura"></option><option value="Otro"></option>
          </datalist>
          @if (invalid('category')) {
            <span class="field-error" id="err-category" role="alert">La categoría es obligatoria.</span>
          }
        </label>

        <label>
          Prioridad
          <select formControlName="priority">
            @for (p of priorities; track p) { <option [value]="p">{{ priorityLabels[p] }}</option> }
          </select>
        </label>
      </div>

      <!-- Solo personal de soporte/administración elige solicitante y responsable -->
      @if (staff) {
        <div class="grid-2">
          <label>
            Solicitante *
            <select formControlName="requesterId">
              <option [ngValue]="null" disabled>Seleccione…</option>
              @for (u of users(); track u.id) { <option [ngValue]="u.id">{{ u.name }} ({{ u.role }})</option> }
            </select>
            @if (invalid('requesterId')) {
              <span class="field-error" role="alert">Seleccione un solicitante.</span>
            }
          </label>

          <label>
            Responsable (opcional)
            <select formControlName="assigneeId">
              <option [ngValue]="null">Sin asignar</option>
              @for (u of assignees(); track u.id) { <option [ngValue]="u.id">{{ u.name }} ({{ u.role }})</option> }
            </select>
            @if (canAssignToMe()) {
              <button type="button" class="btn-link" style="text-align: left; margin-top: 0.25rem; font-size: 0.85rem;" (click)="assignToMe()">
                Asignarme a mí
              </button>
            }
          </label>
        </div>
      } @else {
        <p class="muted small">El ticket se registrará a su nombre y quedará en estado «Abierto».</p>
      }

      <div class="actions">
        <button type="submit" class="btn btn-primary" [disabled]="saving()">
          {{ saving() ? 'Guardando…' : 'Guardar' }}
        </button>
        <a class="btn" [routerLink]="isEdit() ? ['/tickets', id()] : ['/tickets']">Cancelar</a>
      </div>
    </form>
  `,
})
export class TicketFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tickets = inject(TicketsService);
  private readonly usersApi = inject(UsersService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  /** Parámetro de ruta `:id` (withComponentInputBinding). Ausente al crear. */
  readonly id = input<string | undefined>(undefined);

  readonly staff = this.auth.isStaff();
  readonly priorities = PRIORITIES;
  readonly priorityLabels = PRIORITY_LABELS;
  readonly users = signal<User[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
    category: ['', [Validators.required, Validators.maxLength(60)]],
    priority: this.fb.nonNullable.control<Priority>('MEDIA'),
    requesterId: this.fb.control<number | null>(null, Validators.required),
    assigneeId: this.fb.control<number | null>(null),
  });

  isEdit = () => this.id() !== undefined;

  assignees = () => {
    const list = this.users().filter((u) => u.role !== 'SOLICITANTE');
    if (this.auth.hasRole('ADMIN')) return list;
    const me = this.auth.user();
    return list.filter((u) => u.id === me?.id);
  };

  canAssignToMe = () => {
    const me = this.auth.user();
    return me && this.form.controls.assigneeId.value !== me.id;
  };

  assignToMe(): void {
    const me = this.auth.user();
    if (me) {
      this.form.controls.assigneeId.setValue(me.id);
    }
  };

  ngOnInit(): void {
    this.loading.set(true);

    if (!this.staff) {
      // El solicitante no elige solicitante/responsable ni consulta usuarios
      this.form.controls.requesterId.clearValidators();
      this.form.controls.requesterId.updateValueAndValidity();
      this.loadTicketIfEditing();
      return;
    }

    this.usersApi.list().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loadTicketIfEditing();
      },
      error: (e) => {
        this.error.set(extractErrorMessage(e));
        this.loading.set(false);
      },
    });
  }

  private loadTicketIfEditing(): void {
    const id = this.id();
    if (id === undefined) {
      this.loading.set(false);
      return;
    }
    // El solicitante original no se puede cambiar una vez creado el ticket
    this.form.controls.requesterId.disable();
    this.tickets.get(Number(id)).subscribe({
      next: (t) => {
        if (t.status === 'CERRADO') {
          this.form.disable();
          this.error.set('Este ticket se encuentra CERRADO. Es un estado final inmutable y no puede ser editado.');
          this.loading.set(false);
          return;
        }
        if (!this.staff && t.status !== 'ABIERTO') {
          this.form.disable();
          this.error.set(`Un solicitante únicamente puede editar tickets en estado ABIERTO. El ticket actual se encuentra en estado ${t.status}.`);
          this.loading.set(false);
          return;
        }
        this.form.patchValue({
          title: t.title,
          description: t.description,
          category: t.category,
          priority: t.priority,
          requesterId: t.requesterId,
          assigneeId: t.assigneeId,
        });
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(extractErrorMessage(e));
        this.loading.set(false);
      },
    });
  }

  invalid(name: 'title' | 'description' | 'category' | 'requesterId'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    const base = {
      title: (v.title ?? '').trim(),
      description: (v.description ?? '').trim(),
      category: (v.category ?? '').trim(),
      priority: v.priority,
    };
    // El backend rechaza (403) que un solicitante envíe assigneeId: solo staff lo incluye
    const payload = this.staff ? { ...base, assigneeId: v.assigneeId } : base;

    this.saving.set(true);
    this.error.set(null);
    const id = this.id();
    const request$ =
      id !== undefined
        ? this.tickets.update(Number(id), payload)
        : this.tickets.create(this.staff ? { ...payload, requesterId: v.requesterId as number } : payload);

    request$.subscribe({
      next: (t) => {
        this.saving.set(false);
        this.router.navigate(['/tickets', t.id], { state: { message: 'Ticket guardado correctamente.' } });
      },
      error: (e) => {
        this.error.set(extractErrorMessage(e));
        this.saving.set(false);
      },
    });
  }
}

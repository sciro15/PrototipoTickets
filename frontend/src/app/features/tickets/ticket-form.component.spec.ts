import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TicketFormComponent } from './ticket-form.component';

describe('TicketFormComponent', () => {
  let http: HttpTestingController;

  function setup(isStaff = true) {
    const authMock = {
      isStaff: () => isStaff,
      hasRole: (role: string) => (isStaff ? role === 'ADMIN' : role === 'SOLICITANTE'),
      user: () => ({ id: isStaff ? 1 : 4, name: 'Test', email: 'test@x.test', role: isStaff ? 'ADMIN' : 'SOLICITANTE' }),
    };

    TestBed.configureTestingModule({
      imports: [TicketFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
      ],
    });
    const fixture = TestBed.createComponent(TicketFormComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    if (isStaff) {
      http.expectOne((r) => r.url.endsWith('/users')).flush([
        { id: 1, name: 'Luis', email: 'l@x.test', role: 'SOLICITANTE', createdAt: '', updatedAt: '' },
      ]);
      fixture.detectChanges();
    }
    return fixture;
  }

  afterEach(() => http.verify());

  it('para staff es inválido cuando faltan campos obligatorios (incluyendo requesterId)', () => {
    const { componentInstance: c } = setup(true);
    expect(c.form.valid).toBeFalse();
    expect(c.form.controls.title.errors?.['required']).toBeTrue();
    expect(c.form.controls.description.errors?.['required']).toBeTrue();
    expect(c.form.controls.category.errors?.['required']).toBeTrue();
    expect(c.form.controls.requesterId.errors?.['required']).toBeTrue();
  });

  it('muestra errores de validación y no llama a la API al enviar vacío', () => {
    const fixture = setup(true);
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('El título es obligatorio');
    http.expectNone((r) => r.url.endsWith('/tickets'));
  });

  it('para solicitante no requiere requesterId y envía POST sin assigneeId', () => {
    const fixture = setup(false);
    fixture.componentInstance.form.patchValue({
      title: 'Falla impresora',
      description: 'No imprime en red',
      category: 'Hardware',
    });
    expect(fixture.componentInstance.form.valid).toBeTrue();
    fixture.componentInstance.submit();
    const req = http.expectOne((r) => r.url.endsWith('/tickets') && r.method === 'POST');
    expect(req.request.body.title).toBe('Falla impresora');
    expect(req.request.body.requesterId).toBeUndefined();
    req.flush({ id: 1, title: 'Falla impresora' });
  });

  it('envía POST con datos válidos como staff y muestra el error del backend', () => {
    const fixture = setup(true);
    fixture.componentInstance.form.patchValue({
      title: ' Falla ',
      description: 'No enciende',
      category: 'Hardware',
      requesterId: 1,
    });
    fixture.componentInstance.submit();
    const req = http.expectOne((r) => r.url.endsWith('/tickets') && r.method === 'POST');
    expect(req.request.body.title).toBe('Falla');
    expect(req.request.body.requesterId).toBe(1);
    req.flush({ message: ['El título es obligatorio'] }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toContain('El título es obligatorio');
    expect(fixture.componentInstance.saving()).toBeFalse();
  });
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TicketListComponent } from './ticket-list.component';

describe('TicketListComponent', () => {
  let http: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      imports: [TicketListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TicketListComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('muestra estado de carga y luego pantalla vacía', () => {
    const fixture = setup();
    expect(fixture.nativeElement.textContent).toContain('Cargando tickets');
    http.expectOne((r) => r.url.endsWith('/tickets')).flush({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 1 },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No se encontraron tickets');
  });

  it('muestra un mensaje de error cuando la API no responde', () => {
    const fixture = setup();
    http.expectOne((r) => r.url.endsWith('/tickets')).error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No se pudo conectar');
  });
});

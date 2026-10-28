import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TicketsService } from './tickets.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TicketsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía solo los filtros con valor como query params', () => {
    service.list({ status: 'ABIERTO', priority: '', search: 'impresora', page: 2 }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/tickets'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('ABIERTO');
    expect(req.request.params.get('search')).toBe('impresora');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.has('priority')).toBeFalse();
    req.flush({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 1 } });
  });

  it('cambia el estado con PATCH /tickets/:id/status (sin changedById, inferido por JWT en backend)', () => {
    service.changeStatus(5, 'EN_PROGRESO').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/tickets/5/status'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'EN_PROGRESO' });
    req.flush({});
  });
});

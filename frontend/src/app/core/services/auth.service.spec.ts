import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService, TOKEN_KEY } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('inicia sesión, almacena token y usuario en localStorage y actualiza signals', () => {
    service.login('ana.admin@solucionesandinas.test', 'Demo1234!').subscribe((res) => {
      expect(res.accessToken).toBe('jwt.mock.token');
      expect(res.user.role).toBe('ADMIN');
    });

    const req = http.expectOne((r) => r.url.endsWith('/auth/login') && r.method === 'POST');
    req.flush({
      accessToken: 'jwt.mock.token',
      user: { id: 1, name: 'Ana Admin', email: 'ana.admin@solucionesandinas.test', role: 'ADMIN' },
    });

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.role()).toBe('ADMIN');
    expect(service.isStaff()).toBeTrue();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt.mock.token');
  });

  it('cierra sesión y limpia datos', () => {
    service.setSession('token', { id: 1, name: 'Ana', email: 'a@x.test', role: 'ADMIN' });
    expect(service.isLoggedIn()).toBeTrue();

    service.logout();
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.user()).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

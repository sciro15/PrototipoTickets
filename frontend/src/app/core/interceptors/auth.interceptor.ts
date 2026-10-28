import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService, TOKEN_KEY } from '../services/auth.service';

/** Adjunta el JWT a las llamadas a la API y cierra la sesión ante un 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const token = localStorage.getItem(TOKEN_KEY);
  const isApi = req.url.startsWith(environment.apiUrl);

  const authReq = token && isApi ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.endsWith('/auth/login')) {
        injector.get(AuthService).logout();
      }
      return throwError(() => err);
    }),
  );
};

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateTicketPayload,
  Paginated,
  Status,
  Ticket,
  TicketFilters,
  TicketHistory,
  TicketPayload,
} from '../models/models';

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/tickets`;

  list(filters: TicketFilters = {}): Observable<Paginated<Ticket>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<Paginated<Ticket>>(this.url, { params });
  }

  get(id: number): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.url}/${id}`);
  }

  create(payload: CreateTicketPayload): Observable<Ticket> {
    return this.http.post<Ticket>(this.url, payload);
  }

  update(id: number, payload: Partial<TicketPayload>): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.url}/${id}`, payload);
  }

  changeStatus(id: number, status: Status): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.url}/${id}/status`, { status });
  }

  assign(id: number, assigneeId: number | null): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.url}/${id}/assign`, { assigneeId });
  }

  history(id: number): Observable<TicketHistory[]> {
    return this.http.get<TicketHistory[]>(`${this.url}/${id}/history`);
  }
}

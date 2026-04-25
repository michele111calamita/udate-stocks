import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, TemplateInfo, SyncResult } from '../models/types';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  uploadTemplate(file: File): Observable<TemplateInfo> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<TemplateInfo>('/api/shopify-template', form);
  }

  getTemplate(): Observable<TemplateInfo> {
    return this.http.get<TemplateInfo>('/api/shopify-template');
  }

  sync(file: File): Observable<SyncResult> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<SyncResult>('/api/sync', form);
  }

  createUser(email: string, password: string, is_admin: boolean): Observable<User> {
    return this.http.post<User>('/admin/users', { email, password, is_admin });
  }

  listUsers(): Observable<User[]> {
    return this.http.get<User[]>('/admin/users');
  }
}

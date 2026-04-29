import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, TemplateInfo, SyncResult, MappingConfig, AddProductsResponse, MaestroRow } from '../models/types';

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

  getMapping(): Observable<MappingConfig> {
    return this.http.get<MappingConfig>('/api/mapping');
  }

  saveMapping(mappings: Record<string, string>): Observable<void> {
    return this.http.put<void>('/api/mapping', { mappings });
  }

  addProducts(fileb64: string, format: string, selectedRows: MaestroRow[]): Observable<AddProductsResponse> {
    return this.http.post<AddProductsResponse>('/api/sync/add-products', {
      file_b64: fileb64,
      format,
      selected_rows: selectedRows,
    });
  }

  createUser(email: string, password: string, is_admin: boolean): Observable<User> {
    return this.http.post<User>('/admin/users', { email, password, is_admin });
  }

  listUsers(): Observable<User[]> {
    return this.http.get<User[]>('/admin/users');
  }
}

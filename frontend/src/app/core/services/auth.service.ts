import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Token } from '../models/types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'stock_sync_token';
  private token = signal<string | null>(localStorage.getItem(this.TOKEN_KEY));

  isLoggedIn = computed(() => !!this.token());
  isAdmin = computed(() => {
    const t = this.token();
    if (!t) return false;
    try {
      return JSON.parse(atob(t.split('.')[1]))?.is_admin ?? false;
    } catch {
      return false;
    }
  });

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string) {
    return this.http.post<Token>('/auth/login', { email, password }).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.access_token);
        this.token.set(res.access_token);
      }),
    );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    this.token.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.token();
  }
}

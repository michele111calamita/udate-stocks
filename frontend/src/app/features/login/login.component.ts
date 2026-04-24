import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-wrap">
      <h1>Stock Sync</h1>
      <form (ngSubmit)="submit()">
        <input
          type="email"
          [(ngModel)]="email"
          name="email"
          placeholder="Email"
          required
          autocomplete="email"
        />
        <input
          type="password"
          [(ngModel)]="password"
          name="password"
          placeholder="Password"
          required
          autocomplete="current-password"
        />
        <button type="submit" [disabled]="loading()">
          {{ loading() ? 'Accesso in corso...' : 'Accedi' }}
        </button>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
      </form>
    </div>
  `,
  styles: [`
    .login-wrap { max-width: 360px; margin: 80px auto; padding: 32px; }
    form { display: flex; flex-direction: column; gap: 12px; }
    input { padding: 10px; font-size: 1rem; border: 1px solid #ccc; border-radius: 4px; }
    button { padding: 10px; font-size: 1rem; cursor: pointer; }
    .error { color: red; margin: 0; }
  `],
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => {
        this.error.set('Credenziali non valide');
        this.loading.set(false);
      },
    });
  }
}

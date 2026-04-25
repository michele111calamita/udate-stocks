import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { User } from '../../core/models/types';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  template: `
    <div class="layout">
      <header class="header">
        <a routerLink="/dashboard" class="back-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Dashboard
        </a>
        <span class="header-title">Gestione Utenti</span>
        <div class="header-spacer"></div>
      </header>

      <main class="main">
        <div class="card">
          <div class="card-header">
            <h2>Nuovo utente</h2>
          </div>

          <form (ngSubmit)="createUser()">
            <div class="field">
              <label>Email</label>
              <input type="email" [(ngModel)]="newEmail" name="email" placeholder="nome@azienda.it" required />
            </div>
            <div class="field">
              <label>Password</label>
              <input type="password" [(ngModel)]="newPassword" name="password" placeholder="••••••••" required />
            </div>
            <label class="checkbox-label">
              <div class="checkbox-wrap">
                <input type="checkbox" [(ngModel)]="newIsAdmin" name="isAdmin" />
                <span class="checkbox-ui"></span>
              </div>
              <span>Permessi admin</span>
            </label>

            @if (createError()) {
              <div class="error-box">{{ createError() }}</div>
            }

            <button type="submit" class="btn-primary" [disabled]="creating()">
              @if (creating()) {
                <span class="spinner"></span>
                Creazione...
              } @else {
                Crea utente
              }
            </button>
          </form>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Utenti ({{ users().length }})</h2>
          </div>

          @if (users().length === 0) {
            <div class="empty-state">Nessun utente</div>
          } @else {
            <div class="user-list">
              @for (user of users(); track user.id) {
                <div class="user-row">
                  <div class="user-info">
                    <span class="user-email">{{ user.email }}</span>
                    <span class="user-date">{{ user.created_at | date:'dd/MM/yyyy' }}</span>
                  </div>
                  @if (user.is_admin) {
                    <span class="badge-admin">Admin</span>
                  }
                </div>
              }
            </div>
          }
        </div>
      </main>
    </div>
  `,
  styles: [`
    .layout { min-height: 100vh; }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 20px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-muted);
      padding: 6px 10px;
      border-radius: var(--radius-sm);
      transition: background 0.15s, color 0.15s;
      min-width: 90px;
    }
    .back-btn:hover { background: var(--bg); color: var(--text); }

    .header-title {
      font-family: var(--font-display);
      font-size: 16px;
      font-weight: 700;
    }

    .header-spacer { min-width: 90px; }

    .main {
      max-width: 560px;
      margin: 0 auto;
      padding: 20px 16px 40px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .card {
      background: var(--surface);
      border-radius: var(--radius);
      padding: 24px;
      box-shadow: var(--shadow);
    }

    .card-header { margin-bottom: 20px; }

    h2 {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 700;
    }

    form { display: flex; flex-direction: column; gap: 14px; }

    .field { display: flex; flex-direction: column; gap: 6px; }

    label:not(.checkbox-label) {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    input[type=email], input[type=password] {
      padding: 11px 14px;
      font-size: 15px;
      font-family: var(--font-body);
      border: 1.5px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text);
      transition: border-color 0.15s;
      outline: none;
      width: 100%;
    }
    input:focus { border-color: var(--accent); }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: var(--text);
    }

    .checkbox-wrap { position: relative; width: 18px; height: 18px; flex-shrink: 0; }
    .checkbox-wrap input[type=checkbox] {
      opacity: 0;
      position: absolute;
      width: 100%;
      height: 100%;
      cursor: pointer;
      margin: 0;
      padding: 0;
      border: none;
    }

    .checkbox-ui {
      display: block;
      width: 18px;
      height: 18px;
      border: 1.5px solid var(--border);
      border-radius: 4px;
      background: var(--bg);
      transition: background 0.15s, border-color 0.15s;
      pointer-events: none;
    }

    .checkbox-wrap input[type=checkbox]:checked ~ .checkbox-ui {
      background: var(--accent);
      border-color: var(--accent);
    }

    .error-box {
      background: var(--danger-bg);
      color: var(--danger);
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      font-size: 14px;
    }

    .btn-primary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 13px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 15px;
      font-weight: 600;
      font-family: var(--font-body);
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-primary:hover:not(:disabled) { background: var(--accent-dark); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-state {
      padding: 20px;
      text-align: center;
      font-size: 14px;
      color: var(--text-muted);
    }

    .user-list { display: flex; flex-direction: column; }

    .user-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      gap: 12px;
    }
    .user-row + .user-row { border-top: 1px solid var(--border); }

    .user-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

    .user-email {
      font-size: 14px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .user-date { font-size: 12px; color: var(--text-muted); }

    .badge-admin {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 100px;
      background: rgba(201,74,42,0.1);
      color: var(--accent);
      flex-shrink: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  `],
})
export class AdminComponent implements OnInit {
  users = signal<User[]>([]);
  newEmail = '';
  newPassword = '';
  newIsAdmin = false;
  creating = signal(false);
  createError = signal('');

  constructor(private api: ApiService) {}

  ngOnInit() { this.load(); }

  load() { this.api.listUsers().subscribe(u => this.users.set(u)); }

  createUser() {
    this.creating.set(true);
    this.createError.set('');
    this.api.createUser(this.newEmail, this.newPassword, this.newIsAdmin).subscribe({
      next: () => {
        this.newEmail = '';
        this.newPassword = '';
        this.newIsAdmin = false;
        this.creating.set(false);
        this.load();
      },
      error: err => {
        this.createError.set(err.error?.detail || 'Errore creazione utente');
        this.creating.set(false);
      },
    });
  }
}

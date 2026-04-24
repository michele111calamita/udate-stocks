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
    <header class="header">
      <h1>Gestione Utenti</h1>
      <a routerLink="/dashboard">Dashboard</a>
    </header>
    <main class="main">
      <section class="card">
        <h2>Nuovo utente</h2>
        <form (ngSubmit)="createUser()">
          <input type="email" [(ngModel)]="newEmail" name="email" placeholder="Email" required />
          <input type="password" [(ngModel)]="newPassword" name="password" placeholder="Password" required />
          <label>
            <input type="checkbox" [(ngModel)]="newIsAdmin" name="isAdmin" />
            Admin
          </label>
          <button type="submit" [disabled]="creating()">
            {{ creating() ? 'Creazione...' : 'Crea utente' }}
          </button>
          @if (createError()) { <p class="error">{{ createError() }}</p> }
        </form>
      </section>

      <section class="card">
        <h2>Utenti</h2>
        <table>
          <thead>
            <tr><th>Email</th><th>Admin</th><th>Creato</th></tr>
          </thead>
          <tbody>
            @for (user of users(); track user.id) {
              <tr>
                <td>{{ user.email }}</td>
                <td>{{ user.is_admin ? 'Si' : 'No' }}</td>
                <td>{{ user.created_at | date:'dd/MM/yyyy' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    </main>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; padding: 16px 32px; border-bottom: 1px solid #eee; }
    .main { max-width: 720px; margin: 32px auto; padding: 0 16px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
    form { display: flex; flex-direction: column; gap: 10px; max-width: 360px; }
    input[type=email], input[type=password] { padding: 8px; font-size: 1rem; border: 1px solid #ccc; border-radius: 4px; }
    button { padding: 8px 16px; cursor: pointer; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
    .error { color: red; margin: 0; }
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

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.listUsers().subscribe(u => this.users.set(u));
  }

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

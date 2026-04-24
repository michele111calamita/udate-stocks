import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ShopifyTemplateCardComponent } from './shopify-template-card.component';
import { DailySyncCardComponent } from './daily-sync-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, ShopifyTemplateCardComponent, DailySyncCardComponent],
  template: `
    <header class="header">
      <h1>Stock Sync</h1>
      <nav>
        @if (auth.isAdmin()) {
          <a routerLink="/admin">Gestione utenti</a>
        }
        <button (click)="auth.logout()">Esci</button>
      </nav>
    </header>
    <main class="main">
      <app-shopify-template-card />
      <app-daily-sync-card />
    </main>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; padding: 16px 32px; border-bottom: 1px solid #eee; }
    nav { display: flex; gap: 16px; align-items: center; }
    .main { max-width: 720px; margin: 32px auto; padding: 0 16px; }
    button { padding: 6px 14px; cursor: pointer; }
  `],
})
export class DashboardComponent {
  constructor(public auth: AuthService) {}
}

import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ShopifyTemplateCardComponent } from './shopify-template-card.component';
import { DailySyncCardComponent } from './daily-sync-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, ShopifyTemplateCardComponent, DailySyncCardComponent],
  template: `
    <div class="layout">
      <header class="header">
        <div class="header-brand">
          <div class="brand-mark"></div>
          <span class="brand-name">Stock Sync</span>
        </div>
        <div class="header-actions">
          @if (auth.isAdmin()) {
            <a routerLink="/admin" class="nav-link">Admin</a>
          }
          <button class="btn-ghost" (click)="auth.logout()">Esci</button>
        </div>
      </header>

      <div class="tabs">
        <button class="tab" [class.active]="activeTab() === 'sync'" (click)="activeTab.set('sync')">
          Sincronizza
        </button>
        <button class="tab" [class.active]="activeTab() === 'template'" (click)="activeTab.set('template')">
          Template
        </button>
      </div>

      <main class="main">
        @if (activeTab() === 'template') {
          <app-shopify-template-card />
        } @else {
          <app-daily-sync-card />
        }
      </main>
    </div>
  `,
  styles: [`
    .layout { min-height: 100vh; display: flex; flex-direction: column; }

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

    .header-brand { display: flex; align-items: center; gap: 10px; }

    .brand-mark {
      width: 26px;
      height: 26px;
      background: var(--accent);
      border-radius: 6px;
      flex-shrink: 0;
    }

    .brand-name {
      font-family: var(--font-display);
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.3px;
    }

    .header-actions { display: flex; align-items: center; gap: 4px; }

    .nav-link {
      padding: 6px 12px;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-muted);
      border-radius: var(--radius-sm);
      transition: background 0.15s, color 0.15s;
    }
    .nav-link:hover { background: var(--bg); color: var(--text); }

    .btn-ghost {
      padding: 6px 12px;
      background: none;
      border: 1.5px solid var(--border);
      border-radius: var(--radius-sm);
      font-size: 14px;
      font-weight: 500;
      color: var(--text-muted);
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .btn-ghost:hover { border-color: var(--text-muted); color: var(--text); }

    .tabs {
      display: flex;
      padding: 12px 20px 0;
      gap: 4px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }

    .tab {
      padding: 8px 16px 10px;
      background: none;
      border: none;
      border-bottom: 2.5px solid transparent;
      font-size: 14px;
      font-weight: 500;
      font-family: var(--font-body);
      color: var(--text-muted);
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
      margin-bottom: -1px;
    }

    .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

    .main {
      flex: 1;
      max-width: 560px;
      width: 100%;
      margin: 0 auto;
      padding: 20px 16px 40px;
    }
  `],
})
export class DashboardComponent {
  activeTab = signal<'sync' | 'template'>('sync');
  constructor(public auth: AuthService) {}
}

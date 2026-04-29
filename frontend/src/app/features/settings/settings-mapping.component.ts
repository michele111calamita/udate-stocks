import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { MappingConfig } from '../../core/models/types';

@Component({
  selector: 'app-settings-mapping',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <a routerLink="/dashboard" class="back-link">← Dashboard</a>
        <h1>Mapping colonne</h1>
        <p class="desc">Associa le colonne del file Maestro alle colonne del template Shopify.<br>Usato quando aggiungi nuovi prodotti all'export.</p>
      </div>

      @if (loading()) {
        <div class="state-msg">Caricamento...</div>
      } @else if (notReady()) {
        <div class="state-msg warn">Carica prima un template Shopify dalla dashboard.</div>
      } @else if (noMaestroYet()) {
        <div class="state-msg warn">Esegui almeno una sincronizzazione per rilevare le colonne Maestro.</div>
      } @else {
        <div class="mapping-card">
          <table class="mapping-table">
            <thead>
              <tr>
                <th>Colonna Shopify</th>
                <th>Colonna Maestro</th>
              </tr>
            </thead>
            <tbody>
              @for (sc of config()!.shopify_columns; track sc) {
                <tr>
                  <td class="shopify-col">{{ sc }}</td>
                  <td>
                    <select [(ngModel)]="localMappings[sc]" class="col-select">
                      <option value="">—</option>
                      @for (mc of config()!.maestro_columns; track mc) {
                        <option [value]="mc">{{ mc }}</option>
                      }
                    </select>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="actions">
            @if (saveError()) {
              <span class="error-msg">{{ saveError() }}</span>
            }
            @if (saveOk()) {
              <span class="ok-msg">Mapping salvato</span>
            }
            <button class="btn-save" (click)="save()" [disabled]="saving()">
              @if (saving()) { Salvataggio... } @else { Salva mapping }
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page {
      max-width: 640px;
      margin: 40px auto;
      padding: 0 16px;
      font-family: var(--font-body);
    }

    .page-header { margin-bottom: 28px; }

    .back-link {
      display: inline-block;
      font-size: 13px;
      color: var(--text-muted);
      text-decoration: none;
      margin-bottom: 12px;
    }
    .back-link:hover { color: var(--text); }

    h1 {
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .desc { font-size: 13px; color: var(--text-muted); line-height: 1.5; }

    .state-msg {
      font-size: 14px;
      color: var(--text-muted);
      padding: 20px 0;
    }
    .state-msg.warn { color: var(--danger); }

    .mapping-card {
      background: var(--surface);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .mapping-table { width: 100%; border-collapse: collapse; }

    th {
      background: var(--bg);
      padding: 10px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }

    td { padding: 8px 16px; border-bottom: 1px solid var(--border); }
    tr:last-child td { border-bottom: none; }

    .shopify-col {
      font-family: var(--font-mono);
      font-size: 13px;
      width: 50%;
    }

    .col-select {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-family: var(--font-body);
      background: var(--bg);
      color: var(--text);
      cursor: pointer;
    }
    .col-select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }

    .actions {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-top: 1px solid var(--border);
      justify-content: flex-end;
    }

    .btn-save {
      padding: 9px 20px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 14px;
      font-weight: 600;
      font-family: var(--font-body);
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-save:hover:not(:disabled) { background: var(--accent-dark); }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

    .error-msg { font-size: 13px; color: var(--danger); }
    .ok-msg { font-size: 13px; color: var(--success); }
  `],
})
export class SettingsMappingComponent implements OnInit {
  config = signal<MappingConfig | null>(null);
  loading = signal(true);
  notReady = signal(false);
  noMaestroYet = signal(false);
  saving = signal(false);
  saveError = signal('');
  saveOk = signal(false);
  localMappings: Record<string, string> = {};

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getMapping().subscribe({
      next: cfg => {
        this.config.set(cfg);
        this.localMappings = { ...cfg.mappings };
        this.noMaestroYet.set(cfg.maestro_columns.length === 0);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        if (err.status === 404) this.notReady.set(true);
      },
    });
  }

  save() {
    this.saving.set(true);
    this.saveError.set('');
    this.saveOk.set(false);
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.localMappings)) {
      if (v) clean[k] = v;
    }
    this.api.saveMapping(clean).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveOk.set(true);
        setTimeout(() => this.saveOk.set(false), 3000);
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Errore nel salvataggio');
      },
    });
  }
}

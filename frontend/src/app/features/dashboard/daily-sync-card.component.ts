import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { SyncResult } from '../../core/models/types';

@Component({
  selector: 'app-daily-sync-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-header">
        <h2>Sincronizzazione</h2>
        <p class="card-desc">Carica il file Maestro per aggiornare le giacenze Shopify</p>
      </div>

      <input type="file" accept=".csv,.xls,.xlsx" (change)="onFile($event)" #si hidden />

      <button class="btn-primary" (click)="si.click()" [disabled]="syncing()">
        @if (syncing()) {
          <span class="spinner"></span>
          Elaborazione...
        } @else {
          Carica file Maestro
        }
      </button>

      @if (error()) {
        <div class="error-box">{{ error() }}</div>
      }

      @if (result()) {
        <div class="result-section">
          <div class="result-summary">
            <div class="stat-chip success">
              <span class="stat-num">{{ result()!.matched.length }}</span>
              <span class="stat-label">aggiornati</span>
            </div>
            <div class="stat-chip" [class.danger]="result()!.unmatched.length > 0" [class.success]="result()!.unmatched.length === 0">
              <span class="stat-num">{{ result()!.unmatched.length }}</span>
              <span class="stat-label">non trovati</span>
            </div>
            <button class="btn-download" (click)="download()">Scarica</button>
          </div>

          <div class="result-tabs">
            <button class="result-tab" [class.active]="resultTab() === 'matched'" (click)="resultTab.set('matched')">
              Aggiornati ({{ result()!.matched.length }})
            </button>
            <button class="result-tab" [class.active]="resultTab() === 'unmatched'" (click)="resultTab.set('unmatched')">
              Non trovati ({{ result()!.unmatched.length }})
            </button>
          </div>

          @if (resultTab() === 'matched') {
            <div class="table-wrap">
              @if (result()!.matched.length === 0) {
                <div class="empty-tab">Nessuno SKU aggiornato</div>
              } @else {
                <table>
                  <thead>
                    <tr><th>SKU</th><th class="num">Prec.</th><th class="num">Nuova</th></tr>
                  </thead>
                  <tbody>
                    @for (row of result()!.matched; track row.sku) {
                      <tr [class.changed]="row.old_qty !== row.new_qty">
                        <td class="mono">{{ row.sku }}</td>
                        <td class="mono num muted">{{ row.old_qty }}</td>
                        <td class="mono num bold">{{ row.new_qty }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          } @else {
            <div class="table-wrap">
              @if (result()!.unmatched.length === 0) {
                <div class="empty-tab success-msg">Tutti gli SKU trovati in Maestro</div>
              } @else {
                <table>
                  <thead>
                    <tr><th>SKU non trovati in Maestro</th></tr>
                  </thead>
                  <tbody>
                    @for (sku of result()!.unmatched; track sku) {
                      <tr><td class="mono">{{ sku }}</td></tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
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
      margin-bottom: 4px;
    }

    .card-desc { font-size: 13px; color: var(--text-muted); }

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
      transition: background 0.15s, transform 0.1s;
    }

    .btn-primary:hover:not(:disabled) { background: var(--accent-dark); }
    .btn-primary:active:not(:disabled) { transform: scale(0.99); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .error-box {
      background: var(--danger-bg);
      color: var(--danger);
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      font-size: 14px;
      margin-top: 12px;
    }

    .result-section { margin-top: 20px; }

    .result-summary {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .stat-chip {
      display: flex;
      align-items: baseline;
      gap: 5px;
      padding: 6px 12px;
      border-radius: 100px;
      flex-shrink: 0;
    }

    .stat-chip.success { background: var(--success-bg); color: var(--success); }
    .stat-chip.danger { background: var(--danger-bg); color: var(--danger); }

    .stat-num { font-family: var(--font-mono); font-size: 16px; font-weight: 500; }
    .stat-label { font-size: 12px; }

    .btn-download {
      margin-left: auto;
      padding: 7px 16px;
      background: var(--text);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 600;
      font-family: var(--font-body);
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn-download:hover { opacity: 0.82; }

    .result-tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
    }

    .result-tab {
      padding: 8px 14px 10px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      font-size: 13px;
      font-weight: 500;
      font-family: var(--font-body);
      color: var(--text-muted);
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
      margin-bottom: -1px;
    }

    .result-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

    .table-wrap {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 var(--radius-sm) var(--radius-sm);
    }

    table { width: 100%; border-collapse: collapse; font-size: 13px; }

    thead { position: sticky; top: 0; }

    th {
      background: var(--bg);
      padding: 9px 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }

    td { padding: 8px 12px; border-bottom: 1px solid #F5F2EE; }
    tr:last-child td { border-bottom: none; }
    tr.changed td { background: #FFFBF2; }

    .mono { font-family: var(--font-mono); }
    .num { text-align: right; }
    .muted { color: var(--text-muted); }
    .bold { font-weight: 500; color: var(--text); }

    .empty-tab {
      padding: 24px;
      text-align: center;
      font-size: 14px;
      color: var(--text-muted);
    }

    .success-msg { color: var(--success); }
  `],
})
export class DailySyncCardComponent {
  syncing = signal(false);
  result = signal<SyncResult | null>(null);
  error = signal('');
  resultTab = signal<'matched' | 'unmatched'>('matched');

  constructor(private api: ApiService) {}

  onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.syncing.set(true);
    this.error.set('');
    this.result.set(null);

    this.api.sync(file).subscribe({
      next: res => {
        this.result.set(res);
        this.resultTab.set('matched');
        this.syncing.set(false);
      },
      error: err => {
        const detail = err.error?.detail;
        this.error.set(typeof detail === 'object' ? detail.message : (detail || 'Errore sync'));
        this.syncing.set(false);
      },
    });
  }

  download() {
    const res = this.result();
    if (!res) return;
    const bytes = Uint8Array.from(atob(res.file_b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { SyncResult, MatchedRow } from '../../core/models/types';

@Component({
  selector: 'app-daily-sync-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="card">
      <h2>Sync Giornaliero</h2>
      <p>Carica il file esportato da Maestro per aggiornare le giacenze.</p>
      <input type="file" accept=".csv,.xls,.xlsx" (change)="onFile($event)" #si hidden />
      <button (click)="si.click()" [disabled]="syncing()">
        {{ syncing() ? 'Elaborazione...' : 'Carica file Maestro' }}
      </button>

      @if (result()) {
        <div class="result-header">
          <span class="badge green">{{ result()!.matched.length }} aggiornati</span>
          <span class="badge red">{{ result()!.unmatched.length }} non trovati</span>
          <a class="download-btn" (click)="download()">Scarica file aggiornato</a>
        </div>

        <div class="tables-grid">
          <div class="table-wrap">
            <h3>Aggiornati ({{ result()!.matched.length }})</h3>
            <div class="scroll-box">
              <table>
                <thead>
                  <tr><th>SKU</th><th>Qta precedente</th><th>Nuova qta</th></tr>
                </thead>
                <tbody>
                  @for (row of result()!.matched; track row.sku) {
                    <tr [class.changed]="row.old_qty !== row.new_qty">
                      <td>{{ row.sku }}</td>
                      <td class="qty">{{ row.old_qty }}</td>
                      <td class="qty new">{{ row.new_qty }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div class="table-wrap">
            <h3>Non trovati in Maestro ({{ result()!.unmatched.length }})</h3>
            <div class="scroll-box">
              <table>
                <thead>
                  <tr><th>SKU</th></tr>
                </thead>
                <tbody>
                  @for (sku of result()!.unmatched; track sku) {
                    <tr><td>{{ sku }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

      @if (error()) { <p class="error">{{ error() }}</p> }
    </section>
  `,
  styles: [`
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 24px; }
    button { padding: 8px 16px; cursor: pointer; }

    .result-header { display: flex; align-items: center; gap: 12px; margin: 16px 0 12px; flex-wrap: wrap; }
    .badge { padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; }
    .badge.green { background: #d4edda; color: #155724; }
    .badge.red { background: #f8d7da; color: #721c24; }
    .download-btn { padding: 6px 14px; background: #0070f3; color: white; border-radius: 4px; text-decoration: none; cursor: pointer; font-size: 13px; }

    .tables-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 700px) { .tables-grid { grid-template-columns: 1fr; } }

    .table-wrap h3 { margin: 0 0 8px; font-size: 14px; color: #555; }
    .scroll-box { max-height: 320px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 6px; }

    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f5f5f5; padding: 8px 10px; text-align: left; position: sticky; top: 0; border-bottom: 1px solid #ddd; }
    td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
    tr:last-child td { border-bottom: none; }
    tr.changed td { background: #fffbe6; }

    .qty { text-align: right; font-variant-numeric: tabular-nums; }
    .new { font-weight: 600; color: #0070f3; }

    .error { color: red; margin-top: 12px; }
  `],
})
export class DailySyncCardComponent {
  syncing = signal(false);
  result = signal<SyncResult | null>(null);
  error = signal('');

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

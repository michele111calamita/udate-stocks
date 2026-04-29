import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { SyncResult, MaestroRow, MappingConfig } from '../../core/models/types';

@Component({
  selector: 'app-daily-sync-card',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
            <button class="btn-download" (click)="download()" [disabled]="downloading()">
              @if (downloading()) { ... }
              @else if (selectedIndices().size > 0) { Scarica ({{ selectedIndices().size }} aggiunte) }
              @else { Scarica }
            </button>
          </div>

          @if (downloadError()) {
            <div class="error-box">{{ downloadError() }}</div>
          }

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

          <div class="preview-toggle">
            <button class="btn-preview" (click)="togglePreview()">
              {{ showPreview() ? 'Nascondi anteprima' : 'Anteprima template Shopify' }}
            </button>
          </div>

          @if (showPreview() && shopifyPreviewColumns().length) {
            <div class="preview-section">
              <h3 class="preview-title">Anteprima template Shopify (prime 5 righe)</h3>
              <div class="preview-scroll">
                <table class="preview-table">
                  <thead>
                    <tr>
                      @for (col of shopifyPreviewColumns(); track col) {
                        <th>{{ col }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of shopifyPreviewRows(); track $index) {
                      <tr>
                        @for (col of shopifyPreviewColumns(); track col) {
                          <td>{{ row[col] }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <div class="preview-toggle">
            <button class="btn-preview" (click)="showMaestroPreview.set(!showMaestroPreview())">
              {{ showMaestroPreview() ? 'Nascondi anteprima Maestro' : 'Anteprima file Maestro' }}
            </button>
          </div>

          @if (showMaestroPreview() && maestroColumns().length) {
            <div class="preview-section">
              <h3 class="preview-title">Anteprima file Maestro (prime 5 righe)</h3>
              <div class="preview-scroll">
                <table class="preview-table">
                  <thead>
                    <tr>
                      @for (col of maestroColumns(); track col) {
                        <th>{{ col }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of maestroPreviewRows(); track $index) {
                      <tr>
                        @for (col of maestroColumns(); track col) {
                          <td>{{ row[col] }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>

        <!-- Maestro product selection section -->
        <div class="maestro-section">
          <div class="maestro-header">
            <div class="maestro-title-row">
              <h3>Aggiungi prodotti da Maestro</h3>
              <a routerLink="/settings" class="mapping-link">Configura mapping colonne</a>
            </div>
            <div class="maestro-controls">
              <input
                class="sku-filter"
                type="text"
                placeholder="Filtra SKU: SKU001;SKU002;SKU003"
                [ngModel]="maestroFilter()"
                (ngModelChange)="maestroFilter.set($event)"
              />
              <button class="btn-select-all" (click)="selectAll()">
                Seleziona tutto ({{ filteredRows().length }})
              </button>
              @if (selectedIndices().size > 0) {
                <button class="btn-clear" (click)="clearSelection()">Deseleziona tutto</button>
              }
            </div>
          </div>

          <div class="table-wrap maestro-table-wrap">
            @if (result()!.maestro_rows.length === 0) {
              <div class="empty-tab">Nessuna riga nel file Maestro</div>
            } @else if (filteredRows().length === 0) {
              <div class="empty-tab">Nessuna riga corrisponde al filtro</div>
            } @else {
              <table>
                <thead>
                  <tr>
                    <th class="cb-col"></th>
                    @for (col of maestroColumns(); track col) {
                      <th>{{ col }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (entry of filteredRows(); track entry.idx) {
                    <tr [class.selected-row]="selectedIndices().has(entry.idx)" (click)="toggleRow(entry.idx)">
                      <td class="cb-col">
                        <input type="checkbox" [checked]="selectedIndices().has(entry.idx)" (click)="$event.stopPropagation()" (change)="toggleRow(entry.idx)" />
                      </td>
                      @for (col of maestroColumns(); track col) {
                        <td class="mono">{{ entry.row[col] }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
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
    .btn-download:hover:not(:disabled) { opacity: 0.82; }
    .btn-download:disabled { opacity: 0.5; cursor: not-allowed; }

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

    thead { position: sticky; top: 0; z-index: 1; }

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

    /* Maestro section */
    .maestro-section {
      margin-top: 28px;
      border-top: 1px solid var(--border);
      padding-top: 20px;
    }

    .maestro-header { margin-bottom: 12px; }

    .maestro-title-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    h3 {
      font-family: var(--font-display);
      font-size: 15px;
      font-weight: 700;
    }

    .mapping-link {
      font-size: 12px;
      color: var(--accent);
      text-decoration: none;
    }
    .mapping-link:hover { text-decoration: underline; }

    .maestro-controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }

    .sku-filter {
      flex: 1;
      min-width: 200px;
      padding: 7px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-family: var(--font-mono);
      background: var(--bg);
      color: var(--text);
    }
    .sku-filter:focus { outline: 2px solid var(--accent); outline-offset: 1px; }

    .btn-select-all, .btn-clear {
      padding: 7px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 600;
      font-family: var(--font-body);
      cursor: pointer;
      background: var(--surface);
      color: var(--text);
      white-space: nowrap;
      transition: background 0.12s;
    }
    .btn-select-all:hover { background: var(--bg); }
    .btn-clear { color: var(--danger); border-color: var(--danger); }
    .btn-clear:hover { background: var(--danger-bg); }

    .maestro-table-wrap {
      max-height: 400px;
      border-top: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }

    .cb-col { width: 36px; text-align: center; padding: 8px 4px; }

    tr.selected-row td { background: #F0F4FF; }
    tr { cursor: pointer; }
    tr:hover td { background: var(--bg); }
    tr.selected-row:hover td { background: #E8EEFF; }

    .preview-toggle {
      margin-top: 16px;
      display: flex;
      justify-content: flex-start;
    }

    .btn-preview {
      padding: 7px 14px;
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-family: var(--font-body);
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .btn-preview:hover { color: var(--text); border-color: var(--text-muted); }

    .preview-section {
      margin-top: 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }

    .preview-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 12px;
      margin: 0;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
    }

    .preview-scroll {
      overflow-x: auto;
      max-height: 220px;
      overflow-y: auto;
    }

    .preview-table {
      border-collapse: collapse;
      font-size: 12px;
      white-space: nowrap;
      width: 100%;
    }

    .preview-table thead { position: sticky; top: 0; z-index: 1; }

    .preview-table th {
      background: var(--bg);
      padding: 7px 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }

    .preview-table td {
      padding: 6px 12px;
      border-bottom: 1px solid var(--border);
      font-family: var(--font-mono);
      color: var(--text);
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .preview-table tr:last-child td { border-bottom: none; }
  `],
})
export class DailySyncCardComponent {
  syncing = signal(false);
  downloading = signal(false);
  result = signal<SyncResult | null>(null);
  error = signal('');
  downloadError = signal('');
  resultTab = signal<'matched' | 'unmatched'>('matched');
  maestroFilter = signal('');
  selectedIndices = signal<Set<number>>(new Set());
  showPreview = signal(false);
  showMaestroPreview = signal(false);
  shopifyConfig = signal<MappingConfig | null>(null);

  shopifyPreviewColumns = computed(() => this.shopifyConfig()?.shopify_columns ?? []);
  shopifyPreviewRows = computed(() => (this.shopifyConfig()?.shopify_sample_rows ?? []).slice(0, 5));

  maestroColumns = computed(() => {
    const rows = this.result()?.maestro_rows ?? [];
    if (rows.length === 0) return [];
    return Object.keys(rows[0]);
  });

  maestroPreviewRows = computed(() => (this.result()?.maestro_rows ?? []).slice(0, 5));

  filteredRows = computed(() => {
    const rows = this.result()?.maestro_rows ?? [];
    const skuCol = this.result()?.maestro_sku_col ?? '';
    const filter = this.maestroFilter().trim();
    const indexed = rows.map((row, idx) => ({ row, idx }));
    if (!filter) return indexed;
    const skus = filter.split(';').map(s => s.trim().toLowerCase()).filter(Boolean);
    return indexed.filter(({ row }) => skus.includes((row[skuCol] ?? '').toLowerCase()));
  });

  constructor(private api: ApiService) {}

  togglePreview() {
    if (!this.showPreview() && !this.shopifyConfig()) {
      this.api.getMapping().subscribe({
        next: cfg => { this.shopifyConfig.set(cfg); this.showPreview.set(true); },
        error: () => { this.showPreview.set(true); },
      });
    } else {
      this.showPreview.set(!this.showPreview());
    }
  }

  onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.syncing.set(true);
    this.error.set('');
    this.result.set(null);
    this.selectedIndices.set(new Set());
    this.maestroFilter.set('');
    this.showMaestroPreview.set(false);

    this.api.sync(file).subscribe({
      next: res => {
        this.result.set(res);
        this.resultTab.set('matched');
        this.syncing.set(false);
        const matchedSkus = new Set(res.matched.map(m => m.sku.toLowerCase()));
        const preSelected = new Set<number>();
        res.maestro_rows.forEach((row, idx) => {
          if (matchedSkus.has((row[res.maestro_sku_col] ?? '').toLowerCase())) preSelected.add(idx);
        });
        this.selectedIndices.set(preSelected);
      },
      error: err => {
        const detail = err.error?.detail;
        this.error.set(typeof detail === 'object' ? detail.message : (detail || 'Errore sync'));
        this.syncing.set(false);
      },
    });
  }

  toggleRow(idx: number) {
    const s = new Set(this.selectedIndices());
    if (s.has(idx)) s.delete(idx); else s.add(idx);
    this.selectedIndices.set(s);
  }

  selectAll() {
    const s = new Set(this.selectedIndices());
    for (const { idx } of this.filteredRows()) s.add(idx);
    this.selectedIndices.set(s);
  }

  clearSelection() {
    this.selectedIndices.set(new Set());
  }

  download() {
    const res = this.result();
    if (!res) return;

    const selected = this.selectedIndices();
    if (selected.size === 0) {
      this._triggerDownload(res.file_b64, res.filename);
      return;
    }

    const selectedRows = res.maestro_rows.filter((_, i) => selected.has(i));
    this.downloading.set(true);
    this.downloadError.set('');

    this.api.addProducts(res.file_b64, res.format, selectedRows).subscribe({
      next: data => {
        this.downloading.set(false);
        this._triggerDownload(data.file_b64, data.filename);
      },
      error: err => {
        this.downloading.set(false);
        const detail = err.error?.detail;
        this.downloadError.set(typeof detail === 'string' ? detail : 'Errore durante l\'aggiunta dei prodotti. Configura il mapping in /settings.');
      },
    });
  }

  private _triggerDownload(b64: string, filename: string) {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

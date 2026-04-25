import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { TemplateInfo } from '../../core/models/types';

@Component({
  selector: 'app-shopify-template-card',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="card">
      <div class="card-header">
        <h2>Template Shopify</h2>
        <p class="card-desc">File base con SKU e quantità da Shopify</p>
      </div>

      @if (template()) {
        <div class="info-block">
          <div class="info-row">
            <span class="info-label">File</span>
            <span class="info-value filename">{{ template()!.filename }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Caricato</span>
            <span class="info-value">{{ template()!.uploaded_at | date:'dd/MM/yyyy HH:mm' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Colonna SKU</span>
            <code class="pill">{{ template()!.sku_column }}</code>
          </div>
          <div class="info-row">
            <span class="info-label">Colonna Qtà</span>
            <code class="pill">{{ template()!.qty_column }}</code>
          </div>
        </div>
      } @else {
        <div class="empty-state">
          Nessun template. Carica il file esportato da Shopify per iniziare.
        </div>
      }

      <input type="file" accept=".csv,.xls,.xlsx" (change)="onFile($event)" #fi hidden />

      <button class="btn-primary" (click)="fi.click()" [disabled]="uploading()">
        @if (uploading()) {
          <span class="spinner"></span>
          Caricamento...
        } @else {
          {{ template() ? 'Aggiorna template' : 'Carica template Shopify' }}
        }
      </button>

      @if (error()) {
        <div class="error-box">{{ error() }}</div>
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

    .info-block {
      background: var(--bg);
      border-radius: var(--radius-sm);
      margin-bottom: 20px;
      overflow: hidden;
    }

    .info-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      gap: 12px;
    }

    .info-row + .info-row { border-top: 1px solid var(--border); }

    .info-label { font-size: 13px; color: var(--text-muted); flex-shrink: 0; }

    .info-value { font-size: 14px; font-weight: 500; text-align: right; }

    .filename {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
      word-break: break-all;
      text-align: right;
    }

    .pill {
      font-family: var(--font-mono);
      font-size: 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 3px 10px;
      border-radius: 100px;
      color: var(--text);
    }

    .empty-state {
      padding: 20px;
      background: var(--bg);
      border-radius: var(--radius-sm);
      margin-bottom: 20px;
      text-align: center;
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1.5;
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
  `],
})
export class ShopifyTemplateCardComponent implements OnInit {
  template = signal<TemplateInfo | null>(null);
  uploading = signal(false);
  error = signal('');

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getTemplate().subscribe({
      next: t => this.template.set(t),
      error: err => {
        if (err.status !== 404) this.error.set('Errore nel caricamento del template');
      },
    });
  }

  onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.error.set('');
    this.api.uploadTemplate(file).subscribe({
      next: t => { this.template.set(t); this.uploading.set(false); },
      error: err => {
        const detail = err.error?.detail;
        this.error.set(typeof detail === 'object' ? detail.message : (detail || 'Errore upload'));
        this.uploading.set(false);
      },
    });
  }
}

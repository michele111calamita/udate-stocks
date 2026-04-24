import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { TemplateInfo } from '../../core/models/types';

@Component({
  selector: 'app-shopify-template-card',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <section class="card">
      <h2>Template Shopify</h2>
      @if (template()) {
        <p>File: <strong>{{ template()!.filename }}</strong></p>
        <p>Caricato: {{ template()!.uploaded_at | date:'dd/MM/yyyy HH:mm' }}</p>
        <p>Colonne rilevate — SKU: <code>{{ template()!.sku_column }}</code> | Quantità: <code>{{ template()!.qty_column }}</code></p>
      } @else {
        <p>Nessun template caricato. Carica il file esportato da Shopify.</p>
      }
      <input type="file" accept=".csv,.xls,.xlsx" (change)="onFile($event)" #fi hidden />
      <button (click)="fi.click()" [disabled]="uploading()">
        {{ uploading() ? 'Caricamento...' : (template() ? 'Aggiorna template' : 'Carica template Shopify') }}
      </button>
      @if (error()) { <p class="error">{{ error() }}</p> }
    </section>
  `,
  styles: [`
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
    button { padding: 8px 16px; cursor: pointer; }
    .error { color: red; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
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

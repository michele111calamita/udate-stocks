import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-daily-sync-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="card">
      <h2>Sync Giornaliero</h2>
      <p>Carica il CSV esportato da Maestro per aggiornare le giacenze.</p>
      <input type="file" accept=".csv" (change)="onFile($event)" #si hidden />
      <button (click)="si.click()" [disabled]="syncing()">
        {{ syncing() ? 'Elaborazione...' : 'Carica CSV Maestro' }}
      </button>
      @if (result()) {
        <div class="result">
          <p>Sync completato. SKU non trovati in Maestro: <strong>{{ result()!.unmatched }}</strong></p>
          <a [href]="result()!.url" [download]="result()!.filename" class="download-btn">
            Scarica file aggiornato
          </a>
        </div>
      }
      @if (error()) { <p class="error">{{ error() }}</p> }
    </section>
  `,
  styles: [`
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 24px; }
    button { padding: 8px 16px; cursor: pointer; }
    .result { margin-top: 16px; }
    .download-btn { display: inline-block; margin-top: 8px; padding: 8px 16px; background: #0070f3; color: white; border-radius: 4px; text-decoration: none; }
    .error { color: red; }
  `],
})
export class DailySyncCardComponent {
  syncing = signal(false);
  result = signal<{ url: string; filename: string; unmatched: number } | null>(null);
  error = signal('');

  constructor(private api: ApiService) {}

  onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.syncing.set(true);
    this.error.set('');
    this.result.set(null);

    this.api.sync(file).subscribe({
      next: response => {
        const unmatched = parseInt(response.headers.get('X-Unmatched-SKUs') ?? '0', 10);
        const blob = response.body!;
        const cd = response.headers.get('Content-Disposition') ?? '';
        const match = cd.match(/filename="(.+?)"/);
        const filename = match?.[1] ?? 'shopify_updated.csv';
        this.result.set({ url: URL.createObjectURL(blob), filename, unmatched });
        this.syncing.set(false);
      },
      error: err => {
        if (err.error instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(reader.result as string);
              const detail = parsed.detail;
              this.error.set(typeof detail === 'object' ? detail.message : (detail || 'Errore sync'));
            } catch {
              this.error.set('Errore durante la sincronizzazione');
            }
            this.syncing.set(false);
          };
          reader.readAsText(err.error);
        } else {
          this.error.set(err.error?.detail || 'Errore sync');
          this.syncing.set(false);
        }
      },
    });
  }
}

# Maestro Product Selection — Design Spec

**Date:** 2026-04-29  
**Status:** Approved

## Overview

After a daily sync, users can browse all Maestro rows, filter by SKU list, select products, and download a Shopify export that includes both the synced quantity updates and the newly added products. Column mapping (Maestro → Shopify) is configured once in a dedicated settings page and saved per-user.

---

## Architecture & Data Flow

```
POST /api/sync
  → reads Maestro file
  → upserts maestro_columns into ColumnMapping (DB)
  → returns { file_b64, matched, unmatched, maestro_rows }

POST /api/sync/add-products
  → body: { file_b64, format, selected_rows: list[dict] }
  → loads user's ColumnMapping from DB
  → appends mapped rows to Shopify file
  → returns { file_b64, filename }

GET  /api/mapping  → { mappings, maestro_columns, shopify_columns }
PUT  /api/mapping  → body: { mappings: { maestro_col: shopify_col } }
```

---

## Backend

### New DB Model: `ColumnMapping`

```python
class ColumnMapping(Base):
    __tablename__ = "column_mappings"
    id: int (PK)
    user_id: UUID (FK → users, unique)
    maestro_columns: JSON   # list[str] — last seen Maestro column headers
    mappings: JSON          # dict[str, str] — maestro_col → shopify_col
    updated_at: datetime
```

### Schema changes (`schemas.py`)

- `ColumnMappingRead`: `{ mappings, maestro_columns, shopify_columns }`
- `ColumnMappingWrite`: `{ mappings: dict[str, str] }`
- `SyncResult` extended: add `maestro_rows: list[dict[str, str]]`, `maestro_sku_col: str`, `format: str`

### `sync.py` changes

1. After `sync_quantities()`, upsert `ColumnMapping.maestro_columns` for current user.
2. Add to response: `maestro_rows` (all Maestro rows as list of dicts), `maestro_sku_col` (detected SKU column name), `format` (Shopify template format).

### New endpoint: `POST /api/sync/add-products`

- Auth: current user
- Body: `{ file_b64: str, format: str, selected_rows: list[dict[str, str]] }`
- Loads user's `ShopifyTemplate` (for `sku_column`, `qty_column`) and `ColumnMapping`
- Decodes `file_b64` → DataFrame
- For each selected row: creates new Shopify row, filling columns per `mappings` dict
- Appends rows, re-encodes file
- Returns `{ file_b64: str, filename: str }`

### New router: `mapping.py`

- `GET /api/mapping`: returns `ColumnMappingRead` for current user (404 if no template yet)
- `PUT /api/mapping`: upserts mappings for current user

---

## Frontend

### New route: `/settings`

**`SettingsMappingComponent`**:
- Calls `GET /api/mapping` on init
- Shows two-column layout: Shopify column (left) ↔ Maestro column dropdown (right)
- Option "—" (no mapping) for each Shopify column
- Save button → `PUT /api/mapping`
- Success/error feedback inline
- Accessible from dashboard (button/link visible when template is uploaded)

### `types.ts` updates

```typescript
export type MaestroRow = Record<string, string>;

export interface SyncResult {
  filename: string;
  file_b64: string;
  format: string;              // NEW — "csv" | "xlsx" | "xls"
  matched: MatchedRow[];
  unmatched: string[];
  maestro_rows: MaestroRow[];  // NEW
  maestro_sku_col: string;     // NEW — column name for SKU filter
}

export interface MappingConfig {
  mappings: Record<string, string>;
  maestro_columns: string[];
  shopify_columns: string[];
}
```

### `daily-sync-card` updates

New section below existing tabs (visible only when `result()` is set):

1. **Filtro SKU** — text input, placeholder `SKU1;SKU2;SKU3`
   - Splits on `;`, trims whitespace
   - Filters `result().maestro_rows` to rows where SKU column matches any token
   - Empty input = show all rows

2. **Bottone "Seleziona tutto"** — checks all rows currently visible (filtered)

3. **Tabella Maestro** — all Maestro columns as headers, checkbox per row
   - `selectedRows: Set<number>` (by index in original `maestro_rows` array)
   - Max height with scroll

4. **`download()`** modified:
   - If `selectedRows.size === 0`: download `result().file_b64` directly (existing behavior)
   - If `selectedRows.size > 0`: call `POST /api/sync/add-products` with `file_b64 + format + selected_rows`, then download returned file

### `api.service.ts` additions

```typescript
getMapping(): Observable<MappingConfig>
saveMapping(mappings: Record<string, string>): Observable<void>
addProducts(payload: AddProductsRequest): Observable<{ file_b64: string; filename: string }>
```

---

## Error Handling

- Mapping not configured → `add-products` returns 422 with message "Column mapping not configured" → frontend shows inline error
- No template → `GET /api/mapping` returns 404 → settings page shows "Carica prima un template Shopify"
- `add-products` file parse error → 400 → inline error in sync card

---

## Out of Scope

- Mapping multiple Maestro columns to one Shopify column
- Preview of mapped values before download
- Pagination of Maestro table (scroll is sufficient)

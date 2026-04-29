export interface Token {
  access_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface TemplateInfo {
  filename: string;
  uploaded_at: string;
  sku_column: string;
  qty_column: string;
}

export interface MatchedRow {
  sku: string;
  old_qty: string;
  new_qty: string;
}

export type MaestroRow = Record<string, string>;

export interface SyncResult {
  filename: string;
  file_b64: string;
  format: string;
  maestro_sku_col: string;
  matched: MatchedRow[];
  unmatched: string[];
  maestro_rows: MaestroRow[];
}

export interface MappingConfig {
  mappings: Record<string, string>;
  maestro_columns: string[];
  shopify_columns: string[];
  shopify_sample_rows: Record<string, string>[];
}

export interface AddProductsResponse {
  file_b64: string;
  filename: string;
}

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

export interface SyncResult {
  filename: string;
  file_b64: string;
  matched: MatchedRow[];
  unmatched: string[];
}

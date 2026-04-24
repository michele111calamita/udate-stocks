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

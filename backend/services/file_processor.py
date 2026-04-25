import io
from typing import Optional
import pandas as pd

SKU_CANDIDATES = ["variant sku", "sku", "codice", "cod", "articolo"]
QTY_CANDIDATES = ["variant inventory qty", "quantity", "qty", "giacenza", "disponibile", "quantita", "quantità"]

def detect_column(columns: list[str], candidates: list[str]) -> Optional[str]:
    lower_map = {c.lower().strip(): c for c in columns}
    for candidate in candidates:
        if candidate in lower_map:
            return lower_map[candidate]
    return None

def read_file(filepath: str, fmt: str) -> pd.DataFrame:
    if fmt == "csv":
        return pd.read_csv(filepath, dtype=str)
    return pd.read_excel(filepath, dtype=str, engine="openpyxl")

def write_file(df: pd.DataFrame, fmt: str) -> bytes:
    buf = io.BytesIO()
    if fmt == "csv":
        df.to_csv(buf, index=False)
    else:
        df.to_excel(buf, index=False, engine="openpyxl")
    return buf.getvalue()

def sync_quantities(
    shopify_path: str,
    shopify_fmt: str,
    shopify_sku_col: str,
    shopify_qty_col: str,
    maestro_bytes: bytes,
    maestro_sku_col: str,
    maestro_qty_col: str,
    maestro_fmt: str = "csv",
) -> tuple[bytes, int]:
    shopify_df = read_file(shopify_path, shopify_fmt)
    buf = io.BytesIO(maestro_bytes)
    if maestro_fmt == "csv":
        maestro_df = pd.read_csv(buf, dtype=str)
    else:
        engine = "xlrd" if maestro_fmt == "xls" else "openpyxl"
        maestro_df = pd.read_excel(buf, dtype=str, engine=engine)

    maestro_map = dict(zip(
        maestro_df[maestro_sku_col].str.strip(),
        maestro_df[maestro_qty_col].str.strip(),
    ))

    unmatched = 0
    for i, row in shopify_df.iterrows():
        sku = str(row[shopify_sku_col]).strip()
        if sku in maestro_map:
            shopify_df.at[i, shopify_qty_col] = maestro_map[sku]
        else:
            unmatched += 1

    return write_file(shopify_df, shopify_fmt), unmatched

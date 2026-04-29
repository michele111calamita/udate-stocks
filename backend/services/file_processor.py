import io
from typing import Optional
import pandas as pd

SKU_CANDIDATES = ["variant sku", "sku", "codice", "cod", "articolo"]
QTY_CANDIDATES = ["variant inventory qty", "quantity", "qty", "giacenza", "disponibile", "quantita", "quantità", "principale", "negozio"]

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

def read_file_from_bytes(data: bytes, fmt: str) -> pd.DataFrame:
    buf = io.BytesIO(data)
    if fmt == "csv":
        return pd.read_csv(buf, dtype=str)
    engine = "xlrd" if fmt == "xls" else "openpyxl"
    return pd.read_excel(buf, dtype=str, engine=engine)

def sync_quantities(
    shopify_path: str,
    shopify_fmt: str,
    shopify_sku_col: str,
    shopify_qty_col: str,
    maestro_bytes: bytes,
    maestro_sku_col: str,
    maestro_qty_col: str,
    maestro_fmt: str = "csv",
) -> tuple[bytes, list[dict], list[str]]:
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

    matched: list[dict] = []
    unmatched: list[str] = []

    for i, row in shopify_df.iterrows():
        sku = str(row[shopify_sku_col]).strip()
        if not sku or sku == "nan":
            continue
        if sku in maestro_map:
            old_qty = str(row[shopify_qty_col]).strip()
            new_qty = maestro_map[sku]
            shopify_df.at[i, shopify_qty_col] = new_qty
            matched.append({"sku": sku, "old_qty": old_qty, "new_qty": new_qty})
        else:
            unmatched.append(sku)

    return write_file(shopify_df, shopify_fmt), matched, unmatched

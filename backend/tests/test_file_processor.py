import io
import pandas as pd
import pytest
from services.file_processor import detect_column, sync_quantities, SKU_CANDIDATES, QTY_CANDIDATES

def test_detect_sku_variant_sku(tmp_path):
    assert detect_column(["Handle", "Variant SKU", "Price"], SKU_CANDIDATES) == "Variant SKU"

def test_detect_qty_variant_inventory(tmp_path):
    assert detect_column(["SKU", "Variant Inventory Qty", "Price"], QTY_CANDIDATES) == "Variant Inventory Qty"

def test_detect_italian_columns():
    assert detect_column(["CODICE", "GIACENZA", "Descrizione"], SKU_CANDIDATES) == "CODICE"
    assert detect_column(["CODICE", "GIACENZA", "Descrizione"], QTY_CANDIDATES) == "GIACENZA"

def test_detect_column_not_found():
    assert detect_column(["Handle", "Title", "Price"], SKU_CANDIDATES) is None

def test_sync_updates_matched_sku(tmp_path):
    shopify_csv = "Variant SKU,Variant Inventory Qty\nSKU001,5\nSKU002,3\n"
    p = tmp_path / "shopify.csv"
    p.write_text(shopify_csv)

    maestro = b"codice,giacenza\nSKU001,42\n"
    output, unmatched = sync_quantities(
        shopify_path=str(p), shopify_fmt="csv",
        shopify_sku_col="Variant SKU", shopify_qty_col="Variant Inventory Qty",
        maestro_bytes=maestro, maestro_sku_col="codice", maestro_qty_col="giacenza",
    )
    df = pd.read_csv(io.BytesIO(output), dtype=str)
    assert df[df["Variant SKU"] == "SKU001"]["Variant Inventory Qty"].values[0] == "42"
    assert df[df["Variant SKU"] == "SKU002"]["Variant Inventory Qty"].values[0] == "3"
    assert unmatched == 1

def test_sync_unmatched_count(tmp_path):
    shopify_csv = "Variant SKU,Variant Inventory Qty\nSKU001,5\nSKU002,3\nSKU003,1\n"
    p = tmp_path / "shopify.csv"
    p.write_text(shopify_csv)
    maestro = b"codice,giacenza\nSKU999,10\n"
    _, unmatched = sync_quantities(
        shopify_path=str(p), shopify_fmt="csv",
        shopify_sku_col="Variant SKU", shopify_qty_col="Variant Inventory Qty",
        maestro_bytes=maestro, maestro_sku_col="codice", maestro_qty_col="giacenza",
    )
    assert unmatched == 3

def test_sync_xlsx(tmp_path):
    df = pd.DataFrame({"Variant SKU": ["SKU001"], "Variant Inventory Qty": ["5"]})
    p = tmp_path / "shopify.xlsx"
    df.to_excel(str(p), index=False, engine="openpyxl")

    maestro = b"codice,giacenza\nSKU001,99\n"
    output, unmatched = sync_quantities(
        shopify_path=str(p), shopify_fmt="xlsx",
        shopify_sku_col="Variant SKU", shopify_qty_col="Variant Inventory Qty",
        maestro_bytes=maestro, maestro_sku_col="codice", maestro_qty_col="giacenza",
    )
    result_df = pd.read_excel(io.BytesIO(output), engine="openpyxl", dtype=str)
    assert result_df["Variant Inventory Qty"].values[0] == "99"
    assert unmatched == 0

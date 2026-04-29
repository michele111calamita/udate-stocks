import base64
import io
from datetime import datetime, timezone
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.dependencies import get_current_user
from services.file_processor import detect_column, sync_quantities, SKU_CANDIDATES, QTY_CANDIDATES, read_file_from_bytes, write_file
from app.schemas import AddProductsRequest

router = APIRouter(prefix="/api", tags=["sync"])

def _upsert_maestro_columns(db: Session, user_id: str, columns: list[str]):
    cm = db.query(models.ColumnMapping).filter(
        models.ColumnMapping.user_id == user_id
    ).first()
    if cm:
        cm.maestro_columns = columns
        cm.updated_at = datetime.now(timezone.utc)
    else:
        cm = models.ColumnMapping(
            user_id=user_id,
            maestro_columns=columns,
            mappings={},
        )
        db.add(cm)
    db.commit()

@router.post("/sync")
def sync(
    file: UploadFile,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    template = db.query(models.ShopifyTemplate).filter(
        models.ShopifyTemplate.user_id == user.id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="No Shopify template uploaded yet")

    maestro_bytes = file.file.read()
    fname = (file.filename or "").lower()
    maestro_fmt = "xlsx" if fname.endswith(".xlsx") else "xls" if fname.endswith(".xls") else "csv"

    try:
        buf = io.BytesIO(maestro_bytes)
        if maestro_fmt == "csv":
            maestro_df = pd.read_csv(buf, dtype=str)
        else:
            engine = "xlrd" if maestro_fmt == "xls" else "openpyxl"
            maestro_df = pd.read_excel(buf, dtype=str, engine=engine)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot parse Maestro file: {e}")

    cols = list(maestro_df.columns)
    maestro_sku = detect_column(cols, SKU_CANDIDATES)
    maestro_qty = detect_column(cols, QTY_CANDIDATES)

    if not maestro_sku:
        raise HTTPException(status_code=422, detail={"message": "SKU column not found in Maestro file", "columns": cols})
    if not maestro_qty:
        raise HTTPException(status_code=422, detail={"message": "Quantity column not found in Maestro file", "columns": cols})

    _upsert_maestro_columns(db, user.id, cols)

    output_bytes, matched, unmatched = sync_quantities(
        shopify_path=template.filepath,
        shopify_fmt=template.format.value,
        shopify_sku_col=template.sku_column,
        shopify_qty_col=template.qty_column,
        maestro_bytes=maestro_bytes,
        maestro_fmt=maestro_fmt,
        maestro_sku_col=maestro_sku,
        maestro_qty_col=maestro_qty,
    )

    maestro_rows = maestro_df.fillna("").to_dict(orient="records")

    fmt = template.format.value
    return {
        "filename": f"shopify_updated.{fmt}",
        "file_b64": base64.b64encode(output_bytes).decode(),
        "format": fmt,
        "maestro_sku_col": maestro_sku,
        "matched": matched,
        "unmatched": unmatched,
        "maestro_rows": maestro_rows,
    }


@router.post("/sync/add-products")
def add_products(
    body: AddProductsRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    cm = db.query(models.ColumnMapping).filter(
        models.ColumnMapping.user_id == user.id
    ).first()
    if not cm or not cm.mappings:
        raise HTTPException(status_code=422, detail="Column mapping not configured. Go to /settings to set it up.")

    file_bytes = base64.b64decode(body.file_b64)
    shopify_df = read_file_from_bytes(file_bytes, body.format)

    new_rows = []
    for maestro_row in body.selected_rows:
        new_row = {col: "" for col in shopify_df.columns}
        for shopify_col, maestro_col in cm.mappings.items():
            if shopify_col in new_row and maestro_col in maestro_row:
                new_row[shopify_col] = maestro_row[maestro_col]
        new_rows.append(new_row)

    if new_rows:
        shopify_df = pd.concat(
            [shopify_df, pd.DataFrame(new_rows)],
            ignore_index=True,
        )

    output_bytes = write_file(shopify_df, body.format)

    template = db.query(models.ShopifyTemplate).filter(
        models.ShopifyTemplate.user_id == user.id
    ).first()
    if template:
        with open(template.filepath, "wb") as f:
            f.write(output_bytes)

    return {
        "file_b64": base64.b64encode(output_bytes).decode(),
        "filename": f"shopify_with_additions.{body.format}",
    }

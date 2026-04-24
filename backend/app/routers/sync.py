import io
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.dependencies import get_current_user
from services.file_processor import detect_column, sync_quantities, SKU_CANDIDATES, QTY_CANDIDATES

router = APIRouter(prefix="/api", tags=["sync"])

_MEDIA = {
    "csv": "text/csv",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

@router.post("/sync")
def sync(
    file: UploadFile,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    template = db.query(models.ShopifyTemplate).filter(models.ShopifyTemplate.user_id == user.id).first()
    if not template:
        raise HTTPException(status_code=404, detail="No Shopify template uploaded yet")

    maestro_bytes = file.file.read()
    try:
        header_df = pd.read_csv(io.BytesIO(maestro_bytes), dtype=str, nrows=0)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot parse Maestro file: {e}")

    cols = list(header_df.columns)
    maestro_sku = detect_column(cols, SKU_CANDIDATES)
    maestro_qty = detect_column(cols, QTY_CANDIDATES)

    if not maestro_sku:
        raise HTTPException(status_code=422, detail={"message": "SKU column not found in Maestro file", "columns": cols})
    if not maestro_qty:
        raise HTTPException(status_code=422, detail={"message": "Quantity column not found in Maestro file", "columns": cols})

    output_bytes, unmatched = sync_quantities(
        shopify_path=template.filepath,
        shopify_fmt=template.format.value,
        shopify_sku_col=template.sku_column,
        shopify_qty_col=template.qty_column,
        maestro_bytes=maestro_bytes,
        maestro_sku_col=maestro_sku,
        maestro_qty_col=maestro_qty,
    )

    fmt = template.format.value
    return StreamingResponse(
        io.BytesIO(output_bytes),
        media_type=_MEDIA[fmt],
        headers={
            "Content-Disposition": f'attachment; filename="shopify_updated.{fmt}"',
            "X-Unmatched-SKUs": str(unmatched),
        },
    )

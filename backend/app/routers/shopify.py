import io
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session
import pandas as pd
from app.database import get_db
from app import models, schemas
from app.config import settings
from app.dependencies import get_current_user
from services.file_processor import detect_column, SKU_CANDIDATES, QTY_CANDIDATES

router = APIRouter(prefix="/api", tags=["shopify"])

_ALLOWED = {"csv": models.FileFormat.csv, "xls": models.FileFormat.xls, "xlsx": models.FileFormat.xlsx}

def _parse_format(filename: str) -> models.FileFormat:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _ALLOWED:
        raise HTTPException(status_code=400, detail=f"Unsupported format '.{ext}'. Use CSV, XLS, or XLSX.")
    return _ALLOWED[ext]

@router.post("/shopify-template", response_model=schemas.TemplateInfo)
def upload_template(
    file: UploadFile,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    fmt = _parse_format(file.filename or "")
    content = file.file.read()

    try:
        buf = io.BytesIO(content)
        df = pd.read_csv(buf, dtype=str, nrows=0) if fmt == models.FileFormat.csv else pd.read_excel(buf, dtype=str, nrows=0, engine="openpyxl")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot parse file: {e}")

    cols = list(df.columns)
    sku_col = detect_column(cols, SKU_CANDIDATES)
    qty_col = detect_column(cols, QTY_CANDIDATES)

    if not sku_col:
        raise HTTPException(status_code=422, detail={"message": "SKU column not found", "columns": cols})
    if not qty_col:
        raise HTTPException(status_code=422, detail={"message": "Quantity column not found", "columns": cols})

    user_dir = os.path.join(settings.upload_dir, user.id)
    os.makedirs(user_dir, exist_ok=True)
    filepath = os.path.join(user_dir, f"shopify_template.{fmt.value}")
    with open(filepath, "wb") as f:
        f.write(content)

    template = db.query(models.ShopifyTemplate).filter(models.ShopifyTemplate.user_id == user.id).first()
    if template:
        template.filename = file.filename or ""
        template.filepath = filepath
        template.format = fmt
        template.sku_column = sku_col
        template.qty_column = qty_col
        template.uploaded_at = datetime.now(timezone.utc)
    else:
        template = models.ShopifyTemplate(
            user_id=user.id,
            filename=file.filename or "",
            filepath=filepath,
            format=fmt,
            sku_column=sku_col,
            qty_column=qty_col,
        )
        db.add(template)

    db.commit()
    db.refresh(template)
    return schemas.TemplateInfo(
        filename=template.filename,
        uploaded_at=template.uploaded_at,
        sku_column=template.sku_column,
        qty_column=template.qty_column,
    )

@router.get("/shopify-template", response_model=schemas.TemplateInfo)
def get_template(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    template = db.query(models.ShopifyTemplate).filter(models.ShopifyTemplate.user_id == user.id).first()
    if not template:
        raise HTTPException(status_code=404, detail="No Shopify template uploaded yet")
    return schemas.TemplateInfo(
        filename=template.filename,
        uploaded_at=template.uploaded_at,
        sku_column=template.sku_column,
        qty_column=template.qty_column,
    )

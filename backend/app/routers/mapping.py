import io
import pandas as pd
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.dependencies import get_current_user
from app.schemas import ColumnMappingRead, ColumnMappingWrite
from services.file_processor import read_file_from_bytes

router = APIRouter(prefix="/api", tags=["mapping"])

def _shopify_columns(template: models.ShopifyTemplate) -> list[str]:
    with open(template.filepath, "rb") as f:
        data = f.read()
    df = read_file_from_bytes(data, template.format.value)
    return list(df.columns)

@router.get("/mapping", response_model=ColumnMappingRead)
def get_mapping(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    template = db.query(models.ShopifyTemplate).filter(
        models.ShopifyTemplate.user_id == user.id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="No Shopify template uploaded yet")

    cm = db.query(models.ColumnMapping).filter(
        models.ColumnMapping.user_id == user.id
    ).first()

    return ColumnMappingRead(
        mappings=cm.mappings if cm else {},
        maestro_columns=cm.maestro_columns if cm else [],
        shopify_columns=_shopify_columns(template),
    )

@router.put("/mapping", status_code=200)
def save_mapping(
    body: ColumnMappingWrite,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    cm = db.query(models.ColumnMapping).filter(
        models.ColumnMapping.user_id == user.id
    ).first()
    if cm:
        cm.mappings = body.mappings
        cm.updated_at = datetime.now(timezone.utc)
    else:
        cm = models.ColumnMapping(
            user_id=user.id,
            maestro_columns=[],
            mappings=body.mappings,
        )
        db.add(cm)
    db.commit()
    return {"ok": True}

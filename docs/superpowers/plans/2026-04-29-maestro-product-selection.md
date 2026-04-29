# Maestro Product Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users browse all Maestro rows after sync, filter by SKU, select rows, and download a Shopify export that includes both updated quantities and newly added products (mapped via a saved per-user column mapping).

**Architecture:** Backend adds a `ColumnMapping` DB model (per-user, stores last Maestro column headers + mapping dict), updates `/api/sync` to return all Maestro rows, and adds two new endpoints (`GET/PUT /api/mapping`, `POST /api/sync/add-products`). Frontend adds a `/settings` route for mapping config and extends `daily-sync-card` with a filterable Maestro table + checkboxes.

**Tech Stack:** FastAPI 0.115, SQLAlchemy 2.0, SQLite/PostgreSQL, pandas, Angular 19 standalone signals.

---

## File Map

**Create:**
- `backend/app/routers/mapping.py` — GET/PUT /api/mapping
- `backend/tests/test_mapping.py` — mapping endpoint tests
- `backend/tests/test_add_products.py` — add-products endpoint tests
- `frontend/src/app/features/settings/settings-mapping.component.ts` — /settings page

**Modify:**
- `backend/app/models.py` — add ColumnMapping model + User relationship
- `backend/app/schemas.py` — add ColumnMappingRead/Write/AddProductsRequest, extend SyncResult
- `backend/services/file_processor.py` — add read_file_from_bytes helper
- `backend/app/routers/sync.py` — upsert ColumnMapping + new response fields + add-products endpoint
- `backend/tests/test_sync.py` — update test for new JSON response shape
- `backend/main.py` — include mapping router
- `frontend/src/app/core/models/types.ts` — add MaestroRow, MappingConfig, update SyncResult
- `frontend/src/app/core/services/api.service.ts` — add getMapping, saveMapping, addProducts
- `frontend/src/app/app.routes.ts` — add /settings route
- `frontend/src/app/features/dashboard/daily-sync-card.component.ts` — Maestro table section + modified download

---

## Task 1: ColumnMapping DB model

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Step 1: Add ColumnMapping to models.py**

Open `backend/app/models.py`. Replace the entire file with:

```python
import uuid
import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Enum as SAEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class FileFormat(enum.Enum):
    csv = "csv"
    xls = "xls"
    xlsx = "xlsx"

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    template: Mapped[Optional["ShopifyTemplate"]] = relationship(back_populates="user", uselist=False)
    column_mapping: Mapped[Optional["ColumnMapping"]] = relationship(back_populates="user", uselist=False)

class ShopifyTemplate(Base):
    __tablename__ = "shopify_templates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String)
    filepath: Mapped[str] = mapped_column(String)
    format: Mapped[FileFormat] = mapped_column(SAEnum(FileFormat, native_enum=False))
    sku_column: Mapped[str] = mapped_column(String)
    qty_column: Mapped[str] = mapped_column(String)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship(back_populates="template")

class ColumnMapping(Base):
    __tablename__ = "column_mappings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), unique=True)
    maestro_columns: Mapped[list] = mapped_column(JSON, default=list)
    mappings: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship(back_populates="column_mapping")
```

- [ ] **Step 2: Run existing tests to confirm nothing broken**

```bash
cd backend
pytest -v
```

Expected: all previously passing tests still pass (ColumnMapping table is created by `Base.metadata.create_all`).

- [ ] **Step 3: Commit**

```bash
git add backend/app/models.py
git commit -m "feat: add ColumnMapping DB model"
```

---

## Task 2: Schemas + file_processor helper

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/services/file_processor.py`

- [ ] **Step 1: Add schemas**

Replace `backend/app/schemas.py` with:

```python
from pydantic import BaseModel
from datetime import datetime

class LoginRequest(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserCreate(BaseModel):
    email: str
    password: str
    is_admin: bool = False

class UserResponse(BaseModel):
    id: str
    email: str
    is_admin: bool
    created_at: datetime
    model_config = {"from_attributes": True}

class TemplateInfo(BaseModel):
    filename: str
    uploaded_at: datetime
    sku_column: str
    qty_column: str
    model_config = {"from_attributes": True}

class ColumnMappingRead(BaseModel):
    mappings: dict[str, str]
    maestro_columns: list[str]
    shopify_columns: list[str]

class ColumnMappingWrite(BaseModel):
    mappings: dict[str, str]

class AddProductsRequest(BaseModel):
    file_b64: str
    format: str  # "csv" | "xlsx" | "xls"
    selected_rows: list[dict[str, str]]
```

- [ ] **Step 2: Add read_file_from_bytes helper to file_processor.py**

Open `backend/services/file_processor.py`. Add this function after `write_file`:

```python
def read_file_from_bytes(data: bytes, fmt: str) -> pd.DataFrame:
    buf = io.BytesIO(data)
    if fmt == "csv":
        return pd.read_csv(buf, dtype=str)
    engine = "xlrd" if fmt == "xls" else "openpyxl"
    return pd.read_excel(buf, dtype=str, engine=engine)
```

- [ ] **Step 3: Run tests**

```bash
cd backend
pytest -v
```

Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas.py backend/services/file_processor.py
git commit -m "feat: add mapping schemas and read_file_from_bytes helper"
```

---

## Task 3: Mapping router + tests

**Files:**
- Create: `backend/app/routers/mapping.py`
- Create: `backend/tests/test_mapping.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_mapping.py`:

```python
import io

SHOPIFY_CSV = b"Handle,Variant SKU,Variant Inventory Qty\nprod1,SKU001,5\n"

def _upload_template(client, token):
    client.post(
        "/api/shopify-template",
        files={"file": ("shopify.csv", io.BytesIO(SHOPIFY_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )

def test_get_mapping_no_template_returns_404(client, user_token):
    r = client.get("/api/mapping", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 404

def test_get_mapping_empty_before_sync(client, user_token):
    _upload_template(client, user_token)
    r = client.get("/api/mapping", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["mappings"] == {}
    assert data["maestro_columns"] == []
    assert "Variant SKU" in data["shopify_columns"]

def test_put_mapping_saves_and_returns(client, user_token):
    _upload_template(client, user_token)
    payload = {"mappings": {"Variant SKU": "codice", "Variant Inventory Qty": "giacenza"}}
    r = client.put("/api/mapping", json=payload, headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 200

    r2 = client.get("/api/mapping", headers={"Authorization": f"Bearer {user_token}"})
    assert r2.json()["mappings"] == payload["mappings"]

def test_put_mapping_requires_auth(client):
    r = client.put("/api/mapping", json={"mappings": {}})
    assert r.status_code == 403

def test_get_mapping_requires_auth(client):
    r = client.get("/api/mapping")
    assert r.status_code == 403
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
pytest tests/test_mapping.py -v
```

Expected: FAIL — "404 Not Found" or connection error since route doesn't exist yet.

- [ ] **Step 3: Create mapping router**

Create `backend/app/routers/mapping.py`:

```python
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
```

- [ ] **Step 4: Register router in main.py**

In `backend/main.py`, add after the sync router lines:

```python
from app.routers import mapping as mapping_router
app.include_router(mapping_router.router)
```

- [ ] **Step 5: Run tests**

```bash
cd backend
pytest tests/test_mapping.py -v
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Run full suite**

```bash
cd backend
pytest -v
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/mapping.py backend/tests/test_mapping.py backend/main.py
git commit -m "feat: add mapping router GET/PUT /api/mapping"
```

---

## Task 4: Update sync endpoint

**Files:**
- Modify: `backend/app/routers/sync.py`
- Modify: `backend/tests/test_sync.py`

- [ ] **Step 1: Update test_sync.py to match JSON response**

Replace `test_sync_updates_quantities` in `backend/tests/test_sync.py`:

```python
import io
import pandas as pd

SHOPIFY_CSV = b"Handle,Variant SKU,Variant Inventory Qty\nprod1,SKU001,5\nprod2,SKU002,3\n"
MAESTRO_CSV = b"codice,giacenza\nSKU001,42\nSKU003,99\n"

def _upload_template(client, token):
    client.post(
        "/api/shopify-template",
        files={"file": ("shopify.csv", io.BytesIO(SHOPIFY_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )

def test_sync_updates_quantities(client, user_token):
    _upload_template(client, user_token)
    r = client.post(
        "/api/sync",
        files={"file": ("maestro.csv", io.BytesIO(MAESTRO_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["format"] == "csv"
    assert data["maestro_sku_col"] == "codice"
    matched_skus = {m["sku"] for m in data["matched"]}
    assert "SKU001" in matched_skus
    assert data["unmatched"] == ["SKU002"]
    assert len(data["maestro_rows"]) == 2
    sku001_row = next(row for row in data["maestro_rows"] if row["codice"] == "SKU001")
    assert sku001_row["giacenza"] == "42"

def test_sync_saves_maestro_columns(client, user_token):
    _upload_template(client, user_token)
    client.post(
        "/api/sync",
        files={"file": ("maestro.csv", io.BytesIO(MAESTRO_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    r = client.get("/api/mapping", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 200
    assert set(r.json()["maestro_columns"]) == {"codice", "giacenza"}

def test_sync_no_template(client, user_token):
    r = client.post(
        "/api/sync",
        files={"file": ("maestro.csv", io.BytesIO(MAESTRO_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 404

def test_sync_maestro_missing_sku_column(client, user_token):
    _upload_template(client, user_token)
    bad_maestro = b"nome,quantita_magazzino\nProdotto1,10\n"
    r = client.post(
        "/api/sync",
        files={"file": ("maestro.csv", io.BytesIO(bad_maestro), "text/csv")},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 422

def test_sync_requires_auth(client):
    r = client.post(
        "/api/sync",
        files={"file": ("maestro.csv", io.BytesIO(MAESTRO_CSV), "text/csv")},
    )
    assert r.status_code == 403
```

- [ ] **Step 2: Run new tests to confirm they fail**

```bash
cd backend
pytest tests/test_sync.py -v
```

Expected: `test_sync_updates_quantities` and `test_sync_saves_maestro_columns` FAIL (new fields missing).

- [ ] **Step 3: Update sync.py**

Replace `backend/app/routers/sync.py` with:

```python
import base64
import io
from datetime import datetime, timezone
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.dependencies import get_current_user
from services.file_processor import detect_column, sync_quantities, SKU_CANDIDATES, QTY_CANDIDATES

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
```

- [ ] **Step 4: Run sync tests**

```bash
cd backend
pytest tests/test_sync.py -v
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
cd backend
pytest -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/sync.py backend/tests/test_sync.py
git commit -m "feat: sync returns maestro_rows, maestro_sku_col, format; upserts ColumnMapping"
```

---

## Task 5: add-products endpoint + tests

**Files:**
- Modify: `backend/app/routers/sync.py`
- Create: `backend/tests/test_add_products.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_add_products.py`:

```python
import io
import base64
import pandas as pd

SHOPIFY_CSV = b"Handle,Variant SKU,Variant Inventory Qty\nprod1,SKU001,5\n"
MAESTRO_CSV = b"codice,giacenza\nSKU001,42\nSKU999,10\n"

def _upload_template(client, token):
    client.post(
        "/api/shopify-template",
        files={"file": ("shopify.csv", io.BytesIO(SHOPIFY_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )

def _do_sync(client, token):
    r = client.post(
        "/api/sync",
        files={"file": ("maestro.csv", io.BytesIO(MAESTRO_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )
    return r.json()

def _save_mapping(client, token):
    client.put(
        "/api/mapping",
        json={"mappings": {"Variant SKU": "codice", "Variant Inventory Qty": "giacenza"}},
        headers={"Authorization": f"Bearer {token}"},
    )

def test_add_products_appends_rows(client, user_token):
    _upload_template(client, user_token)
    sync_data = _do_sync(client, user_token)
    _save_mapping(client, user_token)

    selected = [{"codice": "SKU999", "giacenza": "10"}]
    r = client.post(
        "/api/sync/add-products",
        json={
            "file_b64": sync_data["file_b64"],
            "format": "csv",
            "selected_rows": selected,
        },
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "file_b64" in data
    assert data["filename"] == "shopify_with_additions.csv"

    decoded = base64.b64decode(data["file_b64"])
    df = pd.read_csv(io.BytesIO(decoded), dtype=str)
    assert "SKU999" in df["Variant SKU"].values
    assert df[df["Variant SKU"] == "SKU999"]["Variant Inventory Qty"].values[0] == "10"

def test_add_products_no_mapping_returns_422(client, user_token):
    _upload_template(client, user_token)
    sync_data = _do_sync(client, user_token)

    r = client.post(
        "/api/sync/add-products",
        json={
            "file_b64": sync_data["file_b64"],
            "format": "csv",
            "selected_rows": [{"codice": "SKU999"}],
        },
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 422

def test_add_products_requires_auth(client):
    r = client.post(
        "/api/sync/add-products",
        json={"file_b64": "x", "format": "csv", "selected_rows": []},
    )
    assert r.status_code == 403
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
pytest tests/test_add_products.py -v
```

Expected: FAIL — "404 Not Found" (route doesn't exist yet).

- [ ] **Step 3: Add add-products endpoint to sync.py**

Add these imports at the top of `backend/app/routers/sync.py`:

```python
from app.schemas import AddProductsRequest
from services.file_processor import read_file_from_bytes, write_file
```

Then append this endpoint after the existing `sync` function:

```python
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
    return {
        "file_b64": base64.b64encode(output_bytes).decode(),
        "filename": f"shopify_with_additions.{body.format}",
    }
```

- [ ] **Step 4: Run add-products tests**

```bash
cd backend
pytest tests/test_add_products.py -v
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
cd backend
pytest -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/sync.py backend/tests/test_add_products.py
git commit -m "feat: add POST /api/sync/add-products endpoint"
```

---

## Task 6: Frontend types + api.service

**Files:**
- Modify: `frontend/src/app/core/models/types.ts`
- Modify: `frontend/src/app/core/services/api.service.ts`

- [ ] **Step 1: Update types.ts**

Replace `frontend/src/app/core/models/types.ts` with:

```typescript
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
}

export interface AddProductsResponse {
  file_b64: string;
  filename: string;
}
```

- [ ] **Step 2: Update api.service.ts**

Replace `frontend/src/app/core/services/api.service.ts` with:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, TemplateInfo, SyncResult, MappingConfig, AddProductsResponse, MaestroRow } from '../models/types';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  uploadTemplate(file: File): Observable<TemplateInfo> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<TemplateInfo>('/api/shopify-template', form);
  }

  getTemplate(): Observable<TemplateInfo> {
    return this.http.get<TemplateInfo>('/api/shopify-template');
  }

  sync(file: File): Observable<SyncResult> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<SyncResult>('/api/sync', form);
  }

  getMapping(): Observable<MappingConfig> {
    return this.http.get<MappingConfig>('/api/mapping');
  }

  saveMapping(mappings: Record<string, string>): Observable<void> {
    return this.http.put<void>('/api/mapping', { mappings });
  }

  addProducts(fileb64: string, format: string, selectedRows: MaestroRow[]): Observable<AddProductsResponse> {
    return this.http.post<AddProductsResponse>('/api/sync/add-products', {
      file_b64: fileb64,
      format,
      selected_rows: selectedRows,
    });
  }

  createUser(email: string, password: string, is_admin: boolean): Observable<User> {
    return this.http.post<User>('/admin/users', { email, password, is_admin });
  }

  listUsers(): Observable<User[]> {
    return this.http.get<User[]>('/admin/users');
  }
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/core/models/types.ts frontend/src/app/core/services/api.service.ts
git commit -m "feat: update frontend types and api.service for mapping + add-products"
```

---

## Task 7: Settings mapping component + route

**Files:**
- Create: `frontend/src/app/features/settings/settings-mapping.component.ts`
- Modify: `frontend/src/app/app.routes.ts`

- [ ] **Step 1: Create settings-mapping.component.ts**

Create `frontend/src/app/features/settings/settings-mapping.component.ts`:

```typescript
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { MappingConfig } from '../../core/models/types';

@Component({
  selector: 'app-settings-mapping',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <a routerLink="/dashboard" class="back-link">← Dashboard</a>
        <h1>Mapping colonne</h1>
        <p class="desc">Associa le colonne del file Maestro alle colonne del template Shopify.<br>Usato quando aggiungi nuovi prodotti all'export.</p>
      </div>

      @if (loading()) {
        <div class="state-msg">Caricamento...</div>
      } @else if (notReady()) {
        <div class="state-msg warn">Carica prima un template Shopify dalla dashboard.</div>
      } @else if (noMaestroYet()) {
        <div class="state-msg warn">Esegui almeno una sincronizzazione per rilevare le colonne Maestro.</div>
      } @else {
        <div class="mapping-card">
          <table class="mapping-table">
            <thead>
              <tr>
                <th>Colonna Shopify</th>
                <th>Colonna Maestro</th>
              </tr>
            </thead>
            <tbody>
              @for (sc of config()!.shopify_columns; track sc) {
                <tr>
                  <td class="shopify-col">{{ sc }}</td>
                  <td>
                    <select [(ngModel)]="localMappings[sc]" class="col-select">
                      <option value="">—</option>
                      @for (mc of config()!.maestro_columns; track mc) {
                        <option [value]="mc">{{ mc }}</option>
                      }
                    </select>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="actions">
            @if (saveError()) {
              <span class="error-msg">{{ saveError() }}</span>
            }
            @if (saveOk()) {
              <span class="ok-msg">Mapping salvato</span>
            }
            <button class="btn-save" (click)="save()" [disabled]="saving()">
              @if (saving()) { Salvataggio... } @else { Salva mapping }
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page {
      max-width: 640px;
      margin: 40px auto;
      padding: 0 16px;
      font-family: var(--font-body);
    }

    .page-header { margin-bottom: 28px; }

    .back-link {
      display: inline-block;
      font-size: 13px;
      color: var(--text-muted);
      text-decoration: none;
      margin-bottom: 12px;
    }
    .back-link:hover { color: var(--text); }

    h1 {
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .desc { font-size: 13px; color: var(--text-muted); line-height: 1.5; }

    .state-msg {
      font-size: 14px;
      color: var(--text-muted);
      padding: 20px 0;
    }
    .state-msg.warn { color: var(--danger); }

    .mapping-card {
      background: var(--surface);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .mapping-table { width: 100%; border-collapse: collapse; }

    th {
      background: var(--bg);
      padding: 10px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }

    td { padding: 8px 16px; border-bottom: 1px solid var(--border); }
    tr:last-child td { border-bottom: none; }

    .shopify-col {
      font-family: var(--font-mono);
      font-size: 13px;
      width: 50%;
    }

    .col-select {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-family: var(--font-body);
      background: var(--bg);
      color: var(--text);
      cursor: pointer;
    }
    .col-select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }

    .actions {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-top: 1px solid var(--border);
      justify-content: flex-end;
    }

    .btn-save {
      padding: 9px 20px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 14px;
      font-weight: 600;
      font-family: var(--font-body);
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-save:hover:not(:disabled) { background: var(--accent-dark); }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

    .error-msg { font-size: 13px; color: var(--danger); }
    .ok-msg { font-size: 13px; color: var(--success); }
  `],
})
export class SettingsMappingComponent implements OnInit {
  config = signal<MappingConfig | null>(null);
  loading = signal(true);
  notReady = signal(false);
  noMaestroYet = signal(false);
  saving = signal(false);
  saveError = signal('');
  saveOk = signal(false);
  localMappings: Record<string, string> = {};

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getMapping().subscribe({
      next: cfg => {
        this.config.set(cfg);
        this.localMappings = { ...cfg.mappings };
        this.noMaestroYet.set(cfg.maestro_columns.length === 0);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        if (err.status === 404) this.notReady.set(true);
      },
    });
  }

  save() {
    this.saving.set(true);
    this.saveError.set('');
    this.saveOk.set(false);
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.localMappings)) {
      if (v) clean[k] = v;
    }
    this.api.saveMapping(clean).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveOk.set(true);
        setTimeout(() => this.saveOk.set(false), 3000);
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Errore nel salvataggio');
      },
    });
  }
}
```

- [ ] **Step 2: Add /settings route to app.routes.ts**

Replace `frontend/src/app/app.routes.ts` with:

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings-mapping.component').then(m => m.SettingsMappingComponent),
    canActivate: [authGuard],
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/settings/settings-mapping.component.ts frontend/src/app/app.routes.ts
git commit -m "feat: add /settings route with column mapping UI"
```

---

## Task 8: Update daily-sync-card with Maestro table

**Files:**
- Modify: `frontend/src/app/features/dashboard/daily-sync-card.component.ts`

- [ ] **Step 1: Replace daily-sync-card.component.ts**

Replace the full file with the version below. Key changes: add `maestroFilter`, `filteredRows`, `selectedIndices` signals; new template section; modified `download()`.

```typescript
import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { SyncResult, MaestroRow } from '../../core/models/types';

@Component({
  selector: 'app-daily-sync-card',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="card">
      <div class="card-header">
        <h2>Sincronizzazione</h2>
        <p class="card-desc">Carica il file Maestro per aggiornare le giacenze Shopify</p>
      </div>

      <input type="file" accept=".csv,.xls,.xlsx" (change)="onFile($event)" #si hidden />

      <button class="btn-primary" (click)="si.click()" [disabled]="syncing()">
        @if (syncing()) {
          <span class="spinner"></span>
          Elaborazione...
        } @else {
          Carica file Maestro
        }
      </button>

      @if (error()) {
        <div class="error-box">{{ error() }}</div>
      }

      @if (result()) {
        <div class="result-section">
          <div class="result-summary">
            <div class="stat-chip success">
              <span class="stat-num">{{ result()!.matched.length }}</span>
              <span class="stat-label">aggiornati</span>
            </div>
            <div class="stat-chip" [class.danger]="result()!.unmatched.length > 0" [class.success]="result()!.unmatched.length === 0">
              <span class="stat-num">{{ result()!.unmatched.length }}</span>
              <span class="stat-label">non trovati</span>
            </div>
            <button class="btn-download" (click)="download()" [disabled]="downloading()">
              @if (downloading()) { ... }
              @else if (selectedIndices().size > 0) { Scarica ({{ selectedIndices().size }} aggiunte) }
              @else { Scarica }
            </button>
          </div>

          @if (downloadError()) {
            <div class="error-box">{{ downloadError() }}</div>
          }

          <div class="result-tabs">
            <button class="result-tab" [class.active]="resultTab() === 'matched'" (click)="resultTab.set('matched')">
              Aggiornati ({{ result()!.matched.length }})
            </button>
            <button class="result-tab" [class.active]="resultTab() === 'unmatched'" (click)="resultTab.set('unmatched')">
              Non trovati ({{ result()!.unmatched.length }})
            </button>
          </div>

          @if (resultTab() === 'matched') {
            <div class="table-wrap">
              @if (result()!.matched.length === 0) {
                <div class="empty-tab">Nessuno SKU aggiornato</div>
              } @else {
                <table>
                  <thead>
                    <tr><th>SKU</th><th class="num">Prec.</th><th class="num">Nuova</th></tr>
                  </thead>
                  <tbody>
                    @for (row of result()!.matched; track row.sku) {
                      <tr [class.changed]="row.old_qty !== row.new_qty">
                        <td class="mono">{{ row.sku }}</td>
                        <td class="mono num muted">{{ row.old_qty }}</td>
                        <td class="mono num bold">{{ row.new_qty }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          } @else {
            <div class="table-wrap">
              @if (result()!.unmatched.length === 0) {
                <div class="empty-tab success-msg">Tutti gli SKU trovati in Maestro</div>
              } @else {
                <table>
                  <thead>
                    <tr><th>SKU non trovati in Maestro</th></tr>
                  </thead>
                  <tbody>
                    @for (sku of result()!.unmatched; track sku) {
                      <tr><td class="mono">{{ sku }}</td></tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          }
        </div>

        <!-- Maestro product selection section -->
        <div class="maestro-section">
          <div class="maestro-header">
            <div class="maestro-title-row">
              <h3>Aggiungi prodotti da Maestro</h3>
              <a routerLink="/settings" class="mapping-link">Configura mapping colonne</a>
            </div>
            <div class="maestro-controls">
              <input
                class="sku-filter"
                type="text"
                placeholder="Filtra SKU: SKU001;SKU002;SKU003"
                [ngModel]="maestroFilter()"
                (ngModelChange)="maestroFilter.set($event)"
              />
              <button class="btn-select-all" (click)="selectAll()">
                Seleziona tutto ({{ filteredRows().length }})
              </button>
              @if (selectedIndices().size > 0) {
                <button class="btn-clear" (click)="clearSelection()">Deseleziona tutto</button>
              }
            </div>
          </div>

          <div class="table-wrap maestro-table-wrap">
            @if (result()!.maestro_rows.length === 0) {
              <div class="empty-tab">Nessuna riga nel file Maestro</div>
            } @else if (filteredRows().length === 0) {
              <div class="empty-tab">Nessuna riga corrisponde al filtro</div>
            } @else {
              <table>
                <thead>
                  <tr>
                    <th class="cb-col"></th>
                    @for (col of maestroColumns(); track col) {
                      <th>{{ col }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (entry of filteredRows(); track entry.idx) {
                    <tr [class.selected-row]="selectedIndices().has(entry.idx)" (click)="toggleRow(entry.idx)">
                      <td class="cb-col">
                        <input type="checkbox" [checked]="selectedIndices().has(entry.idx)" (click)="$event.stopPropagation()" (change)="toggleRow(entry.idx)" />
                      </td>
                      @for (col of maestroColumns(); track col) {
                        <td class="mono">{{ entry.row[col] }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .card {
      background: var(--surface);
      border-radius: var(--radius);
      padding: 24px;
      box-shadow: var(--shadow);
    }

    .card-header { margin-bottom: 20px; }

    h2 {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .card-desc { font-size: 13px; color: var(--text-muted); }

    .btn-primary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 13px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 15px;
      font-weight: 600;
      font-family: var(--font-body);
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
    }

    .btn-primary:hover:not(:disabled) { background: var(--accent-dark); }
    .btn-primary:active:not(:disabled) { transform: scale(0.99); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .error-box {
      background: var(--danger-bg);
      color: var(--danger);
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      font-size: 14px;
      margin-top: 12px;
    }

    .result-section { margin-top: 20px; }

    .result-summary {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .stat-chip {
      display: flex;
      align-items: baseline;
      gap: 5px;
      padding: 6px 12px;
      border-radius: 100px;
      flex-shrink: 0;
    }

    .stat-chip.success { background: var(--success-bg); color: var(--success); }
    .stat-chip.danger { background: var(--danger-bg); color: var(--danger); }

    .stat-num { font-family: var(--font-mono); font-size: 16px; font-weight: 500; }
    .stat-label { font-size: 12px; }

    .btn-download {
      margin-left: auto;
      padding: 7px 16px;
      background: var(--text);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 600;
      font-family: var(--font-body);
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn-download:hover:not(:disabled) { opacity: 0.82; }
    .btn-download:disabled { opacity: 0.5; cursor: not-allowed; }

    .result-tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
    }

    .result-tab {
      padding: 8px 14px 10px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      font-size: 13px;
      font-weight: 500;
      font-family: var(--font-body);
      color: var(--text-muted);
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
      margin-bottom: -1px;
    }

    .result-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

    .table-wrap {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 var(--radius-sm) var(--radius-sm);
    }

    table { width: 100%; border-collapse: collapse; font-size: 13px; }

    thead { position: sticky; top: 0; z-index: 1; }

    th {
      background: var(--bg);
      padding: 9px 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }

    td { padding: 8px 12px; border-bottom: 1px solid #F5F2EE; }
    tr:last-child td { border-bottom: none; }
    tr.changed td { background: #FFFBF2; }

    .mono { font-family: var(--font-mono); }
    .num { text-align: right; }
    .muted { color: var(--text-muted); }
    .bold { font-weight: 500; color: var(--text); }

    .empty-tab {
      padding: 24px;
      text-align: center;
      font-size: 14px;
      color: var(--text-muted);
    }

    .success-msg { color: var(--success); }

    /* Maestro section */
    .maestro-section {
      margin-top: 28px;
      border-top: 1px solid var(--border);
      padding-top: 20px;
    }

    .maestro-header { margin-bottom: 12px; }

    .maestro-title-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    h3 {
      font-family: var(--font-display);
      font-size: 15px;
      font-weight: 700;
    }

    .mapping-link {
      font-size: 12px;
      color: var(--accent);
      text-decoration: none;
    }
    .mapping-link:hover { text-decoration: underline; }

    .maestro-controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }

    .sku-filter {
      flex: 1;
      min-width: 200px;
      padding: 7px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-family: var(--font-mono);
      background: var(--bg);
      color: var(--text);
    }
    .sku-filter:focus { outline: 2px solid var(--accent); outline-offset: 1px; }

    .btn-select-all, .btn-clear {
      padding: 7px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 600;
      font-family: var(--font-body);
      cursor: pointer;
      background: var(--surface);
      color: var(--text);
      white-space: nowrap;
      transition: background 0.12s;
    }
    .btn-select-all:hover { background: var(--bg); }
    .btn-clear { color: var(--danger); border-color: var(--danger); }
    .btn-clear:hover { background: var(--danger-bg); }

    .maestro-table-wrap {
      max-height: 400px;
      border-top: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }

    .cb-col { width: 36px; text-align: center; padding: 8px 4px; }

    tr.selected-row td { background: #F0F4FF; }
    tr { cursor: pointer; }
    tr:hover td { background: var(--bg); }
    tr.selected-row:hover td { background: #E8EEFF; }
  `],
})
export class DailySyncCardComponent {
  syncing = signal(false);
  downloading = signal(false);
  result = signal<SyncResult | null>(null);
  error = signal('');
  downloadError = signal('');
  resultTab = signal<'matched' | 'unmatched'>('matched');
  maestroFilter = signal('');
  selectedIndices = signal<Set<number>>(new Set());

  maestroColumns = computed(() => {
    const rows = this.result()?.maestro_rows ?? [];
    if (rows.length === 0) return [];
    return Object.keys(rows[0]);
  });

  filteredRows = computed(() => {
    const rows = this.result()?.maestro_rows ?? [];
    const skuCol = this.result()?.maestro_sku_col ?? '';
    const filter = this.maestroFilter().trim();
    const indexed = rows.map((row, idx) => ({ row, idx }));
    if (!filter) return indexed;
    const skus = filter.split(';').map(s => s.trim().toLowerCase()).filter(Boolean);
    return indexed.filter(({ row }) => skus.includes((row[skuCol] ?? '').toLowerCase()));
  });

  constructor(private api: ApiService) {}

  onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.syncing.set(true);
    this.error.set('');
    this.result.set(null);
    this.selectedIndices.set(new Set());
    this.maestroFilter.set('');

    this.api.sync(file).subscribe({
      next: res => {
        this.result.set(res);
        this.resultTab.set('matched');
        this.syncing.set(false);
      },
      error: err => {
        const detail = err.error?.detail;
        this.error.set(typeof detail === 'object' ? detail.message : (detail || 'Errore sync'));
        this.syncing.set(false);
      },
    });
  }

  toggleRow(idx: number) {
    const s = new Set(this.selectedIndices());
    if (s.has(idx)) s.delete(idx); else s.add(idx);
    this.selectedIndices.set(s);
  }

  selectAll() {
    const s = new Set(this.selectedIndices());
    for (const { idx } of this.filteredRows()) s.add(idx);
    this.selectedIndices.set(s);
  }

  clearSelection() {
    this.selectedIndices.set(new Set());
  }

  download() {
    const res = this.result();
    if (!res) return;

    const selected = this.selectedIndices();
    if (selected.size === 0) {
      this._triggerDownload(res.file_b64, res.filename);
      return;
    }

    const selectedRows = res.maestro_rows.filter((_, i) => selected.has(i));
    this.downloading.set(true);
    this.downloadError.set('');

    this.api.addProducts(res.file_b64, res.format, selectedRows).subscribe({
      next: data => {
        this.downloading.set(false);
        this._triggerDownload(data.file_b64, data.filename);
      },
      error: err => {
        this.downloading.set(false);
        const detail = err.error?.detail;
        this.downloadError.set(typeof detail === 'string' ? detail : 'Errore durante l\'aggiunta dei prodotti. Configura il mapping in /settings.');
      },
    });
  }

  private _triggerDownload(b64: string, filename: string) {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/features/dashboard/daily-sync-card.component.ts
git commit -m "feat: add Maestro product selection table with filter and checkboxes to sync card"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend
pytest -v
```

Expected: all tests pass.

- [ ] **Step 2: Build frontend**

```bash
cd frontend
npm run build:prod
```

Expected: build completes with 0 errors.

- [ ] **Step 3: Smoke test backend serving Angular**

```bash
cd backend
uvicorn main:app
```

Open `http://localhost:8000`. Verify:
1. Login works
2. Upload Shopify template → upload Maestro CSV → sync result shows
3. Maestro table appears below sync results with checkboxes
4. SKU filter (e.g. `SKU001;SKU002`) narrows the table
5. "Seleziona tutto" selects all visible rows
6. "Scarica" with selections calls add-products; without selections downloads directly
7. Navigate to `/settings` → mapping table shows Shopify columns + Maestro column dropdowns
8. Save mapping → returns to dashboard → select rows → download → verify new rows in output file

- [ ] **Step 4: Commit build output if applicable**

```bash
git add backend/static
git commit -m "build: production Angular build with Maestro product selection"
```

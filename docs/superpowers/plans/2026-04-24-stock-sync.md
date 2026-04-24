# Stock Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-user web app dove ogni utente carica il template Shopify (CSV/XLS), poi giornalmente carica il CSV Maestro e scarica il file Shopify aggiornato con sole le giacenze sincronizzate per SKU.

**Architecture:** FastAPI backend gestisce auth JWT, storage file su filesystem, elaborazione pandas. Angular 19 standalone frontend. PostgreSQL su Railway. Un unico Railway service serve API + static build Angular.

**Tech Stack:** Python 3.12, FastAPI 0.115, SQLAlchemy 2.0, pandas 2.2, openpyxl 3.1, python-jose, passlib; Angular 19 standalone components + signals; PostgreSQL; Railway.

---

## File Structure

```
update-stocks/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── pyproject.toml
│   ├── .env.example
│   ├── seed_admin.py
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── auth.py
│   │   ├── dependencies.py
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── admin.py
│   │       ├── shopify.py
│   │       └── sync.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── file_processor.py
│   └── tests/
│       ├── conftest.py
│       ├── test_auth.py
│       ├── test_admin.py
│       ├── test_file_processor.py
│       ├── test_shopify.py
│       └── test_sync.py
└── frontend/
    ├── angular.json  (generato da ng new)
    ├── package.json
    ├── proxy.conf.json
    ├── tsconfig.json
    └── src/
        ├── main.ts
        └── app/
            ├── app.component.ts
            ├── app.config.ts
            ├── app.routes.ts
            ├── core/
            │   ├── models/types.ts
            │   ├── services/auth.service.ts
            │   ├── services/api.service.ts
            │   ├── guards/auth.guard.ts
            │   ├── guards/admin.guard.ts
            │   └── interceptors/auth.interceptor.ts
            └── features/
                ├── login/login.component.ts
                ├── dashboard/dashboard.component.ts
                ├── dashboard/shopify-template-card.component.ts
                ├── dashboard/daily-sync-card.component.ts
                └── admin/admin.component.ts
```

---

## Task 1: Backend scaffolding

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pyproject.toml`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/services/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`
- Create: `backend/main.py`

- [ ] **Step 1: Crea `backend/requirements.txt`**

```
fastapi==0.115.5
uvicorn[standard]==0.32.1
sqlalchemy==2.0.36
psycopg2-binary==2.9.10
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.17
pandas==2.2.3
openpyxl==3.1.5
pydantic-settings==2.7.0
pytest==8.3.4
httpx==0.28.1
```

- [ ] **Step 2: Crea `backend/pyproject.toml`**

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 3: Crea `backend/.env.example`**

```
DATABASE_URL=postgresql://user:password@localhost:5432/stocksync
JWT_SECRET=change-this-to-a-long-random-string
UPLOAD_DIR=/data/uploads
FIRST_ADMIN_EMAIL=admin@example.com
FIRST_ADMIN_PASSWORD=change-me
CORS_ORIGINS=*
```

- [ ] **Step 4: Crea `backend/app/config.py`**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    upload_dir: str = "/data/uploads"
    first_admin_email: str = ""
    first_admin_password: str = ""
    cors_origins: str = "*"

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 5: Crea `backend/app/database.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 6: Crea `backend/app/__init__.py`, `backend/app/routers/__init__.py`, `backend/services/__init__.py`** (tutti vuoti)

- [ ] **Step 7: Crea `backend/main.py`**

```python
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine
from app import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Stock Sync")

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Unmatched-SKUs"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

# Routers aggiunti nei task successivi
```

- [ ] **Step 8: Installa dipendenze e verifica avvio**

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Modifica .env con DATABASE_URL reale (o usa SQLite per sviluppo locale)
# DATABASE_URL=sqlite:///./dev.db
uvicorn main:app --reload
```

Atteso: `GET /health` → `{"status": "ok"}`

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat: backend project scaffolding"
```

---

## Task 2: DB models + schemas

**Files:**
- Create: `backend/app/models.py`
- Create: `backend/app/schemas.py`

- [ ] **Step 1: Crea `backend/app/models.py`**

```python
import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Enum as SAEnum
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    template: Mapped["ShopifyTemplate"] = relationship(back_populates="user", uselist=False)

class ShopifyTemplate(Base):
    __tablename__ = "shopify_templates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String)
    filepath: Mapped[str] = mapped_column(String)
    format: Mapped[FileFormat] = mapped_column(SAEnum(FileFormat))
    sku_column: Mapped[str] = mapped_column(String)
    qty_column: Mapped[str] = mapped_column(String)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="template")
```

- [ ] **Step 2: Crea `backend/app/schemas.py`**

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
```

- [ ] **Step 3: Riavvia uvicorn e verifica che le tabelle vengano create senza errori**

```bash
uvicorn main:app --reload
```

Atteso: nessun errore, tabelle `users` e `shopify_templates` create nel DB.

- [ ] **Step 4: Commit**

```bash
git add backend/app/models.py backend/app/schemas.py
git commit -m "feat: DB models and pydantic schemas"
```

---

## Task 3: Auth utilities

**Files:**
- Create: `backend/app/auth.py`
- Create: `backend/app/dependencies.py`

- [ ] **Step 1: Crea `backend/app/auth.py`**

```python
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str, is_admin: bool) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": user_id, "is_admin": is_admin, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
```

- [ ] **Step 2: Crea `backend/app/dependencies.py`**

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError
from app.database import get_db
from app import models
from app.auth import decode_token

bearer = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> models.User:
    try:
        payload = decode_token(credentials.credentials)
        user_id: str = payload["sub"]
    except (JWTError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def get_admin_user(user: models.User = Depends(get_current_user)) -> models.User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    return user
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/auth.py backend/app/dependencies.py
git commit -m "feat: JWT auth utilities and FastAPI dependencies"
```

---

## Task 4: Auth endpoint (login)

**Files:**
- Create: `backend/app/routers/auth.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_auth.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Crea `backend/tests/conftest.py`**

```python
import os
import tempfile

_upload_dir = tempfile.mkdtemp()
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest")
os.environ.setdefault("UPLOAD_DIR", _upload_dir)
os.environ.setdefault("FIRST_ADMIN_EMAIL", "")
os.environ.setdefault("FIRST_ADMIN_PASSWORD", "")
os.environ.setdefault("CORS_ORIGINS", "*")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from main import app

engine = create_engine("sqlite:///./test.db", connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db(setup_db):
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client(db):
    def override():
        yield db
    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def admin_user(db):
    from app.models import User
    from app.auth import hash_password
    u = User(email="admin@test.com", password_hash=hash_password("secret"), is_admin=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u

@pytest.fixture
def regular_user(db):
    from app.models import User
    from app.auth import hash_password
    u = User(email="user@test.com", password_hash=hash_password("secret"), is_admin=False)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u

@pytest.fixture
def admin_token(client, admin_user):
    r = client.post("/auth/login", json={"email": "admin@test.com", "password": "secret"})
    return r.json()["access_token"]

@pytest.fixture
def user_token(client, regular_user):
    r = client.post("/auth/login", json={"email": "user@test.com", "password": "secret"})
    return r.json()["access_token"]
```

- [ ] **Step 2: Crea `backend/tests/test_auth.py`**

```python
def test_login_success(client, admin_user):
    r = client.post("/auth/login", json={"email": "admin@test.com", "password": "secret"})
    assert r.status_code == 200
    assert "access_token" in r.json()

def test_login_wrong_password(client, admin_user):
    r = client.post("/auth/login", json={"email": "admin@test.com", "password": "wrong"})
    assert r.status_code == 401

def test_login_unknown_email(client):
    r = client.post("/auth/login", json={"email": "nobody@test.com", "password": "x"})
    assert r.status_code == 401
```

- [ ] **Step 3: Esegui test — devono fallire (router non esiste)**

```bash
cd backend && pytest tests/test_auth.py -v
```

Atteso: `FAILED` — `404` o `AttributeError`

- [ ] **Step 4: Crea `backend/app/routers/auth.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=schemas.Token)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return schemas.Token(access_token=create_access_token(user.id, user.is_admin))
```

- [ ] **Step 5: Aggiungi router a `backend/main.py`**

Dopo `@app.get("/health")` aggiungi:

```python
from app.routers import auth as auth_router
app.include_router(auth_router.router)
```

- [ ] **Step 6: Esegui test — devono passare**

```bash
cd backend && pytest tests/test_auth.py -v
```

Atteso: `3 passed`

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/auth.py backend/tests/ backend/main.py
git commit -m "feat: login endpoint with JWT"
```

---

## Task 5: Admin endpoints

**Files:**
- Create: `backend/app/routers/admin.py`
- Create: `backend/tests/test_admin.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Crea `backend/tests/test_admin.py`**

```python
def test_create_user(client, admin_token):
    r = client.post(
        "/admin/users",
        json={"email": "new@test.com", "password": "pass123"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    assert r.json()["email"] == "new@test.com"
    assert r.json()["is_admin"] is False

def test_create_admin_user(client, admin_token):
    r = client.post(
        "/admin/users",
        json={"email": "newadmin@test.com", "password": "pass", "is_admin": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    assert r.json()["is_admin"] is True

def test_create_user_duplicate_email(client, admin_token, admin_user):
    r = client.post(
        "/admin/users",
        json={"email": "admin@test.com", "password": "x"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 409

def test_create_user_requires_admin(client, user_token):
    r = client.post(
        "/admin/users",
        json={"email": "x@test.com", "password": "x"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 403

def test_list_users(client, admin_token, admin_user, regular_user):
    r = client.get("/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert len(r.json()) == 2
```

- [ ] **Step 2: Esegui test — devono fallire**

```bash
cd backend && pytest tests/test_admin.py -v
```

Atteso: `FAILED` — `404`

- [ ] **Step 3: Crea `backend/app/routers/admin.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import hash_password
from app.dependencies import get_admin_user

router = APIRouter(prefix="/admin", tags=["admin"])

@router.post("/users", response_model=schemas.UserResponse, status_code=201)
def create_user(
    body: schemas.UserCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    user = models.User(
        email=body.email,
        password_hash=hash_password(body.password),
        is_admin=body.is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.get("/users", response_model=list[schemas.UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    return db.query(models.User).all()
```

- [ ] **Step 4: Aggiungi router a `backend/main.py`**

```python
from app.routers import admin as admin_router
app.include_router(admin_router.router)
```

- [ ] **Step 5: Esegui test — devono passare**

```bash
cd backend && pytest tests/test_admin.py -v
```

Atteso: `5 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/admin.py backend/tests/test_admin.py backend/main.py
git commit -m "feat: admin endpoints for user management"
```

---

## Task 6: File processor (logica core)

**Files:**
- Create: `backend/services/file_processor.py`
- Create: `backend/tests/test_file_processor.py`

- [ ] **Step 1: Crea `backend/tests/test_file_processor.py`**

```python
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
    df = pd.read_csv(io.BytesIO(output))
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
```

- [ ] **Step 2: Esegui test — devono fallire**

```bash
cd backend && pytest tests/test_file_processor.py -v
```

Atteso: `FAILED` — `ModuleNotFoundError`

- [ ] **Step 3: Crea `backend/services/file_processor.py`**

```python
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
) -> tuple[bytes, int]:
    shopify_df = read_file(shopify_path, shopify_fmt)
    maestro_df = pd.read_csv(io.BytesIO(maestro_bytes), dtype=str)

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
```

- [ ] **Step 4: Esegui test — devono passare**

```bash
cd backend && pytest tests/test_file_processor.py -v
```

Atteso: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/services/file_processor.py backend/tests/test_file_processor.py
git commit -m "feat: file processor service with SKU matching logic"
```

---

## Task 7: Shopify template endpoints

**Files:**
- Create: `backend/app/routers/shopify.py`
- Create: `backend/tests/test_shopify.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Crea `backend/tests/test_shopify.py`**

```python
import io

SHOPIFY_CSV = b"Handle,Variant SKU,Variant Inventory Qty\nprod1,SKU001,10\n"

def test_upload_template_csv(client, user_token):
    r = client.post(
        "/api/shopify-template",
        files={"file": ("shopify.csv", io.BytesIO(SHOPIFY_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["filename"] == "shopify.csv"
    assert data["sku_column"] == "Variant SKU"
    assert data["qty_column"] == "Variant Inventory Qty"

def test_upload_template_replaces_existing(client, user_token):
    for _ in range(2):
        client.post(
            "/api/shopify-template",
            files={"file": ("shopify.csv", io.BytesIO(SHOPIFY_CSV), "text/csv")},
            headers={"Authorization": f"Bearer {user_token}"},
        )
    r = client.get("/api/shopify-template", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 200  # only one template

def test_get_template_not_found(client, user_token):
    r = client.get("/api/shopify-template", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 404

def test_get_template_after_upload(client, user_token):
    client.post(
        "/api/shopify-template",
        files={"file": ("shopify.csv", io.BytesIO(SHOPIFY_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    r = client.get("/api/shopify-template", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 200
    assert r.json()["filename"] == "shopify.csv"

def test_upload_unsupported_format(client, user_token):
    r = client.post(
        "/api/shopify-template",
        files={"file": ("file.txt", io.BytesIO(b"hello"), "text/plain")},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 400

def test_upload_requires_auth(client):
    r = client.post(
        "/api/shopify-template",
        files={"file": ("shopify.csv", io.BytesIO(SHOPIFY_CSV), "text/csv")},
    )
    assert r.status_code == 403
```

- [ ] **Step 2: Esegui test — devono fallire**

```bash
cd backend && pytest tests/test_shopify.py -v
```

Atteso: `FAILED` — `404`

- [ ] **Step 3: Crea `backend/app/routers/shopify.py`**

```python
import io
import os
from datetime import datetime
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
        template.uploaded_at = datetime.utcnow()
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
```

- [ ] **Step 4: Aggiungi router a `backend/main.py`**

```python
from app.routers import shopify as shopify_router
app.include_router(shopify_router.router)
```

- [ ] **Step 5: Esegui test — devono passare**

```bash
cd backend && pytest tests/test_shopify.py -v
```

Atteso: `6 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/shopify.py backend/tests/test_shopify.py backend/main.py
git commit -m "feat: shopify template upload and retrieval endpoints"
```

---

## Task 8: Sync endpoint

**Files:**
- Create: `backend/app/routers/sync.py`
- Create: `backend/tests/test_sync.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Crea `backend/tests/test_sync.py`**

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
    assert r.headers["X-Unmatched-SKUs"] == "1"  # SKU002 non in Maestro
    df = pd.read_csv(io.BytesIO(r.content))
    assert df[df["Variant SKU"] == "SKU001"]["Variant Inventory Qty"].values[0] == "42"
    assert df[df["Variant SKU"] == "SKU002"]["Variant Inventory Qty"].values[0] == "3"

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

- [ ] **Step 2: Esegui test — devono fallire**

```bash
cd backend && pytest tests/test_sync.py -v
```

Atteso: `FAILED` — `404`

- [ ] **Step 3: Crea `backend/app/routers/sync.py`**

```python
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
```

- [ ] **Step 4: Aggiungi router a `backend/main.py`**

```python
from app.routers import sync as sync_router
app.include_router(sync_router.router)
```

- [ ] **Step 5: Esegui tutti i test**

```bash
cd backend && pytest -v
```

Atteso: tutti passano (≥ 20 test)

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/sync.py backend/tests/test_sync.py backend/main.py
git commit -m "feat: daily sync endpoint with quantity matching"
```

---

## Task 9: Admin seed script

**Files:**
- Create: `backend/seed_admin.py`

- [ ] **Step 1: Crea `backend/seed_admin.py`**

```python
"""
Crea il primo utente admin se non esiste.
Usa le env vars FIRST_ADMIN_EMAIL e FIRST_ADMIN_PASSWORD.
Esegui: python seed_admin.py
"""
from app.database import engine, SessionLocal
from app import models
from app.auth import hash_password
from app.config import settings

models.Base.metadata.create_all(bind=engine)

if not settings.first_admin_email or not settings.first_admin_password:
    print("Set FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD in .env")
    raise SystemExit(1)

db = SessionLocal()
try:
    existing = db.query(models.User).filter(models.User.email == settings.first_admin_email).first()
    if existing:
        print(f"Admin già esistente: {settings.first_admin_email}")
    else:
        admin = models.User(
            email=settings.first_admin_email,
            password_hash=hash_password(settings.first_admin_password),
            is_admin=True,
        )
        db.add(admin)
        db.commit()
        print(f"Admin creato: {settings.first_admin_email}")
finally:
    db.close()
```

- [ ] **Step 2: Verifica esecuzione**

```bash
cd backend
# Assicurati che .env abbia FIRST_ADMIN_EMAIL e FIRST_ADMIN_PASSWORD valorizzati
python seed_admin.py
```

Atteso: `Admin creato: admin@example.com`

- [ ] **Step 3: Commit**

```bash
git add backend/seed_admin.py
git commit -m "feat: admin seed script"
```

---

## Task 10: Angular project setup

**Files:**
- Create: `frontend/` (via ng new)
- Modify: `frontend/src/app/app.component.ts`
- Modify: `frontend/src/app/app.config.ts`
- Modify: `frontend/src/app/app.routes.ts`
- Create: `frontend/proxy.conf.json`

- [ ] **Step 1: Scaffold Angular 19**

```bash
cd update-stocks
npx @angular/cli@19 new frontend --standalone --routing --style=css --skip-tests --skip-git --ssr=false
```

- [ ] **Step 2: Sostituisci `frontend/src/app/app.component.ts`**

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {}
```

- [ ] **Step 3: Sostituisci `frontend/src/app/app.routes.ts`**

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
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
```

- [ ] **Step 4: Sostituisci `frontend/src/app/app.config.ts`**

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ],
};
```

- [ ] **Step 5: Crea `frontend/proxy.conf.json`**

```json
{
  "/auth": { "target": "http://localhost:8000", "secure": false, "changeOrigin": true },
  "/api": { "target": "http://localhost:8000", "secure": false, "changeOrigin": true },
  "/admin": { "target": "http://localhost:8000", "secure": false, "changeOrigin": true }
}
```

- [ ] **Step 6: Aggiungi proxyConfig in `frontend/angular.json`**

Trova la sezione `"serve"` e aggiorna la configurazione `development`:

```json
"development": {
  "buildTarget": "frontend:build:development",
  "proxyConfig": "proxy.conf.json"
}
```

- [ ] **Step 7: Aggiungi build:prod script in `frontend/package.json`**

Nella sezione `"scripts"`:

```json
"build:prod": "ng build --output-path=../backend/static --base-href=/"
```

- [ ] **Step 8: Commit**

```bash
cd update-stocks
git add frontend/
git commit -m "feat: Angular 19 project scaffold with routing and proxy"
```

---

## Task 11: Core services — auth, api, interceptor, guards

**Files:**
- Create: `frontend/src/app/core/models/types.ts`
- Create: `frontend/src/app/core/services/auth.service.ts`
- Create: `frontend/src/app/core/services/api.service.ts`
- Create: `frontend/src/app/core/interceptors/auth.interceptor.ts`
- Create: `frontend/src/app/core/guards/auth.guard.ts`
- Create: `frontend/src/app/core/guards/admin.guard.ts`

- [ ] **Step 1: Crea directory structure**

```bash
mkdir -p frontend/src/app/core/models
mkdir -p frontend/src/app/core/services
mkdir -p frontend/src/app/core/interceptors
mkdir -p frontend/src/app/core/guards
mkdir -p frontend/src/app/features/login
mkdir -p frontend/src/app/features/dashboard
mkdir -p frontend/src/app/features/admin
```

- [ ] **Step 2: Crea `frontend/src/app/core/models/types.ts`**

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
```

- [ ] **Step 3: Crea `frontend/src/app/core/services/auth.service.ts`**

```typescript
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Token } from '../models/types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'stock_sync_token';
  private token = signal<string | null>(localStorage.getItem(this.TOKEN_KEY));

  isLoggedIn = computed(() => !!this.token());
  isAdmin = computed(() => {
    const t = this.token();
    if (!t) return false;
    try {
      return JSON.parse(atob(t.split('.')[1]))?.is_admin ?? false;
    } catch {
      return false;
    }
  });

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string) {
    return this.http.post<Token>('/auth/login', { email, password }).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.access_token);
        this.token.set(res.access_token);
      }),
    );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    this.token.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.token();
  }
}
```

- [ ] **Step 4: Crea `frontend/src/app/core/interceptors/auth.interceptor.ts`**

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};
```

- [ ] **Step 5: Crea `frontend/src/app/core/guards/auth.guard.ts`**

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};
```

- [ ] **Step 6: Crea `frontend/src/app/core/guards/admin.guard.ts`**

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAdmin() ? true : inject(Router).createUrlTree(['/dashboard']);
};
```

- [ ] **Step 7: Crea `frontend/src/app/core/services/api.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, TemplateInfo } from '../models/types';

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

  sync(file: File): Observable<HttpResponse<Blob>> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post('/api/sync', form, {
      responseType: 'blob',
      observe: 'response',
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

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/core/
git commit -m "feat: Angular core services, guards, and auth interceptor"
```

---

## Task 12: Login component

**Files:**
- Create: `frontend/src/app/features/login/login.component.ts`

- [ ] **Step 1: Crea `frontend/src/app/features/login/login.component.ts`**

```typescript
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-wrap">
      <h1>Stock Sync</h1>
      <form (ngSubmit)="submit()">
        <input
          type="email"
          [(ngModel)]="email"
          name="email"
          placeholder="Email"
          required
          autocomplete="email"
        />
        <input
          type="password"
          [(ngModel)]="password"
          name="password"
          placeholder="Password"
          required
          autocomplete="current-password"
        />
        <button type="submit" [disabled]="loading()">
          {{ loading() ? 'Accesso in corso...' : 'Accedi' }}
        </button>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
      </form>
    </div>
  `,
  styles: [`
    .login-wrap { max-width: 360px; margin: 80px auto; padding: 32px; }
    form { display: flex; flex-direction: column; gap: 12px; }
    input { padding: 10px; font-size: 1rem; border: 1px solid #ccc; border-radius: 4px; }
    button { padding: 10px; font-size: 1rem; cursor: pointer; }
    .error { color: red; margin: 0; }
  `],
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => {
        this.error.set('Credenziali non valide');
        this.loading.set(false);
      },
    });
  }
}
```

- [ ] **Step 2: Avvia dev server e verifica `/login`**

```bash
# Terminal 1: backend
cd backend && uvicorn main:app --reload

# Terminal 2: frontend
cd frontend && ng serve
```

Apri `http://localhost:4200/login`. Verifica: form visibile, login con credenziali admin funziona, redirect a `/dashboard`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/features/login/
git commit -m "feat: login component"
```

---

## Task 13: Dashboard + ShopifyTemplateCard + DailySyncCard

**Files:**
- Create: `frontend/src/app/features/dashboard/dashboard.component.ts`
- Create: `frontend/src/app/features/dashboard/shopify-template-card.component.ts`
- Create: `frontend/src/app/features/dashboard/daily-sync-card.component.ts`

- [ ] **Step 1: Crea `frontend/src/app/features/dashboard/shopify-template-card.component.ts`**

```typescript
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { TemplateInfo } from '../../core/models/types';

@Component({
  selector: 'app-shopify-template-card',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <section class="card">
      <h2>Template Shopify</h2>
      @if (template()) {
        <p>File: <strong>{{ template()!.filename }}</strong></p>
        <p>Caricato: {{ template()!.uploaded_at | date:'dd/MM/yyyy HH:mm' }}</p>
        <p>Colonne rilevate — SKU: <code>{{ template()!.sku_column }}</code> | Quantità: <code>{{ template()!.qty_column }}</code></p>
      } @else {
        <p>Nessun template caricato. Carica il file esportato da Shopify.</p>
      }
      <input type="file" accept=".csv,.xls,.xlsx" (change)="onFile($event)" #fi hidden />
      <button (click)="fi.click()" [disabled]="uploading()">
        {{ uploading() ? 'Caricamento...' : (template() ? 'Aggiorna template' : 'Carica template Shopify') }}
      </button>
      @if (error()) { <p class="error">{{ error() }}</p> }
    </section>
  `,
  styles: [`
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
    button { padding: 8px 16px; cursor: pointer; }
    .error { color: red; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
  `],
})
export class ShopifyTemplateCardComponent implements OnInit {
  template = signal<TemplateInfo | null>(null);
  uploading = signal(false);
  error = signal('');

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getTemplate().subscribe({
      next: t => this.template.set(t),
      error: err => {
        if (err.status !== 404) this.error.set('Errore nel caricamento del template');
      },
    });
  }

  onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.error.set('');
    this.api.uploadTemplate(file).subscribe({
      next: t => { this.template.set(t); this.uploading.set(false); },
      error: err => {
        const detail = err.error?.detail;
        this.error.set(typeof detail === 'object' ? detail.message : (detail || 'Errore upload'));
        this.uploading.set(false);
      },
    });
  }
}
```

- [ ] **Step 2: Crea `frontend/src/app/features/dashboard/daily-sync-card.component.ts`**

```typescript
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-daily-sync-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="card">
      <h2>Sync Giornaliero</h2>
      <p>Carica il CSV esportato da Maestro per aggiornare le giacenze.</p>
      <input type="file" accept=".csv" (change)="onFile($event)" #si hidden />
      <button (click)="si.click()" [disabled]="syncing()">
        {{ syncing() ? 'Elaborazione...' : 'Carica CSV Maestro' }}
      </button>
      @if (result()) {
        <div class="result">
          <p>Sync completato. SKU non trovati in Maestro: <strong>{{ result()!.unmatched }}</strong></p>
          <a [href]="result()!.url" [download]="result()!.filename" class="download-btn">
            Scarica file aggiornato
          </a>
        </div>
      }
      @if (error()) { <p class="error">{{ error() }}</p> }
    </section>
  `,
  styles: [`
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 24px; }
    button { padding: 8px 16px; cursor: pointer; }
    .result { margin-top: 16px; }
    .download-btn { display: inline-block; margin-top: 8px; padding: 8px 16px; background: #0070f3; color: white; border-radius: 4px; text-decoration: none; }
    .error { color: red; }
  `],
})
export class DailySyncCardComponent {
  syncing = signal(false);
  result = signal<{ url: string; filename: string; unmatched: number } | null>(null);
  error = signal('');

  constructor(private api: ApiService) {}

  onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.syncing.set(true);
    this.error.set('');
    this.result.set(null);

    this.api.sync(file).subscribe({
      next: response => {
        const unmatched = parseInt(response.headers.get('X-Unmatched-SKUs') ?? '0', 10);
        const blob = response.body!;
        const cd = response.headers.get('Content-Disposition') ?? '';
        const match = cd.match(/filename="(.+?)"/);
        const filename = match?.[1] ?? 'shopify_updated.csv';
        this.result.set({ url: URL.createObjectURL(blob), filename, unmatched });
        this.syncing.set(false);
      },
      error: err => {
        if (err.error instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(reader.result as string);
              const detail = parsed.detail;
              this.error.set(typeof detail === 'object' ? detail.message : (detail || 'Errore sync'));
            } catch {
              this.error.set('Errore durante la sincronizzazione');
            }
            this.syncing.set(false);
          };
          reader.readAsText(err.error);
        } else {
          this.error.set(err.error?.detail || 'Errore sync');
          this.syncing.set(false);
        }
      },
    });
  }
}
```

- [ ] **Step 3: Crea `frontend/src/app/features/dashboard/dashboard.component.ts`**

```typescript
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ShopifyTemplateCardComponent } from './shopify-template-card.component';
import { DailySyncCardComponent } from './daily-sync-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, ShopifyTemplateCardComponent, DailySyncCardComponent],
  template: `
    <header class="header">
      <h1>Stock Sync</h1>
      <nav>
        @if (auth.isAdmin()) {
          <a routerLink="/admin">Gestione utenti</a>
        }
        <button (click)="auth.logout()">Esci</button>
      </nav>
    </header>
    <main class="main">
      <app-shopify-template-card />
      <app-daily-sync-card />
    </main>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; padding: 16px 32px; border-bottom: 1px solid #eee; }
    nav { display: flex; gap: 16px; align-items: center; }
    .main { max-width: 720px; margin: 32px auto; padding: 0 16px; }
    button { padding: 6px 14px; cursor: pointer; }
  `],
})
export class DashboardComponent {
  constructor(public auth: AuthService) {}
}
```

- [ ] **Step 4: Verifica dashboard nel browser**

Con backend e frontend in esecuzione:
1. Login come admin → redirect a `/dashboard`
2. Carica un file CSV Shopify con colonne `Variant SKU` e `Variant Inventory Qty` → info template appare
3. Carica CSV Maestro con colonne `codice` e `giacenza` → link download appare
4. Scarica file → apri, verifica quantità aggiornate

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/dashboard/
git commit -m "feat: dashboard with shopify template and daily sync components"
```

---

## Task 14: Admin component

**Files:**
- Create: `frontend/src/app/features/admin/admin.component.ts`

- [ ] **Step 1: Crea `frontend/src/app/features/admin/admin.component.ts`**

```typescript
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { User } from '../../core/models/types';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  template: `
    <header class="header">
      <h1>Gestione Utenti</h1>
      <a routerLink="/dashboard">Dashboard</a>
    </header>
    <main class="main">
      <section class="card">
        <h2>Nuovo utente</h2>
        <form (ngSubmit)="createUser()">
          <input type="email" [(ngModel)]="newEmail" name="email" placeholder="Email" required />
          <input type="password" [(ngModel)]="newPassword" name="password" placeholder="Password" required />
          <label>
            <input type="checkbox" [(ngModel)]="newIsAdmin" name="isAdmin" />
            Admin
          </label>
          <button type="submit" [disabled]="creating()">
            {{ creating() ? 'Creazione...' : 'Crea utente' }}
          </button>
          @if (createError()) { <p class="error">{{ createError() }}</p> }
        </form>
      </section>

      <section class="card">
        <h2>Utenti</h2>
        <table>
          <thead>
            <tr><th>Email</th><th>Admin</th><th>Creato</th></tr>
          </thead>
          <tbody>
            @for (user of users(); track user.id) {
              <tr>
                <td>{{ user.email }}</td>
                <td>{{ user.is_admin ? 'Si' : 'No' }}</td>
                <td>{{ user.created_at | date:'dd/MM/yyyy' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    </main>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; padding: 16px 32px; border-bottom: 1px solid #eee; }
    .main { max-width: 720px; margin: 32px auto; padding: 0 16px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
    form { display: flex; flex-direction: column; gap: 10px; max-width: 360px; }
    input[type=email], input[type=password] { padding: 8px; font-size: 1rem; border: 1px solid #ccc; border-radius: 4px; }
    button { padding: 8px 16px; cursor: pointer; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
    .error { color: red; margin: 0; }
  `],
})
export class AdminComponent implements OnInit {
  users = signal<User[]>([]);
  newEmail = '';
  newPassword = '';
  newIsAdmin = false;
  creating = signal(false);
  createError = signal('');

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.listUsers().subscribe(u => this.users.set(u));
  }

  createUser() {
    this.creating.set(true);
    this.createError.set('');
    this.api.createUser(this.newEmail, this.newPassword, this.newIsAdmin).subscribe({
      next: () => {
        this.newEmail = '';
        this.newPassword = '';
        this.newIsAdmin = false;
        this.creating.set(false);
        this.load();
      },
      error: err => {
        this.createError.set(err.error?.detail || 'Errore creazione utente');
        this.creating.set(false);
      },
    });
  }
}
```

- [ ] **Step 2: Verifica compilazione TypeScript (tutti i file ora esistono)**

```bash
cd frontend && npx tsc --noEmit
```

Atteso: nessun errore

- [ ] **Step 3: Verifica admin panel nel browser**

1. Login come admin
2. Naviga a `/admin`
3. Crea un nuovo utente non-admin
4. Verifica che appaia in tabella
5. Login con il nuovo utente → verifica che `/admin` redirect a `/dashboard`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/admin/
git commit -m "feat: admin panel for user management"
```

---

## Task 15: Deployment config

**Files:**
- Modify: `backend/main.py` (serve static files)
- Create: `backend/Dockerfile`
- Create: `backend/railway.toml`

- [ ] **Step 1: Aggiungi static file serving a `backend/main.py`**

Alla fine del file, dopo tutti gli `include_router`:

```python
import os as _os
if _os.path.isdir("static"):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

- [ ] **Step 2: Crea `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /data/uploads

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: Crea `backend/railway.toml`**

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 30
```

- [ ] **Step 4: Build Angular per produzione**

```bash
cd frontend
npm run build:prod
```

Atteso: `frontend/dist/frontend/browser/` copiato in `backend/static/`

- [ ] **Step 5: Verifica produzione locale**

```bash
cd backend
uvicorn main:app
```

Apri `http://localhost:8000` — deve mostrare l'app Angular. API su `/auth/login` etc. deve funzionare.

- [ ] **Step 6: Istruzioni Railway**

Crea un nuovo progetto Railway:
1. Aggiungi PostgreSQL service → copia `DATABASE_URL` nelle env vars del web service
2. Aggiungi un Volume al web service, mount path: `/data/uploads`
3. Set env vars: `DATABASE_URL`, `JWT_SECRET`, `UPLOAD_DIR=/data/uploads`, `FIRST_ADMIN_EMAIL`, `FIRST_ADMIN_PASSWORD`
4. Deploy dal repository GitHub o dalla CLI Railway
5. Dopo il primo deploy: `railway run python seed_admin.py`

- [ ] **Step 7: Esegui tutti i test backend un'ultima volta**

```bash
cd backend && pytest -v
```

Atteso: tutti passano

- [ ] **Step 8: Commit finale**

```bash
git add backend/main.py backend/Dockerfile backend/railway.toml
git commit -m "feat: deployment config for Railway"
```

---

## Riepilogo comandi sviluppo

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # modifica DATABASE_URL, JWT_SECRET, ecc.
python seed_admin.py
uvicorn main:app --reload

# Frontend
cd frontend
npm install
ng serve  # proxy verso localhost:8000

# Test backend
cd backend && pytest -v

# Build produzione
cd frontend && npm run build:prod
```

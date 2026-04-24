# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Stock Sync** — multi-user web app. Ogni utente carica il template Shopify (CSV/XLS/XLSX), poi giornalmente carica il CSV Maestro e scarica il file Shopify aggiornato con le giacenze sincronizzate per SKU.

**Stack:** FastAPI 0.115 + SQLAlchemy 2.0 + SQLite (dev) / PostgreSQL (prod) · Angular 19 standalone + signals · Railway (deploy).

---

## Stato attuale (2026-04-24)

### Completato

| Task | Descrizione | Commit |
|------|-------------|--------|
| 1 | Backend scaffolding (config, database, main.py) | `feat: backend project scaffolding` |
| 2 | DB models + Pydantic schemas | `fix: timezone-aware datetimes, native_enum=False for SQLite compat` |
| 3 | Auth utilities (JWT, passlib/bcrypt) | `feat: JWT auth utilities and FastAPI dependencies` |
| 4 | Login endpoint + conftest + test_auth | `feat: login endpoint with JWT` |
| 5 | Admin endpoints (create/list users) | `feat: admin endpoints for user management` |
| 6 | File processor service (SKU matching) | `feat: file processor service with SKU matching logic` |
| 7 | Shopify template endpoints | `feat: shopify template upload and retrieval endpoints` |
| 8 | Sync endpoint (download aggiornato) | `feat: daily sync endpoint with quantity matching` |
| 9 | Admin seed script | `feat: admin seed script` |
| 10 | Angular 19 scaffold + routing + proxy | `feat: Angular 19 project scaffold with routing and proxy` |
| 11 | Core services, guards, interceptor | (incluso nel commit Task 10) |
| 12 | Login component | (incluso nel commit Task 10) |
| 13 | Dashboard + ShopifyTemplateCard + DailySyncCard | (incluso nel commit Task 10) |
| 14 | Admin component | (incluso nel commit Task 10) |
| 15 | Deployment config (Dockerfile, railway.toml) | `feat: deployment config for Railway` |

**Backend test suite: 25/25 passing. TypeScript: 0 errors.**

---

## Prossimi step

### 1. Build produzione Angular

```bash
cd frontend
npm run build:prod
# Output: backend/static/ (servito da FastAPI StaticFiles)
```

Verifica locale:
```bash
cd backend
uvicorn main:app
# Apri http://localhost:8000 → deve mostrare l'app Angular
```

### 2. Deploy su Railway

1. Crea nuovo progetto Railway
2. Aggiungi **PostgreSQL** service → copia `DATABASE_URL` nelle env vars del web service
3. Aggiungi **Volume** al web service, mount path: `/data/uploads`
4. Imposta env vars:
   - `DATABASE_URL` (da PostgreSQL service)
   - `JWT_SECRET` (stringa random lunga)
   - `UPLOAD_DIR=/data/uploads`
   - `FIRST_ADMIN_EMAIL=admin@tuodominio.com`
   - `FIRST_ADMIN_PASSWORD=<password sicura>`
   - `CORS_ORIGINS=*`
5. Connetti repo GitHub e deploya dal branch `main`
6. Dopo il primo deploy: `railway run python seed_admin.py`

### 3. Verifica end-to-end

- Login come admin → redirect `/dashboard`
- Carica template Shopify CSV → info colonne appaiono
- Carica CSV Maestro → download file aggiornato, conta SKU non trovati
- `/admin` → crea utente non-admin → verifica che non acceda a `/admin`

---

## Comandi sviluppo

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env   # imposta DATABASE_URL=sqlite:///./dev.db, JWT_SECRET=...
python seed_admin.py
uvicorn main:app --reload

# Frontend
cd frontend
npm install
ng serve              # proxy → localhost:8000

# Test
cd backend
pytest -v
```

## Note tecniche

- `bcrypt==4.0.1` pinnato in `requirements.txt` per compatibilità con passlib 1.7.4
- `native_enum=False` su `SAEnum(FileFormat)` per compatibilità SQLite in test
- `conftest.py` setta env vars prima degli import per evitare errori Pydantic Settings
- Il build produzione Angular usa `--output-path=../backend/static` — Railway serve tutto da un singolo container


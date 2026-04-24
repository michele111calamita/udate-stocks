# Stock Sync — Design Spec
Date: 2026-04-24

## Overview

Web app con login che permette a più utenti di sincronizzare le giacenze dal gestionale Maestro verso Shopify. Ogni utente carica il proprio inventario Shopify (template), poi giornalmente carica il CSV Maestro e scarica il file aggiornato pronto per l'import su Shopify.

## Stack

- **Frontend:** Angular (standalone components, signals)
- **Backend:** FastAPI (Python)
- **ORM:** SQLAlchemy
- **File processing:** pandas + openpyxl
- **Auth:** JWT (python-jose + passlib)
- **DB:** PostgreSQL
- **Storage:** filesystem locale del server (path in DB)
- **Deployment:** Railway o Render (backend + DB + static)

## Data Model

```
User
  id            UUID PK
  email         VARCHAR UNIQUE
  password_hash VARCHAR
  is_admin      BOOLEAN default false
  created_at    TIMESTAMP

ShopifyTemplate
  id            UUID PK
  user_id       UUID FK → User
  filename      VARCHAR
  filepath      VARCHAR
  format        ENUM(csv, xls, xlsx)
  uploaded_at   TIMESTAMP
```

## API Endpoints

| Method | Path | Auth | Descrizione |
|--------|------|------|-------------|
| POST | /auth/login | — | Login, ritorna JWT |
| POST | /admin/users | admin JWT | Crea utente |
| GET | /admin/users | admin JWT | Lista utenti |
| POST | /api/shopify-template | JWT | Upload/sostituisce file Shopify utente |
| GET | /api/shopify-template | JWT | Info template corrente (nome, data) |
| POST | /api/sync | JWT | Upload CSV Maestro → download file aggiornato |

## Core Logic — Sync

1. Leggi `ShopifyTemplate` dell'utente dal filesystem → DataFrame (pandas)
2. Leggi CSV Maestro dalla request → DataFrame
3. Match per colonna SKU (case-insensitive, strip whitespace)
4. Per ogni riga Shopify: se SKU esiste in Maestro → aggiorna colonna quantità
5. SKU non trovati in Maestro → riga rimane invariata (quantità originale)
6. Serializza DataFrame nello stesso formato del template originale (CSV o XLS/XLSX)
7. Ritorna file come `StreamingResponse` con header `Content-Disposition: attachment`

**Response sync include:**
- File aggiornato (download)
- Header custom: `X-Unmatched-SKUs` con count SKU non trovati

## Angular — Struttura

```
/login              → LoginComponent
/dashboard          → DashboardComponent
  ├── ShopifyTemplateCardComponent  (upload/sostituzione template)
  └── DailySyncCardComponent        (upload Maestro → download output)
/admin              → AdminComponent (solo utenti is_admin)
  └── UserManagementComponent       (crea utenti, lista)
```

**Auth guard:** route `/dashboard` e `/admin` protette da JWT guard. `/admin` verifica claim `is_admin`.

## Gestione Errori

| Scenario | Comportamento |
|----------|--------------|
| Formato file non supportato | 400 + messaggio |
| Colonna SKU non trovata nel file | 422 + nome colonne disponibili |
| Nessun template Shopify caricato | 404 con istruzioni |
| JWT scaduto | 401, Angular redirect a /login |
| SKU Shopify non presenti in Maestro | 200 + warning count in header |

## Configurazione Colonne

Le colonne SKU e Quantity nei file Shopify e Maestro possono avere nomi diversi. Al primo upload del template, il backend tenta auto-detection (cerca "sku", "quantity", "qty", "giacenza", "disponibile" case-insensitive). Se ambiguo, ritorna 422 con lista colonne e l'utente sceglie via API param.

## Deployment

- **Railway:** un progetto con 3 service: `web` (FastAPI), `db` (PostgreSQL), `static` (Angular build o servito da FastAPI)
- File uploadati in volume persistente Railway montato su `/data/uploads`
- Environment vars: `DATABASE_URL`, `JWT_SECRET`, `UPLOAD_DIR`, `FIRST_ADMIN_EMAIL`, `FIRST_ADMIN_PASSWORD`

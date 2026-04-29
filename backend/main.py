import asyncio
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine
from app import models


def _setup_db():
    from app.database import SessionLocal
    from app.auth import hash_password
    models.Base.metadata.create_all(bind=engine)
    if not settings.first_admin_email or not settings.first_admin_password:
        return
    db = SessionLocal()
    try:
        exists = db.query(models.User).filter(models.User.email == settings.first_admin_email).first()
        if not exists:
            db.add(models.User(
                email=settings.first_admin_email,
                password_hash=hash_password(settings.first_admin_password),
                is_admin=True,
            ))
            db.commit()
            print(f"Admin created: {settings.first_admin_email}")
    finally:
        db.close()


async def _init_db():
    loop = asyncio.get_event_loop()
    for attempt in range(10):
        try:
            await loop.run_in_executor(None, _setup_db)
            return
        except Exception as exc:
            if attempt == 9:
                print(f"DB init failed after 10 attempts: {exc}")
                return
            await asyncio.sleep(3)


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(_init_db())
    yield


app = FastAPI(title="Stock Sync", lifespan=lifespan)

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

from app.routers import auth as auth_router
app.include_router(auth_router.router)

from app.routers import admin as admin_router
app.include_router(admin_router.router)

from app.routers import shopify as shopify_router
app.include_router(shopify_router.router)

from app.routers import sync as sync_router
app.include_router(sync_router.router)

from app.routers import mapping as mapping_router
app.include_router(mapping_router.router)

import os as _os
from fastapi.responses import FileResponse
from fastapi import HTTPException

_static = "static/browser" if _os.path.isdir("static/browser") else "static"

@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    file_path = _os.path.join(_static, full_path)
    if _os.path.isfile(file_path):
        return FileResponse(file_path)
    index = _os.path.join(_static, "index.html")
    if _os.path.isfile(index):
        return FileResponse(index)
    raise HTTPException(status_code=404)

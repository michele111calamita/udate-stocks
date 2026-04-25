import asyncio
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine
from app import models


async def _init_db():
    loop = asyncio.get_event_loop()
    for attempt in range(10):
        try:
            await loop.run_in_executor(None, lambda: models.Base.metadata.create_all(bind=engine))
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

import os as _os
_static = "static/browser" if _os.path.isdir("static/browser") else "static"
if _os.path.isdir(_static):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=_static, html=True), name="static")

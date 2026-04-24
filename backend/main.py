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

from app.routers import auth as auth_router
app.include_router(auth_router.router)

from app.routers import admin as admin_router
app.include_router(admin_router.router)

from app.routers import shopify as shopify_router
app.include_router(shopify_router.router)

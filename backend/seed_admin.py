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

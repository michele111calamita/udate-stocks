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

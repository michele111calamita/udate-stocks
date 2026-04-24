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

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

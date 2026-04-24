import uuid
import enum
from datetime import datetime, timezone
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    template: Mapped["ShopifyTemplate"] = relationship(back_populates="user", uselist=False)

class ShopifyTemplate(Base):
    __tablename__ = "shopify_templates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String)
    filepath: Mapped[str] = mapped_column(String)
    format: Mapped[FileFormat] = mapped_column(SAEnum(FileFormat, native_enum=False))
    sku_column: Mapped[str] = mapped_column(String)
    qty_column: Mapped[str] = mapped_column(String)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship(back_populates="template")

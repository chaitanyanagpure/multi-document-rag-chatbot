"""
VerbaFlow AI - Base ORM Model
Provides UUID primary key, created_at, and updated_at for all models.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BaseModel(Base):
    """
    Abstract base model providing:
    - id: UUID primary key (server-generated).
    - created_at: Timestamp set on INSERT.
    - updated_at: Timestamp updated on every UPDATE via server_onupdate.
    """

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def to_dict(self) -> dict:
        """Serialize the model to a plain dictionary."""
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

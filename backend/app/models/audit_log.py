"""
VerbaFlow AI - AuditLog ORM Model
Immutable ledger of every significant API action for compliance.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AuditLog(Base):
    """
    Append-only audit trail of user actions.

    Records who did what, to which resource, from which IP, and when.
    Never deleted; archived to cold storage after 90 days in production.
    """

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # Who
    org_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # What
    action: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    resource_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    details_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # From where
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # HTTP context
    method: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    status_code: Mapped[Optional[int]] = mapped_column(
        __import__("sqlalchemy").Integer, nullable=True
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    user: Mapped[Optional["User"]] = relationship(  # noqa: F821
        "User", back_populates="audit_logs", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<AuditLog id={self.id} action={self.action} user={self.user_id}>"
        )

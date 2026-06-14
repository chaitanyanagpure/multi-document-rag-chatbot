"""
VerbaFlow AI - KnowledgeBase ORM Model
A container for documents within an organisation.
"""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User
    from app.models.document import Document
    from app.models.chat import Chat


class KnowledgeBase(BaseModel):
    """
    A knowledge base is a curated collection of documents for a specific
    purpose within an organisation (e.g., "HR Policies", "Product Docs").
    """

    __tablename__ = "knowledge_bases"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Multi-tenancy
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # State
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    document_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_size_bytes: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)

    # Flexible settings stored as JSON (e.g., custom retrieval configs)
    settings_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # ── Relationships ──────────────────────────────────────────────────────────
    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="knowledge_bases", lazy="select"
    )
    creator: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[created_by], lazy="select"
    )
    documents: Mapped[List["Document"]] = relationship(
        "Document",
        back_populates="knowledge_base",
        cascade="all, delete-orphan",
        lazy="select",
    )
    chats: Mapped[List["Chat"]] = relationship(
        "Chat",
        back_populates="knowledge_base",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<KnowledgeBase id={self.id} name={self.name}>"

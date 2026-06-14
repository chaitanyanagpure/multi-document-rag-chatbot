"""
VerbaFlow AI - Chat ORM Model
Represents a conversation session between a user and a KnowledgeBase.
"""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.knowledge_base import KnowledgeBase
    from app.models.message import Message


class Chat(BaseModel):
    """
    A chat session scoped to a user and a knowledge base.

    Supports folders, pinning, and shareable public links via share_token.
    """

    __tablename__ = "chats"

    title: Mapped[str] = mapped_column(String(512), default="New Chat", nullable=False)
    folder_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    share_token: Mapped[Optional[str]] = mapped_column(
        String(128), unique=True, nullable=True, index=True
    )

    # Message counts / summary (denormalized for performance)
    message_count: Mapped[int] = mapped_column(
        __import__("sqlalchemy").Integer, default=0, nullable=False
    )
    last_message_preview: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Foreign keys
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kb_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="chats", lazy="select")
    knowledge_base: Mapped["KnowledgeBase"] = relationship(
        "KnowledgeBase", back_populates="chats", lazy="select"
    )
    messages: Mapped[List["Message"]] = relationship(
        "Message",
        back_populates="chat",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Chat id={self.id} title={self.title!r}>"

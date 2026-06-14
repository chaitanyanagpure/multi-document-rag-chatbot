"""
VerbaFlow AI - OrgSettings ORM Model
Per-organisation override of RAG pipeline configuration.
"""
from __future__ import annotations

import enum
import uuid
from typing import Optional

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class ChunkingStrategy(str, enum.Enum):
    FIXED = "fixed"
    RECURSIVE = "recursive"
    SEMANTIC = "semantic"
    HIERARCHICAL = "hierarchical"


class OrgSettings(BaseModel):
    """
    Organisation-level RAG settings that override the global defaults.

    One row per organisation (one-to-one relationship with Organization).
    """

    __tablename__ = "org_settings"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Provider overrides
    embedding_provider: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    llm_provider: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    llm_model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    embedding_model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Chunking
    chunk_size: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)
    chunk_overlap: Mapped[int] = mapped_column(Integer, default=200, nullable=False)
    chunking_strategy: Mapped[ChunkingStrategy] = mapped_column(
        Enum(ChunkingStrategy, name="chunking_strategy_enum"),
        default=ChunkingStrategy.RECURSIVE,
        nullable=False,
    )

    # Retrieval
    retrieval_count: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    similarity_threshold: Mapped[float] = mapped_column(
        Float, default=0.7, nullable=False
    )
    max_file_size_mb: Mapped[int] = mapped_column(Integer, default=50, nullable=False)

    # Feature flags
    enable_bm25: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_reranking: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_query_expansion: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    organization: Mapped["Organization"] = relationship(  # noqa: F821
        "Organization", back_populates="settings", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<OrgSettings org={self.org_id}>"

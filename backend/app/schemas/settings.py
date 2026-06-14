"""
VerbaFlow AI - Settings Schemas
Pydantic v2 models for organisation RAG settings.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class OrgSettingsUpdate(BaseModel):
    embedding_provider: Optional[str] = Field(
        default=None, pattern="^(google|openai)$"
    )
    llm_provider: Optional[str] = Field(default=None, pattern="^(gemini|openai)$")
    llm_model: Optional[str] = Field(default=None, max_length=128)
    embedding_model: Optional[str] = Field(default=None, max_length=128)
    chunk_size: Optional[int] = Field(default=None, ge=100, le=8000)
    chunk_overlap: Optional[int] = Field(default=None, ge=0, le=2000)
    chunking_strategy: Optional[str] = Field(
        default=None,
        pattern="^(fixed|recursive|semantic|hierarchical)$",
    )
    retrieval_count: Optional[int] = Field(default=None, ge=1, le=20)
    similarity_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    max_file_size_mb: Optional[int] = Field(default=None, ge=1, le=500)
    enable_bm25: Optional[bool] = None
    enable_reranking: Optional[bool] = None
    enable_query_expansion: Optional[bool] = None


class OrgSettingsResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    org_id: UUID
    embedding_provider: Optional[str]
    llm_provider: Optional[str]
    llm_model: Optional[str]
    embedding_model: Optional[str]
    chunk_size: int
    chunk_overlap: int
    chunking_strategy: str
    retrieval_count: int
    similarity_threshold: float
    max_file_size_mb: int
    enable_bm25: bool
    enable_reranking: bool
    enable_query_expansion: bool
    created_at: datetime
    updated_at: datetime

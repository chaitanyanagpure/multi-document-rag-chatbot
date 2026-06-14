"""
VerbaFlow AI - KnowledgeBase Schemas
Pydantic v2 models for knowledge base CRUD and stats.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class KBCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    slug: Optional[str] = Field(default=None, max_length=100)
    settings_json: Optional[Dict] = None


class KBUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    is_active: Optional[bool] = None
    settings_json: Optional[Dict] = None


class KBResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    name: str
    description: Optional[str]
    slug: str
    org_id: UUID
    created_by: Optional[UUID]
    is_active: bool
    document_count: int
    total_size_bytes: int
    settings_json: Optional[Dict]
    created_at: datetime
    updated_at: datetime


class KBListResponse(BaseModel):
    items: List[KBResponse]
    total: int
    page: int
    page_size: int
    pages: int


class KBStats(BaseModel):
    """Aggregate statistics for a knowledge base."""

    kb_id: UUID
    document_count: int
    total_chunks: int
    total_size_bytes: int
    total_queries: int
    avg_response_time_ms: Optional[float]
    status_breakdown: Dict[str, int]

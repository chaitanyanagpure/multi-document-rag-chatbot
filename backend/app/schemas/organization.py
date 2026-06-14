"""
VerbaFlow AI - Organization Schemas
Pydantic v2 models for organisation CRUD.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class OrgCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=1000)
    subscription_tier: str = Field(default="free", pattern="^(free|pro|enterprise)$")
    max_users: int = Field(default=5, ge=1, le=10000)
    max_storage_gb: int = Field(default=10, ge=1, le=10000)

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("Slug may only contain letters, numbers, hyphens, underscores")
        return v.lower()


class OrgUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=1000)
    subscription_tier: Optional[str] = Field(
        default=None, pattern="^(free|pro|enterprise)$"
    )
    is_active: Optional[bool] = None
    max_users: Optional[int] = Field(default=None, ge=1, le=10000)
    max_storage_gb: Optional[int] = Field(default=None, ge=1, le=10000)
    logo_url: Optional[str] = Field(default=None, max_length=512)
    domain: Optional[str] = Field(default=None, max_length=255)


class OrgResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    name: str
    slug: str
    description: Optional[str]
    subscription_tier: str
    is_active: bool
    max_users: int
    max_storage_gb: int
    logo_url: Optional[str]
    domain: Optional[str]
    created_at: datetime
    updated_at: datetime


class OrgListResponse(BaseModel):
    items: List[OrgResponse]
    total: int
    page: int
    page_size: int
    pages: int

"""
VerbaFlow AI - User Schemas
Pydantic v2 models for user CRUD operations.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    org_id: UUID
    role: str = Field(default="EMPLOYEE", pattern="^(SUPER_ADMIN|ORG_ADMIN|EMPLOYEE)$")


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    avatar_url: Optional[str] = Field(default=None, max_length=512)
    is_active: Optional[bool] = None
    role: Optional[str] = Field(
        default=None, pattern="^(SUPER_ADMIN|ORG_ADMIN|EMPLOYEE)$"
    )


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    email: str
    full_name: str
    avatar_url: Optional[str]
    org_id: UUID
    role: str
    is_active: bool
    is_verified: bool
    last_login: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class UserListResponse(BaseModel):
    items: List[UserResponse]
    total: int
    page: int
    page_size: int
    pages: int


class UserProfileUpdate(BaseModel):
    """What a user can update about their own profile."""

    full_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    avatar_url: Optional[str] = Field(default=None, max_length=512)

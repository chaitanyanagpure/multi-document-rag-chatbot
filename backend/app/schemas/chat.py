"""
VerbaFlow AI - Chat Schemas
Pydantic v2 models for chat session management.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ChatCreate(BaseModel):
    kb_id: UUID
    title: str = Field(default="New Chat", max_length=512)
    folder_name: Optional[str] = Field(default=None, max_length=255)


class ChatUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=512)
    folder_name: Optional[str] = Field(default=None, max_length=255)
    is_pinned: Optional[bool] = None


class ChatResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    title: str
    folder_name: Optional[str]
    is_pinned: bool
    is_shared: bool
    share_token: Optional[str]
    message_count: int
    last_message_preview: Optional[str]
    user_id: UUID
    kb_id: UUID
    org_id: UUID
    created_at: datetime
    updated_at: datetime


class ChatListResponse(BaseModel):
    items: List[ChatResponse]
    total: int
    page: int
    page_size: int
    pages: int


class ShareChatResponse(BaseModel):
    share_token: str
    share_url: str
    is_shared: bool

"""
VerbaFlow AI - Message Schemas
Pydantic v2 models for chat messages, citations, and RAG query/response.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CitationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    chunk_id: Optional[UUID]
    doc_id: Optional[UUID]
    document_name: Optional[str] = None
    page_number: Optional[int]
    similarity_score: Optional[float]
    relevance_score: Optional[float]
    excerpt: Optional[str]


class MessageCreate(BaseModel):
    role: str = Field(pattern="^(user|assistant|system)$")
    content: str = Field(min_length=1, max_length=32000)


class MessageResponse(BaseModel):
    model_config = {"from_attributes": True, "populate_by_name": True}

    id: UUID
    chat_id: UUID
    role: str
    content: str
    token_count: Optional[int]
    model_used: Optional[str]
    latency_ms: Optional[int]
    citations: List[CitationResponse] = []
    created_at: datetime
    diagnostics: Optional[Dict[str, Any]] = Field(default=None, validation_alias="diagnostics_json")


class ChatQueryRequest(BaseModel):
    """Request body for the main chat endpoint."""

    message: str = Field(min_length=1, max_length=16000)
    stream: bool = Field(default=True)
    retrieval_count: Optional[int] = Field(default=None, ge=1, le=20)
    include_citations: bool = Field(default=True)
    chat_history_limit: int = Field(default=10, ge=0, le=50)
    config: Optional[Dict[str, Any]] = Field(default=None)


class ChatQueryResponse(BaseModel):
    """Non-streaming response for a single chat query."""

    message_id: UUID
    chat_id: UUID
    answer: str
    model_used: str
    token_count: int
    latency_ms: int
    citations: List[CitationResponse]
    metadata: Dict[str, Any] = {}


class StreamChunkEvent(BaseModel):
    """SSE payload for a single streamed token chunk."""

    type: str = "chunk"
    content: str
    done: bool = False


class StreamDoneEvent(BaseModel):
    """SSE payload sent at the end of a streaming response."""

    type: str = "done"
    message_id: str
    token_count: int
    latency_ms: int
    citations: List[CitationResponse]

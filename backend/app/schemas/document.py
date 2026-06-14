"""
VerbaFlow AI - Document Schemas
Pydantic v2 models for document management.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    name: str
    original_filename: str
    file_type: str
    file_size: int
    status: str
    error_message: Optional[str]
    ingestion_progress: int
    version: int
    page_count: Optional[int]
    word_count: Optional[int]
    language: Optional[str]
    metadata_json: Optional[Dict]
    tags: Optional[List[str]]
    category: Optional[str]
    kb_id: UUID
    org_id: UUID
    uploaded_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime


class DocumentListResponse(BaseModel):
    items: List[DocumentResponse]
    total: int
    page: int
    page_size: int
    pages: int


class DocumentStatusUpdate(BaseModel):
    """Internal model used by the ingestion service to update document status."""

    status: str
    error_message: Optional[str] = None
    ingestion_progress: Optional[int] = None
    page_count: Optional[int] = None
    word_count: Optional[int] = None
    language: Optional[str] = None


class DocumentUploadResponse(BaseModel):
    """Returned immediately after a file upload is accepted."""

    document_id: UUID
    name: str
    status: str
    message: str = "Document upload accepted. Ingestion started."


class BulkDeleteRequest(BaseModel):
    document_ids: List[UUID] = Field(min_length=1, max_length=100)


class BulkDeleteResponse(BaseModel):
    deleted: List[UUID]
    failed: List[UUID]
    message: str


class IngestionProgressEvent(BaseModel):
    """Server-Sent Event payload for ingestion progress."""

    document_id: str
    status: str
    progress: int
    step: str
    message: str
    error: Optional[str] = None

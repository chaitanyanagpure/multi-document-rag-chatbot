"""
VerbaFlow AI - Knowledge Bases Router
Exposes endpoints to list, create, edit, and delete tenant knowledge bases.
"""
from __future__ import annotations

import logging
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.knowledge_base import KnowledgeBase
from app.models.chunk import Chunk
from app.models.document import Document
from app.schemas.knowledge_base import KBCreate, KBUpdate, KBResponse
from app.repositories.base import BaseRepository
from app.services.vector_store import VectorStoreFactory
from app.services.bm25_service import bm25_registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/kb", tags=["Knowledge Bases"])


@router.get("", response_model=List[KBResponse])
async def list_kbs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all knowledge bases belonging to the user's organization."""
    stmt = select(KnowledgeBase).where(
        and_(KnowledgeBase.org_id == current_user.org_id, KnowledgeBase.is_active == True)
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("", response_model=KBResponse, status_code=status.HTTP_201_CREATED)
async def create_kb(
    payload: KBCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new knowledge base in the organization (Org Admin / Super Admin)."""
    kb_repo = BaseRepository(KnowledgeBase, db)
    import re
    raw_slug = payload.slug or payload.name
    slug_val = raw_slug.lower().strip()
    slug_val = re.sub(r"[^\w\s-]", "", slug_val)
    slug_val = re.sub(r"[\s_-]+", "-", slug_val)
    slug_val = slug_val[:100]

    kb = KnowledgeBase(
        name=payload.name,
        description=payload.description,
        slug=slug_val,
        org_id=current_user.org_id,
        created_by=current_user.id,
        document_count=0,
        total_size_bytes=0,
        settings_json=payload.settings_json or {}
    )
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    return kb


@router.get("/{kb_id}", response_model=KBResponse)
async def get_kb(
    kb_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get details of a specific knowledge base, verifying organization boundaries."""
    stmt = select(KnowledgeBase).where(
        and_(KnowledgeBase.id == kb_id, KnowledgeBase.org_id == current_user.org_id)
    )
    res = await db.execute(stmt)
    kb = res.scalar_one_or_none()
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found or access denied."
        )
    return kb


@router.put("/{kb_id}", response_model=KBResponse)
async def update_kb(
    kb_id: UUID,
    payload: KBUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update metadata or settings of a knowledge base (Org Admin / Super Admin)."""
    stmt = select(KnowledgeBase).where(
        and_(KnowledgeBase.id == kb_id, KnowledgeBase.org_id == current_user.org_id)
    )
    res = await db.execute(stmt)
    kb = res.scalar_one_or_none()
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found or access denied."
        )

    if payload.name is not None:
        kb.name = payload.name
    if payload.description is not None:
        kb.description = payload.description
    if payload.settings_json is not None:
        kb.settings_json = payload.settings_json

    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    return kb


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kb(
    kb_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a knowledge base, cleaning up all documents, chunks, and vector files."""
    stmt = select(KnowledgeBase).where(
        and_(KnowledgeBase.id == kb_id, KnowledgeBase.org_id == current_user.org_id)
    )
    res = await db.execute(stmt)
    kb = res.scalar_one_or_none()
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found or access denied."
        )

    # Clean up files on disk (FAISS index + BM25 index)
    try:
        vs = VectorStoreFactory.get_store()
        await vs.delete_by_kb(kb_id)
        await bm25_registry.delete_by_kb(kb_id)
    except Exception as e:
        logger.error(f"Failed to delete index files for KB {kb_id}: {e}")

    # Chunks and documents will be cascade-deleted by PostgreSQL foreign keys
    await db.delete(kb)
    await db.commit()
    return None

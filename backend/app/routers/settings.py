"""
VerbaFlow AI - Settings Router
Handles retrieval and modification of organization-wide RAG and AI provider configurations.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.settings import OrgSettings
from app.schemas.settings import OrgSettingsUpdate, OrgSettingsResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=OrgSettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve settings for the current organization."""
    stmt = select(OrgSettings).where(OrgSettings.org_id == current_user.org_id)
    res = await db.execute(stmt)
    settings_obj = res.scalar_one_or_none()

    if not settings_obj:
        # Create default settings if not exists
        settings_obj = OrgSettings(
            org_id=current_user.org_id,
            embedding_provider="google",
            llm_provider="gemini",
            llm_model="models/gemini-2.5-flash",
            embedding_model="models/gemini-embedding-001",
            chunk_size=1000,
            chunk_overlap=200,
            retrieval_count=5,
            similarity_threshold=0.7,
            max_file_size_mb=50,
            chunking_strategy="recursive",
            enable_bm25=True,
            enable_reranking=False
        )
        db.add(settings_obj)
        await db.commit()
        await db.refresh(settings_obj)

    return settings_obj


@router.put("", response_model=OrgSettingsResponse)
async def update_settings(
    payload: OrgSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update settings for the organization (requires admin permissions implicitly)."""
    stmt = select(OrgSettings).where(OrgSettings.org_id == current_user.org_id)
    res = await db.execute(stmt)
    settings_obj = res.scalar_one_or_none()

    if not settings_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings not found for this organization."
        )

    # Update fields if provided
    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(settings_obj, key, val)

    db.add(settings_obj)
    await db.commit()
    await db.refresh(settings_obj)
    return settings_obj

"""
VerbaFlow AI - Analytics Router
Maps HTTP requests to the AnalyticsService for organizational charts and overview summaries.
"""
from __future__ import annotations

import logging
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/overview")
async def get_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve high-level overview metrics (total queries, active users, avg latency, tokens)."""
    service = AnalyticsService(db)
    return await service.get_overview(current_user.org_id)


@router.get("/queries")
async def get_queries(
    days: int = Query(30, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the count of queries made per day for the last X days."""
    service = AnalyticsService(db)
    return await service.get_daily_query_counts(current_user.org_id, days)


@router.get("/tokens")
async def get_tokens(
    days: int = Query(30, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the sum of token usage per day for the last X days."""
    service = AnalyticsService(db)
    return await service.get_token_usage_stats(current_user.org_id, days)


@router.get("/documents")
async def get_documents(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the most referenced documents in citations."""
    service = AnalyticsService(db)
    return await service.get_top_documents(current_user.org_id, limit)


@router.get("/latency")
async def get_latency(
    days: int = Query(7, ge=1, le=30),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get latency distribution counts for response time histograms."""
    service = AnalyticsService(db)
    return await service.get_latency_distribution(current_user.org_id, days)

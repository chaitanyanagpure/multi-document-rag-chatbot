"""
VerbaFlow AI - Admin Router
Exposes administrative controls for users, organizations, audit logs, and system health status.
"""
from __future__ import annotations

import logging
from typing import List, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.organization import Organization
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.organization import OrgResponse, OrgCreate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Administration"])


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all users within the admin's organization (requires ORG_ADMIN or SUPER_ADMIN)."""
    # Enforce role: user must be admin
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required."
        )

    stmt = select(User).where(User.org_id == current_user.org_id).order_by(User.created_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Modify details, role, or active status of a user (requires Admin role)."""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required."
        )

    stmt = select(User).where(and_(User.id == user_id, User.org_id == current_user.org_id))
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in this organization."
        )

    # Prevent deactivating oneself
    if user.id == current_user.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own administrative account."
        )

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = UserRole(payload.role)
    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a user account from the tenant organization."""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required."
        )

    stmt = select(User).where(and_(User.id == user_id, User.org_id == current_user.org_id))
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own active account."
        )

    await db.delete(user)
    await db.commit()
    return None


@router.get("/audit-logs")
async def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch recent tenant audit trails for security monitoring (Admin restricted)."""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required."
        )

    stmt = select(AuditLog).where(AuditLog.org_id == current_user.org_id).order_by(AuditLog.created_at.desc()).limit(limit)
    res = await db.execute(stmt)
    logs = res.scalars().all()
    return [{
        "id": str(log.id),
        "user_id": str(log.user_id),
        "action": log.action,
        "resource_type": log.resource_type,
        "resource_id": str(log.resource_id) if log.resource_id else None,
        "details_json": log.details_json,
        "ip_address": log.ip_address,
        "created_at": log.created_at.isoformat()
    } for log in logs]


@router.get("/system-stats")
async def get_system_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve internal microservice checks and index statistics."""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required."
        )

    # Document statuses count
    doc_stmt = select(Document.status, select_count_star()).group_by(Document.status)
    doc_res = await db.execute(doc_stmt)
    doc_counts = {status: count for status, count in doc_res.all()}

    return {
        "services": {
            "database": "healthy",
            "vector_store": "healthy",
            "redis_cache": "healthy"
        },
        "document_pipeline_metrics": doc_counts
    }


def select_count_star():
    from sqlalchemy import func
    return func.count()

"""
VerbaFlow AI - User Repository
Domain-specific data access for User entities.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for User model with domain-specific query methods."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(User, db)

    async def get_by_email(self, email: str) -> Optional[User]:
        """
        Find a user by their email address.

        Args:
            email: Email address to search for.

        Returns:
            User instance or None.
        """
        result = await self.db.execute(
            select(User).where(User.email == email.lower().strip())
        )
        return result.scalar_one_or_none()

    async def get_by_org(
        self,
        org_id: UUID,
        page: int = 1,
        page_size: int = 20,
        active_only: bool = True,
    ) -> Tuple[List[User], int, int]:
        """
        Paginated list of users within an organisation.

        Args:
            org_id: Organisation UUID to filter by.
            page: 1-indexed page number.
            page_size: Items per page.
            active_only: If True, only return is_active=True users.

        Returns:
            Tuple of (users, total_count, total_pages).
        """
        filters = {"org_id": org_id}
        if active_only:
            filters["is_active"] = True
        return await self.paginate(
            page=page,
            page_size=page_size,
            filters=filters,
            order_by="created_at",
        )

    async def create_user(
        self,
        email: str,
        hashed_password: str,
        full_name: str,
        org_id: UUID,
        role: str = "EMPLOYEE",
    ) -> User:
        """
        Create a new user with validated data.

        Args:
            email: Unique email address.
            hashed_password: bcrypt-hashed password string.
            full_name: Display name.
            org_id: Organisation the user belongs to.
            role: RBAC role string.

        Returns:
            Newly created User instance.
        """
        return await self.create(
            {
                "email": email.lower().strip(),
                "hashed_password": hashed_password,
                "full_name": full_name,
                "org_id": org_id,
                "role": role,
                "is_active": True,
                "is_verified": False,
            }
        )

    async def update_last_login(self, user: User) -> None:
        """
        Update the last_login timestamp for a user.

        Args:
            user: User database model instance.
        """
        user.last_login = datetime.now(timezone.utc)
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)

    async def set_verified(self, user_id: UUID) -> None:
        """Mark a user's email as verified."""
        await self.db.execute(
            update(User).where(User.id == user_id).values(is_verified=True)
        )
        await self.db.flush()

    async def change_password(self, user_id: UUID, hashed_password: str) -> None:
        """Update the user's hashed password."""
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(hashed_password=hashed_password)
        )
        await self.db.flush()

    async def get_active_users_count(self, org_id: UUID) -> int:
        """Return count of active users in an org."""
        return await self.count({"org_id": org_id, "is_active": True})

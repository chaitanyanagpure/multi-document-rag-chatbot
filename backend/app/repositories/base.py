"""
VerbaFlow AI - Generic Async Repository
Provides common CRUD operations used by all concrete repositories.
"""
from __future__ import annotations

import math
from typing import Any, Dict, Generic, List, Optional, Tuple, Type, TypeVar
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Generic async repository implementing common CRUD and pagination patterns.

    Concrete repositories inherit from this class and can extend it with
    domain-specific query methods.

    Args:
        model: SQLAlchemy model class.
        db: Async database session injected via FastAPI DI.
    """

    def __init__(self, model: Type[ModelType], db: AsyncSession) -> None:
        self.model = model
        self.db = db

    async def get_by_id(self, record_id: UUID | str) -> Optional[ModelType]:
        """
        Fetch a single record by its primary key.

        Args:
            record_id: UUID or string UUID of the record.

        Returns:
            Model instance or None if not found.
        """
        result = await self.db.execute(
            select(self.model).where(self.model.id == record_id)
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[ModelType]:
        """
        Fetch all records matching the given equality filters.

        Args:
            filters: Dict of column_name -> value for equality filtering.
            order_by: Column name to order by (ascending).
            limit: Maximum number of records to return.

        Returns:
            List of model instances.
        """
        stmt = select(self.model)
        if filters:
            for col, val in filters.items():
                stmt = stmt.where(getattr(self.model, col) == val)
        if order_by:
            stmt = stmt.order_by(getattr(self.model, order_by))
        if limit:
            stmt = stmt.limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: Dict[str, Any]) -> ModelType:
        """
        Create and persist a new record.

        Args:
            data: Dict of column_name -> value.

        Returns:
            The newly created model instance.
        """
        instance = self.model(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(
        self, record_id: UUID | str, data: Dict[str, Any]
    ) -> Optional[ModelType]:
        """
        Update an existing record by primary key.

        Args:
            record_id: UUID of the record to update.
            data: Dict of column_name -> new_value.

        Returns:
            Updated model instance, or None if not found.
        """
        instance = await self.get_by_id(record_id)
        if not instance:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(instance, key, value)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update_fields(
        self, record_id: UUID | str, data: Dict[str, Any]
    ) -> Optional[ModelType]:
        """
        Update an existing record, allowing explicit None values.

        Unlike update(), this sets all provided keys including None values.
        """
        instance = await self.get_by_id(record_id)
        if not instance:
            return None
        for key, value in data.items():
            setattr(instance, key, value)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def delete(self, record_id: UUID | str) -> bool:
        """
        Delete a record by primary key.

        Args:
            record_id: UUID of the record to delete.

        Returns:
            True if deleted, False if not found.
        """
        instance = await self.get_by_id(record_id)
        if not instance:
            return False
        await self.db.delete(instance)
        await self.db.flush()
        return True

    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count records, optionally filtered."""
        stmt = select(func.count()).select_from(self.model)
        if filters:
            for col, val in filters.items():
                stmt = stmt.where(getattr(self.model, col) == val)
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def paginate(
        self,
        page: int = 1,
        page_size: int = 20,
        filters: Optional[Dict[str, Any]] = None,
        order_by: str = "created_at",
        descending: bool = True,
    ) -> Tuple[List[ModelType], int, int]:
        """
        Paginate records with optional filtering and ordering.

        Args:
            page: 1-indexed page number.
            page_size: Number of records per page.
            filters: Equality filters applied to the query.
            order_by: Column name to order by.
            descending: If True, order descending.

        Returns:
            Tuple of (items, total_count, total_pages).
        """
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 1

        offset = (page - 1) * page_size
        total = await self.count(filters)
        total_pages = math.ceil(total / page_size) if total > 0 else 1

        stmt = select(self.model)
        if filters:
            for col, val in filters.items():
                stmt = stmt.where(getattr(self.model, col) == val)

        order_col = getattr(self.model, order_by)
        stmt = stmt.order_by(order_col.desc() if descending else order_col.asc())
        stmt = stmt.offset(offset).limit(page_size)

        result = await self.db.execute(stmt)
        items = list(result.scalars().all())
        return items, total, total_pages

    async def exists(self, filters: Dict[str, Any]) -> bool:
        """Check whether any record matches the given filters."""
        stmt = select(func.count()).select_from(self.model)
        for col, val in filters.items():
            stmt = stmt.where(getattr(self.model, col) == val)
        result = await self.db.execute(stmt)
        return (result.scalar_one() or 0) > 0

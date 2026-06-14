"""
VerbaFlow AI - Document Repository
Domain-specific data access for Document entities.
"""
from __future__ import annotations

from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, DocumentStatus
from app.repositories.base import BaseRepository


class DocumentRepository(BaseRepository[Document]):
    """Repository for Document model with pipeline-aware methods."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Document, db)

    async def get_by_kb(
        self,
        kb_id: UUID,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        file_type: Optional[str] = None,
    ) -> Tuple[List[Document], int, int]:
        """
        Paginated documents within a knowledge base, optionally filtered.

        Args:
            kb_id: Knowledge base UUID.
            page: Page number (1-indexed).
            page_size: Items per page.
            status: Optional status filter.
            file_type: Optional file type filter.

        Returns:
            Tuple of (documents, total, total_pages).
        """
        from sqlalchemy import func

        conditions = [Document.kb_id == kb_id]
        if status:
            conditions.append(Document.status == status)
        if file_type:
            conditions.append(Document.file_type == file_type)

        stmt = select(Document).where(and_(*conditions))
        count_stmt = select(func.count()).select_from(Document).where(and_(*conditions))

        total = (await self.db.execute(count_stmt)).scalar_one()
        import math
        total_pages = math.ceil(total / page_size) if total > 0 else 1

        stmt = stmt.order_by(Document.created_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total, total_pages

    async def get_by_org(
        self,
        org_id: UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Document], int, int]:
        """Paginated documents scoped to an organisation."""
        return await self.paginate(
            page=page,
            page_size=page_size,
            filters={"org_id": org_id},
            order_by="created_at",
        )

    async def update_status(
        self,
        doc_id: UUID,
        status: DocumentStatus,
        error_message: Optional[str] = None,
        progress: Optional[int] = None,
        extra: Optional[dict] = None,
    ) -> None:
        """
        Atomically update the ingestion status of a document.

        Args:
            doc_id: Document UUID.
            status: New DocumentStatus value.
            error_message: Optional error detail.
            progress: Optional integer progress (0-100).
            extra: Optional additional column updates.
        """
        values: dict = {"status": status}
        if error_message is not None:
            values["error_message"] = error_message
        if progress is not None:
            values["ingestion_progress"] = progress
        if extra:
            values.update(extra)

        await self.db.execute(
            update(Document).where(Document.id == doc_id).values(**values)
        )
        await self.db.flush()

    async def get_by_status(
        self,
        org_id: UUID,
        status: DocumentStatus,
    ) -> List[Document]:
        """Return all documents in a given status for an org."""
        result = await self.db.execute(
            select(Document).where(
                and_(Document.org_id == org_id, Document.status == status)
            )
        )
        return list(result.scalars().all())

    async def bulk_delete(self, doc_ids: List[UUID], org_id: UUID) -> List[UUID]:
        """
        Delete multiple documents within an org, returning successfully deleted IDs.

        Args:
            doc_ids: List of document UUIDs to delete.
            org_id: Organisation scope to prevent cross-tenant deletion.

        Returns:
            List of successfully deleted document UUIDs.
        """
        deleted: List[UUID] = []
        for doc_id in doc_ids:
            result = await self.db.execute(
                select(Document).where(
                    and_(Document.id == doc_id, Document.org_id == org_id)
                )
            )
            doc = result.scalar_one_or_none()
            if doc:
                await self.db.delete(doc)
                deleted.append(doc_id)
        await self.db.flush()
        return deleted

    async def count_by_kb(self, kb_id: UUID) -> int:
        """Return count of documents in a knowledge base."""
        return await self.count({"kb_id": kb_id})

    async def get_total_size_by_kb(self, kb_id: UUID) -> int:
        """Return total bytes stored across all documents in a KB."""
        from sqlalchemy import func as sqlfunc
        result = await self.db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(Document.file_size), 0)).where(
                Document.kb_id == kb_id
            )
        )
        return result.scalar_one() or 0

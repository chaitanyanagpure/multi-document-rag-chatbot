"""
VerbaFlow AI - Chunk Repository
Handles bulk create and deletion of text chunks for the ingestion pipeline.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chunk import Chunk
from app.repositories.base import BaseRepository


class ChunkRepository(BaseRepository[Chunk]):
    """Repository for Chunk model with bulk operation support."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Chunk, db)

    async def get_by_document(self, doc_id: UUID) -> List[Chunk]:
        """
        Return all chunks for a specific document, ordered by chunk_index.

        Args:
            doc_id: Document UUID.

        Returns:
            List of Chunk instances.
        """
        result = await self.db.execute(
            select(Chunk)
            .where(Chunk.doc_id == doc_id)
            .order_by(Chunk.chunk_index.asc())
        )
        return list(result.scalars().all())

    async def get_by_kb(
        self,
        kb_id: UUID,
        limit: Optional[int] = None,
    ) -> List[Chunk]:
        """
        Return all chunks for a knowledge base.

        Args:
            kb_id: Knowledge base UUID.
            limit: Optional limit on the number of chunks returned.

        Returns:
            List of Chunk instances.
        """
        stmt = (
            select(Chunk)
            .where(Chunk.kb_id == kb_id)
            .order_by(Chunk.doc_id, Chunk.chunk_index)
        )
        if limit:
            stmt = stmt.limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def bulk_create(self, chunks_data: List[Dict[str, Any]]) -> List[Chunk]:
        """
        Efficiently create many chunk records in a single database round-trip.

        Args:
            chunks_data: List of dictionaries containing chunk field values.

        Returns:
            List of created Chunk ORM instances.
        """
        instances = [Chunk(**data) for data in chunks_data]
        self.db.add_all(instances)
        await self.db.flush()
        return instances

    async def delete_by_document(self, doc_id: UUID) -> int:
        """
        Delete all chunks associated with a document.

        Args:
            doc_id: Document UUID.

        Returns:
            Number of deleted rows.
        """
        result = await self.db.execute(
            delete(Chunk).where(Chunk.doc_id == doc_id)
        )
        await self.db.flush()
        return result.rowcount

    async def delete_by_kb(self, kb_id: UUID) -> int:
        """
        Delete all chunks for a knowledge base (e.g., when deleting the KB).

        Args:
            kb_id: Knowledge base UUID.

        Returns:
            Number of deleted rows.
        """
        result = await self.db.execute(
            delete(Chunk).where(Chunk.kb_id == kb_id)
        )
        await self.db.flush()
        return result.rowcount

    async def get_by_ids(self, chunk_ids: List[UUID]) -> List[Chunk]:
        """Retrieve specific chunks by their UUIDs."""
        result = await self.db.execute(
            select(Chunk).where(Chunk.id.in_(chunk_ids))
        )
        return list(result.scalars().all())

    async def count_by_document(self, doc_id: UUID) -> int:
        """Count chunks for a document."""
        return await self.count({"doc_id": doc_id})

    async def count_by_kb(self, kb_id: UUID) -> int:
        """Count chunks for a knowledge base."""
        return await self.count({"kb_id": kb_id})

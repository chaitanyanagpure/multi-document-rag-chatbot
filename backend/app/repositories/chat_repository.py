"""
VerbaFlow AI - Chat Repository
Domain-specific data access for Chat and Message entities.
"""
from __future__ import annotations

import secrets
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, or_, select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import Chat
from app.models.message import Message, MessageRole
from app.repositories.base import BaseRepository


class ChatRepository(BaseRepository[Chat]):
    """Repository for Chat model with message-aware methods."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Chat, db)

    async def get_by_user(
        self,
        user_id: UUID,
        org_id: UUID,
        page: int = 1,
        page_size: int = 20,
        folder_name: Optional[str] = None,
        pinned_only: bool = False,
    ) -> Tuple[List[Chat], int, int]:
        """
        Paginated chats for a specific user within an organisation.

        Args:
            user_id: User UUID.
            org_id: Organisation UUID.
            page: 1-indexed page number.
            page_size: Items per page.
            folder_name: Optional folder to filter by.
            pinned_only: If True, return only pinned chats.

        Returns:
            Tuple of (chats, total_count, total_pages).
        """
        from sqlalchemy import func
        import math

        conditions = [Chat.user_id == user_id, Chat.org_id == org_id]
        if folder_name:
            conditions.append(Chat.folder_name == folder_name)
        if pinned_only:
            conditions.append(Chat.is_pinned == True)  # noqa: E712

        count_stmt = (
            select(func.count()).select_from(Chat).where(and_(*conditions))
        )
        total = (await self.db.execute(count_stmt)).scalar_one()
        total_pages = math.ceil(total / page_size) if total > 0 else 1

        stmt = (
            select(Chat)
            .where(and_(*conditions))
            .order_by(Chat.is_pinned.desc(), Chat.updated_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total, total_pages

    async def create_with_message(
        self,
        user_id: UUID,
        kb_id: UUID,
        org_id: UUID,
        title: str,
        first_message_content: str,
    ) -> Chat:
        """
        Create a new chat and its initial user message in a single operation.

        Args:
            user_id: Owner of the chat.
            kb_id: Knowledge base the chat is scoped to.
            org_id: Organisation scope.
            title: Chat title.
            first_message_content: The first user message to store.

        Returns:
            The newly created Chat instance.
        """
        chat = Chat(
            user_id=user_id,
            kb_id=kb_id,
            org_id=org_id,
            title=title,
            message_count=1,
            last_message_preview=first_message_content[:200],
        )
        self.db.add(chat)
        await self.db.flush()
        await self.db.refresh(chat)

        message = Message(
            chat_id=chat.id,
            role=MessageRole.USER,
            content=first_message_content,
        )
        self.db.add(message)
        await self.db.flush()
        return chat

    async def get_pinned(self, user_id: UUID, org_id: UUID) -> List[Chat]:
        """Return all pinned chats for a user."""
        result = await self.db.execute(
            select(Chat)
            .where(
                and_(
                    Chat.user_id == user_id,
                    Chat.org_id == org_id,
                    Chat.is_pinned == True,  # noqa: E712
                )
            )
            .order_by(Chat.updated_at.desc())
        )
        return list(result.scalars().all())

    async def search_by_title(
        self,
        user_id: UUID,
        org_id: UUID,
        query: str,
        limit: int = 10,
    ) -> List[Chat]:
        """
        Full-text-style search of chat titles using ILIKE.

        Args:
            user_id: Owner scope.
            org_id: Org scope.
            query: Search string.
            limit: Maximum results.

        Returns:
            Matching Chat instances.
        """
        result = await self.db.execute(
            select(Chat)
            .where(
                and_(
                    Chat.user_id == user_id,
                    Chat.org_id == org_id,
                    Chat.title.ilike(f"%{query}%"),
                )
            )
            .order_by(Chat.updated_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_share_token(self, share_token: str) -> Optional[Chat]:
        """Retrieve a shared chat by its public share token."""
        result = await self.db.execute(
            select(Chat).where(
                and_(Chat.share_token == share_token, Chat.is_shared == True)  # noqa: E712
            )
        )
        return result.scalar_one_or_none()

    async def generate_share_token(self, chat_id: UUID) -> str:
        """Generate and persist a unique share token for the chat."""
        token = secrets.token_urlsafe(32)
        await self.db.execute(
            update(Chat)
            .where(Chat.id == chat_id)
            .values(share_token=token, is_shared=True)
        )
        await self.db.flush()
        return token

    async def increment_message_count(
        self,
        chat_id: UUID,
        preview: Optional[str] = None,
    ) -> None:
        """Increment the denormalized message_count and update the last preview."""
        stmt = select(Chat).where(Chat.id == chat_id)
        result = await self.db.execute(stmt)
        chat = result.scalar_one_or_none()
        if chat:
            chat.message_count = (chat.message_count or 0) + 1
            if preview:
                chat.last_message_preview = preview[:200]
            await self.db.flush()

    async def get_messages(
        self,
        chat_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Message]:
        """Return messages for a chat with citation eager loading."""
        result = await self.db.execute(
            select(Message)
            .where(Message.chat_id == chat_id)
            .options(selectinload(Message.citations))
            .order_by(Message.created_at.asc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

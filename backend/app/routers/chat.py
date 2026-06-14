"""
VerbaFlow AI - Chat Router
Enables chat session CRUD, message indexing, citation mapping, and Server-Sent Events (SSE) streaming.
"""
from __future__ import annotations

import logging
from typing import List, Dict, Any, Optional
from uuid import UUID
import json
import time

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.chat import Chat
from app.models.message import Message, MessageRole, MessageCitation
from app.schemas.chat import ChatCreate, ChatUpdate, ChatResponse, ChatListResponse
from app.schemas.message import MessageCreate, MessageResponse, ChatQueryRequest
from app.repositories.chat_repository import ChatRepository
from app.services.rag_service import RAGPipeline
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chats", tags=["Chat"])


@router.get("", response_model=List[ChatResponse])
async def list_chats(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    folder: Optional[str] = Query(None),
    pinned: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve all chat sessions for the authenticated user, paginated."""
    repo = ChatRepository(db)
    chats, _, _ = await repo.get_by_user(
        user_id=current_user.id,
        org_id=current_user.org_id,
        page=page,
        page_size=page_size,
        folder_name=folder,
        pinned_only=pinned
    )
    return chats


@router.post("", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
async def create_chat(
    payload: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new blank chat session scoped to a knowledge base."""
    chat = Chat(
        title=payload.title or "New Chat",
        user_id=current_user.id,
        kb_id=payload.kb_id,
        org_id=current_user.org_id,
        folder_name=payload.folder_name,
        is_pinned=False,
        is_shared=False,
        message_count=0
    )
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat


@router.get("/{chat_id}", response_model=ChatResponse)
async def get_chat(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve details of a chat session, verifying ownership."""
    stmt = select(Chat).where(
        and_(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    res = await db.execute(stmt)
    chat = res.scalar_one_or_none()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat thread not found or access denied."
        )
    return chat


@router.put("/{chat_id}", response_model=ChatResponse)
async def update_chat(
    chat_id: UUID,
    payload: ChatUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Pin, rename, or organize chat threads into custom folders."""
    stmt = select(Chat).where(
        and_(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    res = await db.execute(stmt)
    chat = res.scalar_one_or_none()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat thread not found."
        )

    if payload.title is not None:
        chat.title = payload.title
    if payload.is_pinned is not None:
        chat.is_pinned = payload.is_pinned
    if payload.folder_name is not None:
        chat.folder_name = payload.folder_name

    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a chat session and clean up all associated messages and citations."""
    stmt = select(Chat).where(
        and_(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    res = await db.execute(stmt)
    chat = res.scalar_one_or_none()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat thread not found."
        )

    await db.delete(chat)
    await db.commit()
    return None


@router.get("/{chat_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    chat_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all messages and citations in a chat conversation thread."""
    # Verify ownership
    chat_stmt = select(Chat).where(
        and_(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    chat_res = await db.execute(chat_stmt)
    if not chat_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat thread not found."
        )

    repo = ChatRepository(db)
    messages = await repo.get_messages(chat_id, limit, offset)
    return messages


@router.post("/{chat_id}/messages")
async def send_message(
    chat_id: UUID,
    payload: ChatQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Submit a prompt to the RAG pipeline. Streams answers using Server-Sent Events (SSE).
    """
    # 1. Verify chat ownership
    chat_stmt = select(Chat).where(
        and_(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    chat_res = await db.execute(chat_stmt)
    chat = chat_res.scalar_one_or_none()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat thread not found."
        )

    # 2. Fetch history
    repo = ChatRepository(db)
    history_messages = await repo.get_messages(chat_id, limit=10)
    chat_history = [{"role": m.role.value, "content": m.content} for m in history_messages]

    # 3. Create User Message
    user_msg = Message(
        chat_id=chat_id,
        role=MessageRole.USER,
        content=payload.message,
        token_count=len(payload.message.split())  # raw count estimate
    )
    db.add(user_msg)
    
    # Update preview
    chat.last_message_preview = payload.message[:200]
    chat.message_count += 1
    await db.flush()

    # 4. Stream response generator
    async def sse_generator():
        # Open fresh DB context manager to run pipeline and commits
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as bg_db:
            pipeline = RAGPipeline(bg_db)
            
            # Start timer to log latency
            start_time = time.time()
            full_response = ""
            citations_data = []
            diagnostics_data = None

            async for event in pipeline.aquery(
                query=payload.message,
                kb_id=chat.kb_id,
                chat_history=chat_history,
                config=payload.config or {}
            ):
                if event["type"] == "citation":
                    citations_data = event["citations"]
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "token":
                    full_response += event["token"]
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "diagnostics":
                    diagnostics_data = event["diagnostics"]
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "error":
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "done":
                    # End of streaming, yield complete status
                    yield f"data: {json.dumps(event)}\n\n"

            # Log LLM Latency
            latency_ms = int((time.time() - start_time) * 1000)

            # Save assistant response to DB
            asst_msg = Message(
                chat_id=chat_id,
                role=MessageRole.ASSISTANT,
                content=full_response,
                token_count=len(full_response.split()),
                latency_ms=latency_ms,
                model_used=settings.GEMINI_MODEL,
                diagnostics_json=diagnostics_data
            )
            bg_db.add(asst_msg)
            await bg_db.flush()

            # Save citations
            for cit in citations_data:
                citation_orm = MessageCitation(
                    message_id=asst_msg.id,
                    chunk_id=UUID(cit["chunk_id"]) if cit.get("chunk_id") else None,
                    doc_id=UUID(cit["doc_id"]) if cit.get("doc_id") else None,
                    page_number=cit.get("page_number"),
                    similarity_score=cit.get("similarity_score"),
                    relevance_score=cit.get("relevance_score"),
                    excerpt=cit.get("excerpt")
                )
                bg_db.add(citation_orm)

            # Increment message count for assistant turn
            bg_chat = await bg_db.get(Chat, chat_id)
            if bg_chat:
                bg_chat.message_count += 1
                bg_chat.last_message_preview = full_response[:200]
                
            await bg_db.commit()

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


@router.post("/{chat_id}/share", response_model=Dict[str, str])
async def share_chat(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Enable link sharing for the chat session and return a public share token."""
    repo = ChatRepository(db)
    chat = await repo.get_by_id(chat_id)
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found."
        )

    token = await repo.generate_share_token(chat_id)
    await db.commit()
    return {"share_token": token, "url": f"/chats/shared/{token}"}


@router.get("/shared/{share_token}", response_model=ChatResponse)
async def get_shared_chat(
    share_token: str,
    db: AsyncSession = Depends(get_db)
):
    """Access a publicly shared chat session's metadata and conversation history."""
    repo = ChatRepository(db)
    chat = await repo.get_by_share_token(share_token)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared chat session not found or link disabled."
        )
    return chat

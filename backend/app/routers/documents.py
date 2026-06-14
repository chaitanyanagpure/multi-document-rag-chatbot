"""
VerbaFlow AI - Documents Router
Manages file uploads, extraction tasks, document removal, and real-time status streaming.
"""
from __future__ import annotations

import os
import logging
import uuid
import time
import json
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user, verify_token
from app.models.user import User
from app.models.document import Document, DocumentStatus
from app.models.knowledge_base import KnowledgeBase
from app.models.chunk import Chunk
from app.schemas.document import DocumentResponse
from app.repositories.document_repository import DocumentRepository
from app.repositories.chunk_repository import ChunkRepository
from app.services.ingestion_service import IngestionService, IngestionProgressManager
from app.services.vector_store import VectorStoreFactory
from app.services.bm25_service import bm25_registry

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Documents"])


@router.post("/kb/{kb_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    kb_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a document and trigger the 10-step ingestion pipeline in the background.
    """
    logger.info(f"Starting file upload: name={file.filename}, kb_id={kb_id}, user={current_user.email}")
    # 1. Verify KB exists and user has access
    kb_stmt = select(KnowledgeBase).where(
        and_(KnowledgeBase.id == kb_id, KnowledgeBase.org_id == current_user.org_id)
    )
    kb_res = await db.execute(kb_stmt)
    kb = kb_res.scalar_one_or_none()
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found or access denied."
        )

    # 2. Check file size
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    max_size_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if file_size > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB."
        )

    # 3. Save file to disk
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_ext = os.path.splitext(file.filename)[1].replace(".", "").lower() or "txt"
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    dest_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    with open(dest_path, "wb") as f:
        f.write(file.file.read())

    logger.info(f"File upload success: name={file.filename}, path={dest_path}, size={file_size} bytes")

    # 4. Save document record in DB with proper UPLOADING enum status
    doc = Document(
        kb_id=kb_id,
        org_id=current_user.org_id,
        name=file.filename,
        original_filename=file.filename,
        file_type=file_ext,
        file_path=dest_path,
        file_size=file_size,
        status=DocumentStatus.UPLOADING,
        uploaded_by=current_user.id,
        version=1,
        page_count=0,
        metadata_json={}
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # 5. Initialize progress metrics
    IngestionProgressManager.set_progress(doc.id, 1, "upload_complete", "Document successfully uploaded.")

    # 6. Trigger async ingestion pipeline in the background
    doc_id_copy = doc.id  # Capture doc.id before background task (avoids session issues)
    kb_settings = {
        "chunk_size": kb.settings_json.get("chunk_size", settings.CHUNK_SIZE) if kb.settings_json else settings.CHUNK_SIZE,
        "chunk_overlap": kb.settings_json.get("chunk_overlap", settings.CHUNK_OVERLAP) if kb.settings_json else settings.CHUNK_OVERLAP,
        "chunking_strategy": kb.settings_json.get("chunking_strategy", "recursive") if kb.settings_json else "recursive",
    }
    
    async def run_pipeline():
        """Background task: runs ingestion pipeline in its own DB session."""
        from app.core.database import AsyncSessionLocal
        from sqlalchemy import text
        try:
            async with AsyncSessionLocal() as bg_db:
                logger.info(f"[PIPELINE START] Background ingestion task started for doc {doc_id_copy}")
                service = IngestionService(bg_db)
                success = await service.ingest_document(doc_id_copy, chunk_settings=kb_settings)
                if success:
                    logger.info(f"[PIPELINE SUCCESS] Ingestion complete for doc {doc_id_copy}")
                else:
                    logger.error(f"[PIPELINE FAILED] Ingestion returned False for doc {doc_id_copy}")
        except Exception as pipeline_err:
            logger.critical(f"[PIPELINE CRASH] Unhandled exception in background pipeline for doc {doc_id_copy}: {pipeline_err}", exc_info=True)
            # Last-resort: mark document as FAILED in the DB directly
            try:
                async with AsyncSessionLocal() as recovery_db:
                    await recovery_db.execute(
                        text("UPDATE documents SET status='FAILED', error_message=:err WHERE id=:id"),
                        {"err": "Queue processing failed", "id": str(doc_id_copy)}
                    )
                    await recovery_db.commit()
                    logger.info(f"[PIPELINE CRASH] Marked doc {doc_id_copy} as FAILED after unhandled exception")
            except Exception as recovery_err:
                logger.critical(f"[PIPELINE CRASH] Could not mark doc as FAILED: {recovery_err}")
            IngestionProgressManager.set_progress(doc_id_copy, 0, "failed", "Queue processing failed")

    background_tasks.add_task(run_pipeline)
    return doc


@router.get("/kb/{kb_id}/documents", response_model=List[DocumentResponse])
async def list_documents(
    kb_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all documents uploaded to a knowledge base."""
    stmt = select(Document).where(
        and_(Document.kb_id == kb_id, Document.org_id == current_user.org_id)
    ).order_by(Document.created_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.delete("/kb/{kb_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    kb_id: UUID,
    doc_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a document from a knowledge base and remove its vectors from FAISS/BM25 indexes."""
    stmt = select(Document).where(
        and_(
            Document.id == doc_id,
            Document.kb_id == kb_id,
            Document.org_id == current_user.org_id
        )
    )
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied."
        )

    # 1. Fetch document chunk IDs
    chunk_repo = ChunkRepository(db)
    chunks = await chunk_repo.get_by_document(doc_id)
    chunk_ids = [c.id for c in chunks]

    # 2. Delete from Vector Store and BM25 index
    try:
        vs = VectorStoreFactory.get_store()
        await vs.delete_by_document(kb_id, doc_id, chunk_ids)
        await bm25_registry.delete_by_document(kb_id, chunk_ids)
    except Exception as e:
        logger.error(f"Failed to clear index vectors for document {doc_id}: {e}")

    # 3. Delete file on disk
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            logger.error(f"Failed to remove file from disk: {e}")

    # 4. Delete document record (cascade deletes chunks automatically)
    await db.delete(doc)
    
    # 5. Decrement KB stats
    kb_stmt = select(KnowledgeBase).where(KnowledgeBase.id == kb_id)
    kb_res = await db.execute(kb_stmt)
    kb = kb_res.scalar_one_or_none()
    if kb:
        kb.document_count = max(0, kb.document_count - 1)
        kb.total_size_bytes = max(0, kb.total_size_bytes - doc.file_size)

    await db.commit()
    return None


@router.get("/documents/{doc_id}/status")
async def get_document_status(
    doc_id: UUID,
    request: Request,
    token: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db)
):
    """
    Server-Sent Events (SSE) endpoint to stream real-time document ingestion pipeline progress.
    Accepts JWT via:
      - Authorization: Bearer <token>  (standard)
      - ?token=<jwt>                   (EventSource fallback, since browser EventSource cannot set headers)
    """
    # Resolve token from either header or query param
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        resolved_token = auth_header[7:]
    elif token:
        resolved_token = token
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated — provide Bearer token or ?token= query param.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate JWT and fetch user
    from app.repositories.user_repository import UserRepository
    try:
        payload = verify_token(resolved_token, token_type="access")
        user_id: str = payload["sub"]
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    repo = UserRepository(db)
    current_user = await repo.get_by_id(user_id)
    if current_user is None or not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )

    # Verify access to the document
    stmt = select(Document).where(
        and_(Document.id == doc_id, Document.org_id == current_user.org_id)
    )
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )

    async def event_generator():
        """Yields SSE events until ingestion is complete or failed."""
        max_wait_iterations = 300  # 5-minute hard cap to prevent infinite streams
        iterations = 0
        while iterations < max_wait_iterations:
            iterations += 1
            # First check in-memory progress manager (most up-to-date)
            progress = IngestionProgressManager.get_progress(doc_id)
            if progress:
                yield f"data: {json.dumps(progress)}\n\n"
                if progress["status"] in ["ready", "failed"]:
                    break
            else:
                # Fallback to DB state
                db_doc = await db.get(Document, doc_id)
                if db_doc:
                    status_upper = db_doc.status.upper() if db_doc.status else ""
                    if status_upper == "READY":
                        stage = "Completed"
                        step_num = 10
                    elif status_upper == "FAILED":
                        stage = "Failed"
                        step_num = 0
                    elif status_upper == "UPLOADING":
                        stage = "Uploading"
                        step_num = 1
                    elif status_upper == "SCANNING":
                        stage = "Uploading"
                        step_num = 2
                    elif status_upper == "EXTRACTING":
                        stage = "Extracting Text"
                        step_num = 3
                    elif status_upper == "CHUNKING":
                        stage = "Chunking"
                        step_num = 6
                    elif status_upper == "EMBEDDING":
                        stage = "Generating Embeddings"
                        step_num = 7
                    else:
                        stage = "Uploading"
                        step_num = 1

                    db_progress = {
                        "document_id": str(doc_id),
                        "step": step_num,
                        "status": db_doc.status.lower() if db_doc.status else "uploading",
                        "stage": stage,
                        "detail": db_doc.error_message or "Syncing pipeline status...",
                        "timestamp": time.time()
                    }
                    yield f"data: {json.dumps(db_progress)}\n\n"
                    if db_doc.status in ["ready", "failed"]:
                        break

            await asyncio.sleep(1.0)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )

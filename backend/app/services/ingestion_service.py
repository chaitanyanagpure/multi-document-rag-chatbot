"""
VerbaFlow AI - Ingestion Pipeline Service
Orchestrates the 10-step document ingestion workflow:
Upload -> Scan -> Extract -> Clean -> Metadata -> Chunk -> Embed -> Store -> Validate -> Update KB.
"""
from __future__ import annotations

import os
import time
import logging
from typing import Dict, Any, List, Optional
from uuid import UUID
import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.document import Document, DocumentStatus
from app.models.chunk import Chunk
from app.models.knowledge_base import KnowledgeBase
from app.repositories.document_repository import DocumentRepository
from app.repositories.chunk_repository import ChunkRepository
from app.repositories.base import BaseRepository
from app.services.document_processor import DocumentProcessor
from app.services.chunker import ChunkerFactory
from app.services.embedding_service import EmbeddingServiceFactory
from app.services.vector_store import VectorStoreFactory
from app.services.bm25_service import bm25_registry

logger = logging.getLogger(__name__)


# Global progress dictionary to track live websocket updates
# Key: document_id, Value: current status dict
ingestion_progress: Dict[str, Dict[str, Any]] = {}
ingestion_telemetry: Dict[str, Dict[str, Any]] = {}


class IngestionProgressManager:
    """Manages memory mapping of running ingestion jobs."""

    @classmethod
    def set_progress(cls, doc_id: UUID, step: int, status: str, detail: str) -> None:
        doc_str = str(doc_id)
        
        # Map step to the required stage name
        stage = "Uploading"
        if status == "ready" or status == "completed":
            stage = "Completed"
        elif status == "failed":
            stage = "Failed"
        elif step == 1 or step == 2:
            stage = "Uploading"
        elif step in (3, 4, 5):
            stage = "Extracting Text"
        elif step == 6:
            stage = "Chunking"
        elif step == 7:
            stage = "Generating Embeddings"
        elif step in (8, 9):
            stage = "Saving Vectors"
        elif step == 10:
            stage = "Updating Knowledge Base"

        ingestion_progress[doc_str] = {
            "document_id": doc_str,
            "step": step,
            "status": status,
            "stage": stage,
            "detail": detail,
            "timestamp": time.time()
        }
        logger.info(f"Ingestion progress [Doc {doc_id}]: Step {step}/10 - {status} ({detail}) - Stage: {stage}")

    @classmethod
    def get_progress(cls, doc_id: UUID) -> Optional[Dict[str, Any]]:
        return ingestion_progress.get(str(doc_id))


class IngestionTelemetryManager:
    """Manages memory mapping of ingestion telemetry for logging."""

    @classmethod
    def init_telemetry(cls, doc_id: UUID) -> None:
        doc_str = str(doc_id)
        ingestion_telemetry[doc_str] = {
            "document_id": doc_str,
            "current_stage": "Uploading",
            "start_time": time.time(),
            "end_time": None,
            "processing_duration": None,
            "retry_count": 0,
            "embedding_api_calls": 0,
            "vector_insert_operations": 0,
            "failure_reasons": [],
            "timeout_events": []
        }

    @classmethod
    def update_stage(cls, doc_id: UUID, stage: str) -> None:
        doc_str = str(doc_id)
        if doc_str in ingestion_telemetry:
            ingestion_telemetry[doc_str]["current_stage"] = stage

    @classmethod
    def increment_api_calls(cls, doc_id: UUID) -> None:
        doc_str = str(doc_id)
        if doc_str in ingestion_telemetry:
            ingestion_telemetry[doc_str]["embedding_api_calls"] += 1

    @classmethod
    def increment_retries(cls, doc_id: UUID, count: int = 1) -> None:
        doc_str = str(doc_id)
        if doc_str in ingestion_telemetry:
            ingestion_telemetry[doc_str]["retry_count"] += count

    @classmethod
    def increment_vector_inserts(cls, doc_id: UUID, count: int = 1) -> None:
        doc_str = str(doc_id)
        if doc_str in ingestion_telemetry:
            ingestion_telemetry[doc_str]["vector_insert_operations"] += count

    @classmethod
    def add_failure_reason(cls, doc_id: UUID, reason: str) -> None:
        doc_str = str(doc_id)
        if doc_str in ingestion_telemetry:
            ingestion_telemetry[doc_str]["failure_reasons"].append(reason)

    @classmethod
    def add_timeout_event(cls, doc_id: UUID, event_desc: str) -> None:
        doc_str = str(doc_id)
        if doc_str in ingestion_telemetry:
            ingestion_telemetry[doc_str]["timeout_events"].append(event_desc)

    @classmethod
    def finalize_and_log(cls, doc_id: UUID, final_stage: str) -> None:
        doc_str = str(doc_id)
        if doc_str in ingestion_telemetry:
            tel = ingestion_telemetry[doc_str]
            tel["end_time"] = time.time()
            tel["processing_duration"] = tel["end_time"] - tel["start_time"]
            tel["current_stage"] = final_stage
            
            # Log all structured fields as requested
            logger.info(
                f"[TELEMETRY LOG] Ingestion Telemetry for Doc {doc_id}:\n"
                f"  Document ID: {tel['document_id']}\n"
                f"  Current Stage: {tel['current_stage']}\n"
                f"  Start Time: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(tel['start_time']))}\n"
                f"  End Time: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(tel['end_time']))}\n"
                f"  Processing Duration: {tel['processing_duration']:.2f} seconds\n"
                f"  Retry Count: {tel['retry_count']}\n"
                f"  Embedding API Calls: {tel['embedding_api_calls']}\n"
                f"  Vector Insert Operations: {tel['vector_insert_operations']}\n"
                f"  Failure Reasons: {tel['failure_reasons']}\n"
                f"  Timeout Events: {tel['timeout_events']}"
            )



class IngestionService:
    """
    Orchestrates the ingestion of a uploaded document.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.doc_repo = DocumentRepository(db)
        self.chunk_repo = ChunkRepository(db)
        self.kb_repo = BaseRepository(KnowledgeBase, db)
        self.embedding_provider = EmbeddingServiceFactory.get_provider()
        self.vector_store = VectorStoreFactory.get_store()

    async def ingest_document(self, doc_id: UUID, chunk_settings: Dict[str, Any] = {}) -> bool:
        """
        Runs the full 10-step document ingestion asynchronously.
        """
        # Initialize telemetry
        IngestionTelemetryManager.init_telemetry(doc_id)

        # Fetch document
        doc = await self.doc_repo.get_by_id(doc_id)
        if not doc:
            logger.error(f"Ingestion failed: Document {doc_id} not found in DB.")
            return False

        file_path = doc.file_path
        if not os.path.exists(file_path):
            doc.status = "failed"
            doc.error_message = "File processing failed"
            await self.db.commit()
            IngestionProgressManager.set_progress(doc_id, 0, "failed", doc.error_message)
            IngestionTelemetryManager.add_failure_reason(doc_id, "File processing failed")
            IngestionTelemetryManager.finalize_and_log(doc_id, "Failed")
            return False

        # Record pipeline start time
        start_pipeline = time.time()
        try:
            # Load default KB settings if not passed
            chunk_size = chunk_settings.get("chunk_size", settings.CHUNK_SIZE)
            chunk_overlap = chunk_settings.get("chunk_overlap", settings.CHUNK_OVERLAP)
            strategy = chunk_settings.get("chunking_strategy", "recursive")

            # ----------------------------------------------------
            # Step 1: Upload (Already completed)
            # ----------------------------------------------------
            logger.info(f"[UPLOAD START] Ingestion started for document {doc_id} (name: {doc.name})")
            IngestionTelemetryManager.update_stage(doc_id, "Uploading")
            IngestionProgressManager.set_progress(doc_id, 1, "upload_complete", "Document upload verified.")
            await self.doc_repo.update_status(doc_id, DocumentStatus.SCANNING)
            await self.db.commit()
            await asyncio.sleep(0.01)

            # ----------------------------------------------------
            # Step 2: Virus / Integrity Scan
            # ----------------------------------------------------
            IngestionProgressManager.set_progress(doc_id, 2, "scanning", "Scanning document for malware and safety...")
            processor = DocumentProcessor()
            is_safe = processor.scan_file_safety(file_path)
            if not is_safe:
                raise ValueError("Document failed security checks. Suspicious headers or file structure.")
            logger.info(f"Malware scan successful for document {doc_id} (path: {file_path})")
            await asyncio.sleep(0.01)

            # ----------------------------------------------------
            # Step 3: Text Extraction
            # ----------------------------------------------------
            IngestionProgressManager.set_progress(doc_id, 3, "extracting", "Extracting plain text contents...")
            start_extract = time.time()
            ext = doc.file_type.lower()
            
            async def _extract_text_task():
                if ext == "pdf":
                    return await processor.extract_text_from_pdf(file_path)
                elif ext in ["docx", "doc"]:
                    return await processor.extract_text_from_docx(file_path)
                elif ext in ["xlsx", "xls"]:
                    return await processor.extract_text_from_xlsx(file_path)
                elif ext in ["pptx", "ppt"]:
                    return await processor.extract_text_from_pptx(file_path)
                elif ext == "csv":
                    return await processor.extract_text_from_csv(file_path)
                elif ext == "html":
                    return await processor.extract_text_from_html(file_path)
                elif ext == "md":
                    return await processor.extract_text_from_markdown(file_path)
                else:
                    return await processor.extract_text_from_txt(file_path)

            try:
                # 300s (5 minutes) timeout limit for text extraction
                extracted_text = await asyncio.wait_for(_extract_text_task(), timeout=300.0)
            except asyncio.TimeoutError:
                IngestionTelemetryManager.add_timeout_event(doc_id, "Text extraction timed out after 300 seconds.")
                raise TimeoutError("File processing failed")

            if not extracted_text.strip():
                raise ValueError("File processing failed")

            duration_extract = time.time() - start_extract
            logger.info(f"[STAGE DURATION] Doc {doc_id} - Text Extraction: {duration_extract:.4f}s. Extracted {len(extracted_text)} characters.")
            IngestionTelemetryManager.update_stage(doc_id, "Extracting Text")
            await self.doc_repo.update_status(doc_id, DocumentStatus.EXTRACTING)
            await self.db.commit()
            await asyncio.sleep(0.01)

            # ----------------------------------------------------
            # Step 4: Text Cleaning
            # ----------------------------------------------------
            IngestionProgressManager.set_progress(doc_id, 4, "cleaning", "Cleaning text and normalizing layout...")
            start_clean = time.time()
            clean_text = processor.clean_text(extracted_text)
            duration_clean = time.time() - start_clean
            logger.info(f"[STAGE DURATION] Doc {doc_id} - Text Cleaning: {duration_clean:.4f}s")
            await asyncio.sleep(0.01)

            # ----------------------------------------------------
            # Step 5: Metadata Extraction
            # ----------------------------------------------------
            IngestionProgressManager.set_progress(doc_id, 5, "metadata_extraction", "Extracting document metadata...")
            start_metadata = time.time()
            metadata = await processor.extract_metadata(file_path, ext)
            doc.page_count = metadata.get("page_count", 1)
            doc.metadata_json = metadata
            await self.db.flush()
            duration_metadata = time.time() - start_metadata
            logger.info(f"[STAGE DURATION] Doc {doc_id} - Metadata Extraction: {duration_metadata:.4f}s")
            await asyncio.sleep(0.01)

            # ----------------------------------------------------
            # Step 6: Chunking
            # ----------------------------------------------------
            IngestionTelemetryManager.update_stage(doc_id, "Chunking")
            IngestionProgressManager.set_progress(doc_id, 6, "chunking", f"Splitting document into chunks ({strategy})...")
            await self.doc_repo.update_status(doc_id, DocumentStatus.CHUNKING)
            await self.db.commit()
            
            start_chunk = time.time()
            chunker = ChunkerFactory.create(
                strategy=strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )
            raw_chunks = chunker.chunk(clean_text)
            
            if not raw_chunks:
                raise ValueError("No chunks created. Text too short or chunking config invalid.")

            # Create chunk database entities
            chunks_to_create = []
            for i, rc in enumerate(raw_chunks):
                chunks_to_create.append({
                    "doc_id": doc_id,
                    "kb_id": doc.kb_id,
                    "org_id": doc.org_id,
                    "content": rc.content,
                    "page_number": rc.page_number or (i + 1),  # fallback page mapping
                    "chunk_index": i,
                    "token_count": rc.token_count,
                    "metadata_json": rc.metadata
                })

            # Save in DB
            created_chunks = await self.chunk_repo.bulk_create(chunks_to_create)
            duration_chunk = time.time() - start_chunk
            logger.info(f"[STAGE DURATION] Doc {doc_id} - Chunking: {duration_chunk:.4f}s. Created {len(created_chunks)} chunks using strategy '{strategy}'")
            await asyncio.sleep(0.01)

            # ----------------------------------------------------
            # Step 7: Embedding Generation
            # ----------------------------------------------------
            IngestionTelemetryManager.update_stage(doc_id, "Generating Embeddings")
            IngestionProgressManager.set_progress(doc_id, 7, "embedding", "Generating vector embeddings for chunks...")
            await self.doc_repo.update_status(doc_id, DocumentStatus.EMBEDDING)
            await self.db.commit()
            
            chunk_contents = [c.content for c in created_chunks]
            start_emb = time.time()
            
            # Setup stage-level timeout (minimum 180s, scaling with number of batches of 100)
            num_batches = (len(chunk_contents) + 99) // 100
            emb_timeout = max(180.0, num_batches * 60.0)
            
            try:
                embeddings = await asyncio.wait_for(
                    self.embedding_provider.embed_documents(chunk_contents, doc_id=doc_id),
                    timeout=emb_timeout
                )
            except asyncio.TimeoutError:
                IngestionTelemetryManager.add_timeout_event(doc_id, f"Embedding generation timed out after {emb_timeout} seconds.")
                raise TimeoutError("Embedding generation timeout")
            except Exception as e:
                raise ValueError(f"Embedding API failure: {str(e)}")

            duration_emb = time.time() - start_emb
            logger.info(f"[STAGE DURATION] Doc {doc_id} - Embedding Generation: {duration_emb:.4f}s. Generated {len(embeddings)} embeddings.")
            await asyncio.sleep(0.01)

            # ----------------------------------------------------
            # Step 8: Vector Database storage
            # ----------------------------------------------------
            IngestionTelemetryManager.update_stage(doc_id, "Saving Vectors")
            IngestionProgressManager.set_progress(doc_id, 8, "storing", "Storing embeddings in Vector Database index...")
            start_store = time.time()
            chunk_ids = [c.id for c in created_chunks]
            
            try:
                # 120 seconds timeout limit for vector store insert
                await asyncio.wait_for(
                    self.vector_store.add_chunks(doc.kb_id, chunk_ids, embeddings),
                    timeout=120.0
                )
                # Increment vector inserts telemetry
                IngestionTelemetryManager.increment_vector_inserts(doc_id, len(chunk_ids))
            except asyncio.TimeoutError:
                IngestionTelemetryManager.add_timeout_event(doc_id, "Vector storage timed out after 120 seconds.")
                raise TimeoutError("Vector database unavailable")
            except Exception as e:
                raise ValueError(f"Vector database unavailable: {str(e)}")

            duration_store = time.time() - start_store
            logger.info(f"[STAGE DURATION] Doc {doc_id} - Vector Storage: {duration_store:.4f}s. Inserted {len(chunk_ids)} vectors in FAISS index.")
            await asyncio.sleep(0.01)

            # ----------------------------------------------------
            # Step 9: Index Validation
            # ----------------------------------------------------
            IngestionProgressManager.set_progress(doc_id, 9, "validating", "Validating search index health...")
            start_val = time.time()
            # Perform a mock test search query to verify index integrity
            test_emb = await self.embedding_provider.embed_query("test search query verification")
            test_results = await self.vector_store.search(doc.kb_id, test_emb, top_k=1)
            if not test_results:
                logger.warning(f"Index validation returned empty results for KB {doc.kb_id}.")
            duration_val = time.time() - start_val
            logger.info(f"[STAGE DURATION] Doc {doc_id} - Index Validation: {duration_val:.4f}s")
            await asyncio.sleep(0.01)

            # ----------------------------------------------------
            # Step 10: Knowledge Base Update
            # ----------------------------------------------------
            IngestionTelemetryManager.update_stage(doc_id, "Updating Knowledge Base")
            IngestionProgressManager.set_progress(doc_id, 10, "updating_kb", "Updating knowledge base statistics...")
            start_kb_update = time.time()
            
            try:
                # 120 seconds timeout limit for BM25 updates
                await asyncio.wait_for(
                    bm25_registry.add_chunks(doc.kb_id, chunk_ids, chunk_contents),
                    timeout=120.0
                )
            except asyncio.TimeoutError:
                IngestionTelemetryManager.add_timeout_event(doc_id, "BM25 update timed out after 120 seconds.")
                raise TimeoutError("Queue processing failed")

            # Update KB metrics in database
            kb = await self.kb_repo.get_by_id(doc.kb_id)
            if kb:
                # Refresh KB stats
                kb.document_count += 1
                kb.total_size_bytes += doc.file_size
                await self.db.flush()

            # Set doc as ready
            doc.status = DocumentStatus.READY
            doc.error_message = None
            await self.db.commit()

            duration_kb_update = time.time() - start_kb_update
            logger.info(f"[STAGE DURATION] Doc {doc_id} - KB Update: {duration_kb_update:.4f}s")

            # Overall pipeline tracking
            duration_pipeline = time.time() - start_pipeline
            logger.info(f"[INGESTION COMPLETE] Document {doc_id} (name: {doc.name}) is ready. status=READY. Overall Duration: {duration_pipeline:.4f}s")
            IngestionProgressManager.set_progress(doc_id, 10, "ready", "Document uploaded and indexed successfully.")
            IngestionTelemetryManager.finalize_and_log(doc_id, "Completed")
            return True

        except Exception as e:
            failed_step = 0
            prog = IngestionProgressManager.get_progress(doc_id)
            if prog:
                failed_step = prog.get("step", 0)

            # Map error message to the exact required user-facing reasons
            err_str = str(e).lower()
            if "embedding generation timeout" in err_str or "embedding api timeout" in err_str:
                user_friendly_error = "Embedding generation timeout"
            elif "embedding" in err_str:
                user_friendly_error = "Embedding API failure"
            elif "vector store" in err_str or "vector storage" in err_str or "vector database" in err_str:
                user_friendly_error = "Vector database unavailable"
            elif "bm25" in err_str or "queue" in err_str:
                user_friendly_error = "Queue processing failed"
            else:
                user_friendly_error = "File processing failed"

            logger.error(f"[INGESTION FAILED] Document {doc_id} failed on step {failed_step}: {e} (mapped to: {user_friendly_error})", exc_info=True)
            
            # Record failure in telemetry
            IngestionTelemetryManager.add_failure_reason(doc_id, user_friendly_error)
            IngestionTelemetryManager.finalize_and_log(doc_id, "Failed")

            # Critical: always mark failed and commit so UI stops spinning
            try:
                doc.status = DocumentStatus.FAILED
                doc.error_message = user_friendly_error
                await self.db.commit()
            except Exception as commit_err:
                logger.error(f"Failed to commit FAILED status for doc {doc_id}: {commit_err}")
                await self.db.rollback()
                # Try a direct SQL update as last resort
                try:
                    from sqlalchemy import text
                    async with self.db.begin():
                        await self.db.execute(
                            text(f"UPDATE documents SET status='FAILED', error_message=:err WHERE id=:id"),
                            {"err": user_friendly_error, "id": str(doc_id)}
                        )
                except Exception as sql_err:
                    logger.critical(f"Even raw SQL failed to mark doc {doc_id} as FAILED: {sql_err}")
            
            # Delete any partially created chunks from DB
            try:
                await self.chunk_repo.delete_by_document(doc_id)
                await self.db.commit()
            except Exception as rollback_err:
                logger.error(f"Rollback deletion of chunks failed: {rollback_err}")
                
            IngestionProgressManager.set_progress(doc_id, failed_step, "failed", user_friendly_error)
            return False


async def stuck_jobs_cleaner() -> None:
    """
    Background worker loop that detects stuck document ingestion jobs.
    Runs every 30 seconds, checks both the in-memory progress updates and the DB.
    If a job is stuck in a non-terminal state for > 300 seconds, it transitions
    it to FAILED state and updates both in-memory progress and database.
    """
    from datetime import datetime, timezone, timedelta
    from app.core.database import AsyncSessionLocal
    from app.models.document import Document, DocumentStatus
    from sqlalchemy import select

    logger.info("Background stuck jobs cleaner loop started.")
    while True:
        try:
            await asyncio.sleep(30.0)
            now = time.time()
            cutoff_dt = datetime.now(timezone.utc) - timedelta(seconds=300)

            # 1. Clean up in-memory progress list
            stuck_in_memory_docs: List[str] = []
            doc_ids_to_check = list(ingestion_progress.keys())
            for doc_str in doc_ids_to_check:
                prog = ingestion_progress.get(doc_str)
                if prog and prog.get("status") not in ("ready", "failed"):
                    elapsed = now - prog.get("timestamp", now)
                    if elapsed > 300.0:
                        stuck_in_memory_docs.append(doc_str)
                        # Determine user friendly error reason
                        status = prog.get("status", "")
                        error_msg = "Embedding generation timeout" if status == "embedding" else "File processing failed"
                        
                        logger.warning(
                            f"[STUCK CLEANER] In-memory job {doc_str} stuck at '{status}' for {elapsed:.1f}s. "
                            f"Marking as FAILED."
                        )
                        IngestionProgressManager.set_progress(
                            UUID(doc_str),
                            prog.get("step", 0),
                            "failed",
                            error_msg
                        )

            # 2. Query DB for documents stuck in non-terminal states
            async with AsyncSessionLocal() as db:
                stmt = select(Document).where(
                    Document.status.in_([
                        DocumentStatus.UPLOADING,
                        DocumentStatus.SCANNING,
                        DocumentStatus.EXTRACTING,
                        DocumentStatus.CHUNKING,
                        DocumentStatus.EMBEDDING
                    ]),
                    Document.updated_at < cutoff_dt
                )
                res = await db.execute(stmt)
                stuck_docs = res.scalars().all()

                for doc in stuck_docs:
                    error_msg = "Embedding generation timeout" if doc.status == DocumentStatus.EMBEDDING else "File processing failed"
                    logger.warning(
                        f"[STUCK CLEANER] DB job {doc.id} stuck at status '{doc.status}' since last update at {doc.updated_at}. "
                        f"Transitioning to FAILED."
                    )
                    
                    doc.status = DocumentStatus.FAILED
                    doc.error_message = error_msg
                    
                    # Update in-memory as well
                    IngestionProgressManager.set_progress(
                        doc.id,
                        7 if doc.status == DocumentStatus.EMBEDDING else 3,
                        "failed",
                        error_msg
                    )

                if stuck_docs:
                    await db.commit()

        except asyncio.CancelledError:
            logger.info("Background stuck jobs cleaner task cancelled.")
            break
        except Exception as cleaner_err:
            logger.error(f"Error in background stuck jobs cleaner loop: {cleaner_err}", exc_info=True)


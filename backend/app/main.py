"""
VerbaFlow AI - FastAPI Entrypoint
Orchestrates application initialization, CORS settings, middleware mount points,
startup/shutdown hooks, and all router sub-paths.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
import structlog

from app.core.config import settings
from app.core.database import Base, engine
from app.middleware.tenant import TenantMiddleware
from app.middleware.audit import AuditMiddleware
from app.routers import auth, knowledge_bases, documents, chat, admin, analytics, settings as settings_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    App lifespan context. Runs table generation and index folder preparation on startup,
    and handles connection cleaning on shutdown.
    """
    logger.info("Initializing VerbaFlow AI backend services...")
    
    # 1. Create upload and index directories
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.FAISS_INDEX_PATH, exist_ok=True)
    
    # 2. Database tables auto-creation (Development fallback, Alembic is primary for production)
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            # We run run_sync on metadata to create tables synchronously inside the async context
            await conn.run_sync(Base.metadata.create_all)
            
            # Ensure diagnostics_json column exists
            try:
                if conn.dialect.name == "postgresql":
                    await conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS diagnostics_json JSONB"))
                else:
                    await conn.execute(text("ALTER TABLE messages ADD COLUMN diagnostics_json TEXT"))
                logger.info("Database schemas verification: diagnostics_json column verified/added.")
            except Exception as schema_err:
                logger.warning(f"Note: Column diagnostics_json might already exist or failed adding: {schema_err}")
        logger.info("Database schemas verified/created successfully.")
    except Exception as e:
        logger.critical(f"Database table verification failed: {e}", exc_info=True)

    # 3. Start stuck jobs cleaner background loop
    import asyncio
    from app.services.ingestion_service import stuck_jobs_cleaner
    stuck_task = asyncio.create_task(stuck_jobs_cleaner())

    yield
    
    logger.info("Shutting down VerbaFlow AI backend services...")
    # Clean up stuck task
    stuck_task.cancel()
    try:
        await stuck_task
    except asyncio.CancelledError:
        pass
    except Exception as stuck_err:
        logger.error(f"Error while canceling stuck task: {stuck_err}")

    # Clean up DB connections
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise Multi-Document RAG Chatbot Platform",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Middlewares
app.add_middleware(AuditMiddleware)
app.add_middleware(TenantMiddleware)

# Include Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(knowledge_bases.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(settings_router.router, prefix="/api/v1")


@app.get("/health", status_code=status.HTTP_200_OK, tags=["Health"])
async def health_check():
    """Service health check status probe."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": "development" if settings.DEBUG else "production"
    }

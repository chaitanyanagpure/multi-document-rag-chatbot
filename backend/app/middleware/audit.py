"""
VerbaFlow AI - Audit Logging Middleware
Automatically captures modifying write requests (POST, PUT, DELETE) and records them in the AuditLog database.
"""
from __future__ import annotations

import logging
import json
from uuid import UUID
from fastapi import Request
from jose import jwt
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

logger = logging.getLogger(__name__)


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware that captures API requests (POST, PUT, DELETE) and logs audit records.
    """

    async def dispatch(self, request: Request, call_next):
        # Process the request
        response = await call_next(request)

        # Log only successful modifying operations (POST, PUT, DELETE)
        method = request.method
        path = request.url.path
        if method not in ["POST", "PUT", "DELETE"] or response.status_code >= 400:
            return response

        # Ignore login/refresh/register/health checks
        if (
            "/auth/login" in path
            or "/auth/refresh" in path
            or "/auth/register" in path
            or path == "/health"
        ):
            return response

        # Run background job to log audit details to DB
        # This keeps API latency low
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                user_id = payload.get("sub")
                org_id = payload.get("org_id")
                
                if user_id and org_id:
                    # Spawn task to insert audit record
                    from app.core.database import AsyncSessionLocal
                    from app.models.audit_log import AuditLog
                    
                    action = f"{method} {path}"
                    resource_type = path.split("/")[2] if len(path.split("/")) > 2 else "api"
                    
                    async def log_audit():
                        async with AsyncSessionLocal() as db:
                            audit = AuditLog(
                                org_id=UUID(org_id),
                                user_id=UUID(user_id),
                                action=action,
                                resource_type=resource_type,
                                resource_id=None,
                                details_json={
                                    "query_params": dict(request.query_params),
                                    "status_code": response.status_code
                                },
                                ip_address=request.client.host if request.client else "unknown",
                                user_agent=request.headers.get("User-Agent", "unknown")
                            )
                            db.add(audit)
                            await db.commit()

                    # Run asynchronously
                    import asyncio
                    asyncio.create_task(log_audit())
            except Exception as e:
                logger.error(f"Audit middleware logging failed: {e}")

        return response

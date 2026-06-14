"""
VerbaFlow AI - Tenant Isolation Middleware
Extracts tenant organization context from JWT and associates it with the request state.
"""
from __future__ import annotations

import logging
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from jose import jwt, JWTError
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

logger = logging.getLogger(__name__)


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware that intercepts requests to extract org_id from JWT tokens
    and injects it into request.state.org_id for service-layer tenant isolation.
    """

    async def dispatch(self, request: Request, call_next):
        # Exclude docs, authentication, and health check routes
        path = request.url.path
        if (
            path.startswith("/docs")
            or path.startswith("/redoc")
            or path.startswith("/openapi.json")
            or path.startswith("/api/v1/auth/login")
            or path.startswith("/api/v1/auth/register")
            or path.startswith("/api/v1/auth/refresh")
            or path == "/health"
            or path == "/metrics"
        ):
            return await call_next(request)

        # Retrieve authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return await call_next(request)

        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            org_id = payload.get("org_id")
            if org_id:
                # Set org_id in request state
                request.state.org_id = org_id
        except JWTError:
            # Token validation is handled directly by routers/get_current_user dependencies.
            # We fail silently here to let standard routes handle expired tokens with 401s properly.
            pass

        return await call_next(request)

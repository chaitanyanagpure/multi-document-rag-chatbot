"""
VerbaFlow AI - Security Module
JWT token management, password hashing, OAuth2, RBAC dependencies.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)

# ── Password Hashing ──────────────────────────────────────────────────────────

# ── OAuth2 Scheme ─────────────────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ── Redis Client ──────────────────────────────────────────────────────────────
_redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    """Return a singleton Redis async client."""
    global _redis_client
    if _redis_client is None:
        _redis_client = await aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
        )
    return _redis_client


# ── Password Utilities ────────────────────────────────────────────────────────
def get_password_hash(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    pwd_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    try:
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception:
        return False


# ── JWT Token Utilities ───────────────────────────────────────────────────────
def create_access_token(
    subject: str | UUID,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token.

    Args:
        subject: User ID to encode as the 'sub' claim.
        extra_claims: Additional claims to include (org_id, role, etc.).
        expires_delta: Optional custom expiry duration.

    Returns:
        Encoded JWT string.
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload: Dict[str, Any] = {
        "sub": str(subject),
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "exp": expire,
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(
    subject: str | UUID,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Create a signed JWT refresh token with a longer expiry.

    Args:
        subject: User ID.
        extra_claims: Additional claims.

    Returns:
        Encoded JWT string.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload: Dict[str, Any] = {
        "sub": str(subject),
        "type": "refresh",
        "iat": datetime.now(timezone.utc),
        "exp": expire,
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_password_reset_token(email: str) -> str:
    """Create a short-lived token for password reset."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": email,
        "type": "password_reset",
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str, token_type: str = "access") -> Dict[str, Any]:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT string to verify.
        token_type: Expected token type claim.

    Returns:
        Decoded payload dict.

    Raises:
        HTTPException 401 if invalid or expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != token_type:
            raise credentials_exception
        subject: Optional[str] = payload.get("sub")
        if subject is None:
            raise credentials_exception
        return payload
    except JWTError as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise credentials_exception from exc


# ── RBAC & Current User ───────────────────────────────────────────────────────
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> "User":  # noqa: F821  (forward ref resolved at runtime)
    """
    FastAPI dependency that decodes the JWT and returns the active User ORM object.

    Raises:
        HTTPException 401 if token is invalid.
        HTTPException 403 if the user account is inactive.
    """
    # Import here to avoid circular imports
    from app.repositories.user_repository import UserRepository

    payload = verify_token(token, token_type="access")
    user_id: str = payload["sub"]

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )
    return user


async def get_current_user_sse(
    token_query: Optional[str] = None,
    token_header: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> "User":  # noqa: F821
    """
    Flexible JWT dependency for SSE endpoints.

    Browser EventSource cannot send Authorization headers, so this dependency
    falls back to reading the JWT from the `?token=` query parameter.
    Call this via:
        Depends(get_current_user_sse_factory())

    Use get_current_user_from_request() below for the actual Depends injection.
    """
    from app.repositories.user_repository import UserRepository

    token = token_header or token_query
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(token, token_type="access")
    user_id: str = payload["sub"]

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )
    return user


def require_role(*roles: str):
    """
    Dependency factory enforcing role-based access control.

    Usage:
        @router.get("/admin", dependencies=[Depends(require_role("SUPER_ADMIN"))])

    Args:
        *roles: One or more role names that are allowed.

    Returns:
        A FastAPI dependency function.
    """

    async def role_checker(
        current_user: "User" = Depends(get_current_user),  # noqa: F821
    ) -> "User":  # noqa: F821
        if current_user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(roles)}",
            )
        return current_user

    return role_checker


# ── Sliding Window Rate Limiter ───────────────────────────────────────────────
class RateLimiter:
    """
    Token-bucket / sliding window rate limiter backed by Redis.

    Each unique key (e.g., IP or user_id) is tracked with a sorted set
    whose members are request timestamps. Entries older than the window
    are pruned on each call.
    """

    def __init__(
        self,
        max_requests: int = settings.RATE_LIMIT_REQUESTS,
        window_seconds: int = settings.RATE_LIMIT_WINDOW_SECONDS,
    ) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def is_allowed(self, identifier: str) -> bool:
        """
        Check whether the identifier is within the rate limit.

        Args:
            identifier: Unique key to rate-limit (e.g., IP address or user ID).

        Returns:
            True if the request is within limits, False if rate-limited.
        """
        redis = await get_redis()
        key = f"ratelimit:{identifier}"
        now = time.time()
        window_start = now - self.window_seconds

        pipe = redis.pipeline()
        # Remove old entries outside the sliding window
        pipe.zremrangebyscore(key, "-inf", window_start)
        # Add current timestamp
        pipe.zadd(key, {str(now): now})
        # Count requests in the window
        pipe.zcard(key)
        # Set TTL so key auto-expires
        pipe.expire(key, self.window_seconds * 2)
        results = await pipe.execute()

        request_count: int = results[2]
        return request_count <= self.max_requests

    async def check(self, identifier: str) -> None:
        """
        Raise HTTP 429 if rate limit is exceeded.

        Args:
            identifier: Unique key to rate-limit.

        Raises:
            HTTPException 429 if limit exceeded.
        """
        if not await self.is_allowed(identifier):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Rate limit exceeded: {self.max_requests} requests "
                    f"per {self.window_seconds}s"
                ),
                headers={"Retry-After": str(self.window_seconds)},
            )


# Singleton rate limiter instance
rate_limiter = RateLimiter()

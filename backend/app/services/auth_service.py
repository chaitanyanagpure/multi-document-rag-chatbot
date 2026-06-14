"""
VerbaFlow AI - Auth Service
Handles registration, login, token refresh, password management.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_password_reset_token,
    get_password_hash,
    verify_password,
    verify_token,
)
from app.models.organization import Organization, SubscriptionTier
from app.models.user import User, UserRole
from app.repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)


class AuthService:
    """
    Service layer for all authentication operations.

    All methods accept an AsyncSession and perform database operations
    through the UserRepository, following Clean Architecture conventions.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.user_repo = UserRepository(db)

    async def register_user(
        self,
        email: str,
        password: str,
        full_name: str,
        organization_name: Optional[str] = None,
        organization_slug: Optional[str] = None,
        org_id: Optional[UUID] = None,
        role: str = "EMPLOYEE",
    ) -> Tuple[User, str, str]:
        """
        Register a new user account.

        If org_id is provided, the user joins an existing organisation.
        If organization_name is provided, a new organisation is created first.

        Args:
            email: Unique email address.
            password: Plaintext password (will be hashed).
            full_name: Display name.
            organization_name: Name of org to create (first user flow).
            organization_slug: Slug for the new org.
            org_id: Existing org UUID to join.
            role: RBAC role for the new user.

        Returns:
            Tuple of (User, access_token, refresh_token).

        Raises:
            HTTPException 409 if email is already registered.
            HTTPException 400 if neither org_id nor organization_name provided.
        """
        # Check for duplicate email
        existing = await self.user_repo.get_by_email(email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{email}' is already registered",
            )

        # Resolve or create organisation
        if org_id is None:
            if not organization_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Either org_id or organization_name must be provided",
                )
            org = await self._create_organization(
                name=organization_name,
                slug=organization_slug or self._slugify(organization_name),
            )
            org_id = org.id
            role = "ORG_ADMIN"  # First user of a new org gets admin rights
        else:
            # Verify org exists
            from sqlalchemy import select
            from app.models.organization import Organization as OrgModel
            result = await self.db.execute(
                select(OrgModel).where(OrgModel.id == org_id)
            )
            if not result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Organisation not found",
                )

        hashed_password = get_password_hash(password)
        user = await self.user_repo.create_user(
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
            org_id=org_id,
            role=role,
        )

        # Generate tokens
        extra_claims = {"org_id": str(org_id), "role": role}
        access_token = create_access_token(user.id, extra_claims)
        refresh_token = create_refresh_token(user.id, extra_claims)

        # In production, send verification email here
        logger.info(
            "New user registered",
            user_id=str(user.id),
            email=email,
            org_id=str(org_id),
        )

        return user, access_token, refresh_token

    async def login(
        self,
        email: str,
        password: str,
        ip_address: Optional[str] = None,
    ) -> Tuple[User, str, str]:
        """
        Authenticate a user with email and password.

        Args:
            email: User's email.
            password: Plaintext password.
            ip_address: Client IP for audit logging.

        Returns:
            Tuple of (User, access_token, refresh_token).

        Raises:
            HTTPException 401 if credentials are invalid.
            HTTPException 403 if account is deactivated.
        """
        user = await self.user_repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Contact your administrator.",
            )

        # Update last login timestamp
        await self.user_repo.update_last_login(user)

        extra_claims = {
            "org_id": str(user.org_id),
            "role": user.role.value,
        }
        access_token = create_access_token(user.id, extra_claims)
        refresh_token = create_refresh_token(user.id, extra_claims)

        logger.info(
            "User logged in",
            user_id=str(user.id),
            ip=ip_address,
        )

        return user, access_token, refresh_token

    async def refresh_token(self, refresh_token_str: str) -> Tuple[str, str]:
        """
        Rotate tokens: validate refresh token and issue a new pair.

        Args:
            refresh_token_str: The existing refresh token.

        Returns:
            Tuple of (new_access_token, new_refresh_token).

        Raises:
            HTTPException 401 if refresh token is invalid or expired.
        """
        try:
            payload = verify_token(refresh_token_str, token_type="refresh")
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )

        user_id = payload["sub"]
        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or deactivated",
            )

        extra_claims = {
            "org_id": str(user.org_id),
            "role": user.role.value,
        }
        new_access = create_access_token(user.id, extra_claims)
        new_refresh = create_refresh_token(user.id, extra_claims)
        return new_access, new_refresh

    async def change_password(
        self,
        user_id: UUID,
        current_password: str,
        new_password: str,
    ) -> None:
        """
        Change the authenticated user's password.

        Args:
            user_id: The user's UUID.
            current_password: Current plaintext password for verification.
            new_password: New plaintext password.

        Raises:
            HTTPException 400 if current password is wrong.
        """
        user = await self.user_repo.get_by_id(user_id)
        if not user or not verify_password(current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        hashed = get_password_hash(new_password)
        await self.user_repo.change_password(user.id, hashed)
        logger.info("Password changed", user_id=str(user_id))

    async def forgot_password(self, email: str) -> Optional[str]:
        """
        Initiate the forgot-password flow.

        Returns a password-reset token (in production, this is emailed).
        Returns None silently if the email is not found (prevent enumeration).

        Args:
            email: Email address of the account.

        Returns:
            Reset token string or None.
        """
        user = await self.user_repo.get_by_email(email)
        if not user:
            # Prevent email enumeration - always return success to client
            logger.warning("Password reset requested for unknown email: %s", email)
            return None

        token = create_password_reset_token(email)
        # In production: send email with reset link containing token
        logger.info(
            "Password reset token generated (email would be sent in production)",
            user_id=str(user.id),
            email=email,
        )
        return token

    async def reset_password(self, token: str, new_password: str) -> None:
        """
        Complete a password reset using the token from the email.

        Args:
            token: JWT password-reset token.
            new_password: New plaintext password.

        Raises:
            HTTPException 400 if token is invalid/expired.
        """
        try:
            payload = verify_token(token, token_type="password_reset")
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token",
            )

        email = payload.get("sub")
        user = await self.user_repo.get_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        hashed = get_password_hash(new_password)
        await self.user_repo.change_password(user.id, hashed)
        logger.info("Password reset completed", user_id=str(user.id))

    async def _create_organization(
        self, name: str, slug: str
    ) -> Organization:
        """Create a new organization entity."""
        org = Organization(
            name=name,
            slug=slug,
            subscription_tier=SubscriptionTier.FREE,
            is_active=True,
            max_users=5,
            max_storage_gb=10,
        )
        self.db.add(org)
        await self.db.flush()
        await self.db.refresh(org)
        logger.info("Organisation created", org_id=str(org.id), slug=slug)
        return org

    @staticmethod
    def _slugify(text: str) -> str:
        """Convert text to a URL-friendly slug."""
        import re
        text = text.lower().strip()
        text = re.sub(r"[^\w\s-]", "", text)
        text = re.sub(r"[\s_-]+", "-", text)
        return text[:100]

    async def google_authenticate(self, token: str) -> Tuple[User, str, str]:
        """
        Authenticate a user using a Google OAuth access token.
        If the user does not exist, automatically register them and create a new organization.
        """
        import httpx
        import secrets

        # 1. Query tokeninfo to verify active token and check aud
        async with httpx.AsyncClient() as client:
            try:
                tokeninfo_resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/tokeninfo",
                    params={"access_token": token}
                )
                if tokeninfo_resp.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid or expired Google access token"
                    )
                tokeninfo = tokeninfo_resp.json()
            except httpx.RequestError as e:
                logger.error(f"Google tokeninfo request failed: {e}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to connect to Google verification service"
                )

            # If audience check is configured, verify it
            if settings.GOOGLE_CLIENT_ID:
                aud = tokeninfo.get("aud") or tokeninfo.get("azp")
                if aud != settings.GOOGLE_CLIENT_ID:
                    logger.warning(f"Google Token audience mismatch: {aud} vs {settings.GOOGLE_CLIENT_ID}")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Google token audience mismatch"
                    )

            # 2. Query userinfo to retrieve profile details (name, email)
            try:
                userinfo_resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if userinfo_resp.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Failed to retrieve Google user profile info"
                    )
                userinfo = userinfo_resp.json()
            except httpx.RequestError as e:
                logger.error(f"Google userinfo request failed: {e}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to connect to Google user info service"
                )

            email = userinfo.get("email")
            full_name = userinfo.get("name") or (email.split("@")[0] if email else "Google User")
            
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Google account does not provide a valid email"
                )

        # 3. Check if user already exists
        user = await self.user_repo.get_by_email(email)
        
        if user:
            if not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account is deactivated. Contact your administrator."
                )
            await self.user_repo.update_last_login(user)
            org_id = user.org_id
            role = user.role.value
        else:
            # User does not exist - register them dynamically!
            password = secrets.token_urlsafe(32) + "A1!"
            
            org_name = f"{full_name.split()[0]}'s Org" if full_name else f"{email.split('@')[0]}'s Org"
            org_slug = self._slugify(org_name)
            
            org = await self._create_organization(
                name=org_name,
                slug=org_slug,
            )
            org_id = org.id
            role = "ORG_ADMIN"
            
            hashed_password = get_password_hash(password)
            user = await self.user_repo.create_user(
                email=email,
                hashed_password=hashed_password,
                full_name=full_name,
                org_id=org_id,
                role=role,
            )
            logger.info(
                "New Google user registered dynamically",
                user_id=str(user.id),
                email=email,
                org_id=str(org_id),
            )

        # 4. Generate tokens
        extra_claims = {
            "org_id": str(org_id),
            "role": role,
        }
        access_token = create_access_token(user.id, extra_claims)
        refresh_token = create_refresh_token(user.id, extra_claims)
        
        return user, access_token, refresh_token

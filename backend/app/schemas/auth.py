"""
VerbaFlow AI - Auth Schemas
Pydantic v2 models for authentication endpoints.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.user import UserResponse


class RegisterRequest(BaseModel):
    """Payload for creating a new user account."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    organization_name: Optional[str] = Field(default=None, max_length=255)
    organization_slug: Optional[str] = Field(default=None, max_length=100)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("organization_slug")
    @classmethod
    def slug_format(cls, v: Optional[str]) -> Optional[str]:
        if v and not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("Slug may only contain letters, numbers, hyphens, underscores")
        return v.lower() if v else v


class LoginRequest(BaseModel):
    """Payload for authenticating with email + password."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class GoogleLoginRequest(BaseModel):
    """Payload for authenticating with Google access token."""

    token: str


class TokenResponse(BaseModel):
    """Successful authentication response carrying JWT tokens."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: UserResponse


class RefreshTokenResponse(BaseModel):
    """Successful token refresh response carrying JWT tokens."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshTokenRequest(BaseModel):
    """Payload to exchange a refresh token for a new access token."""

    refresh_token: str


class AccessTokenResponse(BaseModel):
    """Partial token response returned after a refresh."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class PasswordChangeRequest(BaseModel):
    """Payload for changing an authenticated user's password."""

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info: object) -> str:
        # info.data is available in Pydantic v2
        if hasattr(info, "data") and "new_password" in info.data:
            if v != info.data["new_password"]:
                raise ValueError("Passwords do not match")
        return v


class ForgotPasswordRequest(BaseModel):
    """Payload for initiating the password-reset flow."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Payload for completing a password reset with a token."""

    token: str
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info: object) -> str:
        if hasattr(info, "data") and "new_password" in info.data:
            if v != info.data["new_password"]:
                raise ValueError("Passwords do not match")
        return v

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    username: str = Field(..., description="Username or email address")
    password: str = Field(..., min_length=1)
    totp_code: Optional[str] = Field(None, min_length=6, max_length=6, description="TOTP code if 2FA is enabled")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access token expiry


class RefreshRequest(BaseModel):
    refresh_token: str


class TOTPSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str
    qr_code_url: str  # endpoint to fetch QR PNG


class TOTPVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class TOTPVerifyResponse(BaseModel):
    totp_enabled: bool
    message: str


class TOTPDisableRequest(BaseModel):
    password: str
    code: str = Field(..., min_length=6, max_length=6)


class LogoutRequest(BaseModel):
    refresh_token: str


class PasswordResetInitRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str


class TOTPRequiredResponse(BaseModel):
    totp_required: bool = True
    message: str = "TOTP code required"
    partial_token: str  # short-lived token to submit TOTP code against

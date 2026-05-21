from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import generate_totp_qr_bytes
from app.modules.auth import service as auth_service
from app.modules.auth.schemas import (
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    TOTPDisableRequest,
    TOTPSetupResponse,
    TOTPVerifyRequest,
    TOTPVerifyResponse,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _get_client_ip(request: Request) -> Optional[str]:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with username/email and password",
)
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate with username (or email) and password.
    If 2FA is enabled, also supply `totp_code`.
    Returns JWT access + refresh token pair.
    """
    ip = _get_client_ip(request)
    access_token, refresh_token = await auth_service.authenticate_user(
        db=db,
        username_or_email=body.username,
        password=body.password,
        totp_code=body.totp_code,
        ip_address=ip,
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate refresh token",
)
async def refresh_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a valid refresh token for a new access + refresh token pair (rotation)."""
    new_access, new_refresh = await auth_service.refresh_access_token(db, body.refresh_token)
    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout (revoke refresh token)",
)
async def logout(
    body: LogoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Revoke the supplied refresh token."""
    await auth_service.logout_user(db, body.refresh_token)
    return MessageResponse(message="Logged out successfully")


@router.post(
    "/logout-all",
    response_model=MessageResponse,
    summary="Revoke all sessions for the current user",
)
async def logout_all(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Revoke every active refresh token for the authenticated user."""
    await auth_service.logout_all_sessions(db, current_user.id)
    return MessageResponse(message="All sessions terminated")


# ---------------------------------------------------------------------------
# TOTP endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/2fa/setup",
    response_model=TOTPSetupResponse,
    summary="Initiate TOTP 2FA setup",
)
async def setup_2fa(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Generate a TOTP secret and return the OTPAuth URI.
    The secret is saved but TOTP is NOT enabled until `/2fa/verify` is called.
    """
    secret, uri = await auth_service.initiate_totp_setup(db, current_user)
    return TOTPSetupResponse(
        secret=secret,
        otpauth_uri=uri,
        qr_code_url="/api/v1/auth/2fa/qrcode",
    )


@router.get(
    "/2fa/qrcode",
    summary="Fetch TOTP QR code as PNG image",
    responses={200: {"content": {"image/png": {}}}},
)
async def get_2fa_qrcode(
    current_user=Depends(get_current_user),
):
    """Returns a PNG QR code for the user's pending TOTP setup."""
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="TOTP setup not initiated. Call /2fa/setup first.")
    png_bytes = generate_totp_qr_bytes(current_user.totp_secret, current_user.email)
    return StreamingResponse(
        iter([png_bytes]),
        media_type="image/png",
        headers={"Content-Disposition": "inline; filename=totp-qr.png"},
    )


@router.post(
    "/2fa/verify",
    response_model=TOTPVerifyResponse,
    summary="Confirm TOTP code and enable 2FA",
)
async def verify_2fa(
    body: TOTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Verify the TOTP code from the authenticator app and enable 2FA on the account."""
    await auth_service.confirm_totp_setup(db, current_user, body.code)
    return TOTPVerifyResponse(totp_enabled=True, message="Two-factor authentication enabled")


@router.post(
    "/2fa/disable",
    response_model=TOTPVerifyResponse,
    summary="Disable 2FA",
)
async def disable_2fa(
    body: TOTPDisableRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Disable TOTP 2FA. Requires current password and a valid TOTP code."""
    await auth_service.disable_totp(db, current_user, body.password, body.code)
    return TOTPVerifyResponse(totp_enabled=False, message="Two-factor authentication disabled")


@router.get(
    "/me",
    summary="Get currently authenticated user info",
)
async def get_me(current_user=Depends(get_current_user)):
    """Return basic info about the currently authenticated user."""
    from app.modules.users.schemas import UserOut
    return UserOut.model_validate(current_user)

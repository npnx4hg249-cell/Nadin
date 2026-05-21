from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    generate_totp_secret,
    get_totp_uri,
    hash_password,
    hash_token,
    verify_password,
    verify_totp,
)
from app.modules.users.models import AuditLog, RefreshToken, User


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_user_by_login(db: AsyncSession, username_or_email: str) -> Optional[User]:
    """Look up a user by email or username."""
    result = await db.execute(
        select(User).where(
            (User.email == username_or_email) | (User.username == username_or_email)
        )
    )
    return result.scalar_one_or_none()


async def _record_login(db: AsyncSession, user: User, ip_address: Optional[str]) -> None:
    user.last_login = _utcnow()
    log = AuditLog(
        user_id=user.id,
        action="login",
        resource="auth",
        details={"method": "password"},
        ip_address=ip_address,
    )
    db.add(log)


async def _store_refresh_token(db: AsyncSession, user_id: int, raw_token: str) -> RefreshToken:
    token_hash = hash_token(raw_token)
    expires_at = _utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    rt = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        revoked=False,
    )
    db.add(rt)
    await db.flush()
    return rt


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

async def authenticate_user(
    db: AsyncSession,
    username_or_email: str,
    password: str,
    totp_code: Optional[str],
    ip_address: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Full authentication flow.
    Returns (access_token, refresh_token).
    Raises HTTPException on failure.
    """
    user = await _get_user_by_login(db, username_or_email)

    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    # TOTP check
    if user.totp_enabled or user.force_totp:
        if not user.totp_secret:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="TOTP is required but not configured. Contact an administrator.",
            )
        if not totp_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="TOTP code required",
                headers={"X-TOTP-Required": "true"},
            )
        if not verify_totp(user.totp_secret, totp_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid TOTP code",
            )

    extra_claims = {"role": user.role.value, "username": user.username}
    access_token = create_access_token(subject=str(user.id), extra_claims=extra_claims)
    refresh_token = create_refresh_token(subject=str(user.id))

    await _store_refresh_token(db, user.id, refresh_token)
    await _record_login(db, user, ip_address)

    return access_token, refresh_token


async def refresh_access_token(
    db: AsyncSession, raw_refresh_token: str
) -> Tuple[str, str]:
    """
    Validate refresh token, revoke it, issue new token pair (rotation).
    Returns (new_access_token, new_refresh_token).
    """
    payload = decode_refresh_token(raw_refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    token_hash = hash_token(raw_refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,  # noqa: E712
        )
    )
    stored = result.scalar_one_or_none()
    if stored is None or stored.expires_at.replace(tzinfo=timezone.utc) < _utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revoked or expired",
        )

    # Fetch user
    user_id = int(payload["sub"])
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Rotate: revoke old token, issue new pair
    stored.revoked = True
    await db.flush()

    extra_claims = {"role": user.role.value, "username": user.username}
    new_access = create_access_token(subject=str(user.id), extra_claims=extra_claims)
    new_refresh = create_refresh_token(subject=str(user.id))
    await _store_refresh_token(db, user.id, new_refresh)

    return new_access, new_refresh


async def logout_user(db: AsyncSession, raw_refresh_token: str) -> None:
    """Revoke the given refresh token."""
    token_hash = hash_token(raw_refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored = result.scalar_one_or_none()
    if stored and not stored.revoked:
        stored.revoked = True
        await db.flush()


async def logout_all_sessions(db: AsyncSession, user_id: int) -> None:
    """Revoke ALL refresh tokens for a user (logout everywhere)."""
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked == False,  # noqa: E712
        )
    )
    tokens = result.scalars().all()
    for token in tokens:
        token.revoked = True
    await db.flush()


# ---------------------------------------------------------------------------
# TOTP management
# ---------------------------------------------------------------------------

async def initiate_totp_setup(db: AsyncSession, user: User) -> Tuple[str, str]:
    """
    Generate and persist a TOTP secret (not yet enabled).
    Returns (secret, otpauth_uri).
    """
    secret = generate_totp_secret()
    user.totp_secret = secret
    # Do NOT set totp_enabled yet — user must verify first
    await db.flush()
    uri = get_totp_uri(secret, user.email)
    return secret, uri


async def confirm_totp_setup(db: AsyncSession, user: User, code: str) -> None:
    """Verify the TOTP code and mark TOTP as enabled for the user."""
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="TOTP setup not initiated")
    if not verify_totp(user.totp_secret, code):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    user.totp_enabled = True
    await db.flush()


async def disable_totp(db: AsyncSession, user: User, password: str, code: str) -> None:
    """Disable TOTP for the user after verifying password and current TOTP code."""
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")
    if not user.totp_secret or not verify_totp(user.totp_secret, code):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    if user.force_totp:
        raise HTTPException(
            status_code=403,
            detail="TOTP is enforced by an administrator and cannot be disabled",
        )
    user.totp_enabled = False
    user.totp_secret = None
    await db.flush()

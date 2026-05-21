from __future__ import annotations

from typing import Optional

from fastapi import Depends, Header, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token, hash_token

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Resolve JWT bearer token to a User ORM object."""
    # Import here to avoid circular imports at module-load time
    from app.modules.users.models import User

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise credentials_exception

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise credentials_exception

    user_id: Optional[str] = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    from sqlalchemy import select

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user: Optional[User] = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user=Depends(get_current_user),
):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def require_editor(current_user=Depends(get_current_user)):
    from app.modules.users.models import UserRole

    allowed = {UserRole.editor, UserRole.admin, UserRole.super_admin}
    if current_user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Editor role or higher required",
        )
    return current_user


async def require_admin(current_user=Depends(get_current_user)):
    from app.modules.users.models import UserRole

    allowed = {UserRole.admin, UserRole.super_admin}
    if current_user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role or higher required",
        )
    return current_user


async def require_super_admin(current_user=Depends(get_current_user)):
    from app.modules.users.models import UserRole

    if current_user.role != UserRole.super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin role required",
        )
    return current_user


async def get_plugin_from_api_key(
    x_api_key: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Authenticate a plugin via its API key header."""
    from app.modules.plugins.models import Plugin
    from sqlalchemy import select

    if x_api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Api-Key header required",
        )

    key_hash = hash_token(x_api_key)
    result = await db.execute(
        select(Plugin).where(Plugin.api_key_hash == key_hash, Plugin.is_enabled == True)
    )
    plugin = result.scalar_one_or_none()
    if plugin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or disabled plugin API key",
        )
    return plugin

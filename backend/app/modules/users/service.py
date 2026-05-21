from __future__ import annotations

from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import hash_password, verify_password
from app.modules.users.models import PermissionProfile, User, UserRole
from app.modules.users.schemas import (
    ChangePasswordRequest,
    PermissionProfileCreate,
    PermissionProfileUpdate,
    UserCreate,
    UserUpdate,
)


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------

async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    result = await db.execute(
        select(User)
        .options(selectinload(User.permission_profile))
        .where(User.id == user_id)
    )
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def list_users(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    role: Optional[UserRole] = None,
    search: Optional[str] = None,
) -> Tuple[int, List[User]]:
    query = select(User).options(selectinload(User.permission_profile))
    count_query = select(func.count()).select_from(User)

    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)
    if search:
        pattern = f"%{search}%"
        query = query.where(User.email.ilike(pattern) | User.username.ilike(pattern))
        count_query = count_query.where(
            User.email.ilike(pattern) | User.username.ilike(pattern)
        )

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    query = query.offset(skip).limit(limit).order_by(User.created_at.desc())
    result = await db.execute(query)
    return total, list(result.scalars().all())


async def create_user(db: AsyncSession, data: UserCreate, created_by_id: Optional[int] = None) -> User:
    # Check uniqueness
    if await get_user_by_email(db, data.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    if await get_user_by_username(db, data.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    user = User(
        email=data.email,
        username=data.username,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_active=data.is_active,
        permission_profile_id=data.permission_profile_id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def update_user(db: AsyncSession, user: User, data: UserUpdate) -> User:
    update_data = data.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] != user.email:
        existing = await get_user_by_email(db, update_data["email"])
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

    if "username" in update_data and update_data["username"] != user.username:
        existing = await get_user_by_username(db, update_data["username"])
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)
    return user


async def delete_user(db: AsyncSession, user: User) -> None:
    await db.delete(user)
    await db.flush()


async def change_password(db: AsyncSession, user: User, data: ChangePasswordRequest) -> None:
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.hashed_password = hash_password(data.new_password)
    await db.flush()


# ---------------------------------------------------------------------------
# Permission Profile CRUD
# ---------------------------------------------------------------------------

async def get_profile_by_id(db: AsyncSession, profile_id: int) -> Optional[PermissionProfile]:
    result = await db.execute(select(PermissionProfile).where(PermissionProfile.id == profile_id))
    return result.scalar_one_or_none()


async def list_profiles(db: AsyncSession) -> List[PermissionProfile]:
    result = await db.execute(select(PermissionProfile).order_by(PermissionProfile.name))
    return list(result.scalars().all())


async def create_profile(
    db: AsyncSession, data: PermissionProfileCreate, created_by_id: Optional[int] = None
) -> PermissionProfile:
    existing = await db.execute(
        select(PermissionProfile).where(PermissionProfile.name == data.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Permission profile name already exists")

    profile = PermissionProfile(
        name=data.name,
        description=data.description,
        permissions=data.permissions,
        created_by=created_by_id,
    )
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    return profile


async def update_profile(
    db: AsyncSession, profile: PermissionProfile, data: PermissionProfileUpdate
) -> PermissionProfile:
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)
    await db.flush()
    await db.refresh(profile)
    return profile


async def delete_profile(db: AsyncSession, profile: PermissionProfile) -> None:
    await db.delete(profile)
    await db.flush()

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.modules.users import service as user_service
from app.modules.users.models import UserRole
from app.modules.users.schemas import (
    ChangePasswordRequest,
    PermissionProfileCreate,
    PermissionProfileOut,
    PermissionProfileUpdate,
    UserCreate,
    UserListOut,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["Users"])


# ---------------------------------------------------------------------------
# Self-service endpoints (any authenticated user)
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserOut, summary="Get own profile")
async def read_own_profile(current_user=Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut, summary="Update own profile")
async def update_own_profile(
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Update own profile. Only `email` and `username` may be changed via this endpoint.
    Role and permission profile changes require admin access.
    """
    # Strip fields that should not be self-editable
    safe_update = UserUpdate(
        email=body.email,
        username=body.username,
    )
    updated = await user_service.update_user(db, current_user, safe_update)
    return UserOut.model_validate(updated)


@router.post("/me/change-password", summary="Change own password")
async def change_own_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Change the authenticated user's password."""
    await user_service.change_password(db, current_user, body)
    return {"message": "Password updated successfully"}


# ---------------------------------------------------------------------------
# Admin user management
# ---------------------------------------------------------------------------

@router.get("", response_model=UserListOut, summary="List all users (admin)")
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    role: Optional[UserRole] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """List users with optional filtering by role or search term. Admin only."""
    total, users = await user_service.list_users(db, skip=skip, limit=limit, role=role, search=search)
    return UserListOut(total=total, items=[UserOut.model_validate(u) for u in users])


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED, summary="Create user (admin)")
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    """Create a new user. Admin only."""
    user = await user_service.create_user(db, body, created_by_id=admin.id)
    return UserOut.model_validate(user)


@router.get("/{user_id}", response_model=UserOut, summary="Get user by ID (admin)")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Retrieve a specific user by ID. Admin only."""
    user = await user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.patch("/{user_id}", response_model=UserOut, summary="Update user (admin)")
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Update any user fields. Admin only."""
    user = await user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updated = await user_service.update_user(db, user, body)
    return UserOut.model_validate(updated)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete user (admin)")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    """Permanently delete a user. Admin only. Cannot delete self."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account via this endpoint")
    user = await user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await user_service.delete_user(db, user)


# ---------------------------------------------------------------------------
# Permission profiles
# ---------------------------------------------------------------------------

@router.get(
    "/permission-profiles/",
    response_model=list[PermissionProfileOut],
    summary="List permission profiles",
)
async def list_permission_profiles(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """List all permission profiles. Admin only."""
    profiles = await user_service.list_profiles(db)
    return [PermissionProfileOut.model_validate(p) for p in profiles]


@router.post(
    "/permission-profiles/",
    response_model=PermissionProfileOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create permission profile",
)
async def create_permission_profile(
    body: PermissionProfileCreate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    """Create a new permission profile. Admin only."""
    profile = await user_service.create_profile(db, body, created_by_id=admin.id)
    return PermissionProfileOut.model_validate(profile)


@router.patch(
    "/permission-profiles/{profile_id}",
    response_model=PermissionProfileOut,
    summary="Update permission profile",
)
async def update_permission_profile(
    profile_id: int,
    body: PermissionProfileUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Update a permission profile. Admin only."""
    profile = await user_service.get_profile_by_id(db, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Permission profile not found")
    updated = await user_service.update_profile(db, profile, body)
    return PermissionProfileOut.model_validate(updated)


@router.delete(
    "/permission-profiles/{profile_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete permission profile",
)
async def delete_permission_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Delete a permission profile. Admin only."""
    profile = await user_service.get_profile_by_id(db, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Permission profile not found")
    await user_service.delete_profile(db, profile)

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin, require_super_admin
from app.modules.admin import service as admin_service
from app.modules.admin.schemas import (
    AdminUserUpdate,
    AssignPermissionProfileRequest,
    AssignRoleRequest,
    AuditLogListOut,
    AuditLogOut,
    Force2FARequest,
    PasswordResetResponse,
    SystemStatsOut,
)
from app.modules.users.schemas import UserOut

router = APIRouter(prefix="/admin", tags=["Administration"])


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

@router.post(
    "/users/{user_id}/reset-password",
    response_model=PasswordResetResponse,
    summary="Generate temporary password for user",
)
async def admin_reset_password(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    """
    Generate and set a random temporary password for the user.
    Returns the temporary password (show once — store it securely).
    """
    target = await admin_service.admin_get_user(db, user_id)
    temp_pw = await admin_service.reset_user_password(db, target, admin_id=admin.id)
    return PasswordResetResponse(temp_password=temp_pw)


@router.patch(
    "/users/{user_id}/activate",
    response_model=UserOut,
    summary="Activate a user account",
)
async def activate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    target = await admin_service.admin_get_user(db, user_id)
    updated = await admin_service.set_user_active(db, target, is_active=True, admin_id=admin.id)
    return UserOut.model_validate(updated)


@router.patch(
    "/users/{user_id}/deactivate",
    response_model=UserOut,
    summary="Deactivate a user account",
)
async def deactivate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    target = await admin_service.admin_get_user(db, user_id)
    updated = await admin_service.set_user_active(db, target, is_active=False, admin_id=admin.id)
    return UserOut.model_validate(updated)


@router.patch(
    "/users/{user_id}/role",
    response_model=UserOut,
    summary="Assign role to user (super_admin only)",
)
async def assign_role(
    user_id: int,
    body: AssignRoleRequest,
    db: AsyncSession = Depends(get_db),
    super_admin=Depends(require_super_admin),
):
    """Assign a role to a user. Requires super_admin."""
    target = await admin_service.admin_get_user(db, user_id)
    updated = await admin_service.assign_role(db, target, body.role, admin_id=super_admin.id)
    return UserOut.model_validate(updated)


@router.patch(
    "/users/{user_id}/permission-profile",
    response_model=UserOut,
    summary="Assign permission profile to user",
)
async def assign_permission_profile(
    user_id: int,
    body: AssignPermissionProfileRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    """Assign (or remove) a permission profile from a user."""
    target = await admin_service.admin_get_user(db, user_id)
    updated = await admin_service.assign_permission_profile(
        db, target, body.profile_id, admin_id=admin.id
    )
    return UserOut.model_validate(updated)


@router.patch(
    "/users/{user_id}/force-2fa",
    response_model=UserOut,
    summary="Enable or disable forced 2FA for a user",
)
async def force_2fa(
    user_id: int,
    body: Force2FARequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    """Force (or un-force) TOTP 2FA on a user account."""
    target = await admin_service.admin_get_user(db, user_id)
    updated = await admin_service.set_force_totp(db, target, body.enabled, admin_id=admin.id)
    return UserOut.model_validate(updated)


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------

@router.get(
    "/audit-logs",
    response_model=AuditLogListOut,
    summary="List audit logs",
)
async def list_audit_logs(
    user_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None, max_length=128),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """List audit log entries, filterable by user or action. Admin only."""
    total, logs = await admin_service.list_audit_logs(
        db, user_id=user_id, action=action, skip=skip, limit=limit
    )
    return AuditLogListOut(
        total=total,
        items=[AuditLogOut.model_validate(log) for log in logs],
    )


# ---------------------------------------------------------------------------
# System stats
# ---------------------------------------------------------------------------

@router.get(
    "/stats",
    response_model=SystemStatsOut,
    summary="System-wide statistics",
)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Return high-level system statistics. Admin only."""
    stats = await admin_service.get_system_stats(db)
    return SystemStatsOut(**stats)

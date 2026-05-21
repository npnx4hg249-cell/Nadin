from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field

from app.modules.users.models import UserRole


class AdminUserUpdate(BaseModel):
    """Admin-only fields for user updates."""
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    force_totp: Optional[bool] = None
    permission_profile_id: Optional[int] = None


class PasswordResetResponse(BaseModel):
    temp_password: str
    message: str = "Temporary password generated. User must change on next login."


class ForcePasswordResetRequest(BaseModel):
    user_id: int


class AssignRoleRequest(BaseModel):
    role: UserRole


class AssignPermissionProfileRequest(BaseModel):
    profile_id: Optional[int] = None


class Force2FARequest(BaseModel):
    enabled: bool = Field(..., description="True to enforce TOTP, False to remove enforcement")


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    resource: Optional[str]
    details: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    timestamp: datetime

    model_config = {"from_attributes": True}


class AuditLogListOut(BaseModel):
    total: int
    items: List[AuditLogOut]


class SystemStatsOut(BaseModel):
    total_users: int
    active_users: int
    users_by_role: Dict[str, int]
    total_reports: int
    total_dashboards: int
    total_plugins: int
    active_plugins: int

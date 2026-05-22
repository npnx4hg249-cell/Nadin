from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional  # noqa: F401

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.modules.users.models import UserRole


# ---------------------------------------------------------------------------
# Permission Profile schemas
# ---------------------------------------------------------------------------

class PermissionProfileBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)


class PermissionProfileCreate(PermissionProfileBase):
    pass


class PermissionProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class PermissionProfileOut(PermissionProfileBase):
    id: int
    user_count: int = 0
    created_by: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# User schemas
# ---------------------------------------------------------------------------

class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_\-]+$")
    role: UserRole = UserRole.viewer
    is_active: bool = True
    permission_profile_id: Optional[int] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_\-]+$")
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    permission_profile_id: Optional[int] = None
    force_totp: Optional[bool] = None


class UserOut(UserBase):
    id: int
    is_verified: bool
    totp_enabled: bool
    force_totp: bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime]
    permission_profile: Optional[PermissionProfileOut] = None

    model_config = {"from_attributes": True}


class UserListOut(BaseModel):
    total: int
    items: List[UserOut]


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

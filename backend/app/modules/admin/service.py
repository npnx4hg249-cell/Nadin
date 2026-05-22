from __future__ import annotations

import re
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import generate_temp_password, hash_password
from app.modules.admin.models import SystemSetting
from app.modules.users.models import AuditLog, User, UserRole


# ---------------------------------------------------------------------------
# User management operations (admin-only logic)
# ---------------------------------------------------------------------------

async def admin_get_user(db: AsyncSession, user_id: int) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def reset_user_password(db: AsyncSession, target_user: User, admin_id: int) -> str:
    """Generate a temporary password and assign it. Returns the raw temp password."""
    temp_pw = generate_temp_password()
    target_user.hashed_password = hash_password(temp_pw)
    target_user.is_verified = False  # force re-verification flow if applicable

    log = AuditLog(
        user_id=admin_id,
        action="admin_password_reset",
        resource=f"users/{target_user.id}",
        details={"target_user_id": target_user.id},
    )
    db.add(log)
    await db.flush()
    return temp_pw


async def set_user_active(db: AsyncSession, target_user: User, is_active: bool, admin_id: int) -> User:
    target_user.is_active = is_active
    action = "user_activated" if is_active else "user_deactivated"
    log = AuditLog(
        user_id=admin_id,
        action=action,
        resource=f"users/{target_user.id}",
        details={"target_user_id": target_user.id},
    )
    db.add(log)
    await db.flush()
    await db.refresh(target_user)
    return target_user


async def assign_role(
    db: AsyncSession, target_user: User, role: UserRole, admin_id: int
) -> User:
    old_role = target_user.role
    target_user.role = role
    log = AuditLog(
        user_id=admin_id,
        action="role_assigned",
        resource=f"users/{target_user.id}",
        details={"from": old_role.value, "to": role.value},
    )
    db.add(log)
    await db.flush()
    await db.refresh(target_user)
    return target_user


async def assign_permission_profile(
    db: AsyncSession, target_user: User, profile_id: Optional[int], admin_id: int
) -> User:
    target_user.permission_profile_id = profile_id
    log = AuditLog(
        user_id=admin_id,
        action="permission_profile_assigned",
        resource=f"users/{target_user.id}",
        details={"profile_id": profile_id},
    )
    db.add(log)
    await db.flush()
    await db.refresh(target_user)
    return target_user


async def set_force_totp(
    db: AsyncSession, target_user: User, enabled: bool, admin_id: int
) -> User:
    """Force (or un-force) TOTP for a user."""
    target_user.force_totp = enabled
    # If we're disabling force and TOTP is still on, leave it; if enabling, let user set it up
    action = "force_totp_enabled" if enabled else "force_totp_disabled"
    log = AuditLog(
        user_id=admin_id,
        action=action,
        resource=f"users/{target_user.id}",
        details={"target_user_id": target_user.id},
    )
    db.add(log)
    await db.flush()
    await db.refresh(target_user)
    return target_user


# ---------------------------------------------------------------------------
# Audit log queries
# ---------------------------------------------------------------------------

async def list_audit_logs(
    db: AsyncSession,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> Tuple[int, List[AuditLog]]:
    query = select(AuditLog)
    count_query = select(func.count()).select_from(AuditLog)

    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
        count_query = count_query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    query = query.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return total, list(result.scalars().all())


# ---------------------------------------------------------------------------
# System stats
# ---------------------------------------------------------------------------

async def get_system_stats(db: AsyncSession) -> dict:
    from app.modules.reports.models import Dashboard, Report
    from app.modules.plugins.models import Plugin

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    active_users = (
        await db.execute(select(func.count()).select_from(User).where(User.is_active == True))  # noqa: E712
    ).scalar_one()

    # Count by role
    users_by_role: dict = {}
    for role in UserRole:
        cnt = (
            await db.execute(
                select(func.count()).select_from(User).where(User.role == role)
            )
        ).scalar_one()
        users_by_role[role.value] = cnt

    total_reports = (await db.execute(select(func.count()).select_from(Report))).scalar_one()
    total_dashboards = (await db.execute(select(func.count()).select_from(Dashboard))).scalar_one()
    total_plugins = (await db.execute(select(func.count()).select_from(Plugin))).scalar_one()
    active_plugins = (
        await db.execute(
            select(func.count()).select_from(Plugin).where(Plugin.is_enabled == True)  # noqa: E712
        )
    ).scalar_one()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "users_by_role": users_by_role,
        "total_reports": total_reports,
        "total_dashboards": total_dashboards,
        "total_plugins": total_plugins,
        "active_plugins": active_plugins,
    }


# ---------------------------------------------------------------------------
# Database stats
# ---------------------------------------------------------------------------

async def get_db_stats(db: AsyncSession) -> dict:
    rows = await db.execute(text("""
        SELECT
            t.relname AS table_name,
            c.reltuples::bigint AS row_count,
            pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
            pg_size_pretty(pg_indexes_size(c.oid)) AS index_size
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables t ON t.relid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND t.relname IS NOT NULL
        ORDER BY pg_total_relation_size(c.oid) DESC
    """))
    tables = [
        {
            "table_name": r[0],
            "row_count": max(r[1], 0),
            "total_size": r[2],
            "index_size": r[3],
        }
        for r in rows
    ]

    db_size_row = await db.execute(
        text("SELECT pg_size_pretty(pg_database_size(current_database()))")
    )
    db_size = db_size_row.scalar() or "unknown"

    # Parse host from DATABASE_URL safely
    url = settings.DATABASE_URL
    host_match = re.search(r"@([^:/]+)", url)
    db_match = re.search(r"/([^?]+)$", url)
    host = host_match.group(1) if host_match else "localhost"
    database = db_match.group(1) if db_match else "nadin"

    return {"tables": tables, "db_size": db_size, "host": host, "database": database}


# ---------------------------------------------------------------------------
# LLM / system settings
# ---------------------------------------------------------------------------

_LLM_KEYS = {"ollama_url", "ollama_model", "llm_enabled"}


async def get_llm_settings(db: AsyncSession) -> dict:
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key.in_(_LLM_KEYS))
    )
    stored = {row.key: row.value for row in result.scalars().all()}

    return {
        "ollama_url": stored.get("ollama_url", settings.OLLAMA_URL),
        "ollama_model": stored.get("ollama_model", settings.OLLAMA_MODEL),
        "llm_enabled": stored.get("llm_enabled", str(settings.LLM_ENABLED)).lower() in ("true", "1"),
    }


async def update_llm_settings(db: AsyncSession, updates: dict, admin_id: int) -> dict:
    for key, value in updates.items():
        if key not in _LLM_KEYS:
            continue
        str_value = str(value)
        existing = await db.execute(
            select(SystemSetting).where(SystemSetting.key == key)
        )
        row = existing.scalar_one_or_none()
        if row:
            row.value = str_value
            row.updated_by = admin_id
        else:
            db.add(SystemSetting(key=key, value=str_value, updated_by=admin_id))

        # Hot-reload into the live settings object
        if key == "ollama_url":
            settings.OLLAMA_URL = value  # type: ignore[assignment]
        elif key == "ollama_model":
            settings.OLLAMA_MODEL = value  # type: ignore[assignment]
        elif key == "llm_enabled":
            settings.LLM_ENABLED = str(value).lower() in ("true", "1")  # type: ignore[assignment]

    await db.flush()
    return await get_llm_settings(db)


async def apply_system_settings_from_db(db: AsyncSession) -> None:
    """Called at startup to apply any stored LLM overrides from the DB."""
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key.in_(_LLM_KEYS))
    )
    for row in result.scalars().all():
        if row.key == "ollama_url":
            settings.OLLAMA_URL = row.value  # type: ignore[assignment]
        elif row.key == "ollama_model":
            settings.OLLAMA_MODEL = row.value  # type: ignore[assignment]
        elif row.key == "llm_enabled":
            settings.LLM_ENABLED = row.value.lower() in ("true", "1")  # type: ignore[assignment]

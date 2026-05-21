from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import generate_api_key, hash_token
from app.modules.plugins.models import Plugin, PluginHookLog
from app.modules.plugins.schemas import (
    HookEventRequest,
    PluginCreate,
    PluginUpdate,
)


# ---------------------------------------------------------------------------
# Plugin CRUD
# ---------------------------------------------------------------------------

async def list_plugins(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    plugin_type: Optional[str] = None,
    enabled_only: bool = False,
) -> Tuple[int, List[Plugin]]:
    query = select(Plugin)
    count_query = select(func.count()).select_from(Plugin)

    if plugin_type:
        query = query.where(Plugin.plugin_type == plugin_type)
        count_query = count_query.where(Plugin.plugin_type == plugin_type)
    if enabled_only:
        query = query.where(Plugin.is_enabled == True)  # noqa: E712
        count_query = count_query.where(Plugin.is_enabled == True)  # noqa: E712

    total = (await db.execute(count_query)).scalar_one()
    query = query.offset(skip).limit(limit).order_by(Plugin.created_at.desc())
    result = await db.execute(query)
    return total, list(result.scalars().all())


async def get_plugin_by_id(db: AsyncSession, plugin_id: int) -> Optional[Plugin]:
    result = await db.execute(select(Plugin).where(Plugin.id == plugin_id))
    return result.scalar_one_or_none()


async def get_plugin_by_slug(db: AsyncSession, slug: str) -> Optional[Plugin]:
    result = await db.execute(select(Plugin).where(Plugin.slug == slug))
    return result.scalar_one_or_none()


async def register_plugin(
    db: AsyncSession, data: PluginCreate
) -> Tuple[Plugin, str]:
    """
    Register a new plugin.
    Returns (plugin, raw_api_key). The raw key is shown only once.
    """
    existing = await get_plugin_by_slug(db, data.slug)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Plugin with slug '{data.slug}' is already registered",
        )

    raw_key, key_hash = generate_api_key(prefix=data.slug)

    plugin = Plugin(
        name=data.name,
        slug=data.slug,
        version=data.version,
        description=data.description,
        plugin_type=data.plugin_type,
        config=data.config,
        integration_config=data.integration_config,
        is_enabled=data.is_enabled,
        api_key_hash=key_hash,
        webhook_url=data.webhook_url,
    )
    db.add(plugin)
    await db.flush()
    await db.refresh(plugin)
    return plugin, raw_key


async def update_plugin(db: AsyncSession, plugin: Plugin, data: PluginUpdate) -> Plugin:
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(plugin, field, value)
    await db.flush()
    await db.refresh(plugin)
    return plugin


async def rotate_plugin_api_key(db: AsyncSession, plugin: Plugin) -> str:
    """Generate a new API key for the plugin. Returns the raw key."""
    raw_key, key_hash = generate_api_key(prefix=plugin.slug)
    plugin.api_key_hash = key_hash
    await db.flush()
    return raw_key


async def unregister_plugin(db: AsyncSession, plugin: Plugin) -> None:
    await db.delete(plugin)
    await db.flush()


async def toggle_plugin(db: AsyncSession, plugin: Plugin, enabled: bool) -> Plugin:
    plugin.is_enabled = enabled
    await db.flush()
    await db.refresh(plugin)
    return plugin


# ---------------------------------------------------------------------------
# Hook event handling
# ---------------------------------------------------------------------------

async def handle_hook_event(
    db: AsyncSession,
    plugin: Plugin,
    event: HookEventRequest,
) -> Dict[str, Any]:
    """
    Process an inbound hook event from a plugin.
    Logs the event and returns an ack response.
    """
    log = PluginHookLog(
        plugin_id=plugin.id,
        event_type=event.event_type,
        direction="inbound",
        payload=event.payload,
        response_status=200,
    )
    db.add(log)
    await db.flush()
    return {"received": True, "event_type": event.event_type, "message": "Event accepted"}


async def list_hook_logs(
    db: AsyncSession,
    plugin_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> Tuple[int, List[PluginHookLog]]:
    query = select(PluginHookLog)
    count_query = select(func.count()).select_from(PluginHookLog)

    if plugin_id is not None:
        query = query.where(PluginHookLog.plugin_id == plugin_id)
        count_query = count_query.where(PluginHookLog.plugin_id == plugin_id)

    total = (await db.execute(count_query)).scalar_one()
    query = query.order_by(PluginHookLog.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return total, list(result.scalars().all())


# ---------------------------------------------------------------------------
# Integration config helpers (Jira-style)
# ---------------------------------------------------------------------------

async def update_integration_config(
    db: AsyncSession, plugin: Plugin, config: Dict[str, Any]
) -> Plugin:
    """Merge new key-value pairs into the plugin's integration_config."""
    merged = {**plugin.integration_config, **config}
    plugin.integration_config = merged
    await db.flush()
    await db.refresh(plugin)
    return plugin

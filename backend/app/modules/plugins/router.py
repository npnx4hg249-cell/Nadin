from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_plugin_from_api_key, require_admin, require_super_admin
from app.modules.plugins import service as plugin_service
from app.modules.plugins.models import PluginType
from app.modules.plugins.schemas import (
    HealthCheckOut,
    HookEventRequest,
    HookEventResponse,
    PluginCreate,
    PluginHookLogListOut,
    PluginHookLogOut,
    PluginListOut,
    PluginOut,
    PluginRegisterResponse,
    PluginRotateKeyResponse,
    PluginUpdate,
)

router = APIRouter(prefix="/plugins", tags=["Plugins"])


# ---------------------------------------------------------------------------
# Plugin registry (admin-managed)
# ---------------------------------------------------------------------------

@router.get("", response_model=PluginListOut, summary="List registered plugins")
async def list_plugins(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    plugin_type: Optional[PluginType] = Query(None),
    enabled_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """List all registered plugins. Admin only."""
    total, plugins = await plugin_service.list_plugins(
        db,
        skip=skip,
        limit=limit,
        plugin_type=plugin_type.value if plugin_type else None,
        enabled_only=enabled_only,
    )
    return PluginListOut(total=total, items=[PluginOut.model_validate(p) for p in plugins])


@router.post(
    "",
    response_model=PluginRegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new plugin",
)
async def register_plugin(
    body: PluginCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """
    Register a new plugin in the registry.
    Returns the plugin record along with the raw API key (shown once — store it securely).
    """
    plugin, raw_key = await plugin_service.register_plugin(db, body)
    return PluginRegisterResponse(
        plugin=PluginOut.model_validate(plugin),
        api_key=raw_key,
    )


@router.get("/{plugin_id}", response_model=PluginOut, summary="Get plugin by ID")
async def get_plugin(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    plugin = await plugin_service.get_plugin_by_id(db, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    return PluginOut.model_validate(plugin)


@router.patch("/{plugin_id}", response_model=PluginOut, summary="Update plugin config")
async def update_plugin(
    plugin_id: int,
    body: PluginUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    plugin = await plugin_service.get_plugin_by_id(db, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    updated = await plugin_service.update_plugin(db, plugin, body)
    return PluginOut.model_validate(updated)


@router.delete(
    "/{plugin_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unregister a plugin (super_admin)",
)
async def unregister_plugin(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_super_admin),
):
    """Permanently remove a plugin from the registry. Requires super_admin."""
    plugin = await plugin_service.get_plugin_by_id(db, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    await plugin_service.unregister_plugin(db, plugin)


@router.patch(
    "/{plugin_id}/enable",
    response_model=PluginOut,
    summary="Enable a plugin",
)
async def enable_plugin(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    plugin = await plugin_service.get_plugin_by_id(db, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    updated = await plugin_service.toggle_plugin(db, plugin, enabled=True)
    return PluginOut.model_validate(updated)


@router.patch(
    "/{plugin_id}/disable",
    response_model=PluginOut,
    summary="Disable a plugin",
)
async def disable_plugin(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    plugin = await plugin_service.get_plugin_by_id(db, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    updated = await plugin_service.toggle_plugin(db, plugin, enabled=False)
    return PluginOut.model_validate(updated)


@router.post(
    "/{plugin_id}/rotate-key",
    response_model=PluginRotateKeyResponse,
    summary="Rotate plugin API key",
)
async def rotate_api_key(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Generate a new API key for a plugin. The old key is immediately invalidated."""
    plugin = await plugin_service.get_plugin_by_id(db, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    raw_key = await plugin_service.rotate_plugin_api_key(db, plugin)
    return PluginRotateKeyResponse(api_key=raw_key)


@router.patch(
    "/{plugin_id}/integration-config",
    response_model=PluginOut,
    summary="Update plugin integration config",
)
async def update_integration_config(
    plugin_id: int,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Merge key-value pairs into the plugin's integration config (Jira-style settings)."""
    plugin = await plugin_service.get_plugin_by_id(db, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    updated = await plugin_service.update_integration_config(db, plugin, body)
    return PluginOut.model_validate(updated)


# ---------------------------------------------------------------------------
# Plugin health check
# ---------------------------------------------------------------------------

@router.get(
    "/{plugin_id}/health",
    response_model=HealthCheckOut,
    summary="Plugin health status",
)
async def plugin_health(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Return the health status of a registered plugin."""
    plugin = await plugin_service.get_plugin_by_id(db, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    # In a full implementation this would ping the plugin's webhook_url or run a health check
    # For now we report status based purely on the enabled flag
    return HealthCheckOut(
        plugin_id=plugin.id,
        slug=plugin.slug,
        is_enabled=plugin.is_enabled,
        status="ok" if plugin.is_enabled else "degraded",
    )


# ---------------------------------------------------------------------------
# REST API hook endpoint (authenticated by plugin API key)
# ---------------------------------------------------------------------------

@router.post(
    "/hook/event",
    response_model=HookEventResponse,
    summary="Inbound REST hook from plugin",
)
async def inbound_hook(
    body: HookEventRequest,
    db: AsyncSession = Depends(get_db),
    plugin=Depends(get_plugin_from_api_key),
):
    """
    Endpoint called by plugins to push events into Nadin.
    Authenticated via X-Api-Key header.
    """
    result = await plugin_service.handle_hook_event(db, plugin, body)
    return HookEventResponse(**result)


# ---------------------------------------------------------------------------
# Hook logs (admin view)
# ---------------------------------------------------------------------------

@router.get(
    "/{plugin_id}/hook-logs",
    response_model=PluginHookLogListOut,
    summary="List hook event logs for a plugin",
)
async def list_hook_logs(
    plugin_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    plugin = await plugin_service.get_plugin_by_id(db, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    total, logs = await plugin_service.list_hook_logs(db, plugin_id=plugin_id, skip=skip, limit=limit)
    return PluginHookLogListOut(
        total=total,
        items=[PluginHookLogOut.model_validate(log) for log in logs],
    )

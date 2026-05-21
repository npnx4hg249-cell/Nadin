from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from app.modules.plugins.models import PluginType


class PluginBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    slug: str = Field(..., min_length=1, max_length=128, pattern=r"^[a-z0-9\-_]+$")
    version: str = Field("1.0.0", max_length=32)
    description: Optional[str] = None
    plugin_type: PluginType = PluginType.generic
    config: Dict[str, Any] = Field(default_factory=dict)
    integration_config: Dict[str, Any] = Field(default_factory=dict)
    is_enabled: bool = True
    webhook_url: Optional[str] = Field(None, max_length=2048)


class PluginCreate(PluginBase):
    pass


class PluginUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=256)
    version: Optional[str] = Field(None, max_length=32)
    description: Optional[str] = None
    plugin_type: Optional[PluginType] = None
    config: Optional[Dict[str, Any]] = None
    integration_config: Optional[Dict[str, Any]] = None
    is_enabled: Optional[bool] = None
    webhook_url: Optional[str] = Field(None, max_length=2048)


class PluginOut(PluginBase):
    id: int
    created_at: datetime
    updated_at: datetime
    # api_key_hash is NEVER returned to the client

    model_config = {"from_attributes": True}


class PluginListOut(BaseModel):
    total: int
    items: List[PluginOut]


class PluginRegisterResponse(BaseModel):
    plugin: PluginOut
    api_key: Optional[str] = Field(
        None,
        description="Raw API key — shown ONCE on registration. Store it securely.",
    )


class PluginRotateKeyResponse(BaseModel):
    api_key: str = Field(..., description="New raw API key — shown ONCE. Store it securely.")


class HookEventRequest(BaseModel):
    """Payload sent by a plugin when calling a REST API hook."""
    event_type: str = Field(..., min_length=1, max_length=128)
    payload: Dict[str, Any] = Field(default_factory=dict)


class HookEventResponse(BaseModel):
    received: bool = True
    event_type: str
    message: str = "Event accepted"


class PluginHookLogOut(BaseModel):
    id: int
    plugin_id: int
    event_type: str
    direction: str
    payload: Optional[Dict[str, Any]]
    response_status: Optional[int]
    error_message: Optional[str]
    timestamp: datetime

    model_config = {"from_attributes": True}


class PluginHookLogListOut(BaseModel):
    total: int
    items: List[PluginHookLogOut]


class HealthCheckOut(BaseModel):
    plugin_id: int
    slug: str
    is_enabled: bool
    status: str  # "ok" | "degraded" | "unknown"

from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class PluginType(str, enum.Enum):
    data_source = "data_source"        # Provides data to reports/dashboards
    exporter = "exporter"              # Exports reports to external systems
    notifier = "notifier"              # Sends notifications/alerts
    transformer = "transformer"        # Transforms/processes data
    auth_provider = "auth_provider"    # External auth integration (SSO, LDAP)
    webhook = "webhook"                # Receives inbound webhooks
    generic = "generic"                # Catch-all for other plugin types


class Plugin(Base):
    """Registered plugin in the plugin registry."""
    __tablename__ = "plugins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False, default="1.0.0")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    plugin_type: Mapped[PluginType] = mapped_column(
        Enum(PluginType, name="plugintype"), default=PluginType.generic, nullable=False
    )
    # Arbitrary plugin configuration (credentials, endpoints, options, etc.)
    config: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    # Integration-style config (e.g. Jira project keys, base URLs)
    integration_config: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # REST API hook — hashed API key for plugin→Nadin communication
    api_key_hash: Mapped[Optional[str]] = mapped_column(String(256), unique=True, nullable=True, index=True)
    # Outbound webhook URL for Nadin→plugin event delivery
    webhook_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    webhook_secret_hash: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class PluginHookLog(Base):
    """Log of REST API hook calls made by/to plugins."""
    __tablename__ = "plugin_hook_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plugin_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    direction: Mapped[str] = mapped_column(String(16), nullable=False)  # "inbound" | "outbound"
    payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    response_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)

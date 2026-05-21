from __future__ import annotations

"""
Plugin base classes and interfaces.

Every plugin type should subclass `BasePlugin` and implement the required
abstract methods. The plugin registry uses the `plugin_type` attribute to
route events appropriately.

This module is intentionally kept lightweight — it contains Python class
definitions only, with no DB I/O or HTTP calls.
"""

import abc
from typing import Any, Dict, Optional


class BasePlugin(abc.ABC):
    """
    Abstract base class for all Nadin plugins.

    Concrete plugin implementations live outside this codebase (they are
    loaded at runtime from the plugin registry) and must satisfy this interface.
    """

    #: Human-readable display name
    name: str = ""
    #: URL-safe unique identifier (matches Plugin.slug in DB)
    slug: str = ""
    #: Semantic version string, e.g. "1.2.0"
    version: str = "1.0.0"
    #: PluginType enum value (string)
    plugin_type: str = "generic"

    def __init__(self, config: Dict[str, Any]):
        self.config = config

    @abc.abstractmethod
    async def health_check(self) -> bool:
        """
        Return True if the plugin is healthy / reachable.
        Called periodically by the plugin manager.
        """

    async def on_register(self) -> None:
        """Hook called once when the plugin is first registered."""

    async def on_unregister(self) -> None:
        """Hook called once when the plugin is unregistered."""

    async def on_enable(self) -> None:
        """Hook called when the plugin is toggled on."""

    async def on_disable(self) -> None:
        """Hook called when the plugin is toggled off."""


class DataSourcePlugin(BasePlugin):
    """
    Plugin that provides data to reports and dashboards.
    """

    plugin_type: str = "data_source"

    @abc.abstractmethod
    async def fetch_data(
        self, query: Dict[str, Any], context: Optional[Dict[str, Any]] = None
    ) -> Any:
        """
        Fetch data according to the supplied query parameters.

        Args:
            query:   Plugin-specific query dict (filters, date ranges, etc.)
            context: Optional runtime context (user, report id, etc.)

        Returns:
            Plugin-specific data structure (list, dict, DataFrame proxy, etc.)
        """


class ExporterPlugin(BasePlugin):
    """
    Plugin that exports Nadin reports to external systems.
    """

    plugin_type: str = "exporter"

    @abc.abstractmethod
    async def export(
        self, report_data: Dict[str, Any], destination: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Export report data to an external destination.

        Returns a dict with at least {"success": bool, "url": str | None}.
        """


class NotifierPlugin(BasePlugin):
    """
    Plugin that sends notifications or alerts.
    """

    plugin_type: str = "notifier"

    @abc.abstractmethod
    async def send_notification(
        self, event: str, payload: Dict[str, Any], recipients: Optional[list] = None
    ) -> bool:
        """
        Send a notification for the given event.

        Returns True if the notification was accepted by the downstream system.
        """


class WebhookPlugin(BasePlugin):
    """
    Plugin that handles inbound webhook events from external systems.
    """

    plugin_type: str = "webhook"

    @abc.abstractmethod
    async def handle_webhook(
        self, event_type: str, payload: Dict[str, Any], headers: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Process an inbound webhook event.

        Returns a dict that will be serialised as the HTTP response body.
        """

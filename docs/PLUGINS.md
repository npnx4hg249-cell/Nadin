# Nadin Plugin Development Guide

Nadin supports a plugin architecture that allows extending its capabilities without modifying core code. Plugins can be developed externally and integrated via the REST API.

## Plugin Types

| Type | Description |
|------|-------------|
| `data_source` | Provide data to Nadin reports from external sources |
| `integration` | Push/pull data to/from external systems (Jira, Slack, etc.) |
| `processor` | Transform and analyze data (AI, OCR, etc.) |
| `exporter` | Export reports in custom formats |

## Registering a Plugin

Plugins are registered via the admin UI or the REST API:

```bash
curl -X POST http://nadin-host/api/v1/plugins \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Integration",
    "slug": "my-integration",
    "plugin_type": "integration",
    "config": {
      "endpoint": "http://my-service:8080",
      "timeout": 30
    }
  }'
```

The response includes a one-time API key for this plugin. Store it securely — it will not be shown again.

## Plugin API Key Usage

Use the plugin API key to access the external data endpoint:

```bash
curl http://nadin-host/api/v1/plugins/external/my-integration/data \
  -H "Authorization: Bearer <plugin-api-key>"
```

## Jira Integration Example

```json
{
  "name": "Jira",
  "slug": "jira",
  "plugin_type": "integration",
  "config": {
    "base_url": "https://your-company.atlassian.net",
    "project_keys": ["PROJ1", "PROJ2"],
    "api_token_env": "JIRA_API_TOKEN"
  }
}
```

## Internal Plugin Development

To build a native Nadin plugin (runs inside the container):

1. Create a new module under `backend/app/modules/`
2. Implement the `PluginBase` interface from `backend/app/modules/plugins/base.py`
3. Register the plugin class in `backend/app/modules/plugins/registry.py`
4. Add any required DB models and migrations
5. Register the router in `backend/app/main.py`

### PluginBase Interface

```python
from app.modules.plugins.base import PluginBase, PluginMetadata

class MyPlugin(PluginBase):
    metadata = PluginMetadata(
        name="My Plugin",
        slug="my-plugin",
        version="1.0.0",
        plugin_type="integration",
        description="Does something useful",
    )

    async def initialize(self, config: dict) -> None:
        # Called when plugin is enabled
        pass

    async def execute(self, action: str, params: dict) -> dict:
        # Handle plugin actions
        pass

    async def health_check(self) -> bool:
        # Return True if plugin is healthy
        return True
```

## Webhook Events

Plugins can subscribe to Nadin events:

| Event | Description |
|-------|-------------|
| `report.created` | A new report was created |
| `report.updated` | A report was modified |
| `user.login` | A user logged in |
| `user.created` | A new user was created |

Configure webhooks in the plugin config:
```json
{
  "webhooks": {
    "report.created": "http://my-service/webhook/report-created",
    "user.login": "http://my-service/webhook/login"
  }
}
```

## Security Considerations

- Plugin API keys are stored as bcrypt hashes in the database
- Each key is scoped to a single plugin with defined permissions
- All plugin API calls are rate-limited (60 req/min by default)
- Plugin API calls are audit-logged
- Native plugins run in the same process — review code carefully before adding
- Webhook endpoints must be reachable from the Nadin container network

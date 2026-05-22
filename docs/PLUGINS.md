# Nadin Plugin Development Guide

Nadin's plugin architecture allows extending capabilities without modifying core code. Plugins can be registered via the Admin UI or REST API and receive a unique API key for authenticated access.

## Plugin Types

| Type | Description |
|------|-------------|
| `data_source` | Provide external data to Nadin reports |
| `integration` | Push/pull data to/from external systems (Jira, Slack, etc.) |
| `processor` | Transform and analyse data (custom algorithms, OCR, etc.) |
| `exporter` | Export reports in custom formats |

---

## Registering a Plugin

### Via Admin UI

**Admin** → **Plugins** → **Register Plugin**

Fill in name, slug, type, and optional configuration JSON. The generated API key is shown once — store it securely.

### Via REST API

```bash
curl -X POST http://nadin-host/api/v1/plugins \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Integration",
    "slug": "my-integration",
    "description": "Pulls data from my internal service",
    "plugin_type": "integration",
    "config": {
      "endpoint": "http://my-service:8080",
      "timeout": 30
    }
  }'
```

**Response includes a one-time API key.** It will not be shown again.

---

## Plugin API Key Usage

Use the API key to access the external data endpoint:

```bash
curl http://nadin-host/api/v1/plugins/external/my-integration/data \
  -H "Authorization: Bearer <plugin-api-key>"
```

API keys are stored as bcrypt hashes in the database — Nadin cannot recover a lost key. Use **Admin → Plugins → Regenerate Key** to issue a new one.

---

## Managing Plugins

| Action | API | Admin UI |
|--------|-----|----------|
| Enable | `POST /plugins/{slug}/enable` | Plugins → toggle |
| Disable | `POST /plugins/{slug}/disable` | Plugins → toggle |
| Update config | `POST /plugins/{slug}/configure` | Plugins → Configure |
| Remove | `DELETE /plugins/{slug}` | Plugins → Delete |

---

## Example: Jira Integration

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

---

## Native Plugin Development

Native plugins run inside the Nadin backend container and have full access to the database and services.

### File Structure

```
backend/app/modules/my_plugin/
├── __init__.py
├── models.py       # SQLAlchemy models (if needed)
├── schemas.py      # Pydantic request/response models
├── service.py      # Business logic
└── router.py       # FastAPI router
```

### Registration

1. Add SQLAlchemy models to `models.py` and import them in `backend/app/main.py`
2. Register the router in `backend/app/main.py`:
   ```python
   from app.modules.my_plugin.router import router as my_plugin_router
   app.include_router(my_plugin_router, prefix=API_PREFIX)
   ```
3. Create an Alembic migration for any new tables:
   ```bash
   alembic revision --autogenerate -m "add my_plugin tables"
   alembic upgrade head
   ```

---

## Webhook Events

Plugins can subscribe to Nadin events by configuring webhook endpoints. Nadin will `POST` a JSON payload to the endpoint when the event occurs.

| Event | Trigger |
|-------|---------|
| `report.created` | A new report is created |
| `report.updated` | A report is modified |
| `report.deleted` | A report is deleted |
| `user.login` | A user logs in successfully |
| `user.created` | A new user is created |

**Configuration example:**
```json
{
  "config": {
    "webhooks": {
      "report.created": "http://my-service/nadin-webhook",
      "user.login": "http://my-service/audit"
    }
  }
}
```

Webhook payloads include: `event`, `timestamp`, `actor_id`, `resource_id`, and a `data` object with event-specific fields.

---

## Security Considerations

- Plugin API keys are bcrypt-hashed in the database; lost keys cannot be recovered
- API keys are scoped to a single plugin and the permissions you define
- All plugin API calls are rate-limited (60 req/min by default, configured in nginx)
- Plugin API calls are written to the audit log
- Native plugins run in the same process as the backend — audit code carefully before adding
- Webhook endpoints must be reachable from within the Docker internal network; external URLs require adjusting the network configuration
- Never expose plugin API keys in logs or error messages

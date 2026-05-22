# Nadin REST API Reference

Base URL: `http(s)://<host>/api/v1`

All responses use JSON. Authenticated endpoints require `Authorization: Bearer <access_token>`. The access token is obtained from `/auth/login` and has a 30-minute lifetime; use `/auth/refresh` (via the auto-sent httpOnly cookie) to obtain a new one.

---

## Authentication — `/auth`

### POST `/auth/login`

Authenticate with email and password.

**Request:**
```json
{ "username": "user@example.com", "password": "your_password" }
```
> Note: the field is named `username` but accepts an email address.

**Response:**
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 1800
}
```

A `refresh_token` httpOnly cookie is also set (path `/api/v1/auth`, `SameSite=Lax`).

---

### POST `/auth/2fa/verify`

Complete login when TOTP is required.

**Request:**
```json
{ "email": "user@example.com", "code": "123456" }
```

**Response:** Same as successful login above.

---

### POST `/auth/refresh`

Refresh the access token. The `refresh_token` cookie is sent automatically by the browser.

**Response:**
```json
{ "access_token": "<new_jwt>", "token_type": "bearer" }
```

Refresh tokens are single-use; a new cookie is set on each refresh.

---

### POST `/auth/logout`

Revoke the current refresh token and clear the cookie.

---

### POST `/auth/2fa/setup`

Initiate TOTP 2FA setup for the authenticated user.

**Response:**
```json
{
  "secret": "BASE32SECRET",
  "qr_uri": "otpauth://totp/Nadin:user@example.com?secret=...",
  "backup_codes": ["XXXXXX", "YYYYYY"]
}
```

---

### POST `/auth/2fa/confirm`

Confirm and activate 2FA.

**Request:** `{ "code": "123456" }`

---

### DELETE `/auth/2fa`

Disable 2FA for the authenticated user (requires current TOTP code).

---

## Users — `/users`

### GET `/users/me`
Get current user profile.

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "alice",
  "role": "editor",
  "is_active": true,
  "is_verified": true,
  "totp_enabled": false,
  "force_totp": false,
  "permission_profile_id": null,
  "created_at": "2025-01-01T00:00:00Z",
  "last_login": "2025-05-22T10:00:00Z"
}
```

### PATCH `/users/me`
Update username or email.

**Request:** `{ "username": "alice2", "email": "alice2@example.com" }`

### POST `/users/me/change-password`

**Request:**
```json
{
  "current_password": "old",
  "new_password": "new_strong_pass",
  "confirm_password": "new_strong_pass"
}
```

---

## Admin — `/admin` *(requires `admin` or `super_admin`)*

### GET `/admin/users`
List all users. Query params: `page`, `per_page`, `search`, `role`, `is_active`.

### POST `/admin/users`
Create a new user.

**Request:**
```json
{
  "email": "new@example.com",
  "username": "newuser",
  "role": "viewer",
  "permission_profile_id": 1
}
```

### GET `/admin/users/{user_id}`

### PATCH `/admin/users/{user_id}`
Update role, active status, permission profile, or force_totp.

**Request:**
```json
{
  "role": "editor",
  "is_active": true,
  "permission_profile_id": 2,
  "force_totp": true
}
```

### POST `/admin/users/{user_id}/reset-password`
Generate a temporary password.

**Response:** `{ "temporary_password": "TempPass123!" }`

### DELETE `/admin/users/{user_id}`
Deactivate (soft-delete) a user.

### GET `/admin/permission-profiles`
List all permission profiles.

### POST `/admin/permission-profiles`

**Request:**
```json
{
  "name": "Report Viewer",
  "description": "View-only access to reports",
  "permissions": ["reports.view", "reports.run"]
}
```

Available permissions: `reports.view`, `reports.create`, `reports.edit`, `reports.delete`, `reports.run`, `reports.export`, `plugins.view`, `plugins.install`, `plugins.configure`, `admin.users`, `admin.audit`, `admin.settings`

### PATCH `/admin/permission-profiles/{profile_id}`
### DELETE `/admin/permission-profiles/{profile_id}`

### GET `/admin/audit-logs`
Query params: `page`, `per_page`, `user_id`, `action`, `from`, `to`

### GET `/admin/stats`
Dashboard statistics (admin only).

**Response:**
```json
{
  "user_count": 42,
  "active_user_count": 38,
  "report_count": 15,
  "plugin_count": 3,
  "recent_report_runs": 128,
  "storage_used_mb": 240
}
```

---

## Data Ingest — `/datasets`

### POST `/datasets`
Upload a dataset. `multipart/form-data`.

**Form fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | ✓ | `.csv`, `.xlsx`, `.xls`, `.json`, `.parquet` |
| `name` | string | ✓ | Display name |
| `description` | string | | Optional description |
| `is_public` | bool | | Default `false` |
| `translate_to` | string | | `'en'` or `'de'` — AI-translate column names and string values |

**Response:**
```json
{
  "id": 1,
  "name": "Sales 2024",
  "status": "ready",
  "row_count": 50000,
  "column_count": 12,
  "schema_info": {
    "columns": [
      { "name": "region", "dtype": "String", "nullable": true },
      { "name": "revenue", "dtype": "Float64", "nullable": true }
    ]
  },
  "file_size_bytes": 2048000,
  "original_filename": "sales_2024.csv",
  "original_format": "csv",
  "is_public": false,
  "owner_id": 1,
  "created_at": "2025-05-22T10:00:00Z",
  "updated_at": "2025-05-22T10:00:05Z"
}
```

Status values: `pending` → `processing` → `ready` | `error`

### GET `/datasets`
Query params: `skip`, `limit`, `include_public` (default `true`)

### GET `/datasets/{dataset_id}`
### PATCH `/datasets/{dataset_id}`
**Request:** `{ "name": "New Name", "description": "...", "is_public": true }`

### DELETE `/datasets/{dataset_id}`

---

## Data Engine — `/engine`

### POST `/engine/query`
Execute a raw SQL SELECT against a dataset.

**Request:**
```json
{
  "dataset_id": 1,
  "sql": "SELECT region, SUM(revenue) AS total FROM dataset GROUP BY region ORDER BY total DESC",
  "limit": 1000
}
```

**Response:**
```json
{
  "columns": ["region", "total"],
  "rows": [["EMEA", 1234567.89], ["APAC", 987654.32]],
  "row_count": 2,
  "truncated": false
}
```

> The table is always named `dataset`. Only `SELECT` statements are permitted.

### GET `/engine/datasets/{dataset_id}/preview`
Query params: `limit` (1–1000, default 100)

### POST `/engine/aggregate`

**Request:**
```json
{
  "dataset_id": 1,
  "group_by": ["region"],
  "metrics": [{ "column": "revenue", "function": "sum", "alias": "total_revenue" }],
  "filters": [{ "column": "year", "op": "=", "value": 2024 }],
  "limit": 500
}
```

---

## Analysis — `/analysis`

### POST `/analysis/run`
Run an analysis from a `MetricDef` list.

**Request:**
```json
{
  "dataset_id": 1,
  "metrics": [
    { "column": "revenue", "function": "sum", "alias": "total_revenue" },
    { "column": "orders", "function": "count", "alias": "order_count" }
  ],
  "group_by": ["region", "product_category"],
  "filters": [
    { "column": "year", "op": "=", "value": 2024 },
    { "column": "status", "op": "=", "value": "complete" }
  ],
  "include_stats": false
}
```

Supported functions: `sum`, `avg`, `min`, `max`, `count`, `count_distinct`, `stddev`, `variance`, `median`

Supported filter operators: `=`, `!=`, `>`, `>=`, `<`, `<=`, `LIKE`, `IN`, `IS NULL`, `IS NOT NULL`

**Response:**
```json
{
  "columns": ["region", "product_category", "total_revenue", "order_count"],
  "rows": [["EMEA", "Software", 500000, 120]],
  "row_count": 1,
  "stats": null
}
```

### GET `/analysis/configs`
Query params: `skip`, `limit`

### POST `/analysis/configs`
Save a reusable analysis configuration.

**Request:**
```json
{
  "name": "Monthly Revenue Breakdown",
  "description": "Revenue by region, grouped monthly",
  "dataset_id": 1,
  "config": {
    "metrics": [{ "column": "revenue", "function": "sum" }],
    "group_by": ["region"],
    "filters": []
  }
}
```

### GET `/analysis/configs/{config_id}`
### PATCH `/analysis/configs/{config_id}`
### DELETE `/analysis/configs/{config_id}`

### POST `/analysis/configs/{config_id}/run`
Run a saved configuration.

---

### Insights

#### POST `/analysis/insights`
Save an analysis result as a named Insight.

**Request:**
```json
{
  "name": "Q1 Revenue by Region",
  "description": "Top-line revenue split for Q1 2024",
  "dataset_id": 1,
  "query_mode": "metric_builder",
  "sql_query": "SELECT region, SUM(revenue) AS total FROM dataset GROUP BY region",
  "columns": ["region", "total"],
  "rows": [["EMEA", 1234567]],
  "row_count": 4,
  "chart_type": "bar"
}
```

`query_mode` values: `metric_builder`, `natural_language`, `raw_sql`

#### GET `/analysis/insights`
Query params: `skip`, `limit`

#### GET `/analysis/insights/{insight_id}`
#### PATCH `/analysis/insights/{insight_id}`
**Request:** `{ "name": "...", "description": "...", "chart_type": "line" }`

#### DELETE `/analysis/insights/{insight_id}`

#### POST `/analysis/insights/{insight_id}/add-to`
Link an insight to one or more reports and/or dashboards.

**Request:**
```json
{
  "report_ids": [1, 3],
  "dashboard_ids": [2]
}
```

IDs are merged into the insight's existing `report_ids`/`dashboard_ids` arrays (no duplicates).

---

## LLM — `/llm`

### GET `/llm/health`
Check Ollama availability.

**Response:**
```json
{
  "enabled": true,
  "reachable": true,
  "model": "qwen2.5-coder:7b-instruct",
  "error": null
}
```

### POST `/llm/nl-to-sql`
Convert a natural language question to a DuckDB SQL SELECT statement.

**Request:**
```json
{
  "question": "Show me total revenue by region for 2024, sorted highest first",
  "dataset_id": 1,
  "schema_context": "TABLE: dataset\nCOLUMNS:\n  region String\n  revenue Float64\n  year Int32"
}
```

`schema_context` is optional but strongly recommended — the frontend sends it automatically from the dataset's `schema_info`.

**Response:**
```json
{
  "sql": "SELECT region, SUM(revenue) AS total_revenue FROM dataset WHERE year = 2024 GROUP BY region ORDER BY total_revenue DESC",
  "model": "qwen2.5-coder:7b-instruct",
  "prompt_tokens": 142
}
```

**Errors:** Returns `503` if Ollama is unreachable or `LLM_ENABLED=false`.

---

## Output — `/output`

### POST `/output/csv`
Export a result set as a CSV file download.

**Request:**
```json
{
  "columns": ["region", "total"],
  "rows": [["EMEA", 1234567]]
}
```

**Response:** `text/csv` binary

### POST `/output/pdf`
Generate a PDF report. Returns `application/pdf` binary.

**Request:**
```json
{
  "sections": [
    { "type": "heading", "content": "Q1 Revenue Report" },
    { "type": "paragraph", "content": "Summary of Q1 2024 performance." },
    {
      "type": "table",
      "columns": ["Region", "Revenue"],
      "rows": [["EMEA", "1,234,567"]]
    }
  ]
}
```

Section types: `heading`, `subheading`, `paragraph`, `table`, `chart`

### POST `/output/grafana`
Generate a Grafana dashboard JSON (schema version 38).

**Request:**
```json
{
  "panels": [
    {
      "title": "Revenue by Region",
      "type": "graph",
      "metrics": [{ "column": "revenue", "function": "sum" }],
      "group_by": ["region"]
    }
  ]
}
```

**Response:** `application/json` — import directly into Grafana via Dashboard → Import.

---

## Reports — `/reports`

### GET `/reports`
Query params: `skip`, `limit`, `search`

### POST `/reports`
**Request:**
```json
{
  "name": "Monthly Summary",
  "description": "End-of-month executive summary",
  "config": {},
  "status": "draft",
  "is_public": false,
  "template_id": null
}
```

### GET `/reports/{report_id}`
### PATCH `/reports/{report_id}`
### DELETE `/reports/{report_id}`

### Report Templates — `/reports/templates`

Same CRUD pattern: `GET`, `POST`, `GET /{id}`, `PATCH /{id}`, `DELETE /{id}`

---

## Dashboards — `/dashboards`

### GET `/dashboards`
### POST `/dashboards`
**Request:**
```json
{
  "name": "Executive Overview",
  "description": "Top-level KPI dashboard",
  "layout": {},
  "layout_type": "grid",
  "is_public": false
}
```
`layout_type`: `grid`, `freeform`, `fixed`

### GET `/dashboards/{dashboard_id}`
### PATCH `/dashboards/{dashboard_id}`
### DELETE `/dashboards/{dashboard_id}`

---

## Plugins — `/plugins`

### GET `/plugins`
### POST `/plugins`
Register a plugin and receive its API key (shown once).

**Request:**
```json
{
  "name": "Jira Integration",
  "slug": "jira",
  "description": "Sync issues from Jira",
  "plugin_type": "integration",
  "config": { "base_url": "https://company.atlassian.net" }
}
```

### GET `/plugins/{slug}`
### PATCH `/plugins/{slug}`
### DELETE `/plugins/{slug}`
### POST `/plugins/{slug}/enable`
### POST `/plugins/{slug}/disable`
### POST `/plugins/{slug}/configure`
Update plugin configuration: `{ "config": { ... } }`

### GET `/plugins/external/{slug}/data`
External endpoint for plugin API key holders.
`Authorization: Bearer <plugin-api-key>`

---

## Health — `/health`

### GET `/health`

**Response:**
```json
{
  "status": "ok",
  "app": "Nadin",
  "version": "1.0.0",
  "env": "production",
  "database": "ok",
  "redis": "ok"
}
```

---

## Error Responses

```json
{ "detail": "Human-readable error message" }
```

| Code | Meaning |
|------|---------|
| 400 | Bad request — invalid input or SQL |
| 401 | Unauthorized — missing or expired token |
| 403 | Forbidden — insufficient role/permissions |
| 404 | Not found |
| 413 | Payload too large (dataset > 512 MB) |
| 422 | Validation error — malformed request body |
| 429 | Rate limit exceeded |
| 503 | Service unavailable (LLM offline) |
| 500 | Internal server error |

# Nadin REST API Reference

Base URL: `http(s)://<host>/api/v1`

All API responses use JSON. Authenticated endpoints require `Authorization: Bearer <access_token>`.

---

## Authentication (`/auth`)

### POST `/auth/login`
Authenticate with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response (no 2FA):**
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "requires_2fa": false,
  "user": { "id": 1, "email": "...", "role": "viewer" }
}
```

**Response (2FA required):**
```json
{
  "requires_2fa": true,
  "temp_token": "<short-lived-token>"
}
```

---

### POST `/auth/2fa/verify`
Complete 2FA login.

**Request:**
```json
{
  "temp_token": "<temp_token>",
  "code": "123456"
}
```

**Response:** Same as successful login above.

---

### POST `/auth/refresh`
Refresh access token using httpOnly cookie `refresh_token`.

**Response:**
```json
{ "access_token": "<new_jwt>", "token_type": "bearer" }
```

---

### POST `/auth/logout`
Revoke the current refresh token.

---

### POST `/auth/2fa/setup`
Initiate 2FA setup for the authenticated user.

**Response:**
```json
{
  "secret": "BASE32SECRET",
  "qr_uri": "otpauth://totp/Nadin:user@example.com?secret=..."
}
```

---

### POST `/auth/2fa/confirm`
Confirm and activate 2FA setup.

**Request:**
```json
{ "code": "123456" }
```

---

## Users (`/users`)

### GET `/users/me`
Get current user profile.

### PATCH `/users/me`
Update current user profile (username, display_name).

### POST `/users/me/change-password`
Change current user's password.

**Request:**
```json
{
  "current_password": "old_password",
  "new_password": "new_password"
}
```

---

## Admin (`/admin`) — Requires `admin` or `super_admin` role

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
Get specific user details.

### PATCH `/admin/users/{user_id}`
Update user (role, permissions, active status).

### POST `/admin/users/{user_id}/reset-password`
Reset a user's password (generates a temporary password).

**Response:**
```json
{ "temporary_password": "TempPass123!" }
```

### POST `/admin/users/{user_id}/force-2fa`
Force 2FA requirement for a user.

**Request:**
```json
{ "enabled": true }
```

### DELETE `/admin/users/{user_id}`
Deactivate a user account (soft delete).

### GET `/admin/permission-profiles`
List all permission profiles.

### POST `/admin/permission-profiles`
Create a permission profile.

**Request:**
```json
{
  "name": "Report Viewer",
  "description": "Can view but not edit reports",
  "permissions": {
    "reports.view": true,
    "reports.create": false,
    "reports.edit": false,
    "reports.delete": false,
    "dashboards.view": true,
    "plugins.view": false
  }
}
```

### PATCH `/admin/permission-profiles/{profile_id}`
Update a permission profile.

### DELETE `/admin/permission-profiles/{profile_id}`
Delete a permission profile.

### GET `/admin/audit-logs`
List audit log entries. Query params: `page`, `per_page`, `user_id`, `action`, `from`, `to`.

---

## Reports (`/reports`)

### GET `/reports`
List accessible reports.

### POST `/reports`
Create a new report template.

**Request:**
```json
{
  "name": "Monthly Summary",
  "description": "...",
  "config": {
    "type": "bar_chart",
    "data_source": null,
    "filters": [],
    "columns": []
  },
  "is_public": false
}
```

### GET `/reports/{report_id}`
Get report details.

### PATCH `/reports/{report_id}`
Update report.

### DELETE `/reports/{report_id}`
Delete report.

---

## Dashboards (`/dashboards`)

### GET `/dashboards`
List accessible dashboards.

### POST `/dashboards`
Create a dashboard.

### GET `/dashboards/{dashboard_id}`
Get dashboard configuration.

### PATCH `/dashboards/{dashboard_id}`
Update dashboard layout.

### DELETE `/dashboards/{dashboard_id}`
Delete dashboard.

---

## Plugins (`/plugins`) — Admin for write operations

### GET `/plugins`
List registered plugins.

### POST `/plugins`
Register a new plugin. Returns generated API key (shown once).

**Request:**
```json
{
  "name": "Jira Integration",
  "slug": "jira",
  "plugin_type": "integration",
  "config": {
    "base_url": "https://your-jira.atlassian.net",
    "project_key": "MYPROJ"
  }
}
```

### GET `/plugins/{slug}`
Get plugin details.

### PATCH `/plugins/{slug}`
Update plugin configuration.

### DELETE `/plugins/{slug}`
Remove plugin registration.

### POST `/plugins/{slug}/toggle`
Enable or disable a plugin.

### GET `/plugins/external/{slug}/data`
External data endpoint for plugin API key holders.
`Authorization: Bearer <plugin-api-key>`

---

## Health (`/health`)

### GET `/health`
Check system health.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected"
}
```

---

## Error Responses

All errors follow this format:
```json
{
  "detail": "Human-readable error message"
}
```

| HTTP Code | Meaning |
|-----------|---------|
| 400 | Bad Request — invalid input |
| 401 | Unauthorized — missing or invalid token |
| 403 | Forbidden — insufficient permissions |
| 404 | Not Found |
| 422 | Validation Error — request body malformed |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal Server Error |

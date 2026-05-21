# Nadin — Architecture Overview

## System Architecture

Nadin is a modular, self-contained dashboard and report generation platform. All components run in Docker containers and communicate over an isolated internal network. No external internet access is required during operation.

```
┌─────────────────────────────────────────────────────────────┐
│                        External Network                      │
│                                                              │
│   Browser ──────► Nginx (80/443) ──────► [Internal Network] │
└─────────────────────────────────────────────────────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────┐
                    │            Internal Network                      │
                    │                                                  │
                    │   ┌──────────────┐    ┌──────────────────────┐  │
                    │   │   Frontend   │    │       Backend         │  │
                    │   │  (React SPA) │    │     (FastAPI)         │  │
                    │   │   nginx:80   │    │   uvicorn:8000        │  │
                    │   └──────────────┘    └──────────────────────┘  │
                    │                              │                   │
                    │              ┌───────────────┼──────────┐        │
                    │              │               │          │        │
                    │   ┌──────────▼──┐    ┌───────▼────┐    │        │
                    │   │  PostgreSQL  │    │   Redis    │    │        │
                    │   │  (port 5432) │    │ (port 6379)│    │        │
                    │   └─────────────┘    └────────────┘    │        │
                    └─────────────────────────────────────────────────┘
```

## Module Architecture

### Backend Modules

Each module is self-contained under `backend/app/modules/` and exposes a FastAPI router:

| Module | Prefix | Description |
|--------|--------|-------------|
| `auth` | `/api/v1/auth` | Authentication, JWT, 2FA |
| `users` | `/api/v1/users` | User profile management |
| `admin` | `/api/v1/admin` | Admin-only management functions |
| `reports` | `/api/v1/reports` | Report templates and dashboards |
| `plugins` | `/api/v1/plugins` | Plugin registry and REST API hooks |

### Adding a New Module

1. Create `backend/app/modules/<name>/` directory
2. Implement `router.py`, `service.py`, `models.py`, `schemas.py`
3. Register the router in `backend/app/main.py`
4. Add Alembic migration for any new DB models

## Data Flow

```
Client Request
     │
     ▼
Nginx (rate limiting, security headers)
     │
     ├─► /api/v1/* → Backend (FastAPI)
     │        │
     │        ├─► Auth middleware (JWT validation)
     │        ├─► Route handler
     │        ├─► Service layer (business logic)
     │        ├─► SQLAlchemy ORM
     │        └─► PostgreSQL
     │
     └─► /* → Frontend (React SPA served by nginx)
```

## Security Architecture

### Authentication Flow
1. Client POSTs credentials to `/api/v1/auth/login`
2. Server verifies password (bcrypt), issues short-lived JWT access token + httpOnly refresh token cookie
3. If user has 2FA enabled, step 2 returns `requires_2fa: true` and a temporary session token
4. Client POSTs TOTP code; server verifies and issues full tokens
5. Access tokens expire in 30 minutes; refresh tokens in 7 days
6. Refresh tokens are single-use and stored hashed in the database

### Authorization
- **RBAC** with four roles: `super_admin`, `admin`, `editor`, `viewer`
- **Permission Profiles**: Named sets of granular permissions assigned to users
- `super_admin` bypasses all permission checks and can manage admins
- `admin` can manage users, profiles, and plugins
- `editor` can create/modify reports and dashboards
- `viewer` read-only access to assigned reports

### Plugin API Security
- Each plugin integration has a unique API key (hashed in DB)
- API keys are scoped to specific permissions
- All plugin API calls are rate-limited and audit-logged

## Plugin Architecture

Plugins extend Nadin's capabilities without modifying core code.

### Plugin Types
- `data_source` — Provide data to reports (future: AI, external APIs)
- `integration` — Push/pull data to/from external systems (Jira, Slack, etc.)
- `processor` — Transform and analyze data (future: AI processing, OCR)
- `exporter` — Export reports in different formats

### Plugin Registry
Plugins register via the admin UI or REST API. Each plugin:
- Has a unique slug identifier
- Declares its type and required permissions
- Has a configuration schema (JSON)
- Can register webhook endpoints for events

### REST API for External Integrations
External systems can pull data via:
```
GET /api/v1/plugins/external/{slug}/data
Authorization: Bearer <plugin-api-key>
```

## Database Schema

See `backend/app/modules/*/models.py` for full ORM definitions.

### Core Tables
- `users` — User accounts with role and permission profile
- `permission_profiles` — Named permission sets
- `refresh_tokens` — Active refresh token store (hashed)
- `reports` — Report templates and configurations
- `dashboards` — Dashboard layout configurations
- `plugins` — Registered plugin configurations
- `audit_logs` — Immutable audit trail

## Planned Modules (Not Yet Implemented)
- `data_ingest` — CSV/spreadsheet upload and parsing
- `data_processor` — Calculations, aggregations, transformations
- `ai_module` — OCR, sentiment analysis, LLM integration

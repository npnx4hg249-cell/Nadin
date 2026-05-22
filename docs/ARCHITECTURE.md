# Nadin — Architecture Overview

## System Architecture

Nadin is a modular, self-contained data analysis and intelligence platform. All components run in Docker containers on an isolated internal network. No external internet access is required during operation.

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Network                          │
│   Browser ──────► Nginx :80/443 ──────► [Internal Network]     │
└─────────────────────────────────────────────────────────────────┘
                                               │
              ┌────────────────────────────────┼────────────────────────┐
              │                    Internal Network (isolated)           │
              │                                                          │
              │   ┌──────────────┐    ┌──────────────────────────────┐  │
              │   │   Frontend   │    │        Backend (FastAPI)      │  │
              │   │  React SPA   │    │        uvicorn :8000          │  │
              │   │  nginx :80   │    │                              │  │
              │   └──────────────┘    └──────────────┬───────────────┘  │
              │                                      │                   │
              │         ┌────────────────────────────┼────────────┐     │
              │         │                            │            │     │
              │   ┌─────▼──────┐   ┌────────────┐  ┌▼──────────┐ │     │
              │   │ PostgreSQL │   │   Redis    │  │  Ollama   │ │     │
              │   │  :5432     │   │  :6379     │  │  :11434   │ │     │
              │   └────────────┘   └────────────┘  └───────────┘ │     │
              │                                                    │     │
              │   Volumes: postgres_data, redis_data,              │     │
              │            datasets_data, ollama_data,             │     │
              │            nginx_logs                              │     │
              └────────────────────────────────────────────────────     │
              └──────────────────────────────────────────────────────────┘
```

---

## Backend Module Map

All modules live under `backend/app/modules/` and expose a FastAPI router registered in `backend/app/main.py`.

| Module | URL Prefix | Min. Role | Description |
|--------|-----------|-----------|-------------|
| `auth` | `/api/v1/auth` | public | JWT login, TOTP 2FA, token refresh/logout |
| `users` | `/api/v1/users` | viewer | User profile, password change, 2FA management |
| `admin` | `/api/v1/admin` | admin | User CRUD, permission profiles, audit log |
| `reports` | `/api/v1/reports` | viewer | Reports and report templates |
| `dashboards` | `/api/v1/dashboards` | viewer | Dashboard layout management |
| `plugins` | `/api/v1/plugins` | viewer (write: admin) | Plugin registry and REST API hooks |
| `data_ingest` | `/api/v1/datasets` | editor | Upload CSV/Excel/JSON/Parquet; stores as Parquet |
| `data_engine` | `/api/v1/engine` | editor | Raw DuckDB SQL queries over datasets |
| `analysis` | `/api/v1/analysis` | editor | Metric Builder, analysis configs, Insights CRUD |
| `llm` | `/api/v1/llm` | editor | Ollama health check, NL→SQL endpoint |
| `output` | `/api/v1/output` | editor | Export to CSV, PDF (ReportLab), Grafana JSON |

### Adding a New Module

1. Create `backend/app/modules/<name>/` with `router.py`, `service.py`, `models.py`, `schemas.py`
2. Import the SQLAlchemy model in `backend/app/main.py` (registers it with `Base.metadata`)
3. Import and `app.include_router()` the router in `backend/app/main.py`
4. Create an Alembic migration: `alembic revision --autogenerate -m "add <name> tables"`

---

## Data Flow

### API Request Flow

```
Browser request
      │
      ▼
Nginx  (rate limiting, security headers, TLS termination)
      │
      ├─► /api/v1/*  ──► FastAPI
      │         │
      │         ├── SlowAPI rate limiter middleware
      │         ├── CORSMiddleware
      │         ├── JWT auth dependency (get_current_user)
      │         ├── Role/permission dependency (require_editor etc.)
      │         ├── Route handler
      │         ├── Service layer (async business logic)
      │         ├── SQLAlchemy async ORM  ──► PostgreSQL
      │         └── DuckDB (asyncio.to_thread) ──► Parquet files
      │
      └─► /*  ──► React SPA (static files, nginx)
```

### Dataset Upload & Analysis Flow

```
User uploads file
      │
      ▼
POST /api/v1/datasets  (multipart/form-data)
      │
      ├── Polars reads file (CSV / Excel / JSON / Parquet)
      │
      ├── [optional] translate_to='en'|'de'
      │       │
      │       ├── POST /api/generate → Ollama  (column names)
      │       └── POST /api/generate → Ollama  (unique string values, batches of 40)
      │
      ├── DataFrame written as Parquet (zstd) → /data/datasets/{id}.parquet
      │
      └── Dataset metadata stored in PostgreSQL (schema_info, row_count etc.)

User runs analysis
      │
      ├── Metric Builder: service builds SQL from MetricDef list
      ├── Natural Language: POST /api/v1/llm/nl-to-sql → Ollama → SQL string
      └── Raw SQL: user-supplied SQL string
              │
              ▼
      DuckDB (in-memory, asyncio.to_thread)
        CREATE VIEW dataset AS SELECT * FROM read_parquet('{path}')
        Execute SQL
              │
              ▼
      AnalysisResult {columns, rows, row_count}
              │
      User saves as Insight (POST /api/v1/analysis/insights)
              │
      User attaches Insight to Report/Dashboard
      (POST /api/v1/analysis/insights/{id}/add-to)
```

---

## Security Architecture

### Authentication Flow

```
1. POST /auth/login  {username: email, password}
       │
       ├── bcrypt verify password
       ├── Issue JWT access token (30 min)
       ├── Issue refresh token (7 days, hashed in DB)
       │     └── Set as httpOnly SameSite=Lax cookie on /api/v1/auth
       └── Return {access_token, token_type, expires_in}

2. [If TOTP enabled] POST /auth/2fa/verify  {code, email}
       └── Verify TOTP → same token response as above

3. All subsequent requests: Authorization: Bearer <access_token>

4. POST /auth/refresh  (cookie sent automatically)
       ├── Validate refresh token (single-use, rotates)
       └── Return new access_token + set new refresh cookie

5. POST /auth/logout
       └── Revoke refresh token in DB + clear cookie
```

### Authorization Model

- **RBAC** — four built-in roles: `super_admin` > `admin` > `editor` > `viewer`
- **Permission Profiles** — named sets of granular permissions assignable to any user
- `require_editor` dependency: rejects viewers on all write operations
- `super_admin` bypasses all permission profile checks

### SQL Safety (data engine)

- All queries validated as `SELECT`-only (rejects DML/DDL)
- Column names double-quoted in generated SQL (prevents injection)
- Filter values use parameterised DuckDB bindings
- DuckDB runs in-memory (`:memory:`) — no persistent state between queries

### Network Isolation

- All services communicate on the `internal` Docker network (`internal: true`)
- Only Nginx has access to the `external` network
- Ollama is on the internal network only — not reachable from outside

---

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts: email, hashed password, role, 2FA secret |
| `permission_profiles` | Named permission sets with JSONB permissions array |
| `refresh_tokens` | Active refresh tokens (stored as bcrypt hashes, single-use) |
| `audit_logs` | Immutable action log (user, action, IP, metadata) |

### Report Tables

| Table | Description |
|-------|-------------|
| `report_templates` | Reusable report structure definitions |
| `reports` | Concrete saved reports with JSONB runtime config |
| `dashboards` | Dashboard layout with JSONB widget positions |

### Data & Analysis Tables

| Table | Description |
|-------|-------------|
| `datasets` | Uploaded file metadata: schema_info JSONB, parquet_path, status enum |
| `analysis_configs` | Saved Metric Builder configurations (JSONB metrics/filters) |
| `insights` | Saved analysis results: columns + rows as JSONB, sql_query, report_ids/dashboard_ids arrays |

### Plugin Tables

| Table | Description |
|-------|-------------|
| `plugins` | Registered plugins with hashed API key, config JSONB, status enum |
| `plugin_hook_logs` | Webhook delivery log |

---

## Frontend Architecture

- **React 18** + TypeScript + Vite
- **State**: Zustand stores — `authStore`, `themeStore`, `languageStore`
- **Data fetching**: TanStack Query v5 (all API calls, caching, invalidation)
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **i18n**: Custom typed translation system (`src/i18n/`) — EN/DE, no external library
- **Styling**: Tailwind CSS v3 (dark mode via `class` strategy)
- **Auth**: Access token stored in-memory (`tokenStore`), refresh via httpOnly cookie + Axios interceptor

### API Layer

All API calls go through `src/api/client.ts` (Axios instance):
- Request interceptor attaches `Authorization: Bearer <token>`
- Response interceptor handles 401 → transparent token refresh → retry

---

## LLM Integration

Ollama runs as a Docker service on the internal network. The backend communicates with it via HTTP:

```
Backend  ──► POST http://ollama:11434/api/generate
              {model, prompt, system, stream: false, options: {temperature}}
         ◄──  {response: "<text>", prompt_eval_count: N}
```

**NL→SQL**: System prompt instructs the model to output only a DuckDB-compatible SELECT statement. Markdown fences are stripped from the response. The generated SQL is shown to the user for review before execution.

**Data Translation**: Column names and unique string values are sent as JSON arrays. The model returns a same-length JSON array. Falls back to originals on any error (wrong length, invalid JSON, timeout).

**Model**: Default `qwen2.5-coder:7b-instruct` (~4.5 GB, 4-bit quantised). Change via `OLLAMA_MODEL` env var. Any Ollama-compatible model works.

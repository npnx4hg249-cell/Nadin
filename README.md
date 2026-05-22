# Nadin

**N**etwork **A**nalytics, **D**ata Processing and **I**ntelligence **N**ode — a modular, fully self-contained data analysis and intelligence platform. Runs entirely offline as a single Docker Compose stack.

## Features

| Feature | Description |
|---------|-------------|
| **Authentication** | JWT access tokens + httpOnly refresh cookies, TOTP two-factor authentication |
| **RBAC** | Four roles (`super_admin`, `admin`, `editor`, `viewer`) with custom permission profiles |
| **Admin Portal** | User management, password resets, force-2FA, permission profiles, immutable audit log |
| **Data Ingest** | Upload CSV, Excel, JSON, and Parquet files (up to 512 MB); stored as compressed Parquet |
| **Analytics Engine** | DuckDB-powered columnar query engine over Parquet data |
| **Analysis Workspace** | Three query modes: Metric Builder, Natural Language (NL→SQL via LLM), Raw SQL |
| **Insights** | Save analysis results as named Insights; attach them to Reports or Dashboards |
| **Output** | Export to CSV, PDF (ReportLab), and Grafana dashboard JSON |
| **Local LLM** | Ollama service with Qwen2.5-Coder for NL→SQL and AI-powered data translation |
| **Data Translation** | Auto-translate dataset column headers and values to English or German on upload |
| **Plugins** | Extend Nadin with external integrations via a REST API and webhook registry |
| **Reports & Dashboards** | Flexible report templates and grid/freeform dashboard layouts |
| **Bilingual UI** | English / German toggle, preference persisted per user, default English |
| **Dark Mode** | Full dark/light theme with per-user preference |
| **Offline-Capable** | Zero external network dependencies during operation — fully air-gapped |

---

## Quick Start

### Prerequisites

- Docker Engine 24+
- Docker Compose v2

### 1. Configure

```bash
cp .env.example .env
```

Edit `.env` and set all required values:

```bash
# Generate secrets
POSTGRES_PASSWORD=$(openssl rand -hex 20)
REDIS_PASSWORD=$(openssl rand -hex 20)
JWT_SECRET_KEY=$(openssl rand -hex 32)

# Set your admin credentials
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=YourStrongPassword123!
```

See `.env.example` for all available options including LLM configuration.

### 2. Start

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, the FastAPI backend, the React frontend, Nginx, and the Ollama LLM service.

### 3. Pull the LLM model (first run only)

```bash
docker exec nadin-ollama-1 ollama pull qwen2.5-coder:7b-instruct
```

The model (~4.5 GB) is stored in the `ollama_data` Docker volume and only needs to be pulled once.

### 4. Access

Open `http://localhost` and log in with your admin credentials.

> **Air-gapped deployments:** Pull the model image on a connected machine, export it with `ollama cp` or via the model file, and load it into the isolated container. See [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md#offline-llm-setup) for details.

---

## Architecture

```
Browser
  │
  ▼
Nginx :80  ──────────────────────────────────────────────────┐
  │                                                           │
  ├─ /api/v1/*  ──►  Backend (FastAPI :8000)                 │
  │                     ├── auth                             │
  │                     ├── users / admin                    │ Internal
  │                     ├── data_ingest  ──► Parquet files   │ Network
  │                     ├── data_engine  ──► DuckDB          │ (no internet)
  │                     ├── analysis / insights              │
  │                     ├── llm  ──────────► Ollama :11434   │
  │                     ├── output (PDF/CSV/Grafana)         │
  │                     ├── reports / dashboards             │
  │                     └── plugins                         │
  │                           │                              │
  │                    PostgreSQL :5432                      │
  │                    Redis :6379                           │
  │                                                          │
  └─ /*  ──────────►  Frontend (React SPA :80)              │
                                                             │
─────────────────────────────────────────────────────────────┘
```

### Storage layers

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Metadata & config | PostgreSQL | Users, reports, insights, plugins, audit |
| Session cache | Redis | Refresh token blacklist, rate limiting |
| Raw dataset storage | Apache Parquet (zstd) | Uploaded dataset files |
| Analytics queries | DuckDB (in-memory) | Columnar queries over Parquet files |
| LLM inference | Ollama | NL→SQL and data translation |

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, module map, data flow, security model |
| [docs/API.md](docs/API.md) | Full REST API reference for all endpoints |
| [docs/DATA_ANALYSIS.md](docs/DATA_ANALYSIS.md) | Analysis workspace, insights, NL→SQL workflow |
| [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | Deployment, user management, backup, operations |
| [docs/PLUGINS.md](docs/PLUGINS.md) | Plugin development and integration guide |

---

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | ✓ | PostgreSQL password |
| `REDIS_PASSWORD` | ✓ | Redis password |
| `JWT_SECRET_KEY` | ✓ | JWT signing secret |
| `ADMIN_EMAIL` | ✓ | Initial super-admin email |
| `ADMIN_PASSWORD` | ✓ | Initial super-admin password |
| `OLLAMA_URL` | | Ollama base URL (default: `http://ollama:11434`) |
| `OLLAMA_MODEL` | | Model name (default: `qwen2.5-coder:7b-instruct`) |
| `LLM_ENABLED` | | Enable LLM features (default: `true`) |
| `COOKIE_SECURE` | | Set `true` only when serving over HTTPS (default: `false`) |

---

## Security

Security analysis reports are generated every 5 pushes and stored in `.reports/`. Critical and high vulnerabilities are remediated before the next push cycle.

To run a manual scan:
```bash
bash .reports/security-scan.sh
```

---

## License

[GPL-3.0](LICENSE)

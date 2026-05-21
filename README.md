# Nadin

A modular, self-contained dashboard and report generation platform. Fully offline-capable, deployable as a single Docker Compose stack.

## Features

- **Authentication** — JWT-based auth with TOTP two-factor authentication
- **Role-Based Access Control** — Four roles (super_admin, admin, editor, viewer) with custom permission profiles
- **Admin Portal** — Full user management, password resets, force-2FA, permission profiles
- **Reports & Dashboards** — Flexible report templates and dashboard configurations
- **Plugin Architecture** — Extend Nadin with integrations (Jira, etc.) via REST API
- **Audit Logging** — Immutable log of all significant actions
- **Dark Mode** — Full dark/light theme support
- **Offline-Capable** — No external dependencies at runtime

## Quick Start

### Prerequisites
- Docker Engine 24+
- Docker Compose v2

### 1. Configure

```bash
cd nadin/
cp .env.example .env
```

Edit `.env` — at minimum set:
```bash
POSTGRES_PASSWORD=$(openssl rand -hex 20)
REDIS_PASSWORD=$(openssl rand -hex 20)
SECRET_KEY=$(openssl rand -hex 32)
REFRESH_SECRET_KEY=$(openssl rand -hex 32)
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=YourStrongPassword123!
```

### 2. Start

```bash
docker compose up -d
```

### 3. Access

Open `http://localhost` and log in with your admin credentials.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and module overview |
| [docs/API.md](docs/API.md) | Full REST API reference |
| [docs/PLUGINS.md](docs/PLUGINS.md) | Plugin development guide |
| [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | Administration and operations |

## Architecture

```
Nginx (80/443)
  ├── /api/v1/* → FastAPI Backend
  │               ├── auth module
  │               ├── users module
  │               ├── admin module
  │               ├── reports module
  │               └── plugins module
  └── /* → React Frontend (SPA)

PostgreSQL — Primary data store
Redis — Session cache and rate limiting
```

## Modules

### Implemented
- `auth` — JWT + TOTP 2FA authentication
- `users` — User profile management
- `admin` — Admin portal (users, permissions, audit)
- `reports` — Report templates and dashboards
- `plugins` — Plugin registry and REST API hooks

### Planned
- `data_ingest` — CSV/spreadsheet upload and parsing
- `data_processor` — Calculations and transformations
- `ai_module` — OCR, sentiment analysis, LLM integration

## Security

Security analysis reports are generated every 5 pushes and stored in a dedicated directory. Critical and high vulnerabilities are remediated before the next push cycle.

To run a manual security scan:
```bash
cd nadin && bash .reports/security-scan.sh
```

## License

See [../LICENSE](../LICENSE).

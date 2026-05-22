# Nadin Administrator Guide

## First-Time Setup

### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set all required values:

```bash
# Required — generate secrets
POSTGRES_PASSWORD=$(openssl rand -hex 20)
REDIS_PASSWORD=$(openssl rand -hex 20)
JWT_SECRET_KEY=$(openssl rand -hex 32)

# Required — admin credentials
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=YourStrongPassword123!
ADMIN_USERNAME=admin

# Optional — LLM configuration
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=qwen2.5-coder:7b-instruct
LLM_ENABLED=true

# Set true only when serving over HTTPS (default false).
# Safari and strict browsers will not send the refresh-token cookie
# over plain HTTP if this is true, causing session expiry every 30 min.
COOKIE_SECURE=false
```

### 2. Start the Stack

```bash
docker compose up -d
```

This starts (in dependency order):
1. PostgreSQL and Redis
2. Ollama LLM service
3. Backend API (runs DB migrations and seeds the admin user on startup)
4. Frontend
5. Nginx

### 3. Pull the LLM Model

The first time Ollama starts, it has no models. Pull the default model:

```bash
docker exec nadin-ollama-1 ollama pull qwen2.5-coder:7b-instruct
```

This downloads ~4.5 GB. The model is stored in the `ollama_data` volume and only needs to be pulled once.

**List loaded models:**
```bash
docker exec nadin-ollama-1 ollama list
```

### 4. First Login

Navigate to `http://localhost` and log in with your admin credentials.

**Immediately after first login:**
1. Set up 2FA: Profile → Security → Enable 2FA
2. Review the two built-in permission profiles (Super Administrator, Standard User) — add custom ones as needed
3. Create users via Admin → Users → New User

---

## Admin Portal

The Admin portal (visible only to admin and super_admin roles) has five tabs:

### Users tab
- View, search and page through all users
- **New User** — create an account with email, username, password, role and active flag
- Edit existing users (role, active status)
- Delete non-self accounts

### Profiles tab
Built-in profiles seeded on first startup:

| Profile | Permissions |
|---------|-------------|
| **Super Administrator** | Full access — reports, plugins, admin |
| **Standard User** | Reports only — no plugins or admin visibility |

Create additional profiles with any combination of granular permissions. Assign profiles to users on the user edit form.

### Audit tab
Immutable log of all authentication events, admin actions, and data operations.

### Database tab
Live PostgreSQL table statistics: row counts, dead tuples, disk usage per table. Useful for capacity planning and spotting bloated tables.

### System (LLM Settings) tab
Override the active Ollama URL and model at runtime without restarting the container. Changes are persisted in the `system_settings` table and applied immediately. Useful for switching models (e.g., from `qwen2.5-coder:7b-instruct` to a larger model) without a redeploy.

---

## Offline / Air-Gapped LLM Setup

For environments with no internet access, transfer the model separately.

**On a connected machine:**
```bash
# Pull the model
ollama pull qwen2.5-coder:7b-instruct

# Find the model data (Linux/Mac)
ls ~/.ollama/models/

# Create a tarball
tar czf ollama-models.tar.gz ~/.ollama/models/
```

**On the air-gapped server:**
```bash
# Start the Ollama container (it will have no models)
docker compose up -d ollama

# Load model files into the container's volume
docker cp ollama-models.tar.gz nadin-ollama-1:/tmp/
docker exec nadin-ollama-1 sh -c "tar xzf /tmp/ollama-models.tar.gz -C /root"

# Verify
docker exec nadin-ollama-1 ollama list
```

**Disable LLM features entirely** (if not needed):
```bash
# In .env
LLM_ENABLED=false
```

When disabled, the Natural Language query mode and data translation are hidden/rejected. Everything else works normally.

---

## User Management

### Creating Users

**Admin** → **Users** → **New User**

Required: email, username, role. Optional: permission profile.

### Roles

| Role | What they can do |
|------|-----------------|
| `super_admin` | Everything, including promoting to admin and managing admins |
| `admin` | Manage users, permission profiles, view audit logs, manage plugins |
| `editor` | Upload datasets, run analyses, save insights, create/edit reports |
| `viewer` | Read-only access to public/assigned reports and dashboards |

Only a `super_admin` can assign the `super_admin` or `admin` role to another user.

### Resetting Passwords

**Admin** → **Users** → select user → **Reset Password**

Generates a temporary password shown once. The user must change it at next login.

### Forcing 2FA

**Admin** → **Users** → select user → Edit → toggle **Force 2FA**

The user must complete 2FA setup at their next login before accessing any page.

---

## Permission Profiles

Fine-grained access control beyond the four base roles. Assign a profile to a user to add (or restrict) specific capabilities.

**Admin** → **Permission Profiles** → **New Profile**

### Available Permissions

| Permission | Description |
|-----------|-------------|
| `reports.view` | View reports and results |
| `reports.create` | Create new reports |
| `reports.edit` | Modify existing reports |
| `reports.delete` | Delete reports |
| `reports.run` | Execute report queries |
| `reports.export` | Download report exports |
| `plugins.view` | See plugin list |
| `plugins.install` | Register new plugins |
| `plugins.configure` | Modify plugin config |
| `admin.users` | Manage users |
| `admin.audit` | View audit logs |
| `admin.settings` | Change system settings |

Profiles are additive — a user's base role permissions are combined with their assigned profile.

---

## Dataset Management

Datasets are uploaded Parquet files stored in the `datasets_data` Docker volume (`/data/datasets/` in the backend container).

**View datasets:** Data Sources page shows all datasets with status, size, row count, and schema.

**Status lifecycle:** `pending` → `processing` → `ready` | `error`

If a dataset shows `error`, hover over it to see the error message (format issue, oversized file, etc.).

**Maximum upload size:** 512 MB (configured in `nginx/nginx.conf` as `client_max_body_size`).

---

## Audit Logs

**Admin** → **Audit Log**

Records all significant actions:

| Category | Events |
|----------|--------|
| Authentication | `user.login`, `user.logout`, `user.login_failed` |
| 2FA | `user.2fa_enabled`, `user.2fa_disabled` |
| User management | `user.created`, `user.updated`, `user.deleted`, `user.password_changed` |
| Reports | `report.created`, `report.updated`, `report.deleted`, `report.run` |
| Plugins | `plugin.enabled`, `plugin.disabled`, `plugin.configured` |
| System | `admin.settings_changed` |

Logs are immutable — cannot be deleted through the UI or API. Filter by date range, user, or action type.

---

## Backup and Recovery

### Database Backup

```bash
docker compose exec postgres pg_dump -U nadin nadin > backup_$(date +%Y%m%d_%H%M).sql
```

### Database Restore

```bash
docker compose exec -T postgres psql -U nadin nadin < backup_20250522_1000.sql
```

### Full Volume Backup (all data)

```bash
docker compose down
tar czf nadin-backup-$(date +%Y%m%d).tar.gz \
  $(docker volume inspect nadin_postgres_data --format '{{.Mountpoint}}') \
  $(docker volume inspect nadin_redis_data --format '{{.Mountpoint}}') \
  $(docker volume inspect nadin_datasets_data --format '{{.Mountpoint}}') \
  $(docker volume inspect nadin_ollama_data --format '{{.Mountpoint}}')
docker compose up -d
```

> The `ollama_data` volume contains LLM model weights (~4.5 GB). You may omit it from backups if you can re-pull the model, saving significant space.

### Dataset Files Only

```bash
# Backup all uploaded Parquet files
docker run --rm \
  -v nadin_datasets_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/datasets_$(date +%Y%m%d).tar.gz /data
```

---

## Security Operations

### Rotating JWT Secrets

1. Generate a new key: `openssl rand -hex 32`
2. Update `JWT_SECRET_KEY` in `.env`
3. Restart: `docker compose restart backend`

> All active sessions are invalidated. Users will need to log in again.

### Rotating the Database Password

```bash
# In the database
docker compose exec postgres psql -U nadin -c "ALTER USER nadin WITH PASSWORD 'newpassword';"
# In .env
POSTGRES_PASSWORD=newpassword
# Restart
docker compose restart backend
```

### Revoking All Sessions

```bash
docker compose exec postgres psql -U nadin nadin \
  -c "UPDATE refresh_tokens SET revoked = TRUE WHERE revoked = FALSE;"
```

### Viewing Active Sessions

```bash
docker compose exec postgres psql -U nadin nadin \
  -c "SELECT u.email, r.created_at, r.expires_at FROM refresh_tokens r JOIN users u ON r.user_id = u.id WHERE r.revoked = FALSE;"
```

---

## Updating Nadin

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

Database migrations run automatically on backend startup (`Base.metadata.create_all` in development; Alembic in production).

---

## Monitoring

### Container Health

```bash
docker compose ps
docker compose logs backend --tail=50 -f
docker compose logs ollama --tail=20
```

### API Health Endpoint

```bash
curl http://localhost/health
```

Returns `{"status":"ok","database":"ok","redis":"ok",...}`.

### Disk Usage

```bash
# Dataset volume usage
docker run --rm -v nadin_datasets_data:/data alpine du -sh /data

# Ollama model storage
docker run --rm -v nadin_ollama_data:/data alpine du -sh /data

# Database size
docker compose exec postgres psql -U nadin nadin -c "SELECT pg_size_pretty(pg_database_size('nadin'));"
```

---

## Language Settings

The UI language (English/German) is a per-user preference stored in the browser's `localStorage`. The default is English. Users can switch using the **EN/DE** toggle in the top-right bar of the application. No server-side configuration is required.

---

## Security Reports

Automated security analysis reports are stored in `.reports/`. Review them regularly. To run a manual scan:

```bash
bash .reports/security-scan.sh
```

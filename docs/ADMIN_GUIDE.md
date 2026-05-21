# Nadin Administrator Guide

## First-Time Setup

### 1. Configure Environment

```bash
cd nadin/
cp .env.example .env
```

Edit `.env` and set:
- `POSTGRES_PASSWORD` — strong database password
- `REDIS_PASSWORD` — strong Redis password
- `SECRET_KEY` — generate with `openssl rand -hex 32`
- `REFRESH_SECRET_KEY` — generate with `openssl rand -hex 32` (different value)
- `ADMIN_EMAIL` — your admin email address
- `ADMIN_PASSWORD` — strong initial admin password

### 2. Start the Application

```bash
docker compose up -d
```

This will:
1. Start PostgreSQL and Redis
2. Run database migrations automatically
3. Seed the initial admin account
4. Start the backend API and frontend

### 3. First Login

Navigate to `http://localhost` and log in with your admin credentials.

**Immediately after first login:**
1. Set up 2FA for your admin account (Profile → Security → Enable 2FA)
2. Change your password if you used a simple one during setup

---

## User Management

### Creating Users

Admin Panel → Users → New User

Required fields:
- Email address (must be unique)
- Username (must be unique)
- Role assignment
- Permission profile (optional)

Users receive a temporary password and must change it on first login.

### Roles

| Role | Access Level |
|------|-------------|
| `super_admin` | Full access, can manage admins |
| `admin` | Can manage users, profiles, plugins |
| `editor` | Can create and modify reports/dashboards |
| `viewer` | Read-only access to assigned content |

Only a `super_admin` can promote another user to `super_admin` or `admin`.

### Resetting Passwords

Admin Panel → Users → Select User → Reset Password

This generates a temporary password displayed once. The user must change it on next login.

### Forcing 2FA

Admin Panel → Users → Select User → Force 2FA

The user will be required to set up 2FA at their next login.

---

## Permission Profiles

Permission profiles allow fine-grained access control beyond the four base roles.

### Creating a Profile

Admin Panel → Permission Profiles → New Profile

Configure individual permissions:
- `reports.view` — Can view reports
- `reports.create` — Can create new reports
- `reports.edit` — Can edit existing reports
- `reports.delete` — Can delete reports
- `dashboards.view` — Can view dashboards
- `dashboards.create` — Can create dashboards
- `dashboards.edit` — Can edit dashboards
- `plugins.view` — Can see plugin list
- `plugins.configure` — Can modify plugin configurations
- `admin.users` — Can manage users (admin only)
- `admin.audit` — Can view audit logs (admin only)

Profiles are additive — a user's base role permissions are combined with their profile permissions.

---

## Audit Logs

Admin Panel → Audit Log

The audit log records all significant actions:
- Login attempts (success and failure)
- User creation/modification/deletion
- Permission changes
- Report creation/modification/deletion
- Plugin changes
- Admin actions

Logs are immutable and cannot be deleted through the UI.

**Filtering options:** Date range, user, action type, resource

---

## Plugin Management

Admin Panel → Plugins → Register Plugin

See [PLUGINS.md](./PLUGINS.md) for full plugin documentation.

---

## Backup and Recovery

### Database Backup

```bash
docker compose exec postgres pg_dump -U nadin nadin > backup_$(date +%Y%m%d).sql
```

### Database Restore

```bash
docker compose exec -T postgres psql -U nadin nadin < backup_20250101.sql
```

### Full Data Backup

```bash
docker compose down
tar czf nadin-backup-$(date +%Y%m%d).tar.gz \
  $(docker volume inspect nadin_postgres_data --format '{{.Mountpoint}}') \
  $(docker volume inspect nadin_redis_data --format '{{.Mountpoint}}')
docker compose up -d
```

---

## Security Operations

### Rotating JWT Secrets

1. Update `SECRET_KEY` and `REFRESH_SECRET_KEY` in `.env`
2. Restart the backend: `docker compose restart backend`
3. **Note:** All active sessions will be invalidated; users must log in again

### Rotating the Database Password

1. Update in PostgreSQL: `ALTER USER nadin WITH PASSWORD 'newpassword';`
2. Update `POSTGRES_PASSWORD` in `.env`
3. Restart: `docker compose restart backend`

### Revoking All Sessions

Currently not supported via UI. As `super_admin`, run:
```bash
docker compose exec postgres psql -U nadin nadin -c "UPDATE refresh_tokens SET revoked = TRUE;"
```

---

## Security Reports

Automated security analysis reports are stored in the `.reports/` directory. These contain vulnerability assessments, findings, and remediation status. Review them regularly.

---

## Updating Nadin

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

Migrations run automatically on startup.

#!/bin/sh
# ---------------------------------------------------------------------------
# Nadin backend entrypoint
# Waits for PostgreSQL, runs Alembic migrations, then starts uvicorn.
# ---------------------------------------------------------------------------
set -e

RETRIES=${POSTGRES_CONNECT_RETRIES:-30}
SLEEP_INTERVAL=2

# ---------------------------------------------------------------------------
# 1. Wait for PostgreSQL
# ---------------------------------------------------------------------------
echo "[nadin] Waiting for PostgreSQL at ${DATABASE_URL:-<DATABASE_URL not set>}..."

i=0
until python -c "
import asyncio, asyncpg, os, sys

async def check():
    raw = os.environ.get('DATABASE_URL', '')
    # Strip SQLAlchemy driver prefix if present
    url = raw.replace('postgresql+asyncpg://', 'postgresql://')
    try:
        conn = await asyncpg.connect(url, timeout=5)
        await conn.close()
    except Exception as e:
        print(f'[nadin] DB probe error: {e}', file=sys.stderr)
        sys.exit(1)

asyncio.run(check())
" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge "$RETRIES" ]; then
    echo "[nadin] ERROR: PostgreSQL did not become available after ${RETRIES} attempts. Exiting."
    exit 1
  fi
  echo "[nadin] PostgreSQL not ready (attempt ${i}/${RETRIES}), retrying in ${SLEEP_INTERVAL}s..."
  sleep "$SLEEP_INTERVAL"
done

echo "[nadin] PostgreSQL is ready."

# ---------------------------------------------------------------------------
# 2. Run Alembic migrations
# ---------------------------------------------------------------------------
echo "[nadin] Running database migrations..."
alembic upgrade head
echo "[nadin] Migrations complete."

# ---------------------------------------------------------------------------
# 3. Start the API server
# ---------------------------------------------------------------------------
WORKERS=${UVICORN_WORKERS:-1}
PORT=${PORT:-8000}
HOST=${HOST:-0.0.0.0}
LOG_LEVEL=${LOG_LEVEL:-info}

echo "[nadin] Starting Nadin API on ${HOST}:${PORT} (workers=${WORKERS}, log_level=${LOG_LEVEL})..."

exec uvicorn app.main:app \
    --host "$HOST" \
    --port "$PORT" \
    --workers "$WORKERS" \
    --loop uvloop \
    --log-level "$LOG_LEVEL"

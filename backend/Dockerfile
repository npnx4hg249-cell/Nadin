# ============================================================
# Stage 1: Build — install Python deps in isolation
# ============================================================
FROM python:3.12-slim AS builder

WORKDIR /build

# Build-time deps (gcc, libpq headers for asyncpg / psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Install all packages into a staging prefix so we can COPY them cleanly
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt


# ============================================================
# Stage 2: Runtime image — minimal, non-root
# ============================================================
FROM python:3.12-slim

LABEL maintainer="Nadin Project" \
      description="Nadin — modular dashboard & report generation backend" \
      version="1.0.0"

# Runtime-only OS deps + gosu for privilege drop in entrypoint
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Non-root user (entrypoint starts as root, drops to nadin after volume fixup)
RUN groupadd -r nadin && useradd -r -g nadin --home /app --shell /sbin/nologin nadin

# Pre-create datasets dir so Docker volume init copies correct ownership
RUN mkdir -p /data/datasets && chown -R nadin:nadin /data/datasets

WORKDIR /app

# Copy installed packages from builder stage
COPY --from=builder /install /usr/local

# Copy application source
COPY --chown=nadin:nadin . .

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Container starts as root so entrypoint can fix volume permissions;
# entrypoint then drops to nadin via gosu before starting uvicorn.
EXPOSE 8000

EXPOSE 8000

# Health check — wait up to 40 s for startup, then check every 30 s
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]

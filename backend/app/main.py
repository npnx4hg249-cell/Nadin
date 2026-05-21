from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.database import AsyncSessionLocal, dispose_engine, engine, Base

# Import all models so they are registered with SQLAlchemy metadata
from app.modules.users.models import User, PermissionProfile, RefreshToken, AuditLog  # noqa: F401
from app.modules.reports.models import ReportTemplate, Report, Dashboard  # noqa: F401
from app.modules.plugins.models import Plugin, PluginHookLog  # noqa: F401

from app.modules.auth.router import router as auth_router
from app.modules.users.router import router as users_router
from app.modules.admin.router import router as admin_router
from app.modules.reports.router import (
    templates_router,
    reports_router,
    dashboards_router,
)
from app.modules.plugins.router import router as plugins_router

logger = logging.getLogger("nadin")
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.RATE_LIMIT_DEFAULT],
)


# ---------------------------------------------------------------------------
# Startup / shutdown lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Nadin API (env=%s)", settings.APP_ENV)

    # Create tables (idempotent — Alembic is authoritative in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Redis connection pool
    try:
        import redis.asyncio as aioredis
        app.state.redis = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
        await app.state.redis.ping()
        logger.info("Redis connected at %s", settings.REDIS_URL)
    except Exception as exc:
        logger.warning("Redis unavailable (%s) — session caching disabled", exc)
        app.state.redis = None

    # Seed initial admin user
    await _seed_admin()

    yield

    # Cleanup
    if getattr(app.state, "redis", None):
        await app.state.redis.close()
    await dispose_engine()
    logger.info("Nadin API shutdown complete")


async def _seed_admin() -> None:
    """Create the initial super_admin user if it does not already exist."""
    from app.modules.users.models import UserRole
    from app.core.security import hash_password
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(User).where(User.email == settings.ADMIN_EMAIL)
            )
            existing = result.scalar_one_or_none()
            if existing:
                logger.info("Admin user already exists — skipping seed")
                return

            admin = User(
                email=settings.ADMIN_EMAIL,
                username=settings.ADMIN_USERNAME,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                role=UserRole.super_admin,
                is_active=True,
                is_verified=True,
            )
            db.add(admin)
            await db.commit()
            logger.info("Seeded super_admin user: %s", settings.ADMIN_EMAIL)
        except Exception as exc:
            await db.rollback()
            logger.error("Failed to seed admin user: %s", exc)


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Nadin",
    description=(
        "Nadin — modular dashboard and report generation platform. "
        "Fully offline-capable, plugin-extensible backend API."
    ),
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

cors_origins = settings.cors_origins_list if settings.cors_origins_list else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Api-Key"],
)

# ---------------------------------------------------------------------------
# Routers  — all under /api/v1
# ---------------------------------------------------------------------------

API_PREFIX = settings.API_V1_PREFIX  # "/api/v1"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)
app.include_router(admin_router, prefix=API_PREFIX)
# Reports module exposes three independent sub-routers
app.include_router(templates_router, prefix=API_PREFIX, tags=["Report Templates"])
app.include_router(reports_router, prefix=API_PREFIX, tags=["Reports"])
app.include_router(dashboards_router, prefix=API_PREFIX, tags=["Dashboards"])
app.include_router(plugins_router, prefix=API_PREFIX)

# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

@app.get(f"{API_PREFIX}/health", tags=["Health"], summary="Application health check")
async def health_check(request: Request) -> Dict[str, Any]:
    from sqlalchemy import text

    # DB check
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    # Redis check
    redis_status = "unavailable"
    if getattr(request.app.state, "redis", None):
        try:
            await request.app.state.redis.ping()
            redis_status = "ok"
        except Exception:
            redis_status = "error"

    overall = "ok" if db_status == "ok" else "degraded"
    return {
        "status": overall,
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "env": settings.APP_ENV,
        "database": db_status,
        "redis": redis_status,
    }

# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred"},
    )

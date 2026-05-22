from __future__ import annotations

import json
from typing import Any, List, Optional, Union

from pydantic import AnyHttpUrl, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "Nadin"
    APP_ENV: str = "development"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "change-me-to-a-very-long-random-secret-key"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://nadin:nadin_pass@localhost:5432/nadin_db"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_SESSION_TTL: int = 86400  # 24 hours in seconds

    # JWT
    JWT_SECRET_KEY: str = "change-me-to-another-very-long-random-secret-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS — stored as JSON string or Python list
    CORS_ORIGINS: Union[List[AnyHttpUrl], str] = ["http://localhost:3000", "http://localhost:5173"]
    CORS_ALLOW_CREDENTIALS: bool = True

    # Admin seed
    ADMIN_EMAIL: str = "admin@nadin.app"
    ADMIN_PASSWORD: str = "ChangeMe!1234"
    ADMIN_USERNAME: str = "superadmin"

    # Rate limiting
    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_DEFAULT: str = "100/minute"

    # TOTP
    TOTP_ISSUER: str = "Nadin"

    # Datasets storage
    DATASETS_DIR: str = "/data/datasets"

    # Set to true only when serving over HTTPS; Secure cookies won't be sent
    # by browsers (especially Safari) over plain HTTP.
    COOKIE_SECURE: bool = False

    # LLM (Ollama) — NL-to-SQL
    OLLAMA_URL: str = "http://ollama:11434"
    OLLAMA_MODEL: str = "qwen2.5-coder:7b-instruct"
    LLM_ENABLED: bool = True

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                # comma-separated fallback
                return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, list):
            return [str(o) for o in self.CORS_ORIGINS]
        return []


settings = Settings()

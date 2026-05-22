from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger("nadin.llm")

_SYSTEM_PROMPT = """You are an expert SQL analyst. Convert the user's natural language question into a single, valid DuckDB SQL SELECT statement.
Rules:
- Output ONLY the SQL statement — no markdown, no explanation, no code fences.
- The table is always named "dataset".
- Use only DuckDB-compatible syntax.
- Never include INSERT, UPDATE, DELETE, DROP, CREATE, or any non-SELECT statement.
- If the question cannot be answered with the available schema, return: SELECT 'Unable to generate SQL for this question' AS error"""


def _build_schema_hint(schema_context: Optional[str]) -> str:
    if schema_context:
        return f"\n\nAvailable schema:\n{schema_context}"
    return ""


async def nl_to_sql(question: str, schema_context: Optional[str] = None) -> tuple[str, str, Optional[int]]:
    """Returns (sql, model_name, prompt_tokens)."""
    if not settings.LLM_ENABLED:
        raise RuntimeError("LLM feature is disabled (LLM_ENABLED=false)")

    prompt = f"{question}{_build_schema_hint(schema_context)}"
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "system": _SYSTEM_PROMPT,
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": 512},
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{settings.OLLAMA_URL}/api/generate", json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException:
        raise RuntimeError("Ollama request timed out after 60 s")
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(f"Ollama HTTP error: {exc.response.status_code}")
    except Exception as exc:
        raise RuntimeError(f"Ollama unreachable: {exc}")

    sql = data.get("response", "").strip()
    if not sql:
        raise RuntimeError("Ollama returned an empty response")

    # Strip markdown fences if the model added them anyway
    if sql.startswith("```"):
        lines = sql.splitlines()
        sql = "\n".join(
            line for line in lines if not line.startswith("```")
        ).strip()

    prompt_tokens: Optional[int] = data.get("prompt_eval_count")
    return sql, settings.OLLAMA_MODEL, prompt_tokens


async def health_check() -> dict:
    if not settings.LLM_ENABLED:
        return {"enabled": False, "reachable": False, "model": settings.OLLAMA_MODEL, "error": None}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.OLLAMA_URL}/api/tags")
            r.raise_for_status()
        return {"enabled": True, "reachable": True, "model": settings.OLLAMA_MODEL, "error": None}
    except Exception as exc:
        return {"enabled": True, "reachable": False, "model": settings.OLLAMA_MODEL, "error": str(exc)}

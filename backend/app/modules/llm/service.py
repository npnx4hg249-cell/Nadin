from __future__ import annotations

import json
import logging
from typing import List, Optional

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


_TRANSLATE_SYSTEM = (
    "You are a precise translation assistant. "
    "Translate each item in the provided JSON array to the target language. "
    "Return ONLY a valid JSON array with exactly the same number of elements in the same order. "
    "Keep numbers, dates, codes, and proper nouns unchanged. "
    "Do not add any explanation, markdown, or extra text."
)

_LANG_NAMES = {"en": "English", "de": "German"}

TRANSLATE_BATCH_SIZE = 40


async def _ollama_generate(prompt: str, system: str, max_tokens: int = 2048) -> str:
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {"temperature": 0.0, "num_predict": max_tokens},
    }
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(f"{settings.OLLAMA_URL}/api/generate", json=payload)
            response.raise_for_status()
            return response.json().get("response", "").strip()
    except httpx.TimeoutException:
        raise RuntimeError("Ollama request timed out after 300 s")
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(f"Ollama HTTP error: {exc.response.status_code}")
    except Exception as exc:
        raise RuntimeError(f"Ollama unreachable: {exc}")


def _strip_fences(text: str) -> str:
    if "```" in text:
        lines = text.splitlines()
        text = "\n".join(line for line in lines if not line.startswith("```")).strip()
    return text


async def translate_batch(values: List[str], target_lang: str) -> List[str]:
    """Translate a list of string values to target_lang ('en' or 'de').

    Returns translated list of same length. Falls back to originals on any error.
    """
    if not values:
        return values
    lang_name = _LANG_NAMES.get(target_lang, target_lang)
    prompt = (
        f"Translate the following JSON array to {lang_name}.\n"
        f"Input: {json.dumps(values, ensure_ascii=False)}\n"
        f"Output:"
    )
    try:
        raw = await _ollama_generate(prompt, _TRANSLATE_SYSTEM, max_tokens=len(values) * 30 + 256)
        raw = _strip_fences(raw)
        # Find the first '[' to handle any leading text
        bracket = raw.find("[")
        if bracket != -1:
            raw = raw[bracket:]
        translated = json.loads(raw)
        if isinstance(translated, list) and len(translated) == len(values):
            return [str(v) for v in translated]
        logger.warning("translate_batch: length mismatch — returning originals")
        return values
    except Exception as exc:
        logger.warning("translate_batch failed (%s) — returning originals", exc)
        return values


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

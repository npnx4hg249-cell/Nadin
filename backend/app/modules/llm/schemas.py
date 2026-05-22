from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class NlToSqlRequest(BaseModel):
    question: str
    dataset_id: int
    schema_context: Optional[str] = None


class NlToSqlResponse(BaseModel):
    sql: str
    model: str
    prompt_tokens: Optional[int] = None


class LlmHealthResponse(BaseModel):
    enabled: bool
    reachable: bool
    model: str
    error: Optional[str] = None

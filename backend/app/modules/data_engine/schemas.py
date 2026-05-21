from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    dataset_id: int
    sql: str = Field(..., description="SQL query — use 'dataset' as the table name")
    limit: int = Field(1000, ge=1, le=10000)


class AggregateRequest(BaseModel):
    dataset_id: int
    group_by: Optional[List[str]] = None
    metrics: List[Dict[str, str]]
    filters: Optional[List[Dict[str, Any]]] = None
    limit: int = Field(1000, ge=1, le=10000)


class QueryResult(BaseModel):
    columns: List[str]
    rows: List[List[Any]]
    row_count: int
    truncated: bool

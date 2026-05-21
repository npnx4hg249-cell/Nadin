from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.modules.data_engine.schemas import AggregateRequest, QueryResult

ALLOWED_FUNCTIONS = {
    "sum", "avg", "min", "max", "count", "count_distinct",
    "stddev", "variance", "median",
}

ALLOWED_OPS = {
    "=", "!=", ">", ">=", "<", "<=", "LIKE", "IN", "IS NULL", "IS NOT NULL",
}

_FORBIDDEN_KEYWORDS = {
    "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
    "TRUNCATE", "EXEC", "EXECUTE", "PRAGMA",
}


def _get_parquet_path(dataset_id: int) -> str:
    path = Path(settings.DATASETS_DIR) / f"{dataset_id}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Parquet file not found for dataset {dataset_id}")
    return str(path)


def _safe_serialize(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, (int, float, bool, str)):
        return v
    return str(v)


def _run_query(parquet_path: str, sql: str) -> QueryResult:
    import duckdb

    con = duckdb.connect(":memory:")
    try:
        con.execute(f"CREATE VIEW dataset AS SELECT * FROM read_parquet('{parquet_path}')")
        rel = con.execute(sql)
        columns = [desc[0] for desc in rel.description]
        raw_rows = rel.fetchall()
        rows = [[_safe_serialize(v) for v in row] for row in raw_rows]
        return QueryResult(
            columns=columns,
            rows=rows,
            row_count=len(rows),
            truncated=False,
        )
    finally:
        con.close()


def _validate_sql(sql: str) -> None:
    normalized = sql.strip().upper()
    if not normalized.startswith("SELECT"):
        raise ValueError("Only SELECT statements are allowed")
    for keyword in _FORBIDDEN_KEYWORDS:
        if keyword in normalized:
            raise ValueError(f"Forbidden keyword in SQL: {keyword}")


async def query_dataset(dataset_id: int, sql: str) -> QueryResult:
    _validate_sql(sql)
    parquet_path = _get_parquet_path(dataset_id)
    return await asyncio.to_thread(_run_query, parquet_path, sql)


async def preview_dataset(dataset_id: int, limit: int = 100) -> QueryResult:
    parquet_path = _get_parquet_path(dataset_id)
    sql = f"SELECT * FROM dataset LIMIT {limit}"
    return await asyncio.to_thread(_run_query, parquet_path, sql)


def _quote_col(col: str) -> str:
    return f'"{col}"'


def _escape_str(val: str) -> str:
    return val.replace("'", "''")


def _build_aggregate_sql(
    group_by: Optional[List[str]],
    metrics: List[Dict[str, str]],
    filters: Optional[List[Dict[str, Any]]],
    limit: int,
) -> str:
    select_parts: List[str] = []

    if group_by:
        for col in group_by:
            select_parts.append(_quote_col(col))

    for metric in metrics:
        col = metric["column"]
        fn = metric["function"].lower()
        alias = metric.get("alias") or f"{fn}_{col}"
        if fn not in ALLOWED_FUNCTIONS:
            raise ValueError(f"Function not allowed: {fn}")
        if fn == "count_distinct":
            expr = f'COUNT(DISTINCT {_quote_col(col)})'
        else:
            expr = f'{fn.upper()}({_quote_col(col)})'
        select_parts.append(f"{expr} AS {_quote_col(alias)}")

    sql = f"SELECT {', '.join(select_parts)} FROM dataset"

    if filters:
        where_parts: List[str] = []
        for f in filters:
            col = _quote_col(f["column"])
            op = f["op"].upper()
            if op not in ALLOWED_OPS:
                raise ValueError(f"Operator not allowed: {op}")
            if op == "IS NULL":
                where_parts.append(f"{col} IS NULL")
            elif op == "IS NOT NULL":
                where_parts.append(f"{col} IS NOT NULL")
            elif op == "IN":
                vals = f["value"]
                if not isinstance(vals, list):
                    vals = [vals]
                in_list = ", ".join(
                    f"'{_escape_str(str(v))}'" if not isinstance(v, (int, float)) else str(v)
                    for v in vals
                )
                where_parts.append(f"{col} IN ({in_list})")
            else:
                val = f["value"]
                if isinstance(val, str):
                    where_parts.append(f"{col} {op} '{_escape_str(val)}'")
                else:
                    where_parts.append(f"{col} {op} {val}")
        sql += " WHERE " + " AND ".join(where_parts)

    if group_by:
        sql += " GROUP BY " + ", ".join(_quote_col(c) for c in group_by)

    sql += f" LIMIT {limit}"
    return sql


async def aggregate_dataset(request: AggregateRequest) -> QueryResult:
    parquet_path = _get_parquet_path(request.dataset_id)
    sql = _build_aggregate_sql(
        group_by=request.group_by,
        metrics=request.metrics,
        filters=request.filters,
        limit=request.limit,
    )
    return await asyncio.to_thread(_run_query, parquet_path, sql)

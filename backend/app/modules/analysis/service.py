from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.analysis.models import AnalysisConfig
from app.modules.analysis.schemas import (
    AnalysisConfigCreate,
    AnalysisConfigUpdate,
    AnalysisResult,
    AnalysisRunRequest,
)

ALLOWED_FUNCTIONS = {
    "sum", "avg", "min", "max", "count", "count_distinct",
    "stddev", "variance", "median",
}

ALLOWED_OPS = {
    "=", "!=", ">", ">=", "<", "<=", "LIKE", "IN", "IS NULL", "IS NOT NULL",
}


def _safe_serialize(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, (int, float, bool, str)):
        return v
    return str(v)


def _quote_col(col: str) -> str:
    return f'"{col}"'


def _escape_str(val: str) -> str:
    return val.replace("'", "''")


def _build_analysis_sql(
    metrics: List[Any],
    group_by: Optional[List[str]],
    filters: Optional[List[Any]],
    limit: int = 1000,
) -> str:
    select_parts: List[str] = []

    if group_by:
        for col in group_by:
            select_parts.append(_quote_col(col))

    for metric in metrics:
        col = metric.column
        fn = metric.function.lower()
        alias = metric.alias or f"{fn}_{col}"
        if fn not in ALLOWED_FUNCTIONS:
            raise ValueError(f"Function not allowed: {fn}")
        if fn == "count_distinct":
            expr = f"COUNT(DISTINCT {_quote_col(col)})"
        else:
            expr = f"{fn.upper()}({_quote_col(col)})"
        select_parts.append(f"{expr} AS {_quote_col(alias)}")

    sql = f"SELECT {', '.join(select_parts)} FROM dataset"

    if filters:
        where_parts: List[str] = []
        for f in filters:
            col = _quote_col(f.column)
            op = f.op.upper()
            if op not in ALLOWED_OPS:
                raise ValueError(f"Operator not allowed: {op}")
            if op == "IS NULL":
                where_parts.append(f"{col} IS NULL")
            elif op == "IS NOT NULL":
                where_parts.append(f"{col} IS NOT NULL")
            elif op == "IN":
                vals = f.value
                if not isinstance(vals, list):
                    vals = [vals]
                in_list = ", ".join(
                    f"'{_escape_str(str(v))}'" if not isinstance(v, (int, float)) else str(v)
                    for v in vals
                )
                where_parts.append(f"{col} IN ({in_list})")
            else:
                val = f.value
                if isinstance(val, str):
                    where_parts.append(f"{col} {op} '{_escape_str(val)}'")
                else:
                    where_parts.append(f"{col} {op} {val}")
        sql += " WHERE " + " AND ".join(where_parts)

    if group_by:
        sql += " GROUP BY " + ", ".join(_quote_col(c) for c in group_by)

    sql += f" LIMIT {limit}"
    return sql


def _run_analysis_sync(
    parquet_path: str,
    sql: str,
    include_stats: bool,
) -> AnalysisResult:
    import duckdb

    con = duckdb.connect(":memory:")
    try:
        con.execute(f"CREATE VIEW dataset AS SELECT * FROM read_parquet('{parquet_path}')")
        rel = con.execute(sql)
        columns = [desc[0] for desc in rel.description]
        raw_rows = rel.fetchall()
        rows = [[_safe_serialize(v) for v in row] for row in raw_rows]

        stats: Optional[List[Dict[str, Any]]] = None
        if include_stats:
            summary_rel = con.execute("SUMMARIZE dataset")
            stat_cols = [desc[0] for desc in summary_rel.description]
            stat_rows = summary_rel.fetchall()
            stats = [
                {stat_cols[i]: _safe_serialize(v) for i, v in enumerate(row)}
                for row in stat_rows
            ]

        return AnalysisResult(
            columns=columns,
            rows=rows,
            row_count=len(rows),
            stats=stats,
        )
    finally:
        con.close()


async def run_analysis(request: AnalysisRunRequest) -> AnalysisResult:
    parquet_path = str(Path(settings.DATASETS_DIR) / f"{request.dataset_id}.parquet")
    if not Path(parquet_path).exists():
        raise FileNotFoundError(f"Parquet file not found for dataset {request.dataset_id}")

    sql = _build_analysis_sql(
        metrics=request.metrics,
        group_by=request.group_by,
        filters=request.filters,
    )
    return await asyncio.to_thread(_run_analysis_sync, parquet_path, sql, request.include_stats)


async def list_configs(
    db: AsyncSession,
    owner_id: int,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[int, List[AnalysisConfig]]:
    condition = AnalysisConfig.owner_id == owner_id
    count_query = select(func.count()).select_from(AnalysisConfig).where(condition)
    total = (await db.execute(count_query)).scalar_one()

    query = (
        select(AnalysisConfig)
        .where(condition)
        .offset(skip)
        .limit(limit)
        .order_by(AnalysisConfig.created_at.desc())
    )
    result = await db.execute(query)
    return total, list(result.scalars().all())


async def create_config(
    db: AsyncSession,
    body: AnalysisConfigCreate,
    owner_id: int,
) -> AnalysisConfig:
    config = AnalysisConfig(
        name=body.name,
        description=body.description,
        dataset_id=body.dataset_id,
        owner_id=owner_id,
        config=body.config,
    )
    db.add(config)
    await db.flush()
    await db.refresh(config)
    return config


async def get_config_by_id(db: AsyncSession, config_id: int) -> Optional[AnalysisConfig]:
    result = await db.execute(select(AnalysisConfig).where(AnalysisConfig.id == config_id))
    return result.scalar_one_or_none()


async def update_config(
    db: AsyncSession,
    config: AnalysisConfig,
    body: AnalysisConfigUpdate,
) -> AnalysisConfig:
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    await db.flush()
    await db.refresh(config)
    return config


async def delete_config(db: AsyncSession, config: AnalysisConfig) -> None:
    await db.delete(config)
    await db.flush()


async def create_insight(db: AsyncSession, body, owner_id: int):
    from app.modules.analysis.models import Insight
    insight = Insight(
        name=body.name,
        description=body.description,
        dataset_id=body.dataset_id,
        owner_id=owner_id,
        query_mode=body.query_mode,
        sql_query=body.sql_query,
        columns=body.columns,
        rows=body.rows,
        row_count=body.row_count,
        chart_type=body.chart_type,
        report_ids=[],
        dashboard_ids=[],
    )
    db.add(insight)
    await db.commit()
    await db.refresh(insight)
    return insight


async def list_insights(db: AsyncSession, owner_id: int, skip: int = 0, limit: int = 50):
    from app.modules.analysis.models import Insight
    from sqlalchemy import select, func
    count_q = select(func.count()).select_from(Insight).where(Insight.owner_id == owner_id)
    total = (await db.execute(count_q)).scalar_one()
    items_q = (
        select(Insight)
        .where(Insight.owner_id == owner_id)
        .order_by(Insight.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    items = (await db.execute(items_q)).scalars().all()
    return total, list(items)


async def get_insight_by_id(db: AsyncSession, insight_id: int):
    from app.modules.analysis.models import Insight
    from sqlalchemy import select
    result = await db.execute(select(Insight).where(Insight.id == insight_id))
    return result.scalar_one_or_none()


async def update_insight(db: AsyncSession, insight, body):
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(insight, field, val)
    await db.commit()
    await db.refresh(insight)
    return insight


async def delete_insight(db: AsyncSession, insight) -> None:
    await db.delete(insight)
    await db.commit()


async def add_insight_to_targets(db: AsyncSession, insight, body) -> object:
    if body.report_ids:
        existing = set(insight.report_ids or [])
        insight.report_ids = list(existing | set(body.report_ids))
    if body.dashboard_ids:
        existing = set(insight.dashboard_ids or [])
        insight.dashboard_ids = list(existing | set(body.dashboard_ids))
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(insight, "report_ids")
    flag_modified(insight, "dashboard_ids")
    await db.commit()
    await db.refresh(insight)
    return insight

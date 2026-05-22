from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class MetricDef(BaseModel):
    column: str
    function: str
    alias: Optional[str] = None


class FilterDef(BaseModel):
    column: str
    op: str
    value: Any = None


class AnalysisRunRequest(BaseModel):
    dataset_id: int
    metrics: List[MetricDef]
    group_by: Optional[List[str]] = None
    filters: Optional[List[FilterDef]] = None
    include_stats: bool = False


class AnalysisResult(BaseModel):
    columns: List[str]
    rows: List[List[Any]]
    row_count: int
    stats: Optional[List[Dict[str, Any]]] = None


class AnalysisConfigCreate(BaseModel):
    name: str
    description: Optional[str] = None
    dataset_id: int
    config: Dict[str, Any]


class AnalysisConfigUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    dataset_id: Optional[int] = None
    config: Optional[Dict[str, Any]] = None


class AnalysisConfigOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    dataset_id: int
    owner_id: Optional[int]
    config: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AnalysisConfigListOut(BaseModel):
    total: int
    items: List[AnalysisConfigOut]


class InsightCreate(BaseModel):
    name: str
    description: Optional[str] = None
    dataset_id: int
    query_mode: str = "metric_builder"
    sql_query: Optional[str] = None
    columns: List[str]
    rows: List[List[Any]]
    row_count: int
    chart_type: Optional[str] = None


class InsightUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    chart_type: Optional[str] = None


class InsightOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    dataset_id: int
    owner_id: Optional[int]
    query_mode: str
    sql_query: Optional[str]
    columns: Optional[List[Any]]
    rows: Optional[List[Any]]
    row_count: int
    chart_type: Optional[str]
    report_ids: Optional[List[Any]]
    dashboard_ids: Optional[List[Any]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InsightListOut(BaseModel):
    total: int
    items: List[InsightOut]


class InsightAddToRequest(BaseModel):
    report_ids: Optional[List[int]] = None
    dashboard_ids: Optional[List[int]] = None

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ChartRequest(BaseModel):
    chart_type: str
    columns: List[str]
    rows: List[List[Any]]
    title: Optional[str] = None
    x_label: Optional[str] = None
    y_label: Optional[str] = None
    options: Optional[Dict[str, Any]] = None


class ChartResult(BaseModel):
    plotly_json: Dict[str, Any]


class PdfReportRequest(BaseModel):
    title: str
    sections: List[Dict[str, Any]]


class GrafanaDashboardRequest(BaseModel):
    title: str
    dataset_id: int
    panels: List[Dict[str, Any]]
    refresh: str = "5m"
    time_range: str = "now-24h"


class ExportCsvRequest(BaseModel):
    columns: List[str]
    rows: List[List[Any]]
    filename: Optional[str] = "export"

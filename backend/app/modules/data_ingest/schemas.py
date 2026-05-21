from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from app.modules.data_ingest.models import DatasetStatus


class DatasetOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner_id: Optional[int]
    original_filename: str
    original_format: str
    parquet_path: Optional[str]
    row_count: Optional[int]
    column_count: Optional[int]
    file_size_bytes: Optional[int]
    schema_info: Optional[Dict[str, Any]]
    status: DatasetStatus
    error_message: Optional[str]
    is_public: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DatasetListOut(BaseModel):
    total: int
    items: List[DatasetOut]


class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None

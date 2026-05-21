from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.modules.reports.models import DashboardLayout, ReportStatus


# ---------------------------------------------------------------------------
# Report Template schemas
# ---------------------------------------------------------------------------

class ReportTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    description: Optional[str] = None
    template_config: Dict[str, Any] = Field(default_factory=dict)
    is_public: bool = False


class ReportTemplateCreate(ReportTemplateBase):
    pass


class ReportTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=256)
    description: Optional[str] = None
    template_config: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None


class ReportTemplateOut(ReportTemplateBase):
    id: int
    owner_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReportTemplateListOut(BaseModel):
    total: int
    items: List[ReportTemplateOut]


# ---------------------------------------------------------------------------
# Report schemas
# ---------------------------------------------------------------------------

class ReportBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    description: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    status: ReportStatus = ReportStatus.draft
    is_public: bool = False
    template_id: Optional[int] = None


class ReportCreate(ReportBase):
    pass


class ReportUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=256)
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    status: Optional[ReportStatus] = None
    is_public: Optional[bool] = None
    template_id: Optional[int] = None


class ReportOut(ReportBase):
    id: int
    owner_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReportListOut(BaseModel):
    total: int
    items: List[ReportOut]


# ---------------------------------------------------------------------------
# Dashboard schemas
# ---------------------------------------------------------------------------

class DashboardBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    description: Optional[str] = None
    layout: Dict[str, Any] = Field(default_factory=dict)
    layout_type: DashboardLayout = DashboardLayout.grid
    is_public: bool = False


class DashboardCreate(DashboardBase):
    pass


class DashboardUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=256)
    description: Optional[str] = None
    layout: Optional[Dict[str, Any]] = None
    layout_type: Optional[DashboardLayout] = None
    is_public: Optional[bool] = None


class DashboardOut(DashboardBase):
    id: int
    owner_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DashboardListOut(BaseModel):
    total: int
    items: List[DashboardOut]

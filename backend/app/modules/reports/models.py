from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class ReportStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class DashboardLayout(str, enum.Enum):
    grid = "grid"
    freeform = "freeform"
    fixed = "fixed"


class ReportTemplate(Base):
    """Reusable report template that describes structure and required data sources."""
    __tablename__ = "report_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # JSON schema describing the template: widgets, columns, data-source types, etc.
    template_config: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    owner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    # Relationships
    reports: Mapped[List[Report]] = relationship("Report", back_populates="template")
    owner: Mapped[Optional[object]] = relationship("User", foreign_keys=[owner_id])


class Report(Base):
    """A concrete saved report, optionally based on a template."""
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Runtime config: selected data sources, filters, parameters
    config: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus, name="reportstatus"), default=ReportStatus.draft, nullable=False
    )
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    template_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("report_templates.id", ondelete="SET NULL"), nullable=True
    )
    owner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    template: Mapped[Optional[ReportTemplate]] = relationship(
        "ReportTemplate", back_populates="reports"
    )
    owner: Mapped[Optional[object]] = relationship("User", foreign_keys=[owner_id])


class Dashboard(Base):
    """A saved dashboard composed of widgets arranged in a layout."""
    __tablename__ = "dashboards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Layout JSON: widget positions, sizes, report references, etc.
    layout: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    layout_type: Mapped[DashboardLayout] = mapped_column(
        Enum(DashboardLayout, name="dashboardlayout"),
        default=DashboardLayout.grid,
        nullable=False,
    )
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    owner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    owner: Mapped[Optional[object]] = relationship("User", foreign_keys=[owner_id])

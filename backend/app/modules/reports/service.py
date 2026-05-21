from __future__ import annotations

from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.reports.models import Dashboard, Report, ReportTemplate
from app.modules.reports.schemas import (
    DashboardCreate,
    DashboardUpdate,
    ReportCreate,
    ReportTemplateCreate,
    ReportTemplateUpdate,
    ReportUpdate,
)


# ---------------------------------------------------------------------------
# Report Template CRUD
# ---------------------------------------------------------------------------

async def list_templates(
    db: AsyncSession,
    owner_id: Optional[int] = None,
    include_public: bool = True,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[int, List[ReportTemplate]]:
    query = select(ReportTemplate)
    count_query = select(func.count()).select_from(ReportTemplate)

    if owner_id is not None:
        if include_public:
            condition = or_(ReportTemplate.owner_id == owner_id, ReportTemplate.is_public == True)  # noqa: E712
        else:
            condition = ReportTemplate.owner_id == owner_id
        query = query.where(condition)
        count_query = count_query.where(condition)
    elif include_public:
        query = query.where(ReportTemplate.is_public == True)  # noqa: E712
        count_query = count_query.where(ReportTemplate.is_public == True)  # noqa: E712

    total = (await db.execute(count_query)).scalar_one()
    query = query.offset(skip).limit(limit).order_by(ReportTemplate.created_at.desc())
    result = await db.execute(query)
    return total, list(result.scalars().all())


async def get_template_by_id(db: AsyncSession, template_id: int) -> Optional[ReportTemplate]:
    result = await db.execute(select(ReportTemplate).where(ReportTemplate.id == template_id))
    return result.scalar_one_or_none()


async def create_template(
    db: AsyncSession, data: ReportTemplateCreate, owner_id: int
) -> ReportTemplate:
    template = ReportTemplate(
        name=data.name,
        description=data.description,
        template_config=data.template_config,
        is_public=data.is_public,
        owner_id=owner_id,
    )
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return template


async def update_template(
    db: AsyncSession, template: ReportTemplate, data: ReportTemplateUpdate
) -> ReportTemplate:
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    await db.flush()
    await db.refresh(template)
    return template


async def delete_template(db: AsyncSession, template: ReportTemplate) -> None:
    await db.delete(template)
    await db.flush()


# ---------------------------------------------------------------------------
# Report CRUD
# ---------------------------------------------------------------------------

async def list_reports(
    db: AsyncSession,
    owner_id: Optional[int] = None,
    include_public: bool = True,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
) -> Tuple[int, List[Report]]:
    query = select(Report)
    count_query = select(func.count()).select_from(Report)

    conditions = []
    if owner_id is not None:
        if include_public:
            conditions.append(or_(Report.owner_id == owner_id, Report.is_public == True))  # noqa: E712
        else:
            conditions.append(Report.owner_id == owner_id)
    elif include_public:
        conditions.append(Report.is_public == True)  # noqa: E712

    if search:
        pattern = f"%{search}%"
        conditions.append(Report.name.ilike(pattern))

    for cond in conditions:
        query = query.where(cond)
        count_query = count_query.where(cond)

    total = (await db.execute(count_query)).scalar_one()
    query = query.offset(skip).limit(limit).order_by(Report.created_at.desc())
    result = await db.execute(query)
    return total, list(result.scalars().all())


async def get_report_by_id(db: AsyncSession, report_id: int) -> Optional[Report]:
    result = await db.execute(select(Report).where(Report.id == report_id))
    return result.scalar_one_or_none()


async def create_report(db: AsyncSession, data: ReportCreate, owner_id: int) -> Report:
    # Validate template exists if provided
    if data.template_id is not None:
        tmpl = await get_template_by_id(db, data.template_id)
        if not tmpl:
            raise HTTPException(status_code=400, detail="Report template not found")

    report = Report(
        name=data.name,
        description=data.description,
        config=data.config,
        status=data.status,
        is_public=data.is_public,
        template_id=data.template_id,
        owner_id=owner_id,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return report


async def update_report(db: AsyncSession, report: Report, data: ReportUpdate) -> Report:
    update_data = data.model_dump(exclude_unset=True)
    if "template_id" in update_data and update_data["template_id"] is not None:
        tmpl = await get_template_by_id(db, update_data["template_id"])
        if not tmpl:
            raise HTTPException(status_code=400, detail="Report template not found")
    for field, value in update_data.items():
        setattr(report, field, value)
    await db.flush()
    await db.refresh(report)
    return report


async def delete_report(db: AsyncSession, report: Report) -> None:
    await db.delete(report)
    await db.flush()


# ---------------------------------------------------------------------------
# Dashboard CRUD
# ---------------------------------------------------------------------------

async def list_dashboards(
    db: AsyncSession,
    owner_id: Optional[int] = None,
    include_public: bool = True,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[int, List[Dashboard]]:
    query = select(Dashboard)
    count_query = select(func.count()).select_from(Dashboard)

    if owner_id is not None:
        if include_public:
            condition = or_(Dashboard.owner_id == owner_id, Dashboard.is_public == True)  # noqa: E712
        else:
            condition = Dashboard.owner_id == owner_id
        query = query.where(condition)
        count_query = count_query.where(condition)
    elif include_public:
        query = query.where(Dashboard.is_public == True)  # noqa: E712
        count_query = count_query.where(Dashboard.is_public == True)  # noqa: E712

    total = (await db.execute(count_query)).scalar_one()
    query = query.offset(skip).limit(limit).order_by(Dashboard.created_at.desc())
    result = await db.execute(query)
    return total, list(result.scalars().all())


async def get_dashboard_by_id(db: AsyncSession, dashboard_id: int) -> Optional[Dashboard]:
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    return result.scalar_one_or_none()


async def create_dashboard(db: AsyncSession, data: DashboardCreate, owner_id: int) -> Dashboard:
    dashboard = Dashboard(
        name=data.name,
        description=data.description,
        layout=data.layout,
        layout_type=data.layout_type,
        is_public=data.is_public,
        owner_id=owner_id,
    )
    db.add(dashboard)
    await db.flush()
    await db.refresh(dashboard)
    return dashboard


async def update_dashboard(db: AsyncSession, dashboard: Dashboard, data: DashboardUpdate) -> Dashboard:
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dashboard, field, value)
    await db.flush()
    await db.refresh(dashboard)
    return dashboard


async def delete_dashboard(db: AsyncSession, dashboard: Dashboard) -> None:
    await db.delete(dashboard)
    await db.flush()

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_editor
from app.modules.reports import service as report_service
from app.modules.reports.schemas import (
    DashboardCreate,
    DashboardListOut,
    DashboardOut,
    DashboardUpdate,
    ReportCreate,
    ReportListOut,
    ReportOut,
    ReportTemplateCreate,
    ReportTemplateListOut,
    ReportTemplateOut,
    ReportTemplateUpdate,
    ReportUpdate,
)

router = APIRouter(tags=["Reports & Dashboards"])


# ---------------------------------------------------------------------------
# Report Templates
# ---------------------------------------------------------------------------

templates_router = APIRouter(prefix="/reports/templates")


@templates_router.get("", response_model=ReportTemplateListOut, summary="List report templates")
async def list_templates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List report templates visible to the current user (own + public)."""
    total, templates = await report_service.list_templates(
        db, owner_id=current_user.id, include_public=True, skip=skip, limit=limit
    )
    return ReportTemplateListOut(
        total=total,
        items=[ReportTemplateOut.model_validate(t) for t in templates],
    )


@templates_router.post(
    "",
    response_model=ReportTemplateOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create report template",
)
async def create_template(
    body: ReportTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    template = await report_service.create_template(db, body, owner_id=current_user.id)
    return ReportTemplateOut.model_validate(template)


@templates_router.get("/{template_id}", response_model=ReportTemplateOut, summary="Get template by ID")
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    template = await report_service.get_template_by_id(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if not template.is_public and template.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return ReportTemplateOut.model_validate(template)


@templates_router.patch("/{template_id}", response_model=ReportTemplateOut, summary="Update template")
async def update_template(
    template_id: int,
    body: ReportTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    template = await report_service.get_template_by_id(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Not authorized to update this template")
    updated = await report_service.update_template(db, template, body)
    return ReportTemplateOut.model_validate(updated)


@templates_router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete template",
)
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    template = await report_service.get_template_by_id(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Not authorized to delete this template")
    await report_service.delete_template(db, template)


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

reports_router = APIRouter(prefix="/reports")


@reports_router.get("", response_model=ReportListOut, summary="List reports")
async def list_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, max_length=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    total, reports = await report_service.list_reports(
        db, owner_id=current_user.id, include_public=True, skip=skip, limit=limit, search=search
    )
    return ReportListOut(total=total, items=[ReportOut.model_validate(r) for r in reports])


@reports_router.post(
    "",
    response_model=ReportOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create report",
)
async def create_report(
    body: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    report = await report_service.create_report(db, body, owner_id=current_user.id)
    return ReportOut.model_validate(report)


@reports_router.get("/{report_id}", response_model=ReportOut, summary="Get report by ID")
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    report = await report_service.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not report.is_public and report.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Access denied")
    return ReportOut.model_validate(report)


@reports_router.patch("/{report_id}", response_model=ReportOut, summary="Update report")
async def update_report(
    report_id: int,
    body: ReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    report = await report_service.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Not authorized to update this report")
    updated = await report_service.update_report(db, report, body)
    return ReportOut.model_validate(updated)


@reports_router.delete(
    "/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete report",
)
async def delete_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    report = await report_service.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Not authorized to delete this report")
    await report_service.delete_report(db, report)


# ---------------------------------------------------------------------------
# Dashboards
# ---------------------------------------------------------------------------

dashboards_router = APIRouter(prefix="/dashboards")


@dashboards_router.get("", response_model=DashboardListOut, summary="List dashboards")
async def list_dashboards(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    total, dashboards = await report_service.list_dashboards(
        db, owner_id=current_user.id, include_public=True, skip=skip, limit=limit
    )
    return DashboardListOut(
        total=total, items=[DashboardOut.model_validate(d) for d in dashboards]
    )


@dashboards_router.post(
    "",
    response_model=DashboardOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create dashboard",
)
async def create_dashboard(
    body: DashboardCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    dashboard = await report_service.create_dashboard(db, body, owner_id=current_user.id)
    return DashboardOut.model_validate(dashboard)


@dashboards_router.get("/{dashboard_id}", response_model=DashboardOut, summary="Get dashboard by ID")
async def get_dashboard(
    dashboard_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    dashboard = await report_service.get_dashboard_by_id(db, dashboard_id)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if not dashboard.is_public and dashboard.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Access denied")
    return DashboardOut.model_validate(dashboard)


@dashboards_router.patch("/{dashboard_id}", response_model=DashboardOut, summary="Update dashboard")
async def update_dashboard(
    dashboard_id: int,
    body: DashboardUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    dashboard = await report_service.get_dashboard_by_id(db, dashboard_id)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if dashboard.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Not authorized to update this dashboard")
    updated = await report_service.update_dashboard(db, dashboard, body)
    return DashboardOut.model_validate(updated)


@dashboards_router.delete(
    "/{dashboard_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete dashboard",
)
async def delete_dashboard(
    dashboard_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    dashboard = await report_service.get_dashboard_by_id(db, dashboard_id)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if dashboard.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Not authorized to delete this dashboard")
    await report_service.delete_dashboard(db, dashboard)


# Combine all sub-routers under the main reports router
router.include_router(templates_router)
router.include_router(reports_router)
router.include_router(dashboards_router)

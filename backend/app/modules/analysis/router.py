from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_editor
from app.modules.analysis import service as analysis_service
from app.modules.analysis.schemas import (
    AnalysisConfigCreate,
    AnalysisConfigListOut,
    AnalysisConfigOut,
    AnalysisConfigUpdate,
    AnalysisResult,
    AnalysisRunRequest,
    InsightAddToRequest,
    InsightCreate,
    InsightListOut,
    InsightOut,
    InsightUpdate,
)
from app.modules.data_ingest import service as ingest_service

router = APIRouter(prefix="/analysis", tags=["Analysis"])


async def _check_dataset_access(dataset_id: int, current_user, db: AsyncSession):
    dataset = await ingest_service.get_dataset_by_id(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not dataset.is_public and dataset.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Access denied")
    return dataset


@router.post("/run", response_model=AnalysisResult)
async def run_analysis(
    body: AnalysisRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    await _check_dataset_access(body.dataset_id, current_user, db)
    try:
        return await analysis_service.run_analysis(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/configs", response_model=AnalysisConfigListOut)
async def list_configs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    total, items = await analysis_service.list_configs(
        db=db, owner_id=current_user.id, skip=skip, limit=limit
    )
    return AnalysisConfigListOut(
        total=total, items=[AnalysisConfigOut.model_validate(c) for c in items]
    )


@router.post(
    "/configs",
    response_model=AnalysisConfigOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_config(
    body: AnalysisConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    await _check_dataset_access(body.dataset_id, current_user, db)
    config = await analysis_service.create_config(db=db, body=body, owner_id=current_user.id)
    return AnalysisConfigOut.model_validate(config)


@router.get("/configs/{config_id}", response_model=AnalysisConfigOut)
async def get_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    config = await analysis_service.get_config_by_id(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Analysis config not found")
    if config.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Access denied")
    return AnalysisConfigOut.model_validate(config)


@router.patch("/configs/{config_id}", response_model=AnalysisConfigOut)
async def update_config(
    config_id: int,
    body: AnalysisConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    config = await analysis_service.get_config_by_id(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Analysis config not found")
    if config.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Not authorized to update this config")
    updated = await analysis_service.update_config(db=db, config=config, body=body)
    return AnalysisConfigOut.model_validate(updated)


@router.delete("/configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    config = await analysis_service.get_config_by_id(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Analysis config not found")
    if config.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Not authorized to delete this config")
    await analysis_service.delete_config(db=db, config=config)


@router.post("/configs/{config_id}/run", response_model=AnalysisResult)
async def run_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    config = await analysis_service.get_config_by_id(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Analysis config not found")
    if config.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Access denied")

    await _check_dataset_access(config.dataset_id, current_user, db)

    cfg = config.config
    from app.modules.analysis.schemas import FilterDef, MetricDef

    metrics = [MetricDef(**m) for m in cfg.get("metrics", [])]
    group_by = cfg.get("group_by")
    raw_filters = cfg.get("filters")
    filters = [FilterDef(**f) for f in raw_filters] if raw_filters else None

    request = AnalysisRunRequest(
        dataset_id=config.dataset_id,
        metrics=metrics,
        group_by=group_by,
        filters=filters,
        include_stats=cfg.get("include_stats", False),
    )

    try:
        return await analysis_service.run_analysis(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ─── Insight CRUD ──────────────────────────────────────────────────────────────


@router.post("/insights", response_model=InsightOut, status_code=status.HTTP_201_CREATED)
async def create_insight(
    body: InsightCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    await _check_dataset_access(body.dataset_id, current_user, db)
    insight = await analysis_service.create_insight(db=db, body=body, owner_id=current_user.id)
    return InsightOut.model_validate(insight)


@router.get("/insights", response_model=InsightListOut)
async def list_insights(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    total, items = await analysis_service.list_insights(
        db=db, owner_id=current_user.id, skip=skip, limit=limit
    )
    return InsightListOut(total=total, items=[InsightOut.model_validate(i) for i in items])


@router.get("/insights/{insight_id}", response_model=InsightOut)
async def get_insight(
    insight_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    insight = await analysis_service.get_insight_by_id(db, insight_id)
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    if insight.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Access denied")
    return InsightOut.model_validate(insight)


@router.patch("/insights/{insight_id}", response_model=InsightOut)
async def update_insight(
    insight_id: int,
    body: InsightUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    insight = await analysis_service.get_insight_by_id(db, insight_id)
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    if insight.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Not authorized")
    updated = await analysis_service.update_insight(db=db, insight=insight, body=body)
    return InsightOut.model_validate(updated)


@router.delete("/insights/{insight_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_insight(
    insight_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    insight = await analysis_service.get_insight_by_id(db, insight_id)
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    if insight.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Not authorized")
    await analysis_service.delete_insight(db=db, insight=insight)


@router.post("/insights/{insight_id}/add-to", response_model=InsightOut)
async def add_insight_to_targets(
    insight_id: int,
    body: InsightAddToRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    insight = await analysis_service.get_insight_by_id(db, insight_id)
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    if insight.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Not authorized")
    updated = await analysis_service.add_insight_to_targets(db=db, insight=insight, body=body)
    return InsightOut.model_validate(updated)

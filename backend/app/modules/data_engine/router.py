from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_editor
from app.modules.data_engine import service as engine_service
from app.modules.data_engine.schemas import AggregateRequest, QueryRequest, QueryResult
from app.modules.data_ingest import service as ingest_service
from app.modules.data_ingest.models import DatasetStatus

router = APIRouter(prefix="/engine", tags=["Data Engine"])


async def _get_accessible_dataset(dataset_id: int, current_user, db: AsyncSession):
    dataset = await ingest_service.get_dataset_by_id(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not dataset.is_public and dataset.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Access denied")
    if dataset.status != DatasetStatus.ready:
        raise HTTPException(status_code=400, detail="Dataset is not ready for querying")
    return dataset


@router.post("/query", response_model=QueryResult)
async def run_query(
    body: QueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    await _get_accessible_dataset(body.dataset_id, current_user, db)
    try:
        return await engine_service.query_dataset(body.dataset_id, body.sql, body.limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/datasets/{dataset_id}/preview", response_model=QueryResult)
async def preview_dataset(
    dataset_id: int,
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await _get_accessible_dataset(dataset_id, current_user, db)
    try:
        return await engine_service.preview_dataset(dataset_id, limit)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/aggregate", response_model=QueryResult)
async def run_aggregate(
    body: AggregateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    await _get_accessible_dataset(body.dataset_id, current_user, db)
    try:
        return await engine_service.aggregate_dataset(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

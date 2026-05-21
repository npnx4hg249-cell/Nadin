from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_editor
from app.modules.data_ingest import service as ingest_service
from app.modules.data_ingest.schemas import DatasetListOut, DatasetOut, DatasetUpdate

router = APIRouter(prefix="/datasets", tags=["Data Ingest"])


@router.post("", response_model=DatasetOut, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile,
    name: str = Form(...),
    description: Optional[str] = Form(None),
    is_public: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    dataset = await ingest_service.process_upload(
        db=db,
        file=file,
        name=name,
        description=description,
        owner_id=current_user.id,
        is_public=is_public,
    )
    return DatasetOut.model_validate(dataset)


@router.get("", response_model=DatasetListOut)
async def list_datasets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    include_public: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    total, items = await ingest_service.list_datasets(
        db=db,
        owner_id=current_user.id,
        include_public=include_public,
        skip=skip,
        limit=limit,
    )
    return DatasetListOut(total=total, items=[DatasetOut.model_validate(d) for d in items])


@router.get("/{dataset_id}", response_model=DatasetOut)
async def get_dataset(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    dataset = await ingest_service.get_dataset_by_id(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not dataset.is_public and dataset.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Access denied")
    return DatasetOut.model_validate(dataset)


@router.patch("/{dataset_id}", response_model=DatasetOut)
async def update_dataset(
    dataset_id: int,
    body: DatasetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    dataset = await ingest_service.get_dataset_by_id(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Not authorized to update this dataset")
    updated = await ingest_service.update_dataset(
        db=db,
        dataset=dataset,
        name=body.name,
        description=body.description,
        is_public=body.is_public,
    )
    return DatasetOut.model_validate(updated)


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_editor),
):
    dataset = await ingest_service.get_dataset_by_id(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.owner_id != current_user.id:
        from app.modules.users.models import UserRole
        if current_user.role not in {UserRole.admin, UserRole.super_admin}:
            raise HTTPException(status_code=403, detail="Not authorized to delete this dataset")
    await ingest_service.delete_dataset(db, dataset)

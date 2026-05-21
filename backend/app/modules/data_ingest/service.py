from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import List, Optional, Tuple

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.data_ingest.models import Dataset, DatasetStatus

MAX_UPLOAD_BYTES = 500 * 1024 * 1024


def _detect_format(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".csv":
        return "csv"
    if ext in {".xlsx", ".xls"}:
        return "xlsx"
    if ext == ".json":
        return "json"
    if ext == ".parquet":
        return "parquet"
    raise HTTPException(status_code=400, detail=f"Unsupported file extension: {ext}")


def _parse_and_write(data: bytes, fmt: str, out_path: str) -> dict:
    import polars as pl

    if fmt == "csv":
        df = pl.read_csv(data)
    elif fmt == "xlsx":
        import io
        df = pl.read_excel(io.BytesIO(data), engine="openpyxl")
    elif fmt == "json":
        df = pl.read_json(data)
    elif fmt == "parquet":
        import io
        df = pl.read_parquet(io.BytesIO(data))
    else:
        raise ValueError(f"Unknown format: {fmt}")

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(out_path, compression="zstd")

    schema_info = {
        "columns": [
            {"name": col, "dtype": str(dtype), "nullable": True}
            for col, dtype in zip(df.columns, df.dtypes)
        ]
    }
    return {
        "row_count": df.height,
        "column_count": df.width,
        "schema_info": schema_info,
    }


async def process_upload(
    db: AsyncSession,
    file: UploadFile,
    name: str,
    description: Optional[str],
    owner_id: int,
    is_public: bool,
) -> Dataset:
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 500 MB limit")

    fmt = _detect_format(file.filename or "")

    dataset = Dataset(
        name=name,
        description=description,
        owner_id=owner_id,
        original_filename=file.filename or "",
        original_format=fmt,
        file_size_bytes=len(data),
        status=DatasetStatus.processing,
        is_public=is_public,
    )
    db.add(dataset)
    await db.flush()
    await db.refresh(dataset)

    out_path = str(Path(settings.DATASETS_DIR) / f"{dataset.id}.parquet")

    try:
        result = await asyncio.to_thread(_parse_and_write, data, fmt, out_path)
        dataset.parquet_path = out_path
        dataset.row_count = result["row_count"]
        dataset.column_count = result["column_count"]
        dataset.schema_info = result["schema_info"]
        dataset.status = DatasetStatus.ready
    except Exception as exc:
        dataset.status = DatasetStatus.error
        dataset.error_message = str(exc)

    await db.flush()
    await db.refresh(dataset)
    return dataset


async def list_datasets(
    db: AsyncSession,
    owner_id: int,
    include_public: bool = True,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[int, List[Dataset]]:
    if include_public:
        condition = or_(Dataset.owner_id == owner_id, Dataset.is_public == True)  # noqa: E712
    else:
        condition = Dataset.owner_id == owner_id

    count_query = select(func.count()).select_from(Dataset).where(condition)
    total = (await db.execute(count_query)).scalar_one()

    query = (
        select(Dataset)
        .where(condition)
        .offset(skip)
        .limit(limit)
        .order_by(Dataset.created_at.desc())
    )
    result = await db.execute(query)
    return total, list(result.scalars().all())


async def get_dataset_by_id(db: AsyncSession, dataset_id: int) -> Optional[Dataset]:
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    return result.scalar_one_or_none()


async def update_dataset(
    db: AsyncSession,
    dataset: Dataset,
    name: Optional[str] = None,
    description: Optional[str] = None,
    is_public: Optional[bool] = None,
) -> Dataset:
    if name is not None:
        dataset.name = name
    if description is not None:
        dataset.description = description
    if is_public is not None:
        dataset.is_public = is_public
    await db.flush()
    await db.refresh(dataset)
    return dataset


async def delete_dataset(db: AsyncSession, dataset: Dataset) -> None:
    if dataset.parquet_path:
        try:
            os.remove(dataset.parquet_path)
        except FileNotFoundError:
            pass
    await db.delete(dataset)
    await db.flush()

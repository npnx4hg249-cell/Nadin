from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.core.dependencies import get_current_user
from app.modules.output import service as output_service
from app.modules.output.schemas import (
    ChartRequest,
    ChartResult,
    ExportCsvRequest,
    GrafanaDashboardRequest,
    PdfReportRequest,
)

router = APIRouter(prefix="/output", tags=["Output"])


@router.post("/chart", response_model=ChartResult)
async def build_chart(
    body: ChartRequest,
    current_user=Depends(get_current_user),
):
    try:
        return output_service.build_chart_json(body)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/grafana")
async def build_grafana(
    body: GrafanaDashboardRequest,
    current_user=Depends(get_current_user),
):
    try:
        dashboard = output_service.build_grafana_dashboard(body)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    safe_title = body.title.replace(" ", "_")
    return Response(
        content=json.dumps(dashboard),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.json"'},
    )


@router.post("/pdf")
async def build_pdf(
    body: PdfReportRequest,
    current_user=Depends(get_current_user),
):
    try:
        pdf_bytes = output_service.build_pdf_report(body.title, body.sections)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    safe_title = body.title.replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
    )


@router.post("/csv")
async def build_csv(
    body: ExportCsvRequest,
    current_user=Depends(get_current_user),
):
    try:
        csv_str = output_service.build_csv(body.columns, body.rows)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    filename = (body.filename or "export").replace(" ", "_")
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
    )

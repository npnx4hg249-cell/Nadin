from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.core.config import settings
from app.core.dependencies import get_current_user, require_editor
from app.modules.llm import service as llm_service
from app.modules.llm.schemas import LlmHealthResponse, NlToSqlRequest, NlToSqlResponse

logger = logging.getLogger("nadin.llm")
router = APIRouter(prefix="/llm", tags=["LLM"])


@router.get("/health", response_model=LlmHealthResponse)
async def llm_health(current_user=Depends(get_current_user)):
    result = await llm_service.health_check()
    return LlmHealthResponse(**result)


@router.post("/nl-to-sql", response_model=NlToSqlResponse)
async def nl_to_sql(
    body: NlToSqlRequest,
    current_user=Depends(require_editor),
):
    if not settings.LLM_ENABLED:
        raise HTTPException(status_code=503, detail="LLM feature is disabled")
    try:
        sql, model, tokens = await llm_service.nl_to_sql(body.question, body.schema_context)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return NlToSqlResponse(sql=sql, model=model, prompt_tokens=tokens)

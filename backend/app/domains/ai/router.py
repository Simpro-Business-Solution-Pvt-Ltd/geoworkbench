from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.cache import get_cache_store
from app.core.config import get_settings
from app.core.realtime import publish_workbench_event
from app.db.session import get_db
from app.domains.ai import service
from app.domains.ai.schemas import (
    AiSuggestionOut,
    AiSuggestionStatusPatch,
    BoreholeSummaryOut,
    CorrelationSummaryOut,
    CorrelationSummaryRequest,
)

router = APIRouter()
settings = get_settings()


@router.post("/boreholes/{borehole_id}/suggestions/generate", response_model=list[AiSuggestionOut])
def generate_suggestions(borehole_id: int, db: Session = Depends(get_db)) -> list[AiSuggestionOut]:
    try:
        suggestions = service.generate_suggestions(db, borehole_id)
        publish_workbench_event(
            "workbench.ai.updated",
            borehole_id=borehole_id,
            entity="ai_suggestion",
            operation="generated",
            payload={"suggestion_count": len(suggestions)},
        )
        return suggestions
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/suggestions/{suggestion_id}", response_model=AiSuggestionOut)
def update_suggestion_status(
    suggestion_id: int, payload: AiSuggestionStatusPatch, db: Session = Depends(get_db)
) -> AiSuggestionOut:
    try:
        suggestion = service.update_suggestion_status(db, suggestion_id, payload.status)
        publish_workbench_event(
            "workbench.ai.updated",
            borehole_id=suggestion.borehole_id,
            entity="ai_suggestion",
            operation="status_updated",
            payload={"suggestion_id": suggestion.id, "status": suggestion.status},
        )
        return suggestion
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/suggestions/{suggestion_id}/accept", response_model=AiSuggestionOut)
def accept_suggestion(suggestion_id: int, db: Session = Depends(get_db)) -> AiSuggestionOut:
    try:
        suggestion = service.accept_suggestion(db, suggestion_id)
        publish_workbench_event(
            "workbench.ai.updated",
            borehole_id=suggestion.borehole_id,
            entity="ai_suggestion",
            operation="accepted",
            payload={"suggestion_id": suggestion.id},
        )
        return suggestion
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/boreholes/{borehole_id}/summary", response_model=BoreholeSummaryOut)
def summarize_borehole(
    borehole_id: int,
    response: Response,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> BoreholeSummaryOut:
    cache = get_cache_store()
    data_version = cache.get_version(f"borehole:{borehole_id}:data")
    quality_version = cache.get_version("quality-settings")
    key = cache.key(
        "ai-summary",
        cache.access_scope(authorization),
        borehole_id,
        data_version,
        quality_version,
        settings.ai_provider,
        settings.ai_model,
    )
    lookup = cache.get_json_text(key)
    if lookup.value is not None:
        return Response(
            content=lookup.value,
            media_type="application/json",
            headers={"X-GeoWorkbench-Cache": "HIT"},
        )
    try:
        result = BoreholeSummaryOut.model_validate(service.summarize_borehole(db, borehole_id))
        cache.set_json(key, result.model_dump(mode="json"), settings.cache_ai_summary_ttl_seconds)
        response.headers["X-GeoWorkbench-Cache"] = lookup.status
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/correlation/summary", response_model=CorrelationSummaryOut)
def summarize_correlation(
    payload: CorrelationSummaryRequest,
    response: Response,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> CorrelationSummaryOut:
    cache = get_cache_store()
    versions = {
        str(borehole_id): cache.get_version(f"borehole:{borehole_id}:data")
        for borehole_id in sorted(set(payload.borehole_ids))
    }
    identity = {
        "borehole_ids": payload.borehole_ids,
        "focus_seam": payload.focus_seam,
        "align_mode": payload.align_mode,
        "data_versions": versions,
        "quality_version": cache.get_version("quality-settings"),
        "provider": settings.ai_provider,
        "model": settings.ai_model,
    }
    key = cache.key(
        "correlation-ai-summary",
        cache.access_scope(authorization),
        cache.digest(identity),
    )
    lookup = cache.get_json_text(key)
    if lookup.value is not None:
        return Response(
            content=lookup.value,
            media_type="application/json",
            headers={"X-GeoWorkbench-Cache": "HIT"},
        )
    try:
        result = CorrelationSummaryOut.model_validate(
            service.summarize_correlation(
                db,
                payload.borehole_ids,
                focus_seam=payload.focus_seam,
                align_mode=payload.align_mode,
            )
        )
        cache.set_json(key, result.model_dump(mode="json"), settings.cache_ai_summary_ttl_seconds)
        response.headers["X-GeoWorkbench-Cache"] = lookup.status
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/provider-status")
def provider_status() -> dict:
    return service.provider_status()

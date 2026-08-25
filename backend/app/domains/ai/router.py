from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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
def summarize_borehole(borehole_id: int, db: Session = Depends(get_db)) -> BoreholeSummaryOut:
    try:
        return service.summarize_borehole(db, borehole_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/correlation/summary", response_model=CorrelationSummaryOut)
def summarize_correlation(
    payload: CorrelationSummaryRequest, db: Session = Depends(get_db)
) -> CorrelationSummaryOut:
    try:
        return service.summarize_correlation(
            db,
            payload.borehole_ids,
            focus_seam=payload.focus_seam,
            align_mode=payload.align_mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/provider-status")
def provider_status() -> dict:
    return service.provider_status()

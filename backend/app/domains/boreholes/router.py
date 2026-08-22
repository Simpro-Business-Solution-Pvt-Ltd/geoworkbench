from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.realtime import publish_workbench_event
from app.db.session import get_db
from app.domains.auth.router import current_user
from app.domains.boreholes import service
from app.domains.boreholes.schemas import (
    BoreholeListItem,
    BoreholeStatusOut,
    BoreholeWorkbenchOut,
    CurveSampleWindowOut,
    DisplayLayoutCloneRequest,
    DisplayLayoutOut,
    DisplayLayoutPatch,
    LithologyIntervalOut,
    LithologyIntervalPatch,
)

router = APIRouter()


@router.get("", response_model=list[BoreholeListItem])
def list_boreholes(db: Session = Depends(get_db)) -> list[BoreholeListItem]:
    return service.list_boreholes(db)


@router.get("/{borehole_id}/workbench", response_model=BoreholeWorkbenchOut)
def get_workbench(
    borehole_id: int,
    display_layout_id: int | None = None,
    db: Session = Depends(get_db),
) -> BoreholeWorkbenchOut:
    try:
        return service.get_workbench(db, borehole_id, display_layout_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{borehole_id}/curves/{curve_key}/samples", response_model=CurveSampleWindowOut)
def get_curve_sample_window(
    borehole_id: int,
    curve_key: str,
    from_depth: float,
    to_depth: float,
    max_samples: int | None = None,
    db: Session = Depends(get_db),
) -> CurveSampleWindowOut:
    try:
        return service.curve_sample_window(
            db,
            borehole_id,
            curve_key,
            from_depth,
            to_depth,
            max_samples,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/intervals/{interval_id}", response_model=LithologyIntervalOut)
def patch_interval(
    interval_id: str,
    patch: LithologyIntervalPatch,
    db: Session = Depends(get_db),
    user=Depends(current_user),
) -> LithologyIntervalOut:
    try:
        actor = user.display_name or user.username
        interval = service.update_lithology_interval(db, interval_id, patch, actor=actor)
        publish_workbench_event(
            "workbench.interval.updated",
            borehole_id=interval.borehole_id,
            entity="lithology_interval",
            operation="updated",
            payload={"interval_id": interval.id, "actor": actor},
        )
        return interval
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/display-layouts/{layout_id}", response_model=DisplayLayoutOut)
def patch_display_layout(
    layout_id: int, patch: DisplayLayoutPatch, db: Session = Depends(get_db)
) -> DisplayLayoutOut:
    try:
        layout = service.update_display_layout(db, layout_id, patch)
        publish_workbench_event(
            "workbench.layout.updated",
            borehole_id=layout.borehole_id,
            entity="display_layout",
            operation="updated",
            payload={"layout_id": layout.id},
        )
        return layout
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/display-layouts/{layout_id}/clone", response_model=DisplayLayoutOut)
def clone_display_layout(
    layout_id: int,
    payload: DisplayLayoutCloneRequest | None = None,
    db: Session = Depends(get_db),
) -> DisplayLayoutOut:
    try:
        layout = service.clone_display_layout(db, layout_id, payload.name if payload else None)
        publish_workbench_event(
            "workbench.layout.created",
            borehole_id=layout.borehole_id,
            entity="display_layout",
            operation="created",
            payload={"layout_id": layout.id},
        )
        return layout
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/display-layouts/{layout_id}", response_model=DisplayLayoutOut)
def delete_display_layout(layout_id: int, db: Session = Depends(get_db)) -> DisplayLayoutOut:
    try:
        layout = service.delete_display_layout(db, layout_id)
        publish_workbench_event(
            "workbench.layout.deleted",
            borehole_id=layout.borehole_id,
            entity="display_layout",
            operation="deleted",
            payload={"layout_id": layout.id},
        )
        return layout
    except ValueError as exc:
        status_code = 400 if "must remain" in str(exc) else 404
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.post("/{borehole_id}/display-layout/reset", response_model=DisplayLayoutOut)
def reset_display_layout(
    borehole_id: int, db: Session = Depends(get_db)
) -> DisplayLayoutOut:
    try:
        layout = service.reset_borehole_display_layout(db, borehole_id)
        publish_workbench_event(
            "workbench.layout.reset",
            borehole_id=borehole_id,
            entity="display_layout",
            operation="reset",
            payload={"layout_id": layout.id},
        )
        return layout
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{borehole_id}/approve-export", response_model=BoreholeStatusOut)
def approve_borehole_for_export(
    borehole_id: int, db: Session = Depends(get_db)
) -> BoreholeStatusOut:
    try:
        status = service.approve_borehole_for_export(db, borehole_id)
        publish_workbench_event(
            "workbench.status.updated",
            borehole_id=borehole_id,
            entity="borehole",
            operation="updated",
            payload={"workflow_status": status.workflow_status},
        )
        return status
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

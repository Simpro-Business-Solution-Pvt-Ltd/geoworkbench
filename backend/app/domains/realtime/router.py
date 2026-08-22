import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.realtime import realtime_broker
from app.db.session import get_db
from app.domains.auth import service as auth_service

router = APIRouter()


@router.get("/boreholes/{borehole_id}/events")
async def borehole_events(
    borehole_id: int,
    token: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    try:
        auth_service.get_session(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    subscription = realtime_broker.subscribe(borehole_id)

    async def event_stream():
        try:
            yield "event: connected\ndata: {\"status\":\"connected\"}\n\n"
            while True:
                event = await asyncio.to_thread(subscription.next_event, 15)
                if event is None:
                    yield ": keepalive\n\n"
                    continue
                yield f"data: {json.dumps(event.to_dict(), separators=(',', ':'))}\n\n"
        finally:
            subscription.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

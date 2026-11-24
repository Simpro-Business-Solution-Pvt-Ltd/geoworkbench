import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.core.realtime import realtime_broker
from app.db.session import SessionLocal
from app.domains.auth import service as auth_service

router = APIRouter()


def authenticate_event_stream(
    token: str = Query(..., min_length=1),
) -> None:
    # Authentication must release its connection before the long-lived SSE response.
    with SessionLocal() as db:
        try:
            auth_service.get_session(db, token)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.get("/boreholes/{borehole_id}/events")
async def borehole_events(
    borehole_id: int,
    _: None = Depends(authenticate_event_stream),
) -> StreamingResponse:

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

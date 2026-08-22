from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from queue import Empty, Queue
from threading import Lock
from typing import Any
from uuid import uuid4


@dataclass(frozen=True)
class RealtimeEvent:
    type: str
    borehole_id: int | None = None
    entity: str | None = None
    operation: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)
    occurred_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "borehole_id": self.borehole_id,
            "entity": self.entity,
            "operation": self.operation,
            "payload": self.payload,
            "occurred_at": self.occurred_at,
        }


class RealtimeSubscription:
    def __init__(self, broker: "RealtimeBroker", subscription_id: str, queue: Queue[RealtimeEvent]) -> None:
        self._broker = broker
        self.subscription_id = subscription_id
        self._queue = queue

    def next_event(self, timeout: float = 30) -> RealtimeEvent | None:
        try:
            return self._queue.get(timeout=timeout)
        except Empty:
            return None

    def close(self) -> None:
        self._broker.unsubscribe(self.subscription_id)


class RealtimeBroker:
    def __init__(self) -> None:
        self._lock = Lock()
        self._subscriptions: dict[str, tuple[int | None, Queue[RealtimeEvent]]] = {}

    def subscribe(self, borehole_id: int | None = None) -> RealtimeSubscription:
        subscription_id = uuid4().hex
        queue: Queue[RealtimeEvent] = Queue(maxsize=256)
        with self._lock:
            self._subscriptions[subscription_id] = (borehole_id, queue)
        return RealtimeSubscription(self, subscription_id, queue)

    def unsubscribe(self, subscription_id: str) -> None:
        with self._lock:
            self._subscriptions.pop(subscription_id, None)

    def publish(self, event: RealtimeEvent) -> None:
        with self._lock:
            targets = list(self._subscriptions.values())
        for borehole_id, queue in targets:
            if borehole_id is not None and event.borehole_id not in {None, borehole_id}:
                continue
            if queue.full():
                try:
                    queue.get_nowait()
                except Empty:
                    pass
            queue.put_nowait(event)

    def subscriber_count(self) -> int:
        with self._lock:
            return len(self._subscriptions)


realtime_broker = RealtimeBroker()


def publish_workbench_event(
    event_type: str,
    *,
    borehole_id: int | None,
    entity: str,
    operation: str,
    payload: dict[str, Any] | None = None,
) -> None:
    realtime_broker.publish(
        RealtimeEvent(
            type=event_type,
            borehole_id=borehole_id,
            entity=entity,
            operation=operation,
            payload=payload or {},
        )
    )

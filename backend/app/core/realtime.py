from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from queue import Empty, Queue
from threading import Lock, Thread
from typing import Any
from uuid import uuid4

from app.core.cache import invalidate_for_event
from app.core.config import get_settings

try:
    from redis import Redis
    from redis.backoff import NoBackoff
    from redis.exceptions import RedisError
    from redis.retry import Retry
except ImportError:  # pragma: no cover - supports fail-open startup before optional install
    Redis = None  # type: ignore[assignment]
    NoBackoff = None  # type: ignore[assignment]
    Retry = None  # type: ignore[assignment]

    class RedisError(Exception):
        pass


logger = logging.getLogger("geoworkbench.realtime")


@dataclass(frozen=True)
class RealtimeEvent:
    type: str
    borehole_id: int | None = None
    entity: str | None = None
    operation: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)
    occurred_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

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
    def __init__(self, broker: RealtimeBroker, subscription_id: str, queue: Queue[RealtimeEvent]) -> None:
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
    def __init__(
        self,
        redis_url: str | None = None,
        channel: str = "geoworkbench:realtime:v1",
    ) -> None:
        self._lock = Lock()
        self._subscriptions: dict[str, tuple[int | None, Queue[RealtimeEvent]]] = {}
        self._redis_url = redis_url
        self._channel = channel
        self._instance_id = uuid4().hex
        self._publisher = None
        self._publisher_unavailable_until = 0.0
        self._listener_started = False

    def subscribe(self, borehole_id: int | None = None) -> RealtimeSubscription:
        subscription_id = uuid4().hex
        queue: Queue[RealtimeEvent] = Queue(maxsize=256)
        with self._lock:
            self._subscriptions[subscription_id] = (borehole_id, queue)
        self._ensure_remote_listener()
        return RealtimeSubscription(self, subscription_id, queue)

    def unsubscribe(self, subscription_id: str) -> None:
        with self._lock:
            self._subscriptions.pop(subscription_id, None)

    def publish(self, event: RealtimeEvent) -> None:
        self._publish_local(event)
        self._publish_remote(event)

    def _publish_local(self, event: RealtimeEvent) -> None:
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

    def _publish_remote(self, event: RealtimeEvent) -> None:
        if (
            not self._redis_url
            or Redis is None
            or time.monotonic() < self._publisher_unavailable_until
        ):
            return
        try:
            if self._publisher is None:
                self._publisher = Redis.from_url(
                    self._redis_url,
                    decode_responses=True,
                    socket_connect_timeout=1,
                    socket_timeout=1,
                    health_check_interval=30,
                    retry=Retry(NoBackoff(), 0),
                    retry_on_error=[],
                )
            self._publisher.publish(
                self._channel,
                json.dumps(
                    {"origin": self._instance_id, "event": event.to_dict()},
                    separators=(",", ":"),
                ),
            )
        except (RedisError, TypeError, ValueError) as exc:
            self._publisher_unavailable_until = time.monotonic() + 30
            logger.warning("realtime Redis publish failed; local SSE delivery remains active: %s", exc)

    def _ensure_remote_listener(self) -> None:
        if not self._redis_url or Redis is None:
            return
        with self._lock:
            if self._listener_started:
                return
            self._listener_started = True
        Thread(target=self._listen_remote, name="geoworkbench-redis-events", daemon=True).start()

    def _listen_remote(self) -> None:
        retry_delay = 2
        while True:
            try:
                client = Redis.from_url(
                    self._redis_url,
                    decode_responses=True,
                    socket_connect_timeout=1,
                    socket_timeout=None,
                    health_check_interval=30,
                    retry=Retry(NoBackoff(), 0),
                    retry_on_error=[],
                )
                with client.pubsub(ignore_subscribe_messages=True) as pubsub:
                    pubsub.subscribe(self._channel)
                    retry_delay = 2
                    for message in pubsub.listen():
                        self._handle_remote_message(message.get("data"))
            except (RedisError, TypeError, ValueError) as exc:
                logger.warning("realtime Redis listener disconnected; retrying: %s", exc)
                time.sleep(retry_delay)
                retry_delay = min(30, retry_delay * 2)

    def _handle_remote_message(self, raw: Any) -> None:
        try:
            envelope = json.loads(raw)
            if envelope.get("origin") == self._instance_id:
                return
            payload = envelope["event"]
            self._publish_local(
                RealtimeEvent(
                    type=payload["type"],
                    borehole_id=payload.get("borehole_id"),
                    entity=payload.get("entity"),
                    operation=payload.get("operation"),
                    payload=payload.get("payload") or {},
                    occurred_at=payload.get("occurred_at") or "",
                )
            )
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            logger.warning("ignored malformed realtime Redis event: %s", exc)

    def subscriber_count(self) -> int:
        with self._lock:
            return len(self._subscriptions)


_settings = get_settings()
realtime_broker = RealtimeBroker(
    redis_url=_settings.redis_url if _settings.realtime_redis_enabled else None,
    channel=_settings.realtime_channel,
)


def publish_workbench_event(
    event_type: str,
    *,
    borehole_id: int | None,
    entity: str,
    operation: str,
    payload: dict[str, Any] | None = None,
) -> None:
    invalidate_for_event(event_type, borehole_id, entity)
    realtime_broker.publish(
        RealtimeEvent(
            type=event_type,
            borehole_id=borehole_id,
            entity=entity,
            operation=operation,
            payload=payload or {},
        )
    )

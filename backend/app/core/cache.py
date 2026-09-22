from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from threading import Lock
from typing import Any
from urllib.parse import quote

from app.core.config import Settings, get_settings

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


logger = logging.getLogger("geoworkbench.cache")


@dataclass(frozen=True)
class CacheLookup:
    value: Any | None
    status: str


class CacheStore:
    """Small fail-open Redis JSON cache used only after endpoint authorization."""

    def __init__(self, settings: Settings, client: Any | None = None) -> None:
        self.settings = settings
        self.enabled = bool(settings.cache_enabled and settings.redis_url)
        self._client = client
        self._lock = Lock()
        self._unavailable_until = 0.0
        self._stats = {"hits": 0, "misses": 0, "errors": 0, "writes": 0, "invalidations": 0}
        if self.enabled and self._client is None and Redis is not None:
            self._client = Redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=settings.cache_connect_timeout_seconds,
                socket_timeout=settings.cache_socket_timeout_seconds,
                health_check_interval=30,
                retry=Retry(NoBackoff(), 0),
                retry_on_error=[],
            )
        if self.enabled and self._client is None:
            logger.warning("cache disabled because the redis package is unavailable")
            self.enabled = False

    def key(self, *parts: object) -> str:
        encoded = [quote(str(part), safe="-_.") for part in parts]
        return ":".join(
            [
                self.settings.cache_prefix,
                self.settings.cache_environment,
                self.settings.cache_schema_version,
                *encoded,
            ]
        )

    @staticmethod
    def digest(value: Any) -> str:
        normalized = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def access_scope(self, authorization: str | None) -> str:
        """Separate cached responses without storing a bearer token in Redis keys."""
        if not authorization:
            return "anonymous"
        return f"auth-{hashlib.sha256(authorization.encode('utf-8')).hexdigest()[:20]}"

    def get_json(self, key: str) -> CacheLookup:
        if not self._can_attempt():
            return CacheLookup(None, "BYPASS")
        try:
            raw = self._client.get(key)
        except RedisError as exc:
            self._increment_stat("errors")
            self._mark_unavailable()
            logger.warning("cache read failed; using source of truth: %s", exc)
            return CacheLookup(None, "ERROR")
        if raw is None:
            self._increment_stat("misses")
            return CacheLookup(None, "MISS")
        try:
            value = json.loads(raw)
            self._increment_stat("hits")
            return CacheLookup(value, "HIT")
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            self._increment_stat("errors")
            self.delete(key)
            logger.warning("invalid cached JSON removed; using source of truth: %s", exc)
            return CacheLookup(None, "ERROR")

    def get_json_text(self, key: str) -> CacheLookup:
        """Return validated JSON text so FastAPI can avoid rebuilding large cached models."""
        if not self._can_attempt():
            return CacheLookup(None, "BYPASS")
        try:
            raw = self._client.get(key)
        except RedisError as exc:
            self._increment_stat("errors")
            self._mark_unavailable()
            logger.warning("cache text read failed; using source of truth: %s", exc)
            return CacheLookup(None, "ERROR")
        if raw is None:
            self._increment_stat("misses")
            return CacheLookup(None, "MISS")
        try:
            json.loads(raw)
            self._increment_stat("hits")
            return CacheLookup(raw, "HIT")
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            self._increment_stat("errors")
            self.delete(key)
            logger.warning("invalid cached JSON removed; using source of truth: %s", exc)
            return CacheLookup(None, "ERROR")

    def set_json(self, key: str, value: Any, ttl_seconds: int) -> bool:
        if not self._can_attempt():
            return False
        try:
            payload = json.dumps(value, separators=(",", ":"), ensure_ascii=True, default=str)
        except (TypeError, ValueError) as exc:
            self._increment_stat("errors")
            logger.warning("cache serialization failed; response remains valid: %s", exc)
            return False
        try:
            self._client.setex(key, max(1, int(ttl_seconds)), payload)
            self._increment_stat("writes")
            return True
        except RedisError as exc:
            self._increment_stat("errors")
            self._mark_unavailable()
            logger.warning("cache write failed; response remains valid: %s", exc)
            return False

    def delete(self, key: str) -> None:
        if not self._can_attempt():
            return
        try:
            self._client.delete(key)
        except RedisError as exc:
            self._increment_stat("errors")
            self._mark_unavailable()
            logger.warning("cache delete failed; bounded TTL remains the fallback: %s", exc)

    def get_version(self, scope: str) -> int:
        if not self._can_attempt():
            return 0
        try:
            raw = self._client.get(self.key("version", scope))
        except RedisError as exc:
            self._increment_stat("errors")
            self._mark_unavailable()
            logger.warning("cache version read failed; cache will be bypassed on lookup failure: %s", exc)
            return 0
        try:
            return int(raw) if raw is not None else 0
        except (TypeError, ValueError):
            self._increment_stat("errors")
            self.delete(self.key("version", scope))
            return 0

    def increment_version(self, scope: str) -> int | None:
        if not self._can_attempt():
            return None
        try:
            value = int(self._client.incr(self.key("version", scope)))
            self._increment_stat("invalidations")
            return value
        except RedisError as exc:
            self._increment_stat("errors")
            self._mark_unavailable()
            logger.warning("cache invalidation failed; bounded TTL remains the fallback: %s", exc)
            return None

    def health(self) -> dict[str, Any]:
        if not self.enabled or self._client is None:
            return {"status": "disabled", "enabled": False, **self.stats()}
        if not self._can_attempt():
            return {"status": "degraded", "enabled": True, "detail": "circuit open", **self.stats()}
        try:
            self._client.ping()
            return {"status": "ok", "enabled": True, **self.stats()}
        except RedisError as exc:
            self._increment_stat("errors")
            self._mark_unavailable()
            return {"status": "degraded", "enabled": True, "detail": str(exc), **self.stats()}

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)

    def _increment_stat(self, name: str) -> None:
        with self._lock:
            self._stats[name] += 1

    def _can_attempt(self) -> bool:
        return bool(
            self.enabled
            and self._client is not None
            and time.monotonic() >= self._unavailable_until
        )

    def _mark_unavailable(self) -> None:
        self._unavailable_until = time.monotonic() + self.settings.cache_failure_cooldown_seconds


_cache_store: CacheStore | None = None
_cache_store_lock = Lock()


def get_cache_store() -> CacheStore:
    global _cache_store
    if _cache_store is None:
        with _cache_store_lock:
            if _cache_store is None:
                _cache_store = CacheStore(get_settings())
    return _cache_store


def invalidate_for_event(
    event_type: str,
    borehole_id: int | None,
    entity: str,
    cache: CacheStore | None = None,
) -> None:
    cache = cache or get_cache_store()
    if borehole_id is not None:
        cache.increment_version(f"borehole:{borehole_id}:data")
        if _event_touches_curves(event_type, entity):
            cache.increment_version(f"borehole:{borehole_id}:curves")

    if entity in {"borehole", "source_file", "field_submission"} or "mobile" in event_type:
        cache.increment_version("borehole-list")
    if entity == "quality_settings":
        cache.increment_version("quality-settings")
    if entity == "import_profile":
        cache.increment_version("import-profiles")
    if entity == "export_profile":
        cache.increment_version("export-profiles")
    if entity == "correlation_observation":
        cache.increment_version("correlation-observations")


def _event_touches_curves(event_type: str, entity: str) -> bool:
    return (
        entity in {"curve", "curve_sample", "source_file"}
        or "curve" in event_type
        or "source_file" in event_type
        or "import" in event_type
    )

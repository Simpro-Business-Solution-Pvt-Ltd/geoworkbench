from app.core.cache import CacheStore, RedisError, invalidate_for_event
from app.core.config import Settings


class FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}
        self.ttls: dict[str, int] = {}

    def get(self, key: str):
        return self.values.get(key)

    def setex(self, key: str, ttl: int, value: str) -> None:
        self.values[key] = value
        self.ttls[key] = ttl

    def incr(self, key: str) -> int:
        value = int(self.values.get(key, "0")) + 1
        self.values[key] = str(value)
        return value

    def delete(self, key: str) -> None:
        self.values.pop(key, None)
        self.ttls.pop(key, None)

    def ping(self) -> bool:
        return True


class FailingRedis(FakeRedis):
    def get(self, key: str):
        raise RedisError("test Redis outage")


def enabled_store() -> tuple[CacheStore, FakeRedis]:
    client = FakeRedis()
    settings = Settings(
        cache_enabled=True,
        redis_url="redis://test/0",
        cache_environment="test",
        _env_file=None,
    )
    return CacheStore(settings, client=client), client


def test_cache_json_miss_write_and_hit() -> None:
    store, client = enabled_store()
    key = store.key("workbench", 12, "default", 3)

    assert store.get_json(key).status == "MISS"
    assert store.set_json(key, {"id": 12}, 60)
    lookup = store.get_json(key)

    assert lookup.status == "HIT"
    assert lookup.value == {"id": 12}
    assert client.ttls[key] == 60

    text_lookup = store.get_json_text(key)
    assert text_lookup.status == "HIT"
    assert text_lookup.value == '{"id":12}'


def test_cache_versions_are_namespaced_and_incremented() -> None:
    store, _ = enabled_store()

    assert store.get_version("borehole:12:data") == 0
    assert store.increment_version("borehole:12:data") == 1
    assert store.increment_version("borehole:12:data") == 2
    assert store.get_version("borehole:12:data") == 2
    assert store.key("version", "borehole:12:data").startswith("geoworkbench:test:v1:")


def test_malformed_json_is_an_error_not_a_hit() -> None:
    store, client = enabled_store()
    key = store.key("borehole-list", 0)
    client.values[key] = "not-json"

    lookup = store.get_json(key)

    assert lookup.value is None
    assert lookup.status == "ERROR"
    assert store.stats()["errors"] == 1
    assert key not in client.values


def test_cache_digest_is_stable_for_mapping_order() -> None:
    store, _ = enabled_store()

    assert store.digest({"a": 1, "b": [2]}) == store.digest({"b": [2], "a": 1})


def test_access_scope_separates_sessions_without_exposing_tokens() -> None:
    store, _ = enabled_store()
    first = store.access_scope("Bearer secret-token-one")
    second = store.access_scope("Bearer secret-token-two")

    assert first != second
    assert "secret-token" not in first
    assert store.access_scope(None) == "anonymous"


def test_disabled_cache_bypasses_without_client() -> None:
    settings = Settings(cache_enabled=False, redis_url=None, _env_file=None)
    store = CacheStore(settings)

    assert store.get_json(store.key("workbench", 12)).status == "BYPASS"
    assert not store.set_json("unused", {"id": 12}, 60)
    assert store.get_version("borehole:12:data") == 0


def test_redis_failure_opens_circuit_and_prevents_repeat_attempts() -> None:
    settings = Settings(
        cache_enabled=True,
        redis_url="redis://test/0",
        cache_environment="test",
        cache_failure_cooldown_seconds=30,
        _env_file=None,
    )
    store = CacheStore(settings, client=FailingRedis())

    assert store.get_json("test-key").status == "ERROR"
    assert store.get_json("test-key").status == "BYPASS"
    assert not store.set_json("test-key", {"id": 12}, 60)
    assert store.stats()["errors"] == 1


def test_interval_event_invalidates_derived_borehole_data() -> None:
    store, _ = enabled_store()

    invalidate_for_event("workbench.interval.updated", 12, "lithology_interval", store)

    assert store.get_version("borehole:12:data") == 1
    assert store.get_version("borehole:12:curves") == 0


def test_source_file_event_invalidates_list_data_and_curves() -> None:
    store, _ = enabled_store()

    invalidate_for_event("workbench.source_file.merged", 12, "source_file", store)

    assert store.get_version("borehole:12:data") == 1
    assert store.get_version("borehole:12:curves") == 1
    assert store.get_version("borehole-list") == 1


def test_quality_event_invalidates_quality_version() -> None:
    store, _ = enabled_store()

    invalidate_for_event("workbench.quality_settings.updated", None, "quality_settings", store)

    assert store.get_version("quality-settings") == 1

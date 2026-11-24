# GeoWorkbench Backend

FastAPI backend for the Phase 1 borehole correction system.

## Local Run

```powershell
cd backend
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -e .
alembic upgrade head
python scripts\\seed_demo.py
uvicorn app.main:app --reload --port 8081
```

Useful endpoints:

- `GET http://127.0.0.1:8081/health`
- `GET http://127.0.0.1:8081/api/boreholes`
- `GET http://127.0.0.1:8081/api/boreholes/1/workbench`

## Optional Redis Cache

Redis accelerates the borehole list, workbench aggregate, curve sample windows,
and AI summaries. It also distributes realtime refresh events between API
instances. The cache is fail-open: if Redis is disabled or unavailable, the API
continues to use PostgreSQL and reports `X-GeoWorkbench-Cache: BYPASS` or `ERROR`.

```powershell
$env:GEOWORKBENCH_REDIS_URL = "redis://127.0.0.1:6379/0"
$env:GEOWORKBENCH_CACHE_ENABLED = "true"
$env:GEOWORKBENCH_REALTIME_REDIS_ENABLED = "true"
```

Repeat a cacheable request and inspect `X-GeoWorkbench-Cache`: the first response
should be `MISS` and the next identical request should be `HIT`. The diagnostics
endpoint includes cache health and in-process hit/miss/error counters. See
`docs/caching-implementation-and-verification-guide.md` for the complete test
runbook.

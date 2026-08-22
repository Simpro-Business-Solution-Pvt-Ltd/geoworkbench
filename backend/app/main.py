import logging
import time
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.core.config import get_settings
from app.db.init_db import init_db
from app.db.session import engine
from app.domains.boreholes.router import router as borehole_router
from app.domains.ai.router import router as ai_router
from app.domains.auth.router import router as auth_router
from app.domains.correlation.router import router as correlation_router
from app.domains.exports.router import router as exports_router
from app.domains.imports.router import router as imports_router
from app.domains.mobile.router import router as mobile_router
from app.domains.quality.router import router as quality_router
from app.domains.realtime.router import router as realtime_router
from app.domains.validation.router import router as validation_router


settings = get_settings()
logger = logging.getLogger("geoworkbench.api")
init_db()
app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/assets/corebox", StaticFiles(directory=settings.repo_root / "MTSE-65(PBH 62)"), name="corebox")
app.include_router(borehole_router, prefix=f"{settings.api_prefix}/boreholes", tags=["boreholes"])
app.include_router(ai_router, prefix=f"{settings.api_prefix}/ai", tags=["ai"])
app.include_router(auth_router, prefix=f"{settings.api_prefix}/auth", tags=["auth"])
app.include_router(correlation_router, prefix=f"{settings.api_prefix}/correlation", tags=["correlation"])
app.include_router(exports_router, prefix=f"{settings.api_prefix}/exports", tags=["exports"])
app.include_router(imports_router, prefix=f"{settings.api_prefix}/imports", tags=["imports"])
app.include_router(mobile_router, prefix=f"{settings.api_prefix}/mobile", tags=["mobile"])
app.include_router(quality_router, prefix=f"{settings.api_prefix}/quality-settings", tags=["quality-settings"])
app.include_router(realtime_router, prefix=f"{settings.api_prefix}/realtime", tags=["realtime"])
app.include_router(validation_router, prefix=f"{settings.api_prefix}/validation", tags=["validation"])


@app.middleware("http")
async def request_timing(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    response.headers["X-GeoWorkbench-Request-Ms"] = str(elapsed_ms)
    logger.info(
        "request method=%s path=%s status=%s elapsed_ms=%s",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get(f"{settings.api_prefix}/diagnostics/health")
def diagnostics_health() -> dict:
    database = "ok"
    database_detail = "select 1"
    try:
        with engine.connect() as connection:
            connection.execute(text("select 1"))
    except Exception as exc:  # pragma: no cover - defensive diagnostics path
        database = "error"
        database_detail = str(exc)
    return {
        "status": "ok" if database == "ok" else "degraded",
        "service": settings.app_name,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "database": {"status": database, "detail": database_detail},
        "ai": {"provider": settings.ai_provider, "model": settings.ai_model},
        "uploads": str(settings.upload_root),
        "exports": str(settings.export_root),
        "observability": {
            "request_timing_header": "X-GeoWorkbench-Request-Ms",
            "otel_ready": True,
        },
    }

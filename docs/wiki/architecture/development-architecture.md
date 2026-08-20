# Development Architecture

## Local Development

The first production system is split into:

- `backend/` - FastAPI API, domain services, database models, seed/import scripts.
- `frontend/` - React/TypeScript workbench.
- `docker-compose.dev.yml` - shared dependencies for PostgreSQL, Redis, and object storage.
- `sample-data/` - current PBH-62 normalized seed data.

The app can run with SQLite for fastest local setup, while Docker Compose is only a local development convenience for shared services.

Production should not depend on Docker Compose. Production profiles should use directly installed or managed services:

- PostgreSQL installed directly or managed by the customer/cloud.
- IIS or Nginx as the front door.
- FastAPI running as a managed service.
- Background workers running as managed services.
- Shared file storage or object storage for uploads, images, and exports.

Supported production profiles:

- Windows VM + IIS + Windows Services.
- Linux VM + Nginx + systemd services.
- Kubernetes can be considered later, but it is not the default target.

## Database Migrations

Database schema changes are managed by Alembic from `backend/alembic/`.

Local setup:

```powershell
cd backend
alembic upgrade head
python scripts\seed_demo.py
```

Rules:

- Do not rely on FastAPI startup to create tables.
- Every schema change should have an Alembic migration.
- Seed scripts may insert demo data, but they should not define schema.
- Production/server deployment must run migrations before starting the API.

## Local Upload Storage

Source file uploads are stored under:

```text
runtime-data/uploads/
```

This folder is ignored by git. In production, configure:

```text
GEOWORKBENCH_UPLOAD_ROOT=D:/GeoWorkbench/data/uploads
```

or an equivalent durable storage path. Later deployments may replace local storage with object storage while keeping the `source_files` database contract.

## AI Integration Direction

Phase 1 should use controlled task-based AI, not autonomous agents.

Provider abstraction should later support:

- disabled/no-AI mode
- local LLM through Ollama/vLLM-compatible APIs
- OpenAI-compatible APIs
- Anthropic-compatible APIs

The assistant should read data, summarize, explain, and create suggestions. It should never apply final geological corrections without geologist approval.

Current local AI configuration uses an OpenAI-compatible endpoint:

```text
GEOWORKBENCH_AI_PROVIDER=local_openai
GEOWORKBENCH_AI_BASE_URL=http://192.168.1.23:1234/v1
GEOWORKBENCH_AI_MODEL=google/gemma-4-12b-qat
```

The deterministic rule engine remains the source of validation findings and suggested patches. The local model is used only to turn those rule findings into clearer, actionable review notes for the geologist.

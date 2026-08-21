# Production Deployment Overview

GeoWorkbench should support non-container production deployments.

Docker Compose may be useful for local development, but production should use directly installed or managed infrastructure unless the customer later chooses Kubernetes.

## Recommended Production Shape

```text
Users
  -> IIS or Nginx reverse proxy
  -> Frontend static build
  -> FastAPI backend service
  -> Background worker service
  -> PostgreSQL
  -> Redis or queue service
  -> Shared file/object storage
```

## Principles

- PostgreSQL should be installed directly, hosted on a separate DB VM, or provided as a managed database.
- MinIO can be used as the local or self-hosted S3-compatible object store; keep it internal and access it through the backend.
- The API should be stateless so multiple app servers can be added later.
- Uploads, core images, source files, and exports should be stored in shared storage, not only local app-server disk.
- Background workers should process imports, AI jobs, OCR, and exports outside API request threads.
- Migrations must run before the API starts after a release.
- Backups must cover both PostgreSQL and uploaded file/object storage.

## Evaluation Deployment Position

For the Reliance evaluation server, the preferred first deployment is:

- IIS HTTPS reverse proxy.
- FastAPI bound to `127.0.0.1:8081` as a Windows Service.
- External PostgreSQL configured through `GEOWORKBENCH_DATABASE_URL`.
- Durable upload/export storage outside the repository checkout.
- Local AI endpoint configured through environment variables.
- UAT smoke evidence captured after each refresh.

Container runtime such as Podman may be used later for MinIO or auxiliary services. The main application does not require a container route for the first UAT deployment.

## Supported Profiles

- Windows VM + IIS + Windows Services.
- Linux VM + Nginx + systemd services.

Kubernetes is a future option, not required for the first production or pilot deployment.

## High Availability Direction

A future HA deployment can use:

```text
Load Balancer
  -> App VM 1: IIS/Nginx + API service
  -> App VM 2: IIS/Nginx + API service
  -> Worker VM(s)
  -> PostgreSQL primary/standby or managed PostgreSQL
  -> Redis/queue service
  -> Shared file/object storage
```

Requirements for HA:

- No in-process session state.
- Shared storage for uploads/images/exports.
- Database-backed audit/history.
- Queue-backed background processing.
- Scheduled jobs protected by locks or isolated to one scheduler.

## Related Local Profiles

- `docs/wiki/deployment/local-postgres.md`
- `docs/wiki/deployment/local-minio.md`

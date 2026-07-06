# Local MinIO Object Storage

Use MinIO as the local S3-compatible object store for corebox images, generated rock-lane images, thumbnails, imports, and exports.

This profile keeps PostgreSQL external or directly installed, while MinIO runs in a container.

## Run With Podman

From the repository root:

```powershell
podman compose -f docker-compose.dev.yml up -d minio minio-init
```

If your machine uses `podman-compose` instead:

```powershell
podman-compose -f docker-compose.dev.yml up -d minio minio-init
```

The compose file starts:

- MinIO S3 API: `http://127.0.0.1:9000`
- MinIO console: `http://127.0.0.1:9001`
- Bucket: `geoworkbench`

Default local credentials:

```text
MINIO_ROOT_USER=geoworkbench
MINIO_ROOT_PASSWORD=geoworkbench123
```

Override these with environment variables before starting the container for shared environments.

## Backend Environment

Use these settings with an external PostgreSQL database:

```text
GEOWORKBENCH_DATABASE_URL=postgresql+psycopg://user:password@db-server:5432/geoworkbench
GEOWORKBENCH_OBJECT_STORAGE_PROVIDER=s3
GEOWORKBENCH_S3_ENDPOINT_URL=http://127.0.0.1:9000
GEOWORKBENCH_S3_BUCKET=geoworkbench
GEOWORKBENCH_S3_REGION=us-east-1
GEOWORKBENCH_S3_ACCESS_KEY=geoworkbench
GEOWORKBENCH_S3_SECRET_KEY=geoworkbench123
GEOWORKBENCH_S3_FORCE_PATH_STYLE=true
GEOWORKBENCH_S3_URL_MODE=proxy
```

For server deployments behind IIS, keep MinIO internal. The frontend should use backend asset URLs, not MinIO credentials.

## Object Key Convention

Use stable keys so DB metadata can reference assets without caring where MinIO runs:

```text
corebox/PBH-62/original/001.jpg
corebox/PBH-62/rock-lane/master/001.jpg
corebox/PBH-62/rock-lane/preview/001.jpg
corebox/PBH-62/thumbnail/001.jpg
```

## IIS Direction

Recommended request flow:

```text
Browser
  -> IIS HTTPS
    -> /api/assets/... to FastAPI
      -> MinIO internal S3 API
```

Avoid exposing the MinIO console publicly. If direct/presigned object URLs are used later, configure the public endpoint carefully so signatures match the hostname seen by the browser.

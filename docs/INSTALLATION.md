# Install PalCenter

PalCenter runs as one container and stores all persistent application data in
`/app/data`. It connects outward to existing Palworld REST APIs.

## Before you begin

You need:

- Docker Engine and the Docker Compose plugin;
- a persistent Docker volume or writable bind-mount directory;
- an unused host port for the web interface (default `3000`);
- network reachability from the container to each Palworld REST API.

Do not mount the Docker socket, Palworld saves, or SteamCMD directories.

## Docker Compose installation

Create an empty directory and save these two files in it.

`docker-compose.yml`:

```yaml
services:
  palcenter:
    image: ${PALCENTER_IMAGE:-ghcr.io/shanebionic/palcenter:latest}
    container_name: palcenter
    user: "${PALCENTER_UID:-1000}:${PALCENTER_GID:-1000}"
    init: true
    restart: unless-stopped
    ports:
      - "${PALCENTER_WEB_PORT:-3000}:3000"
      - "127.0.0.1:${PALCENTER_API_PORT:-3001}:3001"
    environment:
      WEB_PORT: 3000
      API_PORT: 3001
      CONFIG_DIR: /app/data
      HISTORY_INTERVAL_SECONDS: ${PALCENTER_HISTORY_INTERVAL_SECONDS:-30}
      TELEMETRY_INTERVAL_SECONDS: ${PALCENTER_TELEMETRY_INTERVAL_SECONDS:-30}
      TELEMETRY_RETENTION_DAYS: ${PALCENTER_TELEMETRY_RETENTION_DAYS:-30}
      AUTOMATION_INTERVAL_SECONDS: ${PALCENTER_AUTOMATION_INTERVAL_SECONDS:-15}
      PALCENTER_SESSION_DURATION_SECONDS: ${PALCENTER_SESSION_DURATION_SECONDS:-43200}
      PALCENTER_SESSION_COOKIE_SECURE: ${PALCENTER_SESSION_COOKIE_SECURE:-false}
      PALCENTER_CORS_ORIGINS: ${PALCENTER_CORS_ORIGINS:-}
      PALCENTER_TRUST_PROXY: ${PALCENTER_TRUST_PROXY:-false}
      LOG_LEVEL: ${PALCENTER_LOG_LEVEL:-info}
      PALCENTER_BACKUP_MAX_BYTES: ${PALCENTER_BACKUP_MAX_BYTES:-536870912}
    volumes:
      - palcenter-data:/app/data
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true

volumes:
  palcenter-data:
```

`.env`:

```dotenv
PALCENTER_IMAGE=ghcr.io/shanebionic/palcenter:latest
PALCENTER_UID=1000
PALCENTER_GID=1000
PALCENTER_WEB_PORT=3000
PALCENTER_API_PORT=3001
PALCENTER_SESSION_COOKIE_SECURE=false
PALCENTER_CORS_ORIGINS=
PALCENTER_TRUST_PROXY=false
PALCENTER_SESSION_DURATION_SECONDS=43200
PALCENTER_HISTORY_INTERVAL_SECONDS=30
PALCENTER_TELEMETRY_INTERVAL_SECONDS=30
PALCENTER_TELEMETRY_RETENTION_DAYS=30
PALCENTER_AUTOMATION_INTERVAL_SECONDS=15
PALCENTER_LOG_LEVEL=info
PALCENTER_BACKUP_MAX_BYTES=536870912
```

Start the service:

```bash
docker compose pull
docker compose up -d
docker compose ps
```

Open `http://DOCKER-HOST:3000`.

The example binds the direct API to host loopback. The web container proxies
browser `/api` requests internally, so normal users need only port `3000`.

## Persistent storage

The named volume is the simplest deployment. To use a bind mount, replace:

```yaml
- palcenter-data:/app/data
```

with:

```yaml
- /srv/palcenter/data:/app/data
```

The host directory must already be readable and writable by the configured
UID/GID. PalCenter remains non-root and does not `chmod` or `chown` mounted
storage.

## Environment variables

The Compose example above supports:

| Variable                                |                                Default | Purpose                                                                     |
| --------------------------------------- | -------------------------------------: | --------------------------------------------------------------------------- |
| `PALCENTER_IMAGE`                       | `ghcr.io/shanebionic/palcenter:latest` | Image or release tag                                                        |
| `PALCENTER_UID` / `PALCENTER_GID`       |                        `1000` / `1000` | Non-root runtime identity                                                   |
| `PALCENTER_WEB_PORT`                    |                                 `3000` | Host web-interface port                                                     |
| `PALCENTER_API_PORT`                    |                                 `3001` | Host direct-API port                                                        |
| `PALCENTER_SESSION_COOKIE_SECURE`       |                                `false` | Set `true` when users access PalCenter only through HTTPS                   |
| `PALCENTER_CORS_ORIGINS`                |                                  empty | Comma-separated origins allowed to call port `3001` directly                |
| `PALCENTER_TRUST_PROXY`                 |                                `false` | Trust proxy forwarding information; use only behind a trusted reverse proxy |
| `PALCENTER_SESSION_DURATION_SECONDS`    |                                `43200` | Login session duration, 300–604800 seconds                                  |
| `PALCENTER_HISTORY_INTERVAL_SECONDS`    |                                   `30` | Server metrics/event polling interval, minimum 5 seconds                    |
| `PALCENTER_TELEMETRY_INTERVAL_SECONDS`  |                                   `30` | Player telemetry polling interval, minimum 5 seconds                        |
| `PALCENTER_TELEMETRY_RETENTION_DAYS`    |                                   `30` | Raw telemetry retention, 1–3650 days                                        |
| `PALCENTER_AUTOMATION_INTERVAL_SECONDS` |                                   `15` | Scheduler due-task polling interval, minimum 5 seconds                      |
| `PALCENTER_LOG_LEVEL`                   |                                 `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`             |
| `PALCENTER_BACKUP_MAX_BYTES`            |                            `536870912` | Maximum restore upload, 1 MiB–1 GiB                                         |

`PALCENTER_SESSION_SECRET` is an optional one-time migration input for older
installations. New installations generate and persist their own secret in
`/app/data/system.json`; they should not add a password or default account to
the environment.

## Configure the Palworld REST API

On each Palworld dedicated server:

1. Set a strong `AdminPassword`.
2. Enable the REST API (`RESTAPIEnabled=True`).
3. Choose the REST port (`RESTAPIPort`, commonly `8212`).
4. Restart the Palworld server after changing its configuration.
5. Allow the PalCenter host/container to reach that port.

Use a REST URL such as:

```text
http://192.0.2.25:8212
```

Use the Palworld host address from the container's point of view. `localhost`
inside PalCenter refers to the PalCenter container, not another host or
container.

The official Palworld REST API commonly uses HTTP. Keep it on a trusted private
network or provide a TLS-capable trusted path.

## First startup

Watch startup:

```bash
docker compose logs -f palcenter
```

A healthy response is available from the API:

```bash
curl http://127.0.0.1:3001/api/health
```

Expected fields include `"status":"ok"` and `"storage":"ready"`. Then follow
the [first-run guide](FIRST-RUN.md).

## Common startup problems

| Symptom                      | Check                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| Container exits immediately  | `docker compose logs palcenter`; verify `/app/data` ownership and environment values |
| Port already allocated       | Change `PALCENTER_WEB_PORT` or `PALCENTER_API_PORT`                                  |
| Health is degraded           | Confirm every required file/database in `/app/data` is readable and writable         |
| Browser cannot connect       | Confirm the container is running and host firewall permits the web port              |
| Server test says unreachable | Use the Palworld host's LAN/DNS address, enable REST, and allow its REST port        |
| Authentication rejected      | Confirm the Palworld `AdminPassword`; this is separate from PalCenter user passwords |

See [Troubleshooting](TROUBLESHOOTING.md) for detailed checks.

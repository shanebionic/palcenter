# PalCenter

PalCenter is a web-based management console for remote Palworld dedicated
servers. It connects to existing servers through the official Palworld REST API.

PalCenter does not install, host, update, or control Palworld containers. It does
not need access to Palworld save files or the filesystem of a Palworld host.

## Docker Compose deployment

Requirements:

- Docker Engine with Docker Compose
- Network access from the PalCenter host to each Palworld REST API
- Palworld REST API enabled on each managed server

Create a directory for the deployment and save
[`docker-compose.yml`](./docker-compose.yml) in it. Then run:

```sh
docker compose up -d
```

Open `http://<palcenter-host>:3000` in a browser. The API is also available on
port `3001`; for example:

```sh
curl http://<palcenter-host>:3001/api/health
```

Compose pulls `ghcr.io/shanebionic/palcenter:latest` by default. To deploy a
specific image tag:

```sh
PALCENTER_IMAGE=ghcr.io/shanebionic/palcenter:<version> docker compose up -d
```

On PowerShell:

```powershell
$env:PALCENTER_IMAGE = "ghcr.io/shanebionic/palcenter:<version>"
docker compose up -d
```

Official images support `linux/amd64` and `linux/arm64`. Available tags are:

- `latest` — the most recently published release
- `vX.Y.Z` — an immutable release version, such as `v1.0.0`

Pull an image directly with:

```sh
docker pull ghcr.io/shanebionic/palcenter:latest
docker pull ghcr.io/shanebionic/palcenter:v1.0.0
```

## Persistent data

The Compose deployment stores PalCenter data in the named volume
`palcenter-data`. The `/app/data` directory contains:

- `servers.json` — remote Palworld connection configuration
- `notifications.json` — notification provider configuration
- `history.sqlite` — historical metrics and server events

These files survive container replacement and image upgrades. Do not run
`docker compose down --volumes` unless you intentionally want to delete all
PalCenter data.

To verify the deployment volume, add a server and a notification provider in
PalCenter, allow at least one history sample to be collected, and recreate the
container without deleting the volume:

```sh
docker compose up -d --force-recreate
docker compose exec palcenter sh -c \
  'test -s /app/data/servers.json &&
   test -s /app/data/notifications.json &&
   test -s /app/data/history.sqlite'
```

Reload PalCenter and confirm the server, notification provider, and monitoring
history remain available.

To use a host directory instead of the named volume, replace the volume mapping
with:

```yaml
volumes:
  - ./data:/app/data
```

On Linux, ensure UID `1000` can write to that directory:

```sh
mkdir -p data
sudo chown 1000:1000 data
chmod 700 data
```

The data directory contains Palworld admin passwords and notification
credentials. Restrict filesystem access, include the directory in your backup
plan, and never publish its contents.

## Environment variables

| Variable                             | Default                                | Purpose                                           |
| ------------------------------------ | -------------------------------------- | ------------------------------------------------- |
| `PALCENTER_IMAGE`                    | `ghcr.io/shanebionic/palcenter:latest` | Compose image tag                                 |
| `PALCENTER_WEB_PORT`                 | `3000`                                 | Frontend host port used by Compose                |
| `PALCENTER_API_PORT`                 | `3001`                                 | API host port used by Compose                     |
| `PALCENTER_HISTORY_INTERVAL_SECONDS` | `30`                                   | Historical sampling interval; minimum 5 seconds   |
| `WEB_PORT`                           | `3000`                                 | Frontend port when running the image directly     |
| `API_PORT`                           | `3001`                                 | API port when running the image directly          |
| `CONFIG_DIR`                         | `/app/data`                            | Persistent data directory inside the container    |
| `HISTORY_INTERVAL_SECONDS`           | `30`                                   | Historical sampling interval inside the container |

Example with alternate host ports:

```sh
PALCENTER_WEB_PORT=8080 PALCENTER_API_PORT=8081 docker compose up -d
```

Then open `http://<palcenter-host>:8080`.

## Connecting remote Palworld servers

In PalCenter, select **Add Server** and enter:

- A display name
- The remote REST URL, including the REST port
- The Palworld administrator password

Example REST URL:

```text
http://10.10.10.45:8212
```

The address must be reachable from the PalCenter container. When Palworld runs
on another host, use that host's LAN address or DNS name—not `localhost`.

No Palworld directories, save files, SteamCMD installation, or Docker socket
mounts should be added to the PalCenter container.

## Image build

Build the production image from the repository root:

```sh
docker build -t ghcr.io/shanebionic/palcenter:local .
```

Run it directly:

```sh
docker run -d \
  --name palcenter \
  -p 3000:3000 \
  -p 3001:3001 \
  -v palcenter-data:/app/data \
  ghcr.io/shanebionic/palcenter:local
```

The image uses Node.js 22 (22.13 or newer), runs as the unprivileged `node` user,
contains only production runtime dependencies, and starts both the frontend and
API.

## Local development

PalCenter requires Node.js 22.13 or newer and pnpm 9.

```sh
pnpm install
pnpm dev
```

The frontend runs at `http://localhost:3000` and proxies `/api` requests to the
API at `http://localhost:3001`.

Useful validation commands:

```sh
pnpm check-types
pnpm lint
pnpm build
```

## Creating a release

GitHub Actions validates every pull request and branch push by installing locked
dependencies, running TypeScript checks and linting, and creating production
builds. A separate workflow also builds the production Dockerfile for
`linux/amd64` and `linux/arm64` without publishing it.

PalCenter releases use semantic version tags prefixed with `v`. Before creating a
release, ensure the intended commit is on `main` and its GitHub Actions checks
have passed. Then create and push the tag:

```sh
git switch main
git pull --ff-only
git tag -a v1.0.0 -m "PalCenter v1.0.0"
git push origin v1.0.0
```

Pushing the tag runs validation again. If validation succeeds, GitHub Actions:

1. Builds the existing production Dockerfile for `linux/amd64` and
   `linux/arm64`.
2. Authenticates to GHCR with the workflow's short-lived `GITHUB_TOKEN`.
3. Publishes `ghcr.io/shanebionic/palcenter:v1.0.0`.
4. Updates `ghcr.io/shanebionic/palcenter:latest` to the same image.
5. Creates the matching GitHub release with generated release notes, or updates
   it if it already exists.

No registry password or personal access token is stored in the repository.
Repository Actions settings must allow GitHub Actions and grant workflows
read/write permissions so the release job can publish packages and releases.

# Deploy PalCenter on Unraid

PalCenter manages remote Palworld servers through their REST APIs. Do not map
Palworld saves, SteamCMD directories, or the Docker socket into this container.

## Container configuration

Use the image `ghcr.io/shanebionic/palcenter:v1.1.0` or a newer release.

| Unraid setting   | Container value | Recommended host value                       |
| ---------------- | --------------- | -------------------------------------------- |
| Web UI port      | `3000/tcp`      | `3000`, or another available port            |
| API port         | `3001/tcp`      | `3001`, restricted to the management network |
| Persistent data  | `/app/data`     | `/mnt/user/appdata/palcenter`                |
| Container user   | `99:100`        | Unraid `nobody:users`                        |

Set the container's **Extra Parameters** to:

```text
--user=99:100
```

This selects Unraid's standard non-root `nobody:users` identity before
PalCenter starts. It does not grant root access, add capabilities, or change
ownership inside the container.

For Docker Compose on Unraid, create a `.env` file beside
`docker-compose.yml`:

```env
PALCENTER_UID=99
PALCENTER_GID=100
```

No environment variables are required for a standard installation. Optional
runtime settings are listed in the main [README](../README.md). Set
`PALCENTER_SESSION_COOKIE_SECURE=true` only when users reach PalCenter through
an HTTPS reverse proxy.

Map an existing Unraid appdata directory as read/write:

```sh
mkdir -p /mnt/user/appdata/palcenter
```

No runtime `chmod` or `chown` workaround is required. The container remains
non-root and verifies that the mapping is writable. If Unraid does not allow
permission tightening, PalCenter logs a warning and uses the host-managed
permissions. If the mapping is not writable by UID `99` and GID `100`,
PalCenter stops with an error instead of weakening its security model. Do not
expose the appdata share publicly.

## First start

Start the container, open `http://<unraid-host>:<web-port>`, and create the
initial Administrator. There is no default account and no session secret to
generate. PalCenter creates `system.json` in the persistent mapping.

The Unraid host and container must be able to reach each Palworld REST URL.
Use the Palworld host's LAN address or DNS name, not `localhost`.

## Backup

Use PalCenter's authenticated **Backup** page for portable backups. Archives
contain credentials and password hashes, so store them in encrypted,
access-controlled storage.

For a cold Unraid backup, stop the container and copy the complete
`/mnt/user/appdata/palcenter` directory. Never copy only a live SQLite file.

## Upgrade

1. Download a current backup from PalCenter.
2. Record the currently deployed image tag.
3. Change the repository tag to the desired `vX.Y.Z` release.
4. Confirm the container still uses `--user=99:100`.
5. Pull the image and recreate the container without deleting the appdata
   directory.
6. Confirm the health check, login, servers, notifications, and history.

Container recreation and upgrades preserve users, configuration, metrics,
events, and the internal signing secret through `/app/data`.

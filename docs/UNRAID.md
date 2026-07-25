# Deploy PalCenter on Unraid

PalCenter manages remote Palworld servers through their REST APIs. Do not map
Palworld saves, SteamCMD directories, or the Docker socket into this container.

## Install from Community Applications

The official PalCenter template in Unraid Community Applications is the
recommended installation method:

1. Open the Unraid Web UI.
2. Navigate to **Apps → Community Applications**.
3. Search for **PalCenter**.
4. Select and install PalCenter.
5. Review the application settings.
6. Start the container.
7. Open `http://<unraid-ip>:3000`.

The official template supplies these defaults:

| Unraid setting  | Container value | Recommended host value            |
| --------------- | --------------- | --------------------------------- |
| Web UI port     | `3000/tcp`      | `3000`, or another available port |
| API port        | `3001/tcp`      | Advanced/optional use only        |
| Persistent data | `/app/data`     | `/mnt/user/appdata/palcenter`     |
| Container user  | `99:100`        | Unraid `nobody:users`             |

The web interface is available at `http://<unraid-ip>:3000`. Direct API access
on port `3001` is not required for normal use. If you publish it, restrict it
to a trusted management network.

The template selects Unraid's standard non-root `nobody:users` identity before
PalCenter starts. It does not grant root access, add capabilities, or change
ownership inside the container. Users installing through Community
Applications should not need to run `chmod` or `chown`.

## Manual Unraid deployment

Community Applications is recommended. If you intentionally deploy with Docker
Compose, set `PALCENTER_UID=99` and `PALCENTER_GID=100` in the Compose
environment and map `/mnt/user/appdata/palcenter` to `/app/data`.

The container remains non-root and verifies that the mapping is writable. If
the mapping is not writable by UID `99` and GID `100`, PalCenter stops with an
error instead of weakening its security model. Do not expose the appdata share
publicly.

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
4. Confirm the template still uses UID `99` and GID `100`.
5. Pull the image and recreate the container without deleting the appdata
   directory.
6. Confirm the health check, login, servers, notifications, and history.

Container recreation and upgrades preserve users, configuration, metrics,
events, and the internal signing secret through `/app/data`.

PalCenter remains available through standard Docker Compose or Docker run for
non-Unraid users. See the main [README](../README.md).

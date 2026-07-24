# PalCenter v1.0.0

PalCenter v1.0.0 is the first stable release of the web management console for
remote Palworld dedicated servers.

## Highlights

- Manage multiple remote servers through the official Palworld REST API.
- Monitor status, players, performance, settings, history, and server events.
- Run server and player administration commands.
- Deliver selected events through Discord webhooks or ntfy.
- Protect access with first-run administrator setup, persistent users, secure
  sessions, and Administrator/Moderator/Visitor roles.
- Export and safely restore one portable backup containing all PalCenter data.
- Deploy on Linux, Windows, NAS, VPS, or Unraid with the official multi-platform
  Docker image.

## Install

```sh
docker pull ghcr.io/shanebionic/palcenter:v1.0.0
docker compose up -d
```

Open port `3000` in a browser and complete first-run setup. No default password
or manually generated session secret is required. Persist `/app/data`.

## Upgrade and migration

Back up PalCenter before upgrading and retain the existing `/app/data` volume.
Installations that previously supplied `PALCENTER_SESSION_SECRET` import it
once into `system.json`, preserving existing signed sessions. Remove the
environment variable after a successful start. Installations without
SQLite-backed users enter first-run setup without losing server,
notification, or historical data.

Read [README.md](./README.md), [SECURITY.md](./SECURITY.md), and
[docs/UNRAID.md](./docs/UNRAID.md) before production deployment.

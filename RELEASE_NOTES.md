# PalCenter v1.1.1

PalCenter v1.1.1 is a polished web management console for remote Palworld
dedicated servers, with an updated application shell and configurable
non-root container identity.

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
- Install on Unraid through the Community Applications catalog.
- Use an application-wide navigation shell, profile menu, and product About
  dialog.
- Configure the container UID/GID for host storage models while preserving
  non-root execution.

## Install

```sh
docker pull ghcr.io/shanebionic/palcenter:v1.1.1
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

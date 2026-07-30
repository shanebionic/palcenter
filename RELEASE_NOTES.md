# PalCenter v1.4.0

## Overview

PalCenter v1.4.0 introduces World Intelligence: a live Palpagos map, player
movement trails, and activity summaries built from the Palworld REST API. This
release also improves the interface, documentation, container builds, and
long-term telemetry reliability.

## Highlights

### World Intelligence

- View connected players on a bundled, responsive Palpagos map.
- Select players and inspect current coordinates, level, ping, structures, and
  telemetry freshness.
- Display 15-minute, 1-hour, 6-hour, or 24-hour movement trails.
- Use Fit Map, zoom, pan, Center Player, and expanded map controls on desktop
  and mobile layouts.

### Player Activity Summary

- See observed activity, moving and stationary time, travel distance, average
  and maximum movement speed, and current online state.
- Review operational flags and a timeline without confusing the selected range
  with the telemetry actually observed.
- Keep movement paths separated across disconnects and excluded teleports.

### Reliability and performance

- Store player and account identities separately while preserving player
  renames in history.
- Limit raw telemetry retention to a configurable period, defaulting to 30
  days.
- Reduce database growth by recording meaningful movement or state changes and
  periodic heartbeat snapshots instead of unchanged data every poll.
- Keep long trails responsive with continuous, bounded rendering and
  screen-stable markers.
- Build AMD64 and ARM64 images in parallel on native GitHub runners.

### Interface and documentation

- Apply consistent panels, headers, status cards, empty states, focus
  indicators, and responsive behavior across PalCenter.
- Keep calibration and diagnostic map controls behind the Administrator-only
  advanced section.
- Add complete installation, first-run, feature, reverse proxy, Unraid, upgrade,
  FAQ, and troubleshooting guides.
- Document Docker Compose settings for trusted proxies and automation polling.

### Backup, automation, and deployment

- Keep existing format-v3 backups compatible with server connections, users,
  notifications, automation, history, and system configuration.
- Preserve existing automation tasks, schedules, and execution history through
  the v1.4 database migration.
- Improve the Backup & Restore and Automation screens with the shared
  responsive interface.
- Keep standard Docker and Unraid deployments non-root, with documented
  `1000:1000` and `99:100` ownership models.

## Breaking changes

There are no intentional breaking changes in v1.4.0.

PalCenter continues to use the existing `/app/data` volume, user accounts,
server connections, notifications, automation tasks, and backup format.

## Upgrade notes

1. Sign in as an Administrator and download a current backup.
2. Record the current image tag and `/app/data` volume or bind mount.
3. Pull `ghcr.io/shanebionic/palcenter:v1.4.0`.
4. Recreate the container without deleting or replacing `/app/data`.
5. Confirm health, login, server connections, notifications, automation, and
   historical data.
6. Open a server's **Map** tab and allow new telemetry samples to accumulate.

PalCenter upgrades `history.sqlite` from schema version 3 to version 4 during
startup. Existing metrics, events, automation, and server configuration remain
compatible. The new World Intelligence history begins filling as connected
players are observed after the upgrade.

Unraid users should keep `/mnt/user/appdata/palcenter:/app/data` and the
template's non-root UID `99` / GID `100` mapping. Standard Docker Compose
deployments continue to default to UID/GID `1000:1000`.

Do not use `docker compose down -v`; that removes the persistent named volume.

## Installation and documentation

- [Quick start and installation](README.md#quick-start)
- [Complete installation guide](docs/INSTALLATION.md)
- [First-run walkthrough](docs/FIRST-RUN.md)
- [World Map and Player Activity Summary](docs/WORLD-MAP.md)
- [Feature and permission guide](docs/FEATURES.md)
- [Unraid installation and upgrades](docs/UNRAID.md)
- [Backup, upgrade, and rollback](docs/UPGRADING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [PalCenter Wiki](https://github.com/shanebionic/palcenter/wiki)

PalCenter remains an unofficial, free, open-source community project. Palworld
and the Palpagos map are copyright Pocketpair, Inc.

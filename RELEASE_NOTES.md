# PalCenter v1.5.0

## Overview

PalCenter v1.5.0 adds PalDefender integration, enabling detailed player, guild,
and base camp administration. Through PalDefender's REST API, PalCenter can now
grant items, Pals, eggs, technology, and progression; manage learned tech; kick,
ban, and unban players; and send targeted messages. This release also improves
player level display, catalog selection, and administration workflows.

## Highlights

### PalDefender integration

PalCenter can now connect to PalDefender's REST API on a per-server basis.
Configure the PalDefender URL and token in a server's Connection Settings. When
connected, PalCenter unlocks enhanced administration features:

- **Player workspace:** View each player's inventory, Pals, technology, and
  progression. Grant items, Pals, Pal templates, Pal eggs, and progression
  levels and points. Learn or forget technology.
- **Moderation:** Kick or ban players with optional messages and IP bans. Unban
  players and lift IP bans from the Administration panel.
- **Guilds:** Browse guilds and inspect administrators, members, levels, and
  associated base camps.
- **Base camps:** View base camp details, member rosters, and delete bases
  with confirmation.
- **Messaging:** Send server-wide alerts, targeted player messages, and
  PalDefender broadcasts from the Administration panel.
- **Configuration reload:** Reload PalDefender's plugin configuration without
  restarting the Palworld server.

PalDefender is optional. PalCenter continues to manage standard Palworld server
functionality through the native REST API without it.

### Player management improvements

- Player levels are enriched from PalDefender's progression data and displayed
  in the Players table.
- Friendly Palworld catalog selectors with search replace raw IDs for items,
  Pals, eggs, and technology.
- Manual Players refresh correctly resets player level data.
- Successful player actions are kept separate from background refresh failures.

### What's unchanged

PalCenter continues to use the existing `/app/data` volume, user accounts,
server connections, notifications, automation tasks, and backup format. World
Intelligence, player activity summaries, telemetry, and all native REST
operations work as before.

## Breaking changes

There are no intentional breaking changes in v1.5.0.

The discontinued PalCenter Companion integration has been removed. PalCenter
Companion was not included in any released version.

## Upgrade notes

1. Sign in as an Administrator and download a current backup.
2. Record the current image tag and `/app/data` volume or bind mount.
3. Pull `ghcr.io/shanebionic/palcenter:v1.5.0`.
4. Recreate the container without deleting or replacing `/app/data`.
5. Confirm health, login, server connections, and existing features.
6. To use PalDefender features, open a server's **Connection Settings** and
   enter the PalDefender URL and read-only token.

PalCenter does not change `history.sqlite` schema version in this release.
Existing metrics, events, automation, and server configuration remain
compatible.

Unraid users should keep `/mnt/user/appdata/palcenter:/app/data` and the
template's non-root UID `99` / GID `100` mapping. Standard Docker Compose
deployments continue to default to UID/GID `1000:1000`.

Do not use `docker compose down -v`; that removes the persistent named volume.

## New configuration

### PalDefender per server

When editing a server's Connection Settings, two optional fields appear:

- **PalDefender URL:** The PalDefender REST API address
  (e.g. `http://127.0.0.1:17993`).
- **PalDefender Token:** A read-only PalDefender API token.

These are stored per server and are not required for standard PalCenter
operation. PalDefender features are unavailable until configured.

## Installation and documentation

- [Quick start and installation](README.md#quick-start)
- [Complete installation guide](docs/INSTALLATION.md)
- [First-run walkthrough](docs/FIRST-RUN.md)
- [Features and permissions](docs/FEATURES.md)
- [Unraid installation and upgrades](docs/UNRAID.md)
- [Backup, upgrade, and rollback](docs/UPGRADING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [PalCenter Wiki](https://github.com/shanebionic/palcenter/wiki)

PalCenter remains an unofficial, free, open-source community project. Palworld
and the Palpagos map are copyright Pocketpair, Inc.

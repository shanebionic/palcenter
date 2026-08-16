# PalCenter v1.5.1

## Overview

PalCenter v1.5.1 is a stability and World Map release. It automatically
repairs a history-database problem that affected some 1.4.0-to-1.5.0
upgrades, and adds interactive base camp markers, map layer controls,
provider-aware player telemetry, and navigation improvements.

## Important upgrade repair: history database (#199)

Upgrades originating from PalCenter 1.4.0 could produce an incomplete
`history.sqlite` schema when the installation was upgraded to 1.5.0. When
this happened, the Map and player telemetry endpoints returned HTTP 500
errors referencing `coordinate_space_id`, and the map displayed "Live map
data is unavailable" even with players online.

Not every 1.5.0 installation was affected: fresh 1.5.0 installs and
upgrades from databases that already had the complete schema were not.

PalCenter 1.5.1 detects and repairs the missing schema capability
automatically on startup:

- Already-affected 1.5.0 databases self-heal when started with 1.5.1.
- Existing history data is preserved. Legacy rows receive the default
  coordinate space value and remain visible on the map and in history.
- No manual database repair, export, or migration step is required.
- Upgrading from 1.4.0 directly to 1.5.1 applies the repair as part of the
  normal upgrade.

If you are on 1.5.0 and the Map and telemetry work normally, upgrading to
1.5.1 changes nothing about your database; the repair is a no-op.

## World Map improvements

- **Interactive base camp markers.** When PalDefender is configured for a
  server, its base camps appear as diamond markers on the Palpagos map.
  Select a base to see its guild, base and guild IDs, world coordinates, and
  PalDefender map coordinates, with direct links to the base and guild
  workspaces.
- **Layer controls.** A new **Layers** menu on the map shows or hides the
  Players, Bases, and Trails layers (Players and Bases are on by default).
- **Map coordinates.** Player and base detail cards on the map show
  PalDefender map coordinates (X, Y, and Z when available). The selected
  player's detail card also shows the PalDefender progression level.
- **First-party map asset.** The bundled Palpagos image is now a first-party
  derivative with the projection aligned to the game's authoritative
  DT_WorldMapUIData terrain bounds.
- **Return navigation.** Player, guild, and base detail views include a back
  button that returns to the workspace you entered from (for example,
  "Back to Map").
- The obsolete map calibration and debug tools were removed. Map alignment
  is fixed to the validated projection bounds.

## Telemetry improvements

- **Provider-aware collection.** When PalDefender is configured for a
  server, player telemetry (world location including Z, level, guild name)
  is collected from PalDefender; otherwise the native Palworld REST API is
  used. A configured server does not silently fall back to the native
  source.
- **Identity repair.** A player is no longer split across two identities
  when PalDefender reports a PlayerUID separate from the platform UserId.
  Affected legacy rows are reconciled automatically.
- **Efficient polling.** Offline players no longer trigger per-player
  PalDefender detail requests.

## Navigation and server management

- The desktop navigation sidebar can be collapsed to an icon rail; the
  choice is remembered per browser.
- The **Add Server** action moved from the Dashboard to the Servers page
  (Administrators only).

## Accepted limitations

- **Each map plots only its own coordinate space.** A player in the World
  Tree is listed under **Players on other maps** on the Palpagos view (and
  vice versa), where **View on Palpagos** / **View on World Tree** switches
  to that player's map. Players PalCenter cannot locate are listed under
  **Location unavailable**.
- **Legacy telemetry rows keep the default coordinate space.** Rows
  collected before coordinate-space tracking was introduced remain
  classified as the default (`unknown`) space. They are visible on the map
  and in history, but are not counted as trusted Palpagos positions.

## What's unchanged

PalCenter continues to use the existing `/app/data` volume, user accounts,
server connections, notifications, automation tasks, and backup format v3.
All native REST operations work as before.

## Breaking changes

There are no intentional breaking changes in v1.5.1.

The map calibration and debug tools ("Advanced map tools") were removed.
Map alignment is now fixed to the validated DT_WorldMapUIData bounds; no
operator configuration is affected.

## Upgrade notes

1. Sign in as an Administrator and download a current backup.
2. Record the current image tag and `/app/data` volume or bind mount.
3. Pull `ghcr.io/shanebionic/palcenter:v1.5.1`.
4. Recreate the container without deleting or replacing `/app/data`.
5. On first start, PalCenter applies any required schema repairs
   automatically; existing history is preserved.
6. Confirm health, login, server connections, and the Map. If you upgraded
   from 1.4.0 (or from an affected 1.5.0 installation), confirm the Map
   loads and player positions render.

Do not use `docker compose down -v`; that removes the persistent named
volume.

Unraid users should keep `/mnt/user/appdata/palcenter:/app/data` and the
template's non-root UID `99` / GID `100` mapping. Standard Docker Compose
deployments continue to default to UID/GID `1000:1000`.

## Installation and documentation

- [Quick start and installation](README.md#quick-start)
- [Complete installation guide](docs/INSTALLATION.md)
- [First-run walkthrough](docs/FIRST-RUN.md)
- [Features and permissions](docs/FEATURES.md)
- [Unraid installation and upgrades](docs/UNRAID.md)
- [Backup, upgrade, and rollback](docs/UPGRADING.md)
- [World Map and Player Activity Summary](docs/WORLD-MAP.md)
- [Player telemetry](docs/TELEMETRY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [PalCenter Wiki](https://github.com/shanebionic/palcenter/wiki)

PalCenter remains an unofficial, free, open-source community project. Palworld
and the Palpagos map are copyright Pocketpair, Inc.

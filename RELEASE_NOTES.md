# PalCenter v1.5.2

## Overview

PalCenter v1.5.2 is a World Map and PalDefender credentials release. It adds
a second map to the World Map (the World Tree) with coordinate-space isolated
player and trail rendering, per-user PalDefender credentials with a
role-based token file generator, and base deep-link navigation from Guilds
and Bases straight to the map.

## World Map: World Tree and base deep links

- **World Tree map.** A map switcher in the World Map header selects between
  the Palpagos and World Tree maps. Each map renders only position data that
  belongs to its coordinate space. Players identified as being on the other
  map are listed under **Players on other maps** with a one-click
  **View on Palpagos** / **View on World Tree** action, and players PalCenter
  cannot locate are listed under **Location unavailable**.
- **Base deep links.** Guild Base Camps entries link into Base Details. Base
  Details includes a **View on map** action (Moderators and Administrators,
  the same roles that can open the World Map tab). The map also accepts
  direct links of the form `/servers/{id}?tab=map&base={baseId}`. PalCenter
  distinguishes three outcomes for a requested base:
  - **Base not found** means the base list loaded successfully but does not
    contain the requested base.
  - A known, Palpagos-plottable base while the World Tree map is active
    shows **Location unavailable on this map** and offers **View on
    Palpagos**.
  - Failed or unavailable base data, or unusable coordinates, shows
    **Location unavailable** without falsely asserting the base does not
    exist, and without the Palpagos action (the base is not known to be
    Palpagos-plottable).

## PalDefender credentials and token generation

- **Per-user credentials.** Each operator can register their own PalDefender
  API token for a server (PalDefender credentials panel). PalDefender actions
  run with the acting user's credential, and selection is fail-closed: a
  user without a usable credential gets a clear error instead of another
  user's credential being used.
- **Token file generator.** Administrators can generate least-privilege
  PalDefender token files for the Visitor, Moderator, and Administrator
  roles (9/29/31 permissions). Each generated file is server-scoped to the
  generated user and carries exactly the permissions the PalCenter role
  needs. See SECURITY.md for the full security properties of generated
  tokens.

## Plain-language terminology

User-facing UI copy and documentation now use plain server-administration
language (action, grant, kick, ban/unban, send, delete, learn/forget) instead
of internal technical terms.

## Known limitations

- **Base camp markers are shown on the Palpagos map only.** Base camps do
  not appear on the World Tree because PalDefender's base data does not
  identify the camp's coordinate space, and PalCenter will not guess a tree
  position from Palpagos coordinates.
- **Base map deep links plot a base on Palpagos.** The three outcomes above
  ("Base not found", "Location unavailable on this map" with View on
  Palpagos, and "Location unavailable") are distinct conditions; the
  "Location unavailable on this map" state means the base is known but the
  active map cannot show it.
- **Legacy telemetry rows keep the default coordinate space.** Rows
  collected before coordinate-space tracking was introduced remain
  classified as the default (`unknown`) space. They are visible on the map
  and in history, but are not counted as trusted positions.

No other material limitation was identified across the 1.5.2 work; the
limitations above are the ones an operator can encounter.

## What's unchanged

PalCenter continues to use the existing `/app/data` volume, user accounts,
server connections, notifications, automation tasks, and backup format v3.
The history database (`history.sqlite`) schema version is unchanged (10). All
native REST operations work as before.

## Breaking changes

There are no intentional breaking changes in v1.5.2.

## Upgrade notes

1. Sign in as an Administrator and download a current backup.
2. Record the current image tag and `/app/data` volume or bind mount.
3. Pull `ghcr.io/shanebionic/palcenter:v1.5.2`.
4. Recreate the container without deleting or replacing `/app/data`.
5. On first start, PalCenter adds the new `paldefender_user_credentials`
   table to `users.sqlite` automatically; existing users, servers, telemetry,
   and history are untouched.
6. Confirm health, login, server connections, and the Map (including the new
   map switcher). Register PalDefender credentials from the PalDefender
   credentials panel when you want per-user credential use.

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
- [Security](SECURITY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [PalCenter Wiki](https://github.com/shanebionic/palcenter/wiki)

PalCenter remains an unofficial, free, open-source community project. Palworld
and the Palpagos map are copyright Pocketpair, Inc.

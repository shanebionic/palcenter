# Frequently asked questions

## Does PalCenter run or install Palworld?

No. PalCenter connects to already-running Palworld dedicated servers through
their official REST APIs. It does not install servers, use SteamCMD, control
Docker, update Palworld, or manage saves.

## Can one PalCenter manage multiple servers?

Yes. Add each server with a display name, REST URL, and Palworld administrator
password. Live status failures are isolated per server.

## Where is PalCenter data stored?

All persistent data is under `/app/data`. It includes server and notification
configuration, users, the session-signing configuration, SQLite history,
telemetry, events, and automation data.

## Does PalCenter store live server state in `servers.json`?

No. `servers.json` stores connection configuration only. Player count, FPS,
version, uptime, and similar state are fetched live or stored in the historical
SQLite database where explicitly documented.

## Which ports are required?

Port `3000` is the web interface. Port `3001` is the direct API and health
endpoint. Normal browser use goes through the web interface's same-origin API
proxy, so the direct API does not need public exposure.

## Does PalCenter require HTTPS?

Not on a trusted local network, but HTTPS is strongly recommended for remote
access. Put port `3000` behind a reverse proxy and set
`PALCENTER_SESSION_COOKIE_SECURE=true`.

## Are WebSockets required through a reverse proxy?

No. PalCenter v1.4 uses normal HTTP requests and polling.

## Is there a default administrator password?

No. The first-run wizard creates the initial Administrator. User passwords are
not stored in environment variables or plaintext.

## What is the difference between a PalCenter password and `AdminPassword`?

A PalCenter password signs a user into the management console. The Palworld
`AdminPassword` authenticates PalCenter to a remote Palworld REST API. They are
separate credentials.

## What can each role do?

- **Administrator:** full management.
- **Moderator:** operational server/player access and authorized map history.
- **Visitor:** read-only access.

The backend API enforces these permissions.

## Why is the server shown as offline?

PalCenter could not complete the live REST request. Check the Palworld process,
REST enablement/port, network path, and administrator password. Other configured
servers continue updating.

## Why is the World Map empty?

Markers require a currently connected player with valid X/Y telemetry. Movement
history also requires captured samples in the selected range. An empty map is
normal when no players are online.

## Does the Player Activity Summary use AI?

No. It uses deterministic thresholds over observed telemetry. Descriptions
such as Exploring or Mostly Idle summarize movement patterns, not player intent.

## Does telemetry grow forever?

No. Raw player telemetry defaults to 30-day retention, configurable from 1 to
3650 days. Unchanged snapshots are reduced while periodic heartbeats preserve
useful history.

## What automation is supported?

Broadcast Message, Save World, and Graceful Shutdown. PalCenter does not
schedule restarts because the official REST API does not provide a restart
operation.

## Does Run Now change the schedule?

No. It executes immediately and records history without changing the recurring
task's calculated next run.

## What happens to missed automation runs?

After a restart, an overdue task runs once as soon as possible. PalCenter then
calculates the next occurrence; it does not replay every missed run.

## What is included in a backup?

Current format-v3 archives include server connections, notification
configuration, users and password hashes, history/telemetry/automation data,
and system signing configuration. Backups are sensitive and should be encrypted
at rest.

## Can I copy the SQLite database while PalCenter is running?

Use PalCenter's Backup page. For a host-level cold backup, stop the container
and copy all of `/app/data`; do not copy only a live SQLite file.

## Can I use a bind mount with a different UID/GID?

Yes. The standard default is `1000:1000`; Unraid uses `99:100`. The host
directory must already be writable by that identity. PalCenter does not start
as root or change host ownership.

## Can PalCenter be hosted under `/palcenter`?

No. Use a dedicated hostname such as `palcenter.example.com`. Root-relative
application routes and assets make subpath hosting unsupported.

## Where do I report a problem?

Use the [issue tracker](https://github.com/shanebionic/palcenter/issues) for
bugs and feature requests. Follow [SECURITY.md](../SECURITY.md) for private
vulnerability reporting.

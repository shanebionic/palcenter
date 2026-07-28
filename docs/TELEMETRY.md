# Player telemetry

PalCenter can periodically collect player state and location snapshots from
configured Palworld servers. This is the storage foundation for the World
Intelligence work planned for PalCenter v1.4.

## Collected data

For each player reported by the official Palworld REST API, PalCenter stores:

- the PalCenter server ID;
- the player's stable user ID and current display name;
- the collection timestamp;
- X and Y coordinates, plus Z when the server supplies it;
- level and ping;
- guild identifiers or names when the server supplies them.

Missing coordinate or optional state fields are stored as unavailable. Player
names are descriptive only and are not used as identity, so historical records
remain associated when a player changes names. Snapshots remain in
`history.sqlite` after a player leaves the server.

PalCenter never stores a server's REST password in telemetry records.

## Collection behavior

Telemetry collection is a PalCenter system process, separate from server health
monitoring and administrator-created automation tasks. It polls every 30
seconds by default and queries configured servers concurrently.

Set `PALCENTER_TELEMETRY_INTERVAL_SECONDS` in the Compose environment to change
the interval. The minimum supported value is 5 seconds. A failed or offline
server is skipped for that cycle, no snapshot is written for the failed
request, and other servers continue collecting normally.

Collection does not replay missed polls after PalCenter restarts. It collects
once during startup and then resumes its configured interval.

## API

Authenticated users with read access can request:

- `GET /api/servers/:id/telemetry/players/latest`
- `GET /api/servers/:id/telemetry/players/:playerId/history`

History accepts optional ISO 8601 `from` and `to` values and a `limit` from 1
to 500. The default limit is 100.

The Players view displays the latest collected coordinates and collection time
for currently connected players.

## Storage migration and backups

Starting PalCenter v1.4 upgrades `history.sqlite` schema version 3 to version 4
in place and creates `player_position_snapshots`. Existing metrics, events, and
automation history are preserved.

Telemetry is contained in `history.sqlite`, so existing PalCenter backup and
restore operations include it automatically. Download a backup before
upgrading a production installation.

## Roadmap context

This milestone stores player location and state snapshots only. It does not
include maps, movement trails, heatmaps, world actors, bases, PalBoxes,
analytics, reports, or alerts. Those are possible future World Intelligence
capabilities and are not part of the current implementation.

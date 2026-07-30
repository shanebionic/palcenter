# Player telemetry

PalCenter can periodically collect player state and location snapshots from
configured Palworld servers. This data powers the v1.4 World Map, movement
trails, and Player Activity Summary.

## Collected data

For each player reported by the official Palworld REST API, PalCenter stores:

- the PalCenter server ID;
- the player's stable `userId`, Palworld `playerId`, account name, and current
  display name;
- the collection timestamp;
- X and Y coordinates;
- level, ping, and building count.

Missing coordinate or optional state fields are stored as unavailable. Player
`userId` is the stable telemetry and history key. `playerId`, `accountName`,
and display name are stored as attributes, so historical records remain
associated when a player changes names. Snapshots remain in `history.sqlite`
after a player leaves the server.

The official `/players` endpoint currently documents X and Y coordinates. The
nullable Z and guild columns are reserved for possible future `/game-data`
ingestion and remain unavailable in this collector. Their presence does not
mean PalCenter currently collects `/game-data`.

PalCenter never stores a server's REST password in telemetry records.

## Collection behavior

Telemetry collection is a PalCenter system process, separate from server health
monitoring and administrator-created automation tasks. It polls every 30
seconds by default and queries configured servers concurrently.

Set `PALCENTER_TELEMETRY_INTERVAL_SECONDS` in the Compose environment to change
the interval. The minimum supported value is 5 seconds. A failed or offline
server is skipped for that cycle, no snapshot is written for the failed
request, and other servers continue collecting normally.

### Write reduction

PalCenter does not write an identical row every polling cycle. It stores a new
snapshot when:

- a player moves at least 100 world units from the last stored position;
- identity or state changes, including display name, account name, player ID,
  level, or building count;
- ping changes by at least 25 milliseconds; or
- five minutes have passed since the last stored snapshot.

The five-minute heartbeat preserves stationary-player presence. For a player
whose position and state remain unchanged, it reduces the default write rate
from 2,880 rows per day to 288 rows per day. Movement at the 100-unit threshold
remains detailed enough to support future trail and heatmap processing without
claiming those features exist.

### Retention

Raw telemetry is retained for 30 days by default. Set
`PALCENTER_TELEMETRY_RETENTION_DAYS` in the Compose environment to a whole
number from 1 through 3650 days.

Every five minutes, PalCenter removes at most 1,000 expired rows. Bounded
batches keep cleanup transactions short and allow a large existing backlog to
be removed gradually without monopolizing SQLite.

Collection does not replay missed polls after PalCenter restarts. It collects
once during startup and then resumes its configured interval.

## API

Authenticated users with read access can request:

- `GET /api/servers/:id/telemetry/players/latest`
- `GET /api/servers/:id/telemetry/players/:userId/history`

History requires an ISO 8601 start/end range of no more than 24 hours. It
accepts `start`/`end` or the compatible `from`/`to` names and a `limit` from 1
to 5,000. The default limit is 5,000.

The Players view displays the latest collected coordinates and collection time
for currently connected players.

## Storage migration and backups

Starting PalCenter v1.4 upgrades `history.sqlite` schema version 3 to version 4
in place and creates `player_position_snapshots`. The schema stores `user_id`
as the stable key and stores `player_id`, `account_name`, and `building_count`
separately. Existing metrics, events, and automation history are preserved.

Telemetry is contained in `history.sqlite`, so existing PalCenter backup and
restore operations include it automatically. Download a backup before
upgrading a production installation.

## Current scope

Telemetry supports current markers, movement trails, and deterministic activity
summaries. It does not collect `/game-data`, world actors, bases, PalBoxes,
guilds, or Z coordinates, and it does not provide heatmaps or historical
playback.

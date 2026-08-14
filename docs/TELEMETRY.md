# Player telemetry

PalCenter can periodically collect player state and location snapshots from
configured Palworld servers. This data powers the World Map, movement trails,
and Player Activity Summary.

## Collected data

For each player in the current live roster, PalCenter stores:

- the PalCenter server ID;
- the player's stable `userId`, Palworld `playerId`, account name, and current
  display name;
- the collection timestamp;
- X and Y coordinates, plus Z when collected through PalDefender;
- level, ping, and building count (ping and building count are not reported
  by the PalDefender source);
- the guild name when reported by the PalDefender roster.

Missing coordinate or optional state fields are stored as unavailable. Player
`userId` is the stable telemetry and history key. `playerId`, `accountName`,
and display name are stored as attributes, so historical records remain
associated when a player changes names. Snapshots remain in `history.sqlite`
after a player leaves the server.

The native `/players` endpoint documents X and Y coordinates, so native
collections store Z and guild as unavailable. When PalDefender is configured
for a server, the PalDefender source stores the Z coordinate and guild name it
reports. Neither source collects `/game-data`.

PalCenter never stores a server's REST password in telemetry records.

## Collection behavior

Telemetry collection is a PalCenter system process, separate from server health
monitoring and administrator-created automation tasks. It polls every 30
seconds by default and queries configured servers concurrently.

### Source selection

Each server's telemetry is collected from one provider per cycle:

- When PalDefender is configured for the server (enabled, URL, and token are
  set in Connection Settings), PalCenter collects from PalDefender player
  details: world location (X/Y/Z), level, and guild name.
- Otherwise PalCenter collects from the native Palworld REST `/players`
  response.

A server with PalDefender configured does not silently fall back to the native
source when a PalDefender request fails; the failure is logged and the next
collection cycle retries. Offline players in the PalDefender roster do not
trigger per-player detail requests.

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

`player_position_snapshots` was introduced in v1.4 (schema version 4), and the
current schema is version 10. Startup upgrades run in place and preserve
existing metrics, events, automation history, and telemetry rows. The schema
stores `user_id` as the stable key and stores `player_id`, `account_name`, and
`building_count` separately.

PalCenter 1.5.1 repairs the coordinate-space columns for databases that the
1.4.0-to-1.5.0 upgrade path advanced without them (issue #199). See
[Upgrading](UPGRADING.md#migration-behavior).

Telemetry is contained in `history.sqlite`, so existing PalCenter backup and
restore operations include it automatically. Download a backup before
upgrading a production installation.

## Current scope

Telemetry supports current markers, movement trails, and deterministic activity
summaries. It does not collect `/game-data`, world actors, PalBoxes, or guild
membership data, and it does not provide heatmaps or historical playback. Z
coordinates are collected only from the PalDefender source. Interactive base
camp markers on the map are fetched from a separate PalDefender request, not
from the telemetry collector.

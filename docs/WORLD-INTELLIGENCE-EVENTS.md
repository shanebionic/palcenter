# World Intelligence events

PalCenter's World Intelligence event engine converts explicit server
observations into immutable, chronological events. It is deterministic: the
same observation produces the same event identity, confidence, and evidence.
Repeated processing is idempotent.

## Event model

Each event stores an ID, server ID, stable player key, timestamp, type,
metadata, confidence, evidence, and an optional map position. The stable player
key is Palworld's `userId`, matching player telemetry history. Display names
remain metadata so a rename does not split a player's history.

The initial model supports:

- Player Joined
- Player Disconnected
- Session Started
- Session Ended
- Player Died
- Respawn

Join/disconnect and session events are currently generated from explicit
changes in the official `/players` online roster. These observations have a
confidence of `1` and retain evidence identifying the roster transition.
Collection is incremental; PalCenter processes newly observed transitions and
does not rescan telemetry history.

The official `/players` response does not expose a death/alive state. Death and
respawn therefore exist in the event model but are not inferred from movement,
gaps, or map position. PalCenter will emit them only when an existing,
authoritative server observation provides direct state evidence.

## Storage and API

Events are stored in `history.sqlite` schema version 5 and are included
automatically in PalCenter backups. The migration from schema version 4 creates
the event tables without rewriting existing telemetry or history.

Authenticated clients can request chronological history from:

`GET /api/servers/:id/world-events`

Optional filters are `userId`, `from`, `to`, and `limit`. Results are ordered
oldest to newest within the bounded response. Existing role-based read access
applies; the endpoint does not expose Palworld credentials or private network
configuration.

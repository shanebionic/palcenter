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

Optional filters are `userId`, `type`, `from`, `to`, and `limit`. Results are
ordered oldest to newest within the bounded response. Existing role-based read
access applies; the endpoint does not expose Palworld credentials or private
network configuration.

## Events workspace

Administrators and Moderators can open **Events** in a server workspace. The
timeline is newest-first and identifies what happened, the involved player,
when PalCenter observed it, and the confidence assigned by the event engine.
Exact timestamps are shown alongside relative times.

Use the player ID, event type, and time-range filters to narrow the server-side
query. PalCenter retrieves events in bounded pages; **Load older events** adds
the next page without duplicating entries. The timeline does not poll
automatically.

Each entry keeps evidence and metadata collapsed by default. Expanding
**Evidence and details** shows the exact confidence percentage, source evidence,
stable user ID, optional Palworld player ID, and any available position. When a
position exists, **View on map** opens the existing Map tab and centers its
shared coordinate plane on that observation.

Events remain in `history.sqlite` for as long as the application data is
retained. PalCenter does not currently apply a separate event-retention policy.
Backups include the complete retained event table.

Visitors cannot access the World Events timeline. This matches the existing
privacy boundary for player trail history.

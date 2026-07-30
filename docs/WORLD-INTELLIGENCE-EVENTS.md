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
- Player became idle
- Player resumed activity
- Prolonged inactivity detected
- Activity resumed

Join/disconnect and session events are currently generated from explicit
changes in the official `/players` online roster. These observations have a
confidence of `1` and retain evidence identifying the roster transition.
Collection is incremental; PalCenter processes newly observed transitions and
does not rescan telemetry history.

The official `/players` response does not expose a death/alive state. Death and
respawn therefore exist in the event model but are not inferred from movement,
gaps, or map position. PalCenter will emit them only when an existing,
authoritative server observation provides direct state evidence.

## Idle and prolonged inactivity

PalCenter classifies inactivity from existing position telemetry while a player
remains in the online roster. These are operational classifications; PalCenter
does not know whether a person is physically away from their keyboard.

The centralized defaults are:

- movement radius: 300 Palworld world-coordinate units;
- idle threshold: 10 minutes within that radius;
- prolonged-inactivity threshold: 30 minutes within that radius;
- maximum continuous observation gap: 5 minutes.

The radius is measured as straight-line X/Y displacement from the position
where the current inactivity window began. It is not the sum of adjacent
movement, so ordinary jitter cannot accumulate into false activity. Movement at
or below 300 units remains inside the radius; movement beyond it proves the
current inactivity state has ended.

An Idle or prolonged-inactivity event is timestamped at the first telemetry
sample that satisfies its duration threshold. A resumed event is timestamped at
the first sample beyond the movement radius. These events use deterministic
confidence `0.9` (**High confidence**): the engine transition is reproducible,
but it describes observed inactivity rather than certainty about human
behavior.

Player activity checkpoints are persisted. Restarting PalCenter continues an
uninterrupted observation window without rescanning telemetry or duplicating
events. Disconnects remove the checkpoint without claiming activity resumed,
and a new session starts clean. A telemetry gap longer than five minutes resets
the checkpoint to Active without emitting a transition. Server downtime and
telemetry outages therefore never count toward inactivity.

## Storage and API

Events and activity checkpoints are stored in `history.sqlite` schema version 6
and are included automatically in PalCenter backups. The migration preserves
existing events and history.

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

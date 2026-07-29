# Palpagos world map

PalCenter v1.4 includes an interactive Palpagos reference map for current
connected players. The position pipeline, controls, freshness indicators,
access controls, and administrator calibration tooling remain independent from
the bundled image layer.

## Asset and licensing decision

The repository bundles 2048×2048 and 4096×4096 WebP derivatives of the
8192×8192 Palpagos world map published by The Palworld Wiki. The
[source file page](https://palworld.wiki.gg/wiki/File:World_Map.webp)
identifies the image as originating from Palworld or a Pocketpair-owned website,
states that Pocketpair holds the copyright, and describes the wiki's
illustrative use as fair use under United States copyright law. The image was
retrieved on July 28, 2026.

The image remains copyright Pocketpair, Inc. It is not covered by PalCenter's
MIT license. PalCenter is unofficial, unaffiliated, free, open source, and
noncommercial, and includes the map only as a functional reference layer for
official REST API player-location data. The full source record, checksum,
attribution, and removal policy are in the asset's
[`ASSET-NOTICE.md`](../apps/frontend/public/world-maps/palpagos/ASSET-NOTICE.md),
[`source.json`](../apps/frontend/public/world-maps/palpagos/source.json), and
the repository-level [`THIRD_PARTY_ASSETS.md`](../THIRD_PARTY_ASSETS.md).

The upstream 8192×8192 binary is not shipped in the production frontend.
Ordinary clients default to the 2048×2048 derivative; browsers can select the
4096×4096 derivative for a sufficiently large or high-density rendered map.
Both derivatives use WebP quality 90, effort 6, and Lanczos3 resizing with
`fit: fill`. Because the source and output are all square, this performs a
direct full-frame scale with no crop, rotation, padding, or boundary change.

| Bundled derivative    | Compressed size | Approximate RGBA decode |
| --------------------- | --------------: | ----------------------: |
| `world-map-2048.webp` |   381,772 bytes |                  16 MiB |
| `world-map-4096.webp` | 1,346,542 bytes |                  64 MiB |

The original file was 4,876,386 bytes and could require approximately 256 MiB
when decoded as RGBA. The default derivative reduces transfer size by 92.2% and
decoded pixel memory by approximately 93.8%; the larger derivative reduces
transfer size by 72.4% and decoded pixel memory by approximately 75%.

The derivatives are bundled in the application and are never hotlinked at
runtime. The PalCenter-owned CSS calibration grid remains available to
Administrators as a standalone layer or an overlay. The normal map layer is the
default.

## Coordinate sources

The prototype uses these sources:

- the [official Palworld REST API `/players` documentation](https://docs.palworldgame.com/0.2.4.0/api/rest-api/players/)
  for the documented `location_x` and `location_y` fields;
- the [official Unreal Engine coordinate-system documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/coordinate-system-and-spaces-in-unreal-engine)
  for Unreal's left-handed, Z-up world-coordinate convention;
- the community-documented
  [`DT_WorldMapUIData` bounds](https://palworld.wiki.gg/wiki/MapTest) for the
  current Palpagos projection constants.

The last source is community research rather than an official Palworld API
contract. The constants and orientation must therefore be treated as
calibration assumptions, not guaranteed game metadata.

## Projection

The configured raw world bounds are:

| Axis |  Minimum | Maximum |      Span |
| ---- | -------: | ------: | --------: |
| X    | -999,940 | 447,900 | 1,447,840 |
| Y    | -738,920 | 708,920 | 1,447,840 |

PalCenter first normalizes both axes:

```text
rawX = (worldX - worldMinX) / (worldMaxX - worldMinX)
rawY = (worldY - worldMinY) / (worldMaxY - worldMinY)
```

It then applies a 90-degree clockwise rotation around the map center. For the
current constants, the resulting browser position is:

```text
mapX = rawY
mapY = 1 - rawX
```

`mapX` and `mapY` are unit coordinates from 0 through 1 and are rendered as
percentages. Invalid, non-finite, or out-of-bounds coordinates are never
clamped into a misleading marker. They are reported as unavailable in the
administrator calibration panel.

All bounds, axis inversion, and rotation options live in one projection
configuration in `apps/frontend/lib/world-map/projection.ts`. The forward and
inverse transforms are pure functions with regression tests for bounds,
negative values, orientation, invalid data, and round trips.

## Player identity and freshness

Only players in the current official `/players` response are eligible for a
marker. PalCenter joins that response to the latest stored position using
`userId`, the stable telemetry/history key. A stored record for a disconnected
player is not rendered.

Because unchanged telemetry is intentionally stored only on the five-minute
heartbeat, the latest database row alone is not a reliable indication that the
collector is healthy. The existing telemetry response includes the last
successful collection time in memory and the configured polling interval. The
map uses the later of that successful verification time and the stored
snapshot time:

- **Live:** no more than two polling intervals old;
- **Delayed:** older than two polling intervals but no more than five minutes;
- **Stale:** older than five minutes.

This health timestamp is not persisted and does not change telemetry retention,
write reduction, backup contents, or restore behavior. After PalCenter starts,
the map falls back to the stored snapshot time until the first successful
collection.

## Access and privacy

Map access matches the existing Players tab:

- Administrators and Moderators can view the map.
- Visitors cannot view the map.
- Only Administrators can enable calibration diagnostics.

The marker detail panel shows the player's display and account names, Palworld
identifiers, level, ping, structure count, X/Y coordinates, age, and freshness.
It does not display, copy, or log player IP addresses.

The map supports mouse and touch/pointer panning, pointer-centered wheel zoom,
Fit Map, Center Player, Reset View, and an expanded full-viewport mode. Wheel
input is captured only while the pointer is over the map. Pan limits keep part
of the map recoverable, and Fit Map restores the complete square coordinate
plane after navigation. Marker buttons are keyboard focusable, have one
accessible name, and retain a visible focus indicator. Player labels preserve
the capitalization returned by Palworld and truncate safely when space is
limited. Marker icons and labels retain their Fit Map screen-space size while
their geographic anchors continue to follow map zoom and pan.

## Historical movement trails

Administrators and Moderators can select a connected player and enable
**Show movement trail**. Available ranges are 15 minutes, 1 hour, 6 hours, and
24 hours. Changing the range refreshes the trail; **Refresh trail** requests it
again, and **Clear trail** removes it without changing stored telemetry.

Trails use the existing stable `userId` telemetry key and Palpagos projection.
Each player receives a consistent marker and trail color derived from that
identifier. Faint trail sections are older, while brighter sections are newer;
the **Older — Newer** legend provides the same cue in text. The newest-point
indicator uses the player color, while the subdued start indicator remains
visually distinct from the live marker.

The visual age range is calculated only from the oldest and newest movement
timestamps actually returned for the selected player and range. A partially
populated 24-hour request therefore still uses the complete Older — Newer
visual range; preset duration, retention length, and current wall-clock time do
not dilute the fade.

The API returns only capture time and raw X/Y coordinates—never player IPs,
account details, server connection details, or credentials. Visitors cannot
access trail history.

Requests are limited to 24 hours and the newest 5,000 captured points. Raw data
remains governed by `PALCENTER_TELEMETRY_RETENTION_DAYS` (30 days by default),
so a range may be empty when the player was absent or data has expired. This
feature adds no polling or persistence.

PalCenter sorts points chronologically, rejects invalid or out-of-bounds
coordinates, removes consecutive duplicates, and reduces dense paths while
preserving endpoints. It splits paths when captures are separated by more than
the greater of three polling intervals or two minutes, when movement exceeds
200,000 world units and is classified as a likely teleport, or when invalid
data interrupts history. Disconnected periods are never joined by a misleading
line.

Movement is drawn in chronological sections with a subtle, screen-stable line
width of approximately 1.2–1.5 pixels. Older movement retains at least 35%
opacity and 85% brightness so short trails remain readable. Rendering is capped
at 400 connected lines even when the selected history contains more stored
positions, keeping zoom and pan responsive while preserving the endpoints of
each represented continuous path. Start and end states are distinct and have
text descriptions. The summary reports the time span, points, path and rendered
section counts, invalid exclusions, discontinuities, online state, and
approximate distance in Palworld world units. Distance excludes gaps and likely
teleports and is an operational estimate.

## Player Activity Summary

When a player and movement trail are selected, PalCenter converts the returned
telemetry into a compact administrator-facing summary. The trail remains the
source visualization; the summary explains the observed movement without
requiring an administrator to interpret every line on the map. It disappears
when the trail is cleared or no valid history is available.

The **Executive Summary** is the first sentence and combines the deterministic
classification, travel distance, observed duration, movement percentage, and
current connection state. It does not use AI and does not infer gameplay
intent.

### Activity classifications

Classifications use these fixed thresholds:

- **Offline:** the player is not connected and the newest returned position is
  more than five minutes old.
- **Recently Disconnected:** the player is not connected and the newest
  returned position is no more than five minutes old.
- **Idle:** connected, with no more than 5% of valid observed time moving.
- **Mostly Idle:** connected, with more than 5% and no more than 25% moving.
- **Exploring:** connected, with more than 25% and no more than 75% moving.
- **Highly Active:** connected, with more than 75% moving.

Movement means an adjacent valid sample changed by more than 100 Palworld world
units. These names describe telemetry patterns only.

### Operational flags

Flags identify threshold crossings that may help an administrator investigate:

- a stationary period lasting at least ten minutes;
- a movement jump above 200,000 world units, excluded as a likely teleport;
- two or more telemetry disconnects;
- observed movement at or above 1,000 world units per second;
- a newest position at least five minutes old;
- fewer than three samples or average valid sample spacing above three polling
  intervals.

If none apply, the panel explicitly reports **No notable events**. A telemetry
gap must exceed ten minutes (or six polling intervals when that is longer) to
count as a disconnect. This accommodates the collector's five-minute unchanged
position heartbeat without treating an idle player as disconnected.

### Movement calculations

The statistics show the selected data window, first and last activity, valid
active duration, sample and rendered-line counts, approximate distance, average
and peak speed, longest stationary period, disconnect and teleport/gap counts,
online state, position age, and moving/stationary percentages.

Invalid coordinates, likely teleports, and disconnected gaps contribute no
distance, speed, active duration, or moving/stationary time. Displayed metric
units use 100 Palworld world units per meter. Average speed is valid travel
distance divided by valid active duration; maximum speed is the highest valid
adjacent-sample speed.

### Timeline and insights

The timeline lists meaningful transitions—first observation, movement starting
or resuming, long stationary periods, telemetry disconnects/resumptions, and
the last online observation. It does not list every sample. Insights contain at
most two concise statements derived from movement percentage and disconnected
session count. They remain factual and do not speculate about player intent.

## Administrator calibration

Administrators can enable **Calibration** on the Map tab to inspect:

- the active raw bounds and rotation;
- polling interval;
- raw X/Y and normalized/map percentages for a selected player;
- the reason a connected player could not be mapped;
- a copyable, credential-free calibration record;
- safe viewport diagnostics covering the square surface, image, marker plane,
  zoom/pan, selected normalized position, screen rectangles, visibility,
  computed CSS dimensions, client dimensions, aspect ratio, and expanded state.

Administrators can select **Palpagos map**, **Calibration grid**, or **Map with
grid overlay**. The map image, optional grid, and markers share the same square
content box and transform, so zoom and pan remain synchronized.

The safe diagnostics output deliberately excludes server addresses, credentials,
tokens, passwords, and player IP addresses.

### Field calibration record

Live UAT on July 29, 2026 confirmed that the existing conversion and projection
place a player at world position `X -211552.453125, Y 262807.65625` at
`69.19%, 45.55%`, matching the observed in-game map position of approximately
`230, -191`. This validates the telemetry join and that observation, but the
projection constants still require three geographically separated landmarks
before PalCenter claims full-map calibration accuracy:

| World X/Y | Projected X/Y | Expected landmark | Observed alignment error |
| --------- | ------------- | ----------------- | ------------------------ |
| Pending   | Pending       | Landmark 1        | Pending                  |
| Pending   | Pending       | Landmark 2        | Pending                  |
| Pending   | Pending       | Landmark 3        | Pending                  |

Do not treat the current overlay as survey-accurate until all three rows contain
geographically separated live observations and acceptable measured error.

## Manual navigation UAT

Before release, verify in Chromium:

- at 1920×1080 and laptop widths, the normal viewport is at least 500px tall;
- opening Map shows the complete map in Fit Map state;
- zoom and pan transform only the internal square plane without changing the
  viewport dimensions or moving surrounding page content;
- panned content remains clipped by the viewport;
- wheel input over the map zooms without scrolling the page;
- the page still scrolls normally outside the map;
- Center Player reveals and briefly highlights the selected marker;
- expanded mode uses most of the browser height and retains the selected marker,
  layer, controls, and independently scrollable details;
- Escape closes expanded mode and restores the original normal dimensions;
- Fit Map recovers from extreme zoom and pan;
- the untransformed surface, image, grid, and marker plane remain square;
- the known `69.19%, 45.55%` observation appears in the expected area;
- the laptop, 1920×1080, and narrow/mobile layouts have no horizontal page
  overflow;
- copied diagnostics contain no server address, token, credential, password, or
  player IP.

## Current limitations

This milestone does not add or claim:

- multiple islands or world/map variants with separate bounds;
- heatmaps, analytics, or historical playback;
- `/game-data` collection, Z-axis display, guild data, bases, PalBoxes, or
  world actors;
- new polling loops, telemetry tables, or persistence behavior.

The coordinate source is the current `/players` telemetry foundation. If a
future game build changes its coordinate space or map bounds, the centralized
projection configuration and calibration tests must be updated together.

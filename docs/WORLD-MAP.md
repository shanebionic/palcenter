# Palpagos world map

PalCenter v1.4 includes an interactive Palpagos reference map for current
connected players. The position pipeline, controls, freshness indicators,
access controls, and administrator calibration tooling remain independent from
the bundled image layer.

## Asset and licensing decision

The repository bundles an 8192×8192 WebP copy of the Palpagos world map
published by The Palworld Wiki. The
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

The map is bundled in the application and is never hotlinked at runtime. The
PalCenter-owned CSS calibration grid remains available to Administrators as a
standalone layer or an overlay. The normal map layer is the default.

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

The map supports mouse, touch/pointer panning, scroll zoom, explicit zoom and
reset controls, keyboard-focusable marker buttons, accessible marker names,
and a visible focus indicator. Its square viewport scales down for narrow
screens, while details move beneath it.

## Administrator calibration

Administrators can enable **Calibration** on the Map tab to inspect:

- the active raw bounds and rotation;
- polling interval;
- raw X/Y and normalized/map percentages for a selected player;
- the reason a connected player could not be mapped;
- a copyable, credential-free calibration record.

Administrators can select **Palpagos map**, **Calibration grid**, or **Map with
grid overlay**. The map image, optional grid, and markers share the same square
content box and transform, so zoom and pan remain synchronized.

Validating the orientation against known in-game landmarks requires at least
three observed player locations distributed across the world. Until that field
calibration is recorded, exact visual alignment is not claimed.

### Field calibration record

The current projection constants have not yet passed a three-point field
calibration against the PalDen server. PalCenter attempted to reach the
configured PalDen REST API on July 28, 2026, but the server was unavailable
from the validation host. No credentials or network address were recorded. A
valid record must be collected while a player is standing at each named
landmark:

| World X/Y | Projected X/Y | Expected landmark | Observed alignment error |
| --------- | ------------- | ----------------- | ------------------------ |
| Pending   | Pending       | Landmark 1        | Pending                  |
| Pending   | Pending       | Landmark 2        | Pending                  |
| Pending   | Pending       | Landmark 3        | Pending                  |

Do not treat the current overlay as survey-accurate until all three rows contain
geographically separated live observations and acceptable measured error.

## Current limitations

This milestone does not add or claim:

- multiple islands or world/map variants with separate bounds;
- movement trails, heatmaps, analytics, or historical playback;
- `/game-data` collection, Z-axis display, guild data, bases, PalBoxes, or
  world actors;
- new polling loops, telemetry tables, or persistence behavior.

The coordinate source is the current `/players` telemetry foundation. If a
future game build changes its coordinate space or map bounds, the centralized
projection configuration and calibration tests must be updated together.

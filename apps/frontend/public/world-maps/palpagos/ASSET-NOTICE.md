# Palpagos world map asset notice

`world-map-2048.webp` and `world-map-4096.webp` are resized derivatives of the
T_WorldMap texture extracted from the owner's installed Palworld build
(Xbox, version 1.10.1283.0). The source texture and both derivatives remain
copyright Pocketpair, Inc. They are not covered by PalCenter's MIT license.

PalCenter is an unofficial community project and is not affiliated with,
endorsed by, or sponsored by Pocketpair, Inc. The image is included in
PalCenter, a free and noncommercial dedicated-server administration tool, only
as a functional reference layer for visualizing player-location data exposed
by Palworld's official REST API.

DT_WorldMapUIData supplied the game's terrain/map bounds. PalCenter currently
retains its existing live-validated telemetry projection because REST
telemetry coordinates have not yet been proven to use the same reference frame
as DT_WorldMapUIData. The existing projection constants are not authoritative
game terrain bounds.

Source, retrieval, derivative conversion settings, and checksums are recorded
in `source.json`. The upstream 8192×8192 binary is not shipped in PalCenter or
its production container. Pocketpair may request removal. Rights holders can
use the contact instructions in
[`THIRD_PARTY_ASSETS.md`](../../../../../THIRD_PARTY_ASSETS.md).

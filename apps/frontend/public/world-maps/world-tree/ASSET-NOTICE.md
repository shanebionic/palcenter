# World Tree map asset notice

`world-tree-2048.webp` and `world-tree-4096.webp` are resized derivatives of
the T_TreeMap texture extracted from the owner's installed Palworld build
(Xbox, version 1.10.1283.0). The source texture and both derivatives remain
copyright Pocketpair, Inc. They are not covered by PalCenter's MIT license.

PalCenter is an unofficial community project and is not affiliated with,
endorsed by, or sponsored by Pocketpair, Inc. The image is included in
PalCenter, a free and noncommercial dedicated-server administration tool, only
as a functional reference layer for visualizing player-location data exposed
by Palworld's official REST API.

Projection source and validation status:

1. Authoritative source: the DT_WorldMapUIData "Tree" row in the installed
   game build supplies the World Tree map bounds (landScapeRealPositionMin /
   landScapeRealPositionMax) in the same world reference frame as the game's
   MainMap row, which matches the owner-validated Palpagos telemetry
   projection exactly.
2. Mathematically verified transform: the raster mapping from those world
   bounds to the 8192×8192 texture is verified by round-trip unit tests.
3. Geographic/live-player validation: pending. The projection status is
   "pending-geographic-validation" until live World Tree player UAT confirms
   marker placement.

Source, retrieval, derivative conversion settings, and checksums are recorded
in `source.json`. The upstream 8192×8192 binary is not shipped in PalCenter or
its production container. Pocketpair may request removal. Rights holders can
use the contact instructions in
[`THIRD_PARTY_ASSETS.md`](../../../../../THIRD_PARTY_ASSETS.md).

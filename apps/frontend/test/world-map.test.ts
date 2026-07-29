import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  defaultWorldMapLayer,
  worldMapAssetPath,
  worldMapAssetSrcSet,
  worldMapLayerClasses,
} from "../lib/world-map/layers";
import {
  buildLivePlayerMapModel,
  calibrationRecord,
  classifyTelemetryFreshness,
  mapContentState,
  mapAccessForRole,
  playerMapDetailValues,
  playerMarkerPresentation,
  telemetryFreshnessLabel,
} from "../lib/world-map/model";
import {
  centerMapOnPosition,
  clampMapZoom,
  constrainMapPan,
  fitMapView,
  mapSurfaceSize,
  markerInverseScale,
  rectanglesIntersect,
  zoomMapAtPointer,
} from "../lib/world-map/navigation";
import {
  normalizedMapPositionToWorld,
  palpagosProjection,
  worldToNormalizedMapPosition,
  type MapProjectionConfiguration,
} from "../lib/world-map/projection";
import type { ConnectedPlayer, PlayerPositionSnapshot } from "../types/servers";

test("bundles attributed responsive Palpagos derivatives with verified metadata", async () => {
  const assetDirectory = new URL(
    "../public/world-maps/palpagos/",
    import.meta.url,
  );
  const source = await readFile(new URL("source.json", assetDirectory), "utf8");
  const metadata = JSON.parse(source) as {
    upstreamSource: {
      filePage: string;
      dimensions: { width: number; height: number };
    };
    bundledDerivatives: Array<{
      filename: string;
      dimensions: { width: number; height: number };
      sha256: string;
      compressedSizeBytes: number;
    }>;
  };

  assert.equal(worldMapAssetPath, "/world-maps/palpagos/world-map-2048.webp");
  assert.equal(worldMapAssetSrcSet.includes("https://"), false);
  assert.equal(metadata.upstreamSource.filePage.startsWith("https://"), true);
  assert.deepEqual(metadata.upstreamSource.dimensions, {
    width: 8192,
    height: 8192,
  });
  assert.equal(metadata.bundledDerivatives.length, 2);

  for (const derivative of metadata.bundledDerivatives) {
    const asset = await readFile(new URL(derivative.filename, assetDirectory));
    assert.deepEqual(readWebpDimensions(asset), derivative.dimensions);
    assert.equal(asset.byteLength, derivative.compressedSizeBytes);
    assert.equal(
      createHash("sha256").update(asset).digest("hex"),
      derivative.sha256,
    );
  }

  await assert.rejects(
    readFile(new URL("world-map.webp", assetDirectory)),
    (error: NodeJS.ErrnoException) => error.code === "ENOENT",
  );
});

test("serves bundled world maps without an authentication redirect", async () => {
  const proxySource = await readFile(
    new URL("../proxy.ts", import.meta.url),
    "utf8",
  );
  assert.match(proxySource, /\(\?!api\|assets\|world-maps\|/);
});

test("selects map and calibration grid layers without changing projection", () => {
  assert.equal(defaultWorldMapLayer, "map");
  assert.equal(
    worldMapLayerClasses("map"),
    "pc-world-map-surface pc-world-map-surface-map",
  );
  assert.equal(
    worldMapLayerClasses("grid"),
    "pc-world-map-surface pc-world-map-surface-grid",
  );
  assert.equal(
    worldMapLayerClasses("map-with-grid"),
    "pc-world-map-surface pc-world-map-surface-map pc-world-map-surface-grid",
  );
});

function readWebpDimensions(asset: Buffer): {
  width: number;
  height: number;
} {
  assert.equal(asset.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(asset.subarray(8, 12).toString("ascii"), "WEBP");
  assert.equal(asset.subarray(12, 16).toString("ascii"), "VP8 ");
  assert.deepEqual([...asset.subarray(23, 26)], [0x9d, 0x01, 0x2a]);

  return {
    width: asset.readUInt16LE(26) & 0x3fff,
    height: asset.readUInt16LE(28) & 0x3fff,
  };
}

test("projects the documented world bounds and center onto the map", () => {
  assert.deepEqual(
    worldToNormalizedMapPosition(
      { x: palpagosProjection.worldMinX, y: palpagosProjection.worldMinY },
      palpagosProjection,
    ),
    { x: 0, y: 1 },
  );
  assert.deepEqual(
    worldToNormalizedMapPosition(
      { x: palpagosProjection.worldMaxX, y: palpagosProjection.worldMaxY },
      palpagosProjection,
    ),
    { x: 1, y: 0 },
  );
  assert.deepEqual(
    worldToNormalizedMapPosition(
      { x: palpagosProjection.worldMinX, y: palpagosProjection.worldMaxY },
      palpagosProjection,
    ),
    { x: 1, y: 1 },
  );
  assert.deepEqual(
    worldToNormalizedMapPosition(
      { x: palpagosProjection.worldMaxX, y: palpagosProjection.worldMinY },
      palpagosProjection,
    ),
    { x: 0, y: 0 },
  );
  assert.deepEqual(
    worldToNormalizedMapPosition(
      {
        x: (palpagosProjection.worldMinX + palpagosProjection.worldMaxX) / 2,
        y: (palpagosProjection.worldMinY + palpagosProjection.worldMaxY) / 2,
      },
      palpagosProjection,
    ),
    { x: 0.5, y: 0.5 },
  );
});

test("supports inversion and rotation as centralized projection options", () => {
  const configuration: MapProjectionConfiguration = {
    worldMinX: -100,
    worldMaxX: 100,
    worldMinY: -100,
    worldMaxY: 100,
    invertX: true,
    invertY: false,
    rotationDegrees: 0,
  };

  assert.deepEqual(
    worldToNormalizedMapPosition({ x: -50, y: 50 }, configuration),
    { x: 0.75, y: 0.75 },
  );
  assert.deepEqual(
    worldToNormalizedMapPosition(
      { x: -50, y: 50 },
      { ...configuration, invertX: false, invertY: true },
    ),
    { x: 0.25, y: 0.25 },
  );
});

test("rejects invalid or out-of-bounds coordinates", () => {
  assert.equal(worldToNormalizedMapPosition(null, palpagosProjection), null);
  assert.equal(
    worldToNormalizedMapPosition({ x: Number.NaN, y: 0 }, palpagosProjection),
    null,
  );
  assert.equal(
    worldToNormalizedMapPosition(
      { x: palpagosProjection.worldMaxX + 1, y: 0 },
      palpagosProjection,
    ),
    null,
  );
});

test("round trips a negative world coordinate through the projection", () => {
  const world = { x: -250_000, y: -125_000 };
  const normalized = worldToNormalizedMapPosition(world, palpagosProjection);
  assert.ok(normalized);
  const result = normalizedMapPositionToWorld(normalized, palpagosProjection);
  assert.ok(result);
  assert.ok(Math.abs(result.x - world.x) < 0.001);
  assert.ok(Math.abs(result.y - world.y) < 0.001);
});

test("classifies telemetry freshness at the documented thresholds", () => {
  const now = new Date("2026-07-28T12:10:00.000Z");
  assert.equal(
    classifyTelemetryFreshness("2026-07-28T12:09:01.000Z", 30, now),
    "live",
  );
  assert.equal(
    classifyTelemetryFreshness("2026-07-28T12:08:59.000Z", 30, now),
    "delayed",
  );
  assert.equal(
    classifyTelemetryFreshness("2026-07-28T12:04:59.000Z", 30, now),
    "stale",
  );
  assert.equal(telemetryFreshnessLabel("delayed"), "Delayed");
});

test("maps only currently connected players with valid telemetry by userId", () => {
  const players: ConnectedPlayer[] = [
    connectedPlayer("uid-1", "pid-current", "Lamball"),
    connectedPlayer("uid-2", "pid-2", "Cattiva"),
    connectedPlayer("uid-3", "pid-3", "Chikipi"),
  ];
  const telemetry = [
    snapshot({
      userId: "uid-1",
      playerId: "pid-snapshot",
      x: -250_000,
      y: 100_000,
    }),
    snapshot({ userId: "uid-2", playerId: "pid-2", x: null, y: 100 }),
    snapshot({
      userId: "disconnected",
      playerId: "pid-old",
      x: 0,
      y: 0,
    }),
  ];

  const model = buildLivePlayerMapModel(
    players,
    telemetry,
    palpagosProjection,
    30,
    "2026-07-28T12:09:45.000Z",
    new Date("2026-07-28T12:10:00.000Z"),
  );

  assert.equal(model.markers.length, 1);
  assert.equal(model.markers[0]?.userId, "uid-1");
  assert.equal(model.markers[0]?.playerId, "pid-snapshot");
  assert.equal(model.markers[0]?.playerName, "Lamball");
  assert.equal(model.markers[0]?.freshness, "live");
  assert.deepEqual(
    model.unmappedPlayers.map((player) => player.reason),
    ["invalid_coordinates", "missing_telemetry"],
  );
  assert.equal(JSON.stringify(model).includes("192.0.2.10"), false);
});

test("represents online marker details without exposing the player IP", () => {
  const model = buildLivePlayerMapModel(
    [connectedPlayer("uid-1", "pid-1", "Lifmunk")],
    [snapshot({ userId: "uid-1", playerId: "pid-1", x: 10, y: 20 })],
    palpagosProjection,
    30,
    null,
    new Date("2026-07-28T12:00:30.000Z"),
  );
  const details = playerMapDetailValues(
    model.markers[0]!,
    new Date("2026-07-28T12:00:30.000Z"),
  );

  assert.deepEqual(details, {
    playerName: "Lifmunk",
    accountName: "Account",
    playerId: "pid-1",
    userId: "uid-1",
    level: 20,
    ping: "42 ms",
    buildingCount: 3,
    worldCoordinates: "X 10.0 · Y 20.0",
    telemetryAge: "30s ago",
  });
  assert.equal(JSON.stringify(details).includes("192.0.2.10"), false);
});

test("marks out-of-bounds current players as unavailable", () => {
  const model = buildLivePlayerMapModel(
    [connectedPlayer("uid-1", "pid-1", "Foxparks")],
    [
      snapshot({
        userId: "uid-1",
        playerId: "pid-1",
        x: palpagosProjection.worldMaxX + 100,
        y: 0,
      }),
    ],
    palpagosProjection,
    30,
    null,
  );

  assert.equal(model.markers.length, 0);
  assert.equal(model.unmappedPlayers[0]?.reason, "outside_bounds");
});

test("keeps map access aligned with the existing Players tab", () => {
  assert.deepEqual(mapAccessForRole("administrator"), {
    canView: true,
    canCalibrate: true,
  });
  assert.deepEqual(mapAccessForRole("moderator"), {
    canView: true,
    canCalibrate: false,
  });
  assert.deepEqual(mapAccessForRole("visitor"), {
    canView: false,
    canCalibrate: false,
  });
});

test("distinguishes loading, offline, empty, API failure, and ready states", () => {
  assert.equal(
    mapContentState({
      loading: true,
      serverOnline: true,
      playerRequestFailed: false,
      connectedPlayerCount: 1,
    }),
    "loading",
  );
  assert.equal(
    mapContentState({
      loading: false,
      serverOnline: false,
      playerRequestFailed: false,
      connectedPlayerCount: 0,
    }),
    "offline",
  );
  assert.equal(
    mapContentState({
      loading: false,
      serverOnline: true,
      playerRequestFailed: true,
      connectedPlayerCount: 0,
    }),
    "unavailable",
  );
  assert.equal(
    mapContentState({
      loading: false,
      serverOnline: true,
      playerRequestFailed: false,
      connectedPlayerCount: 0,
    }),
    "empty",
  );
  assert.equal(
    mapContentState({
      loading: false,
      serverOnline: true,
      playerRequestFailed: false,
      connectedPlayerCount: 1,
    }),
    "ready",
  );
});

test("calibration output contains coordinates but no network address", () => {
  const model = buildLivePlayerMapModel(
    [connectedPlayer("uid-1", "pid-1", "Mozzarina")],
    [snapshot({ userId: "uid-1", playerId: "pid-1", x: 0, y: 0 })],
    palpagosProjection,
    30,
    null,
  );
  const output = calibrationRecord(model.markers[0]!);
  assert.match(output, /World: 0, 0/);
  assert.doesNotMatch(output, /192\.0\.2\.10/);
});

test("starts fitted and computes a square surface from the available viewport", () => {
  assert.deepEqual(fitMapView(), { zoom: 1, pan: { x: 0, y: 0 } });
  assert.equal(mapSurfaceSize({ width: 1200, height: 700 }), 700);
});

test("counter-scales marker visuals against valid map zoom", () => {
  assert.equal(markerInverseScale(1), 1);
  assert.equal(markerInverseScale(2), 0.5);
  assert.ok(Math.abs(markerInverseScale(3) - 1 / 3) < 0.0001);
  assert.equal(markerInverseScale(4), 0.25);

  for (const invalidZoom of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const scale = markerInverseScale(invalidZoom);
    assert.equal(scale, 1);
    assert.equal(Number.isFinite(scale), true);
  }
});

test("gives normal and expanded map viewports stable independent dimensions", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const normalViewport = css.match(
    /\.pc-world-map-viewport\s*\{(?<rules>[\s\S]*?)\}/,
  )?.groups?.rules;
  assert.ok(normalViewport);
  assert.match(normalViewport, /position:\s*relative/);
  assert.match(normalViewport, /width:\s*100%/);
  assert.match(normalViewport, /height:\s*clamp\(500px,\s*65vh,\s*760px\)/);
  assert.match(normalViewport, /min-height:\s*500px/);
  assert.match(normalViewport, /overflow:\s*hidden/);

  const expandedRoot = css.match(
    /\.pc-world-map-layout\.pc-world-map-expanded\s*\{(?<rules>[\s\S]*?)\}/,
  )?.groups?.rules;
  assert.ok(expandedRoot);
  assert.match(expandedRoot, /overflow:\s*hidden/);
  assert.doesNotMatch(expandedRoot, /overflow:\s*auto/);

  const expandedViewport = css.match(
    /\.pc-world-map-expanded \.pc-world-map-viewport\s*\{(?<rules>[\s\S]*?)\}/,
  )?.groups?.rules;
  assert.ok(expandedViewport);
  assert.match(expandedViewport, /height:\s*calc\(100vh - 8rem\)/);
  assert.match(expandedViewport, /max-height:\s*none/);
});

test("centers a normalized marker without changing its projected position", () => {
  const view = centerMapOnPosition(
    { x: 0.6919, y: 0.4555 },
    { width: 800, height: 600 },
    600,
    2,
  );
  assert.equal(view.zoom, 2);
  assert.ok(Math.abs(view.pan.x - -230.28) < 0.001);
  assert.ok(Math.abs(view.pan.y - 53.4) < 0.001);
});

test("zooms around the pointer and clamps zoom and recoverable pan", () => {
  assert.equal(clampMapZoom(0), 1);
  assert.equal(clampMapZoom(8), 4);
  assert.deepEqual(
    zoomMapAtPointer({
      view: { zoom: 1, pan: { x: 0, y: 0 } },
      nextZoom: 2,
      pointer: { x: 100, y: -50 },
      viewport: { width: 800, height: 600 },
      surfaceSize: 600,
    }),
    { zoom: 2, pan: { x: -100, y: 50 } },
  );
  assert.deepEqual(
    constrainMapPan(
      { x: 50_000, y: -50_000 },
      { width: 800, height: 600 },
      600,
      2,
    ),
    { x: 952, y: -852 },
  );
});

test("detects whether a marker intersects the clipping viewport", () => {
  const viewport = { left: 0, top: 0, right: 800, bottom: 600 };
  assert.equal(
    rectanglesIntersect(viewport, {
      left: 100,
      top: 100,
      right: 120,
      bottom: 120,
    }),
    true,
  );
  assert.equal(
    rectanglesIntersect(viewport, {
      left: 900,
      top: 100,
      right: 920,
      bottom: 120,
    }),
    false,
  );
});

test("presents player marker names once without substituting account names", () => {
  assert.deepEqual(playerMarkerPresentation("Denalb"), {
    displayName: "Denalb",
    initial: "D",
    accessibleName: "View Denalb on map",
  });
  assert.equal(
    playerMarkerPresentation("Denalb").accessibleName.match(/Denalb/g)?.length,
    1,
  );
  assert.deepEqual(playerMarkerPresentation("D"), {
    displayName: "D",
    initial: "D",
    accessibleName: "View D on map",
  });
  assert.equal(playerMarkerPresentation("Élodie").initial, "É");
  assert.equal(playerMarkerPresentation("").displayName, "Unknown player");
  assert.equal(playerMarkerPresentation(null).displayName, "Unknown player");

  const duplicates = [
    { userId: "one", ...playerMarkerPresentation("Denalb") },
    { userId: "two", ...playerMarkerPresentation("Denalb") },
  ];
  assert.equal(duplicates[0]?.displayName, duplicates[1]?.displayName);
  assert.notEqual(duplicates[0]?.userId, duplicates[1]?.userId);
  assert.notEqual(playerMarkerPresentation("Denalb").displayName, "Denalb3032");
});

test("keeps the marker initial and floating label decorative", async () => {
  const source = await readFile(
    new URL("../components/ServerWorldMap.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /<span aria-hidden="true">\{presentation\.initial\}<\/span>/,
  );
  assert.match(source, /aria-label=\{presentation\.accessibleName\}/);
  assert.match(source, /className="pc-world-map-marker-position"/);
  assert.match(source, /className="pc-world-map-marker-visual"/);
  assert.match(
    source,
    /transform: `scale\(\$\{markerInverseScale\(zoom\)\}\)`/,
  );
  assert.match(
    source,
    /className="pc-world-map-marker-label"\s+aria-hidden="true"[\s\S]*?\{presentation\.displayName\}/,
  );
  assert.equal(
    source.match(/\{presentation\.displayName\}/g)?.length,
    1,
    "the floating visual label renders the display name exactly once",
  );

  const denalb = playerMarkerPresentation("Denalb");
  assert.equal(denalb.accessibleName, "View Denalb on map");
  assert.equal(denalb.accessibleName.match(/Denalb/g)?.length, 1);
  assert.equal(denalb.displayName, "Denalb");
});

test("keeps the connected display name and telemetry account name distinct", () => {
  const model = buildLivePlayerMapModel(
    [connectedPlayer("uid-denalb", "pid-denalb", "Denalb")],
    [
      {
        ...snapshot({
          userId: "uid-denalb",
          playerId: "pid-denalb",
          x: -211_552.453125,
          y: 262_807.65625,
        }),
        accountName: "Denalb3032",
      },
    ],
    palpagosProjection,
    30,
    null,
  );
  const details = playerMapDetailValues(model.markers[0]!);
  assert.equal(details.playerName, "Denalb");
  assert.equal(details.accountName, "Denalb3032");
});

function connectedPlayer(
  userId: string,
  playerId: string,
  name: string,
): ConnectedPlayer {
  return {
    name,
    playerId,
    userId,
    ip: "192.0.2.10",
    status: "online",
  };
}

function snapshot(
  overrides: Pick<PlayerPositionSnapshot, "userId" | "playerId" | "x" | "y">,
): PlayerPositionSnapshot {
  return {
    id: 1,
    serverId: "srv-1",
    userId: overrides.userId,
    playerId: overrides.playerId,
    playerName: "Historical name",
    accountName: "Account",
    capturedAt: "2026-07-28T12:00:00.000Z",
    x: overrides.x,
    y: overrides.y,
    z: null,
    level: 20,
    ping: 42,
    buildingCount: 3,
    guildId: null,
    guildName: null,
    createdAt: "2026-07-28T12:00:00.000Z",
  };
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  worldMapAssetPath,
  worldMapAssetSrcSet,
  worldTreeMapAssetPath,
  worldTreeMapAssetSrcSet,
} from "../lib/world-map/layers";
import {
  buildBaseMapMarkers,
  buildLivePlayerMapModel,
  classifyTelemetryFreshness,
  isCrossMapUnmappedReason,
  mapContentState,
  mapLocationStatus,
  otherMapPlayerCopy,
  playerMapDetailValues,
  playerMarkerPresentation,
  telemetryFreshnessLabel,
  UNAVAILABLE_PLAYER_LOCATION_LABEL,
  type UnmappedPlayerReason,
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
  worldTreeProjection,
  type MapProjectionConfiguration,
} from "../lib/world-map/projection";
import {
  buildRenderedTrailSegments,
  maximumRenderedTrailSegments,
  newestTrailBrightness,
  newestTrailOpacity,
  newestTrailStrokeWidth,
  oldestTrailBrightness,
  oldestTrailOpacity,
  oldestTrailStrokeWidth,
  processMovementTrail,
  trailAgeRatio,
  trailPolylinePoints,
  trailStyle,
} from "../lib/world-map/trail";
import { isPlayerColor, playerColor } from "../lib/world-map/player-color";
import {
  enabledWorldMapDefinitions,
  palpagosMapDefinition,
  worldTreeMapDefinition,
} from "../lib/world-map/map-definitions";
import type { ConnectedPlayer, PlayerPositionSnapshot } from "../types/servers";
import type { PalDefenderBase } from "../lib/api";

test("assigns stable readable player colors from userId", () => {
  assert.equal(playerColor("user-a"), playerColor("user-a"));
  const colors = [
    playerColor("user-a"),
    playerColor("user-b"),
    playerColor("gdk_2533274899179326"),
  ];
  assert.equal(new Set(colors).size, colors.length);
  for (const color of colors) {
    assert.match(color, /^#[0-9a-f]{6}$/i);
    assert.equal(isPlayerColor(color), true);
  }
});

test("exposes only verified map definitions for selection", () => {
  assert.equal(palpagosMapDefinition.supportsLivePlotting, true);
  assert.equal(palpagosMapDefinition.enabled, true);
  assert.equal(worldTreeMapDefinition.enabled, true);
  assert.ok(worldTreeMapDefinition.projection !== null);
  assert.equal(
    worldTreeMapDefinition.projectionVersion,
    "world-tree-dt-world-map-ui-v1-owner-validated",
  );
  assert.deepEqual(
    enabledWorldMapDefinitions().map(
      ({ coordinateSpaceId }) => coordinateSpaceId,
    ),
    ["palpagos", "world_tree"],
  );
});

test("classifies online player location states symmetrically across maps", () => {
  assert.deepEqual(
    mapLocationStatus({
      onMap: true,
      unmappedReason: null,
      activeMapId: "palpagos",
      activeMapName: "Palpagos",
    }),
    { kind: "on-map", label: "On Palpagos", targetMapId: null },
  );
  assert.deepEqual(
    mapLocationStatus({
      onMap: true,
      unmappedReason: null,
      activeMapId: "world_tree",
      activeMapName: "World Tree",
    }),
    { kind: "on-map", label: "In World Tree", targetMapId: null },
  );
  assert.deepEqual(
    mapLocationStatus({
      onMap: false,
      unmappedReason: "world_tree",
      activeMapId: "palpagos",
      activeMapName: "Palpagos",
    }),
    { kind: "other-map", label: "In World Tree", targetMapId: "world_tree" },
  );
  assert.deepEqual(
    mapLocationStatus({
      onMap: false,
      unmappedReason: "palpagos",
      activeMapId: "world_tree",
      activeMapName: "World Tree",
    }),
    { kind: "other-map", label: "On Palpagos", targetMapId: "palpagos" },
  );
  const unavailableReasons: UnmappedPlayerReason[] = [
    "missing_telemetry",
    "invalid_coordinates",
    "outside_bounds",
    "instanced_area",
    "unsupported_space",
    "unknown_space",
    "stale_position",
  ];
  for (const reason of unavailableReasons) {
    const status = mapLocationStatus({
      onMap: false,
      unmappedReason: reason,
      activeMapId: "palpagos",
      activeMapName: "Palpagos",
    });
    assert.equal(status.kind, "unavailable");
    assert.equal(status.label, UNAVAILABLE_PLAYER_LOCATION_LABEL);
    assert.equal(status.targetMapId, null);
  }
  assert.equal(isCrossMapUnmappedReason("world_tree"), true);
  assert.equal(isCrossMapUnmappedReason("outside_bounds"), false);
  assert.deepEqual(otherMapPlayerCopy("world_tree"), {
    statusLabel: "In World Tree",
    viewLabel: "View on World Tree",
    targetMapId: "world_tree",
  });
  assert.equal(otherMapPlayerCopy("stale_position"), null);
});

test("calculates safe timestamp-based trail age and bounded styles", () => {
  const oldest = "2026-07-28T12:00:00.000Z";
  const newest = "2026-07-28T14:00:00.000Z";
  assert.equal(trailAgeRatio(oldest, oldest, newest), 0);
  assert.equal(trailAgeRatio("2026-07-28T13:00:00.000Z", oldest, newest), 0.5);
  assert.equal(trailAgeRatio(newest, oldest, newest), 1);
  assert.equal(trailAgeRatio(oldest, oldest, oldest), 1);
  assert.equal(trailAgeRatio("invalid", oldest, newest), 0);
  assert.equal(trailAgeRatio(oldest, null, newest), 0);
  assert.equal(oldestTrailOpacity, 0.35);
  assert.equal(newestTrailOpacity, 0.95);
  assert.equal(oldestTrailStrokeWidth, 1.2);
  assert.equal(newestTrailStrokeWidth, 1.5);
  assert.equal(oldestTrailBrightness, 0.85);
  assert.equal(newestTrailBrightness, 1);

  for (const ratio of [-1, 0, 0.5, 1, 2, Number.NaN]) {
    const style = trailStyle(ratio);
    assert.ok(style.opacity >= oldestTrailOpacity);
    assert.ok(style.opacity <= newestTrailOpacity);
    assert.ok(style.strokeWidth >= oldestTrailStrokeWidth);
    assert.ok(style.strokeWidth <= newestTrailStrokeWidth);
  }
});

test("normalizes every requested range over the trail data actually returned", () => {
  const renderedRatios = (
    requestedMinutes: number,
    returnedMinutes: number,
  ): number[] => {
    const start = Date.UTC(2026, 6, 28, 12);
    const points = [0, returnedMinutes / 2, returnedMinutes].map(
      (minute, index) => ({
        capturedAt: new Date(start + minute * 60_000).toISOString(),
        x: index / 10,
        y: index / 10,
        worldX: index * 1_000,
        worldY: index * 1_000,
      }),
    );
    const trail: import("../lib/world-map/trail").ProcessedTrail = {
      segments: [points],
      pointCount: points.length,
      approximateDistance: 0,
      firstTimestamp: new Date(
        start - (requestedMinutes - returnedMinutes) * 60_000,
      ).toISOString(),
      lastTimestamp: points.at(-1)!.capturedAt,
      exclusions: {
        invalid: 0,
        duplicate: 0,
        simplified: 0,
        timeGap: 0,
        teleport: 0,
      },
    };
    return buildRenderedTrailSegments(trail).map((segment) => segment.ageRatio);
  };

  const rangeCases: Array<[number, number]> = [
    [15, 15],
    [60, 60],
    [360, 360],
    [1_440, 1_440],
    [1_440, 20],
  ];
  for (const [requestedMinutes, returnedMinutes] of rangeCases) {
    const ratios = renderedRatios(requestedMinutes, returnedMinutes);
    assert.ok(ratios[0]! <= 0.001);
    assert.equal(ratios.at(-1), 1);
  }
});

test("renders age-aware disconnected paths with a strict element bound", () => {
  const point = (
    capturedAt: string,
    x: number,
    y: number,
  ): import("../lib/world-map/trail").ProjectedTrailPoint => ({
    capturedAt,
    x,
    y,
    worldX: x * 1000,
    worldY: y * 1000,
  });
  const trail: import("../lib/world-map/trail").ProcessedTrail = {
    segments: [
      [
        point("2026-07-28T12:00:00.000Z", 0.1, 0.1),
        point("2026-07-28T12:30:00.000Z", 0.2, 0.2),
      ],
      [
        point("2026-07-28T13:30:00.000Z", 0.7, 0.7),
        point("2026-07-28T14:00:00.000Z", 0.8, 0.8),
      ],
    ],
    pointCount: 4,
    approximateDistance: 0,
    firstTimestamp: "2026-07-28T12:00:00.000Z",
    lastTimestamp: "2026-07-28T14:00:00.000Z",
    exclusions: {
      invalid: 0,
      duplicate: 0,
      simplified: 0,
      timeGap: 1,
      teleport: 0,
    },
  };
  const rendered = buildRenderedTrailSegments(trail);
  assert.equal(rendered.length, 2);
  assert.ok(rendered[0]!.style.opacity < rendered[1]!.style.opacity);
  assert.equal(rendered[1]!.ageRatio, 1);
  assert.notEqual(rendered[0]!.end.x, rendered[1]!.start.x);

  const empty = { ...trail, segments: [], pointCount: 0 };
  assert.deepEqual(buildRenderedTrailSegments(empty), []);
  const single = {
    ...trail,
    segments: [[trail.segments[0]![0]!]],
    pointCount: 1,
  };
  assert.deepEqual(buildRenderedTrailSegments(single), []);

  const dense = {
    ...trail,
    segments: [
      Array.from({ length: 2_000 }, (_, index) =>
        point(
          new Date(Date.UTC(2026, 6, 28) + index * 1_000).toISOString(),
          index / 2_000,
          index / 2_000,
        ),
      ),
    ],
    pointCount: 2_000,
  };
  assert.equal(
    buildRenderedTrailSegments(dense).length,
    maximumRenderedTrailSegments,
  );
});

test("caps dense trails by rebuilding connected lines within each path", () => {
  const point = (
    index: number,
    pathOffset: number,
  ): import("../lib/world-map/trail").ProjectedTrailPoint => ({
    capturedAt: new Date(
      Date.UTC(2026, 6, 28, 12) + (pathOffset + index) * 1_000,
    ).toISOString(),
    x: pathOffset + index,
    y: pathOffset + index,
    worldX: (pathOffset + index) * 1000,
    worldY: (pathOffset + index) * 1000,
  });
  const firstPath = Array.from({ length: 351 }, (_, index) => point(index, 0));
  const secondPath = Array.from({ length: 301 }, (_, index) =>
    point(index, 10_000),
  );
  const trail: import("../lib/world-map/trail").ProcessedTrail = {
    segments: [firstPath, secondPath],
    pointCount: firstPath.length + secondPath.length,
    approximateDistance: 0,
    firstTimestamp: firstPath[0]!.capturedAt,
    lastTimestamp: secondPath.at(-1)!.capturedAt,
    exclusions: {
      invalid: 0,
      duplicate: 0,
      simplified: 0,
      timeGap: 1,
      teleport: 0,
    },
  };

  const rendered = buildRenderedTrailSegments(trail);
  assert.ok(rendered.length <= maximumRenderedTrailSegments);
  assert.equal(rendered.length, maximumRenderedTrailSegments);

  for (const pathIndex of [0, 1]) {
    const sourcePath = trail.segments[pathIndex]!;
    const renderedPath = rendered.filter(
      (segment) => segment.pathIndex === pathIndex,
    );
    assert.equal(renderedPath[0]!.start, sourcePath[0]);
    assert.equal(renderedPath.at(-1)!.end, sourcePath.at(-1));
    for (let index = 1; index < renderedPath.length; index += 1) {
      assert.equal(renderedPath[index - 1]!.end, renderedPath[index]!.start);
    }
  }

  const firstRenderedPath = rendered.filter(
    (segment) => segment.pathIndex === 0,
  );
  const secondRenderedPath = rendered.filter(
    (segment) => segment.pathIndex === 1,
  );
  assert.notEqual(firstRenderedPath.at(-1)!.end, secondRenderedPath[0]!.start);
  assert.equal(rendered.at(-1)!.end, secondPath.at(-1));
  assert.equal(rendered.at(-1)!.ageRatio, 1);
});

test("movement trails sort, project, deduplicate, and preserve endpoints", () => {
  const points = [
    { capturedAt: "2026-07-28T12:02:00.000Z", x: -200_000, y: 200_000 },
    { capturedAt: "2026-07-28T12:00:00.000Z", x: -210_000, y: 190_000 },
    { capturedAt: "2026-07-28T12:01:00.000Z", x: -210_000, y: 190_000 },
  ];
  const trail = processMovementTrail(points, palpagosProjection, {
    pollingIntervalSeconds: 30,
    minimumNormalizedMovement: 0,
  });
  assert.equal(trail.pointCount, 2);
  assert.equal(trail.exclusions.duplicate, 1);
  assert.equal(trail.firstTimestamp, "2026-07-28T12:00:00.000Z");
  assert.equal(trail.lastTimestamp, "2026-07-28T12:02:00.000Z");
  assert.ok(trail.approximateDistance > 0);
  const segment = trail.segments[0];
  assert.ok(segment);
  assert.equal(
    segment[0]?.x,
    worldToNormalizedMapPosition(
      { x: -210_000, y: 190_000 },
      palpagosProjection,
    )?.x,
  );
  assert.notEqual(trailPolylinePoints(segment), "");
});

test("movement trails reject invalid points and split gaps and teleports", () => {
  const trail = processMovementTrail(
    [
      { capturedAt: "invalid", x: 0, y: 0 },
      { capturedAt: "2026-07-28T12:00:00.000Z", x: -200_000, y: 200_000 },
      { capturedAt: "2026-07-28T12:05:00.000Z", x: -190_000, y: 210_000 },
      { capturedAt: "2026-07-28T12:05:30.000Z", x: 100_000, y: 400_000 },
    ],
    palpagosProjection,
    { pollingIntervalSeconds: 30 },
  );
  assert.equal(trail.exclusions.invalid, 1);
  assert.equal(trail.exclusions.timeGap, 1);
  assert.equal(trail.exclusions.teleport, 1);
  assert.equal(trail.segments.length, 3);
});

test("movement trail simplification retains first and last points", () => {
  const trail = processMovementTrail(
    Array.from({ length: 1000 }, (_, index) => ({
      capturedAt: new Date(Date.UTC(2026, 6, 28, 12, 0, index)).toISOString(),
      x: -200_000 + index,
      y: 200_000 + index,
    })),
    palpagosProjection,
    { pollingIntervalSeconds: 30, minimumNormalizedMovement: 0.0001 },
  );
  assert.ok(trail.pointCount < 1000);
  const segment = trail.segments[0];
  assert.ok(segment);
  assert.equal(segment[0]?.worldX, -200_000);
  assert.equal(segment.at(-1)?.worldX, -199_001);
  assert.ok(trail.exclusions.simplified > 0);
});

test("dense 24-hour movement history remains bounded for rendering", () => {
  const startedAt = performance.now();
  const trail = processMovementTrail(
    Array.from({ length: 5000 }, (_, index) => ({
      capturedAt: new Date(
        Date.UTC(2026, 6, 28) + index * 17_280,
      ).toISOString(),
      x: -300_000 + index * 5,
      y: 100_000 + Math.sin(index / 20) * 2_000,
    })),
    palpagosProjection,
    { pollingIntervalSeconds: 30 },
  );
  const durationMs = performance.now() - startedAt;
  assert.ok(trail.pointCount < 5000);
  assert.ok(trail.segments.length >= 1);
  assert.ok(durationMs < 500, `trail processing took ${durationMs}ms`);
});

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
  assert.ok(
    metadata.upstreamSource.filePage.startsWith("https://") ||
      metadata.upstreamSource.filePage.startsWith("DT_WorldMapUIData"),
    "upstream source must be a URL or first-party extraction record",
  );
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

test("bundles attributed responsive World Tree derivatives with verified metadata", async () => {
  const assetDirectory = new URL(
    "../public/world-maps/world-tree/",
    import.meta.url,
  );
  const source = await readFile(new URL("source.json", assetDirectory), "utf8");
  const metadata = JSON.parse(source) as {
    upstreamSource: {
      installedBuild: string;
      dtRow: string;
      landScapeRealPositionMin: [number, number];
      landScapeRealPositionMax: [number, number];
      dimensions: { width: number; height: number };
    };
    bundledDerivatives: Array<{
      filename: string;
      dimensions: { width: number; height: number };
      sha256: string;
      compressedSizeBytes: number;
      conversionCommand: string;
    }>;
  };

  assert.equal(
    worldTreeMapAssetPath,
    "/world-maps/world-tree/world-tree-2048.webp",
  );
  assert.equal(worldTreeMapAssetSrcSet.includes("https://"), false);
  assert.equal(
    metadata.upstreamSource.installedBuild,
    "1.10.1283.0 (Xbox/WinGDK)",
  );
  assert.equal(metadata.upstreamSource.dtRow, "Tree");
  assert.deepEqual(
    metadata.upstreamSource.landScapeRealPositionMin,
    [347351.5, -818197],
  );
  assert.deepEqual(
    metadata.upstreamSource.landScapeRealPositionMax,
    [689148.5, -476400],
  );
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
    assert.match(derivative.conversionCommand, /sharp-cli@5\.2\.0/);
    assert.ok(
      !derivative.conversionCommand.includes("http"),
      "deterministic conversion command must not fetch remote content",
    );
  }

  // The projection constants must match the recorded DT bounds.
  assert.equal(
    worldTreeProjection.worldMinX,
    metadata.upstreamSource.landScapeRealPositionMin[0],
  );
  assert.equal(
    worldTreeProjection.worldMaxX,
    metadata.upstreamSource.landScapeRealPositionMax[0],
  );
  assert.equal(
    worldTreeProjection.worldMinY,
    metadata.upstreamSource.landScapeRealPositionMin[1],
  );
  assert.equal(
    worldTreeProjection.worldMaxY,
    metadata.upstreamSource.landScapeRealPositionMax[1],
  );

  await assert.rejects(
    readFile(new URL("world-tree-8192.webp", assetDirectory)),
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

test("round trips World Tree world coordinates through the projection", () => {
  const projection = worldTreeProjection;
  const toleranceX = 1e-6 * (projection.worldMaxX - projection.worldMinX);
  const toleranceY = 1e-6 * (projection.worldMaxY - projection.worldMinY);
  const center = {
    x: (projection.worldMinX + projection.worldMaxX) / 2,
    y: (projection.worldMinY + projection.worldMaxY) / 2,
  };
  const points = [
    { x: projection.worldMinX, y: projection.worldMinY },
    { x: projection.worldMinX, y: projection.worldMaxY },
    { x: projection.worldMaxX, y: projection.worldMinY },
    { x: projection.worldMaxX, y: projection.worldMaxY },
    center,
    { x: 500_000, y: -700_000 },
    { x: 400_000, y: -500_000 },
    { x: 600_000, y: -550_000 },
  ];
  for (const world of points) {
    const normalized = worldToNormalizedMapPosition(world, projection);
    assert.ok(normalized, `project ${world.x}, ${world.y}`);
    const back = normalizedMapPositionToWorld(normalized, projection);
    assert.ok(back, `unproject ${world.x}, ${world.y}`);
    assert.ok(
      Math.abs(back.x - world.x) <= toleranceX,
      `x round trip ${world.x}`,
    );
    assert.ok(
      Math.abs(back.y - world.y) <= toleranceY,
      `y round trip ${world.y}`,
    );
  }
});

test("rejects World Tree out-of-bounds coordinates", () => {
  assert.equal(
    worldToNormalizedMapPosition(
      { x: worldTreeProjection.worldMinX - 1, y: 0 },
      worldTreeProjection,
    ),
    null,
  );
  assert.equal(
    worldToNormalizedMapPosition(
      { x: 500_000, y: worldTreeProjection.worldMaxY + 1 },
      worldTreeProjection,
    ),
    null,
  );
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
    null,
    new Date("2026-07-28T12:00:30.000Z"),
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

test("two-key join: falls back to canonical playerId when userId does not match", () => {
  const players: ConnectedPlayer[] = [
    connectedPlayer("steam:123", "00000000000000000000000000000001", "PlayerA"),
  ];
  const telemetry = [
    snapshot({
      userId: "00000000000000000000000000000001",
      playerId: "0000-0000-0000-0000-0000-000000000001",
      x: 100,
      y: 200,
    }),
  ];
  const model = buildLivePlayerMapModel(
    players,
    telemetry,
    palpagosProjection,
    30,
    null,
    new Date("2026-07-28T12:00:30.000Z"),
  );
  assert.equal(
    model.markers.length,
    1,
    "should find via canonical playerId fallback",
  );
  assert.equal(model.markers[0]?.playerName, "PlayerA");
  assert.equal(model.unmappedPlayers.length, 0);
});

test("two-key join: canonicalPlayerId strips hyphens and lowercases", () => {
  const players: ConnectedPlayer[] = [
    connectedPlayer(
      "steam:456",
      "E:12345678-ABCD-1234-ABCD-123456789ABC",
      "PlayerB",
    ),
  ];
  const telemetry = [
    snapshot({
      userId: "E12345678ABCD1234ABCD123456789ABC",
      playerId: "e:12345678-abcd-1234-abcd-123456789abc",
      x: 50,
      y: 60,
    }),
  ];
  const model = buildLivePlayerMapModel(
    players,
    telemetry,
    palpagosProjection,
    30,
    null,
    new Date("2026-07-28T12:00:30.000Z"),
  );
  assert.equal(model.markers.length, 1, "canonical normalization should match");
  assert.equal(model.markers[0]?.playerName, "PlayerB");
});

test("freshness uses snapshot.capturedAt only — stale snapshot not labeled Live", () => {
  const model = buildLivePlayerMapModel(
    [connectedPlayer("uid-1", "pid-1", "StalePlayer")],
    [snapshot({ userId: "uid-1", playerId: "pid-1", x: 10, y: 20 })],
    palpagosProjection,
    30,
    "2026-07-28T12:00:30.000Z",
    new Date("2026-07-28T12:10:00.000Z"),
  );
  assert.equal(
    model.markers[0]?.freshness,
    "stale",
    "capturedAt is 10m old — must be stale regardless of verifiedAt",
  );
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
  const details = playerMapDetailValues(model.markers[0]!, {
    now: new Date("2026-07-28T12:00:30.000Z"),
  });

  assert.deepEqual(details, {
    playerName: "Lifmunk",
    accountName: "Account",
    playerId: "pid-1",
    userId: "uid-1",
    level: 20,
    ping: "42 ms",
    buildingCount: 3,
    worldCoordinates: "X 10.0 · Y 20.0",
    mapCoordinates: "Unavailable",
    telemetryAge: "30s ago",
  });
  assert.equal(JSON.stringify(details).includes("192.0.2.10"), false);
});

test("playerMapDetailValues shows map coordinates from enrichment", () => {
  const model = buildLivePlayerMapModel(
    [connectedPlayer("uid-1", "pid-1", "Lifmunk")],
    [snapshot({ userId: "uid-1", playerId: "pid-1", x: 10, y: 20 })],
    palpagosProjection,
    30,
    null,
    new Date("2026-07-28T12:00:30.000Z"),
  );
  const details = playerMapDetailValues(model.markers[0]!, {
    now: new Date("2026-07-28T12:00:30.000Z"),
    enrichment: {
      mapLocation: { x: 150, y: 200, z: 50 },
      level: 42,
    },
  });

  assert.equal(details.mapCoordinates, "X 150.0 · Y 200.0 · Z 50.0");
  assert.equal(details.level, 42);
});

test("playerMapDetailValues shows map coordinates without Z when absent", () => {
  const model = buildLivePlayerMapModel(
    [connectedPlayer("uid-1", "pid-1", "Lifmunk")],
    [snapshot({ userId: "uid-1", playerId: "pid-1", x: 10, y: 20 })],
    palpagosProjection,
    30,
    null,
    new Date("2026-07-28T12:00:30.000Z"),
  );
  const details = playerMapDetailValues(model.markers[0]!, {
    now: new Date("2026-07-28T12:00:30.000Z"),
    enrichment: {
      mapLocation: { x: 150, y: 200 },
      level: null,
    },
  });

  assert.equal(details.mapCoordinates, "X 150.0 · Y 200.0");
  assert.equal(details.level, 20);
});

test("playerMapDetailValues falls back to marker level when enrichment has no level", () => {
  const model = buildLivePlayerMapModel(
    [connectedPlayer("uid-1", "pid-1", "Lifmunk")],
    [snapshot({ userId: "uid-1", playerId: "pid-1", x: 10, y: 20 })],
    palpagosProjection,
    30,
    null,
    new Date("2026-07-28T12:00:30.000Z"),
  );
  const details = playerMapDetailValues(model.markers[0]!, {
    now: new Date("2026-07-28T12:00:30.000Z"),
    enrichment: { mapLocation: null, level: null },
  });

  assert.equal(details.level, 20);
  assert.equal(details.mapCoordinates, "Unavailable");
});

test("playerMapDetailValues shows Unavailable map coordinates when enrichment is null", () => {
  const model = buildLivePlayerMapModel(
    [connectedPlayer("uid-1", "pid-1", "Lifmunk")],
    [snapshot({ userId: "uid-1", playerId: "pid-1", x: 10, y: 20 })],
    palpagosProjection,
    30,
    null,
    new Date("2026-07-28T12:00:30.000Z"),
  );
  const details = playerMapDetailValues(model.markers[0]!, {
    now: new Date("2026-07-28T12:00:30.000Z"),
  });

  assert.equal(details.mapCoordinates, "Unavailable");
});

test("carries guild identity from telemetry through to the marker", () => {
  const model = buildLivePlayerMapModel(
    [connectedPlayer("uid-1", "pid-1", "Lifmunk")],
    [
      {
        ...snapshot({ userId: "uid-1", playerId: "pid-1", x: 10, y: 20 }),
        guildId: "guild-abc",
        guildName: "Pal Rangers",
      },
    ],
    palpagosProjection,
    30,
    null,
    new Date("2026-07-28T12:00:30.000Z"),
  );

  assert.equal(model.markers[0]?.guildId, "guild-abc");
  assert.equal(model.markers[0]?.guildName, "Pal Rangers");
});

test("marker guild fields are null when telemetry has no guild", () => {
  const model = buildLivePlayerMapModel(
    [connectedPlayer("uid-1", "pid-1", "Lifmunk")],
    [snapshot({ userId: "uid-1", playerId: "pid-1", x: 10, y: 20 })],
    palpagosProjection,
    30,
    null,
    new Date("2026-07-28T12:00:30.000Z"),
  );

  assert.equal(model.markers[0]?.guildId, null);
  assert.equal(model.markers[0]?.guildName, null);
});

test("standard REST positions remain visible when their coordinate space is unknown or null", () => {
  for (const coordinateSpaceId of ["unknown", null]) {
    const player = connectedPlayer("uid-rest", "pid-rest", "Explorer");
    const current = {
      ...snapshot({
        userId: player.userId,
        playerId: player.playerId,
        x: 10,
        y: 20,
      }),
      coordinateSpaceId,
    };
    const model = buildLivePlayerMapModel(
      [player],
      [current],
      palpagosProjection,
      30,
      current.capturedAt,
      new Date(current.capturedAt),
    );
    assert.equal(model.markers.length, 1);
    assert.equal(model.markers[0]?.locationAuthority, "standard");
    assert.equal(model.unmappedPlayers.length, 0);
  }
});

test("authoritative coordinate spaces isolate players before bounds projection", () => {
  // A point inside BOTH maps' bounds (the overlapping strip).
  const overlap = { x: 348_000, y: -500_000 };
  const treePlayer = connectedPlayer("uid-tree", "pid-tree", "Treewalker");
  const treeSnapshot = {
    ...snapshot({
      userId: treePlayer.userId,
      playerId: treePlayer.playerId,
      x: overlap.x,
      y: overlap.y,
      coordinateSpaceId: "world_tree",
    }),
  };

  // Explicit world_tree sample never plots on Palpagos, even in bounds.
  const treeOnPalpagos = buildLivePlayerMapModel(
    [treePlayer],
    [treeSnapshot],
    palpagosProjection,
    30,
    null,
    new Date("2026-07-28T12:00:30.000Z"),
    [],
    palpagosMapDefinition,
  );
  assert.equal(treeOnPalpagos.markers.length, 0);
  assert.equal(treeOnPalpagos.unmappedPlayers.length, 1);
  assert.equal(treeOnPalpagos.unmappedPlayers[0]?.reason, "world_tree");
  assert.equal(
    treeOnPalpagos.unmappedPlayers[0]?.spatialState,
    "world_tree_live",
  );

  // The same sample plots on the World Tree map itself.
  const treeOnTree = buildLivePlayerMapModel(
    [treePlayer],
    [treeSnapshot],
    worldTreeProjection,
    30,
    null,
    new Date("2026-07-28T12:00:30.000Z"),
    [],
    worldTreeMapDefinition,
  );
  assert.equal(treeOnTree.markers.length, 1);
  assert.equal(treeOnTree.unmappedPlayers.length, 0);

  // Explicit palpagos sample never plots on the World Tree, even in bounds.
  const palPlayer = connectedPlayer("uid-pal", "pid-pal", "Islander");
  const palOnTree = buildLivePlayerMapModel(
    [palPlayer],
    [
      snapshot({
        userId: palPlayer.userId,
        playerId: palPlayer.playerId,
        x: overlap.x,
        y: overlap.y,
        coordinateSpaceId: "palpagos",
      }),
    ],
    worldTreeProjection,
    30,
    null,
    new Date("2026-07-28T12:00:30.000Z"),
    [],
    worldTreeMapDefinition,
  );
  assert.equal(palOnTree.markers.length, 0);
  assert.equal(palOnTree.unmappedPlayers[0]?.reason, "palpagos");
});

test("unknown and non-mappable coordinate spaces keep bounds-based plotting on every map", () => {
  const overlap = { x: 348_000, y: -500_000 };
  for (const coordinateSpaceId of [
    "unknown",
    "instance:fixture-dungeon",
    "special_area",
  ]) {
    for (const definition of [palpagosMapDefinition, worldTreeMapDefinition]) {
      const projection =
        definition.coordinateSpaceId === "world_tree"
          ? worldTreeProjection
          : palpagosProjection;
      const player = connectedPlayer("uid-x", "pid-x", "Wanderer");
      const model = buildLivePlayerMapModel(
        [player],
        [
          {
            ...snapshot({
              userId: player.userId,
              playerId: player.playerId,
              x: overlap.x,
              y: overlap.y,
            }),
            coordinateSpaceId,
          },
        ],
        projection,
        30,
        null,
        new Date("2026-07-28T12:00:30.000Z"),
        [],
        definition,
      );
      assert.equal(
        model.markers.length,
        1,
        `${coordinateSpaceId} on ${definition.coordinateSpaceId}`,
      );
    }
  }
});

test("stale standard positions stay mapped without an off-map duplicate", () => {
  const player = connectedPlayer("uid-stale", "pid-stale", "Explorer");
  const current = {
    ...snapshot({
      userId: player.userId,
      playerId: player.playerId,
      x: 10,
      y: 20,
      coordinateSpaceId: "unknown",
    }),
    capturedAt: "2026-07-28T11:00:00.000Z",
  };
  const model = buildLivePlayerMapModel(
    [player],
    [current],
    palpagosProjection,
    30,
    current.capturedAt,
    new Date("2026-07-28T12:00:00.000Z"),
  );
  assert.equal(model.markers[0]?.freshness, "stale");
  assert.equal(model.unmappedPlayers.length, 0);
});

test("segments and totals include only the selected coordinate space", () => {
  const trail = processMovementTrail(
    [
      {
        capturedAt: "2026-07-28T12:00:00Z",
        x: 0,
        y: 0,
        coordinateSpaceId: "palpagos",
      },
      {
        capturedAt: "2026-07-28T12:01:00Z",
        x: 1_000,
        y: 0,
        coordinateSpaceId: "palpagos",
      },
      {
        capturedAt: "2026-07-28T12:02:00Z",
        x: 50_000,
        y: 50_000,
        coordinateSpaceId: "instance:fixture",
      },
      {
        capturedAt: "2026-07-28T12:03:00Z",
        x: 2_000,
        y: 0,
        coordinateSpaceId: "palpagos",
      },
      {
        capturedAt: "2026-07-28T12:04:00Z",
        x: 3_000,
        y: 0,
        coordinateSpaceId: "palpagos",
      },
    ],
    palpagosProjection,
    {
      pollingIntervalSeconds: 30,
      coordinateSpaceId: "palpagos",
      coordinateSpacesAuthoritative: true,
    },
  );
  assert.equal(trail.coordinateSpaceId, "palpagos");
  assert.equal(trail.segments.length, 2);
  assert.equal(trail.exclusions.coordinateSpace, 1);
  assert.equal(trail.approximateDistance, 2_000);
});

test("standard REST trails retain unknown history while authoritative trails split spaces", () => {
  const points = [
    {
      capturedAt: "2026-07-28T12:00:00Z",
      x: 0,
      y: 0,
      coordinateSpaceId: "unknown",
    },
    {
      capturedAt: "2026-07-28T12:01:00Z",
      x: 1_000,
      y: 0,
      coordinateSpaceId: "unknown",
    },
    {
      capturedAt: "2026-07-28T12:02:00Z",
      x: 2_000,
      y: 0,
      coordinateSpaceId: "palpagos",
    },
  ];
  const standard = processMovementTrail(points, palpagosProjection, {
    pollingIntervalSeconds: 30,
    coordinateSpaceId: "palpagos",
  });
  // Authoritative non-strict trails (the Palpagos policy) keep unknown/legacy
  // samples so main-map history stays continuous.
  const exact = processMovementTrail(points, palpagosProjection, {
    pollingIntervalSeconds: 30,
    coordinateSpaceId: "palpagos",
    coordinateSpacesAuthoritative: true,
  });
  assert.equal(standard.pointCount, 3);
  assert.equal(standard.approximateDistance, 2_000);
  assert.equal(exact.pointCount, 3);
  assert.equal(exact.exclusions.coordinateSpace, 0);
  // The same unknown history renders nothing in strict World Tree mode.
  const treeStrict = processMovementTrail(points, worldTreeProjection, {
    pollingIntervalSeconds: 30,
    coordinateSpaceId: "world_tree",
    coordinateSpacesAuthoritative: true,
    strictCoordinateSpace: true,
  });
  assert.equal(treeStrict.pointCount, 0);
  assert.equal(treeStrict.exclusions.coordinateSpace, 3);
});

test("strict trails render only explicitly tagged samples and never bridge spaces", () => {
  const points = [
    {
      capturedAt: "2026-07-28T12:00:00Z",
      x: 500_000,
      y: -700_000,
      coordinateSpaceId: "world_tree",
    },
    {
      capturedAt: "2026-07-28T12:01:00Z",
      x: 510_000,
      y: -690_000,
      coordinateSpaceId: null,
    },
    {
      capturedAt: "2026-07-28T12:02:00Z",
      x: 520_000,
      y: -680_000,
      coordinateSpaceId: "world_tree",
    },
    {
      capturedAt: "2026-07-28T12:03:00Z",
      x: 530_000,
      y: -670_000,
      coordinateSpaceId: "palpagos",
    },
    {
      capturedAt: "2026-07-28T12:04:00Z",
      x: 540_000,
      y: -660_000,
      coordinateSpaceId: "world_tree",
    },
  ];
  const strict = processMovementTrail(points, worldTreeProjection, {
    pollingIntervalSeconds: 30,
    coordinateSpaceId: "world_tree",
    coordinateSpacesAuthoritative: true,
    strictCoordinateSpace: true,
  });
  assert.equal(strict.exclusions.coordinateSpace, 2);
  assert.equal(strict.segments.length, 3);
  assert.equal(strict.pointCount, 3);

  // Non-strict retains the untagged sample (Palpagos policy) but still
  // excludes the explicit palpagos sample and splits the segment.
  const lenient = processMovementTrail(points, worldTreeProjection, {
    pollingIntervalSeconds: 30,
    coordinateSpaceId: "world_tree",
    coordinateSpacesAuthoritative: true,
  });
  assert.equal(lenient.exclusions.coordinateSpace, 1);
  assert.equal(lenient.pointCount, 4);
  assert.equal(lenient.segments.length, 2);

  // A palpagos -> world_tree transition never connects into one line.
  const transition = processMovementTrail(
    [
      {
        capturedAt: "2026-07-28T12:00:00Z",
        x: 0,
        y: 0,
        coordinateSpaceId: "palpagos",
      },
      {
        capturedAt: "2026-07-28T12:01:00Z",
        x: 500_000,
        y: -700_000,
        coordinateSpaceId: "world_tree",
      },
    ],
    worldTreeProjection,
    {
      pollingIntervalSeconds: 30,
      coordinateSpaceId: "world_tree",
      coordinateSpacesAuthoritative: true,
      strictCoordinateSpace: true,
    },
  );
  assert.equal(transition.pointCount, 1);
  assert.equal(transition.segments.length, 1);
  assert.equal(transition.segments[0]?.length, 1);
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
  assert.match(source, /<span aria-hidden="true">/);
  assert.match(source, /presentation\.initial/);
  assert.match(source, /presentation\.accessibleName/);
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
    2,
    "the display name appears once in the visual label and once in the conditional accessible name",
  );

  const denalb = playerMarkerPresentation("Denalb");
  assert.equal(denalb.accessibleName, "View Denalb on map");
  assert.equal(denalb.accessibleName.match(/Denalb/g)?.length, 1);
  assert.equal(denalb.displayName, "Denalb");
});

test("movement trail controls and layer preserve accessible map ordering", async () => {
  const source = await readFile(
    new URL("../components/ServerWorldMap.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  assert.match(source, /label="Trail player"/);
  assert.match(source, /label="Show movement trail"/);
  assert.match(source, /aria-label="Movement trail time range"/);
  assert.match(source, /Refresh trail/);
  assert.match(source, /Clear trail/);
  assert.match(source, /vectorEffect="non-scaling-stroke"/);
  assert.match(source, /className="pc-world-map-trail-segment"/);
  assert.match(source, /stroke=\{selectedPlayerColor\}/);
  assert.match(
    source,
    /style=\{\{[\s\S]*?backgroundColor: playerColor\(marker\.userId\),[\s\S]*?\}\}/,
  );
  assert.match(source, /Older/);
  assert.match(source, /Newer/);
  assert.match(source, /faint is older and bright is newer/);
  assert.ok(
    source.indexOf('className="pc-world-map-trail"') <
      source.indexOf('className="pc-world-map-marker-position"'),
    "trail SVG renders beneath live marker elements",
  );
  assert.match(css, /\.pc-world-map-trail\s*\{[\s\S]*?z-index:\s*2;[\s\S]*?\}/);
  assert.match(
    css,
    /\.pc-world-map-marker-position\s*\{[\s\S]*?z-index:\s*3;[\s\S]*?\}/,
  );

  // Layers menu must use withinPortal so it renders inside the fullscreen element
  assert.match(
    source,
    /Menu[\s\S]*?withinPortal/,
    "Layers Menu must use withinPortal to render inside fullscreen element",
  );
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
  overrides: Pick<PlayerPositionSnapshot, "userId" | "playerId" | "x" | "y"> &
    Partial<Pick<PlayerPositionSnapshot, "coordinateSpaceId">>,
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
    coordinateSpaceId: overrides.coordinateSpaceId ?? "palpagos",
    createdAt: "2026-07-28T12:00:00.000Z",
  };
}

// ---------- Base map markers ----------

function makeBase(overrides: Partial<PalDefenderBase> = {}): PalDefenderBase {
  return {
    baseId: overrides.baseId ?? "base-1",
    guildId: overrides.guildId ?? "guild-1",
    guildName: overrides.guildName ?? "Test Guild",
    guildAdministrator: overrides.guildAdministrator ?? {
      playerId: "p1",
      name: "Admin",
    },
    worldPosition: overrides.worldPosition ?? { x: 0, y: 0, z: 0 },
    mapPosition: overrides.mapPosition ?? { x: 0.5, y: 0.5, z: 0 },
  };
}

test("buildBaseMapMarkers: projects valid bases", () => {
  const bases = [makeBase({ worldPosition: { x: 0, y: 0, z: 0 } })];
  const markers = buildBaseMapMarkers(bases, palpagosProjection);
  assert.equal(markers.length, 1);
  const marker = markers[0]!;
  assert.equal(marker.baseId, "base-1");
  assert.ok(Number.isFinite(marker.position.x));
  assert.ok(Number.isFinite(marker.position.y));
});

test("buildBaseMapMarkers: yields no World Tree markers until base space is verified", () => {
  // A base whose Palpagos coordinates also fall inside the World Tree bounds
  // must not be reinterpreted as a World Tree position.
  const bases = [
    makeBase({ worldPosition: { x: 348_000, y: -500_000, z: 0 } }),
  ];
  assert.equal(
    buildBaseMapMarkers(bases, palpagosProjection, palpagosMapDefinition)
      .length,
    1,
  );
  assert.deepEqual(
    buildBaseMapMarkers(bases, worldTreeProjection, worldTreeMapDefinition),
    [],
  );
});

test("buildBaseMapMarkers: skips out-of-bounds coordinates", () => {
  const bases = [
    makeBase({
      baseId: "oob",
      worldPosition: { x: 9999999, y: 9999999, z: 0 },
    }),
  ];
  const markers = buildBaseMapMarkers(bases, palpagosProjection);
  assert.equal(markers.length, 0);
});

test("buildBaseMapMarkers: skips invalid coordinates", () => {
  const bases = [
    makeBase({
      baseId: "nan",
      worldPosition: { x: NaN, y: 0, z: 0 },
    }),
    makeBase({
      baseId: "inf",
      worldPosition: { x: Infinity, y: 0, z: 0 },
    }),
  ];
  const markers = buildBaseMapMarkers(bases, palpagosProjection);
  assert.equal(markers.length, 0);
});

test("buildBaseMapMarkers: multiple bases from one guild produce separate markers", () => {
  const bases = [
    makeBase({
      baseId: "b1",
      guildId: "guild-a",
      worldPosition: { x: 0, y: 0, z: 0 },
    }),
    makeBase({
      baseId: "b2",
      guildId: "guild-a",
      worldPosition: { x: 1000, y: 1000, z: 0 },
    }),
    makeBase({
      baseId: "b3",
      guildId: "guild-a",
      worldPosition: { x: -1000, y: -1000, z: 0 },
    }),
  ];
  const markers = buildBaseMapMarkers(bases, palpagosProjection);
  assert.ok(markers.length >= 1);
  const guildIds = new Set(markers.map((m) => m.guildId));
  assert.equal(guildIds.size, 1);
});

test("buildBaseMapMarkers: preserves null guild name", () => {
  const bases: PalDefenderBase[] = [
    {
      baseId: "no-guild",
      guildId: "guild-null",
      guildName: null,
      guildAdministrator: { playerId: "p1", name: "Admin" },
      worldPosition: { x: 0, y: 0, z: 0 },
      mapPosition: { x: 0.5, y: 0.5, z: 0 },
    },
  ];
  const markers = buildBaseMapMarkers(bases, palpagosProjection);
  assert.ok(markers.length >= 1);
  const marker = markers.find((m) => m.baseId === "no-guild");
  assert.equal(marker?.guildName, null);
});

test("buildBaseMapMarkers: uses worldPosition not mapPosition", () => {
  const base = makeBase({
    baseId: "pos-test",
    worldPosition: { x: 0, y: 0, z: 0 },
    mapPosition: { x: 999, y: 999, z: 0 },
  });
  const markers = buildBaseMapMarkers([base], palpagosProjection);
  assert.ok(markers.length >= 1);
  const marker = markers[0]!;
  const expectedPos = worldToNormalizedMapPosition(
    { x: 0, y: 0 },
    palpagosProjection,
  );
  assert.deepEqual(marker.position, expectedPos);
  assert.equal(marker.worldX, 0);
  assert.equal(marker.worldY, 0);
});

test("buildBaseMapMarkers: empty input produces empty output", () => {
  const markers = buildBaseMapMarkers([], palpagosProjection);
  assert.equal(markers.length, 0);
});

test("buildBaseMapMarkers: preserves baseId for navigation", () => {
  const bases = [
    makeBase({
      baseId: "camp-abc123",
      guildId: "guild-xyz",
      worldPosition: { x: 0, y: 0, z: 0 },
    }),
  ];
  const markers = buildBaseMapMarkers(bases, palpagosProjection);
  assert.ok(markers.length >= 1);
  const marker = markers[0]!;
  assert.equal(marker.baseId, "camp-abc123");
  assert.equal(marker.guildId, "guild-xyz");
  assert.notEqual(marker.baseId, marker.guildId);
});

test("buildBaseMapMarkers preserves authoritative mapPosition", () => {
  const bases = [
    makeBase({
      baseId: "map-pos-test",
      worldPosition: { x: 0, y: 0, z: 0 },
      mapPosition: { x: 150, y: 200, z: 50 },
    }),
  ];
  const markers = buildBaseMapMarkers(bases, palpagosProjection);
  assert.equal(markers.length, 1);
  const marker = markers[0]!;
  assert.ok(marker.mapPosition !== null);
  assert.equal(marker.mapPosition!.x, 150);
  assert.equal(marker.mapPosition!.y, 200);
  assert.equal(marker.mapPosition!.z, 50);
});

test("buildBaseMapMarkers handles null mapPosition safely", () => {
  const bases = [
    {
      baseId: "no-map-pos",
      guildId: "guild-1",
      guildName: "Test Guild",
      guildAdministrator: { playerId: "p1", name: "Admin" },
      worldPosition: { x: 0, y: 0, z: 0 },
      mapPosition: null,
    },
  ] as unknown as PalDefenderBase[];
  const markers = buildBaseMapMarkers(bases, palpagosProjection);
  assert.equal(markers.length, 1);
  assert.equal(markers[0]?.mapPosition, null);
});

test("buildBaseMapMarkers marker position is derived from worldPosition not mapPosition", () => {
  const bases = [
    makeBase({
      baseId: "pos-source",
      worldPosition: { x: 0, y: 0, z: 0 },
      mapPosition: { x: 999, y: 999, z: 0 },
    }),
  ];
  const markers = buildBaseMapMarkers(bases, palpagosProjection);
  assert.equal(markers.length, 1);
  const marker = markers[0]!;
  const expected = worldToNormalizedMapPosition(
    { x: 0, y: 0 },
    palpagosProjection,
  );
  assert.deepEqual(marker.position, expected);
  assert.notDeepEqual(marker.position, { x: 999, y: 999 });
});

test("buildBaseMapMarkers WORLD COORDINATES fields remain present and correct", () => {
  const bases = [
    makeBase({
      baseId: "world-coords",
      worldPosition: { x: 1234, y: 5678, z: 99 },
      mapPosition: { x: 150, y: 200, z: 50 },
    }),
  ];
  const markers = buildBaseMapMarkers(bases, palpagosProjection);
  assert.equal(markers.length, 1);
  const marker = markers[0]!;
  assert.equal(marker.worldX, 1234);
  assert.equal(marker.worldY, 5678);
});

test("BaseMapDetails displays MAP COORDINATES from mapPosition", async () => {
  const source = await readFile(
    new URL("../components/ServerWorldMap.tsx", import.meta.url),
    "utf8",
  );
  const baseDetailsSection = source.match(
    /function BaseMapDetails[\s\S]*?<\/Card>\s*\)\s*;?\s*\}\s*\n/,
  );
  assert.ok(baseDetailsSection, "BaseMapDetails component not found");
  const section = baseDetailsSection[0];
  assert.ok(
    section.includes('label="Map coordinates"'),
    "BaseMapDetails must contain a Map coordinates detail row",
  );
  assert.ok(
    section.includes("marker.mapPosition"),
    "Map coordinates must be derived from marker.mapPosition",
  );
  assert.ok(
    section.includes("Unavailable"),
    "Map coordinates must show Unavailable fallback",
  );
  assert.ok(
    section.includes('label="World coordinates"'),
    "BaseMapDetails must still contain World coordinates row",
  );
});

// ---------- Layers Menu z-index regression (PR #193) ----------

test("Layers Menu z-index exceeds expanded map overlay", async () => {
  const source = await readFile(
    new URL("../components/ServerWorldMap.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  const expandedOverlay = css.match(
    /\.pc-world-map-layout\.pc-world-map-expanded\s*\{(?<rules>[\s\S]*?)\}/,
  )?.groups?.rules;
  assert.ok(expandedOverlay, "expanded overlay CSS not found");
  const overlayMatch = expandedOverlay.match(/z-index:\s*(\d+)/);
  assert.ok(overlayMatch, "expanded overlay z-index not found");
  const overlayZIndex = Number(overlayMatch[1]);

  const menuZIndexMatch = source.match(/<Menu[\s\S]*?zIndex=\{(\d+)\}/);
  assert.ok(menuZIndexMatch, "Layers Menu zIndex prop not found");
  const menuZIndex = Number(menuZIndexMatch[1]);

  assert.ok(
    menuZIndex > overlayZIndex,
    `Layers Menu z-index (${menuZIndex}) must exceed expanded overlay (${overlayZIndex})`,
  );
});

test("toolbar Group renders inside Card element", async () => {
  const source = await readFile(
    new URL("../components/ServerWorldMap.tsx", import.meta.url),
    "utf8",
  );

  const cardMatch = source.match(
    /<Card[\s\S]*?className="pc-panel pc-world-map-card"/,
  );
  assert.ok(cardMatch, "Card element not found");
  const cardIndex = source.indexOf(cardMatch[0]);

  const toolbarMatch = source.match(/className="pc-world-map-toolbar"/);
  assert.ok(toolbarMatch, "toolbar class not found");
  const toolbarIndex = source.indexOf(toolbarMatch[0]);

  const cardCloseMatch = source.match(
    /<\/Card>(?=\s*<Stack gap="md" className="pc-world-map-details")/,
  );
  assert.ok(cardCloseMatch, "Card close tag not found");
  const cardCloseIndex = source.indexOf(cardCloseMatch[0]);

  assert.ok(
    toolbarIndex > cardIndex && toolbarIndex < cardCloseIndex,
    "toolbar must be inside Card element to avoid oversized hit area in expanded mode",
  );
});

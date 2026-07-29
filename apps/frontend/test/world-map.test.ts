import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLivePlayerMapModel,
  calibrationRecord,
  classifyTelemetryFreshness,
  mapContentState,
  mapAccessForRole,
  playerMapDetailValues,
  telemetryFreshnessLabel,
} from "../lib/world-map/model";
import {
  normalizedMapPositionToWorld,
  palpagosProjection,
  worldToNormalizedMapPosition,
  type MapProjectionConfiguration,
} from "../lib/world-map/projection";
import type { ConnectedPlayer, PlayerPositionSnapshot } from "../types/servers";

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

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorldEventQuery,
  exactWorldEventTime,
  mergeWorldEventPages,
  relativeWorldEventTime,
  sortWorldEventsNewestFirst,
  worldEventConfidence,
  worldEventEvidenceText,
  worldEventLabel,
  worldEventLabels,
  worldEventMetadataText,
  worldEventPlayerName,
  worldEventRelocationPosition,
  worldEventTimeRangeFromNow,
} from "../lib/world-events";
import type { WorldEvent } from "../types/servers";

function event(overrides: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id: "wie_1",
    serverId: "srv_1",
    userId: "user_1",
    playerId: "player_1",
    timestamp: "2026-07-30T12:00:00.000Z",
    type: "player_joined",
    metadata: { playerName: "Denalb" },
    confidence: 1,
    evidence: [{ source: "players", fact: "appeared", value: "online_roster" }],
    position: null,
    ...overrides,
  };
}

test("formats every modeled event with a user-facing label", () => {
  assert.deepEqual(Object.values(worldEventLabels), [
    "Player joined",
    "Player disconnected",
    "Session started",
    "Session ended",
    "Player died",
    "Player respawned",
    "Player became idle",
    "Player resumed activity",
    "Prolonged inactivity detected",
    "Activity resumed",
    "Rapid relocation detected",
  ]);
});

test("presents neutral relocation and supported likely-fast-travel classifications", () => {
  const relocation = event({
    type: "player_rapid_relocation",
    metadata: {
      playerName: "Denalb",
      classification: "unexplained_relocation",
      originX: -100_000,
      originY: 50_000,
      destinationX: 200_000,
      destinationY: -75_000,
    },
  });
  assert.equal(worldEventLabel(relocation), "Rapid relocation detected");
  assert.equal(
    worldEventLabel(
      event({
        ...relocation,
        metadata: {
          ...relocation.metadata,
          classification: "likely_fast_travel",
        },
      }),
    ),
    "Likely fast travel",
  );
  assert.deepEqual(worldEventRelocationPosition(relocation, "origin"), {
    x: -100_000,
    y: 50_000,
    z: null,
  });
  assert.deepEqual(worldEventRelocationPosition(relocation, "destination"), {
    x: 200_000,
    y: -75_000,
    z: null,
  });
  assert.equal(
    worldEventMetadataText("classification", "unexplained_relocation"),
    "Classification: Movement discontinuity (cause unknown)",
  );
  assert.equal(
    worldEventMetadataText("elapsedSeconds", 30),
    "Elapsed time: 30 seconds",
  );
  assert.equal(
    worldEventMetadataText("displacement", 375_000),
    "Distance: 375000 world units",
  );
});

test("maps deterministic confidence values to restrained categories", () => {
  assert.equal(worldEventConfidence(1).label, "Confirmed");
  assert.equal(worldEventConfidence(0.9).label, "High confidence");
  assert.equal(worldEventConfidence(0.6).label, "Moderate confidence");
  assert.equal(worldEventConfidence(0.2).label, "Low confidence");
});

test("renders only evidence supplied by the API", () => {
  assert.equal(
    worldEventEvidenceText(event().evidence[0]!),
    "Player appeared in the online roster.",
  );
  assert.equal(
    worldEventEvidenceText({
      source: "players",
      fact: "disappeared",
      value: "online_roster",
    }),
    "Player disappeared from the online roster.",
  );
  assert.equal(
    worldEventEvidenceText({
      source: "telemetry",
      fact: "within_radius",
      value: "300 world units for 10 minutes",
    }),
    "Player remained within 300 world units for 10 minutes.",
  );
  assert.equal(
    worldEventEvidenceText({
      source: "telemetry",
      fact: "rapid_displacement",
      value: "300000 world units in 30 seconds",
    }),
    "Player moved 300000 world units in 30 seconds.",
  );
  assert.equal(
    worldEventEvidenceText({
      source: "telemetry",
      fact: "implied_speed",
      value: "10000 world units per second",
    }),
    "Implied travel speed was 10000 world units per second.",
  );
});

test("formats relative and exact timestamps", () => {
  const now = new Date("2026-07-30T12:05:00.000Z");
  assert.match(relativeWorldEventTime(event().timestamp, now), /5 minutes ago/);
  assert.ok(exactWorldEventTime(event().timestamp).length > 10);
});

test("sorts newest first and deduplicates older pages by stable event ID", () => {
  const older = event({ id: "older", timestamp: "2026-07-30T11:00:00.000Z" });
  const newer = event({ id: "newer", timestamp: "2026-07-30T13:00:00.000Z" });
  assert.deepEqual(
    sortWorldEventsNewestFirst([older, newer]).map(({ id }) => id),
    ["newer", "older"],
  );
  assert.deepEqual(
    mergeWorldEventPages([newer, older], [older]).map(({ id }) => id),
    ["newer", "older"],
  );
});

test("orders resumed activity before relocation at the same timestamp", () => {
  const timestamp = "2026-07-30T13:00:00.000Z";
  const relocation = event({
    id: "relocation",
    type: "player_rapid_relocation",
    timestamp,
  });
  const resumed = event({
    id: "resumed",
    type: "player_afk_ended",
    timestamp,
  });
  assert.deepEqual(
    sortWorldEventsNewestFirst([relocation, resumed]).map(({ type }) => type),
    ["player_afk_ended", "player_rapid_relocation"],
  );
});

test("constructs bounded server-side player, event, and time filters", () => {
  const query = buildWorldEventQuery({
    userId: " user_1 ",
    type: "session_started",
    from: "2026-07-30T00:00:00.000Z",
    to: "2026-07-30T12:00:00.000Z",
    limit: 50,
  });
  const parameters = new URLSearchParams(query);
  assert.equal(parameters.get("userId"), "user_1");
  assert.equal(parameters.get("type"), "session_started");
  assert.equal(parameters.get("limit"), "50");
  assert.equal(parameters.get("to"), "2026-07-30T12:00:00.000Z");
});

test("calculates selected time ranges without imposing one on all history", () => {
  const now = new Date("2026-07-30T12:00:00.000Z");
  assert.equal(
    worldEventTimeRangeFromNow("1h", now),
    "2026-07-30T11:00:00.000Z",
  );
  assert.equal(worldEventTimeRangeFromNow("all", now), undefined);
});

test("preserves events with and without map positions", () => {
  assert.equal(event().position, null);
  assert.deepEqual(event({ position: { x: 1, y: 2, z: null } }).position, {
    x: 1,
    y: 2,
    z: null,
  });
});

test("keeps long identifiers and metadata intact and falls back to user ID", () => {
  const userId = `gdk_${"9".repeat(160)}`;
  const longValue = "detail ".repeat(100);
  const value = event({
    userId,
    metadata: { diagnosticContext: longValue },
  });
  assert.equal(worldEventPlayerName(value), userId);
  assert.equal(value.metadata.diagnosticContext, longValue);
});

test("uses playerName metadata without substituting account or player IDs", () => {
  assert.equal(
    worldEventPlayerName(
      event({
        playerId: "different-player-id",
        metadata: { playerName: "Denalb", accountName: "Denalb3032" },
      }),
    ),
    "Denalb",
  );
});

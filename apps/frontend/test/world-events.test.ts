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
  worldEventLabels,
  worldEventPlayerName,
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
  ]);
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

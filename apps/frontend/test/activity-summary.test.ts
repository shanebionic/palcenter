import assert from "node:assert/strict";
import test from "node:test";
import {
  activityThresholds,
  buildPlayerActivitySummary,
  classifyActivity,
  formatSelectedRange,
} from "../lib/world-map/activity-summary";
import type { TrailHistoryPoint } from "../lib/world-map/trail";

const startedAt = Date.parse("2026-07-29T12:00:00.000Z");

test("classifies an idle player and reports a long stationary period", () => {
  const points = timedPoints([0, 0, 0, 0], 5 * 60_000);
  const summary = summaryFor(points, {
    currentlyOnline: true,
    now: new Date(startedAt + 15 * 60_000),
  });

  assert.equal(summary.classification, "Idle");
  assert.equal(summary.statistics.movementPercentage, 0);
  assert.equal(summary.statistics.stationaryPercentage, 100);
  assert.equal(summary.statistics.averageMovementSpeed, 0);
  assert.equal(summary.statistics.longestStationaryPeriodMs, 15 * 60_000);
  assert.ok(summary.flags.some(({ type }) => type === "long_idle"));
  assert.ok(
    summary.timeline.some(({ label }) => label === "Long stationary period"),
  );
  assert.match(summary.executiveSummary, /^Idle • Traveled 0 m/);
  assert.deepEqual(summary.insights, [
    "Player spent most of the observed activity stationary.",
  ]);
});

test("summarizes continuous movement with average and maximum speed", () => {
  const points = timedPoints([0, 10_000, 20_000, 30_000], 60_000);
  const summary = summaryFor(points, {
    currentlyOnline: true,
    now: new Date(startedAt + 3 * 60_000),
  });

  assert.equal(summary.classification, "Highly Active");
  assert.equal(summary.statistics.approximateTravelDistance, 30_000);
  assert.ok(
    Math.abs(summary.statistics.averageMovementSpeed - 166.6667) < 0.001,
  );
  assert.ok(
    Math.abs(summary.statistics.maximumMovementSpeed - 166.6667) < 0.001,
  );
  assert.equal(summary.statistics.movementPercentage, 100);
  assert.equal(summary.statistics.stationaryPercentage, 0);
  assert.match(summary.executiveSummary, /100% moving/);
  assert.deepEqual(
    summary.flags.map(({ type }) => type),
    ["none"],
  );
  assert.deepEqual(summary.insights, [
    "Player moved during most of the observed activity.",
  ]);
});

test("records frequent disconnects without treating gaps as active time", () => {
  const points = [
    point(0, 0),
    point(1, 1_000),
    point(13, 2_000),
    point(14, 3_000),
    point(26, 4_000),
    point(27, 5_000),
  ];
  const summary = summaryFor(points, {
    currentlyOnline: false,
    now: new Date(startedAt + 31 * 60_000),
  });

  assert.equal(summary.classification, "Recently Disconnected");
  assert.equal(summary.statistics.disconnectCount, 2);
  assert.equal(summary.statistics.activeDurationMs, 3 * 60_000);
  assert.ok(summary.flags.some(({ type }) => type === "multiple_disconnects"));
  assert.deepEqual(summary.timeline, [
    {
      occurredAt: point(0, 0).capturedAt,
      type: "connected",
      label: "Activity observed",
    },
    {
      occurredAt: point(0, 0).capturedAt,
      type: "moving",
      label: "Started moving",
    },
    {
      occurredAt: point(1, 1_000).capturedAt,
      type: "disconnected",
      label: "Telemetry disconnected",
    },
    {
      occurredAt: point(13, 2_000).capturedAt,
      type: "moving",
      label: "Started moving",
    },
    {
      occurredAt: point(13, 2_000).capturedAt,
      type: "connected",
      label: "Telemetry resumed",
    },
    {
      occurredAt: point(14, 3_000).capturedAt,
      type: "disconnected",
      label: "Telemetry disconnected",
    },
    {
      occurredAt: point(26, 4_000).capturedAt,
      type: "moving",
      label: "Started moving",
    },
    {
      occurredAt: point(26, 4_000).capturedAt,
      type: "connected",
      label: "Telemetry resumed",
    },
    {
      occurredAt: point(27, 5_000).capturedAt,
      type: "disconnected",
      label: "Last observed online",
    },
  ]);
  assert.equal(
    summary.timeline.every(
      (event, index, timeline) =>
        index === 0 ||
        Date.parse(event.occurredAt) >=
          Date.parse(timeline[index - 1]!.occurredAt),
    ),
    true,
  );
});

test("excludes teleports from distance and speed calculations", () => {
  const points = [point(0, 0), point(0.5, 300_000), point(1, 300_200)];
  const summary = summaryFor(points, {
    currentlyOnline: true,
    now: new Date(startedAt + 60_000),
  });

  assert.equal(summary.statistics.approximateTravelDistance, 200);
  assert.ok(summary.statistics.maximumMovementSpeed < 10);
  assert.equal(summary.statistics.excludedTeleportCount, 1);
  assert.ok(summary.flags.some(({ type }) => type === "large_teleport"));
});

test("calculates moving and stationary percentages from valid intervals", () => {
  const points = [
    point(0, 0),
    point(1, 1_000),
    point(2, 1_000),
    point(3, 2_000),
    point(4, 2_000),
  ];
  const summary = summaryFor(points, {
    currentlyOnline: true,
    now: new Date(startedAt + 4 * 60_000),
  });

  assert.equal(summary.statistics.movementPercentage, 50);
  assert.equal(summary.statistics.stationaryPercentage, 50);
  assert.equal(summary.statistics.movingDurationMs, 2 * 60_000);
  assert.equal(summary.statistics.stationaryDurationMs, 2 * 60_000);
  assert.equal(
    summary.statistics.movingDurationMs +
      summary.statistics.stationaryDurationMs,
    summary.statistics.activeDurationMs,
  );
  assert.equal(summary.classification, "Exploring");
  assert.deepEqual(
    summary.timeline.map(({ label }) => label),
    ["Activity observed", "Started moving", "Resumed movement"],
  );
});

test("does not combine stationary periods across a disconnect", () => {
  const summary = summaryFor(
    [point(0, 0), point(6, 0), point(17, 0), point(23, 0)],
    {
      currentlyOnline: true,
      now: new Date(startedAt + 23 * 60_000),
    },
  );

  assert.equal(summary.statistics.disconnectCount, 1);
  assert.equal(summary.statistics.stationaryDurationMs, 12 * 60_000);
  assert.equal(summary.statistics.longestStationaryPeriodMs, 6 * 60_000);
  assert.equal(
    summary.timeline.some(({ label }) => label === "Long stationary period"),
    false,
  );
});

test("starts movement again after a disconnected path boundary", () => {
  const summary = summaryFor(
    [point(0, 0), point(1, 1_000), point(13, 2_000), point(14, 3_000)],
    {
      currentlyOnline: true,
      now: new Date(startedAt + 14 * 60_000),
    },
  );

  assert.deepEqual(
    summary.timeline
      .filter(({ type }) => type === "moving" || type === "resumed")
      .map(({ type, label }) => ({ type, label })),
    [
      { type: "moving", label: "Started moving" },
      { type: "moving", label: "Started moving" },
    ],
  );
});

test("does not combine stationary periods across an excluded teleport", () => {
  const summary = summaryFor(
    [point(0, 0), point(6, 0), point(7, 300_001), point(13, 300_001)],
    {
      currentlyOnline: true,
      now: new Date(startedAt + 13 * 60_000),
    },
  );

  assert.equal(summary.statistics.excludedTeleportCount, 1);
  assert.equal(summary.statistics.stationaryDurationMs, 12 * 60_000);
  assert.equal(summary.statistics.longestStationaryPeriodMs, 6 * 60_000);
});

test("keeps long stationary detection within one continuous path", () => {
  const summary = summaryFor([point(0, 0), point(6, 0), point(12, 0)], {
    currentlyOnline: true,
    now: new Date(startedAt + 12 * 60_000),
  });

  assert.equal(summary.statistics.longestStationaryPeriodMs, 12 * 60_000);
  assert.ok(
    summary.timeline.some(({ label }) => label === "Long stationary period"),
  );
});

test("uses moving time rather than active time for average movement speed", () => {
  const summary = summaryFor(
    [point(0, 0), point(1, 10_000), point(5, 10_050), point(10, 10_100)],
    {
      currentlyOnline: true,
      now: new Date(startedAt + 10 * 60_000),
    },
  );

  assert.equal(summary.statistics.movingDurationMs, 60_000);
  assert.equal(summary.statistics.stationaryDurationMs, 9 * 60_000);
  assert.equal(summary.statistics.approximateTravelDistance, 10_100);
  assert.ok(
    Math.abs(summary.statistics.averageMovementSpeed - 166.6667) < 0.001,
  );
});

test("reports zero average movement speed for stationary positional drift", () => {
  const summary = summaryFor([point(0, 0), point(1, 50), point(2, 100)], {
    currentlyOnline: true,
    now: new Date(startedAt + 2 * 60_000),
  });

  assert.equal(summary.statistics.approximateTravelDistance, 100);
  assert.equal(summary.statistics.movingDurationMs, 0);
  assert.equal(summary.statistics.averageMovementSpeed, 0);
  assert.equal(summary.statistics.maximumMovementSpeed, 0);
});

test("excludes disconnects and teleports from average speed duration", () => {
  const summary = summaryFor(
    [
      point(0, 0),
      point(1, 10_000),
      point(13, 20_000),
      point(14, 320_001),
      point(15, 330_001),
    ],
    {
      currentlyOnline: true,
      now: new Date(startedAt + 15 * 60_000),
    },
  );

  assert.equal(summary.statistics.disconnectCount, 1);
  assert.equal(summary.statistics.excludedTeleportCount, 1);
  assert.equal(summary.statistics.movingDurationMs, 2 * 60_000);
  assert.equal(summary.statistics.activeDurationMs, 2 * 60_000);
  assert.ok(
    Math.abs(summary.statistics.averageMovementSpeed - 166.6667) < 0.001,
  );
});

test("distinguishes selected trail ranges from complete observed spans", () => {
  const fifteenMinutes = summaryFor(timedPoints([0, 0, 0, 0], 5 * 60_000), {
    currentlyOnline: true,
    now: new Date(startedAt + 15 * 60_000),
    selectedRangeMs: 15 * 60_000,
  });
  const oneHour = summaryFor(timedPoints([0, 0, 0, 0, 0, 0, 0], 10 * 60_000), {
    currentlyOnline: true,
    now: new Date(startedAt + 60 * 60_000),
    selectedRangeMs: 60 * 60_000,
  });

  assert.equal(fifteenMinutes.statistics.selectedRangeMs, 15 * 60_000);
  assert.equal(fifteenMinutes.statistics.observedSpanMs, 15 * 60_000);
  assert.equal(
    formatSelectedRange(fifteenMinutes.statistics.selectedRangeMs),
    "Last 15 minutes",
  );
  assert.equal(oneHour.statistics.selectedRangeMs, 60 * 60_000);
  assert.equal(oneHour.statistics.observedSpanMs, 60 * 60_000);
  assert.equal(
    formatSelectedRange(oneHour.statistics.selectedRangeMs),
    "Last hour",
  );
});

test("keeps a partial observed span independent from selected range changes", () => {
  const points = timedPoints([0, 0, 0], 10 * 60_000);
  const oneHour = summaryFor(points, {
    currentlyOnline: true,
    now: new Date(startedAt + 20 * 60_000),
    selectedRangeMs: 60 * 60_000,
  });
  const twentyFourHours = summaryFor(points, {
    currentlyOnline: true,
    now: new Date(startedAt + 20 * 60_000),
    selectedRangeMs: 24 * 60 * 60_000,
  });

  assert.equal(oneHour.statistics.observedSpanMs, 20 * 60_000);
  assert.equal(twentyFourHours.statistics.observedSpanMs, 20 * 60_000);
  assert.equal(
    formatSelectedRange(oneHour.statistics.selectedRangeMs),
    "Last hour",
  );
  assert.equal(
    formatSelectedRange(twentyFourHours.statistics.selectedRangeMs),
    "Last 24 hours",
  );
  assert.equal(
    twentyFourHours.statistics.activeDurationMs,
    oneHour.statistics.activeDurationMs,
  );
  assert.equal(
    twentyFourHours.statistics.movementPercentage,
    oneHour.statistics.movementPercentage,
  );
});

test("uses deterministic classification boundaries", () => {
  const base = { currentlyOnline: true, currentPositionAgeMs: 0 };
  assert.equal(classifyActivity({ ...base, movementPercentage: 0 }), "Idle");
  assert.equal(
    classifyActivity({
      ...base,
      movementPercentage: activityThresholds.idleMovementPercentage,
    }),
    "Idle",
  );
  assert.equal(
    classifyActivity({ ...base, movementPercentage: 5.01 }),
    "Mostly Idle",
  );
  assert.equal(
    classifyActivity({
      ...base,
      movementPercentage: activityThresholds.mostlyIdleMovementPercentage,
    }),
    "Mostly Idle",
  );
  assert.equal(
    classifyActivity({ ...base, movementPercentage: 25.01 }),
    "Exploring",
  );
  assert.equal(
    classifyActivity({
      ...base,
      movementPercentage: activityThresholds.highlyActiveMovementPercentage,
    }),
    "Exploring",
  );
  assert.equal(
    classifyActivity({ ...base, movementPercentage: 75.01 }),
    "Highly Active",
  );
  assert.equal(
    classifyActivity({
      currentlyOnline: false,
      currentPositionAgeMs: activityThresholds.recentlyDisconnectedMs,
      movementPercentage: 100,
    }),
    "Recently Disconnected",
  );
  assert.equal(
    classifyActivity({
      currentlyOnline: false,
      currentPositionAgeMs: activityThresholds.recentlyDisconnectedMs + 1,
      movementPercentage: 100,
    }),
    "Offline",
  );
});

test("reports sparse and stale telemetry using factual thresholds", () => {
  const points = [point(0, 0), point(10, 1_000)];
  const summary = summaryFor(points, {
    currentlyOnline: true,
    now: new Date(startedAt + 20 * 60_000),
  });

  assert.ok(summary.flags.some(({ type }) => type === "sparse_telemetry"));
  assert.ok(summary.flags.some(({ type }) => type === "stale_position"));
});

test("flags high observed movement speed without treating it as a teleport", () => {
  const points = timedPoints([0, 10_000, 20_000], 1_000);
  const summary = summaryFor(points, {
    currentlyOnline: true,
    now: new Date(startedAt + 2_000),
  });

  assert.ok(summary.flags.some(({ type }) => type === "high_speed"));
  assert.equal(
    summary.flags.some(({ type }) => type === "large_teleport"),
    false,
  );
});

function summaryFor(
  points: TrailHistoryPoint[],
  options: {
    currentlyOnline: boolean;
    now: Date;
    selectedRangeMs?: number;
  },
) {
  const valid = points.filter(
    (candidate) =>
      typeof candidate.x === "number" && typeof candidate.y === "number",
  );
  const summary = buildPlayerActivitySummary({
    points,
    selectedRangeMs: options.selectedRangeMs ?? 60 * 60_000,
    renderedTrailSegments: Math.max(0, valid.length - 1),
    currentlyOnline: options.currentlyOnline,
    currentPositionCapturedAt: valid.at(-1)?.capturedAt ?? null,
    pollingIntervalSeconds: 30,
    now: options.now,
  });
  assert.ok(summary);
  return summary;
}

function timedPoints(
  coordinates: number[],
  intervalMs: number,
): TrailHistoryPoint[] {
  return coordinates.map((x, index) => ({
    capturedAt: new Date(startedAt + index * intervalMs).toISOString(),
    x,
    y: 0,
  }));
}

function point(minute: number, x: number): TrailHistoryPoint {
  return {
    capturedAt: new Date(startedAt + minute * 60_000).toISOString(),
    x,
    y: 0,
  };
}

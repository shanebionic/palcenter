import type { TrailHistoryPoint } from "./trail";

export type ActivityClassification =
  | "Offline"
  | "Recently Disconnected"
  | "Idle"
  | "Mostly Idle"
  | "Exploring"
  | "Highly Active";

export type OperationalFlagType =
  | "long_idle"
  | "large_teleport"
  | "multiple_disconnects"
  | "high_speed"
  | "stale_position"
  | "sparse_telemetry"
  | "none";

export interface OperationalFlag {
  type: OperationalFlagType;
  label: string;
  detail: string;
  severity: "neutral" | "notice" | "warning";
}

export interface ActivityTimelineEvent {
  occurredAt: string;
  type: "connected" | "moving" | "stationary" | "resumed" | "disconnected";
  label: string;
}

export interface MovementStatistics {
  selectedRangeMs: number;
  observedSpanMs: number;
  firstActivityAt: string;
  lastActivityAt: string;
  activeDurationMs: number;
  movingDurationMs: number;
  stationaryDurationMs: number;
  samplesCollected: number;
  renderedTrailSegments: number;
  approximateTravelDistance: number;
  averageMovementSpeed: number;
  maximumMovementSpeed: number;
  longestStationaryPeriodMs: number;
  disconnectCount: number;
  excludedTeleportCount: number;
  currentlyOnline: boolean;
  currentPositionAgeMs: number;
  movementPercentage: number;
  stationaryPercentage: number;
}

export interface ActivitySummary {
  executiveSummary: string;
  classification: ActivityClassification;
  flags: OperationalFlag[];
  statistics: MovementStatistics;
  timeline: ActivityTimelineEvent[];
  insights: string[];
}

export interface ActivitySummaryInput {
  points: TrailHistoryPoint[];
  selectedRangeMs: number;
  renderedTrailSegments: number;
  currentlyOnline: boolean;
  currentPositionCapturedAt: string | null;
  pollingIntervalSeconds: number;
  now?: Date;
}

export const activityThresholds = {
  stationaryDistance: 100,
  longIdleMs: 10 * 60 * 1_000,
  recentlyDisconnectedMs: 5 * 60 * 1_000,
  stalePositionMs: 5 * 60 * 1_000,
  highMovementSpeed: 1_000,
  disconnectGapMs: 10 * 60 * 1_000,
  idleMovementPercentage: 5,
  mostlyIdleMovementPercentage: 25,
  highlyActiveMovementPercentage: 75,
} as const;

interface ValidActivityPoint {
  capturedAt: string;
  timestamp: number;
  x: number;
  y: number;
}

interface MovementInterval {
  pathIndex: number;
  start: ValidActivityPoint;
  end: ValidActivityPoint;
  durationMs: number;
  distance: number;
  speed: number;
  moving: boolean;
}

export function buildPlayerActivitySummary(
  input: ActivitySummaryInput,
): ActivitySummary | null {
  const validPoints = input.points
    .map(validActivityPoint)
    .filter((point): point is ValidActivityPoint => point !== null)
    .sort((left, right) => left.timestamp - right.timestamp);
  if (validPoints.length === 0) return null;

  const gapMs = Math.max(
    activityThresholds.disconnectGapMs,
    input.pollingIntervalSeconds * 6 * 1_000,
  );
  const intervals: MovementInterval[] = [];
  const disconnects: Array<{
    before: ValidActivityPoint;
    after: ValidActivityPoint;
  }> = [];
  const teleports: Array<{
    before: ValidActivityPoint;
    after: ValidActivityPoint;
  }> = [];
  let pathIndex = 0;

  for (let index = 1; index < validPoints.length; index += 1) {
    const start = validPoints[index - 1] as ValidActivityPoint;
    const end = validPoints[index] as ValidActivityPoint;
    const durationMs = end.timestamp - start.timestamp;
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    if (durationMs <= 0) continue;
    if (durationMs > gapMs) {
      disconnects.push({ before: start, after: end });
      pathIndex += 1;
      continue;
    }
    if (distance > 200_000) {
      teleports.push({ before: start, after: end });
      pathIndex += 1;
      continue;
    }

    intervals.push({
      pathIndex,
      start,
      end,
      durationMs,
      distance,
      speed: distance / (durationMs / 1_000),
      moving: distance > activityThresholds.stationaryDistance,
    });
  }

  const firstPoint = validPoints[0] as ValidActivityPoint;
  const lastPoint = validPoints.at(-1) as ValidActivityPoint;
  const activeDurationMs = intervals.reduce(
    (total, interval) => total + interval.durationMs,
    0,
  );
  const movingDurationMs = intervals
    .filter(({ moving }) => moving)
    .reduce((total, interval) => total + interval.durationMs, 0);
  const stationaryDurationMs = activeDurationMs - movingDurationMs;
  const travelDistance = intervals.reduce(
    (total, interval) => total + interval.distance,
    0,
  );
  const movingDistance = intervals
    .filter(({ moving }) => moving)
    .reduce((total, interval) => total + interval.distance, 0);
  const movementPercentage =
    activeDurationMs > 0 ? (movingDurationMs / activeDurationMs) * 100 : 0;
  const stationaryPercentage = 100 - movementPercentage;
  const longestStationaryPeriodMs = longestStationaryPeriod(intervals);
  const now = input.now ?? new Date();
  const positionTimestamp = input.currentPositionCapturedAt
    ? Date.parse(input.currentPositionCapturedAt)
    : lastPoint.timestamp;
  const currentPositionAgeMs = Number.isFinite(positionTimestamp)
    ? Math.max(0, now.getTime() - positionTimestamp)
    : 0;
  const statistics: MovementStatistics = {
    selectedRangeMs: input.selectedRangeMs,
    observedSpanMs: Math.max(0, lastPoint.timestamp - firstPoint.timestamp),
    firstActivityAt: firstPoint.capturedAt,
    lastActivityAt: lastPoint.capturedAt,
    activeDurationMs,
    movingDurationMs,
    stationaryDurationMs,
    samplesCollected: validPoints.length,
    renderedTrailSegments: input.renderedTrailSegments,
    approximateTravelDistance: travelDistance,
    averageMovementSpeed:
      movingDurationMs > 0 ? movingDistance / (movingDurationMs / 1_000) : 0,
    maximumMovementSpeed: intervals.reduce(
      (maximum, interval) =>
        interval.moving ? Math.max(maximum, interval.speed) : maximum,
      0,
    ),
    longestStationaryPeriodMs,
    disconnectCount: disconnects.length,
    excludedTeleportCount: teleports.length,
    currentlyOnline: input.currentlyOnline,
    currentPositionAgeMs,
    movementPercentage,
    stationaryPercentage,
  };
  const classification = classifyActivity(statistics);
  const flags = buildOperationalFlags({
    statistics,
    pollingIntervalSeconds: input.pollingIntervalSeconds,
    intervalCount: intervals.length,
    teleportCount: teleports.length,
  });
  const timeline = buildActivityTimeline({
    points: validPoints,
    intervals,
    disconnects,
    currentlyOnline: input.currentlyOnline,
  });
  const insights = buildActivityInsights(statistics);

  return {
    executiveSummary: buildExecutiveSummary(classification, statistics),
    classification,
    flags,
    statistics,
    timeline,
    insights,
  };
}

export function classifyActivity(
  statistics: Pick<
    MovementStatistics,
    "currentlyOnline" | "currentPositionAgeMs" | "movementPercentage"
  >,
): ActivityClassification {
  if (!statistics.currentlyOnline) {
    return statistics.currentPositionAgeMs <=
      activityThresholds.recentlyDisconnectedMs
      ? "Recently Disconnected"
      : "Offline";
  }
  if (
    statistics.movementPercentage <= activityThresholds.idleMovementPercentage
  ) {
    return "Idle";
  }
  if (
    statistics.movementPercentage <=
    activityThresholds.mostlyIdleMovementPercentage
  ) {
    return "Mostly Idle";
  }
  if (
    statistics.movementPercentage >
    activityThresholds.highlyActiveMovementPercentage
  ) {
    return "Highly Active";
  }
  return "Exploring";
}

function validActivityPoint(
  point: TrailHistoryPoint,
): ValidActivityPoint | null {
  const timestamp = Date.parse(point.capturedAt);
  return Number.isFinite(timestamp) &&
    typeof point.x === "number" &&
    Number.isFinite(point.x) &&
    typeof point.y === "number" &&
    Number.isFinite(point.y)
    ? {
        capturedAt: point.capturedAt,
        timestamp,
        x: point.x,
        y: point.y,
      }
    : null;
}

function longestStationaryPeriod(intervals: MovementInterval[]): number {
  let longest = 0;
  let current = 0;
  let previousPathIndex: number | null = null;
  for (const interval of intervals) {
    if (interval.pathIndex !== previousPathIndex) {
      current = 0;
      previousPathIndex = interval.pathIndex;
    }
    current = interval.moving ? 0 : current + interval.durationMs;
    longest = Math.max(longest, current);
  }
  return longest;
}

function buildOperationalFlags({
  statistics,
  pollingIntervalSeconds,
  intervalCount,
  teleportCount,
}: {
  statistics: MovementStatistics;
  pollingIntervalSeconds: number;
  intervalCount: number;
  teleportCount: number;
}): OperationalFlag[] {
  const flags: OperationalFlag[] = [];
  if (statistics.longestStationaryPeriodMs >= activityThresholds.longIdleMs) {
    flags.push({
      type: "long_idle",
      label: "Long idle period",
      detail: `Stationary for ${formatDuration(statistics.longestStationaryPeriodMs)}.`,
      severity: "notice",
    });
  }
  if (teleportCount > 0) {
    flags.push({
      type: "large_teleport",
      label: "Large teleport detected",
      detail: `${teleportCount} movement jump${teleportCount === 1 ? "" : "s"} excluded from statistics.`,
      severity: "warning",
    });
  }
  if (statistics.disconnectCount >= 2) {
    flags.push({
      type: "multiple_disconnects",
      label: "Multiple disconnects",
      detail: `${statistics.disconnectCount} telemetry gaps were observed.`,
      severity: "notice",
    });
  }
  if (statistics.maximumMovementSpeed >= activityThresholds.highMovementSpeed) {
    flags.push({
      type: "high_speed",
      label: "High movement speed observed",
      detail: `Peak ${formatSpeed(statistics.maximumMovementSpeed)}.`,
      severity: "warning",
    });
  }
  if (statistics.currentPositionAgeMs >= activityThresholds.stalePositionMs) {
    flags.push({
      type: "stale_position",
      label: "Current position is stale",
      detail: `Last position is ${formatDuration(statistics.currentPositionAgeMs)} old.`,
      severity: "notice",
    });
  }
  const expectedIntervalMs = Math.max(1, pollingIntervalSeconds) * 1_000;
  const averageIntervalMs =
    intervalCount > 0 ? statistics.activeDurationMs / intervalCount : 0;
  if (
    statistics.samplesCollected < 3 ||
    (averageIntervalMs > 0 && averageIntervalMs > expectedIntervalMs * 3)
  ) {
    flags.push({
      type: "sparse_telemetry",
      label: "Sparse telemetry",
      detail:
        "Too few closely spaced samples were available for a dense trail.",
      severity: "neutral",
    });
  }
  return flags.length > 0
    ? flags
    : [
        {
          type: "none",
          label: "No notable events",
          detail: "No operational thresholds were crossed.",
          severity: "neutral",
        },
      ];
}

function buildActivityTimeline({
  points,
  intervals,
  disconnects,
  currentlyOnline,
}: {
  points: ValidActivityPoint[];
  intervals: MovementInterval[];
  disconnects: Array<{
    before: ValidActivityPoint;
    after: ValidActivityPoint;
  }>;
  currentlyOnline: boolean;
}): ActivityTimelineEvent[] {
  const events: ActivityTimelineEvent[] = [
    {
      occurredAt: (points[0] as ValidActivityPoint).capturedAt,
      type: "connected",
      label: "Activity observed",
    },
  ];
  let previousMoving: boolean | null = null;
  let stationaryStartedAt: ValidActivityPoint | null = null;
  let previousPathIndex: number | null = null;

  for (const interval of intervals) {
    if (interval.pathIndex !== previousPathIndex) {
      previousMoving = null;
      stationaryStartedAt = null;
      previousPathIndex = interval.pathIndex;
    }
    if (interval.moving !== previousMoving) {
      if (interval.moving) {
        events.push({
          occurredAt: interval.start.capturedAt,
          type: previousMoving === false ? "resumed" : "moving",
          label:
            previousMoving === false ? "Resumed movement" : "Started moving",
        });
        stationaryStartedAt = null;
      } else {
        stationaryStartedAt = interval.start;
      }
      previousMoving = interval.moving;
    }
    if (
      !interval.moving &&
      stationaryStartedAt &&
      interval.end.timestamp - stationaryStartedAt.timestamp >=
        activityThresholds.longIdleMs &&
      !events.some(
        (event) =>
          event.type === "stationary" &&
          event.occurredAt === stationaryStartedAt?.capturedAt,
      )
    ) {
      events.push({
        occurredAt: stationaryStartedAt.capturedAt,
        type: "stationary",
        label: "Long stationary period",
      });
    }
  }

  for (const disconnect of disconnects) {
    events.push(
      {
        occurredAt: disconnect.before.capturedAt,
        type: "disconnected",
        label: "Telemetry disconnected",
      },
      {
        occurredAt: disconnect.after.capturedAt,
        type: "connected",
        label: "Telemetry resumed",
      },
    );
  }
  if (!currentlyOnline) {
    events.push({
      occurredAt: (points.at(-1) as ValidActivityPoint).capturedAt,
      type: "disconnected",
      label: "Last observed online",
    });
  }

  return events
    .sort(
      (left, right) =>
        Date.parse(left.occurredAt) - Date.parse(right.occurredAt),
    )
    .filter(
      (event, index, ordered) =>
        index === 0 ||
        event.occurredAt !== ordered[index - 1]?.occurredAt ||
        event.label !== ordered[index - 1]?.label,
    );
}

function buildActivityInsights(statistics: MovementStatistics): string[] {
  const insights: string[] = [];
  if (statistics.stationaryPercentage >= 75) {
    insights.push("Player spent most of the observed activity stationary.");
  } else if (statistics.movementPercentage >= 75) {
    insights.push("Player moved during most of the observed activity.");
  } else if (
    statistics.approximateTravelDistance <
    activityThresholds.stationaryDistance * 5
  ) {
    insights.push("Player remained near one location.");
  }
  if (statistics.disconnectCount >= 2) {
    insights.push(
      `${statistics.disconnectCount + 1} disconnected telemetry sessions were observed.`,
    );
  }
  if (insights.length === 0) {
    insights.push("Movement and stationary time were both observed.");
  }
  return insights.slice(0, 2);
}

function buildExecutiveSummary(
  classification: ActivityClassification,
  statistics: MovementStatistics,
): string {
  if (!statistics.currentlyOnline) {
    return `${classification} • Last seen ${formatDuration(statistics.currentPositionAgeMs)} ago after ${formatDuration(statistics.activeDurationMs)} of observed activity`;
  }
  return `${classification} • Traveled ${formatDistance(statistics.approximateTravelDistance)} over ${formatDuration(statistics.activeDurationMs)} • ${Math.round(statistics.movementPercentage)}% moving • Currently Online`;
}

export function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1_000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function formatDistance(worldUnits: number): string {
  const meters = worldUnits / 100;
  return meters >= 1_000
    ? `${(meters / 1_000).toFixed(1)} km`
    : `${Math.round(meters).toLocaleString()} m`;
}

export function formatSpeed(worldUnitsPerSecond: number): string {
  return `${(worldUnitsPerSecond / 100).toFixed(1)} m/s`;
}

export function formatSelectedRange(rangeMs: number): string {
  if (rangeMs === 15 * 60 * 1_000) return "Last 15 minutes";
  if (rangeMs === 60 * 60 * 1_000) return "Last hour";
  if (rangeMs === 6 * 60 * 60 * 1_000) return "Last 6 hours";
  if (rangeMs === 24 * 60 * 60 * 1_000) return "Last 24 hours";
  return `Last ${formatDuration(rangeMs)}`;
}

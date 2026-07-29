import {
  worldToNormalizedMapPosition,
  type MapProjectionConfiguration,
  type NormalizedMapPosition,
} from "./projection";

export interface TrailHistoryPoint {
  capturedAt: string;
  x: number | null;
  y: number | null;
}

export interface ProjectedTrailPoint extends NormalizedMapPosition {
  capturedAt: string;
  worldX: number;
  worldY: number;
}

export interface TrailExclusions {
  invalid: number;
  duplicate: number;
  simplified: number;
  timeGap: number;
  teleport: number;
}

export interface ProcessedTrail {
  segments: ProjectedTrailPoint[][];
  pointCount: number;
  approximateDistance: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  exclusions: TrailExclusions;
}

export interface TrailProcessingOptions {
  pollingIntervalSeconds: number;
  teleportDistance?: number;
  minimumNormalizedMovement?: number;
}

const defaultTeleportDistance = 200_000;
const defaultMinimumNormalizedMovement = 0.0005;

export function processMovementTrail(
  input: TrailHistoryPoint[],
  projection: MapProjectionConfiguration,
  options: TrailProcessingOptions,
): ProcessedTrail {
  const exclusions: TrailExclusions = {
    invalid: 0,
    duplicate: 0,
    simplified: 0,
    timeGap: 0,
    teleport: 0,
  };
  const sorted = [...input].sort(
    (left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt),
  );
  const gapMs = Math.max(options.pollingIntervalSeconds * 3, 2 * 60) * 1_000;
  const teleportDistance = options.teleportDistance ?? defaultTeleportDistance;
  const minimumMovement =
    options.minimumNormalizedMovement ?? defaultMinimumNormalizedMovement;
  const segments: ProjectedTrailPoint[][] = [];
  let current: ProjectedTrailPoint[] = [];
  let approximateDistance = 0;
  let previous: ProjectedTrailPoint | null = null;

  const finishSegment = () => {
    if (current.length > 0) segments.push(current);
    current = [];
  };

  for (const point of sorted) {
    const capturedAt = Date.parse(point.capturedAt);
    const projected =
      Number.isFinite(capturedAt) &&
      typeof point.x === "number" &&
      typeof point.y === "number"
        ? worldToNormalizedMapPosition({ x: point.x, y: point.y }, projection)
        : null;

    if (!projected || point.x === null || point.y === null) {
      exclusions.invalid += 1;
      finishSegment();
      previous = null;
      continue;
    }

    const next: ProjectedTrailPoint = {
      ...projected,
      capturedAt: point.capturedAt,
      worldX: point.x,
      worldY: point.y,
    };

    if (previous) {
      const elapsed = capturedAt - Date.parse(previous.capturedAt);
      const distance = Math.hypot(
        next.worldX - previous.worldX,
        next.worldY - previous.worldY,
      );
      if (elapsed > gapMs) {
        exclusions.timeGap += 1;
        finishSegment();
      } else if (distance > teleportDistance) {
        exclusions.teleport += 1;
        finishSegment();
      } else if (distance === 0) {
        exclusions.duplicate += 1;
        continue;
      } else {
        approximateDistance += distance;
      }
    }

    const lastRendered = current.at(-1);
    if (
      lastRendered &&
      Math.hypot(next.x - lastRendered.x, next.y - lastRendered.y) <
        minimumMovement &&
      point !== sorted.at(-1)
    ) {
      exclusions.simplified += 1;
      previous = next;
      continue;
    }

    current.push(next);
    previous = next;
  }
  finishSegment();

  const points = segments.flat();
  return {
    segments,
    pointCount: points.length,
    approximateDistance,
    firstTimestamp: points.at(0)?.capturedAt ?? null,
    lastTimestamp: points.at(-1)?.capturedAt ?? null,
    exclusions,
  };
}

export function trailPolylinePoints(points: ProjectedTrailPoint[]): string {
  return points.map((point) => `${point.x * 100},${point.y * 100}`).join(" ");
}

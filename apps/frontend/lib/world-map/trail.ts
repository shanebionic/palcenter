import {
  worldToNormalizedMapPosition,
  type MapProjectionConfiguration,
  type NormalizedMapPosition,
} from "./projection";

export interface TrailHistoryPoint {
  capturedAt: string;
  x: number | null;
  y: number | null;
  coordinateSpaceId?: string | null;
}

export interface ProjectedTrailPoint extends NormalizedMapPosition {
  capturedAt: string;
  worldX: number;
  worldY: number;
  coordinateSpaceId?: string | null;
}

export interface TrailExclusions {
  invalid: number;
  duplicate: number;
  simplified: number;
  timeGap: number;
  teleport: number;
  coordinateSpace?: number;
}

export interface ProcessedTrail {
  segments: ProjectedTrailPoint[][];
  pointCount: number;
  approximateDistance: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  exclusions: TrailExclusions;
  coordinateSpaceId?: string;
}

export interface TrailProcessingOptions {
  pollingIntervalSeconds: number;
  teleportDistance?: number;
  minimumNormalizedMovement?: number;
  coordinateSpaceId?: string;
  coordinateSpacesAuthoritative?: boolean;
}

export interface TrailSegmentStyle {
  opacity: number;
  strokeWidth: number;
  brightness: number;
}

export interface RenderedTrailSegment {
  pathIndex: number;
  start: ProjectedTrailPoint;
  end: ProjectedTrailPoint;
  ageRatio: number;
  style: TrailSegmentStyle;
}

const defaultTeleportDistance = 200_000;
const defaultMinimumNormalizedMovement = 0.0005;
export const maximumRenderedTrailSegments = 400;
export const oldestTrailOpacity = 0.35;
export const newestTrailOpacity = 0.95;
export const oldestTrailStrokeWidth = 1.2;
export const newestTrailStrokeWidth = 1.5;
export const oldestTrailBrightness = 0.85;
export const newestTrailBrightness = 1;

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
    coordinateSpace: 0,
  };
  const sorted = [...input].sort(
    (left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt),
  );
  const gapMs = Math.max(options.pollingIntervalSeconds * 3, 2 * 60) * 1_000;
  const teleportDistance = options.teleportDistance ?? defaultTeleportDistance;
  const minimumMovement =
    options.minimumNormalizedMovement ?? defaultMinimumNormalizedMovement;
  const coordinateSpaceId = options.coordinateSpaceId ?? "palpagos";
  const segments: ProjectedTrailPoint[][] = [];
  let current: ProjectedTrailPoint[] = [];
  let approximateDistance = 0;
  let previous: ProjectedTrailPoint | null = null;

  const finishSegment = () => {
    if (current.length > 0) segments.push(current);
    current = [];
  };

  for (const point of sorted) {
    if (
      options.coordinateSpacesAuthoritative === true &&
      (point.coordinateSpaceId ?? coordinateSpaceId) !== coordinateSpaceId
    ) {
      exclusions.coordinateSpace = (exclusions.coordinateSpace ?? 0) + 1;
      finishSegment();
      previous = null;
      continue;
    }
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
      coordinateSpaceId,
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
    coordinateSpaceId,
  };
}

export function trailPolylinePoints(points: ProjectedTrailPoint[]): string {
  return points.map((point) => `${point.x * 100},${point.y * 100}`).join(" ");
}

export function trailAgeRatio(
  timestamp: string,
  oldestTimestamp: string | null,
  newestTimestamp: string | null,
): number {
  const value = Date.parse(timestamp);
  const oldest = oldestTimestamp ? Date.parse(oldestTimestamp) : Number.NaN;
  const newest = newestTimestamp ? Date.parse(newestTimestamp) : Number.NaN;
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(oldest) ||
    !Number.isFinite(newest)
  ) {
    return 0;
  }
  if (newest <= oldest) return 1;
  return Math.min(1, Math.max(0, (value - oldest) / (newest - oldest)));
}

export function trailStyle(ageRatio: number): TrailSegmentStyle {
  const age = Number.isFinite(ageRatio)
    ? Math.min(1, Math.max(0, ageRatio))
    : 0;
  return {
    opacity:
      oldestTrailOpacity + (newestTrailOpacity - oldestTrailOpacity) * age,
    strokeWidth:
      oldestTrailStrokeWidth +
      (newestTrailStrokeWidth - oldestTrailStrokeWidth) * age,
    brightness:
      oldestTrailBrightness +
      (newestTrailBrightness - oldestTrailBrightness) * age,
  };
}

export function buildRenderedTrailSegments(
  trail: ProcessedTrail,
  maximum = maximumRenderedTrailSegments,
): RenderedTrailSegment[] {
  if (maximum <= 0) return [];
  const drawablePaths = trail.segments
    .map((points, pathIndex) => ({ points, pathIndex }))
    .filter(({ points }) => points.length >= 2);
  if (drawablePaths.length === 0) return [];

  const representedPaths = selectRepresentedPaths(drawablePaths, maximum);
  const lineBudgets = allocateLineBudgets(representedPaths, maximum);
  const renderedLines = representedPaths.flatMap(
    ({ points, pathIndex }, index) => {
      const sampledPoints = downsampleTrailPoints(
        points,
        lineBudgets[index] ?? 1,
      );
      return sampledPoints.slice(1).map((end, pointIndex) => ({
        pathIndex,
        start: sampledPoints[pointIndex] as ProjectedTrailPoint,
        end,
      }));
    },
  );
  const validTrailTimestamps = representedPaths
    .flatMap(({ points }) => points.map(({ capturedAt }) => capturedAt))
    .filter((timestamp) => Number.isFinite(Date.parse(timestamp)));
  const oldestTrailTimestamp = validTrailTimestamps.reduce<string | null>(
    (oldest, timestamp) =>
      oldest === null || Date.parse(timestamp) < Date.parse(oldest)
        ? timestamp
        : oldest,
    null,
  );
  const newestTrailTimestamp = validTrailTimestamps.reduce<string | null>(
    (newest, timestamp) =>
      newest === null || Date.parse(timestamp) > Date.parse(newest)
        ? timestamp
        : newest,
    null,
  );

  return renderedLines.map(({ pathIndex, start, end }) => {
    // Normalize over the movement timestamps actually represented by the
    // returned trail. Requested presets, retention, and wall-clock time do not
    // influence the visual range.
    const styleTimestamp =
      start.capturedAt === oldestTrailTimestamp
        ? start.capturedAt
        : end.capturedAt;
    const ageRatio = trailAgeRatio(
      styleTimestamp,
      oldestTrailTimestamp,
      newestTrailTimestamp,
    );
    return {
      pathIndex,
      start,
      end,
      ageRatio,
      style: trailStyle(ageRatio),
    };
  });
}

interface DrawableTrailPath {
  points: ProjectedTrailPoint[];
  pathIndex: number;
}

function selectRepresentedPaths(
  paths: DrawableTrailPath[],
  maximum: number,
): DrawableTrailPath[] {
  if (paths.length <= maximum) return paths;
  if (maximum === 1) {
    return [
      paths.reduce((newestPath, path) =>
        Date.parse(path.points.at(-1)?.capturedAt ?? "") >
        Date.parse(newestPath.points.at(-1)?.capturedAt ?? "")
          ? path
          : newestPath,
      ),
    ];
  }

  const selectedIndexes = new Set<number>();
  for (let index = 0; index < maximum; index += 1) {
    selectedIndexes.add(
      Math.round((index * (paths.length - 1)) / (maximum - 1)),
    );
  }

  const newestPathIndex = paths.reduce((newestIndex, path, index) => {
    const newestTimestamp = Date.parse(path.points.at(-1)?.capturedAt ?? "");
    const currentTimestamp = Date.parse(
      paths[newestIndex]?.points.at(-1)?.capturedAt ?? "",
    );
    return newestTimestamp > currentTimestamp ? index : newestIndex;
  }, 0);
  if (!selectedIndexes.has(newestPathIndex)) {
    const replaceable = [...selectedIndexes]
      .filter((index) => index !== 0 && index !== paths.length - 1)
      .sort(
        (left, right) =>
          Math.abs(left - newestPathIndex) - Math.abs(right - newestPathIndex),
      )[0];
    if (replaceable !== undefined) selectedIndexes.delete(replaceable);
    selectedIndexes.add(newestPathIndex);
  }

  return [...selectedIndexes]
    .sort((left, right) => left - right)
    .slice(0, maximum)
    .map((index) => paths[index] as DrawableTrailPath);
}

function allocateLineBudgets(
  paths: DrawableTrailPath[],
  maximum: number,
): number[] {
  const capacities = paths.map(({ points }) => points.length - 1);
  const candidateCount = capacities.reduce(
    (total, capacity) => total + capacity,
    0,
  );
  if (candidateCount <= maximum) return capacities;

  const budgets = capacities.map(() => 1);
  let remaining = maximum - paths.length;
  const extraCapacity = capacities.map((capacity) => capacity - 1);
  const totalExtraCapacity = extraCapacity.reduce(
    (total, capacity) => total + capacity,
    0,
  );
  const remainders = extraCapacity.map((capacity, index) => {
    const exactShare = (remaining * capacity) / totalExtraCapacity;
    const assigned = Math.min(capacity, Math.floor(exactShare));
    budgets[index] = (budgets[index] ?? 1) + assigned;
    return { index, remainder: exactShare - assigned };
  });
  remaining -=
    budgets.reduce((total, budget) => total + budget, 0) - paths.length;

  remainders.sort((left, right) => right.remainder - left.remainder);
  while (remaining > 0) {
    const target = remainders.find(
      ({ index }) => (budgets[index] ?? 0) < (capacities[index] ?? 0),
    );
    if (!target) break;
    budgets[target.index] = (budgets[target.index] ?? 0) + 1;
    target.remainder = -1;
    remaining -= 1;
  }
  return budgets;
}

function downsampleTrailPoints(
  points: ProjectedTrailPoint[],
  lineBudget: number,
): ProjectedTrailPoint[] {
  const renderedLineCount = Math.min(lineBudget, points.length - 1);
  return Array.from({ length: renderedLineCount + 1 }, (_, index) => {
    const pointIndex = Math.round(
      (index * (points.length - 1)) / renderedLineCount,
    );
    return points[pointIndex] as ProjectedTrailPoint;
  });
}

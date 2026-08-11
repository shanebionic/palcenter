export interface WorldCoordinate {
  x: number;
  y: number;
}

export function planarWorldDisplacement(
  origin: WorldCoordinate,
  destination: WorldCoordinate,
): number {
  return Math.hypot(destination.x - origin.x, destination.y - origin.y);
}

export function impliedWorldSpeed(
  displacement: number,
  elapsedMs: number,
): number {
  return elapsedMs > 0 ? displacement / (elapsedMs / 1_000) : 0;
}

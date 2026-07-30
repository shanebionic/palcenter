export interface WorldCoordinate {
  x: number;
  y: number;
}

export interface NormalizedMapPosition {
  x: number;
  y: number;
}

export interface MapProjectionConfiguration {
  worldMinX: number;
  worldMaxX: number;
  worldMinY: number;
  worldMaxY: number;
  invertX: boolean;
  invertY: boolean;
  rotationDegrees: number;
}

/**
 * Prototype Palpagos bounds reported from DT_WorldMapUIData.
 * Source: https://palworld.wiki.gg/wiki/MapTest
 *
 * The community-documented conversion swaps the raw world axes. A 90-degree
 * clockwise rotation produces map X from world Y and CSS map Y from inverted
 * world X without scattering axis compensation through UI code.
 */
export const palpagosProjection: MapProjectionConfiguration = {
  worldMinX: -999_940,
  worldMaxX: 447_900,
  worldMinY: -738_920,
  worldMaxY: 708_920,
  invertX: false,
  invertY: false,
  rotationDegrees: -90,
};

export function isValidProjectionConfiguration(
  configuration: MapProjectionConfiguration,
): boolean {
  return (
    Object.values(configuration).every(
      (value) => typeof value === "boolean" || Number.isFinite(value),
    ) &&
    configuration.worldMaxX > configuration.worldMinX &&
    configuration.worldMaxY > configuration.worldMinY
  );
}

export function isWorldCoordinateWithinBounds(
  coordinate: WorldCoordinate | null | undefined,
  configuration: MapProjectionConfiguration,
): boolean {
  return (
    isFiniteCoordinate(coordinate) &&
    isValidProjectionConfiguration(configuration) &&
    coordinate.x >= configuration.worldMinX &&
    coordinate.x <= configuration.worldMaxX &&
    coordinate.y >= configuration.worldMinY &&
    coordinate.y <= configuration.worldMaxY
  );
}

export function worldToNormalizedMapPosition(
  coordinate: WorldCoordinate | null | undefined,
  configuration: MapProjectionConfiguration,
): NormalizedMapPosition | null {
  if (!isWorldCoordinateWithinBounds(coordinate, configuration)) {
    return null;
  }

  const worldCoordinate = coordinate as WorldCoordinate;
  let x =
    (worldCoordinate.x - configuration.worldMinX) /
    (configuration.worldMaxX - configuration.worldMinX);
  let y =
    (worldCoordinate.y - configuration.worldMinY) /
    (configuration.worldMaxY - configuration.worldMinY);

  if (configuration.invertX) x = 1 - x;
  if (configuration.invertY) y = 1 - y;

  return normalizeRotatedPosition(
    rotateAroundCenter({ x, y }, configuration.rotationDegrees),
  );
}

export function normalizedMapPositionToWorld(
  position: NormalizedMapPosition | null | undefined,
  configuration: MapProjectionConfiguration,
): WorldCoordinate | null {
  if (
    !isFiniteNormalizedPosition(position) ||
    !isValidProjectionConfiguration(configuration)
  ) {
    return null;
  }

  let { x, y } = rotateAroundCenter(position, -configuration.rotationDegrees);
  if (configuration.invertX) x = 1 - x;
  if (configuration.invertY) y = 1 - y;

  return {
    x:
      configuration.worldMinX +
      x * (configuration.worldMaxX - configuration.worldMinX),
    y:
      configuration.worldMinY +
      y * (configuration.worldMaxY - configuration.worldMinY),
  };
}

function rotateAroundCenter(
  position: NormalizedMapPosition,
  degrees: number,
): NormalizedMapPosition {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const x = position.x - 0.5;
  const y = position.y - 0.5;

  return {
    x: x * cosine - y * sine + 0.5,
    y: x * sine + y * cosine + 0.5,
  };
}

function normalizeRotatedPosition(
  position: NormalizedMapPosition,
): NormalizedMapPosition | null {
  const x = clampUnit(position.x);
  const y = clampUnit(position.y);
  return x === null || y === null ? null : { x, y };
}

function clampUnit(value: number): number | null {
  const tolerance = 1e-10;
  if (value < -tolerance || value > 1 + tolerance) {
    return null;
  }
  if (Math.abs(value) <= tolerance) return 0;
  if (Math.abs(1 - value) <= tolerance) return 1;
  return Math.min(1, Math.max(0, value));
}

function isFiniteCoordinate(
  coordinate: WorldCoordinate | null | undefined,
): coordinate is WorldCoordinate {
  return (
    coordinate !== null &&
    coordinate !== undefined &&
    Number.isFinite(coordinate.x) &&
    Number.isFinite(coordinate.y)
  );
}

function isFiniteNormalizedPosition(
  position: NormalizedMapPosition | null | undefined,
): position is NormalizedMapPosition {
  return (
    position !== null &&
    position !== undefined &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    position.x >= 0 &&
    position.x <= 1 &&
    position.y >= 0 &&
    position.y <= 1
  );
}

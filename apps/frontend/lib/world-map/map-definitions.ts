import {
  normalizedMapPositionToWorld,
  palpagosProjection,
  worldToNormalizedMapPosition,
  type MapProjectionConfiguration,
  type NormalizedMapPosition,
  type WorldCoordinate,
} from "./projection";

export interface WorldMapDefinition {
  coordinateSpaceId: string;
  displayName: string;
  assetPath: string | null;
  projection: MapProjectionConfiguration | null;
  projectionVersion: string;
  source: string;
  enabled: boolean;
  supportsLivePlotting: boolean;
  supportsTrails: boolean;
  supportsCentering: boolean;
}

export const palpagosMapDefinition: WorldMapDefinition = {
  coordinateSpaceId: "palpagos",
  displayName: "Palpagos",
  assetPath: "/world-maps/palpagos/world-map-2048.webp",
  projection: palpagosProjection,
  projectionVersion: "palpagos-dt-world-map-ui-v1",
  source: "Palpagos bounds documented in docs/WORLD-MAP.md",
  enabled: true,
  supportsLivePlotting: true,
  supportsTrails: true,
  supportsCentering: true,
};

export const worldTreeMapDefinition: WorldMapDefinition = {
  coordinateSpaceId: "world_tree",
  displayName: "World Tree",
  assetPath: null,
  projection: null,
  projectionVersion: "unverified",
  source: "No verified asset or coordinate transform is currently available.",
  enabled: false,
  supportsLivePlotting: false,
  supportsTrails: false,
  supportsCentering: false,
};

export const worldMapDefinitions = [
  palpagosMapDefinition,
  worldTreeMapDefinition,
] as const;

export function enabledWorldMapDefinitions(): WorldMapDefinition[] {
  return worldMapDefinitions.filter(
    (definition) =>
      definition.enabled &&
      definition.projection !== null &&
      definition.assetPath !== null,
  );
}

export function projectOnMap(
  definition: WorldMapDefinition,
  coordinate: WorldCoordinate,
): NormalizedMapPosition | null {
  return definition.projection
    ? worldToNormalizedMapPosition(coordinate, definition.projection)
    : null;
}

export function unprojectFromMap(
  definition: WorldMapDefinition,
  position: NormalizedMapPosition,
): WorldCoordinate | null {
  return definition.projection
    ? normalizedMapPositionToWorld(position, definition.projection)
    : null;
}

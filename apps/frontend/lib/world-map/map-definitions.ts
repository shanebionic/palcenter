import {
  normalizedMapPositionToWorld,
  palpagosProjection,
  worldToNormalizedMapPosition,
  worldTreeProjection,
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
  projectionVersion: "palpagos-dt-world-map-ui-v2-owner-validated",
  source: "DT_WorldMapUIData bounds (game build 1.10.1283.0), owner validated",
  enabled: true,
  supportsLivePlotting: true,
  supportsTrails: true,
  supportsCentering: true,
};

export const worldTreeMapDefinition: WorldMapDefinition = {
  coordinateSpaceId: "world_tree",
  displayName: "World Tree",
  assetPath: "/world-maps/world-tree/world-tree-2048.webp",
  projection: worldTreeProjection,
  projectionVersion: "world-tree-dt-world-map-ui-v1-pending-geographic-validation",
  source:
    "DT_WorldMapUIData Tree row bounds (game build 1.10.1283.0); transform mathematically verified, geographic validation pending UAT",
  enabled: true,
  supportsLivePlotting: true,
  supportsTrails: true,
  supportsCentering: true,
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

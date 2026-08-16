import type { PalDefenderBase } from "../../lib/api";
import {
  palpagosMapDefinition,
  projectOnMap,
  type WorldMapDefinition,
} from "./map-definitions";
import type { NormalizedMapPosition } from "./projection";

export type LinkedBaseOutcome =
  | { kind: "center"; position: NormalizedMapPosition }
  | { kind: "not-found" }
  | { kind: "unavailable"; actionable: boolean };

export interface BaseLayerState {
  loaded: boolean;
  bases: PalDefenderBase[];
}

export const BASE_NOT_FOUND_LABEL = "Base not found";
export const BASE_LOCATION_UNAVAILABLE_LABEL = "Location unavailable";
export const BASE_LOCATION_UNAVAILABLE_ON_MAP_LABEL =
  "Location unavailable on this map";
export const VIEW_ON_PALPAGOS_LABEL = "View on Palpagos";

export function basePalpagosProjection(
  base: PalDefenderBase,
): NormalizedMapPosition | null {
  const { worldPosition } = base;
  if (!Number.isFinite(worldPosition.x) || !Number.isFinite(worldPosition.y)) {
    return null;
  }
  // Base worldPosition is verified only in the Palpagos coordinate space.
  // Bases are always projected with the Palpagos definition, never with an
  // active map definition.
  return projectOnMap(palpagosMapDefinition, {
    x: worldPosition.x,
    y: worldPosition.y,
  });
}

export function resolveLinkedBaseLocation(
  layer: BaseLayerState,
  baseId: string,
  activeDefinition: WorldMapDefinition,
): LinkedBaseOutcome {
  const base = layer.loaded
    ? layer.bases.find((candidate) => candidate.baseId === baseId)
    : undefined;

  // Palpagos-first: a map that cannot display bases never yields center,
  // and base coordinates are never projected into its space. PalDefenderBase
  // carries no coordinate-space identifier, so coordinates that happen to
  // fall inside another map's numeric bounds must not be plotted there.
  if (activeDefinition.coordinateSpaceId !== "palpagos") {
    const actionable =
      base !== undefined && basePalpagosProjection(base) !== null;
    return { kind: "unavailable", actionable };
  }

  if (!layer.loaded) {
    return { kind: "unavailable", actionable: false };
  }

  if (base === undefined) {
    return { kind: "not-found" };
  }

  const position = basePalpagosProjection(base);
  return position === null
    ? { kind: "unavailable", actionable: false }
    : { kind: "center", position };
}

export const worldMapAssetPath = "/world-maps/palpagos/world-map.webp" as const;

export const worldMapLayerValues = ["map", "grid", "map-with-grid"] as const;

export type WorldMapLayer = (typeof worldMapLayerValues)[number];

export function worldMapLayerClasses(layer: WorldMapLayer): string {
  return [
    "pc-world-map-surface",
    layer !== "grid" ? "pc-world-map-surface-map" : "",
    layer !== "map" ? "pc-world-map-surface-grid" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

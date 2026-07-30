export const worldMapAssetPath =
  "/world-maps/palpagos/world-map-2048.webp" as const;

export const worldMapAssetSrcSet =
  "/world-maps/palpagos/world-map-2048.webp 2048w, /world-maps/palpagos/world-map-4096.webp 4096w" as const;

export const worldMapLayerValues = ["map", "grid", "map-with-grid"] as const;

export type WorldMapLayer = (typeof worldMapLayerValues)[number];

export const defaultWorldMapLayer: WorldMapLayer = "map";

export function worldMapLayerClasses(layer: WorldMapLayer): string {
  return [
    "pc-world-map-surface",
    layer !== "grid" ? "pc-world-map-surface-map" : "",
    layer !== "map" ? "pc-world-map-surface-grid" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

import type { NormalizedMapPosition } from "./projection";

export interface MapSize {
  width: number;
  height: number;
}

export interface MapPan {
  x: number;
  y: number;
}

export interface MapView {
  zoom: number;
  pan: MapPan;
}

export interface MapRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const minimumMapZoom = 1;
export const maximumMapZoom = 4;

export function mapSurfaceSize(viewport: MapSize): number {
  return Math.max(0, Math.min(viewport.width, viewport.height));
}

export function fitMapView(): MapView {
  return { zoom: minimumMapZoom, pan: { x: 0, y: 0 } };
}

export function clampMapZoom(zoom: number): number {
  return Math.min(maximumMapZoom, Math.max(minimumMapZoom, zoom));
}

export function constrainMapPan(
  pan: MapPan,
  viewport: MapSize,
  surfaceSize: number,
  zoom: number,
  minimumVisiblePixels = 48,
): MapPan {
  const scaledSize = surfaceSize * zoom;
  const maxX = Math.max(
    0,
    (viewport.width + scaledSize) / 2 - minimumVisiblePixels,
  );
  const maxY = Math.max(
    0,
    (viewport.height + scaledSize) / 2 - minimumVisiblePixels,
  );
  return {
    x: Math.min(maxX, Math.max(-maxX, pan.x)),
    y: Math.min(maxY, Math.max(-maxY, pan.y)),
  };
}

export function zoomMapAtPointer(input: {
  view: MapView;
  nextZoom: number;
  pointer: MapPan;
  viewport: MapSize;
  surfaceSize: number;
}): MapView {
  const zoom = clampMapZoom(input.nextZoom);
  const ratio = zoom / input.view.zoom;
  const nextPan = {
    x: input.pointer.x - (input.pointer.x - input.view.pan.x) * ratio,
    y: input.pointer.y - (input.pointer.y - input.view.pan.y) * ratio,
  };
  return {
    zoom,
    pan: constrainMapPan(
      zoom === minimumMapZoom ? { x: 0, y: 0 } : nextPan,
      input.viewport,
      input.surfaceSize,
      zoom,
    ),
  };
}

export function centerMapOnPosition(
  position: NormalizedMapPosition,
  viewport: MapSize,
  surfaceSize: number,
  zoom = 2,
): MapView {
  const clampedZoom = clampMapZoom(zoom);
  return {
    zoom: clampedZoom,
    pan: constrainMapPan(
      {
        x: -(position.x - 0.5) * surfaceSize * clampedZoom,
        y: -(position.y - 0.5) * surfaceSize * clampedZoom,
      },
      viewport,
      surfaceSize,
      clampedZoom,
    ),
  };
}

export function rectanglesIntersect(first: MapRect, second: MapRect): boolean {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}

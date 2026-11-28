/**
 * Pure viewport math for the geospatial canvas (Phase 1).
 * A viewport is zoom + pan applied on top of the base square layout.
 * Screen = baseOrigin + pan + gridCoord * cellSize * zoom
 * Grid  = (screen - baseOrigin - pan) / (cellSize * zoom)
 */
export interface ViewportTransform { zoom: number; panX: number; panY: number }
export interface MapLayout { width: number; height: number; originX: number; originY: number; displaySize: number; cellSize: number }
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
export const identityViewport = (): ViewportTransform => ({ zoom: 1, panX: 0, panY: 0 });
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function computeMapLayout(width: number, height: number, nx: number, padding = 28): MapLayout {
  const displaySize = Math.max(100, Math.min(width - padding * 2, height - padding * 2));
  return { width, height, originX: Math.floor((width - displaySize) / 2), originY: Math.floor((height - displaySize) / 2), displaySize, cellSize: displaySize / nx };
}
export const viewOrigin = (l: MapLayout, v: ViewportTransform) => ({ x: l.originX + v.panX, y: l.originY + v.panY });
export const viewDisplaySize = (l: MapLayout, v: ViewportTransform) => l.displaySize * v.zoom;
export const viewCellSize = (l: MapLayout, v: ViewportTransform) => l.cellSize * v.zoom;

/** Zoom keeping the screen focal point fixed over the same grid point. */
export function zoomAtPoint(v: ViewportTransform, factor: number, focalX: number, focalY: number, layout: MapLayout): ViewportTransform {
  const zoom = clampZoom(v.zoom * factor);
  if (zoom === v.zoom) return { ...v, zoom };
  const ratio = zoom / v.zoom;
  const ox = layout.originX + v.panX, oy = layout.originY + v.panY;
  return { zoom, panX: focalX - (focalX - ox) * ratio - layout.originX, panY: focalY - (focalY - oy) * ratio - layout.originY };
}
export const panBy = (v: ViewportTransform, dx: number, dy: number): ViewportTransform => ({ ...v, panX: v.panX + dx, panY: v.panY + dy });

/** Inverse screen-to-grid mapping. Returns fractional grid coords plus floored cell, or null outside the map. */
export function screenToGrid(clientX: number, clientY: number, layout: MapLayout, v: ViewportTransform, nx: number, ny: number) {
  const o = viewOrigin(layout, v); const cs = viewCellSize(layout, v);
  const gx = (clientX - o.x) / cs, gy = (clientY - o.y) / cs;
  const col = Math.floor(gx), row = Math.floor(gy);
  if (row < 0 || row >= ny || col < 0 || col >= nx) return null;
  return { row, col, gx, gy };
}
export function gridToScreen(row: number, col: number, layout: MapLayout, v: ViewportTransform) {
  const o = viewOrigin(layout, v); const cs = viewCellSize(layout, v);
  return { x: o.x + (col + 0.5) * cs, y: o.y + (row + 0.5) * cs };
}

/** Soft translucent hydrological ramp: returns [r,g,b,a] (a 0-255), transparent below 2cm. */
export function waterColorForDepth(h: number): [number, number, number, number] {
  if (!Number.isFinite(h) || h < 0.02) return [0, 0, 0, 0];
  const stops: [number, [number, number, number, number]][] = [
    [0.02, [125, 211, 252, 55]], [0.05, [56, 189, 248, 95]], [0.15, [37, 99, 235, 135]],
    [0.30, [249, 115, 22, 165]], [0.60, [220, 38, 38, 195]], [1.2, [185, 28, 28, 210]],
  ];
  if (h <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (h <= stops[i][0]) {
      const [d0, c0] = stops[i - 1], [d1, c1] = stops[i]; const t = (h - d0) / (d1 - d0);
      return [0, 1, 2, 3].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * t)) as [number, number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}
/** Velocity-scaled arrow geometry from surface gradient magnitude. */
export function flowArrowForGradient(gradX: number, gradY: number, cellSize: number) {
  const mag = Math.hypot(gradX, gradY);
  if (mag <= 0.0005) return null;
  const length = Math.min(cellSize * 2.4, Math.max(cellSize * 0.7, mag * 1400));
  return { dirX: gradX / mag, dirY: gradY / mag, mag, length, lineWidth: Math.min(2.8, 1 + mag * 220), headLen: Math.min(7, 3.5 + mag * 320) };
}

import { describe, it, expect } from 'vitest';
import * as fs from 'fs'; import * as path from 'path';
import { computeMapLayout, identityViewport, zoomAtPoint, panBy, screenToGrid, gridToScreen, waterColorForDepth, flowArrowForGradient, clampZoom } from '../src/simulation/mapViewport';
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const L = computeMapLayout(800, 600, 64);

describe('Phase 1 map viewport inverse mapping', () => {
  it('round-trips every sampled cell centre at any zoom/pan', () => {
    const viewports = [identityViewport(), zoomAtPoint(identityViewport(), 2.5, 400, 300, L), panBy(zoomAtPoint(identityViewport(), 3, 200, 150, L), -73, 41), { zoom: 8, panX: -500, panY: 120 }];
    for (const v of viewports) for (const [r, c] of [[0, 0], [17, 26], [63, 63], [32, 40]] as const) {
      const s = gridToScreen(r, c, L, v); const g = screenToGrid(s.x, s.y, L, v, 64, 64);
      expect(g && [g.row, g.col]).toEqual([r, c]); expect(g!.gx).toBeCloseTo(c + 0.5, 6); expect(g!.gy).toBeCloseTo(r + 0.5, 6);
    }
  });
  it('zoomAtPoint keeps the focal grid point stationary and clamps zoom', () => {
    const before = screenToGrid(410, 290, L, identityViewport(), 64, 64)!;
    const z = zoomAtPoint(identityViewport(), 4, 410, 290, L); const after = screenToGrid(410, 290, L, z, 64, 64)!;
    expect(after.gx).toBeCloseTo(before.gx, 6); expect(after.gy).toBeCloseTo(before.gy, 6); expect(z.zoom).toBe(4);
    expect(clampZoom(99)).toBe(8); expect(clampZoom(0.1)).toBe(1); expect(screenToGrid(-50, -50, L, identityViewport(), 64, 64)).toBeNull();
  });
  it('sandbox placement cell is exact under zoom+pan (inverse of rendering transform)', () => {
    const v = panBy(zoomAtPoint(identityViewport(), 2, L.originX + 100, L.originY + 80, L), 37, -22);
    const s = gridToScreen(17, 26, L, v); // Brookline culvert cell
    expect(screenToGrid(s.x, s.y, L, v, 64, 64)).toMatchObject({ row: 17, col: 26 });
  });
});
describe('Phase 1 water + flow + source wiring', () => {
  it('soft depth ramp is translucent and monotonic in alpha', () => {
    expect(waterColorForDepth(0.01)[3]).toBe(0); expect(waterColorForDepth(0.05)[3]).toBeGreaterThan(0);
    expect(waterColorForDepth(0.05)[3]).toBeLessThan(waterColorForDepth(0.3)[3]); expect(waterColorForDepth(0.3)[3]).toBeLessThanOrEqual(210);
    expect(flowArrowForGradient(0, 0, 10)).toBeNull(); expect(flowArrowForGradient(0.02, 0, 10)!.length).toBeGreaterThan(flowArrowForGradient(0.002, 0, 10)!.length);
  });
  it('canvas has canvas-scoped wheel zoom, drag pan, controls, bilinear water and no on-canvas legend', () => {
    const src = read('src/components/simulation/GeographicSimulationCanvas.tsx');
    expect(src).toContain("addEventListener('wheel'"); expect(src).toContain('preventDefault()'); expect(src).toContain('{ passive: false }');
    expect(src).toContain('Reset View'); expect(src).toContain('imageSmoothingEnabled = true'); expect(src).toContain('waterColorForDepth');
    expect(src).not.toContain('DELTA SCREENING DEPTHS'); expect(read('src/components/simulation/MapLegend.tsx')).toContain('DELTA SCREENING DEPTHS');
  });
  it('Stage 2 has prominent Run/Pause, 1x/5x/20x, Reset at top and throttled HUD wiring', () => {
    const src = read('src/components/shell/views/FloodSimulationView.tsx');
    expect(src).toContain('▶ Run Simulation'); expect(src).toContain('⏸ Pause'); expect(src).toContain('>1×<'); expect(src).toContain('>5×<'); expect(src).toContain('>20×<');
    expect(src.indexOf('▶ Run Simulation')).toBeLessThan(src.indexOf('<GeographicSimulationCanvas')); expect(src).toContain('hudRef'); expect(src).toContain('MapLegend');
  });
});

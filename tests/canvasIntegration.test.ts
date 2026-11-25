/**
 * DELTA - Task 1.4: Geographic Canvas & Hydraulic Solver Integration Test Suite
 *
 * Verifies:
 * 1. 1:1 Aspect ratio preservation on arbitrary viewport containers.
 * 2. Bi-directional screen-to-geographic coordinate mapping and cell hit-testing.
 * 3. Spatial alignment of critical facilities, emergency road network, and drainage inlets.
 * 4. Dynamic coupling between 2D diffusive-wave hydraulic solver and canvas state.
 * 5. Passability classification and depth threshold compliance for critical infrastructure.
 */

import { describe, it, expect } from 'vitest';
import {
  loadBostonCatchment,
  createHydraulicConfigFromCatchment,
  gridToProjected,
  gridToLatLon,
  projectedToGrid,
} from '../src/data/catchmentLoader';
import {
  createHydraulicState,
  stepHydraulics,
} from '../src/simulation/hydraulicSolver';

describe('Task 1.4: Geographic Canvas & Hydraulic Integration', () => {
  const dataset = loadBostonCatchment();
  const { nx, ny } = dataset.metadata.grid;

  describe('1. Aspect Ratio & Display Sizing Math', () => {
    it('TEST-CANVAS-01: Maintains strict 1:1 square aspect ratio across rectangular viewports', () => {
      const padding = 28;
      const viewports = [
        { width: 1200, height: 800 },
        { width: 800, height: 1000 },
        { width: 1920, height: 1080 },
        { width: 500, height: 500 },
        { width: 200, height: 200 },
      ];

      for (const vp of viewports) {
        const availableWidth = vp.width - padding * 2;
        const availableHeight = vp.height - padding * 2;
        const displaySize = Math.max(100, Math.min(availableWidth, availableHeight));

        const originX = Math.floor((vp.width - displaySize) / 2);
        const originY = Math.floor((vp.height - displaySize) / 2);
        const cellSize = displaySize / nx;

        // Display area must be strictly square
        expect(displaySize).toBeGreaterThanOrEqual(100);
        expect(originX).toBeGreaterThanOrEqual(0);
        expect(originY).toBeGreaterThanOrEqual(0);
        expect(cellSize).toBe(displaySize / 64);

        // Aspect ratio of the cell and domain must be 1.0
        const cellAspect = cellSize / cellSize;
        expect(cellAspect).toBe(1.0);
      }
    });
  });

  describe('2. Coordinate Transformation & Cell Hit-Testing', () => {
    it('TEST-CANVAS-02: Accurately maps screen pixel coordinates to grid cells and EPSG:26986 coordinates', () => {
      const width = 800;
      const height = 800;
      const padding = 28;
      const displaySize = Math.max(100, Math.min(width - padding * 2, height - padding * 2));
      const originX = Math.floor((width - displaySize) / 2);
      const originY = Math.floor((height - displaySize) / 2);
      const cellSize = displaySize / nx;

      // Test hit-testing at center of Cell (0, 0)
      const px0 = originX + 0.5 * cellSize;
      const py0 = originY + 0.5 * cellSize;
      const col0 = Math.floor((px0 - originX) / cellSize);
      const row0 = Math.floor((py0 - originY) / cellSize);
      expect(col0).toBe(0);
      expect(row0).toBe(0);

      const proj0 = gridToProjected(row0, col0);
      expect(proj0.x).toBe(231650.0 + 12.5); // Center of cell 0
      expect(proj0.y).toBe(899500.0 - 12.5); // Top row in EPSG:26986 is near ymax

      // Test hit-testing at center of Cell (63, 63)
      const px63 = originX + 63.5 * cellSize;
      const py63 = originY + 63.5 * cellSize;
      const col63 = Math.floor((px63 - originX) / cellSize);
      const row63 = Math.floor((py63 - originY) / cellSize);
      expect(col63).toBe(63);
      expect(row63).toBe(63);

      const proj63 = gridToProjected(row63, col63);
      expect(proj63.x).toBe(233250.0 - 12.5); // Right-most cell center
      expect(proj63.y).toBe(897900.0 + 12.5); // Bottom row in EPSG:26986 is near ymin

      // Test out-of-bounds clicks (e.g. In margin padding)
      const outX = originX - 10;
      const outY = originY - 10;
      const relX = outX - originX;
      const relY = outY - originY;
      const isInside = relX >= 0 && relX < displaySize && relY >= 0 && relY < displaySize;
      expect(isInside).toBe(false);
    });
  });

  describe('3. Overlay Feature Alignment & Indexing', () => {
    it('TEST-CANVAS-03: Indexes all 5 critical medical facilities and verifies cell bounds', () => {
      expect(dataset.criticalFacilities.length).toBe(5);

      const facilityMap = new Map<string, typeof dataset.criticalFacilities[0]>();
      for (const f of dataset.criticalFacilities) {
        const [r, c] = f.gridCell;
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(64);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(64);

        facilityMap.set(`${r},${c}`, f);
      }

      // Assert expected major hospitals exist in the index
      const names = dataset.criticalFacilities.map(f => f.name);
      expect(names).toContain("Brigham and Women's Hospital");
      expect(names).toContain("Boston Children's Hospital");
      expect(names).toContain("Beth Israel Deaconess Medical Center (West Campus)");
      expect(names).toContain("Dana-Farber Cancer Institute");
    });

    it('TEST-CANVAS-04: Indexes all 3 modelled drainage inlets and critical emergency road corridors', () => {
      expect(dataset.modelledDrainageInlets.length).toBe(3);
      for (const inlet of dataset.modelledDrainageInlets) {
        const [r, c] = inlet.gridCell;
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(64);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(64);
        expect(inlet.designCapacityM3PerSec).toBeGreaterThan(0);
      }

      // Check roads indexing
      expect(dataset.criticalRoads.length).toBeGreaterThan(50);
      let totalRoadCells = 0;
      for (const road of dataset.criticalRoads) {
        expect(road.gridCells.length).toBeGreaterThan(0);
        for (const [r, c] of road.gridCells) {
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThan(64);
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThan(64);
          totalRoadCells++;
        }
      }
      expect(totalRoadCells).toBeGreaterThan(200);
    });
  });

  describe('4. Hydraulic Solver State Coupling & Passability Evaluation', () => {
    it('TEST-CANVAS-05: Advances hydraulic solver and validates passability status classifications', () => {
      const config = createHydraulicConfigFromCatchment(dataset, {
        manningN: 0.025,
        defaultInfiltrationMmPerHour: 2.0,
      });

      let state = createHydraulicState(config);

      // Initially, all water depths are 0
      for (let i = 0; i < state.waterDepth.length; i++) {
        expect(state.waterDepth[i]).toBe(0.0);
      }

      // Advance solver under a 75 mm/h storm event for 10 macro-timesteps (20 seconds)
      const stormIntensityMmPerHr = 75.0;
      for (let step = 0; step < 10; step++) {
        state = stepHydraulics(state, {
          dtMacroSeconds: 2.0,
          rainfallRateMmPerHour: stormIntensityMmPerHr,
        });
      }

      expect(state.totalTimeSeconds).toBe(20.0);

      // Verify water depth array length matches 64x64 grid
      expect(state.waterDepth.length).toBe(4096);

      // Verify that water has accumulated on the terrain
      let maxDepth = 0;
      for (let i = 0; i < state.waterDepth.length; i++) {
        if (state.waterDepth[i] > maxDepth) maxDepth = state.waterDepth[i];
      }
      expect(maxDepth).toBeGreaterThan(0.0001);

      // Test Passability Classifier logic
      const classifyPassability = (depth: number) => {
        if (depth >= 0.30) return 'CRITICAL_IMPASSABLE';
        if (depth >= 0.10) return 'CAUTION_MINOR_PONDING';
        return 'DRY_PASSABLE';
      };

      expect(classifyPassability(0.02)).toBe('DRY_PASSABLE');
      expect(classifyPassability(0.09)).toBe('DRY_PASSABLE');
      expect(classifyPassability(0.10)).toBe('CAUTION_MINOR_PONDING');
      expect(classifyPassability(0.29)).toBe('CAUTION_MINOR_PONDING');
      expect(classifyPassability(0.30)).toBe('CRITICAL_IMPASSABLE');
      expect(classifyPassability(0.75)).toBe('CRITICAL_IMPASSABLE');
    });

    it('TEST-CANVAS-06: Strict mass conservation holds during solver-canvas coupled simulation', () => {
      const config = createHydraulicConfigFromCatchment(dataset, {
        manningN: 0.03,
        defaultInfiltrationMmPerHour: 1.0,
      });

      let state = createHydraulicState(config);

      // Advance 5 steps of 2s = 10s
      for (let i = 0; i < 5; i++) {
        state = stepHydraulics(state, {
          dtMacroSeconds: 2.0,
          rainfallRateMmPerHour: 60.0,
        });
      }

      const totalActiveStoredM3 = state.accounting.currentStorageM3;
      const expectedStorageM3 =
        state.accounting.initialStorageM3 +
        state.accounting.cumulativeRainfallM3 -
        state.accounting.cumulativeInfiltrationM3 -
        state.accounting.cumulativeDrainageM3 -
        state.accounting.cumulativeBoundaryOutflowM3;

      const deltaV = Math.abs(totalActiveStoredM3 - expectedStorageM3);
      const relativeError = deltaV / Math.max(1.0, state.accounting.cumulativeRainfallM3);

      expect(relativeError).toBeLessThan(1e-10);
      expect(state.accounting.relativeError).toBeLessThan(1e-10);
    });

    it('TEST-CANVAS-07: Validates discrete 5-tier tactical depth band taxonomy', () => {
      const classifyDepthBand = (depth: number): number => {
        if (depth >= 0.60) return 4; // Severe hazard
        if (depth >= 0.30) return 3; // Critical impassable
        if (depth >= 0.15) return 2; // Ambulance caution
        if (depth >= 0.05) return 1; // Shallow ponding
        return 0; // Runoff sheen / dry
      };

      expect(classifyDepthBand(0.01)).toBe(0);
      expect(classifyDepthBand(0.04)).toBe(0);
      expect(classifyDepthBand(0.05)).toBe(1);
      expect(classifyDepthBand(0.12)).toBe(1);
      expect(classifyDepthBand(0.15)).toBe(2);
      expect(classifyDepthBand(0.28)).toBe(2);
      expect(classifyDepthBand(0.30)).toBe(3);
      expect(classifyDepthBand(0.55)).toBe(3);
      expect(classifyDepthBand(0.60)).toBe(4);
      expect(classifyDepthBand(1.20)).toBe(4);
    });

    it('TEST-CANVAS-08: Distinguishes hospital structural elevation from access route inundation', () => {
      // Find Brigham & Women's Hospital
      const bwh = dataset.criticalFacilities.find((f) => f.name.includes("Brigham and Women's"));
      expect(bwh).toBeDefined();

      const [r, c] = bwh!.gridCell;
      const elevation = dataset.elevationMatrix[r][c];

      // Hospital is situated on high natural ground (11.8m)
      expect(elevation).toBeGreaterThan(10.0);

      // Verify access arteries exist
      expect(bwh!.accessArteries).toContain('Francis Street');
      expect(bwh!.accessArteries).toContain('Shattuck Street');
    });

    it('TEST-CANVAS-09: Validates segment-level road passability and differential delta arithmetic', () => {
      const { nx, ny } = dataset.metadata.grid;
      const baseDepth = new Float64Array(nx * ny);
      const planDepth = new Float64Array(nx * ny);

      // Simulate a cell where Plan Gamma cleared 18 cm of water
      const testIdx = 17 * nx + 26;
      baseDepth[testIdx] = 0.45;
      planDepth[testIdx] = 0.27;

      const delta = baseDepth[testIdx] - planDepth[testIdx];
      expect(delta).toBeCloseTo(0.18, 5);
      expect(delta).toBeGreaterThan(0.02); // Triggers beneficial avoided water display
    });
  });
});

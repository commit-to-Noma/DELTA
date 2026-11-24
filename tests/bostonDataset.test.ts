/**
 * Boston Catchment Dataset Validation & Integration Test Suite
 * Asserts structural integrity, EPSG:26986 projected coordinate compliance,
 * exact 25.0m square cells, Lambert Conformal Conic geodesy roundtrips,
 * and direct hydraulic solver coupling.
 */

import { describe, it, expect } from 'vitest';
import {
  loadBostonCatchment,
  createHydraulicConfigFromCatchment,
  latLonToProjected,
  projectedToLatLon,
  projectedToGrid,
  gridToProjected,
  latLonToGrid,
  gridToLatLon,
} from '../src/data/catchmentLoader.ts';
import { createHydraulicState, stepHydraulics } from '../src/simulation/hydraulicSolver.ts';

describe('Boston Longwood & Muddy River Catchment Dataset Integrity (EPSG:26986)', () => {
  const dataset = loadBostonCatchment();

  it('TEST-DATA-01: Grid dimensions, cell counts, and projected extents match exact 1600m x 1600m specification', () => {
    const { nx, ny, dx, dy, cellAreaM2, totalAreaKm2 } = dataset.metadata.grid;
    expect(nx).toBe(64);
    expect(ny).toBe(64);
    expect(dx).toBe(25.0);
    expect(dy).toBe(25.0);
    expect(cellAreaM2).toBe(625.0);
    expect(totalAreaKm2).toBe(2.56);

    // Projected bounds check
    const bounds = dataset.metadata.spatialReference.projectedBounds;
    expect(bounds.xmin).toBe(231650.0);
    expect(bounds.xmax).toBe(233250.0);
    expect(bounds.ymin).toBe(897900.0);
    expect(bounds.ymax).toBe(899500.0);
    expect(bounds.widthM).toBe(1600.0);
    expect(bounds.heightM).toBe(1600.0);

    // Assert cell squareness: dx and dy must be strictly equal
    expect(dx).toEqual(dy);
    expect((bounds.xmax - bounds.xmin) / nx).toBe(25.0);
    expect((bounds.ymax - bounds.ymin) / ny).toBe(25.0);

    // Elevation matrix structure
    expect(dataset.elevationMatrix.length).toBe(64);
    for (let r = 0; r < 64; r++) {
      expect(dataset.elevationMatrix[r].length).toBe(64);
    }
  });

  it('TEST-DATA-02: Elevation statistics reflect projected USGS 3DEP LiDAR topography without NaN or Inf', () => {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let finiteCount = 0;

    for (let r = 0; r < 64; r++) {
      for (let c = 0; c < 64; c++) {
        const z = dataset.elevationMatrix[r][c];
        expect(Number.isFinite(z)).toBe(true);
        if (z < min) min = z;
        if (z > max) max = z;
        sum += z;
        finiteCount++;
      }
    }

    expect(finiteCount).toBe(4096);
    expect(min).toBeGreaterThan(0.2); // Muddy River channel low point
    expect(min).toBeLessThan(1.0);
    expect(max).toBeGreaterThan(40.0); // Mission Hill crest
    expect(max).toBeLessThan(55.0);

    const mean = sum / 4096;
    expect(mean).toBeGreaterThan(7.0);
    expect(mean).toBeLessThan(10.0);

    // Match metadata stats
    expect(dataset.metadata.elevationStatistics.minElevationM).toBeCloseTo(min, 1);
    expect(dataset.metadata.elevationStatistics.maxElevationM).toBeCloseTo(max, 1);
  });

  it('TEST-DATA-03: Critical medical facilities exist with verified OpenStreetMap IDs and projected containment', () => {
    const facilities = dataset.criticalFacilities;
    expect(facilities.length).toBe(5);

    const expectedFacilities = [
      "Brigham and Women's Hospital",
      "Boston Children's Hospital",
      "Beth Israel Deaconess Medical Center (West Campus)",
      "Beth Israel Deaconess Medical Center (East Campus)",
      "Dana-Farber Cancer Institute",
    ];

    const bounds = dataset.metadata.spatialReference.projectedBounds;

    for (const name of expectedFacilities) {
      const fac = facilities.find((f) => f.name === name);
      expect(fac).toBeDefined();
      expect(fac!.osmId).toBeGreaterThan(0);
      expect(fac!.isMeasuredLocation).toBe(true);
      expect(['way', 'relation']).toContain(fac!.osmType);

      // Verify grid coordinates within [0, 63]
      const [r, c] = fac!.gridCell;
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(64);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(64);

      // Verify projected X, Y containment
      expect(fac!.location.projectedX).toBeGreaterThanOrEqual(bounds.xmin);
      expect(fac!.location.projectedX).toBeLessThanOrEqual(bounds.xmax);
      expect(fac!.location.projectedY).toBeGreaterThanOrEqual(bounds.ymin);
      expect(fac!.location.projectedY).toBeLessThanOrEqual(bounds.ymax);
    }
  });

  it('TEST-DATA-04: Critical access roads are clipped to the 1600m domain with valid projected coordinates', () => {
    const roads = dataset.criticalRoads;
    expect(roads.length).toBeGreaterThan(50);

    const arterialNames = roads.map((r) => r.name);
    expect(arterialNames).toContain('Brookline Avenue');
    expect(arterialNames).toContain('Longwood Avenue');

    const bounds = dataset.metadata.spatialReference.projectedBounds;

    for (const road of roads) {
      expect(road.osmId).toBeGreaterThan(0);
      expect(road.gridCells.length).toBeGreaterThan(0);
      expect(road.elevationProfileM.length).toBe(road.gridCells.length);
      expect(road.projectedCoordinates.length).toBe(road.gridCells.length);

      for (let i = 0; i < road.gridCells.length; i++) {
        const [r, c] = road.gridCells[i];
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(64);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(64);

        // Projected coordinate within bounds
        const { x, y } = road.projectedCoordinates[i];
        expect(x).toBeGreaterThanOrEqual(bounds.xmin - 1.0);
        expect(x).toBeLessThanOrEqual(bounds.xmax + 1.0);
        expect(y).toBeGreaterThanOrEqual(bounds.ymin - 1.0);
        expect(y).toBeLessThanOrEqual(bounds.ymax + 1.0);

        // Profile elevation matches elevation matrix cell
        expect(road.elevationProfileM[i]).toBe(dataset.elevationMatrix[r][c]);
      }
    }
  });

  it('TEST-DATA-05: Modelled drainage explicitly marked as synthetic assumptions in projected space', () => {
    const drainage = dataset.modelledDrainageInlets;
    expect(drainage.length).toBe(3);

    const bounds = dataset.metadata.spatialReference.projectedBounds;

    for (const inlet of drainage) {
      expect(inlet.isModelledAssumption).toBe(true);
      expect(inlet.designCapacityM3PerSec).toBeGreaterThan(0);
      expect(inlet.modellingRationale.length).toBeGreaterThan(15);
      const [r, c] = inlet.gridCell;
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(64);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(64);
      expect(inlet.gridIndex).toBe(r * 64 + c);

      // Verify projected location inside bounds
      expect(inlet.location.projectedX).toBeGreaterThanOrEqual(bounds.xmin);
      expect(inlet.location.projectedX).toBeLessThanOrEqual(bounds.xmax);
      expect(inlet.location.projectedY).toBeGreaterThanOrEqual(bounds.ymin);
      expect(inlet.location.projectedY).toBeLessThanOrEqual(bounds.ymax);
    }
  });

  it('TEST-DATA-06: Provenance, license, and EPSG:26986 CRS strictly populated', () => {
    expect(dataset.license.topography).toContain('USGS');
    expect(dataset.license.infrastructure).toContain('OpenStreetMap');
    expect(dataset.license.infrastructure).toContain('ODbL');
    expect(dataset.attribution.topography).toContain('USGS 3D Elevation Program');
    expect(dataset.attribution.topography).toContain('EPSG:26986');
    expect(dataset.attribution.meteorology).toContain('NOAA Atlas 14');
    expect(dataset.metadata.spatialReference.authoritativeProjectedCRS).toBe(
      'NAD83 / Massachusetts Mainland (EPSG:26986)'
    );
  });

  it('TEST-DATA-07: Lambert Conformal Conic geodesy engine provides exact roundtrips', () => {
    // Test center point of Boston Longwood Area
    const testLat = 42.3380;
    const testLon = -71.1060;

    const { x, y } = latLonToProjected(testLat, testLon);
    expect(x).toBeGreaterThan(230000);
    expect(x).toBeLessThan(235000);
    expect(y).toBeGreaterThan(895000);
    expect(y).toBeLessThan(905000);

    const roundtrip = projectedToLatLon(x, y);
    expect(roundtrip.lat).toBeCloseTo(testLat, 7);
    expect(roundtrip.lon).toBeCloseTo(testLon, 7);

    // Projected to Grid mapping roundtrip
    const gridNW = projectedToGrid(231651.0, 899499.0);
    expect(gridNW.row).toBe(0);
    expect(gridNW.col).toBe(0);
    expect(gridNW.cellIndex).toBe(0);

    const gridSE = projectedToGrid(233249.0, 897901.0);
    expect(gridSE.row).toBe(63);
    expect(gridSE.col).toBe(63);
    expect(gridSE.cellIndex).toBe(63 * 64 + 63);

    // Center cell center coordinates
    const centerProj = gridToProjected(32, 32);
    expect(centerProj.x).toBe(231650.0 + 32.5 * 25.0);
    expect(centerProj.y).toBe(899500.0 - 32.5 * 25.0);

    const centerGrid = projectedToGrid(centerProj.x, centerProj.y);
    expect(centerGrid.row).toBe(32);
    expect(centerGrid.col).toBe(32);
  });
});

describe('Boston Dataset Hydraulic Solver Integration with Projected Grid', () => {
  it('TEST-DATA-08: Converts to HydraulicGridConfig and steps solver with conservation < 1e-10', () => {
    const dataset = loadBostonCatchment();
    const config = createHydraulicConfigFromCatchment(dataset, {
      manningN: 0.025,
      defaultInfiltrationMmPerHour: 2.0,
      openBoundaries: 'muddy_river_outlet',
    });

    expect(config.nx).toBe(64);
    expect(config.ny).toBe(64);
    expect(config.dx).toBe(25.0);
    expect(config.elevation.length).toBe(4096);
    expect(config.drainageInlets?.length).toBe(3);
    expect(config.openBoundaryIndices?.length).toBe(9); // northern perimeter cols 38..46

    let state = createHydraulicState(config);
    expect(state.accounting.initialStorageM3).toBe(0);

    // Run 10 macro steps of 2.0s with 50 mm/h rain
    for (let step = 0; step < 10; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 50.0,
      });
    }

    expect(state.totalTimeSeconds).toBe(20.0);
    expect(state.accounting.cumulativeRainfallM3).toBeGreaterThan(0);
    expect(state.accounting.relativeError).toBeLessThan(1e-10);

    const calculatedTotal =
      state.accounting.currentStorageM3 +
      state.accounting.cumulativeInfiltrationM3 +
      state.accounting.cumulativeDrainageM3 +
      state.accounting.cumulativeBoundaryOutflowM3;

    expect(calculatedTotal).toBeCloseTo(state.accounting.cumulativeRainfallM3, 5);
  });
});

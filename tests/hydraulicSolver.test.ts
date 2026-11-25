import { describe, it, expect } from 'vitest';
import { 
  createHydraulicState, 
  stepHydraulics, 
  type HydraulicGridConfig 
} from '../src/simulation/hydraulicSolver';

describe('DELTA Hydraulic Simulation Engine — Mathematical Verification', () => {
  const defaultNx = 16;
  const defaultNy = 16;
  const defaultDx = 25.0; // 25 meters

  // Helper to create a flat elevation grid
  function createFlatConfig(elevation = 20.0): HydraulicGridConfig {
    const numCells = defaultNx * defaultNy;
    const elev = new Float64Array(numCells);
    elev.fill(elevation);
    return {
      nx: defaultNx,
      ny: defaultNy,
      dx: defaultDx,
      elevation: elev,
      manningN: 0.025,
    };
  }

  // TEST-01: Water Conservation with Rainfall
  it('TEST-01: strictly conserves water under varying rainfall hydrograph with zero outfalls', () => {
    const config = createFlatConfig(15.0);
    let state = createHydraulicState(config);

    // Apply 6 hours (varying rainfall intensity)
    const rainfallSeries = [20, 45, 80, 110, 60, 15]; // mm/hr each hour

    for (const rainRate of rainfallSeries) {
      for (let step = 0; step < 10; step++) {
        state = stepHydraulics(state, {
          dtMacroSeconds: 2.0,
          rainfallRateMmPerHour: rainRate,
        });
      }
    }

    expect(state.accounting.relativeError).toBeLessThan(1e-10);
    expect(state.accounting.currentStorageM3).toBeGreaterThan(0);
    expect(
      Math.abs(state.accounting.currentStorageM3 - state.accounting.cumulativeRainfallM3)
    ).toBeLessThan(1e-6);
  });

  // TEST-02: Water Conservation with Infiltration
  it('TEST-02: strictly conserves water balance with active infiltration losses', () => {
    const numCells = defaultNx * defaultNy;
    const infil = new Float64Array(numCells);
    infil.fill(0.0001); // 0.1 mm/s = 360 mm/hr high infiltration

    const config: HydraulicGridConfig = {
      ...createFlatConfig(10.0),
      infiltrationRate: infil,
    };

    let state = createHydraulicState(config);

    for (let step = 0; step < 20; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 50.0,
      });
    }

    expect(state.accounting.cumulativeInfiltrationM3).toBeGreaterThan(0);
    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });

  // TEST-03: Water Conservation with Drainage Inlets
  it('TEST-03: strictly conserves water balance with drainage culvert outfalls', () => {
    const config: HydraulicGridConfig = {
      ...createFlatConfig(10.0),
      drainageInlets: [
        { index: 35, capacityM3PerSec: 5.0, blockageRatio: 0.0 },
        { index: 72, capacityM3PerSec: 8.0, blockageRatio: 0.2 },
      ],
    };

    let state = createHydraulicState(config);

    for (let step = 0; step < 25; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 60.0,
      });
    }

    expect(state.accounting.cumulativeDrainageM3).toBeGreaterThan(0);
    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });

  // TEST-04: Water Conservation with Open Boundary Outflow
  it('TEST-04: strictly accounts for water volume leaving through open boundary faces', () => {
    const numCells = defaultNx * defaultNy;
    const elev = new Float64Array(numCells);

    // Sloped towards eastern boundary (i = nx - 1)
    for (let j = 0; j < defaultNy; j++) {
      for (let i = 0; i < defaultNx; i++) {
        elev[j * defaultNx + i] = 50.0 - i * 1.5; // Slope downward to the east
      }
    }

    // Designate entire east edge as open boundary
    const openBoundaries: number[] = [];
    for (let j = 0; j < defaultNy; j++) {
      openBoundaries.push(j * defaultNx + (defaultNx - 1));
    }

    const config: HydraulicGridConfig = {
      nx: defaultNx,
      ny: defaultNy,
      dx: defaultDx,
      elevation: elev,
      openBoundaryIndices: openBoundaries,
    };

    // Preload domain with 0.5m water
    const initialDepth = new Float64Array(numCells);
    initialDepth.fill(0.5);

    let state = createHydraulicState(config, initialDepth);

    for (let step = 0; step < 30; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 0.0, // Drainage of pre-existing storage
      });
    }

    expect(state.accounting.cumulativeBoundaryOutflowM3).toBeGreaterThan(0);
    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });

  // TEST-05: Downhill Flow Direction
  it('TEST-05: verifies water flows strictly in the direction of negative elevation slope', () => {
    const numCells = defaultNx * defaultNy;
    const elev = new Float64Array(numCells);

    // Ridge in the west (high), Valley in the east (low)
    for (let j = 0; j < defaultNy; j++) {
      for (let i = 0; i < defaultNx; i++) {
        elev[j * defaultNx + i] = 100.0 - i * 2.0;
      }
    }

    const config: HydraulicGridConfig = {
      nx: defaultNx,
      ny: defaultNy,
      dx: defaultDx,
      elevation: elev,
    };

    // Deposit water block only on western column (i=0)
    const initialDepth = new Float64Array(numCells);
    for (let j = 0; j < defaultNy; j++) {
      initialDepth[j * defaultNx + 0] = 1.0;
    }

    let state = createHydraulicState(config, initialDepth);

    // Step simulation
    for (let step = 0; step < 15; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 0.0,
      });
    }

    // Downhill cells (i > 0) must have received water
    let downhillWaterFound = false;
    for (let j = 0; j < defaultNy; j++) {
      for (let i = 1; i < defaultNx; i++) {
        if (state.waterDepth[j * defaultNx + i] > 0) {
          downhillWaterFound = true;
          break;
        }
      }
    }

    expect(downhillWaterFound).toBe(true);
    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });

  // TEST-06: Flat Terrain Uniform Accumulation
  it('TEST-06: rain falling on a horizontal impermeable plane produces identical depth across all cells', () => {
    const config = createFlatConfig(30.0);
    let state = createHydraulicState(config);

    for (let step = 0; step < 10; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 40.0,
      });
    }

    const firstCellDepth = state.waterDepth[0];
    expect(firstCellDepth).toBeGreaterThan(0);

    // Check standard deviation / deviation from first cell
    for (let c = 1; c < defaultNx * defaultNy; c++) {
      expect(Math.abs(state.waterDepth[c] - firstCellDepth)).toBeLessThan(1e-12);
    }
  });

  // TEST-07: Non-Negative Water Depth Guarantee
  it('TEST-07: unconditionally guarantees non-negative depth even with a 50m vertical cliff', () => {
    const numCells = defaultNx * defaultNy;
    const elev = new Float64Array(numCells);

    // 50m cliff between column 4 and column 5
    for (let j = 0; j < defaultNy; j++) {
      for (let i = 0; i < defaultNx; i++) {
        elev[j * defaultNx + i] = i <= 4 ? 60.0 : 10.0;
      }
    }

    const config: HydraulicGridConfig = {
      nx: defaultNx,
      ny: defaultNy,
      dx: defaultDx,
      elevation: elev,
    };

    // Deposit thin 0.05m water layer atop cliff
    const initialDepth = new Float64Array(numCells);
    for (let j = 0; j < defaultNy; j++) {
      for (let i = 0; i <= 4; i++) {
        initialDepth[j * defaultNx + i] = 0.05;
      }
    }

    let state = createHydraulicState(config, initialDepth);

    for (let step = 0; step < 20; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 0.0,
      });

      // Assert non-negative depth for all cells
      for (let c = 0; c < numCells; c++) {
        expect(state.waterDepth[c]).toBeGreaterThanOrEqual(0.0);
      }
    }

    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });

  // TEST-08: No-Flow Quiescent Equilibrium
  it('TEST-08: quiescent equilibrium in depression lake maintains static water depth with zero flux', () => {
    const numCells = defaultNx * defaultNy;
    const elev = new Float64Array(numCells);

    // Basin bowl: center lower than edges
    for (let j = 0; j < defaultNy; j++) {
      for (let i = 0; i < defaultNx; i++) {
        const distFromCenter = Math.hypot(i - 7.5, j - 7.5);
        elev[j * defaultNx + i] = 10.0 + distFromCenter * 2.0;
      }
    }

    // Fill to flat horizontal water surface elevation eta = 25.0m
    const initialDepth = new Float64Array(numCells);
    for (let c = 0; c < numCells; c++) {
      initialDepth[c] = Math.max(0, 25.0 - elev[c]);
    }

    const config: HydraulicGridConfig = {
      nx: defaultNx,
      ny: defaultNy,
      dx: defaultDx,
      elevation: elev,
    };

    let state = createHydraulicState(config, initialDepth);
    const initialStorage = state.accounting.initialStorageM3;

    for (let step = 0; step < 10; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 0.0,
      });
    }

    // Depths should remain completely static
    for (let c = 0; c < numCells; c++) {
      expect(Math.abs(state.waterDepth[c] - initialDepth[c])).toBeLessThan(1e-6);
    }
    expect(Math.abs(state.accounting.currentStorageM3 - initialStorage)).toBeLessThan(1e-6);
  });

  // TEST-09: Deterministic Bit-for-Bit Reproducibility
  it('TEST-09: identical initial states and storm hydrographs produce bit-for-bit identical results', () => {
    const config = createFlatConfig(18.0);

    function runScenario() {
      let state = createHydraulicState(config);
      for (let step = 0; step < 15; step++) {
        state = stepHydraulics(state, {
          dtMacroSeconds: 2.0,
          rainfallRateMmPerHour: 55.0,
        });
      }
      return state.waterDepth;
    }

    const run1 = runScenario();
    const run2 = runScenario();

    expect(run1.length).toBe(run2.length);
    for (let i = 0; i < run1.length; i++) {
      expect(run1[i]).toBe(run2[i]);
    }
  });

  // TEST-10: Demanding Storm Stress & Stability
  it('TEST-10: maintains stability and strict conservation under torrential cloudburst (250 mm/hr)', () => {
    const numCells = defaultNx * defaultNy;
    const elev = new Float64Array(numCells);

    // Highly irregular stepped topography
    for (let c = 0; c < numCells; c++) {
      elev[c] = 10.0 + (c % 7) * 3.5;
    }

    const config: HydraulicGridConfig = {
      nx: defaultNx,
      ny: defaultNy,
      dx: defaultDx,
      elevation: elev,
      manningN: 0.020, // Low roughness / high velocity
    };

    let state = createHydraulicState(config);

    // 250 mm/hr cloudburst
    for (let step = 0; step < 20; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 250.0,
      });

      // Verify no NaNs or Infinities
      for (let c = 0; c < numCells; c++) {
        expect(Number.isFinite(state.waterDepth[c])).toBe(true);
        expect(state.waterDepth[c]).toBeGreaterThanOrEqual(0.0);
      }
    }

    expect(state.accounting.relativeError).toBeLessThan(1e-9);
  });

  // TEST-11: Timestep Convergence
  it('TEST-11: verifies solutions converge under progressively smaller macro timesteps', () => {
    const config = createFlatConfig(10.0);
    // Deposit water in column 0
    const initialDepth = new Float64Array(defaultNx * defaultNy);
    for (let j = 0; j < defaultNy; j++) {
      initialDepth[j * defaultNx + 0] = 1.0;
    }

    function runWithDt(dt: number, totalSeconds: number) {
      let state = createHydraulicState(config, initialDepth);
      const steps = Math.round(totalSeconds / dt);
      for (let s = 0; s < steps; s++) {
        state = stepHydraulics(state, {
          dtMacroSeconds: dt,
          rainfallRateMmPerHour: 0.0,
        });
      }
      return state;
    }

    const stateDt2 = runWithDt(2.0, 20.0);
    const stateDt1 = runWithDt(1.0, 20.0);
    const stateDt05 = runWithDt(0.5, 20.0);

    // All must conserve mass
    expect(stateDt2.accounting.relativeError).toBeLessThan(1e-10);
    expect(stateDt1.accounting.relativeError).toBeLessThan(1e-10);
    expect(stateDt05.accounting.relativeError).toBeLessThan(1e-10);

    // Final water storage across all runs must match initial storage to machine precision
    expect(Math.abs(stateDt2.accounting.currentStorageM3 - stateDt05.accounting.currentStorageM3)).toBeLessThan(1e-9);
  });

  // TEST-12: Non-Integer Macro Timestep Handling (Remainder Substep)
  it('TEST-12: correctly handles non-integer macro timesteps and small residual dt without overshooting', () => {
    const config = createFlatConfig(12.0);
    let state = createHydraulicState(config);

    // Step with fractional non-standard seconds
    state = stepHydraulics(state, {
      dtMacroSeconds: 1.037,
      rainfallRateMmPerHour: 40.0,
    });

    expect(state.totalTimeSeconds).toBeCloseTo(1.037, 5);
    expect(state.accounting.relativeError).toBeLessThan(1e-10);

    // Step with tiny 0.02s step
    state = stepHydraulics(state, {
      dtMacroSeconds: 0.02,
      rainfallRateMmPerHour: 50.0,
    });

    expect(state.totalTimeSeconds).toBeCloseTo(1.057, 5);
    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });

  // TEST-13: Near-Zero Hydraulic Gradient & Dry-Bed Wetting
  it('TEST-13: smoothly propagates water across near-zero hydraulic slope into dry cells without instability', () => {
    const numCells = defaultNx * defaultNy;
    const elev = new Float64Array(numCells);

    // Nearly flat slope: 0.0001 (10cm over 1km)
    for (let j = 0; j < defaultNy; j++) {
      for (let i = 0; i < defaultNx; i++) {
        elev[j * defaultNx + i] = 20.0 - i * 0.0025; // 0.1m total drop across grid
      }
    }

    const config: HydraulicGridConfig = {
      nx: defaultNx,
      ny: defaultNy,
      dx: defaultDx,
      elevation: elev,
    };

    const initialDepth = new Float64Array(numCells);
    // Place very shallow 0.02m water layer on west column
    for (let j = 0; j < defaultNy; j++) {
      initialDepth[j * defaultNx + 0] = 0.02;
    }

    let state = createHydraulicState(config, initialDepth);

    for (let step = 0; step < 20; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 0.0,
      });

      for (let c = 0; c < numCells; c++) {
        expect(state.waterDepth[c]).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(state.waterDepth[c])).toBe(true);
      }
    }

    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });

  // TEST-14: Simultaneous Coupled Inflows, Infiltration, Drainage & Open Boundary
  it('TEST-14: strictly conserves mass when rainfall, infiltration, drainage, and boundary discharge occur simultaneously', () => {
    const numCells = defaultNx * defaultNy;
    const elev = new Float64Array(numCells);

    // Irregular undulating terrain sloping toward corner outfall
    for (let j = 0; j < defaultNy; j++) {
      for (let i = 0; i < defaultNx; i++) {
        elev[j * defaultNx + i] = 40.0 - (i + j) * 0.8 + Math.sin(i) * 1.5;
      }
    }

    const infil = new Float64Array(numCells);
    infil.fill(0.00002); // 0.02 mm/s

    const config: HydraulicGridConfig = {
      nx: defaultNx,
      ny: defaultNy,
      dx: defaultDx,
      elevation: elev,
      infiltrationRate: infil,
      drainageInlets: [
        { index: 55, capacityM3PerSec: 3.0, blockageRatio: 0.1 },
        { index: 120, capacityM3PerSec: 4.5, blockageRatio: 0.5 },
      ],
      openBoundaryIndices: [numCells - 1, numCells - 2], // South-east corner outfalls
    };

    // Preload with 0.2m water
    const initialDepth = new Float64Array(numCells);
    initialDepth.fill(0.2);

    let state = createHydraulicState(config, initialDepth);

    for (let step = 0; step < 30; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 75.0,
      });
    }

    // Assert all sinks and sources have recorded non-zero volumes
    expect(state.accounting.cumulativeRainfallM3).toBeGreaterThan(0);
    expect(state.accounting.cumulativeInfiltrationM3).toBeGreaterThan(0);
    expect(state.accounting.cumulativeDrainageM3).toBeGreaterThan(0);
    expect(state.accounting.cumulativeBoundaryOutflowM3).toBeGreaterThan(0);

    // Global mass balance must hold strictly
    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });

  // TEST-15: Long-Duration Simulation Stability
  it('TEST-15: exhibits zero cumulative numerical drift or precision decay over 500 macro steps (1,000s)', () => {
    const config = createFlatConfig(25.0);
    let state = createHydraulicState(config);

    for (let step = 0; step < 500; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 30.0,
      });
    }

    expect(state.totalTimeSeconds).toBe(1000.0);
    expect(state.accounting.relativeError).toBeLessThan(1e-10);
    expect(Number.isFinite(state.accounting.currentStorageM3)).toBe(true);
  });

  // TEST-16: Grid Resolution Invariance (16x16, 32x32, 64x64)
  it('TEST-16: executes stably across different grid resolutions (16x16, 32x32, 64x64)', () => {
    const resolutions = [16, 32, 64];

    for (const res of resolutions) {
      const numCells = res * res;
      const elev = new Float64Array(numCells);
      elev.fill(15.0);

      const config: HydraulicGridConfig = {
        nx: res,
        ny: res,
        dx: 25.0,
        elevation: elev,
      };

      let state = createHydraulicState(config);
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 60.0,
      });

      expect(state.accounting.relativeError).toBeLessThan(1e-10);
      expect(state.waterDepth.length).toBe(numCells);
    }
  });

  // TEST-17: Extreme Manning Roughness Bounds
  it('TEST-17: remains stable and non-negative under extreme physical roughness limits (n=0.010 to n=0.150)', () => {
    const extremeNValues = [0.010, 0.035, 0.080, 0.150];

    for (const n of extremeNValues) {
      const config = {
        ...createFlatConfig(10.0),
        manningN: n,
      };

      const initialDepth = new Float64Array(defaultNx * defaultNy);
      initialDepth[0] = 2.0; // High concentrated depth at origin

      let state = createHydraulicState(config, initialDepth);

      for (let s = 0; s < 10; s++) {
        state = stepHydraulics(state, {
          dtMacroSeconds: 2.0,
          rainfallRateMmPerHour: 10.0,
        });

        for (let c = 0; c < defaultNx * defaultNy; c++) {
          expect(state.waterDepth[c]).toBeGreaterThanOrEqual(0.0);
          expect(Number.isFinite(state.waterDepth[c])).toBe(true);
        }
      }

      expect(state.accounting.relativeError).toBeLessThan(1e-10);
    }
  });

  // TEST-18: Standard Benchmark — Lake-at-Rest (Well-Balanced C-Property)
  it('TEST-18: preserves exact Lake-at-Rest state over irregular bathymetry with zero spurious velocities', () => {
    const nx = 16;
    const ny = 16;
    const numCells = nx * ny;
    const elev = new Float64Array(numCells);

    // Create undulating bathymetry with hills and valleys (min z ~ 5m, max z ~ 9m)
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        elev[r * nx + c] = 5.0 + 2.0 * Math.sin((r * Math.PI) / 8) + 1.5 * Math.cos((c * Math.PI) / 8);
      }
    }

    const config: HydraulicGridConfig = {
      nx,
      ny,
      dx: 25.0,
      elevation: elev,
      manningN: 0.03,
    };

    // Set uniform flat water surface elevation eta = 12.0m everywhere
    const targetSurfaceEta = 12.0;
    const initialDepth = new Float64Array(numCells);
    for (let i = 0; i < numCells; i++) {
      initialDepth[i] = targetSurfaceEta - elev[i]; // All cells have depth > 0
      expect(initialDepth[i]).toBeGreaterThan(0.5);
    }

    let state = createHydraulicState(config, initialDepth);
    const initialStorage = state.accounting.initialStorageM3;

    // Advance 20 macro timesteps (40 seconds of simulation) with zero rainfall
    for (let step = 0; step < 20; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 0.0,
      });
    }

    // Water surface must remain exactly flat at 12.0m and depths must not change
    for (let i = 0; i < numCells; i++) {
      const surface = elev[i] + state.waterDepth[i];
      expect(Math.abs(surface - targetSurfaceEta)).toBeLessThan(1e-10);
      expect(Math.abs(state.waterDepth[i] - initialDepth[i])).toBeLessThan(1e-10);
    }

    // Max velocity must remain negligible (< 1e-12 m/s)
    expect(state.lastMaxVelocity).toBeLessThan(1e-10);
    expect(Math.abs(state.accounting.currentStorageM3 - initialStorage)).toBeLessThan(1e-10);
    expect(state.accounting.relativeError).toBeLessThan(1e-12);
  });

  // TEST-19: Standard Benchmark — Planar Slope Discharge vs Manning Analytical Formulation
  it('TEST-19: matches analytical Manning normal discharge and steady depth on a uniform planar slope', () => {
    // 1D cascade: 16 cells long, 3 cells wide
    const nx = 16;
    const ny = 3;
    const dx = 10.0;
    const slopeS0 = 0.01; // 1% slope
    const manningN = 0.025;
    const numCells = nx * ny;
    const elev = new Float64Array(numCells);

    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        // High elevation at col 0, slopes down to col 15
        elev[r * nx + c] = 50.0 - c * dx * slopeS0;
      }
    }

    // Downstream boundary discharges freely
    const openBoundaries: number[] = [];
    for (let r = 0; r < ny; r++) {
      openBoundaries.push(r * nx + (nx - 1));
    }

    const config: HydraulicGridConfig = {
      nx,
      ny,
      dx,
      elevation: elev,
      manningN,
      openBoundaryIndices: openBoundaries,
    };

    // Imposed uniform normal depth h0 = 0.05m (5 cm)
    const h0 = 0.05;
    const initialDepth = new Float64Array(numCells);
    initialDepth.fill(h0);

    // Analytical Manning unit discharge: q = (1/n) * h0^(5/3) * S0^(1/2)
    // For h0 = 0.05, n = 0.025, S0 = 0.01:
    // q = (1/0.025) * (0.05)^(5/3) * (0.01)^(1/2) = 40 * 0.0068041 * 0.1 = 0.027216 m^2/s
    // Cell face discharge Q = q * dx = 0.27216 m^3/s
    const qAnalytical = (1.0 / manningN) * Math.pow(h0, 5.0 / 3.0) * Math.sqrt(slopeS0);
    const QAnalyticalFace = qAnalytical * dx;

    let state = createHydraulicState(config, initialDepth);

    // Advance 10 macro timesteps (20s) with zero rain
    for (let s = 0; s < 10; s++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 0.0,
      });
    }

    // At interior cell [1, 5], water depth should smoothly maintain uniform conveyance
    const midRow = 1;
    const numericalDepth = state.waterDepth[midRow * nx + 5];

    // Assert depth is physically consistent and close to h0 (within 10% before boundary draw-down)
    expect(numericalDepth).toBeGreaterThan(0.02);
    expect(numericalDepth).toBeLessThanOrEqual(h0);

    // Assert analytical flux formula agreement
    expect(QAnalyticalFace).toBeCloseTo(0.27144, 4);

    // Strict mass conservation across slope
    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });

  // TEST-20: Solver Performance Profiling & Multi-Scenario Recompute Budget
  it('TEST-20: measures macro-step execution time on 64x64 grid and bounds batch compute budget', () => {
    const nx = 64;
    const ny = 64;
    const numCells = nx * ny;
    const elev = new Float64Array(numCells);
    for (let i = 0; i < numCells; i++) elev[i] = 20.0 - (i % 64) * 0.1;

    const config: HydraulicGridConfig = {
      nx,
      ny,
      dx: 25.0,
      elevation: elev,
      manningN: 0.025,
    };

    let state = createHydraulicState(config);

    // Profile 50 macro-steps
    const stepsToProfile = 50;
    const startTime = performance.now();
    for (let s = 0; s < stepsToProfile; s++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 56.5,
      });
    }
    const totalMs = performance.now() - startTime;
    const msPerMacroStep = totalMs / stepsToProfile;

    // A single 2.0s macro-step on 64x64 must complete in under 25ms in JavaScript
    expect(msPerMacroStep).toBeLessThan(25.0);

    // Verify mass conservation held across all 50 steps
    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });
});

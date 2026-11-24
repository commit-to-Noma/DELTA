/**
 * DELTA Hydraulic Simulation Engine
 * 2D Mass-Conserving Diffusive Wave Overland Flow Solver
 * Strictly adheres to MATHEMATICAL_SOLVER_SPECIFICATION.md
 */

export interface DrainageInlet {
  index: number;
  capacityM3PerSec: number;
  blockageRatio: number; // 0.0 (open) to 1.0 (fully blocked)
}

export interface HydraulicGridConfig {
  nx: number;
  ny: number;
  dx: number; // spatial step in meters (dx = dy)
  elevation: Float64Array;
  manningN?: number; // default 0.025
  infiltrationRate?: Float64Array; // m/s infiltration capacity
  drainageInlets?: DrainageInlet[];
  openBoundaryIndices?: number[]; // cell indices that discharge freely out of domain
}

export interface WaterBalanceAccounting {
  initialStorageM3: number;
  currentStorageM3: number;
  cumulativeRainfallM3: number;
  cumulativeInfiltrationM3: number;
  cumulativeDrainageM3: number;
  cumulativeBoundaryOutflowM3: number;
  massBalanceErrorM3: number;
  relativeError: number;
}

export interface SimulationState {
  config: HydraulicGridConfig;
  waterDepth: Float64Array;
  accounting: WaterBalanceAccounting;
  totalTimeSeconds: number;
  lastMaxVelocity: number;
}

export interface StepOptions {
  dtMacroSeconds: number; // Duration of macro step (e.g. 1.0 or 2.0 s)
  rainfallRateMmPerHour: number; // Uniform or spatially-averaged rainfall
}

/**
 * Creates an initialized hydraulic simulation state.
 */
export function createHydraulicState(
  config: HydraulicGridConfig,
  initialDepth?: Float64Array
): SimulationState {
  const numCells = config.nx * config.ny;
  if (config.elevation.length !== numCells) {
    throw new Error(`Elevation array length (${config.elevation.length}) must match nx * ny (${numCells})`);
  }

  const waterDepth = new Float64Array(numCells);
  if (initialDepth) {
    if (initialDepth.length !== numCells) {
      throw new Error(`Initial depth array length must match nx * ny (${numCells})`);
    }
    for (let i = 0; i < numCells; i++) {
      if (initialDepth[i] < 0) throw new Error(`Negative initial depth at cell ${i}`);
      waterDepth[i] = initialDepth[i];
    }
  }

  const cellArea = config.dx * config.dx;
  let initialStorageM3 = 0;
  for (let i = 0; i < numCells; i++) {
    initialStorageM3 += waterDepth[i] * cellArea;
  }

  return {
    config: {
      ...config,
      manningN: config.manningN ?? 0.025,
      infiltrationRate: config.infiltrationRate ?? new Float64Array(numCells),
      drainageInlets: config.drainageInlets ?? [],
      openBoundaryIndices: config.openBoundaryIndices ?? [],
    },
    waterDepth,
    accounting: {
      initialStorageM3,
      currentStorageM3: initialStorageM3,
      cumulativeRainfallM3: 0,
      cumulativeInfiltrationM3: 0,
      cumulativeDrainageM3: 0,
      cumulativeBoundaryOutflowM3: 0,
      massBalanceErrorM3: 0,
      relativeError: 0,
    },
    totalTimeSeconds: 0,
    lastMaxVelocity: 0,
  };
}

/**
 * Advances the simulation by dtMacroSeconds using adaptive sub-stepping.
 * Guarantees mass conservation and strictly non-negative water depth.
 */
export function stepHydraulics(
  state: SimulationState,
  options: StepOptions
): SimulationState {
  const { config, waterDepth, accounting } = state;
  const { nx, ny, dx } = config;
  const numCells = nx * ny;
  const cellArea = dx * dx;
  const manningN = config.manningN || 0.025;
  const slopeEpsilon = 1e-4;
  const depthEpsilon = 1e-5; // minimum depth for flow conveyance (0.01 mm)

  // Copy depth array for pure functional update
  const h = new Float64Array(waterDepth);
  const z = config.elevation;

  // Staggered face flux arrays
  // Horizontal X-faces: (nx - 1) * ny
  // Vertical Y-faces: nx * (ny - 1)
  const numXFaces = (nx - 1) * ny;
  const numYFaces = nx * (ny - 1);
  const Qx = new Float64Array(numXFaces);
  const Qy = new Float64Array(numYFaces);

  // Cell outflow demand accumulator
  const cellOutflowDemand = new Float64Array(numCells);

  // Set of open boundary indices for quick lookup
  const openBoundariesSet = new Set(config.openBoundaryIndices || []);

  // Drainage inlet lookup
  const drainageMap = new Map<number, DrainageInlet>();
  for (const d of config.drainageInlets || []) {
    drainageMap.set(d.index, d);
  }

  let dtRemaining = options.dtMacroSeconds;
  let cumRain = accounting.cumulativeRainfallM3;
  let cumInfil = accounting.cumulativeInfiltrationM3;
  let cumDrain = accounting.cumulativeDrainageM3;
  let cumOutfall = accounting.cumulativeBoundaryOutflowM3;
  let maxObservedVelocity = 0;

  // Adaptive sub-stepping loop
  while (dtRemaining > 1e-6) {
    // 1. Calculate maximum stable substep (Parabolic diffusion + Advective CFL limit)
    let maxDiffusionCoeff = 1e-6;
    let maxDepth = 0;

    for (let c = 0; c < numCells; c++) {
      const depth = h[c];
      if (depth > maxDepth) maxDepth = depth;
    }

    // Estimate diffusion coefficient from max depth
    if (maxDepth > depthEpsilon) {
      // D_max approximation assuming moderate slope ~0.005
      const hFlowMax = maxDepth;
      maxDiffusionCoeff = (1 / manningN) * Math.pow(hFlowMax, 5 / 3) / Math.sqrt(0.005 + slopeEpsilon);
    }

    const dtDiffusive = (0.5 * cellArea) / (4 * maxDiffusionCoeff);
    const waveSpeed = Math.sqrt(9.81 * Math.max(0.01, maxDepth));
    const dtAdvective = (0.5 * dx) / (waveSpeed + 1.0);

    // Limit maximum sub-step to 0.5s for precision
    let dtSub = Math.min(dtRemaining, 0.5, dtDiffusive, dtAdvective);
    if (dtSub < 0.05) dtSub = 0.05; // Floor to prevent infinite stalls

    // 2. Rainfall input (m3/s converted into cell addition)
    const rainIntensityMPerSec = options.rainfallRateMmPerHour / (3.6e6);
    if (rainIntensityMPerSec > 0) {
      const rainVolPerCell = rainIntensityMPerSec * cellArea * dtSub;
      for (let c = 0; c < numCells; c++) {
        h[c] += rainVolPerCell / cellArea;
      }
      cumRain += rainVolPerCell * numCells;
    }

    // 3. Clear face fluxes and cell demands
    Qx.fill(0);
    Qy.fill(0);
    cellOutflowDemand.fill(0);

    // 4. Pass 1: Compute unconstrained fluxes across Horizontal X-Faces
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const c1 = j * nx + i;
        const c2 = c1 + 1;
        const faceIdx = j * (nx - 1) + i;

        const h1 = h[c1];
        const h2 = h[c2];
        const eta1 = z[c1] + h1;
        const eta2 = z[c2] + h2;

        const deltaEta = eta1 - eta2;
        if (Math.abs(deltaEta) > 1e-6) {
          // Flow conveyed across the higher ground threshold
          const flowThreshold = Math.max(z[c1], z[c2]);
          const flowHead = Math.max(eta1, eta2);
          const hFlow = Math.max(0, flowHead - flowThreshold);

          if (hFlow > depthEpsilon) {
            const slope = Math.abs(deltaEta) / dx;
            const velocity = (1 / manningN) * Math.pow(hFlow, 2 / 3) * Math.sqrt(slope);
            if (velocity > maxObservedVelocity) maxObservedVelocity = velocity;

            // Q = velocity * area = velocity * (dx * hFlow)
            const qMagnitude = velocity * dx * hFlow;

            if (deltaEta > 0) {
              // Flow from c1 -> c2 (+x)
              Qx[faceIdx] = qMagnitude;
              cellOutflowDemand[c1] += qMagnitude * dtSub;
            } else {
              // Flow from c2 -> c1 (-x)
              Qx[faceIdx] = -qMagnitude;
              cellOutflowDemand[c2] += qMagnitude * dtSub;
            }
          }
        }
      }
    }

    // 5. Pass 1: Compute unconstrained fluxes across Vertical Y-Faces
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx; i++) {
        const c1 = j * nx + i;
        const c2 = c1 + nx;
        const faceIdx = j * nx + i;

        const h1 = h[c1];
        const h2 = h[c2];
        const eta1 = z[c1] + h1;
        const eta2 = z[c2] + h2;

        const deltaEta = eta1 - eta2;
        if (Math.abs(deltaEta) > 1e-6) {
          const flowThreshold = Math.max(z[c1], z[c2]);
          const flowHead = Math.max(eta1, eta2);
          const hFlow = Math.max(0, flowHead - flowThreshold);

          if (hFlow > depthEpsilon) {
            const slope = Math.abs(deltaEta) / dx;
            const velocity = (1 / manningN) * Math.pow(hFlow, 2 / 3) * Math.sqrt(slope);
            if (velocity > maxObservedVelocity) maxObservedVelocity = velocity;

            const qMagnitude = velocity * dx * hFlow;

            if (deltaEta > 0) {
              // Flow from c1 -> c2 (+y)
              Qy[faceIdx] = qMagnitude;
              cellOutflowDemand[c1] += qMagnitude * dtSub;
            } else {
              // Flow from c2 -> c1 (-y)
              Qy[faceIdx] = -qMagnitude;
              cellOutflowDemand[c2] += qMagnitude * dtSub;
            }
          }
        }
      }
    }

    // 6. Pass 2: Calculate donor cell limiting factor (strictly guarantees h >= 0)
    // Scale factor alpha in [0, 1]
    const alpha = new Float64Array(numCells);
    for (let c = 0; c < numCells; c++) {
      const availableVol = h[c] * cellArea;
      const demand = cellOutflowDemand[c];
      if (demand > availableVol && demand > 0) {
        alpha[c] = availableVol / demand;
      } else {
        alpha[c] = 1.0;
      }
    }

    // 7. Pass 3 & 4: Apply limited fluxes symmetrically to adjacent cells
    // Horizontal transfers
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const faceIdx = j * (nx - 1) + i;
        const qRaw = Qx[faceIdx];
        if (qRaw !== 0) {
          const c1 = j * nx + i;
          const c2 = c1 + 1;

          // Donor is the cell releasing water
          const donorAlpha = qRaw > 0 ? alpha[c1] : alpha[c2];
          const qActual = qRaw * donorAlpha;
          const volTransfer = qActual * dtSub;

          h[c1] -= volTransfer / cellArea;
          h[c2] += volTransfer / cellArea;
        }
      }
    }

    // Vertical transfers
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx; i++) {
        const faceIdx = j * nx + i;
        const qRaw = Qy[faceIdx];
        if (qRaw !== 0) {
          const c1 = j * nx + i;
          const c2 = c1 + nx;

          const donorAlpha = qRaw > 0 ? alpha[c1] : alpha[c2];
          const qActual = qRaw * donorAlpha;
          const volTransfer = qActual * dtSub;

          h[c1] -= volTransfer / cellArea;
          h[c2] += volTransfer / cellArea;
        }
      }
    }

    // 8. Drainage inlets removal
    if (drainageMap.size > 0) {
      for (const [cellIdx, inlet] of drainageMap.entries()) {
        const cellVol = h[cellIdx] * cellArea;
        if (cellVol > 0 && inlet.blockageRatio < 1.0) {
          const effectiveCap = inlet.capacityM3PerSec * (1.0 - inlet.blockageRatio);
          const maxDrainVol = effectiveCap * dtSub;
          const drainVol = Math.min(cellVol, maxDrainVol);

          h[cellIdx] -= drainVol / cellArea;
          cumDrain += drainVol;
        }
      }
    }

    // 9. Infiltration removal
    const infilRate = config.infiltrationRate;
    if (infilRate) {
      for (let c = 0; c < numCells; c++) {
        const rateMPerSec = infilRate[c];
        if (rateMPerSec > 0 && h[c] > 0) {
          const potentialVol = rateMPerSec * cellArea * dtSub;
          const cellVol = h[c] * cellArea;
          const infilVol = Math.min(cellVol, potentialVol);

          h[c] -= infilVol / cellArea;
          cumInfil += infilVol;
        }
      }
    }

    // 10. Open Boundary discharges
    if (openBoundariesSet.size > 0) {
      for (const c of openBoundariesSet) {
        if (h[c] > depthEpsilon) {
          // Free weir-type discharge over boundary
          const slopeOut = 0.01;
          const vOut = (1 / manningN) * Math.pow(h[c], 2 / 3) * Math.sqrt(slopeOut);
          const qOut = vOut * dx * h[c];
          const maxOutVol = h[c] * cellArea;
          const outVol = Math.min(maxOutVol, qOut * dtSub);

          h[c] -= outVol / cellArea;
          cumOutfall += outVol;
        }
      }
    }

    // Sanity assertion: Ensure no cell has negative depth
    for (let c = 0; c < numCells; c++) {
      if (h[c] < 0) {
        if (h[c] > -1e-12) {
          h[c] = 0; // Floating point rounding clean-up
        } else {
          throw new Error(`Numerical error: Negative depth ${h[c]} at cell ${c}`);
        }
      }
    }

    dtRemaining -= dtSub;
  }

  // 11. Compute final storage & rigorous water balance error
  let currentStorageM3 = 0;
  for (let c = 0; c < numCells; c++) {
    currentStorageM3 += h[c] * cellArea;
  }

  const expectedStorageM3 =
    accounting.initialStorageM3 + cumRain - cumInfil - cumDrain - cumOutfall;

  const massBalanceErrorM3 = Math.abs(currentStorageM3 - expectedStorageM3);
  const totalWaterProcessed = Math.max(1.0, accounting.initialStorageM3, cumRain);
  const relativeError = massBalanceErrorM3 / totalWaterProcessed;

  return {
    config,
    waterDepth: h,
    accounting: {
      initialStorageM3: accounting.initialStorageM3,
      currentStorageM3,
      cumulativeRainfallM3: cumRain,
      cumulativeInfiltrationM3: cumInfil,
      cumulativeDrainageM3: cumDrain,
      cumulativeBoundaryOutflowM3: cumOutfall,
      massBalanceErrorM3,
      relativeError,
    },
    totalTimeSeconds: state.totalTimeSeconds + options.dtMacroSeconds,
    lastMaxVelocity: maxObservedVelocity,
  };
}

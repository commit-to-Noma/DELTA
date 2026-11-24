/**
 * DELTA Catchment Dataset Loader & Spatial Transformer
 * Bridges packaged geographic datasets (USGS 3DEP + OpenStreetMap)
 * with the 2D Mass-Conserving Hydraulic Simulation Engine.
 */

import bostonCatchmentRaw from './bostonLongwoodCatchment.json';
import type { HydraulicGridConfig, DrainageInlet } from '../simulation/hydraulicSolver.ts';

export interface GeographicBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface GridMetadata {
  nx: number;
  ny: number;
  dx: number;
  dy: number;
  cellAreaM2: number;
  totalAreaKm2: number;
  orientation: string;
}

export interface SpatialReference {
  projectedCRS: string;
  alternativeCRS: string;
  geographicCRS: string;
  verticalDatum: string;
}

export interface ElevationStatistics {
  minElevationM: number;
  maxElevationM: number;
  meanElevationM: number;
  sourceResolutionM: number;
  resamplingMethod: string;
}

export interface CatchmentMetadata {
  grid: GridMetadata;
  spatialReference: SpatialReference;
  geographicBounds: GeographicBounds;
  elevationStatistics: ElevationStatistics;
}

export interface CriticalFacility {
  facilityId: string;
  name: string;
  osmId: number;
  osmType: 'way' | 'relation' | 'node';
  category: string;
  operator: string;
  emergency: boolean;
  location: {
    lat: number;
    lon: number;
  };
  gridCell: [number, number]; // [row, col]
  accessArteries: string[];
  isMeasuredLocation: boolean;
}

export interface RoadSegment {
  osmId: number;
  name: string;
  highwayType: string;
  gridCells: [number, number][]; // Array of [row, col]
  criticalAccessTarget: string | null;
  elevationProfileM: number[];
  isRealGeometry: boolean;
}

export interface ModelledDrainageInlet {
  inletId: string;
  name: string;
  location: {
    lat: number;
    lon: number;
  };
  gridCell: [number, number]; // [row, col]
  gridIndex: number;
  designCapacityM3PerSec: number;
  defaultBlockageRatio: number;
  isModelledAssumption: boolean;
  modellingRationale: string;
}

export interface StormEvent {
  id: string;
  returnPeriodYears: number;
  durationHours: number;
  totalDepthMm: number;
  peakIntensityMmPerHour: number;
  hyetograph6Hours: number[];
}

export interface RainfallProfile {
  source: string;
  isEvidenceBasedHydrograph: boolean;
  stormEvents: StormEvent[];
}

export interface BostonCatchmentDataset {
  datasetVersion: string;
  catchmentId: string;
  catchmentName: string;
  description: string;
  creationDate: string;
  license: {
    topography: string;
    infrastructure: string;
    syntheticAssumptions: string;
  };
  attribution: {
    topography: string;
    infrastructure: string;
    meteorology: string;
  };
  metadata: CatchmentMetadata;
  elevationMatrix: number[][];
  criticalFacilities: CriticalFacility[];
  criticalRoads: RoadSegment[];
  modelledDrainageInlets: ModelledDrainageInlet[];
  rainfallProfiles: RainfallProfile;
}

/**
 * Loads the packaged Boston Longwood Medical Area & Muddy River catchment dataset.
 */
export function loadBostonCatchment(): BostonCatchmentDataset {
  return bostonCatchmentRaw as unknown as BostonCatchmentDataset;
}

export interface CatchmentToGridOptions {
  manningN?: number; // Manning's roughness coefficient (default: 0.025)
  defaultInfiltrationMmPerHour?: number; // Infiltration rate in mm/h (default: 5.0 mm/h for urban mixed soils)
  openBoundaries?: 'muddy_river_outlet' | 'all_perimeter' | 'none'; // Default: 'muddy_river_outlet'
}

/**
 * Converts a CatchmentDataset into a HydraulicGridConfig ready for the hydraulic solver.
 */
export function createHydraulicConfigFromCatchment(
  dataset: BostonCatchmentDataset = loadBostonCatchment(),
  options: CatchmentToGridOptions = {}
): HydraulicGridConfig {
  const { nx, ny, dx } = dataset.metadata.grid;
  const numCells = nx * ny;
  const elevation = new Float64Array(numCells);

  // Flatten the 64x64 row-major elevation matrix
  for (let r = 0; r < ny; r++) {
    const row = dataset.elevationMatrix[r];
    if (!row || row.length !== nx) {
      throw new Error(`Elevation matrix row ${r} has invalid length; expected ${nx}`);
    }
    for (let c = 0; c < nx; c++) {
      elevation[r * nx + c] = row[c];
    }
  }

  // Map modelled drainage inlets into solver DrainageInlet format
  const drainageInlets: DrainageInlet[] = dataset.modelledDrainageInlets.map((inlet) => ({
    index: inlet.gridCell[0] * nx + inlet.gridCell[1],
    capacityM3PerSec: inlet.designCapacityM3PerSec,
    blockageRatio: inlet.defaultBlockageRatio,
  }));

  // Setup open boundary conditions
  const openBoundaryIndices: number[] = [];
  const boundaryType = options.openBoundaries ?? 'muddy_river_outlet';

  if (boundaryType === 'muddy_river_outlet') {
    // Muddy River flows northward out of the computational domain towards Charles River
    // Cells along the northern boundary (row 0) between cols 40 and 48 form the natural drainage outlet
    for (let c = 40; c <= 48; c++) {
      openBoundaryIndices.push(0 * nx + c);
    }
  } else if (boundaryType === 'all_perimeter') {
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        if (r === 0 || r === ny - 1 || c === 0 || c === nx - 1) {
          openBoundaryIndices.push(r * nx + c);
        }
      }
    }
  }

  // Setup infiltration capacity array (m/s)
  let infiltrationRate: Float64Array | undefined;
  if (options.defaultInfiltrationMmPerHour !== undefined && options.defaultInfiltrationMmPerHour > 0) {
    infiltrationRate = new Float64Array(numCells);
    const rateMPerSec = (options.defaultInfiltrationMmPerHour / 1000) / 3600;
    infiltrationRate.fill(rateMPerSec);
  }

  return {
    nx,
    ny,
    dx,
    elevation,
    manningN: options.manningN ?? 0.025,
    drainageInlets,
    openBoundaryIndices: openBoundaryIndices.length > 0 ? openBoundaryIndices : undefined,
    infiltrationRate,
  };
}

/**
 * Transforms latitude and longitude to grid cell indices [row, col].
 * Row 0 is North (latitude max); Col 0 is West (longitude min).
 */
export function latLonToGrid(
  lat: number,
  lon: number,
  bounds: GeographicBounds = loadBostonCatchment().metadata.geographicBounds,
  nx: number = 64,
  ny: number = 64
): { row: number; col: number; cellIndex: number } {
  const rowFrac = (bounds.north - lat) / (bounds.north - bounds.south);
  const colFrac = (lon - bounds.west) / (bounds.east - bounds.west);

  const row = Math.min(ny - 1, Math.max(0, Math.floor(rowFrac * ny)));
  const col = Math.min(nx - 1, Math.max(0, Math.floor(colFrac * nx)));
  const cellIndex = row * nx + col;

  return { row, col, cellIndex };
}

/**
 * Transforms grid cell indices [row, col] to center latitude and longitude coordinates.
 */
export function gridToLatLon(
  row: number,
  col: number,
  bounds: GeographicBounds = loadBostonCatchment().metadata.geographicBounds,
  nx: number = 64,
  ny: number = 64
): { lat: number; lon: number } {
  const dLat = (bounds.north - bounds.south) / ny;
  const dLon = (bounds.east - bounds.west) / nx;

  const lat = bounds.north - (row + 0.5) * dLat;
  const lon = bounds.west + (col + 0.5) * dLon;

  return { lat, lon };
}

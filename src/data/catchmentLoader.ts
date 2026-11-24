/**
 * DELTA Catchment Dataset Loader & Spatial Transformer
 * Bridges packaged geographic datasets (USGS 3DEP + OpenStreetMap)
 * with the 2D Mass-Conserving Hydraulic Simulation Engine.
 * 
 * Strictly referenced to EPSG:26986 (NAD83 / Massachusetts Mainland)
 * with a genuine 1600m x 1600m computational domain at 25.0m square cells.
 */

import bostonCatchmentRaw from './bostonLongwoodCatchment.json';
import type { HydraulicGridConfig, DrainageInlet } from '../simulation/hydraulicSolver.ts';

export interface ProjectedBounds {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  widthM: number;
  heightM: number;
}

export interface GeographicCorners {
  northWest: { lat: number; lon: number };
  northEast: { lat: number; lon: number };
  southWest: { lat: number; lon: number };
  southEast: { lat: number; lon: number };
}

export interface GeographicBoundingEnvelope {
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
  authoritativeProjectedCRS: string;
  alternativeProjectedCRS: string;
  geographicCRS: string;
  verticalDatum: string;
  projectionType: string;
  projectedBounds: ProjectedBounds;
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
  derivedGeographicCorners: GeographicCorners;
  geographicBoundingEnvelope: GeographicBoundingEnvelope;
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
    projectedX: number;
    projectedY: number;
  };
  gridCell: [number, number]; // [row, col]
  accessArteries: string[];
  isMeasuredLocation: boolean;
}

export interface RoadSegment {
  roadId: string;
  osmId: number;
  name: string;
  highwayType: string;
  coordinates: { lat: number; lon: number }[];
  projectedCoordinates: { x: number; y: number }[];
  gridCells: [number, number][]; // Array of [row, col]
  elevationProfileM: number[];
  averageElevationM: number;
  criticalForHospitalAccess: boolean;
  isSourcedFeature: boolean;
}

export interface ModelledDrainageInlet {
  inletId: string;
  name: string;
  location: {
    lat: number;
    lon: number;
    projectedX: number;
    projectedY: number;
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
  annualExceedanceProbability: number;
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

// -------------------------------------------------------------
// EPSG:26986 (NAD83 / Massachusetts Mainland) Projection Engine
// Standard Lambert Conformal Conic (2SP) with GRS80 Ellipsoid
// -------------------------------------------------------------
const A_ELLIPSOID = 6378137.0;
const F_FLATTENING = 1.0 / 298.257222101;
const E2 = 2 * F_FLATTENING - F_FLATTENING * F_FLATTENING;
const E_ECCENTRICITY = Math.sqrt(E2);

const PHI1 = (41.0 + 43.0 / 60.0) * (Math.PI / 180); // 41° 43' N
const PHI2 = (42.0 + 41.0 / 60.0) * (Math.PI / 180); // 42° 41' N
const PHI0 = 41.0 * (Math.PI / 180);                 // 41° 00' N
const LAMBDA0 = -71.5 * (Math.PI / 180);             // -71° 30' W
const E0_CONST = 200000.0;                           // False Easting (m)
const N0_CONST = 750000.0;                           // False Northing (m)

function mFn(phi: number): number {
  const sinPhi = Math.sin(phi);
  return Math.cos(phi) / Math.sqrt(1 - E2 * sinPhi * sinPhi);
}

function tFn(phi: number): number {
  const sinPhi = Math.sin(phi);
  return (
    Math.tan(Math.PI / 4 - phi / 2) /
    Math.pow((1 - E_ECCENTRICITY * sinPhi) / (1 + E_ECCENTRICITY * sinPhi), E_ECCENTRICITY / 2)
  );
}

const M1 = mFn(PHI1);
const M2 = mFn(PHI2);
const T1 = tFn(PHI1);
const T2 = tFn(PHI2);
const T0 = tFn(PHI0);

const N_LCC = (Math.log(M1) - Math.log(M2)) / (Math.log(T1) - Math.log(T2));
const F_LCC = M1 / (N_LCC * Math.pow(T1, N_LCC));
const RHO0 = A_ELLIPSOID * F_LCC * Math.pow(T0, N_LCC);

/**
 * Forward projects WGS 84 (lat, lon) in degrees to EPSG:26986 projected planar coordinates (X, Y) in meters.
 */
export function latLonToProjected(lat: number, lon: number): { x: number; y: number } {
  const phi = lat * (Math.PI / 180);
  const lam = lon * (Math.PI / 180);
  const t = tFn(phi);
  const rho = A_ELLIPSOID * F_LCC * Math.pow(t, N_LCC);
  const theta = N_LCC * (lam - LAMBDA0);
  const x = E0_CONST + rho * Math.sin(theta);
  const y = N0_CONST + RHO0 - rho * Math.cos(theta);
  return { x, y };
}

/**
 * Inverse projects EPSG:26986 planar coordinates (X, Y) in meters to WGS 84 (lat, lon) in degrees.
 */
export function projectedToLatLon(x: number, y: number): { lat: number; lon: number } {
  const xAdj = x - E0_CONST;
  const yAdj = RHO0 - (y - N0_CONST);
  const rho = (N_LCC >= 0 ? 1 : -1) * Math.hypot(xAdj, yAdj);
  const theta = Math.atan2(xAdj, yAdj);
  const t = Math.pow(rho / (A_ELLIPSOID * F_LCC), 1.0 / N_LCC);
  const lam = LAMBDA0 + theta / N_LCC;

  let phi = Math.PI / 2 - 2 * Math.atan(t);
  for (let i = 0; i < 5; i++) {
    const sinPhi = Math.sin(phi);
    phi =
      Math.PI / 2 -
      2 * Math.atan(t * Math.pow((1 - E_ECCENTRICITY * sinPhi) / (1 + E_ECCENTRICITY * sinPhi), E_ECCENTRICITY / 2));
  }

  return {
    lat: phi * (180 / Math.PI),
    lon: lam * (180 / Math.PI),
  };
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
    // In projected EPSG:26986 coordinates, the Muddy River channel crosses
    // the northern boundary (row 0) between columns 38 and 46 towards Charles River Basin
    for (let c = 38; c <= 46; c++) {
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
 * Transforms projected planar coordinates (X, Y) in meters to grid cell indices [row, col].
 * Row 0 is North (ymax); Col 0 is West (xmin).
 */
export function projectedToGrid(
  x: number,
  y: number,
  bounds: ProjectedBounds = loadBostonCatchment().metadata.spatialReference.projectedBounds,
  nx: number = 64,
  ny: number = 64
): { row: number; col: number; cellIndex: number } {
  const dx = (bounds.xmax - bounds.xmin) / nx;
  const dy = (bounds.ymax - bounds.ymin) / ny;

  const row = Math.min(ny - 1, Math.max(0, Math.floor((bounds.ymax - y) / dy)));
  const col = Math.min(nx - 1, Math.max(0, Math.floor((x - bounds.xmin) / dx)));
  const cellIndex = row * nx + col;

  return { row, col, cellIndex };
}

/**
 * Transforms grid cell indices [row, col] to center projected coordinates (X, Y) in meters.
 */
export function gridToProjected(
  row: number,
  col: number,
  bounds: ProjectedBounds = loadBostonCatchment().metadata.spatialReference.projectedBounds,
  nx: number = 64,
  ny: number = 64
): { x: number; y: number } {
  const dx = (bounds.xmax - bounds.xmin) / nx;
  const dy = (bounds.ymax - bounds.ymin) / ny;

  const x = bounds.xmin + (col + 0.5) * dx;
  const y = bounds.ymax - (row + 0.5) * dy;

  return { x, y };
}

/**
 * Transforms geographic latitude and longitude to grid cell indices [row, col]
 * using the conformal Lambert projection.
 */
export function latLonToGrid(
  lat: number,
  lon: number,
  bounds?: ProjectedBounds,
  nx: number = 64,
  ny: number = 64
): { row: number; col: number; cellIndex: number } {
  const { x, y } = latLonToProjected(lat, lon);
  return projectedToGrid(x, y, bounds, nx, ny);
}

/**
 * Transforms grid cell indices [row, col] to center latitude and longitude coordinates
 * using the conformal inverse Lambert projection.
 */
export function gridToLatLon(
  row: number,
  col: number,
  bounds?: ProjectedBounds,
  nx: number = 64,
  ny: number = 64
): { lat: number; lon: number } {
  const { x, y } = gridToProjected(row, col, bounds, nx, ny);
  return projectedToLatLon(x, y);
}

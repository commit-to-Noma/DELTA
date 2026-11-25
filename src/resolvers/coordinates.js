/**
 * DELTA Coordinate & Geospatial Projection Engine
 * 
 * Strictly referenced to EPSG:26986 (NAD83 / Massachusetts Mainland)
 * with a genuine 1,600m x 1,600m computational domain at 25.0m square cells.
 * 
 * Provides forward/inverse Lambert Conformal Conic (2SP) projections,
 * boundary validation, and authoritative intervention location resolution.
 */

import { DERIVED_PLAN_ALPHA_LOCATION } from '../data/interventionSites.js';

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

function mFn(phi) {
  const sinPhi = Math.sin(phi);
  return Math.cos(phi) / Math.sqrt(1 - E2 * sinPhi * sinPhi);
}

function tFn(phi) {
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
 * Authoritative computational domain bounds in EPSG:26986 (NAD83 / Mass Mainland)
 */
export const CATCHMENT_BOUNDS = {
  xmin: 231650.0,
  xmax: 233250.0,
  ymin: 897900.0,
  ymax: 899500.0,
  widthM: 1600.0,
  heightM: 1600.0,
  nx: 64,
  ny: 64,
  dx: 25.0,
  dy: 25.0
};

/**
 * Authoritative geographic envelope (WGS84) derived from the projected bounds.
 */
export const GEOGRAPHIC_ENVELOPE = {
  south: 42.330883,
  north: 42.345354,
  west: -71.115978,
  east: -71.096473
};

/**
 * Authoritative locations of physical infrastructure and intervention staging sites.
 * Explicitly grounded in surveyed culverts and road segment features (never building centroids).
 */
export const AUTHORITATIVE_INTERVENTION_LOCATIONS = {
  // Plan Beta: Muddy River / Brookline Ave culvert clearing and mobile pumping
  'plan-beta': {
    siteId: 'CULVERT-01-BROOKLINE',
    name: 'Brookline Avenue Muddy River Culvert Inflow',
    facilityCategory: 'Hydraulic Culvert Headwall & Conduit Intake',
    projected: { x: 232302.11, y: 899074.88 },
    wgs84: { lat: 42.34150, lon: -71.10800 },
    gridCell: [17, 26],
    featureType: 'culvert_inlet',
    featureId: 'CULVERT-01-BROOKLINE',
    accessCorridor: 'Longwood Ave → Brookline Ave South (Francis St ambulance approach clear)'
  },
  // Plan Alpha: Rapid deployable barrier along Francis Street roadway protecting BWH ambulance access
  // Derived from intermediate centerline vertex (Node 1) of OSM road feature ROAD-1377084984 (Francis St secondary corridor fronting emergency bay)
  'plan-alpha': DERIVED_PLAN_ALPHA_LOCATION,
  // Plan Gamma / Choke: Fenway Emerald Necklace restriction point
  'plan-gamma': {
    siteId: 'CULVERT-02-FENWAY-CHOKE',
    name: 'Fenway Emerald Necklace Choke Point',
    facilityCategory: 'Parkland Overland Restriction & Weir',
    projected: { x: 232713.09, y: 899298.94 },
    wgs84: { lat: 42.34350, lon: -71.10300 },
    gridCell: [8, 42],
    featureType: 'culvert_inlet',
    featureId: 'CULVERT-02-FENWAY-CHOKE',
    accessCorridor: 'Park Drive → Agassiz Road Staging Area'
  }
};

/**
 * Forward projects WGS84 (lat, lon) in decimal degrees to EPSG:26986 planar coordinates (X, Y) in meters.
 */
export function latLonToProjected(lat, lon) {
  const phi = lat * (Math.PI / 180);
  const lam = lon * (Math.PI / 180);
  const t = tFn(phi);
  const rho = A_ELLIPSOID * F_LCC * Math.pow(t, N_LCC);
  const theta = N_LCC * (lam - LAMBDA0);
  const x = E0_CONST + rho * Math.sin(theta);
  const y = N0_CONST + RHO0 - rho * Math.cos(theta);
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
}

/**
 * Inverse projects EPSG:26986 planar coordinates (X, Y) in meters to WGS84 (lat, lon) in decimal degrees.
 */
export function projectedToLatLon(x, y) {
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
    lat: Number((phi * (180 / Math.PI)).toFixed(6)),
    lon: Number((lam * (180 / Math.PI)).toFixed(6))
  };
}

/**
 * Maps planar projected coordinates (X, Y) to 64x64 grid cell indices [row, col].
 * Row 0 is North (ymax); Col 0 is West (xmin).
 */
export function projectedToGridCell(x, y) {
  const dx = CATCHMENT_BOUNDS.dx;
  const dy = CATCHMENT_BOUNDS.dy;
  const col = Math.floor((x - CATCHMENT_BOUNDS.xmin) / dx);
  const row = Math.floor((CATCHMENT_BOUNDS.ymax - y) / dy);
  return [row, col];
}

/**
 * Checks whether projected coordinates (X, Y) fall within the 1,600m x 1,600m domain.
 */
export function isInsideProjectedBounds(x, y) {
  return (
    x >= CATCHMENT_BOUNDS.xmin &&
    x <= CATCHMENT_BOUNDS.xmax &&
    y >= CATCHMENT_BOUNDS.ymin &&
    y <= CATCHMENT_BOUNDS.ymax
  );
}

/**
 * Checks whether geographic coordinates (lat, lon) fall within the catchment envelope.
 */
export function isInsideGeographicEnvelope(lat, lon) {
  return (
    lat >= GEOGRAPHIC_ENVELOPE.south &&
    lat <= GEOGRAPHIC_ENVELOPE.north &&
    lon >= GEOGRAPHIC_ENVELOPE.west &&
    lon <= GEOGRAPHIC_ENVELOPE.east
  );
}

/**
 * Validates, checks bounds, and reconciles a target location.
 * Ensures mutual consistency between WGS84 and EPSG:26986 coordinates.
 * 
 * Enforces strict 25.0m maximum tolerance (exactly 1 computational grid cell).
 * 
 * @param {object} loc - Candidate location with optional projected and/or wgs84
 * @returns {object} Validated structured location object
 */
export function validateAndReconcileLocation(loc) {
  if (!loc || typeof loc !== 'object') {
    const err = new Error('Invalid location: targetLocation must be a non-null object.');
    err.code = 'INVALID_LOCATION';
    throw err;
  }

  let x = loc.projected?.x ?? loc.epsg26986?.x ?? loc.x;
  let y = loc.projected?.y ?? loc.epsg26986?.y ?? loc.y;
  let lat = loc.wgs84?.lat ?? loc.lat;
  let lon = loc.wgs84?.lon ?? loc.lon;

  // Support parsing string coordinates if supplied as strings
  if (typeof x === 'string') x = parseFloat(x.replace(/[^\d.-]/g, ''));
  if (typeof y === 'string') y = parseFloat(y.replace(/[^\d.-]/g, ''));
  if (typeof lat === 'string') lat = parseFloat(lat.replace(/[^\d.-]/g, ''));
  if (typeof lon === 'string') lon = parseFloat(lon.replace(/[^\d.-]/g, ''));

  const hasProjected = typeof x === 'number' && !isNaN(x) && typeof y === 'number' && !isNaN(y);
  const hasGeodetic = typeof lat === 'number' && !isNaN(lat) && typeof lon === 'number' && !isNaN(lon);

  if (!hasProjected && !hasGeodetic) {
    const err = new Error('Invalid location: targetLocation must provide either EPSG:26986 (x, y) or WGS84 (lat, lon) coordinates.');
    err.code = 'MISSING_COORDINATES';
    throw err;
  }

  // If only one system is provided, project/inverse project to obtain the other
  if (hasProjected && !hasGeodetic) {
    const geo = projectedToLatLon(x, y);
    lat = geo.lat;
    lon = geo.lon;
  } else if (!hasProjected && hasGeodetic) {
    const proj = latLonToProjected(lat, lon);
    x = proj.x;
    y = proj.y;
  } else {
    // Both systems provided: assert mutual mathematical consistency
    const expectedProj = latLonToProjected(lat, lon);
    const distanceM = Math.hypot(x - expectedProj.x, y - expectedProj.y);
    const MAX_TOLERANCE_METERS = 25.0; // Strictly 1 grid cell width (25.0m)

    if (distanceM > MAX_TOLERANCE_METERS) {
      const err = new Error(
        `Coordinate inconsistency: Provided EPSG:26986 (X: ${x}, Y: ${y}) differs from projected WGS84 (${lat.toFixed(5)}, ${lon.toFixed(5)} -> X: ${expectedProj.x}, Y: ${expectedProj.y}) by ${distanceM.toFixed(1)}m (max allowed: ${MAX_TOLERANCE_METERS}m).`
      );
      err.code = 'COORDINATE_INCONSISTENCY';
      err.details = { x, y, lat, lon, expectedProj, distanceM };
      throw err;
    }
  }

  // Domain Bounds Enforcement
  if (!isInsideProjectedBounds(x, y)) {
    const err = new Error(
      `Out of bounds coordinates: EPSG:26986 (X: ${x}, Y: ${y}) falls outside the 1,600m x 1,600m Boston Longwood domain [X: ${CATCHMENT_BOUNDS.xmin}-${CATCHMENT_BOUNDS.xmax}, Y: ${CATCHMENT_BOUNDS.ymin}-${CATCHMENT_BOUNDS.ymax}].`
    );
    err.code = 'OUT_OF_BOUNDS_COORDINATES';
    err.details = { x, y, bounds: CATCHMENT_BOUNDS };
    throw err;
  }

  const [row, col] = projectedToGridCell(x, y);

  return {
    name: loc.name || 'Designated Field Intervention Site',
    wgs84: { lat, lon },
    epsg26986: { x, y },
    gridCell: [row, col],
    wgs84Formatted: `${lat.toFixed(5)}° N, ${Math.abs(lon).toFixed(5)}° W`,
    epsg26986Formatted: `Easting: ${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m, Northing: ${y.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`,
    gridCellFormatted: `[Row ${row}, Col ${col}]`,
    accessCorridor: loc.accessCorridor || 'Primary Municipal Artery',
    featureType: loc.featureType || 'custom_location',
    featureId: loc.featureId || undefined,
    provenanceNotice: loc.provenanceNotice || undefined,
    isModelledStagingPoint: loc.isModelledStagingPoint || undefined
  };
}

/**
 * Resolves the designated field dispatch location for an approved intervention plan.
 * Strictly derives coordinates from authoritative dataset features and prevents
 * arbitrary substitution of the Brookline culvert or hospital building centroids.
 * 
 * If a plan location cannot be established from the dataset, fails closed.
 * 
 * @param {object} chosenPlan - The approved plan object from Decision Record
 * @param {object} [orderLocationOverride] - Optional explicit location passed in dispatch order
 */
export function resolveDispatchLocation(chosenPlan, orderLocationOverride = null) {
  // Case A: Explicit location passed in dispatch order
  if (orderLocationOverride && (orderLocationOverride.epsg26986 || orderLocationOverride.wgs84 || orderLocationOverride.x || orderLocationOverride.lat)) {
    return validateAndReconcileLocation(orderLocationOverride);
  }

  // Case B: Derive from chosenPlan definition
  const planId = (chosenPlan?.planId || '').toLowerCase();

  if (AUTHORITATIVE_INTERVENTION_LOCATIONS[planId]) {
    const auth = AUTHORITATIVE_INTERVENTION_LOCATIONS[planId];
    return validateAndReconcileLocation({
      name: auth.name,
      x: auth.projected.x,
      y: auth.projected.y,
      lat: auth.wgs84.lat,
      lon: auth.wgs84.lon,
      accessCorridor: auth.accessCorridor,
      featureType: auth.featureType,
      featureId: auth.featureId,
      provenanceNotice: auth.provenanceNotice,
      isModelledStagingPoint: auth.isModelledStagingPoint
    });
  }

  // Case C: Check if plan contains embedded location
  if (chosenPlan?.targetLocation) {
    return validateAndReconcileLocation(chosenPlan.targetLocation);
  }

  // Fail closed if location cannot be established: DO NOT fall back to Brookline culvert or building centroid!
  const err = new Error(
    `Unresolved intervention location: Intervention plan '${chosenPlan?.planId || 'unknown'}' does not have an authoritative dataset feature location and no valid targetLocation was provided.`
  );
  err.code = 'UNRESOLVED_INTERVENTION_LOCATION';
  throw err;
}

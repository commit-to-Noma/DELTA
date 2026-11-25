/**
 * DELTA Simulation Telemetry Validation & Scenario Integrity Engine
 * 
 * Implements strict schema validation, deterministic canonical scenario hashing,
 * and staleness detection for simulation telemetry persisted to Forge App Storage.
 */

import crypto from 'crypto';

export const MAX_SIMULATION_PAYLOAD_BYTES = 65536; // 64 KB
export const DEFAULT_STALENESS_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Computes a deterministic canonical SHA-256 scenario hash from model parameters.
 * Does NOT trust client-supplied hashes as proof of physical validity.
 */
export function computeCanonicalScenarioHash(inputs = {}) {
  const canonical = {
    cellResolutionM: Number(inputs.cellResolutionM ?? 25.0),
    durationHours: Number(inputs.durationHours ?? 6.0),
    gridDimensions: String(inputs.gridDimensions ?? '64x64'),
    infiltrationRateMmPerHour: Number(inputs.infiltrationRateMmPerHour ?? 2.0),
    manningN: Number(inputs.manningN ?? 0.025),
    sector: String(inputs.sector ?? 'Boston Longwood Medical Area & Muddy River Catchment (EPSG:26986)'),
    stormDepthMm: Number(inputs.stormDepthMm ?? (inputs.stormId === '10-year' ? 78.5 : inputs.stormId === '100-year' ? 122.0 : 104.2)),
    stormId: String(inputs.stormId ?? '50-year')
  };

  const sortedKeys = Object.keys(canonical).sort();
  const canonicalString = JSON.stringify(canonical, sortedKeys);
  const hashHex = crypto.createHash('sha256').update(canonicalString).digest('hex');

  return {
    canonicalScenario: canonical,
    scenarioHash: `sha256:${hashHex}`
  };
}

/**
 * Validates the schema, bounds, and payload limits of a simulation run payload.
 * Rejects malformed, empty, or oversized payloads with structured errors.
 */
export function validateSimulationRunPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const err = new Error('Invalid simulation payload: payload must be a non-null object');
    err.code = 'INVALID_SIMULATION_PAYLOAD';
    throw err;
  }

  // Payload size limit guard
  let jsonString;
  try {
    jsonString = JSON.stringify(payload);
  } catch (_e) {
    const err = new Error('Invalid simulation payload: circular structure cannot be serialized');
    err.code = 'INVALID_SIMULATION_PAYLOAD';
    throw err;
  }

  if (jsonString.length > MAX_SIMULATION_PAYLOAD_BYTES) {
    const err = new Error(`Simulation payload exceeds maximum permitted size of ${MAX_SIMULATION_PAYLOAD_BYTES} bytes (actual: ${jsonString.length} bytes)`);
    err.code = 'PAYLOAD_TOO_LARGE';
    throw err;
  }

  const errors = [];

  // Required sector
  if (typeof payload.sector !== 'string' || payload.sector.trim().length < 3 || payload.sector.length > 250) {
    errors.push('sector must be a string between 3 and 250 characters');
  }

  // Required stormId
  if (typeof payload.stormId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(payload.stormId)) {
    errors.push('stormId must be an alphanumeric string (max 64 chars)');
  }

  // Required stormLabel (defaults if omitted)
  if (payload.stormLabel === undefined || payload.stormLabel === null) {
    payload.stormLabel = `NOAA Atlas 14 ${payload.stormId} Design Event`;
  } else if (typeof payload.stormLabel !== 'string' || payload.stormLabel.trim().length < 1 || payload.stormLabel.length > 250) {
    errors.push('stormLabel must be a non-empty string (max 250 chars)');
  }

  // Numeric time & rates
  if (typeof payload.elapsedSimulationSeconds !== 'number' || !Number.isFinite(payload.elapsedSimulationSeconds) || payload.elapsedSimulationSeconds < 0 || payload.elapsedSimulationSeconds > 86400) {
    errors.push('elapsedSimulationSeconds must be a finite number between 0 and 86,400 (24h)');
  }

  if (payload.cumulativeRainfallMm === undefined || payload.cumulativeRainfallMm === null) {
    payload.cumulativeRainfallMm = 0.0;
  } else if (typeof payload.cumulativeRainfallMm !== 'number' || !Number.isFinite(payload.cumulativeRainfallMm) || payload.cumulativeRainfallMm < 0 || payload.cumulativeRainfallMm > 2000) {
    errors.push('cumulativeRainfallMm must be a finite number between 0 and 2000 mm');
  }

  if (payload.currentRainfallMmPerHour === undefined || payload.currentRainfallMmPerHour === null) {
    payload.currentRainfallMmPerHour = 0.0;
  } else if (typeof payload.currentRainfallMmPerHour !== 'number' || !Number.isFinite(payload.currentRainfallMmPerHour) || payload.currentRainfallMmPerHour < 0 || payload.currentRainfallMmPerHour > 1000) {
    errors.push('currentRainfallMmPerHour must be a finite number between 0 and 1000 mm/h');
  }

  // Physical volumes & depths
  if (typeof payload.totalWaterVolumeM3 !== 'number' || !Number.isFinite(payload.totalWaterVolumeM3) || payload.totalWaterVolumeM3 < 0 || payload.totalWaterVolumeM3 > 1e9) {
    errors.push('totalWaterVolumeM3 must be a non-negative finite volume (max 1e9 m³)');
  }

  if (payload.totalDrainedM3 === undefined || payload.totalDrainedM3 === null) {
    payload.totalDrainedM3 = 0.0;
  } else if (typeof payload.totalDrainedM3 !== 'number' || !Number.isFinite(payload.totalDrainedM3) || payload.totalDrainedM3 < 0 || payload.totalDrainedM3 > 1e9) {
    errors.push('totalDrainedM3 must be a non-negative finite volume (max 1e9 m³)');
  }

  if (payload.currentStorageM3 === undefined || payload.currentStorageM3 === null) {
    payload.currentStorageM3 = Math.max(0, payload.totalWaterVolumeM3 - payload.totalDrainedM3);
  } else if (typeof payload.currentStorageM3 !== 'number' || !Number.isFinite(payload.currentStorageM3) || payload.currentStorageM3 < 0 || payload.currentStorageM3 > 1e9) {
    errors.push('currentStorageM3 must be a non-negative finite volume (max 1e9 m³)');
  }

  if (typeof payload.maxWaterDepthM !== 'number' || !Number.isFinite(payload.maxWaterDepthM) || payload.maxWaterDepthM < 0 || payload.maxWaterDepthM > 50) {
    errors.push('maxWaterDepthM must be a non-negative finite depth between 0 and 50 meters');
  }

  // Impact indices
  if (typeof payload.impassableRoadsCount !== 'number' || !Number.isInteger(payload.impassableRoadsCount) || payload.impassableRoadsCount < 0 || payload.impassableRoadsCount > 5000) {
    errors.push('impassableRoadsCount must be a non-negative integer <= 5000');
  }

  if (!Array.isArray(payload.atRiskFacilities)) {
    errors.push('atRiskFacilities must be an array of facility names');
  } else {
    if (payload.atRiskFacilities.length > 100) {
      errors.push('atRiskFacilities array cannot exceed 100 entries');
    }
    for (let i = 0; i < payload.atRiskFacilities.length; i++) {
      const fac = payload.atRiskFacilities[i];
      if (typeof fac !== 'string' || fac.length > 250) {
        errors.push(`atRiskFacilities[${i}] must be a string <= 250 chars`);
        break;
      }
    }
  }

  if (errors.length > 0) {
    const err = new Error(`Simulation payload validation failed: ${errors.join('; ')}`);
    err.code = 'INVALID_SIMULATION_PAYLOAD';
    err.details = errors;
    throw err;
  }
}

/**
 * Checks whether a stored simulation record has complete structure or is malformed.
 */
export function validateSimulationRecordIntegrity(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return false;
  }
  // Check critical fields that consumers require
  if (
    typeof record.stormId !== 'string' ||
    typeof record.elapsedSimulationSeconds !== 'number' ||
    typeof record.maxWaterDepthM !== 'number' ||
    typeof record.totalWaterVolumeM3 !== 'number' ||
    typeof record.savedAt !== 'string' ||
    !record.scenarioHash
  ) {
    return false;
  }
  return true;
}

/**
 * Evaluates whether a record is older than the staleness threshold.
 */
export function isRecordStale(record, stalenessThresholdMs = DEFAULT_STALENESS_THRESHOLD_MS) {
  if (!record || !record.savedAt) return true;
  const savedTimestamp = Date.parse(record.savedAt);
  if (Number.isNaN(savedTimestamp)) return true;
  return (Date.now() - savedTimestamp) > stalenessThresholdMs;
}

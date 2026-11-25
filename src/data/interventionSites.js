/**
 * DELTA Physical & Modelled Intervention Staging Sites
 * 
 * Provides lightweight feature geometry and provenance metadata for operational
 * intervention locations without bundling the complete 1MB catchment DEM into
 * Forge backend resolver runtimes.
 * 
 * PROVENANCE SPECIFICATION:
 * - Plan Beta (CULVERT-01-BROOKLINE): Surveyed Muddy River culvert intake headwall.
 * - Plan Alpha (ROAD-1377084984): Modelled intervention staging point derived from
 *   the intermediate centerline vertex (Node 1) of OpenStreetMap secondary road way
 *   1377084984 (Francis Street) fronting Brigham and Women's Hospital ambulance bay.
 *   NOTE: This represents a hydrodynamic model deployment corridor; it does NOT
 *   constitute a surveyed or permanent municipal physical barrier foundation.
 */

/**
 * Lightweight feature record for OSM Way 1377084984 extracted from
 * src/data/bostonLongwoodCatchment.json criticalRoads layer.
 */
export const SOURCED_ROAD_FEATURE_1377084984 = {
  roadId: 'ROAD-1377084984',
  osmId: 1377084984,
  name: 'Francis Street',
  highwayType: 'secondary',
  sourceDataset: 'OpenStreetMap (ODbL 1.0)',
  provenanceType: 'MODELLED_STAGING_POINT',
  provenanceNotice: 'Modelled intervention staging point derived from intermediate centerline vertex (Node 1) of OpenStreetMap secondary road way 1377084984. Does not constitute a surveyed physical barrier foundation.',
  coordinates: [
    { lat: 42.3356589, lon: -71.1072063 },
    { lat: 42.3355553, lon: -71.1070424 },
    { lat: 42.3354517, lon: -71.1068785 }
  ],
  projectedCoordinates: [
    { x: 232370.50, y: 898426.38 },
    { x: 232384.06, y: 898414.94 },
    { x: 232397.62, y: 898403.49 }
  ],
  gridCells: [
    [42, 28],
    [43, 29],
    [43, 29]
  ]
};

/**
 * Derives the modelled staging coordinate from intermediate centerline vertex (Node 1)
 * of OSM Way 1377084984.
 */
function deriveRoadMidpoint(roadFeature) {
  // Node 1 represents the intermediate centerline vertex along Francis Street (49.99% of polyline length)
  const vertexIndex = Math.floor(roadFeature.coordinates.length / 2);
  const geo = roadFeature.coordinates[vertexIndex];
  const proj = roadFeature.projectedCoordinates[vertexIndex];
  const cell = roadFeature.gridCells[vertexIndex];

  return {
    siteId: roadFeature.roadId,
    name: `Modelled Staging Point: Francis Street Emergency Barrier Line (OSM Way ${roadFeature.osmId})`,
    facilityCategory: 'Modelled Municipal Roadway Flood Barrier Staging Corridor',
    provenanceNotice: roadFeature.provenanceNotice,
    isModelledStagingPoint: true,
    projected: { x: proj.x, y: proj.y },
    wgs84: { lat: Number(geo.lat.toFixed(5)), lon: Number(geo.lon.toFixed(5)) },
    gridCell: cell,
    featureType: 'road_segment',
    featureId: roadFeature.roadId,
    osmId: roadFeature.osmId,
    accessCorridor: 'Huntington Ave → Francis St / Shattuck St ambulance approach'
  };
}

export const DERIVED_PLAN_ALPHA_LOCATION = deriveRoadMidpoint(SOURCED_ROAD_FEATURE_1377084984);

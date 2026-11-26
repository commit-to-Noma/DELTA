import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type {
  BostonCatchmentDataset,
  CriticalFacility,
  ModelledDrainageInlet,
  RoadSegment,
} from '../../data/catchmentLoader';
import {
  gridToProjected,
  gridToLatLon,
} from '../../data/catchmentLoader';
import type { OperationalWorkOrder } from '../../simulation/workOrderEngine';

export interface HospitalExposureInfo {
  facility: CriticalFacility;
  campusGroundElevationM: number;
  buildingStandingWaterDepthM: number;
  isBuildingDry: boolean;
  perimeterMaxDepthM: number;
  accessRoutes: {
    roadName: string;
    maxDepthM: number;
    status: 'PASSABLE' | 'CAUTION' | 'IMPASSABLE';
  }[];
  overallStatus: 'FULLY_ACCESSIBLE' | 'CAUTION_ACCESS_RESTRICTED' | 'ACCESS_COMPROMISED_ISOLATED';
  summaryText: string;
}

export interface RoadCorridorInfo {
  road: RoadSegment;
  maxDepthM: number;
  averageDepthM: number;
  impassableCellsCount: number;
  cautionCellsCount: number;
  passableCellsCount: number;
  totalCellsCount: number;
  connectedHospitals: string[];
  passability: 'PASSABLE' | 'CAUTION' | 'IMPASSABLE';
}

export interface CellHoverInfo {
  row: number;
  col: number;
  cellIndex: number;
  projectedX: number;
  projectedY: number;
  lat: number;
  lon: number;
  elevationM: number;
  waterDepthM: number;
  waterSurfaceM: number;
  facility?: CriticalFacility;
  roadName?: string;
  drainageInlet?: ModelledDrainageInlet;
  stagedWorkOrder?: OperationalWorkOrder;
  isAdversePondingCell?: boolean;
  adverseDepthDeltaM?: number;
  passabilityStatus: 'DRY_PASSABLE' | 'CAUTION_MINOR_PONDING' | 'CRITICAL_IMPASSABLE';
  depthBand?: number; // 0, 1, 2, 3, 4
  deltaWaterDepthM?: number; // water avoided vs baseline
  hospitalExposure?: HospitalExposureInfo;
  roadCorridor?: RoadCorridorInfo;
}

export interface CanvasLayerVisibility {
  satellite: boolean;
  terrain: boolean;
  contours: boolean;
  water: boolean;
  vectors: boolean;
  roads: boolean;
  facilities: boolean;
  drainage: boolean;
  legend?: boolean;
  workOrders?: boolean;
  adversePonding?: boolean;
}

export interface GeographicSimulationCanvasProps {
  className?: string;
  dataset: BostonCatchmentDataset;
  waterDepth: Float64Array; // length 4096
  baselineWaterDepth?: Float64Array | null; // optional for delta comparison mode
  viewMode?: 'standard' | 'delta'; // 'standard' = actual flood depth, 'delta' = avoided floodwater vs baseline
  activeLayers: CanvasLayerVisibility;
  selectedCell?: { row: number; col: number } | null;
  selectedRoadId?: string | null;
  selectedFacilityId?: string | null;
  stagedWorkOrders?: OperationalWorkOrder[];
  activePlanId?: 'plan-alpha' | 'plan-beta' | 'plan-gamma' | null;
  selectedWorkOrderId?: string | null;
  onCellHover?: (info: CellHoverInfo | null) => void;
  onCellClick?: (info: CellHoverInfo) => void;
  onSelectRoad?: (road: RoadSegment | null) => void;
  onSelectFacility?: (facility: CriticalFacility | null) => void;
  onSelectWorkOrder?: (wo: OperationalWorkOrder | null) => void;
}

export const GeographicSimulationCanvas: React.FC<GeographicSimulationCanvasProps> = ({
  className = '',
  dataset,
  waterDepth,
  baselineWaterDepth = null,
  viewMode = 'standard',
  activeLayers,
  selectedCell,
  selectedRoadId,
  selectedFacilityId,
  stagedWorkOrders = [],
  activePlanId = null,
  selectedWorkOrderId = null,
  onCellHover,
  onCellClick,
  onSelectRoad,
  onSelectFacility,
  onSelectWorkOrder,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [internalHover, setInternalHover] = useState<{ row: number; col: number } | null>(null);
  const [satelliteImage, setSatelliteImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const img = new Image();
    img.src = './usgs_satellite_still.png';
    img.onload = () => {
      if (isMounted) {
        setSatelliteImage(img);
      }
    };
    img.onerror = (e) => {
      console.warn('[DELTA] Satellite imagery still failed to load:', e);
    };
    return () => {
      isMounted = false;
    };
  }, []);

  const { nx, ny } = dataset.metadata.grid;
  const { minElevationM, maxElevationM } = dataset.metadata.elevationStatistics;
  const { xmin, xmax, ymin, ymax } = dataset.metadata.spatialReference.projectedBounds;

  // Pre-index facilities by cell [r, c]
  const facilityCellMap = useMemo(() => {
    const map = new Map<string, CriticalFacility>();
    for (const f of dataset.criticalFacilities) {
      map.set(`${f.gridCell[0]},${f.gridCell[1]}`, f);
    }
    return map;
  }, [dataset.criticalFacilities]);

  // Pre-index drainage inlets by cell [r, c]
  const drainageCellMap = useMemo(() => {
    const map = new Map<string, ModelledDrainageInlet>();
    for (const d of dataset.modelledDrainageInlets) {
      map.set(`${d.gridCell[0]},${d.gridCell[1]}`, d);
    }
    return map;
  }, [dataset.modelledDrainageInlets]);

  // Pre-index road segments by cell [r, c] and map road names
  const roadCellMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of dataset.criticalRoads) {
      for (const [row, col] of r.gridCells) {
        if (!map.has(`${row},${col}`)) {
          map.set(`${row},${col}`, r.name);
        }
      }
    }
    return map;
  }, [dataset.criticalRoads]);

  // Pre-index staged operational work orders by cell [r, c]
  const workOrderCellMap = useMemo(() => {
    const map = new Map<string, OperationalWorkOrder>();
    for (const wo of stagedWorkOrders) {
      const [r, c] = wo.targetLocation.gridCell;
      map.set(`${r},${c}`, wo);
    }
    return map;
  }, [stagedWorkOrders]);

  // Evaluate rich hospital exposure details
  const getHospitalExposure = useCallback(
    (facility: CriticalFacility): HospitalExposureInfo => {
      const [r, c] = facility.gridCell;
      const campusGroundElevationM = dataset.elevationMatrix[r]?.[c] ?? 0;
      const buildingStandingWaterDepthM = waterDepth[r * nx + c] || 0;
      const isBuildingDry = buildingStandingWaterDepthM < 0.05;

      // 8-neighborhood perimeter depth
      let perimeterMaxDepthM = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ny && nc >= 0 && nc < nx) {
            const pd = waterDepth[nr * nx + nc] || 0;
            if (pd > perimeterMaxDepthM) perimeterMaxDepthM = pd;
          }
        }
      }

      // Check each named access artery
      const accessRoutes = facility.accessArteries.map((arteryName) => {
        let maxDepthM = 0;
        for (const road of dataset.criticalRoads) {
          if (
            road.name.toLowerCase().includes(arteryName.toLowerCase()) ||
            arteryName.toLowerCase().includes(road.name.toLowerCase())
          ) {
            for (const [rr, cc] of road.gridCells) {
              const rd = waterDepth[rr * nx + cc] || 0;
              if (rd > maxDepthM) maxDepthM = rd;
            }
          }
        }
        let status: 'PASSABLE' | 'CAUTION' | 'IMPASSABLE' = 'PASSABLE';
        if (maxDepthM >= 0.30) {
          status = 'IMPASSABLE';
        } else if (maxDepthM >= 0.15) {
          status = 'CAUTION';
        }
        return {
          roadName: arteryName,
          maxDepthM: Math.round(maxDepthM * 1000) / 1000,
          status,
        };
      });

      const hasImpassable = accessRoutes.some((a) => a.status === 'IMPASSABLE');
      const hasCaution = accessRoutes.some((a) => a.status === 'CAUTION');

      let overallStatus: HospitalExposureInfo['overallStatus'] = 'FULLY_ACCESSIBLE';
      if (hasImpassable) {
        overallStatus = 'ACCESS_COMPROMISED_ISOLATED';
      } else if (hasCaution || perimeterMaxDepthM >= 0.15) {
        overallStatus = 'CAUTION_ACCESS_RESTRICTED';
      }

      let summaryText = 'Campus ground structurally dry (elev ' + campusGroundElevationM.toFixed(1) + 'm). All screened ingress corridors below 15cm depth threshold (operational vehicular access unverified).';
      if (buildingStandingWaterDepthM >= 0.30) {
        summaryText = `Substantial direct flooding at facility coordinate (${(buildingStandingWaterDepthM * 100).toFixed(1)} cm). High screening risk.`;
      } else if (hasImpassable) {
        const blocked = accessRoutes.filter((a) => a.status === 'IMPASSABLE').map((a) => a.roadName).join(', ');
        summaryText = `Campus ground structurally dry (${(buildingStandingWaterDepthM * 100).toFixed(1)} cm water, elev ${campusGroundElevationM.toFixed(1)}m). Screened access corridor exceeds 30cm depth threshold: ${blocked}. Rerouting indicated (real-world transit unverified).`;
      } else if (hasCaution) {
        summaryText = `Campus ground structurally dry; minor ponding on screened ingress corridors (15-30 cm). Operational screening caution.`;
      }

      return {
        facility,
        campusGroundElevationM: Math.round(campusGroundElevationM * 100) / 100,
        buildingStandingWaterDepthM: Math.round(buildingStandingWaterDepthM * 1000) / 1000,
        isBuildingDry,
        perimeterMaxDepthM: Math.round(perimeterMaxDepthM * 1000) / 1000,
        accessRoutes,
        overallStatus,
        summaryText,
      };
    },
    [dataset.criticalRoads, dataset.elevationMatrix, nx, ny, waterDepth]
  );

  // Evaluate rich road corridor info
  const getRoadCorridorInfo = useCallback(
    (road: RoadSegment): RoadCorridorInfo => {
      let maxDepth = 0;
      let sumDepth = 0;
      let passable = 0;
      let caution = 0;
      let impassable = 0;

      for (const [r, c] of road.gridCells) {
        const d = waterDepth[r * nx + c] || 0;
        if (d > maxDepth) maxDepth = d;
        sumDepth += d;

        if (d >= 0.30) impassable++;
        else if (d >= 0.15) caution++;
        else passable++;
      }

      const total = road.gridCells.length;
      const averageDepthM = total > 0 ? sumDepth / total : 0;

      let passability: RoadCorridorInfo['passability'] = 'PASSABLE';
      if (maxDepth >= 0.30) passability = 'IMPASSABLE';
      else if (maxDepth >= 0.15) passability = 'CAUTION';

      // Find hospitals linked to this road
      const connectedHospitals: string[] = [];
      for (const fac of dataset.criticalFacilities) {
        if (
          fac.accessArteries.some(
            (artery) =>
              road.name.toLowerCase().includes(artery.toLowerCase()) ||
              artery.toLowerCase().includes(road.name.toLowerCase())
          )
        ) {
          connectedHospitals.push(fac.name);
        }
      }

      return {
        road,
        maxDepthM: Math.round(maxDepth * 1000) / 1000,
        averageDepthM: Math.round(averageDepthM * 1000) / 1000,
        impassableCellsCount: impassable,
        cautionCellsCount: caution,
        passableCellsCount: passable,
        totalCellsCount: total,
        connectedHospitals,
        passability,
      };
    },
    [dataset.criticalFacilities, nx, waterDepth]
  );

  // Helper to extract full cell information
  const getCellInfo = useCallback(
    (row: number, col: number): CellHoverInfo => {
      const cellIndex = row * nx + col;
      const elevationM = dataset.elevationMatrix[row][col];
      const depth = waterDepth[cellIndex] || 0;
      const { x: projectedX, y: projectedY } = gridToProjected(row, col);
      const { lat, lon } = gridToLatLon(row, col);
      const facility = facilityCellMap.get(`${row},${col}`);
      const drainageInlet = drainageCellMap.get(`${row},${col}`);
      const roadName = roadCellMap.get(`${row},${col}`);

      // Discrete depth band: 0 (<5cm), 1 (5-15cm), 2 (15-30cm), 3 (30-60cm), 4 (>=60cm)
      let depthBand = 0;
      if (depth >= 0.60) depthBand = 4;
      else if (depth >= 0.30) depthBand = 3;
      else if (depth >= 0.15) depthBand = 2;
      else if (depth >= 0.05) depthBand = 1;

      // Passability status
      let passabilityStatus: CellHoverInfo['passabilityStatus'] = 'DRY_PASSABLE';
      if (depth >= 0.30) {
        passabilityStatus = 'CRITICAL_IMPASSABLE';
      } else if (depth >= 0.10) {
        passabilityStatus = 'CAUTION_MINOR_PONDING';
      }

      // Delta comparison calculation
      let deltaWaterDepthM: number | undefined;
      let isAdversePondingCell = false;
      let adverseDepthDeltaM: number | undefined;
      if (baselineWaterDepth) {
        const baseD = baselineWaterDepth[cellIndex] || 0;
        deltaWaterDepthM = Math.round((baseD - depth) * 1000) / 1000;
        if (deltaWaterDepthM < -0.01) {
          isAdversePondingCell = true;
          adverseDepthDeltaM = Math.abs(deltaWaterDepthM);
        }
      }

      // Check for staged operational work order at this cell
      const stagedWorkOrder = workOrderCellMap.get(`${row},${col}`);

      // Rich hospital exposure
      const hospitalExposure = facility ? getHospitalExposure(facility) : undefined;

      // Rich road corridor info
      let roadCorridor: RoadCorridorInfo | undefined;
      if (roadName) {
        const matchingRoad = dataset.criticalRoads.find((r) => r.name === roadName);
        if (matchingRoad) {
          roadCorridor = getRoadCorridorInfo(matchingRoad);
        }
      }

      return {
        row,
        col,
        cellIndex,
        projectedX: Math.round(projectedX * 10) / 10,
        projectedY: Math.round(projectedY * 10) / 10,
        lat: Math.round(lat * 1000000) / 1000000,
        lon: Math.round(lon * 1000000) / 1000000,
        elevationM,
        waterDepthM: Math.round(depth * 1000) / 1000,
        waterSurfaceM: Math.round((elevationM + depth) * 1000) / 1000,
        facility,
        roadName,
        drainageInlet,
        stagedWorkOrder,
        isAdversePondingCell,
        adverseDepthDeltaM,
        passabilityStatus,
        depthBand,
        deltaWaterDepthM,
        hospitalExposure,
        roadCorridor,
      };
    },
    [
      baselineWaterDepth,
      dataset.criticalRoads,
      dataset.elevationMatrix,
      drainageCellMap,
      facilityCellMap,
      getHospitalExposure,
      getRoadCorridorInfo,
      nx,
      roadCellMap,
      waterDepth,
      workOrderCellMap,
    ]
  );

  // Hypsometric elevation coloring function
  const getElevationColor = useCallback(
    (z: number): string => {
      const norm = Math.max(0, Math.min(1, (z - minElevationM) / (maxElevationM - minElevationM)));
      const r = Math.round(10 + norm * 80);
      const g = Math.round(15 + norm * 95);
      const b = Math.round(20 + norm * 115);
      return `rgb(${r}, ${g}, ${b})`;
    },
    [maxElevationM, minElevationM]
  );

  // Main Render Routine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Handle high-DPI crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const container = containerRef.current;
    const width = container?.clientWidth || 800;
    const height = container?.clientHeight || 600;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Strict 1:1 Aspect Ratio Box (Domain is 1600m x 1600m)
    const padding = 28;
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;
    const displaySize = Math.max(100, Math.min(availableWidth, availableHeight));

    const originX = Math.floor((width - displaySize) / 2);
    const originY = Math.floor((height - displaySize) / 2);
    const cellSize = displaySize / nx;

    // 1. Background Fill
    ctx.fillStyle = '#080c10'; // Onyx-950
    ctx.fillRect(0, 0, width, height);

    // 1b. Render Satellite Imagery Still (if enabled)
    if (activeLayers.satellite && satelliteImage) {
      ctx.drawImage(satelliteImage, originX, originY, displaySize, displaySize);
    }

    // 2. Render 64x64 Terrain Elevation Raster
    if (activeLayers.terrain) {
      for (let r = 0; r < ny; r++) {
        for (let c = 0; c < nx; c++) {
          const z = dataset.elevationMatrix[r][c];
          ctx.fillStyle = activeLayers.satellite
            ? 'rgba(0, 0, 0, 0.25)'
            : getElevationColor(z);
          ctx.fillRect(originX + c * cellSize, originY + r * cellSize, cellSize + 0.4, cellSize + 0.4);
        }
      }
    } else if (!activeLayers.satellite) {
      ctx.fillStyle = '#111822';
      ctx.fillRect(originX, originY, displaySize, displaySize);
    }

    // 3. Render Topographic Contour Lines (Every 5 meters)
    if (activeLayers.contours) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      const contourInterval = 5.0; // 5 meters

      for (let r = 0; r < ny - 1; r++) {
        for (let c = 0; c < nx - 1; c++) {
          const z00 = dataset.elevationMatrix[r][c];
          const z10 = dataset.elevationMatrix[r][c + 1];
          const z01 = dataset.elevationMatrix[r + 1][c];

          const level0 = Math.floor(z00 / contourInterval) * contourInterval;
          const level1 = Math.floor(z10 / contourInterval) * contourInterval;
          const level2 = Math.floor(z01 / contourInterval) * contourInterval;

          if (level0 !== level1 || level0 !== level2) {
            ctx.beginPath();
            ctx.moveTo(originX + c * cellSize, originY + r * cellSize);
            ctx.lineTo(originX + (c + 1) * cellSize, originY + (r + 1) * cellSize);
            ctx.stroke();
          }
        }
      }
    }

    // 4. Render Overland Flood Water (Discrete Tactical Bands or Intervention Delta Mode)
    if (activeLayers.water) {
      ctx.save();

      if (viewMode === 'delta' && baselineWaterDepth) {
        // --- DELTA COMPARISON MODE (Avoided flood volume & drawdown) ---
        for (let r = 0; r < ny; r++) {
          for (let c = 0; c < nx; c++) {
            const idx = r * nx + c;
            const hBase = baselineWaterDepth[idx] || 0;
            const hPlan = waterDepth[idx] || 0;
            const delta = hBase - hPlan; // positive means plan avoided/reduced flood depth

            if (Math.abs(delta) >= 0.02) {
              const x = originX + c * cellSize;
              const y = originY + r * cellSize;

              if (delta > 0) {
                // Beneficial floodwater reduction / avoided surface water (Plan win!)
                // Emerald green to cyan gradient
                const intensity = Math.min(1.0, (delta - 0.02) / 0.30);
                const alpha = 0.45 + intensity * 0.45;
                ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`;
                ctx.fillRect(x, y, cellSize, cellSize);

                if (delta >= 0.10) {
                  ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
                  ctx.lineWidth = 1;
                  ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
                }
              } else {
                // Local water deflection / accumulation (e.g. Behind sandbag barrier)
                const intensity = Math.min(1.0, (Math.abs(delta) - 0.02) / 0.30);
                const alpha = 0.40 + intensity * 0.40;
                ctx.fillStyle = `rgba(245, 158, 11, ${alpha})`;
                ctx.fillRect(x, y, cellSize, cellSize);

                // Highlight severe adverse deflection (>= 5cm localized water rise)
                if (delta <= -0.05) {
                  ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
                  ctx.lineWidth = 1;
                  ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
                }
              }
            }
          }
        }
      } else {
        // --- STANDARD MODE: DISCRETE TACTICAL DEPTH BANDS ---
        for (let r = 0; r < ny; r++) {
          for (let c = 0; c < nx; c++) {
            const idx = r * nx + c;
            const h = waterDepth[idx];

            if (h >= 0.02) {
              const x = originX + c * cellSize;
              const y = originY + r * cellSize;

              // Tactical Discrete Band Color Assignment
              if (h >= 0.60) {
                // Band 4: Severe Hazard (>= 60 cm) - Deep Emergency Crimson
                ctx.fillStyle = 'rgba(220, 38, 38, 0.92)';
                ctx.fillRect(x, y, cellSize, cellSize);
                ctx.strokeStyle = 'rgba(248, 113, 113, 0.8)';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
              } else if (h >= 0.30) {
                // Band 3: Critical Impassable (30 - 60 cm) - Safety Amber/Orange-Red
                ctx.fillStyle = 'rgba(249, 115, 22, 0.85)';
                ctx.fillRect(x, y, cellSize, cellSize);
              } else if (h >= 0.15) {
                // Band 2: Moderate Ponding (15 - 30 cm) - Deep Cobalt Blue
                ctx.fillStyle = 'rgba(37, 99, 235, 0.80)';
                ctx.fillRect(x, y, cellSize, cellSize);
              } else if (h >= 0.05) {
                // Band 1: Shallow Accumulation (5 - 15 cm) - Sky Blue
                ctx.fillStyle = 'rgba(56, 189, 248, 0.60)';
                ctx.fillRect(x, y, cellSize, cellSize);
              } else {
                // Band 0: Surface Runoff Sheen (2 - 5 cm) - Faint Cerulean
                ctx.fillStyle = 'rgba(14, 165, 233, 0.25)';
                ctx.fillRect(x, y, cellSize, cellSize);
              }
            }
          }
        }
      }
      ctx.restore();
    }

    // 5. Render Hydraulic Velocity / Gradient Vectors
    if (activeLayers.vectors && activeLayers.water && viewMode === 'standard') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1;

      for (let r = 2; r < ny - 2; r += 4) {
        for (let c = 2; c < nx - 2; c += 4) {
          const idx = r * nx + c;
          const h = waterDepth[idx];

          if (h >= 0.05) {
            const etaLeft = dataset.elevationMatrix[r][c - 1] + waterDepth[r * nx + (c - 1)];
            const etaRight = dataset.elevationMatrix[r][c + 1] + waterDepth[r * nx + (c + 1)];
            const etaTop = dataset.elevationMatrix[r - 1][c] + waterDepth[(r - 1) * nx + c];
            const etaBottom = dataset.elevationMatrix[r + 1][c] + waterDepth[(r + 1) * nx + c];

            const gradX = (etaLeft - etaRight) / (2 * 25.0);
            const gradY = (etaTop - etaBottom) / (2 * 25.0);

            const mag = Math.hypot(gradX, gradY);
            if (mag > 0.0005) {
              const dirX = gradX / mag;
              const dirY = gradY / mag;
              const arrowLength = Math.min(cellSize * 1.8, Math.max(cellSize * 0.6, mag * 800));

              const startX = originX + (c + 0.5) * cellSize;
              const startY = originY + (r + 0.5) * cellSize;
              const endX = startX + dirX * arrowLength;
              const endY = startY + dirY * arrowLength;

              ctx.beginPath();
              ctx.moveTo(startX, startY);
              ctx.lineTo(endX, endY);
              ctx.stroke();

              const angle = Math.atan2(dirY, dirX);
              const headLen = 3;
              ctx.beginPath();
              ctx.moveTo(endX, endY);
              ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
              ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
              ctx.fill();
            }
          }
        }
      }
    }

    // 6. Render Road Network Corridors (Segment-by-Segment Passability)
    if (activeLayers.roads) {
      for (const road of dataset.criticalRoads) {
        if (road.gridCells.length < 2) continue;

        const isRoadSelected = selectedRoadId === road.roadId;

        // Draw selected road glowing halo
        if (isRoadSelected) {
          ctx.beginPath();
          for (let i = 0; i < road.gridCells.length; i++) {
            const [r, c] = road.gridCells[i];
            const px = originX + (c + 0.5) * cellSize;
            const py = originY + (r + 0.5) * cellSize;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = 'rgba(249, 115, 22, 0.75)'; // Orange halo
          ctx.lineWidth = 6.0;
          ctx.stroke();
        }

        // Draw individual segments colored by local cell water depth
        for (let i = 0; i < road.gridCells.length - 1; i++) {
          const [r1, c1] = road.gridCells[i];
          const [r2, c2] = road.gridCells[i + 1];

          const d1 = waterDepth[r1 * nx + c1] || 0;
          const d2 = waterDepth[r2 * nx + c2] || 0;
          const segDepth = Math.max(d1, d2);

          const p1x = originX + (c1 + 0.5) * cellSize;
          const p1y = originY + (r1 + 0.5) * cellSize;
          const p2x = originX + (c2 + 0.5) * cellSize;
          const p2y = originY + (r2 + 0.5) * cellSize;

          ctx.beginPath();
          ctx.moveTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);

          if (segDepth >= 0.30) {
            // Impassable submerged corridor
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.95)'; // Red-500
            ctx.lineWidth = 2.8;
          } else if (segDepth >= 0.15) {
            // Moderate ponding screening tier (15-30cm)
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.90)'; // Amber-500
            ctx.lineWidth = 2.2;
          } else {
            // Fully passable corridor
            ctx.strokeStyle =
              road.highwayType === 'primary'
                ? 'rgba(248, 250, 252, 0.70)'
                : 'rgba(148, 163, 184, 0.45)';
            ctx.lineWidth = road.highwayType === 'primary' ? 1.8 : 1.2;
          }

          ctx.stroke();
        }
      }
    }

    // 7. Render Modelled Drainage Inlets (Culverts & Sump)
    if (activeLayers.drainage) {
      for (const inlet of dataset.modelledDrainageInlets) {
        const [r, c] = inlet.gridCell;
        const px = originX + (c + 0.5) * cellSize;
        const py = originY + (r + 0.5) * cellSize;

        const isBrooklineCulvert = inlet.inletId === 'CULVERT-01-BROOKLINE' || (r === 17 && c === 26);

        // Outer glow
        ctx.fillStyle = isBrooklineCulvert ? 'rgba(249, 115, 22, 0.35)' : 'rgba(6, 182, 212, 0.25)';
        ctx.beginPath();
        ctx.arc(px, py, cellSize * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Core marker (diamond shape)
        ctx.fillStyle = isBrooklineCulvert ? '#f97316' : '#06b6d4';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px, py - 5);
        ctx.lineTo(px + 5, py);
        ctx.lineTo(px, py + 5);
        ctx.lineTo(px - 5, py);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // 8. Render 5 Critical Medical Facilities (Hospital Exposure Distinction)
    if (activeLayers.facilities) {
      for (const fac of dataset.criticalFacilities) {
        const [r, c] = fac.gridCell;
        const px = originX + (c + 0.5) * cellSize;
        const py = originY + (r + 0.5) * cellSize;

        const isFacilitySelected = selectedFacilityId === fac.facilityId;
        const hospitalExp = getHospitalExposure(fac);

        // Outer Status Ring: Warning dashed ring if access compromised, green if accessible
        if (hospitalExp.overallStatus === 'ACCESS_COMPROMISED_ISOLATED') {
          ctx.strokeStyle = '#f59e0b'; // Amber alert ring
          ctx.lineWidth = 1.8;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.arc(px, py, cellSize * 1.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (hospitalExp.overallStatus === 'CAUTION_ACCESS_RESTRICTED') {
          ctx.strokeStyle = '#38bdf8'; // Sky blue caution ring
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(px, py, cellSize * 1.4, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)'; // Green accessible ring
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(px, py, cellSize * 1.3, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Selected halo
        if (isFacilitySelected) {
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 3;
          ctx.strokeRect(px - 9, py - 9, 18, 18);
        }

        // Campus Badge: Structurally dry building is marked with blue/emerald badge
        ctx.fillStyle = hospitalExp.isBuildingDry ? '#1e40af' : '#b91c1c';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;

        const bSize = 6.5;
        ctx.fillRect(px - bSize, py - bSize, bSize * 2, bSize * 2);
        ctx.strokeRect(px - bSize, py - bSize, bSize * 2, bSize * 2);

        // White cross inside badge
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 1, py - 4, 2, 8);
        ctx.fillRect(px - 4, py - 1, 8, 2);

        // Facility Name Label with High-Contrast Background
        ctx.font = 'bold 9.5px monospace';
        const label = fac.name.replace('Beth Israel Deaconess Medical Center', 'BIDMC').replace(' Hospital', '');
        const textWidth = ctx.measureText(label).width;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(px + 10, py - 6, textWidth + 6, 14);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(px + 10, py - 6, textWidth + 6, 14);

        ctx.fillStyle = hospitalExp.overallStatus === 'ACCESS_COMPROMISED_ISOLATED' ? '#fde047' : '#f8fafc';
        ctx.fillText(label, px + 13, py + 4);
      }
    }

    // 8A. Render Adverse Ponding / Deflection Surcharge Hatches
    if (activeLayers.adversePonding !== false && baselineWaterDepth) {
      ctx.save();
      for (let r = 0; r < ny; r++) {
        for (let c = 0; c < nx; c++) {
          const idx = r * nx + c;
          const baseD = baselineWaterDepth[idx] || 0;
          const currD = waterDepth[idx] || 0;
          const delta = baseD - currD;
          // Local water rise > 1cm caused by intervention
          if (delta <= -0.01) {
            const x = originX + c * cellSize;
            const y = originY + r * cellSize;

            ctx.strokeStyle = delta <= -0.05 ? 'rgba(239, 68, 68, 0.95)' : 'rgba(245, 158, 11, 0.90)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x, y + cellSize);
            ctx.lineTo(x + cellSize, y);
            ctx.stroke();

            ctx.strokeStyle = delta <= -0.05 ? '#ef4444' : '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, y, cellSize, cellSize);
          }
        }
      }
      ctx.restore();
    }

    // 8B. Render Staged Operational Work Orders & Intervention Targets
    if (activeLayers.workOrders !== false && stagedWorkOrders && stagedWorkOrders.length > 0) {
      for (const wo of stagedWorkOrders) {
        const [r, c] = wo.targetLocation.gridCell;
        const px = originX + (c + 0.5) * cellSize;
        const py = originY + (r + 0.5) * cellSize;
        const isSelected = selectedWorkOrderId === wo.workOrderId;

        let targetColor = '#06b6d4'; // default cyan (Plan Beta)
        let planBadge = 'PUMP';
        if (wo.planId === 'plan-alpha') {
          targetColor = '#f97316'; // orange
          planBadge = 'BARRIER';

          // Draw physical barrier alignment path
          const barrierCells: [number, number][] = [[41, 26], [42, 26], [43, 27], [43, 28]];
          ctx.save();
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 2]);
          ctx.beginPath();
          for (let i = 0; i < barrierCells.length; i++) {
            const [br, bc] = barrierCells[i];
            const bx = originX + (bc + 0.5) * cellSize;
            const by = originY + (br + 0.5) * cellSize;
            if (i === 0) ctx.moveTo(bx, by);
            else ctx.lineTo(bx, by);
          }
          ctx.stroke();
          ctx.restore();
        } else if (wo.planId === 'plan-gamma') {
          targetColor = '#10b981'; // emerald
          planBadge = 'JETTING';
        }

        ctx.save();

        // Selected halo
        if (isSelected) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          ctx.arc(px, py, cellSize * 2.2, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Outer Reticle Ring
        ctx.strokeStyle = targetColor;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(px, py, cellSize * 1.5, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshairs
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px - cellSize * 1.8, py);
        ctx.lineTo(px + cellSize * 1.8, py);
        ctx.moveTo(px, py - cellSize * 1.8);
        ctx.lineTo(px, py + cellSize * 1.8);
        ctx.stroke();

        // Center Core Pill
        ctx.fillStyle = targetColor;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Tactical Badge Callout
        ctx.font = 'bold 8.5px monospace';
        const tagText = `[${planBadge}: ${wo.stage === 'JIRA_LINKED' ? 'JIRA' : wo.stage === 'COMMANDER_STAGED' ? 'STAGED' : 'DRAFT'}]`;
        const tagWidth = ctx.measureText(tagText).width;

        ctx.fillStyle = 'rgba(8, 12, 16, 0.90)';
        ctx.fillRect(px - tagWidth / 2 - 3, py - cellSize * 1.6 - 13, tagWidth + 6, 13);
        ctx.strokeStyle = targetColor;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(px - tagWidth / 2 - 3, py - cellSize * 1.6 - 13, tagWidth + 6, 13);

        ctx.fillStyle = '#f8fafc';
        ctx.fillText(tagText, px - tagWidth / 2, py - cellSize * 1.6 - 3);

        ctx.restore();
      }
    }

    // 9. Render Hovered & Selected Cell Reticle
    const activeCell = selectedCell || internalHover;
    if (activeCell) {
      const { row, col } = activeCell;
      if (row >= 0 && row < ny && col >= 0 && col < nx) {
        const px = originX + col * cellSize;
        const py = originY + row * cellSize;

        ctx.strokeStyle = '#f97316'; // Safety orange
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px, py, cellSize, cellSize);

        ctx.strokeStyle = 'rgba(249, 115, 22, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(originX, py + cellSize / 2);
        ctx.lineTo(originX + displaySize, py + cellSize / 2);
        ctx.moveTo(px + cellSize / 2, originY);
        ctx.lineTo(px + cellSize / 2, originY + displaySize);
        ctx.stroke();
      }
    }

    // 10. Computational Boundary Frame & Spatial Metadata
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(originX, originY, displaySize, displaySize);

    // Coordinate tick labels on border
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.fillText(`X:${Math.round(xmin)}m`, originX, originY - 6);
    ctx.fillText(`X:${Math.round(xmax)}m`, originX + displaySize - 55, originY - 6);
    ctx.fillText(`Y:${Math.round(ymax)}m`, originX - 60, originY + 10);
    ctx.fillText(`Y:${Math.round(ymin)}m`, originX - 60, originY + displaySize);

    // North Arrow & Compass
    const compX = originX + displaySize - 18;
    const compY = originY + 22;
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(compX, compY - 10);
    ctx.lineTo(compX + 5, compY + 4);
    ctx.lineTo(compX, compY);
    ctx.lineTo(compX - 5, compY + 4);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('N', compX - 3, compY - 12);

    // Metric Scale Bar (400 meters)
    const scaleBarM = 400;
    const scaleBarPx = (scaleBarM / 1600.0) * displaySize;
    const scaleX = originX + 12;
    const scaleY = originY + displaySize - 12;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(scaleX - 4, scaleY - 14, scaleBarPx + 8, 20);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaleX, scaleY);
    ctx.lineTo(scaleX + scaleBarPx, scaleY);
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(scaleX, scaleY - 3);
    ctx.lineTo(scaleX, scaleY + 3);
    ctx.moveTo(scaleX + scaleBarPx, scaleY - 3);
    ctx.lineTo(scaleX + scaleBarPx, scaleY + 3);
    ctx.stroke();

    ctx.font = '9px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`${scaleBarM}m (EPSG:26986)`, scaleX + 4, scaleY - 5);

    // 11. Docked On-Canvas Tactical Legend (if activeLayers.legend !== false)
    if (activeLayers.legend !== false) {
      const legW = 185;
      const legH = viewMode === 'delta' ? 125 : 165;
      const legX = originX + displaySize - legW - 10;
      const legY = originY + displaySize - legH - 10;

      // Legend Backdrop
      ctx.fillStyle = 'rgba(8, 12, 16, 0.90)';
      ctx.fillRect(legX, legY, legW, legH);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(legX, legY, legW, legH);

      // Legend Header
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#f97316';
      ctx.fillText(viewMode === 'delta' ? 'DELTA: AVOIDED FLOOD' : 'DELTA SCREENING DEPTHS', legX + 8, legY + 14);

      ctx.font = '8.5px monospace';
      if (viewMode === 'delta') {
        // Delta mode swatches
        let currY = legY + 28;
        const deltaItems = [
          { color: 'rgba(16, 185, 129, 0.85)', label: 'Avoided Volume (Plan)' },
          { color: 'rgba(245, 158, 11, 0.85)', label: 'Deflected Ponding' },
          { color: 'rgba(148, 163, 184, 0.30)', label: 'Unchanged Domain' },
        ];
        for (const item of deltaItems) {
          ctx.fillStyle = item.color;
          ctx.fillRect(legX + 8, currY - 6, 10, 8);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(item.label, legX + 24, currY);
          currY += 16;
        }

        // Subtext
        ctx.fillStyle = '#94a3b8';
        ctx.font = '7.5px monospace';
        ctx.fillText('Shows depth reduction vs baseline', legX + 8, legY + legH - 8);
      } else {
        // Standard Depth Bands
        let currY = legY + 28;
        const bands = [
          { color: 'rgba(220, 38, 38, 0.95)', label: '≥ 60cm: Deep Inundation' },
          { color: 'rgba(249, 115, 22, 0.88)', label: '30–60cm: Substantial Inundation' },
          { color: 'rgba(37, 99, 235, 0.82)', label: '15–30cm: Moderate Ponding' },
          { color: 'rgba(56, 189, 248, 0.65)', label: '5–15cm: Shallow Surface Water' },
          { color: 'rgba(14, 165, 233, 0.30)', label: '< 5cm: Surface Wetting / Sheen' },
        ];
        for (const b of bands) {
          ctx.fillStyle = b.color;
          ctx.fillRect(legX + 8, currY - 6, 10, 8);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(b.label, legX + 24, currY);
          currY += 14;
        }

        // Road indicators
        currY += 3;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px monospace';
        ctx.fillText('ROADS (Screening Tiers):', legX + 8, currY);
        currY += 11;
        ctx.fillStyle = '#22c55e';
        ctx.fillText('■<15cm', legX + 8, currY);
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('■15-30cm', legX + 62, currY);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('■≥30cm', legX + 125, currY);

        currY += 13;
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('✚ Hospital: Campus Monitored', legX + 8, currY);

        currY += 11;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '7px monospace';
        ctx.fillText('* Model screening tiers. Field access unverified.', legX + 8, currY);
      }
    }
  }, [
    activeLayers,
    activePlanId,
    baselineWaterDepth,
    dataset,
    getElevationColor,
    getHospitalExposure,
    internalHover,
    nx,
    ny,
    satelliteImage,
    selectedCell,
    selectedFacilityId,
    selectedRoadId,
    selectedWorkOrderId,
    stagedWorkOrders,
    viewMode,
    waterDepth,
    xmax,
    xmin,
    ymax,
    ymin,
  ]);

  // Handle Mouse Events for Hover and Feature Selection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const width = rect.width;
    const height = rect.height;
    const padding = 28;
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;
    const displaySize = Math.max(100, Math.min(availableWidth, availableHeight));

    const originX = Math.floor((width - displaySize) / 2);
    const originY = Math.floor((height - displaySize) / 2);
    const cellSize = displaySize / nx;

    const relX = clientX - originX;
    const relY = clientY - originY;

    if (relX >= 0 && relX < displaySize && relY >= 0 && relY < displaySize) {
      const col = Math.floor(relX / cellSize);
      const row = Math.floor(relY / cellSize);
      if (row >= 0 && row < ny && col >= 0 && col < nx) {
        setInternalHover({ row, col });
        const info = getCellInfo(row, col);
        if (onCellHover) onCellHover(info);
        return;
      }
    }

    setInternalHover(null);
    if (onCellHover) onCellHover(null);
  };

  const handleMouseLeave = () => {
    setInternalHover(null);
    if (onCellHover) onCellHover(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const width = rect.width;
    const height = rect.height;
    const padding = 28;
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;
    const displaySize = Math.max(100, Math.min(availableWidth, availableHeight));

    const originX = Math.floor((width - displaySize) / 2);
    const originY = Math.floor((height - displaySize) / 2);
    const cellSize = displaySize / nx;

    const relX = clientX - originX;
    const relY = clientY - originY;

    if (relX >= 0 && relX < displaySize && relY >= 0 && relY < displaySize) {
      // 1. Check if clicked near a staged work order target
      if (stagedWorkOrders && stagedWorkOrders.length > 0) {
        for (const wo of stagedWorkOrders) {
          const [r, c] = wo.targetLocation.gridCell;
          const woPx = (c + 0.5) * cellSize;
          const woPy = (r + 0.5) * cellSize;
          if (Math.hypot(relX - woPx, relY - woPy) <= 18) {
            if (onSelectWorkOrder) onSelectWorkOrder(wo);
            const info = getCellInfo(r, c);
            if (onCellClick) onCellClick(info);
            return;
          }
        }
      }

      // 2. Check if clicked near a hospital facility
      for (const fac of dataset.criticalFacilities) {
        const facPx = (fac.gridCell[1] + 0.5) * cellSize;
        const facPy = (fac.gridCell[0] + 0.5) * cellSize;
        if (Math.hypot(relX - facPx, relY - facPy) <= 15) {
          if (onSelectFacility) onSelectFacility(fac);
          const info = getCellInfo(fac.gridCell[0], fac.gridCell[1]);
          if (onCellClick) onCellClick(info);
          return;
        }
      }

      // 2. Check if clicked near a road corridor
      for (const road of dataset.criticalRoads) {
        for (let i = 0; i < road.gridCells.length - 1; i++) {
          const [r1, c1] = road.gridCells[i];
          const [r2, c2] = road.gridCells[i + 1];
          const p1x = (c1 + 0.5) * cellSize;
          const p1y = (r1 + 0.5) * cellSize;
          const p2x = (c2 + 0.5) * cellSize;
          const p2y = (r2 + 0.5) * cellSize;

          // Distance from point to line segment
          const l2 = Math.hypot(p2x - p1x, p2y - p1y) ** 2;
          let t = l2 === 0 ? 0 : ((relX - p1x) * (p2x - p1x) + (relY - p1y) * (p2y - p1y)) / l2;
          t = Math.max(0, Math.min(1, t));
          const projX = p1x + t * (p2x - p1x);
          const projY = p1y + t * (p2y - p1y);
          if (Math.hypot(relX - projX, relY - projY) <= 8) {
            if (onSelectRoad) onSelectRoad(road);
            const midRow = Math.round(r1 + t * (r2 - r1));
            const midCol = Math.round(c1 + t * (c2 - c1));
            const info = getCellInfo(midRow, midCol);
            if (onCellClick) onCellClick(info);
            return;
          }
        }
      }

      // 3. Fallback: Cell click
      const col = Math.floor(relX / cellSize);
      const row = Math.floor(relY / cellSize);
      if (row >= 0 && row < ny && col >= 0 && col < nx) {
        if (onSelectRoad) onSelectRoad(null);
        if (onSelectFacility) onSelectFacility(null);
        const info = getCellInfo(row, col);
        if (onCellClick) onCellClick(info);
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="w-full h-full cursor-crosshair block"
      />
    </div>
  );
};

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
import { computeMapLayout, identityViewport, zoomAtPoint, screenToGrid, gridToScreen, viewCellSize, waterColorForDepth, flowArrowForGradient, type ViewportTransform } from '../../simulation/mapViewport';

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
  customActions?: { id: string; row: number; col: number; type: string }[];
  activePlanId?: 'plan-alpha' | 'plan-beta' | 'plan-gamma' | null;
  selectedWorkOrderId?: string | null;
  onCellHover?: (info: CellHoverInfo | null) => void;
  onCellClick?: (info: CellHoverInfo) => void;
  onSelectRoad?: (road: RoadSegment | null) => void;
  onSelectFacility?: (facility: CriticalFacility | null) => void;
  onSelectWorkOrder?: (wo: OperationalWorkOrder | null) => void;
  waterDepthRef?: React.RefObject<Float64Array | null>;
  showViewportControls?: boolean;
  interactiveViewport?: boolean;
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
  customActions = [],
  activePlanId = null,
  selectedWorkOrderId = null,
  onCellHover,
  onCellClick,
  onSelectRoad,
  onSelectFacility,
  onSelectWorkOrder,
  waterDepthRef,
  showViewportControls = true,
  interactiveViewport = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoverRef = useRef<{ row: number; col: number } | null>(null);
  const viewportRef = useRef<ViewportTransform>(identityViewport());
  const layoutRef = useRef<ReturnType<typeof computeMapLayout> | null>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const flowPhaseRef = useRef(0);
  const waterOffscreenRef = useRef<HTMLCanvasElement | null>(null);
  const depthRef = useRef<Float64Array>(waterDepth);
  const lastPolledDepthRef = useRef<Float64Array | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const zoomLabelRef = useRef<HTMLSpanElement | null>(null);
  depthRef.current = waterDepthRef?.current ?? waterDepth;
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
      const buildingStandingWaterDepthM = depthRef.current[r * nx + c] || 0;
      const isBuildingDry = buildingStandingWaterDepthM < 0.05;

      // 8-neighborhood perimeter depth
      let perimeterMaxDepthM = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ny && nc >= 0 && nc < nx) {
            const pd = depthRef.current[nr * nx + nc] || 0;
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
              const rd = depthRef.current[rr * nx + cc] || 0;
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
    [dataset.criticalRoads, dataset.elevationMatrix, nx, ny]
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
        const d = depthRef.current[r * nx + c] || 0;
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
    [dataset.criticalFacilities, nx]
  );

  // Helper to extract full cell information
  const getCellInfo = useCallback(
    (row: number, col: number): CellHoverInfo => {
      const cellIndex = row * nx + col;
      const elevationM = dataset.elevationMatrix[row][col];
      const depth = depthRef.current[cellIndex] || 0;
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

  // Main Render Routine (imperative via drawRef so refs/RaF can redraw without React renders)
  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    depthRef.current = waterDepthRef?.current ?? waterDepth;
    const waterDepthNow = depthRef.current;
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

    const baseLayout = computeMapLayout(width, height, nx);
    layoutRef.current = baseLayout;
    const view = viewportRef.current;
    const originX = baseLayout.originX + view.panX;
    const originY = baseLayout.originY + view.panY;
    const displaySize = baseLayout.displaySize * view.zoom;
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
            const hPlan = waterDepthNow[idx] || 0;
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
        // --- STANDARD MODE: bilinearly smoothed translucent water (offscreen grid + smoothed upscale) ---
        if (!waterOffscreenRef.current) waterOffscreenRef.current = document.createElement('canvas');
        const off = waterOffscreenRef.current; off.width = nx; off.height = ny;
        const offCtx = off.getContext('2d');
        if (offCtx) {
          const img = offCtx.createImageData(nx, ny);
          for (let i = 0; i < nx * ny; i++) { const [r, g, b, a] = waterColorForDepth(waterDepthNow[i] || 0); img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = a; }
          offCtx.putImageData(img, 0, 0);
          ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(off, originX, originY, displaySize, displaySize); ctx.restore();
          // Wet-edge contour where wet cells meet dry cells
          ctx.save(); ctx.strokeStyle = 'rgba(186, 230, 253, 0.38)'; ctx.lineWidth = 1; ctx.beginPath();
          for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) { if ((waterDepthNow[r * nx + c] || 0) < 0.02) continue; const x = originX + c * cellSize, y = originY + r * cellSize;
            if (r === 0 || waterDepthNow[(r - 1) * nx + c] < 0.02) { ctx.moveTo(x, y); ctx.lineTo(x + cellSize, y); }
            if (c === 0 || waterDepthNow[r * nx + c - 1] < 0.02) { ctx.moveTo(x, y); ctx.lineTo(x, y + cellSize); } }
          ctx.stroke(); ctx.restore();
        }
      }
      ctx.restore();
    }

    // 5. Velocity-scaled directional flow arrows (surface-gradient, animated downstream march)
    if (activeLayers.vectors && activeLayers.water && viewMode === 'standard') {
      const phase = flowPhaseRef.current * cellSize * 0.6;
      for (let r = 2; r < ny - 2; r += 3) for (let c = 2; c < nx - 2; c += 3) {
        const h = waterDepthNow[r * nx + c]; if (h < 0.05) continue;
        const gradX = ((dataset.elevationMatrix[r][c - 1] + waterDepthNow[r * nx + c - 1]) - (dataset.elevationMatrix[r][c + 1] + waterDepthNow[r * nx + c + 1])) / 50;
        const gradY = ((dataset.elevationMatrix[r - 1][c] + waterDepthNow[(r - 1) * nx + c]) - (dataset.elevationMatrix[r + 1][c] + waterDepthNow[(r + 1) * nx + c])) / 50;
        const arrow = flowArrowForGradient(gradX, gradY, cellSize); if (!arrow) continue;
        const sx = originX + (c + 0.5) * cellSize + arrow.dirX * phase, sy = originY + (r + 0.5) * cellSize + arrow.dirY * phase;
        const ex = sx + arrow.dirX * arrow.length, ey = sy + arrow.dirY * arrow.length; const ang = Math.atan2(arrow.dirY, arrow.dirX);
        ctx.lineWidth = arrow.lineWidth + 1.6; ctx.strokeStyle = 'rgba(8,47,73,0.55)'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.lineWidth = arrow.lineWidth; ctx.strokeStyle = 'rgba(224,242,254,0.92)'; ctx.fillStyle = 'rgba(224,242,254,0.95)';
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - arrow.headLen * Math.cos(ang - Math.PI / 6), ey - arrow.headLen * Math.sin(ang - Math.PI / 6)); ctx.lineTo(ex - arrow.headLen * Math.cos(ang + Math.PI / 6), ey - arrow.headLen * Math.sin(ang + Math.PI / 6)); ctx.closePath(); ctx.fill();
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

          const d1 = waterDepthNow[r1 * nx + c1] || 0;
          const d2 = waterDepthNow[r2 * nx + c2] || 0;
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
          const currD = waterDepthNow[idx] || 0;
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

    if (customActions.length > 0) {
      for (const a of customActions) {
        const px = originX + (a.col + 0.5) * cellSize; const py = originY + (a.row + 0.5) * cellSize;
        const color = a.type === 'PUMP' ? '#22d3ee' : a.type === 'BARRIER' ? '#f97316' : '#ef4444';
        ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, cellSize * 1.7, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = color; ctx.font = 'bold 8px monospace'; ctx.fillText(a.type, px - 14, py - cellSize * 1.9); ctx.restore();
      }
    }

    // 9. Render Hovered & Selected Cell Reticle
    const activeCell = selectedCell || hoverRef.current;
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

  }, [
    activeLayers,
    activePlanId,
    baselineWaterDepth,
    dataset,
    getElevationColor,
    getHospitalExposure,
    nx,
    ny,
    satelliteImage,
    selectedCell,
    selectedFacilityId,
    selectedRoadId,
    selectedWorkOrderId,
    stagedWorkOrders,
    customActions,
    viewMode,
    waterDepth,
    xmax,
    xmin,
    ymax,
    ymin,
  ]);

  useEffect(() => { drawRef.current = drawScene; }, [drawScene]);
  useEffect(() => { drawScene(); }, [drawScene]);
  // Decoupled animation / live-depth polling: redraws canvas via ref without React re-renders.
  useEffect(() => {
    if (!waterDepthRef && !(activeLayers.vectors && activeLayers.water)) return;
    const id = setInterval(() => {
      flowPhaseRef.current = (flowPhaseRef.current + 0.15) % 1;
      const d = waterDepthRef?.current ?? null;
      if (d && d !== lastPolledDepthRef.current) { lastPolledDepthRef.current = d; drawRef.current?.(); }
      else if (activeLayers.vectors && activeLayers.water && viewMode === 'standard') drawRef.current?.();
    }, 120);
    return () => clearInterval(id);
  }, [waterDepthRef, activeLayers.vectors, activeLayers.water, viewMode]);

  const updateViewport = useCallback((next: ViewportTransform) => {
    viewportRef.current = next;
    if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(next.zoom * 100)}%`;
    drawRef.current?.();
  }, []);
  const zoomBy = useCallback((factor: number) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const layout = layoutRef.current ?? computeMapLayout(rect.width, rect.height, nx);
    updateViewport(zoomAtPoint(viewportRef.current, factor, layout.originX + layout.displaySize / 2, layout.originY + layout.displaySize / 2, layout));
  }, [nx, updateViewport]);
  // Canvas-scoped wheel zoom: non-passive so the page never zooms/scrolls.
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !interactiveViewport) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const rect = canvas.getBoundingClientRect(); const layout = computeMapLayout(rect.width, rect.height, nx); updateViewport(zoomAtPoint(viewportRef.current, e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left, e.clientY - rect.top, layout)); };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [nx, interactiveViewport, updateViewport]);

  // Handle Mouse Events for Hover and Feature Selection (inverse mapping via mapViewport)
  const layoutFromEvent = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current!; const rect = canvas.getBoundingClientRect();
    const layout = computeMapLayout(rect.width, rect.height, nx);
    return { rect, layout, x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const handleMouseMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x, dy = e.clientY - dragRef.current.y;
      if (Math.hypot(dx, dy) > 4) dragRef.current.moved = true;
      if (dragRef.current.moved) { updateViewport({ ...viewportRef.current, panX: dragRef.current.panX + dx, panY: dragRef.current.panY + dy }); return; }
    }
    const { layout, x, y } = layoutFromEvent(e);
    const g = screenToGrid(x, y, layout, viewportRef.current, nx, ny);
    if (g) { hoverRef.current = { row: g.row, col: g.col }; drawRef.current?.(); onCellHover?.(getCellInfo(g.row, g.col)); return; }
    hoverRef.current = null; drawRef.current?.(); onCellHover?.(null);
  };
  const handleMouseLeave = () => { hoverRef.current = null; drawRef.current?.(); onCellHover?.(null); };
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    const { layout, x, y } = layoutFromEvent(e); const view = viewportRef.current; const cs = viewCellSize(layout, view);
    const g = screenToGrid(x, y, layout, view, nx, ny); if (!g) return;
    for (const wo of stagedWorkOrders ?? []) { const spt = gridToScreen(wo.targetLocation.gridCell[0], wo.targetLocation.gridCell[1], layout, view); if (Math.hypot(x - spt.x, y - spt.y) <= Math.max(18, cs)) { onSelectWorkOrder?.(wo); onCellClick?.(getCellInfo(wo.targetLocation.gridCell[0], wo.targetLocation.gridCell[1])); return; } }
    for (const fac of dataset.criticalFacilities) { const spt = gridToScreen(fac.gridCell[0], fac.gridCell[1], layout, view); if (Math.hypot(x - spt.x, y - spt.y) <= Math.max(15, cs * 0.8)) { onSelectFacility?.(fac); onCellClick?.(getCellInfo(fac.gridCell[0], fac.gridCell[1])); return; } }
    for (const road of dataset.criticalRoads) for (let i = 0; i < road.gridCells.length - 1; i++) {
      const a = gridToScreen(road.gridCells[i][0], road.gridCells[i][1], layout, view), b = gridToScreen(road.gridCells[i + 1][0], road.gridCells[i + 1][1], layout, view);
      const l2 = Math.hypot(b.x - a.x, b.y - a.y) ** 2; let t = l2 === 0 ? 0 : ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / l2; t = Math.max(0, Math.min(1, t));
      if (Math.hypot(x - (a.x + t * (b.x - a.x)), y - (a.y + t * (b.y - a.y))) <= Math.max(8, cs * 0.5)) { onSelectRoad?.(road); onCellClick?.(getCellInfo(Math.round(road.gridCells[i][0] + t * (road.gridCells[i + 1][0] - road.gridCells[i][0])), Math.round(road.gridCells[i][1] + t * (road.gridCells[i + 1][1] - road.gridCells[i][1])))); return; }
    }
    onSelectRoad?.(null); onSelectFacility?.(null); onCellClick?.(getCellInfo(g.row, g.col));
  };

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => { if (interactiveViewport && e.button === 0) { dragRef.current = { x: e.clientX, y: e.clientY, panX: viewportRef.current.panX, panY: viewportRef.current.panY, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); } }}
        onPointerMove={handleMouseMove}
        onPointerUp={() => { if (dragRef.current?.moved) suppressClickRef.current = true; dragRef.current = null; }}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`w-full h-full block touch-none ${interactiveViewport ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
      />
      {showViewportControls && interactiveViewport && (
        <div className="absolute right-2 top-2 z-30 flex items-center gap-1 bg-onyx-950/90 border border-onyx-700 rounded px-1.5 py-1 text-[10px] font-mono">
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.3)} className="px-2 py-0.5 rounded bg-onyx-800 text-white font-bold">+</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.3)} className="px-2 py-0.5 rounded bg-onyx-800 text-white font-bold">−</button>
          <span ref={zoomLabelRef} className="text-storm-300 w-9 text-center">100%</span>
          <button type="button" onClick={() => updateViewport(identityViewport())} className="px-2 py-0.5 rounded bg-onyx-800 text-storm-100">Reset View</button>
        </div>
      )}
      {interactiveViewport && <div className="absolute right-2 bottom-2 z-20 pointer-events-none text-[9px] font-mono text-storm-400 bg-onyx-950/70 rounded px-1.5 py-0.5">Scroll to zoom · drag to pan</div>}
    </div>
  );
};

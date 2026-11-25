import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type {
  BostonCatchmentDataset,
  CriticalFacility,
  ModelledDrainageInlet,
} from '../../data/catchmentLoader';
import {
  gridToProjected,
  gridToLatLon,
} from '../../data/catchmentLoader';

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
  passabilityStatus: 'DRY_PASSABLE' | 'CAUTION_MINOR_PONDING' | 'CRITICAL_IMPASSABLE';
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
}

interface GeographicSimulationCanvasProps {
  className?: string;
  dataset: BostonCatchmentDataset;
  waterDepth: Float64Array; // length 4096
  activeLayers: CanvasLayerVisibility;
  selectedCell?: { row: number; col: number } | null;
  onCellHover?: (info: CellHoverInfo | null) => void;
  onCellClick?: (info: CellHoverInfo) => void;
}

export const GeographicSimulationCanvas: React.FC<GeographicSimulationCanvasProps> = ({
  className = '',
  dataset,
  waterDepth,
  activeLayers,
  selectedCell,
  onCellHover,
  onCellClick,
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

  // Pre-index road segments by cell [r, c]
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

      let passabilityStatus: CellHoverInfo['passabilityStatus'] = 'DRY_PASSABLE';
      if (depth >= 0.30) {
        passabilityStatus = 'CRITICAL_IMPASSABLE';
      } else if (depth >= 0.10) {
        passabilityStatus = 'CAUTION_MINOR_PONDING';
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
        passabilityStatus,
      };
    },
    [dataset.elevationMatrix, drainageCellMap, facilityCellMap, nx, roadCellMap, waterDepth]
  );

  // Hypsometric elevation coloring function (Serious Tactical DELTA Palette)
  const getElevationColor = useCallback(
    (z: number): string => {
      const norm = Math.max(0, Math.min(1, (z - minElevationM) / (maxElevationM - minElevationM)));
      // Low (riverbed / basin): Deep onyx / slate (#0a0f14)
      // Mid-low: Charcoal storm grey (#17202b)
      // Mid: Deep stone (#243140)
      // High: Granite slate (#425366)
      // Peak: Slate stone (#697d94)
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

    // 1b. Render Genuine USGS Satellite Imagery Still (USGS National Map Imagery Only)
    if (activeLayers.satellite && satelliteImage) {
      ctx.drawImage(satelliteImage, originX, originY, displaySize, displaySize);
    }

    // 2. Render 64x64 Terrain Elevation Raster
    if (activeLayers.terrain) {
      for (let r = 0; r < ny; r++) {
        for (let c = 0; c < nx; c++) {
          const z = dataset.elevationMatrix[r][c];
          ctx.fillStyle = activeLayers.satellite
            ? 'rgba(0, 0, 0, 0.25)' // When satellite is active, subtle overlay
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

          // Check if contour line crosses cell boundary
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

    // 4. Render Simulated Overland Flood Water (Smooth Fluid Rendering)
    if (activeLayers.water) {
      ctx.save();
      for (let r = 0; r < ny; r++) {
        for (let c = 0; c < nx; c++) {
          const idx = r * nx + c;
          const h = waterDepth[idx];

          if (h >= 0.04) {
            const x = originX + c * cellSize;
            const y = originY + r * cellSize;
            const intensity = Math.min(1.0, (h - 0.04) / 0.70);

            // Vibrant fluid gradient: Cyan sheen -> Deep Cerulean -> Intense River Blue
            const alpha = 0.50 + intensity * 0.40;
            const rColor = Math.round(14 + (1 - intensity) * 30);
            const gColor = Math.round(130 + (1 - intensity) * 80);
            const bColor = 245;

            ctx.fillStyle = `rgba(${rColor}, ${gColor}, ${bColor}, ${alpha})`;

            // Soft overlapping rounded parcels merge adjacent cells into natural fluid pools
            const expand = cellSize * 0.35;
            const rx = x - expand * 0.5;
            const ry = y - expand * 0.5;
            const rw = cellSize + expand;
            const rh = cellSize + expand;
            const radius = Math.min(rw, rh) * 0.35;

            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(rx, ry, rw, rh, radius);
            } else {
              ctx.rect(rx, ry, rw, rh);
            }
            ctx.fill();

            // Highlight deep flood hazard (> 0.30m impassable for ambulances)
            if (h >= 0.30) {
              ctx.fillStyle = 'rgba(239, 68, 68, 0.28)'; // Soft emergency hazard glow
              ctx.fill();
            }
          }
        }
      }
      ctx.restore();
    }

    // 5. Render Hydraulic Velocity / Gradient Vectors
    if (activeLayers.vectors && activeLayers.water) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1;

      // Sample every 4th cell to avoid visual clutter
      for (let r = 2; r < ny - 2; r += 4) {
        for (let c = 2; c < nx - 2; c += 4) {
          const idx = r * nx + c;
          const h = waterDepth[idx];

          if (h >= 0.05) {
            const etaLeft = dataset.elevationMatrix[r][c - 1] + waterDepth[r * nx + (c - 1)];
            const etaRight = dataset.elevationMatrix[r][c + 1] + waterDepth[r * nx + (c + 1)];
            const etaTop = dataset.elevationMatrix[r - 1][c] + waterDepth[(r - 1) * nx + c];
            const etaBottom = dataset.elevationMatrix[r + 1][c] + waterDepth[(r + 1) * nx + c];

            // Downhill hydraulic gradient (-grad eta)
            const gradX = (etaLeft - etaRight) / (2 * 25.0);
            const gradY = (etaTop - etaBottom) / (2 * 25.0); // positive gradY means flow downward in row index

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

              // Arrowhead
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

    // 6. Render Road Network Corridors
    if (activeLayers.roads) {
      for (const road of dataset.criticalRoads) {
        if (road.gridCells.length < 2) continue;

        ctx.beginPath();
        for (let i = 0; i < road.gridCells.length; i++) {
          const [r, c] = road.gridCells[i];
          const px = originX + (c + 0.5) * cellSize;
          const py = originY + (r + 0.5) * cellSize;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }

        // Highlight road status based on water depth
        let maxWaterOnRoad = 0;
        for (const [r, c] of road.gridCells) {
          const d = waterDepth[r * nx + c] || 0;
          if (d > maxWaterOnRoad) maxWaterOnRoad = d;
        }

        if (maxWaterOnRoad >= 0.30) {
          // Severely submerged road
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)'; // Red-500
          ctx.lineWidth = 2.5;
        } else if (maxWaterOnRoad >= 0.10) {
          // Warning ponding
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)'; // Amber-500
          ctx.lineWidth = 2.0;
        } else {
          // Passable road
          ctx.strokeStyle = road.highwayType === 'primary' ? 'rgba(248, 250, 252, 0.60)' : 'rgba(148, 163, 184, 0.45)';
          ctx.lineWidth = road.highwayType === 'primary' ? 1.8 : 1.2;
        }

        ctx.stroke();
      }
    }

    // 7. Render Modelled Drainage Inlets (Culverts & Sump)
    if (activeLayers.drainage) {
      for (const inlet of dataset.modelledDrainageInlets) {
        const [r, c] = inlet.gridCell;
        const px = originX + (c + 0.5) * cellSize;
        const py = originY + (r + 0.5) * cellSize;

        // Outer glow
        ctx.fillStyle = 'rgba(6, 182, 212, 0.25)'; // Cyan glow
        ctx.beginPath();
        ctx.arc(px, py, cellSize * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Core marker (diamond shape)
        ctx.fillStyle = '#06b6d4'; // Cyan-500
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py - 4);
        ctx.lineTo(px + 4, py);
        ctx.lineTo(px, py + 4);
        ctx.lineTo(px - 4, py);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // 8. Render 5 Critical Medical Facilities
    if (activeLayers.facilities) {
      for (const fac of dataset.criticalFacilities) {
        const [r, c] = fac.gridCell;
        const px = originX + (c + 0.5) * cellSize;
        const py = originY + (r + 0.5) * cellSize;

        // Facility Marker
        ctx.fillStyle = fac.emergency ? '#ef4444' : '#3b82f6';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;

        // Medical Badge
        const bSize = 6;
        ctx.fillRect(px - bSize, py - bSize, bSize * 2, bSize * 2);
        ctx.strokeRect(px - bSize, py - bSize, bSize * 2, bSize * 2);

        // White cross inside badge
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 1, py - 3.5, 2, 7);
        ctx.fillRect(px - 3.5, py - 1, 7, 2);

        // Facility Name Label
        ctx.font = '10px monospace';
        ctx.fillStyle = '#f8fafc';
        const label = fac.name.replace('Beth Israel Deaconess Medical Center', 'BIDMC').replace(' Hospital', '');
        ctx.fillText(label, px + 9, py + 3);
      }
    }

    // 9. Render Hovered & Selected Cell Reticle
    const activeCell = selectedCell || internalHover;
    if (activeCell) {
      const { row, col } = activeCell;
      if (row >= 0 && row < ny && col >= 0 && col < nx) {
        const px = originX + col * cellSize;
        const py = originY + row * cellSize;

        // Highlight Cell Boundary
        ctx.strokeStyle = '#f97316'; // Safety orange
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px, py, cellSize, cellSize);

        // Crosshairs extending to borders
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

    // 10. Draw Computational Boundary Frame & Spatial Metadata
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(originX, originY, displaySize, displaySize);

    // Coordinate tick labels on border (EPSG:26986 Projected Meters)
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
    const scaleBarM = 400; // 400 meters
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

    // Scale ticks
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
    dataset,
    getElevationColor,
    nx,
    ny,
    satelliteImage,
    waterDepth,
    internalHover,
    selectedCell,
    xmin,
    xmax,
    ymin,
    ymax,
  ]);

  // Handle Mouse Events for Hover and Selection
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
    if (!canvas || !onCellClick) return;

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
        const info = getCellInfo(row, col);
        onCellClick(info);
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

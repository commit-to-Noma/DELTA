/**
 * DELTA Compact Geospatial Layer Control Dock
 *
 * Restrained engineering toolbar providing direct toggles for simulation overlays,
 * physical assets, and operational staging markers without obscuring the map viewport.
 */

import React from 'react';
import { Layers } from 'lucide-react';
import type { CanvasLayerVisibility } from './GeographicSimulationCanvas';

interface LayerOption {
  key: keyof CanvasLayerVisibility;
  label: string;
  accent?: string;
}

const DEFAULT_LAYER_OPTIONS: LayerOption[] = [
  { key: 'satellite', label: 'Satellite' },
  { key: 'terrain', label: 'DEM Relief' },
  { key: 'contours', label: 'Contours' },
  { key: 'water', label: 'Flood Depth', accent: 'cyan' },
  { key: 'vectors', label: 'Flow Vectors' },
  { key: 'roads', label: 'Roads' },
  { key: 'facilities', label: 'Hospitals' },
  { key: 'drainage', label: 'Drainage' },
  { key: 'workOrders', label: 'Work Orders', accent: 'emerald' },
  { key: 'adversePonding', label: 'Adverse Rise', accent: 'amber' },
  { key: 'legend', label: 'Legend' }
];

interface CanvasLayerDockProps {
  activeLayers: CanvasLayerVisibility;
  onToggleLayer: (layer: keyof CanvasLayerVisibility) => void;
  visibleKeys?: (keyof CanvasLayerVisibility)[];
  compact?: boolean;
}

export const CanvasLayerDock: React.FC<CanvasLayerDockProps> = ({
  activeLayers,
  onToggleLayer,
  visibleKeys,
  compact = false
}) => {
  const options = visibleKeys
    ? DEFAULT_LAYER_OPTIONS.filter((o) => visibleKeys.includes(o.key))
    : DEFAULT_LAYER_OPTIONS;

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 bg-onyx-950/90 border border-onyx-800 rounded px-2.5 ${
        compact ? 'py-1.5' : 'py-2'
      }`}
    >
      <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-storm-400 mr-1">
        <Layers className="w-3 h-3 text-safety-orange" />
        Layers
      </span>
      {options.map((opt) => {
        const isActive = opt.key === 'legend' || opt.key === 'workOrders' || opt.key === 'adversePonding'
          ? activeLayers[opt.key] !== false
          : Boolean(activeLayers[opt.key]);

        let activeStyle = 'bg-onyx-800 border-storm-500 text-white';
        if (opt.accent === 'cyan') activeStyle = 'bg-cyan-950/80 border-cyan-500/70 text-cyan-200';
        else if (opt.accent === 'emerald') activeStyle = 'bg-emerald-950/80 border-emerald-500/70 text-emerald-200';
        else if (opt.accent === 'amber') activeStyle = 'bg-amber-950/80 border-amber-500/70 text-amber-200';

        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onToggleLayer(opt.key)}
            aria-pressed={isActive}
            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
              isActive
                ? activeStyle
                : 'bg-onyx-900/60 border-onyx-800 text-storm-500 hover:text-storm-300 hover:border-onyx-700'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

import React, { useState } from 'react';
import { TerrainContourCanvas } from '../../terrain/TerrainContourCanvas';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Info,
  Clock
} from 'lucide-react';

export const FloodSimulationView: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [timeStep, setTimeStep] = useState<number>(45); // minutes into storm
  const [activeLayers, setActiveLayers] = useState<{
    contours: boolean;
    vectors: boolean;
    drains: boolean;
    hospital: boolean;
  }>({
    contours: true,
    vectors: true,
    drains: true,
    hospital: true,
  });

  const toggleLayer = (layer: keyof typeof activeLayers) => {
    setActiveLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  return (
    <div className="space-y-4">
      {/* Developmental Status Bar */}
      <div className="bg-onyx-900 border-l-4 border-hydro-500 p-3.5 rounded-r border-y border-r border-onyx-800 flex items-center justify-between font-mono text-xs text-storm-300">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-hydro-500 flex-shrink-0" />
          <span>
            PHASE 0 WORKSPACE SHELL // 64x64 HYDRAULIC SOLVER IS CURRENTLY SCHEDULED FOR PHASE 1.
          </span>
        </div>
        <span className="hidden md:inline px-2 py-0.5 rounded bg-onyx-950 border border-onyx-800 text-[10px] text-storm-400">
          WATER-BALANCE INVARIANT PENDING NUMERICAL CALIBRATION
        </span>
      </div>

      {/* Main Simulation Viewport & Side Telemetry Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left / Center: Interactive Map-Oriented Canvas Workspace */}
        <div className="lg:col-span-8 bg-onyx-900 rounded border border-onyx-800 overflow-hidden shadow-tactical flex flex-col h-[580px]">
          {/* Viewport Top Bar */}
          <div className="bg-onyx-950 px-4 py-2.5 border-b border-onyx-800 flex items-center justify-between text-xs font-mono text-storm-300">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-storm-100">
                DISTRICT ALPHA // TOPOGRAPHIC & DRAINAGE GRID
              </span>
              <span className="text-onyx-700">|</span>
              <span className="text-storm-500">SCALE: 1:5000</span>
            </div>

            {/* Layer Toggles */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => toggleLayer('contours')}
                className={`px-2 py-1 rounded text-[10px] transition-colors ${
                  activeLayers.contours
                    ? 'bg-onyx-800 text-storm-100 border border-onyx-700'
                    : 'text-storm-500 hover:text-storm-300'
                }`}
              >
                CONTOURS
              </button>
              <button
                onClick={() => toggleLayer('vectors')}
                className={`px-2 py-1 rounded text-[10px] transition-colors ${
                  activeLayers.vectors
                    ? 'bg-onyx-800 text-blue-300 border border-hydro-500/40'
                    : 'text-storm-500 hover:text-storm-300'
                }`}
              >
                FLOW VECTORS
              </button>
              <button
                onClick={() => toggleLayer('hospital')}
                className={`px-2 py-1 rounded text-[10px] transition-colors ${
                  activeLayers.hospital
                    ? 'bg-onyx-800 text-purple-300 border border-purple-500/40'
                    : 'text-storm-500 hover:text-storm-300'
                }`}
              >
                HOSPITAL ARTERY
              </button>
            </div>
          </div>

          {/* Interactive Canvas */}
          <div className="flex-1 relative bg-onyx-950 overflow-hidden">
            <TerrainContourCanvas className="w-full h-full" showCoordinates={true} />

            {/* Hospital Artery Overlay Marker */}
            {activeLayers.hospital && (
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex flex-col items-center">
                <div className="px-2.5 py-1 rounded bg-purple-950/90 border border-purple-500 text-purple-200 text-[10px] font-mono shadow-tactical flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                  <span>ST. JUDE TRAUMA ARTERY (CRITICAL)</span>
                </div>
                <div className="w-[1px] h-8 bg-purple-500/60" />
              </div>
            )}
          </div>

          {/* Bottom Storm Hydrograph Timeline Controller */}
          <div className="bg-onyx-950 px-4 py-3 border-t border-onyx-800 flex items-center gap-4 text-xs font-mono">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 rounded bg-safety-orange hover:bg-safety-hover text-white flex items-center justify-center flex-shrink-0 transition-colors shadow-tactical"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <button
              onClick={() => setTimeStep(0)}
              className="w-8 h-8 rounded bg-onyx-850 hover:bg-onyx-800 text-storm-300 flex items-center justify-center flex-shrink-0 border border-onyx-700"
              title="Reset Timeline to T=0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-storm-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-safety-orange" />
                  <span>STORM ELAPSED: T+{timeStep} MIN</span>
                </span>
                <span>PEAK RAINFALL INTENSITY: 42 mm/hr (T+60 MIN)</span>
                <span>DURATION: 360 MIN (6 HRS)</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={timeStep}
                onChange={(e) => setTimeStep(Number(e.target.value))}
                className="w-full accent-safety-orange cursor-pointer h-1.5 bg-onyx-800 rounded"
              />
            </div>
          </div>
        </div>

        {/* Right: Operational Telemetry & Sensor Rack */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-onyx-900 rounded border border-onyx-800 p-5 shadow-tactical space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-onyx-800 text-storm-400">
              <span className="font-bold text-storm-200">TELEMETRY MONITOR</span>
              <span className="text-[10px] text-emerald-400">REALTIME FEEDS</span>
            </div>

            <div className="space-y-3">
              <div className="bg-onyx-950 p-3 rounded border border-onyx-800">
                <div className="flex justify-between text-storm-400 text-[10px] mb-1">
                  <span>NET SURFACE RUNOFF INFLOW</span>
                  <span className="text-storm-200 font-bold">14,250 m³/hr</span>
                </div>
                <div className="w-full bg-onyx-900 h-1.5 rounded overflow-hidden">
                  <div className="bg-hydro-500 h-full w-2/3" />
                </div>
              </div>

              <div className="bg-onyx-950 p-3 rounded border border-onyx-800">
                <div className="flex justify-between text-storm-400 text-[10px] mb-1">
                  <span>CULVERT DISCHARGE EFFICIENCY</span>
                  <span className="text-amber-400 font-bold">78.4% (Nominal)</span>
                </div>
                <div className="w-full bg-onyx-900 h-1.5 rounded overflow-hidden">
                  <div className="bg-amber-500 h-full w-3/4" />
                </div>
              </div>

              <div className="bg-onyx-950 p-3 rounded border border-onyx-800">
                <div className="flex justify-between text-storm-400 text-[10px] mb-1">
                  <span>HOSPITAL ACCESS ROAD WATER DEPTH</span>
                  <span className="text-emerald-400 font-bold">11.4 cm (Passable)</span>
                </div>
                <div className="w-full bg-onyx-900 h-1.5 rounded overflow-hidden">
                  <div className="bg-emerald-500 h-full w-1/4" />
                </div>
                <span className="text-[9px] text-storm-500 block mt-1">
                  Alert Trigger Threshold: 25.0 cm
                </span>
              </div>
            </div>

            <div className="pt-2">
              <div className="text-[10px] text-storm-500 uppercase mb-2">RUNOFF VECTOR MODEL</div>
              <div className="p-3 bg-onyx-950 rounded border border-onyx-800/80 text-[11px] text-storm-300 font-sans leading-relaxed">
                2D Manning overland equation coupled to culvert backpressure constraints. Verifiable against standard hydrograph bench cases.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

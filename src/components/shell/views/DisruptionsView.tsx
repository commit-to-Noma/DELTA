import React, { useState } from 'react';
import { 
  AlertOctagon, 
  RefreshCw, 
  CheckCircle2, 
  RotateCcw, 
  Sliders, 
  Sparkles 
} from 'lucide-react';

interface DisruptionItem {
  id: string;
  name: string;
  type: 'CULVERT_CLOG' | 'ROAD_CLOSURE' | 'PUMP_FAILURE';
  location: string;
  hydraulicImpact: string;
  active: boolean;
}

export const DisruptionsView: React.FC = () => {
  const [disruptions, setDisruptions] = useState<DisruptionItem[]>([
    {
      id: 'drain-b',
      name: 'Culvert Outfall 14 (Drain B) Debris Blockage',
      type: 'CULVERT_CLOG',
      location: 'Sector 02 // North Canal Confluence',
      hydraulicImpact: '+18 cm backwater rise along St. Jude Emergency Artery',
      active: false,
    },
    {
      id: 'road-9',
      name: 'Valley Road Route 9 Embankment Slump',
      type: 'ROAD_CLOSURE',
      location: 'Sector 04 // Highway Underpass',
      hydraulicImpact: 'Traps eastbound traffic; diverts 400 vehicles/hr to secondary feeder',
      active: false,
    },
    {
      id: 'pump-2',
      name: 'Stormwater Sump Pump #2 Electrical Trip',
      type: 'PUMP_FAILURE',
      location: 'Sector 01 // Hospital Retention Basin',
      hydraulicImpact: '-1,200 m³/hr discharge capacity loss',
      active: false,
    },
  ]);

  const toggleDisruption = (id: string) => {
    setDisruptions((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, active: !item.active };
        }
        return item;
      })
    );
  };

  const resetAllDisruptions = () => {
    setDisruptions((prev) => prev.map((d) => ({ ...d, active: false })));
  };

  const activeCount = disruptions.filter((d) => d.active).length;

  return (
    <div className="space-y-6">
      {/* Notice */}
      <div className="bg-onyx-900 border-l-4 border-safety-orange p-4 rounded-r border-y border-r border-onyx-800 flex items-start gap-3">
        <AlertOctagon className="w-5 h-5 text-safety-orange flex-shrink-0 mt-0.5" />
        <div className="text-xs font-mono text-storm-300 space-y-1">
          <div className="font-bold text-storm-100 uppercase tracking-wider">
            SCENARIO DISRUPTION INJECTOR // THE DEMO CENTREPIECE
          </div>
          <p className="text-storm-300 font-sans">
            Triggering mid-storm disruptions forces DELTA to rerun its hydraulic model across the terrain. When conditions shift unexpectedly, DELTA adapts its recommendations and signals Rovo to explain the new tactical priority.
          </p>
        </div>
      </div>

      {/* Disruption Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-lg text-storm-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-safety-orange" />
              <span>Available Tactical Injections</span>
            </h3>

            {activeCount > 0 && (
              <button
                onClick={resetAllDisruptions}
                className="flex items-center gap-1.5 text-xs font-mono text-storm-400 hover:text-storm-200 bg-onyx-900 px-2.5 py-1 rounded border border-onyx-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>CLEAR DISRUPTIONS</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {disruptions.map((item) => (
              <div
                key={item.id}
                className={`p-5 rounded border transition-all ${
                  item.active
                    ? 'bg-safety-muted border-safety-orange shadow-safety'
                    : 'bg-onyx-900 border-onyx-800 hover:border-onyx-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-storm-400">
                    TYPE: {item.type.replace(/_/g, ' ')}
                  </span>
                  <button
                    onClick={() => toggleDisruption(item.id)}
                    className={`font-mono text-xs px-3 py-1 rounded transition-colors ${
                      item.active
                        ? 'bg-safety-orange text-white font-bold'
                        : 'bg-onyx-800 text-storm-300 hover:bg-onyx-700'
                    }`}
                  >
                    {item.active ? 'TRIGGERED (ACTIVE)' : 'INJECT DISRUPTION'}
                  </button>
                </div>

                <h4 className="font-display font-bold text-base text-storm-100 mb-1">
                  {item.name}
                </h4>
                <div className="font-mono text-xs text-storm-400 mb-2">{item.location}</div>
                <div className="text-xs font-mono text-safety-orange bg-onyx-950/60 p-2 rounded border border-onyx-800/80">
                  IMPACT: {item.hydraulicImpact}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Replanning Preview Panel */}
        <div className="lg:col-span-5 bg-onyx-900 rounded border border-onyx-800 p-5 shadow-tactical flex flex-col justify-between font-mono text-xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-onyx-800 text-storm-400 mb-4">
              <span className="font-bold text-storm-200">REPLANNING MONITOR</span>
              <span className={activeCount > 0 ? 'text-safety-orange animate-pulse' : 'text-emerald-400'}>
                {activeCount > 0 ? `${activeCount} ANOMALIES ACTIVE` : 'BASELINE INTACT'}
              </span>
            </div>

            {activeCount === 0 ? (
              <div className="p-8 text-center text-storm-500 font-sans">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-3" />
                <p className="font-semibold text-storm-300 text-sm mb-1">Standard Baseline Active</p>
                <p className="text-xs">
                  Inject a disruption (such as Culvert Outfall 14 clog) on the left to watch DELTA recompute hydraulic propagation and trigger a replanning response.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded bg-onyx-950 border border-safety-border">
                  <div className="flex items-center gap-2 text-safety-orange font-bold text-xs mb-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>HYDRAULIC REDISTRIBUTION DETECTED</span>
                  </div>
                  <p className="text-storm-300 font-sans text-xs leading-relaxed">
                    Culvert obstruction creates backwater flooding along the main corridor. The original plan (Clearing Drain A) is no longer optimal.
                  </p>
                </div>

                <div className="p-4 rounded bg-purple-950/40 border border-purple-800/60 text-storm-200 font-sans text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-purple-300 font-mono font-bold text-[11px]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>ROVO ADAPTIVE BRIEF</span>
                  </div>
                  <p>
                    "Because Drain B is clogged, water is pooling along St. Jude Avenue. I recommend immediate diversion of Crew #4 to <strong>Clear Culvert 14</strong> and deploy <strong>Emergency Barrier #3</strong>. This will restore hospital access 14 minutes faster."
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-onyx-800 text-[11px] text-storm-500">
            ENGINE STATUS: REAL-TIME EVENT REACTOR READY
          </div>
        </div>
      </div>
    </div>
  );
};

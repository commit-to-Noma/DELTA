import React, { useState } from 'react';
import { 
  Layers, 
  AlertOctagon, 
  HeartHandshake, 
  Sparkles, 
  FileCheck, 
  RotateCcw,
  CheckCircle2,
  Lock,
  ExternalLink,
  Info
} from 'lucide-react';

export const InteractiveFeatureWorkbench: React.FC = () => {
  const [activeModuleId, setActiveModuleId] = useState<string>('district');
  const [simulatedBlockage, setSimulatedBlockage] = useState<boolean>(false);
  const [replannedStep, setReplannedStep] = useState<boolean>(false);

  const resetReplanningDemo = () => {
    setSimulatedBlockage(false);
    setReplannedStep(false);
  };

  const triggerBlockage = () => {
    setSimulatedBlockage(true);
    setTimeout(() => {
      setReplannedStep(true);
    }, 400);
  };

  return (
    <section id="features" className="py-20 bg-onyx-950 border-b border-onyx-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-safety-orange tracking-widest uppercase mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-safety-orange" />
              <span>02 // OPERATIONAL ARCHITECTURE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-storm-50 tracking-tight">
              Interactive Feature Workbench
            </h2>
          </div>
          <div className="mt-4 md:mt-0 flex items-center gap-2 text-xs font-mono text-storm-400 bg-onyx-900 px-3 py-1.5 rounded border border-onyx-800">
            <Info className="w-3.5 h-3.5 text-safety-orange" />
            <span>SELECT SUBSYSTEM TO INSPECT ARCHITECTURE</span>
          </div>
        </div>

        {/* Tactical Subsystem Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-8">
          {[
            { id: 'district', code: 'MOD-01', label: 'Terrain & Assets', icon: Layers },
            { id: 'disruptions', code: 'MOD-02', label: 'Disruption & Replan', icon: AlertOctagon },
            { id: 'hospital', code: 'MOD-03', label: 'Hospital Access', icon: HeartHandshake },
            { id: 'rovo', code: 'MOD-04', label: 'Rovo Accountable AI', icon: Sparkles },
            { id: 'decision', code: 'MOD-05', label: 'Decision Record & JSM', icon: FileCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeModuleId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveModuleId(tab.id)}
                className={`p-3.5 text-left rounded transition-all duration-150 border flex flex-col justify-between ${
                  isActive
                    ? 'bg-onyx-850 border-safety-orange text-storm-50 shadow-safety'
                    : 'bg-onyx-900 border-onyx-800 text-storm-400 hover:bg-onyx-850 hover:text-storm-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-mono text-[10px] ${isActive ? 'text-safety-orange font-bold' : 'text-storm-500'}`}>
                    {tab.code}
                  </span>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-safety-orange' : 'text-storm-400'}`} />
                </div>
                <div className="font-display font-semibold text-xs tracking-tight">
                  {tab.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Workbench Panel Inspector */}
        <div className="bg-onyx-900 rounded border border-onyx-800 overflow-hidden shadow-tactical">
          {/* Top Panel Bar */}
          <div className="bg-onyx-950 px-5 py-3 border-b border-onyx-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-safety-orange" />
              <span className="text-storm-200 uppercase font-semibold">
                SUBSYSTEM: {activeModuleId.toUpperCase()}
              </span>
              <span className="text-onyx-700">|</span>
              <span className="text-storm-400">SPECIFICATION PREVIEW (ILLUSTRATIVE DEMO STATE)</span>
            </div>
            <div className="text-[11px] text-storm-500 hidden sm:block">
              INTEGRITY LEVEL: NOMINAL
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {/* MODULE 1: Terrain & Infrastructure Grid */}
            {activeModuleId === 'district' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 space-y-4">
                  <div className="font-mono text-xs text-hydro-500 font-semibold tracking-wider">
                    SYNTHETIC DISTRICT MATRIX
                  </div>
                  <h3 className="text-2xl font-display font-bold text-storm-100">
                    High-Resolution Elevation & Hydraulic Connectivity
                  </h3>
                  <p className="text-sm text-storm-300 leading-relaxed font-sans">
                    DELTA maps terrain elevation datums, overland runoff slopes, culverts, storm pumps, and critical infrastructure arteries into an interconnected hydraulic graph.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800">
                      <div className="font-mono text-[10px] text-storm-400">RESOLUTION</div>
                      <div className="font-mono text-sm text-storm-100 font-bold">25m DEM Grid (64×64)</div>
                    </div>
                    <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800">
                      <div className="font-mono text-[10px] text-storm-400">WATER BALANCE</div>
                      <div className="font-mono text-sm text-emerald-400 font-bold">Zero Loss Invariant</div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-onyx-950 p-5 rounded border border-onyx-800/80 font-mono text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-onyx-800 mb-4 text-storm-400">
                    <span>SECTOR: DELTA-CENTRAL-01</span>
                    <span>COORDINATES: 42.3415° N, 71.1080° W (EPSG:26986)</span>
                  </div>
                  
                  {/* Visual Topographic Grid Illustration */}
                  <div className="grid grid-cols-6 gap-2 text-center text-[10px] mb-4">
                    {Array.from({ length: 24 }).map((_, i) => {
                      const elevation = (24 + Math.sin(i) * 12).toFixed(1);
                      const isHospital = i === 14;
                      const isCulvert = i === 8 || i === 19;
                      return (
                        <div
                          key={i}
                          className={`p-2 rounded border flex flex-col justify-between h-14 ${
                            isHospital
                              ? 'bg-purple-950/60 border-purple-500/80 text-purple-200'
                              : isCulvert
                              ? 'bg-blue-950/60 border-blue-500/80 text-blue-200'
                              : 'bg-onyx-900 border-onyx-800 text-storm-400'
                          }`}
                        >
                          <span className="text-[9px] opacity-70">
                            {isHospital ? 'HOSPITAL' : isCulvert ? 'DRAIN' : `Z${i}`}
                          </span>
                          <span className="font-semibold">{elevation}m</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-storm-400 pt-2 border-t border-onyx-800">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" /> Hospital Core Zone
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" /> Storm Water Culvert
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-storm-500" /> Terrain Grid Node
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* MODULE 2: Disruption & The Replanning Moment */}
            {activeModuleId === 'disruptions' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 space-y-4">
                  <div className="font-mono text-xs text-safety-orange font-semibold tracking-wider">
                    THE DEMO CENTREPIECE
                  </div>
                  <h3 className="text-2xl font-display font-bold text-storm-100">
                    In-Flight Dynamic Replanning
                  </h3>
                  <p className="text-sm text-storm-300 leading-relaxed font-sans">
                    You recommend clearing Drain A. Suddenly, Drain B blocks mid-storm. The engine immediately detects hydraulic redistribution, reruns the simulation, and pivots its recommendation to preserve hospital access.
                  </p>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      onClick={triggerBlockage}
                      disabled={simulatedBlockage}
                      className={`font-mono text-xs px-4 py-2.5 rounded font-semibold transition-all border flex items-center gap-2 ${
                        simulatedBlockage
                          ? 'bg-onyx-800 text-storm-500 border-onyx-700 cursor-not-allowed'
                          : 'bg-safety-orange hover:bg-safety-hover text-white border-safety-dark shadow-tactical active:scale-95'
                      }`}
                    >
                      <AlertOctagon className="w-4 h-4" />
                      <span>SIMULATE DRAIN B CLOG</span>
                    </button>

                    {simulatedBlockage && (
                      <button
                        onClick={resetReplanningDemo}
                        className="font-mono text-xs px-3 py-2.5 rounded bg-onyx-850 hover:bg-onyx-800 text-storm-300 border border-onyx-700 flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>RESET</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-7 bg-onyx-950 p-5 rounded border border-onyx-800/80 font-mono text-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-onyx-800 text-storm-400">
                    <span>STATE: {simulatedBlockage ? 'DISRUPTION INJECTED' : 'NOMINAL BASELINE'}</span>
                    <span className={simulatedBlockage ? 'text-safety-orange animate-pulse' : 'text-emerald-400'}>
                      {simulatedBlockage ? 'RECALCULATING HYDRAULICS' : 'ENGINE SYNCED'}
                    </span>
                  </div>

                  {/* Recommendation Card Before / After */}
                  <div className="space-y-3">
                    <div className={`p-4 rounded border transition-all ${
                      simulatedBlockage && replannedStep
                        ? 'bg-onyx-900 border-onyx-800 opacity-50'
                        : 'bg-onyx-900 border-safety-orange/50 shadow-tactical'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-storm-300 font-bold">INITIAL PLAN // INTERVENTION #01</span>
                        <span className="text-[10px] text-storm-400">CONFIDENCE: 94.2%</span>
                      </div>
                      <div className="text-storm-100 font-sans text-sm">
                        Clear Drain A (North Canal Culvert) & Deploy Portable Pump #2
                      </div>
                      <div className="text-storm-400 text-[11px] mt-1 font-mono">
                        Protected: 2,400m road network | Hospital Access Delay: +1.2m
                      </div>
                    </div>

                    {simulatedBlockage && (
                      <div className={`p-4 rounded border transition-all ${
                        replannedStep 
                          ? 'bg-safety-muted border-safety-orange shadow-safety' 
                          : 'bg-onyx-900 border-onyx-800 animate-pulse'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-safety-orange font-bold flex items-center gap-1.5">
                            <AlertOctagon className="w-3.5 h-3.5" />
                            <span>DYNAMIC REPLAN // INTERVENTION #02 RE-EVALUATED</span>
                          </span>
                          <span className="text-[10px] text-safety-orange font-bold">ADAPTED ADVICE</span>
                        </div>
                        <div className="text-storm-50 font-sans text-sm font-medium">
                          Reroute Crew: Clear Drain C (Eastern Bypass) & Erect Flood Barrier #4
                        </div>
                        <div className="text-storm-300 text-[11px] mt-1 font-mono">
                          Cause: Drain B failure created backpressure on St. Jude Avenue. Rerouting prevents complete hospital isolation.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* MODULE 3: Hospital Access & Risk Index */}
            {activeModuleId === 'hospital' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 space-y-4">
                  <div className="font-mono text-xs text-purple-400 font-semibold tracking-wider">
                    CRITICAL INFRASTRUCTURE METRICS
                  </div>
                  <h3 className="text-2xl font-display font-bold text-storm-100">
                    Hospital Arteries & Casualty Evacuation Corridors
                  </h3>
                  <p className="text-sm text-storm-300 leading-relaxed font-sans">
                    DELTA evaluates flood depth not just as generic water levels, but specifically as <strong className="text-storm-100">Emergency Route Viability</strong>. Water depths over 25cm render standard emergency vehicles impassable.
                  </p>
                  <div className="p-3 bg-onyx-950 rounded border border-onyx-800 text-xs font-mono text-storm-300">
                    <span className="text-purple-400 font-bold">PRIMARY CRITERIA:</span> Zero hospital isolation throughout the entire 100-year storm hydrograph duration.
                  </div>
                </div>

                <div className="lg:col-span-7 bg-onyx-950 p-5 rounded border border-onyx-800/80 font-mono text-xs space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-onyx-800 text-storm-400">
                    <span>EMERGENCY CORRIDOR AUDIT</span>
                    <span>THRESHOLD: &gt; 25CM IMPASSABLE</span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { route: 'Corridor 01 (St. Jude North Arterial)', depth: '12 cm', status: 'PASSABLE', color: 'text-emerald-400', bar: 'w-1/4 bg-emerald-500' },
                      { route: 'Corridor 02 (Valley Underpass Route 9)', depth: '38 cm', status: 'INUNDATED / CLOSED', color: 'text-red-400', bar: 'w-4/5 bg-red-500' },
                      { route: 'Corridor 03 (Civic Center Parkway)', depth: '22 cm', status: 'AT RISK (CRITICAL)', color: 'text-amber-400', bar: 'w-1/2 bg-amber-500' },
                    ].map((c, idx) => (
                      <div key={idx} className="p-3 bg-onyx-900 rounded border border-onyx-800">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-storm-200 font-semibold">{c.route}</span>
                          <span className={`text-[10px] font-bold ${c.color}`}>{c.status}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-onyx-950 h-2 rounded overflow-hidden">
                            <div className={`h-full ${c.bar}`} />
                          </div>
                          <span className="text-[11px] text-storm-300 font-bold">{c.depth}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* MODULE 4: Atlassian Rovo Accountable AI */}
            {activeModuleId === 'rovo' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 space-y-4">
                  <div className="font-mono text-xs text-purple-400 font-semibold tracking-wider">
                    EXPLAINABLE AI WITHOUT HALLUCINATIONS
                  </div>
                  <h3 className="text-2xl font-display font-bold text-storm-100">
                    The Engine Calculates. Rovo Explains.
                  </h3>
                  <p className="text-sm text-storm-300 leading-relaxed font-sans">
                    DELTA strictly separates computation from generation. The deterministic hydraulic simulation calculates water balances and flood depths; <strong className="text-storm-100">Atlassian Rovo</strong> synthesizes the causal physics into plain-language actionable briefs for human commanders.
                  </p>
                  <div className="font-mono text-xs text-storm-400 bg-onyx-950 p-3 rounded border border-onyx-800">
                    Rovo will never automatically approve a plan or create tasks without an explicit human command.
                  </div>
                </div>

                <div className="lg:col-span-7 bg-onyx-950 p-5 rounded border border-onyx-800/80 font-mono text-xs space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-onyx-800 text-storm-400">
                    <span className="flex items-center gap-1.5 text-purple-400 font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>ATLASSIAN ROVO VIRTUAL AGENT</span>
                    </span>
                    <span className="text-[10px] bg-purple-950 px-2 py-0.5 rounded text-purple-300 border border-purple-800">
                      CORE AGENT MODULE
                    </span>
                  </div>

                  <div className="bg-onyx-900 p-4 rounded border border-onyx-800 font-sans text-sm text-storm-200 leading-relaxed space-y-3">
                    <p>
                      <strong>Rovo Assessment Summary:</strong>
                    </p>
                    <p className="text-storm-300">
                      "I compared 4 candidate interventions against the baseline storm profile. Deploying <strong>Intervention Beta (East Canal Siphon Activation)</strong> provides the highest net protection for the hospital access corridor."
                    </p>
                    <div className="bg-onyx-950 p-3 rounded border border-onyx-800 font-mono text-xs text-storm-300 space-y-1">
                      <div>• Net Inundation Avoided: <strong>-48,000 m³</strong></div>
                      <div>• St. Jude Ambulance Transit Delay: <strong>Reduced from +18m to +2m</strong></div>
                      <div>• Required Field Crew: <strong>Public Works Unit #4</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODULE 5: Decision Record & JSM */}
            {activeModuleId === 'decision' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 space-y-4">
                  <div className="font-mono text-xs text-emerald-400 font-semibold tracking-wider">
                    CLOSED LOOP AUDIT & DISPATCH
                  </div>
                  <h3 className="text-2xl font-display font-bold text-storm-100">
                    Append-Only Decision Records into Jira Service Management
                  </h3>
                  <p className="text-sm text-storm-300 leading-relaxed font-sans">
                    Once the human commander confirms an intervention, DELTA locks an immutable cryptographic Decision Record containing the storm seed, telemetry, simulation delta, and authorizing officer. It instantly dispatches a dispatch ticket to Jira Service Management.
                  </p>
                  <div className="flex items-center gap-2 font-mono text-xs text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Real Work in Jira, Not Screenshots</span>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-onyx-950 p-5 rounded border border-onyx-800/80 font-mono text-xs space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-onyx-800 text-storm-400">
                    <span className="flex items-center gap-1.5 text-storm-200 font-bold">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>IMMUTABLE AUDIT LEDGER // DECISION #DEC-2026-081</span>
                    </span>
                    <span className="text-emerald-400">STATUS: APPROVED & DISPATCHED</span>
                  </div>

                  <div className="bg-onyx-900 p-4 rounded border border-onyx-800 space-y-2">
                    <div className="flex justify-between text-storm-400">
                      <span>TIMESTAMP:</span>
                      <span className="text-storm-200">2026-11-24T07:18:22Z</span>
                    </div>
                    <div className="flex justify-between text-storm-400">
                      <span>DECISION AUTHOR:</span>
                      <span className="text-storm-200">Commander J. Vance (Incident Incident Lead)</span>
                    </div>
                    <div className="flex justify-between text-storm-400">
                      <span>JSM DISPATCH TICKET:</span>
                      <span className="text-safety-orange font-bold flex items-center gap-1">
                        JSM-4902 <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                    <div className="flex justify-between text-storm-400">
                      <span>WATER BALANCE DELTA:</span>
                      <span className="text-emerald-400 font-bold">-48,200 m³ peak discharge</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

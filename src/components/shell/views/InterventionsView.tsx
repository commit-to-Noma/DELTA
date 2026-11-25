import React, { useState } from 'react';
import { 
  BarChart3, 
  Sparkles, 
  Info,
  UserCheck
} from 'lucide-react';

interface CandidateIntervention {
  id: string;
  code: string;
  title: string;
  summary: string;
  resourceCost: string;
  targetInfrastructure: string;
  differentialStatus: string;
  status: 'RECOMMENDED' | 'VIABLE' | 'SUB_OPTIMAL';
}

interface InterventionsViewProps {
  onNavigateToDecisions: () => void;
}

export const InterventionsView: React.FC<InterventionsViewProps> = ({ onNavigateToDecisions: _onNavigateToDecisions }) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan-beta');

  const candidates: CandidateIntervention[] = [
    {
      id: 'plan-beta',
      code: 'INT-02-CANAL',
      title: 'Plan Beta: Clear North Canal Culvert & Deploy High-Capacity Pump #1',
      summary: 'Targets primary choke point feeding the lower hospital corridor. Siphons discharge into secondary retention pond.',
      resourceCost: '1 Crew • 1 Mobile Pump Unit',
      targetInfrastructure: 'Brookline Ave / Muddy River North Culvert',
      differentialStatus: 'Pending Phase 3 Multi-Scenario Run',
      status: 'RECOMMENDED',
    },
    {
      id: 'plan-alpha',
      code: 'INT-01-SAND',
      title: 'Plan Alpha: Sandbag Perimeter along Francis St Ambulance Route',
      summary: 'Erects temporary physical deflection barriers along low elevation curb cuts to deflect sheet flow.',
      resourceCost: '3 Crews • 1,200 Sandbags',
      targetInfrastructure: 'Francis St Ambulance Bay (OSM Way 1377084984)',
      differentialStatus: 'Pending Phase 3 Multi-Scenario Run',
      status: 'VIABLE',
    },
    {
      id: 'plan-gamma',
      code: 'INT-03-SLUICE',
      title: 'Plan Gamma: Early Estuary Sluice Gate Pre-Release',
      summary: 'Lowers water table prior to peak rainfall. Effective only if gravity discharge is viable.',
      resourceCost: 'Remote SCADA Command',
      targetInfrastructure: 'Muddy River Estuary Tide Gates',
      differentialStatus: 'Pending Phase 3 Multi-Scenario Run',
      status: 'SUB_OPTIMAL',
    },
  ];

  const selectedPlan = candidates.find((c) => c.id === selectedPlanId) || candidates[0];

  return (
    <div className="space-y-6">
      {/* Notice */}
      <div className="bg-onyx-900 border-l-4 border-onyx-700 p-4 rounded-r border-y border-r border-onyx-800 flex items-start gap-3">
        <Info className="w-5 h-5 text-storm-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs font-mono text-storm-300 space-y-1">
          <div className="font-bold text-storm-100 uppercase tracking-wider">
            NORMALIZED INTERVENTION SCORING MATRIX (TRUTH GATE: PHASE 3 SPECIFICATION)
          </div>
          <p className="text-storm-300 font-sans">
            Every candidate fix must be simulated against the <strong>identical storm hydrograph</strong>. Differential metrics (inundation delta, hospital transit delay) are strictly computed by the 2D solver in Phase 3 rather than hardcoded literals.
          </p>
        </div>
      </div>

      {/* Baseline Comparison Summary (Truth Gate Compliant) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-onyx-900 p-4 rounded border border-onyx-800 font-mono text-xs">
          <span className="text-[10px] text-storm-400 uppercase block font-bold">
            1. BENCHMARK STORM BASELINE
          </span>
          <div className="text-lg font-bold text-storm-100 mt-1">NOAA Atlas 14 50-Year</div>
          <div className="text-storm-400 text-[11px] mt-1 font-sans">
            104.2 mm Total Depth • 6-Hour Duration Profile
          </div>
        </div>

        <div className="bg-onyx-900 p-4 rounded border border-onyx-800 font-mono text-xs">
          <span className="text-[10px] text-storm-400 uppercase block font-bold">
            2. MULTI-PLAN SOLVER PIPELINE
          </span>
          <div className="text-lg font-bold text-storm-100 mt-1">3 Candidate Interventions</div>
          <div className="text-storm-400 text-[11px] mt-1 font-sans">
            Differential Hydrodynamics Pending Phase 3 Execution
          </div>
        </div>

        <div className="bg-onyx-900 p-4 rounded border border-onyx-800 font-mono text-xs">
          <span className="text-[10px] text-storm-400 uppercase block font-bold">
            3. DECISION GOVERNANCE
          </span>
          <div className="text-lg font-bold text-storm-100 mt-1">Incident Commander</div>
          <div className="text-storm-400 text-[11px] mt-1 font-sans">
            Human-in-the-loop authorization gate enforced
          </div>
        </div>
      </div>

      {/* Candidate Selector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-3">
          <h3 className="font-display font-semibold text-lg text-storm-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-safety-orange" />
            <span>Candidate Intervention Proposals</span>
          </h3>

          {candidates.map((c) => {
            const isSelected = c.id === selectedPlanId;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedPlanId(c.id)}
                className={`p-5 rounded border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-onyx-850 border-safety-orange shadow-safety'
                    : 'bg-onyx-900 border-onyx-800 hover:border-onyx-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-storm-400">{c.code}</span>
                  <span
                    className={`font-mono text-[9px] px-2 py-0.5 rounded ${
                      c.status === 'RECOMMENDED'
                        ? 'bg-onyx-800 text-storm-200 border border-onyx-700 font-bold'
                        : 'bg-onyx-950 text-storm-400 border border-onyx-800'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                <h4 className="font-display font-bold text-base text-storm-100 mb-1">{c.title}</h4>
                <p className="text-xs text-storm-300 font-sans mb-3">{c.summary}</p>

                <div className="pt-3 border-t border-onyx-800 flex flex-wrap items-center justify-between font-mono text-[11px] gap-2">
                  <span className="text-storm-300">{c.targetInfrastructure}</span>
                  <span className="text-storm-400">{c.resourceCost}</span>
                  <span className="text-storm-500 font-bold">{c.differentialStatus}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Plan Action Card */}
        <div className="lg:col-span-5 bg-onyx-900 rounded border border-onyx-800 p-6 shadow-tactical flex flex-col justify-between font-mono text-xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-onyx-800 text-storm-400">
              <span className="font-bold text-storm-200 uppercase">PLAN REVIEW // {selectedPlan.code}</span>
              <span className="text-storm-400 font-bold">PHASE 3 STAGING</span>
            </div>

            <div className="bg-onyx-950 p-4 rounded border border-onyx-800 font-sans text-xs text-storm-200 space-y-2">
              <div className="flex items-center gap-1.5 text-storm-300 font-mono font-bold text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-storm-400" />
                <span>ROVO REASONING SPECIFICATION</span>
              </div>
              <p className="text-storm-300">
                In Phase 3, Rovo Hydraulic Advisor explains the comparative physical differences between candidate plans using real hydrodynamic delta runs computed against the standardized baseline storm.
              </p>
            </div>

            <div className="bg-onyx-950 p-4 rounded border border-onyx-800 space-y-2 text-[11px]">
              <div className="flex justify-between text-storm-400">
                <span>TARGET ARTERY:</span>
                <span className="text-storm-200 font-bold">{selectedPlan.targetInfrastructure}</span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>RESOURCE BURDEN:</span>
                <span className="text-storm-300">{selectedPlan.resourceCost}</span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>SOLVER STATUS:</span>
                <span className="text-storm-500 font-bold">{selectedPlan.differentialStatus}</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-onyx-800 space-y-3">
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 bg-onyx-850 text-storm-500 font-mono text-xs font-semibold py-3 px-4 rounded border border-onyx-700 cursor-not-allowed shadow-tactical"
            >
              <UserCheck className="w-4 h-4" />
              <span>NOT IMPLEMENTED (NEEDS PHASE 3 SOLVER RUN)</span>
            </button>
            <div className="text-[10px] text-storm-500 text-center font-mono">
              Multi-scenario differential simulation across candidate interventions executes in Phase 3.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

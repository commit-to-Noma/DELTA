import React, { useState } from 'react';
import { 
  BarChart3, 
  Sparkles, 
  ArrowRight, 
  Info,
  UserCheck
} from 'lucide-react';

interface CandidateIntervention {
  id: string;
  code: string;
  title: string;
  summary: string;
  resourceCost: string;
  inundationReduction: string;
  hospitalDelayMinutes: number;
  confidenceScore: number;
  status: 'RECOMMENDED' | 'VIABLE' | 'SUB_OPTIMAL';
}

interface InterventionsViewProps {
  onNavigateToDecisions: () => void;
}

export const InterventionsView: React.FC<InterventionsViewProps> = ({ onNavigateToDecisions }) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan-beta');

  const candidates: CandidateIntervention[] = [
    {
      id: 'plan-beta',
      code: 'INT-02-CANAL',
      title: 'Plan Beta: Clear North Canal Culvert & Deploy High-Capacity Pump #1',
      summary: 'Targets primary choke point feeding the lower hospital corridor. Siphons 3,800 m³/hr into secondary retention pond.',
      resourceCost: '1 Crew • 1 Mobile Pump Unit',
      inundationReduction: '-46.2% Peak Volume',
      hospitalDelayMinutes: 2.1,
      confidenceScore: 94.8,
      status: 'RECOMMENDED',
    },
    {
      id: 'plan-alpha',
      code: 'INT-01-SAND',
      title: 'Plan Alpha: Sandbag Perimeter along St. Jude Emergency Artery',
      summary: 'Erects 450m of temporary physical deflection barriers along low elevation curb cuts.',
      resourceCost: '3 Crews • 1,200 Sandbags',
      inundationReduction: '-22.5% Peak Volume',
      hospitalDelayMinutes: 8.4,
      confidenceScore: 82.1,
      status: 'VIABLE',
    },
    {
      id: 'plan-gamma',
      code: 'INT-03-SLUICE',
      title: 'Plan Gamma: Early Estuary Sluice Gate Pre-Release',
      summary: 'Lowers water table prior to peak rainfall. Effective only if high tide allows gravity discharge.',
      resourceCost: 'Remote SCADA Command',
      inundationReduction: '-12.0% Peak Volume',
      hospitalDelayMinutes: 14.2,
      confidenceScore: 68.4,
      status: 'SUB_OPTIMAL',
    },
  ];

  const selectedPlan = candidates.find((c) => c.id === selectedPlanId) || candidates[0];

  return (
    <div className="space-y-6">
      {/* Notice */}
      <div className="bg-onyx-900 border-l-4 border-emerald-500 p-4 rounded-r border-y border-r border-onyx-800 flex items-start gap-3">
        <Info className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs font-mono text-storm-300 space-y-1">
          <div className="font-bold text-storm-100 uppercase tracking-wider">
            NORMALIZED INTERVENTION SCORING MATRIX
          </div>
          <p className="text-storm-300 font-sans">
            Every candidate fix is simulated against the <strong>identical storm hydrograph</strong>. This guarantees that ranking is based on physics and verifiable water balance metrics rather than subjective instinct.
          </p>
        </div>
      </div>

      {/* Baseline Comparison Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-onyx-900 p-4 rounded border border-red-900/50 font-mono text-xs">
          <span className="text-[10px] text-red-400 uppercase block font-bold">
            DO NOTHING BASELINE (ZERO ACTION)
          </span>
          <div className="text-xl font-bold text-storm-100 mt-1">+184,000 m³ Inundation</div>
          <div className="text-red-400 text-[11px] mt-1 font-sans">
            Hospital Corridor Severed for 3.8 hrs
          </div>
        </div>

        <div className="bg-onyx-900 p-4 rounded border border-safety-border font-mono text-xs">
          <span className="text-[10px] text-safety-orange uppercase block font-bold">
            TOP CANDIDATE (PLAN BETA)
          </span>
          <div className="text-xl font-bold text-emerald-400 mt-1">-46.2% Net Water Volume</div>
          <div className="text-emerald-400 text-[11px] mt-1 font-sans">
            Hospital Access Preserved (Delay &lt; 2.5 min)
          </div>
        </div>

        <div className="bg-onyx-900 p-4 rounded border border-onyx-800 font-mono text-xs">
          <span className="text-[10px] text-purple-400 uppercase block font-bold">
            ROVO CAUSAL CONFIDENCE
          </span>
          <div className="text-xl font-bold text-purple-300 mt-1">94.8% Verification</div>
          <div className="text-storm-400 text-[11px] mt-1 font-sans">
            10 Monte Carlo Sub-runs with ±5% Rain Variation
          </div>
        </div>
      </div>

      {/* Candidate Selector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-3">
          <h3 className="font-display font-semibold text-lg text-storm-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-safety-orange" />
            <span>Ranked Intervention Candidates</span>
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
                        ? 'bg-safety-muted text-safety-orange border border-safety-orange/40 font-bold'
                        : 'bg-onyx-950 text-storm-400 border border-onyx-800'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                <h4 className="font-display font-bold text-base text-storm-100 mb-1">{c.title}</h4>
                <p className="text-xs text-storm-300 font-sans mb-3">{c.summary}</p>

                <div className="pt-3 border-t border-onyx-800 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-emerald-400 font-bold">{c.inundationReduction}</span>
                  <span className="text-storm-400">Delay: {c.hospitalDelayMinutes}m</span>
                  <span className="text-storm-400">{c.resourceCost}</span>
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
              <span className="text-safety-orange font-bold">READY FOR AUTHORIZATION</span>
            </div>

            <div className="bg-purple-950/40 p-4 rounded border border-purple-800/60 font-sans text-xs text-storm-200 space-y-2">
              <div className="flex items-center gap-1.5 text-purple-300 font-mono font-bold text-[11px]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>ROVO REASONING BRIEF</span>
              </div>
              <p>
                "Plan Beta provides the optimal hydraulic return on field crew investment. Clearing the North Canal culvert prevents a 4,200 m³ water spill onto the primary ambulance feeder without risking upstream residential flooding."
              </p>
            </div>

            <div className="bg-onyx-950 p-4 rounded border border-onyx-800 space-y-2 text-[11px]">
              <div className="flex justify-between text-storm-400">
                <span>SIMULATION WATER SAVINGS:</span>
                <span className="text-emerald-400 font-bold">{selectedPlan.inundationReduction}</span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>PROJECTED AMBULANCE TRANSIT:</span>
                <span className="text-storm-100 font-bold">+{selectedPlan.hospitalDelayMinutes} minutes</span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>DEPLOYMENT BURDEN:</span>
                <span className="text-storm-300">{selectedPlan.resourceCost}</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-onyx-800 space-y-3">
            <button
              onClick={onNavigateToDecisions}
              className="w-full flex items-center justify-center gap-2 bg-safety-orange hover:bg-safety-hover text-white font-mono text-xs font-semibold py-3 px-4 rounded shadow-tactical transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              <span>APPROVE & RECORD DECISION</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="text-[10px] text-storm-500 text-center font-mono">
              Action creates an immutable ledger entry & dispatches to JSM.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

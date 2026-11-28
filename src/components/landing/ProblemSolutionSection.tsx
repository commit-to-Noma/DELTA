import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export const ProblemSolutionSection: React.FC = () => {
  return (
    <section id="problem" className="py-20 bg-onyx-950 border-b border-onyx-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-safety-orange tracking-widest uppercase mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-safety-orange" />
              <span>01 // THE MUNICIPAL REALITY</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-storm-50 tracking-tight">
              Instinct vs. Measured Causal Simulation
            </h2>
          </div>
          <p className="text-sm font-mono text-storm-400 mt-4 md:mt-0 max-w-md">
            Emergency infrastructure requires mathematical accountability. A single wrong culvert decision traps ambulance routes.
          </p>
        </div>

        {/* Comparative Analysis Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Column 1: The Status Quo (Failure Mode) */}
          <div className="bg-onyx-900/60 rounded border border-red-900/40 p-6 sm:p-8 relative overflow-hidden shadow-tactical">
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-600/60" />
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded bg-red-950/80 border border-red-800/60 flex items-center justify-center text-red-400 font-mono text-xs">
                ERR
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-storm-100">
                  Current Practice: Instinct & Fragmentation
                </h3>
                <span className="font-mono text-xs text-red-400">DECISION VACUUM UNDER PRESSURE</span>
              </div>
            </div>

            <ul className="space-y-4 font-sans text-sm text-storm-300">
              <li className="flex items-start gap-3">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-storm-100">Localized Tunnel Vision:</strong> Crews clear Drain A without knowing whether redirected runoff inundates the lower-elevation ICU ambulance feeder road.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-storm-100">Incomparable Outcomes:</strong> Interventions are guessed sequentially under changing storm conditions, making it impossible to measure if a fix helped or hurt.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-storm-100">Static Runbooks:</strong> When a new drain clogs mid-storm, static checklists break down; dispatchers have no way to compute cascading ripple effects.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-storm-100">Zero Audit Trail:</strong> Decisions are made via radios and WhatsApp. Post-disaster inquiries find no record of who authorized which diversion or why.
                </div>
              </li>
            </ul>

            <div className="mt-8 pt-4 border-t border-onyx-800 font-mono text-xs text-storm-400 flex items-center justify-between">
              <span>OUTCOME:</span>
              <span className="text-red-400 font-semibold uppercase">Hospital Arteries Cut Off</span>
            </div>
          </div>

          {/* Column 2: The DELTA Architecture (Causal Engine) */}
          <div className="bg-onyx-900/90 rounded border border-safety-border p-6 sm:p-8 relative overflow-hidden shadow-tactical">
            <div className="absolute top-0 left-0 right-0 h-1 bg-safety-orange" />
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded bg-safety-muted border border-safety-orange/40 flex items-center justify-center text-safety-orange font-mono text-xs font-bold">
                Δ
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-storm-50">
                  The DELTA Paradigm: Causal Simulation
                </h3>
                <span className="font-mono text-xs text-safety-orange">TESTED AGAINST THE IDENTICAL STORM</span>
              </div>
            </div>

            <ul className="space-y-4 font-sans text-sm text-storm-200">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-storm-100">Normalized Baseline Testing:</strong> Every candidate intervention (clearing culverts, deploying sandbags) is simulated against the identical rainfall hydrograph to measure net improvement.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-safety-orange flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-storm-100">In-Flight Dynamic Replanning:</strong> Block Drain B live during the storm, and DELTA recalculates water depth across the terrain and adapts its recommendation (first run for a new setup can take about a minute; results are then cached).
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-storm-100">Rovo Accountable AI:</strong> Atlassian Rovo explains the hydraulic cause-and-effect: <em>"Prioritizing Culvert 4 saves Hospital Access Route 12 by shedding 4,200 m³ runoff into Retention Basin C."</em>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-storm-100">Immutable Decision Record & JSM Dispatch:</strong> The dispatcher authorizes the plan with one click. An immutable ledger entry is locked, and a field ticket is dispatched directly to Jira Service Management.
                </div>
              </li>
            </ul>

            <div className="mt-8 pt-4 border-t border-onyx-800 font-mono text-xs text-storm-400 flex items-center justify-between">
              <span>RESULT:</span>
              <span className="text-emerald-400 font-semibold uppercase">Verified Hospital Arteries Open</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

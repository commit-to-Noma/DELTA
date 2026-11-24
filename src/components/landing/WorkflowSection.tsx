import React from 'react';
import { 
  PlayCircle, 
  BarChart3, 
  RefreshCw, 
  UserCheck, 
  ShieldCheck, 
  SendHorizontal
} from 'lucide-react';

export const WorkflowSection: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'SIMULATE',
      actor: 'DELTA Hydrology Engine',
      badge: 'DETERMINISTIC',
      desc: 'Simulate overland flood runoff and drainage network capacity against a standardized storm hydrograph.',
      icon: PlayCircle,
      accent: 'border-blue-500/40 text-blue-400 bg-blue-950/30',
    },
    {
      num: '02',
      title: 'EVALUATE',
      actor: 'Scenario Comparator',
      badge: 'NORMALIZED',
      desc: 'Test candidate interventions against the identical storm baseline. Measure hospital route accessibility & inundation reduction.',
      icon: BarChart3,
      accent: 'border-storm-500/40 text-storm-300 bg-storm-900/30',
    },
    {
      num: '03',
      title: 'REPLAN',
      actor: 'Dynamic Event Reactor',
      badge: 'IN-FLIGHT ADAPTATION',
      desc: 'Inject real-time disruptions (e.g. Drain B clogged). The engine recalculates immediately and pivots tactical advice.',
      icon: RefreshCw,
      accent: 'border-safety-orange/40 text-safety-orange bg-safety-muted',
    },
    {
      num: '04',
      title: 'APPROVE',
      actor: 'Human Commander',
      badge: 'ACCOUNTABLE AI',
      desc: 'Atlassian Rovo explains the physical causality and trade-offs. The human commander reviews and authorizes the plan.',
      icon: UserCheck,
      accent: 'border-purple-500/40 text-purple-400 bg-purple-950/30',
    },
    {
      num: '05',
      title: 'RECORD',
      actor: 'Immutable Ledger',
      badge: 'AUDIT PROOF',
      desc: 'Create an append-only, tamper-evident Decision Record capturing storm parameters, simulation delta, and authorization.',
      icon: ShieldCheck,
      accent: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/30',
    },
    {
      num: '06',
      title: 'DISPATCH',
      actor: 'Jira Service Management',
      badge: 'CLOSED LOOP',
      desc: 'Automatically generate and route actionable operational tasks to municipal field crews and utility teams in Jira.',
      icon: SendHorizontal,
      accent: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/30',
    },
  ];

  return (
    <section id="workflow" className="py-20 bg-onyx-950 border-b border-onyx-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-safety-orange tracking-widest uppercase mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-safety-orange" />
              <span>03 // THE 6-STAGE ENGINE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-storm-50 tracking-tight">
              From Terrain Elevation to Real Work in Jira
            </h2>
          </div>
          <p className="text-sm font-mono text-storm-400 mt-4 md:mt-0 max-w-md">
            A continuous closed loop ensuring mathematical rigor, explainability, human command, and operational execution.
          </p>
        </div>

        {/* Workflow Steps Grid with Flow Connectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="bg-onyx-900 rounded border border-onyx-800 p-6 relative flex flex-col justify-between group hover:border-onyx-700 transition-colors shadow-tactical"
              >
                {/* Step Index Watermark */}
                <div className="absolute top-4 right-4 font-mono text-3xl font-bold text-onyx-800 group-hover:text-onyx-700 transition-colors select-none">
                  {step.num}
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-9 h-9 rounded flex items-center justify-center border ${step.accent}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-mono text-[10px] text-storm-400 block tracking-wider uppercase">
                        STAGE {step.num}
                      </span>
                      <h3 className="font-display font-bold text-lg text-storm-100 tracking-tight">
                        {step.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-sm text-storm-300 font-sans leading-relaxed mb-4">
                    {step.desc}
                  </p>
                </div>

                <div className="pt-4 border-t border-onyx-800/80 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-storm-400">{step.actor}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-onyx-950 border border-onyx-800 text-storm-300">
                    {step.badge}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Banner */}
        <div className="mt-12 p-4 rounded bg-onyx-900 border border-onyx-800 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-storm-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-safety-orange" />
            <span>ACCOUNTABILITY PRINCIPLE:</span>
            <span className="text-storm-100">
              The engine recalculates; Rovo explains; human decides. The engine NEVER self-approves or dispatches tasks autonomously.
            </span>
          </div>
          <span className="text-safety-orange font-semibold whitespace-nowrap">
            HUMAN-IN-THE-LOOP LOCKED
          </span>
        </div>
      </div>
    </section>
  );
};

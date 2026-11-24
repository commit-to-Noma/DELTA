import React from 'react';
import { Layers, Sparkles, Network, Ticket, Binary, ShieldCheck } from 'lucide-react';

export const TechStackSection: React.FC = () => {
  const technologies = [
    {
      name: 'Atlassian Forge',
      role: 'Serverless Platform & UI Runtime',
      icon: Layers,
      accent: 'border-blue-500/40 text-blue-400 bg-blue-950/20',
      what: 'Executes secure serverless resolvers and isolated UI Kit / Custom UI components directly inside the customer’s Atlassian tenant.',
      why: 'Guarantees municipal security compliance, zero unauthorized data egress, and seamless single-sign-on integration.',
    },
    {
      name: 'Atlassian Rovo',
      role: 'Contextual AI Agent & Tools (rovo:agent)',
      icon: Sparkles,
      accent: 'border-purple-500/40 text-purple-400 bg-purple-950/20',
      what: 'Translates high-dimensional hydraulic simulation grids into clear, plain-language tactical trade-off briefs.',
      why: 'Enables commanders to understand why an intervention was recommended in seconds without reading raw sensor rasters.',
    },
    {
      name: 'Teamwork Graph (TWG)',
      role: 'Organizational & Asset Context Mapping',
      icon: Network,
      accent: 'border-amber-500/40 text-amber-400 bg-amber-950/20',
      what: 'Traverses organizational nodes connecting municipal facilities, pump stations, maintenance contractors, and on-call teams.',
      why: 'Eliminates phone trees during a storm by automatically identifying the verified owner of a blocked drainage culvert.',
    },
    {
      name: 'Jira Service Management',
      role: 'Field Dispatch & Operational Execution',
      icon: Ticket,
      accent: 'border-safety-orange/40 text-safety-orange bg-safety-muted',
      what: 'Receives immutable decision records and creates field dispatch tickets assigned to utility crews with geolocated coordinates.',
      why: 'Ensures simulations generate real, trackable field work with SLA timers and escalation paths, not ephemeral dashboards.',
    },
    {
      name: 'Deterministic Hydrology Engine',
      role: 'Mass-Conserving Water Simulation',
      icon: Binary,
      accent: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20',
      what: 'A calibrated 2D overland flow solver maintaining strict mass-conservation (water in = water retained + water discharged).',
      why: 'A physics engine cannot hallucinate. Testing against the same storm yields fair, reproducible, and verifiable results.',
    },
    {
      name: 'Modern Web & Canvas Stack',
      role: 'Topographic Visualization & UI Shell',
      icon: ShieldCheck,
      accent: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/20',
      what: 'React, TypeScript, Tailwind CSS, and high-performance HTML5 Canvas rendering elevation contours and hydraulic vectors.',
      why: 'Sub-millisecond frame rendering and strict type safety across complex geospatial data structures.',
    },
  ];

  return (
    <section id="technologies" className="py-20 bg-onyx-950 border-b border-onyx-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-safety-orange tracking-widest uppercase mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-safety-orange" />
              <span>04 // SYSTEM ARCHITECTURE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-storm-50 tracking-tight">
              Technologies & Architectural Rationale
            </h2>
          </div>
          <p className="text-sm font-mono text-storm-400 mt-4 md:mt-0 max-w-md">
            Purpose-built integrations leveraging the full power of the Atlassian Forge ecosystem.
          </p>
        </div>

        {/* Tech Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {technologies.map((tech, idx) => {
            const Icon = tech.icon;
            return (
              <div
                key={idx}
                className="bg-onyx-900 rounded border border-onyx-800 p-6 flex flex-col justify-between shadow-tactical hover:border-onyx-700 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-9 h-9 rounded flex items-center justify-center border ${tech.accent}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-storm-100">
                        {tech.name}
                      </h3>
                      <span className="font-mono text-[10px] text-storm-400 block">
                        {tech.role}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs leading-relaxed font-sans">
                    <div>
                      <span className="font-mono text-[10px] text-storm-400 block uppercase mb-0.5">
                        WHAT IT DOES
                      </span>
                      <p className="text-storm-200">{tech.what}</p>
                    </div>

                    <div>
                      <span className="font-mono text-[10px] text-safety-orange block uppercase mb-0.5">
                        WHY IT WAS CHOSEN
                      </span>
                      <p className="text-storm-300">{tech.why}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-onyx-800/80 flex items-center justify-between text-[10px] font-mono text-storm-500">
                  <span>ATLASSIAN NATIVE</span>
                  <span className="text-emerald-400">VERIFIED SPEC</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

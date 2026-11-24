import React from 'react';
import { DeltaLogo } from '../common/DeltaLogo';
import { ArrowRight, MapPin, Award, Compass, HeartHandshake } from 'lucide-react';

interface MissionVisionFooterProps {
  onEnterApp: () => void;
}

export const MissionVisionFooter: React.FC<MissionVisionFooterProps> = ({ onEnterApp }) => {
  return (
    <footer className="bg-onyx-950 border-t border-onyx-800 text-storm-300">
      {/* Mission & Vision Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pb-16 border-b border-onyx-800">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono text-safety-orange tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-safety-orange" />
              <span>MISSION & VISION</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-storm-50 tracking-tight">
              Transforming Urban Flood Response into an Accountable Science
            </h2>
            <p className="text-base text-storm-300 font-sans leading-relaxed">
              Our mission is to replace instinct-based emergency guessing with causal simulation, explainable AI, and immutable operational records. No municipal responder should ever have to wonder if their intervention worsened a neighboring hospital route.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 font-mono text-xs text-storm-400">
              <div className="flex items-center gap-1.5 bg-onyx-900 px-3 py-1.5 rounded border border-onyx-800">
                <MapPin className="w-3.5 h-3.5 text-safety-orange" />
                <span>Municipal Emergency Ops</span>
              </div>
              <div className="flex items-center gap-1.5 bg-onyx-900 px-3 py-1.5 rounded border border-onyx-800">
                <Compass className="w-3.5 h-3.5 text-hydro-500" />
                <span>Utility & Water Authorities</span>
              </div>
              <div className="flex items-center gap-1.5 bg-onyx-900 px-3 py-1.5 rounded border border-onyx-800">
                <HeartHandshake className="w-3.5 h-3.5 text-purple-400" />
                <span>Port & Medical Campuses</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-onyx-900 p-6 rounded border border-onyx-800 shadow-tactical space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-onyx-800 text-xs font-mono text-storm-400">
              <span className="flex items-center gap-2 text-safety-orange font-bold">
                <Award className="w-4 h-4" />
                <span>CODEGEIST 2026 CANDIDATE</span>
              </span>
              <span>SPECIALIZED INDUSTRIES</span>
            </div>
            <p className="text-xs text-storm-300 font-sans leading-relaxed">
              DELTA is engineered specifically for Codegeist 2026, satisfying all five evaluation pillars: Technological Implementation, Design, Potential Impact, Innovation, and Presentation.
            </p>
            <button
              onClick={onEnterApp}
              className="w-full flex items-center justify-center gap-2 bg-safety-orange hover:bg-safety-hover text-white text-xs font-mono font-semibold py-3 px-4 rounded shadow-tactical transition-colors"
            >
              <span>OPEN DELTA APPLICATION SHELL</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tactical Sub-footer */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-storm-500">
          <DeltaLogo size="sm" />
          <div className="flex items-center gap-4">
            <span>DELTA: Decision Engine for Local Terrain & Action</span>
            <span>•</span>
            <span>Simulate. Evaluate. Decide.</span>
          </div>
          <div>FORGE RUNTIME SPECIFICATION v0.1.0</div>
        </div>
      </div>
    </footer>
  );
};

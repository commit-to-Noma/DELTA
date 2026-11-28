import React from 'react';
import { TerrainContourCanvas } from '../terrain/TerrainContourCanvas';
import { ArrowRight, Activity, Cpu, Sparkles, Database } from 'lucide-react';

interface HeroSectionProps {
  onEnterApp: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onEnterApp }) => {
  return (
    <section className="relative min-h-[90vh] flex flex-col justify-center border-b border-onyx-800/80 bg-onyx-950 overflow-hidden">
      {/* Background Interactive Topographic Visualizer */}
      <div className="absolute inset-0 z-0 opacity-40">
        <TerrainContourCanvas className="w-full h-full" showCoordinates={true} />
      </div>

      {/* Subtle Dark Vignette Gradients */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-onyx-950 via-transparent to-onyx-950/80" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-onyx-950 via-onyx-950/60 to-transparent" />

      {/* Main Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        {/* Engineering System Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-onyx-900/90 border border-onyx-700/80 text-xs font-mono text-storm-300 mb-6 backdrop-blur-md shadow-tactical">
          <span className="w-2 h-2 rounded-full bg-safety-orange animate-ping" />
          <span className="text-safety-orange font-semibold">CODEGEIST 2026</span>
          <span className="text-onyx-600">|</span>
          <span>SPECIALIZED INDUSTRIES: GEOSPATIAL INFRASTRUCTURE</span>
        </div>

        {/* Hero Slogan & Title */}
        <div className="max-w-3xl">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-bold tracking-tight text-storm-50 leading-[1.08] mb-4">
            Decision Engine for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-storm-100 via-storm-300 to-storm-500">
              Local Terrain & Action.
            </span>
          </h1>

          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-lg sm:text-xl font-medium text-safety-orange tracking-widest uppercase">
              Simulate. Evaluate. Decide.
            </span>
            <div className="h-4 w-[1px] bg-onyx-700" />
            <span className="font-mono text-xs text-storm-400">
              URBAN FLOOD HYDRAULICS IN ATLASSIAN JIRA
            </span>
          </div>

          <p className="text-base sm:text-lg text-storm-300 leading-relaxed font-sans max-w-2xl mb-8">
            When flash floods compromise municipal districts, roads sever and critical hospital arteries collapse.
            Responders can no longer rely on instinct. <strong className="text-storm-100 font-semibold">DELTA</strong> tests every intervention against the exact same storm, replans dynamically when drains fail, and records accountable decisions directly into Jira Service Management.
          </p>

          {/* Primary CTA and Spec Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={onEnterApp}
              className="flex items-center gap-3 bg-safety-orange hover:bg-safety-hover text-white font-mono text-sm font-semibold px-6 py-3.5 rounded shadow-safety transition-all duration-150 border border-safety-dark group"
            >
              <span>ENTER APPLICATION SHELL</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>

            <a
              href="#workflow"
              className="flex items-center gap-2 bg-onyx-900/90 hover:bg-onyx-850 text-storm-200 font-mono text-xs px-5 py-3.5 rounded border border-onyx-700 transition-colors shadow-tactical"
            >
              <Activity className="w-4 h-4 text-hydro-500" />
              <span>EXPLORE 5-STAGE ENGINE</span>
            </a>
          </div>
        </div>

        {/* Live Operational Spec HUD Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-16 max-w-4xl">
          <div className="bg-onyx-900/85 backdrop-blur-md p-3.5 rounded border border-onyx-800 shadow-tactical">
            <div className="flex items-center justify-between text-storm-400 mb-1">
              <span className="font-mono text-[10px] uppercase">HYDRAULIC CORE</span>
              <Cpu className="w-3.5 h-3.5 text-hydro-500" />
            </div>
            <div className="font-display font-semibold text-lg text-storm-100">Deterministic</div>
            <div className="font-mono text-[10px] text-storm-400 mt-0.5">Water-Balance Verified</div>
          </div>

          <div className="bg-onyx-900/85 backdrop-blur-md p-3.5 rounded border border-onyx-800 shadow-tactical">
            <div className="flex items-center justify-between text-storm-400 mb-1">
              <span className="font-mono text-[10px] uppercase">DYNAMIC REPLANNING</span>
              <Activity className="w-3.5 h-3.5 text-safety-orange" />
            </div>
            <div className="font-display font-semibold text-lg text-safety-orange">Live In-Flight</div>
            <div className="font-mono text-[10px] text-storm-400 mt-0.5">Drain Blockage Recalculation</div>
          </div>

          <div className="bg-onyx-900/85 backdrop-blur-md p-3.5 rounded border border-onyx-800 shadow-tactical">
            <div className="flex items-center justify-between text-storm-400 mb-1">
              <span className="font-mono text-[10px] uppercase">ACCOUNTABLE AI</span>
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="font-display font-semibold text-lg text-storm-100">Atlassian Rovo</div>
            <div className="font-mono text-[10px] text-storm-400 mt-0.5">Explains Plan • Human Approves</div>
          </div>

          <div className="bg-onyx-900/85 backdrop-blur-md p-3.5 rounded border border-onyx-800 shadow-tactical">
            <div className="flex items-center justify-between text-storm-400 mb-1">
              <span className="font-mono text-[10px] uppercase">AUDIT TRAIL</span>
              <Database className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="font-display font-semibold text-lg text-storm-100">Immutable Log</div>
            <div className="font-mono text-[10px] text-storm-400 mt-0.5">Direct JSM Task Dispatch</div>
          </div>
        </div>
      </div>
    </section>
  );
};

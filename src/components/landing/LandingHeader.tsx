import React from 'react';
import { DeltaLogo } from '../common/DeltaLogo';
import { ArrowRight } from 'lucide-react';

interface LandingHeaderProps {
  onEnterApp: () => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({ onEnterApp }) => {
  return (
    <header className="sticky top-0 z-50 bg-onyx-950/90 backdrop-blur-md border-b border-onyx-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <DeltaLogo size="md" />

        {/* Tactical Nav Links */}
        <nav className="hidden md:flex items-center gap-1 font-mono text-xs text-storm-300">
          <a
            href="#problem"
            className="px-3 py-1.5 rounded hover:text-storm-100 hover:bg-onyx-850 transition-colors"
          >
            01// PROBLEM
          </a>
          <a
            href="#features"
            className="px-3 py-1.5 rounded hover:text-storm-100 hover:bg-onyx-850 transition-colors"
          >
            02// WORKBENCH
          </a>
          <a
            href="#workflow"
            className="px-3 py-1.5 rounded hover:text-storm-100 hover:bg-onyx-850 transition-colors"
          >
            03// 6-STAGE ENGINE
          </a>
          <a
            href="#technologies"
            className="px-3 py-1.5 rounded hover:text-storm-100 hover:bg-onyx-850 transition-colors"
          >
            04// ATLASSIAN STACK
          </a>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-onyx-900 border border-onyx-800 text-[11px] font-mono text-storm-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>FORGE READY</span>
          </div>

          <button
            onClick={onEnterApp}
            className="flex items-center gap-2 bg-safety-orange hover:bg-safety-hover text-white text-xs font-mono font-semibold px-4 py-2 rounded shadow-tactical transition-all duration-150 border border-safety-dark active:scale-95"
          >
            <span>LAUNCH APP SHELL</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};

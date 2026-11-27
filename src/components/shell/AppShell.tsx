import React, { useState } from 'react';
import { DeltaLogo } from '../common/DeltaLogo';
import {
  MapPin,
  PlayCircle,
  BarChart3,
  FileText,
  Ticket,
  ChevronLeft,
  ChevronRight,
  Home,
  Menu,
  X,
  User,
  LayoutList,
  AlertOctagon,
  CloudRain,
  RefreshCw,
  Lock
} from 'lucide-react';
import {
  IncidentWorkspaceProvider,
  useIncidentWorkspace,
  WorkspaceStage
} from '../../context/IncidentWorkspaceContext';
import { OverviewDistrictView } from './views/OverviewDistrictView';
import { FloodSimulationView } from './views/FloodSimulationView';
import { InterventionsView } from './views/InterventionsView';
import { DecisionBriefingView } from './views/DecisionBriefingView';
import { OperationalTicketsView } from './views/OperationalTicketsView';
import { IssuePanel } from '../jira/IssuePanel';
import { LiveContextStatus } from './LiveContextStatus';

export type ShellTab = WorkspaceStage;

interface AppShellProps {
  onExitToLanding: () => void;
}

const PRIMARY_STAGES: {
  id: WorkspaceStage;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  code: string;
}[] = [
  { id: 'intelligence', label: 'Incident Intelligence', shortLabel: 'Intelligence', icon: MapPin, code: '01' },
  { id: 'simulation', label: 'Simulation & Disruption', shortLabel: 'Simulation', icon: PlayCircle, code: '02' },
  { id: 'interventions', label: 'Intervention Planning', shortLabel: 'Interventions', icon: BarChart3, code: '03' },
  { id: 'briefing', label: 'Decision & Briefing', shortLabel: 'Decision', icon: FileText, code: '04' },
  { id: 'operations', label: 'Operational Work Orders', shortLabel: 'Work Orders', icon: Ticket, code: '05' }
];

const AppShellInner: React.FC<AppShellProps> = ({ onExitToLanding }) => {
  const {
    dataset,
    activeStage,
    setActiveStage,
    activeProfile,
    activeDisruptions,
    activeScenarioHash,
    isComputingEvaluation,
    workOrders
  } = useIncidentWorkspace();

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const profileShortLabel =
    activeProfile.id === 'reference-noaa-50yr'
      ? 'NOAA 50-YR BENCHMARK (104.2mm)'
      : `${activeProfile.totalRainfallMm.toFixed(1)}mm / ${activeProfile.durationHours}h SYNTHETIC`;

  const currentStageInfo =
    PRIMARY_STAGES.find((s) => s.id === activeStage) ||
    (activeStage === 'issue-panel'
      ? { id: 'issue-panel', label: 'Jira Issue Panel (Contextual)', code: 'JIRA' }
      : PRIMARY_STAGES[0]);

  return (
    <div className="h-screen bg-onyx-950 text-storm-100 flex flex-col font-sans selection:bg-safety-orange selection:text-white overflow-hidden">
      {/* Compact Incident Status Header (Bound strictly to shared state) */}
      <header className="h-13 py-2 flex-shrink-0 bg-onyx-900 border-b border-onyx-800 flex items-center justify-between px-4 select-none z-40 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded text-storm-400 hover:text-storm-100 hover:bg-onyx-800"
            aria-label="Toggle workspace navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="cursor-pointer flex-shrink-0" onClick={onExitToLanding}>
            <DeltaLogo size="sm" showLabel={true} />
          </div>

          <div className="h-4 w-[1px] bg-onyx-800 hidden sm:block" />

          {/* Real Catchment Context */}
          <button
            type="button"
            onClick={() => setActiveStage('intelligence')}
            className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded bg-onyx-950 border border-onyx-800 hover:border-onyx-700 text-[11px] font-mono text-storm-300 transition-colors truncate"
            title={dataset.catchmentName}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-safety-orange flex-shrink-0" />
            <span className="text-storm-100 font-semibold uppercase truncate">
              Boston Longwood / Muddy River
            </span>
          </button>

          {/* Active Rainfall Profile Indicator */}
          <button
            type="button"
            onClick={() => setActiveStage('intelligence')}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-onyx-950 border border-onyx-800 hover:border-onyx-700 text-[11px] font-mono text-storm-300 transition-colors"
            title={activeProfile.name}
          >
            <CloudRain
              className={`w-3.5 h-3.5 flex-shrink-0 ${
                activeProfile.type === 'REGIONAL_NOAA_BENCHMARK' ? 'text-cyan-400' : 'text-safety-orange'
              }`}
            />
            <span className="truncate">{profileShortLabel}</span>
          </button>

          {/* Active Disruption State Indicator */}
          <button
            type="button"
            onClick={() => setActiveStage('simulation')}
            className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-mono transition-colors ${
              activeDisruptions.length > 0
                ? 'bg-safety-orange/15 border-safety-orange/40 text-safety-orange'
                : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {activeDisruptions.length > 0
                ? `${activeDisruptions.length} DISRUPTION${activeDisruptions.length > 1 ? 'S' : ''} ACTIVE`
                : 'NOMINAL DRAINAGE'}
            </span>
          </button>
        </div>

        {/* Right Controls & Governance Status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <LiveContextStatus />
          {/* Scenario Hash / Solver Status */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded bg-onyx-950 border border-onyx-800 text-[10px] font-mono text-storm-400">
            {isComputingEvaluation ? (
              <>
                <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
                <span className="text-cyan-300">RECALCULATING</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>HASH: {activeScenarioHash ? activeScenarioHash.slice(0, 10) : 'READY'}</span>
              </>
            )}
          </div>

          {/* Contextual Jira Issue Panel Trigger */}
          <button
            type="button"
            onClick={() => setActiveStage(activeStage === 'issue-panel' ? 'operations' : 'issue-panel')}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-mono transition-colors ${
              activeStage === 'issue-panel'
                ? 'bg-safety-orange/20 border-safety-orange text-safety-orange font-bold'
                : 'bg-onyx-950 border-onyx-800 text-storm-300 hover:text-white hover:border-onyx-700'
            }`}
            title="Inspect contextual Jira Issue Panel integration"
          >
            <LayoutList className="w-3.5 h-3.5" />
            <span>Jira Panel</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-storm-300 px-2.5 py-1 bg-onyx-950 rounded border border-onyx-800">
            <User className="w-3.5 h-3.5 text-storm-400" />
            <span className="text-storm-200 font-medium">Duty Incident Commander</span>
          </div>

          <button
            type="button"
            onClick={onExitToLanding}
            className="flex items-center gap-1.5 text-[11px] font-mono text-storm-300 hover:text-storm-100 hover:bg-onyx-850 px-2.5 py-1 rounded border border-onyx-800 transition-colors"
            title="Return to Public Landing Page"
          >
            <Home className="w-3.5 h-3.5 text-safety-orange" />
            <span className="hidden sm:inline">LANDING</span>
          </button>
        </div>
      </header>

      {/* Main Container: 5-Stage Sidebar + Dominant Map-First Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden md:flex flex-col bg-onyx-900 border-r border-onyx-800 transition-all duration-200 flex-shrink-0 ${
            sidebarCollapsed ? 'w-16' : 'w-60'
          }`}
        >
          <div className="p-3 border-b border-onyx-800 flex items-center justify-between">
            {!sidebarCollapsed && (
              <span className="font-mono text-[10px] text-storm-400 tracking-widest uppercase">
                Operational Workflow
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded hover:bg-onyx-800 text-storm-400 hover:text-storm-200 transition-colors mx-auto"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* 5 Primary Operational Stages */}
          <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto" aria-label="Primary operational stages">
            {PRIMARY_STAGES.map((item) => {
              const Icon = item.icon;
              const isActive = activeStage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveStage(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded text-left transition-all relative ${
                    isActive
                      ? 'bg-onyx-800 text-white border border-onyx-700'
                      : 'text-storm-400 hover:text-storm-200 hover:bg-onyx-850/60 border border-transparent'
                  }`}
                  title={sidebarCollapsed ? `${item.code} ${item.label}` : undefined}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-safety-orange rounded-r" />
                  )}
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? 'text-safety-orange' : 'text-storm-400'
                    }`}
                  />
                  {!sidebarCollapsed && (
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium tracking-tight leading-none truncate">
                          {item.label}
                        </span>
                        {item.id === 'operations' && workOrders.length > 0 && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-onyx-950 border border-onyx-700 text-storm-300">
                            {workOrders.length}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[9px] text-storm-500 mt-1">
                        STAGE {item.code}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}

            {/* Contextual Integration Section */}
            <div className="pt-3 mt-3 border-t border-onyx-800">
              {!sidebarCollapsed && (
                <div className="px-2.5 pb-1.5 font-mono text-[9px] text-storm-500 uppercase tracking-widest">
                  Contextual Integration
                </div>
              )}
              <button
                type="button"
                onClick={() => setActiveStage('issue-panel')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left transition-all relative ${
                  activeStage === 'issue-panel'
                    ? 'bg-onyx-800 text-white border border-onyx-700'
                    : 'text-storm-400 hover:text-storm-200 hover:bg-onyx-850/60 border border-transparent'
                }`}
                title="Jira Issue Panel"
              >
                <LayoutList
                  className={`w-4 h-4 flex-shrink-0 ${
                    activeStage === 'issue-panel' ? 'text-safety-orange' : 'text-storm-400'
                  }`}
                />
                {!sidebarCollapsed && (
                  <span className="text-xs font-medium truncate">Jira Issue Panel</span>
                )}
              </button>
            </div>
          </nav>

          {/* Bottom Lockout Guardrail */}
          <div className="p-3 border-t border-onyx-800 bg-onyx-950/60">
            {!sidebarCollapsed ? (
              <div className="text-[10px] font-mono text-storm-400 space-y-1">
                <div className="flex items-center gap-1.5 text-red-300 font-semibold">
                  <Lock className="w-3 h-3 text-red-400" />
                  <span>LIVE DISPATCH LOCKED</span>
                </div>
                <div className="text-storm-500">Decision-Support &amp; Staging Only</div>
              </div>
            ) : (
              <div className="flex justify-center" title="LIVE_DISPATCH_LOCKED">
                <Lock className="w-3.5 h-3.5 text-red-400" />
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Slide-out Navigation */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div className="fixed inset-0 bg-onyx-950/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-64 bg-onyx-900 border-r border-onyx-800 flex flex-col h-full z-10 p-4">
              <div className="flex items-center justify-between mb-5">
                <DeltaLogo size="sm" />
                <button type="button" onClick={() => setMobileMenuOpen(false)} className="text-storm-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-1.5">
                {PRIMARY_STAGES.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeStage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveStage(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium ${
                        isActive
                          ? 'bg-onyx-800 text-white border-l-2 border-safety-orange'
                          : 'text-storm-400 hover:text-storm-200'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-safety-orange' : 'text-storm-400'}`} />
                      <span>{item.code}. {item.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setActiveStage('issue-panel');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium border-t border-onyx-800 mt-2 pt-3 ${
                    activeStage === 'issue-panel'
                      ? 'bg-onyx-800 text-white border-l-2 border-safety-orange'
                      : 'text-storm-400 hover:text-storm-200'
                  }`}
                >
                  <LayoutList className="w-4 h-4 text-storm-400" />
                  <span>Jira Issue Panel</span>
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Main Workspace Canvas Container */}
        <main className="flex-1 overflow-y-auto bg-onyx-950 flex flex-col">
          {/* Compact Stage Progression Rail */}
          <div className="px-4 py-2 border-b border-onyx-850 bg-onyx-900/40 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono flex-shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {PRIMARY_STAGES.map((stage, idx) => {
                const isActive = activeStage === stage.id;
                return (
                  <React.Fragment key={stage.id}>
                    <button
                      type="button"
                      onClick={() => setActiveStage(stage.id)}
                      className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-safety-orange/20 border border-safety-orange/50 text-white font-bold'
                          : 'text-storm-400 hover:text-storm-200'
                      }`}
                    >
                      {stage.code} {stage.shortLabel}
                    </button>
                    {idx < PRIMARY_STAGES.length - 1 && (
                      <span className="text-onyx-700">→</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-storm-400">
              <span className="uppercase hidden sm:inline">
                {currentStageInfo.label}
              </span>
            </div>
          </div>

          {/* Active Stage View */}
          <div className="flex-1 p-4 min-h-0 flex flex-col">
            {activeStage === 'intelligence' && (
              <OverviewDistrictView onNavigateToSimulation={() => setActiveStage('simulation')} />
            )}

            {activeStage === 'simulation' && <FloodSimulationView />}

            {activeStage === 'interventions' && (
              <InterventionsView onNavigateToDecisions={() => setActiveStage('briefing')} />
            )}

            {activeStage === 'briefing' && (
              <DecisionBriefingView
                onNavigateToTab={(tab) => {
                  if (tab === 'overview') setActiveStage('intelligence');
                  else if (tab === 'tickets') setActiveStage('operations');
                  else if (tab === 'decisions') setActiveStage('briefing');
                  else setActiveStage(tab as WorkspaceStage);
                }}
              />
            )}

            {activeStage === 'operations' && <OperationalTicketsView />}

            {activeStage === 'issue-panel' && (
              <div className="space-y-3 max-w-5xl w-full mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-onyx-900 border border-onyx-800 px-3.5 py-2.5 rounded font-mono text-xs text-storm-300">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-safety-orange" />
                    <span>JIRA ISSUE PANEL CONTEXTUAL INTEGRATION</span>
                  </div>
                  <div className="text-[11px] text-storm-400">
                    Target: <code className="text-storm-200">EMERG-101</code> · Scenario Hash:{' '}
                    <code className="text-cyan-300">{activeScenarioHash || 'Computing'}</code>
                  </div>
                </div>
                <IssuePanel initialIssueKey="EMERG-101" onOpenFullApp={() => setActiveStage('interventions')} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export const AppShell: React.FC<AppShellProps> = (props) => {
  return (
    <IncidentWorkspaceProvider>
      <AppShellInner {...props} />
    </IncidentWorkspaceProvider>
  );
};

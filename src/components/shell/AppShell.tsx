import React, { useState } from 'react';
import { DeltaLogo } from '../common/DeltaLogo';
import { 
  MapPin, 
  PlayCircle, 
  AlertOctagon, 
  BarChart3, 
  ShieldCheck, 
  Ticket, 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  Menu, 
  X,
  User
} from 'lucide-react';
import { OverviewDistrictView } from './views/OverviewDistrictView';
import { FloodSimulationView } from './views/FloodSimulationView';
import { DisruptionsView } from './views/DisruptionsView';
import { InterventionsView } from './views/InterventionsView';
import { DecisionRecordsView } from './views/DecisionRecordsView';
import { OperationalTicketsView } from './views/OperationalTicketsView';

export type ShellTab = 'overview' | 'simulation' | 'disruptions' | 'interventions' | 'decisions' | 'tickets';

interface AppShellProps {
  onExitToLanding: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ onExitToLanding }) => {
  const [activeTab, setActiveTab] = useState<ShellTab>('overview');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('district-alpha');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const navItems = [
    { id: 'overview', label: 'Overview / District', icon: MapPin, code: '01' },
    { id: 'simulation', label: 'Flood Simulation', icon: PlayCircle, code: '02' },
    { id: 'disruptions', label: 'Scenario Disruptions', icon: AlertOctagon, code: '03' },
    { id: 'interventions', label: 'Intervention Planner', icon: BarChart3, code: '04' },
    { id: 'decisions', label: 'Decision Records', icon: ShieldCheck, code: '05' },
    { id: 'tickets', label: 'Operational Tickets', icon: Ticket, code: '06' },
  ];

  return (
    <div className="h-screen bg-onyx-950 text-storm-100 flex flex-col font-sans selection:bg-safety-orange selection:text-white overflow-hidden">
      {/* Tactical Top Bar */}
      <header className="h-14 flex-shrink-0 bg-onyx-900 border-b border-onyx-800 flex items-center justify-between px-4 sm:px-6 select-none z-40">
        <div className="flex items-center gap-4">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded text-storm-400 hover:text-storm-100 hover:bg-onyx-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo */}
          <div className="cursor-pointer" onClick={onExitToLanding}>
            <DeltaLogo size="sm" showLabel={true} />
          </div>

          <div className="h-4 w-[1px] bg-onyx-800 hidden sm:block" />

          {/* Active District Quick Switcher */}
          <button
            onClick={() => setActiveTab('overview')}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-onyx-950 border border-onyx-850 hover:border-onyx-700 text-xs font-mono text-storm-300 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-safety-orange" />
            <span className="text-storm-400">DISTRICT:</span>
            <span className="text-storm-100 font-semibold uppercase">
              {selectedDistrictId === 'district-alpha'
                ? 'Alpha (Hospital Corridor)'
                : selectedDistrictId === 'district-beta'
                ? 'Beta (Estuary Basin)'
                : 'Gamma (Foothills)'}
            </span>
          </button>
        </div>

        {/* Right Status Badges & Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded bg-onyx-950 border border-onyx-800 text-[11px] font-mono text-storm-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>STORM: 100-YR HYDROGRAPH</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-storm-300 px-2.5 py-1 bg-onyx-950 rounded border border-onyx-800">
            <User className="w-3.5 h-3.5 text-storm-400" />
            <span className="text-storm-300 font-medium">Cmdr. Vance</span>
          </div>

          {/* Exit to Landing Page button */}
          <button
            onClick={onExitToLanding}
            className="flex items-center gap-1.5 text-xs font-mono text-storm-300 hover:text-storm-100 hover:bg-onyx-850 px-3 py-1.5 rounded border border-onyx-800 transition-colors"
            title="Return to Public Landing Page"
          >
            <Home className="w-3.5 h-3.5 text-safety-orange" />
            <span className="hidden sm:inline">LANDING PAGE</span>
          </button>
        </div>
      </header>

      {/* Workspace Area: Sidebar + Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Collapsible Tactical Sidebar */}
        <aside
          className={`hidden md:flex flex-col bg-onyx-900 border-r border-onyx-800 transition-all duration-200 select-none ${
            sidebarCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          {/* Sidebar Nav Items */}
          <div className="p-3 space-y-1 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as ShellTab)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-mono transition-all text-left group ${
                    isActive
                      ? 'bg-onyx-800 text-safety-orange font-semibold border-l-2 border-safety-orange shadow-tactical'
                      : 'text-storm-400 hover:text-storm-200 hover:bg-onyx-850'
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? 'text-safety-orange' : 'text-storm-400 group-hover:text-storm-200'
                    }`}
                  />
                  {!sidebarCollapsed && (
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate">{item.label}</span>
                      <span className="text-[10px] text-storm-600 font-normal">{item.code}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sidebar Footer Collapse Toggle */}
          <div className="p-3 border-t border-onyx-800">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center py-2 text-storm-400 hover:text-storm-200 hover:bg-onyx-850 rounded text-xs font-mono transition-colors"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <div className="flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4" />
                  <span>COLLAPSE NAV</span>
                </div>
              )}
            </button>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-14 z-30 bg-onyx-950/95 backdrop-blur-md p-4 space-y-2 border-b border-onyx-800">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as ShellTab);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded text-sm font-mono text-left ${
                    isActive
                      ? 'bg-onyx-800 text-safety-orange font-semibold border-l-2 border-safety-orange'
                      : 'text-storm-300 hover:bg-onyx-850'
                  }`}
                >
                  <Icon className="w-4 h-4 text-safety-orange" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main Operational View Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-onyx-950">
          <div className="max-w-7xl mx-auto">
            {/* View Breadcrumb & Section Header */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-onyx-800/80 font-mono text-xs text-storm-400">
              <div className="flex items-center gap-2">
                <span className="text-storm-500 uppercase">WORKSPACE</span>
                <span>/</span>
                <span className="text-storm-200 uppercase font-bold">
                  {navItems.find((n) => n.id === activeTab)?.label}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>SYS NOMINAL</span>
                </span>
              </div>
            </div>

            {/* Active View Switcher */}
            {activeTab === 'overview' && (
              <OverviewDistrictView
                selectedDistrictId={selectedDistrictId}
                onSelectDistrict={(id) => setSelectedDistrictId(id)}
                onNavigateToSimulation={() => setActiveTab('simulation')}
              />
            )}

            {activeTab === 'simulation' && <FloodSimulationView />}

            {activeTab === 'disruptions' && <DisruptionsView />}

            {activeTab === 'interventions' && (
              <InterventionsView onNavigateToDecisions={() => setActiveTab('decisions')} />
            )}

            {activeTab === 'decisions' && (
              <DecisionRecordsView onNavigateToTickets={() => setActiveTab('tickets')} />
            )}

            {activeTab === 'tickets' && <OperationalTicketsView />}
          </div>
        </main>
      </div>
    </div>
  );
};

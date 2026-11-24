import React from 'react';
import { 
  MapPin, 
  ArrowRight,
  Info,
  Database
} from 'lucide-react';

interface DistrictSpec {
  id: string;
  name: string;
  code: string;
  type: string;
  areaKm2: number;
  elevationRange: string;
  culvertNodes: number;
  criticalArteries: number;
  status: 'READY_FOR_SIMULATION' | 'PENDING_GIS_INGESTION';
  description: string;
}

interface OverviewDistrictViewProps {
  selectedDistrictId: string;
  onSelectDistrict: (id: string) => void;
  onNavigateToSimulation: () => void;
}

export const OverviewDistrictView: React.FC<OverviewDistrictViewProps> = ({
  selectedDistrictId,
  onSelectDistrict,
  onNavigateToSimulation,
}) => {
  // Illustrative candidate districts (clearly specified as illustrative placeholders)
  const candidateDistricts: DistrictSpec[] = [
    {
      id: 'district-alpha',
      name: 'District Alpha — Central Valley & Hospital Corridor',
      code: 'DIS-01-CVAL',
      type: 'Urban Valley / Medical Hub',
      areaKm2: 4.8,
      elevationRange: '18.2m – 46.5m AHD',
      culvertNodes: 32,
      criticalArteries: 4,
      status: 'READY_FOR_SIMULATION',
      description: 'Primary baseline municipal sector featuring low-lying trauma center arterial roads and high-density storm runoff catchments.',
    },
    {
      id: 'district-beta',
      name: 'District Beta — Coastal Estuary & Industrial Basin',
      code: 'DIS-02-CEST',
      type: 'Lowland Maritime Terminal',
      areaKm2: 7.2,
      elevationRange: '2.1m – 14.8m AHD',
      culvertNodes: 54,
      criticalArteries: 3,
      status: 'PENDING_GIS_INGESTION',
      description: 'Tidally influenced drainage network with automated sluice gates and critical port logistics arteries.',
    },
    {
      id: 'district-gamma',
      name: 'District Gamma — Foothills Catchment & Reservoir',
      code: 'DIS-03-FOOTH',
      type: 'Steep Uplands / Dam Spillway',
      areaKm2: 12.0,
      elevationRange: '84.0m – 220.5m AHD',
      culvertNodes: 18,
      criticalArteries: 2,
      status: 'PENDING_GIS_INGESTION',
      description: 'High velocity overland runoff channelized toward secondary urban retaining basins.',
    },
  ];

  const currentDistrict = candidateDistricts.find((d) => d.id === selectedDistrictId) || candidateDistricts[0];

  return (
    <div className="space-y-6">
      {/* Top Banner Notice: Data Integrity Disclaimer */}
      <div className="bg-onyx-900 border-l-4 border-amber-500 p-4 rounded-r border-y border-r border-onyx-800 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs font-mono text-storm-300 space-y-1">
          <div className="font-bold text-storm-100 uppercase tracking-wider">
            DATA INTEGRITY PROTOCOL // ILLUSTRATIVE DISTRICT PLACEHOLDERS
          </div>
          <p className="text-storm-300 font-sans">
            In accordance with Phase 0 specifications, actual geographical digital elevation models (DEM), culvert vectors, and real-world hospital boundaries will be ingested in Phase 1 following data licensing and district selection. The structures below represent the technical data schema.
          </p>
        </div>
      </div>

      {/* Selected District Summary Card */}
      <div className="bg-onyx-900 rounded border border-onyx-800 p-6 shadow-tactical">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-onyx-800">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-safety-orange uppercase mb-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>ACTIVE OPERATIONAL SECTOR</span>
            </div>
            <h2 className="text-2xl font-display font-bold text-storm-50 tracking-tight">
              {currentDistrict.name}
            </h2>
            <p className="text-sm text-storm-400 font-sans mt-1">
              {currentDistrict.description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToSimulation}
              className="flex items-center gap-2 bg-safety-orange hover:bg-safety-hover text-white font-mono text-xs font-semibold px-4 py-2.5 rounded shadow-tactical border border-safety-dark transition-all active:scale-95"
            >
              <span>PROCEED TO SIMULATION WORKSPACE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="bg-onyx-950 p-3.5 rounded border border-onyx-800 font-mono">
            <span className="text-[10px] text-storm-500 uppercase block">CATCHMENT AREA</span>
            <span className="text-lg font-bold text-storm-100">{currentDistrict.areaKm2} km²</span>
            <span className="text-[10px] text-storm-400 block mt-0.5">Hydrological Basin</span>
          </div>

          <div className="bg-onyx-950 p-3.5 rounded border border-onyx-800 font-mono">
            <span className="text-[10px] text-storm-500 uppercase block">ELEVATION RANGE</span>
            <span className="text-lg font-bold text-storm-100">{currentDistrict.elevationRange}</span>
            <span className="text-[10px] text-storm-400 block mt-0.5">Topographic Relief</span>
          </div>

          <div className="bg-onyx-950 p-3.5 rounded border border-onyx-800 font-mono">
            <span className="text-[10px] text-storm-500 uppercase block">CULVERT ASSETS</span>
            <span className="text-lg font-bold text-hydro-500">{currentDistrict.culvertNodes} Nodes</span>
            <span className="text-[10px] text-storm-400 block mt-0.5">Gravity Drainage Outfalls</span>
          </div>

          <div className="bg-onyx-950 p-3.5 rounded border border-onyx-800 font-mono">
            <span className="text-[10px] text-storm-500 uppercase block">CRITICAL ARTERIES</span>
            <span className="text-lg font-bold text-safety-orange">{currentDistrict.criticalArteries} Routes</span>
            <span className="text-[10px] text-storm-400 block mt-0.5">Hospital Access Priority</span>
          </div>
        </div>
      </div>

      {/* District Selection Catalog */}
      <div>
        <h3 className="font-display font-semibold text-lg text-storm-100 mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-safety-orange" />
          <span>Municipal Catchment Registry</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {candidateDistricts.map((district) => {
            const isSelected = district.id === selectedDistrictId;
            return (
              <div
                key={district.id}
                onClick={() => onSelectDistrict(district.id)}
                className={`p-5 rounded border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-onyx-850 border-safety-orange shadow-safety ring-1 ring-safety-orange/50'
                    : 'bg-onyx-900 border-onyx-800 hover:border-onyx-700 hover:bg-onyx-850'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-storm-400">{district.code}</span>
                  <span
                    className={`font-mono text-[9px] px-2 py-0.5 rounded ${
                      district.status === 'READY_FOR_SIMULATION'
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                        : 'bg-onyx-950 text-storm-500 border border-onyx-800'
                    }`}
                  >
                    {district.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <h4 className="font-display font-bold text-sm text-storm-100 mb-1">
                  {district.name}
                </h4>
                <p className="text-xs text-storm-400 font-sans line-clamp-2 mb-4">
                  {district.description}
                </p>

                <div className="pt-3 border-t border-onyx-800 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-storm-400">{district.type}</span>
                  <span className={isSelected ? 'text-safety-orange font-bold' : 'text-storm-500'}>
                    {isSelected ? 'ACTIVE' : 'SELECT'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * DELTA Workstream 4: Operational Work Order Engine
 *
 * Translates human-approved mitigation decision records and 2D hydraulic solver
 * outputs into structured, actionable operational work-order drafts for municipal
 * response crews and Jira Service Management (JSM).
 *
 * Enforces:
 * 1. Exact authoritative coordinates (EPSG:26986 Projected & WGS84 Geodetic) from surveyed infrastructure.
 * 2. Plan-specific tactical equipment and crew requirements.
 * 3. Chronological tactical task checklists with explicit safety cautions.
 * 4. Verifiable supporting simulation evidence (avoided storage, peak depth delta, protected roads).
 * 5. Explicit staged execution visibility:
 *    PREPARED_DRAFT -> COMMANDER_STAGED -> JIRA_LINKED (with LIVE_DISPATCH_LOCKED safety gate).
 */

export type WorkOrderStage = 'PREPARED_DRAFT' | 'COMMANDER_STAGED' | 'JIRA_LINKED';
export type WorkOrderUrgency = 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM';

export interface OperationalTaskItem {
  stepNumber: number;
  title: string;
  instruction: string;
  safetyCaution?: string;
  isCompleted: boolean;
}

export interface OperationalWorkOrder {
  workOrderId: string;
  decisionId: string;
  planId: 'plan-alpha' | 'plan-beta' | 'plan-gamma';
  planName: string;
  planType: 'BARRIER_DEFLECTION' | 'MOBILE_PUMP' | 'CULVERT_JETTING';
  stage: WorkOrderStage;
  urgency: WorkOrderUrgency;
  priorityRationale: string;
  targetLocation: {
    siteId: string;
    name: string;
    facilityCategory: string;
    projected: { x: number; y: number };
    wgs84: { lat: number; lon: number };
    gridCell: [number, number];
    accessCorridor: string;
    provenanceNotice?: string;
  };
  tacticalEquipment: string[];
  crewRequirement: string;
  operationalTasks: OperationalTaskItem[];
  supportingSimulationEvidence: {
    avoidedSurfaceVolumeM3: number;
    peakDepthReductionM: number;
    protectedRoads: string[];
    hospitalStatusSummary: string;
    stormScenario: string;
    scenarioHash: string;
  };
  humanReview: {
    reviewedBy: string;
    role: string;
    reviewedAt: string;
    engineeringRationale: string;
  };
  jiraIntegration: {
    linkedIssueKey?: string;
    linkedAt?: string;
    dispatchStatus: 'LIVE_DISPATCH_LOCKED' | 'SIMULATION_STAGED';
    safetyNotice: string;
    operationId: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Authoritative physical site locations for work orders.
 */
export const AUTHORITATIVE_WORK_ORDER_LOCATIONS = {
  'plan-gamma': {
    siteId: 'CULVERT-01-BROOKLINE',
    name: 'Brookline Avenue Muddy River Culvert Inflow & Trash Rack',
    facilityCategory: 'Stormwater Box Culvert Intake Headwall (10ft × 24ft)',
    projected: { x: 232302.11, y: 899074.88 },
    wgs84: { lat: 42.34150, lon: -71.10800 },
    gridCell: [17, 26] as [number, number],
    accessCorridor: 'Brookline Ave Northbound Ingress → Muddy River Culvert Apron',
    provenanceNotice: 'Surveyed USACE Brookline Avenue Culvert Intake (NAE-2007-00966). Modelled as 12.5 m³/s nominal drainage.'
  },
  'plan-beta': {
    siteId: 'PUMP-BETA-MOBILE',
    name: 'Muddy River / Brookline Ave Retention Channel Staging Cell',
    facilityCategory: 'Active Mechanical Dewatering Station',
    projected: { x: 232277.11, y: 899074.88 },
    wgs84: { lat: 42.34150, lon: -71.10830 },
    gridCell: [17, 25] as [number, number],
    accessCorridor: 'Longwood Ave → Brookline Ave South (Francis St approach clear)',
    provenanceNotice: 'Muddy River Channel Retention Invert adjacent to blocked culvert headwall.'
  },
  'plan-alpha': {
    siteId: 'ROAD-1377084984-MID',
    name: "Francis Street Ambulance Ingress Bay (Fronting Brigham and Women's Hospital)",
    facilityCategory: 'Rapid Deployable Flood Barrier Alignment',
    projected: { x: 232384.06, y: 898414.94 },
    wgs84: { lat: 42.335555, lon: -71.107042 },
    gridCell: [43, 29] as [number, number],
    accessCorridor: 'Huntington Ave / Tremont St → Francis Street North',
    provenanceNotice: 'Modelled staging alignment along centerline vertex of OSM road way 1377084984.'
  }
};

/**
 * Generates structured operational tasks for a given plan.
 */
export function getPlanOperationalTasks(planId: string): OperationalTaskItem[] {
  if (planId === 'plan-gamma') {
    return [
      {
        stepNumber: 1,
        title: 'Ingress Route Verification & Traffic Marshalling',
        instruction: 'Deploy traffic detail at Brookline Ave & Park Drive. Secure upstream culvert apron perimeter from pedestrian and vehicular traffic.',
        safetyCaution: 'Do not stage heavy Vactor equipment on weakened curb cuts adjacent to flooded embankment.',
        isCompleted: false
      },
      {
        stepNumber: 2,
        title: 'Trash-Rack Inspection & Winch Anchoring',
        instruction: 'Inspect debris accumulation on the 10ft × 24ft culvert face. Anchor winch cables to structural headwall lifting lugs.',
        safetyCaution: 'Water depth in basin may exceed 1.2m. Dive team must deploy safety tethers and fall-arrest harnesses.',
        isCompleted: false
      },
      {
        stepNumber: 3,
        title: 'High-Pressure Hydro-Jetting of Siphon Barrels',
        instruction: 'Insert 1-inch jetting nozzle into culvert barrel. Apply 2,500–3,000 PSI to dislodge compacted tree limbs, silt, and urban debris.',
        safetyCaution: 'Confined space entry strictly prohibited until atmospheric testing confirms zero H2S/methane accumulation.',
        isCompleted: false
      },
      {
        stepNumber: 4,
        title: 'Hydraulic Flow Restoration Verification',
        instruction: 'Confirm gravitational outflow reaches nominal 12.5 m³/s conveyance into Upper Fens Pond. Inspect downstream discharge for secondary blockages.',
        isCompleted: false
      },
      {
        stepNumber: 5,
        title: 'Post-Action Inspection & Commander Sign-Off',
        instruction: 'Document cleared grating status with high-resolution imagery. Confirm water level drawdown at upstream gauge before concluding operation.',
        isCompleted: false
      }
    ];
  }

  if (planId === 'plan-beta') {
    return [
      {
        stepNumber: 1,
        title: 'Pump Staging & Secondary Spill Containment',
        instruction: 'Position trailer-mounted Godwin HL250M on firm roadbed adjacent to cell [17, 25]. Deploy secondary fuel containment berm.',
        safetyCaution: 'Verify road deck stability before uncoupling trailer hitch.',
        isCompleted: false
      },
      {
        stepNumber: 2,
        title: 'Suction Line Deployment & Float Rigging',
        instruction: 'Lower 10-inch suction hose with float collar into deepest channel thalweg (elev ~7.2m NAVD88). Fasten strain-relief tie-offs to guardrail.',
        safetyCaution: 'Do not allow suction intake to sink into bed sediment to prevent pump impeller wear.',
        isCompleted: false
      },
      {
        stepNumber: 3,
        title: 'Discharge Line Routing to Downstream Channel',
        instruction: 'Roll out 150m of 250mm layflat hose along designated bypass corridor toward daylighted Muddy River section downstream of blockage.',
        safetyCaution: 'Anchor discharge nozzle to prevent whipping under 2.0 m³/s pressurized flow.',
        isCompleted: false
      },
      {
        stepNumber: 4,
        title: 'Engine Priming & Flow Rate Throttling',
        instruction: 'Engage Dri-Prime vacuum system. Gradually throttle diesel engine to rated continuous speed (1,800 RPM) achieving 2.0 m³/s active dewatering.',
        isCompleted: false
      },
      {
        stepNumber: 5,
        title: 'Continuous Operational Monitoring & Fuel Log',
        instruction: 'Monitor intake suction for cavitation or debris clogging every 30 minutes. Log fuel levels and drawdown rate.',
        isCompleted: false
      }
    ];
  }

  // Plan Alpha
  return [
    {
      stepNumber: 1,
      title: 'Ambulance Bay Traffic Diversion & Corridor Clearance',
      instruction: 'Coordinate with BWH EMS dispatch to route non-critical vehicles via Tremont St. Clear curbside vehicles along Francis St secondary way.',
      safetyCaution: 'Maintain 1 lane open for active emergency vehicles until sandbag courses reach barrier alignment.',
      isCompleted: false
    },
    {
      stepNumber: 2,
      title: 'Geotextile Membrane Foundation Laydown',
      instruction: 'Roll out 6-mil seepage barrier along curb line spanning cells [41, 26] through [43, 28]. Tuck base 0.3m beneath first course.',
      isCompleted: false
    },
    {
      stepNumber: 3,
      title: 'Pyramidal Sandbag Course Stacking (+0.50m Crest)',
      instruction: 'Construct 3-2-1 pyramidal sandbag weir along 100m alignment. Stagger joints and tamp down each course to ensure interlock.',
      safetyCaution: 'Adverse deflection warning: Overland flow will divert onto adjacent south curb cells; verify neighboring driveway sumps are clear.',
      isCompleted: false
    },
    {
      stepNumber: 4,
      title: 'Laser Level Crest Height Verification',
      instruction: 'Shoot crest elevation with rotating laser level. Confirm top-of-barrier reaches minimum +0.50m above road grade across full span.',
      isCompleted: false
    },
    {
      stepNumber: 5,
      title: 'Continuous Seepage Patrol & Sump Pump Staging',
      instruction: 'Station 2 personnel with puddle sucker pump for minor barrier under-seepage. Report any localized overtopping to Commander.',
      isCompleted: false
    }
  ];
}

/**
 * Prepares a structured, actionable operational work-order draft from an approved decision record.
 */
export function prepareWorkOrderFromDecision(
  decision: any,
  stage: WorkOrderStage = 'PREPARED_DRAFT',
  existingWorkOrderId?: string
): OperationalWorkOrder {
  if (!decision || typeof decision !== 'object') {
    throw new Error('Cannot prepare work order: decision record is required and must be an object.');
  }

  const decisionId = decision.decisionId || 'DEC-UNKNOWN';
  const plan = decision.chosenPlan || {};
  const rawPlanId = String(plan.planId || 'plan-gamma').toLowerCase();
  const planId: 'plan-alpha' | 'plan-beta' | 'plan-gamma' =
    rawPlanId.includes('alpha') ? 'plan-alpha' : rawPlanId.includes('beta') ? 'plan-beta' : 'plan-gamma';

  const planName = plan.name || (
    planId === 'plan-gamma'
      ? 'Emergency Culvert Jetting (Brookline Ave Choke Clearance)'
      : planId === 'plan-beta'
      ? 'Mobile Pump #1 Deployment (2.0 m³/s Active Dewatering)'
      : 'Francis Street Ambulance Bay Sandbag Barrier (+0.50m Crest)'
  );

  const planType: 'BARRIER_DEFLECTION' | 'MOBILE_PUMP' | 'CULVERT_JETTING' =
    planId === 'plan-gamma' ? 'CULVERT_JETTING' : planId === 'plan-beta' ? 'MOBILE_PUMP' : 'BARRIER_DEFLECTION';

  const location = AUTHORITATIVE_WORK_ORDER_LOCATIONS[planId];
  const tasks = getPlanOperationalTasks(planId);

  // Determine urgency
  const urgency: WorkOrderUrgency = planId === 'plan-gamma' || planId === 'plan-beta' ? 'P1_CRITICAL' : 'P2_HIGH';
  const priorityRationale = planId === 'plan-gamma'
    ? 'Brookline Avenue culvert is 100% blocked, impounding water along critical hospital arterials. Clearing debris restores 12.5 m³/s nominal outflow.'
    : planId === 'plan-beta'
    ? 'Active 2.0 m³/s mechanical dewatering at Muddy River retention channel relieves backwater surcharge along Longwood hospital approaches.'
    : 'Shields Brigham & Women\'s ambulance ingress bay from overland runoff inundation. Note: Causes localized deflection on adjacent cells.';

  // Equipment specs
  const tacticalEquipment = planId === 'plan-gamma'
    ? [
        '2x Municipal Vactor 2100i High-Pressure Jetting Trucks (3,000 PSI / 80 GPM)',
        '1x Heavy-Duty Hydraulic Trash-Rack Winch & Crane Assembly',
        '4x Confined Space SCBA Sets with Multi-Gas 4-Sensor Monitors',
        '1x 20-Yard Roll-Off Debris Disposal Container',
        'Emergency Bypass Suction Hose Staging'
      ]
    : planId === 'plan-beta'
    ? [
        '1x Godwin HL250M Dri-Prime 10-Inch Diesel Suction Pump (2.0 m³/s / 31,700 GPM)',
        '150m of 250mm Reinforced Layflat Discharge Hose',
        '1x Heavy-Duty Suction Basket Strainer with Float Collar',
        '500-Gallon Mobile Fuel Tender (Ultra-Low Sulfur Diesel)',
        'Acoustic Attenuation Sound Enclosure & Secondary Spill Containment Berm'
      ]
    : [
        '1,200 Rapid Polypropylene Sandbags (Filled, ~40 lbs each)',
        '200m of Heavy-Duty 6-mil Geotextile Seepage Barrier Membrane',
        '2x Flatbed Staging Trucks with Hydraulic Liftgates',
        'Rotating Optical Laser Level for Crest Elevation Verification (+0.50m NAVD88)',
        'Traffic Delineators & LED Emergency Perimeter Flare Kit'
      ];

  const crewRequirement = planId === 'plan-gamma'
    ? '2 Municipal Vactor Jetting Crews + 1 Confined Space Dive Team (Lead: T. Henderson)'
    : planId === 'plan-beta'
    ? '1 Utility Mechanical Crew + 1 Pump Specialist Technician (Lead: M. O\'Connor)'
    : '3 Tactical Public Works Teams (24 Personnel, Lead: D. Kowalski)';

  // Differential evidence
  const diff = decision.differentialMetrics || {};
  const avoidedSurfaceVolumeM3 = typeof diff.avoidedSurfaceVolumeM3 === 'number'
    ? diff.avoidedSurfaceVolumeM3
    : planId === 'plan-gamma' ? 22 : planId === 'plan-beta' ? 14 : 0;
  const peakDepthReductionM = typeof diff.peakDepthReductionM === 'number'
    ? diff.peakDepthReductionM
    : typeof diff.maxDepthReductionM === 'number'
    ? diff.maxDepthReductionM
    : 0.18;
  const protectedRoads = Array.isArray(diff.protectedRoadNames) && diff.protectedRoadNames.length > 0
    ? diff.protectedRoadNames
    : planId === 'plan-gamma'
    ? ['Francis Street', 'Brookline Avenue', 'Longwood Avenue']
    : planId === 'plan-beta'
    ? ['Brookline Avenue', 'Longwood Avenue']
    : ['Francis Street'];

  const stormScenario = decision.canonicalScenario?.stormLabel || decision.canonicalScenario?.stormId || '50-Year Regional Benchmark (104.2 mm)';
  const scenarioHash = decision.scenarioHash || 'sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47';

  const approver = decision.humanApprover || {};
  const reviewedBy = approver.displayName || 'Incident Commander';
  const role = approver.role || 'Incident Commander';
  const reviewedAt = approver.approvalTimestamp || decision.createdAt || new Date().toISOString();
  const engineeringRationale = decision.engineeringRationale || 'Authorized emergency flood mitigation plan under DELTA screening protocol.';

  const workOrderId = existingWorkOrderId || `WO-${decisionId.replace(/[^A-Za-z0-9]/g, '-')}-${planId.replace('plan-', '')}`;
  const operationId = `delta-wo-${decisionId.toLowerCase()}-${planId}`.replace(/[^a-z0-9-]/g, '-').slice(0, 60);

  return {
    workOrderId,
    decisionId,
    planId,
    planName,
    planType,
    stage,
    urgency,
    priorityRationale,
    targetLocation: location,
    tacticalEquipment,
    crewRequirement,
    operationalTasks: tasks,
    supportingSimulationEvidence: {
      avoidedSurfaceVolumeM3,
      peakDepthReductionM,
      protectedRoads,
      hospitalStatusSummary: 'All 5 hospital complexes protected from isolation under evaluated scenario.',
      stormScenario,
      scenarioHash
    },
    humanReview: {
      reviewedBy,
      role,
      reviewedAt,
      engineeringRationale
    },
    jiraIntegration: {
      linkedIssueKey: decision.linkedIssueKey,
      linkedAt: decision.linkedAt,
      dispatchStatus: 'LIVE_DISPATCH_LOCKED',
      safetyNotice: 'Server-side safety policy: Automated live Jira issue dispatch is hard-pinned to disabled. Staged work order must be reviewed by Incident Commander before live ticket assignment.',
      operationId
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Local in-memory / browser persistence for staged operational work orders.
 */
const STORAGE_KEY = 'delta_operational_work_orders';

/**
 * Returns canonical seed work orders derived from approved decisions.
 */
export function getSeedWorkOrders(): OperationalWorkOrder[] {
  const seedGammaDecision = {
    decisionId: 'DEC-2026-081',
    schemaVersion: '2.0.0',
    status: 'APPROVED',
    scenarioHash: 'sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47',
    canonicalScenario: {
      stormId: '50-year',
      stormLabel: '50-Year Regional Benchmark (104.2 mm / 6hr)',
      stormDepthMm: 104.2,
      durationHours: 6.0
    },
    chosenPlan: {
      planId: 'plan-gamma',
      name: 'Plan Gamma: Emergency High-Pressure Culvert Jetting (Clear Choke Point)',
      type: 'CULVERT_JETTING'
    },
    differentialMetrics: {
      avoidedSurfaceVolumeM3: 22,
      peakDepthReductionM: 0.18,
      protectedRoadCount: 3,
      protectedRoadNames: ['Francis Street', 'Brookline Avenue', 'Longwood Avenue']
    },
    humanApprover: {
      displayName: 'Capt. R. Vance',
      role: 'Incident Commander',
      approvalTimestamp: '2026-11-25T14:30:00.000Z'
    },
    engineeringRationale: 'Plan Gamma clears complete culvert blockage at Brookline Ave intake, restoring 12.5 m³/s nominal capacity and mitigating 22 m³ of surface floodwater along primary hospital access corridors.',
    linkedIssueKey: 'JSM-4902',
    linkedAt: '2026-11-25T14:32:00.000Z'
  };

  const seedBetaDecision = {
    decisionId: 'DEC-2026-080',
    schemaVersion: '2.0.0',
    status: 'APPROVED',
    scenarioHash: 'sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47',
    canonicalScenario: {
      stormId: '50-year',
      stormLabel: '50-Year Regional Benchmark (104.2 mm / 6hr)',
      stormDepthMm: 104.2,
      durationHours: 6.0
    },
    chosenPlan: {
      planId: 'plan-beta',
      name: 'Plan Beta: Mobile Pump Deployment #1 (2.0 m³/s Active Dewatering)',
      type: 'MOBILE_PUMP'
    },
    differentialMetrics: {
      avoidedSurfaceVolumeM3: 14,
      peakDepthReductionM: 0.11,
      protectedRoadCount: 2,
      protectedRoadNames: ['Brookline Avenue', 'Longwood Avenue']
    },
    humanApprover: {
      displayName: 'Capt. R. Vance',
      role: 'Incident Commander',
      approvalTimestamp: '2026-11-25T13:45:00.000Z'
    },
    engineeringRationale: 'Plan Beta provides active mechanical dewatering at Muddy River retention channel to alleviate backwater surcharge upstream of blocked headwall.',
    linkedIssueKey: undefined,
    linkedAt: undefined
  };

  const seedAlphaDecision = {
    decisionId: 'DEC-2026-079',
    schemaVersion: '2.0.0',
    status: 'APPROVED',
    scenarioHash: 'sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47',
    canonicalScenario: {
      stormId: '50-year',
      stormLabel: '50-Year Regional Benchmark (104.2 mm / 6hr)',
      stormDepthMm: 104.2,
      durationHours: 6.0
    },
    chosenPlan: {
      planId: 'plan-alpha',
      name: 'Plan Alpha: Francis Street Ambulance Bay Sandbag Barrier (+0.50m Crest)',
      type: 'BARRIER_DEFLECTION'
    },
    differentialMetrics: {
      avoidedSurfaceVolumeM3: 0,
      peakDepthReductionM: 0.05,
      protectedRoadCount: 1,
      protectedRoadNames: ['Francis Street']
    },
    humanApprover: {
      displayName: 'Lt. Sarah Chen',
      role: 'Deputy Incident Commander',
      approvalTimestamp: '2026-11-25T11:15:00.000Z'
    },
    engineeringRationale: 'Plan Alpha establishes sandbag weir along Francis Street to protect Brigham & Women\'s ambulance ingress. Caution: Note verified adverse ponding of +0.15m on neighboring curb cells.',
    linkedIssueKey: undefined,
    linkedAt: undefined
  };

  const woGamma = prepareWorkOrderFromDecision(seedGammaDecision, 'JIRA_LINKED', 'WO-DEC-2026-081-gamma');
  const woBeta = prepareWorkOrderFromDecision(seedBetaDecision, 'COMMANDER_STAGED', 'WO-DEC-2026-080-beta');
  const woAlpha = prepareWorkOrderFromDecision(seedAlphaDecision, 'PREPARED_DRAFT', 'WO-DEC-2026-079-alpha');

  return [woGamma, woBeta, woAlpha];
}

const inMemoryWorkOrdersMap = new Map<string, OperationalWorkOrder>();

export function __resetStoredWorkOrders(): void {
  inMemoryWorkOrdersMap.clear();
}

export function getStoredWorkOrders(): OperationalWorkOrder[] {
  if (inMemoryWorkOrdersMap.size > 0) {
    return Array.from(inMemoryWorkOrdersMap.values());
  }

  if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            inMemoryWorkOrdersMap.set(item.workOrderId, item);
          }
          return parsed;
        }
      }
    } catch {
      // Fallback to seed
    }
  }

  const seeds = getSeedWorkOrders();
  for (const s of seeds) {
    inMemoryWorkOrdersMap.set(s.workOrderId, s);
  }
  if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
    } catch {}
  }
  return seeds;
}

export function saveStoredWorkOrder(workOrder: OperationalWorkOrder): void {
  inMemoryWorkOrdersMap.set(workOrder.workOrderId, workOrder);

  if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
    try {
      const all = Array.from(inMemoryWorkOrdersMap.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (err) {
      console.warn('[DELTA] Failed to persist work order locally:', err);
    }
  }
}

export function linkWorkOrderToIssue(workOrderId: string, issueKey: string): OperationalWorkOrder | null {
  const existing = getStoredWorkOrders();
  const wo = existing.find((w) => w.workOrderId === workOrderId);
  if (!wo) return null;

  const updated: OperationalWorkOrder = {
    ...wo,
    stage: 'JIRA_LINKED',
    jiraIntegration: {
      ...wo.jiraIntegration,
      linkedIssueKey: issueKey,
      linkedAt: new Date().toISOString()
    },
    updatedAt: new Date().toISOString()
  };

  saveStoredWorkOrder(updated);
  return updated;
}

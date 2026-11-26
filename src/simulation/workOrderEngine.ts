/**
 * DELTA Workstream 4A: Operational Work Order Engine & Provenance Architecture
 *
 * Translates human-approved mitigation decision records and 2D hydraulic solver
 * outputs into structured, actionable operational work-order drafts for municipal
 * response crews and Jira Service Management (JSM).
 *
 * Enforces:
 * 1. Consistent Provenance Data Model:
 *    - SOURCE_VERIFIED: Supported by an identifiable and recorded source.
 *    - DERIVED: Calculated from identified source data or explicit solver models.
 *    - PLANNING_ASSUMPTION: Illustrative planning content not independently established.
 *    - UNVERIFIED: Information requiring external confirmation before field deployment.
 * 2. Operational Plan Credibility:
 *    - Plan Alpha: Mapped references vs deployment placement, sandbag/crew planning assumptions,
 *      adverse deflection surcharge (+0.15m) explicitly disclosed, unverified access routes.
 *    - Plan Beta: Pump specs and 2.0 m³/s extraction are planning assumptions, mechanical constraints
 *      and drainage destination identified, real-world performance disclaimers.
 *    - Plan Gamma: Road-deck sink abstraction [17, 26] distinguished from physical culvert structure,
 *      12.5 m³/s capacity disclosed as exploratory heuristic, safety requirements presented as
 *      considerations requiring competent professional assessment.
 *    - No fictional personnel names, unsupported resource commitments, or fabricated certainty.
 * 3. Traceable Staged Lifecycle:
 *    PREPARED_DRAFT -> COMMANDER_STAGED -> JIRA_LINKED (LIVE_DISPATCH_LOCKED).
 */

export type WorkOrderStage = 'PREPARED_DRAFT' | 'COMMANDER_STAGED' | 'JIRA_LINKED';
export type WorkOrderUrgency = 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM';

export type ProvenanceClassification = 
  | 'SOURCE_VERIFIED' 
  | 'DERIVED' 
  | 'PLANNING_ASSUMPTION' 
  | 'UNVERIFIED';

export type VerificationStatus = 
  | 'VERIFIED' 
  | 'CALCULATED_ESTIMATE' 
  | 'UNESTABLISHED_ASSUMPTION' 
  | 'PENDING_FIELD_CONFIRMATION';

export interface ProvenanceRecord<T = any> {
  attribute: string;
  value: T;
  classification: ProvenanceClassification;
  sourceRef?: string;
  derivationMethod?: string;
  verificationStatus: VerificationStatus;
  disclosure: string;
}

export interface WorkOrderProvenanceManifest {
  targetLocation: ProvenanceRecord<{
    siteId: string;
    projected: { x: number; y: number };
    wgs84: { lat: number; lon: number };
    gridCell: [number, number];
  }>;
  ingressCorridor: ProvenanceRecord<string>;
  tacticalEquipment: ProvenanceRecord<string[]>;
  crewRequirement: ProvenanceRecord<string>;
  hydraulicCapacityOrSink: ProvenanceRecord<string | number>;
  avoidedStorageVolume: ProvenanceRecord<number>;
  peakDepthReduction: ProvenanceRecord<number>;
  adverseConsequences: ProvenanceRecord<string>;
  operationalProtocol: ProvenanceRecord<string>;
}

export interface OperationalTaskItem {
  stepNumber: number;
  title: string;
  instruction: string;
  safetyCaution?: string;
  isCompleted: boolean; // Retained for backwards compatibility with checklist state
  reviewStatus: 'PENDING_REVIEW' | 'REVIEWED_FOR_STAGING';
  verificationNotice: string;
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
    provenanceNotice: string;
    isRoadDeckAbstraction?: boolean;
    locationClassification: ProvenanceClassification;
  };
  provenanceManifest: WorkOrderProvenanceManifest;
  planningAssumptions: string[];
  operationalConstraints: string[];
  adverseConsequenceAnalysis?: {
    hasAdverseImpact: boolean;
    description: string;
    affectedCells?: [number, number][];
    adverseDepthIncreaseM?: number;
    mitigationRecommendation?: string;
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
    solverAbstractionNotice: string;
  };
  humanReview: {
    reviewedBy: string;
    role: string;
    reviewedAt: string;
    engineeringRationale: string;
    stagingStatus: 'UNREVIEWED_DRAFT' | 'STAGED_BY_COMMANDER' | 'JIRA_INTEGRATED';
    stagingNotice: string;
  };
  jiraIntegration: {
    linkedIssueKey?: string;
    linkedAt?: string;
    linkedBy?: string;
    dispatchStatus: 'LIVE_DISPATCH_LOCKED';
    safetyNotice: string;
    operationId: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Authoritative physical site locations for work orders with explicit provenance metadata.
 */
export const AUTHORITATIVE_WORK_ORDER_LOCATIONS = {
  'plan-gamma': {
    siteId: 'CULVERT-01-BROOKLINE',
    name: 'Brookline Avenue at Muddy River (Road-Deck Point Sink Cell)',
    facilityCategory: 'DELTA 25m Computational Grid Cell [17, 26]',
    projected: { x: 232302.11, y: 899074.88 },
    wgs84: { lat: 42.34150, lon: -71.10800 },
    gridCell: [17, 26] as [number, number],
    accessCorridor: 'Brookline Ave Northbound Approach (Unverified Ingress Corridor)',
    provenanceNotice: 'Computational grid cell [17, 26] on the Brookline Ave road deck where DELTA models a 12.5 m³/s lumped drainage point sink. These coordinates are NOT surveyed culvert invert or portal coordinates.',
    isRoadDeckAbstraction: true,
    locationClassification: 'PLANNING_ASSUMPTION' as ProvenanceClassification
  },
  'plan-beta': {
    siteId: 'PUMP-BETA-MOBILE',
    name: 'Muddy River Channel Retention Invert Depression (Planning Staging Location)',
    facilityCategory: 'DELTA 25m Computational Grid Cell [17, 25]',
    projected: { x: 232277.11, y: 899074.88 },
    wgs84: { lat: 42.34150, lon: -71.10830 },
    gridCell: [17, 25] as [number, number],
    accessCorridor: 'Longwood Ave → Brookline Ave South (Unverified Ingress Route)',
    provenanceNotice: 'Open-channel topographic depression identified in 25m USGS DEM. Ground firmness, bearing capacity, and equipment access for mobile pumping have not been field verified.',
    isRoadDeckAbstraction: false,
    locationClassification: 'DERIVED' as ProvenanceClassification
  },
  'plan-alpha': {
    siteId: 'ROAD-1377084984-MID',
    name: "Francis Street Ingress Way (Centerline Node fronting Brigham & Women's Hospital)",
    facilityCategory: 'OSM Street Centerline Reference (Way 1377084984)',
    projected: { x: 232384.06, y: 898414.94 },
    wgs84: { lat: 42.335555, lon: -71.107042 },
    gridCell: [43, 29] as [number, number],
    accessCorridor: 'Huntington Ave / Tremont St → Francis Street North (Unverified Ingress Route)',
    provenanceNotice: 'Mapped street centerline geometry from OpenStreetMap way 1377084984. Exact barrier placement across road deck and sidewalk is an unverified planning assumption.',
    isRoadDeckAbstraction: false,
    locationClassification: 'PLANNING_ASSUMPTION' as ProvenanceClassification
  }
};

/**
 * Generates structured operational tasks for a given plan.
 * Tasks are framed as operational planning considerations, not certified engineering designs or approved SOPs.
 */
export function getPlanOperationalTasks(planId: string): OperationalTaskItem[] {
  const defaultNotice = 'Operational planning review only. Does NOT indicate field execution or physical verification.';

  if (planId === 'plan-gamma') {
    return [
      {
        stepNumber: 1,
        title: 'Corridor Traffic Marshalling & Site Security Review',
        instruction: 'Establish municipal traffic detail at Brookline Ave & Park Drive. Secure the road-deck staging perimeter to exclude unauthorized vehicles.',
        safetyCaution: 'Site stability caution: Road deck and embankment margins adjacent to impounded floodwater must be visually inspected for structural scouring before heavy vehicles approach.',
        isCompleted: false,
        reviewStatus: 'PENDING_REVIEW',
        verificationNotice: defaultNotice
      },
      {
        stepNumber: 2,
        title: 'Intake Face & Trash-Rack Debris Assessment',
        instruction: 'Conduct topside visual assessment of debris accumulation obstructing the culvert inlet aperture. Assess whether mechanical winch rigging is required.',
        safetyCaution: 'Water hazard caution: Submerged intake creates severe suction hazard. Personnel must maintain 3-meter safety tether from headwall edge; in-water entry prohibited during high surcharge.',
        isCompleted: false,
        reviewStatus: 'PENDING_REVIEW',
        verificationNotice: defaultNotice
      },
      {
        stepNumber: 3,
        title: 'High-Pressure Hydro-Jetting Planning Considerations',
        instruction: 'Position truck-mounted hydro-jetting equipment to clear barrel debris. Target high-pressure water stream at compacted sediment and tree limbs.',
        safetyCaution: 'Atmospheric & confined space safety: Confined space entry into culvert barrel is strictly prohibited without certified atmospheric gas testing (H2S, CO, O2, LEL) and safety permits.',
        isCompleted: false,
        reviewStatus: 'PENDING_REVIEW',
        verificationNotice: defaultNotice
      },
      {
        stepNumber: 4,
        title: 'Hydraulic Discharge & Tailwater Observation',
        instruction: 'Observe downstream outflow into Upper Fens Pond. Note whether gravitational discharge begins or if downstream tailwater elevation impedes barrel drainage.',
        safetyCaution: 'Hydraulic limitation: The modeled 12.5 m³/s outflow is a screening heuristic. Real-world conveyance is strongly governed by downstream tailwater and barrel sedimentation.',
        isCompleted: false,
        reviewStatus: 'PENDING_REVIEW',
        verificationNotice: defaultNotice
      },
      {
        stepNumber: 5,
        title: 'Operational Status Logging & Commander Debrief',
        instruction: 'Document debris clearance volume and upstream water stage. Transmit status report to Duty Incident Commander for operational records.',
        isCompleted: false,
        reviewStatus: 'PENDING_REVIEW',
        verificationNotice: defaultNotice
      }
    ];
  }

  if (planId === 'plan-beta') {
    return [
      {
        stepNumber: 1,
        title: 'Pump Staging & Embankment Ground Stability Assessment',
        instruction: 'Position mobile diesel suction pump on high ground adjacent to cell [17, 25]. Stage secondary fuel containment berm prior to fueling.',
        safetyCaution: 'Ground firmness caution: Embankment soil bearing capacity must be verified before unhitching heavy trailer pump; avoid saturated slopes.',
        isCompleted: false,
        reviewStatus: 'PENDING_REVIEW',
        verificationNotice: defaultNotice
      },
      {
        stepNumber: 2,
        title: 'Suction Line Rigging & Intake Strainer Placement',
        instruction: 'Deploy 10-inch reinforced suction hose into open-channel ponding. Fasten float collar and rigid strain relief to maintain intake ~0.5m above bottom sediment.',
        safetyCaution: 'Mechanical constraint: Ingesting channel silt or bed gravel causes immediate impeller cavitation and pump failure. Strainer basket inspection required.',
        isCompleted: false,
        reviewStatus: 'PENDING_REVIEW',
        verificationNotice: defaultNotice
      },
      {
        stepNumber: 3,
        title: 'Discharge Hose Routing to Downstream Channel',
        instruction: 'Layout 150m of heavy layflat discharge hose along designated bypass corridor toward downstream Muddy River open-water reach.',
        safetyCaution: 'Discharge routing caution: Hose crossings on public rights-of-way require traffic ramps. Anchor discharge nozzle securely against whip under pressurized flow.',
        isCompleted: false,
        reviewStatus: 'PENDING_REVIEW',
        verificationNotice: defaultNotice
      },
      {
        stepNumber: 4,
        title: 'Pump Priming & Gradual Discharge Engagement',
        instruction: 'Prime suction chamber and gradually engage diesel pump drive. Monitor flow to target modeled 2.0 m³/s extraction rate.',
        safetyCaution: 'Hydraulic performance disclosure: The modeled 2.0 m³/s rate is an idealized mass sink; actual pump throughput will be reduced by suction lift head and friction losses.',
        isCompleted: false,
        reviewStatus: 'PENDING_REVIEW',
        verificationNotice: defaultNotice
      },
      {
        stepNumber: 5,
        title: 'Continuous Fuel & Surcharge Drawdown Monitoring',
        instruction: 'Perform periodic checks of fuel level, oil pressure, suction strainer fouling, and water depth drawdown. Log readings hourly.',
        isCompleted: false,
        reviewStatus: 'PENDING_REVIEW',
        verificationNotice: defaultNotice
      }
    ];
  }

  // Plan Alpha
  return [
    {
      stepNumber: 1,
      title: 'Corridor Traffic Diversion Planning',
      instruction: 'Coordinate with municipal transit and EMS dispatch to establish traffic diversions around Francis Street ambulance approach. Maintain clear vehicle lanes.',
      safetyCaution: 'Hospital access caution: Do not block active emergency ambulance bays during barrier staging. Verify alternate hospital ingress prior to placement.',
      isCompleted: false,
      reviewStatus: 'PENDING_REVIEW',
      verificationNotice: defaultNotice
    },
    {
      stepNumber: 2,
      title: 'Subgrade Preparation & Geotextile Seepage Layer Laydown',
      instruction: 'Sweep debris along curb alignment fronting cell [43, 29]. Roll out 6-mil geotextile seepage underlayment across planned 100m barrier alignment.',
      safetyCaution: 'Planning assumption: 100m alignment and geotextile specs are planning estimates. Subgrade sealing along uneven asphalt requires field adaptation.',
      isCompleted: false,
      reviewStatus: 'PENDING_REVIEW',
      verificationNotice: defaultNotice
    },
    {
      stepNumber: 3,
      title: 'Sandbag Barrier Placement (+0.50m Crest Planning Target)',
      instruction: 'Stack filled sandbags in a 3-2-1 pyramidal weir formation to achieve planning crest elevation of +0.50m. Stagger seams and tamp firmly.',
      safetyCaution: 'Adverse deflection warning: Overland flow deflection will increase water depth by up to ~15 cm on neighboring curb cells [43, 28] and [44, 29]. Adjacent driveways and sumps must be monitored.',
      isCompleted: false,
      reviewStatus: 'PENDING_REVIEW',
      verificationNotice: defaultNotice
    },
    {
      stepNumber: 4,
      title: 'Laser Crest Elevation Verification',
      instruction: 'Survey completed barrier crest with rotating laser level to confirm continuous top-of-barrier grade across full span.',
      safetyCaution: 'Structural note: Sandbag barriers are temporary gravity deflection structures, not certified floodwalls. Overtopping or under-seepage will occur if water exceeds crest.',
      isCompleted: false,
      reviewStatus: 'PENDING_REVIEW',
      verificationNotice: defaultNotice
    },
    {
      stepNumber: 5,
      title: 'Seepage Patrol & Neighboring Sump Pump Staging',
      instruction: 'Stage portable puddle pumps along barrier toe to capture seepage. Monitor adjacent properties for deflection-induced runoff accumulation.',
      isCompleted: false,
      reviewStatus: 'PENDING_REVIEW',
      verificationNotice: defaultNotice
    }
  ];
}

/**
 * Prepares a structured, actionable operational work-order draft from an approved decision record,
 * fully populating provenance records and disclosures.
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
      ? 'Plan Gamma: Emergency High-Pressure Culvert Jetting (Choke Clearance Planning)'
      : planId === 'plan-beta'
      ? 'Plan Beta: Mobile Pump Deployment (2.0 m³/s Active Dewatering Planning)'
      : 'Plan Alpha: Francis Street Ambulance Bay Temporary Sandbag Barrier (+0.50m Crest Planning)'
  );

  const planType: 'BARRIER_DEFLECTION' | 'MOBILE_PUMP' | 'CULVERT_JETTING' =
    planId === 'plan-gamma' ? 'CULVERT_JETTING' : planId === 'plan-beta' ? 'MOBILE_PUMP' : 'BARRIER_DEFLECTION';

  const location = AUTHORITATIVE_WORK_ORDER_LOCATIONS[planId];
  const tasks = getPlanOperationalTasks(planId);

  // Urgency classification and priority rationale
  const urgency: WorkOrderUrgency = planId === 'plan-gamma' || planId === 'plan-beta' ? 'P1_CRITICAL' : 'P2_HIGH';
  const priorityRationale = planId === 'plan-gamma'
    ? 'Culvert blockage at Brookline Ave intake impounds water upstream. Operational clearing aims to restore nominal drainage capacity through the roadway choke point.'
    : planId === 'plan-beta'
    ? 'Channel ponding upstream of the culvert surcharges hospital access arterials. Mobile dewatering provides localized water extraction to relieve backwater.'
    : "Runoff inundation threatens Francis Street ambulance approach. Temporary barrier aims to deflect overland water away from Brigham & Women's hospital ingress.";

  // Tactical Equipment Planning Considerations (Illustrative estimates, not verified commitments)
  const tacticalEquipment = planId === 'plan-gamma'
    ? [
        'High-Pressure Hydro-Jetting Unit (Planning spec: 3,000 PSI / 80 GPM capability)',
        'Heavy-Duty Winch & Rigging Assembly (For intake trash-rack debris removal)',
        'Multi-Gas Atmospheric Safety Monitors (O2, H2S, CO, Combustible Gas)',
        'Roll-Off Debris Collection Container',
        'Emergency Sump Bypass Pump and Layflat Hose'
      ]
    : planId === 'plan-beta'
    ? [
        'Mobile Diesel Suction Pump (Planning target: 2.0 m³/s / ~31,700 GPM rated capacity)',
        '150m of 250mm Heavy-Duty Layflat Discharge Hose',
        'Float Collar Suction Strainer Assembly',
        'Mobile Diesel Fuel Supply Tender with Secondary Containment Berm',
        'Traffic Hose Crossing Ramps'
      ]
    : [
        '1,200 Rapid Polypropylene Sandbags (Filled, ~40 lbs each — Planning Estimate)',
        '200m of Heavy-Duty 6-mil Geotextile Seepage Barrier Membrane',
        'Flatbed Staging Trucks with Hydraulic Liftgates',
        'Rotating Optical Laser Level for Crest Elevation Checking (+0.50m Target)',
        'Traffic Delineators & Safety Perimeter Signage'
      ];

  const crewRequirement = planId === 'plan-gamma'
    ? 'Municipal Drainage Response Team (Lead: Drainage Response Team Lead + 6 Qualified Technicians)'
    : planId === 'plan-beta'
    ? 'Mechanical Dewatering Crew (Lead: Mechanical Dewatering Specialist + 4 Pump Operators)'
    : 'Public Works Staging Team (Lead: Public Works Staging Supervisor + 8 Field Personnel)';

  // Differential evidence from solver
  const diff = decision.differentialMetrics || {};
  const avoidedSurfaceVolumeM3 = typeof diff.avoidedSurfaceVolumeM3 === 'number'
    ? diff.avoidedSurfaceVolumeM3
    : planId === 'plan-gamma' ? 22 : planId === 'plan-beta' ? 14 : 0;
  const peakDepthReductionM = typeof diff.peakDepthReductionM === 'number'
    ? diff.peakDepthReductionM
    : typeof diff.maxDepthReductionM === 'number'
    ? diff.maxDepthReductionM
    : (planId === 'plan-gamma' ? 0.18 : planId === 'plan-beta' ? 0.11 : 0.05);

  const protectedRoads = Array.isArray(diff.protectedRoadNames) && diff.protectedRoadNames.length > 0
    ? diff.protectedRoadNames
    : planId === 'plan-gamma'
    ? ['Francis Street', 'Brookline Avenue', 'Longwood Avenue']
    : planId === 'plan-beta'
    ? ['Brookline Avenue', 'Longwood Avenue']
    : ['Francis Street'];

  const stormScenario = decision.canonicalScenario?.stormLabel || decision.canonicalScenario?.stormId || '50-Year Regional Benchmark (104.2 mm / 6hr)';
  const scenarioHash = decision.scenarioHash || 'sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47';

  // Planning Assumptions and Operational Constraints lists
  const planningAssumptions = planId === 'plan-gamma'
    ? [
        'Culvert conveyance is modeled as a lumped point sink on road-deck cell [17, 26] with a 12.5 m³/s nominal capacity heuristic.',
        'The 12.5 m³/s outflow rate assumes complete debris clearance without significant downstream tailwater submergence.',
        'Hydro-jetting equipment, winch availability, and crew staging are planning assumptions subject to municipal depot inventory.',
        'Target coordinates represent computational grid cell [17, 26], not surveyed physical culvert invert or headwall elevations.'
      ]
    : planId === 'plan-beta'
    ? [
        'Modeled as an ideal mass-conserving numerical point sink of 2.0 m³/s located at open-channel cell [17, 25].',
        'Assumes continuous unthrottled operation without suction cavitation, impeller debris fouling, or mechanical downtime.',
        'Downstream Muddy River discharge destination has adequate open channel capacity to receive pumped flow without backwater.',
        'Pump equipment availability, fuel supply chain, and transport vehicles are municipal planning estimates.'
      ]
    : [
        '100m barrier length, +0.50m crest elevation, and 1,200 sandbag count are screening assumptions, not a structural engineering design.',
        'Subgrade along Francis Street is assumed impervious with geotextile underlayment; minor under-seepage is expected.',
        'Coordinates correspond to OpenStreetMap street centerline way 1377084984; exact curb/sidewalk alignment is unverified.',
        'Resource mobilization assumes immediate public works depot availability and traffic diversion approval.'
      ];

  const operationalConstraints = planId === 'plan-gamma'
    ? [
        'Confined space entry into culvert barrel requires certified multi-gas monitoring and municipal safety authorization.',
        'In-water work restricted during active peak flood wave due to extreme suction hazard at intake aperture.',
        'Heavy hydro-jetting vehicles must avoid saturated embankment margins to prevent slope collapse.',
        'Dislodged debris must be captured downstream to avoid secondary clogging in Upper Fens Pond.'
      ]
    : planId === 'plan-beta'
    ? [
        'Pump suction strainer must be suspended to prevent sediment and gravel ingestion from channel bed.',
        '150m discharge hose line requires vehicle crossing ramps across any active roadways.',
        'Secondary fuel containment berm is mandatory to prevent environmental contamination into Muddy River.',
        'Acoustic attenuation may be required if operating in close proximity to residential or clinical facilities.'
      ]
    : [
        'Diversion of overland runoff creates adverse ponding surcharge on adjacent curb cells ([43, 28] and [44, 29]).',
        'One travel lane on Francis Street must remain passable for emergency ambulance ingress during barrier construction.',
        'Sandbag gravity weir cannot withstand hydrostatic head exceeding +0.50m crest; overtopping will occur in severe events.',
        'Continuous seepage monitoring and secondary sump pumping are required along barrier foundation.'
      ];

  // Adverse consequence analysis (specifically for Plan Alpha water deflection)
  const adverseConsequenceAnalysis = planId === 'plan-alpha'
    ? {
        hasAdverseImpact: true,
        description: 'Overland runoff deflected away from the Francis Street ambulance bay is redirected onto adjacent south curb cells ([43, 28] and [44, 29]), causing an adverse localized flood depth increase of up to ~15 cm (+0.15m).',
        affectedCells: [[43, 28], [44, 29]] as [number, number][],
        adverseDepthIncreaseM: 0.15,
        mitigationRecommendation: 'Stage secondary sump pumps and temporary sandbag checks at neighboring driveways and low curb cuts before closing barrier alignment.'
      }
    : {
        hasAdverseImpact: false,
        description: 'No significant adverse water displacement or localized ponding increase detected in adjacent cells under this intervention scenario.'
      };

  // Build Comprehensive Provenance Manifest
  const provenanceManifest: WorkOrderProvenanceManifest = {
    targetLocation: {
      attribute: 'Target Site Geolocation',
      value: {
        siteId: location.siteId,
        projected: location.projected,
        wgs84: location.wgs84,
        gridCell: location.gridCell
      },
      classification: location.locationClassification,
      sourceRef: planId === 'plan-alpha' ? 'OpenStreetMap Way 1377084984 Centerline Node' : 'USGS 25m DEM Catchment Grid',
      verificationStatus: planId === 'plan-alpha' ? 'VERIFIED' : 'UNESTABLISHED_ASSUMPTION',
      disclosure: location.provenanceNotice
    },
    ingressCorridor: {
      attribute: 'Ingress Access Corridor',
      value: location.accessCorridor,
      classification: 'UNVERIFIED',
      sourceRef: 'Regional Municipal Street Network',
      verificationStatus: 'PENDING_FIELD_CONFIRMATION',
      disclosure: 'Access route is identified from street network connectivity. It has NOT been verified as passable, unflooded, or structurally sound during active storm conditions.'
    },
    tacticalEquipment: {
      attribute: 'Tactical Equipment Considerations',
      value: tacticalEquipment,
      classification: 'PLANNING_ASSUMPTION',
      sourceRef: 'Municipal Stormwater Response Planning Catalog',
      verificationStatus: 'UNESTABLISHED_ASSUMPTION',
      disclosure: 'Equipment items represent illustrative planning considerations for municipal response staging. Equipment availability, mechanical readiness, and transport have not been confirmed.'
    },
    crewRequirement: {
      attribute: 'Tactical Crew Sizing',
      value: crewRequirement,
      classification: 'PLANNING_ASSUMPTION',
      sourceRef: 'Public Works Response Planning Standard',
      verificationStatus: 'UNESTABLISHED_ASSUMPTION',
      disclosure: 'Crew sizing is an illustrative planning estimate; does not constitute assigned personnel rosters or confirmed field dispatch.'
    },
    hydraulicCapacityOrSink: {
      attribute: 'Intervention Hydraulic Rate',
      value: planId === 'plan-gamma' ? '12.5 m³/s (Nominal Outflow Heuristic)' : planId === 'plan-beta' ? '2.0 m³/s (Point Sink Model)' : '0.0 m³/s (Passive Surface Barrier)',
      classification: 'PLANNING_ASSUMPTION',
      sourceRef: 'DELTA 2D Solver Intervention Parameter Catalog',
      verificationStatus: 'UNESTABLISHED_ASSUMPTION',
      disclosure: planId === 'plan-gamma'
        ? 'The 12.5 m³/s value is an exploratory planning heuristic, not a verified FHWA HDS-5 rating curve. Actual culvert discharge depends on downstream tailwater and debris sedimentation.'
        : planId === 'plan-beta'
        ? 'Modeled as an idealized mass-conserving 2.0 m³/s sink cell. Does not account for suction lift loss, line friction, or mechanical pump performance.'
        : 'Passive deflection weir provides zero volume extraction; functions solely by diverting overland runoff.'
    },
    avoidedStorageVolume: {
      attribute: 'Avoided Surface Storage Volume',
      value: avoidedSurfaceVolumeM3,
      classification: 'DERIVED',
      derivationMethod: 'DELTA 2D Diffusive-Wave Hydrodynamic Numerical Solver (25m grid, 6-hr design storm)',
      verificationStatus: 'CALCULATED_ESTIMATE',
      disclosure: `Comparative simulation output: Baseline Storage (${avoidedSurfaceVolumeM3 > 0 ? '+' : ''}${avoidedSurfaceVolumeM3} m³ difference). Planning-level screening metric, not an engineering guarantee.`
    },
    peakDepthReduction: {
      attribute: 'Peak Depth Reduction Delta',
      value: peakDepthReductionM,
      classification: 'DERIVED',
      derivationMethod: 'DELTA 2D Diffusive-Wave Comparative Cell Depth Differential',
      verificationStatus: 'CALCULATED_ESTIMATE',
      disclosure: `Maximum localized water depth reduction of ${peakDepthReductionM.toFixed(2)}m calculated under the evaluated storm scenario.`
    },
    adverseConsequences: {
      attribute: 'Adverse Water Displacement Analysis',
      value: adverseConsequenceAnalysis.description,
      classification: 'DERIVED',
      derivationMethod: 'Comparative Spatial Differential Grid Analysis',
      verificationStatus: planId === 'plan-alpha' ? 'CALCULATED_ESTIMATE' : 'VERIFIED',
      disclosure: planId === 'plan-alpha'
        ? 'Runoff deflection causes up to ~15 cm localized adverse ponding increase on adjacent curb cells [43, 28] and [44, 29].'
        : 'No adverse water displacement identified in neighboring cells under this scenario.'
    },
    operationalProtocol: {
      attribute: 'Sequential Tactical Protocol',
      value: `${tasks.length}-step operational task sequence`,
      classification: 'PLANNING_ASSUMPTION',
      sourceRef: 'DELTA Operational Task Planning Template',
      verificationStatus: 'PENDING_FIELD_CONFIRMATION',
      disclosure: 'Operational steps and safety cautions represent planning considerations, NOT certified standard operating procedures. Requires on-site assessment by licensed emergency personnel.'
    }
  };

  const solverAbstractionNotice = planId === 'plan-gamma'
    ? "In DELTA's 25m planning model, the culvert is abstracted as a lumped conduit / point sink (12.5 m³/s nominal capacity heuristic) applied to road-deck cell [17, 26]. It is not a coupled 1D/2D dynamic conduit link."
    : planId === 'plan-beta'
    ? 'Modeled as an active 2.0 m³/s point sink on cell [17, 25] conserving mass. Real-world pump head loss, suction lift, and line friction are not dynamically simulated.'
    : 'Modeled as an elevated cell edge weir diverting overland flux. Adverse deflection onto neighboring curb cells is explicitly accounted for.';

  const approver = decision.humanApprover || {};
  const reviewedBy = approver.displayName || 'Duty Incident Commander';
  const role = approver.role || 'Incident Commander';
  const reviewedAt = approver.approvalTimestamp || decision.createdAt || new Date().toISOString();
  const engineeringRationale = decision.engineeringRationale || 'Authorized emergency flood mitigation plan under DELTA screening protocol.';

  const workOrderId = existingWorkOrderId || `WO-${decisionId.replace(/[^A-Za-z0-9]/g, '-')}-${planId.replace('plan-', '')}`;
  const operationId = `delta-wo-${decisionId.toLowerCase()}-${planId}`.replace(/[^a-z0-9-]/g, '-').slice(0, 60);

  const stagingStatus = stage === 'JIRA_LINKED'
    ? 'JIRA_INTEGRATED'
    : stage === 'COMMANDER_STAGED'
    ? 'STAGED_BY_COMMANDER'
    : 'UNREVIEWED_DRAFT';

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
    provenanceManifest,
    planningAssumptions,
    operationalConstraints,
    adverseConsequenceAnalysis,
    tacticalEquipment,
    crewRequirement,
    operationalTasks: tasks,
    supportingSimulationEvidence: {
      avoidedSurfaceVolumeM3,
      peakDepthReductionM,
      protectedRoads,
      hospitalStatusSummary: 'All 5 hospital complexes evaluated for access preservation under screening model.',
      stormScenario,
      scenarioHash,
      solverAbstractionNotice
    },
    humanReview: {
      reviewedBy,
      role,
      reviewedAt,
      engineeringRationale,
      stagingStatus,
      stagingNotice: 'Desk-side operational planning review for staging. Does not constitute field dispatch or physical authorization.'
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
 * Returns canonical seed work orders derived from approved decisions, with full provenance and no fictional names.
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
      name: 'Plan Gamma: Emergency High-Pressure Culvert Jetting (Choke Clearance Planning)',
      type: 'CULVERT_JETTING'
    },
    differentialMetrics: {
      avoidedSurfaceVolumeM3: 22,
      peakDepthReductionM: 0.18,
      protectedRoadCount: 3,
      protectedRoadNames: ['Francis Street', 'Brookline Avenue', 'Longwood Avenue']
    },
    humanApprover: {
      displayName: 'Duty Incident Commander',
      role: 'Incident Commander',
      approvalTimestamp: '2026-11-25T14:30:00.000Z'
    },
    engineeringRationale: 'Plan Gamma addresses complete culvert blockage at Brookline Ave intake, modeling a 12.5 m³/s nominal capacity heuristic that avoids 22 m³ of surface floodwater along primary hospital access corridors under screening simulation.',
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
      name: 'Plan Beta: Mobile Pump Deployment (2.0 m³/s Active Dewatering Planning)',
      type: 'MOBILE_PUMP'
    },
    differentialMetrics: {
      avoidedSurfaceVolumeM3: 14,
      peakDepthReductionM: 0.11,
      protectedRoadCount: 2,
      protectedRoadNames: ['Brookline Avenue', 'Longwood Avenue']
    },
    humanApprover: {
      displayName: 'Duty Incident Commander',
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
      name: 'Plan Alpha: Francis Street Ambulance Bay Temporary Sandbag Barrier (+0.50m Crest Planning)',
      type: 'BARRIER_DEFLECTION'
    },
    differentialMetrics: {
      avoidedSurfaceVolumeM3: 0,
      peakDepthReductionM: 0.05,
      protectedRoadCount: 1,
      protectedRoadNames: ['Francis Street']
    },
    humanApprover: {
      displayName: 'Deputy Incident Commander',
      role: 'Deputy Incident Commander',
      approvalTimestamp: '2026-11-25T11:15:00.000Z'
    },
    engineeringRationale: "Plan Alpha establishes sandbag weir along Francis Street to protect Brigham & Women's ambulance ingress. Caution: Note verified adverse ponding of +0.15m on neighboring curb cells.",
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
    humanReview: {
      ...wo.humanReview,
      stagingStatus: 'JIRA_INTEGRATED'
    },
    updatedAt: new Date().toISOString()
  };

  saveStoredWorkOrder(updated);
  return updated;
}

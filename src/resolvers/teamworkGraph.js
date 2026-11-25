/**
 * DELTA Phase 4: Atlassian Teamwork Graph (TWG) Integration
 * 
 * Provides structured entity graph query interface connecting:
 * - Critical Healthcare Facilities (5 Hospital Complexes)
 * - Municipal Drainage Infrastructure (Culverts, Sinks, Siphons)
 * - Emergency Incident Issues & JSM Field Work Orders
 * 
 * Complies with Atlassian Teamwork Graph entity/relationship schema in preview.
 */

/**
 * Authoritative Teamwork Graph nodes for Longwood Medical Area & Muddy River catchment.
 */
export const AUTHORITATIVE_GRAPH_NODES = [
  // 1. Healthcare Facilities
  {
    id: 'FACILITY-BWH',
    type: 'HEALTHCARE_FACILITY',
    name: "Brigham and Women's Hospital",
    metadata: {
      address: '75 Francis St, Boston, MA 02115',
      coordinates: { lat: 42.3359, lon: -71.1070 },
      criticalityLevel: 'CRITICAL_P1',
      leadAgency: 'Mass General Brigham Health System'
    }
  },
  {
    id: 'FACILITY-BCH',
    type: 'HEALTHCARE_FACILITY',
    name: "Boston Children's Hospital",
    metadata: {
      address: '300 Longwood Ave, Boston, MA 02115',
      coordinates: { lat: 42.3375, lon: -71.1054 },
      criticalityLevel: 'CRITICAL_P1',
      leadAgency: 'Pediatric Trauma Center Level 1'
    }
  },
  {
    id: 'FACILITY-BIDMC-EAST',
    type: 'HEALTHCARE_FACILITY',
    name: 'Beth Israel Deaconess Medical Center (East Campus)',
    metadata: {
      address: '330 Brookline Ave, Boston, MA 02115',
      coordinates: { lat: 42.3392, lon: -71.1086 },
      criticalityLevel: 'CRITICAL_P1',
      leadAgency: 'Beth Israel Lahey Health'
    }
  },
  {
    id: 'FACILITY-BIDMC-WEST',
    type: 'HEALTHCARE_FACILITY',
    name: 'Beth Israel Deaconess Medical Center (West Campus)',
    metadata: {
      address: '185 Pilgrim Rd, Boston, MA 02115',
      coordinates: { lat: 42.3401, lon: -71.1092 },
      criticalityLevel: 'CRITICAL_P1',
      leadAgency: 'Beth Israel Lahey Health'
    }
  },
  {
    id: 'FACILITY-DFCI',
    type: 'HEALTHCARE_FACILITY',
    name: 'Dana-Farber Cancer Institute',
    metadata: {
      address: '450 Brookline Ave, Boston, MA 02115',
      coordinates: { lat: 42.3385, lon: -71.1042 },
      criticalityLevel: 'CRITICAL_P1',
      leadAgency: 'Comprehensive Cancer Center'
    }
  },

  // 2. Municipal Drainage Infrastructure Nodes
  {
    id: 'DRAIN-CULVERT-01',
    type: 'MUNICIPAL_DRAINAGE',
    name: 'Brookline Avenue Culvert (CULVERT-01-BROOKLINE)',
    metadata: {
      coordinates: { lat: 42.3412, lon: -71.1097 },
      capacityM3PerSec: 12.5,
      conveyanceStatus: 'BLOCKED_100%',
      criticalityLevel: 'CRITICAL_P1',
      leadAgency: 'Boston Water and Sewer Commission (BWSC)'
    }
  },
  {
    id: 'DRAIN-BASIN-02',
    type: 'MUNICIPAL_DRAINAGE',
    name: 'Muddy River Retention Channel Basin',
    metadata: {
      coordinates: { lat: 42.3435, lon: -71.1048 },
      capacityM3PerSec: 8.0,
      conveyanceStatus: 'NOMINAL',
      criticalityLevel: 'HIGH_P2',
      leadAgency: 'MA Department of Conservation and Recreation (DCR)'
    }
  },

  // 3. Operational Jira Incident & Dispatch Nodes
  {
    id: 'ISSUE-EMERG-101',
    type: 'INCIDENT_ISSUE',
    name: 'EMERG-101: Severe Flash Flood Warning & Longwood Medical Access Choke',
    metadata: {
      coordinates: { lat: 42.3385, lon: -71.1070 },
      criticalityLevel: 'CRITICAL_P1',
      leadAgency: 'City of Boston Emergency Operations Center (EOC)'
    }
  },
  {
    id: 'WORKORDER-JSM-4903',
    type: 'DISPATCH_WORK_ORDER',
    name: 'JSM-4903: Field Crew Hydro-Jetting Deployment at Brookline Culvert',
    metadata: {
      coordinates: { lat: 42.3412, lon: -71.1097 },
      criticalityLevel: 'CRITICAL_P1',
      leadAgency: 'Rapid Tactical Emergency Response Crew #01'
    }
  }
];

export const AUTHORITATIVE_GRAPH_EDGES = [
  // Facilities drained by Brookline Culvert
  {
    id: 'EDGE-01',
    sourceNodeId: 'FACILITY-BWH',
    targetNodeId: 'DRAIN-CULVERT-01',
    relationType: 'DRAINED_BY',
    attributes: { primaryCatchment: 'Francis St Basin' }
  },
  {
    id: 'EDGE-02',
    sourceNodeId: 'FACILITY-BIDMC-EAST',
    targetNodeId: 'DRAIN-CULVERT-01',
    relationType: 'DRAINED_BY',
    attributes: { primaryCatchment: 'Brookline Ave Corridor' }
  },
  {
    id: 'EDGE-03',
    sourceNodeId: 'FACILITY-BIDMC-WEST',
    targetNodeId: 'DRAIN-CULVERT-01',
    relationType: 'DRAINED_BY',
    attributes: { primaryCatchment: 'Pilgrim Rd Inflow' }
  },
  {
    id: 'EDGE-04',
    sourceNodeId: 'FACILITY-BCH',
    targetNodeId: 'DRAIN-BASIN-02',
    relationType: 'DRAINED_BY',
    attributes: { primaryCatchment: 'Longwood East Canal' }
  },
  // Incident governing and dispatching
  {
    id: 'EDGE-05',
    sourceNodeId: 'ISSUE-EMERG-101',
    targetNodeId: 'FACILITY-BWH',
    relationType: 'ACCESS_CORRIDOR_FOR',
    attributes: { accessPriority: 'LEVEL_1_TRAUMA' }
  },
  {
    id: 'EDGE-06',
    sourceNodeId: 'ISSUE-EMERG-101',
    targetNodeId: 'WORKORDER-JSM-4903',
    relationType: 'DISPATCHED_TO',
    attributes: { slaMinutes: 12 }
  },
  {
    id: 'EDGE-07',
    sourceNodeId: 'WORKORDER-JSM-4903',
    targetNodeId: 'DRAIN-CULVERT-01',
    relationType: 'GOVERNS',
    attributes: { fieldAction: 'EMERGENCY_CULVERT_CLEARANCE' }
  }
];

/**
 * Queries the complete municipal & healthcare Teamwork Graph for Boston Longwood.
 * @param {string} [filterType] - Optional node type filter
 * @returns {Promise<Object>} Graph result
 */
export async function queryTeamworkGraph(filterType = null) {
  const nodes = filterType 
    ? AUTHORITATIVE_GRAPH_NODES.filter(n => n.type === filterType)
    : AUTHORITATIVE_GRAPH_NODES;

  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = AUTHORITATIVE_GRAPH_EDGES.filter(
    e => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId)
  );

  return {
    success: true,
    nodes,
    edges: filterType ? edges : AUTHORITATIVE_GRAPH_EDGES,
    queriedAt: new Date().toISOString(),
    sector: 'Boston Longwood Medical Area & Muddy River Basin'
  };
}

/**
 * Queries upstream/downstream drainage dependencies for a specific healthcare facility.
 * @param {string} facilityId - Facility ID
 * @returns {Promise<Object>} Dependencies
 */
export async function queryFacilityDrainageDependencies(facilityId) {
  const facility = AUTHORITATIVE_GRAPH_NODES.find(n => n.id === facilityId) || null;
  if (!facility) {
    return { success: false, facility: null, drainingNodes: [], activeDispatches: [] };
  }

  const drainageEdgeTargets = AUTHORITATIVE_GRAPH_EDGES
    .filter(e => e.sourceNodeId === facilityId && e.relationType === 'DRAINED_BY')
    .map(e => e.targetNodeId);

  const drainingNodes = AUTHORITATIVE_GRAPH_NODES.filter(n => drainageEdgeTargets.includes(n.id));

  const activeDispatches = AUTHORITATIVE_GRAPH_NODES.filter(n => 
    n.type === 'DISPATCH_WORK_ORDER'
  );

  return {
    success: true,
    facility,
    drainingNodes,
    activeDispatches
  };
}

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

import api, { route } from '@forge/api';
import { resolveTrustedProject } from './projectContext.js';

function hasForgeRuntime() {
  return typeof globalThis !== 'undefined' && (typeof globalThis.__forge_fetch__ === 'function' || typeof globalThis.__forge_local_fetch__ === 'function');
}

export async function fetchLiveJiraNodes(projectKey, options = {}) {
  if (!projectKey) return { nodes: [], edges: [], liveStatus: 'NO_PROJECT_CONTEXT' };
  const jql = `project = "${projectKey}" ORDER BY updated DESC`;
  let issues = [];
  try {
    if (typeof options.customJiraClient?.searchJira === 'function') {
      issues = await options.customJiraClient.searchJira(jql);
    } else if (typeof options.customJiraClient?.requestJira === 'function') {
      const res = await options.customJiraClient.requestJira(`/rest/api/3/issue/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=key,summary,status,issuetype,labels`, { method: 'GET' });
      issues = Array.isArray(res?.issues) ? res.issues : (Array.isArray(res) ? res : []);
    } else if (hasForgeRuntime()) {
      const resp = await api.asApp().requestJira(route`/rest/api/3/issue/search?jql=${jql}&maxResults=50&fields=key,summary,status,issuetype,labels`);
      if (!resp.ok) return { nodes: [], edges: [], liveStatus: `JIRA_QUERY_FAILED_${resp.status}` };
      issues = (await resp.json()).issues || [];
    } else {
      return { nodes: [], edges: [], liveStatus: 'OFFLINE_NO_FORGE_RUNTIME' };
    }
  } catch (e) { return { nodes: [], edges: [], liveStatus: `JIRA_QUERY_ERROR: ${e.message}` }; }
  const nodes = issues.map(issue => {
    const key = issue.key; const summary = issue.fields?.summary || issue.summary || '';
    const labels = issue.fields?.labels || issue.labels || [];
    const isWorkOrder = labels.includes('delta-dispatch') || /dispatch|work order/i.test(summary);
    return { id: `ISSUE-${key}`, type: isWorkOrder ? 'DISPATCH_WORK_ORDER' : 'INCIDENT_ISSUE', name: `${key}: ${summary}`, metadata: { issueKey: key, status: issue.fields?.status?.name || issue.status || null, issueType: issue.fields?.issuetype?.name || null, labels, live: true } };
  });
  const edges = nodes.filter(n => n.type === 'DISPATCH_WORK_ORDER').map((n, i) => ({ id: `EDGE-LIVE-${i+1}`, sourceNodeId: n.id, targetNodeId: 'DRAIN-CULVERT-01', relationType: 'GOVERNS', attributes: { fieldAction: 'LIVE_JIRA_DISPATCH' } }));
  return { nodes, edges, liveStatus: 'LIVE_JIRA' };
}

/**
 * Spatial Teamwork Graph nodes for Longwood Medical Area & Muddy River catchment.
 * Live incident/work-order nodes are fetched from Jira (fetchLiveJiraNodes), never hard-coded.
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
  {
    id: 'EDGE-05',
    sourceNodeId: 'FACILITY-DFCI',
    targetNodeId: 'DRAIN-BASIN-02',
    relationType: 'DRAINED_BY',
    attributes: { primaryCatchment: 'Brookline Ave South Basin' }
  },
  {
    id: 'EDGE-06',
    sourceNodeId: 'DRAIN-CULVERT-01',
    targetNodeId: 'DRAIN-BASIN-02',
    relationType: 'FLOWS_TO',
    attributes: { conveyance: 'Muddy River Retention Channel' }
  },
  {
    id: 'EDGE-07',
    sourceNodeId: 'FACILITY-BWH',
    targetNodeId: 'DRAIN-BASIN-02',
    relationType: 'DRAINED_BY',
    attributes: { primaryCatchment: 'Francis St Secondary Basin', secondary: true }
  }
];

/**
 * Queries the complete municipal & healthcare Teamwork Graph for Boston Longwood.
 * @param {string} [filterType] - Optional node type filter
 * @returns {Promise<Object>} Graph result
 */
export async function queryTeamworkGraph(filterType = null, options = {}) {
  const projectKey = options.projectKey || resolveTrustedProject(options.context).projectKey || null;
  const live = await fetchLiveJiraNodes(projectKey, options);
  const allNodes = [...AUTHORITATIVE_GRAPH_NODES, ...live.nodes];
  const allEdges = [...AUTHORITATIVE_GRAPH_EDGES, ...live.edges];
  const nodes = filterType ? allNodes.filter(n => n.type === filterType) : allNodes;
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = allEdges.filter(e => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId));
  return { success: true, nodes, edges, queriedAt: new Date().toISOString(), sector: 'Boston Longwood Medical Area & Muddy River Basin', projectKey, liveStatus: live.liveStatus };
}

/**
 * Queries upstream/downstream drainage dependencies for a specific healthcare facility.
 * @param {string} facilityId - Facility ID
 * @returns {Promise<Object>} Dependencies
 */
export async function queryFacilityDrainageDependencies(facilityId, options = {}) {
  const facility = AUTHORITATIVE_GRAPH_NODES.find(n => n.id === facilityId) || null;
  if (!facility) return { success: false, facility: null, drainingNodes: [], activeDispatches: [] };
  const drainageEdgeTargets = AUTHORITATIVE_GRAPH_EDGES.filter(e => e.sourceNodeId === facilityId && e.relationType === 'DRAINED_BY').map(e => e.targetNodeId);
  // Prefer primary (non-secondary) drainage target when present.
  const primary = AUTHORITATIVE_GRAPH_EDGES.filter(e => e.sourceNodeId === facilityId && e.relationType === 'DRAINED_BY' && !e.attributes?.secondary).map(e => e.targetNodeId);
  const drainingNodes = AUTHORITATIVE_GRAPH_NODES.filter(n => (primary.length ? primary : drainageEdgeTargets).includes(n.id));
  const projectKey = options.projectKey || resolveTrustedProject(options.context).projectKey || null;
  const live = await fetchLiveJiraNodes(projectKey, options);
  const activeDispatches = live.nodes.filter(n => n.type === 'DISPATCH_WORK_ORDER');
  return { success: true, facility, drainingNodes, activeDispatches, liveStatus: live.liveStatus };
}

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

/**
 * Real Atlassian GraphQL Teamwork Graph lookup (gateway.api.atlassian.com/graphql).
 * Public-preview API, no allowlisting. Best-effort: any failure returns TWG_UNAVAILABLE
 * and callers merge Jira nodes — never fabricated as graph data.
 */
export async function fetchTeamworkGraphContext(options = {}) {
  const query = 'flood drainage culvert Longwood';
  try {
    if (typeof options.customGraphClient?.search === 'function') {
      const r = await options.customGraphClient.search(query);
      const items = Array.isArray(r) ? r : (r?.results || r?.nodes || []);
      return { nodes: items.map((it, i) => ({ id: it.id || `TWG-${i + 1}`, type: it.type || 'TEAMWORK_GRAPH_ENTITY', name: it.name || it.title || 'Related entity', metadata: { url: it.url || null, source: 'teamwork-graph', summary: it.summary || it.excerpt || null } })), liveStatus: 'LIVE_TEAMWORK_GRAPH' };
    }
    if (hasForgeRuntime() && typeof api.asApp().requestGraphQL === 'function') {
      const resp = await api.asApp().requestGraphQL(`query { search(query: "${query}") { results { id title url type excerpt } } }`).catch(() => null);
      const json = resp?.data ? resp : (resp?.json ? await resp.json().catch(() => null) : null);
      const results = json?.data?.search?.results || [];
      if (!results.length) return { nodes: [], liveStatus: 'TWG_UNAVAILABLE' };
      return { nodes: results.map((it, i) => ({ id: it.id || `TWG-${i + 1}`, type: it.type || 'TEAMWORK_GRAPH_ENTITY', name: it.title || 'Related entity', metadata: { url: it.url || null, source: 'teamwork-graph', summary: it.excerpt || null } })), liveStatus: 'LIVE_TEAMWORK_GRAPH' };
    }
  } catch { return { nodes: [], liveStatus: 'TWG_UNAVAILABLE' }; }
  return { nodes: [], liveStatus: 'TWG_UNAVAILABLE' };
}

export async function fetchRelatedContext(projectKey, options = {}) {
  const nodes = []; const statuses = [];
  const like = (v) => typeof v === 'string' && v.length > 0;
  const push = (arr, prefix) => { for (const it of arr || []) nodes.push({ id: `${prefix}-${it.id || it.key || nodes.length + 1}`, type: prefix === 'CONFLUENCE' ? 'RUNBOOK' : prefix === 'COMPASS' ? 'SERVICE_OWNER' : 'TEAMWORK_GRAPH_ENTITY', name: it.title || it.name || it.key || 'Related context', metadata: { url: it.url || it.self || null, source: prefix.toLowerCase(), summary: it.excerpt || it.summary || null } }); };
  try {
    if (options.customJiraClient?.requestConfluence) { const r = await options.customJiraClient.requestConfluence('/wiki/rest/api/content/search?cql=text~"flood%20drainage"&limit=5'); push(Array.isArray(r) ? r : r?.results, 'CONFLUENCE'); statuses.push('LIVE_CONFLUENCE'); }
    else if (options.customConfluenceClient?.search) { const r = await options.customConfluenceClient.search('flood drainage'); push(Array.isArray(r) ? r : r?.results, 'CONFLUENCE'); statuses.push('LIVE_CONFLUENCE'); }
    else if (hasForgeRuntime()) { const resp = await api.asApp().requestConfluence(route`/wiki/rest/api/content/search?cql=text~"flood drainage"&limit=5`).catch(() => null); if (resp?.ok) { const j = await resp.json(); push(j?.results, 'CONFLUENCE'); statuses.push('LIVE_CONFLUENCE'); } else statuses.push('CONFLUENCE_UNAVAILABLE'); }
    else statuses.push('CONFLUENCE_UNAVAILABLE');
  } catch { statuses.push('CONFLUENCE_UNAVAILABLE'); }
  try {
    if (options.customGraphClient?.requestCompass) { const r = await options.customGraphClient.requestCompass(); push(Array.isArray(r) ? r : r?.components, 'COMPASS'); statuses.push('LIVE_COMPASS'); }
    else statuses.push('COMPASS_UNAVAILABLE');
  } catch { statuses.push('COMPASS_UNAVAILABLE'); }
  // Historical incidents = labeled Jira issues (real), never invented.
  try {
    if (projectKey && hasForgeRuntime()) { /* covered by fetchLiveJiraNodes in queryTeamworkGraph */ statuses.push('HISTORY_VIA_JIRA'); }
    else if (projectKey && options.customJiraClient) statuses.push('HISTORY_VIA_JIRA');
  } catch { /* ignore */ }
  void like;
  return { nodes, liveStatus: statuses.join('+') || 'CONTEXT_UNAVAILABLE' };
}

export async function fetchLiveJiraNodes(projectKey, options = {}) {
  if (!projectKey) return { nodes: [], edges: [], liveStatus: 'NO_PROJECT_CONTEXT' };
  const jql = `project = "${projectKey}" ORDER BY updated DESC`;
  let issues = [];
  try {
    if (typeof options.customJiraClient?.searchJira === 'function') {
      issues = await options.customJiraClient.searchJira(jql);
    } else if (typeof options.customJiraClient?.requestJira === 'function') {
      const res = await options.customJiraClient.requestJira('/rest/api/3/search/jql', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ jql, maxResults: 50, fields: ['summary', 'status', 'priority', 'issuetype', 'created', 'labels'] })
      });
      issues = Array.isArray(res?.issues) ? res.issues : (Array.isArray(res) ? res : []);
    } else if (hasForgeRuntime()) {
      const resp = await api.asApp().requestJira(route`/rest/api/3/search/jql`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ jql, maxResults: 50, fields: ['summary', 'status', 'priority', 'issuetype', 'created', 'labels'] })
      });
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
  const twg = await fetchTeamworkGraphContext(options);
  const related = await fetchRelatedContext(projectKey, options);
  const contextNodes = [...twg.nodes, ...related.nodes];
  const contextEdges = contextNodes.map((n, i) => ({ id: `EDGE-CTX-${i + 1}`, sourceNodeId: n.id, targetNodeId: 'DRAIN-CULVERT-01', relationType: 'RELATED_TO', attributes: { source: n.metadata?.source || 'context' } }));
  const allNodes = [...AUTHORITATIVE_GRAPH_NODES, ...live.nodes, ...contextNodes];
  const allEdges = [...AUTHORITATIVE_GRAPH_EDGES, ...live.edges, ...contextEdges];
  const nodes = filterType ? allNodes.filter(n => n.type === filterType) : allNodes;
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = allEdges.filter(e => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId));
  const liveStatus = [live.liveStatus, twg.liveStatus, related.liveStatus].filter(Boolean).join('+');
  return { success: true, nodes, edges, queriedAt: new Date().toISOString(), sector: 'Boston Longwood Medical Area & Muddy River Basin', projectKey, liveStatus };
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

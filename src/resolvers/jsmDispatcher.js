/**
 * DELTA Field Dispatcher for Jira Service Management (JSM) & Jira Core
 * 
 * Automatically formats and dispatches actionable incident response tickets via
 * Jira REST API v3 (/rest/api/3/issue) using Forge asApp() with write:jira-work scope.
 * 
 * Embeds precise EPSG:26986 & WGS84 coordinates, equipment logistics, hospital route
 * access corridors, and immutable Decision Record audit links.
 */

import api, { route } from '@forge/api';
import { getDecision } from './decisionStorage.js';

/**
 * Builds an Atlassian Document Format (ADF) document for Jira issue description.
 */
export function buildDispatchAdfDescription(dispatchOrder, decisionRecord) {
  const { targetLocation, equipment, priority, timeToCriticalInundation, accessCorridor } = dispatchOrder;
  const approver = decisionRecord?.humanApprover;
  const plan = decisionRecord?.chosenPlan;

  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '🚨 CRITICAL HYDRAULIC DISPATCH ORDER' }]
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Authorized by: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: `${approver?.displayName || 'Incident Commander'} (${approver?.role || 'Human Approver'})\n` },
          { type: 'text', text: 'Decision Audit ID: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: `${decisionRecord?.decisionId || dispatchOrder.decisionId}\n` },
          { type: 'text', text: 'Approved Mitigation Plan: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: `${plan?.name || 'Hydraulic Mitigation Protocol'}` }
        ]
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '📍 Target Coordinates & Staging Location' }]
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Site Name: ', marks: [{ type: 'strong' }] },
                { type: 'text', text: targetLocation?.name || 'Brookline Avenue Culvert Intake' }
              ]
            }]
          },
          {
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Geodetic (WGS84): ', marks: [{ type: 'strong' }] },
                { type: 'text', text: targetLocation?.wgs84 || '42.33890° N, 71.10980° W' }
              ]
            }]
          },
          {
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Projected Grid (EPSG:26986 NAD83 Massachusetts): ', marks: [{ type: 'strong' }] },
                { type: 'text', text: targetLocation?.epsg26986 || 'Easting: 233,400 m, Northing: 894,200 m' }
              ]
            }]
          },
          {
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Designated Clear Access Corridor: ', marks: [{ type: 'strong' }] },
                { type: 'text', text: accessCorridor || 'Longwood Ave → Brookline Ave South (Francis St inbound clear)' }
              ]
            }]
          }
        ]
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '🛠 Required Equipment & Response SLA' }]
      },
      {
        type: 'bulletList',
        content: (equipment || ['1x High-Capacity Diesel Pump (12.5 m³/s)', '500x Heavy-Duty Sandbag Units']).map(item => ({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: item }]
          }]
        }))
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Operational Priority: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: `${priority || 'Highest'}\n` },
          { type: 'text', text: 'Time Before Critical Hospital Artery Inundation: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: `${timeToCriticalInundation || '45 minutes'}` }
        ]
      }
    ]
  };
}

/**
 * Creates a Jira issue for a field team dispatch.
 * 
 * @param {object} dispatchOrder - Order parameters including decisionId, targetLocation, etc.
 * @param {object} [customJiraClient] - Optional injected client for unit testing
 */
export async function createDispatchTicket(dispatchOrder, customJiraClient = null) {
  if (!dispatchOrder?.decisionId) {
    throw new Error('JSM Dispatch Error: decisionId is required to issue a field dispatch ticket.');
  }

  // Retrieve the immutable Decision Record from KVS
  const decisionResult = await getDecision(dispatchOrder.decisionId);
  if (!decisionResult.success || !decisionResult.data) {
    throw new Error(`JSM Dispatch Error: Decision Record '${dispatchOrder.decisionId}' was not found in KVS.`);
  }

  const decision = decisionResult.data;
  const projectKey = dispatchOrder.projectKey || 'EMERG';
  const issueTypeName = dispatchOrder.issueType || 'Task';
  const summary = dispatchOrder.summary || 
    `FIELD DISPATCH: ${decision.chosenPlan?.name || 'Hydraulic Mitigation'} [${decision.decisionId}]`;

  const adfDescription = buildDispatchAdfDescription(dispatchOrder, decision);

  const issuePayload = {
    fields: {
      project: { key: projectKey },
      summary: summary.slice(0, 250),
      issuetype: { name: issueTypeName },
      priority: { name: dispatchOrder.priority || 'High' },
      description: adfDescription
    }
  };

  // Live Jira API call via Forge asApp()
  if (!customJiraClient) {
    const hasForgeRuntime = typeof globalThis !== 'undefined' && 
      (typeof globalThis.__forge_fetch__ === 'function' || typeof globalThis.__forge_local_fetch__ === 'function');

    if (hasForgeRuntime) {
      const response = await api.asApp().requestJira(route`/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(issuePayload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Jira API call failed with HTTP ${response.status}: ${errText}`);
      }

      const created = await response.json();
      return {
        success: true,
        issueKey: created.key,
        issueId: created.id,
        self: created.self,
        decisionId: decision.decisionId,
        coordinates: dispatchOrder.targetLocation
      };
    } else {
      // Mock fallback for test/offline environments
      const mockKey = `${projectKey}-${Math.floor(100 + Math.random() * 900)}`;
      return {
        success: true,
        issueKey: mockKey,
        issueId: '10999',
        self: `https://test.atlassian.net/rest/api/3/issue/${mockKey}`,
        decisionId: decision.decisionId,
        coordinates: dispatchOrder.targetLocation,
        isSimulated: true
      };
    }
  }

  // Use custom injected client (used in unit tests)
  const result = await customJiraClient.requestJira('/rest/api/3/issue', {
    method: 'POST',
    body: issuePayload
  });

  return {
    success: true,
    issueKey: result.key,
    issueId: result.id,
    self: result.self,
    decisionId: decision.decisionId,
    coordinates: dispatchOrder.targetLocation
  };
}

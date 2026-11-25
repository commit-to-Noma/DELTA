/**
 * Jira Service Management (JSM) & Field Dispatch Integration Test Suite
 * 
 * Verifies dispatch ticket generation:
 * - ADF format verification with exact EPSG:26986 & WGS84 coordinates
 * - Equipment list and response SLA
 * - Decision Record linkage verification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createDispatchTicket, buildDispatchAdfDescription } from '../src/resolvers/jsmDispatcher.js';
import { recordDecision, __resetInMemoryStore } from '../src/resolvers/decisionStorage.js';

describe('JSM Field Dispatch Ticket Suite', () => {
  beforeEach(() => {
    __resetInMemoryStore();
  });

  const SAMPLE_DECISION = {
    decisionId: 'DEC-2026-0050',
    scenarioHash: 'hash-abc12345',
    baselineStorm: 'NOAA Atlas 14 100-Year 6-Hour Event',
    chosenPlan: {
      planId: 'plan-beta',
      name: 'Plan Beta: Clear Brookline Avenue Culvert & Deploy High-Capacity Pump #1',
      inundationReduction: '-46.2%',
      hospitalDelayMinutes: 2.1,
      confidence: 0.948,
      tradeOffSummary: 'Restores culvert conveyance to 12.5 m³/s.'
    },
    humanApprover: {
      displayName: 'Captain Sarah Connor',
      role: 'Incident Commander',
      approvalTimestamp: '2026-11-25T08:45:00.000Z'
    },
    physicalMetrics: {
      peakInundationDepthCm: 11.4
    },
    status: 'APPROVED',
    linkedIssueKey: 'EMERG-300'
  };

  const SAMPLE_ORDER = {
    decisionId: 'DEC-2026-0050',
    projectKey: 'EMERG',
    priority: 'Highest',
    timeToCriticalInundation: '35 minutes',
    targetLocation: {
      name: 'Brookline Avenue Culvert Intake (Muddy River)',
      wgs84: '42.33890° N, 71.10980° W',
      epsg26986: 'Easting: 233,400 m, Northing: 894,200 m',
      cell: '[Row 28, Col 42]'
    },
    equipment: [
      '1x High-Capacity Diesel Submersible Pump (12.5 m³/s rated)',
      '500x Rapid-Deploy Sandbag Modules',
      '2x Hydraulic Jetting Trucks for Debris Extraction'
    ],
    accessCorridor: 'Longwood Ave → Brookline Ave South (Francis St ambulance lane maintained)'
  };

  it('TEST-JSM-01: Generates valid ADF document with coordinates and equipment', () => {
    const adf = buildDispatchAdfDescription(SAMPLE_ORDER, SAMPLE_DECISION);
    expect(adf.type).toBe('doc');
    expect(adf.version).toBe(1);

    const jsonStr = JSON.stringify(adf);
    expect(jsonStr).toContain('Captain Sarah Connor');
    expect(jsonStr).toContain('DEC-2026-0050');
    expect(jsonStr).toContain('42.33890° N, 71.10980° W');
    expect(jsonStr).toContain('Easting: 233,400 m, Northing: 894,200 m');
    expect(jsonStr).toContain('12.5 m³/s');
    expect(jsonStr).toContain('Longwood Ave');
  });

  it('TEST-JSM-02: Rejects dispatch when decisionId is missing', async () => {
    await expect(createDispatchTicket({}))
      .rejects.toThrow(/decisionId is required/);
  });

  it('TEST-JSM-03: Rejects dispatch when Decision Record does not exist in KVS', async () => {
    await expect(createDispatchTicket({ decisionId: 'DEC-NONEXISTENT' }))
      .rejects.toThrow(/was not found in KVS/);
  });

  it('TEST-JSM-04: Successfully creates dispatch issue via mocked Jira client', async () => {
    await recordDecision(SAMPLE_DECISION);

    let recordedEndpoint = '';
    let recordedBody: any = null;

    const mockJiraClient = {
      async requestJira(path: string, options: any) {
        recordedEndpoint = path;
        recordedBody = options.body;
        return {
          id: '10555',
          key: 'EMERG-404',
          self: 'https://nomathembancube2005.atlassian.net/rest/api/3/issue/10555'
        };
      }
    };

    const result = await createDispatchTicket(SAMPLE_ORDER, mockJiraClient);

    expect(result.success).toBe(true);
    expect(result.issueKey).toBe('EMERG-404');
    expect(result.decisionId).toBe('DEC-2026-0050');
    expect(result.coordinates.wgs84).toBe('42.33890° N, 71.10980° W');

    expect(recordedEndpoint).toBe('/rest/api/3/issue');
    expect(recordedBody.fields.project.key).toBe('EMERG');
    expect(recordedBody.fields.summary).toContain('FIELD DISPATCH');
    expect(recordedBody.fields.priority.name).toBe('Highest');
    expect(recordedBody.fields.description.type).toBe('doc');
  });

  it('TEST-JSM-05: Operates safely with fallback simulation in offline/test environment', async () => {
    await recordDecision(SAMPLE_DECISION);

    // Call without custom client in node/vitest environment (triggers fallback)
    const result = await createDispatchTicket(SAMPLE_ORDER);

    expect(result.success).toBe(true);
    expect(result.issueKey).toMatch(/^EMERG-\d+/);
    expect(result.decisionId).toBe('DEC-2026-0050');
    expect(result.isSimulated).toBe(true);
  });
});

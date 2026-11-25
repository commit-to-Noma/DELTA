/**
 * DELTA Phase 4: Atlassian Rovo Agent & Teamwork Graph Integration Test Suite
 * 
 * Verifies:
 * 1. Rovo Action handler returns NO_RUN when uninitialized (Truth Gate compliance).
 * 2. saveInterventionsEvaluation enforces session authentication.
 * 3. evaluateInterventions returns real multi-scenario differentials and rankings.
 * 4. Deterministic engineering explanations generated strictly from computed solver metrics.
 * 5. Teamwork Graph query returns authoritative healthcare facilities, drainage nodes, and dependency edges.
 * 6. Facility drainage dependencies accurately map BWH and BIDMC to the Brookline culvert.
 * 7. MCP tools schema and SKILL.md documentation integrity.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  handler,
  saveInterventionsEvaluation,
  evaluateInterventions,
  buildRovoEngineeringExplanation,
  queryTeamworkGraph,
  queryFacilityDrainageDependencies,
  __resetInMemoryStore
} from '../src/resolvers/index.js';

describe('Phase 4: Atlassian Rovo Agent & Teamwork Graph Suite', () => {
  beforeEach(() => {
    __resetInMemoryStore();
  });

  const SAMPLE_EVALUATION = {
    stormId: '50-year',
    stormLabel: 'NOAA Atlas 14 50-Year Design Burst (104.2 mm total depth)',
    baseline: {
      currentStorageM3: 41433,
      maxWaterDepthM: 0.384,
      impassableRoadCount: 6,
      atRiskHospitalCount: 2
    },
    differentials: {
      'plan-alpha': {
        avoidedSurfaceVolumeM3: 0,
        peakDepthReductionM: 0.0,
        protectedRoadCount: 1,
        protectedRoadNames: ['Francis St Ambulance Approach'],
        improvedHospitalCount: 1
      },
      'plan-beta': {
        avoidedSurfaceVolumeM3: 3580,
        peakDepthReductionM: 0.042,
        protectedRoadCount: 2,
        protectedRoadNames: ['Brookline Ave North', 'Muddy River Siphon Approach'],
        improvedHospitalCount: 1
      },
      'plan-gamma': {
        avoidedSurfaceVolumeM3: 11420,
        peakDepthReductionM: 0.128,
        protectedRoadCount: 6,
        protectedRoadNames: [
          'Brookline Ave',
          'Francis St',
          'Fenwood Rd',
          'Pilgrim Rd',
          'Longwood Ave',
          'Binney St'
        ],
        improvedHospitalCount: 2
      }
    },
    ranking: {
      mostVolumeAvoided: 'plan-gamma',
      mostRoadsProtected: 'plan-gamma',
      recommendedPlanId: 'plan-gamma',
      recommendationRationale: 'Plan Gamma clears Brookline culvert, restoring 12.5 m³/s gravitational outflow and avoiding 11,420 m³ of flood storage.'
    }
  };

  const AUTHENTICATED_SESSION = {
    accountId: 'qm:test-incident-commander',
    principal: { accountId: 'qm:test-incident-commander' }
  };

  it('TEST-ROVO-01: evaluateInterventions returns NO_RUN when uninitialized (Truth Gate compliance)', async () => {
    const res = await evaluateInterventions();
    expect(res.success).toBe(true);
    expect(res.status).toBe('NO_RUN');
    expect(res.data).toBeUndefined();
    expect(res.message).toContain('No multi-scenario intervention evaluation recorded');
  });

  it('TEST-ROVO-02: saveInterventionsEvaluation enforces session authentication', async () => {
    // Unauthenticated caller should fail closed
    await expect(
      saveInterventionsEvaluation(SAMPLE_EVALUATION, null, { accountId: 'anonymous' })
    ).rejects.toThrow('Authentication failure');
  });

  it('TEST-ROVO-03: saveInterventionsEvaluation persists real multi-scenario evaluation into KVS', async () => {
    const saveRes = await saveInterventionsEvaluation(SAMPLE_EVALUATION, null, AUTHENTICATED_SESSION);
    expect(saveRes.success).toBe(true);
    expect(saveRes.data.differentials['plan-gamma'].avoidedSurfaceVolumeM3).toBe(11420);
    expect(saveRes.data.savedByAccountId).toBe('qm:test-incident-commander');
    expect(saveRes.data.savedAt).toBeDefined();
  });

  it('TEST-ROVO-04: evaluateInterventions retrieves stored evaluation and Rovo explanation', async () => {
    await saveInterventionsEvaluation(SAMPLE_EVALUATION, null, AUTHENTICATED_SESSION);

    const evalRes = await evaluateInterventions();
    expect(evalRes.success).toBe(true);
    expect(evalRes.status).toBe('COMPLETED_EVALUATION');
    expect(evalRes.data).toBeDefined();
    expect(evalRes.rovoExplanation).toBeDefined();
    expect(evalRes.rovoExplanation.headline).toContain('11,420 m³');
    expect(evalRes.rovoExplanation.planBreakdown.length).toBe(3);
  });

  it('TEST-ROVO-05: buildRovoEngineeringExplanation embeds genuine computed physical deltas', () => {
    const explanation = buildRovoEngineeringExplanation(SAMPLE_EVALUATION);

    expect(explanation.headline).toContain('11,420 m³');
    expect(explanation.planBreakdown).toHaveLength(3);

    const gamma = explanation.planBreakdown.find(p => p.planId === 'plan-gamma');
    expect(gamma).toBeDefined();
    expect(gamma!.recommended).toBe(true);
    expect(gamma!.avoidedVolumeM3).toBe(11420);
    expect(gamma!.tradeOffSummary).toContain('12.5 m³/s');

    const alpha = explanation.planBreakdown.find(p => p.planId === 'plan-alpha');
    expect(alpha).toBeDefined();
    expect(alpha!.recommended).toBe(false);
    expect(alpha!.avoidedVolumeM3).toBe(0);
    expect(alpha!.tradeOffSummary).toContain('Francis St');
  });

  it('TEST-ROVO-06: Rovo action handler executes evaluate-interventions and returns structured telemetry', async () => {
    await saveInterventionsEvaluation(SAMPLE_EVALUATION, null, AUTHENTICATED_SESSION);

    const rovoEvent = {
      action: {
        key: 'evaluate-interventions'
      },
      payload: {}
    };

    const res = await handler(rovoEvent, {});
    expect(res.success).toBe(true);
    expect(res.status).toBe('COMPLETED_EVALUATION');
    expect(res.rovoExplanation.recommendationReasoning).toContain('Plan Gamma');
  });

  it('TEST-ROVO-07: queryTeamworkGraph returns authoritative healthcare facilities, drainage, and edges', async () => {
    const graphRes = await queryTeamworkGraph();
    expect(graphRes.success).toBe(true);
    expect(graphRes.nodes.length).toBeGreaterThanOrEqual(7);
    expect(graphRes.edges.length).toBeGreaterThanOrEqual(7);

    const facilityNodes = graphRes.nodes.filter(n => n.type === 'HEALTHCARE_FACILITY');
    expect(facilityNodes).toHaveLength(5);

    const facilityNames = facilityNodes.map(f => f.name);
    expect(facilityNames).toContain("Brigham and Women's Hospital");
    expect(facilityNames).toContain("Boston Children's Hospital");
    expect(facilityNames).toContain("Dana-Farber Cancer Institute");
  });

  it('TEST-ROVO-08: queryFacilityDrainageDependencies correctly maps Brigham and Women’s to Brookline Culvert', async () => {
    const bwhDeps = await queryFacilityDrainageDependencies('FACILITY-BWH');
    expect(bwhDeps.success).toBe(true);
    expect(bwhDeps.facility?.name).toBe("Brigham and Women's Hospital");
    expect(bwhDeps.drainingNodes).toHaveLength(1);
    expect(bwhDeps.drainingNodes[0].id).toBe('DRAIN-CULVERT-01');
    expect(bwhDeps.drainingNodes[0].metadata.capacityM3PerSec).toBe(12.5);
  });

  it('TEST-ROVO-09: MCP tools schema in mcp/tools.json is valid and exposes 5 core operations', () => {
    const toolsPath = path.resolve(__dirname, '../mcp/tools.json');
    expect(fs.existsSync(toolsPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(toolsPath, 'utf8'));
    expect(content.tools).toHaveLength(5);

    const toolNames = content.tools.map((t: any) => t.name);
    expect(toolNames).toContain('delta_get_catchment_state');
    expect(toolNames).toContain('delta_step_hydraulic_simulation');
    expect(toolNames).toContain('delta_evaluate_interventions');
    expect(toolNames).toContain('delta_get_decision_records');
    expect(toolNames).toContain('delta_query_teamwork_graph');
  });

  it('TEST-ROVO-10: MCP skill documentation in mcp/SKILL.md defines Truth Gate and human approval boundaries', () => {
    const skillPath = path.resolve(__dirname, '../mcp/SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);

    const content = fs.readFileSync(skillPath, 'utf8');
    expect(content).toContain('name: delta-hydraulic-assistant');
    expect(content).toContain('Zero Invented Numbers');
    expect(content).toContain('Human Approval Gate');
    expect(content).toContain('Plan Gamma: Emergency Hydro-Jetting Culvert Clearance');
  });
});

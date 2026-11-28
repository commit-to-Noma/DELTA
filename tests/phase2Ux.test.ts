import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildExecutiveSummary,
  buildPanelDecisionSummary,
  integrityVerdict,
  isDemoWorkOrder,
  issuePanelState,
  partitionWorkOrders,
  shouldShowQuickstart
} from '../src/simulation/phase2Ux';
import { generateDecisionBriefing } from '../src/simulation/decisionBriefingEngine';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

function fakeBriefing(hash: string): any {
  return {
    briefingId: 'DELTA-TEST',
    scenarioHash: hash,
    incidentPosture: 'STAGED_MITIGATION',
    recommendation: { recommendedPlanId: 'plan-gamma', recommendedPlanName: 'Plan Gamma', rationale: 'best' },
    interventionComparisons: [
      { planId: 'plan-gamma', avoidedSurfaceStorageM3: 1234, peakDepthReductionM: 0.05, netProtectedRoadCount: 2 }
    ],
    governanceAndStaging: { hasActiveDecision: true, decisionId: 'DEC-1', approvedBy: 'Duty Incident Commander', approvalTimestamp: '2026-11-28T00:00:00Z' },
    baselineAssessment: { totalSurfaceVolumeM3: 1, peakDepthM: 0.1, inundatedAreaM2: 1, impassableRoadCount: 0, hospitals: [] },
    crossScenarioRobustness: { matrix: [], exploratoryNotice: '' },
    scenarioContext: { disruptionId: 'x' },
    limitationsAndDisclosures: []
  };
}

describe('Phase 2 — Stage 4 integrity verify', () => {
  it('verifies only when briefing hash matches the active scenario hash', () => {
    expect(integrityVerdict(fakeBriefing('sha256:ABC'), 'sha256:abc')).toBe('verified');
    expect(integrityVerdict(fakeBriefing('sha256:ABC'), 'sha256:OTHER')).toBe('mismatch');
    expect(integrityVerdict(null, 'sha256:ABC')).toBe('pending');
    expect(integrityVerdict(fakeBriefing('sha256:ABC'), '')).toBe('pending');
  });

  it('builds a 3-metric executive summary with approver and Confluence link', () => {
    const s = buildExecutiveSummary(fakeBriefing('sha256:ABC'), 'https://example.atlassian.net/wiki/spaces/OPS/pages/1');
    expect(s.planName).toBe('Plan Gamma');
    expect(s.metrics).toHaveLength(3);
    expect(s.metrics[0].value).toContain('1,234 m³');
    expect(s.approver).toBe('Duty Incident Commander');
    expect(s.confluenceUrl).toContain('/wiki/');
    expect(buildExecutiveSummary(fakeBriefing('sha256:ABC')).confluenceUrl).toBeNull();
  });

  it('Stage 4 renders the summary card, verify button and accordions', () => {
    const src = read('src/components/shell/views/DecisionBriefingView.tsx');
    expect(src).toContain('Executive Decision Summary');
    expect(src).toContain('Runs on Atlassian · SHA-256 Verified');
    expect(src).toContain('Verify SHA-256 integrity');
    expect(src).toContain('title="Stress Matrix"');
    expect(src).toContain('title="Governance Binding"');
    expect(src).toContain('title="Raw Audit Details"');
    expect(typeof generateDecisionBriefing).toBe('function');
  });
});

describe('Phase 2 — Stage 5 collapsed demo templates', () => {
  it('partitions the 3 demo seeds from real work orders', () => {
    const wos = [
      { workOrderId: 'WO-1', decisionId: 'DEC-2026-079' },
      { workOrderId: 'WO-2', decisionId: 'DEC-2026-080' },
      { workOrderId: 'WO-3', decisionId: 'DEC-2026-081' },
      { workOrderId: 'WO-4', decisionId: 'DEC-REAL-1' }
    ];
    const { real, demo } = partitionWorkOrders(wos);
    expect(real.map((w) => w.workOrderId)).toEqual(['WO-4']);
    expect(demo).toHaveLength(3);
    expect(isDemoWorkOrder(wos[0])).toBe(true);
    expect(isDemoWorkOrder(wos[3])).toBe(false);
  });

  it('demo cards live inside a closed-by-default Example Templates accordion', () => {
    const src = read('src/components/shell/views/OperationalTicketsView.tsx');
    expect(src).toContain('Example Templates');
    expect(src).toContain('testId="example-templates"');
    expect(src).toContain('work-order-compact-summary');
    expect(src).toContain('Dispatch Live Jira Issue');
    const acc = read('src/components/common/Accordion.tsx');
    expect(acc).toContain('defaultOpen = false');
    expect(acc).toContain('useState(defaultOpen)');
  });
});

describe('Phase 2 — Issue Panel states', () => {
  it('classifies no-issue / loading / linked / unlinked', () => {
    expect(issuePanelState({ issueKey: '', isLoading: false, linkedDecision: null })).toBe('no-issue');
    expect(issuePanelState({ issueKey: 'OPS-1', isLoading: true, linkedDecision: null })).toBe('loading');
    expect(issuePanelState({ issueKey: 'OPS-1', isLoading: false, linkedDecision: { decisionId: 'D1' } })).toBe('linked');
    expect(issuePanelState({ issueKey: 'OPS-1', isLoading: false, linkedDecision: null })).toBe('unlinked');
  });

  it('summarises a linked decision for the dispatch card', () => {
    const s = buildPanelDecisionSummary({
      decisionId: 'DEC-9',
      status: 'APPROVED',
      chosenPlan: { name: 'Plan Gamma' },
      humanApprover: { displayName: 'Cmdr Vance' },
      scenarioHash: 'sha256:X',
      differentialMetrics: { avoidedSurfaceVolumeM3: 22, peakDepthReductionM: 0.01, protectedRoadNames: ['A', 'B'] }
    });
    expect(s?.planName).toBe('Plan Gamma');
    expect(s?.metrics[0].value).toContain('22 m³');
    expect(s?.metrics[2].value).toBe('2');
    expect(buildPanelDecisionSummary(null)).toBeNull();
  });

  it('panel renders purposeful unlinked and linked states', () => {
    const src = read('src/components/jira/IssuePanel.tsx');
    expect(src).toContain('Live catchment risk summary');
    expect(src).toContain('Link Decision');
    expect(src).toContain('Open Ops Center');
    expect(src).toContain('panel-dispatch-card');
    expect(src).toContain('Confluence audit page');
  });

  it('quickstart shows only on first run and until dismissed', () => {
    expect(shouldShowQuickstart({ hasSavedRun: false, dismissed: false })).toBe(true);
    expect(shouldShowQuickstart({ hasSavedRun: true, dismissed: false })).toBe(false);
    expect(shouldShowQuickstart({ hasSavedRun: false, dismissed: true })).toBe(false);
    expect(read('src/components/shell/views/OverviewDistrictView.tsx')).toContain('quickstart-strip');
  });
});

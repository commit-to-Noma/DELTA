/**
 * DELTA Phase 2 — pure presentation helpers for scannable decision surfaces.
 * No backend/resolver behaviour lives here; these only shape existing data
 * for Stage 4, Stage 5, the Jira Issue Panel, and the Stage 1 Quickstart.
 */
import type { DecisionBriefing } from './decisionBriefingEngine';
import { verifyBriefingBinding } from './briefingExporter';

export const DEMO_WORK_ORDER_DECISION_IDS = ['DEC-2026-079', 'DEC-2026-080', 'DEC-2026-081'] as const;

export function isDemoWorkOrder(wo: { decisionId?: string | null }): boolean {
  return !!wo?.decisionId && (DEMO_WORK_ORDER_DECISION_IDS as readonly string[]).includes(wo.decisionId);
}

export function partitionWorkOrders<T extends { decisionId?: string | null }>(
  workOrders: readonly T[]
): { real: T[]; demo: T[] } {
  const real: T[] = [];
  const demo: T[] = [];
  for (const wo of workOrders) (isDemoWorkOrder(wo) ? demo : real).push(wo);
  return { real, demo };
}

export interface ExecutiveMetric { label: string; value: string }
export interface ExecutiveSummary {
  planName: string;
  planId: string;
  metrics: ExecutiveMetric[];
  approver: string;
  decisionId: string | null;
  scenarioHash: string;
  confluenceUrl: string | null;
}

export function resolveConfluenceAuditUrl(...sources: Array<unknown>): string | null {
  for (const s of sources) {
    if (typeof s === 'string' && /^https?:\/\//i.test(s.trim())) return s.trim();
  }
  return null;
}

export function storedConfluenceAuditUrl(): string | null {
  try {
    return resolveConfluenceAuditUrl(localStorage.getItem('delta_confluence_audit_url'));
  } catch {
    return null;
  }
}

export function buildExecutiveSummary(
  briefing: DecisionBriefing,
  confluenceUrl?: string | null
): ExecutiveSummary {
  const rec = briefing.interventionComparisons.find(
    (p) => p.planId === briefing.recommendation.recommendedPlanId
  );
  const gov = briefing.governanceAndStaging;
  const decision: any = gov as any;
  return {
    planName: briefing.recommendation.recommendedPlanName,
    planId: briefing.recommendation.recommendedPlanId,
    metrics: [
      {
        label: 'Avoided surface storage',
        value: rec ? `${rec.avoidedSurfaceStorageM3 >= 0 ? '+' : ''}${rec.avoidedSurfaceStorageM3.toLocaleString()} m³` : '—'
      },
      {
        label: 'Peak depth reduction',
        value: rec ? `-${(rec.peakDepthReductionM * 100).toFixed(1)} cm` : '—'
      },
      {
        label: 'Corridors protected',
        value: rec ? `${rec.netProtectedRoadCount} road${rec.netProtectedRoadCount === 1 ? '' : 's'}` : '—'
      }
    ],
    approver: gov.approvedBy || 'Duty Incident Commander',
    decisionId: gov.decisionId || null,
    scenarioHash: briefing.scenarioHash,
    confluenceUrl: resolveConfluenceAuditUrl(
      confluenceUrl,
      decision?.confluencePageUrl,
      decision?.confluenceUrl,
      decision?.auditPageUrl
    )
  };
}

export type IntegrityVerdict = 'verified' | 'mismatch' | 'pending';

export function integrityVerdict(
  briefing: DecisionBriefing | null | undefined,
  activeScenarioHash: string | null | undefined
): IntegrityVerdict {
  if (!briefing || !activeScenarioHash) return 'pending';
  return verifyBriefingBinding(briefing, activeScenarioHash) ? 'verified' : 'mismatch';
}

export type IssuePanelState = 'no-issue' | 'loading' | 'linked' | 'unlinked';

export function issuePanelState(input: {
  issueKey?: string | null;
  isLoading?: boolean;
  linkedDecision?: unknown;
}): IssuePanelState {
  if (!input.issueKey) return 'no-issue';
  if (input.isLoading) return 'loading';
  return input.linkedDecision ? 'linked' : 'unlinked';
}

export interface PanelDecisionSummary {
  decisionId: string;
  planName: string;
  status: string;
  approver: string;
  metrics: ExecutiveMetric[];
  scenarioHash: string;
}

export function buildPanelDecisionSummary(decision: any): PanelDecisionSummary | null {
  if (!decision) return null;
  const m = decision.differentialMetrics || {};
  return {
    decisionId: decision.decisionId || decision.id || '—',
    planName: decision.chosenPlan?.name || '—',
    status: decision.status || 'APPROVED',
    approver: decision.humanApprover?.displayName || 'Incident Commander',
    metrics: [
      { label: 'Avoided volume', value: m.avoidedSurfaceVolumeM3 != null ? `+${Number(m.avoidedSurfaceVolumeM3).toLocaleString()} m³` : '—' },
      { label: 'Peak depth Δ', value: m.peakDepthReductionM != null ? `-${Number(m.peakDepthReductionM).toFixed(3)} m` : '—' },
      { label: 'Corridors restored', value: Array.isArray(m.protectedRoadNames) ? `${m.protectedRoadNames.length}` : '—' }
    ],
    scenarioHash: decision.scenarioHash || 'sha256:unspecified'
  };
}

/** Quickstart shows only on first run: no saved/approved work yet and not dismissed. */
export function shouldShowQuickstart(input: { hasSavedRun: boolean; dismissed: boolean }): boolean {
  return !input.hasSavedRun && !input.dismissed;
}

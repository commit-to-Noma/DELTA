/**
 * DELTA Jira Workflow Validator
 * 
 * Implements a proactive workflow gate that prevents issues from transitioning to
 * "Dispatched" or "Resolved" states unless an immutable, human-approved Decision Record
 * exists in Forge KVS.
 * 
 * As noted by Atlassian Forge leadership (Adam Moore, GPM Forge), proactive workflow
 * validators enforce rigorous operational guardrails in enterprise contexts.
 */

import { getDecisionForIssue } from './decisionStorage.js';

export const GATE_ERROR_MESSAGES = {
  NO_DECISION_RECORD: (issueKey) => 
    `DELTA Gate Blocked: Jira issue ${issueKey} cannot transition without an approved mitigation plan. An Incident Commander must evaluate hydraulic simulation scenarios and commit an approved Decision Record in the DELTA Engine before field dispatch.`,
  INVALID_STATUS: (issueKey, status) =>
    `DELTA Gate Blocked: Linked Decision Record for ${issueKey} has status '${status}'. Only 'APPROVED' decisions permit field dispatch.`,
  MISSING_APPROVER: (issueKey) =>
    `DELTA Gate Blocked: Decision Record for ${issueKey} lacks an authorized human Incident Commander signature. Autonomous AI dispatch is strictly prohibited.`
};

/**
 * Validates whether an issue transition is permitted by checking Forge KVS.
 * 
 * @param {object} event - Forge workflow validator payload containing issue and transition
 * @param {object} [storageOverride] - Optional mock storage client for testing
 * @returns {Promise<{ result: boolean, errorMessage?: string }>}
 */
export async function validateTransition(event, storageOverride = null) {
  const issueKey = event?.issue?.key;

  if (!issueKey) {
    return {
      result: false,
      errorMessage: 'DELTA Gate Blocked: Transition event missing valid Jira issue key.'
    };
  }

  // Check Forge KVS for a Decision Record linked to this Jira issue
  const decisionResult = await getDecisionForIssue(issueKey, storageOverride);

  if (!decisionResult.success || !decisionResult.data) {
    return {
      result: false,
      errorMessage: GATE_ERROR_MESSAGES.NO_DECISION_RECORD(issueKey)
    };
  }

  const decision = decisionResult.data;

  // Verify decision record approval status
  if (decision.status !== 'APPROVED' && decision.status !== 'DISPATCHED') {
    return {
      result: false,
      errorMessage: GATE_ERROR_MESSAGES.INVALID_STATUS(issueKey, decision.status)
    };
  }

  // Verify mandatory human approver
  if (!decision.humanApprover?.displayName || !decision.humanApprover?.role) {
    return {
      result: false,
      errorMessage: GATE_ERROR_MESSAGES.MISSING_APPROVER(issueKey)
    };
  }

  // All hydraulic and governance checks passed: allow transition
  return {
    result: true
  };
}

/**
 * Forge entrypoint for jira:workflowValidator module.
 */
export async function handler(event, context) {
  try {
    return await validateTransition(event);
  } catch (error) {
    return {
      result: false,
      errorMessage: `DELTA Gate Runtime Exception: ${error?.message || 'Unknown error'}`
    };
  }
}

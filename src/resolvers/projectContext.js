export function normalizeProjectKey(value) {
  if (!value || typeof value !== 'string') return null;
  const key = value.trim().toUpperCase();
  return /^[A-Z][A-Z0-9_]*$/.test(key) ? key : null;
}

export function projectKeyFromIssueKey(issueKey) {
  if (!issueKey || typeof issueKey !== 'string') return null;
  const match = issueKey.trim().toUpperCase().match(/^([A-Z][A-Z0-9_]*)-\d+$/);
  return match ? match[1] : null;
}

function keyFrom(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return (
    normalizeProjectKey(obj.projectKey) ||
    normalizeProjectKey(obj.project?.key) ||
    normalizeProjectKey(obj.key && String(obj.key).includes('-') ? null : obj.key) ||
    projectKeyFromIssueKey(obj.issueKey) ||
    projectKeyFromIssueKey(obj.issue?.key) ||
    projectKeyFromIssueKey(obj.key)
  );
}

export function resolveTrustedProject(...sources) {
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    const candidates = [
      src.extension?.project,
      src.extension?.issue,
      src.project,
      src.issue,
      src.context?.extension?.project,
      src.context?.extension?.issue,
      src.context?.project,
      src.context?.issue,
      src
    ];
    for (const c of candidates) {
      const projectKey = keyFrom(c);
      if (projectKey) {
        const projectId = c?.projectId || c?.project?.id || (c?.key && c?.id ? c.id : null) || src.projectId || src.context?.projectId || null;
        return { projectKey, projectId: projectId || null, source: 'forge-context' };
      }
    }
    if (src.projectId) return { projectKey: null, projectId: src.projectId, source: 'forge-context' };
  }
  return { projectKey: null, projectId: null, source: null };
}

export function resolveProjectForRecord({ context = null, authContext = null, payload = null, issueKey = null, decision = null } = {}) {
  const trusted = resolveTrustedProject(context, authContext);
  if (trusted.projectKey) return { ...trusted, trusted: true };
  const fromIssue =
    projectKeyFromIssueKey(issueKey) ||
    projectKeyFromIssueKey(payload?.linkedIssueKey) ||
    projectKeyFromIssueKey(payload?.issueKey) ||
    projectKeyFromIssueKey(decision?.linkedIssueKey) ||
    projectKeyFromIssueKey(decision?.dispatchedIssueKey);
  if (fromIssue) return { projectKey: fromIssue, projectId: null, source: 'issue-key', trusted: false };
  const fromPayload = normalizeProjectKey(payload?.projectKey) || normalizeProjectKey(authContext?.projectKey);
  if (fromPayload) return { projectKey: fromPayload, projectId: payload?.projectId || null, source: 'payload', trusted: false };
  return { projectKey: null, projectId: null, source: null, trusted: false };
}

export function assertProjectBinding({ trustedProjectKey, candidateIssueKey = null, candidateProjectKey = null }) {
  if (!trustedProjectKey) return null;
  if (candidateIssueKey) {
    const k = projectKeyFromIssueKey(candidateIssueKey);
    if (k && k !== trustedProjectKey) {
      return `Project scope mismatch: Issue '${candidateIssueKey}' belongs to project '${k}', not the trusted Forge project '${trustedProjectKey}'.`;
    }
  }
  if (candidateProjectKey) {
    const k = normalizeProjectKey(candidateProjectKey);
    if (k && k !== trustedProjectKey) {
      return `Project scope mismatch: Request targets project '${k}', not the trusted Forge project '${trustedProjectKey}'.`;
    }
  }
  return null;
}

# DELTA — Privacy & Data Handling

_Last updated: Nov 28, 2026 · App: `delta-decision-engine` (Atlassian Forge)_

## Architecture: 100% Runs on Atlassian
DELTA is a serverless Atlassian Forge app. All compute runs inside Atlassian's Forge runtime and all UI runs in Atlassian-hosted iframes. There is **no vendor-operated server, database, or analytics pipeline**.

## What data DELTA stores, and where
- **Forge Key-Value Store (KVS) only**, inside your Atlassian site boundary:
  - Approved Decision Records (approver account ID, timestamp, selected intervention, solver metrics, linked Jira issue key, content-integrity hash).
  - Dispatched work-order references (Jira issue keys returned by Jira at dispatch time).
  - The latest simulation snapshot a user explicitly saves (solver summary metrics, not raw personal data).
  - Governance settings chosen by your admin (role name, default issue type, Confluence space key, trigger on/off).
  - One de-duplication marker per proactively commented issue.
- **Jira / Confluence content DELTA creates at your direction**: dispatch issues you trigger, the opt-in post-incident audit page you approve, and — if the proactive trigger is enabled — one clearly-labelled screening summary comment on newly created flood/drainage issues.

## What DELTA does NOT do
- **Zero third-party databases.** No data is stored outside Forge KVS / your Atlassian site.
- **Zero external data egress.** DELTA makes no calls to non-Atlassian endpoints; it only uses Atlassian platform APIs (Jira, Confluence, Teamwork Graph) available to the installed app.
- **No Forge LLM data sharing.** Simulation numbers come from DELTA's deterministic 2D hydraulic solver, not an LLM. The Rovo agent only receives the tool outputs needed to answer the user's question in-session.
- **No tracking/analytics SDKs, no advertising, no sale of data.** DELTA collects no personal data beyond the approver identity Jira itself records for auditability.
- **Human-in-the-loop by design.** DELTA never creates dispatch tickets autonomously; a person must approve a Decision Record and click dispatch.

## Data retention & deletion
KVS records persist while the app is installed so the workflow gate can verify approved decisions. Uninstalling the app removes its stored data per Atlassian's Forge data lifecycle. To request earlier deletion of specific records, contact us below.

## Contact / support
GitHub Issues: https://github.com/commit-to-Noma/DELTA/issues

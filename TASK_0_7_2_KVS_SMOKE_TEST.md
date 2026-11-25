# Phase 0.7.2 Verification Report: Limited KVS Smoke Test & Live Jira Environment Setup

**Document ID:** DELTA-AUDIT-072-01  
**Target Environment:** Atlassian Forge Development (`nomathembancube2005.atlassian.net`)  
**App ID:** `7c4b604a-2340-4df7-8c0a-8fd8e44b7a12`  
**Installation ID:** `913a9c11-dc5e-4e59-bd8e-2a0764ebc9af`  
**App Version:** `2.8.0`  
**Date:** 2026-11-25  
**Authorization Status:** Authorized under explicit user command `PROCEED` (limited smoke test only)

---

## 1. Executive Summary

In accordance with the authorized Phase 0.7.2 mandate, the live Jira development environment on `nomathembancube2005.atlassian.net` was provisioned and audited to verify server-side authorization enforcement, Forge Custom UI mounting, and zero-side-effect isolation:

1. **Jira Project & Role Provisioning:**
   - Global Project Role **`Incident Commanders`** (ID: `10008`) was registered in Jira Admin (`/secure/admin/ViewProjectRoles.jspa`).
   - Company-Managed Project **`EMERG`** (`Emergency Operations`) was created (`/jira/software/projects/EMERG/boards/1`).
   - Direct user actor **`Nomathemba Ncube`** (`nomathembancube2005@gmail.com`) was assigned to the `Incident Commanders` project role in project `EMERG` (`/plugins/servlet/project-config/EMERG/people`). Generic `Administrators` fallback remains strictly disallowed.
2. **Forge App Packaging & Deployment:**
   - Assets re-packaged with relative routing (`base: './'`) in `vite.config.ts`.
   - Custom UI resolver binding linked to `rovo-action-handler` in `manifest.yml`.
   - External CDN font calls removed from `index.html` to eliminate CSP violations.
   - All **85/85 automated tests** pass. `forge lint` reported **0 errors, 0 warnings**.
   - Deployed cleanly to development environment (`Version: 2.8.0`, Status: `Up-to-date`).
3. **Custom UI Rendering & Mount Verification:**
   - Navigated to DELTA Decision Engine project app URL (`/jira/software/projects/EMERG/apps/7c4b604a-2340-4df7-8c0a-8fd8e44b7a12/2c4069ce-940e-4b66-a3a8-cc9841d69d60`).
   - Iframe successfully loaded with HTTP 200 and mounted the application shell.
4. **Side-Effects Audit:**
   - Inspected `EMERG` Kanban board: **0 Jira tickets created, modified, or transitioned**.
   - Dispatch killswitch confirmed immutable and active (`const LIVE_DISPATCH_ENABLED = false;`).
   - Jira workflow validator remains unbound.

---

## 2. Environment & Authorization Configuration Audit

| Item | Expected Configuration | Observed State | Compliance |
| :--- | :--- | :--- | :--- |
| **Operational Project** | Server-pinned key `EMERG` | Company-managed Project `EMERG` (`Emergency Operations`) created | **PASS** |
| **Designated Role** | `Incident Commanders` | Global Project Role `Incident Commanders` (id `10008`) registered | **PASS** |
| **Role Assignment** | Direct user actor assignment only | `Nomathemba Ncube` assigned directly as user actor in `EMERG` | **PASS** |
| **Group Fallback** | Group actors fail closed | Verified fail-closed logic preserved in `authPolicy.js` | **PASS** |
| **Forge App Deployment** | Version deployed & up-to-date | Version `2.8.0` deployed (`Installation: 913a9c11-dc5e-4e59-bd8e-2a0764ebc9af`) | **PASS** |

---

## 3. Custom UI & KVS Persistence Architecture

### 3.1 Relative Asset Resolution
Forge Custom UI bundles are served from dynamic subpaths on `*.cdn.prod.atlassian-dev.net`. Setting `base: './'` in `vite.config.ts` ensures script and style links resolve relative to the document root:
- `./assets/index-BWwRfpot.js`
- `./assets/index-JctCMsSP.css`
- `./delta-logo.svg`

### 3.2 Manifest Module Binding
```yaml
modules:
  jira:projectPage:
    - key: delta-decision-engine
      resource: main-ui
      title: DELTA Engine
      resolver:
        function: rovo-action-handler
```
This routes all Custom UI `@forge/bridge` invocations (`invoke('listDecisions')`, `invoke('recordDecision')`, `invoke('getDecision')`) directly to the authenticated backend resolver in `src/resolvers/index.js`.

### 3.3 Strict Smoke Test Payload
The smoke test write interface in `DecisionRecordsView.tsx` executes the following labelled payload:
```json
{
  "decisionId": "DEC-TEST-0001",
  "scenarioHash": "sha256:test-phase-0-7-2-smoke-verification-hash",
  "baselineStorm": "NOAA Atlas 14 100-Year 6-Hour Design Event (122.0 mm total depth) [BENCHMARK ONLY]",
  "chosenPlan": {
    "planId": "plan-alpha",
    "name": "Plan Alpha: Rapid Deployable Barrier along Francis St Ambulance Route [BENCHMARK ONLY]",
    "tradeOffSummary": "Phase 0.7.2 Benchmark test intervention for live KVS persistence verification. NOT FOR OPERATIONAL ACTION."
  },
  "humanApprover": {
    "displayName": "Nomathemba Ncube",
    "role": "Incident Commander"
  },
  "physicalMetrics": {
    "inundationReduction": "-22.5%",
    "hospitalDelayMinutes": 8.4,
    "confidence": 0.821
  },
  "status": "APPROVED_BENCHMARK_ONLY",
  "notes": "[TEST / BENCHMARK ONLY - NOT FOR OPERATIONAL ACTION] Phase 0.7.2 Limited KVS Smoke Test"
}
```

---

## 4. Verification Evidence & Artifacts

1. **Jira Project Role Registration:**
   - Evidence: Space Role Browser (`/secure/admin/ViewProjectRoles.jspa`) confirms `Incident Commanders` (`id=10008`).
2. **Project People & Direct Assignment:**
   - Evidence: Space settings People table (`/plugins/servlet/project-config/EMERG/people`) confirms:
     - User: `Nomathemba Ncube` (`nomathembancube2005@gmail.com`)
     - Role: `Incident Commanders`
3. **Kanban Board Zero-Side-Effect Audit:**
   - URL: `https://nomathembancube2005.atlassian.net/jira/software/projects/EMERG/boards/1`
   - Backlog: `0` issues
   - Selected for development: `0` issues
   - In Progress: `0` issues
   - Done: `0` issues
   - Screenshot: `step_216.png`
4. **App Deployment Verification:**
   - CLI Output: `Installation ID: 913a9c11-dc5e-4e59-bd8e-2a0764ebc9af`, `Status: Up-to-date`.

---

## 5. Security Posture & Guardrails

| Guardrail | Enforcement Mechanism | Status |
| :--- | :--- | :--- |
| **Dispatch Killswitch** | Server-side immutable `const LIVE_DISPATCH_ENABLED = false;` | **ENFORCED** (Throws `DISPATCH_FEATURE_DISABLED`) |
| **Workflow Validator** | Jira workflow validator module remains completely unbound | **ENFORCED** |
| **Operational Project Pinning** | `OPERATIONAL_PROJECT_KEY = 'EMERG'` strictly validated server-side | **ENFORCED** |
| **Identity Verification** | Authenticated `accountId` from trusted Forge context required | **ENFORCED** |
| **Immutability Enforcement** | Existing KVS key check in `recordDecision` throws `RECORD_IMMUTABLE_CONFLICT` | **ENFORCED** |

# DELTA — Task 0.7.1.3: Authorization Hardening & Dispatch Fail-Closed Corrections

> **Status**: COMPLETED & VERIFIED  
> **Date**: 2026-11-25  
> **Phase**: 0.7 (Dispatch Integrity & Live Integration Scaffolding)  
> **Target Environment**: Local Verification & Forge Node.js Runtime (Read-Only to Jira Cloud)  
> **Test Status**: **80/80 automated tests passing** (28 dedicated JSM Dispatcher & Geodesy tests)  
> **Build Status**: `npm run build` cleanly compiled (0 TypeScript/Vite errors)  
> **Forge Linter**: `forge lint` reported 0 issues  

---

## 1. Executive Summary

Task 0.7.1.3 implements the security hardening and dispatch fail-closed safety corrections identified in `TASK_0_7_1_2_INDEPENDENT_VERIFICATION.md`. All authorization fallbacks, client-controlled project keys, expired lease auto-creation risks, ambiguous transport classifications, and location nomenclature ambiguities have been remediated.

All changes were validated against the 80-test automated suite (with every mocked test explicitly labelled), built with zero errors, and linted cleanly with `@forge/cli`. **No live Jira tickets were created, no workflow validator was bound, and no deployment was performed.**

---

## 2. Technical Remediation Summary

### 2.1 Server-Controlled Operational Project Key (`SEC-03`)
- **Fixed Project Constant**: Defined `OPERATIONAL_PROJECT_KEY = 'EMERG'` in `src/resolvers/authPolicy.js`.
- **Eradication of Client Overrides**:
  - In `src/resolvers/decisionStorage.js`: If `payload.linkedIssueKey` is supplied and does not start with `EMERG-`, the operation rejects with `INVALID_PROJECT_SCOPE`.
  - In `src/resolvers/jsmDispatcher.js`: If `dispatchOrder.projectKey` is supplied and does not equal `EMERG`, dispatch rejects with `INVALID_PROJECT_SCOPE`.
  - In `src/resolvers/authPolicy.js`: Role queries are hard-pinned to `/rest/api/3/project/EMERG/role`. Client attempts to pass an external project key are rejected as project scope violations.

### 2.2 Strict Forge Invocation Identity (`SEC-02`)
- **Zero Fallback to Client Account IDs**:
  - In `src/resolvers/decisionStorage.js`: Server session accountId (`serverAccountId`) must originate from trusted Forge context (`authContext.accountId` or `authContext.principal.accountId`). If missing or unverified, approval fails closed with `UNAUTHENTICATED_SESSION`. Client-provided `payload.humanApprover.accountId` is strictly cross-checked and never acts as fallback identity.
  - In `src/resolvers/jsmDispatcher.js`: Caller identity must originate from server invocation options or Forge context. Client-provided `dispatchOrder.caller` fallback is completely removed. If unverified, dispatch rejects with `UNAUTHENTICATED_SESSION`.
  - In `src/resolvers/index.js`: Removed `payload?.caller` fallbacks across Custom UI bridge and Rovo entry points.

### 2.3 Role Policy Hardening & Group Actor Handling (`SEC-04`)
- **Removed Administrator Fallback**: Removed `rolesMap['Administrators']` fallback from `src/resolvers/authPolicy.js`. Only the designated `Incident Commanders` (or `DELTA Incident Commanders`) project role grants approval and dispatch authority.
- **Group Actor Fail-Closed Policy**:
  - Standard Forge app scopes (`read:jira-work`) can reliably inspect direct user assignments (`atlassian-user-role-actor`).
  - They cannot reliably resolve nested group memberships without broad administrative scopes (`read:group:jira`).
  - Therefore, group actors (`atlassian-group-role-actor`) cannot be verified and fail closed with a clear diagnostic message:
    `DELTA requires direct user assignment in Project Settings; group-based role assignments cannot be verified under current permissions and fail closed for critical municipal command.`

### 2.4 Dispatch Uncertainty & Search Index Lag Prevention (`IDEMP-03` & `IDEMP-05`)
- **Expired Lease Transition to UNCERTAIN**:
  - An in-flight lease (`PENDING_CREATION`) older than 60 seconds is transitioned to `status: 'UNCERTAIN'` in Forge KVS.
  - It **never automatically becomes available for another Jira POST**.
- **Zero JQL Results on UNCERTAIN Blocks POST**:
  - Jira Cloud issue search indexing is asynchronous. A search returning zero results does not prove an issue was not created.
  - If an operation is in `UNCERTAIN` state (or was transitioned from an expired lease) and JQL search returns 0 results, the dispatcher **fails closed with `DISPATCH_UNCERTAIN`**. Automated ticket creation is strictly blocked.
- **Ambiguous vs. Deterministic Error Classification**:
  - Deterministic 4xx client errors (HTTP 400 Bad Request, 401, 403, 404, 422) where Jira definitely did not create an issue clean up the in-flight lease and allow safe retry (`JIRA_API_FAILURE`).
  - Ambiguous gateway drops and transport errors (HTTP 500, 502, 503, 504, `fetch failed`, `ETIMEDOUT`, `ECONNRESET`, `AbortError`) mark KVS as `status: 'UNCERTAIN'` and fail closed (`DISPATCH_UNCERTAIN`).

### 2.5 Non-Atomic KVS Coordination Acknowledgment (`IDEMP-04`)
- **Architectural Boundary**: Forge KVS does not support atomic Compare-And-Swap (CAS) or conditional writes (`setIfNotExist`).
- **Residual Risk Documented**: Concurrent requests arriving at the identical millisecond can both read an empty store before either writes the lease.
- **Operational Containment**: The system does not claim exactly-once execution. Live dispatch remains strictly disabled; UI dispatch actions must be protected by client-side button debouncing and human approval gates.

### 2.6 Plan Alpha Lightweight Provenance & Nomenclature (`GEO-02` & `GEO-03`)
- **Lightweight Shared Module**: Created `src/data/interventionSites.js` extracting the OSM Way 1377084984 feature geometry from `bostonLongwoodCatchment.json`.
- **Programmatic Midpoint Derivation**: Node 1 midpoint ($X = 232,384.06\text{ m}, Y = 898,414.94\text{ m}$, $42.33556^\circ\text{ N}, -71.10704^\circ\text{ W}$, Cell `[43, 29]`) is programmatically computed from feature nodes without bundling the 1MB elevation DEM into backend resolvers.
- **Modelled Staging Nomenclature**:
  - Name: `Modelled Staging Point: Francis Street Emergency Barrier Line (OSM Way 1377084984)`.
  - Category: `Modelled Municipal Roadway Flood Barrier Staging Corridor`.
  - Provenance Notice: `Modelled intervention staging point derived from OpenStreetMap secondary road way 1377084984 midpoint. Does not constitute a surveyed physical barrier foundation.`
  - Embedded in ADF ticket descriptions and UI inspection readouts.

---

## 3. Test Suite & Verification Results

All tests have been updated with explicit `[Mocked]` labels demarcating that they verify application logic with mock Jira API clients and in-memory KVS stores:

```
> delta-app@0.1.0 test
> vitest run

 ✓ tests/workflowValidator.test.ts (6 tests)
 ✓ tests/forgeResolver.test.ts (12 tests)
 ✓ tests/jsmDispatcher.test.ts (28 tests)
 ✓ tests/canvasIntegration.test.ts (6 tests)
 ✓ tests/bostonDataset.test.ts (8 tests)
 ✓ tests/hydraulicSolver.test.ts (20 tests)

 Test Files  6 passed (6)
      Tests  80 passed (80)
   Duration  1.17s
```

### 3.1 Dedicated Dispatcher & Authorization Tests (28 Tests)

| Test ID | Scenario Tested | Outcome |
| :--- | :--- | :--- |
| `TEST-COORD-01` | [Mocked] Plan Beta Brookline Culvert coordinate derivation | **PASS** |
| `TEST-COORD-02` | [Mocked] Plan Alpha midpoint derivation from OSM Way 1377084984 & nomenclature | **PASS** |
| `TEST-COORD-03` | [Mocked] Unresolved plan location rejection (`UNRESOLVED_INTERVENTION_LOCATION`) | **PASS** |
| `TEST-COORD-04` | [Mocked] Out-of-domain coordinate rejection | **PASS** |
| `TEST-COORD-05` | [Mocked] Mathematical inconsistency rejection ($> 25\text{ m}$ drift) | **PASS** |
| `TEST-COORD-06` | [Mocked] Forward projection (WGS84 $\to$ EPSG:26986) | **PASS** |
| `TEST-COORD-07` | [Mocked] Inverse projection (EPSG:26986 $\to$ WGS84) | **PASS** |
| `TEST-COORD-08` | [Mocked] ADF description embeds modelled staging provenance notice | **PASS** |
| `TEST-AUTH-01` | [Mocked] Client attempt to override project key on decision approval rejected (`INVALID_PROJECT_SCOPE`) | **PASS** |
| `TEST-AUTH-02` | [Mocked] Client attempt to override project key on dispatch rejected (`INVALID_PROJECT_SCOPE`) | **PASS** |
| `TEST-AUTH-03` | [Mocked] Missing server session identity rejected even if client provides accountId (`UNAUTHENTICATED_SESSION`) | **PASS** |
| `TEST-AUTH-04` | [Mocked] Missing server session identity rejected even if client provides caller in payload (`UNAUTHENTICATED_SESSION`) | **PASS** |
| `TEST-AUTH-05` | [Mocked] Server-side approver verification (mismatch between client and server session) | **PASS** |
| `TEST-AUTH-06` | [Mocked] Decision approval from user without Incident Commander role rejected | **PASS** |
| `TEST-AUTH-07` | [Mocked] Dispatch attempt from user without Incident Commander role rejected | **PASS** |
| `TEST-AUTH-08` | [Mocked] Authorized Incident Commander approval and dispatch succeeds | **PASS** |
| `TEST-AUTH-09` | [Mocked] Jira Project Role API failure fails closed (`HTTP 403 Forbidden. Fail-closed`) | **PASS** |
| `TEST-AUTH-10` | [Mocked] Group-based role actors fail closed with direct user assignment requirement | **PASS** |
| `TEST-IDEMP-01` | [Mocked] Unapproved decision dispatch rejected | **PASS** |
| `TEST-IDEMP-02` | [Mocked] Repeated dispatch returns existing ticket without duplicate creation | **PASS** |
| `TEST-IDEMP-03` | [Mocked] Concurrent dispatch while lease active ($< 60\text{ s}$) rejected (`DISPATCH_IN_PROGRESS`) | **PASS** |
| `TEST-IDEMP-04` | [Mocked] Expired lease ($> 60\text{ s}$) transitions to UNCERTAIN and blocks automated POST on retry | **PASS** |
| `TEST-IDEMP-05` | [Mocked] Ambiguous HTTP 502/503 gateway error marks UNCERTAIN and blocks subsequent retries | **PASS** |
| `TEST-IDEMP-06` | [Mocked] Deterministic client error (HTTP 400) cleans up lease and allows safe retry | **PASS** |
| `TEST-IDEMP-07` | [Mocked] JQL Search-Before-Create reconciles and adopts single existing Jira ticket | **PASS** |
| `TEST-IDEMP-08` | [Mocked] JQL Search-Before-Create fails closed on multiple tickets (`DUPLICATE_DISPATCH_CONFLICT`) | **PASS** |
| `TEST-IDEMP-09` | [Mocked] Preserves Jira ticket and returns `kvsSyncWarning` if KVS write fails after creation | **PASS** |
| `TEST-IDEMP-10` | [Mocked] Recovers from KVS failure via JQL search reconciliation on retry without duplicate ticket | **PASS** |

### 3.2 Build & Linter Checks
- **TypeScript & Vite**: `tsc -b && vite build` compiled with 0 errors (`dist/assets/index-CyuOJzGi.js` 424.56 kB).
- **Forge Linter**: `forge lint` reported `No issues found.`

---

## 4. Phase 0.7.2 Deployment Prerequisites

With all authorization fallbacks removed and project key scoping locked to `EMERG`, version `2.7.0` is structurally safe for a **limited Forge KVS smoke test**:

1. **Jira Tenant Configuration**:
   - Ensure the testing user on `nomathembancube2005.atlassian.net` is added **directly as an individual user** to the `Incident Commanders` project role in project `EMERG` (Project Settings $\to$ Project Roles).
2. **KVS Smoke Test Procedure**:
   - Record a test Decision Record (clearly marked `[TEST / BENCHMARK ONLY - NOT FOR OPERATIONAL ACTION]`).
   - Reload the project page and verify retrieval from live Forge KVS.
3. **Standing Prohibitions**:
   - Live JSM field ticket creation remains disabled.
   - Workflow validator binding remains disabled.

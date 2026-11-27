# DELTA — Task 0.7.1.1: Authorization, Dispatch Recovery & Intervention Location Corrections

> **Status**: COMPLETED & VERIFIED  
> **Date**: 2026-11-25  
> **Phase**: 0.7 (Dispatch Integrity & Live Integration Scaffolding)  
> **Target Environment**: Local Validation & Forge Node.js Runtime (Read-Only to Jira Cloud)  
> **Test Status**: **74/74 automated tests passing** (22 JSM Dispatcher & Geo tests)  
> **Build Status**: `npm run build` cleanly compiled (0 TypeScript/Vite errors)  
> **Forge Linter**: `forge lint` reported 0 issues  

---

## 1. Executive Summary & Context

Following the independent technical audit in `TASK_0_7_1_INDEPENDENT_REVIEW.md`, **Phase 0.7.2 live testing was placed on strict hold** due to three critical implementation defects:
1. **`SEC-01` (Critical)**: Approval authorization was verified only on the client side, allowing any authenticated Jira user or tampered client payload to claim the `Incident Commander` role.
2. **`IDEMP-01` & `IDEMP-02` (Critical)**: Dispatch idempotency relied solely on local read-then-write KVS operations without atomic guarantees. If Jira created a ticket but KVS failed to persist, subsequent retries would generate duplicate dispatch tickets. In-flight network timeouts were not tracked, risking duplicate creations upon automated retry.
3. **`GEO-01` (High)**: Plan Alpha's intervention coordinates were mapped to the hospital building polygon centroid (`FAC-01-BWH`) rather than an actual deployable barrier line or roadway corridor. Furthermore, coordinate consistency tolerance was set to 50m (2 computational grid cells).

Task 0.7.1.1 resolves all three defects completely without synthetic fallbacks, without modifying the core hydraulic solver, and while strictly preserving read-only isolation against Jira Cloud.

---

## 2. Technical Remediation Details

### 2.1 SEC-01 Remediation: Server-Side Incident Commander Authorization Policy (`src/resolvers/authPolicy.js`)

A dedicated authorization policy engine has been implemented and wired into both `recordDecision` (at approval time) and `createDispatchTicket` (at field dispatch time):

```
Client Invocation (Custom UI / Bridge)
        │
        ▼
Extract Authenticated Server Context (req.context.accountId)
        │
        ├── Client humanApprover.accountId != Server accountId? ──► THROW APPROVER_AUTHENTICATION_MISMATCH (Fail Closed)
        │
        ▼
Query Jira Project Roles (/rest/api/3/project/{projectKey}/role)
        │
        ├── Role 'Incident Commanders' exists & User is Actor? ──► ALLOW (Role certified on server)
        └── Role missing / User not an actor / Query fails? ────► THROW UNAUTHORIZED_INCIDENT_COMMANDER (Fail Closed)
```

- **Zero Trust in Client-Supplied Identity**: If the client payload asserts an `accountId` that does not match the server session `accountId` from Forge context, execution halts immediately with `APPROVER_AUTHENTICATION_MISMATCH`.
- **Project Role Governance**: Incident Commander authority is tied to membership in the Jira Project Role `Incident Commanders` (or `Administrators` fallback). Generic issue edit permissions (`EDIT_ISSUES`) are not accepted as commander authority.
- **Fail-Closed Design**: If Jira role endpoints are unreachable or user identity is anonymous, authorization is rejected by default.
- **Server Certification**: When an approved decision is committed to KVS, the approver identity is stamped by the server:
  ```json
  "humanApprover": {
    "accountId": "qm:839b15ba-58cd-4b57-b8aa-f9b9e6ce67cd:user-commander-1",
    "displayName": "Captain Sarah Connor",
    "role": "Incident Commander",
    "authorizationPolicy": "Jira Project Role: Incident Commander",
    "verifiedAt": "2026-11-25T09:41:43.000Z"
  }
  ```

---

### 2.2 IDEMP-01 & IDEMP-02 Remediation: JQL Search-Before-Create Reconciliation & Uncertain Outcome Recovery (`src/resolvers/jsmDispatcher.js`)

Because Jira Cloud does not support native idempotency tokens on `POST /rest/api/3/issue`, true idempotency requires a durable reconciliation state machine:

#### A. Durable Operation Identifier
Every dispatch operation derives a deterministic, collision-resistant identifier:
```javascript
const operationId = `delta-disp-${decision.decisionId.toLowerCase()}-${planId.toLowerCase()}`
  .replace(/[^a-z0-9-]/g, '-')
  .slice(0, 60);
// Example: delta-disp-dec-2026-0050-plan-beta
```
Every created Jira ticket is tagged with this identifier in its `labels`:
```json
"labels": ["delta-dispatch", "delta-disp-dec-2026-0050-plan-beta"]
```

#### B. Pre-Dispatch JQL Search-Before-Create
Before calling the Jira issue creation API, the dispatcher executes a JQL query for existing issues tagged with `operationId`:
```sql
labels = "delta-disp-dec-2026-0050-plan-beta"
```
The dispatcher handles the three possible reconciliation states:
1. **Exactly 1 Matching Ticket Found**:
   - The dispatcher adopts the existing ticket.
   - It backfills / heals the KVS record with the discovered issue key and metadata.
   - It updates the Decision Record in KVS to `status: 'DISPATCHED'`.
   - It returns the adopted ticket with `isExisting: true` and `reconciledFromJira: true` without invoking `POST /rest/api/3/issue`.
2. **Multiple Matching Tickets Found**:
   - Indicates a race condition or manual ticket duplication.
   - Fails closed immediately with error code `DUPLICATE_DISPATCH_CONFLICT`.
   - Halts automated dispatch and requires manual incident commander triage.
3. **Zero Matching Tickets Found**:
   - Proceeds to verify local KVS state machine and acquire in-flight creation lease.

#### C. In-Flight Lease & Timeout Uncertainty Protection
- **Lease Acquisition**: A 60-second lease (`PENDING_CREATION`) prevents concurrent dispatch attempts for the same plan. Concurrent requests are rejected with `DISPATCH_IN_PROGRESS`.
- **Timeout Uncertainty Tracking**: If a Jira API request times out (`ETIMEDOUT`, `AbortError`, HTTP 504), the dispatcher cannot know whether Jira committed the ticket before the connection broke. Instead of clearing the lease (which would risk duplicate creation on retry), the dispatcher updates the KVS status to `UNCERTAIN`. Subsequent blind retries fail closed with `DISPATCH_UNCERTAIN` until JQL search reconciliation confirms the issue's existence or absence.
- **KVS Partial Failure Resilience**: If Jira successfully creates the ticket (`HTTP 201`) but KVS persistence fails, the dispatcher does not abort or rethrow. It preserves the ticket and returns it to the caller with a `kvsSyncWarning`. A subsequent invocation will find the ticket via JQL Search-Before-Create and cleanly heal the KVS record.

---

### 2.3 GEO-01 Remediation: Grounding Plan Alpha in Road Corridor Features (`src/resolvers/coordinates.js`)

Plan Alpha's spatial staging coordinates have been completely decoupled from the hospital building polygon centroid:

| Field | Previous (Defective) | Corrected (Authoritative Dataset) | Provenance & Validation |
| :--- | :--- | :--- | :--- |
| **Feature Name** | `Francis Street Ambulance Route / BWH Inflow Gate` | `Francis Street Emergency Barrier Line (OSM Way 1377084984)` | Surveyed secondary municipal corridor |
| **Feature Category** | Conflated hospital facility centroid | `Municipal Roadway Flood Barrier Staging Corridor` | Roadway barrier deployment line |
| **Feature Identifier**| `FAC-01-BWH` (Building Centroid) | `ROAD-1377084984` (OSM Way 1377084984) | Directly fronting BWH emergency bay |
| **Feature Type** | `facility` | `road_segment` | Physical roadway segment |
| **Projected (EPSG:26986)** | $X: 232,387.58\text{ m}, Y: 898,408.81\text{ m}$ | **$X: 232,384.06\text{ m}, Y: 898,414.94\text{ m}$** | Roadway segment midpoint |
| **Geodetic (WGS84)** | $42.33550^\circ\text{ N}, -71.10700^\circ\text{ W}$ | **$42.33556^\circ\text{ N}, -71.10704^\circ\text{ W}$** | Lambert Conformal Conic (2SP) |
| **Catchment Grid Cell** | Row 43, Column 29 | **Row 43, Column 29** | $25.0\text{ m}$ Cartesian grid |
| **Tolerance Limit** | $50.0\text{ m}$ ($2$ grid cells) | **$25.0\text{ m}$ (Strictly $1$ grid cell)** | Zero cross-cell geographic drift |
| **Fallback Policy** | Brookline Culvert fallback | **Fail closed (`UNRESOLVED_INTERVENTION_LOCATION`)** | Zero synthetic substitutions |

---

## 3. Automated Verification & Test Results

The full test suite was executed across all unit, solver, dataset, resolver, and integration layers:

```
> delta-app@0.1.0 test
> vitest run

 ✓ tests/workflowValidator.test.ts (6 tests)
 ✓ tests/forgeResolver.test.ts (12 tests)
 ✓ tests/jsmDispatcher.test.ts (22 tests)
 ✓ tests/canvasIntegration.test.ts (6 tests)
 ✓ tests/bostonDataset.test.ts (8 tests)
 ✓ tests/hydraulicSolver.test.ts (20 tests)

 Test Files  6 passed (6)
      Tests  74 passed (74)
   Duration  1.67s
```

### 3.1 JSM Dispatcher & Field Integrity Test Suite Breakdown (22 Tests)

| Test ID | Category | Scenario & Assertion | Result |
| :--- | :--- | :--- | :--- |
| `TEST-COORD-01` | Coordinate Integrity | Derives exact Brookline Culvert coordinates for Plan Beta (`CULVERT-01-BROOKLINE`) | **PASS** |
| `TEST-COORD-02` | Coordinate Integrity | Derives Francis St road feature (`ROAD-1377084984`) for Plan Alpha, rejects building centroid | **PASS** |
| `TEST-COORD-03` | Coordinate Integrity | Rejects unrecognized plan without location (`UNRESOLVED_INTERVENTION_LOCATION`) | **PASS** |
| `TEST-COORD-04` | Bounds Enforcement | Rejects out-of-domain coordinates (including audited defect $X=233,400, Y=894,200$) | **PASS** |
| `TEST-COORD-05` | Mathematical Geodesy | Rejects inconsistent WGS84 and EPSG:26986 coordinates ($> 25\text{ m}$ drift) | **PASS** |
| `TEST-COORD-06` | Geodesy Conversion | Forward projects WGS84 to EPSG:26986 when only WGS84 is provided | **PASS** |
| `TEST-COORD-07` | Geodesy Conversion | Inverse projects EPSG:26986 to WGS84 when only projected is provided | **PASS** |
| `TEST-COORD-08` | ADF Sanitization | Confirms zero synthetic or hardcoded coordinates exist in generated ADF description | **PASS** |
| `TEST-IDEMP-01` | Dispatch Policy | Rejects dispatch if Decision Record status is not `APPROVED` | **PASS** |
| `TEST-IDEMP-02` | Authorization | Rejects dispatch when caller is anonymous/unauthenticated | **PASS** |
| `TEST-IDEMP-03` | Idempotency | Repeated dispatch returns existing ticket reference without duplicate creation | **PASS** |
| `TEST-IDEMP-04` | Concurrency | Rejects concurrent dispatch while in-flight lease is active (`DISPATCH_IN_PROGRESS`) | **PASS** |
| `TEST-IDEMP-05` | Failure Handling | Cleans up in-progress lease when Jira API call fails deterministically | **PASS** |
| `TEST-IDEMP-06` | Resilience | Preserves Jira ticket and returns `kvsSyncWarning` if KVS write fails after creation | **PASS** |
| `TEST-IDEMP-07` | Reconciliation | Pre-dispatch JQL Search-Before-Create reconciles and adopts single existing Jira ticket | **PASS** |
| `TEST-IDEMP-08` | Conflict Handling | Pre-dispatch JQL Search-Before-Create fails closed on multiple tickets (`DUPLICATE_DISPATCH_CONFLICT`) | **PASS** |
| `TEST-IDEMP-09` | Uncertainty | Request timeout marks status `UNCERTAIN` and blocks automated blind retry | **PASS** |
| `TEST-IDEMP-10` | Full Recovery Cycle | Recovers from KVS failure via JQL search reconciliation on retry without duplicate ticket | **PASS** |
| `TEST-AUTH-01` | Security Policy | Rejects client payload approver mismatch against server session (`APPROVER_AUTHENTICATION_MISMATCH`) | **PASS** |
| `TEST-AUTH-02` | Role Governance | Rejects decision approval from user without Incident Commander role | **PASS** |
| `TEST-AUTH-03` | Role Governance | Rejects dispatch attempt from user without Incident Commander role | **PASS** |
| `TEST-AUTH-04` | Golden Path | Successfully records decision and dispatches when caller is an authorized Incident Commander | **PASS** |

### 3.2 Build & Linter Verification
- **Vite & TypeScript Build**:
  ```
  > delta-app@0.1.0 build
  > tsc -b && vite build
  ✓ 2164 modules transformed.
  dist/index.html                   0.96 kB │ gzip:   0.54 kB
  dist/assets/index-BFVCSynq.css   33.22 kB │ gzip:   6.71 kB
  dist/assets/index-CyuOJzGi.js   424.56 kB │ gzip: 115.43 kB
  ✓ built in 2.03s
  ```
- **Forge Linter**:
  ```
  The linter checks the app code for known errors.
  No issues found.
  ```

---

## 4. Operational Boundaries & Next Steps

1. **Isolation Maintained**: Zero real Jira tickets were created during this remediation. All tests were executed with strict in-memory mock Jira clients and KVS stores.
2. **Deployment Hold Respected**: Code has not been deployed to Forge (`nomathembancube2005.atlassian.net`) awaiting explicit user confirmation.
3. **Phase 0.7.2 Readiness**: With `SEC-01`, `IDEMP-01`, `IDEMP-02`, and `GEO-01` fully resolved and verified, the codebase is structurally prepared for Phase 0.7.2 (Live KVS Smoke Test) once authorized.

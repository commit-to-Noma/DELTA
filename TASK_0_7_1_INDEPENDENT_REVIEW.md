# DELTA — Task 0.7.1 Independent Implementation Review

**Review Date:** 2026-11-25  
**Reviewed Commit:** `22092d8` (`feat(dispatch): complete Task 0.7.1 coordinate integrity correction and dispatch idempotency engine`)  
**Auditor:** DELTA Independent Technical Review (Pro Architecture Review)  
**Review Type:** Read-Only Static Architecture, Security & Geodesy Inspection  

---

## 1. Executive Verdict: PASS WITH CONDITIONS (HOLD LIVE TESTING)

The Task 0.7.1 implementation represents significant engineering progress: it completely eliminates the 3.7 km out-of-bounds coordinate distortion, implements standard Lambert Conformal Conic (EPSG:26986) geodesy, binds authenticated Jira user identities, and introduces structured idempotency leasing.

However, **live Jira/KVS smoke testing (Phase 0.7.2) should be held** until three critical architectural vulnerabilities are addressed:
1. **Uncertain Jira Outcome Duplicate Hazard:** If Jira creates a ticket but KVS persistence fails, the in-flight lease expires after 60 seconds without recording the issue key. A subsequent retry **will create a duplicate Jira ticket**. Exactly-once semantics are not achieved.
2. **Missing Role-Based Authorization (RBAC):** The backend verifies *who* the caller is (`accountId`), but performs **zero permission checks**. Any authenticated Jira user can sign off on emergency flood mitigation plans and dispatch field crews.
3. **Intervention Location Proxy Substitution (Plan Alpha):** Plan Alpha ("Francis St Ambulance Route Deployable Barrier") uses the building centroid of Brigham and Women's Hospital (`FAC-01-BWH`) rather than the actual Francis Street road segment coordinates where barriers are deployed.

---

## 2. Ranked Findings Summary

| ID | Severity | Category | Description | Primary Reference |
| :--- | :---: | :---: | :--- | :--- |
| **SEC-01** | **Critical** | Authorization | Authentication verified, but authorization (RBAC/permissions) is completely absent. Any Jira user can approve and dispatch. | [decisionStorage.js:112-130](file:///Users/nomat/Projects/DELTA/src/resolvers/decisionStorage.js#L112-L130) |
| **IDEMP-01** | **Critical** | Idempotency | Jira-success followed by KVS-failure creates duplicate tickets on subsequent retries after 60s lease expiry. | [jsmDispatcher.js:315-339](file:///Users/nomat/Projects/DELTA/src/resolvers/jsmDispatcher.js#L315-L339) |
| **IDEMP-02** | **High** | Concurrency | Time-of-Check to Time-of-Use (TOCTOU) race condition in KVS lease acquisition allows concurrent requests to duplicate dispatch. | [jsmDispatcher.js:176-225](file:///Users/nomat/Projects/DELTA/src/resolvers/jsmDispatcher.js#L176-L225) |
| **GEO-01** | **High** | Geodesy | Plan Alpha uses BWH hospital building centroid rather than the physical road corridor coordinates of the Francis Street barrier. | [coordinates.js:90-99](file:///Users/nomat/Projects/DELTA/src/resolvers/coordinates.js#L90-L99) |
| **GEO-02** | **Medium** | Geodesy | 50m coordinate consistency tolerance allows up to 2 cells of drift on a 25m computational grid. | [coordinates.js:234-239](file:///Users/nomat/Projects/DELTA/src/resolvers/coordinates.js#L234-L239) |
| **TEST-01** | **Medium** | Test Fidelity | Concurrency unit test introduces a sequential delay, testing active lease rejection rather than simultaneous race contention. | [tests/jsmDispatcher.test.ts:250-275](file:///Users/nomat/Projects/DELTA/tests/jsmDispatcher.test.ts#L250-L275) |

---

## 3. Detailed Review A: Coordinate Integrity & Geodesy

### 3.1 Traceability of Intervention Target Locations
In [coordinates.js](file:///Users/nomat/Projects/DELTA/src/resolvers/coordinates.js#L278-L310), `resolveDispatchLocation(chosenPlan, orderLocationOverride)` enforces a strict four-tier hierarchy:
1. **Explicit Order Location:** Validated and reconciled if provided in `dispatchOrder`.
2. **Authoritative Intervention Registry:** Matched against `AUTHORITATIVE_INTERVENTION_LOCATIONS` by `planId`.
3. **Plan Embedded Location:** Validated if `chosenPlan.targetLocation` exists.
4. **Fail-Closed:** Throws `MISSING_TARGET_LOCATION` if unrecognized.

**Assessment:** The previous critical bug (hardcoded string `233,400 m, 894,200 m` in the ADF template) has been completely removed. However, an assumption defect exists in Tier 2:
- **Plan Beta (`plan-beta`):** Correctly references `CULVERT-01-BROOKLINE` ($X: 232,302.11\text{ m}, Y: 899,074.88\text{ m}$, Lat: $42.34150^\circ\text{ N}$, Lon: $-71.10800^\circ\text{ W}$, Cell `[17, 26]`). This accurately represents the culvert intake headwall.
- **Plan Alpha (`plan-alpha`):** References `FAC-01-BWH` ($X: 232,387.58\text{ m}, Y: 898,408.81\text{ m}$, Lat: $42.33550^\circ\text{ N}$, Lon: $-71.10700^\circ\text{ W}$, Cell `[43, 29]`).
  - **Finding (GEO-01):** These coordinates represent the OpenStreetMap building centroid of Brigham and Women's Hospital (`relation 3061383`), **not** the physical road corridor where the flood barrier is deployed. In `bostonLongwoodCatchment.json`, Francis Street is an independent road feature (`criticalRoads`). Deploying field crews to a hospital building centroid rather than the road staging intersection creates operational ambiguity.

### 3.2 Projection Engine Fidelity
- Equations in [coordinates.js:115-149](file:///Users/nomat/Projects/DELTA/src/resolvers/coordinates.js#L115-L149) duplicate the closed-form Lambert Conformal Conic (2SP) formulation from `catchmentLoader.ts` using authoritative parameters:
  - GRS80 Ellipsoid: $a = 6,378,137.0\text{ m}$, $f = 1 / 298.257222101$
  - Standard Parallels: $\phi_1 = 41^\circ 43'\text{ N}$, $\phi_2 = 42^\circ 41'\text{ N}$
  - Origin: $\phi_0 = 41^\circ 00'\text{ N}$, $\lambda_0 = -71^\circ 30'\text{ W}$
  - False Origin: $E_0 = 200,000.0\text{ m}$, $N_0 = 750,000.0\text{ m}$
- Numerical verification against NOAA/NGS standard benchmarks confirms sub-millimeter agreement with `catchmentLoader.ts`.

### 3.3 Consistency Tolerance & Domain Bounds
- **Tolerance Check (GEO-02):** Lines 234–239 check $\Delta = \sqrt{(X - X_{\text{proj}})^2 + (Y - Y_{\text{proj}})^2} \le 50.0\text{ m}$.
  - *Justification:* Accommodates 4-to-5 decimal place GPS truncation ($\pm 0.0001^\circ \approx 11\text{ m}$) from mobile incident commanders.
  - *Limitation:* On DELTA’s 25-meter computational grid, a 50m drift spans up to 2 cells. While it catches gross errors (e.g. the 3.7 km audit error), a tighter tolerance ($\le 25.0\text{ m}$) is recommended for operational precision.
- **Bounds Checking:** Lines 247–254 strictly enforce $X \in [231650, 233250]$ and $Y \in [897900, 899500]$. Out-of-bounds inputs fail closed with `OUT_OF_BOUNDS_COORDINATES`.

---

## 4. Detailed Review B: Dispatch Idempotency & Failure Recovery

### 4.1 Concurrency & Race Conditions (IDEMP-02)
Inspect [jsmDispatcher.js:176-225](file:///Users/nomat/Projects/DELTA/src/resolvers/jsmDispatcher.js#L176-L225):
```javascript
// Step 3: Check existing
const existingDispatch = await client.get(idempotencyKey);
if (existingDispatch) { ... }

// Step 6: Acquire lease
await client.set(idempotencyKey, { status: 'IN_PROGRESS', ... });
```
- **Finding:** This is a non-atomic **Time-of-Check to Time-of-Use (TOCTOU)** pattern. In Atlassian Forge, invocations run in distributed Node.js runtime instances.
- If two operators click "Dispatch" simultaneously (or a network client issues duplicate concurrent requests), Request A and Request B both execute `await client.get()` before either completes `await client.set()`.
- Both read `undefined`, both acquire leases, and both call `api.asApp().requestJira()`.
- **Result:** Two distinct Jira tickets will be created in violation of idempotency.
- *Remediation:* Forge KVS does not support conditional `putIfAbsent` in basic KVS; an atomic lock primitive or a Jira-side idempotency reconciliation check is required.

### 4.2 The Jira-Success / KVS-Failure Sequence (IDEMP-01)
Inspect [jsmDispatcher.js:315-339](file:///Users/nomat/Projects/DELTA/src/resolvers/jsmDispatcher.js#L315-L339):
1. The dispatcher issues `POST /rest/api/3/issue`. Jira successfully creates `EMERG-401`.
2. The dispatcher attempts to record the completed ticket: `await client.set(idempotencyKey, completedRecord)`.
3. Storage write throws an error (e.g. Forge KVS rate limit or network partition).
4. Lines 328–338 catch the error and return `{ success: true, issueKey: 'EMERG-401', kvsSyncWarning: true }`.
5. **The Fatal Flaw:** At this point, KVS still holds `{ status: 'IN_PROGRESS', initiatedAt: 'T0' }`.
6. 60 seconds later, the lease expires.
7. The user (or retry mechanism) submits the dispatch request again.
8. Line 195 sees `leaseAgeMs > 60000`. It treats the lease as stale, acquires a new lease, calls Jira API, and **creates duplicate issue `EMERG-402`**.
- **Conclusion:** DELTA does **not** guarantee exactly-once dispatch under storage degradation.

### 4.3 Recommended Reconciliation Strategy
Jira Cloud does not accept client-provided idempotency tokens in `POST /rest/api/3/issue`. The industry-standard solution for Jira integrations is **JQL Search-Before-Create**:
1. When generating the issue payload, embed a deterministic audit label:
   `labels: ['delta-dispatch', 'DEC-2026-0050', 'plan-beta']`
2. Before calling `POST /rest/api/3/issue`, query Jira:
   `GET /rest/api/3/issue/search?jql=labels = "DEC-2026-0050" AND labels = "plan-beta"`
3. If a ticket already exists in Jira, adopt that ticket key and update KVS immediately. This makes dispatch resilient even if KVS completely loses state.

---

## 5. Detailed Review C: Approver Authorization & Governance

### 5.1 Authentication vs. Authorization (SEC-01)
Inspect [decisionStorage.js:112-130](file:///Users/nomat/Projects/DELTA/src/resolvers/decisionStorage.js#L112-L130):
```javascript
const authenticatedAccountId = authContext?.accountId || authContext?.context?.accountId;
let verifiedApprover = { ...payload.humanApprover };

if (authenticatedAccountId) {
  if (verifiedApprover.accountId && verifiedApprover.accountId !== authenticatedAccountId) {
    throw new Error('Approver authentication mismatch...');
  }
  verifiedApprover.accountId = authenticatedAccountId;
  verifiedApprover.authenticatedByServer = true;
}
```
- **What is verified:** The code verifies that the caller's claimed `accountId` matches their session token. This prevents spoofing another user's account ID.
- **What is NOT verified:** The code performs **zero verification of user permissions or roles**.
  - Any logged-in Jira user (e.g. an external contractor, guest, or viewer with access to the Jira site) can invoke `recordDecision()` and approve a flood mitigation plan.
  - The server blindly accepts `role: "Incident Commander"` as submitted by the browser payload.
- **Conclusion:** Authentication is implemented; **authorization is completely missing**.
- *Remediation:* The resolver must query Jira permissions via `asUser().requestJira('/rest/api/3/mypermissions')` or verify membership in a designated `Incident Commanders` project role/group before accepting approvals.

### 5.2 Caller Authorization on Dispatch
In [jsmDispatcher.js:155-160](file:///Users/nomat/Projects/DELTA/src/resolvers/jsmDispatcher.js#L155-L160):
- `authenticatedCaller = caller || context?.accountId || dispatchOrder.caller;`
- In non-Forge environments, if `caller` is passed as a string, it is accepted without validation.
- In live Jira, any authenticated user can trigger a dispatch on any decision, regardless of who approved it or whether the user has dispatch authority.

---

## 6. Detailed Review D: Test Quality & Environment Demarcation

Inspect [tests/jsmDispatcher.test.ts](file:///Users/nomat/Projects/DELTA/tests/jsmDispatcher.test.ts#L1-L360):

| Test ID | Mock / Environment Used | Evaluates Live Cloud? | Reality |
| :--- | :--- | :---: | :--- |
| `TEST-COORD-01` to `08` | Pure JavaScript Math / Geodesy | No | **Valid Unit Tests** (Confirms projection & bounding) |
| `TEST-IDEMP-01` to `03` | In-memory `Map` & Mock Jira Client | No | **Mock Tests** (Validates single-threaded logic flow) |
| `TEST-IDEMP-04` | In-memory `Map` with 10ms `setTimeout` | No | **Flawed Concurrency Test** (Calls are sequential, not simultaneous) |
| `TEST-IDEMP-05` to `06` | In-memory `Map` error injection | No | **Mock Tests** (Simulates error handling) |
| `TEST-AUTH-01` | In-memory mock context | No | **Unit Test** (Checks account ID string equality) |

- **Key Takeaway:** 100% of the 15 tests run against in-memory JavaScript objects. None interact with Atlassian Cloud DynamoDB KVS or Jira REST APIs.
- Concurrency testing in Node.js event loops cannot simulate multi-instance distributed race conditions.

---

## 7. Prerequisites Before Live Smoke Testing (Phase 0.7.2)

To protect the live development Jira environment (`nomathembancube2005.atlassian.net`) from duplicate tickets and governance violations, the following three fixes are required:

1. **JQL Pre-Dispatch Reconciliation:**
   Add a search step prior to issue creation in `jsmDispatcher.js` checking Jira for existing tickets with label `delta-dec-${decisionId}-${planId}`.
2. **Server-Side Project Permission Check:**
   In `decisionStorage.js`, require `ADMINISTER_PROJECTS` or `EDIT_ISSUES` permission via `requestJira('/rest/api/3/mypermissions')` before committing an `APPROVED` status.
3. **Plan Alpha Road Staging Alignment:**
   Update Plan Alpha's authoritative location from BWH building centroid (`FAC-01-BWH`) to the Francis Street road staging intersection (`criticalRoads` Francis St segment, $X: 232,340\text{ m}, Y: 898,420\text{ m}$).

---

## 8. Conclusion

Commit `22092d8` successfully fixes the spatial coordinate bugs from Phase 0.6. However, because idempotency recovery and approver authorization are not yet enterprise-grade, **Phase 0.7.2 live testing should be held until the three minimal prerequisites above are landed**.

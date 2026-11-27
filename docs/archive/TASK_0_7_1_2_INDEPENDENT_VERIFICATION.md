# DELTA — Task 0.7.1.2: Independent Remediation Verification

> **Review Date**: 2026-11-25  
> **Target Commit**: [`d1b1286`](https://github.com/commit-to-Noma/DELTA/commit/d1b12863af0d63b5185ccb7b1dc699d738322934)  
> **Review Scope**: STRICTLY READ-ONLY audit of Task 0.7.1.1 remediation across Authorization Policy, Dispatch Reconciliation, Plan Alpha Geodesy, and Test Quality.  
> **Audited Files**:
> - `src/resolvers/authPolicy.js`
> - `src/resolvers/decisionStorage.js`
> - `src/resolvers/jsmDispatcher.js`
> - `src/resolvers/coordinates.js`
> - `manifest.yml`
> - `tests/jsmDispatcher.test.ts`
> - `tests/forgeResolver.test.ts`
> - `tests/workflowValidator.test.ts`

---

## Executive Verdict

### **VERDICT: PASS WITH CONDITIONS**
#### **Authorized for Phase 0.7.2 Limited KVS Smoke Test ONLY**
#### **STRICT HOLD on Live JSM Ticket Dispatch & Live Workflow Validator Binding**

Commit `d1b1286` demonstrates exemplary engineering progress: the mathematical geodesy is verified to sub-millimeter precision, mass balance is rigorously preserved ($< 10^{-10}$), 74 automated unit/integration tests pass, and zero syntax or linter warnings exist. 

However, independent trace analysis reveals **two critical/high operational vulnerabilities** in dispatch reconciliation and client project-role scoping that must be understood and constrained prior to any live Jira dispatch.

---

## Summary of Findings

| ID | Severity | Category | Summary | File & Lines |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-02** | **HIGH** | Authorization Scoping | Unauthenticated fallback to client-supplied `accountId` if server context is absent | `src/resolvers/decisionStorage.js:122`<br>`src/resolvers/jsmDispatcher.js:159` |
| **SEC-03** | **HIGH** | Role Confusion | Client-supplied `projectKey` / `linkedIssueKey` enables cross-project role checking | `src/resolvers/decisionStorage.js:123`<br>`src/resolvers/jsmDispatcher.js:160` |
| **SEC-04** | **MEDIUM** | Role Parsing | `authPolicy.js` actor parsing does not resolve Jira User Groups assigned to project roles | `src/resolvers/authPolicy.js:106-112` |
| **IDEMP-03**| **CRITICAL**| Dispatch Race / Lag | Expired lease (`PENDING_CREATION` > 60s) permits duplicate POST if Jira search indexing lags | `src/resolvers/jsmDispatcher.js:326-336` |
| **IDEMP-04**| **HIGH** | Lease Atomicity | Forge KVS read-then-write is non-atomic; simultaneous requests can race past the lease check | `src/resolvers/jsmDispatcher.js:206-344` |
| **IDEMP-05**| **MEDIUM** | Network Coverage | `isTimeoutOrAbort` regex misses HTTP 502/503 gateway drops, treating them as safe deterministic errors | `src/resolvers/jsmDispatcher.js:413-416` |
| **GEO-02** | **MEDIUM** | Spatial Provenance | Plan Alpha coordinates are hardcoded in dictionary rather than dynamically derived from dataset JSON | `src/resolvers/coordinates.js:95-106` |
| **GEO-03** | **LOW** | Nomenclature | ADF ticket description should label site as "Modelled Intervention Staging Point" | `src/resolvers/coordinates.js:97-98`<br>`src/resolvers/jsmDispatcher.js:54-67` |

---

## Detailed Audit Findings

### Section A: Authorization Policy Verification

#### 1. Server-Controlled vs. Client-Supplied Project Key (`SEC-03`)
- **Analysis**: In `decisionStorage.js` (line 123):
  ```javascript
  const projectKey = payload.linkedIssueKey ? payload.linkedIssueKey.split('-')[0] : 'EMERG';
  ```
  And in `jsmDispatcher.js` (line 160):
  ```javascript
  const projectKey = dispatchOrder.projectKey || 'EMERG';
  ```
- **Vulnerability**: A client can submit an arbitrary project key (e.g. `HACK-123`). In `authPolicy.js` (line 78), if the designated `Incident Commanders` role is missing, the code falls back to `rolesMap['Administrators']`:
  ```javascript
  const targetRoleUrl = rolesMap['Incident Commanders'] || rolesMap['DELTA Incident Commanders'] || rolesMap['Administrators'];
  ```
  If a user has an administrator role on *any* project on the tenant (such as their own test project), they could pass `linkedIssueKey: "TEST-1"`, pass authorization via the `Administrators` fallback for `TEST`, and commit a decision record affecting municipal flood response.
- **Requirement**: The project key must be hard-pinned server-side to the trusted DELTA emergency project (`EMERG`), or validated against a strict server whitelist.

#### 2. Account ID Resolution & Fallback (`SEC-02`)
- **Analysis**: In `decisionStorage.js` (line 122):
  ```javascript
  const serverAccountId = authContext?.accountId || authContext?.context?.accountId || (typeof authContext === 'string' ? authContext : null);
  const clientAccountId = payload?.humanApprover?.accountId;
  ...
  const authenticatedAccountId = serverAccountId || clientAccountId;
  ```
  And in `jsmDispatcher.js` (line 159):
  ```javascript
  const authenticatedCaller = caller || context?.accountId || dispatchOrder.caller;
  ```
- **Vulnerability**: While `decisionStorage.js` correctly detects and throws `APPROVER_AUTHENTICATION_MISMATCH` if *both* `serverAccountId` and `clientAccountId` are supplied and disagree, if `serverAccountId` is null or undefined (e.g. if invoked outside Custom UI or if context is stripped), it falls back to `clientAccountId` or `dispatchOrder.caller`.
- **Requirement**: In production runtime, if `serverAccountId` cannot be resolved from the trusted Forge context, the system must fail closed immediately. `clientAccountId` must never serve as the authenticated identity.

#### 3. Jira Project Role API Response Parsing (`SEC-04`)
- **Analysis**: `authPolicy.js` (lines 106-112):
  ```javascript
  const isMember = (roleData.actors || []).some((actor) => {
    return (
      actor.actorUser?.accountId === accountId ||
      actor.name === accountId ||
      actor.id === accountId
    );
  });
  ```
- **Vulnerability**:
  - `actor.id` is the numeric role actor ID (e.g. `10042`), never an Atlassian `accountId`.
  - `actor.name` is obsolete in Jira Cloud.
  - **Most critically**: In enterprise Jira Cloud setups, project roles are almost universally assigned to **Atlassian Groups** (type `atlassian-group-role-actor`) rather than individual users. For group actors, `actor.actorUser` is `undefined`. Because `authPolicy.js` does not expand or query group membership, any legitimate Incident Commander assigned via a Jira group will be rejected (fail closed).
- **Recommendation**: For hackathon testing, ensure the test user is added **directly as an individual user actor** to the project role in Jira project settings, not solely via a group.

---

### Section B: Dispatch Recovery & Concurrency Verification

#### Trace of the 10 Dispatch Scenarios

| # | Dispatch Scenario | Code Path Execution | Trace Outcome |
| :- | :--- | :--- | :--- |
| **1** | First dispatch, no prior operation | KVS clean $\to$ JQL returns $0 \to$ acquires lease $\to$ POST succeeds $\to$ writes KVS | **SAFE** |
| **2** | Existing Jira issue found | Fast-path: KVS `DISPATCHED` returns existing. Or JQL finds $1 \to$ adopts ticket and heals KVS | **SAFE** |
| **3** | Multiple matching Jira issues found | JQL returns $> 1 \to$ throws `DUPLICATE_DISPATCH_CONFLICT` (lines 259-267) | **SAFE (Fail Closed)** |
| **4** | Definite Jira rejection (HTTP 400/403) | `response.ok` false $\to$ deletes lease (line 437) $\to$ throws `JIRA_API_FAILURE` | **SAFE (Retryable)** |
| **5** | Jira timeout before outcome is known | Caught by `isTimeoutOrAbort` $\to$ sets `UNCERTAIN` in KVS $\to$ throws `DISPATCH_UNCERTAIN` | **SAFE (Tracked)** |
| **6** | Jira creates issue, but KVS write fails | Returns issue with `kvsSyncWarning` $\to$ subsequent retry adopts via JQL Search-Before-Create | **SAFE (Resilient)** |
| **7** | Retry after an uncertain operation | KVS is `UNCERTAIN` $\to$ JQL returns $0 \to$ lines 317-324 block and rethrow `DISPATCH_UNCERTAIN` | **SAFE (Blocks POST)** |
| **8** | Retry after lease expiry (> 60s) | KVS is `PENDING_CREATION` $\to$ lease expired $\to$ JQL returns $0 \to$ **FALLS THROUGH TO POST!** | **CRITICAL DEFECT (`IDEMP-03`)** |
| **9** | Simultaneous dispatch requests | Both read KVS simultaneously $\to$ neither sees lease $\to$ both write and POST | **HIGH DEFECT (`IDEMP-04`)** |
| **10**| JQL returns zero due to Jira index lag | JQL indexer lags $\to$ search returns $0 \to$ if lease expired or missing, triggers duplicate POST | **CRITICAL DEFECT (`IDEMP-03`)** |

#### Critical Findings on Dispatch Recovery:

1. **The Search Indexing Lag Trap (`IDEMP-03`)**:
   - Jira Cloud issue indexing is **asynchronous and eventually consistent**. When `POST /rest/api/3/issue` succeeds, there is a latency (typically 500ms to 5,000ms) before the issue appears in JQL queries for `labels = "delta-disp-..."`.
   - In Scenario 8 (Lease Expiry): If Request 1 was initiated, Jira created the issue at second 58, and the client connection dropped. At second 62, a retry occurs.
   - The lease is $> 60\text{ s}$ old, so line 329 does not throw.
   - JQL query executes. If Jira has not completed indexing the label, JQL returns **0 results**.
   - Line 343 acquires a brand new lease and calls `POST /rest/api/3/issue`.
   - **Result**: Jira creates a duplicate field dispatch ticket.
   - **Verdict**: A zero-result JQL query **does not prove non-existence** if an in-flight attempt was previously recorded. An expired `PENDING_CREATION` lease should transition to `UNCERTAIN` rather than silently clearing the path for another POST.

2. **Non-Atomic KVS Leases (`IDEMP-04`)**:
   - Atlassian Forge KVS (`@forge/api` storage) does not offer atomic Compare-And-Swap (CAS) or conditional writes (`setIfNotExist`).
   - The sequence:
     ```javascript
     const existingKvsDispatch = await client.get(idempotencyKey); // Read
     ...
     await client.set(idempotencyKey, { status: 'PENDING_CREATION' }); // Write
     ```
     is susceptible to TOCTOU race conditions. Two concurrent invocations on separate serverless instances can both execute the read before either executes the write, causing both to call Jira.
   - **Operational Rule**: Dispatch must be triggered only by explicit human button clicks guarded by client-side debounce/disable states; automated concurrency cannot rely on KVS alone for mutex locking.

3. **Incomplete Timeout Regex (`IDEMP-05`)**:
   - Line 415:
     ```javascript
     /timeout|timed out|ECONNRESET|ETIMEDOUT|504/i.test(jiraErr.message || '')
     ```
   - Cloudflare/AWS gateway drops often return HTTP 502 (Bad Gateway), HTTP 503 (Service Unavailable), or Node fetch errors (`UND_ERR_SOCKET`, `fetch failed`) where the issue was actually committed by Jira before the drop.
   - These errors fall through to lines 435-444, which **deletes the lease** and marks the failure as deterministic, risking duplicate dispatch on immediate retry.

---

### Section C: Plan Alpha Intervention Location Verification

1. **Existence in Bundled Dataset**:
   - **Verified**: `ROAD-1377084984` (OSM Way 1377084984) exists in `src/data/bostonLongwoodCatchment.json` under `criticalRoads`.
   - It represents Francis Street directly fronting Brigham and Women's Hospital ambulance bay.
2. **Coordinates & Domain Bounds**:
   - Dataset geometry: Node 1 midpoint is $X = 232,384.06\text{ m}, Y = 898,414.94\text{ m}$ (EPSG:26986) and $\text{Lat } 42.335555^\circ\text{ N}, \text{Lon } -71.107042^\circ\text{ W}$ (WGS84).
   - Domain bounds: Squarely within $[231650, 233250]\times[897900, 899500]$.
   - Grid cell: Row 43, Col 29 on the $64\times 64$ Cartesian grid.
3. **Hardcoding vs. Dynamic Derivation (`GEO-02`)**:
   - The coordinates in `src/resolvers/coordinates.js` (lines 95-106) are **statically declared** in the `AUTHORITATIVE_INTERVENTION_LOCATIONS` object.
   - They were copied from the dataset JSON rather than loaded dynamically at runtime (an acceptable architectural choice in Forge resolvers to keep backend bundle size small, but should be accurately documented as a compiled static lookup).
4. **Physical Location vs. Modelled Staging Point (`GEO-03`)**:
   - The location is an **OSM-derived modelled intervention staging point**, not a surveyed physical barrier foundation.
   - The ADF description and UI labels should consistently state: `Modelled Staging Point: Francis Street (OSM Way 1377084984)`.

---

### Section D: Test Quality Assessment

1. **Mock vs. Live Testing Reality**:
   - **100% of the 74 passing tests execute against local mocks** (in-memory Map storage, mocked Jira client functions).
   - **Zero tests interact with live Jira Cloud REST APIs or live Forge KVS**. Passing tests confirm application logic branching, not live cloud environment compatibility.
2. **Concurrency Test Limitations**:
   - `TEST-IDEMP-04` introduces an artificial 10ms gap (`await new Promise(r => setTimeout(r, 10))`) between Request 1 and Request 2.
   - This test verifies that *if* Request 1 has already written the lease, Request 2 rejects. It **does not test simultaneous parallel execution** where both requests evaluate `client.get()` concurrently.
3. **Search Lag Untested**:
   - The test suite contains no test simulating Jira JQL search latency (where an issue exists in Jira but returns 0 results from `searchJira`).

---

## Deployment Recommendation: Phase 0.7.2

### **APPROVED: Limited Forge KVS Smoke Test (Phase 0.7.2)**
Version `2.7.0` is **safe to deploy for a narrowly scoped KVS persistence test**.

#### Scope of Permitted Actions in Phase 0.7.2:
- Deploy version `2.7.0` to development tenant `nomathembancube2005.atlassian.net`.
- Test saving an immutable Decision Record via the Custom UI.
- Verify retrieval of the Decision Record on page reload.
- Verify that `issue-decision` linkage is stored in KVS.

#### STRICT RESTRICTIONS (Do NOT execute):
- **DO NOT create live JSM Field Dispatch tickets**.
- **DO NOT bind the Workflow Validator to active production transitions**.
- **DO NOT perform multi-user concurrent dispatch testing**.

### Required Action Items Prior to Phase 0.7.4 (Live Dispatch):
1. **Remediate `IDEMP-03`**: If a lease expires without confirmation, set status to `UNCERTAIN` and require explicit human commander reconciliation before issuing another POST.
2. **Remediate `SEC-02` / `SEC-03`**: Remove unauthenticated client fallbacks; pin the target project key to server configuration (`EMERG`).
3. **Verify Project Role in Jira**: Before dispatch testing, navigate to Project Settings $\to$ Project Roles in `nomathembancube2005.atlassian.net` and ensure the testing account is added directly as an individual user to `Incident Commanders`.

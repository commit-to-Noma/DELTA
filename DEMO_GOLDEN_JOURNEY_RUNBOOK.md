# DELTA — Golden Journey Demonstration Runbook & Video Script

> **Goal**: 5-Minute High-Impact Demonstration Video for Atlassian Codegeist 2026 (*Specialized Industries: Municipal Flood Defense & Healthcare Infrastructure*).  
> **Core Thesis**: **"DELTA connects physical simulation, intervention evaluation, human accountability and operational governance in one workflow."**  
> **Target Video Length**: 4 minutes 30 seconds (Strictly under 5:00 limit).  
> **Demonstration Site**: Jira Cloud Development Tenant (`nomathembancube2005.atlassian.net`) & Local/Forge Custom UI.  
> **Target Issue**: `EMERG-1` (*[DELTA-TEST] Simulated Flood Inundation along Francis Street Corridor*).  

---

## 1. Video Timing & Journey Structure

| Scene | Step | Title | Target Time | Cumulative | Visual Focus |
| :---: | :---: | :--- | :---: | :---: | :--- |
| **01** | — | **Hook & Problem Statement** | 0:30 | 0:30 | Boston Longwood terrain, hospital corridors, the operational disconnect |
| **02** | 1 | **Geographic Context & Catchment Selection** | 0:30 | 1:00 | District Alpha (Longwood), 5 hospitals, 117 road segments, DEM grid |
| **03** | 2 | **Baseline 2D Hydrodynamic Simulation** | 0:40 | 1:40 | 64×64 canvas, 50-year storm, mass conservation, $41,433\text{ m}³$ storage |
| **04** | 3 | **Disruption Injection & Live Recalculation** | 0:35 | 2:15 | Brookline culvert debris choke ($12.5 \to 0\text{ m}³/s$), ponding rise |
| **05** | 4 | **Multi-Scenario Intervention Evaluation** | 0:45 | 3:00 | Plan Alpha vs. Beta vs. Gamma comparative matrix, $+22\text{ m}³$ delta |
| **06** | 5 | **Deterministic Physics Explanation** | 0:30 | 3:30 | Engineering rationale breakdown, software interface, Truth Gate boundaries |
| **07** | 6 | **Incident Commander Human Authorization** | 0:35 | 4:05 | Scenario hash binding, role check, explicit rationale, KVS write |
| **08** | 7 | **Jira Operational Governance & Issue Panel** | 0:35 | 4:40 | `EMERG-1` live issue panel, `DEC-MWWGKJ4W-GNXJ`, closed governance loop |
| **09** | — | **Conclusion & Call to Action** | 0:15 | 4:55 | Core thesis recap, Atlassian platform synergy |

---

## 2. Step-by-Step Production Script & Action Guide

### Scene 1: Hook & Problem Statement (0:00 – 0:30)
- **On-Screen**: DELTA Landing screen / Title card, transitioning into the Boston Longwood terrain overview.
- **Narrative Voiceover**:
  > *"When an extreme storm strikes a major metropolitan medical district, emergency dispatchers face a dangerous blind spot. Municipal drainage systems choke on debris, low-lying access corridors submerge, and critical trauma centers become inaccessible. Traditional static flood maps cannot adapt in real time, while emergency dispatch tools lack physics awareness.*  
  > *Meet **DELTA**—the Decision Engine for Local Terrain and Action. DELTA unites rigorous 2D hydrodynamic simulation, physical intervention planning, authenticated human accountability, and Jira operational governance in a single cohesive workflow."*

---

### Scene 2: Step 1 — Select the Boston Longwood Catchment (0:30 – 1:00)
- **UI Navigation**: Click **Overview / District** (`01`) in the sidebar.
- **On-Screen Action**: Select **District Alpha — Central Valley & Hospital Corridor (Longwood Medical Area)**.
- **Visual Checkpoints**:
  - Catchment dimensions: $1,600\text{ m} \times 1,600\text{ m}$ (EPSG:26986, Massachusetts Mainland).
  - 5 Major Healthcare Facilities: Brigham & Women's Hospital, Boston Children's Hospital, Beth Israel Deaconess (East & West), Dana-Farber Cancer Institute.
  - 117 clipped municipal road segments (Francis St, Binney St, Brookline Ave).
  - 3 primary drainage structures, including the Brookline Avenue culvert.
- **Narrative Voiceover**:
  > *"We begin in District Alpha: Boston's Longwood Medical Area. DELTA ingests authoritative USGS 3D Elevation LiDAR and OpenStreetMap infrastructure data, projected into a conformal 64-by-64 Cartesian computational grid with 25-meter square cells. This gives emergency managers immediate visibility over five major hospital complexes, emergency ambulance corridors, and key stormwater culverts."*

---

### Scene 3: Step 2 — Run the Baseline Flood Simulation (1:00 – 1:40)
- **UI Navigation**: Click **Flood Simulation** (`02`) in the sidebar.
- **On-Screen Action**:
  - Select **50-Year Design Storm (NOAA Atlas 14)** ($104.2\text{ mm}$ precipitation depth over 6 hours).
  - Click **Run Simulation**. Observe the 2D diffusive-wave flood wave propagating in real time across the high-DPI canvas.
  - Hover over critical road cells along Francis Street to inspect water depth and velocity vectors.
- **Visual Checkpoints**:
  - Water storage reaches $41,433\text{ m}³$.
  - Peak water depth registers $0.619\text{ m}$.
  - Mass conservation invariant: Mass balance error $< 10^{-6}$.
  - Nominal Brookline culvert drainage capacity operating at $12.5\text{ m}³/s$.
- **Narrative Voiceover**:
  > *"Under a NOAA Atlas 14 50-year design storm, DELTA executes an in-browser 2D staggered shallow-water diffusive-wave solver. Notice the mass-balance accounting: every cubic meter of rainfall, soil infiltration, and culvert discharge is strictly conserved. Under baseline conditions, nominal culvert discharge prevents catastrophic accumulation, holding peak storage across the catchment at 41,433 cubic meters."*

---

### Scene 4: Step 3 — Introduce a Scenario Disruption (1:40 – 2:15)
- **UI Navigation**: Click **Scenario Disruptions** (`03`) in the sidebar.
- **On-Screen Action**:
  - Select **`CULVERT-01-BROOKLINE`** (Brookline Avenue Culvert Choke Point).
  - Toggle **Activate Disruption**.
  - Observe the dynamic recalculation badge and solver re-execution.
- **Visual Checkpoints**:
  - Conveyance drops from $12.5\text{ m}³/s$ nominal to $0.0\text{ m}³/s$ (100% blocked by storm debris).
  - Choke point ponding depth rises, backwater surcharge spreads along Francis Street.
- **Narrative Voiceover**:
  > *"Now, reality strikes: storm debris completely blocks the Brookline Avenue culvert headwall. Drainage conveyance instantly collapses from 12.5 cubic meters per second to zero. Instead of relying on static pre-calculated assumptions, DELTA triggers an in-flight 2D hydrodynamic recalculation, propagating backwater surcharge along the Francis Street emergency corridor."*

---

### Scene 5: Step 4 — Multi-Scenario Intervention Evaluation (2:15 – 3:00)
- **UI Navigation**: Click **Intervention Planner** (`04`) in the sidebar.
- **On-Screen Action**:
  - Click **Run Multi-Scenario Evaluation (2D Solver)**.
  - The UI runs the 2D solver across all candidate plans on the exact identical canonical scenario.
  - Review the comparative matrix:
    - **Plan Alpha (Rapid Sandbag Barrier)**: Deflects overland flow locally along Francis St, but avoids $0\text{ m}³$ catchment storage.
    - **Plan Beta (Mobile Pump #1)**: Mechanical extraction at $2.0\text{ m}³/s$, avoiding modest storage but capacity-limited.
    - **Plan Gamma (Emergency Culvert Jetting)**: Restores nominal $12.5\text{ m}³/s$ gravitational drainage, avoiding $22\text{ m}³$ of retained surface storage.
- **Visual Checkpoints**:
  - Differential metrics: Plan Gamma avoided storage $+22\text{ m}³$ ($41,433\text{ m}³ \to 41,411\text{ m}³$).
  - Canonical scenario hash displayed: `sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47`.
- **Narrative Voiceover**:
  > *"Incident commanders cannot afford guesswork when deploying municipal crews. In the Intervention Planner, DELTA runs all candidate options against the same invariant baseline. Plan Alpha's sandbagging deflects water locally but achieves zero net storage reduction. Plan Beta's mobile pumps provide partial relief. But Plan Gamma—emergency culvert jetting—clears the choke point, restoring full gravity drainage and eliminating 22 cubic meters of retained surface storage."*

---

### Scene 6: Step 5 — Deterministic Physics Explanation & Truth Gate (3:00 – 3:30)
- **UI Navigation**: Scroll to the **Engineering Analysis & Rationale** panel.
- **On-Screen Action**:
  - Highlight the plain-language engineering breakdown generated from the solver differentials.
  - Point out the scientific screening notice:
    > *"These results are screening-model outputs and do not establish real-world flood protection or guarantee hospital access."*
  - Mention that this structured rationale provides the exact software interface for Atlassian Rovo and automated runbooks.
- **Narrative Voiceover**:
  > *"DELTA couples directly to a deterministic physics explanation engine. Rather than generating ungrounded generative text, it formulates transparent engineering trade-offs directly from conservation of mass calculations. Crucially, DELTA enforces strict scientific boundaries: these screening models provide decision support, not unverified real-world guarantees."*

---

### Scene 7: Step 6 — Incident Commander Human Authorization (3:30 – 4:05)
- **UI Navigation**: Click **Authorize Mitigation Plan (Incident Commander)**.
- **On-Screen Action**:
  - Show the 2-step authorization modal.
  - Highlight the cryptographic **Canonical Scenario Hash** (`sha256:f0a73115...`).
  - Highlight the server-verified role badge: **`Incident Commander`** (Server-enforced via Jira Project Role).
  - Verify the prefilled engineering validation rationale.
  - Click **Authorize & Link Plan Gamma**.
  - Show the confirmation state with generated Decision ID (`DEC-MWWGKJ4W-GNXJ`).
- **Narrative Voiceover**:
  > *"Crucially, automated models never dispatch field crews autonomously. DELTA enforces a human-in-the-loop governance gate. The Incident Commander reviews the differential metrics, checks the canonical scenario hash, and provides an explicit operational rationale. The Forge backend validates the commander's project role and commits the decision record into Forge Key-Value Storage with an immutable audit trail."*

---

### Scene 8: Step 7 — Jira Operational Governance & Issue Panel (4:05 – 4:40)
- **UI Navigation**: Switch to Jira Cloud browser tab showing [`EMERG-1`](https://nomathembancube2005.atlassian.net/browse/EMERG-1).
- **On-Screen Action**:
  - Refresh or scroll down to the **DELTA Flood Mitigation Decision** panel.
  - Highlight:
    - Status Badge: **`APPROVED`** (Green).
    - Linked Decision ID: **`DEC-MWWGKJ4W-GNXJ`**.
    - Authenticated Approver: Server-verified **`Incident Commander`**.
    - Scenario Hash: `sha256:f0a73115...`.
    - Avoided Surface Storage: `+22 m³`.
    - Verbatim Human Rationale and Screening Model Disclaimer.
- **Narrative Voiceover**:
  > *"Here, the loop closes inside Jira Cloud. On incident ticket EMERG-1, the deployed DELTA Issue Panel dynamically queries Forge KVS and surfaces the approved decision record. Responders see the verified decision ID, the authenticated commander who signed off, the exact physical plan authorized, and the canonical scenario hash. Physical simulation has become binding operational governance."*

---

### Scene 9: Conclusion & Platform Synergy (4:40 – 4:55)
- **On-Screen**: DELTA System Architecture diagram or end-to-end workflow summary card.
- **Narrative Voiceover**:
  > *"From 2D mass conservation to Atlassian Cloud governance, DELTA bridges hydrodynamic science and emergency management. By ensuring every operational action is backed by physics, verified by a human, and tracked in Jira, DELTA protects critical infrastructure when every minute counts. Thank you."*

---

## 3. Truth Gate Boundaries & Demonstration Safeguards

To maintain strict alignment with Hackathon evaluation guidelines and technical honesty:

1. **Deterministic Rovo Representation**:
   - Present Rovo integration as a software-level interface powered by `rovoExplanation.js` and `mcp/tools.json`.
   - Do not rely on unpredictable live Rovo Chat streaming during the recorded take.
2. **Field Dispatch Boundary**:
   - State clearly that field dispatch is in staging/simulation mode (`LIVE_DISPATCH_ENABLED = false`).
   - Do not claim that real emergency vehicles or municipal crews are automatically paged.
3. **Hydraulic Model Claims**:
   - Accurately describe the 2D diffusive-wave simulation as an exploratory screening model on a 25m DEM grid.
   - Do not claim calibrated hydraulic certification or FEMA regulatory compliance.
4. **Audit Trail Claims**:
   - Describe Forge KVS storage as application-level audit logging with canonical hashing.
   - Do not claim blockchain, hardware security module (HSM), or distributed Byzantine fault-tolerant immutability.

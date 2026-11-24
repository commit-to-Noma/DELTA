# Codegeist 2026: Master Winning Guidelines & Evaluation Rubric

> **Theme**: *"Build with context. Ship with confidence."*  
> **Platform**: Atlassian Forge (Serverless)  
> **Primary Category**: **Apps for Specialized Industries** (Municipal Flood Defense & Healthcare Arterial Access)  
> **Prize Pool**: $120,000+ ($15K 1st Place per Category + $1.5K Bonus Prizes)  
> **Deadline**: 22 Dec 2026 @ 10:00pm GMT+2  

---

## 1. Direct Insights from Codegeist Judges (Adam & Danny Thompson)

Directives established in the official judge briefings:

1. **Move Beyond Generic AI & Dashboards (Adam, Group Product Manager for Forge)**:
   - *"With the rise of vibe coding, we're going to see more apps than ever. Apps that just say 'summarize this ticket' or 'generic dashboard of work items' will not stand out."*
   - Apps must solve a **deep, specific problem** for a concrete persona and use **real Atlassian context**.
2. **Proactive Workflow Gates Beat Conversational Bots**:
   - Judges specifically favor **proactive workflow gates** (e.g. Jira workflow conditions/validators that block dangerous or un-audited status transitions) over apps that force users to open a chat window and chat with an agent.
   - Embed intelligence directly into the user's natural workflow (Jira Issue Panels, Glances, and Workflow Transitions).
3. **The Single "Golden Journey" Demo**:
   - Judges evaluate hundreds of submissions on fresh demo sites. What separates a true product experience is a single, crisp, unforgettable **Golden Journey** showing a complete, resonant use case in under 5 minutes.
4. **Platform Infrastructure Realities**:
   - **Forge LLMs**: Do NOT have free credits for hackathon entrants this year (require payment method). Applications must NOT have a brittle runtime dependency on Forge LLM credits; core simulation and decision logic must be deterministic and robust.
   - **Teamwork Graph API**: Now in **public preview** — no allowlisting required!
   - **Open Source Engines**: Entrants can bring their own engines, but MUST build substantial, deep adaptations into the Atlassian platform and workflows.
5. **Human in the Loop, Not Near the Loop (Danny Thompson, Atlassian)**:
   - AI and simulation models suggest, evaluate, and rank; **only authenticated human officers hold approval authority**.
   - Downstream actions (JSM dispatch, Confluence runbooks, road closures) are strictly gated behind this explicit sign-off step.

---

## 2. Judging Rubric & Tie-Breaker Priority (Strictly 20% Each)

In Codegeist judging, ties are broken sequentially using the order of criteria below:

1. **Technological Implementation (20% - TIE BREAKER #1)**:
   - Must be a genuine, non-trivial, end-to-end working implementation.
   - Avoid shallow wrappers or hard-coded paths. Live data fetching, dynamic error handling, realistic data models.
   - 100% Forge serverless compliance with zero unsafe-inline CSP violations.
2. **Design & UX (20% - TIE BREAKER #2)**:
   - Complete, coherent product experience (not just a technical proof-of-concept).
   - Strict 60/30/10 tactical palette: Storm Grey (`#3C434B`), Matte Onyx (`#14171A`), Safety Orange (`#FF6B1A` for action/change only), Bone text (`#E8E6E1`).
   - Map hazards visualized via hatching and map-confined red (`#EF4444`).
3. **Potential Impact (20% - TIE BREAKER #3)**:
   - Credible, quantifiable solution for municipal emergency operations and critical infrastructure protection.
   - Demonstrable time saved, lives and ambulance access protected, and field resources optimally deployed.
4. **Innovation / Idea (20% - TIE BREAKER #4)**:
   - Coupling deterministic 2D hydraulic overland flow modeling with Jira Service Management dispatch and Confluence audit documentation.
   - Pioneering proactive workflow validation gates powered by spatial physics simulations.
5. **Presentation (20% - TIE BREAKER #5)**:
   - High-energy, crisp demo video under 5 minutes on YouTube illustrating the "Golden Journey".
   - Well-structured Devpost text explaining problem, solution, tech stack, and impact.

---

## 3. Targeted Main Category & Bonus Prizes

### Main Category: Apps for Specialized Industries
- **Target Persona**: Municipal Flood Incident Commanders, Public Works Directors, Emergency Operations Centers (EOC), and Healthcare Facility Logistics Directors.
- **Problem**: During severe convective rain events, emergency managers lack spatial hydraulic intelligence to know which hospital corridors will fail first and which field interventions will keep ambulance bays open.

### Targeted Bonus Prizes ($1,500 each)
1. **Best Agents - Rovo / Assignable Agents**:
   - `rovo:agent` ("DELTA Hydraulic Advisor") with specialized skills and actions (`get-simulation-status`, `evaluate-interventions`).
2. **Best Apps with Teamwork Graph Integration**:
   - Links flood incidents, critical medical facilities, municipal drainage infrastructure, and historical post-incident reviews in Teamwork Graph.
3. **Best App with Atlassian MCP**:
   - Exposes DELTA hydraulic solver inspection and candidate intervention tools via Model Context Protocol (`skill.md` provided).
4. **Best Marketplace Published App**:
   - Packaged and pre-submitted to the Atlassian Marketplace following enterprise app standards.

---

## 4. The "Golden Journey" Script Structure (< 5:00 min)

1. **0:00 - 0:45 | Problem & Baseline**:
   - Incident Commander opens DELTA in Jira. NOAA Atlas 14 50-year storm event hitting Boston Longwood. 5 major hospitals (Brigham & Women's, Boston Children's, BIDMC) are monitored.
2. **0:45 - 1:45 | Dynamic Disruption Injected**:
   - Field report arrives: Muddy River gravity culvert is 80% blocked by storm debris.
   - Injected live into DELTA: 2D diffusive wave solver recalculates overland ponding.
   - Brookline Avenue floods to $0.42\text{ m}$; access to Brigham & Women's and Boston Children's is severed!
3. **1:45 - 2:45 | Multi-Scenario Intervention Scoring**:
   - DELTA runs 3 candidate plans: Plan A (Sandbag dyke), Plan B (High-capacity mobile pump), Plan C (Culvert jetting).
   - Rovo Agent explains physical trade-offs: Plan A deflects water to BIDMC East; Plan B evacuates $1,800\text{ m}^3$ to downstream parkland, reopening ambulance access.
4. **2:45 - 3:30 | Human Approval & Proactive Workflow Gate**:
   - Incident Commander signs Plan B. Creates an append-only Decision Record in Forge KVS storage.
   - Jira Workflow Validator validates the Decision Record, unlocking the incident transition to `Dispatched`.
5. **3:30 - 4:15 | Field Crew Dispatch & Confluence Runbook**:
   - Creates a Jira Service Management dispatch issue with exact GPS coordinates and crew requirements.
   - Generates an immutable, comprehensive Post-Incident Runbook in Confluence via Forge API.
6. **4:15 - 4:45 | Architecture, Security & Forge Native Rationale**:
   - 100% serverless, zero egress, zero external database, data residency compliance.


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

### Targeted Bonus Prizes ($1,500 each — 24 Winners Total, 6 per Category)
*Note: A single submission can win up to one Grand Prize ($15,000) AND one Bonus Prize ($1,500), for a potential $16,500 top award.*

1. **Best Agents - Rovo / Assignable Agents (6 Winners @ $1,500)**:
   - Forge apps including the `rovo:agent` module, `rovo:agentConnector` module, or reusable `rovo:skill` and `rovo:action` modules that other agents can invoke as tools.
   - *DELTA Implementation*: `rovo:agent` ("DELTA Hydraulic Advisor") with dedicated actions (`get-simulation-status`, `evaluate-interventions`).
2. **Best App with Atlassian MCP (6 Winners @ $1,500)**:
   - Forge apps exposing tools via the Atlassian MCP server using the `rovo:mcp` module, accompanied by open-source `skill.md`.
   - *DELTA Implementation*: Exposes 2D hydraulic solver state inspection and candidate intervention evaluation over MCP.
3. **Best Apps with Teamwork Graph Integration (6 Winners @ $1,500)**:
   - Connects data into the graph and/or consumes data from the Teamwork Graph API (now in public preview).
   - *DELTA Implementation*: Links flood incidents, critical medical facilities, municipal drainage infrastructure, and historical post-incident reviews in TWG.
4. **Best Marketplace Published App (6 Winners @ $1,500)**:
   - Published to the Atlassian Marketplace or submitted for listing.
   - *CRITICAL DEVPOST REQUIREMENT*: *"Submit your listing early so the review ticket link is ready when you submit. Provide either the link to the listing or link to the Marketplace review ticket."*
   - *DELTA Implementation*: Early packaging and Marketplace review ticket submission prior to the Dec 22 deadline.

---

## 4. Official Submission Checklist & Non-Negotiables (Devpost Rules)

1. **Access / Installable Link**:
   - Provide an installation link created via [Forge Distribution](https://developer.atlassian.com/platform/forge/distribute-your-apps/#start-sharing-your-app).
   - Detailed configuration and testing instructions for judges (sample project, keys, test prompts).
2. **Public YouTube Demo Video (< 5:00 minutes)**:
   - Must be uploaded to YouTube and made publicly visible.
   - Must demonstrate the app functioning on the device/screen for which it was built.
   - Judges are not required to watch beyond five minutes.
   - Zero copyrighted music or unauthorized third-party trademarks.
3. **Devpost Form Fields**:
   - Explicit selection of Category: **Apps for Specialized Industries**.
   - Explicit selection of Bonus Prizes with accompanying justifications.
   - Marketplace review ticket link or published listing URL.
   - Clear text explanation of how the project meets the main technology requirement (Forge serverless).
4. **Original Work & Licensing Compliance**:
   - Compliant open-source and third-party data licenses (USGS 3DEP CC0, OpenStreetMap ODbL 1.0 with attribution, NOAA Atlas 14).
   - Append-only decision records with zero synthetic data presented as real.

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
   - 100% serverless, zero egress, zero external database, Runs on Atlassian eligible.


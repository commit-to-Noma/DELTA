# Codegeist 2026: Master Winning Guidelines & Evaluation Rubric

> **Theme**: *"Build with context. Ship with confidence."*  
> **Platform**: Atlassian Forge (Serverless)  
> **Prize Pool**: $120,000+ ($15K 1st Place per Category + $1.5K Bonus Prizes)  
> **Deadline**: 22 Dec 2026 @ 10:00pm GMT+2  

---

## 1. Hackathon Objective & The Context Philosophy
Atlassian is emphasizing that **"AI can think, but knowing what to do takes context."**
The winning projects will not just call an LLM with generic prompts. They will harness:
1. **Teamwork Graph (TWG)**: Connecting goals, decisions, teams, issues, documentation, and dependencies into an associative graph memory.
2. **Atlassian Rovo**: Assignable AI agents, skills, and actions embedded directly into developer and business workflows.
3. **Model Context Protocol (MCP)**: Exposing Forge tools and Atlassian context via standard MCP servers and skill configurations.
4. **Forge Platform Native Security & Extensibility**: Native UI, serverless backend resolvers, isolated execution, and enterprise compliance.

---

## 2. Judging Rubric & Tie-Breaker Priority (Strictly 20% Each)

In Codegeist judging, ties are broken sequentially using the order of criteria below:

1. **Technological Implementation (20% - TIE BREAKER #1)**:
   - Must be a genuine, non-trivial, end-to-end working implementation.
   - Avoid shallow wrappers or hard-coded paths. Live data fetching, dynamic error handling, realistic data models.
2. **Design & UX (20% - TIE BREAKER #2)**:
   - Complete, coherent product experience (not just a technical proof-of-concept).
   - Polished Atlaskit look-and-feel, intuitive interactions, crisp status/loading states.
3. **Potential Impact (20% - TIE BREAKER #3)**:
   - Credible, quantifiable solution for a real problem facing software/business teams.
   - Demonstrable time saved, risk avoided, or velocity unlocked.
4. **Innovation / Idea (20% - TIE BREAKER #4)**:
   - Novelty and differentiation from existing Marketplace apps.
   - Unorthodox or creative synthesis of context + action.
5. **Presentation (20% - TIE BREAKER #5)**:
   - High-energy, crisp demo video under 5 minutes on YouTube.
   - Well-structured Devpost text explaining problem, solution, tech stack, and impact.

---

## 3. Categories & Bonus Prize Alignment

### Main Categories (Choose 1)
- **Apps for Software Teams**: Smarter code reviews, deployment awareness, context-driven issue triage, incident response, architecture mapping.
- **Apps for Business Teams**: Decisive action for marketing, HR, finance, sales, legal, customer support.
- **Apps for Specialized Industries**: Domain-specific context for healthcare, finance, manufacturing, legal, automotive.

### Targeted Bonus Prizes ($1,500 each - max 1 per winning submission)
- **Best Agents - Rovo / Assignable Agents**: Uses `rovo:agent`, `rovo:agentConnector`, `rovo:skill`, `rovo:action`.
- **Best App with Atlassian MCP**: Uses `rovo:mcp` module, tools exposed over MCP, accompanied by open-source `skill.md`.
- **Best Apps with Teamwork Graph Integration**: Ingests data to TWG connector and/or queries the TWG API.
- **Best Marketplace Published App**: App listed or submitted for review on Atlassian Marketplace.

---

## 4. Submission Checklist & Non-Negotiables

- [ ] **Working Forge Application**: Proper `manifest.yml`, Forge runtime modules, valid scopes.
- [ ] **Installable Link**: Distributable link generated via `forge install` / distribution settings so judges can test on their site.
- [ ] **Clear Testing Instructions**: Step-by-step setup walkthrough for judges (sample project, keys, test prompts).
- [ ] **YouTube Demo Video (< 5 minutes)**: Must show live end-to-end workflow on the intended device/screen. Must be public.
- [ ] **Devpost Submission Write-up**: Detailed problem statement, solution architecture, technical write-up of Forge/TWG/Rovo integration.
- [ ] **Category & Bonus Prize Declarations**: Explicit selection and justification in the submission form.

---

## 5. Development Strategy & Guidelines for DELTA
Throughout all code generation, UI design, and documentation:
1. Every component must be built to production standards (modular code, clean error boundaries, type safety).
2. The UI must feel like a first-class Atlassian citizen.
3. The context engine must show real graph reasoning (not dummy mock strings).
4. Keep the install and setup zero-friction for judges.

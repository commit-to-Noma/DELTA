#!/usr/bin/env node
// External rovo:mcp proof checklist. This script does NOT invent a transport:
// real calls go through the Atlassian Rovo MCP endpoint authenticated as a user.
// It prints the exact sequence to run/record from Copilot Desktop / Claude / Cursor.
const steps = [
  '1. On the test site, open DELTA Engine and run Phase 1 → Phase 3 so Forge KVS stores a run (status COMPLETED_RUN).',
  '2. Connect the external agent to the Atlassian MCP/Rovo endpoint for that site and confirm DELTA Hydraulic MCP tools are listed.',
  '3. Call get-simulation-status — expect status COMPLETED_RUN (or honestly NO_RUN if Phase 1-3 were not run).',
  '4. Call evaluate-interventions — explain ranking using ONLY returned differentials; a stored NOAA run currently ranks Plan Beta first.',
  '5. Call query-related-context and query-teamwork-graph — check liveStatus (LIVE_*, *_UNAVAILABLE are honest failures, never fabricate).',
  '6. Record ~20s: tool list, the two calls, and the grounded answer. Save the clip/link for the Devpost video.',
];
console.log('DELTA rovo:mcp external verification\n' + steps.join('\n'));
if (process.env.FORGE_EMAIL || process.env.ATLASSIAN_API_TOKEN) console.log('\nNote: API tokens do not substitute for the Rovo MCP OAuth flow; use the agent MCP connection.');

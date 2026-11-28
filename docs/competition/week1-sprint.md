# Week 1 Sprint (Nov 28 – Dec 4): Lock live paths + Upgrades 1 & 2

## Day 0 checklist (today)
- [ ] 60-second click-through on one-atlas-xttm.atlassian.net (dev): Approve → Confluence → Dispatch → Sub-task, watch `forge logs`.
- [ ] `npm test` green, `npm run build` green, `forge lint`/`forge deploy` development.
- [ ] Sandbox: enable, place Pump + Barrier + Blockage on 3 cells, confirm solver delta + markers + Reset Golden Journey.
- [ ] Create a flood-titled issue → proactive comment once (create again/retrigger must not duplicate); non-flood issue must be ignored.
- [ ] Issue panel on that issue: snapshot card shows peak/storage or honest NO_RUN.

## Acceptance
- Golden Journey unchanged when sandbox is OFF and no custom actions exist.
- Every number in sandbox/panel/trigger text comes from a solver or KVS; NO_RUN is honest.
- Tests added: customSandbox, proactiveTrigger, governanceSettings, related context.

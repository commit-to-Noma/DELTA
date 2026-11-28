# DELTA UX Overhaul — Handover

**Phase 0 commit:** `a9063eb2c89c83fef2dd93f86263c1c765381beb` (`feat(ux): Phase 0 quick wins — dedup nav, plain-English labels, specs drawer, sandbox bounding, Rovo starters`), on top of base `d37231ccaf69c73852e5816b00e17bef715f79ef`. This HANDOVER is committed immediately after that commit; `git log --oneline -2` shows both. Source plan: `docs/competition/ux-overhaul-plan.md` (restored in the Phase 0 commit from the parent session's checkpoint — it was not on `main`).

**Hard rule (all phases):** zero backend/feature regression — presentation, interaction, and performance only. No new districts, no backend/resolver changes, no feature removal. Do **not** run `forge deploy` until the plan's verification gate for that phase says to.

## Completed — Phase 0 (Quick wins)

- [x] **Nav dedup:** Removed the top `01 → 05` "Compact Stage Progression Rail" from `src/components/shell/AppShell.tsx`; the sidebar is now the sole navigation, with a slim non-interactive current-stage label bar in its place. One clean header bar retained; right-side negative space reclaimed.
- [x] **Stage subtitles / "What to do here" + single orange primary CTA per stage:** Shared `src/components/common/StageIntro.tsx` ("What to do here: …") added at the top of all five stages — `OverviewDistrictView`, `FloodSimulationView`, `InterventionsView`, `DecisionBriefingView`, `OperationalTicketsView`. Each stage keeps/has exactly one orange primary CTA (Enter Simulation / Compare Interventions / Approve Decision / Go to Step 03 to Approve / Approve a new decision respectively).
- [x] **Human subtitle on Stage 1 hero:** "Five hospitals beside the Muddy River floodplain — one storm can cut their access roads" replaces the EPSG/grid string in the hero (moved to the specs drawer, not deleted).
- [x] **Plain-English storm labels:** `plainStormLabel()` / `plainStormHint()` in `src/simulation/interventionEngine.ts` — Light · 15 mm/h, Moderate · 35 mm/h, Severe · 75 mm/h, 50-Year Storm · 104 mm (ids: `synthetic-low-intensity`, `synthetic-moderate-stress`, `synthetic-high-intensity`, `reference-noaa-50yr`), each with a one-line impact hint. Used in the rainfall `<select>` options + hint text in Stages 1, 2, 3, 4. Full technical profile names are preserved after an em dash in the options; `StressProfile.name`/`provenance` are unchanged.
- [x] **Plain-English disruption consequences:** New optional `plainConsequence` field on `DisruptionScenario` (`src/simulation/disruptionEngine.ts`), set for all 3 `AUTHORITATIVE_DISRUPTIONS` (e.g. Brookline: "Blocks drainage toward Brigham & Women's and BIDMC — water on Brookline Ave rises first."), rendered on disruption cards in Stage 2 and in the Stage 1 disruption list.
- [x] **Collapsible ⓘ Data & Model Specs drawer:** New `src/components/common/DataModelSpecsDrawer.tsx` (collapsed by default), used in Stage 1 holding catchment dimensions/grid, EPSG CRS, DEM range, topography/infrastructure attribution, rainfall provenance, and drainage abstraction. Nothing deleted — the previous "Dataset Provenance & Model Scope" drawer content was folded into it.
- [x] **Rovo `conversationStarters`:** 4 starters added to `rovo:agent` (`delta-incident-agent`) in `manifest.yml`; validated by `forge lint` (no issues).
- [x] **Sandbox list bounding/collapsing:** In `FloodSimulationView` sandbox panel — result summary (`role="status"`) is now pinned **above** the list; list header shows count + "showing latest 3"; only the latest 3 actions render by default with a "Show all N actions / Show latest 3 only" toggle; prominent red "Clear all" button in the list header (the existing Undo / Clear sandbox / Reset Golden Journey links remain below).

**New files:** `src/components/common/StageIntro.tsx`, `src/components/common/DataModelSpecsDrawer.tsx`, `tests/phase0Ux.test.ts` (4 focused tests). **No Phase 1 or Phase 2 items were touched, and `forge deploy` was not run.**

## Remaining — Phase 1 (Map & performance, 1–2 days, the "wow") — NOT STARTED

- [ ] Canvas-scoped wheel zoom (`preventDefault`), drag pan, `+ / − / Reset` controls; **unit test inverse mapping** so sandbox clicks stay exact under transform.
- [ ] Smooth water: offscreen canvas + bilinear upsampling, translucent depth ramp, wet-edge contour; velocity-scaled animated flow arrows toward corridors.
- [ ] Legend docked in side panel / bottom strip — never over the map.
- [ ] Prominent **▶ Run / ⏸ Pause**, **1×/5×/20×**, **Reset** in Stage 2 toolbar; clarify Stage 2 = set storm+disruptions, Stage 3 = auto-compare plans. (Note: a compact Play/Pause/Step/Reset + 1x/2x/5x control already exists in live-playback mode — Phase 1 is about prominence/speeds, not creating it.)
- [ ] Decouple canvas frames from React renders (refs + ~5–10 Hz HUD updates).

## Remaining — Phase 2 (Scannable decision surfaces, 1 day) — NOT STARTED

- [ ] Stage 4: Executive Decision Summary Card first (plan, 3 metrics, approver, Confluence link, **Runs on Atlassian · SHA-256 Verified** 1-click integrity check); Stress Matrix / Governance / raw audit into accordions.
- [ ] Stage 5: compact real work-order cards (status, site, equipment count, Dispatch/link); 3 demo cards into closed-by-default **Example Templates**.
- [ ] Issue Panel: unlinked = compact catchment risk + Link/Open CTAs; linked = decision + metrics + Confluence + dispatch card.
- [ ] 3-Step Quickstart strip on Stage 1 when no saved run (dismissible): Run Storm → Approve & Publish → Dispatch & Verify Gate.

## Verification (run in the Phase 0 worktree, 2026-11-28)

Per-phase gate from the plan: `npm run lint && npm test && npm run build && forge lint` → push main → `forge deploy` (development) → visual check on one-atlas → only then production. **`forge deploy` was deliberately NOT run (per task instruction).**

| Command | Result |
|---|---|
| `npm run lint` (`tsc --noEmit`) | ✅ Pass (clean; `npm ci` was required first in the fresh worktree) |
| `npm test` (`vitest run`) | ✅ **247 passed (20 files)** — 243 pre-existing + 4 new `tests/phase0Ux.test.ts` |
| `npm run build` (`tsc -b && vite build`) | ✅ Pass (2399 modules, `dist/` built) |
| `forge lint` (Forge CLI 16.0.0) | ✅ "No issues found." |

Target from the plan (243+ tests always green) is met. To resume: start Phase 1 with the canvas zoom/pan item, re-run the four commands above, and only then consider `forge deploy` (development).

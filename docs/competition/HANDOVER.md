# DELTA UX Overhaul — Handover

**Status: Phases 0–2 COMPLETE** (Phase 2 = final polish, this update).

**Phase 2 commit:** see `git log --oneline -1` (`feat(ux): Phase 2 final polish — executive summary, compact work orders, panel + quickstart`), on top of Phase 1.

**Phase 1 commit:** `a6f228d1bf0a48e833eb5f27aeb4587fbef5822f` (`feat(ux): Phase 1 map zoom/pan, smoothed water, flow arrows, docked legend, decoupled playback`), on top of Phase 0. This HANDOVER update is committed immediately after that commit; `git log --oneline -3` shows both plus Phase 0.

**Phase 0 commit:** `a9063eb2c89c83fef2dd93f86263c1c765381beb` (`feat(ux): Phase 0 quick wins — dedup nav, plain-English labels, specs drawer, sandbox bounding, Rovo starters`), on top of base `d37231ccaf69c73852e5816b00e17bef715f79ef`. Source plan: `docs/competition/ux-overhaul-plan.md` (restored in the Phase 0 commit from the parent session's checkpoint — it was not on `main`).

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

## Completed — Phase 1 (Map & performance)

- [x] **Canvas-scoped wheel zoom / drag pan / controls:** Non-passive `wheel` listener with `preventDefault()` on the canvas only (page never zooms), click-drag pan (4px threshold so clicks still select), `+ / − / Reset View` overlay with zoom %. Pure viewport math in `src/simulation/mapViewport.ts` (`computeMapLayout`, `zoomAtPoint` focal-stable, `screenToGrid`/`gridToScreen`); **unit-tested round-trip inverse mapping** in `tests/phase1Map.test.ts` incl. Brookline culvert cell [17,26] under zoom+pan, so Click-Anywhere Sandbox placement stays exact. Split-comparison canvases keep viewport interaction disabled to stay synchronised.
- [x] **Smooth water + flow arrows:** Standard depth rendering now rasterises the 64×64 depth field to an offscreen canvas coloured by the soft translucent ramp `waterColorForDepth()` and upscales with `imageSmoothingEnabled = true` (bilinear), plus a wet-edge contour. Flow arrows are velocity-scaled (`flowArrowForGradient`: length/width/head scale with surface-gradient magnitude), dark-outlined for legibility, and animated downstream via a ref-driven phase. Delta (Δh) mode keeps its discrete comparison colours.
- [x] **Docked legend:** On-canvas legend drawing removed from `GeographicSimulationCanvas`; new HTML `src/components/simulation/MapLegend.tsx` docked in a bottom strip under the map in Stage 1 (`OverviewDistrictView`) and Stage 2 (`FloodSimulationView`), toggled by the existing Legend layer switch — never over hospitals/culverts.
- [x] **Prominent Stage 2 toolbar:** `▶ Run Simulation` / `⏸ Pause`, `1× / 5× / 20×` speed selector and `Reset` at the very top of Stage 2 (above the mode/rainfall bar), with live T+/rate/peak readout and "Stage 2 = set storm + disruptions · Stage 3 = auto-compare plans" clarifier. The compact in-map transport bar was aligned to the same 1×/5×/20× speeds.
- [x] **Render decoupling:** Live solver advances in `simStateRef`/`liveDepthRef` without per-tick React renders; `GeographicSimulationCanvas` redraws imperatively via `drawRef` (polls the depth ref + animates flow at ~120ms) and hover/viewport live in refs. Stage 2 HUD metrics (elapsed, peak, rate, storage, rain, drainage) update via throttled `syncHud` (~160ms) and hover telemetry is throttled to 100ms.

**New files:** `src/simulation/mapViewport.ts`, `src/components/simulation/MapLegend.tsx`, `tests/phase1Map.test.ts` (6 tests). **No Phase 2 items were touched, and `forge deploy` was not run.**

## Completed — Phase 2 (Scannable decision surfaces / final polish)

- [x] **Stage 4 Executive Decision Summary Card:** `DecisionBriefingView` now leads with a summary card (chosen plan, 3 key metrics — avoided storage / peak-depth reduction / corridors protected — commander signature + timestamp, Confluence audit link or "Publish Confluence audit in Step 03" jump, scenario hash) and a 1-click **Runs on Atlassian · SHA-256 Verified** integrity button backed by the real `verifyBriefingBinding` check (verified / mismatch / pending states). Stress Matrix, Governance Binding, and Raw Audit Details (briefing id, hashes, export-binding state) are tucked into closed-by-default accordions (`src/components/common/Accordion.tsx`). Successful Confluence publishes in Step 03 now persist the page URL (`delta_confluence_audit_url`) so Stage 4 can link it.
- [x] **Stage 5 compact work orders:** Real approved work orders render first as compact, scannable action cards (status badge, Target Site, equipment summary, primary **Dispatch Live Jira Issue** button / clickable linked ticket) with the full provenance/checklist detail preserved below. The 3 demo seeds (`DEC-2026-079/080/081`) are partitioned by `partitionWorkOrders()` into a closed-by-default **Example Templates** accordion.
- [x] **Jira Issue Panel polish:** Unlinked state leads with the live catchment risk summary ("Live catchment risk summary · Flood-impact snapshot") plus 1-click **Link Decision** / **Open Ops Center** CTAs; linked state adds a crisp Decision + Metrics + Confluence + Dispatch card (`panel-dispatch-card`) above the existing rationale/work-order detail. Panel state classification is the pure `issuePanelState()` helper.
- [x] **First-Run Quickstart strip:** Stage 1 shows a compact dismissible 3-step strip (1. Run Storm → 2. Approve & Audit → 3. Dispatch & Verify Gate) only when no saved run exists (no decisions and no real work orders), with a 1-click jump to Stage 2; dismissal persists in localStorage.

**New files:** `src/simulation/phase2Ux.ts` (pure helpers), `src/components/common/Accordion.tsx`, `tests/phase2Ux.test.ts` (9 tests). Presentation-only; no backend/resolver changes.

## Verification

### Phase 2 (2026-11-28)

| Command | Result |
|---|---|
| `npm run lint` (`tsc --noEmit`) | ✅ Pass |
| `npm test` (`vitest run`) | ✅ **262 passed (22 files)** — 253 Phase 1 + 9 new `tests/phase2Ux.test.ts` |
| `npm run build` (`tsc -b && vite build`) | ✅ Pass (2403 modules, 0 chunk warnings) |
| `forge lint` | ✅ "No issues found." (0 errors, 0 warnings) |

Deploy (2026-11-28): `forge deploy -e development` ✅ (app v5.2.0, "Runs on Atlassian" eligible). Development upgrades for Jira + Confluence on one-atlas-xttm.atlassian.net run explicitly — both already at latest major v5 ("Up-to-date"), so the new UI is live for visual inspection. Production promotion only after that visual check passes.


### Phase 1 (run in the Phase 1 worktree, 2026-11-28)

Per-phase gate from the plan: `npm run lint && npm test && npm run build && forge lint` → push main → `forge deploy` (development) → visual check on one-atlas → only then production. **`forge deploy` was deliberately NOT run (per task instruction), so the plan's post-deploy visual check remains outstanding.**

| Command | Result |
|---|---|
| `npm run lint` (`tsc --noEmit`) | ✅ Pass (clean; `npm ci` was required first in the fresh worktree) |
| `npm test` (`vitest run`) | ✅ **253 passed (21 files)** — 247 Phase 0 + 6 new `tests/phase1Map.test.ts` |
| `npm run build` (`tsc -b && vite build`) | ✅ Pass (2401 modules, `dist/` built) |
| `forge lint` | ✅ "No issues found." |

### Phase 0 (2026-11-28)

| Command | Result |
|---|---|
| `npm run lint` | ✅ Pass |
| `npm test` | ✅ **247 passed (20 files)** — 243 pre-existing + 4 new `tests/phase0Ux.test.ts` |
| `npm run build` | ✅ Pass (2399 modules) |
| `forge lint` | ✅ "No issues found." |

Target from the plan (243+ tests always green) is met and rising (253). To resume: start Phase 2 with the Stage 4 Executive Decision Summary Card, re-run the four commands above, and only then consider `forge deploy` (development) + visual check on one-atlas.

Production deploy (2026-11-28): `forge deploy -e production` ✅ (app v3.1.0 production versioning, "Runs on Atlassian" eligible) after local visual check of v5.2.0 dev build passed (zoom controls, quickstart, human hero, specs drawer present). Judge Sharing Link serves this build once Distribution status is Sharing (manual Developer Console step).

Distribution (2026-11-28): Developer Console → delta-decision-engine → Distribution set to **Sharing with anyone** (Company: DELTA, support: GitHub Issues, Privacy: PRIVACY.md URL), Jira+Confluence selected, installation link generated (production v3.1.0, deployed Nov 28 2026 17:26 UTC). Test-install on nomathembancube2005.atlassian.net pending: console tab logged out before link copy/test — sign in at developer.atlassian.com/console, copy link from Distribution page, install once on that site to verify.

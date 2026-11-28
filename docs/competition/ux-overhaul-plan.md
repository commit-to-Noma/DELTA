# DELTA UX Overhaul — Championship Plan (PLANNING ONLY, Nov 28)

Status: **agreed direction, development not started.** Source: developer's own fresh-eyes walkthrough of every screen (screenshots Nov 28 18:26) + Codegeist winner-pattern research. Zero backend/feature regression is a hard rule in every phase.

## Honest answers first
- **Why Boston Longwood, only district?** Keep it. 5 real trauma/cancer hospitals beside the real Muddy River floodplain, real USGS LiDAR + NOAA Atlas 14. One deeply real catchment > five shallow fake ones. Fix = 1 human line up top ("Five hospitals beside the Muddy River floodplain — one storm can cut their access roads"), specs in an ⓘ drawer.
- **Real vs static today:** Real = 2D solver, USGS grid, sandbox recompute, KVS ledger, live dispatch, proactive trigger, workflow gate, Confluence export, Rovo + MCP. Static-by-design = packaged catchment dataset (normal for a twin) + 3 demo work orders (to be collapsed, see Phase 2).
- **Is engineer-cockpit bad for judges?** Mixed. Judges reward depth, but Design (20%) + Impact (20%) reward a commander understanding it in 60 seconds. Strategy: keep every capability, surface it progressively (human layer first, engineering layer one click deep).

## What the walkthrough actually showed (evidence)
1. Header chrome wordy + duplicated: top bar chips (DELTA / project / RECALCULATING / Jira Panel / Duty Commander…) plus a redundant `01 → 05` stepper already in the sidebar.
2. Stage 1 feels like "just looking at a map": purpose, rainfall meaning, and what to *do* are unclear; negative space right of the catchment title; EPSG/NOAA strings clutter the hero.
3. Map: no zoom/pan (browser zoom zooms the page), blocky pixel water, Legend opens **on top of** the map covering features, flow vectors under-used.
4. Stage 2: no obvious Run/Pause/speed; "simulate" is implicit (`Live Solver Progression` label is easy to miss); disruption toggles lack plain-English consequences; sandbox action list grows unbounded (screenshot: 12 identical PUMP rows) pushing the result summary off-screen.
5. Lag: first-run ~1 min + UI jank during compute; per-frame work tied to React renders.
6. Stage 4 = wall of words (profile list + 5 tabs). Stage 5 = very long cards. Jira Issue Panel (local/unlinked) looks empty/unfinished.
7. Repetition everywhere: same profile selector, disruption chips, and status banners repeated per stage → one big clump.

## Phases (each independently shippable, tests green at each step)

### Phase 0 — Quick wins (½ day, highest ROI/effort)
- Remove top `01→05` stepper; one clean header bar; reclaim right-side negative space.
- 1-line human subtitle + single orange primary CTA per stage ("What to do here").
- Plain-English storm labels (Light 15 / Moderate 35 / Severe 75 mm/h / 50-Year 104 mm) + impact hint; disruption cards get one plain consequence line ("Blocks drainage toward Brigham & BIDMC").
- Collapsible **ⓘ Data & Model Specs** drawer holding EPSG/NOAA/grid strings (nothing deleted).
- `conversationStarters` (3–4) on `rovo:agent` in manifest.yml — proven FleetOps/Frank winner pattern; validate with forge lint.
- Sandbox list hygiene: show count + latest 3, collapse rest, prominent Clear; result summary pinned above the list.

### Phase 1 — Map & performance (1–2 days, the "wow")
- Canvas-scoped wheel zoom (`preventDefault`), drag pan, `+ / − / Reset` controls; **unit test inverse mapping** so sandbox clicks stay exact under transform.
- Smooth water: offscreen canvas + bilinear upsampling, translucent depth ramp, wet-edge contour; velocity-scaled animated flow arrows toward corridors.
- Legend docked in side panel / bottom strip — never over the map.
- Prominent **▶ Run / ⏸ Pause**, **1×/5×/20×**, **Reset** in Stage 2 toolbar; clarify Stage 2 = set storm+disruptions, Stage 3 = auto-compare plans.
- Decouple canvas frames from React renders (refs + ~5–10 Hz HUD updates).

### Phase 2 — Scannable decision surfaces (1 day)
- Stage 4: Executive Decision Summary Card first (plan, 3 metrics, approver, Confluence link, **Runs on Atlassian · SHA-256 Verified** 1-click integrity check); Stress Matrix / Governance / raw audit into accordions.
- Stage 5: compact real work-order cards (status, site, equipment count, Dispatch/link); 3 demo cards into closed-by-default **Example Templates**.
- Issue Panel: unlinked = compact catchment risk + Link/Open CTAs; linked = decision + metrics + Confluence + dispatch card.
- 3-Step Quickstart strip on Stage 1 when no saved run (dismissible): Run Storm → Approve & Publish → Dispatch & Verify Gate (FleetOps zero-friction pattern).

## Verification per phase
`npm run lint && npm test && npm run build && forge lint` → push main → `forge deploy` (development) → visual check on one-atlas → only then production. Target: 243+ tests always green.

## Explicit non-goals
No new districts, no backend/resolver changes, no feature removal — presentation, interaction, and performance only.

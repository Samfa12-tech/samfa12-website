> Historical design/handoff note. Current behavior and validation are in FEATURE_STATUS.md, BALANCE_RATIONALE.md and REVIEW_VALIDATION.md.

# Codex handoff — Reef Sweep: Lantern Bay

## Start here

Sam asked for a rich playable initial browser build, then a handoff for further development. **Continue this project; do not replace it with a new engine or a tiny reimplementation.** Read `AGENTS.md`, `README.md`, `docs/FEATURE_STATUS.md`, `docs/TESTING.md`, then this document. Read the full approved design in `docs/GAME_DESIGN.md` before changing game rules.

The deliverable is a functional first chapter. A fresh career can swim, spear and manually secure lionfish, perform conservation jobs, encounter Marlow/moray, return, settle catches, select highlight cards, buy upgrades and unlock the second site. It is not yet release-certified on physical devices. Models are original first-pass procedural geometry.

## Current local candidate — v0.3.0-preview.1

The source and dist now contain five dive sites, delayed return-visit reef recovery, expanded procedural creature/arm animation and a working wrist instrument. Read `docs/CAMPAIGN_PREVIEW.md` first for current evidence. This candidate is local-only, prepared for owner playtesting; do not infer publication authority from the previous v0.2 release. The live game remains v0.2.0-preview.3. Its controller/touch/High owner feedback does not certify the new watch or sites on physical devices.

## Historical v0.2 foundation

The local package identifies `0.2.0-preview.1`; this working tree is not a published release. It adds nine five-rank gear lines, regulator-gated air capacity, surface breaching, deeper wreck/outfall survey stations, a research contract, unlockable night dives with a cautious reef shark, optional three-cut filleting and abundant coral/seaweed dressing. Lionfish contact now costs health and air. Regulator breathing and exhale bubbles are implemented and checked in Chromium; an occasional BOOM toast follows a confirmed lionfish hit. Owner listening and physical-phone acceptance remain outstanding. The progression JSON is an economic fixture, not a human playtest. Preserve schema 1 and legacy upgrade-ID saves.

## Baseline commands

```sh
npm install
npm test
npm run typecheck
npm run build
npm run preview
```

Open the local preview and the self-contained `Reef-Sweep.html`. On a normal development machine, test real same-origin Storage rather than relying only on the injected test environment. Test an itch-style iframe with and without pointer-lock permission.

Preserve the baseline before editing. Keep the original supplied ZIP and preview evidence, capture screenshots, export a fresh and progressed save, then make small reversible changes. The current owner task explicitly withholds publication. Review `docs/browser-test-results.json` and the test runner's fixture notes: automated coverage is meaningful but is not a human campaign playthrough or a physical-phone benchmark.

## Priority 0 — establish release-blocking evidence

1. **Physical input matrix:** Windows Chrome mouse/keyboard, Android Chrome touch in landscape, iPhone Safari landscape, and a standard controller/Backbone. Test draw+aim+release, manual secure, rise/descend, menus, cancel, focus loss, interrupted touches, portrait rotation and resume. Keep all modes on identical game rules.
2. **Origin/lifecycle saves:** close during a dive, pending settlement, and the receipt; reload; swap among all slots; export/import across hosts; fill or deny Storage. Verify no duplicated settlement and no silent loss of pending work.
3. **Long-session graphics:** five complete dives plus repeated settings/site changes. Track draw calls, active meshes, CPU/heap and frame-time percentiles; record device, browser, resolution, quality and thermal state. Do not equate SwiftShader FPS with hardware performance.
4. **Human first-outing test:** a player who has not read the source should find the first target, draw, collect, locate work, and board without a developer teleport. Fix onboarding and control discoverability before adding content.

Acceptance: no crash/soft-lock, no through-wall hunt/work/boarding, no charged strike leaking from a modal, no duplicated money, no irreversible progression loss, controls usable on the smaller landscape viewport. Document any remaining failure rather than reporting a generic pass.

## Priority 1 — movement, interaction and first-person art

The present spear/manual-collection loop is the central mechanic. Improve feel without turning it into rapid-fire damage combat. Keep one deliberate good strike as the normal resolution, short range, readable readiness and a visible exposed catch.

- Refine foreground hands, finger poses, pole draw/release and the tube-transfer animation. The current gloves/forearms are a first pass; avoid reopening full-body IK work until these are solid.
- Verify camera/aim convergence, proxy alignment and equipment lowering near walls. The visible tip must not imply reach that the ray cannot achieve.
- Give planting and cleanup a clearer physical tool animation while keeping the interaction short and phone-friendly.
- Tune current strength, hover response and stopping distance through actual play, not by multiplying all speeds.
- Preserve an emergency/manual return from edge cases. Full tube must never block boarding or require sacrificing the entire career.

Acceptance: a clear first target can be approached and collected with mouse and touch without repeated accidental misses; clipping and feedback are improved in saved comparison screenshots.

## Priority 2 — visual polish and ecological life

Sam wants lovely water and many beautiful fish. Invest in silhouette, motion, lighting and composition before adding dozens of species.

- Replace or refine hero meshes: lionfish, Marlow, moray, turtle and first-person hands. Use GLB only with documented scale, forward axis, triangle/material budget and licenses. Keep silhouette-based identification.
- Keep the continuous whole-body rock avoidance introduced in v0.2; tune swimming paths through owner playtests. Add schooling separation and grazing/shelter behaviours economically.
- Reduce the repeated boulder appearance with more authored formations, arches, coherent coral groupings and reef-edge composition. Keep logical navigation and target visibility.
- Refine surface/caustic balance, depth colour, shafts, suspended particles and lower-setting equivalents. Do not make distortion interfere with aiming.
- Make restoration differences read clearly between visits, while stating growth is game-time compressed.

Acceptance: screenshots and a moving capture demonstrate improved art without materially regressing the target device's frame times. No meaningful target or warning disappears on Low quality. Keep all asset sources and transformation records.

## Priority 3 — balance the complete first chapter

Current numbers are in `docs/TUNING.md`. They are starting values, not final balancing evidence.

Targets: an 8–12-minute typical early active dive; an affordable meaningful early purchase; scooter around two to four successful outings; cleaner/restored areas visibly improve; a rescued player can always launch again; conservation becomes financially worthwhile as local catches fall.

Run at least these play styles: conservative restaurant diver, cleaner/restorer, wildlife photographer, repeated rescues, and a player ignoring socials. Look for economic exploits in repeated surveys/events/sponsor payouts and avoid requiring followers to unlock basic diving progression.

Add an explicit **first-chapter completion milestone** only after balancing. Proposed milestone: both sites open, scooter owned, six debris items removed, four plots planted and at least one improved-site survey. This ending/celebration remains design only; it is **not implemented** in the v0.2 preview.

## Priority 4 — broaden career systems, not scope indiscriminately

The current highlights are honest image cards. To implement playable replays, record camera and relevant actor transforms in a bounded ring buffer, then replay a selected event. Actual video encoding/export is another feature and must be measured on phones. Do not relabel JPEGs as recorded video.

The current leaderboard is local. A genuine shared event service needs an explicitly chosen backend, rate limits, server-validated score contracts, privacy decisions and operations ownership. Do not invent online opponents. Do not connect Sam's real social accounts without a new explicit request.

Contracts and sponsors are deterministic first-pass rules. Expand variety with data-driven goals and clearer character writing, preserving the separation between cash, professional reputation and audience. Add more sites only after reachable-route tests are capable of their geometry.

## Priority 5 — conventional tooling, optional

The custom offline TS bundler and included Babylon source closure reproduce the current artifacts. Prefer keeping the working toolchain until Priority 0 is green. A migration to a pinned conventional `@babylonjs/core`/Vite setup can simplify normal development, but must not silently drop side-effect registrations or offline hosting support. Verify engine rendering, caustics, raw textures, material bindings, relative imports, audio startup and direct distribution playback.

## Explicit non-goals for this continuation

No FPS combat conversion, endless hostile animal pursuit, deliberate predator feeding, full restaurant/cooking gameplay, full ocean simulation, pay-to-win system, account wall, multiplayer or full-body IK requirement. The optional three-cut filleting activity prepares already-landed catch; it does not add a cooking sequence. No replacement soundtrack that only resembles Pocket Chordsmith: keep the editable composition and actual instrument configuration provenance.

## Required report at each milestone

Report implemented changes, commands and actual results, screenshots, physical-device evidence where relevant, changed save schema/tuning, known issues and the next bounded step. Separate code inspection, automated fixture coverage and human testing. Leave the project buildable with a playable distribution after each milestone.

## Suggested first instruction to the coding agent

> Continue Reef Sweep from this package. Read AGENTS.md and docs/CODEX_HANDOFF.md, reproduce the baseline, then address Priority 0 and the highest-impact interaction/visual defects. Preserve Babylon, the first-person manual collection loop, persistent reef work and Pocket Chordsmith music. Keep a working offline web build, add focused regression tests, and report actual device/test evidence. Do not rebuild the game from scratch or implement the planned online/video systems before the playable first chapter is solid.

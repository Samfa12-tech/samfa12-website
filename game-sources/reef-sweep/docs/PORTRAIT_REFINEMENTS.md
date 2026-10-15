# Reef Sweep v0.5.0-preview.2 portrait refinement candidate

Based on published main 3f104c1854d0704ec8985b8731053595cc75cf16 (v0.5.0-preview.1 / PR31). This is a new focused candidate. Parent review precedes website and existing Wavedash publication.

## Scope and audit

- [x] Reproduced the portrait boat obstruction. The cruising panel is now 106 CSS pixels tall at 390x844 and 320x568, with an accessible native Bay chart disclosure. Landscape/desktop start with the chart open. Buoy-only assignment, description, distance/fuel and reef condition preserve useful destination information. Harbour remains reachable.
- [x] Catch tube physically rotates down below the portrait view at rest, including maximum supported 100-degree FOV. It raises before the spear approaches, remains up through actual insertion and empty-prong withdrawal, then lowers. Shared coordinates retain actual struck meshes and sizes. Cancelled holds retract smoothly; orientation changes ease. No simulation/save fields added.
- [x] Removed the harbour's duplicate five-level selector and site-specific contract picker. Take the helm selects the real destination at its buoy. Suspended-dive resume, pending-catch review, chart, night setting, events, equipment, settings and save slots remain.
- [x] Added three to five original small seagulls above the bay and daytime surface. Swept wings, primary tips, beak/body/tail and restrained flight/wingbeats; 315 vertices per bird, shared material, no textures or new runtime dependency. Hidden underwater and at night. Wingbeats respect reduced motion.
- [x] Audited initial boat UI state: off-buoy assignment is disabled immediately, rather than inheriting an enabled default because both cached and current site were null. Status updates only when text changes, avoiding repeated live-region mutations at frame rate. Wavedash package test now derives the current version instead of hardcoding the previous release.

## Fresh validation

- TypeScript typecheck and source build pass; 189 automated tests pass, including whole-barrel projection, staged collection/cancellation and orientation tests.
- Eight standalone/manifest/package checks and two Wavedash package/startup/analytics checks pass.
- `tests/browser-refinements.py`: 92 passing checks, no page errors, local Chrome at 1280x800, 390x844, 844x390 and 320x568. Real keyboard/native touch steering and holds, chart disclosure, native assignment selection, two actual caught meshes/Shishkabob, cancellation, insertion, exactly-once securing, save/reload/resume, rotation and seagull scene lifecycle. Buoy/catch/surface positions are controlled fixtures.
- Generated website runtime must match all ten canonical distribution files. Portal content reproduction, catalogue, site, SEO and indexing checks pass. CI is an additional review gate.

The existing expedition preparation/settlement fixture passed all 16 checks, including repeat payout rejection and next-day reload. The deep quick interaction subset passed 19 checks with no page errors; its short 160-frame desktop boat samples had 7.7/7.6/7.7 ms median and 8.3/8.4/8.6 ms p95 for High/Balanced/Low. These are short laptop observations, not sustained phone performance. Final receipts are retained beside selected screenshots. A quick-mode deep fixture initially assumed an earlier Passage visit had initialized campaign state. Its fixture now initializes the valid optional extension explicitly; this was a fixture setup failure, not a runtime finding.

`tests/browser-refinement-motion.py` additionally records a real portrait native-touch cancelled hold, two-fish insertion, empty-prong withdrawal and lowered resting tube. Its cancellation/no-cargo and exactly-two-secured/resting assertions pass. The clip uses controlled fish placement and is a gameplay recording, not a substitute for physical-device acceptance.

## Visual evidence and limits

Selected actual gameplay captures and machine receipts: [review-evidence/refinements](review-evidence/refinements/README.md). Full loopback output remains in ignored qa-output/refinements and qa-output/expedition.

Five owner Library JPEG IDs resolved, but the current Library transfer helper was unavailable and no local bytes were materialized. None were viewed. Parent explicitly allowed independently reproducing the written HUD/tube/menu issues and proceeding with local before/after captures. No bypass, inferred owner-image content or re-upload request was used.

Chrome touch emulation is not physical iPhone Safari or Android certification. No physical phones are attached. Short desktop frame samples are not sustained mobile/thermal guarantees. The previous release's authenticated Wavedash gameplay restriction remains a verification consideration; a public listing/CLI publication receipt alone must not be described as a successful hosted gameplay launch.

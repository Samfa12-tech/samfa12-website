# Expedition update checkpoint

Base: refreshed origin/main 0907caa28e1d5b70b8858b2c0ab53053ad3be6fa. Baseline: 165/165 domain/input/render-contract tests pass. Isolated branch `codex/reef-sweep-expedition-update`; existing website and campaign checkouts untouched.

Publication gate: full implementation, tests/build/package, browser visual review and parent candidate review first. No publication has occurred.

## Scope checklist

- [ ] Comfortable portrait/landscape touch targets, drag aim, multitouch/cancellation, selection boundaries, HUD and reticle.
- [ ] Host/capability fullscreen and contextual audio hint.
- [ ] End-of-day rewards, receipt transition, idempotence and reload across days.
- [ ] Collision-free chart labels on all five maps.
- [ ] Actual struck fish retained through spear/tube motion; two-fish Shishkabob photo/popularity event.
- [ ] Size-aware restaurant sales, conservation and distance-based towing/boat fuel.
- [ ] Five distinct authored exploration routes; Marlow home; clear playable water and outer haze.
- [ ] Open pipe; ordinary stars/lobsters/sponges; more trash; overgrown habitat objects.
- [ ] Finite authored discoverable/saveable/equippable charms and restrained motion.
- [ ] Breach droplets, occasional impact flooding/air-cost clearing; convincing local sand only if suitable.
- [ ] Different cooking recipes; 3D filleting/scaling; navigable boat site selection.
- [ ] Later crown-of-thorns treatment/bounty interaction, distinct from ambient stars.
- [ ] High default, saved choices retained, sustained-performance consent prompt/suppression.
- [ ] Generic catch tube naming; reproducible versioned packaging and analytics unchanged.
- [ ] Blender-authored finished dive boat, editable .blend and efficient export; Blender and gameplay views inspected.
- [ ] Full tests, saves/economics/progression and responsive gameplay screenshots reviewed.
- [ ] Ready candidate commit/PR reviewed by parent.
- [ ] Website and existing Wavedash release published and separately verified.

## Findings

Settlement currently mutates the profile, then calls `preview()` before showing the receipt. Preview starts a real-contract run on a clone using the default catch order. When permanent removals leave fewer than four available fish, contract validation throws after payment but before screen transition. This is independent of day three. Fix preview to use free exploration and make cosmetic rendering unable to block an already committed receipt.

Physical Android/iPhone are unavailable. Browser emulation evidence will be reported separately from device acceptance. Blender 5.2 is installed. Local Windows sandbox blocks Git helper/network processes; authorized clone/fetch succeeded with reviewed escalation.

## Implementation checkpoint 2026-10-15

The candidate is now v0.5.0-preview.1. Domain/input tests: **177/177 pass**. First controlled Chrome desktop/touch flow: **16 checks pass, zero page errors**. Further all-site/carry/boat/performance review is in progress. No publication and no rate-limit interruption.

Implemented: touch/selection/reticle/HUD; chart packing; host fullscreen; receipt-preview fix; actual mesh/two catches and existing photo event; size pricing and two-distance fuel; one-home Marlow; open pipe and authored marine props; five keepsakes; mask water/clearing; boat driving, recipes and 3D scaling/filleting; later treatment sequence; High default and consent performance suggestion; version-derived packaging. Existing five distinct site terrain/collision routes are retained; new habitat groups reinforce their authored route landmarks. Sand puffs deliberately omitted pending convincing local effect work, as authorized by the brief.

Blender 5.2 authored the 6,774-triangle skiff; editable blend, GLB, generation script and two studio render views retained. Runtime uses a deterministic colour-mesh bake (one draw, no textures) because the existing pinned offline engine closure has no GLTF loader. No engine or external runtime dependency migration. Boat wave/roll/wake presentation has been visually revised after actual gameplay captures.

QA caught and fixed: unbundled preparation light type; fillet-result return stack; full-tube legacy boarding; dense chart packing; tube near-plane intrusion; overlapping landscape objective/buttons. Deep browser collection fixture is being changed from separated debug ticks (idle frames reset a held interaction) to actual held keyboard input; domain two-catch transfer already passes.

Parent progress messaging was attempted once via the available app tool, but the durable source thread ID returned `thread not found`. The parent can inspect this checkpoint and commentary; no message was delivered through that tool.

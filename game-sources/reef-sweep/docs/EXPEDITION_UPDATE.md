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

> Historical design/handoff note. Current behavior and validation are in FEATURE_STATUS.md, BALANCE_RATIONALE.md and REVIEW_VALIDATION.md.

# Reef Sweep v0.3.0-preview.1 — local playtest candidate

14 October 2026. Not published. Source is authoritative in this package; the original website checkout and unrelated edits are preserved.

Five sites: Sunlit Gardens, Tideglass Passage, Mangrove Reach, Azure Cenote and Rusted Harbour. New sites have different terrain, currents, structure forms, work and progressive unlocks. Roots, limestone and cargo structures meet each site's floor; deep-site island foundations extend to the outer seabed.

Native recovery is captured at outing start. Productive completed outings (including rescues with removals) advance stages; empty outings do not. Stage gates require 1/2/3/4/5 productive visits and 2/5/9/13/17 removals. Native-life growth strengthens from productive visit three. The snapshot survives save/reload and quality changes. A controlled Balanced fixture grew from 140 fish initially to 180/230/350/490/660 on successive productive returns. These are browser/domain fixtures, not a natural campaign playthrough.

Original procedural native fish now have more silhouettes, colour patterns and moving fins. Turtle flippers, ray wings and moray breathing/tail movement animate in the shared main/shadow shader. Original moray geometry is preserved. Independent hands/sleeves animate draw, strike, work, swim, scooter grip and watch checking. School paths around tall roots/pilings are prepared once at load. Plant triangle heights are cached per site; watch texture updates are capped at 5 Hz.

V, Watch or a mapped controller control raises the wrist computer. Checking it stows the scooter. Spear/Interact lower the watch and consume that press until released. The screen shows real air/depth/time, secured cargo, exposed-on-spear status, battery and the simulation's return-air estimate. Air/timer HUD default on; hiding them retains depth, cargo, condition and critical return alerts. Old calibrated controllers gain a watch click only if a known spare button is available; existing bindings/axes/triggers take priority.

Current-run evidence:
- 118 source/domain/input/geometry tests, typecheck/build, 8 package/inventory/hash checks.
- 75 broad Chromium campaign checks including all five sites, manual hunts/work/return, immutable recovery through reload, resource disposal and watch controls. 43 focused final scenery/new-site/mobile checks after grounding changes. 13 final watch/HUD/page checks including scooter and exposed-catch correctness.
- Existing 41 mouse/touch/save/fullscreen/High-reload browser regressions pass.
- 9 actual GPU shadow/framebuffer/receiver/quality-resource checks; 15 terrain/plant/coast checks across all five sites. Plant roots remain 35mm in rendered sand triangles.
- Blender 5.2 LTS inspection of original procedural fish/forearms; saved .blend and rendered inspection. Not external GLB rigs or an animated Blender export.
- Prepared player-facing game page: content tests, reproducibility and SEO checks; browser inspected. No owner approval or development-report wording in visible copy.

Only Windows Chromium and emulated portrait/landscape are current candidate evidence. Previous owner Android Chrome touch/USB Backbone/High feedback applies to v0.2; the new watch, sites and animations still need owner hardware/feel testing. Short GPU samples are not sustained thermal or phone performance evidence.

Playtest logbooks: choose a spare save slot, then import docs/test-logbooks/all-sites-playtest.json to open all areas, or recovered-reefs-playtest.json to see mature native populations. These are explicit test fixtures, not earned careers. Ordinary careers and exports remain compatible with schema 1.

Future release: promote the exact tested dist and merge only the Reef Sweep catalogue/copy/manifest records onto current remote authority. Do not deploy the complete old staged website snapshot or overwrite unrelated dirty files. Packaging an already tested build does not authorize production publication.

> Historical design/handoff note. Current behavior and validation are in FEATURE_STATUS.md, BALANCE_RATIONALE.md and REVIEW_VALIDATION.md.

# Reef Sweep — v0.2 unpublished owner preview

Prepared 13 October 2026 (Australia/Sydney). No commit, push, deployment or production upload was performed. All implementation and website preparation lives under the ignored `output/reef-sweep/` directory. The original website checkout and its unrelated changes are preserved.

## Play this build

- Website: http://localhost:8008/games/reef-sweep/
- Game: http://localhost:8008/games/reef-sweep/play/
- Phone on the same Wi-Fi: http://192.168.0.29:8008/games/reef-sweep/ (local address can change).

The preview server serves `site/` on port 8008. To restart it from this staging folder: `python -m http.server 8008 --bind 0.0.0.0 --directory site`.

## Implemented

Mouse movement now steers without holding a button when Codex's preview denies pointer lock. Hold Mouse 1 to draw, release to strike, and hold E to secure. Genuine pointer capture, uncaptured hover aiming and input cancellation have browser coverage. A separate render-loop repair preserves look and release edges until a simulation tick consumes them.

The reef has much more coral, current-driven rooted seaweed and ten native schools, including schools around an old outfall and shipwreck. Balanced quality renders 1,476 coral placements, 760 seaweed clumps (4,963 fronds) and 580 native fish. Whole-body obstacle clearance replaces decorative fish disappearing inside rocks; lionfish and animal clearance also use the authored obstacles. The expanded seabed has a deep trench, wreck and pipe collision proxies and two extra survey stations. A tested wreck view exceeds 35 game metres of depth. Breaching the surface shows sky, coastline and the boat. Tank use pauses above water and does not refill the tank.

Nine equipment lines have distinct icons and five ranks. Regulator ranks extend tank capacity and reduce consumption; other ranks improve speed, spear handling/reach, cargo, camera quality, restoration and battery endurance. An efficient economic fixture reaches most high/max ranks around outing 10 and all ranks by outing 15. It assumes all survey stations, efficient catches, 75% fillet quality and no rescues; it is not evidence of natural campaign pacing. Night dives require an installed head torch and Passage unlock. The upgradeable beam, moonlit water and warned reef shark are implemented. Toggling off or emptying the battery removes the actual rendered beam.

Lionfish spine contact removes both health and air, with a cooldown. Other injury also costs air. Optional filleting gives three timed cuts after a safe landing and a one-time quality bonus of up to 30% on sold catch. Skipping it preserves ordinary sale value. The completed-dive cooking disclaimer is removed.

Regulator inhalation and pulsed exhalation use original procedural audio through the Ambience volume control. A fixed pool of 24 transparent bubbles rises and drifts with the current on exhalation. Pause freezes the phase; surfacing stops new regulator breaths. Every third confirmed lionfish removal, starting with the first, gives a brief “BOOM! Clean strike” toast. Misses, rock/native-fish hits and contact injury do not trigger it. No creator voice recording or imitation is included.

The generated lionfish icon is supplied as local game icons and a website thumbnail, with source prompt/provenance. The staged generated landing page, Games catalogue, sitemap, source review and indexing audit are prepared. It is labelled In Development and is not featured. The play route is noindex. No external storefront or public release date is invented.

Save schema remains 1. Legacy owned-equipment IDs load as rank 1; new rank/night/fillet fields are validated and optional. Saves remain browser/origin-local. The custom Babylon 9.26.1 runtime and supplied Pocket Chordsmith v65/schema-16 composition are retained.

## Validation

- TypeScript compilation and 80 gameplay/input/environment/breathing tests pass; 7 build/standalone package tests pass.
- 31 gameplay/browser acceptance checks pass on the actual local HTTP route. 11 standalone/audio/PCS checks pass; the standalone issues no network requests and the composition roundtrips through the supplied editor.
- 26 expanded browser checks cover reef inventory, the actual GPU seaweed shader, breathing audio capture, bubbles, pause/surface timing, surface ascent, icons/purchases, night beam and empty battery, wreck depth, filleting, ordinary-origin persistence, quality rebuilds and landscape touch layout.
- 17 extra browser checks cover genuine capture, denied-capture hover/draw/aim, manual collection, cancellation, reload, production debug gating and no-JS/failed-fetch website rendering. Focused checks also verify the BOOM toast, visible bubbles and clearing a stale night selection on save import.
- Website content reproducibility, site/catalogue/SEO validation, indexing audit and content tests are checked in the staged snapshot. The overlay builder checks allowed paths, exact runtime hashes and byte-identical protected hosted releases.
- Original procedural wreck, pipe, seaweed and shark geometry was inspected/rendered with Blender 5.2 LTS; the saved inspection scene and receipt are private QA material. No runtime GLB conversion or external asset dependency was required.

The final browser reports/logs and screenshots are in `ready-v0.2-preview/qa/`. The regulator audio bus was captured to `breathing-preview.wav`; this confirms actual generated output, not a listening judgement. A short 150-frame Intel UHD / ANGLE D3D11 sample at 1280×800 is recorded in the browser JSON. It is a smoke sample, not a sustained frame-rate or phone benchmark. Rendering uses chunked geometry, thin-instanced schools/bubbles and reusable transformation objects. Quality levels preserve gameplay targets and hazards.

An early shader startup error from an unavailable Babylon Vector2 export was repaired using supported vector-like values. A concurrent software-rendered acceptance attempt timed out; final local-GPU suites passed. Those failed attempts are retained as historical logs rather than counted as successful evidence.

## Owner playtest and limits

Physical Android/iPhone, Safari, hardware controllers, sustained/thermal performance, extended audio listening and a complete natural campaign remain unverified. Creatures, equipment and world art are stylised procedural prototypes. This is ready for owner testing and balance feedback; publication remains withheld.

Try a fresh career without debug helpers: mouse aim, draw/release/secure, lionfish contact, surface view, chart and safe boarding. Listen to the breathing and try pause/resume and Ambience mute. On phone, test landscape movement + Draw drag + Interact, light toggle, interrupted touches, portrait pause and audio resume. Work toward regulator level 2 and a torch, then test a night dive, deeper stations, beam upgrades and battery exhaustion. Land catch, try three cuts or skip filleting, settle, reload and export/import. Judge upgrade pace across ordinary outings; the economic fixture does not replace that playtest.

## Packages and source authority

`ready-v0.2-preview/` contains the self-contained playable HTML, web ZIP, editable source handoff, scoped website overlay, review and hash manifest. It is separate from the earlier v0.1 preparation in `ready/`.

The website snapshot is based on origin/main `ae87438b991c2e398f52064b1adab7f18ea6120c`; the physical website checkout was on `main` at `2bc77f9` with pre-existing changes. Reconcile the overlay against then-current main before any later release. Protected existing game/app release copies are preserved byte for byte.

Original owner ZIP SHA-256: `14f46fb1a274cac10b64531b9f5f5c1f0672ec148f4fc675bdf54889d8c2bb34`. Attached design/handoff documents informed the review; their roadmap and commit/publication instructions were not treated as new user authorization. Source archives, inspection files, private QA and generation masters are not part of the public website overlay.

## Surface scenery correction — 13 October 2026

Owner feedback identified cloud-like blobs close to the water. These were prototype islands around 92–108 game metres from the bay centre, not clouds. Replaced the rounded ellipsoids with shore-connected terrain, sandy/rocky bands and uneven ridges. Island centres now sit 260–304 metres away; their nearest terrain is over 230 metres from the bay centre. Extended the cosmetic water surface/view range to cover the new horizon and adjusted coastal fog to preserve land colour and silhouette. Dive bounds and gameplay obstacles are unchanged.

The updated build passes 7 package checks and a focused Chromium render pass (day/side/night/underwater screenshots, real ascent and no shader/runtime errors). Broader v0.2 gameplay evidence above predates this cosmetic correction and is retained; physical-device acceptance remains outstanding. Current screenshots: reef-surface-islands.png, reef-surface-islands-side.png, reef-surface-islands-night.png and reef-underwater-coast-review.png.

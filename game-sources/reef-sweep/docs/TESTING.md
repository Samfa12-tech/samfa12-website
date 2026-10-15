# Testing the v0.4 review candidate

Current evidence and its limits are in REVIEW_VALIDATION.md. The old v0.1/v0.2/v0.3 receipts are historical; do not reuse their counts as current validation.

## Automated checks

From website root, run `npm run test:reef-sweep`, `npm --prefix game-sources/reef-sweep run test:package`, `npm run build:reef-sweep`, `npm run sync:reef-sweep` and `npm run verify:reef-sweep-pages`. Portal validation uses the established content/catalogue/site/SEO/indexing and integration commands. CI also builds on Linux and verifies staged source exclusions.

Focused tests cover old saves, in-flight legacy payouts, permanent work, shortfall offers, distinct survey stations, one-time settlement, event registration/selected-slot reload, renderer binding, terrain cache identity, current-site sharks, action lessons, fixed scooter voices, fillet persistence, recognition and shared disabled analytics.

Browser runners require Python Playwright and an installed Chrome/Chromium set in `CHROMIUM_BIN`. Serve the candidate dist on loopback, set `REEF_SWEEP_QA_URL` and optional `REEF_SWEEP_QA_OUT`, then run `python tests/browser-campaign-polish.py` or `python tests/browser-campaign-extra.py`. They use actual Babylon WebGL with explicitly controlled placement, accelerated simulation and progression fixtures. Reports cannot be interpreted as natural or physical-device playtesting. QA output is ignored. `?debug=1` enables local fixtures and disables telemetry.

For a paired performance check, set `REEF_SWEEP_BASELINE_URL` to an unchanged v0.3 dist and `REEF_SWEEP_QA_URL` to the candidate, then run `python tests/browser-campaign-perf.py`. The same High setting, 1280×800 view and camera are sampled three times per site. This is a short comparison, not a sustained FPS/thermal guarantee.

## Manual acceptance

Play a fresh career naturally through research, later sites and upgrades. Try a saved career, active and pending old Passage outings, save export/import, a rescued outing and cancelled interactions. Check the complete nighttime route with torch battery depleted. On physical Android Chrome, test portrait/landscape rotation, fullscreen, small touch controls and extended High play; also test iPhone/Safari if supported. Check the actual USB Backbone preset and saved custom calibration. Listen for motor/regulator mix and clean silence on tab switch, pause and dive end. Review new Passage route/landmarks and character/fillet pacing.

Analytics remains disabled until the shared deployment prerequisites are approved. Transport/consent/retry tests use mocks and produce no production totals.


## v0.5 expedition candidate

`npm test` currently covers 188 domain/input/render-contract cases. Run `npm run test:package` for the eight standalone/hash checks and `npm run test:expedition-balance` for production-price 15-outing kitchen and conservation fixtures. Completion in the balance fixture is injected; it is not human pacing evidence.

`tests/browser-expedition.py` covers 16 desktop/touch preparation, settlement, reload and responsive checks. `tests/browser-expedition-deep.py` covers 29 all-site chart, actual caught-mesh, tube transfer, mask, treatment, boat, frame sample and native multitouch checks. They use installed Windows Chrome and Python Playwright, loopback only, explicit debug placements and current saves. Evidence is under qa-output/expedition; selected review evidence is copied to docs/review-evidence/expedition. REEF_QA_QUICK runs only the deep interaction subset; its counts must not be reported as the full matrix.

The short 160-frame boat samples are desktop Chrome GPU observations, not sustained hardware or physical-phone certification. Android/iPhone are not attached. Editable fields, keyboard focus and real cancellation are tested without disabling normal document selection. High settings and legacy saves remain in the regression suite.

`npm run package:wavedash` prepares the pinned existing game package only; `npm run test:wavedash` checks it after preparation. Website source/build sync and portal content/SEO/catalogue/indexing/integration checks remain required. Parent review precedes publication under the owner's authorization.

## Parent review corrections

`tests/browser-review-corrections.py` swims the five authored revision-three routes using simulation controls, inspects three actual route views per site plus portrait charts, records keyboard-driven boat motion, and checks native touch boarding with a flooded mask and less than 2 bar. Route fixtures replenish air/condition to isolate spatial navigability; this is not survival/campaign pacing evidence. `REEF_QA_REUSE_ROUTES=1` retains prior terrain receipts and reruns only boat/touch (use only when terrain is unchanged).

`tests/browser-fun-review.py` covers all three complete workbenches at 568x320, 667x375, 740x320, 844x390 and portrait. It checks direct board manipulation/cancellation, actual timed recipe/fillet buttons and mixed-size allocation. A late-career fixture then exercises the first response harbour briefing, real keyboard-driven nearest buoy, field guide/chart, injector positioning/safety, look-away/spear interruption/reacquisition, safe boarding, debrief, separate bounty and reload. Career/target placement is controlled; action paths use normal UI. This is a representative design/interaction review, not a human campaign or physical-device study.

Evidence from corrections lives in docs/review-evidence/expedition/review and fun-review, including boat-driving.webm and the Blender asset render. Injector, boat water and short landscape workbenches were visually inspected. No claim of measured human enjoyment or physical Safari/Android testing is made.

`tests/browser-response-charts.py` checks all five active report cohorts in wide/portrait after final marker-safe packing. It initializes a late-career fixture; the five check receipt and ten actual chart captures are in review/.

## Portrait refinements (v0.5.0-preview.2)
189 automated cases include a new whole-barrel projection test at maximum 100-degree FOV, ordered raise/approach, cancellation and eased orientation regression. tests/browser-refinements.py checks four local Chrome views (1280x800, 390x844, 844x390, 320x568), native chart disclosure/assignment selection, real keyboard/touch boat steering, two actual struck meshes, cancelled collection, successful insertion, save/reload/resume, orientation and seagull lifecycle. Before/after captures and the exact report live in docs/review-evidence/refinements. Debug placements isolate buoy/catch/surface cases; this is not physical-phone evidence. The five owner Library JPEGs were resolved but could not be materialized because the current skill transfer helper was unavailable. They were not viewed; parent explicitly authorized independently reproduced written fixes.

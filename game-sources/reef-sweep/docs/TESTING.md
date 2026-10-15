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

`npm test` currently covers 182 domain/input/render-contract cases. Run `npm run test:package` for the eight standalone/hash checks and `npm run test:expedition-balance` for production-price 15-outing kitchen and conservation fixtures. Completion in the balance fixture is injected; it is not human pacing evidence.

`tests/browser-expedition.py` covers 16 desktop/touch preparation, settlement, reload and responsive checks. `tests/browser-expedition-deep.py` covers 29 all-site chart, actual caught-mesh, tube transfer, mask, treatment, boat, frame sample and native multitouch checks. They use installed Windows Chrome and Python Playwright, loopback only, explicit debug placements and current saves. Evidence is under qa-output/expedition; selected review evidence is copied to docs/review-evidence/expedition. REEF_QA_QUICK runs only the deep interaction subset; its counts must not be reported as the full matrix.

The short 160-frame boat samples are desktop Chrome GPU observations, not sustained hardware or physical-phone certification. Android/iPhone are not attached. Editable fields, keyboard focus and real cancellation are tested without disabling normal document selection. High settings and legacy saves remain in the regression suite.

`npm run package:wavedash` prepares the pinned existing game package only; `npm run test:wavedash` checks it after preparation. Website source/build sync and portal content/SEO/catalogue/indexing/integration checks remain required. Parent review precedes publication under the owner's authorization.

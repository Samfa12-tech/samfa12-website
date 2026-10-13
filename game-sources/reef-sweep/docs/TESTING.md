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

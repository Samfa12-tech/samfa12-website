# Historical source handoff material

The import retains original v0.1/v0.2/v0.3 design and handoff documents for provenance. `progression-model.json` describes the old survey-heavy economy and is not evidence for v0.4. Current economic fixtures run via `node scripts/progression-model.mjs` or npm test. Historical browser runners are retained but the current acceptance entrypoints are `tests/browser-campaign-polish.py`, `tests/browser-campaign-extra.py` and `tests/browser-campaign-perf.py`.

Before this update, the imported v0.3 authoring project rebuilt the public game.js byte for byte. The website's d5f5531 commit is the verified audit/public baseline. New source/runtime checks, not historical test totals, determine review readiness.

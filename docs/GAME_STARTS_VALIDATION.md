# Game start tracking review evidence

Local review branch: `codex/game-starts-local-review`, based on website
`origin/main` d5f5531. No production resources or credentials were touched.
No active game source or generated hosted release was changed. Marketplace
JSON/history and Briarhold request-estimate JSON are byte-unchanged in the patch.

## Passed local checks

- 24 focused game-start tests, using real disposable Node SQLite and mocked transport:
  disabled defaults, readiness gate, session/reload deduplication, consent refusal
  and revocation, in-flight cancellation, retry loss/backoff/four-attempt cap,
  browser storage failure, active/inactive sessions, exact endpoint restriction,
  concurrent duplicate requests, atomic rollback, UTC midnight, old receipt
  rejection, payload/origin/time validation, minute/day caps, missing dates,
  explicit coverage certification and sanitized aggregate shape.
- 7 headless Chromium checks, existing installed browser, loopback only: disabled,
  labelled fixture and failed-fetch Stats states; desktop and 390px layout; a real
  browser start delivered to the actual local HTTP handler/SQLite store; reload
  remaining one start; no receipt identifiers in aggregates; no JS page errors.
  All non-loopback requests were blocked. Screenshots and browser result JSON
  are under ignored `output/game-starts/`.
- Existing regression tests: analytics 6, marketplace 22, content 55, Briarhold
  request/download counters 39 and Pocket Audio handoff relay 4 (150 Node tests
  including the 24 focused tests, all passed).
- Content generation/check, catalogue, site, SEO, indexing audit check,
  JS syntax checks and `git diff --check` passed.
- The loopback-only exporter produced a labelled fixture under ignored output,
  without overwriting the shipped disabled public snapshot.

## Reproduce

`npm run test:game-starts` requires Node 22.13+ or 24, with builtin SQLite.
No new package dependency. Start `npm run dev:game-starts`, then run
`python tests/game-starts-browser.py` with an existing Python Playwright install
and `CHROMIUM_BIN` pointing to an existing headless Chromium executable.
The browser script makes no external requests and never loads either game.

## Remaining boundaries

The Cloudflare-native Durable Object RPC wrapper/migration/alarm has syntax
validation, not a native Wrangler/workerd runtime certification. SQL deduplication
and rollback were executed against real SQLite. No Wrangler download/install,
OAuth refresh, provider deployment or native production test was permitted here.
Native local Worker/DO verification is required before production setup approval.
Game-owned start/readiness hooks, release packaging and physical-device game
verification remain coordinated follow-up work, with transmission disabled.
Actual start history begins only at each game's approved activation timestamp.
No historical request counts were converted to starts. Edge abuse protection,
coverage reconciliation, production aggregate export and account cost review
remain explicit deployment prerequisites in GAME_STARTS.md.

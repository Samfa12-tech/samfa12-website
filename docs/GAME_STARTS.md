# Browser game starts — review implementation

Status: local review only. No Worker is deployed. Shipping client defaults and
Worker config both disable transmission. Public data is a `disabled` marker;
fixtures never become production player totals. No game release was changed.
Branch publication/draft PR is now approved; merge/deployment and resource creation remain held.

## Shared client contract v1

Copy/bundle `assets/game-starts-client.js` into each game's SOURCE release pipeline.
Import `createGameStartTracker`. Instantiate once with
`{gameId: 'briarhold' | 'reef-sweep', enabled: false, endpoint: ''}`.
After approved setup, endpoint must be same-origin `/api/game-starts/v1/start`.
HTTPS is required except explicit loopback local testing. No third-party endpoint.

Call `markReady()` after successful initialization. Call `start()` after a genuine
user New Game/Continue/Begin/Resume transition AND its first successful active-game
frame. Call `activity()` during active gameplay (adapter throttles storage writes).
Call `flush()` on deliberate retry; online events retry automatically. Call
`syncConsent()` after preference changes and `dispose()` when tearing down.
Returned statuses never affect gameplay. Do not await telemetry on a render path.

Never hook DOMContentLoaded, loading-overlay removal, menus, dock previews,
debrief/review screens, generic pause/resume, failed boot, or simulated test input.
Briarhold `environmentReady.finally()` is not a readiness-success signal.
New Run/Continue and the first successfully applied co-op world frame need a
common session gate. Reef Sweep `begin()`/`resume()` need the gate after successful
renderer setup and an active frame. Active owners coordinate these source hooks;
generated `dist` and hosted play copies remain untouched here.

Wire POST body (512-byte maximum; extra fields rejected):
`{schemaVersion:1, gameId, eventId:<random v4 UUID>, startedAt:<canonical UTC ISO>}`.
The same token/time is immutable across retries. Acknowledgement:
`{schemaVersion:1, gameId, status:'accepted'|'duplicate', day:'YYYY-MM-DD'}`.
429/capped, 503/disabled/unavailable and network failures are not acknowledgements.
Four transmission attempts maximum per event with backoff; events older than
24 hours expire. No unlimited background polling or unload beacons.

## Session, consent and privacy

One game per browser tab session, maintained across reload using sessionStorage.
It ends after 30 minutes without active-game updates. New runs during that session
do not count again; a new session can count on its next genuine start/continuation.
The game must update activity only while playing, never while paused or hidden.
Tabs, cleared storage, private modes, restored/duplicated tabs and storage failure
prevent perfect session identity. In-memory fallback never blocks play, but cannot
guarantee reload deduplication. These are consenting sessions, not unique people.

Only localStorage `samfa12:analytics-consent === 'granted'` permits transmission.
Unset/denied/storage failure sends nothing. Same-document preference changes use
`samfa12:analytics-consent` CustomEvent; other documents use the storage event.
Recheck consent before every send, cancel in-flight requests on revocation and
erase pending session records. A previously refused start is not retrospectively
sent after consent; a fresh browser session can be measured. An event already
accepted before revocation cannot be recalled from its anonymous aggregate.

Temporary random event tokens identify delivery only, never a person/device.
Server retains only a SHA-256 receipt hash/day/expiry for <=48 hours, then removes
it using an alarm and request-time pruning. Daily integer totals remain. No names,
saves, room codes, scores, IP/UA/referrer records, fingerprints, cookies, cross-site
IDs, recordings or per-player histories. Request credentials are omitted and
referrer suppressed. Cloudflare necessarily receives normal network metadata;
application logging is disabled and must not log event bodies or receipts.
48 hours is the logical expiry and scheduled cleanup target; provider/alarm outages
can delay physical deletion. Expired receipts are never exposed or reused as events.

## Aggregates and coverage

One SQLite Durable Object per GAME, with an atomic receipt insert + daily count
increment. Deduplication crosses midnight. Events retain their bounded original
UTC start day (client clock must be within five minutes forward / 24 hours back).
Rejected old retries cannot recreate counts after receipt expiry. Activation is
persisted once; change control must keep configured `TRACKING_STARTS` aligned.

Stats reads `data/game-start-stats.json` and treats unavailable/disabled explicitly.
Displays today's partial day, prior seven complete UTC dates and observed
cumulative since actual activation. Missing days never become zero. Collector
rows default to `unverified`; a deployment operator must reconcile collector
health/release coverage before explicitly marking a complete or known-gap day.
Do not infer complete coverage from a heartbeat or absence of errors. Consent,
offline/blocker/network losses mean even healthy coverage is an observed sample.
Partial activation day, outages and capped traffic remain incomplete. No old
Cloudflare requests or overlapping weekly snapshots become confirmed starts.

## Local review

Node 22.13+ / 24 supplies SQLite; no dependencies or software installs required.
`npm run test:game-starts` uses disposable SQLite and mocked transport.
`npm run dev:game-starts` serves 127.0.0.1:8029 with in-memory SQLite only. Never
bind it publicly. The local API is enabled explicitly inside this dev server;
the shipping client/config remain disabled. Fixture JSON resides under tests
and has `status:fixture`, which renders a prominent invented-data warning.
`npm run export:game-starts-local` reads only the loopback mock API, strips all
non-aggregate fields and writes an explicitly marked fixture under ignored
`output/game-starts/`. It cannot replace the public disabled marker or use a
production URL. Production export/publish wiring remains a deployment prerequisite.

## Production prerequisites — held for owner approval

1. Review code/contract and coordinate source adapters with both active game jobs.
2. Validate EXISTING deployment authorization separately; do not refresh credentials
   or create/broaden tokens as part of this review. Analytics token stays read-only.
3. Approve a dedicated Worker/SQLite DO migration and same-origin route. Review
   account plan, binding/namespace availability and current pricing/budget first.
4. Confirm production origin and immutable activation timestamps for each game.
   Enable the Worker and clients only after a controlled release verification.
5. Implement coverage reconciliation and aggregate export to the static data file.
   Public aggregate GET is available, contains no receipts and needs no API token.
   Export/publish scheduling and zero-day certification require operational review.
6. Configure edge abuse protection before rollout. Exact Origin and JSON guards
   are defense-in-depth, not authentication: forged clients can inflate counts.

Built-in caps: 120 new accepted events/minute and 10,000/day PER GAME. Duplicate
receipts do not consume budget. Caps mark the day `capped`, never complete.
They limit accepted storage growth, not all Worker invocations; a flood can still
cost money or starve genuine traffic. Edge rate limits/alerts/budgets and a kill
switch are required deployment decisions, not newly configured paid services.
No personal identifier is introduced for abuse detection. Public stats GET also
needs caching/edge rate limiting before exposure. No per-gameplay heartbeat API.

Cloudflare references: [SQLite transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/),
[alarms](https://developers.cloudflare.com/durable-objects/api/alarms/),
[pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

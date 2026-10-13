# Reef Sweep start integration

Transmission remains disabled: the shared contract at `b9284542196e29191ca7cbcbe81939b3dfcb8aed` is review-only, with no deployed receiver. Reef Sweep bundles the exact shared `assets/game-starts-client.js` into its canonical source build. Source provenance and SHA-256 are beside the copy. Configuration is `{gameId:'reef-sweep', enabled:false, endpoint:''}`. No provider, endpoint, resource, credential or Stats calculation was added.

After successful renderer setup, markReady is called. A campaign Begin or saved outing Resume arms one candidate; start is called only after its first successful, matching active world frame. Loading failure, preview, menu, receipt, pause/unpause and tutorial practice never arm it. Debug/simulated playtests cannot transmit. Activity updates occur only while active and visible, and are skipped entirely while activation is disabled. Calls are never awaited, and both synchronous and asynchronous failures are isolated from gameplay. Page teardown disposes listeners; persisted back/forward pages keep their adapter.

The shared client owns exact consent, reload deduplication, the 30-minute inactive session boundary, delivery-only random receipt tokens, immutable bounded retries and revocation. Future approved activation must use the shared same-origin route; gameplay contributes no personal/save/slot/score/device data. Its network request omits credentials and referrer. Stats aggregation and coverage certification remain the shared analytics task's responsibility.

Regression tests use mocked transport and clocks, including disabled/unset/denied/storage-failure paths, first-ready gating, reload/session boundaries, retry deduplication and revocation. Production transmission remains unverified and held. The user supplied the shared contract directly; no cross-task message or deployment is necessary to prepare this adapter.

Shared review implementation #27 subsequently landed on main as bdb3a45 and was merged into this review branch. The game copy is byte-exact with the shared main asset; all 24 shared backend/client fixture tests pass. Service activation remains held.

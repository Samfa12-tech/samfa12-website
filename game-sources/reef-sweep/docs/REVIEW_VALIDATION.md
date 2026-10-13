# v0.4 campaign review validation

Prepared on 14 October 2026, with no merge or publication. Shared analytics main commit bdb3a45 was merged into the review branch after it landed concurrently; its assets, Stats/privacy changes and disabled service configuration are preserved. The game client is byte-exact with its shared asset. Baseline game code is website commit `d5f5531ab8a262253370f4f3f9a5072292a06f3b` (v0.3.0-preview.1), freshly fetched before edits. The dirty primary website checkout was left intact; implementation used `codex/reef-sweep-campaign-polish` in a separate managed worktree. The retained authoring project reproduced the baseline public game.js exactly before changes, then became `game-sources/reef-sweep/`.

Candidate game.js SHA-256: `133a47a6dc95ff48a07c7f0238f189a645ed2f02efe020fd70c0c6041cf73162` (474239 bytes). All ten hosted files, including the manifest, match the canonical generated dist byte for byte. The engine, icons, original score and save schema remain pinned. Vendored Babylon source and engine retain their original whitespace/bytes; authored files pass the whitespace check.

## Confirmed defects and corrections

| Finding | Verification and correction |
| --- | --- |
| Suspended site-preview mismatch | Visibly reproduced baseline Gardens simulation against Passage renderer. Resume now rebinds both identities/camera; cross-site, same-site and reload browser regressions pass. |
| Impossible offers | Confirmed against remaining native fish/work IDs. Four-sale/two-job shortfalls are disabled with reasons at offer and launch; no completed reef work is regenerated. |
| Registration lost on reload | Visibly reproduced pre-launch event loss. Registration is day/slot-specific. Testing also found startup reopening slot 1; the selected slot now persists. |
| Wrong night-shark terrain | Confirmed omitted site argument. New spawn uses the selected site's floor; source regressions and five-site night checks pass. |
| Modal mouse-capture race | Found in browser play: pending capture could lock the arrival card. Capture is delayed past the card and inactive grants are released. |
| Skipped university invitation | Browser repeat check found acceptance could become inaccessible after dismissing it. Deliberate contact can reopen an unaccepted invitation; the initial reputation gate remains enforced. |
| Nested Replay / practice suspend | Repeated Replay now restores the real career before restarting; Suspend ends practice. Browser regression confirms exact career preservation. |
| Recognition/history edges | Same-day visits and rescues cannot satisfy later-day assignments. Safe pending settlement is recognized before reef history advances; bounded publication history retains new highlights. |
| Motor idle pulses | Frames without a simulation/control sample no longer reset held thrust. Fixed voice pool, fade/silence and response checks pass. |

## Design changes and balance

Research opens at reputation 8 after a short university approach and acceptance. Prior survey/research saves retain access. The first funded assignment pays $65 day/$72 night inclusive of station pay; repeat Monitoring is $38/$45. First/repeat stations pay $18/$6, bounded to three per outing. Legacy in-flight financial promises are honoured once. First safe sale has a one-time $20 welcome grant; ordinary contracts pay $45 catch, $40 cleanup, $45 restoration.

The scooter first purchase is $420 (previously $290), available on day3/reputation4. A new torch needs day4/reputation6 plus regulator2. Other first-rank prices remain; owned legacy gear stays usable. Later service uses cheaper multipliers and experience gates for ranks 3–5. With actual seeded values and an explicitly assumed 75% fillet quality, four-fish routes reach six of nine maxed items by outing 15; capacity-filled routes reach all nine by outing 10. These are economic fixtures, not an observed natural campaign. Four returning lionfish permit a repeat catch order while permanent cleanup/coral stay completed. A fully cleaned career can submit a new peaceful wildlife story for cleanup recognition. See BALANCE_RATIONALE.md for inputs, counterexamples and prices.

The update adds seven action-driven tutorial stages with Skip and isolated Replay, event themes/live score/settlement reasons, three audience recognition assignments without cash, full account/gear benefits, persisted character moments, optional graded filleting, a distinct western Passage route and flow gauges, and bounded warned overhead boat encounters on later sites. Large procedural ocean/co-op remain a separate sequel note. No paid assets, services, engine migration or online campaign systems were added.

## Passed checks

| Check | Evidence |
| --- | --- |
| TypeScript + domain/regression suite | 163/163 via `npm run test:reef-sweep`. |
| Package/embedding/local assets/hash inventory | 8/8 via `npm --prefix game-sources/reef-sweep run test:package`. |
| Full early campaign and five-site night loop | 93/93 controlled browser assertions; `review-evidence/browser.json`. |
| Boats, recognition, controller API, cancellation and disabled transport | 42/42; `review-evidence/extra-browser.json`. |
| Website desktop/phone and JavaScript-disabled content | 7 page checks, no runtime errors/overflow; `review-evidence/page-browser.json`. |
| Portal tests | Content 55, existing analytics 6, shared game-starts 24, marketplace 22, handoff relay 4 all pass. Catalogue/site/content/SEO and indexing checks pass; the baseline indexing finding remains unchanged. |
| Guarded export + public staging | Exact ten-file Reef runtime; authoring sources excluded. SEO/What Would Win/Briarhold staging verification pass. Protected unrelated release tree is Git-equivalent across 439 tracked files, accounting for Windows text filters; individual hosted release guards also pass. |

Browser fixtures use actual Babylon/WebGL, actual draw/secure/work/boarding rules with controlled placement and accelerated time, native keyboard events, CDP touch cancellation and a synthetic browser Gamepad API. Phone viewports are 320×600, 390×844 and 844×390. Screenshots were reviewed. These do not establish physical touch/controller feel, a human economy route or sustained performance.

## Matched High comparison

The final bundle was sampled beside unchanged v0.3: three 180-frame samples per site at High, 1280×800 and the same camera, on NVIDIA RTX 5050 Laptop/ANGLE D3D11. Gardens median frames were 7.6–7.7 ms for both builds; Passage was 7.6–7.7 ms baseline and 7.6 ms candidate. P95 was 8.2–8.6 ms baseline and 8.2–8.3 ms candidate. High retains 2048 sun/1024 torch depth maps and native density. Renderer counts and full samples are in `review-evidence/paired-performance.json`; this short result supports no material regression in those views, not a guaranteed FPS or phone thermal result.

## Shared analytics boundary

The exact shared client and contract at `b9284542196e29191ca7cbcbe81939b3dfcb8aed` are integrated, with `enabled:false` and an empty endpoint. Disabled activation also skips per-frame consent/storage work. Successful setup marks readiness; only genuine Begin/saved harbour Resume plus a successful matching active frame arms start. Menus, pause/unpause, practice, debug/simulated input and failed loading cannot submit. Ordinary long pauses remain excluded; the next genuine Begin/saved Resume can open the shared client's new inactive-session boundary.

Tests cover consent refusal/revocation, reload/inactivity dedupe, immutable bounded retries, endpoint restrictions, storage failure, adapter exceptions and disabled silence. The game supplies no personal/save/slot/device data. No receiver/provider/resource was deployed, and no production totals were collected. Stats aggregation and production activation remain the shared task's responsibility; see `ops/analytics/REEF_SWEEP_GAME_START.md` in the website root.

## Remaining manual checks

Play a fresh career naturally through research, later sites and major upgrades. Review Passage route/arrival and fillet/character timing. Verify the actual USB Backbone and saved calibration. On physical Android Chrome, check portrait/landscape, fullscreen, controls/watch and extended High play; iPhone/Safari remains unverified. Listen to the motor/regulator mix and silence after pause/background/end. Test a production-origin exported older active/pending save and night return with exhausted battery. Production analytics transport, physical acceptance and Linux CI release reproduction are separate release gates before activation/publication.

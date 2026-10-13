# Save schema and persistence contract

## Storage boundary

Schema: **1**. Prefix: `reef-sweep:v1:`. Three career slots use keys `reef-sweep:v1:1`, `:2`, `:3`. Each successful replacement first retains the old value at `<slot-key>:backup`. Shared settings use `reef-sweep:v1:settings`.

The adapter accepts a Storage implementation. A real browser normally uses localStorage; a denied constructor falls back to in-memory Storage and displays an explicit export warning. Write/quota failure also displays a warning. The game does not guarantee persistence merely because play continues.

Local-file origins, an HTTP preview, the deployed site and an itch iframe may have different storage contexts. **Export/import is the supported transfer mechanism**. A folder name or identical HTML does not make browser origins share saves.

## Profile

Persistent fields include schema/version, slot, game day, cash/debt/reputation/audience, total work counters, equipment IDs, optional equipment rank map, all five reef progress objects, bounded score records, publication-kind history, discovered creatures, tutorial progress, sponsor payout day, last report, and either an active or pending Run. Schema remains **1** for the v0.2 preview. Saves containing only an owned equipment ID remain valid and load that item at rank 1; `upgradeLevels` is optional and validated to the supported 0–5 range.

Reef progress contains removed target IDs, cleaned debris IDs, coral plot → planting day, visit count, survey count and last day. The terrain is recreated from site data rather than serializing thousands of vertices.

## Active Run snapshot

A suspended dive serializes its seed, site, day, time, diver position/velocity/orientation, air/condition/battery, cargo and exposed catch, fish state, work state, animal state, highlights, counters, fragments, cooldowns, selected contract/event state and previously seen moments. Finished pending runs may also carry a night-dive flag and one fillet quality score. These fields are optional for old schema-1 saves; fillet quality is valid only for a finished non-rescue run with landed catch.

Highlight images are bounded JPEG data URLs. They are local images, never remote URLs fetched from a save. The runtime stores no actual video stream. A maximum of eight image cards keeps the snapshot bounded, though browser quotas still vary.

## Lifecycle and transactional guarantees

An in-progress dive uses `Profile.active`. Completion moves the run to `Profile.pending`. Debrief allocates secured inventory and selects up to two publication cards. One validated settlement consumes pending state and advances the in-game day. A profile containing both active and pending is invalid.

Completed reef work persists even after rescue. Purchased equipment remains owned. A suspended, resumed or reloaded dive must not respawn collected work, heal the environment backwards or duplicate money. Catch that was exposed rather than secured is not landed.

The game pauses on focus loss, menus and focus loss; orientation changes alone keep play active. Suspending saves the active run and returns to harbour. Page lifecycle hooks attempt a save, but browser/process termination can occur without a guaranteed final event. Periodic save/export remains important; do not describe the implementation as crash-proof.

## Validation

`validateProfile` validates imported and loaded data before returning a structured clone. It checks supported schema/site/equipment IDs and rank ranges; finite bounded numbers; bounded arrays/text; vector positions; wildlife states; job kinds/progress; lifecycle consistency; night ownership; finished-run fillet quality; valid image MIME/data prefix; duplicate fish/job IDs; and potentially dangerous cooldown-map keys. Invalid input never replaces an existing good slot through the UI import flow.

This is defensive local-file handling, **not anti-cheat**. Client saves can be edited and the debug interface can alter scores. Future network submissions must be validated independently of client claims.

A corrupt primary save is ignored; a valid prior backup is tried. If neither parses and validates, the adapter returns a fresh profile and retains a warning. The source does not erase corrupted stored bytes automatically.

## Settings

Audio, graphics, sensitivity, field of view, camera options, target assist, draw mode, touch scale and keyboard bindings live outside career data. Selected numeric values are normalized/clamped on read. Settings schema is intentionally small but not a generalized untrusted-file format. Rebinding Escape or primary pointer actions is not supported in v0.2.

## Future migration rules

Never change a saved identifier because a display label changed. Renaming a site, fish habitat or restoration plot requires a documented migration. Add a pure migration function from the old shape to the new one; validate both boundaries; retain the untouched old JSON until the new version has successfully loaded and saved. Add fixtures for a fresh career, upgraded career, mid-hunt exposed catch, completed work, pending rescue and pending normal settlement.

A conventional build-tool migration must not change the save prefix. A renderer/GLB upgrade should not change any saved ecological or economic state. Treat a new origin as an explicit user-facing transfer even when the schema is identical.

## Required physical-browser tests

Check normal origin storage, private mode, denied storage, near-quota snapshots, reload mid-dive, reload debrief, import/export between devices and corrupted primary/valid backup. The authoring browser's injected Storage coverage does not substitute for these host/browser behaviours.


### Return-visit ecology (preview 0.3)
Schema 1 remains compatible. `productiveVisits` is optional in each reef, and `recoveryStage` optional in old runs. Only exact legacy two-reef saves receive three empty new reef records; incomplete new-format records are rejected. Old active runs exclude this outing's removals when capturing their recovery stage. Fresh productive counts advance once at finish, including rescued outings with ecological work. The snapshot never increases until the next outing. Empty dives count as visits but do not count as productive.


## v0.4 additions and compatibility

Schema stays 1. Optional campaign flags hold research invitations/funding, character moments and recognition assignments; prior survey/in-flight research saves receive continuing access. Event registration is stored per logbook/day. `reef-sweep:v1:selected-slot` remembers the current slot on reload. Optional run fields record lesson stages, individual fillet cuts, research eligibility/funding, event theme, contract feedback and one bounded boat encounter.

New runs use siteRevision 2. Old Passage runs without this revision rebuild their original world; previews and sand caches cannot replace its terrain. Legacy in-flight contracts, survey rates, sponsors and event tiers are paid under their saved release rules. New launches use revised rates. Existing money, gear/ranks and completed ecological work are not removed or repriced. Practice operates on a detached profile and never writes career storage.

Start measurement is separate from saves. The shared client is disabled; a future approved adapter uses its own consented tab-session storage and never transmits a save, slot or device identifier.

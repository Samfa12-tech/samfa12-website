# Pocket Audio v70 / v1i mirror candidate

Prepared from freshly fetched website main
`526a8a9c6498bd372c108de68ac61178be17185c`, preserving current editorial content,
Briarhold statistics, Reef Sweep, the separate Handoff route and other apps.
This supersedes the older v69/v1h mirror candidate for this update; it does not
publish or close that earlier review automatically.

Canonical app source is Pocket-Chordsmith
`a31ffae545e0d50b5024dd1be746b834d6f7bed3` (PR132, stacked on PR131/128). The
reviewed original head remains preserved. Both apps bundle Core 0.3.0, unchanged
save formats and the existing Campfire recipe. The corrected source includes
selected-passage comparison, reversible Apply/Undo, playable listening examples,
and independent-review fixes for stale status, section and history ownership.

The existing sync command now supports `--apps-only` and rewrites Core imports
to the bundled sibling paths. These small tooling changes were previously
reviewed in the older mirror candidate and are reapplied on current main.
Generated pages are refreshed with explicit source HTML overrides, not chosen
by modification time. Core source/dist and required Chordsmith helpers are copied
by that same command. Machine provenance is in
`ops/releases/pocket-audio-v70-v1i-source.json`.

Local validation includes the actual mirrored routes over HTTP on Chromium
desktop/touch emulation: no autoplay, nonzero generated bus PCM, Stop/release,
non-applicable examples, unchanged source, Core loading without failed local
requests or page errors. This does not establish physical phone, speaker,
Safari/iOS or human-listening acceptance. Initial validation correctly found
the indexing snapshot stale at v68; its only regenerated change is the v70 H1.
Earlier failed evidence is preserved separately.

This is a draft review candidate. Source corrections and this integration need
independent review and exact-head CI before promotion. Merging into website main
triggers the existing Pages deployment; it is a public release action. No merge
or deployment has occurred. Godot and DAW installer holds remain independent.

The earlier website PR34 snapshot `064a3e8d810e652966bc47f2d0132225ad087c63`
is preserved. This narrow refresh adds Chordsmith's capped-history correction:
39 genuine edits, Apply and same-chord no-op now retain the panel's own Undo
entry despite eviction of the oldest snapshot. All39 comparison checks passed
across desktop/touch Chromium and Firefox. Other app logic remains unchanged.

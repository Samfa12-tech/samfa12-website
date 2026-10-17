# Reef Sweep authoring and review workflow

`game-sources/reef-sweep/` is the canonical editable TypeScript project. It was recovered from the retained owner handoff and reproduced the public v0.3 game bundle byte for byte before this update. `games/reef-sweep/play/` is an exact generated release copy. Do not hand-edit it.

Use:

```sh
npm ci --prefix game-sources/reef-sweep
npm run test:reef-sweep
npm run build:reef-sweep
npm run sync:reef-sweep
npm run verify:reef-sweep-pages
```

The source build also generates ignored `game-sources/reef-sweep/Reef-Sweep.html`. TypeScript 5.8.3, local Babylon.js 9.26.1 custom closure, original icons and Pocket Chordsmith score remain pinned. Sync validates hashes and the complete ten-file runtime inventory before copying. Verification checks byte identity. Text inputs are normalized for deterministic Windows/Linux builds; the vendored engine is unchanged.

Source, tooling, test fixtures and evidence stay excluded from Pages. Changes require source regressions, actual browser/render checks and generated-artifact verification. High keeps the same resolution cap and shadows; compare matched settings rather than lower quality to claim performance.

Campaign v0.4 is the previous published baseline. The v0.5 expedition update has owner publication authorization after quality and parent candidate review. Existing website content/stats and protected hosted app/game copies must be preserved. Source changes and generated route files belong together in the review PR.

## Expedition release candidate (2026-10-15)

v0.5.0-preview.1 has the owner's publication authorization after quality review. The implementation and generated hosted route must travel together. Parent review is still required before merge/deploy or Wavedash publication. See game-sources/reef-sweep/docs/EXPEDITION_UPDATE.md for candidate evidence and scope. Do not duplicate the earlier v0.4 upload.

After review, use the canonical source build/sync/verify workflow above for Pages. npm --prefix game-sources/reef-sweep run package:wavedash prepares only release/wavedash with the pinned existing game ID and current commit. npm --prefix game-sources/reef-sweep run test:wavedash checks bytes, disabled analytics and startup readiness. Upload/publication remain explicit CLI operations; the preparation script never sends a build or publishes it. Official workflow: https://docs.wavedash.com/cli/commands .

Parent review corrections (v0.5 candidate): revision-three reef landforms preserve suspended old templates; natural mixed-direction boat water; flooded low-air home boarding; market-first fish allocation; separate treatment history; signposted optional field response with authored Blender crown-of-thorns; complete short-landscape 3D preparation/animated recipes. Detailed evidence and limits are in docs/EXPEDITION_UPDATE.md and docs/review-evidence/expedition within the canonical source. Publication remains held for parent review.

## Portrait refinement candidate (2026-10-15)
The v0.5.0-preview.1 expedition release is already published from main 3f104c1854d0704ec8985b8731053595cc75cf16 (PR31). v0.5.0-preview.2 is the follow-up requested by the owner: compact portrait boat navigation, rotating portrait catch tube, simplified harbour launch and above-water seagulls. See canonical docs/PORTRAIT_REFINEMENTS.md for fresh evidence. Parent candidate review precedes publication to the same website and existing Wavedash game; do not upload the older build again.

## Accepted preview.3 release (2026-10-17)

Sam authorized publishing the combined audio/crew/entry/lionfish update to samfa12.com and the existing Wavedash game, then tested and accepted the corrected driving camera. Frozen runtime candidate: 63d06883e6aae98146c092e8ea552859c359691e, version 0.5.0-preview.3, game.js SHA-256 6bc2e2a5a2fb4c922a782e5da75fe9cdaeab8e6e9cd577dc81f54e8e6a9b90db. Source typecheck, 201 tests, 8 package checks, the prior 76 combined browser assertions and 26 camera checks passed. Wavedash preparation adds only its boot-ready adapter and platform manifest/index changes; all eight shared non-index assets match the website. Physical-phone/thermal acceptance is not claimed. Preserve the Pocket DAW 0.6.59 and Godot 1.3.0 metadata from current main. Release receipt and live readback belong in the task evidence after actual publication; this authorization note alone is not proof of publication.

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

Campaign review v0.4 is an unpublished draft. Merge/publication requires separate user approval. Existing website content/stats and protected hosted app/game copies must be preserved. Source changes and generated route files belong together in the review PR.

## Expedition release candidate (2026-10-15)

v0.5.0-preview.1 has the owner's publication authorization after quality review. The implementation and generated hosted route must travel together. Parent review is still required before merge/deploy or Wavedash publication. See game-sources/reef-sweep/docs/EXPEDITION_UPDATE.md for candidate evidence and scope. Do not duplicate the earlier v0.4 upload.

After review, use the canonical source build/sync/verify workflow above for Pages. npm --prefix game-sources/reef-sweep run package:wavedash prepares only release/wavedash with the pinned existing game ID and current commit. npm --prefix game-sources/reef-sweep run test:wavedash checks bytes, disabled analytics and startup readiness. Upload/publication remain explicit CLI operations; the preparation script never sends a build or publishes it. Official workflow: https://docs.wavedash.com/cli/commands .

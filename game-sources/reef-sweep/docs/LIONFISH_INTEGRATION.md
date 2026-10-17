# Local lionfish anatomy / defensive display — 2026-10-17

Unpublished follow-up to boat/audio checkpoint `c37bb36127666f1c19f5d22d79ef0c886da46f13`.
The existing canonical checkout, engine and dependencies were reused. No local
modelling, new loader, paid service, source worktree, push or publication.

## Asset and rendering contract

Owned Library file `libfile_ffb0b99d627481918dbf1205f5395388`, version 0,
`reef-lionfish-defensive-remodel.zip`, 2,707,116 bytes, SHA-256
`15b11e0b6e03493dc72c67d35b6be95bccc7ae45636ad8eb2f97220edf1a93cc`.
The parent-authorized private Library download recovery was reused; identity
metadata remains beside the task-local ZIP. No public transfer was used.

Editable Blender and GLB, hinge definitions/GLSL, authoring scripts, README,
integration contract and supplied validation stay in `art/lionfish/`. Raw runtime
arrays are in `src/render/assets/lionfish-mesh.ts`; the duplicate JSON, studio
previews and movie stay in the original package/task material. Rebuilding the
asset scripts regenerates the JSON/TS contract before copying the runtime TS
and deformation string into `src/render/assets/`.

The cloud-authored model has 5,539 vertices / 8,125 triangles, 13 dorsal spines,
and tagged hinged fans, pelvic fins, dorsal spines and tail. This is 4.94 times
the previous triangle count. Geometry stays in authoring units; the world mesh
applies exactly `f.size * .65` once. Hinge pivots remain unscaled. Static model
geometry is uploaded once and shared by the scene's fish clones. The measured
24-fish fixture uses one GPU geometry instead of 24; the existing one draw per
fish and native-school instancing paths remain. No per-frame vertex rebuild or
upload, new skeleton loader, textures, species or gameplay attack was added.

`uv.x == 5` branches out of the old generic fin-weight code, because `uv.y` now
contains part tags. The supplied GLSL rotates positions AND normals around fixed
hinges, retaining ray lengths and mild tail motion. Colour and both custom
depth passes share `reefVertex`, including the same helper. Frustum bounds cover
flare and idle sway; these are visual culling bounds, not gameplay hitboxes.

Every fish owns renderer-local hysteresis/smoothing state: enter below 3.2m,
release above 4.4m; exponential rise/relax rates 4/s and 2/s. These are artistic
defaults. Update uses advancing game time, freezes while paused, resets for a
caught fish and clears on world disposal. No cosmetic state enters schema-1 saves.

The pinned engine's verified `onBeforeDrawObservable` fires after the selected
effect is bound and before its GL draw. Its callback sets the actual current
effect's `uLionfishDefense` for EVERY fish draw, bypassing shared-material cache
reuse. This applies to colour, sun and torch render passes. Captured mode 12
gets zero live defense and retains existing tube folding. The 3D preparation
bench also uses the remodeled calm geometry with its existing resting transform.

## Verification and limits

- Typecheck and all 198 tests passed, including independent flare/relax/dead-band
  state, finite/index-valid tagged geometry, scale conversion and mocked
  per-draw colour/depth rebinding. Build and 8 package/hash checks passed.
- `tests/browser-lionfish.py`: 22 checks passed in muted Windows Chrome
  155.0.8059.80, actual Babylon rendering, desktop and portrait touch emulation.
  Two fish at different distances were visible together. Actual GL uniform
  reads showed near values about .978 (colour) / .973 (sun depth), with both
  distant-fish values zero. This verifies the scalar reaches separate GPU draws.
- Pause freeze, dead-band latch, retreat/relax, unchanged health during visual
  warning, fixed geometry buffers, small/large scale conversion, the actual
  caught mesh and one successful tube collection passed. Tail time advances
  while vertex buffers remain fixed. No page or shader/console errors.
- The final combined build also passes the existing 22 crew/entry and 32 audio
  browser checks. Their controlled placement/visibility limits still apply.
- Short paired observations used the same High preset, 24 fish and viewports,
  two 90-frame windows after warmup. Both pre-remodel and candidate medians
  were about 6.1ms and p95 about 6.2ms at desktop and portrait. These are coarse
  RAF observations on the same desktop GPU, not GPU timestamp measurements,
  physical-mobile proof, a long-session study or certification of the larger
  triangle budget. Physical-phone/thermal acceptance remains pending.
- The initial browser fixture tried to click the pause button while desktop
  pointer lock redirected the click to the canvas. The fixture now uses normal
  Escape pause on desktop; its incomplete receipt is retained.

The simulation, damage, air loss/cooldown, target/strike ranges, contact radius,
AI movement, catch weights, values and saved fish sizes are unchanged. Defensive
fans are visual and do not create a new poisonous collision region.

Task-local evidence is under
`C:/Users/sam_s/Documents/Codex/2026-10-17/task-3/`: `lionfish-test.log`,
`lionfish-package.log`, `qa-lionfish/{baseline.json,browser.json,*.png}`,
`qa-entry-final-fish/` and `qa-audio-final-fish/`. The measured pre-remodel dist
is retained as `preserved-pre-fish-dist`; its game.js SHA-256 is
`0ec8722f4fb54466ac50d70f9adfc78005c7a8c62a74a88bf5a0e7c12c1c80e7`.
Desktop near/flare versus far/calm capture was visually inspected.

Remaining: owner acceptance of the in-game anatomy, flare and boat-entry shot,
human Reef Sweep listening and physical-device performance. This is a local
candidate at the existing preview.2 package version; assign a fresh version,
rebuild/sync/verify and review the exact candidate before an authorized release.

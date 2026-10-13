# Architecture — Reef Sweep v0.2 preview

## Technical decisions and deviations

The shipped game uses **Babylon.js 9.26.1, strict TypeScript and DOM UI**. The implementation does **not** use the Vite toolchain proposed at the design stage. A small checked-in CommonJS closure bundler produces an offline classic-script build and a single-file HTML. This avoided network-only build dependencies in the authoring environment and also allows direct local-file play. It is a packaging decision, not a replacement for Babylon.

The render baseline is **WebGL 2**. WebGPU, post-process stacks, physics middleware, imported models and backend services are not required. The game has a real Babylon Engine, Scene, FreeCamera, ShaderMaterials, VertexData meshes and thin instances. The runtime is an actual subset of the upstream engine; see `THIRD_PARTY_NOTICES.md` and `vendor/babylon/provenance.json`.

## Dependency / ownership map

```
DOM, pointer, keyboard, touch, gamepad
              │
        input.ts → action sample
              │
            main.ts ───────→ ui/ui.ts → DOM / chart
              │                  │
       game/simulation.ts        │ dispatch actions
          │          │           │
  Profile + Run    event queue ←─┘
          │          ├────────→ audio/audio.ts
          │          ├────────→ render/renderer.ts
   game/profile.ts   └────────→ capture / notifications / saves
          │
   Storage / JSON export
```

**Authoritative simulation is plain data.** No Babylon nodes, AudioNodes or DOM references enter a save. Renderer and UI consume the run rather than maintaining competing copies of the economy or ecology.

## File responsibilities

| File | Responsibility |
|---|---|
| `src/main.ts` | Startup, loop, scene lifecycle, dispatch, save hooks, pause boundaries, debugging |
| `src/game/types.ts` | Serializable contracts: Profile, Run, species/work records, settings, actions |
| `src/game/data.ts` | Authored sites, terrain/current functions, landmark data, upgrades, default controls |
| `src/game/math.ts` | Seeded random generation, vectors, segment/ray/ellipsoid helpers |
| `src/game/navigation.ts` | Obstacle-aware horizontal return-route estimate and fallback |
| `src/game/breathing.ts` | Simulation-timed inhale/exhale phases and bounded exhale-bubble pool |
| `src/game/simulation.ts` | Swimming, time, air, spear, interaction, wildlife, events, settlement |
| `src/game/profile.ts` | Fresh career, purchase constraints, strict import validation, Storage adapter |
| `src/input.ts` | Device-to-action mapping, pointer-lock fallback, touch ownership, rebinding |
| `src/render/geometry.ts` | Original procedural reef, fish, animal and equipment geometry |
| `src/render/shaders.ts` | Water/surface, caustics, depth tint, lighting, vertex movement |
| `src/render/renderer.ts` | Babylon ownership, scene rebuild, instance updates, camera, capture |
| `src/audio/pcs-voices.ts` | Instrument configurations adapted from the supplied Pocket Chordsmith |
| `src/audio/score.ts` | Generated typed copy of editable PCS JSON; do not hand-maintain both |
| `src/audio/audio.ts` | Adaptive scheduler, synthesis, ambience, action sounds |
| `src/ui/ui.ts` | Harbour, HUD, dialogs, debrief, charts and settings |

The current modules are intentionally modest. Splitting simulation into additional files is reasonable once a feature creates a natural boundary; replacing the entire architecture is not a prerequisite to continuing.

## World conventions

Game units are approximately metres, **Y up**, with Babylon's left-handed scene convention. Heading is computed consistently with the camera and planar movement. Creature geometry has an explicit local forward convention in its constructors; verify heading before replacing a model.

The terrain is an analytic height function sampled to a grid for rendering. Large rocks are authored ellipsoids. Their expanded collision volumes, the navigation obstacles and the visible rock positions share the same source data. Fine coral branches, sea-fan leaves and fish fins are decorative, not full rigid-body colliders. Planting plots, debris and targets have separate interaction proxies.

Each site has a fixed seed, fixed landmarks and a bounded radius. The v0.2 preview adds a deeper trench, wreck and outfall field stations inside those same two sites. Rebuilding a scene should not change the identity of an existing coral plot or cleared habitat. Small fish motion is procedural; lionfish and work persistence are explicit run/reef data.

## Simulation timing

`main.ts` accumulates frame time and performs fixed 1/60-second updates, bounded to five catch-up steps. Very long browser stalls do not burn an arbitrarily large reserve of air. Simulation updates clamp individual incoming steps. Pausing and suspended tabs do not advance the run or in-game calendar.

The renderer receives the current state. Camera, fish animation and decorative movement do not determine the cost of a dive. No economic transaction depends on frame rate.

## Lifecycle

The useful lifecycle is:

```
career / harbour
  → active Run
  → paused active Run (optional)
  → suspended active Run in save (optional)
  → finished Run stored as Profile.pending
  → one validated settlement
  → harbour, next game day
```

A profile cannot legally contain both `active` and `pending`. Work persists when it is completed. Returning or rescue finalizes the outing; settlement handles only landed inventory, rewards and costs. A fish left on the spear is not silently counted as secured cargo.

Closing the window during debrief should restore the pending debrief, not recreate its rewards. Upgrades cannot be bought while an active or pending run exists.

## Interaction and collision

The spear uses a bounded forward ray and ordered intersections with fish, native proxies and reef obstacles. A target is not valid through a nearer wall. Body proxies are intentionally a little forgiving; exact fin-by-fin piercing is not simulated.

Interaction is a hold action and the aim result establishes which action may progress. Moving away or changing focus cancels incomplete progress. Manual secure, debris, coral, survey and boarding use the same progress-feedback pathway. Surface/mooring proximity is checked independently of underwater navigation.

The collection capacity rule prevents a new strike when full. A recovery route remains available for a legacy/imported state with an exposed fish and a full tube; boarding forfeits the exposed fish rather than trapping the player.

## Navigation limitations

Return guidance uses a 23 × 23 grid with six-unit spacing, testing rocks at a selected swim height. It estimates a practical route and reserve, not decompression safety. Where necessary it uses a higher-water fallback. It is **not** a complete three-dimensional cave pathfinder.

No interior cave/wreck mission should be added until navigation supports its topology and exhaustively validates reachable exits. Test narrow gaps, overhangs and return-current predictions before extending the current two sites.

## Rendering / performance

Static reef chunks batch procedural geometry. Decorative schools use thin instances. Interactive fish and notable animals are separate meshes with bounded populations. The water shader supplies distance/depth colour, approximate moving caustics and local light; this is not optical ray tracing or a fluid simulation.

The foreground equipment renders separately for readability; near-rock lowering reduces clipping but is not a complete first-person contact/IK solution. A full-body rig is deliberately not part of this milestone.

Rebuilding disposes site meshes while retaining reusable materials. A repeated-rebuild test checks stable mesh counts. This is not proof against all GPU/heap leaks; run proper browser-memory and physical-device soak tests.

The native-fish rock-avoidance presentation currently hides decorative instances inside rock volumes. That avoids obvious swimming through stone but may produce visible popping. Replace it with improved steering or carefully validated routes before final release.

## Input and UI

The input layer owns physical-device state and delivers action values. Menu, pause, focus-loss and rotation boundaries clear dangerous held input. Pointer lock is optional: mouse movement over the active canvas looks without a button when capture is unavailable. First entry and re-entry establish a baseline to avoid camera jumps; HUD hover does not steer. Left-hold still draws with drag-to-aim; right-drag look and keyboard R draw also work. A touch draw button retains its own pointer while allowing drag aim. Mouse, touch and gamepad feed the same simulation actions.

Menus are DOM, while the chart is a lightweight 2D canvas. The ordinary HUD is sparse. Modals gate camera input and have keyboard focus handling. Some overlay complexity remains in `ui.ts`; keep future accessibility fixes in that shared layer rather than implementing separate phone menus.

## Build outputs and reproduction

`npm run build` validates/synchronizes the music JSON, type-checks/transpiles TS and emits `dist/` plus `Reef-Sweep.html`. `scripts/bundle.cjs` resolves the application's local import closure and creates a cycle-safe module cache. `scripts/vendor.cjs` rebuilds the pinned engine closure from the included source; no upstream access is needed.

The `dist/build-manifest.json` records distribution hashes. The single HTML inlines JavaScript and CSS and escapes closing-script strings. Neither output needs a runtime CDN.

A future migration to normal `@babylonjs/core` imports and Vite is welcome **as a separate change**, with visual, shader-registration, touch, save and packaging regression tests. Preserve relative paths and an offline deployable distribution. Do not add an account, network dependency or a backend to solve a local packaging problem.

## Debug surfaces

Debug hooks are available with `?debug=1`, `#debug` or an explicit test flag. `window.__REEF__` exposes simulation, profile, renderer and deterministic fixture utilities; `render_game_to_text()` provides a concise snapshot. These are testing tools, not an online anti-cheat system. The local client and saves are intentionally inspectable and editable.

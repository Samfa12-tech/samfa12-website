# Next Reef Sweep update: boat crew and water entry

Owner request received 2026-10-17; planned after the current audio correction.
This document records scope and source inspection. No animation implementation,
Blender render, new asset generation or public release happened in this task.

## Requested result

Show a pilot and the player diver aboard the boat while driving. When the player
chooses an unlocked dive area at its buoy, play a short Blender-authored gear
check and backward-roll entry, then enter the chosen level. Prefer a continuous
camera/water transition if practical; an intentional fade is explicitly allowed.
A repeat-dive Skip option is a design suggestion from the parent, not an owner
requirement. Consider reduced-motion behavior alongside that suggestion.

## Existing material and integration points

- `art/dive-skiff/lantern-dive-skiff.blend` and `.glb` are retained original
  sources/exports. The manifest records metres, +Y up, +Z bow, 6,774 triangles,
  one draw and no textures. Runtime geometry is baked in
  `src/render/assets/dive-skiff.ts`; use its existing export/bake procedure.
- `src/render/boat-travel.ts` creates the skiff mesh with no pilot or seated
  diver. Its shared swell sampling controls boat height/pitch/roll. Attach crew
  seat transforms to the boat so their motion remains coherent.
- The current first-person diver uses procedural foreground equipment/hands
  in `src/render/geometry.ts` and `src/render/renderer.ts`; no complete rigged
  player body or crew animation source was found in `art/`. Plan a reusable
  original body/rig compatible with the boat and existing gloves/equipment.
- `src/main.ts` dispatches `boat-dive` only at a slow, unlocked buoy, stores
  the selected site/contract and travelled distance, then calls `begin()`.
  `begin()` immediately removes boat state, creates the selected simulation and
  builds its dive scene. This is the insertion point for a bounded transition.
- `BoatTravelRenderer.render()` currently uses a chase camera 10.5 metres
  behind the boat. A proposed entry camera should blend from that actual pose
  to the seated diver, roll/water crossing, then the selected site's starting
  camera. Boat-water space and destination reef space differ; evaluate a hidden
  cut below the waterline before promising literal continuous world travel.

## Bounded implementation plan

1. Author pilot/seated-diver meshes, seat anchors and a modest reusable rig in
   Blender. Retain editable `.blend`, game-ready `.glb`, provenance manifest,
   clips and deterministic runtime export/bake tooling. Inspect the existing
   skiff stern, seat and motor clearances before animating.
2. Block a short gear check, hands securing mask/regulator and backward entry.
   Use a small original animated sequence; reuse current audio wherever useful.
3. Introduce an explicit boat-entry presentation state after validated buoy
   selection. Snapshot the chosen site/order/night/distance; suppress steering
   and repeated selection. Start the dive/save exactly once after entry, avoiding
   lost/duplicated outings if the tab hides or the sequence is interrupted.
4. Keep the music clock alive across boat/entry/dive. Stop the boat motor as its
   power ends; preserve mute/effects levels and pause/focus-loss behavior. Fit
   transition/splash sounds into existing SFX lifecycle rather than new contexts.
5. Try a waterline-hidden camera cut and colour match to the target reef. Fall
   back to a short intentional fade if world/camera continuity is brittle.
6. Verify all five destinations, locked/too-fast buoy rejection, selected
   assignments/night state, native touch/controller/keyboard, repeated presses,
   pause/tab loss/reload, saved dive resume and reduced motion. Capture desktop
   and portrait evidence and measure the added asset/draw/loading budget.

Coordinate heavy Blender/build/playback work around Godot timing runs. Reuse
dependencies and keep artifacts bounded. Public publishing/merge requires its
own authorization; this plan does not grant a release.

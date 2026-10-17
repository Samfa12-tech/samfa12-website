# Lionfish remodel: runtime integration contract

New authored asset, not a claim about the old model. No publication or game mechanics changes are included in this asset handoff.

## Geometry and single-mesh path
`lionfish-mesh.ts` exports ordinary position/normal/RGBA/UV/index arrays compatible with the existing Geometry class. Copy arrays into a new Geometry only once, then share/cache that mesh data across fish. No per-frame geometry reconstruction and no GLB/skeleton loader are needed. Coordinate system is metres, Y up, nose +Z. Positions are ALREADY in the calm hinge pose. These authoring arrays are NOT pre-scaled by the old 0.65 factor. For comparable game size, set the lionfish mesh instance scale to `f.size * 0.65` (once). Keep hinge coordinates in authoring units and let the world matrix scale the whole result. Do NOT scale only positions without also scaling pivots. Review target-size/collision envelope visually without altering damage rules.

UV.x remains creature-family 5. UV.y is now a part tag, NOT a generic fin weight:
- 0 body, eyes, jaw, cirri and three fixed anal spines
- 1/2 left/right pectoral
- 3/4 left/right pelvic
- 5 tail
- 6 posterior soft dorsal
- 7 soft anal
- 10 through 22 the thirteen dorsal spines

Branch lionfish OUT of the original generic `p.y += sin(...)*uv.y*.26` code. Otherwise tags become huge displacement amplitudes. Use `deformLionfish(p,n,uv.y,perFishDefense,uTime)` instead. The supplied helper preserves rigid hinge/ray lengths, rotates normals and contains its own mild body-tail sway. Do not additionally apply the old lionfish deformation. Apply identical deformation to colour and shadow vertex passes. Captured/secured fish should use their existing mode that disables live swimming, with defense reset/decayed as appropriate.

## Per-fish defense, NOT a shared global uniform
The deformation helper takes defense as an argument and defines no global uniform. Every fish owns its own renderer-local `{active,value}` state keyed by its stable fish ID. Update only while gameplay advances. Clear stale entries when fish disappear/site changes. Never add transient render state to save data.

For the current individual fish mesh draws: a shared material is acceptable only if the scalar is rebound for EVERY mesh draw (including shadows), from that mesh's defense state, through the renderer's verified per-draw binding callback. A single update of a shared material uniform while iterating fish is WRONG: the final fish's value would affect all fish.

For instancing/thin-instancing: add a single float `aLionfishDefense` per instance, with divisor 1, and feed it directly to the helper. Update the one-float-per-fish instance buffer, not all vertices. Bind a zero fallback for non-lionfish draws. All instances share the static geometry and shader. Match the same attribute in shadow passes. If the renderer supports hardware instancing only via its existing world-matrix buffers, add the scalar through its normal instance-buffer interface rather than corrupting a matrix component.

Alternative for an existing renderer already binding per-object data is a distinct per-draw scalar in that established data block; no unique material or geometry copy is necessary. Choose the route the actual renderer supports and TEST two fish at different distances simultaneously.

## Proximity response
`lionfish-defense.ts` supplies a pure tested state updater. Default entry <3.2m, release >4.4m creates hysteresis; exponential rise rate 4/s and relaxation 2/s avoid popping. Values are artist-tuning defaults, not measured biology. Defense stays active through the dead band. Time is game dt, not wall time. The demo movie uses a smooth approach/withdrawal scalar without depicting a diver.

This is a visual warning only. Preserve current harm radius, air/health loss, cooldown, capture behavior and AI movement. Do not make pectoral fans newly poisonous: the long dorsal/pelvic/anal spines are venomous; broad pectoral fans are display/locomotion surfaces. No new attack, projectile, reach extension or damage change.

## Verification needed in game
- Two fish: near fish flares, distant fish remains relaxed (no shared uniform bug).
- Moving within 3.2–4.4m dead band does not chatter; retreat relaxes smoothly.
- Pause/focus loss freezes timing, resume is smooth, reload/site change clears cosmetic states.
- Colour/shadow silhouette agree; all instance paths use matching part tags.
- Capture/transfer modes do not leave defensive rays clipping tube or camera; existing authored transfer behavior remains.
- Existing saved games load without schema changes. Typecheck/build/tests and real browser/mobile profiling remain integration work.

The Blender/GLB demonstrate true part rotations. The runtime merged mesh uses the same hinges. The GLB contains editable named mesh parts, not a skeleton or heavy vertex-animation cache.

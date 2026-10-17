# Reef Sweep boat crew / backward-roll entry

Cloud-authored with Blender 4.3.2. Source reference: Samfa12-tech/samfa12-website at ed337e47ae7a9a4c50ede668ce3b2b15daac1aa2. Original crew; exact existing skiff reconstructed from its checked-in author script. No external generation, paid services, textures, or new dependencies.

## Deliverables
- `art/boat-entry/reef-crew-entry.blend`: editable reference skiff, named crew parts, keyed actions, studio camera. Start frame 1, end 87, 24 fps.
- `art/boat-entry/reef-crew-entry.glb`: crew only; one `BoatEntry` animation, 3.5833 seconds. The skiff is not duplicated in this export.
- `src/render/assets/boat-entry.ts`: runtime-ready raw geometry and sampled matrices, no GLB loader needed. JSON equivalent alongside assets.
- `scripts/author-boat-entry.py` and neighbouring original boat script: deterministic rebuild. Run `blender -b --python scripts/author-boat-entry.py` from any cwd.
- Four preview PNGs, compact labelled MP4, manifest, validation, whole-boat clearance check and SHA256 evidence.

## Lightweight runtime integration
`boatEntry.parts` contains name, actor (`pilot` / `diver`), and geometry arrays identical in shape to dive-skiff.ts: positions, normals, colors, uvs, indices. Geometry is PART-LOCAL. All are opaque, untextured vertex colours.

`boatEntry.frames` contains seconds and one 4x4 matrix per part. Matrices are column-major, runtime axes +Y up/+Z bow, and already include every Blender parent transform. Apply each directly under the existing boat transform. Do NOT also apply the original part transform or mirror Z. Geometry winding was reversed when swapping Y/Z to preserve outward normals. Verify culling with the actual renderer.

Driving idle is frame index 0: both people seated. Keep pilot visible throughout; hide diver after entry. Optional runtime breathing is not needed. Clip sample interval is 1/12 s; interpolate decomposed translation/quaternion/scale (quaternion slerp), not raw matrix elements. Alternatively batch transformed vertices into one dynamic crew draw to avoid 52 individual draw calls; the entire crew is only 3,216 triangles. Pilot can be statically batched separately. Geometry/animation data is about 1.3 MB uncompressed.

Timing: gear check begins 0.375 s; port scoot begins around 1.375 s; roll starts 1.875 s; nominal water contact 2.65 s; fully submerged/end 3.5833 s. Boat origin is unchanged, using existing runtime ocean height +0.20. Diver moves port (-X), no steering/nav displacement. Runtime splash should be centred approximately boat-local (-2.0, -0.20, -2.1) at contact, transformed by boat heading. Existing water is responsible for depth clipping, spray/bubbles and occlusion. Studio previews intentionally omit water.

On area selection, retain the exact site/contract/distance payload and block duplicate input. Play clip before beginning the level; a camera push under the surface + brief colour/fog blend offers a seamless-feeling transition. Fade fallback and reduced-motion skip should still invoke the same begin path exactly once. No changes to gameplay state are made in this asset package.

Suggested camera: lower port stern angle aimed at the aft diver, then follow the roll. Elevated overhead views naturally obscure the helm pilot behind the existing bimini; avoid altering or removing the source boat canopy merely for this asset. Check all normal driving camera angles in runtime.

## Validation boundary
GLB header/chunk integrity, animation presence, finite geometry and matrix data, array cardinality, and all index ranges checked. Four Blender previews reviewed. Triangle-BVH intersections between every diver mesh and every reference boat mesh checked at every authored frame: zero contacts after improving shin clearance and adding a leg tuck before scooting. Actual GPU import/culling, interpolation, ocean occlusion, performance, selected-site preservation and final transition remain integration checks. No game repository commits or releases performed by this asset worker.

## Canonical integration note

The runtime uses the TS bake in src/render/assets/boat-entry.ts; its duplicate JSON and studio PNG/MP4 previews remain in the original private Library package and task evidence rather than being copied into this source tree. The editable blend, crew GLB, authoring script, manifest and validation/clearance receipts are retained here. See docs/BOAT_ENTRY_INTEGRATION.md for the actual runtime implementation and testing boundary.

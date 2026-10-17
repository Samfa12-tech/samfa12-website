# Reef Sweep: recognisable lionfish and defensive display

New original low-poly remodel, created in cloud Blender 4.3.2 in response to the requested more lionfish-like body and proximity-triggered defenses. This is an asset and integration handoff, NOT a published game update. Engine hookup and browser/mobile tests remain pending.

## Included
- `lionfish-defensive-remodel.blend`: editable named parts and 8-second calm/flare/relax demo; play frames 1–193 at 24fps.
- `lionfish-defensive-remodel.glb`: same animated model, one combined animation clip, no skeleton or vertex-animation cache.
- `lionfish-calm-flare-preview.mp4`: 8-second preview, 720×576 at 12fps. Labels indicate the demonstration scalar, not a real diver in the scene.
- `calm.png`, `defensive.png`: pose stills.
- `lionfish-mesh.ts` / `lionfish-geometry.json`: static merged runtime arrays.
- `lionfish-parts.json` / `lionfish-deformation.glsl`: exact hinge definitions and efficient deformation helper.
- `lionfish-defense.ts`: independent per-fish proximity hysteresis/smoothing.
- `INTEGRATION.md`: required tag, per-instance/per-draw, scale, shadow and save-compatibility details.
- Authoring, preview, clip-merging and validation scripts; test results in `validation.json`.

## Anatomy and art decisions
The old 1,644-triangle fish was a rounded striped body with simple radiating fans. The remodel has a deep chest and tapered peduncle, narrower fleshy mouth, lateral eyes, cheek/gill detailing, supraorbital and mandibular cirri, striped maroon/ivory body, spotted soft/caudal fins, broad pectoral fans with separated ray tips, thirteen long dorsal spines, paired pelvic fins and three anal spines.

Visual anatomy reference inspected: Belize Lionfish Project's labelled morphology illustration, https://www.belizelionfish.org/morphology.html. The reference image is NOT bundled as a game asset. Factual cross-check: NOAA, https://oceanservice.noaa.gov/facts/lionfish-facts.html. Venomous spine counts also checked against the primary morphology study, https://doi.org/10.1242/jeb.197905. Pectoral fans are not treated as poisonous. This is a game stylisation, not a scientific reconstruction or photorealistic animal.

The defensive demo rotates existing spines upright and spreads fans from hinges. Rays do not grow. Retreat returns smoothly to the calm pose. Runtime distances (3.2m enter/4.4m leave) are tunable game design values, not a biological claim. No attacks, collision/harm radius or damage rules have been changed.

## Budget and limits
Final merged mesh: 5,539 vertices, 8,125 triangles, approximately 4.94× the original triangle count (original: 1,279 vertices, 1,644 triangles). One static vertex-colour mesh/draw per fish, shareable/instanceable, no texture downloads. The GLB uses named parts for editing; runtime does not need 21 separate draws. Profile on the actual mobile game before calling the performance budget passed.

Authoring length is about 1.77 units. Apply `f.size * 0.65` once at the fish world transform for a comparable game footprint; leave shader hinge coordinates in authoring units. Existing collision rules are unchanged and require in-game visual review. The GLB/Blender are in authoring units, not pre-scaled again.

GLB reimport and rotating part animation, thirteen spines, finite/index-valid geometry, constant hinge-radius checks and independent proximity-state tests passed. Browser integration, shadow parity, instanced rendering, collection/capture and mobile profiling were NOT RUN here.

## Reproduce
Run Blender with `build_remodel.py`, then Python `make_contract.py` and `merge_glb_clip.py`; run Blender with `render_preview.py`. Encode frames/%03d.png at 12fps with ffmpeg. Run `node --experimental-strip-types test-defense.mjs` and Blender with `validate_remodel.py`. The merged GLB clip step joins the exporter-generated part channels into a single playable clip without changing animation values.

No paid generation, laptop execution, repository write, deployment or publication occurred.

## Canonical game integration

The runtime consumes src/render/assets/lionfish-mesh.ts and lionfish-deformation.ts, with renderer-local lionfish-defense.ts. Duplicate geometry JSON and studio previews remain in the original Library ZIP/task evidence. The Blender authoring script regenerates its JSON inputs beside itself; then run make_contract.py and copy the generated TS/GLSL contract into the runtime asset modules. See docs/LIONFISH_INTEGRATION.md for actual GPU, scale, save and performance evidence.

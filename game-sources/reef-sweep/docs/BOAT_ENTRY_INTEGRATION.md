# Local boat crew / entry integration — 2026-10-17

Unpublished candidate following the audio fix. The existing source checkout and
dependencies were reused. No local Blender run, new worktree, project copy,
asset generation, push, merge or public publication occurred.

## Source and runtime

The owned cloud-authored `reef-boat-entry-final.zip` was recovered from Library
file `libfile_889ebbda579481918d23e967d0596ce8`, version 0, 3,833,432 bytes,
SHA-256 `b367269fecc16de047be79ee40a9f459145cc904ba4654ba6eda0c7b3b99b9a7`.
The standard helper downloaded bytes but failed on Windows `os.setxattr`; its
temporary file was removed. Parent explicitly authorized a bounded direct
Library transfer recovery. Identity/version metadata is retained beside the
download in the task's private `crew-package` folder; no metadata-helper success
or public upload is claimed.

`art/boat-entry/` retains the editable original `.blend`, crew-only animated
`.glb`, source README, manifest and supplied clearance/validation evidence.
`scripts/author-boat-entry.py` reproduces the asset using the existing original
boat script, which was preserved unchanged. The cloud reference differs from
that boat script only by a trailing blank line. No blend1, logs or temporary
render frames were admitted into the game project.

The current offline Geometry runtime reads `src/render/assets/boat-entry.ts`.
Its 52 parts / 3,216 triangles and 44 samples are rendered as two crew draws:
static pilot and dynamic diver. Transform interpolation uses translation/scale
lerp and quaternion slerp; normals use inverse transpose. The existing skiff is
not duplicated and no skeletal/GLB loader was introduced. Both crew members
are visible from the lowered port-quarter driving camera.

Choosing a slow unlocked buoy snapshots the exact site, assignment, night flag
and travelled distance into a presentation-only `BoatEntrySequence`. Steering
and duplicate entry are blocked while the 3.583-second gear check, tuck, scoot
and backward roll play. A pooled contact splash and existing filtered-noise
synthesis mark water contact, followed by a short water-colour fade into the
chosen reef. This is an intentional fade/camera transition, not continuous
travel between separate world spaces.

The same once-only completion path handles normal end, the optional Skip entry
button and reduced-motion immediate entry. Pause/focus loss freezes the clip;
resume continues it. No dive exists in the save before completion. Reloading
during entry returns to the harbour without a partial outing. Existing dive
save semantics, collision, economy and schema remain unchanged. The fade clears
held input so a menu/cutscene action cannot spill into a spear strike.

## Verification

Final local source regression run: 195/195 tests. Build and 8/8 package checks
passed. `tests/browser-boat-entry.py` passed 22 checks in muted Windows Chrome
155.0.8059.80 with actual Babylon rendering, desktop and portrait native touch
input, all five destination/skip payloads, a night dive, full entry, pause,
duplicate presses, reload interruption and reduced motion. Desktop/portrait
driving, gear check, roll, contact and dive screenshots were captured; driving,
portrait gear check and water contact were visually inspected.

The first browser run caught use of a VertexBuffer namespace constant absent
from the trimmed engine. It was corrected to the renderer's existing string
buffer keys. A later fixture needed to initialize optional legacy upgradeLevels
before its night-dive case; all completed desktop/portrait full-entry checks
had already passed. These failures do not change acceptance thresholds.

The audio regression is rerun against this combined candidate; its final
receipt remains separate from the earlier audio-only evidence. An initial
zero-RMS sample is retained. The test now waits for real AudioContext time
to pass 0.5 seconds and four musical steps before taking its first sample;
nonzero/silence thresholds are unchanged.

Task-local evidence:
`C:/Users/sam_s/Documents/Codex/2026-10-17/task-3/entry-test-final.log`,
`entry-package-final.log`, `qa-boat-entry/`, `qa-audio-with-entry/`.
The audio-only generated build and first entry build were retained separately.

The supplied cloud clearance evidence reports zero diver/whole-boat triangle
intersections over 87 authored frames. That source check was not rerun in
Blender locally and is not a claim of exhaustive GPU/interpolated collision
certification. Physical phones, controller-only use, long-session performance,
human audio mix and owner acceptance of the final runtime shot remain pending.

Lionfish anatomical/defensive-flare work is awaiting the separate cloud package.
No fish-rendering or damage/size-rule change is part of this checkpoint.

# Briarhold Credits

## Design and development

Briarhold was created by Samfa and builds on the crowd-rendering, breach-pressure,
and defensive-combat foundations developed for *The Last Guard*.

## Original art and characters

The title art and Briarbound T-pose concept were created for Briarhold with
OpenAI image generation. The Briarbound was then built as a textured PBR model
with Meshy 6, rigged with Meshy, and rendered from its real running animation
into an eight-direction sprite atlas. Every visible attacker remains an
individually animated, individually hittable game sprite.

Meshy task IDs and generation settings are recorded in
`assets/meshy/provenance/briarbound-meshy.json`. The production character used
35 Meshy credits in total: 30 for image-to-3D and 5 for rigging, including the
walk and run animations.

The playable Briarhold Warden concept was created with OpenAI image generation
against the approved visual target, built and rigged with Meshy 6, then prepared
in Blender 5.2 as a one-material 1K PBR remote-player GLB with planted idle,
walk, run and attachment sockets. The accepted generation and rig used 35
Meshy credits; one rejected horned text preview used 20 more and is retained
only as provenance. Exact prompts, task IDs, source/runtime hashes and the
reproducible preparation script are recorded in
`assets/meshy/provenance/briarhold-warden-meshy.json`.

The first-person Arbalest, Sunfire, and Runebolt presentation images were
created with OpenAI image generation against Briarhold's unified visual target,
then locally chroma-keyed and optimized as alpha WebP runtime assets. Their
source identifiers and prompt summaries are recorded in
`assets/viewmodels/provenance.json`; they are designed to be replaced by the
approved Meshy weapon-viewmodel batch without changing the gameplay contract.

## Illustrated portraits and progression art

Alpha.97's five illustrated holdfolk portraits and 48 boon/upgrade emblems
were created with OpenAI image generation using the existing Briarhold
characters and manuscript palette as references. Compact WebP derivatives
ship in `assets/ui/`; source images and prompts are retained in
`assets/art/alpha97/provenance.json`. Existing 3D assets were reused; this
update spent no additional Meshy credits.

## Music and sound

The adaptive dark-folk score, *The Green Remembers*, was authored for Briarhold
with the Pocket Chordsmith schema and is performed at runtime through the
Pocket Audio Core 0.2.0 contract. Combat, fortification, breach, overheat, dawn,
and result cues are synthesized in the same bounded audio graph.

Pocket Chordsmith and Pocket Audio Core are Samfa projects used here as
first-party production tools and runtime technology.

Seven original sound-effect recordings by **FilmCow** provide the first
sample-backed footsteps, Arbalest mechanism and release, bolt impact, gate
break, and menu interaction layers. The supplied bank was authorised for this
project by the project owner. Exact sources and derivative hashes are recorded
in `assets/audio/filmcow/provenance.json`.

## Poly Haven materials

- Castle Brick 01 — Rob Tuytel
- Forest Ground 01 — Rob Tuytel
- Wooden Planks — Charlotte Baglioni and Dario Barresi

The source materials are dedicated to the public domain under CC0 1.0.
Briarhold ships locally authored 1K WebP runtime derivatives.

## Technology

Briarhold uses Babylon.js 9.16.1. Its copyright and license notice are preserved
in `vendor/babylon/LICENSE-BABYLONJS-9.16.1.md` and summarized in
`THIRD_PARTY_NOTICES.md`.

# Third-party notices and provenance

## Babylon.js 9.26.1

Copyright Microsoft Corporation and Babylon.js contributors. Licensed under the **Apache License, Version 2.0**. The full license is in `LICENSE-BABYLON.txt`, in the hosted build, and embedded in the standalone HTML.

Official upstream: https://github.com/BabylonJS/Babylon.js

### How this copy was obtained

The build environment could not download packages or use ordinary container internet access. A read-only connected GitHub download retrieved the **dist** CI artifact from `RaananW/babylonjs-webpack-es6`, an upstream developer’s public Babylon example repository:

- Commit: `f4bd75f6bc11a77b55b74b9e011e1f395fa9d4fa`
- Workflow run: `38030515343`
- Artifact: `11661344454`
- Downloaded archive SHA-256: `8bba82420f1d86ee43ce6c069cba50b6e23a64f4aaca2ab50c6a2632aa9387aa`

Its source maps contained original Babylon `dev/core/src` TypeScript in `sourcesContent`. Only the needed Babylon dependency closure was selected. No example application code, environment maps, models, textures, music, WASM binaries or other sample assets are included in Reef Sweep.

Four const-enum definitions omitted by upstream inlining were checked against the **official Babylon.js 9.26.1 tag**: `ShaderLanguage`, `MaterialPluginEvent`, `SerializedFieldType`, and `NativeTraceLevel`. Missing declaration-only modules are empty runtime stubs. Module registration wrappers and the small export entrypoint were generated specifically for the custom closure. The vendor script transpiles, rather than type-checks, this upstream runtime closure; the game’s own source is separately type-checked strictly.

`vendor/babylon/provenance.json` records included files and hashes. `vendor/babylon/src/` contains the selected source. `scripts/vendor.cjs` rebuilds `public/babylon.js`. This is a **custom source bundle**, not a claim that an untouched official npm release archive was downloaded.

A future normal development environment should consider a separate, tested migration to the standard pinned `@babylonjs/core` package. Do not mix that build migration with a visual overhaul.

## Pocket Chordsmith

`reference/Pocket-Chordsmith-v65.html` is the original file supplied by the project owner. Two instrument configuration functions are adapted into `src/audio/pcs-voices.ts`. The adaptive scheduler, bounded voice management, underwater ambience and the original “Room for Life” composition were created for this game.

No third-party recordings are used. No font files are distributed. Game and documentation typography uses installed system fonts.

## Inspiration credits

Lionfish Extermination Corp and Dave the Diver are credited as inspirations only. No ownership of their names or materials is asserted, and no endorsement, affiliation or collaboration is implied. No footage, logos, narration, commercial game artwork or music from either is used.

## Original project materials

Reef Sweep's original game code, art, models, score and documentation are reserved original project materials, except where a separate licence applies, and only to the extent that the relevant rights are owned by Sam Small (Samfa12). Public source visibility is not a blanket open-source licence.

You may play the officially published game as intended, including the technical copies needed for that use. This does not grant a general right to redistribute, resell, rehost or incorporate the reserved game materials into other products.

See the repository's [original-material rights notice](https://github.com/Samfa12-tech/samfa12-website/blob/main/LICENSE.md) and [licensing overview](https://github.com/Samfa12-tech/samfa12-website/blob/main/LICENSING.md). Third-party licences and any express separate permissions remain applicable independently. Existing licence grants, rights under applicable law, and GitHub's public-repository viewing/forking rights are preserved. No claim is made that every generated or AI-assisted element is copyrightable.

# Reef Sweep

First-person reef conservation game, v0.5.0-preview.2 portrait refinement candidate. Babylon.js 9.26.1, TypeScript 5.8.3, save schema 1. This is the website repository's canonical authoring source. The public runtime under `games/reef-sweep/play` is generated.

## Build and preview

From the website root:

```sh
npm ci --prefix game-sources/reef-sweep
npm run test:reef-sweep
npm run build:reef-sweep
npm run sync:reef-sweep
npm run verify:reef-sweep-pages
```

From this directory, `npm run preview` serves `dist` on loopback port 4173. Rebuild after source edits. `npm run test:package` validates standalone embedding, local assets and manifest hashes. Source and pinned Babylon closure are included; no engine migration or paid assets were used. Node 22 is the CI baseline.

## Play

Begin in Sunlit Gardens. The skippable first-dive lesson advances when you look, swim, approach and remove a lionfish, secure it, do field work, then board at the mooring. Replay in the field guide changes no campaign progress. Hold to draw and release to strike; hold Interact to secure the catch. Keep a return reserve. The chart and wrist computer help you get home.

Five sites unlock through conservation work. Tideglass Passage now starts at a sheltered western mooring, with a nursery route leading across its central tide race to Cathedral arch. Old suspended Passage dives keep their original terrain and camera. Completed cleanup and planted coral stay completed.

Survey work opens after eight conservation reputation and accepting Dr Mira Vale's university invitation. The first funded two-station assignment pays $65 total by day or $72 at night, including station pay. Repeat monitoring pays $38/$45 total. Unavailable contracts explain what is missing. Audience milestones offer recognition assignments; followers do not replace conservation reputation.

Nine equipment types have five ranks. The scooter opens on day3/reputation4 and the torch on day4/reputation6; major first purchases remain substantial; later service is cheaper and ranks 3–5 open with logged days and reputation. See `docs/BALANCE_RATIONALE.md` for costs, fixtures and assumptions. Regulator rank 2, a head torch and unlocked Passage are needed for night dives. Give the shark room and return safely.

Optional three-cut filleting shows a grade and exact sale bonus, up to 30% on fish sold. Each cut and final preparation persist, and a catch can be prepared once. Later sites occasionally have clearly warned overhead boats; avoid active fishing lines and recover abandoned gear for one $5 fee.

## Controls and saves

Desktop: WASD swim, mouse look, Mouse 1 or R draw/release, E interact, Space/Ctrl rise/descend, Q scooter, L torch, V watch, J chart, Escape pause. Move over the scene to look if mouse capture is denied.

Touch supports portrait and landscape without forced rotation pauses. Controllers use a standard fallback, the established USB Backbone preset and saved calibration in Settings. Actual phone/USB feel remains a manual acceptance check for this candidate.

Three save slots are local to the browser and origin. Export before clearing storage or moving devices; import on the new origin. Existing gear, finances and ecological work remain. Legacy in-flight rewards are honoured for that outing. Storage failures allow play with an export warning. See `docs/SAVES.md`.

## Analytics and review boundary

The exact shared website start client at commit b928454 is bundled. Transmission is disabled (`enabled:false`, empty endpoint). A genuine Begin or saved-game Resume arms the hook after successful loading and an active matching world frame; menus, pauses, practice and debug tests do not count. The shared service owns consent, sessions, retries and Stats totals. No service was deployed.

`docs/REVIEW_VALIDATION.md` records confirmed defects, design changes, browser fixtures, performance limits and remaining manual checks. Historical handoff notes are retained as history and do not describe the current release. Large procedural ocean and online co-op are reserved for a sequel in `docs/SEQUEL_IDEA.md`.

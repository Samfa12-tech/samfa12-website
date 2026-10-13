# Reef Sweep — engineering instructions

This is Samfa12’s first-person conservation game. Begin with `docs/CODEX_HANDOFF.md`, `docs/FEATURE_STATUS.md`, and `docs/TESTING.md`. Preserve existing save files and the approved fantasy.

## Non-negotiable constraints

- Babylon.js, first-person / chest-camera composition, landscape touch and desktop. Do not convert to a side-scroller, shooter wave arena or auto-target game.
- Simulation owns gameplay and serializable data; renderer owns Babylon objects. Never put meshes, audio nodes or DOM references in saves.
- Keep authored site geometry, stable persistent IDs and seeded variation. Do not regenerate away restored coral or reset a cleared site every dive.
- Spear is hold/draw/release and manual collection. Secured cargo cannot be stolen. Do not add wildlife-feeding rewards, attacks through walls, unavoidable surprise damage, or a paywall to basic diving.
- Failures lose the outing’s catch and incur a bounded bill, not permanent equipment loss or a financial soft-lock.
- Maintain actual editable Pocket Chordsmith song data and a dedicated runtime adapter. Do not replace the music with unrelated random oscillators while still calling it Pocket Chordsmith.
- Highlight image cards must not be labelled playable videos. Local event scores must not be labelled global/online. No fake real players.
- Desktop and mobile use the same rules. Performance settings may reduce cosmetic density or resolution, not hide meaningful targets or threats.
- Preserve steady-camera, toggle draw, readable warnings, volume controls and pause-on-focus-loss. Cancelling touch/pointer input must never fire a pending strike.
- Keep all shipping assets local and document origin/license. No API keys, telemetry, account sign-in, paid assets or third-party server dependencies without explicit owner agreement.

## Working procedure

Run `npm test`, `npm run typecheck`, and `npm run build`. Perform actual browser and device checks for a change affecting rendering or input. Capture reproducible screenshots, timings and a seed/save where an issue occurs. Update the feature-status and known-issues documents; mark untested work honestly.

Prefer small, coherent changes. Do not rewrite the entire project merely to adopt a preferred framework. When replacing the custom Babylon vendor closure with the ordinary official package, perform a dedicated import/build migration and prove the same game still renders before changing art or rules.

Only `?debug=1` / `#debug` exposes mutation-capable developer helpers in normal hosting. Do not expose these in a future trusted online score path. Current local saves and scores are intentionally client-editable and are not anti-cheat systems.

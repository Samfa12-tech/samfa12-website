# Room for Life — Pocket Chordsmith audio

## What is actually included

The soundtrack is an original composition called **Room for Life**, represented in Pocket Chordsmith project format. `public/music/room-for-life.pcs.json` is the editable source. `src/audio/score.ts` is generated from that JSON. `reference/Pocket-Chordsmith-v65.html` is the exact user-supplied editor copied for this handoff, not a newly audited editor release.

`src/audio/pcs-voices.ts` adapts the actual `chordInstrumentConfig` and `leadInstrumentConfig` functions from that supplied editor. Playback uses those configurations for oscillator partials, filtering and envelopes. This is a focused in-game playback implementation, not an embedded copy of the whole editor and not a claim that all PCS effects/articulations are supported.

Composition: G major, sus2 harmony, 92 BPM, 4/4, four-bar sections at resolution 4. The runtime alternates related A/B sections. The JSON also contains the remaining editor section fields required by schema 16. No commercial recording, sampled voice or copied game soundtrack is used.

## Edit the music

1. Open the reference editor in a browser, open Settings → Project & export.
2. Paste `public/music/room-for-life.pcs.json` into the project field and choose Import. Use Advanced mode to inspect the tracks.
3. Edit within the supported structure below; export compact JSON back to the same file.
4. Run `npm run build`. The sync step validates the structure and regenerates `src/audio/score.ts`.
5. Test harbour, exploration, sustained aim/work, threat, low air, return, pause and resume. Listen through headphones and phone speakers.

Do not independently edit the generated TS and the JSON. They should remain one composition.

## Current supported playback subset

The adapter reads key/scale, chord degree progressions, the selected chord instrument, the first melody track and its instrument/octave, and the bass/kick/snare/hat grid. A/B are four bars with 64 sixteenth-step cells. The rhythm/time structure is deliberately restricted to 4/4 and resolution 4 for reliable layer alignment. The build sync rejects an incompatible form rather than silently improvising a new one.

General song arrangements, arbitrary section lengths, several simultaneous melody tracks, every PCS articulation, live MIDI input, tuplets, guitar and the complete editor FX chain are **not implemented** in this player. To extend them, add explicit schema tests and an audible fixture before using the new field in a score.

## Adaptive direction

| State | Intent |
|---|---|
| Harbour | Warm melody and a lightly playful pulse; harp-oriented variation |
| Exploration | Sparse sustained harmony, restrained melody; leave space for breathing/water |
| Focus | A subtle additional pulse during hunting/work, not action-combat music |
| Danger | Reduced melody and a more present rhythmic/bass layer |
| Recovery | Resolve back towards the theme rather than restart the track abruptly |

A shared clock schedules compatible layers. Changes are applied on musical boundaries with gain fades. Brief state flicker is damped with minimum linger windows, including approximately 2.8 seconds for focus and 4 seconds for danger. The score is not restarted for every fish or UI notification.

Danger responds to game state exposed to the player; it should not act as an invisible through-wall creature detector. Important warning effects reduce the music level temporarily. Critical information also has visual feedback.

## Scheduling and resource policy

The engine owns one AudioContext. User interaction unlocks audio. Scheduling uses a short lookahead timer; live voices are bounded (48), and they stop/disconnect rather than accumulating indefinitely. Visibility/pause boundaries silence or suspend appropriately; a resumed context schedules against its current time rather than playing a backlog.

Music, ambience and effects have independent controls. The ambience includes synthesized breathing/water/bubbles; action feedback covers draw/strike, securing fish, work, warnings, theft and injury. There is no narration/voice-over in this build.

## Known audio work for Codex

Run a physical-device soak test for oscillator/node growth and audible clicks. Refine the arrangement after an uninterrupted ten-minute dive; short automation cannot judge musical fatigue. Test iOS autoplay/resume and tab/background transitions. Add richer underwater equipment sounds without burying breathing or safety cues. Preserve the original score source, instrument provenance and bar-synchronised changes.

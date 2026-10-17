# Boat camera correction - 2026-10-17

Sam tested the combined local candidate and confirmed the audio, dive animation/transition and lionfish near display were good. He found the boat camera locked at an odd viewpoint. Publication remains paused for his camera confirmation.

## Cause and correction

The crew integration's camera code set a low port-quarter position and target on every boat frame, including ordinary driving. The boat loop did not consume the existing look axes, and boat-mode pointer-down returned before establishing a mouse/touch look drag. The prior renderer also used a fixed chase view; its centred elevated starting composition is restored, with normal sensitivity/invert-Y and calibrated controller look now reaching a trip-local orbit.

Driving starts behind the skiff, approximately 10.3 metres back and 5.6 metres above sea level. Mouse hover/drag, touch drag and controller right stick adjust the view independently of steering; the cursor remains available for navigation. Pitch stays above the water and bounded. The close entry camera applies only while an entry sequence exists. Player look does not accumulate into the driving view during the clip. Pause freezes the current driving/cinematic view; resume preserves it. Cancellation clears pending input, a new trip creates fresh look state, and completion/skip rebuild the ordinary dive camera and clear boat mode. No camera objects or look state enter saves.

## Evidence

The pre-fix muted isolated Chrome runner reproduced the fault: initial boat heading 0.4 radians, camera heading 0.988 and pitch 0.183, rather than the centred rear view. Receipt: task-3/qa-boat-camera-before/browser.json.

Corrected checks: typecheck, 201 automated tests and 8 package checks pass. The 26-check tests/browser-boat-camera.py runner uses separate fresh browser contexts (never Sam's open tabs or saves), native mouse and portrait CDP touch, and a simulated standard controller. It covers initial view, look/steering, pause/resume, cinematic isolation, cancel/new trip, full completion, skip and dive camera handoff. Screenshots and numeric receipts are retained in task-3/qa-boat-camera-final2. An intermediate stronger touch-handoff assertion exposed a fixture issue: injected mouse movement had switched the emulated touch device into mouse mode. Restoring native touch before the skip gesture passed actual post-dive look movement. The failed receipt remains at task-3/qa-boat-camera-final. Simulated controller/portrait emulation are not physical-device certification.

The prior combined audio/crew/lionfish candidate remains recoverable at task-3/preserved-pre-camera. The corrected standalone remains game-sources/reef-sweep/Reef-Sweep.html; the existing loopback preview serves dist at http://127.0.0.1:4173/. Its build manifest identifies 0.5.0-preview.3. Sam's manually opened file and browser windows were left untouched. Reload explicitly when ready to pick up the rebuilt file. No publication, merge or upload is part of this correction checkpoint.

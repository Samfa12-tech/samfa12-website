# Banana Banana Ducky! hosted revision

The owner-supplied v1.1 package remains unchanged and private. Its original HTML
SHA-256 is `56c4f1c04ce505aed5dfcf6351360a9320dcb9c3bdfc734ef6eda2574d1325b7`.
The first published hosting copy was
`7b530d9a5d0fa8dc51212dbd90731fcf4e8bba9aa8644b325575c5fe68822ca5`.
The release verifier pins the complete reviewed hosting revision; updates require
reviewing the runtime diff and deliberately updating that hash.

## Joystick repair and cartoon candidate (2026-10-03)

An owner report from iPad play described a locked joystick with persistent
downward movement while action buttons still worked. The published controller
can reproduce this state when its element misses a release: the old pointer ID
blocks the next thumb and its last axes keep moving the character. There is no
physical-device event trace proving what caused that missing release.

The revised controller listens for the owning pointer's release at page capture
phase, tolerates failed pointer capture, and reconciles native touch identifiers
against the live touch list independently of PointerEvent IDs. Cancel, capture
loss and a new primary touch sequence recover ownership. Another joystick finger
or an action finger cannot steal the thumb or release it. There is no inactivity
timeout that could interrupt stationary held movement. Reset clears ownership
before releasing capture. Gamepad axes are polled separately and become zero
when the pad disappears.

Pause, focus loss, hidden/frozen pages, page navigation and orientation changes
clear input. Ordinary same-orientation viewport resizing keeps a held thumb and
its initial centre, so browser toolbar movement does not stop or redirect it.
HUG holds have their own pointer owner and page-level release handling. Audio
is suspended on background transitions and resumes through existing user gestures.

The renderer uses three cel-shading bands, cool shadows, antialiased silhouette
ink and restrained highlights in its existing WebGL 2 instanced fragment shader.
It adds no pass, geometry, render target, dependency, texture or external asset.
Original character geometry, palette, UI, rules, save identity and version label
are retained. Personal attribution remains absent.

## Review validation

The input tests execute the shipped controller and lifecycle handlers in an
event harness. They cover missed releases outside the pad, failed capture,
capture loss/cancel, independent touch/pointer IDs, simultaneous fingers, long
stationary holds, stale sequence recovery, resize/orientation, background/focus
and vanished gamepads. `npm run test:content` includes these regressions in CI.

Private browser QA uses actual hosted localhost pages, Chromium CDP simultaneous
touch and Windows WebKit tablet emulation with native pointer drags and touch
button taps. Capture failures, missing pointer notifications and background
events are deliberately injected. Deterministic before/after render images cover
all four maps; tablet images cover portrait and fresh landscape loads. The same
scenes have unchanged draw, instance and triangle counts and no WebGL errors.

Physical iPad Safari retesting, audio listening and sustained device performance
remain owner review steps. Windows WebKit screenshots can omit the WebGL canvas
after a viewport resize; fresh orientation loads are used for visual evidence.
Screenshots, event traces and the supplied package are private working evidence
and are excluded from the repository and Pages artifact. This revision is a
draft review candidate until the owner approves publication.

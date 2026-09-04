export const WALK_BOB_PROFILE = Object.freeze({
  minimumSpeed: 0.65,
  referenceSpeed: 6.4,
  lateralAmplitude: 0.014,
  verticalAmplitude: 0.022,
  minimumAngularSpeed: 7.4,
  maximumAngularSpeed: 10.4,
  fadeSpeed: 8.5,
  aimScale: 0.2,
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function createWalkBobState() {
  return Object.freeze({phase: 0, weight: 0});
}

/**
 * Advances presentation-only first-person movement. It consumes movement state
 * but never mutates it, so camera motion cannot influence collision or aim.
 */
export function advanceWalkBob(state, {
  deltaSeconds = 0,
  horizontalSpeed = 0,
  grounded = false,
  sliding = false,
  mantling = false,
  aiming = false,
  reducedMotion = false,
} = {}) {
  const previousPhase = finite(state?.phase);
  const previousWeight = clamp(finite(state?.weight), 0, 1);
  if (reducedMotion) {
    return Object.freeze({
      state: Object.freeze({phase: previousPhase, weight: 0}),
      weight: 0,
      offset: Object.freeze({right: 0, up: 0}),
    });
  }

  const dt = clamp(finite(deltaSeconds), 0, 0.1);
  const speed = Math.max(0, finite(horizontalSpeed));
  const active = grounded === true
    && sliding !== true
    && mantling !== true
    && speed > WALK_BOB_PROFILE.minimumSpeed;
  const speedRatio = clamp(
    (speed - WALK_BOB_PROFILE.minimumSpeed)
      / (WALK_BOB_PROFILE.referenceSpeed - WALK_BOB_PROFILE.minimumSpeed),
    0,
    1,
  );
  const targetWeight = active ? 0.45 + speedRatio * 0.55 : 0;
  const alpha = 1 - Math.exp(-WALK_BOB_PROFILE.fadeSpeed * dt);
  const weight = previousWeight + (targetWeight - previousWeight) * alpha;
  const angularSpeed = WALK_BOB_PROFILE.minimumAngularSpeed
    + (WALK_BOB_PROFILE.maximumAngularSpeed - WALK_BOB_PROFILE.minimumAngularSpeed) * speedRatio;
  const phase = active
    ? (previousPhase + angularSpeed * dt) % (Math.PI * 2)
    : previousPhase;
  const focus = aiming ? WALK_BOB_PROFILE.aimScale : 1;
  const scale = weight * focus;

  return Object.freeze({
    state: Object.freeze({phase, weight}),
    weight,
    offset: Object.freeze({
      right: Math.sin(phase) * WALK_BOB_PROFILE.lateralAmplitude * scale,
      up: Math.sin(phase * 2) * WALK_BOB_PROFILE.verticalAmplitude * scale,
    }),
  });
}

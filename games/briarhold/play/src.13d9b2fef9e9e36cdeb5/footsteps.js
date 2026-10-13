export const FOOTSTEP_WALK_INTERVAL_SECONDS = 0.44;
export const FOOTSTEP_SPRINT_INTERVAL_SECONDS = 0.31;
export const FOOTSTEP_RESTART_SECONDS = 0.08;
export const FOOTSTEP_MIN_SPEED = 0.65;
/** Use authored support, including ground-level stone landings, instead of height alone. */
export function footstepSurface(surface) {
  if (!surface || surface.surfaceId === 'killing-field') return 'dirt';
  return surface.appearance === 'courtyard-stone' || /(?:courtyard|gatehouse|landing|ramp|postern|walk|deck)/u.test(surface.surfaceId)
    ? 'stone' : 'dirt';
}

/** One presented-frame owner; stalls never produce a catch-up burst. */
export function createFootstepCadence() {
  let nextAt = Number.NEGATIVE_INFINITY;
  let lastNow = Number.NEGATIVE_INFINITY;
  return {
    update({now, grounded, sliding = false, horizontalSpeed, sprint = false, active = true} = {}) {
      const time = Number(now);
      const speed = Number(horizontalSpeed);
      if (!Number.isFinite(time)) return false;
      if (time < lastNow) {
        nextAt = time + FOOTSTEP_RESTART_SECONDS;
        lastNow = time;
        return false;
      }
      lastNow = time;
      if (!active || !grounded || sliding || !Number.isFinite(speed) || speed <= FOOTSTEP_MIN_SPEED) {
        nextAt = Math.max(nextAt, time + FOOTSTEP_RESTART_SECONDS);
        return false;
      }
      if (time + 1e-9 < nextAt) return false;
      nextAt = time + (sprint ? FOOTSTEP_SPRINT_INTERVAL_SECONDS : FOOTSTEP_WALK_INTERVAL_SECONDS);
      return true;
    },
    reset() {
      nextAt = lastNow = Number.NEGATIVE_INFINITY;
    },
  };
}

const STONE_VARIANTS = Object.freeze([
  Object.freeze({frequency: 114, filter: 940, offset: 0.11, gain: 0.96}),
  Object.freeze({frequency: 121, filter: 1020, offset: 0.47, gain: 1.03}),
  Object.freeze({frequency: 116, filter: 975, offset: 0.89, gain: 0.99}),
  Object.freeze({frequency: 124, filter: 1050, offset: 1.31, gain: 1.01}),
]);
// A small deterministic palette avoids identical neighbours without random
// pitch jumps, new sample downloads or unbounded audio work.
const STONE_ORDER = Object.freeze([0, 2, 1, 3, 2, 0, 3, 1]);

export function createFootstepVariation() {
  let stepIndex = 0;
  let stoneIndex = 0;
  let dirtIndex = 0;
  return {
    next(surface = 'dirt', {sprint = false} = {}) {
      const pan = stepIndex++ % 2 === 0 ? 0.08 : -0.08;
      if (surface === 'stone') {
        const variantIndex = STONE_ORDER[stoneIndex++ % STONE_ORDER.length];
        return {
          ...STONE_VARIANTS[variantIndex],
          id: `stone-${variantIndex}`, surface: 'stone', sampleId: null, pan,
        };
      }
      const variantIndex = dirtIndex++ % 2;
      return {
        id: `dirt-${variantIndex}`, surface: 'dirt',
        sampleId: variantIndex === 0 ? 'footstep-dirt-a' : 'footstep-dirt-b',
        frequency: 76, filter: 430, offset: variantIndex === 0 ? 0.19 : 0.73,
        gain: variantIndex === 0 ? 1 : 0.98,
        rate: (sprint ? 1.08 : 0.96) + (variantIndex === 0 ? -0.01 : 0.01), pan,
      };
    },
  };
}

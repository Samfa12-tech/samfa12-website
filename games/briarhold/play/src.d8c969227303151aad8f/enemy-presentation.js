/**
 * Presentation policy for the optional animated enemy hero layer.
 *
 * Ordinary horde bodies remain on the GPU sprite atlas. The animated layer is
 * deliberately bounded to nearby/fixed-count enemies so a visual preference
 * cannot accidentally turn the 2k/6k density targets into thousands of
 * skinned meshes.
 */

export const ENEMY_PRESENTATION_MODES = Object.freeze({
  AUTO: "auto",
  ANIMATED_3D: "animated3d",
  SPRITES: "sprites",
});

export const SPOREWING_BASE_FLIGHT_Y = 1.35;
export const SPOREWING_GATE_CLEARANCE_Y = 9;
export const SPOREWING_GATE_CLIMB_DISTANCE = 12;

/**
 * Presentation-only flight path across the outer gate. Sporewings remain
 * authoritative flying hunters, but rise far enough that every renderer shows
 * them clearing the seven-metre gate instead of intersecting its geometry.
 */
export function sporewingFlightOffsetAtGate(z, gateZ = 0) {
  if (!Number.isFinite(z) || !Number.isFinite(gateZ)) return SPOREWING_BASE_FLIGHT_Y;
  const distance = Math.abs(z - gateZ);
  if (distance >= SPOREWING_GATE_CLIMB_DISTANCE) return SPOREWING_BASE_FLIGHT_Y;
  const linear = Math.max(0, Math.min(1, distance / SPOREWING_GATE_CLIMB_DISTANCE));
  const smooth = linear * linear * (3 - 2 * linear);
  return SPOREWING_GATE_CLEARANCE_Y
    + (SPOREWING_BASE_FLIGHT_Y - SPOREWING_GATE_CLEARANCE_Y) * smooth;
}

/** Keep combat targeting attached to the body players actually see. */
export function sporewingTargetProfileAtGate(z, gateZ = 0) {
  return Object.freeze({
    centerY: sporewingFlightOffsetAtGate(z, gateZ),
    halfHeight: 1.8,
  });
}

const VALID_MODES = new Set(Object.values(ENEMY_PRESENTATION_MODES));

/**
 * Enemy renderers are created when a wave starts. Keep this preference
 * unavailable while that renderer is live, and explain when it can be
 * changed so a mid-wave selection cannot appear to do nothing.
 */
export function enemyPresentationAvailability(phase) {
  const currentPhase = String(phase || "").toLowerCase();
  if (currentPhase === "combat") {
    return Object.freeze({
      enabled: false,
      message: "Available between waves or at the title screen.",
    });
  }
  return Object.freeze({
    enabled: true,
    message: currentPhase === "build_break" ? "Applies when the next wave starts." : "",
  });
}

/** @param {unknown} value @returns {string} */
export function normaliseEnemyPresentation(value) {
  const mode = String(value || "").toLowerCase();
  return VALID_MODES.has(mode) ? mode : ENEMY_PRESENTATION_MODES.AUTO;
}

/**
 * Return the maximum number of animated hero enemies allowed by the device
 * tier. Performance quality halves that bounded layer without changing the
 * authoritative horde density or sprite fallback.
 */
export function animatedEnemyCap({
  coarse = false,
  graphicsQuality = "auto",
  fastHardware = true,
} = {}) {
  const base = coarse ? 8 : (fastHardware ? 24 : 12);
  return String(graphicsQuality || "").toLowerCase() === "performance"
    ? Math.max(1, Math.floor(base / 2))
    : base;
}

/** Conservative renderer-name gate used only for Auto and cap selection. */
export function enemy3dFastHardware(renderer = "") {
  const value = String(renderer || "").toLowerCase();
  if (/swiftshader|software|llvmpipe|microsoft basic/u.test(value)) return false;
  if (/intel\(r\).*uhd|intel\(r\).*iris|intel.*graphics/u.test(value)) return false;
  return /nvidia|geforce|quadro|radeon rx|apple m\d|adreno 8/u.test(value);
}

/**
 * Resolve the requested policy against runtime capability.
 *
 * Auto is intentionally conservative: only a non-coarse, non-software
 * device opts into the bounded animated layer. Explicit Animated 3D is an
 * opt-in on hardware, including coarse hardware with its smaller cap. A
 * software renderer always falls back to sprites because it is not a safe
 * place to add skinned meshes.
 *
 * @returns {{requested: string, mode: string, animated3d: boolean,
 *   maxAnimatedEnemies: number, fallback: boolean, reason: string}}
 */
export function resolveEnemyPresentation(value, {
  coarse = false,
  software = false,
  graphicsQuality = "auto",
  fastHardware = true,
} = {}) {
  const requested = normaliseEnemyPresentation(value);
  const hardware = !Boolean(software);
  let mode = ENEMY_PRESENTATION_MODES.SPRITES;
  let reason = "sprites-requested";

  if (requested === ENEMY_PRESENTATION_MODES.ANIMATED_3D) {
    mode = hardware ? ENEMY_PRESENTATION_MODES.ANIMATED_3D : ENEMY_PRESENTATION_MODES.SPRITES;
    reason = hardware ? "animated3d-requested" : "software-fallback";
  } else if (requested === ENEMY_PRESENTATION_MODES.AUTO) {
    const eligible = !Boolean(coarse) && hardware && Boolean(fastHardware);
    mode = eligible ? ENEMY_PRESENTATION_MODES.ANIMATED_3D : ENEMY_PRESENTATION_MODES.SPRITES;
    reason = eligible
      ? "auto-fast-device"
      : (software ? "auto-software-fallback" : (coarse ? "auto-coarse-fallback" : "auto-integrated-fallback"));
  }

  const animated3d = mode === ENEMY_PRESENTATION_MODES.ANIMATED_3D;
  return Object.freeze({
    requested,
    mode,
    animated3d,
    maxAnimatedEnemies: animated3d
      ? animatedEnemyCap({coarse, graphicsQuality, fastHardware})
      : 0,
    fallback: requested === ENEMY_PRESENTATION_MODES.ANIMATED_3D && !animated3d,
    reason,
  });
}

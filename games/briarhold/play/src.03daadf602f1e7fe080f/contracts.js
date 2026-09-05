/**
 * Shared first-person pivot contracts.
 *
 * These values intentionally have no Babylon or DOM dependency so gameplay,
 * renderer, input, save and test code can agree on a stable wire shape.
 */

export const BRIARHOLD_VERSION = "0.3.0-alpha.98";

export const GAME_PHASES = Object.freeze({
  MENU: "menu",
  DAYTIME: "daytime",
  BUILD_BREAK: "build_break",
  COMBAT: "combat",
  INTERWAVE_RECOVERY: "interwave_recovery",
  BOON_CHOICE: "boon_choice",
  NIGHT_COMPLETE: "night_complete",
  RUN_FAILED: "run_failed",
  CAMPAIGN_COMPLETE: "campaign_complete",
});

export const GAME_PHASE_VALUES = Object.freeze(Object.values(GAME_PHASES));

export const INPUT_SOURCES = Object.freeze({
  MOUSE: "mouse",
  TOUCH: "touch",
  GAMEPAD: "gamepad",
});

export const INPUT_SOURCE_VALUES = Object.freeze(Object.values(INPUT_SOURCES));

export const ENEMY_VISUAL_STATES = Object.freeze({
  ACTIVE: "active",
  DYING: "dying",
  DEAD: "dead",
});

export const ENEMY_ANIMATIONS = Object.freeze({
  IDLE: "idle",
  LOCOMOTION: "locomotion",
  ATTACK: "attack",
  HIT: "hit",
  DEATH: "death",
});

export const WEAPON_SLOTS = Object.freeze({
  ARBALEST: 0,
  SUNFIRE: 1,
  RUNEBOLT: 2,
});

export const PLAYER_DEFAULTS = Object.freeze({
  maxHp: 100,
  walkSpeed: 4.6,
  sprintSpeed: 6.4,
  capsuleRadius: 0.38,
  capsuleHeight: 1.75,
  eyeHeight: 1.62,
  jumpVelocity: 7.4,
  mantleHeight: 1.35,
  mantleDuration: 0.28,
  slideSpeed: 9.2,
  slideDuration: 0.62,
  slideCapsuleHeight: 1.02,
  slideEyeHeight: 0.88,
  maxStepHeight: 0.45,
  minPitch: -1.35,
  maxPitch: 1.35,
  activeWeapon: WEAPON_SLOTS.ARBALEST,
  emergencyHealCost: 30,
  emergencyHealAmount: 50,
});

export const DENSITY_PROFILE_IDS = Object.freeze({
  MOBILE: "mobile",
  DESKTOP: "desktop",
});

export function isGamePhase(value) {
  return GAME_PHASE_VALUES.includes(value);
}

export function isInputSource(value) {
  return INPUT_SOURCE_VALUES.includes(value);
}

/**
 * @typedef {object} InputFrame
 * @property {{x:number, y:number}} move Local right/forward movement intent.
 * @property {{yaw:number, pitch:number}} look Look delta in radians.
 * @property {boolean} fire
 * @property {0|1|2|null} selectedWeapon
 * @property {boolean} interact
 * @property {boolean} sprint
 * @property {boolean} jump
 * @property {boolean} slide
 * @property {boolean} pause
 * @property {"mouse"|"touch"|"gamepad"} source
 */

/**
 * @typedef {object} PlayerState
 * @property {{x:number,y:number,z:number}} position Feet position in metres.
 * @property {{x:number,y:number,z:number}} velocity
 * @property {{yaw:number,pitch:number}} facing
 * @property {boolean} grounded
 * @property {number} eyeHeight
 * @property {boolean} sliding
 * @property {number} hp
 * @property {number} maxHp
 * @property {0|1|2} activeWeapon
 * @property {number[]} heat
 * @property {boolean} healAvailable
 * @property {number} damageCooldown
 */

/**
 * @typedef {object} EnemyVisualState
 * @property {string} archetype
 * @property {number} direction Directional atlas sector.
 * @property {"active"|"dying"|"dead"} state
 * @property {number} stateStart Simulation time in seconds.
 * @property {number} scale
 * @property {number} tint Packed renderer colour.
 * @property {string|number} visibilitySector
 */

/**
 * @typedef {object} DensityProfile
 * @property {"mobile"|"desktop"} id
 * @property {number} concurrentBodyTarget
 * @property {number} hunterCap
 * @property {number} rendererUpdateBudget
 * @property {number} visualSubdivision
 */

/**
 * @typedef {object} ProfileStateV2
 * @property {2} version
 * @property {number} oathmarks
 * @property {Record<string, number>} ranks
 * @property {string[]} unlocks
 * @property {Record<string, unknown>} settings
 */

/**
 * @typedef {object} RunStateV2
 * @property {2} version
 * @property {number} night
 * @property {number} wave
 * @property {PlayerState} player
 * @property {Record<string, unknown>} gates
 * @property {number} supplies
 * @property {unknown[]} fortifications
 * @property {string[]} boons
 * @property {number} unbankedOathmarks
 * @property {Record<string, unknown>|null} waveStartSnapshot
 */

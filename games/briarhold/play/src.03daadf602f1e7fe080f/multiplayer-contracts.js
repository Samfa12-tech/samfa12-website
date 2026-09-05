import {
  DENSITY_PROFILE_IDS,
  GAME_PHASE_VALUES,
  PLAYER_DEFAULTS,
  WEAPON_SLOTS,
} from './contracts.js';

export const MULTIPLAYER_PROTOCOL_VERSION = 2;
export const SESSION_CONFIG_VERSION = 2;
export const PLAYER_COMMAND_VERSION = 2;
export const NETWORK_PLAYER_STATE_VERSION = 1;
export const SESSION_WEAPON_STATE_VERSION = 2;
export const AUTHORITATIVE_EVENT_VERSION = 2;
export const AUTHORITATIVE_TICK_RATE = 30;
export const MAX_SESSION_PLAYERS = 4;
export const PLAYER_COMMAND_MOVE_QUANTIZATION = 127;
export const PLAYER_COMMAND_LOOK_QUANTIZATION = 32767;
// A command represents one fixed tick, so bound authoritative look intent in
// radians per tick rather than trusting device-specific sensitivity values.
export const MAX_COMMAND_LOOK_RADIANS_PER_TICK = 0.35;
export const WEAPON_TIME_UNITS_PER_SECOND = 600;
export const WEAPON_TIME_UNITS_PER_TICK = WEAPON_TIME_UNITS_PER_SECOND / AUTHORITATIVE_TICK_RATE;
export const WEAPON_HEAT_SCALE = 3_000_000;

export const PLAYER_COMMAND_ACTIONS = Object.freeze({
  FIRE: 1 << 0,
  INTERACT: 1 << 1,
  SPRINT: 1 << 2,
  JUMP: 1 << 3,
  SLIDE: 1 << 4,
  MELEE: 1 << 5,
});

export const PLAYER_COMMAND_ACTION_MASK = Object.values(PLAYER_COMMAND_ACTIONS)
  .reduce((mask, value) => mask | value, 0);

export const NETWORK_TRAVERSAL_STATES = Object.freeze({
  GROUNDED: 'grounded',
  AIRBORNE: 'airborne',
  SLIDING: 'sliding',
  MANTLING: 'mantling',
});

export const NETWORK_ANIMATION_STATES = Object.freeze({
  IDLE: 'idle',
  WALK: 'walk',
  RUN: 'run',
  JUMP: 'jump',
  FALL: 'fall',
  SLIDE: 'slide',
  MANTLE: 'mantle',
  HIT: 'hit',
  DOWNED: 'downed',
  INTERACT: 'interact',
  FIRE: 'fire',
});

export const AUTHORITATIVE_EVENT_KINDS = Object.freeze({
  WEAPON_FIRED: 'weapon_fired',
  WEAPON_VENTED: 'weapon_vented',
  MELEE_STRIKE: 'melee_strike',
});

const SESSION_CONFIG_KEYS = Object.freeze(new Set([
  'version', 'protocolVersion', 'roomId', 'buildHash', 'contentHash', 'mapId',
  'densityProfileId', 'tickRate', 'maxPlayers', 'seed',
]));
const PLAYER_COMMAND_KEYS = Object.freeze(new Set([
  'version', 'sequence', 'intendedTick', 'acknowledgedServerTick', 'move',
  'look', 'actions', 'selectedWeapon', 'aiming', 'manualVent',
]));
const NETWORK_PLAYER_KEYS = Object.freeze(new Set([
  'version', 'playerId', 'position', 'velocity', 'facing', 'traversal',
  'grounded', 'eyeHeight', 'hp', 'maxHp', 'activeWeapon', 'heat',
  'healAvailable', 'damageCooldown', 'sprinting', 'animationState',
  'animationStartedTick', 'lastProcessedCommand',
  'slideTimer', 'slideDirection', 'jumpHeld', 'slideHeld',
]));
const SESSION_WEAPON_KEYS = Object.freeze(new Set([
  'version', 'playerId', 'selectedWeapon', 'allowedWeapons', 'heatUnits',
  'overheated', 'nextFireTime', 'shotSequence',
  'heatByWeapon', 'overheatedByWeapon', 'nextFireTimeByWeapon', 'shotSequenceByWeapon',
  'manualVentReadyAtByWeapon', 'meleeNextReadyTime', 'meleeSequence',
]));
const AUTHORITATIVE_EVENT_KEYS = Object.freeze(new Set([
  'version', 'sequence', 'tick', 'kind', 'actorId', 'weaponSlot',
  'shotSequence', 'meleeSequence', 'origin', 'direction', 'mode',
]));

const DENSITY_PROFILE_VALUES = Object.freeze(Object.values(DENSITY_PROFILE_IDS));
const TRAVERSAL_VALUES = Object.freeze(Object.values(NETWORK_TRAVERSAL_STATES));
const ANIMATION_VALUES = Object.freeze(Object.values(NETWORK_ANIMATION_STATES));
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function exactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${label}.${key} is not part of protocol v${MULTIPLAYER_PROTOCOL_VERSION}`);
  }
}

function protocolVersion(value, expected, label) {
  const version = value ?? expected;
  if (version !== expected) throw new RangeError(`${label} version ${version} is unsupported`);
  return expected;
}

function stableId(value, label) {
  const text = String(value ?? '');
  if (!STABLE_ID.test(text)) throw new TypeError(`${label} is not a stable protocol identifier`);
  return text;
}

function finite(value, label, minimum = -1_000_000, maximum = 1_000_000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new RangeError(`${label} must be finite and between ${minimum} and ${maximum}`);
  }
  return number;
}

function float32(value, label, minimum, maximum) {
  return Math.fround(finite(value, label, minimum, maximum));
}

function integer(value, label, minimum = 0, maximum = 0xffffffff) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new RangeError(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return number;
}

function exactBoolean(value, label, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be a boolean`);
  return value;
}

function weaponSlot(value, label, nullable = false) {
  if (nullable && (value === null || value === undefined)) return null;
  return integer(value, label, WEAPON_SLOTS.ARBALEST, WEAPON_SLOTS.RUNEBOLT);
}

function vector(value, keys, label) {
  const input = record(value, label);
  exactKeys(input, new Set(keys), label);
  return Object.freeze(Object.fromEntries(
    keys.map(key => [key, float32(input[key], `${label}.${key}`)]),
  ));
}

function quantizedVector(value, keys, label, minimum, maximum) {
  const input = record(value, label);
  exactKeys(input, new Set(keys), label);
  return Object.freeze(Object.fromEntries(
    keys.map(key => [key, integer(input[key], `${label}.${key}`, minimum, maximum)]),
  ));
}

/**
 * Immutable room configuration shared by local, headless and future WSS hosts.
 * Build/content identity is explicit because unequal clients cannot safely
 * predict the same typed-array horde.
 */
export function createSessionConfig(value = {}) {
  const input = record(value, 'SessionConfig');
  exactKeys(input, SESSION_CONFIG_KEYS, 'SessionConfig');
  const tickRate = integer(
    input.tickRate ?? AUTHORITATIVE_TICK_RATE,
    'SessionConfig.tickRate',
    AUTHORITATIVE_TICK_RATE,
    AUTHORITATIVE_TICK_RATE,
  );
  const densityProfileId = input.densityProfileId ?? DENSITY_PROFILE_IDS.MOBILE;
  if (!DENSITY_PROFILE_VALUES.includes(densityProfileId)) {
    throw new RangeError(`SessionConfig.densityProfileId ${densityProfileId} is unsupported`);
  }
  return Object.freeze({
    version: protocolVersion(input.version, SESSION_CONFIG_VERSION, 'SessionConfig'),
    protocolVersion: protocolVersion(
      input.protocolVersion,
      MULTIPLAYER_PROTOCOL_VERSION,
      'SessionConfig.protocol',
    ),
    roomId: stableId(input.roomId, 'SessionConfig.roomId'),
    buildHash: stableId(input.buildHash, 'SessionConfig.buildHash'),
    contentHash: stableId(input.contentHash, 'SessionConfig.contentHash'),
    mapId: stableId(input.mapId, 'SessionConfig.mapId'),
    densityProfileId,
    tickRate,
    maxPlayers: integer(input.maxPlayers ?? MAX_SESSION_PLAYERS, 'SessionConfig.maxPlayers', 1, MAX_SESSION_PLAYERS),
    seed: integer(input.seed ?? 1, 'SessionConfig.seed'),
  });
}

/**
 * Quantized input intent. There is deliberately no player ID, position, HP,
 * damage, reward or Supplies field: the authenticated connection supplies the
 * actor identity and the session remains authoritative.
 */
export function createPlayerCommand(value = {}) {
  const input = record(value, 'PlayerCommand');
  exactKeys(input, PLAYER_COMMAND_KEYS, 'PlayerCommand');
  const actions = integer(input.actions ?? 0, 'PlayerCommand.actions', 0, 0xffff);
  if ((actions & ~PLAYER_COMMAND_ACTION_MASK) !== 0) {
    throw new RangeError('PlayerCommand.actions contains unsupported action bits');
  }
  return Object.freeze({
    version: protocolVersion(input.version, PLAYER_COMMAND_VERSION, 'PlayerCommand'),
    sequence: integer(input.sequence, 'PlayerCommand.sequence'),
    intendedTick: integer(input.intendedTick, 'PlayerCommand.intendedTick'),
    acknowledgedServerTick: input.acknowledgedServerTick === null || input.acknowledgedServerTick === undefined
      ? null
      : integer(input.acknowledgedServerTick, 'PlayerCommand.acknowledgedServerTick'),
    move: quantizedVector(
      input.move ?? {x: 0, y: 0},
      ['x', 'y'],
      'PlayerCommand.move',
      -PLAYER_COMMAND_MOVE_QUANTIZATION,
      PLAYER_COMMAND_MOVE_QUANTIZATION,
    ),
    look: quantizedVector(
      input.look ?? {yaw: 0, pitch: 0},
      ['yaw', 'pitch'],
      'PlayerCommand.look',
      -PLAYER_COMMAND_LOOK_QUANTIZATION,
      PLAYER_COMMAND_LOOK_QUANTIZATION,
    ),
    actions,
    selectedWeapon: weaponSlot(input.selectedWeapon, 'PlayerCommand.selectedWeapon', true),
    aiming: exactBoolean(input.aiming, 'PlayerCommand.aiming'),
    manualVent: exactBoolean(input.manualVent, 'PlayerCommand.manualVent'),
  });
}

/** Decode only the movement slice currently owned by the dormant authority. */
export function decodePlayerCommandMovement(value) {
  const command = createPlayerCommand(value);
  return Object.freeze({
    move: Object.freeze({
      x: command.move.x / PLAYER_COMMAND_MOVE_QUANTIZATION,
      y: command.move.y / PLAYER_COMMAND_MOVE_QUANTIZATION,
    }),
    look: Object.freeze({
      yaw: command.look.yaw / PLAYER_COMMAND_LOOK_QUANTIZATION * MAX_COMMAND_LOOK_RADIANS_PER_TICK,
      pitch: command.look.pitch / PLAYER_COMMAND_LOOK_QUANTIZATION * MAX_COMMAND_LOOK_RADIANS_PER_TICK,
    }),
    fire: false,
    selectedWeapon: null,
    interact: false,
    sprint: (command.actions & PLAYER_COMMAND_ACTIONS.SPRINT) !== 0,
    jump: (command.actions & PLAYER_COMMAND_ACTIONS.JUMP) !== 0,
    slide: (command.actions & PLAYER_COMMAND_ACTIONS.SLIDE) !== 0,
    pause: false,
  });
}

function allowedWeaponSlots(value, selectedWeapon) {
  if (!Array.isArray(value)) throw new TypeError('SessionWeaponState.allowedWeapons must be an array');
  const slots = [...new Set(value.map((slot, index) => (
    weaponSlot(slot, `SessionWeaponState.allowedWeapons[${index}]`)
  )))].sort((left, right) => left - right);
  if (slots.length < 1 || !slots.includes(selectedWeapon)) {
    throw new RangeError('SessionWeaponState.allowedWeapons must include selectedWeapon');
  }
  return Object.freeze(slots);
}

function fixedWeaponArray(value, label, normalise, fallback) {
  if (value === undefined) return Object.freeze([0, 1, 2].map(index => normalise(fallback(index), `${label}[${index}]`)));
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${label} must contain exactly three entries`);
  return Object.freeze(value.map((item, index) => normalise(item, `${label}[${index}]`)));
}

/** Canonical fixed-point weapon authority for one Warden. */
export function createSessionWeaponState(value = {}) {
  const input = record(value, 'SessionWeaponState');
  exactKeys(input, SESSION_WEAPON_KEYS, 'SessionWeaponState');
  const selectedWeapon = weaponSlot(
    input.selectedWeapon ?? WEAPON_SLOTS.ARBALEST,
    'SessionWeaponState.selectedWeapon',
  );
  const maximumHeatUnits = Math.round(WEAPON_HEAT_SCALE * 1.2);
  const scalarHeat = integer(Array.isArray(input.heatUnits) ? 0 : input.heatUnits ?? 0, 'SessionWeaponState.heatUnits', 0, maximumHeatUnits);
  const scalarOverheated = Array.isArray(input.overheated) ? false : exactBoolean(input.overheated, 'SessionWeaponState.overheated');
  const scalarNextFireTime = integer(Array.isArray(input.nextFireTime) ? 0 : input.nextFireTime ?? 0,
    'SessionWeaponState.nextFireTime', 0, Number.MAX_SAFE_INTEGER);
  const scalarShotSequence = integer(Array.isArray(input.shotSequence) ? 0 : input.shotSequence ?? 0,
    'SessionWeaponState.shotSequence');
  const heatByWeapon = fixedWeaponArray(input.heatByWeapon ?? (Array.isArray(input.heatUnits) ? input.heatUnits : undefined),
    'SessionWeaponState.heatByWeapon', (item, label) => integer(item, label, 0, maximumHeatUnits),
    index => index === selectedWeapon ? scalarHeat : 0);
  const overheatedByWeapon = fixedWeaponArray(input.overheatedByWeapon ?? (Array.isArray(input.overheated) ? input.overheated : undefined),
    'SessionWeaponState.overheatedByWeapon', (item, label) => exactBoolean(item, label),
    index => index === selectedWeapon ? scalarOverheated : false);
  const nextFireTimeByWeapon = fixedWeaponArray(input.nextFireTimeByWeapon ?? (Array.isArray(input.nextFireTime) ? input.nextFireTime : undefined),
    'SessionWeaponState.nextFireTimeByWeapon', (item, label) => integer(item, label, 0, Number.MAX_SAFE_INTEGER),
    index => index === selectedWeapon ? scalarNextFireTime : 0);
  const shotSequenceByWeapon = fixedWeaponArray(input.shotSequenceByWeapon ?? (Array.isArray(input.shotSequence) ? input.shotSequence : undefined),
    'SessionWeaponState.shotSequenceByWeapon', (item, label) => integer(item, label),
    index => index === selectedWeapon ? scalarShotSequence : 0);
  const manualVentReadyAtByWeapon = fixedWeaponArray(input.manualVentReadyAtByWeapon,
    'SessionWeaponState.manualVentReadyAtByWeapon', (item, label) => integer(item, label, 0, Number.MAX_SAFE_INTEGER), () => 0);
  return Object.freeze({
    version: protocolVersion(input.version, SESSION_WEAPON_STATE_VERSION, 'SessionWeaponState'),
    playerId: stableId(input.playerId, 'SessionWeaponState.playerId'),
    selectedWeapon,
    allowedWeapons: allowedWeaponSlots(input.allowedWeapons ?? [selectedWeapon], selectedWeapon),
    heatUnits: heatByWeapon[selectedWeapon],
    overheated: overheatedByWeapon[selectedWeapon],
    nextFireTime: nextFireTimeByWeapon[selectedWeapon],
    shotSequence: shotSequenceByWeapon[selectedWeapon],
    heatByWeapon, overheatedByWeapon, nextFireTimeByWeapon, shotSequenceByWeapon, manualVentReadyAtByWeapon,
    meleeNextReadyTime: integer(
      input.meleeNextReadyTime ?? 0,
      'SessionWeaponState.meleeNextReadyTime',
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    meleeSequence: integer(input.meleeSequence ?? 0, 'SessionWeaponState.meleeSequence'),
  });
}

export function sessionWeaponStateFromPlayer(playerId, player, metadata = {}) {
  const selectedWeapon = weaponSlot(
    metadata.selectedWeapon ?? player?.activeWeapon ?? WEAPON_SLOTS.ARBALEST,
    'SessionWeaponState.selectedWeapon',
  );
  const heat = Number(metadata.heat ?? player?.heat?.[selectedWeapon] ?? 0);
  return createSessionWeaponState({
    playerId,
    selectedWeapon,
    allowedWeapons: metadata.allowedWeapons ?? [selectedWeapon],
    heatUnits: Math.round(Math.max(0, Math.min(1, Number.isFinite(heat) ? heat : 0)) * WEAPON_HEAT_SCALE),
    overheated: metadata.overheated === true,
    nextFireTime: metadata.nextFireTime ?? 0,
    shotSequence: metadata.shotSequence ?? 0,
    heatByWeapon: metadata.heatByWeapon ?? player?.heat?.map(value => Math.round(Math.max(0, Math.min(1.2, Number(value) || 0)) * WEAPON_HEAT_SCALE)),
    overheatedByWeapon: metadata.overheatedByWeapon,
    nextFireTimeByWeapon: metadata.nextFireTimeByWeapon,
    shotSequenceByWeapon: metadata.shotSequenceByWeapon,
    manualVentReadyAtByWeapon: metadata.manualVentReadyAtByWeapon,
    meleeNextReadyTime: metadata.meleeNextReadyTime ?? 0,
    meleeSequence: metadata.meleeSequence ?? 0,
  });
}

/** Strict server-authored presentation event. Clients cannot supply this DTO as intent. */
export function createAuthoritativeEvent(value = {}) {
  const input = record(value, 'AuthoritativeEvent');
  exactKeys(input, AUTHORITATIVE_EVENT_KEYS, 'AuthoritativeEvent');
  if (!Object.values(AUTHORITATIVE_EVENT_KINDS).includes(input.kind)) {
    throw new RangeError(`AuthoritativeEvent.kind ${input.kind} is unsupported`);
  }
  const isMelee = input.kind === AUTHORITATIVE_EVENT_KINDS.MELEE_STRIKE;
  const weaponSlotValue = isMelee
    ? (input.weaponSlot === null || input.weaponSlot === undefined ? null : (() => {
      throw new TypeError('Melee AuthoritativeEvent.weaponSlot must be null');
    })())
    : weaponSlot(input.weaponSlot, 'AuthoritativeEvent.weaponSlot');
  const shotSequence = isMelee
    ? (input.shotSequence === null || input.shotSequence === undefined ? null : (() => {
      throw new TypeError('Melee AuthoritativeEvent.shotSequence must be null');
    })())
    : integer(input.shotSequence, 'AuthoritativeEvent.shotSequence', 1);
  const meleeSequence = isMelee
    ? integer(input.meleeSequence, 'AuthoritativeEvent.meleeSequence', 1)
    : (input.meleeSequence === null || input.meleeSequence === undefined ? null : (() => {
      throw new TypeError('Weapon AuthoritativeEvent.meleeSequence must be null');
    })());
  const direction = vector(input.direction, ['x', 'y', 'z'], 'AuthoritativeEvent.direction');
  const directionLength = Math.hypot(direction.x, direction.y, direction.z);
  if (Math.abs(directionLength - 1) > 1e-5) {
    throw new RangeError('AuthoritativeEvent.direction must be normalized');
  }
  let mode = null;
  if (!isMelee) {
    const modeInput = record(input.mode ?? {ads: false, overheatWindow: false, charged: false, manualVent: false, heatUnits: 0}, 'AuthoritativeEvent.mode');
    exactKeys(modeInput, new Set(['ads', 'overheatWindow', 'charged', 'manualVent', 'heatUnits']), 'AuthoritativeEvent.mode');
    mode = Object.freeze({
      ads: exactBoolean(modeInput.ads, 'AuthoritativeEvent.mode.ads'),
      overheatWindow: exactBoolean(modeInput.overheatWindow, 'AuthoritativeEvent.mode.overheatWindow'),
      charged: exactBoolean(modeInput.charged, 'AuthoritativeEvent.mode.charged'),
      manualVent: exactBoolean(modeInput.manualVent, 'AuthoritativeEvent.mode.manualVent'),
      heatUnits: integer(modeInput.heatUnits, 'AuthoritativeEvent.mode.heatUnits', 0, Math.round(WEAPON_HEAT_SCALE * 1.2)),
    });
  } else if (input.mode !== null && input.mode !== undefined) throw new TypeError('Melee AuthoritativeEvent.mode must be null');
  return Object.freeze({
    version: protocolVersion(input.version, AUTHORITATIVE_EVENT_VERSION, 'AuthoritativeEvent'),
    sequence: integer(input.sequence, 'AuthoritativeEvent.sequence', 1),
    tick: integer(input.tick, 'AuthoritativeEvent.tick'),
    kind: input.kind,
    actorId: stableId(input.actorId, 'AuthoritativeEvent.actorId'),
    weaponSlot: weaponSlotValue,
    shotSequence,
    meleeSequence,
    origin: vector(input.origin, ['x', 'y', 'z'], 'AuthoritativeEvent.origin'),
    direction,
    mode,
  });
}

function traversalForPlayer(player) {
  if (player?.mantleState) return NETWORK_TRAVERSAL_STATES.MANTLING;
  if (player?.sliding) return NETWORK_TRAVERSAL_STATES.SLIDING;
  return player?.grounded === true
    ? NETWORK_TRAVERSAL_STATES.GROUNDED
    : NETWORK_TRAVERSAL_STATES.AIRBORNE;
}

function animationForPlayer(player, traversal, sprinting) {
  if (traversal === NETWORK_TRAVERSAL_STATES.MANTLING) return NETWORK_ANIMATION_STATES.MANTLE;
  if (traversal === NETWORK_TRAVERSAL_STATES.SLIDING) return NETWORK_ANIMATION_STATES.SLIDE;
  if (traversal === NETWORK_TRAVERSAL_STATES.AIRBORNE) {
    return Number(player?.velocity?.y) < -0.1
      ? NETWORK_ANIMATION_STATES.FALL
      : NETWORK_ANIMATION_STATES.JUMP;
  }
  const speed = Math.hypot(Number(player?.velocity?.x) || 0, Number(player?.velocity?.z) || 0);
  if (speed < 0.15) return NETWORK_ANIMATION_STATES.IDLE;
  return sprinting || speed >= 5.2 ? NETWORK_ANIMATION_STATES.RUN : NETWORK_ANIMATION_STATES.WALK;
}

/** Normalize one server-owned Warden state into a stable renderer-facing DTO. */
export function createNetworkPlayerState(value = {}) {
  const input = record(value, 'NetworkPlayerState');
  exactKeys(input, NETWORK_PLAYER_KEYS, 'NetworkPlayerState');
  const traversal = input.traversal ?? NETWORK_TRAVERSAL_STATES.GROUNDED;
  if (!TRAVERSAL_VALUES.includes(traversal)) {
    throw new RangeError(`NetworkPlayerState.traversal ${traversal} is unsupported`);
  }
  const grounded = exactBoolean(input.grounded, 'NetworkPlayerState.grounded');
  if (grounded !== [NETWORK_TRAVERSAL_STATES.GROUNDED, NETWORK_TRAVERSAL_STATES.SLIDING].includes(traversal)) {
    throw new RangeError('NetworkPlayerState.grounded contradicts traversal');
  }
  const maxHp = float32(input.maxHp, 'NetworkPlayerState.maxHp', 0.001, 1_000_000);
  const hp = float32(input.hp, 'NetworkPlayerState.hp', 0, maxHp);
  const heatInput = input.heat ?? [0, 0, 0];
  if (!Array.isArray(heatInput) && !ArrayBuffer.isView(heatInput)) {
    throw new TypeError('NetworkPlayerState.heat must contain three weapon values');
  }
  if (heatInput.length !== 3) throw new RangeError('NetworkPlayerState.heat must contain three weapon values');
  const heat = Object.freeze(Array.from(heatInput, (amount, index) => (
    float32(amount, `NetworkPlayerState.heat[${index}]`, 0, 1)
  )));
  const animationState = input.animationState ?? NETWORK_ANIMATION_STATES.IDLE;
  if (!ANIMATION_VALUES.includes(animationState)) {
    throw new RangeError(`NetworkPlayerState.animationState ${animationState} is unsupported`);
  }
  return Object.freeze({
    version: protocolVersion(input.version, NETWORK_PLAYER_STATE_VERSION, 'NetworkPlayerState'),
    playerId: stableId(input.playerId, 'NetworkPlayerState.playerId'),
    position: vector(input.position, ['x', 'y', 'z'], 'NetworkPlayerState.position'),
    velocity: vector(input.velocity, ['x', 'y', 'z'], 'NetworkPlayerState.velocity'),
    facing: vector(input.facing, ['yaw', 'pitch'], 'NetworkPlayerState.facing'),
    traversal,
    grounded,
    eyeHeight: float32(input.eyeHeight ?? PLAYER_DEFAULTS.eyeHeight, 'NetworkPlayerState.eyeHeight', 0.1, 4),
    hp,
    maxHp,
    activeWeapon: weaponSlot(input.activeWeapon, 'NetworkPlayerState.activeWeapon'),
    heat,
    healAvailable: exactBoolean(input.healAvailable, 'NetworkPlayerState.healAvailable'),
    damageCooldown: float32(input.damageCooldown ?? 0, 'NetworkPlayerState.damageCooldown', 0, 60),
    sprinting: exactBoolean(input.sprinting, 'NetworkPlayerState.sprinting'),
    animationState,
    animationStartedTick: integer(input.animationStartedTick ?? 0, 'NetworkPlayerState.animationStartedTick'),
    lastProcessedCommand: input.lastProcessedCommand === null || input.lastProcessedCommand === undefined
      ? null
      : integer(input.lastProcessedCommand, 'NetworkPlayerState.lastProcessedCommand'),
    slideTimer: float32(input.slideTimer ?? 0, 'NetworkPlayerState.slideTimer', 0, 60),
    slideDirection: vector(
      input.slideDirection ?? {x: 0, z: 0},
      ['x', 'z'],
      'NetworkPlayerState.slideDirection',
    ),
    jumpHeld: exactBoolean(input.jumpHeld, 'NetworkPlayerState.jumpHeld'),
    slideHeld: exactBoolean(input.slideHeld, 'NetworkPlayerState.slideHeld'),
  });
}

/** Build the DTO from the existing solo PlayerState without changing saves. */
export function networkPlayerStateFromPlayer(playerId, player, metadata = {}) {
  const traversal = metadata.traversal ?? traversalForPlayer(player);
  const sprinting = metadata.sprinting === true;
  return createNetworkPlayerState({
    playerId,
    position: player?.position,
    velocity: player?.velocity,
    facing: player?.facing,
    traversal,
    grounded: [NETWORK_TRAVERSAL_STATES.GROUNDED, NETWORK_TRAVERSAL_STATES.SLIDING].includes(traversal),
    eyeHeight: player?.eyeHeight,
    hp: player?.hp,
    maxHp: player?.maxHp,
    activeWeapon: player?.activeWeapon,
    heat: player?.heat,
    healAvailable: player?.healAvailable,
    damageCooldown: player?.damageCooldown,
    sprinting,
    animationState: metadata.animationState ?? animationForPlayer(player, traversal, sprinting),
    animationStartedTick: metadata.animationStartedTick ?? 0,
    lastProcessedCommand: metadata.lastProcessedCommand ?? null,
    slideTimer: player?.slideTimer,
    slideDirection: player?.slideDirection,
    jumpHeld: player?.jumpHeld,
    slideHeld: player?.slideHeld,
  });
}

export function isSessionPhase(value) {
  return GAME_PHASE_VALUES.includes(value);
}

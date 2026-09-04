import {restoreBattlefieldCheckpoint} from './battlefield-checkpoint.js';
import {WEST} from './battlefield.js';
import {GAME_PHASES, PLAYER_DEFAULTS} from './contracts.js';
import {BRIARHOLD_FIRST_PERSON_MAP} from './map-definition.js';
import {
  AUTHORITATIVE_TICK_RATE,
  AUTHORITATIVE_EVENT_KINDS,
  MAX_COMMAND_LOOK_RADIANS_PER_TICK,
  NETWORK_TRAVERSAL_STATES,
  NETWORK_PLAYER_STATE_VERSION,
  PLAYER_COMMAND_ACTIONS,
  WEAPON_HEAT_SCALE,
  WEAPON_TIME_UNITS_PER_SECOND,
  WEAPON_TIME_UNITS_PER_TICK,
  createAuthoritativeEvent,
  createNetworkPlayerState,
  createPlayerCommand,
  createSessionConfig,
  createSessionWeaponState,
  decodePlayerCommandMovement,
  isSessionPhase,
  networkPlayerStateFromPlayer,
  sessionWeaponStateFromPlayer,
} from './multiplayer-contracts.js';
import {
  cloneSessionSnapshot,
  createSessionSnapshot,
  hashSessionSnapshot,
} from './multiplayer-session-checkpoint.js';
import {updatePlayerController} from './player-controller.js';
import {KNIFE_MELEE, WEAPON_DEFINITIONS, WEAPON_HEAT, WEAPON_IDS} from './weapons.js';

export const DEFAULT_COMMAND_QUEUE_CAPACITY = 32;
export const MAX_COMMAND_AGE_TICKS = 6;
export const MAX_COMMAND_LEAD_TICKS = 6;

const MOVEMENT_PHASES = new Set([
  GAME_PHASES.BUILD_BREAK,
  GAME_PHASES.DAYTIME,
  GAME_PHASES.INTERWAVE_RECOVERY,
  GAME_PHASES.COMBAT,
]);
const OPEN_PORTCULLIS_COLLISIONS = new Set(['west-portcullis']);
const MOVEMENT_EPSILON = 1e-5;
const EMPTY_MOVEMENT_INTENT = Object.freeze({
  move: Object.freeze({x: 0, y: 0}),
  look: Object.freeze({yaw: 0, pitch: 0}),
  fire: false,
  selectedWeapon: null,
  interact: false,
  sprint: false,
  jump: false,
  slide: false,
  pause: false,
});

export class SessionCommandError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SessionCommandError';
    this.code = code;
  }
}

function integer(value, label, minimum = 0, maximum = 0xffffffff) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new RangeError(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return number;
}

function orderedEntries(players) {
  let entries;
  if (players instanceof Map) entries = [...players.entries()];
  else if (Array.isArray(players)) entries = players.map(player => [player.playerId, player]);
  else if (players && typeof players === 'object') entries = Object.entries(players);
  else throw new TypeError('Session players must be an array, Map or keyed object');
  return entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
}

function normalizePlayer(playerId, player) {
  return player?.version === NETWORK_PLAYER_STATE_VERSION
    ? createNetworkPlayerState({...player, playerId})
    : networkPlayerStateFromPlayer(playerId, player);
}

function playerMap(players, maxPlayers) {
  const normalized = new Map();
  for (const [playerId, player] of orderedEntries(players)) {
    if (normalized.has(playerId)) throw new RangeError(`Duplicate session player ${playerId}`);
    const state = normalizePlayer(playerId, player);
    normalized.set(state.playerId, state);
  }
  if (normalized.size < 1 || normalized.size > maxPlayers) {
    throw new RangeError('Session player count exceeds SessionConfig');
  }
  return normalized;
}

function weaponStateEntries(weaponStates) {
  if (weaponStates instanceof Map) return [...weaponStates.entries()];
  if (Array.isArray(weaponStates)) return weaponStates.map(state => [state.playerId, state]);
  if (weaponStates && typeof weaponStates === 'object') return Object.entries(weaponStates);
  throw new TypeError('Session weaponStates must be an array, Map or keyed object');
}

function weaponStateMap(weaponStates, players) {
  const entries = weaponStates === null || weaponStates === undefined
    ? [...players].map(([playerId, player]) => [playerId, sessionWeaponStateFromPlayer(playerId, player)])
    : weaponStateEntries(weaponStates);
  const normalized = new Map();
  for (const [playerId, value] of entries.sort(([left], [right]) => (
    left < right ? -1 : left > right ? 1 : 0
  ))) {
    if (!players.has(playerId)) throw new RangeError(`Weapon state belongs to unknown player ${playerId}`);
    if (normalized.has(playerId)) throw new RangeError(`Duplicate session weapon state ${playerId}`);
    const state = createSessionWeaponState({...value, playerId});
    if (players.get(playerId).activeWeapon !== state.selectedWeapon) {
      throw new RangeError(`Weapon selection contradicts player ${playerId}`);
    }
    normalized.set(playerId, state);
  }
  if (normalized.size !== players.size) throw new RangeError('Session requires one weapon state per player');
  return normalized;
}

function assertBattlefieldTickRate(battlefield, tickRate) {
  if (!battlefield || typeof battlefield.update !== 'function' || typeof battlefield.assertIntegrity !== 'function') {
    throw new TypeError('SessionState requires a Battlefield');
  }
  const expected = 1 / tickRate;
  if (!Number.isFinite(battlefield.fixedStep) || Math.abs(battlefield.fixedStep - expected) > 1e-12) {
    throw new RangeError(`Battlefield fixedStep must equal 1/${tickRate}`);
  }
  battlefield.assertIntegrity();
}

function assertMapIdentity(mapDefinition, expectedId) {
  if (!mapDefinition || typeof mapDefinition !== 'object' || typeof mapDefinition.id !== 'string') {
    throw new TypeError('SessionState requires a MapDefinition');
  }
  if (mapDefinition.id !== expectedId) {
    throw new RangeError(`SessionConfig.mapId ${expectedId} does not match MapDefinition ${mapDefinition.id}`);
  }
}

function assertSupportedMovementState(player) {
  if (player.traversal === NETWORK_TRAVERSAL_STATES.MANTLING) {
    throw new RangeError(`Authoritative movement does not yet support ${player.traversal} traversal snapshots`);
  }
}

/**
 * Dormant renderer-free session authority. It owns command ingress, fixed
 * ticking and the bounded movement/look/sprint slice, but intentionally does
 * not yet apply weapons, building or economy.
 */
export function createSessionState({
  config,
  tick = 0,
  phase,
  eventSequence = 0,
  players,
  weaponStates = null,
  battlefield,
  mapDefinition = BRIARHOLD_FIRST_PERSON_MAP,
  commandQueueCapacity = DEFAULT_COMMAND_QUEUE_CAPACITY,
  resolveWeaponTuning = null,
} = {}) {
  const normalizedConfig = createSessionConfig(config);
  if (!isSessionPhase(phase)) throw new RangeError(`SessionState phase ${phase} is unsupported`);
  assertBattlefieldTickRate(battlefield, normalizedConfig.tickRate);
  assertMapIdentity(mapDefinition, normalizedConfig.mapId);
  const normalizedPlayers = playerMap(players, normalizedConfig.maxPlayers);
  for (const player of normalizedPlayers.values()) assertSupportedMovementState(player);
  const normalizedWeaponStates = weaponStateMap(weaponStates, normalizedPlayers);
  for (const [playerId, state] of normalizedWeaponStates) {
    normalizedPlayers.set(playerId, networkPlayerWithWeapon(normalizedPlayers.get(playerId), state));
  }
  const queueCapacity = integer(commandQueueCapacity, 'commandQueueCapacity', 1, 256);
  const commandQueues = new Map();
  const lastReceivedSequence = new Map();
  const lastReceivedIntendedTick = new Map();
  for (const [playerId, player] of normalizedPlayers) {
    commandQueues.set(playerId, []);
    lastReceivedSequence.set(playerId, player.lastProcessedCommand ?? -1);
    lastReceivedIntendedTick.set(playerId, -1);
  }
  return {
    config: normalizedConfig,
    tick: integer(tick, 'SessionState.tick'),
    phase,
    eventSequence: integer(eventSequence, 'SessionState.eventSequence'),
    players: normalizedPlayers,
    weaponStates: normalizedWeaponStates,
    resolveWeaponTuning: typeof resolveWeaponTuning === 'function' ? resolveWeaponTuning : () => ({}),
    battlefield,
    mapDefinition,
    commandQueueCapacity: queueCapacity,
    commandQueues,
    lastReceivedSequence,
    lastReceivedIntendedTick,
  };
}

function commandError(code, message) {
  throw new SessionCommandError(code, message);
}

/** Validate and enqueue one authenticated player's intent. */
export function enqueuePlayerCommand(session, playerId, value) {
  if (!session?.players?.has(playerId)) commandError('unknown_player', `Unknown session player ${playerId}`);
  const command = createPlayerCommand(value);
  const lastSequence = session.lastReceivedSequence.get(playerId) ?? -1;
  if (command.sequence <= lastSequence) {
    commandError('replayed_sequence', `PlayerCommand sequence ${command.sequence} was already received`);
  }
  const lastIntendedTick = session.lastReceivedIntendedTick.get(playerId) ?? -1;
  if (command.intendedTick < lastIntendedTick) {
    commandError('regressed_tick', `PlayerCommand tick ${command.intendedTick} regresses its input stream`);
  }
  if (command.intendedTick < Math.max(0, session.tick - MAX_COMMAND_AGE_TICKS)) {
    commandError('stale_tick', `PlayerCommand tick ${command.intendedTick} is too old`);
  }
  if (command.intendedTick > session.tick + MAX_COMMAND_LEAD_TICKS) {
    commandError('future_tick', `PlayerCommand tick ${command.intendedTick} is too far ahead`);
  }
  if (command.acknowledgedServerTick !== null && command.acknowledgedServerTick > session.tick) {
    commandError('future_ack', `PlayerCommand acknowledges future server tick ${command.acknowledgedServerTick}`);
  }
  const queue = session.commandQueues.get(playerId);
  if (queue.length >= session.commandQueueCapacity) {
    commandError('queue_full', `PlayerCommand queue for ${playerId} is full`);
  }
  queue.push(command);
  queue.sort((left, right) => left.intendedTick - right.intendedTick || left.sequence - right.sequence);
  session.lastReceivedSequence.set(playerId, command.sequence);
  session.lastReceivedIntendedTick.set(playerId, command.intendedTick);
  return command;
}

function submissionEntries(commandsByPlayer) {
  if (commandsByPlayer === null || commandsByPlayer === undefined) return [];
  if (commandsByPlayer instanceof Map) return [...commandsByPlayer.entries()];
  if (commandsByPlayer && typeof commandsByPlayer === 'object' && !Array.isArray(commandsByPlayer)) {
    return Object.entries(commandsByPlayer);
  }
  throw new TypeError('commandsByPlayer must be a Map or keyed object');
}

/**
 * Deterministically enqueue a frame/batch regardless of object or Map insertion
 * order. Commands for each player are ordered by sequence before validation.
 */
export function enqueueSessionCommands(session, commandsByPlayer) {
  const accepted = [];
  const entries = submissionEntries(commandsByPlayer)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  for (const [playerId, input] of entries) {
    const commands = (Array.isArray(input) ? input : [input])
      .map(createPlayerCommand)
      .sort((left, right) => left.sequence - right.sequence);
    for (const command of commands) accepted.push({playerId, command: enqueuePlayerCommand(session, playerId, command)});
  }
  return Object.freeze(accepted.map(item => Object.freeze(item)));
}

function controllerPlayer(player) {
  return {
    position: {...player.position},
    velocity: {...player.velocity},
    facing: {...player.facing},
    grounded: player.grounded,
    eyeHeight: player.eyeHeight,
    sliding: player.traversal === NETWORK_TRAVERSAL_STATES.SLIDING,
    slideTimer: player.slideTimer,
    slideDirection: {...player.slideDirection},
    mantleState: null,
    jumpHeld: player.jumpHeld,
    slideHeld: player.slideHeld,
    hp: player.hp,
    maxHp: player.maxHp,
    activeWeapon: player.activeWeapon,
    heat: [...player.heat],
    healAvailable: player.healAvailable,
    damageCooldown: player.damageCooldown,
  };
}

function applyMovementTick(session, playerId, command, nextTick) {
  const previous = session.players.get(playerId);
  const mutable = controllerPlayer(previous);
  const intent = command ? decodePlayerCommandMovement(command) : EMPTY_MOVEMENT_INTENT;
  const seconds = 1 / session.config.tickRate;
  const beforeX = mutable.position.x;
  const beforeZ = mutable.position.z;
  const beforeYaw = mutable.facing.yaw;
  const beforePitch = mutable.facing.pitch;
  updatePlayerController(mutable, intent, seconds, {
    mapDefinition: session.mapDefinition,
    // Mantling is intentionally rejected until its complete deterministic
    // state is part of NetworkPlayerState. A jump remains a normal jump.
    mantleHeight: 0,
    disabledCollisionIds: session.battlefield.outerGateBreached[WEST]
      ? OPEN_PORTCULLIS_COLLISIONS
      : null,
  });

  const horizontalSpeed = Math.hypot(mutable.velocity.x, mutable.velocity.z);
  const horizontalDistance = Math.hypot(mutable.position.x - beforeX, mutable.position.z - beforeZ);
  const maximumSpeed = Math.max(PLAYER_DEFAULTS.sprintSpeed, PLAYER_DEFAULTS.slideSpeed);
  const maximumDistance = maximumSpeed * seconds;
  if (
    !Number.isFinite(horizontalSpeed)
    || !Number.isFinite(horizontalDistance)
    || horizontalSpeed > maximumSpeed + MOVEMENT_EPSILON
    || horizontalDistance > maximumDistance + MOVEMENT_EPSILON
  ) {
    throw new Error(`Authoritative movement exceeded the ${maximumSpeed} m/s speed limit`);
  }
  if (
    !Number.isFinite(mutable.facing.yaw)
    || !Number.isFinite(mutable.facing.pitch)
    || Math.abs(mutable.facing.yaw - beforeYaw) > MAX_COMMAND_LOOK_RADIANS_PER_TICK + MOVEMENT_EPSILON
    || Math.abs(mutable.facing.pitch - beforePitch) > MAX_COMMAND_LOOK_RADIANS_PER_TICK + MOVEMENT_EPSILON
  ) {
    throw new Error('Authoritative movement exceeded the look-per-tick limit');
  }

  const sprinting = intent.sprint && horizontalSpeed >= 0.15;
  const lastProcessedCommand = command?.sequence ?? previous.lastProcessedCommand;
  let next = networkPlayerStateFromPlayer(playerId, mutable, {
    sprinting,
    animationStartedTick: previous.animationStartedTick,
    lastProcessedCommand,
  });
  if (next.animationState !== previous.animationState) {
    next = networkPlayerStateFromPlayer(playerId, mutable, {
      sprinting,
      animationStartedTick: nextTick,
      lastProcessedCommand,
    });
  }
  session.players.set(playerId, next);
}

const PASSIVE_COOLING_UNITS_PER_TICK = Math.round(
  WEAPON_HEAT.passiveCoolingPerSecond * WEAPON_HEAT_SCALE / AUTHORITATIVE_TICK_RATE,
);
const TRIGGER_HELD_COOLING_UNITS_PER_TICK = Math.round(
  PASSIVE_COOLING_UNITS_PER_TICK * WEAPON_HEAT.triggerHeldCoolingMultiplier,
);
const OVERHEAT_RECOVERY_UNITS = Math.round(
  WEAPON_HEAT.overheatedRecoveryThreshold * WEAPON_HEAT_SCALE,
);

function weaponDefinition(slot) {
  return WEAPON_DEFINITIONS[WEAPON_IDS[slot]];
}

function authoritativeShotPose(player) {
  const yaw = player.facing.yaw;
  const pitch = player.facing.pitch;
  const horizontal = Math.cos(pitch);
  return {
    origin: {
      x: player.position.x,
      y: player.position.y + player.eyeHeight,
      z: player.position.z,
    },
    direction: {
      x: Math.sin(yaw) * horizontal,
      y: -Math.sin(pitch),
      z: Math.cos(yaw) * horizontal,
    },
  };
}

function authoritativeMeleePose(player) {
  const pose = authoritativeShotPose(player);
  pose.origin.y = player.position.y + (KNIFE_MELEE.slashLowOffset + KNIFE_MELEE.slashHighOffset) / 2;
  return pose;
}

function syncPlayerWeaponPresentation(session, playerId, state) {
  const player = session.players.get(playerId);
  session.players.set(playerId, networkPlayerWithWeapon(player, state));
}

function networkPlayerWithWeapon(player, state) {
  return createNetworkPlayerState({
    ...player,
    activeWeapon: state.selectedWeapon,
    heat: state.heatByWeapon.map(value => value / WEAPON_HEAT_SCALE),
  });
}

function applyWeaponTick(session, playerId, command, nextTick) {
  const previous = session.weaponStates.get(playerId);
  let selectedWeapon = previous.selectedWeapon;
  let selectionRejected = false;
  if (command?.selectedWeapon !== null && command?.selectedWeapon !== undefined) {
    if (previous.allowedWeapons.includes(command.selectedWeapon)) selectedWeapon = command.selectedWeapon;
    else selectionRejected = true;
  }

  const heatByWeapon = [...previous.heatByWeapon];
  const overheatedByWeapon = [...previous.overheatedByWeapon];
  const nextFireTimeByWeapon = [...previous.nextFireTimeByWeapon];
  const shotSequenceByWeapon = [...previous.shotSequenceByWeapon];
  const manualVentReadyAtByWeapon = [...previous.manualVentReadyAtByWeapon];
  let heatUnits = heatByWeapon[selectedWeapon];
  let overheated = overheatedByWeapon[selectedWeapon];
  let nextFireTime = nextFireTimeByWeapon[selectedWeapon];
  let shotSequence = shotSequenceByWeapon[selectedWeapon];
  let event = null;

  if (session.phase === GAME_PHASES.COMBAT) {
    const now = nextTick * WEAPON_TIME_UNITS_PER_TICK;
    const fireRequested = !selectionRejected
      && (command?.actions & PLAYER_COMMAND_ACTIONS.FIRE) !== 0;
    const requestedMode = {ads: command?.aiming === true, manualVent: command?.manualVent === true};
    const tuning = session.resolveWeaponTuning(playerId, selectedWeapon, requestedMode) ?? {};
    const mode = {ads: selectedWeapon === 0 && requestedMode.ads && tuning.adsEnabled === true,
      manualVent: requestedMode.manualVent};
    const threshold = Math.max(1, Math.min(1.2, Number(tuning.overheatThreshold) || 1));
    const thresholdUnits = Math.round(threshold * WEAPON_HEAT_SCALE);
    const ventRequested = mode.manualVent && selectedWeapon === 1;
    if (ventRequested && Number(tuning.manualVentBurstDamage) > 0 && Number(tuning.manualVentRadius) > 0
      && now >= manualVentReadyAtByWeapon[selectedWeapon]) {
      session.eventSequence += 1;
      heatUnits = Math.max(0, heatUnits - Math.round((Number(tuning.manualVentHeatReduction) || 0) * WEAPON_HEAT_SCALE));
      overheated = false;
      manualVentReadyAtByWeapon[selectedWeapon] = now + Math.round(Math.max(0.1,
        Number(tuning.manualVentCooldownSeconds) || 0.1) * WEAPON_TIME_UNITS_PER_SECOND);
      const pose = authoritativeShotPose(session.players.get(playerId));
      event = createAuthoritativeEvent({sequence: session.eventSequence, tick: nextTick,
        kind: AUTHORITATIVE_EVENT_KINDS.WEAPON_VENTED, actorId: playerId, weaponSlot: selectedWeapon,
        shotSequence: ++shotSequence, meleeSequence: null, origin: pose.origin, direction: pose.direction,
        mode: {ads: mode.ads, overheatWindow: false, charged: false, manualVent: true, heatUnits}});
    }
    if (!event && fireRequested && !overheated && now >= nextFireTime) {
      if (shotSequence >= 0xffffffff) throw new RangeError(`Weapon shot sequence overflow for ${playerId}`);
      if (session.eventSequence >= 0xffffffff) throw new RangeError('SessionState eventSequence overflow');
      const definition = weaponDefinition(selectedWeapon);
      const priorHeat = heatUnits;
      heatUnits = Math.min(
        thresholdUnits,
        heatUnits + Math.round(definition.heat * WEAPON_HEAT_SCALE * Math.max(0, Number(tuning.heatGainMultiplier) || 1)),
      );
      overheated ||= heatUnits >= thresholdUnits;
      shotSequence += 1;
      session.eventSequence += 1;
      const pose = authoritativeShotPose(session.players.get(playerId));
      event = createAuthoritativeEvent({
        sequence: session.eventSequence,
        tick: nextTick,
        kind: AUTHORITATIVE_EVENT_KINDS.WEAPON_FIRED,
        actorId: playerId,
        weaponSlot: selectedWeapon,
        shotSequence,
        meleeSequence: null,
        origin: pose.origin,
        direction: pose.direction,
        mode: {ads: mode.ads, overheatWindow: priorHeat >= WEAPON_HEAT_SCALE && priorHeat < thresholdUnits,
          charged: selectedWeapon === 0 && mode.ads && Number(tuning.adsDamageMultiplier) > 1,
          manualVent: false, heatUnits},
      });
      let cadence = Math.max(0.05, Number(tuning.shotIntervalMultiplier) || 1);
      if (selectedWeapon === 0) cadence *= mode.ads
        ? Math.max(0.05, Number(tuning.adsShotIntervalMultiplier) || 1)
        : Math.max(0.05, Number(tuning.hipShotIntervalMultiplier) || 1);
      if (selectedWeapon === 2) cadence *= Math.max(0.05, Number(tuning.runeboltShotIntervalMultiplier) || 1);
      const interval = Math.round(definition.interval * WEAPON_TIME_UNITS_PER_SECOND * cadence);
      const lateness = now - nextFireTime;
      nextFireTime = nextFireTime > 0 && lateness <= interval
        ? nextFireTime + interval
        : now + interval;
    }

    const activelyFiring = fireRequested && !overheated;
    heatUnits = Math.max(
      0,
      heatUnits - Math.round((activelyFiring ? TRIGGER_HELD_COOLING_UNITS_PER_TICK : PASSIVE_COOLING_UNITS_PER_TICK)
        * Math.max(0, Number(tuning.passiveCoolingMultiplier) || 1)),
    );
    if (overheated && heatUnits <= OVERHEAT_RECOVERY_UNITS) overheated = false;
  }

  heatByWeapon[selectedWeapon] = heatUnits;
  overheatedByWeapon[selectedWeapon] = overheated;
  nextFireTimeByWeapon[selectedWeapon] = nextFireTime;
  shotSequenceByWeapon[selectedWeapon] = shotSequence;

  const next = createSessionWeaponState({
    playerId,
    selectedWeapon,
    allowedWeapons: previous.allowedWeapons,
    heatUnits,
    overheated,
    nextFireTime,
    shotSequence,
    heatByWeapon, overheatedByWeapon, nextFireTimeByWeapon, shotSequenceByWeapon, manualVentReadyAtByWeapon,
    meleeNextReadyTime: previous.meleeNextReadyTime,
    meleeSequence: previous.meleeSequence,
  });
  session.weaponStates.set(playerId, next);
  syncPlayerWeaponPresentation(session, playerId, next);
  return event;
}

/** Apply an idempotency-decided host kill refund to the firing Warden's exact weapon state. */
export function applySessionWeaponHeatRefund(session, playerId, weaponSlot, refund) {
  const previous = session?.weaponStates?.get(playerId);
  if (!previous || !Number.isInteger(weaponSlot) || weaponSlot < 0 || weaponSlot > 2) return false;
  const amount = Math.max(0, Math.min(1.2, Number(refund) || 0));
  if (amount <= 0) return false;
  const heatByWeapon = [...previous.heatByWeapon];
  heatByWeapon[weaponSlot] = Math.max(0, heatByWeapon[weaponSlot] - Math.round(amount * WEAPON_HEAT_SCALE));
  const next = createSessionWeaponState({...previous, heatByWeapon});
  session.weaponStates.set(playerId, next);
  syncPlayerWeaponPresentation(session, playerId, next);
  return true;
}

export function applySessionManualVent(session, playerId, tuning, tick = session?.tick ?? 0) {
  const previous = session?.weaponStates?.get(playerId);
  if (!previous || previous.selectedWeapon !== 1 || !(Number(tuning?.manualVentBurstDamage) > 0)
    || !(Number(tuning?.manualVentRadius) > 0)) return null;
  const now = integer(tick, 'manual vent authority tick') * WEAPON_TIME_UNITS_PER_TICK;
  if (now < previous.manualVentReadyAtByWeapon[1]) return null;
  const heatByWeapon = [...previous.heatByWeapon];
  const overheatedByWeapon = [...previous.overheatedByWeapon];
  const shotSequenceByWeapon = [...previous.shotSequenceByWeapon];
  const manualVentReadyAtByWeapon = [...previous.manualVentReadyAtByWeapon];
  heatByWeapon[1] = Math.max(0, heatByWeapon[1] - Math.round((Number(tuning.manualVentHeatReduction) || 0) * WEAPON_HEAT_SCALE));
  overheatedByWeapon[1] = false;
  shotSequenceByWeapon[1] += 1;
  manualVentReadyAtByWeapon[1] = now + Math.round(Math.max(0.1,
    Number(tuning.manualVentCooldownSeconds) || 0.1) * WEAPON_TIME_UNITS_PER_SECOND);
  const next = createSessionWeaponState({...previous, heatByWeapon, overheatedByWeapon, shotSequenceByWeapon,
    manualVentReadyAtByWeapon});
  session.weaponStates.set(playerId, next);
  syncPlayerWeaponPresentation(session, playerId, next);
  session.eventSequence += 1;
  const pose = authoritativeShotPose(session.players.get(playerId));
  return createAuthoritativeEvent({sequence: session.eventSequence, tick, kind: AUTHORITATIVE_EVENT_KINDS.WEAPON_VENTED,
    actorId: playerId, weaponSlot: 1, shotSequence: next.shotSequenceByWeapon[1], meleeSequence: null,
    origin: pose.origin, direction: pose.direction,
    mode: {ads: false, overheatWindow: false, charged: false, manualVent: true, heatUnits: next.heatByWeapon[1]}});
}

function authoritativeMeleeTick(session, playerId, command, nextTick) {
  const previous = session.weaponStates.get(playerId);
  if (session.phase !== GAME_PHASES.COMBAT
    || (command?.actions & PLAYER_COMMAND_ACTIONS.MELEE) === 0) {
    return null;
  }
  const now = nextTick * WEAPON_TIME_UNITS_PER_TICK;
  if (now < previous.meleeNextReadyTime) return null;
  if (previous.meleeSequence >= 0xffffffff) throw new RangeError(`Melee sequence overflow for ${playerId}`);
  if (session.eventSequence >= 0xffffffff) throw new RangeError('SessionState eventSequence overflow');
  const meleeSequence = previous.meleeSequence + 1;
  session.eventSequence += 1;
  session.weaponStates.set(playerId, createSessionWeaponState({
    ...previous,
    meleeNextReadyTime: now + Math.round(KNIFE_MELEE.cooldownSeconds * WEAPON_TIME_UNITS_PER_SECOND),
    meleeSequence,
  }));
  const pose = authoritativeMeleePose(session.players.get(playerId));
  return createAuthoritativeEvent({
    sequence: session.eventSequence,
    tick: nextTick,
    kind: AUTHORITATIVE_EVENT_KINDS.MELEE_STRIKE,
    actorId: playerId,
    weaponSlot: null,
    shotSequence: null,
    meleeSequence,
    origin: pose.origin,
    direction: pose.direction,
  });
}

/**
 * Advance exactly one authoritative tick. Every Warden receives one movement
 * application using its newest due command; absent input is neutral. All due
 * commands are acknowledged and returned in stable
 * `(intendedTick, playerId, sequence)` order.
 */
export function stepSession(session, commandsByPlayer = null) {
  if (!session?.config || session.config.tickRate !== AUTHORITATIVE_TICK_RATE) {
    throw new TypeError('A valid SessionState is required');
  }
  enqueueSessionCommands(session, commandsByPlayer);
  if (session.tick >= 0xffffffff) throw new RangeError('SessionState tick overflow');
  const nextTick = session.tick + 1;
  const processed = [];
  const events = [];
  for (const playerId of [...session.players.keys()].sort()) {
    const queue = session.commandQueues.get(playerId);
    let latestCommand = null;
    while (queue.length > 0 && queue[0].intendedTick <= nextTick) {
      const command = queue.shift();
      processed.push({playerId, command});
      latestCommand = command;
    }
    if (MOVEMENT_PHASES.has(session.phase)) applyMovementTick(session, playerId, latestCommand, nextTick);
    else if (latestCommand) {
      const player = session.players.get(playerId);
      session.players.set(playerId, createNetworkPlayerState({
        ...player,
        lastProcessedCommand: latestCommand.sequence,
      }));
    }
    if (MOVEMENT_PHASES.has(session.phase)) {
      const event = applyWeaponTick(session, playerId, latestCommand, nextTick);
      if (event) events.push(event);
      const meleeEvent = authoritativeMeleeTick(session, playerId, latestCommand, nextTick);
      if (meleeEvent) events.push(meleeEvent);
    }
  }
  processed.sort((left, right) => (
    left.command.intendedTick - right.command.intendedTick
    || (left.playerId < right.playerId ? -1 : left.playerId > right.playerId ? 1 : 0)
    || left.command.sequence - right.command.sequence
  ));
  if (session.phase === GAME_PHASES.COMBAT) session.battlefield.update(1 / session.config.tickRate);
  session.tick = nextTick;
  return Object.freeze({
    tick: nextTick,
    commands: Object.freeze(processed.map(item => Object.freeze(item))),
    events: Object.freeze(events),
  });
}

export function commandAcknowledgement(session, playerId) {
  const player = session?.players?.get(playerId);
  if (!player) throw new RangeError(`Unknown session player ${playerId}`);
  return Object.freeze({
    playerId,
    serverTick: session.tick,
    lastProcessedCommand: player.lastProcessedCommand,
  });
}

export function snapshotSessionState(session) {
  return createSessionSnapshot(session);
}

export function hashLiveSessionState(session) {
  return hashSessionSnapshot(snapshotSessionState(session));
}

/**
 * Restore gameplay authority into an equivalently configured Battlefield.
 * Unacknowledged transport input is deliberately not restored; a client resends
 * commands after the last per-player acknowledgement in the snapshot.
 */
export function restoreSessionState(snapshot, {
  battlefield,
  mapDefinition = BRIARHOLD_FIRST_PERSON_MAP,
  commandQueueCapacity = DEFAULT_COMMAND_QUEUE_CAPACITY,
  resolveWeaponTuning = null,
} = {}) {
  const detached = cloneSessionSnapshot(snapshot);
  restoreBattlefieldCheckpoint(battlefield, detached.battlefield);
  const session = createSessionState({
    config: detached.config,
    tick: detached.tick,
    phase: detached.phase,
    eventSequence: detached.eventSequence,
    players: detached.players,
    weaponStates: detached.weaponStates,
    battlefield,
    mapDefinition,
    commandQueueCapacity,
    resolveWeaponTuning,
  });
  if (hashLiveSessionState(session) !== hashSessionSnapshot(detached)) {
    throw new Error('Restored SessionState does not match its canonical snapshot');
  }
  return session;
}

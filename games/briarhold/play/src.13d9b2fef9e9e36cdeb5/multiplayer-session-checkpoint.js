import {
  BATTLEFIELD_CHECKPOINT_VERSION,
  createBattlefieldCheckpoint,
  hashBattlefieldCheckpoint,
} from './battlefield-checkpoint.js';
import {
  NETWORK_PLAYER_STATE_VERSION,
  WEAPON_HEAT_SCALE,
  createNetworkPlayerState,
  createSessionConfig,
  createSessionWeaponState,
  isSessionPhase,
  networkPlayerStateFromPlayer,
  sessionWeaponStateFromPlayer,
} from './multiplayer-contracts.js';

export const SESSION_SNAPSHOT_VERSION = 2;

function integer(value, label, minimum = 0, maximum = 0xffffffff) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new RangeError(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return number;
}

function normalizePlayers(players) {
  let entries;
  if (players instanceof Map) {
    entries = [...players.entries()].map(([playerId, player]) => (
      player?.version === NETWORK_PLAYER_STATE_VERSION
        ? {...player, playerId}
        : networkPlayerStateFromPlayer(playerId, player)
    ));
  } else if (Array.isArray(players)) {
    entries = players;
  } else if (players && typeof players === 'object') {
    entries = Object.entries(players).map(([playerId, player]) => (
      player?.version === NETWORK_PLAYER_STATE_VERSION
        ? {...player, playerId}
        : networkPlayerStateFromPlayer(playerId, player)
    ));
  } else {
    throw new TypeError('SessionSnapshot.players must be an array, Map or keyed object');
  }

  const normalized = entries.map(createNetworkPlayerState)
    .sort((left, right) => (left.playerId < right.playerId ? -1 : left.playerId > right.playerId ? 1 : 0));
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1].playerId === normalized[index].playerId) {
      throw new RangeError(`Duplicate session player ${normalized[index].playerId}`);
    }
  }
  return Object.freeze(normalized);
}

function weaponEntries(weaponStates) {
  if (weaponStates instanceof Map) return [...weaponStates.entries()];
  if (Array.isArray(weaponStates)) return weaponStates.map(state => [state.playerId, state]);
  if (weaponStates && typeof weaponStates === 'object') return Object.entries(weaponStates);
  throw new TypeError('SessionSnapshot.weaponStates must be an array, Map or keyed object');
}

function normalizeWeaponStates(weaponStates, players) {
  const playerById = new Map(players.map(player => [player.playerId, player]));
  const entries = weaponStates === null || weaponStates === undefined
    ? players.map(player => [player.playerId, sessionWeaponStateFromPlayer(player.playerId, player)])
    : weaponEntries(weaponStates);
  const normalized = entries.map(([playerId, state]) => (
    createSessionWeaponState({...state, playerId})
  )).sort((left, right) => (left.playerId < right.playerId ? -1 : left.playerId > right.playerId ? 1 : 0));
  if (normalized.length !== players.length) {
    throw new RangeError('SessionSnapshot requires one weapon state per player');
  }
  for (let index = 0; index < normalized.length; index += 1) {
    const state = normalized[index];
    if (!playerById.has(state.playerId)) {
      throw new RangeError(`SessionSnapshot has weapon state for unknown player ${state.playerId}`);
    }
    if (playerById.get(state.playerId).activeWeapon !== state.selectedWeapon) {
      throw new RangeError(`SessionSnapshot weapon selection contradicts player ${state.playerId}`);
    }
    if (index > 0 && normalized[index - 1].playerId === state.playerId) {
      throw new RangeError(`Duplicate session weapon state ${state.playerId}`);
    }
  }
  return Object.freeze(normalized);
}

function projectWeaponState(players, weaponStates) {
  const weaponsByPlayer = new Map(weaponStates.map(state => [state.playerId, state]));
  return Object.freeze(players.map((player) => {
    const weapon = weaponsByPlayer.get(player.playerId);
    return createNetworkPlayerState({
      ...player,
      activeWeapon: weapon.selectedWeapon,
      heat: weapon.heatByWeapon.map(value => value / WEAPON_HEAT_SCALE),
    });
  }));
}

function cloneCheckpoint(checkpoint) {
  if (typeof structuredClone !== 'function') {
    throw new Error('Session checkpoints require the standard structuredClone API');
  }
  return structuredClone(checkpoint);
}

/**
 * Create one detached authority snapshot. It intentionally does not reuse or
 * alter RunStateV2: online session recovery and offline saves remain separate.
 */
export function createSessionSnapshot({
  config,
  tick = 0,
  phase,
  eventSequence = 0,
  players,
  weaponStates = null,
  battlefield,
} = {}) {
  if (!isSessionPhase(phase)) throw new RangeError(`SessionSnapshot phase ${phase} is unsupported`);
  if (!battlefield) throw new TypeError('SessionSnapshot requires a Battlefield');
  const normalizedConfig = createSessionConfig(config);
  let normalizedPlayers = normalizePlayers(players);
  const normalizedWeaponStates = normalizeWeaponStates(weaponStates, normalizedPlayers);
  normalizedPlayers = projectWeaponState(normalizedPlayers, normalizedWeaponStates);
  if (normalizedPlayers.length < 1 || normalizedPlayers.length > normalizedConfig.maxPlayers) {
    throw new RangeError('SessionSnapshot player count exceeds SessionConfig');
  }
  return Object.freeze({
    version: SESSION_SNAPSHOT_VERSION,
    config: normalizedConfig,
    tick: integer(tick, 'SessionSnapshot.tick'),
    phase,
    eventSequence: integer(eventSequence, 'SessionSnapshot.eventSequence'),
    players: normalizedPlayers,
    weaponStates: normalizedWeaponStates,
    battlefield: createBattlefieldCheckpoint(battlefield),
  });
}

class SessionHashWriter {
  constructor() {
    this.left = 0x811c9dc5;
    this.right = 0x9e3779b9;
    this.buffer = new ArrayBuffer(8);
    this.view = new DataView(this.buffer);
    this.bytes = new Uint8Array(this.buffer);
    this.encoder = new TextEncoder();
  }

  byte(value) {
    const byte = value & 0xff;
    this.left = Math.imul(this.left ^ byte, 0x01000193) >>> 0;
    this.right = Math.imul(this.right ^ byte, 0x85ebca6b) >>> 0;
  }

  bytesOf(bytes) {
    for (let index = 0; index < bytes.length; index += 1) this.byte(bytes[index]);
  }

  uint32(value) {
    this.view.setUint32(0, value >>> 0, true);
    this.bytesOf(this.bytes.subarray(0, 4));
  }

  number(value) {
    if (!Number.isFinite(value)) throw new TypeError('Canonical session numbers must be finite');
    this.view.setFloat64(0, Object.is(value, -0) ? 0 : value, true);
    this.bytesOf(this.bytes);
  }

  string(value) {
    const bytes = this.encoder.encode(value);
    this.uint32(bytes.length);
    this.bytesOf(bytes);
  }

  value(value) {
    if (value === null) {
      this.byte(0);
    } else if (typeof value === 'boolean') {
      this.byte(value ? 2 : 1);
    } else if (typeof value === 'number') {
      this.byte(3);
      this.number(value);
    } else if (typeof value === 'string') {
      this.byte(4);
      this.string(value);
    } else if (Array.isArray(value)) {
      this.byte(5);
      this.uint32(value.length);
      for (const item of value) this.value(item);
    } else if (value && typeof value === 'object') {
      this.byte(6);
      const keys = Object.keys(value).sort();
      this.uint32(keys.length);
      for (const key of keys) {
        this.string(key);
        this.value(value[key]);
      }
    } else {
      throw new TypeError(`Unsupported canonical session value: ${typeof value}`);
    }
  }

  digest() {
    return `${this.left.toString(16).padStart(8, '0')}${this.right.toString(16).padStart(8, '0')}`;
  }
}

function normalizeSnapshotForHash(snapshot) {
  if (!snapshot || snapshot.version !== SESSION_SNAPSHOT_VERSION) {
    throw new TypeError('Unsupported SessionSnapshot');
  }
  if (!snapshot.battlefield || snapshot.battlefield.version !== BATTLEFIELD_CHECKPOINT_VERSION) {
    throw new TypeError('SessionSnapshot has an unsupported Battlefield checkpoint');
  }
  if (!isSessionPhase(snapshot.phase)) throw new RangeError(`SessionSnapshot phase ${snapshot.phase} is unsupported`);
  const config = createSessionConfig(snapshot.config);
  let players = normalizePlayers(snapshot.players);
  const weaponStates = normalizeWeaponStates(snapshot.weaponStates, players);
  players = projectWeaponState(players, weaponStates);
  if (players.length < 1 || players.length > config.maxPlayers) {
    throw new RangeError('SessionSnapshot player count exceeds SessionConfig');
  }
  return {
    version: SESSION_SNAPSHOT_VERSION,
    config,
    tick: integer(snapshot.tick, 'SessionSnapshot.tick'),
    phase: snapshot.phase,
    eventSequence: integer(snapshot.eventSequence, 'SessionSnapshot.eventSequence'),
    players,
    weaponStates,
    battlefieldHash: hashBattlefieldCheckpoint(snapshot.battlefield),
  };
}

/** Stable cross-runtime hash of session scalars, Wardens and horde authority. */
export function hashSessionSnapshot(snapshot) {
  const writer = new SessionHashWriter();
  writer.string('briarhold-session-snapshot-v2');
  writer.value(normalizeSnapshotForHash(snapshot));
  return `ss2-${writer.digest()}`;
}

export function hashSessionState(session) {
  return hashSessionSnapshot(createSessionSnapshot(session));
}

/** Detached clone for future transport/storage adapters. */
export function cloneSessionSnapshot(snapshot) {
  normalizeSnapshotForHash(snapshot);
  return cloneCheckpoint(snapshot);
}

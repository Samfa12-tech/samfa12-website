import {
  MAX_COMMAND_LOOK_RADIANS_PER_TICK,
  PLAYER_COMMAND_ACTIONS,
  PLAYER_COMMAND_LOOK_QUANTIZATION,
  PLAYER_COMMAND_MOVE_QUANTIZATION,
  createNetworkPlayerState,
  createPlayerCommand,
} from './multiplayer-contracts.js';

export const COOP_PROTOCOL_VERSION = 1;
export const COOP_MAX_MESSAGE_BYTES = 64 * 1024;
export const COOP_SNAPSHOT_INTERVAL_TICKS = 2;

export const COOP_MESSAGE_KINDS = Object.freeze({
  HELLO: 'hello',
  COMMAND: 'command',
  SESSION_FRAME: 'session_frame',
  SESSION_ENDED: 'session_ended',
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finite(value)));
}

function quantize(value, scale) {
  return Math.round(clamp(value, -1, 1) * scale);
}

function actionMask(frame) {
  let actions = 0;
  if (frame?.fire === true) actions |= PLAYER_COMMAND_ACTIONS.FIRE;
  if (frame?.interact === true) actions |= PLAYER_COMMAND_ACTIONS.INTERACT;
  if (frame?.sprint === true) actions |= PLAYER_COMMAND_ACTIONS.SPRINT;
  if (frame?.jump === true) actions |= PLAYER_COMMAND_ACTIONS.JUMP;
  if (frame?.slide === true) actions |= PLAYER_COMMAND_ACTIONS.SLIDE;
  if (frame?.melee === true) actions |= PLAYER_COMMAND_ACTIONS.MELEE;
  return actions;
}

/** Convert the device-neutral live InputFrame into one strict network intent. */
export function playerCommandFromInputFrame({
  frame,
  sequence,
  intendedTick,
  acknowledgedServerTick = null,
} = {}) {
  return createPlayerCommand({
    sequence,
    intendedTick,
    acknowledgedServerTick,
    move: {
      x: quantize(frame?.move?.x, PLAYER_COMMAND_MOVE_QUANTIZATION),
      y: quantize(frame?.move?.y, PLAYER_COMMAND_MOVE_QUANTIZATION),
    },
    look: {
      yaw: quantize(
        finite(frame?.look?.yaw) / MAX_COMMAND_LOOK_RADIANS_PER_TICK,
        PLAYER_COMMAND_LOOK_QUANTIZATION,
      ),
      pitch: quantize(
        finite(frame?.look?.pitch) / MAX_COMMAND_LOOK_RADIANS_PER_TICK,
        PLAYER_COMMAND_LOOK_QUANTIZATION,
      ),
    },
    actions: actionMask(frame),
    selectedWeapon: frame?.selectedWeapon ?? null,
    aiming: frame?.aiming === true,
    manualVent: frame?.manualVent === true,
  });
}

export function createCoopHello({role, playerId, buildHash, contentHash} = {}) {
  if (!['host', 'guest'].includes(role)) throw new RangeError('Co-op hello role is unsupported');
  for (const [label, value] of Object.entries({playerId, buildHash, contentHash})) {
    if (typeof value !== 'string' || value.length < 1 || value.length > 128) {
      throw new TypeError(`Co-op hello ${label} must be a short string`);
    }
  }
  return Object.freeze({
    version: COOP_PROTOCOL_VERSION,
    kind: COOP_MESSAGE_KINDS.HELLO,
    role,
    playerId,
    buildHash,
    contentHash,
  });
}

export function createCoopCommandMessage(command) {
  return Object.freeze({
    version: COOP_PROTOCOL_VERSION,
    kind: COOP_MESSAGE_KINDS.COMMAND,
    command: createPlayerCommand(command),
  });
}

/**
 * A guest's clock is advisory. Browser background throttling can leave its
 * intended tick far behind the host, so the authority admits the newest input
 * on its own next tick while preserving the guest's bounded intent/sequence.
 */
export function rebasePlayerCommandForAuthority(command, authorityTick) {
  if (!Number.isInteger(authorityTick) || authorityTick < 0) {
    throw new RangeError('Authority tick is invalid');
  }
  const input = createPlayerCommand(command);
  return createPlayerCommand({
    ...input,
    intendedTick: authorityTick + 1,
    acknowledgedServerTick: authorityTick,
  });
}

export function createCoopSessionFrame({tick, players, events = []} = {}) {
  if (!Number.isInteger(tick) || tick < 0) throw new RangeError('Co-op frame tick is invalid');
  if (!Array.isArray(players) || players.length < 1 || players.length > 4) {
    throw new RangeError('Co-op frame requires one to four players');
  }
  if (!Array.isArray(events) || events.length > 128) throw new RangeError('Co-op frame events are invalid');
  const normalizedPlayers = players
    .map(createNetworkPlayerState)
    .sort((left, right) => left.playerId.localeCompare(right.playerId, 'en-US'));
  const frame = Object.freeze({
    version: COOP_PROTOCOL_VERSION,
    kind: COOP_MESSAGE_KINDS.SESSION_FRAME,
    tick,
    players: Object.freeze(normalizedPlayers),
    events: Object.freeze(events.map(event => Object.freeze({...event}))),
  });
  if (encodedMessageBytes(frame) > COOP_MAX_MESSAGE_BYTES) {
    throw new RangeError('Co-op session frame exceeds the message limit');
  }
  return frame;
}

export function encodedMessageBytes(message) {
  return new TextEncoder().encode(JSON.stringify(message)).byteLength;
}

/** Strictly admit only the small message subset used by the movement alpha. */
export function normalizeCoopMessage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Co-op message must be an object');
  }
  if (value.version !== COOP_PROTOCOL_VERSION) throw new RangeError('Co-op protocol version is unsupported');
  if (encodedMessageBytes(value) > COOP_MAX_MESSAGE_BYTES) throw new RangeError('Co-op message exceeds the limit');
  switch (value.kind) {
    case COOP_MESSAGE_KINDS.HELLO:
      return createCoopHello(value);
    case COOP_MESSAGE_KINDS.COMMAND:
      return createCoopCommandMessage(value.command);
    case COOP_MESSAGE_KINDS.SESSION_FRAME:
      return createCoopSessionFrame(value);
    case COOP_MESSAGE_KINDS.SESSION_ENDED:
      return Object.freeze({
        version: COOP_PROTOCOL_VERSION,
        kind: COOP_MESSAGE_KINDS.SESSION_ENDED,
        reason: String(value.reason ?? 'host_left').slice(0, 128),
      });
    default:
      throw new RangeError(`Co-op message kind ${value.kind} is unsupported`);
  }
}

/** Apply authority to the existing mutable local Warden presentation state. */
export function applyNetworkPlayerState(target, networkState) {
  const state = createNetworkPlayerState(networkState);
  target.position.x = state.position.x;
  target.position.y = state.position.y;
  target.position.z = state.position.z;
  target.velocity.x = state.velocity.x;
  target.velocity.y = state.velocity.y;
  target.velocity.z = state.velocity.z;
  target.facing.yaw = state.facing.yaw;
  target.facing.pitch = state.facing.pitch;
  target.grounded = state.grounded;
  target.eyeHeight = state.eyeHeight;
  target.hp = state.hp;
  target.maxHp = state.maxHp;
  target.activeWeapon = state.activeWeapon;
  target.heat = [...state.heat];
  target.healAvailable = state.healAvailable;
  target.damageCooldown = state.damageCooldown;
  // Unsupported traversal is never reconstructed approximately.
  target.sliding = state.traversal === 'sliding';
  target.mantleState = null;
  return target;
}

// The movement preview above remains on its v1 DTOs.  The production co-op
// transport can import the strict v4 wire surface from this module without
// coupling the preview to checkpoint/world serialization.
export {
  COOP_WIRE_PROTOCOL_VERSION,
  COOP_WIRE_MESSAGE_KINDS,
  COOP_ACTIONS,
  COOP_ACTION_REJECTION_CODES,
  COOP_CONTROL_CHUNK_MAX_BYTES,
  CheckpointAssembler,
  CoopActionRequestLedger,
  coerceCoopActionRejectionCode,
  createCoopActionAck,
  createCoopActionRequest,
  createCoopAuthorityPaused,
  createCoopAuthorityResumed,
  createCoopCheckpointApplied,
  createCoopCheckpointChunks,
  createCoopCheckpointOffer,
  createCoopCommandV2,
  createCoopHelloV2,
  createCoopHelloV3,
  createCoopHelloV4,
  createCoopResume,
  createCoopSessionEnded,
  createCoopWorldFrame,
  decodeCheckpoint,
  encodeCheckpoint,
  encodedWireBytes,
  normalizeCoopWireMessage,
  wireMessageForDiagnostics,
} from './coop-world-wire.js';

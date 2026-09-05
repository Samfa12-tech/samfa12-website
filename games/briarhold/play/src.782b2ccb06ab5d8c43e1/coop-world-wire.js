import {createNetworkPlayerState, createPlayerCommand, isSessionPhase} from './multiplayer-contracts.js';
import {BOSS_ENCOUNTER_DEFINITIONS} from './boss-director.js';

export const COOP_WIRE_PROTOCOL_VERSION = 4;
export const COOP_MAX_MESSAGE_BYTES = 64 * 1024;
export const COOP_MAX_CHECKPOINT_BYTES = 2 * 1024 * 1024;
// Control-channel chunks leave room for the JSON envelope and base64 overhead.
export const COOP_CONTROL_CHUNK_MAX_BYTES = 48 * 1024;
// Base64 expands 12 KiB to exactly the transport's 16 KiB per-string cap.
// The surrounding control envelope remains comfortably below 64 KiB.
const CHECKPOINT_CHUNK_DATA_BYTES = 12 * 1024;
const CHECKPOINT_CHUNK_BASE64_CHARS = Math.ceil(CHECKPOINT_CHUNK_DATA_BYTES / 3) * 4 + 4;

export const COOP_WIRE_MESSAGE_KINDS = Object.freeze({
  HELLO: 'hello',
  COMMAND: 'command',
  ACTION_REQUEST: 'action_request',
  ACTION_ACK: 'action_ack',
  WORLD_FRAME: 'world_frame',
  CHECKPOINT_OFFER: 'checkpoint_offer',
  CHECKPOINT_CHUNK: 'checkpoint_chunk',
  CHECKPOINT_APPLIED: 'checkpoint_applied',
  RESUME: 'resume',
  AUTHORITY_PAUSED: 'authority_paused',
  AUTHORITY_RESUMED: 'authority_resumed',
  SESSION_ENDED: 'session_ended',
});

export const COOP_ACTIONS = Object.freeze([
  'build', 'repair_gate',
  'choose_boon', 'restore_defences', 'npc_action', 'ward_light', 'revive',
  'manual_vent', 'npc_interaction', 'scene_advance', 'scene_response', 'scene_skip',
  'goal_accept', 'goal_report', 'daywork', 'medicine_prepare', 'medicine_consume',
  'bell_confirm', 'goals_panel', 'service_request',
]);

export const COOP_ACTION_REJECTION_CODES = Object.freeze([
  'action_not_available', 'actor_unavailable', 'boon_not_available', 'build_rejected',
  'build_socket_out_of_range', 'host_not_ready', 'host_only_action', 'invalid_request',
  'manual_vent_rejected', 'mason_out_of_range', 'mason_unavailable', 'medicine_actor_mismatch',
  'medicine_out_of_range', 'npc_fallen', 'npc_out_of_range', 'npc_service_unavailable',
  'npc_unavailable', 'repair_rejected', 'revive_not_available', 'revive_rejected',
  'revive_target_out_of_range', 'shared_scene_not_available', 'stale_request', 'stale_scene',
  'trapper_out_of_range', 'trapper_unavailable', 'unknown_actor', 'unsupported_action',
  'ward_light_not_available', 'ward_light_rejected', 'ward_light_target_missing',
  'ward_light_wrong_phase', 'wrong_phase',
]);
const COOP_ACTION_REJECTION_CODE_SET = new Set(COOP_ACTION_REJECTION_CODES);

export function coerceCoopActionRejectionCode(value) {
  const message = typeof value === 'string' ? value : String(value?.message ?? '');
  if (COOP_ACTION_REJECTION_CODE_SET.has(message)) return message;
  if (/host authority|host.only/u.test(message)) return 'host_only_action';
  if (/stale.*scene|scene.*beat/u.test(message)) return 'stale_scene';
  if (/stale|replay|ordinal|night/u.test(message)) return 'stale_request';
  if (/out.of.range|range/u.test(message)) return 'npc_out_of_range';
  if (/only during|wrong.phase|phase/u.test(message)) return 'wrong_phase';
  if (/service/u.test(message)) return 'npc_service_unavailable';
  return 'invalid_request';
}

const ACTION_FIELDS = Object.freeze({
  build: ['fortificationType', 'socketId'],
  repair_gate: ['gateId'],
  choose_boon: ['boonId'],
  restore_defences: [],
  npc_action: ['npcId', 'actionId'],
  ward_light: ['actorId'],
  revive: ['targetPlayerId'],
  manual_vent: [],
  npc_interaction: ['npcId', 'runOrdinal', 'night'],
  scene_advance: ['sceneId', 'beatIndex', 'runOrdinal', 'night'],
  scene_response: ['sceneId', 'beatIndex', 'responseId', 'runOrdinal', 'night'],
  scene_skip: ['sceneId', 'beatIndex', 'runOrdinal', 'night'],
  goal_accept: ['npcId', 'goalId', 'eventId', 'runOrdinal', 'night'],
  goal_report: ['npcId', 'goalId', 'eventId', 'runOrdinal', 'night'],
  daywork: ['npcId', 'actionId', 'targetId', 'requestId', 'runOrdinal', 'night'],
  medicine_prepare: ['npcId', 'requestId', 'runOrdinal', 'night'],
  medicine_consume: ['actorId', 'requestId', 'runOrdinal', 'night'],
  bell_confirm: ['briefingSceneId', 'confirmationId', 'runOrdinal', 'night'],
  goals_panel: ['npcId', 'runOrdinal', 'night'],
  service_request: ['npcId', 'serviceId', 'runOrdinal', 'night'],
});

const ACTION_REQUEST_KEYS = new Set(['version', 'kind', 'requestId', 'peerId', 'stream', 'sequence', 'action', 'payload', 'clientTick']);
const ACTION_ACK_KEYS = new Set(['version', 'kind', 'requestId', 'action', 'status', 'reason', 'result', 'authoritativeTick']);

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function exactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`${label}.${key} is not part of co-op wire v4 protocol`);
}

function integer(value, label, minimum = 0, maximum = 0xffffffff) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new RangeError(`${label} must be an integer between ${minimum} and ${maximum}`);
  return value;
}

function exactBoolean(value, label) {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be a boolean`);
  return value;
}

function finite(value, label, minimum = -1_000_000, maximum = 1_000_000) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new RangeError(`${label} must be finite and bounded`);
  return Math.fround(value);
}

function shortString(value, label, maximum = 128) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum) throw new TypeError(`${label} must be a short string`);
  return value;
}

function stableId(value, label) {
  const text = shortString(value, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:+-]{0,127}$/u.test(text)) throw new TypeError(`${label} is not a stable identifier`);
  return text;
}

function protocol(value, kind) {
  if (value !== undefined && value !== COOP_WIRE_PROTOCOL_VERSION) throw new RangeError(`${kind} protocol version is unsupported`);
  return COOP_WIRE_PROTOCOL_VERSION;
}

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function encodedWireBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function boundedMessage(value, label = 'Co-op wire message') {
  if (encodedWireBytes(value) > COOP_MAX_MESSAGE_BYTES) throw new RangeError(`${label} exceeds the 64KiB message limit`);
  return freeze(value);
}

function normalizeHello(value) {
  const input = record(value, 'Co-op hello');
  exactKeys(input, new Set(['version', 'kind', 'role', 'playerId', 'buildHash', 'contentHash']), 'Co-op hello');
  if (input.kind !== COOP_WIRE_MESSAGE_KINDS.HELLO) throw new RangeError('Co-op hello kind is unsupported');
  if (!['host', 'guest'].includes(input.role)) throw new RangeError('Co-op hello role is unsupported');
  return boundedMessage({version: protocol(input.version, 'hello'), kind: input.kind, role: input.role,
    playerId: stableId(input.playerId, 'Co-op hello playerId'), buildHash: shortString(input.buildHash, 'Co-op hello buildHash'),
    contentHash: shortString(input.contentHash, 'Co-op hello contentHash')});
}

export function createCoopHelloV4(value = {}) {
  return normalizeHello({...value, version: value.version ?? COOP_WIRE_PROTOCOL_VERSION, kind: value.kind ?? COOP_WIRE_MESSAGE_KINDS.HELLO});
}

// Compatibility names retained for source callers. They create the current
// v4 hello; an actual v2/v3 packet is still rejected by normalizeCoopWireMessage.
export const createCoopHelloV3 = createCoopHelloV4;
export const createCoopHelloV2 = createCoopHelloV4;

export function createCoopCommandV2(command) {
  return boundedMessage({version: COOP_WIRE_PROTOCOL_VERSION, kind: COOP_WIRE_MESSAGE_KINDS.COMMAND, command: createPlayerCommand(command)});
}

function normalizeActionPayload(action, payload) {
  if (!COOP_ACTIONS.includes(action)) throw new RangeError(`Co-op action ${action} is unsupported`);
  const input = record(payload, `${action} payload`);
  const fields = ACTION_FIELDS[action];
  exactKeys(input, new Set(fields), `${action} payload`);
  const output = {};
  for (const field of fields) {
    if (field === 'night') output[field] = integer(input[field], `${action}.${field}`, 1, 7);
    else if (field === 'runOrdinal') output[field] = integer(input[field], `${action}.${field}`, 1);
    else if (field === 'beatIndex') output[field] = integer(input[field], `${action}.${field}`, 0, 1024);
    else if (field === 'targetId' && input[field] === null) output[field] = null;
    else output[field] = stableId(input[field], `${action}.${field}`);
  }
  return output;
}

export function createCoopActionRequest(value = {}) {
  const input = record(value, 'Co-op action request');
  exactKeys(input, ACTION_REQUEST_KEYS, 'Co-op action request');
  const output = {version: protocol(input.version, 'action_request'), kind: COOP_WIRE_MESSAGE_KINDS.ACTION_REQUEST,
    requestId: stableId(input.requestId, 'Co-op action request requestId'),
    peerId: stableId(input.peerId, 'Co-op action request peerId'),
    stream: stableId(input.stream, 'Co-op action request stream'),
    sequence: integer(input.sequence, 'Co-op action request sequence'), action: input.action,
    payload: normalizeActionPayload(input.action, input.payload), clientTick: input.clientTick == null ? null : integer(input.clientTick, 'action request clientTick')};
  if (output.requestId !== `${output.peerId}:${output.stream}:${output.sequence}`) {
    throw new RangeError('Co-op action requestId must match peer, stream and sequence');
  }
  return boundedMessage(output);
}

export function createCoopActionAck(value = {}) {
  const input = record(value, 'Co-op action ack');
  exactKeys(input, ACTION_ACK_KEYS, 'Co-op action ack');
  if (!['accepted', 'rejected', 'duplicate'].includes(input.status)) throw new RangeError('Co-op action ack status is unsupported');
  if (input.result != null) throw new TypeError('Co-op action ack result must be null; authority is published by world frames');
  const result = null;
  const reason = input.reason == null ? null : shortString(input.reason, 'Co-op action ack reason', 64);
  if (input.status === 'rejected' && !COOP_ACTION_REJECTION_CODE_SET.has(reason)) {
    throw new RangeError('Co-op action ack rejection reason code is unsupported');
  }
  if (input.status !== 'rejected' && reason !== null) {
    throw new RangeError('Co-op action ack reason is only valid for a rejection');
  }
  const output = {version: protocol(input.version, 'action_ack'), kind: COOP_WIRE_MESSAGE_KINDS.ACTION_ACK,
    requestId: stableId(input.requestId, 'Co-op action ack requestId'), action: input.action,
    status: input.status, reason,
    result, authoritativeTick: input.authoritativeTick == null ? null : integer(input.authoritativeTick, 'Co-op action ack authoritativeTick')};
  if (!COOP_ACTIONS.includes(output.action)) throw new RangeError('Co-op action ack action is unsupported');
  return boundedMessage(output);
}

/**
 * Host-side idempotency boundary. A request ID may be replayed, but it may
 * never be reused for a different semantic payload.
 */
export class CoopActionRequestLedger {
  constructor({maxEntries = 2048, peerId = null, requestPrefix = null} = {}) {
    this.maxEntries = integer(maxEntries, 'action ledger maxEntries', 1, 65536);
    this.peerId = peerId ?? requestPrefix;
    this.peerId = this.peerId === null ? null : stableId(this.peerId, 'action ledger peerId');
    this.streams = new Map();
    this.entries = new Map();
  }

  execute(request, handler) {
    const normalized = createCoopActionRequest(request);
    if (this.peerId !== null && normalized.peerId !== this.peerId) throw new RangeError('action request belongs to an unexpected peer');
    const fingerprint = JSON.stringify(normalized);
    const previous = this.entries.get(normalized.requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new RangeError('action requestId is already used for a conflicting request');
      return previous.ack;
    }
    const streamKey = `${normalized.peerId}:${normalized.stream}`;
    const highestSequence = this.streams.get(streamKey) ?? -1;
    if (normalized.sequence <= highestSequence) throw new RangeError('action requestId is stale or replayed in its stream');
    if (typeof handler !== 'function') throw new TypeError('action ledger handler must be a function');
    const ack = createCoopActionAck(handler(normalized));
    this.streams.set(streamKey, normalized.sequence);
    if (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value);
    this.entries.set(normalized.requestId, {peerId: normalized.peerId, stream: normalized.stream, sequence: normalized.sequence, fingerprint, ack});
    return ack;
  }

  has(requestId) { return this.entries.has(requestId); }

  snapshot() {
    const streams = [...this.streams.entries()].sort(([left], [right]) => left.localeCompare(right, 'en-US')).map(([key, highestSequence]) => {
      const separator = key.indexOf(':');
      const peerId = key.slice(0, separator);
      const stream = key.slice(separator + 1);
      const entries = [...this.entries.entries()]
        .filter(([, entry]) => entry.peerId === peerId && entry.stream === stream)
        .map(([requestId, entry]) => ({requestId, fingerprint: entry.fingerprint, ack: entry.ack}));
      return {peerId, stream, highestSequence, entries};
    });
    return freeze({version: 1, streams});
  }

  static restore(snapshot, options = {}) {
    const input = record(snapshot, 'action ledger snapshot');
    exactKeys(input, new Set(['version', 'streams']), 'action ledger snapshot');
    if (input.version !== 1 || !Array.isArray(input.streams) || input.streams.length > 16) throw new RangeError('action ledger snapshot is unsupported');
    const peerIds = new Set(input.streams.map(stream => stream?.peerId));
    const ledger = new CoopActionRequestLedger({...options, peerId: options.peerId ?? (peerIds.size === 1 ? [...peerIds][0] : null)});
    for (const value of input.streams) {
      const stream = record(value, 'action ledger stream');
      exactKeys(stream, new Set(['peerId', 'stream', 'highestSequence', 'entries']), 'action ledger stream');
      const peerId = stableId(stream.peerId, 'action ledger stream peerId');
      const streamId = stableId(stream.stream, 'action ledger stream id');
      const highestSequence = integer(stream.highestSequence, 'action ledger highestSequence', -1);
      if (!Array.isArray(stream.entries) || stream.entries.length > ledger.maxEntries) throw new RangeError('action ledger entries are invalid');
      const streamKey = `${peerId}:${streamId}`;
      if (ledger.streams.has(streamKey)) throw new RangeError('action ledger stream is duplicated');
      ledger.streams.set(streamKey, highestSequence);
      for (const item of stream.entries) {
        const entry = record(item, 'action ledger entry');
        exactKeys(entry, new Set(['requestId', 'fingerprint', 'ack']), 'action ledger entry');
        const requestId = stableId(entry.requestId, 'action ledger requestId');
        const fingerprint = shortString(entry.fingerprint, 'action ledger fingerprint', 4096);
        const ack = createCoopActionAck(entry.ack);
        if (ledger.entries.has(requestId)) throw new RangeError('action ledger requestId is duplicated');
        let request;
        try { request = createCoopActionRequest(JSON.parse(fingerprint)); }
        catch { throw new RangeError('action ledger fingerprint is invalid'); }
        if (request.requestId !== requestId || request.peerId !== peerId || request.stream !== streamId || request.sequence > highestSequence) {
          throw new RangeError('action ledger fingerprint contradicts its stream');
        }
        ledger.entries.set(requestId, {peerId, stream: streamId, sequence: request.sequence, fingerprint, ack});
      }
    }
    return ledger;
  }

  clear() { this.entries.clear(); this.streams.clear(); }
}

function normalizeEnemyTuple(tuple, index) {
  if (!Array.isArray(tuple) || tuple.length !== 7) throw new TypeError(`world frame enemy tuple ${index} must contain exactly seven fields`);
  const [id, type, x, z, yaw, state, hp] = tuple;
  if (!Number.isInteger(id) || id < 0) throw new RangeError(`world frame enemy tuple ${index} id is invalid`);
  if (!['active', 'dying', 'dead'].includes(state)) throw new RangeError(`world frame enemy tuple ${index} state is invalid`);
  return [id, stableId(type, `world frame enemy tuple ${index} type`), finite(x, 'enemy.x'), finite(z, 'enemy.z'), finite(yaw, 'enemy.yaw', -Math.PI * 2, Math.PI * 2), state, finite(hp, 'enemy.hp', 0, 1_000_000)];
}

function normalizeGate(value, index) {
  const input = record(value, `world frame gate ${index}`);
  exactKeys(input, new Set(['id', 'integrity', 'maxIntegrity', 'destroyed']), `world frame gate ${index}`);
  const maxIntegrity = finite(input.maxIntegrity, 'gate.maxIntegrity', 0.001, 1_000_000);
  const integrity = finite(input.integrity, 'gate.integrity', 0, maxIntegrity);
  return {id: stableId(input.id, 'gate.id'), integrity, maxIntegrity, destroyed: exactBoolean(input.destroyed, 'gate.destroyed')};
}

function normalizeFortification(value, index) {
  const input = record(value, `world frame fortification ${index}`);
  exactKeys(input, new Set(['id', 'type', 'integrity', 'maxIntegrity']), `world frame fortification ${index}`);
  const maxIntegrity = finite(input.maxIntegrity, 'fortification.maxIntegrity', 0.001, 1_000_000);
  return {id: stableId(input.id, 'fortification.id'), type: stableId(input.type, 'fortification.type'), integrity: finite(input.integrity, 'fortification.integrity', 0, maxIntegrity), maxIntegrity};
}

function normalizeHub(value) {
  const input = record(value, 'world frame hub');
  exactKeys(input, new Set(['phase', 'npcs']), 'world frame hub');
  if (!isSessionPhase(input.phase)) throw new RangeError('world frame hub phase is unsupported');
  if (!Array.isArray(input.npcs) || input.npcs.length > 64) throw new RangeError('world frame hub NPC list is invalid');
  const npcs = input.npcs.map((npc, index) => {
    const item = record(npc, `world frame NPC ${index}`);
    exactKeys(item, new Set(['id', 'state', 'serviceId']), `world frame NPC ${index}`);
    return {id: stableId(item.id, 'NPC.id'), state: stableId(item.state, 'NPC.state'), serviceId: stableId(item.serviceId, 'NPC.serviceId')};
  });
  return {phase: input.phase, npcs};
}

function normalizeCrowd(value) {
  const input = record(value, 'world frame crowd');
  exactKeys(input, new Set(['total', 'active', 'dying', 'dead', 'released', 'unreleased', 'cohort']), 'world frame crowd');
  const total = integer(input.total, 'world frame crowd total', 0, 6000);
  const active = integer(input.active, 'world frame crowd active', 0, total);
  const dying = integer(input.dying, 'world frame crowd dying', 0, total);
  const dead = integer(input.dead, 'world frame crowd dead', 0, total);
  const released = integer(input.released, 'world frame crowd released', 0, total);
  const unreleased = integer(input.unreleased, 'world frame crowd unreleased', 0, total);
  if (active + dying + dead !== total || released + unreleased !== total) {
    throw new RangeError('world frame crowd aggregate counts must equal total');
  }
  if (!Array.isArray(input.cohort) || input.cohort.length > 192) throw new RangeError('world frame crowd cohort exceeds the 192-body cap');
  const cohort = input.cohort.map(normalizeEnemyTuple);
  if (new Set(cohort.map(tuple => tuple[0])).size !== cohort.length) throw new RangeError('world frame crowd cohort has duplicate stable IDs');
  if (cohort.some(tuple => tuple[0] >= total)) throw new RangeError('world frame crowd cohort stable ID exceeds total');
  return {total, active, dying, dead, released, unreleased, cohort};
}

function normalizeBossVector(value, label) {
  const input = record(value, label);
  exactKeys(input, new Set(['x', 'y', 'z']), label);
  return {x: finite(input.x, `${label}.x`), y: finite(input.y, `${label}.y`), z: finite(input.z, `${label}.z`)};
}

function normalizeNullableFinite(value, label, minimum = -1_000_000, maximum = 1_000_000) {
  return value === null ? null : finite(value, label, minimum, maximum);
}

const BOSS_VOLUME_KEYS = new Set(['id', 'actorId', 'kind', 'targetId', 'x', 'z', 'heading', 'radius', 'width', 'length', 'untilMs', 'activeAtMs', 'expiresAtMs', 'visible', 'active', 'damaging']);

function normalizeBossVolume(value, index, prefix = 'volume') {
  const label = `world frame boss ${prefix} ${index}`;
  const input = record(value, label);
  exactKeys(input, BOSS_VOLUME_KEYS, label);
  return {
    id: stableId(input.id, `${label}.id`), actorId: stableId(input.actorId, `${label}.actorId`),
    kind: stableId(input.kind, `${label}.kind`), targetId: input.targetId === null ? null : stableId(input.targetId, `${label}.targetId`),
    x: normalizeNullableFinite(input.x, `${label}.x`), z: normalizeNullableFinite(input.z, `${label}.z`),
    heading: normalizeNullableFinite(input.heading, `${label}.heading`, -Math.PI * 8, Math.PI * 8),
    radius: normalizeNullableFinite(input.radius, `${label}.radius`, 0, 100),
    width: normalizeNullableFinite(input.width, `${label}.width`, 0, 200), length: normalizeNullableFinite(input.length, `${label}.length`, 0, 400),
    untilMs: normalizeNullableFinite(input.untilMs, `${label}.untilMs`, 0, Number.MAX_SAFE_INTEGER),
    activeAtMs: normalizeNullableFinite(input.activeAtMs, `${label}.activeAtMs`, 0, Number.MAX_SAFE_INTEGER),
    expiresAtMs: normalizeNullableFinite(input.expiresAtMs, `${label}.expiresAtMs`, 0, Number.MAX_SAFE_INTEGER),
    visible: exactBoolean(input.visible, `${label}.visible`), active: exactBoolean(input.active, `${label}.active`),
    damaging: exactBoolean(input.damaging, `${label}.damaging`),
  };
}

function normalizeBossActor(value, index) {
  const label = `world frame boss actor ${index}`;
  const input = record(value, label);
  exactKeys(input, new Set(['id', 'title', 'position', 'previousPosition', 'velocity', 'heading', 'radius', 'hp', 'maxHp', 'phase', 'state', 'cooldownRemainingMs', 'telegraphUntilMs', 'vulnerableUntilMs', 'regenerationInterruptedUntilMs', 'hitUntilMs', 'defeatedAtMs', 'presentationUntilMs', 'livingMossguards', 'target', 'hitVolumes', 'animationState', 'flying', 'defeated']), label);
  const maxHp = finite(input.maxHp, `${label}.maxHp`, 0.001, 10_000_000);
  const target = record(input.target, `${label}.target`);
  exactKeys(target, new Set(['id', 'x', 'z']), `${label}.target`);
  if (!Array.isArray(input.hitVolumes) || input.hitVolumes.length > 4) throw new RangeError(`${label}.hitVolumes is invalid`);
  return {
    id: stableId(input.id, `${label}.id`), title: shortString(input.title, `${label}.title`, 128),
    position: normalizeBossVector(input.position, `${label}.position`),
    previousPosition: normalizeBossVector(input.previousPosition, `${label}.previousPosition`),
    velocity: normalizeBossVector(input.velocity, `${label}.velocity`),
    heading: finite(input.heading, `${label}.heading`, -Math.PI * 8, Math.PI * 8),
    radius: finite(input.radius, `${label}.radius`, 0.1, 100),
    hp: finite(input.hp, `${label}.hp`, 0, maxHp), maxHp,
    phase: integer(input.phase, `${label}.phase`, 1, 4), state: stableId(input.state, `${label}.state`),
    cooldownRemainingMs: finite(input.cooldownRemainingMs, `${label}.cooldownRemainingMs`, 0, 3_600_000),
    telegraphUntilMs: finite(input.telegraphUntilMs, `${label}.telegraphUntilMs`, 0, Number.MAX_SAFE_INTEGER),
    vulnerableUntilMs: finite(input.vulnerableUntilMs, `${label}.vulnerableUntilMs`, 0, Number.MAX_SAFE_INTEGER),
    regenerationInterruptedUntilMs: finite(input.regenerationInterruptedUntilMs, `${label}.regenerationInterruptedUntilMs`, 0, Number.MAX_SAFE_INTEGER),
    hitUntilMs: finite(input.hitUntilMs, `${label}.hitUntilMs`, 0, Number.MAX_SAFE_INTEGER),
    defeatedAtMs: finite(input.defeatedAtMs, `${label}.defeatedAtMs`, 0, Number.MAX_SAFE_INTEGER),
    presentationUntilMs: finite(input.presentationUntilMs, `${label}.presentationUntilMs`, 0, Number.MAX_SAFE_INTEGER),
    livingMossguards: integer(input.livingMossguards, `${label}.livingMossguards`, 0, 3),
    target: {id: target.id === null ? null : stableId(target.id, `${label}.target.id`), x: normalizeNullableFinite(target.x, `${label}.target.x`), z: normalizeNullableFinite(target.z, `${label}.target.z`)},
    hitVolumes: input.hitVolumes.map((volume, volumeIndex) => normalizeBossVolume(volume, volumeIndex, `actor ${index} volume`)),
    animationState: stableId(input.animationState, `${label}.animationState`),
    flying: exactBoolean(input.flying, `${label}.flying`),
    defeated: exactBoolean(input.defeated, `${label}.defeated`),
  };
}

function normalizeBossZone(value, index) {
  return normalizeBossVolume(value, index, 'zone');
}

function normalizeBoss(value) {
  if (value === null) return null;
  const input = record(value, 'world frame boss');
  exactKeys(input, new Set(['mode', 'encounterId', 'label', 'status', 'eventSequence', 'timeMs', 'actors', 'hitVolumes', 'zones']), 'world frame boss');
  if (input.mode !== 'authored-director') throw new RangeError('world frame boss mode is unsupported');
  if (!['waiting', 'active', 'defeated'].includes(input.status)) throw new RangeError('world frame boss status is unsupported');
  if (!Array.isArray(input.actors) || input.actors.length < 1 || input.actors.length > 2) throw new RangeError('world frame boss actor count is invalid');
  if (!Array.isArray(input.hitVolumes) || input.hitVolumes.length > 16) throw new RangeError('world frame boss hit volume count is invalid');
  if (!Array.isArray(input.zones) || input.zones.length > 8) throw new RangeError('world frame boss zone count is invalid');
  const actors = input.actors.map(normalizeBossActor);
  if (new Set(actors.map(actor => actor.id)).size !== actors.length) throw new RangeError('world frame boss actors are duplicated');
  const definition = BOSS_ENCOUNTER_DEFINITIONS[input.encounterId];
  if (!definition || definition.actors.length !== actors.length
    || definition.actors.some(expected => !actors.some(actor => actor.id === expected.id))) {
    throw new RangeError('world frame boss actors contradict the encounter');
  }
  const hitVolumes = input.hitVolumes.map((volume, index) => normalizeBossVolume(volume, index, 'hit volume'));
  const zones = input.zones.map(normalizeBossZone);
  if ([...hitVolumes, ...zones].some(zone => !actors.some(actor => actor.id === zone.actorId))) throw new RangeError('world frame boss volume has an unknown actor');
  return {mode: 'authored-director', encounterId: stableId(input.encounterId, 'world frame boss encounterId'), label: shortString(input.label, 'world frame boss label', 128), status: input.status,
    eventSequence: integer(input.eventSequence, 'world frame boss eventSequence'), timeMs: integer(input.timeMs, 'world frame boss timeMs'), actors, hitVolumes, zones};
}

function normalizeObjective(value) {
  if (value === null) return null;
  const input = record(value, 'world frame objective');
  exactKeys(input, new Set(['night', 'id', 'label', 'status', 'durability', 'maxDurability', 'evidenceHash']), 'world frame objective');
  if (!['active', 'succeeded', 'failed'].includes(input.status)) throw new RangeError('world frame objective status is unsupported');
  const maxDurability = finite(input.maxDurability, 'world frame objective maxDurability', 0, 1_000_000);
  return {night: integer(input.night, 'world frame objective night', 1, 7), id: stableId(input.id, 'world frame objective id'),
    label: shortString(input.label, 'world frame objective label', 512), status: input.status,
    durability: finite(input.durability, 'world frame objective durability', 0, maxDurability), maxDurability,
    evidenceHash: shortString(input.evidenceHash, 'world frame objective evidenceHash', 256)};
}

function normalizeResources(value) {
  const input = record(value, 'world frame resources');
  exactKeys(input, new Set(['supplies', 'earnedOathmarks', 'pendingWeaponXp', 'sharedRevive']), 'world frame resources');
  const xp = record(input.pendingWeaponXp, 'world frame pendingWeaponXp');
  exactKeys(xp, new Set(['arbalest', 'sunfire', 'runebolt']), 'world frame pendingWeaponXp');
  const revive = record(input.sharedRevive, 'world frame sharedRevive');
  exactKeys(revive, new Set(['available', 'consumed', 'reviveHp']), 'world frame sharedRevive');
  return {supplies: integer(input.supplies, 'world frame Supplies', 0, 0xffffffff),
    earnedOathmarks: integer(input.earnedOathmarks, 'world frame earnedOathmarks', 0, 0xffffffff),
    pendingWeaponXp: {arbalest: integer(xp.arbalest, 'world frame arbalest XP'), sunfire: integer(xp.sunfire, 'world frame sunfire XP'), runebolt: integer(xp.runebolt, 'world frame runebolt XP')},
    sharedRevive: {available: exactBoolean(revive.available, 'world frame sharedRevive.available'),
      consumed: exactBoolean(revive.consumed, 'world frame sharedRevive.consumed'), reviveHp: finite(revive.reviveHp, 'world frame reviveHp', 0, 1_000_000)}};
}

function normalizeEventPayload(value, index) {
  const input = record(value, `world frame event ${index} payload`);
  exactKeys(input, new Set(['encounterId', 'phase', 'attack', 'zoneId', 'targetId', 'amount', 'night', 'wave', 'state', 'cue']), `world frame event ${index} payload`);
  const output = {};
  for (const [key, item] of Object.entries(input)) {
    output[key] = key === 'night'
      ? integer(item, `world frame event ${index} payload night`, 1, 7)
      : key === 'wave'
        ? integer(item, `world frame event ${index} payload wave`, 1, 3)
        : ['phase', 'amount'].includes(key)
          ? finite(item, `world frame event ${index} payload ${key}`, 0, 10_000_000)
          : stableId(item, `world frame event ${index} payload ${key}`);
  }
  return output;
}

function normalizeEvent(value, index) {
  const input = record(value, `world frame event ${index}`);
  exactKeys(input, new Set(['sequence', 'authorityTick', 'category', 'kind', 'actorId', 'payload']), `world frame event ${index}`);
  if (!['combat', 'boss', 'music', 'campaign'].includes(input.category)) throw new RangeError(`world frame event ${index} category is unsupported`);
  return {sequence: integer(input.sequence, 'event.sequence', 1), authorityTick: integer(input.authorityTick, 'event.authorityTick'),
    category: input.category, kind: stableId(input.kind, 'event.kind'), actorId: input.actorId === null ? null : stableId(input.actorId, 'event.actorId'),
    payload: normalizeEventPayload(input.payload, index)};
}

const NARRATIVE_KEYS = new Set(['runOrdinal', 'recovery', 'activeScene', 'completedSceneIds', 'seenSceneIds',
  'responseTagIds', 'daywork', 'medicine', 'goals', 'goalProgress', 'rosterIds', 'fallenIds', 'nightStartingNpcIds']);

function boundedIds(value, label, maximum = 128) {
  if (!Array.isArray(value) || value.length > maximum) throw new RangeError(`${label} must be a bounded array with at most ${maximum} IDs`);
  const ids = value.map((item, index) => stableId(item, `${label}[${index}]`));
  if (new Set(ids).size !== ids.length) throw new RangeError(`${label} IDs must be unique`);
  return ids;
}

function nullableId(value, label) {
  return value === null ? null : stableId(value, label);
}

function normalizeNarrativeRecovery(value) {
  if (value === null) return null;
  const input = record(value, 'world frame narrative recovery');
  exactKeys(input, new Set(['deadlineTick', 'remainingTicks']), 'world frame narrative recovery');
  return {deadlineTick: integer(input.deadlineTick, 'world frame narrative recovery deadlineTick'),
    remainingTicks: integer(input.remainingTicks, 'world frame narrative recovery remainingTicks', 0, 360)};
}

function normalizeNarrativeScene(value) {
  if (value === null) return null;
  const input = record(value, 'world frame narrative activeScene');
  exactKeys(input, new Set(['sceneId', 'beatIndex', 'responseId', 'responseTagId']), 'world frame narrative activeScene');
  return {sceneId: stableId(input.sceneId, 'world frame narrative activeScene.sceneId'),
    beatIndex: integer(input.beatIndex, 'world frame narrative activeScene.beatIndex', 0, 1024),
    responseId: nullableId(input.responseId, 'world frame narrative activeScene.responseId'),
    responseTagId: nullableId(input.responseTagId, 'world frame narrative activeScene.responseTagId')};
}

function normalizeNarrativeDaywork(value) {
  if (value === null) return null;
  const input = record(value, 'world frame narrative daywork');
  exactKeys(input, new Set(['night', 'npcId', 'actionId', 'targetId', 'requestId']), 'world frame narrative daywork');
  return {night: integer(input.night, 'world frame narrative daywork.night', 1, 7),
    npcId: stableId(input.npcId, 'world frame narrative daywork.npcId'),
    actionId: stableId(input.actionId, 'world frame narrative daywork.actionId'),
    targetId: nullableId(input.targetId, 'world frame narrative daywork.targetId'),
    requestId: nullableId(input.requestId, 'world frame narrative daywork.requestId')};
}

function normalizeNarrativeMedicine(value) {
  const input = record(value, 'world frame narrative medicine');
  exactKeys(input, new Set(['night', 'prepared', 'available', 'prepareReceiptId', 'consumeReceiptId', 'actorId']), 'world frame narrative medicine');
  return {night: integer(input.night, 'world frame narrative medicine.night', 1, 7),
    prepared: exactBoolean(input.prepared, 'world frame narrative medicine.prepared'),
    available: exactBoolean(input.available, 'world frame narrative medicine.available'),
    prepareReceiptId: nullableId(input.prepareReceiptId, 'world frame narrative medicine.prepareReceiptId'),
    consumeReceiptId: nullableId(input.consumeReceiptId, 'world frame narrative medicine.consumeReceiptId'),
    actorId: nullableId(input.actorId, 'world frame narrative medicine.actorId')};
}

function normalizeNarrativeGoal(value, index) {
  const label = `world frame narrative goal ${index}`;
  const input = record(value, label);
  exactKeys(input, new Set(['npcId', 'status', 'activeGoalId', 'readyGoalId', 'completedGoalIds', 'rewardIds']), label);
  if (!['new', 'known', 'trusted', 'bonded'].includes(input.status)) throw new RangeError(`${label}.status is unsupported`);
  return {npcId: stableId(input.npcId, `${label}.npcId`), status: input.status,
    activeGoalId: nullableId(input.activeGoalId, `${label}.activeGoalId`), readyGoalId: nullableId(input.readyGoalId, `${label}.readyGoalId`),
    completedGoalIds: boundedIds(input.completedGoalIds, `${label}.completedGoalIds`, 16), rewardIds: boundedIds(input.rewardIds, `${label}.rewardIds`, 32)};
}

function normalizeValueEntries(value, label, valueKey) {
  if (!Array.isArray(value) || value.length > 64) throw new RangeError(`${label} must contain at most 64 entries`);
  const entries = value.map((item, index) => {
    const entryLabel = `${label} ${index}`;
    const input = record(item, entryLabel);
    exactKeys(input, new Set([valueKey, 'value']), entryLabel);
    return {[valueKey]: stableId(input[valueKey], `${entryLabel}.${valueKey}`), value: integer(input.value, `${entryLabel}.value`)};
  });
  if (new Set(entries.map(item => item[valueKey])).size !== entries.length) throw new RangeError(`${label} IDs must be unique`);
  return entries;
}

function normalizeNarrativeProgress(value, index) {
  const label = `world frame narrative goalProgress ${index}`;
  const input = record(value, label);
  exactKeys(input, new Set(['goalId', 'counters', 'flags', 'actorStreaks']), label);
  return {goalId: stableId(input.goalId, `${label}.goalId`),
    counters: normalizeValueEntries(input.counters, `${label}.counters`, 'id'),
    flags: boundedIds(input.flags, `${label}.flags`, 64),
    actorStreaks: normalizeValueEntries(input.actorStreaks, `${label}.actorStreaks`, 'actorId')};
}

function normalizeNarrative(value) {
  const input = record(value, 'world frame narrative');
  exactKeys(input, NARRATIVE_KEYS, 'world frame narrative');
  if (!Array.isArray(input.goals) || input.goals.length > 16) throw new RangeError('world frame narrative goals are invalid');
  if (!Array.isArray(input.goalProgress) || input.goalProgress.length > 64) throw new RangeError('world frame narrative goalProgress is invalid');
  const goals = input.goals.map(normalizeNarrativeGoal);
  const goalProgress = input.goalProgress.map(normalizeNarrativeProgress);
  if (new Set(goals.map(item => item.npcId)).size !== goals.length) throw new RangeError('world frame narrative goal NPCs must be unique');
  if (new Set(goalProgress.map(item => item.goalId)).size !== goalProgress.length) throw new RangeError('world frame narrative goal progress IDs must be unique');
  return {runOrdinal: integer(input.runOrdinal, 'world frame narrative runOrdinal', 1),
    recovery: normalizeNarrativeRecovery(input.recovery), activeScene: normalizeNarrativeScene(input.activeScene),
    completedSceneIds: boundedIds(input.completedSceneIds, 'world frame narrative completedSceneIds'),
    seenSceneIds: boundedIds(input.seenSceneIds, 'world frame narrative seenSceneIds'),
    responseTagIds: boundedIds(input.responseTagIds, 'world frame narrative responseTagIds'),
    daywork: normalizeNarrativeDaywork(input.daywork), medicine: normalizeNarrativeMedicine(input.medicine),
    goals, goalProgress,
    rosterIds: boundedIds(input.rosterIds, 'world frame narrative rosterIds', 8),
    fallenIds: boundedIds(input.fallenIds, 'world frame narrative fallenIds', 8),
    nightStartingNpcIds: boundedIds(input.nightStartingNpcIds, 'world frame narrative nightStartingNpcIds', 8)};
}

export function createCoopWorldFrame(value = {}) {
  const input = record(value, 'Co-op world frame');
  exactKeys(input, new Set(['version', 'kind', 'authorityTick', 'night', 'wave', 'phase', 'subphase', 'players', 'crowd', 'boss', 'objective', 'resources', 'gates', 'fortifications', 'hub', 'narrative', 'events', 'eventCursor', 'stateHash']), 'Co-op world frame');
  if (input.kind !== undefined && input.kind !== COOP_WIRE_MESSAGE_KINDS.WORLD_FRAME) throw new RangeError('Co-op world frame kind is unsupported');
  if (!isSessionPhase(input.phase)) throw new RangeError('Co-op world frame phase is unsupported');
  if (!Array.isArray(input.players) || input.players.length !== 2) throw new RangeError('Co-op world frame requires exactly two Wardens');
  if (!Array.isArray(input.gates) || input.gates.length > 0xff) throw new RangeError('Co-op world frame gates are invalid');
  if (!Array.isArray(input.fortifications) || input.fortifications.length > 256) throw new RangeError('Co-op world frame fortifications are invalid');
  if (!Array.isArray(input.events) || input.events.length > 128) throw new RangeError('Co-op world frame events are invalid');
  const players = input.players.map(player => createNetworkPlayerState(player)).sort((left, right) => left.playerId.localeCompare(right.playerId, 'en-US'));
  if (players[0].playerId === players[1].playerId) throw new RangeError('Co-op world frame Warden IDs are duplicated');
  const events = input.events.map(normalizeEvent);
  for (let index = 1; index < events.length; index += 1) if (events[index].sequence <= events[index - 1].sequence) throw new RangeError('world frame event sequence must be strictly ordered');
  const eventCursor = integer(input.eventCursor, 'world frame eventCursor');
  if (events.some(event => event.sequence > eventCursor)) throw new RangeError('world frame event exceeds eventCursor');
  const narrative = normalizeNarrative(input.narrative);
  if (narrative.recovery
    && narrative.recovery.remainingTicks !== Math.max(0, narrative.recovery.deadlineTick - input.authorityTick)) {
    throw new RangeError('world frame narrative recovery deadline contradicts authorityTick');
  }
  const output = {version: protocol(input.version, 'world_frame'), kind: COOP_WIRE_MESSAGE_KINDS.WORLD_FRAME,
    authorityTick: integer(input.authorityTick, 'world frame authorityTick'), night: integer(input.night, 'world frame night', 1, 7),
    wave: integer(input.wave, 'world frame wave', 0, 3), phase: input.phase, subphase: stableId(input.subphase, 'world frame subphase'),
    players, crowd: normalizeCrowd(input.crowd), boss: normalizeBoss(input.boss), objective: normalizeObjective(input.objective), resources: normalizeResources(input.resources),
    gates: input.gates.map(normalizeGate), fortifications: input.fortifications.map(normalizeFortification), hub: normalizeHub(input.hub), narrative,
    events, eventCursor, stateHash: shortString(input.stateHash, 'world frame stateHash', 256)};
  return boundedMessage(output, 'Co-op realtime world frame');
}

function bytesToBase64(bytes) {
  let text = '';
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) text += String.fromCharCode(...bytes.subarray(index, Math.min(index + step, bytes.length)));
  return btoa(text);
}

function base64ToBytes(value) {
  const text = atob(value);
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index);
  return bytes;
}

function encodeValue(value) {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return {__wireType: 'number', value: 'NaN'};
    if (value === Infinity) return {__wireType: 'number', value: 'Infinity'};
    if (value === -Infinity) return {__wireType: 'number', value: '-Infinity'};
    return value;
  }
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return {__wireType: 'typed-array', type: value.constructor.name, length: value.length, data: bytesToBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))};
  }
  if (value instanceof ArrayBuffer) return {__wireType: 'array-buffer', data: bytesToBase64(new Uint8Array(value))};
  if (Array.isArray(value)) return value.map(encodeValue);
  // Checkpoint normalisers already emit canonical key order. Preserve it on
  // the wire because nested authority snapshots (notably boss directors)
  // include a hash over their canonical serialized shape.
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).map(key => [key, encodeValue(value[key])]));
  if (value === undefined) return {__wireType: 'undefined'};
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  throw new TypeError(`Unsupported checkpoint value ${typeof value}`);
}

const TYPED_ARRAYS = Object.freeze({Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array});

function decodeValue(value) {
  if (Array.isArray(value)) return value.map(decodeValue);
  if (!value || typeof value !== 'object') return value;
  if (value.__wireType === 'number') return value.value === 'NaN' ? NaN : Number(value.value);
  if (value.__wireType === 'undefined') return undefined;
  if (value.__wireType === 'array-buffer') return base64ToBytes(value.data).buffer;
  if (value.__wireType === 'typed-array') {
    const Constructor = TYPED_ARRAYS[value.type];
    if (!Constructor || typeof Constructor.BYTES_PER_ELEMENT !== 'number') throw new TypeError(`Unsupported checkpoint typed array ${value.type}`);
    const bytes = base64ToBytes(value.data);
    if (bytes.byteLength % Constructor.BYTES_PER_ELEMENT !== 0 || bytes.byteLength / Constructor.BYTES_PER_ELEMENT !== value.length) throw new RangeError('Checkpoint typed array length is invalid');
    return new Constructor(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decodeValue(child)]));
}

export function encodeCheckpoint(checkpoint) {
  record(checkpoint, 'checkpoint');
  return JSON.stringify(encodeValue(checkpoint));
}

export function decodeCheckpoint(encoded) {
  if (typeof encoded !== 'string' || encoded.length < 2) throw new TypeError('Encoded checkpoint is invalid');
  let value;
  try { value = JSON.parse(encoded); } catch { throw new TypeError('Encoded checkpoint JSON is invalid'); }
  return decodeValue(value);
}

function digest(text) {
  const bytes = new TextEncoder().encode(text);
  let left = 0x811c9dc5; let right = 0x9e3779b9;
  for (const byte of bytes) { left = Math.imul(left ^ byte, 0x01000193) >>> 0; right = Math.imul(right ^ byte, 0x85ebca6b) >>> 0; }
  return `cw4-${left.toString(16).padStart(8, '0')}${right.toString(16).padStart(8, '0')}`;
}

export function createCoopCheckpointOffer(value = {}) {
  const input = record(value, 'checkpoint offer');
  exactKeys(input, new Set(['version', 'kind', 'transferId', 'checkpoint', 'encodedCheckpoint', 'stateHash', 'chunkBytes', 'checkpointHash', 'totalBytes', 'totalChunks']), 'checkpoint offer');
  const encodedCheckpoint = input.encodedCheckpoint ?? (input.checkpoint ? encodeCheckpoint(input.checkpoint) : null);
  const chunkBytes = input.chunkBytes ?? CHECKPOINT_CHUNK_DATA_BYTES;
  if (encodedCheckpoint === null) {
    if (!Number.isInteger(input.totalBytes) || !Number.isInteger(input.totalChunks) || typeof input.checkpointHash !== 'string') throw new TypeError('checkpoint offer payload is invalid');
    const output = {version: protocol(input.version, 'checkpoint_offer'), kind: COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_OFFER,
      transferId: stableId(input.transferId, 'checkpoint offer transferId'), stateHash: shortString(input.stateHash, 'checkpoint offer stateHash', 256), checkpointHash: shortString(input.checkpointHash, 'checkpoint offer checkpointHash', 256),
      totalBytes: integer(input.totalBytes, 'checkpoint offer totalBytes', 1, COOP_MAX_CHECKPOINT_BYTES), chunkBytes: integer(chunkBytes, 'checkpoint offer chunkBytes', 1024, CHECKPOINT_CHUNK_DATA_BYTES), totalChunks: integer(input.totalChunks, 'checkpoint offer totalChunks', 1, Math.ceil(COOP_MAX_CHECKPOINT_BYTES / 1024))};
    if (output.totalChunks !== Math.ceil(output.totalBytes / output.chunkBytes)) throw new RangeError('checkpoint offer chunk count does not match byte length');
    return boundedMessage(output);
  }
  if (encodedCheckpoint.length < 2) throw new TypeError('checkpoint offer payload is invalid');
  const output = {version: protocol(input.version, 'checkpoint_offer'), kind: COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_OFFER,
    transferId: stableId(input.transferId, 'checkpoint offer transferId'), stateHash: shortString(input.stateHash ?? digest(encodedCheckpoint), 'checkpoint offer stateHash', 256),
    checkpointHash: digest(encodedCheckpoint), totalBytes: new TextEncoder().encode(encodedCheckpoint).byteLength, chunkBytes: integer(chunkBytes, 'checkpoint offer chunkBytes', 1024, CHECKPOINT_CHUNK_DATA_BYTES),
    totalChunks: Math.ceil(new TextEncoder().encode(encodedCheckpoint).byteLength / chunkBytes)};
  if (output.totalBytes > COOP_MAX_CHECKPOINT_BYTES) throw new RangeError('checkpoint offer exceeds the 2MiB transfer limit');
  if (input.checkpointHash !== undefined && input.checkpointHash !== output.checkpointHash) throw new RangeError('checkpoint offer hash mismatch');
  if (input.totalBytes !== undefined && input.totalBytes !== output.totalBytes) throw new RangeError('checkpoint offer byte length mismatch');
  if (input.totalChunks !== undefined && input.totalChunks !== output.totalChunks) throw new RangeError('checkpoint offer chunk count mismatch');
  return boundedMessage(output, 'checkpoint offer');
}

export function createCoopCheckpointChunks({offer, encodedCheckpoint} = {}) {
  const normalized = createCoopCheckpointOffer(offer);
  if (typeof encodedCheckpoint !== 'string') throw new TypeError('checkpoint chunks require encodedCheckpoint');
  const encodedBytes = new TextEncoder().encode(encodedCheckpoint);
  if (digest(encodedCheckpoint) !== normalized.checkpointHash || encodedBytes.byteLength !== normalized.totalBytes) throw new RangeError('checkpoint payload does not match offer');
  const chunks = [];
  for (let index = 0; index < normalized.totalChunks; index += 1) {
    const data = bytesToBase64(encodedBytes.subarray(index * normalized.chunkBytes, (index + 1) * normalized.chunkBytes));
    chunks.push(boundedMessage({version: COOP_WIRE_PROTOCOL_VERSION, kind: COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_CHUNK,
      transferId: normalized.transferId, stateHash: normalized.stateHash, checkpointHash: normalized.checkpointHash, index, totalChunks: normalized.totalChunks, data}, 'checkpoint chunk'));
  }
  return chunks;
}

function normalizeCheckpointChunk(value) {
  const input = record(value, 'checkpoint chunk');
  exactKeys(input, new Set(['version', 'kind', 'transferId', 'stateHash', 'checkpointHash', 'index', 'totalChunks', 'data']), 'checkpoint chunk');
  if (input.kind !== COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_CHUNK) throw new RangeError('checkpoint chunk kind is unsupported');
  const data = shortString(input.data, 'checkpoint chunk data', CHECKPOINT_CHUNK_BASE64_CHARS);
  const normalized = {version: protocol(input.version, 'checkpoint_chunk'), kind: COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_CHUNK,
    transferId: stableId(input.transferId, 'checkpoint chunk transferId'), stateHash: shortString(input.stateHash, 'checkpoint chunk stateHash', 256),
    checkpointHash: shortString(input.checkpointHash, 'checkpoint chunk checkpointHash', 256), index: integer(input.index, 'checkpoint chunk index'),
    totalChunks: integer(input.totalChunks, 'checkpoint chunk totalChunks', 1), data};
  if (normalized.index >= normalized.totalChunks) throw new RangeError('checkpoint chunk index is outside transfer');
  return boundedMessage(normalized, 'checkpoint chunk');
}

export class CheckpointAssembler {
  constructor(offer) {
    const input = record(offer, 'checkpoint assembler offer');
    exactKeys(input, new Set(['version', 'kind', 'transferId', 'stateHash', 'checkpointHash', 'totalBytes', 'chunkBytes', 'totalChunks']), 'checkpoint assembler offer');
    if (input.kind !== COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_OFFER) throw new RangeError('checkpoint assembler offer kind is unsupported');
    this.offer = createCoopCheckpointOffer(input);
    this.parts = [];
  }

  add(chunk) {
    const input = record(chunk, 'checkpoint chunk');
    exactKeys(input, new Set(['version', 'kind', 'transferId', 'stateHash', 'checkpointHash', 'index', 'totalChunks', 'data']), 'checkpoint chunk');
    if (input.kind !== COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_CHUNK) throw new RangeError('checkpoint chunk kind is unsupported');
    if (input.transferId !== this.offer.transferId || input.stateHash !== this.offer.stateHash || input.checkpointHash !== this.offer.checkpointHash || input.totalChunks !== this.offer.totalChunks) throw new RangeError('checkpoint chunk transfer identity or hash mismatch');
    if (!Number.isInteger(input.index) || input.index < 0 || input.index >= this.offer.totalChunks) throw new RangeError('checkpoint chunk index is invalid');
    if (this.parts[input.index] !== undefined) throw new RangeError('checkpoint chunk duplicate');
    if (input.index !== this.parts.length) throw new RangeError('checkpoint chunk is out of order');
    if (typeof input.data !== 'string' || input.data.length > CHECKPOINT_CHUNK_BASE64_CHARS || base64ToBytes(input.data).byteLength > this.offer.chunkBytes) throw new RangeError('checkpoint chunk data is invalid');
    this.parts.push(input.data);
    return this;
  }

  assemble() {
    if (this.parts.length !== this.offer.totalChunks || this.parts.some(part => part === undefined)) throw new RangeError('checkpoint transfer is missing chunks');
    const decodedParts = this.parts.map(base64ToBytes);
    const bytes = new Uint8Array(decodedParts.reduce((total, part) => total + part.byteLength, 0));
    let offset = 0;
    for (const part of decodedParts) { bytes.set(part, offset); offset += part.byteLength; }
    const encoded = new TextDecoder().decode(bytes);
    if (bytes.byteLength !== this.offer.totalBytes || digest(encoded) !== this.offer.checkpointHash) throw new RangeError('checkpoint transfer hash mismatch');
    return decodeCheckpoint(encoded);
  }
}

export function createCoopCheckpointApplied(value = {}) {
  const input = record(value, 'checkpoint applied');
  exactKeys(input, new Set(['version', 'kind', 'transferId', 'stateHash']), 'checkpoint applied');
  return boundedMessage({version: protocol(input.version, 'checkpoint_applied'), kind: COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_APPLIED, transferId: stableId(input.transferId, 'checkpoint applied transferId'), stateHash: shortString(input.stateHash, 'checkpoint applied stateHash', 256)});
}

export function createCoopResume(value = {}) {
  const input = record(value, 'co-op resume');
  exactKeys(input, new Set(['version', 'kind', 'transferId', 'lastAppliedTick', 'lastAppliedEventSequence', 'stateHash']), 'co-op resume');
  return boundedMessage({version: protocol(input.version, 'resume'), kind: COOP_WIRE_MESSAGE_KINDS.RESUME,
    transferId: input.transferId == null ? null : stableId(input.transferId, 'resume transferId'),
    lastAppliedTick: integer(input.lastAppliedTick, 'resume lastAppliedTick'),
    lastAppliedEventSequence: integer(input.lastAppliedEventSequence, 'resume lastAppliedEventSequence'),
    stateHash: shortString(input.stateHash, 'resume stateHash', 256)});
}

export function createCoopAuthorityPaused(value = {}) {
  const input = record(value, 'authority paused');
  exactKeys(input, new Set(['version', 'kind', 'tick', 'reason']), 'authority paused');
  return boundedMessage({version: protocol(input.version, 'authority_paused'), kind: COOP_WIRE_MESSAGE_KINDS.AUTHORITY_PAUSED, tick: integer(input.tick, 'authority paused tick'), reason: shortString(input.reason, 'authority paused reason', 128)});
}

export function createCoopAuthorityResumed(value = {}) {
  const input = record(value, 'authority resumed');
  exactKeys(input, new Set(['version', 'kind', 'tick', 'stateHash']), 'authority resumed');
  return boundedMessage({version: protocol(input.version, 'authority_resumed'), kind: COOP_WIRE_MESSAGE_KINDS.AUTHORITY_RESUMED, tick: integer(input.tick, 'authority resumed tick'), stateHash: shortString(input.stateHash, 'authority resumed stateHash', 256)});
}

export function createCoopSessionEnded(value = {}) {
  const input = record(value, 'session ended');
  exactKeys(input, new Set(['version', 'kind', 'reason']), 'session ended');
  return boundedMessage({version: protocol(input.version, 'session_ended'), kind: COOP_WIRE_MESSAGE_KINDS.SESSION_ENDED, reason: shortString(input.reason ?? 'host_left', 'session ended reason', 128)});
}

export function normalizeCoopWireMessage(value) {
  const input = record(value, 'Co-op wire message');
  if (input.version !== COOP_WIRE_PROTOCOL_VERSION) throw new RangeError('Co-op wire protocol version is unsupported');
  switch (input.kind) {
    case COOP_WIRE_MESSAGE_KINDS.HELLO: return normalizeHello(input);
    case COOP_WIRE_MESSAGE_KINDS.COMMAND: {
      const commandInput = record(input.command, 'Co-op command');
      exactKeys(input, new Set(['version', 'kind', 'command']), 'Co-op command message');
      return createCoopCommandV2(commandInput);
    }
    case COOP_WIRE_MESSAGE_KINDS.ACTION_REQUEST: return createCoopActionRequest(input);
    case COOP_WIRE_MESSAGE_KINDS.ACTION_ACK: return createCoopActionAck(input);
    case COOP_WIRE_MESSAGE_KINDS.WORLD_FRAME: return createCoopWorldFrame(input);
    case COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_OFFER: return createCoopCheckpointOffer(input);
    case COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_CHUNK: return normalizeCheckpointChunk(input);
    case COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_APPLIED: return createCoopCheckpointApplied(input);
    case COOP_WIRE_MESSAGE_KINDS.RESUME: return createCoopResume(input);
    case COOP_WIRE_MESSAGE_KINDS.AUTHORITY_PAUSED: return createCoopAuthorityPaused(input);
    case COOP_WIRE_MESSAGE_KINDS.AUTHORITY_RESUMED: return createCoopAuthorityResumed(input);
    case COOP_WIRE_MESSAGE_KINDS.SESSION_ENDED: return createCoopSessionEnded(input);
    default: throw new RangeError(`Co-op wire message kind ${input.kind} is unsupported`);
  }
}

/** Only deliberately non-sensitive control metadata belongs in diagnostics. */
export function wireMessageForDiagnostics(message) {
  const normalized = normalizeCoopWireMessage(message);
  return Object.fromEntries(Object.entries(normalized).filter(([key]) => !/(secret|token|credential|password|sdp|ice)/iu.test(key)));
}

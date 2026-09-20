import {createBattlefield} from './battlefield.js';
import {BRIARHOLD_VERSION, GAME_PHASES, PLAYER_DEFAULTS} from './contracts.js';
import {
  applyNetworkPlayerState,
  playerCommandFromInputFrame,
  rebasePlayerCommandForAuthority,
} from './coop-session.js';
import {
  COOP_WIRE_MESSAGE_KINDS,
  COOP_WIRE_PROTOCOL_VERSION,
  CheckpointAssembler,
  CoopActionRequestLedger,
  createCoopActionAck,
  createCoopActionRequest,
  createCoopAuthorityPaused,
  createCoopAuthorityResumed,
  createCoopCheckpointApplied,
  createCoopCheckpointChunks,
  createCoopCheckpointOffer,
  createCoopCommandV2,
  createCoopHelloV4,
  createCoopResume,
  createCoopSessionEnded,
  createCoopWorldFrame,
  coerceCoopActionRejectionCode,
  encodeCheckpoint,
  normalizeCoopWireMessage,
} from './coop-world-wire.js';
import {
  PLAYER_COMMAND_LOOK_QUANTIZATION,
  PLAYER_COMMAND_ACTIONS,
  createNetworkPlayerState,
  createSessionWeaponState,
  createSessionConfig,
  sessionWeaponStateFromPlayer,
} from './multiplayer-contracts.js';
import {createSessionState, stepSession} from './multiplayer-session-core.js';
import {PEER_ROLES, createPeerTransport} from './peer-transport.js';
import {createPlayerState} from './player-controller.js';
import {
  createRemoteWardenAvatar,
  disposeRemoteWardenTemplate,
  loadRemoteWardenTemplate,
} from './remote-warden.js';

export const COOP_PREVIEW_BUILD_HASH = BRIARHOLD_VERSION;
export const COOP_PREVIEW_CONTENT_HASH = 'seven-night-campaign-v6-alpha100';
export const COOP_INVITE_VERSION = 1;

const HOST_ID = 'warden-host';
const GUEST_ID = 'warden-guest';
const AUTHORITY_STEP = 1 / 30;
const HANDSHAKE_TIMEOUT_MS = 15000;
const AVATAR_STARTUP_TIMEOUT_MS = 90000;
export const CHECKPOINT_ACK_TIMEOUT_MS = 30000;
export const CONNECTION_INTERRUPTION_GRACE_MS = 5000;
export const PEER_SILENCE_TIMEOUT_MS = 30000;
const MAX_PENDING_GUEST_COMMANDS = 64;
const MAX_PRE_HELLO_MESSAGES = 32;
const MAX_CONFIRMED_CHECKPOINT_TRANSFERS = 16;
const MAX_CHECKPOINT_TRANSFER_IDENTITIES = 16;
const PLAYER_COMMAND_HELD_ACTIONS = PLAYER_COMMAND_ACTIONS.SPRINT;
const PLAYER_COMMAND_EDGE_ACTIONS = Object.values(PLAYER_COMMAND_ACTIONS)
  .filter(action => (action & PLAYER_COMMAND_HELD_ACTIONS) === 0)
  .reduce((mask, action) => mask | action, 0);
const NEUTRAL_INPUT_FRAME = Object.freeze({
  move: Object.freeze({x: 0, y: 0}),
  look: Object.freeze({yaw: 0, pitch: 0}),
  fire: false, interact: false, sprint: false, jump: false, slide: false,
  melee: false, selectedWeapon: null,
  aiming: false, manualVent: false,
});

function actionStream(action) {
  if (['choose_boon', 'bell_confirm'].includes(action)) return 'campaign';
  if (['ward_light', 'revive', 'manual_vent', 'medicine_consume'].includes(action)) return 'combat';
  if (['scene_advance', 'scene_response', 'scene_skip'].includes(action)) return 'narrative';
  if (['goal_accept', 'goal_report', 'daywork', 'medicine_prepare'].includes(action)) return 'progression';
  if (['npc_action', 'npc_interaction', 'goals_panel', 'service_request'].includes(action)) return 'hub';
  return 'build';
}

function actionMaskForAuthorityEvent(event) {
  if (event?.kind === 'melee_strike') return PLAYER_COMMAND_ACTIONS.MELEE;
  if (event?.kind === 'weapon_vented') return null;
  return PLAYER_COMMAND_ACTIONS.FIRE;
}

function commandEventSourceSequences(command, prior = null) {
  return Object.freeze({
    fire: (command.actions & PLAYER_COMMAND_ACTIONS.FIRE) !== 0 ? command.sequence : prior?.fire ?? null,
    melee: (command.actions & PLAYER_COMMAND_ACTIONS.MELEE) !== 0 ? command.sequence : prior?.melee ?? null,
    manualVent: command.manualVent === true ? command.sequence : prior?.manualVent ?? null,
  });
}

function eventSourceSequence(event, source) {
  if (!source) return null;
  const key = event?.kind === 'melee_strike' ? 'melee'
    : event?.kind === 'weapon_vented' ? 'manualVent' : 'fire';
  return source.eventSources?.[key] ?? source.command?.sequence ?? null;
}

function boundedLookDelta(value) {
  return Math.max(-PLAYER_COMMAND_LOOK_QUANTIZATION,
    Math.min(PLAYER_COMMAND_LOOK_QUANTIZATION, value));
}

function mergeCommands(previous, next) {
  const newest = next.sequence >= previous.sequence ? next : previous;
  const latestWeapon = [previous, next]
    .filter(command => command.selectedWeapon !== null && command.selectedWeapon !== undefined)
    .sort((left, right) => left.sequence - right.sequence)
    .at(-1)?.selectedWeapon ?? null;
  return {
    ...newest,
    look: {
      yaw: boundedLookDelta(previous.look.yaw + next.look.yaw),
      pitch: boundedLookDelta(previous.look.pitch + next.look.pitch),
    },
    actions: ((previous.actions | next.actions) & PLAYER_COMMAND_EDGE_ACTIONS)
      | (newest.actions & PLAYER_COMMAND_HELD_ACTIONS),
    selectedWeapon: latestWeapon,
    manualVent: previous.manualVent || next.manualVent,
  };
}

function checkpointTransferRank(transferId) {
  const match = /^cp-(\d+)-(\d+)$/u.exec(String(transferId));
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function checkpointTransferIsOlder(left, right) {
  const leftRank = checkpointTransferRank(left?.transferId ?? left);
  const rightRank = checkpointTransferRank(right?.transferId ?? right);
  if (!leftRank || !rightRank) return false;
  return leftRank[0] < rightRank[0]
    || (leftRank[0] === rightRank[0] && leftRank[1] <= rightRank[1]);
}

function emptyNarrativeFrameState() {
  return {
    runOrdinal: 1, recovery: null, activeScene: null,
    completedSceneIds: [], seenSceneIds: [], responseTagIds: [], daywork: null,
    medicine: {night: 1, prepared: false, available: false, prepareReceiptId: null, consumeReceiptId: null, actorId: null},
    goals: [], goalProgress: [], rosterIds: [], fallenIds: [], nightStartingNpcIds: [],
  };
}

function invite(value, expectedKind) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invite must be an object');
  if (value.v !== COOP_INVITE_VERSION || value.kind !== expectedKind) throw new RangeError('Invite type is unsupported');
  if (!value.description || !['offer', 'answer'].includes(value.description.type)) {
    throw new TypeError('Invite is missing its WebRTC description');
  }
  if (typeof value.description.sdp !== 'string' || value.description.sdp.length > 262144) {
    throw new RangeError('Invite description is invalid');
  }
  return value;
}

export function encodeCoopInvite(value) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
}

export function decodeCoopInvite(text, expectedKind) {
  if (typeof text !== 'string' || text.length < 8 || text.length > 400000) throw new RangeError('Invite text is invalid');
  let value;
  try { value = JSON.parse(decodeURIComponent(escape(atob(text.trim())))); }
  catch { throw new TypeError('Invite text could not be decoded'); }
  return invite(value, expectedKind);
}

function spawnPlayer(playerId, x) {
  const player = createPlayerState({position: {x, y: 3.5, z: 17}, facing: {yaw: 0, pitch: 0.045}});
  return createNetworkPlayerState({
    playerId,
    position: player.position,
    velocity: player.velocity,
    facing: player.facing,
    traversal: 'grounded', grounded: true, eyeHeight: PLAYER_DEFAULTS.eyeHeight,
    hp: player.hp, maxHp: player.maxHp, activeWeapon: player.activeWeapon,
    heat: [0, 0, 0], healAvailable: true, damageCooldown: 0,
    sprinting: false, animationState: 'idle', animationStartedTick: 0,
    lastProcessedCommand: null,
  });
}

function createAuthority(resolveWeaponTuning = null) {
  const battlefield = createBattlefield({capacity: 1}).initialize([]);
  const players = [spawnPlayer(HOST_ID, -17.5), spawnPlayer(GUEST_ID, -14.5)];
  return createSessionState({
    config: createSessionConfig({
      roomId: 'manual-preview', buildHash: COOP_PREVIEW_BUILD_HASH,
      contentHash: COOP_PREVIEW_CONTENT_HASH, mapId: 'briarhold-western-hold',
      densityProfileId: 'mobile', maxPlayers: 2, seed: 1,
    }),
    phase: GAME_PHASES.BUILD_BREAK,
    players,
    weaponStates: players.map(player => sessionWeaponStateFromPlayer(player.playerId, player)),
    battlefield,
    resolveWeaponTuning,
  });
}

export class CoopMovementPreview {
  constructor({
    role,
    BABYLON,
    scene,
    localPlayer,
    onStatus = () => {},
    onConnected = () => {},
    onEnded = () => {},
    onAuthorityEvents = () => {},
    onLocalCommand = () => {},
    onActionRequest = null,
    onActionAck = () => {},
    createWorldFrame = null,
    onWorldFrame = () => {},
    createCheckpoint = null,
    applyCheckpoint = null,
    onAuthorityPaused = () => {},
    onAuthorityResumed = () => {},
    onIceCandidate = () => {},
    turnServers = [],
    transport = null,
    resolveWeaponTuning = null,
    now = () => (globalThis.performance?.now?.() ?? Date.now()),
    checkpointAckTimeoutMs = CHECKPOINT_ACK_TIMEOUT_MS,
    connectionInterruptionGraceMs = CONNECTION_INTERRUPTION_GRACE_MS,
    peerSilenceTimeoutMs = PEER_SILENCE_TIMEOUT_MS,
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = timer => clearTimeout(timer),
  } = {}) {
    if (!Object.values(PEER_ROLES).includes(role)) throw new TypeError('Co-op role must be host or guest');
    this.role = role;
    this.localId = role === PEER_ROLES.HOST ? HOST_ID : GUEST_ID;
    this.remoteId = role === PEER_ROLES.HOST ? GUEST_ID : HOST_ID;
    this.remotePeerId = this.remoteId;
    this.localPlayer = localPlayer;
    this.BABYLON = BABYLON;
    this.scene = scene;
    this.onStatus = onStatus;
    this.onConnected = onConnected;
    this.onEnded = onEnded;
    this.onAuthorityEvents = onAuthorityEvents;
    this.onLocalCommand = onLocalCommand;
    this.onActionRequest = onActionRequest;
    this.onActionAck = onActionAck;
    this.createWorldFrame = createWorldFrame;
    this.onWorldFrame = onWorldFrame;
    this.createCheckpoint = createCheckpoint;
    this.applyCheckpoint = applyCheckpoint;
    this.onAuthorityPaused = onAuthorityPaused;
    this.onAuthorityResumed = onAuthorityResumed;
    this.onIceCandidate = onIceCandidate;
    this.now = typeof now === 'function' ? now : (() => Date.now());
    this.transport = transport ?? createPeerTransport({role, turnServers, now: this.now});
    if (!Number.isFinite(checkpointAckTimeoutMs) || checkpointAckTimeoutMs < 10 || checkpointAckTimeoutMs > 120000) {
      throw new RangeError('checkpoint acknowledgement timeout must be bounded');
    }
    this.checkpointAckTimeoutMs = checkpointAckTimeoutMs;
    if (!Number.isFinite(connectionInterruptionGraceMs) || connectionInterruptionGraceMs < 100
      || connectionInterruptionGraceMs > 30000) throw new RangeError('connection interruption grace must be bounded');
    if (!Number.isFinite(peerSilenceTimeoutMs) || peerSilenceTimeoutMs < 1000
      || peerSilenceTimeoutMs > 120000) throw new RangeError('peer silence timeout must be bounded');
    if (typeof setTimer !== 'function' || typeof clearTimer !== 'function') throw new TypeError('connection timers must be functions');
    this.connectionInterruptionGraceMs = connectionInterruptionGraceMs;
    this.peerSilenceTimeoutMs = peerSilenceTimeoutMs;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.authority = role === PEER_ROLES.HOST ? createAuthority(resolveWeaponTuning) : null;
    this.remoteAvatar = null;
    this.avatarLoadPromise = null;
    this.lifecycleGeneration = 0;
    this.accumulator = 0;
    this.sequence = 0;
    this.latestFrame = null;
    this.pendingFrames = [];
    this.pendingFrameEventSources = new Map();
    this.lastGuestCommandSequence = -1;
    this.connected = false;
    this.closed = false;
    this.pendingInput = null;
    this.controlOpen = false;
    this.realtimeOpen = false;
    this.helloReceived = false;
    this.helloSent = false;
    this.pendingPreHelloMessages = [];
    this.handshakeStarting = false;
    this.handshakeTimer = null;
    this.interruptionTimer = null;
    this.transportInterrupted = false;
    this.interruptionCause = null;
    this.healthState = 'negotiating';
    this.healthFailure = null;
    this.healthInterruptions = 0;
    this.healthRecoveries = 0;
    this.lastReceivedAt = this.now();
    this.lastSentAt = this.lastReceivedAt;
    this.authorityPaused = false;
    this.actionSequence = 0;
    this.actionSequences = new Map();
    this.lastActionAck = null;
    this.actionLedger = role === PEER_ROLES.HOST
      ? new CoopActionRequestLedger({peerId: this.remoteId})
      : null;
    this.checkpointAssembler = null;
    this.checkpointTransferIdentities = new Map();
    this.lastCheckpointTransferId = null;
    this.lastAppliedCheckpoint = null;
    this.pendingCheckpoint = null;
    this.queuedCheckpointReason = null;
    this.lastConfirmedCheckpoint = null;
    this.confirmedCheckpointTransfers = new Map();
    this.resumeDeferred = false;
    this.resumeDeferredReason = null;
    this.lastAppliedEventSequence = 0;
    this.dropCounts = {backpressure: 0, stale: 0, notOpen: 0, invalid: 0, other: 0};
    this.lastDropBudget = null;
    this.authorityEventCounts = {weapon_fired: 0, weapon_vented: 0, melee_strike: 0};
    this.transport.on('channelstate', event => this.channelState(event));
    this.transport.on('message', event => this.message(event));
    this.transport.on('drop', event => this.dropped(event));
    this.transport.on('statechange', event => this.connectionState(event));
    this.transport.on('error', event => this.onStatus(`Network error: ${event.error?.message ?? 'unknown'}`));
    this.transport.on('icecandidate', event => this.onIceCandidate(event));
  }

  async createHostInvite() {
    if (this.role !== PEER_ROLES.HOST) throw new Error('Only a host creates an invite');
    await this.transport.createOffer(GUEST_ID);
    this.onStatus('Gathering direct connection routes…');
    const description = await this.transport.waitForIceGatheringComplete(GUEST_ID);
    this.onStatus('Invite ready. Send it to the other Warden.');
    return encodeCoopInvite({v: COOP_INVITE_VERSION, kind: 'offer', description});
  }

  async createOfferForPeer(peerId, {trickle = false} = {}) {
    if (this.role !== PEER_ROLES.HOST) throw new Error('Only a host creates an offer');
    if (this.remotePeerId !== this.remoteId && this.remotePeerId !== peerId) {
      throw new Error('The co-op guest seat is already claimed');
    }
    this.remotePeerId = peerId;
    const offer = await this.transport.createOffer(peerId, trickle ? {iceRestart: false} : undefined);
    if (trickle) return offer;
    return this.transport.waitForIceGatheringComplete(peerId, {allowPartial: true});
  }

  async acceptOfferFromPeer(peerId, description, {trickle = false} = {}) {
    if (this.role !== PEER_ROLES.GUEST) throw new Error('Only a guest accepts a host offer');
    this.remotePeerId = peerId;
    const answer = await this.transport.acceptOffer(peerId, description);
    if (trickle) return answer;
    return this.transport.waitForIceGatheringComplete(peerId, {allowPartial: true});
  }

  async addIceCandidateFromPeer(peerId, candidate) {
    return this.transport.addIceCandidate(peerId, candidate);
  }

  async acceptAnswerFromPeer(peerId, description) {
    if (this.role !== PEER_ROLES.HOST) throw new Error('Only a host accepts a guest answer');
    this.remotePeerId = peerId;
    await this.transport.acceptAnswer(peerId, description);
  }

  async acceptHostInvite(text) {
    if (this.role !== PEER_ROLES.GUEST) throw new Error('Only a guest accepts a host invite');
    const offer = decodeCoopInvite(text, 'offer');
    await this.transport.acceptOffer(HOST_ID, offer.description);
    this.onStatus('Gathering direct connection routes…');
    const description = await this.transport.waitForIceGatheringComplete(HOST_ID);
    this.onStatus('Reply ready. Send it back to the host.');
    return encodeCoopInvite({v: COOP_INVITE_VERSION, kind: 'answer', description});
  }

  async acceptGuestReply(text) {
    if (this.role !== PEER_ROLES.HOST) throw new Error('Only a host accepts the guest reply');
    const answer = decodeCoopInvite(text, 'answer');
    await this.transport.acceptAnswer(GUEST_ID, answer.description);
    this.onStatus('Reply accepted. Opening the direct channel…');
  }

  async channelState(event) {
    if (event.peerId !== this.remotePeerId) {
      this.end('Connection closed: unexpected co-op peer');
      return;
    }
    if (event.channel === 'control') this.controlOpen = event.state === 'open';
    if (event.channel === 'realtime') this.realtimeOpen = event.state === 'open';
    if (event.state === 'closed' && this.connected) {
      this.beginTransportInterruption(`${event.channel}_channel`);
      return;
    }
    if (event.state === 'open' && this.transportInterrupted && this.controlOpen && this.realtimeOpen) {
      this.recoverTransportInterruption();
    }
    if (event.state !== 'open' || this.connected || this.closed) return;
    this.armHandshakeTimeout();
    try {
      if (event.channel === 'control' && !this.helloSent) {
        this.transport.sendControl(event.peerId, COOP_WIRE_MESSAGE_KINDS.HELLO, createCoopHelloV4({
          role: this.role, playerId: this.localId,
          buildHash: COOP_PREVIEW_BUILD_HASH, contentHash: COOP_PREVIEW_CONTENT_HASH,
        }));
        this.helloSent = true;
      }
      await this.finishHandshake();
    } catch (error) {
      this.onStatus(`Could not start co-op: ${error?.message ?? 'unknown error'}`);
      this.end('Connection closed during co-op startup');
    }
  }

  async finishHandshake() {
    if (this.connected || this.closed || this.handshakeStarting
      || !this.controlOpen || !this.realtimeOpen || !this.helloReceived) return false;
    this.handshakeStarting = true;
    this.clearHandshakeTimeout();
    this.onStatus('Compatible peer found. Loading the remote Warden…');
    let avatarTimeout = null;
    try {
      await Promise.race([
        this.ensureAvatar(),
        new Promise((_, reject) => {
          avatarTimeout = setTimeout(() => reject(new Error('Remote Warden loading timed out')), AVATAR_STARTUP_TIMEOUT_MS);
        }),
      ]);
      if (this.closed) return false;
      this.connected = true;
      this.markConnectionHealthy();
      this.onStatus('Connected. Two-Warden seven-night authority active.');
      this.onConnected(this);
      if (this.authority && this.createCheckpoint) this.sendCheckpoint('initial');
      return true;
    } finally {
      if (avatarTimeout) clearTimeout(avatarTimeout);
      this.handshakeStarting = false;
    }
  }

  async ensureAvatar() {
    if (this.remoteAvatar) return this.remoteAvatar;
    if (this.avatarLoadPromise) return this.avatarLoadPromise;
    const generation = this.lifecycleGeneration;
    const loading = (async () => {
      let template = null;
      try {
        template = await loadRemoteWardenTemplate({BABYLON: this.BABYLON, scene: this.scene});
        if (this.closed || generation !== this.lifecycleGeneration) {
          disposeRemoteWardenTemplate(template);
          return null;
        }
        this.remoteAvatar = createRemoteWardenAvatar({
          template,
          playerId: this.remoteId,
          useTemplateInstance: true,
          ownsTemplate: true,
        });
        return this.remoteAvatar;
      } catch (error) {
        if (template) disposeRemoteWardenTemplate(template);
        throw error;
      } finally {
        if (this.avatarLoadPromise === loading) this.avatarLoadPromise = null;
      }
    })();
    this.avatarLoadPromise = loading;
    return loading;
  }

  message({peerId, channel, envelope}) {
    if (peerId !== this.remotePeerId) {
      this.end('Connection closed: unexpected co-op peer data');
      return;
    }
    let message;
    try { message = normalizeCoopWireMessage(envelope.payload); }
    catch (error) {
      this.dropCounts.invalid += 1;
      if (envelope?.payload?.kind === COOP_WIRE_MESSAGE_KINDS.HELLO
        && envelope?.payload?.version !== COOP_WIRE_PROTOCOL_VERSION) {
        this.onStatus('Connection rejected: the other co-op protocol is incompatible.');
        this.end('Connection rejected: incompatible co-op protocol');
      } else this.end(`Connection closed after invalid co-op data: ${error.message}`);
      return;
    }
    try {
    if (message.kind !== COOP_WIRE_MESSAGE_KINDS.HELLO && !this.helloReceived) {
      if (this.pendingPreHelloMessages.length >= MAX_PRE_HELLO_MESSAGES) {
        this.end('Connection closed after pre-compatibility data overflow');
        return;
      }
      this.pendingPreHelloMessages.push({peerId, channel, envelope});
      return;
    }
    if (message.kind === COOP_WIRE_MESSAGE_KINDS.HELLO) {
      this.armHandshakeTimeout();
      const expectedRole = this.role === PEER_ROLES.HOST ? PEER_ROLES.GUEST : PEER_ROLES.HOST;
      if (message.role !== expectedRole
        || message.playerId !== this.remoteId
        || message.buildHash !== COOP_PREVIEW_BUILD_HASH
        || message.contentHash !== COOP_PREVIEW_CONTENT_HASH) {
        this.onStatus('Connection rejected: the other game build is incompatible.');
        this.end('Connection rejected: incompatible game build');
        return;
      }
      this.helloReceived = true;
      const pending = this.pendingPreHelloMessages.splice(0);
      for (const queued of pending) {
        if (this.closed) break;
        this.message(queued);
      }
      void this.finishHandshake().catch(error => this.end(`Connection closed during co-op startup: ${error.message}`));
    } else if (!this.helloReceived) {
      this.end('Connection closed: co-op data arrived before compatibility was verified');
    } else if (channel === 'realtime' && message.kind === COOP_WIRE_MESSAGE_KINDS.COMMAND && this.authority) {
      if (message.command.sequence <= this.lastGuestCommandSequence) {
        this.dropCounts.stale += 1;
        return;
      }
      this.lastGuestCommandSequence = message.command.sequence;
      const previous = this.pendingFrames.at(-1);
      if (previous?.intendedTick === message.command.intendedTick) {
        const merged = mergeCommands(previous, message.command);
        const previousSources = this.pendingFrameEventSources.get(previous.sequence);
        this.pendingFrameEventSources.delete(previous.sequence);
        this.pendingFrameEventSources.set(
          merged.sequence,
          commandEventSourceSequences(message.command, previousSources),
        );
        this.pendingFrames[this.pendingFrames.length - 1] = merged;
      } else {
        this.pendingFrames.push(message.command);
        this.pendingFrameEventSources.set(
          message.command.sequence,
          commandEventSourceSequences(message.command),
        );
      }
      if (this.pendingFrames.length > MAX_PENDING_GUEST_COMMANDS) {
        this.end('Connection closed after guest input overflow');
      }
    } else if (channel === 'realtime' && message.kind === COOP_WIRE_MESSAGE_KINDS.WORLD_FRAME && !this.authority) {
      if (this.latestFrame && message.authorityTick <= this.latestFrame.authorityTick) {
        this.dropCounts.stale += 1;
        return;
      }
      this.latestFrame = message;
      this.applyFrame(message);
      this.onWorldFrame(message, this);
    } else if (channel === 'control' && message.kind === COOP_WIRE_MESSAGE_KINDS.ACTION_REQUEST && this.authority) {
      let ack;
      try {
        ack = this.actionLedger.execute(message, request => {
          if (typeof this.onActionRequest !== 'function') {
            return {requestId: request.requestId, action: request.action, status: 'rejected', reason: 'action_not_available', result: null, authoritativeTick: this.authority.tick};
          }
          const outcome = this.onActionRequest(request, this) ?? {};
          return {requestId: request.requestId, action: request.action, status: outcome.status ?? 'accepted', reason: outcome.reason ?? null,
            result: null, authoritativeTick: outcome.authoritativeTick ?? this.authority.tick};
        });
      } catch (error) {
        ack = createCoopActionAck({requestId: message.requestId, action: message.action, status: 'rejected',
          reason: coerceCoopActionRejectionCode(error), result: null, authoritativeTick: this.authority.tick});
      }
      this.transport.sendControl(this.remotePeerId, COOP_WIRE_MESSAGE_KINDS.ACTION_ACK, ack);
    } else if (channel === 'control' && message.kind === COOP_WIRE_MESSAGE_KINDS.ACTION_ACK && !this.authority) {
      this.lastActionAck = message;
      this.onActionAck(message, this);
    } else if (channel === 'control' && message.kind === COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_OFFER && !this.authority) {
      const current = this.checkpointAssembler?.offer;
      if (current?.transferId === message.transferId && current.checkpointHash === message.checkpointHash) return;
      if ((this.checkpointTransferIdentities.has(message.transferId) && current?.transferId !== message.transferId)
        || checkpointTransferIsOlder(message, current)
        || checkpointTransferIsOlder(message, this.lastCheckpointTransferId)) {
        this.dropCounts.stale += 1;
        return;
      }
      this.checkpointTransferIdentities.delete(message.transferId);
      this.checkpointTransferIdentities.set(message.transferId, message.checkpointHash);
      while (this.checkpointTransferIdentities.size > MAX_CHECKPOINT_TRANSFER_IDENTITIES) {
        this.checkpointTransferIdentities.delete(this.checkpointTransferIdentities.keys().next().value);
      }
      this.checkpointAssembler = new CheckpointAssembler(message);
    } else if (channel === 'control' && message.kind === COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_CHUNK && !this.authority) {
      if (!this.checkpointAssembler) {
        this.dropCounts.stale += 1;
        return;
      }
      if (message.transferId !== this.checkpointAssembler.offer.transferId
        || message.stateHash !== this.checkpointAssembler.offer.stateHash
        || message.checkpointHash !== this.checkpointAssembler.offer.checkpointHash) {
        this.dropCounts.stale += 1;
        return;
      }
      this.checkpointAssembler.add(message);
      if (this.checkpointAssembler.parts.length === this.checkpointAssembler.offer.totalChunks) {
        const checkpoint = this.checkpointAssembler.assemble();
        const offer = this.checkpointAssembler.offer;
        const duplicate = this.lastAppliedCheckpoint?.stateHash === offer.stateHash
          && this.lastAppliedCheckpoint?.checkpointHash === offer.checkpointHash;
        if (!duplicate) {
          const applied = this.applyCheckpoint?.(checkpoint, offer, this);
          if (applied !== true) throw new Error('checkpoint application was rejected');
          this.lastAppliedCheckpoint = Object.freeze({
            stateHash: offer.stateHash,
            checkpointHash: offer.checkpointHash,
          });
        }
        this.lastCheckpointTransferId = offer.transferId;
        this.checkpointTransferIdentities.delete(offer.transferId);
        this.checkpointTransferIdentities.set(offer.transferId, offer.checkpointHash);
        this.transport.sendControl(this.remotePeerId, COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_APPLIED,
          createCoopCheckpointApplied({transferId: offer.transferId, stateHash: offer.stateHash}));
        this.checkpointAssembler = null;
      }
    } else if (channel === 'control' && message.kind === COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_APPLIED && this.authority) {
      const pending = this.pendingCheckpoint;
      if (!pending) {
        const confirmedHash = this.confirmedCheckpointTransfers.get(message.transferId);
        if (confirmedHash === message.stateHash) return;
        if (confirmedHash !== undefined) {
          this.end('Connection closed after checkpoint acknowledgement mismatch');
          return;
        }
        this.end('Connection closed after stale checkpoint acknowledgement');
        return;
      }
      const exact = message.transferId === pending.transferId;
      const superseded = pending.superseded.find(item => item.transferId === message.transferId);
      if (!exact && !superseded) {
        this.end('Connection closed after checkpoint acknowledgement mismatch');
        return;
      }
      const expectedHash = exact ? pending.stateHash : superseded.stateHash;
      if (message.stateHash !== expectedHash) {
        this.end('Connection closed after checkpoint acknowledgement mismatch');
        return;
      }
      if (!exact && expectedHash !== pending.stateHash) return;
      this.pendingCheckpoint = null;
      this.lastCheckpointTransferId = message.transferId;
      this.lastConfirmedCheckpoint = Object.freeze({
        transferId: message.transferId,
        stateHash: message.stateHash,
        authorityTick: pending.authorityTick,
        reason: pending.reason,
      });
      for (const item of [{transferId: pending.transferId, stateHash: pending.stateHash}, ...pending.superseded]) {
        if (item.stateHash !== pending.stateHash) continue;
        this.confirmedCheckpointTransfers.delete(item.transferId);
        this.confirmedCheckpointTransfers.set(item.transferId, item.stateHash);
      }
      while (this.confirmedCheckpointTransfers.size > MAX_CONFIRMED_CHECKPOINT_TRANSFERS) {
        this.confirmedCheckpointTransfers.delete(this.confirmedCheckpointTransfers.keys().next().value);
      }
      if (this.resumeDeferred && pending.reason !== 'resume' && pending.reason !== 'authority_resumed') {
        const deferredReason = this.resumeDeferredReason ?? 'resume';
        this.resumeDeferred = false;
        this.resumeDeferredReason = null;
        if (!this.sendCheckpoint(deferredReason)) this.end('Connection closed: could not create resume checkpoint');
        return;
      }
      if (pending.reason === 'resume' || pending.reason === 'authority_resumed') {
        this.resumeDeferred = false;
        this.resumeDeferredReason = null;
        this.authorityPaused = false;
        this.markConnectionHealthy();
        this.transport.sendControl(this.remotePeerId, COOP_WIRE_MESSAGE_KINDS.AUTHORITY_RESUMED,
          createCoopAuthorityResumed({tick: this.authority.tick, stateHash: pending.stateHash}));
      }
      if (this.queuedCheckpointReason) {
        const queuedReason = this.queuedCheckpointReason;
        this.queuedCheckpointReason = null;
        if (!this.sendCheckpoint(queuedReason)) this.end('Connection closed: could not create queued checkpoint');
      }
    } else if (channel === 'control' && message.kind === COOP_WIRE_MESSAGE_KINDS.RESUME && this.authority) {
      this.authorityPaused = true;
      if (this.pendingCheckpoint) {
        if (!['resume', 'authority_resumed'].includes(this.pendingCheckpoint.reason)) {
          this.resumeDeferred = true;
          this.resumeDeferredReason = 'resume';
        }
      } else if (!this.sendCheckpoint('resume')) this.end('Connection closed: could not create resume checkpoint');
    } else if (channel === 'control' && message.kind === COOP_WIRE_MESSAGE_KINDS.AUTHORITY_PAUSED && !this.authority) {
      this.authorityPaused = true;
      this.onAuthorityPaused(message, this);
    } else if (channel === 'control' && message.kind === COOP_WIRE_MESSAGE_KINDS.AUTHORITY_RESUMED && !this.authority) {
      this.authorityPaused = false;
      this.markConnectionHealthy();
      this.onAuthorityResumed(message, this);
    } else if (channel === 'control' && message.kind === COOP_WIRE_MESSAGE_KINDS.SESSION_ENDED) {
      this.end(`Co-op session ended: ${message.reason}`);
    }
    } catch (error) {
      this.dropCounts.invalid += 1;
      this.end(`Connection closed after invalid co-op data: ${error.message}`);
    }
  }

  connectionState(event) {
    if (event?.state === 'disconnected') {
      this.beginTransportInterruption('connection');
      return;
    }
    if (event?.state === 'connected') {
      if (this.transportInterrupted && this.controlOpen && this.realtimeOpen) this.recoverTransportInterruption();
      if (this.helloReceived && this.controlOpen && this.realtimeOpen && !this.closed) {
        this.connected = true;
      }
      return;
    }
    if (['failed', 'closed'].includes(event?.state)) {
      this.healthFailure = event.state === 'failed' ? 'transport_failed' : 'transport_closed';
      this.end(`Connection ${event.state}`);
    }
  }

  beginTransportInterruption(cause = 'connection') {
    if (this.closed || this.transportInterrupted) return false;
    this.transportInterrupted = true;
    this.interruptionCause = cause;
    this.authorityPaused = true;
    this.healthState = 'interrupted';
    this.healthInterruptions += 1;
    this.onStatus('Connection interrupted · attempting to recover');
    this.interruptionTimer = this.setTimer(() => {
      this.interruptionTimer = null;
      if (!this.transportInterrupted || this.closed) return;
      const channel = this.interruptionCause?.endsWith('_channel')
        ? this.interruptionCause.slice(0, -'_channel'.length)
        : null;
      this.healthFailure = channel ? `${channel}_channel_timeout` : 'interruption_timeout';
      this.end(channel
        ? `Connection failed after the ${channel} channel closed`
        : 'Connection failed after a temporary interruption');
    }, this.connectionInterruptionGraceMs);
    return true;
  }

  recoverTransportInterruption() {
    if (!this.transportInterrupted || this.closed) return false;
    this.transportInterrupted = false;
    this.interruptionCause = null;
    if (this.interruptionTimer !== null) this.clearTimer(this.interruptionTimer);
    this.healthState = 'recovering';
    this.healthRecoveries += 1;
    this.onStatus('Connection restored · synchronizing with the co-op peer');
    this.interruptionTimer = this.setTimer(() => {
      this.interruptionTimer = null;
      if (this.closed || this.healthState !== 'recovering') return;
      this.healthFailure = 'recovery_timeout';
      this.end('Connection failed while synchronizing after recovery');
    }, this.checkpointAckTimeoutMs);
    if (!this.authority) {
      this.requestResume();
    } else if (typeof this.createCheckpoint === 'function') {
      if (this.pendingCheckpoint) {
        if (!['resume', 'authority_resumed'].includes(this.pendingCheckpoint.reason)) {
          this.resumeDeferred = true;
          this.resumeDeferredReason = 'resume';
        }
      } else if (!this.sendCheckpoint('resume')) {
        this.end('Connection closed: could not create resume checkpoint');
      }
    }
    return true;
  }

  markConnectionHealthy() {
    if (this.closed) return false;
    if (this.interruptionTimer !== null) {
      this.clearTimer(this.interruptionTimer);
      this.interruptionTimer = null;
    }
    this.transportInterrupted = false;
    this.interruptionCause = null;
    this.healthState = 'healthy';
    this.healthFailure = null;
    return true;
  }

  pollConnectionHealth(now = this.now()) {
    if (this.closed) return false;
    let peer = null;
    try { peer = this.transport.getPeerState?.(this.remotePeerId) ?? null; }
    catch { return true; }
    if (!peer) return true;
    if (Number.isFinite(peer?.lastReceivedAt)) this.lastReceivedAt = peer.lastReceivedAt;
    if (Number.isFinite(peer?.lastSentAt)) this.lastSentAt = peer.lastSentAt;
    if (!this.connected || this.transportInterrupted || this.healthState === 'recovering'
      || this.authorityPaused || peer.controlState !== 'open' || peer.realtimeState !== 'open') return true;
    if (Math.max(0, now - this.lastReceivedAt) <= this.peerSilenceTimeoutMs) {
      this.markConnectionHealthy();
      return true;
    }
    this.healthFailure = 'peer_silent';
    this.end('Connection failed: no data received from the co-op peer');
    return false;
  }

  dropped(event) {
    if (event?.peerId !== this.remotePeerId) {
      this.end('Connection closed: unexpected co-op peer packet');
      return;
    }
    const reason = event?.reason;
    if (reason === 'rate-limit') this.lastDropBudget = Object.freeze({
      channel: event.channel ?? null,
      messages: Number(event.messages) || 0,
      codeUnits: Number(event.codeUnits) || 0,
      elapsedMs: Number(event.elapsedMs) || 0,
    });
    if (reason === 'backpressure') this.dropCounts.backpressure += 1;
    else if (reason === 'stale') this.dropCounts.stale += 1;
    else if (reason === 'not-open') this.dropCounts.notOpen += 1;
    else if (reason === 'invalid-message') {
      this.dropCounts.invalid += 1;
      this.end('Connection closed after an invalid co-op packet');
    } else if (reason === 'rate-limit') {
      this.dropCounts.other += 1;
      this.end('Connection closed: co-op peer exceeded the packet budget');
    } else this.dropCounts.other += 1;
  }

  sendAction(action, payload = {}, options = {}) {
    if (this.authority || !this.connected || this.closed) return null;
    const stream = options.stream ?? actionStream(action);
    // Reconnected guests derive a fresh monotonic range from host authority.
    // This cannot collide with the bounded per-stream ledger from an earlier
    // connection even when the local preview object was recreated.
    const authorityFloor = Math.min(0xffffffff - 1024, (this.latestFrame?.authorityTick ?? 0) * 1024);
    const sequence = Math.max(this.actionSequences.get(stream) ?? -1, authorityFloor) + 1;
    this.actionSequences.set(stream, sequence);
    const request = createCoopActionRequest({
      requestId: `${this.localId}:${stream}:${sequence}`,
      peerId: this.localId,
      stream,
      sequence,
      action,
      payload,
      clientTick: this.latestFrame?.authorityTick ?? 0,
    });
    this.transport.sendControl(this.remotePeerId, COOP_WIRE_MESSAGE_KINDS.ACTION_REQUEST, request);
    return request.requestId;
  }

  sendCheckpoint(reason = 'sync', {attempt = 0, superseded = []} = {}) {
    if (!this.authority || !this.connected || this.closed || typeof this.createCheckpoint !== 'function') return false;
    if (this.pendingCheckpoint) return false;
    const supplied = this.createCheckpoint({reason, tick: this.authority.tick}, this);
    const checkpoint = supplied?.checkpoint ?? supplied;
    if (!checkpoint || typeof checkpoint !== 'object') return false;
    const encodedCheckpoint = encodeCheckpoint(checkpoint);
    const transferId = `cp-${this.authority.tick}-${this.actionSequence++}`;
    const offer = createCoopCheckpointOffer({
      transferId,
      encodedCheckpoint,
      stateHash: supplied?.stateHash ?? `tick-${this.authority.tick}`,
    });
    this.pendingCheckpoint = Object.freeze({
      transferId,
      stateHash: offer.stateHash,
      authorityTick: this.authority.tick,
      reason,
      attempt,
      deadlineAt: this.now() + this.checkpointAckTimeoutMs,
      superseded: Object.freeze(superseded.map(item => Object.freeze({...item}))),
    });
    this.transport.sendControl(this.remotePeerId, COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_OFFER, offer);
    for (const chunk of createCoopCheckpointChunks({offer, encodedCheckpoint})) {
      this.transport.sendControl(this.remotePeerId, COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_CHUNK, chunk);
    }
    return true;
  }

  queueCheckpoint(reason = 'sync') {
    if (!this.authority || !this.connected || this.closed || typeof this.createCheckpoint !== 'function') return false;
    if (this.pendingCheckpoint) {
      this.queuedCheckpointReason = reason;
      return true;
    }
    return this.sendCheckpoint(reason);
  }

  pollCheckpointTransfer(now = this.now()) {
    const pending = this.pendingCheckpoint;
    if (!pending || this.closed) return false;
    if (!Number.isFinite(now) || now < pending.deadlineAt) return true;
    this.pendingCheckpoint = null;
    if (pending.attempt < 1) return this.sendCheckpoint(pending.reason, {attempt: pending.attempt + 1,
      superseded: [...pending.superseded, {transferId: pending.transferId, stateHash: pending.stateHash}]});
    this.end('Connection closed: checkpoint acknowledgement timed out');
    return false;
  }

  requestResume() {
    if (this.authority || this.closed || !this.controlOpen) return false;
    this.authorityPaused = true;
    const stateHash = this.latestFrame?.stateHash ?? 'no-state';
    this.transport.sendControl(this.remotePeerId, COOP_WIRE_MESSAGE_KINDS.RESUME, createCoopResume({
      transferId: this.lastCheckpointTransferId,
      lastAppliedTick: this.latestFrame?.authorityTick ?? 0,
      lastAppliedEventSequence: this.lastAppliedEventSequence ?? this.latestFrame?.eventCursor ?? 0,
      stateHash,
    }));
    return true;
  }

  setAuthorityPaused(paused, reason = 'host_background') {
    if (!this.authority || this.closed) return false;
    const requestedPause = Boolean(paused);
    this.authorityPaused = requestedPause || this.authorityPaused;
    if (this.controlOpen || this.connected) {
      if (requestedPause) {
        const message = createCoopAuthorityPaused({tick: this.authority.tick, reason});
        this.transport.sendControl(this.remotePeerId, COOP_WIRE_MESSAGE_KINDS.AUTHORITY_PAUSED, message);
      } else {
        this.authorityPaused = true;
        if (this.pendingCheckpoint) {
          if (!['resume', 'authority_resumed'].includes(this.pendingCheckpoint.reason)) {
            this.resumeDeferred = true;
            this.resumeDeferredReason = 'authority_resumed';
          }
          return true;
        }
        if (!this.sendCheckpoint('authority_resumed')) {
          this.end('Connection closed: could not create resume checkpoint');
          return false;
        }
      }
    }
    return true;
  }

  armHandshakeTimeout() {
    if (this.handshakeTimer || this.connected || this.closed) return;
    this.handshakeTimer = setTimeout(() => {
      this.handshakeTimer = null;
      this.end('Connection closed: co-op compatibility handshake timed out');
    }, HANDSHAKE_TIMEOUT_MS);
  }

  clearHandshakeTimeout() {
    if (!this.handshakeTimer) return;
    clearTimeout(this.handshakeTimer);
    this.handshakeTimer = null;
  }

  diagnostics() {
    let peer = null;
    try { peer = this.transport.getPeerState?.(this.remotePeerId) ?? null; }
    catch { /* negotiation has not created the peer yet */ }
    const players = this.authority
      ? [...this.authority.players.values()]
      : this.latestFrame?.players ?? [];
    if (Number.isFinite(peer?.lastReceivedAt)) this.lastReceivedAt = peer.lastReceivedAt;
    if (Number.isFinite(peer?.lastSentAt)) this.lastSentAt = peer.lastSentAt;
    return Object.freeze({
      role: this.role,
      connected: this.connected,
      closed: this.closed,
      authorityPaused: this.authorityPaused,
      lastCheckpointTransferId: this.lastCheckpointTransferId,
      pendingCheckpoint: this.pendingCheckpoint ? Object.freeze({...this.pendingCheckpoint}) : null,
      queuedCheckpointReason: this.queuedCheckpointReason,
      lastConfirmedCheckpoint: this.lastConfirmedCheckpoint ? Object.freeze({...this.lastConfirmedCheckpoint}) : null,
      lastAppliedCheckpoint: this.lastAppliedCheckpoint ? Object.freeze({...this.lastAppliedCheckpoint}) : null,
      resumeDeferred: this.resumeDeferred,
      lastActionAck: this.lastActionAck ? Object.freeze({...this.lastActionAck}) : null,
      stateHash: this.latestFrame?.stateHash ?? null,
      compatibilityVerified: this.helloReceived,
      authorityTick: this.authority?.tick ?? this.latestFrame?.authorityTick ?? 0,
      controlState: peer?.controlState ?? (this.controlOpen ? 'open' : 'missing'),
      realtimeState: peer?.realtimeState ?? (this.realtimeOpen ? 'open' : 'missing'),
      relayConfigured: Boolean(this.transport.iceConfiguration?.iceServers?.some(server => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some(url => typeof url === 'string' && /^turns?:/u.test(url));
      })),
      drops: Object.freeze({...this.dropCounts}),
      lastDropBudget: this.lastDropBudget,
      authorityEvents: Object.freeze({...this.authorityEventCounts}),
      health: Object.freeze({
        state: this.healthState,
        failure: this.healthFailure,
        interruptions: this.healthInterruptions,
        recoveries: this.healthRecoveries,
        lastReceivedAt: this.lastReceivedAt,
        lastSentAt: this.lastSentAt,
        silenceMs: Math.max(0, this.now() - this.lastReceivedAt),
      }),
      players: Object.freeze(players.map(player => Object.freeze({
        playerId: player.playerId,
        position: Object.freeze({...player.position}),
        hp: player.hp,
        maxHp: player.maxHp,
      }))),
    });
  }

  setAuthorityPhase(phase) {
    if (!this.authority || !Object.values(GAME_PHASES).includes(phase)) return false;
    this.authority.phase = phase;
    return true;
  }

  setAllowedWeapons(slots) {
    if (!this.authority || !Array.isArray(slots) || slots.length < 1 || slots.length > 3
      || new Set(slots).size !== slots.length
      || slots.some(slot => !Number.isInteger(slot) || slot < 0 || slot > 2)) return false;
    for (const state of this.authority.weaponStates.values()) {
      if (!slots.includes(state.selectedWeapon)) return false;
    }
    for (const [playerId, state] of this.authority.weaponStates) {
      this.authority.weaponStates.set(playerId, createSessionWeaponState({...state, allowedWeapons: [...slots]}));
    }
    return true;
  }

  stageActionLedger(snapshot) {
    return CoopActionRequestLedger.restore(snapshot);
  }

  installActionLedger(ledger) {
    if (!(ledger instanceof CoopActionRequestLedger) || this.role !== 'host') return false;
    this.actionLedger = ledger;
    return true;
  }

  playerState(playerId) {
    return this.authority?.players?.get(playerId)
      ?? this.latestFrame?.players?.find(player => player.playerId === playerId)
      ?? null;
  }

  applyPlayerDamage(playerId, amount, cooldown = 0.35) {
    if (!this.authority?.players?.has(playerId)) return 0;
    const previous = this.authority.players.get(playerId);
    if (previous.hp <= 0 || previous.damageCooldown > 0) return 0;
    const applied = Math.min(previous.hp, Math.max(0, Number(amount) || 0));
    if (applied <= 0) return 0;
    const next = createNetworkPlayerState({
      ...previous,
      hp: previous.hp - applied,
      damageCooldown: Math.max(0, Number(cooldown) || 0),
    });
    this.authority.players.set(playerId, next);
    if (playerId === this.localId) applyNetworkPlayerState(this.localPlayer, next);
    return applied;
  }

  applyFrame(frame) {
    const local = frame.players.find(player => player.playerId === this.localId);
    const remote = frame.players.find(player => player.playerId === this.remoteId);
    if (local) applyNetworkPlayerState(this.localPlayer, local);
    if (remote && this.remoteAvatar) this.remoteAvatar.push(frame.authorityTick, remote);
  }

  applyCheckpointFrame(frame) {
    this.remoteAvatar?.interpolation?.clear?.();
    this.applyFrame(frame);
    this.latestFrame = {...(this.latestFrame ?? {}), authorityTick: frame.authorityTick, players: frame.players};
  }

  end(reason) {
    if (this.closed) return;
    this.healthState = 'terminal';
    this.connected = false;
    this.onStatus(reason);
    this.onEnded(reason, this);
    if (!this.closed) this.close();
  }

  update(dt, inputFrame) {
    if (!this.pollConnectionHealth()) return false;
    if (this.authority && this.pendingCheckpoint) this.pollCheckpointTransfer();
    if (!this.connected || this.closed || this.authorityPaused) return false;
    // Both roles must finish the initial checkpoint exchange before gameplay
    // can emit realtime input. Control and realtime data channels are
    // independent, so a peer may have seen our HELLO while our HELLO or the
    // initial checkpoint acknowledgement is still in flight on control.
    const checkpointReady = this.authority
      ? (typeof this.createCheckpoint !== 'function' || Boolean(this.lastConfirmedCheckpoint))
      : (typeof this.applyCheckpoint !== 'function' || Boolean(this.lastAppliedCheckpoint));
    if (!checkpointReady) return false;
    inputFrame = inputFrame ?? NEUTRAL_INPUT_FRAME;
    this.pendingInput = {
      ...inputFrame,
      move: {...inputFrame.move},
      look: {
        yaw: (this.pendingInput?.look?.yaw ?? 0) + inputFrame.look.yaw,
        pitch: (this.pendingInput?.look?.pitch ?? 0) + inputFrame.look.pitch,
      },
      fire: Boolean(this.pendingInput?.fire || inputFrame.fire),
      interact: Boolean(this.pendingInput?.interact || inputFrame.interact),
      jump: Boolean(this.pendingInput?.jump || inputFrame.jump),
      slide: Boolean(this.pendingInput?.slide || inputFrame.slide),
      melee: Boolean(this.pendingInput?.melee || inputFrame.melee),
      aiming: inputFrame.aiming === true,
      manualVent: Boolean(this.pendingInput?.manualVent || inputFrame.manualVent),
      selectedWeapon: inputFrame.selectedWeapon ?? this.pendingInput?.selectedWeapon ?? null,
    };
    this.accumulator = Math.min(0.25, this.accumulator + Math.max(0, dt));
    while (this.accumulator >= AUTHORITY_STEP) {
      this.accumulator -= AUTHORITY_STEP;
      const tick = this.authority?.tick ?? this.latestFrame?.authorityTick ?? 0;
      const command = playerCommandFromInputFrame({
        frame: this.pendingInput,
        sequence: this.sequence++,
        intendedTick: tick + 1,
        acknowledgedServerTick: tick,
      });
      // Fire is held across catch-up ticks; a queued tap already released in
      // this frame is consumed once, like the other action edges.
      this.pendingInput = {...this.pendingInput, look: {yaw: 0, pitch: 0}, fire: inputFrame.fire === true, interact: false, jump: false, slide: false, melee: false, manualVent: false, selectedWeapon: null};
      if (this.authority) {
        const commands = {[this.localId]: command};
        const commandSources = new Map([[this.localId, [{
          command,
          eventSources: commandEventSourceSequences(command),
        }]]]);
        let result;
        try {
          const pendingFrames = this.pendingFrames.splice(0);
          if (pendingFrames.length > 0) {
            const rebasedFrames = pendingFrames
              .map(frame => ({
                command: rebasePlayerCommandForAuthority(frame, this.authority.tick),
                eventSources: this.pendingFrameEventSources.get(frame.sequence)
                  ?? commandEventSourceSequences(frame),
              }))
              .sort((left, right) => left.command.sequence - right.command.sequence);
            for (const frame of pendingFrames) this.pendingFrameEventSources.delete(frame.sequence);
            const newestFrame = rebasedFrames.at(-1).command;
            const mergedLook = rebasedFrames.reduce((look, frame) => ({
              yaw: boundedLookDelta(look.yaw + frame.command.look.yaw),
              pitch: boundedLookDelta(look.pitch + frame.command.look.pitch),
            }), {yaw: 0, pitch: 0});
            const latestWeapon = [...rebasedFrames].reverse()
              .find(frame => frame.command.selectedWeapon !== null && frame.command.selectedWeapon !== undefined)
              ?.command.selectedWeapon ?? null;
            commands[this.remoteId] = {
              ...newestFrame,
              look: mergedLook,
              // Several realtime packets can arrive between authority ticks.
              // Movement is latest-wins, but input edges must survive a later
              // neutral packet or attacks/jumps disappear nondeterministically.
              actions: (rebasedFrames.reduce((mask, frame) => mask | frame.command.actions, 0)
                & PLAYER_COMMAND_EDGE_ACTIONS)
                | (newestFrame.actions & PLAYER_COMMAND_HELD_ACTIONS),
              selectedWeapon: latestWeapon,
              manualVent: rebasedFrames.some(frame => frame.command.manualVent),
            };
            commandSources.set(this.remoteId, rebasedFrames);
          }
          result = stepSession(this.authority, commands);
        } catch {
          this.end('Connection closed after invalid guest input');
          return false;
        }
        const eventCommandSequences = Object.fromEntries(result.events.map(event => {
          const mask = actionMaskForAuthorityEvent(event);
          const sources = commandSources.get(event.actorId) ?? [];
          const source = [...sources].reverse().find(frame => mask === null
            ? frame.command.manualVent === true
            : (frame.command.actions & mask) !== 0) ?? sources.at(-1);
          return [event.sequence, eventSourceSequence(event, source)];
        }));
        this.onAuthorityEvents(result.events, this, Object.freeze({
          eventCommandSequences: Object.freeze(eventCommandSequences),
        }));
        for (const event of result.events) {
          if (event.kind in this.authorityEventCounts) this.authorityEventCounts[event.kind] += 1;
        }
        const local = this.authority.players.get(this.localId);
        if (local) applyNetworkPlayerState(this.localPlayer, local);
        let frame;
        try {
          frame = typeof this.createWorldFrame === 'function'
          ? createCoopWorldFrame(this.createWorldFrame({
            tick: result.tick,
            players: [...this.authority.players.values()],
            events: result.events,
          }, this))
          : createCoopWorldFrame({
            authorityTick: result.tick, night: 1, phase: this.authority.phase, subphase: 'movement', wave: 0,
            players: [...this.authority.players.values()], crowd: {total: 0, active: 0, dying: 0, dead: 0, released: 0, unreleased: 0, cohort: []},
            boss: null, objective: null, resources: {supplies: 0, earnedOathmarks: 0, pendingWeaponXp: {arbalest: 0, sunfire: 0, runebolt: 0}, sharedRevive: {available: false, consumed: false, reviveHp: 0}},
            gates: [], fortifications: [], hub: {phase: this.authority.phase, npcs: []},
            narrative: emptyNarrativeFrameState(),
            events: result.events.map(event => ({sequence: event.sequence, authorityTick: result.tick, category: 'combat', kind: event.kind, actorId: event.actorId, payload: {}})),
            eventCursor: this.authority.eventSequence, stateHash: `tick-${result.tick}`,
          });
        } catch (error) {
          console.error('[Briarhold co-op] Could not publish authority frame', error);
          this.end(`Connection closed after authority frame failure: ${error.message}`);
          return false;
        }
        this.latestFrame = frame;
        this.applyFrame(frame);
        this.transport.broadcastRealtime(COOP_WIRE_MESSAGE_KINDS.WORLD_FRAME, frame);
      } else {
        this.onLocalCommand(command, this);
        this.transport.sendRealtime(this.remotePeerId, COOP_WIRE_MESSAGE_KINDS.COMMAND, createCoopCommandV2(command));
      }
    }
    const estimatedTick = (this.authority?.tick ?? this.latestFrame?.authorityTick ?? 0) + this.accumulator * 30;
    this.remoteAvatar?.update(estimatedTick);
    return true;
  }

  close() {
    if (this.closed) return;
    this.lifecycleGeneration += 1;
    this.clearHandshakeTimeout();
    if (this.interruptionTimer !== null) this.clearTimer(this.interruptionTimer);
    this.interruptionTimer = null;
    this.pendingCheckpoint = null;
    this.pendingFrameEventSources.clear();
    this.pendingPreHelloMessages.length = 0;
    this.queuedCheckpointReason = null;
    this.confirmedCheckpointTransfers.clear();
    this.checkpointTransferIdentities.clear();
    this.resumeDeferred = false;
    this.resumeDeferredReason = null;
    if (this.authority && this.controlOpen) {
      try {
        const message = createCoopSessionEnded({reason: 'host_left'});
        this.transport.sendControl(this.remotePeerId, COOP_WIRE_MESSAGE_KINDS.SESSION_ENDED, message);
      } catch { /* transport may already be unavailable */ }
    }
    this.closed = true;
    this.connected = false;
    this.remoteAvatar?.dispose();
    this.remoteAvatar = null;
    this.transport.close();
  }
}

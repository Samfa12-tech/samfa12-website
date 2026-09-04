import {createBattlefield} from './battlefield.js';
import {BRIARHOLD_VERSION, GAME_PHASES, PLAYER_DEFAULTS} from './contracts.js';
import {
  applyNetworkPlayerState,
  playerCommandFromInputFrame,
  rebasePlayerCommandForAuthority,
} from './coop-session.js';
import {
  COOP_WIRE_MESSAGE_KINDS,
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
  createNetworkPlayerState,
  createSessionWeaponState,
  createSessionConfig,
  sessionWeaponStateFromPlayer,
} from './multiplayer-contracts.js';
import {createSessionState, stepSession} from './multiplayer-session-core.js';
import {PEER_ROLES, createPeerTransport} from './peer-transport.js';
import {createPlayerState} from './player-controller.js';
import {createRemoteWardenAvatar, loadRemoteWardenTemplate} from './remote-warden.js';

export const COOP_PREVIEW_BUILD_HASH = BRIARHOLD_VERSION;
export const COOP_PREVIEW_CONTENT_HASH = 'seven-night-campaign-v4-narrative-1';
export const COOP_INVITE_VERSION = 1;

const HOST_ID = 'warden-host';
const GUEST_ID = 'warden-guest';
const AUTHORITY_STEP = 1 / 30;
const HANDSHAKE_TIMEOUT_MS = 15000;
const AVATAR_STARTUP_TIMEOUT_MS = 90000;
export const CHECKPOINT_ACK_TIMEOUT_MS = 30000;
const MAX_PENDING_GUEST_COMMANDS = 64;
const MAX_CONFIRMED_CHECKPOINT_TRANSFERS = 16;
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
    this.onActionRequest = onActionRequest;
    this.onActionAck = onActionAck;
    this.createWorldFrame = createWorldFrame;
    this.onWorldFrame = onWorldFrame;
    this.createCheckpoint = createCheckpoint;
    this.applyCheckpoint = applyCheckpoint;
    this.onAuthorityPaused = onAuthorityPaused;
    this.onAuthorityResumed = onAuthorityResumed;
    this.onIceCandidate = onIceCandidate;
    this.transport = transport ?? createPeerTransport({role, turnServers});
    this.now = typeof now === 'function' ? now : (() => Date.now());
    if (!Number.isFinite(checkpointAckTimeoutMs) || checkpointAckTimeoutMs < 10 || checkpointAckTimeoutMs > 120000) {
      throw new RangeError('checkpoint acknowledgement timeout must be bounded');
    }
    this.checkpointAckTimeoutMs = checkpointAckTimeoutMs;
    this.authority = role === PEER_ROLES.HOST ? createAuthority(resolveWeaponTuning) : null;
    this.remoteAvatar = null;
    this.accumulator = 0;
    this.sequence = 0;
    this.latestFrame = null;
    this.pendingFrames = [];
    this.connected = false;
    this.closed = false;
    this.pendingInput = null;
    this.controlOpen = false;
    this.realtimeOpen = false;
    this.helloReceived = false;
    this.helloSent = false;
    this.handshakeStarting = false;
    this.handshakeTimer = null;
    this.authorityPaused = false;
    this.actionSequence = 0;
    this.actionSequences = new Map();
    this.lastActionAck = null;
    this.actionLedger = role === PEER_ROLES.HOST
      ? new CoopActionRequestLedger({peerId: this.remoteId})
      : null;
    this.checkpointAssembler = null;
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
    const template = await loadRemoteWardenTemplate({BABYLON: this.BABYLON, scene: this.scene});
    this.remoteAvatar = createRemoteWardenAvatar({template, playerId: this.remoteId, useTemplateInstance: true});
    return this.remoteAvatar;
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
        && envelope?.payload?.version !== 4) {
        this.onStatus('Connection rejected: the other co-op protocol is incompatible.');
        this.end('Connection rejected: incompatible co-op protocol');
      } else this.end(`Connection closed after invalid co-op data: ${error.message}`);
      return;
    }
    try {
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
      void this.finishHandshake().catch(error => this.end(`Connection closed during co-op startup: ${error.message}`));
    } else if (!this.helloReceived) {
      this.end('Connection closed: co-op data arrived before compatibility was verified');
    } else if (channel === 'realtime' && message.kind === COOP_WIRE_MESSAGE_KINDS.COMMAND && this.authority) {
      const previous = this.pendingFrames.at(-1);
      if (previous?.intendedTick === message.command.intendedTick) {
        this.pendingFrames[this.pendingFrames.length - 1] = {
          ...message.command,
          actions: previous.actions | message.command.actions,
        };
      } else this.pendingFrames.push(message.command);
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
      this.checkpointAssembler = new CheckpointAssembler(message);
    } else if (channel === 'control' && message.kind === COOP_WIRE_MESSAGE_KINDS.CHECKPOINT_CHUNK && !this.authority) {
      if (!this.checkpointAssembler) throw new RangeError('checkpoint chunk arrived before its offer');
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
      this.end('Connection interrupted');
      return;
    }
    if (event?.state === 'connected') {
      if (this.helloReceived && this.controlOpen && this.realtimeOpen && !this.closed) {
        this.connected = true;
      }
      return;
    }
    if (['failed', 'closed'].includes(event?.state)) this.end(`Connection ${event.state}`);
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
    this.connected = false;
    this.onStatus(reason);
    this.onEnded(reason, this);
    if (!this.closed) this.close();
  }

  update(dt, inputFrame) {
    if (this.authority && this.pendingCheckpoint) this.pollCheckpointTransfer();
    if (!this.connected || this.closed || this.authorityPaused) return false;
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
      this.pendingInput = {...this.pendingInput, look: {yaw: 0, pitch: 0}, fire: false, interact: false, jump: false, slide: false, melee: false, manualVent: false, selectedWeapon: null};
      if (this.authority) {
        const commands = {[this.localId]: command};
        let result;
        try {
          const pendingFrames = this.pendingFrames.splice(0);
          if (pendingFrames.length > 0) {
            const rebasedFrames = pendingFrames
              .map(frame => rebasePlayerCommandForAuthority(frame, this.authority.tick))
              .sort((left, right) => left.sequence - right.sequence);
            const newestFrame = rebasedFrames.at(-1);
            commands[this.remoteId] = {
              ...newestFrame,
              // Several realtime packets can arrive between authority ticks.
              // Movement is latest-wins, but input edges must survive a later
              // neutral packet or attacks/jumps disappear nondeterministically.
              actions: rebasedFrames.reduce((mask, frame) => mask | frame.actions, 0),
            };
          }
          result = stepSession(this.authority, commands);
        } catch {
          this.end('Connection closed after invalid guest input');
          return false;
        }
        this.onAuthorityEvents(result.events, this);
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
        this.transport.sendRealtime(this.remotePeerId, COOP_WIRE_MESSAGE_KINDS.COMMAND, createCoopCommandV2(command));
      }
    }
    const estimatedTick = (this.authority?.tick ?? this.latestFrame?.authorityTick ?? 0) + this.accumulator * 30;
    this.remoteAvatar?.update(estimatedTick);
    return true;
  }

  close() {
    if (this.closed) return;
    this.clearHandshakeTimeout();
    this.pendingCheckpoint = null;
    this.queuedCheckpointReason = null;
    this.confirmedCheckpointTransfers.clear();
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
    this.transport.close();
  }
}

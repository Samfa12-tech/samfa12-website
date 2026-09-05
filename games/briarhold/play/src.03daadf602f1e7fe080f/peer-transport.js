export const PEER_TRANSPORT_VERSION = 1;

export const PEER_ROLES = Object.freeze({
  HOST: 'host',
  GUEST: 'guest',
});

export const PEER_CHANNELS = Object.freeze({
  CONTROL: 'briarhold-control-v1',
  REALTIME: 'briarhold-realtime-v1',
});

export const DEFAULT_STUN_SERVERS = Object.freeze([
  Object.freeze({urls: 'stun:stun.cloudflare.com:3478'}),
]);

export const CONTROL_MESSAGE_MAX_BYTES = 64 * 1024;
export const REALTIME_MESSAGE_MAX_BYTES = 64 * 1024;
export const DEFAULT_REALTIME_HIGH_WATER_MARK = 128 * 1024;

const MAX_SIGNALING_DESCRIPTION_BYTES = 256 * 1024;
const MAX_CANDIDATE_BYTES = 16 * 1024;
const MAX_PAYLOAD_DEPTH = 16;
const MAX_PAYLOAD_NODES = 4096;
const MAX_PAYLOAD_STRING_LENGTH = 16 * 1024;
const MAX_PAYLOAD_KEY_LENGTH = 128;
const MAX_KIND_LENGTH = 64;
// Production signaling issues Base64URL IDs, whose first character may be
// "_" or "-". Keep the wider manual-signaling suffix alphabet while admitting
// every ID the signaling contract can generate.
const PEER_ID = /^[A-Za-z0-9_-][A-Za-z0-9._:-]{0,63}$/u;
const MESSAGE_KIND = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/u;
const ENVELOPE_KEYS = Object.freeze(new Set(['v', 'kind', 'sequence', 'sentAt', 'payload']));
const INGRESS_WINDOW_MS = 5000;
// A valid 2 MiB checkpoint can occupy up to 171 bounded 12 KiB chunks plus
// its offer and acknowledgement. Keep the window above that protocol maximum.
const INGRESS_MAX_MESSAGES = Object.freeze({control: 192, realtime: 240});
const INGRESS_MAX_CODE_UNITS = Object.freeze({control: 4 * 1024 * 1024, realtime: 2 * 1024 * 1024});
// Guests receive 30 authoritative world frames per second, each bounded at
// 64 KiB. Five seconds at that maximum needs 9.375 MiB, plus bounded catch-up
// headroom. Hosts retain the tighter 2 MiB allowance for guest commands.
const WORLD_FRAME_INGRESS_MAX_CODE_UNITS = 12 * 1024 * 1024;

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

function exactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${label}.${key} is not supported`);
  }
}

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function stablePeerId(value) {
  const id = String(value ?? '');
  if (!PEER_ID.test(id)) throw new TypeError('peerId must be a stable identifier');
  return id;
}

function messageKind(value) {
  const kind = String(value ?? '');
  if (kind.length > MAX_KIND_LENGTH || !MESSAGE_KIND.test(kind)) {
    throw new TypeError('message kind must be a stable identifier');
  }
  return kind;
}

function unsignedInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 0xffffffff) {
    throw new RangeError(`${label} must be an unsigned 32-bit integer`);
  }
  return number;
}

function timestamp(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > Number.MAX_SAFE_INTEGER) {
    throw new RangeError('message sentAt must be a non-negative finite timestamp');
  }
  return number;
}

function validateJsonValue(value, label = 'message payload') {
  let nodeCount = 0;
  const visit = (current, depth) => {
    nodeCount += 1;
    if (nodeCount > MAX_PAYLOAD_NODES) throw new RangeError(`${label} is too complex`);
    if (depth > MAX_PAYLOAD_DEPTH) throw new RangeError(`${label} is too deeply nested`);

    if (current === null || typeof current === 'boolean') return;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new TypeError(`${label} numbers must be finite`);
      return;
    }
    if (typeof current === 'string') {
      if (current.length > MAX_PAYLOAD_STRING_LENGTH) throw new RangeError(`${label} string is too long`);
      return;
    }
    if (Array.isArray(current)) {
      for (const item of current) visit(item, depth + 1);
      return;
    }
    if (!current || typeof current !== 'object') {
      throw new TypeError(`${label} must contain only JSON values`);
    }
    const prototype = Object.getPrototypeOf(current);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${label} objects must be plain records`);
    }
    for (const [key, item] of Object.entries(current)) {
      if (key.length === 0 || key.length > MAX_PAYLOAD_KEY_LENGTH) {
        throw new RangeError(`${label} contains an invalid key`);
      }
      visit(item, depth + 1);
    }
  };
  visit(value, 0);
  return value;
}

export function createPeerEnvelope({kind, sequence, sentAt, payload = null} = {}) {
  return Object.freeze({
    v: PEER_TRANSPORT_VERSION,
    kind: messageKind(kind),
    sequence: unsignedInteger(sequence, 'message sequence'),
    sentAt: timestamp(sentAt),
    payload: validateJsonValue(payload),
  });
}

export function encodePeerEnvelope(value, {maxBytes = CONTROL_MESSAGE_MAX_BYTES} = {}) {
  const input = record(value, 'message envelope');
  exactKeys(input, ENVELOPE_KEYS, 'message envelope');
  if (input.v !== PEER_TRANSPORT_VERSION) {
    throw new RangeError(`message envelope version ${input.v} is unsupported`);
  }
  const envelope = createPeerEnvelope(input);
  const encoded = JSON.stringify(envelope);
  if (byteLength(encoded) > maxBytes) throw new RangeError(`message exceeds ${maxBytes} bytes`);
  return encoded;
}

export function decodePeerEnvelope(data, {maxBytes = CONTROL_MESSAGE_MAX_BYTES} = {}) {
  if (typeof data !== 'string') throw new TypeError('message data must be a JSON string');
  if (byteLength(data) > maxBytes) throw new RangeError(`message exceeds ${maxBytes} bytes`);
  let input;
  try {
    input = JSON.parse(data);
  } catch {
    throw new TypeError('message data must be valid JSON');
  }
  const value = record(input, 'message envelope');
  exactKeys(value, ENVELOPE_KEYS, 'message envelope');
  if (Object.keys(value).length !== ENVELOPE_KEYS.size) {
    throw new TypeError('message envelope is missing required fields');
  }
  if (value.v !== PEER_TRANSPORT_VERSION) {
    throw new RangeError(`message envelope version ${value.v} is unsupported`);
  }
  return createPeerEnvelope(value);
}

function normalizedIceServer(value, label) {
  const input = record(value, label);
  const urls = Array.isArray(input.urls) ? input.urls : [input.urls];
  if (urls.length === 0 || urls.length > 8 || urls.some(url => typeof url !== 'string' || url.length === 0 || url.length > 2048)) {
    throw new TypeError(`${label}.urls must contain one to eight ICE URLs`);
  }
  const result = {urls: Array.isArray(input.urls) ? [...urls] : urls[0]};
  if (input.username !== undefined) result.username = String(input.username);
  if (input.credential !== undefined) result.credential = String(input.credential);
  if (input.credentialType !== undefined) result.credentialType = input.credentialType;
  return result;
}

export function createIceConfiguration({stunServers = DEFAULT_STUN_SERVERS, turnServers = []} = {}) {
  if (!Array.isArray(stunServers) || !Array.isArray(turnServers)) {
    throw new TypeError('stunServers and turnServers must be arrays');
  }
  const iceServers = [...stunServers, ...turnServers]
    .map((server, index) => normalizedIceServer(server, `iceServers[${index}]`));
  if (iceServers.length > 16) throw new RangeError('at most 16 ICE servers are supported');
  return {iceServers};
}

function description(value, expectedType) {
  const input = record(value, `${expectedType} description`);
  if (input.type !== expectedType || typeof input.sdp !== 'string' || byteLength(input.sdp) > MAX_SIGNALING_DESCRIPTION_BYTES) {
    throw new TypeError(`expected a bounded ${expectedType} description`);
  }
  return {type: expectedType, sdp: input.sdp};
}

function candidate(value) {
  if (value === null) return null;
  const input = record(value, 'ICE candidate');
  const serialized = JSON.stringify(input);
  if (serialized === undefined || byteLength(serialized) > MAX_CANDIDATE_BYTES) {
    throw new RangeError('ICE candidate is too large');
  }
  return JSON.parse(serialized);
}

function publicDescription(value, expectedType) {
  return description({type: value.type, sdp: value.sdp}, expectedType);
}

/**
 * Browser WebRTC data transport. Signaling is deliberately external: callers
 * exchange offers, answers and emitted ICE candidates using any suitable
 * invite-code, QR or LAN mechanism. A host may own several guest peers; a
 * guest is limited to its single host connection.
 */
export class PeerTransport {
  constructor({
    role,
    RTCPeerConnection: PeerConnection = globalThis.RTCPeerConnection,
    stunServers = DEFAULT_STUN_SERVERS,
    turnServers = [],
    realtimeHighWaterMark = DEFAULT_REALTIME_HIGH_WATER_MARK,
    now = () => Date.now(),
  } = {}) {
    if (!Object.values(PEER_ROLES).includes(role)) throw new TypeError('role must be host or guest');
    if (typeof PeerConnection !== 'function') throw new TypeError('RTCPeerConnection is unavailable');
    if (!Number.isInteger(realtimeHighWaterMark) || realtimeHighWaterMark < REALTIME_MESSAGE_MAX_BYTES) {
      throw new RangeError(`realtimeHighWaterMark must be at least ${REALTIME_MESSAGE_MAX_BYTES}`);
    }
    if (typeof now !== 'function') throw new TypeError('now must be a function');

    this.role = role;
    this.PeerConnection = PeerConnection;
    this.iceConfiguration = createIceConfiguration({stunServers, turnServers});
    this.realtimeHighWaterMark = realtimeHighWaterMark;
    this.now = now;
    this.peers = new Map();
    this.listeners = new Map();
    this.closed = false;
  }

  on(type, listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
    return () => this.off(type, listener);
  }

  off(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, detail) {
    for (const listener of this.listeners.get(type) ?? []) listener(detail);
  }

  assertActive() {
    if (this.closed) throw new Error('peer transport is closed');
  }

  createPeer(peerId) {
    this.assertActive();
    const id = stablePeerId(peerId);
    if (this.peers.has(id)) throw new Error(`peer ${id} already exists`);
    if (this.role === PEER_ROLES.GUEST && this.peers.size !== 0) {
      throw new Error('a guest can connect to only one host');
    }

    const connection = new this.PeerConnection({
      iceServers: this.iceConfiguration.iceServers.map(server => ({...server})),
    });
    const peer = {
      id,
      connection,
      state: connection.connectionState ?? 'new',
      channels: {control: null, realtime: null},
      nextSequence: {control: 0, realtime: 0},
      receivedRealtimeSequence: -1,
      ingress: {
        control: {startedAt: this.now(), messages: 0, codeUnits: 0},
        realtime: {startedAt: this.now(), messages: 0, codeUnits: 0},
      },
    };
    this.peers.set(id, peer);

    connection.onicecandidate = event => {
      this.emit('icecandidate', {peerId: id, candidate: event.candidate?.toJSON?.() ?? event.candidate ?? null});
    };
    connection.onconnectionstatechange = () => this.updatePeerState(peer);
    connection.oniceconnectionstatechange = () => this.updatePeerState(peer);
    connection.ondatachannel = event => this.attachRemoteChannel(peer, event.channel);

    return peer;
  }

  updatePeerState(peer) {
    const next = peer.connection.connectionState ?? peer.connection.iceConnectionState ?? 'new';
    if (next === peer.state) return;
    const previousState = peer.state;
    peer.state = next;
    this.emit('statechange', {peerId: peer.id, state: next, previousState});
  }

  attachRemoteChannel(peer, channel) {
    if (channel?.label === PEER_CHANNELS.CONTROL) {
      this.attachChannel(peer, 'control', channel);
      return;
    }
    if (channel?.label === PEER_CHANNELS.REALTIME) {
      this.attachChannel(peer, 'realtime', channel);
      return;
    }
    channel?.close?.();
    this.emit('drop', {peerId: peer.id, channel: channel?.label ?? 'unknown', reason: 'unknown-channel'});
  }

  attachChannel(peer, channelName, channel) {
    const existing = peer.channels[channelName];
    if (existing && existing !== channel) existing.close?.();
    peer.channels[channelName] = channel;
    if (channelName === 'realtime') channel.bufferedAmountLowThreshold = Math.floor(this.realtimeHighWaterMark / 2);

    channel.onopen = () => this.emit('channelstate', {peerId: peer.id, channel: channelName, state: 'open'});
    channel.onclose = () => this.emit('channelstate', {peerId: peer.id, channel: channelName, state: 'closed'});
    channel.onerror = error => this.emit('error', {peerId: peer.id, channel: channelName, error});
    channel.onmessage = event => this.receive(peer, channelName, event.data);
  }

  receive(peer, channelName, data) {
    const budget = peer.ingress[channelName];
    const now = this.now();
    if (now - budget.startedAt >= INGRESS_WINDOW_MS) {
      budget.startedAt = now;
      budget.messages = 0;
      budget.codeUnits = 0;
    }
    budget.messages += 1;
    budget.codeUnits += typeof data === 'string' ? data.length : 0;
    const maxCodeUnits = channelName === 'realtime' && this.role === PEER_ROLES.GUEST
      ? WORLD_FRAME_INGRESS_MAX_CODE_UNITS : INGRESS_MAX_CODE_UNITS[channelName];
    if (budget.messages > INGRESS_MAX_MESSAGES[channelName]
      || budget.codeUnits > maxCodeUnits) {
      this.emit('drop', {peerId: peer.id, channel: channelName, reason: 'rate-limit',
        messages: budget.messages, codeUnits: budget.codeUnits, elapsedMs: now - budget.startedAt});
      peer.connection.close();
      this.updatePeerState(peer);
      return;
    }
    try {
      const maxBytes = channelName === 'control' ? CONTROL_MESSAGE_MAX_BYTES : REALTIME_MESSAGE_MAX_BYTES;
      const envelope = decodePeerEnvelope(data, {maxBytes});
      if (channelName === 'realtime') {
        if (envelope.sequence <= peer.receivedRealtimeSequence) {
          this.emit('drop', {
            peerId: peer.id,
            channel: channelName,
            reason: 'stale',
            sequence: envelope.sequence,
          });
          return;
        }
        peer.receivedRealtimeSequence = envelope.sequence;
      }
      this.emit('message', {peerId: peer.id, channel: channelName, envelope});
    } catch (error) {
      this.emit('drop', {peerId: peer.id, channel: channelName, reason: 'invalid-message', error});
    }
  }

  async createOffer(peerId, options) {
    if (this.role !== PEER_ROLES.HOST) throw new Error('only a host can create guest offers');
    const peer = this.createPeer(peerId);
    this.attachChannel(peer, 'control', peer.connection.createDataChannel(PEER_CHANNELS.CONTROL, {ordered: true}));
    this.attachChannel(peer, 'realtime', peer.connection.createDataChannel(PEER_CHANNELS.REALTIME, {
      ordered: false,
      maxRetransmits: 0,
    }));
    const offer = await peer.connection.createOffer(options);
    await peer.connection.setLocalDescription(offer);
    return publicDescription(peer.connection.localDescription ?? offer, 'offer');
  }

  async acceptOffer(peerId, offer, options) {
    if (this.role !== PEER_ROLES.GUEST) throw new Error('only a guest can accept a host offer');
    const peer = this.createPeer(peerId);
    await peer.connection.setRemoteDescription(description(offer, 'offer'));
    const answer = await peer.connection.createAnswer(options);
    await peer.connection.setLocalDescription(answer);
    return publicDescription(peer.connection.localDescription ?? answer, 'answer');
  }

  async acceptAnswer(peerId, answer) {
    if (this.role !== PEER_ROLES.HOST) throw new Error('only a host can accept guest answers');
    const peer = this.requirePeer(peerId);
    await peer.connection.setRemoteDescription(description(answer, 'answer'));
  }

  async addIceCandidate(peerId, value) {
    const peer = this.requirePeer(peerId);
    await peer.connection.addIceCandidate(candidate(value));
  }

  /**
   * Manual invite/QR signaling needs a self-contained SDP description. Wait for
   * candidate gathering so callers can copy one bounded blob instead of
   * trickling candidates through a live signaling service.
   */
  async waitForIceGatheringComplete(peerId, {timeoutMs = 8000, allowPartial = false} = {}) {
    const peer = this.requirePeer(peerId);
    const connection = peer.connection;
    if (connection.iceGatheringState === 'complete') {
      return publicDescription(connection.localDescription, connection.localDescription.type);
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) {
      throw new RangeError('ICE gathering timeout must be 100 to 30000 milliseconds');
    }
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        connection.removeEventListener?.('icegatheringstatechange', changed);
        if (allowPartial && connection.localDescription?.sdp) resolve();
        else reject(new Error('ICE gathering timed out'));
      }, timeoutMs);
      const changed = () => {
        if (connection.iceGatheringState !== 'complete') return;
        clearTimeout(timeout);
        connection.removeEventListener?.('icegatheringstatechange', changed);
        resolve();
      };
      connection.addEventListener?.('icegatheringstatechange', changed);
      // Some lightweight WebView/test implementations only expose the handler.
      if (!connection.addEventListener) {
        const previous = connection.onicegatheringstatechange;
        connection.onicegatheringstatechange = event => {
          previous?.(event);
          changed();
        };
      }
    });
    return publicDescription(connection.localDescription, connection.localDescription.type);
  }

  requirePeer(peerId) {
    const id = stablePeerId(peerId);
    const peer = this.peers.get(id);
    if (!peer) throw new Error(`peer ${id} does not exist`);
    return peer;
  }

  getPeerState(peerId) {
    const peer = this.requirePeer(peerId);
    return Object.freeze({
      peerId: peer.id,
      connectionState: peer.state,
      controlState: peer.channels.control?.readyState ?? 'missing',
      realtimeState: peer.channels.realtime?.readyState ?? 'missing',
    });
  }

  getPeerIds() {
    return Object.freeze([...this.peers.keys()]);
  }

  makeMessage(peer, channelName, kind, payload) {
    const sequence = peer.nextSequence[channelName];
    peer.nextSequence[channelName] = (sequence + 1) >>> 0;
    return createPeerEnvelope({kind, sequence, sentAt: this.now(), payload});
  }

  sendControl(peerId, kind, payload = null) {
    const peer = this.requirePeer(peerId);
    const channel = peer.channels.control;
    if (!channel || channel.readyState !== 'open') throw new Error(`control channel for ${peer.id} is not open`);
    const encoded = encodePeerEnvelope(this.makeMessage(peer, 'control', kind, payload), {
      maxBytes: CONTROL_MESSAGE_MAX_BYTES,
    });
    channel.send(encoded);
    return true;
  }

  sendRealtime(peerId, kind, payload = null) {
    const peer = this.requirePeer(peerId);
    const channel = peer.channels.realtime;
    if (!channel || channel.readyState !== 'open') {
      this.emit('drop', {peerId: peer.id, channel: 'realtime', reason: 'not-open'});
      return false;
    }
    const envelope = this.makeMessage(peer, 'realtime', kind, payload);
    const encoded = encodePeerEnvelope(envelope, {maxBytes: REALTIME_MESSAGE_MAX_BYTES});
    if (channel.bufferedAmount + byteLength(encoded) > this.realtimeHighWaterMark) {
      this.emit('drop', {
        peerId: peer.id,
        channel: 'realtime',
        reason: 'backpressure',
        sequence: envelope.sequence,
      });
      return false;
    }
    channel.send(encoded);
    return true;
  }

  broadcastControl(kind, payload = null) {
    for (const peerId of this.peers.keys()) this.sendControl(peerId, kind, payload);
  }

  broadcastRealtime(kind, payload = null) {
    let sent = 0;
    for (const peerId of this.peers.keys()) if (this.sendRealtime(peerId, kind, payload)) sent += 1;
    return sent;
  }

  closePeer(peerId) {
    const peer = this.requirePeer(peerId);
    peer.channels.control?.close?.();
    peer.channels.realtime?.close?.();
    peer.connection.close();
    this.peers.delete(peer.id);
    this.emit('statechange', {peerId: peer.id, state: 'closed', previousState: peer.state});
  }

  close() {
    for (const peerId of [...this.peers.keys()]) this.closePeer(peerId);
    this.closed = true;
  }
}

export function createPeerTransport(options) {
  return new PeerTransport(options);
}

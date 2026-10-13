export const BRIARHOLD_SIGNALING_URL = 'https://briarhold-signal.samfa12.com';
export const SIGNALING_PROTOCOL_VERSION = 1;
export const SIGNALING_LEGACY_ROOM_CODE_PATTERN = /^[A-Za-z0-9_-]{22}$/u;
export const SIGNALING_SHORT_ROOM_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{10}$/u;
export const SIGNALING_ROOM_CODE_PATTERN = /^(?:[A-Za-z0-9_-]{22}|[ABCDEFGHJKMNPQRSTVWXYZ23456789]{10})$/u;

function serviceUrl(value) {
  const url = new URL(value ?? BRIARHOLD_SIGNALING_URL);
  if (url.pathname !== '/' || url.search || url.hash) throw new TypeError('Signaling URL must be an origin');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new TypeError('Signaling must use HTTPS');
  }
  return url;
}

export function normalizeRoomCode(value) {
  const trimmed = String(value ?? '').trim();
  if (SIGNALING_LEGACY_ROOM_CODE_PATTERN.test(trimmed)) return trimmed;
  const code = trimmed.replaceAll('-', '').replaceAll(/\s+/gu, '').toUpperCase();
  if (!SIGNALING_ROOM_CODE_PATTERN.test(code)) throw new TypeError('Room code must be 10 or 22 letters/numbers');
  return code;
}

export function formatRoomCode(value) {
  const code = normalizeRoomCode(value);
  return SIGNALING_SHORT_ROOM_CODE_PATTERN.test(code) ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

async function responseJson(response, label) {
  let body = null;
  try { body = await response.json(); } catch { /* handled below */ }
  if (!response.ok) throw new Error(body?.error ? `${label}: ${body.error}` : `${label}: HTTP ${response.status}`);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(`${label}: invalid response`);
  return body;
}

export async function fetchSignalingIceConfig({baseUrl = BRIARHOLD_SIGNALING_URL, fetch = globalThis.fetch} = {}) {
  const origin = serviceUrl(baseUrl);
  const response = await fetch(new URL('/api/ice-config', origin), {headers: {accept: 'application/json'}});
  const body = await responseJson(response, 'ICE configuration failed');
  if (!Array.isArray(body.iceServers) || typeof body.relayAvailable !== 'boolean') {
    throw new Error('ICE configuration response is invalid');
  }
  return Object.freeze({iceServers: Object.freeze(body.iceServers.map(server => Object.freeze({...server}))), relayAvailable: body.relayAvailable});
}

/** TURN discovery is optional; PeerTransport retains its built-in public STUN route. */
export async function fetchOptionalSignalingIceConfig(options = {}) {
  try {
    const config = await fetchSignalingIceConfig(options);
    return Object.freeze({...config, usedFallback: false});
  } catch {
    return Object.freeze({iceServers: Object.freeze([]), relayAvailable: false, usedFallback: true});
  }
}

export async function createSignalingRoom({baseUrl = BRIARHOLD_SIGNALING_URL, fetch = globalThis.fetch, format = 'short'} = {}) {
  const origin = serviceUrl(baseUrl);
  const response = await fetch(new URL('/api/rooms', origin), {
    method: 'POST',
    headers: {accept: 'application/json', 'content-type': 'application/json'},
    body: JSON.stringify(format === 'legacy' ? {} : {format: 'short'}),
  });
  const body = await responseJson(response, 'Room creation failed');
  const roomId = normalizeRoomCode(body.roomId);
  if (typeof body.hostToken !== 'string' || body.hostToken.length !== 43) throw new Error('Room host token is invalid');
  if (body.webSocketPath !== `/api/rooms/${roomId}/connect`) throw new Error('Room WebSocket path is invalid');
  return Object.freeze({roomId, hostToken: body.hostToken, webSocketPath: body.webSocketPath});
}

function serverMessage(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { throw new TypeError('Signaling message is not JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.v !== SIGNALING_PROTOCOL_VERSION || typeof value.type !== 'string') {
    throw new TypeError('Signaling message envelope is invalid');
  }
  return value;
}

export class SignalingConnection {
  constructor({baseUrl = BRIARHOLD_SIGNALING_URL, roomId, role, hostToken = null, WebSocket = globalThis.WebSocket, onEvent = () => {}} = {}) {
    if (!['host', 'guest'].includes(role)) throw new TypeError('Signaling role is invalid');
    if (role === 'host' && (typeof hostToken !== 'string' || hostToken.length !== 43)) throw new TypeError('Host token is invalid');
    if (typeof WebSocket !== 'function') throw new TypeError('WebSocket is unavailable');
    this.baseUrl = serviceUrl(baseUrl);
    this.roomId = normalizeRoomCode(roomId);
    this.role = role;
    this.hostToken = hostToken;
    this.WebSocket = WebSocket;
    this.onEvent = onEvent;
    this.socket = null;
    this.peerId = null;
    this.closed = false;
  }

  connect({timeoutMs = 10000} = {}) {
    if (this.socket) throw new Error('Signaling connection already started');
    const url = new URL(`/api/rooms/${this.roomId}/connect`, this.baseUrl);
    url.protocol = this.baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new this.WebSocket(url);
    this.socket = socket;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error('Signaling connection timed out'));
      }, timeoutMs);
      socket.onopen = () => {
        const join = {v: SIGNALING_PROTOCOL_VERSION, type: 'join', role: this.role};
        if (this.role === 'host') join.hostToken = this.hostToken;
        socket.send(JSON.stringify(join));
      };
      socket.onmessage = event => {
        try {
          const message = serverMessage(event.data);
          if (message.type === 'welcome') {
            this.peerId = message.peerId;
            clearTimeout(timeout);
            resolve(this);
          } else if (message.type === 'error' && !this.peerId) {
            clearTimeout(timeout);
            reject(new Error(`Signaling rejected connection: ${message.code}`));
          }
          this.onEvent(message, this);
        } catch (error) {
          this.onEvent({v: SIGNALING_PROTOCOL_VERSION, type: 'client-error', error}, this);
        }
      };
      socket.onerror = () => {
        if (!this.peerId) {
          clearTimeout(timeout);
          reject(new Error('Signaling connection failed'));
        }
        this.onEvent({v: SIGNALING_PROTOCOL_VERSION, type: 'client-error', error: new Error('WebSocket error')}, this);
      };
      socket.onclose = event => {
        this.closed = true;
        clearTimeout(timeout);
        if (!this.peerId) reject(new Error(`Signaling closed before joining (${event.code})`));
        this.onEvent({v: SIGNALING_PROTOCOL_VERSION, type: 'socket-closed', code: event.code, reason: event.reason}, this);
      };
    });
  }

  sendSignal(to, signal) {
    if (!this.socket || this.socket.readyState !== this.WebSocket.OPEN || !this.peerId) throw new Error('Signaling connection is not open');
    this.socket.send(JSON.stringify({v: SIGNALING_PROTOCOL_VERSION, type: 'signal', to, signal}));
  }

  close() {
    if (this.closed || !this.socket) return;
    try {
      if (this.socket.readyState === this.WebSocket.OPEN) {
        this.socket.send(JSON.stringify({v: SIGNALING_PROTOCOL_VERSION, type: 'leave'}));
      }
      this.socket.close(1000, 'left');
    } finally {
      this.closed = true;
    }
  }
}

export function connectSignalingRoom(options) {
  const connection = new SignalingConnection(options);
  return connection.connect();
}

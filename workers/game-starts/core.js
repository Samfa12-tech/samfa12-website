export const GAMES = ['briarhold', 'reef-sweep'];
export const DAY_MS = 86_400_000;
export const RECEIPT_MS = 2 * DAY_MS;
export const MAX_BODY_BYTES = 512;
export const DAILY_CAP = 10_000;
export const MINUTE_CAP = 120;

export function validateEvent(value, now, trackingSince) {
  if (!value || Object.keys(value).sort().join(',') !== 'eventId,gameId,schemaVersion,startedAt'
    || value.schemaVersion !== 1 || !GAMES.includes(value.gameId)
    || typeof value.eventId !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value.eventId)
    || typeof value.startedAt !== 'string') throw new Error('invalid-event');
  const started = Date.parse(value.startedAt), activation = Date.parse(trackingSince);
  if (!Number.isFinite(started) || new Date(started).toISOString() !== value.startedAt
    || started > now + 300_000 || started < now - DAY_MS
    || value.startedAt.slice(0,10) > new Date(now).toISOString().slice(0,10)
    || !Number.isFinite(activation) || started < activation) throw new Error('invalid-time');
  return {...value, day: value.startedAt.slice(0, 10)};
}

export async function readBoundedJson(request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) throw new Error('body-too-large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid-event');
  let bytes = 0;
  const chunks = [];
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) { await reader.cancel(); throw new Error('body-too-large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(bytes);
  let cursor = 0;
  for (const chunk of chunks) { data.set(chunk, cursor); cursor += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(data)); } catch { throw new Error('invalid-event'); }
}

export async function receiptHash(gameId, eventId) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${gameId}:${eventId}`));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function handleRequest(request, env, storeForGame, now = Date.now()) {
  const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});
  if (env.ENABLE_GAME_STARTS !== 'true') return json({schemaVersion: 1, status: 'disabled'}, 503);
  const url = new URL(request.url);
  if (url.pathname === '/api/game-starts/v1/stats' && request.method === 'GET') {
    try {
      const games = await Promise.all(GAMES.map(gameId => storeForGame(gameId).snapshot(now)));
      return json({schemaVersion: 1, source: 'first-party-game-starts', status: 'ok', updatedAt: new Date(now).toISOString(), games});
    } catch { return json({schemaVersion: 1, status: 'unavailable'}, 503); }
  }
  if (url.pathname !== '/api/game-starts/v1/start') return json({status: 'not-found'}, 404);
  if (request.method !== 'POST') return json({status: 'method-not-allowed'}, 405);
  if (request.headers.get('origin') !== env.ALLOWED_ORIGIN || url.origin !== env.ALLOWED_ORIGIN)
    return json({status: 'origin-denied'}, 403);
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json({status: 'invalid-content-type'}, 415);
  try {
    const value = await readBoundedJson(request);
    const starts = JSON.parse(env.TRACKING_STARTS || '{}');
    const event = validateEvent(value, now, starts[value.gameId]);
    const hash = await receiptHash(event.gameId, event.eventId);
    const result = await storeForGame(event.gameId).accept(event.day, hash, now);
    return json({schemaVersion: 1, gameId: event.gameId, ...result}, result.status === 'capped' ? 429 : 200);
  } catch (error) {
    if (['invalid-event', 'invalid-time', 'body-too-large'].includes(error.message)) return json({status: error.message}, error.message === 'body-too-large' ? 413 : 400);
    return json({schemaVersion: 1, status: 'unavailable'}, 503);
  }
}

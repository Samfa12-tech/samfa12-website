// Browser-only start measurement. Nothing transmits unless explicitly enabled.
export const CONSENT_KEY = 'samfa12:analytics-consent';
const SESSION_MS = 30 * 60_000;
const RETRY_MS = 24 * 60 * 60_000;
const GAMES = new Set(['briarhold', 'reef-sweep']);

export function createGameStartTracker({gameId, enabled = false, endpoint = '',
  windowRef = globalThis.window, now = Date.now, uuid = () => globalThis.crypto.randomUUID(),
  fetchImpl = globalThis.fetch, timeoutSignal = () => AbortSignal.timeout(5000)} = {}) {
  if (!GAMES.has(gameId)) throw new Error('Unsupported game ID');
  const key = `samfa12:game-start:v1:${gameId}`;
  let ready = false, inFlight = null, state = null, suppressed = false, suppressedAt = 0, lastWrite = 0;
  let controller = null;
  const consent = () => {
    try { return windowRef.localStorage.getItem(CONSENT_KEY) === 'granted'; } catch { return false; }
  };
  const read = () => {
    try {
      const value = JSON.parse(windowRef.sessionStorage.getItem(key));
      if (value && typeof value.eventId === 'string' && Number.isFinite(value.lastActivity)
        && Number.isFinite(Date.parse(value.startedAt)) && now() - value.lastActivity < SESSION_MS
        && value.lastActivity <= now() + 300_000) return value;
    } catch { /* In-memory operation remains usable when browser storage fails. */ }
    return null;
  };
  const save = () => {
    try {
      if (state) windowRef.sessionStorage.setItem(key, JSON.stringify(state));
      else windowRef.sessionStorage.removeItem(key);
    } catch { /* Never interrupt gameplay. Reload deduplication is unavailable. */ }
  };
  const allowedEndpoint = () => {
    if (!enabled || !endpoint || !windowRef) return null;
    try {
      const url = new URL(endpoint, windowRef.location.href);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (url.origin !== windowRef.location.origin || (!local && url.protocol !== 'https:')
        || url.pathname !== '/api/game-starts/v1/start' || url.search || url.hash) return null;
      return url.href;
    } catch { return null; }
  };
  const syncConsent = () => {
    if (!consent()) { state = null; suppressed = true; suppressedAt = now(); controller?.abort(); save(); }
  };
  async function flush() {
    syncConsent();
    const url = allowedEndpoint();
    if (!url || !state || state.acked || !consent()) return {status: 'inactive'};
    if (now() - Date.parse(state.startedAt) > RETRY_MS) return {status: 'expired'};
    if (inFlight) return inFlight;
    if ((state.attempts || 0) >= 4 || now() < (state.nextAttempt || 0)) return {status: 'pending'};
    const event = state;
    event.attempts = (event.attempts || 0) + 1;
    event.nextAttempt = now() + 1000 * 2 ** event.attempts;
    save();
    controller = new AbortController();
    inFlight = (async () => {
      try {
        const response = await fetchImpl(url, {
          method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
          headers: {'Content-Type': 'application/json'}, signal: AbortSignal.any([timeoutSignal(), controller.signal]),
          body: JSON.stringify({schemaVersion: 1, gameId, eventId: event.eventId, startedAt: event.startedAt}),
        });
        const ack = await response.json();
        if (!response.ok || ack.schemaVersion !== 1 || ack.gameId !== gameId
          || !['accepted', 'duplicate'].includes(ack.status)
          || ack.day !== event.startedAt.slice(0, 10)) return {status: 'pending'};
        if (state === event && consent()) { state.acked = true; save(); }
        return {status: ack.status};
      } catch { return {status: 'pending'}; }
      finally { inFlight = null; }
    })();
    return inFlight;
  }
  state = consent() ? read() : null;
  const storageListener = event => { if (event.key === CONSENT_KEY) syncConsent(); };
  windowRef?.addEventListener?.('storage', storageListener);
  windowRef?.addEventListener?.('samfa12:analytics-consent', syncConsent);
  const onlineListener = () => { void flush(); };
  windowRef?.addEventListener?.('online', onlineListener);
  return {
    markReady() { ready = true; },
    async start() {
      if (!ready || !allowedEndpoint()) return {status: 'inactive'};
      if (!consent()) { suppressed = true; suppressedAt = now(); return {status: 'consent-required'}; }
      if (suppressed && now() - suppressedAt >= SESSION_MS) suppressed = false;
      if (state && now() - state.lastActivity >= SESSION_MS) { state = null; suppressed = false; }
      if (suppressed) return {status: 'suppressed'};
      if (!state) {
        try { state = {eventId: uuid(), startedAt: new Date(now()).toISOString(), lastActivity: now(), acked: false}; }
        catch { return {status: 'unavailable'}; }
        save();
      }
      return flush();
    },
    activity() {
      if (!consent()) { syncConsent(); return; }
      if (state && now() - state.lastActivity < SESSION_MS) {
        state.lastActivity = now();
        if (now() - lastWrite >= 60_000) { save(); lastWrite = now(); }
      }
    },
    flush, syncConsent,
    dispose() {
      windowRef?.removeEventListener?.('storage', storageListener);
      windowRef?.removeEventListener?.('samfa12:analytics-consent', syncConsent);
      windowRef?.removeEventListener?.('online', onlineListener);
      controller?.abort();
    },
  };
}

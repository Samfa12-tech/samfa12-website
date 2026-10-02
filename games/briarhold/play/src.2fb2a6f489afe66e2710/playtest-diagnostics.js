// Report-only copies: never normalize, repair, persist or import captured state.
export const REPORT_SAVE_MAX_BYTES = 64 * 1024;
export const REPORT_CONTEXT_MAX_BYTES = 192 * 1024;
const encoder = new TextEncoder();
const privateKey = /token|secret|password|authorization|cookie|room.?code|room.?id|peer.?id|client.?id|user.?id|host.?id|session.?id|invite|sdp|ice.?candidate|controller.?id|device.?id|email|user.?agent/i;

export function diagnosticText(value, limit = 1200) {
  return String(value ?? '').replace(/https?:\/\/[^\s)]+/gu, value => {
    try { return new URL(value).pathname.split('/').pop() || '[url]'; } catch { return '[url]'; }
  }).replace(/(?:bearer\s+|(?:token|secret|password|roomCode)\s*[:=]\s*)[^\s,;]+/giu, '[redacted]')
    .replace(/(?:a=(?:ice-ufrag|ice-pwd|candidate):|v=0)[^\r\n]*/gu, '[redacted connection data]')
    .slice(0, limit);
}

export function boundedReportCopy(value, maxBytes = REPORT_SAVE_MAX_BYTES) {
  if (value == null) return {status: 'unavailable'};
  try {
    const json = JSON.stringify(value, (key, item) => privateKey.test(key) ? undefined : item);
    const bytes = encoder.encode(json).byteLength;
    if (bytes > maxBytes) return {status: 'omitted', reason: 'size-limit', bytes};
    return {status: 'included', bytes, data: JSON.parse(json)};
  } catch { return {status: 'omitted', reason: 'not-serializable'}; }
}

export function captureReproSave({profile, run, player, persistedSave, role = 'solo', now = () => new Date().toISOString()}) {
  let persisted;
  try {
    // Read only the game's save key supplied by the caller, never all storage.
    const raw = persistedSave?.();
    persisted = raw == null ? {status: 'unavailable'}
      : encoder.encode(raw).byteLength > REPORT_SAVE_MAX_BYTES
        ? {status: 'omitted', reason: 'size-limit'} : boundedReportCopy(JSON.parse(raw));
  } catch { persisted = {status: 'omitted', reason: 'unreadable-or-invalid-json'}; }
  return {
    schemaVersion: 1, role, capturedAt: now(),
    purpose: 'Sanitized save-v4 reproduction input; combat restores from the wave-start save policy, not an exact simulation replay.',
    current: boundedReportCopy(profile ? {version: 4, profile, run: run ? {...run, player} : null, savedAt: now()} : null),
    persisted,
  };
}

export function boundPlaytestContext(context) {
  const copy = JSON.parse(JSON.stringify(context));
  if (encoder.encode(JSON.stringify(copy)).byteLength <= REPORT_CONTEXT_MAX_BYTES) return copy;
  // Prefer retaining the failure/control evidence over optional save copies.
  if (copy.reproduction) {
    copy.reproduction.current = {status: 'omitted', reason: 'context-size-limit'};
    copy.reproduction.persisted = {status: 'omitted', reason: 'context-size-limit'};
  }
  if (encoder.encode(JSON.stringify(copy)).byteLength <= REPORT_CONTEXT_MAX_BYTES) return copy;
  return {diagnosticsOmitted: 'context-size-limit'};
}

export function createReportErrorHistory({target = globalThis.window, now = () => Date.now()} = {}) {
  const errors = [];
  const record = (kind, error, fallback = '') => {
    const entry = {
      kind, at: now(), name: diagnosticText(error?.name || 'Error', 80),
      message: diagnosticText(error?.message ?? fallback),
      stack: diagnosticText(typeof error?.stack === 'string' ? error.stack : '', 1800),
      count: 1,
    };
    const previous = errors.at(-1);
    if (previous?.kind === kind && previous.message === entry.message && previous.stack === entry.stack) {
      previous.at = entry.at; previous.count += 1;
    } else errors.push(entry);
    if (errors.length > 8) errors.shift();
  };
  const onError = event => record('error', event.error, event.message ?? 'Unknown runtime error');
  const onRejection = event => record('unhandledrejection', event.reason instanceof Error ? event.reason : null,
    'Non-Error rejection payload omitted');
  target?.addEventListener?.('error', onError);
  target?.addEventListener?.('unhandledrejection', onRejection);
  return {
    snapshot: () => errors.map(item => ({...item})),
    dispose() {
      target?.removeEventListener?.('error', onError);
      target?.removeEventListener?.('unhandledrejection', onRejection);
    },
  };
}

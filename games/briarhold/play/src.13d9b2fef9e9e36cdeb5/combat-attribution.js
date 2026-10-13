const DEFAULT_LIMIT = 12;

function finite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${name} must be finite`);
  return number;
}

function boundedSource(value) {
  const source = String(value ?? "").trim();
  if (!source || source.length > 80) throw new TypeError("combat source must contain 1 to 80 characters");
  return source;
}

export function appendCombatAttribution(events, event, limit = DEFAULT_LIMIT) {
  const capacity = Math.max(1, Math.min(32, Math.trunc(Number(limit) || DEFAULT_LIMIT)));
  const next = Object.freeze({
    at: finite(event?.at, "combat timestamp"),
    source: boundedSource(event?.source),
    enemyId: Math.max(0, Math.trunc(finite(event?.enemyId, "enemy id"))),
    killed: event?.killed === true,
  });
  return Object.freeze([...(Array.isArray(events) ? events : []), next].slice(-capacity));
}

export function recentCombatAttribution(events, now, windowSeconds = 12) {
  const current = finite(now, "current combat time");
  const window = Math.max(0, finite(windowSeconds, "combat window"));
  return Object.freeze((Array.isArray(events) ? events : []).filter(event => (
    Number.isFinite(event?.at) && event.at >= current - window && event.at <= current + 1e-6
  )));
}

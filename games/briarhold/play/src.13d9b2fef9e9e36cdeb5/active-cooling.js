// Trial tuning for Alpha103; owner feel/balance acceptance remains pending.
export const ACTIVE_COOLING = Object.freeze({
  minimumHeat: 0.35, duration: 1.6, successStart: 0.55, successEnd: 1.25,
  perfectStart: 0.8, perfectEnd: 1.0, successReduction: 0.28,
  perfectReduction: 0.42, cooldown: 4, feedbackDuration: 1.2,
});

const RESULTS = new Set(['none', 'success', 'perfect', 'miss', 'cancelled']);
export function normalizeActiveCooling(value = {}) {
  const finite = x => Number.isFinite(Number(x)) && Number(x) >= 0 ? Number(x) : 0;
  return {
    startedAt: value.startedAt === null || value.startedAt === undefined ? null : finite(value.startedAt),
    readyAt: finite(value.readyAt), resultUntil: finite(value.resultUntil),
    result: RESULTS.has(value.result) ? value.result : 'none',
  };
}

export function cancelActiveCooling(state) {
  const cooling = normalizeActiveCooling(state.activeCooling);
  if (cooling.startedAt !== null) { cooling.startedAt = null; cooling.result = 'cancelled'; }
  state.activeCooling = cooling;
}

export function stepActiveCooling(state, nowSeconds, {eligible = true} = {}) {
  const now = Math.max(0, Number(nowSeconds) || 0);
  const cooling = normalizeActiveCooling(state.activeCooling);
  if (!eligible) {
    state.activeCooling = cooling;
    cancelActiveCooling(state);
    return state.activeCooling;
  }
  if (cooling.startedAt !== null && now - cooling.startedAt > ACTIVE_COOLING.duration) {
    cooling.startedAt = null; cooling.result = 'miss';
    cooling.resultUntil = now + ACTIVE_COOLING.feedbackDuration;
  }
  state.activeCooling = cooling;
  return cooling;
}

/** Both solo and fixed-tick authority use this same bounded tap resolver. */
export function tapActiveCooling(state, nowSeconds, {eligible = true} = {}) {
  const now = Math.max(0, Number(nowSeconds) || 0);
  const cooling = stepActiveCooling(state, now, {eligible});
  if (!eligible) return null;
  if (cooling.startedAt === null) {
    if (now < cooling.readyAt || Number(state.heat) < ACTIVE_COOLING.minimumHeat) return null;
    cooling.startedAt = now; cooling.readyAt = now + ACTIVE_COOLING.cooldown;
    cooling.result = 'none'; cooling.resultUntil = 0;
    return {result: 'started', reduction: 0};
  }
  const elapsed = now - cooling.startedAt;
  const perfect = elapsed >= ACTIVE_COOLING.perfectStart && elapsed <= ACTIVE_COOLING.perfectEnd;
  const success = elapsed >= ACTIVE_COOLING.successStart && elapsed <= ACTIVE_COOLING.successEnd;
  const reduction = perfect ? ACTIVE_COOLING.perfectReduction : success ? ACTIVE_COOLING.successReduction : 0;
  cooling.startedAt = null; cooling.result = perfect ? 'perfect' : success ? 'success' : 'miss';
  cooling.resultUntil = now + ACTIVE_COOLING.feedbackDuration;
  state.heat = Math.max(0, (Number(state.heat) || 0) - reduction);
  if (state.overheated && state.heat <= 0.42) state.overheated = false;
  return {result: cooling.result, reduction};
}

export function activeCoolingPresentation(state, nowSeconds) {
  const cooling = normalizeActiveCooling(state.activeCooling);
  const now = Math.max(0, Number(nowSeconds) || 0);
  const active = cooling.startedAt !== null;
  const elapsed = active ? Math.max(0, now - cooling.startedAt) : 0;
  const ready = !active && now >= cooling.readyAt && Number(state.heat) >= ACTIVE_COOLING.minimumHeat;
  const result = now <= cooling.resultUntil ? cooling.result : 'none';
  const perfect = active && elapsed >= ACTIVE_COOLING.perfectStart && elapsed <= ACTIVE_COOLING.perfectEnd;
  return {
    active, ready, result, progress: active ? Math.min(1, elapsed / ACTIVE_COOLING.duration) : 0,
    window: active && elapsed >= ACTIVE_COOLING.successStart && elapsed <= ACTIVE_COOLING.successEnd,
    perfect: active && elapsed >= ACTIVE_COOLING.perfectStart && elapsed <= ACTIVE_COOLING.perfectEnd,
    label: active ? elapsed < ACTIVE_COOLING.successStart ? 'Wait for green · fire paused'
      : elapsed <= ACTIVE_COOLING.successEnd ? perfect ? 'Tap Cool now · perfect window' : 'Tap Cool now · green window'
        : 'Late · passive cooling continues' : result === 'perfect' ? 'Perfect cooling · −42% heat'
      : result === 'success' ? 'Cooling success · −28% heat' : result === 'miss' ? 'Miss · passive cooling continues'
        : ready ? 'Cool: tap, then tap in green' : now < cooling.readyAt ? `Cool ready in ${Math.ceil(cooling.readyAt - now)}s`
          : 'Cool available above 35% heat',
  };
}

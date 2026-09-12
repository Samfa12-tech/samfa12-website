/** Persisted monotonic IDs outlive restarted weapon/event counters. */
export function normalizeAttackHeat(input) {
  if (input == null) return {nextId: 1, budgets: []};
  if (!input || Object.keys(input).some(k => !['nextId', 'budgets'].includes(k))
    || !Number.isSafeInteger(input.nextId) || input.nextId < 1 || !Array.isArray(input.budgets) || input.budgets.length > 129) throw new RangeError('invalid attack heat ledger');
  const ids = new Set();
  const budgets = input.budgets.map(b => {
    if (!b || Object.keys(b).some(k => !['id', 'remaining', 'charged'].includes(k))
      || !Number.isSafeInteger(b.id) || b.id < 1 || b.id >= input.nextId || ids.has(b.id)
      || !Number.isFinite(b.charged) || b.charged < 0 || b.charged > 1.2
      || !Number.isFinite(b.remaining) || b.remaining < 0 || b.remaining > b.charged / 2) throw new RangeError('invalid attack heat budget');
    ids.add(b.id); return {...b};
  });
  return {nextId: input.nextId, budgets};
}
export function beginAttackHeat(run, charged, retainedIds = []) {
  const state = run.attackHeat ??= normalizeAttackHeat();
  state.budgets = state.budgets.filter(b => retainedIds.includes(b.id));
  if (state.budgets.length >= 129) throw new RangeError('attack heat ledger full');
  const id = state.nextId++;
  state.budgets.push({id, charged, remaining: charged / 2});
  return id;
}
export function consumeAttackHeat(run, attackId, perKill) {
  const budget = run.attackHeat?.budgets.find(b => b.id === attackId);
  if (!budget) return 0;
  const refund = Math.min(budget.remaining, Math.max(0, Number(perKill) || 0));
  budget.remaining -= refund;
  return refund;
}

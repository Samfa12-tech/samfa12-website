const LEVELS = Object.freeze({
  none: Object.freeze({level: 'none', rank: 0, label: null}),
  watch: Object.freeze({level: 'watch', rank: 1, label: 'Gate 2 pressure'}),
  urgent: Object.freeze({level: 'urgent', rank: 2, label: 'Gate 2 under attack'}),
  critical: Object.freeze({level: 'critical', rank: 3, label: 'Gate 2 critical'}),
  breached: Object.freeze({level: 'breached', rank: 4, label: 'Gate 2 breached'}),
});

export function resolveGatePressureCue({pressure = 0, integrityRatio = 1, breached = false} = {}) {
  const contact = Math.max(0, Number(pressure) || 0);
  const integrity = Math.max(0, Math.min(1, Number(integrityRatio) || 0));
  if (breached) return LEVELS.breached;
  if (contact <= 0) return LEVELS.none;
  if (integrity <= 0.35 || contact >= 40) return LEVELS.critical;
  if (integrity <= 0.65 || contact >= 12) return LEVELS.urgent;
  return LEVELS.watch;
}

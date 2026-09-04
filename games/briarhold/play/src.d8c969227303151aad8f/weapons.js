export const WEAPON_IDS = Object.freeze(['arbalest', 'sunfire', 'runebolt']);
export const RUNEBOLT_SPLASH_DAMAGE_MULTIPLIER = 0.2;

export const WEAPON_DEFINITIONS = Object.freeze({
  arbalest: Object.freeze({
    id: 'arbalest',
    name: 'Repeating arbalest',
    cue: 'IRON',
    damage: 82,
    interval: 0.095,
    heat: 0.045,
    radius: 0.45,
    impulse: 2.2,
    armour: 'infantry'
  }),
  sunfire: Object.freeze({
    id: 'sunfire',
    name: 'Sunfire projector',
    cue: 'FIRE',
    damage: 34,
    interval: 0.075,
    heat: 0.07,
    radius: 2.7,
    impulse: 0.8,
    armour: 'swarm'
  }),
  runebolt: Object.freeze({
    id: 'runebolt',
    name: 'Runebolt launcher',
    cue: 'RUNE',
    damage: 180,
    interval: 1.25,
    heat: 0.34,
    radius: 4.2,
    impulse: 8,
    armour: 'siege'
  })
});

export const WEAPON_HEAT = Object.freeze({
  passiveCoolingPerSecond: 0.19,
  // Preserve the established 60 FPS balance while making held-fire cooling
  // independent of how many render frames happen to contain a shot event.
  triggerHeldCoolingMultiplier: 0.94,
  overheatedRecoveryThreshold: 0.42,
  emergencyCoolingAmount: 0.58
});

export const KNIFE_MELEE = Object.freeze({
  id: 'knife',
  name: 'Warden knife',
  damage: 50,
  cooldownSeconds: 0.72,
  windupSeconds: 0.1,
  autoCheckIntervalSeconds: 0.1,
  bodyGapReach: 1.05,
  playerRadius: 0.38,
  slashLowOffset: 0.45,
  slashHighOffset: 1.8,
  manualHalfAngle: Math.PI * 11 / 36,
  maxCandidates: 4,
});

const KNIFE_ARMOUR_MULTIPLIERS = Object.freeze({
  infantry: 1,
  swarm: 0.85,
  shield: 0.55,
  siege: 0.3,
  spirit: 0.4,
});

export function createWeaponState() {
  return {
    selected: 'arbalest',
    heat: 0,
    overheated: false,
    emergencyCoolingAvailable: true,
    manualVentReadyAt: 0,
    nextShotAt: 0,
    shots: 0
  };
}

export function createKnifeMeleeState() {
  return {
    nextReadyAt: 0,
    nextScanAt: 0,
    strikes: 0,
    pendingStrike: null,
  };
}

export function knifeMeleeScanDue(state, nowSeconds, {manual = false, automatic = true} = {}) {
  const now = Math.max(0, Number(nowSeconds) || 0);
  if (state?.pendingStrike) return false;
  if (now + 1e-9 < Math.max(0, Number(state?.nextReadyAt) || 0)) return false;
  return Boolean(manual) || (Boolean(automatic) && now + 1e-9 >= Math.max(0, Number(state?.nextScanAt) || 0));
}

/**
 * Ranks a bounded set of close bodies without allocating or sorting the full
 * horde. Automatic defence may cover the full circle; manual strikes keep the
 * authored forward arc supplied by the caller.
 */
export function rankKnifeMeleeCandidateIds({
  playerX = 0,
  playerY = 0,
  playerZ = 0,
  facingYaw = 0,
  x,
  z,
  type,
  status,
  slotCount = 0,
  activeStatus = 1,
  radiusForType = () => 0,
  halfHeightForType = null,
  aimHeightForType = () => 1.25,
  halfAngle = Math.PI,
  maxCandidates = KNIFE_MELEE.maxCandidates,
} = {}) {
  const limit = Math.max(1, Math.min(8, Math.floor(Number(maxCandidates) || KNIFE_MELEE.maxCandidates)));
  const count = Math.max(0, Math.min(Number(slotCount) || 0, x?.length || 0, z?.length || 0));
  const originX = Number(playerX) || 0;
  const originY = Number(playerY) || 0;
  const originZ = Number(playerZ) || 0;
  const yaw = Number(facingYaw) || 0;
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  const cosineLimit = Math.cos(Math.max(0, Math.min(Math.PI, Number(halfAngle) || 0)));
  const ranked = [];
  for (let id = 0; id < count; id++) {
    if (status?.[id] !== activeStatus) continue;
    const dx = Number(x[id]) - originX;
    const dz = Number(z[id]) - originZ;
    const distanceSquared = dx * dx + dz * dz;
    const bodyRadius = Math.max(0, Number(radiusForType(type?.[id])) || 0);
    const bodyHalfHeight = typeof halfHeightForType === 'function'
      ? Math.max(0, Number(halfHeightForType(type?.[id], id)) || 0)
      : bodyRadius;
    const reach = KNIFE_MELEE.bodyGapReach + KNIFE_MELEE.playerRadius + bodyRadius;
    if (distanceSquared > reach * reach) continue;
    const aimHeight = Number(aimHeightForType(type?.[id], id));
    const slashLow = originY + KNIFE_MELEE.slashLowOffset;
    const slashHigh = originY + KNIFE_MELEE.slashHighOffset;
    if (!Number.isFinite(aimHeight)
      || aimHeight + bodyHalfHeight < slashLow
      || aimHeight - bodyHalfHeight > slashHigh) continue;
    const distance = Math.sqrt(distanceSquared);
    if (distance > 0.001 && (dx * forwardX + dz * forwardZ) / distance < cosineLimit) continue;
    const gap = Math.max(0, distance - KNIFE_MELEE.playerRadius - bodyRadius);
    const facingDot = distance > 0.001 ? (dx * forwardX + dz * forwardZ) / distance : 1;
    const candidate = {id, gap, facingDot};
    let insertion = ranked.length;
    while (insertion > 0) {
      const previous = ranked[insertion - 1];
      if (previous.gap < gap
        || (previous.gap === gap && previous.facingDot > facingDot)
        || (previous.gap === gap && previous.facingDot === facingDot && previous.id < id)) break;
      insertion--;
    }
    ranked.splice(insertion, 0, candidate);
    if (ranked.length > limit) ranked.pop();
  }
  return ranked.map(candidate => candidate.id);
}

export function tryKnifeMelee(state, nowSeconds, {manual = false, automatic = true, targetId = null} = {}) {
  const now = Math.max(0, Number(nowSeconds) || 0);
  if (!knifeMeleeScanDue(state, now, {manual, automatic})) return null;
  state.nextScanAt = now + KNIFE_MELEE.autoCheckIntervalSeconds;
  const resolvedTarget = Number.isInteger(targetId) && targetId >= 0 ? targetId : null;
  if (resolvedTarget === null && !manual) return null;
  state.nextReadyAt = now + KNIFE_MELEE.cooldownSeconds;
  state.strikes = Math.max(0, Math.floor(Number(state.strikes) || 0)) + 1;
  const strike = Object.freeze({
    id: KNIFE_MELEE.id,
    targetId: resolvedTarget,
    manual: Boolean(manual),
    firedAt: now,
    strike: state.strikes,
  });
  state.pendingStrike = strike;
  return strike;
}

export function consumeKnifeMeleeContact(state, nowSeconds) {
  const strike = state?.pendingStrike;
  if (!strike) return null;
  const now = Math.max(0, Number(nowSeconds) || 0);
  if (now + 1e-9 < strike.firedAt + KNIFE_MELEE.windupSeconds) return null;
  state.pendingStrike = null;
  return strike;
}

/** The firearm stays holstered for the complete authored knife swipe. */
export function knifeMeleeActionActive(state, nowSeconds) {
  const now = Math.max(0, Number(nowSeconds) || 0);
  return Boolean(
    Math.max(0, Math.floor(Number(state?.strikes) || 0)) > 0
    && now + 1e-9 < Math.max(0, Number(state?.nextReadyAt) || 0)
  );
}

export function knifeDamageAgainst(enemyArmour = 'infantry') {
  return KNIFE_MELEE.damage * (KNIFE_ARMOUR_MULTIPLIERS[enemyArmour] ?? 0.7);
}

export function selectWeapon(state, id) {
  if (!WEAPON_DEFINITIONS[id]) return false;
  state.selected = id;
  return true;
}

export function updateWeaponHeat(state, dt, triggerHeld = false, tuning = {}) {
  const activelyFiring = triggerHeld && !state.overheated;
  const cooling = WEAPON_HEAT.passiveCoolingPerSecond * Math.max(0, Number(dt) || 0)
    * (activelyFiring ? WEAPON_HEAT.triggerHeldCoolingMultiplier : 1)
    * Math.max(0, Number(tuning.passiveCoolingMultiplier) || 1)
    * (state.overheated ? Math.max(0, Number(tuning.overheatCoolingMultiplier) || 1) : 1);
  state.heat = Math.max(0, state.heat - cooling);
  if (state.overheated && state.heat <= WEAPON_HEAT.overheatedRecoveryThreshold) {
    state.overheated = false;
  }
  return state.heat;
}

export function useEmergencyCooling(state) {
  if (!state.emergencyCoolingAvailable) return false;
  state.emergencyCoolingAvailable = false;
  state.heat = Math.max(0, state.heat - WEAPON_HEAT.emergencyCoolingAmount);
  if (state.heat <= WEAPON_HEAT.overheatedRecoveryThreshold) state.overheated = false;
  return true;
}

/** Resolve the mastery vent as a deterministic combat action; the caller owns radial damage authority. */
export function tryManualVent(state, nowSeconds, tuning = {}) {
  const now = Math.max(0, Number(nowSeconds) || 0);
  const damage = Math.max(0, Number(tuning.manualVentBurstDamage) || 0);
  const radius = Math.max(0, Number(tuning.manualVentRadius) || 0);
  if (state?.selected !== "sunfire" || damage <= 0 || radius <= 0
    || now + 1e-9 < Math.max(0, Number(state.manualVentReadyAt) || 0)) return null;
  const heatReduction = Math.max(0, Number(tuning.manualVentHeatReduction) || 0);
  state.heat = Math.max(0, state.heat - heatReduction);
  if (state.overheated && state.heat <= WEAPON_HEAT.overheatedRecoveryThreshold) state.overheated = false;
  state.manualVentReadyAt = now + Math.max(0.1, Number(tuning.manualVentCooldownSeconds) || 0.1);
  return Object.freeze({damage, radius, firedAt: now, nextReadyAt: state.manualVentReadyAt});
}

export function tryFireWeapon(state, nowSeconds, tuning = {}) {
  const now = Math.max(0, Number(nowSeconds) || 0);
  const weapon = WEAPON_DEFINITIONS[state.selected] || WEAPON_DEFINITIONS.arbalest;
  if (state.overheated || now + 1e-9 < state.nextShotAt) return null;
  const previousDeadline = Math.max(0, Number(state.nextShotAt) || 0);
  const overheatThreshold = Math.max(1, Number(tuning.overheatThreshold) || 1);
  state.heat = Math.min(overheatThreshold, state.heat + weapon.heat * Math.max(0, Number(tuning.heatGainMultiplier) || 1));
  // Keep fractional lateness from normal frame sampling, but never emit a
  // catch-up burst after a real hitch. One call can still produce one shot.
  const lateness = now - previousDeadline;
  const interval = weapon.interval
    * Math.max(0.1, Number(tuning.shotIntervalMultiplier) || 1)
    * (weapon.id === "arbalest" && tuning.adsActive
      ? Math.max(0.1, Number(tuning.adsShotIntervalMultiplier) || 1)
      : weapon.id === "arbalest"
        ? Math.max(0.1, Number(tuning.hipShotIntervalMultiplier) || 1)
        : 1)
    * (weapon.id === "runebolt" ? Math.max(0.1, Number(tuning.runeboltShotIntervalMultiplier) || 1) : 1)
    * Math.max(0.1, Number(tuning.handlingIntervalMultiplier) || 1);
  state.nextShotAt = previousDeadline > 0 && lateness <= interval + 1e-9
    ? previousDeadline + interval
    : now + interval;
  state.shots += 1;
  const overheatWindow = weapon.id === "sunfire" && overheatThreshold > 1 && state.heat >= 1;
  if (state.heat >= overheatThreshold) state.overheated = true;
  return { ...weapon, firedAt: now, shot: state.shots, overheatWindow };
}

export function weaponDamageAgainst(weaponId, enemyArmour = 'infantry') {
  const weapon = WEAPON_DEFINITIONS[weaponId] || WEAPON_DEFINITIONS.arbalest;
  let multiplier = 1;
  if (weapon.armour === enemyArmour) multiplier = 1.7;
  else if (enemyArmour === 'shield') {
    multiplier = weapon.id === 'sunfire' ? 1.25 : weapon.id === 'runebolt' ? 0.8 : 0.4;
  }
  else if (enemyArmour === 'siege' && weapon.id === 'arbalest') multiplier = 0.28;
  else if (enemyArmour === 'siege' && weapon.id === 'sunfire') multiplier = 0.22;
  else if (enemyArmour === 'spirit' && weapon.id === 'arbalest') multiplier = 0.48;
  else if (enemyArmour === 'swarm' && weapon.id === 'arbalest') multiplier = 0.6;
  else if (enemyArmour === 'swarm' && weapon.id === 'runebolt') multiplier = 0.03;
  return weapon.damage * multiplier;
}

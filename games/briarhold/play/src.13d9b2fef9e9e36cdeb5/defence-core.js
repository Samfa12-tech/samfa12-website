import {FORTIFICATION_DEFINITIONS} from './fortifications.js';
import {BRIARHOLD_FIRST_PERSON_MAP} from './map-definition.js';
import {firstMapRayHit} from './map-raycast.js';
import {enemyArchetype, isEnemyType, WICKER_COLOSSUS, HOLLOW_HART} from './enemies.js';

// Named first-slice trial prices/effects, not accepted balance. Refund choices
// compete with the existing 10-Supply service that rearms all depleted traps.
export const DEFENCE_TRIAL_PARAMETERS = Object.freeze({
  refundFraction: .75, trapRearmCost: 10, dropWarningSeconds: .22,
  dropFallSeconds: .52, dropStrikeDelaySeconds: .74,
  dropDamage: 260, dropBossDamageMultiplier: .35, dropBossStagger: 12, dropBossStaggerSeconds: .2,
  dropMaxEnemies: 24, dropMaxBosses: 4, dropMaxCandidates: 128, ballistaMaxCandidates: 64,
});
export const BALLISTA_BRANCHES = Object.freeze({
  base: Object.freeze({id: 'base', name: 'Standard mechanism', cost: 0, damage: 130, interval: 1.25, armourMultiplier: .85, stagger: 35}),
  heavyBolt: Object.freeze({id: 'heavyBolt', name: 'Heavy bolt', cost: 28, damage: 175, interval: 1.4, armourMultiplier: 1, stagger: 45}),
  fastWinch: Object.freeze({id: 'fastWinch', name: 'Faster winch', cost: 24, damage: 130, interval: .9, armourMultiplier: .85, stagger: 35}),
});
export const DEFENCE_MAP_TYPES = Object.freeze({
  barricade: 'barricade', thornSnare: 'thorn-snare', firePot: 'fire-pot',
  wardLantern: 'ward-lantern', ballista: 'ballista', gateDropTrap: 'gate-drop-trap',
});
// Shared rendered-mechanism contract: +Z forward, +Y yaw, elevation pitch.
export const BALLISTA_MECHANISM = Object.freeze({pivotHeight: 2.2, muzzleLength: 2.2, baseHalfWidth: 2.4, baseHalfDepth: 2.3, baseHeight: 1.5});

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nightNumber = value => Math.max(1, Math.floor(finite(value, 1)));
const pointFor = site => site?.position ?? site;
const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const siteFor = (siteId, map) => map.buildSockets.find(site => site.id === siteId);

/** Old saves lack branch metadata and retain a neutral base mechanism. */
export function normalizeDefencePlacement(placement) {
  const definition = Object.hasOwn(FORTIFICATION_DEFINITIONS, placement?.type) ? FORTIFICATION_DEFINITIONS[placement.type] : null;
  if (!definition || typeof placement.socketId !== 'string') return null;
  const normalized = {...placement, charges: Number.isFinite(definition.charges)
    ? Math.max(0, Math.min(definition.charges, Math.floor(finite(placement.charges, definition.charges))))
    : null};
  if (placement.type === 'ballista') normalized.branch = Object.hasOwn(BALLISTA_BRANCHES, placement.branch) ? placement.branch : 'base';
  else delete normalized.branch;
  if (placement.type === 'gateDropTrap') normalized.lastTriggeredNight = Math.max(0, Math.floor(finite(placement.lastTriggeredNight)));
  return normalized;
}

export function ballistaShotProfile(placement = {}) {
  return Object.hasOwn(BALLISTA_BRANCHES, placement.branch) ? BALLISTA_BRANCHES[placement.branch] : BALLISTA_BRANCHES.base;
}

export function defenceReclaimQuote(placement, {refundFraction = DEFENCE_TRIAL_PARAMETERS.refundFraction} = {}) {
  const item = normalizeDefencePlacement(placement);
  if (!item) return {invested: 0, grossRefund: 0, chargeAdjustment: 0, refund: 0};
  const definition = FORTIFICATION_DEFINITIONS[item.type];
  const invested = definition.cost + (item.type === 'ballista' ? ballistaShotProfile(item).cost : 0);
  const fraction = Math.max(0, Math.min(1, finite(refundFraction, .75)));
  const grossRefund = Math.floor(invested * fraction);
  const usedFraction = Number.isFinite(definition.charges) ? 1 - item.charges / definition.charges : 0;
  const chargeAdjustment = usedFraction > 0 ? Math.max(
    Math.ceil(DEFENCE_TRIAL_PARAMETERS.trapRearmCost * usedFraction),
    DEFENCE_TRIAL_PARAMETERS.trapRearmCost - (invested - grossRefund),
  ) : 0;
  return {invested, grossRefund, chargeAdjustment, refund: Math.max(0, grossRefund - chargeAdjustment)};
}

export function inspectDefenceSite({siteId, fortifications = [], unlockedRecipes = [], mapDefinition = BRIARHOLD_FIRST_PERSON_MAP} = {}) {
  const site = siteFor(siteId, mapDefinition);
  if (!site) return null;
  const placement = normalizeDefencePlacement(fortifications.find(item => item.socketId === siteId));
  return {site, placement, reclaim: defenceReclaimQuote(placement), recipes: Object.entries(DEFENCE_MAP_TYPES)
    .filter(([, type]) => site.allowed.includes(type))
    .map(([type]) => ({...FORTIFICATION_DEFINITIONS[type], unlocked: unlockedRecipes.includes(type)})),
  branches: placement?.type === 'ballista' ? Object.values(BALLISTA_BRANCHES) : []};
}

/** Compute a fresh authority quote; never trust client-provided refund/cost. */
export function quoteDefenceChange({phase, siteId, type, action = 'install', branch = 'base', fortifications = [], supplies = 0, defenceUseLedger = {},
  unlockedRecipes = [], mapDefinition = BRIARHOLD_FIRST_PERSON_MAP, night = 1} = {}) {
  const rejected = reason => ({valid: false, reason, action, siteId, cost: 0, refund: 0, chargeAdjustment: 0, netCost: 0});
  if (phase !== 'daytime') return rejected('daytime_only');
  const site = siteFor(siteId, mapDefinition);
  if (!site) return rejected('unknown_site');
  const old = normalizeDefencePlacement(fortifications.find(item => item.socketId === siteId));
  const useLedger = normalizeDefenceUseLedger(defenceUseLedger, mapDefinition);
  if (old?.type === 'gateDropTrap' && old.lastTriggeredNight > (useLedger[siteId] ?? 0)) useLedger[siteId] = old.lastTriggeredNight;
  if (!['install', 'replace', 'reclaim', 'upgrade'].includes(action)) return rejected('unknown_action');
  if (action === 'install' && old) return rejected('occupied');
  if (action !== 'install' && !old) return rejected('empty_site');
  let cost = 0, nextPlacement = null, reclaim = {refund: 0, chargeAdjustment: 0, grossRefund: 0};
  if (action === 'reclaim') reclaim = defenceReclaimQuote(old);
  else if (action === 'upgrade') {
    if (old.type !== 'ballista' || old.branch !== 'base' || branch === 'base' || !Object.hasOwn(BALLISTA_BRANCHES, branch)) return rejected('exclusive_branch');
    if (!unlockedRecipes.includes('ballista')) return rejected('recipe_locked');
    cost = BALLISTA_BRANCHES[branch].cost;
    nextPlacement = {...old, branch};
  } else {
    if (!Object.hasOwn(FORTIFICATION_DEFINITIONS, type) || !site.allowed.includes(DEFENCE_MAP_TYPES[type])) return rejected('incompatible_recipe');
    if (!unlockedRecipes.includes(type)) return rejected('recipe_locked');
    if (branch !== 'base') return rejected('upgrade_separately');
    cost = FORTIFICATION_DEFINITIONS[type].cost;
    if (action === 'replace') reclaim = defenceReclaimQuote(old);
    nextPlacement = normalizeDefencePlacement({socketId: siteId, type, charges: FORTIFICATION_DEFINITIONS[type].charges,
      ...(type === 'ballista' ? {branch: 'base'} : {}),
      ...(type === 'gateDropTrap' ? {lastTriggeredNight: useLedger[siteId] ?? 0} : {})});
    if (type === 'gateDropTrap' && nextPlacement.lastTriggeredNight >= nightNumber(night)) nextPlacement.charges = 0;
  }
  const netCost = cost - reclaim.refund;
  if (!Number.isFinite(supplies) || supplies < 0 || supplies < netCost) return rejected('not_enough_supplies');
  return {valid: true, reason: null, action, siteId, cost, refund: reclaim.refund,
    grossRefund: reclaim.grossRefund, chargeAdjustment: reclaim.chargeAdjustment, netCost,
    suppliesAfter: supplies - netCost, oldPlacement: old, nextPlacement, defenceUseLedger: useLedger};
}

/** Cancel and failed confirmation preserve caller state and array identity. */
export function applyDefenceChange(state, request, {confirmed = false, mapDefinition = BRIARHOLD_FIRST_PERSON_MAP} = {}) {
  const quote = quoteDefenceChange({...request, phase: state.phase, night: state.night,
    fortifications: state.fortifications, supplies: state.supplies, defenceUseLedger: state.defenceUseLedger, mapDefinition});
  if (!confirmed || !quote.valid) return {state, quote, changed: false};
  const next = state.fortifications.filter(item => item.socketId !== quote.siteId);
  if (quote.nextPlacement) next.push(quote.nextPlacement);
  return {state: {...state, fortifications: next, supplies: quote.suppliesAfter, defenceUseLedger: quote.defenceUseLedger}, quote, changed: true};
}

/** Keep only authored rack sites; the ledger survives empty-site save/reload. */
export function normalizeDefenceUseLedger(value = {}, mapDefinition = BRIARHOLD_FIRST_PERSON_MAP) {
  const ledger = {};
  for (const site of mapDefinition.buildSockets) {
    const night = value?.[site.id];
    if (site.allowed.includes('gate-drop-trap') && Number.isSafeInteger(night) && night > 0) ledger[site.id] = night;
  }
  return ledger;
}

export function defenceCollisionFootprint(type) {
  const footprints = {
    barricade: {halfWidth: 2.9, halfDepth: 1.1, height: 1.6, solid: true},
    thornSnare: {halfWidth: 2.6, halfDepth: 2.6, height: .35, solid: false, slowScale: .48},
    firePot: {halfWidth: .8, halfDepth: .8, height: 1.8, solid: true},
    wardLantern: {halfWidth: .5, halfDepth: .5, height: 2.1, solid: true},
    ballista: {halfWidth: 2.4, halfDepth: 2.3, height: 1.5, solid: true},
    // Suspended rack; no invisible ground seal or cross-passage supports.
    gateDropTrap: {halfWidth: 3.75, halfDepth: .65, height: 2.2, solid: false},
  };
  return footprints[type] ? {...footprints[type]} : null;
}

/** Constrained aim includes stock-to-muzzle and muzzle-to-impact rays. */
export function ballistaAimSolution(site, target, {mapDefinition = BRIARHOLD_FIRST_PERSON_MAP, disabledCollisionIds = null} = {}) {
  const position = pointFor(site), point = target?.position ?? target;
  const denied = reason => ({allowed: false, reason});
  if (!position || !point || ![position.x, position.y, position.z, point.x, point.y, point.z].every(Number.isFinite)) return denied('invalid_target');
  const pivot = {x: position.x, y: position.y + BALLISTA_MECHANISM.pivotHeight, z: position.z};
  const delta = {x: point.x - pivot.x, y: point.y - pivot.y, z: point.z - pivot.z};
  const distance = Math.hypot(delta.x, delta.y, delta.z);
  const yaw = Math.atan2(delta.x, delta.z), pitch = Math.atan2(delta.y, Math.hypot(delta.x, delta.z));
  const arc = site.ballistaArc ?? {halfYaw: Math.PI * .36, minPitch: -Math.PI / 5, maxPitch: Math.PI / 6, minRange: 6, maxRange: 46};
  if (distance < arc.minRange || distance > arc.maxRange) return denied('range');
  if (Math.abs(wrapAngle(yaw - finite(site.facing))) > arc.halfYaw || pitch < arc.minPitch || pitch > arc.maxPitch) return denied('arc');
  const direction = {x: delta.x / distance, y: delta.y / distance, z: delta.z / distance};
  const muzzle = {x: pivot.x + direction.x * BALLISTA_MECHANISM.muzzleLength,
    y: pivot.y + direction.y * BALLISTA_MECHANISM.muzzleLength,
    z: pivot.z + direction.z * BALLISTA_MECHANISM.muzzleLength};
  const clearance = firstMapRayHit(pivot, direction, BALLISTA_MECHANISM.muzzleLength, {mapDefinition, disabledCollisionIds});
  if (clearance) return {allowed: false, reason: 'muzzle_blocked', obstructionId: clearance.id};
  const obstruction = firstMapRayHit(muzzle, direction, distance - BALLISTA_MECHANISM.muzzleLength, {mapDefinition, disabledCollisionIds});
  if (obstruction) return {allowed: false, reason: 'occluded', obstructionId: obstruction.id};
  return {allowed: true, reason: null, yaw, pitch, pivot, muzzle, direction, distance, target: {...point}};
}

export function selectBallistaTarget(site, candidates = [], options = {}) {
  return candidates.slice(0, DEFENCE_TRIAL_PARAMETERS.ballistaMaxCandidates)
    .filter(target => target && target.active !== false && target.defeated !== true && !(Number.isFinite(target.hp) && target.hp <= 0))
    .map(target => ({target, aim: ballistaAimSolution(site, target, options)}))
    .filter(item => item.aim.allowed)
    .sort((a, b) => Number(Boolean(a.target.boss)) - Number(Boolean(b.target.boss))
      || a.aim.distance - b.aim.distance || String(a.target.enemyId ?? a.target.actorId).localeCompare(String(b.target.enemyId ?? b.target.actorId)))[0] ?? null;
}

export function gateDropTrapStatus(placement, night = 1) {
  const item = normalizeDefencePlacement(placement);
  if (item?.type !== 'gateDropTrap' || item.disabledForWave) return 'unavailable';
  if (item.dropState?.status === 'warning' && item.dropState.night === nightNumber(night)) return 'warning';
  return item.charges > 0 && item.lastTriggeredNight < nightNumber(night) ? 'ready' : 'spent';
}

/** Clamp accidental legacy wave refills without discarding a pending strike. */
export function enforceGateDropTrapNight(placement, night = 1, defenceUseLedger = {}) {
  if (placement?.type !== 'gateDropTrap') return placement;
  const lastTriggeredNight = Math.max(finite(placement.lastTriggeredNight), finite(defenceUseLedger[placement.socketId]));
  if (lastTriggeredNight < nightNumber(night)) return placement;
  return placement.charges === 0 && placement.lastTriggeredNight === lastTriggeredNight ? placement : {...placement, charges: 0, lastTriggeredNight};
}

/** Shared refill adapter for Trapper/daywork; legacy pot/snare policy stays. */
export function restockDefencePlacement(placement, {phase, night = 1, defenceUseLedger = {}} = {}) {
  const item = normalizeDefencePlacement(placement);
  if (!item) return placement;
  if (item.type !== 'gateDropTrap') return {...placement, charges: FORTIFICATION_DEFINITIONS[item.type].charges};
  if (phase !== 'daytime' || Math.max(item.lastTriggeredNight, finite(defenceUseLedger[item.socketId])) >= nightNumber(night)) return enforceGateDropTrapNight(placement, night, defenceUseLedger);
  const next = {...item, charges: 1};
  delete next.dropState;
  return next;
}

/** Spend at trigger, persist warning, and deduplicate double taps immediately. */
export function triggerGateDropTrap({placement, phase, night = 1, now = 0, eventId, defenceUseLedger = {}} = {}) {
  const ledger = normalizeDefenceUseLedger(defenceUseLedger);
  if (!siteFor(placement?.socketId, BRIARHOLD_FIRST_PERSON_MAP)?.allowed.includes('gate-drop-trap')
    || phase !== 'combat' || gateDropTrapStatus(enforceGateDropTrapNight(placement, night, ledger), night) !== 'ready' || !Number.isFinite(now) || now < 0
    || typeof eventId !== 'string' || !/^[a-z0-9][a-z0-9:-]{0,127}$/u.test(eventId)) return {placement, triggered: false};
  const item = normalizeDefencePlacement(placement);
  return {placement: {...item, charges: 0, lastTriggeredNight: nightNumber(night),
    dropState: {status: 'warning', eventId, night: nightNumber(night), triggeredAt: now,
      releaseAt: now + DEFENCE_TRIAL_PARAMETERS.dropStrikeDelaySeconds}}, triggered: true,
    defenceUseLedger: {...ledger, [item.socketId]: nightNumber(night)}};
}

export function dropTrapDamageCommands(site, candidates = []) {
  const strip = site?.strikeStrip;
  if (!strip) return [];
  const inStrip = target => {
    const p = target?.position ?? target;
    return p && [p.x, p.y, p.z].every(Number.isFinite) && p.y >= strip.minY && p.y <= strip.maxY
      && Math.abs(p.x - strip.x) <= strip.halfWidth && Math.abs(p.z - strip.z) <= strip.halfDepth;
  };
  const targets = candidates.slice(0, DEFENCE_TRIAL_PARAMETERS.dropMaxCandidates).filter(target => target && target.active !== false && !target.defeated && target.flying !== true
    && !(Number.isFinite(target.hp) && target.hp <= 0) && inStrip(target))
    .filter(target => !Number.isInteger(target.type) || (isEnemyType(target.type) && !enemyArchetype(target.type).flying))
    .sort((a, b) => String(a.enemyId ?? a.actorId).localeCompare(String(b.enemyId ?? b.actorId)));
  const seen = new Set(), counts = {enemy: 0, boss: 0}, commands = [];
  for (const target of targets) {
    const boss = target.boss === true || target.actorId !== undefined || [WICKER_COLOSSUS, HOLLOW_HART].includes(target.type);
    const kind = target.actorId !== undefined ? 'boss' : 'enemy';
    const key = `${kind}:${target.enemyId ?? target.actorId}`;
    if (seen.has(key) || counts[boss ? 'boss' : 'enemy'] >= (boss ? DEFENCE_TRIAL_PARAMETERS.dropMaxBosses : DEFENCE_TRIAL_PARAMETERS.dropMaxEnemies)) continue;
    if (kind === 'enemy' ? !Number.isInteger(target.enemyId) || target.enemyId < 0 : typeof target.actorId !== 'string') continue;
    seen.add(key); counts[boss ? 'boss' : 'enemy'] += 1;
    commands.push({kind, ...(kind === 'enemy' ? {enemyId: target.enemyId} : {actorId: target.actorId}),
      damage: DEFENCE_TRIAL_PARAMETERS.dropDamage * (boss ? DEFENCE_TRIAL_PARAMETERS.dropBossDamageMultiplier : 1),
      // Fixed director actors use stagger gauge points; crowd actors use the
      // game's seconds-based velocity/cooldown effect. Never exchange units.
      stagger: boss && kind === 'boss' ? DEFENCE_TRIAL_PARAMETERS.dropBossStagger : 0,
      staggerSeconds: boss && kind === 'enemy' ? DEFENCE_TRIAL_PARAMETERS.dropBossStaggerSeconds : 0,
      bossResistance: boss});
  }
  return commands;
}

/** Authority emits one strike; cosmetics never decide damage or timing. */
export function stepGateDropTrap({placement, phase, night = 1, now = 0, site, candidates = []} = {}) {
  const state = placement?.dropState;
  if (site?.id !== placement?.socketId || !site?.allowed?.includes('gate-drop-trap')
    || phase !== 'combat' || placement?.type !== 'gateDropTrap' || placement.disabledForWave || state?.status !== 'warning' || state.night !== nightNumber(night)
    || !Number.isFinite(state.triggeredAt) || state.triggeredAt < 0 || !Number.isFinite(state.releaseAt) || state.releaseAt < state.triggeredAt
    || !Number.isFinite(now) || now + 1e-9 < state.releaseAt) return {placement, struck: false, damageCommands: []};
  return {placement: {...placement, charges: 0, dropState: {...state, status: 'spent'}}, struck: true,
    event: {eventId: state.eventId, kind: 'gate_drop_strike', socketId: placement.socketId, night: state.night},
    damageCommands: dropTrapDamageCommands(site, candidates)};
}

/** Ending a wave cancels an unfinished cosmetic fall, never refunds its charge. */
export function settleGateDropTrapAtWaveBoundary(placement) {
  if (placement?.type !== 'gateDropTrap' || placement.dropState?.status !== 'warning') return placement;
  return {...placement, charges: 0, dropState: {...placement.dropState, status: 'spent'}};
}

export function rearmGateDropTrap({placement, phase, night = 1, supplies = 0} = {}) {
  const item = normalizeDefencePlacement(placement);
  if (phase !== 'daytime' || item?.type !== 'gateDropTrap' || item.charges > 0
    || item.lastTriggeredNight >= nightNumber(night) || !Number.isFinite(supplies) || supplies < DEFENCE_TRIAL_PARAMETERS.trapRearmCost) return {placement, supplies, rearmed: false};
  const next = {...item, charges: 1};
  delete next.dropState;
  return {placement: next, supplies: supplies - DEFENCE_TRIAL_PARAMETERS.trapRearmCost, rearmed: true};
}

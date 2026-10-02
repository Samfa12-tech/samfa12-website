import {resolveProjectileRayHit} from "./combat-feedback.js";
import {nearestFirePotRayHit} from "./fortifications.js";
import {enemyArchetype, enemyArmour} from "./enemies.js";
import {firstMapRayHit} from "./map-raycast.js";
import {bossRayHit, bossesInRadius, bossesInViewCone} from "./boss-presentation.js";
import {
  RUNEBOLT_SPLASH_DAMAGE_MULTIPLIER,
  KNIFE_MELEE,
  WEAPON_DEFINITIONS,
  WEAPON_IDS,
  knifeDamageAgainst,
  rankKnifeMeleeCandidateIds,
  weaponDamageAgainst,
} from "./weapons.js";

function finiteMultiplier(value) {
  const number = Number(value ?? 1);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw new RangeError("damageMultiplier must be finite and bounded");
  }
  return number;
}

function enemyPoint(battlefield, id) {
  const type = battlefield.type[id];
  return {
    x: battlefield.x[id],
    y: enemyAimHeight(type),
    z: battlefield.z[id],
  };
}

function enemyAimHeight(type) {
  return type === 3 ? 3.6 : type >= 5 ? 3.1 : type === 1 ? 1.75 : 1.25;
}

function enemyTargetHalfHeight(type) {
  return type === 3 ? 1.8 : enemyArchetype(type).radius;
}

function applyEnemyDamage(battlefield, enemyId, weaponId, scale, damageMultiplier, tuning = {}, mode = {}) {
  const definition = WEAPON_DEFINITIONS[weaponId];
  const naturalMultiplier = weaponDamageAgainst(weaponId, enemyArmour(battlefield.type[enemyId])) / definition.damage;
  const armourMultiplier = weaponId === "arbalest"
    ? Math.max(naturalMultiplier, Number(tuning.minimumArmourMultiplier) || 0)
    : naturalMultiplier;
  const modeMultiplier = weaponId === "arbalest" && mode.ads
    ? Number(tuning.adsDamageMultiplier) || 1
    : weaponId === "sunfire" && mode.overheatWindow
      ? Number(tuning.overheatDamageMultiplier) || 1
      : 1;
  const damage = definition.damage * armourMultiplier * scale * damageMultiplier * modeMultiplier;
  const result = battlefield.damageEnemy(enemyId, damage);
  return Object.freeze({
    enemyId,
    damage,
    killed: result.killed,
    hp: result.hp,
  });
}

function combatMode(event) {
  const value = event?.mode ?? {ads: false, overheatWindow: false, charged: false, manualVent: false};
  for (const key of ["ads", "overheatWindow", "charged", "manualVent"]) {
    if (typeof value[key] !== "boolean") throw new TypeError(`authoritative combat mode.${key} must be a boolean`);
  }
  return value;
}

function tuningValue(tuning, key, fallback, minimum = 0, maximum = 1000) {
  const value = tuning?.[key] ?? fallback;
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new RangeError(`combat tuning ${key} is invalid`);
  return value;
}

function effectBundle() {
  return {staggers: [], armourCracks: [], gravityPulses: [], clusterImpacts: [], ricochets: []};
}

function combatFactId(eventId, suffix) {
  const tail = String(suffix).toLowerCase().replace(/[^a-z0-9-]+/gu, '-').replace(/^-+|-+$/gu, '');
  const head = eventId.slice(0, Math.max(1, 127 - tail.length)).replace(/-+$/u, '');
  return `${head}-${tail}`;
}

/**
 * Project one already-resolved combat result into relationship-goal facts.
 * The caller supplies the stable authoritative action ID; this keeps renderer
 * feedback and transport sequencing out of the goal authority boundary.
 */
export function createCombatGoalEvents(result, {eventId} = {}) {
  if (typeof eventId !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/u.test(eventId)) {
    throw new RangeError("combat goal facts require a stable bounded eventId");
  }
  if (!result || typeof result.actorId !== "string" || typeof result.weaponId !== "string") return [];
  const facts = [];
  for (const hit of Array.isArray(result.hits) ? result.hits : []) {
    if (!Number.isInteger(hit?.enemyId) || hit.enemyId < 0 || !Number.isFinite(hit.damage) || hit.damage <= 0) continue;
    const enemyId = `enemy-${hit.enemyId}`;
    if (hit.killed === true) {
      facts.push({
        type: "kill",
        eventId: combatFactId(eventId, `kill-${hit.enemyId}`),
        actorId: result.actorId,
        weaponId: result.weaponId,
        enemyId,
      });
    }
  }
  return facts;
}

/** Resolve a strict host-authored weapon event against shared game authority. */
export function resolveAuthoritativeCombatEvent({
  battlefield,
  event,
  mapDefinition,
  disabledCollisionIds = null,
  damageMultiplier = 1,
  bossDamageMultiplier = damageMultiplier,
  tuning = {},
  bossEncounter = null,
  applyBossHit = null,
  firePotPlacements = null,
  firePotSockets = null,
  applyFirePot = null,
} = {}) {
  if (!battlefield || typeof battlefield.queryRayHits !== "function") {
    throw new TypeError("Battlefield authority is required");
  }
  if (!['weapon_fired', 'weapon_vented', 'melee_strike'].includes(event?.kind)) throw new RangeError("Unsupported authoritative combat event");
  const multiplier = finiteMultiplier(damageMultiplier);
  const bossMultiplier = finiteMultiplier(bossDamageMultiplier);
  const mode = event.kind === 'melee_strike' ? null : combatMode(event);
  const effects = effectBundle();
  const bossHits = [];
  const resolveBossHit = descriptor => {
    if (typeof applyBossHit === 'function' && applyBossHit(descriptor) === false) return false;
    bossHits.push(Object.freeze(descriptor));
    return true;
  };
  if (event.kind === 'melee_strike') {
    const groundY = event.origin.y - (KNIFE_MELEE.slashLowOffset + KNIFE_MELEE.slashHighOffset) / 2;
    const candidates = rankKnifeMeleeCandidateIds({
      playerX: event.origin.x, playerY: groundY, playerZ: event.origin.z,
      facingYaw: Math.atan2(event.direction.x, event.direction.z),
      x: battlefield.x, z: battlefield.z, type: battlefield.type, status: battlefield.status,
      slotCount: battlefield.slotCount, activeStatus: 1,
      radiusForType: type => enemyArchetype(type).radius,
      halfHeightForType: enemyTargetHalfHeight,
      aimHeightForType: enemyAimHeight,
      halfAngle: KNIFE_MELEE.manualHalfAngle,
      maxCandidates: 8,
    });
    const bossCandidates = bossesInViewCone(bossEncounter, {origin: event.origin, direction: event.direction,
      range: 3.4, halfAngle: KNIFE_MELEE.manualHalfAngle});
    const combined = [
      ...candidates.map(enemyId => ({kind: 'enemy', enemyId,
        orderDistance: Math.max(0, Math.hypot(battlefield.x[enemyId] - event.origin.x,
          battlefield.z[enemyId] - event.origin.z) - enemyArchetype(battlefield.type[enemyId]).radius),
        stableKey: `enemy:${String(enemyId).padStart(8, '0')}`})),
      ...bossCandidates.map(actorId => {
        const actor = bossEncounter.actors.find(item => item.id === actorId);
        return {kind: 'boss', actorId,
          orderDistance: Math.max(0, Math.hypot(actor.position.x - event.origin.x,
            actor.position.z - event.origin.z) - actor.radius),
          stableKey: `boss:${actorId}`};
      }),
    ].sort((left, right) => left.orderDistance - right.orderDistance || left.stableKey.localeCompare(right.stableKey, 'en-US'));
    const hits = [];
    let impact = {kind: 'miss', point: {
      x: event.origin.x + event.direction.x * 2,
      y: event.origin.y + event.direction.y * 2,
      z: event.origin.z + event.direction.z * 2,
    }};
    for (const candidate of combined) {
      const point = candidate.kind === 'enemy'
        ? enemyPoint(battlefield, candidate.enemyId)
        : (() => {
          const actor = bossEncounter.actors.find(item => item.id === candidate.actorId);
          return {x: actor.position.x, y: actor.position.y + actor.radius * 0.45, z: actor.position.z};
        })();
      const dx = point.x - event.origin.x; const dy = point.y - event.origin.y; const dz = point.z - event.origin.z;
      const distance = Math.hypot(dx, dy, dz);
      const direction = distance > 0 ? {x: dx / distance, y: dy / distance, z: dz / distance} : event.direction;
      const blocker = firstMapRayHit(event.origin, direction, distance, {mapDefinition, disabledCollisionIds});
      if (!blocker || blocker.distance + 0.08 >= distance) {
        if (candidate.kind === 'enemy') {
          const damage = knifeDamageAgainst(enemyArmour(battlefield.type[candidate.enemyId])) * multiplier;
          const result = battlefield.damageEnemy(candidate.enemyId, damage);
          hits.push(Object.freeze({enemyId: candidate.enemyId, damage, killed: result.killed, hp: result.hp}));
          impact = {kind: 'enemy', enemyId: candidate.enemyId, point};
        } else {
          resolveBossHit({actorId: candidate.actorId, weaponId: 'knife', damage: KNIFE_MELEE.damage * bossMultiplier,
            armourMultiplier: 0.9, stagger: 45});
          impact = {kind: 'boss', actorId: candidate.actorId, point};
        }
        break;
      }
      impact = {kind: 'world', volumeId: blocker.id, point: blocker.point, distance: blocker.distance};
    }
    return Object.freeze({actorId: event.actorId, weaponId: 'knife', hits: Object.freeze(hits),
      bossHits: Object.freeze(bossHits), effects: Object.freeze(effects), impact: Object.freeze(impact)});
  }
  const weaponId = WEAPON_IDS[event.weaponSlot];
  const definition = WEAPON_DEFINITIONS[weaponId];
  if (!definition) throw new RangeError("Authoritative weapon slot is invalid");
  if (event.kind === 'weapon_vented') {
    if (weaponId !== 'sunfire' || !mode.manualVent) throw new RangeError('manual vent event is invalid');
    const radius = tuningValue(tuning, 'manualVentRadius', 0, 0, 100);
    const damage = tuningValue(tuning, 'manualVentBurstDamage', 0, 0, 100000) * multiplier;
    const bossDamage = tuningValue(tuning, 'manualVentBurstDamage', 0, 0, 100000) * bossMultiplier;
    const hits = radius > 0 && damage > 0
      ? battlefield.damageInRadius({x: event.origin.x, z: event.origin.z, radius, maxResults: 48}, damage)
        .map(result => Object.freeze({enemyId: result.id, damage, killed: result.killed, hp: result.hp}))
      : [];
    for (const actorId of bossesInRadius(bossEncounter, {x: event.origin.x, z: event.origin.z, radius})) {
      resolveBossHit({actorId, weaponId, damage: bossDamage, stagger: 30, splash: true});
    }
    return Object.freeze({actorId: event.actorId, weaponId, hits: Object.freeze(hits), bossHits: Object.freeze(bossHits),
      effects: Object.freeze(effects), impact: Object.freeze({kind: 'vent', point: event.origin})});
  }
  const maxDistance = weaponId === "runebolt" ? 130 : weaponId === "sunfire"
    ? 16 * tuningValue(tuning, 'beamRangeMultiplier', 1, 0.1, 10) : 160;
  const worldHit = firstMapRayHit(event.origin, event.direction, maxDistance, {
    mapDefinition,
    disabledCollisionIds,
  });
  const firePotHit = nearestFirePotRayHit(
    firePotPlacements,
    firePotSockets,
    event.origin,
    event.direction,
    maxDistance,
  );
  if (firePotHit) {
    const hitPadding = weaponId === "runebolt"
      ? 0.08 * tuningValue(tuning, "runeboltHitPaddingMultiplier", 1, 0.1, 10)
      : 0.08;
    const crowdHit = battlefield.queryRayHits({
      origin: event.origin,
      direction: event.direction,
      maxDistance,
      maxResults: 1,
      padding: hitPadding,
    })[0];
    const bossHit = bossRayHit(bossEncounter, {origin: event.origin, direction: event.direction, maxDistance});
    const nearestBlockingDistance = Math.min(
      worldHit?.distance ?? Infinity,
      crowdHit?.distance ?? Infinity,
      bossHit?.distance ?? Infinity,
    );
    if (firePotHit.distance + hitPadding < nearestBlockingDistance) {
      const activated = typeof applyFirePot !== "function" || applyFirePot(firePotHit.socketId) !== false;
      if (activated) {
        return Object.freeze({
          actorId: event.actorId,
          weaponId,
          hits: Object.freeze([]),
          bossHits: Object.freeze([]),
          effects: Object.freeze(effects),
          impact: Object.freeze({kind: "fortification", ...firePotHit}),
        });
      }
    }
  }
  const hits = [];
  let impact = worldHit
    ? {kind: "world", volumeId: worldHit.id, point: worldHit.point, distance: worldHit.distance}
    : {kind: "miss", point: {
      x: event.origin.x + event.direction.x * maxDistance,
      y: event.origin.y + event.direction.y * maxDistance,
      z: event.origin.z + event.direction.z * maxDistance,
    }};

  if (weaponId === "sunfire") {
    const targets = battlefield.queryConeHits({
      x: event.origin.x,
      z: event.origin.z,
      directionX: event.direction.x,
      directionZ: event.direction.z,
      range: maxDistance,
      halfAngle: Math.PI / 10 * tuningValue(tuning, 'beamHalfAngleMultiplier', 1, 0.1, 10),
      maxResults: 48,
    });
    for (const enemyId of targets) {
      const point = enemyPoint(battlefield, enemyId);
      const dx = point.x - event.origin.x; const dy = point.y - event.origin.y; const dz = point.z - event.origin.z;
      const distance = Math.hypot(dx, dy, dz);
      const targetBlocker = firstMapRayHit(event.origin, {x: dx, y: dy, z: dz}, distance,
        {mapDefinition, disabledCollisionIds});
      if (targetBlocker && targetBlocker.distance + 0.08 < distance) continue;
      hits.push(applyEnemyDamage(battlefield, enemyId, weaponId, 1, multiplier, tuning, mode));
    }
    for (const actorId of bossesInViewCone(bossEncounter, {origin: event.origin, direction: event.direction,
      range: maxDistance, halfAngle: Math.PI / 10 * tuningValue(tuning, 'beamHalfAngleMultiplier', 1, 0.1, 10)})) {
      const actor = bossEncounter.actors.find(item => item.id === actorId);
      const dx = actor.position.x - event.origin.x; const dy = actor.position.y - event.origin.y; const dz = actor.position.z - event.origin.z;
      const distance = Math.hypot(dx, dy, dz);
      const blocker = firstMapRayHit(event.origin, {x: dx, y: dy, z: dz}, distance, {mapDefinition, disabledCollisionIds});
      if (!blocker || blocker.distance + 0.08 >= distance) resolveBossHit({actorId, weaponId,
        damage: definition.damage * bossMultiplier * (mode.overheatWindow ? tuningValue(tuning, 'overheatDamageMultiplier', 1) : 1),
        armourMultiplier: 0.9, stagger: 6});
    }
    if (hits.length) impact = {kind: "enemy", enemyId: hits[0].enemyId, point: enemyPoint(battlefield, hits[0].enemyId)};
  } else {
    const hitPadding = weaponId === 'runebolt' ? 0.08 * tuningValue(tuning, 'runeboltHitPaddingMultiplier', 1, 0.1, 10) : 0.08;
    const resolution = resolveProjectileRayHit(battlefield.queryRayHits({
      origin: event.origin,
      direction: event.direction,
      maxDistance,
      maxResults: 8,
      padding: hitPadding,
    }), worldHit, {maxDistance, blockerPadding: hitPadding});
    const fixedBossHit = bossRayHit(bossEncounter, {origin: event.origin, direction: event.direction, maxDistance});
    const crowdDistance = resolution.kind === 'enemy' ? resolution.enemyHit.distance : Infinity;
    const worldDistance = worldHit?.distance ?? Infinity;
    const bossFirst = fixedBossHit && fixedBossHit.distance + hitPadding < Math.min(crowdDistance, worldDistance);
    if (bossFirst) {
      const directDamage = definition.damage * bossMultiplier * (weaponId === 'arbalest' && mode.ads
        ? tuningValue(tuning, 'adsDamageMultiplier', 1) : 1);
      resolveBossHit({actorId: fixedBossHit.actorId, weaponId, damage: directDamage,
        armourMultiplier: weaponId === 'arbalest' ? Math.max(0.72, tuningValue(tuning, 'minimumArmourMultiplier', 0))
          : tuningValue(tuning, 'armourCrackSeconds', 0) > 0 ? tuningValue(tuning, 'armourCrackDamageMultiplier', 1) : 1,
        stagger: weaponId === 'arbalest' ? 18 + tuningValue(tuning, 'directStaggerSeconds', 0) * 20
          : 30 + tuningValue(tuning, 'gravityPulseSeconds', 0) * 20});
      impact = {kind: 'boss', actorId: fixedBossHit.actorId, point: fixedBossHit.point};
      if (weaponId === 'runebolt') {
        const splashRadius = definition.radius * tuningValue(tuning, 'splashRadiusMultiplier', 1, 0.1, 10);
        const splashScale = RUNEBOLT_SPLASH_DAMAGE_MULTIPLIER * tuningValue(tuning, 'splashDamageMultiplier', 1);
        for (const enemyId of battlefield.queryHits({x: fixedBossHit.point.x, z: fixedBossHit.point.z,
          radius: splashRadius, maxResults: 96})) {
          hits.push(applyEnemyDamage(battlefield, enemyId, weaponId, splashScale, multiplier, tuning, mode));
        }
        for (const actorId of bossesInRadius(bossEncounter, {...fixedBossHit.point, radius: splashRadius})) {
          if (actorId !== fixedBossHit.actorId) resolveBossHit({actorId, weaponId,
            damage: definition.damage * splashScale * bossMultiplier,
            stagger: tuningValue(tuning, 'gravityPulseSeconds', 0) * 20, splash: true});
        }
        const crackSeconds = tuningValue(tuning, 'armourCrackSeconds', 0);
        const gravitySeconds = tuningValue(tuning, 'gravityPulseSeconds', 0);
        const clusterDelay = tuningValue(tuning, 'clusterSplitDelaySeconds', 0);
        if (crackSeconds > 0) effects.armourCracks.push({actorId: fixedBossHit.actorId, seconds: crackSeconds,
          damageMultiplier: tuningValue(tuning, 'armourCrackDamageMultiplier', 1)});
        if (gravitySeconds > 0) effects.gravityPulses.push({x: fixedBossHit.point.x, z: fixedBossHit.point.z,
          seconds: gravitySeconds, radius: tuningValue(tuning, 'gravityPulseRadius', 0)});
        if (clusterDelay > 0) effects.clusterImpacts.push({x: fixedBossHit.point.x, y: fixedBossHit.point.y,
          z: fixedBossHit.point.z, delaySeconds: clusterDelay,
          damageMultiplier: tuningValue(tuning, 'clusterSplitDamageMultiplier', 0),
          radius: tuningValue(tuning, 'clusterSplitRadius', 0), directTargetId: `boss:${fixedBossHit.actorId}`,
          directTargetArmourMultiplier: crackSeconds > 0 ? tuningValue(tuning, 'armourCrackDamageMultiplier', 1) : 1});
      }
    } else if (resolution.kind === "enemy") {
      const enemyId = resolution.enemyHit.id;
      const point = enemyPoint(battlefield, enemyId);
      if (weaponId === "runebolt") {
        for (const splashId of battlefield.queryHits({
          x: point.x,
          z: point.z,
          radius: definition.radius * tuningValue(tuning, 'splashRadiusMultiplier', 1, 0.1, 10),
          maxResults: 96,
        })) {
          hits.push(applyEnemyDamage(
            battlefield,
            splashId,
            weaponId,
            splashId === enemyId ? 1 : RUNEBOLT_SPLASH_DAMAGE_MULTIPLIER * tuningValue(tuning, 'splashDamageMultiplier', 1),
            multiplier,
            tuning,
            mode,
          ));
        }
        const crackSeconds = tuningValue(tuning, 'armourCrackSeconds', 0);
        if (crackSeconds > 0) effects.armourCracks.push({enemyId, seconds: crackSeconds,
          damageMultiplier: tuningValue(tuning, 'armourCrackDamageMultiplier', 1)});
        const gravitySeconds = tuningValue(tuning, 'gravityPulseSeconds', 0);
        if (gravitySeconds > 0) effects.gravityPulses.push({x: point.x, z: point.z, seconds: gravitySeconds,
          radius: tuningValue(tuning, 'gravityPulseRadius', 0)});
        const clusterDelay = tuningValue(tuning, 'clusterSplitDelaySeconds', 0);
        if (clusterDelay > 0) effects.clusterImpacts.push({x: point.x, y: point.y, z: point.z, delaySeconds: clusterDelay,
          damageMultiplier: tuningValue(tuning, 'clusterSplitDamageMultiplier', 0), radius: tuningValue(tuning, 'clusterSplitRadius', 0),
          directTargetId: `enemy:${enemyId}`,
          directTargetArmourMultiplier: crackSeconds > 0 ? tuningValue(tuning, 'armourCrackDamageMultiplier', 1) : 1});
      } else {
        hits.push(applyEnemyDamage(battlefield, enemyId, weaponId, 1, multiplier, tuning, mode));
        const seconds = tuningValue(tuning, 'directStaggerSeconds', 0);
        if (seconds > 0) effects.staggers.push({enemyId, seconds});
      }
      impact = {kind: "enemy", enemyId, point};
    } else if (resolution.kind === 'world' && weaponId === 'runebolt') {
      const ricochetMultiplier = tuningValue(tuning, 'terrainRicochetDamageMultiplier', 0);
      const radius = tuningValue(tuning, 'terrainRicochetRadius', 0);
      if (ricochetMultiplier > 0 && radius > 0) {
        const [enemyId] = battlefield.queryHits({x: resolution.worldHit.point.x, z: resolution.worldHit.point.z, radius, maxResults: 1});
        if (Number.isInteger(enemyId)) {
          hits.push(applyEnemyDamage(battlefield, enemyId, weaponId, ricochetMultiplier, multiplier, tuning, mode));
          effects.ricochets.push({enemyId, radius, damageMultiplier: ricochetMultiplier});
        } else {
          const [actorId] = bossesInRadius(bossEncounter, {...resolution.worldHit.point, radius});
          if (actorId) {
            resolveBossHit({actorId, weaponId, damage: definition.damage * ricochetMultiplier * bossMultiplier,
              stagger: tuningValue(tuning, 'gravityPulseSeconds', 0) * 20, ricochet: true});
            effects.ricochets.push({actorId, radius, damageMultiplier: ricochetMultiplier});
          }
        }
      }
      const clusterDelay = tuningValue(tuning, 'clusterSplitDelaySeconds', 0);
      if (clusterDelay > 0) effects.clusterImpacts.push({x: resolution.worldHit.point.x,
        y: resolution.worldHit.point.y, z: resolution.worldHit.point.z, delaySeconds: clusterDelay,
        damageMultiplier: tuningValue(tuning, 'clusterSplitDamageMultiplier', 0),
        radius: tuningValue(tuning, 'clusterSplitRadius', 0), directTargetId: null,
        directTargetArmourMultiplier: 1});
    }
  }

  return Object.freeze({
    actorId: event.actorId,
    weaponId,
    hits: Object.freeze(hits),
    bossHits: Object.freeze(bossHits),
    effects: Object.freeze(Object.fromEntries(Object.entries(effects).map(([key, value]) => [key, Object.freeze(value)]))),
    impact: Object.freeze(impact),
  });
}

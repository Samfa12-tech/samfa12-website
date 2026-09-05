import {WEAPON_IDS} from "./progression.js";
import {applyCampaignBossWeaponKillEffects, applyCampaignWeaponKillEffects} from "./runtime-progression.js";
import {applySessionWeaponHeatRefund} from "./multiplayer-session-core.js";
import {WEAPON_HEAT_SCALE} from "./multiplayer-contracts.js";

export const AUTHORITATIVE_DELAYED_EFFECT_VERSION = 3;
const MAX_PENDING = 128;
const MAX_STREAMS = 16;
const EFFECT_KEYS = new Set([
  "id", "sourceEventId", "streamId", "sequence", "actorId", "weaponId", "weaponSlot", "dueAt", "point",
  "damage", "radius", "armourMultiplier", "stagger", "killHeatRefund",
  "directTargetId", "directTargetArmourMultiplier",
]);

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function stableId(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:+-]{0,127}$/u.test(value)) {
    throw new TypeError(`${label} must be a stable identifier`);
  }
  return value;
}

function finite(value, label, minimum = 0, maximum = 1_000_000) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new RangeError(`${label} must be finite and bounded`);
  return value;
}

function positiveSequence(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${label} must be a positive safe integer`);
  return value;
}

function normalizeEffect(value) {
  const input = record(value, "authoritative delayed effect");
  for (const key of Object.keys(input)) if (!EFFECT_KEYS.has(key)) throw new TypeError(`delayed effect.${key} is unsupported`);
  const weaponId = stableId(input.weaponId, "delayed effect weaponId");
  if (!WEAPON_IDS.includes(weaponId)) throw new RangeError("delayed effect weaponId is unsupported");
  const weaponSlot = input.weaponSlot;
  if (!Number.isInteger(weaponSlot) || WEAPON_IDS[weaponSlot] !== weaponId) throw new RangeError("delayed effect weaponSlot contradicts weaponId");
  const point = record(input.point, "delayed effect point");
  for (const key of Object.keys(point)) if (!["x", "y", "z"].includes(key)) throw new TypeError(`delayed effect point.${key} is unsupported`);
  return Object.freeze({
    id: stableId(input.id, "delayed effect id"),
    sourceEventId: stableId(input.sourceEventId, "delayed effect sourceEventId"),
    streamId: stableId(input.streamId, "delayed effect streamId"),
    sequence: positiveSequence(input.sequence, "delayed effect sequence"),
    actorId: stableId(input.actorId, "delayed effect actorId"),
    weaponId,
    weaponSlot,
    dueAt: finite(input.dueAt, "delayed effect dueAt", 0, Number.MAX_SAFE_INTEGER),
    point: Object.freeze({x: finite(point.x, "delayed effect point.x", -1_000_000),
      y: finite(point.y, "delayed effect point.y", -1_000_000), z: finite(point.z, "delayed effect point.z", -1_000_000)}),
    damage: finite(input.damage, "delayed effect damage"),
    radius: finite(input.radius, "delayed effect radius", 0.001, 100),
    armourMultiplier: finite(input.armourMultiplier, "delayed effect armourMultiplier", 0, 100),
    stagger: finite(input.stagger, "delayed effect stagger", 0, 10_000),
    killHeatRefund: finite(input.killHeatRefund, "delayed effect killHeatRefund", 0, 1.2),
    directTargetId: input.directTargetId === null ? null : stableId(input.directTargetId, "delayed effect directTargetId"),
    directTargetArmourMultiplier: finite(input.directTargetArmourMultiplier,
      "delayed effect directTargetArmourMultiplier", 0, 100),
  });
}

export function createAuthoritativeDelayedEffectQueue() {
  return {version: AUTHORITATIVE_DELAYED_EFFECT_VERSION, pending: new Map(), highWater: new Map()};
}

export function scheduleAuthoritativeDelayedEffect(queue, value) {
  if (queue?.version !== AUTHORITATIVE_DELAYED_EFFECT_VERSION || !(queue.pending instanceof Map) || !(queue.highWater instanceof Map)) {
    throw new TypeError("authoritative delayed effect queue is invalid");
  }
  const effect = normalizeEffect(value);
  const issuedHighWater = Math.max(queue.highWater.get(effect.streamId) ?? 0,
    ...[...queue.pending.values()].filter(item => item.streamId === effect.streamId).map(item => item.sequence));
  if (effect.sequence <= issuedHighWater) return false;
  if (queue.pending.has(effect.id)) return false;
  if ([...queue.pending.values()].some(item => item.streamId === effect.streamId && item.sequence === effect.sequence)) return false;
  const knownStreams = new Set([...queue.highWater.keys(), ...[...queue.pending.values()].map(item => item.streamId)]);
  if (!knownStreams.has(effect.streamId) && knownStreams.size >= MAX_STREAMS) {
    throw new RangeError("authoritative delayed effect stream capacity is full");
  }
  if (queue.pending.size >= MAX_PENDING) throw new RangeError("authoritative delayed effect queue is full");
  queue.pending.set(effect.id, effect);
  return true;
}

export function resolveDueAuthoritativeDelayedEffects(queue, now, resolver) {
  if (typeof resolver !== "function") throw new TypeError("delayed effect resolver is required");
  const dueAt = finite(now, "delayed effect authority time", 0, Number.MAX_SAFE_INTEGER);
  const resolved = [];
  const ordered = [...queue.pending.values()].sort((left, right) => left.streamId.localeCompare(right.streamId, "en-US")
    || left.sequence - right.sequence || left.id.localeCompare(right.id, "en-US"));
  const blockedStreams = new Set();
  for (const effect of ordered) {
    if (blockedStreams.has(effect.streamId)) continue;
    if (effect.sequence <= (queue.highWater.get(effect.streamId) ?? 0)) {
      throw new RangeError("authoritative delayed effect sequence is at or below stream high-water");
    }
    if (effect.dueAt > dueAt + 1e-9 || resolver(effect) !== true) {
      blockedStreams.add(effect.streamId);
      continue;
    }
    queue.pending.delete(effect.id);
    queue.highWater.set(effect.streamId, effect.sequence);
    resolved.push(effect);
  }
  return Object.freeze(resolved);
}

export function delayedArmourMultiplierForTarget(effect, targetId) {
  if (!effect || typeof effect !== "object") throw new TypeError("delayed effect is required");
  if (typeof targetId !== "string") throw new TypeError("delayed targetId must be a string");
  return effect.directTargetId === targetId
    ? finite(effect.directTargetArmourMultiplier, "delayed effect directTargetArmourMultiplier", 0, 100)
    : 1;
}

export function snapshotAuthoritativeDelayedEffects(queue) {
  if (queue?.version !== AUTHORITATIVE_DELAYED_EFFECT_VERSION || !(queue.pending instanceof Map) || !(queue.highWater instanceof Map)) {
    throw new TypeError("authoritative delayed effect queue is invalid");
  }
  return Object.freeze({version: AUTHORITATIVE_DELAYED_EFFECT_VERSION,
    pending: Object.freeze([...queue.pending.values()].sort((left, right) => left.streamId.localeCompare(right.streamId, "en-US")
      || left.sequence - right.sequence)),
    highWater: Object.freeze([...queue.highWater].sort(([left], [right]) => left.localeCompare(right, "en-US"))
      .map(([streamId, sequence]) => Object.freeze({streamId, sequence})))});
}

export function restoreAuthoritativeDelayedEffects(snapshot = {version: AUTHORITATIVE_DELAYED_EFFECT_VERSION, pending: [], highWater: []}) {
  const input = record(snapshot, "authoritative delayed effect snapshot");
  for (const key of Object.keys(input)) if (!["version", "pending", "highWater"].includes(key)) throw new TypeError(`delayed effect snapshot.${key} is unsupported`);
  if (input.version !== AUTHORITATIVE_DELAYED_EFFECT_VERSION || !Array.isArray(input.pending)
    || input.pending.length > MAX_PENDING || !Array.isArray(input.highWater) || input.highWater.length > MAX_STREAMS) {
    throw new RangeError("authoritative delayed effect snapshot is invalid");
  }
  const queue = createAuthoritativeDelayedEffectQueue();
  for (const value of input.highWater) {
    const item = record(value, "delayed effect high-water");
    for (const key of Object.keys(item)) if (!["streamId", "sequence"].includes(key)) throw new TypeError(`delayed effect high-water.${key} is unsupported`);
    if (!Object.hasOwn(item, "streamId") || !Object.hasOwn(item, "sequence")) throw new TypeError("delayed effect high-water is incomplete");
    const streamId = stableId(item.streamId, "delayed effect high-water streamId");
    const sequence = positiveSequence(item.sequence, "delayed effect high-water sequence");
    if (queue.highWater.has(streamId)) throw new RangeError("delayed effect high-water stream is duplicated");
    queue.highWater.set(streamId, sequence);
  }
  const pendingSequences = new Set();
  for (const value of input.pending) {
    const effect = normalizeEffect(value);
    const sequenceKey = `${effect.streamId}\u0000${effect.sequence}`;
    if (queue.pending.has(effect.id) || pendingSequences.has(sequenceKey)) throw new RangeError("delayed effect snapshot identity is duplicated");
    if (effect.sequence <= (queue.highWater.get(effect.streamId) ?? 0)) {
      throw new RangeError("delayed effect pending sequence is at or below stream high-water");
    }
    queue.pending.set(effect.id, effect);
    pendingSequences.add(sequenceKey);
  }
  return queue;
}

export function applyAuthoritativeDelayedKillProgression({profile, run, roster, session, effect, hits = []} = {}) {
  const authoritativeEffect = normalizeEffect({...effect,
    dueAt: effect?.dueAt ?? 0, point: effect?.point ?? {x: 0, y: 0, z: 0},
    damage: effect?.damage ?? 0, radius: effect?.radius ?? 1,
    armourMultiplier: effect?.armourMultiplier ?? 1, stagger: effect?.stagger ?? 0});
  let nextProfile = profile;
  let nextRun = run;
  let refundedKills = 0;
  for (const hit of hits) {
    if (!hit?.killed) continue;
    const weaponState = session?.weaponStates?.get(authoritativeEffect.actorId);
    const heat = (weaponState?.heatByWeapon?.[authoritativeEffect.weaponSlot] ?? 0) / WEAPON_HEAT_SCALE;
    const progression = applyCampaignWeaponKillEffects(nextProfile, nextRun, roster, hit.enemyId,
      authoritativeEffect.weaponId, {killed: true, heat, killHeatRefund: authoritativeEffect.killHeatRefund});
    nextProfile = progression.profile;
    nextRun = progression.run;
    if (progression.refunded && applySessionWeaponHeatRefund(session, authoritativeEffect.actorId,
      authoritativeEffect.weaponSlot, authoritativeEffect.killHeatRefund)) refundedKills += 1;
  }
  return {profile: nextProfile, run: nextRun, refundedKills};
}

export function applyAuthoritativeDelayedBossKillProgression({profile, run, session, effect, actorId, killed,
  directorDefeatCounted} = {}) {
  if (directorDefeatCounted !== true) {
    throw new TypeError("the boss director must own authoritative defeat counting");
  }
  const authoritativeEffect = normalizeEffect({...effect,
    dueAt: effect?.dueAt ?? 0, point: effect?.point ?? {x: 0, y: 0, z: 0},
    damage: effect?.damage ?? 0, radius: effect?.radius ?? 1,
    armourMultiplier: effect?.armourMultiplier ?? 1, stagger: effect?.stagger ?? 0});
  const stableActorId = stableId(actorId, "delayed boss actorId");
  const weaponState = session?.weaponStates?.get(authoritativeEffect.actorId);
  const heat = (weaponState?.heatByWeapon?.[authoritativeEffect.weaponSlot] ?? 0) / WEAPON_HEAT_SCALE;
  const progression = applyCampaignBossWeaponKillEffects(profile, run, stableActorId,
    authoritativeEffect.weaponId, {killed: killed === true, heat,
      killHeatRefund: authoritativeEffect.killHeatRefund});
  let refunded = false;
  if (progression.refunded) {
    refunded = applySessionWeaponHeatRefund(session, authoritativeEffect.actorId,
      authoritativeEffect.weaponSlot, authoritativeEffect.killHeatRefund);
  }
  return {profile: progression.profile, run: progression.run, heat: progression.heat,
    granted: progression.granted, refunded, killCountDelta: 0};
}

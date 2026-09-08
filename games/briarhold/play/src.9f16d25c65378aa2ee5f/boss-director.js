export const BOSS_DIRECTOR_VERSION = 1;

const FIXED_STEP_MS = 50;
const MAX_ACTORS = 2;
const MAX_ZONES = 8;
const MAX_HIT_VOLUMES = 16;
const MAX_EVENTS = 256;
const MAX_COMMAND_IDS = 512;
const MAX_CHECKPOINT_CHARS = 262144;
const MAX_WORLD_COORDINATE = 512;
const MAX_VELOCITY = 64;
// Keep resolved one-hit values finite and bounded after authored multipliers.
const MAX_COMBAT_SCALAR = 2_000_000;
const MAX_DIRECTOR_TIME_MS = 86_400_000;
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,255}$/u;
const DIRECTOR_KEYS = new Set(["version", "encounterId", "label", "mode", "status", "timeMs", "accumulatorMs",
  "rngState", "eventSequence", "actors", "zones", "hitVolumes", "authoredAreaZones", "disabledSocketIds",
  "processedCommandIds", "events", "boons", "options"]);
const ACTOR_KEYS = new Set(["id", "title", "position", "previousPosition", "velocity", "heading", "radius", "maxHp",
  "hp", "stagger", "phase", "state", "cooldownRemainingMs", "telegraphUntilMs", "vulnerableUntilMs",
  "regenerationInterruptedUntilMs", "hitUntilMs", "defeatedAtMs", "presentationUntilMs", "wardPulseReadyAtMs",
  "livingMossguards", "target", "rngState", "eventSequence", "hitVolumes", "animationState", "defeated"]);
const VECTOR_KEYS = new Set(["x", "y", "z"]);
const OPTIONS_KEYS = new Set(["hpMultiplier", "occupiedSocketIds", "occupiedSockets", "objectiveLaneId", "objectiveLanePosition"]);
const SOCKET_KEYS = new Set(["id", "x", "z"]);
const VOLUME_KEYS = new Set(["kind", "visible", "active", "damaging"]);
const EVENT_KEYS = new Set(["sequence", "tick", "timeMs", "type"]);
const EVENT_SHAPES = Object.freeze({
  boss_intro: [new Set(["commandId", "encounterId"]), new Set()],
  attack_telegraph: [new Set(["actorId", "attack", "resolvesAtMs"]), new Set(["targetId", "commandId"])],
  boss_stagger: [new Set(["actorId", "commandId"]), new Set(["socketId"])],
  shield_feed_broken: [new Set(["actorId", "commandId", "targetId", "livingMossguards"]), new Set()],
  objective_interaction: [new Set(["actorId", "commandId", "targetId"]), new Set()],
  gate_interaction: [new Set(["actorId", "commandId", "targetId"]), new Set()],
  hit_ignored: [new Set(["actorId", "commandId", "reason"]), new Set()],
  hit_blocked: [new Set(["actorId", "commandId", "reason"]), new Set()],
  boss_hit: [new Set(["actorId", "commandId", "damage", "stagger", "weaponId"]), new Set()],
  socket_disabled: [new Set(["actorId", "socketId"]), new Set()],
  attack_resolve: [new Set(["actorId", "attack"]), new Set(["targetId", "zoneId", "lanePressure"])],
  ward_reveal: [new Set(["actorId", "untilMs"]), new Set()],
  boss_phase: [new Set(["actorId", "phase"]), new Set(["state"])],
  objective_damage: [new Set(["actorId", "targetId", "amount"]), new Set()],
  lane_pressure: [new Set(["actorId", "targetId", "amount"]), new Set()],
  gate_damage: [new Set(["actorId", "targetId", "amount"]), new Set()],
  dragon_breath: [new Set(["actorId", "zoneId"]), new Set()],
  boss_defeat: [new Set(["actorId", "commandId", "weaponId"]), new Set()],
  encounter_defeat: [new Set(["encounterId"]), new Set()],
});
const ACTOR_STATE_IDS = Object.freeze({
  "moss-crowned-matron": new Set(["waiting", "active", "defeated"]),
  "root-sapper-prime": new Set(["waiting", "active", "plant_telegraph", "staggered", "defeated"]),
  "ashwing-matriarch": new Set(["waiting", "active", "dive_telegraph", "grounded", "defeated"]),
  "moonless-herald": new Set(["phased", "ward_telegraph", "exposed", "defeated"]),
  "caravan-eater": new Set(["waiting", "active", "objective_telegraph", "staggered", "defeated"]),
  "hollow-hart": new Set(["waiting", "active", "root_telegraph", "defeated"]),
  cinderwing: new Set(["waiting", "airborne", "breath_telegraph", "defeated"]),
});
const ACTOR_ANIMATION_IDS = Object.freeze({
  "moss-crowned-matron": new Set(["idle", "shield_rotate", "hit", "collapse"]),
  "root-sapper-prime": new Set(["idle", "attack", "hit", "collapse"]),
  "ashwing-matriarch": new Set(["idle", "dive_windup", "grounded", "airborne", "hit", "collapse"]),
  "moonless-herald": new Set(["idle", "attack", "hit", "collapse"]),
  "caravan-eater": new Set(["idle", "attack", "hit", "collapse"]),
  "hollow-hart": new Set(["idle", "attack", "hit", "collapse"]),
  cinderwing: new Set(["flap", "glide", "breath", "hit", "fall"]),
});
const ATTACK_IDS = new Set(["ward_reveal", "socket_plant", "dive_lane", "lantern_burst", "objective_charge",
  "root_lane", "lane_strafe"]);
const WEAPON_IDS = new Set(["arbalest", "sunfire", "runebolt", "unknown"]);
const HIT_VOLUME_ACTORS = Object.freeze({
  socket_plant_telegraph: "root-sapper-prime",
  dive_lane: "ashwing-matriarch",
  ward_reveal: "moonless-herald",
  heart_lantern: "moonless-herald",
  lantern_burst: "moonless-herald",
  objective_lane: "caravan-eater",
  root_lane: "hollow-hart",
  fire_breath: "cinderwing",
});
const ZONE_ACTORS = Object.freeze({ash: "ashwing-matriarch", fire_breath: "cinderwing"});
const ACTOR_ATTACKS = Object.freeze({
  "root-sapper-prime": "socket_plant",
  "ashwing-matriarch": "dive_lane",
  "moonless-herald": null,
  "caravan-eater": "objective_charge",
  "hollow-hart": "root_lane",
  cinderwing: "lane_strafe",
});

const rawDefinitions = {
  "moss-crowned-matron": {
    title: "Moss-Crowned Matron",
    fixedActor: true,
    mechanics: {shieldArcDegrees: 80, shieldRotationMs: 1300, mossguardFeeds: 3, regenerationPerSecond: 8, runeboltDamageMultiplier: 1.25, runeboltStaggerMultiplier: 1.5, regenerationInterruptMs: 4000},
    actors: [{id: "moss-crowned-matron", maxHp: 1200, phaseThresholds: [0.7, 0.45], position: {x: -18, y: 0, z: 78}, radius: 3.4}],
  },
  "root-sapper-prime": {
    title: "Root-Sapper Prime",
    fixedActor: true,
    mechanics: {plantCooldownMs: 2500, plantTelegraphMs: 1000, interruptStagger: 80, socketDamage: "disabled_for_wave"},
    actors: [{id: "root-sapper-prime", maxHp: 1400, phaseThresholds: [0.66, 0.33], position: {x: 18, y: 0, z: 82}, radius: 3}],
  },
  "ashwing-matriarch": {
    title: "Ashwing Matriarch",
    fixedActor: true,
    mechanics: {diveCooldownMs: 2200, diveTelegraphMs: 800, ashTelegraphMs: 800, ashActiveMs: 4000, ashRadius: 4.5, maxAshZones: 3},
    actors: [{id: "ashwing-matriarch", maxHp: 1300, phaseThresholds: [0.67, 0.34], position: {x: -8, y: 8, z: 86}, radius: 3.2}],
  },
  "moonless-herald": {
    title: "Moonless Herald",
    fixedActor: true,
    mechanics: {wardExposureMs: 3000, attackCooldownMs: 2000, attackTelegraphMs: 900, attackRadius: 4},
    // The western overlook is the no-build Ward-light fallback. This position
    // is inside the 24 m semantic pulse range with a clear authored-map ray;
    // Ward Lanterns remain an optional safer reveal source.
    actors: [{id: "moonless-herald", maxHp: 1100, phaseThresholds: [0.7, 0.35], position: {x: -8, y: 1, z: 40}, radius: 2.5}],
  },
  "caravan-eater": {
    title: "Caravan Eater",
    fixedActor: true,
    mechanics: {objectiveCooldownMs: 2200, objectiveTelegraphMs: 1000, objectiveDamage: 12, objectiveAttackRange: 6, staggerCancel: 100},
    actors: [{id: "caravan-eater", maxHp: 1500, phaseThresholds: [0.67, 0.34], position: {x: 22, y: 0, z: 84}, radius: 3.6}],
  },
  "hollow-hart+cinderwing": {
    title: "Hollow Hart and Cinderwing",
    fixedActor: true,
    mechanics: {rootCooldownMs: 3000, rootTelegraphMs: 1000, breathCooldownMs: 3000, breathTelegraphMs: 1000, breathActiveMs: 1800, maxBreathZones: 1},
    actors: [
      {id: "hollow-hart", maxHp: 1800, phaseThresholds: [0.7, 0.4], position: {x: -14, y: 0, z: 94}, radius: 4},
      {id: "cinderwing", maxHp: 1600, phaseThresholds: [0.68, 0.36], position: {x: 14, y: 14, z: 96}, radius: 4.5},
    ],
  },
};

export const BOSS_ENCOUNTER_DEFINITIONS = deepFreeze(rawDefinitions);

export function createBossDirector({
  encounterId,
  seed,
  hpMultiplier = 1,
  occupiedSocketIds = [],
  occupiedSockets = [],
  objectiveLaneId = "evacuation-lane",
  objectiveLanePosition = {x: -16, z: 20},
  boons = [],
} = {}) {
  const definition = BOSS_ENCOUNTER_DEFINITIONS[encounterId];
  if (!definition) throw new RangeError(`unknown boss director encounter: ${encounterId}`);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError("boss director seed must be a uint32");
  if (!Number.isFinite(hpMultiplier) || hpMultiplier <= 0 || hpMultiplier > 4) throw new RangeError("boss HP multiplier must be between zero and four");
  const sockets = [...new Set(occupiedSocketIds.filter(isNonEmptyString))].sort().slice(0, 32);
  const socketPositions = new Map((Array.isArray(occupiedSockets) ? occupiedSockets : [])
    .filter(socket => sockets.includes(socket?.id) && Number.isFinite(socket?.x) && Number.isFinite(socket?.z))
    .slice(0, 32)
    .map(socket => [socket.id, {x: socket.x, z: socket.z}]));
  const lanePosition = Number.isFinite(objectiveLanePosition?.x) && Number.isFinite(objectiveLanePosition?.z)
    ? {x: objectiveLanePosition.x, z: objectiveLanePosition.z}
    : {x: -16, z: 20};
  const actors = definition.actors.map(actorDefinition => {
    const maxHp = Math.round(actorDefinition.maxHp * hpMultiplier);
    const target = actorDefinition.id === "root-sapper-prime"
      ? {kind: "fortification_socket", id: sockets[0] ?? null, ...(socketPositions.get(sockets[0]) ?? {})}
      : actorDefinition.id === "caravan-eater"
        ? {kind: "objective_lane", id: isNonEmptyString(objectiveLaneId) ? objectiveLaneId : "evacuation-lane", ...lanePosition}
        : actorDefinition.id === "cinderwing"
          ? {kind: "anchor", id: "hollow-hart"}
        : {kind: "warden", id: "warden:host"};
    return {
      id: actorDefinition.id,
      title: titleForActor(actorDefinition.id),
      position: clone(actorDefinition.position),
      previousPosition: clone(actorDefinition.position),
      velocity: {x: 0, y: 0, z: 0},
      heading: 0,
      radius: actorDefinition.radius,
      maxHp,
      hp: maxHp,
      stagger: 0,
      phase: 1,
      state: actorDefinition.id === "moonless-herald" ? "phased" : "waiting",
      cooldownRemainingMs: initialCooldown(encounterId, actorDefinition.id),
      telegraphUntilMs: 0,
      vulnerableUntilMs: 0,
      regenerationInterruptedUntilMs: 0,
      hitUntilMs: 0,
      defeatedAtMs: 0,
      presentationUntilMs: 0,
      wardPulseReadyAtMs: 0,
      livingMossguards: actorDefinition.id === "moss-crowned-matron" ? definition.mechanics.mossguardFeeds : 0,
      target,
      rngState: mixSeed(seed, actorDefinition.id),
      eventSequence: 0,
      hitVolumes: [{kind: "body", radius: actorDefinition.radius, visible: actorDefinition.id !== "moonless-herald", active: actorDefinition.id !== "moonless-herald", damaging: false}],
      animationState: actorDefinition.id === "cinderwing" ? "flap" : "idle",
      defeated: false,
    };
  });
  return {
    version: BOSS_DIRECTOR_VERSION,
    encounterId,
    label: definition.title,
    mode: "authored-director",
    status: "waiting",
    timeMs: 0,
    accumulatorMs: 0,
    rngState: seed >>> 0,
    eventSequence: 0,
    actors,
    zones: [],
    hitVolumes: [],
    authoredAreaZones: [],
    disabledSocketIds: [],
    processedCommandIds: [],
    events: [],
    boons: [...new Set(boons.filter(isNonEmptyString))].sort(),
    options: {
      hpMultiplier,
      occupiedSocketIds: sockets,
      occupiedSockets: [...socketPositions].map(([id, position]) => ({id, ...position})),
      objectiveLaneId: isNonEmptyString(objectiveLaneId) ? objectiveLaneId : "evacuation-lane",
      objectiveLanePosition: lanePosition,
    },
  };
}

export function stepBossDirector(input, {elapsedMs = 0, commands = []} = {}) {
  validateDirector(input, {requireHash: false});
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || !Number.isInteger(elapsedMs)) throw new RangeError("boss director elapsedMs must be a non-negative integer");
  if (!Array.isArray(commands) || commands.length > 128) throw new RangeError("boss director commands must be a bounded array");
  const state = clone(input);
  delete state.hash;
  const ordered = [...commands].sort((left, right) => {
    const orderDelta = (Number(left?.order) || 0) - (Number(right?.order) || 0);
    return orderDelta || String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
  });
  for (const command of ordered) processCommand(state, command);
  state.accumulatorMs += elapsedMs;
  while (state.accumulatorMs >= FIXED_STEP_MS) {
    state.accumulatorMs -= FIXED_STEP_MS;
    state.timeMs += FIXED_STEP_MS;
    fixedStep(state);
  }
  return state;
}

export function serialiseBossDirector(input) {
  validateDirector(input, {requireHash: false});
  const checkpoint = clone(input);
  delete checkpoint.hash;
  checkpoint.hash = hashBossDirector(checkpoint);
  return checkpoint;
}

export function restoreBossDirector(checkpoint) {
  validateDirector(checkpoint, {requireHash: true});
  const expected = hashBossDirector(checkpoint);
  if (checkpoint.hash !== expected) throw new Error("boss director checkpoint hash mismatch");
  const restored = clone(checkpoint);
  delete restored.hash;
  return restored;
}

export function hashBossDirector(input) {
  const value = clone(input);
  delete value.hash;
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function normaliseBossDirector(input) {
  if (input === null || input === undefined) return null;
  return restoreBossDirector(serialiseBossDirector(input));
}

function processCommand(state, command) {
  if (!command || typeof command !== "object" || !isNonEmptyString(command.id) || !isNonEmptyString(command.type)) {
    throw new TypeError("boss director command requires stable id and type");
  }
  if (state.processedCommandIds.includes(command.id)) return;
  if (state.processedCommandIds.length >= MAX_COMMAND_IDS) return;
  state.processedCommandIds.push(command.id);
  if (command.type === "encounter_release") {
    if (state.status !== "waiting") return;
    state.status = "active";
    for (const actor of state.actors) {
      actor.state = actor.id === "moonless-herald" ? "phased" : actor.id === "cinderwing" ? "airborne" : "active";
      actor.animationState = actor.id === "cinderwing" ? "flap" : "idle";
    }
    emit(state, "boss_intro", {commandId: command.id, encounterId: state.encounterId});
    return;
  }
  const actor = state.actors.find(item => item.id === command.actorId);
  if (command.type === "ward_light") {
    if (!actor || actor.id !== "moonless-herald" || actor.defeated || actor.state !== "phased" || state.timeMs < actor.wardPulseReadyAtMs) return;
    const source = command.source;
    const direction = command.direction;
    if (!Number.isFinite(source?.x) || !Number.isFinite(source?.z) || !Number.isFinite(direction?.x) || !Number.isFinite(direction?.z)) return;
    const toActor = {x: actor.position.x - source.x, z: actor.position.z - source.z};
    const distance = Math.hypot(toActor.x, toActor.z);
    const directionLength = Math.hypot(direction.x, direction.z);
    const dot = distance > 0 && directionLength > 0
      ? (toActor.x * direction.x + toActor.z * direction.z) / (distance * directionLength)
      : -1;
    if (distance > 24 || dot < Math.cos(Math.PI / 4)) return;
    actor.state = "ward_telegraph";
    actor.animationState = "attack";
    actor.telegraphUntilMs = state.timeMs + 500;
    actor.wardPulseReadyAtMs = state.timeMs + 1500;
    replaceActorVolume(state, actor, {kind: "ward_reveal", x: actor.position.x, z: actor.position.z, radius: 3, visible: true, active: false, damaging: false, untilMs: actor.telegraphUntilMs});
    emit(state, "attack_telegraph", {actorId: actor.id, commandId: command.id, attack: "ward_reveal", resolvesAtMs: actor.telegraphUntilMs});
    return;
  }
  if (command.type === "fortification_interrupt") {
    if (!actor || actor.defeated || actor.state !== "plant_telegraph") return;
    const stagger = finiteNonNegative(command.stagger, "boss interrupt stagger");
    actor.stagger += stagger;
    if (actor.stagger >= BOSS_ENCOUNTER_DEFINITIONS[state.encounterId].mechanics.interruptStagger) {
      actor.state = "staggered";
      actor.telegraphUntilMs = 0;
      actor.cooldownRemainingMs = 3000;
      removeActorVolumes(state, actor.id);
      emit(state, "boss_stagger", {actorId: actor.id, commandId: command.id, socketId: command.socketId ?? actor.target.id});
    }
    return;
  }
  if (command.type === "objective_interaction"
    && actor?.id === "moss-crowned-matron"
    && String(command.targetId ?? "").startsWith("mossguard-feed:")
    && actor.livingMossguards > 0) {
    actor.livingMossguards -= 1;
    emit(state, "shield_feed_broken", {
      actorId: actor.id,
      commandId: command.id,
      targetId: command.targetId,
      livingMossguards: actor.livingMossguards,
    });
    return;
  }
  if (command.type === "objective_interaction" || command.type === "gate_interaction") {
    emit(state, command.type, {actorId: actor?.id ?? null, commandId: command.id, targetId: command.targetId ?? null});
    return;
  }
  if (command.type !== "warden_hit") throw new RangeError(`unknown boss director command type: ${command.type}`);
  if (!actor || actor.defeated || state.status !== "active") return;
  applyHit(state, actor, command);
}

function applyHit(state, actor, command) {
  const baseDamage = finiteNonNegative(command.damage, "boss hit damage");
  const baseStagger = finiteNonNegative(command.stagger, "boss hit stagger");
  const armourMultiplier = command.armourMultiplier === undefined ? 1 : finiteNonNegative(command.armourMultiplier, "boss armour multiplier");
  const staggerMultiplier = command.staggerMultiplier === undefined ? 1 : finiteNonNegative(command.staggerMultiplier, "boss stagger multiplier");
  if (actor.id === "moonless-herald" && (actor.state === "phased" || state.timeMs >= actor.vulnerableUntilMs)) {
    emit(state, "hit_ignored", {actorId: actor.id, commandId: command.id, reason: "phased"});
    return;
  }
  if (actor.id === "cinderwing" && actor.state === "breath_telegraph") {
    emit(state, "hit_ignored", {actorId: actor.id, commandId: command.id, reason: "flight_guard"});
    return;
  }
  if (actor.id === "moss-crowned-matron"
    && withinShieldArc(actor, command.heading, BOSS_ENCOUNTER_DEFINITIONS[state.encounterId].mechanics.shieldArcDegrees)) {
    emit(state, "hit_blocked", {actorId: actor.id, commandId: command.id, reason: "rotating_shield_arc"});
    return;
  }
  const isMatronRunebolt = actor.id === "moss-crowned-matron" && command.weaponId === "runebolt";
  const damage = baseDamage * armourMultiplier * (isMatronRunebolt ? 1.25 : 1);
  const boonStaggerMultiplier = state.boons.includes("hunters-patience") ? 1.25 : 1;
  const stagger = baseStagger * staggerMultiplier * boonStaggerMultiplier * (isMatronRunebolt ? 1.5 : 1);
  actor.hp = Math.max(0, actor.hp - damage);
  actor.stagger += stagger;
  if (isMatronRunebolt) actor.regenerationInterruptedUntilMs = state.timeMs + 4000;
  if (actor.id === "caravan-eater" && actor.state !== "staggered" && actor.stagger >= 100) {
    const awayX = actor.position.x - (Number.isFinite(actor.target.x) ? actor.target.x : actor.position.x);
    const awayZ = actor.position.z - (Number.isFinite(actor.target.z) ? actor.target.z : actor.position.z - 1);
    const awayLength = Math.hypot(awayX, awayZ) || 1;
    actor.velocity.x = awayX / awayLength * 7;
    actor.velocity.z = awayZ / awayLength * 7;
    actor.state = "staggered";
    actor.telegraphUntilMs = 0;
    actor.cooldownRemainingMs = 1000;
    removeActorVolumes(state, actor.id);
    emit(state, "boss_stagger", {actorId: actor.id, commandId: command.id});
  }
  emit(state, "boss_hit", {actorId: actor.id, commandId: command.id, damage, stagger, weaponId: command.weaponId ?? "unknown"});
  actor.hitUntilMs = state.timeMs + 500;
  actor.animationState = "hit";
  updatePhases(state, actor);
  if (actor.hp <= 0) defeatActor(state, actor, command.id, command.weaponId ?? "unknown");
}

function fixedStep(state) {
  state.rngState = xorshift(state.rngState);
  for (const actor of state.actors) {
    actor.previousPosition = clone(actor.position);
    actor.rngState = xorshift(actor.rngState);
    if (actor.defeated || state.status !== "active") continue;
    actor.cooldownRemainingMs = Math.max(0, actor.cooldownRemainingMs - FIXED_STEP_MS);
    if (actor.id === "moss-crowned-matron") updateMatron(state, actor);
    else if (actor.id === "root-sapper-prime") updateSapper(state, actor);
    else if (actor.id === "ashwing-matriarch") updateAshwing(state, actor);
    else if (actor.id === "moonless-herald") updateHerald(state, actor);
    else if (actor.id === "caravan-eater") updateCaravan(state, actor);
    else if (actor.id === "hollow-hart") updateHart(state, actor);
    else if (actor.id === "cinderwing") updateCinderwing(state, actor);
    if (!actor.defeated && state.timeMs < actor.hitUntilMs) actor.animationState = "hit";
  }
  state.hitVolumes = state.hitVolumes.filter(volume => !volume.untilMs || state.timeMs < volume.untilMs);
  // Lantern burst temporarily replaces the Herald's published weak-point
  // volume. Once the damaging burst expires, publish the still-live heart
  // lantern again for the remainder of the existing vulnerability window.
  // This restores presentation/aim authority without extending that window
  // or shortening the burst's damage lifetime.
  for (const actor of state.actors) {
    if (actor.id !== "moonless-herald" || actor.state !== "exposed") continue;
    if (state.hitVolumes.some(volume => volume.actorId === actor.id)) continue;
    replaceActorVolume(state, actor, {
      kind: "heart_lantern", radius: 1.1, visible: true, active: true,
      damaging: false, untilMs: actor.vulnerableUntilMs,
    }, state.eventSequence);
  }
  state.zones = state.zones.filter(zone => state.timeMs < zone.expiresAtMs);
  state.authoredAreaZones = clone(state.zones);
}

function updateMatron(state, actor) {
  const mechanics = BOSS_ENCOUNTER_DEFINITIONS[state.encounterId].mechanics;
  actor.heading = ((state.timeMs / mechanics.shieldRotationMs) * (Math.PI * 2 / 3)) % (Math.PI * 2);
  if (state.timeMs >= actor.hitUntilMs) actor.animationState = "shield_rotate";
  if (actor.livingMossguards > 0 && state.timeMs >= actor.regenerationInterruptedUntilMs && actor.hp < actor.maxHp && actor.phase < 3) {
    actor.hp = Math.min(actor.maxHp, actor.hp + 8 * FIXED_STEP_MS / 1000);
  }
}

function updateSapper(state, actor) {
  if (state.timeMs >= actor.hitUntilMs) actor.animationState = actor.state === "plant_telegraph" ? "attack" : "idle";
  if (!actor.target.id) {
    // A no-build run has no semantic socket target to disable. Keep that
    // persisted contract intact, but bring the boss out of its forest spawn to
    // an authored open-approach staging point so the base loadout can fight it.
    if (actor.state === "active") moveToward(actor, {x: -16, z: 36}, 4);
    return;
  }
  if (actor.state === "staggered") {
    if (actor.cooldownRemainingMs === 0) actor.state = "active";
    return;
  }
  if (actor.state === "active") moveToward(actor, actor.target, 4);
  const atTarget = !Number.isFinite(actor.target.x) || !Number.isFinite(actor.target.z)
    || Math.hypot(actor.position.x - actor.target.x, actor.position.z - actor.target.z) <= 4;
  if (actor.state === "active" && actor.cooldownRemainingMs === 0 && atTarget) {
    actor.state = "plant_telegraph";
    actor.animationState = "attack";
    actor.telegraphUntilMs = state.timeMs + 1000;
    replaceActorVolume(state, actor, {kind: "socket_plant_telegraph", targetId: actor.target.id, visible: true, active: false, damaging: false, radius: 2.5, untilMs: actor.telegraphUntilMs});
    emit(state, "attack_telegraph", {actorId: actor.id, targetId: actor.target.id, attack: "socket_plant", resolvesAtMs: actor.telegraphUntilMs});
  } else if (actor.state === "plant_telegraph" && state.timeMs >= actor.telegraphUntilMs) {
    if (!state.disabledSocketIds.includes(actor.target.id)) state.disabledSocketIds.push(actor.target.id);
    emit(state, "socket_disabled", {actorId: actor.id, socketId: actor.target.id});
    emit(state, "attack_resolve", {actorId: actor.id, targetId: actor.target.id, attack: "socket_plant"});
    actor.state = "active";
    actor.animationState = "idle";
    actor.cooldownRemainingMs = 5000;
    removeActorVolumes(state, actor.id);
  }
}

function updateAshwing(state, actor) {
  if (state.timeMs >= actor.hitUntilMs) {
    actor.animationState = actor.state === "dive_telegraph"
      ? "dive_windup"
      : actor.state === "grounded" ? "grounded" : "airborne";
  }
  if (actor.state === "grounded") {
    if (actor.cooldownRemainingMs === 0) {
      actor.state = "active";
      actor.position.y = 8;
      actor.animationState = "airborne";
      actor.cooldownRemainingMs = 2200;
    }
    return;
  }
  if (actor.state === "active" && actor.cooldownRemainingMs === 0) {
    actor.state = "dive_telegraph";
    actor.telegraphUntilMs = state.timeMs + 800;
    actor.animationState = "dive_windup";
    replaceActorVolume(state, actor, {kind: "dive_lane", visible: true, active: false, damaging: false, width: 5, length: 24, untilMs: actor.telegraphUntilMs});
    emit(state, "attack_telegraph", {actorId: actor.id, attack: "dive_lane", resolvesAtMs: actor.telegraphUntilMs});
  } else if (actor.state === "dive_telegraph" && state.timeMs >= actor.telegraphUntilMs) {
    const definition = BOSS_ENCOUNTER_DEFINITIONS[state.encounterId].mechanics;
    const zone = {
      id: `ash:${state.eventSequence + 1}`,
      actorId: actor.id,
      kind: "ash",
      x: actor.position.x + randomSigned(actor.rngState) * 8,
      z: actor.position.z - 10,
      radius: definition.ashRadius,
      visible: true,
      damaging: true,
      telegraphMs: definition.ashTelegraphMs,
      activeAtMs: state.timeMs + definition.ashTelegraphMs,
      expiresAtMs: state.timeMs + definition.ashTelegraphMs + definition.ashActiveMs,
    };
    state.zones = [...state.zones.filter(item => item.kind !== "ash"), ...state.zones.filter(item => item.kind === "ash").slice(-(definition.maxAshZones - 1)), zone];
    emit(state, "attack_resolve", {actorId: actor.id, attack: "dive_lane", zoneId: zone.id});
    actor.state = "grounded";
    actor.position.y = 0;
    actor.animationState = "grounded";
    actor.cooldownRemainingMs = 700;
    removeActorVolumes(state, actor.id);
  }
}

function updateHerald(state, actor) {
  if (state.timeMs >= actor.hitUntilMs) {
    actor.animationState = actor.state === "ward_telegraph"
      || (actor.state === "exposed" && actor.telegraphUntilMs > state.timeMs)
      ? "attack"
      : "idle";
  }
  if (actor.state === "ward_telegraph" && state.timeMs >= actor.telegraphUntilMs) {
    const multiplier = state.boons.includes("wardlight-covenant") ? 1.35 : 1;
    actor.state = "exposed";
    actor.animationState = "idle";
    actor.telegraphUntilMs = 0;
    actor.vulnerableUntilMs = state.timeMs + Math.round(3000 * multiplier);
    actor.hitVolumes = [{kind: "heart_lantern", radius: 1.1, visible: true, active: true, damaging: false}];
    replaceActorVolume(state, actor, {kind: "heart_lantern", radius: 1.1, visible: true, active: true, damaging: false, untilMs: actor.vulnerableUntilMs});
    emit(state, "ward_reveal", {actorId: actor.id, untilMs: actor.vulnerableUntilMs});
    return;
  }
  if (actor.state === "exposed" && state.timeMs >= actor.vulnerableUntilMs) {
    actor.state = "phased";
    actor.animationState = "idle";
    actor.hitVolumes = [{kind: "body", radius: actor.radius, visible: false, active: false, damaging: false}];
    removeActorVolumes(state, actor.id);
    emit(state, "boss_phase", {actorId: actor.id, phase: actor.phase, state: "phased"});
    return;
  }
  if (actor.state !== "exposed") return;
  if (actor.cooldownRemainingMs === 0 && actor.telegraphUntilMs === 0) {
    actor.telegraphUntilMs = state.timeMs + 900;
    actor.animationState = "attack";
    replaceActorVolume(state, actor, {kind: "lantern_burst", visible: true, active: false, damaging: false, radius: 4, untilMs: actor.telegraphUntilMs});
    emit(state, "attack_telegraph", {actorId: actor.id, attack: "lantern_burst", resolvesAtMs: actor.telegraphUntilMs});
  } else if (actor.telegraphUntilMs > 0 && state.timeMs >= actor.telegraphUntilMs) {
    replaceActorVolume(state, actor, {kind: "lantern_burst", visible: true, active: true, damaging: true, radius: 4, untilMs: state.timeMs + 250});
    emit(state, "attack_resolve", {actorId: actor.id, attack: "lantern_burst"});
    actor.telegraphUntilMs = 0;
    actor.animationState = "idle";
    actor.cooldownRemainingMs = 2000;
  }
}

function updateCaravan(state, actor) {
  const mechanics = BOSS_ENCOUNTER_DEFINITIONS[state.encounterId].mechanics;
  if (state.timeMs >= actor.hitUntilMs) actor.animationState = actor.state === "objective_telegraph" ? "attack" : "idle";
  if (actor.state === "staggered") {
    actor.position.x += actor.velocity.x * FIXED_STEP_MS / 1000;
    actor.position.z += actor.velocity.z * FIXED_STEP_MS / 1000;
    actor.velocity.x *= 0.9;
    actor.velocity.z *= 0.9;
    if (actor.cooldownRemainingMs === 0) {
      actor.state = "active";
      actor.stagger = 0;
    }
    return;
  }
  if (actor.state === "active") moveToward(actor, actor.target, 3.5);
  const objectiveDistance = Math.hypot(actor.position.x - actor.target.x, actor.position.z - actor.target.z);
  const inAttackRange = Number.isFinite(objectiveDistance) && objectiveDistance <= mechanics.objectiveAttackRange;
  if (actor.state === "active" && actor.cooldownRemainingMs === 0 && inAttackRange) {
    actor.state = "objective_telegraph";
    actor.animationState = "attack";
    actor.stagger = 0;
    actor.telegraphUntilMs = state.timeMs + mechanics.objectiveTelegraphMs;
    replaceActorVolume(state, actor, {kind: "objective_lane", targetId: actor.target.id, x: actor.target.x, z: actor.target.z, heading: actor.heading, visible: true, active: false, damaging: false, width: 6, length: 20, untilMs: actor.telegraphUntilMs});
    emit(state, "attack_telegraph", {actorId: actor.id, targetId: actor.target.id, attack: "objective_charge", resolvesAtMs: actor.telegraphUntilMs});
  } else if (actor.state === "objective_telegraph" && state.timeMs >= actor.telegraphUntilMs) {
    if (!inAttackRange) {
      actor.state = "active";
      actor.animationState = "idle";
      actor.cooldownRemainingMs = mechanics.objectiveCooldownMs;
      removeActorVolumes(state, actor.id);
      return;
    }
    const amount = mechanics.objectiveDamage;
    emit(state, "objective_damage", {actorId: actor.id, targetId: actor.target.id, amount});
    emit(state, "attack_resolve", {actorId: actor.id, targetId: actor.target.id, attack: "objective_charge"});
    actor.state = "active";
    actor.animationState = "idle";
    actor.cooldownRemainingMs = 3000;
    removeActorVolumes(state, actor.id);
  }
}

function updateHart(state, actor) {
  if (state.timeMs >= actor.hitUntilMs) actor.animationState = actor.state === "root_telegraph" ? "attack" : "idle";
  if (actor.state === "active" && actor.cooldownRemainingMs === 0) {
    actor.state = "root_telegraph";
    actor.animationState = "attack";
    actor.telegraphUntilMs = state.timeMs + 1000;
    replaceActorVolume(state, actor, {kind: "root_lane", visible: true, active: false, damaging: false, width: 5, length: 26, untilMs: actor.telegraphUntilMs});
    emit(state, "attack_telegraph", {actorId: actor.id, attack: "root_lane", resolvesAtMs: actor.telegraphUntilMs});
  } else if (actor.state === "root_telegraph" && state.timeMs >= actor.telegraphUntilMs) {
    replaceActorVolume(state, actor, {kind: "root_lane", x: actor.position.x, z: actor.position.z - 13, heading: actor.heading, visible: true, active: true, damaging: true, width: 5, length: 26, untilMs: state.timeMs + 400});
    emit(state, "lane_pressure", {actorId: actor.id, targetId: "outer", amount: 8});
    emit(state, "gate_damage", {actorId: actor.id, targetId: "outer", amount: 8});
    emit(state, "attack_resolve", {actorId: actor.id, attack: "root_lane", lanePressure: "changed"});
    actor.state = "active";
    actor.animationState = "idle";
    actor.cooldownRemainingMs = 3000;
  }
}

function updateCinderwing(state, actor) {
  if (state.timeMs >= actor.hitUntilMs) actor.animationState = actor.state === "breath_telegraph"
    ? "breath"
    : Math.floor(state.timeMs / 600) % 2 === 0 ? "flap" : "glide";
  actor.position.y = actor.animationState === "flap" ? 14 : 12;
  if (actor.state === "airborne" && actor.cooldownRemainingMs === 0) {
    actor.state = "breath_telegraph";
    actor.animationState = "breath";
    actor.telegraphUntilMs = state.timeMs + 1000;
    replaceActorVolume(state, actor, {kind: "fire_breath", x: actor.position.x, z: actor.position.z - 15, heading: actor.heading, visible: true, active: false, damaging: false, width: 7, length: 30, untilMs: actor.telegraphUntilMs});
    emit(state, "attack_telegraph", {actorId: actor.id, attack: "lane_strafe", resolvesAtMs: actor.telegraphUntilMs});
  } else if (actor.state === "breath_telegraph" && state.timeMs >= actor.telegraphUntilMs) {
    actor.animationState = "breath";
    const zone = {id: `breath:${state.eventSequence + 1}`, actorId: actor.id, kind: "fire_breath", x: actor.position.x, z: actor.position.z - 15, heading: actor.heading, width: 7, length: 30, radius: 5, visible: true, damaging: true, telegraphMs: 1000, activeAtMs: state.timeMs, expiresAtMs: state.timeMs + 1800, damageCadenceMs: 750};
    state.zones = [...state.zones.filter(item => item.kind !== "fire_breath"), zone];
    removeActorVolumes(state, actor.id);
    emit(state, "dragon_breath", {actorId: actor.id, zoneId: zone.id});
    emit(state, "gate_damage", {actorId: actor.id, targetId: "heart", amount: 15 * (state.boons.includes("ashskin-binding") ? 0.75 : 1)});
    emit(state, "attack_resolve", {actorId: actor.id, attack: "lane_strafe", zoneId: zone.id});
    actor.state = "airborne";
    actor.cooldownRemainingMs = 3000;
  }
}

function updatePhases(state, actor) {
  const definition = BOSS_ENCOUNTER_DEFINITIONS[state.encounterId].actors.find(item => item.id === actor.id);
  while (actor.phase <= definition.phaseThresholds.length && actor.hp / actor.maxHp <= definition.phaseThresholds[actor.phase - 1]) {
    actor.phase += 1;
    emit(state, "boss_phase", {actorId: actor.id, phase: actor.phase});
  }
}

function defeatActor(state, actor, commandId, weaponId) {
  if (actor.defeated) return;
  actor.defeated = true;
  actor.state = "defeated";
  actor.animationState = actor.id === "cinderwing" ? "fall" : "collapse";
  actor.defeatedAtMs = state.timeMs;
  actor.presentationUntilMs = state.timeMs + (actor.id === "cinderwing" ? 1200 : 700);
  actor.hitVolumes = [];
  removeActorVolumes(state, actor.id);
  emit(state, "boss_defeat", {actorId: actor.id, commandId, weaponId});
  if (state.actors.every(item => item.defeated)) {
    state.status = "defeated";
    emit(state, "encounter_defeat", {encounterId: state.encounterId});
  }
}

function moveToward(actor, target, speed) {
  if (!Number.isFinite(target?.x) || !Number.isFinite(target?.z)) return;
  const dx = target.x - actor.position.x;
  const dz = target.z - actor.position.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= 0.05) {
    actor.velocity.x = 0;
    actor.velocity.z = 0;
    return;
  }
  const step = Math.min(distance, speed * FIXED_STEP_MS / 1000);
  actor.velocity.x = dx / distance * speed;
  actor.velocity.z = dz / distance * speed;
  actor.heading = Math.atan2(actor.velocity.x, actor.velocity.z);
  actor.position.x += dx / distance * step;
  actor.position.z += dz / distance * step;
}

function replaceActorVolume(state, actor, volume, identitySequence = state.eventSequence + 1) {
  removeActorVolumes(state, actor.id);
  state.hitVolumes.push({id: `${actor.id}:${volume.kind}:${identitySequence}`, actorId: actor.id, ...volume, damaging: volume.damaging === true});
  if (state.hitVolumes.length > MAX_HIT_VOLUMES) state.hitVolumes = state.hitVolumes.slice(-MAX_HIT_VOLUMES);
}

function removeActorVolumes(state, actorId) {
  state.hitVolumes = state.hitVolumes.filter(volume => volume.actorId !== actorId);
}

function emit(state, type, data = {}) {
  state.eventSequence += 1;
  const actor = data.actorId ? state.actors.find(item => item.id === data.actorId) : null;
  if (actor) actor.eventSequence = state.eventSequence;
  state.events.push({sequence: state.eventSequence, tick: state.timeMs / FIXED_STEP_MS, timeMs: state.timeMs, type, ...data});
  if (state.events.length > MAX_EVENTS) state.events.shift();
}

function withinShieldArc(actor, heading, shieldArcDegrees) {
  if (actor.livingMossguards <= 0) return false;
  if (!Number.isFinite(heading)) return true;
  for (let index = 0; index < actor.livingMossguards; index += 1) {
    const shieldHeading = actor.heading + index * (Math.PI * 2 / 3);
    const difference = Math.abs(Math.atan2(Math.sin(heading - shieldHeading), Math.cos(heading - shieldHeading)));
    if (difference <= (shieldArcDegrees * Math.PI / 180) / 2) return true;
  }
  return false;
}

function initialCooldown(encounterId, actorId) {
  if (actorId === "root-sapper-prime") return 2500;
  if (actorId === "ashwing-matriarch") return 2200;
  if (actorId === "moonless-herald") return 2000;
  if (actorId === "caravan-eater") return 2200;
  if (actorId === "hollow-hart" || actorId === "cinderwing") return 3000;
  return 0;
}

function titleForActor(id) {
  return id.split("-").map(part => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function boundedId(value) {
  return typeof value === "string" && STABLE_ID.test(value);
}

function validateOptions(options, fail) {
  exactKeys(options, OPTIONS_KEYS, new Set(), "options", fail);
  exactKeys(options.objectiveLanePosition, new Set(["x", "z"]), new Set(), "objective lane position", fail);
  if (!Number.isFinite(options.hpMultiplier) || options.hpMultiplier <= 0 || options.hpMultiplier > 4) fail("options HP multiplier is invalid");
  if (!Array.isArray(options.occupiedSocketIds) || options.occupiedSocketIds.length > 32) fail("occupied socket IDs are invalid");
  if (!Array.isArray(options.occupiedSockets) || options.occupiedSockets.length > 32) fail("occupied sockets must be an array");
  if (!boundedId(options.objectiveLaneId) || !Number.isFinite(options.objectiveLanePosition.x)
    || !Number.isFinite(options.objectiveLanePosition.z)
    || Math.abs(options.objectiveLanePosition.x) > MAX_WORLD_COORDINATE
    || Math.abs(options.objectiveLanePosition.z) > MAX_WORLD_COORDINATE) fail("objective lane option is invalid");
  for (const id of options.occupiedSocketIds) if (!boundedId(id)) fail("occupied socket ID is invalid");
  if (new Set(options.occupiedSocketIds).size !== options.occupiedSocketIds.length) fail("occupied socket IDs are duplicated");
  if (options.occupiedSocketIds.some((id, index, ids) => index > 0 && ids[index - 1] >= id)) {
    fail("occupied socket IDs are not canonical");
  }
  const socketIds = new Set();
  for (const socket of options.occupiedSockets) {
    exactKeys(socket, SOCKET_KEYS, new Set(), "occupied socket", fail);
    if (!boundedId(socket.id) || socketIds.has(socket.id) || !options.occupiedSocketIds.includes(socket.id)
      || !Number.isFinite(socket.x) || !Number.isFinite(socket.z)
      || Math.abs(socket.x) > MAX_WORLD_COORDINATE || Math.abs(socket.z) > MAX_WORLD_COORDINATE) fail("occupied socket is invalid");
    socketIds.add(socket.id);
  }
}

function validateTarget(target, actorId, options, fail) {
  if (!target || typeof target !== "object" || Array.isArray(target)) fail("actor target must be an object");
  const expectedKind = actorId === "root-sapper-prime" ? "fortification_socket"
    : actorId === "caravan-eater" ? "objective_lane" : actorId === "cinderwing" ? "anchor" : "warden";
  if (target.kind !== expectedKind) fail("actor target kind is inconsistent");
  if (target.kind === "warden" || target.kind === "anchor") {
    exactKeys(target, new Set(["kind", "id"]), new Set(), "actor target", fail);
    const expectedId = target.kind === "anchor" ? "hollow-hart" : "warden:host";
    if (!boundedId(target.id) || target.id !== expectedId) fail("actor target id is invalid");
    return;
  }
  if (target.kind === "objective_lane") {
    exactKeys(target, new Set(["kind", "id", "x", "z"]), new Set(), "actor target", fail);
    if (!boundedId(target.id) || target.id !== options.objectiveLaneId
      || target.x !== options.objectiveLanePosition.x || target.z !== options.objectiveLanePosition.z) fail("objective target is invalid");
    return;
  }
  if (target.kind === "fortification_socket") {
    const positioned = Object.hasOwn(target, "x") || Object.hasOwn(target, "z");
    exactKeys(target, new Set(["kind", "id"]), positioned ? new Set(["x", "z"]) : new Set(), "actor target", fail,
      {requireOptional: positioned});
    const expectedId = options.occupiedSocketIds[0] ?? null;
    if (target.id !== expectedId || (target.id !== null && !boundedId(target.id))) fail("socket target id is invalid");
    const expectedSocket = options.occupiedSockets.find(socket => socket.id === expectedId);
    if ((expectedSocket !== undefined) !== positioned
      || (positioned && (target.x !== expectedSocket.x || target.z !== expectedSocket.z))) fail("socket target position is invalid");
    return;
  }
  fail("actor target kind is invalid");
}

function validateActorVolume(volume, actor, fail) {
  if (!volume || !["body", "heart_lantern"].includes(volume.kind)) fail("actor volume kind is invalid");
  exactKeys(volume, new Set([...VOLUME_KEYS, "radius"]), new Set(), "actor volume", fail);
  if (!Number.isFinite(volume.radius) || volume.radius <= 0 || volume.radius > 20) fail("actor volume radius is invalid");
  for (const key of ["visible", "active", "damaging"]) if (typeof volume[key] !== "boolean") {
    fail(`actor volume ${key} must be boolean`);
  }
  if ((volume.kind === "body" && volume.radius !== actor.radius)
    || (volume.kind === "heart_lantern" && (actor.id !== "moonless-herald" || volume.radius !== 1.1))) {
    fail("actor volume is inconsistent");
  }
}

function validateActorHitVolumeState(actor, fail) {
  const expected = actor.defeated ? [] : actor.id === "moonless-herald" && actor.state === "exposed"
    ? [{kind: "heart_lantern", radius: 1.1, visible: true, active: true, damaging: false}]
    : [{kind: "body", radius: actor.radius, visible: actor.id !== "moonless-herald",
      active: actor.id !== "moonless-herald", damaging: false}];
  if (!deepExactEqual(actor.hitVolumes, expected)) fail("actor hit volumes differ from authored state");
}

function validateActorDynamicAuthority(actor, actorDefinition, director, fail) {
  const mobile = actor.id === "root-sapper-prime" || actor.id === "caravan-eater";
  const yValues = actor.id === "ashwing-matriarch" ? new Set([0, 8])
    : actor.id === "cinderwing" ? new Set([12, 14]) : new Set([actorDefinition.position.y]);
  if (!mobile) {
    if (actor.position.x !== actorDefinition.position.x || actor.position.z !== actorDefinition.position.z
      || actor.previousPosition.x !== actorDefinition.position.x || actor.previousPosition.z !== actorDefinition.position.z
      || !yValues.has(actor.position.y) || !yValues.has(actor.previousPosition.y)
      || Object.values(actor.velocity).some(value => value !== 0)) fail("fixed actor pose differs from authored authority");
  } else if (actor.position.y !== actorDefinition.position.y || actor.previousPosition.y !== actorDefinition.position.y
    || actor.velocity.y !== 0) fail("ground actor pose differs from authored authority");
  if (actor.id === "moss-crowned-matron") {
    if (actor.heading < 0 || actor.heading >= Math.PI * 2) fail("Matron heading is not normalized");
  } else if (mobile) {
    if (Math.abs(actor.heading) > Math.PI) fail("mobile actor heading is not normalized");
  } else if (actor.heading !== 0) fail("fixed actor heading differs from authored authority");
  if (actor.id === "moss-crowned-matron" ? actor.livingMossguards > 3 : actor.livingMossguards !== 0) {
    fail("actor mossguard authority is inconsistent");
  }
  if (actor.state === "defeated" && (actor.hp !== 0 || actor.hitVolumes.length !== 0)) fail("defeated actor remains live");
  const telegraphStates = new Set(["plant_telegraph", "dive_telegraph", "ward_telegraph", "objective_telegraph",
    "root_telegraph", "breath_telegraph"]);
  if (telegraphStates.has(actor.state) && actor.telegraphUntilMs <= director.timeMs) fail("actor telegraph timer is inconsistent");
  if (actor.state === "exposed" && actor.vulnerableUntilMs <= director.timeMs) fail("Herald exposure timer is inconsistent");
}

function validatePublishedActorVolumes(actor, director, fail) {
  const volumes = director.hitVolumes.filter(volume => volume.actorId === actor.id);
  const stateKind = {
    plant_telegraph: "socket_plant_telegraph",
    dive_telegraph: "dive_lane",
    ward_telegraph: "ward_reveal",
    objective_telegraph: "objective_lane",
    root_telegraph: "root_lane",
    breath_telegraph: "fire_breath",
  }[actor.state];
  if (stateKind) {
    if (volumes.length !== 1 || volumes[0].kind !== stateKind) fail("actor telegraph volume is inconsistent");
    return;
  }
  if (actor.state === "exposed") {
    if (volumes.length !== 1 || !["heart_lantern", "lantern_burst"].includes(volumes[0].kind)) {
      fail("Herald exposure volume is inconsistent");
    }
    return;
  }
  const transientRoot = actor.id === "hollow-hart" && actor.state === "active" && volumes.length === 1
    && volumes[0].kind === "root_lane" && volumes[0].active;
  if (!transientRoot && volumes.length !== 0) fail("actor has an unauthored published volume");
}

function validateHitVolume(volume, fail, director) {
  const common = ["id", "actorId", "kind", "visible", "active", "damaging", "untilMs"];
  const shapes = {
    socket_plant_telegraph: ["targetId", "radius"],
    dive_lane: ["width", "length"],
    ward_reveal: ["x", "z", "radius"],
    heart_lantern: ["radius"],
    lantern_burst: ["radius"],
    objective_lane: ["targetId", "x", "z", "heading", "width", "length"],
    fire_breath: ["x", "z", "heading", "width", "length"],
  };
  if (volume?.kind === "root_lane") {
    const positioned = ["x", "z", "heading"].some(key => Object.hasOwn(volume, key));
    exactKeys(volume, new Set([...common, "width", "length"]), positioned ? new Set(["x", "z", "heading"]) : new Set(),
      "hit volume", fail, {requireOptional: positioned});
  } else {
    const fields = shapes[volume?.kind];
    if (!fields) fail("hit volume kind is invalid");
    exactKeys(volume, new Set([...common, ...fields]), new Set(), "hit volume", fail);
  }
  for (const key of ["visible", "active", "damaging"]) if (typeof volume[key] !== "boolean") fail(`hit volume ${key} must be boolean`);
  for (const key of ["x", "z", "heading", "radius", "width", "length", "untilMs"]) {
    if (Object.hasOwn(volume, key) && !Number.isFinite(volume[key])) fail(`hit volume ${key} must be finite`);
  }
  for (const key of ["x", "z"]) if (Object.hasOwn(volume, key) && Math.abs(volume[key]) > MAX_WORLD_COORDINATE) {
    fail(`hit volume ${key} is out of bounds`);
  }
  if (Object.hasOwn(volume, "heading") && Math.abs(volume.heading) > Math.PI * 2 + 1e-9) fail("hit volume heading is out of bounds");
  for (const key of ["radius", "width", "length"]) {
    if (Object.hasOwn(volume, key) && (volume[key] <= 0 || volume[key] > 100)) fail(`hit volume ${key} is out of bounds`);
  }
  if (!Number.isSafeInteger(volume.untilMs) || volume.untilMs < 0) fail("hit volume untilMs is invalid");
  if (volume.untilMs <= director.timeMs || volume.untilMs > director.timeMs + 60_000) fail("hit volume time is inconsistent");
  for (const key of ["id", "actorId", "targetId"]) {
    if (Object.hasOwn(volume, key) && !boundedId(volume[key])) fail(`hit volume ${key} is invalid`);
  }
  const actor = director.actors.find(item => item.id === volume.actorId);
  if (!actor) fail("hit volume actorId is unknown");
  if (HIT_VOLUME_ACTORS[volume.kind] !== actor.id) fail("hit volume kind is unauthored for actor");
  const identityPrefix = `${actor.id}:${volume.kind}:`;
  const identitySequence = Number(volume.id.slice(identityPrefix.length));
  if (!volume.id.startsWith(identityPrefix) || !Number.isSafeInteger(identitySequence)
    || identitySequence < 1 || identitySequence > director.eventSequence) fail("hit volume identity is inconsistent");
  if (volume.kind === "socket_plant_telegraph" && !director.options.occupiedSocketIds.includes(volume.targetId)) {
    fail("hit volume socket target is unknown");
  }
  if (volume.kind === "objective_lane" && volume.targetId !== director.options.objectiveLaneId) {
    fail("hit volume objective target is inconsistent");
  }
  if (volume.visible !== true) fail("hit volume must remain visible while published");
  const damagingKind = ["lantern_burst", "root_lane", "fire_breath"].includes(volume.kind);
  const activityValid = volume.kind === "heart_lantern" ? volume.active && !volume.damaging
    : damagingKind ? volume.damaging === volume.active : !volume.active && !volume.damaging;
  if (!activityValid) {
    fail("hit volume activity is inconsistent");
  }
  if (volume.kind === "socket_plant_telegraph" && (volume.targetId !== actor.target.id || volume.radius !== 2.5)) {
    fail("socket telegraph differs from authored geometry");
  }
  if (volume.kind === "dive_lane" && (volume.width !== 5 || volume.length !== 24)) {
    fail("dive telegraph differs from authored geometry");
  }
  if (volume.kind === "ward_reveal" && (volume.x !== actor.position.x || volume.z !== actor.position.z || volume.radius !== 3)) {
    fail("ward telegraph differs from authored geometry");
  }
  if (volume.kind === "heart_lantern" && volume.radius !== 1.1) fail("heart lantern differs from authored geometry");
  if (volume.kind === "lantern_burst" && volume.radius !== 4) fail("lantern burst differs from authored geometry");
  if (volume.kind === "objective_lane" && (volume.targetId !== actor.target.id || volume.x !== actor.target.x
    || volume.z !== actor.target.z || volume.heading !== actor.heading || volume.width !== 6 || volume.length !== 20)) {
    fail("objective telegraph differs from authored geometry");
  }
  if (volume.kind === "root_lane" && (volume.width !== 5 || volume.length !== 26
    || (Object.hasOwn(volume, "x") && (volume.x !== actor.position.x || volume.z !== actor.position.z - 13
      || volume.heading !== actor.heading)))) fail("root lane differs from authored geometry");
  if (volume.kind === "fire_breath" && (volume.x !== actor.position.x || volume.z !== actor.position.z - 15
    || volume.heading !== actor.heading || volume.width !== 7 || volume.length !== 30)) {
    fail("fire breath differs from authored geometry");
  }
  if (!volume.active && volume.untilMs !== actor.telegraphUntilMs
    && !(volume.kind === "heart_lantern" && volume.untilMs === actor.vulnerableUntilMs)) {
    fail("hit volume timer differs from actor authority");
  }
}

function validateZone(zone, fail, director, label = "zone") {
  const common = ["id", "actorId", "kind", "x", "z", "radius", "visible", "damaging", "telegraphMs", "activeAtMs", "expiresAtMs"];
  const extra = zone?.kind === "ash" ? [] : zone?.kind === "fire_breath"
    ? ["heading", "width", "length", "damageCadenceMs"] : null;
  if (extra === null) fail(`${label} kind is invalid`);
  exactKeys(zone, new Set([...common, ...extra]), new Set(), label, fail);
  for (const key of ["x", "z", "radius", "telegraphMs", "activeAtMs", "expiresAtMs", ...extra]) {
    if (!Number.isFinite(zone[key])) fail(`${label} ${key} must be finite`);
  }
  if (zone.radius <= 0 || zone.radius > 100 || zone.telegraphMs < 0 || zone.activeAtMs < 0
    || zone.expiresAtMs < zone.activeAtMs) fail(`${label} range is invalid`);
  for (const key of ["telegraphMs", "activeAtMs", "expiresAtMs", "damageCadenceMs"]) {
    if (Object.hasOwn(zone, key) && !Number.isSafeInteger(zone[key])) fail(`${label} ${key} must be an integer`);
  }
  for (const key of ["width", "length", "damageCadenceMs"]) {
    if (Object.hasOwn(zone, key) && (zone[key] <= 0 || zone[key] > 100_000)) fail(`${label} ${key} is out of bounds`);
  }
  for (const key of ["visible", "damaging"]) if (typeof zone[key] !== "boolean") fail(`${label} ${key} must be boolean`);
  if (!isNonEmptyString(zone.id) || !isNonEmptyString(zone.actorId)) fail(`${label} identity is invalid`);
  if (!boundedId(zone.id) || !boundedId(zone.actorId) || !director.actors.some(actor => actor.id === zone.actorId)) {
    fail(`${label} identity is invalid`);
  }
  const actor = director.actors.find(item => item.id === zone.actorId);
  if (ZONE_ACTORS[zone.kind] !== actor.id) fail(`${label} kind is unauthored for actor`);
  const identityPrefix = zone.kind === "ash" ? "ash:" : "breath:";
  const identitySequence = Number(zone.id.slice(identityPrefix.length));
  if (!zone.id.startsWith(identityPrefix) || !Number.isSafeInteger(identitySequence)
    || identitySequence < 1 || identitySequence > director.eventSequence) fail(`${label} identity is inconsistent`);
  if (Math.abs(zone.x) > MAX_WORLD_COORDINATE || Math.abs(zone.z) > MAX_WORLD_COORDINATE
    || (Object.hasOwn(zone, "heading") && Math.abs(zone.heading) > Math.PI * 2 + 1e-9)) fail(`${label} position is out of bounds`);
  if (zone.expiresAtMs > director.timeMs + 60_000 || zone.activeAtMs > zone.expiresAtMs) fail(`${label} time is inconsistent`);
  if (zone.expiresAtMs <= director.timeMs || zone.visible !== true || zone.damaging !== true || zone.telegraphMs > 60_000) {
    fail(`${label} authored state is inconsistent`);
  }
  if (zone.kind === "ash" && (zone.radius !== 4.5 || zone.telegraphMs !== 800
    || zone.activeAtMs + 4_000 !== zone.expiresAtMs || zone.z !== actor.position.z - 10
    || Math.abs(zone.x - actor.position.x) > 8 + 1e-9)) fail(`${label} differs from authored ash geometry`);
  if (zone.kind === "fire_breath" && (zone.radius !== 5 || zone.telegraphMs !== 1_000
    || zone.width !== 7 || zone.length !== 30 || zone.damageCadenceMs !== 750
    || zone.x !== actor.position.x || zone.z !== actor.position.z - 15 || zone.heading !== actor.heading
    || zone.expiresAtMs - zone.activeAtMs !== 1_800)) fail(`${label} differs from authored fire geometry`);
}

function validateEvent(event, fail, director) {
  const shape = EVENT_SHAPES[event?.type];
  if (!shape) fail("event type is invalid");
  exactKeys(event, new Set([...EVENT_KEYS, ...shape[0]]), shape[1], "event", fail);
  if (!Number.isSafeInteger(event.tick) || event.tick < 0 || !Number.isSafeInteger(event.timeMs) || event.timeMs < 0) {
    fail("event time is invalid");
  }
  if (event.timeMs > director.timeMs || event.tick !== event.timeMs / FIXED_STEP_MS) fail("event time is inconsistent");
  for (const key of ["resolvesAtMs", "untilMs", "amount", "damage", "stagger", "phase", "livingMossguards"]) {
    if (Object.hasOwn(event, key) && !Number.isFinite(event[key])) fail(`event ${key} must be finite`);
  }
  for (const key of ["resolvesAtMs", "untilMs"]) {
    if (Object.hasOwn(event, key) && (!Number.isSafeInteger(event[key]) || event[key] < 0)) fail(`event ${key} is invalid`);
  }
  for (const key of ["amount", "damage", "stagger", "livingMossguards"]) {
    if (Object.hasOwn(event, key) && (event[key] < 0 || event[key] > MAX_COMBAT_SCALAR)) fail(`event ${key} is out of bounds`);
  }
  for (const key of ["resolvesAtMs", "untilMs"]) if (Object.hasOwn(event, key) && event[key] > event.timeMs + 60_000) {
    fail(`event ${key} is inconsistent`);
  }
  for (const key of ["commandId", "socketId", "zoneId"]) {
    if (Object.hasOwn(event, key) && !boundedId(event[key])) {
      fail(`event ${key} is invalid`);
    }
  }
  if (Object.hasOwn(event, "commandId") && !director.processedCommandIds.includes(event.commandId)) {
    fail("event command is absent from the replay ledger");
  }
  for (const key of ["actorId", "targetId"]) {
    if (!Object.hasOwn(event, key)) continue;
    const nullableInteraction = ["objective_interaction", "gate_interaction"].includes(event.type);
    if (event[key] === null && nullableInteraction) continue;
    if (!boundedId(event[key])) fail(`event ${key} is invalid`);
  }
  if (Object.hasOwn(event, "actorId") && event.actorId !== null
    && !director.actors.some(actor => actor.id === event.actorId)) fail("event actorId is unknown");
  if (Object.hasOwn(event, "encounterId") && event.encounterId !== director.encounterId) fail("event encounterId is inconsistent");
  if (Object.hasOwn(event, "attack") && !ATTACK_IDS.has(event.attack)) fail("event attack is invalid");
  if (Object.hasOwn(event, "weaponId") && !WEAPON_IDS.has(event.weaponId)) fail("event weaponId is invalid");
  if (Object.hasOwn(event, "reason") && !["phased", "flight_guard", "rotating_shield_arc"].includes(event.reason)) {
    fail("event reason is invalid");
  }
  if (Object.hasOwn(event, "state") && event.state !== "phased") fail("event state is invalid");
  if (Object.hasOwn(event, "lanePressure") && event.lanePressure !== "changed") fail("event lane pressure is invalid");
  if (Object.hasOwn(event, "phase") && (!Number.isInteger(event.phase) || event.phase < 1 || event.phase > 4)) {
    fail("event phase is invalid");
  }
  const actor = Object.hasOwn(event, "actorId") && event.actorId !== null
    ? director.actors.find(item => item.id === event.actorId) : null;
  if (["attack_telegraph", "attack_resolve"].includes(event.type)) {
    const expectedAttack = event.actorId === "moonless-herald"
      ? (event.attack === "ward_reveal" ? "ward_reveal" : "lantern_burst") : ACTOR_ATTACKS[event.actorId];
    if (!expectedAttack || event.attack !== expectedAttack) fail("event attack is unauthored for actor");
    const targetRequired = ["root-sapper-prime", "caravan-eater"].includes(event.actorId);
    const expectedTarget = actor?.target?.id;
    if (targetRequired ? event.targetId !== expectedTarget : Object.hasOwn(event, "targetId")) {
      fail("event attack target is inconsistent");
    }
    const zoneRequired = event.type === "attack_resolve" && ["ashwing-matriarch", "cinderwing"].includes(event.actorId);
    if (zoneRequired) {
      const prefix = event.actorId === "ashwing-matriarch" ? "ash:" : "breath:";
      const zoneSequence = Number(event.zoneId?.slice(prefix.length));
      if (!event.zoneId?.startsWith(prefix) || !Number.isSafeInteger(zoneSequence)
        || zoneSequence < 1 || zoneSequence > event.sequence) fail("event attack zone is inconsistent");
    } else if (Object.hasOwn(event, "zoneId")) fail("event attack has an unauthored zone");
    const commandRequired = event.type === "attack_telegraph" && event.attack === "ward_reveal";
    if (commandRequired !== Object.hasOwn(event, "commandId")) fail("event attack command identity is inconsistent");
  }
  if (event.type === "boss_stagger") {
    if (!["root-sapper-prime", "caravan-eater"].includes(event.actorId)) fail("stagger actor is unauthored");
    if (event.actorId === "root-sapper-prime") {
      if (event.socketId !== actor.target.id) fail("stagger socket is inconsistent");
    } else if (Object.hasOwn(event, "socketId")) fail("stagger socket is unauthored");
  }
  if (event.type === "shield_feed_broken" && (event.actorId !== "moss-crowned-matron"
    || !event.targetId.startsWith("mossguard-feed:") || event.livingMossguards > 2)) fail("shield-feed event is inconsistent");
  if (event.type === "hit_ignored" && !((event.actorId === "moonless-herald" && event.reason === "phased")
    || (event.actorId === "cinderwing" && event.reason === "flight_guard"))) fail("ignored-hit event is inconsistent");
  if (event.type === "hit_blocked" && (event.actorId !== "moss-crowned-matron"
    || event.reason !== "rotating_shield_arc")) fail("blocked-hit event is inconsistent");
  if (event.type === "socket_disabled" && (event.actorId !== "root-sapper-prime"
    || !director.options.occupiedSocketIds.includes(event.socketId)
    || !director.disabledSocketIds.includes(event.socketId))) fail("socket event is inconsistent");
  if (event.type === "ward_reveal" && (event.actorId !== "moonless-herald"
    || event.untilMs > actor.vulnerableUntilMs)) fail("ward event actor is inconsistent");
  if (event.type === "objective_damage" && (event.actorId !== "caravan-eater"
    || event.targetId !== actor.target.id || event.amount !== 12)) fail("objective event is inconsistent");
  if (event.type === "lane_pressure" && (event.actorId !== "hollow-hart" || event.targetId !== "outer"
    || event.amount !== 8)) {
    fail("lane-pressure event is inconsistent");
  }
  const cinderwingGateDamage = director.boons.includes("ashskin-binding") ? 11.25 : 15;
  if (event.type === "gate_damage" && !((event.actorId === "hollow-hart" && event.targetId === "outer" && event.amount === 8)
    || (event.actorId === "cinderwing" && event.targetId === "heart" && event.amount === cinderwingGateDamage))) {
    fail("gate event is inconsistent");
  }
  const breathSequence = event.type === "dragon_breath" ? Number(event.zoneId?.slice("breath:".length)) : null;
  if (event.type === "dragon_breath" && (event.actorId !== "cinderwing" || !event.zoneId.startsWith("breath:")
    || !Number.isSafeInteger(breathSequence) || breathSequence !== event.sequence)) {
    fail("dragon-breath event is inconsistent");
  }
  if (event.type === "boss_phase" && (event.phase > actor.phase
    || (Object.hasOwn(event, "state") && event.actorId !== "moonless-herald"))) fail("phase event is inconsistent");
  if (event.type === "boss_defeat" && !actor.defeated) fail("boss-defeat event precedes actor defeat");
  if (event.type === "boss_intro" && director.status === "waiting") fail("boss-intro event precedes encounter release");
  if (event.type === "encounter_defeat" && director.status !== "defeated") fail("encounter-defeat event precedes authority defeat");
}

function validateDirector(input, {requireHash}) {
  const fail = message => { throw new Error(`invalid boss director checkpoint: ${message}`); };
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("state must be an object");
  let checkpointText;
  try { checkpointText = JSON.stringify(input); } catch { fail("state must be JSON serialisable"); }
  if (!checkpointText || checkpointText.length > MAX_CHECKPOINT_CHARS) fail("checkpoint payload out of bounds");
  exactKeys(input, DIRECTOR_KEYS, requireHash ? new Set(["hash"]) : new Set(["hash"]), "director", fail,
    {requireOptional: requireHash});
  if (input.version !== BOSS_DIRECTOR_VERSION) fail("unsupported version");
  const definition = BOSS_ENCOUNTER_DEFINITIONS[input.encounterId];
  if (!definition) fail("unknown encounter");
  validateOptions(input.options, fail);
  if (input.label !== definition.title) fail("director label is invalid");
  if (input.mode !== "authored-director" || !["waiting", "active", "defeated"].includes(input.status)) fail("authority mode or status invalid");
  if (!Array.isArray(input.actors) || input.actors.length < 1 || input.actors.length > MAX_ACTORS || input.actors.length !== definition.actors.length) fail("actor count out of bounds");
  if (new Set(input.actors.map(actor => actor?.id)).size !== definition.actors.length) fail("actor identities are inconsistent");
  if (input.actors.some((actor, index) => actor?.id !== definition.actors[index].id)) fail("actor roster order is inconsistent");
  if (!Array.isArray(input.zones) || input.zones.length > MAX_ZONES) fail("zone count out of bounds");
  if (!Array.isArray(input.authoredAreaZones) || input.authoredAreaZones.length > MAX_ZONES) fail("authored zone count out of bounds");
  if (!Array.isArray(input.hitVolumes) || input.hitVolumes.length > MAX_HIT_VOLUMES) fail("hit volume count out of bounds");
  if (!Array.isArray(input.events) || input.events.length > MAX_EVENTS) fail("event count out of bounds");
  if (!Array.isArray(input.processedCommandIds) || input.processedCommandIds.length > MAX_COMMAND_IDS) fail("command id count out of bounds");
  if (!Array.isArray(input.disabledSocketIds) || input.disabledSocketIds.length > 32) fail("disabled socket count out of bounds");
  if (!Array.isArray(input.boons) || input.boons.length > 64) fail("boon count out of bounds");
  for (const id of [...input.processedCommandIds, ...input.disabledSocketIds, ...input.boons]) {
    if (!boundedId(id)) fail("authority identifier out of bounds");
  }
  if (new Set(input.processedCommandIds).size !== input.processedCommandIds.length) fail("duplicate processed command id");
  if (new Set(input.disabledSocketIds).size !== input.disabledSocketIds.length || new Set(input.boons).size !== input.boons.length) {
    fail("duplicate authority identifier");
  }
  if (input.disabledSocketIds.some(id => !input.options.occupiedSocketIds.includes(id))) fail("disabled socket is unauthored");
  if (!Number.isSafeInteger(input.timeMs) || input.timeMs < 0 || input.timeMs > MAX_DIRECTOR_TIME_MS) fail("authority time out of bounds");
  if (!Number.isInteger(input.accumulatorMs) || input.accumulatorMs < 0 || input.accumulatorMs >= FIXED_STEP_MS) fail("authority accumulator out of bounds");
  if (!Number.isInteger(input.rngState) || input.rngState < 0 || input.rngState > 0xffffffff) fail("authority rng out of bounds");
  const maximumEventSequence = MAX_COMMAND_IDS * 4 + Math.floor(input.timeMs / FIXED_STEP_MS) * 8;
  if (!Number.isSafeInteger(input.eventSequence) || input.eventSequence < 0 || input.eventSequence > maximumEventSequence) fail("authority event sequence out of bounds");
  for (const actor of input.actors) {
    exactKeys(actor, ACTOR_KEYS, new Set(), "actor", fail);
    exactKeys(actor.position, VECTOR_KEYS, new Set(), "actor position", fail);
    exactKeys(actor.previousPosition, VECTOR_KEYS, new Set(), "actor previous position", fail);
    exactKeys(actor.velocity, VECTOR_KEYS, new Set(), "actor velocity", fail);
    validateTarget(actor.target, actor.id, input.options, fail);
    const actorDefinition = definition.actors.find(item => item.id === actor.id);
    if (!actorDefinition) fail("unknown actor");
    if (actor.title !== titleForActor(actor.id)) fail("actor title is invalid");
    for (const number of [actor.position?.x, actor.position?.y, actor.position?.z, actor.previousPosition?.x, actor.previousPosition?.y, actor.previousPosition?.z, actor.velocity?.x, actor.velocity?.y, actor.velocity?.z, actor.heading, actor.radius, actor.maxHp, actor.hp, actor.stagger, actor.phase, actor.cooldownRemainingMs, actor.telegraphUntilMs, actor.vulnerableUntilMs, actor.regenerationInterruptedUntilMs, actor.hitUntilMs, actor.defeatedAtMs, actor.presentationUntilMs, actor.wardPulseReadyAtMs, actor.livingMossguards, actor.rngState, actor.eventSequence]) {
      if (!Number.isFinite(number)) fail("non-finite actor number");
    }
    if (actor.radius !== actorDefinition.radius || actor.maxHp !== Math.round(actorDefinition.maxHp * input.options?.hpMultiplier)
      || actor.hp < 0 || actor.hp > actor.maxHp || actor.maxHp <= 0
      || !Number.isInteger(actor.phase) || actor.phase < 1 || actor.phase > actorDefinition.phaseThresholds.length + 1
      || actor.stagger < 0 || actor.stagger > MAX_COMBAT_SCALAR || Math.abs(actor.heading) > Math.PI * 2 + 1e-9) fail("actor range violation");
    const timerLeadMs = {cooldownRemainingMs: 5_000, telegraphUntilMs: 1_000, vulnerableUntilMs: 4_050,
      regenerationInterruptedUntilMs: 4_000, hitUntilMs: 500, defeatedAtMs: 0, presentationUntilMs: 1_200,
      wardPulseReadyAtMs: 1_500};
    for (const key of Object.keys(timerLeadMs)) {
      const upper = key === "cooldownRemainingMs" ? timerLeadMs[key] : input.timeMs + timerLeadMs[key];
      if (!Number.isSafeInteger(actor[key]) || actor[key] < 0 || actor[key] > upper) {
        fail(`actor ${key} is invalid`);
      }
    }
    if (actor.defeatedAtMs > input.timeMs) fail("actor defeatedAtMs is inconsistent");
    if (!ACTOR_STATE_IDS[actor.id]?.has(actor.state)) fail("actor state is invalid");
    if (!ACTOR_ANIMATION_IDS[actor.id]?.has(actor.animationState)) fail("actor animation state is invalid");
    if ((actor.defeated === true) !== (actor.state === "defeated")) fail("actor defeated state is inconsistent");
    for (const vector of [actor.position, actor.previousPosition]) {
      if (Object.values(vector).some(number => Math.abs(number) > MAX_WORLD_COORDINATE)) fail("actor vector is out of bounds");
    }
    if (Object.values(actor.velocity).some(number => Math.abs(number) > MAX_VELOCITY)) fail("actor velocity is out of bounds");
    if (!Number.isInteger(actor.rngState) || actor.rngState < 0 || actor.rngState > 0xffffffff) fail("actor rng out of bounds");
    if (!Number.isSafeInteger(actor.eventSequence) || actor.eventSequence < 0 || actor.eventSequence > input.eventSequence) fail("actor event sequence out of bounds");
    if (!Number.isInteger(actor.livingMossguards) || actor.livingMossguards < 0 || actor.livingMossguards > 3) fail("mossguard range violation");
    if (!Array.isArray(actor.hitVolumes) || actor.hitVolumes.length > 4) fail("actor hit volumes out of bounds");
    if (typeof actor.defeated !== "boolean") fail("actor defeated must be boolean");
    for (const volume of actor.hitVolumes) validateActorVolume(volume, actor, fail);
    validateActorHitVolumeState(actor, fail);
    validateActorDynamicAuthority(actor, actorDefinition, input, fail);
  }
  for (const zone of input.zones) validateZone(zone, fail, input);
  for (const zone of input.authoredAreaZones) validateZone(zone, fail, input, "authored zone");
  if (JSON.stringify(input.authoredAreaZones) !== JSON.stringify(input.zones)) fail("authored zones are inconsistent");
  for (const volume of input.hitVolumes) validateHitVolume(volume, fail, input);
  if (new Set(input.hitVolumes.map(volume => volume.id)).size !== input.hitVolumes.length
    || new Set(input.hitVolumes.map(volume => volume.actorId)).size !== input.hitVolumes.length) {
    fail("hit volume identities are duplicated");
  }
  if (new Set(input.zones.map(zone => zone.id)).size !== input.zones.length) fail("zone identities are duplicated");
  for (const actor of input.actors) validatePublishedActorVolumes(actor, input, fail);
  let lastSequence = 0;
  for (const event of input.events) {
    validateEvent(event, fail, input);
    if (!Number.isInteger(event.sequence) || event.sequence <= lastSequence || event.sequence > input.eventSequence || !isNonEmptyString(event.type)) fail("event ordering violation");
    lastSequence = event.sequence;
  }
  if ((input.eventSequence === 0) !== (input.events.length === 0)
    || (input.events.length > 0 && lastSequence !== input.eventSequence)) fail("event cursor is inconsistent");
  for (const actor of input.actors) {
    const lastActorEvent = input.events.findLast(event => event.actorId === actor.id);
    if (lastActorEvent && actor.eventSequence !== lastActorEvent.sequence) fail("actor event cursor is inconsistent");
  }
  if ((input.status === "defeated") !== input.actors.every(actor => actor.defeated)) fail("director defeated status is inconsistent");
  if (input.status === "waiting" && input.actors.some(actor => actor.state !== (actor.id === "moonless-herald" ? "phased" : "waiting"))) {
    fail("waiting director contains released actor authority");
  }
  if (input.status === "active" && input.actors.some(actor => actor.state === "waiting")) fail("active director contains waiting actor authority");
  if (requireHash && !/^[0-9a-f]{8}$/.test(input.hash ?? "")) fail("missing stable hash");
  if (!deepExactEqual(input, canonicalDirectorProjection(input))) fail("checkpoint differs from canonical authored schema");
}

function projectKeys(value, keys) {
  return Object.fromEntries([...keys].filter(key => Object.hasOwn(value, key)).map(key => [key, clone(value[key])]));
}

function canonicalDirectorProjection(input) {
  const output = projectKeys(input, new Set([...DIRECTOR_KEYS, "hash"]));
  output.actors = input.actors.map(actor => {
    const projected = projectKeys(actor, ACTOR_KEYS);
    projected.position = projectKeys(actor.position, VECTOR_KEYS);
    projected.previousPosition = projectKeys(actor.previousPosition, VECTOR_KEYS);
    projected.velocity = projectKeys(actor.velocity, VECTOR_KEYS);
    const targetKeys = actor.target.kind === "objective_lane" ? new Set(["kind", "id", "x", "z"])
      : actor.target.kind === "fortification_socket" && Object.hasOwn(actor.target, "x")
        ? new Set(["kind", "id", "x", "z"]) : new Set(["kind", "id"]);
    projected.target = projectKeys(actor.target, targetKeys);
    projected.hitVolumes = actor.hitVolumes.map(volume => projectKeys(volume, new Set([...VOLUME_KEYS, "radius"])));
    return projected;
  });
  const zoneProjection = zone => projectKeys(zone, new Set(["id", "actorId", "kind", "x", "z", "radius", "visible",
    "damaging", "telegraphMs", "activeAtMs", "expiresAtMs", "heading", "width", "length", "damageCadenceMs"]));
  const volumeProjection = volume => projectKeys(volume, new Set(["id", "actorId", "kind", "targetId", "x", "z",
    "heading", "radius", "width", "length", "untilMs", "visible", "active", "damaging"]));
  output.zones = input.zones.map(zoneProjection);
  output.authoredAreaZones = input.authoredAreaZones.map(zoneProjection);
  output.hitVolumes = input.hitVolumes.map(volumeProjection);
  output.events = input.events.map(event => {
    const [required, optional] = EVENT_SHAPES[event.type];
    return projectKeys(event, new Set([...EVENT_KEYS, ...required, ...optional]));
  });
  output.options = projectKeys(input.options, OPTIONS_KEYS);
  output.options.objectiveLanePosition = projectKeys(input.options.objectiveLanePosition, new Set(["x", "z"]));
  output.options.occupiedSockets = input.options.occupiedSockets.map(socket => projectKeys(socket, SOCKET_KEYS));
  return output;
}

function deepExactEqual(left, right) {
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return Object.is(left, right);
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => deepExactEqual(value, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index]
    && deepExactEqual(left[key], right[key]));
}

function exactKeys(value, required, optional, label, fail, {requireOptional = false} = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  for (const key of required) if (!Object.hasOwn(value, key)) fail(`${label}.${key} is required`);
  if (requireOptional) for (const key of optional) if (!Object.hasOwn(value, key)) fail(`${label}.${key} is required`);
  for (const key of Object.keys(value)) if (!required.has(key) && !optional.has(key)) fail(`${label}.${key} is unsupported`);
  return value;
}

function finiteNonNegative(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new RangeError(`${label} must be non-negative`);
  return number;
}

function randomSigned(seed) {
  return (seed / 0xffffffff) * 2 - 1;
}

function xorshift(value) {
  let next = value >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}

function mixSeed(seed, text) {
  let value = seed >>> 0;
  for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0;
  return value || 1;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) if (child && typeof child === "object" && !Object.isFrozen(child)) deepFreeze(child);
  return value;
}

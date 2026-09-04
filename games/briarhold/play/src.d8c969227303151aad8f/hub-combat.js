/**
 * Deterministic, renderer-free combat state for Briarhold's hub NPCs.
 *
 * The simulation deliberately emits attack events instead of owning enemy HP.
 * A browser, Worker, or authoritative co-op host can therefore run the same
 * targeting logic, then apply attacks to its Battlefield instance. Defender HP
 * is run-local state: serialising and restoring this object never revives an
 * NPC whose HP reached zero.
 */

export const HUB_COMBAT_STATE_VERSION = 1;
export const HUB_COMBAT_COURTYARD_ZONE = "courtyard";

export const HUB_DEFENDER_IDS = Object.freeze({
  BELLKEEPER: "bellkeeper",
  MASON: "mason",
  QUARTERMASTER: "quartermaster",
  TRAPPER: "trapper",
  GREENWARDEN: "greenwarden",
});

/**
 * Positions match the authored NPC spawn points in map-definition.js. Combat
 * values are intentionally modest baseline values; permanent NPC-tree bonuses
 * can be supplied as per-defender modifiers when a run state is created.
 */
export const HUB_DEFENDER_DEFINITIONS = deepFreeze([
  {
    id: HUB_DEFENDER_IDS.BELLKEEPER,
    position: {x: -17.1, y: 0, z: -16},
    maxHp: 90,
    damage: 18,
    attackInterval: 1.15,
    range: 24,
  },
  {
    id: HUB_DEFENDER_IDS.MASON,
    position: {x: -21.5, y: 0, z: -9.1},
    maxHp: 130,
    damage: 24,
    attackInterval: 1.45,
    range: 12,
  },
  {
    id: HUB_DEFENDER_IDS.QUARTERMASTER,
    position: {x: 2, y: 0, z: -9.2},
    maxHp: 100,
    damage: 14,
    attackInterval: 0.85,
    range: 28,
  },
  {
    id: HUB_DEFENDER_IDS.TRAPPER,
    position: {x: -20.5, y: 0, z: -18.6},
    maxHp: 85,
    damage: 32,
    attackInterval: 1.75,
    range: 22,
  },
  {
    id: HUB_DEFENDER_IDS.GREENWARDEN,
    position: {x: -18, y: 0, z: -25.6},
    maxHp: 110,
    damage: 20,
    attackInterval: 1.3,
    range: 26,
  },
]);

const DEFINITION_BY_ID = new Map(
  HUB_DEFENDER_DEFINITIONS.map((definition) => [definition.id, definition]),
);

/**
 * Create or restore combat state for the NPCs active in this run.
 *
 * `modifiers` is keyed by NPC ID and may override maxHp, damage,
 * attackInterval, and range. This is the integration point for permanent NPC
 * progression without putting profile data into the combat simulation.
 */
export function createHubCombatState({
  activeNpcIds = [],
  persisted = null,
  modifiers = {},
} = {}) {
  if (!Array.isArray(activeNpcIds)) throw new TypeError("activeNpcIds must be an array");
  const persistedDefenders = persisted?.defenders ?? {};
  const activeSet = new Set(activeNpcIds);
  const defenders = {};

  for (const definition of HUB_DEFENDER_DEFINITIONS) {
    if (!activeSet.has(definition.id)) continue;
    const modifier = isPlainObject(modifiers?.[definition.id]) ? modifiers[definition.id] : {};
    const saved = isPlainObject(persistedDefenders?.[definition.id])
      ? persistedDefenders[definition.id]
      : {};
    const maxHp = positiveFinite(modifier.maxHp, definition.maxHp);
    const hp = clamp(nonNegativeFinite(saved.hp, maxHp), 0, maxHp);
    defenders[definition.id] = {
      id: definition.id,
      position: {...definition.position},
      maxHp,
      hp,
      damage: nonNegativeFinite(modifier.damage, definition.damage),
      attackInterval: positiveFinite(modifier.attackInterval, definition.attackInterval),
      range: nonNegativeFinite(modifier.range, definition.range),
      cooldown: nonNegativeFinite(saved.cooldown, 0),
      fallen: hp <= 0 || saved.fallen === true,
    };
    if (defenders[definition.id].fallen) defenders[definition.id].hp = 0;
  }

  return {
    version: HUB_COMBAT_STATE_VERSION,
    westPortcullisBreached: Boolean(persisted?.westPortcullisBreached),
    elapsed: nonNegativeFinite(persisted?.elapsed, 0),
    defenders,
  };
}

/** Expose surviving defenders to the Battlefield's existing bounded aggro allocator. */
export function hubDefenderAggroTargets(state, {breached = false} = {}) {
  if (breached !== true || !isPlainObject(state?.defenders)) return [];
  return Object.values(state.defenders)
    .filter(defender => defender && !defender.fallen && defender.hp > 0)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    .map(defender => ({
      playerId: `npc:${defender.id}`,
      x: defender.position.x,
      y: defender.position.y,
      z: defender.position.z,
      radius: 0.55,
      exposed: true,
      enabled: true,
      aggroRadius: 11,
      retainRadius: 14,
    }));
}

/** Return a JSON-safe run-state snapshot. */
export function serialiseHubCombatState(state) {
  const defenders = {};
  for (const definition of HUB_DEFENDER_DEFINITIONS) {
    const defender = state?.defenders?.[definition.id];
    if (!defender) continue;
    defenders[definition.id] = {
      hp: clamp(nonNegativeFinite(defender.hp, 0), 0, positiveFinite(defender.maxHp, definition.maxHp)),
      cooldown: nonNegativeFinite(defender.cooldown, 0),
      fallen: Boolean(defender.fallen) || !(defender.hp > 0),
    };
  }
  return {
    version: HUB_COMBAT_STATE_VERSION,
    westPortcullisBreached: Boolean(state?.westPortcullisBreached),
    elapsed: nonNegativeFinite(state?.elapsed, 0),
    defenders,
  };
}

/**
 * Advance NPC attacks and return deterministic event records.
 *
 * Enemy records must include `{id, x, z, zone}`. Only active records whose
 * zone is `HUB_COMBAT_COURTYARD_ZONE` are eligible. Ties resolve by stable
 * enemy ID so target choice never depends on array or renderer order.
 */
export function updateHubCombat(state, {
  deltaSeconds = 0,
  westPortcullisBreached = false,
  enemies = [],
} = {}) {
  assertState(state);
  const dt = nonNegativeFinite(deltaSeconds, 0);
  if (dt <= 0) return [];
  if (!Array.isArray(enemies)) throw new TypeError("enemies must be an array");

  state.elapsed += dt;
  state.westPortcullisBreached ||= Boolean(westPortcullisBreached);
  if (!state.westPortcullisBreached) return [];

  const candidates = enemies
    .filter(isEligibleCourtyardEnemy)
    .map((enemy) => ({
      id: enemy.id,
      x: finite(enemy.x, 0),
      y: finite(enemy.y, 1.1),
      z: finite(enemy.z, 0),
    }));
  const attacks = [];

  for (const definition of HUB_DEFENDER_DEFINITIONS) {
    const defender = state.defenders[definition.id];
    if (!defender || defender.fallen || defender.hp <= 0) continue;
    defender.cooldown = Math.max(0, defender.cooldown - dt);
    if (defender.cooldown > 0) continue;

    const target = nearestTarget(defender, candidates);
    if (!target) continue;
    defender.cooldown = defender.attackInterval;
    attacks.push({
      type: "npc-attack",
      defenderId: defender.id,
      enemyId: target.id,
      damage: defender.damage,
      origin: {
        x: defender.position.x,
        y: defender.position.y + 1.25,
        z: defender.position.z,
      },
      target: {x: target.x, y: target.y, z: target.z},
      elapsed: state.elapsed,
    });
  }

  return attacks;
}

/**
 * Apply enemy pressure to one defender. A fallen NPC cannot be healed or
 * revived through this API and remains dead after serialisation/restoration.
 */
export function damageHubDefender(state, defenderId, amount, {enemyId = null} = {}) {
  assertState(state);
  const defender = state.defenders[defenderId];
  if (!defender || defender.fallen) return null;
  const damage = nonNegativeFinite(amount, 0);
  if (damage <= 0) return null;
  defender.hp = Math.max(0, defender.hp - damage);
  const fell = defender.hp <= 0;
  if (fell) {
    defender.hp = 0;
    defender.fallen = true;
    defender.cooldown = 0;
  }
  return {
    type: fell ? "npc-fallen" : "npc-hit",
    defenderId,
    enemyId,
    damage,
    hp: defender.hp,
    fell,
    elapsed: state.elapsed,
  };
}

/**
 * Build pure enemy records from the current Battlefield public/runtime arrays.
 * This reads no renderer data and includes only active courtyard enemies.
 */
export function courtyardEnemiesFromBattlefield(battlefield) {
  if (!battlefield || typeof battlefield !== "object") {
    throw new TypeError("battlefield is required");
  }
  // Battlefield publishes ACTIVE on the instance; COURTYARD_ZONE is currently
  // a module export only, so retain its stable numeric value as an adapter
  // fallback until both constants are instance-visible.
  const active = battlefield.ACTIVE ?? 1;
  const courtyard = battlefield.COURTYARD_ZONE ?? 1;
  const enemies = [];
  for (let id = 0; id < nonNegativeInteger(battlefield.slotCount, 0); id++) {
    if (battlefield.status?.[id] !== active || battlefield.zone?.[id] !== courtyard) continue;
    enemies.push({
      id,
      x: finite(battlefield.x?.[id], 0),
      y: 1.1,
      z: finite(battlefield.z?.[id], 0),
      zone: HUB_COMBAT_COURTYARD_ZONE,
      active: true,
    });
  }
  return enemies;
}

/** Apply emitted NPC attacks through Battlefield.damageEnemy(). */
export function applyHubCombatAttacks(battlefield, attacks = []) {
  if (!battlefield || typeof battlefield.damageEnemy !== "function") {
    throw new TypeError("battlefield.damageEnemy is required");
  }
  if (!Array.isArray(attacks)) throw new TypeError("attacks must be an array");
  return attacks.map((attack) => ({
    attack,
    result: battlefield.damageEnemy(attack.enemyId, attack.damage),
  }));
}

function nearestTarget(defender, candidates) {
  const rangeSquared = defender.range * defender.range;
  let closest = null;
  let closestDistanceSquared = Number.POSITIVE_INFINITY;
  for (const enemy of candidates) {
    const dx = enemy.x - defender.position.x;
    const dz = enemy.z - defender.position.z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared > rangeSquared) continue;
    if (distanceSquared < closestDistanceSquared
      || (distanceSquared === closestDistanceSquared && compareIds(enemy.id, closest?.id) < 0)) {
      closest = enemy;
      closestDistanceSquared = distanceSquared;
    }
  }
  return closest;
}

function isEligibleCourtyardEnemy(enemy) {
  return Boolean(enemy)
    && enemy.active !== false
    && enemy.zone === HUB_COMBAT_COURTYARD_ZONE
    && (typeof enemy.id === "string" || Number.isInteger(enemy.id));
}

function compareIds(left, right) {
  if (right === undefined || right === null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right));
}

function assertState(state) {
  if (!isPlainObject(state) || !isPlainObject(state.defenders)) {
    throw new TypeError("hub combat state is required");
  }
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function nonNegativeFinite(value, fallback) {
  const number = finite(value, fallback);
  return number >= 0 ? number : fallback;
}

function positiveFinite(value, fallback) {
  const number = finite(value, fallback);
  return number > 0 ? number : fallback;
}

function nonNegativeInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) deepFreeze(child);
  }
  return value;
}

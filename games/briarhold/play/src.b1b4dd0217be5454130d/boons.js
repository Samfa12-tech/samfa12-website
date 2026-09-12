import { normaliseRunState } from "./progression.js";

export const BOON_CHOICE_COUNT = 3;
export const LEGACY_BOON_POOL_VERSION = 1;
export const BOON_POOL_VERSION = 2;

/** Concise, text-safe symbols keep boon identity available without an asset load. */
export const BOON_TYPE_ICONS = Object.freeze({
  vitality: "♥",
  offense: "⚔",
  repair: "✚",
  fortification: "◈",
  ward: "☼",
  combat: "◉",
  mobility: "➜",
  escort: "⛨",
  revival: "✦",
  foresight: "◌",
});

export function boonTypeIcon(type) {
  return BOON_TYPE_ICONS[type] ?? "✦";
}

/** Stable pool order is part of deterministic save/replay behavior. */
const LEGACY_RUN_BOON_POOL = deepFreeze([
  {
    id: "thornheart-vigor",
    type: "vitality",
    name: "Thornheart Vigor",
    description: "Gain 15 maximum Health and restore 15 Health.",
    effect: { maxHpBonus: 15 },
  },
  {
    id: "tempered-briar",
    type: "offense",
    name: "Tempered Briar",
    description: "Weapons deal 8% more damage for this run.",
    effect: { weaponDamageMultiplier: 1.08 },
  },
  {
    id: "menders-knot",
    type: "repair",
    name: "Mender's Knot",
    description: "Repairs restore 20% more integrity for this run.",
    effect: { repairEfficiencyMultiplier: 1.2 },
  },
  {
    id: "heartwood-bracing",
    type: "fortification",
    name: "Heartwood Bracing",
    description: "Every surviving gate gains 10% maximum integrity.",
    effect: { gateDurabilityMultiplier: 1.1 },
  },
  {
    id: "briarholds-breath",
    type: "repair",
    name: "Briarhold's Breath",
    description: "Restore 30 integrity to the Heart Gate.",
    effect: { heartGateRepair: 30 },
  },
]);

const CAMPAIGN_BOONS = deepFreeze([
  {id: "wardlight-covenant", type: "ward", name: "Wardlight Covenant", description: "Ward reveal and ward-lantern active duration increase by 35%.", effect: {wardRevealDurationMultiplier: 1.35, wardLanternDurationMultiplier: 1.35}},
  {id: "ashskin-binding", type: "combat", name: "Ashskin Binding", description: "Warden, NPC, and gate damage from authored fire zones is reduced by 25%.", effect: {fireZoneDamageMultiplier: 0.75}},
  {id: "hunters-patience", type: "offense", name: "Hunter's Patience", description: "Boss stagger dealt increases by 25%, without ordinary-enemy damage.", effect: {bossStaggerMultiplier: 1.25}},
  {id: "rootway-stride", type: "mobility", name: "Rootway Stride", description: "Station switching and post-mantle or slide recovery are 20% faster.", effect: {stationSwitchRecoveryMultiplier: 0.8}},
  {id: "caravan-oath", type: "escort", name: "Caravan Oath", description: "NPC and escort-objective durability increases by 30%.", effect: {npcEscortDurabilityMultiplier: 1.3}},
  {id: "twin-thorns", type: "revival", name: "Twin Thorns", description: "Gain one shared revive token each night; solo restores the Warden at 30 Health and it never mints rewards.", effect: {sharedReviveTokens: 1, soloReviveHp: 30, mintRewards: false}},
  {id: "bellglass-foresight", type: "foresight", name: "Bellglass Foresight", description: "Reveal the next wave and telegraph fixed elite or boss release ten seconds earlier.", effect: {nextWaveReveal: true, fixedReleaseTelegraphSeconds: 10}},
]);

export const RUN_BOON_POOL = deepFreeze([...LEGACY_RUN_BOON_POOL, ...CAMPAIGN_BOONS]);
const BOON_POOLS = Object.freeze({
  [LEGACY_BOON_POOL_VERSION]: LEGACY_RUN_BOON_POOL,
  [BOON_POOL_VERSION]: RUN_BOON_POOL,
});

/**
 * Return a replay-stable three-choice offer for a run and night. The result
 * depends only on runSeed, night, and the stable pool order.
 */
export function createBoonOffer(run, night = run?.night) {
  const current = normaliseRunState(run);
  assertNight(night);
  const pool = boonPoolForRun(current);
  const chosen = new Set(current.boons);
  const candidates = pool.filter((boon) => !chosen.has(boon.id));
  if (candidates.length < BOON_CHOICE_COUNT) {
    throw new Error("fewer than three unchosen run boons remain");
  }

  const shuffled = [...candidates];
  let state = mixSeed(current.runSeed, night);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = xorshift32(state);
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return Object.freeze(shuffled.slice(0, BOON_CHOICE_COUNT));
}

/**
 * Apply one offered boon. A night can record only one choice and a boon can be
 * owned only once. Immediate Health/gate effects are materialised here once;
 * weapon and repair multipliers are exposed by calculateRunBoonEffects().
 */
export function applyBoonChoice(run, boonId, night = run?.night) {
  const current = normaliseRunState(run);
  assertNight(night);
  const boon = boonPoolForRun(current).find((entry) => entry.id === boonId);
  if (!boon) throw new RangeError(`unknown run boon: ${boonId}`);
  if (current.boons.includes(boonId)) {
    throw new Error(`run boon already owned: ${boonId}`);
  }
  if (current.boonChoices[String(night)]) {
    throw new Error(`a run boon has already been chosen for night ${night}`);
  }
  if (!createBoonOffer(current, night).some((entry) => entry.id === boonId)) {
    throw new Error(`run boon was not offered for night ${night}: ${boonId}`);
  }

  const next = {
    ...current,
    player: { ...current.player },
    gates: structuredClone(current.gates),
    boons: [...current.boons, boonId],
    boonChoices: { ...current.boonChoices, [night]: boonId },
  };
  applyImmediateEffect(next, boon.effect);
  return next;
}

/** Aggregate run-only modifiers from the selected boon IDs. */
export function calculateRunBoonEffects(run) {
  const current = normaliseRunState(run);
  const effects = {
    maxHpBonus: 0,
    weaponDamageMultiplier: 1,
    repairEfficiencyMultiplier: 1,
    gateDurabilityMultiplier: 1,
    heartGateRepair: 0,
    wardRevealDurationMultiplier: 1,
    wardLanternDurationMultiplier: 1,
    fireZoneDamageMultiplier: 1,
    bossStaggerMultiplier: 1,
    stationSwitchRecoveryMultiplier: 1,
    npcEscortDurabilityMultiplier: 1,
    sharedReviveTokens: 0,
    soloReviveHp: 0,
    nextWaveReveal: false,
    fixedReleaseTelegraphSeconds: 0,
  };
  for (const boonId of current.boons) {
    const boon = boonPoolForRun(current).find((entry) => entry.id === boonId);
    if (!boon) continue;
    if (boon.effect.maxHpBonus) effects.maxHpBonus += boon.effect.maxHpBonus;
    if (boon.effect.weaponDamageMultiplier) {
      effects.weaponDamageMultiplier *= boon.effect.weaponDamageMultiplier;
    }
    if (boon.effect.repairEfficiencyMultiplier) {
      effects.repairEfficiencyMultiplier *= boon.effect.repairEfficiencyMultiplier;
    }
    if (boon.effect.gateDurabilityMultiplier) {
      effects.gateDurabilityMultiplier *= boon.effect.gateDurabilityMultiplier;
    }
    if (boon.effect.heartGateRepair) {
      effects.heartGateRepair += boon.effect.heartGateRepair;
    }
    for (const key of [
      "wardRevealDurationMultiplier", "wardLanternDurationMultiplier", "fireZoneDamageMultiplier",
      "bossStaggerMultiplier", "stationSwitchRecoveryMultiplier", "npcEscortDurabilityMultiplier",
    ]) {
      if (boon.effect[key]) effects[key] *= boon.effect[key];
    }
    if (boon.effect.sharedReviveTokens) effects.sharedReviveTokens += boon.effect.sharedReviveTokens;
    if (boon.effect.soloReviveHp) effects.soloReviveHp = Math.max(effects.soloReviveHp, boon.effect.soloReviveHp);
    if (boon.effect.nextWaveReveal) effects.nextWaveReveal = true;
    if (boon.effect.fixedReleaseTelegraphSeconds) {
      effects.fixedReleaseTelegraphSeconds = Math.max(effects.fixedReleaseTelegraphSeconds, boon.effect.fixedReleaseTelegraphSeconds);
    }
  }
  return Object.freeze(effects);
}

function boonPoolForRun(run) {
  const version = run.boonPoolVersion ?? LEGACY_BOON_POOL_VERSION;
  const pool = BOON_POOLS[version];
  if (!pool) throw new RangeError(`unsupported boon pool version: ${version}`);
  return pool;
}

function applyImmediateEffect(run, effect) {
  if (effect.maxHpBonus) {
    run.player.maxHp += effect.maxHpBonus;
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + effect.maxHpBonus);
  }
  if (effect.gateDurabilityMultiplier) {
    for (const gate of Object.values(run.gates)) {
      if (!gate || !Number.isFinite(gate.maxIntegrity)) continue;
      const bonus = Math.round(
        gate.maxIntegrity * (effect.gateDurabilityMultiplier - 1),
      );
      gate.maxIntegrity += bonus;
      if (Number.isFinite(gate.integrity) && gate.integrity > 0) {
        gate.integrity = Math.min(gate.maxIntegrity, gate.integrity + bonus);
      }
    }
  }
  if (effect.heartGateRepair) {
    const heartGate = Object.entries(run.gates).find(
      ([id, gate]) => id === "heart" || gate?.kind === "heart",
    )?.[1];
    if (heartGate && Number.isFinite(heartGate.integrity)) {
      heartGate.integrity = Math.min(
        heartGate.maxIntegrity,
        heartGate.integrity + effect.heartGateRepair,
      );
      if (heartGate.integrity > 0 && "destroyed" in heartGate) {
        heartGate.destroyed = false;
      }
    }
  }
}

function mixSeed(runSeed, night) {
  let value = (runSeed ^ Math.imul(night, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  value ^= value >>> 16;
  return value || 0x6d2b79f5;
}

function xorshift32(value) {
  let next = value >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}

function assertNight(night) {
  if (!Number.isInteger(night) || night < 1) {
    throw new RangeError("boon night must be a positive integer");
  }
}

function deepFreeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}

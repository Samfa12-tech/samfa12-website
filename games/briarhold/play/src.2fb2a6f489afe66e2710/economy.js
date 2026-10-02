import {resolveNpcSystemAccess} from "./hub.js";

/**
 * Deterministic campaign economy helpers.
 *
 * Supplies are earned and spent inside one campaign. Oathmarks survive failed
 * campaigns and unlock sidegrades rather than permanent damage multipliers.
 */

export const STARTING_SUPPLIES = 120;

export const SUPPLY_REWARD_RATES = Object.freeze({
  nightCompletion: 45,
  assaultClearance: 12,
  eliteKill: 6,
  optionalObjective: 30,
});

export const OATHMARK_REWARD_RATES = Object.freeze({
  waveClear: 1,
  nightCompletion: 2,
  optionalObjective: 1,
  bossDefeat: 3,
  campaignCompletion: 5,
  firstNightOneHold: 3,
});

export const REPAIR_INTEGRITY_PER_SUPPLY = 4;
export const EMERGENCY_PALISADE_COST = 75;
export const EMERGENCY_PALISADE_STRENGTH = 0.35;

export const OATHMARK_UNLOCKS = Object.freeze([
  Object.freeze({
    id: "warden-focus",
    name: "Warden Focus",
    cost: 4,
    kind: "character-unlock",
    description: "Permanently unlock aim-down-sights with LT, right mouse, Q, or the touch Aim control.",
  }),
  Object.freeze({
    id: "sunfire-prism",
    name: "Sunfire Prism",
    cost: 3,
    kind: "weapon-unlock",
    weaponId: "sunfire",
    description: "Permanently commission the Sunfire projector for future runs.",
  }),
  Object.freeze({
    id: "split-runebolt",
    name: "Runebolt Sigil",
    cost: 8,
    kind: "weapon-unlock",
    weaponId: "runebolt",
    requires: Object.freeze(["sunfire-prism"]),
    description: "After commissioning Sunfire, permanently commission the Runebolt launcher for future runs.",
  }),
  Object.freeze({
    id: "resin-snare",
    name: "Resin Snare",
    cost: 3,
    kind: "trap-recipe",
    description: "Unlock a slowing snare that is vulnerable to fire.",
  }),
  Object.freeze({
    id: "warded-barricade",
    name: "Warded Barricade",
    cost: 5,
    kind: "fortification-recipe",
    description: "Unlock a barricade that reveals nearby spectral enemies.",
  }),
  Object.freeze({
    id: "quartermaster-oath",
    name: "Quartermaster's Oath",
    cost: 4,
    kind: "starting-option",
    description: "Choose one additional basic fortification recipe at dawn one.",
  }),
]);

/**
 * @typedef {object} NightRewardInput
 * @property {boolean} [completed]
 * @property {number} [assaultsCleared]
 * @property {number} [elitesKilled]
 * @property {boolean} [optionalObjectiveCompleted]
 * @property {boolean} [campaignCompleted]
 * @property {boolean} [bossDefeated]
 */

/**
 * Calculate an itemised reward without mutating campaign state.
 *
 * @param {NightRewardInput} result
 * @param {Partial<typeof SUPPLY_REWARD_RATES>} [supplyRates]
 * @returns {{
 *   supplies: number,
 *   oathmarks: number,
 *   breakdown: {
 *     completion: number,
 *     clearance: number,
 *     elites: number,
 *     objective: number,
 *   }
 * }}
 */
export function calculateNightRewards(result = {}, supplyRates = {}) {
  const rates = { ...SUPPLY_REWARD_RATES, ...supplyRates };
  const assaultsCleared = toNonNegativeInteger(
    result.assaultsCleared,
    "assaultsCleared",
  );
  const elitesKilled = toNonNegativeInteger(
    result.elitesKilled,
    "elitesKilled",
  );

  const breakdown = {
    completion: result.completed ? rates.nightCompletion : 0,
    clearance: assaultsCleared * rates.assaultClearance,
    elites: elitesKilled * rates.eliteKill,
    objective: result.optionalObjectiveCompleted
      ? rates.optionalObjective
      : 0,
  };

  return Object.freeze({
    supplies:
      breakdown.completion +
      breakdown.clearance +
      breakdown.elites +
      breakdown.objective,
    // Oathmarks are host ledger events in progression.js; this legacy
    // Supplies helper intentionally cannot mint permanent rewards.
    oathmarks: 0,
    breakdown: Object.freeze(breakdown),
  });
}

/**
 * @param {number} integrity
 * @returns {number}
 */
export function repairSupplyCost(integrity) {
  if (!Number.isFinite(integrity) || integrity < 0) {
    throw new RangeError("repair integrity must be a non-negative number");
  }
  return Math.ceil(integrity / REPAIR_INTEGRITY_PER_SUPPLY);
}

/**
 * Clamp a repair request to the affordable and missing integrity.
 *
 * @param {{requestedIntegrity: number, missingIntegrity: number, supplies: number}} input
 * @returns {{integrity: number, cost: number}}
 */
export function quoteAffordableRepair(input) {
  const requested = toNonNegativeInteger(
    input.requestedIntegrity,
    "requestedIntegrity",
  );
  const missing = toNonNegativeInteger(
    input.missingIntegrity,
    "missingIntegrity",
  );
  const supplies = toNonNegativeInteger(input.supplies, "supplies");
  const affordableIntegrity = supplies * REPAIR_INTEGRITY_PER_SUPPLY;
  const integrity = Math.min(requested, missing, affordableIntegrity);
  return Object.freeze({ integrity, cost: repairSupplyCost(integrity) });
}

/**
 * Purchase a permanent sidegrade from an account-level profile.
 *
 * @param {{oathmarks?: number, unlocks?: string[]}} profile
 * @param {string} unlockId
 * @returns {{oathmarks: number, unlocks: string[]}}
 */
export function purchaseOathmarkUnlock(profile, unlockId, options = {}) {
  if ((options.role ?? "host") !== "host") throw new Error("progression mutation is host-owned");
  const unlock = OATHMARK_UNLOCKS.find((entry) => entry.id === unlockId);
  if (!unlock) {
    throw new RangeError(`unknown Oathmark unlock: ${unlockId}`);
  }

  const current = normaliseProgressionProfile(profile);
  if (current.unlocks.includes(unlockId)) {
    throw new Error(`Oathmark unlock already owned: ${unlockId}`);
  }
  if (["resin-snare", "warded-barricade", "quartermaster-oath"].includes(unlockId)) {
    throw new Error(`${unlockId} is not available for new purchases`);
  }
  const access = resolveNpcSystemAccess(profile, options.run);
  if (!access.purchases[unlockId]) {
    throw new Error(`${unlockId} requires a living Quartermaster and the required relationship`);
  }
  const missingRequirement = missingOathmarkUnlockRequirement(unlock, current.unlocks);
  if (missingRequirement) {
    throw new Error(`${unlockId} requires Oathmark unlock: ${missingRequirement}`);
  }
  if (current.oathmarks < unlock.cost) {
    throw new Error(`not enough Oathmarks for ${unlockId}`);
  }

  return {
    oathmarks: current.oathmarks - unlock.cost,
    unlocks: [...current.unlocks, unlockId].sort(),
  };
}

/** Purchase an NPC-owned commission while preserving the run living-roster gate. */
export function purchaseForNpc(profile, run, unlockId, options = {}) {
  return purchaseOathmarkUnlock(profile, unlockId, {...options, run});
}

/** Return the first unmet prerequisite for a permanent unlock, if any. */
export function missingOathmarkUnlockRequirement(unlock, ownedUnlocks = []) {
  const owned = ownedUnlocks instanceof Set ? ownedUnlocks : new Set(ownedUnlocks);
  return unlock?.requires?.find((requiredId) => !owned.has(requiredId)) ?? null;
}

/**
 * @param {{oathmarks?: number, unlocks?: string[]}|undefined|null} profile
 * @returns {{oathmarks: number, unlocks: string[]}}
 */
export function normaliseProgressionProfile(profile) {
  const oathmarks = toNonNegativeInteger(profile?.oathmarks, "oathmarks");
  const unlocks = Array.isArray(profile?.unlocks)
    ? [...new Set(profile.unlocks)].filter(isNonEmptyString).sort()
    : [];
  return { oathmarks, unlocks };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function toNonNegativeInteger(value, name) {
  const normalised = value ?? 0;
  if (
    !Number.isFinite(normalised) ||
    normalised < 0 ||
    !Number.isInteger(normalised)
  ) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
  return normalised;
}

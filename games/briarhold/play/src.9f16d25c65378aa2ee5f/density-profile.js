import {DENSITY_PROFILE_IDS} from "./contracts.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export const DENSITY_PROFILES = deepFreeze({
  [DENSITY_PROFILE_IDS.MOBILE]: {
    id: DENSITY_PROFILE_IDS.MOBILE,
    concurrentBodyTarget: 2000,
    hunterCap: 12,
    rendererUpdateBudget: 700,
    visualSubdivision: 1,
  },
  [DENSITY_PROFILE_IDS.DESKTOP]: {
    id: DENSITY_PROFILE_IDS.DESKTOP,
    concurrentBodyTarget: 6000,
    hunterCap: 24,
    rendererUpdateBudget: 1800,
    visualSubdivision: 3,
  },
});

export function resolveDensityProfile(value = DENSITY_PROFILE_IDS.DESKTOP) {
  const id = typeof value === "string"
    ? value
    : value?.id ?? (value?.mobile || value?.coarsePointer ? DENSITY_PROFILE_IDS.MOBILE : DENSITY_PROFILE_IDS.DESKTOP);
  return DENSITY_PROFILES[id] ?? DENSITY_PROFILES[DENSITY_PROFILE_IDS.DESKTOP];
}

function finiteBudget(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function positiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function allocateLargestRemainder(groups, bodyBudget) {
  if (groups.length === 0) return [];
  if (bodyBudget < groups.length) {
    throw new RangeError("targetBodies must leave at least one body for every ordinary threat group");
  }
  const totalWeight = groups.reduce((sum, group) => sum + group.weight, 0);
  const allocations = groups.map((group, index) => {
    const exact = totalWeight > 0 ? bodyBudget * group.weight / totalWeight : bodyBudget / groups.length;
    const floor = Math.floor(exact);
    return {index, count: Math.max(1, floor), remainder: exact - floor};
  });
  let unallocated = bodyBudget - allocations.reduce((sum, allocation) => sum + allocation.count, 0);
  if (unallocated > 0) {
    allocations.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (let index = 0; index < unallocated; index++) allocations[index % allocations.length].count++;
  } else if (unallocated < 0) {
    allocations.sort((a, b) => a.remainder - b.remainder || b.count - a.count || b.index - a.index);
    while (unallocated < 0) {
      const allocation = allocations.find((candidate) => candidate.count > 1);
      if (!allocation) throw new RangeError("Unable to allocate at least one body per ordinary group");
      allocation.count--;
      unallocated++;
    }
  }
  allocations.sort((a, b) => a.index - b.index);
  return allocations.map((allocation) => allocation.count);
}

/**
 * Expands ordinary authored threat into platform-specific visible bodies while
 * preserving HP, gate-pressure, reward and threat totals. Elite, boss and
 * hunter groups retain authored counts on every platform.
 *
 * Group shape:
 * {id, archetype, threatMass, hpBudget, gatePressureBudget, rewardBudget,
 *  count?, elite?, boss?, hunter?, visualWeight?}
 */
export function subdivideThreatMass(
  groups,
  profileValue = DENSITY_PROFILE_IDS.DESKTOP,
  {targetBodies} = {},
) {
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new TypeError("subdivideThreatMass requires at least one threat group");
  }
  const profile = resolveDensityProfile(profileValue);
  const limit = positiveInteger(targetBodies, profile.concurrentBodyTarget);
  const normalized = groups.map((group, index) => {
    if (!group?.id || !group?.archetype) {
      throw new TypeError(`Threat group ${index} requires id and archetype`);
    }
    const fixed = Boolean(group.elite || group.boss || group.hunter || group.fixedCount);
    const count = fixed ? positiveInteger(group.count, 1) : 0;
    return {
      source: group,
      fixed,
      count,
      weight: Math.max(1e-9, finiteBudget(group.visualWeight, finiteBudget(group.threatMass, 1))),
    };
  });
  const hunterCount = normalized
    .filter((group) => group.source.hunter)
    .reduce((sum, group) => sum + group.count, 0);
  if (hunterCount > profile.hunterCap) {
    throw new RangeError(`Authored hunter count ${hunterCount} exceeds ${profile.id} cap ${profile.hunterCap}`);
  }
  const fixedBodies = normalized.reduce((sum, group) => sum + group.count, 0);
  if (fixedBodies > limit) throw new RangeError("Fixed elite/hunter/boss bodies exceed targetBodies");
  const ordinary = normalized.filter((group) => !group.fixed);
  const ordinaryCounts = allocateLargestRemainder(ordinary, limit - fixedBodies);
  let ordinaryIndex = 0;

  const outputGroups = normalized.map((group) => {
    const bodyCount = group.fixed ? group.count : ordinaryCounts[ordinaryIndex++];
    const threatMass = finiteBudget(group.source.threatMass);
    const hpBudget = finiteBudget(group.source.hpBudget, threatMass);
    const gatePressureBudget = finiteBudget(group.source.gatePressureBudget, threatMass);
    const rewardBudget = finiteBudget(group.source.rewardBudget);
    return deepFreeze({
      id: group.source.id,
      archetype: group.source.archetype,
      bodyCount,
      fixedCount: group.fixed,
      elite: Boolean(group.source.elite),
      boss: Boolean(group.source.boss),
      hunter: Boolean(group.source.hunter),
      threatMass,
      threatMassPerBody: threatMass / bodyCount,
      hpBudget,
      hpPerBody: hpBudget / bodyCount,
      gatePressureBudget,
      gatePressurePerBody: gatePressureBudget / bodyCount,
      rewardBudget,
      rewardPerBody: rewardBudget / bodyCount,
    });
  });

  return deepFreeze({
    profile,
    targetBodies: limit,
    bodyCount: outputGroups.reduce((sum, group) => sum + group.bodyCount, 0),
    fixedBodyCount: fixedBodies,
    groups: outputGroups,
    totals: {
      threatMass: outputGroups.reduce((sum, group) => sum + group.threatMass, 0),
      hpBudget: outputGroups.reduce((sum, group) => sum + group.hpBudget, 0),
      gatePressureBudget: outputGroups.reduce((sum, group) => sum + group.gatePressureBudget, 0),
      rewardBudget: outputGroups.reduce((sum, group) => sum + group.rewardBudget, 0),
    },
  });
}

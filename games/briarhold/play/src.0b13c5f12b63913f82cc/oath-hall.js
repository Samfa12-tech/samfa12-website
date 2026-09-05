import {
  BELLKEEPER_WATCH_TRACK,
  MASTERY_TIER_COSTS,
  MASTERY_TIER_GATES,
  PERMANENT_RANK_TRACKS,
  PROGRESSION_ROLE,
  WARDEN_BRANCH_TIERS,
  WEAPON_IDS,
  WEAPON_MASTERY_CHOICES,
  bindWeaponMastery,
  normaliseProfileState,
  purchasePermanentRank,
  purchaseWardenBranch,
  rebindWardenBranch,
  resolveNpcSystemAccess,
} from "./progression.js";
import {
  OATHMARK_UNLOCKS,
  missingOathmarkUnlockRequirement,
  purchaseOathmarkUnlock,
} from "./economy.js";
import {relationshipRankCeiling} from "./relationship-goals.js";

const FOUNDATION_TRACKS = PERMANENT_RANK_TRACKS.filter(
  (track) => track.id !== BELLKEEPER_WATCH_TRACK.id,
);

export function createOathHallModel(profile, options = {}) {
  const current = normaliseProfileState(profile);
  const access = resolveNpcSystemAccess(current, options.run);
  const readOnly = options.role === PROGRESSION_ROLE.GUEST;
  const rankRow = (track) => {
    const rank = current.ranks[track.id];
    const authoredCeiling = relationshipRankCeiling(
      rankOwner(track.id),
      access.relationships[rankOwner(track.id)] ?? "new",
    );
    const ceiling = Math.min(track.maxRank, authoredCeiling, access.rankCeilings[track.id] ?? 0);
    const maximum = rank >= ceiling;
    const relationshipLocked = maximum && ceiling < track.maxRank;
    const cost = maximum ? null : track.costs[rank];
    return {
      id: track.id,
      title: track.name,
      detail: `Rank ${rank} / ${ceiling}${ceiling < track.maxRank ? ` · ${access.relationships[rankOwner(track.id)]} relationship ceiling` : ""}`,
      description: `Permanent upgrade: ${describeEffect(track.effect, track.amountPerRank)} per rank.`,
      cost,
      actionId: `rank:${track.id}`,
      disabled: readOnly || maximum || current.oathmarks < cost,
      status: relationshipLocked ? "locked" : maximum ? "complete" : rank > 0 ? "owned" : cost > current.oathmarks ? "locked" : "available",
      rank,
      maxRank: ceiling,
      actionLabel: relationshipLocked ? "Deepen this relationship first" : maximum ? "Fully sworn" : `Raise to rank ${rank + 1}`,
      readOnly,
    };
  };
  const wardenRows = WARDEN_BRANCH_TIERS.flatMap((tier) => tier.options.map((option) => {
    const owned = current.wardenBranches.owned.includes(option.id);
    const active = current.wardenBranches.active[String(tier.tier)] === option.id;
    const rebind = owned && !active;
    const unavailable = option.id === "warden-focus" && !owned && !access.purchases["warden-focus"];
    const cost = rebind ? 1 : owned ? 0 : tier.cost;
    return {
      id: option.id,
      title: option.name,
      detail: active ? `Tier ${tier.tier} · Active` : owned ? `Tier ${tier.tier} · Owned` : `Tier ${tier.tier}`,
      description: `Permanent Warden behaviour: ${describeWardenEffects(option.effects)}.`,
      cost,
      actionId: `warden:${tier.tier}:${option.id}`,
      disabled: readOnly || unavailable || active || current.oathmarks < cost || (rebind && options.terminalBoundary !== true),
      status: active ? "active" : owned ? "owned" : unavailable ? "locked" : "available",
      tier: tier.tier,
      actionLabel: active ? "Currently bound" : rebind ? "Rebind for 1 Oathmark" : `Swear for ${cost} Oathmarks`,
      readOnly,
    };
  }));
  const commissionRows = OATHMARK_UNLOCKS.filter((unlock) => (
    current.unlocks.includes(unlock.id)
      || !["resin-snare", "warded-barricade", "quartermaster-oath"].includes(unlock.id)
  )).map((unlock) => {
    const owned = current.unlocks.includes(unlock.id);
    const missing = missingOathmarkUnlockRequirement(unlock, current.unlocks);
    return {
      id: unlock.id,
      title: unlock.name,
      detail: owned ? "Owned" : missing ? `Requires ${humanise(missing)}` : access.purchases[unlock.id] ? unlock.description : "Requires a living Quartermaster and the required relationship",
      description: `Permanent commission: ${unlock.description}`,
      cost: owned ? 0 : unlock.cost,
      actionId: `commission:${unlock.id}`,
      disabled: readOnly || owned || !access.purchases[unlock.id] || Boolean(missing) || current.oathmarks < unlock.cost,
      status: owned ? "owned" : (!access.purchases[unlock.id] || missing) ? "locked" : "available",
      prerequisiteId: unlock.requires?.[0] ?? null,
      actionLabel: owned ? "Commissioned" : `Commission for ${unlock.cost} Oathmarks`,
      readOnly,
    };
  });
  const masteryRows = WEAPON_IDS.flatMap((weaponId) => WEAPON_MASTERY_CHOICES[weaponId]
    .flatMap((choices, tierIndex) => choices.map((choiceId) => {
      const mastery = current.weaponMastery[weaponId];
      const active = mastery.active[String(tierIndex + 1)] === choiceId;
      const owned = mastery.owned.includes(choiceId);
      const cost = owned ? 0 : MASTERY_TIER_COSTS[tierIndex];
      const gate = MASTERY_TIER_GATES[tierIndex];
      return {
        id: choiceId,
        title: humanise(choiceId.replace(`${weaponId}-`, "")),
        detail: `${humanise(weaponId)} Tier ${tierIndex + 1} · ${mastery.xp} / ${gate} XP${active ? " · Active" : owned ? " · Owned" : ""}`,
        description: `Permanent ${humanise(weaponId)} mastery: ${humanise(choiceId.replace(`${weaponId}-`, ""))}.`,
        cost,
        status: active ? "active" : owned ? "owned" : mastery.xp < gate || current.oathmarks < cost ? "locked" : "available",
        actionId: `mastery:${weaponId}:${tierIndex + 1}:${choiceId}`,
        disabled: readOnly || active || mastery.xp < gate || current.oathmarks < cost,
        tier: tierIndex + 1,
        weaponId,
        xp: mastery.xp,
        xpGate: gate,
        actionLabel: active ? "Currently bound" : owned ? "Bind mastery" : `Learn for ${cost} Oathmarks`,
        readOnly,
      };
    })));
  return {
    oathmarks: current.oathmarks,
    readOnly,
    tabs: [
      {id: "foundations", title: "Foundations", sectionIds: ["foundation", "bellkeeper"]},
      {id: "warden", title: "Warden", sectionIds: ["warden"]},
      {id: "commissions", title: "Commissions", sectionIds: ["commissions"]},
      {id: "weapon-mastery", title: "Weapon Mastery", sectionIds: ["mastery"]},
    ],
    sections: [
      {id: "foundation", title: "Foundation ranks", rows: FOUNDATION_TRACKS.map(rankRow)},
      {id: "bellkeeper", title: "Bellkeeper's Watch", rows: [rankRow(BELLKEEPER_WATCH_TRACK)]},
      {id: "commissions", title: "Existing commissions", rows: commissionRows},
      {id: "warden", title: "Warden behavior", rows: wardenRows},
      {id: "mastery", title: "Weapon mastery", rows: masteryRows},
    ],
  };
}

function describeEffect(effect, amount) {
  const names = {
    maxHpMultiplier: "increase maximum health",
    weaponDamageMultiplier: "increase weapon damage",
    startingSuppliesBonus: "increase starting Supplies",
    gateDurabilityMultiplier: "increase gate durability",
    repairEfficiencyMultiplier: "increase repair efficiency",
    bellkeeperWatch: "improve Bellkeeper support",
  };
  const suffix = effect.endsWith("Multiplier") ? ` by ${Math.round(amount * 100)}%` : ` by ${amount}`;
  return `${names[effect] ?? humanise(effect)}${suffix}`;
}

function describeWardenEffects(effects) {
  const descriptions = {
    ads: () => "aim down sights for deliberate shots",
    reticle: () => "tighten the reticle while aiming",
    look: () => "slow turning while aiming for finer control",
    slideMantleRecoveryMultiplier: (value) => `recover ${Math.round((1 - value) * 100)}% faster after sliding or mantling`,
    adsVisualRecoilMultiplier: (value) => `reduce visible recoil by ${Math.round((1 - value) * 100)}% while aiming`,
    weaponSwapMultiplier: (value) => `switch weapons ${Math.round((1 - value) * 100)}% faster`,
    overheatRecoveryStartMultiplier: (value) => `begin recovering from overheat ${Math.round((1 - value) * 100)}% sooner`,
    npcStaggerResistanceMultiplier: (value) => `nearby defenders resist ${Math.round((value - 1) * 100)}% more stagger`,
    breachRallySeconds: (value) => `rally nearby defenders for ${value} seconds after a breach`,
    adsMoveSpeedMultiplier: (value) => `move at ${Math.round(value * 100)}% speed while aiming`,
    stationSwitchRecoveryMultiplier: (value) => `recover ${Math.round((1 - value) * 100)}% faster after switching stations`,
    firstShotAfterSwitchDamageMultiplier: (value) => `the first shot after switching deals ${Math.round((value - 1) * 100)}% more damage`,
    sprintStaminaMultiplier: (value) => `sprinting costs ${Math.round((1 - value) * 100)}% less stamina`,
    mantleRecoveryMultiplier: (value) => `recover ${Math.round((1 - value) * 100)}% faster after mantling`,
    slideRecoveryMultiplier: (value) => `recover ${Math.round((1 - value) * 100)}% faster after sliding`,
    lowHealthHandlingSurgeSeconds: (value) => `gain steadier handling for ${value} seconds when badly wounded`,
    lowHealthHandlingSurgesPerNight: (value) => `this safeguard can trigger ${value === 1 ? "once" : `${value} times`} each night`,
    lowHealthMoveSpeedMultiplier: (value) => `move ${Math.round((value - 1) * 100)}% faster while badly wounded`,
    reviveMoveSpeedMultiplier: (value) => `move ${Math.round((value - 1) * 100)}% faster while reviving`,
    reviveDamageResistance: (value) => `take ${Math.round(value * 100)}% less damage while reviving`,
    reviveSpeedMultiplier: (value) => `revive allies ${Math.round((value - 1) * 100)}% faster`,
  };
  return Object.entries(effects).map(([key, value]) => descriptions[key]?.(value) ?? humanise(key)).join("; ");
}

export function applyOathHallAction(profile, actionId, options = {}) {
  const role = options.role ?? PROGRESSION_ROLE.HOST;
  if (role === PROGRESSION_ROLE.GUEST) throw new Error("guest Oath Hall state is read-only");
  const [kind, first, second, ...rest] = String(actionId).split(":");
  if (kind === "rank" && first) return purchasePermanentRank(profile, first, {role, run: options.run});
  if (kind === "commission" && first) {
    const current = normaliseProfileState(profile);
    if (current.unlocks.includes(first)) return current;
    const purchased = purchaseOathmarkUnlock(current, first, {role, run: options.run});
    const next = normaliseProfileState({...current, ...purchased});
    if (first !== "warden-focus") return next;
    return normaliseProfileState({
      ...next,
      wardenBranches: {
        owned: [...new Set([...next.wardenBranches.owned, "warden-focus"])],
        active: {...next.wardenBranches.active, 1: "warden-focus"},
      },
    });
  }
  if (kind === "warden" && first && second) {
    const tier = Number(first);
    const current = normaliseProfileState(profile);
    if (current.wardenBranches.owned.includes(second)) {
      if (current.wardenBranches.active[String(tier)] === second) return current;
      return rebindWardenBranch(current, tier, second, {
        role,
        terminalBoundary: options.terminalBoundary === true,
      });
    }
    return purchaseWardenBranch(current, tier, second, {role, run: options.run});
  }
  if (kind === "mastery" && first && second && rest.length) {
    return bindWeaponMastery(profile, first, Number(second), rest.join(":"), {role});
  }
  throw new RangeError(`unknown Oath Hall action: ${actionId}`);
}

function humanise(value) {
  return value.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function rankOwner(trackId) {
  return {
    "bellkeepers-watch": "bellkeeper",
    "masons-oath": "mason",
    "armory-temper": "quartermaster",
    quartermaster: "quartermaster",
    "field-craft": "trapper",
    "wardens-vigor": "greenwarden",
  }[trackId] ?? "unknown";
}

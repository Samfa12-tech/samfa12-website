/**
 * Account-level progression and run-local roguelite state.
 *
 * This module deliberately has no renderer, campaign, or storage dependencies.
 * Callers can therefore exercise every economy and failure rule deterministically.
 */

import {
  HUB_NPC_IDS,
  HUB_NPC_UNLOCK_ORDER,
  createHubStateForRun,
  nextMissingHubNpcId,
  normaliseFallenNpcs,
  normaliseHubState,
  normaliseHubUnlocks,
  resolveNpcSystemAccess,
} from "./hub.js";
import {
  OATHMARK_REWARD_RATES,
  OATHMARK_UNLOCKS,
  missingOathmarkUnlockRequirement,
} from "./economy.js";
import {CAMPAIGN_WAVES} from "./campaign-content.js";
import {restoreBossDirector, serialiseBossDirector} from "./boss-director.js";
import {GAME_PHASES} from "./contracts.js";
import {
  normaliseNarrativeProfileState,
  normaliseNarrativeRunState,
} from "./narrative-state.js";
import {
  RELATIONSHIP_GOALS,
  RELATIONSHIP_STATUSES,
  relationshipRankCeiling,
} from "./relationship-goals.js";

// Keep the historical progression export as a compatibility re-export while
// making contracts.js the single phase authority.
export {GAME_PHASES};
export {resolveNpcSystemAccess};
export {RELATIONSHIP_GOALS, RELATIONSHIP_STATUSES, relationshipRankCeiling};

export const PROFILE_STATE_VERSION = 4;
export const RUN_STATE_VERSION = 4;
export const BELLKEEPER_BRIEFING_SCENE_IDS = Object.freeze([
  "night-1-bellkeeper-briefing",
  "night-2-bellkeeper-briefing",
  "night-3-bellkeeper-briefing",
  "night-4-bellkeeper-briefing",
  "night-5-bellkeeper-briefing",
  "night-6-bellkeeper-briefing",
  "night-7-bellkeeper-briefing",
]);

/** Resolve the one authored Bellkeeper briefing that can authorise a night. */
export function bellkeeperBriefingSceneId(night) {
  const currentNight = toBoundedInteger(night, "Bellkeeper briefing night", 1, 7);
  return BELLKEEPER_BRIEFING_SCENE_IDS[currentNight - 1];
}

const RELATIONSHIP_STATUS_INDEX = new Map(RELATIONSHIP_STATUSES.map((status, index) => [status, index]));
const RELATIONSHIP_GOAL_IDS_BY_NPC = Object.freeze(Object.fromEntries(
  HUB_NPC_UNLOCK_ORDER.map((npcId) => [
    npcId,
    RELATIONSHIP_GOALS.filter((goal) => goal.npcId === npcId).map((goal) => goal.id),
  ]),
));
const RELATIONSHIP_RANK_TRACKS = Object.freeze({
  [HUB_NPC_IDS.BELLKEEPER]: ["bellkeepers-watch"],
  [HUB_NPC_IDS.MASON]: ["masons-oath"],
  [HUB_NPC_IDS.QUARTERMASTER]: ["quartermaster", "armory-temper"],
  [HUB_NPC_IDS.TRAPPER]: ["field-craft"],
  [HUB_NPC_IDS.GREENWARDEN]: ["wardens-vigor"],
});

export const RANK_COSTS = Object.freeze([3, 5, 8, 12, 17]);
export const MAX_PERMANENT_RANK = RANK_COSTS.length;

export const RANK_TRACK_IDS = Object.freeze({
  WARDENS_VIGOR: "wardens-vigor",
  ARMORY_TEMPER: "armory-temper",
  QUARTERMASTER: "quartermaster",
  MASONS_OATH: "masons-oath",
  FIELD_CRAFT: "field-craft",
  BELLKEEPERS_WATCH: "bellkeepers-watch",
});

export const PERMANENT_RANK_TRACKS = deepFreeze([
  {
    id: RANK_TRACK_IDS.WARDENS_VIGOR,
    name: "Warden's Vigor",
    effect: "maxHpMultiplier",
    amountPerRank: 0.05,
    maxRank: MAX_PERMANENT_RANK,
    costs: RANK_COSTS,
  },
  {
    id: RANK_TRACK_IDS.ARMORY_TEMPER,
    name: "Armory Temper",
    effect: "weaponDamageMultiplier",
    amountPerRank: 0.03,
    maxRank: MAX_PERMANENT_RANK,
    costs: RANK_COSTS,
  },
  {
    id: RANK_TRACK_IDS.QUARTERMASTER,
    name: "Quartermaster",
    effect: "startingSuppliesBonus",
    amountPerRank: 10,
    maxRank: MAX_PERMANENT_RANK,
    costs: RANK_COSTS,
  },
  {
    id: RANK_TRACK_IDS.MASONS_OATH,
    name: "Mason's Oath",
    effect: "gateDurabilityMultiplier",
    amountPerRank: 0.04,
    maxRank: MAX_PERMANENT_RANK,
    costs: RANK_COSTS,
  },
  {
    id: RANK_TRACK_IDS.FIELD_CRAFT,
    name: "Field Craft",
    effect: "repairEfficiencyMultiplier",
    amountPerRank: 0.05,
    maxRank: MAX_PERMANENT_RANK,
    costs: RANK_COSTS,
  },
  {
    id: RANK_TRACK_IDS.BELLKEEPERS_WATCH,
    name: "Bellkeeper's Watch",
    effect: "bellkeeperWatch",
    amountPerRank: 1,
    maxRank: 3,
    costs: [3, 5, 8],
  },
]);

export const BELLKEEPER_WATCH_TRACK = PERMANENT_RANK_TRACKS.find(
  (track) => track.id === RANK_TRACK_IDS.BELLKEEPERS_WATCH,
);

export const PROGRESSION_ROLE = Object.freeze({HOST: "host", GUEST: "guest"});
export const FIRST_NIGHT_ONE_HOLD_OATHMARKS = 3;
export const MASTERY_TIER_GATES = Object.freeze([50, 150, 300]);
export const MASTERY_TIER_COSTS = Object.freeze([2, 4, 6]);
export const WEAPON_IDS = Object.freeze(["arbalest", "sunfire", "runebolt"]);

export const WARDEN_BRANCH_TIERS = deepFreeze([
  {tier: 1, cost: 4, options: [
    {id: "warden-focus", name: "Warden Focus", effects: {ads: true, reticle: "tighter", look: "slower"}},
    {id: "field-step", name: "Field Step", effects: {slideMantleRecoveryMultiplier: 0.8}},
  ]},
  {tier: 2, cost: 5, options: [
    {id: "steady-breath", name: "Steady Breath", effects: {adsVisualRecoilMultiplier: 0.8}},
    {id: "quick-hands", name: "Quick Hands", effects: {weaponSwapMultiplier: 0.85, overheatRecoveryStartMultiplier: 0.85}},
  ]},
  {tier: 3, cost: 7, options: [
    {id: "last-oath", name: "Last Oath", effects: {lowHealthHandlingSurgeSeconds: 4, lowHealthHandlingSurgesPerNight: 1}},
    {id: "courtyard-rally", name: "Courtyard Rally", effects: {npcStaggerResistanceMultiplier: 1.2, breachRallySeconds: 6}},
  ]},
]);

export const WEAPON_MASTERY_CHOICES = deepFreeze({
  arbalest: [
    ["arbalest-faster-bolt-cycle", "arbalest-heavy-stagger"],
    ["arbalest-charged-precision", "arbalest-quick-hip-fire-follow-up"],
    ["arbalest-armour-pin", "arbalest-kill-confirm-heat-refund"],
  ],
  sunfire: [
    ["sunfire-reduced-heat-gain", "sunfire-faster-cooldown"],
    ["sunfire-narrow-long-range-beam", "sunfire-wide-close-range-sweep"],
    ["sunfire-manual-vent-burst", "sunfire-controlled-overheat-window"],
  ],
  runebolt: [
    ["runebolt-faster-tighter-projectile", "runebolt-larger-weaker-splash"],
    ["runebolt-direct-hit-armour-crack", "runebolt-terrain-ricochet"],
    ["runebolt-delayed-cluster-split", "runebolt-controlled-gravity-pulse"],
  ],
});

/** Declarative, renderer-independent effects for every named mastery choice. */
export const WEAPON_MASTERY_EFFECTS = deepFreeze({
  "arbalest-faster-bolt-cycle": {boltCycle: "faster", runtime: {status: "live", modifiers: {shotIntervalMultiplier: 0.85}}},
  "arbalest-heavy-stagger": {stagger: "heavier", runtime: {status: "live", modifiers: {directStaggerSeconds: 0.35}}},
  "arbalest-charged-precision": {chargedBolt: "precision", runtime: {status: "live", modifiers: {adsDamageMultiplier: 1.45, adsShotIntervalMultiplier: 1.35}}},
  "arbalest-quick-hip-fire-follow-up": {hipFireFollowUp: "quick", runtime: {status: "live", modifiers: {hipShotIntervalMultiplier: 0.82}}},
  "arbalest-armour-pin": {armour: "pin", runtime: {status: "live", modifiers: {minimumArmourMultiplier: 0.78}}},
  "arbalest-kill-confirm-heat-refund": {killConfirmHeat: "refund", runtime: {status: "live", modifiers: {killHeatRefund: 0.08}}},
  "sunfire-reduced-heat-gain": {heatGain: "reduced", runtime: {status: "live", modifiers: {heatGainMultiplier: 0.8}}},
  "sunfire-faster-cooldown": {cooldown: "faster", runtime: {status: "live", modifiers: {passiveCoolingMultiplier: 1.2}}},
  "sunfire-narrow-long-range-beam": {beam: "narrow-long-range", runtime: {status: "live", modifiers: {beamRangeMultiplier: 1.3, beamHalfAngleMultiplier: 0.7}}},
  "sunfire-wide-close-range-sweep": {beam: "wide-close-range", runtime: {status: "live", modifiers: {beamRangeMultiplier: 0.75, beamHalfAngleMultiplier: 1.35}}},
  "sunfire-manual-vent-burst": {manualVent: "burst", runtime: {status: "live", modifiers: {manualVentBurstDamage: 80, manualVentRadius: 6, manualVentHeatReduction: 0.45, manualVentCooldownSeconds: 8}}},
  "sunfire-controlled-overheat-window": {overheat: "controlled-damage-window", runtime: {status: "live", modifiers: {overheatThreshold: 1.2, overheatDamageMultiplier: 1.3}}},
  "runebolt-faster-tighter-projectile": {projectile: "faster-tighter", runtime: {status: "live", modifiers: {runeboltShotIntervalMultiplier: 0.9, runeboltHitPaddingMultiplier: 0.5, splashRadiusMultiplier: 0.8}}},
  "runebolt-larger-weaker-splash": {splash: "larger-weaker", runtime: {status: "live", modifiers: {splashRadiusMultiplier: 1.3, splashDamageMultiplier: 0.75}}},
  "runebolt-direct-hit-armour-crack": {directHit: "armour-crack", runtime: {status: "live", modifiers: {armourCrackSeconds: 5, armourCrackDamageMultiplier: 1.25}}},
  "runebolt-terrain-ricochet": {terrain: "one-ricochet", runtime: {status: "live", modifiers: {terrainRicochetDamageMultiplier: 0.6, terrainRicochetRadius: 7}}},
  "runebolt-delayed-cluster-split": {cluster: "delayed-split", runtime: {status: "live", modifiers: {clusterSplitDelaySeconds: 0.35, clusterSplitDamageMultiplier: 0.3, clusterSplitRadius: 5}}},
  "runebolt-controlled-gravity-pulse": {gravity: "controlled-pulse", runtime: {status: "live", modifiers: {gravityPulseSeconds: 0.8, gravityPulseRadius: 7}}},
});

const PACING_TOTALS = deriveProgressionPacingTotals();
export const REPEATABLE_PERFECT_CAMPAIGN_OATHMARKS = PACING_TOTALS.repeatablePerfectCampaignOathmarks;
export const FULL_MASTERY_TARGET_OATHMARKS = PACING_TOTALS.fullMasteryTargetOathmarks;

export const OATHMARK_REWARD_RATES_V2 = OATHMARK_REWARD_RATES;

export const EMERGENCY_HEAL_COST = 30;
export const EMERGENCY_HEAL_AMOUNT = 50;
export const BASE_PLAYER_MAX_HP = 100;
export const BASE_STARTING_SUPPLIES = 120;

export function baseRunGates() {
  return {
    outer: {kind: "outer", integrity: 800, maxIntegrity: 800, destroyed: false},
    east: {kind: "outer", integrity: 800, maxIntegrity: 800, destroyed: false},
    heart: {kind: "heart", integrity: 2200, maxIntegrity: 2200, destroyed: false},
  };
}

/**
 * Stable identity for any cache that presents profile-owned loadout knowledge.
 * Living and fallen run state intentionally do not change learned recipes.
 */
export function resolveRunLoadoutCacheKey(profile = {}, run = null) {
  const current = normaliseProfileState(profile);
  return JSON.stringify({
    hubUnlocks: current.hubUnlocks,
    unlocks: current.unlocks,
    relationships: HUB_NPC_UNLOCK_ORDER.map((npcId) => {
      const relationship = current.relationships[npcId] ?? {status: "new", completedGoalIds: []};
      return [npcId, relationship.status, relationship.completedGoalIds];
    }),
  });
}

/** Resolve permanent NPC recipe knowledge plus account-level weapon commissions. */
export function resolveRunLoadout(run, profile = {}) {
  const ownedUnlocks = new Set(normaliseProfileState(profile).unlocks);
  const access = resolveNpcSystemAccess(profile);
  const permanentWeapons = OATHMARK_UNLOCKS
    .filter((unlock) => unlock.kind === "weapon-unlock"
      && unlock.weaponId
      && ownedUnlocks.has(unlock.id))
    .map((unlock) => unlock.weaponId);
  const fortifications = Object.entries(access.recipes)
    .filter(([, available]) => available)
    .map(([id]) => id);
  return Object.freeze({
    stage: 0,
    weapons: Object.freeze([...new Set(["arbalest", ...permanentWeapons])]),
    fortifications: Object.freeze(fortifications),
    message: fortifications.length > 0
      ? "Recruitment knowledge is prepared; the Arbalest and knife remain viable for every wave."
      : "Begin with the repeating Arbalest and knife; recruit holdfolk to prepare permanent defences.",
  });
}

/**
 * @typedef {object} ProfileStateV2
 * @property {2} version
 * @property {2} migrationVersion
 * @property {number} oathmarks
 * @property {string[]} unlocks
 * @property {string[]} hubUnlocks
 * @property {number} terminalRuns
 * @property {Record<string, number>} ranks
 * @property {Record<string, unknown>} settings
 */

/**
 * @typedef {object} RunStateV2
 * @property {2} version
 * @property {string} phase
 * @property {number} night
 * @property {number} wave
 * @property {{hp: number, maxHp: number}} player
 * @property {Record<string, unknown>} gates
 * @property {number} supplies
 * @property {unknown[]} fortifications
 * @property {string[]} boons
 * @property {number} earnedOathmarks
 * @property {boolean} emergencyHealUsed
 * @property {{gateRepairDiscountAvailable:boolean,consumeReceipt:object|null}} dayworkBenefit
 * @property {{night:number,prepared:boolean,available:boolean,prepareReceipt:object|null,consumeReceipt:object|null}} playerMedicine
 * @property {number} runSeed
 * @property {number} runOrdinal
 * @property {string[]} fallenNpcs
 * @property {Record<string, string>} boonChoices
 * @property {number} boonPoolVersion
 * @property {{remainingMs:number}=} recovery
 * @property {{confirmationId:string,night:number,runOrdinal:number}=} bellConfirmation
 * @property {{features: Record<string, {integrity:number, repaired:boolean, tier:number}>, activeNpcs:string[], introductionQueue:string[]}} hub
 * @property {RunStateV2|null} waveStartSnapshot
 */

/** @returns {ProfileStateV2} */
export function createProfileState(options = {}) {
  return normaliseProfileState(options);
}

/**
 * Keep unknown string unlock IDs so a newer or side-loaded unlock is never
 * destroyed merely because an older build loaded the profile.
 *
 * @param {Partial<ProfileStateV2>|null|undefined} input
 * @returns {ProfileStateV2}
 */
export function normaliseProfileState(input) {
  if (input?.ranks !== undefined && !isPlainObject(input.ranks)) {
    throw new TypeError("ranks must be an object");
  }
  const knownRankIds = new Set(PERMANENT_RANK_TRACKS.map((track) => track.id));
  const futureRanks = Object.fromEntries(
    Object.entries(input?.ranks ?? {})
      .filter(([trackId]) => !knownRankIds.has(trackId))
      .map(([trackId, rank]) => [trackId, toNonNegativeInteger(rank, `rank ${trackId}`)]),
  );
  const ranks = {
    ...futureRanks,
    ...Object.fromEntries(
    PERMANENT_RANK_TRACKS.map((track) => [
      track.id,
      clampRank(input?.ranks?.[track.id] ?? 0, track),
    ]),
    ),
  };
  const ownsWardenFocus = input?.wardenBranches?.owned?.includes?.("warden-focus")
    || input?.wardenBranches?.active?.[1] === "warden-focus";
  const unlocks = [...new Set([
    ...(Array.isArray(input?.unlocks) ? input.unlocks.filter(isNonEmptyString) : []),
    ...(ownsWardenFocus ? ["warden-focus"] : []),
  ])].sort();
  const settings = isPlainObject(input?.settings)
    ? clone(input.settings)
    : {};

  const hubUnlocks = normaliseHubUnlocks([
    HUB_NPC_IDS.BELLKEEPER,
    ...(Array.isArray(input?.hubUnlocks) ? input.hubUnlocks : []),
  ]);
  const unlockSet = new Set(unlocks);
  const wardenBranches = normaliseWardenBranches(input?.wardenBranches, unlockSet);
  const weaponMastery = normaliseWeaponMastery(input?.weaponMastery);
  const narrative = normaliseNarrativeProfileState(input?.narrative);
  const relationships = normaliseRelationships(input?.relationships, ranks, unlockSet);
  const rosterFailureFloor = Math.max(0, hubUnlocks.length - 1);
  narrative.failedRuns = Math.max(narrative.failedRuns, rosterFailureFloor);
  if (narrative.debtBroken) {
    const unlocked = new Set(hubUnlocks);
    narrative.postDebtArrivalIds = uniqueStableIds([
      ...narrative.postDebtArrivalIds,
      ...HUB_NPC_UNLOCK_ORDER.filter((id) => !unlocked.has(id)),
    ]);
  }

  return {
    version: PROFILE_STATE_VERSION,
    migrationVersion: PROFILE_STATE_VERSION,
    oathmarks: toNonNegativeInteger(input?.oathmarks, "oathmarks"),
    unlocks,
    hubUnlocks,
    terminalRuns: toNonNegativeInteger(input?.terminalRuns, "terminalRuns"),
    ranks,
    settings,
    wardenBranches,
    weaponMastery,
    rewardLedger: normaliseLedger(input?.rewardLedger),
    narrative,
    relationships,
  };
}

/**
 * @param {Partial<RunStateV2> & {profile?: Partial<ProfileStateV2>}} [options]
 * @returns {RunStateV2}
 */
export function createRunState(options = {}) {
  const profile = normaliseProfileState(options.profile);
  const bonuses = calculatePermanentBonuses(profile);
  const maxHp = Math.round(
    (options.player?.maxHp ?? BASE_PLAYER_MAX_HP) * bonuses.maxHpMultiplier,
  );
  const startingSupplies =
    (options.supplies ?? BASE_STARTING_SUPPLIES) +
    bonuses.startingSuppliesBonus;

  const {
    profile: _profile,
    player: _player,
    gates: _gates,
    supplies: _supplies,
    fortifications: _fortifications,
    boons: _boons,
    earnedOathmarks: _earnedOathmarks,
    emergencyHealUsed: _emergencyHealUsed,
    dayworkBenefit: _dayworkBenefit,
    playerMedicine: _playerMedicine,
    hub: _hub,
    fallenNpcs: _fallenNpcs,
    rewardLedger: _rewardLedger,
    pendingWeaponXp: _pendingWeaponXp,
    recovery: _recovery,
    bellConfirmation: _bellConfirmation,
    waveStartSnapshot: _waveStartSnapshot,
    ...extra
  } = options;

  return normaliseRunState({
    ...extra,
    version: RUN_STATE_VERSION,
    phase: options.phase ?? GAME_PHASES.BUILD_BREAK,
    night: options.night ?? 1,
    wave: options.wave ?? 0,
    player: { ...options.player, maxHp, hp: maxHp },
    supplies: startingSupplies,
    gates: scaleNewRunGates(mergeRunGates(options.gates), bonuses.gateDurabilityMultiplier),
    fortifications: options.fortifications ?? [],
    boons: options.boons ?? [],
    boonChoices: options.boonChoices ?? {},
    boonPoolVersion: options.boonPoolVersion ?? 2,
    earnedOathmarks: options.earnedOathmarks ?? 0,
    emergencyHealUsed: false,
    dayworkBenefit: options.dayworkBenefit ?? {
      gateRepairDiscountAvailable: false,
      consumeReceipt: null,
    },
    playerMedicine: options.playerMedicine ?? {
      night: options.night ?? 1,
      prepared: false,
      available: false,
      prepareReceipt: null,
      consumeReceipt: null,
    },
    runSeed: options.runSeed ?? 1,
    runOrdinal: options.runOrdinal ?? profile.terminalRuns + 1,
    fallenNpcs: options.fallenNpcs ?? [],
    nightStartingNpcIds: options.nightStartingNpcIds ?? [],
    rewardLedger: options.rewardLedger ?? {claimed: []},
    pendingWeaponXp: options.pendingWeaponXp ?? {},
    ...(options.phase === GAME_PHASES.INTERWAVE_RECOVERY || options.recovery != null
      ? {recovery: options.recovery ?? {remainingMs: 12_000}}
      : {}),
    ...(options.bellConfirmation != null ? {bellConfirmation: options.bellConfirmation} : {}),
    narrative: options.narrative ?? {mode: "canonical"},
    hub: options.hub ?? createHubStateForRun(profile, {
      night: options.night ?? 1,
      wave: options.wave ?? 0,
      phase: options.phase ?? GAME_PHASES.BUILD_BREAK,
    }),
    waveStartSnapshot: null,
  });
}

/**
 * @param {unknown} input
 * @returns {RunStateV2|null}
 */
export function normaliseRunState(input) {
  return normaliseRunStateInternal(input);
}

function normaliseRunStateInternal(input, {captureBoundary = false, waveSnapshot = false} = {}) {
  if (input === null || input === undefined) return null;
  if (!isPlainObject(input)) throw new TypeError("run state must be an object");
  if (input.version !== RUN_STATE_VERSION) {
    throw new Error(`unsupported run state version: ${input.version}`);
  }
  if (!Object.values(GAME_PHASES).includes(input.phase)) {
    throw new RangeError(`unknown game phase: ${input.phase}`);
  }
  const maxHp = toPositiveNumber(input.player?.maxHp, "player.maxHp");
  const hp = toFiniteNumber(input.player?.hp, "player.hp");
  if (hp < 0 || hp > maxHp) {
    throw new RangeError("player.hp must be between zero and player.maxHp");
  }

  const fortifications = Array.isArray(input.fortifications)
    ? clone(input.fortifications)
    : [];
  // Alpha.70 briefly allowed a Thorn Snare in the unique gate cauldron
  // socket. Alpha.71 reserves that socket for the Wave 3 Sunfire-pot lesson.
  // Preserve the player's purchased defence by moving it to the first free
  // compatible approach socket; refund it only when every such socket is full.
  const legacyPotSnareIndex = fortifications.findIndex(item => (
    item?.socketId === "gate-fire-pot" && item?.type === "thornSnare"
  ));
  let migratedSupplies = toNonNegativeInteger(input.supplies, "supplies");
  if (legacyPotSnareIndex >= 0) {
    const occupied = new Set(fortifications.map(item => item?.socketId));
    const destination = ["approach-barricade-a", "approach-barricade-b", "courtyard-barricade"]
      .find(socketId => !occupied.has(socketId));
    if (destination) fortifications[legacyPotSnareIndex].socketId = destination;
    else {
      fortifications.splice(legacyPotSnareIndex, 1);
      migratedSupplies += 24;
    }
  }

  const clonedInput = clone(input);
  delete clonedInput.recovery;
  delete clonedInput.bellConfirmation;
  const run = {
    ...clonedInput,
    version: RUN_STATE_VERSION,
    night: toBoundedInteger(input.night, "night", 1, 7),
    wave: toBoundedInteger(input.wave, "wave", 0, 3),
    player: { ...clone(input.player), hp, maxHp },
    gates: normaliseRunGates(input.gates),
    supplies: migratedSupplies,
    fortifications,
    boons: Array.isArray(input.boons)
      ? [...new Set(input.boons.filter(isNonEmptyString))]
      : [],
    boonChoices: normaliseBoonChoices(input.boonChoices),
    // Pre-versioned Alpha.88 runs retain pool v1 offers; newly created runs
    // explicitly carry v2 before this normaliser sees them.
    boonPoolVersion: toBoundedInteger(input.boonPoolVersion ?? 1, "boonPoolVersion", 1, 2),
    earnedOathmarks: toNonNegativeInteger(
      input.earnedOathmarks,
      "earnedOathmarks",
    ),
    emergencyHealUsed: Boolean(input.emergencyHealUsed),
    dayworkBenefit: normaliseDayworkBenefit(input.dayworkBenefit),
    playerMedicine: normalisePlayerMedicine(input.playerMedicine, input.night),
    runSeed: toUint32(input.runSeed, "runSeed"),
    runOrdinal: toPositiveInteger(input.runOrdinal ?? 1, "runOrdinal"),
    fallenNpcs: normaliseFallenNpcs(input.fallenNpcs),
    nightStartingNpcIds: normaliseFallenNpcs(input.nightStartingNpcIds),
    rewardLedger: normaliseLedger(input.rewardLedger),
    pendingWeaponXp: normalisePendingWeaponXp(input.pendingWeaponXp),
    narrative: normaliseNarrativeRunState(input.narrative),
    hub: input.hub === undefined || input.hub === null
      ? createHubStateForRun({hubUnlocks: [HUB_NPC_IDS.BELLKEEPER]}, input)
      : normaliseHubState(input.hub),
    bossEncounter: normaliseBossEncounter(input.bossEncounter),
    waveStartSnapshot: null,
  };
  const recovery = normaliseRecoveryState(input.recovery, input.phase);
  if (recovery !== null) run.recovery = recovery;
  const bellConfirmation = normaliseBellConfirmation(input.bellConfirmation, run);
  if (bellConfirmation !== null) run.bellConfirmation = bellConfirmation;

  if (run.playerMedicine.night !== run.night) {
    run.playerMedicine = emptyPlayerMedicine(run.night);
  }
  if (run.bellConfirmation
    && (run.bellConfirmation.night !== run.night || run.bellConfirmation.runOrdinal !== run.runOrdinal)) {
    throw new RangeError("bell confirmation must match the current night and run ordinal");
  }
  if (run.narrative.daywork?.night !== run.night) {
    run.narrative.daywork = null;
    run.dayworkBenefit = emptyDayworkBenefit();
  }
  if (run.phase !== GAME_PHASES.DAYTIME && run.dayworkBenefit.gateRepairDiscountAvailable) {
    run.dayworkBenefit = {...run.dayworkBenefit, gateRepairDiscountAvailable: false};
  }
  for (const [label, receipt] of [
    ["daywork benefit", run.dayworkBenefit.consumeReceipt],
    ["field medicine prepare", run.playerMedicine.prepareReceipt],
    ["field medicine consume", run.playerMedicine.consumeReceipt],
  ]) {
    if (receipt && receipt.runOrdinal !== run.runOrdinal) {
      throw new RangeError(`${label} receipt run ordinal must match the run`);
    }
  }
  if (run.dayworkBenefit.consumeReceipt) {
    if (run.dayworkBenefit.gateRepairDiscountAvailable) {
      throw new RangeError("consumed daywork benefit receipt cannot remain available");
    }
    if (run.dayworkBenefit.consumeReceipt.night !== run.night
      || run.narrative.daywork?.night !== run.night
      || run.narrative.daywork?.npcId !== HUB_NPC_IDS.MASON
      || run.narrative.daywork?.actionId !== "set-the-brace") {
      throw new RangeError("daywork benefit consume receipt must match the Orin daywork authority");
    }
  }
  if (run.playerMedicine.consumeReceipt
    && (!run.playerMedicine.prepared || run.playerMedicine.available || !run.playerMedicine.prepareReceipt)) {
    throw new RangeError("field medicine consume receipt requires prepared, unavailable medicine authority");
  }

  if (run.fallenNpcs.length > 0) {
    run.hub = normaliseHubState({
      ...run.hub,
      activeNpcs: run.hub.activeNpcs.filter((id) => !run.fallenNpcs.includes(id)),
      introductionQueue: run.hub.introductionQueue.filter((id) => !run.fallenNpcs.includes(id)),
    });
  }

  if (input.waveStartSnapshot !== null && input.waveStartSnapshot !== undefined) {
    const snapshot = normaliseRunStateInternal(input.waveStartSnapshot, {waveSnapshot: true});
    snapshot.waveStartSnapshot = null;
    run.waveStartSnapshot = snapshot;
  }
  validateCadenceAuthority(run, {captureBoundary, waveSnapshot});
  return run;
}

function normaliseBossEncounter(input) {
  if (input === null || input === undefined) return null;
  if (!isPlainObject(input)) throw new TypeError("boss encounter must be an object");
  if (input.mode !== "authored-director") return clone(input);
  return serialiseBossDirector(restoreBossDirector(input));
}

function normaliseRelationships(input, ranks, unlocks) {
  if (input !== undefined && input !== null && !isPlainObject(input)) {
    throw new TypeError("relationships must be an object");
  }
  const source = input ?? {};
  const relationships = {};
  for (const npcId of HUB_NPC_UNLOCK_ORDER) {
    relationships[npcId] = normaliseRelationshipRecord(
      source[npcId],
      relationshipMinimumStatus(npcId, ranks, unlocks),
      RELATIONSHIP_GOAL_IDS_BY_NPC[npcId],
    );
  }
  for (const [npcId, value] of Object.entries(source)) {
    if (npcId in relationships) continue;
    if (!isNonEmptyString(npcId)) continue;
    relationships[npcId] = normaliseRelationshipRecord(value, "new", []);
  }
  return Object.fromEntries(Object.entries(relationships).sort(([left], [right]) => left.localeCompare(right)));
}

function relationshipMinimumStatus(npcId, ranks, unlocks) {
  const rank = Math.max(...RELATIONSHIP_RANK_TRACKS[npcId].map((trackId) => ranks[trackId] ?? 0));
  let status = rankToRelationshipStatus(rank, npcId === HUB_NPC_IDS.BELLKEEPER);
  if (npcId === HUB_NPC_IDS.QUARTERMASTER) {
    if (unlocks.has("sunfire-prism")) status = strongerRelationshipStatus(status, "known");
    if (unlocks.has("split-runebolt")) status = strongerRelationshipStatus(status, "trusted");
  }
  return status;
}

function rankToRelationshipStatus(rank, bellkeeper) {
  if (rank <= 0) return "new";
  if (bellkeeper) return rank === 1 ? "known" : rank === 2 ? "trusted" : "bonded";
  return rank === 1 ? "known" : rank <= 3 ? "trusted" : "bonded";
}

function strongerRelationshipStatus(left, right) {
  return RELATIONSHIP_STATUS_INDEX.get(left) >= RELATIONSHIP_STATUS_INDEX.get(right) ? left : right;
}

function normaliseRelationshipRecord(input, minimumStatus, prerequisiteGoalIds) {
  if (input !== undefined && input !== null && !isPlainObject(input)) {
    throw new TypeError("relationship record must be an object");
  }
  const source = input ?? {};
  const requestedStatus = RELATIONSHIP_STATUS_INDEX.has(source.status) ? source.status : "new";
  const status = strongerRelationshipStatus(requestedStatus, minimumStatus);
  const prerequisiteCount = Math.max(0, RELATIONSHIP_STATUS_INDEX.get(status));
  return {
    status,
    activeGoalId: normaliseNullableStableId(source.activeGoalId),
    readyGoalId: normaliseNullableStableId(source.readyGoalId),
    completedGoalIds: uniqueStableIds([
      ...(Array.isArray(source.completedGoalIds) ? source.completedGoalIds : []),
      ...prerequisiteGoalIds.slice(0, prerequisiteCount),
    ]),
    cumulative: normaliseCumulative(source.cumulative),
  };
}

function normaliseNullableStableId(value) {
  return isNonEmptyString(value) ? value.trim() : null;
}

function uniqueStableIds(value) {
  const seen = new Set();
  return value.filter(isNonEmptyString).map((id) => id.trim()).filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function normaliseCumulative(value) {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) throw new TypeError("relationship cumulative must be an object");
  return Object.fromEntries(Object.entries(value).map(([key, count]) => [
    key,
    toNonNegativeInteger(count, `relationship cumulative ${key}`),
  ]));
}

/**
 * @param {Partial<ProfileStateV2>} profile
 * @returns {{maxHpMultiplier:number, weaponDamageMultiplier:number, startingSuppliesBonus:number, gateDurabilityMultiplier:number, repairEfficiencyMultiplier:number}}
 */
export function calculatePermanentBonuses(profile) {
  const current = normaliseProfileState(profile);
  const rank = (id) => current.ranks[id];
  const bellkeeperRank = rank(RANK_TRACK_IDS.BELLKEEPERS_WATCH);
  return Object.freeze({
    maxHpMultiplier: 1 + rank(RANK_TRACK_IDS.WARDENS_VIGOR) * 0.05,
    weaponDamageMultiplier: 1 + rank(RANK_TRACK_IDS.ARMORY_TEMPER) * 0.03,
    startingSuppliesBonus: rank(RANK_TRACK_IDS.QUARTERMASTER) * 10,
    gateDurabilityMultiplier: 1 + rank(RANK_TRACK_IDS.MASONS_OATH) * 0.04,
    repairEfficiencyMultiplier: 1 + rank(RANK_TRACK_IDS.FIELD_CRAFT) * 0.05,
    revealNextWaveComposition: bellkeeperRank >= 1,
    eliteBossTelegraphSeconds: bellkeeperRank >= 2 ? 10 : 0,
    npcRallyDurationSeconds: bellkeeperRank >= 3 ? 12 : 0,
  });
}

/** The renderer-facing effect map is derived solely from persistent choices. */
export function calculateProgressionEffects(profile) {
  const current = normaliseProfileState(profile);
  const warden = {};
  for (const tier of WARDEN_BRANCH_TIERS) {
    const active = current.wardenBranches.active[String(tier.tier)];
    const option = tier.options.find((entry) => entry.id === active);
    if (option) Object.assign(warden, option.effects);
  }
  const weapons = Object.fromEntries(WEAPON_IDS.map((weaponId) => [
    weaponId,
    Object.fromEntries(Object.entries(current.weaponMastery[weaponId].active)
      .map(([tier, choiceId]) => [tier, {id: choiceId, ...WEAPON_MASTERY_EFFECTS[choiceId]}])),
  ]));
  return deepFreeze({warden, weapons, permanent: calculatePermanentBonuses(current)});
}

/** Explicit read-only guest / host-owned progression DTO without renderer state. */
export function createProgressionAuthorityState(profile, run, options = {}) {
  const role = options.role ?? PROGRESSION_ROLE.HOST;
  if (!Object.values(PROGRESSION_ROLE).includes(role)) throw new RangeError("unknown progression role");
  return deepFreeze({
    role,
    canMutate: role === PROGRESSION_ROLE.HOST,
    profile: normaliseProfileState(profile),
    run: normaliseRunState(run),
  });
}

/** Purchase an owned Warden branch and bind it as the one active tier choice. */
export function purchaseWardenBranch(profile, tierNumber, branchId, options = {}) {
  requireHost(options);
  const tier = getWardenBranchTier(tierNumber);
  if (!tier.options.some((option) => option.id === branchId)) {
    throw new RangeError(`unknown Warden branch for tier ${tierNumber}: ${branchId}`);
  }
  const current = normaliseProfileState(profile);
  if (current.wardenBranches.owned.includes(branchId)) {
    if (current.wardenBranches.active[String(tierNumber)] === branchId) return current;
    throw new Error("owned Warden alternatives must use terminal rebind");
  }
  if (branchId === "warden-focus" && !resolveNpcSystemAccess(current, options.run).purchases["warden-focus"]) {
    throw new Error("Warden Focus requires a living Quartermaster");
  }
  if (current.oathmarks < tier.cost) throw new Error(`not enough Oathmarks for ${branchId}`);
  return normaliseProfileState({
    ...current,
    oathmarks: current.oathmarks - tier.cost,
    unlocks: branchId === "warden-focus"
      ? [...new Set([...current.unlocks, "warden-focus"])].sort()
      : current.unlocks,
    wardenBranches: {
      owned: [...current.wardenBranches.owned, branchId].sort(),
      active: {...current.wardenBranches.active, [tierNumber]: branchId},
    },
  });
}

/** Rebinding uses an already-owned alternative, one mark, and a terminal boundary. */
export function rebindWardenBranch(profile, tierNumber, branchId, options = {}) {
  requireHost(options);
  if (options.terminalBoundary !== true) throw new Error("Warden branches can rebind only at a terminal boundary");
  const tier = getWardenBranchTier(tierNumber);
  if (!tier.options.some((option) => option.id === branchId)) throw new RangeError(`unknown Warden branch: ${branchId}`);
  const current = normaliseProfileState(profile);
  if (!current.wardenBranches.owned.includes(branchId)) throw new Error(`Warden branch is not owned: ${branchId}`);
  if (current.wardenBranches.active[String(tierNumber)] === branchId) return current;
  if (current.oathmarks < 1) throw new Error("not enough Oathmarks to rebind Warden branch");
  return normaliseProfileState({
    ...current,
    oathmarks: current.oathmarks - 1,
    unlocks: branchId === "warden-focus"
      ? [...new Set([...current.unlocks, "warden-focus"])].sort()
      : current.unlocks,
    wardenBranches: {...current.wardenBranches, active: {...current.wardenBranches.active, [tierNumber]: branchId}},
  });
}

/** Bind one paid mastery choice per tier after host-confirmed XP reaches its gate. */
export function bindWeaponMastery(profile, weaponId, tierNumber, choiceId, options = {}) {
  requireHost(options);
  const tierIndex = validateMasteryChoice(weaponId, tierNumber, choiceId);
  const current = normaliseProfileState(profile);
  const mastery = current.weaponMastery[weaponId];
  if (mastery.xp < MASTERY_TIER_GATES[tierIndex]) throw new Error(`weapon XP gate ${MASTERY_TIER_GATES[tierIndex]} not met`);
  const alreadyOwned = mastery.owned.includes(choiceId);
  const cost = alreadyOwned ? 0 : MASTERY_TIER_COSTS[tierIndex];
  if (current.oathmarks < cost) throw new Error(`not enough Oathmarks for ${choiceId}`);
  return {
    ...current,
    oathmarks: current.oathmarks - cost,
    weaponMastery: {
      ...current.weaponMastery,
      [weaponId]: {
        ...mastery,
        owned: alreadyOwned ? mastery.owned : [...mastery.owned, choiceId].sort(),
        active: {...mastery.active, [tierNumber]: choiceId},
      },
    },
  };
}

/** Host-confirmed XP is keyed by stable enemy and weapon, so semantic replay cannot mint it. */
export function grantWeaponXp(profile, run, event, options = {}) {
  requireHost(options);
  const currentProfile = normaliseProfileState(profile);
  const currentRun = normaliseRunState(run);
  const weaponId = event?.weaponId;
  const enemyId = event?.enemyId;
  const rates = {ordinary: 1, elite: 3, boss: 10};
  if (!WEAPON_IDS.includes(weaponId)) throw new RangeError(`unknown weapon: ${weaponId}`);
  if (!isNonEmptyString(enemyId)) throw new TypeError("enemyId must be a non-empty stable ID");
  if (!(event?.enemyKind in rates)) throw new RangeError("unknown enemy XP kind");
  const key = `xp:${enemyId}:${weaponId}`;
  if (currentRun.rewardLedger.claimed.includes(key)) return {profile: currentProfile, run: currentRun, granted: false, key};
  return {
    profile: currentProfile,
    run: {
      ...currentRun,
      rewardLedger: claimLedgerKey(currentRun.rewardLedger, key),
      pendingWeaponXp: {...currentRun.pendingWeaponXp, [weaponId]: currentRun.pendingWeaponXp[weaponId] + rates[event.enemyKind]},
    },
    granted: true,
    key,
  };
}

/** Canonical host reward path for all Oathmark events. */
export function applyProgressionEvent(profile, run, event, options = {}) {
  requireHost(options);
  const currentProfile = normaliseProfileState(profile);
  const currentRun = normaliseRunState(run);
  if (event?.type === "first-night-one-hold" && event.qualifyingNightOneHold !== true) {
    throw new Error("first Night One hold reward requires host-confirmed qualifying completion");
  }
  const reward = rewardForEvent(event);
  if (reward.lifetime) {
    if (currentProfile.rewardLedger.claimed.includes(reward.key)) return {profile: currentProfile, run: currentRun, granted: false, key: reward.key};
    return {
      profile: {...currentProfile, rewardLedger: claimLedgerKey(currentProfile.rewardLedger, reward.key)},
      run: {...currentRun, earnedOathmarks: currentRun.earnedOathmarks + reward.oathmarks,
        rewardLedger: claimLedgerKey(currentRun.rewardLedger, reward.key)},
      granted: true,
      key: reward.key,
    };
  }
  if (currentRun.rewardLedger.claimed.includes(reward.key)) return {profile: currentProfile, run: currentRun, granted: false, key: reward.key};
  return {
    profile: currentProfile,
    run: {
      ...currentRun,
      rewardLedger: claimLedgerKey(currentRun.rewardLedger, reward.key),
      earnedOathmarks: currentRun.earnedOathmarks + reward.oathmarks,
    },
    granted: true,
    key: reward.key,
  };
}

export function modelProgressionPacing() {
  return Object.freeze({
    ...PACING_TOTALS,
    firstNightOneHoldBonus: FIRST_NIGHT_ONE_HOLD_OATHMARKS,
    firstWinBand: Object.freeze({min: 35, max: 50}),
  });
}

function deriveProgressionPacingTotals() {
  const nightCount = new Set(CAMPAIGN_WAVES.map((wave) => wave.night)).size;
  const waveCount = CAMPAIGN_WAVES.length;
  const thirdWaveBossCount = CAMPAIGN_WAVES.filter((wave) => wave.waveNumber === 3).length;
  const optionalObjectiveCount = 2;
  const repeatablePerfectCampaignOathmarks =
    waveCount * OATHMARK_REWARD_RATES.waveClear +
    nightCount * OATHMARK_REWARD_RATES.nightCompletion +
    thirdWaveBossCount * OATHMARK_REWARD_RATES.bossDefeat +
    optionalObjectiveCount * OATHMARK_REWARD_RATES.optionalObjective +
    OATHMARK_REWARD_RATES.campaignCompletion;
  const legacyRankCost = RANK_COSTS.reduce((total, cost) => total + cost, 0);
  const foundationCost = PERMANENT_RANK_TRACKS
    .filter((track) => track.id !== RANK_TRACK_IDS.BELLKEEPERS_WATCH)
    .length * legacyRankCost;
  const bellkeeperCost = BELLKEEPER_WATCH_TRACK.costs.reduce((total, cost) => total + cost, 0);
  const commissionCost = OATHMARK_UNLOCKS.reduce((total, unlock) => total + unlock.cost, 0);
  const newWardenBranchCost = WARDEN_BRANCH_TIERS
    .filter((tier) => tier.tier !== 1)
    .reduce((total, tier) => total + tier.cost, 0);
  const masteryCost = WEAPON_IDS.length * MASTERY_TIER_COSTS.reduce((total, cost) => total + cost, 0);
  return Object.freeze({
    repeatablePerfectCampaignOathmarks,
    fullMasteryTargetOathmarks: foundationCost + bellkeeperCost + commissionCost + newWardenBranchCost + masteryCost,
  });
}

/**
 * @param {Partial<ProfileStateV2>} profile
 * @param {string} trackId
 * @returns {ProfileStateV2}
 */
export function purchasePermanentRank(profile, trackId, options = {}) {
  requireHost(options);
  const track = getRankTrack(trackId);
  const current = normaliseProfileState(profile);
  const rank = current.ranks[trackId];
  if (rank >= track.maxRank) {
    throw new Error(`${track.name} is already at its maximum rank`);
  }
  const access = resolveNpcSystemAccess(current, options.run);
  const ceiling = Math.min(track.maxRank, access.rankCeilings[trackId] ?? 0);
  if (rank >= ceiling) {
    throw new Error(`${track.name} requires its NPC relationship before another rank can be purchased`);
  }
  const cost = track.costs[rank];
  if (current.oathmarks < cost) {
    throw new Error(`not enough Oathmarks for ${track.name}`);
  }
  return {
    ...current,
    oathmarks: current.oathmarks - cost,
    ranks: { ...current.ranks, [trackId]: rank + 1 },
  };
}

/** Compatibility name retained for callers that already own profile and event context. */
export function awardRunOathmarks(profile, run, event, options = {}) {
  return applyProgressionEvent(profile, run, event, options);
}

/**
 * Settle a true run boundary exactly once. A run ends only in failure/death or
 * after Night 7. There is no non-terminal bank operation.
 */
export function settleTerminalRun(profile, run, terminal = {}) {
  const currentProfile = normaliseProfileState(profile);
  const currentRun = normaliseRunState(run);
  const failed = terminal.outcome === "failure";
  const completed = terminal.outcome === "campaign_complete"
    && currentRun.night === 7
    && currentRun.phase === GAME_PHASES.CAMPAIGN_COMPLETE;
  if (!failed && !completed) {
    throw new Error("terminal settlement requires failure or the completed Night 7 campaign");
  }
  if (currentProfile.terminalRuns >= currentRun.runOrdinal) {
    return Object.freeze({
      profile: currentProfile,
      run: null,
      bankedOathmarks: 0,
      unlockedNpcId: null,
      alreadySettled: true,
    });
  }

  const canonical = currentRun.narrative.mode === "canonical";
  const unlockSet = new Set(currentProfile.hubUnlocks);
  const unlockedNpcId = failed && canonical ? nextMissingHubNpcId(currentProfile.hubUnlocks) : null;
  if (unlockedNpcId) unlockSet.add(unlockedNpcId);
  const weaponMastery = bankPendingWeaponXp(currentProfile.weaponMastery, currentRun.pendingWeaponXp);
  const narrative = normaliseNarrativeProfileState(currentProfile.narrative);
  if (failed && canonical) {
    const reasonCode = terminal.reasonCode ?? "player_died";
    narrative.failedRuns += 1;
    narrative.deepestNight = Math.max(narrative.deepestNight, currentRun.night);
    narrative.lastFailure = {
      attemptId: currentRun.runOrdinal,
      night: currentRun.night,
      wave: currentRun.wave,
      reasonCode,
      bossId: terminal.bossId ?? null,
      breachedGateId: terminal.breachedGateId ?? null,
      fallenNpcIds: currentRun.fallenNpcs,
    };
    narrative.pendingSequence = {
      attemptId: currentRun.runOrdinal,
      failureSceneId: `failure-${reasonCode.replaceAll("_", "-")}`,
      recruitedNpcId: unlockedNpcId,
    };
  }
  if (completed && canonical) {
    const firstCompletion = !narrative.debtBroken;
    narrative.debtBroken = true;
    narrative.campaignCompletions += 1;
    if (firstCompletion) {
      narrative.postDebtArrivalIds = uniqueStableIds([
        ...narrative.postDebtArrivalIds,
        ...HUB_NPC_UNLOCK_ORDER.filter((id) => !unlockSet.has(id)),
      ]);
    }
  }
  return Object.freeze({
    profile: normaliseProfileState({
      ...currentProfile,
      oathmarks: currentProfile.oathmarks + currentRun.earnedOathmarks,
      hubUnlocks: [...unlockSet],
      weaponMastery,
      terminalRuns: Math.max(currentProfile.terminalRuns + 1, currentRun.runOrdinal),
      narrative,
    }),
    run: null,
    bankedOathmarks: currentRun.earnedOathmarks,
    unlockedNpcId,
    alreadySettled: false,
  });
}

/**
 * Move a settled rewind/arrival sequence into the next run as one saveable
 * state pair. Retrying after an interrupted write is safe because both scene
 * identifiers and the settled ordinal are stable.
 */
export function transferPendingNarrativeSequence(profile, run) {
  const currentProfile = normaliseProfileState(profile);
  const currentRun = normaliseRunState(run);
  const pending = currentProfile.narrative.pendingSequence;
  if (
    !pending
    || pending.attemptId !== currentProfile.terminalRuns
    || currentRun.runOrdinal !== pending.attemptId + 1
  ) {
    return Object.freeze({profile: currentProfile, run: currentRun, transferred: false});
  }
  const sceneIds = [
    pending.failureSceneId,
    ...(pending.recruitedNpcId ? [`arrival-${pending.recruitedNpcId}`] : []),
  ];
  return Object.freeze({
    profile: normaliseProfileState({
      ...currentProfile,
      narrative: {...currentProfile.narrative, pendingSequence: null},
    }),
    run: normaliseRunState({
      ...currentRun,
      narrative: {
        ...currentRun.narrative,
        pendingSceneIds: uniqueStableIds([...currentRun.narrative.pendingSceneIds, ...sceneIds]),
      },
    }),
    transferred: true,
  });
}

/**
 * Construct the next Echo run as a single profile/run transaction. Persist the
 * returned pair together; callers must retain the original profile if the save
 * write fails, which keeps the queued arrival intact.
 */
export function createEchoRun(profile) {
  const currentProfile = normaliseProfileState(profile);
  if (!currentProfile.narrative.debtBroken) {
    throw new Error("Echo runs require a debt-broken profile");
  }
  const arrivingNpcId = currentProfile.narrative.postDebtArrivalIds[0] ?? null;
  const nextProfile = normaliseProfileState({
    ...currentProfile,
    hubUnlocks: arrivingNpcId
      ? [...currentProfile.hubUnlocks, arrivingNpcId]
      : currentProfile.hubUnlocks,
    narrative: {
      ...currentProfile.narrative,
      postDebtArrivalIds: arrivingNpcId
        ? currentProfile.narrative.postDebtArrivalIds.slice(1)
        : currentProfile.narrative.postDebtArrivalIds,
    },
  });
  const run = createRunState({
    profile: nextProfile,
    narrative: {
      mode: "echo",
      pendingSceneIds: arrivingNpcId ? [`arrival-${arrivingNpcId}`] : [],
    },
  });
  return Object.freeze({profile: nextProfile, run, arrivingNpcId});
}

/** Successful settlement is reserved for the completed seven-night campaign. */
export function completeRun(profile, run) {
  const current = normaliseRunState(run);
  if (current.night !== 7 || current.phase !== GAME_PHASES.CAMPAIGN_COMPLETE) {
    throw new Error("a successful run requires the completed Night 7 campaign");
  }
  return settleTerminalRun(profile, current, {outcome: "campaign_complete"});
}

/**
 * @returns {{profile:ProfileStateV2, run:null, bankedOathmarks:number, failureReason:string}}
 */
export function failRun(profile, run, failureReason) {
  if (!isNonEmptyString(failureReason)) {
    throw new TypeError("failureReason must be a non-empty string");
  }
  return Object.freeze({
    ...settleTerminalRun(profile, run, {outcome: "failure"}),
    failureReason,
  });
}

/** Capture the exact deterministic restart point for an active wave. */
export function captureWaveStartSnapshot(run) {
  const current = normaliseRunStateInternal(run, {captureBoundary: true});
  const snapshot = { ...clone(current), waveStartSnapshot: null };
  return { ...current, waveStartSnapshot: snapshot };
}

/** Restore an interrupted combat wave to its captured start. */
export function restoreWaveStartSnapshot(run) {
  const current = normaliseRunState(run);
  if (current.phase !== GAME_PHASES.COMBAT) return current;
  if (!current.waveStartSnapshot) {
    throw new Error("combat run is missing its wave-start snapshot");
  }
  const restored = clone(current.waveStartSnapshot);
  restored.fallenNpcs = normaliseFallenNpcs([
    ...restored.fallenNpcs,
    ...current.fallenNpcs,
  ]);
  restored.hub = normaliseHubState({
    ...restored.hub,
    activeNpcs: restored.hub.activeNpcs.filter((id) => !restored.fallenNpcs.includes(id)),
    introductionQueue: restored.hub.introductionQueue.filter((id) => !restored.fallenNpcs.includes(id)),
  });
  restored.rewardLedger = claimLedgerKeys(
    restored.rewardLedger,
    current.rewardLedger.claimed.filter((key) => key.startsWith("xp:")),
  );
  restored.pendingWeaponXp = Object.fromEntries(WEAPON_IDS.map((weaponId) => [
    weaponId,
    Math.max(restored.pendingWeaponXp[weaponId], current.pendingWeaponXp[weaponId]),
  ]));
  if (current.nightRuntime) restored.nightRuntime = clone(current.nightRuntime);
  restored.waveStartSnapshot = clone(current.waveStartSnapshot);
  restored.waveStartSnapshot.fallenNpcs = clone(restored.fallenNpcs);
  restored.waveStartSnapshot.hub = clone(restored.hub);
  restored.waveStartSnapshot.rewardLedger = clone(restored.rewardLedger);
  restored.waveStartSnapshot.pendingWeaponXp = clone(restored.pendingWeaponXp);
  if (restored.nightRuntime) restored.waveStartSnapshot.nightRuntime = clone(restored.nightRuntime);
  return restored;
}

/**
 * Start a new dawn/build break. Player vitality refreshes and the one-use heal
 * becomes available again; gates, Supplies, fortifications, and boons persist.
 */
export function beginRunNight(run, night) {
  const current = normaliseRunState(run);
  const nextNight = toPositiveInteger(night, "night");
  const {recovery: _recovery, bellConfirmation: _bellConfirmation, ...durable} = current;
  return {
    ...durable,
    phase: GAME_PHASES.DAYTIME,
    night: nextNight,
    wave: 0,
    player: { ...current.player, hp: current.player.maxHp },
    emergencyHealUsed: false,
    narrative: {...current.narrative, daywork: null},
    dayworkBenefit: emptyDayworkBenefit(),
    playerMedicine: emptyPlayerMedicine(nextNight),
    bossEncounter: null,
    waveStartSnapshot: null,
  };
}

/** Spend 30 Supplies to restore up to 50 HP, once per night. */
export function useEmergencyHeal(run) {
  const current = normaliseRunState(run);
  if (current.emergencyHealUsed) {
    throw new Error("the emergency heal has already been used this night");
  }
  if (current.supplies < EMERGENCY_HEAL_COST) {
    throw new Error("not enough Supplies for the emergency heal");
  }
  if (current.player.hp >= current.player.maxHp) {
    throw new Error("the player is already at full health");
  }
  return {
    ...current,
    supplies: current.supplies - EMERGENCY_HEAL_COST,
    player: {
      ...current.player,
      hp: Math.min(
        current.player.maxHp,
        current.player.hp + EMERGENCY_HEAL_AMOUNT,
      ),
    },
    emergencyHealUsed: true,
  };
}

function getRankTrack(trackId) {
  const track = PERMANENT_RANK_TRACKS.find((entry) => entry.id === trackId);
  if (!track) throw new RangeError(`unknown permanent rank track: ${trackId}`);
  return track;
}

function getWardenBranchTier(tierNumber) {
  const tier = WARDEN_BRANCH_TIERS.find((entry) => entry.tier === tierNumber);
  if (!tier) throw new RangeError(`unknown Warden branch tier: ${tierNumber}`);
  return tier;
}

function validateMasteryChoice(weaponId, tierNumber, choiceId) {
  if (!WEAPON_IDS.includes(weaponId)) throw new RangeError(`unknown weapon: ${weaponId}`);
  if (!Number.isInteger(tierNumber) || tierNumber < 1 || tierNumber > 3) throw new RangeError("mastery tier must be between 1 and 3");
  const tierIndex = tierNumber - 1;
  if (!WEAPON_MASTERY_CHOICES[weaponId][tierIndex].includes(choiceId)) {
    throw new RangeError(`unknown ${weaponId} mastery choice: ${choiceId}`);
  }
  return tierIndex;
}

function requireHost(options) {
  const role = options.role ?? PROGRESSION_ROLE.HOST;
  if (role !== PROGRESSION_ROLE.HOST) throw new Error("progression mutation is host-owned");
}

function rewardForEvent(event) {
  if (!isPlainObject(event) || !isNonEmptyString(event.type)) throw new TypeError("progression event must include a type");
  if (event.type === "wave") {
    const night = toBoundedInteger(event.night, "reward night", 1, 7);
    const wave = toBoundedInteger(event.wave, "reward wave", 1, 3);
    return {key: `wave:${night}:${wave}`, oathmarks: OATHMARK_REWARD_RATES.waveClear, lifetime: false};
  }
  if (event.type === "night") {
    const night = toBoundedInteger(event.night, "reward night", 1, 7);
    return {key: `night:${night}`, oathmarks: OATHMARK_REWARD_RATES.nightCompletion, lifetime: false};
  }
  if (event.type === "objective") {
    const night = toBoundedInteger(event.night, "objective night", 2, 6);
    if (![2, 6].includes(night) || !isNonEmptyString(event.objectiveId)) throw new RangeError("only authored Night 2 and Night 6 objectives grant Oathmarks");
    return {key: `objective:${night}:${event.objectiveId}`, oathmarks: OATHMARK_REWARD_RATES.optionalObjective, lifetime: false};
  }
  if (event.type === "objective-result") {
    const night = toBoundedInteger(event.night, "objective result night", 2, 6);
    if (![2, 6].includes(night) || !isNonEmptyString(event.objectiveId)
      || !["succeeded", "failed"].includes(event.status)) {
      throw new RangeError("only authored Night 2 and Night 6 objective results are supported");
    }
    return {key: `objective-result:${night}:${event.objectiveId}:${event.status}`, oathmarks: 0, lifetime: false};
  }
  if (event.type === "boss") {
    if (!isNonEmptyString(event.encounterId) || !isNonEmptyString(event.stableId)) throw new TypeError("boss rewards require encounterId and stableId");
    return {key: `boss:${event.encounterId}:${event.stableId}`, oathmarks: OATHMARK_REWARD_RATES.bossDefeat, lifetime: false};
  }
  if (event.type === "campaign") return {key: "campaign:complete", oathmarks: OATHMARK_REWARD_RATES.campaignCompletion, lifetime: false};
  if (event.type === "first-night-one-hold") return {key: "lifetime:first-night-one-hold", oathmarks: OATHMARK_REWARD_RATES.firstNightOneHold, lifetime: true};
  throw new RangeError(`unknown progression event: ${event.type}`);
}

function normaliseLedger(value) {
  const claimed = Array.isArray(value?.claimed) ? value.claimed : [];
  if (!claimed.every(isNonEmptyString)) throw new TypeError("reward ledger claimed keys must be non-empty strings");
  return {claimed: [...new Set(claimed)].sort()};
}

function claimLedgerKey(ledger, key) {
  return {claimed: [...new Set([...ledger.claimed, key])].sort()};
}

function claimLedgerKeys(ledger, keys) {
  return {claimed: [...new Set([...ledger.claimed, ...keys])].sort()};
}

function normaliseWardenBranches(value, unlockSet) {
  const ownedInput = Array.isArray(value?.owned) ? value.owned : [];
  if (!ownedInput.every(isNonEmptyString)) throw new TypeError("Warden branch IDs must be non-empty strings");
  const owned = [...new Set([...ownedInput, ...(unlockSet.has("warden-focus") ? ["warden-focus"] : [])])]
    .sort();
  const active = {};
  if (value?.active !== undefined && !isPlainObject(value.active)) throw new TypeError("Warden branch active choices must be an object");
  for (const [tier, selected] of Object.entries(value?.active ?? {})) {
    if (!isNonEmptyString(selected)) throw new TypeError("Warden active branch IDs must be non-empty strings");
    active[tier] = selected;
  }
  for (const tier of WARDEN_BRANCH_TIERS) {
    const selected = value?.active?.[tier.tier];
    if (selected === undefined) {
      if (tier.tier === 1 && owned.includes("warden-focus")) active[1] = "warden-focus";
      continue;
    }
    if (tier.options.some((option) => option.id === selected) && !owned.includes(selected)) {
      throw new RangeError(`invalid active Warden branch for tier ${tier.tier}`);
    }
  }
  return {owned, active};
}

function normaliseWeaponMastery(value) {
  if (value !== undefined && !isPlainObject(value)) throw new TypeError("weaponMastery must be an object");
  const knownChoiceIds = new Set(Object.values(WEAPON_MASTERY_CHOICES).flat(2));
  const normaliseRecord = (weaponId, source, choices = null) => {
    if (!isPlainObject(source)) throw new TypeError(`weaponMastery.${weaponId} must be an object`);
    const ownedInput = source.owned ?? [];
    if (!Array.isArray(ownedInput) || !ownedInput.every(isNonEmptyString)) throw new TypeError(`weaponMastery.${weaponId}.owned must be string IDs`);
    const owned = [...new Set(ownedInput)].sort();
    if (source.active !== undefined && !isPlainObject(source.active)) throw new TypeError(`weaponMastery.${weaponId}.active must be an object`);
    const active = Object.fromEntries(Object.entries(source.active ?? {}).map(([tier, selected]) => {
      if (!isNonEmptyString(selected)) throw new TypeError(`weaponMastery.${weaponId}.active IDs must be strings`);
      if (choices) {
        const expectedTier = choices.findIndex((tierChoices) => tierChoices.includes(selected)) + 1;
        if ((expectedTier === 0 && knownChoiceIds.has(selected)) || (expectedTier > 0 && String(expectedTier) !== String(tier))) {
          throw new RangeError(`invalid ${weaponId} mastery tier ${tier} for ${selected}`);
        }
      }
      return [tier, selected];
    }));
    for (let tier = 1; choices && tier <= 3; tier += 1) {
      const selected = source.active?.[tier];
      if (selected === undefined) continue;
      if (choices[tier - 1].includes(selected) && !owned.includes(selected)) {
        throw new RangeError(`invalid active ${weaponId} mastery tier ${tier}`);
      }
    }
    return {xp: toNonNegativeInteger(source.xp, `${weaponId} XP`), owned, active};
  };
  const known = Object.fromEntries(WEAPON_IDS.map((weaponId) => [
    weaponId, normaliseRecord(weaponId, value?.[weaponId] ?? {}, WEAPON_MASTERY_CHOICES[weaponId]),
  ]));
  const future = Object.fromEntries(Object.entries(value ?? {})
    .filter(([weaponId]) => !WEAPON_IDS.includes(weaponId))
    .map(([weaponId, record]) => [weaponId, normaliseRecord(weaponId, record)]));
  return {...future, ...known};
}

function normalisePendingWeaponXp(value) {
  if (value !== undefined && !isPlainObject(value)) throw new TypeError("pendingWeaponXp must be an object");
  return Object.fromEntries(WEAPON_IDS.map((weaponId) => [weaponId, toNonNegativeInteger(value?.[weaponId], `${weaponId} pending XP`)]));
}

function bankPendingWeaponXp(weaponMastery, pendingWeaponXp) {
  return {
    ...weaponMastery,
    ...Object.fromEntries(WEAPON_IDS.map((weaponId) => [weaponId, {
    ...weaponMastery[weaponId],
    xp: weaponMastery[weaponId].xp + pendingWeaponXp[weaponId],
    }])),
  };
}

function scaleNewRunGates(gates, multiplier) {
  if (!isPlainObject(gates)) throw new TypeError("gates must be an object");
  return Object.fromEntries(
    Object.entries(clone(gates)).map(([id, gate]) => {
      if (!isPlainObject(gate) || !Number.isFinite(gate.maxIntegrity)) {
        return [id, gate];
      }
      const previousMax = gate.maxIntegrity;
      const previousIntegrity = Number.isFinite(gate.integrity)
        ? gate.integrity
        : previousMax;
      const maxIntegrity = Math.round(previousMax * multiplier);
      const integrity = Math.round(
        maxIntegrity * Math.max(0, Math.min(1, previousIntegrity / previousMax)),
      );
      return [id, { ...gate, maxIntegrity, integrity }];
    }),
  );
}

function mergeRunGates(gates) {
  const defaults = baseRunGates();
  gates = gates ?? {};
  if (!isPlainObject(gates)) throw new TypeError("gates must be an object");
  const legacyOuter = gates.west ?? gates.outer;
  const legacyEast = gates.east ?? legacyOuter;
  return {
    ...clone(gates),
    outer: {...defaults.outer, ...(legacyOuter ?? {})},
    east: {...defaults.east, ...(legacyEast ?? {})},
    heart: {...defaults.heart, ...(gates.heart ?? {})},
  };
}

function normaliseRunGates(input) {
  if (!isPlainObject(input)) throw new TypeError("gates must be an object");
  const gates = clone(input);
  // Alpha.89 and earlier persisted one logical outer gate. Derive the east
  // lane from it on load so old saves remain playable while new runs preserve
  // the two independently damaged outer gates.
  if (!Object.hasOwn(gates, "east")) {
    const source = gates.outer ?? gates.west;
    if (isPlainObject(source)) gates.east = {...source, kind: "outer"};
  }
  for (const id of ["outer", "east", "heart"]) {
    const gate = gates[id];
    if (!isPlainObject(gate)) throw new TypeError(`gates.${id} is required`);
    const expectedKind = id === "heart" ? "heart" : "outer";
    if (gate.kind !== expectedKind) throw new RangeError(`gates.${id}.kind must be ${expectedKind}`);
    if (!Number.isFinite(gate.maxIntegrity) || gate.maxIntegrity <= 0) {
      throw new RangeError(`gates.${id} must include a positive maxIntegrity`);
    }
    if (!Number.isFinite(gate.integrity) || gate.integrity < 0 || gate.integrity > gate.maxIntegrity) {
      throw new RangeError(`gates.${id}.integrity must be between zero and maxIntegrity`);
    }
    if (typeof gate.destroyed !== "boolean") throw new TypeError(`gates.${id}.destroyed must be boolean`);
    if (gate.destroyed !== (gate.integrity <= 0)) {
      throw new RangeError(`gates.${id}.destroyed must match zero integrity`);
    }
  }
  return gates;
}

function clampRank(value, track) {
  const rank = toNonNegativeInteger(value, `rank ${track.id}`);
  return Math.min(track.maxRank, rank);
}

function normaliseBoonChoices(value) {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) {
    throw new TypeError("boonChoices must be an object");
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([night, boonId]) => /^\d+$/.test(night) && isNonEmptyString(boonId))
      .sort(([a], [b]) => Number(a) - Number(b)),
  );
}

function normaliseDayworkBenefit(value) {
  if (value !== undefined && value !== null && !isPlainObject(value)) {
    throw new TypeError("dayworkBenefit must be an object");
  }
  return {
    gateRepairDiscountAvailable: Boolean(value?.gateRepairDiscountAvailable),
    consumeReceipt: normaliseDayworkBenefitReceipt(value?.consumeReceipt),
  };
}

function normalisePlayerMedicine(value, runNight) {
  if (value !== undefined && value !== null && !isPlainObject(value)) {
    throw new TypeError("playerMedicine must be an object");
  }
  const night = value?.night ?? runNight;
  if (!Number.isInteger(night) || night < 1 || night > 7) {
    throw new RangeError("player medicine night must be between 1 and 7");
  }
  const prepared = Boolean(value?.prepared);
  const available = Boolean(value?.available);
  if (available && !prepared) throw new RangeError("available player medicine must be prepared");
  const prepareReceipt = normalisePrepareMedicineReceipt(value?.prepareReceipt);
  const consumeReceipt = normaliseConsumeMedicineReceipt(value?.consumeReceipt);
  if (prepareReceipt && prepareReceipt.night !== night) {
    throw new RangeError("field medicine prepare receipt night must match player medicine night");
  }
  if (consumeReceipt && consumeReceipt.night !== night) {
    throw new RangeError("field medicine consume receipt night must match player medicine night");
  }
  // Pre-receipt v4 saves can contain the old boolean-only shape. Do not turn
  // that unauthenticated marker into a free charge; migrate it to the empty
  // canonical state. New receipt-bearing contradictions reject instead.
  if (prepared && !prepareReceipt) return emptyPlayerMedicine(night);
  if (!prepared && (prepareReceipt || consumeReceipt)) {
    throw new RangeError("field medicine receipt requires prepared medicine authority");
  }
  if (prepared && available && consumeReceipt) {
    throw new RangeError("consumed field medicine cannot remain available");
  }
  if (prepared && !available && !consumeReceipt) {
    throw new RangeError("unavailable prepared field medicine requires a consume receipt");
  }
  return {night, prepared, available, prepareReceipt, consumeReceipt};
}

function normaliseRecoveryState(value, phase) {
  if (phase !== GAME_PHASES.INTERWAVE_RECOVERY) {
    if (value !== undefined && value !== null) {
      throw new RangeError("recovery state is valid only during interwave_recovery");
    }
    return null;
  }
  if (!isPlainObject(value)) throw new TypeError("interwave recovery state must be an object");
  if (!Number.isFinite(value.remainingMs) || value.remainingMs < 0 || value.remainingMs > 12_000) {
    throw new RangeError("interwave recovery remainingMs must be between 0 and 12000");
  }
  return {remainingMs: value.remainingMs};
}

function normaliseBellConfirmation(value, run) {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) throw new TypeError("bell confirmation must be an object");
  const receipt = {
    confirmationId: normaliseStableRequestId(value.confirmationId, "bell confirmation ID"),
    briefingSceneId: normaliseStableRequestId(value.briefingSceneId, "bell confirmation briefing scene ID"),
    night: toBoundedInteger(value.night, "bell confirmation night", 1, 7),
    runOrdinal: toPositiveInteger(value.runOrdinal, "bell confirmation run ordinal"),
  };
  const expectedBriefingSceneId = bellkeeperBriefingSceneId(run.night);
  if (receipt.briefingSceneId !== expectedBriefingSceneId
    || !run.narrative.completedSceneIds.includes(expectedBriefingSceneId)) {
    throw new RangeError("bell confirmation requires the completed current-night Bellkeeper briefing");
  }
  return receipt;
}

function validateCadenceAuthority(run, {captureBoundary, waveSnapshot}) {
  const requiresBell = run.phase === GAME_PHASES.COMBAT
    || run.phase === GAME_PHASES.INTERWAVE_RECOVERY;
  if (requiresBell && !run.bellConfirmation) {
    throw new RangeError(`${run.phase} requires a valid bell confirmation`);
  }
  if (run.phase === GAME_PHASES.COMBAT) {
    if (run.wave > 2) throw new RangeError("combat wave must be between 0 and 2");
    if (!captureBoundary && !waveSnapshot && !run.waveStartSnapshot) {
      throw new RangeError("combat requires a wave-start snapshot");
    }
    if (waveSnapshot && run.waveStartSnapshot !== null) {
      throw new RangeError("wave-start snapshot cannot recurse");
    }
    if (run.recovery !== undefined) throw new RangeError("combat cannot retain recovery state");
    if (!captureBoundary && !waveSnapshot) {
      const snapshot = run.waveStartSnapshot;
      if (snapshot.phase !== GAME_PHASES.COMBAT
        || snapshot.waveStartSnapshot !== null
        || snapshot.night !== run.night
        || snapshot.wave !== run.wave
        || snapshot.runSeed !== run.runSeed
        || snapshot.runOrdinal !== run.runOrdinal
        || snapshot.boonPoolVersion !== run.boonPoolVersion
        || JSON.stringify(snapshot.boons) !== JSON.stringify(run.boons)
        || JSON.stringify(snapshot.boonChoices) !== JSON.stringify(run.boonChoices)
        || JSON.stringify(snapshot.bellConfirmation) !== JSON.stringify(run.bellConfirmation)) {
        throw new RangeError("combat requires its exact same-wave wave-start snapshot and bell authority");
      }
    }
  }
  if (run.phase === GAME_PHASES.INTERWAVE_RECOVERY) {
    if (run.wave < 1 || run.wave > 2) throw new RangeError("interwave recovery wave must be 1 or 2");
    if (run.waveStartSnapshot !== null) throw new RangeError("interwave recovery cannot retain a wave-start snapshot");
    if (run.bossEncounter !== null) throw new RangeError("interwave recovery cannot retain a boss encounter");
  }
}

function emptyDayworkBenefit() {
  return {gateRepairDiscountAvailable: false, consumeReceipt: null};
}

function emptyPlayerMedicine(night) {
  return {night, prepared: false, available: false, prepareReceipt: null, consumeReceipt: null};
}

function normaliseDayworkBenefitReceipt(value) {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) throw new TypeError("daywork benefit consume receipt must be an object");
  return {
    eventId: normaliseStableRequestId(value.eventId, "daywork benefit event ID"),
    night: toBoundedInteger(value.night, "daywork benefit receipt night", 1, 7),
    runOrdinal: toPositiveInteger(value.runOrdinal, "daywork benefit receipt run ordinal"),
  };
}

function normalisePrepareMedicineReceipt(value) {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) throw new TypeError("field medicine prepare receipt must be an object");
  return {
    requestId: normaliseStableRequestId(value.requestId, "field medicine prepare request ID"),
    night: toBoundedInteger(value.night, "field medicine prepare receipt night", 1, 7),
    runOrdinal: toPositiveInteger(value.runOrdinal, "field medicine prepare receipt run ordinal"),
  };
}

function normaliseConsumeMedicineReceipt(value) {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) throw new TypeError("field medicine consume receipt must be an object");
  const maxHp = toPositiveNumber(value.maxHp, "field medicine consume receipt maxHp");
  const hpBefore = toFiniteNumber(value.hpBefore, "field medicine consume receipt hpBefore");
  if (hpBefore < 0 || hpBefore >= maxHp) {
    throw new RangeError("field medicine consume receipt vitality is invalid");
  }
  const actorId = normaliseStableRequestId(value.actorId, "field medicine consume actor ID");
  if (!/^warden-[a-z0-9](?:[a-z0-9-]{0,62})$/u.test(actorId)) {
    throw new RangeError("field medicine consume receipt requires a valid Warden actor");
  }
  return {
    requestId: normaliseStableRequestId(value.requestId, "field medicine consume request ID"),
    night: toBoundedInteger(value.night, "field medicine consume receipt night", 1, 7),
    runOrdinal: toPositiveInteger(value.runOrdinal, "field medicine consume receipt run ordinal"),
    actorId,
    hpBefore,
    maxHp,
  };
}

function normaliseStableRequestId(value, name) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:+-]{0,127}$/u.test(value)) {
    throw new RangeError(`${name} must be a stable bounded ID`);
  }
  return value;
}

function toUint32(value, name) {
  const normalised = value ?? 1;
  if (!Number.isInteger(normalised) || normalised < 0 || normalised > 0xffffffff) {
    throw new RangeError(`${name} must be an unsigned 32-bit integer`);
  }
  return normalised >>> 0;
}

function toNonNegativeInteger(value, name) {
  const normalised = value ?? 0;
  if (!Number.isInteger(normalised) || normalised < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
  return normalised;
}

function toPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  return value;
}

function toBoundedInteger(value, name, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function toFiniteNumber(value, name) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}

function toPositiveNumber(value, name) {
  const number = toFiniteNumber(value, name);
  if (number <= 0) throw new RangeError(`${name} must be positive`);
  return number;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function clone(value) {
  return structuredClone(value);
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

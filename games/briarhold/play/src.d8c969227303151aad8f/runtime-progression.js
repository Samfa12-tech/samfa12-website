import {calculateRunBoonEffects} from "./boons.js";
import {BOSS_ENCOUNTERS} from "./campaign-content.js";
import {
  WEAPON_IDS,
  WEAPON_MASTERY_EFFECTS,
  calculateProgressionEffects,
  grantWeaponXp,
  normaliseProfileState,
  normaliseRunState,
  resolveRunLoadout,
} from "./progression.js";

/** Convert one real campaign roster death into the stable host XP ledger. */
export function applyCampaignWeaponKillXp(profile, run, roster, enemyIndex, weaponId) {
  const currentProfile = normaliseProfileState(profile);
  const currentRun = normaliseRunState(run);
  if (!WEAPON_IDS.includes(weaponId)) throw new RangeError(`unknown weapon: ${weaponId}`);
  if (roster?.night !== currentRun.night || roster?.waveIndex !== currentRun.wave) {
    throw new Error("weapon XP roster does not match the active campaign wave");
  }
  const enemy = roster.enemies?.[enemyIndex];
  if (!enemy) throw new RangeError(`unknown campaign enemy index: ${enemyIndex}`);
  const enemyId = `night-${roster.night}:wave-${roster.waveNumber}:${enemy.groupId}:${enemy.groupBodyIndex}`;
  const enemyKind = enemy.boss ? "boss" : enemy.hunter ? "elite" : "ordinary";
  return grantWeaponXp(currentProfile, currentRun, {enemyId, weaponId, enemyKind});
}

/** Apply one actual player-attributed death; XP novelty never gates per-kill weapon effects. */
export function applyCampaignWeaponKillEffects(
  profile,
  run,
  roster,
  enemyIndex,
  weaponId,
  {killed = false, heat = 0, killHeatRefund = 0} = {},
) {
  const currentProfile = normaliseProfileState(profile);
  const currentRun = normaliseRunState(run);
  const currentHeat = Math.max(0, Number(heat) || 0);
  if (!killed) {
    return {profile: currentProfile, run: currentRun, granted: false, heat: currentHeat, refunded: false};
  }
  const xp = applyCampaignWeaponKillXp(currentProfile, currentRun, roster, enemyIndex, weaponId);
  const refund = Math.max(0, Number(killHeatRefund) || 0);
  return {
    ...xp,
    heat: Math.max(0, currentHeat - refund),
    refunded: refund > 0,
  };
}

/** Fixed authored bosses use their stable actor ID rather than a crowd roster index. */
export function campaignBossWeaponEnemyId(run, actorId) {
  const currentRun = normaliseRunState(run);
  if (typeof actorId !== "string" || actorId.length < 1 || actorId.length > 128) {
    throw new TypeError("boss weapon XP actorId must be stable");
  }
  const encounterId = currentRun.bossEncounter?.mode === "authored-director"
    ? currentRun.bossEncounter.encounterId
    : `night-${currentRun.night}-wave-${currentRun.wave + 1}`;
  return `${encounterId}:${actorId}`;
}

export function applyCampaignBossWeaponKillEffects(
  profile,
  run,
  actorId,
  weaponId,
  {killed = false, heat = 0, killHeatRefund = 0} = {},
) {
  const currentProfile = normaliseProfileState(profile);
  const currentRun = normaliseRunState(run);
  const currentHeat = Math.max(0, Number(heat) || 0);
  if (!killed) return {profile: currentProfile, run: currentRun, granted: false, heat: currentHeat, refunded: false};
  const xp = grantWeaponXp(currentProfile, currentRun, {
    enemyId: campaignBossWeaponEnemyId(currentRun, actorId),
    weaponId,
    enemyKind: "boss",
  });
  const refund = Math.max(0, Number(killHeatRefund) || 0);
  return {...xp, heat: Math.max(0, currentHeat - refund), refunded: refund > 0};
}

/** Refresh all once-per-night runtime tokens without touching reward ledgers. */
export function prepareNightRuntimeState(profile, run, options = {}) {
  const currentProfile = normaliseProfileState(profile);
  const currentRun = normaliseRunState(run);
  const effects = calculateProgressionEffects(currentProfile);
  const boons = calculateRunBoonEffects(currentRun);
  const existing = currentRun.nightRuntime?.night === currentRun.night && options.newNight !== true
    ? currentRun.nightRuntime
    : null;
  const next = existing ? structuredClone(existing) : {
    night: currentRun.night,
    twinThorns: {
      available: boons.sharedReviveTokens > 0,
      consumed: false,
      reviveHp: boons.soloReviveHp,
    },
    bellkeeperRally: {
      available: effects.permanent.npcRallyDurationSeconds > 0,
      used: false,
      remaining: 0,
      duration: effects.permanent.npcRallyDurationSeconds,
    },
    courtyardRally: {
      available: effects.warden.breachRallySeconds > 0,
      used: false,
      remaining: 0,
      duration: effects.warden.breachRallySeconds ?? 0,
    },
    lastOath: {
      available: effects.warden.lowHealthHandlingSurgesPerNight > 0,
      used: false,
      remaining: 0,
      duration: effects.warden.lowHealthHandlingSurgeSeconds ?? 0,
    },
  };
  return {...currentRun, nightRuntime: next};
}

/** Consume the solo Twin Thorns token only for an actual zero-HP state. */
export function consumeTwinThornsSoloRevive(run) {
  const current = normaliseRunState(run);
  const token = current.nightRuntime?.twinThorns;
  if (current.player.hp > 0 || !token?.available || token.consumed || token.reviveHp <= 0) {
    return {run: current, revived: false};
  }
  return {
    revived: true,
    run: {
      ...current,
      player: {...current.player, hp: Math.min(current.player.maxHp, token.reviveHp)},
      nightRuntime: {
        ...current.nightRuntime,
        twinThorns: {...token, consumed: true},
      },
    },
  };
}

/** Activate the once-per-night breach and low-health effects idempotently. */
export function activateNightCombatTriggers(profile, run, context = {}) {
  let current = prepareNightRuntimeState(profile, run);
  const runtime = structuredClone(current.nightRuntime);
  const activated = [];
  if (context.outerBreached === true) {
    for (const key of ["bellkeeperRally", "courtyardRally"]) {
      const rally = runtime[key];
      if (!rally?.available || rally.used) continue;
      rally.used = true;
      rally.remaining = rally.duration;
      activated.push(key);
    }
  }
  const lowHealth = Number(context.playerHp) > 0
    && Number(context.playerHp) <= current.player.maxHp * 0.3;
  if (lowHealth && runtime.lastOath?.available && !runtime.lastOath.used) {
    runtime.lastOath.used = true;
    runtime.lastOath.remaining = runtime.lastOath.duration;
    activated.push("lastOath");
  }
  current = {...current, nightRuntime: runtime};
  return {run: current, activated};
}

export function advanceNightRuntimeTimers(run, seconds) {
  const current = normaliseRunState(run);
  if (!current.nightRuntime) return current;
  const dt = Math.max(0, Number(seconds) || 0);
  const nightRuntime = structuredClone(current.nightRuntime);
  for (const key of ["bellkeeperRally", "courtyardRally", "lastOath"]) {
    if (nightRuntime[key]) nightRuntime[key].remaining = Math.max(0, nightRuntime[key].remaining - dt);
  }
  return {...current, nightRuntime};
}

/** Numeric tuning for mechanics already present in the solo runtime. */
export function runtimeProgressionTuning(profile, run, weaponId, context = {}) {
  const effects = calculateProgressionEffects(profile);
  const weaponTiers = effects.weapons[weaponId] ?? {};
  const activeChoices = new Set(Object.values(weaponTiers).map((entry) => entry.id));
  const appliedMasteryIds = [...activeChoices].sort();
  const masteryTuning = activeMasteryTuning(appliedMasteryIds);
  const activeRally = (run?.nightRuntime?.bellkeeperRally?.remaining ?? 0) > 0
    || (run?.nightRuntime?.courtyardRally?.remaining ?? 0) > 0;
  const lowHealthSurge = (run?.nightRuntime?.lastOath?.remaining ?? 0) > 0;
  return Object.freeze({
    appliedMasteryIds: Object.freeze(appliedMasteryIds),
    ...masteryTuning,
    adsActive: Boolean(context.ads),
    adsEnabled: effects.warden.ads === true,
    adsLookMultiplier: context.ads && effects.warden.look === "slower" ? 0.72 : 1,
    movementRecoveryMultiplier: effects.warden.slideMantleRecoveryMultiplier ?? 1,
    adsRecoilMultiplier: context.ads ? effects.warden.adsVisualRecoilMultiplier ?? 1 : 1,
    weaponSwapMultiplier: effects.warden.weaponSwapMultiplier ?? 1,
    overheatCoolingMultiplier: effects.warden.overheatRecoveryStartMultiplier
      ? 1 / effects.warden.overheatRecoveryStartMultiplier
      : 1,
    handlingIntervalMultiplier: lowHealthSurge ? 0.85 : 1,
    npcRallyDurationSeconds: effects.permanent.npcRallyDurationSeconds,
    npcStaggerResistanceMultiplier: activeRally
      ? effects.warden.npcStaggerResistanceMultiplier ?? 1.2
      : 1,
    shotIntervalMultiplier: masteryTuning.shotIntervalMultiplier * (lowHealthSurge ? 0.85 : 1),
  });
}

const MASTERY_TUNING_DEFAULTS = Object.freeze({
  shotIntervalMultiplier: 1,
  directStaggerSeconds: 0,
  adsDamageMultiplier: 1,
  adsShotIntervalMultiplier: 1,
  hipShotIntervalMultiplier: 1,
  minimumArmourMultiplier: 0,
  killHeatRefund: 0,
  heatGainMultiplier: 1,
  passiveCoolingMultiplier: 1,
  beamRangeMultiplier: 1,
  beamHalfAngleMultiplier: 1,
  manualVentBurstDamage: 0,
  manualVentRadius: 0,
  manualVentHeatReduction: 0,
  manualVentCooldownSeconds: 0,
  overheatThreshold: 1,
  overheatDamageMultiplier: 1,
  runeboltShotIntervalMultiplier: 1,
  runeboltHitPaddingMultiplier: 1,
  splashRadiusMultiplier: 1,
  splashDamageMultiplier: 1,
  armourCrackSeconds: 0,
  armourCrackDamageMultiplier: 1,
  terrainRicochetDamageMultiplier: 0,
  terrainRicochetRadius: 0,
  clusterSplitDelaySeconds: 0,
  clusterSplitDamageMultiplier: 0,
  clusterSplitRadius: 0,
  gravityPulseSeconds: 0,
  gravityPulseRadius: 0,
});

/** Canonical mastery metadata owns tuning keys so adding a choice cannot bypass the exhaustive contract. */
export function activeMasteryTuning(choiceIds = []) {
  const tuning = {...MASTERY_TUNING_DEFAULTS};
  for (const choiceId of choiceIds) {
    const modifiers = WEAPON_MASTERY_EFFECTS[choiceId]?.runtime?.modifiers;
    if (!modifiers) continue;
    for (const [key, value] of Object.entries(modifiers)) {
      if (!(key in tuning)) throw new Error(`unknown mastery runtime modifier: ${key}`);
      tuning[key] = key.endsWith("Multiplier")
        ? tuning[key] === 0 ? value : tuning[key] * value
        : Math.max(tuning[key], value);
    }
  }
  return Object.freeze(tuning);
}

/** Bellkeeper/boon wave information without changing enemy release authority. */
export function waveProgressionIntel(profile, roster, run = null) {
  const effects = calculateProgressionEffects(profile);
  const boons = run ? calculateRunBoonEffects(run) : {nextWaveReveal: false, fixedReleaseTelegraphSeconds: 0};
  const revealComposition = effects.permanent.revealNextWaveComposition || boons.nextWaveReveal;
  const schedule = roster?.companySchedule;
  const finalReleaseAt = schedule
    ? Math.max(0, (schedule.companyCount - 1) * schedule.releaseSpacingSeconds)
    : 0;
  const enemies = roster?.enemies ?? roster?.groups ?? [];
  const bossActors = roster?.bossActors ?? (roster?.bossEncounterIds ?? [])
    .filter((id) => BOSS_ENCOUNTERS[id]?.fixedActor)
    .map((id) => ({...BOSS_ENCOUNTERS[id], releaseAt: finalReleaseAt}));
  const names = [...new Set([
    ...enemies.map((enemy) => humanise(enemy.archetype)),
    ...bossActors.map((actor) => actor.title),
  ])];
  const telegraphSeconds = Math.max(
    effects.permanent.eliteBossTelegraphSeconds,
    boons.fixedReleaseTelegraphSeconds ?? 0,
  );
  const seen = new Set();
  const releaseTelegraphs = telegraphSeconds > 0 ? [
    ...enemies.filter((enemy) => enemy.hunter || enemy.boss).flatMap((enemy) => {
      const id = `crowd:${enemy.groupId ?? enemy.id}`;
      if (seen.has(id)) return [];
      seen.add(id);
      const releaseAt = Number.isFinite(enemy.releaseAt) ? enemy.releaseAt : finalReleaseAt;
      return [{
        id,
        kind: "crowd-release",
        label: enemy.boss ? humanise(enemy.archetype) : `${humanise(enemy.archetype)} elites`,
        cueAt: Math.max(0, releaseAt - telegraphSeconds),
        warningSeconds: telegraphSeconds,
      }];
    }),
    ...(run?.bossEncounter && !(run.bossEncounter.mode === "authored-director" && run.bossEncounter.status === "waiting") ? [] : bossActors).map((actor) => ({
      id: `fixed:${actor.id}`,
      kind: "fixed-director",
      label: `${actor.title} · fixed encounter`,
      cueAt: Math.max(0, (Number(actor.releaseAt) || finalReleaseAt) - telegraphSeconds),
      warningSeconds: telegraphSeconds,
    })),
  ] : [];
  const loadout = resolveRunLoadout(run, profile);
  const recommendedWeapon = roster?.recommendedWeapon ?? "arbalest";
  const briefingHint = loadout.weapons.includes(recommendedWeapon)
    ? `${humanise(recommendedWeapon)} is available; the Arbalest and knife remain valid alternatives.`
    : `${humanise(recommendedWeapon)} is optional. Hold with the Arbalest and knife.`;
  return Object.freeze({
    revealComposition,
    compositionLabel: revealComposition ? names.join(", ") : "",
    telegraphSeconds,
    releaseTelegraphs: deepFreeze(releaseTelegraphs),
    briefingHint,
  });
}

function humanise(value) {
  return String(value ?? "unknown").split("-")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : "")
    .join(" ");
}

function deepFreeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) deepFreeze(child);
  }
  return value;
}

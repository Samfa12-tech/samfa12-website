import {
  BARKHIDE_BRUTE,
  BRIARBOUND,
  MOONWRAITH,
  MOSSGUARD_SHIELD,
  ROOT_SAPPER,
  SPOREWING,
  WICKER_COLOSSUS,
  enemyArchetype,
} from "./enemies.js";
import {resolveDensityProfile, subdivideThreatMass} from "./density-profile.js";
import {WEAPON_DEFINITIONS, WEAPON_HEAT} from "./weapons.js";

export const CAMPAIGN_CONTENT_VERSION = 1;
export const CAMPAIGN_COOP_MODIFIERS = deepFreeze({
  ordinaryHpMultiplier: 1.18,
  gatePressureMultiplier: 1.10,
  bossHpMultiplier: 1.25,
  sharedStartingSupplies: 180,
  extraHunterCap: 2,
  rewardMultiplier: 1,
});

export const NIGHT_ONE_WICKER_EMERGENCE = deepFreeze({x: -13, z: 130});

const TYPES = Object.freeze({
  B: [BRIARBOUND, "briarbound"],
  M: [MOSSGUARD_SHIELD, "mossguard-shield"],
  K: [BARKHIDE_BRUTE, "barkhide-brute"],
  R: [ROOT_SAPPER, "root-sapper"],
  S: [SPOREWING, "sporewing"],
  W: [WICKER_COLOSSUS, "wicker-colossus"],
  MW: [MOONWRAITH, "moonwraith"],
});

export const BOSS_ENCOUNTERS = deepFreeze({
  "wicker-colossus": {id: "wicker-colossus", title: "Wicker Colossus", night: 1, fixedActor: false},
  "moss-crowned-matron": {id: "moss-crowned-matron", title: "Moss-Crowned Matron", night: 2, fixedActor: true},
  "root-sapper-prime": {id: "root-sapper-prime", title: "Root-Sapper Prime", night: 3, fixedActor: true},
  "ashwing-matriarch": {id: "ashwing-matriarch", title: "Ashwing Matriarch", night: 4, fixedActor: true},
  "moonless-herald": {id: "moonless-herald", title: "Moonless Herald", night: 5, fixedActor: true},
  "caravan-eater": {id: "caravan-eater", title: "Caravan Eater", night: 6, fixedActor: true},
  "hollow-hart": {id: "hollow-hart", title: "Hollow Hart", night: 7, fixedActor: true},
  cinderwing: {id: "cinderwing", title: "Cinderwing", night: 7, fixedActor: true, flying: true},
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

const POST_TUTORIAL_WAVE_COUNT = 6 * 3;
const BASE_OUTER_GATE_DURABILITY = 800 * 2;
const OUTER_GATE_PRESSURE_PASSES = 3;
const worstCrowdGateDps = enemyArchetype(WICKER_COLOSSUS).attackDamage
  / enemyArchetype(WICKER_COLOSSUS).attackInterval;
const sustainedArbalestSecondsPerBody = WEAPON_DEFINITIONS.arbalest.heat
  / (WEAPON_HEAT.passiveCoolingPerSecond * WEAPON_HEAT.triggerHeldCoolingMultiplier);

// A no-recruit, no-repair run owns only the two starting outer gates. Budget
// their combined durability evenly across Nights 2-7, then conservatively
// account for the Battlefield's exact-contact, granular-solver, and staged
// authored pressure passes at the worst crowd gate DPS. The result is the
// reference-body numerator for the 1 / resolved-roster body-time scale.
export const BASE_LOADOUT_PRESSURE_ENVELOPE = deepFreeze({
  outerGateDurability: BASE_OUTER_GATE_DURABILITY,
  waveCount: POST_TUTORIAL_WAVE_COUNT,
  pressurePasses: OUTER_GATE_PRESSURE_PASSES,
  worstCrowdGateDps,
  sustainedArbalestSecondsPerBody,
  damageBudgetPerWave: BASE_OUTER_GATE_DURABILITY / POST_TUTORIAL_WAVE_COUNT,
  referenceBodies: (BASE_OUTER_GATE_DURABILITY / POST_TUTORIAL_WAVE_COUNT)
    / (worstCrowdGateDps * OUTER_GATE_PRESSURE_PASSES * sustainedArbalestSecondsPerBody),
});

function group(code, share, options = {}) {
  const [type, archetype] = TYPES[code];
  return {
    id: options.id ?? `${code.toLowerCase()}-${archetype}`,
    type,
    archetype,
    threatMass: share,
    hpBudget: options.hpBudget ?? share,
    gatePressureBudget: options.gatePressureBudget ?? share,
    rewardBudget: options.rewardBudget ?? share,
    ...(options.combatHpBudget ? {combatHpBudget: options.combatHpBudget} : {}),
    ...(options.count ? {count: options.count} : {}),
    ...(options.hunter ? {hunter: true} : {}),
    ...(options.boss ? {boss: true} : {}),
  };
}

function wave(night, waveNumber, title, bodyTarget, companySchedule, mix, options = {}) {
  return {
    night,
    waveNumber,
    title,
    bodyTargets: {desktop: bodyTarget, mobile: Math.min(bodyTarget, 2000)},
    companySchedule: {companyCount: companySchedule[0], releaseSpacingSeconds: companySchedule[1]},
    approachAllocation: options.approachAllocation ?? {west: 1},
    groups: mix,
    bossEncounterIds: options.bossEncounterIds ?? [],
    musicCue: options.musicCue ?? (options.bossEncounterIds?.length ? "boss_intro" : "wave_start"),
    briefing: options.briefing ?? `${title}. The Arbalest and knife are a valid plan; specialized tools are optional.`,
    objective: options.objective ?? "Hold Briarhold until the assault breaks.",
    recommendedWeapon: options.recommendedWeapon ?? "arbalest",
    teaches: options.teaches ?? [],
    // This definition-level value records the desktop reference. Roster
    // construction recalculates non-authored values from its resolved body
    // count so mobile and bounded custom densities keep the same envelope.
    outerGatePressureScale: options.outerGatePressureScale
      ?? Math.min(1, BASE_LOADOUT_PRESSURE_ENVELOPE.referenceBodies / bodyTarget),
    outerGatePressureScaleAuthored: Number.isFinite(options.outerGatePressureScale),
  };
}

const SPLIT = {west: 0.5, east: 0.5};

export const CAMPAIGN_WAVES = deepFreeze([
  wave(1, 1, "Thorns at the Treeline", 140, [4, 6], [
    group("B", 1, {id: "wave-1-briarbound", hpBudget: 1, combatHpBudget: 5400}),
  ], {recommendedWeapon: "arbalest", teaches: ["movement", "arbalest", "weapon-heat"], objective: "Thin the first Briarbound surge before it reaches the West Gate.", outerGatePressureScale: 1.8}),
  wave(1, 2, "Roots Against the Wall", 160, [5, 5], [
    group("B", 0.6, {id: "wave-2-briarbound", hpBudget: 4200 / 7200, combatHpBudget: 4200, gatePressureBudget: 0.55, rewardBudget: 0.55}),
    group("M", 0.25, {id: "wave-2-mossguard", hpBudget: 1900 / 7200, combatHpBudget: 1900, gatePressureBudget: 0.25, rewardBudget: 0.25}),
    group("K", 0.15, {id: "wave-2-barkhide", hpBudget: 1100 / 7200, combatHpBudget: 1100, gatePressureBudget: 0.2, rewardBudget: 0.2}),
  ], {recommendedWeapon: "arbalest", teaches: ["traps", "mixed-armour", "repair-pressure", "permanent-armory"], objective: "Use focused Arbalest fire and knife work to break the mixed shield line; prepared traps are optional.", outerGatePressureScale: 1.5}),
  wave(1, 3, "Wings Over the Gate", 200, [6, 5], [
    group("B", 0.55, {id: "wave-3-briarbound", hpBudget: 6000 / 10140, combatHpBudget: 6000, gatePressureBudget: 0.5, rewardBudget: 0.45}),
    group("S", 0.2, {id: "wave-3-sporewing-hunters", hpBudget: 540 / 10140, combatHpBudget: 540, gatePressureBudget: 0, rewardBudget: 0.2, hunter: true, count: 6}),
    group("W", 0.25, {id: "wave-3-wicker-colossus", hpBudget: 3600 / 10140, combatHpBudget: 3600, gatePressureBudget: 0.5, rewardBudget: 0.35, boss: true, count: 1}),
  ], {recommendedWeapon: "arbalest", teaches: ["hunter-pressure", "siege-armour", "mini-boss", "permanent-armory"], objective: "Bring down the Sporewing hunters, then shatter the Wicker Colossus.", bossEncounterIds: ["wicker-colossus"], outerGatePressureScale: 0.3}),
  wave(2, 1, "The Eastern Stirring", 180, [5, 6], [group("B", .7), group("M", .3)], {approachAllocation: SPLIT}),
  wave(2, 2, "Shields in the Rain", 220, [6, 5], [group("B", .45), group("M", .3), group("K", .25)], {approachAllocation: SPLIT}),
  wave(2, 3, "Crown Beneath the Moss", 280, [7, 5], [group("B", .35), group("M", .25), group("R", .2), group("S", .2)], {approachAllocation: SPLIT, bossEncounterIds: ["moss-crowned-matron"]}),
  wave(3, 1, "Charges in the Loam", 240, [5, 5], [group("B", .45), group("M", .25), group("K", .2), group("R", .1)], {approachAllocation: SPLIT}),
  wave(3, 2, "The Wall Has Roots", 300, [6, 4], [group("B", .35), group("K", .25), group("R", .25), group("S", .15)], {approachAllocation: SPLIT}),
  wave(3, 3, "The Deep Fuse", 360, [7, 4], [group("B", .3), group("K", .25), group("R", .2), group("S", .15), group("M", .1)], {approachAllocation: SPLIT, bossEncounterIds: ["root-sapper-prime"]}),
  wave(4, 1, "Cinders on the Wind", 300, [6, 5], [group("B", .4), group("M", .3), group("S", .3)], {approachAllocation: SPLIT}),
  wave(4, 2, "Burning Clearings", 380, [7, 4], [group("B", .3), group("K", .25), group("S", .25), group("R", .2)], {approachAllocation: SPLIT}),
  wave(4, 3, "Black Wings, Red Sky", 480, [8, 4], [group("B", .25), group("M", .2), group("K", .2), group("R", .15), group("S", .2)], {approachAllocation: SPLIT, bossEncounterIds: ["ashwing-matriarch"]}),
  wave(5, 1, "No Moon Above", 360, [6, 5], [group("B", .35), group("M", .25), group("S", .2), group("MW", .2)], {approachAllocation: SPLIT}),
  wave(5, 2, "The Unseen Host", 460, [7, 4], [group("B", .25), group("M", .2), group("R", .2), group("S", .15), group("MW", .2)], {approachAllocation: SPLIT}),
  wave(5, 3, "A Voice Without Shadow", 580, [8, 4], [group("B", .2), group("K", .2), group("R", .2), group("S", .15), group("MW", .25)], {approachAllocation: SPLIT, bossEncounterIds: ["moonless-herald"]}),
  wave(6, 1, "Wheels in the Dark", 450, [7, 4], [group("B", .35), group("K", .25), group("R", .2), group("S", .2)], {approachAllocation: SPLIT}),
  wave(6, 2, "Hold the Road Open", 600, [8, 3], [group("B", .25), group("M", .2), group("K", .2), group("R", .2), group("S", .15)], {approachAllocation: SPLIT}),
  wave(6, 3, "Hunger at the Axles", 800, [9, 3], [group("B", .2), group("K", .2), group("R", .25), group("S", .2), group("M", .15)], {approachAllocation: SPLIT, bossEncounterIds: ["caravan-eater"]}),
  wave(7, 1, "Every Root Advances", 1200, [8, 3], [group("B", .3), group("M", .25), group("K", .2), group("R", .15), group("S", .1)], {approachAllocation: SPLIT}),
  wave(7, 2, "The Forest Walks", 2400, [9, 3], [group("B", .2), group("M", .2), group("K", .2), group("R", .2), group("S", .1), group("W", .1)], {approachAllocation: SPLIT}),
  wave(7, 3, "Fire Over Briarhold", 6000, [10, 3], [group("B", .2), group("M", .15), group("K", .2), group("R", .2), group("S", .15), group("W", .1)], {approachAllocation: SPLIT, bossEncounterIds: ["hollow-hart", "cinderwing"]}),
]);

// Retain the original Night One named export as its own frozen compatibility
// view. Generic campaign records use normalized HP shares, but legacy callers
// consume `bodyTarget` and absolute combat HP budgets.
export const NIGHT_ONE_WAVES = deepFreeze(
  CAMPAIGN_WAVES
    .filter(({night}) => night === 1)
    .map((definition) => ({
      waveNumber: definition.waveNumber,
      title: definition.title,
      objective: definition.objective,
      recommendedWeapon: definition.recommendedWeapon,
      teaches: definition.teaches,
      bodyTarget: definition.bodyTargets.desktop,
      outerGatePressureScale: definition.outerGatePressureScale,
      groups: definition.groups.map((entry) => ({
        id: entry.id,
        type: entry.type,
        archetype: entry.archetype,
        threatMass: entry.threatMass,
        hpBudget: entry.combatHpBudget ?? entry.hpBudget,
        gatePressureBudget: entry.gatePressureBudget,
        rewardBudget: entry.rewardBudget,
        ...(entry.count ? {count: entry.count} : {}),
        ...(entry.hunter ? {hunter: true} : {}),
        ...(entry.boss ? {boss: true} : {}),
      })),
    })),
);
export const NIGHT_ONE_COMPANY_TIMING = deepFreeze(
  CAMPAIGN_WAVES
    .filter(({night}) => night === 1)
    .map(({companySchedule}) => companySchedule),
);

for (const definition of CAMPAIGN_WAVES) assertNormalised(definition);

export function getCampaignWave(night, waveIndex) {
  if (!Number.isInteger(night) || night < 1 || night > 7) throw new RangeError("night must be between 1 and 7");
  if (!Number.isInteger(waveIndex) || waveIndex < 0 || waveIndex > 2) throw new RangeError("waveIndex must be zero-based from 0 to 2");
  return CAMPAIGN_WAVES.find((wave) => wave.night === night && wave.waveNumber === waveIndex + 1);
}

export function buildCampaignWaveRoster(night, waveIndex, densityProfile = "desktop", options = {}) {
  const definition = getCampaignWave(night, waveIndex);
  const profile = resolveDensityProfile(densityProfile);
  const targetBodies = resolveTargetBodies(definition, profile, options);
  // Gate-pressure budgets are already subdivision-normalized. What grows
  // with a larger visible roster is the time a base-loadout Warden needs to
  // remove each body. Keep the provisional pressure-time envelope comparable
  // to the durability-derived base-loadout reference front; Night 1 retains
  // its explicit authored teaching scales.
  const outerGatePressureScale = definition.outerGatePressureScaleAuthored
    ? definition.outerGatePressureScale
    : Math.min(1, BASE_LOADOUT_PRESSURE_ENVELOPE.referenceBodies / targetBodies);
  const fixedBodies = definition.groups.reduce((sum, entry) => sum + (entry.hunter || entry.boss ? entry.count : 0), 0);
  const ordinaryGroupCount = definition.groups.filter((entry) => !entry.hunter && !entry.boss).length;
  if (targetBodies < fixedBodies + ordinaryGroupCount) {
    throw new RangeError(`Wave ${definition.waveNumber} requires at least ${fixedBodies + ordinaryGroupCount} bodies`);
  }
  const subdivision = subdivideThreatMass(definition.groups.map((entry) => ({
    ...entry,
    hpBudget: entry.combatHpBudget ?? entry.hpBudget,
  })), profile, {targetBodies});
  const session = options.session === "coop" ? "coop" : "solo";
  const modifiers = session === "coop" ? CAMPAIGN_COOP_MODIFIERS : null;
  const authoredById = new Map(definition.groups.map((entry) => [entry.id, entry]));
  const balancedGroups = subdivision.groups.map((group) => {
    const authored = authoredById.get(group.id);
    const hpMultiplier = modifiers
      ? authored.boss ? modifiers.bossHpMultiplier : modifiers.ordinaryHpMultiplier
      : 1;
    const gatePressureMultiplier = modifiers?.gatePressureMultiplier ?? 1;
    return {
      ...group,
      hpBudget: group.hpBudget * hpMultiplier,
      hpPerBody: group.hpPerBody * hpMultiplier,
      gatePressureBudget: group.gatePressureBudget * gatePressureMultiplier,
      gatePressurePerBody: group.gatePressurePerBody * gatePressureMultiplier,
    };
  });
  const enemies = [];
  for (const splitGroup of balancedGroups) {
    const authored = authoredById.get(splitGroup.id);
    for (let bodyIndex = 0; bodyIndex < splitGroup.bodyCount; bodyIndex += 1) {
      const rosterIndex = enemies.length;
      const companyIndex = authored.boss ? definition.companySchedule.companyCount - 1 : rosterIndex % definition.companySchedule.companyCount;
      enemies.push(Object.freeze({
        rosterIndex,
        groupId: splitGroup.id,
        groupBodyIndex: bodyIndex,
        type: authored.type,
        archetype: authored.archetype,
        approach: approachForIndex(definition.approachAllocation, rosterIndex, targetBodies),
        // Session balance is applied only at canonical host roster creation.
        // Checkpoint restore and guest presentation copy these values verbatim.
        hp: splitGroup.hpPerBody,
        maxHp: splitGroup.hpPerBody,
        threatMass: splitGroup.threatMassPerBody,
        gatePressure: splitGroup.gatePressurePerBody,
        rewardShare: splitGroup.rewardPerBody,
        fixedActor: splitGroup.fixedCount,
        hunter: splitGroup.hunter,
        boss: splitGroup.boss,
        targetMode: splitGroup.hunter ? "player-hunter" : "lane",
        companyIndex,
        companyCount: definition.companySchedule.companyCount,
        releaseAt: companyIndex * definition.companySchedule.releaseSpacingSeconds,
        ...(authored.id === "wave-3-wicker-colossus" ? NIGHT_ONE_WICKER_EMERGENCE : {}),
      }));
    }
  }
  return deepFreeze({
    night,
    waveIndex,
    waveNumber: definition.waveNumber,
    title: definition.title,
    objective: definition.objective,
    recommendedWeapon: definition.recommendedWeapon,
    teaches: definition.teaches,
    outerGatePressureScale,
    outerGateContactPressureScale: definition.outerGatePressureScaleAuthored ? 1 : outerGatePressureScale,
    profile,
    session,
    coopModifiers: modifiers,
    targetBodies,
    bodyCount: enemies.length,
    groups: balancedGroups,
    enemies,
    bossActors: definition.bossEncounterIds
      .filter((id) => BOSS_ENCOUNTERS[id].fixedActor)
      .map((id) => ({
        ...BOSS_ENCOUNTERS[id],
        hpMultiplier: modifiers?.bossHpMultiplier ?? 1,
        releaseAt: (definition.companySchedule.companyCount - 1) * definition.companySchedule.releaseSpacingSeconds,
      })),
    budgets: {
      threatMass: definition.groups.reduce((total, entry) => total + entry.threatMass, 0),
      hp: definition.groups.reduce((total, entry) => total + entry.hpBudget, 0),
      gatePressure: definition.groups.reduce((total, entry) => total + entry.gatePressureBudget, 0),
      reward: definition.groups.reduce((total, entry) => total + entry.rewardBudget, 0),
    },
  });
}

function resolveTargetBodies(definition, profile, options) {
  const requested = positiveInteger(options.targetBodies) ?? definition.bodyTargets[profile.id];
  const maxBodies = positiveInteger(options.maxBodies) ?? profile.concurrentBodyTarget;
  return Math.min(requested, maxBodies, profile.concurrentBodyTarget);
}

function approachForIndex(allocation, index, count) {
  let cursor = 0;
  for (const [approach, share] of Object.entries(allocation)) {
    cursor += share * count;
    if (index < cursor) return approach;
  }
  return Object.keys(allocation).at(-1);
}

function assertNormalised(definition) {
  for (const key of ["threatMass", "hpBudget", "gatePressureBudget", "rewardBudget"]) {
    const total = definition.groups.reduce((sum, entry) => sum + entry[key], 0);
    if (Math.abs(total - 1) > 1e-9) throw new RangeError(`Night ${definition.night} wave ${definition.waveNumber} ${key} must total 1`);
  }
  const allocation = Object.values(definition.approachAllocation).reduce((sum, value) => sum + value, 0);
  if (Math.abs(allocation - 1) > 1e-9) throw new RangeError(`Night ${definition.night} wave ${definition.waveNumber} approach allocation must total 1`);
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

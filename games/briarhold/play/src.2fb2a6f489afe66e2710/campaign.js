import {
  EMERGENCY_PALISADE_COST,
  EMERGENCY_PALISADE_STRENGTH,
  STARTING_SUPPLIES,
  calculateNightRewards,
  quoteAffordableRepair,
} from "./economy.js";
import {CAMPAIGN_WAVES} from "./campaign-content.js";

export const CAMPAIGN_STATE_VERSION = 1;

export const CAMPAIGN_PHASES = Object.freeze({
  DAWN: "dawn",
  COMBAT: "combat",
  NIGHT_COMPLETE: "night_complete",
  CAMPAIGN_COMPLETE: "campaign_complete",
  GAME_OVER: "game_over",
});

/** Public solo runtime status after deterministic 7x3 integration. */
export const CAMPAIGN_CONTENT_STATUS = deepFreeze({
  contentReady: true,
  runtimeReady: true,
  label: "Complete seven-night solo campaign · 21 player-started waves · saveable at every boundary.",
});

export const GATE_IDS = Object.freeze({
  WEST: "west",
  EAST: "east",
  HEART: "heart",
});

const OUTER_GATE_INTEGRITY = 100;
const HEART_GATE_INTEGRITY = 160;

/** Canonical scope copy for consumers rendering the first playable. */
export const FIRST_PLAYABLE_STATUS = deepFreeze({
  playableNights: 7,
  plannedCampaignNights: 7,
  label: "Public alpha · Complete seven-night solo campaign",
  completionTitle: "Campaign complete",
  completionMessage:
    "Briarhold has survived all seven nights. The Warden's carried rewards are banked at this terminal victory.",
});

/** Setup consequences that are active in the current first playable. */
export const FIRST_PLAYABLE_SETUP_GUIDANCE = deepFreeze({
  summary:
    "A new profile begins with the Arbalest and knife. Recruited specialists teach permanent defence recipes, relationship trust opens advanced tools, and banked Oathmarks commission weapons across runs.",
  consequences: [
    "Barricades shift an approach stream sideways.",
    "Thorn snares slow enemies inside their radius.",
    "Sunfire pots detonate once when an enemy reaches the socket.",
    "Crewed ballistae automatically damage one nearby target at a measured cadence.",
    "Gate repairs restore as much missing integrity as current Supplies can afford.",
    "Ward lanterns have no current combat effect; Night 5 spectral mechanics remain fixed-encounter director work.",
  ],
});

/**
 * Seven authored records form the complete campaign. `firstPlayable` remains
 * a compatibility field for older consumers; every record is now playable.
 */
export const NIGHT_DEFINITIONS = deepFreeze([
  {
    id: 1,
    title: "The Thorn Wake",
    firstPlayable: true,
    activeApproaches: ["west"],
    teaches: ["repeating-arbalest", "weapon-heat", "permanent-armory", "gate-repair"],
    enemies: ["briarbound"],
    briefing:
      "The Briar Host is advancing only on the western approach. Take the Arbalest and knife to the ramparts; recruited specialists provide any optional defences.",
    objective: null,
    outcome:
      "The western assault is cleared. Earned Supplies carry into the next dawn, and damage to every gate remains.",
    boss: null,
    assaultCount: campaignWaveCount(1),
  },
  {
    id: 2,
    title: "Split Roots",
    firstPlayable: true,
    activeApproaches: ["west", "east"],
    teaches: ["station-switching", "two-front-pressure"],
    enemies: ["briarbound", "mossguard"],
    briefing:
      "Both approaches are active. Switching stations takes 1.5 seconds and prevents firing until the crossing is complete.",
    objective: {
      id: "hold-east-gate",
      label: "Finish the assault with the east outer gate intact",
      optional: true,
      completionRule: "east-outer-gate-intact",
    },
    outcome:
      "Both approach streams are cleared. The optional objective succeeds only if the east outer gate is still intact when the night ends.",
    boss: null,
    assaultCount: campaignWaveCount(2),
  },
  {
    id: 3,
    title: "The Barkbreaker",
    firstPlayable: true,
    activeApproaches: ["west", "east"],
    teaches: ["siege-armour", "courtyard-combat"],
    enemies: ["briarbound", "barkhide", "root-sapper"],
    briefing:
      "Barkhides and Root-Sappers reinforce both approaches. A siege-class Wicker Colossus closes the assault; a trusted Quartermaster can commission optional Runebolts, while the Arbalest and knife remain valid.",
    objective: null,
    outcome:
      "The Barkbreaker falls. Briarhold carries its earned strength into Night 4.",
    boss: "barkbreaker",
    assaultCount: campaignWaveCount(3),
  },
  {
    id: 4,
    title: "Ash Rain",
    firstPlayable: true,
    activeApproaches: ["west", "east"],
    teaches: ["burning-clearings", "route-changes", "visibility-hazards"],
    enemies: ["briarbound", "mossguard", "sporewing"],
    objective: null,
    boss: null,
    assaultCount: campaignWaveCount(4),
  },
  {
    id: 5,
    title: "The Moonless Host",
    firstPlayable: true,
    activeApproaches: ["west", "east"],
    teaches: ["ward-light", "spectral-reveal"],
    enemies: ["briarbound", "moonwraith", "wicker-colossus"],
    objective: null,
    boss: null,
    assaultCount: campaignWaveCount(5),
  },
  {
    id: 6,
    title: "The Last Caravan",
    firstPlayable: true,
    activeApproaches: ["west", "east"],
    teaches: ["open-gate-risk", "evacuation"],
    enemies: ["briarbound", "barkhide", "root-sapper", "sporewing"],
    objective: {
      id: "last-caravan",
      label: "Hold an outer gate open until the evacuees reach Briarhold",
      optional: true,
    },
    boss: null,
    assaultCount: campaignWaveCount(6),
  },
  {
    id: 7,
    title: "The Hollow Hart",
    firstPlayable: true,
    activeApproaches: ["west", "east", "courtyard"],
    teaches: ["multi-stage-boss", "boss-rerouting"],
    enemies: [
      "briarbound",
      "mossguard",
      "barkhide",
      "root-sapper",
      "sporewing",
      "wicker-colossus",
    ],
    objective: null,
    boss: "hollow-hart",
    assaultCount: campaignWaveCount(7),
  },
]);

export const FIRST_PLAYABLE_NIGHTS = Object.freeze(
  NIGHT_DEFINITIONS.filter((night) => night.firstPlayable),
);

/**
 * @typedef {"dawn"|"combat"|"night_complete"|"campaign_complete"|"game_over"} CampaignPhase
 */

/**
 * @typedef {object} GateState
 * @property {string} id
 * @property {"outer"|"heart"} kind
 * @property {number} maxIntegrity
 * @property {number} integrity
 * @property {boolean} destroyed
 * @property {{used: boolean, integrity: number, maxIntegrity: number}} emergencyPalisade
 */

/**
 * @typedef {object} CampaignState
 * @property {number} version
 * @property {CampaignPhase} phase
 * @property {number} currentNight
 * @property {number[]} completedNights
 * @property {number} supplies
 * @property {number} oathmarksEarned
 * @property {Record<string, GateState>} gates
 * @property {Record<string, unknown>} planning
 * @property {object|null} dawnSnapshot
 * @property {object|null} lastNightResult
 * @property {string|null} gameOverReason
 */

/**
 * @param {{startingSupplies?: number, oathmarksEarned?: number}} [options]
 * @returns {CampaignState}
 */
export function createCampaignState(options = {}) {
  const startingSupplies = options.startingSupplies ?? STARTING_SUPPLIES;
  assertNonNegativeInteger(startingSupplies, "startingSupplies");
  const oathmarksEarned = options.oathmarksEarned ?? 0;
  assertNonNegativeInteger(oathmarksEarned, "oathmarksEarned");

  return {
    version: CAMPAIGN_STATE_VERSION,
    phase: CAMPAIGN_PHASES.DAWN,
    currentNight: 1,
    completedNights: [],
    supplies: startingSupplies,
    oathmarksEarned,
    gates: {
      [GATE_IDS.WEST]: createGate(GATE_IDS.WEST, "outer", OUTER_GATE_INTEGRITY),
      [GATE_IDS.EAST]: createGate(GATE_IDS.EAST, "outer", OUTER_GATE_INTEGRITY),
      [GATE_IDS.HEART]: createGate(GATE_IDS.HEART, "heart", HEART_GATE_INTEGRITY),
    },
    planning: {},
    dawnSnapshot: null,
    lastNightResult: null,
    gameOverReason: null,
  };
}

/**
 * Record serialisable dawn choices such as installed fortifications. Planning
 * data is deliberately opaque to keep this module independent of battlefield
 * implementations.
 *
 * @param {CampaignState} state
 * @param {Record<string, unknown>} planning
 * @returns {CampaignState}
 */
export function setDawnPlanning(state, planning) {
  assertPhase(state, CAMPAIGN_PHASES.DAWN);
  if (!planning || typeof planning !== "object" || Array.isArray(planning)) {
    throw new TypeError("planning must be a plain serialisable object");
  }
  return { ...state, planning: clone(planning) };
}

/**
 * Enter combat and store its authoritative restart point.
 *
 * @param {CampaignState} state
 * @returns {CampaignState}
 */
export function beginCombat(state) {
  assertPhase(state, CAMPAIGN_PHASES.DAWN);
  const combatState = {
    ...clone(state),
    phase: CAMPAIGN_PHASES.COMBAT,
    dawnSnapshot: null,
    lastNightResult: null,
  };
  combatState.dawnSnapshot = createSnapshot(combatState);
  return combatState;
}

/**
 * @param {CampaignState} state
 * @param {{
 *   assaultsCleared?: number,
 *   elitesKilled?: number,
 *   optionalObjectiveCompleted?: boolean
 * }} result
 * @returns {CampaignState}
 */
export function completeNight(state, result = {}) {
  assertPhase(state, CAMPAIGN_PHASES.COMBAT);
  const night = getNightDefinition(state.currentNight);
  const assaultsCleared = result.assaultsCleared ?? night.assaultCount;
  if (assaultsCleared > night.assaultCount) {
    throw new RangeError("assaultsCleared exceeds the authored night total");
  }
  if (
    result.optionalObjectiveCompleted &&
    (!night.objective || !night.objective.optional)
  ) {
    throw new Error("this night has no optional objective");
  }

  const campaignCompleted = state.currentNight === NIGHT_DEFINITIONS.length;
  const reward = calculateNightRewards({
    completed: true,
    assaultsCleared,
    elitesKilled: result.elitesKilled ?? 0,
    optionalObjectiveCompleted: Boolean(result.optionalObjectiveCompleted),
    campaignCompleted,
  });
  const nightResult = {
    nightId: state.currentNight,
    assaultsCleared,
    elitesKilled: result.elitesKilled ?? 0,
    optionalObjectiveCompleted: Boolean(result.optionalObjectiveCompleted),
    rewards: reward,
  };

  return {
    ...state,
    phase: CAMPAIGN_PHASES.NIGHT_COMPLETE,
    completedNights: [...new Set([...state.completedNights, state.currentNight])],
    supplies: state.supplies + reward.supplies,
    oathmarksEarned: state.oathmarksEarned + reward.oathmarks,
    dawnSnapshot: null,
    lastNightResult: nightResult,
  };
}

/**
 * Move a completed night to the next dawn, or close the campaign after night 7.
 *
 * @param {CampaignState} state
 * @returns {CampaignState}
 */
export function advanceFromNightComplete(state) {
  assertPhase(state, CAMPAIGN_PHASES.NIGHT_COMPLETE);
  if (state.currentNight >= NIGHT_DEFINITIONS.length) {
    return { ...state, phase: CAMPAIGN_PHASES.CAMPAIGN_COMPLETE };
  }
  return {
    ...state,
    phase: CAMPAIGN_PHASES.DAWN,
    currentNight: state.currentNight + 1,
    planning: {},
    lastNightResult: null,
  };
}

/**
 * Damage a gate. A rebuilt palisade absorbs damage before its ruined outer
 * gate. Destroying the Heart Gate immediately ends the campaign.
 *
 * @param {CampaignState} state
 * @param {string} gateId
 * @param {number} damage
 * @returns {CampaignState}
 */
export function damageGate(state, gateId, damage) {
  assertPositiveNumber(damage, "damage");
  if (
    state.phase !== CAMPAIGN_PHASES.COMBAT &&
    state.phase !== CAMPAIGN_PHASES.DAWN
  ) {
    throw new Error(`cannot damage a gate during ${state.phase}`);
  }
  const gate = clone(getGate(state, gateId));

  if (gate.emergencyPalisade.integrity > 0) {
    gate.emergencyPalisade.integrity = Math.max(
      0,
      gate.emergencyPalisade.integrity - damage,
    );
  } else if (!gate.destroyed) {
    gate.integrity = Math.max(0, gate.integrity - damage);
    gate.destroyed = gate.integrity === 0;
  }

  const next = withGate(state, gate);
  if (gate.kind === "heart" && gate.destroyed) {
    return {
      ...next,
      phase: CAMPAIGN_PHASES.GAME_OVER,
      dawnSnapshot: null,
      gameOverReason: "heart_gate_destroyed",
    };
  }
  return next;
}

/**
 * Repair a damaged but intact gate during dawn.
 *
 * @param {CampaignState} state
 * @param {string} gateId
 * @param {number} requestedIntegrity
 * @returns {CampaignState}
 */
export function repairGate(state, gateId, requestedIntegrity) {
  assertPhase(state, CAMPAIGN_PHASES.DAWN);
  assertNonNegativeInteger(requestedIntegrity, "requestedIntegrity");
  const gate = clone(getGate(state, gateId));
  if (gate.destroyed) {
    throw new Error("destroyed gates cannot be repaired");
  }

  const quote = quoteAffordableRepair({
    requestedIntegrity,
    missingIntegrity: gate.maxIntegrity - gate.integrity,
    supplies: state.supplies,
  });
  if (quote.integrity === 0) {
    return state;
  }
  gate.integrity += quote.integrity;
  return {
    ...withGate(state, gate),
    supplies: state.supplies - quote.cost,
  };
}

/**
 * Install the single 35%-strength emergency palisade available to each ruined
 * outer gate per campaign.
 *
 * @param {CampaignState} state
 * @param {string} gateId
 * @returns {CampaignState}
 */
export function installEmergencyPalisade(state, gateId) {
  assertPhase(state, CAMPAIGN_PHASES.DAWN);
  const gate = clone(getGate(state, gateId));
  if (gate.kind !== "outer") {
    throw new Error("the Heart Gate cannot receive an emergency palisade");
  }
  if (!gate.destroyed) {
    throw new Error("emergency palisades require a destroyed outer gate");
  }
  if (gate.emergencyPalisade.used) {
    throw new Error("this gate has already used its emergency palisade");
  }
  if (state.supplies < EMERGENCY_PALISADE_COST) {
    throw new Error("not enough Supplies for an emergency palisade");
  }

  const maxIntegrity = Math.round(
    gate.maxIntegrity * EMERGENCY_PALISADE_STRENGTH,
  );
  gate.emergencyPalisade = {
    used: true,
    integrity: maxIntegrity,
    maxIntegrity,
  };
  return {
    ...withGate(state, gate),
    supplies: state.supplies - EMERGENCY_PALISADE_COST,
  };
}

/**
 * Apply the suspension/reload rule to a hydrated save.
 *
 * @param {CampaignState} state
 * @returns {CampaignState}
 */
export function applyCombatReloadPolicy(state) {
  if (state.phase !== CAMPAIGN_PHASES.COMBAT) {
    return clone(state);
  }
  if (!state.dawnSnapshot) {
    throw new Error("combat save is missing its dawn snapshot");
  }

  const restarted = clone(state.dawnSnapshot);
  restarted.dawnSnapshot = createSnapshot(restarted);
  return restarted;
}

/**
 * @param {number} id
 */
export function getNightDefinition(id) {
  const night = NIGHT_DEFINITIONS.find((definition) => definition.id === id);
  if (!night) {
    throw new RangeError(`unknown night: ${id}`);
  }
  return night;
}

function createGate(id, kind, maxIntegrity) {
  return {
    id,
    kind,
    maxIntegrity,
    integrity: maxIntegrity,
    destroyed: false,
    emergencyPalisade: { used: false, integrity: 0, maxIntegrity: 0 },
  };
}

function campaignWaveCount(night) {
  return CAMPAIGN_WAVES.filter((wave) => wave.night === night).length;
}

function getGate(state, gateId) {
  const gate = state.gates?.[gateId];
  if (!gate) {
    throw new RangeError(`unknown gate: ${gateId}`);
  }
  return gate;
}

function withGate(state, gate) {
  return {
    ...state,
    gates: { ...state.gates, [gate.id]: gate },
  };
}

function createSnapshot(state) {
  return clone({ ...state, dawnSnapshot: null });
}

function assertPhase(state, expected) {
  if (state.phase !== expected) {
    throw new Error(`expected campaign phase ${expected}, received ${state.phase}`);
  }
}

function assertNonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function assertPositiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive number`);
  }
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

/**
 * Pure relationship challenge accumulation and daytime reporting.
 *
 * Runtime systems supply stable authoritative events. This module deliberately
 * has no renderer, storage, combat, dialogue, or network dependency.
 */

import {HUB_NPC_IDS, HUB_NPC_UNLOCK_ORDER} from "./hub.js";
import {
  normaliseNarrativeProfileState,
  normaliseNarrativeRunState,
} from "./narrative-state.js";

export const RELATIONSHIP_STATUSES = Object.freeze(["new", "known", "trusted", "bonded"]);

const STATUS_INDEX = new Map(RELATIONSHIP_STATUSES.map((status, index) => [status, index]));
const NIGHT_RESET = "Resets when a new night begins.";
const STREAK_RESET = "Resets on the named invalidating event and terminal settlement.";
const CUMULATIVE = "Persists across attempts after acceptance.";
const NO_RESET = "Qualifying evidence remains latched until reported.";
const MAX_GOAL_DEDUPE_IDS = 64;
const REPORT_LEDGER_ID = "relationship-reports";
const LIFECYCLE_LEDGER_ID = "relationship-lifecycle";
const EVENT_FLAG_PREFIX = "event-";
const END_DEBT_LATCH = "endDebtQualified";

export const RELATIONSHIP_GOALS = deepFreeze([
  goal("nell-briefing", HUB_NPC_IDS.BELLKEEPER, "Use the Briefing", "briefing-night", 1, NIGHT_RESET,
    reward({"bellkeepers-watch": 1})),
  goal("nell-outer-gates", HUB_NPC_IDS.BELLKEEPER, "Keep Both Gates", "night-condition", 1, NIGHT_RESET,
    reward({"bellkeepers-watch": 2})),
  goal("nell-all-survive", HUB_NPC_IDS.BELLKEEPER, "Bring Them Through", "night-condition", 1, NIGHT_RESET,
    reward({"bellkeepers-watch": 3})),
  goal("orin-repair-600", HUB_NPC_IDS.MASON, "Repair the Hold", "cumulative-repair", 600, CUMULATIVE,
    reward({"masons-oath": 1})),
  goal("orin-gates-half", HUB_NPC_IDS.MASON, "Leave No Gap", "night-condition", 1, NIGHT_RESET,
    reward({"masons-oath": 3})),
  goal("orin-heart-strong", HUB_NPC_IDS.MASON, "Protect the Heart", "night-condition", 1, NIGHT_RESET,
    reward({"masons-oath": 5})),
  goal("tamsin-knife-21", HUB_NPC_IDS.QUARTERMASTER, "Close Work", "actor-streak", 21, STREAK_RESET,
    reward({"armory-temper": 1, quartermaster: 1}, {unlockIds: ["sunfire-prism"]})),
  goal("tamsin-sunfire-40", HUB_NPC_IDS.QUARTERMASTER, "Keep It Cool", "night-counter", 40, NIGHT_RESET,
    reward({"armory-temper": 3, quartermaster: 3}, {unlockIds: ["split-runebolt"]})),
  goal("tamsin-full-rack", HUB_NPC_IDS.QUARTERMASTER, "Use the Full Rack", "weapon-rack", 46, NIGHT_RESET,
    reward({"armory-temper": 5, quartermaster: 5}), {requiresUnlockIds: ["sunfire-prism", "split-runebolt"]}),
  goal("fen-snare-21", HUB_NPC_IDS.TRAPPER, "Set the First Line", "distinct-targets", 21, NIGHT_RESET,
    reward({"field-craft": 1}, {recipeIds: ["firePot"]})),
  goal("fen-firepot-12", HUB_NPC_IDS.TRAPPER, "One Good Pot", "single-detonation", 12, NIGHT_RESET,
    reward({"field-craft": 3}, {recipeIds: ["ballista"]})),
  goal("fen-defence-50", HUB_NPC_IDS.TRAPPER, "Let the Defences Work", "night-counter", 50, NIGHT_RESET,
    reward({"field-craft": 5})),
  goal("edda-boon-night", HUB_NPC_IDS.GREENWARDEN, "Carry a Boon", "night-condition", 1, NIGHT_RESET,
    reward({"wardens-vigor": 1})),
  goal("edda-all-survive", HUB_NPC_IDS.GREENWARDEN, "Keep Everyone Alive", "night-condition", 1, NIGHT_RESET,
    reward({"wardens-vigor": 3})),
  goal("edda-end-debt", HUB_NPC_IDS.GREENWARDEN, "End the Debt", "latched-ending", 1, NO_RESET,
    reward({"wardens-vigor": 5})),
]);

const GOAL_BY_ID = new Map(RELATIONSHIP_GOALS.map((entry) => [entry.id, entry]));
const GOALS_BY_NPC = new Map(HUB_NPC_UNLOCK_ORDER.map((npcId) => [
  npcId,
  RELATIONSHIP_GOALS.filter((entry) => entry.npcId === npcId),
]));

export function relationshipRankCeiling(npcId, status) {
  if (!GOALS_BY_NPC.has(npcId)) throw new RangeError(`unknown relationship NPC: ${npcId}`);
  if (!STATUS_INDEX.has(status)) throw new RangeError(`unknown relationship status: ${status}`);
  if (npcId === HUB_NPC_IDS.BELLKEEPER) return [0, 1, 2, 3][STATUS_INDEX.get(status)];
  return [0, 1, 3, 5][STATUS_INDEX.get(status)];
}

export function acceptRelationshipGoal(state, npcId, goalId, options = {}) {
  requireHost(options);
  const definition = GOAL_BY_ID.get(goalId);
  if (!definition || definition.npcId !== npcId) throw new RangeError(`unknown ${npcId} relationship goal: ${goalId}`);
  const next = cloneGoalState(state);
  const record = requireRecord(next.relationships, npcId);
  if (record.activeGoalId === goalId || record.readyGoalId === goalId) return next;
  if (record.activeGoalId !== null) throw new Error(`${npcId} already has an active goal`);
  if (record.readyGoalId !== null) throw new Error(`${npcId} already has a goal ready to report`);
  const expected = nextGoal(record, npcId);
  if (expected?.id !== goalId) throw new Error(`${goalId} is not ${npcId}'s next goal`);
  if (!requirementsMet(definition, options)) throw new Error(`${definition.title} is locked until both commissioned weapons are owned`);

  next.runNarrative.goalProgress[goalId] ??= emptyProgress();
  if (goalId === "edda-end-debt"
    && (record.cumulative[END_DEBT_LATCH] ?? 0) >= 1) {
    record.readyGoalId = goalId;
    record.activeGoalId = null;
    delete next.runNarrative.goalProgress[goalId];
  } else {
    record.activeGoalId = goalId;
  }
  return next;
}

export function applyRelationshipGoalEvent(state, event, options = {}) {
  requireHost({role: options.role ?? event?.role});
  if (!isPlainObject(event) || typeof event.type !== "string" || event.type.length === 0) {
    throw new TypeError("relationship goal event requires a type");
  }
  const next = cloneGoalState(state);
  if (!stableId(event.eventId)) return next;

  if (event.type === "terminal-settlement") {
    const lifecycle = next.runNarrative.goalProgress[LIFECYCLE_LEDGER_ID] ?? emptyProgress();
    if (!acceptLifecycleEvent(lifecycle, event)) return next;
    next.runNarrative.goalProgress = {[LIFECYCLE_LEDGER_ID]: lifecycle};
    return next;
  }
  if (event.type === "night-begin") {
    const lifecycle = next.runNarrative.goalProgress[LIFECYCLE_LEDGER_ID] ?? emptyProgress();
    if (!acceptLifecycleEvent(lifecycle, event)) return next;
    next.runNarrative.goalProgress[LIFECYCLE_LEDGER_ID] = lifecycle;
    for (const record of Object.values(next.relationships)) {
      const definition = GOAL_BY_ID.get(record.activeGoalId);
      if (definition?.resetRule === NIGHT_RESET) {
        next.runNarrative.goalProgress[definition.id] = emptyProgress();
      }
    }
    return next;
  }

  // End-the-debt is the one authored exception that may latch before its goal
  // is offered. It still cannot advance status until the prior reports occur.
  const edda = requireRecord(next.relationships, HUB_NPC_IDS.GREENWARDEN);
  if (qualifiesEndDebt(next, event)) {
    edda.cumulative[END_DEBT_LATCH] = 1;
    if (edda.activeGoalId === "edda-end-debt") {
      markReady(edda, "edda-end-debt");
      delete next.runNarrative.goalProgress["edda-end-debt"];
    }
  }

  for (const [npcId, record] of Object.entries(next.relationships)) {
    const goalId = record.activeGoalId;
    if (!goalId) continue;
    const definition = GOAL_BY_ID.get(goalId);
    if (!definition || definition.npcId !== npcId) continue;
    if (!eventRelevantToGoal(definition, event)) continue;
    const goalProgress = next.runNarrative.goalProgress[goalId] ?? emptyProgress();
    if (hasProcessedEvent(goalProgress, event.eventId) || !rememberEvent(goalProgress, event.eventId)) continue;
    next.runNarrative.goalProgress[goalId] = goalProgress;
    applyEventToGoal(record, goalProgress, definition, event);
    if (record.readyGoalId === goalId) delete next.runNarrative.goalProgress[goalId];
  }
  if (options.autoReportEnding === true && qualifiesEndDebt(next, event)) {
    const edda = requireRecord(next.relationships, HUB_NPC_IDS.GREENWARDEN);
    if (edda.readyGoalId === "edda-end-debt") {
      return reportRelationshipGoal(next, HUB_NPC_IDS.GREENWARDEN, {
        role: "host",
        eventId: `${event.eventId}-ending-report`,
        goalId: "edda-end-debt",
        phase: options.phase,
        automaticEnding: true,
        npcAlive: true,
      });
    }
  }
  return next;
}

export function reportRelationshipGoal(state, npcId, options = {}) {
  requireHost(options);
  if (!stableId(options.eventId)) throw new TypeError("relationship report requires a stable eventId idempotency key");
  if (!stableId(options.goalId)) throw new TypeError("relationship report requires a stable goalId");
  const next = cloneGoalState(state);
  const record = requireRecord(next.relationships, npcId);
  if (record.completedGoalIds.includes(options.goalId)) return next;
  if (record.readyGoalId === null) return next;
  if (record.readyGoalId !== options.goalId) return next;
  const definition = GOAL_BY_ID.get(record.readyGoalId);
  if (!definition || definition.npcId !== npcId) throw new RangeError(`invalid ready goal for ${npcId}`);
  const phase = options.phase ?? options.run?.phase;
  const endingReport = options.automaticEnding === true
    && definition.id === "edda-end-debt" && phase === "campaign_complete";
  if (phase !== "daytime" && !endingReport) throw new Error("relationship goals may only be reported during daytime");
  if (!isLivingNpc(npcId, options)) throw new Error(`reporting requires the living ${humanise(npcId)}`);
  const reportLedger = next.runNarrative.goalProgress[REPORT_LEDGER_ID] ?? emptyProgress();
  if (hasProcessedEvent(reportLedger, options.eventId) || !rememberEvent(reportLedger, options.eventId)) return next;
  next.runNarrative.goalProgress[REPORT_LEDGER_ID] = reportLedger;

  record.completedGoalIds = uniqueIds([...record.completedGoalIds, definition.id]);
  record.status = RELATIONSHIP_STATUSES[Math.min(3, STATUS_INDEX.get(record.status) + 1)];
  record.readyGoalId = null;
  record.activeGoalId = null;
  if (definition.id === "edda-end-debt") delete record.cumulative[END_DEBT_LATCH];
  delete next.runNarrative.goalProgress[definition.id];
  return next;
}

export function createRelationshipGoalModel(state, npcId, options = {}) {
  const current = cloneGoalState(state);
  const record = requireRecord(current.relationships, npcId);
  const active = record.activeGoalId ? GOAL_BY_ID.get(record.activeGoalId) : null;
  const ready = record.readyGoalId ? GOAL_BY_ID.get(record.readyGoalId) : null;
  const offer = !active && !ready ? nextGoal(record, npcId) : null;
  return deepFreeze({
    npcId,
    status: record.status,
    active: active ? presentGoal(active, record, progressForGoal(current, active.id), options) : null,
    ready: ready ? presentGoal(ready, record, progressForGoal(current, ready.id), options) : null,
    offer: offer ? presentGoal(offer, record, progressForGoal(current, offer.id), options) : null,
    completedGoalIds: [...record.completedGoalIds],
    completedRewards: record.completedGoalIds
      .map((goalId) => GOAL_BY_ID.get(goalId)?.reward)
      .filter(Boolean)
      .map(clone),
  });
}

function applyEventToGoal(record, goalProgress, definition, event) {
  rememberNightFacts(goalProgress, event);
  switch (definition.id) {
    case "nell-briefing":
      if (event.type === "briefing-reviewed" && event.complete !== false) addFlag(goalProgress, "briefing-reviewed");
      if (event.type === "night-complete" && hasFlag(goalProgress, "briefing-reviewed")) markReady(record, definition.id);
      break;
    case "nell-outer-gates":
      if (event.type === "night-complete" && bothOuterGates(gatesFor(goalProgress, event), (gate) => !gateBreached(gate))) markReady(record, definition.id);
      break;
    case "nell-all-survive":
      if (event.type === "night-complete" && event.night >= 5 && allStartingSurvived(goalProgress, event)) markReady(record, definition.id);
      break;
    case "orin-repair-600":
      if (event.type === "repair") {
        const amount = nonNegativeNumber(event.amount ?? event.integrityRestored);
        record.cumulative.repairedIntegrity = (record.cumulative.repairedIntegrity ?? 0) + amount;
        if (record.cumulative.repairedIntegrity >= 600) markReady(record, definition.id);
      }
      break;
    case "orin-gates-half":
      if (event.type === "night-complete" && bothOuterGates(gatesFor(goalProgress, event), (gate) => gateRatio(gate) > 0.5)) markReady(record, definition.id);
      break;
    case "orin-heart-strong":
      {
        const gates = gatesFor(goalProgress, event);
        if (event.type === "night-complete" && event.night >= 4
          && gateRatio(gates.heart) >= 0.75
          && bothOuterGates(gates, (gate) => !gateDestroyed(gate))) markReady(record, definition.id);
        break;
      }
    case "tamsin-knife-21":
      applyKnifeStreak(goalProgress, event);
      if (Object.values(goalProgress.actorStreaks).some((count) => count >= 21)) markReady(record, definition.id);
      break;
    case "tamsin-sunfire-40":
      if (isSunfireOverheat(event)) setCounter(goalProgress, "sunfire-kills", 0);
      if (event.type === "kill" && event.weaponId === "sunfire") increment(goalProgress, "sunfire-kills");
      if (counter(goalProgress, "sunfire-kills") >= 40) markReady(record, definition.id);
      break;
    case "tamsin-full-rack":
      if (event.type === "kill" && ["arbalest", "sunfire", "runebolt", "knife"].includes(event.weaponId)) increment(goalProgress, `${event.weaponId}-kills`);
      if (["arbalest", "sunfire", "runebolt"].every((weapon) => counter(goalProgress, `${weapon}-kills`) >= 15)
        && counter(goalProgress, "knife-kills") >= 1) markReady(record, definition.id);
      break;
    case "fen-snare-21":
      if (event.type === "snare" && stableId(event.enemyId)) addFlag(goalProgress, `snared-${stableToken(event.enemyId)}`);
      setCounter(goalProgress, "distinct-snared", goalProgress.flags.filter((flag) => flag.startsWith("snared-")).length);
      if (counter(goalProgress, "distinct-snared") >= 21) markReady(record, definition.id);
      break;
    case "fen-firepot-12":
      if (isFirePotDetonation(event)) {
        const kills = nonNegativeNumber(event.killCount ?? event.kills);
        setCounter(goalProgress, "best-detonation-kills", Math.max(counter(goalProgress, "best-detonation-kills"), kills));
        if (kills >= 12) markReady(record, definition.id);
      }
      break;
    case "fen-defence-50":
      if (isFortificationKill(event)) increment(goalProgress, "fortification-kills", nonNegativeNumber(event.killCount ?? 1));
      if (counter(goalProgress, "fortification-kills") >= 50) markReady(record, definition.id);
      break;
    case "edda-boon-night":
      if (event.type === "night-complete" && hasActiveBoon(event)) markReady(record, definition.id);
      break;
    case "edda-all-survive":
      if (event.type === "night-complete" && hasActiveBoon(event) && allStartingSurvived(goalProgress, event)) markReady(record, definition.id);
      break;
    case "edda-end-debt":
      if ((record.cumulative[END_DEBT_LATCH] ?? 0) >= 1) markReady(record, definition.id);
      break;
    default:
      break;
  }
}

function eventRelevantToGoal(definition, event) {
  switch (definition.id) {
    case "nell-briefing": return ["briefing-reviewed", "night-complete"].includes(event.type);
    case "nell-outer-gates":
    case "orin-gates-half":
    case "orin-heart-strong": return ["gate", "night-complete"].includes(event.type);
    case "nell-all-survive":
    case "edda-all-survive": return ["npc-survival", "night-complete"].includes(event.type);
    case "orin-repair-600": return event.type === "repair";
    case "tamsin-knife-21": return ["kill", "damage"].includes(event.type);
    case "tamsin-sunfire-40": return (event.type === "kill" && event.weaponId === "sunfire") || isSunfireOverheat(event);
    case "tamsin-full-rack": return event.type === "kill"
      && ["arbalest", "sunfire", "runebolt", "knife"].includes(event.weaponId);
    case "fen-snare-21": return event.type === "snare";
    case "fen-firepot-12": return isFirePotDetonation(event);
    case "fen-defence-50": return isFortificationKill(event);
    case "edda-boon-night": return event.type === "night-complete";
    case "edda-end-debt": return event.type === "campaign-complete";
    default: return false;
  }
}

function applyKnifeStreak(goalProgress, event) {
  if (!stableId(event.actorId)) return;
  if (event.type === "damage" && nonNegativeNumber(event.amount) > 0) {
    goalProgress.actorStreaks[event.actorId] = 0;
  }
  if (event.type === "kill") {
    goalProgress.actorStreaks[event.actorId] = event.weaponId === "knife"
      ? (goalProgress.actorStreaks[event.actorId] ?? 0) + 1
      : 0;
  }
}

function qualifiesEndDebt(state, event) {
  if (event.type !== "campaign-complete" || event.night !== 7) return false;
  const authoritativeMode = state.runNarrative.mode;
  if (event.mode !== undefined && event.mode !== authoritativeMode) return false;
  if (authoritativeMode === "echo" && state.profileNarrative.debtBroken !== true) return false;
  const active = new Set(event.activeNpcIds ?? event.startingNpcIds ?? []);
  const surviving = new Set(event.survivingNpcIds ?? event.livingNpcIds ?? []);
  return active.has(HUB_NPC_IDS.GREENWARDEN) && surviving.has(HUB_NPC_IDS.GREENWARDEN);
}

function bothOuterGates(gates, predicate) {
  if (!isPlainObject(gates)) return false;
  const west = gates.outer ?? gates.west;
  const east = gates.east;
  return isPlainObject(west) && isPlainObject(east) && predicate(west) && predicate(east);
}

function rememberNightFacts(goalProgress, event) {
  if (event.type === "gate" && ["outer", "east", "heart"].includes(event.gateId)) {
    if (Number.isFinite(event.integrity)) setCounter(goalProgress, `gate-${event.gateId}-integrity`, event.integrity);
    if (Number.isFinite(event.maxIntegrity)) setCounter(goalProgress, `gate-${event.gateId}-max-integrity`, event.maxIntegrity);
    if (event.destroyed === true) addFlag(goalProgress, `gate-${event.gateId}-destroyed`);
    if (event.breached === true) addFlag(goalProgress, `gate-${event.gateId}-breached`);
  }
  if (event.type === "npc-survival") {
    for (const npcId of event.startingNpcIds ?? []) addFlag(goalProgress, `starting-${npcId}`);
    for (const npcId of event.survivingNpcIds ?? event.livingNpcIds ?? []) addFlag(goalProgress, `surviving-${npcId}`);
  }
}

function gatesFor(goalProgress, event) {
  if (isPlainObject(event.gates)) return event.gates;
  return Object.fromEntries(["outer", "east", "heart"].map((gateId) => [gateId, {
    integrity: counter(goalProgress, `gate-${gateId}-integrity`),
    maxIntegrity: counter(goalProgress, `gate-${gateId}-max-integrity`),
    destroyed: hasFlag(goalProgress, `gate-${gateId}-destroyed`),
    breached: hasFlag(goalProgress, `gate-${gateId}-breached`),
  }]));
}

function gateRatio(gate) {
  if (!isPlainObject(gate) || !Number.isFinite(gate.integrity) || !Number.isFinite(gate.maxIntegrity) || gate.maxIntegrity <= 0) return -1;
  return gate.integrity / gate.maxIntegrity;
}

function gateDestroyed(gate) {
  return gate?.destroyed === true || gate?.integrity === 0;
}

function gateBreached(gate) {
  return gate?.breached === true || gateDestroyed(gate);
}

function allStartingSurvived(goalProgress, event) {
  const starting = event.startingNpcIds
    ?? goalProgress.flags.filter((flag) => flag.startsWith("starting-")).map((flag) => flag.slice("starting-".length));
  const surviving = new Set(event.survivingNpcIds ?? event.livingNpcIds
    ?? goalProgress.flags.filter((flag) => flag.startsWith("surviving-")).map((flag) => flag.slice("surviving-".length)));
  return Array.isArray(starting) && starting.length > 0 && starting.every((npcId) => surviving.has(npcId));
}

function hasActiveBoon(event) {
  return event.boonActive === true || (Array.isArray(event.activeBoonIds) && event.activeBoonIds.length > 0);
}

function isSunfireOverheat(event) {
  return (event.type === "weapon-overheat" || event.type === "overheat") && event.weaponId === "sunfire";
}

function isFirePotDetonation(event) {
  return event.type === "detonation" && (event.fortificationId === "firePot" || event.sourceId === "firePot" || event.weaponId === "firePot");
}

function isFortificationKill(event) {
  return (event.type === "kill" && (event.sourceKind === "fortification" || event.fortificationId))
    || event.type === "fortification-kill";
}

function presentGoal(definition, record, goalProgress, options) {
  return {
    id: definition.id,
    npcId: definition.npcId,
    title: definition.title,
    resetRule: definition.resetRule,
    reward: clone(definition.reward),
    locked: !requirementsMet(definition, options),
    progress: progressFor(definition, record, goalProgress),
  };
}

function progressFor(definition, record, goalProgress) {
  if (record.readyGoalId === definition.id || record.completedGoalIds.includes(definition.id)) {
    return {current: definition.target, target: definition.target};
  }
  let current = 0;
  switch (definition.id) {
    case "orin-repair-600": current = record.cumulative.repairedIntegrity ?? 0; break;
    case "tamsin-knife-21": current = Math.max(0, ...Object.values(goalProgress.actorStreaks)); break;
    case "tamsin-sunfire-40": current = counter(goalProgress, "sunfire-kills"); break;
    case "tamsin-full-rack": current = Math.min(15, counter(goalProgress, "arbalest-kills"))
      + Math.min(15, counter(goalProgress, "sunfire-kills")) + Math.min(15, counter(goalProgress, "runebolt-kills"))
      + Math.min(1, counter(goalProgress, "knife-kills")); break;
    case "fen-snare-21": current = counter(goalProgress, "distinct-snared"); break;
    case "fen-firepot-12": current = counter(goalProgress, "best-detonation-kills"); break;
    case "fen-defence-50": current = counter(goalProgress, "fortification-kills"); break;
    case "edda-end-debt": current = record.cumulative[END_DEBT_LATCH] ?? 0; break;
    default: current = record.readyGoalId === definition.id ? 1 : 0;
  }
  return {current: Math.min(definition.target, current), target: definition.target};
}

function nextGoal(record, npcId) {
  return GOALS_BY_NPC.get(npcId)?.find((entry) => !record.completedGoalIds.includes(entry.id)) ?? null;
}

function requirementsMet(definition, options) {
  const owned = new Set(options.ownedUnlockIds ?? options.profile?.unlocks ?? []);
  return (definition.requiresUnlockIds ?? []).every((id) => owned.has(id));
}

function cloneGoalState(state) {
  if (!isPlainObject(state) || !isPlainObject(state.relationships)) {
    throw new TypeError("relationship goal state requires profile relationships");
  }
  const relationships = clone(state.relationships);
  for (const npcId of HUB_NPC_UNLOCK_ORDER) {
    relationships[npcId] = normaliseRecord(relationships[npcId]);
  }
  return {
    relationships,
    profileNarrative: normaliseNarrativeProfileState(state.profileNarrative),
    runNarrative: normaliseNarrativeRunState(state.runNarrative),
  };
}

function normaliseRecord(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    status: STATUS_INDEX.has(source.status) ? source.status : "new",
    activeGoalId: typeof source.activeGoalId === "string" ? source.activeGoalId : null,
    readyGoalId: typeof source.readyGoalId === "string" ? source.readyGoalId : null,
    completedGoalIds: uniqueIds(source.completedGoalIds ?? []),
    cumulative: normaliseCounts(source.cumulative),
  };
}

function progressForGoal(state, goalId) {
  if (state.relationships[GOAL_BY_ID.get(goalId)?.npcId]?.readyGoalId === goalId) {
    const definition = GOAL_BY_ID.get(goalId);
    return {counters: {completed: definition.target}, flags: [], actorStreaks: {}};
  }
  return state.runNarrative.goalProgress[goalId] ?? emptyProgress();
}

function emptyProgress() {
  return {counters: {}, flags: [], actorStreaks: {}};
}

function requireRecord(relationships, npcId) {
  if (!GOALS_BY_NPC.has(npcId)) throw new RangeError(`unknown relationship NPC: ${npcId}`);
  return relationships[npcId];
}

function requireHost(options = {}) {
  if ((options.role ?? "host") !== "host") throw new Error("relationship progression mutation is host-owned");
}

function isLivingNpc(npcId, options) {
  if (typeof options.npcAlive === "boolean") return options.npcAlive;
  const living = options.livingNpcIds ?? options.run?.hub?.activeNpcs ?? [];
  const fallen = new Set(options.fallenNpcIds ?? options.run?.fallenNpcs ?? []);
  return Array.isArray(living) && living.includes(npcId) && !fallen.has(npcId);
}

function markReady(record, goalId) {
  record.activeGoalId = null;
  record.readyGoalId = goalId;
}

function acceptLifecycleEvent(progress, event) {
  if (hasProcessedEvent(progress, event.eventId)) return false;
  const runOrdinal = lifecycleRunOrdinal(event);
  if (runOrdinal === false) return false;

  if (event.type === "terminal-settlement") {
    if (runOrdinal !== null && runOrdinal <= counter(progress, "last-terminal-run")) return false;
    if (!rememberEvent(progress, event.eventId)) return false;
    if (runOrdinal !== null) setCounter(progress, "last-terminal-run", runOrdinal);
    return true;
  }

  if (!Number.isSafeInteger(event.night) || event.night < 1 || event.night > 7) return false;
  if (runOrdinal !== null) {
    const lastRun = counter(progress, "last-night-run");
    const lastNight = counter(progress, "last-night-number");
    if (runOrdinal < lastRun || (runOrdinal === lastRun && event.night <= lastNight)) return false;
  }
  if (!rememberEvent(progress, event.eventId)) return false;
  if (runOrdinal !== null) {
    setCounter(progress, "last-night-run", runOrdinal);
    setCounter(progress, "last-night-number", event.night);
  }
  return true;
}

function lifecycleRunOrdinal(event) {
  const provided = event.runOrdinal ?? event.attemptId;
  if (provided === undefined) return null;
  return Number.isSafeInteger(provided) && provided > 0 ? provided : false;
}

function hasProcessedEvent(goalProgress, eventId) {
  return stableId(eventId) && hasFlag(goalProgress, `${EVENT_FLAG_PREFIX}${stableToken(eventId)}`);
}

function rememberEvent(goalProgress, eventId) {
  if (!stableId(eventId)) return false;
  const flag = `${EVENT_FLAG_PREFIX}${stableToken(eventId)}`;
  if (hasFlag(goalProgress, flag)) return false;
  while (goalProgress.flags.length >= MAX_GOAL_DEDUPE_IDS && evictOldestEventFlag(goalProgress)) {
    // Receipt history is a rolling window; semantic goal facts are never evicted.
  }
  if (goalProgress.flags.length >= MAX_GOAL_DEDUPE_IDS) return false;
  goalProgress.flags.push(flag);
  return true;
}

function addFlag(goalProgress, flag) {
  if (goalProgress.flags.includes(flag)) return;
  while (goalProgress.flags.length >= MAX_GOAL_DEDUPE_IDS && evictOldestEventFlag(goalProgress)) {
    // Make room for durable semantic facts before retaining replay receipts.
  }
  if (goalProgress.flags.length < MAX_GOAL_DEDUPE_IDS) goalProgress.flags.push(flag);
}

function evictOldestEventFlag(goalProgress) {
  const index = goalProgress.flags.findIndex((flag) => flag.startsWith(EVENT_FLAG_PREFIX));
  if (index < 0) return false;
  goalProgress.flags.splice(index, 1);
  return true;
}

function hasFlag(goalProgress, flag) {
  return goalProgress.flags.includes(flag);
}

function counter(goalProgress, key) {
  return goalProgress.counters[key] ?? 0;
}

function setCounter(goalProgress, key, value) {
  goalProgress.counters[key] = value;
}

function increment(goalProgress, key, amount = 1) {
  setCounter(goalProgress, key, counter(goalProgress, key) + amount);
}

function normaliseCounts(value) {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, count]) => Number.isFinite(count) && count >= 0));
}

function nonNegativeNumber(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function stableId(value) {
  return typeof value === "string"
    && /^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/u.test(value);
}

function stableToken(value) {
  let hash = 0xcbf29ce484222325n;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function uniqueIds(values) {
  return [...new Set(Array.isArray(values) ? values.filter(stableId) : [])];
}

function goal(id, npcId, title, kind, target, resetRule, goalReward, extra = {}) {
  return {id, npcId, title, kind, target, resetRule, reward: goalReward, ...extra};
}

function reward(rankCeilings, extra = {}) {
  return {rankCeilings, unlockIds: [], recipeIds: [], ...extra};
}

function humanise(value) {
  return value[0].toUpperCase() + value.slice(1);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) deepFreeze(child);
  }
  return value;
}

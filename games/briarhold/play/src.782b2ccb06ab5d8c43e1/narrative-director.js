/** Pure deterministic selection and local scene-session transitions. */

import {HUB_NPC_IDS} from "./hub.js";
import {deriveAwarenessStage} from "./narrative-state.js";
import {
  NARRATIVE_CATALOGUE,
  NARRATIVE_CAST,
  NARRATIVE_RESPONSE_TAGS,
  validateNarrativeScene,
} from "./narrative-content.js";
import {bellkeeperBriefingSceneId} from "./progression.js";
import {RELATIONSHIP_GOALS} from "./relationship-goals.js";

const GOAL_BY_ID = new Map(RELATIONSHIP_GOALS.map((goal) => [goal.id, goal]));

const CONVERSATION_TRIGGERS = new Set([
  "npc_arrival", "npc_talk", "goal_offer", "goal_reminder", "goal_ready", "goal_report",
]);

/** Return the highest-priority eligible scene, with stable-ID tie breaking. */
export function selectNarrativeScene(context = {}, catalogue = NARRATIVE_CATALOGUE) {
  const normalized = normalizeContext(context);
  const entries = Array.isArray(catalogue) ? catalogue : [];
  if (normalized.trigger === "bell_briefing") return selectBellkeeperBriefing(normalized, entries);
  const primaryConsumed = normalized.npcId
    && normalized.completedSceneIds.includes(primaryConsumedId(normalized.night, normalized.npcId));
  const eligible = entries
    .filter(isSelectableScene)
    .filter((entry) => !primaryConsumed
      || entry.coverage?.kind === "service_repeat"
      || (entry.coverage?.kind === "goal_dialogue" && entry.coverage?.goalState === "repeat"))
    .filter((entry) => triggerMatches(entry, normalized))
    .filter((entry) => safeConditionsMatch(entry.conditions, normalized))
    .filter((entry) => replayAllows(entry, normalized))
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  if (eligible.length > 0) return eligible[0];

  if (normalized.serviceRequested === true && normalized.npcId) return createFallbackScene("service", normalized);
  return null;
}

/** Begin a local presentation session. Only stable scene/beat IDs need persistence. */
export function startNarrativeScene(sceneOrId, context = {}, catalogue = NARRATIVE_CATALOGUE) {
  const source = typeof sceneOrId === "string"
    ? catalogue.find(({id}) => id === sceneOrId)
    : sceneOrId;
  if (!isSelectableScene(source)) throw new TypeError("cannot start missing or malformed narrative scene");

  const normalized = normalizeContext(context);
  const conditionalBeats = source.beats
    .filter((beat) => beat.conditions === undefined || safeConditionsMatch(beat.conditions, normalized));
  const beats = selectExclusiveBeats(conditionalBeats)
    .map((beat) => renderBeat(beat, source.coverage?.goalId, normalized));
  if (beats.length === 0) throw new Error(`narrative scene ${source.id} has no eligible beats`);
  const bark = source.presentation === "bark";
  return {
    sceneId: source.id,
    trigger: source.trigger,
    presentation: source.presentation,
    replay: source.replay,
    beatIndex: 0,
    beat: beats[0],
    beats,
    persistent: !bark,
    manualAdvance: !bark,
    completed: bark,
    skipped: false,
    primaryNpcId: source.primaryNpcId ?? null,
    serviceNpcId: source.primaryNpcId
      ?? ((CONVERSATION_TRIGGERS.has(source.trigger) || source.trigger === "bell_briefing")
        && source.conditions?.activeNpcIds?.length === 1
        ? source.conditions.activeNpcIds[0]
        : null),
    contextNight: normalized.night,
    primaryConsumedId: source.primaryNpcId
      ? primaryConsumedId(normalized.night, source.primaryNpcId)
      : null,
    appliedResponseTag: null,
    effects: bark ? completionEffects(source.id, null, source.primaryNpcId ? primaryConsumedId(normalized.night, source.primaryNpcId) : null) : emptyEffects(),
  };
}

/** Restore an unfinished persistent scene from its stable ID and exact beat. */
export function resumeNarrativeScene(activeScene, context = {}, catalogue = NARRATIVE_CATALOGUE) {
  if (!activeScene || typeof activeScene !== "object" || Array.isArray(activeScene)
    || typeof activeScene.sceneId !== "string"
    || !Number.isSafeInteger(activeScene.beatIndex)
    || activeScene.beatIndex < 0) return null;
  const entries = Array.isArray(catalogue) ? catalogue : [];
  const source = entries.find(({id}) => id === activeScene.sceneId);
  if (!isSelectableScene(source) || source.presentation === "bark") return null;
  const sourceNight = source.trigger === "night_cleared" && Number.isInteger(source.conditions?.night)
    ? source.conditions.night
    : context.night;
  const normalized = normalizeContext({...context, trigger: source.trigger, night: sourceNight});
  if (!safeConditionsMatch(source.conditions, normalized) || !replayAllows(source, normalized)) return null;
  try {
    const session = startNarrativeScene(source, normalized, entries);
    if (activeScene.beatIndex >= session.beats.length || session.completed) return null;
    return {
      ...session,
      beatIndex: activeScene.beatIndex,
      beat: session.beats[activeScene.beatIndex],
    };
  } catch {
    return null;
  }
}

/** Resolve only the first queued arrival so callers can advance without recursion. */
export function resolveQueuedArrivalScene(context = {}, catalogue = NARRATIVE_CATALOGUE) {
  const normalized = normalizeContext({...context, trigger: "npc_arrival"});
  const pendingSceneId = stateList(normalized, "pendingSceneIds", "runNarrative")
    .find((id) => typeof id === "string" && id.startsWith("arrival-")) ?? null;
  if (!pendingSceneId) return {status: "empty", pendingSceneId: null, scene: null};
  const entries = Array.isArray(catalogue) ? catalogue : [];
  const known = entries.filter((entry) => entry?.trigger === "npc_arrival"
    && entry?.conditions?.queuedSceneId === pendingSceneId);
  if (known.length === 0) return {status: "blocked", pendingSceneId, scene: null};
  const available = known.filter(isSelectableScene)
    .filter((entry) => safeConditionsMatch(entry.conditions, normalized));
  if (available.length === 0) return {status: "blocked", pendingSceneId, scene: null};
  const replayable = available.filter((entry) => replayAllows(entry, normalized));
  if (replayable.length === 0) return {status: "consume", pendingSceneId, scene: null};
  const eligible = replayable
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  return {status: "ready", pendingSceneId, scene: eligible[0]};
}

/** Advance one manually controlled beat or finish the scene. */
export function advanceNarrativeScene(session) {
  requireActiveSession(session);
  if (session.completed) throw new Error("narrative scene is already complete");
  const nextIndex = session.beatIndex + 1;
  if (nextIndex < session.beats.length) {
    return {...session, beatIndex: nextIndex, beat: session.beats[nextIndex]};
  }
  return completeSession(session, false);
}

/** Apply one bounded presentation tag without changing any gameplay fact. */
export function chooseNarrativeResponse(session, responseId) {
  requireActiveSession(session);
  if (session.completed) throw new Error("narrative scene is already complete");
  if (session.appliedResponseTag !== null) throw new Error("a narrative response was already chosen");
  const response = session.beat.responses?.find(({id}) => id === responseId);
  if (!response) throw new RangeError(`unknown response for ${session.sceneId}: ${responseId}`);
  if (!NARRATIVE_RESPONSE_TAGS.includes(response.tag)) throw new TypeError("invalid narrative response tag");
  return {
    ...session,
    chosenResponseId: response.id,
    appliedResponseTag: response.tag,
  };
}

/** Finish a scene immediately while recording no optional response tag. */
export function skipNarrativeScene(session) {
  requireActiveSession(session);
  if (session.completed) throw new Error("narrative scene is already complete");
  return completeSession({...session, appliedResponseTag: null}, true);
}

/** Functional local copy for absent content. It never claims a locked system. */
export function createFallbackNarrativeBeat(options = {}) {
  const kind = options.kind ?? "service";
  if (kind === "briefing") {
    const night = Number.isInteger(options.night) && options.night >= 1 && options.night <= 7
      ? options.night
      : 1;
    return {
      speakerId: HUB_NPC_IDS.BELLKEEPER,
      text: `Night ${night} is ready. The Arbalest covers range, and the knife covers enemies that reach you. Hold all three waves, then return to daylight.`,
      shotId: "bell-wide",
      cueId: "voice-nell",
    };
  }
  const requestedNpcId = Object.hasOwn(NARRATIVE_CAST, options.npcId)
    ? options.npcId
    : HUB_NPC_IDS.BELLKEEPER;
  const activeNpcIds = Array.isArray(options.activeNpcIds) ? options.activeNpcIds : [];
  const fallenNpcIds = Array.isArray(options.fallenNpcIds) ? options.fallenNpcIds : [];
  const available = activeNpcIds.includes(requestedNpcId) && !fallenNpcIds.includes(requestedNpcId);
  if (!available) {
    const speakerId = activeNpcIds?.includes(HUB_NPC_IDS.BELLKEEPER) && !fallenNpcIds.includes(HUB_NPC_IDS.BELLKEEPER)
      ? HUB_NPC_IDS.BELLKEEPER
      : null;
    return {
      speakerId,
      text: "That daytime service is unavailable. Check the active roster before choosing another service.",
      shotId: speakerId ? "speaker-close" : "first-person",
      cueId: speakerId ? "voice-nell" : "none",
      available: false,
    };
  }
  const npcId = requestedNpcId;
  const text = {
    [HUB_NPC_IDS.BELLKEEPER]: "I can repeat the current warning or take your bell confirmation when you're ready.",
    [HUB_NPC_IDS.MASON]: "I can repair a damaged gate while the daytime service is available.",
    [HUB_NPC_IDS.QUARTERMASTER]: "I can open the stores and field-medicine service while I am active.",
    [HUB_NPC_IDS.TRAPPER]: "I can help with installed defences while the workshop is available.",
    [HUB_NPC_IDS.GREENWARDEN]: "I can show the available boon information for this night.",
  }[npcId];
  return {
    speakerId: npcId,
    text,
    shotId: npcId === HUB_NPC_IDS.BELLKEEPER ? "speaker-close" : "speaker-medium",
    cueId: NARRATIVE_CAST[npcId].cueId,
    available: true,
  };
}

function createFallbackScene(kind, context) {
  const beat = createFallbackNarrativeBeat({
    kind,
    night: context.night,
    npcId: context.npcId,
    activeNpcIds: context.activeNpcIds,
    fallenNpcIds: context.fallenNpcIds,
  });
  return {
    id: kind === "briefing" ? bellkeeperBriefingSceneId(boundedNight(context.night)) : `fallback-service-${beat.speakerId ?? "unavailable"}`,
    trigger: kind === "briefing" ? "bell_briefing" : "npc_talk",
    priority: -1,
    presentation: "dialogue",
    conditions: {},
    replay: kind === "briefing" ? "once_night" : "repeatable",
    beats: [beat],
    fallback: true,
  };
}

function triggerMatches(entry, context) {
  if (context.trigger !== undefined) return entry.trigger === context.trigger;
  const pending = stateList(context, "pendingSceneIds", "runNarrative");
  if (pending.length > 0 && entry.trigger === "npc_arrival") return true;
  if (context.npcId !== undefined) return CONVERSATION_TRIGGERS.has(entry.trigger);
  return true;
}

function replayAllows(entry, context) {
  if (entry.replay === "repeatable") return true;
  const seen = stateList(context, "seenSceneIds", "profileNarrative");
  const completed = stateList(context, "completedSceneIds", "runNarrative");
  if (entry.replay === "once_profile") return !seen.includes(entry.id);
  if (entry.replay === "once_attempt" || entry.replay === "once_night") return !completed.includes(entry.id);
  return false;
}

function conditionsMatch(conditions, context) {
  for (const [key, expected] of Object.entries(conditions ?? {})) {
    if (["night", "wave", "lastFailureNight", "lastFailureWave", "deepestNight"].includes(key)) {
      if (context[key] !== expected) return false;
    } else if (key === "failedRuns") {
      if (!numberCondition(context.failedRuns, expected)) return false;
    } else if (key === "activeNpcIds") {
      if (!containsAll(context.activeNpcIds, expected)) return false;
      if (context.npcId !== undefined && expected.length === 1 && context.npcId !== expected[0]) return false;
    } else if (key === "livingNpcIds") {
      if (!containsAll(context.livingNpcIds, expected)) return false;
    } else if (key === "lastFallenNpcIds") {
      if (!containsAll(context.lastFallenNpcIds, expected)) return false;
    } else if (key === "queuedSceneId") {
      if (!stateList(context, "pendingSceneIds", "runNarrative").includes(expected)) return false;
    } else if (["readyGoalId", "activeGoalId", "nextGoalId"].includes(key)) {
      if (context[key] !== expected) return false;
    } else if (key === "completedGoalIds" || key === "responseTags") {
      if (!containsAll(stateList(context, key, key === "responseTags" ? "profileNarrative" : null), expected)) return false;
    } else if (key === "goalHasProgress") {
      if (Boolean(context.goalHasProgress) !== expected) return false;
    } else if (key === "awareness") {
      const actual = deriveAwarenessStage(expected.npcId, context.failedRuns);
      if (!numberCondition(actual, expected)) return false;
    } else if (key === "lastFailureBossId") {
      if (context.lastFailureBossId !== expected) return false;
    } else if (key === "lastFailureReasonCode") {
      if (context.lastFailureReasonCode !== expected) return false;
    } else if (key === "lastBreachedGateId") {
      if (context.lastBreachedGateId !== expected) return false;
    } else if (key === "relationshipStatus") {
      if (context.relationshipStatus !== expected) return false;
    } else if (key === "mode") {
      if (context.mode !== expected) return false;
    } else {
      return false;
    }
  }
  return true;
}

function safeConditionsMatch(conditions, context) {
  try {
    return conditionsMatch(conditions, context);
  } catch {
    return false;
  }
}

function numberCondition(actual, expected) {
  if (!Number.isFinite(actual)) return false;
  if (Object.hasOwn(expected, "exact") && actual !== expected.exact) return false;
  if (Object.hasOwn(expected, "min") && expected.min !== null && actual < expected.min) return false;
  if (Object.hasOwn(expected, "max") && expected.max !== null && actual > expected.max) return false;
  return true;
}

function stateList(context, key, nestedKey) {
  const direct = context[key];
  if (Array.isArray(direct)) return direct;
  const nested = nestedKey ? context[nestedKey]?.[key] : undefined;
  return Array.isArray(nested) ? nested : [];
}

function containsAll(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
  const set = new Set(actual);
  return expected.every((id) => set.has(id));
}

function normalizeContext(context) {
  const profileNarrative = context.profileNarrative && typeof context.profileNarrative === "object"
    ? context.profileNarrative
    : {};
  const nestedFailureIsAuthoritative = Object.hasOwn(profileNarrative, "lastFailure");
  const lastFailure = nestedFailureIsAuthoritative
    ? profileNarrative.lastFailure
    : context.lastFailure;
  const failure = lastFailure && typeof lastFailure === "object" ? lastFailure : {};
  const runNarrative = context.runNarrative && typeof context.runNarrative === "object"
    ? context.runNarrative
    : context.run?.narrative && typeof context.run.narrative === "object"
      ? context.run.narrative
      : {};
  const activeNpcIds = Array.isArray(context.run?.hub?.activeNpcs)
    ? context.run.hub.activeNpcs
    : Array.isArray(context.activeNpcIds)
      ? context.activeNpcIds
      : [];
  const fallenNpcIds = Array.isArray(context.run?.fallenNpcs)
    ? context.run.fallenNpcs
    : Array.isArray(context.fallenNpcIds)
      ? context.fallenNpcIds
      : [];
  const failedRuns = Number.isSafeInteger(profileNarrative.failedRuns)
    ? profileNarrative.failedRuns
    : Number.isSafeInteger(context.failedRuns)
      ? context.failedRuns
      : 0;
  const deepestNight = Number.isSafeInteger(profileNarrative.deepestNight)
    ? profileNarrative.deepestNight
    : Number.isSafeInteger(context.deepestNight)
      ? context.deepestNight
      : 0;
  const completedSceneIds = stateList(context, "completedSceneIds", "runNarrative").length > 0
    ? stateList(context, "completedSceneIds", "runNarrative")
    : Array.isArray(runNarrative.completedSceneIds)
      ? runNarrative.completedSceneIds
      : [];
  const mode = ["canonical", "echo"].includes(runNarrative.mode)
    ? runNarrative.mode
    : ["canonical", "echo"].includes(context.mode)
      ? context.mode
      : "canonical";
  const relationships = context.relationships && typeof context.relationships === "object"
    ? context.relationships
    : context.profile?.relationships && typeof context.profile.relationships === "object"
      ? context.profile.relationships
      : null;
  const completedGoalIds = relationships
    ? [...new Set(Object.values(relationships).flatMap((record) =>
      Array.isArray(record?.completedGoalIds) ? record.completedGoalIds : [],
    ))].filter((goalId) => GOAL_BY_ID.has(goalId))
    : Array.isArray(context.completedGoalIds)
      ? context.completedGoalIds.filter((goalId) => GOAL_BY_ID.has(goalId))
      : [];
  return {
    ...context,
    profileNarrative,
    runNarrative,
    failedRuns,
    deepestNight,
    mode,
    activeNpcIds,
    fallenNpcIds,
    livingNpcIds: activeNpcIds.filter((npcId) => !fallenNpcIds.includes(npcId)),
    completedSceneIds,
    completedGoalIds,
    lastFailureNight: nestedFailureIsAuthoritative ? failure.night : context.lastFailureNight ?? failure.night,
    lastFailureWave: nestedFailureIsAuthoritative ? failure.wave : context.lastFailureWave ?? failure.wave,
    lastFailureBossId: nestedFailureIsAuthoritative ? failure.bossId : context.lastFailureBossId ?? failure.bossId,
    lastFailureReasonCode: nestedFailureIsAuthoritative ? failure.reasonCode : context.lastFailureReasonCode ?? failure.reasonCode,
    lastBreachedGateId: nestedFailureIsAuthoritative ? failure.breachedGateId : context.lastBreachedGateId ?? failure.breachedGateId,
    lastFallenNpcIds: nestedFailureIsAuthoritative
      ? (Array.isArray(failure.fallenNpcIds) ? failure.fallenNpcIds : [])
      : Array.isArray(context.lastFallenNpcIds)
        ? context.lastFallenNpcIds
        : Array.isArray(failure.fallenNpcIds)
          ? failure.fallenNpcIds
          : [],
  };
}

function primaryConsumedId(night, npcId) {
  return `primary-consumed-night-${boundedNight(night)}-${npcId}`;
}

function selectExclusiveBeats(beats) {
  const winners = new Map();
  for (const beat of beats) {
    if (!beat.exclusiveGroup) continue;
    const current = winners.get(beat.exclusiveGroup);
    const priority = beat.priority ?? 0;
    const currentPriority = current?.priority ?? 0;
    if (!current
      || priority > currentPriority
      || (priority === currentPriority && (beat.beatId ?? "").localeCompare(current.beatId ?? "") < 0)) {
      winners.set(beat.exclusiveGroup, beat);
    }
  }
  return beats.filter((beat) => !beat.exclusiveGroup || winners.get(beat.exclusiveGroup) === beat);
}

function renderBeat(beat, goalId, context) {
  if (!goalId || !beat.text.includes("{{")) return beat;
  const definition = GOAL_BY_ID.get(goalId);
  const source = context.goalProgressById?.[goalId];
  const target = definition?.target ?? 0;
  const current = Number.isFinite(source?.current)
    ? Math.min(target, Math.max(0, Math.floor(source.current)))
    : 0;
  return {
    ...beat,
    text: beat.text.replaceAll("{{current}}", String(current)).replaceAll("{{target}}", String(target)),
  };
}

function selectBellkeeperBriefing(context, entries) {
  const night = boundedNight(context.night);
  const id = bellkeeperBriefingSceneId(night);
  if (context.completedSceneIds.includes(id)) return null;
  const valid = entries
    .filter((entry) => entry?.id === id
      && isSelectableScene(entry)
      && entry.trigger === "bell_briefing"
      && entry.presentation === "dialogue"
      && entry.replay === "once_night"
      && entry.conditions.night === night
      && Object.keys(entry.conditions).every((key) => key === "night" || key === "activeNpcIds")
      && (entry.conditions.activeNpcIds === undefined
        || (entry.conditions.activeNpcIds.length === 1
          && entry.conditions.activeNpcIds[0] === HUB_NPC_IDS.BELLKEEPER))
      && entry.beats.every(({speakerId}) => speakerId === HUB_NPC_IDS.BELLKEEPER))
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  const eligible = valid.find((entry) => safeConditionsMatch(entry.conditions, context));
  if (eligible) return eligible;
  return valid.length > 0 ? null : createFallbackScene("briefing", context);
}

function completeSession(session, skipped) {
  return {
    ...session,
    beat: null,
    completed: true,
    skipped,
    effects: completionEffects(session.sceneId, skipped ? null : session.appliedResponseTag, session.primaryConsumedId),
  };
}

function completionEffects(sceneId, responseTag, primaryId = null) {
  return {
    seenSceneIds: [sceneId],
    completedSceneIds: primaryId ? [sceneId, primaryId] : [sceneId],
    responseTags: responseTag ? [responseTag] : [],
  };
}

function emptyEffects() {
  return {seenSceneIds: [], completedSceneIds: [], responseTags: []};
}

function requireActiveSession(session) {
  if (!session || typeof session !== "object" || !Array.isArray(session.beats)) {
    throw new TypeError("narrative session is required");
  }
}

function isSelectableScene(entry) {
  return validateNarrativeScene(entry).length === 0;
}

function boundedNight(value) {
  return Number.isInteger(value) && value >= 1 && value <= 7 ? value : 1;
}

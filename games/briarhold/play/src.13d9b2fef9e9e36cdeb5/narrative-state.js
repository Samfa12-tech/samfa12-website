/**
 * Renderer-free narrative state contracts.
 *
 * Narrative state is intentionally kept separate from progression persistence
 * until the v4 save layer consumes it. This module has no DOM, Babylon, or
 * storage dependencies and can therefore be shared by solo and co-op hosts.
 */

import {HUB_NPC_IDS} from "./hub.js";

export const NARRATIVE_FAILURE_REASON_CODES = Object.freeze([
  "player_died",
  "warden_fallen",
  "heart_gate_fallen",
  "bellkeeper_fallen",
]);

const FAILURE_REASON_SET = new Set(NARRATIVE_FAILURE_REASON_CODES);
const NARRATIVE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/u;
const RECRUITMENT_FAILURE_INDEX = Object.freeze({
  [HUB_NPC_IDS.MASON]: 1,
  [HUB_NPC_IDS.QUARTERMASTER]: 2,
  [HUB_NPC_IDS.TRAPPER]: 3,
  [HUB_NPC_IDS.GREENWARDEN]: 4,
});

// These limits keep scene and goal state safe to carry in a checkpoint while
// leaving ample room for future authored IDs.
export const NARRATIVE_SCENE_ID_LIMIT = 128;
export const NARRATIVE_RESPONSE_TAG_LIMIT = 128;
export const NARRATIVE_GOAL_LIMIT = 64;
export const NARRATIVE_PROGRESS_KEY_LIMIT = 64;
export const NARRATIVE_ID_LENGTH_LIMIT = 128;

export const NARRATIVE_PROFILE_DEFAULTS = deepFreeze({
  failedRuns: 0,
  deepestNight: 1,
  debtBroken: false,
  campaignCompletions: 0,
  seenSceneIds: [],
  responseTags: [],
  postDebtArrivalIds: [],
  pendingSequence: null,
  lastFailure: null,
});

export const NARRATIVE_RUN_DEFAULTS = deepFreeze({
  mode: "canonical",
  completedSceneIds: [],
  pendingSceneIds: [],
  daywork: null,
  activeScene: null,
  goalProgress: {},
});

/** Create a fresh mutable narrative profile value from immutable defaults. */
export function createNarrativeProfileState(value = {}) {
  return normaliseNarrativeProfileState(value);
}

/** Create a fresh mutable run-local narrative value from immutable defaults. */
export function createNarrativeRunState(value = {}) {
  return normaliseNarrativeRunState(value);
}

/**
 * Normalize profile narrative state while retaining unknown future IDs.
 * Arrays are insertion ordered, deduplicated, and bounded for checkpoint use.
 */
export function normaliseNarrativeProfileState(value) {
  if (value !== undefined && value !== null && !isPlainObject(value)) {
    throw new TypeError("narrative profile state must be an object");
  }
  const input = value ?? {};
  return {
    failedRuns: toNonNegativeInteger(input.failedRuns, "narrative.failedRuns"),
    deepestNight: toBoundedInteger(input.deepestNight ?? 1, "narrative.deepestNight", 1, 7),
    debtBroken: Boolean(input.debtBroken),
    campaignCompletions: toNonNegativeInteger(
      input.campaignCompletions,
      "narrative.campaignCompletions",
    ),
    seenSceneIds: normaliseIds(input.seenSceneIds, "narrative.seenSceneIds", NARRATIVE_SCENE_ID_LIMIT),
    responseTags: normaliseIds(input.responseTags, "narrative.responseTags", NARRATIVE_RESPONSE_TAG_LIMIT),
    postDebtArrivalIds: normaliseIds(
      input.postDebtArrivalIds,
      "narrative.postDebtArrivalIds",
      NARRATIVE_SCENE_ID_LIMIT,
    ),
    pendingSequence: normalisePendingSequence(input.pendingSequence),
    lastFailure: normaliseLastFailure(input.lastFailure),
  };
}

/** Normalize run-local narrative state and its bounded progress records. */
export function normaliseNarrativeRunState(value) {
  if (value !== undefined && value !== null && !isPlainObject(value)) {
    throw new TypeError("narrative run state must be an object");
  }
  const input = value ?? {};
  const mode = input.mode ?? "canonical";
  if (mode !== "canonical" && mode !== "echo") {
    throw new RangeError("narrative.mode must be canonical or echo");
  }
  return {
    mode,
    completedSceneIds: normaliseIds(
      input.completedSceneIds,
      "narrative.completedSceneIds",
      NARRATIVE_SCENE_ID_LIMIT,
    ),
    pendingSceneIds: normaliseIds(
      input.pendingSceneIds,
      "narrative.pendingSceneIds",
      NARRATIVE_SCENE_ID_LIMIT,
    ),
    daywork: normaliseDaywork(input.daywork),
    activeScene: normaliseActiveScene(input.activeScene),
    goalProgress: normaliseGoalProgress(input.goalProgress),
  };
}

/**
 * Derive awareness from the canonical failure count and fixed recruitment
 * cadence. Nell is the Bellkeeper and is aware from the first attempt.
 */
export function deriveAwarenessStage(npcId, failedRuns) {
  const failures = toNonNegativeInteger(failedRuns, "failedRuns");
  if (npcId === HUB_NPC_IDS.BELLKEEPER) return 3;
  const recruitmentFailureIndex = RECRUITMENT_FAILURE_INDEX[npcId];
  if (recruitmentFailureIndex === undefined) return 0;
  return Math.min(3, Math.max(0, failures - recruitmentFailureIndex));
}

function normalisePendingSequence(value) {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) throw new TypeError("narrative.pendingSequence must be an object or null");
  return {
    attemptId: toPositiveInteger(value.attemptId, "narrative.pendingSequence.attemptId"),
    failureSceneId: normaliseId(value.failureSceneId, "narrative.pendingSequence.failureSceneId"),
    recruitedNpcId: normaliseNullableId(value.recruitedNpcId, "narrative.pendingSequence.recruitedNpcId"),
  };
}

function normaliseLastFailure(value) {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) throw new TypeError("narrative.lastFailure must be an object or null");
  const reasonCode = value.reasonCode;
  if (typeof reasonCode !== "string" || reasonCode.trim().length === 0) {
    throw new TypeError("narrative.lastFailure.reasonCode must be a non-empty code");
  }
  if (!FAILURE_REASON_SET.has(reasonCode)) {
    throw new RangeError(`narrative.lastFailure.reasonCode is not recognized: ${reasonCode}`);
  }
  return {
    attemptId: toPositiveInteger(value.attemptId, "narrative.lastFailure.attemptId"),
    night: toBoundedInteger(value.night, "narrative.lastFailure.night", 1, 7),
    wave: toBoundedInteger(value.wave, "narrative.lastFailure.wave", 0, 3),
    reasonCode,
    bossId: normaliseNullableId(value.bossId, "narrative.lastFailure.bossId"),
    breachedGateId: normaliseNullableId(value.breachedGateId, "narrative.lastFailure.breachedGateId"),
    fallenNpcIds: normaliseIds(
      value.fallenNpcIds,
      "narrative.lastFailure.fallenNpcIds",
      NARRATIVE_SCENE_ID_LIMIT,
    ),
  };
}

function normaliseDaywork(value) {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) throw new TypeError("narrative.daywork must be an object or null");
  return {
    night: toBoundedInteger(value.night, "narrative.daywork.night", 1, 7),
    npcId: normaliseId(value.npcId, "narrative.daywork.npcId"),
    actionId: normaliseId(value.actionId, "narrative.daywork.actionId"),
    targetId: normaliseNullableId(value.targetId, "narrative.daywork.targetId"),
    requestId: normaliseNullableId(value.requestId, "narrative.daywork.requestId"),
  };
}

function normaliseActiveScene(value) {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) throw new TypeError("narrative.activeScene must be an object or null");
  return {
    sceneId: normaliseId(value.sceneId, "narrative.activeScene.sceneId"),
    beatIndex: toBoundedInteger(value.beatIndex, "narrative.activeScene.beatIndex", 0, 1024),
  };
}

function normaliseGoalProgress(value) {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) throw new TypeError("narrative.goalProgress must be an object");
  const entries = Object.entries(value);
  if (entries.length > NARRATIVE_GOAL_LIMIT) {
    throw new RangeError(`narrative.goalProgress must contain at most ${NARRATIVE_GOAL_LIMIT} goals`);
  }
  return Object.fromEntries(entries.map(([goalId, progress]) => [
    normaliseId(goalId, "narrative.goalProgress goal ID"),
    normaliseGoalProgressEntry(progress, goalId),
  ]));
}

function normaliseGoalProgressEntry(value, goalId) {
  if (!isPlainObject(value)) throw new TypeError(`narrative.goalProgress.${goalId} must be an object`);
  return {
    counters: normaliseNumberRecord(value.counters, `narrative.goalProgress.${goalId}.counters`),
    flags: normaliseIds(value.flags, `narrative.goalProgress.${goalId}.flags`, NARRATIVE_PROGRESS_KEY_LIMIT),
    actorStreaks: normaliseNumberRecord(
      value.actorStreaks,
      `narrative.goalProgress.${goalId}.actorStreaks`,
    ),
  };
}

function normaliseNumberRecord(value, name) {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) throw new TypeError(`${name} must be an object`);
  const entries = Object.entries(value);
  if (entries.length > NARRATIVE_PROGRESS_KEY_LIMIT) {
    throw new RangeError(`${name} must contain at most ${NARRATIVE_PROGRESS_KEY_LIMIT} keys`);
  }
  return Object.fromEntries(entries.map(([key, count]) => [
    normaliseId(key, `${name} key`),
    toNonNegativeInteger(count, `${name}.${key}`),
  ]));
}

function normaliseIds(value, name, limit) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  const ids = [];
  const seen = new Set();
  for (const id of value) {
    // Save arrays are forward-compatible collections: malformed entries are
    // discarded while unknown, well-formed IDs are retained for newer builds.
    if (typeof id !== "string" || id.trim().length === 0) continue;
    const normalized = id.trim();
    if (normalized.length > NARRATIVE_ID_LENGTH_LIMIT) continue;
    if (!NARRATIVE_ID_PATTERN.test(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    ids.push(normalized);
    if (ids.length === limit) break;
  }
  return ids;
}

function normaliseNullableId(value, name) {
  if (value === undefined || value === null) return null;
  return normaliseId(value, name);
}

function normaliseId(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.length > NARRATIVE_ID_LENGTH_LIMIT || !NARRATIVE_ID_PATTERN.test(normalized)) {
    throw new TypeError(`${name} must be a stable narrative identifier`);
  }
  return normalized;
}

function toNonNegativeInteger(value, name) {
  const normalized = value ?? 0;
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
  return normalized;
}

function toPositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  return value;
}

function toBoundedInteger(value, name, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) deepFreeze(child);
  }
  return value;
}

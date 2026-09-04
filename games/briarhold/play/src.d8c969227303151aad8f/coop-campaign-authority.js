import {
  createBattlefieldCheckpoint,
  restoreBattlefieldCheckpoint,
  BATTLEFIELD_CHECKPOINT_VERSION,
} from "./battlefield-checkpoint.js";
import {ACTIVE, DEAD, DYING} from "./battlefield.js";
import {GAME_PHASES} from "./contracts.js";
import {enemyArchetype} from "./enemies.js";
import {
  BOSS_ENCOUNTER_DEFINITIONS,
  createBossDirector,
  normaliseBossDirector,
  serialiseBossDirector,
} from "./boss-director.js";
import {advanceInterwaveRecovery, prepareSoloCampaignBuild, prepareSoloCampaignDaytime} from "./campaign-runtime.js";
import {CAMPAIGN_COOP_MODIFIERS, getCampaignWave} from "./campaign-content.js";
import {calculateRunBoonEffects, createBoonOffer, RUN_BOON_POOL} from "./boons.js";
import {BRIARHOLD_FIRST_PERSON_MAP} from "./map-definition.js";
import {encodeCheckpoint} from "./coop-world-wire.js";
import {createNetworkPlayerState, createSessionWeaponState} from "./multiplayer-contracts.js";
import {
  advanceNarrativeScene,
  chooseNarrativeResponse,
  skipNarrativeScene,
} from "./narrative-director.js";
import {
  createRunState,
  normaliseProfileState,
  normaliseRunState,
  OATHMARK_REWARD_RATES_V2,
  PERMANENT_RANK_TRACKS,
  resolveRunLoadout,
  transferPendingNarrativeSequence,
} from "./progression.js";
import {HUB_FEATURES, HUB_NPC_IDS} from "./hub.js";
import {
  normaliseNarrativeProfileState,
  normaliseNarrativeRunState,
} from "./narrative-state.js";
import {RELATIONSHIP_GOALS} from "./relationship-goals.js";
import {prepareNightRuntimeState} from "./runtime-progression.js";
import {
  createAuthoritativeDelayedEffectQueue,
  restoreAuthoritativeDelayedEffects,
  snapshotAuthoritativeDelayedEffects,
} from "./authoritative-delayed-effects.js";

export const COOP_CAMPAIGN_CHECKPOINT_VERSION = 4;
export const COOP_CROWD_COHORT_CAP = 192;
export const COOP_SEMANTIC_EVENT_CAP = 256;
export const COOP_ACTION_LEDGER_SNAPSHOT_VERSION = 1;

const COOP_PUBLISHED_PHASES = new Set([
  GAME_PHASES.BUILD_BREAK,
  GAME_PHASES.DAYTIME,
  GAME_PHASES.INTERWAVE_RECOVERY,
  GAME_PHASES.COMBAT,
  GAME_PHASES.NIGHT_COMPLETE,
  GAME_PHASES.BOON_CHOICE,
  GAME_PHASES.RUN_FAILED,
  GAME_PHASES.CAMPAIGN_COMPLETE,
]);
const COOP_CHECKPOINT_PHASES = new Set([
  ...COOP_PUBLISHED_PHASES,
  GAME_PHASES.INTERWAVE_RECOVERY,
]);

const AUTHORED_BUILD_SOCKETS = new Map(BRIARHOLD_FIRST_PERSON_MAP.buildSockets.map(socket => [socket.id, socket]));
const FORTIFICATION_MAP_KINDS = Object.freeze({
  barricade: "barricade",
  thornSnare: "thorn-snare",
  firePot: "fire-pot",
  wardLantern: "ward-lantern",
  ballista: "ballista",
});
const OBJECTIVE_BY_NIGHT = Object.freeze({2: "hold-east-gate", 6: "last-caravan"});

export function shouldPublishCoopAuthorityPhase(phase) {
  return COOP_PUBLISHED_PHASES.has(phase);
}

const COOP_NARRATIVE_ACTION_FIELDS = Object.freeze({
  npc_interaction: ["npcId", "runOrdinal", "night"],
  scene_advance: ["sceneId", "beatIndex", "runOrdinal", "night"],
  scene_response: ["sceneId", "beatIndex", "responseId", "runOrdinal", "night"],
  scene_skip: ["sceneId", "beatIndex", "runOrdinal", "night"],
  goal_accept: ["npcId", "goalId", "eventId", "runOrdinal", "night"],
  goal_report: ["npcId", "goalId", "eventId", "runOrdinal", "night"],
  daywork: ["npcId", "actionId", "targetId", "requestId", "runOrdinal", "night"],
  medicine_prepare: ["npcId", "requestId", "runOrdinal", "night"],
  medicine_consume: ["actorId", "requestId", "runOrdinal", "night"],
  bell_confirm: ["briefingSceneId", "confirmationId", "runOrdinal", "night"],
  goals_panel: ["npcId", "runOrdinal", "night"],
  service_request: ["npcId", "serviceId", "runOrdinal", "night"],
});

const GOAL_DEFINITION_BY_ID = new Map(RELATIONSHIP_GOALS.map(goal => [goal.id, goal]));

function relationshipRewardIds(record) {
  const ids = new Set();
  for (const goalId of record.completedGoalIds) {
    const reward = GOAL_DEFINITION_BY_ID.get(goalId)?.reward;
    for (const id of Object.keys(reward?.rankCeilings ?? {})) ids.add(id);
    for (const id of reward?.unlockIds ?? []) ids.add(id);
    for (const id of reward?.recipeIds ?? []) ids.add(id);
  }
  return [...ids].sort((left, right) => left.localeCompare(right, "en-US"));
}

function progressEntries(record, key) {
  return Object.entries(record ?? {}).sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([id, value]) => ({[key]: id, value}));
}

/** Canonical ID-only realtime projection; catalogue prose remains local. */
export function createCoopNarrativeAuthorityState({profile, run, authorityTick = 0, responseId = null, responseTagId = null} = {}) {
  const currentProfile = normaliseProfileState(profile);
  const currentRun = normaliseRunState(run);
  const remainingTicks = currentRun.phase === GAME_PHASES.INTERWAVE_RECOVERY
    ? Math.min(360, Math.max(0, Math.ceil(currentRun.recovery.remainingMs * 30 / 1000)))
    : 0;
  const relationships = Object.entries(currentProfile.relationships)
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([npcId, relationship]) => ({npcId, status: relationship.status,
      activeGoalId: relationship.activeGoalId, readyGoalId: relationship.readyGoalId,
      completedGoalIds: [...relationship.completedGoalIds], rewardIds: relationshipRewardIds(relationship)}));
  const goalProgress = Object.entries(currentRun.narrative.goalProgress)
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([goalId, progress]) => ({goalId,
      counters: progressEntries(progress.counters, "id"), flags: [...progress.flags],
      actorStreaks: progressEntries(progress.actorStreaks, "actorId")}));
  return {
    runOrdinal: currentRun.runOrdinal,
    recovery: currentRun.phase === GAME_PHASES.INTERWAVE_RECOVERY
      ? {deadlineTick: authorityTick + remainingTicks, remainingTicks}
      : null,
    activeScene: currentRun.narrative.activeScene ? {...currentRun.narrative.activeScene, responseId, responseTagId} : null,
    completedSceneIds: [...currentRun.narrative.completedSceneIds],
    seenSceneIds: [...currentProfile.narrative.seenSceneIds],
    responseTagIds: [...currentProfile.narrative.responseTags],
    daywork: currentRun.narrative.daywork ? {...currentRun.narrative.daywork} : null,
    medicine: {night: currentRun.playerMedicine.night, prepared: currentRun.playerMedicine.prepared,
      available: currentRun.playerMedicine.available,
      prepareReceiptId: currentRun.playerMedicine.prepareReceipt?.requestId ?? null,
      consumeReceiptId: currentRun.playerMedicine.consumeReceipt?.requestId ?? null,
      actorId: currentRun.playerMedicine.consumeReceipt?.actorId ?? null},
    goals: relationships,
    goalProgress,
    rosterIds: [...currentRun.hub.activeNpcs].sort((left, right) => left.localeCompare(right, "en-US")),
    fallenIds: [...currentRun.fallenNpcs].sort((left, right) => left.localeCompare(right, "en-US")),
    nightStartingNpcIds: [...currentRun.nightStartingNpcIds].sort((left, right) => left.localeCompare(right, "en-US")),
  };
}

const GUEST_NARRATIVE_REQUESTS = new Set(["npc_interaction", "medicine_consume", "goals_panel", "service_request"]);

/** Reject caller-authored authority facts before a host mutation adapter runs. */
export function validateCoopNarrativeMutation({request, executorRole, requesterRole = "host", role, run} = {}) {
  const executor = executorRole ?? role;
  if (executor !== "host") throw new Error("narrative mutation executor must be host authority");
  if (!new Set(["host", "guest"]).has(requesterRole)) throw new TypeError("narrative mutation requester role is invalid");
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new TypeError("narrative mutation request is required");
  const fields = COOP_NARRATIVE_ACTION_FIELDS[request.action];
  if (!fields) throw new RangeError("narrative mutation action is unsupported");
  if (requesterRole === "guest" && !GUEST_NARRATIVE_REQUESTS.has(request.action)) {
    throw new Error(`${request.action} is host authority only`);
  }
  const payload = request.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new TypeError("narrative mutation payload is required");
  const allowed = new Set(fields);
  for (const key of Object.keys(payload)) if (!allowed.has(key)) throw new TypeError(`narrative mutation caller field ${key} is not authoritative`);
  for (const key of fields) if (!(key in payload)) throw new TypeError(`narrative mutation payload is missing ${key}`);
  const current = normaliseRunState(run);
  if (payload.runOrdinal !== current.runOrdinal) throw new Error("stale narrative run ordinal");
  if (payload.night !== current.night) throw new Error("stale narrative night");
  for (const field of fields) {
    if (["runOrdinal", "night", "beatIndex"].includes(field) || (field === "targetId" && payload[field] === null)) continue;
    stableId(payload[field], `narrative mutation ${field}`);
  }
  if (payload.sceneId !== undefined && (current.narrative.activeScene?.sceneId !== payload.sceneId
    || current.narrative.activeScene.beatIndex !== payload.beatIndex)) throw new Error("stale narrative scene or beat");
  if (request.action === "npc_interaction") {
    if (current.phase !== GAME_PHASES.DAYTIME) throw new Error("NPC interaction is available only during daytime");
    if (current.narrative.activeScene) throw new Error("a shared narrative scene is already active");
  }
  if (["goal_accept", "goal_report", "daywork", "medicine_prepare", "bell_confirm", "goals_panel", "service_request"].includes(request.action)
    && current.phase !== GAME_PHASES.DAYTIME) throw new Error(`${request.action} is available only during daytime`);
  if (request.action === "medicine_consume" && current.phase !== GAME_PHASES.COMBAT) {
    throw new Error("medicine consume is available only during combat");
  }
  return payload;
}

/** Host-computed NPC eligibility shared by the live adapter and loopback harness. */
export function validateCoopNpcInteractionAuthority({request, requesterRole = "guest", run, profile, actor, station,
  serviceAvailable} = {}) {
  const payload = validateCoopNarrativeMutation({request, executorRole: "host", requesterRole, run});
  const current = normaliseRunState(run);
  normaliseProfileState(profile);
  if (!actor?.position || !Number.isFinite(actor.hp) || actor.hp <= 0) throw new Error("actor_unavailable");
  if (!station?.position || station.kind !== payload.npcId) throw new Error("npc_unavailable");
  if (current.fallenNpcs.includes(payload.npcId)) throw new Error("npc_fallen");
  if (!current.hub.activeNpcs.includes(payload.npcId)) throw new Error("npc_unavailable");
  const radius = Math.min(2.5, Number.isFinite(station.interactionRadius) ? station.interactionRadius : 0);
  const distance = Math.hypot(
    station.position.x - actor.position.x,
    station.position.z - actor.position.z,
  );
  if (distance > radius) throw new Error("npc_out_of_range");
  if (serviceAvailable !== true) throw new Error("npc_service_unavailable");
  return payload;
}

/** Apply a host-authoritative scene intent through the production narrative state machine. */
export function applyCoopNarrativeSessionAction({request, requesterRole = "host", run, session} = {}) {
  validateCoopNarrativeMutation({request, executorRole: "host", requesterRole, run});
  if (!session || session.sceneId !== request.payload.sceneId || session.beatIndex !== request.payload.beatIndex) {
    throw new Error("stale_scene");
  }
  if (request.action === "scene_response") {
    return advanceNarrativeScene(chooseNarrativeResponse(session, request.payload.responseId));
  }
  if (request.action === "scene_advance") return advanceNarrativeScene(session);
  if (request.action === "scene_skip") return skipNarrativeScene(session);
  throw new Error("unsupported_action");
}

export function coopNarrativeBeatKey(activeScene) {
  return activeScene ? `${activeScene.sceneId}:${activeScene.beatIndex}` : null;
}

/** Guest Hide is a local presentation transition and deliberately has no action payload. */
export function hideCoopGuestNarrative(activeScene) {
  const hiddenBeatKey = coopNarrativeBeatKey(activeScene);
  if (!hiddenBeatKey) throw new Error("shared_scene_not_available");
  return Object.freeze({hiddenBeatKey, waitingForHost: true, authorityAction: null});
}

/** Resolve whether a host-authored beat should be opened after Hide or reconnect. */
export function resolveCoopGuestNarrativePresentation({activeScene, hiddenBeatKey = null, forceOpen = false} = {}) {
  const beatKey = coopNarrativeBeatKey(activeScene);
  if (!beatKey) return Object.freeze({beatKey: null, shouldOpen: false, hiddenBeatKey: null});
  const shouldOpen = forceOpen === true || hiddenBeatKey !== beatKey;
  return Object.freeze({beatKey, shouldOpen, hiddenBeatKey: shouldOpen ? null : hiddenBeatKey});
}

export function resolveCoopTerminalResultAction({connected = false, role = null, phase = null} = {}) {
  if (connected !== true) return "default";
  if (role === "guest" && phase === GAME_PHASES.NIGHT_COMPLETE) return "wait";
  if (role === "guest" && [GAME_PHASES.RUN_FAILED, GAME_PHASES.CAMPAIGN_COMPLETE].includes(phase)) return "leave";
  if (role === "host" && [GAME_PHASES.RUN_FAILED, GAME_PHASES.CAMPAIGN_COMPLETE].includes(phase)) return "begin_again";
  return "default";
}

/** The automatic co-op recovery path always applies the authored two-Warden scaling. */
export function advanceCoopCampaignRecovery(run, elapsedMs, waveOptions = {}) {
  return advanceInterwaveRecovery(run, elapsedMs, {
    mode: "coop",
    paused: false,
    authoritativeHostTick: true,
    waveOptions: {...waveOptions, hpMultiplier: CAMPAIGN_COOP_MODIFIERS.bossHpMultiplier},
  });
}

/**
 * Connected guests render the host's projected recovery deadline but never
 * advance the campaign clock themselves. Returning false here keeps the guest
 * from crossing the boundary with its intentionally read-only partial run.
 */
export function canAdvanceCampaignRecoveryLocally({connected = false, role = null} = {}) {
  return role !== "guest";
}

/** Apply an ID-only frame projection to a guest's read-only session model. */
export function projectCoopNarrativeGuestState({profile, run, narrative, authorityTick = 0} = {}) {
  const currentProfile = normaliseProfileState(profile);
  const currentRun = normaliseRunState(run);
  if (!narrative || typeof narrative !== "object" || Array.isArray(narrative)) {
    throw new TypeError("co-op narrative projection is required");
  }
  if (narrative.runOrdinal !== currentRun.runOrdinal) throw new Error("stale co-op narrative projection ordinal");
  const relationships = {...currentProfile.relationships};
  for (const goal of narrative.goals ?? []) {
    if (!relationships[goal.npcId]) continue;
    relationships[goal.npcId] = {
      ...relationships[goal.npcId],
      status: goal.status,
      activeGoalId: goal.activeGoalId,
      readyGoalId: goal.readyGoalId,
      completedGoalIds: [...goal.completedGoalIds],
    };
  }
  const goalProgress = Object.fromEntries((narrative.goalProgress ?? []).map(item => [item.goalId, {
    counters: Object.fromEntries(item.counters.map(entry => [entry.id, entry.value])),
    flags: [...item.flags],
    actorStreaks: Object.fromEntries(item.actorStreaks.map(entry => [entry.actorId, entry.value])),
  }]));
  const remainingTicks = narrative.recovery
    ? Math.max(0, narrative.recovery.deadlineTick - authorityTick)
    : 0;
  return {
    profile: {
      ...currentProfile,
      relationships,
      narrative: normaliseNarrativeProfileState({
        ...currentProfile.narrative,
        seenSceneIds: narrative.seenSceneIds,
        responseTags: narrative.responseTagIds,
      }),
    },
    run: {
      ...currentRun,
      recovery: narrative.recovery ? {remainingMs: remainingTicks * 1000 / 30} : currentRun.recovery,
      hub: {...currentRun.hub, activeNpcs: [...narrative.rosterIds]},
      fallenNpcs: [...narrative.fallenIds],
      nightStartingNpcIds: [...narrative.nightStartingNpcIds],
      narrative: normaliseNarrativeRunState({
        ...currentRun.narrative,
        completedSceneIds: narrative.completedSceneIds,
        activeScene: narrative.activeScene ? {
          sceneId: narrative.activeScene.sceneId,
          beatIndex: narrative.activeScene.beatIndex,
        } : null,
        daywork: narrative.daywork,
        goalProgress,
      }),
    },
    remainingRecoveryMs: remainingTicks * 1000 / 30,
  };
}

/** Preserve solo state for guests; hosts may durably commit one terminal profile. */
export function createCoopPersistenceBoundary({role = "guest", profile, run, storage = null, storageKey = null} = {}) {
  if (!["host", "guest"].includes(role)) throw new TypeError("co-op persistence role is invalid");
  const originalProfile = clone(profile);
  const originalRun = run === null ? null : clone(run);
  const key = storageKey === null ? null : String(storageKey);
  const persistedBytes = storage && key !== null ? storage.getItem(key) : null;
  let restored = false;
  let discarded = false;
  let committed = null;
  return Object.freeze({
    role,
    persist(nextProfile, nextRun = null) {
      if (discarded || role !== "host") return false;
      committed = {profile: clone(nextProfile), run: nextRun === null ? null : clone(nextRun)};
      return true;
    },
    discard() {
      if (discarded) return false;
      discarded = true;
      committed = null;
      return true;
    },
    restore() {
      if (discarded) return null;
      if (role === "host" && committed) {
        restored = true;
        return {profile: clone(committed.profile), run: committed.run === null ? null : clone(committed.run),
          persistedBytes: storage && key !== null ? storage.getItem(key) : null};
      }
      if (!restored && storage && key !== null && storage.getItem(key) !== persistedBytes) {
        if (persistedBytes === null) storage.removeItem(key);
        else storage.setItem(key, persistedBytes);
      }
      restored = true;
      return {profile: clone(originalProfile), run: originalRun === null ? null : clone(originalRun), persistedBytes};
    },
  });
}

export function applyCoopWeaponKillAttribution({actorId, weaponId, enemyId, killed, ledger} = {}) {
  const resolvedActorId = stableId(actorId, "co-op kill actorId");
  const resolvedWeaponId = stableId(weaponId, "co-op kill weaponId");
  if (!["arbalest", "sunfire", "runebolt"].includes(resolvedWeaponId)) throw new RangeError("co-op kill weapon is invalid");
  const resolvedEnemyId = stableId(enemyId, "co-op kill enemyId");
  if (!(ledger instanceof Set)) throw new TypeError("co-op kill attribution requires a Set ledger");
  const key = `${resolvedEnemyId}:${resolvedWeaponId}`;
  const grant = killed === true && !ledger.has(key);
  if (grant) ledger.add(key);
  return {source: `player:${resolvedWeaponId}`, actorId: resolvedActorId, weaponId: resolvedWeaponId, enemyId: resolvedEnemyId, grant};
}

/** One unambiguous production Context priority for either Warden. */
export function resolveCoopContextIntent({
  phase,
  localPlayerId,
  players = [],
  sharedRevive = null,
  wardActorId = null,
  manualVentAvailable = false,
  bellkeeperRallyAvailable = false,
} = {}) {
  if (phase !== GAME_PHASES.COMBAT) return null;
  const local = players.find(player => player?.playerId === localPlayerId);
  const downed = local?.hp > 0 && !players.every(player => player?.hp <= 0)
    ? players.find(player => player?.playerId !== localPlayerId && player?.hp <= 0
    && local?.position && player?.position
    && Math.hypot(player.position.x - local.position.x, player.position.z - local.position.z) <= 3.2)
    : null;
  if (downed && sharedRevive?.available === true && sharedRevive.consumed !== true && sharedRevive.reviveHp === 30) {
    return {action: "revive", payload: {targetPlayerId: downed.playerId}};
  }
  if (wardActorId) return {action: "ward_light", payload: {actorId: stableId(wardActorId, "Ward actorId")}};
  if (manualVentAvailable) return {action: "manual_vent", payload: {}};
  if (bellkeeperRallyAvailable) return {action: "npc_action", payload: {npcId: "bellkeeper", actionId: "rally"}};
  return null;
}

export const resolveGuestCoopContextIntent = resolveCoopContextIntent;

export function validateCoopWardLightContext({phase, authoredBossActive, actor, target, occluded} = {}) {
  if (phase !== GAME_PHASES.COMBAT || authoredBossActive !== true) throw new Error("ward_light_wrong_phase");
  if (!actor?.position || !Number.isFinite(actor.facing?.yaw)) throw new Error("ward_light_actor_invalid");
  if (!target?.position || target.defeated === true || target.state !== "phased") throw new Error("ward_light_target_invalid");
  const dx = target.position.x - actor.position.x;
  const dz = target.position.z - actor.position.z;
  const distance = Math.hypot(dx, dz);
  if (distance > 24) throw new Error("ward_light_out_of_range");
  const dot = distance > 1e-9
    ? (Math.sin(actor.facing.yaw) * dx + Math.cos(actor.facing.yaw) * dz) / distance
    : 1;
  if (dot < Math.cos(Math.PI / 4)) throw new Error("ward_light_outside_aim");
  if (occluded !== false) throw new Error("ward_light_occluded");
  return Object.freeze({source: {x: actor.position.x, z: actor.position.z}, direction: {x: dx, z: dz}});
}

export function validateCoopNpcActionContext({phase, npcId, actionId, nearestNpcId, rally} = {}) {
  if (phase !== GAME_PHASES.COMBAT) throw new Error("npc_action_wrong_phase");
  if (npcId !== "bellkeeper" || actionId !== "rally") throw new Error("npc_action_unsupported");
  if (nearestNpcId !== "bellkeeper") throw new Error("npc_action_out_of_proximity");
  if (rally?.available !== true || rally.used === true) throw new Error("npc_action_token_unavailable");
  if (!Number.isFinite(rally.remaining) || rally.remaining !== 0) throw new Error("npc_action_on_cooldown");
  if (!Number.isFinite(rally.duration) || rally.duration <= 0) throw new Error("npc_action_invalid_duration");
  return true;
}

const CHECKPOINT_KEYS = new Set([
  "version",
  "protocolVersion",
  "authorityTick",
  "eventCursor",
  "profile",
  "run",
  "players",
  "battlefield",
  "boss",
  "objective",
  "actionLedger",
  "delayedEffects",
  "semanticEvents",
  "settlement",
  "hash",
]);
const EVENT_KEYS = new Set([
  "sequence",
  "authorityTick",
  "category",
  "kind",
  "actorId",
  "payload",
]);
const EVENT_PAYLOAD_KEYS = new Set([
  "encounterId",
  "phase",
  "attack",
  "zoneId",
  "targetId",
  "amount",
  "night",
  "wave",
  "state",
  "cue",
]);
const SETTLEMENT_KEYS = new Set(["status", "runOrdinal", "outcome"]);
const ACTION_LEDGER_KEYS = new Set(["version", "streams"]);
const ACTION_STREAM_KEYS = new Set(["peerId", "stream", "highestSequence", "entries"]);
const ACTION_ENTRY_KEYS = new Set(["requestId", "fingerprint", "ack"]);
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,127}$/u;
const PROFILE_REQUIRED_KEYS = new Set([
  "version", "migrationVersion", "oathmarks", "unlocks", "hubUnlocks", "terminalRuns", "ranks", "settings",
  "wardenBranches", "weaponMastery", "rewardLedger", "narrative", "relationships",
]);
const RUN_REQUIRED_KEYS = new Set([
  "version", "phase", "night", "wave", "player", "gates", "supplies", "fortifications", "boons", "boonChoices",
  "boonPoolVersion", "earnedOathmarks", "emergencyHealUsed", "runSeed", "runOrdinal", "fallenNpcs", "rewardLedger",
  "pendingWeaponXp", "hub", "waveStartSnapshot", "bossEncounter", "narrative", "dayworkBenefit", "playerMedicine",
]);
const RUN_OPTIONAL_KEYS = new Set([
  "objectiveState", "nightRuntime", "hubCombat", "recovery", "bellConfirmation", "nightStartingNpcIds",
]);
const RUN_PLAYER_KEYS = new Set(["hp", "maxHp"]);
const RUN_DAYWORK_BENEFIT_KEYS = new Set(["gateRepairDiscountAvailable", "consumeReceipt"]);
const RUN_PLAYER_MEDICINE_KEYS = new Set([
  "night", "prepared", "available", "prepareReceipt", "consumeReceipt",
]);
const DAYWORK_BENEFIT_RECEIPT_KEYS = new Set(["eventId", "night", "runOrdinal"]);
const MEDICINE_PREPARE_RECEIPT_KEYS = new Set(["requestId", "night", "runOrdinal"]);
const MEDICINE_CONSUME_RECEIPT_KEYS = new Set([
  "requestId", "night", "runOrdinal", "actorId", "hpBefore", "maxHp",
]);
const RUN_RECOVERY_KEYS = new Set(["remainingMs"]);
const BELL_CONFIRMATION_KEYS = new Set(["confirmationId", "briefingSceneId", "night", "runOrdinal"]);
const RUN_GATES_KEYS = new Set(["outer", "heart"]);
const RUN_GATE_KEYS = new Set(["kind", "integrity", "maxIntegrity", "destroyed"]);
const RUN_HUB_KEYS = new Set(["features", "activeNpcs", "introductionQueue"]);
const RUN_HUB_FEATURE_KEYS = new Set(["integrity", "repaired", "tier"]);
const RUN_FORTIFICATION_KEYS = new Set(["socketId", "type", "charges"]);
const RUN_FORTIFICATION_OPTIONAL_KEYS = new Set(["disabledForWave", "disabledBy"]);
const NIGHT_RUNTIME_KEYS = new Set(["night", "twinThorns", "bellkeeperRally", "courtyardRally", "lastOath"]);
const TWIN_THORNS_KEYS = new Set(["available", "consumed", "reviveHp"]);
const RALLY_RUNTIME_KEYS = new Set(["available", "used", "remaining", "duration"]);
const OBJECTIVE_KEYS = new Set(["night", "id", "label", "status", "evidence"]);
const OBJECTIVE_EVIDENCE_REQUIRED_KEYS = new Set(["kind", "evaluatedWaves", "failedWave"]);
const OBJECTIVE_EVIDENCE_OPTIONAL_KEYS = new Set(["eastApproachWardHeld", "caravanPassageHeld", "livingEscortCount",
  "bossObjectiveMaxDurability", "bossObjectiveDurability", "bossObjectiveDamage", "bossShieldFeedsBroken"]);
const HUB_COMBAT_KEYS = new Set(["version", "westPortcullisBreached", "elapsed", "defenders"]);
const HUB_COMBAT_DEFENDER_KEYS = new Set(["hp", "cooldown", "fallen"]);
const CROWD_BOSS_KEYS = new Set(["version", "night", "wave", "encounterId", "actorIds", "actors", "mode", "status",
  "eventSequence", "label"]);
const CROWD_BOSS_ACTOR_KEYS = new Set(["id", "title", "status"]);
const NARRATIVE_PROFILE_KEYS = new Set([
  "failedRuns", "deepestNight", "debtBroken", "campaignCompletions", "seenSceneIds", "responseTags",
  "postDebtArrivalIds", "pendingSequence", "lastFailure",
]);
const NARRATIVE_RUN_KEYS = new Set([
  "mode", "completedSceneIds", "pendingSceneIds", "daywork", "activeScene", "goalProgress",
]);
const RELATIONSHIP_RECORD_KEYS = new Set([
  "status", "activeGoalId", "readyGoalId", "completedGoalIds", "cumulative",
]);
const PROFILE_RANK_IDS = new Set(PERMANENT_RANK_TRACKS.map(track => track.id));
const RUN_HUB_FEATURE_IDS = new Set(HUB_FEATURES.map(feature => feature.id));

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function exactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${label}.${key} is an unexpected field`);
  }
}

function exactRequiredKeys(value, required, optional, label) {
  const input = record(value, label);
  for (const key of required) if (!Object.hasOwn(input, key)) throw new TypeError(`${label}.${key} is required`);
  for (const key of Object.keys(input)) {
    if (!required.has(key) && !optional.has(key)) throw new TypeError(`${label}.${key} is an unexpected field`);
  }
  return input;
}

function validateCheckpointProfileShape(value) {
  const input = exactRequiredKeys(value, PROFILE_REQUIRED_KEYS, new Set(), "co-op checkpoint profile");
  exactRequiredKeys(input.ranks, PROFILE_RANK_IDS, new Set(), "co-op checkpoint profile.ranks");
  exactRequiredKeys(input.wardenBranches, new Set(["owned", "active"]), new Set(), "co-op checkpoint profile.wardenBranches");
  exactRequiredKeys(input.rewardLedger, new Set(["claimed"]), new Set(), "co-op checkpoint profile.rewardLedger");
  const mastery = exactRequiredKeys(input.weaponMastery, new Set(["arbalest", "sunfire", "runebolt"]), new Set(),
    "co-op checkpoint profile.weaponMastery");
  for (const weaponId of ["arbalest", "sunfire", "runebolt"]) {
    exactRequiredKeys(mastery[weaponId], new Set(["xp", "owned", "active"]), new Set(),
      `co-op checkpoint profile.weaponMastery.${weaponId}`);
  }
  validateCanonicalNarrativeProfile(input.narrative, "co-op checkpoint profile.narrative");
  validateCanonicalRelationships(input.relationships, "co-op checkpoint profile.relationships");
}

function validateCanonicalNarrativeProfile(value, path) {
  const input = exactRequiredKeys(value, NARRATIVE_PROFILE_KEYS, new Set(), path);
  const normalized = normaliseNarrativeProfileState(input);
  if (JSON.stringify(input) !== JSON.stringify(normalized)) {
    throw new TypeError(`${path} must use canonical bounded narrative state`);
  }
}

function validateCanonicalRelationships(value, path) {
  const input = record(value, path);
  for (const [npcId, relationship] of Object.entries(input)) {
    exactRequiredKeys(relationship, RELATIONSHIP_RECORD_KEYS, new Set(), `${path}.${npcId}`);
  }
  const normalized = normaliseProfileState({relationships: input}).relationships;
  if (JSON.stringify(input) !== JSON.stringify(normalized)) {
    throw new TypeError(`${path} must use canonical relationship state`);
  }
}

function validateCanonicalNarrativeRun(value, path) {
  const input = exactRequiredKeys(value, NARRATIVE_RUN_KEYS, new Set(), path);
  const normalized = normaliseNarrativeRunState(input);
  if (JSON.stringify(input) !== JSON.stringify(normalized)) {
    throw new TypeError(`${path} must use canonical bounded narrative state`);
  }
}

function integer(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw new RangeError(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return number;
}

function finite(value, label, minimum = -1_000_000, maximum = 1_000_000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new RangeError(`${label} must be finite and bounded`);
  }
  return Math.fround(number);
}

function stableId(value, label, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || !STABLE_ID.test(value)) {
    throw new TypeError(`${label} must be a stable identifier`);
  }
  return value;
}

function clone(value) {
  if (typeof structuredClone !== "function") throw new Error("co-op campaign authority requires structuredClone");
  return structuredClone(value);
}

/**
 * RunState owns campaign vitality only. Live pose, facing, and weapon data are
 * already carried by the checkpoint's authoritative players collection, so
 * project those runtime-only fields out before strict RunState validation.
 */
export function projectCoopCheckpointRun(value) {
  const projected = clone(record(value, "co-op checkpoint source run"));
  const player = record(projected.player, "co-op checkpoint source run.player");
  projected.player = {hp: player.hp, maxHp: player.maxHp};
  if (projected.waveStartSnapshot !== null && projected.waveStartSnapshot !== undefined) {
    projected.waveStartSnapshot = projectCoopCheckpointRun(projected.waveStartSnapshot);
  }
  return projected;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/** Create the canonical host-owned run with the exact shared two-player economy. */
export function createCoopCampaignRun(profile, options = {}) {
  const currentProfile = normaliseProfileState(profile);
  const run = createRunState({
    ...options,
    profile: currentProfile,
    supplies: options.supplies ?? CAMPAIGN_COOP_MODIFIERS.sharedStartingSupplies,
  });
  return prepareSoloCampaignBuild(prepareNightRuntimeState(currentProfile, run, {newNight: true}));
}

const COOP_WEAPON_IDS = Object.freeze(["arbalest", "sunfire", "runebolt"]);
const COOP_WARDEN_SPAWNS = Object.freeze({
  "warden-host": Object.freeze({x: -17.5, y: 3.5, z: 17}),
  "warden-guest": Object.freeze({x: -14.5, y: 3.5, z: 17}),
});

/** Seed a fresh shared run from the durably settled host profile and reset both Wardens. */
export function createCoopCampaignRestart({profile, players = [], runSeed = 1} = {}) {
  const currentProfile = normaliseProfileState(profile);
  const createdRun = createCoopCampaignRun(currentProfile, {runSeed});
  const transferred = transferPendingNarrativeSequence(currentProfile, createdRun);
  const daytimeRun = prepareSoloCampaignDaytime(transferred.profile, transferred.run);
  const allowedWeaponSlots = resolveRunLoadout(daytimeRun, transferred.profile).weapons
    .map(weaponId => COOP_WEAPON_IDS.indexOf(weaponId))
    .filter(slot => slot >= 0);
  const selectedWeapon = allowedWeaponSlots[0] ?? 0;
  const resetPlayers = players.map(value => {
    const state = createNetworkPlayerState(value);
    const spawn = COOP_WARDEN_SPAWNS[state.playerId] ?? state.position;
    return createNetworkPlayerState({
      ...state,
      position: {...spawn}, velocity: {x: 0, y: 0, z: 0}, facing: {yaw: 0, pitch: 0},
      traversal: "grounded", grounded: true, eyeHeight: 1.72,
      hp: daytimeRun.player.maxHp, maxHp: daytimeRun.player.maxHp,
      activeWeapon: selectedWeapon, heat: [0, 0, 0], healAvailable: true,
      damageCooldown: 0, sprinting: false, animationState: "idle", animationStartedTick: 0,
      lastProcessedCommand: null,
    });
  });
  const weaponStates = resetPlayers.map(state => createSessionWeaponState({
    playerId: state.playerId,
    selectedWeapon,
    allowedWeapons: allowedWeaponSlots,
    heatByWeapon: [0, 0, 0],
    overheatedByWeapon: [false, false, false],
    nextFireTimeByWeapon: [0, 0, 0],
    shotSequenceByWeapon: [0, 0, 0],
    manualVentReadyAtByWeapon: [0, 0, 0],
    meleeNextReadyTime: 0,
    meleeSequence: 0,
  }));
  return Object.freeze({profile: transferred.profile, run: daytimeRun,
    players: Object.freeze(resetPlayers), weaponStates: Object.freeze(weaponStates),
    allowedWeaponSlots: Object.freeze(allowedWeaponSlots)});
}

function statusLabel(status) {
  if (status === ACTIVE) return "active";
  if (status === DYING) return "dying";
  return "dead";
}

function cohortIndices(total, cap) {
  if (total <= cap) return Array.from({length: total}, (_, index) => index);
  const output = [];
  for (let index = 0; index < cap; index += 1) {
    output.push(Math.min(total - 1, Math.floor(index * (total - 1) / (cap - 1))));
  }
  return [...new Set(output)];
}

/**
 * A deterministic presentation cohort plus truthful aggregate authority. The
 * cohort represents depth; it is never a replacement for the host's arrays.
 */
export function createCoopCrowdPresentation(battlefield, {limit = COOP_CROWD_COHORT_CAP} = {}) {
  if (!battlefield || !Number.isInteger(battlefield.slotCount) || !ArrayBuffer.isView(battlefield.status)) {
    throw new TypeError("a Battlefield is required for co-op crowd presentation");
  }
  const cap = integer(limit, "co-op crowd cohort limit", 1, COOP_CROWD_COHORT_CAP);
  const total = integer(battlefield.slotCount, "co-op crowd total", 0, 6000);
  let active = 0;
  let dying = 0;
  let dead = 0;
  let released = 0;
  for (let id = 0; id < total; id += 1) {
    if (battlefield.status[id] === ACTIVE) active += 1;
    else if (battlefield.status[id] === DYING) dying += 1;
    else if (battlefield.status[id] === DEAD) dead += 1;
    else throw new RangeError(`co-op crowd status is invalid at ${id}`);
    if ((battlefield.companyReleaseAt?.[id] ?? 0) <= (battlefield.elapsed ?? 0) + 1e-6) released += 1;
  }
  const cohort = cohortIndices(total, cap).map((id) => {
    const desiredX = battlefield.desiredVx?.[id] ?? battlefield.vx?.[id] ?? 0;
    const desiredZ = battlefield.desiredVz?.[id] ?? battlefield.vz?.[id] ?? 0;
    const yaw = Math.hypot(desiredX, desiredZ) > 0.001 ? Math.atan2(desiredX, desiredZ) : 0;
    return [
      integer(battlefield.ids?.[id] ?? id, `crowd cohort ${id} stable id`, 0, 5999),
      stableId(enemyArchetype(battlefield.type?.[id] ?? 0).key, `crowd cohort ${id} type`),
      finite(battlefield.x?.[id] ?? 0, `crowd cohort ${id} x`),
      finite(battlefield.z?.[id] ?? 0, `crowd cohort ${id} z`),
      finite(yaw, `crowd cohort ${id} yaw`, -Math.PI * 2, Math.PI * 2),
      statusLabel(battlefield.status[id]),
      finite(Math.max(0, battlefield.hp?.[id] ?? 0), `crowd cohort ${id} hp`, 0, 10_000_000),
    ];
  });
  return deepFreeze({
    total,
    active,
    dying,
    dead,
    released,
    unreleased: total - released,
    cohort,
  });
}

function bossActorSnapshot(actor) {
  return {
    id: stableId(actor.id, "boss actor id"),
    title: String(actor.title ?? actor.id).slice(0, 128),
    position: {
      x: finite(actor.position?.x, "boss actor x"),
      y: finite(actor.position?.y, "boss actor y"),
      z: finite(actor.position?.z, "boss actor z"),
    },
    previousPosition: {
      x: finite(actor.previousPosition?.x, "boss actor previous x"),
      y: finite(actor.previousPosition?.y, "boss actor previous y"),
      z: finite(actor.previousPosition?.z, "boss actor previous z"),
    },
    velocity: {
      x: finite(actor.velocity?.x, "boss actor velocity x"),
      y: finite(actor.velocity?.y, "boss actor velocity y"),
      z: finite(actor.velocity?.z, "boss actor velocity z"),
    },
    heading: finite(actor.heading, "boss actor heading", -Math.PI * 8, Math.PI * 8),
    radius: finite(actor.radius, "boss actor radius", 0.1, 100),
    hp: finite(actor.hp, "boss actor hp", 0, 10_000_000),
    maxHp: finite(actor.maxHp, "boss actor maxHp", 0.001, 10_000_000),
    phase: integer(actor.phase, "boss actor phase", 1, 4),
    state: stableId(actor.state, "boss actor state"),
    cooldownRemainingMs: finite(actor.cooldownRemainingMs, "boss actor cooldown", 0, 3_600_000),
    telegraphUntilMs: finite(actor.telegraphUntilMs, "boss actor telegraph", 0, Number.MAX_SAFE_INTEGER),
    vulnerableUntilMs: finite(actor.vulnerableUntilMs, "boss actor vulnerableUntilMs", 0, Number.MAX_SAFE_INTEGER),
    regenerationInterruptedUntilMs: finite(actor.regenerationInterruptedUntilMs, "boss actor regenerationInterruptedUntilMs", 0, Number.MAX_SAFE_INTEGER),
    hitUntilMs: finite(actor.hitUntilMs, "boss actor hitUntilMs", 0, Number.MAX_SAFE_INTEGER),
    defeatedAtMs: finite(actor.defeatedAtMs, "boss actor defeatedAtMs", 0, Number.MAX_SAFE_INTEGER),
    presentationUntilMs: finite(actor.presentationUntilMs, "boss actor presentationUntilMs", 0, Number.MAX_SAFE_INTEGER),
    livingMossguards: integer(actor.livingMossguards, "boss actor livingMossguards", 0, 3),
    target: {
      id: stableId(actor.target?.id ?? null, "boss actor target id", true),
      x: optionalFinite(actor.target?.x, "boss actor target x"),
      z: optionalFinite(actor.target?.z, "boss actor target z"),
    },
    hitVolumes: (actor.hitVolumes ?? []).map((volume, index) => bossVolumeSnapshot({
      ...volume,
      id: volume.id ?? `${actor.id}:body:${index}`,
      actorId: volume.actorId ?? actor.id,
    })),
    animationState: stableId(actor.animationState, "boss actor animation"),
    flying: actor.position.y > 2 || /flight|dive|breath/u.test(actor.state),
    defeated: actor.defeated === true,
  };
}

function optionalFinite(value, label, minimum = -1_000_000, maximum = 1_000_000) {
  return value === null || value === undefined ? null : finite(value, label, minimum, maximum);
}

function bossVolumeSnapshot(volume) {
  return {
    id: stableId(volume.id, "boss volume id"),
    actorId: stableId(volume.actorId, "boss volume actorId"),
    kind: stableId(volume.kind, "boss volume kind"),
    targetId: stableId(volume.targetId ?? null, "boss volume targetId", true),
    x: optionalFinite(volume.x, "boss volume x"),
    z: optionalFinite(volume.z, "boss volume z"),
    heading: optionalFinite(volume.heading, "boss volume heading", -Math.PI * 8, Math.PI * 8),
    radius: optionalFinite(volume.radius, "boss volume radius", 0, 100),
    width: optionalFinite(volume.width, "boss volume width", 0, 200),
    length: optionalFinite(volume.length, "boss volume length", 0, 400),
    untilMs: optionalFinite(volume.untilMs, "boss volume untilMs", 0, Number.MAX_SAFE_INTEGER),
    activeAtMs: optionalFinite(volume.activeAtMs, "boss volume activeAtMs", 0, Number.MAX_SAFE_INTEGER),
    expiresAtMs: optionalFinite(volume.expiresAtMs, "boss volume expiresAtMs", 0, Number.MAX_SAFE_INTEGER),
    visible: volume.visible === true,
    active: volume.active === true,
    damaging: volume.damaging === true,
  };
}

/** Separate bounded boss authority for guest procedural presentation. */
export function createCoopBossSnapshot(input) {
  if (input === null || input === undefined) return null;
  const boss = normaliseBossDirector(input);
  if (!Array.isArray(boss.actors) || boss.actors.length < 1 || boss.actors.length > 2) {
    throw new RangeError("co-op boss actor count is invalid");
  }
  const zones = boss.zones.map(bossVolumeSnapshot);
  return deepFreeze({
    mode: "authored-director",
    encounterId: stableId(boss.encounterId, "boss encounterId"),
    label: String(boss.label).slice(0, 128),
    status: stableId(boss.status, "boss status"),
    eventSequence: integer(boss.eventSequence, "boss eventSequence"),
    timeMs: integer(boss.timeMs, "boss timeMs"),
    actors: boss.actors.map(bossActorSnapshot),
    hitVolumes: boss.hitVolumes.map(bossVolumeSnapshot),
    zones,
  });
}

export function normalizeCoopSemanticEvent(value) {
  const input = record(value, "co-op semantic event");
  exactKeys(input, EVENT_KEYS, "co-op semantic event");
  if (!["combat", "boss", "music", "campaign"].includes(input.category)) {
    throw new RangeError("co-op semantic event category is unsupported");
  }
  const payloadInput = input.payload ?? {};
  record(payloadInput, "co-op semantic event payload");
  exactKeys(payloadInput, EVENT_PAYLOAD_KEYS, "co-op semantic event payload");
  const payload = {};
  for (const [key, item] of Object.entries(payloadInput)) {
    if (key === "night") payload[key] = integer(item, "co-op semantic event payload night", 1, 7);
    else if (key === "wave") payload[key] = integer(item, "co-op semantic event payload wave", 1, 3);
    else if (["phase", "amount"].includes(key)) payload[key] = finite(item, `co-op semantic event payload ${key}`, 0, 10_000_000);
    else payload[key] = stableId(item, `co-op semantic event payload ${key}`);
  }
  return deepFreeze({
    sequence: integer(input.sequence, "co-op semantic event sequence", 1),
    authorityTick: integer(input.authorityTick, "co-op semantic event authorityTick"),
    category: input.category,
    kind: stableId(input.kind, "co-op semantic event kind"),
    actorId: stableId(input.actorId ?? null, "co-op semantic event actorId", true),
    payload,
  });
}

/** Guest-side exact-once semantic event application. */
export class CoopSemanticEventCursor {
  constructor(sequence = 0) {
    this.sequence = integer(sequence, "co-op semantic event cursor");
  }

  restore(sequence) {
    this.sequence = integer(sequence, "co-op semantic event cursor");
    return this.sequence;
  }

  apply(events, handler) {
    if (!Array.isArray(events) || events.length > COOP_SEMANTIC_EVENT_CAP) {
      throw new RangeError("co-op semantic events must be a bounded array");
    }
    if (typeof handler !== "function") throw new TypeError("co-op semantic event handler is required");
    const normalized = events.map(normalizeCoopSemanticEvent);
    let prior = 0;
    for (const event of normalized) {
      if (event.sequence <= prior) throw new RangeError("co-op semantic event sequence must be strictly ordered");
      prior = event.sequence;
    }
    let applied = 0;
    for (const event of normalized) {
      if (event.sequence <= this.sequence) continue;
      if (event.sequence !== this.sequence + 1) throw new RangeError("co-op semantic event sequence gap requires checkpoint correction");
      // Advance before invoking presentation so a throwing adapter cannot replay
      // a stinger or reward side effect on the next repeated world frame.
      this.sequence = event.sequence;
      handler(event);
      applied += 1;
    }
    return applied;
  }
}

function normalisePlayers(players) {
  if (!Array.isArray(players) || players.length !== 2) throw new RangeError("co-op checkpoint requires exactly two Wardens");
  const normalized = players.map(createNetworkPlayerState)
    .sort((left, right) => left.playerId.localeCompare(right.playerId, "en-US"));
  if (normalized[0].playerId === normalized[1].playerId) throw new RangeError("co-op checkpoint Warden IDs must be unique");
  return normalized;
}

function normaliseBattlefieldCheckpoint(value) {
  const input = clone(record(value, "co-op battlefield checkpoint"));
  if (input.version !== BATTLEFIELD_CHECKPOINT_VERSION) throw new RangeError("co-op battlefield checkpoint version is unsupported");
  const capacity = integer(input.capacity, "co-op battlefield capacity", 1, 6000);
  const slotCount = integer(input.scalars?.slotCount, "co-op battlefield slotCount", 0, capacity);
  integer(input.scalars?.activeCount, "co-op battlefield activeCount", 0, slotCount);
  if (!input.arrays || typeof input.arrays !== "object" || Array.isArray(input.arrays)) throw new TypeError("co-op battlefield arrays are invalid");
  for (const [field, array] of Object.entries(input.arrays)) {
    if (!ArrayBuffer.isView(array) || array instanceof DataView) throw new TypeError(`co-op battlefield array ${field} must be typed`);
    if (array.length > capacity && !["outerGateHp", "outerGateBreached"].includes(field)) {
      throw new RangeError(`co-op battlefield array ${field} exceeds capacity`);
    }
  }
  for (const field of ["ids", "hp", "maxHp", "status", "x", "z", "type"]) {
    if (!ArrayBuffer.isView(input.arrays[field]) || input.arrays[field].length !== slotCount) {
      throw new RangeError(`co-op battlefield array ${field} must match slotCount`);
    }
  }
  for (let id = 0; id < slotCount; id += 1) {
    if (input.arrays.ids[id] !== id) throw new RangeError(`co-op battlefield stable ID mismatch at ${id}`);
    if (!Number.isFinite(input.arrays.hp[id]) || !Number.isFinite(input.arrays.maxHp[id])
      || input.arrays.maxHp[id] <= 0 || input.arrays.hp[id] < 0 || input.arrays.hp[id] > input.arrays.maxHp[id]) {
      throw new RangeError(`co-op battlefield HP is invalid at ${id}`);
    }
  }
  if (!Array.isArray(input.barricades) || input.barricades.length !== 2) throw new RangeError("co-op battlefield barricades are invalid");
  if (!Array.isArray(input.enemyObstacles) || input.enemyObstacles.length > 256) throw new RangeError("co-op battlefield obstacles are invalid");
  if (!Array.isArray(input.playerDamageEvents) || input.playerDamageEvents.length > 4096) throw new RangeError("co-op battlefield damage events are invalid");
  return input;
}

function normaliseActionLedger(value) {
  const input = record(value ?? {version: COOP_ACTION_LEDGER_SNAPSHOT_VERSION, streams: []}, "co-op action ledger");
  exactKeys(input, ACTION_LEDGER_KEYS, "co-op action ledger");
  if (input.version !== COOP_ACTION_LEDGER_SNAPSHOT_VERSION) throw new RangeError("co-op action ledger version is unsupported");
  if (!Array.isArray(input.streams) || input.streams.length > 16) throw new RangeError("co-op action ledger streams are invalid");
  const seen = new Set();
  const streams = input.streams.map((value, index) => {
    const stream = record(value, `co-op action ledger stream ${index}`);
    exactKeys(stream, ACTION_STREAM_KEYS, `co-op action ledger stream ${index}`);
    const peerId = stableId(stream.peerId, "co-op action ledger peerId");
    const streamId = stableId(stream.stream, "co-op action ledger stream");
    const key = `${peerId}:${streamId}`;
    if (seen.has(key)) throw new RangeError("co-op action ledger has duplicate streams");
    seen.add(key);
    if (!Array.isArray(stream.entries) || stream.entries.length > 2048) throw new RangeError("co-op action ledger entries are invalid");
    const entryIds = new Set();
    const entries = stream.entries.map((value, entryIndex) => {
      const entry = record(value, `co-op action ledger entry ${entryIndex}`);
      exactKeys(entry, ACTION_ENTRY_KEYS, `co-op action ledger entry ${entryIndex}`);
      const requestId = stableId(entry.requestId, "co-op action ledger requestId");
      if (entryIds.has(requestId)) throw new RangeError("co-op action ledger requestId is duplicated");
      entryIds.add(requestId);
      if (typeof entry.fingerprint !== "string" || entry.fingerprint.length < 2 || entry.fingerprint.length > 4096) throw new RangeError("co-op action ledger fingerprint is invalid");
      return {requestId, fingerprint: entry.fingerprint, ack: clone(record(entry.ack, "co-op action ledger acknowledgement"))};
    });
    return {peerId, stream: streamId, highestSequence: integer(stream.highestSequence, "co-op action ledger highestSequence", -1), entries};
  });
  return {version: COOP_ACTION_LEDGER_SNAPSHOT_VERSION, streams};
}

function normaliseSettlement(value, runOrdinal) {
  const input = record(value ?? {status: "open", runOrdinal, outcome: null}, "co-op settlement");
  exactKeys(input, SETTLEMENT_KEYS, "co-op settlement");
  if (!["open", "pending", "settled"].includes(input.status)) throw new RangeError("co-op settlement status is unsupported");
  if (![null, "failure", "campaign_complete"].includes(input.outcome)) throw new RangeError("co-op settlement outcome is unsupported");
  return {status: input.status, runOrdinal: integer(input.runOrdinal, "co-op settlement runOrdinal", 1), outcome: input.outcome};
}

function validateCheckpointSettlementPhase(run, settlement) {
  const expectedOutcome = run.phase === GAME_PHASES.RUN_FAILED ? "failure"
    : run.phase === GAME_PHASES.CAMPAIGN_COMPLETE ? "campaign_complete" : null;
  if (expectedOutcome === null) {
    if (settlement.status === "settled" || settlement.outcome !== null) {
      throw new RangeError("co-op settlement contradicts the nonterminal campaign phase");
    }
    return;
  }
  if (settlement.status !== "settled" || settlement.outcome !== expectedOutcome) {
    throw new RangeError("co-op settlement contradicts the terminal campaign phase");
  }
}

function normaliseObjective(value, run) {
  if (value === null || value === undefined) {
    if (run.objectiveState !== null && run.objectiveState !== undefined) return clone(run.objectiveState);
    return null;
  }
  const text = JSON.stringify(value);
  if (text.length > 16_384) throw new RangeError("co-op objective state exceeds its bound");
  if (!record(value, "co-op objective state").id || !["active", "succeeded", "failed"].includes(value.status)) {
    throw new RangeError("co-op objective state is invalid");
  }
  const objective = clone(value);
  if (JSON.stringify(run.objectiveState) !== JSON.stringify(objective)) {
    throw new RangeError("co-op objective state contradicts the run");
  }
  return objective;
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean`);
}

function validateCheckpointRunShape(value, {path = "co-op checkpoint run", snapshotDepth = 0, seen = new WeakSet()} = {}) {
  const input = exactRequiredKeys(value, RUN_REQUIRED_KEYS, RUN_OPTIONAL_KEYS, path);
  if (seen.has(input)) throw new RangeError(`${path} contains a cycle`);
  seen.add(input);
  validateCanonicalNarrativeRun(input.narrative, `${path}.narrative`);
  requireBoolean(input.emergencyHealUsed, "co-op checkpoint run emergencyHealUsed");
  const dayworkBenefit = exactRequiredKeys(input.dayworkBenefit, RUN_DAYWORK_BENEFIT_KEYS, new Set(), `${path}.dayworkBenefit`);
  requireBoolean(dayworkBenefit.gateRepairDiscountAvailable, `${path}.dayworkBenefit.gateRepairDiscountAvailable`);
  if (dayworkBenefit.consumeReceipt !== null) {
    const receipt = exactRequiredKeys(dayworkBenefit.consumeReceipt, DAYWORK_BENEFIT_RECEIPT_KEYS, new Set(),
      `${path}.dayworkBenefit.consumeReceipt`);
    stableId(receipt.eventId, `${path}.dayworkBenefit.consumeReceipt.eventId`);
    integer(receipt.night, `${path}.dayworkBenefit.consumeReceipt.night`, 1, 7);
    integer(receipt.runOrdinal, `${path}.dayworkBenefit.consumeReceipt.runOrdinal`, 1);
  }
  const medicine = exactRequiredKeys(input.playerMedicine, RUN_PLAYER_MEDICINE_KEYS, new Set(), `${path}.playerMedicine`);
  requireBoolean(medicine.prepared, `${path}.playerMedicine.prepared`);
  requireBoolean(medicine.available, `${path}.playerMedicine.available`);
  integer(medicine.night, `${path}.playerMedicine.night`, 1, 7);
  if (medicine.prepareReceipt !== null) {
    const receipt = exactRequiredKeys(medicine.prepareReceipt, MEDICINE_PREPARE_RECEIPT_KEYS, new Set(),
      `${path}.playerMedicine.prepareReceipt`);
    stableId(receipt.requestId, `${path}.playerMedicine.prepareReceipt.requestId`);
    integer(receipt.night, `${path}.playerMedicine.prepareReceipt.night`, 1, 7);
    integer(receipt.runOrdinal, `${path}.playerMedicine.prepareReceipt.runOrdinal`, 1);
  }
  if (medicine.consumeReceipt !== null) {
    const receipt = exactRequiredKeys(medicine.consumeReceipt, MEDICINE_CONSUME_RECEIPT_KEYS, new Set(),
      `${path}.playerMedicine.consumeReceipt`);
    stableId(receipt.requestId, `${path}.playerMedicine.consumeReceipt.requestId`);
    stableId(receipt.actorId, `${path}.playerMedicine.consumeReceipt.actorId`);
    integer(receipt.night, `${path}.playerMedicine.consumeReceipt.night`, 1, 7);
    integer(receipt.runOrdinal, `${path}.playerMedicine.consumeReceipt.runOrdinal`, 1);
    finite(receipt.hpBefore, `${path}.playerMedicine.consumeReceipt.hpBefore`, 0);
    finite(receipt.maxHp, `${path}.playerMedicine.consumeReceipt.maxHp`, Number.EPSILON);
  }
  if (input.recovery !== undefined) {
    const recovery = exactRequiredKeys(input.recovery, RUN_RECOVERY_KEYS, new Set(), `${path}.recovery`);
    finite(recovery.remainingMs, `${path}.recovery.remainingMs`, 0, 12_000);
  }
  if (input.bellConfirmation !== undefined) {
    const receipt = exactRequiredKeys(input.bellConfirmation, BELL_CONFIRMATION_KEYS, new Set(),
      `${path}.bellConfirmation`);
    stableId(receipt.confirmationId, `${path}.bellConfirmation.confirmationId`);
    stableId(receipt.briefingSceneId, `${path}.bellConfirmation.briefingSceneId`);
    integer(receipt.night, `${path}.bellConfirmation.night`, 1, 7);
    integer(receipt.runOrdinal, `${path}.bellConfirmation.runOrdinal`, 1);
  }
  exactRequiredKeys(input.player, RUN_PLAYER_KEYS, new Set(), `${path}.player`);
  // East was added after the first Alpha.89 checkpoint shape. It is derived
  // from the persisted outer gate by RunState normalisation when absent.
  const gates = exactRequiredKeys(input.gates, RUN_GATES_KEYS, new Set(["east"]), `${path}.gates`);
  for (const field of ["fortifications", "boons", "fallenNpcs"]) {
    if (!Array.isArray(input[field])) throw new TypeError(`${path}.${field} must be an array`);
  }
  input.fortifications.forEach((placement, index) => exactRequiredKeys(placement, RUN_FORTIFICATION_KEYS,
    RUN_FORTIFICATION_OPTIONAL_KEYS, `${path}.fortifications[${index}]`));
  if (!input.rewardLedger || !Array.isArray(input.rewardLedger.claimed)) {
    throw new TypeError(`${path}.rewardLedger.claimed must be an array`);
  }
  const pendingXp = record(input.pendingWeaponXp, `${path}.pendingWeaponXp`);
  for (const weaponId of ["arbalest", "sunfire", "runebolt"]) {
    if (!Number.isInteger(pendingXp[weaponId]) || pendingXp[weaponId] < 0) {
      throw new RangeError(`${path}.pendingWeaponXp.${weaponId} must be a non-negative integer`);
    }
  }
  for (const gateId of ["outer", "east", "heart"]) {
    const gate = gates[gateId];
    if (!gate && gateId === "east") continue;
    exactRequiredKeys(gate, RUN_GATE_KEYS, new Set(), `${path}.gates.${gateId}`);
    requireBoolean(gate.destroyed, `${path}.gates.${gateId}.destroyed`);
  }
  const hub = exactRequiredKeys(input.hub, RUN_HUB_KEYS, new Set(), `${path}.hub`);
  const features = exactRequiredKeys(hub.features, RUN_HUB_FEATURE_IDS, new Set(), `${path}.hub.features`);
  for (const [featureId, feature] of Object.entries(features)) {
    exactRequiredKeys(feature, RUN_HUB_FEATURE_KEYS, new Set(), `${path}.hub.features.${featureId}`);
  }
  if (input.nightStartingNpcIds !== undefined) {
    if (!Array.isArray(input.nightStartingNpcIds)
      || input.nightStartingNpcIds.length > Object.keys(HUB_NPC_IDS).length
      || new Set(input.nightStartingNpcIds).size !== input.nightStartingNpcIds.length
      || input.nightStartingNpcIds.some(npcId => !Object.values(HUB_NPC_IDS).includes(npcId))) {
      throw new RangeError(`${path}.nightStartingNpcIds must be the unique bounded authored roster`);
    }
  }
  if (input.nightRuntime !== undefined) {
    const runtime = exactRequiredKeys(input.nightRuntime, NIGHT_RUNTIME_KEYS, new Set(), `${path}.nightRuntime`);
    exactRequiredKeys(runtime.twinThorns, TWIN_THORNS_KEYS, new Set(), `${path}.nightRuntime.twinThorns`);
    for (const key of ["bellkeeperRally", "courtyardRally", "lastOath"]) {
      exactRequiredKeys(runtime[key], RALLY_RUNTIME_KEYS, new Set(), `${path}.nightRuntime.${key}`);
    }
  }
  if (input.objectiveState !== undefined && input.objectiveState !== null) {
    const objective = exactRequiredKeys(input.objectiveState, OBJECTIVE_KEYS, new Set(), `${path}.objectiveState`);
    exactRequiredKeys(objective.evidence, OBJECTIVE_EVIDENCE_REQUIRED_KEYS, OBJECTIVE_EVIDENCE_OPTIONAL_KEYS,
      `${path}.objectiveState.evidence`);
  }
  if (input.hubCombat !== undefined && input.hubCombat !== null) {
    const combat = exactRequiredKeys(input.hubCombat, HUB_COMBAT_KEYS, new Set(), `${path}.hubCombat`);
    const defenders = record(combat.defenders, `${path}.hubCombat.defenders`);
    for (const [defenderId, defender] of Object.entries(defenders)) {
      exactRequiredKeys(defender, HUB_COMBAT_DEFENDER_KEYS, new Set(), `${path}.hubCombat.defenders.${defenderId}`);
    }
  }
  if (input.bossEncounter !== null && input.bossEncounter?.mode !== "authored-director") {
    const boss = exactRequiredKeys(input.bossEncounter, CROWD_BOSS_KEYS, new Set(), `${path}.bossEncounter`);
    if (boss.mode !== "crowd-authored" || boss.status !== "crowd-authored" || !Array.isArray(boss.actors)) {
      throw new RangeError(`${path}.bossEncounter crowd authority is invalid`);
    }
    boss.actors.forEach((actor, index) => exactRequiredKeys(actor, CROWD_BOSS_ACTOR_KEYS, new Set(),
      `${path}.bossEncounter.actors[${index}]`));
  }
  for (const [key, token] of Object.entries(input.nightRuntime ?? {})) {
    if (!token || typeof token !== "object" || Array.isArray(token)) continue;
    for (const field of ["available", "consumed", "used"]) {
      if (field in token) requireBoolean(token[field], `co-op checkpoint run nightRuntime.${key}.${field}`);
    }
  }
  const evidence = input.objectiveState?.evidence;
  if (evidence && typeof evidence === "object" && !Array.isArray(evidence)) {
    for (const field of ["eastApproachWardHeld", "caravanPassageHeld", "destroyed"]) {
      if (field in evidence) requireBoolean(evidence[field], `co-op checkpoint objective evidence.${field}`);
    }
  }
  if (input.waveStartSnapshot !== null && input.waveStartSnapshot !== undefined) {
    if (snapshotDepth >= 1) throw new RangeError(`${path}.waveStartSnapshot exceeds the one-snapshot bound`);
    validateCheckpointRunShape(input.waveStartSnapshot, {path: `${path}.waveStartSnapshot`, snapshotDepth: snapshotDepth + 1, seen});
  }
  seen.delete(input);
}

function validateCheckpointRunCanonical(raw, normalized, path = "co-op checkpoint run", depth = 0) {
  if (depth > 24) throw new RangeError(`${path} exceeds the checkpoint validation depth`);
  if (raw === null || typeof raw !== "object") {
    if (typeof raw !== typeof normalized || !Object.is(raw, normalized)) {
      throw new TypeError(`${path} would be coerced by RunState normalisation`);
    }
    return;
  }
  if (Array.isArray(raw)) {
    const canonicalRaw = path.endsWith(".rewardLedger.claimed") ? [...raw].sort() : raw;
    if (!Array.isArray(normalized) || canonicalRaw.length !== normalized.length) {
      throw new TypeError(`${path} array would be coerced by RunState normalisation`);
    }
    canonicalRaw.forEach((item, index) => validateCheckpointRunCanonical(item, normalized[index], `${path}[${index}]`, depth + 1));
    return;
  }
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    throw new TypeError(`${path} object would be coerced by RunState normalisation`);
  }
  for (const [key, item] of Object.entries(raw)) {
    if (!(key in normalized)) throw new TypeError(`${path}.${key} would be removed by RunState normalisation`);
    validateCheckpointRunCanonical(item, normalized[key], `${path}.${key}`, depth + 1);
  }
  for (const key of Object.keys(normalized)) {
    // RunState derives the east gate for pre-east checkpoints. Keep those
    // legacy envelopes acceptable while canonicalizing new checkpoints with
    // the explicit east record.
    if (!(key in raw) && !(path.endsWith(".gates") && key === "east")) {
      throw new TypeError(`${path}.${key} is required by the canonical checkpoint shape`);
    }
  }
}

function validateRunBoonProvenance(profile, run, path) {
  const choices = Object.entries(run.boonChoices).map(([nightKey, boonId]) => ({nightKey, night: Number(nightKey), boonId}));
  const completedNights = Math.min(6, Math.max(0, run.night - 1));
  const greenwardenUnlocked = profile.hubUnlocks.includes(HUB_NPC_IDS.GREENWARDEN);
  const greenwardenAlive = run.hub.activeNpcs.includes(HUB_NPC_IDS.GREENWARDEN)
    && !run.fallenNpcs.includes(HUB_NPC_IDS.GREENWARDEN);
  if ((!greenwardenUnlocked && choices.length > 0)
    || choices.length > completedNights
    || (greenwardenAlive && choices.length !== completedNights)) {
    throw new RangeError(`${path} boon choices contradict living Greenwarden availability`);
  }
  const chosen = [];
  let replay = {
    ...run,
    phase: GAME_PHASES.BUILD_BREAK,
    boons: [],
    boonChoices: {},
    bossEncounter: null,
    waveStartSnapshot: null,
  };
  delete replay.recovery;
  for (const choice of choices) {
    if (!Number.isInteger(choice.night) || choice.nightKey !== String(choice.night)
      || choice.night < 1 || choice.night > completedNights || choice.night !== chosen.length + 1) {
      throw new RangeError(`${path} boon choice night is not a completed campaign night`);
    }
    if (chosen.includes(choice.boonId)) throw new RangeError(`${path} boon choice is duplicated`);
    const offer = createBoonOffer(replay, choice.night);
    if (!offer.some(boon => boon.id === choice.boonId)) {
      throw new RangeError(`${path} boon choice was not in its deterministic offer`);
    }
    chosen.push(choice.boonId);
    replay = {...replay, boons: [...chosen], boonChoices: {...replay.boonChoices, [choice.night]: choice.boonId}};
  }
  if (JSON.stringify(run.boons) !== JSON.stringify(chosen)) {
    throw new RangeError(`${path} boons do not derive from ordered campaign choices`);
  }
}

function validateRunFortificationAuthority(run, path) {
  for (const placement of run.fortifications) {
    const socket = AUTHORED_BUILD_SOCKETS.get(placement.socketId);
    const mapKind = FORTIFICATION_MAP_KINDS[placement.type];
    if (!socket || !mapKind || !socket.allowed.includes(mapKind)) {
      throw new RangeError(`${path} fortification is not allowed at an authored socket`);
    }
  }
}

function canonicalBossRewardKey(night) {
  const actorIds = getCampaignWave(night, 2).bossEncounterIds;
  return `boss:night-${night}-wave-3:${actorIds.join("+")}`;
}

function validateCheckpointProgressionAuthority(profile, run, path) {
  const completedCurrentWaves = [GAME_PHASES.NIGHT_COMPLETE, GAME_PHASES.BOON_CHOICE,
    GAME_PHASES.CAMPAIGN_COMPLETE].includes(run.phase) ? 3 : run.wave;
  const mandatory = new Set();
  const allowedObjectives = new Set();
  const allowedObjectiveResults = new Set();
  for (let night = 1; night <= run.night; night += 1) {
    const completedWaves = night < run.night ? 3 : completedCurrentWaves;
    for (let wave = 1; wave <= completedWaves; wave += 1) mandatory.add(`wave:${night}:${wave}`);
    if (completedWaves === 3) {
      mandatory.add(canonicalBossRewardKey(night));
      mandatory.add(`night:${night}`);
      if (OBJECTIVE_BY_NIGHT[night]) {
        allowedObjectives.add(`objective:${night}:${OBJECTIVE_BY_NIGHT[night]}`);
        allowedObjectiveResults.add(`objective-result:${night}:${OBJECTIVE_BY_NIGHT[night]}:succeeded`);
        allowedObjectiveResults.add(`objective-result:${night}:${OBJECTIVE_BY_NIGHT[night]}:failed`);
      }
    }
  }
  if (run.phase === GAME_PHASES.CAMPAIGN_COMPLETE) mandatory.add("campaign:complete");
  const currentObjectiveKey = OBJECTIVE_BY_NIGHT[run.night]
    ? `objective:${run.night}:${OBJECTIVE_BY_NIGHT[run.night]}` : null;
  if (completedCurrentWaves === 3 && currentObjectiveKey && run.objectiveState?.status === "succeeded") {
    mandatory.add(currentObjectiveKey);
  }
  const progression = run.rewardLedger.claimed.filter(key => !key.startsWith("xp:"));
  for (const key of progression) {
    const validLifetime = key === "lifetime:first-night-one-hold"
      && firstNightReachedForCheckpoint(run, completedCurrentWaves)
      && profile.rewardLedger.claimed.includes(key);
    if (!mandatory.has(key) && !allowedObjectives.has(key) && !allowedObjectiveResults.has(key) && !validLifetime) {
      throw new RangeError(`${path} reward ledger contains an unreached campaign key: ${key}`);
    }
  }
  for (const key of mandatory) {
    if (!progression.includes(key)) throw new RangeError(`${path} reward ledger omits a reached campaign key`);
  }
  if (currentObjectiveKey && completedCurrentWaves === 3
    && run.objectiveState?.status !== "succeeded" && progression.includes(currentObjectiveKey)) {
    throw new RangeError(`${path} objective reward contradicts its result status`);
  }
  for (const [night, objectiveId] of Object.entries(OBJECTIVE_BY_NIGHT)) {
    const results = progression.filter(key => key.startsWith(`objective-result:${night}:${objectiveId}:`));
    if (results.length > 1) throw new RangeError(`${path} objective result ledger is contradictory`);
  }
  if (currentObjectiveKey && completedCurrentWaves === 3 && ["succeeded", "failed"].includes(run.objectiveState?.status)) {
    const resultKey = `objective-result:${run.night}:${OBJECTIVE_BY_NIGHT[run.night]}:${run.objectiveState.status}`;
    if (progression.some(key => key.startsWith(`objective-result:${run.night}:${OBJECTIVE_BY_NIGHT[run.night]}:`))
      && !progression.includes(resultKey)) {
      throw new RangeError(`${path} objective result ledger contradicts its status`);
    }
  }
  const rates = OATHMARK_REWARD_RATES_V2;
  const expectedOathmarks = progression.reduce((total, key) => total
    + (key.startsWith("wave:") ? rates.waveClear
      : key.startsWith("night:") ? rates.nightCompletion
        : key.startsWith("boss:") ? rates.bossDefeat
          : key.startsWith("objective:") ? rates.optionalObjective
            : key === "campaign:complete" ? rates.campaignCompletion : 0), 0);
  const firstHoldDelta = run.earnedOathmarks - expectedOathmarks;
  const firstNightReached = firstNightReachedForCheckpoint(run, completedCurrentWaves);
  const validLifetimeDelta = firstHoldDelta === rates.firstNightOneHold && firstNightReached
    && profile.rewardLedger.claimed.includes("lifetime:first-night-one-hold");
  if (firstHoldDelta !== 0 && !validLifetimeDelta) {
    throw new RangeError(`${path} earned Oathmarks contradict the campaign reward ledger`);
  }
}

function firstNightReachedForCheckpoint(run, completedCurrentWaves) {
  return run.night > 1 || (run.night === 1 && completedCurrentWaves === 3);
}

function validateCheckpointRunPhaseAuthority(profile, run, settlement, path = "co-op checkpoint run", {waveStart = false} = {}) {
  if (!COOP_CHECKPOINT_PHASES.has(run.phase)) throw new RangeError(`${path} phase is unsupported by co-op authority`);
  const resultPhase = run.phase === GAME_PHASES.NIGHT_COMPLETE || run.phase === GAME_PHASES.BOON_CHOICE;
  const terminalPhase = run.phase === GAME_PHASES.RUN_FAILED || run.phase === GAME_PHASES.CAMPAIGN_COMPLETE;
  if (run.phase === GAME_PHASES.BUILD_BREAK) {
    if (run.wave > 2 || run.waveStartSnapshot !== null) throw new RangeError(`${path} build phase contradicts its wave boundary`);
  } else if (run.phase === GAME_PHASES.INTERWAVE_RECOVERY) {
    if (run.wave < 1 || run.wave > 2 || run.waveStartSnapshot !== null
      || run.bossEncounter !== null || !run.recovery || !run.bellConfirmation) {
      throw new RangeError(`${path} recovery phase contradicts its canonical wave boundary`);
    }
  } else if (run.phase === GAME_PHASES.COMBAT || run.phase === GAME_PHASES.RUN_FAILED) {
    if (run.wave > 2) throw new RangeError(`${path} active phase contradicts its wave boundary`);
    if (waveStart) {
      if (run.waveStartSnapshot !== null) throw new RangeError(`${path} wave-start snapshot cannot recurse`);
    } else {
      const snapshot = run.waveStartSnapshot;
      if (!snapshot || snapshot.phase !== GAME_PHASES.COMBAT || snapshot.waveStartSnapshot !== null
        || snapshot.night !== run.night || snapshot.wave !== run.wave
        || snapshot.runSeed !== run.runSeed || snapshot.runOrdinal !== run.runOrdinal
        || snapshot.boonPoolVersion !== run.boonPoolVersion
        || JSON.stringify(snapshot.boons) !== JSON.stringify(run.boons)
        || JSON.stringify(snapshot.boonChoices) !== JSON.stringify(run.boonChoices)
        || JSON.stringify(snapshot.bellConfirmation) !== JSON.stringify(run.bellConfirmation)) {
        throw new RangeError(`${path} active phase requires its exact same-wave combat snapshot`);
      }
      validateCheckpointRunPhaseAuthority(profile, snapshot,
        {status: "open", runOrdinal: run.runOrdinal, outcome: null}, `${path}.waveStartSnapshot`, {waveStart: true});
    }
  } else if (resultPhase) {
    if (run.night >= 7 || run.wave !== 3 || run.waveStartSnapshot !== null) {
      throw new RangeError(`${path} night result phase contradicts its campaign boundary`);
    }
  } else if (run.phase === GAME_PHASES.CAMPAIGN_COMPLETE) {
    if (run.night !== 7 || run.wave !== 3 || run.waveStartSnapshot !== null) {
      throw new RangeError(`${path} campaign completion is not the exact Night 7 result`);
    }
  }
  const objectiveId = OBJECTIVE_BY_NIGHT[run.night] ?? null;
  if (objectiveId === null) {
    if (run.objectiveState !== null) throw new RangeError(`${path} has an unauthorised optional objective`);
  } else if (run.objectiveState?.night !== run.night || run.objectiveState.id !== objectiveId) {
    throw new RangeError(`${path} optional objective contradicts its authored night`);
  } else if (resultPhase || run.phase === GAME_PHASES.CAMPAIGN_COMPLETE) {
    if (!["succeeded", "failed"].includes(run.objectiveState.status)) {
      throw new RangeError(`${path} completed objective has no canonical result status`);
    }
  } else if (run.objectiveState.status !== "active") {
    throw new RangeError(`${path} live objective has a terminal result status`);
  }
  if (!waveStart) {
    if (terminalPhase ? profile.terminalRuns !== run.runOrdinal : profile.terminalRuns + 1 !== run.runOrdinal) {
      throw new RangeError(`${path} settlement ordinal contradicts the profile authority`);
    }
    validateCheckpointSettlementPhase(run, settlement);
  }
  validateRunBoonProvenance(profile, run, path);
  validateRunFortificationAuthority(run, path);
  validateCheckpointProgressionAuthority(profile, run, path);
}

function validateCheckpointBossSemantics(run, boss, path = "co-op checkpoint run", {snapshot = false} = {}) {
  if (run.wave === 3 && run.phase === GAME_PHASES.RUN_FAILED) {
    throw new RangeError(`${path} cannot fail after the Wave 3 result transition`);
  }
  const authoredWave = run.wave === 2 || run.wave === 3 ? getCampaignWave(run.night, 2) : null;
  const authoredActorIds = authoredWave?.bossEncounterIds ?? [];
  const expectedActorIds = BOSS_ENCOUNTER_DEFINITIONS[authoredActorIds.join("+")] ? authoredActorIds : [];
  const livePhase = run.wave === 2 && (run.phase === GAME_PHASES.COMBAT || run.phase === GAME_PHASES.RUN_FAILED);
  const completedPhase = run.wave === 3 && [GAME_PHASES.NIGHT_COMPLETE, GAME_PHASES.BOON_CHOICE,
    GAME_PHASES.CAMPAIGN_COMPLETE, GAME_PHASES.RUN_FAILED].includes(run.phase);
  const requiresAuthoredBoss = expectedActorIds.length > 0 && (livePhase || completedPhase);
  if (boss === null) {
    if (requiresAuthoredBoss) throw new RangeError(`${path} is missing its authored co-op boss`);
    if (run.waveStartSnapshot) validateCheckpointBossSemantics(
      run.waveStartSnapshot,
      run.waveStartSnapshot.bossEncounter?.mode === "authored-director" ? run.waveStartSnapshot.bossEncounter : null,
      `${path}.waveStartSnapshot`,
      {snapshot: true},
    );
    return;
  }
  const definition = BOSS_ENCOUNTER_DEFINITIONS[boss.encounterId];
  if (!definition || boss.actors.length !== definition.actors.length
    || new Set(boss.actors.map(actor => actor.id)).size !== definition.actors.length
    || definition.actors.some(expected => !boss.actors.some(actor => actor.id === expected.id))) {
    throw new RangeError("co-op boss checkpoint actors contradict the encounter");
  }
  if (boss.status === "defeated" && !boss.actors.every(actor => actor.defeated)) {
    throw new RangeError("co-op boss checkpoint status contradicts its actors");
  }
  if (boss.status !== "defeated" && boss.actors.every(actor => actor.defeated)) {
    throw new RangeError("co-op boss checkpoint live status contradicts its actors");
  }
  if (!authoredWave || ![2, 3].includes(run.wave) || expectedActorIds.length === 0
    || boss.encounterId !== expectedActorIds.join("+")
    || boss.actors.length !== expectedActorIds.length
    || boss.actors.some((actor, index) => actor.id !== expectedActorIds[index])) {
    throw new RangeError(`${path} boss contradicts the authored night and wave encounter`);
  }
  if (!livePhase && !completedPhase) throw new RangeError(`${path} boss contradicts the campaign phase`);
  if (completedPhase && boss.status !== "defeated") throw new RangeError(`${path} result contains a live boss`);
  if (boss.options.hpMultiplier !== CAMPAIGN_COOP_MODIFIERS.bossHpMultiplier) {
    throw new RangeError(`${path} boss HP multiplier contradicts co-op authority`);
  }
  const canonicalBoons = [...new Set(run.boons)].sort();
  const allowedBoons = new Set(RUN_BOON_POOL.map(boon => boon.id));
  if (canonicalBoons.some(boonId => !allowedBoons.has(boonId))
    || JSON.stringify(boss.boons) !== JSON.stringify(canonicalBoons)) {
    throw new RangeError(`${path} boss boons contradict run authority`);
  }
  const fortificationIds = run.fortifications.map(item => item.socketId);
  if (new Set(fortificationIds).size !== fortificationIds.length) {
    throw new RangeError(`${path} fortification socket authority is duplicated`);
  }
  const canonicalSocketIds = [...fortificationIds].sort();
  const canonicalSockets = canonicalSocketIds.map(socketId => {
    const socket = AUTHORED_BUILD_SOCKETS.get(socketId);
    return socket ? {id: socket.id, x: socket.position.x, z: socket.position.z} : null;
  });
  const canonicalSocketById = new Map(canonicalSockets.filter(Boolean).map(socket => [socket.id, socket]));
  if (canonicalSockets.some(socket => socket === null)
    || JSON.stringify(boss.options.occupiedSocketIds) !== JSON.stringify(canonicalSocketIds)
    || boss.options.occupiedSockets.length !== canonicalSockets.length
    || boss.options.occupiedSockets.some(socket => {
      const expected = canonicalSocketById.get(socket.id);
      return !expected || socket.x !== expected.x || socket.z !== expected.z;
    })) {
    throw new RangeError(`${path} boss sockets contradict run fortifications`);
  }
  if (boss.encounterId === "root-sapper-prime") {
    const target = boss.actors[0]?.target;
    const expectedTarget = canonicalSockets[0] ?? null;
    const targetMatches = expectedTarget
      ? target?.kind === "fortification_socket" && target.id === expectedTarget.id
        && target.x === expectedTarget.x && target.z === expectedTarget.z
      : target?.kind === "fortification_socket" && target.id === null
        && !Object.hasOwn(target, "x") && !Object.hasOwn(target, "z");
    if (!targetMatches) {
      throw new RangeError(`${path} Sapper target contradicts its authored fortification socket`);
    }
  }
  const disabledSocketIds = run.fortifications.filter(item => item.disabledForWave === true).map(item => item.socketId).sort();
  if (boss.encounterId === "root-sapper-prime"
    && JSON.stringify([...boss.disabledSocketIds].sort()) !== JSON.stringify(disabledSocketIds)) {
    throw new RangeError(`${path} disabled boss sockets contradict run fortifications`);
  }
  const expectedLaneId = run.objectiveState?.id ?? "evacuation-lane";
  if (boss.options.objectiveLaneId !== expectedLaneId
    || boss.options.objectiveLanePosition.x !== -16 || boss.options.objectiveLanePosition.z !== 20) {
    throw new RangeError(`${path} boss objective lane contradicts authored run authority`);
  }
  if (boss.encounterId === "caravan-eater") {
    const evidence = run.objectiveState?.evidence;
    const boonAuthorityRun = {
      ...run,
      phase: GAME_PHASES.BUILD_BREAK,
      bossEncounter: null,
      waveStartSnapshot: null,
    };
    delete boonAuthorityRun.recovery;
    const boonEffects = calculateRunBoonEffects(boonAuthorityRun);
    const expectedMaximum = Math.round(100 * boonEffects.npcEscortDurabilityMultiplier);
    if (run.objectiveState?.night !== 6 || run.objectiveState.id !== "last-caravan"
      || !Number.isFinite(evidence?.bossObjectiveMaxDurability)
      || evidence.bossObjectiveMaxDurability !== expectedMaximum
      || !Number.isFinite(evidence?.bossObjectiveDurability)
      || evidence.bossObjectiveDurability < 0 || evidence.bossObjectiveDurability > expectedMaximum
      || !Number.isFinite(evidence?.bossObjectiveDamage)
      || evidence.bossObjectiveDamage < 0
      || evidence.bossObjectiveDurability !== Math.max(0, expectedMaximum - evidence.bossObjectiveDamage)) {
      throw new RangeError(`${path} caravan objective durability contradicts boon-derived authority`);
    }
  }
  if (livePhase && !snapshot) {
    const waveSnapshot = run.waveStartSnapshot;
    const snapshotBoss = waveSnapshot?.bossEncounter?.mode === "authored-director" ? waveSnapshot.bossEncounter : null;
    if (!waveSnapshot || !snapshotBoss) throw new RangeError(`${path} boss combat is missing its wave-start authority`);
    validateCheckpointBossSemantics(waveSnapshot, snapshotBoss, `${path}.waveStartSnapshot`, {snapshot: true});
    for (const field of ["night", "wave", "runSeed", "boonPoolVersion"]) {
      if (waveSnapshot[field] !== run[field]) throw new RangeError(`${path} wave-start ${field} contradicts the current run`);
    }
    for (const field of ["boons", "boonChoices"]) {
      if (JSON.stringify(waveSnapshot[field]) !== JSON.stringify(run[field])) {
        throw new RangeError(`${path} wave-start ${field} contradicts the current run`);
      }
    }
    const expectedSeed = (run.runSeed ^ Math.imul(authoredWave.night, 0x9e3779b1) ^ authoredWave.waveNumber) >>> 0;
    const expectedInitialBoss = serialiseBossDirector(createBossDirector({
      encounterId: boss.encounterId,
      seed: expectedSeed,
      hpMultiplier: CAMPAIGN_COOP_MODIFIERS.bossHpMultiplier,
      occupiedSocketIds: canonicalSocketIds,
      occupiedSockets: boss.options.occupiedSockets,
      objectiveLaneId: boss.options.objectiveLaneId,
      objectiveLanePosition: boss.options.objectiveLanePosition,
      boons: canonicalBoons,
    }));
    if (JSON.stringify(snapshotBoss) !== JSON.stringify(expectedInitialBoss)) {
      throw new RangeError(`${path} wave-start boss is not the exact canonical initial authority`);
    }
    for (const field of ["encounterId", "boons", "options"]) {
      if (JSON.stringify(snapshotBoss[field]) !== JSON.stringify(boss[field])) {
        throw new RangeError(`${path} current boss contradicts its wave-start ${field}`);
      }
    }
  } else if (completedPhase && run.waveStartSnapshot !== null) {
    throw new RangeError(`${path} completed boss result retained a wave-start snapshot`);
  }
}

function hashText(text) {
  const bytes = new TextEncoder().encode(text);
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (const byte of bytes) {
    left = Math.imul(left ^ byte, 0x01000193) >>> 0;
    right = Math.imul(right ^ byte, 0x85ebca6b) >>> 0;
  }
  return `${left.toString(16).padStart(8, "0")}${right.toString(16).padStart(8, "0")}`;
}

export function hashCoopCampaignCheckpoint(checkpoint) {
  const value = clone(checkpoint);
  delete value.hash;
  return `cc4-${hashText(encodeCheckpoint(value))}`;
}

function normaliseCheckpoint(value, {requireHash = false} = {}) {
  const input = record(value, "co-op campaign checkpoint");
  exactKeys(input, CHECKPOINT_KEYS, "co-op campaign checkpoint");
  if (input.version !== COOP_CAMPAIGN_CHECKPOINT_VERSION || input.protocolVersion !== 4) {
    throw new RangeError("co-op campaign checkpoint version is unsupported");
  }
  validateCheckpointProfileShape(input.profile);
  const profile = normaliseProfileState(input.profile);
  validateCheckpointRunCanonical(input.profile, profile, "co-op checkpoint profile");
  validateCheckpointRunShape(input.run);
  const run = normaliseRunState(input.run);
  validateCheckpointRunCanonical(input.run, run);
  if (!run) throw new TypeError("co-op campaign checkpoint requires a run");
  const settlement = normaliseSettlement(input.settlement, run.runOrdinal);
  validateCheckpointRunPhaseAuthority(profile, run, settlement);
  const boss = input.boss === null || input.boss === undefined
    ? null
    : serialiseBossDirector(normaliseBossDirector(input.boss));
  const runBoss = run.bossEncounter?.mode === "authored-director"
    ? serialiseBossDirector(normaliseBossDirector(run.bossEncounter))
    : null;
  if ((boss === null) !== (runBoss === null)) {
    throw new RangeError(boss === null
      ? "co-op boss checkpoint is missing and contradicts the run"
      : "co-op boss checkpoint is extra and contradicts the run");
  }
  validateCheckpointBossSemantics(run, boss);
  if (boss && JSON.stringify(boss) !== JSON.stringify(runBoss)) {
    throw new RangeError("co-op boss checkpoint contradicts the run");
  }
  const eventsInput = input.semanticEvents ?? [];
  if (!Array.isArray(eventsInput) || eventsInput.length > COOP_SEMANTIC_EVENT_CAP) throw new RangeError("co-op semantic event history is invalid");
  const semanticEvents = eventsInput.map(normalizeCoopSemanticEvent);
  for (let index = 1; index < semanticEvents.length; index += 1) {
    if (semanticEvents[index].sequence <= semanticEvents[index - 1].sequence) throw new RangeError("co-op semantic event history sequence is invalid");
  }
  const eventCursor = integer(input.eventCursor, "co-op campaign eventCursor");
  if (semanticEvents.some(event => event.sequence > eventCursor)) throw new RangeError("co-op semantic events exceed the applied cursor");
  const normalized = {
    version: COOP_CAMPAIGN_CHECKPOINT_VERSION,
    protocolVersion: 4,
    authorityTick: integer(input.authorityTick, "co-op campaign authorityTick"),
    eventCursor,
    profile,
    run,
    players: normalisePlayers(input.players),
    battlefield: normaliseBattlefieldCheckpoint(input.battlefield),
    boss,
    objective: normaliseObjective(input.objective, run),
    actionLedger: normaliseActionLedger(input.actionLedger),
    delayedEffects: snapshotAuthoritativeDelayedEffects(restoreAuthoritativeDelayedEffects(input.delayedEffects)),
    semanticEvents,
    settlement,
  };
  normalized.hash = hashCoopCampaignCheckpoint(normalized);
  if (requireHash && input.hash !== normalized.hash) {
    // A pre-east checkpoint hashes the legacy run shape. Verify that legacy
    // hash before accepting the normalized state with its derived east gate.
    const legacyRun = input.run?.gates && !Object.hasOwn(input.run.gates, "east");
    const legacyHash = legacyRun ? hashCoopCampaignCheckpoint(input) : null;
    if (input.hash !== legacyHash) throw new Error("co-op campaign checkpoint hash mismatch");
  }
  return normalized;
}

export function createCoopCampaignCheckpoint({
  authorityTick,
  eventCursor = 0,
  profile,
  run,
  players,
  battlefield = null,
  battlefieldCheckpoint = null,
  boss = run?.bossEncounter ?? null,
  objective = run?.objectiveState ?? null,
  actionLedger = {version: COOP_ACTION_LEDGER_SNAPSHOT_VERSION, streams: []},
  delayedEffects = snapshotAuthoritativeDelayedEffects(createAuthoritativeDelayedEffectQueue()),
  semanticEvents = [],
  settlement = null,
} = {}) {
  const checkpoint = normaliseCheckpoint({
    version: COOP_CAMPAIGN_CHECKPOINT_VERSION,
    protocolVersion: 4,
    authorityTick,
    eventCursor,
    profile,
    run,
    players,
    battlefield: battlefieldCheckpoint ?? createBattlefieldCheckpoint(battlefield),
    boss,
    objective,
    actionLedger,
    delayedEffects,
    semanticEvents,
    settlement: settlement ?? {status: "open", runOrdinal: run?.runOrdinal, outcome: null},
  });
  return deepFreeze(checkpoint);
}

export function restoreCoopCampaignCheckpoint(checkpoint) {
  return clone(normaliseCheckpoint(checkpoint, {requireHash: true}));
}

/** Validate the whole envelope before constructing any mutable replacement. */
export function stageCoopCheckpointApplication(checkpoint, {
  createBattlefield,
  restoreActionLedger,
} = {}) {
  const restored = restoreCoopCampaignCheckpoint(checkpoint);
  if (typeof createBattlefield !== "function") throw new TypeError("checkpoint staging requires a Battlefield factory");
  if (typeof restoreActionLedger !== "function") throw new TypeError("checkpoint staging requires an action-ledger restore function");
  const nextBattlefield = createBattlefield(restored.battlefield);
  restoreBattlefieldCheckpoint(nextBattlefield, restored.battlefield);
  const nextActionLedger = restoreActionLedger(restored.actionLedger);
  if (!nextActionLedger || typeof nextActionLedger.snapshot !== "function") throw new TypeError("checkpoint action ledger restore failed");
  return {
    profile: restored.profile,
    run: restored.run,
    players: restored.players,
    battlefield: nextBattlefield,
    boss: restored.boss,
    objective: restored.objective,
    eventCursor: restored.eventCursor,
    actionLedger: nextActionLedger,
    delayedEffects: restoreAuthoritativeDelayedEffects(restored.delayedEffects),
    semanticEvents: restored.semanticEvents,
    settlement: restored.settlement,
    authorityTick: restored.authorityTick,
    hash: restored.hash,
  };
}

export function commitStagedCoopCheckpoint(staged, {capture, install, present} = {}) {
  if (typeof capture !== "function" || typeof install !== "function" || typeof present !== "function") {
    throw new TypeError("atomic checkpoint commit requires capture, install and present callbacks");
  }
  const previous = capture();
  try {
    install(staged);
    present(staged);
    return true;
  } catch (error) {
    install(previous);
    throw error;
  }
}

/**
 * Shared two-Warden down state. A healthy Warden keeps the run alive. A
 * requested Twin Thorns revive may target either downed Warden; if both fall
 * before a request, the host is revived deterministically before failure.
 */
export function resolveCoopWardenDownState({run, players, targetPlayerId = null} = {}) {
  let currentRun = normaliseRunState(run);
  let currentPlayers = normalisePlayers(players);
  const token = currentRun.nightRuntime?.twinThorns;
  const downed = currentPlayers.filter(player => player.hp <= 0);
  const allDown = downed.length === currentPlayers.length;
  let target = targetPlayerId === null
    ? (allDown ? downed.find(player => player.playerId === "warden-host") ?? downed[0] : null)
    : downed.find(player => player.playerId === targetPlayerId) ?? null;
  let revivedPlayerId = null;
  if (target && token?.available && !token.consumed && token.reviveHp > 0) {
    currentPlayers = currentPlayers.map(player => player.playerId === target.playerId
      ? createNetworkPlayerState({
        ...player,
        hp: Math.min(player.maxHp, token.reviveHp),
        animationState: "idle",
        damageCooldown: 0,
      })
      : player);
    currentRun = {
      ...currentRun,
      nightRuntime: {
        ...currentRun.nightRuntime,
        twinThorns: {...token, consumed: true},
      },
    };
    revivedPlayerId = target.playerId;
  }
  const host = currentPlayers.find(player => player.playerId === "warden-host");
  if (host) currentRun = {...currentRun, player: {...currentRun.player, hp: host.hp, maxHp: host.maxHp}};
  return deepFreeze({
    run: normaliseRunState(currentRun),
    players: currentPlayers,
    revivedPlayerId,
    failed: currentPlayers.every(player => player.hp <= 0),
  });
}

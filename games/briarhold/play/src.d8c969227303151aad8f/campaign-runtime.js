import {applyBoonChoice} from "./boons.js";
import {BOSS_ENCOUNTERS, getCampaignWave} from "./campaign-content.js";
import {
  createBossDirector,
  restoreBossDirector,
  serialiseBossDirector,
  stepBossDirector,
} from "./boss-director.js";
import {
  GAME_PHASES,
  BELLKEEPER_BRIEFING_SCENE_IDS,
  applyProgressionEvent,
  bellkeeperBriefingSceneId,
  beginRunNight,
  captureWaveStartSnapshot,
  normaliseProfileState,
  normaliseRunState,
  settleTerminalRun,
} from "./progression.js";
import {prepareNightRuntimeState} from "./runtime-progression.js";
import {HUB_NPC_IDS, isHubNpcAlive} from "./hub.js";

export const INTERWAVE_RECOVERY_DURATION_MS = 12_000;
export {BELLKEEPER_BRIEFING_SCENE_IDS, bellkeeperBriefingSceneId};

const RECOVERY_ACTIONS = new Set([
  "move", "look", "jump", "mantle", "slide", "swap", "swap_weapon", "reload", "cool", "revive",
]);

/** Resolve a guest build-break Context press without touching DOM or transport state. */
export function resolveGuestBuildContextIntent({
  hubKind = null,
  wave = 0,
  gates = {},
  nearSocket = null,
  fortificationType = null,
} = {}) {
  if (hubKind === "bellkeeper" && wave < 3) return null;
  if (hubKind === "mason") {
    const outer = gates?.outer ?? {};
    const east = gates?.east ?? outer;
    const gateId = Number(outer.integrity) < Number(outer.maxIntegrity) ? "outer"
      : Number(east.integrity) < Number(east.maxIntegrity) ? "east" : "heart";
    return {action: "repair_gate", payload: {gateId}};
  }
  if (hubKind === "quartermaster") return {action: "emergency_heal", payload: {}};
  if (hubKind === "trapper") return {action: "restore_defences", payload: {}};
  if (nearSocket?.id && fortificationType) {
    return {
      action: "build",
      payload: {socketId: nearSocket.id, fortificationType},
    };
  }
  return null;
}

/** Produce only a reachable build-socket prompt; open ground has no Context action. */
export function describeBuildSocketContext({
  nearSocket = null,
  placementName = null,
  choiceDefinition = null,
} = {}) {
  if (!nearSocket) return null;
  if (placementName) return `${placementName} installed`;
  if (choiceDefinition) return `Build ${choiceDefinition.name} · ${choiceDefinition.cost} Supplies`;
  return `Build at ${nearSocket.label}`;
}

const OPTIONAL_OBJECTIVES = Object.freeze({
  2: Object.freeze({
    id: "hold-east-gate",
    label: "Proxy: hold the East Approach ward post through all three waves",
    evidenceKind: "east-approach-ward-proxy",
  }),
  6: Object.freeze({
    id: "last-caravan",
    label: "Proxy: keep the caravan passage open with a living holdfolk escort through all three waves",
    evidenceKind: "caravan-passage-escort-proxy",
  }),
});

/** Restore or enter a deterministic campaign build boundary. */
export function prepareSoloCampaignBuild(run) {
  const current = normaliseRunState(run);
  return prepareCampaignBoundary(current, GAME_PHASES.BUILD_BREAK);
}

/** Enter a fresh current-night daytime boundary without discarding durable run progress. */
export function prepareSoloCampaignDaytime(profile, run, {night = run?.night} = {}) {
  const currentProfile = normaliseProfileState(profile);
  const current = normaliseRunState(run);
  const fresh = prepareNightRuntimeState(
    currentProfile,
    beginRunNight(current, night),
    {newNight: true},
  );
  return prepareCampaignBoundary(fresh, GAME_PHASES.DAYTIME);
}

function prepareCampaignBoundary(current, phase) {
  const authoredObjective = OPTIONAL_OBJECTIVES[current.night] ?? null;
  const caravanMaxDurability = current.boons.includes("caravan-oath") ? 130 : 100;
  const objectiveState = authoredObjective
    ? current.objectiveState?.night === current.night
      ? {
        ...structuredClone(current.objectiveState),
        ...(current.night === 6 ? {evidence: {
          ...structuredClone(current.objectiveState.evidence ?? {}),
          bossObjectiveMaxDurability: Number.isFinite(current.objectiveState.evidence?.bossObjectiveMaxDurability)
            ? current.objectiveState.evidence.bossObjectiveMaxDurability
            : caravanMaxDurability,
          bossObjectiveDurability: Number.isFinite(current.objectiveState.evidence?.bossObjectiveDurability)
            ? current.objectiveState.evidence.bossObjectiveDurability
            : caravanMaxDurability,
        }} : {}),
      }
      : {
        night: current.night,
        id: authoredObjective.id,
        label: authoredObjective.label,
        status: "active",
        evidence: {
          kind: authoredObjective.evidenceKind,
          evaluatedWaves: [],
          failedWave: null,
          ...(current.night === 6 ? {
            bossObjectiveMaxDurability: caravanMaxDurability,
            bossObjectiveDurability: caravanMaxDurability,
            bossObjectiveDamage: 0,
          } : {}),
        },
      }
    : null;
  const next = {
    ...current,
    phase,
    wave: phase === GAME_PHASES.DAYTIME ? 0 : current.wave,
    objectiveState,
    bossEncounter: null,
    waveStartSnapshot: null,
  };
  delete next.recovery;
  if (phase === GAME_PHASES.DAYTIME) delete next.bellConfirmation;
  return next;
}

/** Validate Nell's separate in-world bell confirmation and begin Wave 1 once. */
export function confirmSoloBell(run, request = {}, options = {}) {
  const current = normaliseRunState(run);
  const confirmationId = stableRequestId(request.confirmationId, "bell confirmation ID");
  const expectedBriefingSceneId = bellkeeperBriefingSceneId(current.night);
  if (request.npcId !== HUB_NPC_IDS.BELLKEEPER) throw new Error("night start requires the Bellkeeper");
  if (request.inRange !== true) throw new Error("Bellkeeper confirmation requires in-world proximity");
  if (request.night !== current.night || request.runOrdinal !== current.runOrdinal) {
    throw new Error("bell confirmation is stale for the current night or run ordinal");
  }
  if (request.briefingSceneId !== expectedBriefingSceneId) {
    throw new Error("bell confirmation must reference the exact current-night briefing");
  }
  if (!current.narrative.completedSceneIds.includes(expectedBriefingSceneId)) {
    throw new Error("the completed current-night briefing must be persisted first");
  }
  const existing = current.bellConfirmation;
  if (existing?.confirmationId === confirmationId
    && existing.briefingSceneId === expectedBriefingSceneId
    && existing.night === request.night
    && existing.runOrdinal === request.runOrdinal) {
    return current;
  }
  if (current.phase !== GAME_PHASES.DAYTIME) {
    throw new Error(`the bell can be confirmed only from daytime, received ${current.phase}`);
  }
  if (!isHubNpcAlive(HUB_NPC_IDS.BELLKEEPER, current)) throw new Error("night start requires a living Bellkeeper");
  if (current.narrative.activeScene !== null) throw new Error("a blocking narrative scene is still active");

  return startSoloCampaignWave({
    ...current,
    nightStartingNpcIds: [...current.hub.activeNpcs],
    bellConfirmation: {
      confirmationId,
      briefingSceneId: expectedBriefingSceneId,
      night: current.night,
      runOrdinal: current.runOrdinal,
    },
    dayworkBenefit: {...current.dayworkBenefit, gateRepairDiscountAvailable: false},
  }, options);
}

/**
 * Enter the authored wave and capture its complete reload boundary. Fixed
 * actors remain detached from the crowd roster so Task 4 can replace only the
 * encounter director.
 */
export function beginSoloCampaignWave(run, {confirmation = null, ...waveOptions} = {}) {
  if (confirmation === null) {
    throw new Error("a solo wave requires the canonical daytime bell confirmation");
  }
  return confirmSoloBell(run, confirmation, waveOptions);
}

function startSoloCampaignWave(current, options = {}) {
  const definition = getCampaignWave(current.night, current.wave);
  const bossEncounter = createBossEncounterState(definition, current, options);
  return captureWaveStartSnapshot({
    ...current,
    phase: GAME_PHASES.COMBAT,
    recovery: null,
    bossEncounter,
  });
}

/** Advance the pure host-owned recovery countdown; no browser clock is consulted. */
export function advanceInterwaveRecovery(run, elapsedMs, {
  mode = "solo",
  paused = false,
  authoritativeHostTick = false,
  waveOptions = {},
} = {}) {
  const current = normaliseRunState(run);
  if (current.phase === GAME_PHASES.COMBAT) return {type: "combat", run: current};
  if (current.phase !== GAME_PHASES.INTERWAVE_RECOVERY) {
    throw new Error(`recovery can advance only from interwave_recovery, received ${current.phase}`);
  }
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError("recovery elapsedMs must be a non-negative finite number");
  }
  if (mode === "coop" && authoritativeHostTick !== true) {
    throw new Error("co-op recovery requires an authoritative host tick");
  }
  if (mode !== "solo" && mode !== "coop") throw new RangeError(`unknown recovery mode: ${mode}`);
  const effectiveElapsed = mode === "solo" && paused === true ? 0 : elapsedMs;
  const remainingMs = Math.max(0, current.recovery.remainingMs - effectiveElapsed);
  if (remainingMs > 0) {
    return {type: "recovery", run: {...current, recovery: {remainingMs}}, warning: recoveryWarningModel(current)};
  }
  return {type: "combat", run: startSoloCampaignWave({...current, recovery: null}, waveOptions)};
}

/** Return whether one semantic action remains legal during interwave recovery. */
export function isActionAllowedDuringRecovery(actionId) {
  return RECOVERY_ACTIONS.has(actionId);
}

/** Step one fixed encounter and fold semantic boss outcomes into run authority. */
export function updateSoloBossEncounter(run, {elapsedMs = 0, commands = [], crowdCleared = false} = {}) {
  if (!run || typeof run !== "object") throw new TypeError("an authored run is required");
  const current = run;
  const encounter = current.bossEncounter;
  if (current.phase !== GAME_PHASES.COMBAT || encounter?.mode !== "authored-director") {
    throw new Error("no authored boss encounter is active");
  }
  const beforeSequence = encounter.eventSequence;
  const resolvedCommands = crowdCleared === true
    && encounter.status === "waiting"
    && encounter.encounterId === "moss-crowned-matron"
    ? [
        ...Array.from({length: encounter.actors[0]?.livingMossguards ?? 0}, (_, index) => ({
          id: `matron:crowd-cleared-feed:${index}`,
          order: -100,
          type: "objective_interaction",
          actorId: "moss-crowned-matron",
          targetId: `mossguard-feed:${index}`,
        })),
        ...commands,
      ]
    : commands;
  const nextEncounter = serialiseBossDirector(stepBossDirector(
    restoreBossDirector(encounter),
    {elapsedMs, commands: resolvedCommands},
  ));
  const newEvents = nextEncounter.events.filter(event => event.sequence > beforeSequence);
  let fortifications = current.fortifications;
  let objectiveState = current.objectiveState;
  let gates = current.gates;
  for (const event of newEvents) {
    if (event.type === "socket_disabled") {
      fortifications = fortifications.map(item => item.socketId === event.socketId
        ? {...item, disabledForWave: true, disabledBy: event.actorId}
        : item);
    } else if (event.type === "shield_feed_broken" && objectiveState) {
      objectiveState = {
        ...objectiveState,
        evidence: {
          ...(objectiveState.evidence ?? {}),
          bossShieldFeedsBroken: Math.max(0, Number(objectiveState.evidence?.bossShieldFeedsBroken) || 0) + 1,
        },
      };
    } else if (event.type === "objective_damage" && objectiveState) {
      const maxDurability = Number(objectiveState.evidence?.bossObjectiveMaxDurability) || 100;
      const durability = Number.isFinite(objectiveState.evidence?.bossObjectiveDurability)
        ? objectiveState.evidence.bossObjectiveDurability
        : maxDurability;
      objectiveState = {
        ...objectiveState,
        evidence: {
          ...(objectiveState.evidence ?? {}),
          bossObjectiveDamage: Math.max(0, Number(objectiveState.evidence?.bossObjectiveDamage) || 0) + event.amount,
          bossObjectiveMaxDurability: maxDurability,
          bossObjectiveDurability: Math.max(0, durability - event.amount),
        },
      };
    } else if (event.type === "gate_damage" && gates?.[event.targetId]) {
      const gate = gates[event.targetId];
      gates = {
        ...gates,
        [event.targetId]: {
          ...gate,
          integrity: Math.max(0, gate.integrity - event.amount),
          destroyed: gate.integrity - event.amount <= 0,
        },
      };
    }
  }
  return {
    ...current,
    bossEncounter: nextEncounter,
    fortifications,
    objectiveState,
    gates,
  };
}

/** Resolve one naturally completed wave through the stable Task 2 ledger. */
export function completeSoloCampaignWave(profile, run, options = {}) {
  let currentProfile = normaliseProfileState(profile);
  let currentRun = normaliseRunState(run);
  if (options.replay === true && currentRun.phase !== GAME_PHASES.COMBAT) {
    return replayTransition(currentProfile, currentRun);
  }
  if (currentRun.phase !== GAME_PHASES.COMBAT) {
    throw new Error(`a solo wave can complete only from combat, received ${currentRun.phase}`);
  }

  const definition = getCampaignWave(currentRun.night, currentRun.wave);
  if (definition.waveNumber === 3
    && definition.bossEncounterIds.some(actorId => BOSS_ENCOUNTERS[actorId]?.fixedActor)
    && !isDefeatedAuthoredEncounter(currentRun.bossEncounter, definition.bossEncounterIds)) {
    throw new Error("the boss encounter must be defeated before the wave result");
  }

  currentRun = recordObjectiveEvidence(currentRun, definition.waveNumber, options.objectiveEvidence);

  ({profile: currentProfile, run: currentRun} = applyProgressionEvent(currentProfile, currentRun, {
    type: "wave", night: currentRun.night, wave: definition.waveNumber,
  }));

  if (definition.waveNumber < 3) {
    currentRun = {
      ...currentRun,
      phase: GAME_PHASES.INTERWAVE_RECOVERY,
      wave: currentRun.wave + 1,
      supplies: currentRun.supplies + 24,
      bossEncounter: null,
      waveStartSnapshot: null,
      recovery: {remainingMs: INTERWAVE_RECOVERY_DURATION_MS},
    };
    return {
      type: "recovery",
      profile: currentProfile,
      run: currentRun,
      settlement: null,
      warning: recoveryWarningModel(currentRun),
    };
  }

  const stableActorId = definition.bossEncounterIds.join("+");
  ({profile: currentProfile, run: currentRun} = applyProgressionEvent(currentProfile, currentRun, {
    type: "boss",
    encounterId: `night-${currentRun.night}-wave-3`,
    stableId: stableActorId,
  }));

  const objective = OPTIONAL_OBJECTIVES[currentRun.night] ?? null;
  if (objective) {
    const succeeded = objectiveSucceeded(currentRun.objectiveState);
    const objectiveStatus = succeeded ? "succeeded" : "failed";
    currentRun = {
      ...currentRun,
      objectiveState: {...currentRun.objectiveState, status: objectiveStatus},
    };
    ({profile: currentProfile, run: currentRun} = applyProgressionEvent(currentProfile, currentRun, {
      type: "objective-result",
      night: currentRun.night,
      objectiveId: objective.id,
      status: objectiveStatus,
    }));
    if (succeeded) {
      ({profile: currentProfile, run: currentRun} = applyProgressionEvent(currentProfile, currentRun, {
        type: "objective", night: currentRun.night, objectiveId: objective.id,
      }));
    }
  }

  ({profile: currentProfile, run: currentRun} = applyProgressionEvent(currentProfile, currentRun, {
    type: "night", night: currentRun.night,
  }));
  if (currentRun.night === 1) {
    ({profile: currentProfile, run: currentRun} = applyProgressionEvent(currentProfile, currentRun, {
      type: "first-night-one-hold", qualifyingNightOneHold: true,
    }));
  }

  if (currentRun.night < 7) {
    if (!isHubNpcAlive(HUB_NPC_IDS.GREENWARDEN, currentRun)) {
      const nightResult = Object.freeze({
        night: currentRun.night,
        objectiveState: currentRun.objectiveState === null
          ? null
          : structuredClone(currentRun.objectiveState),
      });
      currentRun = prepareSoloCampaignDaytime(
        currentProfile,
        beginRunNight(currentRun, currentRun.night + 1),
        {night: currentRun.night + 1},
      );
      return {type: "daytime", profile: currentProfile, run: currentRun, settlement: null, nightResult};
    }
    currentRun = {
      ...currentRun,
      phase: GAME_PHASES.BOON_CHOICE,
      wave: 3,
      waveStartSnapshot: null,
    };
    return {type: "boon", profile: currentProfile, run: currentRun, settlement: null};
  }

  ({profile: currentProfile, run: currentRun} = applyProgressionEvent(currentProfile, currentRun, {type: "campaign"}));
  currentRun = {
    ...currentRun,
    phase: GAME_PHASES.CAMPAIGN_COMPLETE,
    wave: 3,
    waveStartSnapshot: null,
  };
  const settlement = settleTerminalRun(currentProfile, currentRun, {outcome: "campaign_complete"});
  return {type: "campaign_complete", profile: currentProfile, run: currentRun, settlement};
}

function isDefeatedAuthoredEncounter(encounter, requiredActorIds) {
  if (encounter?.mode !== "authored-director"
    || encounter.encounterId !== requiredActorIds.join("+")
    || encounter.status !== "defeated"
    || !Array.isArray(encounter.actors)
    || encounter.actors.length !== requiredActorIds.length) return false;
  const actualActorIds = encounter.actors.map(actor => actor?.id);
  return new Set(actualActorIds).size === requiredActorIds.length
    && requiredActorIds.every(actorId => actualActorIds.includes(actorId))
    && encounter.actors.every(actor => actor?.defeated === true);
}

/** Choose the one authored post-night boon and enter the next dawn. */
export function chooseSoloCampaignBoon(profile, run, boonId) {
  const currentProfile = normaliseProfileState(profile);
  const currentRun = normaliseRunState(run);
  if (currentRun.phase !== GAME_PHASES.BOON_CHOICE || currentRun.night >= 7) {
    throw new Error("a campaign boon can be chosen only after Nights 1-6");
  }
  if (!isHubNpcAlive(HUB_NPC_IDS.GREENWARDEN, currentRun)) {
    throw new Error("a campaign boon requires a living Edda in the active hold roster");
  }
  if (!currentRun.bellConfirmation) {
    throw new Error("a campaign boon requires the persisted bell confirmation chain");
  }
  const withBoon = applyBoonChoice(currentRun, boonId, currentRun.night);
  return {
    profile: currentProfile,
    run: prepareSoloCampaignDaytime(currentProfile, withBoon, {night: currentRun.night + 1}),
  };
}

function recordObjectiveEvidence(run, waveNumber, evidence) {
  const objective = OPTIONAL_OBJECTIVES[run.night];
  if (!objective || !run.objectiveState) return run;
  const currentEvidence = run.objectiveState.evidence ?? {
    kind: objective.evidenceKind,
    evaluatedWaves: [],
    failedWave: null,
  };
  if (currentEvidence.evaluatedWaves.includes(waveNumber)) return run;
  const passed = objective.id === "hold-east-gate"
    ? evidence?.eastApproachWardHeld === true
    : evidence?.caravanPassageHeld === true
      && Number(evidence?.livingEscortCount) > 0
      && (Number(currentEvidence.bossObjectiveDurability) || 0) > 0;
  const nextEvidence = {
    ...currentEvidence,
    evaluatedWaves: [...currentEvidence.evaluatedWaves, waveNumber].sort((a, b) => a - b),
    failedWave: passed ? currentEvidence.failedWave : currentEvidence.failedWave ?? waveNumber,
    ...(objective.id === "hold-east-gate"
      ? {eastApproachWardHeld: passed}
      : {
        caravanPassageHeld: evidence?.caravanPassageHeld === true,
        livingEscortCount: Math.max(0, Number(evidence?.livingEscortCount) || 0),
      }),
  };
  return {
    ...run,
    objectiveState: {
      ...run.objectiveState,
      evidence: nextEvidence,
      status: waveNumber === 3 ? (objectiveSucceeded({...run.objectiveState, evidence: nextEvidence}) ? "succeeded" : "failed") : "active",
    },
  };
}

function objectiveSucceeded(objectiveState) {
  return objectiveState?.evidence?.evaluatedWaves?.length === 3
    && objectiveState.evidence.failedWave === null;
}

function createBossEncounterState(definition, run, options) {
  if (!definition.bossEncounterIds.length) return null;
  const actors = definition.bossEncounterIds.map((id) => ({
    id,
    title: BOSS_ENCOUNTERS[id].title,
    status: BOSS_ENCOUNTERS[id].fixedActor ? "waiting" : "crowd-authored",
  }));
  const fixed = actors.some((actor) => BOSS_ENCOUNTERS[actor.id].fixedActor);
  if (fixed) {
    const encounterId = definition.bossEncounterIds.length === 2
      ? definition.bossEncounterIds.join("+")
      : definition.bossEncounterIds[0];
    return serialiseBossDirector(createBossDirector({
      encounterId,
      seed: (run.runSeed ^ Math.imul(definition.night, 0x9e3779b1) ^ definition.waveNumber) >>> 0,
      hpMultiplier: options.hpMultiplier ?? 1,
      occupiedSocketIds: run.fortifications.map(item => item.socketId).filter(Boolean),
      occupiedSockets: options.occupiedSockets ?? [],
      objectiveLaneId: run.objectiveState?.id ?? "evacuation-lane",
      objectiveLanePosition: options.objectiveLanePosition,
      boons: run.boons,
    }));
  }
  return {
    version: 1,
    night: definition.night,
    wave: definition.waveNumber,
    encounterId: `night-${definition.night}-wave-${definition.waveNumber}`,
    actorIds: actors.map((actor) => actor.id),
    actors,
    mode: "crowd-authored",
    status: "crowd-authored",
    eventSequence: 0,
    label: actors.map((actor) => actor.title).join(" and "),
  };
}

function replayTransition(profile, run) {
  const type = run.phase === GAME_PHASES.BOON_CHOICE
    ? "boon"
    : run.phase === GAME_PHASES.CAMPAIGN_COMPLETE
      ? "campaign_complete"
      : run.phase === GAME_PHASES.INTERWAVE_RECOVERY
        ? "recovery"
        : run.phase === GAME_PHASES.DAYTIME
          ? "daytime"
      : run.phase === GAME_PHASES.BUILD_BREAK
        ? "build"
        : "result";
  return {type, profile, run, settlement: null};
}

function stableRequestId(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:+-]{0,127}$/u.test(value)) {
    throw new RangeError(`${label} must be a stable bounded ID`);
  }
  return value;
}

function recoveryWarningModel(run) {
  return Object.freeze({
    id: `night-${run.night}-wave-${run.wave + 1}-warning`,
    modal: false,
    capturesInput: false,
  });
}

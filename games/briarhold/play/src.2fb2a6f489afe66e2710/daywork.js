import {createBoonOffer} from "./boons.js";
import {getCampaignWave} from "./campaign-content.js";
import {GAME_PHASES} from "./contracts.js";
import {FORTIFICATION_DEFINITIONS} from "./fortifications.js";
import {HUB_NPC_IDS, isHubNpcAlive} from "./hub.js";
import {normaliseRunState} from "./progression.js";

const BOSS_COUNTER_HINTS = {
  "wicker-colossus": {
    id: "wicker-colossus-counter-hint",
    bossId: "wicker-colossus",
    content: "Break its exposed wicker mass with focused fire. The Arbalest and knife remain a valid plan.",
  },
  "moss-crowned-matron": {
    id: "moss-crowned-matron-counter-hint",
    bossId: "moss-crowned-matron",
    content: "Circle the shield arcs and strike the bright core. The Arbalest and knife remain a valid plan.",
  },
  "root-sapper-prime": {
    id: "root-sapper-prime-counter-hint",
    bossId: "root-sapper-prime",
    content: "Interrupt the visible plant before it disables a mechanism. The Arbalest and knife remain a valid plan.",
  },
  "ashwing-matriarch": {
    id: "ashwing-matriarch-counter-hint",
    bossId: "ashwing-matriarch",
    content: "Move clear of the marked dive lane before the ash ignites, then answer with the Arbalest.",
  },
  "moonless-herald": {
    id: "moonless-herald-counter-hint",
    bossId: "moonless-herald",
    content: "Attack only while the heart-lantern is visible; survive each hidden phase with movement.",
  },
  "caravan-eater": {
    id: "caravan-eater-counter-hint",
    bossId: "caravan-eater",
    content: "Build stagger and keep it away from the evacuation lane. The Arbalest and knife remain valid.",
  },
  "hollow-hart": {
    id: "hollow-hart-counter-hint",
    bossId: "hollow-hart",
    content: "Read the roots while the grounded sovereign changes lane pressure.",
  },
  cinderwing: {
    id: "cinderwing-counter-hint",
    bossId: "cinderwing",
    content: "Read the fire strafe, then fire during the exposed flight window.",
  },
};

export const DAYWORK_DEFINITIONS = deepFreeze({
  "read-the-watch": {
    id: "read-the-watch",
    npcId: HUB_NPC_IDS.BELLKEEPER,
    benefitId: "watch-intel",
    bossCounterHints: BOSS_COUNTER_HINTS,
  },
  "set-the-brace": {
    id: "set-the-brace",
    npcId: HUB_NPC_IDS.MASON,
    benefitId: "gate-repair-discount",
    standardRepairCost: 12,
    repairCost: 6,
    uses: 1,
    expiresAt: "bell",
  },
  "count-stores": {
    id: "count-stores",
    npcId: HUB_NPC_IDS.QUARTERMASTER,
    benefitId: "supplies",
    suppliesGranted: 8,
    uses: 1,
  },
  "prime-the-line": {
    id: "prime-the-line",
    npcId: HUB_NPC_IDS.TRAPPER,
    benefitId: "fortification-restock",
    supplyCost: 0,
  },
  "read-the-root": {
    id: "read-the-root",
    npcId: HUB_NPC_IDS.GREENWARDEN,
    benefitId: "root-preview",
    finaleCounterHints: [BOSS_COUNTER_HINTS["hollow-hart"], BOSS_COUNTER_HINTS.cinderwing],
  },
  "field-medicine": {
    id: "field-medicine",
    npcId: HUB_NPC_IDS.QUARTERMASTER,
    supplyCost: 30,
    healing: 50,
    charges: 1,
    stateDefaults: {prepared: false, available: false},
  },
});

const DAYWORK_ACTION_IDS = new Set([
  "read-the-watch",
  "set-the-brace",
  "count-stores",
  "prime-the-line",
  "read-the-root",
]);
const ACTION_ALIASES = Object.freeze({"set-brace": "set-the-brace"});
const WARDEN_ID = /^warden-[a-z0-9](?:[a-z0-9-]{0,62})$/u;

/** Return a non-mutating eligibility and effect preview for one daywork request. */
export function previewDayworkAction(run, request = {}) {
  let current;
  try {
    current = normaliseRunState(run);
    const action = normaliseActionRequest(current, request);
    const existing = current.narrative.daywork;
    if (existing) {
      const idempotent = existing.night === current.night
        && existing.npcId === action.npcId
        && existing.actionId === action.actionId
        && existing.targetId === action.targetId;
      return freezeResult({
        available: false,
        idempotent,
        reason: idempotent ? "already-completed" : "already-used",
        message: idempotent
          ? "this daywork request is already complete"
          : "daywork has already been used this night",
        action: definitionModel(action.definition),
      });
    }
    if (current.phase !== GAME_PHASES.DAYTIME) {
      return unavailable(action.definition, "wrong-phase", "daywork is available only during daytime");
    }
    if (!isHubNpcAlive(action.npcId, current)) {
      return unavailable(action.definition, "provider-unavailable", "daywork requires its living recruited NPC");
    }
    if (action.actionId === "prime-the-line") {
      const target = selectedFortification(current, action.targetId);
      if (!action.targetId) return unavailable(action.definition, "target-required", "prime-the-line requires an explicit target");
      if (!target) return unavailable(action.definition, "target-not-installed", "the selected fortification is not installed");
      const maximum = finiteMaximumCharges(target.type);
      if (maximum === null) return unavailable(action.definition, "target-unavailable", "the selected fortification cannot be restocked");
      if (Number(target.charges) >= maximum) return unavailable(action.definition, "target-full", "the selected fortification is already full");
      if (!Number.isFinite(target.charges) || target.charges !== 0) {
        return unavailable(action.definition, "target-not-depleted", "the selected fortification is not depleted");
      }
    }
    return freezeResult({
      available: true,
      idempotent: false,
      reason: null,
      message: null,
      action: definitionModel(action.definition),
      benefit: buildBenefit(current, action),
    });
  } catch (error) {
    return freezeResult({
      available: false,
      idempotent: false,
      reason: "invalid-request",
      message: error instanceof Error ? error.message : String(error),
      action: null,
    });
  }
}

/** Apply one host-owned daywork action without mutating the supplied run. */
export function applyDayworkAction(run, request = {}) {
  const current = normaliseRunState(run);
  const action = normaliseActionRequest(current, request);
  const existing = current.narrative.daywork;
  if (existing) {
    if (existing.night === current.night
      && existing.npcId === action.npcId
      && existing.actionId === action.actionId
      && existing.targetId === action.targetId) {
      const recordedAction = {...action, targetId: existing.targetId};
      return freezeResult({
        run: current,
        applied: false,
        idempotent: true,
        action: definitionModel(action.definition),
        benefit: buildBenefit(current, recordedAction),
      });
    }
    throw new Error("daywork is already used this night");
  }
  if (current.phase !== GAME_PHASES.DAYTIME) throw new Error("daywork is available only during daytime");
  if (!isHubNpcAlive(action.npcId, current)) throw new Error("daywork requires its living recruited NPC");

  const preview = previewDayworkAction(current, request);
  if (!preview.available) throw new Error(preview.message ?? "daywork action is unavailable");
  let next = {
    ...current,
    narrative: {
      ...current.narrative,
      daywork: {
        night: current.night,
        npcId: action.npcId,
        actionId: action.actionId,
        targetId: action.targetId,
        requestId: action.requestId,
      },
    },
  };
  if (action.actionId === "set-the-brace") {
    next.dayworkBenefit = {gateRepairDiscountAvailable: true, consumeReceipt: null};
  } else if (action.actionId === "count-stores") {
    next.supplies += DAYWORK_DEFINITIONS["count-stores"].suppliesGranted;
  } else if (action.actionId === "prime-the-line") {
    const index = next.fortifications.findIndex((entry) => entry?.socketId === action.targetId);
    const placement = next.fortifications[index];
    const maximum = finiteMaximumCharges(placement.type);
    next.fortifications = next.fortifications.slice();
    next.fortifications[index] = {...placement, charges: maximum};
  }
  return freezeResult({
    run: next,
    applied: true,
    idempotent: false,
    action: definitionModel(action.definition),
    benefit: buildBenefit(next, action),
  });
}

/**
 * Preview or consume Orin's repair discount. Call with successful:false for a
 * failed/invalid repair and successful:true only after repair authority commits.
 */
export function consumeDayworkBenefit(run, request = {}, options = {}) {
  const current = normaliseRunState(run);
  const input = typeof request === "string" ? {benefitId: request, ...options} : request;
  if (!input || input.benefitId !== "gate-repair-discount") {
    throw new RangeError("unknown daywork benefit");
  }
  const authority = normaliseMutationRequest(current, input, "eventId", "daywork benefit event ID");
  const definition = DAYWORK_DEFINITIONS["set-the-brace"];
  const receipt = current.dayworkBenefit.consumeReceipt;
  if (receipt?.eventId === authority.id) {
    return freezeResult({
      run: current,
      benefitId: input.benefitId,
      repairCost: definition.repairCost,
      consumed: true,
      available: false,
      expired: false,
      idempotent: true,
    });
  }
  const available = current.phase === GAME_PHASES.DAYTIME
    && current.narrative.daywork?.night === current.night
    && current.narrative.daywork?.actionId === definition.id
    && current.dayworkBenefit.gateRepairDiscountAvailable;
  if (!available) {
    const expiredRun = current.dayworkBenefit.gateRepairDiscountAvailable
      ? {...current, dayworkBenefit: {...current.dayworkBenefit, gateRepairDiscountAvailable: false}}
      : current;
    return freezeResult({
      run: expiredRun,
      benefitId: input.benefitId,
      repairCost: definition.standardRepairCost,
      consumed: false,
      available: false,
      expired: current.phase !== GAME_PHASES.DAYTIME,
      idempotent: false,
    });
  }
  if (input.successful !== true) {
    return freezeResult({
      run: current,
      benefitId: input.benefitId,
      repairCost: definition.repairCost,
      consumed: false,
      available: true,
      expired: false,
      idempotent: false,
    });
  }
  return freezeResult({
    run: {
      ...current,
      dayworkBenefit: {
        gateRepairDiscountAvailable: false,
        consumeReceipt: {
          eventId: authority.id,
          night: authority.night,
          runOrdinal: authority.runOrdinal,
        },
      },
    },
    benefitId: input.benefitId,
    repairCost: definition.repairCost,
    consumed: true,
    available: false,
    expired: false,
    idempotent: false,
  });
}

/** Spend Supplies in daytime to prepare the separate shared medicine charge. */
export function prepareFieldMedicine(run, request = {}) {
  const current = normaliseRunState(run);
  const authority = normaliseMutationRequest(current, request, "requestId", "field medicine request ID");
  const definition = DAYWORK_DEFINITIONS["field-medicine"];
  if (current.playerMedicine.night === current.night && current.playerMedicine.prepared) {
    if (current.playerMedicine.prepareReceipt?.requestId === authority.id) {
      return freezeResult({
        run: current,
        prepared: true,
        idempotent: true,
        supplyCost: definition.supplyCost,
      });
    }
    throw new Error("field medicine is already prepared for this night");
  }
  if (current.phase !== GAME_PHASES.DAYTIME) throw new Error("field medicine can be prepared only during daytime");
  if (!isHubNpcAlive(definition.npcId, current)) throw new Error("field medicine requires a living Quartermaster");
  if (current.supplies < definition.supplyCost) throw new Error("not enough Supplies for field medicine");
  return freezeResult({
    run: {
      ...current,
      supplies: current.supplies - definition.supplyCost,
      playerMedicine: {
        night: current.night,
        prepared: true,
        available: true,
        prepareReceipt: {
          requestId: authority.id,
          night: authority.night,
          runOrdinal: authority.runOrdinal,
        },
        consumeReceipt: null,
      },
    },
    prepared: true,
    idempotent: false,
    supplyCost: definition.supplyCost,
  });
}

/** Consume the prepared charge for one valid Warden during combat. */
export function consumeFieldMedicine(run, request = {}, actorInput = {}) {
  const current = normaliseRunState(run);
  const authority = normaliseMutationRequest(current, request, "requestId", "field medicine request ID");
  const definition = DAYWORK_DEFINITIONS["field-medicine"];
  const actor = normaliseMedicineActor(actorInput);
  const receipt = current.playerMedicine.consumeReceipt;
  if (receipt?.requestId === authority.id) {
    if (receipt.actorId !== actor.actorId) {
      throw new Error("field medicine request ID is already bound to a different actor");
    }
    const effect = medicineEffect(receipt, definition.healing);
    return freezeResult({
      run: current,
      actor: {actorId: receipt.actorId, hp: effect.hpAfter, maxHp: receipt.maxHp},
      effect,
      consumed: true,
      idempotent: true,
    });
  }
  if (current.phase !== GAME_PHASES.COMBAT) throw new Error("field medicine can be consumed only during combat");
  if (current.playerMedicine.night !== current.night || !current.playerMedicine.prepared) {
    throw new Error("field medicine is not prepared for this night");
  }
  if (!current.playerMedicine.available) throw new Error("field medicine is not available because it was already used");
  if (actor.hp >= actor.maxHp) throw new Error("the Warden is already at full health");
  const hpAfter = Math.min(actor.maxHp, actor.hp + definition.healing);
  const consumeReceipt = {
    requestId: authority.id,
    night: authority.night,
    runOrdinal: authority.runOrdinal,
    actorId: actor.actorId,
    hpBefore: actor.hp,
    maxHp: actor.maxHp,
  };
  const next = {
    ...current,
    playerMedicine: {...current.playerMedicine, available: false, consumeReceipt},
  };
  if (actor.actorId === actor.localActorId) {
    next.player = {...current.player, hp: hpAfter, maxHp: actor.maxHp};
  }
  return freezeResult({
    run: next,
    actor: {actorId: actor.actorId, hp: hpAfter, maxHp: actor.maxHp},
    effect: medicineEffect(consumeReceipt, definition.healing),
    consumed: true,
    idempotent: false,
  });
}

function normaliseActionRequest(run, request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("daywork request must be an object");
  }
  const actionId = ACTION_ALIASES[request.actionId] ?? request.actionId;
  if (typeof actionId !== "string" || !DAYWORK_ACTION_IDS.has(actionId)) {
    throw new RangeError(`unknown daywork action: ${String(request.actionId)}`);
  }
  const definition = DAYWORK_DEFINITIONS[actionId];
  if (request.npcId !== definition.npcId) {
    throw new Error(`${String(request.npcId)} does not offer ${actionId}`);
  }
  if (!Number.isInteger(request.night)) {
    throw new TypeError("daywork request night must be an exact integer");
  }
  if (request.night !== run.night) {
    throw new Error(`daywork request night ${request.night} is stale for night ${run.night}`);
  }
  if (!Number.isInteger(request.runOrdinal) || request.runOrdinal < 1) {
    throw new TypeError("daywork request run ordinal must be a positive integer");
  }
  if (request.runOrdinal !== run.runOrdinal) {
    throw new Error(`daywork request run ordinal ${request.runOrdinal} is stale`);
  }
  const requestId = stableRequestId(request.requestId, "daywork request ID");
  const targetId = request.targetId === undefined || request.targetId === null
    ? null
    : narrativeId(request.targetId, "daywork target ID");
  return {actionId, npcId: definition.npcId, targetId, requestId, definition};
}

function normaliseMutationRequest(run, request, idField, label) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError(`${label} request must be an object`);
  }
  if (!Number.isInteger(request.night)) throw new TypeError(`${label} night must be an exact integer`);
  if (request.night !== run.night) throw new Error(`${label} night is stale`);
  if (!Number.isInteger(request.runOrdinal) || request.runOrdinal < 1) {
    throw new TypeError(`${label} run ordinal must be a positive integer`);
  }
  if (request.runOrdinal !== run.runOrdinal) throw new Error(`${label} run ordinal is stale`);
  return {night: request.night, runOrdinal: request.runOrdinal, id: stableRequestId(request[idField], label)};
}

function normaliseMedicineActor(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("field medicine requires authoritative Warden vitality");
  }
  if (typeof value.actorId !== "string" || !WARDEN_ID.test(value.actorId)) {
    throw new Error("field medicine requires a valid Warden actor");
  }
  if (typeof value.localActorId !== "string" || !WARDEN_ID.test(value.localActorId)) {
    throw new Error("field medicine requires a valid local Warden identity");
  }
  if (!Number.isFinite(value.maxHp) || value.maxHp <= 0 || !Number.isFinite(value.hp)
    || value.hp < 0 || value.hp > value.maxHp) {
    throw new RangeError("field medicine requires valid authoritative Warden vitality");
  }
  return {actorId: value.actorId, localActorId: value.localActorId, hp: value.hp, maxHp: value.maxHp};
}

function medicineEffect(receipt, healing) {
  const hpAfter = Math.min(receipt.maxHp, receipt.hpBefore + healing);
  return {
    actorId: receipt.actorId,
    amount: hpAfter - receipt.hpBefore,
    hpBefore: receipt.hpBefore,
    hpAfter,
  };
}

function stableRequestId(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:+-]{0,127}$/u.test(value)) {
    throw new RangeError(`${label} must be a stable bounded ID`);
  }
  return value;
}

function narrativeId(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/u.test(value)) {
    throw new RangeError(`${label} must be a bounded narrative ID`);
  }
  return value;
}

function selectedFortification(run, targetId) {
  if (typeof targetId !== "string" || targetId.length === 0) return null;
  return run.fortifications.find((entry) => entry?.socketId === targetId) ?? null;
}

function finiteMaximumCharges(type) {
  const maximum = FORTIFICATION_DEFINITIONS[type]?.charges;
  return Number.isFinite(maximum) && maximum > 0 ? maximum : null;
}

function buildBenefit(run, action) {
  if (action.actionId === "read-the-watch") return watchBenefit(run);
  if (action.actionId === "set-the-brace") {
    return {benefitId: action.definition.benefitId, repairCost: action.definition.repairCost};
  }
  if (action.actionId === "count-stores") {
    return {benefitId: action.definition.benefitId, suppliesGranted: action.definition.suppliesGranted};
  }
  if (action.actionId === "prime-the-line") {
    return {benefitId: action.definition.benefitId, targetId: action.targetId,
      maximumCharges: finiteMaximumCharges(selectedFortification(run, action.targetId)?.type)};
  }
  if (run.night === 7) {
    return {
      benefitId: action.definition.benefitId,
      boonOffer: null,
      counterHints: action.definition.finaleCounterHints,
    };
  }
  return {
    benefitId: action.definition.benefitId,
    boonOffer: createBoonOffer(run, run.night),
    counterHints: [],
  };
}

function watchBenefit(run) {
  const waves = [0, 1, 2].map((waveIndex) => getCampaignWave(run.night, waveIndex));
  const waveThreatTags = [...new Set(waves.flatMap((wave) => wave.teaches))];
  const bossIds = waves.flatMap((wave) => wave.bossEncounterIds);
  const hints = bossIds
    .map((bossId) => DAYWORK_DEFINITIONS["read-the-watch"].bossCounterHints[bossId])
    .filter(Boolean);
  return {
    benefitId: "watch-intel",
    waveThreatTags,
    bossCounterHint: {
      id: `night-${run.night}-boss-counter-hint`,
      bossIds,
      content: hints.map((hint) => hint.content).join(" ")
        || "No named boss is expected; the Arbalest and knife remain a valid plan.",
    },
  };
}

function definitionModel(definition) {
  return {...definition};
}

function unavailable(definition, reason, message) {
  return freezeResult({available: false, idempotent: false, reason, message, action: definitionModel(definition)});
}

function freezeResult(value) {
  return Object.freeze(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

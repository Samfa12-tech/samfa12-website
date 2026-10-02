/**
 * Deterministic, renderer-free state for Briarhold's walkable courtyard hub.
 *
 * This module owns identity, arrival, discovery, service-gating, and persistent
 * repair state only. Positions, panels, costs, and visible meshes remain map
 * and gameplay concerns so this state can run identically in Node, a Worker,
 * the browser, and a future authoritative multiplayer host.
 */

export const HUB_NPC_IDS = Object.freeze({
  BELLKEEPER: "bellkeeper",
  MASON: "mason",
  QUARTERMASTER: "quartermaster",
  TRAPPER: "trapper",
  GREENWARDEN: "greenwarden",
});

export const HUB_STATION_IDS = Object.freeze({
  BELL_PLATFORM: "bell-platform",
  MASONS_BENCH: "masons-bench",
  QUARTERMASTER_STORES: "quartermaster-stores",
  TRAPPERS_WORKSHOP: "trappers-workshop",
  GREENWARDENS_SHRINE: "greenwardens-shrine",
});

export const HUB_SERVICE_IDS = Object.freeze({
  WAVE_START: "wave-start",
  GATE_REPAIR: "gate-repair",
  FIELD_READINESS: "field-readiness",
  DEFENCE_WORKSHOP: "defence-workshop",
  BOON_CHOICE: "boon-choice",
});

export const HUB_NPCS = deepFreeze([
  {
    id: HUB_NPC_IDS.BELLKEEPER,
    stationId: HUB_STATION_IDS.BELL_PLATFORM,
    serviceId: HUB_SERVICE_IDS.WAVE_START,
  },
  {
    id: HUB_NPC_IDS.MASON,
    stationId: HUB_STATION_IDS.MASONS_BENCH,
    serviceId: HUB_SERVICE_IDS.GATE_REPAIR,
  },
  {
    id: HUB_NPC_IDS.QUARTERMASTER,
    stationId: HUB_STATION_IDS.QUARTERMASTER_STORES,
    serviceId: HUB_SERVICE_IDS.FIELD_READINESS,
  },
  {
    id: HUB_NPC_IDS.TRAPPER,
    stationId: HUB_STATION_IDS.TRAPPERS_WORKSHOP,
    serviceId: HUB_SERVICE_IDS.DEFENCE_WORKSHOP,
  },
  {
    id: HUB_NPC_IDS.GREENWARDEN,
    stationId: HUB_STATION_IDS.GREENWARDENS_SHRINE,
    serviceId: HUB_SERVICE_IDS.BOON_CHOICE,
  },
]);

const RELATIONSHIP_STATUS_ORDER = Object.freeze(["new", "known", "trusted", "bonded"]);
const RELATIONSHIP_STATUS_INDEX = new Map(
  RELATIONSHIP_STATUS_ORDER.map((status, index) => [status, index]),
);
const NPC_RANK_TRACKS = Object.freeze({
  [HUB_NPC_IDS.BELLKEEPER]: ["bellkeepers-watch"],
  [HUB_NPC_IDS.MASON]: ["masons-oath"],
  [HUB_NPC_IDS.QUARTERMASTER]: ["armory-temper", "quartermaster"],
  [HUB_NPC_IDS.TRAPPER]: ["field-craft"],
  [HUB_NPC_IDS.GREENWARDEN]: ["wardens-vigor"],
});

export const HUB_FEATURE_IDS = Object.freeze({
  OUTER_GATE_BRACING: "outer-gate-bracing",
  HEART_GATE_MASONRY: "heart-gate-masonry",
  FIELD_INFIRMARY: "field-infirmary",
  QUARTERMASTER_STORES: "quartermaster-stores",
  TRAPPER_WORKSHOP: "trapper-workshop",
  BALLISTA_LOFT: "ballista-loft",
  WARD_LANTERN_NETWORK: "ward-lantern-network",
});

/**
 * Mechanical limits and costs deliberately stay out of this contract. They
 * are authored by the map/service layer; this record only supplies stable IDs
 * and the station that will eventually present each feature.
 */
export const HUB_FEATURES = deepFreeze([
  { id: HUB_FEATURE_IDS.OUTER_GATE_BRACING, stationId: HUB_STATION_IDS.MASONS_BENCH },
  { id: HUB_FEATURE_IDS.HEART_GATE_MASONRY, stationId: HUB_STATION_IDS.MASONS_BENCH },
  { id: HUB_FEATURE_IDS.FIELD_INFIRMARY, stationId: HUB_STATION_IDS.QUARTERMASTER_STORES },
  { id: HUB_FEATURE_IDS.QUARTERMASTER_STORES, stationId: HUB_STATION_IDS.QUARTERMASTER_STORES },
  { id: HUB_FEATURE_IDS.TRAPPER_WORKSHOP, stationId: HUB_STATION_IDS.TRAPPERS_WORKSHOP },
  { id: HUB_FEATURE_IDS.BALLISTA_LOFT, stationId: HUB_STATION_IDS.TRAPPERS_WORKSHOP },
  { id: HUB_FEATURE_IDS.WARD_LANTERN_NETWORK, stationId: HUB_STATION_IDS.GREENWARDENS_SHRINE },
]);

const NPC_ORDER = new Map(HUB_NPCS.map((npc, index) => [npc.id, index]));
export const HUB_NPC_UNLOCK_ORDER = Object.freeze(HUB_NPCS.map((npc) => npc.id));
const COMPLETED_NIGHT_PHASES = new Set(["boon_choice", "night_complete", "campaign_complete"]);

/** Return a deterministic, forward-compatible profile discovery list. */
export function normaliseHubUnlocks(value) {
  if (!Array.isArray(value)) return [];
  return uniqueIds(value).sort(compareNpcIds);
}

/** Return the next canonical recruit without discarding unknown future roster IDs. */
export function nextMissingHubNpcId(hubUnlocks) {
  const unlocked = new Set(normaliseHubUnlocks(hubUnlocks));
  return HUB_NPC_UNLOCK_ORDER.find((npcId) => !unlocked.has(npcId)) ?? null;
}

/** Run-local NPC deaths survive every night and reload until the run ends. */
export function normaliseFallenNpcs(value) {
  return normaliseHubUnlocks(value);
}

/**
 * Normalise a persisted RunStateV2 hub object. Unknown IDs and feature keys are
 * retained so an older build never destroys newer side-loaded hub content.
 */
export function normaliseHubState(input) {
  if (input !== undefined && input !== null && !isPlainObject(input)) {
    throw new TypeError("hub state must be an object");
  }

  const source = input ?? {};
  const features = defaultFeatureStates();
  if (source.features !== undefined && !isPlainObject(source.features)) {
    throw new TypeError("hub.features must be an object");
  }
  for (const [id, value] of Object.entries(source.features ?? {})) {
    if (!isNonEmptyString(id)) continue;
    features[id] = normaliseFeatureState(value, `hub.features.${id}`);
  }

  const activeNpcs = uniqueIds(source.activeNpcs ?? []).sort(compareNpcIds);
  const activeSet = new Set(activeNpcs);
  const introductionQueue = uniqueIds(source.introductionQueue ?? [])
    .filter((id) => activeSet.has(id));

  return {
    features: sortRecord(features),
    activeNpcs,
    introductionQueue,
  };
}

/**
 * Seed a new run or migrate an older v2 run that predates hub persistence.
 * Only permanently unlocked, still-living NPCs are present. Terminal-run
 * settlement owns roster growth, so wave milestones cannot leak unlocks.
 */
export function createHubStateForRun(profile = {}, run = {}, options = {}) {
  const hubUnlocks = normaliseHubUnlocks(profile?.hubUnlocks);
  const fallen = new Set(normaliseFallenNpcs(options.fallenNpcs ?? run?.fallenNpcs));
  const activeNpcs = hubUnlocks.filter((id) => !fallen.has(id));
  return normaliseHubState({
    features: defaultFeatureStates(),
    activeNpcs,
    introductionQueue: [],
  });
}

/**
 * Reconcile the run roster with permanent unlocks without mutating profile or
 * run. Repeating this at wave breaks is safe and never creates an unlock.
 */
export function applyHubArrivals(profile = {}, run = {}, options = {}) {
  const hubUnlocks = normaliseHubUnlocks(profile?.hubUnlocks);
  const current = run?.hub === undefined || run?.hub === null
    ? createHubStateForRun(profile, run, options)
    : normaliseHubState(run.hub);
  const fallen = new Set(normaliseFallenNpcs(options.fallenNpcs ?? run?.fallenNpcs));
  const activeNpcs = hubUnlocks.filter((id) => !fallen.has(id));
  const previous = new Set(current.activeNpcs);
  const arrivals = activeNpcs.filter((id) => !previous.has(id));

  return {
    hubUnlocks,
    hub: normaliseHubState({
      ...current,
      activeNpcs,
      introductionQueue: current.introductionQueue.filter((id) => activeNpcs.includes(id)),
    }),
    arrivals: arrivals.sort(compareNpcIds),
  };
}

/** Remove an NPC from this run's active hub roster without changing the profile. */
export function markHubNpcFallen(run, npcId) {
  if (!isNonEmptyString(npcId) || !NPC_ORDER.has(npcId)) {
    throw new RangeError(`unknown hub NPC: ${npcId}`);
  }
  const fallenNpcs = normaliseFallenNpcs([...(run?.fallenNpcs ?? []), npcId]);
  const hub = normaliseHubState(run?.hub);
  return {
    ...run,
    fallenNpcs,
    hub: normaliseHubState({
      ...hub,
      activeNpcs: hub.activeNpcs.filter((id) => !fallenNpcs.includes(id)),
      introductionQueue: hub.introductionQueue.filter((id) => !fallenNpcs.includes(id)),
    }),
  };
}

export function isHubNpcAlive(npcId, run = {}) {
  return normaliseHubState(run?.hub).activeNpcs.includes(npcId)
    && !normaliseFallenNpcs(run?.fallenNpcs).includes(npcId);
}

/** Consume only the head event so introduction ordering is deterministic. */
export function consumeHubIntroduction(hub, npcId) {
  const current = normaliseHubState(hub);
  const nextId = current.introductionQueue[0] ?? null;
  if (nextId === null) return current;
  if (npcId !== undefined && npcId !== nextId) {
    throw new Error(`next hub introduction is ${nextId}, not ${npcId}`);
  }
  return normaliseHubState({
    ...current,
    introductionQueue: current.introductionQueue.slice(1),
  });
}

/** Update one repairable feature without mutating the supplied hub state. */
export function setHubFeatureState(hub, featureId, value) {
  if (!isNonEmptyString(featureId)) {
    throw new TypeError("featureId must be a non-empty string");
  }
  const current = normaliseHubState(hub);
  return normaliseHubState({
    ...current,
    features: {
      ...current.features,
      [featureId]: normaliseFeatureState(value, `hub.features.${featureId}`),
    },
  });
}

/**
 * A service exists only while its permanently unlocked NPC is alive this run.
 */
export function isHubServiceAvailable(npcId, run = {}, options = {}) {
  const npc = HUB_NPCS.find((entry) => entry.id === npcId);
  if (!npc) return false;
  if (options.profile !== undefined) return resolveNpcSystemAccess(options.profile, run).living[npcId] === true;
  return isHubNpcAlive(npcId, run);
}

/**
 * Resolve the authoritative NPC-owned systems from persistent recruitment,
 * relationship status, and this run's living roster. Recipes are permanent
 * knowledge; personal services and new purchases require a living owner.
 */
export function resolveNpcSystemAccess(profile = {}, run = null) {
  const recruited = new Set(normaliseHubUnlocks(profile?.hubUnlocks));
  const active = run === null || run === undefined
    ? recruited
    : new Set(normaliseHubState(run?.hub).activeNpcs);
  const fallen = new Set(normaliseFallenNpcs(run?.fallenNpcs));
  const hasLivingNpc = (npcId) => recruited.has(npcId) && active.has(npcId) && !fallen.has(npcId);
  const statusOf = (npcId) => {
    const status = profile?.relationships?.[npcId]?.status;
    return RELATIONSHIP_STATUS_INDEX.has(status) ? status : "new";
  };
  const hasStatus = (npcId, minimum) => (
    RELATIONSHIP_STATUS_INDEX.get(statusOf(npcId)) >= RELATIONSHIP_STATUS_INDEX.get(minimum)
  );
  const quartermaster = hasLivingNpc(HUB_NPC_IDS.QUARTERMASTER);
  const trapper = hasLivingNpc(HUB_NPC_IDS.TRAPPER);
  const rankCeilings = {};
  for (const [npcId, trackIds] of Object.entries(NPC_RANK_TRACKS)) {
    const status = hasLivingNpc(npcId) ? statusOf(npcId) : "new";
    const ceiling = npcId === HUB_NPC_IDS.BELLKEEPER
      ? ({new: 0, known: 1, trusted: 2, bonded: 3}[status])
      : ({new: 0, known: 1, trusted: 3, bonded: 5}[status]);
    for (const trackId of trackIds) rankCeilings[trackId] = ceiling;
  }
  return deepFreeze({
    recruited: Object.fromEntries(HUB_NPC_UNLOCK_ORDER.map((npcId) => [npcId, recruited.has(npcId)])),
    living: Object.fromEntries(HUB_NPC_UNLOCK_ORDER.map((npcId) => [npcId, hasLivingNpc(npcId)])),
    relationships: Object.fromEntries(HUB_NPC_UNLOCK_ORDER.map((npcId) => [npcId, statusOf(npcId)])),
    recipes: {
      barricade: recruited.has(HUB_NPC_IDS.MASON),
      thornSnare: recruited.has(HUB_NPC_IDS.TRAPPER),
      firePot: recruited.has(HUB_NPC_IDS.TRAPPER) && hasStatus(HUB_NPC_IDS.TRAPPER, "known"),
      ballista: recruited.has(HUB_NPC_IDS.TRAPPER) && hasStatus(HUB_NPC_IDS.TRAPPER, "trusted"),
      wardLantern: recruited.has(HUB_NPC_IDS.GREENWARDEN),
    },
    services: {
      repair: hasLivingNpc(HUB_NPC_IDS.MASON),
      stores: quartermaster,
      fieldMedicine: quartermaster,
      wardenFocus: quartermaster,
      defenceWorkshop: trapper,
      boonChoice: hasLivingNpc(HUB_NPC_IDS.GREENWARDEN),
      daywork: Object.fromEntries(
        HUB_NPC_UNLOCK_ORDER.map((npcId) => [npcId, hasLivingNpc(npcId)]),
      ),
    },
    purchases: {
      "warden-focus": quartermaster,
      "sunfire-prism": quartermaster && hasStatus(HUB_NPC_IDS.QUARTERMASTER, "known"),
      "split-runebolt": quartermaster && hasStatus(HUB_NPC_IDS.QUARTERMASTER, "trusted"),
    },
    rankCeilings,
  });
}

function defaultFeatureStates() {
  return Object.fromEntries(
    HUB_FEATURES.map((feature) => [
      feature.id,
      { integrity: 0, repaired: false, tier: 0 },
    ]),
  );
}

function normaliseFeatureState(value, name) {
  if (!isPlainObject(value)) throw new TypeError(`${name} must be an object`);
  const integrity = value.integrity ?? 0;
  if (!Number.isFinite(integrity) || integrity < 0) {
    throw new RangeError(`${name}.integrity must be a non-negative finite number`);
  }
  return {
    integrity,
    repaired: Boolean(value.repaired),
    tier: toNonNegativeInteger(value.tier, `${name}.tier`),
  };
}

function uniqueIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter(isNonEmptyString)
      .map((id) => id.trim()),
  )];
}

function compareNpcIds(left, right) {
  const leftOrder = NPC_ORDER.get(left);
  const rightOrder = NPC_ORDER.get(right);
  if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
  if (leftOrder !== undefined) return -1;
  if (rightOrder !== undefined) return 1;
  return left.localeCompare(right);
}

function sortRecord(record) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function toNonNegativeInteger(value, name) {
  const normalised = value ?? 0;
  if (!Number.isInteger(normalised) || normalised < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
  return normalised;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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

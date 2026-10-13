import {
  CAMPAIGN_PHASES,
  CAMPAIGN_STATE_VERSION,
  applyCombatReloadPolicy,
  createCampaignState,
} from "./campaign.js";
import {
  BELLKEEPER_BRIEFING_SCENE_IDS,
  GAME_PHASES,
  PROFILE_STATE_VERSION,
  RUN_STATE_VERSION,
  bellkeeperBriefingSceneId,
  createProfileState,
  normaliseProfileState,
  normaliseRunState,
  restoreWaveStartSnapshot,
} from "./progression.js";

export const SAVE_VERSION = 4;
export const DEFAULT_SAVE_KEY = "briarhold.save.v4";
export const LEGACY_SAVE_KEYS = Object.freeze(["briarhold.save.v3", "briarhold.save.v2", "briarhold.save.v1"]);
const BELLKEEPER_BRIEFING_SCENE_ID_SET = new Set(BELLKEEPER_BRIEFING_SCENE_IDS);

/**
 * @typedef {object} BriarholdSaveV2
 * @property {2} version
 * @property {import("./progression.js").ProfileStateV2} profile
 * @property {import("./progression.js").RunStateV2|null} run
 * @property {string} savedAt
 */

/** Browser localStorage-shaped in-memory store, also useful for tests. */
export function createMemoryStorage(initialEntries = {}) {
  const data = new Map(
    Object.entries(initialEntries).map(([key, value]) => [key, String(value)]),
  );
  return {
    get length() {
      return data.size;
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    getItem(key) {
      return data.has(String(key)) ? data.get(String(key)) : null;
    },
    setItem(key, value) {
      data.set(String(key), String(value));
    },
    removeItem(key) {
      data.delete(String(key));
    },
    clear() {
      data.clear();
    },
  };
}

/** Retain readable storage even when writes are unavailable. */
export function resolveStorage(candidate) {
  const fallback = createMemoryStorage();
  const storage =
    candidate ??
    (() => {
      try {
        return globalThis.localStorage;
      } catch (error) {
        // Let the adapter record the failure and announce its memory-only
        // session, rather than silently pretending a fallback is persistent.
        return {getItem() { throw error; }, setItem() { throw error; }, removeItem() { throw error; }};
      }
    })();

  return storage ?? fallback;
}

/**
 * The canonical adapter API is `saveState(profile, run)` / `loadState()`.
 * `save(campaign, progression)` and the returned `.campaign`/`.progression`
 * aliases keep the pre-pivot browser build usable while it moves to run v2.
 *
 * @param {{
 *   storage?: Storage|ReturnType<typeof createMemoryStorage>,
 *   key?: string,
 *   legacyKeys?: string[],
 *   now?: () => string
 * }} [options]
 */
export function createSaveAdapter(options = {}) {
  const storage = resolveStorage(options.storage);
  const key = options.key ?? DEFAULT_SAVE_KEY;
  const legacyKeys = options.legacyKeys ??
    (options.key ? [] : LEGACY_SAVE_KEYS);
  const now = options.now ?? (() => new Date().toISOString());
  let pending = null;
  let persistenceWarning = null;
  let persistenceUnavailable = false;
  let preserveOriginal = false;
  let memoryEnvelope = null;
  try {
    const probe = "__briarhold_storage_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
  } catch (error) {
    persistenceUnavailable = true;
    persistenceWarning = error;
  }

  const result = (envelope, status = {}) => {
    if (!envelope) return {ok: false, pending: Boolean(status.pending), error: status.error ?? null};
    Object.defineProperties(envelope, {
      ok: {value: true, enumerable: false},
      pending: {value: false, enumerable: false},
      error: {value: null, enumerable: false},
    });
    return envelope;
  };

  const write = (profile, run) => {
    let envelope;
    try {
      envelope = createEnvelope(profile, run, now());
    } catch (error) {
      return result(null, {pending: false, error});
    }
    if (persistenceUnavailable) {
      pending = envelope;
      memoryEnvelope = clone(envelope);
      return {ok: true, pending: true, inMemory: true, error: persistenceWarning ?? new Error("save storage unavailable")};
    }
    try {
      storage.setItem(key, JSON.stringify(envelope));
      pending = null;
      persistenceUnavailable = false;
      persistenceWarning = null;
      return result(attachCompatibilityAliases(clone(envelope)));
    } catch (error) {
      pending = envelope;
      memoryEnvelope = clone(envelope);
      persistenceUnavailable = true;
      persistenceWarning = error;
      return result(null, {pending: true, error});
    }
  };

  const read = () => {
    let sourceKey = key;
    if (memoryEnvelope) return attachCompatibilityAliases(clone(memoryEnvelope));
    let raw;
    try {
      raw = storage.getItem(key);
    } catch (error) {
      persistenceWarning = error;
      persistenceUnavailable = true;
      preserveOriginal = true;
      return null;
    }
    if (raw === null) {
      for (const legacyKey of legacyKeys) {
        try {
          raw = storage.getItem(legacyKey);
        } catch (error) {
          persistenceWarning = error;
          persistenceUnavailable = true;
          preserveOriginal = true;
          return null;
        }
        if (raw !== null) {
          sourceKey = legacyKey;
          break;
        }
      }
    }
    if (raw === null) return null;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error("Briarhold save is not valid JSON", { cause: error });
    }
    const migrated = migrateSave(parsed);
    if (migrated.run) {
      migrated.run = applyWaveReloadPolicy(migrated.run);
    }
    // Write the v4 envelope before removing nothing: the source raw save stays
    // intact on a storage failure, including when it lived under a legacy key.
    if (parsed.version !== SAVE_VERSION || sourceKey !== key) {
      try {
        storage.setItem(key, JSON.stringify(migrated));
      } catch {
        // Migration remains readable in memory; callers can save/retry later.
      }
    }
    return attachCompatibilityAliases(migrated);
  };

  return Object.freeze({
    key,
    storage,
    get persistenceWarning() { return persistenceWarning; },

    /** Save the canonical profile and optional active run. */
    saveState(profile, run = null) {
      return write(profile, run);
    },

    /** Retry the last failed write after storage becomes available. */
    retryPendingSave() {
      if (!pending) return result(null, {pending: false});
      const retry = pending;
      try {
        if (preserveOriginal) return result(null, {pending: true, error: persistenceWarning ?? new Error("original save is preserved for recovery")});
        storage.setItem(key, JSON.stringify(retry));
        pending = null;
        memoryEnvelope = null;
        persistenceUnavailable = false;
        preserveOriginal = false;
        persistenceWarning = null;
        return result(attachCompatibilityAliases(clone(retry)));
      } catch (error) {
        return result(null, {pending: true, error});
      }
    },

    /** Preserve an unreadable raw save under a recovery key for later inspection. */
    quarantineSave(error = null) {
      let raw;
      try {
        raw = storage.getItem(key);
      } catch (readError) {
        persistenceWarning = readError;
        persistenceUnavailable = true;
        preserveOriginal = true;
        return {ok: false, pending: true, error: error ?? readError};
      }
      if (raw === null) return {ok: false, pending: false, error: error ?? new Error("no save to quarantine")};
      const recoveryKey = `${key}.recovery`;
      try {
        storage.setItem(recoveryKey, raw);
        return {ok: true, pending: false, key: recoveryKey, error: error ?? null};
      } catch (writeError) {
        persistenceWarning = writeError;
        persistenceUnavailable = true;
        preserveOriginal = true;
        memoryEnvelope = null;
        return {ok: false, pending: true, key: recoveryKey, error: writeError};
      }
    },

    /** Load the canonical v2 envelope. Combat resumes at wave start. */
    loadState() {
      return read();
    },

    /**
     * Compatibility overloads:
     * - `save(campaignV1, progressionV1)`
     * - `save(profileV2, runV2)`
     * - `save({ profile, run })`
     */
    save(subject, secondary = {}) {
      if (isPlainObject(subject) && ("profile" in subject || "run" in subject)) {
        return write(subject.profile ?? {}, subject.run ?? null);
      }
      if (looksLikeProfileV2(subject)) {
        return write(subject, secondary ?? null);
      }

      const campaign = sanitiseCampaign(subject);
      const profile = normaliseProfileState(secondary);
      return write(profile, legacyCampaignToRun(campaign));
    },

    load() {
      return read();
    },

    clear() {
      // A failed write from before the reset must never be able to resurrect
      // the profile after the player has deliberately deleted it.
      pending = null;
      memoryEnvelope = null;
      const targets = new Set([key, `${key}.recovery`]);
      for (const legacyKey of legacyKeys) {
        targets.add(legacyKey);
        targets.add(`${legacyKey}.recovery`);
      }
      let firstError = null;
      for (const target of targets) {
        try {
          storage.removeItem(target);
        } catch (error) {
          firstError ??= error;
        }
      }
      if (!firstError) {
        persistenceUnavailable = false;
        preserveOriginal = false;
        persistenceWarning = null;
      }
      return firstError
        ? {ok: false, pending: false, error: firstError}
        : {ok: true, pending: false, error: null};
    },
  });
}

/**
 * Validate and migrate supported save envelopes.
 *
 * Version 0: `{ campaign, oathmarks, unlocks, savedAt }`.
 * Version 1: `{ version, campaign, progression, savedAt }`.
 * Both old campaign shapes intentionally start a fresh run because their
 * fixed-camera combat and dawn snapshots are incompatible with first-person
 * run state. Permanent Oathmarks and unlocks are preserved.
 *
 * @param {unknown} input
 * @returns {BriarholdSaveV2}
 */
export function migrateSave(input) {
  if (!isPlainObject(input)) {
    throw new TypeError("Briarhold save must be an object");
  }

  const source = clone(input);
  const version = source.version ?? 0;
  let envelope;
  if (version === 0) {
    envelope = createEnvelope(
      {
        oathmarks: source.oathmarks ?? 0,
        unlocks: source.unlocks ?? [],
        hubUnlocks: source.hubUnlocks ?? [],
      },
      null,
      normaliseSavedAt(source.savedAt),
    );
  } else if (version === 1) {
    envelope = createEnvelope(
      source.progression ?? {},
      null,
      normaliseSavedAt(source.savedAt),
    );
  } else if (version === 2) {
    envelope = createEnvelope(
      source.profile ?? source.progression ?? {},
      migrateLegacyRun(source.run, 2, source.profile ?? source.progression ?? {}),
      normaliseSavedAt(source.savedAt),
    );
  } else if (version === 3) {
    const profile = source.profile ?? source.progression ?? {};
    envelope = createEnvelope(
      profile,
      migrateLegacyRun(source.run, 3, profile),
      normaliseSavedAt(source.savedAt),
    );
  } else if (version === SAVE_VERSION) {
    envelope = createEnvelope(
      source.profile ?? source.progression ?? {},
      source.run ?? null,
      normaliseSavedAt(source.savedAt),
    );
  } else {
    throw new Error(`unsupported Briarhold save version: ${version}`);
  }

  return attachCompatibilityAliases(envelope);
}

/** Apply the v2 suspension rule without modifying non-combat saves. */
export function applyWaveReloadPolicy(run) {
  const current = normaliseRunState(run);
  return current.phase === GAME_PHASES.COMBAT
    ? restoreWaveStartSnapshot(current)
    : current;
}

function createEnvelope(profile, run, savedAt) {
  return {
    version: SAVE_VERSION,
    profile: normaliseProfileState(profile),
    run: normaliseRunState(run),
    savedAt: normaliseSavedAt(savedAt),
  };
}

function migrateLegacyRun(run, sourceVersion, profile, {waveSnapshot = false} = {}) {
  if (run === null || run === undefined) return null;
  if (!isPlainObject(run)) throw new TypeError(`v${sourceVersion} run state must be an object`);
  const migrated = {...clone(run), version: RUN_STATE_VERSION};
  if (isPlainObject(migrated.waveStartSnapshot)) {
    migrated.waveStartSnapshot = migrateLegacyRun(migrated.waveStartSnapshot, sourceVersion, profile, {waveSnapshot: true});
  }
  if (sourceVersion === 3) {
    migrateV3CadenceBoundary(migrated, profile, {waveSnapshot});
  }
  return migrated;
}

/**
 * v3 did not store the v4 briefing receipt, but it did persist the cadence
 * boundary itself. Promote recoverable boundaries with a migration receipt;
 * malformed boundaries fall back to a retryable daylight rather than replaying
 * already-cleared waves.
 */
function migrateV3CadenceBoundary(run, profile, {waveSnapshot}) {
  const wave = Number.isInteger(run.wave) ? run.wave : -1;
  switch (run.phase) {
    case GAME_PHASES.BUILD_BREAK:
      if (wave === 0) return migrateV3ToDaytime(run);
      if (wave === 1 || wave === 2) {
        run.phase = GAME_PHASES.INTERWAVE_RECOVERY;
        run.recovery = {remainingMs: 12_000};
        run.waveStartSnapshot = null;
        run.bossEncounter = null;
        return addMigratedBellReceipt(run);
      }
      return migrateV3ToDaytime(run);
    case GAME_PHASES.COMBAT:
      if (wave >= 0 && wave <= 2 && (waveSnapshot || isPlainObject(run.waveStartSnapshot))) {
        delete run.recovery;
        return addMigratedBellReceipt(run);
      }
      return migrateV3ToDaytime(run);
    case GAME_PHASES.INTERWAVE_RECOVERY:
      if (wave === 1 || wave === 2) {
        run.recovery = validRecovery(run.recovery) ? {remainingMs: run.recovery.remainingMs} : {remainingMs: 12_000};
        run.waveStartSnapshot = null;
        run.bossEncounter = null;
        return addMigratedBellReceipt(run);
      }
      return migrateV3ToDaytime(run);
    case GAME_PHASES.BOON_CHOICE:
      if (hasLivingMigratedEdda(run, profile) && wave === 3) {
        delete run.recovery;
        run.waveStartSnapshot = null;
        run.bossEncounter = null;
        return addMigratedBellReceipt(run);
      }
      return migrateV3BoonFallback(run);
    default:
      return undefined;
  }
}

function addMigratedBellReceipt(run) {
  const briefingSceneId = bellkeeperBriefingSceneId(run.night);
  const completedSceneIds = Array.isArray(run.narrative?.completedSceneIds)
    ? run.narrative.completedSceneIds.filter(sceneId => !BELLKEEPER_BRIEFING_SCENE_ID_SET.has(sceneId))
    : [];
  run.narrative = {...run.narrative, completedSceneIds: [...new Set([...completedSceneIds, briefingSceneId])]};
  run.bellConfirmation = {
    confirmationId: `v3-migration:${run.runOrdinal}:${run.night}`,
    briefingSceneId,
    night: run.night,
    runOrdinal: run.runOrdinal,
  };
}

function migrateV3ToDaytime(run) {
  run.phase = GAME_PHASES.DAYTIME;
  run.wave = 0;
  run.waveStartSnapshot = null;
  run.bossEncounter = null;
  delete run.recovery;
  delete run.bellConfirmation;
}

function migrateV3BoonFallback(run) {
  if (Number.isInteger(run.night) && run.night < 7) {
    run.night += 1;
    migrateV3ToDaytime(run);
    return;
  }
  run.phase = GAME_PHASES.CAMPAIGN_COMPLETE;
  run.wave = 3;
  run.waveStartSnapshot = null;
  run.bossEncounter = null;
  delete run.recovery;
  delete run.bellConfirmation;
}

function validRecovery(value) {
  return isPlainObject(value) && Number.isFinite(value.remainingMs)
    && value.remainingMs >= 0 && value.remainingMs <= 12_000;
}

function hasLivingMigratedEdda(run, profile) {
  const unlocked = Array.isArray(profile?.hubUnlocks) && profile.hubUnlocks.includes("greenwarden");
  const active = !Array.isArray(run?.hub?.activeNpcs) || run.hub.activeNpcs.includes("greenwarden");
  return unlocked && active && !run.fallenNpcs?.includes("greenwarden");
}

/** Add non-serialised transition aliases without duplicating save data. */
function attachCompatibilityAliases(envelope) {
  const profile = envelope.profile ?? createProfileState();
  const campaign = envelope.run?.legacyCampaign
    ? sanitiseCampaign(envelope.run.legacyCampaign)
    : envelope.run === null
      ? createCampaignState()
      : null;
  Object.defineProperties(envelope, {
    progression: {
      configurable: true,
      enumerable: false,
      value: { oathmarks: profile.oathmarks, unlocks: [...profile.unlocks] },
    },
    campaign: {
      configurable: true,
      enumerable: false,
      value: campaign,
    },
  });
  return envelope;
}

/** Convert a newly saved legacy session, not a loaded v1 save, into run v2. */
function legacyCampaignToRun(campaign, includeSnapshot = true) {
  const persistedCampaign = includeSnapshot && campaign.phase === CAMPAIGN_PHASES.COMBAT
    ? applyCombatReloadPolicy(campaign)
    : campaign;
  const phase = {
    [CAMPAIGN_PHASES.DAWN]: GAME_PHASES.BUILD_BREAK,
    [CAMPAIGN_PHASES.COMBAT]: GAME_PHASES.BUILD_BREAK,
    [CAMPAIGN_PHASES.NIGHT_COMPLETE]: GAME_PHASES.NIGHT_COMPLETE,
    [CAMPAIGN_PHASES.CAMPAIGN_COMPLETE]: GAME_PHASES.CAMPAIGN_COMPLETE,
    [CAMPAIGN_PHASES.GAME_OVER]: GAME_PHASES.RUN_FAILED,
  }[persistedCampaign.phase];
  const run = normaliseRunState({
    version: RUN_STATE_VERSION,
    phase,
    night: persistedCampaign.currentNight,
    wave: 0,
    player: { hp: 100, maxHp: 100 },
    gates: {
      outer: persistedCampaign.gates.west ?? persistedCampaign.gates.east,
      heart: persistedCampaign.gates.heart,
    },
    supplies: persistedCampaign.supplies,
    fortifications: [],
    boons: [],
    earnedOathmarks: persistedCampaign.oathmarksEarned,
    emergencyHealUsed: false,
    waveStartSnapshot: null,
    legacyCampaign: persistedCampaign,
  });
  return run;
}

function sanitiseCampaign(input) {
  if (!isPlainObject(input)) {
    throw new TypeError("save is missing campaign state");
  }
  if (input.version !== CAMPAIGN_STATE_VERSION) {
    throw new Error(`unsupported campaign state version: ${input.version}`);
  }

  const defaults = createCampaignState();
  const campaign = {
    ...defaults,
    ...clone(input),
    gates: { ...defaults.gates, ...clone(input.gates ?? {}) },
  };
  if (
    !Number.isInteger(campaign.currentNight) ||
    campaign.currentNight < 1 ||
    campaign.currentNight > 7
  ) {
    throw new RangeError("saved currentNight is outside the campaign");
  }
  if (!Number.isInteger(campaign.supplies) || campaign.supplies < 0) {
    throw new RangeError("saved Supplies must be a non-negative integer");
  }
  return campaign;
}

function looksLikeProfileV2(value) {
  return isPlainObject(value) &&
    (value.version === PROFILE_STATE_VERSION || "ranks" in value);
}

function normaliseSavedAt(value) {
  return typeof value === "string" ? value : new Date(0).toISOString();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return structuredClone(value);
}

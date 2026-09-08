import {createProfileState} from "./progression.js";

/** Reset player-owned progress while retaining preferences for this device. */
export function freshProfileAfterSaveDeletion(profile = {}) {
  return createProfileState({settings: profile?.settings ?? {}});
}

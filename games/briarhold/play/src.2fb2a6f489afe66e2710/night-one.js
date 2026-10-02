import {
  NIGHT_ONE_COMPANY_TIMING,
  NIGHT_ONE_WAVES,
  NIGHT_ONE_WICKER_EMERGENCE,
  buildCampaignWaveRoster,
} from "./campaign-content.js";

export {NIGHT_ONE_COMPANY_TIMING, NIGHT_ONE_WAVES, NIGHT_ONE_WICKER_EMERGENCE};

/**
 * Compatibility wrapper for the original zero-based Night One roster API.
 * The canonical authoring and subdivision path now belongs to campaign content.
 */
export function buildNightOneWaveRoster(waveIndex, densityProfile = "desktop", options = {}) {
  const roster = buildCampaignWaveRoster(1, waveIndex, densityProfile, options);
  return Object.freeze({
    ...roster,
    budgets: Object.freeze({
      ...roster.budgets,
      hp: roster.groups.reduce((total, group) => total + group.hpBudget, 0),
    }),
  });
}

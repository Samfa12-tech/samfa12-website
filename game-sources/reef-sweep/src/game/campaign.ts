import type { CampaignState, Profile, ReefProgress, Run, SiteId } from './types.js';
import { SITES, UPGRADES, reefFishHomes, upgradeLevel } from './data.js';

const RESEARCH_REPUTATION = 8;
const RESEARCH_DAY_TOTAL = 65;
const RESEARCH_NIGHT_TOTAL = 72;
const MONITORING_DAY_TOTAL = 38;
const MONITORING_NIGHT_TOTAL = 45;
const REQUIRED_CAMPAIGN_FIELDS = ['researchInvitationSeen', 'researchAccepted', 'researchCompleted', 'characterFlags', 'milestoneFlags'] as const;
const OPTIONAL_CAMPAIGN_FIELDS = ['activeOpportunity', 'activeOpportunityDay', 'activeOpportunityPublishedAt', 'activeOpportunityCleanedAt'] as const;
const emptyCampaign = (): CampaignState => ({
    researchInvitationSeen: false,
    researchAccepted: false,
    researchCompleted: false,
    characterFlags: [],
    milestoneFlags: []
});

/** Validate the optional schema-1 extension without accepting unbounded or ambiguous state. */
export function validateCampaign(value: unknown): CampaignState {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid campaign state.');
    const source = value as Record<string, unknown>;
    const fields = new Set<string>([...REQUIRED_CAMPAIGN_FIELDS, ...OPTIONAL_CAMPAIGN_FIELDS]);
    if (REQUIRED_CAMPAIGN_FIELDS.some(key => !(key in source)) || Object.keys(source).some(key => !fields.has(key))) throw Error('Invalid campaign fields.');
    for (const key of ['researchInvitationSeen', 'researchAccepted', 'researchCompleted']) {
        if (typeof source[key] !== 'boolean') throw Error('Invalid campaign flag: ' + key);
    }
    const validFlags = (v: unknown) => Array.isArray(v) && v.length <= 100 && v.every(flag => typeof flag === 'string' && flag.length > 0 && flag.length <= 80 && /^[a-z0-9][a-z0-9-]*$/i.test(flag)) && new Set(v).size === v.length;
    if (!validFlags(source.characterFlags) || !validFlags(source.milestoneFlags)) throw Error('Invalid campaign recognition flags.');
    if (source.researchAccepted && !source.researchInvitationSeen) throw Error('Research cannot be accepted before its invitation.');
    if (source.researchCompleted && !source.researchAccepted) throw Error('Research cannot be completed before acceptance.');
    const hasOpportunity = source.activeOpportunity !== undefined;
    const snapshots = ['activeOpportunityDay', 'activeOpportunityPublishedAt', 'activeOpportunityCleanedAt'] as const;
    if (hasOpportunity) {
        if (!['recognition-80', 'recognition-160', 'recognition-300'].includes(String(source.activeOpportunity)) || !Number.isInteger(source.activeOpportunityDay) || !Number.isInteger(source.activeOpportunityPublishedAt) || !Number.isInteger(source.activeOpportunityCleanedAt) || Number(source.activeOpportunityDay) < 1 || Number(source.activeOpportunityDay) > 1e6 || Number(source.activeOpportunityPublishedAt) < 0 || Number(source.activeOpportunityPublishedAt) > 1000 || Number(source.activeOpportunityCleanedAt) < 0 || Number(source.activeOpportunityCleanedAt) > 1e8) throw Error('Invalid active career opportunity.');
    } else if (snapshots.some(key => source[key] !== undefined)) throw Error('Career opportunity snapshots need an active opportunity.');
    return structuredClone(source) as unknown as CampaignState;
}

/** Supply campaign defaults and grandfather careers that already used research. */
export function normalizeCampaign(profile: Pick<Profile, 'campaign' | 'reefs' | 'active' | 'pending'>): CampaignState {
    const existingResearch = [profile.active, profile.pending].some(run => run?.order === 'research');
    if (profile.campaign !== undefined) {
        const state = validateCampaign(profile.campaign);
        if (existingResearch && !state.researchCompleted) {
            state.researchInvitationSeen = true;
            state.researchAccepted = true;
        }
        return state;
    }
    const priorSurvey = Object.values(profile.reefs ?? {}).some(reef => (reef?.surveys ?? 0) > 0 || (reef?.surveyedStations?.length ?? 0) > 0);
    const state = emptyCampaign();
    if (priorSurvey || existingResearch) {
        state.researchInvitationSeen = true;
        state.researchAccepted = true;
    }
    return state;
}

export function researchEligibility(profile: Profile): { eligible: boolean; reason: string } {
    const campaign = profile.campaign ?? normalizeCampaign(profile);
    if (campaign.researchAccepted && campaign.researchCompleted) return { eligible: true, reason: 'The funded assignment is complete; repeat two-station Monitoring remains available.' };
    if (campaign.researchAccepted) return { eligible: true, reason: 'The funded two-station assignment is ready to choose.' };
    if (profile.reputation < RESEARCH_REPUTATION) return { eligible: false, reason: `Earn ${RESEARCH_REPUTATION} professional reputation to meet the research team.` };
    if (!campaign.researchInvitationSeen) return { eligible: false, reason: 'A research invitation is available in person at the harbour.' };
    return { eligible: false, reason: 'Accept the research invitation at the harbour before selecting the assignment.' };
}

export function approachResearch(profile: Profile): { ok: boolean; reason: string } {
    const campaign = profile.campaign ?? (profile.campaign = normalizeCampaign(profile));
    if (campaign.researchCompleted) return { ok: false, reason: 'The research team has already funded this assignment.' };
    if (campaign.researchInvitationSeen) return { ok: false, reason: campaign.researchAccepted ? 'The invitation has already been accepted.' : 'The research invitation is already waiting at the harbour.' };
    if (profile.reputation < RESEARCH_REPUTATION) return { ok: false, reason: `The research team needs ${RESEARCH_REPUTATION} professional reputation first.` };
    campaign.researchInvitationSeen = true;
    return { ok: true, reason: 'The research team invited you to discuss a funded two-station assignment.' };
}

export function acceptResearch(profile: Profile): { ok: boolean; reason: string } {
    const campaign = profile.campaign ?? (profile.campaign = normalizeCampaign(profile));
    if (campaign.researchCompleted) return { ok: false, reason: 'The funded research assignment is already complete.' };
    if (campaign.researchAccepted) return { ok: false, reason: 'The funded research assignment is already accepted.' };
    if (!campaign.researchInvitationSeen) return { ok: false, reason: 'Meet the research team and hear the invitation before accepting.' };
    campaign.researchAccepted = true;
    return { ok: true, reason: 'You accepted the funded assignment: record two distinct field stations in one outing.' };
}

export type ContractKind = 'catch' | 'cleanup' | 'restore' | 'research' | 'none';
export interface ContractOption { kind: ContractKind; available: boolean; reason: string; remaining?: number }

function remainingLionfish(profile: Profile, siteId: SiteId): number {
    const site = SITES[siteId];
    const reef = profile.reefs[siteId];
    const homes = reefFishHomes(site, site.seed);
    // On visits four and later, the first four habitat slots are replaced by
    // the current return cohort; they are not four extra fish on top of the
    // authored population.
    const cohort = Math.floor(reef.visits / 4);
    const ids = homes.map((_, i) => reef.visits >= 4 && i < 4 ? `return-${cohort}-${i}` : `fish-${i}`);
    return ids.filter(id => !reef.removed.includes(id)).length;
}

export function contractOptions(profile: Profile, siteId: SiteId): ContractOption[] {
    const site = SITES[siteId];
    const reef = profile.reefs[siteId];
    const fish = remainingLionfish(profile, siteId);
    const cleanup = Math.max(0, (site.worksites?.debris.length ?? 0) - reef.cleaned.length);
    const restoration = Math.max(0, (site.worksites?.coral.length ?? 0) - Object.keys(reef.restored).length);
    const research = researchEligibility(profile);
    const stationCount = (site.worksites?.surveys.length ?? 0) + 2;
    const researchAvailable = research.eligible && stationCount >= 2;
    const catchAvailable = fish >= 4;
    const cleanupAvailable = cleanup >= 2;
    const restorationAvailable = restoration >= 2;
    return [
        { kind: 'catch', available: catchAvailable, remaining: fish, reason: catchAvailable ? `${fish} lionfish remain at this site.` : fish > 0 ? `Only ${fish} lionfish remain; the Kitchen order needs four fish to sell.` : 'No lionfish remain at this site today.' },
        { kind: 'cleanup', available: cleanupAvailable, remaining: cleanup, reason: cleanupAvailable ? `${cleanup} permanent debris patches remain.` : cleanup > 0 ? `Only ${cleanup} debris patch remains; the cleanup order needs two.` : 'All authored debris has been removed.' },
        { kind: 'restore', available: restorationAvailable, remaining: restoration, reason: restorationAvailable ? `${restoration} restoration plots remain unplanted.` : restoration > 0 ? `Only ${restoration} restoration plot remains; the planting order needs two.` : 'All restoration plots are planted.' },
        { kind: 'research', available: researchAvailable, remaining: researchAvailable ? 2 : 0, reason: researchAvailable ? (profile.campaign?.researchCompleted ? 'Record two distinct field stations for a repeat Monitoring contract.' : 'Record two distinct field stations for the funded assignment.') : research.reason },
        { kind: 'none', available: true, reason: 'Dive without a contract.' }
    ];
}

export interface SurveyPayout { stationPay: number; firstVisitPay: number; repeatPay: number; nightUplift: number; stationsPaid: number }

/** Persist first-ever site visits and the per-run snapshot before calculating payment. */
export function recordSurveyStation(profile: Profile, run: Run, stationId: string): { ok: boolean; firstVisit: boolean; reason: string } {
    if (!/^survey-\d+$/.test(stationId)) return { ok: false, firstVisit: false, reason: 'Unknown field station.' };
    const reef = profile.reefs[run.site];
    reef.surveyedStations ??= [];
    run.surveyFirstVisits ??= [];
    run.surveyStations ??= [];
    if (run.surveyStations.includes(stationId)) return { ok: false, firstVisit: false, reason: 'This station has already been surveyed during this outing.' };
    const firstVisit = !reef.surveyedStations.includes(stationId);
    run.surveyStations.push(stationId);
    if (firstVisit) {
        reef.surveyedStations.push(stationId);
        run.surveyFirstVisits.push(stationId);
    }
    return { ok: true, firstVisit, reason: firstVisit ? 'First survey recorded at this station.' : 'Repeat station survey recorded.' };
}

/** Calculate station pay only; a funded assignment's top-up is handled separately. */
export function surveyPayout(run: Run, reef: ReefProgress): SurveyPayout {
    const surveyed = Math.max(0, Math.min(3, Math.floor(run.surveyed)));
    const firstIds = new Set(run.surveyFirstVisits ?? []);
    const firstVisitPay = Math.min(surveyed, firstIds.size) * 18;
    const repeatPay = (surveyed - Math.min(surveyed, firstIds.size)) * 6;
    // For legacy active runs without a first-visit snapshot, assume repeat rate to avoid back-paying unknown history.
    const nightUplift = run.night ? surveyed * 2 : 0;
    void reef;
    return { stationPay: firstVisitPay + repeatPay + nightUplift, firstVisitPay, repeatPay, nightUplift, stationsPaid: surveyed };
}

export interface ResearchSettlement extends SurveyPayout { eligible: boolean; funded: boolean; reason: string; assignmentTopUp: number; total: number }

/** The one-time grant tops station earnings up to a fixed inclusive assignment total. */
export function researchSettlement(run: Run, profile: Profile): ResearchSettlement {
    const station = surveyPayout({ ...run, surveyed: Math.min(2, run.surveyed) }, profile.reefs[run.site]);
    const campaign = profile.campaign ?? normalizeCampaign(profile);
    const legacyRun = run.siteRevision === undefined && run.researchFunded === undefined;
    const distinctStations = run.surveyStations?.length ?? (legacyRun ? run.surveyed : 0);
    // An older suspended research dive had no funding snapshot. Treat it as the
    // first assignment only when the profile has not already been paid for it.
    const funded = run.researchFunded ?? !campaign.researchCompleted;
    let reason = 'The funded assignment needs two distinct stations in one safely completed outing.';
    let eligible = false;
    if (run.order !== 'research') reason = 'This outing was not registered as a research assignment.';
    else if (run.rescued) reason = 'Rescue preserves reef work but does not settle contract pay.';
    else if (run.researchEligible === false && !(run.researchEligible === undefined && campaign.researchAccepted)) reason = 'The research assignment was not eligible when this outing began.';
    else if (funded && campaign.researchCompleted) reason = 'The funded research assignment has already been paid; choose Monitoring for repeat work.';
    else if (run.surveyed < 2 || distinctStations < 2) reason = `Record ${Math.max(0, 2 - Math.min(Math.floor(run.surveyed), distinctStations))} more distinct station${run.surveyed === 1 ? '' : 's'} to complete the assignment.`;
    else if (!campaign.researchAccepted) reason = 'Accept the research invitation before starting the funded assignment.';
    else {
        eligible = true;
        reason = funded
            ? 'Two-station funded assignment settled; station pay is included in the $65 day / $72 night total.'
            : 'Two-station Monitoring settled; repeat station pay is included in the $38 day / $45 night total.';
    }
    const target = funded ? (run.night ? RESEARCH_NIGHT_TOTAL : RESEARCH_DAY_TOTAL) : (run.night ? MONITORING_NIGHT_TOTAL : MONITORING_DAY_TOTAL);
    const assignmentTopUp = eligible ? Math.max(0, target - station.stationPay) : 0;
    return { ...station, eligible, funded, reason, assignmentTopUp, total: station.stationPay + assignmentTopUp };
}

/** Persist the one-time funded-assignment completion after its settlement is applied. */
export function completeResearch(profile: Profile, settlement: ResearchSettlement): { ok: boolean; reason: string } {
    if (!settlement.eligible) return { ok: false, reason: settlement.reason };
    if (!settlement.funded) return { ok: true, reason: 'Monitoring is repeatable and does not change the funded-assignment flag.' };
    const campaign = profile.campaign ?? (profile.campaign = normalizeCampaign(profile));
    if (campaign.researchCompleted) return { ok: false, reason: 'The funded research assignment has already been recorded.' };
    if (!campaign.researchAccepted) return { ok: false, reason: 'The research invitation was not accepted.' };
    campaign.researchCompleted = true;
    return { ok: true, reason: 'The funded two-station assignment is complete.' };
}

export interface CareerMilestone {
    id: 'recognition-80' | 'recognition-160' | 'recognition-300';
    audience: number;
    reputation: number;
    title: string;
    objective: string;
}
export const CAREER_MILESTONES: readonly CareerMilestone[] = [
    { id: 'recognition-80', audience: 80, reputation: 4, title: 'Lantern Bay Field Photographer', objective: 'Publish a peaceful wildlife highlight.' },
    { id: 'recognition-160', audience: 160, reputation: 8, title: 'Reef Storyteller', objective: 'Complete a cleanup and publish its highlight.' },
    { id: 'recognition-300', audience: 300, reputation: 17, title: 'Lantern Bay Conservation Voice', objective: 'Visit a reef on a later day and publish a new highlight.' }
];

function allDebrisCleared(profile:Profile){return Object.values(SITES).every(site=>profile.reefs[site.id].cleaned.length>=(site.worksites?.debris.length??0));}
function recognitionDescription(profile:Profile,milestone:CareerMilestone){return milestone.id==='recognition-160'&&allDebrisCleared(profile)?'The debris is already cleared. Publish a peaceful wildlife highlight to show what that work made possible.':milestone.objective;}

function opportunityMissing(profile: Profile, milestone: CareerMilestone) {
    return [
        profile.audience < milestone.audience ? `${milestone.audience} followers` : '',
        profile.reputation < milestone.reputation ? `${milestone.reputation} reputation` : ''
    ].filter(Boolean);
}

export function acceptMilestoneOpportunity(profile: Profile, id: CareerMilestone['id']): { ok: boolean; reason: string } {
    const milestone = CAREER_MILESTONES.find(item => item.id === id)!;
    const campaign = profile.campaign ?? (profile.campaign = normalizeCampaign(profile));
    if (campaign.milestoneFlags.includes(id)) return { ok: false, reason: 'This recognition has already been earned.' };
    if (campaign.activeOpportunity) return { ok: false, reason: `Finish ${campaign.activeOpportunity} before taking another assignment.` };
    const missing = opportunityMissing(profile, milestone);
    if (missing.length) return { ok: false, reason: 'Still needed: ' + missing.join(', ') + '.' };
    campaign.activeOpportunity = id;
    campaign.activeOpportunityDay = profile.day;
    campaign.activeOpportunityPublishedAt = profile.published.length;
    campaign.activeOpportunityCleanedAt = profile.totalCleaned;
    return { ok: true, reason: `Assignment accepted: ${recognitionDescription(profile,milestone)}` };
}

export function milestoneObjectiveStatus(profile: Profile, id: CareerMilestone['id']) {
    const campaign = profile.campaign ?? normalizeCampaign(profile);
    const active = campaign.activeOpportunity === id;
    const publishedAfterAcceptance = active ? profile.published.slice(campaign.activeOpportunityPublishedAt ?? profile.published.length) : [];
    let complete = false;
    let reason = 'Accept this assignment to begin its objective.';
    if (active && id === 'recognition-80') {
        complete = publishedAfterAcceptance.some(kind => ['marlow', 'turtle', 'ray'].includes(kind));
        reason = complete ? 'A peaceful wildlife highlight was published.' : 'Publish a peaceful wildlife highlight (Marlow, turtle or ray).';
    } else if (active && id === 'recognition-160') {
        const cleanedSince = profile.totalCleaned - (campaign.activeOpportunityCleanedAt ?? profile.totalCleaned);
        const clearReefStory=allDebrisCleared(profile)&&publishedAfterAcceptance.some(kind=>['marlow','turtle','ray'].includes(kind));
        complete = (cleanedSince > 0 && publishedAfterAcceptance.includes('cleanup')) || clearReefStory;
        reason = complete ? 'Your cleared reef and new highlight have been recognised.' : allDebrisCleared(profile)?'The debris stays cleared. Publish a peaceful wildlife highlight from the recovering reef.':'Remove debris and publish a cleanup highlight.';
    } else if (active && id === 'recognition-300') {
        const acceptedDay = campaign.activeOpportunityDay ?? profile.day;
        const recordedLaterVisit = Object.values(profile.reefs).some(reef => reef.lastDay > acceptedDay && reef.lastDay <= profile.day);
        // Settlement evaluates recognition before it advances ReefProgress.lastDay.
        // Count the safe outing being settled, but never a same-day visit or rescue.
        const settlingLaterVisit = profile.pending?.finished === true && !profile.pending.rescued && profile.pending.day > acceptedDay;
        const visitedLater = recordedLaterVisit || settlingLaterVisit;
        complete = visitedLater && publishedAfterAcceptance.length > 0;
        reason = complete ? 'A later reef visit and new published highlight are complete.' : 'Return to a reef on a later day and publish a new highlight.';
    }
    return { active, complete, reason };
}

export function milestoneStatus(profile: Profile, id: CareerMilestone['id']) {
    const milestone = CAREER_MILESTONES.find(item => item.id === id)!;
    const campaign = profile.campaign ?? normalizeCampaign(profile);
    const achieved = campaign.milestoneFlags.includes(id);
    const missing = opportunityMissing(profile, milestone);
    const objective = milestoneObjectiveStatus(profile, id);
    return { milestone, description:recognitionDescription(profile,milestone), achieved, available: !achieved && objective.active && objective.complete && missing.length === 0, missing, objective, recognitionOnly: true as const };
}

/** Record a one-time recognition flag. Recognition never changes cash or reputation. */
export function claimMilestone(profile: Profile, id: CareerMilestone['id']): { ok: boolean; reason: string } {
    const campaign = profile.campaign ?? (profile.campaign = normalizeCampaign(profile));
    const status = milestoneStatus(profile, id);
    if (status.achieved) return { ok: false, reason: 'This recognition has already been recorded.' };
    if (!status.available) return { ok: false, reason: status.missing.length ? 'Still needed: ' + status.missing.join(', ') + '.' : status.objective.reason };
    campaign.milestoneFlags.push(id);
    campaign.activeOpportunity = undefined;
    campaign.activeOpportunityDay = undefined;
    campaign.activeOpportunityPublishedAt = undefined;
    campaign.activeOpportunityCleanedAt = undefined;
    return { ok: true, reason: `Recognition awarded: ${status.milestone.title}.` };
}

/** Persist a bounded one-time character beat without conflating it with reputation. */
export function recordCharacterFlag(profile: Profile, id: string): boolean {
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/i.test(id)) return false;
    const campaign = profile.campaign ?? (profile.campaign = normalizeCampaign(profile));
    if (campaign.characterFlags.includes(id)) return false;
    if (campaign.characterFlags.length >= 100) return false;
    campaign.characterFlags.push(id);
    return true;
}

/** Numeric next-rank effects for upgrade cards; unknown/non-numeric lines return null. */
export function nextUpgradeBenefit(profile: Profile, id: string): { currentRank: number; nextRank: number; label: string; value: number; unit: string } | null {
    if (!UPGRADES.some(upgrade => upgrade.id === id)) return null;
    const currentRank = upgradeLevel(profile, id);
    if (currentRank >= 5) return null;
    const nextRank = currentRank + 1;
    switch (id) {
        case 'fins': return { currentRank, nextRank, label: 'base fin speed bonus', value: nextRank * 12, unit: '%' };
        case 'tube': return { currentRank, nextRank, label: 'secured fish capacity', value: 10 + nextRank * 2, unit: 'fish' };
        case 'spear': return { currentRank, nextRank, label: 'pole-spear reach', value: Number((3 + nextRank * .45).toFixed(2)), unit: 'm' };
        case 'air': return { currentRank, nextRank, label: 'air capacity', value: 200 + Math.max(0, nextRank - 1) * 30, unit: 'units' };
        case 'camera': return { currentRank, nextRank, label: 'highlight quality', value: nextRank * 8, unit: 'points' };
        case 'kit': return { currentRank, nextRank, label: 'nursery fragments', value: 3 + nextRank * 2, unit: 'per dive' };
        default: return null;
    }
}

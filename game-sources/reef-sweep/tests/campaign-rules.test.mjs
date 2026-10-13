import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProfile, validateProfile } from '../build/game/profile.js';
import { startRun } from '../build/game/simulation.js';
import { SITES, reefFishHomes } from '../build/game/data.js';
import { acceptMilestoneOpportunity, acceptResearch, approachResearch, CAREER_MILESTONES, claimMilestone, completeResearch, contractOptions, milestoneObjectiveStatus, milestoneStatus, nextUpgradeBenefit, normalizeCampaign, recordSurveyStation, researchEligibility, researchSettlement, surveyPayout } from '../build/game/campaign.js';

test('schema-1 migration preserves the caller and fairly grandfathers prior research use', () => {
  const p = freshProfile();
  p.reefs.gardens.surveys = 1;
  const before = structuredClone(p);
  const migrated = validateProfile(p);
  assert.deepEqual(p, before);
  assert.equal(migrated.campaign.researchAccepted, true);
  assert.equal(migrated.campaign.researchInvitationSeen, true);
  assert.equal(migrated.reefs.gardens.surveys, 1);
  const active = freshProfile();
  active.active = startRun(active, 'gardens', 'catch');
  // This reproduces an old schema-1 in-flight research run from before
  // contract gating and the funding snapshot existed.
  active.active.order = 'research';
  delete active.active.researchEligible;
  delete active.active.researchFunded;
  const activeLegacy = validateProfile(active);
  assert.equal(activeLegacy.active.researchEligible, true);
  assert.equal(activeLegacy.campaign.researchAccepted, true);
  const activeWithCampaign = structuredClone(active);
  activeWithCampaign.campaign = { researchInvitationSeen: false, researchAccepted: false, researchCompleted: false, characterFlags: [], milestoneFlags: [] };
  assert.equal(validateProfile(activeWithCampaign).campaign.researchAccepted, true);
  assert.deepEqual(normalizeCampaign(freshProfile()).characterFlags, []);
});

test('research requires reputation, a harbour approach, then explicit acceptance', () => {
  const p = freshProfile();
  assert.equal(researchEligibility(p).eligible, false);
  assert.match(approachResearch(p).reason, /needs 8/);
  p.reputation = 8;
  assert.equal(researchEligibility(p).eligible, false);
  assert.equal(approachResearch(p).ok, true);
  assert.match(researchEligibility(p).reason, /Accept/);
  assert.equal(acceptResearch(p).ok, true);
  assert.equal(researchEligibility(p).eligible, true);
  assert.equal(approachResearch(p).ok, false);
});

test('per-site contract options expose finite work, research unlock and an always-available no-contract choice', () => {
  const p = freshProfile();
  const first = contractOptions(p, 'gardens');
  assert.equal(first.find(option => option.kind === 'catch').available, true);
  assert.equal(first.find(option => option.kind === 'cleanup').remaining, 5);
  assert.equal(first.find(option => option.kind === 'restore').remaining, 3);
  assert.equal(first.find(option => option.kind === 'research').available, false);
  assert.equal(first.find(option => option.kind === 'none').available, true);
  for (let i = 0; i < reefFishHomes(SITES.gardens, SITES.gardens.seed).length; i++) p.reefs.gardens.removed.push(`fish-${i}`);
  assert.equal(contractOptions(p, 'gardens').find(option => option.kind === 'catch').available, false);
  p.reefs.gardens.cleaned = ['debris-0', 'debris-1', 'debris-2', 'debris-3', 'debris-4'];
  p.reefs.gardens.restored = { 'coral-0': 1, 'coral-1': 1, 'coral-2': 1 };
  assert.equal(contractOptions(p, 'gardens').find(option => option.kind === 'cleanup').available, false);
  assert.equal(contractOptions(p, 'gardens').find(option => option.kind === 'restore').available, false);
  p.reputation = 8;
  approachResearch(p); acceptResearch(p);
  assert.equal(contractOptions(p, 'gardens').find(option => option.kind === 'research').available, true);
});

test('orders are unavailable when the remaining fish or permanent work cannot meet the contract target', () => {
  const p = freshProfile();
  const reef = p.reefs.gardens;
  const fishCount = reefFishHomes(SITES.gardens, SITES.gardens.seed).length;
  reef.removed = Array.from({ length: fishCount - 3 }, (_, i) => `fish-${i}`);
  reef.cleaned = SITES.gardens.worksites.debris.slice(1).map((_, i) => `debris-${i + 1}`);
  reef.restored = Object.fromEntries(SITES.gardens.worksites.coral.slice(1).map((_, i) => [`coral-${i + 1}`, 1]));
  for (const [kind, reason] of [['catch', /four fish/], ['cleanup', /needs two/], ['restore', /needs two/]]) {
    const option = contractOptions(p, 'gardens').find(candidate => candidate.kind === kind);
    assert.equal(option.available, false);
    assert.match(option.reason, reason);
    assert.throws(() => startRun(p, 'gardens', kind), reason);
  }
  assert.equal(contractOptions(p, 'gardens').find(option => option.kind === 'none').available, true);

  const cohort = freshProfile();
  const homes = reefFishHomes(SITES.gardens, SITES.gardens.seed);
  cohort.reefs.gardens.visits = 4;
  cohort.reefs.gardens.removed = Array.from({ length: homes.length - 3 }, (_, i) => `fish-${i + 3}`);
  const returnOffer = contractOptions(cohort, 'gardens').find(option => option.kind === 'catch');
  assert.equal(returnOffer.remaining, 4, 'the four return fish replace the first four habitat slots');
  assert.equal(returnOffer.available, true, 'four returning fish can fill one Kitchen order without permanent jobs respawning');
});

test('survey payouts diminish on repeats and funded research tops up to one inclusive total', () => {
  const p = freshProfile(); p.reputation = 8; approachResearch(p); acceptResearch(p);
  const run = startRun(p, 'gardens', 'research');
  run.surveyed = 2; run.surveyFirstVisits = ['survey-0']; run.surveyStations = ['survey-0']; run.researchEligible = true; run.researchFunded = true;
  assert.equal(researchSettlement(run, p).eligible, false, 'a new run needs two distinct station identities, not an inflated survey count');
  run.surveyStations.push('survey-1');
  assert.deepEqual(surveyPayout(run, p.reefs.gardens), { stationPay: 24, firstVisitPay: 18, repeatPay: 6, nightUplift: 0, stationsPaid: 2 });
  assert.deepEqual(researchSettlement(run, p), { eligible: true, funded: true, reason: 'Two-station funded assignment settled; station pay is included in the $65 day / $72 night total.', stationPay: 24, firstVisitPay: 18, repeatPay: 6, nightUplift: 0, stationsPaid: 2, assignmentTopUp: 41, total: 65 });
  run.surveyed = 3; run.surveyFirstVisits = ['survey-0', 'survey-1']; run.surveyStations.push('survey-2');
  assert.equal(surveyPayout(run, p.reefs.gardens).stationsPaid, 3);
  assert.equal(researchSettlement(run, p).total, 65);
  run.night = true;
  assert.equal(researchSettlement(run, p).total, 72);
  run.rescued = true;
  assert.equal(researchSettlement(run, p).eligible, false);
  assert.equal(researchSettlement(run, p).assignmentTopUp, 0);
  run.rescued = false; run.night = false; run.surveyed = 2;
  const payout = researchSettlement(run, p);
  assert.equal(payout.funded, true);
  assert.equal(completeResearch(p, payout).ok, true);
  assert.equal(researchSettlement(run, p).eligible, false);
  assert.equal(researchEligibility(p).eligible, true);
  p.active = null;
  const monitoring = startRun(p, 'gardens', 'research');
  monitoring.researchEligible = true; monitoring.researchFunded = false; monitoring.surveyed = 2; monitoring.surveyStations = ['survey-0', 'survey-1']; monitoring.surveyFirstVisits = [];
  assert.equal(researchSettlement(monitoring, p).total, 38);
  assert.equal(researchSettlement(monitoring, p).funded, false);
  assert.match(researchSettlement(monitoring, p).reason, /Monitoring/);
  assert.equal(contractOptions(p, 'gardens').find(option => option.kind === 'research').available, true);
});

test('survey station history pays first visits once and permits a lower-paid repeat on a later outing', () => {
  const p = freshProfile(), run = startRun(p, 'gardens');
  assert.equal(recordSurveyStation(p, run, 'survey-0').firstVisit, true);
  assert.equal(recordSurveyStation(p, run, 'survey-0').ok, false);
  p.active = null;
  const next = startRun(p, 'gardens');
  assert.deepEqual(recordSurveyStation(p, next, 'survey-0'), { ok: true, firstVisit: false, reason: 'Repeat station survey recorded.' });
  assert.equal(surveyPayout({ ...next, surveyed: 1 }, p.reefs.gardens).stationPay, 6);
});

test('recognition milestones use followers, reputation, camera and published-work objectives without cash', () => {
  const p = freshProfile();
  assert.deepEqual(CAREER_MILESTONES.map(m => m.audience), [80, 160, 300]);
  p.audience = 80; p.reputation = 4; p.published = ['survey'];
  assert.equal(acceptMilestoneOpportunity(p, 'recognition-80').ok, true);
  assert.equal(milestoneStatus(p, 'recognition-80').available, false);
  p.published.push('turtle');
  assert.equal(milestoneStatus(p, 'recognition-80').available, true);
  const cash = p.cash;
  assert.equal(claimMilestone(p, 'recognition-80').ok, true);
  assert.equal(claimMilestone(p, 'recognition-80').ok, false);
  assert.equal(p.cash, cash);
  assert.equal(nextUpgradeBenefit(p, 'spear').value, 3.45);
});

test('300 recognition needs a new published highlight and a safe later-day visit, including settlement before lastDay advances', () => {
  const p = freshProfile();
  p.day = 10; p.audience = 300; p.reputation = 17; p.published = ['old-highlight'];
  p.reefs.gardens.lastDay = 9;
  assert.equal(acceptMilestoneOpportunity(p, 'recognition-300').ok, true);
  assert.equal(milestoneObjectiveStatus(p, 'recognition-300').complete, false, 'pre-acceptance reef history does not count');

  p.published.push('new-highlight');
  p.reefs.gardens.lastDay = 10;
  p.pending = { day: 10, finished: true, rescued: false };
  assert.equal(milestoneObjectiveStatus(p, 'recognition-300').complete, false, 'same-day outing does not count');
  p.pending = { day: 11, finished: true, rescued: true };
  assert.equal(milestoneObjectiveStatus(p, 'recognition-300').complete, false, 'rescue is not a successful assignment visit');
  p.pending = { day: 11, finished: true, rescued: false };
  assert.equal(p.reefs.gardens.lastDay, 10, 'settlement has not advanced persistent visit metadata yet');
  assert.equal(milestoneObjectiveStatus(p, 'recognition-300').complete, true, 'the safe outing being settled qualifies before lastDay is updated');

  const cash = p.cash;
  assert.equal(claimMilestone(p, 'recognition-300').ok, true);
  assert.equal(p.cash, cash);
  assert.ok(p.campaign.milestoneFlags.includes('recognition-300'));
  assert.equal(claimMilestone(p, 'recognition-300').ok, false, 'recognition cannot repeat');
});

test('optional campaign, registration, lesson, encounter and progress fields are bounded on import', () => {
  const invalid = [
    p => { p.campaign = { researchInvitationSeen: true, researchAccepted: false, researchCompleted: false, characterFlags: ['bad flag'], milestoneFlags: [] }; },
    p => { p.eventRegistrationDay = p.day + 1; },
    p => { p.active = startRun(p, 'gardens'); p.active.lesson = { step: 99, look: 0, move: 0, drawn: false }; },
    p => { p.active = startRun(p, 'gardens'); p.active.encounter = { kind: 'fishing', phase: 'active', start: 0, p: { x: Infinity, y: 0, z: 0 }, cleanProgress: 0, rewarded: false }; },
    p => { p.active = startRun(p, 'gardens'); p.active.filletCuts = [0, 0, 0, 0]; },
    p => { p.active = startRun(p, 'gardens'); p.active.siteRevision = 3; }
  ];
  for (const setup of invalid) { const p = freshProfile(); setup(p); assert.throws(() => validateProfile(p)); }
  const revisioned = freshProfile(); revisioned.totalRemoved = 6; revisioned.active = startRun(revisioned, 'passage'); revisioned.active.siteRevision = 2;
  assert.equal(validateProfile(revisioned).active.siteRevision, 2);
});

test('a fully cleaned legacy career can earn storytelling recognition without respawning ecological work',()=>{
 const p=freshProfile();p.audience=160;p.reputation=8;
 for(const site of Object.values(SITES))p.reefs[site.id].cleaned=site.worksites.debris.map((_,i)=>'debris-'+i);
 const work=JSON.stringify(p.reefs),cash=p.cash;assert.match(milestoneStatus(p,'recognition-160').description,/already cleared/);
 assert.equal(acceptMilestoneOpportunity(p,'recognition-160').ok,true);assert.equal(milestoneStatus(p,'recognition-160').available,false);
 p.published.push('ray');assert.equal(claimMilestone(p,'recognition-160').ok,true);assert.equal(p.cash,cash);assert.equal(JSON.stringify(p.reefs),work);assert.equal(claimMilestone(p,'recognition-160').ok,false);
});

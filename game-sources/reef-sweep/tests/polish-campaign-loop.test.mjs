import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProfile, validateProfile, SaveStore, MemoryStorage, buy } from '../build/game/profile.js';
import { Simulation, startRun, settleRun, prepareFillets } from '../build/game/simulation.js';
import { SITES, siteUnlocked, siteForRun, floorHeight, reefFishHomes, upgradeLevel, upgradeCost } from '../build/game/data.js';
import { acceptResearch, approachResearch, contractOptions, recordSurveyStation, researchEligibility, researchSettlement, acceptMilestoneOpportunity } from '../build/game/campaign.js';
import { clearBoat } from '../build/game/boat-encounters.js';

function finish(profile, run, allocation = { sell: 0, eat: 0, donate: 0 }, clips = []) {
  new Simulation(profile, run).finish(false);
  return settleRun(profile, run, allocation, clips);
}

function addFirstSurveys(profile, run, ids = ['survey-0', 'survey-1']) {
  for (const id of ids) {
    const result = recordSurveyStation(profile, run, id);
    assert.equal(result.ok, true, result.reason);
    run.surveyed++;
    profile.reefs[run.site].surveys++;
  }
}

test('fresh progression keeps followers separate and exposes the stated reputation/removal gates', () => {
  const p = freshProfile();
  p.tutorial = 1; // Synthetic campaign fixture; skip the first-dive lesson.
  assert.equal(siteUnlocked(p, 'passage'), false);
  p.audience = 1000;
  assert.equal(siteUnlocked(p, 'passage'), false, 'audience cannot unlock field access');
  p.reputation = 5;
  assert.equal(siteUnlocked(p, 'passage'), true);
  assert.equal(siteUnlocked(p, 'mangrove'), false);
  p.reputation = 8;
  assert.equal(researchEligibility(p).eligible, false, 'the research gate still needs an in-world invitation and acceptance');
  const invitation = approachResearch(p);
  assert.equal(invitation.ok, true);
  assert.match(invitation.reason, /invited/i);
  assert.equal(approachResearch(p).ok, false, 'the one-time invitation cannot be repeated');
  assert.equal(researchEligibility(p).eligible, false, 'seeing an invitation is not acceptance');
  assert.equal(acceptResearch(p).ok, true);
  assert.equal(researchEligibility(p).eligible, true);
  const removalCareer = freshProfile(); removalCareer.totalRemoved = 6; removalCareer.audience = 1000;
  assert.equal(siteUnlocked(removalCareer, 'passage'), true, 'removals unlock Passage independently of audience');
  const gates = { passage: [6, 5], mangrove: [12, 8], cenote: [26, 17], harbour: [42, 27] };
  for (const [site, [removals, reputation]] of Object.entries(gates)) {
    const locked = freshProfile(); locked.audience = 1000;
    assert.equal(siteUnlocked(locked, site), false, `${site} does not unlock from followers`);
    const removalRoute = freshProfile(); removalRoute.totalRemoved = removals;
    assert.equal(siteUnlocked(removalRoute, site), true, `${site} removal threshold`);
    const reputationRoute = freshProfile(); reputationRoute.reputation = reputation;
    assert.equal(siteUnlocked(reputationRoute, site), true, `${site} reputation threshold`);
  }
});

test('four fish plus one cleanup supports the first major gear purchase in a synthetic 12-outing fixture', t => {
  const p = freshProfile();
  p.tutorial = 1;
  assert.equal(upgradeCost(p, 'scooter'), 420);
  assert.equal(upgradeCost(p, 'fins'), 95, 'the unrelated fins price stays at its previous value');
  assert.equal(upgradeCost(p, 'tube'), 120, 'the unrelated tube price stays at its previous value');
  assert.equal(upgradeCost(p, 'camera'), 155, 'the unrelated camera price stays at its previous value');
  const rows = [];
  let scooterBoughtOnOuting = null;
  for (let outing = 1; outing <= 12; outing++) {
    const availableSite = Object.keys(SITES).find(id => {
      const offer = contractOptions(p, id).find(option => option.kind === 'catch');
      return siteUnlocked(p, id) && offer?.available && offer.remaining >= 4;
    });
    assert.ok(availableSite, `no catch contract site at outing ${outing}`);
    const offers = contractOptions(p, availableSite);
    assert.equal(offers.find(option => option.kind === 'catch').available, true);
    const run = startRun(p, availableSite, 'catch');
    const reef = p.reefs[availableSite];
    const fish = run.fish.filter(item => item.alive).slice(0, 4);
    assert.equal(fish.length, 4, `fixture needs four live fish at outing ${outing}`);
    run.cargo = fish.map((item, index) => ({ id: item.id, weight: 1, value: 28 }));
    run.removed = fish.length;
    for (const item of fish) reef.removed.push(item.id);
    p.totalRemoved += fish.length;

    // One cleanup is a common side activity. It pays ordinary cleanup income;
    // the separate $40 cleanup order still requires two cleared patches.
    const debrisId = `debris-${reef.cleaned.length}`;
    if (reef.cleaned.length < (SITES[availableSite].worksites?.debris.length ?? 0)) {
      reef.cleaned.push(debrisId);
      run.cleaned = 1;
    }
    const result = finish(p, run, { sell: 4, eat: 0, donate: 0 });
    rows.push({ outing, site: availableSite, earned: result.earned, expenses: result.expenses, contract: result.contract, sales: result.sales, cleanPay: result.cleanPay, starterGrant: result.starterGrant, sponsor: result.sponsor, cashAfter: p.cash, reputationAfter: p.reputation });
    assert.equal(result.sponsor, 0, 'recognition does not add sponsor cash');
    if (outing === 1) {
      assert.equal(result.sales, 112);
      assert.equal(result.contract, 45);
      assert.equal(result.cleanPay, 12);
      assert.equal(result.starterGrant, 20);
      assert.ok(p.campaign.characterFlags.includes('welcome-grant'));
    } else assert.equal(result.starterGrant, 0, 'the safe-sale grant is one-time');
    if (!scooterBoughtOnOuting && p.cash >= upgradeCost(p, 'scooter')) {
      assert.ok(buy(p, 'scooter'));
      scooterBoughtOnOuting = outing;
    }
  }
  assert.equal(scooterBoughtOnOuting, 3, 'the baseline fixture reaches the $420 scooter after three productive outings');
  assert.equal(upgradeLevel(p, 'scooter'), 1);
  t.diagnostic('ECONOMIC_FIXTURE ' + JSON.stringify({ outings: rows.length, scooterBoughtOnOuting, rows }));
});

test('research needs invitation and acceptance, then pays one funded assignment and repeat Monitoring inclusively', () => {
  const p = freshProfile(); p.tutorial = 1; p.reputation = 8;
  assert.equal(researchEligibility(p).eligible, false);
  assert.equal(approachResearch(p).ok, true);
  assert.equal(researchEligibility(p).eligible, false);
  assert.equal(acceptResearch(p).ok, true);
  const funded = startRun(p, 'gardens', 'research');
  assert.equal(funded.researchEligible, true); assert.equal(funded.researchFunded, true);
  addFirstSurveys(p, funded);
  const first = finish(p, funded);
  assert.equal(first.surveyPay, 36);
  assert.equal(first.researchTopUp, 29);
  assert.equal(first.surveyPay + first.researchTopUp, 65);
  assert.match(first.contractReason, /funded/i);
  assert.equal(p.campaign.researchCompleted, true);
  assert.equal(researchEligibility(p).eligible, true, 'survey access remains available after funding');
  assert.equal(contractOptions(p, 'gardens').find(option => option.kind === 'research').available, true);

  const monitoring = startRun(p, 'gardens', 'research');
  assert.equal(monitoring.researchFunded, false);
  addFirstSurveys(p, monitoring);
  const repeat = finish(p, monitoring);
  assert.equal(repeat.surveyPay, 12);
  assert.equal(repeat.researchTopUp, 26);
  assert.equal(repeat.surveyPay + repeat.researchTopUp, 38);
  assert.match(repeat.contractReason, /monitoring/i);
});

test('exhausted permanent work has explicit reasons and cannot be selected at launch', () => {
  const p = freshProfile(); p.tutorial = 1;
  const reef = p.reefs.gardens;
  reef.removed = Array.from({ length: reefFishHomes(SITES.gardens, SITES.gardens.seed).length }, (_, i) => `fish-${i}`);
  reef.cleaned = SITES.gardens.worksites.debris.map((_, i) => `debris-${i}`);
  reef.restored = Object.fromEntries(SITES.gardens.worksites.coral.map((_, i) => [`coral-${i}`, 1]));
  for (const kind of ['catch', 'cleanup', 'restore']) {
    const option = contractOptions(p, 'gardens').find(candidate => candidate.kind === kind);
    assert.equal(option.available, false);
    assert.ok(option.reason.length > 15);
    assert.throws(() => startRun(p, 'gardens', kind), new RegExp(option.reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal(contractOptions(p, 'gardens').find(option => option.kind === 'none').available, true);
  assert.doesNotThrow(() => startRun(p, 'gardens', 'none'));
});

test('cleanup and restoration orders pay only their completed objectives and report the breakdown', () => {
  const p = freshProfile(); p.tutorial = 1; p.cash = 2000;
  const cleanup = startRun(p, 'gardens', 'cleanup');
  assert.equal(cleanup.order, 'cleanup');
  cleanup.cleaned = 2;
  p.reefs.gardens.cleaned.push('debris-0', 'debris-1'); p.totalCleaned += 2;
  const cleanupResult = finish(p, cleanup);
  assert.equal(cleanupResult.contract, 40);
  assert.equal(cleanupResult.cleanPay, 24);
  assert.match(cleanupResult.contractReason, /complete/i);

  const restore = startRun(p, 'gardens', 'restore');
  restore.restored = 2;
  p.reefs.gardens.restored['coral-0'] = p.day; p.reefs.gardens.restored['coral-1'] = p.day; p.totalRestored += 2;
  const restoreResult = finish(p, restore);
  assert.equal(restoreResult.contract, 45);
  assert.equal(restoreResult.restorationPay, 30);
  assert.match(restoreResult.contractReason, /complete/i);
});

test('event registration day stays isolated by save slot through reload', () => {
  const store = new SaveStore(new MemoryStorage());
  const first = freshProfile(1), second = freshProfile(2);
  first.day = 3; first.eventRegistrationDay = 3;
  second.day = 3;
  store.save(first); store.save(second);
  assert.equal(store.load(1).eventRegistrationDay, 3);
  assert.equal(store.load(2).eventRegistrationDay, undefined);
  assert.equal(validateProfile(store.load(1)).eventRegistrationDay, 3);
});

test('new night Passage runs use revision-two terrain for safe entry and flow-gauge work', () => {
  const p = freshProfile(); p.tutorial = 1; p.totalRemoved = 6; p.cash = 3000;
  assert.ok(buy(p, 'air')); assert.ok(buy(p, 'air')); assert.ok(buy(p, 'torch'));
  const run = startRun(p, 'passage', 'none', false, true);
  const site = siteForRun(run);
  assert.equal(run.siteRevision, 2);
  assert.equal(run.night, true);
  assert.ok(run.p.y >= floorHeight(run.p.x, run.p.z, site));
  for (const id of ['survey-0', 'survey-1']) assert.ok(run.jobs.some(job => job.id === id), `${id} flow gauge exists`);
  for (const job of run.jobs.filter(item => ['survey-0', 'survey-1'].includes(item.id))) assert.ok(job.p.y >= floorHeight(job.p.x, job.p.z, site));
});

test('schema-1 saves with survey history or active research are grandfathered without losing progress', () => {
  const surveyed = freshProfile();
  surveyed.reefs.gardens.surveys = 1; surveyed.reefs.gardens.surveyedStations = ['survey-0'];
  const before = structuredClone(surveyed);
  const loaded = validateProfile(surveyed);
  assert.equal(surveyed.campaign, undefined, 'validation does not mutate the source object');
  assert.deepEqual(surveyed, before);
  assert.equal(loaded.campaign.researchAccepted, true);
  assert.deepEqual(loaded.reefs.gardens.surveyedStations, ['survey-0']);

  const active = freshProfile(); active.tutorial = 1; active.active = startRun(active, 'gardens', 'catch');
  active.active.order = 'research'; delete active.active.researchEligible; delete active.active.researchFunded;
  const oldRunId = active.active.id;
  const migrated = validateProfile(active);
  assert.equal(migrated.active.researchEligible, true);
  assert.equal(migrated.campaign.researchAccepted, true);
  assert.equal(migrated.active.id, oldRunId);
  assert.deepEqual(active.active.order, 'research', 'validation does not mutate the suspended caller');
});

test('boat cleanup pays $5 once, and saved filleting cannot settle a pending outing twice', () => {
  const p = freshProfile(); p.tutorial = 1; p.day = 4; p.totalRemoved = 12;
  const run = startRun(p, 'mangrove', 'none');
  run.encounter = { kind: 'rubbish', phase: 'abandoned', start: 0, p: { x: 0, y: 0, z: 0 }, cleanProgress: 0, rewarded: false };
  assert.equal(clearBoat(run), true);
  const boatResult = finish(p, run);
  assert.equal(boatResult.boatPay, 5);
  assert.equal(boatResult.earned, 5);
  assert.equal(clearBoat(run), false);
  assert.throws(() => settleRun(p, run, { sell: 0, eat: 0, donate: 0 }, []));

  p.tutorial = 1;
  const next = startRun(p, 'gardens', 'none');
  next.cargo = [{ id: 'fillet-fixture', weight: 1, value: 100 }];
  new Simulation(p, next).finish(false);
  prepareFillets(p, .8);
  const store = new SaveStore(new MemoryStorage()); store.save(p);
  const resumed = store.load(1), pending = resumed.pending;
  assert.equal(pending.filletQuality, .8);
  const settled = settleRun(resumed, pending, { sell: 1, eat: 0, donate: 0 }, []);
  assert.equal(settled.filletBonus, 24);
  assert.throws(() => settleRun(resumed, pending, { sell: 1, eat: 0, donate: 0 }, []));
});

test('an already saved legacy restaurant outing keeps its promised $65 contract terms',()=>{
 const p=freshProfile();p.tutorial=1;const r=startRun(p,'gardens');delete r.siteRevision;delete r.researchEligible;delete r.researchFunded;
 r.cargo=Array.from({length:4},(_,i)=>({id:'legacy-'+i,value:25,weight:1}));r.removed=4;
 const loaded=validateProfile(p);const result=finish(loaded,loaded.active,{sell:4,eat:0,donate:0});assert.equal(result.contract,65);assert.equal(result.sales,100);
 assert.equal(startRun(loaded,'gardens','catch').siteRevision,2,'future outings use current terms');
});

test('selected logbook and its event registration survive reload without leaking to another slot',()=>{
 const memory=new MemoryStorage(),store=new SaveStore(memory),p=freshProfile(2);p.day=3;p.eventRegistrationDay=3;store.save(p);store.selectSlot(2);
 const reloaded=new SaveStore(memory);assert.equal(reloaded.selectedSlot(),2);assert.equal(reloaded.load(reloaded.selectedSlot()).eventRegistrationDay,3);assert.equal(reloaded.load(1).eventRegistrationDay,undefined);
 reloaded.selectSlot(9);assert.equal(reloaded.selectedSlot(),2);
});


test('bounded publication history keeps a new recognition objective visible at settlement',()=>{
 const p=freshProfile();p.tutorial=1;p.audience=100;p.reputation=4;p.published=Array(1000).fill('lionfish');
 assert.equal(acceptMilestoneOpportunity(p,'recognition-80').ok,true);
 const r=startRun(p,'gardens','none');r.clips=[{id:'new-wildlife',kind:'turtle',title:'A peaceful turtle',caption:'New highlight',quality:90}];
 const result=finish(p,r,{sell:0,eat:0,donate:0},['new-wildlife']);assert.equal(result.recognition.length,1);assert.equal(p.published.length,1000);assert.equal(result.sponsor,0);
});

test('advanced service waits for field experience, retains old gear and is affordable after first purchase',()=>{
 const p=freshProfile();p.cash=10000;assert.equal(buy(p,'fins'),true);assert.equal(buy(p,'fins'),true);
 const before=structuredClone(p);assert.equal(buy(p,'fins'),false);assert.deepEqual(p,before);
 p.day=5;p.reputation=12;assert.equal(buy(p,'fins'),true);assert.equal(buy(p,'fins'),false);
 p.day=8;p.reputation=20;assert.equal(buy(p,'fins'),true);p.day=11;p.reputation=28;assert.equal(buy(p,'fins'),true);
 const legacy=freshProfile();legacy.upgrades=['scooter'];legacy.upgradeLevels={scooter:5};assert.equal(upgradeLevel(validateProfile(legacy),'scooter'),5);
 assert.equal(upgradeCost(freshProfile(),'scooter'),420);
});

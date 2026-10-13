import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProfile, buy, validateProfile } from '../build/game/profile.js';
import { Simulation, startRun, settleRun, prepareFillets } from '../build/game/simulation.js';
import { SITES, UPGRADES, capacity, reefFishHomes, siteUnlocked, upgradeCost, upgradeLevel, upgradeServiceRequirement } from '../build/game/data.js';
import { contractOptions } from '../build/game/campaign.js';

const SITE_IDS = Object.keys(SITES);
const PURCHASE_ORDER = ['tube', 'scooter', 'fins', 'spear', 'air', 'camera', 'kit', 'battery', 'torch'];
const CURRENT_FACTORS = [1, .55, .7, .85, 1.05];
const PROPOSED_FACTORS = [1, .2, .25, .3, .4];
const SERVICE_GATES = [undefined, { day: 5, reputation: 12 }, { day: 8, reputation: 20 }, { day: 11, reputation: 28 }];

function costAt(upgrade, currentRank, factors) {
  return Math.round(upgrade.cost * factors[currentRank] / 5) * 5;
}

function buyAffordable(p, { factors, productionApi }) {
  const bought = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of PURCHASE_ORDER) {
      const rank = upgradeLevel(p, id);
      if (rank >= 5) continue;
      const upgrade = UPGRADES.find(item => item.id === id);
      if (productionApi) {
        if (buy(p, id)) {
          bought.push({ id, rank: rank + 1 });
          changed = true;
        }
        continue;
      }
      if (upgrade.requires && upgradeLevel(p, upgrade.requires) < (upgrade.requiredLevel ?? 1)) continue;
      const cost = costAt(upgrade, rank, factors);
      if (p.cash < cost) continue;
      p.cash -= cost;
      p.upgradeLevels ??= {};
      p.upgradeLevels[id] = rank + 1;
      if (!p.upgrades.includes(id)) p.upgrades.push(id);
      bought.push({ id, rank: rank + 1 });
      changed = true;
    }
  }
  return bought;
}

function chooseSite(p) {
  const available = SITE_IDS
    .filter(id => siteUnlocked(p, id))
    .sort((a, b) => p.reefs[a].visits - p.reefs[b].visits || SITE_IDS.indexOf(a) - SITE_IDS.indexOf(b))[0];
  return available;
}

function simulate({ fillTube, factors, productionApi, outingCount = 15 }) {
  const p = freshProfile();
  p.tutorial = 1; // Isolate campaign economics from the first-dive lesson.
  const rows = [];

  for (let outing = 1; outing <= outingCount; outing++) {
    const siteId = chooseSite(p);
    assert.ok(siteId, `no unlocked site with a four-fish order on outing ${outing}`);
    const site = SITES[siteId];
    const options = contractOptions(p, siteId);
    const order = ['catch', 'cleanup', 'restore', 'none'].find(kind => options.find(option => option.kind === kind)?.available);
    const run = startRun(p, siteId, order);
    const reef = p.reefs[siteId];
    const preDiveCapacity = capacity(p);
    const plannedCatch = fillTube ? preDiveCapacity : 4;
    const fish = run.fish.filter(item => item.alive).slice(0, plannedCatch);
    if (order === 'catch') assert.ok(fish.length >= 4, `${siteId} needs four live fish to qualify for its catch order`);
    run.cargo = fish.map(item => ({ id: item.id, weight: item.weight, value: Math.round(14 + item.weight * 17) }));
    run.removed = fish.length;
    for (const item of fish) reef.removed.push(item.id);
    p.totalRemoved += fish.length;

    // Clear one (contract-sized strategy) or two (tube-filling strategy)
    // actual debris sites and one permanent coral plot on each outing.
    const debrisCount = Math.min(fillTube ? 2 : 1, site.worksites.debris.length - reef.cleaned.length);
    const debrisIds = Array.from({ length: debrisCount }, (_, i) => `debris-${reef.cleaned.length + i}`);
    reef.cleaned.push(...debrisIds);
    p.totalCleaned += debrisCount;
    run.cleaned = debrisCount;
    const coralCount = Math.min(run.fragments, site.worksites.coral.length - Object.keys(reef.restored).length, 1);
    for (let i = 0; i < coralCount; i++) reef.restored[`coral-${Object.keys(reef.restored).length}`] = p.day;
    p.totalRestored += coralCount;
    run.restored = coralCount;

    new Simulation(p, run).finish(false);
    if (fish.length) prepareFillets(p, .75); // Assumed quality input for the model; not a human cut or playtest.
    const result = settleRun(p, run, { sell: fish.length, eat: 0, donate: 0 }, []);
    const cashAfterSettlement = p.cash;
    const bought = buyAffordable(p, { factors, productionApi });
    rows.push({
      outing, site: siteId, order, sold: fish.length, capacity: preDiveCapacity,
      fishValues: fish.map(item => Math.round(14 + item.weight * 17)),
      sales: result.sales, contract: result.contract, cleanPay: result.cleanPay,
      restorationPay: result.restorationPay, filletBonus: result.filletBonus, expenses: result.expenses, earned: result.earned,
      cashAfterSettlement, bought, cashAfterPurchases: p.cash,
      removedTotal: p.totalRemoved, sitesUnlocked: SITE_IDS.filter(id => siteUnlocked(p, id))
    });
    assert.ok(fish.length <= preDiveCapacity, 'cargo never exceeds the pre-dive capacity');
    assert.equal(result.sales, fish.reduce((sum, item) => sum + Math.round(14 + item.weight * 17), 0));
    assert.equal(result.contract, order === 'catch' && fish.length >= 4 ? 45 : order === 'cleanup' && run.cleaned >= 2 ? 40 : order === 'restore' && run.restored >= 2 ? 45 : 0, 'only the selected objective pays its contract bonus');
    assert.ok(reef.cleaned.length <= site.worksites.debris.length, 'cleanup cannot exceed permanent authored debris');
    assert.ok(Object.keys(reef.restored).length <= site.worksites.coral.length, 'restoration cannot exceed permanent authored plots');
  }

  return { p, rows, fillTube, factors, productionApi };
}

test('15-outing economy comparison measures current versus proposed rank curve and gates', t => {
  const currentContract = simulate({ fillTube: false, factors: CURRENT_FACTORS, productionApi: false });
  const proposedContract = simulate({ fillTube: false, factors: PROPOSED_FACTORS, productionApi: true });
  const current = simulate({ fillTube: true, factors: CURRENT_FACTORS, productionApi: false });
  const proposed = simulate({ fillTube: true, factors: PROPOSED_FACTORS, productionApi: true });
  const firstRankCost = UPGRADES.reduce((sum, upgrade) => sum + upgrade.cost, 0);
  const curveTotal = factors => UPGRADES.reduce((sum, upgrade) => sum + factors.reduce((subtotal, factor) => subtotal + Math.round(upgrade.cost * factor / 5) * 5, 0), 0);
  const report = scenario => ({
    ranks: scenario.factors, purchaseApi: scenario.productionApi ? 'upgradeCost + buy + service gates' : 'pre-change explicit baseline model', outingGates: scenario.productionApi ? SERVICE_GATES : 'none',
    gearRanks: Object.fromEntries(UPGRADES.map(upgrade => [upgrade.id, upgradeLevel(scenario.p, upgrade.id)])),
    firstBuyOuting: Object.fromEntries(UPGRADES.map(upgrade => [upgrade.id, scenario.rows.find(row => row.bought.some(item => item.id === upgrade.id))?.outing ?? null])),
    maxRankOuting: Object.fromEntries(UPGRADES.map(upgrade => [upgrade.id, scenario.rows.find(row => row.bought.some(item => item.id === upgrade.id && item.rank === 5))?.outing ?? null])),
    soldFish: scenario.rows.reduce((sum, row) => sum + row.sold, 0),
    salesTotal: scenario.rows.reduce((sum, row) => sum + row.sales, 0),
    assumedFilletBonus: scenario.rows.reduce((sum, row) => sum + row.filletBonus, 0),
    contractTotal: scenario.rows.reduce((sum, row) => sum + row.contract, 0),
    ordinaryWorkPay: scenario.rows.reduce((sum, row) => sum + row.cleanPay + row.restorationPay, 0),
    expensesTotal: scenario.rows.reduce((sum, row) => sum + row.expenses, 0),
    earnedTotal: scenario.rows.reduce((sum, row) => sum + row.earned, 0),
    productiveCatchOutings: scenario.rows.filter(row => row.sold > 0).length,
    endingCash: scenario.p.cash, endingDebt: scenario.p.debt,
    sitesVisited: SITE_IDS.filter(id => scenario.p.reefs[id].visits > 0),
    permanentDebrisRemaining: Object.fromEntries(SITE_IDS.map(id => [id, SITES[id].worksites.debris.length - scenario.p.reefs[id].cleaned.length])),
    permanentCoralRemaining: Object.fromEntries(SITE_IDS.map(id => [id, SITES[id].worksites.coral.length - Object.keys(scenario.p.reefs[id].restored).length]))
  });
  const productionCurveTotal = UPGRADES.reduce((sum, upgrade) => sum + Array.from({ length: 5 }, (_, level) => {
    const p = freshProfile(); p.upgrades = [upgrade.id]; p.upgradeLevels = { [upgrade.id]: level };
    return upgradeCost(p, upgrade.id);
  }).reduce((subtotal, cost) => subtotal + cost, 0), 0);
  t.diagnostic('ECONOMIC_PACING_COMPARISON ' + JSON.stringify({ startCash: 80, firstRankCost, currentAllRanksCost: curveTotal(CURRENT_FACTORS), proposedAllRanksCost: curveTotal(PROPOSED_FACTORS), productionCurveTotal, currentContract: report(currentContract), proposedContract: report(proposedContract), currentFillTube: report(current), proposedFillTube: report(proposed) }));
  for (const scenario of [currentContract, proposedContract, current, proposed]) {
    assert.deepEqual(SITE_IDS.filter(id => scenario.p.reefs[id].visits > 0).sort(), [...SITE_IDS].sort(), 'the fixture reaches every authored site');
    assert.equal(scenario.p.day, 16);
  }
  for (const scenario of [currentContract, proposedContract, current, proposed]) for (const row of scenario.rows) {
    assert.equal(row.filletBonus, Math.round(row.sales * .75 * .3), 'assumed 0.75 fillet quality returns 22.5% of sold value');
  }
  assert.equal(current.rows.filter(row => row.sold > 0).length, 10, 'current capacity strategy exhausts the initial 120 seeded fish in ten outings');
  assert.equal(proposed.rows.filter(row => row.sold > 0).length, 10);
  assert.equal(current.rows.reduce((sum, row) => sum + row.sold, 0), 120);
  assert.equal(proposed.rows.reduce((sum, row) => sum + row.sold, 0), 120);
  assert.ok(proposed.p.cash > current.p.cash, 'the lower gated curve leaves a larger end-of-fixture reserve');
  assert.ok(currentContract.rows.every(row => row.sold === 4) && proposedContract.rows.every(row => row.sold === 4), 'the contract-sized routes remain productive for 15 outings');
  assert.equal(curveTotal(CURRENT_FACTORS), 7350);
  assert.equal(curveTotal(PROPOSED_FACTORS), 3835);
  assert.equal(productionCurveTotal, curveTotal(PROPOSED_FACTORS), 'production upgradeCost matches the proposed curve');
  const serviceProbe = freshProfile(); serviceProbe.upgrades = ['tube']; serviceProbe.upgradeLevels = { tube: 1 };
  assert.equal(upgradeServiceRequirement(serviceProbe, 'tube').available, true, 'rank 2 remains available without a gate');
  serviceProbe.upgradeLevels.tube = 2;
  assert.deepEqual(upgradeServiceRequirement(serviceProbe, 'tube'), { available: false, reason: 'Level 3 service opens on day 5 with 12 conservation reputation.' });
  const existingGear = freshProfile(); existingGear.upgrades = ['tube', 'camera']; existingGear.upgradeLevels = { tube: 4, camera: 2 };
  const migratedGear = validateProfile(existingGear);
  assert.equal(upgradeLevel(migratedGear, 'tube'), 4, 'price and service changes do not reset owned ranks');
  assert.equal(upgradeLevel(migratedGear, 'camera'), 2);
  assert.equal(UPGRADES.filter(upgrade => upgradeLevel(proposedContract.p, upgrade.id) === 5).length, 6, 'the contract-sized proposal fully upgrades most equipment within 15 outings');
  assert.equal(Object.values(proposed.p.upgradeLevels).filter(rank => rank === 5).length, UPGRADES.length, 'the capacity-max proposal reaches every rank-five upgrade by its tenth outing');
  assert.equal(Math.max(...UPGRADES.map(upgrade => proposed.rows.find(row => row.bought.some(item => item.id === upgrade.id && item.rank === 5))?.outing ?? 0)), 10);
});

test('four returning fish restore a viable repeating catch contract without restoring permanent work', t => {
  const values = [];
  for (const siteId of SITE_IDS) {
    const p = freshProfile(); p.tutorial = 1; p.totalRemoved = 100;
    const run = startRun(p, siteId, 'none');
    values.push(...run.fish.slice(0, 4).map(fish => Math.round(14 + fish.weight * 17)));
  }
  const fishValue = values.reduce((sum, value) => sum + value, 0) / values.length;
  const repeatCycle = returningFish => {
    const sale = returningFish * fishValue;
    const fillet = Math.round(sale * .75 * .3);
    const contract = returningFish >= 4 ? 45 : 0;
    const outingNet = sale + fillet + contract - 28;
    return { returningFish, fishValue: Number(fishValue.toFixed(2)), sale: Number(sale.toFixed(2)), fillet, contract, outingNet, threeEmptyDiveCosts: 84, fourVisitCycleNet: Number((outingNet - 84).toFixed(2)) };
  };
  const currentThree = repeatCycle(3);
  const candidateFour = repeatCycle(4);
  t.diagnostic('REPEAT_CATCH_RECOVERY_ESTIMATE ' + JSON.stringify({ sampledFishValues: values, assumedFilletQuality: .75, currentThree, candidateFour }));
  assert.ok(currentThree.fourVisitCycleNet < 0, 'three returning fish miss the four-sale order and do not cover the full recovery cycle');
  assert.ok(candidateFour.fourVisitCycleNet > 0, 'four returning fish qualify for the order and cover the recovery cycle');
  assert.equal(candidateFour.contract, 45);
});

test('depleted site recovers a four-fish order after six visits while permanent work stays exhausted', () => {
  const p = freshProfile(); p.tutorial = 1; p.totalRemoved = 24;
  const reef = p.reefs.gardens;
  const site = SITES.gardens;
  reef.visits = 2;
  reef.removed = reefFishHomes(site, site.seed).map((_, i) => `fish-${i}`);
  reef.cleaned = site.worksites.debris.map((_, i) => `debris-${i}`);
  reef.restored = Object.fromEntries(site.worksites.coral.map((_, i) => [`coral-${i}`, 1]));
  p.totalCleaned = reef.cleaned.length;
  p.totalRestored = Object.keys(reef.restored).length;
  const cleanupBefore = [...reef.cleaned];
  const restorationBefore = structuredClone(reef.restored);

  for (let visit = 0; visit < 6; visit++) {
    const options = contractOptions(p, 'gardens');
    const catchAvailable = options.find(option => option.kind === 'catch').available;
    const expectedCatch = visit === 2;
    assert.equal(catchAvailable, expectedCatch, `catch contract availability on depleted-site visit ${visit + 1}`);
    assert.equal(options.find(option => option.kind === 'cleanup').available, false);
    assert.equal(options.find(option => option.kind === 'restore').available, false);
    const run = startRun(p, 'gardens', expectedCatch ? 'catch' : 'none');
    const returning = run.fish.filter(item => item.alive);
    if (expectedCatch) {
      assert.equal(returning.length, 4);
      run.cargo = returning.map(item => ({ id: item.id, weight: item.weight, value: Math.round(14 + item.weight * 17) }));
      run.removed = returning.length;
      reef.removed.push(...returning.map(item => item.id));
      p.totalRemoved += returning.length;
    } else assert.equal(returning.length, 0);
    new Simulation(p, run).finish(false);
    if (run.cargo.length) prepareFillets(p, .75);
    const result = settleRun(p, run, { sell: run.cargo.length, eat: 0, donate: 0 }, []);
    if (expectedCatch) assert.equal(result.contract, 45);
    assert.deepEqual(reef.cleaned, cleanupBefore);
    assert.deepEqual(reef.restored, restorationBefore);
  }

  assert.equal(reef.visits, 8);
  assert.equal(contractOptions(p, 'gardens').find(option => option.kind === 'catch').available, true, 'the next return cohort restores contract eligibility');
  assert.equal(contractOptions(p, 'gardens').find(option => option.kind === 'cleanup').available, false, 'debris remains permanently cleared');
  assert.equal(contractOptions(p, 'gardens').find(option => option.kind === 'restore').available, false, 'coral plots remain permanently planted');
  const next = startRun(p, 'gardens', 'catch');
  assert.equal(next.fish.filter(item => item.alive).length, 4);
});

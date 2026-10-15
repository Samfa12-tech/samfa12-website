import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProfile, validateProfile, SaveStore, MemoryStorage } from '../build/game/profile.js';
import { Simulation, startRun, settleRun } from '../build/game/simulation.js';
import { SITES, freePoint, floorHeight, siteUnlocked, siteUnlockText, reefFishHomes, siteForRun } from '../build/game/data.js';
import { recoveryForRun, recoveryFromProgress, recoveryPopulationShare } from '../build/game/reef-recovery.js';
import { clearSegment, homeRoute, pathLength } from '../build/game/navigation.js';
import { vec, distance } from '../build/game/math.js';

const NEW_SITES = ['mangrove', 'cenote', 'harbour'];
const UNLOCKS = { mangrove: 12, cenote: 26, harbour: 42 };

function profileReady(id) {
    const p = freshProfile();
    p.totalRemoved = 50;
    assert.ok(siteUnlocked(p, id));
    return p;
}

function findHuntPosition(sim, fish) {
    const offsets = [[0, -2], [2, 0], [0, 2], [-2, 0], [1.4, -1.4], [1.4, 1.4], [-1.4, 1.4], [-1.4, -1.4]];
    for (const [dx, dz] of offsets) {
        const p = vec(fish.p.x + dx, fish.p.y, fish.p.z + dz);
        if (distance(p, fish.p) > 3 || !freePoint(p, sim.site, .8) || !clearSegment(p, fish.p, sim.site)) continue;
        const delta = vec(fish.p.x - p.x, fish.p.y - p.y, fish.p.z - p.z);
        const horizontal = Math.hypot(delta.x, delta.z);
        sim.run.p = p;
        sim.run.velocity = vec();
        sim.run.yaw = Math.atan2(delta.x, delta.z);
        sim.run.pitch = -Math.atan2(delta.y, horizontal);
        return true;
    }
    return false;
}

function finishProductiveVisit(profile, id, removals) {
    const run = startRun(profile, id);
    run.removed = removals;
    for (let i = 0; i < removals; i++) profile.reefs[id].removed.push(`fixture-${run.day}-${i}`);
    profile.totalRemoved += removals;
    const sim = new Simulation(profile, run);
    sim.finish(false);
    settleRun(profile, run, { sell: 0, eat: 0, donate: 0 }, []);
    return run;
}

test('new reefs have distinct authored sites and progressive removal or reputation unlocks', () => {
    const names = new Set();
    for (const id of NEW_SITES) {
        const p = freshProfile();
        assert.equal(siteUnlocked(p, id), false);
        assert.match(siteUnlockText(p, id), new RegExp(String(UNLOCKS[id])));
        assert.ok(SITES[id].shortDescription);
        assert.equal(SITES[id].label, SITES[id].name);
        names.add(SITES[id].name);
        p.totalRemoved = UNLOCKS[id];
        assert.equal(siteUnlocked(p, id), true);
        assert.ok(startRun(p, id));
    }
    assert.deepEqual([...names], ['Mangrove Reach', 'Azure Cenote', 'Rusted Harbour']);
});

test('all new sites start deterministically with safe targets, jobs, and a route home', () => {
    for (const id of NEW_SITES) {
        const profile = profileReady(id);
        const run = startRun(profile, id);
        const site = SITES[id];
        assert.ok(freePoint(run.p, site, .8), `${id} entry`);
        assert.ok(run.p.y > floorHeight(run.p.x, run.p.z, site));
        assert.equal(run.fish.length, 24, `${id} fish count`);
        assert.equal(run.jobs.filter(j => j.kind === 'debris').length, site.worksites.debris.length);
        assert.equal(run.jobs.filter(j => j.kind === 'coral').length, site.worksites.coral.length);
        assert.equal(run.jobs.filter(j => j.kind === 'survey').length, site.worksites.surveys.length + 2);
        for (const fish of run.fish) assert.ok(freePoint(fish.p, site, .3), `${id}/${fish.id}`);
        for (const animal of run.animals) assert.ok(freePoint(animal.p, site, .3), `${id}/${animal.id}`);
        for (const job of run.jobs) {
            assert.ok(freePoint(job.p, site, 0), `${id}/${job.id}`);
            const route = homeRoute(job.p, site);
            assert.ok(pathLength(route) >= distance(route[0], route.at(-1)) - .01, `${id}/${job.id} route length`);
            for (let i = 1; i < route.length; i++) assert.ok(clearSegment(route[i - 1], route[i], site), `${id}/${job.id} route segment ${i}`);
        }
        const repeat = startRun(profileReady(id), id);
        assert.deepEqual(repeat.fish.map(f => f.home), run.fish.map(f => f.home));
        assert.deepEqual(repeat.jobs.map(j => [j.id, j.p]), run.jobs.map(j => [j.id, j.p]));
    }
});

test('each new site supports a reachable manual lionfish hunt', () => {
    for (const id of NEW_SITES) {
        const profile = profileReady(id), sim = new Simulation(profile, startRun(profile, id));
        const fish = sim.run.fish.find(f => f.alive);
        assert.ok(findHuntPosition(sim, fish), `${id} has no clear hunt angle`);
        sim.strike(1);
        assert.equal(sim.run.removed, 1, `${id} hunt did not connect`);
        assert.equal(fish.alive, false, `${id} target remains alive`);
        assert.equal(sim.run.recoveryStage, 0, `${id} ecology changed during the outing`);
    }
});

test('legacy terrain stays exact while new sites use their own ground profiles', () => {
    const oldPassage = siteForRun({ site: 'passage' });
    const currentPassage = siteForRun({ site: 'passage', siteRevision: 2 });
    for (const [x, z] of [[0, 0], [34, -40], [-27, 18], [41, 52]]) {
        assert.equal(floorHeight(x, z), floorHeight(x, z, siteForRun({site:'gardens',siteRevision:2})));
        assert.equal(floorHeight(x, z), floorHeight(x, z, oldPassage));
    }
    assert.notEqual(floorHeight(0, 30, oldPassage), floorHeight(0, 30, currentPassage), 'new Passage uses the revision-two shelf and channel terrain');
    assert.notEqual(floorHeight(0, 30, 'mangrove'), floorHeight(0, 30, 'cenote'));
    assert.notEqual(floorHeight(0, 30, 'cenote'), floorHeight(0, 30, 'harbour'));
    for (const id of NEW_SITES) assert.equal(reefFishHomes(SITES[id], 19).length, 24);
});

test('recovery waits for productive completed visits and grows more after visit three', () => {
    const p = profileReady('mangrove'), reef = p.reefs.mangrove;
    assert.equal(recoveryFromProgress({ ...reef, visits: 100, productiveVisits: 0 }), 0, 'idle visits cannot regrow the population');
    const clearCounts = [2, 5, 9, 13, 17];
    const removalsThisVisit = [2, 3, 4, 4, 4];
    for (let i = 0; i < removalsThisVisit.length; i++) {
        finishProductiveVisit(p, 'mangrove', removalsThisVisit[i]);
        assert.equal(reef.productiveVisits, i + 1);
        assert.equal(reef.removed.length, clearCounts[i]);
        assert.equal(recoveryFromProgress(reef), i + 1);
    }
    assert.ok(recoveryPopulationShare(3) > recoveryPopulationShare(2) * 2);
    assert.ok(recoveryPopulationShare(5) > recoveryPopulationShare(3));
});

test('empty completed outings do not advance recovery or productive-visit count', () => {
    const p = profileReady('cenote'), reef = p.reefs.cenote;
    reef.visits = 4;
    const run = startRun(p, 'cenote');
    new Simulation(p, run).finish(false);
    settleRun(p, run, { sell: 0, eat: 0, donate: 0 }, []);
    assert.equal(reef.visits, 5);
    assert.equal(reef.productiveVisits, 0);
    assert.equal(recoveryFromProgress(reef), 0);
});

test('a run recovery snapshot stays fixed through kills, save, reload, and resume', () => {
    const p = profileReady('harbour'), reef = p.reefs.harbour;
    reef.removed = ['old-0', 'old-1', 'old-2', 'old-3', 'old-4'];
    reef.visits = 2;
    reef.productiveVisits = 2;
    const run = startRun(p, 'harbour');
    assert.equal(run.recoveryStage, 2);
    run.removed = 4;
    reef.removed.push('current-0', 'current-1', 'current-2', 'current-3');
    assert.equal(recoveryForRun(run, reef), 2);
    const store = new SaveStore(new MemoryStorage());
    store.save(p);
    const loaded = store.load(1);
    assert.equal(loaded.active.recoveryStage, 2);
    const resumed = new Simulation(loaded, loaded.active);
    loaded.reefs.harbour.removed.push('more-current-0', 'more-current-1');
    assert.equal(recoveryForRun(resumed.run, loaded.reefs.harbour), 2);
});

test('legacy two-site career migration retains history and derives a pre-outing snapshot', () => {
    const p = freshProfile();
    p.reefs.gardens.removed = ['old-0', 'old-1'];
    p.reefs.gardens.cleaned = ['debris-0'];
    p.reefs.gardens.restored = { 'coral-0': 2 };
    p.reefs.gardens.visits = 3;
    delete p.reefs.gardens.productiveVisits;
    const run = startRun(p, 'gardens');
    run.removed = 1;
    p.reefs.gardens.removed.push(run.fish[0].id);
    delete run.recoveryStage;
    const legacy = structuredClone(p);
    delete legacy.reefs.mangrove;
    delete legacy.reefs.cenote;
    delete legacy.reefs.harbour;
    delete legacy.reefs.gardens.productiveVisits;
    delete legacy.reefs.passage.productiveVisits;
    const restored = validateProfile(legacy);
    assert.deepEqual(restored.reefs.gardens.removed, legacy.reefs.gardens.removed);
    assert.deepEqual(restored.reefs.gardens.cleaned, ['debris-0']);
    assert.deepEqual(restored.reefs.gardens.restored, { 'coral-0': 2 });
    assert.deepEqual(restored.reefs.mangrove.removed, []);
    assert.equal(restored.active.id, run.id);
    assert.equal(restored.active.removed, 1);
    assert.equal(restored.active.recoveryStage, 1, 'the unfinished outing clearance is excluded');
});

test('malformed new recovery fields and incomplete five-site saves are rejected', () => {
    const badCounter = freshProfile();
    badCounter.reefs.cenote.productiveVisits = 1.5;
    assert.throws(() => validateProfile(badCounter));
    const badInventory = freshProfile();
    delete badInventory.reefs.harbour;
    assert.throws(() => validateProfile(badInventory));
    const badSnapshot = freshProfile();
    badSnapshot.totalRemoved = 50;
    startRun(badSnapshot, 'harbour').recoveryStage = 6;
    assert.throws(() => validateProfile(badSnapshot));
});

test('older settings enable the new instrument HUD and keep a default watch key', () => {
    const storage = new MemoryStorage(), store = new SaveStore(storage);
    storage.setItem('reef-sweep:v1:settings', JSON.stringify({ quality: 'balanced', keys: { forward: 'KeyW' } }));
    const settings = store.settings();
    assert.equal(settings.instrumentHud, true);
    assert.equal(settings.keys.watch, 'KeyV');
});

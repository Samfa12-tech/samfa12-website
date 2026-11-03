import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateResults, summariseRuns, fpsEstimate, isPublicHardwareIdentified} from '../assets/horde-benchmark-summary.js';

const run = (fps, index, extra = {}) => ({resultId:`run-${index}`, dateUtc:'2026-11-03', platform:'Windows', model:'Unknown', gpu:'NVIDIA GeForce RTX 5050 Laptop GPU', frameMedianMs:1000/fps, cpuTimingScope:'completed-owning-render-entry-through-present', internal:'1920 × 1080', output:'1920 × 1080', profile:'custom', backend:'RT', water:'high', dielectric:'high', fire:'High', shaderPair:'same-shaders', build:'build-a', ...extra});

test('one hardware summary averages run estimates equally, not frame sample counts', () => {
  const groups = aggregateResults([run(100,0,{sampleCount:100000}),run(120,1,{sampleCount:5,build:'build-b'})]);
  assert.equal(groups.length,1);
  assert.equal(groups[0].primary.stats.mean,110);
  assert.equal(groups[0].primary.stats.low,100);
  assert.ok(Math.abs(groups[0].primary.stats.high-120)<1e-8);
  assert.equal(groups[0].primary.stats.used,2);
});

test('14 phone runs make one model summary; an extreme run stays available but is excluded from average', () => {
  const rows = Array.from({length:14},(_,i)=>run(i===13?200:30+(i%3),i,{platform:'Android',model:i%2?'SM-S948B':'Galaxy S26 Ultra',gpu:'Adreno (TM) 840'}));
  const groups = aggregateResults(rows), stats = groups[0].primary.stats;
  assert.equal(groups.length,1);
  assert.equal(groups[0].title,'Galaxy S26 Ultra');
  assert.equal(groups[0].rows.length,14);
  assert.equal(stats.used,13);
  assert.deepEqual(stats.excludedIds,['run-13']);
  assert.ok(stats.mean>=30 && stats.mean<=32);
  assert.ok(Math.abs(stats.low-30)<1e-8);
  assert.equal(stats.high,32);
});

test('different resolutions and quality settings stay separate within one hardware card', () => {
  const groups = aggregateResults([run(100,0),run(110,1),run(200,2,{internal:'960 × 540'})]);
  assert.equal(groups.length,1);
  assert.equal(groups[0].settings.length,2);
  assert.equal(groups[0].primary.rows.length,2);
  assert.equal(groups[0].primary.stats.mean,105);
  assert.equal(groups[0].settings[1].stats.mean,200);
});

test('small samples, missing timings and identical timings have explicit conservative behavior', () => {
  assert.equal(summariseRuns([run(20,0),run(200,1)]).used,2);
  const repeated = Array.from({length:6},(_,i)=>run(i===5?300:60,i));
  assert.deepEqual(summariseRuns(repeated).excludedIds,['run-5']);
  assert.equal(summariseRuns(Array.from({length:6},(_,i)=>run(60,i))).used,6);
  const missing = summariseRuns([run(60,0),run(60,1,{frameMedianMs:null})]);
  assert.ok(Math.abs(missing.mean-60)<1e-8);
  assert.equal(missing.missing,1);
  assert.equal(summariseRuns([run(60,0,{frameMedianMs:null})]).mean,null);
  assert.equal(fpsEstimate(run(60,0,{frameMedianMs:Number.MIN_VALUE})),null);
});

test('phone identity, GPU identity and missing phone model do not merge unrelated hardware', () => {
  const groups = aggregateResults([run(60,0,{platform:'Android',model:'Phone A'}),run(60,1,{platform:'Android',model:'Phone B'}),run(60,2,{platform:'Android',model:'Unknown'}),run(60,3,{platform:'Android',model:'Unknown'}),run(60,4),run(60,5,{gpu:'NVIDIA GeForce RTX 5060 Laptop GPU'})]);
  assert.equal(groups.length,4);
});

test('S24 Ultra model code and friendly name aggregate together, separately from S26 Ultra', () => {
  const groups=aggregateResults([
    run(40,0,{platform:'Android',model:'SM-S928B',gpu:'Adreno (TM) 750'}),
    run(42,1,{platform:'Android',model:'Samsung Galaxy S24 Ultra',gpu:'Adreno (TM) 750'}),
    run(70,2,{platform:'Android',model:'SM-S948B',gpu:'Adreno (TM) 840'}),
  ]);
  assert.equal(groups.length,2);
  assert.equal(groups[0].title,'Galaxy S24 Ultra');
  assert.equal(groups[0].rows.length,2);
  assert.equal(groups[1].title,'Galaxy S26 Ultra');
});


test('public summaries need a GPU and mobile model, while Windows needs no PC model', () => {
  assert.equal(isPublicHardwareIdentified(run(60,0)),true);
  for (const gpu of [null, '', 'Unknown']) {
    assert.equal(isPublicHardwareIdentified(run(60,1,{gpu})),false);
    assert.equal(aggregateResults([run(60,1,{gpu})]).length,0);
  }
  assert.equal(isPublicHardwareIdentified(run(60,2,{platform:'Android',model:'Unknown'})),false);
  assert.equal(isPublicHardwareIdentified(run(60,3,{platform:'Android',model:'SM-S948B'})),true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {fpsEstimate, hardwareName, matchesHardware} from '../assets/horde-benchmark-stats.js';

test('FPS is a labelled median-based estimate; GPU duration never supplies FPS', () => {
  const row = {frameMedianMs: 8.9029, gpuMedianMs: 4.91536, cpuTimingScope: 'completed-owning-render-entry-through-present'};
  assert.equal(fpsEstimate(row), 112);
  for (const value of [null, 0, -1, Infinity, NaN, undefined]) assert.equal(fpsEstimate({...row, frameMedianMs: value}), null);
  assert.equal(fpsEstimate({...row, cpuTimingScope: 'unknown'}), null);
  assert.equal(fpsEstimate({...row, cpuTimingScope: 'gpu-only'}), null);
  assert.equal(fpsEstimate({...row, frameMedianMs: 20, gpuMedianMs: .1}), 50);
});

test('hardware title uses a useful reported GPU when device model is absent', () => {
  const row = {model: 'Unknown', gpu: 'NVIDIA GeForce RTX 5050 Laptop GPU'};
  assert.equal(hardwareName(row), row.gpu);
  assert.equal(hardwareName({...row, model: 'Test laptop'}), 'Test laptop');
  assert.equal(hardwareName({model: 'Unknown', gpu: 'Unknown'}), 'Device not reported');
});

test('hardware search matches model or GPU without treating missing labels as hardware', () => {
  const row = {model: 'Galaxy Test', gpu: 'Adreno Test'};
  assert.equal(matchesHardware(row, ' GALAXY '), true);
  assert.equal(matchesHardware(row, 'adreno'), true);
  assert.equal(matchesHardware(row, 'rtx'), false);
  assert.equal(matchesHardware({model: 'Unknown', gpu: 'Unknown'}, 'unknown'), false);
  assert.equal(matchesHardware(row, ''), true);
});

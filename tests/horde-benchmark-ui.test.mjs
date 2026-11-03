import test from 'node:test';
import assert from 'node:assert/strict';
import {fpsEstimate, hardwareName, matchesHardware, gpuChoices} from '../assets/horde-benchmark-stats.js';

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

test('GPU choices come from reports, deduplicate and add newly reported models', () => {
  const gpu5050 = 'NVIDIA GeForce RTX 5050 Laptop GPU';
  const gpu5060 = 'NVIDIA GeForce RTX 5060 Laptop GPU';
  const existing = [{gpu: gpu5050}, {gpu: gpu5050}, {gpu: 'Unknown'}, {gpu: null}];
  assert.deepEqual(gpuChoices(existing), [{value: gpu5050, label: 'RTX 5050 Laptop'}]);
  assert.deepEqual(gpuChoices([...existing, {gpu: gpu5060}]).map(choice => choice.value), [gpu5050, gpu5060]);
  assert.deepEqual(gpuChoices([{gpu: 'Adreno (TM) 840'}]), [{value: 'Adreno (TM) 840', label: 'Adreno 840'}]);
  assert.deepEqual(gpuChoices([]), []);
});

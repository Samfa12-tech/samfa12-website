import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProfile } from '../build/game/profile.js';
import { Simulation, startRun, EMPTY_INPUT } from '../build/game/simulation.js';
import { DEFAULT_SETTINGS } from '../build/game/data.js';
import { vec } from '../build/game/math.js';
import { InputController } from '../build/input.js';

function setup() {
  const profile = freshProfile();
  profile.tutorial = 1; // Exercise ordinary swim, rescue and collision rules without tutorial pacing.
  const simulation = new Simulation(profile, startRun(profile, 'gardens'));
  return { profile, simulation };
}

function tick(simulation, seconds, input = {}) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) {
    simulation.update(1 / 60, { ...EMPTY_INPUT, ...input });
  }
}

test('vertical keyboard input reaches the new surface ceiling', () => {
  const { simulation } = setup();
  const handlers = new Map();
  const windowSurface = { addEventListener(name, fn) { handlers.set(name, fn); } };
  const canvas = { addEventListener() {}, focus() {}, requestPointerLock() {} };
  globalThis.window = windowSurface;
  globalThis.document = { addEventListener() {}, getElementById() { return null; }, pointerLockElement: null };
  globalThis.matchMedia = () => ({ matches: false });
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
  const input = new InputController(canvas, structuredClone(DEFAULT_SETTINGS), () => {});
  input.setActive(true);
  simulation.run.p = vec(0, simulation.site.surface - 0.5, -44);
  handlers.get('keydown')({ code: 'Space', repeat: false, target: { matches: () => false }, preventDefault() {} });
  for (let i = 0; i < 120; i++) simulation.update(1 / 60, input.sample(1 / 60));
  assert.ok(simulation.run.p.y > simulation.site.surface, 'ascend action should breach the water');
  assert.ok(simulation.run.p.y <= simulation.site.surface + 1.3, 'collision ceiling should stop at 1.3m above the water');
  input.setActive(false);
});

test('air pauses above the surface without refilling and resumes below it', () => {
  const { simulation } = setup();
  simulation.run.p = vec(0, simulation.site.surface + 0.5, -44);
  simulation.run.air = 123;
  tick(simulation, 3);
  assert.equal(simulation.run.air, 123, 'surface time must not consume or restore air');
  simulation.run.p = vec(0, simulation.site.surface - 0.5, -44);
  tick(simulation, 1);
  assert.ok(simulation.run.air < 123, 'submerged time should resume air use');
});

test('boarding remains available from above the surface', () => {
  const { simulation } = setup();
  const boat = simulation.site.landmarks[0].p;
  simulation.run.p = vec(boat.x, simulation.site.surface + 0.4, boat.z);
  tick(simulation, 1.3, { interact: true });
  assert.equal(simulation.run.finished, true);
  assert.equal(simulation.run.rescued, false);
});

test('surface collision clamp leaves the existing rescue condition intact', () => {
  const { simulation } = setup();
  simulation.run.p.y = simulation.site.surface + 4;
  simulation.collide();
  assert.equal(simulation.run.p.y, simulation.site.surface + 1.3);
  simulation.run.p.y = simulation.site.surface - 0.5;
  simulation.run.air = 0.01;
  tick(simulation, 0.1);
  assert.equal(simulation.run.rescued, true);
  assert.equal(simulation.profile.active, null);
  assert.equal(simulation.profile.pending, simulation.run);
});

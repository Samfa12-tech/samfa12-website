import test from 'node:test';
import assert from 'node:assert/strict';
import { SITES, floorHeight, freePoint } from '../build/game/data.js';
import {
  NATIVE_FISH_MAX_SCALE,
  NATIVE_FISH_SURFACE_MARGIN,
  NATIVE_FISH_TERRAIN_MARGIN,
  NATIVE_FISH_UNIT_BOUND,
  clearFishPosition,
  nativeFishEnvelope,
  nativeFishMotion,
} from '../build/game/fish-motion.js';
import { fishGeometry } from '../build/render/geometry.js';

const speciesCenter = species => ({
  x: Math.sin(species * .85) * 19,
  y: 4 + (species % 4) * 2,
  z: -22 + (species * 13) % 55,
});

function nativeGeometryBound() {
  let max = 0;
  for (let variant = 0; variant < 8; variant++) {
    const geometry = fishGeometry('native', variant);
    for (let i = 0; i < geometry.positions.length; i += 3) {
      const [x, y, z] = geometry.positions.slice(i, i + 3);
      max = Math.max(max, Math.hypot(x, y, z));
    }
  }
  // The shader tail sway adds at most .12 * .63^2 on X.
  return max + .12 * .63 ** 2;
}

function orbitSamples(site, species, radius, scale, seed, samples = 12000) {
  const center = speciesCenter(species);
  const duration = 5 * Math.PI * 2 / .13; // closes both the orbit and 1.8x bob phase
  const clearance = nativeFishEnvelope(scale);
  let previous = null;
  let maxStep = 0;
  let maxStepAt = 0;
  for (let i = 0; i <= samples; i++) {
    const time = duration * i / samples;
    const { position, heading } = nativeFishMotion(site, center, radius, seed, time, scale);
    assert.ok([position.x, position.y, position.z, heading].every(Number.isFinite), `${site.id} species ${species} produced non-finite motion at ${time}`);
    assert.ok(position.y - NATIVE_FISH_UNIT_BOUND * scale >= floorHeight(position.x, position.z, site) + NATIVE_FISH_TERRAIN_MARGIN - 1e-6,
      `${site.id} fish body crossed terrain at ${time}`);
    assert.ok(position.y + NATIVE_FISH_UNIT_BOUND * scale <= site.surface - NATIVE_FISH_SURFACE_MARGIN + 1e-6,
      `${site.id} fish body crossed the surface at ${time}`);
    assert.ok(freePoint(position, site, clearance),
      `${site.id} fish envelope intersected a rock at ${time}`);
    if (previous) {
      const step = Math.hypot(position.x - previous.x, position.y - previous.y, position.z - previous.z);
      if (step > maxStep) { maxStep = step; maxStepAt = time; }
    }
    previous = position;
  }
  return { maxStep, maxStepAt };
}

test('native mesh variants, including tail sway, fit the conservative motion envelope', () => {
  assert.ok(nativeGeometryBound() <= NATIVE_FISH_UNIT_BOUND + 1e-9,
    `actual mesh bound ${nativeGeometryBound()} exceeds motion bound ${NATIVE_FISH_UNIT_BOUND}`);
  assert.ok(NATIVE_FISH_MAX_SCALE >= 1.4);
});

test('all authored sites keep whole native fish outside rocks over complete school orbits', () => {
  for (const site of Object.values(SITES)) {
    for (let species = 0; species < 8; species++) {
      const radius = 4 + ((species * 1.73 + (site.id === 'passage' ? 3.1 : 0)) % 11);
      const scale = species % 3 === 0 ? 1.4 : species % 3 === 1 ? 1.1 : .8;
      const { maxStep, maxStepAt } = orbitSamples(site, species, radius, scale, .37 + species * 1.91);
      assert.ok(maxStep < .15, `${site.id} species ${species} orbit has a discontinuous ${maxStep.toFixed(3)}m step at ${maxStepAt}`);
    }
    // Exercise the extrema of the renderer's 4–15m school radii and member scale.
    for (const [radius, seed] of [[4, 8.2], [14.99, 17.4]]) {
      const { maxStep, maxStepAt } = orbitSamples(site, 3, radius, NATIVE_FISH_MAX_SCALE, seed);
      assert.ok(maxStep < .15, `${site.id} radius ${radius} orbit has a discontinuous ${maxStep.toFixed(3)}m step at ${maxStepAt}`);
    }
  }
});

test('native motion is deterministic for repeated timestamps', () => {
  for (const site of Object.values(SITES)) {
    const args = [site, speciesCenter(5), 14.8, 3.21, 86.125, 1.4];
    assert.deepEqual(nativeFishMotion(...args), nativeFishMotion(...args));
  }
});

test('generic fish clearance can lift an existing position out of a visible or hidden collision rock', () => {
  for (const site of Object.values(SITES)) {
    for (const rock of [site.rocks.find(r => !r.hidden), site.rocks.find(r => r.hidden)]) {
      const envelope = 1.55;
      const safe = clearFishPosition(site, rock.p, envelope);
      assert.ok([safe.x, safe.y, safe.z].every(Number.isFinite));
      assert.ok(freePoint(safe, site, envelope), `${site.id}/${rock.id} remained inside its rock envelope`);
      assert.ok(safe.y - envelope >= floorHeight(safe.x, safe.z, site) + .2 - 1e-6);
    }
  }
});

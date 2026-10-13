import test from 'node:test';
import assert from 'node:assert/strict';
import { fishGeometry, islandGeometry, seaweedGeometry, sewagePipeGeometry, shipwreckGeometry } from '../build/render/geometry.js';

function validGeometry(geometry) {
  const vertices = geometry.positions.length / 3;
  assert.ok(vertices > 0);
  assert.equal(geometry.normals.length, geometry.positions.length);
  assert.equal(geometry.colors.length, vertices * 4);
  assert.equal(geometry.uvs.length, vertices * 2);
  assert.ok(geometry.positions.every(Number.isFinite));
  assert.ok(geometry.normals.every(Number.isFinite));
  assert.ok(geometry.uvs.every(Number.isFinite));
  assert.ok(geometry.indices.every(index => Number.isInteger(index) && index >= 0 && index < vertices));
  return vertices;
}

function assertWatertight(geometry) {
  const key = index => geometry.positions.slice(index * 3, index * 3 + 3).map(value => Math.round(value * 1e6)).join(',');
  const edges = new Map();
  for (let i = 0; i < geometry.indices.length; i += 3) {
    const triangle = geometry.indices.slice(i, i + 3).map(key);
    for (const [a, b] of [[triangle[0], triangle[1]], [triangle[1], triangle[2]], [triangle[2], triangle[0]]]) {
      const edge = [a, b].sort().join('|');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  assert.ok(edges.size > 0);
  assert.ok([...edges.values()].every(count => count === 2), 'every geometric edge joins exactly two triangles');
}

test('seaweed has rooted height UVs for current-driven tip sway', () => {
  const geometry = seaweedGeometry(417, 1.4);
  const vertices = validGeometry(geometry);
  const heights = geometry.uvs.filter((_, index) => index % 2 === 1);
  assert.ok(vertices >= 100);
  assert.equal(Math.min(...heights), 0);
  assert.equal(Math.max(...heights), 1);
  for (let i = 0; i < vertices; i++) {
    const y = geometry.positions[i * 3 + 1], t = geometry.uvs[i * 2 + 1];
    if (t === 0) assert.equal(y, 0, 'frond roots stay planted at the seabed');
    else assert.ok(y > 0, 'fronds rise continuously from their roots');
  }
});

test('procedural wreck, old outfall and shark silhouettes have valid mesh data', () => {
  assert.ok(validGeometry(shipwreckGeometry()) > 500);
  assert.ok(validGeometry(sewagePipeGeometry()) > 600);
  assert.ok(validGeometry(fishGeometry('shark')) > 100);
});

test('island shore continues as a tapered, closed foundation below the seabed', () => {
  const geometry = islandGeometry(417);
  validGeometry(geometry);
  assertWatertight(geometry);
  for (const base of [120726, 741309])
    for (let i = 0; i < 12; i++)
      assertWatertight(islandGeometry(base + i * 173));
  const vertices = geometry.positions.length / 3;
  const bottomCenter = Array.from({ length: vertices }, (_, i) => i).find(i =>
    geometry.positions[i * 3] === 0 && geometry.positions[i * 3 + 1] === -45 && geometry.positions[i * 3 + 2] === 0);
  assert.notEqual(bottomCenter, undefined, 'default foundation closes at least 45 local metres down');
  assert.ok(geometry.indices.filter(index => index === bottomCenter).length > 24,
    'the bottom center joins the perimeter of the closed cap');

  const ringRadius = y => Math.max(...Array.from({ length: vertices }, (_, i) => i)
    .filter(i => geometry.positions[i * 3 + 1] === y)
    .map(i => Math.hypot(geometry.positions[i * 3], geometry.positions[i * 3 + 2])));
  assert.ok(ringRadius(-5) < ringRadius(-22));
  assert.ok(ringRadius(-22) < ringRadius(-45));

  const deeper = islandGeometry(417, 62);
  assert.ok(Math.min(...Array.from({ length: deeper.positions.length / 3 }, (_, i) => deeper.positions[i * 3 + 1])) <= -62,
    'the parent renderer can extend the foundation to its seabed depth');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Geometry, seaweedGeometry, coral } from '../build/render/geometry.js';
import { sandHeight, seabedGeometry, mergeGrounded, SEABED_SIZE, SEABED_STEPS } from '../build/render/terrain.js';
import { vec } from '../build/game/math.js';
const ground = seabedGeometry();
function actualTriangleHeight(x, z) {
  const cell = SEABED_SIZE / SEABED_STEPS;
  const ix = Math.floor((x + SEABED_SIZE / 2) / cell), iz = Math.floor((z + SEABED_SIZE / 2) / cell);
  const start = (iz * SEABED_STEPS + ix) * 6;
  for (let t = 0; t < 2; t++) {
    const points = ground.indices.slice(start + t * 3, start + t * 3 + 3).map(i => ground.positions.slice(i * 3, i * 3 + 3));
    const [a,b,c] = points, denominator = (b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    const u = ((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/denominator;
    const v = ((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/denominator, w=1-u-v;
    if (Math.min(u,v,w) >= -1e-7) return u*a[1]+v*b[1]+w*c[1];
  }
  throw new Error('No sand triangle under sample');
}
test('placement height matches rendered sand triangles across the trench and shelves', () => {
  for(let x=-61.3;x<63;x+=7.23) for(let z=-60.7;z<62;z+=8.31) assert.ok(Math.abs(sandHeight(x,z)-actualTriangleHeight(x,z))<1e-8);
});
test('all seaweed root vertices remain embedded after yaw and scale on steep sand', () => {
  for(const [x,z] of [[0,-35],[32,-37],[42,-25],[53,-40],[-18,4]]) {
    const source=seaweedGeometry(417,1.4), placed=new Geometry();
    mergeGrounded(placed,source,vec(x,999,z),vec(1.23,1,.91),1.7);
    for(let i=0;i<source.positions.length/3;i++) if(source.uvs[i*2+1]===0) {
      const [px,py,pz]=placed.positions.slice(i*3,i*3+3), depth=actualTriangleHeight(px,pz)-py;
      assert.ok(depth>.034 && depth<.036,'root must sit inside the visible sand, not hover');
    }
  }
});
test('outer seabed continues under distant island foundations within a small mesh budget', () => {
  const inner=(SEABED_STEPS+1)**2;
  assert.ok(ground.positions.length/3-inner<=2500);
  assert.ok(ground.positions.some((v,i)=>i%3===0&&Math.abs(v)>=400));
  assert.ok(ground.indices.every(i=>i>=0&&i<ground.positions.length/3));
  assert.ok(ground.positions.every(Number.isFinite));
});

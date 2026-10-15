import test from 'node:test';
import assert from 'node:assert/strict';
import { SITES, floorHeight } from '../build/game/data.js';
import { Geometry, fishGeometry } from '../build/render/geometry.js';
import { siteObstacleGeometry } from '../build/render/biome-geometry.js';
import { sandHeight, seabedGeometry, mergeGrounded } from '../build/render/terrain.js';
import { forearmGeometry, diverPose } from '../build/render/diver-animation.js';
import { freshProfile } from '../build/game/profile.js';
import { startRun } from '../build/game/simulation.js';
import { vec } from '../build/game/math.js';
import { nativeFishMotion, prepareNativeOrbit } from '../build/game/fish-motion.js';

test('each new site has a different visible seabed, cached independently',()=>{
  const samples=Object.values(SITES).map(site=>sandHeight(0,10,site));
  assert.equal(new Set(samples.slice(2).map(n=>n.toFixed(1))).size,3);
  for(const site of Object.values(SITES)){
    const g=seabedGeometry(site),cell=170/90;
    for(const [ix,iz] of [[43,47],[22,37],[57,68]]) {
      const i=iz*91+ix,x=-85+ix*cell,z=-85+iz*cell;
      assert.ok(Math.abs(g.positions[i*3+1]-sandHeight(x,z,site))<1e-8);
    }
    const root=new Geometry();root.v(vec(),vec(0,1,0),[1,1,1]);
    const out=new Geometry();mergeGrounded(out,root,vec(0,999,10),vec(1,1,1),0,site);
    assert.ok(Math.abs(sandHeight(0,10,site)-out.positions[1]-.035)<1e-8);
  }
});
test('authored biome obstacles have finite rendered meshes within a bounded budget',()=>{
  for(const site of Object.values(SITES).slice(2)) for(const r of site.rocks.filter(r=>!r.hidden&&!r.suspended)) {
    const g=siteObstacleGeometry(r,site),count=g.positions.length/3;
    assert.ok(count>0&&count<1800);assert.ok(g.positions.every(Number.isFinite));
    assert.ok(g.indices.every(i=>i>=0&&i<count));
  }
});
test('new trees, cliffs and cargo boxes meet their own local seabed',()=>{
  for(const site of Object.values(SITES).slice(2))for(const rock of site.rocks.filter(r=>!r.hidden&&!r.suspended)){
    const g=siteObstacleGeometry(rock,site),ys=g.positions.filter((n,i)=>i%3===1);
    assert.ok(Math.min(...ys)<=floorHeight(rock.p.x,rock.p.z,site)-.03,`${site.id}/${rock.id} floats above sand`);
  }
});
test('native fish have several silhouettes and bounded local mesh sizes',()=>{
  const shapes=[];
  for(let i=0;i<8;i++){
    const g=fishGeometry('native',i);assert.ok(g.positions.length/3<1800);
    const y=g.positions.filter((v,j)=>j%3===1),z=g.positions.filter((v,j)=>j%3===2);
    shapes.push([Math.max(...y)-Math.min(...y),Math.max(...z)-Math.min(...z)].map(n=>n.toFixed(2)).join(','));
    assert.ok(g.uvs.every((n,j)=>j%2||n===1));
  }
  assert.ok(new Set(shapes).size>=3);
});
test('checking the watch raises the left wrist while aiming keeps the spear hand steady',()=>{
  const p=freshProfile(1),r=startRun(p,'gardens');
  r.velocity=vec(1,0,1);const out={left:vec(),right:vec(),leftRoll:0,rightRoll:0,reach:0,thrust:0};
  const rest=diverPose(r,0,0,false),raised=diverPose(r,0,1,false,out);
  assert.equal(raised,out);assert.ok(raised.left.y>rest.left.y+.2);assert.equal(raised.right.z,rest.right.z);
  r.charge=1;const draw=diverPose(r,0,0,true);assert.ok(draw.right.z<rest.right.z-.1);
  r.charge=0;r.interaction=.5;assert.ok(diverPose(r,0,0,true).left.z>rest.left.z);
  for(const side of [-1,1]) assert.ok(forearmGeometry(side).positions.every(Number.isFinite));
});
test('preparing school routes once preserves continuous native-fish motion',()=>{
  for(const site of Object.values(SITES)){
    const center=vec(8,6,-20),radius=14,scale=1.4;
    const out={position:vec(),heading:0,orbitCenter:prepareNativeOrbit(site,center,radius,scale)};
    const stored=out.orbitCenter;
    for(const time of [0,1.5,8,24,63,127]){
      const expected=nativeFishMotion(site,center,radius,.63,time,scale);
      const actual=nativeFishMotion(site,center,radius,.63,time,scale,out);
      assert.deepEqual(actual.position,expected.position);assert.equal(actual.heading,expected.heading);
      assert.equal(actual.orbitCenter,stored);assert.equal(actual,out);
    }
  }
});

test('stowed and scooter hand poses retain distinct, aligned grips',()=>{
  const p=freshProfile(1),r=startRun(p,'gardens'),rest=diverPose(r,0,0,true);
  r.scooter=true;const grip=diverPose(r,0,0,true);
  assert.equal(grip.left.y,grip.right.y);assert.equal(grip.left.z,grip.right.z);
  assert.ok(grip.left.y>rest.left.y);assert.ok(grip.right.z<rest.right.z);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { BoatEntrySequence } from '../build/game/boat-entry.js';
import { boatEntry } from '../build/render/assets/boat-entry.js';

test('entry retains exact selection, freezes for pause, and commits once after full clip',()=>{
 const selected={site:'passage',order:'research',night:true,distance:123.45};
 const entry=new BoatEntrySequence(selected,boatEntry.duration);selected.site='gardens';
 for(let i=0;i<50;i++)entry.advance(.05,true);assert.equal(entry.elapsed,0);assert.equal(entry.take(),null);
 for(let i=0;i<43;i++)entry.advance(.05,false);assert.equal(entry.take(),null);
 for(let i=0;i<40;i++)entry.advance(.05,false);
 assert.deepEqual(entry.take(),{site:'passage',order:'research',night:true,distance:123.45});assert.equal(entry.take(true),null);
});
test('skip and cancellation never produce a second dive',()=>{
 const selected={site:'gardens',order:'none',night:false,distance:0};
 const entry=new BoatEntrySequence(selected,boatEntry.duration);assert.deepEqual(entry.take(true),selected);entry.advance(1,false);assert.equal(entry.take(true),null);
 const cancelled=new BoatEntrySequence(selected,boatEntry.duration);cancelled.cancel();assert.equal(cancelled.take(true),null);
});
test('authored runtime bake stays finite, bounded, opaque and index-valid',()=>{
 assert.equal(boatEntry.parts.length,52);assert.equal(boatEntry.frames.length,44);assert.equal(boatEntry.duration,86/24);
 let triangles=0;const actors=new Set();
 for(const p of boatEntry.parts){actors.add(p.actor);const g=p.geometry,n=g.positions.length/3;triangles+=g.indices.length/3;
  assert.equal(g.normals.length,n*3);assert.equal(g.colors.length,n*4);assert.equal(g.uvs.length,n*2);
  assert.ok([...g.positions,...g.normals,...g.colors,...g.uvs].every(Number.isFinite));assert.ok(g.indices.every(i=>Number.isInteger(i)&&i>=0&&i<n));
 }
 assert.equal(triangles,3216);assert.deepEqual([...actors].sort(),['diver','pilot']);
 for(const [i,f] of boatEntry.frames.entries()){assert.ok(i===0||f.time>boatEntry.frames[i-1].time);assert.equal(f.matrices.length,52);assert.ok(f.matrices.every(m=>m.length===16&&m.every(Number.isFinite)));}
});

test('boat look retains steering-relative yaw, bounds pitch, and resets per trip',async()=>{
 const {BoatLook}=await import('../build/render/boat-look.js');const view=new BoatLook();
 assert.equal(view.yaw,0);assert.equal(view.pitch,.35);
 view.update(.5,.2);assert.equal(view.yaw,.5);assert.equal(view.pitch,.55);
 view.update(0,100);assert.equal(view.pitch,1.05);view.update(0,-100);assert.equal(view.pitch,.08);
 view.update(NaN,Infinity);assert.equal(view.yaw,.5);assert.equal(view.pitch,.08);
 view.update(Math.PI*8,0);assert.ok(Math.abs(view.yaw-.5)<1e-12);
 const next=new BoatLook();assert.equal(next.yaw,0);assert.equal(next.pitch,.35);
});

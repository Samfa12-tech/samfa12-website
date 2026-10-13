import test from 'node:test';import assert from 'node:assert/strict';
import {freshProfile} from '../build/game/profile.js';import {startRun} from '../build/game/simulation.js';
import {SITES,siteForRun,floorHeight} from '../build/game/data.js';import {scheduleBoat,updateBoat,clearBoat} from '../build/game/boat-encounters.js';
test('new Passage has a sheltered west approach and distinct channel; legacy suspended runs keep old mooring',()=>{
 const legacy=siteForRun({site:'passage'}),current=siteForRun({site:'passage',siteRevision:2});assert.equal(legacy.entry.x,0);assert.equal(current.entry.x,-28);assert.equal(floorHeight(0,10,legacy)>floorHeight(0,10,current)+5,true);assert.equal(legacy.landmarks[0].p.x,0);
});
test('overhead encounters stay out of level one, telegraph before active and never pay twice',()=>{
 const p=freshProfile();p.totalRemoved=50;const r=startRun(p,'gardens');r.day=6;scheduleBoat(r,SITES.gardens);assert.equal(r.encounter,undefined);
 r.site='harbour';r.seed=3;r.p={x:0,y:14,z:-46};scheduleBoat(r,SITES.harbour);assert.ok(r.encounter);let warnings=0,sounds=0;const notify=()=>warnings++,sound=()=>sounds++;
 r.time=r.encounter.start;updateBoat(r,SITES.harbour,notify,sound);assert.equal(r.encounter.phase,'warning');assert.equal(sounds,1);
 updateBoat(r,SITES.harbour,notify,sound);assert.equal(sounds,1);r.time+=12;updateBoat(r,SITES.harbour,notify,sound);assert.equal(r.encounter.phase,'active');assert.equal(clearBoat(r),false);
 r.time+=20;updateBoat(r,SITES.harbour,notify,sound);assert.equal(r.encounter.phase,'abandoned');assert.equal(clearBoat(r),true);assert.equal(clearBoat(r),false);assert.equal(r.encounter.rewarded,true);
});

test('sand placement cache distinguishes legacy and new Passage even after previews',async()=>{
 const {sandHeight}=await import('../build/render/terrain.js');const legacy=siteForRun({site:'passage'}),current=SITES.passage;
 const a=sandHeight(0,10,current),b=sandHeight(0,10,legacy);assert.ok(b>a+5);assert.equal(sandHeight(0,10,current),a);assert.equal(sandHeight(0,10,legacy),b);
});

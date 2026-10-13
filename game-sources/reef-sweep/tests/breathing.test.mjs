import test from 'node:test';
import assert from 'node:assert/strict';
import { BreathClock, BubblePool } from '../build/game/breathing.js';
import { freshProfile } from '../build/game/profile.js';
import { Simulation, startRun } from '../build/game/simulation.js';
import { SITES } from '../build/game/data.js';

test('regulator clock emits once per phase and stops outside water',()=>{
 const c=new BreathClock();assert.equal(c.sample(0,true),'inhale');assert.equal(c.sample(0,true),null);
 assert.equal(c.sample(1.71,true),'exhale');assert.equal(c.sample(2,true),null);assert.equal(c.sample(4.31,true),'inhale');
 assert.equal(c.sample(5,false),null);assert.equal(c.sample(5,true),'inhale');
});
test('pause freezes the current breath without replaying it on resume',()=>{
 const c=new BreathClock();assert.equal(c.sample(1.8,true),'exhale');
 assert.equal(c.sample(1.8,false,true),null);assert.equal(c.sample(1.8,true),null);
 assert.equal(c.sample(4.3,true),'inhale');
});
test('pooled bubbles exhale, rise in current, freeze with run time and expire at surface',()=>{
 const run=startRun(freshProfile(),'gardens'),site=SITES.gardens,pool=new BubblePool();
 pool.update(run,site,true);assert.equal(pool.emitted,0);run.time=1.71;pool.update(run,site,true);assert.equal(pool.active(run.time),8);
 const b=pool.bubbles[0],original={...b.p};pool.update(run,site,true);assert.deepEqual(b.p,original);
 run.time+=.1;pool.update(run,site,true);assert.ok(b.p.y>original.y);assert.notEqual(b.p.z,original.z);
 for(let i=0;i<400;i++){run.time+=.1;pool.update(run,site,true)}assert.ok(pool.active(run.time)<=24);assert.ok(pool.emitted>40);
 run.p.y=site.surface+.5;const total=pool.emitted;for(let i=0;i<60;i++){run.time+=.1;pool.update(run,site,true)}assert.equal(pool.emitted,total);assert.equal(pool.active(run.time),0);
 pool.update(run,site,false);assert.equal(pool.active(run.time),0);
});
test('BOOM appears occasionally on confirmed lionfish hits only',()=>{
 const p=freshProfile(),s=new Simulation(p,startRun(p,'gardens'));const f=s.run.fish[0];
 s.run.p={x:f.p.x,y:f.p.y,z:f.p.z-2};s.run.yaw=0;s.run.pitch=0;s.strike(.1);
 assert.ok(!s.events.some(e=>e.text?.includes('BOOM')));s.events=[];s.run.strikeCooldown=0;s.strike(1);
 assert.equal(s.run.removed,1);assert.ok(s.events.some(e=>e.text?.includes('BOOM')));
 const next=s.run.fish[1];s.run.exposed=null;s.run.strikeCooldown=0;s.events=[];s.run.p={x:next.p.x,y:next.p.y,z:next.p.z-2};s.strike(1);
 assert.equal(s.run.removed,2);assert.ok(!s.events.some(e=>e.text?.includes('BOOM')));
});

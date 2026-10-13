import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProfile } from '../build/game/profile.js';
import { startRun, Simulation, EMPTY_INPUT } from '../build/game/simulation.js';
import { startLesson, advanceLesson, lessonActive, skipLesson } from '../build/game/tutorial.js';
import { bindSuspendedDive } from '../build/game/resume.js';
import { ScooterMotor, sampledThrust } from '../build/audio/scooter.js';
test('resume rebinds a preview world even when suspended simulation identity already matches',()=>{
 const p=freshProfile(),r=startRun(p,'gardens'),sim=new Simulation(p,r);let builds=0;
 const renderer={run:{...r,site:'passage'},build(profile,run){assert.equal(profile,p);this.run=run;builds++}};
 assert.equal(bindSuspendedDive(p,sim,renderer,run=>new Simulation(p,run)),sim);assert.equal(renderer.run,r);assert.equal(builds,1);
 bindSuspendedDive(p,sim,renderer,run=>new Simulation(p,run));assert.equal(builds,1);
});
test('tutorial ignores elapsed time, flow and cancelled draws; steps require real actions',()=>{
 const p=freshProfile(),r=startRun(p,'gardens');startLesson(r);
 for(let i=0;i<200;i++)advanceLesson(p,r,EMPTY_INPUT,.05,false);assert.equal(r.lesson.step,0);
 advanceLesson(p,r,{...EMPTY_INPUT,lookX:.2},.05,false);assert.equal(r.lesson.step,1);
 advanceLesson(p,r,{...EMPTY_INPUT,moveZ:1},1,false);assert.equal(r.lesson.step,2);
 advanceLesson(p,r,EMPTY_INPUT,.05,true);assert.equal(r.lesson.step,3);
 r.charge=1;advanceLesson(p,r,{...EMPTY_INPUT,cancelDraw:true},.05,true);assert.equal(r.lesson.step,3);
 r.removed=1;advanceLesson(p,r,EMPTY_INPUT,.05,true);assert.equal(r.lesson.step,4);
 r.cargo.push({id:'a',weight:1,value:10});advanceLesson(p,r,EMPTY_INPUT,.05,false);
 r.cleaned=1;advanceLesson(p,r,EMPTY_INPUT,.05,false);assert.equal(r.lesson.step,6);
 r.finished=true;advanceLesson(p,r,EMPTY_INPUT,.05,false);assert.equal(p.tutorial,1);assert.equal(lessonActive(r),false);
});
test('skip is persistent and leaves campaign work and cash alone',()=>{
 const p=freshProfile(),r=startRun(p,'gardens');startLesson(r);const cash=p.cash;skipLesson(p,r);assert.equal(lessonActive(r),false);assert.equal(p.cash,cash);assert.equal(p.totalCleaned,0);
});
test('motor has fixed voices, responds to thrust and stops for pause/stow/depletion',()=>{
 let nodes=0;const param=()=>({value:0,setTargetAtTime(v){this.value=v},cancelScheduledValues(){}});
 const node=()=>{nodes++;return {gain:param(),frequency:param(),connect(){},disconnect(){},start(){},stop(){}}};
 const ctx={state:'running',currentTime:1,createGain:node,createBiquadFilter:node,createOscillator:node};const motor=new ScooterMotor(ctx,node());const count=nodes;
 motor.update(true,0);const idle=motor.stats();motor.update(true,1);assert.ok(motor.stats().pitchHz>idle.pitchHz);assert.ok(motor.stats().gain>idle.gain);
 for(let i=0;i<100;i++){motor.update(true,1);motor.silence()}assert.equal(nodes,count);assert.equal(motor.stats().active,false);assert.equal(motor.stats().gain,0);
 ctx.state='suspended';motor.update(true,1);assert.equal(motor.stats().active,false);motor.dispose();
});

test('render-only frames retain scooter thrust instead of pulsing to idle',()=>{
 const forward={moveX:0,moveZ:1,vertical:0},empty={moveX:0,moveZ:0,vertical:0};
 const thrust=sampledThrust(0,true,true,forward);assert.equal(thrust,1);
 assert.equal(sampledThrust(thrust,true,false,empty),1);
 assert.equal(sampledThrust(thrust,true,true,empty),0);assert.equal(sampledThrust(thrust,false,false,forward),0);
});

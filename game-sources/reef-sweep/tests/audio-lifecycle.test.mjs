import test from 'node:test';
import assert from 'node:assert/strict';
import * as audio from '../build/audio/audio.js';
import { DEFAULT_SETTINGS } from '../build/game/data.js';
import { SaveStore, SAVE_PREFIX, freshProfile } from '../build/game/profile.js';
import { startRun } from '../build/game/simulation.js';

function fixture(fn) {
 const previous={window:globalThis.window,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
 let contexts=0,timers=0,nodes=0;
 const param=()=>({value:0,setValueAtTime(v){this.value=v},setTargetAtTime(v){this.value=v},linearRampToValueAtTime(v){this.value=v},exponentialRampToValueAtTime(v){this.value=v},cancelScheduledValues(){}});
 const node=()=>{nodes++;return {gain:param(),frequency:param(),detune:param(),Q:param(),threshold:param(),ratio:param(),connect(){},disconnect(){},start(){},stop(){},addEventListener(){}}};
 class Context {
  state='suspended';currentTime=0;sampleRate=10;destination=node();denied=false;resumes=0;
  constructor(){contexts++}
  createGain=node;createBiquadFilter=node;createOscillator=node;createDynamicsCompressor=node;createBufferSource=node;
  createBuffer(c,n){return {getChannelData:()=>new Float32Array(n)}}
  async resume(){this.resumes++;if(this.denied){this.denied=false;throw Error('gesture denied')}this.state='running'}
 }
 globalThis.window={AudioContext:Context};globalThis.setInterval=()=>{timers++;return timers};globalThis.clearInterval=()=>{};
 const sound=new audio.Soundscape({...DEFAULT_SETTINGS});
 return Promise.resolve().then(()=>fn(sound,()=>({contexts,timers,nodes}))).finally(()=>Object.assign(globalThis,previous));
}

test('menu gestures retry denied/interrupted unlock without duplicate graph or timers',()=>fixture(async(sound,counts)=>{
 assert.equal(typeof audio.bindAudioUnlock,'function');
 const target=new EventTarget(),unbind=audio.bindAudioUnlock(sound,target);
 target.dispatchEvent(new Event('pointerdown'));await Promise.resolve();await Promise.resolve();
 assert.equal(sound.ctx.state,'running');assert.ok(sound.step>0);
 sound.ctx.state='suspended';sound.ctx.denied=true;
 target.dispatchEvent(new Event('keydown'));await Promise.resolve();await Promise.resolve();assert.equal(sound.ctx.state,'suspended');
 target.dispatchEvent(new Event('touchend'));await Promise.resolve();await Promise.resolve();assert.equal(sound.ctx.state,'running');
 sound.ctx.state='interrupted';target.dispatchEvent(new Event('click'));await Promise.resolve();await Promise.resolve();assert.equal(sound.ctx.state,'running');
 assert.equal(counts().contexts,1);assert.equal(counts().timers,1);unbind();
 const resumes=sound.ctx.resumes;target.dispatchEvent(new Event('click'));assert.equal(sound.ctx.resumes,resumes);
}));

test('boat has a bounded idle/reverse/throttle motor and stops at dive/menu/pause/mute',()=>fixture(async(sound,counts)=>{
 await sound.start();const n=counts().nodes;
 sound.update(null,false,0,0);assert.equal(sound.stats().boatMotor.active,true);const idle=sound.stats().boatMotor;
 sound.update(null,false,0,-15);assert.ok(sound.stats().boatMotor.gain>idle.gain);assert.ok(sound.stats().boatMotor.pitchHz>idle.pitchHz);
 for(let i=0;i<100;i++)sound.update(null,false,0,i%16);assert.equal(counts().nodes,n);
 sound.setPaused(true);assert.equal(sound.stats().boatMotor.active,false);
 sound.update(null,false,0,15);assert.equal(sound.stats().boatMotor.active,false);
 sound.setPaused(false);sound.setSettings({...DEFAULT_SETTINGS,effects:0});sound.update(null,false,0,15);assert.equal(sound.stats().boatMotor.active,false);
 sound.setSettings({...DEFAULT_SETTINGS});sound.update(null,false,0,10);assert.equal(sound.stats().boatMotor.active,true);
 const run=startRun(freshProfile(),'gardens');run.scooter=true;run.battery=100;
 sound.update(run,true,1);assert.equal(sound.stats().boatMotor.active,false);assert.equal(sound.stats().motor.active,true);
 sound.update(null,false);assert.equal(sound.stats().boatMotor.active,false);assert.equal(sound.stats().motor.active,false);
}));

test('settings respect pause and hidden state, cancel warning restores, and retain explicit zero',()=>fixture(async(sound)=>{
 await sound.start();sound.sfx('warning');sound.setPaused(true);sound.setSettings({...DEFAULT_SETTINGS,effects:.9});
 assert.equal(sound.effects.gain.value,0);assert.equal(sound.ambience.gain.value,0);assert.equal(sound.music.gain.value,DEFAULT_SETTINGS.music*.08);
 sound.setHidden(true);assert.equal(sound.music.gain.value,0);const step=sound.step;sound.ctx.currentTime=20;sound.schedule();assert.equal(sound.step,step);
 sound.setSettings({...DEFAULT_SETTINGS,music:.8});assert.equal(sound.music.gain.value,0);
 sound.setHidden(false);assert.equal(sound.music.gain.value,.8*.08);sound.setPaused(false);assert.equal(sound.music.gain.value,.8*.32);
 const map=new Map(),store=new SaveStore({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
 store.saveSettings({...DEFAULT_SETTINGS,music:0,effects:0,ambience:0});assert.ok(map.has(SAVE_PREFIX+'settings'));
 const saved=store.settings();assert.equal(saved.music,0);assert.equal(saved.effects,0);assert.equal(saved.ambience,0);
 sound.setSettings(saved);assert.equal(sound.music.gain.value,0);assert.equal(sound.effects.gain.value,0);
}));

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run the actual shipped controller with browser event surfaces, without a
// second implementation or a DOM/WebGL dependency in the site's test suite.
const html=fs.readFileSync(new URL('../games/banana-banana-ducky/play/index.html',import.meta.url),'utf8');
const controller=html.slice(html.indexOf('function bindJoystick('),html.indexOf('// ---- End joystick lifecycle. ----'));
function surface(){
  const listeners=new Map();
  return {addEventListener(type,fn){const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list);},
    fire(type,event={}){for(const fn of listeners.get(type)||[])fn(event);}};
}
function harness({captureFails=false}={}){
  const window=surface(),joystick=surface(),stick={style:{transform:''}},state={joyId:null,x:0,z:0};
  let captured=null,enabled=true,starts=0;
  Object.assign(joystick,{getBoundingClientRect:()=>({left:10,top:20,width:116,height:116}),
    setPointerCapture(id){if(captureFails)throw Error('NotFoundError');captured=id;},
    hasPointerCapture:id=>captured===id,releasePointerCapture(id){captured=null;joystick.fire('lostpointercapture',{pointerId:id});}});
  const context=vm.createContext({window});vm.runInContext(controller,context);
  const control=context.bindJoystick(joystick,stick,state,{enabled:()=>enabled,start:()=>starts++});
  const pointer=(id,x=68,y=110,extra={})=>({pointerId:id,pointerType:'touch',isPrimary:false,button:0,buttons:1,clientX:x,clientY:y,preventDefault(){},...extra});
  const down=(id,x,y,extra)=>joystick.fire('pointerdown',pointer(id,x,y,extra));
  return {window,joystick,stick,state,control,pointer,down,setEnabled:v=>enabled=v,starts:()=>starts,capture:()=>captured};
}
const stopped=h=>{assert.equal(h.state.joyId,null);assert.equal(h.state.x,0);assert.equal(h.state.z,0);assert.equal(h.stick.style.transform,'');};

test('page-level release outside the joystick stops downward movement and accepts the next thumb',()=>{
  const h=harness();h.down(7);assert.ok(h.state.z>.9);
  h.window.fire('pointerup',h.pointer(7));stopped(h);
  h.down(8,100,78);assert.equal(h.state.joyId,8);assert.ok(h.state.x>.9);assert.equal(h.state.z,0);
});
for(const event of ['pointercancel','lostpointercapture'])test(`${event} releases ownership and recentres the stick`,()=>{
  const h=harness();h.down(1);(event==='lostpointercapture'?h.joystick:h.window).fire(event,h.pointer(1));stopped(h);h.down(2);assert.equal(h.state.joyId,2);
});
test('capture failure still moves, releases over the page and never leaves a locked owner',()=>{
  const h=harness({captureFails:true});assert.doesNotThrow(()=>h.down(3));assert.ok(h.state.z>.9);
  h.window.fire('pointermove',h.pointer(3,34,78));assert.equal(h.state.x,-1);
  h.window.fire('pointerup',h.pointer(3));stopped(h);
});
test('secondary joystick fingers and action-button releases cannot steal or stop the held thumb',()=>{
  const h=harness();h.down(11);h.down(12,34,78);h.window.fire('pointerup',h.pointer(12));h.joystick.fire('lostpointercapture',h.pointer(12));
  assert.equal(h.state.joyId,11);assert.ok(h.state.z>.9);
  h.window.fire('pointermove',h.pointer(11,100,78));assert.ok(h.state.x>.9);
});
test('a stationary held thumb stays active across a long sequence of unrelated action taps',()=>{
  const h=harness();h.down(1,100,78);
  for(let i=2;i<200;i++){h.window.fire('pointerup',h.pointer(i));h.window.fire('touchmove',{touches:[{identifier:70,clientX:100,clientY:78}]});}
  assert.equal(h.state.joyId,1);assert.ok(h.state.x>.9);assert.equal(h.starts(),1);
});
test('touch identifiers are independent of pointer IDs; touch end stops only its owner while an action finger remains',()=>{
  const h=harness();h.down(101);
  h.window.fire('touchstart',{touches:[{identifier:7,clientX:68,clientY:110},{identifier:8,clientX:500,clientY:110}]});
  h.window.fire('touchend',{touches:[{identifier:7,clientX:68,clientY:110}]});assert.equal(h.state.joyId,101);
  h.window.fire('touchend',{touches:[{identifier:8,clientX:500,clientY:110}]});stopped(h);
});
test('touch reconciliation works when touchstart arrives before pointerdown',()=>{
  const h=harness();h.window.fire('touchstart',{touches:[{identifier:55,clientX:68,clientY:110}]});h.down(100);
  h.window.fire('touchcancel',{touches:[{identifier:56,clientX:400,clientY:400}]});stopped(h);
});
test('all touches ending recovers from a missing pointer release notification',()=>{
  const h=harness();h.down(21);h.window.fire('touchend',{touches:[]});stopped(h);
});
test('a new primary touch recovers an orphaned sequence without inheriting its stale touch list',()=>{
  const h=harness();h.down(1);h.window.fire('touchstart',{touches:[{identifier:50,clientX:68,clientY:110}]});
  h.down(2,68,110,{isPrimary:true});h.window.fire('touchstart',{touches:[{identifier:51,clientX:68,clientY:110}]});
  assert.equal(h.state.joyId,2);assert.ok(h.state.z>.9);
});
test('explicit reset releases capture after clearing ownership and remains reusable',()=>{
  const h=harness();h.down(9);assert.equal(h.capture(),9);h.control.reset();stopped(h);assert.equal(h.capture(),null);h.down(10);assert.equal(h.state.joyId,10);
});
test('released mouse move recovers from a missed mouseup; touch buttons=0 does not cancel a held thumb',()=>{
  const h=harness();h.down(1,100,78,{pointerType:'mouse'});h.window.fire('pointermove',h.pointer(1,100,78,{buttons:0}));stopped(h);
  h.down(2);h.window.fire('pointermove',h.pointer(2,68,110,{buttons:0}));assert.equal(h.state.joyId,2);
});
test('joystick ignores inactive modes and right mouse buttons, and clamps diagonal movement',()=>{
  const h=harness();h.setEnabled(false);h.down(1);stopped(h);h.setEnabled(true);h.down(2,68,78,{pointerType:'mouse',button:2});stopped(h);
  h.down(3,1000,1000);assert.ok(Math.abs(Math.hypot(h.state.x,h.state.z)-1)<1e-9);
});

const lifecycle=html.slice(html.indexOf('function backgroundGame()'),html.indexOf("for(const el of document.querySelectorAll('.overlay'))"));
function lifecycleHarness(){
  const window=surface(),document=surface(),orientation=surface();document.hidden=false;
  const input={joyId:31,x:1,z:0,gamepadX:0,gamepadZ:0,gamepadHug:false,gamepadPrevious:[]};
  let clears=0,pauses=0,suspends=0,resizes=0,pads=[];
  const context=vm.createContext({window,document,screen:{orientation},innerWidth:810,innerHeight:1080,input,settings:{quality:1},R:{resize(){resizes++;}},mode:'play',audio:{ctx:{suspend(){suspends++;return Promise.resolve();}}},clearInput(){clears++;input.joyId=null;input.x=input.z=0;},pauseGame(){pauses++;},navigator:{getGamepads:()=>pads},useSkill(){},controlled(){},cycle(){},resume(){}});
  vm.runInContext(lifecycle,context);
  return {window,document,orientation,context,input,setPads:v=>pads=v,counts:()=>({clears,pauses,suspends,resizes})};
}
test('ordinary viewport resize preserves a held joystick; portrait/landscape transition stops it',()=>{
  const h=lifecycleHarness();h.context.innerHeight=1000;h.window.fire('resize');assert.equal(h.input.joyId,31);assert.equal(h.counts().clears,0);
  h.context.innerWidth=1080;h.context.innerHeight=810;h.window.fire('resize');assert.equal(h.input.joyId,null);assert.equal(h.counts().clears,1);assert.equal(h.counts().resizes,2);
});
test('native orientation notifications reset stale input',()=>{
  const h=lifecycleHarness();h.window.fire('orientationchange');h.orientation.fire('change');assert.equal(h.counts().clears,2);
});
for(const event of ['blur','pagehide','freeze','visibilitychange'])test(`${event} clears input, pauses and suspends audio`,()=>{
  const h=lifecycleHarness();if(event==='visibilitychange')h.document.hidden=true;
  (event==='freeze'||event==='visibilitychange'?h.document:h.window).fire(event);
  assert.deepEqual(h.counts(),{clears:1,pauses:1,suspends:1,resizes:0});
});
test('visible-page notification does not interrupt movement',()=>{
  const h=lifecycleHarness();h.document.fire('visibilitychange');assert.equal(h.counts().clears,0);
});
test('gamepad polling clears disappeared pad axes and disconnect preserves a held joystick',()=>{
  const h=lifecycleHarness();h.setPads([{axes:[0,1],buttons:[]}]);h.context.gamepad();assert.equal(h.input.gamepadZ,1);
  h.setPads([]);h.context.gamepad();assert.equal(h.input.gamepadZ,0);assert.equal(h.input.joyId,31);
  h.window.fire('gamepaddisconnected');assert.equal(h.input.joyId,31);assert.equal(h.counts().clears,0);
});

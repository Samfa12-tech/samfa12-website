import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../games/banana-banana-ducky/play/index.html',import.meta.url),'utf8');
const shipped=html.slice(html.indexOf('function bindGameGestures('),html.indexOf('// ---- End game-only viewport handling. ----'));
function events(){const all=new Map();return {addEventListener(n,fn){(all.get(n)||all.set(n,[]).get(n)).push(fn);},fire(n,e={}){for(const fn of all.get(n)||[])fn(e);}};}
function viewport(v={width:810,height:1080,scale:1,offsetLeft:0,offsetTop:0}){
  const vv=Object.assign(events(),v),surface={style:{}};let resets=0,resizes=0;
  const context=vm.createContext({window:{visualViewport:vv},innerWidth:810,innerHeight:1080});vm.runInContext(shipped,context);
  const manager=context.bindGameViewport(surface,{reset(){resets++;},resize(){resizes++;}});
  return {vv,surface,manager,counts:()=>({resets,resizes})};
}
test('actual visual viewport scale is countered on the game surface without changing browser zoom metadata',()=>{
  const h=viewport();assert.equal(h.surface.style.width,'810px');Object.assign(h.vv,{width:405,height:540,scale:2});h.vv.fire('resize');
  assert.equal(h.surface.style.width,'810px');assert.equal(h.surface.style.height,'1080px');assert.equal(h.surface.style.transform,'translate(0px,0px) scale(0.5)');assert.deepEqual(h.counts(),{resets:1,resizes:1});
  const meta=html.match(/<meta name="viewport"[^>]+>/)[0];assert.ok(!/user-scalable|maximum-scale|minimum-scale/.test(meta));
});
test('visual viewport panning follows both offsets and resets stale coordinates without reallocating the canvas',()=>{
  const h=viewport();Object.assign(h.vv,{offsetLeft:85,offsetTop:110});h.vv.fire('scroll');assert.equal(h.surface.style.transform,'translate(85px,110px) scale(1)');assert.deepEqual(h.counts(),{resets:1,resizes:1});
});
test('toolbar height changes fit the surface while preserving held movement',()=>{
  const h=viewport();h.vv.height=950;h.vv.fire('resize');assert.equal(h.surface.style.height,'950px');assert.deepEqual(h.counts(),{resets:0,resizes:2});
});
test('duplicate visual viewport events and fractional jitter do not reset input or resize repeatedly',()=>{
  const h=viewport();h.vv.fire('resize');h.vv.width+=.1;h.vv.offsetTop+=.1;h.vv.fire('scroll');assert.deepEqual(h.counts(),{resets:0,resizes:1});
});
test('returning from zoom restores the viewport and clears the old gesture coordinate frame',()=>{
  const h=viewport();Object.assign(h.vv,{width:405,height:540,scale:2,offsetLeft:70,offsetTop:90});h.vv.fire('resize');Object.assign(h.vv,{width:810,height:1080,scale:1,offsetLeft:0,offsetTop:0});h.vv.fire('resize');assert.equal(h.surface.style.transform,'translate(0px,0px) scale(1)');assert.deepEqual(h.counts(),{resets:2,resizes:1});
});
test('browsers without visualViewport use normal layout dimensions',()=>{
  const context=vm.createContext({window:{},innerWidth:1080,innerHeight:810});vm.runInContext(shipped,context);const surface={style:{}};context.bindGameViewport(surface,{resize(){},reset(){throw Error('Unexpected reset')}});assert.equal(surface.style.width,'1080px');assert.equal(surface.style.height,'810px');
});
test('scene projection and ground hit testing round-trip through scaled and offset canvas bounds',()=>{
  const methods=html.split('\n').filter(s=>/^    (clientPoint|project|ground)\(/.test(s));
  const Renderer=vm.runInNewContext('(class {\n'+methods.join('\n')+'\n})');const r=new Renderer();Object.assign(r,{width:810,height:1080,aspect:.75,cam:{x:-2,z:7,half:12,targetY:.5,elev:.9},canvas:{getBoundingClientRect:()=>({left:85,top:110,width:405,height:540})}});
  for(const [x,z]of[[-2,7],[4,-3],[-9,12]]){const logical=r.project(x,0,z),world=r.ground(85+logical.x/2,110+logical.y/2);assert.ok(Math.abs(world.x-x)<1e-8);assert.ok(Math.abs(world.z-z)<1e-8);}
});
function gestures(){
  const window=events();let active=true,clicks=0,prevented=0;
  const button={disabled:false,click(){clicks++;},contains:target=>target===button};
  const target={closest:selector=>selector==='button'?button:target};
  const context=vm.createContext({window,document:{elementFromPoint:()=>button}});vm.runInContext(shipped,context);const guard=context.bindGameGestures({active:()=>active});
  const touch=(id,x=50,y=70)=>({identifier:id,clientX:x,clientY:y,target});
  const fire=(name,changed)=>window.fire(name,{target,cancelable:true,changedTouches:changed,preventDefault(){prevented++;}});
  return {window,button,target,touch,fire,guard,setActive:v=>active=v,counts:()=>({clicks,prevented})};
}
test('rapid repeated touch taps suppress native defaults and activate the existing button exactly once each',()=>{
  const h=gestures();for(let n=0;n<6;n++){h.fire('touchstart',[h.touch(n)]);h.fire('touchend',[h.touch(n)]);}assert.deepEqual(h.counts(),{clicks:6,prevented:12});
});
test('cooldown-disabled buttons still guard gestures without invoking actions',()=>{
  const h=gestures();h.button.disabled=true;h.fire('touchstart',[h.touch(1)]);h.fire('touchend',[h.touch(1)]);assert.deepEqual(h.counts(),{clicks:0,prevented:2});
});
test('dragging, cancelling and resetting a touch do not activate its old button',()=>{
  const h=gestures();h.fire('touchstart',[h.touch(1)]);h.fire('touchend',[h.touch(1,100,70)]);h.fire('touchstart',[h.touch(2)]);h.fire('touchcancel',[h.touch(2)]);h.fire('touchstart',[h.touch(3)]);h.guard.reset();h.fire('touchend',[h.touch(3)]);assert.equal(h.counts().clicks,0);
});
test('each simultaneous touch owns its own tap and releasing one preserves the other',()=>{
  const h=gestures();h.fire('touchstart',[h.touch(1),h.touch(2)]);h.fire('touchend',[h.touch(2)]);assert.equal(h.counts().clicks,1);h.fire('touchend',[h.touch(1)]);assert.equal(h.counts().clicks,2);
});
test('game gesture fallback prevents Safari gestures and double-click only on active game controls',()=>{
  const h=gestures();for(const name of['gesturestart','gesturechange','dblclick'])h.fire(name,[]);assert.equal(h.counts().prevented,3);h.setActive(false);h.fire('gesturestart',[]);assert.equal(h.counts().prevented,3);
  h.setActive(true);h.window.fire('gesturestart',{target:{closest:()=>null},cancelable:true,preventDefault(){throw Error('Non-game gesture prevented')}});
});
test('menu/help touches retain their native behavior',()=>{
  const h=gestures();h.setActive(false);h.fire('touchstart',[h.touch(1)]);h.fire('touchend',[h.touch(1)]);assert.deepEqual(h.counts(),{clicks:0,prevented:0});
});

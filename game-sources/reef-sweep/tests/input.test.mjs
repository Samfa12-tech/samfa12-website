import test from 'node:test';
import assert from 'node:assert/strict';
import { InputController, gamepadKey, gamepadSelectionKey, knownBackboneProfile } from '../build/input.js';
import { DEFAULT_SETTINGS } from '../build/game/data.js';
import { SaveStore, MemoryStorage } from '../build/game/profile.js';

class Surface {
    handlers = new Map();
    addEventListener(name, fn) { const handlers = this.handlers.get(name) || []; handlers.push(fn); this.handlers.set(name, handlers); }
    send(name, extra = {}) { for (const fn of this.handlers.get(name) || []) fn({ pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100, preventDefault() {}, ...extra }); }
    focus() {}
    setPointerCapture() {}
}
function setup(locked = false, toggleDraw = false) {
    const canvas = new Surface(), win = new Surface(), doc = new Surface();
    doc.pointerLockElement = locked ? canvas : null;
    doc.getElementById = () => null;
    doc.exitPointerLock = () => { doc.pointerLockElement = null; };
    canvas.requestPointerLock = () => Promise.reject(new Error('Host denies capture'));
    globalThis.window = win;
    globalThis.document = doc;
    globalThis.matchMedia = () => ({ matches: false });
    Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
    const commands = [];
    const settings = structuredClone(DEFAULT_SETTINGS); settings.toggleDraw = toggleDraw;
    const input = new InputController(canvas, settings, cmd => commands.push(cmd));
    input.setActive(true); input.sample(1/60);
    return { canvas, win, doc, input, commands };
}
function touchSetup(action='spear') {
    const canvas=new Surface(), win=new Surface(), doc=new Surface(), joy=new Surface(), button=new Surface();
    const knob={style:{transform:''}}, commands=[];
    button.dataset={touch:action}; button.classList={add(){},remove(){}};
    button.setPointerCapture=()=>{}; joy.setPointerCapture=()=>{}; joy.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
    doc.pointerLockElement=null; doc.getElementById=id=>id==='joystick'?joy:id==='joy-knob'?knob:null; doc.querySelectorAll=()=>[button]; doc.exitPointerLock=()=>{};
    globalThis.window=win; globalThis.document=doc; globalThis.matchMedia=()=>({matches:true});
    Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>[]},configurable:true});
    let input; input=new InputController(canvas,structuredClone(DEFAULT_SETTINGS),cmd=>{commands.push(cmd);if(cmd==='watch')input.setWatchRaised(!input.watchRaised);}); input.setActive(true); input.mountTouch();
    return {button,input,commands};
}
test('denied mouse capture still supports first-press draw, drag aim and one release', () => {
    const {canvas, win, input} = setup();
    canvas.send('pointerdown');
    assert.equal(input.sample(1/60).draw, true);
    win.send('pointermove', {clientX: 180, clientY: 120});
    const frame = input.sample(1/60);
    assert.ok(frame.lookX > .1 && frame.lookY > 0);
    win.send('pointerup');
    assert.equal(input.sample(1/60).release, true);
    assert.equal(input.sample(1/60).release, false);
    assert.equal(input.sample(1/60).draw, false);
});
test('locked mouse uses relative motion while drawing', () => {
    const {canvas,win,input} = setup(true);
    canvas.send('pointerdown'); win.send('pointermove',{movementX:40,movementY:-20});
    const frame=input.sample(1/60);
    assert.ok(frame.draw && frame.lookX>0 && frame.lookY<0);
});
test('right drag aims without drawing a spear', () => {
    const {canvas,win,input} = setup();
    canvas.send('pointerdown',{button:2}); win.send('pointermove',{clientX:170});
    const frame=input.sample(1/60);
    assert.ok(frame.lookX>0); assert.equal(frame.draw,false);
});
test('uncaptured mouse movement over the scene looks without drawing or jumping on entry', () => {
    const {canvas,win,input}=setup();
    win.send('pointermove',{target:canvas,clientX:500,clientY:300});
    assert.equal(input.sample(1/60).lookX,0);
    win.send('pointermove',{target:canvas,clientX:580,clientY:340});
    const frame=input.sample(1/60);
    assert.ok(frame.lookX>.1 && frame.lookY>0);
    assert.equal(frame.draw,false); assert.equal(frame.release,false);
    canvas.send('pointerleave');
    win.send('pointermove',{target:canvas,clientX:100,clientY:100});
    assert.equal(input.sample(1/60).lookX,0);
});
test('HUD hover and paused scene movement never steer', () => {
    const {canvas,win,input}=setup();
    win.send('pointermove',{target:canvas});
    win.send('pointermove',{target:{},clientX:600});
    assert.equal(input.sample(1/60).lookX,0);
    input.setActive(false);
    win.send('pointermove',{target:canvas,clientX:700});
    assert.equal(input.sample(1/60).lookX,0);
});
for (const boundary of ['pointercancel','blur','lostpointercapture','pause']) test(`${boundary} cancels a held spear without a release`, () => {
    const {canvas,win,input}=setup(); canvas.send('pointerdown');
    if(boundary==='pause') input.setActive(false);
    else if(boundary==='lostpointercapture') canvas.send(boundary);
    else win.send(boundary);
    win.send('pointerup');
    if(boundary==='pause') input.setActive(true);
    const frame=input.sample(1/60);
    assert.equal(frame.draw,false); assert.equal(frame.release,false); assert.equal(frame.cancelDraw,true);
});
test('normal capture transfer does not cancel draw, unlock does pause', () => {
    const {canvas,doc,input,commands}=setup(); canvas.send('pointerdown');
    doc.pointerLockElement=canvas; canvas.send('lostpointercapture');
    assert.equal(input.sample(1/60).draw,true);
    doc.pointerLockElement=null; doc.send('pointerlockchange');
    assert.deepEqual(commands,['pause']); assert.equal(input.sample(1/60).release,false);
});
test('mouse fallback respects toggle draw', () => {
    const {canvas,win,input}=setup(false,true); canvas.send('pointerdown'); win.send('pointerup');
    assert.equal(input.sample(1/60).draw,true);
    canvas.send('pointerdown'); const frame=input.sample(1/60);
    assert.equal(frame.draw,false); assert.equal(frame.release,true);
});
test('the watch key is a rising-edge command and leaves pause and chart bindings alone', () => {
    const {win,input,commands}=setup();
    win.send('keydown',{code:'KeyV',repeat:false});
    win.send('keydown',{code:'KeyV',repeat:true});
    win.send('keyup',{code:'KeyV'});
    assert.deepEqual(commands,['watch']);
    assert.equal(input.sample(1/60).draw,false);
});
test('raising the watch cancels held keyboard or touch spear state without a release', () => {
    const {input}=setup();
    input.keys.add('Mouse0');
    assert.equal(input.sample(1/60).draw,true);
    input.touch.add('spear');
    input.setWatchRaised(true);
    const raised=input.sample(1/60);
    assert.equal(raised.draw,false); assert.equal(raised.release,false); assert.equal(raised.cancelDraw,true);
    input.setWatchRaised(false);
    const lowered=input.sample(1/60);
    assert.equal(lowered.draw,false); assert.equal(lowered.release,false);
});
test('a keyboard spear press lowers the watch and is consumed until physical key release', () => {
    const {win,input,commands}=setup();
    input.command=action=>{commands.push(action);if(action==='watch')input.setWatchRaised(!input.watchRaised);};
    input.setWatchRaised(true);
    win.send('keydown',{code:'KeyR',repeat:false});
    assert.equal(input.watchRaised,false); assert.deepEqual(commands,['watch']);
    assert.equal(input.sample(1/60).draw,false);
    win.send('keydown',{code:'KeyR',repeat:true});
    assert.equal(input.sample(1/60).draw,false,'the held press cannot resume after it lowers the watch');
    win.send('keyup',{code:'KeyR'});
    win.send('keydown',{code:'KeyR',repeat:false});
    assert.equal(input.sample(1/60).draw,true,'a fresh press after release works normally');
});
test('raising the watch during a real touch spear hold cancels that pointer and prevents a later release', () => {
    const {button,input}=touchSetup();
    button.send('pointerdown',{pointerId:4,pointerType:'touch',button:0,clientX:40,clientY:60});
    assert.equal(input.sample(1/60).draw,true);
    input.setWatchRaised(true);
    button.send('pointerup',{pointerId:4,pointerType:'touch',button:0});
    const frame=input.sample(1/60);
    assert.equal(frame.draw,false); assert.equal(frame.release,false); assert.equal(frame.cancelDraw,true);
});
test('a touch draw press lowers the watch but that same pointer cannot draw or release a strike', () => {
    const {button,input,commands}=touchSetup(); input.setWatchRaised(true);
    button.send('pointerdown',{pointerId:8,pointerType:'touch',button:0,clientX:40,clientY:60});
    assert.equal(input.watchRaised,false); assert.deepEqual(commands,['watch']);
    assert.equal(input.sample(1/60).draw,false);
    button.send('pointerup',{pointerId:8,pointerType:'touch',button:0});
    const frame=input.sample(1/60); assert.equal(frame.draw,false); assert.equal(frame.release,false);
});
test('touch interact lowers the watch and consumes that press instead of starting work', () => {
    const {button,input,commands}=touchSetup('interact'); input.setWatchRaised(true);
    button.send('pointerdown',{pointerId:9,pointerType:'touch',button:0,clientX:40,clientY:60});
    assert.equal(input.watchRaised,false); assert.deepEqual(commands,['watch']);
    assert.equal(input.sample(1/60).interact,false);
    button.send('pointerup',{pointerId:9,pointerType:'touch',button:0});
    assert.equal(input.sample(1/60).interact,false);
});
test('standard gamepad watch click uses its own edge and does not retrigger while held', () => {
    const {input,commands}=setup();
    const pad={id:'Standard Pad',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    setPads(pad); pad.buttons[10]={pressed:true,value:1}; input.sample(1/60); input.sample(1/60);
    assert.deepEqual(commands,['watch']);
    pad.buttons[10]={pressed:false,value:0}; input.sample(1/60);
    pad.buttons[10]={pressed:true,value:1}; input.sample(1/60);
    assert.deepEqual(commands,['watch','watch']);
});
test('a gamepad spear press lowers the watch but cannot draw until the trigger is released and pressed again', () => {
    const {input,commands}=setup();
    input.command=action=>{commands.push(action);if(action==='watch')input.setWatchRaised(!input.watchRaised);};
    const pad={id:'Standard Pad',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    setPads(pad); input.setWatchRaised(true);
    pad.buttons[7]={pressed:true,value:1};
    assert.equal(input.sample(1/60).draw,false); assert.equal(input.watchRaised,false);
    assert.deepEqual(commands,['watch']);
    assert.equal(input.sample(1/60).draw,false);
    pad.buttons[7]={pressed:false,value:0}; input.sample(1/60);
    pad.buttons[7]={pressed:true,value:1};
    assert.equal(input.sample(1/60).draw,true);
});
test('a gamepad interact press lowers the watch but cannot start work until a fresh press', () => {
    const {input,commands}=setup();
    input.command=action=>{commands.push(action);if(action==='watch')input.setWatchRaised(!input.watchRaised);};
    const pad={id:'Standard Pad',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    setPads(pad); input.setWatchRaised(true); pad.buttons[0]={pressed:true,value:1};
    assert.equal(input.sample(1/60).interact,false); assert.equal(input.watchRaised,false);
    assert.deepEqual(commands,['watch']); assert.equal(input.sample(1/60).interact,false);
    pad.buttons[0]={pressed:false,value:0}; input.sample(1/60);
    pad.buttons[0]={pressed:true,value:1}; assert.equal(input.sample(1/60).interact,true);
});
function backbonePad() {
    const buttons = Array.from({length: 17}, () => ({pressed:false,value:0}));
    return {id:'Backbone One (Vendor: 358a Product: 0204)',mapping:'',index:0,connected:true,axes:[0,0,0,-1,-1,0,0,0,0,1.2857144],buttons};
}
function setPads(...pads) { Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>pads},configurable:true}); }
test('exact raw USB Backbone preset uses right stick axes 2 and 5 and ignores idle trigger axes', () => {
    const {input,commands}=setup(); const pad=backbonePad(); setPads(pad);
    assert.equal(knownBackboneProfile(pad).axes.lookY.index,5);
    assert.match(input.controllerStatus().test,/Deadzone move .*active/,'known preset can be checked without running the full wizard');
    pad.axes[0]=.8; pad.axes[1]=-.7; pad.axes[2]=.9; pad.axes[3]=-1; pad.axes[4]=-1; pad.axes[5]=-.6;
    const f=input.sample(1/60);
    assert.ok(f.moveX>.5 && f.moveZ>.5); assert.ok(f.lookX>0 && f.lookY<0); assert.equal(f.draw,false);
    pad.axes[3]=.9; assert.equal(input.sample(1/60).draw,true,'right trigger axis draws the spear');
    pad.axes[3]=-1; assert.equal(input.sample(1/60).release,true,'trigger release makes one deliberate strike');
    pad.buttons[6]={pressed:true,value:1}; input.sample(1/60); assert.deepEqual(commands,['light']);
});
test('guided map samples neutral, discovers signed sticks, and waits for release between button and axis captures', () => {
    const {input,commands}=setup(); const pad=backbonePad(); pad.axes=[0,0,0,-1,-1,0]; setPads(pad);
    input.selectPad(gamepadSelectionKey(pad)); assert.equal(input.startCalibration(),true);
    for(let i=0;i<12;i++) input.sample(1/60);
    assert.equal(input.calibrationStatus().phase,'axes');
    const directions=[[0,.9],[1,-.9],[2,.9],[5,.9]];
    for(const [step,[index,value]] of directions.entries()){pad.axes[index]=value;input.sample(1/60);assert.equal(input.calibrationStatus().phase,step===3?'buttons':'axes');if(step===3)assert.match(input.calibrationStatus().prompt,/return the sticks/i);pad.axes[index]=index===3||index===4?-1:0;input.sample(1/60);}
    assert.equal(input.calibrationStatus().phase,'buttons');
    pad.axes[3]=1; input.sample(1/60); assert.equal(input.calibrationStatus().step,6); assert.equal(input.calibrationStatus().prompt,'Release all controls and return the sticks to neutral.');
    pad.axes[3]=-1; input.sample(1/60);
    const actionButtons=[0,3,1,2,4,5,11,6,8,10,0,1,12,13];
    for(const index of actionButtons){pad.buttons[index]={pressed:true,value:1};input.sample(1/60);pad.buttons[index]={pressed:false,value:0};input.sample(1/60);}
    assert.equal(input.calibrationStatus().completed,true);
    assert.equal(input.calibration.profile.axes.lookY.index,5); assert.equal(input.calibration.profile.axes.moveZ.sign,-1);
    assert.equal(input.calibration.profile.axisButtons.spear.index,3);
    assert.equal(input.useCalibration(),true);
    assert.equal(input.settings.gamepads[gamepadKey(pad)].axisButtons.spear.value,1);
    assert.equal(input.calibration,null);
    assert.deepEqual(commands,[],'captured controls never trigger game actions during calibration');
    const store=new SaveStore(new MemoryStorage()); store.saveSettings(input.settings);
    const loaded=store.settings(); assert.deepEqual(loaded.gamepads[gamepadKey(pad)],input.settings.gamepads[gamepadKey(pad)]);
});
test('disconnect cancels a held controller draw without releasing a strike', () => {
    const {input}=setup(); const pad=backbonePad(); setPads(pad); pad.axes[3]=1;
    assert.equal(input.sample(1/60).draw,true);
    setPads(); const f=input.sample(1/60);
    assert.equal(f.draw,false); assert.equal(f.release,false); assert.equal(f.cancelDraw,true);
});
test('a spear trigger held across pause is blocked until neutral and cannot charge or fire', () => {
    const {input}=setup(); const pad=backbonePad(); setPads(pad); input.selectPad(gamepadSelectionKey(pad));
    input.setActive(false); pad.axes[3]=1; input.setActive(true);
    let frame=input.sample(1/60); assert.equal(frame.draw,false); assert.equal(frame.release,false);
    pad.axes[3]=-1; frame=input.sample(1/60); assert.equal(frame.draw,false); assert.equal(frame.release,false);
    pad.axes[3]=1; frame=input.sample(1/60); assert.equal(frame.draw,true);
    pad.axes[3]=-1; frame=input.sample(1/60); assert.equal(frame.release,true);
});
test('the selected controller is used when more than one pad is connected', () => {
    const {input}=setup();
    const first={id:'Pad One',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    const second={id:'Pad Two',mapping:'standard',index:1,connected:true,axes:[.9,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    setPads(first,second); input.selectPad(gamepadSelectionKey(second));
    assert.ok(input.sample(1/60).moveX>.5);
});
test('high graphics preference survives a fresh settings-store reload', () => {
    const storage=new MemoryStorage(), before=new SaveStore(storage), settings=before.settings();
    settings.quality='high'; before.saveSettings(settings);
    assert.equal(new SaveStore(storage).settings().quality,'high');
});
test('legacy Backbone calibration gains a spare watch click without remapping its measured controls',()=>{
    const {input,commands}=setup(),pad=backbonePad();setPads(pad);
    const saved=knownBackboneProfile(pad);delete saved.buttons.watch;
    const axes=structuredClone(saved.axes),triggers=structuredClone(saved.axisButtons);
    input.settings.gamepads={[gamepadKey(pad)]:saved};input.sample(1/60);
    pad.buttons[10]={pressed:true,value:1};input.sample(1/60);
    assert.ok(commands.includes('watch'));assert.deepEqual(saved.axes,axes);assert.deepEqual(saved.axisButtons,triggers);
});
test('legacy calibrated controllers keep an occupied stick click assigned to its original action',()=>{
    const {input,commands}=setup(),pad=backbonePad();setPads(pad);
    const saved=knownBackboneProfile(pad);delete saved.buttons.watch;saved.buttons.interact=10;
    input.settings.gamepads={[gamepadKey(pad)]:saved};input.sample(1/60);
    pad.buttons[10]={pressed:true,value:1};const frame=input.sample(1/60);
    assert.equal(saved.buttons.watch,undefined);assert.equal(frame.interact,true);assert.ok(!commands.includes('watch'));
});

test('a deferred mouse capture cannot lock a paused conversation',async()=>{
 const {canvas,doc,input,commands}=setup();let grant;
 canvas.requestPointerLock=()=>new Promise(resolve=>{grant=resolve});
 input.capture();input.setActive(false);doc.pointerLockElement=canvas;grant();await Promise.resolve();
 assert.equal(doc.pointerLockElement,null);assert.deepEqual(commands,[]);
 // Legacy requestPointerLock returns void; its event path must also release.
 doc.pointerLockElement=canvas;doc.send('pointerlockchange');assert.equal(doc.pointerLockElement,null);
});

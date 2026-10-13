import {runtimeAssetUrl} from './runtime-assets.js';
import {BALLISTA_MECHANISM} from './defence-core.js';
export {BALLISTA_MECHANISM} from './defence-core.js';
export const BALLISTA_ARTICULATED_ASSET='assets/meshy/runtime/briarhold-ballista-articulated-512.glb';
const DEFAULT_ARC=Object.freeze({halfYaw:Math.PI*.36,minPitch:-Math.PI/5,maxPitch:Math.PI/6});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
const finite=v=>Number.isFinite(Number(v));
/** A paused/background gap never becomes reload/fall progress on resume. */
export function createDefencePresentationClock() {
  let paused=false,last=null;
  return {setPaused(value){const next=Boolean(value);if(next!==paused)last=null;paused=next;return paused;},
    advance(now){const stamp=Number(now);if(!Number.isFinite(stamp))return 0;const delta=last===null?0:Math.max(0,stamp-last);last=stamp;return paused?0:Math.min(1,delta);}};
}

export function ballistaAim(socket,target) {
  if (!target||![target.x,target.y,target.z].every(finite)) return null;
  const dx=target.x-socket.x,dz=target.z-socket.z,dy=target.y-(socket.y+BALLISTA_MECHANISM.pivotHeight);
  const arc=socket.artillery??socket.ballistaArc??{};
  const halfYaw=arc.halfYaw??arc.yawHalfAngle??DEFAULT_ARC.halfYaw;
  const yaw=clamp(angle(Math.atan2(dx,dz)-(socket.facing||0)),-halfYaw,halfYaw);
  const pitch=clamp(Math.atan2(dy,Math.hypot(dx,dz)),arc.minPitch??arc.pitchMin??DEFAULT_ARC.minPitch,arc.maxPitch??arc.pitchMax??DEFAULT_ARC.maxPitch);
  return {yaw,pitch};
}
export function ballistaMuzzle(socket,aim={yaw:0,pitch:0}) {
  const yaw=(socket.facing||0)+aim.yaw,pitch=aim.pitch,l=BALLISTA_MECHANISM.muzzleLength;
  return {x:socket.x+Math.sin(yaw)*Math.cos(pitch)*l,y:socket.y+BALLISTA_MECHANISM.pivotHeight+Math.sin(pitch)*l,z:socket.z+Math.cos(yaw)*Math.cos(pitch)*l};
}
export function ballistaCyclePose(age,interval=1.25) {
  const t=clamp(age/Math.max(.2,interval),0,1);
  const release=t<.12?Math.sin(t/.12*Math.PI/2):t<.22?1:Math.max(0,1-(t-.22)/.58);
  return {progress:t,release,recoil:t<.18?Math.sin(t/.18*Math.PI)*.16:0,loaded:t>=.82,winchTurns:clamp((t-.22)/.58,0,1)*2.5,catchLift:release*.38};
}
function nodeMap(root) {
  const names=['stationary_root','yaw_mount','pitch_stock','left_limb','right_limb','string','catch','winch','seated_bolt','muzzle','heavy_bolt_variant','fast_winch_variant'];
  const result=new Map();
  for(const node of [root,...root.getDescendants(false)]) for(const name of names) {
    if(node.name===name||node.name.endsWith(`.${name}`)) result.set(name,node);
  }
  return result;
}

export function createBallistaAssetTemplate({BABYLON:B,scene,mobileTextures=false}) {
  const state={status:'loading',instances:0,meshes:0,error:null};let source=null;
  const path=runtimeAssetUrl(mobileTextures?BALLISTA_ARTICULATED_ASSET.replace('-512.glb','-256.glb'):BALLISTA_ARTICULATED_ASSET);
  const slash=path.lastIndexOf('/')+1;
  const ready=B.SceneLoader.ImportMeshAsync('',path.slice(0,slash),path.slice(slash),scene).then(result=>{
    source=result.meshes[0];const nodes=nodeMap(source);
    for(const name of ['stationary_root','yaw_mount','pitch_stock','left_limb','right_limb','string','catch','winch','seated_bolt','muzzle']) if(!nodes.has(name)) throw new Error(`missing ballista node ${name}`);
    for(const mesh of result.meshes){mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=true;if(mesh.material){mesh.material.maxSimultaneousLights=5;if('roughness'in mesh.material)mesh.material.roughness=.72;}}
    source.setEnabled(false);state.status='ready';state.meshes=result.meshes.filter(m=>m.getTotalVertices?.()>0).length;return source;
  }).catch(error=>{source?.dispose(false,true);source=null;state.status='fallback';state.error=String(error?.message||error);return null;});
  return {state,ready,clone(name,parent){if(!source)return null;const root=source.clone(name,parent,false);root.rotate(B.Axis.Y,Math.PI,B.Space.LOCAL);root.setEnabled(true);state.instances++;return root;},release(){state.instances=Math.max(0,state.instances-1);}};
}

export function createBallistaPresentation({BABYLON:B,scene,socket,template,mats={},name='ballista',preview=false}) {
  const root=new B.TransformNode(name,scene);root.position.set(socket.x,socket.y,socket.z);root.rotation.y=socket.facing||0;
  const imported=template?.clone(`${name}:import`,root);let nodes,forward=1;
  if(imported){nodes=nodeMap(imported);forward=Math.sign(nodes.get('muzzle').position.z)||-1;}
  else {
    nodes=new Map();const empty=(id,parent,y=0)=>{const n=new B.TransformNode(id,scene);n.parent=parent;n.position.y=y;nodes.set(id,n);return n;};
    const box=(id,parent,w,h,d,x=0,y=0,z=0)=>{const m=B.MeshBuilder.CreateBox(id,{width:w,height:h,depth:d},scene);m.parent=parent;m.position.set(x,y,z);m.material=mats.woodLight||mats.wood;return m;};
    box('stationary_base',root,3.4,.62,3.2,0,.31);
    const yaw=empty('yaw_mount',root),stock=empty('pitch_stock',yaw,2.2);
    box('fallback_stock',stock,.62,.45,4.4);
    for(const [id,x]of[['left_limb',-1.2],['right_limb',1.2]]){const limb=empty(id,stock);limb.position.set(x,0,1.35);box(`${id}:bow`,limb,2,.2,.25);}
    empty('string',stock);empty('catch',stock);empty('winch',stock);
    const bolt=empty('seated_bolt',stock);box('fallback_bolt',bolt,.09,.09,3,0,.28,.4);
    const muzzle=empty('muzzle',stock);muzzle.position.z=2.2;
  }
  for(const mesh of root.getChildMeshes(false)){mesh.isPickable=false;mesh.checkCollisions=false;mesh.visibility=preview?.86:1;mesh.metadata={...(mesh.metadata??{}),fortification:'ballista',mechanism:true};}
  const stock=nodes.get('pitch_stock'),stockRest=stock.position.clone(),string=nodes.get('string');
  for(const name of ['left_limb','right_limb','catch','winch','fast_winch_variant']) {
    const node=nodes.get(name);if(node)node.rotationQuaternion=null;
  }
  const original=string?.getVerticesData?.(B.VertexBuffer.PositionKind)?.slice();
  let stringVertices=original?.slice();if(original){string.makeGeometryUnique();string.markVerticesDataAsUpdatable(B.VertexBuffer.PositionKind,true);}
  let aim={yaw:0,pitch:0},desired={...aim},age=Infinity,interval=1.25,branch='base',lastEvent=null,shots=0,disposed=false,enabled=true;
  function apply(){
    nodes.get('yaw_mount').rotationQuaternion=null;nodes.get('yaw_mount').rotation.y=forward*aim.yaw;
    stock.rotationQuaternion=null;stock.rotation.x=-forward*aim.pitch;
    const pose=Number.isFinite(age)?ballistaCyclePose(age,interval):{release:0,recoil:0,loaded:true,winchTurns:0,catchLift:0,progress:1};
    stock.position.copyFrom(stockRest);stock.position.z-=forward*pose.recoil;
    nodes.get('left_limb').rotation.y=-forward*pose.release*.12;nodes.get('right_limb').rotation.y=forward*pose.release*.12;
    nodes.get('catch').rotation.x=pose.catchLift;nodes.get('winch').rotation.x=pose.winchTurns*Math.PI*2;
    nodes.get('seated_bolt').setEnabled(pose.loaded);
    nodes.get('heavy_bolt_variant')?.setEnabled(branch==='heavyBolt'&&pose.loaded);
    nodes.get('fast_winch_variant')?.setEnabled(branch==='fastWinch');
    if(nodes.get('fast_winch_variant'))nodes.get('fast_winch_variant').rotation.x=pose.winchTurns*Math.PI*2;
    if(original){for(let i=0;i<original.length;i+=3)stringVertices[i+2]=original[i+2]+forward*pose.release*2.25*Math.max(0,1-Math.abs(original[i])/2.1);string.updateVerticesData(B.VertexBuffer.PositionKind,stringVertices,false,false);}
    return pose;
  }
  apply();
  return {root,meshes:[root],imported:Boolean(imported),
    track(target,options={}){if(disposed||!enabled)return false;desired=ballistaAim(socket,target)||{yaw:0,pitch:0};interval=Math.max(.2,Number(options.intervalSeconds)||interval);branch=options.branch||branch;return {...desired};},
    fire(event={}){if(disposed||!enabled||event.eventId&&event.eventId===lastEvent)return null;lastEvent=event.eventId||null;this.track(event.target,event);aim={...desired};age=0;shots++;apply();root.computeWorldMatrix(true);for(const node of root.getDescendants(false))node.computeWorldMatrix?.(true);return this.muzzle();},
    muzzle(){const n=nodes.get('muzzle');n.computeWorldMatrix(true);const p=n.getAbsolutePosition();return {x:p.x,y:p.y,z:p.z};},
    update(dt){if(disposed)return;const step=Math.max(0,Number(dt)||0);age+=step;const blend=1-Math.exp(-Math.min(step,.25)*7);aim.yaw+=angle(desired.yaw-aim.yaw)*blend;aim.pitch+=(desired.pitch-aim.pitch)*blend;return apply();},
    setStatus(status={}){const next=status.branch||branch;enabled=!(status.disabledForWave===true||status.disabled===true||status.active===false);if(next!==branch||!enabled){branch=next;this.reset({branch});}return apply();},
    reset(options={}){age=Infinity;aim={yaw:0,pitch:0};desired={...aim};branch=options.branch||branch;lastEvent=null;return apply();},
    diagnostics(){return {imported:Boolean(imported),aim:{...aim},desired:{...desired},age:Number.isFinite(age)?age:null,interval,branch,shots,muzzle:this.muzzle(),base:root.position.asArray()};},
    dispose(){if(disposed)return;disposed=true;root.dispose(false,false);if(imported)template.release();}
  };
}

import {runtimeAssetUrl} from './runtime-assets.js';
import {DEFENCE_TRIAL_PARAMETERS} from './defence-core.js';
export const DROP_RACK_ASSET='assets/meshy/runtime/briarhold-gate-drop-rack-512.glb';
export function dropRackPose(age,dropHeight=8.12){const t=Math.max(0,Number(age)||0),p=DEFENCE_TRIAL_PARAMETERS;return {warning:t<p.dropWarningSeconds,drop:Math.min(1,Math.max(0,(t-p.dropWarningSeconds)/p.dropFallSeconds))**2*dropHeight,spent:t>=p.dropStrikeDelaySeconds};}
export function createDropRackAssetTemplate({BABYLON:B,scene,mobileTextures=false}) {
  let source=null;const state={status:'loading',instances:0,error:null};
  const path=runtimeAssetUrl(mobileTextures?DROP_RACK_ASSET.replace('-512.glb','-256.glb'):DROP_RACK_ASSET),slash=path.lastIndexOf('/')+1;
  const ready=B.SceneLoader.ImportMeshAsync('',path.slice(0,slash),path.slice(slash),scene).then(result=>{source=result.meshes[0];for(const mesh of result.meshes){mesh.isPickable=false;mesh.checkCollisions=false;}source.setEnabled(false);state.status='ready';return source;}).catch(e=>{state.status='fallback';state.error=String(e?.message||e);return null;});
  return {state,ready,clone(name,parent){if(!source)return null;const c=source.clone(name,parent,false);c.rotate(B.Axis.Y,Math.PI,B.Space.LOCAL);c.setEnabled(true);state.instances++;return c;},release(){state.instances=Math.max(0,state.instances-1);}};
}
export function createDropRackPresentation({BABYLON:B,scene,socket,template,mats={},name='gate-drop-rack'}){
  const root=new B.TransformNode(name,scene);root.position.set(socket.x,socket.y,socket.z);root.rotation.y=socket.facing||0;
  const imported=template?.clone(`${name}:import`,root);let weight,latch;
  if(imported){const nodes=imported.getDescendants(false);weight=nodes.find(n=>n.name==='drop_weight'||n.name.endsWith('.drop_weight'));latch=nodes.find(n=>n.name==='release_latch'||n.name.endsWith('.release_latch'));}
  if(!weight){const frame=B.MeshBuilder.CreateBox(`${name}:procedural-frame`,{width:5.6,height:.35,depth:.4},scene);frame.parent=root;frame.position.set(0,1,-.6);frame.material=mats.woodLight;weight=B.MeshBuilder.CreateBox('drop_weight',{width:5,height:.5,depth:1.2},scene);weight.parent=root;weight.position.set(0,.44,4);weight.material=mats.wood;}
  if(latch)latch.rotationQuaternion=null;
  const rest=weight.position.clone();let age=null,eventId=null,charges=1,disposed=false,activations=0;
  const apply=()=>{const pose=age===null?{drop:charges>0?0:8.12,warning:false,spent:charges<=0}:dropRackPose(age);weight.position.copyFrom(rest);weight.position.y-=pose.drop;if(latch)latch.rotation.x=pose.warning?Math.sin(age*45)*.18:pose.spent?1.1:0;return pose;};apply();
  return {root,meshes:[root],imported:Boolean(imported),
    setStatus(status={}){const next=Number(status.charges);if(Number.isFinite(next)){if(next>charges){age=null;eventId=null;}charges=next;}return apply();},
    fire(event={}){if(disposed||event.eventId&&eventId===event.eventId)return false;eventId=event.eventId||null;age=0;charges=0;activations++;apply();return true;},
    update(dt){if(disposed)return;if(age!==null)age+=Math.max(0,Number(dt)||0);return apply();},
    reset(){age=null;eventId=null;return apply();},
    impactPoint(){weight.computeWorldMatrix(true);const p=weight.getAbsolutePosition();return {x:p.x,y:p.y,z:p.z};},
    diagnostics(){return {imported:Boolean(imported),age,charges,activations,base:root.position.asArray(),pose:apply(),weight:this.impactPoint()};},
    dispose(){if(disposed)return;disposed=true;root.dispose(false,false);if(imported)template.release();}
  };
}

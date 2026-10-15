import { Geometry, rgb, islandGeometry } from './geometry.js';
import { diveSkiff } from './assets/dive-skiff.js';
import { BAY_SITES, oceanHeight, type BoatState } from '../game/expedition.js';
import { SITES, siteUnlocked } from '../game/data.js';
import type { ReefRenderer } from './renderer.js';
import type { Profile, Settings } from '../game/types.js';
import { vec } from '../game/math.js';
export function skiffGeometry() { return Object.assign(new Geometry(),diveSkiff); }
/** Lightweight authored bay around a shared swell function. One boat draw, no physics meshes. */
export class BoatTravelRenderer {
 boat:any; wake:any; surface:any; spray:any;
 constructor(public renderer:ReefRenderer,public profile:Profile,public settings:Settings) {
  const r=renderer;r.disposeWorld();r.shadows.reset();r.camera.maxZ=900;
  const water=new Geometry(),steps=settings.quality==='high'?120:settings.quality==='low'?60:90;
  for(let iz=0;iz<=steps;iz++)for(let ix=0;ix<=steps;ix++)water.v(vec(-600+ix*1200/steps,0,-600+iz*1200/steps),vec(0,1,0),rgb('#3d9ca7'));
  for(let z=0;z<steps;z++)for(let x=0;x<steps;x++){const a=z*(steps+1)+x,b=a+steps+1;water.indices.push(a,b,a+1,b,b+1,a+1);}
  this.surface=r.mesh('open-ocean-swells',water,3);this.boat=r.mesh('lantern-dive-skiff-blender',skiffGeometry(),1);
  const wake=new Geometry();for(let i=0;i<40;i++){const z=-3-i*.5,w=.40+i*.085,start=wake.positions.length;
   wake.quad(vec(-w,0,z),vec(w,0,z),vec(w+.085,0,z-.5),vec(-w-.085,0,z-.5),rgb('#d2efe6'));
   for(let k=start;k<wake.positions.length;k+=3){const age=(-wake.positions[k+2]-3)/20,width=.40+age*3.4;wake.uvs[k/3*2]=age;wake.uvs[k/3*2+1]=wake.positions[k]/width;}
  }this.wake=r.mesh('moving-foam-wake',wake,10);
  const spray=new Geometry(),sprayCount=settings.quality==='high'?40:settings.quality==='low'?12:24;
  for(let i=0;i<sprayCount;i++){const side=i%2?1:-1,x=side*(.78+(i%5)*.05),z=2.1+(i%4)*.15,start=spray.uvs.length;
    spray.tri(vec(x-.022,.32,z),vec(x+.022,.32,z),vec(x,.39,z),rgb('#d7f5eb'));
    for(let k=start;k<spray.uvs.length;k+=2)spray.uvs[k]=(i*.61803)%1;
  }this.spray=r.mesh('pooled-bow-spray',spray,11);
  for(const [id,point] of Object.entries(BAY_SITES)){
   const g=new Geometry(),colour=rgb(siteUnlocked(profile,id as any)?'#f0bf69':'#829c9a');
   g.ellipsoid(vec(),vec(.8,.5,.8),colour,14,7);g.rod(vec(),vec(0,2.4,0),.045,.025,rgb('#e9dbaf'),7);g.box(vec(.28,2.15,0),vec(.6,.32,.025),colour);
   const buoy=r.mesh('dive-buoy-'+id,g,1);buoy.position.set(point.x,0,point.z);
  }
  // Low rocky islands frame the navigable bay; site coordinates remain open water.
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2,d=260+Math.sin(i*3)*35,g=islandGeometry(7426+i*173,7);const m=r.mesh('bay-islet-'+i,g,1);m.position.set(Math.cos(a)*d,0,Math.sin(a)*d);}
 }
 render(b:BoatState) {
  const r=this.renderer,B=(globalThis as any).BABYLON,t=b.time,height=oceanHeight(b.x,b.z,t),forward={x:Math.sin(b.yaw),z:Math.cos(b.yaw)},side={x:Math.cos(b.yaw),z:-Math.sin(b.yaw)};
  const pitch=-Math.atan2(oceanHeight(b.x+forward.x*2,b.z+forward.z*2,t)-oceanHeight(b.x-forward.x*2,b.z-forward.z*2,t),4),roll=Math.atan2(oceanHeight(b.x+side.x,b.z+side.z,t)-oceanHeight(b.x-side.x,b.z-side.z,t),2);
  this.boat.position.set(b.x,height+.20,b.z);this.boat.rotation.set(pitch,b.yaw,roll*.7);
  this.spray.setEnabled(Math.abs(b.speed)>6);this.spray.position.copyFrom(this.boat.position);this.spray.rotation.copyFrom(this.boat.rotation);
  this.wake.position.set(b.x,.06,b.z);this.wake.rotation.y=b.yaw;this.wake.setEnabled(Math.abs(b.speed)>1);this.wake.scaling.set(1,1,Math.min(1,Math.abs(b.speed)/10));
  const distance=10.5;r.camera.position.set(b.x-forward.x*distance,5.7+(this.settings.reducedMotion?0:height*.18),b.z-forward.z*distance);r.camera.rotation.set(.30,b.yaw,0);
  r.scene.clearColor=new B.Color4(.53,.75,.81,1);
  for(const m of r.materials){m.setFloat('uTime',t);m.setFloat('uSurface',0);m.setFloat('uSea',1);m.setFloat('uRadius',220);m.setFloat('uFog',.002);m.setFloat('uMotion',1);m.setFloat('uNight',0);m.setFloat('uLight',0);m.setFloat('uShadows',0);m.setFloat('uTorchShadows',0);m.setVector3('uEye',r.camera.position);m.setVector3('uForward',new B.Vector3(forward.x,0,forward.z));}
  r.engine.beginFrame();r.engine._drawCalls?.fetchNewFrame();r.scene.render();r.engine.endFrame();
 }
 drawChart(canvas:HTMLCanvasElement,b:BoatState){const c=canvas.getContext('2d')!,w=canvas.width,h=canvas.height,to=(x:number,z:number)=>[w/2+x*.52,h*.60-z*.52];c.fillStyle='#0b3540ed';c.fillRect(0,0,w,h);c.font='11px Trebuchet MS';
  for(const [id,point] of Object.entries(BAY_SITES)){const [x,y]=to(point.x,point.z);c.fillStyle=siteUnlocked(this.profile,id as any)?'#f0cf92':'#688a8a';c.beginPath();c.arc(x,y,4,0,7);c.fill();c.fillText(SITES[id as keyof typeof SITES].name,x>140?x-74:x+6,y-7);}
  const [x,y]=to(b.x,b.z);c.save();c.translate(x,y);c.rotate(b.yaw);c.fillStyle='#9ce5c6';c.beginPath();c.moveTo(0,-7);c.lineTo(-4,5);c.lineTo(4,5);c.closePath();c.fill();c.restore();c.fillStyle='#c9ded1';c.fillText('N ↑',w-28,15);
 }
}

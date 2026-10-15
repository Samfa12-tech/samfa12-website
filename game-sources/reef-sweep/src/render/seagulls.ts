import { Geometry, rgb } from './geometry.js';
import { vec, clamp } from '../game/math.js';
import type { Vec, Settings } from '../game/types.js';
import type { ReefRenderer } from './renderer.js';

/** Original herring-gull silhouette, metres/+Z forward. Wing UVs identify the
 * flexible span; body/head stay rigid. No textures, skeleton or simulation state. */
export function seagullGeometry() {
 const g=new Geometry(),white=rgb('#e0e4dd'),grey=rgb('#aebdc0'),dark=rgb('#35474d');
 g.ellipsoid(vec(0,0,0),vec(.085,.09,.23),white,12,7);
 g.ellipsoid(vec(0,.075,.19),vec(.075,.075,.085),white,10,6);
 g.tri(vec(-.028,.062,.25),vec(.028,.062,.25),vec(0,.052,.34),rgb('#d9b56a'));
 g.tri(vec(0,-.01,-.14),vec(-.09,-.025,-.34),vec(.09,-.025,-.34),white);
 for(const side of [-1,1]) {
  g.ellipsoid(vec(side*.064,.09,.225),vec(.009,.009,.008),dark,6,3);
  const start=g.positions.length/3;
  // Cambered, swept wings: broad shoulder, tapered elbow, black primary tips.
  const a=vec(side*.055,.025,.10),b=vec(side*.30,.065,.025),c=vec(side*.60,.01,-.18),d=vec(side*.36,.025,-.13),e=vec(side*.07,0,-.10);
  g.quad(a,b,d,e,grey);g.tri(b,c,d,white);
  for(let i=0;i<4;i++){
   const x=.45+i*.042,z=-.08-i*.032;
   g.tri(vec(side*x,.025,z),vec(side*(x+.09),0,z-.09),vec(side*(x-.025),.015,z-.065),i>1?dark:grey);
  }
  for(let i=start;i<g.positions.length/3;i++)g.uvs[i*2+1]=clamp((Math.abs(g.positions[i*3])-.055)/.55,0,1);
  g.rod(vec(side*.025,-.075,-.11),vec(side*.035,-.09,-.19),.008,.005,rgb('#b89b70'),5);
 }
 return g;
}

export function seagullPose(index:number,time:number,anchor:Vec,surface:number) {
 const phase=time*(.14-index*.009)+index*2.12+.16,radius=25+index*7;
 const dx=Math.cos(phase)*radius,dz=-Math.sin(phase)*radius*.70;
 return {x:anchor.x+Math.sin(phase)*radius,y:surface+8.5+(index%3)*2.3+Math.sin(phase*.8+index)*.65,z:anchor.z+22+Math.cos(phase)*radius*.70,yaw:Math.atan2(dx,dz),roll:-.17*Math.cos(phase),pitch:.035*Math.sin(phase*.7)};
}

/** A few render-only coastal birds; slow centre drift avoids a rigid escort.
 * All meshes are owned/disposed by the existing world lifecycle. */
export class Seagulls {
 meshes:any[]=[];centre=vec();lastTime:number|null=null;
 constructor(renderer:ReefRenderer,settings:Settings){
  const geometry=seagullGeometry(),count=settings.quality==='low'?3:settings.quality==='high'?5:4;
  for(let i=0;i<count;i++)this.meshes.push(renderer.mesh('coastal-seagull-'+i,geometry,13));
 }
 update(time:number,anchor:Vec,surface:number,visible:boolean) {
  const dt=this.lastTime===null?0:clamp(time-this.lastTime,0,.1);
  if(this.lastTime===null)this.centre={...anchor};
  else {const blend=1-Math.exp(-dt*.22);this.centre.x+=(anchor.x-this.centre.x)*blend;this.centre.z+=(anchor.z-this.centre.z)*blend;}
  this.lastTime=time;
  this.meshes.forEach((mesh,i)=>{mesh.setEnabled(visible);if(!visible)return;const p=seagullPose(i,time,this.centre,surface);mesh.position.set(p.x,p.y,p.z);mesh.rotation.set(p.pitch,p.yaw,p.roll);});
 }
}

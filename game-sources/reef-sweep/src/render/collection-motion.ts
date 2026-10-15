import type { Run } from '../game/types.js';
import { clamp } from '../game/math.js';
const smooth=(x:number)=>{x=clamp(x,0,1);return x*x*(3-2*x);};
/** Shared tube/spear/fish coordinates prevent independent, contradictory motion. */
export function collectionMotion(run:Run,aspect=1.6,presentation?:{progress:number;lift:number;portrait:number}){
 const mouthX=-.64*Math.min(1,aspect*aspect+.10),axis={x:0,y:-.35,z:.94};
 const progress=presentation?.progress??(run.exposed&&run.interactionId==='held'?run.interaction:0);
 // Raise the mouth first. Fish and prongs approach only once it is level.
 let approach=smooth((progress-.24)/.46),insert=clamp((progress-.70)/.30,0,1)*.8;
 if(run.transfer){const elapsed=clamp((run.time-run.transfer.started)/1.35,0,1);approach=1-smooth((elapsed-.45)/.55);insert=.8*(1-clamp(elapsed/.45,0,1));}
 const mouth={x:mouthX,y:-.55,z:1.10};
 const lift=presentation?.lift??(run.transfer?1:smooth(progress/.24));
 const tubeAngle=1.40*(presentation?.portrait??(aspect<1?1:0))*(1-lift),co=Math.cos(tubeAngle),si=Math.sin(tubeAngle);
 // Hinge beside the diver's chest, behind the mouth; the whole barrel swings down.
 const pivotY=-.50,pivotZ=.55;
 const tubePosition={x:mouth.x+.64,y:pivotY-(pivotY*co-pivotZ*si),z:pivotZ-(pivotY*si+pivotZ*co)};
 return {mouth,axis,approach,insert,tubeAngle,tubePosition,spear:{x:(mouth.x-.007)*approach,y:mouth.y*approach+axis.y*insert,z:(mouth.z-2.63)*approach+axis.z*insert}};
}

/** Render-only easing, including cancelled holds and orientation changes. */
export class CollectionRig {
 private progress=0;private lift=0;private aspect:number|null=null;private portrait=0;
 update(run:Run,aspect:number,dt:number){
  const first=this.aspect===null;dt=clamp(dt,0,.083);
  const raw=run.exposed&&run.interactionId==='held'?run.interaction:0;
  this.progress=Math.max(raw,this.progress-dt/.32);
  const target=run.transfer?1:smooth(this.progress/.24),blend=1-Math.exp(-dt*14);
  this.lift=first?target:Math.max(target,this.lift+(target-this.lift)*blend);
  this.aspect=first?aspect:this.aspect!+(aspect-this.aspect!)*blend;
  this.portrait=first?(aspect<1?1:0):this.portrait+((aspect<1?1:0)-this.portrait)*blend;
  return collectionMotion(run,this.aspect,{progress:this.progress,lift:this.lift,portrait:this.portrait});
 }
}

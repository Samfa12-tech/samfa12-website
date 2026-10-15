import type { Run } from '../game/types.js';
import { clamp } from '../game/math.js';
const smooth=(x:number)=>{x=clamp(x,0,1);return x*x*(3-2*x);};
/** Shared tube/spear/fish coordinates prevent independent, contradictory motion. */
export function collectionMotion(run:Run,aspect=1.6){
 const mouthX=aspect>=1?-.64:-.64*(aspect*aspect+.10),axis={x:0,y:-.35,z:.94};
 const progress=run.exposed&&run.interactionId==='held'?run.interaction:0;
 let approach=smooth(progress/.65),insert=clamp((progress-.65)/.35,0,1)*.8;
 if(run.transfer){const elapsed=clamp((run.time-run.transfer.started)/1.35,0,1);approach=1-smooth((elapsed-.45)/.55);insert=.8*(1-clamp(elapsed/.45,0,1));}
 const mouth={x:mouthX,y:-.55,z:1.10};
 return {mouth,axis,approach,insert,spear:{x:(mouth.x-.007)*approach,y:mouth.y*approach+axis.y*insert,z:(mouth.z-2.63)*approach+axis.z*insert}};
}

import type { Site, SiteId, Rock } from './types.js';
import { vec } from './math.js';

const mound=(x:number,z:number,cx:number,cz:number,wx:number,wz:number)=>Math.exp(0-((x-cx)/wx)**2-((z-cz)/wz)**2);
/** Revision three adds navigable landforms, retaining the original named structures.
 * The same height function drives the visible triangles, collision and target placement. */
export function expeditionFloor(site:Site,x:number,z:number,base:number) {
 const g=(cx:number,cz:number,wx:number,wz:number)=>mound(x,z,cx,cz,wx,wz);
 if(site.id==='gardens') {
  const lagoon=3.0*Math.exp(0-((x-(3+8*Math.sin((z+25)*.055)))/7.5)**2-((z+6)/39)**4);
  return base+2.7*g(-24,-13,16,24)+3.2*g(-28,30,19,14)+2.1*g(30,22,15,23)-lagoon-2.4*g(-7,23,7,17);
 }
 if(site.id==='passage')return base+3.6*g(-24,9,13,24)+2.7*g(21,-17,11,13)-3.3*g(7,42,10,18)-1.9*g(-19,36,8,12);
 if(site.id==='mangrove') {
  const west=-13+7*Math.sin((z+20)*.065),east=13+8*Math.sin((z+8)*.058);
  const branches=Math.max(Math.exp(0-((x-west)/4.6)**2),Math.exp(0-((x-east)/5.1)**2));
  // Replace straight shallow grooves with a pair of winding tidal creeks and a raised island.
  return base+1.4*Math.max(Math.exp(0-((x+13)/5.8)**2),Math.exp(0-((x-12)/6.6)**2))
   -3.8*branches*Math.exp(0-((z+4)/57)**4)+3.2*g(0,12,9,20)+1.8*g(8,38,26,7);
 }
 if(site.id==='cenote') {
  const ripple=Math.sin(x*.071)*.34+Math.sin(z*.064+x*.03)*.28;
  // Two offset open-roof bowls, a traversable middle saddle and a shallow western terrace.
  return -8.5+ripple-17*g(-11,-2,16,23)-22*g(12,32,18,18)-5*g(2,13,14,12)+3*g(-31,-19,14,18);
 }
 const laneX=10-29/(1+Math.exp(0-(z-16)/8));
 return base-5.4*Math.exp(0-((x-laneX)/7.2)**2-((z-5)/51)**4)+3.3*g(-17,-7,12,26)+2.9*g(28,27,14,19);
}

const structure=(id:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,form:Rock['form']='rock',tint=0):Rock=>({id,p:vec(x,y,z),s:vec(sx,sy,sz),form,tint});
/** Full collision envelopes, not scenery-only meshes. Lower slabs make ledges and
 * undercuts; separated piers leave real swim-throughs and open vertical escapes. */
export function authorExpeditionSite(site:Site,height:(x:number,z:number)=>number) {
 const bed=(id:string,x:number,z:number,sx:number,sy:number,sz:number,tint=0)=>structure(id,x,height(x,z)+sy*.65,z,sx,sy,sz,'rock',tint);
 const additions:Record<SiteId,Rock[]>={
  gardens:[bed('lagoon-west-terrace',-23,-20,8,1.6,5),bed('nursery-overhang',-22,2,7,1.25,4,1),bed('northern-step',-21,32,10,1.4,4),bed('east-rubble-tongue',30,13,9,1.5,5,1)],
  passage:[bed('shelf-spur-south',-23,-18,7,3,4),bed('race-west-spur',-13,12,5,5,8,1),bed('race-east-spur',14,17,4,6,7),bed('north-fork-divider',-4,43,4,4.8,8,1)],
  mangrove:[structure('root-island-west',-5,9,14,1,12,2.2,'root'),structure('root-island-east',5,9,18,1.2,12,2.2,'root',1),structure('north-root-gate-west',-10,9,33,1.0,12,1.6,'root'),structure('north-root-gate-east',1,9,34,1.0,12,1.6,'root',1),bed('sandbar-toe',20,40,8,1.2,3)],
  cenote:[structure('gallery-bridge-west',-14,-6,17,2.3,10,3,'limestone'),structure('gallery-bridge-east',3,-6,17,2.3,10,3,'limestone',1),structure('gallery-bridge-crown',-5.5,2.6,17,11,1.9,3.5,'limestone'),bed('basin-sill',1,8,6,2,3),bed('east-basin-step',29,31,6,2.5,8,1)],
  harbour:[structure('quay-footing-west',-26,-7,-27,9,2.5,3,'container'),structure('quay-footing-north',-27,-6,-12,8,2.5,3,'container',1),structure('gantry-west',-12,3,25,1,13,1,'piling'),structure('gantry-east',1,3,25,1,13,1,'piling',1),structure('gantry-crossbeam',-5.5,15,25,7.5,.7,1.0,'container'),bed('wreck-bank',-44,31,7,3,11)]
 };
 for(const r of additions[site.id]) {
  if(r.id==='gallery-bridge-crown'||r.id==='gantry-crossbeam'){r.suspended=true;continue;}
  const bottom=height(r.p.x,r.p.z)-.3;
  if(r.form==='limestone'||r.form==='root'||r.form==='piling'){const top=r.p.y+r.s.y;r.p.y=(top+bottom)/2;r.s.y=(top-bottom)/2;}
  if(r.id.startsWith('quay-footing'))r.p.y=bottom+r.s.y*.56;
 }
 site.rocks.push(...additions[site.id]);
 const descriptions:Record<SiteId,string>={
  gardens:'Descend the bright lagoon channel, circle the nursery terraces and swim beneath Sun arch. The northern steps lead to Marlow’s home.',
  passage:'Take the sheltered western shelf, descend into the tide race, then choose a fork around the northern reef spine beyond Cathedral arch.',
  mangrove:'Two winding tidal creeks braid around a rooted island. Find the narrow north gate and the sandbar before the offshore drop.',
  cenote:'Descend two offset blue basins, cross their limestone saddle and swim beneath the gallery bridge. Both bowls stay open to the sky.',
  harbour:'Follow the dogleg dredged channel between quay footings and cargo, pass under the old gantry and descend to the grounded wreck.'
 };
 site.description=descriptions[site.id];
 const extra:Record<SiteId,[string,number,number,number]>={gardens:['Lagoon terraces',-23,-20,3],passage:['Northern fork',5,45,5],mangrove:['Root island',0,14,7],cenote:['Gallery bridge',-5.5,17,16],harbour:['Old gantry',-5.5,25,15]};
 const [name,x,z,lift]=extra[site.id];site.landmarks.push({name,p:vec(x,height(x,z)+lift,z),kind:'landmark'});
}

/** Authoring/QA routes: world X,Y,Z, with open water between every point. These
 * describe optional exploration loops; they are not forced rails or teleport paths. */
export const EXPLORATION_ROUTES:Record<SiteId,{name:string;points:number[][]}[]>={
 gardens:[{name:'Lagoon and Sun arch loop',points:[[0,8,-41],[0,3,-29],[0,2,-10],[7,3,-10],[16,3.4,-7],[16,3.4,5],[17,5,18],[0,6,25],[-7,6,15],[-6,6,-6],[0,8,-41]]}],
 passage:[{name:'Lee shelf to Cathedral and northern fork',points:[[-28,14,-42],[-28,8,-27],[-28,8,-2],[-27,8,15],[-28,8,-22],[-3,6,-22],[0,3,8],[0,6,26],[7,4,39],[18,5,43],[24,9,44],[30,16,37],[36,17,22]]}],
 mangrove:[{name:'Braided creek and north root gate',points:[[0,8,-48],[-9,2,-34],[-8,2,-23],[-9,2,-14],[-10,2,-4],[-7,2,12],[-7,2,24],[-4,3,34],[8,4,40],[22,2,24],[21,2,3],[15,2,-18],[0,8,-48]]}],
 cenote:[{name:'Twin bowls and gallery swim-through',points:[[0,17,-51],[-5,-7,-27],[-7,-16,-10],[-5,-16,6],[-5,-16,17],[7,-16,26],[12,-22,36],[21,-16,41],[30,-6,20]]}],
 harbour:[{name:'Dredged dogleg, gantry and wreck descent',points:[[0,9,-50],[1,-6,-31],[8,-9,-19],[9,-10,-3],[0,-10,12],[-5,-8,25],[-17,-13,32],[-24,-20,39],[-27,-18,48]]}]
};


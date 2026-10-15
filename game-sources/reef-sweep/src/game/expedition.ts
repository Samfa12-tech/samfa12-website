import type { Profile, SiteId, Vec, Run, Catch } from './types.js';
import { vec, clamp, rng } from './math.js';
export const BAY_SITES: Record<SiteId,{x:number;z:number;towKm:number;seaKm:number}> = {
 gardens:{x:38,z:55,towKm:4,seaKm:1.2},passage:{x:-65,z:115,towKm:8,seaKm:3.4},mangrove:{x:-125,z:8,towKm:11,seaKm:4.6},cenote:{x:115,z:160,towKm:18,seaKm:7.2},harbour:{x:12,z:-118,towKm:6,seaKm:2.7}
};
export function fishSize(seed:number,index:number) { return index<4 ? .92+(index%4)*.075 : .43+rng(seed+index*193)()*.90; }
export function restaurantValue(weight:number,size?:number) {return (size===undefined?weight>=.5:size>=.84)?Math.round(10+weight*12):0;}
export function travelCosts(site:SiteId,boatDistance?:number) {const route=BAY_SITES[site];return {tow:Math.round(route.towKm*1.2),boat:Math.round(Math.max(route.seaKm, (boatDistance??0)/45)*2.2)};}
export function outingExpenses(run:Run,eat:number) {if(run.rescued)return 85;const fuel=run.expedition?travelCosts(run.site,run.boatDistance):{tow:0,boat:run.site==='passage'?10:0};return Math.max(8,28+fuel.tow+fuel.boat+(run.night?10:0)+run.restored*6-(eat>0?8:0)-(run.cooking?.complete&&eat>0?Math.round(run.cooking.quality*4):0));}
export interface BoatState {x:number;z:number;yaw:number;speed:number;distance:number;time:number}
export function newBoat():BoatState {return {x:0,z:0,yaw:.4,speed:0,distance:0,time:0};}
export function updateBoatTravel(b:BoatState,dt:number,throttle:number,steer:number) {
 dt=clamp(dt,0,.05);b.time+=dt;b.speed+=(throttle*15-b.speed)*Math.min(1,dt*.8);b.yaw+=steer*dt*.72*Math.min(1,Math.abs(b.speed)/3);
 const dx=Math.sin(b.yaw)*b.speed*dt,dz=Math.cos(b.yaw)*b.speed*dt;b.x=clamp(b.x+dx,-195,195);b.z=clamp(b.z+dz,-155,210);b.distance+=Math.hypot(dx,dz);
}
export function arrivalSite(b:BoatState):SiteId|null {return (Object.keys(BAY_SITES) as SiteId[]).find(id=>Math.hypot(b.x-BAY_SITES[id].x,b.z-BAY_SITES[id].z)<13&&Math.abs(b.speed)<3)??null;}
export function oceanHeight(x:number,z:number,time:number) {return Math.sin(x*.065+z*.028+time*.9)*.38+Math.sin(z*.09-x*.026-time*.72)*.20+Math.sin(x*.22+z*.14+time*1.3)*.055;}
export const CHARMS: {id:string;name:string;site:SiteId;p:Vec;colour:string;story:string}[] = [
 {id:'brass-compass',name:'Brass compass',site:'gardens',p:vec(-7,0,-12),colour:'#d9b66c',story:'An old navigation charm, tucked beside the nursery.'},
 {id:'glass-ray',name:'Sea-glass ray',site:'passage',p:vec(-28,0,8),colour:'#66c8bb',story:'A tiny ray cut from blue-green glass beneath the lee shelf.'},
 {id:'root-knot',name:'Carved mangrove knot',site:'mangrove',p:vec(8,0,32),colour:'#ac784d',story:'A polished wooden loop washed onto the sandbar.'},
 {id:'moon-shell',name:'Moon shell',site:'cenote',p:vec(-12,0,20),colour:'#e3dac2',story:'A nacre keepsake in a limestone alcove.'},
 {id:'enamel-lantern',name:'Enamel lantern',site:'harbour',p:vec(-17,0,24),colour:'#de8b54',story:'A little harbour light on a weathered keyring.'}
];
export function discoverCharm(p:Profile,id:string) {if(!CHARMS.some(c=>c.id===id))throw Error('Unknown keepsake.');p.charms??=[];if(p.charms.includes(id))return false;p.charms.push(id);p.equippedCharm??=id;return true;}
export function equipCharm(p:Profile,id:string) {if(id!==''&&!p.charms?.includes(id))throw Error('Find this keepsake first.');p.equippedCharm=id||undefined;}
export function heldCatches(r:Run):Catch[] {return [...(r.exposed?[r.exposed]:[]),...(r.skewered??[])];}
export function outbreakAvailable(p:Profile) {return p.day>=8&&p.reputation>=20&&p.totalRemoved>=18;}
export const RECIPES={citrus:{name:'Citrus pan fish',instruction:'Lift the pan when the heat enters the gold band.',verb:'Lift pan',targets:[.30,.62,.46]},stew:{name:'Harbour coconut stew',instruction:'Stir gently, fold in the fish, then finish with lime.',verb:'Stir / fold / finish',targets:[.65,.40,.75]}};
export function completeCooking(p:Profile,recipe:keyof typeof RECIPES,scores:number[]) {const r=p.pending;if(!r||r.rescued||!r.cargo.length||r.cooking?.complete||!RECIPES[recipe]||scores.length!==3||scores.some(v=>!Number.isFinite(v)||v<0||v>1))throw Error('This meal cannot be prepared.');r.cooking={recipe,quality:scores.reduce((a,b)=>a+b,0)/3,complete:true};return r.cooking;}

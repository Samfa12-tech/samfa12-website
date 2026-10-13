import type { Run, Site, Vec } from './types.js';
import { floorHeight, freePoint } from './data.js';
import { distance, vec, dot, norm, sub, direction } from './math.js';
/** One optional encounter, never in Gardens. No collider can trap the diver. */
export function scheduleBoat(run: Run, site: Site) {
    if (run.site === 'gardens' || run.practice || run.day < 4 || (run.seed + run.day) % 3 !== 0) return;
    const candidates = [vec(30,0,20),vec(-30,0,25),vec(8,0,34),vec(-8,0,20)];
    const home=site.landmarks[0].p;
    const point=candidates.find(p=>{p.y=Math.min(site.surface-5,floorHeight(p.x,p.z,site)+5);return freePoint(p,site,3)&&Math.hypot(p.x-home.x,p.z-home.z)>24});
    if (!point) return;
    run.encounter={kind:run.day%2?'rubbish':'fishing',phase:'warning',start:180+(run.seed%40),p:point,cleanProgress:0,rewarded:false};
}
export function updateBoat(run: Run, site: Site, notice: (text:string)=>void, sound:()=>void): boolean {
    const e=run.encounter;if(!e||run.time<e.start||['cleared','passed'].includes(e.phase))return false;
    const elapsed=run.time-e.start;
    if(e.phase==='warning' && !run.cooldowns.boatWarned) {
        if(distance(run.p,e.p)<18) { if(e.start>=260){e.phase='passed';return true}e.start+=10;return false; }
        run.cooldowns.boatWarned=1;notice(e.kind==='rubbish'?'Boat overhead. Watch for rubbish; keep clear of the amber marker.':'Fishing boat overhead. A line is going down at the amber marker; keep clear.');sound();return true;
    }
    if(e.phase==='warning' && elapsed>=12){e.phase='active';return true;}
    if(e.phase==='active' && e.kind==='fishing' && !run.cooldowns.boatContact && distance(run.p,e.p)<2.5){run.cooldowns.boatContact=1;run.air=Math.max(0,run.air-2);notice('Line snag: 2 bar lost disentangling. Swim away; your route is clear.');}
    if(e.phase==='active' && elapsed>=32){e.phase='abandoned';notice(e.kind==='rubbish'?'The boat has gone. Bag the dropped rubbish if your return reserve allows.':'The boat has gone. Its abandoned line is now safe to recover.');return true;}
    return false;
}
export function boatAim(run: Run, site: Site, clear: (a:Vec,b:Vec,site:Site)=>boolean) {
    const e=run.encounter;if(!e||!['active','abandoned'].includes(e.phase)||distance(run.p,e.p)>3.5||!clear(run.p,e.p,site)||dot(norm(sub(e.p,run.p)),direction(run.yaw,run.pitch))<.6)return null;
    return {kind:'job' as const,id:'boat-cleanup',distance:distance(run.p,e.p),label:e.kind==='rubbish'?'Dropped rubbish':'Abandoned fishing line',hint:e.phase==='abandoned'?'Hold Interact to bag it · $5 recovery fee':e.kind==='rubbish'?'Rubbish is falling · Keep clear until the boat leaves':'Active fishing gear · Keep clear until the boat leaves',valid:e.phase==='abandoned'};
}
export function clearBoat(run: Run) {const e=run.encounter;if(!e||e.phase!=='abandoned'||e.rewarded)return false;e.phase='cleared';e.rewarded=true;e.cleanProgress=1;return true;}

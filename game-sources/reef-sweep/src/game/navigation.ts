/** A small occupancy grid provides a conservative home route, avoiding straight-line
 * reserve estimates through rock. Water, rather than seabed, is the walkable space. */
import type { Site, Vec } from './types.js';
import { vec, distance, sub, norm, rayEllipsoid, clamp } from './math.js';
import { freePoint, floorHeight } from './data.js';
export function clearSegment(a: Vec, b: Vec, site: Site) {
    const d = norm(sub(b, a)), len = distance(a, b);
    if (!site.rocks.every(r => rayEllipsoid(a, d, r.p, r.s) > len)) return false;
    // Avoid a route that is clear of rocks but cuts through the site-specific seabed.
    const steps = Math.ceil(len / 2);
    for (let i = 1; i < steps; i++) {
        const t = i / steps, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
        if (y < floorHeight(x, z, site) + .35) return false;
    }
    return true;
}
export function homeRoute(from: Vec, site: Site): Vec[] {
    const target = { ...site.entry, y: Math.max(from.y, site.entry.y) };
    if (clearSegment(from, target, site))
        return [from, target];
    const step=6,size=23,half=66,plane=size*size;
    // A low swim-through may have a roof: do not join a deep starting point
    // directly to a high 2D grid through that roof. Plan lateral and vertical
    // water segments explicitly, including an under-bridge layer.
    const levels=[...new Set([Math.min(site.surface-1,from.y),6,site.entry.y,site.surface-1].map(y=>Math.round(y*100)/100))].sort((a,b)=>a-b);
    const pt=(n:number)=>vec((n%size)*step-half,levels[Math.floor(n/plane)],(Math.floor(n/size)%size)*step-half);
    const cx=clamp(Math.round((from.x+half)/step),0,size-1),cz=clamp(Math.round((from.z+half)/step),0,size-1);
    const queue:number[]=[],prev=new Map<number,number>(),valid=new Map<number,boolean>();
    const open=(n:number)=>{if(!valid.has(n))valid.set(n,freePoint(pt(n),site,.85));return valid.get(n)!;};
    for(let layer=0;layer<levels.length;layer++)for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
        const x=cx+dx,z=cz+dz;if(x<0||z<0||x>=size||z>=size)continue;
        const n=layer*plane+z*size+x;
        if(open(n)&&clearSegment(from,pt(n),site)){queue.push(n);prev.set(n,-1);}
    }
    let found=-1,head=0;
    while(head<queue.length){
        const c=queue[head++],p=pt(c),layer=Math.floor(c/plane),x=c%size,z=Math.floor(c/size)%size;
        if(Math.hypot(p.x-target.x,p.z-target.z)<step*1.5&&clearSegment(p,target,site)){found=c;break;}
        for(const [dx,dz,dy] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[0,0,1],[0,0,-1]]){
            const nx=x+dx,nz=z+dz,nl=layer+dy,n=nl*plane+nz*size+nx;
            if(nx<0||nz<0||nx>=size||nz>=size||nl<0||nl>=levels.length||prev.has(n)||!open(n)||!clearSegment(p,pt(n),site))continue;
            prev.set(n,c);queue.push(n);
        }
    }
    if(found<0){const high=site.surface-1;return [from,vec(from.x,high,from.z),vec(target.x,high,target.z),target];}
    const reverse:Vec[]=[target];let c=found;
    while(c>=0){reverse.push(pt(c));c=prev.get(c)??-1;}
    reverse.push(from);return reverse.reverse();
}
export const pathLength = (path: Vec[]) => path.slice(1).reduce((n, p, i) => n + distance(p, path[i]), 0);

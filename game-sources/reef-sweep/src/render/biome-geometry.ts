import { vec } from '../game/math.js';
import type { Rock, Site } from '../game/types.js';
import { Geometry, rgb, tint } from './geometry.js';

/** Every underwater solid follows an authored collision envelope. */
export function siteObstacleGeometry(rock: Rock, site: Site) {
    const g = new Geometry(), {p,s} = rock;
    if (rock.form === 'container') {
        const color = rgb(rock.tint ? '#487986' : '#ad714d');
        // Inscribe the box in the ellipsoid used by fish and diver navigation.
        const size=vec(s.x*1.12,s.y*1.12,s.z*1.12);
        g.box(p,size,color);
        for(let i=-5;i<=5;i++) for(const side of [-1,1]) {
            const x=p.x+i*size.x/12,z=p.z+side*size.z*.505;
            g.rod(vec(x,p.y-size.y*.45,z),vec(x,p.y+size.y*.45,z),.04,.04,tint(color,.72),5);
        }
    } else if (rock.form === 'piling') {
        const wood=rgb('#79634a');
        // A rounded, tapered piling stays inside its collision ellipsoid.
        for(let i=0;i<12;i++) {
            const y0=-.99+i*1.98/12,y1=-.99+(i+1)*1.98/12;
            g.rod(vec(p.x,p.y+y0*s.y,p.z),vec(p.x,p.y+y1*s.y,p.z),Math.sqrt(1-y0*y0)*s.x*.96,Math.sqrt(1-y1*y1)*s.x*.96,wood,12);
        }
        for(const fraction of [-.48,.45]) g.rod(vec(p.x,p.y+s.y*fraction-.08,p.z),vec(p.x,p.y+s.y*fraction+.08,p.z),s.x*.84,s.x*.84,rgb('#436e68'),12);
    } else if (rock.form === 'root') {
        const wood=rgb('#78694a'), alongX=s.x>s.z;
        // Dense roots occupy a woody curtain, with smaller buttress roots fanning down.
        g.ellipsoid(p,vec(s.x*.97,s.y,s.z*.97),wood,24,16,(x,y,z)=>tint(wood,.72+.25*Math.abs(Math.sin((alongX?x:z)*25))+y*.08));
        for(let i=-4;i<=4;i++) {
            const t=i/5, top=vec(p.x+(alongX?t*s.x*.66:0),p.y+s.y*.54,p.z+(alongX?0:t*s.z*.66));
            const bottom=vec(p.x+(alongX?t*s.x*.80:s.x*.42),p.y-s.y*.45,p.z+(alongX?s.z*.42:t*s.z*.80));
            g.rod(top,bottom,.12,.045,tint(wood,.77),9);
        }
        // Leaves sit on the emerged ends, rather than floating over submerged roots.
        if(p.y+s.y>site.surface-.7) for(let i=-2;i<=2;i++) {
            const t=i*.23;
            g.ellipsoid(vec(p.x+(alongX?t*s.x:0),p.y+s.y-.45,p.z+(alongX?0:t*s.z)),vec(alongX?1.9:.6,.7,alongX?.6:1.9),rgb('#48785b'),12,8);
        }
    } else {
        const color=rgb(rock.form==='limestone'?'#b3b69d':rock.tint?'#5c8e83':'#729f90');
        g.ellipsoid(p,s,color,26,18,(x,y,z)=>tint(color,.85+.11*Math.sin(x*14+z*12)*Math.cos(y*20)+y*.16));
        if(rock.form==='limestone') {
            // Irregular erosion cuts into the collision envelope, never outside it.
            for(let i=0;i<g.positions.length/3;i++){
                const k=i*3,x=g.positions[k]-p.x,y=g.positions[k+1]-p.y,z=g.positions[k+2]-p.z;
                const rough=.94+.05*Math.sin(y*1.8+Math.atan2(z,x)*5)*Math.cos(y*.6);
                g.positions[k]=p.x+x*rough;g.positions[k+2]=p.z+z*rough;
            }
            // Bands are colour changes in the same surface, keeping the open roof clear.
            for(let i=0;i<g.positions.length/3;i++) if(Math.sin(g.positions[i*3+1]*1.1)>.65) {
                g.colors[i*4]*=.85;g.colors[i*4+1]*=.88;g.colors[i*4+2]*=.89;
            }
        }
    }
    return g;
}

import { clamp, vec } from '../game/math.js';
import type { Run, Vec } from '../game/types.js';
import { Geometry, rgb } from './geometry.js';

/** Separate wrists and elbow sleeves give tools purposeful hand movement. */
export function forearmGeometry(side: number) {
    const g = new Geometry(), rubber = rgb('#102b32'), seam = rgb('#59b9a9');
    g.rod(vec(side * .11, -.10, -.24), vec(), .098, .076, rubber, 14);
    g.rod(vec(side * .03, -.025, -.06), vec(), .083, .080, seam, 14);
    g.ellipsoid(vec(-side * .04, .012, .115), vec(.085, .062, .10), rubber, 14, 9);
    for (let finger = 0; finger < 4; finger++) {
        const x = -side * .04 + (finger - 1.5) * .031;
        g.rod(vec(x,.015,.16),vec(x,-.022,.225-finger*.006),.014,.012,rubber,7);
        g.rod(vec(x,-.022,.225-finger*.006),vec(x,-.057,.20-finger*.006),.012,.009,rubber,7);
    }
    g.rod(vec(-side*.095,0,.12),vec(-side*.13,-.04,.18),.022,.014,rubber,8);
    return g;
}
export function sleeveGeometry() {
    const g = new Geometry();
    g.rod(vec(),vec(0,0,1),.118,.10,rgb('#20434c'),14);
    g.rod(vec(0,0,.25),vec(0,0,.35),.122,.122,rgb('#3e847f'),14);
    return g;
}
export interface DiverPose { left: Vec; right: Vec; leftRoll: number; rightRoll: number; reach: number; thrust: number }
export function diverPose(run: Run, time: number, watch: number, reducedMotion: boolean, output?: DiverPose): DiverPose {
    const pose = output ?? { left: vec(), right: vec(), leftRoll: 0, rightRoll: 0, reach: 0, thrust: 0 };
    const speed = clamp(Math.hypot(run.velocity.x,run.velocity.y,run.velocity.z)/2.7,0,1);
    const swim = reducedMotion ? 0 : Math.sin(time*2.5)*speed*(run.charge>0?.007:.022);
    const breathing = reducedMotion ? 0 : Math.sin(time*1.3)*.007;
    const thrust = run.strikeCooldown > .38 ? Math.sin((.75-run.strikeCooldown)/.37*Math.PI)*.23 : 0;
    const reach = run.interaction > 0 ? Math.sin(clamp(run.interaction,0,1)*Math.PI*.75)*.15 : 0;
    const leftX = run.scooter ? -.37 : -.38 - reach*.9, leftZ = run.scooter ? .60 : .82 + reach;
    pose.left.x=leftX*(1-watch)-.035*watch;
    pose.left.y=((run.scooter?-.24:-.45)+breathing+swim+reach*.35)*(1-watch)-.13*watch;
    pose.left.z=leftZ*(1-watch)+.68*watch;
    pose.right.x=run.scooter?.37:.29;
    pose.right.y=(run.scooter?-.24:-.37)+breathing-swim*.6;
    pose.right.z=(run.scooter?.60:.95)-run.charge*.16+thrust;
    pose.leftRoll=watch*.16+(1-watch)*(-.20+swim);pose.rightRoll=.14-swim;
    pose.reach=reach;pose.thrust=thrust;
    return pose;
}

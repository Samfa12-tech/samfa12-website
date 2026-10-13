import type { Run, Site, Vec } from './types.js';
import { currentAt } from './data.js';

export const BREATH_PERIOD = 4.3;
export const EXHALE_START = 1.7;
/** Simulation time keeps regulator sound and bubbles together across pauses. */
export class BreathClock {
    last = -1;
    sample(time: number, enabled: boolean, paused = false): 'inhale' | 'exhale' | null {
        if (paused) return null;
        if (!enabled) { this.last = -1; return null; }
        const cycle = Math.floor(time / BREATH_PERIOD);
        const exhale = time - cycle * BREATH_PERIOD >= EXHALE_START;
        const phase = cycle * 2 + Number(exhale);
        if (phase === this.last) return null;
        this.last = phase;
        return exhale ? 'exhale' : 'inhale';
    }
}

export class BubblePool {
    clock = new BreathClock();
    previous = -1;
    cursor = 0;
    emitted = 0;
    bubbles = Array.from({ length: 24 }, () => ({ p: { x: 0, y: 0, z: 0 } as Vec, born: -99, size: .025 }));
    update(run: Run, site: Site, playing: boolean) {
        const enabled = playing && !run.finished && run.p.y < site.surface - .12;
        const dt = this.previous < 0 ? 0 : Math.max(0, Math.min(.1, run.time - this.previous));
        this.previous = run.time;
        if (this.clock.sample(run.time, enabled) === 'exhale') {
            for (let i = 0; i < 8; i++) {
                const b = this.bubbles[this.cursor++ % this.bubbles.length];
                const side = i % 2 ? .20 : -.20, forward = .40 + i * .025;
                b.p.x = run.p.x + Math.sin(run.yaw) * forward + Math.cos(run.yaw) * side;
                b.p.y = run.p.y - .24 - i * .025;
                b.p.z = run.p.z + Math.cos(run.yaw) * forward - Math.sin(run.yaw) * side;
                b.size = .017 + (i % 4) * .007; b.born = run.time; this.emitted++;
            }
        }
        for (const b of this.bubbles) {
            if (run.time - b.born > 3 || b.p.y >= site.surface || !playing) { b.born = -99; continue; }
            const flow = currentAt(b.p, site, run.time);
            b.p.x += flow.x * dt; b.p.z += flow.z * dt;
            b.p.y += (.55 + b.size * 7) * dt;
        }
    }
    active(time: number) { return this.bubbles.filter(b => time - b.born < 3).length; }
}

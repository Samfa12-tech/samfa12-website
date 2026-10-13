import type { Profile, Run } from './types.js';
/** The renderer may have been rebound to a harbour preview while simulation is suspended. */
export function bindSuspendedDive<T extends { run: Run }>(profile: Profile, current: T | null, renderer: { run: Run | null; build(p: Profile, r: Run): void }, create: (r: Run) => T): T {
    if (!profile.active) throw Error('There is no suspended dive to resume.');
    const sim = current?.run === profile.active ? current : create(profile.active);
    if (renderer.run !== sim.run) renderer.build(profile, sim.run);
    return sim;
}

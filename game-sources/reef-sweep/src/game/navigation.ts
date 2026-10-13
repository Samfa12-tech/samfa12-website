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
    const step = 6, size = 23, half = 66, y = Math.min(site.surface - 2, Math.max(6, from.y));
    const cell = (p: Vec) => ({ x: clamp(Math.round((p.x + half) / step), 0, size - 1), z: clamp(Math.round((p.z + half) / step), 0, size - 1) });
    const pt = (n: number) => vec((n % size) * step - half, y, Math.floor(n / size) * step - half);
    const start = cell(from), end = cell(target), s = start.z * size + start.x, e = end.z * size + end.x;
    const queue = [s], prev = new Map<number, number>([[s, -1]]);
    while (queue.length) {
        const c = queue.shift()!;
        if (c === e)
            break;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
            const x = c % size + dx, z = Math.floor(c / size) + dz, n = z * size + x;
            if (x < 0 || z < 0 || x >= size || z >= size || prev.has(n))
                continue;
            const p = pt(n);
            if (!freePoint(p, site, 1) || !clearSegment(pt(c), p, site))
                continue;
            prev.set(n, c);
            queue.push(n);
        }
    }
    if (!prev.has(e)) { // A safe high-water fallback is more conservative than claiming a direct route.
        const high = site.surface - 1;
        return [from, vec(from.x, high, from.z), vec(target.x, high, target.z), target];
    }
    const reverse: Vec[] = [target];
    let c = e;
    while (c !== s && c >= 0) {
        reverse.push(pt(c));
        c = prev.get(c) ?? -1;
    }
    reverse.push(from);
    return reverse.reverse();
}
export const pathLength = (path: Vec[]) => path.slice(1).reduce((n, p, i) => n + distance(p, path[i]), 0);

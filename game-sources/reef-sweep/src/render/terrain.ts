import { floorHeight, siteTerrainKey } from '../game/data.js';
import { norm, vec } from '../game/math.js';
import type { Vec, Site, SiteId } from '../game/types.js';
import { Geometry, rgb, tint } from './geometry.js';

export const SEABED_SIZE = 170;
export const SEABED_STEPS = 90;
const samples = new Map<string, Float64Array>();
function sampleHeight(ix: number, iz: number, site?: Site | SiteId) {
    const key = siteTerrainKey(site);
    if (!samples.has(key)) samples.set(key, new Float64Array((SEABED_STEPS + 1) ** 2).fill(NaN));
    const sandSamples = samples.get(key)!;
    const index = iz * (SEABED_STEPS + 1) + ix;
    if (Number.isNaN(sandSamples[index])) sandSamples[index] = floorHeight(-SEABED_SIZE / 2 + ix * SEABED_SIZE / SEABED_STEPS, -SEABED_SIZE / 2 + iz * SEABED_SIZE / SEABED_STEPS, site);
    return sandSamples[index];
}

/** Height of the visible sand triangles, rather than the curved authoring function. */
export function sandHeight(x: number, z: number, site?: Site | SiteId) {
    const half = SEABED_SIZE / 2, cell = SEABED_SIZE / SEABED_STEPS;
    if (Math.abs(x) >= half || Math.abs(z) >= half) return floorHeight(x, z, site);
    const ix = Math.floor((x + half) / cell), iz = Math.floor((z + half) / cell);
    const x0 = -half + ix * cell, z0 = -half + iz * cell;
    const tx = (x - x0) / cell, tz = (z - z0) / cell;
    const a = sampleHeight(ix, iz, site), b = sampleHeight(ix, iz + 1, site), c = sampleHeight(ix + 1, iz, site), d = sampleHeight(ix + 1, iz + 1, site);
    return tx + tz <= 1 ? a + (c - a) * tx + (b - a) * tz : d + (b - d) * (1 - tx) + (c - d) * (1 - tz);
}

export function seabedGeometry(site?: Site) {
    const ground = new Geometry(), half = SEABED_SIZE / 2;
    const vertex = (x: number, z: number) => {
        const eps = .08, n = norm(vec(floorHeight(x - eps, z, site) - floorHeight(x + eps, z, site), 2 * eps, floorHeight(x, z - eps, site) - floorHeight(x, z + eps, site)));
        const grain = .92 + .06 * Math.sin(x * 5 + z * 6) + .035 * Math.sin(z * 19);
        ground.v(vec(x, floorHeight(x, z, site), z), n, tint(rgb('#' + (site?.sandColor ?? 0xc5ceaf).toString(16).padStart(6, '0')), grain));
    };
    for (let iz = 0; iz <= SEABED_STEPS; iz++) for (let ix = 0; ix <= SEABED_STEPS; ix++) vertex(-half + ix * SEABED_SIZE / SEABED_STEPS, -half + iz * SEABED_SIZE / SEABED_STEPS);
    for (let iz = 0; iz < SEABED_STEPS; iz++) for (let ix = 0; ix < SEABED_STEPS; ix++) {
        const a = iz * (SEABED_STEPS + 1) + ix, b = a + SEABED_STEPS + 1;
        ground.indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    // Coarse outer rings meet the exact inner boundary and continue beneath the islands.
    // Gameplay and collision retain the authored dive area.
    const radii = [half, 110, 160, 240, 340, 450], ringSize = SEABED_STEPS * 4, start = ground.positions.length / 3;
    for (const radius of radii) for (let side = 0; side < 4; side++) for (let i = 0; i < SEABED_STEPS; i++) {
        const t = -radius + i * 2 * radius / SEABED_STEPS;
        vertex(side === 0 ? t : side === 1 ? radius : side === 2 ? -t : -radius, side === 0 ? -radius : side === 1 ? t : side === 2 ? radius : -t);
    }
    for (let ring = 0; ring < radii.length - 1; ring++) for (let i = 0; i < ringSize; i++) {
        const j = (i + 1) % ringSize, a = start + ring * ringSize + i, b = a + ringSize, c = start + ring * ringSize + j, d = c + ringSize;
        ground.indices.push(a, c, b, c, d, b);
    }
    return ground;
}

/** Embed each root footprint in the actual sand, including steep trench slopes. */
export function mergeGrounded(destination: Geometry, source: Geometry, p: Vec, s: Vec, yaw: number, site?: Site) {
    const start = destination.positions.length;
    destination.merge(source, vec(p.x, sandHeight(p.x, p.z, site) - .035, p.z), s, yaw);
    const center = sandHeight(p.x, p.z, site);
    for (let i = start; i < destination.positions.length; i += 3) destination.positions[i + 1] += sandHeight(destination.positions[i], destination.positions[i + 2], site) - center;
}

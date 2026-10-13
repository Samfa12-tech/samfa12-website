import type { Site, Vec } from './types.js';
import { floorHeight } from './data.js';
import { vec } from './math.js';

/** Conservative native-fish local bound, including the shader's tail sway. */
export const NATIVE_FISH_UNIT_BOUND = Math.hypot(.22 + .05, .34, .63);
export const NATIVE_FISH_MAX_SCALE = 1.4;
export const NATIVE_FISH_ROCK_MARGIN = .22;
export const NATIVE_FISH_TERRAIN_MARGIN = .2;
export const NATIVE_FISH_SURFACE_MARGIN = .25;

const ROCK_LIFT_BLEND = 8;
const ROCK_VERTICAL_LIFT = 1.5;
const ROCK_LIFT_EPSILON = .01;
const smoothstep = (t: number) => {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
};
function stepAside(position: Vec, rock: Site['rocks'][number], innerX: number, innerZ: number) {
    if (rock.s.x <= rock.s.z) {
        const sign = rock.p.x <= 0 ? 1 : -1;
        position.x = rock.p.x + sign * (innerX + .02);
    } else {
        const sign = rock.p.z <= 0 ? 1 : -1;
        position.z = rock.p.z + sign * (innerZ + .02);
    }
}

export function nativeFishEnvelope(scale: number) {
    return NATIVE_FISH_UNIT_BOUND * Math.max(0, scale) + NATIVE_FISH_ROCK_MARGIN;
}

/**
 * Returns a continuous, terrain-safe center position with the supplied
 * world-space body envelope kept outside authored rock ellipsoids. Useful for
 * repairing authored/pre-existing fish locations as well as moving schools.
 */
export function clearFishPosition(site: Site, source: Vec, envelope: number, out?: Vec): Vec {
    const position = out ?? vec(source.x, source.y, source.z);
    position.x = source.x;
    position.y = source.y;
    position.z = source.z;
    const bodyRadius = Math.max(0, envelope - NATIVE_FISH_ROCK_MARGIN);
    const maxCenterY = site.surface - bodyRadius - NATIVE_FISH_SURFACE_MARGIN;
    position.y = Math.min(maxCenterY, Math.max(position.y, floorHeight(position.x, position.z, site) + envelope + NATIVE_FISH_TERRAIN_MARGIN));

    // A surface-reaching root or piling cannot be cleared by lifting a fish over
    // it. Move an intersecting body sideways into open water instead.
    for (let pass = 0; pass < 3; pass++) {
        let movedSideways = false;
        for (const rock of site.rocks) {
            const innerX = rock.s.x + envelope;
            const innerY = rock.s.y + envelope;
            const innerZ = rock.s.z + envelope;
            if (rock.form === 'root' || rock.form === 'piling') {
                const overlapX = (position.x - rock.p.x) / innerX;
                const overlapY = (position.y - rock.p.y) / innerY;
                const overlapZ = (position.z - rock.p.z) / innerZ;
                if (overlapX * overlapX + overlapY * overlapY + overlapZ * overlapZ < 1) {
                    stepAside(position, rock, innerX, innerZ);
                    position.y = Math.max(position.y, floorHeight(position.x, position.z, site) + envelope + NATIVE_FISH_TERRAIN_MARGIN);
                    movedSideways = true;
                }
                continue;
            }
            const outerX = innerX + ROCK_LIFT_BLEND;
            const outerY = innerY + ROCK_VERTICAL_LIFT;
            const outerZ = innerZ + ROCK_LIFT_BLEND;
            const dx = (position.x - rock.p.x) / outerX;
            const dz = (position.z - rock.p.z) / outerZ;
            const radial = Math.hypot(dx, dz);
            if (radial >= 1) continue;

            const ratioX = innerX / outerX, ratioZ = innerZ / outerZ;
            const directionX = radial > 1e-8 ? dx / radial : 0;
            const directionZ = radial > 1e-8 ? dz / radial : 0;
            const innerBoundary = radial > 1e-8 ? 1 / Math.hypot(directionX / ratioX, directionZ / ratioZ) : 1;
            const blend = radial <= innerBoundary ? 1 : smoothstep((1 - radial) / (1 - innerBoundary));
            const top = rock.p.y + outerY * Math.sqrt(Math.max(0, 1 - radial * radial)) + ROCK_LIFT_EPSILON;
            const target = position.y + Math.max(0, top - position.y) * blend;
            if (target <= maxCenterY) {
                position.y = Math.max(position.y, target);
                continue;
            }

            const overlapX = (position.x - rock.p.x) / innerX;
            const overlapY = (position.y - rock.p.y) / innerY;
            const overlapZ = (position.z - rock.p.z) / innerZ;
            if (overlapX * overlapX + overlapY * overlapY + overlapZ * overlapZ >= 1) continue;

            stepAside(position, rock, innerX, innerZ);
            position.y = Math.max(position.y, floorHeight(position.x, position.z, site) + envelope + NATIVE_FISH_TERRAIN_MARGIN);
            movedSideways = true;
        }
        if (!movedSideways) break;
    }
    position.y = Math.min(maxCenterY, Math.max(position.y, floorHeight(position.x, position.z, site) + envelope + NATIVE_FISH_TERRAIN_MARGIN));
    return position;
}

export interface NativeFishMotion {
    position: Vec;
    heading: number;
    /** Prepared once for an immutable site, school centre, radius and body size. */
    orbitCenter?: Vec;
}

function orbitCenterAwayFromCurtains(site: Site, source: Vec, radius: number, envelope: number): Vec {
    const center = vec(source.x, source.y, source.z), spanZ = radius * .66;
    const lowY = center.y - 1.3 - envelope, highY = center.y + 1.3 + envelope;
    const gap = .5;
    const curtains = site.rocks.filter(rock => (rock.form === 'root' || rock.form === 'piling') && lowY < rock.p.y + rock.s.y && highY > rock.p.y - rock.s.y);
    const blocked = (x: number, z: number) => curtains.some(rock => {
        const minX = rock.p.x - rock.s.x - envelope - gap, maxX = rock.p.x + rock.s.x + envelope + gap;
        const minZ = rock.p.z - rock.s.z - envelope - gap, maxZ = rock.p.z + rock.s.z + envelope + gap;
        return x + radius > minX && x - radius < maxX && z + spanZ > minZ && z - spanZ < maxZ;
    });
    const fitsSite = (x: number, z: number) => Math.max(
        Math.hypot(x - radius, z - spanZ), Math.hypot(x + radius, z - spanZ),
        Math.hypot(x - radius, z + spanZ), Math.hypot(x + radius, z + spanZ)
    ) < site.radius - 1;
    if (!blocked(center.x, center.z)) return center;

    // Pick one nearby clear orbit center before animating the school. Sampling a
    // deterministic set of offsets avoids sequential projection cycles between
    // neighbouring trunks while retaining a smooth, repeatable swim path.
    const directions = 24;
    for (let step = .5; step <= site.radius * .55; step += .5) {
        for (let i = 0; i < directions; i++) {
            const angle = i / directions * Math.PI * 2;
            const x = source.x + Math.cos(angle) * step, z = source.z + Math.sin(angle) * step;
            if (fitsSite(x, z) && !blocked(x, z)) return vec(x, center.y, z);
        }
    }
    return center;
}

export function prepareNativeOrbit(site: Site, center: Vec, radius: number, scale: number): Vec {
    return orbitCenterAwayFromCurtains(site, center, radius, nativeFishEnvelope(scale));
}

/**
 * Samples the deterministic native-school orbit, lifts members over low relief,
 * and offsets schools around surface-reaching root and piling groups. No state
 * is stored, so a paused dive or repeated timestamp is reproducible.
 */
export function nativeFishMotion(
    site: Site,
    center: Vec,
    radius: number,
    seed: number,
    time: number,
    scale = NATIVE_FISH_MAX_SCALE,
    out?: NativeFishMotion
): NativeFishMotion {
    const angle = time * .13 + seed;
    const envelope = nativeFishEnvelope(scale);
    const orbitCenter = out?.orbitCenter ?? orbitCenterAwayFromCurtains(site, center, radius, envelope);
    const position = out?.position ?? vec(0, 0, 0);
    position.x = orbitCenter.x + Math.sin(angle) * radius;
    position.y = orbitCenter.y + Math.sin(angle * 1.8 + seed) * 1.3;
    position.z = orbitCenter.z + Math.cos(angle) * radius * .66;
    clearFishPosition(site, position, envelope, position);

    const heading = Math.atan2(Math.cos(angle), -Math.sin(angle) * .66);
    if (out) {
        out.heading = heading;
        return out;
    }
    return { position, heading };
}

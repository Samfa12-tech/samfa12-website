/** Original procedural art. Metres, +Y up, creature noses +Z. All meshes share
 * a vertex-colour material, so reefs can be batched without texture atlases. */
import { vec, norm, sub, scale, add, rng } from '../game/math.js';
import type { Vec } from '../game/types.js';
export type RGB = [
    number,
    number,
    number
];
export const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
export const tint = (c: RGB, n: number): RGB => [c[0] * n, c[1] * n, c[2] * n];
export const cross = (a: Vec, b: Vec) => vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export class Geometry {
    positions: number[] = [];
    normals: number[] = [];
    colors: number[] = [];
    uvs: number[] = [];
    indices: number[] = [];
    v(p: Vec, n: Vec, c: RGB, u = 0, v = 0) { const i = this.positions.length / 3; this.positions.push(p.x, p.y, p.z); this.normals.push(n.x, n.y, n.z); this.colors.push(...c, 1); this.uvs.push(u, v); return i; }
    tri(a: Vec, b: Vec, c: Vec, color: RGB, sway = 0) { const n = norm(cross(sub(b, a), sub(c, a))), i = this.v(a, n, color, 0, sway); this.v(b, n, color, 1, sway); this.v(c, n, color, .5, sway); this.indices.push(i, i + 1, i + 2); }
    quad(a: Vec, b: Vec, c: Vec, d: Vec, color: RGB, sway = 0) { this.tri(a, b, c, color, sway); this.tri(a, c, d, color, sway); }
    ellipsoid(p: Vec, s: Vec, c: RGB, segments = 14, rings = 9, paint?: (x: number, y: number, z: number) => RGB) { const start = this.positions.length / 3; for (let j = 0; j <= rings; j++) {
        const lat = j / rings * Math.PI;
        for (let i = 0; i <= segments; i++) {
            const lon = i / segments * Math.PI * 2, x = Math.sin(lat) * Math.cos(lon), y = Math.cos(lat), z = Math.sin(lat) * Math.sin(lon);
            const n = norm(vec(x / s.x, y / s.y, z / s.z));
            this.v(vec(p.x + x * s.x, p.y + y * s.y, p.z + z * s.z), n, paint ? paint(x, y, z) : c, i / segments, 0);
        }
    } for (let j = 0; j < rings; j++)
        for (let i = 0; i < segments; i++) {
            const a = start + j * (segments + 1) + i, b = a + segments + 1;
            this.indices.push(a, b, a + 1, b, b + 1, a + 1);
        } }
    rod(a: Vec, b: Vec, r1: number, r2: number, c: RGB, segments = 7, sway = 0) { const d = norm(sub(b, a)), u = norm(cross(d, Math.abs(d.y) > .9 ? vec(1, 0, 0) : vec(0, 1, 0))), v = cross(d, u); const start = this.positions.length / 3; for (let j = 0; j < 2; j++)
        for (let i = 0; i <= segments; i++) {
            const q = i / segments * Math.PI * 2, n = add(scale(u, Math.cos(q)), scale(v, Math.sin(q))), p = add(j ? b : a, scale(n, j ? r2 : r1));
            this.v(p, n, c, i / segments, j * sway);
        } for (let i = 0; i < segments; i++) {
        const k = start + i;
        this.indices.push(k, k + segments + 1, k + 1, k + 1, k + segments + 1, k + segments + 2);
    } this.tri(add(b, scale(u, r2)), add(b, scale(v, r2)), add(b, scale(u, -r2)), c, sway); }
    box(p: Vec, s: Vec, c: RGB) { const [x, y, z] = [s.x / 2, s.y / 2, s.z / 2], v = (a: number, b: number, d: number) => vec(p.x + a * x, p.y + b * y, p.z + d * z); this.quad(v(-1, 1, -1), v(1, 1, -1), v(1, 1, 1), v(-1, 1, 1), tint(c, 1.1)); this.quad(v(-1, -1, 1), v(1, -1, 1), v(1, -1, -1), v(-1, -1, -1), tint(c, .65)); this.quad(v(-1, -1, 1), v(-1, 1, 1), v(1, 1, 1), v(1, -1, 1), c); this.quad(v(1, -1, -1), v(1, 1, -1), v(-1, 1, -1), v(-1, -1, -1), c); this.quad(v(1, -1, 1), v(1, 1, 1), v(1, 1, -1), v(1, -1, -1), tint(c, .8)); this.quad(v(-1, -1, -1), v(-1, 1, -1), v(-1, 1, 1), v(-1, -1, 1), tint(c, .8)); }
    merge(g: Geometry, p = vec(), s = vec(1, 1, 1), yaw = 0) { const offset = this.positions.length / 3, co = Math.cos(yaw), si = Math.sin(yaw); for (let i = 0; i < g.positions.length; i += 3) {
        const x = g.positions[i] * s.x, z = g.positions[i + 2] * s.z;
        this.positions.push(p.x + x * co + z * si, p.y + g.positions[i + 1] * s.y, p.z + z * co - x * si);
        const n = norm(vec(g.normals[i] / s.x, g.normals[i + 1] / s.y, g.normals[i + 2] / s.z));
        this.normals.push(n.x * co + n.z * si, n.y, n.z * co - n.x * si);
    } this.colors.push(...g.colors); this.uvs.push(...g.uvs); for (const idx of g.indices)
        this.indices.push(idx + offset); }
}
/** Shore-connected terrain with angular ridges, sand and rock bands. */
export function islandGeometry(seed: number, foundationDepth = 45) {
    const g = new Geometry(), random = rng(seed), phase = random() * Math.PI * 2;
    const width = 28, depth = 20;
    const terrain = (x: number, z: number) => {
        const angle = Math.atan2(z, x), boundary = 1 + .13 * Math.sin(angle * 3 + phase) + .07 * Math.cos(angle * 5 - phase);
        const radius = Math.hypot(x, z) / boundary;
        let height = -1.4;
        if (radius < 1) height = -.6 + Math.min(.25, 1 - radius) * 11;
        if (radius < .75) {
            const ridges = 17 * Math.exp(-((x + .32) ** 2 / .08 + (z - .06) ** 2 / .25))
                + 11 * Math.exp(-((x - .16) ** 2 / .12 + (z + .20) ** 2 / .09))
                + 7 * Math.exp(-((x - .50) ** 2 / .10 + (z - .24) ** 2 / .11));
            height += ridges * Math.min(1, (.75 - radius) / .18);
        }
        return { point: vec(x * 24, height, z * 16), radius };
    };
    const occupied = Array.from({ length: depth }, () => Array<boolean>(width).fill(false));
    for (let iz = 0; iz < depth; iz++)
        for (let ix = 0; ix < width; ix++) {
            const x = -1.2 + ix * 2.4 / width, z = -1.2 + iz * 2.4 / depth;
            const a = terrain(x, z), b = terrain(x, z + 2.4 / depth), c = terrain(x + 2.4 / width, z + 2.4 / depth), d = terrain(x + 2.4 / width, z);
            if ([a,b,c,d].every(p => p.radius > 1.12)) continue;
            occupied[iz][ix] = true;
            const height = (a.point.y + b.point.y + c.point.y + d.point.y) / 4;
            const color = rgb(height < .8 ? '#b9ad82' : height < 3 ? '#7c8170' : '#395b3c');
            g.quad(a.point, b.point, c.point, d.point, tint(color, .9 + random() * .15));
        }

    // Trace the exact outline of the clipped terrain cells. Extruding these
    // boundary edges makes the submerged rock meet the original shore without
    // a floating lip or a gap around its irregular grid edge.
    const bottom = -Math.max(45, Number.isFinite(foundationDepth) ? foundationDepth : 45);
    type GridPoint = { x: number; z: number };
    const boundaryEdges: Array<{ a: GridPoint; b: GridPoint }> = [];
    const isOccupied = (ix: number, iz: number) => iz >= 0 && iz < depth && ix >= 0 && ix < width && occupied[iz][ix];
    for (let iz = 0; iz < depth; iz++)
        for (let ix = 0; ix < width; ix++) {
            if (!occupied[iz][ix]) continue;
            const nw = { x: ix, z: iz }, ne = { x: ix + 1, z: iz }, se = { x: ix + 1, z: iz + 1 }, sw = { x: ix, z: iz + 1 };
            if (!isOccupied(ix, iz - 1)) boundaryEdges.push({ a: nw, b: ne });
            if (!isOccupied(ix + 1, iz)) boundaryEdges.push({ a: ne, b: se });
            if (!isOccupied(ix, iz + 1)) boundaryEdges.push({ a: se, b: sw });
            if (!isOccupied(ix - 1, iz)) boundaryEdges.push({ a: sw, b: nw });
        }
    const gridKey = (point: GridPoint) => `${point.x},${point.z}`;
    const edgeFrom = new Map(boundaryEdges.map(edge => [gridKey(edge.a), edge]));
    const perimeter: GridPoint[] = [];
    if (boundaryEdges.length) {
        const first = boundaryEdges[0];
        let edge = first;
        do {
            perimeter.push(edge.a);
            const next = edgeFrom.get(gridKey(edge.b));
            if (!next) throw new Error('Island terrain boundary is not a closed loop');
            edge = next;
        } while (edge !== first && perimeter.length <= boundaryEdges.length);
        if (edge !== first) throw new Error('Island terrain boundary contains multiple or open loops');
    }
    const levels = [
        { y: -1.4, growth: 0 },
        { y: -5, growth: .08 },
        { y: -12, growth: .28 },
        { y: -22, growth: .58 },
        { y: bottom * .76, growth: .88 },
        { y: bottom, growth: 1.02 },
    ];
    const rings: number[][] = [];
    for (let level = 0; level < levels.length; level++) {
        const { y, growth } = levels[level];
        const previous = levels[Math.max(0, level - 1)], next = levels[Math.min(levels.length - 1, level + 1)];
        const drdy = (next.growth - previous.growth) / (next.y - previous.y || 1);
        const ring: number[] = [];
        for (let pointIndex = 0; pointIndex < perimeter.length; pointIndex++) {
            const point = perimeter[pointIndex];
            const x = -1.2 + point.x * 2.4 / width, z = -1.2 + point.z * 2.4 / depth;
            const shore = terrain(x, z).point, angle = Math.atan2(shore.z / 16, shore.x / 24);
            const shoreRadius = Math.hypot(shore.x / 24, shore.z / 16);
            const organic = growth * (.025 * Math.sin(angle * 3 + phase) + .018 * Math.cos(angle * 5 - phase));
            const r = shoreRadius + growth + organic;
            const normal = norm(vec(Math.cos(angle) / 24, -drdy, Math.sin(angle) / 16));
            const position = level === 0 ? shore : vec(Math.cos(angle) * r * 24, y, Math.sin(angle) * r * 16);
            ring.push(g.v(position, normal,
                level < 2 ? rgb('#8b8775') : level < 4 ? rgb('#625f56') : rgb('#484a45'), pointIndex / perimeter.length, level / (levels.length - 1)));
        }
        rings.push(ring);
    }
    for (let level = 0; level < rings.length - 1; level++) {
        const upper = rings[level], lower = rings[level + 1];
        for (let segment = 0; segment < upper.length; segment++) {
            const next = (segment + 1) % upper.length;
            g.indices.push(upper[segment], upper[next], lower[segment], upper[next], lower[next], lower[segment]);
        }
    }
    // Close the seabed end so the rock has no visible underside opening.
    const bottomCenter = g.v(vec(0, bottom, 0), vec(0, -1, 0), rgb('#41443f'));
    const bottomRing = rings[rings.length - 1];
    for (let segment = 0; segment < bottomRing.length; segment++)
        g.indices.push(bottomCenter, bottomRing[segment], bottomRing[(segment + 1) % bottomRing.length]);
    return g;
}
export function coral(kind: number, seed: number) {
    const g = new Geometry(), r = rng(seed), palette = ['#efaa79', '#db7f96', '#887ac0', '#74b6ac', '#d8bc85', '#649eae'], c = rgb(palette[kind % palette.length]);
    if (kind === 0 || kind === 4) {
        const branches = kind === 0 ? 5 : 8;
        for (let i = 0; i < branches; i++) {
            const angle = i / branches * Math.PI * 2, a = vec(0, 0, 0), b = vec(Math.cos(angle) * .2, .45 + r() * .35, Math.sin(angle) * .2);
            g.rod(a, b, .085, .038, c, 6, .12);
            for (let j = 0; j < 3; j++) {
                const q = angle + j * 1.8, end = add(b, vec(Math.cos(q) * .33, .3 + r() * .32, Math.sin(q) * .33));
                g.rod(b, end, .035, .012, tint(c, 1.12), 6, .28);
                g.ellipsoid(end, vec(.024, .023, .024), tint(c, 1.27), 5, 3);
            }
        }
    }
    else if (kind === 1) {
        for (let i = 0; i < 6; i++) {
            const a = vec((r() - .5) * .8, 0, (r() - .5) * .8), h = .35 + r() * .9, rad = .11 + r() * .13;
            g.rod(a, add(a, vec(.06, h, 0)), rad * .8, rad, c, 10);
            g.ellipsoid(add(a, vec(.06, h + .01, 0)), vec(rad * .72, .025, rad * .72), rgb('#7b4c70'), 10, 3);
        }
    }
    else if (kind === 2 || kind === 5) {
        g.rod(vec(), vec(0, .45, 0), .06, .035, tint(c, .7));
        const a = vec(0, .3, 0);
        for (let i = 0; i < 13; i++) {
            const theta = -1.28 + i / 12 * 2.56, end = vec(Math.sin(theta) * .85, .45 + Math.cos(theta) * 1.15, Math.sin(i * .7) * .08);
            g.rod(a, end, .026, .009, c, 5, .7);
            for (let j = 1; j < 6; j++) {
                const t = j / 6, p = add(a, scale(sub(end, a), t)), e = add(p, vec(.13, .05, 0));
                g.rod(p, e, .012, .006, tint(c, .92), 4, .6);
            }
        }
        for (let i = 0; i < 12; i++) {
            const aa = -1.28 + i / 12 * 2.56, bb = aa + 2.56 / 12;
            g.tri(a, vec(Math.sin(aa) * .84, .45 + Math.cos(aa) * 1.14, 0), vec(Math.sin(bb) * .84, .45 + Math.cos(bb) * 1.14, 0), tint(c, .85), .5);
        }
    }
    else {
        for (let i = 0; i < 4; i++) {
            const y = .15 + i * .2, rad = .85 - i * .12;
            g.ellipsoid(vec(i * .08, y, 0), vec(rad, .11, rad * .7), tint(c, 1 + i * .05), 18, 5);
        }
    }
    return g;
}
/** Rooted segmented fronds. UV.y is distance from the anchored root to the tip. */
export function seaweedGeometry(seed: number, height = 1) {
    const g = new Geometry(), random = rng(seed), greens = ['#477f69', '#5d9771', '#77a67a', '#3e705f'];
    const count = 5 + Math.floor(random() * 4);
    for (let blade = 0; blade < count; blade++) {
        const angle = random() * Math.PI * 2, length = height * (.72 + random() * .72), width = .035 + random() * .04;
        const phase = random(), curve = (random() - .5) * .2, color = rgb(greens[Math.floor(random() * greens.length)]);
        const start = g.positions.length / 3, steps = 9;
        for (let step = 0; step <= steps; step++) {
            const t = step / steps, bend = t * t;
            const cx = Math.cos(angle) * .045 * t + Math.sin(t * 3.1 + phase * 6.28) * curve * bend;
            const cz = Math.sin(angle) * .045 * t + Math.cos(t * 2.7 + phase * 6.28) * curve * bend;
            const half = width * (1 - .68 * t) * (.82 + .18 * Math.sin(t * Math.PI));
            const sx = -Math.sin(angle) * half, sz = Math.cos(angle) * half;
            const y = length * t, n = norm(vec(Math.cos(angle), .2, Math.sin(angle)));
            const shade = .78 + .30 * (1 - t) + .08 * Math.sin(blade * 3 + t * 7);
            g.v(vec(cx - sx, y, cz - sz), n, tint(color, shade), phase, t);
            g.v(vec(cx + sx, y, cz + sz), n, tint(color, shade * .92), phase, t);
        }
        for (let step = 0; step < steps; step++) {
            const a = start + step * 2, b = a + 2;
            g.indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
    return g;
}

/** Original low-poly wreck ribs and broken planking, aligned along +Z. */
export function shipwreckGeometry() {
    const g = new Geometry(), iron = rgb('#72574a'), rust = rgb('#a26d4b'), wood = rgb('#69584c'), dark = rgb('#283d3d');
    g.rod(vec(0, -.9, -7.6), vec(0, -.62, 7.6), .25, .18, iron, 10);
    for (let rib = 0; rib <= 10; rib++) {
        const z = -7.5 + rib * 1.5, broken = rib % 3 === 1;
        const half = 2.6 - Math.abs(rib - 5) * .08;
        const keel = vec(0, -.78, z), port = vec(-half, -.15, z), starboard = vec(half, -.15, z);
        g.rod(keel, port, .11, .075, rib % 2 ? iron : rust, 6);
        g.rod(keel, starboard, .11, .075, iron, 6);
        g.rod(port, vec(-half * .82, .65, z), .075, .05, rust, 6);
        if (!broken)
            g.rod(vec(-half * .82, .65, z), vec(half * .82, .65, z), .05, .05, iron, 6);
        g.rod(starboard, vec(half * .82, .65, z), .075, .05, iron, 6);
    }
    for (let board = 0; board < 9; board++) {
        const z = -6.6 + board * 1.55, x = (board % 3 - 1) * .48, y = -.2 + (board % 2) * .08;
        g.box(vec(x, y, z), vec(3.15 - (board % 3) * .2, .12, 1.1), board % 2 ? wood : rust);
    }
    // Remaining hull planks join the ribs into a recognizable broken boat.
    for (const side of [-1,1]) for (let rib=0;rib<10;rib++) {
        if((rib+(side>0?1:0))%4===1)continue;
        const z=-7.5+rib*1.5, nextZ=z+1.5;
        const half=2.6-Math.abs(rib-5)*.08, nextHalf=2.6-Math.abs(rib+1-5)*.08;
        g.quad(vec(side*half,-.4,z),vec(side*nextHalf,-.4,nextZ),vec(side*nextHalf*.82,.65,nextZ),vec(side*half*.82,.65,z),rib%2?wood:rust);
    }
    g.rod(vec(-.5, -.55, -1), vec(-.2, 2.8, 1.6), .09, .055, iron, 7);
    g.rod(vec(-.2, 2.8, 1.6), vec(1.8, 1.6, 2.3), .045, .025, rust, 6);
    g.rod(vec(-2, -.1, -7.2), vec(2, -.1, -7.2), .12, .12, dark, 8);
    return g;
}

/** Corroded old outfall pipe, open mouth faces local +Z; visual only. */
export function sewagePipeGeometry(length = 10, radius = 1.2) {
    const g = new Geometry(), iron = rgb('#765747'), rust = rgb('#a36d4d'), dark = rgb('#1d3033');
    const startZ = -length / 2, endZ = length / 2;
    g.ellipsoid(vec(0, 0, startZ + .025), vec(radius * .78, radius * .78, .035), dark, 18, 10);
    for (let band = 0; band < 6; band++) {
        const z = startZ + (length - 1.5) * band / 5;
        for (let i = 0; i < 16; i++) {
            const a = i / 16 * Math.PI * 2, b = (i + 1) / 16 * Math.PI * 2;
            const p = (q: number) => vec(Math.cos(q) * radius, Math.sin(q) * radius, z);
            g.rod(p(a), p(b), .055, .055, band % 2 ? rust : iron, 4);
        }
    }
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2, x = Math.cos(a) * radius, y = Math.sin(a) * radius;
        g.rod(vec(x, y, startZ), vec(x, y, endZ), .075, .075, i % 3 ? iron : rust, 6);
    }
    // Corroded shell panels, with a few actual breaches between reinforcing rings.
    for(let section=0;section<6;section++)for(let i=0;i<18;i++) {
        if((i+section*3)%17===0 || section===3 && i>3 && i<7)continue;
        const a=i/18*Math.PI*2,b=(i+1)/18*Math.PI*2;
        const z=startZ+length*section/6,end=startZ+length*(section+1)/6;
        const p=(angle:number,depth:number)=>vec(Math.cos(angle)*radius,Math.sin(angle)*radius,depth);
        g.quad(p(a,z),p(b,z),p(b,end),p(a,end),(section+i)%4?iron:rust);
    }
    for (let i = 0; i < 18; i++) {
        const a = i / 18 * Math.PI * 2, b = (i + 1) / 18 * Math.PI * 2;
        const point = (q: number) => vec(Math.cos(q) * radius, Math.sin(q) * radius, startZ);
        g.rod(point(a), point(b), .09, .09, i % 3 ? rust : iron, 5);
    }
    for (let i = 0; i < 4; i++) {
        const z = startZ + length * (.28 + i * .13), side = i % 2 ? 1 : -1;
        g.box(vec(side * radius * .96, -.12, z), vec(.28, .13, 1.35), rust);
    }
    return g;
}

export function fishGeometry(kind: 'lionfish' | 'marlow' | 'moray' | 'turtle' | 'ray' | 'native' | 'shark', variant = 0) {
    const g = new Geometry(), cream = rgb('#efdbbb'), dark = rgb('#162b32');
    if (kind === 'lionfish') {
        const red = rgb('#884334');
        g.ellipsoid(vec(0, 0, .08), vec(.27, .32, .6), red, 26, 18, (x, y, z) => Math.sin(z * 29 + y * 4) > 0 ? cream : red);
        for (const side of [-1, 1]) {
            for (let i = 0; i < 11; i++) {
                const a = vec(side * .17, -.02, .27), angle = -1.1 + i / 10 * 2.1, tip = vec(side * (.3 + Math.cos(angle) * .65), Math.sin(angle) * .55, -.05 - i * .025);
                g.rod(a, tip, .014, .004, i % 2 ? cream : red, 4);
                if (i < 10) {
                    const next = vec(side * (.3 + Math.cos(angle + .21) * .65), Math.sin(angle + .21) * .55, -.075 - i * .025);
                    g.tri(a, tip, next, i % 2 ? cream : red);
                }
            }
            g.ellipsoid(vec(side * .19, .13, .52), vec(.068, .07, .048), cream, 8, 5);
            g.ellipsoid(vec(side * .225, .13, .542), vec(.033, .04, .028), dark, 7, 5);
        }
        for (let i = 0; i < 12; i++) {
            const z = .42 - i * .081, h = .35 + Math.sin(i / 11 * Math.PI) * .42;
            g.rod(vec(0, .23, z), vec(Math.sin(i) * .06, .24 + h, z - .12), .013, .002, i % 2 ? cream : red, 4);
        }
        g.tri(vec(0, 0, -.38), vec(-.04, .34, -.93), vec(0, 0, -.86), cream);
        g.tri(vec(0, 0, -.38), vec(0, 0, -.86), vec(.04, -.32, -.93), red);
        g.ellipsoid(vec(0, -.04, .59), vec(.11, .10, .07), red, 8, 5);
    }
    else if (kind === 'marlow') {
        const base = rgb('#929574');
        g.ellipsoid(vec(), vec(.62, .65, 1.36), base, 30, 20, (x, y, z) => { const spots = Math.sin(x * 39 + y * 27 + z * 15) * Math.sin(z * 31 - y * 24); return Math.abs(spots) > .54 ? rgb('#555f50') : tint(base, .91 + y * .12); });
        g.ellipsoid(vec(0, -.09, 1.08), vec(.50, .38, .43), tint(base, .96), 22, 14);
        g.ellipsoid(vec(0, -.12, 1.44), vec(.30, .075, .06), rgb('#304137'), 18, 8);
        g.ellipsoid(vec(0, -.21, 1.40), vec(.31, .058, .075), tint(base, 1.06), 16, 7);
        for (const side of [-1, 1]) {
            g.ellipsoid(vec(side * .46, .20, 1.02), vec(.058, .065, .051), rgb('#c3b779'), 12, 8);
            g.ellipsoid(vec(side * .495, .20, 1.05), vec(.031, .040, .027), dark, 9, 6);
            const root = vec(side * .47, -.09, .48);
            for (let i = 0; i < 7; i++) {
                const t = i / 7, tt = (i + 1) / 7;
                const p = vec(side * (.49 + Math.sin(t * Math.PI) * .43), -.14 - t * .4, .26 - t * .77), q = vec(side * (.49 + Math.sin(tt * Math.PI) * .43), -.14 - tt * .4, .26 - tt * .77);
                g.tri(root, p, q, tint(base, .88));
                g.rod(root, p, .008, .003, tint(base, .72), 4);
            }
            const points = [vec(side * .42, .34, .93), vec(side * .56, .17, .76), vec(side * .58, -.08, .67), vec(side * .48, -.37, .69)];
            for (let i = 0; i < points.length - 1; i++)
                g.rod(points[i], points[i + 1], .011, .01, tint(base, .58), 5);
        }
        for (let i = 0; i < 11; i++) {
            const z = .65 - i * .16, zn = z - .16, y = .53 + Math.sin(i / 11 * Math.PI) * .26, yn = .53 + Math.sin((i + 1) / 11 * Math.PI) * .26;
            g.quad(vec(0, .40, z), vec(0, y, z), vec(0, yn, zn), vec(0, .36, zn), tint(base, .89));
            g.rod(vec(0, .41, z), vec(0, y, z), .009, .004, tint(base, .67), 4);
        }
        const tail = vec(0, 0, -1.12);
        for (let i = 0; i < 12; i++) {
            const t = -Math.PI / 2 + i * Math.PI / 12, tt = t + Math.PI / 12;
            const p = vec(0, Math.sin(t) * .48, -1.55 - Math.cos(t) * .28), q = vec(0, Math.sin(tt) * .48, -1.55 - Math.cos(tt) * .28);
            g.tri(tail, p, q, tint(base, .79));
            g.rod(tail, p, .008, .003, tint(base, .60), 4);
        }
        g.rod(vec(.49, .25, .70), vec(.54, .14, .89), .019, .013, rgb('#d1c7a1'), 6);
    }
    else if (kind === 'moray') {
        const olive = rgb('#92a076');
        const path: Vec[] = [];
        for (let i = 0; i < 16; i++)
            path.push(vec(Math.sin(i * .35) * .16, Math.cos(i * .2) * .08, -i * .18));
        for (let i = 0; i < 15; i++)
            g.rod(path[i], path[i + 1], .2 - i * .009, .2 - (i + 1) * .009, tint(olive, 1 - i * .025), 10);
        g.ellipsoid(vec(0, .02, .23), vec(.20, .18, .37), olive, 16, 10);
        g.ellipsoid(vec(0, -.05, .52), vec(.13, .065, .026), dark, 10, 6);
        for (const s of [-1, 1]) {
            g.ellipsoid(vec(s * .14, .1, .35), vec(.034, .037, .032), rgb('#ead7a4'), 8, 5);
            g.ellipsoid(vec(s * .158, .1, .37), vec(.018, .021, .018), dark, 6, 4);
            for (let i = 0; i < 5; i++)
                g.tri(vec(s * .105, -.02, .48 - i * .05), vec(s * .10, -.075, .5 - i * .05), vec(s * .08, -.02, .52 - i * .05), cream);
        }
    }
    else if (kind === 'turtle') {
        const green = rgb('#89936e');
        g.ellipsoid(vec(), vec(.64, .28, .85), green, 22, 12, (x, y, z) => { const a = Math.sin(x * 15 + z * 7) * Math.cos(z * 14); return a > .25 ? rgb('#acb183') : rgb('#677c67'); });
        g.ellipsoid(vec(0, .04, .97), vec(.22, .20, .32), rgb('#afba89'), 14, 9);
        for (const s of [-1, 1]) {
            g.tri(vec(s * .45, 0, .5), vec(s * 1.28, -.09, .2), vec(s * .92, -.15, -.38), green);
            g.tri(vec(s * .4, -.02, -.55), vec(s * .85, -.1, -.85), vec(s * .41, -.16, -.99), green);
            g.ellipsoid(vec(s * .14, .12, 1.17), vec(.045, .045, .026), dark, 7, 5);
        }
    }
    else if (kind === 'ray') {
        const c = rgb('#618187');
        g.ellipsoid(vec(), vec(.38, .14, .8), c, 16, 9);
        for (const s of [-1, 1]) {
            g.tri(vec(0, 0, .76), vec(s * 1.5, -.06, -.25), vec(0, .13, -.8), c);
            g.tri(vec(0, -.05, .76), vec(0, -.07, -.8), vec(s * 1.5, -.06, -.25), rgb('#b2c6b5'));
        }
        g.rod(vec(0, 0, -.5), vec(.25, 0, -2.4), .045, .006, c, 6);
    }
    else if (kind === 'shark') {
        const slate = rgb('#526f77'), belly = rgb('#9aada2');
        g.ellipsoid(vec(0, 0, .08), vec(.50, .46, 1.56), slate, 24, 14);
        g.ellipsoid(vec(0, -.12, 1.14), vec(.35, .30, .73), slate, 18, 10);
        g.ellipsoid(vec(0, -.24, .96), vec(.37, .19, .78), belly, 18, 8);
        g.ellipsoid(vec(0, -.20, 1.68), vec(.31, .08, .30), dark, 16, 7);
        for (const side of [-1, 1]) {
            g.ellipsoid(vec(side * .43, .17, 1.18), vec(.045, .052, .04), rgb('#d7d8bd'), 8, 5);
            g.ellipsoid(vec(side * .46, .17, 1.20), vec(.022, .031, .022), dark, 7, 4);
            for (let gill = 0; gill < 5; gill++)
                g.rod(vec(side * .38, -.10, .72 - gill * .17), vec(side * .39, -.30, .72 - gill * .17), .018, .012, tint(slate, .74), 4);
            g.tri(vec(side * .36, -.12, .05), vec(side * 1.38, -.27, -.62), vec(side * .45, -.35, -.94), tint(slate, .82));
            g.tri(vec(side * .31, -.16, -.82), vec(side * .83, -.22, -1.27), vec(side * .32, -.34, -1.34), tint(slate, .75));
        }
        g.tri(vec(0, .35, .1), vec(0, 1.05, -.28), vec(0, .42, -.72), tint(slate, 1.12));
        g.tri(vec(0, -.34, .65), vec(0, -.69, .15), vec(0, -.38, -.2), tint(slate, .80));
        g.tri(vec(0, 0, -1.12), vec(0, .94, -1.82), vec(0, .10, -1.61), slate);
        g.tri(vec(0, 0, -1.12), vec(0, -.48, -1.92), vec(0, -.08, -1.60), tint(slate, .78));
    }
    else {
        const colors = ['#f1cc54', '#5ebace', '#517bdd', '#f2a477', '#45cfb4', '#e1859b', '#cce0d4', '#a9cd61'];
        const c = rgb(colors[variant % colors.length]), kind = variant % 8;
        const deep = [0, 2, 5].includes(kind), slender = [1, 6].includes(kind);
        const height = deep ? .24 : slender ? .10 : .16, length = slender ? .46 : .36;
        g.ellipsoid(vec(), vec(deep ? .075 : .105, height, length), c, 18, 11, (x, y, z) => {
            if (kind === 0 && z < -.15 && z > -.5 || kind === 2 && z > .12 && z < .35) return rgb('#172c59');
            if (kind === 1 && y > .08 && y < .3) return rgb('#d9f1e1');
            if (kind === 3 && Math.sin(z * 13) > .35) return rgb('#f5e5bc');
            if (kind === 4 && y > .1 && Math.sin(z * 22 + y * 8) > .6) return rgb('#2667a8');
            if (kind === 5 && y < -.2) return rgb('#ffd398');
            if (kind === 6 && y > 0) return rgb('#578e9c');
            return tint(c, .93 + y * .13);
        });
        // Fan tails, curved dorsal fins and paired translucent-looking pectorals.
        const tail = vec(0, 0, -length * .8), tailY = deep ? .27 : .18;
        for (let i = 0; i < 6; i++) {
            const t = i / 6, n = (i + 1) / 6;
            const edge = (v: number) => vec(0, (v * 2 - 1) * tailY, -length - .22 + Math.abs(v - .5) * .07);
            g.tri(tail, edge(t), edge(n), tint(c, i % 2 ? .94 : 1.15));
            g.rod(tail, edge(t), .003, .001, tint(c, .66), 4);
        }
        for (let i = 0; i < 7; i++) {
            const z = length * .65 - i * length * 1.4 / 7, zn = z - length * 1.4 / 7;
            const h = height + Math.sin((i + 1) / 8 * Math.PI) * (deep ? .13 : .075);
            g.quad(vec(0,height*.7,z),vec(0,h,z),vec(0,h,zn),vec(0,height*.7,zn),tint(c,.85));
        }
        for (const side of [-1, 1]) {
            g.ellipsoid(vec(side * .077, height * .35, length * .62), vec(.028,.029,.026), rgb('#e3e4b0'), 8, 6);
            g.ellipsoid(vec(side * .091, height * .35, length * .66), vec(.017,.020,.018), dark, 7, 5);
            g.rod(vec(side*.09,height*.15,length*.2),vec(side*.087,-height*.55,length*.1),.007,.004,tint(c,.5),5);
            g.tri(vec(side*.07,0,.11),vec(side*.22,-.04,-.07),vec(side*.10,-.07,-.16),tint(c,1.13));
        }
        g.ellipsoid(vec(0,-height*.12,length*.92),vec(.026,.018,.025),tint(c,.62),8,5);
    }
    // UV metadata: creature family and a fin weight. One shared material and
    // one deformation shader are reused by regular meshes and shadow passes.
    const family = kind === 'turtle' ? 2 : kind === 'ray' ? 3 : kind === 'moray' ? 4 : kind === 'lionfish' ? 5 : kind === 'shark' ? 6 : kind === 'marlow' ? 7 : 1;
    for (let i = 0; i < g.positions.length / 3; i++) {
        const x = Math.abs(g.positions[i*3]);
        g.uvs[i*2] = family;
        g.uvs[i*2+1] = kind === 'turtle' ? Math.max(0,x-.5) : kind === 'ray' ? Math.max(0,x-.3) : family === 1 ? Math.max(0,x-.1) : 0;
    }
    return g;
}
export function equipment(kind: 'arms' | 'spear' | 'tube' | 'scooter') {
    const g = new Geometry(), suit = rgb('#183940'), rubber = rgb('#0b242b'), teal = rgb('#4caaa0'), orange = rgb('#edb176'), metal = rgb('#bccbc1');
    if (kind === 'arms') {
        for (const s of [-1, 1]) {
            g.rod(vec(s * .72, -.65, .10), vec(s * .37, -.38, .71), .12, .10, suit, 12);
            g.rod(vec(s * .4, -.38, .65), vec(s * .3, -.3, .88), .108, .075, rubber, 12);
            g.ellipsoid(vec(s * .3, -.28, .90), vec(.09, .078, .14), rubber, 12, 8);
            g.rod(vec(s * .49, -.49, .4), vec(s * .45, -.45, .5), .124, .12, teal, 12);
        }
        g.box(vec(-.415, -.34, .65), vec(.18, .045, .17), orange);
        g.box(vec(-.415, -.314, .65), vec(.135, .009, .125), rgb('#70d6c2'));
    }
    if (kind === 'spear') {
        g.rod(vec(.36, -.32, .23), vec(.025, -.015, 2.28), .018, .012, rubber, 9);
        g.rod(vec(.095, -.08, 1.82), vec(.025, -.015, 2.28), .014, .011, orange, 9);
        for (const s of [-1, 0, 1])
            g.rod(vec(.025 + s * .025, -.015, 2.28), vec(.007 + s * .04, 0, 2.63), .008, .0015, metal, 5);
    }
    if (kind === 'tube') {
        g.rod(vec(-.60, -.7, .45), vec(-.60, -.29, .55), .17, .18, teal, 16);
        g.rod(vec(-.60, -.32, .54), vec(-.60, -.27, .553), .189, .189, orange, 16);
        g.ellipsoid(vec(-.60, -.255, .553), vec(.15, .015, .15), rubber, 14, 5);
    }
    if (kind === 'scooter') {
        g.ellipsoid(vec(0, -.38, 1.04), vec(.34, .25, .62), teal, 20, 12);
        g.ellipsoid(vec(0, -.35, 1.57), vec(.22, .15, .15), orange, 14, 8);
        g.rod(vec(-.42, -.24, .70), vec(.42, -.24, .70), .048, .048, rubber, 9);
        g.rod(vec(0, -.37, .32), vec(0, -.37, .6), .27, .25, rubber, 18);
        g.box(vec(0, -.135, .94), vec(.20, .04, .23), rubber);
        g.box(vec(0, -.11, .94), vec(.14, .01, .16), rgb('#a0e3cb'));
    }
    return g;
}

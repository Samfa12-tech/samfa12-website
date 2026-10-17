import { boatEntry } from './assets/boat-entry.js';
import { Geometry } from './geometry.js';
import type { ReefRenderer } from './renderer.js';

export const BOAT_ENTRY_DURATION = boatEntry.duration;
export const BOAT_WATER_CONTACT = boatEntry.events.waterContact;

/** Two draws for the authored 52 parts. Only the diver's fixed vertex buffers animate. */
export class BoatCrew {
    pilot: any;
    diver: any;
    private items: any[] = [];
    private positions!: Float32Array;
    private normals!: Float32Array;
    private lastTime = -1;
    private B = (globalThis as any).BABYLON;
    private scale = new this.B.Vector3();
    private rotation = new this.B.Quaternion();
    private translation = new this.B.Vector3();
    private matrix = new this.B.Matrix();
    constructor(renderer: ReefRenderer, boat: any) {
        for (const actor of ['pilot', 'diver']) {
            const g = new Geometry(), items: any[] = [];
            boatEntry.parts.forEach((part, index) => {
                if (part.actor !== actor) return;
                const offset = g.positions.length;
                g.positions.push(...part.geometry.positions); g.normals.push(...part.geometry.normals);
                g.colors.push(...part.geometry.colors); g.uvs.push(...part.geometry.uvs);
                for (const vertex of part.geometry.indices) g.indices.push(vertex + offset / 3);
                const poses = boatEntry.frames.map(frame => {
                    const scale = new this.B.Vector3(), rotation = new this.B.Quaternion(), translation = new this.B.Vector3();
                    this.B.Matrix.FromArray(frame.matrices[index]).decompose(scale, rotation, translation);
                    return { scale, rotation, translation };
                });
                items.push({ offset, geometry: part.geometry, poses });
            });
            const positions = new Float32Array(g.positions.length), normals = new Float32Array(g.normals.length);
            this.bake(items, 0, positions, normals);
            g.positions = Array.from(positions); g.normals = Array.from(normals);
            const mesh = renderer.mesh('boat-' + actor, g, 1); mesh.parent = boat;
            if (actor === 'pilot') this.pilot = mesh;
            else {
                this.diver = mesh; this.items = items; this.positions = positions; this.normals = normals;
                mesh.setVerticesData('position', positions, true, 3);
                mesh.setVerticesData('normal', normals, true, 3);
            }
        }
    }
    private bake(items: any[], time: number, positions: Float32Array, normals: Float32Array) {
        let frame = 0;
        while (frame + 1 < boatEntry.frames.length && boatEntry.frames[frame + 1].time <= time) frame++;
        const next = Math.min(frame + 1, boatEntry.frames.length - 1), a = boatEntry.frames[frame].time, b = boatEntry.frames[next].time;
        const blend = b > a ? Math.max(0, Math.min(1, (time - a) / (b - a))) : 0;
        for (const item of items) {
            const p = item.poses[frame], q = item.poses[next];
            this.B.Vector3.LerpToRef(p.scale, q.scale, blend, this.scale);
            this.B.Vector3.LerpToRef(p.translation, q.translation, blend, this.translation);
            this.B.Quaternion.SlerpToRef(p.rotation, q.rotation, blend, this.rotation);
            this.B.Matrix.ComposeToRef(this.scale, this.rotation, this.translation, this.matrix);
            const m = this.matrix.m, sx = this.scale.x ** 2, sy = this.scale.y ** 2, sz = this.scale.z ** 2;
            const g = item.geometry;
            for (let i = 0; i < g.positions.length; i += 3) {
                const j = item.offset + i, x = g.positions[i], y = g.positions[i + 1], z = g.positions[i + 2];
                positions[j] = m[0]*x + m[4]*y + m[8]*z + m[12];
                positions[j+1] = m[1]*x + m[5]*y + m[9]*z + m[13];
                positions[j+2] = m[2]*x + m[6]*y + m[10]*z + m[14];
                // Inverse transpose handles authored nonuniform limb scale.
                const nx = g.normals[i]/sx, ny = g.normals[i+1]/sy, nz = g.normals[i+2]/sz;
                const u = m[0]*nx+m[4]*ny+m[8]*nz, v = m[1]*nx+m[5]*ny+m[9]*nz, w = m[2]*nx+m[6]*ny+m[10]*nz, length = Math.hypot(u,v,w) || 1;
                normals[j] = u/length; normals[j+1] = v/length; normals[j+2] = w/length;
            }
        }
    }
    update(time: number | null) {
        const t = Math.max(0, Math.min(BOAT_ENTRY_DURATION, time ?? 0));
        this.diver.setEnabled(t < BOAT_ENTRY_DURATION);
        if (t === this.lastTime) return;
        this.lastTime = t;
        this.bake(this.items, t, this.positions, this.normals);
        this.diver.updateVerticesData('position', this.positions, true, false);
        this.diver.updateVerticesData('normal', this.normals, false, false);
    }
}

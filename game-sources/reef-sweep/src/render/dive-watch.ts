import type { Profile, Run, Site } from '../game/types.js';
import { airCapacity, capacity } from '../game/data.js';
import { timeText } from '../game/math.js';

declare const BABYLON: any;

/** A small wrist-mounted dive computer. The display is a reusable RGBA texture. */
export class DiveWatch {
    readonly root: any;
    private readonly scene: any;
    private readonly bodyMaterial: any;
    private readonly displayMaterial: any;
    private readonly face: any;
    private readonly texture: any;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly canvas: HTMLCanvasElement;
    private lastDraw = -Infinity;
    private raised = false;
    private disposed = false;
    private current = { air: 0, maxAir: 1, depth: 0, elapsed: 0, cargo: 0, capacity: 0, battery: 100, reserve: 0, low: false, exposed: false, site: '' };

    constructor(scene: any, parent?: any) {
        const B = BABYLON;
        this.scene = scene;
        B.Effect.ShadersStore['diveWatchVertexShader'] = `precision highp float; attribute vec3 position; attribute vec3 normal; attribute vec4 color; attribute vec2 uv; uniform mat4 world; uniform mat4 viewProjection; varying vec3 vColor; varying vec3 vNormal; varying vec2 vUV; void main(void){vColor=color.rgb;vNormal=normalize(mat3(world)*normal);vUV=uv;gl_Position=viewProjection*world*vec4(position,1.0);}`;
        B.Effect.ShadersStore['diveWatchFragmentShader'] = `precision highp float; varying vec3 vColor; varying vec3 vNormal; void main(void){float light=0.72+0.28*max(dot(normalize(vNormal),normalize(vec3(-0.25,0.4,-0.85))),0.0);gl_FragColor=vec4(vColor*light,1.0);}`;
        B.Effect.ShadersStore['diveWatchDisplayVertexShader'] = `precision highp float; attribute vec3 position; attribute vec2 uv; uniform mat4 world; uniform mat4 viewProjection; varying vec2 vUV; void main(void){vUV=uv;gl_Position=viewProjection*world*vec4(position,1.0);}`;
        B.Effect.ShadersStore['diveWatchDisplayFragmentShader'] = `precision highp float; varying vec2 vUV; uniform sampler2D displayTexture; void main(void){gl_FragColor=texture2D(displayTexture,vUV);}`;
        this.bodyMaterial = new B.ShaderMaterial('dive-watch-body', scene, { vertex: 'diveWatch', fragment: 'diveWatch' }, { attributes: ['position', 'normal', 'color'], uniforms: ['world', 'viewProjection'] });
        this.bodyMaterial.backFaceCulling = false;
        this.root = new B.Mesh('dive-watch-root', scene);
        if (parent) this.root.parent = parent;
        // Wrist-sized case. Its front faces -Z toward the first-person camera.
        this.box('watch-strap-upper', .205, .115, .024, 0, .202, -.002, '#182b2c');
        this.box('watch-strap-lower', .205, .115, .024, 0, -.202, -.002, '#182b2c');
        this.box('watch-case', .292, .368, .054, 0, 0, 0, '#223a3a');
        this.box('watch-bezel', .268, .343, .019, 0, 0, -.034, '#647c70');
        this.box('watch-screen-backing', .239, .313, .009, 0, 0, -.046, '#091c1b');
        this.box('watch-button-left', .028, .068, .026, -.161, .071, -.025, '#8c9c82');
        this.box('watch-button-right', .028, .068, .026, .161, .071, -.025, '#8c9c82');
        this.box('watch-clasp', .12, .036, .027, 0, -.202, -.006, '#91a18b');

        this.canvas = document.createElement('canvas');
        this.canvas.width = 320;
        this.canvas.height = 420;
        const context = this.canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Canvas rendering is required for the dive computer.');
        this.ctx = context;
        const pixels = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
        this.texture = B.RawTexture.CreateRGBATexture(pixels, this.canvas.width, this.canvas.height, scene, false, true, B.Texture.NEAREST_SAMPLINGMODE);
        this.texture.wrapU = B.Texture.CLAMP_ADDRESSMODE;
        this.texture.wrapV = B.Texture.CLAMP_ADDRESSMODE;
        this.displayMaterial = new B.ShaderMaterial('dive-watch-display', scene, { vertex: 'diveWatchDisplay', fragment: 'diveWatchDisplay' }, { attributes: ['position', 'uv'], uniforms: ['world', 'viewProjection'], samplers: ['displayTexture'] });
        this.displayMaterial.backFaceCulling = false;
        this.displayMaterial.setTexture('displayTexture', this.texture);
        this.face = this.quad('watch-display', .232, .306, 0, 0, 0, -.052, this.displayMaterial);
        this.root.isPickable = false;
        this.draw(true);
    }

    private box(name: string, width: number, height: number, depth: number, x: number, y: number, z: number, color: string) {
        const B = BABYLON, mesh = new B.Mesh(name, this.scene), v = new B.VertexData();
        const x0 = -width / 2, x1 = width / 2, y0 = -height / 2, y1 = height / 2, z0 = -depth / 2, z1 = depth / 2;
        const positions = [
            x0,y0,z0, x1,y0,z0, x1,y1,z0, x0,y1,z0,
            x0,y0,z1, x1,y0,z1, x1,y1,z1, x0,y1,z1,
            x0,y0,z0, x0,y1,z0, x0,y1,z1, x0,y0,z1,
            x1,y0,z0, x1,y1,z0, x1,y1,z1, x1,y0,z1,
            x0,y0,z0, x1,y0,z0, x1,y0,z1, x0,y0,z1,
            x0,y1,z0, x1,y1,z0, x1,y1,z1, x0,y1,z1,
        ];
        const normals = [
            0,0,-1,0,0,-1,0,0,-1,0,0,-1, 0,0,1,0,0,1,0,0,1,0,0,1,
            -1,0,0,-1,0,0,-1,0,0,-1,0,0, 1,0,0,1,0,0,1,0,0,1,0,0,
            0,-1,0,0,-1,0,0,-1,0,0,-1,0, 0,1,0,0,1,0,0,1,0,0,1,0,
        ];
        const indices: number[] = [];
        for (let f = 0; f < 6; f++) { const i = f * 4; indices.push(i, i + 1, i + 2, i, i + 2, i + 3); }
        const rgb = [parseInt(color.slice(1, 3), 16) / 255, parseInt(color.slice(3, 5), 16) / 255, parseInt(color.slice(5, 7), 16) / 255];
        const shade = [.60, 1, .80, .90, .68, 1];
        v.positions = positions; v.normals = normals; v.indices = indices; v.colors = shade.flatMap((scale) => [...rgb.map(n => n * scale), 1].concat([...rgb.map(n => n * scale), 1], [...rgb.map(n => n * scale), 1], [...rgb.map(n => n * scale), 1])); v.applyToMesh(mesh, false);
        mesh.material = this.bodyMaterial; mesh.position.set(x, y, z); mesh.parent = this.root; mesh.isPickable = false; mesh.renderingGroupId = 1;
        return mesh;
    }

    private quad(name: string, width: number, height: number, depth: number, x: number, y: number, z: number, material: any) {
        const B = BABYLON, mesh = new B.Mesh(name, this.scene), v = new B.VertexData();
        v.positions = [-width/2,-height/2,-depth/2, width/2,-height/2,-depth/2, width/2,height/2,-depth/2, -width/2,height/2,-depth/2];
        v.normals = [0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1];
        v.uvs = [0,0, 1,0, 1,1, 0,1]; v.indices = [0,2,1,0,3,2]; v.applyToMesh(mesh, false);
        mesh.material = material; mesh.position.set(x, y, z); mesh.parent = this.root; mesh.isPickable = false; mesh.renderingGroupId = 1;
        return mesh;
    }

    setRaised(value: boolean) {
        if (value === this.raised) return;
        this.raised = value;
        this.draw(true);
    }

    update(run: Run | null, site: Site, profile: Profile, time = run?.time ?? 0, reserve = 40) {
        if (this.disposed || !run) return;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (now - this.lastDraw < 200) return;
        const maxAir = airCapacity(profile), depth = Math.max(0, site.surface - run.p.y);
        this.current.air = run.air; this.current.maxAir = maxAir; this.current.depth = depth;
        this.current.elapsed = time; this.current.cargo = run.cargo.length; this.current.exposed = !!run.exposed;
        this.current.capacity = capacity(profile); this.current.battery = run.battery;
        this.current.reserve = reserve; this.current.low = run.air <= reserve;
        this.current.site = site.name;
        this.draw(false, now);
    }

    stats() { return { raised: this.raised, textureUpdates: this.textureUpdates, secured: this.current.cargo, exposed: this.current.exposed }; }
    private textureUpdates = 0;

    private draw(force: boolean, now = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
        if (!force && now - this.lastDraw < 200) return;
        this.lastDraw = now;
        const c = this.ctx, w = this.canvas.width, h = this.canvas.height, d = this.current;
        c.fillStyle = '#071716'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#102722'; c.fillRect(7, 7, w - 14, h - 14);
        c.strokeStyle = '#668a69'; c.lineWidth = 3; c.strokeRect(8.5, 8.5, w - 17, h - 17);
        c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillStyle = '#a4d89e'; c.font = 'bold 18px Arial, sans-serif'; c.fillText('REEF SWEEP', 22, 31);
        c.textAlign = 'right'; c.fillStyle = '#a9c5a0'; c.font = 'bold 12px Arial, sans-serif'; c.fillText('DIVE COMPUTER', w - 22, 31);
        c.strokeStyle = '#52735a'; c.lineWidth = 1; c.beginPath(); c.moveTo(20, 51); c.lineTo(w - 20, 51); c.stroke();

        const air = Math.max(0, Math.ceil(d.air)), ratio = Math.max(0, Math.min(1, d.air / Math.max(1, d.maxAir)));
        c.fillStyle = d.low ? '#ff9b70' : '#e3edc8'; c.font = 'bold 65px Arial, sans-serif'; c.textAlign = 'left'; c.fillText(String(air), 20, 119);
        c.fillStyle = d.low ? '#ffb29a' : '#9fc69b'; c.font = 'bold 17px Arial, sans-serif'; c.fillText('AIR', 22, 157);
        c.textAlign = 'right'; c.fillStyle = '#d0dfc5'; c.font = 'bold 18px Arial, sans-serif'; c.fillText('bar*', w - 20, 146);
        c.fillStyle = '#244137'; c.fillRect(20, 174, w - 40, 12);
        c.fillStyle = d.low ? '#fa704d' : '#7bd5a4'; c.fillRect(20, 174, (w - 40) * ratio, 12);
        c.fillStyle = '#8da98d'; c.font = '13px Arial, sans-serif'; c.textAlign = 'left'; c.fillText(`HOME RESERVE ${Math.ceil(d.reserve)} bar`, 20, 207);

        c.strokeStyle = '#52735a'; c.beginPath(); c.moveTo(20, 227); c.lineTo(w - 20, 227); c.stroke();
        const row = (label: string, value: string, y: number, color = '#e3edc8') => { c.textAlign = 'left'; c.fillStyle = '#9fc69b'; c.font = 'bold 15px Arial, sans-serif'; c.fillText(label, 21, y); c.textAlign = 'right'; c.fillStyle = color; c.font = 'bold 23px Arial, sans-serif'; c.fillText(value, w - 21, y + 2); };
        row('DEPTH', d.depth < .05 ? 'SURFACE' : `${d.depth.toFixed(1)} m`, 261);
        row('ELAPSED', timeText(d.elapsed), 313);
        row('SECURED', `${Math.min(d.cargo, d.capacity)} / ${d.capacity}`, 365, d.cargo >= d.capacity ? '#ffd08a' : '#e3edc8');
        c.strokeStyle = '#52735a'; c.beginPath(); c.moveTo(20, 391); c.lineTo(w - 20, 391); c.stroke();
        if (d.low) {
            c.fillStyle = '#8d3228'; c.fillRect(8, 395, w - 16, 19);
            c.textAlign = 'center'; c.fillStyle = '#fff2d8'; c.font = 'bold 15px Arial, sans-serif'; c.fillText('LOW AIR · RETURN NOW', w / 2, 405);
        } else {
            c.textAlign = 'left'; c.fillStyle = '#9fc69b'; c.font = 'bold 12px Arial, sans-serif'; c.fillText(d.exposed ? 'FISH ON SPEAR · EXPOSED' : d.site.toUpperCase(), 21, 404);
            c.textAlign = 'right'; c.fillStyle = '#c4d7b7'; c.fillText(`BAT ${Math.ceil(d.battery)}%`, w - 21, 404);
        }
        const bytes = c.getImageData(0, 0, w, h).data;
        this.texture.update(bytes);
        this.textureUpdates++;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.root.dispose(false, false);
        this.bodyMaterial.dispose();
        this.displayMaterial.dispose();
        this.texture.dispose();
    }
}

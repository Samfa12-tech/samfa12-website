import { collectionMotion } from './collection-motion.js';
import { skiffGeometry } from './boat-travel.js';
import { seaStar, lobster, sponge, habitatChair, charmGeometry } from './marine-life.js';
import { CHARMS, heldCatches } from '../game/expedition.js';
import { DiveWatch } from './dive-watch.js';
import { diverPose, forearmGeometry, sleeveGeometry, type DiverPose } from './diver-animation.js';
import { siteObstacleGeometry } from './biome-geometry.js';
import { recoveryForRun, recoveryPopulationShare } from '../game/reef-recovery.js';
import { ReefShadows } from './shadows.js';
import { BubblePool } from '../game/breathing.js';
import type { Profile, Run, Site, Settings, Vec } from '../game/types.js';
import { Geometry, rgb, tint, coral, fishGeometry, equipment, seaweedGeometry, shipwreckGeometry, sewagePipeGeometry, islandGeometry } from './geometry.js';
import { seabedGeometry, sandHeight, mergeGrounded } from './terrain.js';
import { reefVertex, reefFragment } from './shaders.js';
import { vec, rng, direction, distance, clamp, norm, sub, dot } from '../game/math.js';
import { floorHeight, SITES, freePoint, wreckAnchor, pipeAnchor, upgradeLevel, siteForRun } from '../game/data.js';
import { nativeFishMotion, prepareNativeOrbit, type NativeFishMotion } from '../game/fish-motion.js';
declare const BABYLON: any;
type BMesh = any;
const xzDistance = (x: number, z: number, p: Vec) => Math.hypot(x - p.x, z - p.z);
function clearDecoration(x: number, z: number, site: Site, run: Run, radius: number) {
    if (Math.abs(x - site.entry.x) < 3.6 && z > site.entry.z - 4 && z < site.entry.z + 28)
        return false;
    if (run.jobs.some(job => xzDistance(x, z, job.p) < radius + 1.25))
        return false;
    if (run.fish.some(fish => fish.alive && xzDistance(x, z, fish.home) < radius + 1.5))
        return false;
    return true;
}
/** Renderer boundary: Babylon objects are never used by the domain simulation. */
export class ReefRenderer {
    engine: any;
    scene: any;
    camera: any;
    materials: any[] = [];
    staticMeshes: BMesh[] = [];
    fishMeshes = new Map<string, BMesh>();
    animalMeshes = new Map<string, BMesh>();
    jobMeshes = new Map<string, BMesh>();
    nativeSchools: {
        mesh: BMesh;
        matrices: Float32Array;
        members: {
            seed: number;
            center: Vec;
            scale: number;
            radius: number;
            motion: NativeFishMotion;
        }[];
    }[] = [];
    nativeTargets: {
        p: Vec;
        r: number;
    }[] = [];
    environmentCounts = { coral: 0, seaweedClumps: 0, seaweedFronds: 0, nativeFish: 0, nativeSchools: 0, shipwrecks: 0, pipeMouths: 0, coastlinePieces: 0 };
    atmosphere = '';
    nativeScale: any;
    nativeRotation: any;
    nativeTranslation: any;
    nativeTransform: any;
    forwardVector: any;
    waterVector: any;
    torchVector: any;
    bubblePool = new BubblePool();
    bubbleMesh: any;
    bubbleMatrices = new Float32Array(24 * 16);
    shadows!: ReefShadows;
    spear: any;
    arms: any;
    leftArm: any; rightArm: any; leftSleeve: any; rightSleeve: any;
    watch: DiveWatch | null = null;
    private watchRequested = false;
    private watchBlend = 0;
    private watchReserve = 40;
    private lastPoseTime = 0;
    private pose: DiverPose = { left: vec(), right: vec(), leftRoll: 0, rightRoll: 0, reach: 0, thrust: 0 };
    setWatchRaised(value: boolean) { this.watchRequested = value; }
    setWatchReserve(value: number) { if (Number.isFinite(value)) this.watchReserve = Math.max(0,value); }
    get watchRaised() { return this.watchRequested; }
    tube: any;
    scooter: any;
    injector:any;
    held: any;
    charm: any;
    site: Site = SITES.gardens;
    run: Run | null = null;
    encounterMeshes: {boat:any;object:any;line:any}|null=null;
    profile: Profile | null = null;
    settings: Settings;
    fps = 0;
    draws = 0;
    lastCaptureTime = -99;
    captureQueue: {
        id: string;
        callback: (image: string) => void;
    }[] = [];
    onLost: () => void = () => { };
    constructor(public canvas: HTMLCanvasElement, settings: Settings) { this.settings = settings; const B = BABYLON; this.engine = new B.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, powerPreference: 'high-performance' }, false); this.scene = new B.Scene(this.engine); this.scene.clearColor = new B.Color4(.035, .31, .37, 1); this.scene.autoClear = true; this.camera = new B.FreeCamera('diver', new B.Vector3(0, 8, -41), this.scene); this.camera.minZ = .045; this.camera.maxZ = 500; this.camera.fov = settings.fov * Math.PI / 180; this.scene.activeCamera = this.camera; this.scene.skipPointerMovePicking = true; this.scene.setRenderingAutoClearDepthStencil(1, true, true, true); B.Effect.ShadersStore['reefVertexShader'] = reefVertex; B.Effect.ShadersStore['reefFragmentShader'] = reefFragment; this.nativeScale = new B.Vector3(1, 1, 1); this.nativeRotation = new B.Quaternion(0, 0, 0, 1); this.nativeTranslation = new B.Vector3(); this.nativeTransform = new B.Matrix(); this.forwardVector = new B.Vector3(); this.torchVector = {x:16,y:.05}; this.shadows = new ReefShadows(this.scene,this.engine); this.configure(settings); canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.onLost(); }); window.addEventListener('resize', () => this.engine.resize()); }
    configure(settings: Settings) { this.settings = settings; const scale = settings.quality === 'high' ? 1 / Math.min(devicePixelRatio || 1, 1.5) : settings.quality === 'low' ? 1.45 : 1; this.engine.setHardwareScalingLevel(scale); this.engine.resize(); this.camera.fov = settings.fov * Math.PI / 180; this.shadows?.configure(settings.quality === 'high'); }
    material(mode: number) { let m = this.materials.find(m => m._reefMode === mode); if (m)
        return m; const B = BABYLON; m = new B.ShaderMaterial('reef-' + mode, this.scene, { vertex: 'reef', fragment: 'reef' }, { attributes: ['position', 'normal', 'color', 'uv'], uniforms: ['world', 'viewProjection', 'uTime', 'uMode', 'uSea', 'uRadius', 'uFold', 'uMotion', 'uSurface', 'uEye', 'uFog', 'uLight', 'uForward', 'uWaterColor', 'uNight', 'uCurrent', 'uTorch', 'uSunMatrix', 'uTorchMatrix', 'uShadows', 'uTorchShadows'], samplers: ['uSunShadow','uTorchShadow'], needAlphaBlending: mode === 5 || mode === 6 || mode === 8 || mode === 10 || mode === 11 }); m._reefMode = mode; m.backFaceCulling = false; m.setFloat('uMode', mode); m.setFloat('uSea',0);m.setFloat('uFold',0);m.setFloat('uRadius',this.site.radius); m.setFloat('uSurface', this.site.surface); m.setFloat('uMotion', 1); m.setVector3('uWaterColor',new B.Vector3(.035,.31,.39)); m.setFloat('uFog', .030); m.setFloat('uLight', 0); m.setFloat('uNight', 0); m.setVector2('uCurrent', {x:this.site.current,y:this.site.channelX ?? (this.site.id === 'gardens' ? 18 : 0)}); m.setVector2('uTorch', {x:24,y:.10}); if (mode === 5 || mode === 6 || mode === 8 || mode === 10 || mode === 11) {
        m.disableDepthWrite = true;
        m.alphaMode = B.Engine.ALPHA_COMBINE;
    } m.setMatrix('uSunMatrix',this.shadows.sunMatrix);m.setMatrix('uTorchMatrix',this.shadows.torchMatrix);m.setFloat('uShadows',0);m.setFloat('uTorchShadows',0);m.setTexture('uSunShadow',this.shadows.white);m.setTexture('uTorchShadow',this.shadows.white);this.materials.push(m); return m; }
    mesh(name: string, g: Geometry, mode = 1) { const B = BABYLON, m = new B.Mesh(name, this.scene), v = new B.VertexData(); v.positions = g.positions; v.normals = g.normals; v.colors = g.colors; v.uvs = g.uvs; v.indices = g.indices; v.applyToMesh(m, false); m.material = this.material(mode); m.isPickable = false; return m; }
    disposeWorld() { this.watch?.dispose();this.watch=null;this.watchRequested=false;this.watchBlend=0; for (const m of this.scene.meshes.slice())
        m.dispose(false, false); this.staticMeshes = []; this.fishMeshes.clear(); this.animalMeshes.clear(); this.jobMeshes.clear(); this.nativeSchools = []; this.captureQueue = []; }
    build(profile: Profile, run: Run) {
        this.disposeWorld();
        this.camera.maxZ=500;
        this.shadows.reset();
        this.bubblePool = new BubblePool();
        this.profile = profile;
        this.run = run;
        this.encounterMeshes=null;
        this.site = siteForRun(run);
        const site = this.site, random = rng(site.seed), B = BABYLON;
        this.environmentCounts = { coral: 0, seaweedClumps: 0, seaweedFronds: 0, nativeFish: 0, nativeSchools: 0, shipwrecks: 0, pipeMouths: 0, coastlinePieces: 0 };
        for (const m of this.materials)
            { m.setFloat('uSea',0);m.setFloat('uRadius',site.radius);m.setFloat('uSurface', site.surface); m.setVector2('uCurrent', {x:site.current,y:site.channelX ?? (site.id === 'gardens' ? 18 : 0)}); }
        // Ground is authored topography, not a regenerated collision surface.
        const ground = seabedGeometry(site);
        this.staticMeshes.push(this.mesh('rippled-sand', ground, 0));
        const chunks = new Map<string, Geometry>(), seaweedChunks = new Map<string, Geometry>();
        const chunk = (x: number, z: number) => { const key = `${Math.floor(x / 22)}:${Math.floor(z / 22)}`; if (!chunks.has(key))
            chunks.set(key, new Geometry()); return chunks.get(key)!; };
        const seaweedChunk = (x: number, z: number) => { const key = `${Math.floor(x / 22)}:${Math.floor(z / 22)}`; if (!seaweedChunks.has(key))
            seaweedChunks.set(key, new Geometry()); return seaweedChunks.get(key)!; };
        const visibleRocks = site.rocks.filter(rock => !rock.hidden);
        for (const rock of visibleRocks) {
            const g = chunk(rock.p.x, rock.p.z);
            g.merge(siteObstacleGeometry(rock, site));
        }
        const templates = Array.from({ length: 6 }, (_, i) => coral(i, site.seed + i * 523));
        const biomeCoral=site.biome==='cenote'?.48:site.biome==='mangrove'?.55:site.biome==='harbour'?.70:1;
        const coralCount = Math.round((this.settings.quality === 'high' ? 1800 : this.settings.quality === 'low' ? 1000 : 1400)*biomeCoral);
        const coralPatches: { rock: typeof visibleRocks[number]; nx: number; nz: number }[] = [];
        for (const rock of visibleRocks.filter(rock=>rock.form!=='root'&&rock.form!=='piling'))
            for (let patch = 0; patch < 5; patch++) {
                const angle = patch / 5 * Math.PI * 2 + random() * .24, radius = .24 + random() * .48;
                const nx = Math.cos(angle) * radius, nz = Math.sin(angle) * radius;
                const x = rock.p.x + nx * rock.s.x, z = rock.p.z + nz * rock.s.z;
                if (clearDecoration(x, z, site, run, 1.2)) coralPatches.push({ rock, nx, nz });
            }
        if (!coralPatches.length)
            visibleRocks.filter(rock=>rock.form!=='root'&&rock.form!=='piling').forEach(rock => coralPatches.push({ rock, nx: 0, nz: 0 }));
        for (let i = 0; i < coralCount; i++) {
            if(!coralPatches.length)break;
            const patch = coralPatches[i % coralPatches.length], rock = patch.rock;
            const a = random() * Math.PI * 2, r = Math.sqrt(random()) * .28;
            const nx = patch.nx + Math.cos(a) * r, nz = patch.nz + Math.sin(a) * r;
            const normalizedRadius = Math.hypot(nx, nz), x = rock.p.x + nx * rock.s.x, z = rock.p.z + nz * rock.s.z;
            if (normalizedRadius > .9 || !clearDecoration(x, z, site, run, 1.0) || rock.id.includes('crown') && i % 3 !== 0)
                continue;
            const y = rock.p.y + rock.s.y * Math.sqrt(Math.max(0, 1 - normalizedRadius * normalizedRadius));
            const kind = Math.floor(random() * 6), s = .45 + random() * .9;
            chunk(x, z).merge(templates[kind], vec(x, y - .06, z), vec(s, s, s), random() * 6.28);
            this.environmentCounts.coral++;
        }
        // Low reef patches fill the edges of the entry lane and work areas.
        const lowReefPatches = Math.round((this.settings.quality === 'high' ? 360 : this.settings.quality === 'low' ? 180 : 270)*biomeCoral);
        for (let i = 0; i < lowReefPatches; i++) {
            const x = (random() - .5) * 95, z = -38 + random() * 95;
            if (!clearDecoration(x, z, site, run, 1.1))
                continue;
            const p = vec(x, sandHeight(x, z, site), z);
            if (!freePoint({ ...p, y: p.y + 1 }, site, 1))
                continue;
            const s = .25 + random() * .55;
            mergeGrounded(chunk(x, z), templates[Math.floor(random() * 6)], p, vec(s, s, s), random() * 6.28, site);
            this.environmentCounts.coral++;
        }

        const seaweedCount = Math.round((this.settings.quality === 'high' ? 1000 : this.settings.quality === 'low' ? 500 : 760)*(site.biome==='cenote'?.30:site.biome==='mangrove'?1.15:1));
        let seaweedAttempts = 0;
        while (this.environmentCounts.seaweedClumps < seaweedCount && seaweedAttempts++ < seaweedCount * 4) {
            const area = random();
            let x: number, z: number;
            if (area < .40 && visibleRocks.length) {
                const rock = visibleRocks[Math.floor(random() * visibleRocks.length)], angle = random() * Math.PI * 2, r = 1.02 + random() * .55;
                x = rock.p.x + Math.cos(angle) * rock.s.x * r;
                z = rock.p.z + Math.sin(angle) * rock.s.z * r;
            }
            else if (area < .68) {
                const side = random() < .5 ? -1 : 1;
                x = site.entry.x + side * (4.2 + random() * 10);
                z = site.entry.z + random() * 26;
            }
            else if (area < .82 && run.jobs.length) {
                const job = run.jobs[Math.floor(random() * run.jobs.length)], angle = random() * Math.PI * 2, r = 4.0 + random() * 3.5;
                x = job.p.x + Math.cos(angle) * r;
                z = job.p.z + Math.sin(angle) * r;
            }
            else {
                x = (random() - .5) * 112;
                z = -48 + random() * 112;
            }
            if (!clearDecoration(x, z, site, run, 1.1))
                continue;
            const y = sandHeight(x, z, site), p = vec(x, y, z);
            if (!freePoint(vec(x, y + .6, z), site, .4)) continue;
            const fronds = seaweedGeometry(site.seed + seaweedAttempts * 53, .8 + random() * .75);
            mergeGrounded(seaweedChunk(x, z), fronds, p, vec(.9 + random() * .32, 1, .9 + random() * .32), random() * Math.PI * 2, site);
            this.environmentCounts.seaweedClumps++;
            this.environmentCounts.seaweedFronds += fronds.positions.length / 60;
        }
        for (const [key, g] of chunks)
            if (g.positions.length)
                this.staticMeshes.push(this.mesh('reef-cell-' + key, g));
        for (const [key, g] of seaweedChunks)
            if (g.positions.length)
                this.staticMeshes.push(this.mesh('seaweed-cell-' + key, g, 7));
        const water = new Geometry(), waterSteps = 48;
        for (let z = 0; z <= waterSteps; z++)
            for (let x = 0; x <= waterSteps; x++)
                water.v(vec(-550 + x * 1100 / waterSteps, site.surface, -550 + z * 1100 / waterSteps), vec(0, -1, 0), rgb('#73bdb4'));
        for (let z = 0; z < waterSteps; z++)
            for (let x = 0; x < waterSteps; x++) {
                const a = z * (waterSteps + 1) + x, b = a + waterSteps + 1;
                water.indices.push(a, a + 1, b, b, a + 1, b + 1);
            }
        this.staticMeshes.push(this.mesh('moving-water-surface', water, 3));
        const beams = new Geometry();
        for (let i = 0; i < 8; i++) {
            const x = -38 + i * 12, z = -25 + (i % 3) * 23, top = vec(x, site.surface - .4, z), bottom = vec(x + 7, -1, z - 3);
            const width = 1.0 + i % 3 * .45;
            const base = beams.positions.length / 3;
            for (let j = 0; j < 2; j++)
                for (let s = 0; s < 8; s++) {
                    const angle = s / 7 * Math.PI * 2, p = j ? bottom : top;
                    beams.v(vec(p.x + Math.cos(angle) * width * (j ? 1.8 : .6), p.y, p.z + Math.sin(angle) * width * (j ? 1.8 : .6)), vec(0, 1, 0), rgb('#b4dbbd'), s / 7, j);
                }
            for (let s = 0; s < 7; s++) {
                const a = base + s, b = a + 8;
                beams.indices.push(a, a + 1, b, a + 1, b + 1, b);
            }
        }
        this.staticMeshes.push(this.mesh('shafts-of-light', beams, 5));
        const dust = new Geometry();
        for (let i = 0; i < 180; i++) {
            const p = vec((random() - .5) * 100, 2 + random() * (site.surface - 4), -45 + random() * 100), s = .016 + random() * .032;
            dust.tri(vec(p.x - s, p.y, p.z), vec(p.x + s, p.y, p.z), vec(p.x, p.y + s * 2, p.z), rgb('#96c8b8'));
        }
        this.staticMeshes.push(this.mesh('drifting-plankton', dust, 6));
        // Boat and mooring are always in the same location; their shadow is a navigational landmark.
        const home = site.landmarks[0].p, boat = new Geometry();
        boat.rod(vec(home.x, floorHeight(home.x, home.z, site), home.z), vec(home.x, site.surface, home.z), .035, .035, rgb('#d6c6a5'), 7);
        boat.ellipsoid(vec(home.x + 2.5, site.surface - .2, home.z), vec(.3, .43, .3), rgb('#f0b16e'), 14, 9);
        const skiff=this.mesh('home-dive-skiff-blender',skiffGeometry(),1);skiff.position.set(home.x,site.surface+.2,home.z);this.staticMeshes.push(skiff);
        this.staticMeshes.push(this.mesh('home-mooring', boat, 1));
        if(run.encounter){
            const e=run.encounter,hull=new Geometry(),object=new Geometry(),line=new Geometry();
            hull.ellipsoid(vec(0,.15,0),vec(1.4,.55,3.6),rgb('#ca9970'),12,7);hull.box(vec(0,.72,.2),vec(1.8,.8,1.6),rgb('#e5d1a7'));
            hull.rod(vec(.8,1.2,-.8),vec(.8,2.9,-.8),.035,.03,rgb('#e9c684'),6);
            if(e.kind==='rubbish'){object.ellipsoid(vec(),vec(.45,.32,.6),rgb('#d9b16b'),8,5);object.box(vec(.3,.2,0),vec(.15,.42,.15),rgb('#eee1b9'));}
            else {for(let i=-2;i<=2;i++){object.rod(vec(i*.38,-.8,-.1),vec(i*.38,.8,.1),.014,.014,rgb('#e3c88e'),5);object.rod(vec(-.8,i*.38,-.1),vec(.8,i*.38,.1),.014,.014,rgb('#e3c88e'),5);}}
            line.rod(vec(0,site.surface-e.p.y-.25,0),vec(),.018,.018,rgb('#dfb86d'),6);
            const meshes={boat:this.mesh('overhead-boat',hull,1),object:this.mesh('overhead-debris',object,1),line:this.mesh('overhead-line',line,1)};
            this.encounterMeshes=meshes;this.staticMeshes.push(meshes.boat,meshes.object,meshes.line);for(const m of Object.values(meshes))m.setEnabled(false);
        }
        const habitat=new Geometry();
        const arrangements: Record<string,number[][]>={gardens:[[-8,-19],[-22,12],[24,12]],passage:[[-29,-7],[-24,22],[17,38]],mangrove:[[-11,-21],[11,-12],[-18,14]],cenote:[[-17,-2],[18,14],[-16,31]],harbour:[[-16,-18],[19,3],[-21,28]]};
        for(const [i,point] of arrangements[site.id].entries()){
            const [x,z]=point,y=sandHeight(x,z,site);habitat.merge(sponge(i),vec(x,y,z),vec(1.3,1.3,1.3));
            habitat.merge(seaStar(),vec(x+1.7,sandHeight(x+1.7,z+1,site)+.03,z+1),vec(.8,.8,.8),i*1.8);
            habitat.merge(lobster(),vec(x-.8,sandHeight(x-.8,z-.8,site)+.04,z-.8),vec(.9,.9,.9),i);
            if(i===1)habitat.merge(habitatChair(),vec(x+2.5,sandHeight(x+2.5,z+1.5,site)-.04,z+1.5),vec(1,1,1),.55);
        }
        this.staticMeshes.push(this.mesh('authored-habitat-life',habitat,1));
        const coast = new Geometry();
        for (let i = 0; i < 12; i++) {
            const angle = i / 12 * Math.PI * 2 + .12 + Math.sin(i * 2.7) * .07;
            const radius = 260 + (i % 3) * 22;
            coast.merge(islandGeometry(site.seed + i * 173,Math.max(45,(site.surface+12)/.8)), vec(Math.cos(angle) * radius, site.surface, Math.sin(angle) * radius), vec(.8 + i % 3 * .15, .8 + i % 4 * .08, 1), angle + .4);
        }
        this.staticMeshes.push(this.mesh('lantern-bay-coastline', coast, 9));
        this.environmentCounts.coastlinePieces = 12;
        const wreck = wreckAnchor(site), wreckMesh = this.mesh('lantern-shipwreck-ribs', shipwreckGeometry(), 1);
        wreckMesh.position.set(wreck.x, wreck.y + 1.05, wreck.z);
        this.staticMeshes.push(wreckMesh);
        this.environmentCounts.shipwrecks = 1;
        const pipe = pipeAnchor(site), pipeMesh = this.mesh('old-rusted-outfall', sewagePipeGeometry(), 1);
        pipeMesh.position.set(pipe.x, pipe.y + 1.25, pipe.z);
        this.staticMeshes.push(pipeMesh);
        this.environmentCounts.pipeMouths = 1;
        for (const f of run.fish) {
            const m = this.mesh(f.id, fishGeometry('lionfish'), 2);
            this.fishMeshes.set(f.id, m);
        }
        for (const a of run.animals) {
            const m = this.mesh(a.id, fishGeometry(a.id), 2);
            this.animalMeshes.set(a.id, m);
        }
        for (const job of run.jobs) {
            const g = new Geometry();
            if(job.kind==='charm')g.merge(charmGeometry(job.id),vec(0,.5,0),vec(3,3,3));
            else if(job.kind==='outbreak')g.merge(seaStar(true));
            else if (job.kind === 'debris') {
                if (Number(job.id.split('-')[1]) % 2 === 0) {
                    for (let i = 0; i < 5; i++)
                        for (let j = 0; j < 5; j++) {
                            const p = vec((i - 2) * .27, .09, (j - 2) * .27);
                            if (i < 4)
                                g.rod(p, vec(p.x + .27, .12, p.z), .015, .015, rgb('#958e70'), 4);
                            if (j < 4)
                                g.rod(p, vec(p.x, .10, p.z + .27), .015, .015, rgb('#958e70'), 4);
                        }
                }
                else {
                    g.box(vec(), vec(.7, .36, .5), rgb('#c5916e'));
                    for (let i = 0; i < 3; i++)
                        g.rod(vec(-.32, .23, -.23 + i * .2), vec(.32, .23, -.23 + i * .2), .024, .024, rgb('#5a7970'));
                }
            }
            else if (job.kind === 'coral') {
                g.ellipsoid(vec(), vec(.55, .08, .48), rgb('#abc5b6'), 14, 5);
                if (job.done) {
                    const growth = .25 + job.stage * .14;
                    g.merge(templates[0], vec(), vec(growth, growth, growth));
                }
                else {
                    g.rod(vec(-.4, 0, 0), vec(-.4, .45, 0), .023, .023, rgb('#efc784'));
                    g.box(vec(-.4, .43, 0), vec(.23, .1, .035), rgb('#efc784'));
                }
            }
            else {
                g.rod(vec(), vec(0, .6, 0), .035, .035, rgb('#6ca7a1'));
                g.box(vec(0, .56, 0), vec(.5, .36, .04), rgb('#e3d9b3'));
                g.box(vec(0, .56, -.026), vec(.35, .025, .009), rgb('#397a77'));
            }
            const m = this.mesh(job.id, g, 1);
            m.position.set(job.p.x, job.p.y, job.p.z);
            m.setEnabled(!(['debris','charm','outbreak'].includes(job.kind) && job.done));
            this.jobMeshes.set(job.id, m);
        }
        const stage = recoveryForRun(run, profile.reefs[site.id]), share = recoveryPopulationShare(stage);
        // An immutable dive-start snapshot: population grows only on later visits.
        const qualityScale = this.settings.quality === 'high' ? 1 : this.settings.quality === 'low' ? .50 : .75;
        const total = Math.round((180 + share * 1400) * qualityScale);
        const schoolCenters = Array.from({ length: 8 }, (_, species) => ({
            center: (() => { const x=Math.sin(species*.85)*19,z=-22+(species*13)%55; return vec(x,Math.min(site.surface-3,Math.max(floorHeight(x,z,site)+4,4+(species%4)*2)),z); })(),
            minRadius: 4,
            radiusSpan: 11
        }));
        schoolCenters.push(
            { center: vec(wreck.x - 3.4, wreck.y + 5.3, wreck.z + 1.2), minRadius: 3.2, radiusSpan: 8.5 },
            { center: vec(pipe.x + 3.2, pipe.y + 4.4, pipe.z + .4), minRadius: 3, radiusSpan: 7.5 }
        );
        for (let species = 0; species < schoolCenters.length; species++) {
            const members = [];
            const count = Math.round(total / schoolCenters.length);
            for (let i = 0; i < count; i++) {
                const { center, minRadius, radiusSpan } = schoolCenters[species];
                const seed=random()*6.28,scale=.8+random()*.6,radius=minRadius+random()*radiusSpan;
                members.push({seed,center,scale,radius,motion:{position:vec(),heading:0,orbitCenter:prepareNativeOrbit(site,center,radius,scale)}});
            }
            const mesh = this.mesh('school-' + species, fishGeometry('native', stage < 2 ? species % 2 : species % Math.min(8,stage+3)), 2), matrices = new Float32Array(count * 16);
            mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
            mesh.alwaysSelectAsActiveMesh = true;
            this.nativeSchools.push({ mesh, matrices, members });
            this.environmentCounts.nativeFish += count;
        }
        this.environmentCounts.nativeSchools = schoolCenters.length;
        const bubbles = new Geometry();
        bubbles.ellipsoid(vec(), vec(1, 1, 1), rgb('#caeeee'), 10, 6);
        this.bubbleMesh = this.mesh('regulator-bubbles', bubbles, 8);
        this.bubbleMesh.thinInstanceSetBuffer('matrix', this.bubbleMatrices, 16, false);
        this.bubbleMesh.alwaysSelectAsActiveMesh = true;
        this.arms = new B.Mesh('diver-rig',this.scene);
        this.leftArm = this.mesh('left-forearm',forearmGeometry(-1),4);
        this.rightArm = this.mesh('right-forearm',forearmGeometry(1),4);
        this.leftSleeve = this.mesh('left-sleeve',sleeveGeometry(),4);
        this.rightSleeve = this.mesh('right-sleeve',sleeveGeometry(),4);
        for(const m of [this.leftArm,this.rightArm,this.leftSleeve,this.rightSleeve]) {m.parent=this.arms;m.renderingGroupId=1;m.alwaysSelectAsActiveMesh=true;}
        this.watch = new DiveWatch(this.scene,this.leftArm);
        this.watch.root.position.set(0,.10,-.20);
        this.watch.root.scaling.setAll(.78);
        this.spear = this.mesh('pole-spear', equipment('spear'), 4);
        this.tube = this.mesh('collection-tube', equipment('tube'), 4);
        this.scooter = this.mesh('minnow-scooter', equipment('scooter'), 4);
        const injectorGeometry=new Geometry();injectorGeometry.rod(vec(.18,-.18,.6),vec(.04,-.04,1.7),.038,.028,rgb('#a9c9c1'),10);injectorGeometry.rod(vec(.04,-.04,1.7),vec(0,0,2.3),.009,.002,rgb('#e6dfba'),6);injectorGeometry.box(vec(.18,-.18,.65),vec(.24,.045,.08),rgb('#dba26d'));
        this.injector=this.mesh('reef-treatment-injector',injectorGeometry,4);this.injector.parent=this.camera;this.injector.renderingGroupId=1;
        this.held = this.mesh('unused-legacy-held', new Geometry(), 4);
        this.charm = profile.equippedCharm ? this.mesh('equipped-keepsake',charmGeometry(profile.equippedCharm),4) : null;
        if(this.charm){this.charm.parent=this.camera;this.charm.position.set(.47,-.30,.78);this.charm.renderingGroupId=1;}
        for (const m of [this.arms, this.spear, this.tube, this.scooter, this.held]) {
            m.parent = this.camera;
            m.renderingGroupId = 1;
            m.alwaysSelectAsActiveMesh = true;
        }

        this.tube.position.set(0,0,0);
        this.held.scaling.setAll(.40);
        this.held.position.set(.02, -.02, 2.25);
        this.held.rotation.z = .5;
        this.held.rotation.y = 1.4;
        this.atmosphere='';
        this.render(0, false);
    }
    workChanged(id: string) { const j = this.run?.jobs.find(j => j.id === id), m = this.jobMeshes.get(id); if (!j || !m)
        return; if (['debris','charm','outbreak'].includes(j.kind))
        m.setEnabled(false); if (j.kind === 'coral') {
        m.dispose();
        const g = new Geometry();
        g.ellipsoid(vec(), vec(.55, .08, .48), rgb('#abc5b6'), 14, 5);
        g.merge(coral(0, 130), vec(), vec(.38, .38, .38));
        const next = this.mesh(id, g, 1);
        next.position.set(j.p.x, j.p.y, j.p.z);
        this.jobMeshes.set(id, next);
    } }
    render(time: number, playing: boolean) {
        if (!this.run)
            return;
        const r = this.run, B = BABYLON, collection=collectionMotion(r,this.engine.getRenderWidth()/this.engine.getRenderHeight());
        const p = playing ? r.p : vec(5 + Math.sin(time * .045) * 1.3, 7.2 + Math.sin(time * .12) * .15, -35);
        const yaw = playing ? r.yaw : -.16 + Math.sin(time * .05) * .08, pitch = playing ? r.pitch : .06;
        const night = !!r.night, torchLevel = this.profile ? upgradeLevel(this.profile, 'torch') : 0;
        const torchActive = playing && r.light && r.battery > 0;
        const torchIntensity = torchActive ? night ? 1.08 + torchLevel * .035 : .88 : 0;
        const torchCone = Math.max(7, 16 - Math.max(0, torchLevel - 1) * 2.2);
        const torchFalloff = Math.max(.012, .052 - Math.max(0, torchLevel - 1) * .008);
        const view = night ? 'night' : p.y > this.site.surface ? 'surface' : 'underwater';
        if (view !== this.atmosphere) {
            this.atmosphere = view;
            this.scene.clearColor = view === 'night' ? new B.Color4(.008, .025, .052, 1) : view === 'surface' ? new B.Color4(.48, .70, .76, 1) : (()=>{const c=rgb('#'+(this.site.waterColor??0x09505f).toString(16).padStart(6,'0'));return new B.Color4(c[0]*.65,c[1]*.70,c[2]*.80,1);})();
        }
        if(p.y<this.site.surface){
            const c=this.site.waterColor,base=c===undefined?[.035,.31,.39]:[((c>>16)&255)/255*.42,((c>>8)&255)/255*.60,(c&255)/255*.70],blend=clamp((p.y+2)/this.site.surface,0,1);
            const near=night?[.012,.047,.085]:base,far=night?[.035,.12,.20]:[base[0]*1.2+.09,base[1]*1.2+.09,base[2]*1.2+.06];
            this.scene.clearColor.r=Math.pow(near[0]+(far[0]-near[0])*blend,.96);this.scene.clearColor.g=Math.pow(near[1]+(far[1]-near[1])*blend,.96);this.scene.clearColor.b=Math.pow(near[2]+(far[2]-near[2])*blend,.96);
        }
        this.camera.position.set(p.x, p.y, p.z);
        this.camera.rotation.set(pitch, yaw, 0);
        const dir = direction(yaw, pitch);
        this.forwardVector.set(dir.x, dir.y, dir.z);
        this.torchVector.x=torchCone; this.torchVector.y=torchFalloff;
        for (const m of this.materials) {
            m.setFloat('uTime', time);m.setFloat('uFold',r.transfer?1:collection.approach);
            m.setFloat('uSurface', this.site.surface);
            m.setVector3('uEye', this.camera.position);
            m.setVector3('uForward', this.forwardVector);
            m.setFloat('uMotion', this.settings.reducedMotion ? 0 : 1);
            m.setFloat('uFog', this.site.biome==='cenote'?.020:this.site.biome==='harbour'?.032:this.site.id === 'passage' ? .034 : .028);
            const c=this.site.waterColor;
            if(!this.waterVector)this.waterVector=new B.Vector3();
            if(c!==undefined) this.waterVector.set(((c>>16)&255)/255*.42,((c>>8)&255)/255*.60,(c&255)/255*.70);
            else this.waterVector.set(.035,.31,.39);
            m.setVector3('uWaterColor',this.waterVector);
            m.setFloat('uNight', night ? 1 : 0);
            m.setFloat('uLight', torchIntensity);
            m.setVector2('uTorch', this.torchVector);
        }
        for (const f of r.fish) {
            const m = this.fishMeshes.get(f.id);
            const caught=heldCatches(r).find(c=>c.id===f.id), transferring=r.transfer?.catches.find(c=>c.id===f.id);
            m.setEnabled(f.alive || playing && !!(caught||transferring));
            m.scaling.setAll(f.size);
            if(caught||transferring){
                if(m.parent!==this.camera){m.parent=this.camera;m.renderingGroupId=1;m.alwaysSelectAsActiveMesh=true;m.material=this.material(12);}
                const c=caught??transferring!,index=caught?heldCatches(r).findIndex(item=>item.id===f.id):r.transfer!.catches.findIndex(item=>item.id===f.id);
                const lift=clamp((r.time-(c.struckAt??-10))/.45,0,1),ease=lift*lift*(3-2*lift);
                const origin=B.Vector3.TransformCoordinates(new B.Vector3((c.struckPosition??f.p).x,(c.struckPosition??f.p).y,(c.struckPosition??f.p).z),this.camera.getViewMatrix());
                const tip={x:heldCatches(r).length===2&&index===0?.12:.02,y:heldCatches(r).length===2&&index===0?-.11:-.02,z:heldCatches(r).length===2&&index===0?1.88:2.38}, start=caught?clamp(r.interaction,.0,1):1;
                const transfer=caught?collection.approach:1, slide=caught?collection.insert:.8;
                // Approach mouth along the spear, insert along tube axis, then empty prongs withdraw.
                const mouth=collection.mouth, z=tip.z+(mouth.z-tip.z)*transfer+slide*collection.axis.z;
                m.position.set(origin.x+(tip.x-origin.x)*ease+(mouth.x-tip.x)*transfer,origin.y+(tip.y-origin.y)*ease+(mouth.y-tip.y)*transfer+slide*collection.axis.y,z+(origin.z-tip.z)*(1-ease));
                m.rotation.set(.357*transfer,1.57*(1-transfer),.18*(1-transfer));
                if(transferring&&r.time-r.transfer!.started>.2)m.setEnabled(false);
            } else {m.parent=null;m.renderingGroupId=0;m.material=this.material(2);m.position.set(f.p.x,f.p.y,f.p.z);m.rotation.set(0,Math.sin(f.phase*.6)*.4+f.phase*.07,Math.sin(f.phase)*.04);}
        }
        for (const a of r.animals) {
            const m = this.animalMeshes.get(a.id);
            m.position.set(a.p.x, a.p.y, a.p.z);
            m.rotation.y = a.heading;
            m.rotation.z = a.id === 'turtle' ? Math.sin(time * .75) * .035 : a.state === 'warn' ? Math.sin(time * 3) * .06 : 0;
        }
        this.nativeTargets = [];
        let idx = 0;
        for (const school of this.nativeSchools) {
            let i = 0;
            for (const member of school.members) {
                const { position: p, heading } = nativeFishMotion(this.site, member.center, member.radius, member.seed, time, member.scale, member.motion);
                this.nativeScale.setAll(member.scale);
                B.Quaternion.RotationYawPitchRollToRef(heading, 0, Math.sin(time + member.seed) * .04, this.nativeRotation);
                this.nativeTranslation.set(p.x, p.y, p.z);
                B.Matrix.ComposeToRef(this.nativeScale, this.nativeRotation, this.nativeTranslation, this.nativeTransform);
                this.nativeTransform.copyToArray(school.matrices, i * 16);
                i++;
                if (distance(p, r.p) < 6 && idx++ % 2 === 0)
                    this.nativeTargets.push({ p, r: .11 * member.scale });
            }
            school.mesh.thinInstanceBufferUpdated('matrix');
        }
        this.bubblePool.update(r, this.site, playing);
        this.nativeRotation.set(0, 0, 0, 1);
        this.bubblePool.bubbles.forEach((bubble, i) => {
            const age = r.time - bubble.born, size = age >= 0 && age < 3 ? bubble.size * (1 + age * .18) : 0;
            this.nativeScale.setAll(size); this.nativeTranslation.set(bubble.p.x, bubble.p.y, bubble.p.z);
            B.Matrix.ComposeToRef(this.nativeScale, this.nativeRotation, this.nativeTranslation, this.nativeTransform);
            this.nativeTransform.copyToArray(this.bubbleMatrices, i * 16);
        });
        this.bubbleMesh.thinInstanceBufferUpdated('matrix');
        const visible = playing;
        for (const m of [this.arms, this.tube])
            m.setEnabled(visible);
        const treating=r.jobs.some(j=>j.kind==='outbreak'&&!j.done&&(j.id===r.interactionId||j.stage>0&&distance(j.p,r.p)<4));this.injector.setEnabled(visible&&treating);
        this.spear.setEnabled(visible && !treating && !r.scooter && !this.watchRequested && this.watchBlend<.1);
        this.scooter.setEnabled(visible && r.scooter);
        this.held.setEnabled(false);
        if(this.charm){this.charm.setEnabled(visible&&!r.scooter);this.charm.rotation.z=this.settings.reducedMotion?0:Math.sin(time*1.7)*.10+clamp(r.velocity.x,-2,2)*.045;}
        const homeBoat=this.staticMeshes.find(m=>m.name==='home-dive-skiff-blender');if(homeBoat){homeBoat.position.y=this.site.surface+.2+Math.sin(time*.5)*.06;homeBoat.rotation.x=Math.sin(time*.42)*.015;}
        let stow = 0;
        for (const rock of this.site.rocks) {
            if (rock.hidden) continue;
            const dx = (r.p.x - rock.p.x) / rock.s.x, dy = (r.p.y - rock.p.y) / rock.s.y, dz = (r.p.z - rock.p.z) / rock.s.z;
            if (dx * dx + dy * dy + dz * dz < 1.45)
                stow = .15;
        }
        const sway = this.settings.reducedMotion ? 0 : Math.sin(time * 1.3) * .008;
        const thrust = r.strikeCooldown > .38 ? Math.sin((.75 - r.strikeCooldown) / .37 * Math.PI) * .38 : 0;
        this.spear.position.z = -r.charge * .25 + thrust - stow;
        this.spear.position.y = sway - stow;
        this.spear.rotation.x = stow * .8;
        this.tube.position.x=collection.mouth.x+.64;
        this.spear.position.x=collection.spear.x;this.spear.position.y+=collection.spear.y;this.spear.position.z+=collection.spear.z;
        const transfer=collection.approach;
        const watchTarget=this.watchRequested && !r.scooter && r.charge === 0 ? 1 : 0;
        const poseDt=Math.max(0,Math.min(.083,time-this.lastPoseTime));this.lastPoseTime=time;
        this.watchBlend=this.settings.reducedMotion?watchTarget:this.watchBlend+(watchTarget-this.watchBlend)*(1-Math.exp(-poseDt*11));
        if(Math.abs(this.watchBlend-watchTarget)<.001)this.watchBlend=watchTarget;
        const pose=diverPose(r,time,this.watchBlend,this.settings.reducedMotion,this.pose);
        pose.right.x+=collection.spear.x*.85;pose.right.y+=collection.spear.y*.8;pose.right.z=Math.max(.25,pose.right.z+collection.spear.z*.45);
        pose.left.x-=transfer*.15;
        // In portrait the raised instrument sits to the right of ascent controls.
        pose.left.x+=this.watchBlend*Math.max(0,1-this.engine.getRenderWidth()/this.engine.getRenderHeight())*.21;
        this.leftArm.position.set(pose.left.x,pose.left.y,pose.left.z);
        this.rightArm.position.set(pose.right.x,pose.right.y,pose.right.z);
        this.leftArm.rotation.set(-.08*(1-this.watchBlend),0,pose.leftRoll);
        this.rightArm.rotation.set(0,0,pose.rightRoll);
        const sleeve=(m:any,side:number,wrist:Vec)=>{
            const x=side*.66,y=-.72,z=.18,dx=wrist.x+side*.08-x,dy=wrist.y-.10-y,dz=wrist.z-.22-z;
            m.position.set(x,y,z);m.rotation.set(-Math.atan2(dy,Math.hypot(dx,dz)),Math.atan2(dx,dz),0);m.scaling.z=Math.hypot(dx,dy,dz);
        };
        sleeve(this.leftSleeve,-1,pose.left);sleeve(this.rightSleeve,1,pose.right);
        if(this.watch){this.watch.root.setEnabled(visible);this.watch.setRaised(this.watchRequested);this.watch.update(r,this.site,this.profile!,r.time,this.watchReserve);}
        this.scooter.position.y = sway;
        if (r.exposed) {
            this.held.position.z = 2.25 - r.interaction * .6;
            this.held.position.x = .02 - r.interaction * .5;
            this.held.position.y = -.02 - r.interaction * .28;
        }
        this.engine.beginFrame();
        this.engine._drawCalls?.fetchNewFrame();
        const encounter=r.encounter,encMeshes=this.encounterMeshes;
        if(encounter&&encMeshes){
            const t=r.time-encounter.start,visible=playing&&t>=0&&!['cleared','passed'].includes(encounter.phase),aboard=visible&&['warning','active'].includes(encounter.phase);
            encMeshes.boat.setEnabled(aboard);encMeshes.boat.position.set(encounter.p.x+Math.sin(Math.max(0,t)*.11)*1.5,this.site.surface+.1,encounter.p.z);
            const inWater=visible&&['active','abandoned'].includes(encounter.phase),drop=Math.max(0,Math.min(1,(t-12)/20));
            encMeshes.object.setEnabled(inWater);encMeshes.object.position.set(encounter.p.x,this.site.surface-1+(encounter.p.y-this.site.surface+1)*drop,encounter.p.z);
            encMeshes.line.setEnabled(inWater&&encounter.kind==='fishing');encMeshes.line.position.set(encounter.p.x,encounter.p.y,encounter.p.z);
        }
        this.shadows.render(r,this.site,this.settings.reducedMotion,!!torchActive,this.camera);
        for(const m of this.materials){
            m.setMatrix('uSunMatrix',this.shadows.sunMatrix);m.setMatrix('uTorchMatrix',this.shadows.torchMatrix);
            m.setFloat('uShadows',this.shadows.enabled?1:0);m.setFloat('uTorchShadows',this.shadows.enabled&&torchActive?1:0);
            m.setTexture('uSunShadow',this.shadows.sunTexture);m.setTexture('uTorchShadow',this.shadows.torchTexture);
        }
        this.scene.render();
        this.engine.endFrame();
        this.fps = this.engine.getFps();
        this.draws = this.engine._drawCalls?.current ?? 0;
        if (this.captureQueue.length) {
            const task = this.captureQueue.shift()!;
            try {
                const c = document.createElement('canvas');
                c.width = 480;
                c.height = 270;
                const ctx = c.getContext('2d')!;
                ctx.drawImage(this.canvas, 0, 0, c.width, c.height);
                task.callback(c.toDataURL('image/jpeg', .72));
            }
            catch {
                task.callback('');
            }
        }
    }
    capture(id: string, callback: (image: string) => void) { if (!this.captureQueue.some(c => c.id === id))
        this.captureQueue.push({ id, callback }); }
    homeMarker() { const p = this.site.landmarks[0].p, c = this.camera.position, dir = direction(this.camera.rotation.y, this.camera.rotation.x); const behind = dot(norm(sub(p, c)), dir) < .1; if (behind)
        return { x: 50, y: 10, behind: true }; const B = BABYLON, v = B.Vector3.Project(new B.Vector3(p.x, p.y - 1, p.z), B.Matrix.Identity(), this.scene.getTransformMatrix(), this.camera.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight())); return { x: clamp(v.x / this.engine.getRenderWidth() * 100, 7, 93), y: clamp(v.y / this.engine.getRenderHeight() * 100, 12, 78), behind: false }; }
    screenshot() { this.scene.render(); return this.canvas.toDataURL('image/png'); }
    stats() { return { engine: BABYLON.Engine.Version, fps: Math.round(this.fps), drawCalls: this.draws, meshes: this.scene.meshes.length, vertices: this.scene.getTotalVertices(), renderSize: [this.engine.getRenderWidth(), this.engine.getRenderHeight()], watch: this.watch?.stats(), watchRaised: this.watchRaised, recoveryStage: this.run && this.profile ? recoveryForRun(this.run,this.profile.reefs[this.run.site]) : 0, shadows: this.shadows.stats(), bubbles: this.bubblePool.active(this.run?.time ?? 0), bubbleEmissions: this.bubblePool.emitted, environmentCounts: { ...this.environmentCounts }, encounterMeshCount: this.encounterMeshes?3:0 }; }
}

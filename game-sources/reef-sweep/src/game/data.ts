import type { Profile, Rock, Settings, Site, SiteId, Vec, Run } from './types.js';
import { clamp, distance, rng, vec } from './math.js';

const rock = (id: string, x: number, z: number, sx: number, sy: number, sz: number, tint = 0, form: Rock['form'] = 'rock'): Rock => ({
    id, p: vec(x, sy * .4, z), s: vec(sx, sy, sz), tint, form
});
const ellipsoid = (id: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, form: Rock['form'], tint = 0): Rock => ({
    id, p: vec(x, y, z), s: vec(sx, sy, sz), tint, form
});
const rootCluster = (id: string, x: number, z: number, offsets: [number, number][], tint = 0): Rock[] => offsets.flatMap(([dx, dz], i) => [
    ellipsoid(`${id}-trunk-${i}`, x + dx, 8.8, z + dz, .48, 12.3, .48, 'root', tint),
    ellipsoid(`${id}-buttress-${i}`, x + dx, -.8, z + dz, 1.45, 2.7, 1.35, 'root', tint)
]);
const anchors = (debris: number[][], coral: number[][], surveys: number[][] = []) => ({
    debris: debris.map(([x, z]) => vec(x, 0, z)),
    coral: coral.map(([x, z]) => vec(x, 0, z)),
    surveys: surveys.map(([x, z]) => vec(x, 0, z))
});

const gardenRocks = [rock('west-ledge', -11, -25, 7, 3.8, 6), rock('east-head', 12, -22, 7, 4.6, 6, 1), rock('nursery-wall', -18, -7, 5, 6, 8), rock('arch-left', 10, 5, 4, 6, 5), rock('arch-right', 23, 5, 4, 6, 5), { id: 'arch-crown', p: vec(16.5, 9, 5), s: vec(8, 2, 4), tint: 1, form: 'rock' as const }, rock('grouper-home', -19, 15, 7, 6, 7, 1), rock('north-head', 6, 31, 8, 6, 7), rock('outer-east', 34, 23, 7, 5, 11), rock('outer-west', -38, 1, 9, 5, 12), rock('far-west', -30, 40, 10, 7, 9), rock('far-east', 33, 45, 11, 6, 9)];
const passageRocks = [rock('entry-left', -13, -32, 8, 5, 6), rock('entry-right', 14, -29, 8, 6, 6), rock('west-wall', -17, -6, 7, 10, 12), rock('east-wall', 18, -2, 7, 10, 12, 1), rock('split-west', -12, 26, 7, 9, 9), rock('split-east', 13, 26, 7, 8, 8), { id: 'passage-crown', p: vec(0, 15, 26), s: vec(15, 2.5, 5), tint: 1, form: 'rock' as const }, rock('outer-head', 34, 13, 9, 8, 12), rock('outer-west', -37, 29, 10, 7, 13), rock('north', 2, 53, 15, 8, 9)];
const mangroveRocks: Rock[] = [
    ...rootCluster('root-west-bank', -17, -24, [[-2, -4], [1, -2], [-1, 1], [2, 4]]),
    ...rootCluster('root-east-bank', 17, -21, [[-2, -4], [1, -2], [-1, 1], [2, 4]], 1),
    ...rootCluster('root-northwest-bank', -24, 1, [[-2, -3], [1, -1], [-1, 2], [2, 4]], 1),
    ...rootCluster('root-northeast-bank', 23, 4, [[-2, -3], [1, -1], [-1, 2], [2, 4]]),
    ellipsoid('sandbar-rock-west', -33, -0.2, 25, 6, 2, 9, 'rock'),
    ellipsoid('sandbar-rock-east', 34, -0.1, 23, 6, 2, 10, 'rock', 1)
];
const cenoteRocks: Rock[] = [
    ellipsoid('limestone-west-shoulder', -31, -2, -6, 7, 15, 19, 'limestone'),
    ellipsoid('limestone-east-shoulder', 31, -1, -2, 7, 16, 20, 'limestone', 1),
    ellipsoid('limestone-south-pillar', -19, 2, 24, 5, 17, 10, 'limestone', 1),
    ellipsoid('limestone-east-pillar', 20, 1, 29, 5, 16, 9, 'limestone'),
    ellipsoid('limestone-west-alcove', -24, -3, 39, 8, 13, 8, 'limestone'),
    ellipsoid('limestone-east-alcove', 28, -2, 42, 8, 13, 8, 'limestone', 1),
    ellipsoid('limestone-rim-west', -43, 3, -35, 6, 12, 12, 'limestone'),
    ellipsoid('limestone-rim-east', 43, 3, -35, 6, 12, 12, 'limestone', 1)
];
const harbourRocks: Rock[] = [
    ellipsoid('pier-piling-west-0', -18, 7.5, -35, .7, 15.5, .7, 'piling'),
    ellipsoid('pier-piling-west-1', -10, 7.5, -35, .7, 15.5, .7, 'piling', 1),
    ellipsoid('pier-piling-east-0', 10, 7.5, -35, .7, 15.5, .7, 'piling', 1),
    ellipsoid('pier-piling-east-1', 18, 7.5, -35, .7, 15.5, .7, 'piling'),
    ellipsoid('container-blue', 27, -4.8, -17, 7, 5.2, 4.2, 'container', 1),
    ellipsoid('container-rust', 28, -4.5, -6, 7, 5.5, 4.2, 'container'),
    ellipsoid('container-low-west', -30, -6, 17, 7, 4.2, 4.5, 'container', 1),
    ellipsoid('harbour-reef-west', -42, -5, -2, 8, 6, 13, 'rock'),
    ellipsoid('harbour-reef-east', 44, -4, 22, 8, 7, 12, 'rock', 1)
];

export const SITES: Record<SiteId, Site> = {
    gardens: {
        id: 'gardens', name: 'Sunlit Gardens', eyebrow: 'LANTERN BAY / SITE 01', description: 'Warm shallows, a coral nursery and a familiar face beneath the ledges.',
        surface: 18, radius: 68, seed: 120726, entry: vec(0, 8, -41), current: .18, channelX: 18, rocks: gardenRocks,
        landmarks: [{ name: 'Home buoy', p: vec(0, 17, -44), kind: 'boat' }, { name: 'The nursery', p: vec(-9, 2, -7), kind: 'coral' }, { name: 'Marlow’s ledge', p: vec(-19, 6, 15), kind: 'wildlife' }, { name: 'Sun arch', p: vec(16, 7, 5), kind: 'landmark' }],
        worksites: anchors([[-4, -31], [6, -11], [-8, 7], [24, 20], [-25, 29]], [[-7, -8], [-5, -6], [-9, -5]], [[-7, -10]]),
        deepFeatures: { wreck: vec(34, 0, -40), outfall: vec(43, 0, -29) }
    },
    passage: {
        id: 'passage', name: 'Tideglass Passage', eyebrow: 'LANTERN BAY / SITE 02', description: 'Tall reef walls and a flowing channel. Find shelter before you commit.',
        surface: 25, radius: 74, seed: 741309, entry: vec(0, 12, -44), current: .42, channelX: 0, rocks: passageRocks,
        landmarks: [{ name: 'Home buoy', p: vec(0, 24, -47), kind: 'boat' }, { name: 'Restoration shelf', p: vec(-4, 2, -4), kind: 'coral' }, { name: 'The throat', p: vec(0, 10, 10), kind: 'current' }, { name: 'Cathedral arch', p: vec(0, 12, 26), kind: 'landmark' }],
        worksites: anchors([[-4, -29], [5, -12], [-3, 7], [8, 40]], [[-4, -3], [-2, -1], [-6, 0]], [[-3, -5]]),
        deepFeatures: { wreck: vec(34, 0, -40), outfall: vec(46, 0, -29) }
    },
    mangrove: {
        id: 'mangrove', name: 'Mangrove Reach', label: 'Mangrove Reach', eyebrow: 'LANTERN BAY / SITE 03', biome: 'mangrove',
        shortDescription: 'Shallow root channels wind between the mangroves and a bright sandbar.',
        description: 'Follow the shallow root channels across a pale sandbar, then look for the quiet offshore drop.',
        waterColor: 0x3c9d8d, sandColor: 0xd6c58f, surface: 21, radius: 78, seed: 368_104, entry: vec(0, 8, -48), current: .24, channelX: -8, rocks: mangroveRocks,
        landmarks: [{ name: 'Home buoy', p: vec(0, 20, -51), kind: 'boat' }, { name: 'Root channel', p: vec(-17, 17, -24), kind: 'channel' }, { name: 'Open sandbar', p: vec(1, 1, 35), kind: 'sandbar' }, { name: 'Offshore drop', p: vec(36, -16, -39), kind: 'dropoff' }],
        worksites: anchors([[2, -32], [15, -10], [-15, 7], [26, 18], [-27, 34]], [[-7, -5], [-3, -2], [2, -5]], [[-4, -8]]),
        deepFeatures: { wreck: vec(36, 0, -40), outfall: vec(48, 0, -32) }
    },
    cenote: {
        id: 'cenote', name: 'Azure Cenote', label: 'Azure Cenote', eyebrow: 'LANTERN BAY / SITE 04', biome: 'cenote',
        shortDescription: 'Open-roof limestone chambers with clear, vertical routes to the light.',
        description: 'Explore deep limestone chambers open to the sky. Every basin has a direct, calm ascent route.',
        waterColor: 0x287fbd, sandColor: 0xd9d0b8, surface: 40, radius: 78, seed: 512_927, entry: vec(0, 17, -51), current: .12, channelX: 0, rocks: cenoteRocks,
        landmarks: [{ name: 'Home buoy', p: vec(0, 39, -54), kind: 'boat' }, { name: 'Sun window', p: vec(0, 2, -3), kind: 'surface' }, { name: 'Limestone gallery', p: vec(-22, -2, 16), kind: 'chamber' }, { name: 'Deep blue basin', p: vec(0, -18, 31), kind: 'basin' }],
        worksites: anchors([[-12, -35], [12, -30], [-19, 2], [18, 17], [1, 43]], [[-8, -8], [8, -7], [0, 11]], [[-8, -11]]),
        deepFeatures: { wreck: vec(36, 0, -44), outfall: vec(49, 0, -36) }
    },
    harbour: {
        id: 'harbour', name: 'Rusted Harbour', label: 'Rusted Harbour', eyebrow: 'LANTERN BAY / SITE 05', biome: 'harbour',
        shortDescription: 'Wreck ribs, old pier pilings and abandoned containers shelter the harbour reef.',
        description: 'Work around a grounded wreck, timber pilings and rusting cargo containers. Leave a clear route to the surface.',
        waterColor: 0x3f7890, sandColor: 0x9b8d78, surface: 23, radius: 80, seed: 882_461, entry: vec(0, 9, -50), current: .28, channelX: 15, rocks: harbourRocks,
        landmarks: [{ name: 'Home buoy', p: vec(0, 22, -53), kind: 'boat' }, { name: 'Outer wreck', p: vec(-31, -6, 39), kind: 'wreck' }, { name: 'Old pier', p: vec(-10, 23, -35), kind: 'pier' }, { name: 'Cargo stack', p: vec(28, -2, -12), kind: 'container' }],
        worksites: anchors([[-15, -26], [10, -22], [-22, 3], [20, 17], [0, 40]], [[-10, -6], [-6, -2], [-12, 2]], [[-8, -10]]),
        deepFeatures: { wreck: vec(-34, 0, 39), outfall: vec(36, 0, -43) }
    }
};

const foundationRocks = [...gardenRocks, ...passageRocks];
// Preserve the complete old terrain/mooring for already-suspended Passage outings.
const LEGACY_PASSAGE: Site = structuredClone(SITES.passage);
Object.assign(SITES.passage, {
    description: 'Follow the sheltered western shelf, cross the tide race and read the flow beneath Cathedral arch.',
    shortDescription: 'A sheltered shelf, a deep tide race and two flow gauges.',
    entry: vec(-28, 14, -42),
    landmarks: [
        { name: 'Western mooring', p: vec(-28, 24, -46), kind: 'boat' },
        { name: 'Lee shelf nursery', p: vec(-28, 3, 10), kind: 'coral' },
        { name: 'Tide race', p: vec(0, 8, 8), kind: 'current' },
        { name: 'Cathedral flow gauge', p: vec(0, 8, 34), kind: 'landmark' }
    ],
    rocks: [...SITES.passage.rocks, rock('lee-breakwater', -36, -10, 5, 9, 14), rock('cathedral-east-rib', 26, 32, 4, 13, 10, 1)],
    worksites: anchors([[-24,-27],[-27,-5],[-23,15],[18,34]], [[-28,8],[-29,10],[-26,12]], [[-25,14]])
});
export function siteForRun(run: Pick<Run,'site'|'siteRevision'>): Site { return run.site === 'passage' && run.siteRevision !== 2 ? LEGACY_PASSAGE : SITES[run.site]; }
export function siteTerrainKey(site?:Site|SiteId){const resolved=typeof site==='string'?SITES[site]:site;return !resolved?'legacy':resolved===LEGACY_PASSAGE?'passage:1':resolved.id+':2';}
function oldFloorHeight(x: number, z: number) {
    const shelf = -.7 + Math.sin(x * .067) * .7 + Math.sin(z * .09 + x * .028) * .55 + Math.cos((z - x) * .036) * .4;
    let foundation = 0;
    for (const r of foundationRocks) {
        const outside = Math.max(0, Math.hypot((x - r.p.x) / r.s.x, (z - r.p.z) / r.s.z) - 1);
        if (outside === 0) { foundation = 1; break; }
        if (outside < 2) foundation = Math.max(foundation, Math.exp(-outside * outside * 4));
    }
    const trench = 30 * Math.exp(-(((x - 38) / 19) ** 2) - (((z + 38) / 24) ** 2));
    return shelf - trench * (1 - foundation);
}
function terrainSite(site?: Site | SiteId): Site | undefined { return typeof site === 'string' ? SITES[site] : site; }
/** Omitted/legacy site terrain exactly preserves Sunlit Gardens and Passage's shared seabed. */
export function floorHeight(x: number, z: number, siteArg?: Site | SiteId) {
    const site = terrainSite(siteArg);
    if (!site || site.id === 'gardens' || site === LEGACY_PASSAGE) return oldFloorHeight(x, z);
    if(site.id==='passage') return oldFloorHeight(x,z)-7*Math.exp(-(((x-1)/9)**2)-((z-10)/65)**4)+1.5*Math.exp(-(((x+28)/12)**2)-((z-6)/42)**4);
    const ripple = Math.sin(x * .071) * .34 + Math.sin(z * .064 + x * .03) * .28 + Math.cos((z - x) * .038) * .22;
    if (site.id === 'mangrove') {
        const channelWest = Math.exp(-Math.pow((x + 13) / 5.8, 2));
        const channelEast = Math.exp(-Math.pow((x - 12) / 6.6, 2));
        const sandbar = 2.15 * Math.exp(-Math.pow((z - 35) / 11, 2)) * Math.exp(-Math.pow(x / 34, 2));
        const offshoreDrop = 24 * Math.exp(-(((x - 38) / 17) ** 2) - (((z + 40) / 20) ** 2));
        return -2.5 + ripple - 1.4 * Math.max(channelWest, channelEast) + sandbar - offshoreDrop;
    }
    if (site.id === 'cenote') {
        const basin = Math.exp(-((x / 32) ** 4) - (((z - 7) / 37) ** 4));
        const ledge = .9 * Math.exp(-(((x + 31) / 13) ** 2) - (((z - 7) / 27) ** 2));
        const deepPocket = 5 * Math.exp(-((x / 15) ** 2) - (((z - 29) / 18) ** 2));
        return -8.5 + ripple + ledge - 17 * basin - deepPocket;
    }
    const quayShelf = 2 * Math.exp(-(((z + 35) / 12) ** 2)) * Math.exp(-((x / 30) ** 4));
    const siltDrop = 18 * Math.exp(-(((x + 35) / 18) ** 2) - (((z - 40) / 22) ** 2));
    const dockChannel = 18 * Math.exp(-(((x - 36) / 18) ** 2) - (((z + 43) / 22) ** 2));
    return -10 + ripple + quayShelf - siltDrop - dockChannel;
}

// New biome structures must meet their own deeper seabed. Retain tree/cliff
// tops; cargo boxes use an inscribed body whose bottom is 0.56 of its envelope.
for (const site of [SITES.mangrove,SITES.cenote,SITES.harbour]) for(const r of site.rocks){
    const bed=floorHeight(r.p.x,r.p.z,site)-.25;
    if(r.form==='container')r.p.y=bed+r.s.y*.56;
    else if(r.p.y-r.s.y>bed){const top=r.p.y+r.s.y;r.p.y=(top+bed)/2;r.s.y=(top-bed)/2;}
}

export function currentAt(p: Vec, site: Site, time: number): Vec {
    const channel = Math.exp(-Math.pow((p.x - (site.channelX ?? (site.id === 'gardens' ? 18 : 0))) / 12, 2));
    const strength = site.current * (.45 + channel * 1.8) * (1 + .12 * Math.sin(time * .023));
    return vec(.16 * strength, 0, strength);
}
export function freePoint(p: Vec, site: Site, padding = .8) {
    if (p.y - padding < floorHeight(p.x, p.z, site)) return false;
    return site.rocks.every(r => Math.pow((p.x - r.p.x) / (r.s.x + padding), 2) + Math.pow((p.y - r.p.y) / (r.s.y + padding), 2) + Math.pow((p.z - r.p.z) / (r.s.z + padding), 2) > 1);
}
export function groundPoint(x: number, z: number, lift = 1, site?: Site | SiteId) { return vec(x, floorHeight(x, z, site) + lift, z); }

export const DEFAULT_KEYS: Settings['keys'] = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', up: 'Space', down: 'ControlLeft', boost: 'ShiftLeft', steady: 'KeyF', interact: 'KeyE', spear: 'Mouse0', scooter: 'KeyQ', pause: 'Escape', journal: 'KeyJ', light: 'KeyL', watch: 'KeyV' };
export const DEFAULT_SETTINGS: Settings = { quality: 'balanced', music: .42, ambience: .6, effects: .7, sensitivity: 1, invertY: false, reducedMotion: false, assist: true, toggleDraw: false, fov: 78, touchScale: 1, instrumentHud: true, keys: { ...DEFAULT_KEYS } };
export const UPGRADES: { id: string; name: string; cost: number; tag: string; description: string; requires: string; requiredLevel?: number }[] = [
    { id: 'fins', name: 'Reefglide fins', cost: 95, tag: 'MOVE', description: 'Each level adds 12% of base fin speed, up to 60% at level 5.', requires: '' },
    { id: 'tube', name: 'Wide-mouth collection tube', cost: 120, tag: 'CAPACITY', description: 'Carry 12 fish at level 1, then 2 more per level, up to 20. Secured catches cannot be stolen.', requires: '' },
    { id: 'spear', name: 'Balanced pole spear', cost: 145, tag: 'HANDLING', description: 'Each level improves draw speed and adds 0.45 m of reach. Precision, not extra damage.', requires: '' },
    { id: 'scooter', name: 'Minnow underwater scooter', cost: 420, tag: 'EXPLORATION', description: 'Switch between your spear and a battery-powered scooter. Each level adds cruising speed.', requires: '' },
    { id: 'air', name: 'Efficient regulator service', cost: 190, tag: 'AIR', description: 'Each level cuts air use by 9% of base. Levels 2–5 also add 30 tank capacity each.', requires: '' },
    { id: 'camera', name: 'Wide-angle camera housing', cost: 155, tag: 'STORIES', description: 'Each level adds 8 highlight quality. All discoveries remain available without it.', requires: '' },
    { id: 'kit', name: 'Coral field kit', cost: 110, tag: 'RESTORATION', description: 'Each level adds 2 nursery fragments and speeds up planting.', requires: '' },
    { id: 'battery', name: 'Long-range scooter battery', cost: 220, tag: 'RANGE', description: 'Each level extends scooter and head-torch endurance.', requires: 'scooter' },
    { id: 'torch', name: 'Dive head torch', cost: 320, tag: 'NIGHT DIVES', description: 'Unlock moonlit dives. Further levels improve the beam, reach and battery efficiency.', requires: 'air', requiredLevel: 2 }
];
export const MAX_UPGRADE_LEVEL = 5;
export function upgradeLevel(p: Profile, id: string) { return p.upgradeLevels?.[id] ?? (p.upgrades.includes(id) ? 1 : 0); }
export function upgradeCost(p: Profile, id: string) { const u = UPGRADES.find(u => u.id === id), level = upgradeLevel(p, id); return !u || level >= MAX_UPGRADE_LEVEL ? 0 : Math.round(u.cost * [1, .2, .25, .3, .4][level] / 5) * 5; }
/** Service replaces parts of owned gear; advanced work opens as field experience grows. */
export function upgradeServiceRequirement(p:Profile,id:string){
    const next=upgradeLevel(p,id)+1,day=next===1&&id==='scooter'?3:next===1&&id==='torch'?4:[0,1,1,5,8,11][next]??1,rep=next===1&&id==='scooter'?4:next===1&&id==='torch'?6:[0,0,0,12,20,28][next]??0;
    const available=p.day>=day&&p.reputation>=rep;
    return {available,reason:available?'':`Level ${next} service opens on day ${day} with ${rep} conservation reputation.`};
}
export function capacity(p: Profile) { const level = upgradeLevel(p, 'tube'); return level ? 10 + level * 2 : 8; }
export function airCapacity(p: Profile) { return 200 + Math.max(0, upgradeLevel(p, 'air') - 1) * 30; }
export function spearReach(p: Profile) { return 3 + upgradeLevel(p, 'spear') * .45; }
export function wreckAnchor(site: Site): Vec {
    const feature = site.deepFeatures?.wreck;
    if (feature) return vec(feature.x, floorHeight(feature.x, feature.z, site), feature.z);
    return vec(34, floorHeight(34, -40), -40);
}
export function pipeAnchor(site: Site): Vec {
    const feature = site.deepFeatures?.outfall;
    if (feature) return vec(feature.x, floorHeight(feature.x, feature.z, site), feature.z);
    const x = site.id === 'gardens' ? 43 : 46;
    return vec(x, floorHeight(x, -29), -29);
}
for (const site of Object.values(SITES)) {
    const w = wreckAnchor(site), p = pipeAnchor(site);
    for (const side of [-1, 1]) site.rocks.push({ id: 'wreck-rail-' + side, p: vec(w.x + side * 2.6, w.y + 1, w.z), s: vec(.5, 1, 7.5), tint: 0, hidden: true, form: 'container' });
    site.rocks.push({ id: 'wreck-bow', p: vec(w.x, w.y + .8, w.z + 7.6), s: vec(2.6, .8, .5), tint: 0, hidden: true, form: 'container' });
    for (const side of [-1, 1]) site.rocks.push({ id: 'pipe-wall-' + side, p: vec(p.x + side * 1.05, p.y + 1.2, p.z), s: vec(.25, 1.2, 5), tint: 0, hidden: true, form: 'container' });
    site.rocks.push({ id: 'pipe-top', p: vec(p.x, p.y + 2.3, p.z), s: vec(1.1, .2, 5), tint: 0, hidden: true, form: 'container' });
    site.rocks.push({ id: 'pipe-back', p: vec(p.x, p.y + 1.2, p.z - 4.95), s: vec(1.2, 1.2, .2), tint: 0, hidden: true, form: 'container' });
    site.landmarks.push({ name: 'Lantern wreck · deep field station', p: vec(w.x, w.y + 2, w.z), kind: 'landmark' }, { name: 'Old outfall · deep field station', p: vec(p.x, p.y + 3, p.z - 6), kind: 'landmark' });
}
export function healthOfReef(p: Profile, id: SiteId) { const r = p.reefs[id]; return Math.round(clamp(24 + r.removed.length * 1.25 + r.cleaned.length * 3 + Object.keys(r.restored).length * 5 + r.surveys * 2, 24, 98)); }
const SITE_UNLOCKS: Record<SiteId, { removals: number; reputation: number }> = {
    gardens: { removals: 0, reputation: 0 }, passage: { removals: 6, reputation: 5 }, mangrove: { removals: 12, reputation: 8 }, cenote: { removals: 26, reputation: 17 }, harbour: { removals: 42, reputation: 27 }
};
export function siteUnlocked(p: Profile, id: SiteId) { const need = SITE_UNLOCKS[id]; return id === 'gardens' || p.totalRemoved >= need.removals || p.reputation >= need.reputation; }
export function siteUnlockText(p: Profile, id: SiteId) {
    if (id === 'gardens') return 'Starting site · always available';
    if (siteUnlocked(p, id)) return 'Available · ready for your next dive';
    const need = SITE_UNLOCKS[id];
    return 'Unlock at ' + need.removals + ' lionfish removed or ' + need.reputation + ' reputation';
}

const FISH_STARTERS: Record<SiteId, [number, number][]> = {
    gardens: [[3, -31], [-4, -23], [7, -15], [-8, -2], [6, 12]],
    passage: [[-27,-29],[-29,-14],[-22,8],[0,20],[24,40]],
    mangrove: [[3, -34], [-6, -26], [8, -16], [-4, 4], [7, 27]],
    cenote: [[4, -40], [-7, -26], [10, -13], [-8, 12], [5, 37]],
    harbour: [[3, -43], [-6, -27], [5, -15], [-7, 11], [4, 33]]
};
export function reefFishHomes(site: Site, seed: number) {
    const random = rng(seed), points: Vec[] = [];
    for (const [x, z] of FISH_STARTERS[site.id]) {
        const p = groundPoint(x, z, 2.2, site);
        if (freePoint(p, site, .4) && points.every(q => distance(p, q) > 5)) points.push(p);
    }
    for (let i = 0; i < 360 && points.length < 24; i++) {
        const x = (random() - .5) * site.radius * 1.35, z = -33 + random() * 88;
        if (Math.hypot(x, z) > site.radius - 3) continue;
        const p = groundPoint(x, z, 1.8 + random() * 3, site);
        if (freePoint(p, site, 1) && points.every(q => distance(p, q) > 5)) points.push(p);
    }
    return points;
}

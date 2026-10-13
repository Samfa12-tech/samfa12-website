import type { Profile, Settings, ReefProgress } from './types.js';
import { DEFAULT_SETTINGS, UPGRADES, MAX_UPGRADE_LEVEL, upgradeLevel, upgradeCost, upgradeServiceRequirement, airCapacity, capacity } from './data.js';
import { clamp } from './math.js';
import { recoveryForRun } from './reef-recovery.js';
import { normalizeCampaign, validateCampaign } from './campaign.js';
export const SAVE_PREFIX = 'reef-sweep:v1:';
const REEF_IDS = ['gardens', 'passage', 'mangrove', 'cenote', 'harbour'] as const;
const emptyReef = (): ReefProgress => ({ removed: [], cleaned: [], restored: {}, visits: 0, productiveVisits: 0, surveys: 0, lastDay: 0 });
export function freshProfile(slot = 1): Profile { return { version: 1, slot, day: 1, cash: 80, debt: 0, reputation: 0, audience: 12, totalRemoved: 0, totalCleaned: 0, totalRestored: 0, upgrades: [], reefs: { gardens: emptyReef(), passage: emptyReef(), mangrove: emptyReef(), cenote: emptyReef(), harbour: emptyReef() }, records: [], published: [], discoveries: [], tutorial: 0, sponsorPaidDay: 0, lastReport: 'Your boat. Your first reef. A little room to make a difference.', active: null, pending: null }; }
const numeric = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const strings = (v: unknown, n = 3000) => Array.isArray(v) && v.length <= n && v.every(s => typeof s === 'string' && s.length < 140);
/** Import is intentionally strict. Invalid data is never allowed to replace a good slot. */
export function validateProfile(v: unknown): Profile {
    const source = v as Profile;
    const p = source && typeof source === 'object' ? structuredClone(source) as Profile : source;
    if (!p || p.version !== 1)
        throw Error('This is not a supported Reef Sweep save (schema 1).');
    if (!p.reefs || typeof p.reefs !== 'object' || Array.isArray(p.reefs))
        throw Error('Invalid reef progress.');
    const keys = Object.keys(p.reefs);
    const legacyTwoSiteSave = keys.length === 2 && keys.includes('gardens') && keys.includes('passage');
    if (legacyTwoSiteSave) {
        p.reefs = { ...p.reefs, mangrove: emptyReef(), cenote: emptyReef(), harbour: emptyReef() };
    }
    else if (keys.length !== REEF_IDS.length || REEF_IDS.some(id => !keys.includes(id)) || keys.some(id => !(REEF_IDS as readonly string[]).includes(id)))
        throw Error('Invalid reef-site inventory.');
    for (const k of ['day', 'cash', 'debt', 'reputation', 'audience', 'totalRemoved', 'totalCleaned', 'totalRestored'] as const)
        if (!numeric(p[k], 0, 1e8))
            throw Error('Invalid save field: ' + k);
    if (!numeric(p.day, 1, 1e6) || !numeric(p.slot, 1, 3))
        throw Error('Invalid save slot or day.');
    if (!strings(p.upgrades, 30) || !p.upgrades.every(id => UPGRADES.some(u => u.id === id)))
        throw Error('Unrecognised equipment in save.');
    if (new Set(p.upgrades).size !== p.upgrades.length) throw Error('Duplicate equipment in save.');
    if (p.upgradeLevels !== undefined && (!p.upgradeLevels || typeof p.upgradeLevels !== 'object' || Array.isArray(p.upgradeLevels) || !Object.entries(p.upgradeLevels).every(([id,rank]) => p.upgrades.includes(id) && Number.isInteger(rank) && rank>=1 && rank<=MAX_UPGRADE_LEVEL)))
        throw Error('Invalid equipment levels.');
    if (!strings(p.published, 3000) || !strings(p.discoveries, 200))
        throw Error('Invalid journal.');
    if (!Array.isArray(p.records) || p.records.length > 80 || !p.records.every(r => numeric(r.score, 0, 1e8) && (REEF_IDS as readonly string[]).includes(r.site) && numeric(r.day, 1, 1e6)))
        throw Error('Invalid event history.');
    for (const id of REEF_IDS) {
        const r = p.reefs?.[id];
        if (!r || !strings(r.removed) || !strings(r.cleaned) || !r.restored || typeof r.restored !== 'object' || Array.isArray(r.restored) || Object.entries(r.restored).length > 100 || !Object.entries(r.restored).every(([k, n]) => /^coral-\d+$/.test(k) && numeric(n, 1, 1e6)))
            throw Error('Invalid reef progress.');
        if (!numeric(r.visits, 0, 1e6) || !numeric(r.surveys, 0, 1e6))
            throw Error('Invalid reef counters.');
        if (r.surveyedStations !== undefined && (!strings(r.surveyedStations, 16) || !r.surveyedStations.every(id => /^survey-\d+$/.test(id)) || new Set(r.surveyedStations).size !== r.surveyedStations.length))
            throw Error('Invalid surveyed-station history.');
        if (r.productiveVisits !== undefined && (!numeric(r.productiveVisits, 0, 1e6) || !Number.isInteger(r.productiveVisits)))
            throw Error('Invalid productive-visit counter.');
    }
    for (const r of [p.active, p.pending])
        if (r) {
            if (!(REEF_IDS as readonly string[]).includes(r.site) || !numeric(r.seed, 0, 0xffffffff) || typeof r.id !== 'string' || !numeric(r.time, 0, 10000) || !numeric(r.air, 0, airCapacity(p)) || !numeric(r.health, 0, 100) || !numeric(r.battery, 0, 100) || !numeric(r.yaw, -1e9, 1e9) || !numeric(r.pitch, -2, 2))
                throw Error('Invalid suspended dive.');
            if (r.recoveryStage !== undefined && (!Number.isInteger(r.recoveryStage) || r.recoveryStage < 0 || r.recoveryStage > 5))
                throw Error('Invalid reef recovery snapshot.');
            if (r.siteRevision !== undefined && r.siteRevision !== 1 && r.siteRevision !== 2)
                throw Error('Invalid site revision.');
            if (r.night !== undefined && typeof r.night !== 'boolean' || r.night && upgradeLevel(p,'torch')<1) throw Error('Invalid night dive.');
            if (r.filletQuality !== undefined && (!numeric(r.filletQuality,0,1) || !r.finished || r.rescued || !r.cargo.length)) throw Error('Invalid fillet preparation.');
            for (const v of [r.p, r.velocity])
                if (!v || !['x', 'y', 'z'].every(k => numeric((v as any)[k], -10000, 10000)))
                    throw Error('Invalid diver position.');
            if (!Array.isArray(r.fish) || r.fish.length > 40 || !Array.isArray(r.jobs) || r.jobs.length > 32 || !Array.isArray(r.animals) || r.animals.length > 8 || !Array.isArray(r.cargo) || r.cargo.length > 20 || !Array.isArray(r.clips) || r.clips.length > 8)
                throw Error('Invalid dive contents.');
            for (const f of r.fish) {
                if (!f.p || !f.home || typeof f.id !== 'string' || !numeric(f.weight, .01, 10) || !numeric(f.size, .1, 3) || !numeric(f.phase, -1e9, 1e9) || !numeric(f.flee, 0, 100) || typeof f.alive !== 'boolean' || ![f.p, f.home].every(v => ['x', 'y', 'z'].every(k => numeric((v as any)[k], -1000, 1000))))
                    throw Error('Invalid fish record.');
            }
            for (const c of r.clips)
                if (typeof c.title !== 'string' || c.title.length > 200 || !numeric(c.quality, 0, 100) || c.image && (!c.image.startsWith('data:image/jpeg;base64,') || c.image.length > 200000))
                    throw Error('Invalid highlight card.');
            if (r.exposed && (!numeric(r.exposed.weight, .01, 10) || !numeric(r.exposed.value, 0, 500)))
                throw Error('Invalid exposed catch.');
            for (const c of r.cargo)
                if (!numeric(c.weight, .01, 10) || !numeric(c.value, 0, 500) || typeof c.id !== 'string')
                    throw Error('Invalid catch.');
            if (!r.cooldowns || typeof r.cooldowns !== 'object')
                throw Error('Invalid timers.');
        }
    if (p.active && p.pending)
        throw Error('A save cannot contain both an active dive and a pending settlement.');
    if (typeof p.lastReport !== 'string' || p.lastReport.length > 1000 || !numeric(p.tutorial, 0, 100) || !numeric(p.sponsorPaidDay, 0, 1e6))
        throw Error('Invalid career metadata.');
    if (p.eventRegistrationDay !== undefined && (!Number.isInteger(p.eventRegistrationDay) || !numeric(p.eventRegistrationDay, 1, p.day)))
        throw Error('Invalid event registration day.');
    if (p.campaign !== undefined) p.campaign = validateCampaign(p.campaign);
    const isVec = (v: any) => v && ['x', 'y', 'z'].every(k => numeric(v[k], -10000, 10000));
    const text = (v: any, max = 200) => typeof v === 'string' && v.length <= max;
    for (const r of [p.active, p.pending])
        if (r) {
            for (const k of ['removed', 'cleaned', 'restored', 'surveyed', 'nativeHits', 'coralHits', 'stolen', 'distance', 'fragments', 'charge', 'strikeCooldown', 'hurtCooldown', 'interaction'] as const)
                if (!numeric(r[k], 0, 1e6))
                    throw Error('Invalid dive counter: ' + k);
            if (!['catch', 'cleanup', 'restore', 'research', 'none'].includes(r.order) || !['scooter', 'light', 'returnWarn', 'lowWarn', 'finished', 'rescued', 'event'].every(k => typeof (r as any)[k] === 'boolean') || !text(r.interactionId) || !strings(r.seen, 100) || !numeric(r.day, 1, 1e6))
                throw Error('Invalid dive state.');
            if (r.charge > 1 || r.interaction > 1.1 || r.fragments > 3+upgradeLevel(p,'kit')*2 || r.cargo.length > capacity(p) || r.jobs.some(j => !text(j.id) || !['debris', 'coral', 'survey'].includes(j.kind) || !isVec(j.p) || typeof j.done !== 'boolean' || !numeric(j.progress, 0, 1) || !numeric(j.stage, 0, 5)))
                throw Error('Invalid work or capacity.');
            if (r.practice !== undefined && typeof r.practice !== 'boolean' || r.contractReadyNotified !== undefined && typeof r.contractReadyNotified !== 'boolean' || r.researchEligible !== undefined && typeof r.researchEligible !== 'boolean' || r.researchFunded !== undefined && typeof r.researchFunded !== 'boolean')
                throw Error('Invalid outing options.');
            if (r.lesson !== undefined && (!r.lesson || typeof r.lesson !== 'object' || !Number.isInteger(r.lesson.step) || !numeric(r.lesson.step, 0, 12) || !numeric(r.lesson.look, 0, 1e6) || !numeric(r.lesson.move, 0, 1e6) || typeof r.lesson.drawn !== 'boolean' || r.lesson.skipped !== undefined && typeof r.lesson.skipped !== 'boolean'))
                throw Error('Invalid lesson progress.');
            if (r.eventTheme !== undefined && !['catch', 'cleanup', 'research'].includes(r.eventTheme) || r.eventRegistrationDay !== undefined && (!Number.isInteger(r.eventRegistrationDay) || !numeric(r.eventRegistrationDay, 1, r.day)))
                throw Error('Invalid event registration.');
            if (r.surveyFirstVisits !== undefined && (!strings(r.surveyFirstVisits, 3) || !r.surveyFirstVisits.every(id => /^survey-\d+$/.test(id)) || new Set(r.surveyFirstVisits).size !== r.surveyFirstVisits.length || r.surveyFirstVisits.length > r.surveyed))
                throw Error('Invalid survey payout snapshot.');
            if (r.surveyStations !== undefined && (!strings(r.surveyStations, 3) || !r.surveyStations.every(id => /^survey-\d+$/.test(id)) || new Set(r.surveyStations).size !== r.surveyStations.length || r.surveyStations.length > r.surveyed))
                throw Error('Invalid surveyed-station snapshot.');
            if (r.filletCuts !== undefined && (!Array.isArray(r.filletCuts) || r.filletCuts.length > 3 || !r.filletCuts.every(value => numeric(value, 0, 1))))
                throw Error('Invalid filleting progress.');
            if (r.encounter !== undefined && (!r.encounter || typeof r.encounter !== 'object' || !['rubbish', 'fishing'].includes(r.encounter.kind) || !['warning', 'active', 'abandoned', 'cleared', 'passed'].includes(r.encounter.phase) || !numeric(r.encounter.start, 0, 1e6) || !isVec(r.encounter.p) || !numeric(r.encounter.cleanProgress, 0, 1) || typeof r.encounter.rewarded !== 'boolean'))
                throw Error('Invalid boat encounter.');
            if (r.animals.some(a => !['marlow', 'moray', 'turtle', 'ray', 'shark'].includes(a.id) || a.id==='shark' && !r.night || !isVec(a.p) || !isVec(a.home) || !numeric(a.heading, -1e9, 1e9) || !numeric(a.phase, 0, 1e9) || !numeric(a.timer, 0, 1e6) || !numeric(a.cooldown, 0, 100) || !['roam', 'watch', 'approach', 'warn', 'lunge', 'retreat'].includes(a.state)))
                throw Error('Invalid wildlife record.');
            if (r.clips.some(c => !text(c.id) || !text(c.kind) || !text(c.detail, 600) || typeof c.chosen !== 'boolean'))
                throw Error('Invalid highlight metadata.');
            if (Array.isArray(r.cooldowns) || Object.entries(r.cooldowns).length > 100 || !Object.entries(r.cooldowns).every(([k, v]) => text(k, 60) && k !== '__proto__' && k !== 'constructor' && numeric(v, -100, 1e8)))
                throw Error('Invalid cooldown map.');
            if (new Set(r.fish.map(f => f.id)).size !== r.fish.length || new Set(r.jobs.map(j => j.id)).size !== r.jobs.length)
                throw Error('Duplicate persistent identities.');
        }
    if (p.active?.finished || p.pending && !p.pending.finished)
        throw Error('Invalid outing lifecycle.');
    for (const id of REEF_IDS) {
        const reef = p.reefs[id];
        if (reef.productiveVisits === undefined) {
            const outing = p.active?.site === id ? p.active : p.pending?.site === id ? p.pending : null;
            const currentClearances = outing ? Math.min(reef.removed.length, Math.max(0, Math.floor(outing.removed))) : 0;
            const priorClearances = reef.removed.length - currentClearances;
            reef.productiveVisits = Math.min(Math.floor(reef.visits), Math.floor(priorClearances / 2));
        }
    }
    for (const r of [p.active, p.pending])
        if (r && r.recoveryStage === undefined) r.recoveryStage = recoveryForRun(r, p.reefs[r.site]);
    p.campaign = normalizeCampaign(p);
    for (const r of [p.active, p.pending]) if (r?.order === 'research' && r.researchEligible === undefined) r.researchEligible = true;
    return p;
}
export function buy(p: Profile, id: string) { const u = UPGRADES.find(x => x.id === id),cost=upgradeCost(p,id); if (!u || p.active || p.pending || upgradeLevel(p,id)>=MAX_UPGRADE_LEVEL || p.cash < cost || !upgradeServiceRequirement(p,id).available || u.requires && upgradeLevel(p,u.requires)<(u.requiredLevel??1))
    return false; p.cash -= cost; p.upgradeLevels ??= {}; p.upgradeLevels[id]=upgradeLevel(p,id)+1; if(!p.upgrades.includes(id))p.upgrades.push(id); return true; }
export class MemoryStorage implements Storage {
    private values = new Map<string, string>();
    get length() { return this.values.size; }
    clear() { this.values.clear(); }
    getItem(k: string) { return this.values.get(k) ?? null; }
    key(i: number) { return [...this.values.keys()][i] ?? null; }
    removeItem(k: string) { this.values.delete(k); }
    setItem(k: string, v: string) { this.values.set(k, String(v)); }
}
export class SaveStore {
    warning = '';
    private storage: Storage;
    private volatile = false;
    constructor(storage?: Storage) { try {
        this.storage = storage || localStorage;
    }
    catch {
        this.storage = new MemoryStorage();
        this.volatile = true;
        this.warning = 'Persistent storage is unavailable. Export your save before closing.';
    } }
    save(p: Profile) { try {
        const key = SAVE_PREFIX + p.slot;
        const json = JSON.stringify(p);
        const old = this.storage.getItem(key);
        if (old)
            this.storage.setItem(key + ':backup', old);
        this.storage.setItem(key, json);
        this.warning = this.volatile ? 'Persistent storage is unavailable. Export your save before closing.' : '';
        return true;
    }
    catch {
        this.warning = 'Browser storage is full or unavailable. Export a backup before closing.';
        return false;
    } }
    selectedSlot() {try {const value=Number(this.storage.getItem(SAVE_PREFIX+'selected-slot'));return Number.isInteger(value)&&value>=1&&value<=3?value:1;}catch{return 1;}}
    selectSlot(slot:number) {if(!Number.isInteger(slot)||slot<1||slot>3)return;try{this.storage.setItem(SAVE_PREFIX+'selected-slot',String(slot));}catch{/* Failure to remember a choice never prevents using a logbook. */}}
    load(slot: number) { for (const key of [SAVE_PREFIX + slot, SAVE_PREFIX + slot + ':backup'])
        try {
            const raw = this.storage.getItem(key);
            if (raw)
                return validateProfile(JSON.parse(raw));
        }
        catch {
            this.warning = 'A damaged save was ignored; a backup is used when available.';
        } return freshProfile(slot); }
    settings(): Settings { try {
        const s = JSON.parse(this.storage.getItem(SAVE_PREFIX + 'settings') || '{}');
        const q = ['high', 'balanced', 'low'].includes(s.quality) ? s.quality : 'balanced';
        const gamepads: NonNullable<Settings['gamepads']> = {};
        if (s.gamepads && typeof s.gamepads === 'object' && !Array.isArray(s.gamepads)) for (const [key, raw] of Object.entries(s.gamepads).slice(0, 16)) {
            const p = raw as any;
            if (!p || typeof p !== 'object' || p.key !== key || typeof p.id !== 'string' || typeof p.mapping !== 'string' || !Number.isInteger(p.axisCount) || p.axisCount < 0 || p.axisCount > 64 || !Number.isInteger(p.buttonCount) || p.buttonCount < 0 || p.buttonCount > 128 || !Array.isArray(p.centers) || p.centers.length > 64 || !p.centers.every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= -1 && n <= 1)) continue;
            const validAxis = (v: any) => v && Number.isInteger(v.index) && v.index >= 0 && v.index < p.axisCount && (v.sign === 1 || v.sign === -1);
            if (!p.axes || !['moveX', 'moveZ', 'lookX', 'lookY'].every(k => validAxis(p.axes[k]))) continue;
            const validButtons = p.buttons && typeof p.buttons === 'object' && Object.entries(p.buttons).every(([action, index]: [string, any]) => /^[a-zA-Z]+$/.test(action) && Number.isInteger(index) && index >= 0 && index < p.buttonCount);
            const validAxisButtons = p.axisButtons && typeof p.axisButtons === 'object' && Object.entries(p.axisButtons).every(([action, binding]: [string, any]) => /^[a-zA-Z]+$/.test(action) && binding && Number.isInteger(binding.index) && binding.index >= 0 && binding.index < p.axisCount && typeof binding.value === 'number' && Number.isFinite(binding.value) && binding.value >= -1 && binding.value <= 1);
            if (!validButtons || !validAxisButtons) continue;
            gamepads[key] = { key, id: p.id.slice(0, 200), mapping: p.mapping.slice(0, 40), axisCount: p.axisCount, buttonCount: p.buttonCount, axes: p.axes, centers: p.centers, buttons: p.buttons, axisButtons: p.axisButtons, moveDeadzone: clamp(Number(p.moveDeadzone) || .14, .05, .4), lookDeadzone: clamp(Number(p.lookDeadzone) || .2, .05, .45) };
        }
        return { ...DEFAULT_SETTINGS, ...s, quality: q, music: clamp(Number(s.music ?? .42) || 0, 0, 1), ambience: clamp(Number(s.ambience ?? .6) || 0, 0, 1), effects: clamp(Number(s.effects ?? .7) || 0, 0, 1), sensitivity: clamp(Number(s.sensitivity ?? 1) || 1, .25, 2.5), fov: clamp(Number(s.fov ?? 78) || 78, 60, 100), touchScale: clamp(Number(s.touchScale ?? 1) || 1, .8, 1.3), instrumentHud: typeof s.instrumentHud === 'boolean' ? s.instrumentHud : true, keys: { ...DEFAULT_SETTINGS.keys, ...s.keys }, gamepads };
    }
    catch {
        return structuredClone(DEFAULT_SETTINGS);
    } }
    saveSettings(s: Settings) { try {
        this.storage.setItem(SAVE_PREFIX + 'settings', JSON.stringify(s));
    }
    catch {
        this.warning = 'Settings could not be saved.';
    } }
}

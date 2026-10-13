import { lessonActive, advanceLesson, startLesson } from './tutorial.js';
import { contractOptions, researchEligibility, recordSurveyStation, surveyPayout, researchSettlement, completeResearch, normalizeCampaign, claimMilestone, milestoneStatus } from './campaign.js';
import { contractProgress, eventTheme, eventScore, eventReward, filletGrade } from './contracts.js';
import { scheduleBoat, updateBoat, boatAim, clearBoat } from './boat-encounters.js';
import type { Profile, Run, SiteId, InputFrame, GameEvent, Aim, Vec, Job } from './types.js';
import { SITES, reefFishHomes, floorHeight, currentAt, groundPoint, capacity, freePoint, siteUnlocked, upgradeLevel, airCapacity, spearReach, wreckAnchor, pipeAnchor, siteForRun } from './data.js';
import { vec, rng, clamp, distance, sub, norm, scale, add, direction, raySphere, rayEllipsoid, dot, angleLerp, length } from './math.js';
import { homeRoute, pathLength, clearSegment } from './navigation.js';
import { clearFishPosition } from './fish-motion.js';
import { recoveryFromProgress } from './reef-recovery.js';
export const EMPTY_INPUT: InputFrame = { moveX: 0, moveZ: 0, vertical: 0, lookX: 0, lookY: 0, boost: false, steady: false, draw: false, release: false, cancelDraw: false, interact: false };
export function startRun(p: Profile, id: SiteId, order: Run['order'] = 'catch', event = false, night = false): Run {
    if (p.active || p.pending)
        throw Error('Finish or resume the existing outing first.');
    if (!siteUnlocked(p, id))
        throw Error('Dive site locked.');
    if (night && (upgradeLevel(p,'torch')<1 || !siteUnlocked(p,'passage'))) throw Error('Night dives need a head torch and Passage experience.');
    const offer=contractOptions(p,id).find(o=>o.kind===order);
    if(!offer?.available)throw Error(offer?.reason ?? 'That contract is not available.');
    const site = SITES[id], reef = p.reefs[id], seed = (site.seed + reef.visits * 37) >>> 0, random = rng(seed), recoveryStage = recoveryFromProgress(reef);
    const homes = reefFishHomes(site, site.seed);
    const fish = homes.map((home, i) => { const fid = `fish-${i}`; const returned = reef.visits >= 4 && i < 4 ? `return-${Math.floor(reef.visits / 4)}-${i}` : fid; const alive = !reef.removed.includes(returned); const size = .72 + random() * .44; return { id: returned, p: { ...home }, home: { ...home }, size, weight: Math.round((.3 + size * random() * .8) * 100) / 100, alive, phase: random() * 6.28, flee: 0 }; });
    for(const f of fish) f.p=clearFishPosition(site,f.p,f.size*1.5+.15);
    const jobAt = (jobId: string, kind: Job['kind'], x: number, z: number): Job => ({ id: jobId, kind, p: groundPoint(x, z, kind === 'survey' ? 2.5 : .5, site), done: kind === 'debris' ? reef.cleaned.includes(jobId) : kind === 'coral' ? jobId in reef.restored : false, progress: 0, stage: kind === 'coral' && jobId in reef.restored ? clamp(p.day - reef.restored[jobId], 1, 5) : 0 });
    const worksites = site.worksites!;
    const jobs: Job[] = [
        ...worksites.debris.map((point, i) => jobAt(`debris-${i}`, 'debris', point.x, point.z)),
        ...worksites.coral.map((point, i) => jobAt(`coral-${i}`, 'coral', point.x, point.z)),
        ...worksites.surveys.map((point, i) => jobAt(`survey-${i}`, 'survey', point.x, point.z))
    ];
    const wreck=wreckAnchor(site), pipe=pipeAnchor(site);
    jobs.push(id==='passage'?{...jobAt('survey-1','survey',0,34),p:groundPoint(0,34,12,site)}:jobAt('survey-1','survey',wreck.x-5,wreck.z),jobAt('survey-2','survey',pipe.x,pipe.z-7));
    const animal = (animalId: Run['animals'][number]['id'], point: Vec) => ({ id: animalId, p: { ...point }, home: { ...point }, heading: 0, state: 'roam' as const, timer: 0, cooldown: 0, phase: random() * 6.28 });
    const wildlife = id === 'gardens'
        ? [animal('marlow', vec(-10, 5.5, 15)), animal('moray', vec(28, 5, 8)), animal('turtle', vec(-4, 11, 2)), animal('ray', vec(15, 2.4, 25))]
        : id === 'passage'
            ? [animal('marlow', vec(-6, 5.5, 11)), animal('moray', vec(26.5, 5, -1)), animal('turtle', vec(-4, 11, 2)), animal('ray', vec(0, 2.4, 37))]
            : id === 'mangrove'
                ? [animal('marlow', groundPoint(-34, 9, 4, site)), animal('moray', groundPoint(35, 9, 3, site)), animal('turtle', groundPoint(1, 12, 3, site)), animal('ray', groundPoint(4, 45, 3, site))]
                : id === 'cenote'
                    ? [animal('marlow', groundPoint(-10, 2, 5, site)), animal('moray', groundPoint(12, 8, 4, site)), animal('turtle', groundPoint(0, -23, 4, site)), animal('ray', groundPoint(7, 28, 4, site))]
                    : [animal('marlow', groundPoint(-21, 4, 4, site)), animal('moray', groundPoint(-7, 18, 3, site)), animal('turtle', groundPoint(4, -20, 4, site)), animal('ray', groundPoint(-12, 28, 3, site))];
    const run: Run = { id: `${p.slot}-${p.day}-${seed}`, site: id, siteRevision: 2, recoveryStage, seed, day: p.day, time: 0, p: { ...site.entry }, velocity: vec(), yaw: .08, pitch: .12, air: 200, health: 100, battery: 100, cargo: [], exposed: null, fish, jobs, animals: wildlife, clips: [], removed: 0, cleaned: 0, restored: 0, surveyed: 0, nativeHits: 0, coralHits: 0, stolen: 0, distance: 0, fragments: p.upgrades.includes('kit') ? 5 : 3, charge: 0, strikeCooldown: 0, hurtCooldown: 0, interaction: 0, interactionId: '', scooter: false, light: false, returnWarn: false, lowWarn: false, finished: false, rescued: false, order, event, notices: [], seen: [], cooldowns: {} };
    run.air=airCapacity(p);run.fragments=3+upgradeLevel(p,'kit')*2;run.night=night;run.light=night;
    if(night)run.animals.push(animal('shark',groundPoint(wreck.x+10,wreck.z-12,6,site)));
    run.researchEligible=researchEligibility(p).eligible;
    run.researchFunded=run.researchEligible && !(p.campaign ?? normalizeCampaign(p)).researchCompleted;
    if(event)run.eventTheme=eventTheme(p,id);
    if(id==='gardens'&&p.tutorial<1)startLesson(run);
    scheduleBoat(run,site);
    p.active = run;
    return run;
}
export class Simulation {
    events: GameEvent[] = [];
    aim: Aim = { kind: 'none', id: '', distance: 0, label: '', hint: '', valid: false };
    route: Vec[] = [];
    reserve = 40;
    routeTimer = 0;
    nativeTargets: {
        p: Vec;
        r: number;
    }[] = [];
    constructor(public profile: Profile, public run: Run) { }
    get site() { return siteForRun(this.run); }
    emit(type: GameEvent['type'], text?: string, value?: string) { this.events.push({ type, text, value }); }
    notice(text: string, key = '', cooldown = 6) { if (key && this.run.time < (this.run.cooldowns[key] ?? -1))
        return; if (key)
        this.run.cooldowns[key] = this.run.time + cooldown; this.emit('notice', text); }
    highlight(kind: string, title: string, detail: string, quality = 60) { const r = this.run; if (r.clips.some(c => c.kind === kind) || r.clips.length >= 8)
        return; const c = { id: r.id + '-' + kind, kind, title, detail, quality: clamp(quality + upgradeLevel(this.profile,'camera')*8, 0, 100), chosen: false }; r.clips.push(c); this.events.push({ type: 'highlight', text: title, id: c.id }); }
    update(dt: number, input: InputFrame) {
        const r = this.run;
        if (r.finished)
            return;
        dt = clamp(dt, 0, .05);
        r.time += dt;
        r.strikeCooldown = Math.max(0, r.strikeCooldown - dt);
        r.hurtCooldown = Math.max(0, r.hurtCooldown - dt);
        r.yaw += input.lookX;
        r.pitch = clamp(r.pitch + input.lookY, -1.28, 1.28);
        if (input.cancelDraw)
            r.charge = 0;
        if (input.draw && !r.exposed && !r.scooter && r.strikeCooldown === 0)
            r.charge = clamp(r.charge + dt / Math.max(.4,.8-upgradeLevel(this.profile,'spear')*.08), 0, 1);
        if (input.release && r.charge > 0) {
            this.strike(r.charge);
            r.charge = 0;
        }
        const forward = direction(r.yaw, r.pitch), right = vec(Math.cos(r.yaw), 0, -Math.sin(r.yaw));
        let move = add(scale(forward, input.moveZ), scale(right, input.moveX));
        move.y += input.vertical;
        const mag = length(move);
        if (mag > 1)
            move = scale(move, 1 / mag);
        const prop = r.scooter && r.battery > 0;
        let speed = prop ? 4.4+upgradeLevel(this.profile,'scooter')*.4 : 2.2 * (1+upgradeLevel(this.profile,'fins')*.12);
        if (input.boost && !prop)
            speed *= 1.45;
        if (input.steady)
            speed *= .42;
        if (r.charge > .1)
            speed *= .5;
        const flow = currentAt(r.p, this.site, r.time);
        const want = add(scale(move, speed), flow);
        const damp = 1 - Math.exp(-dt * (input.steady ? 7 : 3));
        r.velocity = vec(r.velocity.x + (want.x - r.velocity.x) * damp, r.velocity.y + (want.y - r.velocity.y) * damp, r.velocity.z + (want.z - r.velocity.z) * damp);
        const old = { ...r.p };
        r.p = add(r.p, scale(r.velocity, dt));
        this.collide();
        r.distance += distance(old, r.p);
        const depth = Math.max(0, this.site.surface - r.p.y);
        const exertion = (input.boost && !prop ? 1.36 : 1) + Math.max(0, -dot(norm(move), flow)) * .3;
        const airRate = .24 * (1 + depth * .014) * exertion * (1-upgradeLevel(this.profile,'air')*.09);
        // Breaking the surface pauses consumption; it never replenishes the tank.
        if (r.p.y <= this.site.surface)
            r.air = Math.max(0, r.air - dt * airRate);
        if (prop && mag > .05) {
            r.battery = Math.max(0, r.battery - dt * (.28/(1+upgradeLevel(this.profile,'battery')*.35)));
            if (!r.battery) {
                r.scooter = false;
                this.notice('Scooter battery empty. Fin power still works.');
            }
        }
        if (r.light)
            r.battery = Math.max(0, r.battery - dt * (.065/(1+upgradeLevel(this.profile,'torch')*.2+upgradeLevel(this.profile,'battery')*.15)));
        for (const f of r.fish) {
            if (!f.alive)
                continue;
            f.flee = Math.max(0, f.flee - dt);
            f.phase += dt * .6;
            const wobble = f.flee ? 1.0 : .18;
            const next = vec(f.home.x + Math.sin(f.phase) * wobble, f.home.y + Math.sin(f.phase * 1.3) * .16, f.home.z + Math.cos(f.phase * .7) * wobble);
            f.p = clearFishPosition(this.site,next,f.size*1.5+.15);
            if (distance(f.p, r.p) < .35+f.size*1.5)
                this.hurt(9, 'Lionfish spines! Air lost. Back away and steady your breathing.');
        }
        if(!lessonActive(r))this.updateAnimals(dt);
        this.updateAim();
        this.work(dt, input.interact);
        this.routeTimer -= dt;
        if (this.routeTimer <= 0) {
            this.routeTimer = 1.2;
            this.route = homeRoute(r.p, this.site);
            this.reserve = 25 + pathLength(this.route) / 1.8 * airRate * (1 + this.site.current);
        }
        if (r.air < this.reserve && !r.returnWarn) {
            r.returnWarn = true;
            this.notice('Return recommended. Leave a little air for the way home.');
            this.emit('sound', undefined, 'warning');
        }
        if (r.air < 25 && !r.lowWarn) {
            r.lowWarn = true;
            this.notice('Air reserve low. Follow the home marker.');
            this.emit('sound', undefined, 'warning');
        }
        if (r.air <= 0 || r.health <= 0)
            this.finish(true);
        if(advanceLesson(this.profile,r,input,dt,this.aim.kind==='fish'&&this.aim.valid)){this.emit('save');if(!lessonActive(r))this.notice('First-dive lesson complete. Replay is available in the field guide.');}
        if(lessonActive(r)){r.air=Math.max(r.air,80);r.health=Math.max(r.health,35);}
        const progress=contractProgress(r);if(progress.ready&&!r.contractReadyNotified){r.contractReadyNotified=true;this.notice(r.order==='catch'?'Four fish secured. Sell at least four at the dock to fill the Kitchen order.':progress.label+' objective complete. Return safely to settle it.');this.emit('save');}
        if(updateBoat(r,this.site,t=>this.notice(t),()=>this.emit('sound',undefined,'boat-engine')))this.emit('save');
        if (Math.floor(r.time) % 30 === 0 && r.time - (r.cooldowns.autosave ?? -30) > 29) {
            r.cooldowns.autosave = r.time;
            this.emit('save');
        }
    }
    collide() { const r = this.run, site = this.site; r.p.y = clamp(r.p.y, floorHeight(r.p.x, r.p.z, site) + .85, site.surface + 1.3); const radial = Math.hypot(r.p.x, r.p.z); if (radial > site.radius) {
        r.p.x *= site.radius / radial;
        r.p.z *= site.radius / radial;
        this.notice('Open water beyond the chart. Work within this dive site.', 'edge', 20);
    } for (let pass = 0; pass < 2; pass++)
        for (const rock of site.rocks) {
            const sx = rock.s.x + .5, sy = rock.s.y + .5, sz = rock.s.z + .5;
            const q = vec((r.p.x - rock.p.x) / sx, (r.p.y - rock.p.y) / sy, (r.p.z - rock.p.z) / sz);
            const l = length(q);
            if (l < 1) {
                const unit = l > .0001 ? scale(q, 1 / l) : vec(0, 1, 0);
                r.p = vec(rock.p.x + unit.x * sx, rock.p.y + unit.y * sy, rock.p.z + unit.z * sz);
                r.velocity = scale(r.velocity, .4);
            }
        } }
    blocker(o: Vec, d: Vec) { let t = Infinity; for (const rock of this.site.rocks)
        t = Math.min(t, rayEllipsoid(o, d, rock.p, rock.s)); return t; }
    strike(charge: number) {
        const r = this.run;
        if (r.cargo.length >= capacity(this.profile)) {
            this.notice('Collection tube full. Return to the mooring before taking another fish.', 'capacity', 5);
            return;
        }
        if (r.scooter || r.exposed || r.strikeCooldown > 0)
            return;
        r.strikeCooldown = .75;
        this.emit('sound', undefined, 'strike');
        if (charge < .3) {
            this.notice('Draw the spear further before releasing.', 'draw', 4);
            return;
        }
        const dir = direction(r.yaw, r.pitch), reach = spearReach(this.profile) * (.65 + .35 * charge), blocked = this.blocker(r.p, dir);
        let best = reach, fish = null;
        for (const f of r.fish)
            if (f.alive) {
                const hit = raySphere(r.p, dir, f.p, .38 * f.size);
                if (hit < best && hit < blocked) {
                    best = hit;
                    fish = f;
                }
            }
        let nativeDistance = Infinity;
        for (const f of this.nativeTargets)
            nativeDistance = Math.min(nativeDistance, raySphere(r.p, dir, f.p, f.r));
        if (nativeDistance < Math.min(best, blocked, reach)) {
            r.nativeHits++;
            this.notice('Native fish hit. Identify your target before drawing.');
            this.emit('sound', undefined, 'hurt');
            return;
        }
        if (fish) {
            fish.alive = false;
            r.removed++;
            this.profile.totalRemoved++;
            this.profile.reefs[r.site].removed.push(fish.id);
            r.exposed = { id: fish.id, weight: fish.weight, value: Math.round(14 + fish.weight * 17) };
            this.notice((this.profile.totalRemoved % 3 === 1 ? 'BOOM! ' : '') + 'Clean strike. Secure the catch with Interact.');
            this.emit('hit', undefined, fish.id);
            this.highlight('first-catch', 'One less lionfish.', 'A careful removal in Lantern Bay.', 60);
            this.emit('save');
        }
        else if (blocked < reach) {
            r.coralHits++;
            this.notice('Reef contact. Approach from a clearer angle.', 'rockhit', 4);
            this.emit('sound', undefined, 'tap');
        }
        else {
            for (const f of r.fish)
                if (f.alive && distance(f.p, r.p) < 5)
                    f.flee = 4;
            this.notice('Just out of reach. Move closer and steady your aim.', 'miss', 5);
        }
    }
    updateAim() {
        const r = this.run, dir = direction(r.yaw, r.pitch), blocked = this.blocker(r.p, dir);
        const none: Aim = { kind: 'none', id: '', distance: 0, label: '', hint: '', valid: false };
        this.aim = none;
        if (r.exposed && r.cargo.length >= capacity(this.profile) && Math.hypot(r.p.x - this.site.landmarks[0].p.x, r.p.z - this.site.landmarks[0].p.z) < 7 && r.p.y > this.site.surface - 4) {
            this.aim = { kind: 'boat', id: 'boat', distance: 0, label: 'Your boat', hint: 'Hold Interact to board · exposed catch will be forfeited', valid: true };
            return;
        }
        if (r.exposed) {
            this.aim = { kind: 'fish', id: 'held', distance: 0, label: 'Lionfish on spear', hint: r.cargo.length < capacity(this.profile) ? 'Hold Interact to secure' : 'Tube full. Return to the buoy.', valid: r.cargo.length < capacity(this.profile) };
            return;
        }
        const boat = this.site.landmarks[0].p;
        if (Math.hypot(r.p.x - boat.x, r.p.z - boat.z) < 7) {
            if (r.p.y > this.site.surface - 4) {
                this.aim = { kind: 'boat', id: 'boat', distance: distance(r.p, boat), label: 'Your boat', hint: 'Hold Interact to finish this dive', valid: true };
                return;
            }
            this.aim = { kind: 'boat', id: 'ascent', distance: distance(r.p, boat), label: 'Home buoy overhead', hint: 'Ascend beside the mooring to board', valid: false };
        }
        const overhead=boatAim(r,this.site,clearSegment);if(overhead){this.aim=overhead;return;}
        let best = Infinity;
        for (const j of r.jobs) {
            if (j.done && j.kind !== 'survey')
                continue;
            if (j.done)
                continue;
            const d = distance(r.p, j.p), alignment = dot(norm(sub(j.p, r.p)), dir);
            if (d < 4 && alignment > .65 && clearSegment(r.p, j.p, this.site) && d < best) {
                best = d;
                this.aim = { kind: 'job', id: j.id, distance: d, label: j.kind === 'debris' ? 'Discarded fishing gear' : j.kind === 'coral' ? 'Nursery restoration plot' : 'Reef survey station', hint: j.kind === 'debris' ? 'Hold Interact to remove' : j.kind === 'coral' ? (r.fragments ? 'Hold Interact to plant a fragment' : 'No nursery fragments remaining') : ((r.researchEligible ?? researchEligibility(this.profile).eligible)?(r.site==='passage'&&r.siteRevision===2&&['survey-0','survey-1'].includes(j.id)?'Hold Interact to read the flow gauge':'Hold Interact to record a survey'):'Research unlocks after a university invitation at 8 reputation'), valid: (j.kind !== 'coral' || r.fragments > 0) && (j.kind!=='survey'|| (r.researchEligible ?? researchEligibility(this.profile).eligible)) };
            }
        }
        for (const f of r.fish)
            if (f.alive) {
                const t = raySphere(r.p, dir, f.p, .48 * f.size);
                if (t < 12 && t < blocked && t < best) {
                    best = t;
                    const reach = spearReach(this.profile);
                    this.aim = { kind: 'fish', id: f.id, distance: distance(r.p, f.p), label: 'Invasive lionfish', hint: r.scooter ? 'Stow scooter to use the pole spear' : t < reach ? 'Hold to draw · release to strike' : 'Approach slowly · pole-spear range', valid: t < reach && !r.scooter };
                }
            }
    }
    work(dt: number, interact: boolean) {
        const r = this.run, a = this.aim;
        if (!interact || !a.valid) {
            r.interaction = 0;
            r.interactionId = '';
            return;
        }
        if (r.interactionId !== a.id) {
            r.interaction = 0;
            r.interactionId = a.id;
        }
        const duration = a.id === 'held' ? .65 : a.kind === 'boat' ? 1.1 : a.id.startsWith('debris') ? 2.2 : a.id.startsWith('coral') ? Math.max(1.3,3.3-upgradeLevel(this.profile,'kit')*.4) : 2.8;
        r.interaction += dt / (r.event&&((r.eventTheme==='cleanup'&&a.id.startsWith('debris'))||(r.eventTheme==='research'&&a.id.startsWith('survey')))?duration*.8:duration);
        if (r.interaction < 1)
            return;
        r.interaction = 0;
        if (a.id === 'held' && r.exposed && r.cargo.length < capacity(this.profile)) {
            r.cargo.push(r.exposed);
            r.exposed = null;
            this.notice(`Catch secured · ${r.cargo.length}/${capacity(this.profile)} in the tube.`);
            this.emit('sound', undefined, 'collect');
            this.emit('save');
            return;
        }
        if (a.kind === 'boat') {
            this.finish(false);
            return;
        }
        if(a.id==='boat-cleanup'){if(clearBoat(r)){this.notice('Recovered safely. A $5 recovery fee is recorded; this does not count as permanent site cleanup.');this.emit('sound',undefined,'work');this.emit('save');}return;}
        const j = r.jobs.find(j => j.id === a.id);
        if (!j || j.done)
            return;
        if(j.kind==='survey'&&!recordSurveyStation(this.profile,r,j.id).ok)return;
        j.done = true;
        const reef = this.profile.reefs[r.site];
        if (j.kind === 'debris') {
            reef.cleaned.push(j.id);
            r.cleaned++;
            this.profile.totalCleaned++;
            this.notice('Fishing gear removed. A little more room for life.');
            this.highlight('cleanup', 'A cleaner corner of the reef.', 'Abandoned fishing gear removed without disturbing the coral.', 68);
        }
        if (j.kind === 'coral' && r.fragments > 0) {
            r.fragments--;
            reef.restored[j.id] = this.profile.day;
            j.stage = 1;
            r.restored++;
            this.profile.totalRestored++;
            this.notice('Nursery fragment planted. Revisit it on a later day.');
            this.highlight('restoration', 'A small beginning.', 'A nursery-grown coral fragment, planted in an approved plot.', 75);
        }
        if (j.kind === 'survey') {
            reef.surveys++;
            r.surveyed++;
            this.notice('Survey recorded. Careful observation counts, too.');
            this.highlight('survey', 'A reef worth returning to.', 'A survey of the nursery and the native fish around it.', 65 + Object.keys(reef.restored).length * 4);
        }
        this.emit('sound', undefined, 'work');
        this.events.push({ type: 'work', id: j.id });
        this.emit('save');
    }
    hurt(amount: number, text: string) { const r = this.run; if (r.hurtCooldown > 0)
        return; r.health = Math.max(0, r.health - amount); r.air=Math.max(0,r.air-amount);r.hurtCooldown = 3; this.notice(text); this.emit('sound', undefined, 'hurt'); }
    updateAnimals(dt: number) {
        const r = this.run;
        for (const a of r.animals) {
            a.phase += dt;
            a.cooldown = Math.max(0, a.cooldown - dt);
            const to = sub(r.p, a.p), d = length(to), visible = clearSegment(a.p, r.p, this.site);
            let target = { ...a.home }, speed = .5;
            a.timer += dt;
            if (a.id === 'turtle' || a.id === 'ray') {
                target = vec(a.home.x + Math.sin(a.phase * .09) * 14, a.home.y + Math.sin(a.phase * .3) * .35, a.home.z + Math.cos(a.phase * .09) * 10);
                speed = 1;
                if (d < 12 && visible && dot(norm(to), direction(r.yaw, r.pitch)) < -.6 && !r.seen.includes(a.id)) {
                    r.seen.push(a.id);
                    this.highlight(a.id, a.id === 'turtle' ? 'Unhurried company.' : 'A shadow over the sand.', a.id === 'turtle' ? 'A sea turtle on its own schedule.' : 'A ray gliding through the sand channel.', 82);
                    if (!this.profile.discoveries.includes(a.id))
                        this.profile.discoveries.push(a.id);
                }
            }
            else if (a.id === 'marlow') {
                const inTerritory = distance(r.p, a.home) < 23;
                if (a.state === 'roam') {
                    target = vec(a.home.x + Math.sin(a.phase * .15) * 4, a.home.y + Math.sin(a.phase * .25), a.home.z + Math.cos(a.phase * .15) * 5);
                    if (d < 13 && visible && a.cooldown === 0) {
                        a.state = 'watch';
                        a.timer = 0;
                        this.notice('Marlow is watching. Keep your catch secured.', 'marlow', 35);
                        this.highlight('marlow', 'Marlow would like a word.', 'A familiar grouper inspects the dive.', 86);
                        if (!this.profile.discoveries.includes('marlow'))
                            this.profile.discoveries.push('marlow');
                    }
                }
                if (a.state === 'watch') {
                    target = { ...a.p };
                    if (r.exposed && visible && inTerritory) {
                        a.state = 'approach';
                        a.timer = 0;
                    }
                    else if (a.timer > 8 || !inTerritory) {
                        a.state = 'retreat';
                        a.timer = 0;
                    }
                }
                if (a.state === 'approach') {
                    target = add(r.p, scale(norm(sub(a.p, r.p)), 2.5));
                    speed = 1.8;
                    if (!r.exposed || !visible || !inTerritory) {
                        a.state = 'retreat';
                        a.timer = 0;
                    }
                    else if (d < 4.5) {
                        a.state = 'warn';
                        a.timer = 0;
                        this.notice('Marlow is lining up your exposed catch. Secure it or move away!');
                    }
                }
                if (a.state === 'warn') {
                    target = { ...a.p };
                    if (!r.exposed || d > 7 || !visible) {
                        a.state = 'retreat';
                        a.timer = 0;
                    }
                    else if (a.timer > 2.6) {
                        a.state = 'lunge';
                        a.timer = 0;
                    }
                }
                if (a.state === 'lunge') {
                    target = { ...r.p };
                    speed = 4.3;
                    if (d < 1.8 && r.exposed && visible) {
                        r.exposed = null;
                        r.stolen++;
                        this.notice('Marlow stole the exposed fish. Your tube is safe.');
                        this.emit('sound', undefined, 'theft');
                        a.state = 'retreat';
                        a.timer = 0;
                        a.cooldown = 25;
                    }
                    if (a.timer > 2 || !r.exposed) {
                        a.state = 'retreat';
                        a.cooldown = 20;
                    }
                }
                if (a.state === 'retreat') {
                    target = a.home;
                    speed = 1.5;
                    if (distance(a.p, a.home) < 1) {
                        a.state = 'roam';
                        a.cooldown = 15;
                        a.timer = 0;
                    }
                }
            }
            else if(a.id==='shark') {
                target=vec(a.home.x+Math.sin(a.phase*.08)*7,a.home.y+Math.sin(a.phase*.22),a.home.z+Math.cos(a.phase*.08)*8);speed=1.4;
                if(a.state==='roam' && d<9 && visible && a.cooldown===0) {a.state='warn';a.timer=0;this.notice('A reef shark is circling. Keep your distance and leave the deep wreck.','shark',10);this.highlight('shark','A shape beyond the beam.','A cautious night encounter at the deep wreck.',85);}
                if(a.state==='warn') {target={...a.p};if(d>11||!visible){a.state='retreat';a.timer=0;}else if(a.timer>3.5&&d<6){a.state='lunge';a.timer=0;}}
                if(a.state==='lunge'){target={...r.p};speed=3;if(d<1.8&&visible)this.hurt(18,'Shark contact! Air lost. Leave its territory.');if(a.timer>1.5||!visible||distance(r.p,a.home)>19){a.state='retreat';a.timer=0;a.cooldown=30;}}
                if(a.state==='retreat'){target={...a.home};speed=2;if(distance(a.p,a.home)<1){a.state='roam';a.timer=0;a.cooldown=30;}}
            }
            else {
                target = vec(a.home.x + Math.sin(a.phase * .6) * .25, a.home.y + Math.sin(a.phase * .8) * .12, a.home.z);
                if (d < 3.6 && visible && a.cooldown === 0 && a.state === 'roam') {
                    a.state = 'warn';
                    a.timer = 0;
                    this.notice('Moray territory. Back away from the crevice.', 'moray', 12);
                    this.highlight('moray', 'Someone is already home.', 'A moray in the reef. Give it space.', 72);
                }
                if (a.state === 'warn') {
                    target = add(a.home, scale(norm(sub(r.p, a.home)), .65));
                    if (d > 4.5 || !visible) {
                        a.state = 'roam';
                        a.cooldown = 10;
                    }
                    else if (a.timer > 2.5 && d < 2.6) {
                        a.state = 'lunge';
                        a.timer = 0;
                    }
                }
                if (a.state === 'lunge') {
                    target = add(a.home, scale(norm(sub(r.p, a.home)), 1.8));
                    speed = 4;
                    if (d < 1.8 && visible)
                        this.hurt(22, 'Defensive moray bite. Leave the crevice and recover your distance.');
                    if (a.timer > 1) {
                        a.state = 'retreat';
                        a.cooldown = 15;
                    }
                }
                if (a.state === 'retreat') {
                    target = a.home;
                    speed = 2;
                    if (distance(a.p, a.home) < .3) {
                        a.state = 'roam';
                        a.timer = 0;
                    }
                }
            }
            const delta = sub(target, a.p), len = length(delta);
            if (len > .01) {
                const np = add(a.p, scale(delta, Math.min(1, speed * dt / len)));
                np.y=Math.max(np.y,floorHeight(np.x,np.z,this.site)+(a.id==='shark'?1.6:1));
                if (freePoint(np, this.site, a.id === 'shark' ? 1.6 : a.id === 'marlow' ? 1.6 : a.id === 'moray' ? .4 : 1.3))
                    a.p = np;
                a.heading = angleLerp(a.heading, Math.atan2(delta.x, delta.z), Math.min(1, dt * 2));
            }
        }
    }
    toggleScooter() { const r = this.run; if (!this.profile.upgrades.includes('scooter')) {
        this.notice('The Minnow scooter is waiting at the equipment shop.');
        return;
    } if (r.exposed) {
        this.notice('Secure the fish before changing equipment.');
        return;
    } if (r.battery <= 0) {
        this.notice('Battery empty. Use your fins.');
        return;
    } r.scooter = !r.scooter; r.charge = 0; this.notice(r.scooter ? 'Scooter deployed. Hold forward to cruise.' : 'Scooter stowed. Pole spear ready.'); }
    finish(rescued: boolean) { const r = this.run; if (r.finished)
        return; r.finished = true; r.rescued = rescued; r.charge = 0; r.interaction = 0; this.profile.active = null; this.profile.pending = r; this.events.push({ type: 'finish' }); }
}
export interface Settlement {
    earned: number;
    expenses: number;
    debtPaid: number;
    followers: number;
    reputation: number;
    contract: number;
    eventPrize: number;
    sponsor: number;
    score: number;
    filletBonus: number;
    sales: number; cleanPay: number; restorationPay: number; surveyPay: number; researchTopUp: number; donationPay: number; starterGrant: number; boatPay: number;
    contractReason: string; eventReason: string; filletGrade: string; recognition: string[];
}
export function prepareFillets(p: Profile,quality: number) {
    const r=p.pending;
    if(!r || !r.finished || r.rescued || !r.cargo.length || r.filletQuality!==undefined || !Number.isFinite(quality) || quality<0 || quality>1) throw Error('This catch cannot be prepared again.');
    r.filletQuality=quality;
}
export function settleRun(p: Profile, run: Run, allocation: {
    sell: number;
    eat: number;
    donate: number;
}, chosen: string[]): Settlement {
    if(run.practice)throw Error('Practice has no campaign settlement.');
    if (p.pending?.id !== run.id)
        throw Error('This outing has already been settled.');
    const available = run.rescued ? 0 : run.cargo.length;
    const n = allocation.sell + allocation.eat + allocation.donate;
    if (![allocation.sell, allocation.eat, allocation.donate].every(x => Number.isInteger(x) && x >= 0) || n !== available)
        throw Error('Allocate each landed fish exactly once.');
    const selected = run.clips.filter(c => chosen.includes(c.id)).slice(0, 2);
    const sales = run.cargo.slice(0, allocation.sell).reduce((s, c) => s + c.value, 0);
    const filletBonus = Math.round(sales * (run.filletQuality??0)*.3);
    // Save migration supplies researchEligible for old research outings. That
    // access flag must not replace their already-promised financial terms.
    const legacy=run.siteRevision===undefined&&run.researchFunded===undefined;
    const progress=contractProgress(run), research=researchSettlement(run,p);
    let contract=0;
    let contractReason=run.order==='none'?'Free exploration: no contract selected.':run.rescued?'Rescue keeps ecological work, but contract bonuses need a safe return.':progress.ready?'Objective complete.':`${progress.label}: ${progress.amount}/${progress.target} completed.`;
    if(!run.rescued){
        if(run.order==='catch'&&allocation.sell>=4)contract=legacy?65:45;
        if(run.order==='catch'&&allocation.sell<4)contractReason=`${allocation.sell} fish sold; the Kitchen order needs 4. Secured fish donated or kept as meals do not fill a sale order.`;
        if(run.order==='cleanup'&&run.cleaned>=2)contract=legacy?70:40;
        if(run.order==='restore'&&run.restored>=2)contract=legacy?80:45;
    }
    const survey=run.order==='research'?research:surveyPayout(run,p.reefs[run.site]);
    let researchTopUp=run.order==='research'?(legacy&&!run.rescued&&run.surveyed>=2?(run.night?180:140):research.assignmentTopUp):0;
    if(run.order==='research'&&run.site==='passage'&&run.siteRevision===2&&!progress.ready){researchTopUp=0;contractReason='Read both the lee-shelf and Cathedral flow gauges to complete this route assignment.';}
    else if(run.order==='research')contractReason=legacy?'The terms of your saved research outing are honoured for this settlement. Future assignments use the new inclusive rates.':research.reason;
    if(run.order==='research'&&researchTopUp>0)completeResearch(p,research);
    const campaign=p.campaign ?? (p.campaign=normalizeCampaign(p));
    const starterGrant=!run.rescued&&allocation.sell>0&&!campaign.characterFlags.includes('welcome-grant')?20:0;
    if(starterGrant)campaign.characterFlags.push('welcome-grant');
    const care = Math.max(0, run.removed * 2 + run.cleaned * 3 + run.restored * 4 + run.surveyed * 2 - run.nativeHits * 8 - run.coralHits);
    const rep = Math.max(0, Math.floor(care / 4) + allocation.donate);
    p.reputation += rep;
    let followers = 0;
    for (const c of selected) {
        const prior = p.published.filter(k => k === c.kind).length;
        followers += Math.round(c.quality / (3 + prior * 2));
        p.published.push(c.kind);
    }
    const droppedPublications=Math.max(0,p.published.length-1000);
    if(p.campaign?.activeOpportunityPublishedAt!==undefined)p.campaign.activeOpportunityPublishedAt=Math.max(0,p.campaign.activeOpportunityPublishedAt-droppedPublications);
    p.published = p.published.slice(-1000);
    p.audience += followers;
    let sponsor=0; // New recognition creates opportunities, not another cash stack.
    if(legacy&&p.sponsorPaidDay!==p.day){if(p.reputation>=12&&run.restored+run.cleaned>=2)sponsor=50;else if(p.audience>=80&&selected.some(c=>['marlow','turtle','ray'].includes(c.kind)))sponsor=35;if(sponsor)p.sponsorPaidDay=p.day;}
    const recognition:string[]=[];
    const opportunity=campaign.activeOpportunity;
    if(opportunity&&milestoneStatus(p,opportunity).available){const awarded=claimMilestone(p,opportunity);if(awarded.ok)recognition.push(awarded.reason);}
    const score=eventScore(run);
    const eventPrize=run.event&&!run.rescued?(legacy?(score>=1200?120:score>=650?65:score>=250?25:0):eventReward(score)):0;
    if (run.event) {
        p.records.push({ day: p.day, site: run.site, score, catch: run.removed, clean: run.cleaned });
        p.records = p.records.slice(-60);
    }
    const cleanPay=run.cleaned*12,restorationPay=run.restored*15,surveyPay=legacy?run.surveyed*(run.night?75:55):survey.stationPay,donationPay=allocation.donate*3,boatPay=run.encounter?.rewarded?5:0;
    const earned=sales+filletBonus+contract+cleanPay+restorationPay+surveyPay+researchTopUp+donationPay+starterGrant+boatPay+eventPrize+sponsor;
    const eventReason=!run.event?'Not registered for this outing.':run.rescued?'Rescue: event score and prize are forfeited.':`Local ${run.eventTheme ?? 'catch'} day: ${score} points; ${eventPrize?'prize earned.':'250 points needed for the first prize.'}`;
    const expenses = run.rescued ? 85 : Math.max(8, 28 + (run.site === 'passage' ? 10 : 0) + (run.night?10:0) + run.restored * 6 - (allocation.eat > 0 ? 8 : 0));
    const balance = p.cash + earned - expenses;
    if (balance < 0) {
        p.cash = 0;
        p.debt += -balance;
    }
    else
        p.cash = balance;
    const debtPaid = Math.min(p.debt, Math.max(0, Math.floor(earned * .2)), p.cash);
    p.cash -= debtPaid;
    p.debt -= debtPaid;
    const reef = p.reefs[run.site];
    reef.visits++;
    // Rescue keeps completed ecological work, so a rescued trip with removals
    // still counts as productive. Empty visits never advance recovery.
    if (run.removed > 0) reef.productiveVisits = (reef.productiveVisits ?? 0) + 1;
    reef.lastDay = p.day;
    p.eventRegistrationDay=undefined;
    p.day++;
    p.pending = null;
    p.active = null;
    p.lastReport = run.rescued ? 'A difficult outing. The reef work remains; tomorrow is another dive.' : `${run.removed} lionfish removed · ${run.cleaned} cleanup jobs · ${run.restored} corals planted.`;
    return { earned, expenses, debtPaid, followers, reputation: rep, contract, eventPrize, sponsor, score, filletBonus, sales,cleanPay,restorationPay,surveyPay,researchTopUp,donationPay,starterGrant,boatPay,contractReason,eventReason,filletGrade:filletGrade(run.filletQuality??0),recognition };
}

import { BoatEntrySequence } from './game/boat-entry.js';
import { BOAT_ENTRY_DURATION, BOAT_WATER_CONTACT } from './render/boat-crew.js';
import { BoatTravelRenderer } from './render/boat-travel.js';
import { newBoat, updateBoatTravel, arrivalSite, travelCosts, completeCooking, equipCharm, type BoatState } from './game/expedition.js';
import { PerformanceSuggestion } from './host.js';
import { bindSuspendedDive } from './game/resume.js';
import { startLesson, lessonActive, skipLesson } from './game/tutorial.js';
import { approachResearch, acceptResearch, normalizeCampaign, researchEligibility, recordCharacterFlag, acceptMilestoneOpportunity } from './game/campaign.js';
import { nextCharacterMoment, type CharacterMoment } from './ui/campaign-ui.js';
import { sampledThrust } from './audio/scooter.js';
import { prepareWebsiteGameStartHook } from './analytics/game-start.js';
import { SaveStore, freshProfile, buy, validateProfile } from './game/profile.js';
import { Simulation, startRun, settleRun, EMPTY_INPUT, prepareFillets } from './game/simulation.js';
import { SITES, DEFAULT_SETTINGS, siteUnlocked, upgradeLevel, capacity } from './game/data.js';
import type { Profile, Settings, SiteId, InputFrame } from './game/types.js';
import { vec, sub } from './game/math.js';
import { ReefRenderer } from './render/renderer.js';
import { InputController } from './input.js';
import { Soundscape, bindAudioUnlock } from './audio/audio.js';
import { UI, Screen } from './ui/ui.js';
const canvas = document.getElementById('ocean') as HTMLCanvasElement;
const store = new SaveStore();
let profile = store.load(store.selectedSlot()), settings = store.settings(), sim: Simulation | null = null, paused = true, visualDive = false, renderer: ReefRenderer | null = null, stack: (Screen | 'play')[] = [], fault = false;
let boat: BoatState|null=null, boatRenderer: BoatTravelRenderer|null=null, travelledDistance=0,boatInteract=false;
let boatEntrySequence:BoatEntrySequence|null=null,entrySplashPlayed=false,entryFade=0;
const entryFadeElement=document.createElement('div');entryFadeElement.id='boat-entry-fade';entryFadeElement.setAttribute('aria-hidden','true');document.body.append(entryFadeElement);
const entryStatus=document.createElement('div');entryStatus.id='boat-entry-status';entryStatus.hidden=true;
entryStatus.innerHTML='<span role="status" aria-live="polite">Checking dive gear</span><button type="button">Skip entry</button>';document.body.append(entryStatus);
entryStatus.querySelector('button')!.onclick=()=>dispatch('boat-entry-skip');
function cancelBoatEntry(){input.clear();boatEntrySequence?.cancel();boatEntrySequence=null;entryFade=0;entrySplashPlayed=false;entryStatus.hidden=true;document.body.classList.remove('boat-entry');}
function finishBoatEntry(skip=false){const selection=boatEntrySequence?.take(skip);if(!selection)return;
    boatEntrySequence=null;entryStatus.hidden=true;document.body.classList.remove('boat-entry');
    ui.site=selection.site;ui.order=selection.order;ui.night=selection.night;travelledDistance=selection.distance;
    entryFade=1;input.clear();try{begin();}catch(error){entryFade=0;ui.toast(String(error));if(boat)resumeBoat();}
}
const audio = new Soundscape(settings);
const unbindAudioUnlock = bindAudioUnlock(audio, document);
audio.setHidden(document.hidden);
const ui = new UI(() => profile, () => settings, dispatch);
const input = new InputController(canvas, settings, action => { if (action === 'pause') {
    if (!paused)
        open('pause');
    else
        close();
}
else if (action === 'journal') {
    if(boat){ui.toast('Use the bay navigation chart and slow beside a gold buoy to dive.');return;}
    if (paused && ui.screen === 'journal')
        close();
    else
        open('journal');
}
else if (action === 'scooter') {
    setWatchRaised(false);
    sim?.toggleScooter();
}
else if (action === 'watch')
    toggleWatch();
else if (action === 'light' && sim) {
    if(upgradeLevel(profile,'torch')<1){ui.toast('Install a head torch at the equipment shop.');return;}
    sim.run.light = !sim.run.light;
    sim.notice(sim.run.light ? 'Dive light on. Battery use is shared with the scooter.' : 'Dive light off.');
} });
input.mountTouch();
const performanceSuggestion = new PerformanceSuggestion();
let accum = 0, last = 0, visualTime = 0, hudClock = 0, frameCount = 0;
let practiceCareer: Profile|null=null;
let playCandidate=false, audioThrust=0;
const gameStarts=prepareWebsiteGameStartHook();
function endPractice() {
    profile=practiceCareer ?? profile;practiceCareer=null;sim=null;playCandidate=false;
    profile.active=profile.active?.practice?null:profile.active;profile.pending=profile.pending?.practice?null:profile.pending;
    visualDive=false;setPause(true);preview(profile.active?.site ?? ui.site);stack=[];ui.show('dock');ui.toast('Practice complete. Your campaign, catch, money and reef work are unchanged.');
}
function showMoment(moment: CharacterMoment, inDive=false) {
    if(inDive){stack=['play'];setPause(true);}else{stack=['dock'];show('dock');}
    ui.moment=moment;ui.show('moment');
}
function harbourMoment() {if(practiceCareer||profile.pending||profile.active)return;const m=nextCharacterMoment(profile);if(!m)return;recordCharacterFlag(profile,m.id);if(m.id==='research-invitation')approachResearch(profile);persist();showMoment(m);}
let watchRaised = false;
const debug = new URLSearchParams(location.search).has('debug') || location.hash.includes('debug') || (window as any).REEF_TEST_MODE === true;
function persist() { if(practiceCareer)return; store.save(profile); const w = document.getElementById('storage-warning')!; w.hidden = !store.warning; w.textContent = store.warning; }
function setWatchRaised(value: boolean) {
    const raised = value && !paused && visualDive && !!sim;
    watchRaised = raised;
    document.body.classList.toggle('watch-raised', raised);
    renderer?.setWatchRaised(raised);
    input.setWatchRaised(raised);
    const button = document.getElementById('watch-button') as HTMLButtonElement | null;
    if (button) { button.setAttribute('aria-pressed', String(raised)); button.setAttribute('aria-label', `${raised ? 'Lower' : 'Raise'} dive computer (${settings.keys.watch.replace('Key', '')})`); button.title = `${raised ? 'Lower' : 'Raise'} dive computer (${settings.keys.watch.replace('Key', '')})`; }
    updateWatchReadout();
}
function toggleWatch() {
    if (paused || !visualDive || !sim) return;
    if (!watchRaised) { if(sim.run.scooter)sim.toggleScooter(); sim.run.charge = 0; sim.run.interaction = 0; input.cancelDraw = true; input.release = false; }
    setWatchRaised(!watchRaised);
}
function updateWatchReadout() {
    const output = document.getElementById('watch-readout');
    if (!output) return;
    if (!watchRaised || !sim) { output.textContent = `Dive computer lowered. Press ${settings.keys.watch.replace('Key', '')} or use the Watch button to raise it.`; return; }
    const run = sim.run, depth = Math.max(0, sim.site.surface - run.p.y);
    output.textContent = `Dive computer raised. Air ${Math.ceil(run.air)} bar. Depth ${depth < .05 ? 'surface' : `${depth.toFixed(1)} metres`}. Elapsed ${Math.floor(run.time / 60)} minutes ${Math.floor(run.time % 60)} seconds. Secured ${run.cargo.length} of ${capacity(profile)}. ${run.exposed ? "One fish remains exposed on the spear. " : ""} Battery ${Math.ceil(run.battery)} percent. Return reserve ${Math.ceil(sim.reserve)} bar. The spear is stowed; lower the watch before drawing.`;
}
function setPause(v: boolean) { if (v) setWatchRaised(false); paused = v; input.setActive(!v); accum = 0; if (sim) {
    sim.run.charge = 0;
    sim.run.interaction = 0;
} audio.setPaused(v && (visualDive || !!boat)); if (v)
    persist(); }
function preview(id: SiteId = ui.site) { if (!renderer)
    return; const copy = structuredClone(profile); copy.active = null; copy.pending = null; const run = startRun(copy, siteUnlocked(copy, id) ? id : 'gardens', 'none'); renderer.build(profile, run); visualDive = false; }
function show(screen: Screen) { setPause(true); if(boat&&screen==='pause')screen='boat-pause'; ui.show(screen); if (screen === 'saves')
    ui.slots([store.load(1), store.load(2), store.load(3)]); if (screen === 'journal')
    ui.chart(sim && visualDive ? sim : null); if (screen === 'dock')
    visualDive = false; }
function open(screen: Screen) { if (screen === 'dock') {
    stack = [];
    show('dock');
    return;
} stack.push(paused ? ui.screen : 'play'); show(screen); }
function close() { if(boat){resumeBoat();return;} if (['debrief', 'receipt'].includes(ui.screen)) {
    if (profile.pending) {
        ui.toast('Allocate the catch and settle this outing first.');
        return;
    }
    stack = [];
    show('dock');
    return;
} const back = stack.pop(); if (back === 'play' && profile.active) {
    resume();
    return;
} if (back) {
    show(back as Screen);
    return;
} if (profile.active && visualDive)
    resume();
else
    show('dock'); }
function resume() { if (!profile.active) {
    ui.toast('There is no suspended dive to resume.');
    return;
} sim=bindSuspendedDive(profile,sim,renderer!,run=>new Simulation(profile,run));
    if(!visualDive&&!sim.run.practice)playCandidate=true; visualDive = true; setPause(false); stack = []; ui.play(); void audio.start(); canvas.focus(); input.capture(); }
function resumeBoat(){setPause(false);ui.playBoat();void audio.start();}
function launchBoat(){if(profile.active||profile.pending){begin();return;}cancelBoatEntry();setPause(true);input.boatMode=true;sim=null;visualDive=false;boat=newBoat();boatInteract=false;playCandidate=true;boatRenderer=new BoatTravelRenderer(renderer!,profile,settings);stack=[];resumeBoat();}
function begin() { if (profile.pending) {
    review();
    return;
} if (profile.active) {
    resume();
    return;
} const run = startRun(profile, ui.site, ui.order, profile.eventRegistrationDay===profile.day && profile.day % 3 === 0, ui.night);
    input.boatMode=false;run.boatDistance=travelledDistance;travelledDistance=0;boat=null;boatRenderer=null;document.body.classList.remove('boat-travel');
    playCandidate=!run.practice; sim = new Simulation(profile, run); renderer!.build(profile, run); visualDive = true; setPause(false); ui.play(); void audio.start(); canvas.focus(); persist(); if(run.site==='passage'&&(run.siteRevision??1)>=2&&recordCharacterFlag(profile,'passage-arrival')){persist();showMoment({id:'passage-arrival',speaker:'Nia · Harbour pilot',title:'Take the sheltered route.',text:'Your buoy is on the western shelf. Follow the lee wall to the nursery, then cross the tide race towards Cathedral arch. The two flow gauges mark the research route. There is open water above if the current feels too strong.'},true);}
    if(run.jobs.some(j=>j.kind==='outbreak')&&recordCharacterFlag(profile,'outbreak-field-guide')){persist();showMoment({id:'outbreak-field-guide',speaker:'Jo — Lantern Bay Trust',title:'A different kind of reef care.',text:'A crown-of-thorns outbreak has been marked on your chart: amber triangles, three targets at most. Look for the purple many-armed spiny stars beside pale feeding scars. The orange five-arm stars are ordinary reef life. Stow your catch, approach slowly and hold Interact to position the field injector. Release to unlock its safety, then hold again to press the injector. Each logged treatment earns $14 and 1 reputation; no catch-tube space needed. This is optional work alongside your usual dive. Keep enough air to get home.'},true);}
    if(!paused)input.capture();
    ui.toast(run.night?'Moonlit dive. Your head torch is on; give wildlife room.':profile.totalRemoved === 0 ? 'Welcome to Lantern Bay. The first lionfish is below and ahead. J opens your chart.' : 'Back in the water. The reef remembers your last visit.'); }
function review() { if (!profile.pending)
    return; sim = new Simulation(profile, profile.pending); renderer!.build(profile, profile.pending); visualDive = true; ui.initDebrief(profile.pending); stack = []; show('debrief'); }
function download(name: string, text: string, type = 'application/json') { const blob = new Blob([text], { type }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function applySettings() { input.settings = settings; renderer?.configure(settings); audio.setSettings(settings); store.saveSettings(settings); document.body.classList.toggle('reduced', settings.reducedMotion); document.body.classList.toggle('instrument-hud-hidden', settings.instrumentHud === false); document.querySelector('#chart-button kbd')!.textContent = settings.keys.journal.replace('Key', ''); document.querySelector('#watch-button kbd')!.textContent = settings.keys.watch.replace('Key', ''); document.documentElement.style.setProperty('--touch-scale', String(settings.touchScale)); }
async function toggleFullscreen() {
    const doc = document as any, root = document.documentElement as any;
    const active = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
    try {
        if (active) {
            const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
            if (!exit) { ui.toast('This browser cannot exit fullscreen from the page.'); return; }
            await exit.call(doc);
            return;
        }
        if (typeof root.requestFullscreen === 'function') await root.requestFullscreen({ navigationUI: 'hide' });
        else if (typeof root.webkitRequestFullscreen === 'function') await root.webkitRequestFullscreen();
        else { ui.toast('Fullscreen is unavailable in this browser.'); return; }
        if (!(doc.fullscreenElement || doc.webkitFullscreenElement)) ui.toast('The browser did not enter fullscreen.');
    }
    catch (error) { const message = error instanceof Error ? error.message : String(error); ui.toast(`Fullscreen was denied: ${message}`); }
}
function dispatch(action: string, data?: any) {
    try {
        switch (action) {
            case 'screen':
                if(data==='dock'&&practiceCareer){endPractice();break;}
                if (input.calibration && data !== 'settings') input.cancelCalibration();
                open(data);if(data==='dock')harbourMoment();
                break;
            case 'close':
                if (input.calibration) input.cancelCalibration();
                close();
                break;
            case 'boat-launch':launchBoat();break;
            case 'boat-resume':resumeBoat();break;
            case 'boat-harbour':cancelBoatEntry();input.boatMode=false;boat=null;boatRenderer=null;document.body.classList.remove('boat-travel');preview();stack=[];show('dock');break;
            case 'boat-dive':{if(boatEntrySequence)break;const id=boat&&arrivalSite(boat);if(!id||!siteUnlocked(profile,id)){ui.toast('Stop beside an unlocked gold dive buoy first.');break;}
                boatEntrySequence=new BoatEntrySequence({site:id,order:ui.order,night:ui.night,distance:boat!.distance},BOAT_ENTRY_DURATION);
                boat!.speed=0;input.clear();entrySplashPlayed=false;entryFade=0;entryStatus.hidden=false;document.body.classList.add('boat-entry');
                if(settings.reducedMotion)finishBoatEntry(true);break;}
            case 'boat-entry-skip':if(!paused)finishBoatEntry(true);break;
            case 'prep-return':stack=[];show('debrief');break;
            case 'cook-save':if(profile.pending){completeCooking(profile,data.recipe,data.scores);persist();}break;
            case 'scaling-save':if(profile.pending&&!profile.pending.filletQuality){profile.pending.scalingPasses=data;persist();}break;
            case 'charm-equip':equipCharm(profile,data);persist();ui.show('gear');break;
            case 'site':
                ui.site = data;
                preview(data);
                ui.show('dock');
                break;
            case 'dive':
                begin();
                break;
            case 'resume':
                if(boat)resumeBoat();else resume();
                break;
            case 'review':
                review();
                break;
            case 'buy':
                if (buy(profile, data)) {
                    persist();
                    audio.sfx('work');
                    ui.show('gear');
                    ui.toast(data === 'scooter' ? 'The Minnow is yours. Q or Gear deploys it on your next dive.' : 'Equipment purchased. Ready for the next outing.');
                }
                else
                    ui.toast('That purchase is not available right now.');
                break;
            case 'fillet-cut-save':
                if(profile.pending&&profile.pending.filletQuality===undefined)profile.pending.filletCuts=Array.isArray(data)?data.slice(0,3):[];persist();break;
            case 'fillet':
                prepareFillets(profile,Number(data));persist();
                break;
            case 'tutorial-skip':
                if(sim){skipLesson(profile,sim.run);persist();ui.toast('Lesson skipped. Replay is available in the field guide.');}break;
            case 'practice':
                if(practiceCareer)endPractice();
                persist();practiceCareer=profile;profile=freshProfile(profile.slot);profile.upgrades=[...practiceCareer.upgrades];profile.upgradeLevels=structuredClone(practiceCareer.upgradeLevels);
                {const run=startRun(profile,'gardens','none');run.practice=true;startLesson(run);sim=new Simulation(profile,run);renderer!.build(profile,run);visualDive=true;setPause(false);ui.play();void audio.start();canvas.focus();input.capture();ui.toast('Practice dive. Nothing here changes your campaign.');}break;
            case 'practice-exit':endPractice();break;
            case 'research-visit':
                if(profile.active||profile.pending){ui.toast('Finish your current outing before meeting the research team.');break;}
                if(profile.campaign?.researchAccepted){ui.toast('The research programme is already open. Choose a station assignment at the harbour.');break;}
                if(!profile.campaign?.researchInvitationSeen){const approach=approachResearch(profile);if(!approach.ok){ui.toast(approach.reason);break;}}persist();showMoment({id:'research-invitation',speaker:'Dr Mira Vale · Lantern Bay University',title:'Will you help us read the reef?',text:'Your field work has earned our trust. We can fund two station readings: $65 total on your first day assignment, including station pay ($72 at night). Afterwards, two-station monitoring pays $38 by day or $45 at night. In Passage, read the lee-shelf and Cathedral gauges.',research:true});break;
            case 'research-accept':
                {const result=acceptResearch(profile);persist();ui.toast(result.reason);close();}break;
            case 'opportunity':
                {const result=acceptMilestoneOpportunity(profile,data);persist();ui.show('dock');ui.toast(result.reason);}break;
            case 'suspend':
                if(practiceCareer){endPractice();break;}
                setPause(true);
                visualDive = false;
                stack = [];
                show('dock');
                ui.toast('Dive suspended. Resume any time from this browser.');
                break;
            case 'rescue-confirm':
                stack.push(ui.screen);
                ui.confirm('rescue', 'Request rescue? All fish from this outing are forfeited and a $85 rescue bill is added. Your equipment and completed reef work remain.');
                break;
            case 'rescue':
                sim?.finish(true);
                processEvents();
                break;
            case 'reset-confirm':
                stack.push(ui.screen);
                ui.confirm('reset', 'Erase this logbook, including its suspended dive, money, equipment and reef changes? Other save slots are not affected. Export a backup first.');
                break;
            case 'reset':
                if(practiceCareer)endPractice();
                profile = freshProfile(profile.slot);
                sim = null;
                persist();
                ui.event = profile.eventRegistrationDay===profile.day;
                ui.site = 'gardens';
                ui.night = false;
                preview();
                stack = [];
                show('dock');
                break;
            case 'slot':
                if(practiceCareer)endPractice();
                persist();
                profile = store.load(Number(data));
                store.selectSlot(profile.slot);
                sim = null;
                ui.site = profile.active?.site || 'gardens';
                ui.night = false;
                ui.event = profile.eventRegistrationDay===profile.day;
                preview(ui.site);
                stack = [];
                show('dock');
                ui.toast('Logbook ' + profile.slot + ' opened.');
                break;
            case 'export':
                persist();
                download(`reef-sweep-logbook-${profile.slot}-day-${profile.day}.json`, JSON.stringify(profile, null, 2));
                ui.toast('Save exported. Keep it somewhere safe.');
                break;
            case 'import':
                (document.getElementById('import-file') as HTMLInputElement).click();
                break;
            case 'setting':
                { const previousQuality = settings.quality;
                (settings as any)[data.name] = data.value;
                applySettings();
                if (data.name === 'quality' && data.value !== previousQuality) {
                    if (data.value === 'high') { persist(); ui.qualityReloadPending = true; ui.show('settings'); }
                    else if (ui.qualityReloadPending) { ui.qualityReloadPending = false; ui.show('settings'); }
                }
                }
                break;
            case 'clear-mask':if(sim&&(sim.run.maskFlood??0)>0&&sim.run.air>=2){sim.run.air-=2;sim.run.maskFlood=0;persist();ui.toast('Mask clear · 2 bar used.');}break;
            case 'performance-apply':
                settings.quality = settings.quality === 'high' ? 'balanced' : 'low'; applySettings(); close(); break;
            case 'performance-dismiss': close(); break;
            case 'fullscreen':
                setWatchRaised(false);
                void toggleFullscreen();
                break;
            case 'watch':
                toggleWatch();
                break;
            case 'quality-reload':
                persist();
                window.location.reload();
                break;
            case 'quality-later':
                ui.qualityReloadPending = false;
                ui.show('settings');
                break;
            case 'gamepad-scan':
                input.selectPad(null);
                input.pads();
                ui.updateControllerStatus(input.controllerStatus());
                ui.show('settings');
                break;
            case 'gamepad-select':
                input.selectPad(data || null);
                ui.updateControllerStatus(input.controllerStatus());
                ui.show('settings');
                break;
            case 'gamepad-start':
                if (!input.startCalibration()) ui.toast('No connected controller is available. Click Scan, then press a button on the controller.');
                ui.updateControllerStatus(input.controllerStatus());
                ui.show('settings');
                break;
            case 'gamepad-cancel':
                input.cancelCalibration();
                ui.updateControllerStatus(input.controllerStatus());
                ui.show('settings');
                break;
            case 'gamepad-use':
                if (input.useCalibration()) { applySettings(); ui.updateControllerStatus(input.controllerStatus()); ui.show('settings'); }
                break;
            case 'gamepad-restore':
                input.restorePadDefaults();
                applySettings();
                ui.updateControllerStatus(input.controllerStatus());
                ui.show('settings');
                break;
            case 'binding': {
                const old = settings.keys[data.action as keyof typeof settings.keys];
                const existing = (Object.keys(settings.keys) as (keyof typeof settings.keys)[]).find(k => settings.keys[k] === data.code);
                if (existing)
                    settings.keys[existing] = old;
                settings.keys[data.action as keyof typeof settings.keys] = data.code;
                applySettings();
                break;
            }
            case 'defaults':
                input.cancelCalibration();
                ui.qualityReloadPending = false;
                settings = structuredClone(DEFAULT_SETTINGS);
                applySettings();
                ui.show('settings');
                break;
            case 'event-toggle':
                if (profile.day % 3 === 0 && !profile.active && !profile.pending) {
                    profile.eventRegistrationDay=profile.eventRegistrationDay===profile.day?undefined:profile.day;
                    ui.event=profile.eventRegistrationDay===profile.day;persist();
                    ui.show('events');
                    ui.toast(ui.event ? 'Event entered. Your next dive counts towards a local personal best.' : 'Event entry cancelled.');
                }
                break;
            case 'settle':
                if (profile.pending) {
                    ui.receipt = settleRun(profile, profile.pending, ui.allocation, [...ui.chosen]);
                    persist();
                    ui.event = false;
                    sim = null;
                    stack = [];
                    show('receipt');
                    try { preview(); } catch (error) { console.error('Harbour preview failed after settlement', error); }
                    audio.sfx('work');
                }
                break;
        }
    }
    catch (e) {
        ui.toast((e as Error).message);
        console.error(e);
    }
}
function processEvents() {
    if (!sim)
        return;
    const events = sim.events.splice(0);
    for (const e of events) {
        if (e.type === 'notice' && e.text)
            ui.toast(e.text);
        else if (e.type === 'sound')
            audio.sfx(e.value || 'tap');
        else if (e.type === 'work' && e.id)
            renderer!.workChanged(e.id);
        else if (e.type === 'highlight' && e.id) {
            const run = sim.run;
            renderer!.capture(e.id, image => { const clip = run.clips.find(c => c.id === e.id); if (clip && image)
                clip.image = image; persist(); });
        }
        else if (e.type === 'hit')
            audio.sfx('strike');
        else if (e.type === 'save')
            persist();
        else if (e.type === 'finish') {
            if(sim?.run.practice){endPractice();return;}
            persist();
            ui.initDebrief(sim.run);
            stack = [];
            show('debrief');
        }
    }
}
function frame(now: number) {
    if (fault)
        return;
    const actualFrameSeconds = (now - last) / 1000;
    const dt = Math.min(.083, Math.max(0, (now - last) / 1000 || .016));
    last = now;
    visualTime += dt;
    // Retain look/release/cancel edges on render frames with no simulation tick.
    // Controller look uses the simulation time actually covered by this sample.
    const inputTime = Math.min(5, Math.floor((accum + dt) * 60)) / 60;
    let f = paused || !sim ? input.sample(dt) : inputTime > 0 ? input.sample(inputTime) : EMPTY_INPUT;
    if (input.padDisconnected && watchRaised) setWatchRaised(false);
    if (ui.screen === 'settings' && hudClock > .09) { hudClock = 0; ui.updateControllerStatus(input.controllerStatus()); }
    document.body.classList.toggle('touch', input.touchMode && !input.gamepad);
    if(boat&&!paused&&!boatEntrySequence){boatRenderer?.look.update(f.lookX,f.lookY);updateBoatTravel(boat,dt,f.moveZ,f.moveX);const arrived=arrivalSite(boat);ui.updateBoat(boat,arrived&&siteUnlocked(profile,arrived)?arrived:null);if(f.interact&&!boatInteract&&arrived&&siteUnlocked(profile,arrived))dispatch('boat-dive');boatInteract=f.interact;}
    if(boatEntrySequence){
        entryStatus.hidden=paused;boatEntrySequence.advance(dt,paused);
        if(!paused){boat!.time+=dt;const t=boatEntrySequence.elapsed;
            const label=t<1.375?'Checking mask and dive gear':t<BOAT_WATER_CONTACT?'Ready — backward entry':'Entering the water';
            if(entryStatus.firstElementChild!.textContent!==label)entryStatus.firstElementChild!.textContent=label;
            if(t>=BOAT_WATER_CONTACT&&!entrySplashPlayed){entrySplashPlayed=true;audio.sfx('water-entry');}
            entryFade=Math.max(0,Math.min(1,(t-(BOAT_ENTRY_DURATION-.42))/.42));finishBoatEntry();
        }
    }else if(entryFade>0&&!document.hidden)entryFade=Math.max(0,entryFade-dt/.48);
    entryFadeElement.style.opacity=paused&&boatEntrySequence?'0':String(entryFade);
    if(entryFade>0){input.clear();f=EMPTY_INPUT;}
    if (!paused && sim) {
        accum += dt;
        let n = 0;
        while (accum >= 1 / 60 && n++ < 5) {
            sim.nativeTargets = renderer!.nativeTargets;
            sim.update(1 / 60, { ...f, lookX: n === 1 ? f.lookX : 0, lookY: n === 1 ? f.lookY : 0, release: n === 1 && f.release, cancelDraw: n === 1 && f.cancelDraw });
            accum -= 1 / 60;
            processEvents();
            if (paused)
                break;
        }
    }
    if (performanceSuggestion.update(actualFrameSeconds, visualDive && !paused && !document.hidden && !!sim && !sim.run.practice && sim.run.time > 30, !!settings.performancePromptDismissed, settings.quality)) {
        settings.performancePromptDismissed = true; store.saveSettings(settings); open('performance');
    }
    audioThrust=sampledThrust(audioThrust,visualDive&&!paused, inputTime>0,f);
    audio.update(sim?.run || null, visualDive && !paused, audioThrust, boat && !paused && !boatEntrySequence ? boat.speed : null);
    hudClock += dt;
    try {
        renderer!.setWatchReserve(sim?.reserve ?? 40);
        if(boat&&boatRenderer){boatRenderer.render(boat,boatEntrySequence?.elapsed??null);if(playCandidate&&!paused&&boat.distance>2){playCandidate=false;if(!debug)gameStarts.start();}const chart=document.getElementById('bay-chart') as HTMLCanvasElement|null;if(chart)boatRenderer.drawChart(chart,boat);}
        else renderer!.render(visualDive ? sim?.run.time ?? visualTime : visualTime, visualDive);
        if(playCandidate&&visualDive&&!paused&&sim&&!sim.run.practice&&renderer!.run===sim.run){playCandidate=false;if(!debug)gameStarts.start();}
    }
    catch (e) {
        fault = true;
        setPause(true);
        document.getElementById('loading')!.innerHTML = '<h2>The renderer stopped.</h2><p>Your most recent save is retained. Reload to resume.</p><pre></pre>';
        document.querySelector('#loading pre')!.textContent = String(e);
        document.getElementById('loading')!.style.display = 'grid';
        console.error(e);
        return;
    }
    if(!debug&&!paused&&!document.hidden&&(boat&&boat.distance>2||visualDive&&sim&&!sim.run.practice))gameStarts.activity();
    if (!paused && sim && hudClock > .09) {
        hudClock = 0;
        ui.updateHUD(sim, input.gamepad ? 'gamepad' : input.touchMode ? 'touch' : 'keyboard');
        if (watchRaised && !input.touchMode) document.getElementById('controls-hint')!.textContent = 'Watch raised · Movement and looking remain available · Lower watch before drawing the spear';
        updateWatchReadout();
        const mask=document.getElementById('mask-water')!;mask.style.setProperty('--flood',String(sim.run.maskFlood??0));mask.style.setProperty('--droplets',String(sim.run.droplets??0));
        const clearMask=document.getElementById('clear-mask') as HTMLButtonElement;clearMask.hidden=!(sim.run.maskFlood&&sim.run.maskFlood>0);clearMask.disabled=sim.run.air<2;clearMask.title=sim.run.air<2?'Clearing needs 2 bar. You can still board at your home buoy.':'Clear mask — uses 2 bar air';
        const mark = renderer!.homeMarker(), el = document.getElementById('home-marker')!;
        el.style.left = mark.x + '%';
        el.style.top = mark.y + '%';
        el.style.opacity = sim.run.time < 10 || sim.run.returnWarn || mark.behind ? '.85' : '.5';
    }
    if (debug && frameCount++ % 30 === 0) {
        const box = document.getElementById('debug-stats')!;
        box.hidden = false;
        box.textContent = JSON.stringify(renderer!.stats()) + ' ' + (sim?.run.id ?? 'harbour');
    }
    requestAnimationFrame(frame);
}
const file = document.getElementById('import-file') as HTMLInputElement;
file.addEventListener('change', async () => { try {
    const picked = file.files?.[0];
    if (!picked)
        return;
    if (picked.size > 2500000)
        throw Error('Save is too large (maximum 2.5 MB).');
    const imported = validateProfile(JSON.parse(await picked.text()));
    if (!window.confirm('Replace the current logbook with this imported save?'))
        return;
    imported.slot = profile.slot;
    profile = imported;
    sim = null;
    persist();
    ui.site = profile.active?.site || 'gardens';
    ui.night = false;
    preview();
    stack = [];
    show('dock');
    ui.toast('Logbook imported.');
}
catch (e) {
    ui.toast((e as Error).message);
}
finally {
    file.value = '';
} });
window.addEventListener('blur', () => {     if (!paused && (profile.active||boat))
    open('pause'); });
document.addEventListener('visibilitychange', () => { audio.setHidden(document.hidden); if (document.hidden && !paused && (profile.active||boat))
    open('pause'); if (document.hidden)
    persist(); });
window.addEventListener('pagehide', event => {audio.setHidden(true);persist();if(!event.persisted){unbindAudioUnlock();gameStarts.dispose();}});
window.addEventListener('pageshow', () => audio.setHidden(document.hidden));
function orientation() { document.getElementById('rotate')!.hidden = true; }
function resizeViewport() { renderer?.engine.resize(); orientation(); if (ui.screen === 'journal') ui.chart(sim && visualDive ? sim : null); }
window.addEventListener('resize', resizeViewport);
window.visualViewport?.addEventListener('resize', resizeViewport);
document.addEventListener('fullscreenchange', () => { setWatchRaised(false); input.clear(); resizeViewport(); ui.updateFullscreenState(!!document.fullscreenElement); });
canvas.addEventListener('webglcontextrestored', () => ui.toast('Graphics restored. Resume when you are ready.'));
try {
    renderer = new ReefRenderer(canvas, settings);
    renderer.onLost = () => { if (!paused)
        open('pause'); ui.toast('Graphics context lost. Progress saved. Wait for recovery or reload.'); };
    preview();
    applySettings();
    show('dock');
    document.getElementById('loading')!.style.display = 'none';
    gameStarts.markReady();
    requestAnimationFrame(frame);
    orientation();
}
catch (e) {
    document.getElementById('loading')!.innerHTML = '<div class="wordmark">Reef Sweep</div><h2>WebGL is needed to dive.</h2><p>Open this game in a browser with hardware acceleration enabled.<br>No progress has been lost.</p><pre></pre>';
    document.querySelector('#loading pre')!.textContent = String(e);
    console.error(e);
}
(window as any).render_game_to_text = () => JSON.stringify({ screen: paused ? ui.screen : boatEntrySequence ? 'entry' : boat ? 'boat' : 'dive', day: profile.day, site: sim?.run.site, position: sim?.run.p, air: sim?.run.air, catch: sim?.run.cargo.length, exposed: sim?.run.exposed?.id, aim: sim?.aim, renderer: renderer?.stats(), audio: audio.stats() });
if (debug)
    (window as any).__REEF__ = { get boatEntry() { return boatEntrySequence; }, get boatRenderer() { return boatRenderer; }, get boat() { return boat; }, get profile() { return profile; }, get sim() { return sim; }, get ui() { return ui; }, get renderer() { return renderer; }, get input() { return input; }, get audio() { return audio; }, get paused() { return paused; }, dispatch, store, tick(seconds: number, frame: Partial<InputFrame> = {}) { if (!sim)
            return; for (let i = 0; i < seconds * 60 && !sim.run.finished; i++)
            sim.update(1 / 60, { ...EMPTY_INPUT, ...frame }); processEvents(); }, aimAt(p: {
            x: number;
            y: number;
            z: number;
        }) { if (!sim)
            return; const d = sub(p, sim.run.p); sim.run.yaw = Math.atan2(d.x, d.z); sim.run.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); }, teleport(x: number, y: number, z: number) { if (!sim)
            return; sim.run.p = vec(x, y, z); sim.run.velocity = vec(); sim.collide(); }, refresh() { if (sim)
            renderer!.build(profile, sim.run); }, save: persist };

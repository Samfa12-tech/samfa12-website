(function(){const modules={"main.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resume_js_1 = require("./game/resume.js");
const tutorial_js_1 = require("./game/tutorial.js");
const campaign_js_1 = require("./game/campaign.js");
const campaign_ui_js_1 = require("./ui/campaign-ui.js");
const scooter_js_1 = require("./audio/scooter.js");
const game_start_js_1 = require("./analytics/game-start.js");
const profile_js_1 = require("./game/profile.js");
const simulation_js_1 = require("./game/simulation.js");
const data_js_1 = require("./game/data.js");
const math_js_1 = require("./game/math.js");
const renderer_js_1 = require("./render/renderer.js");
const input_js_1 = require("./input.js");
const audio_js_1 = require("./audio/audio.js");
const ui_js_1 = require("./ui/ui.js");
const canvas = document.getElementById('ocean');
const store = new profile_js_1.SaveStore();
let profile = store.load(store.selectedSlot()), settings = store.settings(), sim = null, paused = true, visualDive = false, renderer = null, stack = [], fault = false;
const audio = new audio_js_1.Soundscape(settings);
const ui = new ui_js_1.UI(() => profile, () => settings, dispatch);
const input = new input_js_1.InputController(canvas, settings, action => {
    if (action === 'pause') {
        if (!paused)
            open('pause');
        else
            close();
    }
    else if (action === 'journal') {
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
        if ((0, data_js_1.upgradeLevel)(profile, 'torch') < 1) {
            ui.toast('Install a head torch at the equipment shop.');
            return;
        }
        sim.run.light = !sim.run.light;
        sim.notice(sim.run.light ? 'Dive light on. Battery use is shared with the scooter.' : 'Dive light off.');
    }
});
input.mountTouch();
let accum = 0, last = 0, visualTime = 0, hudClock = 0, frameCount = 0;
let practiceCareer = null;
let playCandidate = false, audioThrust = 0;
const gameStarts = (0, game_start_js_1.prepareWebsiteGameStartHook)();
function endPractice() {
    profile = practiceCareer ?? profile;
    practiceCareer = null;
    sim = null;
    playCandidate = false;
    profile.active = profile.active?.practice ? null : profile.active;
    profile.pending = profile.pending?.practice ? null : profile.pending;
    visualDive = false;
    setPause(true);
    preview(profile.active?.site ?? ui.site);
    stack = [];
    ui.show('dock');
    ui.toast('Practice complete. Your campaign, catch, money and reef work are unchanged.');
}
function showMoment(moment, inDive = false) {
    if (inDive) {
        stack = ['play'];
        setPause(true);
    }
    else {
        stack = ['dock'];
        show('dock');
    }
    ui.moment = moment;
    ui.show('moment');
}
function harbourMoment() { if (practiceCareer || profile.pending || profile.active)
    return; const m = (0, campaign_ui_js_1.nextCharacterMoment)(profile); if (!m)
    return; (0, campaign_js_1.recordCharacterFlag)(profile, m.id); if (m.id === 'research-invitation')
    (0, campaign_js_1.approachResearch)(profile); persist(); showMoment(m); }
let watchRaised = false;
const debug = new URLSearchParams(location.search).has('debug') || location.hash.includes('debug') || window.REEF_TEST_MODE === true;
function persist() { if (practiceCareer)
    return; store.save(profile); const w = document.getElementById('storage-warning'); w.hidden = !store.warning; w.textContent = store.warning; }
function setWatchRaised(value) {
    const raised = value && !paused && visualDive && !!sim;
    watchRaised = raised;
    document.body.classList.toggle('watch-raised', raised);
    renderer?.setWatchRaised(raised);
    input.setWatchRaised(raised);
    const button = document.getElementById('watch-button');
    if (button) {
        button.setAttribute('aria-pressed', String(raised));
        button.setAttribute('aria-label', `${raised ? 'Lower' : 'Raise'} dive computer (${settings.keys.watch.replace('Key', '')})`);
        button.title = `${raised ? 'Lower' : 'Raise'} dive computer (${settings.keys.watch.replace('Key', '')})`;
    }
    updateWatchReadout();
}
function toggleWatch() {
    if (paused || !visualDive || !sim)
        return;
    if (!watchRaised) {
        if (sim.run.scooter)
            sim.toggleScooter();
        sim.run.charge = 0;
        sim.run.interaction = 0;
        input.cancelDraw = true;
        input.release = false;
    }
    setWatchRaised(!watchRaised);
}
function updateWatchReadout() {
    const output = document.getElementById('watch-readout');
    if (!output)
        return;
    if (!watchRaised || !sim) {
        output.textContent = `Dive computer lowered. Press ${settings.keys.watch.replace('Key', '')} or use the Watch button to raise it.`;
        return;
    }
    const run = sim.run, depth = Math.max(0, sim.site.surface - run.p.y);
    output.textContent = `Dive computer raised. Air ${Math.ceil(run.air)} bar. Depth ${depth < .05 ? 'surface' : `${depth.toFixed(1)} metres`}. Elapsed ${Math.floor(run.time / 60)} minutes ${Math.floor(run.time % 60)} seconds. Secured ${run.cargo.length} of ${(0, data_js_1.capacity)(profile)}. ${run.exposed ? "One fish remains exposed on the spear. " : ""} Battery ${Math.ceil(run.battery)} percent. Return reserve ${Math.ceil(sim.reserve)} bar. The spear is stowed; lower the watch before drawing.`;
}
function setPause(v) {
    if (v)
        setWatchRaised(false);
    paused = v;
    input.setActive(!v);
    accum = 0;
    if (sim) {
        sim.run.charge = 0;
        sim.run.interaction = 0;
    }
    audio.setPaused(v && visualDive);
    if (v)
        persist();
}
function preview(id = ui.site) {
    if (!renderer)
        return;
    const copy = structuredClone(profile);
    copy.active = null;
    copy.pending = null;
    const run = (0, simulation_js_1.startRun)(copy, (0, data_js_1.siteUnlocked)(copy, id) ? id : 'gardens');
    renderer.build(profile, run);
    visualDive = false;
}
function show(screen) {
    setPause(true);
    ui.show(screen);
    if (screen === 'saves')
        ui.slots([store.load(1), store.load(2), store.load(3)]);
    if (screen === 'journal')
        ui.chart(sim && visualDive ? sim : null);
    if (screen === 'dock')
        visualDive = false;
}
function open(screen) {
    if (screen === 'dock') {
        stack = [];
        show('dock');
        return;
    }
    stack.push(paused ? ui.screen : 'play');
    show(screen);
}
function close() {
    if (['debrief', 'receipt'].includes(ui.screen)) {
        if (profile.pending) {
            ui.toast('Allocate the catch and settle this outing first.');
            return;
        }
        stack = [];
        show('dock');
        return;
    }
    const back = stack.pop();
    if (back === 'play' && profile.active) {
        resume();
        return;
    }
    if (back) {
        show(back);
        return;
    }
    if (profile.active && visualDive)
        resume();
    else
        show('dock');
}
function resume() {
    if (!profile.active) {
        ui.toast('There is no suspended dive to resume.');
        return;
    }
    sim = (0, resume_js_1.bindSuspendedDive)(profile, sim, renderer, run => new simulation_js_1.Simulation(profile, run));
    if (!visualDive && !sim.run.practice)
        playCandidate = true;
    visualDive = true;
    setPause(false);
    stack = [];
    ui.play();
    void audio.start();
    canvas.focus();
    input.capture();
}
function begin() {
    if (profile.pending) {
        review();
        return;
    }
    if (profile.active) {
        resume();
        return;
    }
    const run = (0, simulation_js_1.startRun)(profile, ui.site, ui.order, profile.eventRegistrationDay === profile.day && profile.day % 3 === 0, ui.night);
    playCandidate = !run.practice;
    sim = new simulation_js_1.Simulation(profile, run);
    renderer.build(profile, run);
    visualDive = true;
    setPause(false);
    ui.play();
    void audio.start();
    canvas.focus();
    persist();
    if (run.site === 'passage' && run.siteRevision === 2 && (0, campaign_js_1.recordCharacterFlag)(profile, 'passage-arrival')) {
        persist();
        showMoment({ id: 'passage-arrival', speaker: 'Nia · Harbour pilot', title: 'Take the sheltered route.', text: 'Your buoy is on the western shelf. Follow the lee wall to the nursery, then cross the tide race towards Cathedral arch. The two flow gauges mark the research route. There is open water above if the current feels too strong.' }, true);
    }
    if (!paused)
        input.capture();
    ui.toast(run.night ? 'Moonlit dive. Your head torch is on; give wildlife room.' : profile.totalRemoved === 0 ? 'Welcome to Lantern Bay. The first lionfish is below and ahead. J opens your chart.' : 'Back in the water. The reef remembers your last visit.');
}
function review() {
    if (!profile.pending)
        return;
    sim = new simulation_js_1.Simulation(profile, profile.pending);
    renderer.build(profile, profile.pending);
    visualDive = true;
    ui.initDebrief(profile.pending);
    stack = [];
    show('debrief');
}
function download(name, text, type = 'application/json') { const blob = new Blob([text], { type }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function applySettings() { input.settings = settings; renderer?.configure(settings); audio.setSettings(settings); store.saveSettings(settings); document.body.classList.toggle('reduced', settings.reducedMotion); document.body.classList.toggle('instrument-hud-hidden', settings.instrumentHud === false); document.querySelector('#chart-button kbd').textContent = settings.keys.journal.replace('Key', ''); document.querySelector('#watch-button kbd').textContent = settings.keys.watch.replace('Key', ''); document.documentElement.style.setProperty('--touch-scale', String(settings.touchScale)); }
async function toggleFullscreen() {
    const doc = document, root = document.documentElement;
    const active = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
    try {
        if (active) {
            const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
            if (!exit) {
                ui.toast('This browser cannot exit fullscreen from the page.');
                return;
            }
            await exit.call(doc);
            return;
        }
        if (typeof root.requestFullscreen === 'function')
            await root.requestFullscreen({ navigationUI: 'hide' });
        else if (typeof root.webkitRequestFullscreen === 'function')
            await root.webkitRequestFullscreen();
        else {
            ui.toast('Fullscreen is unavailable in this browser.');
            return;
        }
        if (!(doc.fullscreenElement || doc.webkitFullscreenElement))
            ui.toast('The browser did not enter fullscreen.');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ui.toast(`Fullscreen was denied: ${message}`);
    }
}
function dispatch(action, data) {
    try {
        switch (action) {
            case 'screen':
                if (data === 'dock' && practiceCareer) {
                    endPractice();
                    break;
                }
                if (input.calibration && data !== 'settings')
                    input.cancelCalibration();
                open(data);
                if (data === 'dock')
                    harbourMoment();
                break;
            case 'close':
                if (input.calibration)
                    input.cancelCalibration();
                close();
                break;
            case 'site':
                ui.site = data;
                preview(data);
                ui.show('dock');
                break;
            case 'dive':
                begin();
                break;
            case 'resume':
                resume();
                break;
            case 'review':
                review();
                break;
            case 'buy':
                if ((0, profile_js_1.buy)(profile, data)) {
                    persist();
                    audio.sfx('work');
                    ui.show('gear');
                    ui.toast(data === 'scooter' ? 'The Minnow is yours. Q or Gear deploys it on your next dive.' : 'Equipment purchased. Ready for the next outing.');
                }
                else
                    ui.toast('That purchase is not available right now.');
                break;
            case 'fillet-cut-save':
                if (profile.pending && profile.pending.filletQuality === undefined)
                    profile.pending.filletCuts = Array.isArray(data) ? data.slice(0, 3) : [];
                persist();
                break;
            case 'fillet':
                (0, simulation_js_1.prepareFillets)(profile, Number(data));
                persist();
                break;
            case 'tutorial-skip':
                if (sim) {
                    (0, tutorial_js_1.skipLesson)(profile, sim.run);
                    persist();
                    ui.toast('Lesson skipped. Replay is available in the field guide.');
                }
                break;
            case 'practice':
                if (practiceCareer)
                    endPractice();
                persist();
                practiceCareer = profile;
                profile = (0, profile_js_1.freshProfile)(profile.slot);
                profile.upgrades = [...practiceCareer.upgrades];
                profile.upgradeLevels = structuredClone(practiceCareer.upgradeLevels);
                {
                    const run = (0, simulation_js_1.startRun)(profile, 'gardens', 'none');
                    run.practice = true;
                    (0, tutorial_js_1.startLesson)(run);
                    sim = new simulation_js_1.Simulation(profile, run);
                    renderer.build(profile, run);
                    visualDive = true;
                    setPause(false);
                    ui.play();
                    void audio.start();
                    canvas.focus();
                    input.capture();
                    ui.toast('Practice dive. Nothing here changes your campaign.');
                }
                break;
            case 'practice-exit':
                endPractice();
                break;
            case 'research-visit':
                if (profile.active || profile.pending) {
                    ui.toast('Finish your current outing before meeting the research team.');
                    break;
                }
                if (profile.campaign?.researchAccepted) {
                    ui.toast('The research programme is already open. Choose a station assignment at the harbour.');
                    break;
                }
                if (!profile.campaign?.researchInvitationSeen) {
                    const approach = (0, campaign_js_1.approachResearch)(profile);
                    if (!approach.ok) {
                        ui.toast(approach.reason);
                        break;
                    }
                }
                persist();
                showMoment({ id: 'research-invitation', speaker: 'Dr Mira Vale · Lantern Bay University', title: 'Will you help us read the reef?', text: 'Your field work has earned our trust. We can fund two station readings: $65 total on your first day assignment, including station pay ($72 at night). Afterwards, two-station monitoring pays $38 by day or $45 at night. In Passage, read the lee-shelf and Cathedral gauges.', research: true });
                break;
            case 'research-accept':
                {
                    const result = (0, campaign_js_1.acceptResearch)(profile);
                    persist();
                    ui.toast(result.reason);
                    close();
                }
                break;
            case 'opportunity':
                {
                    const result = (0, campaign_js_1.acceptMilestoneOpportunity)(profile, data);
                    persist();
                    ui.show('dock');
                    ui.toast(result.reason);
                }
                break;
            case 'suspend':
                if (practiceCareer) {
                    endPractice();
                    break;
                }
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
                if (practiceCareer)
                    endPractice();
                profile = (0, profile_js_1.freshProfile)(profile.slot);
                sim = null;
                persist();
                ui.event = profile.eventRegistrationDay === profile.day;
                ui.site = 'gardens';
                ui.night = false;
                preview();
                stack = [];
                show('dock');
                break;
            case 'slot':
                if (practiceCareer)
                    endPractice();
                persist();
                profile = store.load(Number(data));
                store.selectSlot(profile.slot);
                sim = null;
                ui.site = profile.active?.site || 'gardens';
                ui.night = false;
                ui.event = profile.eventRegistrationDay === profile.day;
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
                document.getElementById('import-file').click();
                break;
            case 'setting':
                {
                    const previousQuality = settings.quality;
                    settings[data.name] = data.value;
                    applySettings();
                    if (data.name === 'quality' && data.value !== previousQuality) {
                        if (data.value === 'high') {
                            persist();
                            ui.qualityReloadPending = true;
                            ui.show('settings');
                        }
                        else if (ui.qualityReloadPending) {
                            ui.qualityReloadPending = false;
                            ui.show('settings');
                        }
                    }
                }
                break;
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
                if (!input.startCalibration())
                    ui.toast('No connected controller is available. Click Scan, then press a button on the controller.');
                ui.updateControllerStatus(input.controllerStatus());
                ui.show('settings');
                break;
            case 'gamepad-cancel':
                input.cancelCalibration();
                ui.updateControllerStatus(input.controllerStatus());
                ui.show('settings');
                break;
            case 'gamepad-use':
                if (input.useCalibration()) {
                    applySettings();
                    ui.updateControllerStatus(input.controllerStatus());
                    ui.show('settings');
                }
                break;
            case 'gamepad-restore':
                input.restorePadDefaults();
                applySettings();
                ui.updateControllerStatus(input.controllerStatus());
                ui.show('settings');
                break;
            case 'binding': {
                const old = settings.keys[data.action];
                const existing = Object.keys(settings.keys).find(k => settings.keys[k] === data.code);
                if (existing)
                    settings.keys[existing] = old;
                settings.keys[data.action] = data.code;
                applySettings();
                break;
            }
            case 'defaults':
                input.cancelCalibration();
                ui.qualityReloadPending = false;
                settings = structuredClone(data_js_1.DEFAULT_SETTINGS);
                applySettings();
                ui.show('settings');
                break;
            case 'event-toggle':
                if (profile.day % 3 === 0 && !profile.active && !profile.pending) {
                    profile.eventRegistrationDay = profile.eventRegistrationDay === profile.day ? undefined : profile.day;
                    ui.event = profile.eventRegistrationDay === profile.day;
                    persist();
                    ui.show('events');
                    ui.toast(ui.event ? 'Event entered. Your next dive counts towards a local personal best.' : 'Event entry cancelled.');
                }
                break;
            case 'settle':
                if (profile.pending) {
                    ui.receipt = (0, simulation_js_1.settleRun)(profile, profile.pending, ui.allocation, [...ui.chosen]);
                    persist();
                    ui.event = false;
                    sim = null;
                    preview();
                    stack = [];
                    show('receipt');
                    audio.sfx('work');
                }
                break;
        }
    }
    catch (e) {
        ui.toast(e.message);
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
            renderer.workChanged(e.id);
        else if (e.type === 'highlight' && e.id) {
            const run = sim.run;
            renderer.capture(e.id, image => {
                const clip = run.clips.find(c => c.id === e.id);
                if (clip && image)
                    clip.image = image;
                persist();
            });
        }
        else if (e.type === 'hit')
            audio.sfx('strike');
        else if (e.type === 'save')
            persist();
        else if (e.type === 'finish') {
            if (sim?.run.practice) {
                endPractice();
                return;
            }
            persist();
            ui.initDebrief(sim.run);
            stack = [];
            show('debrief');
        }
    }
}
function frame(now) {
    if (fault)
        return;
    const dt = Math.min(.083, Math.max(0, (now - last) / 1000 || .016));
    last = now;
    visualTime += dt;
    // Retain look/release/cancel edges on render frames with no simulation tick.
    // Controller look uses the simulation time actually covered by this sample.
    const inputTime = Math.min(5, Math.floor((accum + dt) * 60)) / 60;
    const f = paused || !sim ? input.sample(dt) : inputTime > 0 ? input.sample(inputTime) : simulation_js_1.EMPTY_INPUT;
    if (input.padDisconnected && watchRaised)
        setWatchRaised(false);
    if (ui.screen === 'settings' && hudClock > .09) {
        hudClock = 0;
        ui.updateControllerStatus(input.controllerStatus());
    }
    document.body.classList.toggle('touch', input.touchMode && !input.gamepad);
    if (!paused && sim) {
        accum += dt;
        let n = 0;
        while (accum >= 1 / 60 && n++ < 5) {
            sim.nativeTargets = renderer.nativeTargets;
            sim.update(1 / 60, { ...f, lookX: n === 1 ? f.lookX : 0, lookY: n === 1 ? f.lookY : 0, release: n === 1 && f.release, cancelDraw: n === 1 && f.cancelDraw });
            accum -= 1 / 60;
            processEvents();
            if (paused)
                break;
        }
    }
    audioThrust = (0, scooter_js_1.sampledThrust)(audioThrust, visualDive && !paused, inputTime > 0, f);
    audio.update(sim?.run || null, visualDive && !paused, audioThrust);
    hudClock += dt;
    try {
        renderer.setWatchReserve(sim?.reserve ?? 40);
        renderer.render(visualDive ? sim?.run.time ?? visualTime : visualTime, visualDive);
        if (playCandidate && visualDive && !paused && sim && !sim.run.practice && renderer.run === sim.run) {
            playCandidate = false;
            if (!debug)
                gameStarts.start();
        }
    }
    catch (e) {
        fault = true;
        setPause(true);
        document.getElementById('loading').innerHTML = '<h2>The renderer stopped.</h2><p>Your most recent save is retained. Reload to resume.</p><pre></pre>';
        document.querySelector('#loading pre').textContent = String(e);
        document.getElementById('loading').style.display = 'grid';
        console.error(e);
        return;
    }
    if (!debug && visualDive && !paused && !document.hidden && sim && !sim.run.practice)
        gameStarts.activity();
    if (!paused && sim && hudClock > .09) {
        hudClock = 0;
        ui.updateHUD(sim, input.gamepad ? 'gamepad' : input.touchMode ? 'touch' : 'keyboard');
        if (watchRaised && !input.touchMode)
            document.getElementById('controls-hint').textContent = 'Watch raised · Movement and looking remain available · Lower watch before drawing the spear';
        updateWatchReadout();
        const mark = renderer.homeMarker(), el = document.getElementById('home-marker');
        el.style.left = mark.x + '%';
        el.style.top = mark.y + '%';
        el.style.opacity = sim.run.time < 10 || sim.run.returnWarn || mark.behind ? '.85' : '.5';
    }
    if (debug && frameCount++ % 30 === 0) {
        const box = document.getElementById('debug-stats');
        box.hidden = false;
        box.textContent = JSON.stringify(renderer.stats()) + ' ' + (sim?.run.id ?? 'harbour');
    }
    requestAnimationFrame(frame);
}
const file = document.getElementById('import-file');
file.addEventListener('change', async () => {
    try {
        const picked = file.files?.[0];
        if (!picked)
            return;
        if (picked.size > 2500000)
            throw Error('Save is too large (maximum 2.5 MB).');
        const imported = (0, profile_js_1.validateProfile)(JSON.parse(await picked.text()));
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
        ui.toast(e.message);
    }
    finally {
        file.value = '';
    }
});
window.addEventListener('blur', () => {
    if (!paused && profile.active)
        open('pause');
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden && !paused && profile.active)
        open('pause');
    if (document.hidden)
        persist();
});
window.addEventListener('pagehide', event => { persist(); if (!event.persisted)
    gameStarts.dispose(); });
function orientation() { document.getElementById('rotate').hidden = true; }
function resizeViewport() { renderer?.engine.resize(); orientation(); }
window.addEventListener('resize', resizeViewport);
window.visualViewport?.addEventListener('resize', resizeViewport);
document.addEventListener('fullscreenchange', () => { setWatchRaised(false); input.clear(); resizeViewport(); ui.updateFullscreenState(!!document.fullscreenElement); });
canvas.addEventListener('webglcontextrestored', () => ui.toast('Graphics restored. Resume when you are ready.'));
try {
    renderer = new renderer_js_1.ReefRenderer(canvas, settings);
    renderer.onLost = () => {
        if (!paused)
            open('pause');
        ui.toast('Graphics context lost. Progress saved. Wait for recovery or reload.');
    };
    preview();
    applySettings();
    show('dock');
    document.getElementById('loading').style.display = 'none';
    gameStarts.markReady();
    requestAnimationFrame(frame);
    orientation();
}
catch (e) {
    document.getElementById('loading').innerHTML = '<div class="wordmark">Reef Sweep</div><h2>WebGL is needed to dive.</h2><p>Open this game in a browser with hardware acceleration enabled.<br>No progress has been lost.</p><pre></pre>';
    document.querySelector('#loading pre').textContent = String(e);
    console.error(e);
}
window.render_game_to_text = () => JSON.stringify({ screen: paused ? ui.screen : 'dive', day: profile.day, site: sim?.run.site, position: sim?.run.p, air: sim?.run.air, catch: sim?.run.cargo.length, exposed: sim?.run.exposed?.id, aim: sim?.aim, renderer: renderer?.stats(), audio: audio.stats() });
if (debug)
    window.__REEF__ = { get profile() { return profile; }, get sim() { return sim; }, get ui() { return ui; }, get renderer() { return renderer; }, get input() { return input; }, get audio() { return audio; }, get paused() { return paused; }, dispatch, store, tick(seconds, frame = {}) {
            if (!sim)
                return;
            for (let i = 0; i < seconds * 60 && !sim.run.finished; i++)
                sim.update(1 / 60, { ...simulation_js_1.EMPTY_INPUT, ...frame });
            processEvents();
        }, aimAt(p) {
            if (!sim)
                return;
            const d = (0, math_js_1.sub)(p, sim.run.p);
            sim.run.yaw = Math.atan2(d.x, d.z);
            sim.run.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
        }, teleport(x, y, z) {
            if (!sim)
                return;
            sim.run.p = (0, math_js_1.vec)(x, y, z);
            sim.run.velocity = (0, math_js_1.vec)();
            sim.collide();
        }, refresh() {
            if (sim)
                renderer.build(profile, sim.run);
        }, save: persist };

},
"game/resume.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bindSuspendedDive = bindSuspendedDive;
/** The renderer may have been rebound to a harbour preview while simulation is suspended. */
function bindSuspendedDive(profile, current, renderer, create) {
    if (!profile.active)
        throw Error('There is no suspended dive to resume.');
    const sim = current?.run === profile.active ? current : create(profile.active);
    if (renderer.run !== sim.run)
        renderer.build(profile, sim.run);
    return sim;
}

},
"game/tutorial.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LESSON_STEPS = void 0;
exports.startLesson = startLesson;
exports.lessonActive = lessonActive;
exports.advanceLesson = advanceLesson;
exports.skipLesson = skipLesson;
exports.lessonPrompt = lessonPrompt;
exports.LESSON_STEPS = 7;
function startLesson(run) { run.lesson = { step: 0, look: 0, move: 0, drawn: false }; }
function lessonActive(run) { return !!run.lesson && !run.lesson.skipped && run.lesson.step < exports.LESSON_STEPS; }
/** Accumulate intentional inputs; currents and elapsed time cannot complete a lesson. */
function advanceLesson(profile, run, input, dt, aimedAtFish) {
    const lesson = run.lesson;
    if (!lessonActive(run) || !lesson)
        return false;
    lesson.look = Math.min(10, lesson.look + Math.abs(input.lookX) + Math.abs(input.lookY));
    if (Math.abs(input.moveX) + Math.abs(input.moveZ) + Math.abs(input.vertical) > .1)
        lesson.move = Math.min(100, lesson.move + dt);
    if (input.cancelDraw)
        lesson.drawn = false;
    else if (input.draw && run.charge >= .65)
        lesson.drawn = true;
    const complete = [lesson.look >= .15, lesson.move >= .8, aimedAtFish, run.removed > 0, run.cargo.length > 0, run.cleaned + run.restored > 0, run.finished && !run.rescued][lesson.step];
    if (!complete)
        return false;
    lesson.step++;
    if (lesson.step >= exports.LESSON_STEPS)
        profile.tutorial = Math.max(profile.tutorial, 1);
    return true;
}
function skipLesson(profile, run) { if (run.lesson)
    run.lesson.skipped = true; profile.tutorial = Math.max(profile.tutorial, 1); }
function lessonPrompt(run, mode, settings) {
    const k = (name) => settings.keys[name].replace('Key', '').replace('Left', '');
    const look = mode === 'touch' ? 'Drag the water to look around.' : mode === 'gamepad' ? 'Move the right stick to look around.' : 'Move the mouse to look around.';
    const move = mode === 'touch' ? 'Use the left thumb stick to swim.' : mode === 'gamepad' ? 'Use the left stick to swim.' : `${k('forward')}${k('left')}${k('back')}${k('right')} swims. Try moving a little.`;
    const draw = mode === 'touch' ? 'Hold Draw, aim, then release to strike.' : mode === 'gamepad' ? 'Hold your mapped spear control, then release to strike.' : 'Hold the mouse button to draw, then release to strike.';
    const interact = mode === 'touch' ? 'Hold Interact' : mode === 'gamepad' ? 'Hold your mapped Interact control' : `Hold ${k('interact')}`;
    const messages = [look, move, 'Approach a lionfish slowly. Get the aiming reticle within spear range.', draw, `${interact} to secure the fish in your tube.`, `${interact} beside discarded fishing gear or a nursery plot.`, `Follow HOME, ascend beside your buoy, then ${interact.toLowerCase()} to board.`];
    return messages[run.lesson?.step ?? 0] ?? 'First dive complete. The reef is yours to explore.';
}

},
"game/campaign.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAREER_MILESTONES = void 0;
exports.validateCampaign = validateCampaign;
exports.normalizeCampaign = normalizeCampaign;
exports.researchEligibility = researchEligibility;
exports.approachResearch = approachResearch;
exports.acceptResearch = acceptResearch;
exports.contractOptions = contractOptions;
exports.recordSurveyStation = recordSurveyStation;
exports.surveyPayout = surveyPayout;
exports.researchSettlement = researchSettlement;
exports.completeResearch = completeResearch;
exports.acceptMilestoneOpportunity = acceptMilestoneOpportunity;
exports.milestoneObjectiveStatus = milestoneObjectiveStatus;
exports.milestoneStatus = milestoneStatus;
exports.claimMilestone = claimMilestone;
exports.recordCharacterFlag = recordCharacterFlag;
exports.nextUpgradeBenefit = nextUpgradeBenefit;
const data_js_1 = require("./data.js");
const RESEARCH_REPUTATION = 8;
const RESEARCH_DAY_TOTAL = 65;
const RESEARCH_NIGHT_TOTAL = 72;
const MONITORING_DAY_TOTAL = 38;
const MONITORING_NIGHT_TOTAL = 45;
const REQUIRED_CAMPAIGN_FIELDS = ['researchInvitationSeen', 'researchAccepted', 'researchCompleted', 'characterFlags', 'milestoneFlags'];
const OPTIONAL_CAMPAIGN_FIELDS = ['activeOpportunity', 'activeOpportunityDay', 'activeOpportunityPublishedAt', 'activeOpportunityCleanedAt'];
const emptyCampaign = () => ({
    researchInvitationSeen: false,
    researchAccepted: false,
    researchCompleted: false,
    characterFlags: [],
    milestoneFlags: []
});
/** Validate the optional schema-1 extension without accepting unbounded or ambiguous state. */
function validateCampaign(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw Error('Invalid campaign state.');
    const source = value;
    const fields = new Set([...REQUIRED_CAMPAIGN_FIELDS, ...OPTIONAL_CAMPAIGN_FIELDS]);
    if (REQUIRED_CAMPAIGN_FIELDS.some(key => !(key in source)) || Object.keys(source).some(key => !fields.has(key)))
        throw Error('Invalid campaign fields.');
    for (const key of ['researchInvitationSeen', 'researchAccepted', 'researchCompleted']) {
        if (typeof source[key] !== 'boolean')
            throw Error('Invalid campaign flag: ' + key);
    }
    const validFlags = (v) => Array.isArray(v) && v.length <= 100 && v.every(flag => typeof flag === 'string' && flag.length > 0 && flag.length <= 80 && /^[a-z0-9][a-z0-9-]*$/i.test(flag)) && new Set(v).size === v.length;
    if (!validFlags(source.characterFlags) || !validFlags(source.milestoneFlags))
        throw Error('Invalid campaign recognition flags.');
    if (source.researchAccepted && !source.researchInvitationSeen)
        throw Error('Research cannot be accepted before its invitation.');
    if (source.researchCompleted && !source.researchAccepted)
        throw Error('Research cannot be completed before acceptance.');
    const hasOpportunity = source.activeOpportunity !== undefined;
    const snapshots = ['activeOpportunityDay', 'activeOpportunityPublishedAt', 'activeOpportunityCleanedAt'];
    if (hasOpportunity) {
        if (!['recognition-80', 'recognition-160', 'recognition-300'].includes(String(source.activeOpportunity)) || !Number.isInteger(source.activeOpportunityDay) || !Number.isInteger(source.activeOpportunityPublishedAt) || !Number.isInteger(source.activeOpportunityCleanedAt) || Number(source.activeOpportunityDay) < 1 || Number(source.activeOpportunityDay) > 1e6 || Number(source.activeOpportunityPublishedAt) < 0 || Number(source.activeOpportunityPublishedAt) > 1000 || Number(source.activeOpportunityCleanedAt) < 0 || Number(source.activeOpportunityCleanedAt) > 1e8)
            throw Error('Invalid active career opportunity.');
    }
    else if (snapshots.some(key => source[key] !== undefined))
        throw Error('Career opportunity snapshots need an active opportunity.');
    return structuredClone(source);
}
/** Supply campaign defaults and grandfather careers that already used research. */
function normalizeCampaign(profile) {
    const existingResearch = [profile.active, profile.pending].some(run => run?.order === 'research');
    if (profile.campaign !== undefined) {
        const state = validateCampaign(profile.campaign);
        if (existingResearch && !state.researchCompleted) {
            state.researchInvitationSeen = true;
            state.researchAccepted = true;
        }
        return state;
    }
    const priorSurvey = Object.values(profile.reefs ?? {}).some(reef => (reef?.surveys ?? 0) > 0 || (reef?.surveyedStations?.length ?? 0) > 0);
    const state = emptyCampaign();
    if (priorSurvey || existingResearch) {
        state.researchInvitationSeen = true;
        state.researchAccepted = true;
    }
    return state;
}
function researchEligibility(profile) {
    const campaign = profile.campaign ?? normalizeCampaign(profile);
    if (campaign.researchAccepted && campaign.researchCompleted)
        return { eligible: true, reason: 'The funded assignment is complete; repeat two-station Monitoring remains available.' };
    if (campaign.researchAccepted)
        return { eligible: true, reason: 'The funded two-station assignment is ready to choose.' };
    if (profile.reputation < RESEARCH_REPUTATION)
        return { eligible: false, reason: `Earn ${RESEARCH_REPUTATION} professional reputation to meet the research team.` };
    if (!campaign.researchInvitationSeen)
        return { eligible: false, reason: 'A research invitation is available in person at the harbour.' };
    return { eligible: false, reason: 'Accept the research invitation at the harbour before selecting the assignment.' };
}
function approachResearch(profile) {
    const campaign = profile.campaign ?? (profile.campaign = normalizeCampaign(profile));
    if (campaign.researchCompleted)
        return { ok: false, reason: 'The research team has already funded this assignment.' };
    if (campaign.researchInvitationSeen)
        return { ok: false, reason: campaign.researchAccepted ? 'The invitation has already been accepted.' : 'The research invitation is already waiting at the harbour.' };
    if (profile.reputation < RESEARCH_REPUTATION)
        return { ok: false, reason: `The research team needs ${RESEARCH_REPUTATION} professional reputation first.` };
    campaign.researchInvitationSeen = true;
    return { ok: true, reason: 'The research team invited you to discuss a funded two-station assignment.' };
}
function acceptResearch(profile) {
    const campaign = profile.campaign ?? (profile.campaign = normalizeCampaign(profile));
    if (campaign.researchCompleted)
        return { ok: false, reason: 'The funded research assignment is already complete.' };
    if (campaign.researchAccepted)
        return { ok: false, reason: 'The funded research assignment is already accepted.' };
    if (!campaign.researchInvitationSeen)
        return { ok: false, reason: 'Meet the research team and hear the invitation before accepting.' };
    campaign.researchAccepted = true;
    return { ok: true, reason: 'You accepted the funded assignment: record two distinct field stations in one outing.' };
}
function remainingLionfish(profile, siteId) {
    const site = data_js_1.SITES[siteId];
    const reef = profile.reefs[siteId];
    const homes = (0, data_js_1.reefFishHomes)(site, site.seed);
    // On visits four and later, the first four habitat slots are replaced by
    // the current return cohort; they are not four extra fish on top of the
    // authored population.
    const cohort = Math.floor(reef.visits / 4);
    const ids = homes.map((_, i) => reef.visits >= 4 && i < 4 ? `return-${cohort}-${i}` : `fish-${i}`);
    return ids.filter(id => !reef.removed.includes(id)).length;
}
function contractOptions(profile, siteId) {
    const site = data_js_1.SITES[siteId];
    const reef = profile.reefs[siteId];
    const fish = remainingLionfish(profile, siteId);
    const cleanup = Math.max(0, (site.worksites?.debris.length ?? 0) - reef.cleaned.length);
    const restoration = Math.max(0, (site.worksites?.coral.length ?? 0) - Object.keys(reef.restored).length);
    const research = researchEligibility(profile);
    const stationCount = (site.worksites?.surveys.length ?? 0) + 2;
    const researchAvailable = research.eligible && stationCount >= 2;
    const catchAvailable = fish >= 4;
    const cleanupAvailable = cleanup >= 2;
    const restorationAvailable = restoration >= 2;
    return [
        { kind: 'catch', available: catchAvailable, remaining: fish, reason: catchAvailable ? `${fish} lionfish remain at this site.` : fish > 0 ? `Only ${fish} lionfish remain; the Kitchen order needs four fish to sell.` : 'No lionfish remain at this site today.' },
        { kind: 'cleanup', available: cleanupAvailable, remaining: cleanup, reason: cleanupAvailable ? `${cleanup} permanent debris patches remain.` : cleanup > 0 ? `Only ${cleanup} debris patch remains; the cleanup order needs two.` : 'All authored debris has been removed.' },
        { kind: 'restore', available: restorationAvailable, remaining: restoration, reason: restorationAvailable ? `${restoration} restoration plots remain unplanted.` : restoration > 0 ? `Only ${restoration} restoration plot remains; the planting order needs two.` : 'All restoration plots are planted.' },
        { kind: 'research', available: researchAvailable, remaining: researchAvailable ? 2 : 0, reason: researchAvailable ? (profile.campaign?.researchCompleted ? 'Record two distinct field stations for a repeat Monitoring contract.' : 'Record two distinct field stations for the funded assignment.') : research.reason },
        { kind: 'none', available: true, reason: 'Dive without a contract.' }
    ];
}
/** Persist first-ever site visits and the per-run snapshot before calculating payment. */
function recordSurveyStation(profile, run, stationId) {
    if (!/^survey-\d+$/.test(stationId))
        return { ok: false, firstVisit: false, reason: 'Unknown field station.' };
    const reef = profile.reefs[run.site];
    reef.surveyedStations ?? (reef.surveyedStations = []);
    run.surveyFirstVisits ?? (run.surveyFirstVisits = []);
    run.surveyStations ?? (run.surveyStations = []);
    if (run.surveyStations.includes(stationId))
        return { ok: false, firstVisit: false, reason: 'This station has already been surveyed during this outing.' };
    const firstVisit = !reef.surveyedStations.includes(stationId);
    run.surveyStations.push(stationId);
    if (firstVisit) {
        reef.surveyedStations.push(stationId);
        run.surveyFirstVisits.push(stationId);
    }
    return { ok: true, firstVisit, reason: firstVisit ? 'First survey recorded at this station.' : 'Repeat station survey recorded.' };
}
/** Calculate station pay only; a funded assignment's top-up is handled separately. */
function surveyPayout(run, reef) {
    const surveyed = Math.max(0, Math.min(3, Math.floor(run.surveyed)));
    const firstIds = new Set(run.surveyFirstVisits ?? []);
    const firstVisitPay = Math.min(surveyed, firstIds.size) * 18;
    const repeatPay = (surveyed - Math.min(surveyed, firstIds.size)) * 6;
    // For legacy active runs without a first-visit snapshot, assume repeat rate to avoid back-paying unknown history.
    const nightUplift = run.night ? surveyed * 2 : 0;
    void reef;
    return { stationPay: firstVisitPay + repeatPay + nightUplift, firstVisitPay, repeatPay, nightUplift, stationsPaid: surveyed };
}
/** The one-time grant tops station earnings up to a fixed inclusive assignment total. */
function researchSettlement(run, profile) {
    const station = surveyPayout({ ...run, surveyed: Math.min(2, run.surveyed) }, profile.reefs[run.site]);
    const campaign = profile.campaign ?? normalizeCampaign(profile);
    const legacyRun = run.siteRevision === undefined && run.researchFunded === undefined;
    const distinctStations = run.surveyStations?.length ?? (legacyRun ? run.surveyed : 0);
    // An older suspended research dive had no funding snapshot. Treat it as the
    // first assignment only when the profile has not already been paid for it.
    const funded = run.researchFunded ?? !campaign.researchCompleted;
    let reason = 'The funded assignment needs two distinct stations in one safely completed outing.';
    let eligible = false;
    if (run.order !== 'research')
        reason = 'This outing was not registered as a research assignment.';
    else if (run.rescued)
        reason = 'Rescue preserves reef work but does not settle contract pay.';
    else if (run.researchEligible === false && !(run.researchEligible === undefined && campaign.researchAccepted))
        reason = 'The research assignment was not eligible when this outing began.';
    else if (funded && campaign.researchCompleted)
        reason = 'The funded research assignment has already been paid; choose Monitoring for repeat work.';
    else if (run.surveyed < 2 || distinctStations < 2)
        reason = `Record ${Math.max(0, 2 - Math.min(Math.floor(run.surveyed), distinctStations))} more distinct station${run.surveyed === 1 ? '' : 's'} to complete the assignment.`;
    else if (!campaign.researchAccepted)
        reason = 'Accept the research invitation before starting the funded assignment.';
    else {
        eligible = true;
        reason = funded
            ? 'Two-station funded assignment settled; station pay is included in the $65 day / $72 night total.'
            : 'Two-station Monitoring settled; repeat station pay is included in the $38 day / $45 night total.';
    }
    const target = funded ? (run.night ? RESEARCH_NIGHT_TOTAL : RESEARCH_DAY_TOTAL) : (run.night ? MONITORING_NIGHT_TOTAL : MONITORING_DAY_TOTAL);
    const assignmentTopUp = eligible ? Math.max(0, target - station.stationPay) : 0;
    return { ...station, eligible, funded, reason, assignmentTopUp, total: station.stationPay + assignmentTopUp };
}
/** Persist the one-time funded-assignment completion after its settlement is applied. */
function completeResearch(profile, settlement) {
    if (!settlement.eligible)
        return { ok: false, reason: settlement.reason };
    if (!settlement.funded)
        return { ok: true, reason: 'Monitoring is repeatable and does not change the funded-assignment flag.' };
    const campaign = profile.campaign ?? (profile.campaign = normalizeCampaign(profile));
    if (campaign.researchCompleted)
        return { ok: false, reason: 'The funded research assignment has already been recorded.' };
    if (!campaign.researchAccepted)
        return { ok: false, reason: 'The research invitation was not accepted.' };
    campaign.researchCompleted = true;
    return { ok: true, reason: 'The funded two-station assignment is complete.' };
}
exports.CAREER_MILESTONES = [
    { id: 'recognition-80', audience: 80, reputation: 4, title: 'Lantern Bay Field Photographer', objective: 'Publish a peaceful wildlife highlight.' },
    { id: 'recognition-160', audience: 160, reputation: 8, title: 'Reef Storyteller', objective: 'Complete a cleanup and publish its highlight.' },
    { id: 'recognition-300', audience: 300, reputation: 17, title: 'Lantern Bay Conservation Voice', objective: 'Visit a reef on a later day and publish a new highlight.' }
];
function allDebrisCleared(profile) { return Object.values(data_js_1.SITES).every(site => profile.reefs[site.id].cleaned.length >= (site.worksites?.debris.length ?? 0)); }
function recognitionDescription(profile, milestone) { return milestone.id === 'recognition-160' && allDebrisCleared(profile) ? 'The debris is already cleared. Publish a peaceful wildlife highlight to show what that work made possible.' : milestone.objective; }
function opportunityMissing(profile, milestone) {
    return [
        profile.audience < milestone.audience ? `${milestone.audience} followers` : '',
        profile.reputation < milestone.reputation ? `${milestone.reputation} reputation` : ''
    ].filter(Boolean);
}
function acceptMilestoneOpportunity(profile, id) {
    const milestone = exports.CAREER_MILESTONES.find(item => item.id === id);
    const campaign = profile.campaign ?? (profile.campaign = normalizeCampaign(profile));
    if (campaign.milestoneFlags.includes(id))
        return { ok: false, reason: 'This recognition has already been earned.' };
    if (campaign.activeOpportunity)
        return { ok: false, reason: `Finish ${campaign.activeOpportunity} before taking another assignment.` };
    const missing = opportunityMissing(profile, milestone);
    if (missing.length)
        return { ok: false, reason: 'Still needed: ' + missing.join(', ') + '.' };
    campaign.activeOpportunity = id;
    campaign.activeOpportunityDay = profile.day;
    campaign.activeOpportunityPublishedAt = profile.published.length;
    campaign.activeOpportunityCleanedAt = profile.totalCleaned;
    return { ok: true, reason: `Assignment accepted: ${recognitionDescription(profile, milestone)}` };
}
function milestoneObjectiveStatus(profile, id) {
    const campaign = profile.campaign ?? normalizeCampaign(profile);
    const active = campaign.activeOpportunity === id;
    const publishedAfterAcceptance = active ? profile.published.slice(campaign.activeOpportunityPublishedAt ?? profile.published.length) : [];
    let complete = false;
    let reason = 'Accept this assignment to begin its objective.';
    if (active && id === 'recognition-80') {
        complete = publishedAfterAcceptance.some(kind => ['marlow', 'turtle', 'ray'].includes(kind));
        reason = complete ? 'A peaceful wildlife highlight was published.' : 'Publish a peaceful wildlife highlight (Marlow, turtle or ray).';
    }
    else if (active && id === 'recognition-160') {
        const cleanedSince = profile.totalCleaned - (campaign.activeOpportunityCleanedAt ?? profile.totalCleaned);
        const clearReefStory = allDebrisCleared(profile) && publishedAfterAcceptance.some(kind => ['marlow', 'turtle', 'ray'].includes(kind));
        complete = (cleanedSince > 0 && publishedAfterAcceptance.includes('cleanup')) || clearReefStory;
        reason = complete ? 'Your cleared reef and new highlight have been recognised.' : allDebrisCleared(profile) ? 'The debris stays cleared. Publish a peaceful wildlife highlight from the recovering reef.' : 'Remove debris and publish a cleanup highlight.';
    }
    else if (active && id === 'recognition-300') {
        const acceptedDay = campaign.activeOpportunityDay ?? profile.day;
        const recordedLaterVisit = Object.values(profile.reefs).some(reef => reef.lastDay > acceptedDay && reef.lastDay <= profile.day);
        // Settlement evaluates recognition before it advances ReefProgress.lastDay.
        // Count the safe outing being settled, but never a same-day visit or rescue.
        const settlingLaterVisit = profile.pending?.finished === true && !profile.pending.rescued && profile.pending.day > acceptedDay;
        const visitedLater = recordedLaterVisit || settlingLaterVisit;
        complete = visitedLater && publishedAfterAcceptance.length > 0;
        reason = complete ? 'A later reef visit and new published highlight are complete.' : 'Return to a reef on a later day and publish a new highlight.';
    }
    return { active, complete, reason };
}
function milestoneStatus(profile, id) {
    const milestone = exports.CAREER_MILESTONES.find(item => item.id === id);
    const campaign = profile.campaign ?? normalizeCampaign(profile);
    const achieved = campaign.milestoneFlags.includes(id);
    const missing = opportunityMissing(profile, milestone);
    const objective = milestoneObjectiveStatus(profile, id);
    return { milestone, description: recognitionDescription(profile, milestone), achieved, available: !achieved && objective.active && objective.complete && missing.length === 0, missing, objective, recognitionOnly: true };
}
/** Record a one-time recognition flag. Recognition never changes cash or reputation. */
function claimMilestone(profile, id) {
    const campaign = profile.campaign ?? (profile.campaign = normalizeCampaign(profile));
    const status = milestoneStatus(profile, id);
    if (status.achieved)
        return { ok: false, reason: 'This recognition has already been recorded.' };
    if (!status.available)
        return { ok: false, reason: status.missing.length ? 'Still needed: ' + status.missing.join(', ') + '.' : status.objective.reason };
    campaign.milestoneFlags.push(id);
    campaign.activeOpportunity = undefined;
    campaign.activeOpportunityDay = undefined;
    campaign.activeOpportunityPublishedAt = undefined;
    campaign.activeOpportunityCleanedAt = undefined;
    return { ok: true, reason: `Recognition awarded: ${status.milestone.title}.` };
}
/** Persist a bounded one-time character beat without conflating it with reputation. */
function recordCharacterFlag(profile, id) {
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/i.test(id))
        return false;
    const campaign = profile.campaign ?? (profile.campaign = normalizeCampaign(profile));
    if (campaign.characterFlags.includes(id))
        return false;
    if (campaign.characterFlags.length >= 100)
        return false;
    campaign.characterFlags.push(id);
    return true;
}
/** Numeric next-rank effects for upgrade cards; unknown/non-numeric lines return null. */
function nextUpgradeBenefit(profile, id) {
    if (!data_js_1.UPGRADES.some(upgrade => upgrade.id === id))
        return null;
    const currentRank = (0, data_js_1.upgradeLevel)(profile, id);
    if (currentRank >= 5)
        return null;
    const nextRank = currentRank + 1;
    switch (id) {
        case 'fins': return { currentRank, nextRank, label: 'base fin speed bonus', value: nextRank * 12, unit: '%' };
        case 'tube': return { currentRank, nextRank, label: 'secured fish capacity', value: 10 + nextRank * 2, unit: 'fish' };
        case 'spear': return { currentRank, nextRank, label: 'pole-spear reach', value: Number((3 + nextRank * .45).toFixed(2)), unit: 'm' };
        case 'air': return { currentRank, nextRank, label: 'air capacity', value: 200 + Math.max(0, nextRank - 1) * 30, unit: 'units' };
        case 'camera': return { currentRank, nextRank, label: 'highlight quality', value: nextRank * 8, unit: 'points' };
        case 'kit': return { currentRank, nextRank, label: 'nursery fragments', value: 3 + nextRank * 2, unit: 'per dive' };
        default: return null;
    }
}

},
"game/data.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_UPGRADE_LEVEL = exports.UPGRADES = exports.DEFAULT_SETTINGS = exports.DEFAULT_KEYS = exports.SITES = void 0;
exports.siteForRun = siteForRun;
exports.siteTerrainKey = siteTerrainKey;
exports.floorHeight = floorHeight;
exports.currentAt = currentAt;
exports.freePoint = freePoint;
exports.groundPoint = groundPoint;
exports.upgradeLevel = upgradeLevel;
exports.upgradeCost = upgradeCost;
exports.upgradeServiceRequirement = upgradeServiceRequirement;
exports.capacity = capacity;
exports.airCapacity = airCapacity;
exports.spearReach = spearReach;
exports.wreckAnchor = wreckAnchor;
exports.pipeAnchor = pipeAnchor;
exports.healthOfReef = healthOfReef;
exports.siteUnlocked = siteUnlocked;
exports.siteUnlockText = siteUnlockText;
exports.reefFishHomes = reefFishHomes;
const math_js_1 = require("./math.js");
const rock = (id, x, z, sx, sy, sz, tint = 0, form = 'rock') => ({
    id, p: (0, math_js_1.vec)(x, sy * .4, z), s: (0, math_js_1.vec)(sx, sy, sz), tint, form
});
const ellipsoid = (id, x, y, z, sx, sy, sz, form, tint = 0) => ({
    id, p: (0, math_js_1.vec)(x, y, z), s: (0, math_js_1.vec)(sx, sy, sz), tint, form
});
const rootCluster = (id, x, z, offsets, tint = 0) => offsets.flatMap(([dx, dz], i) => [
    ellipsoid(`${id}-trunk-${i}`, x + dx, 8.8, z + dz, .48, 12.3, .48, 'root', tint),
    ellipsoid(`${id}-buttress-${i}`, x + dx, -.8, z + dz, 1.45, 2.7, 1.35, 'root', tint)
]);
const anchors = (debris, coral, surveys = []) => ({
    debris: debris.map(([x, z]) => (0, math_js_1.vec)(x, 0, z)),
    coral: coral.map(([x, z]) => (0, math_js_1.vec)(x, 0, z)),
    surveys: surveys.map(([x, z]) => (0, math_js_1.vec)(x, 0, z))
});
const gardenRocks = [rock('west-ledge', -11, -25, 7, 3.8, 6), rock('east-head', 12, -22, 7, 4.6, 6, 1), rock('nursery-wall', -18, -7, 5, 6, 8), rock('arch-left', 10, 5, 4, 6, 5), rock('arch-right', 23, 5, 4, 6, 5), { id: 'arch-crown', p: (0, math_js_1.vec)(16.5, 9, 5), s: (0, math_js_1.vec)(8, 2, 4), tint: 1, form: 'rock' }, rock('grouper-home', -19, 15, 7, 6, 7, 1), rock('north-head', 6, 31, 8, 6, 7), rock('outer-east', 34, 23, 7, 5, 11), rock('outer-west', -38, 1, 9, 5, 12), rock('far-west', -30, 40, 10, 7, 9), rock('far-east', 33, 45, 11, 6, 9)];
const passageRocks = [rock('entry-left', -13, -32, 8, 5, 6), rock('entry-right', 14, -29, 8, 6, 6), rock('west-wall', -17, -6, 7, 10, 12), rock('east-wall', 18, -2, 7, 10, 12, 1), rock('split-west', -12, 26, 7, 9, 9), rock('split-east', 13, 26, 7, 8, 8), { id: 'passage-crown', p: (0, math_js_1.vec)(0, 15, 26), s: (0, math_js_1.vec)(15, 2.5, 5), tint: 1, form: 'rock' }, rock('outer-head', 34, 13, 9, 8, 12), rock('outer-west', -37, 29, 10, 7, 13), rock('north', 2, 53, 15, 8, 9)];
const mangroveRocks = [
    ...rootCluster('root-west-bank', -17, -24, [[-2, -4], [1, -2], [-1, 1], [2, 4]]),
    ...rootCluster('root-east-bank', 17, -21, [[-2, -4], [1, -2], [-1, 1], [2, 4]], 1),
    ...rootCluster('root-northwest-bank', -24, 1, [[-2, -3], [1, -1], [-1, 2], [2, 4]], 1),
    ...rootCluster('root-northeast-bank', 23, 4, [[-2, -3], [1, -1], [-1, 2], [2, 4]]),
    ellipsoid('sandbar-rock-west', -33, -0.2, 25, 6, 2, 9, 'rock'),
    ellipsoid('sandbar-rock-east', 34, -0.1, 23, 6, 2, 10, 'rock', 1)
];
const cenoteRocks = [
    ellipsoid('limestone-west-shoulder', -31, -2, -6, 7, 15, 19, 'limestone'),
    ellipsoid('limestone-east-shoulder', 31, -1, -2, 7, 16, 20, 'limestone', 1),
    ellipsoid('limestone-south-pillar', -19, 2, 24, 5, 17, 10, 'limestone', 1),
    ellipsoid('limestone-east-pillar', 20, 1, 29, 5, 16, 9, 'limestone'),
    ellipsoid('limestone-west-alcove', -24, -3, 39, 8, 13, 8, 'limestone'),
    ellipsoid('limestone-east-alcove', 28, -2, 42, 8, 13, 8, 'limestone', 1),
    ellipsoid('limestone-rim-west', -43, 3, -35, 6, 12, 12, 'limestone'),
    ellipsoid('limestone-rim-east', 43, 3, -35, 6, 12, 12, 'limestone', 1)
];
const harbourRocks = [
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
exports.SITES = {
    gardens: {
        id: 'gardens', name: 'Sunlit Gardens', eyebrow: 'LANTERN BAY / SITE 01', description: 'Warm shallows, a coral nursery and a familiar face beneath the ledges.',
        surface: 18, radius: 68, seed: 120726, entry: (0, math_js_1.vec)(0, 8, -41), current: .18, channelX: 18, rocks: gardenRocks,
        landmarks: [{ name: 'Home buoy', p: (0, math_js_1.vec)(0, 17, -44), kind: 'boat' }, { name: 'The nursery', p: (0, math_js_1.vec)(-9, 2, -7), kind: 'coral' }, { name: 'Marlow’s ledge', p: (0, math_js_1.vec)(-19, 6, 15), kind: 'wildlife' }, { name: 'Sun arch', p: (0, math_js_1.vec)(16, 7, 5), kind: 'landmark' }],
        worksites: anchors([[-4, -31], [6, -11], [-8, 7], [24, 20], [-25, 29]], [[-7, -8], [-5, -6], [-9, -5]], [[-7, -10]]),
        deepFeatures: { wreck: (0, math_js_1.vec)(34, 0, -40), outfall: (0, math_js_1.vec)(43, 0, -29) }
    },
    passage: {
        id: 'passage', name: 'Tideglass Passage', eyebrow: 'LANTERN BAY / SITE 02', description: 'Tall reef walls and a flowing channel. Find shelter before you commit.',
        surface: 25, radius: 74, seed: 741309, entry: (0, math_js_1.vec)(0, 12, -44), current: .42, channelX: 0, rocks: passageRocks,
        landmarks: [{ name: 'Home buoy', p: (0, math_js_1.vec)(0, 24, -47), kind: 'boat' }, { name: 'Restoration shelf', p: (0, math_js_1.vec)(-4, 2, -4), kind: 'coral' }, { name: 'The throat', p: (0, math_js_1.vec)(0, 10, 10), kind: 'current' }, { name: 'Cathedral arch', p: (0, math_js_1.vec)(0, 12, 26), kind: 'landmark' }],
        worksites: anchors([[-4, -29], [5, -12], [-3, 7], [8, 40]], [[-4, -3], [-2, -1], [-6, 0]], [[-3, -5]]),
        deepFeatures: { wreck: (0, math_js_1.vec)(34, 0, -40), outfall: (0, math_js_1.vec)(46, 0, -29) }
    },
    mangrove: {
        id: 'mangrove', name: 'Mangrove Reach', label: 'Mangrove Reach', eyebrow: 'LANTERN BAY / SITE 03', biome: 'mangrove',
        shortDescription: 'Shallow root channels wind between the mangroves and a bright sandbar.',
        description: 'Follow the shallow root channels across a pale sandbar, then look for the quiet offshore drop.',
        waterColor: 0x3c9d8d, sandColor: 0xd6c58f, surface: 21, radius: 78, seed: 368104, entry: (0, math_js_1.vec)(0, 8, -48), current: .24, channelX: -8, rocks: mangroveRocks,
        landmarks: [{ name: 'Home buoy', p: (0, math_js_1.vec)(0, 20, -51), kind: 'boat' }, { name: 'Root channel', p: (0, math_js_1.vec)(-17, 17, -24), kind: 'channel' }, { name: 'Open sandbar', p: (0, math_js_1.vec)(1, 1, 35), kind: 'sandbar' }, { name: 'Offshore drop', p: (0, math_js_1.vec)(36, -16, -39), kind: 'dropoff' }],
        worksites: anchors([[2, -32], [15, -10], [-15, 7], [26, 18], [-27, 34]], [[-7, -5], [-3, -2], [2, -5]], [[-4, -8]]),
        deepFeatures: { wreck: (0, math_js_1.vec)(36, 0, -40), outfall: (0, math_js_1.vec)(48, 0, -32) }
    },
    cenote: {
        id: 'cenote', name: 'Azure Cenote', label: 'Azure Cenote', eyebrow: 'LANTERN BAY / SITE 04', biome: 'cenote',
        shortDescription: 'Open-roof limestone chambers with clear, vertical routes to the light.',
        description: 'Explore deep limestone chambers open to the sky. Every basin has a direct, calm ascent route.',
        waterColor: 0x287fbd, sandColor: 0xd9d0b8, surface: 40, radius: 78, seed: 512927, entry: (0, math_js_1.vec)(0, 17, -51), current: .12, channelX: 0, rocks: cenoteRocks,
        landmarks: [{ name: 'Home buoy', p: (0, math_js_1.vec)(0, 39, -54), kind: 'boat' }, { name: 'Sun window', p: (0, math_js_1.vec)(0, 2, -3), kind: 'surface' }, { name: 'Limestone gallery', p: (0, math_js_1.vec)(-22, -2, 16), kind: 'chamber' }, { name: 'Deep blue basin', p: (0, math_js_1.vec)(0, -18, 31), kind: 'basin' }],
        worksites: anchors([[-12, -35], [12, -30], [-19, 2], [18, 17], [1, 43]], [[-8, -8], [8, -7], [0, 11]], [[-8, -11]]),
        deepFeatures: { wreck: (0, math_js_1.vec)(36, 0, -44), outfall: (0, math_js_1.vec)(49, 0, -36) }
    },
    harbour: {
        id: 'harbour', name: 'Rusted Harbour', label: 'Rusted Harbour', eyebrow: 'LANTERN BAY / SITE 05', biome: 'harbour',
        shortDescription: 'Wreck ribs, old pier pilings and abandoned containers shelter the harbour reef.',
        description: 'Work around a grounded wreck, timber pilings and rusting cargo containers. Leave a clear route to the surface.',
        waterColor: 0x3f7890, sandColor: 0x9b8d78, surface: 23, radius: 80, seed: 882461, entry: (0, math_js_1.vec)(0, 9, -50), current: .28, channelX: 15, rocks: harbourRocks,
        landmarks: [{ name: 'Home buoy', p: (0, math_js_1.vec)(0, 22, -53), kind: 'boat' }, { name: 'Outer wreck', p: (0, math_js_1.vec)(-31, -6, 39), kind: 'wreck' }, { name: 'Old pier', p: (0, math_js_1.vec)(-10, 23, -35), kind: 'pier' }, { name: 'Cargo stack', p: (0, math_js_1.vec)(28, -2, -12), kind: 'container' }],
        worksites: anchors([[-15, -26], [10, -22], [-22, 3], [20, 17], [0, 40]], [[-10, -6], [-6, -2], [-12, 2]], [[-8, -10]]),
        deepFeatures: { wreck: (0, math_js_1.vec)(-34, 0, 39), outfall: (0, math_js_1.vec)(36, 0, -43) }
    }
};
const foundationRocks = [...gardenRocks, ...passageRocks];
// Preserve the complete old terrain/mooring for already-suspended Passage outings.
const LEGACY_PASSAGE = structuredClone(exports.SITES.passage);
Object.assign(exports.SITES.passage, {
    description: 'Follow the sheltered western shelf, cross the tide race and read the flow beneath Cathedral arch.',
    shortDescription: 'A sheltered shelf, a deep tide race and two flow gauges.',
    entry: (0, math_js_1.vec)(-28, 14, -42),
    landmarks: [
        { name: 'Western mooring', p: (0, math_js_1.vec)(-28, 24, -46), kind: 'boat' },
        { name: 'Lee shelf nursery', p: (0, math_js_1.vec)(-28, 3, 10), kind: 'coral' },
        { name: 'Tide race', p: (0, math_js_1.vec)(0, 8, 8), kind: 'current' },
        { name: 'Cathedral flow gauge', p: (0, math_js_1.vec)(0, 8, 34), kind: 'landmark' }
    ],
    rocks: [...exports.SITES.passage.rocks, rock('lee-breakwater', -36, -10, 5, 9, 14), rock('cathedral-east-rib', 26, 32, 4, 13, 10, 1)],
    worksites: anchors([[-24, -27], [-27, -5], [-23, 15], [18, 34]], [[-28, 8], [-29, 10], [-26, 12]], [[-25, 14]])
});
function siteForRun(run) { return run.site === 'passage' && run.siteRevision !== 2 ? LEGACY_PASSAGE : exports.SITES[run.site]; }
function siteTerrainKey(site) { const resolved = typeof site === 'string' ? exports.SITES[site] : site; return !resolved ? 'legacy' : resolved === LEGACY_PASSAGE ? 'passage:1' : resolved.id + ':2'; }
function oldFloorHeight(x, z) {
    const shelf = -.7 + Math.sin(x * .067) * .7 + Math.sin(z * .09 + x * .028) * .55 + Math.cos((z - x) * .036) * .4;
    let foundation = 0;
    for (const r of foundationRocks) {
        const outside = Math.max(0, Math.hypot((x - r.p.x) / r.s.x, (z - r.p.z) / r.s.z) - 1);
        if (outside === 0) {
            foundation = 1;
            break;
        }
        if (outside < 2)
            foundation = Math.max(foundation, Math.exp(-outside * outside * 4));
    }
    const trench = 30 * Math.exp(-(((x - 38) / 19) ** 2) - (((z + 38) / 24) ** 2));
    return shelf - trench * (1 - foundation);
}
function terrainSite(site) { return typeof site === 'string' ? exports.SITES[site] : site; }
/** Omitted/legacy site terrain exactly preserves Sunlit Gardens and Passage's shared seabed. */
function floorHeight(x, z, siteArg) {
    const site = terrainSite(siteArg);
    if (!site || site.id === 'gardens' || site === LEGACY_PASSAGE)
        return oldFloorHeight(x, z);
    if (site.id === 'passage')
        return oldFloorHeight(x, z) - 7 * Math.exp(-(((x - 1) / 9) ** 2) - ((z - 10) / 65) ** 4) + 1.5 * Math.exp(-(((x + 28) / 12) ** 2) - ((z - 6) / 42) ** 4);
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
for (const site of [exports.SITES.mangrove, exports.SITES.cenote, exports.SITES.harbour])
    for (const r of site.rocks) {
        const bed = floorHeight(r.p.x, r.p.z, site) - .25;
        if (r.form === 'container')
            r.p.y = bed + r.s.y * .56;
        else if (r.p.y - r.s.y > bed) {
            const top = r.p.y + r.s.y;
            r.p.y = (top + bed) / 2;
            r.s.y = (top - bed) / 2;
        }
    }
function currentAt(p, site, time) {
    const channel = Math.exp(-Math.pow((p.x - (site.channelX ?? (site.id === 'gardens' ? 18 : 0))) / 12, 2));
    const strength = site.current * (.45 + channel * 1.8) * (1 + .12 * Math.sin(time * .023));
    return (0, math_js_1.vec)(.16 * strength, 0, strength);
}
function freePoint(p, site, padding = .8) {
    if (p.y - padding < floorHeight(p.x, p.z, site))
        return false;
    return site.rocks.every(r => Math.pow((p.x - r.p.x) / (r.s.x + padding), 2) + Math.pow((p.y - r.p.y) / (r.s.y + padding), 2) + Math.pow((p.z - r.p.z) / (r.s.z + padding), 2) > 1);
}
function groundPoint(x, z, lift = 1, site) { return (0, math_js_1.vec)(x, floorHeight(x, z, site) + lift, z); }
exports.DEFAULT_KEYS = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', up: 'Space', down: 'ControlLeft', boost: 'ShiftLeft', steady: 'KeyF', interact: 'KeyE', spear: 'Mouse0', scooter: 'KeyQ', pause: 'Escape', journal: 'KeyJ', light: 'KeyL', watch: 'KeyV' };
exports.DEFAULT_SETTINGS = { quality: 'balanced', music: .42, ambience: .6, effects: .7, sensitivity: 1, invertY: false, reducedMotion: false, assist: true, toggleDraw: false, fov: 78, touchScale: 1, instrumentHud: true, keys: { ...exports.DEFAULT_KEYS } };
exports.UPGRADES = [
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
exports.MAX_UPGRADE_LEVEL = 5;
function upgradeLevel(p, id) { return p.upgradeLevels?.[id] ?? (p.upgrades.includes(id) ? 1 : 0); }
function upgradeCost(p, id) { const u = exports.UPGRADES.find(u => u.id === id), level = upgradeLevel(p, id); return !u || level >= exports.MAX_UPGRADE_LEVEL ? 0 : Math.round(u.cost * [1, .2, .25, .3, .4][level] / 5) * 5; }
/** Service replaces parts of owned gear; advanced work opens as field experience grows. */
function upgradeServiceRequirement(p, id) {
    const next = upgradeLevel(p, id) + 1, day = next === 1 && id === 'scooter' ? 3 : next === 1 && id === 'torch' ? 4 : [0, 1, 1, 5, 8, 11][next] ?? 1, rep = next === 1 && id === 'scooter' ? 4 : next === 1 && id === 'torch' ? 6 : [0, 0, 0, 12, 20, 28][next] ?? 0;
    const available = p.day >= day && p.reputation >= rep;
    return { available, reason: available ? '' : `Level ${next} service opens on day ${day} with ${rep} conservation reputation.` };
}
function capacity(p) { const level = upgradeLevel(p, 'tube'); return level ? 10 + level * 2 : 8; }
function airCapacity(p) { return 200 + Math.max(0, upgradeLevel(p, 'air') - 1) * 30; }
function spearReach(p) { return 3 + upgradeLevel(p, 'spear') * .45; }
function wreckAnchor(site) {
    const feature = site.deepFeatures?.wreck;
    if (feature)
        return (0, math_js_1.vec)(feature.x, floorHeight(feature.x, feature.z, site), feature.z);
    return (0, math_js_1.vec)(34, floorHeight(34, -40), -40);
}
function pipeAnchor(site) {
    const feature = site.deepFeatures?.outfall;
    if (feature)
        return (0, math_js_1.vec)(feature.x, floorHeight(feature.x, feature.z, site), feature.z);
    const x = site.id === 'gardens' ? 43 : 46;
    return (0, math_js_1.vec)(x, floorHeight(x, -29), -29);
}
for (const site of Object.values(exports.SITES)) {
    const w = wreckAnchor(site), p = pipeAnchor(site);
    for (const side of [-1, 1])
        site.rocks.push({ id: 'wreck-rail-' + side, p: (0, math_js_1.vec)(w.x + side * 2.6, w.y + 1, w.z), s: (0, math_js_1.vec)(.5, 1, 7.5), tint: 0, hidden: true, form: 'container' });
    site.rocks.push({ id: 'wreck-bow', p: (0, math_js_1.vec)(w.x, w.y + .8, w.z + 7.6), s: (0, math_js_1.vec)(2.6, .8, .5), tint: 0, hidden: true, form: 'container' });
    for (const side of [-1, 1])
        site.rocks.push({ id: 'pipe-wall-' + side, p: (0, math_js_1.vec)(p.x + side * 1.05, p.y + 1.2, p.z), s: (0, math_js_1.vec)(.25, 1.2, 5), tint: 0, hidden: true, form: 'container' });
    site.rocks.push({ id: 'pipe-top', p: (0, math_js_1.vec)(p.x, p.y + 2.3, p.z), s: (0, math_js_1.vec)(1.1, .2, 5), tint: 0, hidden: true, form: 'container' });
    site.rocks.push({ id: 'pipe-back', p: (0, math_js_1.vec)(p.x, p.y + 1.2, p.z - 4.95), s: (0, math_js_1.vec)(1.2, 1.2, .2), tint: 0, hidden: true, form: 'container' });
    site.landmarks.push({ name: 'Lantern wreck · deep field station', p: (0, math_js_1.vec)(w.x, w.y + 2, w.z), kind: 'landmark' }, { name: 'Old outfall · deep field station', p: (0, math_js_1.vec)(p.x, p.y + 3, p.z - 6), kind: 'landmark' });
}
function healthOfReef(p, id) { const r = p.reefs[id]; return Math.round((0, math_js_1.clamp)(24 + r.removed.length * 1.25 + r.cleaned.length * 3 + Object.keys(r.restored).length * 5 + r.surveys * 2, 24, 98)); }
const SITE_UNLOCKS = {
    gardens: { removals: 0, reputation: 0 }, passage: { removals: 6, reputation: 5 }, mangrove: { removals: 12, reputation: 8 }, cenote: { removals: 26, reputation: 17 }, harbour: { removals: 42, reputation: 27 }
};
function siteUnlocked(p, id) { const need = SITE_UNLOCKS[id]; return id === 'gardens' || p.totalRemoved >= need.removals || p.reputation >= need.reputation; }
function siteUnlockText(p, id) {
    if (id === 'gardens')
        return 'Starting site · always available';
    if (siteUnlocked(p, id))
        return 'Available · ready for your next dive';
    const need = SITE_UNLOCKS[id];
    return 'Unlock at ' + need.removals + ' lionfish removed or ' + need.reputation + ' reputation';
}
const FISH_STARTERS = {
    gardens: [[3, -31], [-4, -23], [7, -15], [-8, -2], [6, 12]],
    passage: [[-27, -29], [-29, -14], [-22, 8], [0, 20], [24, 40]],
    mangrove: [[3, -34], [-6, -26], [8, -16], [-4, 4], [7, 27]],
    cenote: [[4, -40], [-7, -26], [10, -13], [-8, 12], [5, 37]],
    harbour: [[3, -43], [-6, -27], [5, -15], [-7, 11], [4, 33]]
};
function reefFishHomes(site, seed) {
    const random = (0, math_js_1.rng)(seed), points = [];
    for (const [x, z] of FISH_STARTERS[site.id]) {
        const p = groundPoint(x, z, 2.2, site);
        if (freePoint(p, site, .4) && points.every(q => (0, math_js_1.distance)(p, q) > 5))
            points.push(p);
    }
    for (let i = 0; i < 360 && points.length < 24; i++) {
        const x = (random() - .5) * site.radius * 1.35, z = -33 + random() * 88;
        if (Math.hypot(x, z) > site.radius - 3)
            continue;
        const p = groundPoint(x, z, 1.8 + random() * 3, site);
        if (freePoint(p, site, 1) && points.every(q => (0, math_js_1.distance)(p, q) > 5))
            points.push(p);
    }
    return points;
}

},
"game/math.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeText = exports.money = exports.rng = exports.direction = exports.norm = exports.distance = exports.length = exports.dot = exports.scale = exports.sub = exports.add = exports.vec = exports.lerp = exports.clamp = void 0;
exports.hash = hash;
exports.raySphere = raySphere;
exports.rayEllipsoid = rayEllipsoid;
exports.angleLerp = angleLerp;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
exports.clamp = clamp;
const lerp = (a, b, t) => a + (b - a) * t;
exports.lerp = lerp;
const vec = (x = 0, y = 0, z = 0) => ({ x, y, z });
exports.vec = vec;
const add = (a, b) => (0, exports.vec)(a.x + b.x, a.y + b.y, a.z + b.z);
exports.add = add;
const sub = (a, b) => (0, exports.vec)(a.x - b.x, a.y - b.y, a.z - b.z);
exports.sub = sub;
const scale = (a, n) => (0, exports.vec)(a.x * n, a.y * n, a.z * n);
exports.scale = scale;
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
exports.dot = dot;
const length = (a) => Math.hypot(a.x, a.y, a.z);
exports.length = length;
const distance = (a, b) => (0, exports.length)((0, exports.sub)(a, b));
exports.distance = distance;
const norm = (a) => (0, exports.scale)(a, 1 / ((0, exports.length)(a) || 1));
exports.norm = norm;
const direction = (yaw, pitch) => (0, exports.vec)(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
exports.direction = direction;
const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
exports.rng = rng;
function hash(s) {
    let h = 2166136261;
    for (const c of s)
        h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
}
function raySphere(o, d, c, r) {
    const v = (0, exports.sub)(o, c), b = (0, exports.dot)(v, d), k = (0, exports.dot)(v, v) - r * r, q = b * b - k;
    if (q < 0)
        return Infinity;
    const t = -b - Math.sqrt(q);
    return t >= 0 ? t : (-b + Math.sqrt(q) >= 0 ? 0 : Infinity);
}
function rayEllipsoid(o, d, c, s) {
    const v = (0, exports.vec)((o.x - c.x) / s.x, (o.y - c.y) / s.y, (o.z - c.z) / s.z), u = (0, exports.vec)(d.x / s.x, d.y / s.y, d.z / s.z);
    const a = (0, exports.dot)(u, u), b = (0, exports.dot)(v, u), q = b * b - a * ((0, exports.dot)(v, v) - 1);
    if (q < 0)
        return Infinity;
    const t = (-b - Math.sqrt(q)) / a;
    return t >= 0 ? t : Infinity;
}
function angleLerp(a, b, t) { return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t; }
const money = (n) => '$' + Math.round(n).toLocaleString('en');
exports.money = money;
const timeText = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
exports.timeText = timeText;

},
"ui/campaign-ui.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextCharacterMoment = nextCharacterMoment;
exports.momentView = momentView;
exports.careerView = careerView;
exports.eventView = eventView;
exports.contractNote = contractNote;
exports.eventNote = eventNote;
exports.receiptView = receiptView;
exports.upgradeNumbers = upgradeNumbers;
exports.filletResult = filletResult;
const campaign_js_1 = require("../game/campaign.js");
const contracts_js_1 = require("../game/contracts.js");
const data_js_1 = require("../game/data.js");
const math_js_1 = require("../game/math.js");
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function nextCharacterMoment(p) {
    const c = p.campaign ?? (0, campaign_js_1.normalizeCampaign)(p), seen = c.characterFlags;
    if (p.reputation >= 8 && !c.researchInvitationSeen && !seen.includes('research-invitation'))
        return { id: 'research-invitation', speaker: 'Dr Mira Vale · Lantern Bay University', title: 'We could use a careful pair of eyes.', text: 'We have been following your field work. Read two stations for our first funded assignment: $65 total by day, including station pay. We would like you to learn the reef, then come back and see how it changes.', research: true };
    if (seen.includes('welcome-grant') && !seen.includes('first-delivery'))
        return { id: 'first-delivery', speaker: 'Ellie · The Sandbar Kitchen', title: 'Your first catch is on the menu.', text: 'Clean fish, safely landed. That is what we need. There is a $20 welcome payment on your receipt; the next orders are four fish at a time. Spend it on something that makes the next dive easier.' };
    if (p.totalCleaned > 0 && !seen.includes('trust-thanks'))
        return { id: 'trust-thanks', speaker: 'Jo · Lantern Bay Trust', title: 'That corner is clear now.', text: 'The fishing gear you brought up stays gone. We do not put it back for another checklist. Try a different shelf tomorrow, or return to see what settles in.' };
    if (p.campaign?.researchCompleted && !seen.includes('research-thanks'))
        return { id: 'research-thanks', speaker: 'Dr Mira Vale · Lantern Bay University', title: 'Now we have a starting point.', text: 'Your first station readings are in. Monitoring stays open: $38 for two readings by day, or $45 at night, including the station payments. A familiar station pays less than a first visit.' };
    return null;
}
function momentView(m) { return `<section class="modal narrow character-moment"><div class="character-mark" aria-hidden="true">${esc(m.speaker.split(' ').map(w => w[0]).slice(0, 2).join(''))}</div><p class="eyebrow">${esc(m.speaker)}</p><h2>${esc(m.title)}</h2><p>${esc(m.text)}</p><div class="button-row">${m.research ? '<button class="primary" data-action="research-accept">Accept the assignment</button>' : '<button class="primary" data-close>Back to it</button>'}<button data-close>${m.research ? 'Maybe later' : 'Skip'}</button></div><p class="tiny muted">Short harbour conversation · you can skip it.</p></section>`; }
function careerView(p) {
    const c = p.campaign ?? (0, campaign_js_1.normalizeCampaign)(p), research = (0, campaign_js_1.researchEligibility)(p);
    const offers = campaign_js_1.CAREER_MILESTONES.map(m => { const s = (0, campaign_js_1.milestoneStatus)(p, m.id); return `<li><strong>${esc(m.title)}</strong><span>${m.audience} followers · ${m.reputation} reputation</span><small>${esc(s.achieved ? 'Recognition earned.' : s.objective.active ? s.objective.reason : s.description)}</small>${!s.achieved && !s.objective.active ? `<button data-action="opportunity" data-value="${m.id}" ${s.missing.length === 0 && !c.activeOpportunity ? '' : 'disabled'}>Take assignment</button>` : ''}</li>`; }).join('');
    return `${c.milestoneFlags.length ? `<p class="company-recognition">Recognition · ${c.milestoneFlags.map(id => esc(campaign_js_1.CAREER_MILESTONES.find(m => m.id === id)?.title ?? id)).join(' · ')}</p>` : ''}<details class="career-panel"><summary>Reputation &amp; stories · ${p.reputation} reputation / ${p.audience} followers</summary><p class="tiny muted">Reputation comes from careful reef work. Followers come from the highlights you publish. Recognition adds a badge, without another cash payout.</p><p>${esc(research.reason)}</p>${p.reputation >= 8 && !c.researchAccepted ? '<button data-action="research-visit">Meet the university team</button>' : ''}<ul class="recognition-list">${offers}</ul></details>`;
}
function eventView(p, site, registered) { const today = p.day % 3 === 0, theme = (0, contracts_js_1.eventTheme)(p, site), objective = theme === 'catch' ? 'Lionfish removal earns 125 points; secure and land your catch.' : theme === 'cleanup' ? 'Cleanup earns 200 points. Loaned field cutters make abandoned-gear work 20% faster.' : 'Station readings earn 120 points. Loaned gauges make readings 20% faster.'; return `<section class="modal narrow"><p class="eyebrow">LANTERN BAY SWEEP · LOCAL EVENT</p><h2>${today ? 'Today is ' + theme + ' day.' : 'The next Sweep is on day ' + (p.day + (3 - p.day % 3)) + '.'}</h2><p>${objective}</p><p>Native-fish and coral hits reduce your score. Safe return is required for a prize.</p><p><strong>250 points: $25 · 650: $50 · 1,200: $80</strong></p><p class="status-note">${registered ? 'Registered for today. This stays with this logbook after reload.' : 'Not registered. Your regular dive remains available.'}</p><div class="button-row"><button class="primary" data-action="event-toggle" ${today && !p.active && !p.pending ? '' : 'disabled'}>${registered ? 'Cancel registration' : 'Register for today'}</button><button data-close>Done</button></div><h3>Your local results</h3>${p.records.slice(-5).reverse().map(r => `<p class="tiny">Day ${r.day} · ${esc(r.site)} · ${r.score} points</p>`).join('') || '<p class="tiny muted">No results yet.</p>'}</section>`; }
function contractNote(run) { const progress = (0, contracts_js_1.contractProgress)(run); return `${progress.text}${run.order === 'research' && run.site === 'passage' && run.siteRevision === 2 ? ' · lee-shelf + Cathedral gauges' : ''}`; }
function eventNote(run) { if (!run.event)
    return ''; const score = (0, contracts_js_1.eventScore)(run), next = score < 250 ? 250 : score < 650 ? 650 : score < 1200 ? 1200 : 0; return `${run.eventTheme ?? 'catch'} day · ${score} points${next ? ' · next prize at ' + next : ' · top prize tier'}`; }
function receiptView(p, r) {
    const rows = [['Fish sold', r.sales], ['Filleting bonus', r.filletBonus], ['Kitchen / field contract', r.contract], ['Permanent cleanup work', r.cleanPay], ['Coral restoration', r.restorationPay], ['Station readings', r.surveyPay], ['Research funding / monitoring top-up', r.researchTopUp], ['Community donation payment', r.donationPay], ['First delivery welcome payment', r.starterGrant], ['Overhead debris recovery', r.boatPay], ['Local event prize', r.eventPrize], ...(r.sponsor ? [['Saved-outing sponsor contribution', r.sponsor]] : [])];
    return `<section class="modal narrow"><p class="eyebrow">THE OUTING'S ACCOUNT</p><h2>The next dive starts here.</h2><table class="summary-table"><tbody>${rows.map(([label, n]) => `<tr><td>${esc(label)}</td><td>${(0, math_js_1.money)(n)}</td></tr>`).join('')}<tr><td><strong>Total earned</strong></td><td><strong>${(0, math_js_1.money)(r.earned)}</strong></td></tr><tr><td>Air, fuel, field supplies / rescue</td><td>−${(0, math_js_1.money)(r.expenses)}</td></tr><tr><td>Outstanding bill paid</td><td>−${(0, math_js_1.money)(r.debtPaid)}</td></tr><tr><td><strong>Available for the next dive</strong></td><td><strong>${(0, math_js_1.money)(p.cash)}</strong></td></tr></tbody></table><p class="receipt-reason">${esc(r.contractReason)}</p><p class="tiny muted">${esc(r.eventReason)}</p><p>+${r.reputation} reputation · +${r.followers} followers</p>${r.recognition.map(t => `<p class="status-note">${esc(t)}</p>`).join('')}${p.debt ? `<p>${(0, math_js_1.money)(p.debt)} remains outstanding. Basic dives stay available.</p>` : ''}<div class="button-row"><button class="primary" data-screen="dock">Back to harbour</button><button data-screen="gear">Browse equipment</button></div></section>`;
}
function upgradeNumbers(p, id) {
    const rank = (0, data_js_1.upgradeLevel)(p, id), next = Math.min(5, rank + 1), arrow = (a, b) => `${a} → ${b}`;
    switch (id) {
        case 'fins': return `Fin speed ${arrow((2.2 * (1 + rank * .12)).toFixed(2), (2.2 * (1 + next * .12)).toFixed(2))} m/s.`;
        case 'tube': return `Secured capacity ${arrow(rank ? 10 + rank * 2 : 8, 10 + next * 2)} fish.`;
        case 'spear': return `Reach ${arrow((3 + rank * .45).toFixed(2), (3 + next * .45).toFixed(2))} m; draw ${arrow(Math.max(.4, .8 - rank * .08).toFixed(2), Math.max(.4, .8 - next * .08).toFixed(2))} seconds.`;
        case 'air': return `Tank ${arrow(200 + Math.max(0, rank - 1) * 30, 200 + Math.max(0, next - 1) * 30)} bar; base air use reduced ${arrow(rank * 9, next * 9)}%.`;
        case 'scooter': return rank ? `Cruise ${arrow((4.4 + rank * .4).toFixed(1), (4.4 + next * .4).toFixed(1))} m/s.` : 'Deploy a 4.8 m/s scooter. Stow it before drawing the spear.';
        case 'camera': return `Highlight quality bonus ${arrow(rank * 8, next * 8)} points; recorded quality caps at 100.`;
        case 'kit': return `Planting ${arrow(Math.max(1.3, 3.3 - rank * .4).toFixed(1), Math.max(1.3, 3.3 - next * .4).toFixed(1))} seconds; stock ${arrow(3 + rank * 2, 3 + next * 2)} fragments. Each current site has 3 plots.`;
        case 'battery': return `Scooter endurance at full thrust ${arrow(Math.round(100 / (.28 / (1 + rank * .35)) / 60), Math.round(100 / (.28 / (1 + next * .35)) / 60))} minutes before torch use.`;
        case 'torch': {
            const battery = (0, data_js_1.upgradeLevel)(p, 'battery'), cost = (level) => (.065 / (1 + level * .2 + battery * .15)).toFixed(3);
            return `Torch battery use ${rank ? cost(rank) : 'off'} → ${cost(next)} units/s. The beam widens at ranks 2–5. Night access needs regulator 2, a torch and Passage unlocked.`;
        }
        default: return '';
    }
}
function filletResult(r) { const q = r.filletQuality ?? 0, sales = r.cargo.reduce((n, c) => n + c.value, 0); return `<section class="modal narrow"><p class="eyebrow">CATCH PREPARATION</p><h2>${(0, contracts_js_1.filletGrade)(q)}.</h2><p>${Math.round(q * 100)}% cut accuracy · <strong>${Math.round(q * 300) / 10}% sale bonus</strong></p><p>If you sell this whole catch, filleting adds <strong>${(0, math_js_1.money)(Math.round(sales * q * .3))}</strong>. Meals and donations get no filleting bonus. Your final receipt uses exactly the fish you choose to sell.</p><div class="button-row"><button class="primary" data-action="fillet-cancel">Choose what to sell</button></div></section>`; }

},
"game/contracts.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventTheme = eventTheme;
exports.contractProgress = contractProgress;
exports.eventScore = eventScore;
exports.eventReward = eventReward;
exports.filletGrade = filletGrade;
const campaign_js_1 = require("./campaign.js");
function eventTheme(profile, site) {
    const preferred = ['catch', 'cleanup', 'research'][(Math.floor(profile.day / 3) - 1) % 3];
    if (preferred === 'research' && !(0, campaign_js_1.researchEligibility)(profile).eligible)
        return 'catch';
    if (preferred === 'cleanup' && !(0, campaign_js_1.contractOptions)(profile, site).find(o => o.kind === 'cleanup')?.available)
        return (0, campaign_js_1.researchEligibility)(profile).eligible ? 'research' : 'catch';
    return preferred;
}
function contractProgress(run) {
    const researchRoute = run.site === 'passage' && run.siteRevision === 2;
    const amount = run.order === 'catch' ? run.cargo.length : run.order === 'cleanup' ? run.cleaned : run.order === 'restore' ? run.restored : run.order === 'research' ? (researchRoute ? ['survey-0', 'survey-1'].filter(id => run.jobs.some(j => j.id === id && j.done)).length : run.surveyed) : 0;
    const target = run.order === 'catch' ? 4 : run.order === 'none' ? 0 : 2;
    const label = run.order === 'catch' ? 'Kitchen' : run.order === 'cleanup' ? 'Cleanup' : run.order === 'restore' ? 'Restoration' : run.order === 'research' ? (researchRoute ? 'Flow gauges' : 'Research') : 'Free exploration';
    return { label, amount, target, ready: target > 0 && amount >= target, text: target ? `${label} ${Math.min(amount, target)}/${target}${run.order === 'catch' ? ' secured · sell 4 at the dock' : ''}` : label };
}
function eventScore(run) { if (run.rescued)
    return 0; return Math.max(0, run.removed * (run.eventTheme === 'catch' ? 125 : 100) + run.cleaned * (run.eventTheme === 'cleanup' ? 200 : 150) + run.restored * 180 + run.surveyed * (run.eventTheme === 'research' ? 120 : 80) - run.nativeHits * 300 - run.coralHits * 40); }
function eventReward(score) { return score >= 1200 ? 80 : score >= 650 ? 50 : score >= 250 ? 25 : 0; }
function filletGrade(q) { return q >= .85 ? 'Excellent' : q >= .6 ? 'Good' : q >= .3 ? 'Fair' : 'Rough cuts'; }

},
"audio/scooter.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScooterMotor = void 0;
exports.sampledThrust = sampledThrust;
/** Render-only frames have no new control sample; retain thrust until the next simulation step. */
function sampledThrust(previous, playing, sampled, frame) {
    return !playing ? 0 : sampled ? Math.min(1, Math.hypot(frame.moveX, frame.moveZ, frame.vertical)) : previous;
}
/** A fixed two-oscillator voice: silent at rest outside a deployed, powered dive. */
class ScooterMotor {
    constructor(ctx, destination) {
        this.ctx = ctx;
        this.active = false;
        this.thrust = 0;
        this.lastLevel = -1;
        this.lastPitch = -1;
        this.gain = ctx.createGain();
        this.gain.gain.value = 0;
        this.filter = ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 380;
        this.low = ctx.createOscillator();
        this.low.type = 'sine';
        this.low.frequency.value = 62;
        this.hum = ctx.createOscillator();
        this.hum.type = 'triangle';
        this.hum.frequency.value = 124;
        this.low.connect(this.filter);
        this.hum.connect(this.filter);
        this.filter.connect(this.gain);
        this.gain.connect(destination);
        this.low.start();
        this.hum.start();
    }
    update(powered, thrust) {
        this.active = powered && this.ctx.state === 'running';
        this.thrust = this.active ? Math.max(0, Math.min(1, thrust)) : 0;
        const level = this.active ? .025 + this.thrust * .075 : 0, pitch = 62 + this.thrust * 42, t = this.ctx.currentTime;
        if (Math.abs(level - this.lastLevel) > .001) {
            this.gain.gain.cancelScheduledValues(t);
            this.gain.gain.setTargetAtTime(level, t, .035);
            this.lastLevel = level;
        }
        if (Math.abs(pitch - this.lastPitch) > .5) {
            this.low.frequency.setTargetAtTime(pitch, t, .09);
            this.hum.frequency.setTargetAtTime(pitch * 2, t, .09);
            this.filter.frequency.setTargetAtTime(380 + this.thrust * 420, t, .09);
            this.lastPitch = pitch;
        }
    }
    silence() { this.update(false, 0); }
    dispose() { this.silence(); this.low.stop(); this.hum.stop(); this.low.disconnect(); this.hum.disconnect(); this.filter.disconnect(); this.gain.disconnect(); }
    stats() { return { active: this.active, thrust: this.thrust, gain: Math.max(0, this.lastLevel), pitchHz: this.lastPitch, voices: 2 }; }
}
exports.ScooterMotor = ScooterMotor;

},
"analytics/game-start.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGameStartLifecycle = createGameStartLifecycle;
exports.prepareWebsiteGameStartHook = prepareWebsiteGameStartHook;
const shared_game_starts_client_js_1 = require("./shared-game-starts-client.js");
/** Guard even unexpected adapter errors. Gameplay never waits for telemetry. */
function createGameStartLifecycle(tracker, enabled = true) {
    let ready = false;
    const safely = (call) => { try {
        Promise.resolve(call()).catch(() => { });
    }
    catch { /* Measurement is optional. */ } };
    return {
        markReady() { ready = true; safely(() => tracker.markReady()); },
        start() { if (ready && enabled)
            safely(() => tracker.start()); },
        activity() { if (ready && enabled)
            safely(() => tracker.activity()); },
        dispose() { safely(() => tracker.dispose()); },
    };
}
function prepareWebsiteGameStartHook() {
    // Shared contract b928454. Production activation remains held for approval.
    const config = { gameId: 'reef-sweep', enabled: false, endpoint: '' };
    return createGameStartLifecycle((0, shared_game_starts_client_js_1.createGameStartTracker)(config), config.enabled);
}

},
"analytics/shared-game-starts-client.js":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONSENT_KEY = void 0;
exports.createGameStartTracker = createGameStartTracker;
// Browser-only start measurement. Nothing transmits unless explicitly enabled.
exports.CONSENT_KEY = 'samfa12:analytics-consent';
const SESSION_MS = 30 * 60000;
const RETRY_MS = 24 * 60 * 60000;
const GAMES = new Set(['briarhold', 'reef-sweep']);
function createGameStartTracker({ gameId, enabled = false, endpoint = '', windowRef = globalThis.window, now = Date.now, uuid = () => globalThis.crypto.randomUUID(), fetchImpl = globalThis.fetch, timeoutSignal = () => AbortSignal.timeout(5000) } = {}) {
    if (!GAMES.has(gameId))
        throw new Error('Unsupported game ID');
    const key = `samfa12:game-start:v1:${gameId}`;
    let ready = false, inFlight = null, state = null, suppressed = false, suppressedAt = 0, lastWrite = 0;
    let controller = null;
    const consent = () => {
        try {
            return windowRef.localStorage.getItem(exports.CONSENT_KEY) === 'granted';
        }
        catch {
            return false;
        }
    };
    const read = () => {
        try {
            const value = JSON.parse(windowRef.sessionStorage.getItem(key));
            if (value && typeof value.eventId === 'string' && Number.isFinite(value.lastActivity)
                && Number.isFinite(Date.parse(value.startedAt)) && now() - value.lastActivity < SESSION_MS
                && value.lastActivity <= now() + 300000)
                return value;
        }
        catch { /* In-memory operation remains usable when browser storage fails. */ }
        return null;
    };
    const save = () => {
        try {
            if (state)
                windowRef.sessionStorage.setItem(key, JSON.stringify(state));
            else
                windowRef.sessionStorage.removeItem(key);
        }
        catch { /* Never interrupt gameplay. Reload deduplication is unavailable. */ }
    };
    const allowedEndpoint = () => {
        if (!enabled || !endpoint || !windowRef)
            return null;
        try {
            const url = new URL(endpoint, windowRef.location.href);
            const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
            if (url.origin !== windowRef.location.origin || (!local && url.protocol !== 'https:')
                || url.pathname !== '/api/game-starts/v1/start' || url.search || url.hash)
                return null;
            return url.href;
        }
        catch {
            return null;
        }
    };
    const syncConsent = () => {
        if (!consent()) {
            state = null;
            suppressed = true;
            suppressedAt = now();
            controller?.abort();
            save();
        }
    };
    async function flush() {
        syncConsent();
        const url = allowedEndpoint();
        if (!url || !state || state.acked || !consent())
            return { status: 'inactive' };
        if (now() - Date.parse(state.startedAt) > RETRY_MS)
            return { status: 'expired' };
        if (inFlight)
            return inFlight;
        if ((state.attempts || 0) >= 4 || now() < (state.nextAttempt || 0))
            return { status: 'pending' };
        const event = state;
        event.attempts = (event.attempts || 0) + 1;
        event.nextAttempt = now() + 1000 * 2 ** event.attempts;
        save();
        controller = new AbortController();
        inFlight = (async () => {
            try {
                const response = await fetchImpl(url, {
                    method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
                    headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([timeoutSignal(), controller.signal]),
                    body: JSON.stringify({ schemaVersion: 1, gameId, eventId: event.eventId, startedAt: event.startedAt }),
                });
                const ack = await response.json();
                if (!response.ok || ack.schemaVersion !== 1 || ack.gameId !== gameId
                    || !['accepted', 'duplicate'].includes(ack.status)
                    || ack.day !== event.startedAt.slice(0, 10))
                    return { status: 'pending' };
                if (state === event && consent()) {
                    state.acked = true;
                    save();
                }
                return { status: ack.status };
            }
            catch {
                return { status: 'pending' };
            }
            finally {
                inFlight = null;
            }
        })();
        return inFlight;
    }
    state = consent() ? read() : null;
    const storageListener = event => { if (event.key === exports.CONSENT_KEY)
        syncConsent(); };
    windowRef?.addEventListener?.('storage', storageListener);
    windowRef?.addEventListener?.('samfa12:analytics-consent', syncConsent);
    const onlineListener = () => { void flush(); };
    windowRef?.addEventListener?.('online', onlineListener);
    return {
        markReady() { ready = true; },
        async start() {
            if (!ready || !allowedEndpoint())
                return { status: 'inactive' };
            if (!consent()) {
                suppressed = true;
                suppressedAt = now();
                return { status: 'consent-required' };
            }
            if (suppressed && now() - suppressedAt >= SESSION_MS)
                suppressed = false;
            if (state && now() - state.lastActivity >= SESSION_MS) {
                state = null;
                suppressed = false;
            }
            if (suppressed)
                return { status: 'suppressed' };
            if (!state) {
                try {
                    state = { eventId: uuid(), startedAt: new Date(now()).toISOString(), lastActivity: now(), acked: false };
                }
                catch {
                    return { status: 'unavailable' };
                }
                save();
            }
            return flush();
        },
        activity() {
            if (!consent()) {
                syncConsent();
                return;
            }
            if (state && now() - state.lastActivity < SESSION_MS) {
                state.lastActivity = now();
                if (now() - lastWrite >= 60000) {
                    save();
                    lastWrite = now();
                }
            }
        },
        flush, syncConsent,
        dispose() {
            windowRef?.removeEventListener?.('storage', storageListener);
            windowRef?.removeEventListener?.('samfa12:analytics-consent', syncConsent);
            windowRef?.removeEventListener?.('online', onlineListener);
            controller?.abort();
        },
    };
}

},
"game/profile.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveStore = exports.MemoryStorage = exports.SAVE_PREFIX = void 0;
exports.freshProfile = freshProfile;
exports.validateProfile = validateProfile;
exports.buy = buy;
const data_js_1 = require("./data.js");
const math_js_1 = require("./math.js");
const reef_recovery_js_1 = require("./reef-recovery.js");
const campaign_js_1 = require("./campaign.js");
exports.SAVE_PREFIX = 'reef-sweep:v1:';
const REEF_IDS = ['gardens', 'passage', 'mangrove', 'cenote', 'harbour'];
const emptyReef = () => ({ removed: [], cleaned: [], restored: {}, visits: 0, productiveVisits: 0, surveys: 0, lastDay: 0 });
function freshProfile(slot = 1) { return { version: 1, slot, day: 1, cash: 80, debt: 0, reputation: 0, audience: 12, totalRemoved: 0, totalCleaned: 0, totalRestored: 0, upgrades: [], reefs: { gardens: emptyReef(), passage: emptyReef(), mangrove: emptyReef(), cenote: emptyReef(), harbour: emptyReef() }, records: [], published: [], discoveries: [], tutorial: 0, sponsorPaidDay: 0, lastReport: 'Your boat. Your first reef. A little room to make a difference.', active: null, pending: null }; }
const numeric = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const strings = (v, n = 3000) => Array.isArray(v) && v.length <= n && v.every(s => typeof s === 'string' && s.length < 140);
/** Import is intentionally strict. Invalid data is never allowed to replace a good slot. */
function validateProfile(v) {
    const source = v;
    const p = source && typeof source === 'object' ? structuredClone(source) : source;
    if (!p || p.version !== 1)
        throw Error('This is not a supported Reef Sweep save (schema 1).');
    if (!p.reefs || typeof p.reefs !== 'object' || Array.isArray(p.reefs))
        throw Error('Invalid reef progress.');
    const keys = Object.keys(p.reefs);
    const legacyTwoSiteSave = keys.length === 2 && keys.includes('gardens') && keys.includes('passage');
    if (legacyTwoSiteSave) {
        p.reefs = { ...p.reefs, mangrove: emptyReef(), cenote: emptyReef(), harbour: emptyReef() };
    }
    else if (keys.length !== REEF_IDS.length || REEF_IDS.some(id => !keys.includes(id)) || keys.some(id => !REEF_IDS.includes(id)))
        throw Error('Invalid reef-site inventory.');
    for (const k of ['day', 'cash', 'debt', 'reputation', 'audience', 'totalRemoved', 'totalCleaned', 'totalRestored'])
        if (!numeric(p[k], 0, 1e8))
            throw Error('Invalid save field: ' + k);
    if (!numeric(p.day, 1, 1e6) || !numeric(p.slot, 1, 3))
        throw Error('Invalid save slot or day.');
    if (!strings(p.upgrades, 30) || !p.upgrades.every(id => data_js_1.UPGRADES.some(u => u.id === id)))
        throw Error('Unrecognised equipment in save.');
    if (new Set(p.upgrades).size !== p.upgrades.length)
        throw Error('Duplicate equipment in save.');
    if (p.upgradeLevels !== undefined && (!p.upgradeLevels || typeof p.upgradeLevels !== 'object' || Array.isArray(p.upgradeLevels) || !Object.entries(p.upgradeLevels).every(([id, rank]) => p.upgrades.includes(id) && Number.isInteger(rank) && rank >= 1 && rank <= data_js_1.MAX_UPGRADE_LEVEL)))
        throw Error('Invalid equipment levels.');
    if (!strings(p.published, 3000) || !strings(p.discoveries, 200))
        throw Error('Invalid journal.');
    if (!Array.isArray(p.records) || p.records.length > 80 || !p.records.every(r => numeric(r.score, 0, 1e8) && REEF_IDS.includes(r.site) && numeric(r.day, 1, 1e6)))
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
            if (!REEF_IDS.includes(r.site) || !numeric(r.seed, 0, 0xffffffff) || typeof r.id !== 'string' || !numeric(r.time, 0, 10000) || !numeric(r.air, 0, (0, data_js_1.airCapacity)(p)) || !numeric(r.health, 0, 100) || !numeric(r.battery, 0, 100) || !numeric(r.yaw, -1e9, 1e9) || !numeric(r.pitch, -2, 2))
                throw Error('Invalid suspended dive.');
            if (r.recoveryStage !== undefined && (!Number.isInteger(r.recoveryStage) || r.recoveryStage < 0 || r.recoveryStage > 5))
                throw Error('Invalid reef recovery snapshot.');
            if (r.siteRevision !== undefined && r.siteRevision !== 1 && r.siteRevision !== 2)
                throw Error('Invalid site revision.');
            if (r.night !== undefined && typeof r.night !== 'boolean' || r.night && (0, data_js_1.upgradeLevel)(p, 'torch') < 1)
                throw Error('Invalid night dive.');
            if (r.filletQuality !== undefined && (!numeric(r.filletQuality, 0, 1) || !r.finished || r.rescued || !r.cargo.length))
                throw Error('Invalid fillet preparation.');
            for (const v of [r.p, r.velocity])
                if (!v || !['x', 'y', 'z'].every(k => numeric(v[k], -10000, 10000)))
                    throw Error('Invalid diver position.');
            if (!Array.isArray(r.fish) || r.fish.length > 40 || !Array.isArray(r.jobs) || r.jobs.length > 32 || !Array.isArray(r.animals) || r.animals.length > 8 || !Array.isArray(r.cargo) || r.cargo.length > 20 || !Array.isArray(r.clips) || r.clips.length > 8)
                throw Error('Invalid dive contents.');
            for (const f of r.fish) {
                if (!f.p || !f.home || typeof f.id !== 'string' || !numeric(f.weight, .01, 10) || !numeric(f.size, .1, 3) || !numeric(f.phase, -1e9, 1e9) || !numeric(f.flee, 0, 100) || typeof f.alive !== 'boolean' || ![f.p, f.home].every(v => ['x', 'y', 'z'].every(k => numeric(v[k], -1000, 1000))))
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
    if (p.campaign !== undefined)
        p.campaign = (0, campaign_js_1.validateCampaign)(p.campaign);
    const isVec = (v) => v && ['x', 'y', 'z'].every(k => numeric(v[k], -10000, 10000));
    const text = (v, max = 200) => typeof v === 'string' && v.length <= max;
    for (const r of [p.active, p.pending])
        if (r) {
            for (const k of ['removed', 'cleaned', 'restored', 'surveyed', 'nativeHits', 'coralHits', 'stolen', 'distance', 'fragments', 'charge', 'strikeCooldown', 'hurtCooldown', 'interaction'])
                if (!numeric(r[k], 0, 1e6))
                    throw Error('Invalid dive counter: ' + k);
            if (!['catch', 'cleanup', 'restore', 'research', 'none'].includes(r.order) || !['scooter', 'light', 'returnWarn', 'lowWarn', 'finished', 'rescued', 'event'].every(k => typeof r[k] === 'boolean') || !text(r.interactionId) || !strings(r.seen, 100) || !numeric(r.day, 1, 1e6))
                throw Error('Invalid dive state.');
            if (r.charge > 1 || r.interaction > 1.1 || r.fragments > 3 + (0, data_js_1.upgradeLevel)(p, 'kit') * 2 || r.cargo.length > (0, data_js_1.capacity)(p) || r.jobs.some(j => !text(j.id) || !['debris', 'coral', 'survey'].includes(j.kind) || !isVec(j.p) || typeof j.done !== 'boolean' || !numeric(j.progress, 0, 1) || !numeric(j.stage, 0, 5)))
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
            if (r.animals.some(a => !['marlow', 'moray', 'turtle', 'ray', 'shark'].includes(a.id) || a.id === 'shark' && !r.night || !isVec(a.p) || !isVec(a.home) || !numeric(a.heading, -1e9, 1e9) || !numeric(a.phase, 0, 1e9) || !numeric(a.timer, 0, 1e6) || !numeric(a.cooldown, 0, 100) || !['roam', 'watch', 'approach', 'warn', 'lunge', 'retreat'].includes(a.state)))
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
        if (r && r.recoveryStage === undefined)
            r.recoveryStage = (0, reef_recovery_js_1.recoveryForRun)(r, p.reefs[r.site]);
    p.campaign = (0, campaign_js_1.normalizeCampaign)(p);
    for (const r of [p.active, p.pending])
        if (r?.order === 'research' && r.researchEligible === undefined)
            r.researchEligible = true;
    return p;
}
function buy(p, id) {
    const u = data_js_1.UPGRADES.find(x => x.id === id), cost = (0, data_js_1.upgradeCost)(p, id);
    if (!u || p.active || p.pending || (0, data_js_1.upgradeLevel)(p, id) >= data_js_1.MAX_UPGRADE_LEVEL || p.cash < cost || !(0, data_js_1.upgradeServiceRequirement)(p, id).available || u.requires && (0, data_js_1.upgradeLevel)(p, u.requires) < (u.requiredLevel ?? 1))
        return false;
    p.cash -= cost;
    p.upgradeLevels ?? (p.upgradeLevels = {});
    p.upgradeLevels[id] = (0, data_js_1.upgradeLevel)(p, id) + 1;
    if (!p.upgrades.includes(id))
        p.upgrades.push(id);
    return true;
}
class MemoryStorage {
    constructor() {
        this.values = new Map();
    }
    get length() { return this.values.size; }
    clear() { this.values.clear(); }
    getItem(k) { return this.values.get(k) ?? null; }
    key(i) { return [...this.values.keys()][i] ?? null; }
    removeItem(k) { this.values.delete(k); }
    setItem(k, v) { this.values.set(k, String(v)); }
}
exports.MemoryStorage = MemoryStorage;
class SaveStore {
    constructor(storage) {
        this.warning = '';
        this.volatile = false;
        try {
            this.storage = storage || localStorage;
        }
        catch {
            this.storage = new MemoryStorage();
            this.volatile = true;
            this.warning = 'Persistent storage is unavailable. Export your save before closing.';
        }
    }
    save(p) {
        try {
            const key = exports.SAVE_PREFIX + p.slot;
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
        }
    }
    selectedSlot() { try {
        const value = Number(this.storage.getItem(exports.SAVE_PREFIX + 'selected-slot'));
        return Number.isInteger(value) && value >= 1 && value <= 3 ? value : 1;
    }
    catch {
        return 1;
    } }
    selectSlot(slot) { if (!Number.isInteger(slot) || slot < 1 || slot > 3)
        return; try {
        this.storage.setItem(exports.SAVE_PREFIX + 'selected-slot', String(slot));
    }
    catch { /* Failure to remember a choice never prevents using a logbook. */ } }
    load(slot) {
        for (const key of [exports.SAVE_PREFIX + slot, exports.SAVE_PREFIX + slot + ':backup'])
            try {
                const raw = this.storage.getItem(key);
                if (raw)
                    return validateProfile(JSON.parse(raw));
            }
            catch {
                this.warning = 'A damaged save was ignored; a backup is used when available.';
            }
        return freshProfile(slot);
    }
    settings() {
        try {
            const s = JSON.parse(this.storage.getItem(exports.SAVE_PREFIX + 'settings') || '{}');
            const q = ['high', 'balanced', 'low'].includes(s.quality) ? s.quality : 'balanced';
            const gamepads = {};
            if (s.gamepads && typeof s.gamepads === 'object' && !Array.isArray(s.gamepads))
                for (const [key, raw] of Object.entries(s.gamepads).slice(0, 16)) {
                    const p = raw;
                    if (!p || typeof p !== 'object' || p.key !== key || typeof p.id !== 'string' || typeof p.mapping !== 'string' || !Number.isInteger(p.axisCount) || p.axisCount < 0 || p.axisCount > 64 || !Number.isInteger(p.buttonCount) || p.buttonCount < 0 || p.buttonCount > 128 || !Array.isArray(p.centers) || p.centers.length > 64 || !p.centers.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= -1 && n <= 1))
                        continue;
                    const validAxis = (v) => v && Number.isInteger(v.index) && v.index >= 0 && v.index < p.axisCount && (v.sign === 1 || v.sign === -1);
                    if (!p.axes || !['moveX', 'moveZ', 'lookX', 'lookY'].every(k => validAxis(p.axes[k])))
                        continue;
                    const validButtons = p.buttons && typeof p.buttons === 'object' && Object.entries(p.buttons).every(([action, index]) => /^[a-zA-Z]+$/.test(action) && Number.isInteger(index) && index >= 0 && index < p.buttonCount);
                    const validAxisButtons = p.axisButtons && typeof p.axisButtons === 'object' && Object.entries(p.axisButtons).every(([action, binding]) => /^[a-zA-Z]+$/.test(action) && binding && Number.isInteger(binding.index) && binding.index >= 0 && binding.index < p.axisCount && typeof binding.value === 'number' && Number.isFinite(binding.value) && binding.value >= -1 && binding.value <= 1);
                    if (!validButtons || !validAxisButtons)
                        continue;
                    gamepads[key] = { key, id: p.id.slice(0, 200), mapping: p.mapping.slice(0, 40), axisCount: p.axisCount, buttonCount: p.buttonCount, axes: p.axes, centers: p.centers, buttons: p.buttons, axisButtons: p.axisButtons, moveDeadzone: (0, math_js_1.clamp)(Number(p.moveDeadzone) || .14, .05, .4), lookDeadzone: (0, math_js_1.clamp)(Number(p.lookDeadzone) || .2, .05, .45) };
                }
            return { ...data_js_1.DEFAULT_SETTINGS, ...s, quality: q, music: (0, math_js_1.clamp)(Number(s.music ?? .42) || 0, 0, 1), ambience: (0, math_js_1.clamp)(Number(s.ambience ?? .6) || 0, 0, 1), effects: (0, math_js_1.clamp)(Number(s.effects ?? .7) || 0, 0, 1), sensitivity: (0, math_js_1.clamp)(Number(s.sensitivity ?? 1) || 1, .25, 2.5), fov: (0, math_js_1.clamp)(Number(s.fov ?? 78) || 78, 60, 100), touchScale: (0, math_js_1.clamp)(Number(s.touchScale ?? 1) || 1, .8, 1.3), instrumentHud: typeof s.instrumentHud === 'boolean' ? s.instrumentHud : true, keys: { ...data_js_1.DEFAULT_SETTINGS.keys, ...s.keys }, gamepads };
        }
        catch {
            return structuredClone(data_js_1.DEFAULT_SETTINGS);
        }
    }
    saveSettings(s) {
        try {
            this.storage.setItem(exports.SAVE_PREFIX + 'settings', JSON.stringify(s));
        }
        catch {
            this.warning = 'Settings could not be saved.';
        }
    }
}
exports.SaveStore = SaveStore;

},
"game/reef-recovery.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECOVERY_THRESHOLDS = void 0;
exports.recoveryFromProgress = recoveryFromProgress;
exports.recoveryForRun = recoveryForRun;
exports.recoveryPopulationShare = recoveryPopulationShare;
/**
 * Recovery advances between productive visits. The first two stages are subtle;
 * denser native life only appears after a diver has returned to do more work.
 */
exports.RECOVERY_THRESHOLDS = [
    { visits: 1, clearances: 2 },
    { visits: 2, clearances: 5 },
    { visits: 3, clearances: 9 },
    { visits: 4, clearances: 13 },
    { visits: 5, clearances: 17 }
];
/** Fraction used by presentation to scale native-life density for a captured stage. */
const POPULATION_SHARE = [0, .04, .09, .2, .34, .5];
function inferredProductiveVisits(progress) {
    // Legacy saves did not record which visits contained removals. Two clearances
    // per productive trip is a conservative estimate capped by completed visits.
    return Math.min(Math.floor(progress.visits), Math.floor(progress.removed.length / 2));
}
function recoveryFromProgress(progress) {
    const productiveVisits = progress.productiveVisits ?? inferredProductiveVisits(progress);
    const cleared = progress.removed.length;
    let stage = 0;
    for (const threshold of exports.RECOVERY_THRESHOLDS) {
        if (productiveVisits >= threshold.visits && cleared >= threshold.clearances)
            stage++;
        else
            break;
    }
    return stage;
}
/**
 * Return the immutable ecology stage for a run. New runs carry their start
 * snapshot. For schema-1 runs created before snapshots existed, remove this
 * outing's tail entries from persistent clearance before estimating the stage.
 */
function recoveryForRun(run, progress) {
    if (Number.isInteger(run.recoveryStage) && run.recoveryStage >= 0 && run.recoveryStage <= 5)
        return run.recoveryStage;
    const outingRemovals = Math.max(0, Math.min(Math.floor(run.removed), progress.removed.length));
    const priorRemoved = progress.removed.slice(0, progress.removed.length - outingRemovals);
    const legacyVisits = progress.productiveVisits ?? Math.min(Math.floor(progress.visits), Math.floor(priorRemoved.length / 2));
    return recoveryFromProgress({ ...progress, removed: priorRemoved, productiveVisits: legacyVisits });
}
function recoveryPopulationShare(stage) {
    const index = Math.max(0, Math.min(5, Math.floor(Number.isFinite(stage) ? stage : 0)));
    return POPULATION_SHARE[index];
}

},
"game/simulation.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Simulation = exports.EMPTY_INPUT = void 0;
exports.startRun = startRun;
exports.prepareFillets = prepareFillets;
exports.settleRun = settleRun;
const tutorial_js_1 = require("./tutorial.js");
const campaign_js_1 = require("./campaign.js");
const contracts_js_1 = require("./contracts.js");
const boat_encounters_js_1 = require("./boat-encounters.js");
const data_js_1 = require("./data.js");
const math_js_1 = require("./math.js");
const navigation_js_1 = require("./navigation.js");
const fish_motion_js_1 = require("./fish-motion.js");
const reef_recovery_js_1 = require("./reef-recovery.js");
exports.EMPTY_INPUT = { moveX: 0, moveZ: 0, vertical: 0, lookX: 0, lookY: 0, boost: false, steady: false, draw: false, release: false, cancelDraw: false, interact: false };
function startRun(p, id, order = 'catch', event = false, night = false) {
    if (p.active || p.pending)
        throw Error('Finish or resume the existing outing first.');
    if (!(0, data_js_1.siteUnlocked)(p, id))
        throw Error('Dive site locked.');
    if (night && ((0, data_js_1.upgradeLevel)(p, 'torch') < 1 || !(0, data_js_1.siteUnlocked)(p, 'passage')))
        throw Error('Night dives need a head torch and Passage experience.');
    const offer = (0, campaign_js_1.contractOptions)(p, id).find(o => o.kind === order);
    if (!offer?.available)
        throw Error(offer?.reason ?? 'That contract is not available.');
    const site = data_js_1.SITES[id], reef = p.reefs[id], seed = (site.seed + reef.visits * 37) >>> 0, random = (0, math_js_1.rng)(seed), recoveryStage = (0, reef_recovery_js_1.recoveryFromProgress)(reef);
    const homes = (0, data_js_1.reefFishHomes)(site, site.seed);
    const fish = homes.map((home, i) => { const fid = `fish-${i}`; const returned = reef.visits >= 4 && i < 4 ? `return-${Math.floor(reef.visits / 4)}-${i}` : fid; const alive = !reef.removed.includes(returned); const size = .72 + random() * .44; return { id: returned, p: { ...home }, home: { ...home }, size, weight: Math.round((.3 + size * random() * .8) * 100) / 100, alive, phase: random() * 6.28, flee: 0 }; });
    for (const f of fish)
        f.p = (0, fish_motion_js_1.clearFishPosition)(site, f.p, f.size * 1.5 + .15);
    const jobAt = (jobId, kind, x, z) => ({ id: jobId, kind, p: (0, data_js_1.groundPoint)(x, z, kind === 'survey' ? 2.5 : .5, site), done: kind === 'debris' ? reef.cleaned.includes(jobId) : kind === 'coral' ? jobId in reef.restored : false, progress: 0, stage: kind === 'coral' && jobId in reef.restored ? (0, math_js_1.clamp)(p.day - reef.restored[jobId], 1, 5) : 0 });
    const worksites = site.worksites;
    const jobs = [
        ...worksites.debris.map((point, i) => jobAt(`debris-${i}`, 'debris', point.x, point.z)),
        ...worksites.coral.map((point, i) => jobAt(`coral-${i}`, 'coral', point.x, point.z)),
        ...worksites.surveys.map((point, i) => jobAt(`survey-${i}`, 'survey', point.x, point.z))
    ];
    const wreck = (0, data_js_1.wreckAnchor)(site), pipe = (0, data_js_1.pipeAnchor)(site);
    jobs.push(id === 'passage' ? { ...jobAt('survey-1', 'survey', 0, 34), p: (0, data_js_1.groundPoint)(0, 34, 12, site) } : jobAt('survey-1', 'survey', wreck.x - 5, wreck.z), jobAt('survey-2', 'survey', pipe.x, pipe.z - 7));
    const animal = (animalId, point) => ({ id: animalId, p: { ...point }, home: { ...point }, heading: 0, state: 'roam', timer: 0, cooldown: 0, phase: random() * 6.28 });
    const wildlife = id === 'gardens'
        ? [animal('marlow', (0, math_js_1.vec)(-10, 5.5, 15)), animal('moray', (0, math_js_1.vec)(28, 5, 8)), animal('turtle', (0, math_js_1.vec)(-4, 11, 2)), animal('ray', (0, math_js_1.vec)(15, 2.4, 25))]
        : id === 'passage'
            ? [animal('marlow', (0, math_js_1.vec)(-6, 5.5, 11)), animal('moray', (0, math_js_1.vec)(26.5, 5, -1)), animal('turtle', (0, math_js_1.vec)(-4, 11, 2)), animal('ray', (0, math_js_1.vec)(0, 2.4, 37))]
            : id === 'mangrove'
                ? [animal('marlow', (0, data_js_1.groundPoint)(-34, 9, 4, site)), animal('moray', (0, data_js_1.groundPoint)(35, 9, 3, site)), animal('turtle', (0, data_js_1.groundPoint)(1, 12, 3, site)), animal('ray', (0, data_js_1.groundPoint)(4, 45, 3, site))]
                : id === 'cenote'
                    ? [animal('marlow', (0, data_js_1.groundPoint)(-10, 2, 5, site)), animal('moray', (0, data_js_1.groundPoint)(12, 8, 4, site)), animal('turtle', (0, data_js_1.groundPoint)(0, -23, 4, site)), animal('ray', (0, data_js_1.groundPoint)(7, 28, 4, site))]
                    : [animal('marlow', (0, data_js_1.groundPoint)(-21, 4, 4, site)), animal('moray', (0, data_js_1.groundPoint)(-7, 18, 3, site)), animal('turtle', (0, data_js_1.groundPoint)(4, -20, 4, site)), animal('ray', (0, data_js_1.groundPoint)(-12, 28, 3, site))];
    const run = { id: `${p.slot}-${p.day}-${seed}`, site: id, siteRevision: 2, recoveryStage, seed, day: p.day, time: 0, p: { ...site.entry }, velocity: (0, math_js_1.vec)(), yaw: .08, pitch: .12, air: 200, health: 100, battery: 100, cargo: [], exposed: null, fish, jobs, animals: wildlife, clips: [], removed: 0, cleaned: 0, restored: 0, surveyed: 0, nativeHits: 0, coralHits: 0, stolen: 0, distance: 0, fragments: p.upgrades.includes('kit') ? 5 : 3, charge: 0, strikeCooldown: 0, hurtCooldown: 0, interaction: 0, interactionId: '', scooter: false, light: false, returnWarn: false, lowWarn: false, finished: false, rescued: false, order, event, notices: [], seen: [], cooldowns: {} };
    run.air = (0, data_js_1.airCapacity)(p);
    run.fragments = 3 + (0, data_js_1.upgradeLevel)(p, 'kit') * 2;
    run.night = night;
    run.light = night;
    if (night)
        run.animals.push(animal('shark', (0, data_js_1.groundPoint)(wreck.x + 10, wreck.z - 12, 6, site)));
    run.researchEligible = (0, campaign_js_1.researchEligibility)(p).eligible;
    run.researchFunded = run.researchEligible && !(p.campaign ?? (0, campaign_js_1.normalizeCampaign)(p)).researchCompleted;
    if (event)
        run.eventTheme = (0, contracts_js_1.eventTheme)(p, id);
    if (id === 'gardens' && p.tutorial < 1)
        (0, tutorial_js_1.startLesson)(run);
    (0, boat_encounters_js_1.scheduleBoat)(run, site);
    p.active = run;
    return run;
}
class Simulation {
    constructor(profile, run) {
        this.profile = profile;
        this.run = run;
        this.events = [];
        this.aim = { kind: 'none', id: '', distance: 0, label: '', hint: '', valid: false };
        this.route = [];
        this.reserve = 40;
        this.routeTimer = 0;
        this.nativeTargets = [];
    }
    get site() { return data_js_1.SITES[this.run.site]; }
    emit(type, text, value) { this.events.push({ type, text, value }); }
    notice(text, key = '', cooldown = 6) {
        if (key && this.run.time < (this.run.cooldowns[key] ?? -1))
            return;
        if (key)
            this.run.cooldowns[key] = this.run.time + cooldown;
        this.emit('notice', text);
    }
    highlight(kind, title, detail, quality = 60) {
        const r = this.run;
        if (r.clips.some(c => c.kind === kind) || r.clips.length >= 8)
            return;
        const c = { id: r.id + '-' + kind, kind, title, detail, quality: (0, math_js_1.clamp)(quality + (0, data_js_1.upgradeLevel)(this.profile, 'camera') * 8, 0, 100), chosen: false };
        r.clips.push(c);
        this.events.push({ type: 'highlight', text: title, id: c.id });
    }
    update(dt, input) {
        const r = this.run;
        if (r.finished)
            return;
        dt = (0, math_js_1.clamp)(dt, 0, .05);
        r.time += dt;
        r.strikeCooldown = Math.max(0, r.strikeCooldown - dt);
        r.hurtCooldown = Math.max(0, r.hurtCooldown - dt);
        r.yaw += input.lookX;
        r.pitch = (0, math_js_1.clamp)(r.pitch + input.lookY, -1.28, 1.28);
        if (input.cancelDraw)
            r.charge = 0;
        if (input.draw && !r.exposed && !r.scooter && r.strikeCooldown === 0)
            r.charge = (0, math_js_1.clamp)(r.charge + dt / Math.max(.4, .8 - (0, data_js_1.upgradeLevel)(this.profile, 'spear') * .08), 0, 1);
        if (input.release && r.charge > 0) {
            this.strike(r.charge);
            r.charge = 0;
        }
        const forward = (0, math_js_1.direction)(r.yaw, r.pitch), right = (0, math_js_1.vec)(Math.cos(r.yaw), 0, -Math.sin(r.yaw));
        let move = (0, math_js_1.add)((0, math_js_1.scale)(forward, input.moveZ), (0, math_js_1.scale)(right, input.moveX));
        move.y += input.vertical;
        const mag = (0, math_js_1.length)(move);
        if (mag > 1)
            move = (0, math_js_1.scale)(move, 1 / mag);
        const prop = r.scooter && r.battery > 0;
        let speed = prop ? 4.4 + (0, data_js_1.upgradeLevel)(this.profile, 'scooter') * .4 : 2.2 * (1 + (0, data_js_1.upgradeLevel)(this.profile, 'fins') * .12);
        if (input.boost && !prop)
            speed *= 1.45;
        if (input.steady)
            speed *= .42;
        if (r.charge > .1)
            speed *= .5;
        const flow = (0, data_js_1.currentAt)(r.p, this.site, r.time);
        const want = (0, math_js_1.add)((0, math_js_1.scale)(move, speed), flow);
        const damp = 1 - Math.exp(-dt * (input.steady ? 7 : 3));
        r.velocity = (0, math_js_1.vec)(r.velocity.x + (want.x - r.velocity.x) * damp, r.velocity.y + (want.y - r.velocity.y) * damp, r.velocity.z + (want.z - r.velocity.z) * damp);
        const old = { ...r.p };
        r.p = (0, math_js_1.add)(r.p, (0, math_js_1.scale)(r.velocity, dt));
        this.collide();
        r.distance += (0, math_js_1.distance)(old, r.p);
        const depth = Math.max(0, this.site.surface - r.p.y);
        const exertion = (input.boost && !prop ? 1.36 : 1) + Math.max(0, -(0, math_js_1.dot)((0, math_js_1.norm)(move), flow)) * .3;
        const airRate = .24 * (1 + depth * .014) * exertion * (1 - (0, data_js_1.upgradeLevel)(this.profile, 'air') * .09);
        // Breaking the surface pauses consumption; it never replenishes the tank.
        if (r.p.y <= this.site.surface)
            r.air = Math.max(0, r.air - dt * airRate);
        if (prop && mag > .05) {
            r.battery = Math.max(0, r.battery - dt * (.28 / (1 + (0, data_js_1.upgradeLevel)(this.profile, 'battery') * .35)));
            if (!r.battery) {
                r.scooter = false;
                this.notice('Scooter battery empty. Fin power still works.');
            }
        }
        if (r.light)
            r.battery = Math.max(0, r.battery - dt * (.065 / (1 + (0, data_js_1.upgradeLevel)(this.profile, 'torch') * .2 + (0, data_js_1.upgradeLevel)(this.profile, 'battery') * .15)));
        for (const f of r.fish) {
            if (!f.alive)
                continue;
            f.flee = Math.max(0, f.flee - dt);
            f.phase += dt * .6;
            const wobble = f.flee ? 1.0 : .18;
            const next = (0, math_js_1.vec)(f.home.x + Math.sin(f.phase) * wobble, f.home.y + Math.sin(f.phase * 1.3) * .16, f.home.z + Math.cos(f.phase * .7) * wobble);
            f.p = (0, fish_motion_js_1.clearFishPosition)(this.site, next, f.size * 1.5 + .15);
            if ((0, math_js_1.distance)(f.p, r.p) < .35 + f.size * 1.5)
                this.hurt(9, 'Lionfish spines! Air lost. Back away and steady your breathing.');
        }
        if (!(0, tutorial_js_1.lessonActive)(r))
            this.updateAnimals(dt);
        this.updateAim();
        this.work(dt, input.interact);
        this.routeTimer -= dt;
        if (this.routeTimer <= 0) {
            this.routeTimer = 1.2;
            this.route = (0, navigation_js_1.homeRoute)(r.p, this.site);
            this.reserve = 25 + (0, navigation_js_1.pathLength)(this.route) / 1.8 * airRate * (1 + this.site.current);
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
        if ((0, tutorial_js_1.advanceLesson)(this.profile, r, input, dt, this.aim.kind === 'fish' && this.aim.valid)) {
            this.emit('save');
            if (!(0, tutorial_js_1.lessonActive)(r))
                this.notice('First-dive lesson complete. Replay is available in the field guide.');
        }
        if ((0, tutorial_js_1.lessonActive)(r)) {
            r.air = Math.max(r.air, 80);
            r.health = Math.max(r.health, 35);
        }
        const progress = (0, contracts_js_1.contractProgress)(r);
        if (progress.ready && !r.contractReadyNotified) {
            r.contractReadyNotified = true;
            this.notice(r.order === 'catch' ? 'Four fish secured. Sell at least four at the dock to fill the Kitchen order.' : progress.label + ' objective complete. Return safely to settle it.');
            this.emit('save');
        }
        if ((0, boat_encounters_js_1.updateBoat)(r, this.site, t => this.notice(t), () => this.emit('sound', undefined, 'boat-engine')))
            this.emit('save');
        if (Math.floor(r.time) % 30 === 0 && r.time - (r.cooldowns.autosave ?? -30) > 29) {
            r.cooldowns.autosave = r.time;
            this.emit('save');
        }
    }
    collide() {
        const r = this.run, site = this.site;
        r.p.y = (0, math_js_1.clamp)(r.p.y, (0, data_js_1.floorHeight)(r.p.x, r.p.z, site) + .85, site.surface + 1.3);
        const radial = Math.hypot(r.p.x, r.p.z);
        if (radial > site.radius) {
            r.p.x *= site.radius / radial;
            r.p.z *= site.radius / radial;
            this.notice('Open water beyond the chart. Work within this dive site.', 'edge', 20);
        }
        for (let pass = 0; pass < 2; pass++)
            for (const rock of site.rocks) {
                const sx = rock.s.x + .5, sy = rock.s.y + .5, sz = rock.s.z + .5;
                const q = (0, math_js_1.vec)((r.p.x - rock.p.x) / sx, (r.p.y - rock.p.y) / sy, (r.p.z - rock.p.z) / sz);
                const l = (0, math_js_1.length)(q);
                if (l < 1) {
                    const unit = l > .0001 ? (0, math_js_1.scale)(q, 1 / l) : (0, math_js_1.vec)(0, 1, 0);
                    r.p = (0, math_js_1.vec)(rock.p.x + unit.x * sx, rock.p.y + unit.y * sy, rock.p.z + unit.z * sz);
                    r.velocity = (0, math_js_1.scale)(r.velocity, .4);
                }
            }
    }
    blocker(o, d) {
        let t = Infinity;
        for (const rock of this.site.rocks)
            t = Math.min(t, (0, math_js_1.rayEllipsoid)(o, d, rock.p, rock.s));
        return t;
    }
    strike(charge) {
        const r = this.run;
        if (r.cargo.length >= (0, data_js_1.capacity)(this.profile)) {
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
        const dir = (0, math_js_1.direction)(r.yaw, r.pitch), reach = (0, data_js_1.spearReach)(this.profile) * (.65 + .35 * charge), blocked = this.blocker(r.p, dir);
        let best = reach, fish = null;
        for (const f of r.fish)
            if (f.alive) {
                const hit = (0, math_js_1.raySphere)(r.p, dir, f.p, .38 * f.size);
                if (hit < best && hit < blocked) {
                    best = hit;
                    fish = f;
                }
            }
        let nativeDistance = Infinity;
        for (const f of this.nativeTargets)
            nativeDistance = Math.min(nativeDistance, (0, math_js_1.raySphere)(r.p, dir, f.p, f.r));
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
                if (f.alive && (0, math_js_1.distance)(f.p, r.p) < 5)
                    f.flee = 4;
            this.notice('Just out of reach. Move closer and steady your aim.', 'miss', 5);
        }
    }
    updateAim() {
        const r = this.run, dir = (0, math_js_1.direction)(r.yaw, r.pitch), blocked = this.blocker(r.p, dir);
        const none = { kind: 'none', id: '', distance: 0, label: '', hint: '', valid: false };
        this.aim = none;
        if (r.exposed && r.cargo.length >= (0, data_js_1.capacity)(this.profile) && Math.hypot(r.p.x - this.site.landmarks[0].p.x, r.p.z - this.site.landmarks[0].p.z) < 7 && r.p.y > this.site.surface - 4) {
            this.aim = { kind: 'boat', id: 'boat', distance: 0, label: 'Your boat', hint: 'Hold Interact to board · exposed catch will be forfeited', valid: true };
            return;
        }
        if (r.exposed) {
            this.aim = { kind: 'fish', id: 'held', distance: 0, label: 'Lionfish on spear', hint: r.cargo.length < (0, data_js_1.capacity)(this.profile) ? 'Hold Interact to secure' : 'Tube full. Return to the buoy.', valid: r.cargo.length < (0, data_js_1.capacity)(this.profile) };
            return;
        }
        const boat = this.site.landmarks[0].p;
        if (Math.hypot(r.p.x - boat.x, r.p.z - boat.z) < 7) {
            if (r.p.y > this.site.surface - 4) {
                this.aim = { kind: 'boat', id: 'boat', distance: (0, math_js_1.distance)(r.p, boat), label: 'Your boat', hint: 'Hold Interact to finish this dive', valid: true };
                return;
            }
            this.aim = { kind: 'boat', id: 'ascent', distance: (0, math_js_1.distance)(r.p, boat), label: 'Home buoy overhead', hint: 'Ascend beside the mooring to board', valid: false };
        }
        const overhead = (0, boat_encounters_js_1.boatAim)(r, this.site, navigation_js_1.clearSegment);
        if (overhead) {
            this.aim = overhead;
            return;
        }
        let best = Infinity;
        for (const j of r.jobs) {
            if (j.done && j.kind !== 'survey')
                continue;
            if (j.done)
                continue;
            const d = (0, math_js_1.distance)(r.p, j.p), alignment = (0, math_js_1.dot)((0, math_js_1.norm)((0, math_js_1.sub)(j.p, r.p)), dir);
            if (d < 4 && alignment > .65 && (0, navigation_js_1.clearSegment)(r.p, j.p, this.site) && d < best) {
                best = d;
                this.aim = { kind: 'job', id: j.id, distance: d, label: j.kind === 'debris' ? 'Discarded fishing gear' : j.kind === 'coral' ? 'Nursery restoration plot' : 'Reef survey station', hint: j.kind === 'debris' ? 'Hold Interact to remove' : j.kind === 'coral' ? (r.fragments ? 'Hold Interact to plant a fragment' : 'No nursery fragments remaining') : ((r.researchEligible ?? (0, campaign_js_1.researchEligibility)(this.profile).eligible) ? (r.site === 'passage' && r.siteRevision === 2 && ['survey-0', 'survey-1'].includes(j.id) ? 'Hold Interact to read the flow gauge' : 'Hold Interact to record a survey') : 'Research unlocks after a university invitation at 8 reputation'), valid: (j.kind !== 'coral' || r.fragments > 0) && (j.kind !== 'survey' || (r.researchEligible ?? (0, campaign_js_1.researchEligibility)(this.profile).eligible)) };
            }
        }
        for (const f of r.fish)
            if (f.alive) {
                const t = (0, math_js_1.raySphere)(r.p, dir, f.p, .48 * f.size);
                if (t < 12 && t < blocked && t < best) {
                    best = t;
                    const reach = (0, data_js_1.spearReach)(this.profile);
                    this.aim = { kind: 'fish', id: f.id, distance: (0, math_js_1.distance)(r.p, f.p), label: 'Invasive lionfish', hint: r.scooter ? 'Stow scooter to use the pole spear' : t < reach ? 'Hold to draw · release to strike' : 'Approach slowly · pole-spear range', valid: t < reach && !r.scooter };
                }
            }
    }
    work(dt, interact) {
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
        const duration = a.id === 'held' ? .65 : a.kind === 'boat' ? 1.1 : a.id.startsWith('debris') ? 2.2 : a.id.startsWith('coral') ? Math.max(1.3, 3.3 - (0, data_js_1.upgradeLevel)(this.profile, 'kit') * .4) : 2.8;
        r.interaction += dt / (r.event && ((r.eventTheme === 'cleanup' && a.id.startsWith('debris')) || (r.eventTheme === 'research' && a.id.startsWith('survey'))) ? duration * .8 : duration);
        if (r.interaction < 1)
            return;
        r.interaction = 0;
        if (a.id === 'held' && r.exposed && r.cargo.length < (0, data_js_1.capacity)(this.profile)) {
            r.cargo.push(r.exposed);
            r.exposed = null;
            this.notice(`Catch secured · ${r.cargo.length}/${(0, data_js_1.capacity)(this.profile)} in the tube.`);
            this.emit('sound', undefined, 'collect');
            this.emit('save');
            return;
        }
        if (a.kind === 'boat') {
            this.finish(false);
            return;
        }
        if (a.id === 'boat-cleanup') {
            if ((0, boat_encounters_js_1.clearBoat)(r)) {
                this.notice('Recovered safely. A $5 recovery fee is recorded; this does not count as permanent site cleanup.');
                this.emit('sound', undefined, 'work');
                this.emit('save');
            }
            return;
        }
        const j = r.jobs.find(j => j.id === a.id);
        if (!j || j.done)
            return;
        if (j.kind === 'survey' && !(0, campaign_js_1.recordSurveyStation)(this.profile, r, j.id).ok)
            return;
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
    hurt(amount, text) {
        const r = this.run;
        if (r.hurtCooldown > 0)
            return;
        r.health = Math.max(0, r.health - amount);
        r.air = Math.max(0, r.air - amount);
        r.hurtCooldown = 3;
        this.notice(text);
        this.emit('sound', undefined, 'hurt');
    }
    updateAnimals(dt) {
        const r = this.run;
        for (const a of r.animals) {
            a.phase += dt;
            a.cooldown = Math.max(0, a.cooldown - dt);
            const to = (0, math_js_1.sub)(r.p, a.p), d = (0, math_js_1.length)(to), visible = (0, navigation_js_1.clearSegment)(a.p, r.p, this.site);
            let target = { ...a.home }, speed = .5;
            a.timer += dt;
            if (a.id === 'turtle' || a.id === 'ray') {
                target = (0, math_js_1.vec)(a.home.x + Math.sin(a.phase * .09) * 14, a.home.y + Math.sin(a.phase * .3) * .35, a.home.z + Math.cos(a.phase * .09) * 10);
                speed = 1;
                if (d < 12 && visible && (0, math_js_1.dot)((0, math_js_1.norm)(to), (0, math_js_1.direction)(r.yaw, r.pitch)) < -.6 && !r.seen.includes(a.id)) {
                    r.seen.push(a.id);
                    this.highlight(a.id, a.id === 'turtle' ? 'Unhurried company.' : 'A shadow over the sand.', a.id === 'turtle' ? 'A sea turtle on its own schedule.' : 'A ray gliding through the sand channel.', 82);
                    if (!this.profile.discoveries.includes(a.id))
                        this.profile.discoveries.push(a.id);
                }
            }
            else if (a.id === 'marlow') {
                const inTerritory = (0, math_js_1.distance)(r.p, a.home) < 23;
                if (a.state === 'roam') {
                    target = (0, math_js_1.vec)(a.home.x + Math.sin(a.phase * .15) * 4, a.home.y + Math.sin(a.phase * .25), a.home.z + Math.cos(a.phase * .15) * 5);
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
                    target = (0, math_js_1.add)(r.p, (0, math_js_1.scale)((0, math_js_1.norm)((0, math_js_1.sub)(a.p, r.p)), 2.5));
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
                    if ((0, math_js_1.distance)(a.p, a.home) < 1) {
                        a.state = 'roam';
                        a.cooldown = 15;
                        a.timer = 0;
                    }
                }
            }
            else if (a.id === 'shark') {
                target = (0, math_js_1.vec)(a.home.x + Math.sin(a.phase * .08) * 7, a.home.y + Math.sin(a.phase * .22), a.home.z + Math.cos(a.phase * .08) * 8);
                speed = 1.4;
                if (a.state === 'roam' && d < 9 && visible && a.cooldown === 0) {
                    a.state = 'warn';
                    a.timer = 0;
                    this.notice('A reef shark is circling. Keep your distance and leave the deep wreck.', 'shark', 10);
                    this.highlight('shark', 'A shape beyond the beam.', 'A cautious night encounter at the deep wreck.', 85);
                }
                if (a.state === 'warn') {
                    target = { ...a.p };
                    if (d > 11 || !visible) {
                        a.state = 'retreat';
                        a.timer = 0;
                    }
                    else if (a.timer > 3.5 && d < 6) {
                        a.state = 'lunge';
                        a.timer = 0;
                    }
                }
                if (a.state === 'lunge') {
                    target = { ...r.p };
                    speed = 3;
                    if (d < 1.8 && visible)
                        this.hurt(18, 'Shark contact! Air lost. Leave its territory.');
                    if (a.timer > 1.5 || !visible || (0, math_js_1.distance)(r.p, a.home) > 19) {
                        a.state = 'retreat';
                        a.timer = 0;
                        a.cooldown = 30;
                    }
                }
                if (a.state === 'retreat') {
                    target = { ...a.home };
                    speed = 2;
                    if ((0, math_js_1.distance)(a.p, a.home) < 1) {
                        a.state = 'roam';
                        a.timer = 0;
                        a.cooldown = 30;
                    }
                }
            }
            else {
                target = (0, math_js_1.vec)(a.home.x + Math.sin(a.phase * .6) * .25, a.home.y + Math.sin(a.phase * .8) * .12, a.home.z);
                if (d < 3.6 && visible && a.cooldown === 0 && a.state === 'roam') {
                    a.state = 'warn';
                    a.timer = 0;
                    this.notice('Moray territory. Back away from the crevice.', 'moray', 12);
                    this.highlight('moray', 'Someone is already home.', 'A moray in the reef. Give it space.', 72);
                }
                if (a.state === 'warn') {
                    target = (0, math_js_1.add)(a.home, (0, math_js_1.scale)((0, math_js_1.norm)((0, math_js_1.sub)(r.p, a.home)), .65));
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
                    target = (0, math_js_1.add)(a.home, (0, math_js_1.scale)((0, math_js_1.norm)((0, math_js_1.sub)(r.p, a.home)), 1.8));
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
                    if ((0, math_js_1.distance)(a.p, a.home) < .3) {
                        a.state = 'roam';
                        a.timer = 0;
                    }
                }
            }
            const delta = (0, math_js_1.sub)(target, a.p), len = (0, math_js_1.length)(delta);
            if (len > .01) {
                const np = (0, math_js_1.add)(a.p, (0, math_js_1.scale)(delta, Math.min(1, speed * dt / len)));
                np.y = Math.max(np.y, (0, data_js_1.floorHeight)(np.x, np.z, this.site) + (a.id === 'shark' ? 1.6 : 1));
                if ((0, data_js_1.freePoint)(np, this.site, a.id === 'shark' ? 1.6 : a.id === 'marlow' ? 1.6 : a.id === 'moray' ? .4 : 1.3))
                    a.p = np;
                a.heading = (0, math_js_1.angleLerp)(a.heading, Math.atan2(delta.x, delta.z), Math.min(1, dt * 2));
            }
        }
    }
    toggleScooter() {
        const r = this.run;
        if (!this.profile.upgrades.includes('scooter')) {
            this.notice('The Minnow scooter is waiting at the equipment shop.');
            return;
        }
        if (r.exposed) {
            this.notice('Secure the fish before changing equipment.');
            return;
        }
        if (r.battery <= 0) {
            this.notice('Battery empty. Use your fins.');
            return;
        }
        r.scooter = !r.scooter;
        r.charge = 0;
        this.notice(r.scooter ? 'Scooter deployed. Hold forward to cruise.' : 'Scooter stowed. Pole spear ready.');
    }
    finish(rescued) {
        const r = this.run;
        if (r.finished)
            return;
        r.finished = true;
        r.rescued = rescued;
        r.charge = 0;
        r.interaction = 0;
        this.profile.active = null;
        this.profile.pending = r;
        this.events.push({ type: 'finish' });
    }
}
exports.Simulation = Simulation;
function prepareFillets(p, quality) {
    const r = p.pending;
    if (!r || !r.finished || r.rescued || !r.cargo.length || r.filletQuality !== undefined || !Number.isFinite(quality) || quality < 0 || quality > 1)
        throw Error('This catch cannot be prepared again.');
    r.filletQuality = quality;
}
function settleRun(p, run, allocation, chosen) {
    if (run.practice)
        throw Error('Practice has no campaign settlement.');
    if (p.pending?.id !== run.id)
        throw Error('This outing has already been settled.');
    const available = run.rescued ? 0 : run.cargo.length;
    const n = allocation.sell + allocation.eat + allocation.donate;
    if (![allocation.sell, allocation.eat, allocation.donate].every(x => Number.isInteger(x) && x >= 0) || n !== available)
        throw Error('Allocate each landed fish exactly once.');
    const selected = run.clips.filter(c => chosen.includes(c.id)).slice(0, 2);
    const sales = run.cargo.slice(0, allocation.sell).reduce((s, c) => s + c.value, 0);
    const filletBonus = Math.round(sales * (run.filletQuality ?? 0) * .3);
    const legacy = run.siteRevision === undefined && run.researchEligible === undefined && run.researchFunded === undefined;
    const progress = (0, contracts_js_1.contractProgress)(run), research = (0, campaign_js_1.researchSettlement)(run, p);
    let contract = 0;
    let contractReason = run.order === 'none' ? 'Free exploration: no contract selected.' : run.rescued ? 'Rescue keeps ecological work, but contract bonuses need a safe return.' : progress.ready ? 'Objective complete.' : `${progress.label}: ${progress.amount}/${progress.target} completed.`;
    if (!run.rescued) {
        if (run.order === 'catch' && allocation.sell >= 4)
            contract = legacy ? 65 : 45;
        if (run.order === 'catch' && allocation.sell < 4)
            contractReason = `${allocation.sell} fish sold; the Kitchen order needs 4. Secured fish donated or kept as meals do not fill a sale order.`;
        if (run.order === 'cleanup' && run.cleaned >= 2)
            contract = legacy ? 70 : 40;
        if (run.order === 'restore' && run.restored >= 2)
            contract = legacy ? 80 : 45;
    }
    const survey = run.order === 'research' ? research : (0, campaign_js_1.surveyPayout)(run, p.reefs[run.site]);
    let researchTopUp = run.order === 'research' ? (legacy && !run.rescued && run.surveyed >= 2 ? (run.night ? 180 : 140) : research.assignmentTopUp) : 0;
    if (run.order === 'research' && run.site === 'passage' && run.siteRevision === 2 && !progress.ready) {
        researchTopUp = 0;
        contractReason = 'Read both the lee-shelf and Cathedral flow gauges to complete this route assignment.';
    }
    else if (run.order === 'research')
        contractReason = legacy ? 'The terms of your saved research outing are honoured for this settlement. Future assignments use the new inclusive rates.' : research.reason;
    if (run.order === 'research' && researchTopUp > 0)
        (0, campaign_js_1.completeResearch)(p, research);
    const campaign = p.campaign ?? (p.campaign = (0, campaign_js_1.normalizeCampaign)(p));
    const starterGrant = !run.rescued && allocation.sell > 0 && !campaign.characterFlags.includes('welcome-grant') ? 20 : 0;
    if (starterGrant)
        campaign.characterFlags.push('welcome-grant');
    const care = Math.max(0, run.removed * 2 + run.cleaned * 3 + run.restored * 4 + run.surveyed * 2 - run.nativeHits * 8 - run.coralHits);
    const rep = Math.max(0, Math.floor(care / 4) + allocation.donate);
    p.reputation += rep;
    let followers = 0;
    for (const c of selected) {
        const prior = p.published.filter(k => k === c.kind).length;
        followers += Math.round(c.quality / (3 + prior * 2));
        p.published.push(c.kind);
    }
    const droppedPublications = Math.max(0, p.published.length - 1000);
    if (p.campaign?.activeOpportunityPublishedAt !== undefined)
        p.campaign.activeOpportunityPublishedAt = Math.max(0, p.campaign.activeOpportunityPublishedAt - droppedPublications);
    p.published = p.published.slice(-1000);
    p.audience += followers;
    let sponsor = 0; // New recognition creates opportunities, not another cash stack.
    if (legacy && p.sponsorPaidDay !== p.day) {
        if (p.reputation >= 12 && run.restored + run.cleaned >= 2)
            sponsor = 50;
        else if (p.audience >= 80 && selected.some(c => ['marlow', 'turtle', 'ray'].includes(c.kind)))
            sponsor = 35;
        if (sponsor)
            p.sponsorPaidDay = p.day;
    }
    const recognition = [];
    const opportunity = campaign.activeOpportunity;
    if (opportunity && (0, campaign_js_1.milestoneStatus)(p, opportunity).available) {
        const awarded = (0, campaign_js_1.claimMilestone)(p, opportunity);
        if (awarded.ok)
            recognition.push(awarded.reason);
    }
    const score = (0, contracts_js_1.eventScore)(run);
    const eventPrize = run.event && !run.rescued ? (legacy ? (score >= 1200 ? 120 : score >= 650 ? 65 : score >= 250 ? 25 : 0) : (0, contracts_js_1.eventReward)(score)) : 0;
    if (run.event) {
        p.records.push({ day: p.day, site: run.site, score, catch: run.removed, clean: run.cleaned });
        p.records = p.records.slice(-60);
    }
    const cleanPay = run.cleaned * 12, restorationPay = run.restored * 15, surveyPay = legacy ? run.surveyed * (run.night ? 75 : 55) : survey.stationPay, donationPay = allocation.donate * 3, boatPay = run.encounter?.rewarded ? 5 : 0;
    const earned = sales + filletBonus + contract + cleanPay + restorationPay + surveyPay + researchTopUp + donationPay + starterGrant + boatPay + eventPrize + sponsor;
    const eventReason = !run.event ? 'Not registered for this outing.' : run.rescued ? 'Rescue: event score and prize are forfeited.' : `Local ${run.eventTheme ?? 'catch'} day: ${score} points; ${eventPrize ? 'prize earned.' : '250 points needed for the first prize.'}`;
    const expenses = run.rescued ? 85 : Math.max(8, 28 + (run.site === 'passage' ? 10 : 0) + (run.night ? 10 : 0) + run.restored * 6 - (allocation.eat > 0 ? 8 : 0));
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
    if (run.removed > 0)
        reef.productiveVisits = (reef.productiveVisits ?? 0) + 1;
    reef.lastDay = p.day;
    p.eventRegistrationDay = undefined;
    p.day++;
    p.pending = null;
    p.active = null;
    p.lastReport = run.rescued ? 'A difficult outing. The reef work remains; tomorrow is another dive.' : `${run.removed} lionfish removed · ${run.cleaned} cleanup jobs · ${run.restored} corals planted.`;
    return { earned, expenses, debtPaid, followers, reputation: rep, contract, eventPrize, sponsor, score, filletBonus, sales, cleanPay, restorationPay, surveyPay, researchTopUp, donationPay, starterGrant, boatPay, contractReason, eventReason, filletGrade: (0, contracts_js_1.filletGrade)(run.filletQuality ?? 0), recognition };
}

},
"game/boat-encounters.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleBoat = scheduleBoat;
exports.updateBoat = updateBoat;
exports.boatAim = boatAim;
exports.clearBoat = clearBoat;
const data_js_1 = require("./data.js");
const math_js_1 = require("./math.js");
/** One optional encounter, never in Gardens. No collider can trap the diver. */
function scheduleBoat(run, site) {
    if (run.site === 'gardens' || run.practice || run.day < 4 || (run.seed + run.day) % 3 !== 0)
        return;
    const candidates = [(0, math_js_1.vec)(30, 0, 20), (0, math_js_1.vec)(-30, 0, 25), (0, math_js_1.vec)(8, 0, 34), (0, math_js_1.vec)(-8, 0, 20)];
    const home = site.landmarks[0].p;
    const point = candidates.find(p => { p.y = Math.min(site.surface - 5, (0, data_js_1.floorHeight)(p.x, p.z, site) + 5); return (0, data_js_1.freePoint)(p, site, 3) && Math.hypot(p.x - home.x, p.z - home.z) > 24; });
    if (!point)
        return;
    run.encounter = { kind: run.day % 2 ? 'rubbish' : 'fishing', phase: 'warning', start: 180 + (run.seed % 40), p: point, cleanProgress: 0, rewarded: false };
}
function updateBoat(run, site, notice, sound) {
    const e = run.encounter;
    if (!e || run.time < e.start || ['cleared', 'passed'].includes(e.phase))
        return false;
    const elapsed = run.time - e.start;
    if (e.phase === 'warning' && !run.cooldowns.boatWarned) {
        if ((0, math_js_1.distance)(run.p, e.p) < 18) {
            if (e.start >= 260) {
                e.phase = 'passed';
                return true;
            }
            e.start += 10;
            return false;
        }
        run.cooldowns.boatWarned = 1;
        notice(e.kind === 'rubbish' ? 'Boat overhead. Watch for rubbish; keep clear of the amber marker.' : 'Fishing boat overhead. A line is going down at the amber marker; keep clear.');
        sound();
        return true;
    }
    if (e.phase === 'warning' && elapsed >= 12) {
        e.phase = 'active';
        return true;
    }
    if (e.phase === 'active' && e.kind === 'fishing' && !run.cooldowns.boatContact && (0, math_js_1.distance)(run.p, e.p) < 2.5) {
        run.cooldowns.boatContact = 1;
        run.air = Math.max(0, run.air - 2);
        notice('Line snag: 2 bar lost disentangling. Swim away; your route is clear.');
    }
    if (e.phase === 'active' && elapsed >= 32) {
        e.phase = 'abandoned';
        notice(e.kind === 'rubbish' ? 'The boat has gone. Bag the dropped rubbish if your return reserve allows.' : 'The boat has gone. Its abandoned line is now safe to recover.');
        return true;
    }
    return false;
}
function boatAim(run, site, clear) {
    const e = run.encounter;
    if (!e || !['active', 'abandoned'].includes(e.phase) || (0, math_js_1.distance)(run.p, e.p) > 3.5 || !clear(run.p, e.p, site) || (0, math_js_1.dot)((0, math_js_1.norm)((0, math_js_1.sub)(e.p, run.p)), (0, math_js_1.direction)(run.yaw, run.pitch)) < .6)
        return null;
    return { kind: 'job', id: 'boat-cleanup', distance: (0, math_js_1.distance)(run.p, e.p), label: e.kind === 'rubbish' ? 'Dropped rubbish' : 'Abandoned fishing line', hint: e.phase === 'abandoned' ? 'Hold Interact to bag it · $5 recovery fee' : e.kind === 'rubbish' ? 'Rubbish is falling · Keep clear until the boat leaves' : 'Active fishing gear · Keep clear until the boat leaves', valid: e.phase === 'abandoned' };
}
function clearBoat(run) { const e = run.encounter; if (!e || e.phase !== 'abandoned' || e.rewarded)
    return false; e.phase = 'cleared'; e.rewarded = true; e.cleanProgress = 1; return true; }

},
"game/navigation.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pathLength = void 0;
exports.clearSegment = clearSegment;
exports.homeRoute = homeRoute;
const math_js_1 = require("./math.js");
const data_js_1 = require("./data.js");
function clearSegment(a, b, site) {
    const d = (0, math_js_1.norm)((0, math_js_1.sub)(b, a)), len = (0, math_js_1.distance)(a, b);
    if (!site.rocks.every(r => (0, math_js_1.rayEllipsoid)(a, d, r.p, r.s) > len))
        return false;
    // Avoid a route that is clear of rocks but cuts through the site-specific seabed.
    const steps = Math.ceil(len / 2);
    for (let i = 1; i < steps; i++) {
        const t = i / steps, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
        if (y < (0, data_js_1.floorHeight)(x, z, site) + .35)
            return false;
    }
    return true;
}
function homeRoute(from, site) {
    const target = { ...site.entry, y: Math.max(from.y, site.entry.y) };
    if (clearSegment(from, target, site))
        return [from, target];
    const step = 6, size = 23, half = 66, y = Math.min(site.surface - 2, Math.max(6, from.y));
    const cell = (p) => ({ x: (0, math_js_1.clamp)(Math.round((p.x + half) / step), 0, size - 1), z: (0, math_js_1.clamp)(Math.round((p.z + half) / step), 0, size - 1) });
    const pt = (n) => (0, math_js_1.vec)((n % size) * step - half, y, Math.floor(n / size) * step - half);
    const start = cell(from), end = cell(target), s = start.z * size + start.x, e = end.z * size + end.x;
    const queue = [s], prev = new Map([[s, -1]]);
    while (queue.length) {
        const c = queue.shift();
        if (c === e)
            break;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
            const x = c % size + dx, z = Math.floor(c / size) + dz, n = z * size + x;
            if (x < 0 || z < 0 || x >= size || z >= size || prev.has(n))
                continue;
            const p = pt(n);
            if (!(0, data_js_1.freePoint)(p, site, 1) || !clearSegment(pt(c), p, site))
                continue;
            prev.set(n, c);
            queue.push(n);
        }
    }
    if (!prev.has(e)) { // A safe high-water fallback is more conservative than claiming a direct route.
        const high = site.surface - 1;
        return [from, (0, math_js_1.vec)(from.x, high, from.z), (0, math_js_1.vec)(target.x, high, target.z), target];
    }
    const reverse = [target];
    let c = e;
    while (c !== s && c >= 0) {
        reverse.push(pt(c));
        c = prev.get(c) ?? -1;
    }
    reverse.push(from);
    return reverse.reverse();
}
const pathLength = (path) => path.slice(1).reduce((n, p, i) => n + (0, math_js_1.distance)(p, path[i]), 0);
exports.pathLength = pathLength;

},
"game/fish-motion.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NATIVE_FISH_SURFACE_MARGIN = exports.NATIVE_FISH_TERRAIN_MARGIN = exports.NATIVE_FISH_ROCK_MARGIN = exports.NATIVE_FISH_MAX_SCALE = exports.NATIVE_FISH_UNIT_BOUND = void 0;
exports.nativeFishEnvelope = nativeFishEnvelope;
exports.clearFishPosition = clearFishPosition;
exports.prepareNativeOrbit = prepareNativeOrbit;
exports.nativeFishMotion = nativeFishMotion;
const data_js_1 = require("./data.js");
const math_js_1 = require("./math.js");
/** Conservative native-fish local bound, including the shader's tail sway. */
exports.NATIVE_FISH_UNIT_BOUND = Math.hypot(.22 + .05, .34, .63);
exports.NATIVE_FISH_MAX_SCALE = 1.4;
exports.NATIVE_FISH_ROCK_MARGIN = .22;
exports.NATIVE_FISH_TERRAIN_MARGIN = .2;
exports.NATIVE_FISH_SURFACE_MARGIN = .25;
const ROCK_LIFT_BLEND = 8;
const ROCK_VERTICAL_LIFT = 1.5;
const ROCK_LIFT_EPSILON = .01;
const smoothstep = (t) => {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
};
function stepAside(position, rock, innerX, innerZ) {
    if (rock.s.x <= rock.s.z) {
        const sign = rock.p.x <= 0 ? 1 : -1;
        position.x = rock.p.x + sign * (innerX + .02);
    }
    else {
        const sign = rock.p.z <= 0 ? 1 : -1;
        position.z = rock.p.z + sign * (innerZ + .02);
    }
}
function nativeFishEnvelope(scale) {
    return exports.NATIVE_FISH_UNIT_BOUND * Math.max(0, scale) + exports.NATIVE_FISH_ROCK_MARGIN;
}
/**
 * Returns a continuous, terrain-safe center position with the supplied
 * world-space body envelope kept outside authored rock ellipsoids. Useful for
 * repairing authored/pre-existing fish locations as well as moving schools.
 */
function clearFishPosition(site, source, envelope, out) {
    const position = out ?? (0, math_js_1.vec)(source.x, source.y, source.z);
    position.x = source.x;
    position.y = source.y;
    position.z = source.z;
    const bodyRadius = Math.max(0, envelope - exports.NATIVE_FISH_ROCK_MARGIN);
    const maxCenterY = site.surface - bodyRadius - exports.NATIVE_FISH_SURFACE_MARGIN;
    position.y = Math.min(maxCenterY, Math.max(position.y, (0, data_js_1.floorHeight)(position.x, position.z, site) + envelope + exports.NATIVE_FISH_TERRAIN_MARGIN));
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
                    position.y = Math.max(position.y, (0, data_js_1.floorHeight)(position.x, position.z, site) + envelope + exports.NATIVE_FISH_TERRAIN_MARGIN);
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
            if (radial >= 1)
                continue;
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
            if (overlapX * overlapX + overlapY * overlapY + overlapZ * overlapZ >= 1)
                continue;
            stepAside(position, rock, innerX, innerZ);
            position.y = Math.max(position.y, (0, data_js_1.floorHeight)(position.x, position.z, site) + envelope + exports.NATIVE_FISH_TERRAIN_MARGIN);
            movedSideways = true;
        }
        if (!movedSideways)
            break;
    }
    position.y = Math.min(maxCenterY, Math.max(position.y, (0, data_js_1.floorHeight)(position.x, position.z, site) + envelope + exports.NATIVE_FISH_TERRAIN_MARGIN));
    return position;
}
function orbitCenterAwayFromCurtains(site, source, radius, envelope) {
    const center = (0, math_js_1.vec)(source.x, source.y, source.z), spanZ = radius * .66;
    const lowY = center.y - 1.3 - envelope, highY = center.y + 1.3 + envelope;
    const gap = .5;
    const curtains = site.rocks.filter(rock => (rock.form === 'root' || rock.form === 'piling') && lowY < rock.p.y + rock.s.y && highY > rock.p.y - rock.s.y);
    const blocked = (x, z) => curtains.some(rock => {
        const minX = rock.p.x - rock.s.x - envelope - gap, maxX = rock.p.x + rock.s.x + envelope + gap;
        const minZ = rock.p.z - rock.s.z - envelope - gap, maxZ = rock.p.z + rock.s.z + envelope + gap;
        return x + radius > minX && x - radius < maxX && z + spanZ > minZ && z - spanZ < maxZ;
    });
    const fitsSite = (x, z) => Math.max(Math.hypot(x - radius, z - spanZ), Math.hypot(x + radius, z - spanZ), Math.hypot(x - radius, z + spanZ), Math.hypot(x + radius, z + spanZ)) < site.radius - 1;
    if (!blocked(center.x, center.z))
        return center;
    // Pick one nearby clear orbit center before animating the school. Sampling a
    // deterministic set of offsets avoids sequential projection cycles between
    // neighbouring trunks while retaining a smooth, repeatable swim path.
    const directions = 24;
    for (let step = .5; step <= site.radius * .55; step += .5) {
        for (let i = 0; i < directions; i++) {
            const angle = i / directions * Math.PI * 2;
            const x = source.x + Math.cos(angle) * step, z = source.z + Math.sin(angle) * step;
            if (fitsSite(x, z) && !blocked(x, z))
                return (0, math_js_1.vec)(x, center.y, z);
        }
    }
    return center;
}
function prepareNativeOrbit(site, center, radius, scale) {
    return orbitCenterAwayFromCurtains(site, center, radius, nativeFishEnvelope(scale));
}
/**
 * Samples the deterministic native-school orbit, lifts members over low relief,
 * and offsets schools around surface-reaching root and piling groups. No state
 * is stored, so a paused dive or repeated timestamp is reproducible.
 */
function nativeFishMotion(site, center, radius, seed, time, scale = exports.NATIVE_FISH_MAX_SCALE, out) {
    const angle = time * .13 + seed;
    const envelope = nativeFishEnvelope(scale);
    const orbitCenter = out?.orbitCenter ?? orbitCenterAwayFromCurtains(site, center, radius, envelope);
    const position = out?.position ?? (0, math_js_1.vec)(0, 0, 0);
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

},
"render/renderer.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReefRenderer = void 0;
const dive_watch_js_1 = require("./dive-watch.js");
const diver_animation_js_1 = require("./diver-animation.js");
const biome_geometry_js_1 = require("./biome-geometry.js");
const reef_recovery_js_1 = require("../game/reef-recovery.js");
const shadows_js_1 = require("./shadows.js");
const breathing_js_1 = require("../game/breathing.js");
const geometry_js_1 = require("./geometry.js");
const terrain_js_1 = require("./terrain.js");
const shaders_js_1 = require("./shaders.js");
const math_js_1 = require("../game/math.js");
const data_js_1 = require("../game/data.js");
const fish_motion_js_1 = require("../game/fish-motion.js");
const xzDistance = (x, z, p) => Math.hypot(x - p.x, z - p.z);
function clearDecoration(x, z, site, run, radius) {
    if (Math.abs(x - site.entry.x) < 3.6 && z > site.entry.z - 4 && z < site.entry.z + 28)
        return false;
    if (run.jobs.some(job => xzDistance(x, z, job.p) < radius + 1.25))
        return false;
    if (run.fish.some(fish => fish.alive && xzDistance(x, z, fish.home) < radius + 1.5))
        return false;
    return true;
}
/** Renderer boundary: Babylon objects are never used by the domain simulation. */
class ReefRenderer {
    setWatchRaised(value) { this.watchRequested = value; }
    setWatchReserve(value) { if (Number.isFinite(value))
        this.watchReserve = Math.max(0, value); }
    get watchRaised() { return this.watchRequested; }
    constructor(canvas, settings) {
        this.canvas = canvas;
        this.materials = [];
        this.staticMeshes = [];
        this.fishMeshes = new Map();
        this.animalMeshes = new Map();
        this.jobMeshes = new Map();
        this.nativeSchools = [];
        this.nativeTargets = [];
        this.environmentCounts = { coral: 0, seaweedClumps: 0, seaweedFronds: 0, nativeFish: 0, nativeSchools: 0, shipwrecks: 0, pipeMouths: 0, coastlinePieces: 0 };
        this.atmosphere = '';
        this.bubblePool = new breathing_js_1.BubblePool();
        this.bubbleMatrices = new Float32Array(24 * 16);
        this.watch = null;
        this.watchRequested = false;
        this.watchBlend = 0;
        this.watchReserve = 40;
        this.lastPoseTime = 0;
        this.pose = { left: (0, math_js_1.vec)(), right: (0, math_js_1.vec)(), leftRoll: 0, rightRoll: 0, reach: 0, thrust: 0 };
        this.site = data_js_1.SITES.gardens;
        this.run = null;
        this.encounterMeshes = null;
        this.profile = null;
        this.fps = 0;
        this.draws = 0;
        this.lastCaptureTime = -99;
        this.captureQueue = [];
        this.onLost = () => { };
        this.settings = settings;
        const B = BABYLON;
        this.engine = new B.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, powerPreference: 'high-performance' }, false);
        this.scene = new B.Scene(this.engine);
        this.scene.clearColor = new B.Color4(.035, .31, .37, 1);
        this.scene.autoClear = true;
        this.camera = new B.FreeCamera('diver', new B.Vector3(0, 8, -41), this.scene);
        this.camera.minZ = .045;
        this.camera.maxZ = 500;
        this.camera.fov = settings.fov * Math.PI / 180;
        this.scene.activeCamera = this.camera;
        this.scene.skipPointerMovePicking = true;
        this.scene.setRenderingAutoClearDepthStencil(1, true, true, true);
        B.Effect.ShadersStore['reefVertexShader'] = shaders_js_1.reefVertex;
        B.Effect.ShadersStore['reefFragmentShader'] = shaders_js_1.reefFragment;
        this.nativeScale = new B.Vector3(1, 1, 1);
        this.nativeRotation = new B.Quaternion(0, 0, 0, 1);
        this.nativeTranslation = new B.Vector3();
        this.nativeTransform = new B.Matrix();
        this.forwardVector = new B.Vector3();
        this.torchVector = { x: 16, y: .05 };
        this.shadows = new shadows_js_1.ReefShadows(this.scene, this.engine);
        this.configure(settings);
        canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.onLost(); });
        window.addEventListener('resize', () => this.engine.resize());
    }
    configure(settings) { this.settings = settings; const scale = settings.quality === 'high' ? 1 / Math.min(devicePixelRatio || 1, 1.5) : settings.quality === 'low' ? 1.45 : 1; this.engine.setHardwareScalingLevel(scale); this.engine.resize(); this.camera.fov = settings.fov * Math.PI / 180; this.shadows?.configure(settings.quality === 'high'); }
    material(mode) {
        let m = this.materials.find(m => m._reefMode === mode);
        if (m)
            return m;
        const B = BABYLON;
        m = new B.ShaderMaterial('reef-' + mode, this.scene, { vertex: 'reef', fragment: 'reef' }, { attributes: ['position', 'normal', 'color', 'uv'], uniforms: ['world', 'viewProjection', 'uTime', 'uMode', 'uMotion', 'uSurface', 'uEye', 'uFog', 'uLight', 'uForward', 'uWaterColor', 'uNight', 'uCurrent', 'uTorch', 'uSunMatrix', 'uTorchMatrix', 'uShadows', 'uTorchShadows'], samplers: ['uSunShadow', 'uTorchShadow'], needAlphaBlending: mode === 5 || mode === 6 || mode === 8 });
        m._reefMode = mode;
        m.backFaceCulling = false;
        m.setFloat('uMode', mode);
        m.setFloat('uSurface', this.site.surface);
        m.setFloat('uMotion', 1);
        m.setVector3('uWaterColor', new B.Vector3(.035, .31, .39));
        m.setFloat('uFog', .030);
        m.setFloat('uLight', 0);
        m.setFloat('uNight', 0);
        m.setVector2('uCurrent', { x: this.site.current, y: this.site.channelX ?? (this.site.id === 'gardens' ? 18 : 0) });
        m.setVector2('uTorch', { x: 24, y: .10 });
        if (mode === 5 || mode === 6 || mode === 8) {
            m.disableDepthWrite = true;
            m.alphaMode = B.Engine.ALPHA_COMBINE;
        }
        m.setMatrix('uSunMatrix', this.shadows.sunMatrix);
        m.setMatrix('uTorchMatrix', this.shadows.torchMatrix);
        m.setFloat('uShadows', 0);
        m.setFloat('uTorchShadows', 0);
        m.setTexture('uSunShadow', this.shadows.white);
        m.setTexture('uTorchShadow', this.shadows.white);
        this.materials.push(m);
        return m;
    }
    mesh(name, g, mode = 1) { const B = BABYLON, m = new B.Mesh(name, this.scene), v = new B.VertexData(); v.positions = g.positions; v.normals = g.normals; v.colors = g.colors; v.uvs = g.uvs; v.indices = g.indices; v.applyToMesh(m, false); m.material = this.material(mode); m.isPickable = false; return m; }
    disposeWorld() {
        this.watch?.dispose();
        this.watch = null;
        this.watchRequested = false;
        this.watchBlend = 0;
        for (const m of this.scene.meshes.slice())
            m.dispose(false, false);
        this.staticMeshes = [];
        this.fishMeshes.clear();
        this.animalMeshes.clear();
        this.jobMeshes.clear();
        this.nativeSchools = [];
        this.captureQueue = [];
    }
    build(profile, run) {
        this.disposeWorld();
        this.shadows.reset();
        this.bubblePool = new breathing_js_1.BubblePool();
        this.profile = profile;
        this.run = run;
        this.encounterMeshes = null;
        this.site = (0, data_js_1.siteForRun)(run);
        const site = this.site, random = (0, math_js_1.rng)(site.seed), B = BABYLON;
        this.environmentCounts = { coral: 0, seaweedClumps: 0, seaweedFronds: 0, nativeFish: 0, nativeSchools: 0, shipwrecks: 0, pipeMouths: 0, coastlinePieces: 0 };
        for (const m of this.materials) {
            m.setFloat('uSurface', site.surface);
            m.setVector2('uCurrent', { x: site.current, y: site.channelX ?? (site.id === 'gardens' ? 18 : 0) });
        }
        // Ground is authored topography, not a regenerated collision surface.
        const ground = (0, terrain_js_1.seabedGeometry)(site);
        this.staticMeshes.push(this.mesh('rippled-sand', ground, 0));
        const chunks = new Map(), seaweedChunks = new Map();
        const chunk = (x, z) => {
            const key = `${Math.floor(x / 22)}:${Math.floor(z / 22)}`;
            if (!chunks.has(key))
                chunks.set(key, new geometry_js_1.Geometry());
            return chunks.get(key);
        };
        const seaweedChunk = (x, z) => {
            const key = `${Math.floor(x / 22)}:${Math.floor(z / 22)}`;
            if (!seaweedChunks.has(key))
                seaweedChunks.set(key, new geometry_js_1.Geometry());
            return seaweedChunks.get(key);
        };
        const visibleRocks = site.rocks.filter(rock => !rock.hidden);
        for (const rock of visibleRocks) {
            const g = chunk(rock.p.x, rock.p.z);
            g.merge((0, biome_geometry_js_1.siteObstacleGeometry)(rock, site));
        }
        const templates = Array.from({ length: 6 }, (_, i) => (0, geometry_js_1.coral)(i, site.seed + i * 523));
        const biomeCoral = site.biome === 'cenote' ? .48 : site.biome === 'mangrove' ? .55 : site.biome === 'harbour' ? .70 : 1;
        const coralCount = Math.round((this.settings.quality === 'high' ? 1800 : this.settings.quality === 'low' ? 1000 : 1400) * biomeCoral);
        const coralPatches = [];
        for (const rock of visibleRocks.filter(rock => rock.form !== 'root' && rock.form !== 'piling'))
            for (let patch = 0; patch < 5; patch++) {
                const angle = patch / 5 * Math.PI * 2 + random() * .24, radius = .24 + random() * .48;
                const nx = Math.cos(angle) * radius, nz = Math.sin(angle) * radius;
                const x = rock.p.x + nx * rock.s.x, z = rock.p.z + nz * rock.s.z;
                if (clearDecoration(x, z, site, run, 1.2))
                    coralPatches.push({ rock, nx, nz });
            }
        if (!coralPatches.length)
            visibleRocks.filter(rock => rock.form !== 'root' && rock.form !== 'piling').forEach(rock => coralPatches.push({ rock, nx: 0, nz: 0 }));
        for (let i = 0; i < coralCount; i++) {
            if (!coralPatches.length)
                break;
            const patch = coralPatches[i % coralPatches.length], rock = patch.rock;
            const a = random() * Math.PI * 2, r = Math.sqrt(random()) * .28;
            const nx = patch.nx + Math.cos(a) * r, nz = patch.nz + Math.sin(a) * r;
            const normalizedRadius = Math.hypot(nx, nz), x = rock.p.x + nx * rock.s.x, z = rock.p.z + nz * rock.s.z;
            if (normalizedRadius > .9 || !clearDecoration(x, z, site, run, 1.0) || rock.id.includes('crown') && i % 3 !== 0)
                continue;
            const y = rock.p.y + rock.s.y * Math.sqrt(Math.max(0, 1 - normalizedRadius * normalizedRadius));
            const kind = Math.floor(random() * 6), s = .45 + random() * .9;
            chunk(x, z).merge(templates[kind], (0, math_js_1.vec)(x, y - .06, z), (0, math_js_1.vec)(s, s, s), random() * 6.28);
            this.environmentCounts.coral++;
        }
        // Low reef patches fill the edges of the entry lane and work areas.
        const lowReefPatches = Math.round((this.settings.quality === 'high' ? 360 : this.settings.quality === 'low' ? 180 : 270) * biomeCoral);
        for (let i = 0; i < lowReefPatches; i++) {
            const x = (random() - .5) * 95, z = -38 + random() * 95;
            if (!clearDecoration(x, z, site, run, 1.1))
                continue;
            const p = (0, math_js_1.vec)(x, (0, terrain_js_1.sandHeight)(x, z, site), z);
            if (!(0, data_js_1.freePoint)({ ...p, y: p.y + 1 }, site, 1))
                continue;
            const s = .25 + random() * .55;
            (0, terrain_js_1.mergeGrounded)(chunk(x, z), templates[Math.floor(random() * 6)], p, (0, math_js_1.vec)(s, s, s), random() * 6.28, site);
            this.environmentCounts.coral++;
        }
        const seaweedCount = Math.round((this.settings.quality === 'high' ? 1000 : this.settings.quality === 'low' ? 500 : 760) * (site.biome === 'cenote' ? .30 : site.biome === 'mangrove' ? 1.15 : 1));
        let seaweedAttempts = 0;
        while (this.environmentCounts.seaweedClumps < seaweedCount && seaweedAttempts++ < seaweedCount * 4) {
            const area = random();
            let x, z;
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
            const y = (0, terrain_js_1.sandHeight)(x, z, site), p = (0, math_js_1.vec)(x, y, z);
            if (!(0, data_js_1.freePoint)((0, math_js_1.vec)(x, y + .6, z), site, .4))
                continue;
            const fronds = (0, geometry_js_1.seaweedGeometry)(site.seed + seaweedAttempts * 53, .8 + random() * .75);
            (0, terrain_js_1.mergeGrounded)(seaweedChunk(x, z), fronds, p, (0, math_js_1.vec)(.9 + random() * .32, 1, .9 + random() * .32), random() * Math.PI * 2, site);
            this.environmentCounts.seaweedClumps++;
            this.environmentCounts.seaweedFronds += fronds.positions.length / 60;
        }
        for (const [key, g] of chunks)
            if (g.positions.length)
                this.staticMeshes.push(this.mesh('reef-cell-' + key, g));
        for (const [key, g] of seaweedChunks)
            if (g.positions.length)
                this.staticMeshes.push(this.mesh('seaweed-cell-' + key, g, 7));
        const water = new geometry_js_1.Geometry(), waterSteps = 48;
        for (let z = 0; z <= waterSteps; z++)
            for (let x = 0; x <= waterSteps; x++)
                water.v((0, math_js_1.vec)(-550 + x * 1100 / waterSteps, site.surface, -550 + z * 1100 / waterSteps), (0, math_js_1.vec)(0, -1, 0), (0, geometry_js_1.rgb)('#73bdb4'));
        for (let z = 0; z < waterSteps; z++)
            for (let x = 0; x < waterSteps; x++) {
                const a = z * (waterSteps + 1) + x, b = a + waterSteps + 1;
                water.indices.push(a, a + 1, b, b, a + 1, b + 1);
            }
        this.staticMeshes.push(this.mesh('moving-water-surface', water, 3));
        const beams = new geometry_js_1.Geometry();
        for (let i = 0; i < 8; i++) {
            const x = -38 + i * 12, z = -25 + (i % 3) * 23, top = (0, math_js_1.vec)(x, site.surface - .4, z), bottom = (0, math_js_1.vec)(x + 7, -1, z - 3);
            const width = 1.0 + i % 3 * .45;
            const base = beams.positions.length / 3;
            for (let j = 0; j < 2; j++)
                for (let s = 0; s < 8; s++) {
                    const angle = s / 7 * Math.PI * 2, p = j ? bottom : top;
                    beams.v((0, math_js_1.vec)(p.x + Math.cos(angle) * width * (j ? 1.8 : .6), p.y, p.z + Math.sin(angle) * width * (j ? 1.8 : .6)), (0, math_js_1.vec)(0, 1, 0), (0, geometry_js_1.rgb)('#b4dbbd'), s / 7, j);
                }
            for (let s = 0; s < 7; s++) {
                const a = base + s, b = a + 8;
                beams.indices.push(a, a + 1, b, a + 1, b + 1, b);
            }
        }
        this.staticMeshes.push(this.mesh('shafts-of-light', beams, 5));
        const dust = new geometry_js_1.Geometry();
        for (let i = 0; i < 180; i++) {
            const p = (0, math_js_1.vec)((random() - .5) * 100, 2 + random() * (site.surface - 4), -45 + random() * 100), s = .016 + random() * .032;
            dust.tri((0, math_js_1.vec)(p.x - s, p.y, p.z), (0, math_js_1.vec)(p.x + s, p.y, p.z), (0, math_js_1.vec)(p.x, p.y + s * 2, p.z), (0, geometry_js_1.rgb)('#96c8b8'));
        }
        this.staticMeshes.push(this.mesh('drifting-plankton', dust, 6));
        // Boat and mooring are always in the same location; their shadow is a navigational landmark.
        const home = site.landmarks[0].p, boat = new geometry_js_1.Geometry();
        boat.rod((0, math_js_1.vec)(home.x, (0, data_js_1.floorHeight)(home.x, home.z, site), home.z), (0, math_js_1.vec)(home.x, site.surface, home.z), .035, .035, (0, geometry_js_1.rgb)('#d6c6a5'), 7);
        boat.ellipsoid((0, math_js_1.vec)(home.x, site.surface + .38, home.z), (0, math_js_1.vec)(1.85, .62, 3.2), (0, geometry_js_1.rgb)('#ccd6bd'), 20, 10);
        boat.ellipsoid((0, math_js_1.vec)(home.x + 2.5, site.surface - .2, home.z), (0, math_js_1.vec)(.3, .43, .3), (0, geometry_js_1.rgb)('#f0b16e'), 14, 9);
        boat.box((0, math_js_1.vec)(home.x, site.surface + .9, home.z), (0, math_js_1.vec)(2.5, .22, 4.4), (0, geometry_js_1.rgb)('#b98861'));
        boat.box((0, math_js_1.vec)(home.x, site.surface + 1.42, home.z + .35), (0, math_js_1.vec)(1.65, .92, 1.7), (0, geometry_js_1.rgb)('#d6d1b7'));
        boat.box((0, math_js_1.vec)(home.x, site.surface + 1.55, home.z + 1.22), (0, math_js_1.vec)(1.1, .42, .08), (0, geometry_js_1.rgb)('#42636a'));
        boat.box((0, math_js_1.vec)(home.x - .82, site.surface + 1.08, home.z - 1.3), (0, math_js_1.vec)(.08, .32, 2.1), (0, geometry_js_1.rgb)('#e0c99a'));
        boat.box((0, math_js_1.vec)(home.x + .82, site.surface + 1.08, home.z - 1.3), (0, math_js_1.vec)(.08, .32, 2.1), (0, geometry_js_1.rgb)('#e0c99a'));
        boat.rod((0, math_js_1.vec)(home.x, site.surface + 1.9, home.z - .45), (0, math_js_1.vec)(home.x, site.surface + 3.5, home.z - .45), .035, .018, (0, geometry_js_1.rgb)('#ddd4b4'), 7);
        boat.rod((0, math_js_1.vec)(home.x, site.surface + 3.45, home.z - .45), (0, math_js_1.vec)(home.x + 1.0, site.surface + 3.05, home.z - .45), .014, .014, (0, geometry_js_1.rgb)('#f2dfaf'), 5);
        boat.rod((0, math_js_1.vec)(home.x + 2.5, site.surface, home.z), (0, math_js_1.vec)(home.x + 2.5, site.surface + 1.3, home.z), .018, .018, (0, geometry_js_1.rgb)('#d6d8c0'));
        this.staticMeshes.push(this.mesh('home-mooring', boat, 1));
        if (run.encounter) {
            const e = run.encounter, hull = new geometry_js_1.Geometry(), object = new geometry_js_1.Geometry(), line = new geometry_js_1.Geometry();
            hull.ellipsoid((0, math_js_1.vec)(0, .15, 0), (0, math_js_1.vec)(1.4, .55, 3.6), (0, geometry_js_1.rgb)('#ca9970'), 12, 7);
            hull.box((0, math_js_1.vec)(0, .72, .2), (0, math_js_1.vec)(1.8, .8, 1.6), (0, geometry_js_1.rgb)('#e5d1a7'));
            hull.rod((0, math_js_1.vec)(.8, 1.2, -.8), (0, math_js_1.vec)(.8, 2.9, -.8), .035, .03, (0, geometry_js_1.rgb)('#e9c684'), 6);
            if (e.kind === 'rubbish') {
                object.ellipsoid((0, math_js_1.vec)(), (0, math_js_1.vec)(.45, .32, .6), (0, geometry_js_1.rgb)('#d9b16b'), 8, 5);
                object.box((0, math_js_1.vec)(.3, .2, 0), (0, math_js_1.vec)(.15, .42, .15), (0, geometry_js_1.rgb)('#eee1b9'));
            }
            else {
                for (let i = -2; i <= 2; i++) {
                    object.rod((0, math_js_1.vec)(i * .38, -.8, -.1), (0, math_js_1.vec)(i * .38, .8, .1), .014, .014, (0, geometry_js_1.rgb)('#e3c88e'), 5);
                    object.rod((0, math_js_1.vec)(-.8, i * .38, -.1), (0, math_js_1.vec)(.8, i * .38, .1), .014, .014, (0, geometry_js_1.rgb)('#e3c88e'), 5);
                }
            }
            line.rod((0, math_js_1.vec)(0, site.surface - e.p.y - .25, 0), (0, math_js_1.vec)(), .018, .018, (0, geometry_js_1.rgb)('#dfb86d'), 6);
            const meshes = { boat: this.mesh('overhead-boat', hull, 1), object: this.mesh('overhead-debris', object, 1), line: this.mesh('overhead-line', line, 1) };
            this.encounterMeshes = meshes;
            this.staticMeshes.push(meshes.boat, meshes.object, meshes.line);
            for (const m of Object.values(meshes))
                m.setEnabled(false);
        }
        const coast = new geometry_js_1.Geometry();
        for (let i = 0; i < 12; i++) {
            const angle = i / 12 * Math.PI * 2 + .12 + Math.sin(i * 2.7) * .07;
            const radius = 260 + (i % 3) * 22;
            coast.merge((0, geometry_js_1.islandGeometry)(site.seed + i * 173, Math.max(45, (site.surface + 12) / .8)), (0, math_js_1.vec)(Math.cos(angle) * radius, site.surface, Math.sin(angle) * radius), (0, math_js_1.vec)(.8 + i % 3 * .15, .8 + i % 4 * .08, 1), angle + .4);
        }
        this.staticMeshes.push(this.mesh('lantern-bay-coastline', coast, 9));
        this.environmentCounts.coastlinePieces = 12;
        const wreck = (0, data_js_1.wreckAnchor)(site), wreckMesh = this.mesh('lantern-shipwreck-ribs', (0, geometry_js_1.shipwreckGeometry)(), 1);
        wreckMesh.position.set(wreck.x, wreck.y + 1.05, wreck.z);
        this.staticMeshes.push(wreckMesh);
        this.environmentCounts.shipwrecks = 1;
        const pipe = (0, data_js_1.pipeAnchor)(site), pipeMesh = this.mesh('old-rusted-outfall', (0, geometry_js_1.sewagePipeGeometry)(), 1);
        pipeMesh.position.set(pipe.x, pipe.y + 1.25, pipe.z);
        this.staticMeshes.push(pipeMesh);
        this.environmentCounts.pipeMouths = 1;
        for (const f of run.fish) {
            const m = this.mesh(f.id, (0, geometry_js_1.fishGeometry)('lionfish'), 2);
            this.fishMeshes.set(f.id, m);
        }
        for (const a of run.animals) {
            const m = this.mesh(a.id, (0, geometry_js_1.fishGeometry)(a.id), 2);
            this.animalMeshes.set(a.id, m);
        }
        for (const job of run.jobs) {
            const g = new geometry_js_1.Geometry();
            if (job.kind === 'debris') {
                if (Number(job.id.split('-')[1]) % 2 === 0) {
                    for (let i = 0; i < 5; i++)
                        for (let j = 0; j < 5; j++) {
                            const p = (0, math_js_1.vec)((i - 2) * .27, .09, (j - 2) * .27);
                            if (i < 4)
                                g.rod(p, (0, math_js_1.vec)(p.x + .27, .12, p.z), .015, .015, (0, geometry_js_1.rgb)('#958e70'), 4);
                            if (j < 4)
                                g.rod(p, (0, math_js_1.vec)(p.x, .10, p.z + .27), .015, .015, (0, geometry_js_1.rgb)('#958e70'), 4);
                        }
                }
                else {
                    g.box((0, math_js_1.vec)(), (0, math_js_1.vec)(.7, .36, .5), (0, geometry_js_1.rgb)('#c5916e'));
                    for (let i = 0; i < 3; i++)
                        g.rod((0, math_js_1.vec)(-.32, .23, -.23 + i * .2), (0, math_js_1.vec)(.32, .23, -.23 + i * .2), .024, .024, (0, geometry_js_1.rgb)('#5a7970'));
                }
            }
            else if (job.kind === 'coral') {
                g.ellipsoid((0, math_js_1.vec)(), (0, math_js_1.vec)(.55, .08, .48), (0, geometry_js_1.rgb)('#abc5b6'), 14, 5);
                if (job.done) {
                    const growth = .25 + job.stage * .14;
                    g.merge(templates[0], (0, math_js_1.vec)(), (0, math_js_1.vec)(growth, growth, growth));
                }
                else {
                    g.rod((0, math_js_1.vec)(-.4, 0, 0), (0, math_js_1.vec)(-.4, .45, 0), .023, .023, (0, geometry_js_1.rgb)('#efc784'));
                    g.box((0, math_js_1.vec)(-.4, .43, 0), (0, math_js_1.vec)(.23, .1, .035), (0, geometry_js_1.rgb)('#efc784'));
                }
            }
            else {
                g.rod((0, math_js_1.vec)(), (0, math_js_1.vec)(0, .6, 0), .035, .035, (0, geometry_js_1.rgb)('#6ca7a1'));
                g.box((0, math_js_1.vec)(0, .56, 0), (0, math_js_1.vec)(.5, .36, .04), (0, geometry_js_1.rgb)('#e3d9b3'));
                g.box((0, math_js_1.vec)(0, .56, -.026), (0, math_js_1.vec)(.35, .025, .009), (0, geometry_js_1.rgb)('#397a77'));
            }
            const m = this.mesh(job.id, g, 1);
            m.position.set(job.p.x, job.p.y, job.p.z);
            m.setEnabled(!(job.kind === 'debris' && job.done));
            this.jobMeshes.set(job.id, m);
        }
        const stage = (0, reef_recovery_js_1.recoveryForRun)(run, profile.reefs[site.id]), share = (0, reef_recovery_js_1.recoveryPopulationShare)(stage);
        // An immutable dive-start snapshot: population grows only on later visits.
        const qualityScale = this.settings.quality === 'high' ? 1 : this.settings.quality === 'low' ? .50 : .75;
        const total = Math.round((180 + share * 1400) * qualityScale);
        const schoolCenters = Array.from({ length: 8 }, (_, species) => ({
            center: (() => { const x = Math.sin(species * .85) * 19, z = -22 + (species * 13) % 55; return (0, math_js_1.vec)(x, Math.min(site.surface - 3, Math.max((0, data_js_1.floorHeight)(x, z, site) + 4, 4 + (species % 4) * 2)), z); })(),
            minRadius: 4,
            radiusSpan: 11
        }));
        schoolCenters.push({ center: (0, math_js_1.vec)(wreck.x - 3.4, wreck.y + 5.3, wreck.z + 1.2), minRadius: 3.2, radiusSpan: 8.5 }, { center: (0, math_js_1.vec)(pipe.x + 3.2, pipe.y + 4.4, pipe.z + .4), minRadius: 3, radiusSpan: 7.5 });
        for (let species = 0; species < schoolCenters.length; species++) {
            const members = [];
            const count = Math.round(total / schoolCenters.length);
            for (let i = 0; i < count; i++) {
                const { center, minRadius, radiusSpan } = schoolCenters[species];
                const seed = random() * 6.28, scale = .8 + random() * .6, radius = minRadius + random() * radiusSpan;
                members.push({ seed, center, scale, radius, motion: { position: (0, math_js_1.vec)(), heading: 0, orbitCenter: (0, fish_motion_js_1.prepareNativeOrbit)(site, center, radius, scale) } });
            }
            const mesh = this.mesh('school-' + species, (0, geometry_js_1.fishGeometry)('native', stage < 2 ? species % 2 : species % Math.min(8, stage + 3)), 2), matrices = new Float32Array(count * 16);
            mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
            mesh.alwaysSelectAsActiveMesh = true;
            this.nativeSchools.push({ mesh, matrices, members });
            this.environmentCounts.nativeFish += count;
        }
        this.environmentCounts.nativeSchools = schoolCenters.length;
        const bubbles = new geometry_js_1.Geometry();
        bubbles.ellipsoid((0, math_js_1.vec)(), (0, math_js_1.vec)(1, 1, 1), (0, geometry_js_1.rgb)('#caeeee'), 10, 6);
        this.bubbleMesh = this.mesh('regulator-bubbles', bubbles, 8);
        this.bubbleMesh.thinInstanceSetBuffer('matrix', this.bubbleMatrices, 16, false);
        this.bubbleMesh.alwaysSelectAsActiveMesh = true;
        this.arms = new B.Mesh('diver-rig', this.scene);
        this.leftArm = this.mesh('left-forearm', (0, diver_animation_js_1.forearmGeometry)(-1), 4);
        this.rightArm = this.mesh('right-forearm', (0, diver_animation_js_1.forearmGeometry)(1), 4);
        this.leftSleeve = this.mesh('left-sleeve', (0, diver_animation_js_1.sleeveGeometry)(), 4);
        this.rightSleeve = this.mesh('right-sleeve', (0, diver_animation_js_1.sleeveGeometry)(), 4);
        for (const m of [this.leftArm, this.rightArm, this.leftSleeve, this.rightSleeve]) {
            m.parent = this.arms;
            m.renderingGroupId = 1;
            m.alwaysSelectAsActiveMesh = true;
        }
        this.watch = new dive_watch_js_1.DiveWatch(this.scene, this.leftArm);
        this.watch.root.position.set(0, .10, -.20);
        this.watch.root.scaling.setAll(.78);
        this.spear = this.mesh('pole-spear', (0, geometry_js_1.equipment)('spear'), 4);
        this.tube = this.mesh('collection-tube', (0, geometry_js_1.equipment)('tube'), 4);
        this.scooter = this.mesh('minnow-scooter', (0, geometry_js_1.equipment)('scooter'), 4);
        this.held = this.mesh('exposed-lionfish', (0, geometry_js_1.fishGeometry)('lionfish'), 4);
        for (const m of [this.arms, this.spear, this.tube, this.scooter, this.held]) {
            m.parent = this.camera;
            m.renderingGroupId = 1;
            m.alwaysSelectAsActiveMesh = true;
        }
        this.tube.position.set(.14, -.20, .35);
        this.held.scaling.setAll(.40);
        this.held.position.set(.02, -.02, 2.25);
        this.held.rotation.z = .5;
        this.held.rotation.y = 1.4;
        this.atmosphere = '';
        this.render(0, false);
    }
    workChanged(id) {
        const j = this.run?.jobs.find(j => j.id === id), m = this.jobMeshes.get(id);
        if (!j || !m)
            return;
        if (j.kind === 'debris')
            m.setEnabled(false);
        if (j.kind === 'coral') {
            m.dispose();
            const g = new geometry_js_1.Geometry();
            g.ellipsoid((0, math_js_1.vec)(), (0, math_js_1.vec)(.55, .08, .48), (0, geometry_js_1.rgb)('#abc5b6'), 14, 5);
            g.merge((0, geometry_js_1.coral)(0, 130), (0, math_js_1.vec)(), (0, math_js_1.vec)(.38, .38, .38));
            const next = this.mesh(id, g, 1);
            next.position.set(j.p.x, j.p.y, j.p.z);
            this.jobMeshes.set(id, next);
        }
    }
    render(time, playing) {
        if (!this.run)
            return;
        const r = this.run, B = BABYLON;
        const p = playing ? r.p : (0, math_js_1.vec)(5 + Math.sin(time * .045) * 1.3, 7.2 + Math.sin(time * .12) * .15, -35);
        const yaw = playing ? r.yaw : -.16 + Math.sin(time * .05) * .08, pitch = playing ? r.pitch : .06;
        const night = !!r.night, torchLevel = this.profile ? (0, data_js_1.upgradeLevel)(this.profile, 'torch') : 0;
        const torchActive = playing && r.light && r.battery > 0;
        const torchIntensity = torchActive ? night ? 1.08 + torchLevel * .035 : .88 : 0;
        const torchCone = Math.max(7, 16 - Math.max(0, torchLevel - 1) * 2.2);
        const torchFalloff = Math.max(.012, .052 - Math.max(0, torchLevel - 1) * .008);
        const view = night ? 'night' : p.y > this.site.surface ? 'surface' : 'underwater';
        if (view !== this.atmosphere) {
            this.atmosphere = view;
            this.scene.clearColor = view === 'night' ? new B.Color4(.008, .025, .052, 1) : view === 'surface' ? new B.Color4(.48, .70, .76, 1) : (() => { const c = (0, geometry_js_1.rgb)('#' + (this.site.waterColor ?? 0x09505f).toString(16).padStart(6, '0')); return new B.Color4(c[0] * .65, c[1] * .70, c[2] * .80, 1); })();
        }
        this.camera.position.set(p.x, p.y, p.z);
        this.camera.rotation.set(pitch, yaw, 0);
        const dir = (0, math_js_1.direction)(yaw, pitch);
        this.forwardVector.set(dir.x, dir.y, dir.z);
        this.torchVector.x = torchCone;
        this.torchVector.y = torchFalloff;
        for (const m of this.materials) {
            m.setFloat('uTime', time);
            m.setFloat('uSurface', this.site.surface);
            m.setVector3('uEye', this.camera.position);
            m.setVector3('uForward', this.forwardVector);
            m.setFloat('uMotion', this.settings.reducedMotion ? 0 : 1);
            m.setFloat('uFog', this.site.biome === 'cenote' ? .020 : this.site.biome === 'harbour' ? .032 : this.site.id === 'passage' ? .034 : .028);
            const c = this.site.waterColor;
            if (!this.waterVector)
                this.waterVector = new B.Vector3();
            if (c !== undefined)
                this.waterVector.set(((c >> 16) & 255) / 255 * .42, ((c >> 8) & 255) / 255 * .60, (c & 255) / 255 * .70);
            else
                this.waterVector.set(.035, .31, .39);
            m.setVector3('uWaterColor', this.waterVector);
            m.setFloat('uNight', night ? 1 : 0);
            m.setFloat('uLight', torchIntensity);
            m.setVector2('uTorch', this.torchVector);
        }
        for (const f of r.fish) {
            const m = this.fishMeshes.get(f.id);
            m.setEnabled(f.alive);
            m.position.set(f.p.x, f.p.y, f.p.z);
            m.scaling.setAll(f.size);
            m.rotation.set(0, Math.sin(f.phase * .6) * .4 + f.phase * .07, Math.sin(f.phase) * .04);
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
                const { position: p, heading } = (0, fish_motion_js_1.nativeFishMotion)(this.site, member.center, member.radius, member.seed, time, member.scale, member.motion);
                this.nativeScale.setAll(member.scale);
                B.Quaternion.RotationYawPitchRollToRef(heading, 0, Math.sin(time + member.seed) * .04, this.nativeRotation);
                this.nativeTranslation.set(p.x, p.y, p.z);
                B.Matrix.ComposeToRef(this.nativeScale, this.nativeRotation, this.nativeTranslation, this.nativeTransform);
                this.nativeTransform.copyToArray(school.matrices, i * 16);
                i++;
                if ((0, math_js_1.distance)(p, r.p) < 6 && idx++ % 2 === 0)
                    this.nativeTargets.push({ p, r: .11 * member.scale });
            }
            school.mesh.thinInstanceBufferUpdated('matrix');
        }
        this.bubblePool.update(r, this.site, playing);
        this.nativeRotation.set(0, 0, 0, 1);
        this.bubblePool.bubbles.forEach((bubble, i) => {
            const age = r.time - bubble.born, size = age >= 0 && age < 3 ? bubble.size * (1 + age * .18) : 0;
            this.nativeScale.setAll(size);
            this.nativeTranslation.set(bubble.p.x, bubble.p.y, bubble.p.z);
            B.Matrix.ComposeToRef(this.nativeScale, this.nativeRotation, this.nativeTranslation, this.nativeTransform);
            this.nativeTransform.copyToArray(this.bubbleMatrices, i * 16);
        });
        this.bubbleMesh.thinInstanceBufferUpdated('matrix');
        const visible = playing;
        for (const m of [this.arms, this.tube])
            m.setEnabled(visible);
        this.spear.setEnabled(visible && !r.scooter && !this.watchRequested && this.watchBlend < .1);
        this.scooter.setEnabled(visible && r.scooter);
        this.held.setEnabled(visible && !!r.exposed);
        let stow = 0;
        for (const rock of this.site.rocks) {
            if (rock.hidden)
                continue;
            const dx = (r.p.x - rock.p.x) / rock.s.x, dy = (r.p.y - rock.p.y) / rock.s.y, dz = (r.p.z - rock.p.z) / rock.s.z;
            if (dx * dx + dy * dy + dz * dz < 1.45)
                stow = .15;
        }
        const sway = this.settings.reducedMotion ? 0 : Math.sin(time * 1.3) * .008;
        const thrust = r.strikeCooldown > .38 ? Math.sin((.75 - r.strikeCooldown) / .37 * Math.PI) * .38 : 0;
        this.spear.position.z = -r.charge * .25 + thrust - stow;
        this.spear.position.y = sway - stow;
        this.spear.rotation.x = stow * .8;
        const watchTarget = this.watchRequested && !r.scooter && r.charge === 0 ? 1 : 0;
        const poseDt = Math.max(0, Math.min(.083, time - this.lastPoseTime));
        this.lastPoseTime = time;
        this.watchBlend = this.settings.reducedMotion ? watchTarget : this.watchBlend + (watchTarget - this.watchBlend) * (1 - Math.exp(-poseDt * 11));
        if (Math.abs(this.watchBlend - watchTarget) < .001)
            this.watchBlend = watchTarget;
        const pose = (0, diver_animation_js_1.diverPose)(r, time, this.watchBlend, this.settings.reducedMotion, this.pose);
        // In portrait the raised instrument sits to the right of ascent controls.
        pose.left.x += this.watchBlend * Math.max(0, 1 - this.engine.getRenderWidth() / this.engine.getRenderHeight()) * .21;
        this.leftArm.position.set(pose.left.x, pose.left.y, pose.left.z);
        this.rightArm.position.set(pose.right.x, pose.right.y, pose.right.z);
        this.leftArm.rotation.set(-.08 * (1 - this.watchBlend), 0, pose.leftRoll);
        this.rightArm.rotation.set(0, 0, pose.rightRoll);
        const sleeve = (m, side, wrist) => {
            const x = side * .66, y = -.72, z = .18, dx = wrist.x + side * .08 - x, dy = wrist.y - .10 - y, dz = wrist.z - .22 - z;
            m.position.set(x, y, z);
            m.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0);
            m.scaling.z = Math.hypot(dx, dy, dz);
        };
        sleeve(this.leftSleeve, -1, pose.left);
        sleeve(this.rightSleeve, 1, pose.right);
        if (this.watch) {
            this.watch.root.setEnabled(visible);
            this.watch.setRaised(this.watchRequested);
            this.watch.update(r, this.site, this.profile, r.time, this.watchReserve);
        }
        this.scooter.position.y = sway;
        if (r.exposed) {
            this.held.position.z = 2.25 - r.interaction * .6;
            this.held.position.x = .02 - r.interaction * .5;
            this.held.position.y = -.02 - r.interaction * .28;
        }
        this.engine.beginFrame();
        this.engine._drawCalls?.fetchNewFrame();
        const encounter = r.encounter, encMeshes = this.encounterMeshes;
        if (encounter && encMeshes) {
            const t = r.time - encounter.start, visible = playing && t >= 0 && !['cleared', 'passed'].includes(encounter.phase), aboard = visible && ['warning', 'active'].includes(encounter.phase);
            encMeshes.boat.setEnabled(aboard);
            encMeshes.boat.position.set(encounter.p.x + Math.sin(Math.max(0, t) * .11) * 1.5, this.site.surface + .1, encounter.p.z);
            const inWater = visible && ['active', 'abandoned'].includes(encounter.phase), drop = Math.max(0, Math.min(1, (t - 12) / 20));
            encMeshes.object.setEnabled(inWater);
            encMeshes.object.position.set(encounter.p.x, this.site.surface - 1 + (encounter.p.y - this.site.surface + 1) * drop, encounter.p.z);
            encMeshes.line.setEnabled(inWater && encounter.kind === 'fishing');
            encMeshes.line.position.set(encounter.p.x, encounter.p.y, encounter.p.z);
        }
        this.shadows.render(r, this.site, this.settings.reducedMotion, !!torchActive, this.camera);
        for (const m of this.materials) {
            m.setMatrix('uSunMatrix', this.shadows.sunMatrix);
            m.setMatrix('uTorchMatrix', this.shadows.torchMatrix);
            m.setFloat('uShadows', this.shadows.enabled ? 1 : 0);
            m.setFloat('uTorchShadows', this.shadows.enabled && torchActive ? 1 : 0);
            m.setTexture('uSunShadow', this.shadows.sunTexture);
            m.setTexture('uTorchShadow', this.shadows.torchTexture);
        }
        this.scene.render();
        this.engine.endFrame();
        this.fps = this.engine.getFps();
        this.draws = this.engine._drawCalls?.current ?? 0;
        if (this.captureQueue.length) {
            const task = this.captureQueue.shift();
            try {
                const c = document.createElement('canvas');
                c.width = 480;
                c.height = 270;
                const ctx = c.getContext('2d');
                ctx.drawImage(this.canvas, 0, 0, c.width, c.height);
                task.callback(c.toDataURL('image/jpeg', .72));
            }
            catch {
                task.callback('');
            }
        }
    }
    capture(id, callback) {
        if (!this.captureQueue.some(c => c.id === id))
            this.captureQueue.push({ id, callback });
    }
    homeMarker() {
        const p = this.site.landmarks[0].p, c = this.camera.position, dir = (0, math_js_1.direction)(this.camera.rotation.y, this.camera.rotation.x);
        const behind = (0, math_js_1.dot)((0, math_js_1.norm)((0, math_js_1.sub)(p, c)), dir) < .1;
        if (behind)
            return { x: 50, y: 10, behind: true };
        const B = BABYLON, v = B.Vector3.Project(new B.Vector3(p.x, p.y - 1, p.z), B.Matrix.Identity(), this.scene.getTransformMatrix(), this.camera.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight()));
        return { x: (0, math_js_1.clamp)(v.x / this.engine.getRenderWidth() * 100, 7, 93), y: (0, math_js_1.clamp)(v.y / this.engine.getRenderHeight() * 100, 12, 78), behind: false };
    }
    screenshot() { this.scene.render(); return this.canvas.toDataURL('image/png'); }
    stats() { return { engine: BABYLON.Engine.Version, fps: Math.round(this.fps), drawCalls: this.draws, meshes: this.scene.meshes.length, vertices: this.scene.getTotalVertices(), renderSize: [this.engine.getRenderWidth(), this.engine.getRenderHeight()], watch: this.watch?.stats(), watchRaised: this.watchRaised, recoveryStage: this.run && this.profile ? (0, reef_recovery_js_1.recoveryForRun)(this.run, this.profile.reefs[this.run.site]) : 0, shadows: this.shadows.stats(), bubbles: this.bubblePool.active(this.run?.time ?? 0), bubbleEmissions: this.bubblePool.emitted, environmentCounts: { ...this.environmentCounts }, encounterMeshCount: this.encounterMeshes ? 3 : 0 }; }
}
exports.ReefRenderer = ReefRenderer;

},
"render/dive-watch.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiveWatch = void 0;
const data_js_1 = require("../game/data.js");
const math_js_1 = require("../game/math.js");
/** A small wrist-mounted dive computer. The display is a reusable RGBA texture. */
class DiveWatch {
    constructor(scene, parent) {
        this.lastDraw = -Infinity;
        this.raised = false;
        this.disposed = false;
        this.current = { air: 0, maxAir: 1, depth: 0, elapsed: 0, cargo: 0, capacity: 0, battery: 100, reserve: 0, low: false, exposed: false, site: '' };
        this.textureUpdates = 0;
        const B = BABYLON;
        this.scene = scene;
        B.Effect.ShadersStore['diveWatchVertexShader'] = `precision highp float; attribute vec3 position; attribute vec3 normal; attribute vec4 color; attribute vec2 uv; uniform mat4 world; uniform mat4 viewProjection; varying vec3 vColor; varying vec3 vNormal; varying vec2 vUV; void main(void){vColor=color.rgb;vNormal=normalize(mat3(world)*normal);vUV=uv;gl_Position=viewProjection*world*vec4(position,1.0);}`;
        B.Effect.ShadersStore['diveWatchFragmentShader'] = `precision highp float; varying vec3 vColor; varying vec3 vNormal; void main(void){float light=0.72+0.28*max(dot(normalize(vNormal),normalize(vec3(-0.25,0.4,-0.85))),0.0);gl_FragColor=vec4(vColor*light,1.0);}`;
        B.Effect.ShadersStore['diveWatchDisplayVertexShader'] = `precision highp float; attribute vec3 position; attribute vec2 uv; uniform mat4 world; uniform mat4 viewProjection; varying vec2 vUV; void main(void){vUV=uv;gl_Position=viewProjection*world*vec4(position,1.0);}`;
        B.Effect.ShadersStore['diveWatchDisplayFragmentShader'] = `precision highp float; varying vec2 vUV; uniform sampler2D displayTexture; void main(void){gl_FragColor=texture2D(displayTexture,vUV);}`;
        this.bodyMaterial = new B.ShaderMaterial('dive-watch-body', scene, { vertex: 'diveWatch', fragment: 'diveWatch' }, { attributes: ['position', 'normal', 'color'], uniforms: ['world', 'viewProjection'] });
        this.bodyMaterial.backFaceCulling = false;
        this.root = new B.Mesh('dive-watch-root', scene);
        if (parent)
            this.root.parent = parent;
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
        if (!context)
            throw new Error('Canvas rendering is required for the dive computer.');
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
    box(name, width, height, depth, x, y, z, color) {
        const B = BABYLON, mesh = new B.Mesh(name, this.scene), v = new B.VertexData();
        const x0 = -width / 2, x1 = width / 2, y0 = -height / 2, y1 = height / 2, z0 = -depth / 2, z1 = depth / 2;
        const positions = [
            x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
            x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1,
            x0, y0, z0, x0, y1, z0, x0, y1, z1, x0, y0, z1,
            x1, y0, z0, x1, y1, z0, x1, y1, z1, x1, y0, z1,
            x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1,
            x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1,
        ];
        const normals = [
            0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
            -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
            0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        ];
        const indices = [];
        for (let f = 0; f < 6; f++) {
            const i = f * 4;
            indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
        }
        const rgb = [parseInt(color.slice(1, 3), 16) / 255, parseInt(color.slice(3, 5), 16) / 255, parseInt(color.slice(5, 7), 16) / 255];
        const shade = [.60, 1, .80, .90, .68, 1];
        v.positions = positions;
        v.normals = normals;
        v.indices = indices;
        v.colors = shade.flatMap((scale) => [...rgb.map(n => n * scale), 1].concat([...rgb.map(n => n * scale), 1], [...rgb.map(n => n * scale), 1], [...rgb.map(n => n * scale), 1]));
        v.applyToMesh(mesh, false);
        mesh.material = this.bodyMaterial;
        mesh.position.set(x, y, z);
        mesh.parent = this.root;
        mesh.isPickable = false;
        mesh.renderingGroupId = 1;
        return mesh;
    }
    quad(name, width, height, depth, x, y, z, material) {
        const B = BABYLON, mesh = new B.Mesh(name, this.scene), v = new B.VertexData();
        v.positions = [-width / 2, -height / 2, -depth / 2, width / 2, -height / 2, -depth / 2, width / 2, height / 2, -depth / 2, -width / 2, height / 2, -depth / 2];
        v.normals = [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1];
        v.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
        v.indices = [0, 2, 1, 0, 3, 2];
        v.applyToMesh(mesh, false);
        mesh.material = material;
        mesh.position.set(x, y, z);
        mesh.parent = this.root;
        mesh.isPickable = false;
        mesh.renderingGroupId = 1;
        return mesh;
    }
    setRaised(value) {
        if (value === this.raised)
            return;
        this.raised = value;
        this.draw(true);
    }
    update(run, site, profile, time = run?.time ?? 0, reserve = 40) {
        if (this.disposed || !run)
            return;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (now - this.lastDraw < 200)
            return;
        const maxAir = (0, data_js_1.airCapacity)(profile), depth = Math.max(0, site.surface - run.p.y);
        this.current.air = run.air;
        this.current.maxAir = maxAir;
        this.current.depth = depth;
        this.current.elapsed = time;
        this.current.cargo = run.cargo.length;
        this.current.exposed = !!run.exposed;
        this.current.capacity = (0, data_js_1.capacity)(profile);
        this.current.battery = run.battery;
        this.current.reserve = reserve;
        this.current.low = run.air <= reserve;
        this.current.site = site.name;
        this.draw(false, now);
    }
    stats() { return { raised: this.raised, textureUpdates: this.textureUpdates, secured: this.current.cargo, exposed: this.current.exposed }; }
    draw(force, now = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
        if (!force && now - this.lastDraw < 200)
            return;
        this.lastDraw = now;
        const c = this.ctx, w = this.canvas.width, h = this.canvas.height, d = this.current;
        c.fillStyle = '#071716';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#102722';
        c.fillRect(7, 7, w - 14, h - 14);
        c.strokeStyle = '#668a69';
        c.lineWidth = 3;
        c.strokeRect(8.5, 8.5, w - 17, h - 17);
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillStyle = '#a4d89e';
        c.font = 'bold 18px Arial, sans-serif';
        c.fillText('REEF SWEEP', 22, 31);
        c.textAlign = 'right';
        c.fillStyle = '#a9c5a0';
        c.font = 'bold 12px Arial, sans-serif';
        c.fillText('DIVE COMPUTER', w - 22, 31);
        c.strokeStyle = '#52735a';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(20, 51);
        c.lineTo(w - 20, 51);
        c.stroke();
        const air = Math.max(0, Math.ceil(d.air)), ratio = Math.max(0, Math.min(1, d.air / Math.max(1, d.maxAir)));
        c.fillStyle = d.low ? '#ff9b70' : '#e3edc8';
        c.font = 'bold 65px Arial, sans-serif';
        c.textAlign = 'left';
        c.fillText(String(air), 20, 119);
        c.fillStyle = d.low ? '#ffb29a' : '#9fc69b';
        c.font = 'bold 17px Arial, sans-serif';
        c.fillText('AIR', 22, 157);
        c.textAlign = 'right';
        c.fillStyle = '#d0dfc5';
        c.font = 'bold 18px Arial, sans-serif';
        c.fillText('bar*', w - 20, 146);
        c.fillStyle = '#244137';
        c.fillRect(20, 174, w - 40, 12);
        c.fillStyle = d.low ? '#fa704d' : '#7bd5a4';
        c.fillRect(20, 174, (w - 40) * ratio, 12);
        c.fillStyle = '#8da98d';
        c.font = '13px Arial, sans-serif';
        c.textAlign = 'left';
        c.fillText(`HOME RESERVE ${Math.ceil(d.reserve)} bar`, 20, 207);
        c.strokeStyle = '#52735a';
        c.beginPath();
        c.moveTo(20, 227);
        c.lineTo(w - 20, 227);
        c.stroke();
        const row = (label, value, y, color = '#e3edc8') => { c.textAlign = 'left'; c.fillStyle = '#9fc69b'; c.font = 'bold 15px Arial, sans-serif'; c.fillText(label, 21, y); c.textAlign = 'right'; c.fillStyle = color; c.font = 'bold 23px Arial, sans-serif'; c.fillText(value, w - 21, y + 2); };
        row('DEPTH', d.depth < .05 ? 'SURFACE' : `${d.depth.toFixed(1)} m`, 261);
        row('ELAPSED', (0, math_js_1.timeText)(d.elapsed), 313);
        row('SECURED', `${Math.min(d.cargo, d.capacity)} / ${d.capacity}`, 365, d.cargo >= d.capacity ? '#ffd08a' : '#e3edc8');
        c.strokeStyle = '#52735a';
        c.beginPath();
        c.moveTo(20, 391);
        c.lineTo(w - 20, 391);
        c.stroke();
        if (d.low) {
            c.fillStyle = '#8d3228';
            c.fillRect(8, 395, w - 16, 19);
            c.textAlign = 'center';
            c.fillStyle = '#fff2d8';
            c.font = 'bold 15px Arial, sans-serif';
            c.fillText('LOW AIR · RETURN NOW', w / 2, 405);
        }
        else {
            c.textAlign = 'left';
            c.fillStyle = '#9fc69b';
            c.font = 'bold 12px Arial, sans-serif';
            c.fillText(d.exposed ? 'FISH ON SPEAR · EXPOSED' : d.site.toUpperCase(), 21, 404);
            c.textAlign = 'right';
            c.fillStyle = '#c4d7b7';
            c.fillText(`BAT ${Math.ceil(d.battery)}%`, w - 21, 404);
        }
        const bytes = c.getImageData(0, 0, w, h).data;
        this.texture.update(bytes);
        this.textureUpdates++;
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.root.dispose(false, false);
        this.bodyMaterial.dispose();
        this.displayMaterial.dispose();
        this.texture.dispose();
    }
}
exports.DiveWatch = DiveWatch;

},
"render/diver-animation.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forearmGeometry = forearmGeometry;
exports.sleeveGeometry = sleeveGeometry;
exports.diverPose = diverPose;
const math_js_1 = require("../game/math.js");
const geometry_js_1 = require("./geometry.js");
/** Separate wrists and elbow sleeves give tools purposeful hand movement. */
function forearmGeometry(side) {
    const g = new geometry_js_1.Geometry(), rubber = (0, geometry_js_1.rgb)('#102b32'), seam = (0, geometry_js_1.rgb)('#59b9a9');
    g.rod((0, math_js_1.vec)(side * .11, -.10, -.24), (0, math_js_1.vec)(), .098, .076, rubber, 14);
    g.rod((0, math_js_1.vec)(side * .03, -.025, -.06), (0, math_js_1.vec)(), .083, .080, seam, 14);
    g.ellipsoid((0, math_js_1.vec)(-side * .04, .012, .115), (0, math_js_1.vec)(.085, .062, .10), rubber, 14, 9);
    for (let finger = 0; finger < 4; finger++) {
        const x = -side * .04 + (finger - 1.5) * .031;
        g.rod((0, math_js_1.vec)(x, .015, .16), (0, math_js_1.vec)(x, -.022, .225 - finger * .006), .014, .012, rubber, 7);
        g.rod((0, math_js_1.vec)(x, -.022, .225 - finger * .006), (0, math_js_1.vec)(x, -.057, .20 - finger * .006), .012, .009, rubber, 7);
    }
    g.rod((0, math_js_1.vec)(-side * .095, 0, .12), (0, math_js_1.vec)(-side * .13, -.04, .18), .022, .014, rubber, 8);
    return g;
}
function sleeveGeometry() {
    const g = new geometry_js_1.Geometry();
    g.rod((0, math_js_1.vec)(), (0, math_js_1.vec)(0, 0, 1), .118, .10, (0, geometry_js_1.rgb)('#20434c'), 14);
    g.rod((0, math_js_1.vec)(0, 0, .25), (0, math_js_1.vec)(0, 0, .35), .122, .122, (0, geometry_js_1.rgb)('#3e847f'), 14);
    return g;
}
function diverPose(run, time, watch, reducedMotion, output) {
    const pose = output ?? { left: (0, math_js_1.vec)(), right: (0, math_js_1.vec)(), leftRoll: 0, rightRoll: 0, reach: 0, thrust: 0 };
    const speed = (0, math_js_1.clamp)(Math.hypot(run.velocity.x, run.velocity.y, run.velocity.z) / 2.7, 0, 1);
    const swim = reducedMotion ? 0 : Math.sin(time * 2.5) * speed * (run.charge > 0 ? .007 : .022);
    const breathing = reducedMotion ? 0 : Math.sin(time * 1.3) * .007;
    const thrust = run.strikeCooldown > .38 ? Math.sin((.75 - run.strikeCooldown) / .37 * Math.PI) * .23 : 0;
    const reach = run.interaction > 0 ? Math.sin((0, math_js_1.clamp)(run.interaction, 0, 1) * Math.PI * .75) * .15 : 0;
    const leftX = run.scooter ? -.37 : -.38 - reach * .9, leftZ = run.scooter ? .60 : .82 + reach;
    pose.left.x = leftX * (1 - watch) - .035 * watch;
    pose.left.y = ((run.scooter ? -.24 : -.45) + breathing + swim + reach * .35) * (1 - watch) - .13 * watch;
    pose.left.z = leftZ * (1 - watch) + .68 * watch;
    pose.right.x = run.scooter ? .37 : .29;
    pose.right.y = (run.scooter ? -.24 : -.37) + breathing - swim * .6;
    pose.right.z = (run.scooter ? .60 : .95) - run.charge * .16 + thrust;
    pose.leftRoll = watch * .16 + (1 - watch) * (-.20 + swim);
    pose.rightRoll = .14 - swim;
    pose.reach = reach;
    pose.thrust = thrust;
    return pose;
}

},
"render/geometry.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Geometry = exports.cross = exports.tint = exports.rgb = void 0;
exports.islandGeometry = islandGeometry;
exports.coral = coral;
exports.seaweedGeometry = seaweedGeometry;
exports.shipwreckGeometry = shipwreckGeometry;
exports.sewagePipeGeometry = sewagePipeGeometry;
exports.fishGeometry = fishGeometry;
exports.equipment = equipment;
/** Original procedural art. Metres, +Y up, creature noses +Z. All meshes share
 * a vertex-colour material, so reefs can be batched without texture atlases. */
const math_js_1 = require("../game/math.js");
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
exports.rgb = rgb;
const tint = (c, n) => [c[0] * n, c[1] * n, c[2] * n];
exports.tint = tint;
const cross = (a, b) => (0, math_js_1.vec)(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
exports.cross = cross;
class Geometry {
    constructor() {
        this.positions = [];
        this.normals = [];
        this.colors = [];
        this.uvs = [];
        this.indices = [];
    }
    v(p, n, c, u = 0, v = 0) { const i = this.positions.length / 3; this.positions.push(p.x, p.y, p.z); this.normals.push(n.x, n.y, n.z); this.colors.push(...c, 1); this.uvs.push(u, v); return i; }
    tri(a, b, c, color, sway = 0) { const n = (0, math_js_1.norm)((0, exports.cross)((0, math_js_1.sub)(b, a), (0, math_js_1.sub)(c, a))), i = this.v(a, n, color, 0, sway); this.v(b, n, color, 1, sway); this.v(c, n, color, .5, sway); this.indices.push(i, i + 1, i + 2); }
    quad(a, b, c, d, color, sway = 0) { this.tri(a, b, c, color, sway); this.tri(a, c, d, color, sway); }
    ellipsoid(p, s, c, segments = 14, rings = 9, paint) {
        const start = this.positions.length / 3;
        for (let j = 0; j <= rings; j++) {
            const lat = j / rings * Math.PI;
            for (let i = 0; i <= segments; i++) {
                const lon = i / segments * Math.PI * 2, x = Math.sin(lat) * Math.cos(lon), y = Math.cos(lat), z = Math.sin(lat) * Math.sin(lon);
                const n = (0, math_js_1.norm)((0, math_js_1.vec)(x / s.x, y / s.y, z / s.z));
                this.v((0, math_js_1.vec)(p.x + x * s.x, p.y + y * s.y, p.z + z * s.z), n, paint ? paint(x, y, z) : c, i / segments, 0);
            }
        }
        for (let j = 0; j < rings; j++)
            for (let i = 0; i < segments; i++) {
                const a = start + j * (segments + 1) + i, b = a + segments + 1;
                this.indices.push(a, b, a + 1, b, b + 1, a + 1);
            }
    }
    rod(a, b, r1, r2, c, segments = 7, sway = 0) {
        const d = (0, math_js_1.norm)((0, math_js_1.sub)(b, a)), u = (0, math_js_1.norm)((0, exports.cross)(d, Math.abs(d.y) > .9 ? (0, math_js_1.vec)(1, 0, 0) : (0, math_js_1.vec)(0, 1, 0))), v = (0, exports.cross)(d, u);
        const start = this.positions.length / 3;
        for (let j = 0; j < 2; j++)
            for (let i = 0; i <= segments; i++) {
                const q = i / segments * Math.PI * 2, n = (0, math_js_1.add)((0, math_js_1.scale)(u, Math.cos(q)), (0, math_js_1.scale)(v, Math.sin(q))), p = (0, math_js_1.add)(j ? b : a, (0, math_js_1.scale)(n, j ? r2 : r1));
                this.v(p, n, c, i / segments, j * sway);
            }
        for (let i = 0; i < segments; i++) {
            const k = start + i;
            this.indices.push(k, k + segments + 1, k + 1, k + 1, k + segments + 1, k + segments + 2);
        }
        this.tri((0, math_js_1.add)(b, (0, math_js_1.scale)(u, r2)), (0, math_js_1.add)(b, (0, math_js_1.scale)(v, r2)), (0, math_js_1.add)(b, (0, math_js_1.scale)(u, -r2)), c, sway);
    }
    box(p, s, c) { const [x, y, z] = [s.x / 2, s.y / 2, s.z / 2], v = (a, b, d) => (0, math_js_1.vec)(p.x + a * x, p.y + b * y, p.z + d * z); this.quad(v(-1, 1, -1), v(1, 1, -1), v(1, 1, 1), v(-1, 1, 1), (0, exports.tint)(c, 1.1)); this.quad(v(-1, -1, 1), v(1, -1, 1), v(1, -1, -1), v(-1, -1, -1), (0, exports.tint)(c, .65)); this.quad(v(-1, -1, 1), v(-1, 1, 1), v(1, 1, 1), v(1, -1, 1), c); this.quad(v(1, -1, -1), v(1, 1, -1), v(-1, 1, -1), v(-1, -1, -1), c); this.quad(v(1, -1, 1), v(1, 1, 1), v(1, 1, -1), v(1, -1, -1), (0, exports.tint)(c, .8)); this.quad(v(-1, -1, -1), v(-1, 1, -1), v(-1, 1, 1), v(-1, -1, 1), (0, exports.tint)(c, .8)); }
    merge(g, p = (0, math_js_1.vec)(), s = (0, math_js_1.vec)(1, 1, 1), yaw = 0) {
        const offset = this.positions.length / 3, co = Math.cos(yaw), si = Math.sin(yaw);
        for (let i = 0; i < g.positions.length; i += 3) {
            const x = g.positions[i] * s.x, z = g.positions[i + 2] * s.z;
            this.positions.push(p.x + x * co + z * si, p.y + g.positions[i + 1] * s.y, p.z + z * co - x * si);
            const n = (0, math_js_1.norm)((0, math_js_1.vec)(g.normals[i] / s.x, g.normals[i + 1] / s.y, g.normals[i + 2] / s.z));
            this.normals.push(n.x * co + n.z * si, n.y, n.z * co - n.x * si);
        }
        this.colors.push(...g.colors);
        this.uvs.push(...g.uvs);
        for (const idx of g.indices)
            this.indices.push(idx + offset);
    }
}
exports.Geometry = Geometry;
/** Shore-connected terrain with angular ridges, sand and rock bands. */
function islandGeometry(seed, foundationDepth = 45) {
    const g = new Geometry(), random = (0, math_js_1.rng)(seed), phase = random() * Math.PI * 2;
    const width = 28, depth = 20;
    const terrain = (x, z) => {
        const angle = Math.atan2(z, x), boundary = 1 + .13 * Math.sin(angle * 3 + phase) + .07 * Math.cos(angle * 5 - phase);
        const radius = Math.hypot(x, z) / boundary;
        let height = -1.4;
        if (radius < 1)
            height = -.6 + Math.min(.25, 1 - radius) * 11;
        if (radius < .75) {
            const ridges = 17 * Math.exp(-((x + .32) ** 2 / .08 + (z - .06) ** 2 / .25))
                + 11 * Math.exp(-((x - .16) ** 2 / .12 + (z + .20) ** 2 / .09))
                + 7 * Math.exp(-((x - .50) ** 2 / .10 + (z - .24) ** 2 / .11));
            height += ridges * Math.min(1, (.75 - radius) / .18);
        }
        return { point: (0, math_js_1.vec)(x * 24, height, z * 16), radius };
    };
    const occupied = Array.from({ length: depth }, () => Array(width).fill(false));
    for (let iz = 0; iz < depth; iz++)
        for (let ix = 0; ix < width; ix++) {
            const x = -1.2 + ix * 2.4 / width, z = -1.2 + iz * 2.4 / depth;
            const a = terrain(x, z), b = terrain(x, z + 2.4 / depth), c = terrain(x + 2.4 / width, z + 2.4 / depth), d = terrain(x + 2.4 / width, z);
            if ([a, b, c, d].every(p => p.radius > 1.12))
                continue;
            occupied[iz][ix] = true;
            const height = (a.point.y + b.point.y + c.point.y + d.point.y) / 4;
            const color = (0, exports.rgb)(height < .8 ? '#b9ad82' : height < 3 ? '#7c8170' : '#395b3c');
            g.quad(a.point, b.point, c.point, d.point, (0, exports.tint)(color, .9 + random() * .15));
        }
    // Trace the exact outline of the clipped terrain cells. Extruding these
    // boundary edges makes the submerged rock meet the original shore without
    // a floating lip or a gap around its irregular grid edge.
    const bottom = -Math.max(45, Number.isFinite(foundationDepth) ? foundationDepth : 45);
    const boundaryEdges = [];
    const isOccupied = (ix, iz) => iz >= 0 && iz < depth && ix >= 0 && ix < width && occupied[iz][ix];
    for (let iz = 0; iz < depth; iz++)
        for (let ix = 0; ix < width; ix++) {
            if (!occupied[iz][ix])
                continue;
            const nw = { x: ix, z: iz }, ne = { x: ix + 1, z: iz }, se = { x: ix + 1, z: iz + 1 }, sw = { x: ix, z: iz + 1 };
            if (!isOccupied(ix, iz - 1))
                boundaryEdges.push({ a: nw, b: ne });
            if (!isOccupied(ix + 1, iz))
                boundaryEdges.push({ a: ne, b: se });
            if (!isOccupied(ix, iz + 1))
                boundaryEdges.push({ a: se, b: sw });
            if (!isOccupied(ix - 1, iz))
                boundaryEdges.push({ a: sw, b: nw });
        }
    const gridKey = (point) => `${point.x},${point.z}`;
    const edgeFrom = new Map(boundaryEdges.map(edge => [gridKey(edge.a), edge]));
    const perimeter = [];
    if (boundaryEdges.length) {
        const first = boundaryEdges[0];
        let edge = first;
        do {
            perimeter.push(edge.a);
            const next = edgeFrom.get(gridKey(edge.b));
            if (!next)
                throw new Error('Island terrain boundary is not a closed loop');
            edge = next;
        } while (edge !== first && perimeter.length <= boundaryEdges.length);
        if (edge !== first)
            throw new Error('Island terrain boundary contains multiple or open loops');
    }
    const levels = [
        { y: -1.4, growth: 0 },
        { y: -5, growth: .08 },
        { y: -12, growth: .28 },
        { y: -22, growth: .58 },
        { y: bottom * .76, growth: .88 },
        { y: bottom, growth: 1.02 },
    ];
    const rings = [];
    for (let level = 0; level < levels.length; level++) {
        const { y, growth } = levels[level];
        const previous = levels[Math.max(0, level - 1)], next = levels[Math.min(levels.length - 1, level + 1)];
        const drdy = (next.growth - previous.growth) / (next.y - previous.y || 1);
        const ring = [];
        for (let pointIndex = 0; pointIndex < perimeter.length; pointIndex++) {
            const point = perimeter[pointIndex];
            const x = -1.2 + point.x * 2.4 / width, z = -1.2 + point.z * 2.4 / depth;
            const shore = terrain(x, z).point, angle = Math.atan2(shore.z / 16, shore.x / 24);
            const shoreRadius = Math.hypot(shore.x / 24, shore.z / 16);
            const organic = growth * (.025 * Math.sin(angle * 3 + phase) + .018 * Math.cos(angle * 5 - phase));
            const r = shoreRadius + growth + organic;
            const normal = (0, math_js_1.norm)((0, math_js_1.vec)(Math.cos(angle) / 24, -drdy, Math.sin(angle) / 16));
            const position = level === 0 ? shore : (0, math_js_1.vec)(Math.cos(angle) * r * 24, y, Math.sin(angle) * r * 16);
            ring.push(g.v(position, normal, level < 2 ? (0, exports.rgb)('#8b8775') : level < 4 ? (0, exports.rgb)('#625f56') : (0, exports.rgb)('#484a45'), pointIndex / perimeter.length, level / (levels.length - 1)));
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
    const bottomCenter = g.v((0, math_js_1.vec)(0, bottom, 0), (0, math_js_1.vec)(0, -1, 0), (0, exports.rgb)('#41443f'));
    const bottomRing = rings[rings.length - 1];
    for (let segment = 0; segment < bottomRing.length; segment++)
        g.indices.push(bottomCenter, bottomRing[segment], bottomRing[(segment + 1) % bottomRing.length]);
    return g;
}
function coral(kind, seed) {
    const g = new Geometry(), r = (0, math_js_1.rng)(seed), palette = ['#efaa79', '#db7f96', '#887ac0', '#74b6ac', '#d8bc85', '#649eae'], c = (0, exports.rgb)(palette[kind % palette.length]);
    if (kind === 0 || kind === 4) {
        const branches = kind === 0 ? 5 : 8;
        for (let i = 0; i < branches; i++) {
            const angle = i / branches * Math.PI * 2, a = (0, math_js_1.vec)(0, 0, 0), b = (0, math_js_1.vec)(Math.cos(angle) * .2, .45 + r() * .35, Math.sin(angle) * .2);
            g.rod(a, b, .085, .038, c, 6, .12);
            for (let j = 0; j < 3; j++) {
                const q = angle + j * 1.8, end = (0, math_js_1.add)(b, (0, math_js_1.vec)(Math.cos(q) * .33, .3 + r() * .32, Math.sin(q) * .33));
                g.rod(b, end, .035, .012, (0, exports.tint)(c, 1.12), 6, .28);
                g.ellipsoid(end, (0, math_js_1.vec)(.024, .023, .024), (0, exports.tint)(c, 1.27), 5, 3);
            }
        }
    }
    else if (kind === 1) {
        for (let i = 0; i < 6; i++) {
            const a = (0, math_js_1.vec)((r() - .5) * .8, 0, (r() - .5) * .8), h = .35 + r() * .9, rad = .11 + r() * .13;
            g.rod(a, (0, math_js_1.add)(a, (0, math_js_1.vec)(.06, h, 0)), rad * .8, rad, c, 10);
            g.ellipsoid((0, math_js_1.add)(a, (0, math_js_1.vec)(.06, h + .01, 0)), (0, math_js_1.vec)(rad * .72, .025, rad * .72), (0, exports.rgb)('#7b4c70'), 10, 3);
        }
    }
    else if (kind === 2 || kind === 5) {
        g.rod((0, math_js_1.vec)(), (0, math_js_1.vec)(0, .45, 0), .06, .035, (0, exports.tint)(c, .7));
        const a = (0, math_js_1.vec)(0, .3, 0);
        for (let i = 0; i < 13; i++) {
            const theta = -1.28 + i / 12 * 2.56, end = (0, math_js_1.vec)(Math.sin(theta) * .85, .45 + Math.cos(theta) * 1.15, Math.sin(i * .7) * .08);
            g.rod(a, end, .026, .009, c, 5, .7);
            for (let j = 1; j < 6; j++) {
                const t = j / 6, p = (0, math_js_1.add)(a, (0, math_js_1.scale)((0, math_js_1.sub)(end, a), t)), e = (0, math_js_1.add)(p, (0, math_js_1.vec)(.13, .05, 0));
                g.rod(p, e, .012, .006, (0, exports.tint)(c, .92), 4, .6);
            }
        }
        for (let i = 0; i < 12; i++) {
            const aa = -1.28 + i / 12 * 2.56, bb = aa + 2.56 / 12;
            g.tri(a, (0, math_js_1.vec)(Math.sin(aa) * .84, .45 + Math.cos(aa) * 1.14, 0), (0, math_js_1.vec)(Math.sin(bb) * .84, .45 + Math.cos(bb) * 1.14, 0), (0, exports.tint)(c, .85), .5);
        }
    }
    else {
        for (let i = 0; i < 4; i++) {
            const y = .15 + i * .2, rad = .85 - i * .12;
            g.ellipsoid((0, math_js_1.vec)(i * .08, y, 0), (0, math_js_1.vec)(rad, .11, rad * .7), (0, exports.tint)(c, 1 + i * .05), 18, 5);
        }
    }
    return g;
}
/** Rooted segmented fronds. UV.y is distance from the anchored root to the tip. */
function seaweedGeometry(seed, height = 1) {
    const g = new Geometry(), random = (0, math_js_1.rng)(seed), greens = ['#477f69', '#5d9771', '#77a67a', '#3e705f'];
    const count = 5 + Math.floor(random() * 4);
    for (let blade = 0; blade < count; blade++) {
        const angle = random() * Math.PI * 2, length = height * (.72 + random() * .72), width = .035 + random() * .04;
        const phase = random(), curve = (random() - .5) * .2, color = (0, exports.rgb)(greens[Math.floor(random() * greens.length)]);
        const start = g.positions.length / 3, steps = 9;
        for (let step = 0; step <= steps; step++) {
            const t = step / steps, bend = t * t;
            const cx = Math.cos(angle) * .045 * t + Math.sin(t * 3.1 + phase * 6.28) * curve * bend;
            const cz = Math.sin(angle) * .045 * t + Math.cos(t * 2.7 + phase * 6.28) * curve * bend;
            const half = width * (1 - .68 * t) * (.82 + .18 * Math.sin(t * Math.PI));
            const sx = -Math.sin(angle) * half, sz = Math.cos(angle) * half;
            const y = length * t, n = (0, math_js_1.norm)((0, math_js_1.vec)(Math.cos(angle), .2, Math.sin(angle)));
            const shade = .78 + .30 * (1 - t) + .08 * Math.sin(blade * 3 + t * 7);
            g.v((0, math_js_1.vec)(cx - sx, y, cz - sz), n, (0, exports.tint)(color, shade), phase, t);
            g.v((0, math_js_1.vec)(cx + sx, y, cz + sz), n, (0, exports.tint)(color, shade * .92), phase, t);
        }
        for (let step = 0; step < steps; step++) {
            const a = start + step * 2, b = a + 2;
            g.indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
    return g;
}
/** Original low-poly wreck ribs and broken planking, aligned along +Z. */
function shipwreckGeometry() {
    const g = new Geometry(), iron = (0, exports.rgb)('#72574a'), rust = (0, exports.rgb)('#a26d4b'), wood = (0, exports.rgb)('#69584c'), dark = (0, exports.rgb)('#283d3d');
    g.rod((0, math_js_1.vec)(0, -.9, -7.6), (0, math_js_1.vec)(0, -.62, 7.6), .25, .18, iron, 10);
    for (let rib = 0; rib <= 10; rib++) {
        const z = -7.5 + rib * 1.5, broken = rib % 3 === 1;
        const half = 2.6 - Math.abs(rib - 5) * .08;
        const keel = (0, math_js_1.vec)(0, -.78, z), port = (0, math_js_1.vec)(-half, -.15, z), starboard = (0, math_js_1.vec)(half, -.15, z);
        g.rod(keel, port, .11, .075, rib % 2 ? iron : rust, 6);
        g.rod(keel, starboard, .11, .075, iron, 6);
        g.rod(port, (0, math_js_1.vec)(-half * .82, .65, z), .075, .05, rust, 6);
        if (!broken)
            g.rod((0, math_js_1.vec)(-half * .82, .65, z), (0, math_js_1.vec)(half * .82, .65, z), .05, .05, iron, 6);
        g.rod(starboard, (0, math_js_1.vec)(half * .82, .65, z), .075, .05, iron, 6);
    }
    for (let board = 0; board < 9; board++) {
        const z = -6.6 + board * 1.55, x = (board % 3 - 1) * .48, y = -.2 + (board % 2) * .08;
        g.box((0, math_js_1.vec)(x, y, z), (0, math_js_1.vec)(3.15 - (board % 3) * .2, .12, 1.1), board % 2 ? wood : rust);
    }
    // Remaining hull planks join the ribs into a recognizable broken boat.
    for (const side of [-1, 1])
        for (let rib = 0; rib < 10; rib++) {
            if ((rib + (side > 0 ? 1 : 0)) % 4 === 1)
                continue;
            const z = -7.5 + rib * 1.5, nextZ = z + 1.5;
            const half = 2.6 - Math.abs(rib - 5) * .08, nextHalf = 2.6 - Math.abs(rib + 1 - 5) * .08;
            g.quad((0, math_js_1.vec)(side * half, -.4, z), (0, math_js_1.vec)(side * nextHalf, -.4, nextZ), (0, math_js_1.vec)(side * nextHalf * .82, .65, nextZ), (0, math_js_1.vec)(side * half * .82, .65, z), rib % 2 ? wood : rust);
        }
    g.rod((0, math_js_1.vec)(-.5, -.55, -1), (0, math_js_1.vec)(-.2, 2.8, 1.6), .09, .055, iron, 7);
    g.rod((0, math_js_1.vec)(-.2, 2.8, 1.6), (0, math_js_1.vec)(1.8, 1.6, 2.3), .045, .025, rust, 6);
    g.rod((0, math_js_1.vec)(-2, -.1, -7.2), (0, math_js_1.vec)(2, -.1, -7.2), .12, .12, dark, 8);
    return g;
}
/** Corroded old outfall pipe, open mouth faces local +Z; visual only. */
function sewagePipeGeometry(length = 10, radius = 1.2) {
    const g = new Geometry(), iron = (0, exports.rgb)('#765747'), rust = (0, exports.rgb)('#a36d4d'), dark = (0, exports.rgb)('#1d3033');
    const startZ = -length / 2, endZ = length / 2;
    g.ellipsoid((0, math_js_1.vec)(0, 0, startZ + .025), (0, math_js_1.vec)(radius * .78, radius * .78, .035), dark, 18, 10);
    for (let band = 0; band < 6; band++) {
        const z = startZ + (length - 1.5) * band / 5;
        for (let i = 0; i < 16; i++) {
            const a = i / 16 * Math.PI * 2, b = (i + 1) / 16 * Math.PI * 2;
            const p = (q) => (0, math_js_1.vec)(Math.cos(q) * radius, Math.sin(q) * radius, z);
            g.rod(p(a), p(b), .055, .055, band % 2 ? rust : iron, 4);
        }
    }
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2, x = Math.cos(a) * radius, y = Math.sin(a) * radius;
        g.rod((0, math_js_1.vec)(x, y, startZ), (0, math_js_1.vec)(x, y, endZ), .075, .075, i % 3 ? iron : rust, 6);
    }
    // Corroded shell panels, with a few actual breaches between reinforcing rings.
    for (let section = 0; section < 6; section++)
        for (let i = 0; i < 18; i++) {
            if ((i + section * 3) % 17 === 0 || section === 3 && i > 3 && i < 7)
                continue;
            const a = i / 18 * Math.PI * 2, b = (i + 1) / 18 * Math.PI * 2;
            const z = startZ + length * section / 6, end = startZ + length * (section + 1) / 6;
            const p = (angle, depth) => (0, math_js_1.vec)(Math.cos(angle) * radius, Math.sin(angle) * radius, depth);
            g.quad(p(a, z), p(b, z), p(b, end), p(a, end), (section + i) % 4 ? iron : rust);
        }
    for (let i = 0; i < 18; i++) {
        const a = i / 18 * Math.PI * 2, b = (i + 1) / 18 * Math.PI * 2;
        const point = (q) => (0, math_js_1.vec)(Math.cos(q) * radius, Math.sin(q) * radius, startZ);
        g.rod(point(a), point(b), .09, .09, i % 3 ? rust : iron, 5);
    }
    for (let i = 0; i < 4; i++) {
        const z = startZ + length * (.28 + i * .13), side = i % 2 ? 1 : -1;
        g.box((0, math_js_1.vec)(side * radius * .96, -.12, z), (0, math_js_1.vec)(.28, .13, 1.35), rust);
    }
    return g;
}
function fishGeometry(kind, variant = 0) {
    const g = new Geometry(), cream = (0, exports.rgb)('#efdbbb'), dark = (0, exports.rgb)('#162b32');
    if (kind === 'lionfish') {
        const red = (0, exports.rgb)('#884334');
        g.ellipsoid((0, math_js_1.vec)(0, 0, .08), (0, math_js_1.vec)(.27, .32, .6), red, 26, 18, (x, y, z) => Math.sin(z * 29 + y * 4) > 0 ? cream : red);
        for (const side of [-1, 1]) {
            for (let i = 0; i < 11; i++) {
                const a = (0, math_js_1.vec)(side * .17, -.02, .27), angle = -1.1 + i / 10 * 2.1, tip = (0, math_js_1.vec)(side * (.3 + Math.cos(angle) * .65), Math.sin(angle) * .55, -.05 - i * .025);
                g.rod(a, tip, .014, .004, i % 2 ? cream : red, 4);
                if (i < 10) {
                    const next = (0, math_js_1.vec)(side * (.3 + Math.cos(angle + .21) * .65), Math.sin(angle + .21) * .55, -.075 - i * .025);
                    g.tri(a, tip, next, i % 2 ? cream : red);
                }
            }
            g.ellipsoid((0, math_js_1.vec)(side * .19, .13, .52), (0, math_js_1.vec)(.068, .07, .048), cream, 8, 5);
            g.ellipsoid((0, math_js_1.vec)(side * .225, .13, .542), (0, math_js_1.vec)(.033, .04, .028), dark, 7, 5);
        }
        for (let i = 0; i < 12; i++) {
            const z = .42 - i * .081, h = .35 + Math.sin(i / 11 * Math.PI) * .42;
            g.rod((0, math_js_1.vec)(0, .23, z), (0, math_js_1.vec)(Math.sin(i) * .06, .24 + h, z - .12), .013, .002, i % 2 ? cream : red, 4);
        }
        g.tri((0, math_js_1.vec)(0, 0, -.38), (0, math_js_1.vec)(-.04, .34, -.93), (0, math_js_1.vec)(0, 0, -.86), cream);
        g.tri((0, math_js_1.vec)(0, 0, -.38), (0, math_js_1.vec)(0, 0, -.86), (0, math_js_1.vec)(.04, -.32, -.93), red);
        g.ellipsoid((0, math_js_1.vec)(0, -.04, .59), (0, math_js_1.vec)(.11, .10, .07), red, 8, 5);
    }
    else if (kind === 'marlow') {
        const base = (0, exports.rgb)('#929574');
        g.ellipsoid((0, math_js_1.vec)(), (0, math_js_1.vec)(.62, .65, 1.36), base, 30, 20, (x, y, z) => { const spots = Math.sin(x * 39 + y * 27 + z * 15) * Math.sin(z * 31 - y * 24); return Math.abs(spots) > .54 ? (0, exports.rgb)('#555f50') : (0, exports.tint)(base, .91 + y * .12); });
        g.ellipsoid((0, math_js_1.vec)(0, -.09, 1.08), (0, math_js_1.vec)(.50, .38, .43), (0, exports.tint)(base, .96), 22, 14);
        g.ellipsoid((0, math_js_1.vec)(0, -.12, 1.44), (0, math_js_1.vec)(.30, .075, .06), (0, exports.rgb)('#304137'), 18, 8);
        g.ellipsoid((0, math_js_1.vec)(0, -.21, 1.40), (0, math_js_1.vec)(.31, .058, .075), (0, exports.tint)(base, 1.06), 16, 7);
        for (const side of [-1, 1]) {
            g.ellipsoid((0, math_js_1.vec)(side * .46, .20, 1.02), (0, math_js_1.vec)(.058, .065, .051), (0, exports.rgb)('#c3b779'), 12, 8);
            g.ellipsoid((0, math_js_1.vec)(side * .495, .20, 1.05), (0, math_js_1.vec)(.031, .040, .027), dark, 9, 6);
            const root = (0, math_js_1.vec)(side * .47, -.09, .48);
            for (let i = 0; i < 7; i++) {
                const t = i / 7, tt = (i + 1) / 7;
                const p = (0, math_js_1.vec)(side * (.49 + Math.sin(t * Math.PI) * .43), -.14 - t * .4, .26 - t * .77), q = (0, math_js_1.vec)(side * (.49 + Math.sin(tt * Math.PI) * .43), -.14 - tt * .4, .26 - tt * .77);
                g.tri(root, p, q, (0, exports.tint)(base, .88));
                g.rod(root, p, .008, .003, (0, exports.tint)(base, .72), 4);
            }
            const points = [(0, math_js_1.vec)(side * .42, .34, .93), (0, math_js_1.vec)(side * .56, .17, .76), (0, math_js_1.vec)(side * .58, -.08, .67), (0, math_js_1.vec)(side * .48, -.37, .69)];
            for (let i = 0; i < points.length - 1; i++)
                g.rod(points[i], points[i + 1], .011, .01, (0, exports.tint)(base, .58), 5);
        }
        for (let i = 0; i < 11; i++) {
            const z = .65 - i * .16, zn = z - .16, y = .53 + Math.sin(i / 11 * Math.PI) * .26, yn = .53 + Math.sin((i + 1) / 11 * Math.PI) * .26;
            g.quad((0, math_js_1.vec)(0, .40, z), (0, math_js_1.vec)(0, y, z), (0, math_js_1.vec)(0, yn, zn), (0, math_js_1.vec)(0, .36, zn), (0, exports.tint)(base, .89));
            g.rod((0, math_js_1.vec)(0, .41, z), (0, math_js_1.vec)(0, y, z), .009, .004, (0, exports.tint)(base, .67), 4);
        }
        const tail = (0, math_js_1.vec)(0, 0, -1.12);
        for (let i = 0; i < 12; i++) {
            const t = -Math.PI / 2 + i * Math.PI / 12, tt = t + Math.PI / 12;
            const p = (0, math_js_1.vec)(0, Math.sin(t) * .48, -1.55 - Math.cos(t) * .28), q = (0, math_js_1.vec)(0, Math.sin(tt) * .48, -1.55 - Math.cos(tt) * .28);
            g.tri(tail, p, q, (0, exports.tint)(base, .79));
            g.rod(tail, p, .008, .003, (0, exports.tint)(base, .60), 4);
        }
        g.rod((0, math_js_1.vec)(.49, .25, .70), (0, math_js_1.vec)(.54, .14, .89), .019, .013, (0, exports.rgb)('#d1c7a1'), 6);
    }
    else if (kind === 'moray') {
        const olive = (0, exports.rgb)('#92a076');
        const path = [];
        for (let i = 0; i < 16; i++)
            path.push((0, math_js_1.vec)(Math.sin(i * .35) * .16, Math.cos(i * .2) * .08, -i * .18));
        for (let i = 0; i < 15; i++)
            g.rod(path[i], path[i + 1], .2 - i * .009, .2 - (i + 1) * .009, (0, exports.tint)(olive, 1 - i * .025), 10);
        g.ellipsoid((0, math_js_1.vec)(0, .02, .23), (0, math_js_1.vec)(.20, .18, .37), olive, 16, 10);
        g.ellipsoid((0, math_js_1.vec)(0, -.05, .52), (0, math_js_1.vec)(.13, .065, .026), dark, 10, 6);
        for (const s of [-1, 1]) {
            g.ellipsoid((0, math_js_1.vec)(s * .14, .1, .35), (0, math_js_1.vec)(.034, .037, .032), (0, exports.rgb)('#ead7a4'), 8, 5);
            g.ellipsoid((0, math_js_1.vec)(s * .158, .1, .37), (0, math_js_1.vec)(.018, .021, .018), dark, 6, 4);
            for (let i = 0; i < 5; i++)
                g.tri((0, math_js_1.vec)(s * .105, -.02, .48 - i * .05), (0, math_js_1.vec)(s * .10, -.075, .5 - i * .05), (0, math_js_1.vec)(s * .08, -.02, .52 - i * .05), cream);
        }
    }
    else if (kind === 'turtle') {
        const green = (0, exports.rgb)('#89936e');
        g.ellipsoid((0, math_js_1.vec)(), (0, math_js_1.vec)(.64, .28, .85), green, 22, 12, (x, y, z) => { const a = Math.sin(x * 15 + z * 7) * Math.cos(z * 14); return a > .25 ? (0, exports.rgb)('#acb183') : (0, exports.rgb)('#677c67'); });
        g.ellipsoid((0, math_js_1.vec)(0, .04, .97), (0, math_js_1.vec)(.22, .20, .32), (0, exports.rgb)('#afba89'), 14, 9);
        for (const s of [-1, 1]) {
            g.tri((0, math_js_1.vec)(s * .45, 0, .5), (0, math_js_1.vec)(s * 1.28, -.09, .2), (0, math_js_1.vec)(s * .92, -.15, -.38), green);
            g.tri((0, math_js_1.vec)(s * .4, -.02, -.55), (0, math_js_1.vec)(s * .85, -.1, -.85), (0, math_js_1.vec)(s * .41, -.16, -.99), green);
            g.ellipsoid((0, math_js_1.vec)(s * .14, .12, 1.17), (0, math_js_1.vec)(.045, .045, .026), dark, 7, 5);
        }
    }
    else if (kind === 'ray') {
        const c = (0, exports.rgb)('#618187');
        g.ellipsoid((0, math_js_1.vec)(), (0, math_js_1.vec)(.38, .14, .8), c, 16, 9);
        for (const s of [-1, 1]) {
            g.tri((0, math_js_1.vec)(0, 0, .76), (0, math_js_1.vec)(s * 1.5, -.06, -.25), (0, math_js_1.vec)(0, .13, -.8), c);
            g.tri((0, math_js_1.vec)(0, -.05, .76), (0, math_js_1.vec)(0, -.07, -.8), (0, math_js_1.vec)(s * 1.5, -.06, -.25), (0, exports.rgb)('#b2c6b5'));
        }
        g.rod((0, math_js_1.vec)(0, 0, -.5), (0, math_js_1.vec)(.25, 0, -2.4), .045, .006, c, 6);
    }
    else if (kind === 'shark') {
        const slate = (0, exports.rgb)('#526f77'), belly = (0, exports.rgb)('#9aada2');
        g.ellipsoid((0, math_js_1.vec)(0, 0, .08), (0, math_js_1.vec)(.50, .46, 1.56), slate, 24, 14);
        g.ellipsoid((0, math_js_1.vec)(0, -.12, 1.14), (0, math_js_1.vec)(.35, .30, .73), slate, 18, 10);
        g.ellipsoid((0, math_js_1.vec)(0, -.24, .96), (0, math_js_1.vec)(.37, .19, .78), belly, 18, 8);
        g.ellipsoid((0, math_js_1.vec)(0, -.20, 1.68), (0, math_js_1.vec)(.31, .08, .30), dark, 16, 7);
        for (const side of [-1, 1]) {
            g.ellipsoid((0, math_js_1.vec)(side * .43, .17, 1.18), (0, math_js_1.vec)(.045, .052, .04), (0, exports.rgb)('#d7d8bd'), 8, 5);
            g.ellipsoid((0, math_js_1.vec)(side * .46, .17, 1.20), (0, math_js_1.vec)(.022, .031, .022), dark, 7, 4);
            for (let gill = 0; gill < 5; gill++)
                g.rod((0, math_js_1.vec)(side * .38, -.10, .72 - gill * .17), (0, math_js_1.vec)(side * .39, -.30, .72 - gill * .17), .018, .012, (0, exports.tint)(slate, .74), 4);
            g.tri((0, math_js_1.vec)(side * .36, -.12, .05), (0, math_js_1.vec)(side * 1.38, -.27, -.62), (0, math_js_1.vec)(side * .45, -.35, -.94), (0, exports.tint)(slate, .82));
            g.tri((0, math_js_1.vec)(side * .31, -.16, -.82), (0, math_js_1.vec)(side * .83, -.22, -1.27), (0, math_js_1.vec)(side * .32, -.34, -1.34), (0, exports.tint)(slate, .75));
        }
        g.tri((0, math_js_1.vec)(0, .35, .1), (0, math_js_1.vec)(0, 1.05, -.28), (0, math_js_1.vec)(0, .42, -.72), (0, exports.tint)(slate, 1.12));
        g.tri((0, math_js_1.vec)(0, -.34, .65), (0, math_js_1.vec)(0, -.69, .15), (0, math_js_1.vec)(0, -.38, -.2), (0, exports.tint)(slate, .80));
        g.tri((0, math_js_1.vec)(0, 0, -1.12), (0, math_js_1.vec)(0, .94, -1.82), (0, math_js_1.vec)(0, .10, -1.61), slate);
        g.tri((0, math_js_1.vec)(0, 0, -1.12), (0, math_js_1.vec)(0, -.48, -1.92), (0, math_js_1.vec)(0, -.08, -1.60), (0, exports.tint)(slate, .78));
    }
    else {
        const colors = ['#f1cc54', '#5ebace', '#517bdd', '#f2a477', '#45cfb4', '#e1859b', '#cce0d4', '#a9cd61'];
        const c = (0, exports.rgb)(colors[variant % colors.length]), kind = variant % 8;
        const deep = [0, 2, 5].includes(kind), slender = [1, 6].includes(kind);
        const height = deep ? .24 : slender ? .10 : .16, length = slender ? .46 : .36;
        g.ellipsoid((0, math_js_1.vec)(), (0, math_js_1.vec)(deep ? .075 : .105, height, length), c, 18, 11, (x, y, z) => {
            if (kind === 0 && z < -.15 && z > -.5 || kind === 2 && z > .12 && z < .35)
                return (0, exports.rgb)('#172c59');
            if (kind === 1 && y > .08 && y < .3)
                return (0, exports.rgb)('#d9f1e1');
            if (kind === 3 && Math.sin(z * 13) > .35)
                return (0, exports.rgb)('#f5e5bc');
            if (kind === 4 && y > .1 && Math.sin(z * 22 + y * 8) > .6)
                return (0, exports.rgb)('#2667a8');
            if (kind === 5 && y < -.2)
                return (0, exports.rgb)('#ffd398');
            if (kind === 6 && y > 0)
                return (0, exports.rgb)('#578e9c');
            return (0, exports.tint)(c, .93 + y * .13);
        });
        // Fan tails, curved dorsal fins and paired translucent-looking pectorals.
        const tail = (0, math_js_1.vec)(0, 0, -length * .8), tailY = deep ? .27 : .18;
        for (let i = 0; i < 6; i++) {
            const t = i / 6, n = (i + 1) / 6;
            const edge = (v) => (0, math_js_1.vec)(0, (v * 2 - 1) * tailY, -length - .22 + Math.abs(v - .5) * .07);
            g.tri(tail, edge(t), edge(n), (0, exports.tint)(c, i % 2 ? .94 : 1.15));
            g.rod(tail, edge(t), .003, .001, (0, exports.tint)(c, .66), 4);
        }
        for (let i = 0; i < 7; i++) {
            const z = length * .65 - i * length * 1.4 / 7, zn = z - length * 1.4 / 7;
            const h = height + Math.sin((i + 1) / 8 * Math.PI) * (deep ? .13 : .075);
            g.quad((0, math_js_1.vec)(0, height * .7, z), (0, math_js_1.vec)(0, h, z), (0, math_js_1.vec)(0, h, zn), (0, math_js_1.vec)(0, height * .7, zn), (0, exports.tint)(c, .85));
        }
        for (const side of [-1, 1]) {
            g.ellipsoid((0, math_js_1.vec)(side * .077, height * .35, length * .62), (0, math_js_1.vec)(.028, .029, .026), (0, exports.rgb)('#e3e4b0'), 8, 6);
            g.ellipsoid((0, math_js_1.vec)(side * .091, height * .35, length * .66), (0, math_js_1.vec)(.017, .020, .018), dark, 7, 5);
            g.rod((0, math_js_1.vec)(side * .09, height * .15, length * .2), (0, math_js_1.vec)(side * .087, -height * .55, length * .1), .007, .004, (0, exports.tint)(c, .5), 5);
            g.tri((0, math_js_1.vec)(side * .07, 0, .11), (0, math_js_1.vec)(side * .22, -.04, -.07), (0, math_js_1.vec)(side * .10, -.07, -.16), (0, exports.tint)(c, 1.13));
        }
        g.ellipsoid((0, math_js_1.vec)(0, -height * .12, length * .92), (0, math_js_1.vec)(.026, .018, .025), (0, exports.tint)(c, .62), 8, 5);
    }
    // UV metadata: creature family and a fin weight. One shared material and
    // one deformation shader are reused by regular meshes and shadow passes.
    const family = kind === 'turtle' ? 2 : kind === 'ray' ? 3 : kind === 'moray' ? 4 : kind === 'lionfish' ? 5 : kind === 'shark' ? 6 : kind === 'marlow' ? 7 : 1;
    for (let i = 0; i < g.positions.length / 3; i++) {
        const x = Math.abs(g.positions[i * 3]);
        g.uvs[i * 2] = family;
        g.uvs[i * 2 + 1] = kind === 'turtle' ? Math.max(0, x - .5) : kind === 'ray' ? Math.max(0, x - .3) : family === 1 ? Math.max(0, x - .1) : 0;
    }
    return g;
}
function equipment(kind) {
    const g = new Geometry(), suit = (0, exports.rgb)('#183940'), rubber = (0, exports.rgb)('#0b242b'), teal = (0, exports.rgb)('#4caaa0'), orange = (0, exports.rgb)('#edb176'), metal = (0, exports.rgb)('#bccbc1');
    if (kind === 'arms') {
        for (const s of [-1, 1]) {
            g.rod((0, math_js_1.vec)(s * .72, -.65, .10), (0, math_js_1.vec)(s * .37, -.38, .71), .12, .10, suit, 12);
            g.rod((0, math_js_1.vec)(s * .4, -.38, .65), (0, math_js_1.vec)(s * .3, -.3, .88), .108, .075, rubber, 12);
            g.ellipsoid((0, math_js_1.vec)(s * .3, -.28, .90), (0, math_js_1.vec)(.09, .078, .14), rubber, 12, 8);
            g.rod((0, math_js_1.vec)(s * .49, -.49, .4), (0, math_js_1.vec)(s * .45, -.45, .5), .124, .12, teal, 12);
        }
        g.box((0, math_js_1.vec)(-.415, -.34, .65), (0, math_js_1.vec)(.18, .045, .17), orange);
        g.box((0, math_js_1.vec)(-.415, -.314, .65), (0, math_js_1.vec)(.135, .009, .125), (0, exports.rgb)('#70d6c2'));
    }
    if (kind === 'spear') {
        g.rod((0, math_js_1.vec)(.36, -.32, .23), (0, math_js_1.vec)(.025, -.015, 2.28), .018, .012, rubber, 9);
        g.rod((0, math_js_1.vec)(.095, -.08, 1.82), (0, math_js_1.vec)(.025, -.015, 2.28), .014, .011, orange, 9);
        for (const s of [-1, 0, 1])
            g.rod((0, math_js_1.vec)(.025 + s * .025, -.015, 2.28), (0, math_js_1.vec)(.007 + s * .04, 0, 2.63), .008, .0015, metal, 5);
    }
    if (kind === 'tube') {
        g.rod((0, math_js_1.vec)(-.60, -.7, .45), (0, math_js_1.vec)(-.60, -.29, .55), .17, .18, teal, 16);
        g.rod((0, math_js_1.vec)(-.60, -.32, .54), (0, math_js_1.vec)(-.60, -.27, .553), .189, .189, orange, 16);
        g.ellipsoid((0, math_js_1.vec)(-.60, -.255, .553), (0, math_js_1.vec)(.15, .015, .15), rubber, 14, 5);
    }
    if (kind === 'scooter') {
        g.ellipsoid((0, math_js_1.vec)(0, -.38, 1.04), (0, math_js_1.vec)(.34, .25, .62), teal, 20, 12);
        g.ellipsoid((0, math_js_1.vec)(0, -.35, 1.57), (0, math_js_1.vec)(.22, .15, .15), orange, 14, 8);
        g.rod((0, math_js_1.vec)(-.42, -.24, .70), (0, math_js_1.vec)(.42, -.24, .70), .048, .048, rubber, 9);
        g.rod((0, math_js_1.vec)(0, -.37, .32), (0, math_js_1.vec)(0, -.37, .6), .27, .25, rubber, 18);
        g.box((0, math_js_1.vec)(0, -.135, .94), (0, math_js_1.vec)(.20, .04, .23), rubber);
        g.box((0, math_js_1.vec)(0, -.11, .94), (0, math_js_1.vec)(.14, .01, .16), (0, exports.rgb)('#a0e3cb'));
    }
    return g;
}

},
"render/biome-geometry.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.siteObstacleGeometry = siteObstacleGeometry;
const math_js_1 = require("../game/math.js");
const geometry_js_1 = require("./geometry.js");
/** Every underwater solid follows an authored collision envelope. */
function siteObstacleGeometry(rock, site) {
    const g = new geometry_js_1.Geometry(), { p, s } = rock;
    if (rock.form === 'container') {
        const color = (0, geometry_js_1.rgb)(rock.tint ? '#487986' : '#ad714d');
        // Inscribe the box in the ellipsoid used by fish and diver navigation.
        const size = (0, math_js_1.vec)(s.x * 1.12, s.y * 1.12, s.z * 1.12);
        g.box(p, size, color);
        for (let i = -5; i <= 5; i++)
            for (const side of [-1, 1]) {
                const x = p.x + i * size.x / 12, z = p.z + side * size.z * .505;
                g.rod((0, math_js_1.vec)(x, p.y - size.y * .45, z), (0, math_js_1.vec)(x, p.y + size.y * .45, z), .04, .04, (0, geometry_js_1.tint)(color, .72), 5);
            }
    }
    else if (rock.form === 'piling') {
        const wood = (0, geometry_js_1.rgb)('#79634a');
        // A rounded, tapered piling stays inside its collision ellipsoid.
        for (let i = 0; i < 12; i++) {
            const y0 = -.99 + i * 1.98 / 12, y1 = -.99 + (i + 1) * 1.98 / 12;
            g.rod((0, math_js_1.vec)(p.x, p.y + y0 * s.y, p.z), (0, math_js_1.vec)(p.x, p.y + y1 * s.y, p.z), Math.sqrt(1 - y0 * y0) * s.x * .96, Math.sqrt(1 - y1 * y1) * s.x * .96, wood, 12);
        }
        for (const fraction of [-.48, .45])
            g.rod((0, math_js_1.vec)(p.x, p.y + s.y * fraction - .08, p.z), (0, math_js_1.vec)(p.x, p.y + s.y * fraction + .08, p.z), s.x * .84, s.x * .84, (0, geometry_js_1.rgb)('#436e68'), 12);
    }
    else if (rock.form === 'root') {
        const wood = (0, geometry_js_1.rgb)('#78694a'), alongX = s.x > s.z;
        // Dense roots occupy a woody curtain, with smaller buttress roots fanning down.
        g.ellipsoid(p, (0, math_js_1.vec)(s.x * .97, s.y, s.z * .97), wood, 24, 16, (x, y, z) => (0, geometry_js_1.tint)(wood, .72 + .25 * Math.abs(Math.sin((alongX ? x : z) * 25)) + y * .08));
        for (let i = -4; i <= 4; i++) {
            const t = i / 5, top = (0, math_js_1.vec)(p.x + (alongX ? t * s.x * .66 : 0), p.y + s.y * .54, p.z + (alongX ? 0 : t * s.z * .66));
            const bottom = (0, math_js_1.vec)(p.x + (alongX ? t * s.x * .80 : s.x * .42), p.y - s.y * .45, p.z + (alongX ? s.z * .42 : t * s.z * .80));
            g.rod(top, bottom, .12, .045, (0, geometry_js_1.tint)(wood, .77), 9);
        }
        // Leaves sit on the emerged ends, rather than floating over submerged roots.
        if (p.y + s.y > site.surface - .7)
            for (let i = -2; i <= 2; i++) {
                const t = i * .23;
                g.ellipsoid((0, math_js_1.vec)(p.x + (alongX ? t * s.x : 0), p.y + s.y - .45, p.z + (alongX ? 0 : t * s.z)), (0, math_js_1.vec)(alongX ? 1.9 : .6, .7, alongX ? .6 : 1.9), (0, geometry_js_1.rgb)('#48785b'), 12, 8);
            }
    }
    else {
        const color = (0, geometry_js_1.rgb)(rock.form === 'limestone' ? '#b3b69d' : rock.tint ? '#5c8e83' : '#729f90');
        g.ellipsoid(p, s, color, 26, 18, (x, y, z) => (0, geometry_js_1.tint)(color, .85 + .11 * Math.sin(x * 14 + z * 12) * Math.cos(y * 20) + y * .16));
        if (rock.form === 'limestone') {
            // Irregular erosion cuts into the collision envelope, never outside it.
            for (let i = 0; i < g.positions.length / 3; i++) {
                const k = i * 3, x = g.positions[k] - p.x, y = g.positions[k + 1] - p.y, z = g.positions[k + 2] - p.z;
                const rough = .94 + .05 * Math.sin(y * 1.8 + Math.atan2(z, x) * 5) * Math.cos(y * .6);
                g.positions[k] = p.x + x * rough;
                g.positions[k + 2] = p.z + z * rough;
            }
            // Bands are colour changes in the same surface, keeping the open roof clear.
            for (let i = 0; i < g.positions.length / 3; i++)
                if (Math.sin(g.positions[i * 3 + 1] * 1.1) > .65) {
                    g.colors[i * 4] *= .85;
                    g.colors[i * 4 + 1] *= .88;
                    g.colors[i * 4 + 2] *= .89;
                }
        }
    }
    return g;
}

},
"render/shadows.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReefShadows = void 0;
const shaders_js_1 = require("./shaders.js");
const depthFragment = `precision highp float;
void main(){
 vec4 packed=fract(min(gl_FragCoord.z,.999999)*vec4(1.0,255.0,65025.0,16581375.0));
 packed-=packed.yzww*vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);
 gl_FragColor=packed;
}`;
/** Geometry-based depth maps: shared deformation shaders keep caster silhouettes
 * aligned with animated coral, seaweed and thin-instanced fish. High only. */
class ReefShadows {
    constructor(scene, engine) {
        this.scene = scene;
        this.engine = engine;
        this.sun = null;
        this.torch = null;
        this.depthMaterials = new Map();
        this.lastSun = -99;
        this.sunRenders = 0;
        this.torchRenders = 0;
        this.lastDraws = 0;
        this.passReady = true;
        this.enabled = false;
        const B = BABYLON;
        this.white = B.RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1, scene, false, false, B.Texture.NEAREST_SAMPLINGMODE);
        this.sunMatrix = B.Matrix.Identity();
        this.torchMatrix = B.Matrix.Identity();
        this.sunDirection = new B.Vector3(-.4, 1, -.23).normalize();
        this.sunPass = engine.createRenderPassId('reef-sun-shadow');
        this.torchPass = engine.createRenderPassId('reef-torch-shadow');
        B.Effect.ShadersStore['reefShadowVertexShader'] = shaders_js_1.reefVertex;
        B.Effect.ShadersStore['reefShadowFragmentShader'] = depthFragment;
    }
    target(size) {
        const B = BABYLON;
        const wrapper = this.engine.createRenderTargetTexture(size, { generateMipMaps: false, generateDepthBuffer: true, generateStencilBuffer: false, type: B.Constants.TEXTURETYPE_UNSIGNED_BYTE, format: B.Constants.TEXTUREFORMAT_RGBA, samplingMode: B.Texture.NEAREST_SAMPLINGMODE });
        const texture = new B.Texture(null, this.scene, true, false, B.Texture.NEAREST_SAMPLINGMODE);
        texture._texture = wrapper.texture;
        texture.wrapU = B.Texture.CLAMP_ADDRESSMODE;
        texture.wrapV = B.Texture.CLAMP_ADDRESSMODE;
        return { wrapper, texture };
    }
    configure(high) {
        this.enabled = high;
        if (high && !this.sun) {
            this.sun = this.target(2048);
            this.torch = this.target(1024);
            this.lastSun = -99;
        }
        if (!high && this.sun) {
            for (const target of [this.sun, this.torch]) {
                target.texture._texture = null;
                target.texture.dispose();
                target.wrapper.dispose();
            }
            this.sun = this.torch = null;
        }
        this.sunTexture = this.sun?.texture || this.white;
        this.torchTexture = this.torch?.texture || this.white;
    }
    reset() { this.lastSun = -99; }
    depth(mode) {
        let material = this.depthMaterials.get(mode);
        if (material)
            return material;
        const B = BABYLON;
        material = new B.ShaderMaterial('reef-shadow-' + mode, this.scene, { vertex: 'reefShadow', fragment: 'reefShadow' }, { attributes: ['position', 'normal', 'color', 'uv'], uniforms: ['world', 'viewProjection', 'uTime', 'uMode', 'uMotion', 'uSurface', 'uNight', 'uCurrent'] });
        material.backFaceCulling = false;
        material.setFloat('uMode', mode);
        material.setFloat('uMotion', 1);
        this.depthMaterials.set(mode, material);
        return material;
    }
    pass(target, passId, view, projection, run, site, reducedMotion) {
        const B = BABYLON, oldView = this.scene.activeCamera.getViewMatrix(), oldProjection = this.scene.activeCamera.getProjectionMatrix(), oldPass = this.engine.currentRenderPassId;
        let draws = 0;
        this.passReady = true;
        try {
            this.engine.currentRenderPassId = passId;
            this.scene.setTransformMatrix(view, projection);
            this.scene.resetCachedMaterial();
            this.engine.bindFramebuffer(target.wrapper, undefined, undefined, undefined, true);
            this.engine.setAlphaMode(B.Engine.ALPHA_DISABLE);
            this.engine.setDepthBuffer(true);
            this.engine.setDepthWrite(true);
            this.engine.clear(new B.Color4(1, 1, 1, 1), true, true, false);
            for (const mesh of this.scene.meshes) {
                const mode = mesh.material?._reefMode;
                if (![0, 1, 2, 7].includes(mode) || !mesh.isEnabled() || !mesh.isVisible)
                    continue;
                const material = this.depth(mode);
                material.setFloat('uTime', run.time);
                material.setFloat('uSurface', site.surface);
                material.setFloat('uMotion', reducedMotion ? 0 : 1);
                material.setVector2('uCurrent', { x: site.current, y: site.channelX ?? (site.id === 'gardens' ? 18 : 0) });
                mesh.setMaterialForRenderPass(passId, material);
                mesh.computeWorldMatrix(true);
                if (!material.isReady(mesh, mesh.hasThinInstances)) {
                    this.passReady = false;
                    continue;
                }
                for (const sub of mesh.subMeshes || []) {
                    mesh.render(sub, false);
                    draws++;
                }
            }
        }
        finally {
            this.engine.restoreDefaultFramebuffer();
            this.engine.currentRenderPassId = oldPass;
            this.scene.setTransformMatrix(oldView, oldProjection);
            this.scene.resetCachedMaterial();
        }
        return draws;
    }
    render(run, site, reducedMotion, torchActive, camera) {
        if (!this.enabled || !this.sun)
            return;
        const B = BABYLON;
        this.lastDraws = 0;
        if (run.time - this.lastSun >= .05 || run.time < this.lastSun) {
            const center = new B.Vector3(0, -3, 0), eye = center.add(this.sunDirection.scale(100));
            const view = B.Matrix.LookAtLH(eye, center, new B.Vector3(0, 1, 0)), projection = B.Matrix.OrthoLH(160, 160, 1, 190);
            view.multiplyToRef(projection, this.sunMatrix);
            this.lastDraws += this.pass(this.sun, this.sunPass, view, projection, run, site, reducedMotion);
            if (this.passReady)
                this.lastSun = run.time;
            this.sunRenders++;
        }
        if (torchActive) {
            const view = camera.getViewMatrix(), projection = B.Matrix.PerspectiveFovLH(1.35, 1, .08, 70);
            view.multiplyToRef(projection, this.torchMatrix);
            this.lastDraws += this.pass(this.torch, this.torchPass, view, projection, run, site, reducedMotion);
            this.torchRenders++;
        }
    }
    stats() { return { enabled: this.enabled, sunResolution: this.sun ? 2048 : 0, torchResolution: this.torch ? 1024 : 0, sunRenders: this.sunRenders, torchRenders: this.torchRenders, depthDraws: this.lastDraws }; }
}
exports.ReefShadows = ReefShadows;

},
"render/shaders.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reefFragment = exports.reefVertex = void 0;
exports.reefVertex = `precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 viewProjection;
uniform float uTime;
uniform float uMode;
uniform float uMotion;
uniform float uSurface;
uniform float uNight;
uniform vec2 uCurrent;
uniform mat4 uSunMatrix;
uniform mat4 uTorchMatrix;
#ifdef INSTANCES
attribute vec4 world0;
attribute vec4 world1;
attribute vec4 world2;
attribute vec4 world3;
#endif
varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vColor;
varying vec2 vUV;
varying vec4 vSunCoord;
varying vec4 vTorchCoord;
void main(){
 mat4 w=world;
 #ifdef INSTANCES
 w=mat4(world0,world1,world2,world3);
 #endif
 vec3 p=position;
 if(uMode==1.0){
  p.x+=sin(uTime*.75+p.z*.7+p.x*.5)*uv.y*.08*uMotion;
  p.z+=sin(uTime*.54+p.x*.6)*uv.y*.04*uMotion;
 }
 if(uMode==2.0){
  float phase=uTime+dot(w[3].xz,vec2(.17,.23));
  float tail=max(0.0,-p.z), fin=uv.y;
  if(uv.x==2.0){p.y+=sin(phase*1.8+p.z*.9)*fin*.23; p.z+=cos(phase*1.8)*fin*.08;}
  else if(uv.x==3.0){p.y+=sin(phase*2.0-abs(p.x)*1.5)*fin*.24;p.x*=1.0-fin*.018*cos(phase*2.0);}
  else if(uv.x==4.0){p.x+=sin(phase*2.4+p.z*3.5)*tail*tail*.09; p.y+=sin(phase*1.3)*max(0.0,p.z-.38)*.08;}
  else {float frequency=uv.x==5.0?2.1:uv.x==6.0?2.6:4.3;
   p.x+=sin(phase*frequency+p.z*7.0)*tail*tail*(uv.x==5.0?.055:.12);
   p.y+=sin(phase*6.0+p.z*3.0)*fin*.26;
  }
 }
 if(uMode==3.0){p.y+=sin(p.x*.30+uTime*.48)*.14+sin(p.z*.28-uTime*.3)*.09;}
 if(uMode==6.0){p.x+=sin(uTime*.17+p.y)*.35;p.y+=sin(uTime*.34+p.z)*.20;p.z+=mod(uTime*.23,6.0);}
 if(uMode==7.0){
  float channel=exp(-pow((p.x-uCurrent.y)/12.0,2.0));
  float current=uCurrent.x*(.45+channel*1.8)*(1.0+.12*sin(uTime*.023));
  float tip=uv.y*uv.y*uMotion;
  float phase=uTime*(.72+current*.55)+uv.x*6.28318+p.x*.31+p.z*.19;
  p.x+=(sin(phase)*.14+current*.48*.16)*tip;
  p.z+=(sin(phase-1.1)*.16+current*.48)*tip;
 }
 vec4 pos=w*vec4(p,1.0);
 vWorld=pos.xyz;
 vSunCoord=uSunMatrix*vec4(pos.xyz+normalize(mat3(w)*normal)*.10,1.0);
 vTorchCoord=uTorchMatrix*vec4(pos.xyz+normalize(mat3(w)*normal)*.025,1.0);
 vNormal=normalize(mat3(w)*normal);
 vColor=color;
 vUV=uv;
 gl_Position=viewProjection*pos;
}`;
exports.reefFragment = `precision highp float;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vColor;
varying vec2 vUV;
varying vec4 vSunCoord;
varying vec4 vTorchCoord;
uniform vec3 uEye;
uniform vec3 uForward;
uniform vec3 uWaterColor;
uniform float uTime;
uniform float uMode;
uniform float uSurface;
uniform float uFog;
uniform float uLight;
uniform float uNight;
uniform vec2 uTorch;
uniform float uShadows;
uniform float uTorchShadows;
uniform sampler2D uSunShadow;
uniform sampler2D uTorchShadow;
float shadowVisibility(sampler2D shadowMap,vec4 coordinate,float texel,float bias,float depthSpan){
 if(coordinate.w<=0.0)return 1.0;
 vec3 q=coordinate.xyz/coordinate.w*.5+.5;
 if(q.x<.002||q.x>.998||q.y<.002||q.y>.998||q.z<0.0||q.z>1.0)return 1.0;
 vec4 blockerPacked=texture2D(shadowMap,q.xy);
 float blockerDepth=dot(blockerPacked,vec4(1.0,1.0/255.0,1.0/65025.0,1.0/16581375.0));
 float radius=1.0+clamp((q.z-blockerDepth)*depthSpan*.2,0.0,.5);
 float visible=0.0;
 for(int x=0;x<4;x++)for(int y=0;y<4;y++){
  vec4 packed=texture2D(shadowMap,q.xy+(vec2(float(x),float(y))-1.5)*texel*radius);
  float depth=dot(packed,vec4(1.0,1.0/255.0,1.0/65025.0,1.0/16581375.0));
  visible+=step(q.z-bias,depth);
 }
 return visible/16.0;
}
float caustic(vec2 p){
 float a=sin(p.x*1.47+uTime*.33+sin(p.y*.82-uTime*.23));
 float b=sin(p.y*1.42-uTime*.29+cos(p.x*.71+uTime*.17));
 return pow(max(0.0,1.0-abs(a+b)*.87),11.0);
}
void main(){
 vec3 n=normalize(vNormal);
 float dist=length(vWorld-uEye);
 float depth=max(0.0,uSurface-vWorld.y);
 vec3 col=vColor.rgb;
 float alpha=1.0;
 if(uMode==3.0){
  vec2 p=vWorld.xz;
  float w=sin(p.x*.62+uTime*.44+sin(p.y*.26))+sin(p.y*.49-uTime*.3);
  float threads=pow(max(0.0,1.0-abs(w)*.6),5.0);
  vec3 to=normalize(vWorld-uEye);
  float sun=pow(max(0.0,dot(to,normalize(vec3(-.35,1.0,.25)))),120.0);
  vec3 daylight=mix(vec3(.12,.53,.60),vec3(.44,.78,.73),.48+w*.11)+threads*.055+sun*vec3(.66,.73,.57);
  vec3 moonlight=vec3(.025,.105,.17)+threads*.025+sun*vec3(.15,.24,.34);
  col=mix(daylight,moonlight,uNight);
 }
 else if(uMode==5.0){alpha=(1.0-vUV.y)*.075*pow(max(0.0,sin(vUV.x*3.14159)),1.5);if(uShadows>.5)alpha*=shadowVisibility(uSunShadow,vSunCoord,1.0/2048.0,.00055,190.0);col=mix(vec3(.62,.87,.76),vec3(.15,.39,.56),uNight);}
 else if(uMode==8.0){float rim=pow(1.0-abs(dot(n,normalize(uEye-vWorld))),2.0);col=vec3(.58,.86,.91);alpha=.10+rim*.50;}
 else if(uMode==6.0){col=mix(vec3(.54,.82,.78),vec3(.24,.47,.66),uNight);alpha=.34;}
 else {
  float sunNormal=max(0.0,dot(n,normalize(vec3(-.4,1.0,-.23))));
  float sunShadow=uShadows>.5?shadowVisibility(uSunShadow,vSunCoord,1.0/2048.0,.00055+.00055*(1.0-sunNormal),190.0):1.0;
  float light=.65+.52*sunNormal*sunShadow;
  float side=.08*max(0.0,dot(n,normalize(vec3(.7,.2,.5))));
  col*=mix(light+side,.25+.18*max(0.0,n.y),uNight);
  col*=mix(vec3(.82,.93,1.0),vec3(1.0),mix(1.0,sunShadow,smoothstep(.05,.4,sunNormal)*(1.0-uNight)));
  if(uMode!=4.0){
   float c=(caustic(vWorld.xz)+caustic(vWorld.xz*.51+.3)*.35)*(1.0-step(uSurface+.03,vWorld.y));
   col+=mix(vec3(.30,.47,.35),vec3(.10,.20,.30),uNight)*c*max(.10,n.y)*exp(-depth*.037)*(1.0-uNight)*sunShadow;
   col*=vec3(exp(-depth*.008),1.0,1.0);
   float alignment=max(0.0,dot(normalize(vWorld-uEye),uForward));
   float cone=pow(alignment,max(5.0,uTorch.x))*uLight*exp(-dist*max(.001,uTorch.y));
   float core=pow(alignment,40.0)*uLight*exp(-dist*.12);
   float torchShadow=uTorchShadows>.5?shadowVisibility(uTorchShadow,vTorchCoord,1.0/1024.0,.000015,0.0):1.0;
   col+=vColor.rgb*(cone*.82+core*.45)*torchShadow;
  }
  else col=col*.85+vColor.rgb*.3;
 }
 if(uMode!=4.0&&uMode!=3.0&&uMode!=6.0){
  float underwater=1.0-step(uSurface,vWorld.y);
  float submergedFog=(1.0-exp(-dist*uFog))*underwater;
  vec3 deepFog=mix(uWaterColor,vec3(.012,.047,.085),uNight);
  vec3 farFog=mix(uWaterColor*1.20+vec3(.09,.09,.06),vec3(.035,.12,.20),uNight);
  vec3 waterFog=mix(deepFog,farFog,clamp((vWorld.y+2.0)/uSurface,0.0,1.0));
  col=mix(col,waterFog,clamp(submergedFog,0.0,.985));
  float aboveFog=(1.0-exp(-dist*uFog*(uMode==9.0?.09:.34)))*(1.0-underwater);
  vec3 skyFog=mix(vec3(.58,.77,.80),vec3(.018,.045,.10),uNight);
  col=mix(col,skyFog,clamp(aboveFog,0.0,.8));
 }
 col=pow(max(col,vec3(0.0)),vec3(.96));
 gl_FragColor=vec4(col,alpha);
}`;

},
"game/breathing.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BubblePool = exports.BreathClock = exports.EXHALE_START = exports.BREATH_PERIOD = void 0;
const data_js_1 = require("./data.js");
exports.BREATH_PERIOD = 4.3;
exports.EXHALE_START = 1.7;
/** Simulation time keeps regulator sound and bubbles together across pauses. */
class BreathClock {
    constructor() {
        this.last = -1;
    }
    sample(time, enabled, paused = false) {
        if (paused)
            return null;
        if (!enabled) {
            this.last = -1;
            return null;
        }
        const cycle = Math.floor(time / exports.BREATH_PERIOD);
        const exhale = time - cycle * exports.BREATH_PERIOD >= exports.EXHALE_START;
        const phase = cycle * 2 + Number(exhale);
        if (phase === this.last)
            return null;
        this.last = phase;
        return exhale ? 'exhale' : 'inhale';
    }
}
exports.BreathClock = BreathClock;
class BubblePool {
    constructor() {
        this.clock = new BreathClock();
        this.previous = -1;
        this.cursor = 0;
        this.emitted = 0;
        this.bubbles = Array.from({ length: 24 }, () => ({ p: { x: 0, y: 0, z: 0 }, born: -99, size: .025 }));
    }
    update(run, site, playing) {
        const enabled = playing && !run.finished && run.p.y < site.surface - .12;
        const dt = this.previous < 0 ? 0 : Math.max(0, Math.min(.1, run.time - this.previous));
        this.previous = run.time;
        if (this.clock.sample(run.time, enabled) === 'exhale') {
            for (let i = 0; i < 8; i++) {
                const b = this.bubbles[this.cursor++ % this.bubbles.length];
                const side = i % 2 ? .20 : -.20, forward = .40 + i * .025;
                b.p.x = run.p.x + Math.sin(run.yaw) * forward + Math.cos(run.yaw) * side;
                b.p.y = run.p.y - .24 - i * .025;
                b.p.z = run.p.z + Math.cos(run.yaw) * forward - Math.sin(run.yaw) * side;
                b.size = .017 + (i % 4) * .007;
                b.born = run.time;
                this.emitted++;
            }
        }
        for (const b of this.bubbles) {
            if (run.time - b.born > 3 || b.p.y >= site.surface || !playing) {
                b.born = -99;
                continue;
            }
            const flow = (0, data_js_1.currentAt)(b.p, site, run.time);
            b.p.x += flow.x * dt;
            b.p.z += flow.z * dt;
            b.p.y += (.55 + b.size * 7) * dt;
        }
    }
    active(time) { return this.bubbles.filter(b => time - b.born < 3).length; }
}
exports.BubblePool = BubblePool;

},
"render/terrain.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEABED_STEPS = exports.SEABED_SIZE = void 0;
exports.sandHeight = sandHeight;
exports.seabedGeometry = seabedGeometry;
exports.mergeGrounded = mergeGrounded;
const data_js_1 = require("../game/data.js");
const math_js_1 = require("../game/math.js");
const geometry_js_1 = require("./geometry.js");
exports.SEABED_SIZE = 170;
exports.SEABED_STEPS = 90;
const samples = new Map();
function sampleHeight(ix, iz, site) {
    const key = (0, data_js_1.siteTerrainKey)(site);
    if (!samples.has(key))
        samples.set(key, new Float64Array((exports.SEABED_STEPS + 1) ** 2).fill(NaN));
    const sandSamples = samples.get(key);
    const index = iz * (exports.SEABED_STEPS + 1) + ix;
    if (Number.isNaN(sandSamples[index]))
        sandSamples[index] = (0, data_js_1.floorHeight)(-exports.SEABED_SIZE / 2 + ix * exports.SEABED_SIZE / exports.SEABED_STEPS, -exports.SEABED_SIZE / 2 + iz * exports.SEABED_SIZE / exports.SEABED_STEPS, site);
    return sandSamples[index];
}
/** Height of the visible sand triangles, rather than the curved authoring function. */
function sandHeight(x, z, site) {
    const half = exports.SEABED_SIZE / 2, cell = exports.SEABED_SIZE / exports.SEABED_STEPS;
    if (Math.abs(x) >= half || Math.abs(z) >= half)
        return (0, data_js_1.floorHeight)(x, z, site);
    const ix = Math.floor((x + half) / cell), iz = Math.floor((z + half) / cell);
    const x0 = -half + ix * cell, z0 = -half + iz * cell;
    const tx = (x - x0) / cell, tz = (z - z0) / cell;
    const a = sampleHeight(ix, iz, site), b = sampleHeight(ix, iz + 1, site), c = sampleHeight(ix + 1, iz, site), d = sampleHeight(ix + 1, iz + 1, site);
    return tx + tz <= 1 ? a + (c - a) * tx + (b - a) * tz : d + (b - d) * (1 - tx) + (c - d) * (1 - tz);
}
function seabedGeometry(site) {
    const ground = new geometry_js_1.Geometry(), half = exports.SEABED_SIZE / 2;
    const vertex = (x, z) => {
        const eps = .08, n = (0, math_js_1.norm)((0, math_js_1.vec)((0, data_js_1.floorHeight)(x - eps, z, site) - (0, data_js_1.floorHeight)(x + eps, z, site), 2 * eps, (0, data_js_1.floorHeight)(x, z - eps, site) - (0, data_js_1.floorHeight)(x, z + eps, site)));
        const grain = .92 + .06 * Math.sin(x * 5 + z * 6) + .035 * Math.sin(z * 19);
        ground.v((0, math_js_1.vec)(x, (0, data_js_1.floorHeight)(x, z, site), z), n, (0, geometry_js_1.tint)((0, geometry_js_1.rgb)('#' + (site?.sandColor ?? 0xc5ceaf).toString(16).padStart(6, '0')), grain));
    };
    for (let iz = 0; iz <= exports.SEABED_STEPS; iz++)
        for (let ix = 0; ix <= exports.SEABED_STEPS; ix++)
            vertex(-half + ix * exports.SEABED_SIZE / exports.SEABED_STEPS, -half + iz * exports.SEABED_SIZE / exports.SEABED_STEPS);
    for (let iz = 0; iz < exports.SEABED_STEPS; iz++)
        for (let ix = 0; ix < exports.SEABED_STEPS; ix++) {
            const a = iz * (exports.SEABED_STEPS + 1) + ix, b = a + exports.SEABED_STEPS + 1;
            ground.indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
    // Coarse outer rings meet the exact inner boundary and continue beneath the islands.
    // Gameplay and collision retain the authored dive area.
    const radii = [half, 110, 160, 240, 340, 450], ringSize = exports.SEABED_STEPS * 4, start = ground.positions.length / 3;
    for (const radius of radii)
        for (let side = 0; side < 4; side++)
            for (let i = 0; i < exports.SEABED_STEPS; i++) {
                const t = -radius + i * 2 * radius / exports.SEABED_STEPS;
                vertex(side === 0 ? t : side === 1 ? radius : side === 2 ? -t : -radius, side === 0 ? -radius : side === 1 ? t : side === 2 ? radius : -t);
            }
    for (let ring = 0; ring < radii.length - 1; ring++)
        for (let i = 0; i < ringSize; i++) {
            const j = (i + 1) % ringSize, a = start + ring * ringSize + i, b = a + ringSize, c = start + ring * ringSize + j, d = c + ringSize;
            ground.indices.push(a, c, b, c, d, b);
        }
    return ground;
}
/** Embed each root footprint in the actual sand, including steep trench slopes. */
function mergeGrounded(destination, source, p, s, yaw, site) {
    const start = destination.positions.length;
    destination.merge(source, (0, math_js_1.vec)(p.x, sandHeight(p.x, p.z, site) - .035, p.z), s, yaw);
    const center = sandHeight(p.x, p.z, site);
    for (let i = start; i < destination.positions.length; i += 3)
        destination.positions[i + 1] += sandHeight(destination.positions[i], destination.positions[i + 2], site) - center;
}

},
"input.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputController = void 0;
exports.gamepadKey = gamepadKey;
exports.gamepadSelectionKey = gamepadSelectionKey;
exports.knownBackboneProfile = knownBackboneProfile;
const simulation_js_1 = require("./game/simulation.js");
const math_js_1 = require("./game/math.js");
const PAD_AXES = ['moveX', 'moveZ', 'lookX', 'lookY'];
const PAD_BUTTONS = [
    { action: 'spear', prompt: 'Press and hold the control you want to draw the spear (RT or another trigger works).' },
    { action: 'interact', prompt: 'Press the control you want to hold for interaction.' },
    { action: 'up', prompt: 'Press the control you want to use to ascend.' },
    { action: 'down', prompt: 'Press the control you want to use to descend.' },
    { action: 'scooter', prompt: 'Press the control that toggles your scooter.' },
    { action: 'steady', prompt: 'Press the control that steadies the camera.' },
    { action: 'boost', prompt: 'Press the control that gives a stronger fin kick.' },
    { action: 'pause', prompt: 'Press the control that pauses the dive.' },
    { action: 'light', prompt: 'Press the control that toggles your head torch.' },
    { action: 'watch', prompt: 'Press the control that raises and lowers your dive computer.' },
    { action: 'journal', prompt: 'Press the control that opens the reef chart.' },
    { action: 'menuConfirm', prompt: 'Press the menu confirm control.' },
    { action: 'menuBack', prompt: 'Press the menu back or cancel control.' },
    { action: 'menuPrevious', prompt: 'Press the menu up / previous control.' },
    { action: 'menuNext', prompt: 'Press the menu down / next control.' },
];
const finiteAxis = (n) => Number.isFinite(n) ? (0, math_js_1.clamp)(n, -1, 1) : 0;
const rawAxis = (n) => Number.isFinite(n) ? n : 0;
const median = (xs) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
function gamepadKey(pad) { return `${String(pad.id || 'Unknown gamepad').trim().replace(/\s+/g, ' ')}::${pad.mapping || 'raw'}::a${pad.axes.length}::b${pad.buttons.length}`; }
function gamepadSelectionKey(pad) { return `${gamepadKey(pad)}::slot${pad.index}`; }
function standardProfile(pad) {
    const standard = pad.mapping === 'standard';
    return { key: gamepadKey(pad), id: pad.id || 'Unknown gamepad', mapping: pad.mapping || '', axisCount: pad.axes.length, buttonCount: pad.buttons.length,
        axes: { moveX: { index: 0, sign: 1 }, moveZ: { index: 1, sign: -1 }, lookX: { index: 2, sign: 1 }, lookY: { index: 3, sign: 1 } },
        centers: Array.from(pad.axes, () => 0),
        buttons: { spear: 7, interact: 0, up: 3, down: 1, scooter: 2, steady: 4, boost: 5, pause: 9, light: 6, journal: 8, watch: 10, menuConfirm: 0, menuBack: 1, menuPrevious: 12, menuNext: 13 },
        axisButtons: {}, moveDeadzone: .14, lookDeadzone: .2 };
}
/** Narrow known-good preset from Spin Vector's exact Windows USB capture. */
function knownBackboneProfile(pad) {
    const id = String(pad.id || '').toLowerCase();
    if (!/backbone/.test(id) || !/vendor:\s*358a/.test(id) || !/product:\s*0204/.test(id) || pad.mapping === 'standard' || pad.axes.length < 6 || pad.buttons.length < 12)
        return null;
    const profile = standardProfile(pad);
    profile.axes = { moveX: { index: 0, sign: 1 }, moveZ: { index: 1, sign: -1 }, lookX: { index: 2, sign: 1 }, lookY: { index: 5, sign: 1 } };
    profile.centers = Array.from(pad.axes, () => 0);
    profile.centers[3] = -1;
    profile.centers[4] = -1;
    if (profile.centers.length > 9)
        profile.centers[9] = 1;
    profile.axisButtons = { spear: { index: 3, value: 1 }, light: { index: 4, value: 1 } };
    profile.buttons = { spear: 9, interact: 0, up: 3, down: 1, scooter: 2, steady: 4, boost: 5, pause: 11, light: 6, journal: 8, watch: 10, menuConfirm: 0, menuBack: 1, menuPrevious: 12, menuNext: 13 };
    return profile;
}
const checkedWatchDefaults = new WeakSet();
function profileFor(settings, pad) {
    const saved = settings.gamepads?.[gamepadKey(pad)];
    if (!saved)
        return knownBackboneProfile(pad) || standardProfile(pad);
    if (!checkedWatchDefaults.has(saved)) {
        checkedWatchDefaults.add(saved);
        // Older calibrated profiles predate the watch. Add a spare, known stick
        // click without changing any measured axes, triggers or existing buttons.
        const fallback = pad.mapping === 'standard' ? 10 : knownBackboneProfile(pad)?.buttons.watch;
        if (saved.buttons.watch === undefined && !saved.axisButtons.watch && fallback !== undefined && fallback < pad.buttons.length && !Object.values(saved.buttons).includes(fallback))
            saved.buttons.watch = fallback;
    }
    return saved;
}
function mappedAxis(pad, profile, axis) {
    const binding = profile.axes[axis], center = finiteAxis(profile.centers[binding.index]);
    const raw = finiteAxis(pad.axes[binding.index]), delta = raw - center;
    const range = delta < 0 ? center + 1 : 1 - center;
    return (0, math_js_1.clamp)((range > .001 ? delta / range : 0) * binding.sign, -1, 1);
}
function mappedButton(pad, profile, action) {
    const index = profile.buttons[action];
    if (index !== undefined) {
        const b = pad.buttons[index];
        if (b && (b.pressed || b.value >= .5))
            return true;
    }
    const bind = profile.axisButtons[action];
    if (bind) {
        const v = finiteAxis(pad.axes[bind.index]), travel = Math.abs(bind.value - finiteAxis(profile.centers[bind.index]));
        return travel > .1 && Math.abs(v - bind.value) <= Math.max(.07, travel * .24);
    }
    return false;
}
class InputController {
    constructor(canvas, settings, command) {
        this.canvas = canvas;
        this.settings = settings;
        this.command = command;
        this.menuValueAt = 0;
        this.active = false;
        this.keys = new Set();
        this.blockedKeys = new Set();
        this.touch = new Set();
        this.lookX = 0;
        this.lookY = 0;
        this.release = false;
        this.cancelDraw = false;
        this.drawToggle = false;
        this.joyX = 0;
        this.joyZ = 0;
        this.previousPad = [];
        this.previousPadActions = {};
        this.blockedPadActions = new Set();
        this.selectedPadKey = null;
        this.selectedPadIndex = null;
        this.currentPad = null;
        this.calibration = null;
        this.padDisconnected = false;
        this.lookPointer = -1;
        this.lastX = 0;
        this.lastY = 0;
        this.hoverX = null;
        this.hoverY = 0;
        this.touchMode = matchMedia('(pointer:coarse)').matches;
        this.gamepad = false;
        this.watchRaised = false;
        window.addEventListener('keydown', e => {
            if (this.calibration)
                return;
            if (e.target?.matches('input,select,textarea'))
                return;
            const action = this.actionFor(e.code);
            if (!action)
                return;
            if (action === 'pause' || action === 'journal') {
                if (!e.repeat) {
                    e.preventDefault();
                    this.command(action);
                }
                return;
            }
            if (this.blockedKeys.has(e.code)) {
                e.preventDefault();
                return;
            }
            if ((action === 'spear' || action === 'interact') && this.watchRaised) {
                e.preventDefault();
                if (!e.repeat) {
                    this.blockedKeys.add(e.code);
                    this.command('watch');
                }
                return;
            }
            if (!this.active)
                return;
            e.preventDefault();
            if (!e.repeat && ['scooter', 'light'].includes(action))
                this.command(action);
            if (action === 'watch' && !e.repeat)
                this.command(action);
            if (action === 'spear' && !e.repeat && this.settings.toggleDraw)
                this.toggle();
            else
                this.keys.add(e.code);
        });
        window.addEventListener('keyup', e => {
            if (this.blockedKeys.delete(e.code)) {
                this.keys.delete(e.code);
                return;
            }
            if (this.actionFor(e.code) === 'spear' && !this.settings.toggleDraw && this.keys.has(e.code))
                this.release = true;
            this.keys.delete(e.code);
        });
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        canvas.addEventListener('pointerleave', () => { this.hoverX = null; });
        canvas.addEventListener('pointerdown', e => {
            if (!this.active)
                return;
            canvas.focus({ preventScroll: true });
            if (e.pointerType === 'touch') {
                this.touchMode = true;
                this.lookPointer = e.pointerId;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                canvas.setPointerCapture(e.pointerId);
                return;
            }
            this.touchMode = false;
            if (e.button === 0) {
                const watchWasRaised = this.watchRaised;
                if (document.pointerLockElement !== canvas) {
                    // Keep draw and drag-look usable when capture is denied by a host.
                    this.lookPointer = e.pointerId;
                    this.lastX = e.clientX;
                    this.lastY = e.clientY;
                    canvas.setPointerCapture(e.pointerId);
                    this.capture();
                }
                if (watchWasRaised)
                    this.command('watch');
                else if (this.settings.toggleDraw)
                    this.toggle();
                else
                    this.keys.add('Mouse0');
            }
            if (e.button === 2) {
                this.lookPointer = e.pointerId;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                canvas.setPointerCapture(e.pointerId);
            }
        });
        window.addEventListener('pointermove', e => {
            if (!this.active)
                return;
            if (document.pointerLockElement === canvas && e.pointerType !== 'touch') {
                this.lookX += e.movementX;
                this.lookY += e.movementY;
            }
            else if (this.lookPointer === e.pointerId) {
                this.lookX += (e.clientX - this.lastX) * 1.25;
                this.lookY += (e.clientY - this.lastY) * 1.25;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
            }
            else if (e.pointerType !== 'touch' && e.target === canvas) {
                // Embedded previews may deny pointer lock. Looking must not require drawing.
                if (this.hoverX !== null) {
                    this.lookX += (e.clientX - this.hoverX) * 1.25;
                    this.lookY += (e.clientY - this.hoverY) * 1.25;
                }
                this.touchMode = false;
            }
            if (e.pointerType !== 'touch' && e.target === canvas) {
                this.hoverX = e.clientX;
                this.hoverY = e.clientY;
            }
            else
                this.hoverX = null;
        });
        window.addEventListener('pointerup', e => {
            if (e.button === 0 && e.pointerType !== 'touch')
                this.blockedKeys.delete('Mouse0');
            if (e.button === 0 && e.pointerType !== 'touch' && this.keys.has('Mouse0')) {
                this.keys.delete('Mouse0');
                this.release = true;
            }
            if (e.pointerId === this.lookPointer)
                this.lookPointer = -1;
        });
        window.addEventListener('pointercancel', () => this.clear());
        canvas.addEventListener('lostpointercapture', e => {
            // Pointer lock takes over capture during normal mouse entry.
            if (document.pointerLockElement !== canvas &&
                (this.lookPointer === e.pointerId || this.keys.has('Mouse0')))
                this.clear();
        });
        window.addEventListener('blur', () => this.clear());
        document.addEventListener('pointerlockchange', () => {
            if (!this.active && document.pointerLockElement === this.canvas) {
                document.exitPointerLock();
                return;
            }
            if (this.active && !document.pointerLockElement && !this.touchMode) {
                this.clear();
                this.command('pause');
            }
        });
    }
    actionFor(code) {
        if (code === 'KeyR' && !Object.values(this.settings.keys).includes('KeyR'))
            return 'spear';
        return Object.keys(this.settings.keys).find(k => this.settings.keys[k] === code);
    }
    toggle() {
        if (this.drawToggle) {
            this.release = true;
            this.drawToggle = false;
        }
        else
            this.drawToggle = true;
    }
    capture() {
        if (!this.active || this.touchMode)
            return;
        try {
            const p = this.canvas.requestPointerLock();
            if (p && typeof p.catch === 'function')
                p.then(() => { if (!this.active && document.pointerLockElement === this.canvas)
                    document.exitPointerLock(); }).catch(() => { });
        }
        catch { }
    }
    setActive(v) {
        this.active = v;
        this.clear();
        if (v) {
            const pad = this.selectedGamepad();
            if (pad) {
                const profile = profileFor(this.settings, pad);
                for (const item of PAD_BUTTONS)
                    if (mappedButton(pad, profile, item.action))
                        this.blockedPadActions.add(item.action);
            }
        }
        if (!v && document.pointerLockElement)
            document.exitPointerLock();
    }
    setWatchRaised(value) { this.watchRaised = value; if (value) {
        this.cancelDraw = true;
        this.release = false;
        this.drawToggle = false;
        for (const code of this.keys) {
            const action = this.actionFor(code);
            if (action === 'spear' || action === 'interact') {
                this.blockedKeys.add(code);
                this.keys.delete(code);
            }
        }
        this.touch.delete('spear');
        this.touch.delete('interact');
        if (this.keys.has('Mouse0'))
            this.blockedKeys.add('Mouse0');
        this.keys.delete('Mouse0');
        const pad = this.selectedGamepad();
        if (pad) {
            const profile = profileFor(this.settings, pad);
            if (mappedButton(pad, profile, 'spear'))
                this.blockedPadActions.add('spear');
            if (mappedButton(pad, profile, 'interact'))
                this.blockedPadActions.add('interact');
        }
    } }
    pads() { try {
        return Array.from(navigator.getGamepads?.() || []).filter((p) => !!p?.connected);
    }
    catch {
        return [];
    } }
    padChoices() { return this.pads().map(p => ({ key: gamepadSelectionKey(p), profileKey: gamepadKey(p), index: p.index, id: p.id || 'Unknown gamepad', mapping: p.mapping || 'raw', axes: Array.from(p.axes, rawAxis), buttons: Array.from(p.buttons, b => Number(b.value.toFixed(2))) })); }
    selectPad(selectionKey) { const pad = selectionKey ? this.pads().find(p => gamepadSelectionKey(p) === selectionKey) : null; this.selectedPadKey = pad ? gamepadKey(pad) : null; this.selectedPadIndex = pad?.index ?? null; this.previousPad = []; this.previousPadActions = {}; this.calibration = null; this.cancelDraw = true; this.release = false; }
    selectedGamepad() { const pads = this.pads(); if (!this.selectedPadKey)
        return pads[0] || null; return pads.find(p => gamepadKey(p) === this.selectedPadKey && p.index === this.selectedPadIndex) || pads.find(p => gamepadKey(p) === this.selectedPadKey) || null; }
    startCalibration() {
        const pad = this.selectedGamepad();
        if (!pad) {
            this.calibration = null;
            return false;
        }
        this.selectedPadKey = gamepadKey(pad);
        this.selectedPadIndex = pad.index;
        this.calibration = { key: gamepadKey(pad), phase: 'neutral', neutral: [], centers: [], axisStep: 0, buttonStep: 0, waitingRelease: false, axes: {}, buttons: {}, axisButtons: {} };
        this.previousPad = Array.from(pad.buttons, b => b.pressed || b.value >= .5);
        this.previousPadActions = {};
        this.cancelDraw = true;
        this.release = false;
        this.drawToggle = false;
        return true;
    }
    cancelCalibration() { this.calibration = null; this.previousPad = []; this.previousPadActions = {}; this.cancelDraw = true; this.release = false; this.drawToggle = false; }
    useCalibration() { var _a; if (!this.calibration?.profile)
        return false; (_a = this.settings).gamepads ?? (_a.gamepads = {}); this.settings.gamepads[this.calibration.key] = this.calibration.profile; this.calibration = null; this.previousPad = []; this.previousPadActions = {}; this.cancelDraw = true; this.release = false; return true; }
    restorePadDefaults() { const pad = this.selectedGamepad(); if (pad && this.settings.gamepads)
        delete this.settings.gamepads[gamepadKey(pad)]; this.cancelCalibration(); }
    calibrationStatus() {
        const c = this.calibration;
        const prompts = ['Push LEFT stick fully RIGHT', 'Push LEFT stick fully FORWARD', 'Push RIGHT stick fully RIGHT', 'Push RIGHT stick fully DOWN'];
        if (!c)
            return { phase: 'idle', prompt: '', step: 0, total: PAD_BUTTONS.length + PAD_AXES.length, completed: false };
        if (c.phase === 'neutral')
            return { phase: c.phase, prompt: 'Let go of both sticks and every button. Hold neutral while the center is sampled.', step: 0, total: PAD_BUTTONS.length + PAD_AXES.length, completed: false };
        if (c.phase === 'axes')
            return { phase: c.phase, prompt: c.waitingRelease ? 'Return the stick to neutral before continuing.' : prompts[c.axisStep], step: c.axisStep + 1, total: PAD_BUTTONS.length + PAD_AXES.length, completed: false };
        if (c.phase === 'buttons')
            return { phase: c.phase, prompt: c.waitingRelease ? 'Release all controls and return the sticks to neutral.' : PAD_BUTTONS[c.buttonStep].prompt, step: PAD_AXES.length + c.buttonStep + 1, total: PAD_BUTTONS.length + PAD_AXES.length, completed: false };
        return { phase: c.phase, prompt: 'Calibration captured. Test it, then choose Use or cancel to discard it.', step: PAD_BUTTONS.length + PAD_AXES.length, total: PAD_BUTTONS.length + PAD_AXES.length, completed: true };
    }
    controllerStatus() {
        const pads = this.padChoices(), pad = this.selectedGamepad(), c = this.calibrationStatus();
        const key = pad ? gamepadKey(pad) : this.selectedPadKey;
        const staged = this.calibration?.profile;
        const activeProfile = staged || (pad ? profileFor(this.settings, pad) : null);
        const test = pad && activeProfile ? `Move ${mappedAxis(pad, activeProfile, 'moveX').toFixed(2)} / ${mappedAxis(pad, activeProfile, 'moveZ').toFixed(2)} · Look ${mappedAxis(pad, activeProfile, 'lookX').toFixed(2)} / ${mappedAxis(pad, activeProfile, 'lookY').toFixed(2)} · Spear ${mappedButton(pad, activeProfile, 'spear') ? 'pressed' : 'released'} · Interact ${mappedButton(pad, activeProfile, 'interact') ? 'pressed' : 'released'} · Ascend ${mappedButton(pad, activeProfile, 'up') ? 'pressed' : 'released'} · Descend ${mappedButton(pad, activeProfile, 'down') ? 'pressed' : 'released'} · Deadzone move ${activeProfile.moveDeadzone.toFixed(2)} / look ${activeProfile.lookDeadzone.toFixed(2)}${staged ? ' · staged' : ' · active'}` : 'Connect a controller to test it.';
        return { pads, selectedKey: pad ? gamepadSelectionKey(pad) : null, profileKey: key, connected: !!pad, rawAxes: pad ? Array.from(pad.axes, rawAxis) : [], rawButtons: pad ? Array.from(pad.buttons, b => Number(b.value.toFixed(2))) : [],
            saved: !!(key && this.settings.gamepads?.[key]), preset: !!pad && !this.settings.gamepads?.[gamepadKey(pad)] && !!knownBackboneProfile(pad), calibration: c, scanning: !pads.length, test };
    }
    updateCalibration(pad) {
        const c = this.calibration;
        if (!c || c.phase === 'complete' || gamepadKey(pad) !== c.key)
            return;
        const axes = Array.from(pad.axes, finiteAxis), pressed = Array.from(pad.buttons, b => b.pressed || b.value >= .5);
        const usedAxes = new Set(Object.values(c.axes).map(x => x?.index));
        const centered = () => axes.every((v, i) => Math.abs(v - finiteAxis(c.centers[i])) < .24);
        if (c.phase === 'neutral') {
            if (pressed.some(Boolean)) {
                c.neutral = [];
                return;
            }
            c.neutral.push(axes);
            if (c.neutral.length >= 12) {
                c.centers = Array.from({ length: Math.max(pad.axes.length, ...c.neutral.map(x => x.length)) }, (_, i) => median(c.neutral.map(x => finiteAxis(x[i]))));
                c.phase = 'axes';
            }
            return;
        }
        if (c.waitingRelease) {
            if (!pressed.some(Boolean) && centered())
                c.waitingRelease = false;
            return;
        }
        if (c.phase === 'axes') {
            const ranked = axes.map((v, index) => ({ index, delta: v - finiteAxis(c.centers[index]) })).filter(x => !usedAxes.has(x.index)).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
            if (!ranked.length || Math.abs(ranked[0].delta) < .52)
                return;
            const axis = PAD_AXES[c.axisStep];
            c.axes[axis] = { index: ranked[0].index, sign: ranked[0].delta < 0 ? -1 : 1 };
            c.axisStep++;
            c.waitingRelease = true;
            if (c.axisStep >= PAD_AXES.length) {
                c.phase = 'buttons';
                c.waitingRelease = true;
            }
            return;
        }
        const action = PAD_BUTTONS[c.buttonStep].action;
        const buttonIndex = pressed.findIndex(Boolean);
        if (buttonIndex >= 0)
            c.buttons[action] = buttonIndex;
        else {
            const candidate = axes.map((value, index) => ({ index, value, delta: value - finiteAxis(c.centers[index]) })).filter(x => !usedAxes.has(x.index)).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
            if (!candidate || Math.abs(candidate.delta) < .12)
                return;
            c.axisButtons[action] = { index: candidate.index, value: candidate.value };
        }
        c.buttonStep++;
        c.waitingRelease = true;
        if (c.buttonStep >= PAD_BUTTONS.length) {
            const noise = (axis) => { const index = c.axes[axis].index; return Math.max(0, ...c.neutral.map(row => Math.abs(finiteAxis(row[index]) - finiteAxis(c.centers[index])))); };
            const moveDeadzone = (0, math_js_1.clamp)(Math.max(noise('moveX'), noise('moveZ')) + .06, .12, .35);
            const lookDeadzone = (0, math_js_1.clamp)(Math.max(noise('lookX'), noise('lookY')) + .08, .17, .4);
            const profile = { key: c.key, id: pad.id || 'Unknown gamepad', mapping: pad.mapping || '', axisCount: pad.axes.length, buttonCount: pad.buttons.length, axes: c.axes, centers: c.centers, buttons: c.buttons, axisButtons: c.axisButtons, moveDeadzone, lookDeadzone };
            c.profile = profile;
            c.phase = 'complete';
            c.waitingRelease = false;
        }
    }
    clear() {
        for (const code of this.keys) {
            const action = this.actionFor(code);
            if (action === 'spear' || action === 'interact')
                this.blockedKeys.add(code);
        }
        this.keys.clear();
        this.touch.clear();
        this.lookX = this.lookY = 0;
        this.joyX = this.joyZ = 0;
        this.release = false;
        this.cancelDraw = true;
        this.drawToggle = false;
        this.lookPointer = -1;
        this.hoverX = null;
        this.previousPad = [];
        this.previousPadActions = {};
        this.blockedPadActions.clear();
        if (this.active) {
            const pad = this.selectedGamepad();
            if (pad) {
                const profile = profileFor(this.settings, pad);
                for (const item of PAD_BUTTONS)
                    if (mappedButton(pad, profile, item.action))
                        this.blockedPadActions.add(item.action);
            }
        }
        const knob = document.getElementById('joy-knob');
        if (knob)
            knob.style.transform = 'translate(0,0)';
    }
    mountTouch() {
        const joy = document.getElementById('joystick'), knob = document.getElementById('joy-knob');
        let pointer = -1, originX = 0, originY = 0;
        const update = (e) => { const dx = (0, math_js_1.clamp)(e.clientX - originX, -44, 44), dy = (0, math_js_1.clamp)(e.clientY - originY, -44, 44); const len = Math.hypot(dx, dy), d = Math.max(44, len); this.joyX = dx / d; this.joyZ = -dy / d; knob.style.transform = `translate(${dx}px,${dy}px)`; };
        joy.addEventListener('pointerdown', e => {
            if (!this.active)
                return;
            this.touchMode = true;
            e.preventDefault();
            pointer = e.pointerId;
            const box = joy.getBoundingClientRect();
            originX = box.left + box.width / 2;
            originY = box.top + box.height / 2;
            joy.setPointerCapture(pointer);
            update(e);
        });
        joy.addEventListener('pointermove', e => {
            if (pointer === e.pointerId)
                update(e);
        });
        const end = (e) => {
            if (pointer !== e.pointerId)
                return;
            pointer = -1;
            this.joyX = this.joyZ = 0;
            knob.style.transform = 'translate(0,0)';
        };
        joy.addEventListener('pointerup', end);
        joy.addEventListener('pointercancel', end);
        for (const btn of document.querySelectorAll('[data-touch]')) {
            const action = btn.dataset.touch;
            let id = -1;
            btn.addEventListener('pointerdown', e => {
                if (!this.active)
                    return;
                e.preventDefault();
                this.touchMode = true;
                id = e.pointerId;
                btn.setPointerCapture(id);
                btn.classList.add('pressed');
                if (['scooter', 'light', 'pause', 'journal', 'watch'].includes(action)) {
                    this.command(action);
                    return;
                }
                if ((action === 'spear' || action === 'interact') && this.watchRaised) {
                    this.command('watch');
                }
                else if (action === 'spear') {
                    if (this.settings.toggleDraw)
                        this.toggle();
                    else
                        this.touch.add('spear');
                    this.lookPointer = id;
                    this.lastX = e.clientX;
                    this.lastY = e.clientY;
                }
                else
                    this.touch.add(action);
            });
            const up = (e) => {
                if (e.pointerId !== id)
                    return;
                id = -1;
                btn.classList.remove('pressed');
                if (action === 'spear' && !this.settings.toggleDraw && this.touch.has('spear'))
                    this.release = true;
                this.touch.delete(action);
                if (this.lookPointer === e.pointerId)
                    this.lookPointer = -1;
            };
            btn.addEventListener('pointerup', up);
            btn.addEventListener('pointercancel', e => { this.cancelDraw = true; up(e); this.release = false; });
        }
    }
    down(a) {
        if (a === 'spear' && this.keys.has('KeyR') && !Object.values(this.settings.keys).includes('KeyR'))
            return true;
        return this.keys.has(this.settings.keys[a]) || this.touch.has(a);
    }
    sample(dt) {
        const watchRaisedAtFrame = this.watchRaised;
        const pad = this.selectedGamepad();
        this.padDisconnected = !!this.currentPad && !pad;
        this.gamepad = !!pad;
        let px = 0, pz = 0, py = 0, draw = false, interact = false, steady = false, boost = false;
        if (this.padDisconnected && this.currentPad) {
            this.cancelDraw = true;
            this.drawToggle = false;
            this.release = false;
            this.previousPad = [];
            this.previousPadActions = {};
        }
        if (pad) {
            const key = gamepadKey(pad), priorKey = this.currentPad ? gamepadKey(this.currentPad) : null;
            if (priorKey && priorKey !== key) {
                this.cancelDraw = true;
                this.release = false;
                this.previousPad = [];
                this.previousPadActions = {};
            }
            this.currentPad = pad;
            this.updateCalibration(pad);
        }
        else
            this.currentPad = null;
        if (pad) {
            const profile = profileFor(this.settings, pad);
            const pressed = pad.buttons.map(b => b.pressed || b.value >= .5);
            const held = (a) => mappedButton(pad, profile, a) && !this.blockedPadActions.has(a);
            const rawActions = Object.fromEntries(PAD_BUTTONS.map(x => [x.action, mappedButton(pad, profile, x.action)]));
            for (const item of PAD_BUTTONS)
                if (!rawActions[item.action])
                    this.blockedPadActions.delete(item.action);
            const actionNow = Object.fromEntries(PAD_BUTTONS.map(x => [x.action, rawActions[x.action] && !this.blockedPadActions.has(x.action)]));
            const edge = (a) => actionNow[a] && !this.previousPadActions[a];
            if (this.active && !this.calibration) {
                const dz = profile.moveDeadzone;
                const axis = (a, deadzone) => { const value = mappedAxis(pad, profile, a); return Math.abs(value) < deadzone ? 0 : Math.sign(value) * (Math.abs(value) - deadzone) / (1 - deadzone); };
                px = axis('moveX', dz);
                pz = axis('moveZ', dz);
                py = (held('up') ? 1 : 0) - (held('down') ? 1 : 0);
                const lookX = axis('lookX', profile.lookDeadzone), lookY = axis('lookY', profile.lookDeadzone);
                this.lookX += lookX * dt * 570;
                this.lookY += lookY * dt * 570;
                draw = held('spear');
                if (this.settings.toggleDraw && edge('spear'))
                    this.toggle();
                if (!this.settings.toggleDraw && !draw && this.previousPadActions.spear)
                    this.release = true;
                interact = held('interact');
                steady = held('steady');
                boost = held('boost');
                if (edge('scooter'))
                    this.command('scooter');
                if (edge('light'))
                    this.command('light');
                if (edge('pause'))
                    this.command('pause');
                if (edge('journal'))
                    this.command('journal');
                if (edge('watch'))
                    this.command('watch');
                if (this.watchRaised && edge('spear')) {
                    this.blockedPadActions.add('spear');
                    this.command('watch');
                }
                if (this.watchRaised && edge('interact')) {
                    this.blockedPadActions.add('interact');
                    this.command('watch');
                }
            }
            else if (!this.calibration) {
                if (edge('menuPrevious') || edge('menuNext')) {
                    const controls = Array.from(document.querySelectorAll('#panel button:not(:disabled), #panel select, #panel input')).filter(e => e.offsetParent !== null), idx = controls.indexOf(document.activeElement);
                    controls[(idx + (edge('menuPrevious') ? -1 : 1) + controls.length) % controls.length]?.focus();
                }
                const focused = document.activeElement;
                const axisX = rawAxis(pad.axes[profile.axes.moveX.index]) * profile.axes.moveX.sign;
                const now = performance.now();
                if (Math.abs(axisX) < .4)
                    this.menuValueAt = 0;
                else if (now >= this.menuValueAt && focused) {
                    const sign = axisX > 0 ? 1 : -1;
                    let changed = false;
                    if (focused.tagName === 'SELECT') {
                        const select = focused, options = Array.from(select.options), next = options.map((o, i) => ({ o, i })).filter(v => !v.o.disabled && (sign > 0 ? v.i > select.selectedIndex : v.i < select.selectedIndex));
                        const option = sign > 0 ? next[0] : next[next.length - 1];
                        if (option) {
                            select.selectedIndex = option.i;
                            changed = true;
                        }
                    }
                    else if (focused.tagName === 'INPUT' && focused.type === 'range') {
                        const range = focused, step = Number(range.step) || 1, value = Math.min(Number(range.max), Math.max(Number(range.min), Number(range.value) + sign * step));
                        changed = value !== Number(range.value);
                        range.value = String(value);
                    }
                    if (changed) {
                        focused.dispatchEvent(new Event('input', { bubbles: true }));
                        focused.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    this.menuValueAt = now + 220;
                }
                if (edge('menuConfirm'))
                    document.activeElement?.click();
                if (edge('menuBack'))
                    document.querySelector('#panel [data-close]')?.click();
            }
            this.previousPad = pressed;
            this.previousPadActions = actionNow;
        }
        const factor = .0025 * this.settings.sensitivity;
        const frame = { ...simulation_js_1.EMPTY_INPUT, moveX: (0, math_js_1.clamp)((this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0) + this.joyX + px, -1, 1), moveZ: (0, math_js_1.clamp)((this.down('forward') ? 1 : 0) - (this.down('back') ? 1 : 0) + this.joyZ + pz, -1, 1), vertical: (0, math_js_1.clamp)((this.down('up') ? 1 : 0) - (this.down('down') ? 1 : 0) + py, -1, 1), lookX: this.lookX * factor, lookY: this.lookY * factor * (this.settings.invertY ? -1 : 1), boost: this.down('boost') || boost, steady: this.down('steady') || steady, draw: !watchRaisedAtFrame && !this.watchRaised && (this.settings.toggleDraw ? this.drawToggle : this.down('spear') || draw), release: !watchRaisedAtFrame && !this.watchRaised && this.release, cancelDraw: this.cancelDraw, interact: !watchRaisedAtFrame && !this.watchRaised && (this.down('interact') || interact) };
        this.lookX = this.lookY = 0;
        this.release = false;
        this.cancelDraw = false;
        return this.active && !this.calibration ? frame : this.padDisconnected && this.active ? { ...simulation_js_1.EMPTY_INPUT, cancelDraw: frame.cancelDraw } : { ...simulation_js_1.EMPTY_INPUT };
    }
}
exports.InputController = InputController;

},
"audio/audio.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Soundscape = void 0;
const scooter_js_1 = require("./scooter.js");
const breathing_js_1 = require("../game/breathing.js");
const data_js_1 = require("../game/data.js");
const score_js_1 = require("./score.js");
const pcs_voices_js_1 = require("./pcs-voices.js");
const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
/** One musical clock; no per-frame note generation. Voice stealing is bounded. */
class Soundscape {
    constructor(s) {
        this.ctx = null;
        this.motor = null;
        this.timer = null;
        this.noise = null;
        this.voices = [];
        this.step = 0;
        this.next = 0;
        this.breathClock = new breathing_js_1.BreathClock();
        this.breathCount = 0;
        this.submerged = false;
        this.mood = 'harbour';
        this.pending = 'harbour';
        this.paused = false;
        this.lastSound = 0;
        this.moodUntil = 0;
        this.settings = s;
    }
    async start() {
        try {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC)
                    return;
                const ctx = this.ctx = new AC();
                const limiter = ctx.createDynamicsCompressor();
                limiter.threshold.value = -14;
                limiter.ratio.value = 5;
                limiter.connect(ctx.destination);
                const gain = (value, dest) => { const g = ctx.createGain(); g.gain.value = value; g.connect(dest); return g; };
                this.music = gain(this.settings.music * .32, limiter);
                this.ambience = gain(this.settings.ambience * .23, limiter);
                this.effects = gain(this.settings.effects * .55, limiter);
                this.motor = new scooter_js_1.ScooterMotor(ctx, this.effects);
                this.pad = gain(.6, this.music);
                this.lead = gain(.65, this.music);
                this.bass = gain(.12, this.music);
                this.drums = gain(0, this.music);
                const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = noise.getChannelData(0);
                let brown = 0;
                for (let i = 0; i < data.length; i++) {
                    brown = (brown + Math.random() * .035 - .0175) * .985;
                    data[i] = brown * 4;
                }
                this.noise = noise;
                this.next = ctx.currentTime + .12;
                this.timer = setInterval(() => this.schedule(), 30);
            }
            if (this.ctx?.state === 'suspended')
                await this.ctx.resume();
        }
        catch { /* Silent play is always available. */ }
    }
    setSettings(s) {
        this.settings = s;
        if (!this.ctx)
            return;
        const t = this.ctx.currentTime;
        this.music.gain.setTargetAtTime(s.music * .32, t, .05);
        this.ambience.gain.setTargetAtTime(s.ambience * .23, t, .05);
        this.effects.gain.setTargetAtTime(s.effects * .55, t, .05);
    }
    setMood(m) { this.pending = m; }
    setPaused(p) {
        this.paused = p;
        if (p)
            this.motor?.silence();
        if (this.ctx) {
            this.music.gain.setTargetAtTime(p ? this.settings.music * .08 : this.settings.music * .32, this.ctx.currentTime, .15);
            this.ambience.gain.setTargetAtTime(p ? 0 : this.settings.ambience * .23, this.ctx.currentTime, .15);
            this.effects.gain.setTargetAtTime(p ? 0 : this.settings.effects * .55, this.ctx.currentTime, .035);
        }
    }
    register(source, gain, end) {
        const ctx = this.ctx;
        this.voices = this.voices.filter(v => v.end > ctx.currentTime);
        while (this.voices.length >= 48) {
            const v = this.voices.shift();
            try {
                v.gain.gain.setTargetAtTime(.0001, ctx.currentTime, .01);
                v.source.stop(ctx.currentTime + .04);
            }
            catch { }
        }
        this.voices.push({ source, gain, end });
        source.onended = () => { source.disconnect(); gain.disconnect(); };
    }
    tone(midi, t, dur, wave, dest, peak = .15, cfg = {}) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = wave;
        o.frequency.setValueAtTime(freq(midi) * (cfg.freqMul || 1), t);
        o.detune.value = cfg.detune || 0;
        let out = o;
        let filter;
        if (cfg.filter) {
            filter = ctx.createBiquadFilter();
            filter.type = cfg.filter;
            filter.frequency.value = cfg.freq || 1800;
            out.connect(filter);
            out = filter;
        }
        out.connect(g);
        g.connect(dest);
        const a = cfg.attack ?? .008, d = cfg.decay ?? .15, s = cfg.sustain ?? .2, r = cfg.release ?? .25;
        g.gain.setValueAtTime(.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + a);
        g.gain.exponentialRampToValueAtTime(Math.max(.0001, peak * s), t + a + d);
        g.gain.setValueAtTime(Math.max(.0001, peak * s), t + Math.max(a + d + .01, dur));
        g.gain.exponentialRampToValueAtTime(.0001, t + dur + r);
        o.start(t);
        o.stop(t + dur + r + .03);
        this.register(o, g, t + dur + r + .03);
        if (filter)
            o.addEventListener('ended', () => filter.disconnect());
    }
    noiseHit(t, dur, dest, volume, cutoff = 1600) {
        if (!this.ctx || !this.noise)
            return;
        const ctx = this.ctx, src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        src.buffer = this.noise;
        f.type = 'bandpass';
        f.frequency.value = cutoff;
        f.Q.value = .5;
        src.connect(f);
        f.connect(g);
        g.connect(dest);
        g.gain.setValueAtTime(.0001, t);
        g.gain.linearRampToValueAtTime(volume, t + .05);
        g.gain.exponentialRampToValueAtTime(.0001, t + dur);
        src.start(t);
        src.stop(t + dur + .02);
        this.register(src, g, t + dur + .02);
        src.addEventListener('ended', () => f.disconnect());
    }
    regulator(t, duration, peak, cutoff) {
        if (!this.ctx || !this.noise)
            return;
        const ctx = this.ctx, source = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
        source.buffer = this.noise;
        filter.type = 'lowpass';
        filter.frequency.value = cutoff;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ambience);
        gain.gain.setValueAtTime(.0001, t);
        gain.gain.linearRampToValueAtTime(peak, t + .15);
        gain.gain.setValueAtTime(peak * .7, t + duration * .65);
        gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
        source.start(t);
        source.stop(t + duration + .02);
        this.register(source, gain, t + duration + .02);
        source.addEventListener('ended', () => filter.disconnect());
    }
    schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running')
            return;
        const beat = 60 / score_js_1.SCORE.bpm, stepDur = beat / 4;
        if (this.next < ctx.currentTime - .3)
            this.next = ctx.currentTime + .03;
        while (this.next < ctx.currentTime + .14) {
            const step = this.step % 64, section = Math.floor(this.step / 64) % 2 ? 'B' : 'A', t = this.next;
            if (step % 16 === 0) {
                this.mood = this.pending;
                const mood = this.mood;
                this.pad.gain.setTargetAtTime(mood === 'danger' ? .35 : .65, t, .28);
                this.lead.gain.setTargetAtTime(mood === 'harbour' || mood === 'recovery' ? .75 : mood === 'danger' ? .05 : .28, t, .28);
                this.bass.gain.setTargetAtTime(mood === 'danger' ? .55 : mood === 'focus' ? .3 : .12, t, .28);
                this.drums.gain.setTargetAtTime(mood === 'danger' ? .55 : mood === 'focus' ? .18 : mood === 'harbour' ? .10 : 0, t, .28);
                const degree = score_js_1.SCORE['progression' + section][Math.floor(step / 16)], scale = score_js_1.SCORE.scale === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11], pc = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(score_js_1.SCORE.key), root = 48 + pc + scale[degree];
                const cfg = (0, pcs_voices_js_1.chordInstrumentConfig)(mood === 'harbour' ? 'harp' : score_js_1.SCORE.chordInstrument || 'warm_pad');
                for (const it of [0, 2, 7])
                    for (const layer of cfg.layers || [{ wave: 'sine', level: 1 }])
                        this.tone(root + it, t, beat * 3.7, layer.wave, this.pad, cfg.peak * (layer.level || 1) * .50, { ...cfg, ...layer });
            }
            const melody = score_js_1.SCORE['melodyTracks' + section][0][step];
            if (melody !== null) {
                const cfg = (0, pcs_voices_js_1.leadInstrumentConfig)(score_js_1.SCORE['melodyInstruments' + section][0] || 'bell'), octave = score_js_1.SCORE['melodyOctaves' + section][0] ?? -1;
                this.tone(72 + octave * 12 + melody, t, beat * .7, cfg.wave, this.lead, cfg.peak, { ...cfg, sustain: .09, release: .55 });
                this.tone(72 + melody, t + .012, beat * .28, 'sine', this.lead, .02, { release: .4 });
            }
            if (score_js_1.SCORE['grid' + section].bass[step]) {
                const degree = score_js_1.SCORE['progression' + section][Math.floor(step / 16)], pc = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(score_js_1.SCORE.key), root = 36 + pc + (score_js_1.SCORE.scale === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11])[degree];
                this.tone(root, t, beat * .8, 'sine', this.bass, .20, { sustain: .2, release: .18 });
            }
            if (score_js_1.SCORE['grid' + section].kick[step])
                this.tone(34, t, .10, 'sine', this.drums, .25, { sustain: .02, release: .12 });
            if (score_js_1.SCORE['grid' + section].snare[step])
                this.noiseHit(t, .10, this.drums, .22, 1500);
            if (score_js_1.SCORE['grid' + section].hat[step])
                this.noiseHit(t, .06, this.drums, .08, 4600);
            this.next += stepDur;
            this.step++;
        }
    }
    sfx(name) {
        const ctx = this.ctx;
        if (!ctx || this.paused)
            return;
        const t = ctx.currentTime;
        switch (name) {
            case 'boat-engine':
                this.tone(32, t, 3, 'triangle', this.effects, .10, { sustain: .35, release: 1, filter: 'lowpass', freq: 260 });
                this.noiseHit(t, 3, this.effects, .08, 180);
                break;
            case 'strike':
                this.noiseHit(t, .18, this.effects, .75, 400);
                break;
            case 'collect':
                this.tone(63, t, .10, 'triangle', this.effects, .13);
                this.tone(70, t + .09, .14, 'sine', this.effects, .10);
                break;
            case 'work':
                this.tone(67, t, .2, 'sine', this.effects, .14);
                this.tone(74, t + .13, .25, 'sine', this.effects, .1);
                break;
            case 'warning':
                this.music.gain.setTargetAtTime(this.settings.music * .1, t, .04);
                this.music.gain.setTargetAtTime(this.settings.music * .32, t + 1, .3);
                this.tone(69, t, .16, 'sine', this.effects, .2);
                this.tone(69, t + .3, .16, 'sine', this.effects, .2);
                break;
            case 'hurt':
            case 'theft':
                this.noiseHit(t, .28, this.effects, .8, 280);
                break;
            default: this.tone(42, t, .07, 'triangle', this.effects, .12);
        }
    }
    update(r, active, thrust = 0) {
        this.motor?.update(!!r && active && !this.paused && !r.finished && r.scooter && r.battery > 0 && this.settings.effects > 0, thrust);
        this.submerged = !!r && active && !this.paused && !r.finished && r.p.y < data_js_1.SITES[r.site].surface - .12;
        const breath = this.breathClock.sample(r?.time ?? 0, this.submerged && this.ctx?.state === 'running', this.paused);
        if (breath && this.ctx) {
            this.breathCount++;
            const now = this.ctx.currentTime;
            // Broad filtered noise makes the regulator inhale recognizable; a
            // lower, pulsed exhale accompanies the bubbles without recorded voices.
            if (breath === 'inhale')
                this.regulator(now, 1.25, .85, 1400);
            else
                for (let i = 0; i < 5; i++)
                    this.regulator(now + i * .15, .38, .52 - i * .055, 480 + i * 65);
        }
        if (!active) {
            this.setMood('harbour');
            return;
        }
        if (!r)
            return;
        const danger = r.air < 30 || r.health < 35 || r.animals.some(a => a.state === 'warn' || a.state === 'lunge');
        if (danger) {
            this.moodUntil = r.time + 4;
            this.setMood('danger');
        }
        else if (this.pending === 'danger' && r.time < this.moodUntil)
            return;
        else if (r.charge > .1 || r.interaction > .05) {
            this.moodUntil = r.time + 2.8;
            this.setMood('focus');
        }
        else if (this.pending === 'focus' && r.time < this.moodUntil)
            return;
        else
            this.setMood(r.restored > 0 && r.time % 55 < 12 ? 'recovery' : 'explore');
    }
    stats() { return { context: this.ctx?.state ?? 'not-started', mood: this.mood, voices: this.voices.length, step: this.step, submerged: this.submerged, breathCount: this.breathCount, motor: this.motor?.stats() ?? null }; }
}
exports.Soundscape = Soundscape;

},
"audio/score.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCORE = void 0;
// Generated from public/music/room-for-life.pcs.json. Run npm run build after editing.
exports.SCORE = { "projectVersion": 16, "key": "G", "scale": "major", "timeSig": 4, "bpm": 92, "swing": 0, "theme": "ocean", "uiMode": "advanced", "chordType": "sus2", "chordInstrument": "warm_pad", "resolution": 4, "melodyPitchMode": "chromatic", "chordPlayMode": "block", "chordRhythmMode": "sustain", "chordOctave": 0, "metronomeOn": false, "chordsOn": true, "bassOn": true, "guitarEnabled": false, "sectionBars": { "A": 4, "B": 4, "C": 4, "D": 4, "E": 4, "F": 4, "G": 4, "H": 4 }, "songSequence": ["A", "B", "A", "B"], "currentSection": "A", "_reefSweep": { "title": "Room for Life", "composer": "Samfa12 / original Reef Sweep score", "bpm": 92, "adaptation": "A/B alternate; optional bass pulse and percussion enter on bar boundaries. C/D are editable alternate arrangements; runtime uses A/B." }, "progressionA": [0, 3, 5, 4], "gridA": { "kick": [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "snare": [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], "hat": [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], "bass": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }, "melodyTracksA": [[7, null, null, null, null, null, 14, null, null, null, 11, null, null, null, null, null, null, null, 9, null, null, null, null, null, 7, null, null, null, null, null, null, null, 4, null, null, null, null, null, 7, null, null, null, null, null, 11, null, null, null, null, null, 9, null, null, null, null, null, null, null, 2, null, null, null, null, null]], "melodyInstrumentsA": ["bell"], "melodyOctavesA": [-1], "melodyMuteA": [false], "melodySoloA": [false], "melodyPanA": [0.1], "melodyHoldA": [[false, true, true, true, false, false, false, true, true, true, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, false, false, true, true, true, false, false]], "melodySlideA": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "melodyTupletsA": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "gridTupletsA": { "kick": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "snare": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "hat": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bass": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] }, "bassNotesA": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], "bassHoldA": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassSlideA": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassAccentA": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "guitarPatternA": ["off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off"], "progressionB": [3, 0, 4, 0], "gridB": { "kick": [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "snare": [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], "hat": [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], "bass": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }, "melodyTracksB": [[7, null, null, null, null, null, null, null, 9, null, null, null, 11, null, null, null, null, null, null, null, 14, null, null, null, null, null, null, null, 11, null, null, null, 9, null, null, null, null, null, null, null, 7, null, null, null, null, null, 4, null, null, null, null, null, 2, null, null, null, null, null, null, null, 7, null, null, null]], "melodyInstrumentsB": ["bell"], "melodyOctavesB": [-1], "melodyMuteB": [false], "melodySoloB": [false], "melodyPanB": [0.1], "melodyHoldB": [[false, true, true, true, false, false, false, false, false, true, true, true, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, false, false, true, true, true, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, false, false, true, true, true]], "melodySlideB": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "melodyTupletsB": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "gridTupletsB": { "kick": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "snare": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "hat": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bass": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] }, "bassNotesB": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], "bassHoldB": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassSlideB": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassAccentB": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "guitarPatternB": ["off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off"], "progressionC": [0, 3, 5, 4], "gridC": { "kick": [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "snare": [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], "hat": [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], "bass": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }, "melodyTracksC": [[7, null, null, null, null, null, 14, null, null, null, 11, null, null, null, null, null, null, null, 9, null, null, null, null, null, 7, null, null, null, null, null, null, null, 4, null, null, null, null, null, 7, null, null, null, null, null, 11, null, null, null, null, null, 9, null, null, null, null, null, null, null, 2, null, null, null, null, null]], "melodyInstrumentsC": ["bell"], "melodyOctavesC": [-1], "melodyMuteC": [false], "melodySoloC": [false], "melodyPanC": [0.1], "melodyHoldC": [[false, true, true, true, false, false, false, true, true, true, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, false, false, true, true, true, false, false]], "melodySlideC": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "melodyTupletsC": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "gridTupletsC": { "kick": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "snare": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "hat": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bass": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] }, "bassNotesC": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], "bassHoldC": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassSlideC": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassAccentC": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "guitarPatternC": ["off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off"], "progressionD": [3, 0, 4, 0], "gridD": { "kick": [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "snare": [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], "hat": [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], "bass": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }, "melodyTracksD": [[7, null, null, null, null, null, null, null, 9, null, null, null, 11, null, null, null, null, null, null, null, 14, null, null, null, null, null, null, null, 11, null, null, null, 9, null, null, null, null, null, null, null, 7, null, null, null, null, null, 4, null, null, null, null, null, 2, null, null, null, null, null, null, null, 7, null, null, null]], "melodyInstrumentsD": ["bell"], "melodyOctavesD": [-1], "melodyMuteD": [false], "melodySoloD": [false], "melodyPanD": [0.1], "melodyHoldD": [[false, true, true, true, false, false, false, false, false, true, true, true, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, false, false, true, true, true, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, false, false, true, true, true]], "melodySlideD": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "melodyTupletsD": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "gridTupletsD": { "kick": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "snare": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "hat": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bass": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] }, "bassNotesD": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], "bassHoldD": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassSlideD": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassAccentD": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "guitarPatternD": ["off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off"], "progressionE": [0, 3, 5, 4], "gridE": { "kick": [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "snare": [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], "hat": [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], "bass": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }, "melodyTracksE": [[7, null, null, null, null, null, 14, null, null, null, 11, null, null, null, null, null, null, null, 9, null, null, null, null, null, 7, null, null, null, null, null, null, null, 4, null, null, null, null, null, 7, null, null, null, null, null, 11, null, null, null, null, null, 9, null, null, null, null, null, null, null, 2, null, null, null, null, null]], "melodyInstrumentsE": ["bell"], "melodyOctavesE": [-1], "melodyMuteE": [false], "melodySoloE": [false], "melodyPanE": [0.1], "melodyHoldE": [[false, true, true, true, false, false, false, true, true, true, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, false, false, true, true, true, false, false]], "melodySlideE": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "melodyTupletsE": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "gridTupletsE": { "kick": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "snare": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "hat": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bass": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] }, "bassNotesE": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], "bassHoldE": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassSlideE": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassAccentE": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "guitarPatternE": ["off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off"], "progressionF": [3, 0, 4, 0], "gridF": { "kick": [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "snare": [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], "hat": [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], "bass": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }, "melodyTracksF": [[7, null, null, null, null, null, null, null, 9, null, null, null, 11, null, null, null, null, null, null, null, 14, null, null, null, null, null, null, null, 11, null, null, null, 9, null, null, null, null, null, null, null, 7, null, null, null, null, null, 4, null, null, null, null, null, 2, null, null, null, null, null, null, null, 7, null, null, null]], "melodyInstrumentsF": ["bell"], "melodyOctavesF": [-1], "melodyMuteF": [false], "melodySoloF": [false], "melodyPanF": [0.1], "melodyHoldF": [[false, true, true, true, false, false, false, false, false, true, true, true, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, false, false, true, true, true, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, false, false, true, true, true]], "melodySlideF": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "melodyTupletsF": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "gridTupletsF": { "kick": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "snare": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "hat": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bass": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] }, "bassNotesF": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], "bassHoldF": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassSlideF": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassAccentF": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "guitarPatternF": ["off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off"], "progressionG": [0, 3, 5, 4], "gridG": { "kick": [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "snare": [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], "hat": [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], "bass": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }, "melodyTracksG": [[7, null, null, null, null, null, 14, null, null, null, 11, null, null, null, null, null, null, null, 9, null, null, null, null, null, 7, null, null, null, null, null, null, null, 4, null, null, null, null, null, 7, null, null, null, null, null, 11, null, null, null, null, null, 9, null, null, null, null, null, null, null, 2, null, null, null, null, null]], "melodyInstrumentsG": ["bell"], "melodyOctavesG": [-1], "melodyMuteG": [false], "melodySoloG": [false], "melodyPanG": [0.1], "melodyHoldG": [[false, true, true, true, false, false, false, true, true, true, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, false, false, true, true, true, false, false]], "melodySlideG": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "melodyTupletsG": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "gridTupletsG": { "kick": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "snare": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "hat": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bass": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] }, "bassNotesG": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], "bassHoldG": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassSlideG": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassAccentG": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "guitarPatternG": ["off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off"], "progressionH": [3, 0, 4, 0], "gridH": { "kick": [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "snare": [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], "hat": [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], "bass": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }, "melodyTracksH": [[7, null, null, null, null, null, null, null, 9, null, null, null, 11, null, null, null, null, null, null, null, 14, null, null, null, null, null, null, null, 11, null, null, null, 9, null, null, null, null, null, null, null, 7, null, null, null, null, null, 4, null, null, null, null, null, 2, null, null, null, null, null, null, null, 7, null, null, null]], "melodyInstrumentsH": ["bell"], "melodyOctavesH": [-1], "melodyMuteH": [false], "melodySoloH": [false], "melodyPanH": [0.1], "melodyHoldH": [[false, true, true, true, false, false, false, false, false, true, true, true, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, false, false, true, true, true, false, true, true, true, false, false, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, true, true, true, false, false, false, false, false, true, true, true]], "melodySlideH": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "melodyTupletsH": [[false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]], "gridTupletsH": { "kick": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "snare": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "hat": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bass": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] }, "bassNotesH": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], "bassHoldH": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassSlideH": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "bassAccentH": [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false], "guitarPatternH": ["off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off", "off"] };

},
"audio/pcs-voices.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chordInstrumentConfig = chordInstrumentConfig;
exports.leadInstrumentConfig = leadInstrumentConfig;
/** Instrument parameters adapted directly from Sam’s Pocket Chordsmith v65.
 * Source functions: chordInstrumentConfig, leadInstrumentConfig.
 * The scheduler and bounded voice lifecycle are new for Reef Sweep. */
function chordInstrumentConfig(name) {
    if (name === "piano")
        return {
            rootWave: "triangle", wave: "triangle", peak: 0.23, filter: "lowpass", freq: 3100, filterQ: 0.9,
            attack: 0.003, decay: 0.18, sustain: 0.18, release: 0.16, durMul: 0.72, spreadMul: 0.45, shimmer: false, maxLiveDur: 0.82,
            layers: [{ wave: "triangle", level: 1 }, { wave: "sine", freqMul: 2, level: 0.18, detune: 3 }]
        };
    if (name === "saloon_piano")
        return {
            rootWave: "triangle", wave: "triangle", peak: 0.205, filter: "lowpass", freq: 3600, filterQ: 1.0,
            attack: 0.002, decay: 0.13, sustain: 0.12, release: 0.18, durMul: 0.62, spreadMul: 0.58, shimmer: false, maxLiveDur: 0.7,
            layers: [
                { wave: "triangle", level: 0.88, detune: -8 },
                { wave: "triangle", level: 0.62, detune: 9 },
                { wave: "sine", freqMul: 2, level: 0.16, detune: 5 }
            ]
        };
    if (name === "harp")
        return {
            rootWave: "triangle", wave: "sine", peak: 0.18, filter: "lowpass", freq: 4600, filterQ: 1.4,
            attack: 0.002, decay: 0.1, sustain: 0.03, release: 0.36, durMul: 0.5, spreadMul: 1.45, shimmer: true, maxLiveDur: 0.58,
            layers: [{ wave: "triangle", level: 0.9 }, { wave: "sine", freqMul: 2, level: 0.26, detune: 7 }]
        };
    if (name === "warm_pad")
        return {
            rootWave: "sine", wave: "triangle", peak: 0.14, filter: "lowpass", freq: 1200, filterQ: 0.65, filterSweep: 1700,
            attack: 0.11, decay: 0.24, sustain: 0.82, release: 0.62, durMul: 1.35, spreadMul: 0.25, shimmer: false, maxLiveDur: 1.65,
            layers: [{ wave: "sine", level: 0.95, detune: -5 }, { wave: "triangle", level: 0.48, detune: 6 }]
        };
    if (name === "glass")
        return {
            rootWave: "sine", wave: "sine", peak: 0.16, filter: "bandpass", freq: 1500, filterQ: 1.15,
            attack: 0.004, decay: 0.2, sustain: 0.1, release: 0.44, durMul: 0.9, spreadMul: 0.85, shimmer: true, maxLiveDur: 0.82,
            layers: [{ wave: "sine", level: 0.36 }, { wave: "sine", freqMul: 2.01, level: 0.64 }, { wave: "sine", freqMul: 4.02, level: 0.34 }, { wave: "triangle", freqMul: 6.01, level: 0.12 }]
        };
    return {
        rootWave: "triangle", wave: "sine", peak: 0.24, filter: "lowpass", freq: 1800, filterQ: 0.8,
        attack: 0.01, decay: 0.06, sustain: 0.7, release: 0.2, durMul: 1.0, spreadMul: 1.0, shimmer: false, maxLiveDur: 1.15,
        layers: [{ wave: "triangle", level: 0.82 }, { wave: "sine", level: 0.35 }]
    };
}
function leadInstrumentConfig(name) {
    if (name === "soft")
        return { wave: "triangle", peak: 0.16, filter: "lowpass", freq: 1700, durMul: 1.0 };
    if (name === "synth")
        return { wave: "sawtooth", peak: 0.18, filter: "lowpass", freq: 1500, durMul: 0.95 };
    if (name === "bell")
        return { wave: "sine", peak: 0.105, filter: "lowpass", freq: 2600, durMul: 1.05 };
    if (name === "lead_guitar")
        return { wave: "sawtooth", peak: 0.16, filter: "bandpass", freq: 1800, durMul: 0.92 };
    if (name === "distorted_lead_guitar")
        return { wave: "sawtooth", peak: 0.13, filter: "lowpass", freq: 2400, durMul: 0.86 };
    if (name === "banjo")
        return { wave: "triangle", peak: 0.13, filter: "bandpass", freq: 2100, durMul: 0.48 };
    if (name === "harmonica")
        return { wave: "square", peak: 0.115, filter: "bandpass", freq: 1250, durMul: 1.18 };
    if (name === "cowboy_whistle")
        return { wave: "sine", peak: 0.10, filter: "lowpass", freq: 3200, durMul: 1.12 };
    if (name === "trumpet")
        return { wave: "square", peak: 0.14, filter: "bandpass", freq: 1650, durMul: 1.05 };
    if (name === "saxophone")
        return { wave: "triangle", peak: 0.17, filter: "bandpass", freq: 940, durMul: 1.12 };
    return { wave: "square", peak: 0.20, filter: "lowpass", freq: 2300, durMul: 1.0 };
}

},
"ui/ui.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UI = void 0;
const campaign_js_1 = require("../game/campaign.js");
const tutorial_js_1 = require("../game/tutorial.js");
const campaign_ui_js_1 = require("./campaign-ui.js");
const data_js_1 = require("../game/data.js");
const math_js_1 = require("../game/math.js");
const reef_recovery_js_1 = require("../game/reef-recovery.js");
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const key = (s) => s.replace('Key', '').replace('Left', '').replace('Mouse0', 'Mouse 1');
const orderText = { none: 'Explore at your own pace. No contract bonus is promised.', catch: 'The Sandbar Kitchen · Land and sell 4 fish for a $45 order bonus.', cleanup: 'Lantern Bay Trust · Remove 2 pieces of fishing gear for a $40 contract bonus.', restore: 'Coral Commons · Plant 2 nursery-grown fragments for a $45 contract bonus.', research: 'Lantern Bay Field Archive · Survey 2 different field stations. First assignment: $65 by day / $72 at night, including station pay. Later Monitoring: $38 / $45.' };
function reefRecoveryText(p, site) { const stage = (0, reef_recovery_js_1.recoveryFromProgress)(p.reefs[site]); return stage === 0 ? 'Reef life returns between productive visits. Revisit over 3–5 outings to see more fish.' : stage < 5 ? 'Fish are returning between visits. Each productive outing helps the reef grow livelier.' : 'Fish and reef life are returning between visits. Keep revisiting to see the change.'; }
const upgradeIcon = (id) => {
    const drawings = {
        fins: '<path d="M15 37c4-10 3-19 2-25 7 4 13 12 14 23M28 40c5-9 11-14 18-16-1 9-6 17-15 21"/><path d="M11 40c7 3 13 3 20 0M29 45c6 2 12 1 17-2"/>',
        tube: '<path d="M20 10h16l3 6v25l-4 5H21l-4-5V16z"/><path d="M19 18h18M19 38h18M24 10V6h8v4"/><circle cx="28" cy="28" r="5"/>',
        spear: '<path d="m14 42 27-28M34 12l9-3-3 9M11 45l6-1-4-5"/><path d="m20 36 5 5M26 30l5 5M32 24l5 5"/>',
        scooter: '<path d="M10 29h29l7 5-7 5H10z"/><path d="M18 29v-6h12l5 6M17 39v5M39 39v5"/><circle cx="17" cy="46" r="2"/><circle cx="39" cy="46" r="2"/><path d="M47 25c3 2 3 6 0 8M51 22c5 4 5 11 0 15"/>',
        air: '<rect x="20" y="12" width="16" height="34" rx="6"/><path d="M24 12V8h8v4M20 20h16M20 38h16M36 16h6v7"/><circle cx="43" cy="13" r="5"/><path d="M43 13l2-2"/>',
        camera: '<rect x="9" y="18" width="38" height="26" rx="5"/><path d="m18 18 3-5h13l4 5M40 23h3"/><circle cx="28" cy="31" r="9"/><circle cx="28" cy="31" r="4"/>',
        kit: '<path d="M28 44V20M28 29l-9-7M28 34l10-8M28 25l7-8M19 22l-1-7M18 15l-5 2M38 26l5-5M43 21l5 2M35 17l1-6"/><path d="M14 45h28"/><circle cx="18" cy="15" r="2"/><circle cx="36" cy="11" r="2"/>',
        battery: '<rect x="14" y="16" width="28" height="32" rx="4"/><path d="M23 11h10v5M23 28h10M28 23v10M20 39h16"/><path d="m31 21-7 10h6l-3 8 9-12h-6z"/>',
        torch: '<path d="M21 10h14l5 7-4 5H20l-4-5z"/><path d="M22 22v12l6 7 6-7V22M28 41v5M23 47h10"/><path d="M18 17h20"/><path d="M13 8l-4-3M43 8l4-3M28 5V2"/>'
    };
    return `<svg viewBox="0 0 56 56" focusable="false" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${drawings[id] ?? ''}</g></svg>`;
};
/** DOM views only. Economic and ecological rules remain in the simulation. */
class UI {
    constructor(getProfile, getSettings, dispatch) {
        this.getProfile = getProfile;
        this.getSettings = getSettings;
        this.dispatch = dispatch;
        this.screen = 'dock';
        this.moment = null;
        this.filletReadyAt = 0;
        this.back = 'dock';
        this.site = 'gardens';
        this.order = 'catch';
        this.event = false;
        this.night = false;
        this.toastTimer = 0;
        this.filletFrame = 0;
        this.filletStarted = 0;
        this.filletStage = 0;
        this.filletScores = [];
        this.filletBladeX = 64;
        this.receipt = null;
        this.binding = null;
        this.chosen = new Set();
        this.allocation = { sell: 0, eat: 0, donate: 0 };
        this.confirmAction = '';
        this.confirmText = '';
        this.controllerInventory = '';
        this.qualityReloadPending = false;
        this.controllerReadout = { pads: [], selectedKey: null, connected: false, rawAxes: [], rawButtons: [], saved: false, calibration: { phase: 'idle', prompt: '', step: 0, total: 19, completed: false }, scanning: true };
        this.panel = document.getElementById('panel');
        this.hud = document.getElementById('hud');
        this.panel.addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b || b.disabled)
                return;
            if (b.dataset.close !== undefined) {
                this.dispatch('close');
                return;
            }
            if (b.dataset.screen) {
                const next = b.dataset.screen;
                if (this.screen !== 'settings')
                    this.back = this.screen;
                this.dispatch('screen', next);
                return;
            }
            if (b.dataset.site) {
                this.dispatch('site', b.dataset.site);
                return;
            }
            if (b.dataset.buy) {
                this.dispatch('buy', b.dataset.buy);
                return;
            }
            if (b.dataset.bind) {
                this.binding = b.dataset.bind;
                b.textContent = 'Press a key…';
                return;
            }
            if (b.dataset.clip) {
                const id = b.dataset.clip;
                if (this.chosen.has(id))
                    this.chosen.delete(id);
                else if (this.chosen.size < 2)
                    this.chosen.add(id);
                else {
                    this.toast('Choose up to two highlights. Deselect one first.');
                    return;
                }
                this.refreshClips();
                return;
            }
            if (b.dataset.action === 'fillet-cut') {
                this.tryFilletCut();
                return;
            }
            if (b.dataset.action === 'fillet-cancel') {
                this.dispatch('close');
                return;
            }
            if (b.dataset.action)
                this.dispatch(b.dataset.action, b.dataset.value);
        });
        this.panel.addEventListener('change', e => {
            const el = e.target;
            if (el.id === 'order-choice') {
                this.order = el.value;
                document.getElementById('order-detail').textContent = orderText[this.order];
            }
            if (el.dataset.night !== undefined) {
                this.night = el.checked;
            }
            if (el.id === 'gamepad-choice') {
                this.dispatch('gamepad-select', el.value || null);
            }
            if (el.dataset.setting) {
                const name = el.dataset.setting;
                const value = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
                this.dispatch('setting', { name, value });
            }
            if (el.dataset.allocate) {
                const n = this.getProfile().pending?.rescued ? 0 : this.getProfile().pending?.cargo.length || 0;
                this.allocation[el.dataset.allocate] = (0, math_js_1.clamp)(Math.floor(Number(el.value) || 0), 0, n);
                el.value = String(this.allocation[el.dataset.allocate]);
                this.updateAllocation();
            }
        });
        this.panel.addEventListener('input', e => {
            const el = e.target;
            if (el.type === 'range' && el.dataset.setting) {
                const value = Number(el.value), read = document.getElementById('read-' + el.dataset.setting);
                if (read)
                    read.textContent = el.dataset.setting === 'fov' ? `${value}°` : el.dataset.setting === 'sensitivity' ? value.toFixed(2) : Math.round(value * 100) + '%';
                this.dispatch('setting', { name: el.dataset.setting, value });
            }
        });
        document.addEventListener('keydown', e => {
            if (this.binding) {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (e.code !== 'Escape')
                    this.dispatch('binding', { action: this.binding, code: e.code });
                this.binding = null;
                this.show('settings');
                return;
            }
            if (e.key === 'Tab' && !this.panel.hidden) {
                const a = Array.from(this.panel.querySelectorAll('button:not(:disabled),input,select,a[href]')).filter(x => x.offsetParent !== null);
                if (!a.length)
                    return;
                const idx = a.indexOf(document.activeElement);
                if (e.shiftKey && idx <= 0) {
                    e.preventDefault();
                    a.at(-1).focus();
                }
                else if (!e.shiftKey && (idx === a.length - 1 || idx < 0)) {
                    e.preventDefault();
                    a[0].focus();
                }
            }
        }, true);
        document.getElementById('pause-button').onclick = () => this.dispatch('screen', 'pause');
        document.getElementById('chart-button').onclick = () => this.dispatch('screen', 'journal');
        document.getElementById('watch-button').onclick = () => this.dispatch('watch');
        document.getElementById('fullscreen-button').onclick = () => this.dispatch('fullscreen');
    }
    updateControllerStatus(status) {
        this.controllerReadout = status;
        if (this.screen !== 'settings')
            return;
        const select = document.getElementById('gamepad-choice');
        const inventory = status.pads.map((p) => p.key).join('|');
        if (select && inventory !== this.controllerInventory) {
            const hadFocus = document.activeElement === select;
            select.innerHTML = status.pads.length ? status.pads.map((p) => `<option value="${esc(p.key)}">Gamepad ${p.index + 1} · ${esc(p.id)} · ${esc(p.mapping)} · ${p.axes.length} axes / ${p.buttons.length} buttons</option>`).join('') : '<option value="">No controller detected</option>';
            if (status.selectedKey)
                select.value = status.selectedKey;
            this.controllerInventory = inventory;
            if (hadFocus)
                select.focus({ preventScroll: true });
        }
        const statusEl = document.getElementById('gamepad-status'), rawEl = document.getElementById('gamepad-raw'), stepEl = document.getElementById('gamepad-step'), testEl = document.getElementById('gamepad-test');
        if (statusEl)
            statusEl.textContent = status.connected ? `${status.pads.find((p) => p.key === status.selectedKey)?.id || 'Controller'} · ${status.pads.find((p) => p.key === status.selectedKey)?.mapping || 'raw'} · ${status.pads.find((p) => p.key === status.selectedKey)?.axes.length ?? 0} axes / ${status.pads.find((p) => p.key === status.selectedKey)?.buttons.length ?? 0} buttons · ${status.saved ? 'saved calibration active' : status.preset ? 'known Backbone USB preset active' : 'standard fallback active'}` : 'Waiting for a controller. Click Scan after plugging it in, then press any controller button if the browser needs a wake gesture.';
        if (rawEl)
            rawEl.textContent = `Axes: [${status.rawAxes.map((v, i) => `${i}:${v.toFixed(2)}`).join('  ')}]\nButtons: [${status.rawButtons.map((v, i) => `${i}:${v.toFixed(2)}`).join('  ')}]`;
        if (stepEl)
            stepEl.textContent = status.calibration.phase === 'idle' ? '' : `${status.calibration.step}/${status.calibration.total} · ${status.calibration.prompt}`;
        if (testEl)
            testEl.textContent = `Live test · ${status.test}`;
        const start = document.getElementById('gamepad-start'), use = document.getElementById('gamepad-use');
        const cancel = document.getElementById('gamepad-cancel'), restore = document.getElementById('gamepad-restore');
        if (start)
            start.disabled = !status.connected || status.calibration.phase !== 'idle';
        if (use)
            use.hidden = !status.calibration.completed;
        if (cancel)
            cancel.hidden = status.calibration.phase === 'idle';
        if (restore)
            restore.disabled = !status.connected || !status.saved;
    }
    header(title, eyebrow = 'REEF SWEEP / LANTERN BAY') { return `<div class="modal-header"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2></div><button class="close" data-close aria-label="Close">×</button></div>`; }
    updateFullscreenState(active) { for (const button of document.querySelectorAll('[data-fullscreen-label]')) {
        button.textContent = active ? 'Exit full screen' : 'Full screen';
        button.setAttribute('aria-label', active ? 'Exit full screen' : 'Enter full screen');
        button.title = active ? 'Exit full screen' : 'Enter full screen';
    } const hud = document.getElementById('fullscreen-button'); if (hud) {
        hud.textContent = active ? '×' : '⛶';
        hud.setAttribute('aria-label', active ? 'Exit full screen' : 'Enter full screen');
        hud.title = active ? 'Exit full screen' : 'Enter full screen';
    } }
    show(screen) {
        this.stopFilleting();
        this.screen = screen;
        document.getElementById('toast').classList.remove('visible');
        document.body.classList.remove('game');
        this.hud.hidden = true;
        this.panel.hidden = false;
        document.getElementById('menu-backdrop').hidden = false;
        const p = this.getProfile(), s = this.getSettings();
        this.event = p.eventRegistrationDay === p.day;
        document.body.classList.toggle('story-recognised', !!p.campaign?.milestoneFlags.length);
        if (screen === 'dock' && !p.active && !p.pending && !(0, campaign_js_1.contractOptions)(p, this.site).find(o => o.kind === this.order)?.available)
            this.order = (0, campaign_js_1.contractOptions)(p, this.site).find(o => o.available && o.kind !== 'none')?.kind ?? 'none';
        let html = '';
        switch (screen) {
            case 'dock':
                html = this.dock(p);
                break;
            case 'gear':
                html = `<section class="modal">${this.header('A little further.', 'EQUIPMENT / ' + (0, math_js_1.money)(p.cash) + ' AVAILABLE')}<p class="muted tiny">Grow your kit one careful upgrade at a time. Every improvement is permanent, and the loan gear always gets you back in the water.</p><div class="gear-grid" style="margin-top:18px">${data_js_1.UPGRADES.map(u => this.gearCard(u, p)).join('')}</div>${p.active ? '<p class="status-note">Finish the suspended outing before changing equipment.</p>' : ''}${p.pending ? '<p class="status-note">Settle the last outing before changing equipment.</p>' : ''}</section>`;
                break;
            case 'help':
                html = this.help(s);
                break;
            case 'pause':
                html = `<section class="modal narrow">${this.header('Take a breath.', 'DIVE PAUSED')}<p class="muted">Your air, wildlife and work are paused.</p><div class="button-row"><button class="primary" data-action="resume">Back to the reef</button><button data-screen="journal">Chart & field notes</button><button data-screen="settings">Settings</button><button data-screen="help">How to dive</button><button data-action="fullscreen" data-fullscreen-label>Full screen</button></div><div class="rule"></div><p class="tiny muted">Save and return to the harbour without ending this outing. Resume from this position later.</p><div class="button-row"><button data-action="suspend">Suspend dive</button><button class="danger" data-action="rescue-confirm">Request rescue</button></div><p class="tiny muted" style="margin-top:15px">A rescue forfeits this outing’s catch and costs $85. Completed conservation work remains.</p></section>`;
                break;
            case 'settings':
                html = this.settings(s);
                break;
            case 'journal':
                html = this.journal(p);
                break;
            case 'saves':
                html = `<section class="modal narrow">${this.header('Your logbooks.', 'THREE LOCAL SAVE SLOTS')}<p class="tiny muted">Saved in this browser on this device. Export a backup before clearing browser data or changing hosts.</p><div id="slots"></div><div class="button-row"><button data-action="export">Export current save</button><button data-action="import">Import JSON backup</button></div><div class="rule"></div><button class="link-button danger" data-action="reset-confirm">Start this slot again</button></section>`;
                break;
            case 'moment':
                html = this.moment ? (0, campaign_ui_js_1.momentView)(this.moment) : this.dock(p);
                break;
            case 'events':
                html = (0, campaign_ui_js_1.eventView)(p, this.site, this.event);
                break;
            case 'debrief':
                html = this.debrief(p);
                break;
            case 'filleting':
                html = this.filleting(p);
                break;
            case 'receipt':
                html = this.receipt ? (0, campaign_ui_js_1.receiptView)(p, this.receipt) : this.dock(p);
                break;
            case 'confirm':
                html = `<section class="modal narrow">${this.header('Just checking.')}<p class="muted">${esc(this.confirmText)}</p><div class="button-row"><button class="danger" data-action="${this.confirmAction}">Confirm</button><button data-close>Cancel</button></div></section>`;
                break;
        }
        this.panel.innerHTML = html;
        if (screen === 'gear')
            for (const button of this.panel.querySelectorAll('[data-buy]'))
                button.insertAdjacentHTML('beforebegin', `<p class="tiny upgrade-benefit">${esc((0, campaign_ui_js_1.upgradeNumbers)(p, button.dataset.buy))}</p>`);
        if (screen === 'pause' && p.active) {
            this.panel.querySelector('.button-row')?.insertAdjacentHTML('beforeend', p.active.practice ? '<button data-action="practice-exit">End practice</button>' : (0, tutorial_js_1.lessonActive)(p.active) ? '<button data-action="tutorial-skip">Skip tutorial</button>' : '');
        }
        if (screen === 'settings' && this.qualityReloadPending)
            this.panel.querySelector('[data-setting="quality"]')?.closest('.setting')?.insertAdjacentHTML('afterend', '<div class="quality-reload-note" role="status"><p>High graphics saved. Reload to apply full reef detail and shadows.</p><div class="button-row"><button class="primary" data-action="quality-reload">Reload now</button><button data-action="quality-later">Later</button></div></div>');
        if (screen === 'dock') {
            this.panel.querySelector('.launch-row')?.insertAdjacentHTML('beforebegin', this.nightControl(p));
            const orderSelect = this.panel.querySelector('#order-choice');
            const offers = (0, campaign_js_1.contractOptions)(p, this.site), labels = { catch: 'Kitchen · Sell 4 fish', cleanup: 'Cleanup · Remove 2 pieces of gear', restore: 'Restoration · Plant 2 fragments', research: 'Research · Read 2 stations', none: 'Free exploration · No contract' };
            if (orderSelect)
                orderSelect.innerHTML = offers.map(o => `<option value="${o.kind}" ${this.order === o.kind ? 'selected' : ''} ${o.available ? '' : 'disabled'}>${labels[o.kind]}${o.available ? '' : ' — unavailable'}</option>`).join('');
            const unavailable = offers.filter(o => !o.available);
            this.panel.querySelector('.dock-card')?.insertAdjacentHTML('beforeend', `${unavailable.length ? `<details class="offer-notes"><summary>Why some offers are unavailable</summary>${unavailable.map(o => `<p class="tiny">${labels[o.kind]}: ${esc(o.reason)}</p>`).join('')}</details>` : ''}${(0, campaign_ui_js_1.careerView)(p)}`);
            if (p.day % 3 === 0)
                this.panel.querySelector('.dock-card')?.insertAdjacentHTML('afterbegin', `<p class="event-banner">Lantern Bay Sweep today · ${this.event ? 'Registered' : 'Register in Events'} · safe return needed</p>`);
        }
        if (screen === 'debrief')
            this.panel.querySelector('.modal')?.insertAdjacentHTML('beforeend', '<p id="fillet-sale-bonus" class="status-note"></p>');
        if (screen === 'help')
            this.panel.querySelector('.button-row')?.insertAdjacentHTML('afterbegin', '<button data-action="practice">Replay first-dive practice</button>');
        if (screen === 'help')
            this.panel.querySelector('.help-copy .two-col>div')?.insertAdjacentHTML('beforeend', '<p><b>Research contract:</b> record surveys at the shallow reef and one deep wreck or pipe field station.</p>');
        this.panel.setAttribute('aria-label', screen === 'dock' ? 'Harbour' : 'Game ' + screen);
        if (screen !== 'dock')
            this.panel.setAttribute('role', 'dialog');
        else
            this.panel.removeAttribute('role');
        if (screen === 'debrief') {
            this.refreshClips();
            this.updateAllocation();
        }
        if (screen === 'filleting')
            this.startFilleting();
        this.updateFullscreenState(!!document.fullscreenElement || !!document.webkitFullscreenElement);
        requestAnimationFrame(() => (screen === 'filleting' ? this.panel.querySelector('[data-action="fillet-cut"]') : this.panel.querySelector('button:not(:disabled),select'))?.focus({ preventScroll: true }));
    }
    dock(p) { const site = data_js_1.SITES[this.site]; return `<header class="topbar"><div class="wordmark">Reef Sweep<span>DIVING CO.</span></div><nav class="toplinks" aria-label="Harbour"><span class="wallet"><strong>${(0, math_js_1.money)(p.cash)}</strong> Day ${p.day} · ${p.audience} followers</span><button data-screen="gear">Equipment</button><button data-screen="events">Events${p.day % 3 === 0 ? ' •' : ''}</button><button data-screen="settings" aria-label="Settings">⚙</button><button data-screen="saves" aria-label="Save slots">Saves</button><button data-action="fullscreen" data-fullscreen-label aria-label="Enter full screen">Full screen</button></nav></header><div class="dock-main"><section class="hero"><div class="eyebrow overline">A SAMFA12 GAME · LANTERN BAY</div><h1>A little room<br>for <em>life.</em></h1><p>Follow the light. Learn the reef.<br>Build a diving company that leaves<br>something better behind.</p><div class="hero-progress"><div><strong>${p.totalRemoved}</strong><span>lionfish removed</span></div><div><strong>${p.totalRestored}</strong><span>fragments planted</span></div><div><strong>${p.reputation}</strong><span>reputation</span></div></div><button class="link-button" data-screen="help" style="margin-top:18px;font-size:12px">Your first dive? Start here ↗</button></section><section class="dock-card"><div class="eyebrow">THE NEXT OUTING</div><h2>The reef is waiting.</h2><div class="site-selector">${Object.values(data_js_1.SITES).map((t, index) => `<button class="site-choice ${this.site === t.id ? 'selected' : ''}" data-site="${t.id}" ${!(0, data_js_1.siteUnlocked)(p, t.id) ? 'disabled' : ''}><span class="micro">${String(index + 1).padStart(2, '0')} / ${esc(t.label ?? t.name)}</span><strong>${esc(t.name)}</strong><span class="tiny">${(0, data_js_1.siteUnlocked)(p, t.id) ? esc(t.shortDescription ?? t.description) : esc((0, data_js_1.siteUnlockText)(p, t.id))}</span></button>`).join('')}</div><p class="site-copy">${esc(site.description)}</p><p class="recovery-note">${reefRecoveryText(p, this.site)}</p><div class="reef-strip"><span>Reef condition</span><strong>${(0, data_js_1.healthOfReef)(p, this.site)} / 100</strong></div><div class="meter"><i style="width:${(0, data_js_1.healthOfReef)(p, this.site)}%"></i></div><label class="field" for="order-choice">Take a field contract</label><select id="order-choice" ${p.active || p.pending ? 'disabled' : ''}><option value="catch" ${this.order === 'catch' ? 'selected' : ''}>Restaurant · Sell 4 lionfish</option><option value="cleanup" ${this.order === 'cleanup' ? 'selected' : ''}>Cleanup · Remove 2 pieces of gear</option><option value="restore" ${this.order === 'restore' ? 'selected' : ''}>Restoration · Plant 2 fragments</option></select><p id="order-detail" class="contract-note">${orderText[this.order]}</p><div class="launch-row"><button class="primary" data-action="${p.pending ? 'review' : p.active ? 'resume' : 'dive'}">${p.pending ? 'Review landed catch' : p.active ? 'Resume suspended dive' : 'Begin dive'} <span aria-hidden="true">↗</span></button><button data-screen="journal" title="Reef chart">Chart</button></div><p class="status-note">${p.pending ? 'Your last outing is ready to settle.' : p.active ? 'Saved mid-dive. Air and wildlife have been paused.' : this.event ? 'Event entered · Land safely to record your score.' : 'Air filled · Nursery fragments stocked · Pole spear ready'}</p></section></div><footer class="bottomline"><span>Reef Sweep · v0.4 preview · Local saves</span><button class="link-button" data-screen="help" style="font-size:10px">Credits & controls</button></footer>`; }
    nightControl(p) { const available = (0, data_js_1.upgradeLevel)(p, 'torch') >= 1 && (0, data_js_1.siteUnlocked)(p, 'passage'), lockedReason = (0, data_js_1.upgradeLevel)(p, 'torch') < 1 ? 'Regulator level 2 → fit a head torch → unlock Tideglass Passage.' : 'Unlock Tideglass Passage to open night dives.'; return `<label class="night-option"><span><strong>Night dive</strong><small>${available ? 'Challenge conditions · torch and wildlife adapt to the dark.' : lockedReason}</small></span><input type="checkbox" aria-label="Night dive" data-night ${this.night ? 'checked' : ''} ${available && !p.active && !p.pending ? '' : 'disabled'}></label>`; }
    gearCard(u, p) { const level = (0, data_js_1.upgradeLevel)(p, u.id), maxed = level >= data_js_1.MAX_UPGRADE_LEVEL, cost = (0, data_js_1.upgradeCost)(p, u.id), blockedBy = u.requires && (0, data_js_1.upgradeLevel)(p, u.requires) < (u.requiredLevel ?? 1), prerequisiteName = u.requires ? data_js_1.UPGRADES.find(item => item.id === u.requires)?.name || u.requires : '', requirement = u.requires === 'air' ? `Regulator level ${u.requiredLevel ?? 1} needed` : `${prerequisiteName} needed`, service = (0, data_js_1.upgradeServiceRequirement)(p, u.id), disabled = !service.available || maxed || p.cash < cost || !!p.active || !!p.pending || !!blockedBy; return `<article class="gear-card"><div class="gear-art" aria-hidden="true">${upgradeIcon(u.id)}</div><div class="eyebrow">${u.tag}</div><h3>${u.name}</h3><div class="gear-rank">Level ${level} <span>/ ${data_js_1.MAX_UPGRADE_LEVEL}</span></div><p>${u.description}</p>${!service.available ? `<p class="tiny status-note">${esc(service.reason)}</p>` : ""}<div class="price"><strong>${maxed ? 'MAX LEVEL' : (0, math_js_1.money)(cost)}</strong><button data-buy="${u.id}" ${disabled ? 'disabled' : ''}>${maxed ? 'Maxed' : blockedBy ? requirement : `Upgrade to ${level + 1}`}</button></div></article>`; }
    help(s) { return `<section class="modal help-copy">${this.header('Work gently. Come home.', 'DIVER’S FIELD GUIDE')}<p><b>Find the striped, fan-finned lionfish.</b> Move close, settle your aim, hold to draw the pole spear and release to strike. A fish stays exposed until you hold Interact to secure it in your tube.</p><div class="control-sheet"><div><b>Keyboard & mouse</b><p>${key(s.keys.forward)}${key(s.keys.left)}${key(s.keys.back)}${key(s.keys.right)} swim · mouse look<br>${key(s.keys.up)} ascend · ${key(s.keys.down)} descend<br>${key(s.keys.boost)} stronger fin kick · ${key(s.keys.steady)} steady<br>Mouse 1 draw / release · ${key(s.keys.interact)} hold to interact<br>${key(s.keys.scooter)} scooter · ${key(s.keys.light)} light · ${key(s.keys.journal)} chart · ${key(s.keys.watch)} raise/lower watch · Esc pause</p></div><div><b>Touch & controller</b><p>Touch (portrait or landscape): left stick moves; drag the scene to look. Hold and drag Draw to aim, then release. Hold Interact to secure catches or work. Use the Watch button in the upper HUD to check your instruments.<br>Controller: sticks move / look. Click the left stick for the dive computer by default. Button meanings vary by browser and device; open Settings → Controller calibration to see live readings and set your own map. The standard browser layout has a ready-to-use fallback.</p></div></div><p>Aim with the centre reticle. Hold Mouse 1 to draw, then release to strike. This also requests mouse capture. If capture is unavailable, simply move the mouse over the scene to look without holding a button. Left-hold still draws while aiming; right-drag also looks. Hold <b>R</b> as an alternate spear input. Uncaptured look is bounded by the browser window. Releasing or cancelling a pointer outside the canvas will not leave the controls stuck.</p><div class="rule"></div><div class="two-col"><div><h3>A living reef</h3><p><b>Cleanup:</b> hold Interact near discarded nets or crates.<br><b>Restore:</b> plant nursery-grown fragments at the marked nursery plots. Growth happens between game days.<br><b>Survey:</b> record the site at the teal survey sign. The chart marks all work areas.</p><p><b>Marlow:</b> this grouper may watch, approach and then steal an exposed fish. Secure it or move away. Your tube is safe.<br><b>Moray:</b> give its crevice room. If it moves towards you and a warning appears, back away.</p></div><div><h3>Leave a reserve</h3><p>The home marker points towards the mooring. Return to it, ascend alongside the rope, and hold Interact to board. The chart shows a route around major rocks.</p><p>Rescue costs $85 and forfeits the day’s catch, but equipment and completed reef work remain. Loan gear is always available. Pause or suspend at any time.</p><p>After the dive, sell, keep a meal or donate. Choose two highlight <b>image cards</b> to publish. They represent footage in the fiction; this build does not record playable video.</p></div></div><div class="rule"></div><h3>Inspiration, not instruction.</h3><p>Inspired by the underwater storytelling and conservation work of <b>Lionfish Extermination Corp</b>; art and loop inspiration from <b>Dave the Diver</b>. This is an independent fictional game, not affiliated with or endorsed by either. Marlow, the companies and the island are fictional. Music is an original composition using <b>Samfa12’s Pocket Chordsmith</b> instruments.</p><p>Lionfish are native in the Indo-Pacific and invasive in the Atlantic/Caribbean setting used here. Do not feed wild predators. Morays normally open their mouths to breathe; mouth opening alone is not a warning. Coral recovery is time-compressed. Air, ascent, currents, handling and restoration are simplified gameplay—not dive training, medical advice or permission to undertake real restoration.</p><p class="tiny">Babylon.js 9.26.1 · Apache-2.0. Original procedural art and game code. Source details and third-party notices are included in the handoff package.</p><div class="button-row"><button class="primary" data-close>Ready for the reef</button><button data-screen="settings">Adjust controls</button></div></section>`; }
    gamepadSettings() {
        const state = this.controllerReadout, selected = state.selectedKey || '';
        const options = state.pads.length ? state.pads.map((p) => `<option value="${esc(p.key)}" ${p.key === selected ? 'selected' : ''}>Gamepad ${p.index + 1} · ${esc(p.id)} · ${esc(p.mapping)} · ${p.axes.length} axes / ${p.buttons.length} buttons</option>`).join('') : '<option value="">No controller detected</option>';
        return `<div class="settings-section">CONTROLLER CALIBRATION</div><p class="tiny muted">Select the USB controller the game should use. Scan and calibration require a click; the controller profile stays in this browser on this device.</p><label class="setting">Active controller<select id="gamepad-choice">${options}</select></label><p id="gamepad-status" class="tiny muted" aria-live="polite"></p><pre id="gamepad-raw" class="gamepad-raw" aria-label="Live raw controller axes and buttons">Waiting for controller readings…</pre><p id="gamepad-step" class="status-note" aria-live="polite"></p><p id="gamepad-test" class="tiny muted" aria-live="polite">Live test · Connect a controller to test it.</p><div class="button-row controller-actions"><button data-action="gamepad-scan">Scan controllers</button><button id="gamepad-start" data-action="gamepad-start" ${state.connected && state.calibration.phase === 'idle' ? '' : 'disabled'}>Start guided calibration</button><button id="gamepad-cancel" data-action="gamepad-cancel" ${state.calibration.phase === 'idle' ? 'hidden' : ''}>Cancel setup</button><button id="gamepad-use" class="primary" data-action="gamepad-use" ${state.calibration.completed ? '' : 'hidden'}>Use this calibration</button><button id="gamepad-restore" data-action="gamepad-restore" ${state.connected && state.saved ? '' : 'disabled'}>Restore controller defaults</button></div><p class="tiny muted">Keep still for the neutral sample. Move each stick when prompted, then release it. For each action, press or move only that control and release before the next prompt. Trigger axes are supported. Resume your dive only after selecting Use or Cancel.</p>`;
    }
    settings(s) { const slider = (id, label, min, max, step) => `<label class="setting">${label}<span id="read-${id}" class="tiny muted">${id === 'fov' ? s[id] + '°' : id === 'sensitivity' ? Number(s[id]).toFixed(2) : Math.round(Number(s[id]) * 100) + '%'}</span><input aria-label="${label}" data-setting="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${s[id]}"></label>`; const check = (id, label, detail) => `<label class="setting"><span>${label}<small>${detail}</small></span><input type="checkbox" data-setting="${id}" ${(id === 'instrumentHud' ? s.instrumentHud !== false : s[id]) ? 'checked' : ''}></label>`; return `<section class="modal">${this.header('Make yourself comfortable.', 'SETTINGS')}<div class="two-col"><div><div class="settings-section">SOUND</div>${slider('music', 'Pocket Chordsmith music', 0, 1, .01)}${slider('ambience', 'Breathing & ambience', 0, 1, .01)}${slider('effects', 'Equipment & warnings', 0, 1, .01)}<div class="settings-section">WATER & DISPLAY</div><label class="setting">Render quality<select data-setting="quality"><option value="high" ${s.quality === 'high' ? 'selected' : ''}>High</option><option value="balanced" ${s.quality === 'balanced' ? 'selected' : ''}>Balanced</option><option value="low" ${s.quality === 'low' ? 'selected' : ''}>Performance</option></select></label><p class="tiny muted">Resolution changes immediately; decorative population changes on the next site load. Targets, wildlife and rules are unchanged.</p>${slider('fov', 'Field of view', 60, 100, 1)}${check('reducedMotion', 'Steady camera & reduced motion', 'Suppresses equipment sway and coral animation.')}${check('assist', 'Target identification', 'Names visible targets in the aiming reticle.')}${check('instrumentHud', 'Show air and timer HUD', 'Keeps air and elapsed time in view while the wrist computer is lowered.')}</div><div><div class="settings-section">CONTROLS</div>${slider('sensitivity', 'Look sensitivity', .25, 2.5, .05)}${check('invertY', 'Invert vertical look', 'Mouse, touch and controller.')}${check('toggleDraw', 'Toggle spear draw', 'Press once to draw; press again to strike.')}${slider('touchScale', 'Touch control size', .8, 1.3, .05)}<div class="settings-section">KEY BINDINGS · SELECT TO REASSIGN</div><div class="bindings">${['forward', 'back', 'left', 'right', 'up', 'down', 'boost', 'steady', 'interact', 'scooter', 'journal', 'light', 'watch'].map(a => `<div class="bind"><span>${a}</span><button data-bind="${a}">${key(s.keys[a])}</button></div>`).join('')}</div><button class="link-button tiny" data-action="defaults" style="margin-top:12px">Restore default settings</button>${this.gamepadSettings()}</div></div><div class="button-row"><button class="primary" data-close>Done</button><button data-action="fullscreen" data-fullscreen-label>Full screen</button></div></section>`; }
    journal(p) { const run = p.active || p.pending, id = run?.site || this.site, site = run ? (0, data_js_1.siteForRun)(run) : data_js_1.SITES[id], reef = p.reefs[id]; return `<section class="modal">${this.header(site.name, 'CHART / FIELD NOTES')}<div class="chart-layout"><div><canvas id="chart" width="660" height="660" class="chart" aria-label="Top-down reef chart: home buoy, player, obstacles, work sites and return route"></canvas><p class="tiny muted" style="margin-top:8px">Gold: you · cream: mooring · teal: work sites<br>Line: estimated return route · North is up</p></div><div><div class="reef-strip"><span>Reef condition</span><strong>${(0, data_js_1.healthOfReef)(p, id)} / 100</strong></div><div class="meter"><i style="width:${(0, data_js_1.healthOfReef)(p, id)}%"></i></div><div class="row-stats"><div><strong>${reef.removed.length}</strong>removals recorded</div><div><strong>${reef.cleaned.length}</strong>cleanup sites</div><div><strong>${Object.keys(reef.restored).length}</strong>coral plots</div></div><p class="recovery-note">${reefRecoveryText(p, id)}</p>${run ? `<div class="field-note"><b>Your contract</b><p>${orderText[run.order]}</p><p>This outing: ${run.removed} removed · ${run.cleaned} cleaned · ${run.restored} planted · ${run.surveyed} surveyed · ${run.fragments} fragments left. ${esc((0, campaign_ui_js_1.contractNote)(run))}</p></div>` : ''}<div class="field-note"><b>The nursery</b><p>Plant fragments at gold-tagged plots, remove nearby rubbish and record a survey. Revisit on later days to see growth.</p></div><div class="field-note"><b>${p.discoveries.includes('marlow') ? 'Marlow’s ledge' : 'A large shadow beneath the ledge'}</b><p>A broad mottled grouper sometimes follows working divers. Not a pet. Secure your catch and respect its space.</p></div><div class="field-note"><b>Company support</b><p>Stories earn followers; careful field work earns reputation. At 80, 160 and 300 followers, eligible divers can take camera and conservation story assignments. Completing them earns recognition and a gold highlight frame, without extra cash.</p></div></div></div><div class="button-row"><button class="primary" data-close>${run && !run.finished ? 'Back to the dive' : 'Back to harbour'}</button></div></section>`; }
    initDebrief(r) { const n = r.rescued ? 0 : r.cargo.length; this.allocation = { sell: n, eat: 0, donate: 0 }; this.chosen = new Set(r.clips.slice().sort((a, b) => b.quality - a.quality).slice(0, 2).map(c => c.id)); }
    debrief(p) {
        const r = p.pending;
        if (!r)
            return `<section class="modal narrow">${this.header('Nothing waiting at the dock.')}<button data-screen="dock">Harbour</button></section>`;
        const n = r.rescued ? 0 : r.cargo.length;
        const quality = typeof r.filletQuality === 'number' ? Math.round((0, math_js_1.clamp)(r.filletQuality, 0, 1) * 100) : null;
        const filletStatus = quality === null
            ? (n ? `<div class="fillet-summary"><div class="fillet-stamp" aria-hidden="true">✦</div><div><strong>Fresh catch, ready for the table</strong><p>Optional careful filleting can improve its sale value. Your allocation stays the same.</p></div><button class="outline" data-screen="filleting">Prepare fillets</button></div>` : '')
            : `<div class="fillet-summary completed"><div class="fillet-stamp" aria-hidden="true">${quality >= 75 ? '✦' : '≈'}</div><div><strong>Fillet quality · ${quality}%</strong><p>The preparation bonus will be added once when you settle this catch.</p></div></div>`;
        return `<section class="modal">${this.header(r.rescued ? 'Tomorrow is another dive.' : 'Back with a story.', 'DAY ' + r.day + ' / ' + data_js_1.SITES[r.site].name.toUpperCase())}<p class="muted tiny">${r.rescued ? 'Rescue recovered you and your equipment. The catch is lost, but your reef work remains.' : 'The engine settles. The catch goes on ice. Decide what this outing becomes.'}</p><p class="recovery-note">${reefRecoveryText(p, r.site)}</p><div class="row-stats"><div><strong>${(0, math_js_1.timeText)(r.time)}</strong>underwater</div><div><strong>${n}</strong>fish landed</div><div><strong>${r.cleaned}</strong>cleanup jobs</div><div><strong>${r.restored}</strong>corals planted</div><div><strong>${r.stolen}</strong>fish stolen</div></div><h3>Allocate your catch</h3><div class="allocation">${['sell', 'eat', 'donate'].map(a => `<label>${a === 'sell' ? 'Sell to restaurants' : a === 'eat' ? 'Keep for meals' : 'Donate to the community'}<input aria-label="${a} catch" data-allocate="${a}" type="number" min="0" max="${n}" step="1" value="${this.allocation[a]}" ${n ? '' : 'disabled'}></label>`).join('')}</div><p id="allocation-status" class="tiny muted"></p><p class="tiny muted">Selling four meets a restaurant order. A kept meal offsets $8 in food costs; extras have no further bonus. Donations build reputation.</p>${filletStatus}<div class="rule"></div><h3>Choose the stories to tell <span id="chosen-count" class="muted tiny"></span></h3><p class="tiny muted" style="margin-top:6px">Automatic highlight image cards. Publish up to two. Repeating a familiar subject earns less attention.</p><div class="highlight-grid">${r.clips.length ? r.clips.map(c => `<button class="highlight" data-clip="${esc(c.id)}" aria-pressed="false">${c.image ? `<img src="${c.image}" alt="Captured gameplay: ${esc(c.title)}">` : '<div class="blank-image">≈</div>'}<div class="card-copy"><strong>${esc(c.title)}</strong><span>${esc(c.kind)} · quality ${c.quality}</span></div><i class="check" hidden>✓</i></button>`).join('') : '<p class="tiny muted">No highlight cards this time. A quiet dive still counts.</p>'}</div><div class="button-row"><button id="settle" class="primary" data-action="settle">Settle the outing & publish</button></div></section>`;
    }
    filleting(p) {
        const r = p.pending;
        if (r?.filletQuality !== undefined)
            return (0, campaign_ui_js_1.filletResult)(r);
        if (!r || r.rescued || !r.cargo.length)
            return `<section class="modal narrow">${this.header('Catch preparation')}<p class="muted">There is no catch waiting to be filleted.</p><div class="button-row"><button class="primary" data-action="fillet-cancel">Return to the debrief</button></div></section>`;
        return `<section class="modal fillet-modal">${this.header('A careful hand.', 'CATCH PREPARATION / OPTIONAL')}<p class="muted">Line up three guided cuts with the highlighted bands. The knife moves continuously; press the button or Enter when it crosses a band. Careful timing improves the sale value.</p><div class="fillet-illustration" aria-hidden="true"><svg viewBox="0 0 360 160" role="presentation"><defs><linearGradient id="fish-body" x1="0" x2="1"><stop offset="0" stop-color="#83bdb0"/><stop offset=".52" stop-color="#d5c99f"/><stop offset="1" stop-color="#f0c58c"/></linearGradient></defs><path class="fillet-water" d="M0 112c50-18 87 15 136 0s80-11 113 0 65 4 111-10v58H0z"/><path class="fillet-fish" d="M35 79 12 57l3 45 20-16c29 31 104 36 174 13 36-12 61-29 80-34-19-6-44-22-80-34-70-23-145-18-174 13zm253-14 47-25-8 40 8 40-47-25"/><circle class="fillet-eye" cx="280" cy="75" r="3"/><path class="fillet-detail" d="M97 44c19 18 20 45 0 66M128 39c21 19 22 53 0 75M158 39c20 20 21 52 0 73M81 72c-9 4-12 10-12 15M52 53l8 49"/><g class="fillet-band" data-fillet-band="0"><rect x="99" y="51" width="20" height="54" rx="8"/><path d="M109 54v48"/></g><g class="fillet-band" data-fillet-band="1"><rect x="166" y="47" width="20" height="61" rx="8"/><path d="M176 50v55"/></g><g class="fillet-band" data-fillet-band="2"><rect x="232" y="50" width="20" height="55" rx="8"/><path d="M242 53v49"/></g><g id="fillet-knife"><path d="m0 0 31 12-25 5z"/><path d="m7 14-14 15"/><path d="m-15 34 11-11 8 8-11 11z"/></g></svg></div><div class="fillet-steps" aria-label="Filleting steps"><span data-step="0">01 · Gill</span><span data-step="1">02 · Belly</span><span data-step="2">03 · Tail</span></div><p id="fillet-cue" class="fillet-cue" aria-live="polite">Cut 1 of 3 · Behind the gill</p><p id="fillet-feedback" class="tiny muted" aria-live="polite">Wait for the moving knife to cross the glowing band.</p><div class="fillet-actions"><button class="primary" data-action="fillet-cut" aria-keyshortcuts="Enter">Make cut 1 of 3</button><button data-action="fillet-cancel">Skip preparation</button></div><p class="tiny muted fillet-footnote">The catch allocation remains yours to choose. Filleting adds a quality bonus at settlement.</p></section>`;
    }
    stopFilleting() { if (this.filletFrame && typeof cancelAnimationFrame === 'function')
        cancelAnimationFrame(this.filletFrame); this.filletFrame = 0; }
    startFilleting() {
        if (!document.getElementById('fillet-knife'))
            return;
        this.filletScores = [...(this.getProfile().pending?.filletCuts ?? [])];
        this.filletStage = this.filletScores.length;
        if (this.filletStage === 3 && this.getProfile().pending?.filletQuality === undefined) {
            this.dispatch('fillet', this.filletScores.reduce((a, b) => a + b, 0) / 3);
            this.show('filleting');
            return;
        }
        this.filletReadyAt = 0;
        this.filletScores.forEach((score, i) => { this.panel.querySelector(`[data-fillet-band="${i}"]`)?.classList.add(score >= .55 ? 'clean-cut' : 'rough-cut'); this.panel.querySelector(`[data-step="${i}"]`)?.classList.add('done'); });
        const nextButton = this.panel.querySelector('[data-action="fillet-cut"]');
        if (nextButton)
            nextButton.textContent = `Make cut ${this.filletStage + 1} of 3`;
        const nextCue = document.getElementById('fillet-cue');
        if (nextCue)
            nextCue.textContent = `Cut ${this.filletStage + 1} of 3 · ${['Behind the gill', 'Along the belly', 'Release the tail'][this.filletStage]}`;
        this.filletStarted = performance.now();
        const targets = [109, 176, 242];
        const animate = (now) => {
            if (this.screen !== 'filleting')
                return;
            const phase = ((now - this.filletStarted) % 3100) / 3100;
            this.filletBladeX = 62 + phase * 236;
            document.getElementById('fillet-knife')?.setAttribute('transform', `translate(${this.filletBladeX} 30)`);
            for (let i = 0; i < targets.length; i++)
                document.querySelector(`[data-fillet-band="${i}"]`)?.classList.toggle('active', i === this.filletStage);
            this.filletFrame = requestAnimationFrame(animate);
        };
        this.filletFrame = requestAnimationFrame(animate);
    }
    tryFilletCut() {
        if (this.screen !== 'filleting' || this.filletStage > 2 || performance.now() < this.filletReadyAt)
            return;
        this.filletReadyAt = performance.now() + 500;
        const targets = [109, 176, 242], target = targets[this.filletStage], score = (0, math_js_1.clamp)(1 - Math.abs(this.filletBladeX - target) / 46, 0, 1);
        this.filletScores.push(score);
        this.dispatch('fillet-cut-save', [...this.filletScores]);
        this.panel.querySelector(`[data-fillet-band="${this.filletStage}"]`)?.classList.add(score >= .55 ? 'clean-cut' : 'rough-cut');
        const feedback = score >= .82 ? 'Beautifully placed.' : score >= .55 ? 'A clean, useful cut.' : score > 0 ? 'A little rough, but the catch is prepared.' : 'You missed the line; the cut still counts.';
        this.filletStage++;
        if (this.filletStage === 3) {
            const quality = this.filletScores.reduce((sum, value) => sum + value, 0) / this.filletScores.length;
            this.stopFilleting();
            this.dispatch('fillet', quality);
            this.show('filleting');
            return;
        }
        this.filletStarted = performance.now();
        const cue = ['Behind the gill', 'Along the belly', 'Release the tail'][this.filletStage];
        const button = this.panel.querySelector('[data-action="fillet-cut"]');
        if (button)
            button.textContent = `Make cut ${this.filletStage + 1} of 3`;
        const status = document.getElementById('fillet-cue');
        if (status)
            status.textContent = `Cut ${this.filletStage + 1} of 3 · ${cue}`;
        const hint = document.getElementById('fillet-feedback');
        if (hint)
            hint.textContent = feedback;
        this.panel.querySelector(`[data-step="${this.filletStage - 1}"]`)?.classList.add('done');
    }
    refreshClips() {
        for (const e of this.panel.querySelectorAll('[data-clip]')) {
            const chosen = this.chosen.has(e.dataset.clip);
            e.classList.toggle('selected', chosen);
            e.setAttribute('aria-pressed', String(chosen));
            e.querySelector('.check').hidden = !chosen;
        }
        const n = document.getElementById('chosen-count');
        if (n)
            n.textContent = `${this.chosen.size} / 2 selected`;
    }
    updateAllocation() {
        const r = this.getProfile().pending, n = r && !r.rescued ? r.cargo.length : 0, total = this.allocation.sell + this.allocation.eat + this.allocation.donate, el = document.getElementById('allocation-status');
        if (el) {
            el.textContent = total === n ? `${n} fish allocated. Ready to settle.` : `Allocate exactly ${n} fish. Currently allocated: ${total}.`;
            el.style.color = total === n ? 'var(--muted)' : 'var(--red)';
        }
        const fillet = document.getElementById('fillet-sale-bonus');
        if (fillet && r) {
            const base = r.cargo.slice(0, this.allocation.sell).reduce((n, c) => n + c.value, 0);
            fillet.textContent = `Filleting sale bonus: ${(0, math_js_1.money)(Math.round(base * (r.filletQuality ?? 0) * .3))} on ${this.allocation.sell} fish sold.`;
        }
        document.getElementById('settle')?.toggleAttribute('disabled', total !== n);
    }
    play() { this.panel.hidden = true; this.hud.hidden = false; document.body.classList.add('game'); document.getElementById('menu-backdrop').hidden = true; }
    toast(text) {
        const el = document.getElementById('toast');
        el.textContent = text;
        el.classList.add('visible');
        clearTimeout(this.toastTimer);
        this.panel.querySelector('#menu-message')?.remove();
        let message = null;
        if (!this.panel.hidden) {
            message = document.createElement('p');
            message.id = 'menu-message';
            message.className = 'menu-message';
            message.setAttribute('role', 'status');
            message.textContent = text;
            (this.panel.querySelector('.modal,.dock-card') ?? this.panel).prepend(message);
        }
        this.toastTimer = window.setTimeout(() => { el.classList.remove('visible'); message?.remove(); }, 4500);
    }
    slots(profiles) {
        const parent = document.getElementById('slots');
        if (!parent)
            return;
        parent.innerHTML = profiles.map(p => `<article class="save-card ${p.slot === this.getProfile().slot ? 'current' : ''}"><div><h3>Logbook ${p.slot}</h3><p>Day ${p.day} · ${(0, math_js_1.money)(p.cash)} · ${p.totalRemoved} removals${p.active ? ' · dive suspended' : ''}${p.pending ? ' · ready to settle' : ''}</p></div><button data-action="slot" data-value="${p.slot}">${p.slot === this.getProfile().slot ? 'Current' : 'Open'}</button></article>`).join('');
    }
    confirm(action, text) { this.confirmAction = action; this.confirmText = text; this.show('confirm'); }
    updateHUD(sim, control) {
        const objective = document.getElementById('campaign-progress'), lesson = document.getElementById('lesson-text'), skip = document.getElementById('lesson-skip');
        if (objective) {
            objective.hidden = false;
            objective.textContent = (0, campaign_ui_js_1.contractNote)(sim.run) + (sim.run.event ? ' · ' + (0, campaign_ui_js_1.eventNote)(sim.run) : '');
        }
        if (lesson) {
            lesson.hidden = !(0, tutorial_js_1.lessonActive)(sim.run);
            lesson.textContent = (0, tutorial_js_1.lessonActive)(sim.run) ? `First dive ${1 + (sim.run.lesson?.step ?? 0)}/7 · ${(0, tutorial_js_1.lessonPrompt)(sim.run, control, this.getSettings())}` : '';
        }
        if (skip) {
            skip.hidden = !(0, tutorial_js_1.lessonActive)(sim.run);
            skip.onclick = () => this.dispatch('tutorial-skip');
        }
        const r = sim.run, p = sim.profile, s = this.getSettings();
        document.getElementById('air').textContent = Math.ceil(r.air).toString();
        const fill = document.getElementById('air-fill');
        fill.style.width = String(Math.min(100, r.air / (0, data_js_1.airCapacity)(p) * 100)) + '%';
        fill.style.background = r.air < sim.reserve ? 'var(--sand)' : 'var(--teal)';
        const depth = Math.max(0, sim.site.surface - r.p.y), depthEl = document.getElementById('depth');
        depthEl.textContent = depth === 0 ? 'SURFACE' : depth.toFixed(1) + ' m';
        depthEl.setAttribute('aria-label', depth === 0 ? 'At the surface' : `${depth.toFixed(1)} metres deep`);
        depthEl.classList.toggle('surface-state', depth === 0);
        document.getElementById('bag').textContent = `${r.cargo.length} / ${(0, data_js_1.capacity)(p)} secured${r.exposed ? ' + 1 exposed' : ''}`;
        document.getElementById('clock').textContent = (0, math_js_1.timeText)(r.time);
        document.getElementById('condition').textContent = [r.health < 100 ? `Condition ${Math.ceil(r.health)}%` : '', r.scooter || r.light ? `Battery ${Math.ceil(r.battery)}%` : ''].filter(Boolean).join(' · ');
        const ret = document.getElementById('reticle');
        ret.classList.toggle('charging', r.charge > .01);
        ret.classList.toggle('valid', sim.aim.valid);
        document.getElementById('charge-ring').style.strokeDashoffset = String(157 * (1 - r.charge));
        const aim = sim.aim, inter = document.getElementById('interaction');
        const show = !!aim.label && (s.assist || aim.kind !== 'fish' || aim.id === 'held');
        inter.style.opacity = show ? '1' : '0';
        document.getElementById('aim-label').textContent = aim.label;
        let hint = aim.hint;
        const interactKey = control === 'touch' ? 'Interact' : control === 'gamepad' ? 'your mapped Interact control' : key(s.keys.interact);
        hint = hint.replace(/Interact/g, interactKey);
        document.getElementById('aim-hint').textContent = hint + (aim.distance > 0 ? ` · ${aim.distance.toFixed(1)} m` : '');
        const work = document.getElementById('work-meter');
        work.style.opacity = r.interaction > 0 ? '1' : '0';
        work.firstElementChild.style.width = r.interaction * 100 + '%';
        document.getElementById('return-warning').hidden = !r.returnWarn;
        document.getElementById('dive-caption').textContent = r.scooter ? 'MINNOW / CRUISING · Stow to use the spear' : `LANTERN BAY / ${sim.site.name.toUpperCase()}${r.time < 45 ? ' · The chart marks the nursery and cleanup sites.' : ''}`;
        document.getElementById('controls-hint').textContent = control === 'gamepad' ? 'Controller · map controls in Settings' : `${key(s.keys.steady)} steady · Hold ${key(s.keys.interact)} interact · ${key(s.keys.up)} up / ${key(s.keys.down)} down · ${key(s.keys.journal)} chart`;
    }
    chart(sim) {
        const el = document.getElementById('chart');
        if (!el)
            return;
        const p = this.getProfile(), currentRun = sim?.run || p.active || p.pending, id = currentRun?.site || this.site, site = currentRun ? (0, data_js_1.siteForRun)(currentRun) : data_js_1.SITES[id], ctx = el.getContext('2d'), w = el.width, scale = w / (site.radius * 2 + 20), to = (x, z) => [w / 2 + x * scale, w / 2 - z * scale];
        ctx.fillStyle = '#123a42';
        ctx.fillRect(0, 0, w, w);
        ctx.strokeStyle = '#94c9b31b';
        ctx.lineWidth = 1;
        for (let i = 0; i < w; i += w / 10) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, w);
            ctx.moveTo(0, i);
            ctx.lineTo(w, i);
            ctx.stroke();
        }
        ctx.fillStyle = '#91c5b729';
        ctx.strokeStyle = '#aad7c346';
        for (const r of site.rocks) {
            const [x, y] = to(r.p.x, r.p.z);
            ctx.beginPath();
            ctx.ellipse(x, y, r.s.x * scale, r.s.z * scale, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.strokeStyle = '#ecd095aa';
        ctx.lineWidth = 2;
        if (sim?.route.length) {
            ctx.beginPath();
            sim.route.forEach((p, i) => { const [x, y] = to(p.x, p.z); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
            ctx.stroke();
        }
        ctx.font = '17px Trebuchet MS';
        for (const l of site.landmarks) {
            const [x, y] = to(l.p.x, l.p.z);
            ctx.fillStyle = l.kind === 'boat' ? '#f1e6c4' : '#88d9be';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 7);
            ctx.fill();
            ctx.fillText(l.name, x + 10, y - 7);
        }
        if (sim) {
            for (const j of sim.run.jobs) {
                const [x, y] = to(j.p.x, j.p.z);
                ctx.fillStyle = j.done ? '#669e83' : '#9adfc3';
                ctx.fillRect(x - 3, y - 3, 6, 6);
            }
            const r = sim.run, [x, y] = to(r.p.x, r.p.z);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(r.yaw);
            ctx.fillStyle = '#efc78f';
            ctx.beginPath();
            ctx.moveTo(0, -10);
            ctx.lineTo(-6, 7);
            ctx.lineTo(0, 4);
            ctx.lineTo(6, 7);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.fillStyle = '#cfe4cc';
        ctx.font = '15px Trebuchet MS';
        ctx.fillText('N ↑', w - 54, 30);
        ctx.fillStyle = '#aed4c099';
        ctx.font = '12px Trebuchet MS';
        ctx.fillText('CHARTED REEF / NOT TO DIVE-PLANNING SCALE', 18, w - 16);
    }
}
exports.UI = UI;

}};const cache={};function norm(p){const out=[];for(const s of p.split('/')){if(s==='..')out.pop();else if(s!=='.'&&s)out.push(s);}return out.join('/');}function load(id){if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;modules[id](s=>load(norm(id.slice(0,id.lastIndexOf('/')+1)+s).replace(/\.js$/,'.ts') in modules ? norm(id.slice(0,id.lastIndexOf('/')+1)+s).replace(/\.js$/,'.ts') : norm(id.slice(0,id.lastIndexOf('/')+1)+s)),m,m.exports);return m.exports;}load("main.ts");})();
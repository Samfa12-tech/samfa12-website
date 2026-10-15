import type { Action, GamepadProfile, InputFrame, PadAction, PadAxis, Settings } from './game/types.js';
import { EMPTY_INPUT } from './game/simulation.js';
import { clamp } from './game/math.js';
const PAD_AXES: PadAxis[] = ['moveX', 'moveZ', 'lookX', 'lookY'];
const PAD_BUTTONS: { action: PadAction; prompt: string }[] = [
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
const finiteAxis = (n: number | undefined) => Number.isFinite(n) ? clamp(n!, -1, 1) : 0;
const rawAxis = (n: number | undefined) => Number.isFinite(n) ? n! : 0;
const median = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
export function gamepadKey(pad: Pick<Gamepad, 'id' | 'mapping' | 'axes' | 'buttons'>) { return `${String(pad.id || 'Unknown gamepad').trim().replace(/\s+/g, ' ')}::${pad.mapping || 'raw'}::a${pad.axes.length}::b${pad.buttons.length}`; }
export function gamepadSelectionKey(pad: Gamepad) { return `${gamepadKey(pad)}::slot${pad.index}`; }
function standardProfile(pad: Gamepad): GamepadProfile {
    const standard = pad.mapping === 'standard';
    return { key: gamepadKey(pad), id: pad.id || 'Unknown gamepad', mapping: pad.mapping || '', axisCount: pad.axes.length, buttonCount: pad.buttons.length,
        axes: { moveX: { index: 0, sign: 1 }, moveZ: { index: 1, sign: -1 }, lookX: { index: 2, sign: 1 }, lookY: { index: 3, sign: 1 } },
        centers: Array.from(pad.axes, () => 0),
        buttons: { spear: 7, interact: 0, up: 3, down: 1, scooter: 2, steady: 4, boost: 5, pause: 9, light: 6, journal: 8, watch: 10, menuConfirm: 0, menuBack: 1, menuPrevious: 12, menuNext: 13 },
        axisButtons: {}, moveDeadzone: .14, lookDeadzone: .2 };
}
/** Narrow known-good preset from Spin Vector's exact Windows USB capture. */
export function knownBackboneProfile(pad: Gamepad): GamepadProfile | null {
    const id = String(pad.id || '').toLowerCase();
    if (!/backbone/.test(id) || !/vendor:\s*358a/.test(id) || !/product:\s*0204/.test(id) || pad.mapping === 'standard' || pad.axes.length < 6 || pad.buttons.length < 12) return null;
    const profile = standardProfile(pad);
    profile.axes = { moveX: { index: 0, sign: 1 }, moveZ: { index: 1, sign: -1 }, lookX: { index: 2, sign: 1 }, lookY: { index: 5, sign: 1 } };
    profile.centers = Array.from(pad.axes, () => 0);
    profile.centers[3] = -1; profile.centers[4] = -1; if (profile.centers.length > 9) profile.centers[9] = 1;
    profile.axisButtons = { spear: { index: 3, value: 1 }, light: { index: 4, value: 1 } };
    profile.buttons = { spear: 9, interact: 0, up: 3, down: 1, scooter: 2, steady: 4, boost: 5, pause: 11, light: 6, journal: 8, watch: 10, menuConfirm: 0, menuBack: 1, menuPrevious: 12, menuNext: 13 };
    return profile;
}
const checkedWatchDefaults = new WeakSet<GamepadProfile>();
function profileFor(settings: Settings, pad: Gamepad) {
    const saved=settings.gamepads?.[gamepadKey(pad)];
    if(!saved)return knownBackboneProfile(pad)||standardProfile(pad);
    if(!checkedWatchDefaults.has(saved)){
        checkedWatchDefaults.add(saved);
        // Older calibrated profiles predate the watch. Add a spare, known stick
        // click without changing any measured axes, triggers or existing buttons.
        const fallback=pad.mapping==='standard'?10:knownBackboneProfile(pad)?.buttons.watch;
        if(saved.buttons.watch===undefined&&!saved.axisButtons.watch&&fallback!==undefined&&fallback<pad.buttons.length&&!Object.values(saved.buttons).includes(fallback))saved.buttons.watch=fallback;
    }
    return saved;
}
function mappedAxis(pad: Gamepad, profile: GamepadProfile, axis: PadAxis) {
    const binding = profile.axes[axis], center = finiteAxis(profile.centers[binding.index]);
    const raw = finiteAxis(pad.axes[binding.index]), delta = raw - center;
    const range = delta < 0 ? center + 1 : 1 - center;
    return clamp((range > .001 ? delta / range : 0) * binding.sign, -1, 1);
}
function mappedButton(pad: Gamepad, profile: GamepadProfile, action: PadAction) {
    const index = profile.buttons[action];
    if (index !== undefined) { const b = pad.buttons[index]; if (b && (b.pressed || b.value >= .5)) return true; }
    const bind = profile.axisButtons[action];
    if (bind) { const v = finiteAxis(pad.axes[bind.index]), travel = Math.abs(bind.value - finiteAxis(profile.centers[bind.index])); return travel > .1 && Math.abs(v - bind.value) <= Math.max(.07, travel * .24); }
    return false;
}
type Calibration = { key: string; phase: 'neutral' | 'axes' | 'buttons' | 'complete'; neutral: number[][]; centers: number[]; axisStep: number; buttonStep: number; waitingRelease: boolean; axes: GamepadProfile['axes']; buttons: GamepadProfile['buttons']; axisButtons: GamepadProfile['axisButtons']; profile?: GamepadProfile };
export class InputController {
    menuValueAt=0;
    active = false;
    keys = new Set<string>();
    blockedKeys = new Set<string>();
    touch = new Set<string>();
    lookX = 0;
    lookY = 0;
    release = false;
    cancelDraw = false;
    drawToggle = false;
    joyX = 0;
    joyZ = 0;
    previousPad: boolean[] = [];
    previousPadActions: Partial<Record<PadAction, boolean>> = {};
    blockedPadActions = new Set<PadAction>();
    selectedPadKey: string | null = null;
    selectedPadIndex: number | null = null;
    currentPad: Gamepad | null = null;
    calibration: Calibration | null = null;
    padDisconnected = false;
    lookPointer = -1;
    lastX = 0;
    lastY = 0;
    hoverX: number | null = null;
    hoverY = 0;
    touchMode = matchMedia('(pointer:coarse)').matches;
    gamepad = false;
    watchRaised = false;
    boatMode = false;
    constructor(public canvas: HTMLCanvasElement, public settings: Settings, public command: (action: Action) => void) {
        window.addEventListener('keydown', e => { if (this.calibration) return; if ((e.target as HTMLElement)?.matches('input,select,textarea'))
            return; const action = this.actionFor(e.code); if (!action)
            return; if (action === 'pause' || action === 'journal') {
            if (!e.repeat) {
                e.preventDefault();
                this.command(action);
            }
            return;
        } if (this.blockedKeys.has(e.code)) { e.preventDefault(); return; } if ((action === 'spear' || action === 'interact') && this.watchRaised) { e.preventDefault(); if (!e.repeat) { this.blockedKeys.add(e.code); this.command('watch'); } return; } if (!this.active)
            return; e.preventDefault(); if (!e.repeat && ['scooter', 'light'].includes(action))
            this.command(action); if (action === 'watch' && !e.repeat)
            this.command(action); if (action === 'spear' && !e.repeat && this.settings.toggleDraw)
            this.toggle();
        else
            this.keys.add(e.code); });
        window.addEventListener('keyup', e => { if (this.blockedKeys.delete(e.code)) { this.keys.delete(e.code); return; } if (this.actionFor(e.code) === 'spear' && !this.settings.toggleDraw && this.keys.has(e.code))
            this.release = true; this.keys.delete(e.code); });
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        canvas.addEventListener('pointerleave', () => { this.hoverX = null; });
        canvas.addEventListener('pointerdown', e => { if (!this.active)
            return; canvas.focus({ preventScroll: true }); if(this.boatMode)return; if (e.pointerType === 'touch') {
            this.touchMode = true;
            this.lookPointer = e.pointerId;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            canvas.setPointerCapture(e.pointerId);
            return;
        } this.touchMode = false;
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
        } if (e.button === 2) {
            this.lookPointer = e.pointerId;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            canvas.setPointerCapture(e.pointerId);
        } });
        window.addEventListener('pointermove', e => { if (!this.active)
            return; if (document.pointerLockElement === canvas && e.pointerType !== 'touch') {
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
        else this.hoverX = null;
        });
        window.addEventListener('pointerup', e => { if (e.button === 0 && e.pointerType !== 'touch') this.blockedKeys.delete('Mouse0'); if (e.button === 0 && e.pointerType !== 'touch' && this.keys.has('Mouse0')) {
            this.keys.delete('Mouse0');
            this.release = true;
        } if (e.pointerId === this.lookPointer)
            this.lookPointer = -1; });
        window.addEventListener('pointercancel', () => this.clear());
        canvas.addEventListener('lostpointercapture', e => {
            // Pointer lock takes over capture during normal mouse entry.
            if (document.pointerLockElement !== canvas &&
                (this.lookPointer === e.pointerId || this.keys.has('Mouse0')))
                this.clear();
        });
        window.addEventListener('blur', () => this.clear());
        document.addEventListener('pointerlockchange', () => { if (!this.active && document.pointerLockElement === this.canvas) {document.exitPointerLock();return;} if (this.active && !document.pointerLockElement && !this.touchMode) {
            this.clear();
            this.command('pause');
        } });
    }
    actionFor(code: string): Action | undefined { if (code === 'KeyR' && !Object.values(this.settings.keys).includes('KeyR'))
        return 'spear'; return (Object.keys(this.settings.keys) as Action[]).find(k => this.settings.keys[k] === code); }
    toggle() { if (this.drawToggle) {
        this.release = true;
        this.drawToggle = false;
    }
    else
        this.drawToggle = true; }
    capture() { if(this.boatMode)return; if (!this.active || this.touchMode)
        return; try {
        const p = this.canvas.requestPointerLock();
        if (p && typeof p.catch === 'function')
            p.then(() => {if(!this.active&&document.pointerLockElement===this.canvas)document.exitPointerLock();}).catch(() => { });
    }
    catch { } }
    setActive(v: boolean) { this.active = v; this.clear(); if (v) { const pad = this.selectedGamepad(); if (pad) { const profile = profileFor(this.settings, pad); for (const item of PAD_BUTTONS) if (mappedButton(pad, profile, item.action)) this.blockedPadActions.add(item.action); } } if (!v && document.pointerLockElement)
        document.exitPointerLock(); }
    setWatchRaised(value: boolean) { this.watchRaised = value; if (value) { this.cancelDraw = true; this.release = false; this.drawToggle = false; for (const code of this.keys) { const action = this.actionFor(code); if (action === 'spear' || action === 'interact') { this.blockedKeys.add(code); this.keys.delete(code); } } this.touch.delete('spear'); this.touch.delete('interact'); if (this.keys.has('Mouse0')) this.blockedKeys.add('Mouse0'); this.keys.delete('Mouse0'); const pad = this.selectedGamepad(); if (pad) { const profile = profileFor(this.settings, pad); if (mappedButton(pad, profile, 'spear')) this.blockedPadActions.add('spear'); if (mappedButton(pad, profile, 'interact')) this.blockedPadActions.add('interact'); } } }
    pads(): Gamepad[] { try { return Array.from(navigator.getGamepads?.() || []).filter((p): p is Gamepad => !!p?.connected); } catch { return []; } }
    padChoices() { return this.pads().map(p => ({ key: gamepadSelectionKey(p), profileKey: gamepadKey(p), index: p.index, id: p.id || 'Unknown gamepad', mapping: p.mapping || 'raw', axes: Array.from(p.axes, rawAxis), buttons: Array.from(p.buttons, b => Number(b.value.toFixed(2))) })); }
    selectPad(selectionKey: string | null) { const pad = selectionKey ? this.pads().find(p => gamepadSelectionKey(p) === selectionKey) : null; this.selectedPadKey = pad ? gamepadKey(pad) : null; this.selectedPadIndex = pad?.index ?? null; this.previousPad = []; this.previousPadActions = {}; this.calibration = null; this.cancelDraw = true; this.release = false; }
    selectedGamepad() { const pads = this.pads(); if (!this.selectedPadKey) return pads[0] || null; return pads.find(p => gamepadKey(p) === this.selectedPadKey && p.index === this.selectedPadIndex) || pads.find(p => gamepadKey(p) === this.selectedPadKey) || null; }
    startCalibration() {
        const pad = this.selectedGamepad();
        if (!pad) { this.calibration = null; return false; }
        this.selectedPadKey = gamepadKey(pad);
        this.selectedPadIndex = pad.index;
        this.calibration = { key: gamepadKey(pad), phase: 'neutral', neutral: [], centers: [], axisStep: 0, buttonStep: 0, waitingRelease: false, axes: {} as GamepadProfile['axes'], buttons: {}, axisButtons: {} };
        this.previousPad = Array.from(pad.buttons, b => b.pressed || b.value >= .5);
        this.previousPadActions = {};
        this.cancelDraw = true; this.release = false; this.drawToggle = false;
        return true;
    }
    cancelCalibration() { this.calibration = null; this.previousPad = []; this.previousPadActions = {}; this.cancelDraw = true; this.release = false; this.drawToggle = false; }
    useCalibration() { if (!this.calibration?.profile) return false; this.settings.gamepads ??= {}; this.settings.gamepads[this.calibration.key] = this.calibration.profile; this.calibration = null; this.previousPad = []; this.previousPadActions = {}; this.cancelDraw = true; this.release = false; return true; }
    restorePadDefaults() { const pad = this.selectedGamepad(); if (pad && this.settings.gamepads) delete this.settings.gamepads[gamepadKey(pad)]; this.cancelCalibration(); }
    calibrationStatus() {
        const c = this.calibration;
        const prompts = ['Push LEFT stick fully RIGHT', 'Push LEFT stick fully FORWARD', 'Push RIGHT stick fully RIGHT', 'Push RIGHT stick fully DOWN'];
        if (!c) return { phase: 'idle', prompt: '', step: 0, total: PAD_BUTTONS.length + PAD_AXES.length, completed: false };
        if (c.phase === 'neutral') return { phase: c.phase, prompt: 'Let go of both sticks and every button. Hold neutral while the center is sampled.', step: 0, total: PAD_BUTTONS.length + PAD_AXES.length, completed: false };
        if (c.phase === 'axes') return { phase: c.phase, prompt: c.waitingRelease ? 'Return the stick to neutral before continuing.' : prompts[c.axisStep], step: c.axisStep + 1, total: PAD_BUTTONS.length + PAD_AXES.length, completed: false };
        if (c.phase === 'buttons') return { phase: c.phase, prompt: c.waitingRelease ? 'Release all controls and return the sticks to neutral.' : PAD_BUTTONS[c.buttonStep].prompt, step: PAD_AXES.length + c.buttonStep + 1, total: PAD_BUTTONS.length + PAD_AXES.length, completed: false };
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
    updateCalibration(pad: Gamepad) {
        const c = this.calibration; if (!c || c.phase === 'complete' || gamepadKey(pad) !== c.key) return;
        const axes = Array.from(pad.axes, finiteAxis), pressed = Array.from(pad.buttons, b => b.pressed || b.value >= .5);
        const usedAxes = new Set(Object.values(c.axes).map(x => x?.index));
        const centered = () => axes.every((v, i) => Math.abs(v - finiteAxis(c.centers[i])) < .24);
        if (c.phase === 'neutral') {
            if (pressed.some(Boolean)) { c.neutral = []; return; }
            c.neutral.push(axes);
            if (c.neutral.length >= 12) { c.centers = Array.from({ length: Math.max(pad.axes.length, ...c.neutral.map(x => x.length)) }, (_, i) => median(c.neutral.map(x => finiteAxis(x[i])))); c.phase = 'axes'; }
            return;
        }
        if (c.waitingRelease) {
            if (!pressed.some(Boolean) && centered()) c.waitingRelease = false;
            return;
        }
        if (c.phase === 'axes') {
            const ranked = axes.map((v, index) => ({ index, delta: v - finiteAxis(c.centers[index]) })).filter(x => !usedAxes.has(x.index)).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
            if (!ranked.length || Math.abs(ranked[0].delta) < .52) return;
            const axis = PAD_AXES[c.axisStep]; c.axes[axis] = { index: ranked[0].index, sign: ranked[0].delta < 0 ? -1 : 1 };
            c.axisStep++; c.waitingRelease = true;
            if (c.axisStep >= PAD_AXES.length) { c.phase = 'buttons'; c.waitingRelease = true; }
            return;
        }
        const action = PAD_BUTTONS[c.buttonStep].action;
        const buttonIndex = pressed.findIndex(Boolean);
        if (buttonIndex >= 0) c.buttons[action] = buttonIndex;
        else {
            const candidate = axes.map((value, index) => ({ index, value, delta: value - finiteAxis(c.centers[index]) })).filter(x => !usedAxes.has(x.index)).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
            if (!candidate || Math.abs(candidate.delta) < .12) return;
            c.axisButtons[action] = { index: candidate.index, value: candidate.value };
        }
        c.buttonStep++; c.waitingRelease = true;
        if (c.buttonStep >= PAD_BUTTONS.length) {
            const noise = (axis: PadAxis) => { const index = c.axes[axis].index; return Math.max(0, ...c.neutral.map(row => Math.abs(finiteAxis(row[index]) - finiteAxis(c.centers[index])))); };
            const moveDeadzone = clamp(Math.max(noise('moveX'), noise('moveZ')) + .06, .12, .35);
            const lookDeadzone = clamp(Math.max(noise('lookX'), noise('lookY')) + .08, .17, .4);
            const profile: GamepadProfile = { key: c.key, id: pad.id || 'Unknown gamepad', mapping: pad.mapping || '', axisCount: pad.axes.length, buttonCount: pad.buttons.length, axes: c.axes, centers: c.centers, buttons: c.buttons, axisButtons: c.axisButtons, moveDeadzone, lookDeadzone };
            c.profile = profile; c.phase = 'complete'; c.waitingRelease = false;
        }
    }
    clear() { for (const code of this.keys) { const action = this.actionFor(code); if (action === 'spear' || action === 'interact') this.blockedKeys.add(code); } this.keys.clear(); this.touch.clear(); this.lookX = this.lookY = 0; this.joyX = this.joyZ = 0; this.release = false; this.cancelDraw = true; this.drawToggle = false; this.lookPointer = -1; this.hoverX = null; this.previousPad = []; this.previousPadActions = {}; this.blockedPadActions.clear(); if (this.active) { const pad = this.selectedGamepad(); if (pad) { const profile = profileFor(this.settings, pad); for (const item of PAD_BUTTONS) if (mappedButton(pad, profile, item.action)) this.blockedPadActions.add(item.action); } } const knob = document.getElementById('joy-knob'); if (knob)
        knob.style.transform = 'translate(0,0)'; }
    mountTouch() {
        const joy = document.getElementById('joystick')!, knob = document.getElementById('joy-knob')!;
        let pointer = -1, originX = 0, originY = 0;
        const update = (e: PointerEvent) => { const dx = clamp(e.clientX - originX, -44, 44), dy = clamp(e.clientY - originY, -44, 44); const len = Math.hypot(dx, dy), d = Math.max(44, len); this.joyX = dx / d; this.joyZ = -dy / d; knob.style.transform = `translate(${dx}px,${dy}px)`; };
        joy.addEventListener('pointerdown', e => { if (!this.active || pointer !== -1)
            return; this.touchMode = true; e.preventDefault(); pointer = e.pointerId; const box = joy.getBoundingClientRect(); originX = box.left + box.width / 2; originY = box.top + box.height / 2; joy.setPointerCapture(pointer); update(e); });
        joy.addEventListener('pointermove', e => { if (pointer === e.pointerId)
            update(e); });
        const end = (e: PointerEvent) => { if (pointer !== e.pointerId)
            return; pointer = -1; this.joyX = this.joyZ = 0; knob.style.transform = 'translate(0,0)'; };
        joy.addEventListener('pointerup', end);
        joy.addEventListener('pointercancel', end);
        joy.addEventListener('lostpointercapture', end);
        for (const btn of document.querySelectorAll<HTMLElement>('[data-touch]')) {
            const action = btn.dataset.touch!;
            let id = -1;
            btn.addEventListener('pointerdown', e => { if (!this.active || id !== -1)
                return; e.preventDefault(); this.touchMode = true; id = e.pointerId; btn.setPointerCapture(id); btn.classList.add('pressed'); if (['scooter', 'light', 'pause', 'journal', 'watch'].includes(action)) {
                this.command(action as Action);
                return;
            } if ((action === 'spear' || action === 'interact') && this.watchRaised) {
                this.command('watch');
            } else if (action === 'spear') {
                if (this.settings.toggleDraw)
                    this.toggle();
                else
                    this.touch.add('spear');
                this.lookPointer = id;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
            }
            else
                this.touch.add(action); });
            const up = (e: PointerEvent) => { if (e.pointerId !== id)
                return; id = -1; btn.classList.remove('pressed'); if (action === 'spear' && !this.settings.toggleDraw && this.touch.has('spear'))
                this.release = true; this.touch.delete(action); if (this.lookPointer === e.pointerId)
                this.lookPointer = -1; };
            btn.addEventListener('pointerup', up);
            const cancel = (e: PointerEvent) => { if(e.pointerId !== id)return; this.cancelDraw = true; this.drawToggle = false; up(e); this.release = false; };
            btn.addEventListener('pointercancel', cancel);
            btn.addEventListener('lostpointercapture', cancel);
        }
    }
    down(a: Action) { if (a === 'spear' && this.keys.has('KeyR') && !Object.values(this.settings.keys).includes('KeyR'))
        return true; return this.keys.has(this.settings.keys[a]) || this.touch.has(a); }
    sample(dt: number): InputFrame {
        const watchRaisedAtFrame = this.watchRaised;
        const pad = this.selectedGamepad();
        this.padDisconnected = !!this.currentPad && !pad;
        this.gamepad = !!pad;
        let px = 0, pz = 0, py = 0, draw = false, interact = false, steady = false, boost = false;
        if (this.padDisconnected && this.currentPad) { this.cancelDraw = true; this.drawToggle = false; this.release = false; this.previousPad = []; this.previousPadActions = {}; }
        if (pad) {
            const key = gamepadKey(pad), priorKey = this.currentPad ? gamepadKey(this.currentPad) : null;
            if (priorKey && priorKey !== key) { this.cancelDraw = true; this.release = false; this.previousPad = []; this.previousPadActions = {}; }
            this.currentPad = pad;
            this.updateCalibration(pad);
        } else this.currentPad = null;
        if (pad) {
            const profile = profileFor(this.settings, pad);
            const pressed = pad.buttons.map(b => b.pressed || b.value >= .5);
            const held = (a: PadAction) => mappedButton(pad, profile, a) && !this.blockedPadActions.has(a);
            const rawActions = Object.fromEntries(PAD_BUTTONS.map(x => [x.action, mappedButton(pad, profile, x.action)])) as Record<PadAction, boolean>;
            for (const item of PAD_BUTTONS) if (!rawActions[item.action]) this.blockedPadActions.delete(item.action);
            const actionNow = Object.fromEntries(PAD_BUTTONS.map(x => [x.action, rawActions[x.action] && !this.blockedPadActions.has(x.action)])) as Record<PadAction, boolean>;
            const edge = (a: PadAction) => actionNow[a] && !this.previousPadActions[a];
            if (this.active && !this.calibration) {
                const dz = profile.moveDeadzone;
                const axis = (a: PadAxis, deadzone: number) => { const value = mappedAxis(pad, profile, a); return Math.abs(value) < deadzone ? 0 : Math.sign(value) * (Math.abs(value) - deadzone) / (1 - deadzone); };
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
                if (edge('light')) this.command('light');
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
                    const controls = Array.from(document.querySelectorAll<HTMLElement>('#panel button:not(:disabled), #panel select, #panel input')).filter(e => e.offsetParent !== null), idx = controls.indexOf(document.activeElement as HTMLElement);
                    controls[(idx + (edge('menuPrevious') ? -1 : 1) + controls.length) % controls.length]?.focus();
                }
                const focused=document.activeElement as HTMLInputElement|HTMLSelectElement|null;
                const axisX=rawAxis(pad.axes[profile.axes.moveX.index])*profile.axes.moveX.sign;
                const now=performance.now();
                if(Math.abs(axisX)<.4)this.menuValueAt=0;
                else if(now>=this.menuValueAt&&focused){
                    const sign=axisX>0?1:-1;let changed=false;
                    if(focused.tagName==='SELECT'){
                        const select=focused as HTMLSelectElement,options=Array.from(select.options),next=options.map((o,i)=>({o,i})).filter(v=>!v.o.disabled&&(sign>0?v.i>select.selectedIndex:v.i<select.selectedIndex));
                        const option=sign>0?next[0]:next[next.length-1];if(option){select.selectedIndex=option.i;changed=true;}
                    }else if(focused.tagName==='INPUT'&&focused.type==='range'){
                        const range=focused as HTMLInputElement,step=Number(range.step)||1,value=Math.min(Number(range.max),Math.max(Number(range.min),Number(range.value)+sign*step));
                        changed=value!==Number(range.value);range.value=String(value);
                    }
                    if(changed){focused.dispatchEvent(new Event('input',{bubbles:true}));focused.dispatchEvent(new Event('change',{bubbles:true}));}
                    this.menuValueAt=now+220;
                }
                if (edge('menuConfirm'))
                    (document.activeElement as HTMLElement)?.click();
                if (edge('menuBack'))
                    document.querySelector<HTMLButtonElement>('#panel [data-close]')?.click();
            }
            this.previousPad = pressed;
            this.previousPadActions = actionNow;
        }
        const factor = .0025 * this.settings.sensitivity;
        const frame: InputFrame = { ...EMPTY_INPUT, moveX: clamp((this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0) + this.joyX + px, -1, 1), moveZ: clamp((this.down('forward') ? 1 : 0) - (this.down('back') ? 1 : 0) + this.joyZ + pz, -1, 1), vertical: clamp((this.down('up') ? 1 : 0) - (this.down('down') ? 1 : 0) + py, -1, 1), lookX: this.lookX * factor, lookY: this.lookY * factor * (this.settings.invertY ? -1 : 1), boost: this.down('boost') || boost, steady: this.down('steady') || steady, draw: !watchRaisedAtFrame && !this.watchRaised && (this.settings.toggleDraw ? this.drawToggle : this.down('spear') || draw), release: !watchRaisedAtFrame && !this.watchRaised && this.release, cancelDraw: this.cancelDraw, interact: !watchRaisedAtFrame && !this.watchRaised && (this.down('interact') || interact) };
        this.lookX = this.lookY = 0;
        this.release = false;
        this.cancelDraw = false;
        return this.active && !this.calibration ? frame : this.padDisconnected && this.active ? { ...EMPTY_INPUT, cancelDraw: frame.cancelDraw } : { ...EMPTY_INPUT };
    }
}

import { ScooterMotor } from './scooter.js';
import { BreathClock } from '../game/breathing.js';
import { SITES } from '../game/data.js';
import { SCORE } from './score.js';
import { chordInstrumentConfig, leadInstrumentConfig } from './pcs-voices.js';
import type { Settings, Run } from '../game/types.js';
import { clamp } from '../game/math.js';
/** Keep retries installed: a denied or interrupted context needs a later gesture. */
export function bindAudioUnlock(sound: Pick<Soundscape, 'start'>, target: EventTarget) {
    const unlock = () => { void sound.start(); };
    const events = ['pointerdown', 'keydown', 'touchend', 'click'];
    for (const event of events) target.addEventListener(event, unlock, { capture: true, passive: true });
    return () => { for (const event of events) target.removeEventListener(event, unlock, true); };
}
export type Mood = 'harbour' | 'explore' | 'focus' | 'danger' | 'recovery';
const freq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** One musical clock; no per-frame note generation. Voice stealing is bounded. */
export class Soundscape {
    ctx: AudioContext | null = null;
    motor: ScooterMotor | null = null;
    boatMotor: ScooterMotor | null = null;
    hidden = false;
    music!: GainNode;
    ambience!: GainNode;
    effects!: GainNode;
    pad!: GainNode;
    lead!: GainNode;
    bass!: GainNode;
    drums!: GainNode;
    timer: ReturnType<typeof setInterval> | null = null;
    noise: AudioBuffer | null = null;
    voices: {
        source: AudioScheduledSourceNode;
        gain: GainNode;
        end: number;
    }[] = [];
    step = 0;
    next = 0;
    breathClock = new BreathClock();
    breathCount = 0;
    submerged = false;
    mood: Mood = 'harbour';
    pending: Mood = 'harbour';
    settings: Settings;
    paused = false;
    lastSound = 0;
    moodUntil = 0;
    constructor(s: Settings) { this.settings = s; }
    async start() { try {
        if (this.ctx?.state === 'running' || this.hidden) return;
        if (!this.ctx) {
            const AC = window.AudioContext || (window as any).webkitAudioContext;
            if (!AC)
                return;
            const ctx = this.ctx = new AC();
            const limiter = ctx.createDynamicsCompressor();
            limiter.threshold.value = -14;
            limiter.ratio.value = 5;
            limiter.connect(ctx.destination);
            const gain = (value: number, dest: AudioNode) => { const g = ctx.createGain(); g.gain.value = value; g.connect(dest); return g; };
            this.music = gain(this.settings.music * .32, limiter);
            this.ambience = gain(this.settings.ambience * .23, limiter);
            this.effects = gain(this.settings.effects * .55, limiter);
            this.motor = new ScooterMotor(ctx, this.effects);
            this.boatMotor = new ScooterMotor(ctx, this.effects, 52);
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
        this.applyLevels();
        if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed')
            await this.ctx.resume();
        this.schedule();
    }
    catch { /* Silent play is always available. */ } }
    private applyLevels() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        for (const [bus, level] of [[this.music, this.hidden ? 0 : this.settings.music * (this.paused ? .08 : .32)],
            [this.ambience, this.hidden || this.paused ? 0 : this.settings.ambience * .23],
            [this.effects, this.hidden || this.paused ? 0 : this.settings.effects * .55]] as [GainNode, number][]) {
            // In particular, discard a warning's deferred music restore after mute/pause.
            bus.gain.cancelScheduledValues(t);
            bus.gain.setTargetAtTime(level, t, .035);
        }
    }
    setSettings(s: Settings) { this.settings = s; this.applyLevels(); }
    setMood(m: Mood) { this.pending = m; }
    setPaused(p: boolean) { this.paused = p; if (p) { this.motor?.silence(); this.boatMotor?.silence(); } this.applyLevels(); }
    setHidden(hidden: boolean) { this.hidden = hidden; if (hidden) { this.motor?.silence(); this.boatMotor?.silence(); } this.applyLevels(); }
    register(source: AudioScheduledSourceNode, gain: GainNode, end: number) { const ctx = this.ctx!; this.voices = this.voices.filter(v => v.end > ctx.currentTime); while (this.voices.length >= 48) {
        const v = this.voices.shift()!;
        try {
            v.gain.gain.setTargetAtTime(.0001, ctx.currentTime, .01);
            v.source.stop(ctx.currentTime + .04);
        }
        catch { }
    } this.voices.push({ source, gain, end }); source.onended = () => { source.disconnect(); gain.disconnect(); }; }
    tone(midi: number, t: number, dur: number, wave: OscillatorType, dest: GainNode, peak = .15, cfg: any = {}) { const ctx = this.ctx!; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = wave; o.frequency.setValueAtTime(freq(midi) * (cfg.freqMul || 1), t); o.detune.value = cfg.detune || 0; let out: AudioNode = o; let filter: BiquadFilterNode | undefined; if (cfg.filter) {
        filter = ctx.createBiquadFilter();
        filter.type = cfg.filter;
        filter.frequency.value = cfg.freq || 1800;
        out.connect(filter);
        out = filter;
    } out.connect(g); g.connect(dest); const a = cfg.attack ?? .008, d = cfg.decay ?? .15, s = cfg.sustain ?? .2, r = cfg.release ?? .25; g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(.0001, peak * s), t + a + d); g.gain.setValueAtTime(Math.max(.0001, peak * s), t + Math.max(a + d + .01, dur)); g.gain.exponentialRampToValueAtTime(.0001, t + dur + r); o.start(t); o.stop(t + dur + r + .03); this.register(o, g, t + dur + r + .03); if (filter)
        o.addEventListener('ended', () => filter!.disconnect()); }
    noiseHit(t: number, dur: number, dest: GainNode, volume: number, cutoff = 1600) { if (!this.ctx || !this.noise)
        return; const ctx = this.ctx, src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter(); src.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = cutoff; f.Q.value = .5; src.connect(f); f.connect(g); g.connect(dest); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(volume, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + dur); src.start(t); src.stop(t + dur + .02); this.register(src, g, t + dur + .02); src.addEventListener('ended', () => f.disconnect()); }
    regulator(t: number, duration: number, peak: number, cutoff: number) {
        if (!this.ctx || !this.noise) return;
        const ctx = this.ctx, source = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
        source.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.value = cutoff;
        source.connect(filter); filter.connect(gain); gain.connect(this.ambience);
        gain.gain.setValueAtTime(.0001, t); gain.gain.linearRampToValueAtTime(peak, t + .15);
        gain.gain.setValueAtTime(peak * .7, t + duration * .65); gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
        source.start(t); source.stop(t + duration + .02); this.register(source, gain, t + duration + .02);
        source.addEventListener('ended', () => filter.disconnect());
    }
    schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running' || this.hidden)
            return;
        const beat = 60 / SCORE.bpm, stepDur = beat / 4;
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
                const degree = SCORE['progression' + section][Math.floor(step / 16)], scale = SCORE.scale === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11], pc = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(SCORE.key), root = 48 + pc + scale[degree];
                const cfg = chordInstrumentConfig(mood === 'harbour' ? 'harp' : SCORE.chordInstrument || 'warm_pad');
                for (const it of [0, 2, 7])
                    for (const layer of cfg.layers || [{ wave: 'sine', level: 1 }])
                        this.tone(root + it, t, beat * 3.7, layer.wave, this.pad, cfg.peak * (layer.level || 1) * .50, { ...cfg, ...layer });
            }
            const melody = SCORE['melodyTracks' + section][0][step];
            if (melody !== null) {
                const cfg = leadInstrumentConfig(SCORE['melodyInstruments' + section][0] || 'bell'), octave = SCORE['melodyOctaves' + section][0] ?? -1;
                this.tone(72 + octave * 12 + melody, t, beat * .7, cfg.wave, this.lead, cfg.peak, { ...cfg, sustain: .09, release: .55 });
                this.tone(72 + melody, t + .012, beat * .28, 'sine', this.lead, .02, { release: .4 });
            }
            if (SCORE['grid' + section].bass[step]) {
                const degree = SCORE['progression' + section][Math.floor(step / 16)], pc = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(SCORE.key), root = 36 + pc + (SCORE.scale === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11])[degree];
                this.tone(root, t, beat * .8, 'sine', this.bass, .20, { sustain: .2, release: .18 });
            }
            if (SCORE['grid' + section].kick[step])
                this.tone(34, t, .10, 'sine', this.drums, .25, { sustain: .02, release: .12 });
            if (SCORE['grid' + section].snare[step])
                this.noiseHit(t, .10, this.drums, .22, 1500);
            if (SCORE['grid' + section].hat[step])
                this.noiseHit(t, .06, this.drums, .08, 4600);
            this.next += stepDur;
            this.step++;
        }
    }

    sfx(name: string) { const ctx = this.ctx; if (!ctx || this.paused || this.hidden)
        return; const t = ctx.currentTime; switch (name) {
        case 'boat-engine':
            this.tone(32, t, 3, 'triangle', this.effects, .10, { sustain:.35, release:1, filter:'lowpass', freq:260 });
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
    } }
    update(r: Run | null, active: boolean, thrust = 0, boatSpeed: number | null = null) {
        const audible = !this.paused && !this.hidden && this.settings.effects > 0;
        this.boatMotor?.update(boatSpeed !== null && audible, Math.abs(boatSpeed ?? 0) / 15);
        this.motor?.update(!!r && active && audible && !r.finished && r.scooter && r.battery > 0, thrust);
        this.submerged = !!r && active && !this.paused && !r.finished && r.p.y < SITES[r.site].surface - .12;
        const breath = this.breathClock.sample(r?.time ?? 0, this.submerged && !this.hidden && this.ctx?.state === 'running', this.paused);
        if (breath && this.ctx) {
            this.breathCount++;
            const now = this.ctx.currentTime;
            // Broad filtered noise makes the regulator inhale recognizable; a
            // lower, pulsed exhale accompanies the bubbles without recorded voices.
            if (breath === 'inhale') this.regulator(now, 1.25, .85, 1400);
            else for (let i = 0; i < 5; i++) this.regulator(now + i * .15, .38, .52 - i * .055, 480 + i * 65);
        }
        if (!active) {
        this.setMood('harbour');
        return;
    } if (!r)
        return; const danger = r.air < 30 || r.health < 35 || r.animals.some(a => a.state === 'warn' || a.state === 'lunge'); if (danger) {
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
        this.setMood(r.restored > 0 && r.time % 55 < 12 ? 'recovery' : 'explore'); }
    stats() { return { context: this.ctx?.state ?? 'not-started', mood: this.mood, voices: this.voices.length, step: this.step, submerged: this.submerged, breathCount: this.breathCount, motor: this.motor?.stats() ?? null, boatMotor: this.boatMotor?.stats() ?? null, hidden: this.hidden }; }
}

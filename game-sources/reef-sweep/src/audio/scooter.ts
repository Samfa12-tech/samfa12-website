/** Render-only frames have no new control sample; retain thrust until the next simulation step. */
export function sampledThrust(previous:number,playing:boolean,sampled:boolean,frame:{moveX:number;moveZ:number;vertical:number}){
    return !playing?0:sampled?Math.min(1,Math.hypot(frame.moveX,frame.moveZ,frame.vertical)):previous;
}
/** A fixed two-oscillator voice: silent at rest outside a deployed, powered dive. */
export class ScooterMotor {
    private gain: GainNode;
    private filter: BiquadFilterNode;
    private low: OscillatorNode;
    private hum: OscillatorNode;
    active = false;
    thrust = 0;
    private lastLevel = -1;
    private lastPitch = -1;
    constructor(private ctx: AudioContext, destination: AudioNode) {
        this.gain = ctx.createGain(); this.gain.gain.value = 0;
        this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 380;
        this.low = ctx.createOscillator(); this.low.type = 'sine'; this.low.frequency.value = 62;
        this.hum = ctx.createOscillator(); this.hum.type = 'triangle'; this.hum.frequency.value = 124;
        this.low.connect(this.filter); this.hum.connect(this.filter); this.filter.connect(this.gain); this.gain.connect(destination);
        this.low.start(); this.hum.start();
    }
    update(powered: boolean, thrust: number) {
        this.active = powered && this.ctx.state === 'running'; this.thrust = this.active ? Math.max(0, Math.min(1, thrust)) : 0;
        const level = this.active ? .025 + this.thrust * .075 : 0, pitch = 62 + this.thrust * 42, t = this.ctx.currentTime;
        if (Math.abs(level - this.lastLevel) > .001) { this.gain.gain.cancelScheduledValues(t); this.gain.gain.setTargetAtTime(level, t, .035); this.lastLevel = level; }
        if (Math.abs(pitch - this.lastPitch) > .5) { this.low.frequency.setTargetAtTime(pitch, t, .09); this.hum.frequency.setTargetAtTime(pitch * 2, t, .09); this.filter.frequency.setTargetAtTime(380 + this.thrust * 420, t, .09); this.lastPitch = pitch; }
    }
    silence() { this.update(false, 0); }
    dispose() { this.silence(); this.low.stop(); this.hum.stop(); this.low.disconnect(); this.hum.disconnect(); this.filter.disconnect(); this.gain.disconnect(); }
    stats() { return { active: this.active, thrust: this.thrust, gain: Math.max(0, this.lastLevel), pitchHz: this.lastPitch, voices: 2 }; }
}

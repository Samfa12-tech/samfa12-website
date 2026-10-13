/** Instrument parameters adapted directly from Sam’s Pocket Chordsmith v65.
 * Source functions: chordInstrumentConfig, leadInstrumentConfig.
 * The scheduler and bounded voice lifecycle are new for Reef Sweep. */
export function chordInstrumentConfig(name: string): any {
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
export function leadInstrumentConfig(name: string): any {
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

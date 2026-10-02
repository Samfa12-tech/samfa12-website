export const MUSIC_SECTION_IDS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']);

export const BRIARHOLD_MOTIF_DEGREES = Object.freeze([0, 2, 3, 2]);

function bossScoreProfileDefinition(encounterId, options) {
  return Object.freeze({
    encounterId,
    label: options.label,
    motifDegrees: BRIARHOLD_MOTIF_DEGREES,
    motifSteps: Object.freeze(options.motifSteps),
    pulseSteps: Object.freeze(options.pulseSteps),
    registerOffset: options.registerOffset,
    leadType: options.leadType,
    stinger: options.stinger,
    airPan: options.airPan,
    airGain: options.airGain,
    lowpass: options.lowpass,
    fx: Object.freeze({...options.fx}),
    stems: Object.freeze({
      drums: options.stems.drums,
      bass: options.stems.bass,
      chords: options.stems.chords,
      melody: options.stems.melody,
      guitar: options.stems.guitar,
    }),
  });
}

/**
 * Seven encounter identities, all carrying the same four-note oath motif.
 * Runtime variation deliberately changes spacing, register, pulse, timbre and
 * mix rather than replacing the melody, so the score remains recognisably one
 * Briarhold composition through the complete campaign.
 */
export const BOSS_SCORE_PROFILES = Object.freeze({
  'wicker-colossus': bossScoreProfileDefinition('wicker-colossus', {
    label: 'Timber Siege', motifSteps: [0, 4, 8, 12], pulseSteps: [0, 4, 8, 12], registerOffset: -12,
    leadType: 'triangle', stinger: 'wicker-knell', airPan: -0.18, airGain: 0.011, lowpass: 0.7,
    fx: {reverb: 0.12, echo: 0.02}, stems: {drums: 1, bass: 1, chords: 0.78, melody: 0.7, guitar: 0.45},
  }),
  'moss-crowned-matron': bossScoreProfileDefinition('moss-crowned-matron', {
    label: 'Moss Bell Orbit', motifSteps: [0, 3, 9, 14], pulseSteps: [0, 6, 10, 14], registerOffset: 0,
    leadType: 'sine', stinger: 'matron-bells', airPan: 0.24, airGain: 0.017, lowpass: 0.78,
    fx: {reverb: 0.34, echo: 0.12}, stems: {drums: 0.64, bass: 0.78, chords: 0.92, melody: 1, guitar: 0.32},
  }),
  'root-sapper-prime': bossScoreProfileDefinition('root-sapper-prime', {
    label: 'Fuse Under Root', motifSteps: [0, 2, 7, 11], pulseSteps: [0, 3, 8, 11, 14], registerOffset: -5,
    leadType: 'square', stinger: 'sapper-fuse', airPan: -0.28, airGain: 0.01, lowpass: 0.64,
    fx: {reverb: 0.08, echo: 0.18}, stems: {drums: 0.88, bass: 0.96, chords: 0.58, melody: 0.74, guitar: 0.86},
  }),
  'ashwing-matriarch': bossScoreProfileDefinition('ashwing-matriarch', {
    label: 'Ash Above the Road', motifSteps: [1, 6, 10, 15], pulseSteps: [0, 6, 10], registerOffset: 7,
    leadType: 'sawtooth', stinger: 'ashwing-dive', airPan: 0.36, airGain: 0.025, lowpass: 0.9,
    fx: {reverb: 0.28, echo: 0.08}, stems: {drums: 0.58, bass: 0.62, chords: 0.8, melody: 1, guitar: 0.52},
  }),
  'moonless-herald': bossScoreProfileDefinition('moonless-herald', {
    label: 'The Missing Moon', motifSteps: [0, 7, 10, 15], pulseSteps: [0, 7, 10, 15], registerOffset: 3,
    leadType: 'sine', stinger: 'herald-ward', airPan: -0.04, airGain: 0.022, lowpass: 0.52,
    fx: {reverb: 0.42, echo: 0.2}, stems: {drums: 0.42, bass: 0.68, chords: 1, melody: 0.9, guitar: 0.25},
  }),
  'caravan-eater': bossScoreProfileDefinition('caravan-eater', {
    label: 'Axles in the Briar', motifSteps: [0, 5, 8, 14], pulseSteps: [0, 5, 8, 11, 14], registerOffset: -7,
    leadType: 'sawtooth', stinger: 'caravan-lurch', airPan: 0.14, airGain: 0.012, lowpass: 0.68,
    fx: {reverb: 0.1, echo: 0.04}, stems: {drums: 0.92, bass: 1, chords: 0.65, melody: 0.58, guitar: 0.94},
  }),
  'hollow-hart+cinderwing': bossScoreProfileDefinition('hollow-hart+cinderwing', {
    label: 'Hart and Ember Sky', motifSteps: [0, 4, 11, 15], pulseSteps: [0, 4, 6, 10, 12, 15], registerOffset: 5,
    leadType: 'sawtooth', stinger: 'hart-cinderwing', airPan: 0.32, airGain: 0.03, lowpass: 0.86,
    fx: {reverb: 0.32, echo: 0.14}, stems: {drums: 0.9, bass: 0.86, chords: 0.84, melody: 1, guitar: 0.82},
  }),
});

export const BOSS_MUSIC_EVENT_STATES = Object.freeze({
  wave_start: 'wave_start',
  boss_intro: 'boss_intro',
  boss_phase_1: 'boss_phase_1',
  boss_phase_2: 'boss_phase_2',
  boss_enraged: 'boss_enraged',
  boss_final: 'boss_final',
  boss_defeat: 'combat_high',
  night_clear: 'night_clear',
  boon_choice: 'boon',
  campaign_complete: 'campaign_clear',
  run_failed: 'run_fail',
});

export const MUSIC_STATES = Object.freeze({
  menu: Object.freeze({ section: 'A', loop: true, intensity: 0.24 }),
  dawn: Object.freeze({ section: 'B', loop: true, intensity: 0.34 }),
  daytime: Object.freeze({ section: 'B', loop: true, intensity: 0.34 }),
  build_break: Object.freeze({ section: 'B', loop: true, intensity: 0.3 }),
  interwave_recovery: Object.freeze({ section: 'C', loop: true, intensity: 0.54 }),
  wave_start: Object.freeze({ section: 'C', loop: true, intensity: 0.76 }),
  combat_low: Object.freeze({ section: 'C', loop: true, intensity: 0.68 }),
  combat_high: Object.freeze({ section: 'D', loop: true, intensity: 0.96 }),
  boss_intro: Object.freeze({ section: 'D', loop: true, intensity: 0.76 }),
  boss_phase_1: Object.freeze({ section: 'D', loop: true, intensity: 0.86 }),
  boss_phase_2: Object.freeze({ section: 'D', loop: true, intensity: 0.94 }),
  boss_enraged: Object.freeze({ section: 'D', loop: true, intensity: 1 }),
  boss_final: Object.freeze({ section: 'D', loop: true, intensity: 1 }),
  boon: Object.freeze({ section: 'E', loop: true, intensity: 0.34 }),
  night_clear: Object.freeze({ section: 'E', loop: true, intensity: 0.4 }),
  run_fail: Object.freeze({ section: 'F', loop: true, intensity: 0.2 }),
  campaign_clear: Object.freeze({ section: 'E', loop: true, intensity: 0.58 })
});

export const MUSIC_STATE_ALIASES = Object.freeze({
  combat: 'combat_low',
  danger: 'combat_high',
  victory: 'night_clear',
  defeat: 'run_fail',
  boss: 'boss_phase_1'
});

export const MUSIC_THREAT_THRESHOLDS = Object.freeze({
  high: 0.62,
  low: 0.46
});

export const MUSIC_TRANSITION_QUANTIZE = 'bar';

export const MUSIC_VOICE_BUDGETS = Object.freeze({
  beat: 10,
  bass: 4,
  chord: 8,
  chug: 6,
  lead: 5,
  air: 3,
  sfx: 8,
  total: 32
});

export const MUSIC_STEPS_PER_BAR = 16;

function immutableGrid(kick, snare, hat, bass) {
  return Object.freeze({
    kick: Object.freeze(kick),
    snare: Object.freeze(snare),
    hat: Object.freeze(hat),
    bass: Object.freeze(bass)
  });
}

const quietGrid = Object.freeze({
  kick: Object.freeze([1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0]),
  snare: Object.freeze([0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0]),
  hat: Object.freeze([1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0]),
  bass: Object.freeze([1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0])
});

const menuAnswerGrid = immutableGrid(
  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
  [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0]
);
const dawnAnswerGrid = immutableGrid(
  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
  [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0]
);
const combatAnswerGrid = immutableGrid(
  [1,0,0,0,0,0,1,0,1,0,0,0,1,0,0,0],
  [0,0,0,0,1,0,0,0,0,0,1,0,1,0,0,0],
  [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
  [1,0,0,0,1,0,0,0,1,0,1,0,1,0,0,0]
);
const dangerAnswerGrid = immutableGrid(
  [1,0,1,0,1,0,0,1,1,0,1,0,1,0,1,0],
  [0,0,0,1,1,0,0,1,0,0,1,0,1,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,1,0,1,0,1,0,1,0,0,1,1,0,1,0]
);
const clearAnswerGrid = immutableGrid(
  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
  [1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,0],
  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0]
);
const failureAnswerGrid = immutableGrid(
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
);

export const BRIARHOLD_CHORDSMITH_PROJECT = Object.freeze({
  projectVersion: 17,
  title: 'Briarhold - The Green Remembers',
  key: 'D',
  scale: 'minor',
  bpm: 88,
  timeSig: 4,
  resolution: 4,
  songSequence: Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']),
  sectionBars: Object.freeze({ A: 2, B: 2, C: 2, D: 2, E: 2, F: 2 }),
  audioProfile: 'cinematic_dark_folk',
  drumKit: 'frame_drum_wood',
  bassTone: 'rounded_triangle_bass',
  chordInstrument: 'low_string_pad',
  progressionA: Object.freeze([0, 5, 3, 4]),
  progressionB: Object.freeze([0, 3, 5, 4]),
  progressionC: Object.freeze([0, 5, 6, 4]),
  progressionD: Object.freeze([0, 6, 5, 4]),
  progressionE: Object.freeze([0, 3, 5, 0]),
  progressionF: Object.freeze([0, 6, 3, 0]),
  gridA: quietGrid,
  gridB: Object.freeze({
    kick: Object.freeze([1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0]),
    snare: Object.freeze([0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0]),
    hat: Object.freeze([1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0]),
    bass: Object.freeze([1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0])
  }),
  gridC: Object.freeze({
    kick: Object.freeze([1,0,0,0,1,0,0,0,1,0,1,0,1,0,0,0]),
    snare: Object.freeze([0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0]),
    hat: Object.freeze([1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0]),
    bass: Object.freeze([1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0])
  }),
  gridD: Object.freeze({
    kick: Object.freeze([1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0]),
    snare: Object.freeze([0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1]),
    hat: Object.freeze([1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]),
    bass: Object.freeze([1,0,0,0,1,0,1,0,1,0,0,0,1,0,1,0])
  }),
  gridE: Object.freeze({
    kick: Object.freeze([1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0]),
    snare: Object.freeze([0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0]),
    hat: Object.freeze([1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0]),
    bass: Object.freeze([1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0])
  }),
  gridF: quietGrid,
  melodyTracksA: Object.freeze([Object.freeze([0,null,null,null,2,null,null,null,3,null,null,null,2,null,null,null])]),
  melodyTracksB: Object.freeze([Object.freeze([0,null,2,null,3,null,5,null,3,null,2,null,0,null,null,null])]),
  melodyTracksC: Object.freeze([Object.freeze([0,null,null,null,3,null,null,null,5,null,null,null,6,null,5,null])]),
  melodyTracksD: Object.freeze([Object.freeze([7,null,6,null,5,null,3,null,5,null,6,null,7,null,10,null])]),
  melodyTracksE: Object.freeze([Object.freeze([7,null,5,null,3,null,2,null,0,null,2,null,3,null,5,null])]),
  melodyTracksF: Object.freeze([Object.freeze([0,null,null,null,-2,null,null,null,-4,null,null,null,-7,null,null,null])]),
  gridBar2A: menuAnswerGrid,
  gridBar2B: dawnAnswerGrid,
  gridBar2C: combatAnswerGrid,
  gridBar2D: dangerAnswerGrid,
  gridBar2E: clearAnswerGrid,
  gridBar2F: failureAnswerGrid,
  progressionBar2A: Object.freeze([0, 5, 3, 0]),
  progressionBar2B: Object.freeze([0, 4, 3, 5]),
  progressionBar2C: Object.freeze([0, 6, 4, 5]),
  progressionBar2D: Object.freeze([0, 6, 3, 4]),
  progressionBar2E: Object.freeze([0, 5, 3, 0]),
  progressionBar2F: Object.freeze([0, 6, -2, 0]),
  melodyTracksBar2A: Object.freeze([Object.freeze([0,null,null,null,4,null,null,null,3,null,null,null,2,null,-2,null])]),
  melodyTracksBar2B: Object.freeze([Object.freeze([0,null,3,null,5,null,4,null,3,null,2,null,0,null,-2,null])]),
  melodyTracksBar2C: Object.freeze([Object.freeze([3,null,null,null,5,null,null,6,5,null,null,null,3,null,2,null])]),
  melodyTracksBar2D: Object.freeze([Object.freeze([10,null,7,null,6,null,5,null,7,null,6,null,5,null,3,null])]),
  melodyTracksBar2E: Object.freeze([Object.freeze([5,null,3,null,2,null,0,null,3,null,2,null,0,null,-2,null])]),
  melodyTracksBar2F: Object.freeze([Object.freeze([-4,null,null,null,-7,null,null,null,-9,null,null,null,-7,null,null,null])]),
  melodyInstrumentsA: Object.freeze(['wooden_bell']),
  melodyInstrumentsB: Object.freeze(['breath_flute']),
  melodyInstrumentsC: Object.freeze(['war_horn']),
  melodyInstrumentsD: Object.freeze(['briar_reed']),
  melodyInstrumentsE: Object.freeze(['high_strings']),
  melodyInstrumentsF: Object.freeze(['hollow_flute'])
});

export const MINOR_SCALE = Object.freeze([0, 2, 3, 5, 7, 8, 10]);

export function midiToFrequency(note) {
  return 440 * 2 ** ((Number(note) - 69) / 12);
}

export function sectionForMusicState(state) {
  return MUSIC_STATES[normalizeMusicState(state)]?.section || MUSIC_STATES.menu.section;
}

export function sectionField(project, prefix, sectionId) {
  return project?.[`${prefix}${sectionId}`] ?? null;
}

export function sectionBarField(project, prefix, sectionId, barIndex = 0) {
  const safeBar = Math.max(0, Math.trunc(Number(barIndex) || 0));
  if (safeBar > 0) {
    const variation = sectionField(project, `${prefix}Bar${safeBar + 1}`, sectionId);
    if (variation != null) return variation;
  }
  return sectionField(project, prefix, sectionId);
}

export function sectionPlaybackPosition(project, sectionId, absoluteStep, sectionStartStep = 0) {
  const bars = Math.max(1, Math.trunc(Number(project?.sectionBars?.[sectionId]) || 1));
  const totalSteps = bars * MUSIC_STEPS_PER_BAR;
  const elapsed = Math.trunc(Number(absoluteStep) || 0) - Math.trunc(Number(sectionStartStep) || 0);
  const sectionStep = ((elapsed % totalSteps) + totalSteps) % totalSteps;
  return Object.freeze({
    bar: Math.floor(sectionStep / MUSIC_STEPS_PER_BAR),
    step: sectionStep % MUSIC_STEPS_PER_BAR,
    sectionStep,
    totalSteps
  });
}

export function degreeToMidi(degree, rootMidi = 50, octave = 0) {
  const safeDegree = Math.trunc(Number(degree) || 0);
  const scaleLength = MINOR_SCALE.length;
  const wrapped = ((safeDegree % scaleLength) + scaleLength) % scaleLength;
  const scaleOctave = Math.floor(safeDegree / scaleLength);
  return rootMidi + MINOR_SCALE[wrapped] + (scaleOctave + octave) * 12;
}

export function normalizeMusicState(state) {
  const candidate = MUSIC_STATE_ALIASES[state] || state;
  return MUSIC_STATES[candidate] ? candidate : 'menu';
}

export function bossScoreProfile(encounterId) {
  return BOSS_SCORE_PROFILES[encounterId] || BOSS_SCORE_PROFILES['wicker-colossus'];
}

export function adaptiveCombatMusicState(threat = 0, previousState = 'combat_low') {
  const safeThreat = Math.max(0, Math.min(1, Number(threat) || 0));
  const previous = normalizeMusicState(previousState);
  if (previous === 'combat_high') {
    return safeThreat <= MUSIC_THREAT_THRESHOLDS.low ? 'combat_low' : 'combat_high';
  }
  return safeThreat >= MUSIC_THREAT_THRESHOLDS.high ? 'combat_high' : 'combat_low';
}

export function effectiveMusicState(baseState, threat = 0, previousState = 'combat_low') {
  const normalized = normalizeMusicState(baseState);
  if (normalized !== 'combat_low') return normalized;
  return adaptiveCombatMusicState(threat, previousState);
}

import {
  BRIARHOLD_CHORDSMITH_PROJECT,
  BOSS_MUSIC_EVENT_STATES,
  MUSIC_STATES,
  MUSIC_TRANSITION_QUANTIZE,
  MUSIC_VOICE_BUDGETS,
  adaptiveCombatMusicState,
  bossScoreProfile,
  degreeToMidi,
  effectiveMusicState,
  midiToFrequency,
  normalizeMusicState,
  sectionBarField,
  sectionForMusicState,
  sectionPlaybackPosition
} from './music-score.js';
import {NARRATIVE_AUDIO_CUE_IDS} from './narrative-content.js';

const NARRATIVE_AUDIO_CUE_PROFILES = Object.freeze(Object.fromEntries(NARRATIVE_AUDIO_CUE_IDS.map(id => [
  id,
  Object.freeze({
    id,
    kind: id === 'none' ? 'none'
      : id.startsWith('voice-') ? 'voice-chirp'
        : id === 'dawn-air' ? 'daylight-ambience'
          : id === 'arrival-step' ? 'existing-step'
            : 'bounded-stinger',
    fallback: false,
  }),
])));
const UNKNOWN_NARRATIVE_AUDIO_CUE = Object.freeze({id: 'none', kind: 'none', fallback: true});
const AUDIO_WORLD_PRESENTATION_PROFILES = Object.freeze({
  day: Object.freeze({key: 'day', ambienceCueId: 'dawn-air', musicFilterHz: 7600, ambienceGain: 0.72}),
  night: Object.freeze({key: 'night', ambienceCueId: 'none', musicFilterHz: 6800, ambienceGain: 1}),
});

export function resolveNarrativeAudioCue(cueId) {
  return NARRATIVE_AUDIO_CUE_PROFILES[cueId] ?? UNKNOWN_NARRATIVE_AUDIO_CUE;
}

export function audioWorldPresentationProfile(profileId = 'night') {
  return AUDIO_WORLD_PRESENTATION_PROFILES[profileId] ?? AUDIO_WORLD_PRESENTATION_PROFILES.night;
}

const LOOKAHEAD_SECONDS = 0.28;
const SCHEDULER_INTERVAL_MS = 35;
export const ARBALEST_IMPACT_INTERVAL_SECONDS = 0.12;
export const ENEMY_PLAYER_ATTACK_INTERVAL_SECONDS = 0.14;
export const ENEMY_GATE_ATTACK_INTERVAL_SECONDS = 0.25;
export const HUB_SERVICE_IDS = Object.freeze([
  'bellkeeper',
  'mason',
  'quartermaster',
  'trapper',
  'greenwarden'
]);
const STEPS_PER_BAR = 16;
const BREATH_SILENCE_MS = 760;
const BOSS_PHASE_CUES = new Set(['boss_intro', 'boss_phase_1', 'boss_phase_2', 'boss_enraged', 'boss_final']);
const FILMCOW_SFX_ROOT = 'assets/audio/filmcow/runtime';
const SAMPLE_FILES = Object.freeze({
  'footstep-dirt-a': `${FILMCOW_SFX_ROOT}/footstep-dirt-a.webm`,
  'footstep-dirt-b': `${FILMCOW_SFX_ROOT}/footstep-dirt-b.webm`,
  'arbalest-mechanism': `${FILMCOW_SFX_ROOT}/arbalest-mechanism.webm`,
  'arbalest-release': `${FILMCOW_SFX_ROOT}/arbalest-release.webm`,
  'arbalest-armour': `${FILMCOW_SFX_ROOT}/arbalest-armour.webm`,
  'bolt-impact-wood': `${FILMCOW_SFX_ROOT}/bolt-impact-wood.webm`,
  'runebolt-impact': `${FILMCOW_SFX_ROOT}/runebolt-impact.webm`,
  'sunfire-sustain': `${FILMCOW_SFX_ROOT}/sunfire-sustain.webm`,
  'gate-wood-break': `${FILMCOW_SFX_ROOT}/gate-wood-break.webm`,
  'ui-click': `${FILMCOW_SFX_ROOT}/ui-click.webm`
});
const UI_SAMPLE_SELECTOR = [
  '.menu-screen button', '.menu-screen input', '.menu-screen select',
  '.pause-screen button', '.boon-screen button', '.result-screen button'
].join(',');

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function mutableScore() {
  return JSON.parse(JSON.stringify(BRIARHOLD_CHORDSMITH_PROJECT));
}

export function createAudioSystem(windowRef = globalThis.window) {
  const AudioContextClass = windowRef?.AudioContext || windowRef?.webkitAudioContext;
  let context = null;
  let master = null;
  let compressor = null;
  let musicFilter = null;
  let musicBus = null;
  let sfxBus = null;
  let noiseBuffer = null;
  let schedulerTimer = null;
  let nextStepAt = 0;
  let stepIndex = 0;
  let sectionStartStep = 0;
  let lastMusicPosition = Object.freeze({section: 'A', bar: 0, step: 0, sectionStep: 0, totalSteps: 32});
  let baseMode = 'menu';
  let activeMode = 'menu';
  let desiredMode = 'menu';
  let threat = 0;
  let volume = 0.7;
  let muted = false;
  let paused = false;
  let ducked = false;
  let duckAmount = 0.45;
  let core = null;
  let coreReady = null;
  let sampleLoadPromise = null;
  let sampleLoadErrors = 0;
  let footstepIndex = 0;
  let lastGatePressureAt = Number.NEGATIVE_INFINITY;
  let lastEnemyPlayerAttackAt = Number.NEGATIVE_INFINITY;
  let lastEnemyGateAttackAt = Number.NEGATIVE_INFINITY;
  let adaptiveCombat = false;
  let previousThreatMode = 'combat_low';
  let selectedWeapon = 'arbalest';
  let worldPresentationKey = 'night';
  let lastArbalestImpactAt = Number.NEGATIVE_INFINITY;
  let sunfireSustain = null;
  let activeBossProfile = null;
  let activeBossActorId = null;
  let lastMusicEventSequence = 0;
  let breathSilenceActive = false;
  let breathSilenceToken = 0;
  const sampleBuffers = new Map();
  const roleTokens = new Map(Object.keys(MUSIC_VOICE_BUDGETS)
    .filter(role => role !== 'total')
    .map(role => [role, new Set()]));
  const counters = {
    scheduledSteps: 0,
    missedSteps: 0,
    droppedVoices: 0,
    peakVoices: 0,
    modeChanges: 0,
    sfxPlayed: 0,
    aggregatedHitEvents: 0,
    aggregatedHits: 0,
    suppressedArbalestImpacts: 0,
    sunfireStarts: 0,
    sunfireStops: 0,
    musicEventsApplied: 0,
    musicEventsSuppressed: 0,
    audibleBossStingers: 0,
    suppressedBossStingers: 0,
    breathWarnings: 0,
    hubServiceCues: Object.fromEntries(HUB_SERVICE_IDS.map(id => [id, 0])),
    enemyPlayerAttackCues: 0,
    enemyGateAttackCues: 0,
    suppressedEnemyAttackCues: 0,
    rolePeaks: Object.fromEntries([...roleTokens.keys()].map(role => [role, 0]))
  };

  function currentVoiceCount() {
    let total = 0;
    for (const tokens of roleTokens.values()) total += tokens.size;
    return total;
  }

  function pruneVoices(now = context?.currentTime || 0) {
    for (const tokens of roleTokens.values()) {
      for (const token of tokens) {
        if (token.endAt <= now) tokens.delete(token);
      }
    }
  }

  function claimVoice(role, endAt) {
    if (!context || !roleTokens.has(role)) return null;
    pruneVoices();
    const tokens = roleTokens.get(role);
    if (tokens.size >= MUSIC_VOICE_BUDGETS[role]
      || currentVoiceCount() >= MUSIC_VOICE_BUDGETS.total) {
      counters.droppedVoices += 1;
      return null;
    }
    const token = { endAt, released: false };
    tokens.add(token);
    counters.peakVoices = Math.max(counters.peakVoices, currentVoiceCount());
    counters.rolePeaks[role] = Math.max(counters.rolePeaks[role] || 0, tokens.size);
    return () => {
      if (token.released) return;
      token.released = true;
      tokens.delete(token);
    };
  }

  function createNoiseBuffer() {
    if (!context || noiseBuffer) return noiseBuffer;
    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x51f15e;
    for (let index = 0; index < data.length; index += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[index] = (seed / 0xffffffff * 2 - 1) * 0.92;
    }
    noiseBuffer = buffer;
    return buffer;
  }

  function preloadSamples() {
    if (sampleLoadPromise) return sampleLoadPromise;
    if (!context || typeof context.decodeAudioData !== 'function' || typeof windowRef?.fetch !== 'function') {
      return Promise.resolve(false);
    }
    sampleLoadPromise = Promise.all(Object.entries(SAMPLE_FILES).map(async ([id, path]) => {
      try {
        const response = await windowRef.fetch(path);
        if (!response.ok) throw new Error(`SFX ${id} returned ${response.status}`);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        sampleBuffers.set(id, buffer);
      } catch {
        sampleLoadErrors += 1;
      }
    })).then(() => sampleBuffers.size > 0);
    return sampleLoadPromise;
  }

  function initializeCore() {
    const PocketAudio = windowRef?.PocketAudioCore?.PocketAudio;
    if (!PocketAudio || core) return;
    core = new PocketAudio({ profile: 'game', musicStates: MUSIC_STATES });
    coreReady = Promise.resolve(core.loadProject(mutableScore())).then(() => {
      core.setMusicState(desiredMode);
      core.lowpass(paused ? 0.22 : 1);
      core.duck?.(ducked, { amount: duckAmount, releaseMs: 0 });
      return core;
    }).catch(() => null);
  }

  function ensure() {
    if (!AudioContextClass) return null;
    if (!context) {
      context = new AudioContextClass({ latencyHint: 'interactive' });
      master = context.createGain();
      compressor = context.createDynamicsCompressor();
      musicFilter = context.createBiquadFilter();
      musicBus = context.createGain();
      sfxBus = context.createGain();
      master.gain.value = muted ? 0 : volume;
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.24;
      musicFilter.type = 'lowpass';
      musicFilter.frequency.value = 6800;
      musicFilter.Q.value = 0.5;
      musicBus.gain.value = 0.24;
      sfxBus.gain.value = 0.64;
      musicBus.connect(musicFilter);
      musicFilter.connect(master);
      sfxBus.connect(master);
      master.connect(compressor);
      compressor.connect(context.destination);
      createNoiseBuffer();
      initializeCore();
      preloadSamples();
      startScheduler();
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function connectVoice(role, when, duration, gain, bus, pan = 0) {
    if (!context || !bus) return null;
    const endAt = when + duration + 0.08;
    const release = claimVoice(role, endAt);
    if (!release) return null;
    const envelope = context.createGain();
    const attack = Math.min(0.025, duration * 0.18);
    const releaseStart = Math.max(when + attack, when + duration * 0.72);
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + attack);
    envelope.gain.setValueAtTime(Math.max(0.0002, gain), releaseStart);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    if (typeof context.createStereoPanner === 'function') {
      const panner = context.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      envelope.connect(panner);
      panner.connect(bus);
    } else {
      envelope.connect(bus);
    }
    windowRef.setTimeout(release, Math.max(1, (endAt - context.currentTime) * 1000));
    return envelope;
  }

  function scheduleTone(role, frequencies, when, duration, options = {}) {
    if (!context) return false;
    const values = (Array.isArray(frequencies) ? frequencies : [frequencies])
      .map(Number)
      .filter(value => Number.isFinite(value) && value > 0);
    if (!values.length) return false;
    const envelope = connectVoice(
      role,
      when,
      duration,
      options.gain ?? 0.06,
      options.bus || musicBus,
      options.pan || 0
    );
    if (!envelope) return false;
    const filter = context.createBiquadFilter();
    filter.type = options.filterType || 'lowpass';
    filter.frequency.setValueAtTime(options.filter ?? 2200, when);
    filter.Q.value = options.q ?? 0.65;
    filter.connect(envelope);
    values.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = Array.isArray(options.types)
        ? options.types[index % options.types.length]
        : options.type || 'triangle';
      oscillator.frequency.setValueAtTime(frequency, when);
      if (options.endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(20, Number(options.endFrequency)),
          when + duration
        );
      }
      oscillator.detune.value = (options.detune || 0) + (index - (values.length - 1) / 2) * 3;
      oscillator.connect(filter);
      oscillator.start(when);
      oscillator.stop(when + duration + 0.02);
    });
    return true;
  }

  function scheduleNoise(role, when, duration, options = {}) {
    if (!context || !noiseBuffer) return false;
    const envelope = connectVoice(
      role,
      when,
      duration,
      options.gain ?? 0.04,
      options.bus || musicBus,
      options.pan || 0
    );
    if (!envelope) return false;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    source.buffer = noiseBuffer;
    source.loop = duration > 1.8;
    filter.type = options.filterType || 'bandpass';
    filter.frequency.value = options.filter ?? 1400;
    filter.Q.value = options.q ?? 0.8;
    source.connect(filter);
    filter.connect(envelope);
    source.start(when, options.offset ?? 0);
    source.stop(when + duration + 0.02);
    return true;
  }

  function scheduleKick(when, gain = 0.1) {
    scheduleTone('beat', 92, when, 0.18, {
      gain,
      type: 'sine',
      endFrequency: 42,
      filter: 500
    });
  }

  function scheduleSnare(when, gain = 0.055) {
    scheduleNoise('beat', when, 0.14, { gain, filter: 1200, q: 0.7 });
    scheduleTone('beat', 174, when, 0.1, { gain: gain * 0.45, type: 'triangle', filter: 720 });
  }

  function scheduleHat(when, gain = 0.018) {
    scheduleNoise('beat', when, 0.045, {
      gain,
      filterType: 'highpass',
      filter: 5900,
      q: 0.25,
      offset: (stepIndex % 13) * 0.07
    });
  }

  function musicStepDuration() {
    return 60 / BRIARHOLD_CHORDSMITH_PROJECT.bpm / 4;
  }

  function applyMode(next, immediate = false) {
    const safe = normalizeMusicState(next);
    desiredMode = safe;
    // Immediate mode is reserved for pre-roll/bootstrap. Once playback has
    // scheduled a step, all musical changes land on a bar boundary.
    const bootstrap = immediate && (!context || counters.scheduledSteps === 0);
    if (bootstrap || !context) {
      activeMode = safe;
      sectionStartStep = stepIndex;
      counters.modeChanges += 1;
    }
    Promise.resolve(coreReady).then(() => {
      if (!core) return;
      if (bootstrap) core.setMusicState(safe, { quantize: 'instant' });
      else core.queueMusicState(safe, { quantize: MUSIC_TRANSITION_QUANTIZE });
    }).catch(() => {});
  }

  function isBossMusicState(state) {
    return typeof state === 'string' && state.startsWith('boss_');
  }

  function applyBossMix(profile) {
    if (!profile) return;
    Promise.resolve(coreReady).then(() => {
      if (!core) return;
      core.setIntensity?.(MUSIC_STATES[desiredMode]?.intensity ?? 1);
      for (const [stem, amount] of Object.entries(profile.stems)) core.setStemVolume?.(stem, amount);
      core.setFx?.({...profile.fx});
      core.lowpass(paused ? 0.22 : profile.lowpass);
    }).catch(() => {});
  }

  function restoreBreathSilence() {
    if (!breathSilenceActive) return;
    breathSilenceActive = false;
    breathSilenceToken += 1;
    if (context && musicBus) {
      const target = paused ? 0.075 : 0.24 * (ducked ? 1 - duckAmount : 1);
      musicBus.gain.setTargetAtTime(target, context.currentTime, 0.045);
    }
    Promise.resolve(coreReady).then(() => {
      core?.duck?.(ducked, {amount: duckAmount, releaseMs: 180});
    }).catch(() => {});
  }

  function beginBreathSilence() {
    breathSilenceActive = true;
    counters.breathWarnings += 1;
    const token = ++breathSilenceToken;
    if (context && musicBus) musicBus.gain.setTargetAtTime(0.012, context.currentTime, 0.018);
    Promise.resolve(coreReady).then(() => {
      core?.duck?.(true, {amount: 0.9, releaseMs: 0});
      core?.lowpass?.(0.28);
    }).catch(() => {});
    windowRef.setTimeout(() => {
      if (token === breathSilenceToken) restoreBreathSilence();
    }, BREATH_SILENCE_MS);
  }

  function playAudibleBossStinger(cue, profile, actorId = null) {
    Promise.resolve(coreReady).then(() => core?.triggerStinger?.(
      cue === 'dragon_breath' ? 'dragon_breath' : profile?.stinger || cue
    )).catch(() => {});
    if (paused) {
      counters.suppressedBossStingers += 1;
      return false;
    }
    const offset = (profile?.registerOffset ?? 0) + (actorId === 'cinderwing' ? 7 : actorId === 'hollow-hart' ? -5 : 0);
    const motif = profile?.motifDegrees ?? [0, 2, 3, 2];
    const root = 50 + offset;
    let played = false;
    if (cue === 'dragon_breath') {
      played = sfxNoise(0.52, {gain: 0.082, filter: 720, q: 0.46, pan: 0.24}) || played;
      played = sfxTone([midiToFrequency(root - 12), midiToFrequency(root)], 0.58,
        {gain: 0.052, type: 'sawtooth', endFrequency: 42, filter: 980, pan: 0.18}) || played;
    } else if (cue === 'boss_defeat') {
      played = sfxTone(motif.map(degree => midiToFrequency(degreeToMidi(degree, root))), 0.78,
        {gain: 0.045, type: 'triangle', filter: 2400}) || played;
    } else {
      played = sfxTone(motif.map(degree => midiToFrequency(degreeToMidi(degree, root))), 0.34,
        {gain: 0.032, type: profile?.leadType || 'triangle', filter: 1900}) || played;
    }
    if (played) counters.audibleBossStingers += 1;
    else counters.suppressedBossStingers += 1;
    return played;
  }

  function applyMusicEvent(event = {}) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) return false;
    const kind = typeof event.kind === 'string' ? event.kind : '';
    const supported = Object.hasOwn(BOSS_MUSIC_EVENT_STATES, kind)
      || kind === 'dragon_breath_warning' || kind === 'dragon_breath';
    if (!supported) return false;
    if (event.sequence !== undefined && event.sequence !== null) {
      const sequence = Number(event.sequence);
      if (!Number.isSafeInteger(sequence) || sequence < 1) return false;
      if (sequence <= lastMusicEventSequence) {
        counters.musicEventsSuppressed += 1;
        return false;
      }
      lastMusicEventSequence = sequence;
    }
    const payload = event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
      ? event.payload : {};
    if (typeof payload.encounterId === 'string') activeBossProfile = bossScoreProfile(payload.encounterId);
    if (typeof event.actorId === 'string' && event.actorId) activeBossActorId = event.actorId;
    counters.musicEventsApplied += 1;

    const nextState = BOSS_MUSIC_EVENT_STATES[kind];
    if (nextState) applyMode(nextState);
    if (BOSS_PHASE_CUES.has(kind)) {
      if (!activeBossProfile) activeBossProfile = bossScoreProfile(payload.encounterId);
      applyBossMix(activeBossProfile);
      playAudibleBossStinger(kind, activeBossProfile, activeBossActorId);
    } else if (kind === 'dragon_breath_warning') {
      beginBreathSilence();
    } else if (kind === 'dragon_breath') {
      restoreBreathSilence();
      playAudibleBossStinger(kind, activeBossProfile || bossScoreProfile('hollow-hart+cinderwing'), 'cinderwing');
    } else if (kind === 'boss_defeat') {
      playAudibleBossStinger(kind, activeBossProfile, activeBossActorId);
    }
    return true;
  }

  function resetMusicEventCursor(sequence = 0) {
    const next = Number(sequence);
    if (!Number.isSafeInteger(next) || next < 0) throw new RangeError('music event cursor is invalid');
    lastMusicEventSequence = next;
    activeBossProfile = null;
    activeBossActorId = null;
    restoreBreathSilence();
    return lastMusicEventSequence;
  }

  function scheduleMusicStep(when, absoluteStep) {
    const transportStep = absoluteStep % STEPS_PER_BAR;
    if (transportStep === 0 && activeMode !== desiredMode) {
      activeMode = desiredMode;
      sectionStartStep = absoluteStep;
      counters.modeChanges += 1;
    }
    const sectionId = sectionForMusicState(activeMode);
    const position = sectionPlaybackPosition(
      BRIARHOLD_CHORDSMITH_PROJECT,
      sectionId,
      absoluteStep,
      sectionStartStep
    );
    const {bar, step} = position;
    lastMusicPosition = Object.freeze({section: sectionId, ...position});
    const grid = sectionBarField(BRIARHOLD_CHORDSMITH_PROJECT, 'grid', sectionId, bar);
    const progression = sectionBarField(BRIARHOLD_CHORDSMITH_PROJECT, 'progression', sectionId, bar) || [0, 3, 5, 4];
    const melodyTracks = sectionBarField(BRIARHOLD_CHORDSMITH_PROJECT, 'melodyTracks', sectionId, bar) || [];
    const intensity = MUSIC_STATES[activeMode]?.intensity ?? 0.4;
    const bossMusic = isBossMusicState(activeMode);
    const profile = bossMusic ? activeBossProfile : null;
    const modeThreat = bossMusic
      ? 1
      : (activeMode === 'combat_low' || activeMode === 'combat_high' ? threat : 0);
    const dynamic = clamp(intensity * 0.72 + modeThreat * 0.28, 0.15, 1);
    const highCombat = activeMode === 'combat_high' || bossMusic;
    const chordDegree = progression[Math.floor(step / 4) % progression.length] || 0;
    const stepDuration = musicStepDuration();

    const drumMix = profile?.stems.drums ?? 1;
    if (grid?.kick?.[step]) scheduleKick(when, (0.052 + dynamic * 0.045) * drumMix);
    if (grid?.snare?.[step]) scheduleSnare(when, (0.032 + dynamic * 0.038) * drumMix);
    if (grid?.hat?.[step] && (dynamic > 0.42 || step % 4 === 0)) {
      scheduleHat(when, (0.009 + dynamic * 0.014) * drumMix);
    }
    if (grid?.bass?.[step]) {
      const bassFrequency = midiToFrequency(degreeToMidi(chordDegree, 38));
      scheduleTone('bass', [bassFrequency, bassFrequency * 2], when, stepDuration * 2.6, {
        gain: (0.048 + dynamic * 0.026) * (profile?.stems.bass ?? 1),
        types: ['sine', 'triangle'],
        filter: 360 + dynamic * 280,
        q: 0.8
      });
    }
    if (step % 4 === 0) {
      const degrees = [chordDegree, chordDegree + 2, chordDegree + 4];
      const chord = degrees.map(degree => midiToFrequency(degreeToMidi(degree, 50)));
      scheduleTone('chord', chord, when, stepDuration * (highCombat ? 2.6 : 3.85), {
        gain: (activeMode === 'menu' ? 0.026 : 0.022 + dynamic * 0.018) * (profile?.stems.chords ?? 1),
        types: ['triangle', 'sine'],
        filter: highCombat ? 1450 : 2100,
        q: 0.5,
        detune: highCombat ? -4 : 0
      });
    }
    if (highCombat && (profile ? profile.pulseSteps.includes(step) : step % 2 === 0)) {
      const pulse = midiToFrequency(degreeToMidi(chordDegree, 38));
      scheduleTone('chug', [pulse, pulse * 1.005], when, stepDuration * 0.7, {
        gain: (0.026 + threat * 0.014) * (profile?.stems.guitar ?? 1),
        type: 'sawtooth',
        filter: 740,
        q: 1.2
      });
    }
    const motifIndex = profile?.motifSteps.indexOf(step) ?? -1;
    const melodyDegree = motifIndex >= 0 ? profile.motifDegrees[motifIndex] : melodyTracks[0]?.[step];
    if (Number.isFinite(melodyDegree) && (dynamic > 0.3 || step % 4 === 0)) {
      const actorRegister = activeBossActorId === 'cinderwing' ? 7 : activeBossActorId === 'hollow-hart' ? -5 : 0;
      const melodyFrequency = midiToFrequency(degreeToMidi(melodyDegree, 62 + (profile?.registerOffset ?? 0) + actorRegister));
      scheduleTone('lead', melodyFrequency, when, stepDuration * 1.65, {
        gain: (highCombat ? 0.032 : 0.024) * (profile?.stems.melody ?? 1),
        type: profile?.leadType || (activeMode === 'combat_low' || highCombat ? 'sawtooth' : 'triangle'),
        filter: highCombat ? 1800 : 2800,
        q: 1.1,
        pan: Math.sin(absoluteStep * 0.41) * 0.28
      });
    }
    if (step === 0) {
      const airRoot = midiToFrequency(degreeToMidi(chordDegree, 26));
      scheduleTone('air', [airRoot, airRoot * 1.5], when, stepDuration * 14.5, {
        gain: profile?.airGain ?? (highCombat ? 0.012 : 0.018),
        types: ['sine', 'triangle'],
        filter: 420,
        q: 0.35,
        pan: profile?.airPan ?? (activeMode === 'dawn' ? 0.18 : -0.12)
      });
    }
    counters.scheduledSteps += 1;
  }

  function schedulerTick() {
    if (!context || context.state !== 'running') return;
    const now = context.currentTime;
    if (nextStepAt < now - 0.18) {
      const duration = musicStepDuration();
      const skipped = Math.floor((now - nextStepAt) / duration) + 1;
      stepIndex += skipped;
      nextStepAt += skipped * duration;
      counters.missedSteps += skipped;
    }
    while (nextStepAt < now + LOOKAHEAD_SECONDS) {
      scheduleMusicStep(nextStepAt, stepIndex);
      stepIndex += 1;
      nextStepAt += musicStepDuration();
    }
  }

  function startScheduler() {
    if (!context || schedulerTimer) return;
    nextStepAt = context.currentTime + 0.06;
    schedulerTimer = windowRef.setInterval(schedulerTick, SCHEDULER_INTERVAL_MS);
    Promise.resolve(coreReady).then(() => core?.play?.()).catch(() => {});
  }

  function sfxTone(frequencies, duration, options = {}) {
    const audio = ensure();
    if (!audio) return false;
    counters.sfxPlayed += 1;
    return scheduleTone('sfx', frequencies, audio.currentTime + 0.004, duration, {
      ...options,
      bus: sfxBus
    });
  }

  function sfxNoise(duration, options = {}) {
    const audio = ensure();
    if (!audio) return false;
    counters.sfxPlayed += 1;
    return scheduleNoise('sfx', audio.currentTime + 0.004, duration, {
      ...options,
      bus: sfxBus
    });
  }

  function playSample(id, options = {}) {
    const audio = ensure();
    const buffer = sampleBuffers.get(id);
    if (!audio || !buffer || !sfxBus || typeof audio.createBufferSource !== 'function') return false;
    const rate = Math.max(0.5, Math.min(2, Number(options.rate) || 1));
    const when = audio.currentTime + Math.max(0.002, Number(options.delay) || 0.004);
    const duration = Math.min(
      buffer.duration / rate,
      Math.max(0.03, Number(options.maxDuration) || Number.POSITIVE_INFINITY),
    );
    const envelope = connectVoice('sfx', when, duration, options.gain ?? 0.12, sfxBus, options.pan || 0);
    if (!envelope) return false;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.connect(envelope);
    source.start(when);
    if (Number.isFinite(options.maxDuration) && typeof source.stop === 'function') source.stop(when + duration);
    counters.sfxPlayed += 1;
    return true;
  }

  function startSunfireSustain(options = {}) {
    const audio = ensure();
    if (!audio || !sfxBus || sunfireSustain) return false;
    const release = claimVoice('sfx', Number.POSITIVE_INFINITY);
    if (!release) return false;
    const when = audio.currentTime + 0.004;
    const envelope = audio.createGain();
    const filter = audio.createBiquadFilter();
    const source = audio.createBufferSource();
    const sample = sampleBuffers.get('sunfire-sustain');
    source.buffer = sample || noiseBuffer;
    source.loop = true;
    source.playbackRate.value = sample ? 0.88 : 0.72;
    filter.type = 'bandpass';
    filter.frequency.value = 1550;
    filter.Q.value = 0.52;
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(0.075, when + 0.028);
    source.connect(filter);
    filter.connect(envelope);
    if (typeof audio.createStereoPanner === 'function') {
      const panner = audio.createStereoPanner();
      panner.pan.value = clamp(options.pan, -1, 1);
      envelope.connect(panner);
      panner.connect(sfxBus);
    } else {
      envelope.connect(sfxBus);
    }
    source.start(when);
    sunfireSustain = {source, envelope, filter, release, startedAt: when};
    counters.sfxPlayed += 1;
    counters.sunfireStarts += 1;
    return true;
  }

  function shapeSunfireHit(options = {}) {
    if (!sunfireSustain || !context) return false;
    const hits = Math.max(0, Number(options.hits) || 0);
    const intensity = clamp(Math.log1p(hits) / Math.log(25));
    const gain = 0.072 + intensity * 0.045;
    sunfireSustain.envelope.gain.setTargetAtTime(gain, context.currentTime, 0.018);
    sunfireSustain.filter.frequency.setTargetAtTime(1500 + intensity * 850, context.currentTime, 0.026);
    return true;
  }

  function stopSunfireSustain() {
    if (!sunfireSustain) return false;
    const sustain = sunfireSustain;
    sunfireSustain = null;
    const now = context?.currentTime || 0;
    try {
      sustain.envelope.gain.setTargetAtTime(0.0001, now, 0.014);
      sustain.source.stop(now + 0.04);
    } catch {}
    sustain.release();
    counters.sunfireStops += 1;
    return true;
  }

  function hitIntensity(options = {}) {
    return clamp(Math.log1p(Math.max(0, Number(options.hits) || 0)) / Math.log(25));
  }

  function playUiCue() {
    if (!playSample('ui-click', { gain: 0.09 })) {
      sfxTone(680, 0.035, { gain: 0.018, type: 'triangle', endFrequency: 540, filter: 1900 });
    }
  }

  // Hub services deliberately use the existing compact FilmCow palette first.
  // No service opens an unbounded ambience or schedules a delayed burst: the
  // shared SFX voice budget remains the final backstop when several services
  // are used in quick succession.
  function playHubServiceCue(serviceId) {
    if (!HUB_SERVICE_IDS.includes(serviceId)) return false;
    counters.hubServiceCues[serviceId] += 1;

    if (serviceId === 'bellkeeper') {
      const bell = playSample('gate-wood-break', {gain: 0.09, rate: 1.34, maxDuration: 0.2});
      if (!bell) {
        sfxTone([146, 219], 0.38, {gain: 0.043, type: 'triangle', filter: 1800});
        sfxNoise(0.07, {gain: 0.012, filterType: 'highpass', filter: 2150, q: 0.5});
      }
      core?.triggerStinger?.('wave_start');
      return true;
    }

    if (serviceId === 'mason') {
      const hammer = playSample('arbalest-armour', {gain: 0.065, rate: 0.82, maxDuration: 0.18});
      if (!hammer) {
        sfxTone([138, 207], 0.14, {gain: 0.029, type: 'triangle', filter: 1450});
        sfxNoise(0.06, {gain: 0.016, filter: 820, q: 0.75});
      }
      return true;
    }

    if (serviceId === 'quartermaster') {
      const ready = playSample('ui-click', {gain: 0.055, rate: 0.82, maxDuration: 0.13});
      if (!ready) sfxNoise(0.035, {gain: 0.011, filterType: 'highpass', filter: 3100, q: 0.35});
      sfxTone([330, 495], 0.16, {gain: 0.018, type: 'sine', filter: 2500});
      return true;
    }

    if (serviceId === 'trapper') {
      const reset = playSample('arbalest-mechanism', {gain: 0.058, rate: 1.18, maxDuration: 0.16});
      if (!reset) {
        sfxNoise(0.05, {gain: 0.016, filter: 1200, q: 1.2});
        sfxTone(180, 0.07, {gain: 0.018, type: 'square', endFrequency: 120, filter: 1100});
      }
      return true;
    }

    const wake = playSample('sunfire-sustain', {gain: 0.035, rate: 1.55, maxDuration: 0.16});
    if (!wake) sfxNoise(0.18, {gain: 0.016, filterType: 'highpass', filter: 2050, q: 0.3});
    sfxTone([220, 329.63, 440], 0.42, {gain: 0.019, type: 'triangle', filter: 2200});
    core?.triggerStinger?.('boon');
    return true;
  }

  function playNarrativeCue(cueId) {
    const cue = resolveNarrativeAudioCue(cueId);
    if (cue.id === 'none') return false;
    if (cue.id === 'arrival-step') return playSample('footstep-dirt-a', {gain: 0.055, rate: 0.92, maxDuration: 0.16})
      || Boolean(sfxNoise(0.055, {gain: 0.016, filter: 460, q: 0.65}));
    if (cue.id === 'dawn-air') return Boolean(sfxNoise(0.34, {gain: 0.012, filterType: 'highpass', filter: 1750, q: 0.24}));
    if (cue.id === 'bell-toll') {
      sfxTone([146, 219, 438], 0.72, {gain: 0.038, type: 'triangle', filter: 2100});
      return true;
    }
    if (cue.id.startsWith('voice-')) {
      const voiceIndex = NARRATIVE_AUDIO_CUE_IDS.indexOf(cue.id);
      sfxTone(210 + voiceIndex * 18, 0.09, {gain: 0.012, type: 'triangle', endFrequency: 170, filter: 1450});
      return true;
    }
    const stinger = {
      'failure-low': [110, 82],
      'wave-warning': [196, 293],
      'night-clear': [293.66, 349.23, 440],
      'debt-break': [220, 329.63, 493.88],
    }[cue.id] ?? [180, 270];
    sfxTone(stinger, cue.id === 'debt-break' ? 0.92 : 0.42, {gain: 0.025, type: 'triangle', filter: 1800});
    return true;
  }

  function handleUiClick(event) {
    if (event.target?.closest?.(UI_SAMPLE_SELECTOR)) playUiCue();
  }

  windowRef?.document?.addEventListener?.('click', handleUiClick);

  return {
    unlock() {
      const audio = ensure();
      if (!audio) return Promise.resolve(false);
      return Promise.resolve(audio.resume?.()).then(() => true).catch(() => false);
    },
    setVolume(next) {
      volume = clamp(next);
      if (master && context) {
        master.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.035);
      }
    },
    setMuted(next) {
      muted = Boolean(next);
      if (master && context) {
        master.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.025);
      }
    },
    setWorldPresentationProfile(profileId) {
      const profile = audioWorldPresentationProfile(profileId);
      worldPresentationKey = profile.key;
      if (context && musicFilter && !paused) {
        musicFilter.frequency.setTargetAtTime(profile.musicFilterHz, context.currentTime, 0.12);
      }
      return profile;
    },
    narrativeCue(cueId) {
      return playNarrativeCue(cueId);
    },
    setMode(next, options = {}) {
      const wasAdaptiveCombat = adaptiveCombat;
      baseMode = normalizeMusicState(next);
      adaptiveCombat = next === 'combat' || baseMode === 'combat_low';
      if (adaptiveCombat && !wasAdaptiveCombat) previousThreatMode = 'combat_low';
      const target = adaptiveCombat
        ? effectiveMusicState(baseMode, threat, previousThreatMode)
        : baseMode;
      if (adaptiveCombat) previousThreatMode = target;
      if (!['combat_low', 'combat_high', 'boss_intro', 'boss_phase_1', 'boss_phase_2',
        'boss_enraged', 'boss_final', 'wave_start'].includes(target)) stopSunfireSustain();
      applyMode(target, options.immediate === true);
    },
    applyMusicEvent,
    resetMusicEventCursor,
    setThreat(next) {
      threat = clamp(next);
      if (!adaptiveCombat) return;
      const priorMode = previousThreatMode;
      previousThreatMode = adaptiveCombatMusicState(threat, previousThreatMode);
      if (previousThreatMode !== priorMode) applyMode(previousThreatMode);
    },
    setPaused(next) {
      paused = Boolean(next);
      if (paused) stopSunfireSustain();
      if (!context || !musicFilter || !musicBus) return;
      musicFilter.frequency.setTargetAtTime(paused ? 720 : 6800, context.currentTime, 0.08);
      const target = paused ? 0.075 : 0.24 * (ducked ? 1 - duckAmount : 1);
      musicBus.gain.setTargetAtTime(target, context.currentTime, 0.08);
      if (core) core.lowpass(paused ? 0.22 : 1);
    },
    setDucked(next, options = {}) {
      ducked = Boolean(next);
      duckAmount = clamp(options.amount ?? duckAmount);
      const releaseMs = Math.max(0, Number(options.releaseMs) || 0);
      if (context && musicBus) {
        const target = paused ? 0.075 : 0.24 * (ducked ? 1 - duckAmount : 1);
        musicBus.gain.setTargetAtTime(target, context.currentTime, Math.max(0.025, releaseMs / 3000));
      }
      Promise.resolve(coreReady).then(() => {
        core?.duck?.(ducked, { amount: duckAmount, releaseMs });
      }).catch(() => {});
    },
    shot(weaponId, options = {}) {
      const pan = options.station === 'east' ? 0.28 : options.station === 'west' ? -0.28 : 0;
      if (weaponId === 'sunfire') {
        startSunfireSustain({pan});
      } else if (weaponId === 'runebolt') {
        sfxTone([82, 123], 0.3, { gain: 0.085, type: 'square', endFrequency: 36, filter: 620, pan });
        sfxNoise(0.22, { gain: 0.068, filter: 510, q: 0.8, pan });
      } else {
        const shotNumber = Math.max(1, Math.floor(Number(options.shot) || 1));
        const released = playSample('arbalest-release', {
          gain: 0.14, rate: 0.98, pan, maxDuration: 0.19,
        });
        if (shotNumber % 4 === 1) playSample('arbalest-mechanism', {
          gain: 0.075, rate: 1.06, pan, maxDuration: 0.22,
        });
        if (!released) {
          sfxTone(285, 0.075, { gain: 0.065, type: 'triangle', endFrequency: 96, filter: 1900, pan });
          sfxNoise(0.038, { gain: 0.025, filter: 2800, q: 0.5, pan });
        }
      }
    },
    hit(kind = 'hit', options = {}) {
      const resolved = kind === true ? 'kill' : kind === false ? 'hit' : kind;
      const weaponId = options.weaponId || null;
      const intensity = hitIntensity(options);
      counters.aggregatedHitEvents += 1;
      counters.aggregatedHits += Math.max(0, Math.floor(Number(options.hits) || 0));
      if (weaponId === 'arbalest') {
        const now = ensure()?.currentTime || 0;
        if (resolved !== 'kill' && now - lastArbalestImpactAt + 1e-9 < ARBALEST_IMPACT_INTERVAL_SECONDS) {
          counters.suppressedArbalestImpacts += 1;
          return false;
        }
        lastArbalestImpactAt = now;
      }
      if (weaponId === 'sunfire') {
        shapeSunfireHit(options);
        return;
      }
      if (weaponId === 'runebolt') {
        const played = playSample('runebolt-impact', {
          gain: 0.12 + intensity * 0.09,
          rate: 0.88 + intensity * 0.08,
          maxDuration: 0.34,
        });
        if (!played) sfxTone([76, 112], 0.26, {
          gain: 0.064 + intensity * 0.032,
          type: 'sawtooth',
          endFrequency: 38,
          filter: 520,
        });
        return;
      }
      if (resolved === 'armour') {
        const played = weaponId === 'arbalest' && playSample('arbalest-armour', {
          gain: 0.07 + intensity * 0.045,
          rate: 0.96 + intensity * 0.08,
          maxDuration: 0.2,
        });
        if (played) return true;
        sfxNoise(0.045, { gain: 0.026, filterType: 'highpass', filter: 2450, q: 0.7 });
        sfxTone([880, 620], 0.07, { gain: 0.022, type: 'triangle', endFrequency: 410, filter: 2600 });
        return true;
      }
      const killed = resolved === 'kill';
      const played = playSample('bolt-impact-wood', {
        gain: (killed ? 0.1 : 0.06) + intensity * 0.05,
        rate: (killed ? 0.91 : 1.04) + intensity * 0.04,
        maxDuration: killed ? 0.18 : 0.11,
      });
      if (!played) sfxNoise(killed ? 0.09 : 0.055, {
        gain: killed ? 0.036 : 0.024,
        filter: killed ? 580 : 920,
        q: 0.7,
      });
      if (killed) {
        const killLift = Math.min(90, Math.max(0, Number(options.kills) - 1) * 12);
        sfxTone(510 + killLift, 0.055, { gain: 0.025, type: 'sine', endFrequency: 310, filter: 2100 });
      }
      return true;
    },
    playerHurt(options = {}) {
      const hunter = Boolean(options.hunter);
      const pan = clamp(options.pan, -0.7, 0.7);
      sfxNoise(hunter ? 0.16 : 0.11, { gain: hunter ? 0.064 : 0.045, filter: hunter ? 1250 : 720, q: 0.8, pan });
      sfxTone(hunter ? [116, 82] : 92, hunter ? 0.18 : 0.13, {
        gain: hunter ? 0.045 : 0.032,
        type: 'sawtooth',
        endFrequency: hunter ? 54 : 62,
        filter: 650,
        pan,
      });
    },
    melee(options = {}) {
      sfxNoise(0.105, {
        gain: 0.033,
        filterType: 'highpass',
        filter: 2650,
        q: 0.55,
        pan: 0.18,
      });
      sfxTone([760, 390], 0.075, {
        gain: 0.021,
        type: 'triangle',
        endFrequency: 220,
        filter: 2100,
        pan: 0.18,
      });
      return true;
    },
    gatePressure() {
      const audio = ensure();
      if (!audio || audio.currentTime - lastGatePressureAt < 0.5) return false;
      lastGatePressureAt = audio.currentTime;
      return sfxNoise(0.18, {gain: 0.027, filter: 260, q: 1.1});
    },
    enemyAttackTelemetry(telemetry = {}) {
      const audio = ensure();
      if (!audio) return false;
      let played = false;
      const player = telemetry.player || {};
      if ((Number(player.count) || 0) > 0) {
        if (audio.currentTime - lastEnemyPlayerAttackAt >= ENEMY_PLAYER_ATTACK_INTERVAL_SECONDS) {
          lastEnemyPlayerAttackAt = audio.currentTime;
          const pan = clamp((Number(player.panWeightedSum) || 0) / Math.max(0.01, Number(player.weight) || 0.01), -0.72, 0.72);
          const hunter = (Number(player.hunterCount) || 0) > 0;
          sfxNoise(hunter ? 0.13 : 0.09, {gain: hunter ? 0.044 : 0.031, filter: hunter ? 1450 : 1020, q: 0.75, pan});
          sfxTone(hunter ? [185, 122] : [152, 108], hunter ? 0.14 : 0.1, {
            gain: hunter ? 0.032 : 0.022, type: 'sawtooth', endFrequency: hunter ? 72 : 66, filter: 980, pan,
          });
          counters.enemyPlayerAttackCues++;
          played = true;
        } else {
          counters.suppressedEnemyAttackCues++;
        }
      }
      const outer = telemetry.outerGate || {};
      const heart = telemetry.heartGate || {};
      const west = Math.max(0, Number(outer.westCount) || 0);
      const east = Math.max(0, Number(outer.eastCount) || 0);
      const heartCount = Math.max(0, Number(heart.count) || 0);
      const gateCount = west + east + heartCount;
      if (gateCount > 0) {
        if (audio.currentTime - lastEnemyGateAttackAt >= ENEMY_GATE_ATTACK_INTERVAL_SECONDS) {
          lastEnemyGateAttackAt = audio.currentTime;
          const pan = heartCount >= west + east ? 0 : clamp((east - west) / gateCount * 0.48, -0.48, 0.48);
          const intensity = Math.min(1, Math.log2(1 + gateCount) / 4);
          const sampled = playSample('bolt-impact-wood', {
            gain: 0.055 + intensity * 0.055, rate: 0.74 + intensity * 0.12, pan, maxDuration: 0.16,
          });
          if (!sampled) sfxNoise(0.16, {gain: 0.032 + intensity * 0.032, filter: 310, q: 0.9, pan});
          sfxTone(58 + intensity * 22, 0.17, {gain: 0.022 + intensity * 0.02, type: 'triangle', endFrequency: 38, filter: 390, pan});
          counters.enemyGateAttackCues++;
          played = true;
        } else {
          counters.suppressedEnemyAttackCues++;
        }
      }
      return played;
    },
    footstep(surface = 'dirt', options = {}) {
      const id = footstepIndex++ % 2 === 0 ? 'footstep-dirt-a' : 'footstep-dirt-b';
      const sprint = Boolean(options.sprint);
      const played = surface === 'dirt' && playSample(id, {
        gain: sprint ? 0.105 : 0.075,
        rate: sprint ? 1.08 : 0.96,
        pan: footstepIndex % 2 === 0 ? -0.08 : 0.08
      });
      if (!played) {
        const stone = surface === 'stone';
        sfxNoise(0.055, { gain: sprint ? 0.026 : 0.018, filter: stone ? 980 : 430, q: 0.65 });
        sfxTone(stone ? 118 : 76, 0.06, { gain: 0.012, type: 'triangle', endFrequency: 54, filter: 520 });
      }
    },
    ui() {
      playUiCue();
    },
    impact(heavy = false) {
      sfxNoise(heavy ? 0.34 : 0.12, {
        gain: heavy ? 0.095 : 0.04,
        filter: heavy ? 360 : 980,
        q: 0.6
      });
      if (heavy) sfxTone(54, 0.3, { gain: 0.075, type: 'sine', endFrequency: 31, filter: 300 });
    },
    station() {
      sfxNoise(0.11, { gain: 0.026, filter: 460, q: 0.7, pan: -0.35 });
      windowRef.setTimeout(() => sfxNoise(0.11, { gain: 0.022, filter: 520, q: 0.7, pan: 0.35 }), 180);
    },
    gate() {
      playSample('gate-wood-break', { gain: 0.24, rate: 0.88 });
      sfxTone([58, 86], 0.72, { gain: 0.1, type: 'sawtooth', endFrequency: 29, filter: 410 });
      sfxNoise(0.62, { gain: 0.09, filter: 270, q: 0.9 });
      core?.triggerStinger?.('danger');
    },
    cool() {
      sfxNoise(0.48, { gain: 0.05, filterType: 'highpass', filter: 2300, q: 0.25 });
      sfxTone(740, 0.34, { gain: 0.022, type: 'sine', endFrequency: 240, filter: 1800 });
    },
    fortify() {
      sfxTone([196, 294, 392], 0.22, { gain: 0.028, type: 'triangle', filter: 1900 });
      sfxNoise(0.12, { gain: 0.022, filter: 760, q: 0.8 });
    },
    repair() {
      sfxTone([146, 220], 0.18, { gain: 0.032, type: 'triangle', filter: 1500 });
      windowRef.setTimeout(() => sfxTone(293, 0.12, { gain: 0.026, type: 'triangle', filter: 1900 }), 115);
    },
    nightStart(night = 1) {
      const root = 92 + Math.max(0, Number(night) - 1) * 7;
      sfxTone([root, root * 1.5, root * 2], 0.82, { gain: 0.055, type: 'sawtooth', filter: 720 });
    },
    nightEnd() {
      sfxTone([293.66, 349.23, 440], 1.25, { gain: 0.045, type: 'triangle', filter: 2600 });
    },
    gameOver() {
      sfxTone([146.83, 138.59, 110], 1.6, { gain: 0.05, type: 'sawtooth', filter: 720 });
    },
    overheat() {
      stopSunfireSustain();
      sfxTone([620, 465], 0.24, { gain: 0.032, type: 'square', endFrequency: 220, filter: 1250 });
    },
    hubService(serviceId) {
      return playHubServiceCue(serviceId);
    },
    setWeapon(weaponId) {
      selectedWeapon = typeof weaponId === 'string' ? weaponId : selectedWeapon;
      if (selectedWeapon !== 'sunfire') stopSunfireSustain();
    },
    stopSunfire() {
      return stopSunfireSustain();
    },
    diagnostics() {
      pruneVoices();
      const roles = {};
      for (const [role, tokens] of roleTokens) roles[role] = tokens.size;
      return {
        contextState: context?.state || 'locked',
        baseMode,
        activeMode,
        desiredMode,
        threat,
        paused,
        ducked,
        duckAmount,
        adaptiveCombat,
        threatMode: previousThreatMode,
        activeVoices: currentVoiceCount(),
        peakVoices: counters.peakVoices,
        voiceBudget: MUSIC_VOICE_BUDGETS.total,
        roles,
        rolePeaks: { ...counters.rolePeaks },
        scheduledSteps: counters.scheduledSteps,
        missedSteps: counters.missedSteps,
        droppedVoices: counters.droppedVoices,
        modeChanges: counters.modeChanges,
        musicPosition: {...lastMusicPosition},
        sfxPlayed: counters.sfxPlayed,
        aggregatedHitEvents: counters.aggregatedHitEvents,
        aggregatedHits: counters.aggregatedHits,
        suppressedArbalestImpacts: counters.suppressedArbalestImpacts,
        selectedWeapon,
        worldPresentationKey,
        sunfireActive: Boolean(sunfireSustain),
        sunfireStarts: counters.sunfireStarts,
        sunfireStops: counters.sunfireStops,
        bossEncounterId: activeBossProfile?.encounterId ?? null,
        bossActorId: activeBossActorId,
        lastMusicEventSequence,
        musicEventsApplied: counters.musicEventsApplied,
        musicEventsSuppressed: counters.musicEventsSuppressed,
        audibleBossStingers: counters.audibleBossStingers,
        suppressedBossStingers: counters.suppressedBossStingers,
        breathWarnings: counters.breathWarnings,
        breathSilenceActive,
        hubServiceCues: {...counters.hubServiceCues},
        enemyPlayerAttackCues: counters.enemyPlayerAttackCues,
        enemyGateAttackCues: counters.enemyGateAttackCues,
        suppressedEnemyAttackCues: counters.suppressedEnemyAttackCues,
        sampleBuffers: sampleBuffers.size,
        sampleTarget: Object.keys(SAMPLE_FILES).length,
        sampleLoadErrors,
        core: core?.getDiagnostics?.() || null
      };
    },
    dispose() {
      stopSunfireSustain();
      restoreBreathSilence();
      if (schedulerTimer) windowRef.clearInterval(schedulerTimer);
      schedulerTimer = null;
      core?.dispose?.();
      core = null;
      coreReady = null;
      sampleLoadPromise = null;
      sampleBuffers.clear();
      windowRef?.document?.removeEventListener?.('click', handleUiClick);
      context?.close?.();
      context = master = compressor = musicFilter = musicBus = sfxBus = noiseBuffer = null;
      for (const tokens of roleTokens.values()) tokens.clear();
    }
  };
}

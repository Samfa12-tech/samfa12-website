// src/constants.js
var POCKET_AUDIO_CORE_VERSION = "0.2.0";
var CORE_PROJECT_VERSION = 1;
var PCS_SHARE_PREFIX = "PCS1:";
var DEFAULT_SOURCE_SCHEMA_VERSION = 16;
var RICH_EVENT_SCHEMA_VERSION = 17;
var DEFAULT_PPQ = 480;
var DEFAULT_BPM = 96;
var DEFAULT_TIME_SIG = 4;
var DEFAULT_RESOLUTION = 4;
var MAX_SEQUENCE_SLOTS = 64;
var POCKET_AUDIO_RESOURCE_LIMITS = Object.freeze({
  maxRichTracksPerSection: 32,
  maxRichEventsPerTrack: 4096,
  maxRichEventsPerProject: 16384,
  maxNotesPerEvent: 16,
  maxEventsPerSchedulerTick: 256
});
var SECTION_IDS = Object.freeze(["A", "B", "C", "D", "E", "F", "G", "H"]);
var STEM_IDS = Object.freeze(["drums", "bass", "chords", "melody", "guitar"]);
var DRUM_LANES = Object.freeze(["kick", "snare", "hat", "bass"]);
var NOTES = Object.freeze(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]);
var DEFAULT_MASTER_VOLUME = 0.82;
var DEFAULT_STEM_MIX = Object.freeze({
  drums: { volume: 0.86, pan: 0, mute: false },
  bass: { volume: 0.86, pan: 0, mute: false },
  chords: { volume: 0.72, pan: 0, mute: false },
  melody: { volume: 0.65, pan: 0, mute: false },
  guitar: { volume: 0.66, pan: 0, mute: false }
});
var DEFAULT_FX = Object.freeze({
  filter: 1,
  delay: 0.12,
  echo: 0.12,
  chorus: 0.18,
  flanger: 0.06,
  reverb: 0.18,
  mix: 0.65,
  sidechain: { enabled: false, amount: 0.45 }
});

// src/profiles/profile-registry.js
var POCKET_AUDIO_PROFILE_IDS = Object.freeze([
  "standard",
  "lofi_chill",
  "chip_arcade",
  "western_frontier",
  "heavy_metal",
  "funk_groove"
]);
var POCKET_AUDIO_PROFILE_ALIASES = Object.freeze({
  chordsmith: "standard",
  base: "standard",
  default: "standard",
  lofi: "lofi_chill",
  "lofi-chill": "lofi_chill",
  chip: "chip_arcade",
  chiptune: "chip_arcade",
  chip_tune: "chip_arcade",
  western: "western_frontier",
  frontier: "western_frontier",
  metal: "heavy_metal",
  funk: "funk_groove"
});
var PROFILE_FEATURES = Object.freeze([
  "sound-profile-v1",
  "rich-events-v1",
  "articulations-v1",
  "expanded-drums-v1",
  "capability-report-v1"
]);
var POCKET_AUDIO_PROFILES = Object.freeze({
  standard: profile("standard", "Chordsmith", "standard_chordsmith", {
    neutralTone: 0.5,
    transientClarity: 0.5
  }),
  lofi_chill: profile("lofi_chill", "Lofi", "lofi_study_room", {
    vinylCrackle: 0.12,
    tapeHiss: 0.08,
    wowFlutter: 0.08,
    warmth: 0.24,
    lowPassAge: 0.18,
    bitCrush: 0
  }),
  chip_arcade: profile("chip_arcade", "Chiptune", "chip_nes_pulse", {
    pulseWidth: 0.5,
    bitDepth: 0.2,
    sampleRateCrush: 0.16,
    pitchDrift: 0.015,
    saturation: 0.14,
    stereoSpread: 0.1
  }),
  western_frontier: profile("western_frontier", "Western", "western_trail", {
    twang: 0.62,
    pickAttack: 0.56,
    body: 0.48,
    roomSize: 0.2,
    swing: 0.12
  }),
  heavy_metal: profile("heavy_metal", "Metal", "metal_tight_riff", {
    drive: 0.48,
    palmMute: 0.78,
    lowTightness: 0.86,
    presence: 0.58,
    roomSize: 0.12,
    pickAttack: 0.72
  }),
  funk_groove: profile("funk_groove", "Funk", "funk_classic_pocket", {
    pocket: 0.72,
    ghostNotes: 0.42,
    slapAmount: 0.68,
    popBrightness: 0.62,
    muteDepth: 0.74,
    stabTightness: 0.76
  })
});
var POCKET_AUDIO_FORMAT_FEATURES = PROFILE_FEATURES;
function normalisePocketAudioProfileId(value, fallback = "standard") {
  const requested = String(value || "").trim().toLowerCase();
  if (POCKET_AUDIO_PROFILE_IDS.includes(requested)) return requested;
  if (POCKET_AUDIO_PROFILE_ALIASES[requested]) return POCKET_AUDIO_PROFILE_ALIASES[requested];
  return POCKET_AUDIO_PROFILE_IDS.includes(fallback) ? fallback : "standard";
}
function findPocketAudioProfile(value) {
  return POCKET_AUDIO_PROFILES[normalisePocketAudioProfileId(value)];
}
function normalisePocketAudioSoundProfile(value = {}, legacy = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const requestedId = source.id ?? source.profile ?? legacy.audioProfile;
  const id = normalisePocketAudioProfileId(requestedId || profileIdFromPreset(source.preset ?? legacy.stylePreset));
  const manifest = POCKET_AUDIO_PROFILES[id];
  const preset = String(source.preset ?? legacy.stylePreset ?? legacy.preset ?? "").trim() || manifest.defaultPreset;
  const recipeVersion = positiveInt(source.recipeVersion, manifest.recipeVersion);
  const sourceParameters = source.parameters && typeof source.parameters === "object" && !Array.isArray(source.parameters) ? source.parameters : {};
  return {
    ...cloneJson(source),
    id,
    preset,
    recipeVersion,
    parameters: {
      ...cloneJson(manifest.defaultParameters),
      ...cloneJson(sourceParameters)
    }
  };
}
function validatePocketAudioProfileRegistry() {
  const manifestIds = Object.keys(POCKET_AUDIO_PROFILES);
  return {
    missingProfiles: POCKET_AUDIO_PROFILE_IDS.filter((id) => !POCKET_AUDIO_PROFILES[id]),
    unexpectedProfiles: manifestIds.filter((id) => !POCKET_AUDIO_PROFILE_IDS.includes(id)),
    invalidRecipeVersions: manifestIds.filter((id) => !Number.isInteger(POCKET_AUDIO_PROFILES[id].recipeVersion) || POCKET_AUDIO_PROFILES[id].recipeVersion < 1)
  };
}
function profile(id, label, defaultPreset, defaultParameters) {
  return Object.freeze({
    id,
    label,
    defaultPreset,
    recipeVersion: 1,
    formatFeatures: PROFILE_FEATURES,
    defaultParameters: Object.freeze({ ...defaultParameters })
  });
}
function profileIdFromPreset(value) {
  const preset = String(value || "").toLowerCase();
  if (preset.startsWith("lofi_")) return "lofi_chill";
  if (preset.startsWith("chip_")) return "chip_arcade";
  if (preset.startsWith("western_")) return "western_frontier";
  if (preset.startsWith("metal_")) return "heavy_metal";
  if (preset.startsWith("funk_")) return "funk_groove";
  return "standard";
}
function positiveInt(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number >= 1 ? number : fallback;
}
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

// src/presets/preset-utils.js
function safeChoice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}
function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

// src/presets/lofi.js
var LOFI_AUDIO_PROFILE_ID = "lofi_chill";
var DEFAULT_LOFI_PRESET_ID = "lofi_study_room";
var LOFI_CHORD_INSTRUMENTS = Object.freeze([
  "dusty_rhodes",
  "felt_piano",
  "cassette_keys",
  "muted_jazz_guitar",
  "lofi_warm_pad"
]);
var LOFI_MELODY_INSTRUMENTS = Object.freeze([
  "mellow_vibes",
  "soft_pluck",
  "mellow_sax",
  "muted_trumpet",
  "tape_bell"
]);
var LOFI_BASS_TONES = Object.freeze([
  "warm_sub",
  "soft_upright",
  "rounded_triangle_bass"
]);
var LOFI_DRUM_KITS = Object.freeze([
  "lofi_dusty",
  "lofi_brush",
  "lofi_tape_soft"
]);
var LOFI_DRUM_GROOVE_PRESETS = Object.freeze([
  "lofi_backbeat_76",
  "lofi_lazy_boom_bap",
  "lofi_half_time_soft",
  "lofi_brush_shuffle",
  "lofi_sparse_clicks",
  "lofi_sleepy_waltz_3_4"
]);
var DEFAULT_LOFI_TEXTURE = Object.freeze({
  enabled: false,
  vinylCrackle: 0.08,
  tapeHiss: 0.05,
  wowFlutter: 0.03,
  warmth: 0.16,
  lowPassAge: 0.22,
  bitCrush: 0.01
});
var LOFI_STYLE_PRESETS = Object.freeze({
  lofi_study_room: Object.freeze({
    id: "lofi_study_room",
    label: "Study Room Loop",
    description: "Warm, steady study/game bed with dusty Rhodes, soft hats and a small vinyl edge.",
    bpm: Object.freeze({ min: 72, max: 80, default: 76 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["A minor", "C major", "D minor"]),
    scalePreference: "minor",
    swing: 0.12,
    humanize: 0.11,
    chordType: "seventh",
    chordStyle: "maj7/min7 loop",
    chordInstrument: "dusty_rhodes",
    melodyInstrument: "mellow_vibes",
    bassTone: "warm_sub",
    drumKit: "lofi_dusty",
    drumGroovePreset: "lofi_backbeat_76",
    fx: Object.freeze({ delay: 0.12, chorus: 0.22, flanger: 0.02, reverb: 0.18, mix: 0.58, sidechain: 0.24 }),
    texture: Object.freeze({ enabled: true, vinylCrackle: 0.09, tapeHiss: 0.04, wowFlutter: 0.03, warmth: 0.18, lowPassAge: 0.24, bitCrush: 0.01 }),
    intensityHints: Object.freeze({ menu: "A", explore: "B", night: "C", rain: "C", full: "D" })
  }),
  lofi_rainy_window: Object.freeze({
    id: "lofi_rainy_window",
    label: "Rainy Window Loop",
    description: "Felt piano and brushed snare feel with a soft rain-like noise bed.",
    bpm: Object.freeze({ min: 68, max: 76, default: 72 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["D minor", "F major", "A minor"]),
    scalePreference: "minor",
    swing: 0.1,
    humanize: 0.13,
    chordType: "seventh",
    chordStyle: "minor seventh/add9 colour",
    chordInstrument: "felt_piano",
    melodyInstrument: "tape_bell",
    bassTone: "soft_upright",
    drumKit: "lofi_brush",
    drumGroovePreset: "lofi_brush_shuffle",
    fx: Object.freeze({ delay: 0.18, chorus: 0.12, flanger: 0.02, reverb: 0.28, mix: 0.62, sidechain: 0.18 }),
    texture: Object.freeze({ enabled: true, vinylCrackle: 0.04, tapeHiss: 0.1, wowFlutter: 0.025, warmth: 0.14, lowPassAge: 0.2, bitCrush: 0 }),
    intensityHints: Object.freeze({ menu: "A", explore: "B", night: "C", rain: "C", full: "D" })
  }),
  lofi_moon_garden: Object.freeze({
    id: "lofi_moon_garden",
    label: "Moon Garden Loop",
    description: "Dreamy Rhodes and pad bed for night garden or calm menu scenes.",
    bpm: Object.freeze({ min: 74, max: 84, default: 80 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["E minor", "G major", "B minor"]),
    scalePreference: "minor",
    swing: 0.14,
    humanize: 0.1,
    chordType: "seventh",
    chordStyle: "sustained nostalgic sevenths",
    chordInstrument: "lofi_warm_pad",
    melodyInstrument: "mellow_vibes",
    bassTone: "warm_sub",
    drumKit: "lofi_tape_soft",
    drumGroovePreset: "lofi_half_time_soft",
    fx: Object.freeze({ delay: 0.14, chorus: 0.26, flanger: 0.03, reverb: 0.24, mix: 0.62, sidechain: 0.2 }),
    texture: Object.freeze({ enabled: true, vinylCrackle: 0.06, tapeHiss: 0.05, wowFlutter: 0.045, warmth: 0.22, lowPassAge: 0.18, bitCrush: 0.01 }),
    intensityHints: Object.freeze({ menu: "A", explore: "B", night: "C", full: "D" })
  }),
  lofi_koi_pond: Object.freeze({
    id: "lofi_koi_pond",
    label: "Koi Pond Loop",
    description: "Sparse percussion, warm pad/Rhodes and soft bell melody for gentle garden play.",
    bpm: Object.freeze({ min: 68, max: 74, default: 70 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["F major", "D minor", "C major"]),
    scalePreference: "major",
    swing: 0.11,
    humanize: 0.12,
    chordType: "seventh",
    chordStyle: "maj7/add9 calm loop",
    chordInstrument: "lofi_warm_pad",
    melodyInstrument: "tape_bell",
    bassTone: "rounded_triangle_bass",
    drumKit: "lofi_tape_soft",
    drumGroovePreset: "lofi_sparse_clicks",
    fx: Object.freeze({ delay: 0.16, chorus: 0.2, flanger: 0.02, reverb: 0.26, mix: 0.58, sidechain: 0.14 }),
    texture: Object.freeze({ enabled: true, vinylCrackle: 0.035, tapeHiss: 0.045, wowFlutter: 0.02, warmth: 0.18, lowPassAge: 0.16, bitCrush: 0 }),
    intensityHints: Object.freeze({ menu: "A", explore: "B", night: "C", full: "D" })
  }),
  lofi_train_window: Object.freeze({
    id: "lofi_train_window",
    label: "Train Window Loop",
    description: "Lazy boom-bap groove with muted guitar/Rhodes and gentle tape wobble.",
    bpm: Object.freeze({ min: 78, max: 86, default: 82 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["C minor", "G minor", "Eb major"]),
    scalePreference: "minor",
    swing: 0.15,
    humanize: 0.12,
    chordType: "seventh",
    chordStyle: "dominant/minor ninth colour",
    chordInstrument: "muted_jazz_guitar",
    melodyInstrument: "soft_pluck",
    bassTone: "warm_sub",
    drumKit: "lofi_dusty",
    drumGroovePreset: "lofi_lazy_boom_bap",
    fx: Object.freeze({ delay: 0.1, chorus: 0.18, flanger: 0.04, reverb: 0.16, mix: 0.52, sidechain: 0.28 }),
    texture: Object.freeze({ enabled: true, vinylCrackle: 0.08, tapeHiss: 0.06, wowFlutter: 0.055, warmth: 0.2, lowPassAge: 0.28, bitCrush: 0.018 }),
    intensityHints: Object.freeze({ menu: "A", explore: "B", travel: "D", night: "C", full: "D" })
  }),
  lofi_ant_farm_night: Object.freeze({
    id: "lofi_ant_farm_night",
    label: "Ant Farm Night",
    description: "Tiny, curious night-loop texture with clicky hats and a mellow sub pulse.",
    bpm: Object.freeze({ min: 76, max: 84, default: 80 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["B minor", "D major", "E minor"]),
    scalePreference: "minor",
    swing: 0.13,
    humanize: 0.14,
    chordType: "seventh",
    chordStyle: "compact min7/sus loop",
    chordInstrument: "cassette_keys",
    melodyInstrument: "soft_pluck",
    bassTone: "rounded_triangle_bass",
    drumKit: "lofi_tape_soft",
    drumGroovePreset: "lofi_sparse_clicks",
    fx: Object.freeze({ delay: 0.13, chorus: 0.22, flanger: 0.025, reverb: 0.18, mix: 0.55, sidechain: 0.22 }),
    texture: Object.freeze({ enabled: true, vinylCrackle: 0.05, tapeHiss: 0.07, wowFlutter: 0.04, warmth: 0.18, lowPassAge: 0.22, bitCrush: 0.012 }),
    intensityHints: Object.freeze({ menu: "A", explore: "B", night: "C", full: "D" })
  }),
  lofi_menu_warmth: Object.freeze({
    id: "lofi_menu_warmth",
    label: "Menu Warmth",
    description: "Soft menu loop that stays out of the way and leaves room for UI sounds.",
    bpm: Object.freeze({ min: 72, max: 80, default: 76 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["C major", "A minor", "F major"]),
    scalePreference: "major",
    swing: 0.09,
    humanize: 0.08,
    chordType: "seventh",
    chordStyle: "slow warm sevenths",
    chordInstrument: "felt_piano",
    melodyInstrument: "tape_bell",
    bassTone: "warm_sub",
    drumKit: "lofi_brush",
    drumGroovePreset: "lofi_half_time_soft",
    fx: Object.freeze({ delay: 0.08, chorus: 0.16, flanger: 0.01, reverb: 0.22, mix: 0.48, sidechain: 0.12 }),
    texture: Object.freeze({ enabled: true, vinylCrackle: 0.03, tapeHiss: 0.04, wowFlutter: 0.02, warmth: 0.16, lowPassAge: 0.18, bitCrush: 0 }),
    intensityHints: Object.freeze({ menu: "A", explore: "B", night: "C", full: "D" })
  }),
  lofi_sleepy_waltz: Object.freeze({
    id: "lofi_sleepy_waltz",
    label: "Sleepy Waltz",
    description: "Very sparse 3/4 felt-piano/pad loop for sleepy menus or night scenes.",
    bpm: Object.freeze({ min: 64, max: 72, default: 68 }),
    timeSig: 3,
    preferredKeys: Object.freeze(["C major", "A minor", "D minor"]),
    scalePreference: "major",
    swing: 0.06,
    humanize: 0.11,
    chordType: "seventh",
    chordStyle: "gentle 3/4 maj7/min7",
    chordInstrument: "felt_piano",
    melodyInstrument: "mellow_vibes",
    bassTone: "soft_upright",
    drumKit: "lofi_brush",
    drumGroovePreset: "lofi_sleepy_waltz_3_4",
    fx: Object.freeze({ delay: 0.1, chorus: 0.14, flanger: 0.01, reverb: 0.28, mix: 0.5, sidechain: 0.08 }),
    texture: Object.freeze({ enabled: true, vinylCrackle: 0.035, tapeHiss: 0.035, wowFlutter: 0.025, warmth: 0.14, lowPassAge: 0.2, bitCrush: 0 }),
    intensityHints: Object.freeze({ menu: "A", explore: "B", night: "C", full: "D" })
  })
});
var LOFI_STYLE_PRESET_IDS = Object.freeze(Object.keys(LOFI_STYLE_PRESETS));
function getLofiStylePreset(id = DEFAULT_LOFI_PRESET_ID) {
  return LOFI_STYLE_PRESETS[id] || LOFI_STYLE_PRESETS[DEFAULT_LOFI_PRESET_ID];
}
function isLofiProfile(value) {
  return String(value || "").toLowerCase() === LOFI_AUDIO_PROFILE_ID;
}
function normaliseLofiTexture(value = {}, preset = getLofiStylePreset()) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const presetTexture = preset?.texture || {};
  return {
    enabled: source.enabled ?? presetTexture.enabled ?? DEFAULT_LOFI_TEXTURE.enabled ? true : false,
    vinylCrackle: clamp01(source.vinylCrackle ?? presetTexture.vinylCrackle ?? DEFAULT_LOFI_TEXTURE.vinylCrackle),
    tapeHiss: clamp01(source.tapeHiss ?? presetTexture.tapeHiss ?? DEFAULT_LOFI_TEXTURE.tapeHiss),
    wowFlutter: clamp01(source.wowFlutter ?? presetTexture.wowFlutter ?? DEFAULT_LOFI_TEXTURE.wowFlutter),
    warmth: clamp01(source.warmth ?? presetTexture.warmth ?? DEFAULT_LOFI_TEXTURE.warmth),
    lowPassAge: clamp01(source.lowPassAge ?? presetTexture.lowPassAge ?? DEFAULT_LOFI_TEXTURE.lowPassAge),
    bitCrush: clamp01(source.bitCrush ?? presetTexture.bitCrush ?? DEFAULT_LOFI_TEXTURE.bitCrush)
  };
}
function normaliseLofiProjectSettings(project = {}) {
  const hasRequestedPreset = Boolean(project.lofiPreset || project.stylePreset);
  const requestedPreset = project.lofiPreset || project.stylePreset || DEFAULT_LOFI_PRESET_ID;
  const preset = getLofiStylePreset(requestedPreset);
  const audioProfile = isLofiProfile(project.audioProfile) || hasRequestedPreset && LOFI_STYLE_PRESETS[requestedPreset] ? LOFI_AUDIO_PROFILE_ID : String(project.audioProfile || "standard");
  const lofiActive = audioProfile === LOFI_AUDIO_PROFILE_ID;
  return {
    audioProfile,
    presetId: lofiActive ? preset.id : "",
    preset,
    drumKit: lofiActive ? safeChoice(project.drumKit, LOFI_DRUM_KITS, preset.drumKit) : "",
    drumGroovePreset: lofiActive ? safeChoice(project.drumGroovePreset, LOFI_DRUM_GROOVE_PRESETS, preset.drumGroovePreset) : "",
    bassTone: safeChoice(project.bassTone, lofiActive ? LOFI_BASS_TONES : ["classic"], lofiActive ? preset.bassTone : "classic"),
    texture: lofiActive ? normaliseLofiTexture(project.lofiTexture, preset) : { ...DEFAULT_LOFI_TEXTURE, enabled: false },
    intensityHints: lofiActive ? { ...preset.intensityHints } : {}
  };
}

// src/presets/chip.js
var CHIP_AUDIO_PROFILE_ID = "chip_arcade";
var LEGACY_CHIP_AUDIO_PROFILE_IDS = Object.freeze(["chip_tune"]);
var DEFAULT_CHIP_PRESET_ID = "chip_arcade_start";
var CHIP_CHORD_INSTRUMENTS = Object.freeze([
  "chip_square_stack",
  "chip_triangle_pad",
  "chip_arp_keys",
  "modern_chip_poly"
]);
var CHIP_MELODY_INSTRUMENTS = Object.freeze([
  "chip_square_lead",
  "chip_pulse_lead",
  "chip_triangle_blip",
  "chip_bell_stack",
  "modern_chip_lead"
]);
var CHIP_BASS_TONES = Object.freeze([
  "chip_triangle_bass",
  "chip_square_bass",
  "modern_chip_sub",
  "bitcrush_bass"
]);
var CHIP_DRUM_KITS = Object.freeze([
  "chip_noise_kit",
  "chip_arcade_kit",
  "modern_chip_punch"
]);
var CHIP_DRUM_GROOVE_PRESETS = Object.freeze([
  "chip_run_128",
  "chip_menu_bounce",
  "chip_boss_half_time",
  "chip_arp_jam",
  "chip_dungeon_shuffle",
  "chip_victory_stomp"
]);
var DEFAULT_CHIP_TEXTURE = Object.freeze({
  enabled: false,
  bitDepth: 0.22,
  sampleRateCrush: 0.18,
  pulseWidth: 0.5,
  pitchDrift: 0.03,
  saturation: 0.16,
  stereoSpread: 0.12
});
var CHIP_STYLE_PRESETS = Object.freeze({
  chip_arcade_start: Object.freeze({
    id: "chip_arcade_start",
    label: "Arcade Start",
    description: "Bright square lead, triangle bass and classic noise drums for instant retro-game hooks.",
    bpm: Object.freeze({ min: 116, max: 132, default: 124 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["C major", "G major", "A minor"]),
    scalePreference: "major",
    swing: 0.02,
    humanize: 0.03,
    chordType: "triad",
    chordStyle: "punchy I-V-vi-IV game loop",
    chordInstrument: "chip_square_stack",
    melodyInstrument: "chip_square_lead",
    bassTone: "chip_triangle_bass",
    drumKit: "chip_noise_kit",
    drumGroovePreset: "chip_run_128",
    fx: Object.freeze({ delay: 0.12, chorus: 0.08, flanger: 0.02, reverb: 0.08, mix: 0.44, sidechain: 0.18 }),
    texture: Object.freeze({ enabled: true, bitDepth: 0.2, sampleRateCrush: 0.16, pulseWidth: 0.5, pitchDrift: 0.015, saturation: 0.14, stereoSpread: 0.1 }),
    intensityHints: Object.freeze({ menu: "A", explore: "B", danger: "C", full: "D" })
  }),
  chip_bug_maze_pulse: Object.freeze({
    id: "chip_bug_maze_pulse",
    label: "Bug Maze Pulse",
    description: "Modern chiptune-inspired pressure loop with punchy drums, thick sub and harmonised leads.",
    bpm: Object.freeze({ min: 124, max: 138, default: 130 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["E minor", "B minor", "A minor"]),
    scalePreference: "minor",
    swing: 0.04,
    humanize: 0.05,
    chordType: "seventh",
    chordStyle: "dark minor lift with harmonised hooks",
    chordInstrument: "modern_chip_poly",
    melodyInstrument: "modern_chip_lead",
    bassTone: "modern_chip_sub",
    drumKit: "modern_chip_punch",
    drumGroovePreset: "chip_arp_jam",
    fx: Object.freeze({ delay: 0.16, chorus: 0.12, flanger: 0.04, reverb: 0.1, mix: 0.52, sidechain: 0.36 }),
    texture: Object.freeze({ enabled: true, bitDepth: 0.18, sampleRateCrush: 0.14, pulseWidth: 0.42, pitchDrift: 0.025, saturation: 0.32, stereoSpread: 0.2 }),
    intensityHints: Object.freeze({ menu: "A", build: "B", danger: "C", full: "D" })
  }),
  chip_neon_boss: Object.freeze({
    id: "chip_neon_boss",
    label: "Neon Boss",
    description: "Half-time boss pulse with hard noise hits, wide square chords and aggressive bass.",
    bpm: Object.freeze({ min: 132, max: 150, default: 142 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["F# minor", "C# minor", "D minor"]),
    scalePreference: "minor",
    swing: 0.03,
    humanize: 0.03,
    chordType: "sus4",
    chordStyle: "tense sus and minor movement",
    chordInstrument: "modern_chip_poly",
    melodyInstrument: "chip_pulse_lead",
    bassTone: "bitcrush_bass",
    drumKit: "modern_chip_punch",
    drumGroovePreset: "chip_boss_half_time",
    fx: Object.freeze({ delay: 0.09, chorus: 0.1, flanger: 0.05, reverb: 0.14, mix: 0.5, sidechain: 0.42 }),
    texture: Object.freeze({ enabled: true, bitDepth: 0.32, sampleRateCrush: 0.22, pulseWidth: 0.36, pitchDrift: 0.02, saturation: 0.4, stereoSpread: 0.18 }),
    intensityHints: Object.freeze({ menu: "A", danger: "C", boss: "D", full: "D" })
  }),
  chip_tiny_quest: Object.freeze({
    id: "chip_tiny_quest",
    label: "Tiny Quest",
    description: "Small adventure loop with triangle blips, bouncy bass and gentle arcade drums.",
    bpm: Object.freeze({ min: 104, max: 122, default: 112 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["G major", "D major", "E minor"]),
    scalePreference: "major",
    swing: 0.03,
    humanize: 0.05,
    chordType: "triad",
    chordStyle: "simple quest cadence",
    chordInstrument: "chip_triangle_pad",
    melodyInstrument: "chip_triangle_blip",
    bassTone: "chip_triangle_bass",
    drumKit: "chip_arcade_kit",
    drumGroovePreset: "chip_menu_bounce",
    fx: Object.freeze({ delay: 0.13, chorus: 0.08, flanger: 0.01, reverb: 0.12, mix: 0.45, sidechain: 0.16 }),
    texture: Object.freeze({ enabled: true, bitDepth: 0.16, sampleRateCrush: 0.12, pulseWidth: 0.54, pitchDrift: 0.02, saturation: 0.12, stereoSpread: 0.12 }),
    intensityHints: Object.freeze({ menu: "A", explore: "B", full: "D" })
  }),
  chip_modern_jam: Object.freeze({
    id: "chip_modern_jam",
    label: "Modern Jam",
    description: "Produced chiptune jam with harmonised hooks, sidechain pump and a full low end.",
    bpm: Object.freeze({ min: 120, max: 136, default: 128 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["A minor", "C minor", "E minor"]),
    scalePreference: "minor",
    swing: 0.05,
    humanize: 0.05,
    chordType: "seventh",
    chordStyle: "minor seventh chip-pop loop",
    chordInstrument: "modern_chip_poly",
    melodyInstrument: "modern_chip_lead",
    bassTone: "modern_chip_sub",
    drumKit: "modern_chip_punch",
    drumGroovePreset: "chip_arp_jam",
    fx: Object.freeze({ delay: 0.18, chorus: 0.16, flanger: 0.03, reverb: 0.12, mix: 0.58, sidechain: 0.34 }),
    texture: Object.freeze({ enabled: true, bitDepth: 0.2, sampleRateCrush: 0.16, pulseWidth: 0.44, pitchDrift: 0.035, saturation: 0.28, stereoSpread: 0.24 }),
    intensityHints: Object.freeze({ menu: "A", build: "B", full: "D" })
  }),
  chip_menu_glow: Object.freeze({
    id: "chip_menu_glow",
    label: "Menu Glow",
    description: "Soft glowing menu bed with chip bells, light pulse chords and restrained drums.",
    bpm: Object.freeze({ min: 88, max: 106, default: 96 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["C major", "F major", "A minor"]),
    scalePreference: "major",
    swing: 0.02,
    humanize: 0.04,
    chordType: "sus2",
    chordStyle: "gentle suspended menu loop",
    chordInstrument: "chip_triangle_pad",
    melodyInstrument: "chip_bell_stack",
    bassTone: "chip_triangle_bass",
    drumKit: "chip_arcade_kit",
    drumGroovePreset: "chip_menu_bounce",
    fx: Object.freeze({ delay: 0.14, chorus: 0.12, flanger: 0.01, reverb: 0.18, mix: 0.52, sidechain: 0.08 }),
    texture: Object.freeze({ enabled: true, bitDepth: 0.14, sampleRateCrush: 0.1, pulseWidth: 0.5, pitchDrift: 0.02, saturation: 0.1, stereoSpread: 0.18 }),
    intensityHints: Object.freeze({ menu: "A", explore: "B", full: "C" })
  }),
  chip_dungeon_drive: Object.freeze({
    id: "chip_dungeon_drive",
    label: "Dungeon Drive",
    description: "Moody shuffle with square bass, narrow pulse lead and gritty dungeon movement.",
    bpm: Object.freeze({ min: 110, max: 126, default: 118 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["D minor", "G minor", "A minor"]),
    scalePreference: "minor",
    swing: 0.08,
    humanize: 0.06,
    chordType: "sus4",
    chordStyle: "dark sus/minor movement",
    chordInstrument: "chip_arp_keys",
    melodyInstrument: "chip_pulse_lead",
    bassTone: "chip_square_bass",
    drumKit: "chip_noise_kit",
    drumGroovePreset: "chip_dungeon_shuffle",
    fx: Object.freeze({ delay: 0.12, chorus: 0.08, flanger: 0.04, reverb: 0.16, mix: 0.48, sidechain: 0.22 }),
    texture: Object.freeze({ enabled: true, bitDepth: 0.26, sampleRateCrush: 0.2, pulseWidth: 0.34, pitchDrift: 0.025, saturation: 0.22, stereoSpread: 0.1 }),
    intensityHints: Object.freeze({ menu: "A", explore: "B", danger: "C", full: "D" })
  }),
  chip_victory_burst: Object.freeze({
    id: "chip_victory_burst",
    label: "Victory Burst",
    description: "Short bright win-loop language with square stacks, bell hooks and arcade stomp drums.",
    bpm: Object.freeze({ min: 126, max: 148, default: 136 }),
    timeSig: 4,
    preferredKeys: Object.freeze(["C major", "D major", "G major"]),
    scalePreference: "major",
    swing: 0.01,
    humanize: 0.03,
    chordType: "triad",
    chordStyle: "bright tonic-dominant payoff",
    chordInstrument: "chip_square_stack",
    melodyInstrument: "chip_bell_stack",
    bassTone: "chip_square_bass",
    drumKit: "chip_arcade_kit",
    drumGroovePreset: "chip_victory_stomp",
    fx: Object.freeze({ delay: 0.1, chorus: 0.1, flanger: 0.02, reverb: 0.16, mix: 0.48, sidechain: 0.2 }),
    texture: Object.freeze({ enabled: true, bitDepth: 0.2, sampleRateCrush: 0.14, pulseWidth: 0.56, pitchDrift: 0.015, saturation: 0.18, stereoSpread: 0.2 }),
    intensityHints: Object.freeze({ menu: "A", victory: "D", full: "D" })
  })
});
var CHIP_STYLE_PRESET_IDS = Object.freeze(Object.keys(CHIP_STYLE_PRESETS));
function getChipStylePreset(id = DEFAULT_CHIP_PRESET_ID) {
  return CHIP_STYLE_PRESETS[id] || CHIP_STYLE_PRESETS[DEFAULT_CHIP_PRESET_ID];
}
function isChipProfile(value) {
  const id = String(value || "").toLowerCase();
  return id === CHIP_AUDIO_PROFILE_ID || LEGACY_CHIP_AUDIO_PROFILE_IDS.includes(id);
}
function normaliseChipTexture(value = {}, preset = getChipStylePreset()) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const presetTexture = preset?.texture || {};
  return {
    enabled: source.enabled ?? presetTexture.enabled ?? DEFAULT_CHIP_TEXTURE.enabled ? true : false,
    bitDepth: clamp01(source.bitDepth ?? presetTexture.bitDepth ?? DEFAULT_CHIP_TEXTURE.bitDepth),
    sampleRateCrush: clamp01(source.sampleRateCrush ?? presetTexture.sampleRateCrush ?? DEFAULT_CHIP_TEXTURE.sampleRateCrush),
    pulseWidth: clamp01(source.pulseWidth ?? presetTexture.pulseWidth ?? DEFAULT_CHIP_TEXTURE.pulseWidth),
    pitchDrift: clamp01(source.pitchDrift ?? presetTexture.pitchDrift ?? DEFAULT_CHIP_TEXTURE.pitchDrift),
    saturation: clamp01(source.saturation ?? presetTexture.saturation ?? DEFAULT_CHIP_TEXTURE.saturation),
    stereoSpread: clamp01(source.stereoSpread ?? presetTexture.stereoSpread ?? DEFAULT_CHIP_TEXTURE.stereoSpread)
  };
}
function normaliseChipProjectSettings(project = {}) {
  const stylePreset = String(project.stylePreset || "");
  const hasRequestedPreset = Boolean(project.chipPreset || stylePreset.startsWith("chip_"));
  const requestedPreset = project.chipPreset || (stylePreset.startsWith("chip_") ? stylePreset : "") || DEFAULT_CHIP_PRESET_ID;
  const preset = getChipStylePreset(requestedPreset);
  const audioProfile = isChipProfile(project.audioProfile) || hasRequestedPreset && CHIP_STYLE_PRESETS[requestedPreset] ? CHIP_AUDIO_PROFILE_ID : String(project.audioProfile || "standard");
  const chipActive = audioProfile === CHIP_AUDIO_PROFILE_ID;
  return {
    audioProfile,
    presetId: chipActive ? preset.id : "",
    preset,
    drumKit: chipActive ? safeChoice(project.drumKit, CHIP_DRUM_KITS, preset.drumKit) : "",
    drumGroovePreset: chipActive ? safeChoice(project.drumGroovePreset, CHIP_DRUM_GROOVE_PRESETS, preset.drumGroovePreset) : "",
    bassTone: chipActive ? safeChoice(project.bassTone, CHIP_BASS_TONES, preset.bassTone) : "",
    texture: chipActive ? normaliseChipTexture(project.chipTexture, preset) : { ...DEFAULT_CHIP_TEXTURE, enabled: false },
    intensityHints: chipActive ? { ...preset.intensityHints } : {}
  };
}

// src/presets/metal.js
var HEAVY_METAL_AUDIO_PROFILE_ID = "heavy_metal";
var DEFAULT_METAL_PRESET_ID = "metal_classic_chug";
var METAL_CHORD_INSTRUMENTS = Object.freeze(["metal_power_stack", "dark_organ_stack"]);
var METAL_MELODY_INSTRUMENTS = Object.freeze(["shred_lead_guitar", "twin_harmony_lead"]);
var METAL_BASS_TONES = Object.freeze(["metal_pick_bass", "metal_sub_pick", "metal_grind_bass"]);
var METAL_DRUM_KITS = Object.freeze(["metal_tight", "metal_arena", "metal_doom"]);
var METAL_DRUM_GROOVE_PRESETS = Object.freeze([
  "metal_backbeat_chug",
  "metal_gallop_160",
  "metal_double_kick_drive",
  "metal_blast_220",
  "metal_doom_70",
  "metal_breakdown_half_time"
]);
var DEFAULT_METAL_TEXTURE = Object.freeze({
  enabled: false,
  drive: 0.42,
  palmMute: 0.72,
  lowTightness: 0.78,
  presence: 0.56,
  roomSize: 0.16,
  pickAttack: 0.64
});
var METAL_STYLE_PRESETS = Object.freeze({
  metal_classic_chug: metalPreset("metal_classic_chug", "Classic Chug", 128, ["E minor", "A minor"], [0, 5, 6, 4], "metal_tight", "metal_backbeat_chug", "metal_pick_bass", "tight_metal", "metal_chug", { drive: 0.48, palmMute: 0.78, lowTightness: 0.86, presence: 0.58, roomSize: 0.12, pickAttack: 0.72 }),
  metal_thrashing_gallop: metalPreset("metal_thrashing_gallop", "Thrash Gallop", 168, ["E minor", "F# minor"], [0, 1, 0, 6], "metal_tight", "metal_gallop_160", "metal_grind_bass", "tight_metal", "thrash_gallop", { drive: 0.56, palmMute: 0.84, lowTightness: 0.9, presence: 0.64, roomSize: 0.1, pickAttack: 0.82 }, "twin_harmony_lead"),
  metal_doom_procession: metalPreset("metal_doom_procession", "Doom Procession", 70, ["C minor", "D minor"], [0, 6, 5, 1], "metal_doom", "metal_doom_70", "metal_sub_pick", "doom_fuzz", "doom_slow", { drive: 0.64, palmMute: 0.42, lowTightness: 0.58, presence: 0.42, roomSize: 0.38, pickAttack: 0.48 }, "shred_lead_guitar", "dark_organ_stack"),
  metal_power_anthem: metalPreset("metal_power_anthem", "Power Anthem", 144, ["D minor", "E minor"], [0, 5, 2, 6], "metal_arena", "metal_double_kick_drive", "metal_pick_bass", "tight_metal", "rock_eighths", { drive: 0.46, palmMute: 0.6, lowTightness: 0.78, presence: 0.62, roomSize: 0.24, pickAttack: 0.66 }, "twin_harmony_lead"),
  metal_boss_blast: metalPreset("metal_boss_blast", "Boss Blast", 212, ["F# minor", "E minor"], [0, 1, 6, 4], "metal_tight", "metal_blast_220", "metal_grind_bass", "tight_metal", "tremolo_drive", { drive: 0.6, palmMute: 0.72, lowTightness: 0.92, presence: 0.68, roomSize: 0.08, pickAttack: 0.86 }),
  metal_breakdown_gate: metalPreset("metal_breakdown_gate", "Breakdown Gate", 98, ["A minor", "B minor"], [0, 0, 1, 0], "metal_arena", "metal_breakdown_half_time", "metal_sub_pick", "tight_metal", "breakdown_stabs", { drive: 0.54, palmMute: 0.88, lowTightness: 0.94, presence: 0.55, roomSize: 0.1, pickAttack: 0.78 })
});
var METAL_STYLE_PRESET_IDS = Object.freeze(Object.keys(METAL_STYLE_PRESETS));
function getMetalStylePreset(id = DEFAULT_METAL_PRESET_ID) {
  return METAL_STYLE_PRESETS[id] || METAL_STYLE_PRESETS[DEFAULT_METAL_PRESET_ID];
}
function isMetalProfile(value) {
  return String(value || "").toLowerCase() === HEAVY_METAL_AUDIO_PROFILE_ID;
}
function normaliseMetalTexture(value = {}, preset = getMetalStylePreset()) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const presetTexture = preset?.texture || {};
  return {
    enabled: source.enabled ?? presetTexture.enabled ?? DEFAULT_METAL_TEXTURE.enabled ? true : false,
    drive: clamp01(source.drive ?? presetTexture.drive ?? DEFAULT_METAL_TEXTURE.drive),
    palmMute: clamp01(source.palmMute ?? presetTexture.palmMute ?? DEFAULT_METAL_TEXTURE.palmMute),
    lowTightness: clamp01(source.lowTightness ?? presetTexture.lowTightness ?? DEFAULT_METAL_TEXTURE.lowTightness),
    presence: clamp01(source.presence ?? presetTexture.presence ?? DEFAULT_METAL_TEXTURE.presence),
    roomSize: clamp01(source.roomSize ?? presetTexture.roomSize ?? DEFAULT_METAL_TEXTURE.roomSize),
    pickAttack: clamp01(source.pickAttack ?? presetTexture.pickAttack ?? DEFAULT_METAL_TEXTURE.pickAttack)
  };
}
function normaliseMetalProjectSettings(project = {}) {
  const stylePreset = String(project.stylePreset || "");
  const requestedPreset = project.metalPreset || (stylePreset.startsWith("metal_") ? stylePreset : "") || DEFAULT_METAL_PRESET_ID;
  const hasRequestedPreset = Boolean(project.metalPreset || stylePreset.startsWith("metal_"));
  const preset = getMetalStylePreset(requestedPreset);
  const audioProfile = isMetalProfile(project.audioProfile) || hasRequestedPreset && METAL_STYLE_PRESETS[requestedPreset] ? HEAVY_METAL_AUDIO_PROFILE_ID : String(project.audioProfile || "standard");
  const metalActive = audioProfile === HEAVY_METAL_AUDIO_PROFILE_ID;
  return {
    audioProfile,
    presetId: metalActive ? preset.id : "",
    preset,
    drumKit: metalActive ? safeChoice(project.drumKit, METAL_DRUM_KITS, preset.drumKit) : "",
    drumGroovePreset: metalActive ? safeChoice(project.drumGroovePreset, METAL_DRUM_GROOVE_PRESETS, preset.drumGroovePreset) : "",
    bassTone: metalActive ? safeChoice(project.bassTone, METAL_BASS_TONES, preset.bassTone) : "",
    guitarTone: metalActive ? preset.guitarTone : "",
    guitarPatternPreset: metalActive ? preset.guitarPatternPreset : "",
    texture: metalActive ? normaliseMetalTexture(project.metalTexture, preset) : { ...DEFAULT_METAL_TEXTURE, enabled: false },
    intensityHints: metalActive ? { ...preset.intensityHints } : {}
  };
}
function metalPreset(id, label, bpmDefault, preferredKeys, progression, drumKit, drumGroovePreset, bassTone, guitarTone, guitarPatternPreset, texture, melodyInstrument = "shred_lead_guitar", chordInstrument = "metal_power_stack") {
  return Object.freeze({
    id,
    label,
    description: `${label} procedural heavy metal starter preset.`,
    bpm: Object.freeze({ min: Math.max(40, bpmDefault - 16), max: Math.min(240, bpmDefault + 16), default: bpmDefault }),
    timeSig: 4,
    preferredKeys: Object.freeze(preferredKeys),
    scalePreference: "minor",
    progression: Object.freeze(progression.slice()),
    swing: 0,
    humanize: 0.03,
    chordType: "triad",
    chordStyle: "minor power-chord movement",
    chordInstrument,
    melodyInstrument,
    bassTone,
    drumKit,
    drumGroovePreset,
    guitarTone,
    guitarPatternPreset,
    fx: Object.freeze({ delay: 0.08, chorus: 0.04, flanger: 0.02, reverb: 0.12, mix: 0.4, sidechain: 0.2 }),
    texture: Object.freeze({ ...DEFAULT_METAL_TEXTURE, enabled: true, ...texture }),
    intensityHints: Object.freeze({ menu: "A", build: "B", danger: "C", full: "D" })
  });
}

// src/presets/funk.js
var FUNK_AUDIO_PROFILE_ID = "funk_groove";
var DEFAULT_FUNK_PRESET_ID = "funk_classic_pocket";
var FUNK_BASS_TONES = Object.freeze(["funk_finger_pocket", "funk_slap_pop", "funk_muted_thump", "funk_round_finger", "funk_synth_pocket"]);
var FUNK_DRUM_KITS = Object.freeze(["funk_dry_pocket", "funk_breakbeat"]);
var FUNK_CHORD_INSTRUMENTS = Object.freeze(["funk_clav_stab", "funk_rhodes_stab", "funk_brass_stack"]);
var FUNK_MELODY_INSTRUMENTS = Object.freeze(["funk_muted_trumpet", "funk_sax_punch"]);
var FUNK_DRUM_GROOVE_PRESETS = Object.freeze(["funk_backbeat_98", "funk_ghost_push", "funk_one_drop", "funk_open_hat_lift", "funk_breakbeat_pocket", "funk_fill_16ths"]);
var DEFAULT_FUNK_PARAMETERS = Object.freeze({
  pocket: 0.72,
  ghostNotes: 0.42,
  slapAmount: 0.68,
  popBrightness: 0.62,
  muteDepth: 0.74,
  stabTightness: 0.76
});
var FUNK_STYLE_PRESETS = Object.freeze({
  funk_classic_pocket: funkPreset("funk_classic_pocket", "Classic Pocket", 98, "funk_finger_pocket", "funk_dry_pocket", "funk_backbeat_98", "funk_clav_stab", { pocket: 0.82, ghostNotes: 0.4 }),
  funk_slap_party: funkPreset("funk_slap_party", "Slap Party", 112, "funk_slap_pop", "funk_breakbeat", "funk_open_hat_lift", "funk_brass_stack", { slapAmount: 0.9, popBrightness: 0.82, ghostNotes: 0.5 }),
  funk_clav_stabs: funkPreset("funk_clav_stabs", "Clav Stabs", 104, "funk_muted_thump", "funk_dry_pocket", "funk_ghost_push", "funk_clav_stab", { muteDepth: 0.9, stabTightness: 0.92 }),
  funk_brass_break: funkPreset("funk_brass_break", "Brass Break", 116, "funk_slap_pop", "funk_breakbeat", "funk_breakbeat_pocket", "funk_brass_stack", { slapAmount: 0.78, ghostNotes: 0.62 }),
  funk_soul_pocket: funkPreset("funk_soul_pocket", "Soul Pocket", 88, "funk_round_finger", "funk_dry_pocket", "funk_one_drop", "funk_rhodes_stab", { pocket: 0.66, ghostNotes: 0.3, stabTightness: 0.54 }),
  funk_game_chase: funkPreset("funk_game_chase", "Game Chase", 124, "funk_synth_pocket", "funk_breakbeat", "funk_breakbeat_pocket", "funk_clav_stab", { pocket: 0.88, ghostNotes: 0.48, stabTightness: 0.86 })
});
var FUNK_STYLE_PRESET_IDS = Object.freeze(Object.keys(FUNK_STYLE_PRESETS));
function getFunkStylePreset(id = DEFAULT_FUNK_PRESET_ID) {
  return FUNK_STYLE_PRESETS[id] || FUNK_STYLE_PRESETS[DEFAULT_FUNK_PRESET_ID];
}
function normaliseFunkParameters(value = {}, preset = getFunkStylePreset()) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.keys(DEFAULT_FUNK_PARAMETERS).map((key) => [key, clamp01(source[key] ?? preset.parameters[key] ?? DEFAULT_FUNK_PARAMETERS[key])]));
}
function normaliseFunkProjectSettings(project = {}) {
  const sound = project.soundProfile || {};
  const requestedPreset = sound.preset || project.funkPreset || (String(project.stylePreset || "").startsWith("funk_") ? project.stylePreset : "") || DEFAULT_FUNK_PRESET_ID;
  const active = sound.id === FUNK_AUDIO_PROFILE_ID || project.audioProfile === FUNK_AUDIO_PROFILE_ID || String(requestedPreset).startsWith("funk_");
  const preset = getFunkStylePreset(requestedPreset);
  return {
    audioProfile: active ? FUNK_AUDIO_PROFILE_ID : String(project.audioProfile || "standard"),
    presetId: active ? preset.id : "",
    preset,
    drumKit: active ? safeChoice(project.drumKit, FUNK_DRUM_KITS, preset.drumKit) : "",
    drumGroovePreset: active ? safeChoice(project.drumGroovePreset, FUNK_DRUM_GROOVE_PRESETS, preset.drumGroovePreset) : "",
    bassTone: active ? safeChoice(project.bassTone, FUNK_BASS_TONES, preset.bassTone) : "",
    chordInstrument: active ? preset.chordInstrument : "",
    parameters: active ? normaliseFunkParameters(sound.parameters || project.funkParameters, preset) : { ...DEFAULT_FUNK_PARAMETERS }
  };
}
function funkPreset(id, label, bpm, bassTone, drumKit, drumGroovePreset, chordInstrument, parameters) {
  return Object.freeze({ id, label, bpm: Object.freeze({ min: bpm - 12, max: bpm + 12, default: bpm }), bassTone, drumKit, drumGroovePreset, chordInstrument, scalePreference: "minor", chordType: "seventh", parameters: Object.freeze({ ...DEFAULT_FUNK_PARAMETERS, ...parameters }) });
}

// src/presets/western.js
var WESTERN_AUDIO_PROFILE_ID = "western_frontier";
var DEFAULT_WESTERN_PRESET_ID = "western_trail";
var WESTERN_BASS_TONES = Object.freeze(["western_upright", "western_picked_bass"]);
var WESTERN_DRUM_KITS = Object.freeze(["western_brush_kit", "western_train_kit"]);
var WESTERN_CHORD_INSTRUMENTS = Object.freeze(["western_saloon_piano", "western_mandolin_chop"]);
var WESTERN_MELODY_INSTRUMENTS = Object.freeze(["western_harmonica", "western_banjo", "western_fiddle"]);
var WESTERN_GROOVE_PRESETS = Object.freeze(["western_boom_chick", "western_train", "western_waltz", "western_showdown"]);
var DEFAULT_WESTERN_PARAMETERS = Object.freeze({ twang: 0.62, pickAttack: 0.56, body: 0.48, roomSize: 0.2, swing: 0.12 });
var WESTERN_STYLE_PRESETS = Object.freeze({
  western_trail: westernPreset("western_trail", "Western Trail", 104, "western_train", "western_picked_bass", { twang: 0.68, pickAttack: 0.64 }),
  western_boom_chick: westernPreset("western_boom_chick", "Boom Chick", 112, "western_boom_chick", "western_upright", { body: 0.62, swing: 0.08 }),
  western_waltz: westernPreset("western_waltz", "Frontier Waltz", 90, "western_waltz", "western_upright", { body: 0.7, roomSize: 0.3 }),
  western_showdown: westernPreset("western_showdown", "Showdown", 126, "western_showdown", "western_picked_bass", { twang: 0.9, pickAttack: 0.82, roomSize: 0.12 })
});
var WESTERN_STYLE_PRESET_IDS = Object.freeze(Object.keys(WESTERN_STYLE_PRESETS));
function getWesternStylePreset(id = DEFAULT_WESTERN_PRESET_ID) {
  return WESTERN_STYLE_PRESETS[id] || WESTERN_STYLE_PRESETS[DEFAULT_WESTERN_PRESET_ID];
}
function normaliseWesternProjectSettings(project = {}) {
  const sound = project.soundProfile || {};
  const requestedPreset = sound.preset || project.westernPreset || (String(project.stylePreset || "").startsWith("western_") ? project.stylePreset : "") || DEFAULT_WESTERN_PRESET_ID;
  const active = sound.id === WESTERN_AUDIO_PROFILE_ID || project.audioProfile === WESTERN_AUDIO_PROFILE_ID || String(requestedPreset).startsWith("western_");
  const preset = getWesternStylePreset(requestedPreset);
  const source = sound.parameters || project.westernParameters || {};
  return {
    audioProfile: active ? WESTERN_AUDIO_PROFILE_ID : String(project.audioProfile || "standard"),
    presetId: active ? preset.id : "",
    preset,
    drumKit: active ? safeChoice(project.drumKit, WESTERN_DRUM_KITS, preset.drumKit) : "",
    bassTone: active ? safeChoice(project.bassTone, WESTERN_BASS_TONES, preset.bassTone) : "",
    groovePreset: active ? safeChoice(project.drumGroovePreset, WESTERN_GROOVE_PRESETS, preset.groovePreset) : "",
    parameters: Object.fromEntries(Object.keys(DEFAULT_WESTERN_PARAMETERS).map((key) => [key, clamp01(source[key] ?? preset.parameters[key] ?? DEFAULT_WESTERN_PARAMETERS[key])]))
  };
}
function westernPreset(id, label, bpm, groovePreset, bassTone, parameters) {
  return Object.freeze({ id, label, bpm: Object.freeze({ min: bpm - 14, max: bpm + 14, default: bpm }), groovePreset, drumKit: groovePreset === "western_train" ? "western_train_kit" : "western_brush_kit", bassTone, guitarTone: "western_twang", parameters: Object.freeze({ ...DEFAULT_WESTERN_PARAMETERS, ...parameters }) });
}

// src/sounds/drum-lanes.js
var POCKET_DRUM_LANES = Object.freeze([
  { id: "kick", label: "Kick", short: "K", chordsmithPad: "kick", chordsmithPadName: "Kick", chordsmithPadMeta: "A - writes Kick", chordsmithPadKey: "a", chordsmithPadClass: "kick", chordsmithRecordTrack: "kick", chordsmithRecordLane: "kick", chordsmithRecordLevel: 1, sequenced: true, defaultVolume: 1, defaultPan: 0 },
  { id: "snare", label: "Snare", short: "S", chordsmithPad: "snare", chordsmithPadName: "Snare", chordsmithPadMeta: "S - writes Snare", chordsmithPadKey: "s", chordsmithPadClass: "snare", chordsmithRecordTrack: "snare", chordsmithRecordLane: "snare", chordsmithRecordLevel: 1, sequenced: true, defaultVolume: 1, defaultPan: 0 },
  { id: "clap", label: "Clap", short: "Cl", chordsmithPad: "clap", chordsmithPadName: "Clap", chordsmithPadMeta: "D - writes Clap", chordsmithPadKey: "d", chordsmithPadClass: "snare", chordsmithRecordTrack: null, chordsmithRecordLane: "clap", chordsmithRecordLevel: 1, sequenced: false, defaultVolume: 0.82, defaultPan: 0.05 },
  { id: "hat", label: "Hi-hat", short: "H", chordsmithPad: "hat", chordsmithPadName: "Hat", chordsmithPadMeta: "F - writes Closed Hat", chordsmithPadKey: "f", chordsmithPadClass: "hat", chordsmithRecordTrack: "hat", chordsmithRecordLane: "hat_closed", chordsmithRecordLevel: 1, sequenced: true, defaultVolume: 1, defaultPan: 0 },
  { id: "openhat", label: "Open Hat", short: "OH", chordsmithPad: "openhat", chordsmithPadName: "Open Hat", chordsmithPadMeta: "G - writes Open Hat", chordsmithPadKey: "g", chordsmithPadClass: "hat", chordsmithRecordTrack: "hat", chordsmithRecordLane: "hat_open", chordsmithRecordLevel: 2, sequenced: false, defaultVolume: 0.9, defaultPan: 0.18 },
  { id: "tomlow", label: "Low Tom", short: "LT", chordsmithPad: "tomlow", chordsmithPadName: "Low Tom", chordsmithPadMeta: "J - writes Low Tom", chordsmithPadKey: "j", chordsmithPadClass: "tom", chordsmithRecordTrack: null, chordsmithRecordLane: "tom_low", chordsmithRecordLevel: 1, sequenced: false, defaultVolume: 0.86, defaultPan: -0.18 },
  { id: "tommid", label: "Mid Tom", short: "MT", chordsmithPad: "tommid", chordsmithPadName: "Mid Tom", chordsmithPadMeta: "K - writes Mid Tom", chordsmithPadKey: "k", chordsmithPadClass: "tom", chordsmithRecordTrack: null, chordsmithRecordLane: "tom_mid", chordsmithRecordLevel: 1, sequenced: false, defaultVolume: 0.84, defaultPan: 0 },
  { id: "tomhi", label: "High Tom", short: "HT", chordsmithPad: "tomhi", chordsmithPadName: "High Tom", chordsmithPadMeta: "L - writes High Tom", chordsmithPadKey: "l", chordsmithPadClass: "tom", chordsmithRecordTrack: null, chordsmithRecordLane: "tom_high", chordsmithRecordLevel: 1, sequenced: false, defaultVolume: 0.82, defaultPan: 0.18 },
  { id: "crash", label: "Crash", short: "Cr", chordsmithPad: "crash", chordsmithPadName: "Crash", chordsmithPadMeta: "; - writes Crash", chordsmithPadKey: ";", chordsmithPadClass: "fx", chordsmithRecordTrack: null, chordsmithRecordLane: "crash", chordsmithRecordLevel: 1, sequenced: false, defaultVolume: 0.72, defaultPan: 0.24 },
  { id: "ride", label: "Ride", short: "Rd", chordsmithPad: "ride", chordsmithPadName: "Ride", chordsmithPadMeta: "' - writes Ride", chordsmithPadKey: "'", chordsmithPadClass: "fx", chordsmithRecordTrack: null, chordsmithRecordLane: "ride", chordsmithRecordLevel: 1, sequenced: false, defaultVolume: 0.78, defaultPan: 0.28 }
]);
var POCKET_DRUM_LANE_IDS = Object.freeze(POCKET_DRUM_LANES.map((lane) => lane.id));
var POCKET_AUDIO_COMMON_DRUM_LANES = Object.freeze([
  { id: "kick", fallback: "kick" },
  { id: "snare", fallback: "snare" },
  { id: "rim", fallback: "snare" },
  { id: "clap", fallback: "clap" },
  { id: "hat_closed", fallback: "hat" },
  { id: "hat_open", fallback: "openhat" },
  { id: "ride", fallback: "ride" },
  { id: "crash", fallback: "crash" },
  { id: "china", fallback: "crash" },
  { id: "tom_high", fallback: "tomhi" },
  { id: "tom_mid", fallback: "tommid" },
  { id: "tom_low", fallback: "tomlow" },
  { id: "percussion", fallback: "clap" }
].map((lane) => Object.freeze(lane)));
var POCKET_AUDIO_COMMON_DRUM_LANE_IDS = Object.freeze(POCKET_AUDIO_COMMON_DRUM_LANES.map((lane) => lane.id));
var POCKET_AUDIO_DRUM_LANE_ALIASES = Object.freeze({
  hat: "hat_closed",
  closedhat: "hat_closed",
  openhat: "hat_open",
  tomhi: "tom_high",
  tommid: "tom_mid",
  tomlow: "tom_low"
});
function normalisePocketAudioDrumLane(value, options = {}) {
  const requested = String(value || options.fallback || "percussion").trim().toLowerCase();
  const canonical = POCKET_AUDIO_DRUM_LANE_ALIASES[requested] || requested;
  if (POCKET_AUDIO_COMMON_DRUM_LANE_IDS.includes(canonical)) return canonical;
  return options.preserveUnknown === false ? options.fallback || "percussion" : canonical;
}
function pocketAudioDrumLaneFallback(value) {
  const canonical = normalisePocketAudioDrumLane(value);
  return POCKET_AUDIO_COMMON_DRUM_LANES.find((lane) => lane.id === canonical)?.fallback || "clap";
}
var CHORDSMITH_SEQUENCED_DRUM_LANE_IDS = Object.freeze(
  POCKET_DRUM_LANES.filter((lane) => lane.sequenced).map((lane) => lane.id)
);
var CHORDSMITH_LIVE_DRUM_VOICES = Object.freeze({
  kick: Object.freeze({ peak: 0.95 }),
  snare: Object.freeze({ peak: 0.56 }),
  hat: Object.freeze({ peak: 0.17, open: false }),
  openhat: Object.freeze({ peak: 0.25, open: true }),
  clap: Object.freeze({
    peak: 0.34,
    burstOffsets: Object.freeze([0, 0.018, 0.036]),
    noiseSeconds: 0.09,
    bandpassBase: 1450,
    bandpassStep: 150,
    bandpassQ: 0.85,
    gainFloor: 0.05,
    attackSeconds: 2e-3,
    releaseSeconds: 0.075
  }),
  tomlow: Object.freeze({ frequency: 118, peak: 0.62, endFrequencyRatio: 0.58, sweepSeconds: 0.22, attackSeconds: 4e-3, releaseSeconds: 0.28, stopSeconds: 0.31, gainFloor: 0.05 }),
  tommid: Object.freeze({ frequency: 158, peak: 0.58, endFrequencyRatio: 0.58, sweepSeconds: 0.22, attackSeconds: 4e-3, releaseSeconds: 0.28, stopSeconds: 0.31, gainFloor: 0.05 }),
  tomhi: Object.freeze({ frequency: 218, peak: 0.52, endFrequencyRatio: 0.58, sweepSeconds: 0.22, attackSeconds: 4e-3, releaseSeconds: 0.28, stopSeconds: 0.31, gainFloor: 0.05 }),
  crash: Object.freeze({ peak: 0.42, durationSeconds: 0.9, highpass: 3300, attackSeconds: 6e-3, gainFloor: 0.03 }),
  ride: Object.freeze({ peak: 0.24, durationSeconds: 0.42, highpass: 4300, attackSeconds: 6e-3, gainFloor: 0.03, bellFrequency: 980, bellGain: 0.07, bellReleaseSeconds: 0.22, bellStopSeconds: 0.24 })
});
function chordsmithLiveDrumPadPeak(laneId, velocity = 1) {
  const voice = CHORDSMITH_LIVE_DRUM_VOICES[laneId] || CHORDSMITH_LIVE_DRUM_VOICES.hat;
  const v = Math.max(0.15, Math.min(1.25, Number(velocity) || 1));
  return voice.peak * v;
}
function findPocketDrumLane(id) {
  return POCKET_DRUM_LANES.find((lane) => lane.id === id) || null;
}

// src/sounds/guitar.js
var POCKET_GUITAR_ARTICULATIONS = Object.freeze(["off", "open", "chug", "accent", "hold", "scratch"]);
var POCKET_GUITAR_STEP_CYCLE = Object.freeze(["off", "chug", "accent", "hold", "scratch"]);
var POCKET_GUITAR_TONES = Object.freeze(["clean", "crunch", "high_gain", "metal", "tight_metal", "doom_fuzz", "western_twang", "funk_muted"]);
var DEFAULT_GUITAR_TONE = "high_gain";
var POCKET_GUITAR_REGISTERS = Object.freeze(["low", "mid", "high"]);
var DEFAULT_GUITAR_REGISTER = "low";
var POCKET_GUITAR_STRUM_MODES = Object.freeze(["down", "up", "alternate"]);
var DEFAULT_GUITAR_STRUM_MODE = "down";
var POCKET_GUITAR_PATTERN_PRESETS = Object.freeze([
  "rock_eighths",
  "punk_downstrokes",
  "metal_chug",
  "gallop",
  "doom_slow",
  "thrash_gallop",
  "tremolo_drive",
  "breakdown_stabs",
  "verse_chorus",
  "boom_chick",
  "train_chop",
  "western_waltz"
]);
var POCKET_GUITAR_FILL_STYLES = Object.freeze(["gentle_strum", "sparse_strum", "chug", "accents_only"]);
var POCKET_GUITAR_TONE_CONFIGS = Object.freeze({
  clean: Object.freeze({ drive: 0.65, input: 0.62, peak: 0.086, lowpass: 4300, highpass: 90, body: 1.4, mid: 1, spread: 0.016, sustain: 1.08, mute: 0.085, scratch: 0.04 }),
  crunch: Object.freeze({ drive: 2.4, input: 0.8, peak: 0.092, lowpass: 3600, highpass: 100, body: 2.8, mid: 2, spread: 0.013, sustain: 0.98, mute: 0.074, scratch: 0.044 }),
  high_gain: Object.freeze({ drive: 4.2, input: 0.88, peak: 0.09, lowpass: 3250, highpass: 108, body: 3.7, mid: 2.6, spread: 0.01, sustain: 0.91, mute: 0.066, scratch: 0.042 }),
  metal: Object.freeze({ drive: 6.2, input: 0.92, peak: 0.088, lowpass: 3050, highpass: 115, body: 4.5, mid: 3, spread: 9e-3, sustain: 0.86, mute: 0.06, scratch: 0.04 }),
  tight_metal: Object.freeze({ drive: 7.1, input: 0.88, peak: 0.078, lowpass: 2850, highpass: 145, body: 3.5, mid: 3.35, spread: 7e-3, sustain: 0.76, mute: 0.045, scratch: 0.036 }),
  doom_fuzz: Object.freeze({ drive: 8.4, input: 0.82, peak: 0.075, lowpass: 2450, highpass: 72, body: 5.2, mid: 2.15, spread: 0.012, sustain: 1.18, mute: 0.095, scratch: 0.03 }),
  western_twang: Object.freeze({ drive: 1.25, input: 0.68, peak: 0.082, lowpass: 4700, highpass: 125, body: 1.1, mid: 2.4, spread: 0.02, sustain: 0.72, mute: 0.07, scratch: 0.034 }),
  funk_muted: Object.freeze({ drive: 1.45, input: 0.7, peak: 0.074, lowpass: 3900, highpass: 210, body: 1.2, mid: 2.75, spread: 0.014, sustain: 0.42, mute: 0.045, scratch: 0.038 })
});
function findPocketGuitarTone(id) {
  return POCKET_GUITAR_TONE_CONFIGS[id] || POCKET_GUITAR_TONE_CONFIGS[DEFAULT_GUITAR_TONE];
}
function validatePocketGuitarRegistry() {
  return {
    missingToneConfigs: POCKET_GUITAR_TONES.filter((id) => !POCKET_GUITAR_TONE_CONFIGS[id])
  };
}

// src/sounds/chip-registry.js
var CHIP_DRUM_KIT_CONFIGS = Object.freeze({
  chip_noise_kit: Object.freeze({
    kick: Object.freeze({ startFreq: 210, endFreq: 55, sweepSeconds: 0.075, filterFreq: 1900, gainFloor: 0.05, gainScale: 0.7, length: 0.11, rampSeconds: 0.095 }),
    snare: Object.freeze({ noiseSeconds: 0.075, highpass: 1500, lowpass: 6200, gainFloor: 0.035, gainScale: 0.72, length: 0.08, rampSeconds: 0.07, bodyFreq: 260, bodyGain: 0.028, bodyLength: 0.055, bodyRampSeconds: 0.05 }),
    hat: Object.freeze({ closedLength: 0.035, openLength: 0.12, highpassClosed: 5200, highpassOpen: 3600, lowpass: 9400, gainFloorClosed: 0.018, gainFloorOpen: 0.03, gainScaleClosed: 0.68, gainScaleOpen: 0.72, rampSecondsClosed: 0.03, rampSecondsOpen: 0.105 })
  }),
  chip_arcade_kit: Object.freeze({
    kick: Object.freeze({ startFreq: 185, endFreq: 48, sweepSeconds: 0.095, filterFreq: 1400, gainFloor: 0.055, gainScale: 0.78, length: 0.14, rampSeconds: 0.12 }),
    snare: Object.freeze({ noiseSeconds: 0.09, highpass: 1300, lowpass: 5600, gainFloor: 0.04, gainScale: 0.68, length: 0.1, rampSeconds: 0.085, bodyFreq: 220, bodyGain: 0.032, bodyLength: 0.075, bodyRampSeconds: 0.065 }),
    hat: Object.freeze({ closedLength: 0.04, openLength: 0.145, highpassClosed: 5e3, highpassOpen: 3300, lowpass: 9e3, gainFloorClosed: 0.018, gainFloorOpen: 0.032, gainScaleClosed: 0.66, gainScaleOpen: 0.72, rampSecondsClosed: 0.034, rampSecondsOpen: 0.12 })
  }),
  modern_chip_punch: Object.freeze({
    kick: Object.freeze({ startFreq: 150, endFreq: 38, sweepSeconds: 0.145, filterFreq: 230, gainFloor: 0.06, gainScale: 0.88, length: 0.18, rampSeconds: 0.16 }),
    snare: Object.freeze({ noiseSeconds: 0.105, highpass: 980, lowpass: 4800, gainFloor: 0.04, gainScale: 0.76, length: 0.12, rampSeconds: 0.1, bodyFreq: 190, bodyGain: 0.046, bodyLength: 0.095, bodyRampSeconds: 0.08 }),
    hat: Object.freeze({ closedLength: 0.045, openLength: 0.17, highpassClosed: 4300, highpassOpen: 3e3, lowpass: 7800, gainFloorClosed: 0.02, gainFloorOpen: 0.035, gainScaleClosed: 0.7, gainScaleOpen: 0.78, rampSecondsClosed: 0.04, rampSecondsOpen: 0.145 })
  })
});
var CHIP_BASS_TONE_CONFIGS = Object.freeze({
  chip_triangle_bass: Object.freeze({ mainWave: "triangle", subWave: "sine", mainPeak: 0.88, subPeak: 0.25, cutoff: 520, subCutoff: 180, attack: 4e-3 }),
  chip_square_bass: Object.freeze({ mainWave: "square", subWave: "triangle", mainPeak: 0.72, subPeak: 0.22, cutoff: 680, subCutoff: 220, attack: 2e-3 }),
  modern_chip_sub: Object.freeze({ mainWave: "square", subWave: "sine", mainPeak: 0.64, subPeak: 0.62, cutoff: 420, subCutoff: 150, attack: 6e-3 }),
  bitcrush_bass: Object.freeze({ mainWave: "sawtooth", subWave: "square", mainPeak: 0.58, subPeak: 0.34, cutoff: 560, subCutoff: 210, attack: 3e-3 })
});
var CHIP_CHORD_INSTRUMENT_CONFIGS = Object.freeze({
  chip_square_stack: Object.freeze({
    rootWave: "square",
    wave: "square",
    peak: 0.16,
    filter: "lowpass",
    freq: 3600,
    filterQ: 0.8,
    attack: 2e-3,
    decay: 0.08,
    sustain: 0.48,
    release: 0.14,
    durMul: 0.82,
    spreadMul: 0.16,
    shimmer: false,
    maxLiveDur: 0.68,
    layers: Object.freeze([
      Object.freeze({ wave: "square", level: 0.72 }),
      Object.freeze({ wave: "square", level: 0.38, detune: 6 }),
      Object.freeze({ wave: "triangle", freqMul: 2, level: 0.12 })
    ])
  }),
  chip_triangle_pad: Object.freeze({
    rootWave: "triangle",
    wave: "triangle",
    peak: 0.125,
    filter: "lowpass",
    freq: 2200,
    filterQ: 0.62,
    attack: 0.055,
    decay: 0.16,
    sustain: 0.72,
    release: 0.34,
    durMul: 1.18,
    spreadMul: 0.12,
    shimmer: false,
    maxLiveDur: 1.2,
    layers: Object.freeze([
      Object.freeze({ wave: "triangle", level: 0.8 }),
      Object.freeze({ wave: "sine", freqMul: 2, level: 0.18 })
    ])
  }),
  chip_arp_keys: Object.freeze({
    rootWave: "square",
    wave: "square",
    peak: 0.135,
    filter: "bandpass",
    freq: 1850,
    filterQ: 1.1,
    attack: 1e-3,
    decay: 0.055,
    sustain: 0.16,
    release: 0.12,
    durMul: 0.46,
    spreadMul: 0.72,
    shimmer: true,
    maxLiveDur: 0.36,
    layers: Object.freeze([
      Object.freeze({ wave: "square", level: 0.74 }),
      Object.freeze({ wave: "triangle", freqMul: 2, level: 0.16, detune: -4 })
    ])
  }),
  modern_chip_poly: Object.freeze({
    rootWave: "square",
    wave: "sawtooth",
    peak: 0.142,
    filter: "lowpass",
    freq: 2550,
    filterQ: 0.78,
    filterSweep: 3400,
    attack: 8e-3,
    decay: 0.13,
    sustain: 0.54,
    release: 0.22,
    durMul: 0.96,
    spreadMul: 0.28,
    shimmer: true,
    maxLiveDur: 0.92,
    layers: Object.freeze([
      Object.freeze({ wave: "square", level: 0.62, detune: -7 }),
      Object.freeze({ wave: "sawtooth", level: 0.4, detune: 8 }),
      Object.freeze({ wave: "triangle", freqMul: 0.5, level: 0.22 })
    ])
  })
});
var CHIP_LEAD_INSTRUMENT_CONFIGS = Object.freeze({
  chip_square_lead: Object.freeze({
    wave: "square",
    peak: 0.155,
    filter: "lowpass",
    freq: 4200,
    durMul: 0.88,
    extras: Object.freeze([
      Object.freeze({ freqMul: 2, wave: "triangle", peak: 0.018, peakScale: 0.12, filter: "lowpass", freq: 5200, offset: 4e-3, durMul: 0.42, maxDur: 0.12 })
    ])
  }),
  chip_pulse_lead: Object.freeze({
    wave: "square",
    peak: 0.135,
    filter: "bandpass",
    freq: 2400,
    durMul: 0.76,
    extras: Object.freeze([
      Object.freeze({ freqMul: 1.005, slideFreqMul: 1.008, wave: "square", peak: 0.026, peakScale: 0.16, filter: "lowpass", freq: 3600, offset: 6e-3, durMul: 0.62 })
    ])
  }),
  chip_triangle_blip: Object.freeze({
    wave: "triangle",
    peak: 0.12,
    filter: "lowpass",
    freq: 3100,
    durMul: 0.54,
    extras: Object.freeze([
      Object.freeze({ freqMul: 2, wave: "sine", peak: 0.012, peakScale: 0.1, filter: "lowpass", freq: 4200, offset: 4e-3, durMul: 0.28, maxDur: 0.08 })
    ])
  }),
  chip_bell_stack: Object.freeze({
    wave: "sine",
    peak: 0.108,
    filter: "lowpass",
    freq: 3900,
    durMul: 1.05,
    extras: Object.freeze([
      Object.freeze({ freqMul: 2.003, midiOffset: 12, wave: "sine", peak: 0.024, peakScale: 0.18, filter: "lowpass", freq: 4800, offset: 0.012, durMul: 0.5, maxDur: 0.18 }),
      Object.freeze({ freqMul: 3.01, wave: "triangle", peak: 0.01, peakScale: 0.08, filter: "highpass", freq: 2100, offset: 0.018, durMul: 0.38, maxDur: 0.14 })
    ])
  }),
  modern_chip_lead: Object.freeze({
    wave: "square",
    peak: 0.138,
    filter: "lowpass",
    freq: 3600,
    durMul: 0.86,
    extras: Object.freeze([
      Object.freeze({ freqMul: 1.997, midiOffset: 12, wave: "triangle", peak: 0.02, peakScale: 0.14, filter: "lowpass", freq: 4300, offset: 5e-3, durMul: 0.58, maxDur: 0.16 }),
      Object.freeze({ freqMul: 0.5, midiOffset: -12, wave: "square", peak: 0.012, peakScale: 0.09, filter: "lowpass", freq: 1600, offset: 2e-3, durMul: 0.68, maxDur: 0.18 })
    ])
  })
});
var POCKET_CHIP_SOUND_REGISTRY = Object.freeze({
  drumKits: CHIP_DRUM_KIT_CONFIGS,
  bassTones: CHIP_BASS_TONE_CONFIGS,
  chordInstruments: CHIP_CHORD_INSTRUMENT_CONFIGS,
  leadInstruments: CHIP_LEAD_INSTRUMENT_CONFIGS
});
function validateChipSoundRegistry() {
  return {
    missingDrumKits: missingKeys(CHIP_DRUM_KITS, CHIP_DRUM_KIT_CONFIGS),
    missingBassTones: missingKeys(CHIP_BASS_TONES, CHIP_BASS_TONE_CONFIGS),
    missingChordInstruments: missingKeys(CHIP_CHORD_INSTRUMENTS, CHIP_CHORD_INSTRUMENT_CONFIGS),
    missingLeadInstruments: missingKeys(CHIP_MELODY_INSTRUMENTS, CHIP_LEAD_INSTRUMENT_CONFIGS)
  };
}
function missingKeys(ids, configs) {
  return ids.filter((id) => !configs[id]);
}

// src/sounds/metal-registry.js
var METAL_DRUM_KIT_CONFIGS = Object.freeze({
  metal_tight: Object.freeze({ kick: Object.freeze({ startFreq: 112, endFreq: 34, sweepSeconds: 0.075, filterFreq: 240, gainFloor: 0.07, gainScale: 0.98, length: 0.14, rampSeconds: 0.115 }), snare: Object.freeze({ noiseSeconds: 0.09, highpass: 1550, lowpass: 7200, gainFloor: 0.045, gainScale: 0.82, length: 0.105, rampSeconds: 0.09, bodyFreq: 205, bodyGain: 0.04, bodyLength: 0.08, bodyRampSeconds: 0.06 }), hat: Object.freeze({ closedLength: 0.035, openLength: 0.13, highpassClosed: 5600, highpassOpen: 4100, lowpass: 9800, gainFloorClosed: 0.018, gainFloorOpen: 0.03, gainScaleClosed: 0.68, gainScaleOpen: 0.72, rampSecondsClosed: 0.03, rampSecondsOpen: 0.105 }) }),
  metal_arena: Object.freeze({ kick: Object.freeze({ startFreq: 104, endFreq: 36, sweepSeconds: 0.105, filterFreq: 210, gainFloor: 0.072, gainScale: 0.9, length: 0.18, rampSeconds: 0.15 }), snare: Object.freeze({ noiseSeconds: 0.12, highpass: 1280, lowpass: 6800, gainFloor: 0.048, gainScale: 0.86, length: 0.14, rampSeconds: 0.12, bodyFreq: 190, bodyGain: 0.055, bodyLength: 0.105, bodyRampSeconds: 0.08 }), hat: Object.freeze({ closedLength: 0.045, openLength: 0.18, highpassClosed: 5e3, highpassOpen: 3600, lowpass: 9200, gainFloorClosed: 0.019, gainFloorOpen: 0.034, gainScaleClosed: 0.64, gainScaleOpen: 0.74, rampSecondsClosed: 0.038, rampSecondsOpen: 0.15 }) }),
  metal_doom: Object.freeze({ kick: Object.freeze({ startFreq: 92, endFreq: 30, sweepSeconds: 0.15, filterFreq: 160, gainFloor: 0.07, gainScale: 0.78, length: 0.26, rampSeconds: 0.22 }), snare: Object.freeze({ noiseSeconds: 0.18, highpass: 880, lowpass: 4400, gainFloor: 0.045, gainScale: 0.7, length: 0.2, rampSeconds: 0.17, bodyFreq: 165, bodyGain: 0.06, bodyLength: 0.14, bodyRampSeconds: 0.11 }), hat: Object.freeze({ closedLength: 0.065, openLength: 0.24, highpassClosed: 3600, highpassOpen: 2600, lowpass: 7200, gainFloorClosed: 0.018, gainFloorOpen: 0.035, gainScaleClosed: 0.52, gainScaleOpen: 0.6, rampSecondsClosed: 0.055, rampSecondsOpen: 0.2 }) })
});
var METAL_BASS_TONE_CONFIGS = Object.freeze({
  metal_pick_bass: Object.freeze({ mainWave: "triangle", subWave: "sine", mainPeak: 0.64, subPeak: 0.34, cutoff: 430, subCutoff: 125, attack: 6e-3 }),
  metal_sub_pick: Object.freeze({ mainWave: "triangle", subWave: "sine", mainPeak: 0.58, subPeak: 0.68, cutoff: 360, subCutoff: 110, attack: 6e-3 }),
  metal_grind_bass: Object.freeze({ mainWave: "sawtooth", subWave: "triangle", mainPeak: 0.66, subPeak: 0.32, cutoff: 760, subCutoff: 170, attack: 2e-3 })
});
var METAL_CHORD_INSTRUMENT_CONFIGS = Object.freeze({
  metal_power_stack: Object.freeze({ rootWave: "sawtooth", wave: "sawtooth", peak: 0.15, filter: "bandpass", freq: 1180, filterQ: 0.9, filterSweep: 1950, attack: 2e-3, decay: 0.08, sustain: 0.58, release: 0.16, durMul: 0.72, spreadMul: 0.3, shimmer: false, maxLiveDur: 0.76, layers: Object.freeze([Object.freeze({ wave: "sawtooth", level: 0.78, detune: -5 }), Object.freeze({ wave: "square", level: 0.42, detune: 5 }), Object.freeze({ wave: "triangle", freqMul: 0.5, level: 0.2 })]) }),
  dark_organ_stack: Object.freeze({ rootWave: "triangle", wave: "sawtooth", peak: 0.125, filter: "lowpass", freq: 1050, filterQ: 0.62, filterSweep: 1500, attack: 0.09, decay: 0.24, sustain: 0.82, release: 0.62, durMul: 1.35, spreadMul: 0.18, shimmer: false, maxLiveDur: 1.7, layers: Object.freeze([Object.freeze({ wave: "triangle", level: 0.72, detune: -8 }), Object.freeze({ wave: "sawtooth", level: 0.36, detune: 7 }), Object.freeze({ wave: "sine", freqMul: 2, level: 0.16 })]) })
});
var METAL_LEAD_INSTRUMENT_CONFIGS = Object.freeze({
  shred_lead_guitar: Object.freeze({ wave: "sawtooth", peak: 0.132, filter: "bandpass", freq: 2300, durMul: 0.78, extras: Object.freeze([Object.freeze({ freqMul: 1.006, slideFreqMul: 1.012, wave: "square", peak: 0.04, peakScale: 0.26, filter: "lowpass", freq: 3400, offset: 4e-3, durMul: 0.62 }), Object.freeze({ freqMul: 2, midiOffset: 12, wave: "triangle", peak: 0.012, peakScale: 0.1, filter: "lowpass", freq: 4200, offset: 8e-3, durMul: 0.32, maxDur: 0.12 })]) }),
  twin_harmony_lead: Object.freeze({ wave: "sawtooth", peak: 0.118, filter: "lowpass", freq: 2900, durMul: 0.86, extras: Object.freeze([Object.freeze({ freqMul: 1.5, midiOffset: 7, wave: "sawtooth", peak: 0.032, peakScale: 0.24, filter: "bandpass", freq: 2600, offset: 6e-3, durMul: 0.7 }), Object.freeze({ freqMul: 2.005, midiOffset: 12, wave: "triangle", peak: 0.014, peakScale: 0.12, filter: "lowpass", freq: 3800, offset: 0.012, durMul: 0.4, maxDur: 0.16 })]) })
});
var POCKET_METAL_SOUND_REGISTRY = Object.freeze({
  drumKits: METAL_DRUM_KIT_CONFIGS,
  bassTones: METAL_BASS_TONE_CONFIGS,
  chordInstruments: METAL_CHORD_INSTRUMENT_CONFIGS,
  leadInstruments: METAL_LEAD_INSTRUMENT_CONFIGS
});
function validateMetalSoundRegistry() {
  return {
    missingDrumKits: missingKeys2(METAL_DRUM_KITS, METAL_DRUM_KIT_CONFIGS),
    missingBassTones: missingKeys2(METAL_BASS_TONES, METAL_BASS_TONE_CONFIGS),
    missingChordInstruments: missingKeys2(METAL_CHORD_INSTRUMENTS, METAL_CHORD_INSTRUMENT_CONFIGS),
    missingLeadInstruments: missingKeys2(METAL_MELODY_INSTRUMENTS, METAL_LEAD_INSTRUMENT_CONFIGS)
  };
}
function missingKeys2(ids, configs) {
  return ids.filter((id) => !configs[id]);
}

// src/sounds/lofi-registry.js
var CLASSIC_DRUM_KIT_CONFIG = Object.freeze({
  kick: Object.freeze({ startFreq: 155, endFreq: 45, sweepSeconds: 0.14, gainFloor: 0.08, gainScale: 1, length: 0.17, rampSeconds: 0.16 }),
  snare: Object.freeze({ noiseSeconds: 0.12, highpass: 1700, gainFloor: 0.05, gainScale: 1, length: 0.13, rampSeconds: 0.12 }),
  hat: Object.freeze({ closedLength: 0.05, openLength: 0.16, highpassClosed: 5600, highpassOpen: 3800, gainFloorClosed: 0.03, gainFloorOpen: 0.05, gainScaleClosed: 1, gainScaleOpen: 1, rampSecondsClosed: 0.05, rampSecondsOpen: 0.14 })
});
var LOFI_DRUM_KIT_CONFIGS = Object.freeze({
  lofi_dusty: Object.freeze({
    kick: Object.freeze({ startFreq: 132, endFreq: 42, sweepSeconds: 0.18, filterFreq: 170, gainFloor: 0.04, gainScale: 0.58, length: 0.23, rampSeconds: 0.21 }),
    snare: Object.freeze({ noiseSeconds: 0.13, highpass: 980, lowpass: 2800, gainFloor: 0.035, gainScale: 0.52, length: 0.14, rampSeconds: 0.12, bodyFreq: 185, bodyGain: 0.035, bodyLength: 0.11, bodyRampSeconds: 0.09 }),
    hat: Object.freeze({ closedLength: 0.065, openLength: 0.2, highpassClosed: 3400, highpassOpen: 2600, lowpass: 6200, gainFloorClosed: 0.02, gainFloorOpen: 0.035, gainScaleClosed: 0.55, gainScaleOpen: 0.62, rampSecondsClosed: 0.055, rampSecondsOpen: 0.18 })
  }),
  lofi_brush: Object.freeze({
    kick: Object.freeze({ startFreq: 132, endFreq: 42, sweepSeconds: 0.18, filterFreq: 135, gainFloor: 0.04, gainScale: 0.48, length: 0.23, rampSeconds: 0.21 }),
    snare: Object.freeze({ noiseSeconds: 0.18, highpass: 720, lowpass: 2800, gainFloor: 0.035, gainScale: 0.46, length: 0.2, rampSeconds: 0.18, bodyFreq: 150, bodyGain: 0.035, bodyLength: 0.11, bodyRampSeconds: 0.09 }),
    hat: Object.freeze({ closedLength: 0.065, openLength: 0.2, highpassClosed: 3400, highpassOpen: 2600, lowpass: 6200, gainFloorClosed: 0.02, gainFloorOpen: 0.035, gainScaleClosed: 0.55, gainScaleOpen: 0.62, rampSecondsClosed: 0.055, rampSecondsOpen: 0.18 })
  }),
  lofi_tape_soft: Object.freeze({
    kick: Object.freeze({ startFreq: 118, endFreq: 42, sweepSeconds: 0.18, filterFreq: 170, gainFloor: 0.04, gainScale: 0.58, length: 0.23, rampSeconds: 0.21 }),
    snare: Object.freeze({ noiseSeconds: 0.13, highpass: 980, lowpass: 2200, gainFloor: 0.035, gainScale: 0.52, length: 0.14, rampSeconds: 0.12, bodyFreq: 185, bodyGain: 0.035, bodyLength: 0.11, bodyRampSeconds: 0.09 }),
    hat: Object.freeze({ closedLength: 0.065, openLength: 0.2, highpassClosed: 3400, highpassOpen: 2600, lowpass: 5200, gainFloorClosed: 0.02, gainFloorOpen: 0.035, gainScaleClosed: 0.55, gainScaleOpen: 0.62, rampSecondsClosed: 0.055, rampSecondsOpen: 0.18 })
  })
});
var POCKET_DRUM_KIT_CONFIGS = Object.freeze({
  classic: CLASSIC_DRUM_KIT_CONFIG,
  ...LOFI_DRUM_KIT_CONFIGS,
  ...CHIP_DRUM_KIT_CONFIGS,
  ...METAL_DRUM_KIT_CONFIGS
});
var DEFAULT_CLASSIC_DRUM_KIT = "classic";
var DEFAULT_LOFI_DRUM_KIT = "lofi_dusty";
var DEFAULT_CHIP_DRUM_KIT = "chip_noise_kit";
var DEFAULT_METAL_DRUM_KIT = "metal_tight";
var CLASSIC_BASS_TONE_CONFIG = Object.freeze({
  mainWave: "sawtooth",
  subWave: "sine",
  mainPeak: 1,
  subPeak: 0.42,
  cutoff: 420,
  subCutoff: 220,
  attack: 0.01
});
var LOFI_BASS_TONE_CONFIGS = Object.freeze({
  warm_sub: Object.freeze({ mainWave: "sine", subWave: "sine", mainPeak: 0.82, subPeak: 0.55, cutoff: 210, subCutoff: 120, attack: 0.018 }),
  soft_upright: Object.freeze({ mainWave: "triangle", subWave: "sine", mainPeak: 0.72, subPeak: 0.28, cutoff: 360, subCutoff: 140, attack: 8e-3 }),
  rounded_triangle_bass: Object.freeze({ mainWave: "triangle", subWave: "sine", mainPeak: 0.84, subPeak: 0.34, cutoff: 300, subCutoff: 130, attack: 0.012 })
});
var POCKET_BASS_TONE_CONFIGS = Object.freeze({
  classic: CLASSIC_BASS_TONE_CONFIG,
  ...LOFI_BASS_TONE_CONFIGS,
  ...CHIP_BASS_TONE_CONFIGS,
  ...METAL_BASS_TONE_CONFIGS
});
var DEFAULT_CLASSIC_BASS_TONE = "classic";
function resolvePocketDrumKitId(drumKit, audioProfile = "", lofiPreset = "") {
  const requested = String(drumKit || "");
  if (POCKET_DRUM_KIT_CONFIGS[requested]) return requested;
  if (isPocketChipActive(audioProfile, lofiPreset)) return DEFAULT_CHIP_DRUM_KIT;
  if (isPocketMetalActive(audioProfile, lofiPreset)) return DEFAULT_METAL_DRUM_KIT;
  return isPocketLofiActive(audioProfile, lofiPreset) ? DEFAULT_LOFI_DRUM_KIT : DEFAULT_CLASSIC_DRUM_KIT;
}
function resolvePocketBassToneId(bassTone) {
  const requested = String(bassTone || "");
  return POCKET_BASS_TONE_CONFIGS[requested] ? requested : DEFAULT_CLASSIC_BASS_TONE;
}
function isPocketLofiActive(audioProfile = "", lofiPreset = "") {
  return audioProfile === "lofi_chill" || String(lofiPreset || "").startsWith("lofi_");
}
function isPocketChipActive(audioProfile = "", chipPreset = "") {
  return audioProfile === "chip_arcade" || audioProfile === "chip_tune" || String(chipPreset || "").startsWith("chip_");
}
function isPocketMetalActive(audioProfile = "", metalPreset2 = "") {
  return audioProfile === "heavy_metal" || String(metalPreset2 || "").startsWith("metal_");
}
var LOFI_CHORD_INSTRUMENT_CONFIGS = Object.freeze({
  dusty_rhodes: Object.freeze({
    rootWave: "triangle",
    wave: "triangle",
    peak: 0.155,
    filter: "lowpass",
    freq: 1550,
    filterQ: 0.72,
    attack: 0.012,
    decay: 0.18,
    sustain: 0.44,
    release: 0.34,
    durMul: 0.96,
    spreadMul: 0.38,
    shimmer: false,
    maxLiveDur: 1.05,
    layers: Object.freeze([
      Object.freeze({ wave: "triangle", level: 0.82, detune: -4 }),
      Object.freeze({ wave: "sine", freqMul: 2.01, level: 0.21, detune: 5 }),
      Object.freeze({ wave: "sine", freqMul: 3.01, level: 0.045, detune: -8 })
    ])
  }),
  felt_piano: Object.freeze({
    rootWave: "triangle",
    wave: "triangle",
    peak: 0.145,
    filter: "lowpass",
    freq: 1900,
    filterQ: 0.82,
    attack: 6e-3,
    decay: 0.24,
    sustain: 0.22,
    release: 0.42,
    durMul: 0.82,
    spreadMul: 0.34,
    shimmer: false,
    maxLiveDur: 0.96,
    layers: Object.freeze([
      Object.freeze({ wave: "triangle", level: 0.78 }),
      Object.freeze({ wave: "sine", freqMul: 2, level: 0.16, detune: -3 })
    ])
  }),
  cassette_keys: Object.freeze({
    rootWave: "triangle",
    wave: "triangle",
    peak: 0.135,
    filter: "lowpass",
    freq: 1320,
    filterQ: 0.7,
    attack: 0.018,
    decay: 0.18,
    sustain: 0.54,
    release: 0.44,
    durMul: 1.04,
    spreadMul: 0.45,
    shimmer: false,
    maxLiveDur: 1.22,
    layers: Object.freeze([
      Object.freeze({ wave: "triangle", level: 0.72, detune: -9 }),
      Object.freeze({ wave: "triangle", level: 0.5, detune: 10 }),
      Object.freeze({ wave: "sine", freqMul: 2, level: 0.12, detune: 3 })
    ])
  }),
  muted_jazz_guitar: Object.freeze({
    rootWave: "triangle",
    wave: "triangle",
    peak: 0.132,
    filter: "bandpass",
    freq: 1180,
    filterQ: 0.95,
    attack: 4e-3,
    decay: 0.09,
    sustain: 0.08,
    release: 0.16,
    durMul: 0.5,
    spreadMul: 0.72,
    shimmer: false,
    maxLiveDur: 0.42,
    layers: Object.freeze([
      Object.freeze({ wave: "triangle", level: 0.8 }),
      Object.freeze({ wave: "square", level: 0.11, detune: -5 })
    ])
  }),
  lofi_warm_pad: Object.freeze({
    rootWave: "sine",
    wave: "triangle",
    peak: 0.115,
    filter: "lowpass",
    freq: 930,
    filterQ: 0.58,
    filterSweep: 1180,
    attack: 0.18,
    decay: 0.3,
    sustain: 0.86,
    release: 0.72,
    durMul: 1.48,
    spreadMul: 0.22,
    shimmer: false,
    maxLiveDur: 1.85,
    layers: Object.freeze([
      Object.freeze({ wave: "sine", level: 0.92, detune: -7 }),
      Object.freeze({ wave: "triangle", level: 0.42, detune: 7 })
    ])
  })
});
var LOFI_LEAD_INSTRUMENT_CONFIGS = Object.freeze({
  mellow_vibes: Object.freeze({ wave: "sine", peak: 0.105, filter: "lowpass", freq: 2100, durMul: 1.15, extra: Object.freeze({ freqMul: 1, slideFreqMul: 2, midiOffset: 12, wave: "sine", peak: 0.018, peakScale: 0.17, filter: "lowpass", freq: 2400, offset: 0.01, durMul: 0.48, maxDur: 0.18 }) }),
  soft_pluck: Object.freeze({ wave: "triangle", peak: 0.112, filter: "lowpass", freq: 1650, durMul: 0.62, extra: Object.freeze({ freqMul: 2, wave: "sine", peak: 0.014, peakScale: 0.13, filter: "lowpass", freq: 2200, offset: 4e-3, durMul: 0.45, maxDur: 0.12 }) }),
  mellow_sax: Object.freeze({ wave: "triangle", peak: 0.118, filter: "bandpass", freq: 820, durMul: 1.18, extra: Object.freeze({ freqMul: 1, slideFreqMul: 0.5, midiOffset: -12, wave: "sine", peak: 0.018, peakScale: 0.15, filter: "lowpass", freq: 640, offset: 4e-3, durMul: 0.46 }) }),
  muted_trumpet: Object.freeze({ wave: "square", peak: 0.095, filter: "bandpass", freq: 1180, durMul: 0.98, extra: Object.freeze({ freqMul: 1, slideFreqMul: 2, midiOffset: 12, wave: "triangle", peak: 0.012, peakScale: 0.13, filter: "bandpass", freq: 1700, offset: 6e-3, durMul: 0.28 }) }),
  tape_bell: Object.freeze({ wave: "sine", peak: 0.088, filter: "lowpass", freq: 1900, durMul: 1.04, extra: Object.freeze({ freqMul: 0.997, slideFreqMul: 1.994, midiOffset: 12, wave: "sine", peak: 0.014, peakScale: 0.16, filter: "lowpass", freq: 2100, offset: 0.016, durMul: 0.38 }) })
});
var POCKET_LOFI_SOUND_REGISTRY = Object.freeze({
  drumKits: LOFI_DRUM_KIT_CONFIGS,
  bassTones: LOFI_BASS_TONE_CONFIGS,
  chordInstruments: LOFI_CHORD_INSTRUMENT_CONFIGS,
  leadInstruments: LOFI_LEAD_INSTRUMENT_CONFIGS
});
var POCKET_SOUND_REGISTRY = Object.freeze({
  drumKits: POCKET_DRUM_KIT_CONFIGS,
  bassTones: POCKET_BASS_TONE_CONFIGS,
  lofi: POCKET_LOFI_SOUND_REGISTRY,
  chip: POCKET_CHIP_SOUND_REGISTRY,
  metal: POCKET_METAL_SOUND_REGISTRY
});
function validateLofiSoundRegistry() {
  return {
    missingDrumKits: missingKeys3(LOFI_DRUM_KITS, LOFI_DRUM_KIT_CONFIGS),
    missingBassTones: missingKeys3(LOFI_BASS_TONES, LOFI_BASS_TONE_CONFIGS),
    missingChordInstruments: missingKeys3(LOFI_CHORD_INSTRUMENTS, LOFI_CHORD_INSTRUMENT_CONFIGS),
    missingLeadInstruments: missingKeys3(LOFI_MELODY_INSTRUMENTS, LOFI_LEAD_INSTRUMENT_CONFIGS)
  };
}
function validatePocketSoundRegistry() {
  return {
    missingDrumKits: missingKeys3(["classic", ...LOFI_DRUM_KITS.filter((id) => id !== "classic"), ...CHIP_DRUM_KITS, ...METAL_DRUM_KITS], POCKET_DRUM_KIT_CONFIGS),
    missingBassTones: missingKeys3(["classic", ...LOFI_BASS_TONES, ...CHIP_BASS_TONES, ...METAL_BASS_TONES], POCKET_BASS_TONE_CONFIGS),
    lofi: validateLofiSoundRegistry(),
    chip: validateChipSoundRegistry(),
    metal: validateMetalSoundRegistry()
  };
}
function missingKeys3(ids, configs) {
  return ids.filter((id) => !configs[id]);
}

// src/sounds/funk-registry.js
var FUNK_DRUM_KIT_CONFIGS = Object.freeze({
  funk_dry_pocket: kit(132, 44, 0.09, 178, 0.8, 0.048, 6500),
  funk_breakbeat: kit(148, 42, 0.12, 192, 0.92, 0.062, 7200)
});
var FUNK_BASS_TONE_CONFIGS = Object.freeze({
  funk_finger_pocket: bass("triangle", "sine", 0.82, 0.3, 720, 155, 8e-3),
  funk_slap_pop: bass("sawtooth", "sine", 0.7, 0.34, 1180, 170, 2e-3),
  funk_muted_thump: bass("triangle", "sine", 0.48, 0.28, 410, 130, 2e-3),
  funk_round_finger: bass("triangle", "sine", 0.76, 0.42, 520, 145, 0.014),
  funk_synth_pocket: bass("sawtooth", "triangle", 0.68, 0.3, 920, 180, 4e-3)
});
var FUNK_CHORD_INSTRUMENT_CONFIGS = Object.freeze({
  funk_clav_stab: chord("square", "bandpass", 2250, 4e-3, 0.34, 0.15),
  funk_rhodes_stab: chord("triangle", "lowpass", 1900, 8e-3, 0.56, 0.16),
  funk_brass_stack: chord("sawtooth", "bandpass", 1450, 0.01, 0.42, 0.13)
});
var FUNK_LEAD_INSTRUMENT_CONFIGS = Object.freeze({
  funk_muted_trumpet: Object.freeze({ wave: "square", peak: 0.11, filter: "bandpass", freq: 1580, durMul: 0.48 }),
  funk_sax_punch: Object.freeze({ wave: "triangle", peak: 0.13, filter: "bandpass", freq: 980, durMul: 0.56 })
});
var POCKET_FUNK_SOUND_REGISTRY = Object.freeze({ drumKits: FUNK_DRUM_KIT_CONFIGS, bassTones: FUNK_BASS_TONE_CONFIGS, chordInstruments: FUNK_CHORD_INSTRUMENT_CONFIGS, leadInstruments: FUNK_LEAD_INSTRUMENT_CONFIGS });
function validateFunkSoundRegistry() {
  return { missingDrumKits: missing(FUNK_DRUM_KITS, FUNK_DRUM_KIT_CONFIGS), missingBassTones: missing(FUNK_BASS_TONES, FUNK_BASS_TONE_CONFIGS), missingChordInstruments: missing(FUNK_CHORD_INSTRUMENTS, FUNK_CHORD_INSTRUMENT_CONFIGS), missingLeadInstruments: missing(FUNK_MELODY_INSTRUMENTS, FUNK_LEAD_INSTRUMENT_CONFIGS) };
}
function kit(startFreq, endFreq, sweepSeconds, bodyFreq, snareGain, hatLength, hatHighpass) {
  return Object.freeze({ kick: Object.freeze({ startFreq, endFreq, sweepSeconds, gainScale: 0.9, length: 0.16 }), snare: Object.freeze({ noiseSeconds: 0.1, highpass: 1200, lowpass: 6800, gainScale: snareGain, bodyFreq, bodyGain: 0.08, length: 0.12 }), hat: Object.freeze({ closedLength: hatLength, openLength: 0.18, highpassClosed: hatHighpass, highpassOpen: 4300, gainScaleClosed: 0.58, gainScaleOpen: 0.72 }), rim: Object.freeze({ bodyFreq: 860, gainScale: 0.42 }), clap: Object.freeze({ highpass: 1250, gainScale: 0.55 }) });
}
function bass(mainWave, subWave, mainPeak, subPeak, cutoff, subCutoff, attack) {
  return Object.freeze({ mainWave, subWave, mainPeak, subPeak, cutoff, subCutoff, attack });
}
function chord(wave, filter, freq, attack, durMul, peak) {
  return Object.freeze({ rootWave: wave, wave, filter, freq, filterQ: 0.9, attack, decay: 0.08, sustain: 0.08, release: 0.1, durMul, spreadMul: 0.4, maxLiveDur: 0.42, peak, layers: Object.freeze([Object.freeze({ wave, level: 0.8 }), Object.freeze({ wave: "triangle", freqMul: 2, level: 0.18 })]) });
}
function missing(ids, configs) {
  return ids.filter((id) => !configs[id]);
}

// src/sounds/western-registry.js
var WESTERN_DRUM_KIT_CONFIGS = Object.freeze({
  western_brush_kit: Object.freeze({ kick: Object.freeze({ startFreq: 118, endFreq: 42, sweepSeconds: 0.16, gainScale: 0.62 }), snare: Object.freeze({ noiseSeconds: 0.16, highpass: 780, lowpass: 3500, gainScale: 0.48, bodyFreq: 165, bodyGain: 0.04 }), hat: Object.freeze({ closedLength: 0.07, openLength: 0.2, highpassClosed: 3900, highpassOpen: 2900, gainScaleClosed: 0.48, gainScaleOpen: 0.56 }) }),
  western_train_kit: Object.freeze({ kick: Object.freeze({ startFreq: 138, endFreq: 44, sweepSeconds: 0.12, gainScale: 0.76 }), snare: Object.freeze({ noiseSeconds: 0.12, highpass: 980, lowpass: 4700, gainScale: 0.64, bodyFreq: 184, bodyGain: 0.05 }), hat: Object.freeze({ closedLength: 0.05, openLength: 0.16, highpassClosed: 4700, highpassOpen: 3300, gainScaleClosed: 0.54, gainScaleOpen: 0.62 }) })
});
var WESTERN_BASS_TONE_CONFIGS = Object.freeze({
  western_upright: Object.freeze({ mainWave: "triangle", subWave: "sine", mainPeak: 0.74, subPeak: 0.26, cutoff: 490, subCutoff: 135, attack: 8e-3 }),
  western_picked_bass: Object.freeze({ mainWave: "sawtooth", subWave: "sine", mainPeak: 0.62, subPeak: 0.32, cutoff: 760, subCutoff: 150, attack: 3e-3 })
});
var WESTERN_CHORD_INSTRUMENT_CONFIGS = Object.freeze({
  western_saloon_piano: Object.freeze({ rootWave: "triangle", wave: "triangle", peak: 0.19, filter: "lowpass", freq: 3500, filterQ: 1, attack: 2e-3, decay: 0.12, sustain: 0.1, release: 0.16, durMul: 0.6, spreadMul: 0.58, maxLiveDur: 0.68, layers: Object.freeze([Object.freeze({ wave: "triangle", level: 0.86, detune: -8 }), Object.freeze({ wave: "triangle", level: 0.6, detune: 9 })]) }),
  western_mandolin_chop: Object.freeze({ rootWave: "triangle", wave: "square", peak: 0.12, filter: "bandpass", freq: 2400, filterQ: 1.1, attack: 2e-3, decay: 0.06, sustain: 0.04, release: 0.09, durMul: 0.34, spreadMul: 0.72, maxLiveDur: 0.28, layers: Object.freeze([Object.freeze({ wave: "triangle", level: 0.8 }), Object.freeze({ wave: "square", freqMul: 2, level: 0.12 })]) })
});
var WESTERN_LEAD_INSTRUMENT_CONFIGS = Object.freeze({
  western_harmonica: Object.freeze({ wave: "square", peak: 0.115, filter: "bandpass", freq: 1250, durMul: 1.18 }),
  western_banjo: Object.freeze({ wave: "triangle", peak: 0.13, filter: "bandpass", freq: 2200, durMul: 0.46 }),
  western_fiddle: Object.freeze({ wave: "sawtooth", peak: 0.11, filter: "bandpass", freq: 1750, durMul: 1.08 })
});
var POCKET_WESTERN_SOUND_REGISTRY = Object.freeze({ drumKits: WESTERN_DRUM_KIT_CONFIGS, bassTones: WESTERN_BASS_TONE_CONFIGS, chordInstruments: WESTERN_CHORD_INSTRUMENT_CONFIGS, leadInstruments: WESTERN_LEAD_INSTRUMENT_CONFIGS });
function validateWesternSoundRegistry() {
  const missing2 = (ids, cfg) => ids.filter((id) => !cfg[id]);
  return { missingDrumKits: missing2(WESTERN_DRUM_KITS, WESTERN_DRUM_KIT_CONFIGS), missingBassTones: missing2(WESTERN_BASS_TONES, WESTERN_BASS_TONE_CONFIGS), missingChordInstruments: missing2(WESTERN_CHORD_INSTRUMENTS, WESTERN_CHORD_INSTRUMENT_CONFIGS), missingLeadInstruments: missing2(WESTERN_MELODY_INSTRUMENTS, WESTERN_LEAD_INSTRUMENT_CONFIGS) };
}

// src/sounds/instruments.js
var POCKET_CHORD_INSTRUMENTS = Object.freeze([
  "pocket",
  "piano",
  "saloon_piano",
  "harp",
  "warm_pad",
  "glass",
  "dusty_rhodes",
  "felt_piano",
  "cassette_keys",
  "muted_jazz_guitar",
  "lofi_warm_pad",
  "chip_square_stack",
  "chip_triangle_pad",
  "chip_arp_keys",
  "modern_chip_poly",
  "metal_power_stack",
  "dark_organ_stack",
  "funk_clav_stab",
  "funk_rhodes_stab",
  "funk_brass_stack",
  "western_saloon_piano",
  "western_mandolin_chop"
]);
var DEFAULT_CHORD_INSTRUMENT = "pocket";
var POCKET_MELODY_INSTRUMENTS = Object.freeze([
  "pulse",
  "soft",
  "synth",
  "bell",
  "lead_guitar",
  "distorted_lead_guitar",
  "banjo",
  "harmonica",
  "cowboy_whistle",
  "trumpet",
  "saxophone",
  "mellow_vibes",
  "soft_pluck",
  "mellow_sax",
  "muted_trumpet",
  "tape_bell",
  "chip_square_lead",
  "chip_pulse_lead",
  "chip_triangle_blip",
  "chip_bell_stack",
  "modern_chip_lead",
  "shred_lead_guitar",
  "twin_harmony_lead",
  "funk_muted_trumpet",
  "funk_sax_punch",
  "western_harmonica",
  "western_banjo",
  "western_fiddle"
]);
var DEFAULT_MELODY_INSTRUMENT = "pulse";
var CLASSIC_CHORD_INSTRUMENT_CONFIGS = Object.freeze({
  pocket: Object.freeze({
    rootWave: "triangle",
    wave: "sine",
    peak: 0.24,
    filter: "lowpass",
    freq: 1800,
    filterQ: 0.8,
    attack: 0.01,
    decay: 0.06,
    sustain: 0.7,
    release: 0.2,
    durMul: 1,
    spreadMul: 1,
    shimmer: false,
    maxLiveDur: 1.15,
    layers: Object.freeze([
      Object.freeze({ wave: "triangle", level: 0.82 }),
      Object.freeze({ wave: "sine", level: 0.35 })
    ])
  }),
  piano: Object.freeze({
    rootWave: "triangle",
    wave: "triangle",
    peak: 0.23,
    filter: "lowpass",
    freq: 3100,
    filterQ: 0.9,
    attack: 3e-3,
    decay: 0.18,
    sustain: 0.18,
    release: 0.16,
    durMul: 0.72,
    spreadMul: 0.45,
    shimmer: false,
    maxLiveDur: 0.82,
    layers: Object.freeze([
      Object.freeze({ wave: "triangle", level: 1 }),
      Object.freeze({ wave: "sine", freqMul: 2, level: 0.18, detune: 3 })
    ])
  }),
  saloon_piano: Object.freeze({
    rootWave: "triangle",
    wave: "triangle",
    peak: 0.205,
    filter: "lowpass",
    freq: 3600,
    filterQ: 1,
    attack: 2e-3,
    decay: 0.13,
    sustain: 0.12,
    release: 0.18,
    durMul: 0.62,
    spreadMul: 0.58,
    shimmer: false,
    maxLiveDur: 0.7,
    layers: Object.freeze([
      Object.freeze({ wave: "triangle", level: 0.88, detune: -8 }),
      Object.freeze({ wave: "triangle", level: 0.62, detune: 9 }),
      Object.freeze({ wave: "sine", freqMul: 2, level: 0.16, detune: 5 })
    ])
  }),
  harp: Object.freeze({
    rootWave: "triangle",
    wave: "sine",
    peak: 0.18,
    filter: "lowpass",
    freq: 4600,
    filterQ: 1.4,
    attack: 2e-3,
    decay: 0.1,
    sustain: 0.03,
    release: 0.36,
    durMul: 0.5,
    spreadMul: 1.45,
    shimmer: true,
    maxLiveDur: 0.58,
    layers: Object.freeze([
      Object.freeze({ wave: "triangle", level: 0.9 }),
      Object.freeze({ wave: "sine", freqMul: 2, level: 0.26, detune: 7 })
    ])
  }),
  warm_pad: Object.freeze({
    rootWave: "sine",
    wave: "triangle",
    peak: 0.14,
    filter: "lowpass",
    freq: 1200,
    filterQ: 0.65,
    filterSweep: 1700,
    attack: 0.11,
    decay: 0.24,
    sustain: 0.82,
    release: 0.62,
    durMul: 1.35,
    spreadMul: 0.25,
    shimmer: false,
    maxLiveDur: 1.65,
    layers: Object.freeze([
      Object.freeze({ wave: "sine", level: 0.95, detune: -5 }),
      Object.freeze({ wave: "triangle", level: 0.48, detune: 6 })
    ])
  }),
  glass: Object.freeze({
    rootWave: "sine",
    wave: "sine",
    peak: 0.16,
    filter: "bandpass",
    freq: 1500,
    filterQ: 1.15,
    attack: 4e-3,
    decay: 0.2,
    sustain: 0.1,
    release: 0.44,
    durMul: 0.9,
    spreadMul: 0.85,
    shimmer: true,
    maxLiveDur: 0.82,
    layers: Object.freeze([
      Object.freeze({ wave: "sine", level: 0.36 }),
      Object.freeze({ wave: "sine", freqMul: 2.01, level: 0.64 }),
      Object.freeze({ wave: "sine", freqMul: 4.02, level: 0.34 }),
      Object.freeze({ wave: "triangle", freqMul: 6.01, level: 0.12 })
    ])
  })
});
var POCKET_CHORD_INSTRUMENT_CONFIGS = Object.freeze({
  ...CLASSIC_CHORD_INSTRUMENT_CONFIGS,
  ...LOFI_CHORD_INSTRUMENT_CONFIGS,
  ...CHIP_CHORD_INSTRUMENT_CONFIGS,
  ...METAL_CHORD_INSTRUMENT_CONFIGS,
  ...FUNK_CHORD_INSTRUMENT_CONFIGS,
  ...WESTERN_CHORD_INSTRUMENT_CONFIGS
});
var CLASSIC_LEAD_INSTRUMENT_CONFIGS = Object.freeze({
  pulse: Object.freeze({
    wave: "square",
    peak: 0.2,
    filter: "lowpass",
    freq: 2300,
    durMul: 1
  }),
  soft: Object.freeze({
    wave: "triangle",
    peak: 0.16,
    filter: "lowpass",
    freq: 1700,
    durMul: 1
  }),
  synth: Object.freeze({
    wave: "sawtooth",
    peak: 0.18,
    filter: "lowpass",
    freq: 1500,
    durMul: 0.95
  }),
  bell: Object.freeze({
    wave: "sine",
    peak: 0.105,
    filter: "lowpass",
    freq: 2600,
    durMul: 1.05,
    extras: Object.freeze([
      Object.freeze({ freqMul: 2, wave: "sine", peak: 0.022, peakScale: 0.16, filter: "lowpass", freq: 3200, offset: 0.012, durMul: 0.42 })
    ])
  }),
  lead_guitar: Object.freeze({
    wave: "sawtooth",
    peak: 0.16,
    filter: "bandpass",
    freq: 1800,
    durMul: 0.92,
    extras: Object.freeze([
      Object.freeze({ freqMul: 1.006, wave: "square", peak: 0.035, peakScale: 0.2, filter: "lowpass", freq: 2600, offset: 6e-3, durMul: 0.72 })
    ])
  }),
  distorted_lead_guitar: Object.freeze({
    wave: "sawtooth",
    peak: 0.13,
    filter: "lowpass",
    freq: 2400,
    durMul: 0.86,
    extras: Object.freeze([
      Object.freeze({ freqMul: 0.996, wave: "square", peak: 0.05, peakScale: 0.34, filter: "bandpass", freq: 2100, offset: 4e-3, durMul: 0.68 })
    ])
  }),
  banjo: Object.freeze({
    wave: "triangle",
    peak: 0.13,
    filter: "bandpass",
    freq: 2100,
    durMul: 0.48,
    extras: Object.freeze([
      Object.freeze({ freqMul: 2.01, wave: "triangle", peak: 0.028, peakScale: 0.18, filter: "highpass", freq: 1500, offset: 4e-3, durMul: 0.38, maxDur: 0.09 }),
      Object.freeze({ freqMul: 0.997, wave: "square", peak: 0.018, peakScale: 0.13, filter: "bandpass", freq: 2600, offset: 0.012, durMul: 0.48, maxDur: 0.13 })
    ])
  }),
  harmonica: Object.freeze({
    wave: "square",
    peak: 0.115,
    filter: "bandpass",
    freq: 1250,
    durMul: 1.18,
    extras: Object.freeze([
      Object.freeze({ freqMul: 1.004, wave: "triangle", peak: 0.035, peakScale: 0.24, filter: "bandpass", freq: 860, offset: 6e-3, durMul: 0.92 }),
      Object.freeze({ freqMul: 2, wave: "square", peak: 0.012, peakScale: 0.08, filter: "bandpass", freq: 2100, offset: 0.014, durMul: 0.42 })
    ])
  }),
  cowboy_whistle: Object.freeze({
    wave: "sine",
    peak: 0.1,
    filter: "lowpass",
    freq: 3200,
    durMul: 1.12,
    extras: Object.freeze([
      Object.freeze({ freqMul: 2, wave: "sine", peak: 0.014, peakScale: 0.14, filter: "lowpass", freq: 3600, offset: 0.01, durMul: 0.65 })
    ])
  }),
  trumpet: Object.freeze({
    wave: "square",
    peak: 0.14,
    filter: "bandpass",
    freq: 1650,
    durMul: 1.05,
    extras: Object.freeze([
      Object.freeze({ freqMul: 1, slideFreqMul: 2, midiOffset: 12, wave: "sawtooth", peak: 0.018, peakScale: 0.13, filter: "bandpass", freq: 2400, offset: 8e-3, durMul: 0.35 })
    ])
  }),
  saxophone: Object.freeze({
    wave: "triangle",
    peak: 0.17,
    filter: "bandpass",
    freq: 940,
    durMul: 1.12,
    extras: Object.freeze([
      Object.freeze({ freqMul: 1, slideFreqMul: 0.5, midiOffset: -12, wave: "sine", peak: 0.03, peakScale: 0.18, filter: "lowpass", freq: 760, offset: 4e-3, durMul: 0.42 })
    ])
  })
});
var POCKET_LEAD_INSTRUMENT_CONFIGS = Object.freeze({
  ...CLASSIC_LEAD_INSTRUMENT_CONFIGS,
  ...LOFI_LEAD_INSTRUMENT_CONFIGS,
  ...CHIP_LEAD_INSTRUMENT_CONFIGS,
  ...METAL_LEAD_INSTRUMENT_CONFIGS,
  ...FUNK_LEAD_INSTRUMENT_CONFIGS,
  ...WESTERN_LEAD_INSTRUMENT_CONFIGS
});
function findPocketChordInstrumentConfig(name) {
  return POCKET_CHORD_INSTRUMENT_CONFIGS[name] || POCKET_CHORD_INSTRUMENT_CONFIGS[DEFAULT_CHORD_INSTRUMENT];
}
function findPocketLeadInstrumentConfig(name) {
  return POCKET_LEAD_INSTRUMENT_CONFIGS[name] || POCKET_LEAD_INSTRUMENT_CONFIGS[DEFAULT_MELODY_INSTRUMENT];
}
function pocketLeadExtraLayers(config) {
  if (!config) return [];
  if (Array.isArray(config.extras)) return config.extras;
  if (config.extra) return [config.extra];
  return [];
}
function validatePocketInstrumentRegistry() {
  return {
    missingChordConfigs: POCKET_CHORD_INSTRUMENTS.filter((id) => !POCKET_CHORD_INSTRUMENT_CONFIGS[id]),
    missingLeadConfigs: POCKET_MELODY_INSTRUMENTS.filter((id) => !POCKET_LEAD_INSTRUMENT_CONFIGS[id])
  };
}

// src/patterns/drum-presets.js
var DRUM_PRESETS = [
  { id: "money", label: "Basic rock", label3: "Waltz", simple4: true, simple3: true, timeSigs: [3, 4], tip: "Standard money beat: kick on 1 and 3, snare on 2 and 4, hats on eighths where the grid allows." },
  { id: "boom_chick", label: "Boom-chick", simple4: true, simple3: false, timeSigs: [4], tip: "Western boom-chick groove with bass-drum booms and snare/hat chicks." },
  { id: "train_beat", label: "Train beat", simple4: false, simple3: false, timeSigs: [4], tip: "Rolling train beat with steady hats and alternating kick/snare push." },
  { id: "cowboy_waltz", label: "Cowboy waltz", simple4: false, simple3: true, timeSigs: [3], tip: "Gentle 3/4 western waltz with a strong first beat and brushed backbeats." },
  { id: "rock", label: "Classic rock", label3: "3/4 rock", simple4: false, simple3: false, timeSigs: [3, 4], tip: "Busier classic rock with an extra kick on the and of 2." },
  { id: "sync_rock", label: "Sync rock", simple4: false, simple3: false, timeSigs: [4], tip: "Syncopated rock with sixteenth kick pickup into beat 2 on fine grids." },
  { id: "four_floor", label: "Four-on-floor", label3: "Three-on-floor", simple4: true, simple3: true, timeSigs: [3, 4], tip: "Kick on every beat with snare backbeat and offbeat hat accents where available." },
  { id: "dance", label: "Dance/house", simple4: false, simple3: false, timeSigs: [4], tip: "House-style four-on-floor with offbeat open-hat accents, not a filled sixteenth pattern." },
  { id: "half_time", label: "Half-time", simple4: true, simple3: false, timeSigs: [4], tip: "Half-time rock with the main snare on beat 3." },
  { id: "half_time_16", label: "Half-time 16ths", simple4: false, simple3: false, timeSigs: [4], tip: "Half-time groove with sixteenth-note hat motion and light ghost-snare approximations on fine grids." },
  { id: "punk", label: "Punk eighths", simple4: false, simple3: false, timeSigs: [4], tip: "Driving punk eighths with kick on every beat and snare on 2 and 4." },
  { id: "punk_double", label: "Double-time punk", simple4: false, simple3: false, timeSigs: [4], tip: "Double-time punk feel with the snare on eighth-note offbeats." },
  { id: "metal", label: "Metal chug", simple4: false, simple3: false, timeSigs: [4], tip: "Metal kick chug pattern with snare on 2 and 4." },
  { id: "blast", label: "Traditional blast", simple4: false, simple3: false, timeSigs: [4], tip: "Traditional/Euro blast: snare on the even sixteenth positions, kick and hat alternating between them on fine grids." },
  { id: "ghost", label: "Ghost groove", simple4: false, simple3: false, timeSigs: [4], tip: "Classic backbeat with normal snare hits approximating ghost notes below the accented 2 and 4." },
  { id: "ballad", label: "Ballad rock", label3: "3/4 ballad", simple4: false, simple3: true, timeSigs: [3, 4], tip: "Slower ballad-rock backbeat with restrained hats." },
  { id: "lofi_backbeat_76", label: "Lofi backbeat", simple4: true, simple3: false, timeSigs: [4], tip: "Soft swung chillhop backbeat with a rounded kick, rim-like snare and alternating hats." },
  { id: "lofi_lazy_boom_bap", label: "Lazy boom-bap", simple4: false, simple3: false, timeSigs: [4], tip: "Behind-the-grid boom-bap feel for train-window and streetlight loops." },
  { id: "lofi_half_time_soft", label: "Soft half-time", simple4: true, simple3: false, timeSigs: [4], tip: "Very gentle half-time pocket with sparse hats." },
  { id: "lofi_brush_shuffle", label: "Brush shuffle", simple4: false, simple3: false, timeSigs: [4], tip: "Brushy, humanised hat/snare motion for rainy lofi beds." },
  { id: "lofi_sparse_clicks", label: "Sparse clicks", simple4: true, simple3: false, timeSigs: [4], tip: "Minimal percussion for garden, menu and background game loops." },
  { id: "lofi_sleepy_waltz_3_4", label: "Sleepy waltz", simple4: false, simple3: true, timeSigs: [3], tip: "Sparse 3/4 lofi brush pattern for sleepy waltz loops." },
  { id: "chip_run_128", label: "Chip run", simple4: true, simple3: false, timeSigs: [4], tip: "Classic running game pulse with driving hats, simple backbeat and bright kick movement." },
  { id: "chip_menu_bounce", label: "Chip menu bounce", simple4: true, simple3: false, timeSigs: [4], tip: "Bouncy menu rhythm with light kicks, snare taps and cheerful offbeat hats." },
  { id: "chip_boss_half_time", label: "Chip boss half-time", simple4: true, simple3: false, timeSigs: [4], tip: "Half-time boss groove with heavy kick/snare anchors and tight noise hats." },
  { id: "chip_arp_jam", label: "Chip arp jam", simple4: false, simple3: false, timeSigs: [4], tip: "Modern chip jam groove with 16th-note motion, syncopated kicks and punchy backbeat." },
  { id: "chip_dungeon_shuffle", label: "Chip dungeon shuffle", simple4: false, simple3: false, timeSigs: [4], tip: "Uneasy dungeon shuffle with staggered hats and minor-key movement." },
  { id: "chip_victory_stomp", label: "Chip victory stomp", simple4: true, simple3: false, timeSigs: [4], tip: "Bright victory stomp with accented hats, arcade kick hits and payoff snare." },
  { id: "metal_backbeat_chug", label: "Metal backbeat chug", simple4: false, simple3: false, timeSigs: [4], tip: "Tight metal backbeat with kick doubles that follow palm-muted chugs." },
  { id: "metal_gallop_160", label: "Metal gallop 160", simple4: false, simple3: false, timeSigs: [4], tip: "Thrash gallop kick language with driving hats and strong backbeat." },
  { id: "metal_double_kick_drive", label: "Double-kick drive", simple4: false, simple3: false, timeSigs: [4], tip: "Continuous double-kick drive under a clear snare anchor." },
  { id: "metal_blast_220", label: "Blast 220", simple4: false, simple3: false, timeSigs: [4], tip: "Blast-beat approximation for fine grids, with safer lower-resolution fallbacks." },
  { id: "metal_doom_70", label: "Doom 70", simple4: true, simple3: false, timeSigs: [4], tip: "Slow doom procession with sparse cymbals and a long low kick." },
  { id: "metal_breakdown_half_time", label: "Breakdown half-time", simple4: true, simple3: false, timeSigs: [4], tip: "Half-time breakdown with gated kick/snare impacts." }
];
function drumHits(track, pos16, level = 1, options = {}) {
  return pos16.map((pos) => ({ track, pos16: pos, level, ...options }));
}
function drumGroove(...groups) {
  return groups.flat();
}
function drumAccentHits(track, pos16, accentPos16) {
  return drumGroove(drumHits(track, pos16, 1), drumHits(track, accentPos16, 2));
}
var DRUM_PATTERN_DEFS = {
  4: {
    money: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12], 2)),
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12], 2)),
      res4: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12], 2))
    },
    boom_chick: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 8], 2), drumHits("snare", [4, 12])),
      res2: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [4, 12]), drumHits("kick", [0, 8], 2), drumHits("snare", [4, 12])),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [4, 12]), drumHits("kick", [0, 8], 2), drumHits("snare", [4, 12]), drumHits("snare", [6, 14], 1, { minRes: 4 }))
    },
    train_beat: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12])),
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 6, 8, 14]), drumHits("snare", [4, 12])),
      res4: drumGroove(drumAccentHits("hat", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [0, 4, 8, 12]), drumHits("kick", [0, 3, 6, 8, 11, 14], 1, { minRes: 4 }), drumHits("snare", [4, 7, 12, 15]))
    },
    rock: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12], 2)),
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 6, 8]), drumHits("snare", [4, 12], 2)),
      res4: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 6, 8]), drumHits("snare", [4, 12], 2))
    },
    sync_rock: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12], 2)),
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 6, 8, 10]), drumHits("snare", [4, 12], 2)),
      res4: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 3, 6, 8, 10], 1, { minRes: 4 }), drumHits("snare", [4, 12], 2))
    },
    four_floor: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [4, 12], 2)),
      res2: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [2, 6, 10, 14]), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [4, 12], 2)),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [2, 6, 10, 14]), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [4, 12], 2))
    },
    dance: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [4, 12], 2)),
      res2: drumGroove(drumHits("hat", [2, 6, 10, 14], 2), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [4, 12], 2)),
      res4: drumGroove(drumHits("hat", [2, 6, 10, 14], 2), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [4, 12], 2))
    },
    half_time: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0]), drumHits("snare", [8], 2)),
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 6, 10]), drumHits("snare", [8], 2)),
      res4: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 6, 10]), drumHits("snare", [8], 2))
    },
    half_time_16: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0]), drumHits("snare", [8], 2)),
      res1Note: "Simplified to half-time rock at this resolution.",
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 6, 10]), drumHits("snare", [8], 2)),
      res2Note: "Simplified to half-time rock at this resolution.",
      res4: drumGroove(drumAccentHits("hat", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [0, 4, 8, 12]), drumHits("kick", [0, 6, 10]), drumHits("snare", [8], 2), drumHits("snare", [5, 7, 13, 15], 1, { minRes: 4 }))
    },
    punk: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12], 2), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [4, 12], 2)),
      res2: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 8, 12]), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [4, 12], 2)),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 8, 12]), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [4, 12], 2))
    },
    punk_double: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12], 2), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [4, 12], 2)),
      res1Note: "Simplified because Full resolution cannot place eighth-note offbeat snares.",
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [2, 6, 10, 14], 2)),
      res4: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [2, 6, 10, 14], 2))
    },
    metal: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 8, 12]), drumHits("snare", [4, 12], 2)),
      res2: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 8, 12]), drumHits("kick", [0, 2, 8, 10, 12]), drumHits("snare", [4, 12], 2)),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 8, 12]), drumHits("kick", [0, 1, 2, 3, 8, 9, 10, 11, 12, 14], 1, { minRes: 4 }), drumHits("snare", [4, 12], 2))
    },
    blast: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12], 2), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [4, 12], 2)),
      res1Note: "Simplified aggressive-rock fallback because Full resolution cannot represent a blast beat.",
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [2, 6, 10, 14], 2)),
      res2Note: "Using a skank/double-time fallback at this resolution.",
      res4: drumGroove(drumAccentHits("snare", [0, 2, 4, 6, 8, 10, 12, 14], [0, 8]), drumHits("kick", [1, 3, 5, 7, 9, 11, 13, 15], 1, { minRes: 4 }), drumHits("hat", [1, 3, 5, 7, 9, 11, 13, 15], 1, { minRes: 4 }))
    },
    ghost: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12], 2)),
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 6, 8, 10]), drumHits("snare", [4, 12], 2)),
      res4: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 6, 8, 10]), drumHits("snare", [4, 12], 2), drumHits("snare", [3, 7, 11, 15], 1, { minRes: 4 }))
    },
    ballad: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12], 2)),
      res2: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12], 2)),
      res4: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12], 2))
    },
    lofi_backbeat_76: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12])),
      res2: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 8]), drumHits("kick", [0, 6, 8]), drumHits("snare", [4, 12])),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 8]), drumHits("kick", [0, 6, 8, 11]), drumHits("snare", [4, 12]), drumHits("snare", [7, 15], 1, { minRes: 4 }))
    },
    lofi_lazy_boom_bap: {
      res1: drumGroove(drumHits("hat", [0, 8]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12])),
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 3, 8, 10], 1, { minRes: 2 }), drumHits("snare", [4, 12])),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [2, 10]), drumHits("kick", [0, 3, 8, 10], 1, { minRes: 2 }), drumHits("snare", [4, 12]), drumHits("snare", [6, 14], 1, { minRes: 4 }))
    },
    lofi_half_time_soft: {
      res1: drumGroove(drumHits("hat", [0, 8]), drumHits("kick", [0]), drumHits("snare", [8])),
      res2: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 6]), drumHits("snare", [8])),
      res4: drumGroove(drumHits("hat", [0, 2, 4, 8, 10, 12]), drumHits("kick", [0, 6, 11], 1, { minRes: 4 }), drumHits("snare", [8]), drumHits("snare", [14], 1, { minRes: 4 }))
    },
    lofi_brush_shuffle: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0]), drumHits("snare", [4, 12])),
      res2: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [4, 12]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12])),
      res4: drumGroove(drumAccentHits("hat", [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15], [4, 12]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12]), drumHits("snare", [6, 14], 1, { minRes: 4 }))
    },
    lofi_sparse_clicks: {
      res1: drumGroove(drumHits("hat", [0, 8]), drumHits("kick", [0])),
      res2: drumGroove(drumHits("hat", [0, 6, 8, 14]), drumHits("kick", [0, 10]), drumHits("snare", [12])),
      res4: drumGroove(drumHits("hat", [0, 5, 8, 13]), drumHits("kick", [0, 10]), drumHits("snare", [12]), drumHits("hat", [15], 2, { minRes: 4 }))
    },
    chip_run_128: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12], 2), drumHits("kick", [0, 8]), drumHits("snare", [4, 12], 2)),
      res2: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 8]), drumHits("kick", [0, 6, 8, 14]), drumHits("snare", [4, 12], 2)),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 8, 12]), drumHits("kick", [0, 3, 6, 8, 11, 14], 1, { minRes: 4 }), drumHits("snare", [4, 12], 2))
    },
    chip_menu_bounce: {
      res1: drumGroove(drumHits("hat", [0, 8]), drumHits("kick", [0]), drumHits("snare", [8])),
      res2: drumGroove(drumHits("hat", [0, 2, 6, 8, 10, 14]), drumHits("kick", [0, 6, 10]), drumHits("snare", [8])),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 6, 8, 10, 14], [2, 10]), drumHits("kick", [0, 6, 10]), drumHits("snare", [8]), drumHits("hat", [15], 2, { minRes: 4 }))
    },
    chip_boss_half_time: {
      res1: drumGroove(drumHits("hat", [0, 8]), drumHits("kick", [0, 12]), drumHits("snare", [8], 2)),
      res2: drumGroove(drumHits("hat", [0, 2, 4, 8, 10, 12]), drumHits("kick", [0, 6, 12]), drumHits("snare", [8], 2)),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 8]), drumHits("kick", [0, 3, 6, 11, 12], 1, { minRes: 4 }), drumHits("snare", [8], 2), drumHits("snare", [15], 1, { minRes: 4 }))
    },
    chip_arp_jam: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 8]), drumHits("snare", [4, 12], 2)),
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 3, 8, 10], 1, { minRes: 2 }), drumHits("snare", [4, 12], 2)),
      res4: drumGroove(drumAccentHits("hat", [0, 1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 14], [0, 8]), drumHits("kick", [0, 3, 8, 10, 13], 1, { minRes: 4 }), drumHits("snare", [4, 12], 2), drumHits("snare", [7, 15], 1, { minRes: 4 }))
    },
    chip_dungeon_shuffle: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 8]), drumHits("snare", [12])),
      res2: drumGroove(drumHits("hat", [0, 2, 5, 8, 10, 13]), drumHits("kick", [0, 7, 10]), drumHits("snare", [4, 12])),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 5, 8, 10, 13, 15], [5, 13]), drumHits("kick", [0, 7, 10], 1, { minRes: 4 }), drumHits("snare", [4, 12]), drumHits("snare", [14], 1, { minRes: 4 }))
    },
    chip_victory_stomp: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12], 2), drumHits("kick", [0, 4, 8]), drumHits("snare", [12], 2)),
      res2: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 8, 12]), drumHits("kick", [0, 4, 8, 10]), drumHits("snare", [12], 2)),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 8, 12]), drumHits("kick", [0, 3, 4, 8, 10], 1, { minRes: 4 }), drumHits("snare", [12], 2), drumHits("snare", [15], 1, { minRes: 4 }))
    },
    metal_backbeat_chug: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 8, 12]), drumHits("snare", [4, 12], 2)),
      res2: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 8, 12]), drumHits("kick", [0, 2, 8, 10, 12, 14]), drumHits("snare", [4, 12], 2)),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 8, 12]), drumHits("kick", [0, 1, 2, 3, 8, 9, 10, 11, 12, 14], 1, { minRes: 4 }), drumHits("snare", [4, 12], 2))
    },
    metal_gallop_160: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12], 2), drumHits("kick", [0, 8]), drumHits("snare", [4, 12], 2)),
      res2: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 8]), drumHits("kick", [0, 2, 6, 8, 10, 14]), drumHits("snare", [4, 12], 2)),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 8]), drumHits("kick", [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15], 1, { minRes: 4 }), drumHits("snare", [4, 12], 2))
    },
    metal_double_kick_drive: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12]), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [4, 12], 2)),
      res2: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 8, 12]), drumHits("kick", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("snare", [4, 12], 2)),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 8, 12]), drumHits("kick", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 1, { minRes: 4 }), drumHits("snare", [4, 12], 2))
    },
    metal_blast_220: {
      res1: drumGroove(drumHits("hat", [0, 4, 8, 12], 2), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [4, 12], 2)),
      res1Note: "Simplified because Full resolution cannot represent a blast beat.",
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10, 12, 14]), drumHits("kick", [0, 4, 8, 12]), drumHits("snare", [2, 6, 10, 14], 2)),
      res2Note: "Using a skank/double-time fallback at this resolution.",
      res4: drumGroove(drumAccentHits("snare", [0, 2, 4, 6, 8, 10, 12, 14], [0, 8]), drumHits("kick", [1, 3, 5, 7, 9, 11, 13, 15], 1, { minRes: 4 }), drumHits("hat", [1, 3, 5, 7, 9, 11, 13, 15], 1, { minRes: 4 }))
    },
    metal_doom_70: {
      res1: drumGroove(drumHits("hat", [0, 8]), drumHits("kick", [0]), drumHits("snare", [8], 2)),
      res2: drumGroove(drumHits("hat", [0, 8, 14]), drumHits("kick", [0, 10]), drumHits("snare", [8], 2)),
      res4: drumGroove(drumHits("hat", [0, 8, 14]), drumHits("kick", [0, 10]), drumHits("snare", [8], 2), drumHits("hat", [15], 2, { minRes: 4 }))
    },
    metal_breakdown_half_time: {
      res1: drumGroove(drumHits("hat", [0, 8]), drumHits("kick", [0, 12]), drumHits("snare", [8], 2)),
      res2: drumGroove(drumHits("hat", [0, 8]), drumHits("kick", [0, 3, 8, 12]), drumHits("snare", [8], 2)),
      res4: drumGroove(drumHits("hat", [0, 8]), drumHits("kick", [0, 3, 8, 10, 12], 1, { minRes: 4 }), drumHits("snare", [8], 2), drumHits("snare", [15], 1, { minRes: 4 }))
    }
  },
  3: {
    money: {
      res1: drumGroove(drumHits("hat", [0, 4, 8]), drumHits("kick", [0], 2), drumHits("snare", [4, 8])),
      res2: drumGroove(drumHits("hat", [0, 4, 8]), drumHits("kick", [0], 2), drumHits("snare", [4, 8])),
      res4: drumGroove(drumHits("hat", [0, 4, 8]), drumHits("kick", [0], 2), drumHits("snare", [4, 8]))
    },
    cowboy_waltz: {
      res1: drumGroove(drumHits("hat", [0, 4, 8]), drumHits("kick", [0], 2), drumHits("snare", [4, 8])),
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10]), drumHits("kick", [0], 2), drumHits("snare", [4, 8])),
      res4: drumGroove(drumAccentHits("hat", [0, 2, 4, 6, 8, 10], [0]), drumHits("kick", [0], 2), drumHits("snare", [4, 8]), drumHits("snare", [6, 10], 1, { minRes: 4 }))
    },
    rock: {
      res1: drumGroove(drumHits("hat", [0, 4, 8]), drumHits("kick", [0]), drumHits("snare", [8], 2)),
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10]), drumHits("kick", [0, 6]), drumHits("snare", [8], 2)),
      res4: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10]), drumHits("kick", [0, 6]), drumHits("snare", [8], 2))
    },
    four_floor: {
      res1: drumGroove(drumHits("hat", [0, 4, 8]), drumHits("kick", [0, 4, 8]), drumHits("snare", [8], 2)),
      res2: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10]), drumHits("kick", [0, 4, 8]), drumHits("snare", [8], 2)),
      res4: drumGroove(drumHits("hat", [0, 2, 4, 6, 8, 10]), drumHits("kick", [0, 4, 8]), drumHits("snare", [8], 2))
    },
    ballad: {
      res1: drumGroove(drumHits("hat", [0, 4, 8]), drumHits("kick", [0]), drumHits("snare", [8], 2)),
      res2: drumGroove(drumHits("hat", [0, 4, 8]), drumHits("kick", [0]), drumHits("snare", [8], 2)),
      res4: drumGroove(drumHits("hat", [0, 4, 8]), drumHits("kick", [0]), drumHits("snare", [8], 2))
    },
    lofi_sleepy_waltz_3_4: {
      res1: drumGroove(drumHits("hat", [0, 8]), drumHits("kick", [0]), drumHits("snare", [8])),
      res2: drumGroove(drumHits("hat", [0, 4, 8]), drumHits("kick", [0]), drumHits("snare", [8])),
      res4: drumGroove(drumHits("hat", [0, 4, 8]), drumHits("kick", [0]), drumHits("snare", [8]), drumHits("hat", [10], 1, { minRes: 4 }))
    }
  }
};
function drumPresetVisibleForProject(preset, pcs) {
  return Array.isArray(preset.timeSigs) ? preset.timeSigs.includes(pcs.timeSig) : true;
}
function visibleDrumPresetsForProject(pcs) {
  return DRUM_PRESETS.filter((preset) => drumPresetVisibleForProject(preset, pcs));
}
function drumPresetLabel(preset, pcs) {
  return pcs.timeSig === 3 ? preset.label3 || preset.label : preset.label;
}
function findDrumPreset(presetId) {
  return DRUM_PRESETS.find((preset) => preset.id === presetId) || null;
}
function drumPresetEventsForProject(presetId, pcs) {
  const bySig = DRUM_PATTERN_DEFS[pcs.timeSig] || {};
  const def = bySig[presetId] || bySig.money || DRUM_PATTERN_DEFS[4].money;
  const key = drumPresetResolutionKey(def, pcs.resolution);
  return {
    events: Array.isArray(def[key]) ? def[key] || [] : [],
    note: def[`${key}Note`] || ""
  };
}
function shouldUsePresetEvent(event2, resolution) {
  if (event2.minRes && resolution < event2.minRes) return false;
  if (event2.maxRes && resolution > event2.maxRes) return false;
  return true;
}
function pos16ToStep(bar, pos16, pcs, totalSteps) {
  const beat = Math.floor(pos16 / 4);
  if (beat < 0 || beat >= pcs.timeSig) return -1;
  const fraction = pos16 % 4 / 4;
  if (fraction > 0 && pcs.resolution <= 1) return -1;
  const base = (bar * pcs.timeSig + beat) * pcs.resolution;
  const offset = fraction > 0 ? clamp(Math.round(fraction * pcs.resolution), 0, Math.max(0, pcs.resolution - 1)) : 0;
  const step = base + offset;
  return step >= 0 && step < totalSteps ? step : -1;
}
function drumPresetResolutionKey(def, resolution) {
  if (resolution >= 4 && def.res4) return "res4";
  if (resolution >= 2 && def.res2) return "res2";
  if (def.res1) return "res1";
  if (def.res2) return "res2";
  return "res4";
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// src/patterns/guitar-presets.js
var GUITAR_PRESETS = Object.freeze([
  { id: "rock_eighths", label: "Rock 8ths", tip: "Eighth-note rock strums with accents on bar starts." },
  { id: "punk_downstrokes", label: "Punk", tip: "Tight palm-muted downstrokes with beat accents." },
  { id: "metal_chug", label: "Metal chug", tip: "Fast chug rhythm with accents on each beat." },
  { id: "gallop", label: "Gallop", tip: "Three-note metal gallop grouped across sixteenth subdivisions." },
  { id: "doom_slow", label: "Doom", tip: "Slow sustained power chords on strong beats." },
  { id: "thrash_gallop", label: "Thrash gallop", tip: "Fast palm-muted gallops with hard beat accents." },
  { id: "tremolo_drive", label: "Tremolo drive", tip: "Dense tremolo-style sixteenths for boss or blast sections." },
  { id: "breakdown_stabs", label: "Breakdown stabs", tip: "Half-time stop/start chugs with silence between impacts." },
  { id: "verse_chorus", label: "Verse/chorus", tip: "Open verse strums followed by a tighter chug section." },
  { id: "boom_chick", label: "Boom-chick", tip: "Western boom-chick accents with percussive scratches." },
  { id: "train_chop", label: "Train chop", tip: "Driving chop pattern with alternating chugs and open strums." },
  { id: "western_waltz", label: "Western waltz", tip: "Waltz-friendly accent and scratch pattern." }
]);
function findGuitarPreset(presetId) {
  return GUITAR_PRESETS.find((preset) => preset.id === presetId) || null;
}
function guitarPresetLabel(preset) {
  return preset?.label || String(preset?.id || "Guitar preset").replace(/_/g, " ");
}
function guitarPresetVisibleForProject(preset) {
  return !!preset;
}
function visibleGuitarPresetsForProject() {
  return GUITAR_PRESETS.slice();
}
function normalizeGuitarArticulation(value) {
  const safe = String(value || "off").toLowerCase();
  if (safe === "mute" || safe === "palm" || safe === "pm") return "chug";
  if (safe === "sustain") return "hold";
  if (safe === "dead" || safe === "dead_mute") return "scratch";
  return POCKET_GUITAR_ARTICULATIONS.includes(safe) ? safe : "off";
}
function guitarPresetPatternForProject(presetId, pcs, section) {
  const preset = findGuitarPreset(presetId) || findGuitarPreset("metal_chug");
  const timeSig = safePositiveInt(pcs?.timeSig, 4);
  const resolution = safePositiveInt(pcs?.resolution, 4);
  const bars = safePositiveInt(section?.bars, 4);
  const stepCount = Math.max(1, bars * timeSig * resolution);
  const pattern2 = new Array(stepCount).fill("off");
  const eighth = Math.max(1, Math.round(resolution / 2));
  const beat = Math.max(1, resolution);
  const barSteps = Math.max(1, timeSig * resolution);
  for (let step = 0; step < stepCount; step += 1) {
    const pos = step % barSteps;
    if (preset.id === "rock_eighths") {
      if (step % eighth === 0) pattern2[step] = pos === 0 ? "accent" : "open";
    } else if (preset.id === "punk_downstrokes") {
      if (step % eighth === 0) pattern2[step] = "chug";
      if (pos === 0 || pos === beat * 2) pattern2[step] = "accent";
    } else if (preset.id === "metal_chug") {
      if (step % Math.max(1, Math.round(resolution / 4)) === 0) {
        pattern2[step] = pos % beat === 0 ? "accent" : "chug";
      }
    } else if (preset.id === "gallop") {
      const unit = Math.max(1, Math.round(resolution / 4));
      const slot = Math.floor(pos / unit) % 4;
      if (slot === 0 || slot === 1 || slot === 3) pattern2[step] = slot === 0 ? "accent" : "chug";
    } else if (preset.id === "doom_slow") {
      if (pos === 0 || pos === beat * 2) pattern2[step] = "accent";
      else if (pos > 0) pattern2[step] = "hold";
    } else if (preset.id === "thrash_gallop") {
      const unit = Math.max(1, Math.round(resolution / 4));
      if (step % unit === 0) {
        const slot = Math.floor(pos / unit) % 8;
        if ([0, 1, 3, 4, 5, 7].includes(slot)) pattern2[step] = slot === 0 || slot === 4 ? "accent" : "chug";
      }
    } else if (preset.id === "tremolo_drive") {
      if (step % Math.max(1, Math.round(resolution / 4)) === 0) {
        pattern2[step] = pos % beat === 0 ? "accent" : "chug";
      }
    } else if (preset.id === "breakdown_stabs") {
      const unit = Math.max(1, Math.round(resolution / 4));
      if (step % unit === 0) {
        const slot = Math.floor(pos / unit) % 16;
        if ([0, 3, 8, 10].includes(slot)) pattern2[step] = slot === 0 || slot === 8 ? "accent" : "chug";
        if ([1, 4, 9, 11].includes(slot)) pattern2[step] = "scratch";
      }
    } else if (preset.id === "verse_chorus") {
      const bar = Math.floor(step / barSteps);
      if (bar < 2) {
        if (step % beat === 0) pattern2[step] = pos === 0 ? "accent" : "open";
        else if (pos % beat !== 0) pattern2[step] = "hold";
      } else if (step % eighth === 0) {
        pattern2[step] = pos === 0 || pos === beat * 2 ? "accent" : "chug";
      }
    } else if (preset.id === "boom_chick") {
      if (pos === 0 || pos === beat * 2) pattern2[step] = "accent";
      else if (pos === beat || pos === beat * 3) pattern2[step] = "scratch";
    } else if (preset.id === "train_chop") {
      const unit = Math.max(1, Math.round(resolution / 4));
      if (step % unit === 0) {
        const slot = Math.floor(pos / unit) % 4;
        pattern2[step] = slot === 0 ? "accent" : slot === 2 ? "open" : "chug";
      }
    } else if (preset.id === "western_waltz") {
      if (pos === 0) pattern2[step] = "accent";
      else if (pos === beat || pos === beat * 2) pattern2[step] = "scratch";
    }
  }
  return { preset, pattern: pattern2.map(normalizeGuitarArticulation) };
}
function guitarPatternPresetIds() {
  return POCKET_GUITAR_PATTERN_PRESETS.slice();
}
function safePositiveInt(value, fallback) {
  const rounded = Math.round(Number(value));
  return Number.isFinite(rounded) && rounded > 0 ? rounded : fallback;
}

// src/patterns/funk-grammar.js
var FUNK_BASS_PATTERN_GRAMMAR = Object.freeze({
  root_octave_answer: pattern([[0, 0, 112, "slap", "anchor"], [3, 7, 72, "mute", "pickup"], [6, 12, 96, "pop", "response"], [11, 7, 68, "finger", "pickup"]]),
  root_fifth_pickup: pattern([[0, 0, 108, "finger", "anchor"], [5, 7, 76, "finger", "response"], [7, 0, 38, "mute", "ghost"], [14, 7, 82, "finger", "pickup"]]),
  slap_pop_exchange: pattern([[0, 0, 118, "slap", "anchor"], [2, 12, 96, "pop", "response"], [3, 5, 38, "mute", "ghost"], [6, 7, 78, "hammer", "response"], [10, 12, 92, "pop", "response"], [14, 0, 74, "pull", "pickup"]]),
  muted_rake_one: pattern([[0, 0, 116, "slap", "anchor"], [11, 0, 34, "mute", "pickup"], [12, 0, 42, "mute", "pickup"], [13, 0, 52, "mute", "pickup"], [15, 7, 70, "finger", "pickup"]]),
  hammer_cell: pattern([[0, 0, 104, "finger", "anchor"], [2, 2, 70, "hammer", "response"], [6, 4, 78, "pull", "response"], [8, 0, 96, "slap", "anchor"]]),
  pull_off_answer: pattern([[0, 0, 106, "finger", "anchor"], [4, 7, 86, "finger", "call"], [5, 5, 70, "pull", "response"], [10, 3, 78, "hammer", "response"], [15, 0, 84, "finger", "pickup"]]),
  slide_home: pattern([[0, 0, 110, "slap", "anchor"], [6, 5, 74, "finger", "call"], [7, 7, 78, "slide", "response"], [12, 12, 92, "pop", "response"], [15, 0, 54, "mute", "pickup"]]),
  pocket_walk: pattern([[0, 0, 106, "finger", "anchor"], [3, 2, 62, "hammer", "response"], [6, 4, 76, "finger", "response"], [9, 5, 68, "finger", "call"], [12, 7, 84, "pop", "response"], [15, 10, 70, "pull", "pickup"]]),
  phrase_fill_home: pattern([[0, 0, 104, "finger", "anchor"], [8, 7, 82, "slap", "call"], [11, 10, 76, "hammer", "fill"], [12, 12, 94, "pop", "fill"], [13, 10, 70, "pull", "fill"], [14, 7, 82, "slide", "fill"], [15, 0, 48, "mute", "pickup"]])
});
var FUNK_DRUM_PATTERN_GRAMMAR = Object.freeze({
  funk_backbeat_98: drumPattern([["kick", 0, 118, "accent"], ["kick", 6, 86], ["kick", 10, 92], ["snare", 4, 118, "accent"], ["snare", 12, 122, "accent"], ...sixteenthHats(), ["snare", 3, 32, "ghost"], ["snare", 11, 38, "ghost"]]),
  funk_ghost_push: drumPattern([["kick", 0, 120, "accent"], ["kick", 7, 78], ["kick", 10, 90], ["snare", 4, 116, "accent"], ["snare", 12, 120, "accent"], ["snare", 2, 28, "ghost"], ["snare", 7, 34, "ghost"], ["snare", 14, 42, "ghost"], ...sixteenthHats()]),
  funk_one_drop: drumPattern([["kick", 0, 124, "accent"], ["snare", 4, 112, "accent"], ["snare", 12, 118, "accent"], ["hat_closed", 0, 72], ["hat_closed", 2, 46], ["hat_closed", 6, 50], ["hat_closed", 8, 66], ["hat_closed", 10, 44], ["hat_open", 15, 72, "open"]]),
  funk_open_hat_lift: drumPattern([["kick", 0, 122, "accent"], ["kick", 6, 84], ["snare", 4, 118, "accent"], ["snare", 12, 121, "accent"], ...sixteenthHats().slice(0, 15), ["hat_open", 15, 88, "open"]]),
  funk_breakbeat_pocket: drumPattern([["kick", 0, 122, "accent"], ["kick", 3, 82], ["kick", 7, 90], ["kick", 10, 98], ["snare", 4, 118, "accent"], ["snare", 12, 124, "accent"], ["snare", 11, 36, "ghost"], ["hat_closed", 0, 70], ["hat_closed", 2, 48], ["hat_closed", 6, 54], ["hat_closed", 8, 66], ["hat_closed", 10, 50], ["hat_open", 15, 84, "open"]]),
  funk_fill_16ths: drumPattern([["snare", 12, 72], ["tom_high", 13, 82], ["tom_mid", 14, 94], ["tom_low", 15, 110, "accent"]]),
  funk_fill_snare_pickup: drumPattern([["snare", 11, 44, "ghost"], ["snare", 12, 68], ["snare", 13, 82], ["snare", 14, 96], ["snare", 15, 116, "accent"]]),
  funk_fill_tom_turn: drumPattern([["tom_high", 10, 72], ["snare", 11, 64, "ghost"], ["tom_high", 12, 82], ["tom_mid", 13, 92], ["tom_low", 14, 106], ["crash", 15, 112, "accent"]])
});
var FUNK_STAB_PATTERN_GRAMMAR = Object.freeze({
  clav_conversation: pattern([[2, [0, 3, 6], 86, "staccato", "call"], [6, [0, 3, 6], 72, "mute", "response"], [10, [4, 7, 10], 92, "accent", "call"], [15, [0, 3, 6], 68, "staccato", "pickup"]]),
  brass_break: pattern([[0, [0, 3, 6], 104, "accent", "anchor"], [3, [4, 7, 10], 88, "staccato", "response"], [7, [0, 3, 6], 96, "accent", "response"]]),
  rhodes_offbeats: pattern([[2, [0, 3, 7], 74, "staccato", "call"], [6, [0, 3, 7], 80, "staccato", "response"], [10, [4, 7, 10], 76, "staccato", "call"], [14, [0, 3, 7], 84, "accent", "response"]]),
  muted_guitar_scratches: pattern([[1, [0, 7], 48, "scratch", "ghost"], [3, [0, 7], 68, "mute", "response"], [6, [0, 7], 54, "scratch", "ghost"], [9, [4, 10], 72, "mute", "call"], [11, [4, 10], 50, "scratch", "ghost"], [14, [0, 7], 78, "accent", "response"]])
});
var FUNK_LEAD_PATTERN_GRAMMAR = Object.freeze({
  muted_trumpet_call: pattern([[6, 7, 88, "staccato", "call"], [7, 10, 82, "staccato", "call"], [14, 7, 78, "staccato", "response"]]),
  sax_phrase_answer: pattern([[9, 5, 78, "accent", "call"], [11, 7, 84, "legato", "response"], [13, 10, 92, "accent", "response"], [15, 7, 68, "staccato", "pickup"]]),
  horn_turnaround: pattern([[12, 0, 86, "accent", "fill"], [13, 3, 82, "staccato", "fill"], [14, 5, 90, "accent", "fill"], [15, 7, 104, "staccato", "pickup"]])
});
function buildFunkPatternEvents(grammar, id, options = {}) {
  const source = grammar[id] || Object.values(grammar)[0] || [];
  const offset = Math.max(0, Number(options.stepOffset || 0));
  const velocityScale = Math.max(0, Number(options.velocityScale ?? 1));
  return source.map((event2) => ({ ...event2, step: event2.step + offset, velocity: Math.round(event2.velocity * velocityScale) }));
}
function pattern(entries) {
  return Object.freeze(entries.map(([step, note, velocity, articulation, role]) => Object.freeze({ step, duration: articulation === "mute" ? 0.35 : 0.72, note, velocity, articulation, role, technique: Object.freeze({ funk: Object.freeze({ callResponseRole: role }) }) })));
}
function drumPattern(entries) {
  return Object.freeze(entries.map(([lane, step, velocity, articulation = velocity < 50 ? "ghost" : "finger"]) => Object.freeze({ step, duration: lane === "hat_open" ? 1.4 : 0.45, velocity, articulation, lane, sound: lane, role: step === 0 ? "anchor" : articulation === "ghost" ? "ghost" : "groove", technique: Object.freeze({ funk: Object.freeze({ ghostDepth: articulation === "ghost" ? 1 - velocity / 127 : 0 }) }) })));
}
function sixteenthHats() {
  return Array.from({ length: 16 }, (_, step) => ["hat_closed", step, step % 4 === 0 ? 74 : step % 2 ? 42 : 58, step % 4 === 0 ? "accent" : "finger"]);
}

// src/patterns/western-grammar.js
var WESTERN_PATTERN_GRAMMAR = Object.freeze({
  western_trail: Object.freeze([
    event(0, "kick", 112, "accent", "anchor"),
    event(4, "snare", 88, "finger", "chick"),
    event(8, "kick", 104, "accent", "boom"),
    event(12, "snare", 92, "finger", "chick")
  ]),
  western_train: Object.freeze(Array.from({ length: 16 }, (_, step) => event(step, step % 4 === 0 ? "kick" : "snare", step % 4 === 0 ? 105 : step % 2 ? 48 : 66, step % 4 === 0 ? "accent" : "ghost", "train"))),
  western_banjo_roll: Object.freeze([0, 2, 4, 6, 8, 10, 12, 14].map((step, index) => Object.freeze({ step, duration: 0.7, note: [0, 4, 7, 4][index % 4], velocity: index % 4 === 0 ? 96 : 68, articulation: "finger", role: "roll", technique: Object.freeze({ western: Object.freeze({ banjoRoll: "forward", pickDirection: index % 2 ? "up" : "down" }) }) }))),
  western_showdown_pick: Object.freeze([0, 3, 6, 8, 11, 14].map((step, index) => Object.freeze({ step, duration: 0.55, note: [0, 2, 4, 7, 4, 2][index], velocity: step === 0 ? 112 : 82, articulation: index === 4 ? "bend" : "finger", role: step === 0 ? "anchor" : "pickup", technique: Object.freeze({ western: Object.freeze({ pickDirection: index % 2 ? "up" : "down", bend: index === 4 ? 2 : 0 }) }) })))
});
function buildWesternPatternEvents(id, options = {}) {
  const source = WESTERN_PATTERN_GRAMMAR[id] || WESTERN_PATTERN_GRAMMAR.western_trail;
  return source.map((item) => ({ ...item, step: item.step + Math.max(0, Number(options.stepOffset || 0)) }));
}
function event(step, lane, velocity, articulation, role) {
  return Object.freeze({ step, duration: 0.45, lane, sound: lane, velocity, articulation, role, technique: Object.freeze({ western: Object.freeze({ strumDirection: step % 8 ? "up" : "down" }) }) });
}

// src/patterns/metal-grammar.js
var METAL_RIFF_GRAMMAR = Object.freeze({
  metal_tight_riff: riff([[0, 0, "palm_mute", 116], [2, 0, "palm_mute", 92], [3, 0, "palm_mute", 88], [4, 3, "accent", 118], [6, 0, "chug", 96], [8, 5, "accent", 120], [10, 0, "palm_mute", 94], [11, 0, "palm_mute", 90], [14, 6, "accent", 116]]),
  metal_gallop: riff([[0, 0, "accent", 120], [2, 0, "palm_mute", 88], [3, 0, "palm_mute", 86], [4, 0, "accent", 112], [6, 0, "palm_mute", 88], [7, 0, "palm_mute", 86], [8, 5, "accent", 118], [10, 5, "palm_mute", 90], [11, 5, "palm_mute", 88]]),
  metal_breakdown: riff([[0, 0, "accent", 124], [3, 0, "chug", 102], [6, 1, "accent", 120], [10, 0, "palm_mute", 98], [15, 0, "chug", 110]])
});
var METAL_DRUM_PATTERN_GRAMMAR = Object.freeze({
  metal_double_kick: drum([["kick", 0, 122], ["kick", 2, 104], ["snare", 4, 120], ["kick", 6, 110], ["kick", 7, 96], ["kick", 8, 118], ["kick", 10, 102], ["snare", 12, 124], ["kick", 14, 110], ["kick", 15, 100], ["crash", 0, 96]]),
  metal_breakdown_half_time: drum([["kick", 0, 124], ["kick", 3, 110], ["snare", 8, 126], ["kick", 10, 112], ["china", 0, 102], ["china", 8, 94]]),
  metal_tom_fill: drum([["tom_high", 12, 88], ["tom_high", 13, 96], ["tom_mid", 14, 108], ["tom_low", 15, 122]])
});
function buildMetalPatternEvents(grammar, id, options = {}) {
  const source = grammar[id] || Object.values(grammar)[0] || [];
  return source.map((event2) => ({ ...event2, step: event2.step + Math.max(0, Number(options.stepOffset || 0)) }));
}
function riff(entries) {
  return Object.freeze(entries.map(([step, note, articulation, velocity], index) => Object.freeze({ step, duration: articulation === "accent" ? 0.9 : 0.42, note, velocity, articulation, role: step === 0 ? "anchor" : "riff", sound: "tight_metal", technique: Object.freeze({ metal: Object.freeze({ palmMute: articulation === "palm_mute" ? 0.88 : 0.2, pickDirection: index % 2 ? "up" : "down", dualTakeSeed: index + 1 }) }) })));
}
function drum(entries) {
  return Object.freeze(entries.map(([lane, step, velocity]) => Object.freeze({ step, duration: lane === "crash" || lane === "china" ? 1.5 : 0.5, lane, sound: lane, velocity, articulation: velocity > 115 ? "accent" : "finger", role: step === 0 ? "anchor" : "drive" })));
}

// src/performance/humanize.js
var CHORDSMITH_HUMANIZE_TIMING_SECONDS = 0.018;
var CHORDSMITH_HUMANIZE_PEAK_BASE = 0.88;
var CHORDSMITH_HUMANIZE_PEAK_RANGE = 0.2;
var CHORDSMITH_HUMANIZE_VELOCITY_BASE = 0.9;
var CHORDSMITH_HUMANIZE_VELOCITY_RANGE = 0.18;
function chordsmithFeatureSeed(step, seed = 0) {
  const x = Math.sin((Number(step) || 0) * 12.9898 + (Number(seed) || 0) * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function chordsmithHumanizeOffset(step, seed = 0, enabled = false) {
  if (!enabled) return 0;
  return (chordsmithFeatureSeed(step, seed) - 0.5) * CHORDSMITH_HUMANIZE_TIMING_SECONDS;
}
function chordsmithHumanizePeak(base, step, seed = 0, enabled = false) {
  const value = Number(base) || 0;
  if (!enabled) return value;
  return value * (CHORDSMITH_HUMANIZE_PEAK_BASE + chordsmithFeatureSeed(step, seed + 99) * CHORDSMITH_HUMANIZE_PEAK_RANGE);
}
function chordsmithHumanizeVelocity(base, step, seed = 0, enabled = false) {
  const value = Number(base) || 0;
  const scaled = enabled ? value * (CHORDSMITH_HUMANIZE_VELOCITY_BASE + chordsmithFeatureSeed(step, seed + 199) * CHORDSMITH_HUMANIZE_VELOCITY_RANGE) : value;
  return Math.max(1, Math.min(127, Math.round(scaled)));
}

// src/performance/expression.js
var POCKET_AUDIO_COMMON_ARTICULATIONS = Object.freeze([
  "finger",
  "slap",
  "pop",
  "mute",
  "ghost",
  "hammer",
  "pull",
  "slide",
  "hold",
  "staccato",
  "legato",
  "bend",
  "vibrato",
  "tremolo",
  "open",
  "chug",
  "scratch",
  "palm_mute",
  "accent",
  "flam",
  "drag",
  "roll",
  "choke"
]);
var POCKET_AUDIO_ARTICULATION_IDS = POCKET_AUDIO_COMMON_ARTICULATIONS;
var POCKET_AUDIO_ARTICULATION_ALIASES = Object.freeze({
  dead: "mute",
  muted: "mute",
  hammer_on: "hammer",
  "hammer-on": "hammer",
  pull_off: "pull",
  "pull-off": "pull",
  palmmute: "palm_mute",
  "palm-mute": "palm_mute",
  palm: "palm_mute",
  openhat: "open",
  closed: "choke"
});
function normalisePocketAudioArticulation(value, options = {}) {
  const requested = String(value || options.fallback || "finger").trim().toLowerCase();
  const canonical = POCKET_AUDIO_ARTICULATION_ALIASES[requested] || requested;
  if (POCKET_AUDIO_COMMON_ARTICULATIONS.includes(canonical)) return canonical;
  if (options.preserveUnknown !== false && canonical) return canonical;
  return options.fallback || "finger";
}
function normalisePocketAudioExpression(value) {
  return cloneRecord(value);
}
function normalisePocketAudioTechnique(value) {
  const source = cloneRecord(value);
  const out = {};
  Object.entries(source).forEach(([namespace, commands]) => {
    out[String(namespace)] = cloneRecord(commands);
  });
  return out;
}
function normalisePocketAudioRole(value, fallback = "") {
  const role = String(value || fallback).trim().toLowerCase();
  return role.replace(/\s+/g, "_");
}
function isPocketAudioCommonArticulation(value) {
  return POCKET_AUDIO_COMMON_ARTICULATIONS.includes(normalisePocketAudioArticulation(value));
}
function cloneRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

// src/performance/chord-rhythm.js
var CHORDSMITH_CHORD_PLAY_MODES = Object.freeze([
  "block",
  "strum_up",
  "strum_down",
  "arp_up",
  "arp_down"
]);
var CHORDSMITH_CHORD_RHYTHM_MODES = Object.freeze([
  "sustain",
  "quarter",
  "half"
]);
var CHORDSMITH_CHORD_RHYTHM = Object.freeze({
  quarterGate: 0.9,
  halfGate: 1.8,
  halfThreeFourOffset: 1.5,
  halfThreeFourGate: 1.2,
  sustainGate: 0.92
});
function chordsmithChordRhythmStarts({ mode = "sustain", barStart = 0, beatDuration = 0, timeSig = 4 } = {}) {
  const start = Number(barStart) || 0;
  const beat = Math.max(0, Number(beatDuration) || 0);
  const beats = Math.max(1, Math.floor(Number(timeSig) || 4));
  if (mode === "quarter") {
    return Array.from({ length: beats }, (_, index) => [
      start + index * beat,
      beat * CHORDSMITH_CHORD_RHYTHM.quarterGate
    ]);
  }
  if (mode === "half") {
    const out = [[start, beat * CHORDSMITH_CHORD_RHYTHM.halfGate]];
    if (beats >= 4) out.push([start + beat * 2, beat * CHORDSMITH_CHORD_RHYTHM.halfGate]);
    else if (beats === 3) {
      out.push([
        start + beat * CHORDSMITH_CHORD_RHYTHM.halfThreeFourOffset,
        beat * CHORDSMITH_CHORD_RHYTHM.halfThreeFourGate
      ]);
    }
    return out;
  }
  return [[start, beat * beats * CHORDSMITH_CHORD_RHYTHM.sustainGate]];
}

// src/performance/drum-feel.js
var CHORDSMITH_DRUM_FEEL = Object.freeze({
  peak: Object.freeze({
    kick: Object.freeze({ normal: 0.95, accent: 1.12 }),
    snare: Object.freeze({ normal: 0.5, accent: 0.72 }),
    hat: Object.freeze({ normal: 0.16, accent: 0.24 })
  }),
  gate: Object.freeze({
    kickCeiling: 0.1,
    snareCeiling: 0.08,
    hatClosedCeiling: 0.025,
    hatOpenCeiling: 0.12,
    standardStepMul: 0.7,
    hatAccentStepMul: 0.75,
    tupletCeiling: 0.08,
    hatAccentTupletCeiling: 0.12,
    tupletSpanMul: 0.7
  })
});
function chordsmithDrumPeak(lane, level = 1) {
  const config = CHORDSMITH_DRUM_FEEL.peak[normaliseDrumLane(lane)];
  return Number(level) > 1 ? config.accent : config.normal;
}
function chordsmithDrumStepDuration({ lane = "hat", level = 1, stepDuration = 0 } = {}) {
  const drum2 = normaliseDrumLane(lane);
  const stepDur = Math.max(0, Number(stepDuration) || 0);
  const accent = Number(level) > 1;
  const ceiling = drum2 === "kick" ? CHORDSMITH_DRUM_FEEL.gate.kickCeiling : drum2 === "snare" ? CHORDSMITH_DRUM_FEEL.gate.snareCeiling : accent ? CHORDSMITH_DRUM_FEEL.gate.hatOpenCeiling : CHORDSMITH_DRUM_FEEL.gate.hatClosedCeiling;
  const stepMul = drum2 === "hat" && accent ? CHORDSMITH_DRUM_FEEL.gate.hatAccentStepMul : CHORDSMITH_DRUM_FEEL.gate.standardStepMul;
  return Math.min(ceiling, stepDur * stepMul);
}
function chordsmithDrumTupletDuration({ lane = "hat", level = 1, spanDuration: spanDuration2 = 0 } = {}) {
  const drum2 = normaliseDrumLane(lane);
  const spanDur = Math.max(0, Number(spanDuration2) || 0);
  const ceiling = drum2 === "hat" && Number(level) > 1 ? CHORDSMITH_DRUM_FEEL.gate.hatAccentTupletCeiling : CHORDSMITH_DRUM_FEEL.gate.tupletCeiling;
  return Math.min(ceiling, spanDur / 3 * CHORDSMITH_DRUM_FEEL.gate.tupletSpanMul);
}
function normaliseDrumLane(lane) {
  if (lane === "kick" || lane === "snare") return lane;
  return "hat";
}

// src/performance/guitar-gates.js
var CHORDSMITH_GUITAR_GATE_SECONDS = Object.freeze({
  chugFloor: 0.055,
  chugCeiling: 0.16,
  chugStepMul: 0.58,
  scratchFloor: 0.035,
  scratchCeiling: 0.075,
  scratchStepMul: 0.42,
  sustainFloor: 0.16,
  sustainCeiling: 1.8,
  openMul: 0.92,
  accentMul: 0.98
});
function chordsmithGuitarStepDuration({ stepDuration, heldDuration = stepDuration, articulation = "open" } = {}) {
  const stepDur = Math.max(0, Number(stepDuration) || 0);
  const heldDur = Math.max(0, Number(heldDuration) || stepDur);
  const art = String(articulation || "open");
  if (art === "chug") {
    return clamp2(
      stepDur * CHORDSMITH_GUITAR_GATE_SECONDS.chugStepMul,
      CHORDSMITH_GUITAR_GATE_SECONDS.chugFloor,
      CHORDSMITH_GUITAR_GATE_SECONDS.chugCeiling
    );
  }
  if (art === "scratch") {
    return clamp2(
      stepDur * CHORDSMITH_GUITAR_GATE_SECONDS.scratchStepMul,
      CHORDSMITH_GUITAR_GATE_SECONDS.scratchFloor,
      CHORDSMITH_GUITAR_GATE_SECONDS.scratchCeiling
    );
  }
  return clamp2(
    heldDur * (art === "accent" ? CHORDSMITH_GUITAR_GATE_SECONDS.accentMul : CHORDSMITH_GUITAR_GATE_SECONDS.openMul),
    CHORDSMITH_GUITAR_GATE_SECONDS.sustainFloor,
    CHORDSMITH_GUITAR_GATE_SECONDS.sustainCeiling
  );
}
function clamp2(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// src/performance/lofi-texture.js
var CHORDSMITH_LOFI_TEXTURE_LIVE = Object.freeze({
  hissSeconds: 0.22,
  hissAttackSeconds: 0.018,
  hissReleaseSeconds: 0.2,
  hissGain: 55e-4,
  hissHighpassHz: 520,
  hissLowpassBaseHz: 3600,
  hissLowpassAgeHz: 1800,
  crackleThreshold: 0.7,
  crackleSeconds: 0.026,
  crackleGain: 0.018,
  crackleDecaySeconds: 0.024,
  crackleStopSeconds: 0.028,
  crackleBandpassBaseHz: 1550,
  crackleBandpassRangeHz: 1300,
  crackleBandpassQ: 0.95
});
var CHORDSMITH_LOFI_TEXTURE_OFFLINE = Object.freeze({
  hissGain: 0.014,
  crackleWindowSeconds: 0.09,
  crackleMinWindowSamples: 900,
  crackleThreshold: 0.22,
  crackleLocalSamples: 760,
  crackleGain: 0.07,
  crackleDecaySamples: 130,
  highpassHz: 420,
  lowpassBaseHz: 3800,
  lowpassAgeHz: 2e3,
  warmthGainBase: 0.42,
  warmthGainRange: 0.22,
  bitcrushBaseSteps: 28,
  bitcrushRangeSteps: 18
});
function chordsmithLofiTextureLiveHissLowpass(age = 0) {
  return CHORDSMITH_LOFI_TEXTURE_LIVE.hissLowpassBaseHz - clamp012(age) * CHORDSMITH_LOFI_TEXTURE_LIVE.hissLowpassAgeHz;
}
function chordsmithLofiTextureLiveCrackleShouldTrigger(step, crackle = 0) {
  return chordsmithFeatureSeed(step, 43) < clamp012(crackle) * CHORDSMITH_LOFI_TEXTURE_LIVE.crackleThreshold;
}
function chordsmithLofiTextureLiveCrackleFrequency(step) {
  return CHORDSMITH_LOFI_TEXTURE_LIVE.crackleBandpassBaseHz + chordsmithFeatureSeed(step, 44) * CHORDSMITH_LOFI_TEXTURE_LIVE.crackleBandpassRangeHz;
}
function chordsmithLofiTextureOfflineCrackleWindow(sampleRate) {
  return Math.max(
    CHORDSMITH_LOFI_TEXTURE_OFFLINE.crackleMinWindowSamples,
    Math.floor((Number(sampleRate) || 0) * CHORDSMITH_LOFI_TEXTURE_OFFLINE.crackleWindowSeconds)
  );
}
function chordsmithStableNoiseSample(index, seed = 0) {
  const x = Math.sin(((Number(index) || 0) + 1) * 12.9898 + ((Number(seed) || 0) + 1) * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}
function chordsmithLofiTextureOfflineSample(index, texture = {}, crackleWindow = CHORDSMITH_LOFI_TEXTURE_OFFLINE.crackleMinWindowSamples) {
  const hiss = clamp012(texture.tapeHiss);
  const crackle = clamp012(texture.vinylCrackle);
  const bit = clamp012(texture.bitCrush);
  const base = chordsmithStableNoiseSample(index, 91) * hiss * CHORDSMITH_LOFI_TEXTURE_OFFLINE.hissGain;
  const tick = Math.floor(index / Math.max(1, crackleWindow));
  const tickSeed = chordsmithFeatureSeed(tick, 92);
  const local = index % Math.max(1, crackleWindow);
  const crack = tickSeed < crackle * CHORDSMITH_LOFI_TEXTURE_OFFLINE.crackleThreshold && local < CHORDSMITH_LOFI_TEXTURE_OFFLINE.crackleLocalSamples ? chordsmithStableNoiseSample(index, 93) * crackle * CHORDSMITH_LOFI_TEXTURE_OFFLINE.crackleGain * Math.exp(-local / CHORDSMITH_LOFI_TEXTURE_OFFLINE.crackleDecaySamples) : 0;
  const combined = base + crack;
  if (bit <= 0.01) return combined;
  const steps = CHORDSMITH_LOFI_TEXTURE_OFFLINE.bitcrushBaseSteps - bit * CHORDSMITH_LOFI_TEXTURE_OFFLINE.bitcrushRangeSteps;
  return Math.round(combined * steps) / steps;
}
function clamp012(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

// src/performance/phrases.js
var CHORDSMITH_PHRASE_GATES = Object.freeze({
  minimumSeconds: 0.18,
  bassMul: 0.94,
  melodyMul: 0.92
});
function chordsmithPhraseDuration(duration, role = "melody") {
  const total = Math.max(0, Number(duration) || 0);
  const mul = role === "bass" ? CHORDSMITH_PHRASE_GATES.bassMul : CHORDSMITH_PHRASE_GATES.melodyMul;
  return Math.max(CHORDSMITH_PHRASE_GATES.minimumSeconds, total * mul);
}
function chordsmithPhraseInfo({
  step = 0,
  totalSteps = 0,
  role = "melody",
  stepDurationAt = () => 0,
  holdAt = () => false,
  slideAt = () => false
} = {}) {
  let duration = 0;
  let index = Math.max(0, Number(step) || 0);
  const maxSteps = Math.max(0, Number(totalSteps) || 0);
  do {
    duration += Math.max(0, Number(stepDurationAt(index)) || 0);
    index += 1;
  } while (index < maxSteps && holdAt(index));
  let slideStep = null;
  let slideOffset = null;
  if (index < maxSteps && slideAt(index)) {
    slideStep = index;
    slideOffset = duration;
    do {
      duration += Math.max(0, Number(stepDurationAt(index)) || 0);
      index += 1;
    } while (index < maxSteps && holdAt(index));
  }
  return {
    duration: chordsmithPhraseDuration(duration, role),
    rawDuration: duration,
    slideStep,
    slideOffset
  };
}

// src/performance/stem-mix.js
var CHORDSMITH_OFFLINE_STEM_GAIN = Object.freeze({
  drums: 0.68,
  bass: 0.68,
  chords: 0.78,
  melody: 0.82,
  guitar: 0.78
});
var CHORDSMITH_OFFLINE_RENDER_HEADROOM = 0.34;
function chordsmithOfflineStemOutputGain(stem, volume = defaultStemVolume(stem)) {
  return clamp013(volume) * offlineStemGain(stem);
}
function chordsmithOfflineStemRenderGain(stem, volume = defaultStemVolume(stem), headroom = CHORDSMITH_OFFLINE_RENDER_HEADROOM) {
  return chordsmithOfflineStemOutputGain(stem, volume) * clamp013(headroom);
}
function defaultStemVolume(stem) {
  return DEFAULT_STEM_MIX[stem]?.volume ?? DEFAULT_STEM_MIX.melody.volume;
}
function offlineStemGain(stem) {
  return CHORDSMITH_OFFLINE_STEM_GAIN[stem] ?? CHORDSMITH_OFFLINE_STEM_GAIN.melody;
}
function clamp013(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

// src/performance/tuplets.js
var CHORDSMITH_PITCHED_TUPLET = Object.freeze({
  gateFloorSeconds: 0.08,
  gateSpanMul: 0.86
});
function chordsmithPitchedTupletDuration(spanDuration2 = 0) {
  return Math.max(
    CHORDSMITH_PITCHED_TUPLET.gateFloorSeconds,
    Math.max(0, Number(spanDuration2) || 0) / 3 * CHORDSMITH_PITCHED_TUPLET.gateSpanMul
  );
}
function chordsmithPitchedTupletMiddleMidi(leftMidi, rightMidi) {
  if (leftMidi === null || leftMidi === void 0) return null;
  if (rightMidi === null || rightMidi === void 0) return leftMidi;
  return Math.round((Number(leftMidi) + Number(rightMidi)) / 2);
}
function chordsmithPitchedTupletMiddleIndex(leftIndex, rightIndex, { melodyPitchMode = "scale" } = {}) {
  const left = Math.max(0, Number(leftIndex) || 0);
  const right = Math.max(0, Number(rightIndex) || 0);
  const midpoint = Math.round((left + right) / 2);
  return Math.max(0, Math.min(melodyPitchMode === "chromatic" ? 23 : 13, midpoint));
}

// src/music/pitches.js
function chordsmithNoteIndex(note = "C") {
  const index = NOTES.indexOf(note);
  return index >= 0 ? index : 0;
}
function chordsmithScalePitchClasses({ key = "C", scale = "major" } = {}) {
  const root = chordsmithNoteIndex(key);
  const intervals = scale === "minor" ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  return intervals.map((interval) => (root + interval + 12) % 12);
}
function chordsmithChordQuality(scale = "major", degree = 0) {
  const safe = clampInt(degree, 0, 6);
  return scale === "minor" ? ["min", "dim", "maj", "min", "min", "maj", "maj"][safe] : ["maj", "min", "min", "maj", "maj", "min", "dim"][safe];
}
function chordsmithChordIntervals({ chordType = "triad", quality = "maj" } = {}) {
  if (chordType === "sus2") return [0, 2, 7];
  if (chordType === "sus4") return [0, 5, 7];
  if (chordType === "seventh") {
    if (quality === "maj") return [0, 4, 7, 11];
    if (quality === "min") return [0, 3, 7, 10];
    return [0, 3, 6, 10];
  }
  if (quality === "min") return [0, 3, 7];
  if (quality === "dim") return [0, 3, 6];
  return [0, 4, 7];
}
function chordsmithChordForStep({
  key = "C",
  scale = "major",
  chordType = "triad",
  timeSig = 4,
  resolution = 4,
  progression = [0, 4, 5, 3],
  step = 0
} = {}) {
  const stepsPerBar2 = Math.max(1, Number(timeSig) || 4) * Math.max(1, Number(resolution) || 4);
  const bar = Math.floor(Math.max(0, Number(step) || 0) / stepsPerBar2);
  const degree = clampInt(progression?.[bar] ?? 0, 0, 6);
  const rootPc = chordsmithScalePitchClasses({ key, scale })[degree];
  const quality = chordsmithChordQuality(scale, degree);
  return {
    degree,
    rootPc,
    quality,
    intervals: chordsmithChordIntervals({ chordType, quality })
  };
}
function chordsmithChordMidiNotes({ chord: chord2, chordOctave = 0, chordPlayMode = "block" } = {}) {
  const root = 48 + clampInt(chord2?.rootPc ?? 0, 0, 11) + (Number(chordOctave) || 0) * 12;
  const notes = (Array.isArray(chord2?.intervals) ? chord2.intervals : [0, 4, 7]).map((interval, index) => root + interval + (index === 0 ? 0 : 12));
  return chordPlayMode === "strum_down" || chordPlayMode === "arp_down" ? notes.reverse() : notes;
}
function chordsmithPowerChordNotes({ rootPc = 0, guitarRegister = "low" } = {}) {
  const min = guitarRegister === "high" ? 52 : guitarRegister === "mid" ? 45 : 35;
  const max = guitarRegister === "high" ? 64 : guitarRegister === "mid" ? 57 : 47;
  let root = 24 + clampInt(rootPc, 0, 11);
  while (root < min) root += 12;
  while (root > max) root -= 12;
  return [root, root + 7, root + 12].map((note) => clampInt(note, 0, 127));
}
function chordsmithMelodyIndexToMidi({
  key = "C",
  scale = "major",
  melodyPitchMode = "scale",
  noteIndex: noteIndex2 = 0,
  octave = 0
} = {}) {
  const max = melodyPitchMode === "chromatic" ? 23 : 13;
  const safe = clampInt(noteIndex2, 0, max);
  if (melodyPitchMode === "chromatic") return 72 + safe % 12 + (Math.floor(safe / 12) + (Number(octave) || 0)) * 12;
  const pcs = chordsmithScalePitchClasses({ key, scale });
  return 72 + pcs[safe % 7] + (Math.floor(safe / 7) + (Number(octave) || 0)) * 12;
}
function chordsmithBassIndexToMidi({ key = "C", scale = "major", noteIndex: noteIndex2 = 0 } = {}) {
  const safe = clampInt(noteIndex2, 0, 13);
  const pcs = chordsmithScalePitchClasses({ key, scale });
  return 36 + pcs[safe % 7] + Math.floor(safe / 7) * 12;
}
function chordsmithAutoBassMidi({ rootPc = 0 } = {}) {
  return 36 + clampInt(rootPc, 0, 11);
}
function clampInt(value, min, max) {
  const number = Math.round(Number(value) || 0);
  return Math.max(min, Math.min(max, number));
}

// src/music/timeline.js
function beatDurationSeconds(input = 96) {
  if (typeof input === "object" && input !== null && Number.isFinite(Number(input.secondsPerBeat))) {
    return Math.max(1e-4, Number(input.secondsPerBeat));
  }
  const bpm = typeof input === "object" && input !== null ? input.bpm : input;
  return 60 / Math.max(1, Number(bpm) || 96);
}
function stepDurationSeconds({ bpm = 96, secondsPerBeat = void 0, resolution = 4, swing = 0 } = {}, step = 0) {
  const base = beatDurationSeconds({ bpm, secondsPerBeat }) / Math.max(1, resolution);
  if (swing > 0 && resolution >= 2 && resolution !== 3) {
    return step % 2 === 1 ? base + base * swing : base - base * swing;
  }
  return base;
}
function buildStepTimeline({ stepCount, startTime = 0, bpm = 96, secondsPerBeat = void 0, resolution = 4, swing = 0 }) {
  const times = [];
  let cursor = startTime;
  for (let step = 0; step < stepCount; step += 1) {
    times.push(cursor);
    cursor += stepDurationSeconds({ bpm, secondsPerBeat, resolution, swing }, step);
  }
  return { times, duration: cursor - startTime };
}
function spanDurationSeconds(options = {}, startStep = 0, span = 1) {
  let duration = 0;
  for (let offset = 0; offset < span; offset += 1) {
    duration += stepDurationSeconds(options, startStep + offset);
  }
  return duration;
}
function tripletTimesForSpan(startTime, spanDuration2) {
  return [startTime, startTime + spanDuration2 / 3, startTime + spanDuration2 * 2 / 3];
}
function stepsPerBar(project) {
  return Math.max(1, (project?.meta?.timeSig || 4) * (project?.meta?.resolution || 4));
}

// src/engine/capabilities.js
var DIRECT_DRUM_LANES = Object.freeze(["kick", "snare", "clap", "hat_closed", "hat_open"]);
var DIRECT_ARTICULATIONS = Object.freeze([
  "finger",
  "slap",
  "pop",
  "mute",
  "ghost",
  "hammer",
  "pull",
  "slide",
  "hold",
  "staccato",
  "legato",
  "bend",
  "vibrato",
  "tremolo",
  "open",
  "chug",
  "scratch",
  "palm_mute",
  "accent",
  "choke"
]);
var APPROXIMATED_ARTICULATIONS = Object.freeze(["flam", "drag", "roll"]);
var POCKET_AUDIO_RENDERER_CAPABILITIES = Object.freeze({
  offline: capability("pocket-audio-core-offline", {
    sampleClock: true,
    directDrumLanes: DIRECT_DRUM_LANES,
    directArticulations: DIRECT_ARTICULATIONS,
    techniqueCommands: {
      chip: ["channel", "duty", "envelope", "commands", "sweep", "pitchSlide", "vibrato", "retrigger"],
      metal: ["palmMute", "pickDirection", "tremoloRate", "string", "dualTakeSeed"],
      western: ["pickDirection", "strumDirection", "banjoRoll", "bowDirection", "breathDirection", "bend"],
      funk: ["hand", "rake", "ghostDepth", "pocketOffset", "callResponseRole"]
    }
  }),
  live: capability("pocket-audio-core-live", {
    sampleClock: true,
    directDrumLanes: DIRECT_DRUM_LANES,
    directArticulations: DIRECT_ARTICULATIONS,
    techniqueCommands: {
      chip: ["channel", "duty", "envelope", "commands", "sweep", "pitchSlide", "vibrato", "retrigger"],
      metal: ["palmMute", "pickDirection", "tremoloRate", "string", "dualTakeSeed"],
      western: ["pickDirection", "strumDirection", "banjoRoll", "bowDirection", "breathDirection", "bend"],
      funk: ["hand", "rake", "ghostDepth", "pocketOffset", "callResponseRole"]
    }
  })
});
function getPocketAudioRendererCapabilities(renderer = "offline") {
  return cloneJson2(POCKET_AUDIO_RENDERER_CAPABILITIES[renderer] || POCKET_AUDIO_RENDERER_CAPABILITIES.offline);
}
function createPocketAudioRendererCapabilityReport(input, options = {}) {
  const renderer = options.renderer || "offline";
  const capabilities = getPocketAudioRendererCapabilities(renderer);
  const entries = [];
  const profileId = normalisePocketAudioProfileId(input?.soundProfile?.id || input?.meta?.audioProfile || options.profileId);
  const formatFeatures = Array.isArray(input?.formatFeatures) ? input.formatFeatures : [];
  formatFeatures.forEach((feature, index) => {
    if (capabilities.formatFeatures.includes(feature)) return;
    entries.push(entry(`formatFeatures[${index}]`, feature, "preserved", "", `Unknown feature ${feature} is preserved but not interpreted by ${capabilities.id}.`));
  });
  if (!capabilities.profileIds.includes(profileId)) {
    entries.push(entry("soundProfile.id", `sound-profile:${profileId}`, "fallback", "standard", `Profile ${profileId} renders with the Standard recipe.`));
  }
  collectRichEvents(input).forEach(({ event: event2, path, trackId }) => {
    const articulation = String(event2.articulation || "").toLowerCase();
    if (articulation && !capabilities.directArticulations.includes(articulation)) {
      const action = capabilities.approximatedArticulations.includes(articulation) ? "approximated" : "fallback";
      entries.push(entry(`${path}.articulation`, `articulation:${articulation}`, action, articulationFallback(articulation), `${articulation} is ${action} by ${capabilities.id}; source intent is preserved.`));
    }
    const laneCandidate = event2.lane || (trackId === "drums" ? event2.sound : trackId);
    if (laneCandidate) {
      const lane = normalisePocketAudioDrumLane(laneCandidate);
      if (POCKET_AUDIO_COMMON_DRUM_LANE_IDS.includes(lane) && !capabilities.directDrumLanes.includes(lane)) {
        entries.push(entry(`${path}.lane`, `drum-lane:${lane}`, "fallback", pocketAudioDrumLaneFallback(lane), `${lane} uses the ${pocketAudioDrumLaneFallback(lane)} fallback recipe.`));
      }
    }
    Object.entries(event2.technique || {}).forEach(([namespace, commands]) => {
      const supported = new Set(capabilities.techniqueCommands[namespace] || []);
      Object.keys(commands || {}).forEach((command) => {
        if (!supported.has(command)) entries.push(entry(`${path}.technique.${namespace}.${command}`, `technique:${namespace}:${command}`, "preserved", "", `Unknown ${namespace}.${command} command is preserved but not interpreted.`));
      });
    });
  });
  const losses = entries.filter((item) => item.action !== "preserved");
  return {
    renderer: capabilities.id,
    rendererVersion: capabilities.version,
    profileId,
    supported: !entries.some((item) => item.action === "dropped"),
    exact: losses.length === 0,
    entries,
    losses,
    capabilities
  };
}
var negotiatePocketAudioRendererCapabilities = createPocketAudioRendererCapabilityReport;
function capability(id, values) {
  return Object.freeze({
    id,
    version: 1,
    formatFeatures: POCKET_AUDIO_FORMAT_FEATURES,
    profileIds: POCKET_AUDIO_PROFILE_IDS,
    articulations: POCKET_AUDIO_COMMON_ARTICULATIONS,
    directArticulations: values.directArticulations,
    approximatedArticulations: APPROXIMATED_ARTICULATIONS,
    drumLanes: POCKET_AUDIO_COMMON_DRUM_LANE_IDS,
    directDrumLanes: values.directDrumLanes,
    techniqueCommands: Object.freeze(values.techniqueCommands),
    preservesUnknownData: true,
    reportsFallbacks: true,
    sampleClock: values.sampleClock
  });
}
function collectRichEvents(input) {
  if (Array.isArray(input)) return input.map((event2, index) => ({ event: event2, path: `events[${index}]`, trackId: event2.trackId || event2.stem || "" }));
  const out = [];
  Object.entries(input?.sections || {}).forEach(([sectionId, section]) => {
    const tracks = section.richTracks || section.tracks || {};
    Object.entries(tracks).forEach(([trackId, track]) => {
      (track?.events || []).forEach((event2, index) => out.push({ event: event2, trackId, path: `sections.${sectionId}.tracks.${trackId}.events[${index}]` }));
    });
  });
  return out;
}
function articulationFallback(value) {
  if (value === "flam" || value === "drag" || value === "roll") return "accent";
  if (value === "pop" || value === "slap") return "accent";
  return "finger";
}
function entry(path, feature, action, fallback, message) {
  return { path, feature, action, ...fallback ? { fallback } : {}, message };
}
function cloneJson2(value) {
  return JSON.parse(JSON.stringify(value));
}

// src/schema/resource-limits.js
function assertPocketAudioProjectResourceLimits(project) {
  const limits = POCKET_AUDIO_RESOURCE_LIMITS;
  if (!project || typeof project !== "object" || Array.isArray(project)) return;
  const sections = project.sections && typeof project.sections === "object" && !Array.isArray(project.sections) ? project.sections : {};
  let totalEvents = 0;
  SECTION_IDS.forEach((sectionId) => {
    const section = sections[sectionId];
    if (!section || typeof section !== "object" || Array.isArray(section)) return;
    const trackGroups = [section.tracks, section.richTracks].filter((group, index, groups) => group && typeof group === "object" && !Array.isArray(group) && groups.indexOf(group) === index);
    const trackEntries = trackGroups.flatMap((group) => Object.entries(group));
    assertLimit(`sections.${sectionId}.tracks`, trackEntries.length, limits.maxRichTracksPerSection);
    trackEntries.forEach(([trackId, track]) => {
      if (!track || typeof track !== "object" || Array.isArray(track)) return;
      const events = Array.isArray(track.events) ? track.events : [];
      assertLimit(`sections.${sectionId}.tracks.${trackId}.events`, events.length, limits.maxRichEventsPerTrack);
      totalEvents += events.length;
      assertLimit("project rich events", totalEvents, limits.maxRichEventsPerProject);
      events.forEach((event2, eventIndex) => {
        if (!event2 || typeof event2 !== "object" || Array.isArray(event2) || !Array.isArray(event2.notes)) return;
        assertLimit(`sections.${sectionId}.tracks.${trackId}.events[${eventIndex}].notes`, event2.notes.length, limits.maxNotesPerEvent);
      });
    });
  });
}
function assertLimit(path, actual, limit) {
  if (actual <= limit) return;
  const error = new RangeError(`Pocket Audio project exceeds ${path} limit (${actual} > ${limit}).`);
  error.name = "PocketAudioResourceLimitError";
  error.code = "POCKET_AUDIO_PROJECT_LIMIT_EXCEEDED";
  error.path = path;
  error.actual = actual;
  error.limit = limit;
  throw error;
}

// src/events/timeline-events.js
function buildPocketAudioTimeline(project, options = {}) {
  if (!project || project.app !== "PocketAudioProject") throw new Error("buildPocketAudioTimeline expects a normalised PocketAudioProject.");
  assertPocketAudioProjectResourceLimits(project);
  const scope = options.scope || "sequence";
  const sectionIds = resolveTimelineSectionIds(project, { ...options, scope });
  const events = [];
  let baseTime = options.startTime || 0;
  let baseTick = options.startTick || 0;
  sectionIds.forEach((sectionId, arrangementIndex) => {
    const section = project.sections[sectionId] || project.sections.A;
    const sectionEvents = buildSectionEvents(project, section, { baseTime, baseTick, arrangementIndex });
    events.push(...sectionEvents.events);
    baseTime += sectionEvents.duration;
    baseTick += sectionEvents.durationTicks;
  });
  const capabilityReport = createPocketAudioRendererCapabilityReport(project, { renderer: options.renderer || "offline" });
  const eventLosses = events.flatMap((event2) => event2.compatibility || []);
  return {
    scope,
    events: events.sort((a, b) => a.time - b.time || roleOrder(a.stem) - roleOrder(b.stem)),
    duration: baseTime - (options.startTime || 0),
    durationTicks: baseTick - (options.startTick || 0),
    ppq: project.meta.ppq || DEFAULT_PPQ,
    sectionIds: sectionIds.slice(),
    capabilityReport,
    lossReport: [...capabilityReport.losses, ...eventLosses]
  };
}
function resolveTimelineSectionIds(project, options) {
  if (Array.isArray(options.sectionIds) && options.sectionIds.length) {
    const sectionIds = options.sectionIds.map(normaliseSectionId).filter(Boolean);
    if (sectionIds.length) return sectionIds;
  }
  if (options.scope === "section") return [normaliseSectionId(options.sectionId || project.transport.currentSection || "A") || "A"];
  if (options.scope === "all") return SECTION_IDS.slice();
  const sequence = Array.isArray(project.sequence) ? project.sequence.map(normaliseSectionId).filter(Boolean) : [];
  return sequence.length ? sequence : [normaliseSectionId(project.transport.currentSection || "A") || "A"];
}
function normaliseSectionId(value) {
  const safe = String(value || "").toUpperCase();
  return SECTION_IDS.includes(safe) ? safe : null;
}
function buildSectionEvents(project, section, { baseTime = 0, baseTick = 0, arrangementIndex = 0 } = {}) {
  assertPocketAudioProjectResourceLimits(project);
  const meta = project.meta;
  const spb = stepsPerBar(project);
  const totalSteps = section.bars * spb;
  const timeline = buildStepTimeline({
    stepCount: totalSteps,
    startTime: baseTime,
    bpm: meta.bpm,
    resolution: meta.resolution,
    swing: meta.swing
  });
  const events = [];
  const rich = buildRichSectionEvents(project, section, { baseTime, baseTick, arrangementIndex, timeline, totalSteps, spb });
  events.push(...rich.events);
  for (let step = 0; step < totalSteps; step += 1) {
    const time = timeline.times[step];
    const tick = baseTick + stepToTicks(step, meta.resolution, meta.ppq);
    const bar = Math.floor(step / spb) + 1;
    const beat = Math.floor(step % spb / meta.resolution) + 1;
    if (!rich.ownedStems.has("drums")) addDrumEvents(events, project, section, { step, time, tick, bar, beat, arrangementIndex, totalSteps });
    if (!rich.ownedStems.has("bass")) addBassEvents(events, project, section, { step, time, tick, bar, beat, arrangementIndex, totalSteps });
    if (!rich.ownedStems.has("chords")) addChordEvents(events, project, section, { step, time, tick, bar, beat, arrangementIndex });
    if (!rich.ownedStems.has("melody")) addMelodyEvents(events, project, section, { step, time, tick, bar, beat, arrangementIndex, totalSteps });
    if (!rich.ownedStems.has("guitar")) addGuitarEvents(events, project, section, { step, time, tick, bar, beat, arrangementIndex, totalSteps });
  }
  return {
    events,
    duration: timeline.duration,
    durationTicks: stepToTicks(totalSteps, meta.resolution, meta.ppq)
  };
}
function buildRichSectionEvents(project, section, context) {
  const events = [];
  const ownedStems = /* @__PURE__ */ new Set();
  Object.entries(section.richTracks || {}).forEach(([trackId, track]) => {
    const sourceEvents = Array.isArray(track?.events) ? track.events : [];
    if (!sourceEvents.length) return;
    const stem = richTrackStem(trackId, track);
    if (!richTrackOwnsStem(project, track)) return;
    ownedStems.add(stem);
    let previousPitched = null;
    sourceEvents.forEach((source, index) => {
      const localTick = source.tick === void 0 ? stepToTicks(Number(source.step || 0), project.meta.resolution, project.meta.ppq) : Math.max(0, Number(source.tick || 0));
      const authoredStep = source.step === void 0 ? localTick / project.meta.ppq * project.meta.resolution : Number(source.step || 0);
      const step = Math.max(0, Math.min(context.totalSteps - 1e-6, authoredStep));
      const time = source.tick === void 0 ? timeAtStep(context.timeline, step) : context.baseTime + localTick / project.meta.ppq * beatSeconds(project);
      const durationTicks = source.durationTicks ?? Math.max(1, stepToTicks(Number(source.duration || 1), project.meta.resolution, project.meta.ppq));
      const duration = durationTicks / project.meta.ppq * beatSeconds(project);
      const lane = stem === "drums" ? normalisePocketAudioDrumLane(source.lane || source.sound || trackId) : void 0;
      const midi = richSingleMidi(source);
      const midiNotes = richPolyMidi(source);
      const requestedArticulation = normalisePocketAudioArticulation(source.articulation || defaultRichArticulation(stem, lane));
      const connectedInvalid = (requestedArticulation === "hammer" || requestedArticulation === "pull") && previousPitched === null;
      const articulation = connectedInvalid ? "finger" : requestedArticulation;
      const compatibility = connectedInvalid ? [{
        path: `sections.${section.id}.tracks.${trackId}.events[${index}].articulation`,
        feature: `bass-articulation:${requestedArticulation}`,
        action: "fallback",
        fallback: "finger",
        message: `${requestedArticulation} requires a previous pitched event and rendered as finger.`
      }] : [];
      const patch = {
        idSuffix: `_rich_${safeId(trackId)}_${index}`,
        time,
        tick: context.baseTick + localTick,
        durationTicks,
        stem,
        type: richEventType(stem, lane),
        duration,
        velocity: normaliseRichVelocity(source.velocity),
        accent: articulation === "accent" || Number(source.velocity || 0) >= 112,
        midi,
        midiNotes,
        instrument: source.sound || richDefaultSound(project, section, stem),
        articulation,
        sourceArticulation: connectedInvalid ? requestedArticulation : void 0,
        sound: source.sound,
        lane,
        role: source.role,
        expression: source.expression,
        technique: source.technique,
        note: source.note,
        notes: source.notes,
        sourceDuration: source.duration,
        trackId,
        compatibility,
        pan: source.pan,
        humanizeVelocity: false
      };
      if (stem === "bass") patch.bassTone = source.sound || projectSoundBassTone(project);
      if (stem === "drums") patch.drumKit = projectSoundDrumKit(project);
      events.push(baseEvent(project, section, {
        step,
        time,
        tick: context.baseTick + localTick,
        bar: Math.floor(step / context.spb) + 1,
        beat: Math.floor(step % context.spb / project.meta.resolution) + 1,
        arrangementIndex: context.arrangementIndex
      }, patch));
      if (midi !== void 0 || midiNotes?.length) previousPitched = midi ?? midiNotes[0];
    });
  });
  return { events, ownedStems };
}
function richTrackOwnsStem(project, track) {
  const profileId = String(project.soundProfile?.id || project.meta?.audioProfile || "standard");
  const compactMirror = track?.compatibility?.compactMirror === true;
  const verifiedLiveMirror = track?.compatibility?.liveMirror === true;
  return verifiedLiveMirror || !compactMirror || !["standard", "lofi_chill"].includes(profileId);
}
function addDrumEvents(events, project, section, context) {
  const drumKit = projectSoundDrumKit(project);
  CHORDSMITH_SEQUENCED_DRUM_LANE_IDS.forEach((lane) => {
    const levels = section.drums[lane] || [];
    const tuplets = section.drumTuplets[lane] || [];
    if (isTupletSecond(tuplets, context.step)) return;
    const level = Number(levels[context.step] || 0);
    if (isTupletStart(tuplets, context.step, context.totalSteps)) {
      const nextLevel = Number(levels[context.step + 1] || level);
      const spanDur = spanDuration(project, context.step, 2);
      tripletTimes(project, context.step, context.time).forEach((time, index) => {
        const tupletLevel = index === 2 ? nextLevel : level;
        if (tupletLevel > 0) events.push(baseEvent(project, section, context, {
          time,
          tick: context.tick + tripletTickOffset(index, project.meta.resolution, project.meta.ppq),
          stem: "drums",
          type: lane,
          duration: chordsmithDrumTupletDuration({ lane, level: tupletLevel, spanDuration: spanDur }),
          velocity: chordsmithDrumPeak(lane, tupletLevel),
          accent: tupletLevel > 1,
          tuplet: true,
          drumKit,
          humanizeSeed: seedForDrum(lane),
          humanizeStep: context.step + index
        }));
      });
    } else if (level > 0) {
      events.push(baseEvent(project, section, context, {
        stem: "drums",
        type: lane,
        duration: chordsmithDrumStepDuration({
          lane,
          level,
          stepDuration: stepDurationSeconds(project.meta, context.step)
        }),
        velocity: chordsmithDrumPeak(lane, level),
        accent: level > 1,
        drumKit,
        humanizeSeed: seedForDrum(lane)
      }));
    }
  });
}
function addBassEvents(events, project, section, context) {
  if (project.mixer.stems.bass?.mute) return;
  if (section.bass.hold[context.step] || section.bass.slide[context.step]) return;
  const source = section.bass.mode === "manual" ? section.bass.notes : section.bass.grid;
  const active = (step) => section.bass.mode === "manual" ? source[step] !== null && source[step] !== void 0 : Number(source[step] || 0) > 0;
  if (!active(context.step)) return;
  const tuplets = section.drumTuplets.bass || [];
  if (isTupletSecond(tuplets, context.step)) return;
  if (isTupletStart(tuplets, context.step, context.totalSteps)) {
    const leftMidi = bassMidiAt(project, section, context.step);
    const rightMidi = bassMidiAt(project, section, context.step + 1);
    const midMidi = chordsmithPitchedTupletMiddleMidi(leftMidi, rightMidi);
    const spanDur = spanDuration(project, context.step, 2);
    const notes = [leftMidi, midMidi, rightMidi ?? leftMidi];
    tripletTimes(project, context.step, context.time).forEach((time, index) => {
      const sourceStep = index === 2 ? context.step + 1 : context.step;
      if (!active(sourceStep)) return;
      const midi = notes[index];
      if (midi === null || midi === void 0) return;
      events.push(baseEvent(project, section, context, {
        time,
        tick: context.tick + tripletTickOffset(index, project.meta.resolution, project.meta.ppq),
        stem: "bass",
        type: "bass",
        duration: chordsmithPitchedTupletDuration(spanDur),
        velocity: bassAccent(section, sourceStep) ? 0.42 : 0.34,
        accent: bassAccent(section, sourceStep),
        midi,
        tuplet: true,
        bassTone: projectSoundBassTone(project),
        articulation: section.bass.articulation?.[sourceStep] || void 0,
        humanizeSeed: 4,
        humanizeStep: context.step + index
      }));
    });
    return;
  }
  const phrase = phraseDuration(project, section.bass.hold, section.bass.slide, context.step, context.totalSteps, "bass");
  events.push(baseEvent(project, section, context, {
    stem: "bass",
    type: "bass",
    duration: phrase.duration,
    velocity: bassAccent(section, context.step) ? 0.42 : 0.34,
    accent: bassAccent(section, context.step),
    midi: bassMidiAt(project, section, context.step),
    slideMidi: phrase.slideStep === null ? void 0 : bassMidiAt(project, section, phrase.slideStep),
    slideOffset: phrase.slideOffset,
    bassTone: projectSoundBassTone(project),
    articulation: section.bass.articulation?.[context.step] || void 0,
    humanizeSeed: 4
  }));
}
function addChordEvents(events, project, section, context) {
  if (project.mixer.stems.chords?.mute || !section.chords.enabled) return;
  if (context.step % stepsPerBar(project) !== 0) return;
  const chord2 = currentChord(project, section, context.step);
  chordRhythmStarts(project, context.time, section.chords.rhythmMode).forEach(([time, duration], index) => {
    events.push(baseEvent(project, section, context, {
      idSuffix: `_${index}`,
      time,
      tick: context.tick + Math.round((time - context.time) / beatSeconds(project) * project.meta.ppq),
      stem: "chords",
      type: "chord",
      duration,
      velocity: project.mixer.stems.chords?.volume ?? DEFAULT_STEM_MIX.chords.volume,
      midiNotes: chordMidiNotes(project, section, chord2),
      instrument: section.chords.instrument,
      articulation: section.chords.playMode
    }));
  });
}
function addMelodyEvents(events, project, section, context) {
  if (project.mixer.stems.melody?.mute) return;
  const anySolo = section.melody.some((track) => track.solo);
  section.melody.forEach((track, trackIndex) => {
    if (track.mute || anySolo && !track.solo) return;
    if (track.hold[context.step] || track.slide[context.step] || isTupletSecond(track.tuplets, context.step)) return;
    const note = track.notes[context.step];
    if (note === null || note === void 0) return;
    if (isTupletStart(track.tuplets, context.step, context.totalSteps)) {
      const next = track.notes[context.step + 1] ?? note;
      const notes = [note, chordsmithPitchedTupletMiddleIndex(note, next, { melodyPitchMode: project.meta.melodyPitchMode }), next];
      const spanDur = spanDuration(project, context.step, 2);
      tripletTimes(project, context.step, context.time).forEach((time, index) => {
        events.push(baseEvent(project, section, context, {
          idSuffix: `_${trackIndex}_${index}`,
          time,
          tick: context.tick + tripletTickOffset(index, project.meta.resolution, project.meta.ppq),
          stem: "melody",
          type: "melody",
          duration: chordsmithPitchedTupletDuration(spanDur),
          velocity: project.mixer.stems.melody?.volume ?? DEFAULT_STEM_MIX.melody.volume,
          midi: melodyMidiAt(project, notes[index], track.octave),
          instrument: track.instrument,
          pan: track.pan,
          tuplet: true,
          humanizeSeed: 10 + trackIndex,
          humanizeStep: context.step + index
        }));
      });
      return;
    }
    const phrase = phraseDuration(project, track.hold, track.slide, context.step, context.totalSteps);
    events.push(baseEvent(project, section, context, {
      idSuffix: `_${trackIndex}`,
      stem: "melody",
      type: "melody",
      duration: phrase.duration,
      velocity: project.mixer.stems.melody?.volume ?? DEFAULT_STEM_MIX.melody.volume,
      midi: melodyMidiAt(project, note, track.octave),
      instrument: track.instrument,
      pan: track.pan,
      slideMidi: phrase.slideStep === null ? void 0 : melodyMidiAt(project, track.notes[phrase.slideStep], track.octave),
      slideOffset: phrase.slideOffset,
      humanizeSeed: 10 + trackIndex
    }));
  });
}
function addGuitarEvents(events, project, section, context) {
  if (project.mixer.stems.guitar?.mute || !section.guitar.enabled) return;
  const art = section.guitar.pattern[context.step];
  if (!art || art === "off" || art === "hold") return;
  const chord2 = currentChord(project, section, context.step);
  events.push(baseEvent(project, section, context, {
    stem: "guitar",
    type: "guitar",
    duration: guitarDuration(project, section, context.step, art, context.totalSteps),
    velocity: section.guitar.volume,
    midiNotes: powerChordNotes(project, section, chord2),
    instrument: section.guitar.tone,
    articulation: art,
    direction: guitarDirection(context.step, section.guitar.strumMode),
    humanizeSeed: 17,
    humanizeVelocity: false
  }));
}
function baseEvent(project, section, context, patch) {
  const humanizeStep = patch.humanizeStep ?? context.step;
  const time = patch.time ?? context.time;
  const velocity = patch.velocity ?? 1;
  const event2 = {
    id: `${section.id}_${context.arrangementIndex}_${patch.stem}_${patch.type}_${context.step}${patch.idSuffix || ""}`,
    time: humanizedTime(project, time, humanizeStep, patch.humanizeSeed),
    duration: patch.duration ?? stepDurationSeconds(project.meta, context.step),
    tick: patch.tick ?? context.tick,
    durationTicks: patch.durationTicks ?? Math.max(1, Math.round((patch.duration ?? stepDurationSeconds(project.meta, context.step)) / beatSeconds(project) * project.meta.ppq)),
    step: context.step,
    bar: context.bar,
    beat: context.beat,
    sectionId: section.id,
    arrangementIndex: context.arrangementIndex,
    stem: patch.stem,
    type: patch.type,
    velocity: patch.humanizeVelocity === false ? velocity : humanizedPeak(project, velocity, humanizeStep, patch.humanizeSeed),
    accent: Boolean(patch.accent),
    tuplet: Boolean(patch.tuplet),
    audioProfile: project.meta.audioProfile || "standard",
    lofiPreset: project.lofi?.presetId || "",
    chipPreset: project.chip?.presetId || "",
    metalPreset: project.metal?.presetId || "",
    funkPreset: project.funk?.presetId || "",
    westernPreset: project.western?.presetId || "",
    soundProfile: cloneJson3(project.soundProfile || { id: project.meta.audioProfile || "standard", preset: "", parameters: {}, recipeVersion: 1 })
  };
  ["midi", "midiNotes", "instrument", "articulation", "sourceArticulation", "pan", "slideMidi", "slideOffset", "direction", "drumKit", "bassTone", "sound", "lane", "role", "expression", "technique", "note", "notes", "sourceDuration", "trackId", "compatibility"].forEach((key) => {
    if (patch[key] !== void 0) event2[key] = patch[key];
  });
  if (project.lofi?.texture?.enabled) event2.lofiTexture = cloneJson3(project.lofi.texture);
  if (project.chip?.texture?.enabled) event2.chipTexture = cloneJson3(project.chip.texture);
  if (project.metal?.texture?.enabled) event2.metalTexture = cloneJson3(project.metal.texture);
  return event2;
}
function projectSoundDrumKit(project) {
  if (project.meta.audioProfile === "chip_arcade" || project.meta.audioProfile === "chip_tune") return project.chip?.drumKit || "chip_noise_kit";
  if (project.meta.audioProfile === "heavy_metal") return project.metal?.drumKit || "metal_tight";
  if (project.meta.audioProfile === "funk_groove") return project.funk?.drumKit || "funk_dry_pocket";
  if (project.meta.audioProfile === "western_frontier") return project.western?.drumKit || "western_train_kit";
  return project.lofi?.drumKit || "classic";
}
function projectSoundBassTone(project) {
  if (project.meta.audioProfile === "chip_arcade" || project.meta.audioProfile === "chip_tune") return project.chip?.bassTone || "chip_triangle_bass";
  if (project.meta.audioProfile === "heavy_metal") return project.metal?.bassTone || "metal_pick_bass";
  if (project.meta.audioProfile === "funk_groove") return project.funk?.bassTone || "funk_finger_pocket";
  if (project.meta.audioProfile === "western_frontier") return project.western?.bassTone || "western_picked_bass";
  return project.lofi?.bassTone || "classic";
}
function humanizedTime(project, time, step, seed) {
  if (seed === void 0 || seed === null) return time;
  return Math.max(0, time + chordsmithHumanizeOffset(step, seed, project.meta.humanizeOn));
}
function humanizedPeak(project, value, step, seed) {
  if (seed === void 0 || seed === null) return value;
  return chordsmithHumanizePeak(value, step, seed, project.meta.humanizeOn);
}
function seedForDrum(lane) {
  if (lane === "kick") return 1;
  if (lane === "snare") return 2;
  return 3;
}
function cloneJson3(value) {
  return JSON.parse(JSON.stringify(value));
}
function roleOrder(stem) {
  return ["drums", "bass", "chords", "melody", "guitar"].indexOf(stem);
}
function currentChord(project, section, step) {
  return chordsmithChordForStep({
    key: project.meta.key,
    scale: project.meta.scale,
    chordType: section.chords.type,
    timeSig: project.meta.timeSig,
    resolution: project.meta.resolution,
    progression: section.progression,
    step
  });
}
function chordMidiNotes(project, section, chord2) {
  return chordsmithChordMidiNotes({
    chord: chord2,
    chordOctave: section.chords.octave,
    chordPlayMode: section.chords.playMode
  });
}
function powerChordNotes(_project, section, chord2) {
  return chordsmithPowerChordNotes({ rootPc: chord2.rootPc, guitarRegister: section.guitar.register });
}
function melodyMidiAt(project, noteIndex2, octave = 0) {
  return chordsmithMelodyIndexToMidi({
    key: project.meta.key,
    scale: project.meta.scale,
    melodyPitchMode: project.meta.melodyPitchMode,
    noteIndex: noteIndex2,
    octave
  });
}
function bassMidiAt(project, section, step) {
  if (section.bass.mode === "manual" && section.bass.notes[step] !== null && section.bass.notes[step] !== void 0) {
    return chordsmithBassIndexToMidi({
      key: project.meta.key,
      scale: project.meta.scale,
      noteIndex: section.bass.notes[step]
    });
  }
  return chordsmithAutoBassMidi({ rootPc: currentChord(project, section, step).rootPc });
}
function phraseDuration(project, holds, slides, step, totalSteps, role = "melody") {
  return chordsmithPhraseInfo({
    step,
    totalSteps,
    role,
    stepDurationAt: (index) => stepDurationSeconds(project.meta, index),
    holdAt: (index) => Boolean(holds[index]),
    slideAt: (index) => Boolean(slides[index])
  });
}
function chordRhythmStarts(project, barStart, mode) {
  return chordsmithChordRhythmStarts({
    mode,
    barStart,
    beatDuration: beatSeconds(project),
    timeSig: project.meta.timeSig
  });
}
function isTupletStart(tuplets, step, totalSteps) {
  return step < totalSteps - 1 && Boolean(tuplets?.[step]);
}
function isTupletSecond(tuplets, step) {
  return step > 0 && Boolean(tuplets?.[step - 1]);
}
function tripletTimes(project, step, start) {
  return tripletTimesForSpan(start, spanDuration(project, step, 2));
}
function spanDuration(project, step, span) {
  return spanDurationSeconds(project.meta, step, span);
}
function stepToTicks(step, resolution, ppq = DEFAULT_PPQ) {
  return Math.round(step / resolution * ppq);
}
function tripletTickOffset(index, resolution, ppq) {
  return Math.round(index / 3 * (2 / resolution) * ppq);
}
function beatSeconds(project) {
  return beatDurationSeconds(project.meta);
}
function bassAccent(section, step) {
  return section.bass.mode === "manual" ? Boolean(section.bass.accent[step]) : Number(section.bass.grid[step] || 0) > 1;
}
function guitarDuration(project, section, step, articulation, totalSteps) {
  const stepDur = stepDurationSeconds(project.meta, step);
  let duration = stepDur;
  let index = step + 1;
  while (index < totalSteps && section.guitar.pattern[index] === "hold") {
    duration += stepDurationSeconds(project.meta, index);
    index += 1;
  }
  return chordsmithGuitarStepDuration({ stepDuration: stepDur, heldDuration: duration, articulation });
}
function guitarDirection(step, mode) {
  if (mode === "up") return "up";
  if (mode === "alternate") return step % 2 ? "up" : DEFAULT_GUITAR_STRUM_MODE;
  return DEFAULT_GUITAR_STRUM_MODE;
}
function richTrackStem(trackId, track) {
  const requested = String(track?.stem || track?.role || trackId || "").toLowerCase();
  if (["drums", "drum", "kick", "snare", "rim", "clap", "hat", "hat_closed", "hat_open", "ride", "crash", "china", "tom_high", "tom_mid", "tom_low", "percussion"].includes(requested)) return "drums";
  if (requested === "bass") return "bass";
  if (["chord", "chords", "harmony", "stab", "stabs"].includes(requested)) return "chords";
  if (requested === "guitar") return "guitar";
  return "melody";
}
function richEventType(stem, lane) {
  if (stem === "drums") return lane || "percussion";
  if (stem === "chords") return "chord";
  if (stem === "melody") return "melody";
  return stem;
}
function richSingleMidi(source) {
  if (source.midi !== void 0) return Number(source.midi);
  if (source.note === void 0 || Array.isArray(source.note)) return void 0;
  return Number(source.note);
}
function richPolyMidi(source) {
  if (Array.isArray(source.midiNotes)) return source.midiNotes.map(Number);
  if (!Array.isArray(source.notes)) return void 0;
  return source.notes.map(Number);
}
function richDefaultSound(project, section, stem) {
  if (stem === "bass") return projectSoundBassTone(project);
  if (stem === "chords") return section.chords.instrument;
  if (stem === "guitar") return section.guitar.tone;
  if (stem === "melody") return section.melody[0]?.instrument;
  return void 0;
}
function defaultRichArticulation(stem, lane) {
  if (stem === "drums") return lane === "hat_open" ? "open" : "finger";
  return "finger";
}
function normaliseRichVelocity(value) {
  const number = Number(value ?? 100);
  return Math.max(0, Math.min(1, number > 1 ? number / 127 : number));
}
function timeAtStep(timeline, step) {
  const leftIndex = Math.floor(step);
  const fraction = step - leftIndex;
  const left = timeline.times[leftIndex] ?? 0;
  const right = timeline.times[leftIndex + 1] ?? left + timeline.duration / Math.max(1, timeline.times.length);
  return left + (right - left) * fraction;
}
function safeId(value) {
  return String(value || "track").replace(/[^a-z0-9_-]/gi, "_");
}

// ../pcs-format/src/index.js
var PCS_LEGACY_SCHEMA_VERSION = 16;
var PCS_SCHEMA_VERSION = 17;
var PCS_SUPPORTED_SCHEMA_VERSIONS = Object.freeze([
  PCS_LEGACY_SCHEMA_VERSION,
  PCS_SCHEMA_VERSION
]);
var PCS_MAX_DECODED_BYTES = 4 * 1024 * 1024;
var PCS_MAX_ENCODED_CHARS = Math.ceil(PCS_MAX_DECODED_BYTES / 3) * 4;
var PCS_PROFILE_IDS = Object.freeze([
  "standard",
  "lofi_chill",
  "chip_arcade",
  "western_frontier",
  "heavy_metal",
  "funk_groove"
]);
var PCS_SOUND_PROFILE_IDS = PCS_PROFILE_IDS;
var PCS_SOUND_PROFILES = Object.freeze({
  standard: Object.freeze({ id: "standard", recipeVersion: 1 }),
  lofi_chill: Object.freeze({ id: "lofi_chill", recipeVersion: 1 }),
  chip_arcade: Object.freeze({ id: "chip_arcade", recipeVersion: 1 }),
  western_frontier: Object.freeze({ id: "western_frontier", recipeVersion: 1 }),
  heavy_metal: Object.freeze({ id: "heavy_metal", recipeVersion: 1 }),
  funk_groove: Object.freeze({ id: "funk_groove", recipeVersion: 1 })
});
var PCS_ARTICULATIONS = Object.freeze([
  "finger",
  "slap",
  "pop",
  "mute",
  "ghost",
  "hammer",
  "pull",
  "slide",
  "hold",
  "staccato",
  "legato",
  "bend",
  "vibrato",
  "tremolo",
  "open",
  "chug",
  "scratch",
  "palm_mute",
  "accent",
  "flam",
  "drag",
  "roll",
  "choke",
  "note",
  "strum_up",
  "strum_down"
]);
var PCS_DRUM_LANES = Object.freeze([
  "kick",
  "snare",
  "rim",
  "clap",
  "hat_closed",
  "hat_open",
  "ride",
  "crash",
  "china",
  "tom_high",
  "tom_mid",
  "tom_low",
  "percussion",
  "hat",
  "open_hat",
  "perc",
  "cowbell"
]);
var PCS_FORMAT_FEATURES = Object.freeze([
  "sound-profile-v1",
  "rich-events-v1",
  "articulations-v1",
  "expanded-drums-v1",
  "capability-report-v1",
  "rich-events",
  "sound-profile",
  "style-profile",
  "articulations",
  "expression",
  "namespaced-technique",
  "expanded-drum-lanes"
]);
var PCS_CAPABILITY_DEFINITIONS = Object.freeze({
  formatFeatures: PCS_FORMAT_FEATURES,
  soundProfiles: PCS_SOUND_PROFILE_IDS,
  articulations: PCS_ARTICULATIONS,
  drumLanes: PCS_DRUM_LANES,
  techniqueNamespace: "<profile-or-vendor>:<technique>",
  technique: "namespace:name string or record<namespace, JSON-value>"
});
var PCS_RICH_EVENT_FIELDS = Object.freeze({
  requiredOneOf: Object.freeze(["tick", "step"]),
  timing: Object.freeze(["tick", "step", "duration"]),
  pitch: Object.freeze(["note", "notes"]),
  expressive: Object.freeze([
    "velocity",
    "articulation",
    "sound",
    "role",
    "expression",
    "technique"
  ]),
  unknownFields: "preserved"
});
var PCS_SCHEMA17_TYPES = Object.freeze({
  soundProfile: Object.freeze({
    required: Object.freeze(["id", "preset", "parameters", "recipeVersion"]),
    id: PCS_PROFILE_IDS,
    parameters: "plain-object musical intent only"
  }),
  event: PCS_RICH_EVENT_FIELDS,
  section: Object.freeze({ tracks: "record<role, {events: RichEvent[]}>" })
});
var PCS_FORMAT_SCOPE = Object.freeze({
  owns: Object.freeze([
    "canonical PCS1 interchange parsing and encoding",
    "schema-16 and schema-17 compatibility metadata",
    "parse/validate/migrate result shape",
    "rich event normalization",
    "sound profile intent",
    "capability negotiation",
    "legacy projection loss reports"
  ]),
  doesNotOwn: Object.freeze([
    "Pocket Chordsmith editor UI defaults",
    "full app runtime normalization",
    "Pocket DJ performance session state",
    "Pocket DAW .pocketdaw schema",
    "Godot chart resources",
    "audio rendering, scheduling, or sound recipes"
  ])
});
var PCS_FIXTURE_ROLES = Object.freeze({
  "schema16-valid.json": "minimal-valid-schema16-preserves-unknown-fields",
  "schema16-invalid.json": "invalid-schema16-error-contract",
  "schema16-trace-smoke.json": "playable-sequence-and-section-summary-smoke",
  "schema17-funk-rich-events.json": "schema17-rich-events-profiles-and-capabilities",
  "schema17-invalid.json": "invalid-schema17-rich-event-contract"
});
function encodePcsPayload(text) {
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > PCS_MAX_DECODED_BYTES) throw payloadTooLargeError();
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return requireBase64Function("btoa")(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decodePcsPayload(payload) {
  if (payload.length > PCS_MAX_ENCODED_CHARS) throw payloadTooLargeError();
  if (!/^[A-Za-z0-9_-]*$/.test(payload)) throw new Error("PCS1 payload contains invalid base64url characters.");
  const estimatedBytes = Math.floor(payload.length * 3 / 4);
  if (estimatedBytes > PCS_MAX_DECODED_BYTES) throw payloadTooLargeError();
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = requireBase64Function("atob")(padded);
  if (binary.length > PCS_MAX_DECODED_BYTES) throw payloadTooLargeError();
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
function payloadTooLargeError() {
  const error = new Error(`PCS payload exceeds ${PCS_MAX_DECODED_BYTES} decoded bytes.`);
  error.code = "payload-too-large";
  return error;
}
function requireBase64Function(name) {
  if (typeof globalThis[name] !== "function") throw new Error(`${name} is required for PCS1 base64url encoding.`);
  return globalThis[name].bind(globalThis);
}

// src/schema/parse-share-code.js
function utf8ToBase64Url(text) {
  return encodePcsPayload(String(text));
}
function base64UrlToUtf8(value) {
  return decodePcsPayload(String(value || ""));
}
function buildPocketChordsmithShareCode(project) {
  return `${PCS_SHARE_PREFIX}${utf8ToBase64Url(JSON.stringify(project))}`;
}
function parsePocketChordsmithShareCode(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed.startsWith(PCS_SHARE_PREFIX)) {
    throw new Error("That does not look like a Pocket Chordsmith PCS1 share code.");
  }
  const payload = trimmed.slice(PCS_SHARE_PREFIX.length).trim();
  if (!payload) throw new Error("That PCS1 share code is empty.");
  let decoded = "";
  try {
    decoded = base64UrlToUtf8(payload);
  } catch {
    throw new Error("That PCS1 share code could not be decoded.");
  }
  try {
    return JSON.parse(decoded);
  } catch {
    throw new Error("That PCS1 share code decoded, but the project JSON was invalid.");
  }
}
function parsePocketChordsmithInput(input) {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) throw new Error("Pocket Audio Core needs a project JSON object, JSON string, or PCS1 share code.");
    if (trimmed.startsWith(PCS_SHARE_PREFIX)) return parsePocketChordsmithShareCode(trimmed);
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error("That does not look like valid Pocket Chordsmith JSON or a PCS1 share code.");
    }
  }
  if (input && typeof input === "object" && !Array.isArray(input)) return input;
  throw new Error("Pocket Audio Core needs a project JSON object, JSON string, or PCS1 share code.");
}

// src/schema/migrations.js
function detectPocketChordsmithSchema(raw) {
  const version = Number(raw?.projectVersion ?? raw?.schemaVersion ?? DEFAULT_SOURCE_SCHEMA_VERSION);
  return Number.isFinite(version) ? Math.max(1, Math.floor(version)) : DEFAULT_SOURCE_SCHEMA_VERSION;
}
function migratePocketChordsmithProject(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Pocket Chordsmith project data must be a JSON object.");
  }
  return {
    project: raw,
    sourceSchemaVersion: detectPocketChordsmithSchema(raw),
    migrationNotes: []
  };
}
function restorePocketChordsmithSource(project) {
  const original = project?.source?.original;
  if (!original || typeof original !== "object" || Array.isArray(original)) {
    throw new Error("That PocketAudioProject does not retain an original PCS source object.");
  }
  return JSON.parse(JSON.stringify(original));
}

// src/schema/normalise-project.js
var DEFAULT_PROGRESSION = Object.freeze([0, 4, 5, 3]);
function normalisePocketChordsmithProject(raw, options = {}) {
  assertPocketAudioProjectResourceLimits(raw);
  const { project, sourceSchemaVersion, migrationNotes } = migratePocketChordsmithProject(raw);
  const soundProfile = normaliseSoundProfile(project);
  const lofi = soundProfile.lofi;
  const chip = soundProfile.chip;
  const metal = soundProfile.metal;
  const funk = soundProfile.funk;
  const western = soundProfile.western;
  const timeSig = safeChoice2(asInt(project.timeSig, DEFAULT_TIME_SIG), [3, 4, 5, 6, 7], DEFAULT_TIME_SIG);
  const resolution = sanitizeResolution(project.resolution ?? project.lastAdvancedResolution ?? DEFAULT_RESOLUTION);
  const sectionBars = normaliseSectionBars(project.sectionBars || project.sectionLengths);
  const requestedSequenceIds = normaliseSequenceIds(project.songSequence || project.sectionSequence);
  const sections = {};
  SECTION_IDS.forEach((id) => {
    sections[id] = normaliseSection(project, id, { timeSig, resolution, sectionBars, requestedSequenceIds });
  });
  const sequence = normaliseSequence(project.songSequence || project.sectionSequence, sections);
  const title2 = String(project.title || project.name || "Pocket Chordsmith Project");
  return {
    app: "PocketAudioProject",
    coreProjectVersion: CORE_PROJECT_VERSION,
    source: {
      sourceType: "pocket-chordsmith",
      sourcePrefix: options.sourcePrefix || "PCS1",
      sourceSchemaVersion,
      original: options.preserveOriginal === false ? void 0 : cloneJson4(project),
      normalizedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    meta: {
      title: title2,
      key: safeChoice2(project.key, NOTES, "C"),
      scale: safeChoice2(project.scale, ["major", "minor"], "major"),
      bpm: clamp3(asInt(project.bpm, DEFAULT_BPM), 40, 240),
      timeSig,
      resolution,
      swing: clamp3(asNumber(project.swing, 0), 0, 0.35),
      ppq: DEFAULT_PPQ,
      melodyPitchMode: safeChoice2(project.melodyPitchMode, ["scale", "chromatic"], "scale"),
      humanizeOn: Boolean(project.humanizeOn),
      audioProfile: soundProfile.audioProfile,
      stylePreset: soundProfile.descriptor.id === "standard" ? String(project.stylePreset || "") : soundProfile.descriptor.preset
    },
    formatFeatures: normaliseFormatFeatures(project, sourceSchemaVersion),
    soundProfile: soundProfile.descriptor,
    lofi,
    chip,
    metal,
    funk,
    western,
    transport: {
      scope: "sequence",
      currentSection: sequence[0] || "A"
    },
    mixer: {
      masterVolume: clamp3(asNumber(project.masterVolume ?? project.masterVol, DEFAULT_MASTER_VOLUME), 0, 1),
      stems: normaliseStemMix(project),
      fx: normaliseFx(project)
    },
    sections,
    sequence,
    markers: [],
    compatibility: {
      coreVersion: POCKET_AUDIO_CORE_VERSION,
      sourceSchemaVersion,
      warnings: migrationNotes,
      losses: [],
      preservesUnknownSource: options.preserveOriginal !== false,
      limitations: []
    }
  };
}
function normaliseSection(project, id, context) {
  const sectionSource = project.sections?.[id] && typeof project.sections[id] === "object" ? project.sections[id] : {};
  const bars = clamp3(asInt(sectionSource.bars, context.sectionBars[id]), 1, 16);
  const steps = context.timeSig * context.resolution * bars;
  const grid = project[`grid${id}`] || {};
  const progressionRaw = sectionSource.progression || project[`progression${id}`];
  const melodyTracks = normaliseMelodyTracks(project[`melodyTracks${id}`] || project[`melody${id}`], steps);
  const guitarPattern = fitArray(project[`guitarPattern${id}`] || project[`rockGuitar${id}`], steps, "off", normaliseGuitarArticulation);
  const bassNotes = fitArray(project[`bassNotes${id}`], steps, null, (value) => normaliseMaybeNote(value, 13));
  const active = id === "A" || context.requestedSequenceIds.includes(id) || hasAnyHits(grid) || melodyTracks.some((track) => track.some((note) => note !== null)) || bassNotes.some((note) => note !== null) || Boolean(project.guitarEnabled) && guitarPattern.some((step) => step !== "off") || progressionDiffers(progressionRaw);
  return {
    ...cloneUnknownSectionData(sectionSource),
    id,
    bars,
    active,
    progression: fitArray(progressionRaw || DEFAULT_PROGRESSION, Math.max(1, context.sectionBars[id]), 0, (value) => clamp3(asInt(value, 0), 0, 6)),
    drums: {
      kick: fitArray(grid.kick, steps, 0, normaliseBeat),
      snare: fitArray(grid.snare, steps, 0, normaliseBeat),
      hat: fitArray(grid.hat, steps, 0, normaliseBeat)
    },
    drumTuplets: normaliseTupletLanes(project[`gridTuplets${id}`], steps),
    bass: {
      mode: safeChoice2(project.bassMode, ["auto", "manual"], "auto"),
      grid: fitArray(grid.bass, steps, 0, normaliseBeat),
      notes: bassNotes,
      hold: fitArray(project[`bassHold${id}`], steps, false, Boolean),
      slide: fitArray(project[`bassSlide${id}`], steps, false, Boolean),
      accent: fitArray(project[`bassAccent${id}`], steps, false, Boolean),
      articulation: fitArray(project[`bassArticulation${id}`], steps, "", (value) => value ? normalisePocketAudioArticulation(value) : "")
    },
    chords: {
      enabled: project.chordsOn !== false,
      instrument: safeChoice2(project.chordInstrument, POCKET_CHORD_INSTRUMENTS, DEFAULT_CHORD_INSTRUMENT),
      type: safeChoice2(project.chordType, ["triad", "seventh", "sus2", "sus4"], "triad"),
      playMode: safeChoice2(project.chordPlayMode, CHORDSMITH_CHORD_PLAY_MODES, "block"),
      rhythmMode: safeChoice2(project.chordRhythmMode, CHORDSMITH_CHORD_RHYTHM_MODES, "sustain"),
      octave: clamp3(asInt(project.chordOctave, 0), -2, 2)
    },
    melody: melodyTracks.map((notes, index) => ({
      notes,
      instrument: safeChoice2((project[`melodyInstruments${id}`] || [])[index], POCKET_MELODY_INSTRUMENTS, DEFAULT_MELODY_INSTRUMENT),
      octave: clamp3(asInt((project[`melodyOctaves${id}`] || [])[index], 0), -2, 2),
      mute: Boolean((project[`melodyMute${id}`] || [])[index]),
      solo: Boolean((project[`melodySolo${id}`] || [])[index]),
      pan: clamp3(asNumber((project[`melodyPan${id}`] || [])[index], 0), -1, 1),
      hold: fitArray((project[`melodyHold${id}`] || [])[index], steps, false, Boolean),
      slide: fitArray((project[`melodySlide${id}`] || [])[index], steps, false, Boolean),
      tuplets: fitArray((project[`melodyTuplets${id}`] || [])[index], steps, false, Boolean)
    })),
    guitar: {
      enabled: Boolean(project.guitarEnabled),
      tone: safeChoice2(project.guitarTone, POCKET_GUITAR_TONES, DEFAULT_GUITAR_TONE),
      register: safeChoice2(project.guitarRegister, POCKET_GUITAR_REGISTERS, DEFAULT_GUITAR_REGISTER),
      strumMode: safeChoice2(project.guitarStrumMode, POCKET_GUITAR_STRUM_MODES, DEFAULT_GUITAR_STRUM_MODE),
      volume: clamp3(asNumber(project.guitarVolume, DEFAULT_STEM_MIX.guitar.volume), 0, 1),
      pattern: guitarPattern
    },
    richTracks: normaliseRichTracks(sectionSource.tracks, { id, steps })
  };
}
function normaliseSoundProfile(project) {
  const descriptor = normalisePocketAudioSoundProfile(project.soundProfile, {
    audioProfile: project.audioProfile,
    stylePreset: project.stylePreset || project.chipPreset || project.metalPreset || project.lofiPreset || project.funkPreset || project.westernPreset
  });
  const activeView = {
    ...project,
    audioProfile: descriptor.id,
    stylePreset: descriptor.preset,
    soundProfile: descriptor,
    lofiPreset: descriptor.id === "lofi_chill" ? descriptor.preset : void 0,
    chipPreset: descriptor.id === CHIP_AUDIO_PROFILE_ID ? descriptor.preset : void 0,
    metalPreset: descriptor.id === HEAVY_METAL_AUDIO_PROFILE_ID ? descriptor.preset : void 0,
    funkPreset: descriptor.id === FUNK_AUDIO_PROFILE_ID ? descriptor.preset : void 0,
    westernPreset: descriptor.id === WESTERN_AUDIO_PROFILE_ID ? descriptor.preset : void 0,
    lofiTexture: descriptor.id === "lofi_chill" ? { ...descriptor.parameters, ...project.lofiTexture, ...project.soundProfile?.parameters, enabled: true } : project.lofiTexture,
    chipTexture: descriptor.id === CHIP_AUDIO_PROFILE_ID ? { ...descriptor.parameters, ...project.chipTexture, ...project.soundProfile?.parameters, enabled: true } : project.chipTexture,
    metalTexture: descriptor.id === HEAVY_METAL_AUDIO_PROFILE_ID ? { ...descriptor.parameters, ...project.metalTexture, ...project.soundProfile?.parameters, enabled: true } : project.metalTexture
  };
  return {
    descriptor,
    audioProfile: descriptor.id,
    chip: descriptor.id === CHIP_AUDIO_PROFILE_ID ? normaliseChipProjectSettings(activeView) : normaliseChipProjectSettings({ audioProfile: "standard" }),
    metal: descriptor.id === HEAVY_METAL_AUDIO_PROFILE_ID ? normaliseMetalProjectSettings(activeView) : normaliseMetalProjectSettings({ audioProfile: "standard" }),
    lofi: descriptor.id === "lofi_chill" ? normaliseLofiProjectSettings(activeView) : normaliseLofiProjectSettings({ audioProfile: "standard" }),
    funk: descriptor.id === FUNK_AUDIO_PROFILE_ID ? normaliseFunkProjectSettings(activeView) : normaliseFunkProjectSettings({ audioProfile: "standard", soundProfile: { id: "standard" } }),
    western: descriptor.id === WESTERN_AUDIO_PROFILE_ID ? normaliseWesternProjectSettings(activeView) : normaliseWesternProjectSettings({ audioProfile: "standard", soundProfile: { id: "standard" } })
  };
}
function normaliseFormatFeatures(project, sourceSchemaVersion) {
  const source = Array.isArray(project.formatFeatures) ? project.formatFeatures.map((item) => String(item)).filter(Boolean) : [];
  if (sourceSchemaVersion < 17 && !project.soundProfile && !hasRichTracks(project.sections)) return source;
  return [.../* @__PURE__ */ new Set([...POCKET_AUDIO_FORMAT_FEATURES, ...source])];
}
function hasRichTracks(sections) {
  return Object.values(sections || {}).some((section) => Object.values(section?.tracks || {}).some((track) => Array.isArray(track?.events) && track.events.length));
}
function normaliseRichTracks(value, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  Object.entries(value).forEach(([trackId, track]) => {
    if (!track || typeof track !== "object" || Array.isArray(track)) return;
    out[trackId] = {
      ...cloneJson4(track),
      events: (Array.isArray(track.events) ? track.events : []).map((event2, index) => normaliseRichEvent(event2, { ...context, trackId, index }))
    };
  });
  return out;
}
function normaliseRichEvent(value, context) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const step = source.step === void 0 ? void 0 : clamp3(asNumber(source.step, 0), 0, Math.max(0, context.steps - 1e-6));
  const tick = source.tick === void 0 ? void 0 : Math.max(0, asInt(source.tick, 0));
  const articulation = source.articulation === void 0 ? void 0 : normalisePocketAudioArticulation(source.articulation);
  const notes = Array.isArray(source.notes) ? source.notes.map((note) => asNumber(note, 0)) : void 0;
  return {
    ...cloneJson4(source),
    ...step !== void 0 ? { step } : {},
    ...tick !== void 0 ? { tick } : {},
    duration: Math.max(0.01, asNumber(source.duration, 1)),
    ...source.durationTicks === void 0 ? {} : { durationTicks: Math.max(1, asInt(source.durationTicks, 1)) },
    ...source.note === void 0 ? {} : { note: asNumber(source.note, 0) },
    ...notes ? { notes } : {},
    velocity: clamp3(asNumber(source.velocity, 100), 0, 127),
    ...articulation ? { articulation } : {},
    ...source.sound === void 0 ? {} : { sound: String(source.sound) },
    ...source.lane === void 0 ? {} : { lane: String(source.lane) },
    role: normalisePocketAudioRole(source.role),
    expression: normalisePocketAudioExpression(source.expression),
    technique: normalisePocketAudioTechnique(source.technique)
  };
}
function cloneUnknownSectionData(section) {
  const copy = cloneJson4(section || {});
  delete copy.bars;
  delete copy.progression;
  delete copy.tracks;
  return copy;
}
function normaliseStemMix(project) {
  const out = cloneJson4(DEFAULT_STEM_MIX);
  out.drums.volume = clamp3(asNumber(project.beatVolume ?? project.beatVol, out.drums.volume), 0, 1);
  out.bass.volume = clamp3(asNumber(project.beatVolume ?? project.beatVol, out.bass.volume), 0, 1);
  out.chords.volume = clamp3(asNumber(project.chordVolume ?? project.chordVol, out.chords.volume), 0, 1);
  out.melody.volume = clamp3(asNumber(project.leadVolume ?? project.leadVol, out.melody.volume), 0, 1);
  out.guitar.volume = clamp3(asNumber(project.guitarVolume, out.guitar.volume), 0, 1);
  STEM_IDS.forEach((id) => {
    out[id].mute = id === "bass" ? project.bassOn === false : id === "chords" ? project.chordsOn === false : false;
  });
  return out;
}
function normaliseFx(project) {
  const lofi = normaliseLofiProjectSettings(project);
  const metal = normaliseMetalProjectSettings(project);
  return {
    ...cloneJson4(DEFAULT_FX),
    delay: clamp3(asNumber(project.fxDelay, DEFAULT_FX.delay), 0, 1),
    chorus: clamp3(asNumber(project.fxChorus, DEFAULT_FX.chorus), 0, 1),
    flanger: clamp3(asNumber(project.fxFlanger, DEFAULT_FX.flanger), 0, 1),
    reverb: clamp3(asNumber(project.fxReverb, DEFAULT_FX.reverb), 0, 1),
    mix: clamp3(asNumber(project.fxMix, DEFAULT_FX.mix), 0, 1),
    sidechain: {
      enabled: Boolean(project.sidechainOn ?? project.pumpChordsEnabled),
      amount: clamp3(asNumber(project.sidechainAmount ?? project.pumpAmount, DEFAULT_FX.sidechain.amount), 0, 1)
    },
    lofiTexture: lofi.texture,
    metalTexture: metal.texture
  };
}
function normaliseSequence(value, sections) {
  const source = normaliseSequenceIds(value);
  const sequence = (source.length ? source : ["A"]).slice(0, MAX_SEQUENCE_SLOTS);
  return sequence.length ? sequence : SECTION_IDS.filter((id) => sections[id]?.active).slice(0, 1);
}
function normaliseSequenceIds(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "A").toUpperCase()).filter((id) => SECTION_IDS.includes(id));
}
function normaliseSectionBars(value) {
  const out = {};
  SECTION_IDS.forEach((id) => {
    out[id] = clamp3(asInt(value?.[id], 4), 1, 16);
  });
  return out;
}
function normaliseMelodyTracks(value, steps) {
  const source = Array.isArray(value) && value.length ? value : [new Array(steps).fill(null)];
  return source.slice(0, 8).map((track) => fitArray(track, steps, null, (note) => normaliseMaybeNote(note, 23)));
}
function normaliseTupletLanes(value, steps) {
  return {
    kick: fitArray(value?.kick, steps, false, Boolean),
    snare: fitArray(value?.snare, steps, false, Boolean),
    hat: fitArray(value?.hat, steps, false, Boolean),
    bass: fitArray(value?.bass, steps, false, Boolean)
  };
}
function fitArray(value, length, fallback, normaliser = (item) => item) {
  const out = new Array(length).fill(fallback);
  const source = Array.isArray(value) ? value : [];
  for (let index = 0; index < Math.min(length, source.length); index += 1) {
    out[index] = normaliser(source[index]);
  }
  return out;
}
function hasAnyHits(grid) {
  return ["kick", "snare", "hat", "bass"].some((lane) => Array.isArray(grid?.[lane]) && grid[lane].some((value) => normaliseBeat(value) > 0));
}
function progressionDiffers(value) {
  if (!Array.isArray(value)) return false;
  return value.some((item, index) => clamp3(asInt(item, DEFAULT_PROGRESSION[index] ?? 0), 0, 6) !== (DEFAULT_PROGRESSION[index] ?? 0));
}
function normaliseBeat(value) {
  return clamp3(asInt(value, 0), 0, 2);
}
function normaliseMaybeNote(value, max) {
  if (value === null || value === void 0 || value === "") return null;
  const note = asInt(value, -1);
  return note < 0 ? null : clamp3(note, 0, max);
}
function normaliseGuitarArticulation(value) {
  const safe = String(value || "off").toLowerCase();
  return safeChoice2(safe, POCKET_GUITAR_ARTICULATIONS, "off");
}
function safeChoice2(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}
function asInt(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : fallback;
}
function asNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function clamp3(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function sanitizeResolution(value) {
  return safeChoice2(asInt(value, DEFAULT_RESOLUTION), [1, 2, 3, 4, 6, 8, 12, 16], DEFAULT_RESOLUTION);
}
function cloneJson4(value) {
  return JSON.parse(JSON.stringify(value));
}

// src/music/scales.js
function noteIndex(note) {
  return chordsmithNoteIndex(note);
}
function scalePitchClasses(key = "C", scale = "major") {
  return chordsmithScalePitchClasses({ key, scale });
}
function scaleDegreeToMidi(project, degree, octaveBase = 60) {
  const pcs = scalePitchClasses(project?.meta?.key, project?.meta?.scale);
  const safe = Math.max(0, Math.min(13, Number.parseInt(degree, 10) || 0));
  return octaveBase + pcs[safe % 7] + Math.floor(safe / 7) * 12;
}

// src/music/chords.js
function chordQuality(scale, degree) {
  return chordsmithChordQuality(scale, degree);
}
function chordIntervals(type = "triad", quality = "maj") {
  return chordsmithChordIntervals({ chordType: type, quality });
}
function chordMidiNotes2(project, degree, octave = 0) {
  const pcs = chordsmithScalePitchClasses({ key: project?.meta?.key, scale: project?.meta?.scale });
  const safeDegree = Math.max(0, Math.min(6, Number.parseInt(degree, 10) || 0));
  const quality = chordQuality(project?.meta?.scale, safeDegree);
  const root = 48 + pcs[safeDegree] + octave * 12;
  return chordIntervals(project?.sections?.A?.chords?.type || "triad", quality).map((interval, index) => root + interval + (index === 0 ? 0 : 12));
}

// src/engine/audio-context.js
async function createAudioContext(options = {}) {
  const Ctor = options.AudioContext || globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctor) throw new Error("Web Audio is not available in this environment.");
  const context = new Ctor(options.contextOptions || {});
  if (context.state === "suspended" && typeof context.resume === "function") await context.resume();
  return context;
}
async function resumeAudioContext(context) {
  if (context?.state === "suspended" && typeof context.resume === "function") await context.resume();
  return context;
}

// src/engine/buses.js
function createMixerState(overrides = {}) {
  const stems = JSON.parse(JSON.stringify(DEFAULT_STEM_MIX));
  STEM_IDS.forEach((id) => {
    stems[id] = { ...stems[id], ...overrides.stems?.[id] || {} };
  });
  return {
    masterVolume: overrides.masterVolume ?? DEFAULT_MASTER_VOLUME,
    stems,
    fx: overrides.fx || {}
  };
}
function setStemValue(mixer, stem, patch) {
  if (!mixer?.stems?.[stem]) throw new Error(`Unknown stem: ${stem}`);
  mixer.stems[stem] = { ...mixer.stems[stem], ...patch };
  return mixer;
}

// src/engine/scheduler.js
var PocketScheduler = class {
  constructor({ lookaheadSeconds = 0.22, intervalMs = 25, now = () => 0 } = {}) {
    this.lookaheadSeconds = lookaheadSeconds;
    this.intervalMs = intervalMs;
    this.now = now;
    this.timer = null;
    this.callback = () => {
    };
  }
  start(callback) {
    this.stop();
    this.callback = callback || this.callback;
    this.timer = setInterval(() => this.callback(this.now() + this.lookaheadSeconds), this.intervalMs);
  }
  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
  isRunning() {
    return this.timer !== null;
  }
};

// src/export/wav.js
function createSilentWavBlob({ durationSeconds = 0.25, sampleRate = 44100, channels = 2 } = {}) {
  const frameCount = Math.max(1, Math.ceil(durationSeconds * sampleRate));
  return encodePcm16WavBlob({
    channels: Array.from({ length: channels }, () => new Float32Array(frameCount)),
    sampleRate
  });
}
function encodePcm16WavBlob({ channels, sampleRate = 44100 }) {
  return new Blob([encodePcm16WavBytes({ channels, sampleRate })], { type: "audio/wav" });
}
function encodePcm16WavBytes({ channels, sampleRate = 44100 }) {
  return encodePcmWavBytes({ channels, sampleRate, bitDepth: 16 });
}
function encodePcm24WavBlob({ channels, sampleRate = 44100 }) {
  return new Blob([encodePcm24WavBytes({ channels, sampleRate })], { type: "audio/wav" });
}
function encodePcm24WavBytes({ channels, sampleRate = 44100 }) {
  return encodePcmWavBytes({ channels, sampleRate, bitDepth: 24 });
}
function encodePcmWavBlob({ channels, sampleRate = 44100, bitDepth = 16, dither = "off" }) {
  return new Blob([encodePcmWavBytes({ channels, sampleRate, bitDepth, dither })], { type: "audio/wav" });
}
function encodePcmWavBytes({ channels, sampleRate = 44100, bitDepth = 16, dither = "off" }) {
  const channelCount = Math.max(1, channels.length);
  const frameCount = Math.max(1, channels[0]?.length || 1);
  const depth = normaliseBitDepth(bitDepth);
  const bytesPerSample = depth / 8;
  const dataLength = frameCount * channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, depth, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataLength, true);
  let offset = 44;
  const ditherNoise = dither === "tpdf" && depth === 16 ? createTpdfDither(334462) : null;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const data = channels[channel] || channels[0];
      const raw = Number.isFinite(data[frame]) ? data[frame] : 0;
      const sample = Math.max(-1, Math.min(1, raw + (ditherNoise ? ditherNoise() / 32767 : 0)));
      writePcmSample(view, offset, sample, depth);
      offset += bytesPerSample;
    }
  }
  return new Uint8Array(buffer);
}
function decodePcmWavBytes(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 44 || readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WAVE") {
    throw new Error("Expected a RIFF/WAVE file.");
  }
  let offset = 12;
  let fmt3 = null;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= bytes.byteLength) {
    const id = readAscii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const payloadOffset = offset + 8;
    if (payloadOffset + size > bytes.byteLength) throw new Error("Invalid WAV chunk size.");
    if (id === "fmt ") {
      fmt3 = {
        audioFormat: view.getUint16(payloadOffset, true),
        channels: view.getUint16(payloadOffset + 2, true),
        sampleRate: view.getUint32(payloadOffset + 4, true),
        bitsPerSample: view.getUint16(payloadOffset + 14, true)
      };
    } else if (id === "data") {
      dataOffset = payloadOffset;
      dataSize = size;
      break;
    }
    offset = payloadOffset + size + size % 2;
  }
  if (!fmt3 || dataOffset < 0) throw new Error("WAV file is missing fmt or data chunks.");
  if (fmt3.audioFormat !== 1 || ![16, 24].includes(fmt3.bitsPerSample)) {
    throw new Error(`Unsupported WAV format: format=${fmt3.audioFormat} bits=${fmt3.bitsPerSample}.`);
  }
  const bytesPerSample = fmt3.bitsPerSample / 8;
  const frameCount = Math.floor(dataSize / (fmt3.channels * bytesPerSample));
  const channels = Array.from({ length: fmt3.channels }, () => new Float32Array(frameCount));
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < fmt3.channels; channel += 1) {
      const sampleOffset = dataOffset + (frame * fmt3.channels + channel) * bytesPerSample;
      channels[channel][frame] = readPcmSample(view, sampleOffset, fmt3.bitsPerSample);
    }
  }
  return {
    channels,
    sampleRate: fmt3.sampleRate,
    duration: frameCount / fmt3.sampleRate,
    bitDepth: fmt3.bitsPerSample
  };
}
function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}
function readAscii(view, offset, length) {
  let text = "";
  for (let index = 0; index < length; index += 1) text += String.fromCharCode(view.getUint8(offset + index));
  return text;
}
function normaliseBitDepth(value) {
  return Number(value) === 24 ? 24 : 16;
}
function writePcmSample(view, offset, sample, bitDepth) {
  if (bitDepth === 24) {
    const scaled2 = sample < 0 ? Math.round(sample * 8388608) : Math.round(sample * 8388607);
    const value = Math.max(-8388608, Math.min(8388607, scaled2));
    const unsigned = value < 0 ? value + 16777216 : value;
    view.setUint8(offset, unsigned & 255);
    view.setUint8(offset + 1, unsigned >> 8 & 255);
    view.setUint8(offset + 2, unsigned >> 16 & 255);
    return;
  }
  const scaled = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
  view.setInt16(offset, Math.max(-32768, Math.min(32767, scaled)), true);
}
function readPcmSample(view, offset, bitDepth) {
  if (bitDepth === 24) {
    const raw = view.getUint8(offset) | view.getUint8(offset + 1) << 8 | view.getUint8(offset + 2) << 16;
    const signed2 = raw & 8388608 ? raw - 16777216 : raw;
    return signed2 / (signed2 < 0 ? 8388608 : 8388607);
  }
  const signed = view.getInt16(offset, true);
  return signed / (signed < 0 ? 32768 : 32767);
}
function createTpdfDither(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    return state / 4294967295;
  };
  return () => next() - next();
}

// src/engine/offline-renderer.js
async function renderWav(project, options = {}) {
  return renderPocketAudioWav(project, options);
}
function renderPocketAudioBuffer(project, options = {}) {
  const sampleRate = options.sampleRate || 44100;
  const timeline = buildPocketAudioTimeline(project, options);
  return renderPocketAudioEventBuffer(timeline.events, {
    ...options,
    durationSeconds: timeline.duration,
    lofiTexture: project?.lofi?.texture,
    timeline
  });
}
function renderPocketAudioStemBuffers(project, options = {}) {
  const sampleRate = options.sampleRate || 44100;
  const stems = options.stems || ["drums", "bass", "chords", "melody", "guitar"];
  const timeline = buildPocketAudioTimeline(project, options);
  const out = {};
  stems.forEach((stem) => {
    out[stem] = renderPocketAudioEventBuffer(timeline.events.filter((event2) => event2.stem === stem), {
      ...options,
      sampleRate,
      durationSeconds: timeline.duration,
      lofiTexture: null,
      timeline: {
        ...timeline,
        events: timeline.events.filter((event2) => event2.stem === stem)
      }
    });
  });
  return out;
}
function renderPocketAudioEventBuffer(events, options = {}) {
  const sampleRate = options.sampleRate || 44100;
  const tailSeconds = options.tailSeconds ?? 0.6;
  const durationSeconds = Number.isFinite(options.durationSeconds) ? Math.max(0, Number(options.durationSeconds)) : events.reduce((duration, event2) => Math.max(duration, Number(event2.time || 0) + Number(event2.duration || 0)), 0);
  const frameCount = Math.max(1, Math.ceil((durationSeconds + tailSeconds) * sampleRate));
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  events.forEach((event2) => renderEventToChannels(event2, left, right, sampleRate));
  renderLofiTexture({ lofi: { texture: options.lofiTexture } }, left, right, sampleRate);
  return {
    channels: [left, right],
    sampleRate,
    duration: frameCount / sampleRate,
    eventCount: events.length,
    timeline: options.timeline || { events, duration: durationSeconds }
  };
}
function renderLofiTexture(project, left, right, sampleRate) {
  const texture = project?.lofi?.texture;
  if (!texture?.enabled) return;
  const hiss = clamp014(texture.tapeHiss);
  const crackle = clamp014(texture.vinylCrackle);
  if (hiss <= 5e-3 && crackle <= 5e-3) return;
  const crackleWindow = chordsmithLofiTextureOfflineCrackleWindow(sampleRate);
  const warmthGain = CHORDSMITH_LOFI_TEXTURE_OFFLINE.warmthGainBase + clamp014(texture.warmth) * CHORDSMITH_LOFI_TEXTURE_OFFLINE.warmthGainRange;
  const lowpassHz = CHORDSMITH_LOFI_TEXTURE_OFFLINE.lowpassBaseHz - clamp014(texture.lowPassAge) * CHORDSMITH_LOFI_TEXTURE_OFFLINE.lowpassAgeHz;
  const state = createTextureFilterState(sampleRate, CHORDSMITH_LOFI_TEXTURE_OFFLINE.highpassHz, lowpassHz);
  for (let index = 0; index < left.length; index += 1) {
    const dry = chordsmithLofiTextureOfflineSample(index, texture, crackleWindow);
    const filtered = filterTextureSample(dry, state) * warmthGain;
    left[index] = clampAudio(left[index] + filtered);
    right[index] = clampAudio(right[index] + filtered);
  }
}
function createTextureFilterState(sampleRate, highpassHz, lowpassHz) {
  const hpRc = 1 / (2 * Math.PI * highpassHz);
  const lpRc = 1 / (2 * Math.PI * lowpassHz);
  const dt = 1 / sampleRate;
  return {
    highpassAlpha: hpRc / (hpRc + dt),
    lowpassAlpha: dt / (lpRc + dt),
    previousInput: 0,
    highpass: 0,
    lowpass: 0
  };
}
function filterTextureSample(input, state) {
  state.highpass = state.highpassAlpha * (state.highpass + input - state.previousInput);
  state.previousInput = input;
  state.lowpass += state.lowpassAlpha * (state.highpass - state.lowpass);
  return state.lowpass;
}
function renderPocketAudioWav(project, options = {}) {
  const buffer = renderPocketAudioBuffer(project, options);
  return encodePcm16WavBlob({ channels: buffer.channels, sampleRate: buffer.sampleRate });
}
function renderEventToChannels(event2, left, right, sampleRate) {
  const funk = event2.audioProfile === "funk_groove" ? funkParameters(event2) : null;
  const pocketOffset = funk && Number(event2.step || 0) % 2 !== 0 ? (funk.pocket - 0.5) * 0.03 : 0;
  const durationScale = funk && event2.type === "chord" ? 1 - funk.stabTightness * 0.68 : 1;
  const start = Math.max(0, Math.floor((Number(event2.time || 0) + pocketOffset) * sampleRate));
  const length = Math.max(1, Math.floor(Math.max(0.02, (event2.duration || 0.08) * durationScale) * sampleRate));
  const pan = Math.max(-1, Math.min(1, Number(event2.pan || 0)));
  const leftGain = Math.cos((pan + 1) * Math.PI / 4);
  const rightGain = Math.sin((pan + 1) * Math.PI / 4);
  const ghostScale = funk && ["snare", "rim", "clap"].includes(String(event2.type || event2.lane)) && !event2.accent ? 0.46 + funk.ghostNotes * 0.5 : 1;
  const gain2 = Math.min(0.9, Math.max(0, Number(event2.velocity || 0.5))) * stemScale(event2.stem) * ghostScale;
  const freq = eventFrequency(event2);
  const voice = eventVoice(event2, freq);
  const state = createVoiceRenderState(voice, sampleRate);
  for (let index = 0; index < length && start + index < left.length; index += 1) {
    const t = index / sampleRate;
    const env = voiceEnvelope(voice, index / length);
    if (voice.stereo) {
      const sample = stereoWaveform(voice, t, start + index, state, sampleRate);
      left[start + index] += sample[0] * gain2 * env * leftGain;
      right[start + index] += sample[1] * gain2 * env * rightGain;
    } else {
      const sample = waveform(voice, t, start + index, index, state, sampleRate) * gain2 * env;
      left[start + index] += sample * leftGain;
      right[start + index] += sample * rightGain;
    }
  }
}
function eventVoice(event2, freq) {
  const drumType = canonicalDrumVoice(event2.type || event2.lane);
  if (drumType === "kick") return kickVoice(event2);
  if (drumType === "snare") return snareVoice(event2);
  if (drumType === "hat") return hatVoice(event2);
  if (drumType === "tom") return tomVoice(event2);
  if (drumType === "cymbal") return cymbalVoice(event2);
  if (drumType === "percussion") return percussionVoice(event2);
  if (isChipEvent(event2)) return chipVoice(event2, freq);
  if (event2.type === "guitar") return guitarVoice(event2);
  if (event2.type === "bass") return bassVoice(event2, freq);
  if (event2.type === "chord") return chordVoice(event2);
  if (event2.type === "melody") return melodyVoice(event2, freq);
  return { type: "basic", freq };
}
function waveform(voice, t, seed, index, state, sampleRate) {
  if (voice.type === "kick") return kickSample(voice, t);
  if (voice.type === "snare") return snareSample(voice, t, seed);
  if (voice.type === "hat") return hatSample(voice, seed);
  if (voice.type === "tom") return tomSample(voice, t);
  if (voice.type === "cymbal") return cymbalSample(voice, t, seed);
  if (voice.type === "percussion") return percussionSample(voice, t, seed);
  if (voice.type === "guitar") return guitarSample(voice, t);
  if (voice.type === "bass") return bassSample(voice, t);
  if (voice.type === "metal-bass") return metalBassSample(voice, t, seed);
  if (voice.type === "funk-bass") return funkBassSample(voice, t, seed);
  if (voice.type === "chip") return chipSample(voice, t, index, sampleRate);
  if (voice.type === "chord") return chordSample(voice, t);
  if (voice.type === "melody") return melodySample(voice, t);
  return Math.sin(2 * Math.PI * voice.freq * t);
}
function kickVoice(event2) {
  const cfg = drumKitConfig(event2).kick || {};
  return {
    type: "kick",
    startFreq: Number(cfg.startFreq || 150),
    endFreq: Number(cfg.endFreq || 45),
    sweepSeconds: Math.max(0.02, Number(cfg.sweepSeconds || 0.14)),
    gain: Number(cfg.gainScale || 1) * 0.9 + Number(cfg.gainFloor || 0)
  };
}
function kickSample(voice, t) {
  const progress = Math.min(1, t / voice.sweepSeconds);
  const freq = voice.startFreq + (voice.endFreq - voice.startFreq) * progress;
  return Math.sin(2 * Math.PI * freq * t) * voice.gain;
}
function snareVoice(event2) {
  const cfg = drumKitConfig(event2).snare || {};
  return {
    type: "snare",
    bodyFreq: Number(cfg.bodyFreq || 190),
    bodyGain: Number(cfg.bodyGain ?? 0.2),
    noiseGain: Number(cfg.gainScale || 1) * 0.72 + Number(cfg.gainFloor || 0)
  };
}
function snareSample(voice, t, seed) {
  const noise = deterministicNoise(seed) * voice.noiseGain;
  return noise + Math.sin(2 * Math.PI * voice.bodyFreq * t) * voice.bodyGain;
}
function hatVoice(event2) {
  const cfg = drumKitConfig(event2).hat || {};
  const open = event2.articulation === "open" || event2.type === "openhat" || event2.accent;
  const highpass = Number(open ? cfg.highpassOpen : cfg.highpassClosed) || 5600;
  const brightness = Math.max(0.25, Math.min(1.4, highpass / 5600));
  const gainScale = Number(open ? cfg.gainScaleOpen : cfg.gainScaleClosed) || 1;
  return { type: "hat", gain: 0.62 * brightness * gainScale };
}
function hatSample(voice, seed) {
  return deterministicNoise(seed) * voice.gain;
}
function tomVoice(event2) {
  const lane = String(event2.lane || event2.type || "tom_mid");
  const frequency = lane.includes("high") ? 218 : lane.includes("low") ? 118 : 158;
  return { type: "tom", frequency, endFrequency: frequency * 0.58, sweepSeconds: 0.22, gain: event2.articulation === "ghost" ? 0.46 : 0.72 };
}
function tomSample(voice, t) {
  const progress = Math.min(1, t / voice.sweepSeconds);
  const frequency = voice.frequency + (voice.endFrequency - voice.frequency) * progress;
  return Math.sin(2 * Math.PI * frequency * t) * voice.gain;
}
function cymbalVoice(event2) {
  const lane = String(event2.lane || event2.type || "crash");
  return { type: "cymbal", gain: lane === "ride" ? 0.34 : lane === "china" ? 0.52 : 0.46, bell: lane === "ride" ? 980 : 620 };
}
function cymbalSample(voice, t, seed) {
  return deterministicNoise(seed) * voice.gain + Math.sin(2 * Math.PI * voice.bell * t) * 0.09;
}
function percussionVoice(event2) {
  const fallback = pocketAudioDrumLaneFallback(event2.lane || event2.type);
  return { type: "percussion", gain: fallback === "clap" ? 0.48 : 0.36, body: fallback === "snare" ? 420 : 760 };
}
function percussionSample(voice, t, seed) {
  return deterministicNoise(seed) * voice.gain + Math.sin(2 * Math.PI * voice.body * t) * 0.12;
}
function bassVoice(event2, freq) {
  const cfg = POCKET_BASS_TONE_CONFIGS[resolvePocketBassToneId(event2.bassTone)] || POCKET_BASS_TONE_CONFIGS.classic;
  if (event2.audioProfile === "heavy_metal") {
    const texture = metalTexture(event2);
    return {
      type: "metal-bass",
      freq,
      mainWave: cfg.mainWave || "sawtooth",
      cleanGain: Number(cfg.subPeak || 0.35) * 0.62,
      gritGain: Number(cfg.mainPeak || 1) * 0.56,
      drive: 1.5 + texture.drive * 5,
      tightness: texture.lowTightness,
      presence: texture.presence,
      pickAttack: texture.pickAttack
    };
  }
  if (event2.audioProfile === "funk_groove") {
    const parameters = funkParameters(event2);
    return {
      type: "funk-bass",
      mainWave: cfg.mainWave || "triangle",
      mainFreq: freq,
      mainPeak: Number(cfg.mainPeak || 1) * 0.68,
      subWave: cfg.subWave || "sine",
      subFreq: freq * 0.5,
      subPeak: Number(cfg.subPeak || 0.35) * 0.42,
      articulation: event2.articulation || "finger",
      slapAmount: parameters.slapAmount,
      popBrightness: parameters.popBrightness,
      muteDepth: parameters.muteDepth
    };
  }
  return {
    type: "bass",
    mainWave: cfg.mainWave || "sawtooth",
    mainFreq: freq,
    mainPeak: Number(cfg.mainPeak || 1) * 0.68,
    subWave: cfg.subWave || "sine",
    subFreq: freq * 0.5,
    subPeak: Number(cfg.subPeak || 0.35) * 0.42
  };
}
function bassSample(voice, t) {
  return oscSample(voice.mainWave, voice.mainFreq, t) * voice.mainPeak + oscSample(voice.subWave, voice.subFreq, t) * voice.subPeak;
}
function metalBassSample(voice, t, seed) {
  const clean = Math.sin(2 * Math.PI * voice.freq * t) * voice.cleanGain;
  const picked = oscSample(voice.mainWave, voice.freq, t) * (0.65 + voice.presence * 0.35);
  const grit = Math.tanh(picked * voice.drive) * voice.gritGain;
  const pick = deterministicNoise(seed) * Math.exp(-t * 110) * voice.pickAttack * 0.28;
  return clean * (0.82 + voice.tightness * 0.18) + grit * (0.72 - voice.tightness * 0.18) + pick;
}
function funkBassSample(voice, t, seed) {
  const body = bassSample(voice, t);
  if (voice.articulation === "mute" || voice.articulation === "ghost") {
    return body * (0.16 + (1 - voice.muteDepth) * 0.18) + deterministicNoise(seed) * Math.exp(-t * 95) * 0.2;
  }
  if (voice.articulation === "slap") {
    return body * 0.86 + deterministicNoise(seed) * Math.exp(-t * 125) * (0.15 + voice.slapAmount * 0.3) + Math.sin(2 * Math.PI * voice.mainFreq * 2 * t) * 0.08;
  }
  if (voice.articulation === "pop") {
    return body * 0.78 + deterministicNoise(seed + 17) * Math.exp(-t * 150) * (0.12 + voice.popBrightness * 0.28) + oscSample("triangle", voice.mainFreq * 2, t) * voice.popBrightness * 0.16;
  }
  if (voice.articulation === "hammer" || voice.articulation === "pull") {
    const progress = Math.min(1, t * 24);
    const startSemitones = voice.articulation === "hammer" ? -2 : 2;
    const ratio = Math.pow(2, startSemitones * (1 - progress) / 12);
    const connected = oscSample(voice.mainWave, voice.mainFreq * ratio, t) * voice.mainPeak + oscSample(voice.subWave, voice.subFreq * ratio, t) * voice.subPeak;
    const directionColour = voice.articulation === "hammer" ? progress * 0.08 : (1 - progress) * 0.08;
    return connected * (0.78 + progress * 0.22) + oscSample("triangle", voice.mainFreq * 2, t) * directionColour;
  }
  return body;
}
function chordVoice(event2) {
  const cfg = findPocketChordInstrumentConfig(event2.instrument);
  const notes = event2.midiNotes?.length ? event2.midiNotes : [event2.midi || 60];
  const layers = cfg.layers?.length ? cfg.layers : [{ wave: cfg.wave || "sine", level: 1 }];
  let count = 0;
  const oscillators = [];
  notes.forEach((midi, noteIndex2) => {
    const base = midiToFreq(midi);
    layers.forEach((layer) => {
      const level = Number(layer.level || 1);
      oscillators.push({
        wave: layer.wave || (noteIndex2 === 0 ? cfg.rootWave : cfg.wave) || "sine",
        freq: base * Number(layer.freqMul || 1),
        detune: Number(layer.detune || 0),
        level
      });
      count += level;
    });
  });
  return {
    type: "chord",
    oscillators,
    count: Math.max(1, count),
    peak: Number(cfg.peak || 0.2) * 4.5
  };
}
function chordSample(voice, t) {
  const sum = voice.oscillators.reduce((total, oscillator) => {
    return total + oscSample(oscillator.wave, oscillator.freq, t, oscillator.detune) * oscillator.level;
  }, 0);
  return sum / voice.count * voice.peak;
}
function melodyVoice(event2, freq) {
  const cfg = findPocketLeadInstrumentConfig(event2.instrument);
  return {
    type: "melody",
    wave: cfg.wave || "sine",
    freq,
    peak: Number(cfg.peak || 0.16) * 4.5,
    extras: pocketLeadExtraLayers(cfg).map((extra) => ({
      wave: extra.wave || "sine",
      freq: freq * Number(extra.freqMul || 1),
      offset: Number(extra.offset || 0),
      peak: Number(extra.peak || 0.02) * 4.5
    }))
  };
}
function melodySample(voice, t) {
  let sum = oscSample(voice.wave, voice.freq, t) * voice.peak;
  voice.extras.forEach((extra) => {
    sum += oscSample(extra.wave, extra.freq, Math.max(0, t - extra.offset)) * extra.peak;
  });
  return sum;
}
function chipVoice(event2, freq) {
  const technique = event2.technique?.chip || {};
  const parameters = event2.soundProfile?.parameters || event2.chipTexture || {};
  const requestedChannel = String(technique.channel || (event2.stem === "bass" ? "triangle" : event2.stem === "drums" ? "noise" : "pulse1")).toLowerCase();
  const channel = ["pulse1", "pulse2", "triangle", "noise", "wave"].includes(requestedChannel) ? requestedChannel : "pulse2";
  const commandValues = Array.isArray(technique.commands) ? Object.fromEntries(technique.commands.filter((item) => item && typeof item === "object" && item.command).map((item) => [item.command, item.value])) : technique.commands && typeof technique.commands === "object" ? technique.commands : {};
  const duty = clamp014(commandValues.duty ?? technique.duty ?? parameters.pulseWidth ?? 0.5);
  return {
    type: "chip",
    channel,
    freq,
    duty: Math.max(0.08, Math.min(0.92, duty)),
    envelope: commandValues.envelope ?? technique.envelope ?? "pluck",
    pitchSlide: Number(commandValues.pitchSlide ?? technique.pitchSlide ?? technique.sweep ?? 0),
    vibrato: Number(commandValues.vibrato ?? technique.vibrato ?? 0),
    arpeggio: Array.isArray(commandValues.arpeggio ?? technique.arpeggio) ? (commandValues.arpeggio ?? technique.arpeggio).map(Number) : [],
    retrigger: Math.max(0, Number(commandValues.retrigger ?? technique.retrigger ?? 0)),
    saturation: clamp014(parameters.saturation),
    crush: clamp014(parameters.sampleRateCrush),
    bitDepth: clamp014(parameters.bitDepth)
  };
}
function chipSample(voice, t, index, sampleRate) {
  const retriggerTime = voice.retrigger > 0 ? t % voice.retrigger : t;
  const arpIndex = voice.arpeggio.length ? Math.floor(retriggerTime * 32) % voice.arpeggio.length : 0;
  const semitones = (voice.arpeggio[arpIndex] || 0) + voice.pitchSlide * Math.min(1, retriggerTime * 8);
  const vibrato = voice.vibrato ? Math.sin(2 * Math.PI * 6.2 * retriggerTime) * voice.vibrato : 0;
  const frequency = voice.freq * Math.pow(2, (semitones + vibrato) / 12);
  const heldIndex = voice.crush > 0 ? Math.floor(index / Math.max(1, Math.round(1 + voice.crush * 18))) : index;
  const heldTime = heldIndex / sampleRate;
  let sample;
  if (voice.channel === "noise") sample = deterministicNoise(heldIndex + 71);
  else if (voice.channel === "triangle") sample = oscSample("triangle", frequency, heldTime);
  else if (voice.channel === "wave") sample = oscSample("sine", frequency, heldTime) * 0.7 + oscSample("triangle", frequency * 2, heldTime) * 0.3;
  else sample = pulseSample(frequency, heldTime, voice.duty);
  if (voice.bitDepth > 0) {
    const levels = Math.max(8, Math.round(256 * (1 - voice.bitDepth * 0.9)));
    sample = Math.round(sample * levels) / levels;
  }
  return Math.tanh(sample * (1 + voice.saturation * 3));
}
function pulseSample(freq, t, duty) {
  return freq * t % 1 < duty ? 1 : -1;
}
function guitarVoice(event2) {
  const cfg = findPocketGuitarTone(event2.instrument);
  const notes = event2.midiNotes?.length ? event2.midiNotes : [event2.midi || 45];
  const drive = Number(cfg.drive || 1);
  const articulationScale = event2.articulation === "chug" ? 0.72 : event2.articulation === "scratch" ? 0.46 : 1;
  if (event2.audioProfile === "heavy_metal") {
    const texture = metalTexture(event2);
    const technique = event2.technique?.metal || {};
    const palmMute = clamp014(technique.palmMute ?? (event2.articulation === "palm_mute" || event2.articulation === "chug" ? texture.palmMute : texture.palmMute * 0.3));
    return {
      type: "metal-guitar",
      stereo: true,
      freqs: notes.map(midiToFreq),
      drive: 1.4 + texture.drive * 8.2,
      input: Number(cfg.input || 0.88),
      peak: Number(cfg.peak || 0.078) * 6.4 * articulationScale,
      palmMute,
      lowTightness: texture.lowTightness,
      presence: texture.presence,
      roomSize: texture.roomSize,
      pickAttack: texture.pickAttack,
      cabLowpass: 2200 + texture.presence * 2100 - palmMute * 620,
      preampHighpass: 68 + texture.lowTightness * 150,
      dualTakeSeed: Number(technique.dualTakeSeed ?? event2.step ?? 0),
      spread: 4e-3 + Number(cfg.spread || 7e-3) + texture.presence * 3e-3
    };
  }
  return {
    type: "guitar",
    freqs: notes.map(midiToFreq),
    drive,
    peak: Number(cfg.peak || 0.09) * 7.5 * articulationScale
  };
}
function guitarSample(voice, t) {
  const sum = voice.freqs.reduce((total, freq) => {
    return total + oscSample("sawtooth", freq, t) * 0.58 + oscSample("square", freq * 2, t) * 0.14;
  }, 0) / Math.max(1, voice.freqs.length);
  return Math.tanh(sum * voice.drive) * voice.peak;
}
function stereoWaveform(voice, t, seed, state, sampleRate) {
  if (voice.type !== "metal-guitar") {
    const mono = waveform(voice, t, seed, Math.floor(t * sampleRate), state, sampleRate);
    return [mono, mono];
  }
  const leftRaw = metalGuitarTake(voice, t, seed, -1);
  const rightRaw = metalGuitarTake(voice, t, seed + 31, 1);
  const roomDelay = 0.011 + voice.roomSize * 0.023;
  const leftRoom = t > roomDelay ? metalGuitarTake(voice, t - roomDelay, seed + 47, 1) * voice.roomSize * 0.24 : 0;
  const rightRoom = t > roomDelay * 1.13 ? metalGuitarTake(voice, t - roomDelay * 1.13, seed + 53, -1) * voice.roomSize * 0.24 : 0;
  return [
    applyCabFilter(leftRaw + leftRoom, state.left, voice, sampleRate),
    applyCabFilter(rightRaw + rightRoom, state.right, voice, sampleRate)
  ];
}
function metalGuitarTake(voice, t, seed, side) {
  const variation = 1 + side * voice.spread + stableVariation(voice.dualTakeSeed + side * 11) * 18e-4;
  const sum = voice.freqs.reduce((total, freq, index) => {
    const hz = freq * variation;
    const fundamental = oscSample("sawtooth", hz, t, side * 2.5);
    const upper = oscSample("square", hz * 2, t, -side * 1.7) * (0.08 + voice.presence * 0.18);
    return total + fundamental * 0.58 + upper + Math.sin(2 * Math.PI * hz * 3 * t) * voice.presence * 0.055;
  }, 0) / Math.max(1, voice.freqs.length);
  const transient = deterministicNoise(seed) * Math.exp(-t * (92 + voice.palmMute * 55)) * voice.pickAttack * 0.32;
  return Math.tanh((sum * voice.input + transient) * voice.drive) * voice.peak;
}
function createVoiceRenderState(voice, sampleRate) {
  if (voice.type !== "metal-guitar") return {};
  return { left: filterState(), right: filterState(), sampleRate };
}
function filterState() {
  return { previousInput: 0, highpass: 0, lowpass: 0 };
}
function applyCabFilter(input, state, voice, sampleRate) {
  const dt = 1 / sampleRate;
  const hpRc = 1 / (2 * Math.PI * voice.preampHighpass);
  const hpAlpha = hpRc / (hpRc + dt);
  state.highpass = hpAlpha * (state.highpass + input - state.previousInput);
  state.previousInput = input;
  const lpRc = 1 / (2 * Math.PI * voice.cabLowpass);
  const lpAlpha = dt / (lpRc + dt);
  state.lowpass += lpAlpha * (state.highpass - state.lowpass);
  return state.lowpass;
}
function drumKitConfig(event2) {
  const kit2 = resolvePocketDrumKitId(event2.drumKit, event2.audioProfile, event2.metalPreset || event2.funkPreset || event2.westernPreset || event2.chipPreset || event2.lofiPreset);
  return POCKET_DRUM_KIT_CONFIGS[kit2] || POCKET_DRUM_KIT_CONFIGS.classic;
}
function oscSample(wave, freq, t, detuneCents = 0) {
  const hz = freq * Math.pow(2, detuneCents / 1200);
  const phase = hz * t % 1;
  if (wave === "square") return phase < 0.5 ? 1 : -1;
  if (wave === "sawtooth") return phase * 2 - 1;
  if (wave === "triangle") return 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));
  return Math.sin(2 * Math.PI * hz * t);
}
function envelope(position) {
  if (position < 0.08) return position / 0.08;
  return Math.pow(1 - position, 1.8);
}
function voiceEnvelope(voice, position) {
  if (voice.type === "metal-guitar") {
    const attack = position < 0.025 ? position / 0.025 : 1;
    return attack * Math.pow(1 - position, 1.15 + voice.palmMute * 5.4);
  }
  if (voice.type === "funk-bass") {
    if (voice.articulation === "mute" || voice.articulation === "ghost") return Math.pow(1 - position, 6.5);
    if (voice.articulation === "slap" || voice.articulation === "pop") return Math.pow(1 - position, 2.8);
    if (voice.articulation === "hammer" || voice.articulation === "pull") return Math.min(1, position * 18) * Math.pow(1 - position, 1.5);
  }
  if (voice.type === "chip") {
    if (Array.isArray(voice.envelope) && voice.envelope.length) {
      const index = Math.min(voice.envelope.length - 1, Math.floor(position * voice.envelope.length));
      return clamp014(Number(voice.envelope[index]) / (Number(voice.envelope[index]) > 1 ? 15 : 1));
    }
    if (voice.envelope === "sustain") return position < 0.03 ? position / 0.03 : Math.pow(1 - position, 0.35);
    if (voice.envelope === "gate") return position < 0.85 ? 1 : (1 - position) / 0.15;
    return position < 0.02 ? position / 0.02 : Math.pow(1 - position, 2.4);
  }
  return envelope(position);
}
function canonicalDrumVoice(type) {
  const lane = String(type || "").toLowerCase();
  if (lane === "kick") return "kick";
  if (["snare", "rim", "clap"].includes(lane)) return "snare";
  if (["hat", "openhat", "hat_closed", "hat_open"].includes(lane)) return "hat";
  if (["tomhi", "tommid", "tomlow", "tom_high", "tom_mid", "tom_low"].includes(lane)) return "tom";
  if (["ride", "crash", "china"].includes(lane)) return "cymbal";
  if (lane === "percussion") return "percussion";
  return "";
}
function isChipEvent(event2) {
  return (event2.audioProfile === "chip_arcade" || event2.audioProfile === "chip_tune") && ["bass", "chord", "melody"].includes(event2.type);
}
function metalTexture(event2) {
  const source = event2.metalTexture || event2.soundProfile?.parameters || {};
  return {
    drive: clamp014(source.drive ?? 0.48),
    palmMute: clamp014(source.palmMute ?? 0.78),
    lowTightness: clamp014(source.lowTightness ?? 0.86),
    presence: clamp014(source.presence ?? 0.58),
    roomSize: clamp014(source.roomSize ?? 0.12),
    pickAttack: clamp014(source.pickAttack ?? 0.72)
  };
}
function funkParameters(event2) {
  const source = event2.soundProfile?.parameters || {};
  return {
    pocket: clamp014(source.pocket ?? 0.72),
    ghostNotes: clamp014(source.ghostNotes ?? 0.42),
    slapAmount: clamp014(source.slapAmount ?? 0.68),
    popBrightness: clamp014(source.popBrightness ?? 0.62),
    muteDepth: clamp014(source.muteDepth ?? 0.74),
    stabTightness: clamp014(source.stabTightness ?? 0.76)
  };
}
function stableVariation(seed) {
  return deterministicNoise(Number(seed || 0) + 193) * 0.5;
}
function eventFrequency(event2) {
  const midi = event2.midi || event2.midiNotes?.[0] || (event2.type === "kick" ? 36 : event2.type === "snare" ? 38 : event2.type === "hat" ? 72 : 60);
  return midiToFreq(midi);
}
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
function deterministicNoise(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}
function clamp014(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}
function clampAudio(value) {
  return Math.max(-1, Math.min(1, value));
}
function stemScale(stem) {
  return chordsmithOfflineStemRenderGain(stem);
}

// src/export/stems.js
async function renderStemPlaceholders({ stems = [], sampleRate = 44100 } = {}) {
  const out = {};
  stems.forEach((stem) => {
    out[stem] = encodePcm16WavBlob({ channels: [new Float32Array(Math.ceil(sampleRate * 0.25)), new Float32Array(Math.ceil(sampleRate * 0.25))], sampleRate });
  });
  return out;
}
async function renderPocketAudioStems(project, options = {}) {
  const sampleRate = options.sampleRate || 44100;
  const stems = options.stems || ["drums", "bass", "chords", "melody", "guitar"];
  const timeline = buildPocketAudioTimeline(project, options);
  const duration = timeline.duration + (options.tailSeconds ?? 0.6);
  const frameCount = Math.max(1, Math.ceil(duration * sampleRate));
  const out = {};
  stems.forEach((stem) => {
    const left = new Float32Array(frameCount);
    const right = new Float32Array(frameCount);
    timeline.events.filter((event2) => event2.stem === stem).forEach((event2) => {
      const start = Math.max(0, Math.floor(event2.time * sampleRate));
      const length = Math.max(1, Math.floor(Math.max(0.02, event2.duration || 0.08) * sampleRate));
      const freq = 440 * Math.pow(2, ((event2.midi || event2.midiNotes?.[0] || 60) - 69) / 12);
      const gain2 = Math.min(0.4, Math.max(0, event2.velocity || 0.25)) * 0.16;
      for (let index = 0; index < length && start + index < frameCount; index += 1) {
        const env = 1 - index / length;
        const sample = Math.sin(2 * Math.PI * freq * index / sampleRate) * gain2 * env;
        left[start + index] += sample;
        right[start + index] += sample;
      }
    });
    out[stem] = encodePcm16WavBlob({ channels: [left, right], sampleRate });
  });
  return out;
}

// src/engine/live-engine.js
var PocketAudio = class {
  constructor(options = {}) {
    this.options = options;
    this.profile = options.profile || "composer";
    this.project = null;
    this.timeline = null;
    this.playing = false;
    this.audioContext = null;
    this.schedulerTimer = null;
    this.playStartedAt = 0;
    this.audioStartTime = null;
    this.timelineStartTime = null;
    this.timelineLoopOffset = 0;
    this.nextEventIndex = 0;
    this.listeners = /* @__PURE__ */ new Map();
    this.musicStates = /* @__PURE__ */ new Map();
    this.currentMusicState = null;
    this.queuedMusicState = null;
    this.pendingReturnState = null;
    this.intensity = clamp4(Number(options.intensity ?? 0), 0, 1);
    this.ducking = { enabled: false, amount: 0, releaseMs: 0 };
    this.lowpassAmount = 1;
    this.lastSchedulerTickAt = 0;
    this.pendingTransition = null;
    this.lookaheadSeconds = Math.max(0.01, Number(options.lookaheadSeconds ?? 0.12));
    this.lateEventThresholdSeconds = Math.max(0, Number(options.lateEventThresholdSeconds ?? 0.08));
    this.schedulerIntervalMs = Math.max(5, Number(options.schedulerIntervalMs ?? 25));
    const requestedEventBudget = Number(options.maxEventsPerSchedulerTick);
    this.maxEventsPerSchedulerTick = Number.isFinite(requestedEventBudget) ? Math.max(1, Math.min(POCKET_AUDIO_RESOURCE_LIMITS.maxEventsPerSchedulerTick, Math.floor(requestedEventBudget))) : POCKET_AUDIO_RESOURCE_LIMITS.maxEventsPerSchedulerTick;
    this.clock = typeof options.now === "function" ? options.now : () => nowSeconds(this.audioContext);
    this.setIntervalFn = options.setInterval || globalThis.setInterval;
    this.clearIntervalFn = options.clearInterval || globalThis.clearInterval;
    if (options.audioContext) this.audioContext = options.audioContext;
    this.transport = { sectionId: "A", bar: 1, beat: 1, step: -1, seconds: 0, tick: 0 };
    this.diagnostics = {
      scheduledEventCount: 0,
      skippedLateEventCount: 0,
      skippedOverBudgetEventCount: 0,
      schedulerTickCount: 0,
      missedSchedulerTickCount: 0,
      maxEventsPerSchedulerTick: this.maxEventsPerSchedulerTick
    };
    this.defineMusicStates(options.musicStates || options.stateMap || {});
  }
  async loadProject(input, options = {}) {
    const raw = input?.app === "PocketAudioProject" ? input.source?.original || input : parsePocketChordsmithInput(input);
    this.project = raw?.app === "PocketAudioProject" ? raw : normalisePocketChordsmithProject(raw, options);
    this.timeline = buildPocketAudioTimeline(this.project, { scope: "sequence" });
    this.transport.sectionId = this.project.transport.currentSection;
    this.emit("project", { project: this.project });
    return this.project;
  }
  async resume() {
    if (this.options.audio !== false && this.audioContext?.state === "suspended" && typeof this.audioContext.resume === "function") {
      await this.audioContext.resume();
    } else if (this.options.audio !== false && !this.audioContext && (globalThis.AudioContext || globalThis.webkitAudioContext)) {
      this.audioContext = await createAudioContext();
    }
    this.emit("resume", {});
  }
  async resumeFromUserGesture() {
    await this.resume();
  }
  async play(options = {}) {
    this.ensureProject();
    if (!this.audioContext && this.options.audio !== false && (globalThis.AudioContext || globalThis.webkitAudioContext)) await this.resume();
    this.playing = true;
    if (options.sectionId) this.transport.sectionId = normaliseSectionId2(options.sectionId);
    this.timeline = buildPocketAudioTimeline(this.project, { scope: options.scope || "sequence", sectionId: this.transport.sectionId });
    this.nextEventIndex = 0;
    this.audioStartTime = this.clock();
    this.playStartedAt = this.audioStartTime;
    this.timelineStartTime = this.audioStartTime;
    this.timelineLoopOffset = 0;
    this.lastSchedulerTickAt = 0;
    this.pendingTransition = null;
    this.startTimelineScheduler();
    this.emit("play", this.getTransport());
  }
  pause() {
    this.playing = false;
    this.clearTimelineScheduler();
    this.emit("pause", this.getTransport());
  }
  stop() {
    this.playing = false;
    this.clearTimelineScheduler();
    this.transport = { ...this.transport, bar: 1, beat: 1, step: -1, seconds: 0, tick: 0 };
    this.emit("stop", this.getTransport());
  }
  restart() {
    this.stop();
    this.play();
  }
  queueSection(sectionId, options = {}) {
    this.ensureProject();
    if (!SECTION_IDS.includes(String(sectionId || "").toUpperCase()) && this.musicStates.has(String(sectionId || ""))) {
      return this.queueMusicState(sectionId, options);
    }
    const safe = normaliseSectionId2(sectionId);
    const quantize = options.quantize || "bar";
    const queued = this.queueTransition({ kind: "section", sectionId: safe, quantize });
    this.emit("sectionQueued", queued);
    return queued;
  }
  setSequence(sequence) {
    this.ensureProject();
    this.project.sequence = (Array.isArray(sequence) ? sequence : []).map(normaliseSectionId2);
    this.timeline = buildPocketAudioTimeline(this.project, { scope: "sequence" });
    this.emit("sequence", { sequence: this.project.sequence.slice() });
  }
  setLoop(options = {}) {
    this.ensureProject();
    this.loop = { enabled: Boolean(options.enabled), sectionId: options.sectionId ? normaliseSectionId2(options.sectionId) : this.transport.sectionId };
    this.emit("loop", this.loop);
  }
  defineMusicStates(states = {}) {
    Object.entries(states || {}).forEach(([name, definition]) => this.musicStates.set(name, { ...definition }));
    return this;
  }
  setMusicState(name, options = {}) {
    this.ensureProject();
    const definition = this.getMusicStateDefinition(name);
    this.currentMusicState = String(name);
    this.queuedMusicState = null;
    if (Array.isArray(definition.sequence)) {
      this.project.sequence = definition.sequence.map(normaliseSectionId2);
      this.emit("sequence", { sequence: this.project.sequence.slice() });
    }
    if (definition.section) {
      const safe = normaliseSectionId2(definition.section);
      this.transport.sectionId = safe;
      this.project.transport.currentSection = safe;
      this.emit("section", {
        sectionId: safe,
        quantize: options.quantize || "instant",
        transitionTime: options.transitionTime ?? this.currentTransportTime()
      });
    }
    if (definition.loop !== void 0) this.setLoop({ enabled: Boolean(definition.loop), sectionId: definition.section || this.transport.sectionId });
    if (definition.intensity !== void 0) this.setIntensity(definition.intensity);
    if (definition.fx) this.setFx(definition.fx);
    if (definition.lowpass !== void 0) this.lowpass(definition.lowpass);
    if (definition.duck !== void 0) this.duck(Boolean(definition.duck), typeof definition.duck === "object" ? definition.duck : {});
    if (definition.stems) this.applyStemPatchMap(definition.stems);
    if (definition.stinger) this.triggerStinger(name, { ...options, stateDefinition: definition });
    if (definition.thenReturnTo) this.pendingReturnState = definition.thenReturnTo;
    this.rebuildTimelineForState(definition, options.transitionTime);
    this.emit("musicState", {
      name: this.currentMusicState,
      definition,
      quantize: options.quantize || "instant",
      transitionTime: options.transitionTime ?? this.currentTransportTime()
    });
    return definition;
  }
  queueMusicState(name, options = {}) {
    const definition = this.getMusicStateDefinition(name);
    const quantize = options.quantize || "bar";
    const transition = this.queueTransition({ kind: "musicState", name: String(name), definition, quantize });
    if (this.pendingTransition === transition) this.queuedMusicState = transition;
    this.emit("musicStateQueued", transition);
    return transition;
  }
  triggerStinger(name, options = {}) {
    const definition = options.stateDefinition || this.musicStates.get(String(name)) || {};
    const stinger = definition.stinger || name;
    const payload = {
      name: String(name),
      stinger,
      thenReturnTo: definition.thenReturnTo || options.thenReturnTo || null
    };
    this.pendingReturnState = payload.thenReturnTo;
    this.emit("stinger", payload);
    return payload;
  }
  setIntensity(value) {
    this.intensity = clamp4(Number(value), 0, 1);
    this.emit("intensity", { intensity: this.intensity });
    return this.intensity;
  }
  duck(enabled = true, options = {}) {
    this.ducking = {
      enabled: Boolean(enabled),
      amount: clamp4(Number(options.amount ?? (enabled ? 0.45 : 0)), 0, 1),
      releaseMs: Math.max(0, Number(options.releaseMs ?? 500))
    };
    this.setFx({ sidechain: { enabled: this.ducking.enabled, amount: this.ducking.amount } });
    this.emit("duck", this.ducking);
    return this.ducking;
  }
  lowpass(amount = 1) {
    this.lowpassAmount = clamp4(Number(amount), 0, 1);
    this.setFx({ filter: this.lowpassAmount });
    this.emit("lowpass", { amount: this.lowpassAmount });
    return this.lowpassAmount;
  }
  setStemVolume(stem, volume) {
    this.patchStem(stem, { volume: clamp4(Number(volume), 0, 1) });
  }
  setStemMute(stem, mute) {
    this.patchStem(stem, { mute: Boolean(mute) });
  }
  setFx(patch = {}) {
    this.ensureProject();
    this.project.mixer.fx = { ...this.project.mixer.fx, ...patch };
    this.emit("fx", { fx: this.project.mixer.fx });
  }
  triggerBuild(options = {}) {
    this.ensureProject();
    this.buildState = { active: true, bars: options.bars || 2 };
    this.setFx({ ...this.project.mixer.fx || {}, filter: 0.74, echo: 0.01, reverb: 0.18 });
    this.emit("build", this.buildState);
  }
  triggerDrop(options = {}) {
    this.ensureProject();
    const target = options.targetSection ? normaliseSectionId2(options.targetSection) : this.transport.sectionId;
    this.buildState = { active: false };
    this.queueSection(target, { quantize: options.quantize || "bar" });
    this.emit("drop", { targetSection: target });
  }
  async renderWav(options = {}) {
    this.ensureProject();
    return renderPocketAudioWav(this.project, options);
  }
  async renderStems(options = {}) {
    this.ensureProject();
    return renderPocketAudioStems(this.project, { stems: options.stems || STEM_IDS, sampleRate: options.sampleRate || 44100 });
  }
  getTransport() {
    return { playing: this.playing, ...this.transport };
  }
  getDiagnostics() {
    return {
      coreStub: false,
      profile: this.profile,
      audioContextState: this.audioContext?.state || (this.options.audio === false ? "disabled" : "not-created"),
      audioStartTime: this.audioStartTime,
      timelineEventCount: this.timeline?.events.length || 0,
      currentSection: this.transport.sectionId,
      currentMusicState: this.currentMusicState,
      queuedMusicState: this.queuedMusicState?.name || null,
      intensity: this.intensity,
      ducking: this.ducking,
      projectLoaded: Boolean(this.project),
      ...this.diagnostics
    };
  }
  currentTransportTime() {
    if (this.audioStartTime === null) return Number(this.transport.seconds || 0);
    return Math.max(Number(this.transport.seconds || 0), this.clock() - this.audioStartTime);
  }
  quantizedTransitionTime(quantize = "bar") {
    const current = this.currentTransportTime();
    if (!this.playing || quantize === "instant" || quantize === "none") return current;
    const beat = 60 / Math.max(1, Number(this.project?.meta?.bpm || 96));
    const quantum = quantize === "beat" ? beat : beat * Math.max(1, Number(this.project?.meta?.timeSig || 4));
    return Math.ceil((current + 1e-9) / quantum) * quantum;
  }
  queueTransition(transition) {
    const transitionTime = this.quantizedTransitionTime(transition.quantize);
    const queued = { ...transition, transitionTime };
    if (!this.playing || transition.quantize === "instant" || transition.quantize === "none") {
      this.applyTransition(queued);
    } else {
      this.pendingTransition = queued;
    }
    return queued;
  }
  applyTransition(transition) {
    this.pendingTransition = null;
    if (transition.kind === "musicState") {
      this.setMusicState(transition.name, { quantize: transition.quantize, transitionTime: transition.transitionTime });
      return;
    }
    const safe = normaliseSectionId2(transition.sectionId);
    this.transport.sectionId = safe;
    this.project.transport.currentSection = safe;
    this.timeline = buildPocketAudioTimeline(this.project, { scope: "section", sectionId: safe });
    this.resetTimelineAtTransition(transition.transitionTime);
    this.emit("section", { sectionId: safe, quantize: transition.quantize, transitionTime: transition.transitionTime });
  }
  rebuildTimelineForState(definition = {}, transitionTime = this.currentTransportTime()) {
    const scope = definition.section ? "section" : "sequence";
    this.timeline = buildPocketAudioTimeline(this.project, { scope, sectionId: this.transport.sectionId });
    this.resetTimelineAtTransition(transitionTime);
  }
  resetTimelineAtTransition(transportTime) {
    if (this.audioStartTime === null) return;
    this.timelineStartTime = this.audioStartTime + Number(transportTime || 0);
    this.timelineLoopOffset = 0;
    this.nextEventIndex = 0;
  }
  on(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, /* @__PURE__ */ new Set());
    this.listeners.get(type).add(callback);
    return () => this.off(type, callback);
  }
  off(type, callback) {
    this.listeners.get(type)?.delete(callback);
  }
  emit(type, payload) {
    this.listeners.get(type)?.forEach((callback) => callback(payload));
  }
  dispose() {
    this.stop();
    this.listeners.clear();
  }
  ensureProject() {
    if (!this.project) throw new Error("Load a Pocket Chordsmith project before using Pocket Audio Core transport.");
  }
  startTimelineScheduler() {
    this.clearTimelineScheduler();
    const tick = () => {
      if (!this.playing || !this.timeline) return;
      const tickNow = this.clock();
      this.diagnostics.schedulerTickCount += 1;
      if (this.lastSchedulerTickAt && tickNow - this.lastSchedulerTickAt > 0.18) this.diagnostics.missedSchedulerTickCount += 1;
      this.lastSchedulerTickAt = tickNow;
      const elapsed = Math.max(0, tickNow - this.audioStartTime);
      this.transport.seconds = Math.max(this.transport.seconds, elapsed);
      if (this.pendingTransition && elapsed + 1e-9 >= this.pendingTransition.transitionTime) {
        this.applyTransition(this.pendingTransition);
      }
      const transitionAudioTime = this.pendingTransition ? this.audioStartTime + this.pendingTransition.transitionTime : Infinity;
      const horizon = Math.min(tickNow + this.lookaheadSeconds, transitionAudioTime);
      let dispatchedThisTick = 0;
      while (this.nextEventIndex < this.timeline.events.length) {
        const event2 = this.timeline.events[this.nextEventIndex];
        const targetAudioTime = this.timelineStartTime + this.timelineLoopOffset + event2.time;
        if (targetAudioTime >= horizon) break;
        if (targetAudioTime < tickNow - this.lateEventThresholdSeconds) {
          this.diagnostics.skippedLateEventCount += 1;
        } else if (dispatchedThisTick >= this.maxEventsPerSchedulerTick) {
          this.diagnostics.skippedOverBudgetEventCount += 1;
        } else {
          this.dispatchTimelineEvent(event2, targetAudioTime);
          dispatchedThisTick += 1;
        }
        this.nextEventIndex += 1;
      }
      if (tickNow >= this.timelineStartTime + this.timelineLoopOffset + this.timeline.duration) {
        if (this.loop?.enabled) {
          const completedLoops = Math.max(1, Math.floor((tickNow - this.timelineStartTime) / this.timeline.duration));
          this.timelineLoopOffset = completedLoops * this.timeline.duration;
          this.nextEventIndex = 0;
        } else {
          this.stop();
        }
      }
    };
    this.schedulerTick = tick;
    this.schedulerTimer = this.setIntervalFn(tick, this.schedulerIntervalMs);
    tick();
  }
  clearTimelineScheduler() {
    if (this.schedulerTimer !== null) this.clearIntervalFn(this.schedulerTimer);
    this.schedulerTimer = null;
  }
  dispatchTimelineEvent(event2, targetAudioTime) {
    this.transport = {
      ...this.transport,
      sectionId: event2.sectionId,
      bar: event2.bar,
      beat: event2.beat,
      step: event2.step,
      tick: event2.tick
    };
    this.diagnostics.scheduledEventCount += 1;
    if (event2.beat === 1 && event2.step % ((this.project?.meta?.resolution || 4) * (this.project?.meta?.timeSig || 4)) === 0) {
      this.emit("bar", event2);
      this.emit("section", event2);
    }
    this.emit("beat", event2);
    const scheduledEvent = { ...event2, scheduledAudioTime: targetAudioTime };
    this.emit("event", scheduledEvent);
    if (this.audioContext) scheduleSimpleAudioEvent(this.audioContext, event2, this.project, targetAudioTime);
  }
  patchStem(stem, patch) {
    this.ensureProject();
    if (!this.project.mixer.stems[stem]) throw new Error(`Unknown stem: ${stem}`);
    this.project.mixer.stems[stem] = { ...this.project.mixer.stems[stem], ...patch };
    this.emit("stem", { stem, settings: this.project.mixer.stems[stem] });
  }
  applyStemPatchMap(stems = {}) {
    Object.entries(stems || {}).forEach(([stem, patch]) => {
      if (patch.volume !== void 0) this.setStemVolume(stem, patch.volume);
      if (patch.mute !== void 0) this.setStemMute(stem, patch.mute);
    });
  }
  getMusicStateDefinition(name) {
    const safeName = String(name || "");
    const definition = this.musicStates.get(safeName);
    if (!definition) throw new Error(`Unknown music state: ${safeName}`);
    return definition;
  }
};
function nowSeconds(context) {
  return context?.currentTime ?? performance.now() / 1e3;
}
function scheduleSimpleAudioEvent(context, event2, project, targetAudioTime) {
  if (project?.mixer?.stems?.[event2.stem]?.mute) return;
  const funk = event2.audioProfile === "funk_groove" ? liveFunkParameters(event2) : null;
  const pocketOffset = funk && Number(event2.step || 0) % 2 !== 0 ? (funk.pocket - 0.5) * 0.03 : 0;
  const start = Math.max(context.currentTime + 5e-3, targetAudioTime + pocketOffset);
  if (event2.type === "guitar" && event2.audioProfile === "heavy_metal") {
    scheduleMetalGuitarAudioEvent(context, event2, project, start);
    return;
  }
  if (event2.type === "bass") {
    scheduleBassAudioEvent(context, event2, project, start);
    return;
  }
  const gain2 = context.createGain();
  const voice = simpleVoiceRecipe(event2);
  const ghostScale = funk && ["snare", "rim", "clap"].includes(String(event2.type || event2.lane)) && !event2.accent ? 0.46 + funk.ghostNotes * 0.5 : 1;
  const volume = (project?.mixer?.stems?.[event2.stem]?.volume ?? 0.7) * Math.min(1, event2.velocity || 0.5) * voice.peak * ghostScale;
  gain2.gain.setValueAtTime(1e-4, start);
  gain2.gain.linearRampToValueAtTime(volume, start + voice.attack);
  gain2.gain.exponentialRampToValueAtTime(1e-4, start + Math.max(0.04, (event2.duration || 0.08) * voice.durationScale));
  const filter = context.createBiquadFilter();
  filter.type = voice.filterType;
  filter.frequency.setValueAtTime(voice.filterFrequency, start);
  filter.connect(gain2);
  gain2.connect(context.destination);
  const osc = context.createOscillator();
  if (voice.pulseDuty !== void 0 && typeof osc.setPeriodicWave === "function") osc.setPeriodicWave(createPulseWave(context, voice.pulseDuty));
  else osc.type = voice.wave;
  const midi = event2.midi || event2.midiNotes?.[0] || (event2.type === "kick" ? 36 : event2.type === "snare" ? 38 : event2.type === "hat" ? 72 : 60);
  osc.frequency.setValueAtTime(440 * Math.pow(2, (midi - 69) / 12), start);
  if (voice.pitchSlide) osc.frequency.exponentialRampToValueAtTime(440 * Math.pow(2, (midi + voice.pitchSlide - 69) / 12), start + Math.max(0.04, event2.duration || 0.08));
  osc.connect(filter);
  osc.start(start);
  osc.stop(start + Math.max(0.04, (event2.duration || 0.08) * voice.durationScale) + 0.02);
}
function scheduleBassAudioEvent(context, event2, project, start) {
  const cfg = POCKET_BASS_TONE_CONFIGS[resolvePocketBassToneId(event2.bassTone)] || POCKET_BASS_TONE_CONFIGS.classic;
  const stemVolume = project?.mixer?.stems?.[event2.stem]?.volume ?? 0.7;
  const peak = stemVolume * Math.min(1, event2.velocity || 0.5);
  const midi = event2.midi || event2.midiNotes?.[0] || 36;
  const articulation = event2.articulation || "finger";
  const funk = event2.audioProfile === "funk_groove" ? event2.soundProfile?.parameters || {} : null;
  const metal = event2.audioProfile === "heavy_metal" ? event2.metalTexture || event2.soundProfile?.parameters || {} : null;
  const bassDur = Math.max(0.05, (event2.duration || 0.22) * (articulation === "mute" || articulation === "ghost" ? 0.28 : 1));
  const articulationGain = articulation === "mute" || articulation === "ghost" ? 0.16 + (1 - Number(funk?.muteDepth ?? 0.74)) * 0.18 : articulation === "hammer" || articulation === "pull" ? 0.78 : 1;
  scheduleBassLayer(context, start, midi, bassDur, cfg.mainWave || "sawtooth", peak * Number(cfg.mainPeak || 1) * articulationGain, cfg.cutoff || 420, articulation === "hammer" || articulation === "pull" ? 0.018 : cfg.attack || 0.01, { drive: metal ? 1 + Number(metal.drive || 0) * 4 : 1 });
  scheduleBassLayer(context, start, midi - 12, Math.min(0.16, bassDur * 0.82), cfg.subWave || "sine", peak * Number(cfg.subPeak || 0.35), cfg.subCutoff || 220, cfg.attack || 0.01);
  if (funk && ["slap", "pop", "mute", "ghost"].includes(articulation)) {
    const brightness = articulation === "pop" ? Number(funk.popBrightness ?? 0.62) : Number(funk.slapAmount ?? 0.68);
    scheduleTransientOscillator(context, start, articulation === "pop" ? midi + 12 : midi + 24, 0.035, peak * (0.08 + brightness * 0.16));
  }
  if (metal) scheduleBassLayer(context, start, midi, Math.min(0.18, bassDur), "sawtooth", peak * (0.12 + Number(metal.presence || 0) * 0.16), 900 + Number(metal.presence || 0) * 1500, 2e-3, { drive: 2 + Number(metal.drive || 0) * 5 });
}
function scheduleBassLayer(context, start, midi, duration, wave, volume, cutoff, attack, options = {}) {
  const gain2 = context.createGain();
  gain2.gain.setValueAtTime(1e-4, start);
  gain2.gain.linearRampToValueAtTime(Math.max(1e-4, volume), start + Math.max(2e-3, Number(attack || 0.01)));
  gain2.gain.exponentialRampToValueAtTime(1e-4, start + Math.max(0.04, duration));
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.max(80, Number(cutoff || 420)), start);
  filter.connect(gain2);
  gain2.connect(context.destination);
  const osc = context.createOscillator();
  osc.type = wave || "sine";
  osc.frequency.setValueAtTime(440 * Math.pow(2, (midi - 69) / 12), start);
  if (options.drive > 1 && typeof context.createWaveShaper === "function") {
    const shaper = context.createWaveShaper();
    shaper.curve = distortionCurve(options.drive);
    osc.connect(shaper);
    shaper.connect(filter);
  } else osc.connect(filter);
  osc.start(start);
  osc.stop(start + Math.max(0.04, duration) + 0.02);
}
function simpleVoiceRecipe(event2) {
  if (event2.type === "chord") {
    const cfg = findPocketChordInstrumentConfig(event2.instrument);
    const funk = event2.audioProfile === "funk_groove" ? liveFunkParameters(event2) : null;
    return {
      wave: cfg.wave || "sine",
      peak: Math.max(0.04, Number(cfg.peak || 0.2)),
      attack: Math.max(2e-3, Number(cfg.attack || 0.01)),
      durationScale: Math.max(0.08, Number(cfg.durMul || 1) * (funk ? 1 - funk.stabTightness * 0.68 : 1)),
      filterType: cfg.filter || "lowpass",
      filterFrequency: Math.max(80, Number(cfg.freq || 1800))
    };
  }
  if (event2.type === "melody") {
    const cfg = findPocketLeadInstrumentConfig(event2.instrument);
    const chip = event2.audioProfile === "chip_arcade" || event2.audioProfile === "chip_tune" ? event2.technique?.chip || {} : null;
    return {
      wave: chip?.channel === "triangle" ? "triangle" : cfg.wave || "sine",
      peak: Math.max(0.04, Number(cfg.peak || 0.16)),
      attack: 6e-3,
      durationScale: Math.max(0.35, Number(cfg.durMul || 1)),
      filterType: cfg.filter || "lowpass",
      filterFrequency: Math.max(80, Number(cfg.freq || 2200)),
      pulseDuty: chip && String(chip.channel || "pulse1").startsWith("pulse") ? Math.max(0.08, Math.min(0.92, Number(chip.duty ?? event2.soundProfile?.parameters?.pulseWidth ?? 0.5))) : void 0,
      pitchSlide: chip ? Number(chip.pitchSlide ?? chip.sweep ?? 0) : 0
    };
  }
  if (event2.type === "bass") {
    const cfg = POCKET_BASS_TONE_CONFIGS[resolvePocketBassToneId(event2.bassTone)] || POCKET_BASS_TONE_CONFIGS.classic;
    return {
      wave: cfg.mainWave || "sawtooth",
      peak: Math.max(0.04, Number(cfg.mainPeak || 1)),
      attack: Math.max(2e-3, Number(cfg.attack || 0.01)),
      durationScale: 1,
      filterType: "lowpass",
      filterFrequency: Math.max(80, Number(cfg.cutoff || 420))
    };
  }
  if (event2.type === "guitar") {
    const cfg = findPocketGuitarTone(event2.instrument);
    return {
      wave: "sawtooth",
      peak: Math.max(0.04, Number(cfg.peak || 0.09)) * Math.max(1, Number(cfg.drive || 1)),
      attack: 4e-3,
      durationScale: event2.articulation === "chug" ? 0.55 : Math.max(0.35, Number(cfg.sustain || 0.9)),
      filterType: "lowpass",
      filterFrequency: Math.max(80, Number(cfg.lowpass || 3200))
    };
  }
  if (event2.type === "kick" || event2.type === "snare" || event2.type === "hat") {
    const kit2 = POCKET_DRUM_KIT_CONFIGS[resolvePocketDrumKitId(event2.drumKit, event2.audioProfile, event2.metalPreset || event2.chipPreset || event2.lofiPreset)] || POCKET_DRUM_KIT_CONFIGS.classic;
    const drum2 = event2.type === "kick" ? kit2.kick : event2.type === "snare" ? kit2.snare : kit2.hat;
    return {
      wave: event2.type === "hat" ? "square" : "sine",
      peak: Math.max(0.04, Number(drum2?.gainScale || 1)) * 0.18,
      attack: 4e-3,
      durationScale: event2.type === "hat" ? 0.65 : 1,
      filterType: event2.type === "snare" || event2.type === "hat" ? "highpass" : "lowpass",
      filterFrequency: Math.max(80, Number(drum2?.filterFreq || drum2?.highpass || drum2?.highpassClosed || 1200))
    };
  }
  return { wave: "sine", peak: 0.18, attack: 0.01, durationScale: 1, filterType: "lowpass", filterFrequency: 2200 };
}
function liveFunkParameters(event2) {
  const source = event2.soundProfile?.parameters || {};
  const clamp016 = (value, fallback) => Math.max(0, Math.min(1, Number(value ?? fallback)));
  return {
    pocket: clamp016(source.pocket, 0.72),
    ghostNotes: clamp016(source.ghostNotes, 0.42),
    slapAmount: clamp016(source.slapAmount, 0.68),
    popBrightness: clamp016(source.popBrightness, 0.62),
    muteDepth: clamp016(source.muteDepth, 0.74),
    stabTightness: clamp016(source.stabTightness, 0.76)
  };
}
function scheduleMetalGuitarAudioEvent(context, event2, project, start) {
  const cfg = findPocketGuitarTone(event2.instrument);
  const texture = event2.metalTexture || event2.soundProfile?.parameters || {};
  const technique = event2.technique?.metal || {};
  const palmMute = clamp4(technique.palmMute ?? (event2.articulation === "palm_mute" || event2.articulation === "chug" ? texture.palmMute : Number(texture.palmMute || 0) * 0.3), 0, 1);
  const drive = 1.4 + clamp4(Number(texture.drive || 0), 0, 1) * 8.2;
  const tightness = clamp4(Number(texture.lowTightness || 0), 0, 1);
  const presence = clamp4(Number(texture.presence || 0), 0, 1);
  const roomSize = clamp4(Number(texture.roomSize || 0), 0, 1);
  const pickAttack = clamp4(Number(texture.pickAttack || 0), 0, 1);
  const duration = Math.max(0.05, (event2.duration || 0.16) * (1 - palmMute * 0.58));
  const peak = (project?.mixer?.stems?.guitar?.volume ?? 0.66) * Math.min(1, event2.velocity || 0.5) * Number(cfg.peak || 0.078);
  const output = context.createGain();
  output.gain.setValueAtTime(1e-4, start);
  output.gain.linearRampToValueAtTime(Math.max(1e-4, peak), start + 4e-3);
  output.gain.exponentialRampToValueAtTime(1e-4, start + duration);
  output.connect(context.destination);
  if (roomSize > 5e-3 && typeof context.createDelay === "function") {
    const delay = context.createDelay();
    const room = context.createGain();
    delay.delayTime.setValueAtTime(0.011 + roomSize * 0.023, start);
    room.gain.setValueAtTime(roomSize * 0.24, start);
    output.connect(delay);
    delay.connect(room);
    room.connect(context.destination);
  }
  const notes = event2.midiNotes?.length ? event2.midiNotes : [event2.midi || 45];
  [-1, 1].forEach((side) => notes.forEach((midi, noteIndex2) => {
    const osc = context.createOscillator();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const shaper = typeof context.createWaveShaper === "function" ? context.createWaveShaper() : null;
    const pan = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
    osc.type = "sawtooth";
    osc.detune.setValueAtTime(side * (4 + presence * 4) + noteIndex2, start);
    osc.frequency.setValueAtTime(440 * Math.pow(2, (midi - 69) / 12), start);
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(68 + tightness * 150, start);
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(2200 + presence * 2100 - palmMute * 620, start);
    if (shaper) shaper.curve = distortionCurve(drive);
    if (pan) pan.pan.setValueAtTime(side * (0.28 + presence * 0.12), start);
    osc.connect(highpass);
    if (shaper) {
      highpass.connect(shaper);
      shaper.connect(lowpass);
    } else highpass.connect(lowpass);
    if (pan) {
      lowpass.connect(pan);
      pan.connect(output);
    } else lowpass.connect(output);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }));
  scheduleTransientOscillator(context, start, 84 + presence * 12, 0.028, peak * pickAttack * 1.8);
}
function scheduleTransientOscillator(context, start, midi, duration, volume) {
  if (volume <= 1e-4) return;
  const gain2 = context.createGain();
  const osc = context.createOscillator();
  gain2.gain.setValueAtTime(Math.max(1e-4, volume), start);
  gain2.gain.exponentialRampToValueAtTime(1e-4, start + duration);
  osc.type = "square";
  osc.frequency.setValueAtTime(440 * Math.pow(2, (midi - 69) / 12), start);
  osc.connect(gain2);
  gain2.connect(context.destination);
  osc.start(start);
  osc.stop(start + duration + 0.01);
}
function createPulseWave(context, duty) {
  const harmonics = 32;
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n += 1) {
    real[n] = 2 * Math.sin(Math.PI * n * duty) * Math.cos(Math.PI * n * duty) / (Math.PI * n);
    imag[n] = 2 * Math.sin(Math.PI * n * duty) * Math.sin(Math.PI * n * duty) / (Math.PI * n);
  }
  return context.createPeriodicWave(real, imag, { disableNormalization: false });
}
function distortionCurve(amount) {
  const samples = 256;
  const curve = new Float32Array(samples);
  for (let index = 0; index < samples; index += 1) {
    const x = index * 2 / (samples - 1) - 1;
    curve[index] = Math.tanh(x * amount);
  }
  return curve;
}
function normaliseSectionId2(value) {
  const safe = String(value || "A").toUpperCase();
  return SECTION_IDS.includes(safe) ? safe : "A";
}
function clamp4(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

// src/engine/voice-manager.js
var VoiceManager = class {
  constructor(limits = {}) {
    this.limits = { drums: 48, bass: 16, chords: 40, melody: 56, guitar: 18, ...limits };
    this.active = /* @__PURE__ */ new Map();
  }
  add(role, voice) {
    const voices = this.active.get(role) || [];
    voices.push(voice);
    while (voices.length > (this.limits[role] || 32)) {
      const removed = voices.shift();
      if (removed && typeof removed.stop === "function") removed.stop();
    }
    this.active.set(role, voices);
  }
  clear() {
    this.active.forEach((voices) => voices.forEach((voice) => voice && typeof voice.stop === "function" && voice.stop()));
    this.active.clear();
  }
  diagnostics() {
    const byRole = {};
    this.active.forEach((voices, role) => {
      byRole[role] = voices.length;
    });
    return { activeVoicesByRole: byRole, activeVoices: Object.values(byRole).reduce((sum, count) => sum + count, 0) };
  }
};

// src/adaptive/game-state-controller.js
var GameStateController = class {
  constructor(audio) {
    this.audio = audio;
    this.states = /* @__PURE__ */ new Map();
  }
  define(states) {
    Object.entries(states || {}).forEach(([name, definition]) => this.states.set(name, definition));
    if (this.audio?.defineMusicStates) this.audio.defineMusicStates(states);
    return this;
  }
  set(name, options = {}) {
    if (this.audio?.setMusicState) return this.audio.setMusicState(name, options);
    return this.apply(name, options);
  }
  queue(name, options = {}) {
    if (this.audio?.queueMusicState) return this.audio.queueMusicState(name, options);
    return this.apply(name, options);
  }
  apply(name, options = {}) {
    const definition = this.states.get(name);
    if (!definition) throw new Error(`Unknown music state: ${name}`);
    if (definition.section) this.audio.queueSection(definition.section, options);
    if (definition.sequence) this.audio.setSequence(definition.sequence);
    if (definition.loop !== void 0) this.audio.setLoop({ enabled: Boolean(definition.loop), sectionId: definition.section });
    if (definition.intensity !== void 0 && this.audio.setIntensity) this.audio.setIntensity(definition.intensity);
    if (definition.fx) this.audio.setFx(definition.fx);
    if (definition.lowpass !== void 0 && this.audio.lowpass) this.audio.lowpass(definition.lowpass);
    if (definition.duck !== void 0 && this.audio.duck) this.audio.duck(Boolean(definition.duck), typeof definition.duck === "object" ? definition.duck : {});
    if (definition.stems) this.audio.applyStemPatchMap?.(definition.stems);
    if (definition.stinger && this.audio.triggerStinger) this.audio.triggerStinger(name);
    return definition;
  }
};

// src/export/audio-metrics.js
function analyseRenderedBuffer(rendered) {
  const channels = rendered.channels || [];
  let peak = 0;
  let sumSquares = 0;
  let count = 0;
  let zeroCrossings = 0;
  let clippedSamples = 0;
  let nanSamples = 0;
  let infiniteSamples = 0;
  const sums = channels.map(() => 0);
  const startThreshold = dbToAmp(-60);
  let firstAudibleFrame = null;
  let lastAudibleFrame = null;
  const hash = createFnv1a();
  channels.forEach((channel, channelIndex) => {
    let previous = 0;
    for (let index = 0; index < channel.length; index += 1) {
      const raw = channel[index];
      if (Number.isNaN(raw)) nanSamples += 1;
      if (raw === Infinity || raw === -Infinity) infiniteSamples += 1;
      const finite = Number.isFinite(raw) ? raw : 0;
      const abs = Math.abs(finite);
      if (abs >= 1) clippedSamples += 1;
      const sample = Math.max(-1, Math.min(1, finite));
      peak = Math.max(peak, abs);
      sumSquares += finite * finite;
      sums[channelIndex] += finite;
      count += 1;
      if (index > 0 && Math.sign(sample) !== Math.sign(previous)) zeroCrossings += 1;
      previous = sample;
      if (abs >= startThreshold) {
        if (firstAudibleFrame === null || index < firstAudibleFrame) firstAudibleFrame = index;
        if (lastAudibleFrame === null || index > lastAudibleFrame) lastAudibleFrame = index;
      }
      hash.update(Math.round(sample * 32767));
    }
  });
  const rms = Math.sqrt(sumSquares / Math.max(1, count));
  const sampleRate = rendered.sampleRate || 44100;
  const frameCount = Math.max(0, channels[0]?.length || 0);
  const truePeak = estimateTruePeak(channels);
  const spectralBalance = estimateSpectralBalance(channels, sampleRate);
  const left = channels[0] || new Float32Array(0);
  const right = channels[1] || left;
  const stereoCorrelation = estimateStereoCorrelation(left, right);
  const durationSeconds = Number.isFinite(rendered.duration) ? rendered.duration : frameCount / sampleRate;
  return {
    durationSeconds: round(durationSeconds),
    sampleRate,
    channelCount: channels.length,
    eventCount: rendered.eventCount,
    peak: round(peak),
    samplePeakDbfs: ampToDb(peak),
    truePeakDbtp: ampToDb(truePeak),
    estimatedTruePeakDbtp: ampToDb(truePeak),
    truePeakMethod: "estimated_catmull_rom_4x_v2",
    intersampleRisk: truePeak > peak + dbToAmp(-60),
    rms: round(rms),
    rmsDbfs: ampToDb(rms),
    integratedLufs: estimateIntegratedLufs(channels, sampleRate),
    lufsMethod: "estimated_bs1770_k_weighted_gated_v2",
    meteringStatus: "estimated_pending_external_calibration",
    crestFactorDb: rms > 0 ? round(ampToDb(peak / rms)) : null,
    clippedSamples,
    nanSamples,
    infiniteSamples,
    nonFiniteSamples: nanSamples + infiniteSamples,
    dcOffsetL: round(sums[0] / Math.max(1, left.length)),
    dcOffsetR: round((sums[1] ?? sums[0] ?? 0) / Math.max(1, right.length)),
    stereoCorrelation,
    silenceAtStartMs: firstAudibleFrame === null ? round(durationSeconds * 1e3) : round(firstAudibleFrame / sampleRate * 1e3),
    tailSeconds: lastAudibleFrame === null ? 0 : round(Math.max(0, durationSeconds - lastAudibleFrame / sampleRate)),
    spectralBalance,
    zeroCrossingRate: round(zeroCrossings / Math.max(1, count)),
    quantizedSampleHash: hash.digest()
  };
}
function analyseAudioChannels({ channels, sampleRate = 44100, duration, eventCount = 0 }) {
  return analyseRenderedBuffer({ channels, sampleRate, duration: duration ?? (channels?.[0]?.length || 0) / sampleRate, eventCount });
}
function round(value) {
  if (value === null || value === void 0) return value;
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 1e6) / 1e6;
}
function ampToDb(value) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return round(20 * Math.log10(value));
}
function dbToAmp(db) {
  return Math.pow(10, db / 20);
}
function estimateTruePeak(channels, oversample = 4) {
  let peak = 0;
  channels.forEach((channel) => {
    for (let index = 0; index < channel.length; index += 1) {
      const p0 = finiteAt(channel, index - 1);
      const p1 = finiteAt(channel, index);
      const p2 = finiteAt(channel, index + 1, p1);
      const p3 = finiteAt(channel, index + 2, p2);
      peak = Math.max(peak, Math.abs(p1));
      for (let step = 1; step < oversample; step += 1) {
        const t = step / oversample;
        const interpolated = catmullRom(p0, p1, p2, p3, t);
        peak = Math.max(peak, Math.abs(interpolated));
      }
    }
  });
  return peak;
}
function estimateIntegratedLufs(channels, sampleRate) {
  const weighted = channels.map((channel) => applyKWeighting(channel, sampleRate));
  const blockSize = Math.max(1, Math.round(sampleRate * 0.4));
  const hopSize = Math.max(1, Math.round(sampleRate * 0.1));
  const blockPowers = [];
  const frameCount = weighted[0]?.length || 0;
  if (frameCount < blockSize) return null;
  for (let start = 0; start <= frameCount - blockSize; start += hopSize) {
    let channelPowerSum = 0;
    weighted.forEach((channel, channelIndex) => {
      const channelWeight = channelIndex >= 3 ? 1.41 : 1;
      let sum = 0;
      for (let index = start; index < start + blockSize; index += 1) {
        const sample = Number.isFinite(channel[index]) ? channel[index] : 0;
        sum += sample * sample;
      }
      channelPowerSum += channelWeight * (sum / blockSize);
    });
    const lufs = loudnessFromPower(channelPowerSum);
    if (lufs >= -70) blockPowers.push(channelPowerSum);
  }
  if (!blockPowers.length) return null;
  const ungated = blockPowers.reduce((sum, value) => sum + value, 0) / blockPowers.length;
  const relativeGate = loudnessFromPower(ungated) - 10;
  const gated = blockPowers.filter((value) => loudnessFromPower(value) >= relativeGate);
  const mean = (gated.length ? gated : blockPowers).reduce((sum, value) => sum + value, 0) / Math.max(1, (gated.length ? gated : blockPowers).length);
  return round(loudnessFromPower(mean));
}
function finiteAt(channel, index, fallback = 0) {
  const value = channel[index];
  return Number.isFinite(value) ? value : fallback;
}
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
function loudnessFromPower(power) {
  return -0.691 + 10 * Math.log10(Math.max(1e-20, power));
}
function applyKWeighting(channel, sampleRate) {
  const highShelf = designHighShelf(sampleRate, 1681.974450955533, 3.999843853973347, 0.7071752369554196);
  const highPass2 = designHighPass(sampleRate, 38.13547087613982, 0.5003270373238773);
  return applyBiquad(applyBiquad(channel, highShelf), highPass2);
}
function applyBiquad(channel, coeffs) {
  const out = new Float32Array(channel.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let index = 0; index < channel.length; index += 1) {
    const x0 = Number.isFinite(channel[index]) ? channel[index] : 0;
    const y0 = coeffs.b0 * x0 + coeffs.b1 * x1 + coeffs.b2 * x2 - coeffs.a1 * y1 - coeffs.a2 * y2;
    out[index] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}
function designHighShelf(sampleRate, hz, gainDb, q) {
  const a = Math.pow(10, gainDb / 40);
  const omega = 2 * Math.PI * hz / sampleRate;
  const sin = Math.sin(omega);
  const cos = Math.cos(omega);
  const alpha = sin / (2 * q);
  const sqrtA = Math.sqrt(a);
  const b0 = a * (a + 1 + (a - 1) * cos + 2 * sqrtA * alpha);
  const b1 = -2 * a * (a - 1 + (a + 1) * cos);
  const b2 = a * (a + 1 + (a - 1) * cos - 2 * sqrtA * alpha);
  const a0 = a + 1 - (a - 1) * cos + 2 * sqrtA * alpha;
  const a1 = 2 * (a - 1 - (a + 1) * cos);
  const a2 = a + 1 - (a - 1) * cos - 2 * sqrtA * alpha;
  return normalizeBiquad({ b0, b1, b2, a0, a1, a2 });
}
function designHighPass(sampleRate, hz, q) {
  const omega = 2 * Math.PI * hz / sampleRate;
  const sin = Math.sin(omega);
  const cos = Math.cos(omega);
  const alpha = sin / (2 * q);
  const b0 = (1 + cos) / 2;
  const b1 = -(1 + cos);
  const b2 = (1 + cos) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  return normalizeBiquad({ b0, b1, b2, a0, a1, a2 });
}
function normalizeBiquad({ b0, b1, b2, a0, a1, a2 }) {
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0
  };
}
function estimateStereoCorrelation(left, right) {
  const length = Math.min(left.length, right.length);
  if (!length) return null;
  let sumL = 0;
  let sumR = 0;
  let sumLL = 0;
  let sumRR = 0;
  let sumLR = 0;
  for (let index = 0; index < length; index += 1) {
    const l = Number.isFinite(left[index]) ? left[index] : 0;
    const r = Number.isFinite(right[index]) ? right[index] : 0;
    sumL += l;
    sumR += r;
    sumLL += l * l;
    sumRR += r * r;
    sumLR += l * r;
  }
  const cov = sumLR - sumL * sumR / length;
  const varL = sumLL - sumL * sumL / length;
  const varR = sumRR - sumR * sumR / length;
  const denom = Math.sqrt(Math.max(0, varL * varR));
  return denom > 0 ? round(cov / denom) : null;
}
function estimateSpectralBalance(channels, sampleRate) {
  const mono = channels[0] || new Float32Array(0);
  const length = Math.min(mono.length, 8192);
  if (!length) return {};
  const start = Math.max(0, Math.floor((mono.length - length) / 2));
  const centers = {
    sub: 50,
    bass: 120,
    lowMid: 350,
    mid: 1e3,
    presence: 3500,
    air: 9e3
  };
  const out = {};
  for (const [band, hz] of Object.entries(centers)) {
    const power = goertzelPower(mono, start, length, hz, sampleRate);
    out[band] = ampToDb(Math.sqrt(power));
  }
  return out;
}
function goertzelPower(data, start, length, hz, sampleRate) {
  const k = Math.round(length * hz / sampleRate);
  const omega = 2 * Math.PI * k / length;
  const coeff = 2 * Math.cos(omega);
  let q0 = 0;
  let q1 = 0;
  let q2 = 0;
  for (let index = 0; index < length; index += 1) {
    const sample = Number.isFinite(data[start + index]) ? data[start + index] : 0;
    q0 = coeff * q1 - q2 + sample;
    q2 = q1;
    q1 = q0;
  }
  return Math.max(0, (q1 * q1 + q2 * q2 - q1 * q2 * coeff) / (length * length));
}
function createFnv1a() {
  let hash = 2166136261;
  return {
    update(value) {
      hash ^= value & 255;
      hash = Math.imul(hash, 16777619) >>> 0;
      hash ^= value >> 8 & 255;
      hash = Math.imul(hash, 16777619) >>> 0;
    },
    digest() {
      return hash.toString(16).padStart(8, "0");
    }
  };
}

// src/export/game-pack-paths.js
var GAME_PACK_FOLDERS = Object.freeze({
  full: "audio/full/",
  stems: "audio/stems/",
  sections: "audio/sections/",
  samples: "audio/samples/",
  manifests: "manifests/",
  source: "source/"
});
var GAME_PACK_MANIFEST_FILES = Object.freeze({
  "godot-adaptive-pack": "godot-adaptive-manifest.json",
  "web-game-pack": "web-game-manifest.json"
});
function gamePackPath(folder, fileName) {
  const prefix = GAME_PACK_FOLDERS[folder] || "";
  const safeFile = String(fileName || "").replace(/\\/g, "/").split("/").filter((part) => part && part !== "." && part !== "..").join("/");
  if (!prefix || !safeFile) throw new Error(`Invalid game-pack path: ${folder}/${fileName}`);
  return `${prefix}${safeFile}`;
}
function gamePackManifestPath(kind = "godot-adaptive-pack") {
  const file = GAME_PACK_MANIFEST_FILES[kind] || GAME_PACK_MANIFEST_FILES["godot-adaptive-pack"];
  return gamePackPath("manifests", file);
}
function safeGamePackName(value, fallback = "pocket-audio") {
  return String(value || fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}
function gamePackFullMixPath(projectTitle = "pocket-audio") {
  return gamePackPath("full", `${safeGamePackName(projectTitle)}-full-mix.wav`);
}
function gamePackStemPath(projectTitle, stemLabel) {
  return gamePackPath("stems", `${safeGamePackName(projectTitle)}-${safeGamePackName(stemLabel, "stem")}-stem.wav`);
}
function gamePackSectionLoopPath(projectTitle, sectionName) {
  return gamePackPath("sections", `${safeGamePackName(projectTitle)}-${safeGamePackName(sectionName, "section")}-loop.wav`);
}
function gamePackSourceProjectPath(projectTitle = "pocket-audio") {
  return gamePackPath("source", `${safeGamePackName(projectTitle)}.pocketdaw.json`);
}

// src/fx/pro-eq.js
var POCKET_PRO_EQ_TYPE = "parametric-eq";
var POCKET_PRO_EQ_BANDS = Object.freeze([
  Object.freeze({
    id: "hp",
    label: "High Pass",
    nodeType: "highpass",
    frequencyParam: "hpFrequency",
    qParam: "hpQ",
    enabledParam: "hpEnabled",
    defaultEnabled: false,
    defaultFrequency: 35,
    minFrequency: 20,
    maxFrequency: 1e3,
    defaultQ: 0.7,
    minQ: 0.1,
    maxQ: 4
  }),
  Object.freeze({
    id: "lowShelf",
    label: "Low Shelf",
    nodeType: "lowshelf",
    frequencyParam: "lowShelfFrequency",
    gainParam: "lowShelfGain",
    enabledParam: "lowShelfEnabled",
    defaultEnabled: true,
    defaultFrequency: 120,
    minFrequency: 40,
    maxFrequency: 500,
    defaultGain: 0,
    minGain: -12,
    maxGain: 12
  }),
  Object.freeze({
    id: "lowMid",
    label: "Low Mid",
    nodeType: "peaking",
    frequencyParam: "lowMidFrequency",
    gainParam: "lowMidGain",
    qParam: "lowMidQ",
    enabledParam: "lowMidEnabled",
    defaultEnabled: true,
    defaultFrequency: 420,
    minFrequency: 120,
    maxFrequency: 2200,
    defaultGain: 0,
    minGain: -12,
    maxGain: 12,
    defaultQ: 1,
    minQ: 0.2,
    maxQ: 8
  }),
  Object.freeze({
    id: "highMid",
    label: "High Mid",
    nodeType: "peaking",
    frequencyParam: "highMidFrequency",
    gainParam: "highMidGain",
    qParam: "highMidQ",
    enabledParam: "highMidEnabled",
    defaultEnabled: true,
    defaultFrequency: 2400,
    minFrequency: 700,
    maxFrequency: 8e3,
    defaultGain: 0,
    minGain: -12,
    maxGain: 12,
    defaultQ: 1,
    minQ: 0.2,
    maxQ: 8
  }),
  Object.freeze({
    id: "highShelf",
    label: "High Shelf",
    nodeType: "highshelf",
    frequencyParam: "highShelfFrequency",
    gainParam: "highShelfGain",
    enabledParam: "highShelfEnabled",
    defaultEnabled: true,
    defaultFrequency: 8200,
    minFrequency: 2200,
    maxFrequency: 18e3,
    defaultGain: 0,
    minGain: -12,
    maxGain: 12
  }),
  Object.freeze({
    id: "lp",
    label: "Low Pass",
    nodeType: "lowpass",
    frequencyParam: "lpFrequency",
    qParam: "lpQ",
    enabledParam: "lpEnabled",
    defaultEnabled: false,
    defaultFrequency: 16e3,
    minFrequency: 1200,
    maxFrequency: 2e4,
    defaultQ: 0.7,
    minQ: 0.1,
    maxQ: 4
  })
]);
var POCKET_PRO_EQ_DEFAULT_PARAMETERS = Object.freeze(defaultPocketProEqParameters());
var POCKET_PRO_EQ_PRESETS = Object.freeze([
  Object.freeze({
    id: "flat",
    name: "Flat",
    parameters: POCKET_PRO_EQ_DEFAULT_PARAMETERS
  }),
  Object.freeze({
    id: "lofi-soft-rolloff",
    name: "Lofi Soft Rolloff",
    parameters: Object.freeze({
      ...defaultPocketProEqParameters(),
      hpEnabled: true,
      hpFrequency: 38,
      lowShelfGain: -1.5,
      lowMidGain: 1.2,
      highShelfGain: -2.8,
      lpEnabled: true,
      lpFrequency: 11800
    })
  }),
  Object.freeze({
    id: "vocal-cleanup",
    name: "Vocal Cleanup",
    parameters: Object.freeze({
      ...defaultPocketProEqParameters(),
      hpEnabled: true,
      hpFrequency: 95,
      lowMidGain: -2.2,
      lowMidFrequency: 360,
      lowMidQ: 1.2,
      highMidGain: 1.4,
      highMidFrequency: 3200,
      highMidQ: 0.9,
      highShelfGain: 1.1
    })
  }),
  Object.freeze({
    id: "drum-punch",
    name: "Drum Punch",
    parameters: Object.freeze({
      ...defaultPocketProEqParameters(),
      lowShelfGain: 1.8,
      lowShelfFrequency: 90,
      lowMidGain: -1.6,
      lowMidFrequency: 520,
      highMidGain: 1.8,
      highMidFrequency: 4200,
      highShelfGain: 1
    })
  }),
  Object.freeze({
    id: "lofi-drum-softener",
    name: "Lofi Drum Softener",
    parameters: Object.freeze({
      ...defaultPocketProEqParameters(),
      hpEnabled: true,
      hpFrequency: 42,
      lowShelfGain: 0.8,
      lowShelfFrequency: 95,
      lowMidGain: -1.1,
      lowMidFrequency: 480,
      highMidGain: -1.4,
      highMidFrequency: 3600,
      highShelfGain: -2.2,
      lpEnabled: true,
      lpFrequency: 12400
    })
  }),
  Object.freeze({
    id: "warm-bass-pocket",
    name: "Warm Bass Pocket",
    parameters: Object.freeze({
      ...defaultPocketProEqParameters(),
      hpEnabled: true,
      hpFrequency: 28,
      lowShelfGain: 1.2,
      lowShelfFrequency: 82,
      lowMidGain: -1.4,
      lowMidFrequency: 320,
      lowMidQ: 1.2,
      highMidGain: -1.8,
      highMidFrequency: 2200,
      highShelfGain: -1.5
    })
  }),
  Object.freeze({
    id: "soft-chord-bed",
    name: "Soft Chord Bed",
    parameters: Object.freeze({
      ...defaultPocketProEqParameters(),
      hpEnabled: true,
      hpFrequency: 72,
      lowShelfGain: -1.2,
      lowMidGain: -1.8,
      lowMidFrequency: 520,
      lowMidQ: 1.3,
      highMidGain: 0.8,
      highMidFrequency: 2400,
      highShelfGain: -2.4,
      lpEnabled: true,
      lpFrequency: 13200
    })
  }),
  Object.freeze({
    id: "gentle-lead-presence",
    name: "Gentle Lead Presence",
    parameters: Object.freeze({
      ...defaultPocketProEqParameters(),
      hpEnabled: true,
      hpFrequency: 110,
      lowMidGain: -1.4,
      lowMidFrequency: 430,
      highMidGain: 1.3,
      highMidFrequency: 2900,
      highMidQ: 0.85,
      highShelfGain: 0.6,
      lpEnabled: true,
      lpFrequency: 15600
    })
  })
]);
function defaultPocketProEqParameters() {
  const out = {};
  for (const band of POCKET_PRO_EQ_BANDS) {
    out[band.enabledParam] = band.defaultEnabled;
    out[band.frequencyParam] = band.defaultFrequency;
    if (band.gainParam) out[band.gainParam] = band.defaultGain;
    if (band.qParam) out[band.qParam] = band.defaultQ;
  }
  return out;
}
function getPocketProEqPreset(id = "flat") {
  return POCKET_PRO_EQ_PRESETS.find((preset) => preset.id === id) || POCKET_PRO_EQ_PRESETS[0];
}
function pocketProEqPresetParameters(id = "flat") {
  return { ...getPocketProEqPreset(id).parameters };
}

// src/fx/chordsmith-fx.js
var CHORDSMITH_FX_GRAPH = Object.freeze({
  dryGainFloor: 0.52,
  dryGainMixDepth: 0.48,
  wetMasterGain: 1.45,
  toneFrequency: 1800,
  toneBrightness: Object.freeze({
    chorus: 0.9,
    flanger: 1.1,
    reverb: 0.35,
    delay: -0.1,
    gain: 6,
    min: -2,
    max: 7
  }),
  delay: Object.freeze({ timeBase: 0.1, timeRange: 0.42, feedbackBase: 0.05, feedbackRange: 0.72, wetGain: 0.95 }),
  chorus: Object.freeze({ delayTime: 0.016, rateBase: 0.25, rateRange: 1.9, depthBase: 14e-4, depthRange: 0.03, wetGain: 0.95 }),
  flanger: Object.freeze({ delayTime: 3e-3, rateBase: 0.1, rateRange: 1.1, depthBase: 7e-4, depthRange: 62e-4, feedbackBase: 0.08, feedbackRange: 0.82, wetGain: 0.85 }),
  reverb: Object.freeze({ impulseSeconds: 1.6, impulseDecay: 2.4, wetGain: 1.05 })
});
function chordsmithFxParameters(fx = {}) {
  const delay = clamp015(fx.delay ?? fx.fxDelay ?? DEFAULT_FX.delay);
  const chorus = clamp015(fx.chorus ?? fx.fxChorus ?? DEFAULT_FX.chorus);
  const flanger = clamp015(fx.flanger ?? fx.fxFlanger ?? DEFAULT_FX.flanger);
  const reverb = clamp015(fx.reverb ?? fx.fxReverb ?? DEFAULT_FX.reverb);
  const mix = clamp015(fx.mix ?? fx.fxMix ?? DEFAULT_FX.mix);
  const wetScale = mix * CHORDSMITH_FX_GRAPH.wetMasterGain;
  const brightness = chorus * CHORDSMITH_FX_GRAPH.toneBrightness.chorus + flanger * CHORDSMITH_FX_GRAPH.toneBrightness.flanger + reverb * CHORDSMITH_FX_GRAPH.toneBrightness.reverb - delay * Math.abs(CHORDSMITH_FX_GRAPH.toneBrightness.delay);
  return {
    source: { delay, chorus, flanger, reverb, mix },
    dryGain: Math.max(CHORDSMITH_FX_GRAPH.dryGainFloor, 1 - mix * CHORDSMITH_FX_GRAPH.dryGainMixDepth),
    wetMasterGain: wetScale,
    tone: {
      frequency: CHORDSMITH_FX_GRAPH.toneFrequency,
      gain: clamp5(
        brightness * CHORDSMITH_FX_GRAPH.toneBrightness.gain,
        CHORDSMITH_FX_GRAPH.toneBrightness.min,
        CHORDSMITH_FX_GRAPH.toneBrightness.max
      )
    },
    delay: {
      time: CHORDSMITH_FX_GRAPH.delay.timeBase + delay * CHORDSMITH_FX_GRAPH.delay.timeRange,
      feedback: CHORDSMITH_FX_GRAPH.delay.feedbackBase + delay * CHORDSMITH_FX_GRAPH.delay.feedbackRange,
      mix: clamp015(delay * CHORDSMITH_FX_GRAPH.delay.wetGain * wetScale)
    },
    chorus: {
      rate: CHORDSMITH_FX_GRAPH.chorus.rateBase + chorus * CHORDSMITH_FX_GRAPH.chorus.rateRange,
      depth: CHORDSMITH_FX_GRAPH.chorus.depthBase + chorus * CHORDSMITH_FX_GRAPH.chorus.depthRange,
      mix: clamp015(chorus * CHORDSMITH_FX_GRAPH.chorus.wetGain * wetScale)
    },
    flanger: {
      rate: CHORDSMITH_FX_GRAPH.flanger.rateBase + flanger * CHORDSMITH_FX_GRAPH.flanger.rateRange,
      depth: CHORDSMITH_FX_GRAPH.flanger.depthBase + flanger * CHORDSMITH_FX_GRAPH.flanger.depthRange,
      feedback: CHORDSMITH_FX_GRAPH.flanger.feedbackBase + flanger * CHORDSMITH_FX_GRAPH.flanger.feedbackRange,
      mix: clamp015(flanger * CHORDSMITH_FX_GRAPH.flanger.wetGain * wetScale)
    },
    reverb: {
      decay: CHORDSMITH_FX_GRAPH.reverb.impulseSeconds,
      impulseDecay: CHORDSMITH_FX_GRAPH.reverb.impulseDecay,
      mix: clamp015(reverb * CHORDSMITH_FX_GRAPH.reverb.wetGain * wetScale)
    }
  };
}
function chordsmithDawSynthFxSlots(fx = {}) {
  const params = chordsmithFxParameters(fx);
  const slots = [];
  if (Math.abs(params.tone.gain) > 0.01) {
    slots.push({
      id: "pcs_tone",
      type: POCKET_PRO_EQ_TYPE,
      name: "Chordsmith FX Tone",
      enabled: true,
      presetId: "pocket-chordsmith-tone",
      parameters: {
        ...POCKET_PRO_EQ_DEFAULT_PARAMETERS,
        hpEnabled: false,
        lowShelfEnabled: false,
        lowMidEnabled: false,
        highMidEnabled: false,
        highShelfEnabled: true,
        highShelfFrequency: params.tone.frequency,
        highShelfGain: params.tone.gain,
        lpEnabled: false
      }
    });
  }
  if (params.delay.mix > 0.01) {
    slots.push({
      id: "pcs_delay",
      type: "delay",
      name: "Chordsmith Delay",
      enabled: true,
      presetId: "pocket-chordsmith",
      parameters: params.delay
    });
  }
  const flanger = fxValue(fx.flanger ?? fx.fxFlanger ?? DEFAULT_FX.flanger);
  const modMix = clamp015(params.chorus.mix + flanger * 0.35 * params.wetMasterGain);
  if (modMix > 0.01) {
    slots.push({
      id: "pcs_chorus",
      type: "chorus",
      name: "Chordsmith Mod",
      enabled: true,
      presetId: "pocket-chordsmith",
      parameters: {
        rate: params.chorus.rate + flanger * 0.55,
        depth: params.chorus.depth + flanger * CHORDSMITH_FX_GRAPH.flanger.depthRange,
        mix: modMix
      }
    });
  }
  if (params.reverb.mix > 0.01) {
    slots.push({
      id: "pcs_reverb",
      type: "reverb",
      name: "Chordsmith Reverb",
      enabled: true,
      presetId: "pocket-chordsmith",
      parameters: { decay: params.reverb.decay, mix: params.reverb.mix }
    });
  }
  return slots;
}
function fxValue(value) {
  return clamp015(value);
}
function clamp015(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return clamp5(number, 0, 1);
}
function clamp5(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// src/export/godot-kit.js
var GODOT_EXPORT_PROFILES = Object.freeze({
  STEM_SYNC: "STEM_SYNC",
  LOOP_KIT: "LOOP_KIT",
  HYBRID: "HYBRID",
  PROCEDURAL_PREVIEW: "PROCEDURAL_PREVIEW"
});
async function createGodotExportKit(input, options = {}) {
  const project = normaliseInput(input);
  const profile2 = normaliseProfile(options.profile || GODOT_EXPORT_PROFILES.LOOP_KIT);
  const sampleRate = Number(options.sampleRate || 48e3);
  const files = /* @__PURE__ */ new Map();
  const manifest = createBaseManifest(project, { profile: profile2, sampleRate });
  if (profile2 === GODOT_EXPORT_PROFILES.STEM_SYNC) {
    await addStemSyncAssets(project, manifest, files, { sampleRate });
  } else if (profile2 === GODOT_EXPORT_PROFILES.LOOP_KIT) {
    await addLoopKitAssets(project, manifest, files, { sampleRate, includeStems: options.includeStems !== false });
  } else if (profile2 === GODOT_EXPORT_PROFILES.HYBRID) {
    await addHybridAssets(project, manifest, files, { sampleRate });
  } else {
    manifest.previewOnly = true;
    manifest.notes.push("PROCEDURAL_PREVIEW is for editor convenience only and is not a parity export.");
  }
  manifest.events = buildManifestEvents(project);
  manifest.fileCount = files.size;
  return { manifest, files };
}
function createGodotManifest(input, options = {}) {
  const project = normaliseInput(input);
  const profile2 = normaliseProfile(options.profile || GODOT_EXPORT_PROFILES.LOOP_KIT);
  const sampleRate = Number(options.sampleRate || 48e3);
  const manifest = createBaseManifest(project, { profile: profile2, sampleRate });
  manifest.events = buildManifestEvents(project);
  return manifest;
}
function normaliseInput(input) {
  const raw = input?.app === "PocketAudioProject" ? input : parsePocketChordsmithInput(input);
  return raw?.app === "PocketAudioProject" ? raw : normalisePocketChordsmithProject(raw);
}
function normaliseProfile(profile2) {
  const safe = String(profile2 || "").toUpperCase();
  if (!Object.values(GODOT_EXPORT_PROFILES).includes(safe)) throw new Error(`Unknown Godot export profile: ${profile2}`);
  return safe;
}
function createBaseManifest(project, { profile: profile2, sampleRate }) {
  const sections = {};
  Object.entries(project.sections).forEach(([id, section]) => {
    const timeline = buildPocketAudioTimeline(project, { scope: "section", sectionId: id });
    sections[id] = {
      bars: section.bars,
      duration: roundTime(timeline.duration),
      loopStart: 0,
      loopEnd: roundTime(timeline.duration),
      assets: {}
    };
  });
  return {
    app: "PocketAudioCoreGodotKit",
    coreVersion: POCKET_AUDIO_CORE_VERSION,
    profile: profile2,
    sourceProjectSchema: project.source?.sourceSchemaVersion || 16,
    title: project.meta.title,
    bpm: project.meta.bpm,
    timeSig: project.meta.timeSig,
    swing: project.meta.swing,
    audioProfile: project.meta.audioProfile || "standard",
    soundProfile: cloneJson5(project.soundProfile || {}),
    formatFeatures: cloneJson5(project.formatFeatures || []),
    capabilityReport: createPocketAudioRendererCapabilityReport(project, { renderer: "offline" }),
    fx: createFxManifest(project),
    lofi: createLofiManifest(project),
    chip: createChipManifest(project),
    metal: createMetalManifest(project),
    funk: cloneJson5(project.funk || {}),
    western: cloneJson5(project.western || {}),
    soundRegistry: createSoundRegistryManifest(project),
    sampleRate,
    sequence: project.sequence.slice(),
    sections,
    assets: {},
    folders: {
      full: GAME_PACK_FOLDERS.full,
      stems: GAME_PACK_FOLDERS.stems,
      sections: GAME_PACK_FOLDERS.sections,
      samples: GAME_PACK_FOLDERS.samples
    },
    events: [],
    notes: [
      "Exact parity requires these core-rendered assets. Native Godot procedural playback should be labelled preview until tested."
    ]
  };
}
async function addStemSyncAssets(project, manifest, files, { sampleRate }) {
  const fullMixName = gamePackPath("full", "full_mix.wav");
  files.set(fullMixName, renderPocketAudioWav(project, { scope: "sequence", sampleRate, tailSeconds: 0 }));
  manifest.assets.mix = fullMixName;
  const stems = await renderPocketAudioStems(project, { scope: "sequence", sampleRate, tailSeconds: 0, stems: STEM_IDS });
  STEM_IDS.forEach((stem) => {
    const name = gamePackPath("stems", `${stem}.wav`);
    files.set(name, stems[stem]);
    manifest.assets[stem] = name;
  });
}
async function addLoopKitAssets(project, manifest, files, { sampleRate, includeStems }) {
  for (const sectionId of Object.keys(manifest.sections)) {
    const sectionManifest = manifest.sections[sectionId];
    const mixName = gamePackPath("sections", `section_${sectionId}_mix.wav`);
    files.set(mixName, renderPocketAudioWav(project, { scope: "section", sectionId, sampleRate, tailSeconds: 0 }));
    sectionManifest.assets.mix = mixName;
    if (includeStems) {
      const stems = await renderPocketAudioStems(project, { scope: "section", sectionId, sampleRate, tailSeconds: 0, stems: STEM_IDS });
      STEM_IDS.forEach((stem) => {
        const name = gamePackPath("stems", `section_${sectionId}_${stem}.wav`);
        files.set(name, stems[stem]);
        sectionManifest.assets[stem] = name;
      });
    }
  }
}
async function addHybridAssets(project, manifest, files, { sampleRate }) {
  const stems = await renderPocketAudioStems(project, { scope: "sequence", sampleRate, tailSeconds: 0, stems: STEM_IDS });
  STEM_IDS.forEach((stem) => {
    const name = gamePackPath("stems", `bed_${stem}.wav`);
    files.set(name, stems[stem]);
    manifest.assets[stem] = name;
  });
  ["kick", "snare", "crash", "victory_stinger"].forEach((sample) => {
    const name = gamePackPath("samples", `${sample}.wav`);
    files.set(name, createSilentWavBlob({ durationSeconds: sample.endsWith("stinger") ? 0.75 : 0.25, sampleRate }));
    manifest.assets[sample] = name;
  });
  manifest.notes.push("HYBRID sample assets are generated placeholders in this v0 export and should be replaced as the sample kit matures.");
}
function createFxManifest(project) {
  const fx = project.mixer?.fx || {};
  const mapped = chordsmithFxParameters({
    delay: fx.delay,
    chorus: fx.chorus,
    flanger: fx.flanger,
    reverb: fx.reverb,
    mix: fx.mix
  });
  return {
    source: cloneJson5(mapped.source),
    dryGain: mapped.dryGain,
    wetMasterGain: mapped.wetMasterGain,
    tone: cloneJson5(mapped.tone),
    delay: cloneJson5(mapped.delay),
    chorus: cloneJson5(mapped.chorus),
    flanger: cloneJson5(mapped.flanger),
    reverb: cloneJson5(mapped.reverb),
    sidechain: cloneJson5(fx.sidechain || {})
  };
}
function buildManifestEvents(project) {
  const timeline = buildPocketAudioTimeline(project, { scope: "sequence" });
  const sectionStartEvents = [];
  let cursor = 0;
  timeline.sectionIds.forEach((sectionId, arrangementIndex) => {
    const sectionTimeline = buildPocketAudioTimeline(project, { scope: "section", sectionId });
    sectionStartEvents.push({
      time: roundTime(cursor),
      sectionId,
      arrangementIndex,
      bar: 1,
      beat: 1,
      type: "section_start"
    });
    cursor += sectionTimeline.duration;
  });
  const musicalEvents = timeline.events.map(createManifestEvent);
  return [...sectionStartEvents, ...musicalEvents].sort((a, b) => a.time - b.time || eventOrder(a.type) - eventOrder(b.type));
}
function createManifestEvent(event2) {
  const out = {
    time: roundTime(event2.time),
    sectionId: event2.sectionId,
    bar: event2.bar,
    beat: event2.beat,
    stem: event2.stem,
    type: event2.type,
    tick: event2.tick,
    durationTicks: event2.durationTicks,
    step: event2.step,
    arrangementIndex: event2.arrangementIndex,
    duration: roundTime(event2.duration || 0)
  };
  [
    "audioProfile",
    "lofiPreset",
    "chipPreset",
    "metalPreset",
    "funkPreset",
    "westernPreset",
    "drumKit",
    "bassTone",
    "instrument",
    "articulation",
    "midi",
    "midiNotes",
    "velocity",
    "pan",
    "accent",
    "tuplet",
    "slideMidi",
    "slideOffset",
    "direction",
    "soundProfile",
    "sourceArticulation",
    "sound",
    "lane",
    "role",
    "expression",
    "technique",
    "note",
    "notes",
    "trackId",
    "compatibility"
  ].forEach((key) => {
    if (event2[key] !== void 0) out[key] = cloneJson5(event2[key]);
  });
  if (event2.lofiTexture?.enabled) out.lofiTexture = cloneJson5(event2.lofiTexture);
  if (event2.chipTexture?.enabled) out.chipTexture = cloneJson5(event2.chipTexture);
  if (event2.metalTexture?.enabled) out.metalTexture = cloneJson5(event2.metalTexture);
  return out;
}
function createLofiManifest(project) {
  const lofi = project.lofi || {};
  return {
    presetId: lofi.presetId || "",
    drumKit: lofi.drumKit || "classic",
    drumGroovePreset: lofi.drumGroovePreset || "",
    bassTone: lofi.bassTone || "classic",
    texture: cloneJson5(lofi.texture || {}),
    intensityHints: cloneJson5(lofi.intensityHints || {})
  };
}
function createChipManifest(project) {
  const chip = project.chip || {};
  return {
    presetId: chip.presetId || "",
    drumKit: chip.drumKit || "classic",
    drumGroovePreset: chip.drumGroovePreset || "",
    bassTone: chip.bassTone || "classic",
    texture: cloneJson5(chip.texture || {}),
    intensityHints: cloneJson5(chip.intensityHints || {})
  };
}
function createMetalManifest(project) {
  const metal = project.metal || {};
  return {
    presetId: metal.presetId || "",
    drumKit: metal.drumKit || "classic",
    drumGroovePreset: metal.drumGroovePreset || "",
    bassTone: metal.bassTone || "classic",
    guitarTone: metal.guitarTone || "",
    guitarPatternPreset: metal.guitarPatternPreset || "",
    texture: cloneJson5(metal.texture || {}),
    intensityHints: cloneJson5(metal.intensityHints || {})
  };
}
function createSoundRegistryManifest(project) {
  if (project.meta.audioProfile === "lofi_chill") return { lofi: cloneJson5(POCKET_LOFI_SOUND_REGISTRY) };
  if (project.meta.audioProfile === "chip_arcade" || project.meta.audioProfile === "chip_tune") return { chip: cloneJson5(POCKET_CHIP_SOUND_REGISTRY) };
  if (project.meta.audioProfile === "heavy_metal") return { metal: cloneJson5(POCKET_METAL_SOUND_REGISTRY) };
  if (project.meta.audioProfile === "funk_groove") return { funk: cloneJson5(POCKET_FUNK_SOUND_REGISTRY) };
  if (project.meta.audioProfile === "western_frontier") return { western: cloneJson5(POCKET_WESTERN_SOUND_REGISTRY) };
  return {};
}
function eventOrder(type) {
  return type === "section_start" ? 0 : 1;
}
function roundTime(value) {
  return Math.round(Number(value || 0) * 1e6) / 1e6;
}
function cloneJson5(value) {
  return JSON.parse(JSON.stringify(value));
}

// src/mastering/release-profiles.js
var RELEASE_PROFILES = Object.freeze({
  spotify_lofi_chill: Object.freeze({
    id: "spotify_lofi_chill",
    label: "Spotify Lofi Chill",
    targetIntegratedLufs: -14,
    targetToleranceLu: 0.7,
    truePeakCeilingDbtp: -1,
    louderThanTargetTruePeakCeilingDbtp: -2,
    channels: 2,
    preferredBitDepth: 24,
    preferredFormat: "wav24",
    optionalFormat: "flac",
    sampleRate: 44100,
    albumConsistency: true,
    preserveDynamics: true,
    maxLimiterGainReductionDb: 3,
    dcBlock: true,
    highPassHz: 24,
    warmth: {
      enabled: true,
      drive: 1.08,
      mix: 0.12
    },
    glueCompression: {
      enabled: true,
      thresholdDb: -18,
      ratio: 1.5,
      attackMs: 25,
      releaseMs: 160,
      maxGainReductionDb: 1.5
    },
    limiter: {
      lookaheadMs: 5,
      releaseMs: 80,
      oversample: 4
    },
    mixAssistant: {
      chordGainDb: -0.6,
      chordReason: "Lofi mastering note: chord stem sits a bit forward in the mix; apply a small non-destructive trim before mastering."
    }
  })
});
function getReleaseProfile(id = "spotify_lofi_chill") {
  const profile2 = RELEASE_PROFILES[id];
  if (!profile2) throw new Error(`Unknown release profile: ${id}`);
  return JSON.parse(JSON.stringify(profile2));
}
function dbToGain(db) {
  return Math.pow(10, db / 20);
}
function gainToDb(gain2) {
  if (!Number.isFinite(gain2) || gain2 <= 0) return null;
  return 20 * Math.log10(gain2);
}

// src/mastering/audio-buffer-utils.js
function cloneRenderedBuffer(buffer) {
  return {
    ...buffer,
    channels: (buffer.channels || []).map((channel) => Float32Array.from(channel))
  };
}
function applyGainToBuffer(buffer, gain2) {
  const out = cloneRenderedBuffer(buffer);
  out.channels.forEach((channel) => {
    for (let index = 0; index < channel.length; index += 1) channel[index] *= gain2;
  });
  return out;
}
function sumRenderedBuffers(buffers, { sampleRate = 44100 } = {}) {
  const list = buffers.filter(Boolean);
  const frameCount = Math.max(1, ...list.map((buffer) => buffer.channels?.[0]?.length || 0));
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  list.forEach((buffer) => {
    const channels = buffer.channels || [];
    const sourceLeft = channels[0] || new Float32Array(0);
    const sourceRight = channels[1] || sourceLeft;
    for (let index = 0; index < frameCount; index += 1) {
      left[index] += sourceLeft[index] || 0;
      right[index] += sourceRight[index] || 0;
    }
  });
  return {
    channels: [left, right],
    sampleRate: list[0]?.sampleRate || sampleRate,
    duration: frameCount / (list[0]?.sampleRate || sampleRate),
    eventCount: list.reduce((sum, buffer) => sum + Number(buffer.eventCount || 0), 0)
  };
}
function finiteSampleReport(buffer) {
  let nanSamples = 0;
  let infiniteSamples = 0;
  (buffer.channels || []).forEach((channel) => {
    for (let index = 0; index < channel.length; index += 1) {
      const value = channel[index];
      if (Number.isNaN(value)) nanSamples += 1;
      if (value === Infinity || value === -Infinity) infiniteSamples += 1;
    }
  });
  return {
    nanSamples,
    infiniteSamples,
    nonFiniteSamples: nanSamples + infiniteSamples
  };
}
function sanitizeFileStem(value, fallback = "track") {
  const safe = String(value || fallback).trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return safe || fallback;
}
function round2(value, places = 6) {
  if (value === null || value === void 0 || !Number.isFinite(value)) return value;
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

// src/mastering/master-chain.js
function masterBuffer(input, profile2) {
  const finite = finiteSampleReport(input);
  if (finite.nonFiniteSamples) {
    throw new Error(`Cannot master buffer with non-finite samples: ${finite.nonFiniteSamples}.`);
  }
  const settings = {
    profile: profile2.id,
    chain: [],
    loudnessTrimDb: 0,
    requestedLoudnessTrimDb: 0,
    maxSafeLoudnessTrimDb: 0,
    limiterGainReductionDb: 0,
    loudnessTargetStatus: "not_evaluated",
    loudnessTargetReason: "",
    passes: []
  };
  let buffer = cloneRenderedBuffer(input);
  if (profile2.dcBlock) {
    buffer = dcBlock(buffer);
    settings.chain.push("dc_block");
  }
  if (profile2.highPassHz) {
    buffer = highPass(buffer, profile2.highPassHz);
    settings.chain.push(`high_pass_${profile2.highPassHz}hz`);
  }
  if (profile2.warmth?.enabled) {
    buffer = saturate(buffer, profile2.warmth);
    settings.chain.push("gentle_warmth");
  }
  if (profile2.glueCompression?.enabled) {
    const compressed = glueCompress(buffer, profile2.glueCompression);
    buffer = compressed.buffer;
    settings.chain.push("gentle_glue_compression");
    settings.glueGainReductionDb = round2(compressed.maxGainReductionDb, 3);
  }
  const preLimiter = analyseRenderedBuffer(buffer);
  if (preLimiter.integratedLufs !== null) {
    const plan = planLoudnessTrim(preLimiter, profile2, profile2.maxLimiterGainReductionDb);
    settings.requestedLoudnessTrimDb = round2(plan.requestedTrimDb, 3);
    settings.maxSafeLoudnessTrimDb = round2(plan.maxSafeTrimDb, 3);
    if (Math.abs(plan.trimDb) > 0.01) {
      settings.loudnessTrimDb = round2(settings.loudnessTrimDb + plan.trimDb, 3);
      buffer = gain(buffer, dbToGain(plan.trimDb));
      settings.chain.push("loudness_trim_pass_1");
    }
    settings.passes.push({
      pass: 1,
      requestedTrimDb: round2(plan.requestedTrimDb, 3),
      appliedTrimDb: round2(plan.trimDb, 3),
      maxSafeTrimDb: round2(plan.maxSafeTrimDb, 3),
      dynamicsLimited: plan.dynamicsLimited
    });
  }
  let limited = truePeakLimiter(buffer, profile2);
  buffer = limited.buffer;
  let cumulativeLimiterGainReductionDb = limited.maxGainReductionDb;
  settings.chain.push("true_peak_lookahead_limiter_pass_1");
  let postAnalysis = analyseRenderedBuffer(buffer);
  const remainingLimiterWorkDb = Math.max(0, Number(profile2.maxLimiterGainReductionDb || 0) - cumulativeLimiterGainReductionDb);
  if (postAnalysis.integratedLufs !== null && postAnalysis.integratedLufs < profile2.targetIntegratedLufs - profile2.targetToleranceLu && remainingLimiterWorkDb > 0.05) {
    const plan = planLoudnessTrim(postAnalysis, profile2, remainingLimiterWorkDb);
    const trimDb = Math.min(plan.trimDb, 1.5);
    if (trimDb > 0.01) {
      settings.loudnessTrimDb = round2(settings.loudnessTrimDb + trimDb, 3);
      buffer = gain(buffer, dbToGain(trimDb));
      settings.chain.push("loudness_trim_pass_2");
      settings.passes.push({
        pass: 2,
        requestedTrimDb: round2(plan.requestedTrimDb, 3),
        appliedTrimDb: round2(trimDb, 3),
        maxSafeTrimDb: round2(plan.maxSafeTrimDb, 3),
        dynamicsLimited: plan.dynamicsLimited
      });
      limited = truePeakLimiter(buffer, profile2);
      buffer = limited.buffer;
      cumulativeLimiterGainReductionDb += limited.maxGainReductionDb;
      settings.chain.push("true_peak_lookahead_limiter_pass_2");
      postAnalysis = analyseRenderedBuffer(buffer);
    }
  }
  return {
    buffer,
    settings: finalizeLoudnessStatus(settings, profile2, preLimiter, postAnalysis, cumulativeLimiterGainReductionDb),
    preLimiterAnalysis: preLimiter,
    postAnalysis
  };
}
function gain(buffer, amount) {
  const out = cloneRenderedBuffer(buffer);
  out.channels.forEach((channel) => {
    for (let index = 0; index < channel.length; index += 1) channel[index] *= amount;
  });
  return out;
}
function dcBlock(buffer) {
  const out = cloneRenderedBuffer(buffer);
  out.channels.forEach((channel) => {
    const mean = channel.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) / Math.max(1, channel.length);
    for (let index = 0; index < channel.length; index += 1) channel[index] -= mean;
  });
  return out;
}
function highPass(buffer, hz) {
  const out = cloneRenderedBuffer(buffer);
  const rc = 1 / (2 * Math.PI * hz);
  const dt = 1 / out.sampleRate;
  const alpha = rc / (rc + dt);
  out.channels.forEach((channel) => {
    let previousInput = 0;
    let previousOutput = 0;
    for (let index = 0; index < channel.length; index += 1) {
      const input = channel[index];
      const filtered = alpha * (previousOutput + input - previousInput);
      channel[index] = filtered;
      previousInput = input;
      previousOutput = filtered;
    }
  });
  return out;
}
function saturate(buffer, warmth) {
  const out = cloneRenderedBuffer(buffer);
  const drive = Number(warmth.drive || 1.05);
  const mix = Math.max(0, Math.min(0.3, Number(warmth.mix || 0.1)));
  out.channels.forEach((channel) => {
    for (let index = 0; index < channel.length; index += 1) {
      const dry = channel[index];
      const wet = Math.tanh(dry * drive) / Math.tanh(drive);
      channel[index] = dry * (1 - mix) + wet * mix;
    }
  });
  return out;
}
function glueCompress(buffer, settings) {
  const out = cloneRenderedBuffer(buffer);
  const threshold = dbToGain(settings.thresholdDb ?? -18);
  const ratio = Math.max(1, Number(settings.ratio || 1.5));
  const maxReduction = Math.max(0, Number(settings.maxGainReductionDb || 1.5));
  let maxGainReductionDb = 0;
  out.channels.forEach((channel) => {
    for (let index = 0; index < channel.length; index += 1) {
      const abs = Math.abs(channel[index]);
      if (abs <= threshold) continue;
      const overDb = gainToDb(abs / threshold) || 0;
      const reductionDb = Math.min(maxReduction, overDb - overDb / ratio);
      const g = dbToGain(-reductionDb);
      channel[index] *= g;
      maxGainReductionDb = Math.max(maxGainReductionDb, reductionDb);
    }
  });
  return { buffer: out, maxGainReductionDb };
}
function planLoudnessTrim(analysis, profile2, limiterWorkAvailableDb) {
  const requestedTrimDb = profile2.targetIntegratedLufs - analysis.integratedLufs;
  if (requestedTrimDb <= 0) {
    return {
      requestedTrimDb,
      trimDb: requestedTrimDb,
      maxSafeTrimDb: requestedTrimDb,
      dynamicsLimited: false
    };
  }
  const peak = analysis.truePeakDbtp ?? analysis.samplePeakDbfs ?? -120;
  const truePeakHeadroomDb = profile2.truePeakCeilingDbtp - peak;
  const maxSafeTrimDb = Math.max(0, truePeakHeadroomDb + Math.max(0, limiterWorkAvailableDb) - 0.05);
  const trimDb = Math.min(requestedTrimDb, maxSafeTrimDb);
  return {
    requestedTrimDb,
    trimDb,
    maxSafeTrimDb,
    dynamicsLimited: trimDb + 0.05 < requestedTrimDb
  };
}
function finalizeLoudnessStatus(settings, profile2, preLimiter, postAnalysis, limiterGainReductionDb) {
  settings.limiterGainReductionDb = round2(limiterGainReductionDb, 3);
  const target = profile2.targetIntegratedLufs;
  const tolerance = profile2.targetToleranceLu;
  const postLufs = postAnalysis.integratedLufs;
  if (postLufs === null) {
    settings.loudnessTargetStatus = "unmeasurable";
    settings.loudnessTargetReason = "Integrated loudness could not be measured after mastering.";
    return settings;
  }
  if (Math.abs(postLufs - target) <= tolerance) {
    settings.loudnessTargetStatus = "reached";
    settings.loudnessTargetReason = `Post-master loudness ${round2(postLufs, 2)} LUFS is within ${tolerance} LU of target ${target} LUFS.`;
    return settings;
  }
  if (postLufs < target - tolerance) {
    const requested = settings.requestedLoudnessTrimDb;
    const available = settings.maxSafeLoudnessTrimDb;
    const limit = Number(profile2.maxLimiterGainReductionDb || 0);
    settings.loudnessTargetStatus = "transient-limited";
    settings.loudnessTargetReason = `Post-master loudness ${round2(postLufs, 2)} LUFS remains below target because the requested ${round2(requested, 2)} dB lift exceeds the safe ${round2(available, 2)} dB lift under the ${round2(limit, 2)} dB limiter-reduction cap.`;
    if ((preLimiter.crestFactorDb ?? 0) > 12) {
      settings.loudnessTargetReason += ` Premaster crest factor is ${round2(preLimiter.crestFactorDb, 2)} dB, indicating transient-limited material.`;
    }
    return settings;
  }
  settings.loudnessTargetStatus = "above_target";
  settings.loudnessTargetReason = `Post-master loudness ${round2(postLufs, 2)} LUFS is above target ${target} LUFS; true peak protection remains active.`;
  return settings;
}
function truePeakLimiter(buffer, profileOrCeiling) {
  const ceilingDbtp = typeof profileOrCeiling === "number" ? profileOrCeiling : profileOrCeiling.truePeakCeilingDbtp;
  const limiter = typeof profileOrCeiling === "number" ? {} : profileOrCeiling.limiter || {};
  const out = cloneRenderedBuffer(buffer);
  const ceiling = dbToGain(ceilingDbtp);
  const lookaheadSamples = Math.max(1, Math.round((out.sampleRate || 44100) * Number(limiter.lookaheadMs || 5) / 1e3));
  const releaseSamples = Math.max(1, Math.round((out.sampleRate || 44100) * Number(limiter.releaseMs || 80) / 1e3));
  const frameCount = Math.max(0, ...out.channels.map((channel) => channel.length));
  const framePeaks = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    let peak = 0;
    for (const channel of out.channels) {
      const sample = Number.isFinite(channel[frame]) ? channel[frame] : 0;
      peak = Math.max(peak, Math.abs(sample));
    }
    framePeaks[frame] = peak;
  }
  let maxGainReductionDb = 0;
  let envelopeGain = 1;
  const deque = [];
  let nextFrameToAdd = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const end = Math.min(frameCount, frame + lookaheadSamples);
    while (nextFrameToAdd < end) {
      while (deque.length && framePeaks[deque[deque.length - 1]] <= framePeaks[nextFrameToAdd]) deque.pop();
      deque.push(nextFrameToAdd);
      nextFrameToAdd += 1;
    }
    while (deque.length && deque[0] < frame) deque.shift();
    const futurePeak = deque.length ? framePeaks[deque[0]] : framePeaks[frame];
    const targetGain = futurePeak > ceiling ? ceiling / futurePeak : 1;
    if (targetGain < envelopeGain) {
      envelopeGain = targetGain;
    } else {
      envelopeGain += (1 - envelopeGain) / releaseSamples;
    }
    if (envelopeGain < 1) maxGainReductionDb = Math.max(maxGainReductionDb, Math.abs(gainToDb(envelopeGain) || 0));
    for (const channel of out.channels) {
      if (frame < channel.length) channel[frame] *= envelopeGain;
    }
  }
  const post = analyseRenderedBuffer(out);
  if ((post.truePeakDbtp ?? -120) > ceilingDbtp) {
    const safetyGainDb = ceilingDbtp - post.truePeakDbtp - 0.02;
    const safetyGain = dbToGain(safetyGainDb);
    out.channels.forEach((channel) => {
      for (let index = 0; index < channel.length; index += 1) channel[index] *= safetyGain;
    });
    maxGainReductionDb = Math.max(maxGainReductionDb, Math.abs(safetyGainDb));
  }
  return { buffer: out, maxGainReductionDb };
}

// src/mastering/mix-assistant.js
var STEMS = ["drums", "bass", "chords", "melody", "guitar"];
function analyseStemBuffers(stemBuffers) {
  const out = {};
  for (const stem of STEMS) {
    if (stemBuffers[stem]) out[stem] = analyseRenderedBuffer(stemBuffers[stem]);
  }
  return out;
}
function suggestMixPatch(project, stemAnalysis, profile2, preAnalysis = null) {
  const changes = { masterGainDb: 0, stems: {} };
  const reasons = [];
  const stemLoudness = Object.entries(stemAnalysis).map(([stem, metrics]) => ({
    stem,
    rmsDbfs: metrics.rmsDbfs ?? -120,
    truePeakDbtp: metrics.truePeakDbtp ?? -120,
    crestFactorDb: metrics.crestFactorDb ?? null,
    transientIndexDb: transientIndex(metrics)
  })).sort((a, b) => b.rmsDbfs - a.rmsDbfs);
  const peak = preAnalysis?.truePeakDbtp ?? preAnalysis?.samplePeakDbfs ?? null;
  const blocker = identifyLoudnessBlocker(stemAnalysis, preAnalysis);
  if (peak !== null && peak > -3 && stemLoudness.length) {
    const trim = Math.max(-2, Math.min(-0.5, -0.5 - (peak + 3) * 0.25));
    const target = blocker?.stem || stemLoudness[0].stem;
    changes.stems[target] = { gainDb: round3(trim), pan: 0 };
    reasons.push(`${title(target)} ${blocker ? "transients" : "level"} limit release headroom; ${round3(trim)} dB trim protects the true-peak limiter before final loudness matching.`);
  }
  if (blocker && blocker.transientIndexDb >= 14 && !changes.stems[blocker.stem]) {
    changes.stems[blocker.stem] = { gainDb: -0.8, pan: 0 };
    reasons.push(`${title(blocker.stem)} transient index is ${round3(blocker.transientIndexDb)} dB, so a -0.8 dB trim reduces limiter work without rewriting the source mix.`);
  }
  const bass2 = stemAnalysis.bass;
  const drums = stemAnalysis.drums;
  if (stemAnalysis.chords && Number.isFinite(profile2.mixAssistant?.chordGainDb)) {
    changes.stems.chords = mergeStemChange(changes.stems.chords, { gainDb: profile2.mixAssistant.chordGainDb });
    reasons.push(profile2.mixAssistant.chordReason || `Chord stem is trimmed ${round3(profile2.mixAssistant.chordGainDb)} dB for the selected release profile.`);
  }
  if (bass2 && drums && (bass2.rmsDbfs ?? -120) > (drums.rmsDbfs ?? -120) + 3) {
    changes.stems.bass = mergeStemChange(changes.stems.bass, { gainDb: -1, monoBelowHz: 120 });
    reasons.push("Bass stem is more than 3 dB RMS above drums; trim keeps limiter work conservative.");
  }
  const air = stemAnalysis.drums?.spectralBalance?.air;
  const mid = stemAnalysis.drums?.spectralBalance?.mid;
  if (air !== null && air !== void 0 && mid !== null && mid !== void 0 && air > mid + 3) {
    changes.stems.drums = mergeStemChange(changes.stems.drums, { gainDb: -0.6 });
    reasons.push("Drum air band is bright for the lofi/chill profile; small drum trim avoids harshness.");
  }
  const sustained = chooseSustainedSupportStem(stemAnalysis);
  if (sustained && preAnalysis?.integratedLufs !== null && preAnalysis.integratedLufs < profile2.targetIntegratedLufs - 4 && peak !== null && peak > -4) {
    changes.stems[sustained] = mergeStemChange(changes.stems[sustained], { gainDb: 0.4 });
    reasons.push(`${title(sustained)} is a sustained stem with room for +0.4 dB makeup, supporting loudness before asking the final limiter for more reduction.`);
  }
  if (!reasons.length) reasons.push("No corrective mix trim required; source balance is within conservative release assistant thresholds.");
  return {
    schema: "pocket-mix-patch-v1",
    sourceProjectTitle: project?.meta?.title || project?.title || "Pocket Project",
    profile: profile2.id,
    analysis: {
      blockingStem: blocker?.stem || null,
      blockingReason: blocker?.reason || null,
      transientIndexDb: blocker ? round3(blocker.transientIndexDb) : null,
      loudestStem: stemLoudness[0]?.stem || null
    },
    changes,
    reasons
  };
}
function applyMixPatchToStemBuffers(stemBuffers, patch, options = {}) {
  const buffers = [];
  for (const stem of STEMS) {
    const buffer = stemBuffers[stem];
    if (!buffer) continue;
    const gainDb = Number(patch?.changes?.stems?.[stem]?.gainDb || 0) + Number(patch?.changes?.masterGainDb || 0);
    buffers.push(applyGainToBuffer(buffer, dbToGain(gainDb)));
  }
  return sumRenderedBuffers(buffers, options);
}
function mergeStemChange(current = {}, patch) {
  return {
    ...current,
    ...patch,
    gainDb: round3(Number(current.gainDb || 0) + Number(patch.gainDb || 0))
  };
}
function identifyLoudnessBlocker(stemAnalysis, preAnalysis) {
  const prePeak = preAnalysis?.truePeakDbtp ?? preAnalysis?.samplePeakDbfs ?? -120;
  const candidates = Object.entries(stemAnalysis || {}).map(([stem, metrics]) => ({
    stem,
    truePeakDbtp: metrics.truePeakDbtp ?? -120,
    rmsDbfs: metrics.rmsDbfs ?? -120,
    crestFactorDb: metrics.crestFactorDb ?? 0,
    transientIndexDb: transientIndex(metrics)
  })).filter((item) => item.truePeakDbtp > -30).sort((a, b) => {
    const transientScore = (b.transientIndexDb - a.transientIndexDb) * 0.7;
    const peakScore = (b.truePeakDbtp - a.truePeakDbtp) * 0.3;
    return transientScore + peakScore;
  });
  const candidate = candidates[0];
  if (!candidate) return null;
  const nearMixPeak = prePeak - candidate.truePeakDbtp <= 4;
  const transientRole = candidate.stem === "drums" || candidate.stem === "bass";
  if (candidate.transientIndexDb >= 12 && nearMixPeak || transientRole && candidate.crestFactorDb >= 10) {
    return {
      ...candidate,
      reason: `${candidate.stem} has high transient energy (${round3(candidate.transientIndexDb)} dB index) near the premaster peak.`
    };
  }
  return null;
}
function chooseSustainedSupportStem(stemAnalysis) {
  return ["melody", "guitar"].map((stem) => ({ stem, metrics: stemAnalysis?.[stem] })).filter((item) => item.metrics && (item.metrics.rmsDbfs ?? -120) > -45 && (item.metrics.crestFactorDb ?? 99) < 12).sort((a, b) => (b.metrics.rmsDbfs ?? -120) - (a.metrics.rmsDbfs ?? -120))[0]?.stem || null;
}
function transientIndex(metrics) {
  const truePeak = metrics?.truePeakDbtp ?? metrics?.samplePeakDbfs ?? null;
  const rms = metrics?.rmsDbfs ?? null;
  if (truePeak === null || rms === null) return 0;
  return truePeak - rms;
}
function title(value) {
  return String(value).slice(0, 1).toUpperCase() + String(value).slice(1);
}
function round3(value) {
  return Math.round(value * 1e3) / 1e3;
}

// src/mastering/qc.js
function buildQcReport({ project, profile: profile2, preAnalysis, postAnalysis, stemAnalysis, masterSettings, exportedAnalysis, renderInfo }) {
  const checks = [];
  check(checks, "schema/project validation", Boolean(project?.app === "PocketAudioProject"), "Project normalised as PocketAudioProject.");
  check(checks, "full song sequence renders", Boolean(renderInfo?.scope === "sequence" && renderInfo?.sectionIds?.length), `Rendered sections: ${(renderInfo?.sectionIds || []).join(", ") || "none"}.`);
  check(checks, "stereo output", postAnalysis.channelCount === profile2.channels, `Channels: ${postAnalysis.channelCount}.`);
  check(checks, "no NaN/Infinity samples", postAnalysis.nonFiniteSamples === 0, `Non-finite samples: ${postAnalysis.nonFiniteSamples}.`);
  check(checks, "clipped samples = 0", postAnalysis.clippedSamples === 0, `Clipped samples: ${postAnalysis.clippedSamples}.`);
  check(checks, "true peak ceiling", (postAnalysis.truePeakDbtp ?? 999) <= profile2.truePeakCeilingDbtp + 0.05, `True peak: ${fmt(postAnalysis.truePeakDbtp)} dBTP, ceiling ${profile2.truePeakCeilingDbtp} dBTP.`);
  check(checks, "LUFS target", lufsWithinTolerance(postAnalysis, profile2), lufsMessage(postAnalysis, profile2, masterSettings), "warn");
  check(checks, "no accidental long silence", postAnalysis.silenceAtStartMs < 5e3, `Start silence: ${postAnalysis.silenceAtStartMs} ms.`, "warn");
  check(checks, "tail is not cut", postAnalysis.tailSeconds >= 0.1, `Detected tail: ${postAnalysis.tailSeconds} s.`, "warn");
  check(checks, "stems render if requested", stemAnalysis && Object.keys(stemAnalysis).length > 0, `Stem count: ${Object.keys(stemAnalysis || {}).length}.`);
  check(checks, "limiter gain reduction within profile limit", Number(masterSettings?.limiterGainReductionDb || 0) <= profile2.maxLimiterGainReductionDb + 0.01, `Limiter gain reduction: ${fmt(masterSettings?.limiterGainReductionDb)} dB.`);
  check(checks, "exported WAV re-read/reanalysed", Boolean(renderInfo?.analyzeOnly || exportedAnalysis && exportedAnalysis.channelCount === profile2.channels), exportedAnalysis ? `Exported true peak: ${fmt(exportedAnalysis.truePeakDbtp)} dBTP.` : renderInfo?.analyzeOnly ? "Analyze-only mode skipped WAV export verification." : "No exported analysis.");
  const failures = checks.filter((item) => item.status === "FAIL");
  const warnings = checks.filter((item) => item.status === "WARN");
  return {
    status: failures.length ? "FAIL" : warnings.length ? "WARN" : "PASS",
    checks,
    failures: failures.map((item) => item.message),
    warnings: warnings.map((item) => item.message),
    preAnalysis,
    postAnalysis,
    exportedAnalysis
  };
}
function check(checks, name, pass, message, warnMode = "fail") {
  checks.push({
    name,
    status: pass ? "PASS" : warnMode === "warn" ? "WARN" : "FAIL",
    message
  });
}
function lufsWithinTolerance(analysis, profile2) {
  if (analysis.integratedLufs === null) return false;
  return Math.abs(analysis.integratedLufs - profile2.targetIntegratedLufs) <= profile2.targetToleranceLu;
}
function lufsMessage(analysis, profile2, masterSettings = {}) {
  const base = `Integrated LUFS: ${fmt(analysis.integratedLufs)}, target ${profile2.targetIntegratedLufs} +/- ${profile2.targetToleranceLu}.`;
  if (lufsWithinTolerance(analysis, profile2)) return base;
  if (masterSettings.loudnessTargetStatus === "transient-limited") {
    return `Transient-limited: ${base} ${masterSettings.loudnessTargetReason || "Reaching target would exceed the profile dynamics limit."}`;
  }
  if (masterSettings.loudnessTargetStatus === "above_target") {
    return `Above target: ${base} ${masterSettings.loudnessTargetReason || "Master stayed above target while preserving true-peak safety."}`;
  }
  return `${base} ${masterSettings.loudnessTargetReason || ""}`.trim();
}
function fmt(value) {
  if (value === null || value === void 0) return "n/a";
  return Number.isFinite(value) ? Number(value).toFixed(2) : String(value);
}

// src/mastering/reports.js
function renderMarkdownReport(report) {
  const lines = [];
  lines.push(`# ${report.title} - Master Report`);
  lines.push("");
  lines.push("## Status");
  lines.push(report.qc.status);
  lines.push("");
  lines.push("## Source");
  lines.push(`- Project path: ${report.sourcePath}`);
  lines.push(`- Source hash: ${report.sourceHash}`);
  lines.push(`- Schema version: ${report.schemaVersion}`);
  lines.push(`- Song sequence: ${report.renderInfo.sectionIds.join(", ")}`);
  lines.push(`- Profile: ${report.profile.id}`);
  lines.push("");
  lines.push("## Pre-master analysis");
  metricLines(report.preAnalysis).forEach((line) => lines.push(line));
  lines.push("");
  lines.push("## Stem analysis");
  for (const [stem, metrics] of Object.entries(report.stemAnalysis || {})) {
    lines.push(`- ${stem}: LUFS ${fmt2(metrics.integratedLufs)}, true peak ${fmt2(metrics.truePeakDbtp)} dBTP, RMS ${fmt2(metrics.rmsDbfs)} dBFS`);
  }
  lines.push("");
  lines.push("## Mix patch");
  (report.mixPatch.reasons || []).forEach((reason) => lines.push(`- ${reason}`));
  lines.push("");
  lines.push("## Master settings");
  lines.push(`- Chain: ${(report.masterSettings.chain || []).join(" -> ")}`);
  lines.push(`- Loudness trim: ${fmt2(report.masterSettings.loudnessTrimDb)} dB`);
  lines.push(`- Limiter gain reduction: ${fmt2(report.masterSettings.limiterGainReductionDb)} dB`);
  lines.push("");
  lines.push("## Post-master analysis");
  metricLines(report.postAnalysis).forEach((line) => lines.push(line));
  lines.push("");
  lines.push("## Warnings / failures");
  if (!report.qc.failures.length && !report.qc.warnings.length) lines.push("- None");
  report.qc.failures.forEach((item) => lines.push(`- FAIL: ${item}`));
  report.qc.warnings.forEach((item) => lines.push(`- WARN: ${item}`));
  lines.push("");
  return lines.join("\n");
}
function releaseSummaryCsv(reports) {
  const header = [
    "track_number",
    "title",
    "status",
    "duration_seconds",
    "integrated_lufs",
    "true_peak_dbtp",
    "sample_peak_dbfs",
    "crest_factor_db",
    "clipped_samples",
    "limiter_gain_reduction_db",
    "warnings",
    "master_wav_path",
    "report_path"
  ];
  const rows = reports.map((report, index) => [
    index + 1,
    report.title,
    report.qc.status,
    report.postAnalysis.durationSeconds,
    report.postAnalysis.integratedLufs,
    report.postAnalysis.truePeakDbtp,
    report.postAnalysis.samplePeakDbfs,
    report.postAnalysis.crestFactorDb,
    report.postAnalysis.clippedSamples,
    report.masterSettings.limiterGainReductionDb,
    [...report.qc.failures, ...report.qc.warnings].join(" | "),
    report.outputs.masterWav || "",
    report.outputs.reportMd || ""
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
function metricLines(metrics) {
  return [
    `- LUFS-I: ${fmt2(metrics.integratedLufs)}`,
    `- True peak: ${fmt2(metrics.truePeakDbtp)} dBTP`,
    `- Sample peak: ${fmt2(metrics.samplePeakDbfs)} dBFS`,
    `- RMS: ${fmt2(metrics.rmsDbfs)} dBFS`,
    `- Clipped samples: ${metrics.clippedSamples}`,
    `- Non-finite samples: ${metrics.nonFiniteSamples}`,
    `- DC offset L/R: ${fmt2(metrics.dcOffsetL)} / ${fmt2(metrics.dcOffsetR)}`,
    `- Stereo correlation: ${fmt2(metrics.stereoCorrelation)}`,
    `- Tail/silence: ${fmt2(metrics.tailSeconds)} s / ${fmt2(metrics.silenceAtStartMs)} ms`
  ];
}
function fmt2(value) {
  if (value === null || value === void 0) return "n/a";
  return Number.isFinite(value) ? Number(value).toFixed(2) : String(value);
}
function csvCell(value) {
  const text = value === null || value === void 0 ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

// src/mastering/batch-release.js
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
var OUTPUT_FOLDERS = [
  "masters_wav24",
  "premaster_wav24",
  "stems",
  "reports_json",
  "reports_md",
  "mix-patches",
  "master-settings",
  "source-projects"
];
async function batchMasterRelease(options) {
  const batchOptions = normalizeBatchOptions(options);
  const profile2 = getReleaseProfile(batchOptions.profile || "spotify_lofi_chill");
  const inputPaths = await resolveInputPaths(batchOptions.input || batchOptions.inputs || []);
  if (!inputPaths.length) throw new Error("No input project JSON files matched.");
  const outDir = resolve(batchOptions.out || "local-artifacts/staging/pocket-release");
  await prepareOutput(outDir);
  const reports = [];
  const failures = [];
  for (const [index, sourcePath] of inputPaths.entries()) {
    try {
      const report = await masterReleaseTrack(sourcePath, {
        ...batchOptions,
        index,
        outDir,
        profile: profile2
      });
      reports.push(report);
      if (report.qc.status === "FAIL") failures.push({ path: sourcePath, reasons: report.qc.failures });
    } catch (error) {
      const failed = await writeFailedTrackReport(sourcePath, { index, outDir, profile: profile2, error });
      reports.push(failed);
      failures.push({ path: sourcePath, reasons: [error.message] });
    }
  }
  const albumConsistency = batchOptions.albumConsistency || profile2.albumConsistency ? buildAlbumConsistency(reports, profile2) : null;
  const manifest = {
    schema: "pocket-release-manifest-v1",
    profile: profile2.id,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    inputCount: inputPaths.length,
    analyzeOnly: batchOptions.analyzeOnly,
    exports: Array.from(batchOptions.exportSet),
    albumConsistency,
    status: failures.length ? "FAIL" : reports.some((report) => report.qc.status === "WARN") ? "WARN" : "PASS",
    failures,
    tracks: reports.map((report) => ({
      title: report.title,
      sourcePath: report.sourcePath,
      status: report.qc.status,
      resumed: Boolean(report.resumed),
      outputs: report.outputs,
      warnings: report.qc.warnings,
      failures: report.qc.failures
    }))
  };
  await writeFile(join(outDir, "release-summary.csv"), releaseSummaryCsv(reports));
  await writeFile(join(outDir, "release-manifest.json"), JSON.stringify(manifest, null, 2));
  return { manifest, reports, outDir };
}
async function masterReleaseTrack(sourcePath, options) {
  const sourceText = await readFile(sourcePath, "utf8");
  const sourceHash = hashText(sourceText);
  const raw = JSON.parse(sourceText);
  const project = normalisePocketChordsmithProject(raw, { sourcePrefix: "PCS1" });
  validateNativeSchema(raw);
  const sampleRate = Number(options.sampleRate || options.profile.sampleRate || 44100);
  const title2 = project.meta.title || raw.title || `Track ${options.index + 1}`;
  const slug = `${String(options.index + 1).padStart(2, "0")}-${sanitizeFileStem(title2)}`;
  const outputPaths = trackOutputPaths(options.outDir, slug);
  const resumed = await tryResumeReport(outputPaths.reportJson, {
    force: options.force,
    sourceHash,
    profile: options.profile,
    scope: options.scope || "sequence",
    analyzeOnly: options.analyzeOnly
  });
  if (resumed) return resumed;
  const render = renderPocketAudioBuffer(project, { sampleRate, scope: options.scope || "sequence" });
  const stems = renderPocketAudioStemBuffers(project, { sampleRate, scope: options.scope || "sequence" });
  const preAnalysis = analyseRenderedBuffer(render);
  const stemAnalysis = analyseStemBuffers(stems);
  const mixPatch = suggestMixPatch(project, stemAnalysis, options.profile, preAnalysis);
  const premaster = applyMixPatchToStemBuffers(stems, mixPatch, { sampleRate });
  const mastered = masterBuffer(premaster, options.profile);
  const shouldWriteWav24 = shouldExport(options, "wav24");
  const wav24 = shouldWriteWav24 ? encodePcmWavBytes({ channels: mastered.buffer.channels, sampleRate: mastered.buffer.sampleRate, bitDepth: 24 }) : null;
  const exportedAnalysis = wav24 ? analyseRenderedBuffer(decodePcmWavBytes(wav24)) : null;
  const outputs = await writeTrackOutputs({
    sourcePath,
    sourceText,
    outDir: options.outDir,
    slug,
    outputPaths,
    wav24,
    premaster,
    stems,
    mixPatch,
    masterSettings: mastered.settings,
    exportSet: options.exportSet,
    analyzeOnly: options.analyzeOnly
  });
  const renderInfo = {
    scope: render.timeline?.scope || "sequence",
    sectionIds: render.timeline?.sectionIds || [],
    durationSeconds: render.duration,
    analyzeOnly: Boolean(options.analyzeOnly)
  };
  const qc = buildQcReport({
    project,
    profile: options.profile,
    preAnalysis,
    postAnalysis: mastered.postAnalysis,
    stemAnalysis,
    masterSettings: mastered.settings,
    exportedAnalysis,
    renderInfo
  });
  const report = {
    schema: "pocket-master-report-v1",
    title: title2,
    sourcePath,
    sourceHash,
    analyzeOnly: Boolean(options.analyzeOnly),
    schemaVersion: raw.projectVersion ?? raw.schemaVersion ?? null,
    profile: options.profile,
    renderInfo,
    preAnalysis,
    stemAnalysis,
    mixPatch,
    masterSettings: mastered.settings,
    postAnalysis: mastered.postAnalysis,
    exportedAnalysis,
    qc,
    outputs
  };
  await writeFile(outputs.reportJson, JSON.stringify(report, null, 2));
  await writeFile(outputs.reportMd, renderMarkdownReport(report));
  return report;
}
async function resolveInputPaths(inputs) {
  const list = Array.isArray(inputs) ? inputs : [inputs];
  const resolved = [];
  for (const item of list.flatMap((value) => String(value || "").split(",")).filter(Boolean)) {
    if (item.includes("*")) {
      resolved.push(...await expandSimpleGlob(item));
    } else {
      resolved.push(resolve(item));
    }
  }
  return Array.from(new Set(resolved)).filter((path) => extname(path).toLowerCase() === ".json").sort((a, b) => a.localeCompare(b));
}
async function writeTrackOutputs(input) {
  const outputs = { ...input.outputPaths };
  if (shouldExport(input, "wav24") && input.wav24) {
    await writeFile(outputs.masterWav, input.wav24);
    await writeFile(outputs.premasterWav, encodePcmWavBytes({ channels: input.premaster.channels, sampleRate: input.premaster.sampleRate, bitDepth: 24 }));
  } else {
    delete outputs.masterWav;
    delete outputs.premasterWav;
  }
  await writeFile(outputs.mixPatch, JSON.stringify(input.mixPatch, null, 2));
  await writeFile(outputs.masterSettings, JSON.stringify(input.masterSettings, null, 2));
  await writeFile(outputs.sourceProject, input.sourceText);
  if (shouldExport(input, "stems")) {
    outputs.stemsDir = join(input.outDir, "stems", input.slug);
    for (const [stem, buffer] of Object.entries(input.stems)) {
      const stemPath = join(outputs.stemsDir, `${stem}.wav`);
      await mkdir(dirname(stemPath), { recursive: true });
      await writeFile(stemPath, encodePcmWavBytes({ channels: buffer.channels, sampleRate: buffer.sampleRate, bitDepth: 24 }));
    }
  }
  return outputs;
}
async function writeFailedTrackReport(sourcePath, { index, outDir, profile: profile2, error }) {
  const title2 = `Failed Track ${index + 1}`;
  const slug = `${String(index + 1).padStart(2, "0")}-${sanitizeFileStem(sourcePath, "failed-track")}`;
  const outputs = {
    reportJson: join(outDir, "reports_json", `${slug}.master-report.json`),
    reportMd: join(outDir, "reports_md", `${slug}.master-report.md`),
    sourceProject: join(outDir, "source-projects", `${slug}.source.json`)
  };
  await copyFile(sourcePath, outputs.sourceProject).catch(async () => {
  });
  const report = {
    schema: "pocket-master-report-v1",
    title: title2,
    sourcePath,
    sourceHash: "",
    schemaVersion: null,
    profile: profile2,
    renderInfo: { scope: "sequence", sectionIds: [] },
    preAnalysis: {},
    stemAnalysis: {},
    mixPatch: { schema: "pocket-mix-patch-v1", changes: {}, reasons: [] },
    masterSettings: {},
    postAnalysis: {},
    exportedAnalysis: null,
    outputs,
    qc: {
      status: "FAIL",
      checks: [{ name: "track processing", status: "FAIL", message: error.message }],
      failures: [error.message],
      warnings: []
    }
  };
  await writeFile(outputs.reportJson, JSON.stringify(report, null, 2));
  await writeFile(outputs.reportMd, renderMarkdownReport(report));
  return report;
}
async function prepareOutput(outDir) {
  for (const folder of OUTPUT_FOLDERS) await mkdir(join(outDir, folder), { recursive: true });
}
function normalizeBatchOptions(options) {
  const out = {
    ...options,
    analyzeOnly: Boolean(options.analyzeOnly || options["analyze-only"]),
    albumConsistency: Boolean(options.albumConsistency || options["album-consistency"]),
    force: Boolean(options.force)
  };
  out.exportSet = parseExportSet(out.export || out.exports || "wav24,stems,report");
  if (out.analyzeOnly) {
    out.exportSet.delete("wav24");
    out.exportSet.delete("stems");
    out.exportSet.add("report");
  }
  return out;
}
function parseExportSet(value) {
  const text = Array.isArray(value) ? value.join(",") : String(value || "");
  const set = new Set(text.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
  if (!set.size) set.add("report");
  return set;
}
function shouldExport(options, name) {
  if (options.analyzeOnly && (name === "wav24" || name === "stems")) return false;
  return options.exportSet?.has(name);
}
function trackOutputPaths(outDir, slug) {
  return {
    masterWav: join(outDir, "masters_wav24", `${slug}.wav`),
    premasterWav: join(outDir, "premaster_wav24", `${slug}.premaster.wav`),
    reportJson: join(outDir, "reports_json", `${slug}.master-report.json`),
    reportMd: join(outDir, "reports_md", `${slug}.master-report.md`),
    mixPatch: join(outDir, "mix-patches", `${slug}.mix-patch.json`),
    masterSettings: join(outDir, "master-settings", `${slug}.master-settings.json`),
    sourceProject: join(outDir, "source-projects", `${slug}.source.json`)
  };
}
async function tryResumeReport(reportPath, options) {
  if (options.force) return null;
  try {
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    const sameSource = report.sourceHash === options.sourceHash;
    const sameProfile = report.profile?.id === options.profile.id;
    const sameScope = (report.renderInfo?.scope || "sequence") === options.scope;
    const sameAnalyzeMode = Boolean(report.analyzeOnly) === Boolean(options.analyzeOnly);
    if (sameSource && sameProfile && sameScope && sameAnalyzeMode) {
      return { ...report, resumed: true };
    }
  } catch {
    return null;
  }
  return null;
}
function buildAlbumConsistency(reports, profile2) {
  const loudness = reports.filter((report) => report.qc?.status !== "FAIL" && Number.isFinite(report.postAnalysis?.integratedLufs)).map((report) => ({ title: report.title, integratedLufs: report.postAnalysis.integratedLufs })).sort((a, b) => a.integratedLufs - b.integratedLufs);
  if (!loudness.length) {
    return {
      status: "FAIL",
      trackCount: 0,
      recommendation: "No successfully mastered tracks were available for album consistency analysis."
    };
  }
  const values = loudness.map((item) => item.integratedLufs);
  const min = values[0];
  const max = values[values.length - 1];
  const median = percentile(values, 0.5);
  const spread = max - min;
  const recommended = Math.min(profile2.targetIntegratedLufs, median);
  return {
    status: spread > 2.5 ? "WARN" : "PASS",
    trackCount: loudness.length,
    minIntegratedLufs: round2(min, 2),
    maxIntegratedLufs: round2(max, 2),
    medianIntegratedLufs: round2(median, 2),
    loudnessSpreadLu: round2(spread, 2),
    recommendedTargetIntegratedLufs: round2(recommended, 2),
    recommendation: spread > 2.5 ? `Album loudness varies by ${round2(spread, 2)} LU; consider a common album target around ${round2(recommended, 2)} LUFS rather than forcing every track to ${profile2.targetIntegratedLufs} LUFS.` : `Album loudness spread is ${round2(spread, 2)} LU; current masters are consistent enough for the selected profile.`
  };
}
function percentile(values, amount) {
  if (!values.length) return null;
  const index = (values.length - 1) * amount;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (index - lower);
}
async function expandSimpleGlob(pattern2) {
  const normalized = pattern2.replace(/\\/g, "/");
  const star = normalized.indexOf("*");
  const slash = normalized.lastIndexOf("/", star);
  const dir = resolve(slash >= 0 ? normalized.slice(0, slash) : ".");
  const suffix = normalized.slice(star + 1);
  const prefix = slash >= 0 ? normalized.slice(slash + 1, star) : normalized.slice(0, star);
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry2) => entry2.isFile() && entry2.name.startsWith(prefix) && entry2.name.endsWith(suffix)).map((entry2) => join(dir, entry2.name));
}
function validateNativeSchema(raw) {
  const version = Number(raw.projectVersion ?? raw.schemaVersion);
  if (version !== 16) throw new Error(`Expected native schema-16 project JSON; got schema ${Number.isFinite(version) ? version : "unknown"}.`);
  const sequence = Array.isArray(raw.songSequence) ? raw.songSequence : [];
  if (!sequence.length) throw new Error("Project is missing songSequence; refusing to silently master Section A only.");
}
function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

// src/fx/filter.js
function filterCutoffFromAmount(amount = 1) {
  const safe = Math.max(0, Math.min(1, Number(amount) || 0));
  return 260 + Math.pow(safe, 2.25) * 17700;
}

// src/fx/built-in-fx.js
var POCKET_BUILT_IN_FX = Object.freeze([
  Object.freeze({ type: "utility-gain", name: "Utility Gain", defaultParameters: Object.freeze({ gain: 1 }) }),
  Object.freeze({ type: "high-pass", name: "High Pass", defaultParameters: Object.freeze({ frequency: 80, q: 0.7 }) }),
  Object.freeze({ type: "low-pass", name: "Low Pass", defaultParameters: Object.freeze({ frequency: 12e3, q: 0.7 }) }),
  Object.freeze({ type: "three-band-eq", name: "3-Band EQ", defaultParameters: Object.freeze({ lowGain: 0, midGain: 0, highGain: 0, midFrequency: 1200 }) }),
  Object.freeze({ type: POCKET_PRO_EQ_TYPE, name: "Pocket Pro EQ", defaultParameters: POCKET_PRO_EQ_DEFAULT_PARAMETERS }),
  Object.freeze({ type: "compressor", name: "Compressor", defaultParameters: Object.freeze({ threshold: -20, ratio: 3, attack: 6e-3, release: 0.16 }) }),
  Object.freeze({ type: "limiter", name: "Limiter", defaultParameters: Object.freeze({ threshold: -4, ratio: 18, attack: 2e-3, release: 0.08 }) }),
  Object.freeze({ type: "noise-gate", name: "Noise Gate", defaultParameters: Object.freeze({ threshold: -48, reduction: 0.18 }) }),
  Object.freeze({ type: "saturation", name: "Saturation", defaultParameters: Object.freeze({ drive: 1.8, mix: 0.65 }) }),
  Object.freeze({ type: "bitcrusher", name: "Bitcrusher", defaultParameters: Object.freeze({ bits: 8, mix: 0.45 }) }),
  Object.freeze({ type: "delay", name: "Delay", defaultParameters: Object.freeze({ time: 0.22, feedback: 0.28, mix: 0.32 }) }),
  Object.freeze({ type: "ping-pong-delay", name: "Ping-Pong Delay", defaultParameters: Object.freeze({ time: 0.28, feedback: 0.34, mix: 0.28 }) }),
  Object.freeze({ type: "reverb", name: "Reverb", defaultParameters: Object.freeze({ decay: 1.8, mix: 0.24 }) }),
  Object.freeze({ type: "chorus", name: "Chorus", defaultParameters: Object.freeze({ rate: 0.8, depth: 0.012, mix: 0.35 }) }),
  Object.freeze({ type: "phaser", name: "Phaser", defaultParameters: Object.freeze({ rate: 0.45, depth: 650, mix: 0.32 }) }),
  Object.freeze({ type: "tremolo-autopan", name: "Tremolo / AutoPan", defaultParameters: Object.freeze({ rate: 4, depth: 0.38 }) })
]);
var POCKET_BUILT_IN_FX_TYPES = Object.freeze(POCKET_BUILT_IN_FX.map((fx) => fx.type));
function findPocketBuiltInFx(type) {
  return POCKET_BUILT_IN_FX.find((fx) => fx.type === type) || null;
}

// src/fx/delay.js
function delaySettings(amount = 0) {
  const safe = Math.max(0, Math.min(1, Number(amount) || 0));
  return { delayTime: 0.12 + safe * 0.34, feedback: 0.08 + safe * 0.58, wet: safe * 0.55 };
}

// src/fx/reverb.js
function reverbSettings(amount = 0) {
  const safe = Math.max(0, Math.min(1, Number(amount) || 0));
  return { wet: safe * 0.62 };
}

// src/fx/sidechain.js
var CHORDSMITH_SIDECHAIN_ATTACK_SECONDS = 0.012;
var CHORDSMITH_SIDECHAIN_RELEASE_SECONDS = 0.22;
var CHORDSMITH_SIDECHAIN_DEPTH = 0.72;
var CHORDSMITH_SIDECHAIN_FLOOR = 0.18;
function chordsmithSidechainDuckGain(amount = 0.45, base = 1) {
  const safe = Math.max(0, Math.min(1, Number(amount) || 0));
  const safeBase = Math.max(1e-4, Number(base) || 1);
  return Math.max(CHORDSMITH_SIDECHAIN_FLOOR, safeBase * (1 - safe * CHORDSMITH_SIDECHAIN_DEPTH));
}
function sidechainDuckCurve({ amount = 0.45, start = 0, duration = CHORDSMITH_SIDECHAIN_RELEASE_SECONDS } = {}) {
  const attack = Math.min(CHORDSMITH_SIDECHAIN_ATTACK_SECONDS, Math.max(1e-3, duration));
  const end = Math.max(start + attack, start + duration);
  return [
    { time: start, gain: 1 },
    { time: start + attack, gain: chordsmithSidechainDuckGain(amount, 1) },
    { time: end, gain: 1 }
  ];
}
function sidechainDuckGainAt({ amount = 0.45, triggerTime = 0, time = 0 } = {}) {
  const safeTime = Number(time);
  const safeTriggerTime = Number(triggerTime);
  const elapsed = safeTime - safeTriggerTime;
  const releaseEnd = safeTriggerTime + CHORDSMITH_SIDECHAIN_RELEASE_SECONDS;
  if (!Number.isFinite(elapsed) || elapsed < 0 || safeTime >= releaseEnd) return 1;
  const duck = chordsmithSidechainDuckGain(amount, 1);
  if (elapsed <= CHORDSMITH_SIDECHAIN_ATTACK_SECONDS) {
    return 1 + (duck - 1) * (elapsed / CHORDSMITH_SIDECHAIN_ATTACK_SECONDS);
  }
  const releaseProgress = (elapsed - CHORDSMITH_SIDECHAIN_ATTACK_SECONDS) / (CHORDSMITH_SIDECHAIN_RELEASE_SECONDS - CHORDSMITH_SIDECHAIN_ATTACK_SECONDS);
  return duck * Math.pow(1 / duck, Math.max(0, Math.min(1, releaseProgress)));
}

// src/synth/drums.js
function scheduleDrumEvent(event2) {
  return { ...event2, scheduledBy: "pocket-audio-core/drums" };
}

// src/synth/bass.js
function scheduleBassEvent(event2) {
  return { ...event2, scheduledBy: "pocket-audio-core/bass" };
}

// src/synth/chords.js
function scheduleChordEvent(event2) {
  return { ...event2, scheduledBy: "pocket-audio-core/chords" };
}

// src/synth/melody.js
function scheduleMelodyEvent(event2) {
  return { ...event2, scheduledBy: "pocket-audio-core/melody" };
}

// src/synth/guitar.js
function scheduleGuitarEvent(event2) {
  return { ...event2, scheduledBy: "pocket-audio-core/guitar" };
}
export {
  CHIP_AUDIO_PROFILE_ID,
  CHIP_BASS_TONES,
  CHIP_BASS_TONE_CONFIGS,
  CHIP_CHORD_INSTRUMENTS,
  CHIP_CHORD_INSTRUMENT_CONFIGS,
  CHIP_DRUM_GROOVE_PRESETS,
  CHIP_DRUM_KITS,
  CHIP_DRUM_KIT_CONFIGS,
  CHIP_LEAD_INSTRUMENT_CONFIGS,
  CHIP_MELODY_INSTRUMENTS,
  CHIP_STYLE_PRESETS,
  CHIP_STYLE_PRESET_IDS,
  CHORDSMITH_CHORD_PLAY_MODES,
  CHORDSMITH_CHORD_RHYTHM,
  CHORDSMITH_CHORD_RHYTHM_MODES,
  CHORDSMITH_DRUM_FEEL,
  CHORDSMITH_FX_GRAPH,
  CHORDSMITH_GUITAR_GATE_SECONDS,
  CHORDSMITH_HUMANIZE_PEAK_BASE,
  CHORDSMITH_HUMANIZE_PEAK_RANGE,
  CHORDSMITH_HUMANIZE_TIMING_SECONDS,
  CHORDSMITH_HUMANIZE_VELOCITY_BASE,
  CHORDSMITH_HUMANIZE_VELOCITY_RANGE,
  CHORDSMITH_LIVE_DRUM_VOICES,
  CHORDSMITH_LOFI_TEXTURE_LIVE,
  CHORDSMITH_LOFI_TEXTURE_OFFLINE,
  CHORDSMITH_OFFLINE_RENDER_HEADROOM,
  CHORDSMITH_OFFLINE_STEM_GAIN,
  CHORDSMITH_PHRASE_GATES,
  CHORDSMITH_PITCHED_TUPLET,
  CHORDSMITH_SEQUENCED_DRUM_LANE_IDS,
  CHORDSMITH_SIDECHAIN_ATTACK_SECONDS,
  CHORDSMITH_SIDECHAIN_DEPTH,
  CHORDSMITH_SIDECHAIN_FLOOR,
  CHORDSMITH_SIDECHAIN_RELEASE_SECONDS,
  CLASSIC_BASS_TONE_CONFIG,
  CLASSIC_CHORD_INSTRUMENT_CONFIGS,
  CLASSIC_DRUM_KIT_CONFIG,
  CLASSIC_LEAD_INSTRUMENT_CONFIGS,
  CORE_PROJECT_VERSION,
  DEFAULT_BPM,
  DEFAULT_CHIP_DRUM_KIT,
  DEFAULT_CHIP_PRESET_ID,
  DEFAULT_CHIP_TEXTURE,
  DEFAULT_CHORD_INSTRUMENT,
  DEFAULT_CLASSIC_BASS_TONE,
  DEFAULT_CLASSIC_DRUM_KIT,
  DEFAULT_FUNK_PARAMETERS,
  DEFAULT_FUNK_PRESET_ID,
  DEFAULT_FX,
  DEFAULT_GUITAR_REGISTER,
  DEFAULT_GUITAR_STRUM_MODE,
  DEFAULT_GUITAR_TONE,
  DEFAULT_LOFI_DRUM_KIT,
  DEFAULT_LOFI_PRESET_ID,
  DEFAULT_LOFI_TEXTURE,
  DEFAULT_MASTER_VOLUME,
  DEFAULT_MELODY_INSTRUMENT,
  DEFAULT_METAL_DRUM_KIT,
  DEFAULT_METAL_PRESET_ID,
  DEFAULT_METAL_TEXTURE,
  DEFAULT_PPQ,
  DEFAULT_RESOLUTION,
  DEFAULT_SOURCE_SCHEMA_VERSION,
  DEFAULT_STEM_MIX,
  DEFAULT_TIME_SIG,
  DEFAULT_WESTERN_PARAMETERS,
  DEFAULT_WESTERN_PRESET_ID,
  DRUM_LANES,
  DRUM_PATTERN_DEFS,
  DRUM_PRESETS,
  FUNK_AUDIO_PROFILE_ID,
  FUNK_BASS_PATTERN_GRAMMAR,
  FUNK_BASS_TONES,
  FUNK_BASS_TONE_CONFIGS,
  FUNK_CHORD_INSTRUMENTS,
  FUNK_CHORD_INSTRUMENT_CONFIGS,
  FUNK_DRUM_GROOVE_PRESETS,
  FUNK_DRUM_KITS,
  FUNK_DRUM_KIT_CONFIGS,
  FUNK_DRUM_PATTERN_GRAMMAR,
  FUNK_LEAD_INSTRUMENT_CONFIGS,
  FUNK_LEAD_PATTERN_GRAMMAR,
  FUNK_MELODY_INSTRUMENTS,
  FUNK_STAB_PATTERN_GRAMMAR,
  FUNK_STYLE_PRESETS,
  FUNK_STYLE_PRESET_IDS,
  GAME_PACK_FOLDERS,
  GAME_PACK_MANIFEST_FILES,
  GODOT_EXPORT_PROFILES,
  GUITAR_PRESETS,
  GameStateController,
  HEAVY_METAL_AUDIO_PROFILE_ID,
  LEGACY_CHIP_AUDIO_PROFILE_IDS,
  LOFI_AUDIO_PROFILE_ID,
  LOFI_BASS_TONES,
  LOFI_BASS_TONE_CONFIGS,
  LOFI_CHORD_INSTRUMENTS,
  LOFI_CHORD_INSTRUMENT_CONFIGS,
  LOFI_DRUM_GROOVE_PRESETS,
  LOFI_DRUM_KITS,
  LOFI_DRUM_KIT_CONFIGS,
  LOFI_LEAD_INSTRUMENT_CONFIGS,
  LOFI_MELODY_INSTRUMENTS,
  LOFI_STYLE_PRESETS,
  LOFI_STYLE_PRESET_IDS,
  MAX_SEQUENCE_SLOTS,
  METAL_BASS_TONES,
  METAL_BASS_TONE_CONFIGS,
  METAL_CHORD_INSTRUMENTS,
  METAL_CHORD_INSTRUMENT_CONFIGS,
  METAL_DRUM_GROOVE_PRESETS,
  METAL_DRUM_KITS,
  METAL_DRUM_KIT_CONFIGS,
  METAL_DRUM_PATTERN_GRAMMAR,
  METAL_LEAD_INSTRUMENT_CONFIGS,
  METAL_MELODY_INSTRUMENTS,
  METAL_RIFF_GRAMMAR,
  METAL_STYLE_PRESETS,
  METAL_STYLE_PRESET_IDS,
  NOTES,
  PCS_SHARE_PREFIX,
  POCKET_AUDIO_ARTICULATION_ALIASES,
  POCKET_AUDIO_ARTICULATION_IDS,
  POCKET_AUDIO_COMMON_ARTICULATIONS,
  POCKET_AUDIO_COMMON_DRUM_LANES,
  POCKET_AUDIO_COMMON_DRUM_LANE_IDS,
  POCKET_AUDIO_CORE_VERSION,
  POCKET_AUDIO_DRUM_LANE_ALIASES,
  POCKET_AUDIO_FORMAT_FEATURES,
  POCKET_AUDIO_PROFILES,
  POCKET_AUDIO_PROFILE_ALIASES,
  POCKET_AUDIO_PROFILE_IDS,
  POCKET_AUDIO_RENDERER_CAPABILITIES,
  POCKET_AUDIO_RESOURCE_LIMITS,
  POCKET_BASS_TONE_CONFIGS,
  POCKET_BUILT_IN_FX,
  POCKET_BUILT_IN_FX_TYPES,
  POCKET_CHIP_SOUND_REGISTRY,
  POCKET_CHORD_INSTRUMENTS,
  POCKET_CHORD_INSTRUMENT_CONFIGS,
  POCKET_DRUM_KIT_CONFIGS,
  POCKET_DRUM_LANES,
  POCKET_DRUM_LANE_IDS,
  POCKET_FUNK_SOUND_REGISTRY,
  POCKET_GUITAR_ARTICULATIONS,
  POCKET_GUITAR_FILL_STYLES,
  POCKET_GUITAR_PATTERN_PRESETS,
  POCKET_GUITAR_REGISTERS,
  POCKET_GUITAR_STEP_CYCLE,
  POCKET_GUITAR_STRUM_MODES,
  POCKET_GUITAR_TONES,
  POCKET_GUITAR_TONE_CONFIGS,
  POCKET_LEAD_INSTRUMENT_CONFIGS,
  POCKET_LOFI_SOUND_REGISTRY,
  POCKET_MELODY_INSTRUMENTS,
  POCKET_METAL_SOUND_REGISTRY,
  POCKET_PRO_EQ_BANDS,
  POCKET_PRO_EQ_DEFAULT_PARAMETERS,
  POCKET_PRO_EQ_PRESETS,
  POCKET_PRO_EQ_TYPE,
  POCKET_SOUND_REGISTRY,
  POCKET_WESTERN_SOUND_REGISTRY,
  PocketAudio,
  PocketScheduler,
  RELEASE_PROFILES,
  RICH_EVENT_SCHEMA_VERSION,
  SECTION_IDS,
  STEM_IDS,
  VoiceManager,
  WESTERN_AUDIO_PROFILE_ID,
  WESTERN_BASS_TONES,
  WESTERN_BASS_TONE_CONFIGS,
  WESTERN_CHORD_INSTRUMENTS,
  WESTERN_CHORD_INSTRUMENT_CONFIGS,
  WESTERN_DRUM_KITS,
  WESTERN_DRUM_KIT_CONFIGS,
  WESTERN_GROOVE_PRESETS,
  WESTERN_LEAD_INSTRUMENT_CONFIGS,
  WESTERN_MELODY_INSTRUMENTS,
  WESTERN_PATTERN_GRAMMAR,
  WESTERN_STYLE_PRESETS,
  WESTERN_STYLE_PRESET_IDS,
  analyseAudioChannels,
  analyseRenderedBuffer,
  analyseStemBuffers,
  applyMixPatchToStemBuffers,
  assertPocketAudioProjectResourceLimits,
  base64UrlToUtf8,
  batchMasterRelease,
  beatDurationSeconds,
  buildFunkPatternEvents,
  buildMetalPatternEvents,
  buildPocketAudioTimeline,
  buildPocketChordsmithShareCode,
  buildQcReport,
  buildSectionEvents,
  buildStepTimeline,
  buildWesternPatternEvents,
  chordIntervals,
  chordMidiNotes2 as chordMidiNotes,
  chordQuality,
  chordsmithAutoBassMidi,
  chordsmithBassIndexToMidi,
  chordsmithChordForStep,
  chordsmithChordIntervals,
  chordsmithChordMidiNotes,
  chordsmithChordQuality,
  chordsmithChordRhythmStarts,
  chordsmithDawSynthFxSlots,
  chordsmithDrumPeak,
  chordsmithDrumStepDuration,
  chordsmithDrumTupletDuration,
  chordsmithFeatureSeed,
  chordsmithFxParameters,
  chordsmithGuitarStepDuration,
  chordsmithHumanizeOffset,
  chordsmithHumanizePeak,
  chordsmithHumanizeVelocity,
  chordsmithLiveDrumPadPeak,
  chordsmithLofiTextureLiveCrackleFrequency,
  chordsmithLofiTextureLiveCrackleShouldTrigger,
  chordsmithLofiTextureLiveHissLowpass,
  chordsmithLofiTextureOfflineCrackleWindow,
  chordsmithLofiTextureOfflineSample,
  chordsmithMelodyIndexToMidi,
  chordsmithNoteIndex,
  chordsmithOfflineStemOutputGain,
  chordsmithOfflineStemRenderGain,
  chordsmithPhraseDuration,
  chordsmithPhraseInfo,
  chordsmithPitchedTupletDuration,
  chordsmithPitchedTupletMiddleIndex,
  chordsmithPitchedTupletMiddleMidi,
  chordsmithPowerChordNotes,
  chordsmithScalePitchClasses,
  chordsmithSidechainDuckGain,
  chordsmithStableNoiseSample,
  createAudioContext,
  createGodotExportKit,
  createGodotManifest,
  createMixerState,
  createPocketAudioRendererCapabilityReport,
  createSilentWavBlob,
  dbToGain,
  decodePcmWavBytes,
  defaultPocketProEqParameters,
  delaySettings,
  detectPocketChordsmithSchema,
  drumPresetEventsForProject,
  drumPresetLabel,
  drumPresetVisibleForProject,
  encodePcm16WavBlob,
  encodePcm16WavBytes,
  encodePcm24WavBlob,
  encodePcm24WavBytes,
  encodePcmWavBlob,
  encodePcmWavBytes,
  filterCutoffFromAmount,
  findDrumPreset,
  findGuitarPreset,
  findPocketAudioProfile,
  findPocketBuiltInFx,
  findPocketChordInstrumentConfig,
  findPocketDrumLane,
  findPocketGuitarTone,
  findPocketLeadInstrumentConfig,
  gainToDb,
  gamePackFullMixPath,
  gamePackManifestPath,
  gamePackPath,
  gamePackSectionLoopPath,
  gamePackSourceProjectPath,
  gamePackStemPath,
  getChipStylePreset,
  getFunkStylePreset,
  getLofiStylePreset,
  getMetalStylePreset,
  getPocketAudioRendererCapabilities,
  getPocketProEqPreset,
  getReleaseProfile,
  getWesternStylePreset,
  guitarPatternPresetIds,
  guitarPresetLabel,
  guitarPresetPatternForProject,
  guitarPresetVisibleForProject,
  isChipProfile,
  isLofiProfile,
  isMetalProfile,
  isPocketAudioCommonArticulation,
  isPocketChipActive,
  isPocketLofiActive,
  isPocketMetalActive,
  masterBuffer,
  masterReleaseTrack,
  migratePocketChordsmithProject,
  negotiatePocketAudioRendererCapabilities,
  normaliseChipProjectSettings,
  normaliseChipTexture,
  normaliseFunkParameters,
  normaliseFunkProjectSettings,
  normaliseLofiProjectSettings,
  normaliseLofiTexture,
  normaliseMetalProjectSettings,
  normaliseMetalTexture,
  normalisePocketAudioArticulation,
  normalisePocketAudioDrumLane,
  normalisePocketAudioExpression,
  normalisePocketAudioProfileId,
  normalisePocketAudioRole,
  normalisePocketAudioSoundProfile,
  normalisePocketAudioTechnique,
  normalisePocketChordsmithProject,
  normaliseWesternProjectSettings,
  normalizeGuitarArticulation,
  noteIndex,
  parsePocketChordsmithInput,
  parsePocketChordsmithShareCode,
  pocketAudioDrumLaneFallback,
  pocketLeadExtraLayers,
  pocketProEqPresetParameters,
  pos16ToStep,
  releaseSummaryCsv,
  renderMarkdownReport,
  renderPocketAudioBuffer,
  renderPocketAudioEventBuffer,
  renderPocketAudioStemBuffers,
  renderPocketAudioStems,
  renderPocketAudioWav,
  renderStemPlaceholders,
  renderWav,
  resolveInputPaths,
  resolvePocketBassToneId,
  resolvePocketDrumKitId,
  restorePocketChordsmithSource,
  resumeAudioContext,
  reverbSettings,
  safeGamePackName,
  scaleDegreeToMidi,
  scalePitchClasses,
  scheduleBassEvent,
  scheduleChordEvent,
  scheduleDrumEvent,
  scheduleGuitarEvent,
  scheduleMelodyEvent,
  setStemValue,
  shouldUsePresetEvent,
  sidechainDuckCurve,
  sidechainDuckGainAt,
  spanDurationSeconds,
  stepDurationSeconds,
  stepsPerBar,
  suggestMixPatch,
  tripletTimesForSpan,
  utf8ToBase64Url,
  validateChipSoundRegistry,
  validateFunkSoundRegistry,
  validateLofiSoundRegistry,
  validateMetalSoundRegistry,
  validatePocketAudioProfileRegistry,
  validatePocketGuitarRegistry,
  validatePocketInstrumentRegistry,
  validatePocketSoundRegistry,
  validateWesternSoundRegistry,
  visibleDrumPresetsForProject,
  visibleGuitarPresetsForProject
};

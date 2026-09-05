const PROFILE_DEFINITIONS = Object.freeze({
  high: Object.freeze({
    key: 'high',
    moonShadowType: 'cascaded',
    moonShadowMapSize: 2048,
    moonShadowCascades: 3,
    wardenShadowMapSize: 1024,
    fireLightCount: 2,
    emberCount: 28,
    maxMaterialLights: 5,
  }),
  mobileHigh: Object.freeze({
    key: 'mobile-high',
    moonShadowType: 'none',
    moonShadowMapSize: 0,
    moonShadowCascades: 0,
    wardenShadowMapSize: 0,
    fireLightCount: 2,
    emberCount: 14,
    maxMaterialLights: 5,
  }),
  mobileBalanced: Object.freeze({
    key: 'mobile-balanced',
    moonShadowType: 'none',
    moonShadowMapSize: 0,
    moonShadowCascades: 0,
    wardenShadowMapSize: 0,
    fireLightCount: 1,
    emberCount: 8,
    maxMaterialLights: 4,
  }),
  mobilePerformance: Object.freeze({
    key: 'mobile-performance',
    moonShadowType: 'none',
    moonShadowMapSize: 0,
    moonShadowCascades: 0,
    wardenShadowMapSize: 0,
    fireLightCount: 1,
    emberCount: 0,
    maxMaterialLights: 4,
  }),
  balanced: Object.freeze({
    key: 'balanced',
    moonShadowType: 'cascaded',
    moonShadowMapSize: 1024,
    moonShadowCascades: 2,
    wardenShadowMapSize: 512,
    fireLightCount: 2,
    emberCount: 14,
    maxMaterialLights: 5,
  }),
  performance: Object.freeze({
    key: 'performance',
    moonShadowType: 'standard',
    moonShadowMapSize: 512,
    moonShadowCascades: 1,
    wardenShadowMapSize: 0,
    fireLightCount: 1,
    emberCount: 0,
    maxMaterialLights: 4,
  }),
});

const PRESENTATION_LIGHTING_PROFILES = Object.freeze({
  day: Object.freeze({
    key: 'day', shadowEnabled: true, fogDensity: 0.0032, fogColor: '#708b82', skyColor: '#86a9aa',
    hemiIntensity: 1.08, moonIntensity: 0.12, sunIntensity: 1.38, torchProminence: 0,
    minimumMaterialAmbient: 0.58,
  }),
  dayShadowless: Object.freeze({
    key: 'day-shadowless', shadowEnabled: false, fogDensity: 0.0032, fogColor: '#708b82', skyColor: '#86a9aa',
    hemiIntensity: 1.16, moonIntensity: 0.1, sunIntensity: 1.2, torchProminence: 0,
    minimumMaterialAmbient: 0.66,
  }),
  night: Object.freeze({
    key: 'night', shadowEnabled: true, fogDensity: 0.0051, fogColor: '#1b3038', skyColor: '#08141c',
    hemiIntensity: 0.7, moonIntensity: 1.82, sunIntensity: 0, torchProminence: 1,
    minimumMaterialAmbient: 0.38,
  }),
  nightShadowless: Object.freeze({
    key: 'night-shadowless', shadowEnabled: false, fogDensity: 0.0051, fogColor: '#263c44', skyColor: '#0c1b23',
    hemiIntensity: 0.82, moonIntensity: 1.42, sunIntensity: 0, torchProminence: 0.92,
    minimumMaterialAmbient: 0.48,
  }),
});

/** Select one preallocated profile at a controlled day/night boundary. */
export function lightingPresentationProfile(profileId = 'night', {shadowsEnabled = true} = {}) {
  const day = profileId === 'day';
  if (day) return shadowsEnabled === false
    ? PRESENTATION_LIGHTING_PROFILES.dayShadowless
    : PRESENTATION_LIGHTING_PROFILES.day;
  return shadowsEnabled === false
    ? PRESENTATION_LIGHTING_PROFILES.nightShadowless
    : PRESENTATION_LIGHTING_PROFILES.night;
}

export const LIGHTING_PRESENTATION_PROFILES = PRESENTATION_LIGHTING_PROFILES;

/** Runtime sky and celestial-light state derived from the phase profile. */
export function worldCelestialPresentation(profile) {
  const daytime = String(profile?.key ?? '').startsWith('day');
  return Object.freeze({
    moonVisible: !daytime,
    stormTextureVisible: !daytime,
    keyLightIntensity: daytime ? Number(profile?.sunIntensity ?? 0) : Number(profile?.moonIntensity ?? 0),
    keyLightColor: daytime ? '#fff0c6' : '#bad8ee',
    fillLightColor: daytime ? '#aabdb4' : '#9db9d0',
    groundLightColor: daytime ? '#20251d' : '#141d21',
    skyEmissiveColor: daytime ? '#8fb9c0' : '#99b6c3',
    skyEmissiveLuminance: daytime ? 0.82 : 0.28,
  });
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function lightingProfileForQuality(value, {coarse = false, software = false} = {}) {
  const quality = String(value || 'auto').toLowerCase();
  if (quality === 'high') return coarse ? PROFILE_DEFINITIONS.mobileHigh : PROFILE_DEFINITIONS.high;
  if (quality === 'performance') return coarse ? PROFILE_DEFINITIONS.mobilePerformance : PROFILE_DEFINITIONS.performance;
  if (quality === 'balanced') return coarse ? PROFILE_DEFINITIONS.mobileBalanced : PROFILE_DEFINITIONS.balanced;
  if (coarse) return PROFILE_DEFINITIONS.mobilePerformance;
  return software ? PROFILE_DEFINITIONS.performance : PROFILE_DEFINITIONS.balanced;
}

/**
 * Smooth deterministic flame motion. Each flame uses a stable phase so the
 * whole fortress never pulses in lockstep and the animation is replayable.
 */
export function sampleFlameFlicker(timeSeconds, index = 0, {reducedMotion = false, target = null} = {}) {
  const time = finite(timeSeconds);
  const phase = finite(index) * 2.399963229728653;
  const low = Math.sin(time * 5.7 + phase);
  const middle = Math.sin(time * 9.1 + phase * 0.61);
  const high = Math.sin(time * 14.3 + phase * 1.37);
  const energy = clamp(0.9 + low * 0.07 + middle * 0.035 + high * 0.018, 0.76, 1.08);
  const motionScale = reducedMotion ? 0.24 : 1;
  const sample = target ?? {};
  sample.brightness = energy;
  sample.stretchX = 1 + middle * 0.035 * motionScale;
  sample.stretchY = 1 + (low * 0.075 + high * 0.022) * motionScale;
  sample.lift = (middle * 0.025 + high * 0.012) * motionScale;
  sample.sway = (low * 0.05 + middle * 0.022) * motionScale;
  sample.warmth = clamp(0.5 + middle * 0.22 + high * 0.08, 0, 1);
  return sample;
}

/**
 * Select a bounded set of nearby/forward fire sources. Existing assignments
 * receive hysteresis so a light does not pop between equally close sconces.
 */
export function selectFireLightSources(
  sources,
  position,
  forward,
  previousIds = [],
  count = 1,
) {
  const requested = Math.max(0, Math.floor(finite(count)));
  if (!Array.isArray(sources) || requested === 0) return Object.freeze([]);
  const px = finite(position?.x);
  const py = finite(position?.y);
  const pz = finite(position?.z);
  const fx = finite(forward?.x);
  const fz = finite(forward?.z, 1);
  const forwardLength = Math.hypot(fx, fz) || 1;
  const previous = new Set(previousIds || []);
  const ranked = sources.filter(source => source?.visible !== false).map((source, order) => {
    const dx = finite(source?.x) - px;
    const dy = finite(source?.y) - py;
    const dz = finite(source?.z) - pz;
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    const horizontalLength = Math.hypot(dx, dz) || 1;
    const facing = (dx * fx + dz * fz) / (horizontalLength * forwardLength);
    const behindPenalty = facing < -0.2 ? 180 : facing < 0.2 ? 45 : 0;
    const hysteresis = previous.has(source?.id) ? -120 : 0;
    return {source, order, score: distanceSquared + behindPenalty + hysteresis};
  });
  ranked.sort((left, right) => (
    left.score - right.score
    || String(left.source?.id).localeCompare(String(right.source?.id))
    || left.order - right.order
  ));
  return Object.freeze(ranked.slice(0, requested).map(({source}) => source));
}

export const LIGHTING_PROFILES = PROFILE_DEFINITIONS;

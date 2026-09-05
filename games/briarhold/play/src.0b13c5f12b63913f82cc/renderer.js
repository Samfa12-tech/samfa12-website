import {
  atlasStateProjectionScale,
  buildAtlasFrameMetadata,
  buildGpuAtlasSpriteShaderSources,
  createGpuAtlasSpriteBuffers,
  ENEMY_ATTACK_ANIMATION_SECONDS,
  ENEMY_HIT_ANIMATION_SECONDS,
  GROUNDED_ENEMY_MOTION,
  attackReadabilityForPresentation,
  proceduralAttackPresentation,
  writeGpuAtlasSpriteAction,
  writeGpuAtlasSpriteFeedback,
  writeGpuAtlasSpriteMovement,
  writeGpuAtlasSpriteTraits
} from './core/gpu-atlas-sprite-state.js';
import { stableDepthBias } from './core/stable-atlas-slots.js';
import {
  ENGAGEMENT_GATE_ATTACK,
  ENGAGEMENT_GATE_QUEUE,
  ENGAGEMENT_HUNTER,
  ENGAGEMENT_MARCHING,
  ENGAGEMENT_PLAYER_ATTACK,
  ENGAGEMENT_RESERVE,
} from './battlefield.js';
import { HOST_KILLZONE_LIGHT_GRADE, WORLD_ATMOSPHERE } from './world.js';
import {createAnimatedEnemyRenderer} from './animated-enemy-renderer.js';
import {sporewingFlightOffsetAtGate} from './enemy-presentation.js';

const OFFSCREEN = 100000;

export const RENDERER_LOCOMOTION_HYSTERESIS = Object.freeze({
  settleSeconds: 0.75,
  settleDistance: 0.2,
  releaseSeconds: 0.25,
  releaseDistance: 0.35,
});

/**
 * Renderer-only net-motion classifier. The packing solver can make tiny
 * alternating corrections to an otherwise planted body; measuring one frame
 * of velocity therefore makes a stopped rank look as if it is still running.
 * A stable per-ID anchor keeps that visual decision out of authoritative
 * movement, pressure, checkpoints, and networking hashes.
 */
export function createRendererLocomotionTracker(capacity, options = {}) {
  const length = Math.max(1, Math.floor(Number(capacity) || 1));
  const settleSeconds = Math.max(0.1, Number(options.settleSeconds)
    || RENDERER_LOCOMOTION_HYSTERESIS.settleSeconds);
  const settleDistance = Math.max(0.01, Number(options.settleDistance)
    || RENDERER_LOCOMOTION_HYSTERESIS.settleDistance);
  const releaseSeconds = Math.max(0.05, Number(options.releaseSeconds)
    || RENDERER_LOCOMOTION_HYSTERESIS.releaseSeconds);
  const releaseDistance = Math.max(settleDistance, Number(options.releaseDistance)
    || RENDERER_LOCOMOTION_HYSTERESIS.releaseDistance);
  const anchorX = new Float32Array(length);
  const anchorZ = new Float32Array(length);
  const anchorTime = new Float32Array(length);
  const initialized = new Uint8Array(length);
  const planted = new Uint8Array(length);

  const reset = (id, x, z, time, value = false) => {
    if (!Number.isInteger(id) || id < 0 || id >= length) return value;
    anchorX[id] = Number.isFinite(x) ? x : 0;
    anchorZ[id] = Number.isFinite(z) ? z : 0;
    anchorTime[id] = Number.isFinite(time) ? time : 0;
    initialized[id] = 1;
    planted[id] = value ? 1 : 0;
    return value;
  };

  return {
    sample({id, x, z, time, role, visible = true}) {
      if (!visible || !Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(time)) {
        return reset(id, x, z, time, false);
      }
      if (role === ENGAGEMENT_RESERVE) {
        return reset(id, x, z, time, true);
      }
      if (role === ENGAGEMENT_GATE_QUEUE) return reset(id, x, z, time, false);
      // Attack roles bypass locomotion hysteresis. GATE_ATTACK still receives
      // its stable planted base pose from rendererEngagementPresentation, but
      // neither it nor active player/hunter attackers inherit a stale settled
      // MARCHING decision when their role changes.
      if (role === ENGAGEMENT_GATE_ATTACK
        || role === ENGAGEMENT_PLAYER_ATTACK
        || role === ENGAGEMENT_HUNTER) {
        return reset(id, x, z, time, false);
      }
      if (role !== ENGAGEMENT_MARCHING) return reset(id, x, z, time, false);
      if (!initialized[id]) return reset(id, x, z, time, false);

      const distance = Math.hypot(x - anchorX[id], z - anchorZ[id]);
      if (planted[id]) {
        if (time - anchorTime[id] >= releaseSeconds) {
          if (distance > releaseDistance) return reset(id, x, z, time, false);
          return reset(id, x, z, time, true);
        }
        return true;
      }
      if (distance > settleDistance) return reset(id, x, z, time, false);
      if (time - anchorTime[id] >= settleSeconds) {
        return reset(id, x, z, time, true);
      }
      return false;
    },
    reset,
  };
}

/**
 * Converts authoritative engagement intent into presentation semantics.
 * Unreleased reserve bodies are planted. Campaign queue bodies retain their
 * forward press while the bounded solver meters them into the strike front.
 * Large-host overflow also advances now, so its queue role must retain the
 * walking/pushing pose rather than sliding a planted reserve sprite.
 * Older fixtures retain the waitingRank compatibility path.
 */
export function rendererEngagementPresentation(battlefield, id, motionPlanted = false) {
  const role = battlefield.engagementRole?.[id];
  if (role == null) {
    return {role: null, planted: Boolean(battlefield.waitingRank?.[id]), attacks: true};
  }
  return {
    role,
    planted: role === ENGAGEMENT_RESERVE
      || role === ENGAGEMENT_GATE_ATTACK
      || (role === ENGAGEMENT_MARCHING && motionPlanted),
    attacks: role === ENGAGEMENT_GATE_ATTACK
      || role === ENGAGEMENT_PLAYER_ATTACK
      || role === ENGAGEMENT_HUNTER,
  };
}

export function rendererMotionOrigin(previous, target, visible) {
  if (!visible) return OFFSCREEN;
  return previous === OFFSCREEN ? target : previous;
}

export function rendererInitialPosition(battlefield, id, visible = true) {
  if (!visible) return {x: OFFSCREEN, z: OFFSCREEN};
  const x = Number(battlefield?.x?.[id]);
  const z = Number(battlefield?.z?.[id]);
  return {
    x: Number.isFinite(x) ? x : OFFSCREEN,
    z: Number.isFinite(z) ? z : OFFSCREEN,
  };
}

export const RENDER_PROFILE = Object.freeze({
  mobile: Object.freeze({ key: 'mobile', capacity: 2000, updateHz: 30, mobile: true }),
  desktop: Object.freeze({ key: 'desktop', capacity: 6000, updateHz: 30, mobile: false })
});

export const DEFAULT_ENEMY_DISPLAY = Object.freeze({
  // Briarbound source art is unusually lean. A modest presentation-only
  // width/height lift makes the same logical bodies readable from the firing
  // overlook without changing hit volumes, crowd packing, pressure or count.
  width: 1.78,
  height: 2.55,
});

// Cut-out horde atlases are deliberately sampled without mipmaps. Mip-chain
// minification averages the narrow transparent limbs into the empty cell
// background, then alpha testing removes them entirely at rampart distance.
// Bilinear filtering keeps the authored silhouette stable without introducing
// the shimmer that nearest-neighbour sampling caused while the host advances.
export const HOST_SPRITE_COVERAGE = Object.freeze({
  alphaCutoff: 0.24,
  noMipmap: true,
  sampling: 'bilinear',
});
export const PRIMARY_HOST_TINT_STRENGTH = 0.26;
export const ENGAGEMENT_READABILITY = Object.freeze({
  fullAtZ: 14,
  fadeAtZ: 76,
  luminanceLift: 0.16,
});
export const HOST_SPRITE_READABILITY = Object.freeze({
  brightness: 1.14,
  atlasGamma: 1.02,
  fogNear: 48,
  fogFar: 145,
  fogMix: 0.28,
});
export const HOST_SAP_READABILITY_GRADE = Object.freeze({
  signalStart: 0.08,
  signalFull: 0.24,
  valueStart: 0.28,
  valueFull: 0.58,
  rearStrength: 0.12,
  nearStrength: 0.58,
  tint: Object.freeze([1.12, 1.24, 0.94]),
  legacyStrength: 0.22,
});
export const ATTACK_READABILITY_GRADE = Object.freeze({
  shadowFloor: 0.24,
  luminanceStart: 0.24,
  luminanceScale: 2,
  tint: Object.freeze([1.14, 1.20, 1.02]),
  legacyStrength: 0.5,
});
export const HOST_RANK_DEPTH_GRADE = Object.freeze({
  strength: 0.45,
  coolTint: Object.freeze([0.68, 0.90, 1.08]),
});

/**
 * Meshy bakes the horde atlas with premultiplied RGB. The cut-out shader writes
 * surviving texels opaque for stable depth, so grading the stored RGB directly
 * turned antialiased limbs into black pins. Recover straight colour first.
 */
export function straightAtlasRgb(color) {
  const alpha = Math.max(0, Math.min(1, Number(color?.[3]) || 0));
  if (alpha <= 0) return [0, 0, 0];
  return [0, 1, 2].map(index => Math.max(
    0,
    Math.min(1, (Number(color?.[index]) || 0) / Math.max(alpha, 1 / 255)),
  ));
}

export function legacyTintMultiplierForType(type = 0) {
  return spriteTintForType(type).map(channel => (
    1 + (channel - 1) * PRIMARY_HOST_TINT_STRENGTH
  ));
}

export function approachReadabilityAtZ(zValue) {
  const z = Number.isFinite(Number(zValue)) ? Number(zValue) : ENGAGEMENT_READABILITY.fadeAtZ;
  const span = ENGAGEMENT_READABILITY.fadeAtZ - ENGAGEMENT_READABILITY.fullAtZ;
  const amount = Math.max(0, Math.min(1, (z - ENGAGEMENT_READABILITY.fullAtZ) / span));
  const smoothed = amount * amount * (3 - 2 * amount);
  return 1 - smoothed;
}

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function hostSapSignalMask(color) {
  const [red, green, blue] = [0, 1, 2].map(index =>
    Math.max(0, Math.min(1, Number(color?.[index]) || 0))
  );
  const warm = Math.max(0, Math.min(red, green) - blue * 0.88);
  const greenSignal = Math.max(0, green - Math.max(red * 0.72, blue * 1.05));
  const signal = Math.max(warm, greenSignal);
  const value = Math.max(red, green);
  return smoothstep(
    HOST_SAP_READABILITY_GRADE.signalStart,
    HOST_SAP_READABILITY_GRADE.signalFull,
    signal,
  ) * smoothstep(
    HOST_SAP_READABILITY_GRADE.valueStart,
    HOST_SAP_READABILITY_GRADE.valueFull,
    value,
  );
}

/**
 * CPU reference for the draw-neutral host colour grade used by the GPU
 * shader and the legacy fallback. Environmental warmth is multiplicative so
 * zero-valued outline pixels stay black instead of becoming a flat gold halo.
 */
export function gradeHostSpriteColor(
  color,
  {
    engagement = 0,
    warmth = 0,
    fog = 0,
    attack = 0,
    rearRank = 0,
    sap = null,
    sapStrength = 1,
    warmTint = HOST_KILLZONE_LIGHT_GRADE.warmTint,
  } = {},
) {
  const source = [0, 1, 2].map(index => Math.max(0, Math.min(1, Number(color?.[index]) || 0)));
  const engagementAmount = Math.max(0, Math.min(1, Number(engagement) || 0));
  const warmthAmount = Math.max(0, Math.min(1, Number(warmth) || 0));
  const fogAmount = Math.max(0, Math.min(1, Number(fog) || 0));
  const attackAmount = Math.max(0, Math.min(1, Number(attack) || 0));
  const rearRankAmount = Math.max(0, Math.min(1, Number(rearRank) || 0));
  const sapEnabled = sap !== null && sap !== undefined;
  const sapEngagement = Math.max(0, Math.min(1, Number(sap) || 0));
  const sapResponse = sapEnabled
    ? hostSapSignalMask(source)
      * (HOST_SAP_READABILITY_GRADE.rearStrength
        + (HOST_SAP_READABILITY_GRADE.nearStrength - HOST_SAP_READABILITY_GRADE.rearStrength)
          * sapEngagement)
      * Math.max(0, Math.min(1, Number(sapStrength) || 0))
    : 0;
  const luminance = source[0] * 0.2126 + source[1] * 0.7152 + source[2] * 0.0722;
  const killzoneResponse = warmthAmount
    * (0.38 + 0.62 * luminance)
    * (1 - fogAmount * 0.45);
  const engagementScale = 1 + engagementAmount * ENGAGEMENT_READABILITY.luminanceLift;
  const attackSapPixel = Math.max(0, Math.min(
    1,
    (luminance - ATTACK_READABILITY_GRADE.luminanceStart)
      * ATTACK_READABILITY_GRADE.luminanceScale,
  ));
  const attackResponse = attackAmount * (
    ATTACK_READABILITY_GRADE.shadowFloor
      + (1 - ATTACK_READABILITY_GRADE.shadowFloor) * attackSapPixel
  );
  return source.map((channel, index) => Math.max(0, Math.min(
    1,
    channel
      * engagementScale
      * (1 + (HOST_RANK_DEPTH_GRADE.coolTint[index] - 1)
        * rearRankAmount * HOST_RANK_DEPTH_GRADE.strength)
      * (1 + ((warmTint?.[index] ?? 1) - 1) * killzoneResponse)
      * (1 + (ATTACK_READABILITY_GRADE.tint[index] - 1) * attackResponse)
      * (1 + (HOST_SAP_READABILITY_GRADE.tint[index] - 1) * sapResponse),
  )));
}

export function resolveRendererProfile({ coarse = false, width = 1280, query = '' } = {}) {
  if (query === '2k') return RENDER_PROFILE.mobile;
  if (query === '6k') return RENDER_PROFILE.desktop;
  return coarse || width < 760 ? RENDER_PROFILE.mobile : RENDER_PROFILE.desktop;
}

export function spriteTintForType(type = 0) {
  return [
    [0.52, 0.72, 0.43],
    [0.68, 0.55, 0.34],
    [0.42, 0.67, 0.58],
    [0.59, 0.48, 0.74],
    [0.78, 0.43, 0.22],
    [0.68, 0.64, 0.49],
    [0.76, 0.57, 0.28]
  ][Math.max(0, Math.min(6, Math.floor(Number(type) || 0)))];
}

export function legacySpriteLayoutForType(type = 0, {
  width = null,
  height = null,
  z = null,
  gateZ = 0,
} = {}) {
  const enemyType = Math.max(0, Math.min(6, Math.floor(Number(type) || 0)));
  const resolvedWidth = width ?? (enemyType >= 5 ? 3.4 : enemyType === 3 ? 3.45 : enemyType === 2 ? 2.35 : enemyType === 1 ? 2.15 : DEFAULT_ENEMY_DISPLAY.width);
  const resolvedHeight = height ?? (enemyType >= 5 ? 4.6 : enemyType === 3 ? 3.6 : enemyType === 2 ? 2.65 : enemyType === 1 ? 2.9 : DEFAULT_ENEMY_DISPLAY.height);
  const flightOffset = enemyType === 3 ? sporewingFlightOffsetAtGate(z, gateZ) : 0;
  return {
    width: resolvedWidth,
    height: resolvedHeight,
    y: resolvedHeight * 0.5 + flightOffset,
  };
}

export function legacyAtlasDirection({velocityX = 0, velocityZ = 0, z = 0, gateZ = 0, directionCount = 8} = {}) {
  const count = Math.max(1, Math.floor(Number(directionCount) || 8));
  let vx = Number.isFinite(velocityX) ? velocityX : 0;
  let vz = Number.isFinite(velocityZ) ? velocityZ : 0;
  if (Math.abs(vx) + Math.abs(vz) < 0.06) {
    vx = 0;
    vz = -1;
  }
  if (count === 8) {
    const absX = Math.abs(vx);
    const absZ = Math.abs(vz);
    if (absX < absZ * 0.4142) return vz >= 0 ? 0 : 4;
    if (absZ < absX * 0.4142) return vx >= 0 ? 2 : 6;
    if (vx >= 0) return vz >= 0 ? 1 : 3;
    return vz >= 0 ? 7 : 5;
  }
  const angle = Math.atan2(vx, vz);
  return ((Math.floor(((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2) * count) % count) + count) % count;
}

export function legacyAttackPresentation({
  elapsed = 0,
  lastAttackTime = -1000,
  active = true,
  framesPerDirection = 1,
} = {}) {
  const now = Number.isFinite(elapsed) ? elapsed : 0;
  const started = Number.isFinite(lastAttackTime) ? lastAttackTime : -1000;
  const age = Math.max(0, now - started);
  const attacking = active === true
    && started > -999
    && age < ENEMY_ATTACK_ANIMATION_SECONDS;
  const progress = attacking
    ? Math.max(0, Math.min(1, age / ENEMY_ATTACK_ANIMATION_SECONDS))
    : 0;
  const presentation = proceduralAttackPresentation(progress, framesPerDirection);
  return {
    attacking,
    age,
    progress,
    readability: attackReadabilityForPresentation(presentation, attacking),
    lunge: attacking ? presentation.lunge : 0,
    frame: presentation.frame,
  };
}

function atlasTypeForEnemy(type = 0) {
  return [0, 1, 3, 4, 2, 5, 5][Math.max(0, Math.min(6, Math.floor(Number(type) || 0)))];
}

function isRenderableEnemy(battlefield, id) {
  if (typeof battlefield.isAlive === 'function' && battlefield.isAlive(id)) return true;
  const status = battlefield.status?.[id];
  return status === (battlefield.ACTIVE ?? 1)
    || (battlefield.DYING != null && status === battlefield.DYING);
}

function rendererFacingVelocity(battlefield, id, alive = true) {
  if (!alive) return {x: 0, z: 0};
  const desiredX = battlefield.desiredVx?.[id] ?? 0;
  const desiredZ = battlefield.desiredVz?.[id] ?? 0;
  if (Math.abs(desiredX) + Math.abs(desiredZ) >= 0.06) return {x: desiredX, z: desiredZ};
  const lane = battlefield.approach?.[id] ?? 0;
  const gateX = lane === 1
    ? battlefield.world?.eastGateX ?? 16
    : battlefield.world?.westGateX ?? -16;
  return {
    x: gateX - (battlefield.x?.[id] ?? gateX),
    z: (battlefield.world?.gateZ ?? 0) - (battlefield.z?.[id] ?? 1),
  };
}

/** Keep one atlas direction for the full attack, hit, or death state. */
export function createRendererFacingLatch(capacityValue) {
  const capacity = Math.max(0, Math.floor(Number(capacityValue) || 0));
  const x = new Float32Array(capacity);
  const z = new Float32Array(capacity);
  const valid = new Uint8Array(capacity);
  return Object.freeze({
    sample({slot: slotValue, candidateX = 0, candidateZ = 0, locked = false} = {}) {
      const slot = Math.floor(Number(slotValue));
      if (slot < 0 || slot >= capacity) throw new RangeError(`Facing latch slot ${slotValue} is out of range.`);
      const nextX = Number.isFinite(Number(candidateX)) ? Number(candidateX) : 0;
      const nextZ = Number.isFinite(Number(candidateZ)) ? Number(candidateZ) : 0;
      const candidateValid = Math.hypot(nextX, nextZ) >= 0.06;
      if (candidateValid && (!valid[slot] || locked !== true)) {
        const length = Math.hypot(nextX, nextZ);
        x[slot] = nextX / length;
        z[slot] = nextZ / length;
        valid[slot] = 1;
      }
      if (!valid[slot]) return {x: 0, z: -1};
      return {x: x[slot], z: z[slot]};
    },
  });
}

export function createRendererDiagnostics(capacity, mode = 'pending') {
  return {
    mode,
    capacity,
    selectedSprites: capacity,
    activeSprites: 0,
    droppedSprites: 0,
    bufferUploads: 0,
    lastUpdateMs: 0
  };
}

function loadTexture(BABYLON, scene, url) {
  return new Promise((resolve, reject) => {
    const texture = new BABYLON.Texture(
      url,
      scene,
      HOST_SPRITE_COVERAGE.noMipmap,
      false,
      BABYLON.Texture.BILINEAR_SAMPLINGMODE,
      () => resolve(texture),
      (_message, error) => reject(error || new Error(`Could not load ${url}`))
    );
    texture.hasAlpha = true;
    texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  });
}

export async function loadOptionalAtlas(BABYLON, scene, metadataUrl, textureUrl) {
  const metadataPromise = fetch(metadataUrl).then(response => {
    if (!response.ok) throw new Error(`Optional atlas metadata failed: ${response.status}`);
    return response.json();
  });
  const texturePromise = loadTexture(BABYLON, scene, textureUrl);
  const [metadataResult, textureResult] = await Promise.allSettled([
    metadataPromise,
    texturePromise,
  ]);
  if (metadataResult.status === 'fulfilled' && textureResult.status === 'fulfilled') {
    return {metadata: metadataResult.value, texture: textureResult.value};
  }
  if (textureResult.status === 'fulfilled') {
    textureResult.value.dispose?.();
  }
  return null;
}

export function installGpuShaders(BABYLON) {
  if (BABYLON.Effect.ShadersStore.briarGpuSpriteVertexShader) return;
  const base = buildGpuAtlasSpriteShaderSources();
  const engagementFullAtZ = ENGAGEMENT_READABILITY.fullAtZ.toFixed(1);
  const engagementFadeAtZ = ENGAGEMENT_READABILITY.fadeAtZ.toFixed(1);
  BABYLON.Effect.ShadersStore.briarGpuSpriteVertexShader = base.vertex
    .replace(
      'uniform vec3 cameraPosition;',
      'uniform vec3 cameraPosition;\nuniform vec2 hostKillzoneXZ;\nuniform vec2 hostKillzoneRadiusSq;'
    )
    .replace(
      'varying vec2 vUV;',
      'varying vec2 vUV;\nvarying float vType;\nvarying float vSeedTone;\nvarying float vCameraDistance;\nvarying float vEngagementReadability;\nvarying float vKillzoneWarmth;'
    )
    .replace(
      'vUV = uvRect.xy + topLeft * uvRect.zw;',
      `vUV = uvRect.xy + topLeft * uvRect.zw;\n  vType = typeCode;\n  vSeedTone = fract(seed * 0.754877666);\n  vCameraDistance = length(center - cameraPosition);\n  vEngagementReadability = 1.0 - smoothstep(${engagementFullAtZ}, ${engagementFadeAtZ}, center.z);\n  vec2 killzoneDelta = center.xz - hostKillzoneXZ;\n  float killzoneD2 = dot(killzoneDelta, killzoneDelta);\n  vKillzoneWarmth = 1.0 - smoothstep(hostKillzoneRadiusSq.x, hostKillzoneRadiusSq.y, killzoneD2);`
    );
  BABYLON.Effect.ShadersStore.briarGpuSpriteFragmentShader = `
precision highp float;
uniform sampler2D atlasSampler;
uniform sampler2D stateAtlasSampler;
uniform float alphaCutoff;
uniform float brightness;
uniform float tintStrength;
uniform vec3 hostFogColor;
uniform float hostFogNear;
uniform float hostFogFar;
uniform vec3 hostKillzoneWarmTint;
varying vec2 vUV;
varying float vType;
varying float vSeedTone;
varying float vCameraDistance;
varying float vEngagementReadability;
varying float vKillzoneWarmth;
varying float vHitFlash;
varying float vDeathProgress;
varying float vUseStateAtlas;
varying float vAttackReadability;
vec3 tintFor(float typeCode) {
  if (typeCode < 0.5) return vec3(0.52, 0.72, 0.43);
  if (typeCode < 1.5) return vec3(0.68, 0.55, 0.34);
  if (typeCode < 2.5) return vec3(0.78, 0.43, 0.22);
  if (typeCode < 3.5) return vec3(0.42, 0.67, 0.58);
  if (typeCode < 4.5) return vec3(0.59, 0.48, 0.74);
  if (typeCode < 5.5) return vec3(0.68, 0.64, 0.49);
  return vec3(0.76, 0.57, 0.28);
}

vec3 hostVariantTint(float typeCode, float seedTone) {
  if (typeCode < 0.5) {
    if (seedTone < 0.56) return vec3(0.26, 0.58, 0.20);
    if (seedTone < 0.86) return vec3(0.66, 0.36, 0.16);
    return vec3(0.56, 0.69, 0.43);
  }
  return tintFor(typeCode);
}

void main(void) {
  vec4 color = vUseStateAtlas > 0.5
    ? texture2D(stateAtlasSampler, vUV)
    : texture2D(atlasSampler, vUV);
  if (color.a < alphaCutoff) discard;
  float tone = mix(0.70, 1.00, vSeedTone);
  float fog = smoothstep(hostFogNear, hostFogFar, vCameraDistance);
  vec3 straightAtlasColor = clamp(color.rgb / max(color.a, 0.0039215686), 0.0, 1.0);
  vec3 atlasColor = pow(straightAtlasColor, vec3(${HOST_SPRITE_READABILITY.atlasGamma.toFixed(2)}));
  vec3 graded = mix(atlasColor, atlasColor * hostVariantTint(vType, vSeedTone), tintStrength) * brightness * tone;
  // Restore a dark bark silhouette and preserve the atlas' bright sap/eyes.
  // A broad tint on the pale source art made thousands of bodies merge into a
  // uniform green-orange carpet at phone resolution.
  graded = max(vec3(0.0), (graded - vec3(0.43)) * 1.10 + vec3(0.43));
  graded = mix(graded, hostFogColor, fog * ${HOST_SPRITE_READABILITY.fogMix.toFixed(2)});
  float luminance = dot(graded, vec3(0.2126, 0.7152, 0.0722));
  float engagementAmount = clamp(vEngagementReadability, 0.0, 1.0);
  graded *= 1.0 + engagementAmount * ${ENGAGEMENT_READABILITY.luminanceLift.toFixed(2)};
  float rearRankAmount = 1.0 - engagementAmount;
  graded *= mix(
    vec3(1.0),
    vec3(${HOST_RANK_DEPTH_GRADE.coolTint.map(value => value.toFixed(2)).join(', ')}),
    rearRankAmount * ${HOST_RANK_DEPTH_GRADE.strength.toFixed(2)}
  );
  float sapWarmSignal = max(0.0, min(atlasColor.r, atlasColor.g) - atlasColor.b * 0.88);
  float sapGreenSignal = max(0.0, atlasColor.g - max(atlasColor.r * 0.72, atlasColor.b * 1.05));
  float sapMask = smoothstep(
    ${HOST_SAP_READABILITY_GRADE.signalStart.toFixed(2)},
    ${HOST_SAP_READABILITY_GRADE.signalFull.toFixed(2)},
    max(sapWarmSignal, sapGreenSignal)
  ) * smoothstep(
    ${HOST_SAP_READABILITY_GRADE.valueStart.toFixed(2)},
    ${HOST_SAP_READABILITY_GRADE.valueFull.toFixed(2)},
    max(atlasColor.r, atlasColor.g)
  );
  float sapAmount = sapMask * mix(
    ${HOST_SAP_READABILITY_GRADE.rearStrength.toFixed(2)},
    ${HOST_SAP_READABILITY_GRADE.nearStrength.toFixed(2)},
    engagementAmount
  );
  graded *= mix(
    vec3(1.0),
    vec3(${HOST_SAP_READABILITY_GRADE.tint.map(value => value.toFixed(2)).join(', ')}),
    sapAmount
  );
  float killzoneResponse = vKillzoneWarmth
    * (0.38 + 0.62 * clamp(luminance, 0.0, 1.0))
    * (1.0 - fog * 0.45);
  graded *= mix(vec3(1.0), hostKillzoneWarmTint, killzoneResponse);
  float attackSapPixel = clamp((luminance - ${ATTACK_READABILITY_GRADE.luminanceStart.toFixed(2)}) * ${ATTACK_READABILITY_GRADE.luminanceScale.toFixed(1)}, 0.0, 1.0);
  float attackSapResponse = clamp(vAttackReadability, 0.0, 1.0)
    * (${ATTACK_READABILITY_GRADE.shadowFloor.toFixed(2)} + ${(1 - ATTACK_READABILITY_GRADE.shadowFloor).toFixed(2)} * attackSapPixel);
  graded *= mix(vec3(1.0), vec3(${ATTACK_READABILITY_GRADE.tint.map(value => value.toFixed(2)).join(', ')}), attackSapResponse);
  graded = mix(graded, vec3(luminance) * 0.62, vDeathProgress * 0.82);
  graded = mix(graded, vec3(1.0, 0.88, 0.62), vHitFlash * 0.72);
  gl_FragColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
}`;
}

function typeFilterSet(value) {
  if (value == null) return null;
  return new Set(Array.isArray(value) ? value : [value]);
}

export function rendererSlotIds(battlefield, {typeFilter = null, excludeType = null} = {}) {
  const includedTypes = typeFilterSet(typeFilter);
  const excludedTypes = typeFilterSet(excludeType);
  const slotCount = Math.max(0, Math.min(
    Number.isInteger(battlefield?.slotCount) ? battlefield.slotCount : battlefield?.capacity || 0,
    battlefield?.capacity || 0,
  ));
  const selected = [];
  for (let id = 0; id < slotCount; id += 1) {
    const type = battlefield.type?.[id] || 0;
    if (includedTypes !== null && !includedTypes.has(type)) continue;
    if (excludedTypes !== null && excludedTypes.has(type)) continue;
    selected.push(id);
  }
  return Int32Array.from(selected);
}

function createIdentityMatrices(capacity) {
  const matrices = new Float32Array(capacity * 16);
  for (let index = 0; index < capacity; index += 1) {
    const offset = index * 16;
    matrices[offset] = 1;
    matrices[offset + 5] = 1;
    matrices[offset + 10] = 1;
    matrices[offset + 15] = 1;
  }
  return matrices;
}

function canUseGpuRenderer(BABYLON, mesh, forceLegacy) {
  return !forceLegacy
    && typeof BABYLON.RawTexture === 'function'
    && typeof mesh.thinInstanceSetBuffer === 'function'
    && typeof mesh.thinInstanceBufferUpdated === 'function';
}

export function commitGpuAtlasRendererFrame({
  plane,
  material,
  cameraPosition,
  visualTime,
  feedbackTime,
  capacity,
  initializing = false,
  traitsDirty = false,
  feedbackDirty = false,
  actionDirty = false,
}) {
  const uploads = ['spriteMotion', 'spriteKinematics'];
  if (initializing || traitsDirty) uploads.push('spriteTraits');
  if (initializing || feedbackDirty) uploads.push('spriteFeedback');
  if (initializing || actionDirty) uploads.push('spriteAction');
  for (const bufferName of uploads) plane.thinInstanceBufferUpdated(bufferName);

  // A newly bound dynamic thin-instance buffer can be observable by the first
  // draw before a full-capacity upload has committed on some WebGL drivers.
  // Keep every instance hidden until positions, traits, action state, and the
  // uniforms used to billboard them have all reached the GPU. Otherwise the
  // zero-filled motion state stacks the whole host at world origin and one
  // near-camera atlas cell presents as a giant opaque slab.
  material.setFloat('visualTime', visualTime);
  material.setFloat('feedbackTime', feedbackTime);
  material.setVector3('cameraPosition', cameraPosition);
  if (initializing) plane.thinInstanceCount = capacity;
  return uploads.length;
}

async function createGpuRenderer({
  BABYLON,
  scene,
  camera,
  battlefield,
  texture,
  metadata,
  stateAsset = null,
  profile,
  typeFilter = null,
  excludeType = null,
  name = 'briar-host',
  displayWidth = DEFAULT_ENEMY_DISPLAY.width,
  displayHeight = DEFAULT_ENEMY_DISPLAY.height,
  bruteVisualScale = 1.32,
  // Give the pale source atlas a stronger moss-and-bark grade while retaining
  // enough authored shading for thousands of bodies to remain individually legible.
  tintStrength = PRIMARY_HOST_TINT_STRENGTH,
  suppressedIds = null,
  disposeResource = resource => resource?.dispose?.(),
}) {
  const partialResources = [];
  const trackPartial = resource => {
    if (resource) partialResources.push(resource);
    return resource;
  };
  try {
  installGpuShaders(BABYLON);
  const slotIds = rendererSlotIds(battlefield, {typeFilter, excludeType});
  const capacity = slotIds.length;
  const plane = trackPartial(BABYLON.MeshBuilder.CreatePlane(
    `${name}-gpu-sprites`,
    { width: 1, height: 1, sideOrientation: BABYLON.Mesh.FRONTSIDE },
    scene
  ));
  if (!canUseGpuRenderer(BABYLON, plane, false)) {
    plane.dispose();
    throw new Error('GPU thin-instance atlas state is unavailable');
  }
  // Readiness is promoted by the first complete buffer commit in update().
  // This leaves no renderable source plane or zero-seeded thin instances in
  // the scene while async atlas partitions are still being assembled.
  plane.thinInstanceCount = 0;

  const frameMetadata = buildAtlasFrameMetadata(metadata, {
    animation: 'run',
    alphaBounds: metadata.alphaBounds,
  });
  const hasIdleAnimation = Array.isArray(metadata.animations)
    && metadata.animations.some(animation => animation?.name === 'idle');
  const idleFrameMetadata = hasIdleAnimation
    ? buildAtlasFrameMetadata(metadata, {animation: 'idle', alphaBounds: metadata.alphaBounds})
    : frameMetadata;
  const stateMetadata = stateAsset?.metadata || null;
  const stateAnimationNames = new Set(
    Array.isArray(stateMetadata?.animations)
      ? stateMetadata.animations.map(animation => animation?.name)
      : []
  );
  const hasStateAnimations = ['attack', 'hit', 'death'].every(name => stateAnimationNames.has(name));
  const attackFrameMetadata = hasStateAnimations
    ? buildAtlasFrameMetadata(stateMetadata, {animation: 'attack', alphaBounds: stateMetadata.alphaBounds})
    : frameMetadata;
  const hitFrameMetadata = hasStateAnimations
    ? buildAtlasFrameMetadata(stateMetadata, {animation: 'hit', alphaBounds: stateMetadata.alphaBounds})
    : frameMetadata;
  const deathFrameMetadata = hasStateAnimations
    ? buildAtlasFrameMetadata(stateMetadata, {animation: 'death', alphaBounds: stateMetadata.alphaBounds})
    : frameMetadata;
  const attackProjectionScale = hasStateAnimations
    ? atlasStateProjectionScale(metadata, stateMetadata, 'attack')
    : 1;
  const hitProjectionScale = hasStateAnimations
    ? atlasStateProjectionScale(metadata, stateMetadata, 'hit')
    : 1;
  const deathProjectionScale = hasStateAnimations
    ? atlasStateProjectionScale(metadata, stateMetadata, 'death')
    : 1;
  const frameTexture = trackPartial(new BABYLON.RawTexture(
    frameMetadata.data,
    frameMetadata.textureWidth,
    frameMetadata.textureHeight,
    BABYLON.Engine.TEXTUREFORMAT_RGBA,
    scene,
    false,
    false,
    BABYLON.Texture.NEAREST_SAMPLINGMODE,
    BABYLON.Engine.TEXTURETYPE_FLOAT
  ));
  frameTexture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
  frameTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  const idleFrameTexture = hasIdleAnimation ? trackPartial(new BABYLON.RawTexture(
    idleFrameMetadata.data,
    idleFrameMetadata.textureWidth,
    idleFrameMetadata.textureHeight,
    BABYLON.Engine.TEXTUREFORMAT_RGBA,
    scene,
    false,
    false,
    BABYLON.Texture.NEAREST_SAMPLINGMODE,
    BABYLON.Engine.TEXTURETYPE_FLOAT
  )) : frameTexture;
  idleFrameTexture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
  idleFrameTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  const createStateFrameTexture = frameData => {
    const stateTexture = trackPartial(new BABYLON.RawTexture(
      frameData.data,
      frameData.textureWidth,
      frameData.textureHeight,
      BABYLON.Engine.TEXTUREFORMAT_RGBA,
      scene,
      false,
      false,
      BABYLON.Texture.NEAREST_SAMPLINGMODE,
      BABYLON.Engine.TEXTURETYPE_FLOAT
    ));
    stateTexture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    stateTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
    return stateTexture;
  };
  const attackFrameTexture = hasStateAnimations ? createStateFrameTexture(attackFrameMetadata) : frameTexture;
  const hitFrameTexture = hasStateAnimations ? createStateFrameTexture(hitFrameMetadata) : frameTexture;
  const deathFrameTexture = hasStateAnimations ? createStateFrameTexture(deathFrameMetadata) : frameTexture;

  const shader = buildGpuAtlasSpriteShaderSources();
  const material = trackPartial(new BABYLON.ShaderMaterial(
    `${name}-gpu-material`,
    scene,
    { vertex: 'briarGpuSprite', fragment: 'briarGpuSprite' },
    {
      attributes: shader.attributes,
      uniforms: [
        ...shader.uniforms,
        'hostFogColor', 'hostFogNear', 'hostFogFar',
        'hostKillzoneXZ', 'hostKillzoneRadiusSq', 'hostKillzoneWarmTint',
      ],
      samplers: shader.samplers
    }
  ));
  material.setTexture('atlasSampler', texture);
  material.setTexture('stateAtlasSampler', hasStateAnimations ? stateAsset.texture : texture);
  material.setTexture('frameMetaSampler', frameTexture);
  material.setTexture('idleFrameMetaSampler', idleFrameTexture);
  material.setTexture('attackFrameMetaSampler', attackFrameTexture);
  material.setTexture('hitFrameMetaSampler', hitFrameTexture);
  material.setTexture('deathFrameMetaSampler', deathFrameTexture);
  material.setFloat('alphaCutoff', HOST_SPRITE_COVERAGE.alphaCutoff);
  material.setFloat('brightness', HOST_SPRITE_READABILITY.brightness);
  material.setFloat('tintStrength', tintStrength);
  material.setColor3('hostFogColor', BABYLON.Color3.FromHexString(WORLD_ATMOSPHERE.fogColor));
  material.setFloat('hostFogNear', HOST_SPRITE_READABILITY.fogNear);
  material.setFloat('hostFogFar', HOST_SPRITE_READABILITY.fogFar);
  material.setVector2('hostKillzoneXZ', new BABYLON.Vector2(...HOST_KILLZONE_LIGHT_GRADE.positionXZ));
  material.setVector2('hostKillzoneRadiusSq', new BABYLON.Vector2(
    HOST_KILLZONE_LIGHT_GRADE.innerRadius ** 2,
    HOST_KILLZONE_LIGHT_GRADE.outerRadius ** 2,
  ));
  material.setColor3('hostKillzoneWarmTint', new BABYLON.Color3(...HOST_KILLZONE_LIGHT_GRADE.warmTint));
  material.setFloat('gateZ', battlefield.world?.gateZ ?? 0);
  material.setFloat('spawnMaxZ', battlefield.world?.spawnFarZ ?? 118);
  material.setFloat('directionCount', frameMetadata.directionCount);
  material.setFloat('framesPerDirection', frameMetadata.framesPerDirection);
  material.setFloat('animationFps', Math.min(GROUNDED_ENEMY_MOTION.maximumAnimationFps, frameMetadata.fps));
  material.setFloat('feedbackTime', battlefield.elapsed || 0);
  material.setFloat('frameMetaWidth', frameMetadata.textureWidth);
  material.setFloat('idleFramesPerDirection', idleFrameMetadata.framesPerDirection);
  material.setFloat('idleAnimationFps', Math.min(GROUNDED_ENEMY_MOTION.maximumAnimationFps, idleFrameMetadata.fps));
  material.setFloat('idleFrameMetaWidth', idleFrameMetadata.textureWidth);
  material.setFloat('hasIdleAnimation', hasIdleAnimation ? 1 : 0);
  material.setFloat('hasStateAnimations', hasStateAnimations ? 1 : 0);
  material.setFloat('attackFramesPerDirection', attackFrameMetadata.framesPerDirection);
  material.setFloat('hitFramesPerDirection', hitFrameMetadata.framesPerDirection);
  material.setFloat('deathFramesPerDirection', deathFrameMetadata.framesPerDirection);
  material.setFloat('attackFrameMetaWidth', attackFrameMetadata.textureWidth);
  material.setFloat('hitFrameMetaWidth', hitFrameMetadata.textureWidth);
  material.setFloat('deathFrameMetaWidth', deathFrameMetadata.textureWidth);
  material.setFloat('attackProjectionScale', attackProjectionScale);
  material.setFloat('hitProjectionScale', hitProjectionScale);
  material.setFloat('deathProjectionScale', deathProjectionScale);
  material.setFloat('stressMode', profile.capacity > 2000 ? 1 : 0);
  material.setFloat('mobileMode', profile.mobile ? 1 : 0);
  material.setFloat('displayWidth', displayWidth);
  material.setFloat('displayHeight', displayHeight);
  material.setFloat('frameScale', 1);
  material.setFloat('bruteVisualScale', bruteVisualScale);
  material.backFaceCulling = false;
  material.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
  material.alphaMode = BABYLON.Engine.ALPHA_DISABLE;
  material.forceDepthWrite = true;
  material.needAlphaBlending = () => false;

  plane.material = material;
  plane.isPickable = false;
  plane.alwaysSelectAsActiveMesh = true;

  const buffers = createGpuAtlasSpriteBuffers(capacity);
  const matrices = createIdentityMatrices(capacity);
  const lastX = new Float32Array(capacity);
  const lastZ = new Float32Array(capacity);
  lastX.fill(OFFSCREEN);
  lastZ.fill(OFFSCREEN);
  const locomotionTracker = createRendererLocomotionTracker(battlefield.capacity);
  const facingLatch = createRendererFacingLatch(capacity);

  for (let slot = 0; slot < capacity; slot += 1) {
    const id = slotIds[slot];
    const visible = isRenderableEnemy(battlefield, id) && !suppressedIds?.has(id);
    const initial = rendererInitialPosition(battlefield, id, visible);
    lastX[slot] = initial.x;
    lastZ[slot] = initial.z;
    const initialFacing = rendererFacingVelocity(battlefield, id, true);
    const facing = facingLatch.sample({
      slot,
      candidateX: initialFacing.x,
      candidateZ: initialFacing.z,
    });
    const motionPlanted = locomotionTracker.sample({
      id,
      x: initial.x,
      z: initial.z,
      time: battlefield.elapsed || 0,
      role: battlefield.engagementRole?.[id],
      visible,
    });
    const engagement = rendererEngagementPresentation(battlefield, id, motionPlanted);
    writeGpuAtlasSpriteMovement(buffers, slot, {
      previousX: initial.x,
      previousZ: initial.z,
      targetX: initial.x,
      targetZ: initial.z,
      motionStart: 0,
      motionDuration: 0.001
    });
    writeGpuAtlasSpriteTraits(buffers, slot, {
      seed: ((Math.imul(id + 1, 2654435761) >>> 0) / 0xffffffff) * 19.7,
      type: atlasTypeForEnemy(battlefield.type?.[id] || 0),
      logicalType: battlefield.type?.[id] || 0,
      depthBias: stableDepthBias(id),
      swarmPhase: (id % 97) / 97 * Math.PI * 2
    });
    writeGpuAtlasSpriteFeedback(buffers, slot, {
      lastHitTime: battlefield.lastHitTime?.[id] ?? -1000,
      stateProgress: battlefield.status?.[id] === (battlefield.DYING ?? 3)
        ? battlefield.stateProgress?.[id] ?? 0
        : engagement.planted ? -2 : -1,
      facingVelocityX: facing.x,
      facingVelocityZ: facing.z,
    });
    writeGpuAtlasSpriteAction(buffers, slot, {
      lastAttackTime: engagement.attacks ? battlefield.lastAttackTime?.[id] ?? -1000 : -1000,
    });
  }

  plane.thinInstanceSetBuffer('matrix', matrices, 16, true);
  plane.thinInstanceSetBuffer('spriteMotion', buffers.motion, 4, false);
  plane.thinInstanceSetBuffer('spriteKinematics', buffers.kinematics, 4, false);
  plane.thinInstanceSetBuffer('spriteTraits', buffers.traits, 4, false);
  plane.thinInstanceSetBuffer('spriteFeedback', buffers.feedback, 4, false);
  plane.thinInstanceSetBuffer('spriteAction', buffers.action, 2, false);

  const diagnostics = createRendererDiagnostics(capacity, 'gpu-atlas');
  diagnostics.name = name;
  diagnostics.typeFilter = typeFilter;
  diagnostics.stateAnimations = hasStateAnimations;
  let lastUpdateAt = Number.NEGATIVE_INFINITY;
  let rendererReady = false;

  return {
    mode: 'gpu-atlas',
    diagnostics,
    update(time, force = false) {
      if (!force && time - lastUpdateAt < 1 / profile.updateHz) {
        material.setFloat('visualTime', time);
        material.setFloat('feedbackTime', battlefield.elapsed || 0);
        material.setVector3('cameraPosition', camera.globalPosition || camera.position);
        return;
      }
      const started = performance.now();
      const duration = Number.isFinite(lastUpdateAt) ? Math.max(1 / 120, time - lastUpdateAt) : 1 / 30;
      let active = 0;
      let traitsDirty = false;
      let feedbackDirty = false;
      let actionDirty = false;
      for (let slot = 0; slot < capacity; slot += 1) {
        const id = slotIds[slot];
        const visible = isRenderableEnemy(battlefield, id) && !suppressedIds?.has(id);
        const alive = battlefield.status?.[id] === (battlefield.ACTIVE ?? 1);
        const targetX = visible ? battlefield.x[id] : OFFSCREEN;
        const targetZ = visible ? battlefield.z[id] : OFFSCREEN;
        const motionPlanted = locomotionTracker.sample({
          id,
          x: targetX,
          z: targetZ,
          time: battlefield.elapsed || 0,
          role: battlefield.engagementRole?.[id],
          visible,
        });
        const engagement = rendererEngagementPresentation(battlefield, id, motionPlanted);
        const waiting = engagement.planted;
        // The granular solver intentionally keeps locomotion intent separate
        // from positional corrections. A fully packed body can therefore have
        // a large logical velocity while its physical position is planted.
        // Waiting state is authoritative for presentation: face the route, but
        // feed zero motion so fallback atlases idle instead of running in place.
        const actualVx = alive && !waiting ? battlefield.vx[id] : 0;
        const actualVz = alive && !waiting ? battlefield.vz[id] : 0;
        const useMarchIntent = alive && !waiting && Math.hypot(actualVx, actualVz) < 0.2
          && Math.hypot(battlefield.desiredVx?.[id] ?? 0, battlefield.desiredVz?.[id] ?? 0) >= 0.2;
        writeGpuAtlasSpriteMovement(buffers, slot, {
          // Visibility changes are teleports, not locomotion. Interpolating
          // between the 100 km sentinel and a real battlefield coordinate can
          // sweep a sprite plane through the camera and produce a giant black
          // wedge during first spawn or death on a slow frame.
          previousX: rendererMotionOrigin(lastX[slot], targetX, visible),
          previousZ: rendererMotionOrigin(lastZ[slot], targetZ, visible),
          targetX,
          targetZ,
          velocityX: useMarchIntent ? battlefield.desiredVx[id] : actualVx,
          velocityZ: useMarchIntent ? battlefield.desiredVz[id] : actualVz,
          motionStart: time,
          motionDuration: duration
        });
        const atlasType = atlasTypeForEnemy(battlefield.type?.[id] || 0);
        const logicalType = battlefield.type?.[id] || 0;
        const encodedType = atlasType + logicalType * 0.01;
        if (Math.abs(buffers.traits[slot * 4 + 1] - encodedType) > 0.0001) {
          writeGpuAtlasSpriteTraits(buffers, slot, {
            seed: buffers.traits[slot * 4],
            type: atlasType,
            logicalType,
            depthBias: stableDepthBias(id),
            swarmPhase: buffers.traits[slot * 4 + 3]
          });
          traitsDirty = true;
        }
        const lastHitTime = battlefield.lastHitTime?.[id] ?? -1000;
        const lastAttackTime = engagement.attacks ? battlefield.lastAttackTime?.[id] ?? -1000 : -1000;
        const stateProgress = battlefield.status?.[id] === (battlefield.DYING ?? 3)
          ? battlefield.stateProgress?.[id] ?? 0
          : waiting ? -2 : -1;
        const feedbackOffset = slot * 4;
        const currentTime = battlefield.elapsed || 0;
        const facingLocked = !alive
          || (lastHitTime > -999 && currentTime - lastHitTime < ENEMY_HIT_ANIMATION_SECONDS)
          || (lastAttackTime > -999 && currentTime - lastAttackTime < ENEMY_ATTACK_ANIMATION_SECONDS);
        const candidateFacing = rendererFacingVelocity(battlefield, id, true);
        const facing = facingLatch.sample({
          slot,
          candidateX: candidateFacing.x,
          candidateZ: candidateFacing.z,
          locked: facingLocked,
        });
        const facingVelocityX = facing.x;
        const facingVelocityZ = facing.z;
        if (Math.abs(buffers.feedback[feedbackOffset] - lastHitTime) > 0.0001
          || Math.abs(buffers.feedback[feedbackOffset + 1] - stateProgress) > 0.0001
          || Math.abs(buffers.feedback[feedbackOffset + 2] - facingVelocityX) > 0.0001
          || Math.abs(buffers.feedback[feedbackOffset + 3] - facingVelocityZ) > 0.0001) {
          writeGpuAtlasSpriteFeedback(buffers, slot, {
            lastHitTime,
            stateProgress,
            facingVelocityX,
            facingVelocityZ,
          });
          feedbackDirty = true;
        }
        const actionOffset = slot * 2;
        if (Math.abs(buffers.action[actionOffset] - lastAttackTime) > 0.0001) {
          writeGpuAtlasSpriteAction(buffers, slot, {lastAttackTime});
          actionDirty = true;
        }
        lastX[slot] = targetX;
        lastZ[slot] = targetZ;
        if (visible) active += 1;
      }
      const initializing = !rendererReady;
      const bufferUploads = commitGpuAtlasRendererFrame({
        plane,
        material,
        cameraPosition: camera.globalPosition || camera.position,
        visualTime: time,
        feedbackTime: battlefield.elapsed || 0,
        capacity,
        initializing,
        traitsDirty,
        feedbackDirty,
        actionDirty,
      });
      if (initializing) rendererReady = true;
      diagnostics.activeSprites = active;
      diagnostics.bufferUploads += bufferUploads;
      diagnostics.lastUpdateMs = performance.now() - started;
      lastUpdateAt = time;
    },
    dispose() {
      disposeResource(plane);
      disposeResource(material);
      if (idleFrameTexture !== frameTexture) disposeResource(idleFrameTexture);
      if (attackFrameTexture !== frameTexture) disposeResource(attackFrameTexture);
      if (hitFrameTexture !== frameTexture) disposeResource(hitFrameTexture);
      if (deathFrameTexture !== frameTexture) disposeResource(deathFrameTexture);
      disposeResource(frameTexture);
      if (hasStateAnimations && stateAsset.texture !== texture) disposeResource(stateAsset.texture);
      disposeResource(texture);
    }
  };
  } catch (error) {
    for (let index = partialResources.length - 1; index >= 0; index -= 1) {
      disposeResource(partialResources[index]);
    }
    throw error;
  }
}

function createLegacyRenderer({
  BABYLON,
  scene,
  battlefield,
  profile,
  textureUrl,
  metadata,
  typeFilter = null,
  excludeType = null,
  name = 'briar-host',
  displayWidth = null,
  displayHeight = null,
  suppressedIds = null,
}) {
  const includedTypes = typeFilterSet(typeFilter);
  const preservesAuthoredColor = includedTypes !== null && includedTypes.size === 1;
  const slotIds = rendererSlotIds(battlefield, {typeFilter, excludeType});
  const capacity = slotIds.length;
  const manager = new BABYLON.SpriteManager(
    `${name}-legacy-manager`,
    textureUrl,
    capacity,
    { width: metadata.frameWidth, height: metadata.frameHeight },
    scene
  );
  manager.isPickable = false;
  const sprites = new Array(capacity);
  for (let slot = 0; slot < capacity; slot += 1) {
    const id = slotIds[slot];
    const sprite = new BABYLON.Sprite(`briar-${id}`, manager);
    sprite.width = DEFAULT_ENEMY_DISPLAY.width;
    sprite.height = DEFAULT_ENEMY_DISPLAY.height;
    sprite.position.set(OFFSCREEN, DEFAULT_ENEMY_DISPLAY.height * 0.5, OFFSCREEN);
    sprite.cellIndex = id % metadata.framesPerDirection * metadata.directionCount + 4;
    const tone = 0.72 + (((Math.imul(id + 1, 2654435761) >>> 0) / 0xffffffff) * 0.32);
    sprite.color = new BABYLON.Color4(tone, tone, tone, 1);
    sprites[slot] = sprite;
  }
  const diagnostics = createRendererDiagnostics(capacity, 'legacy-individual-sprites');
  diagnostics.name = name;
  diagnostics.typeFilter = typeFilter;
  diagnostics.stateAnimations = false;
  const runAnimation = metadata.animations?.find(animation => animation?.name === 'run') || {
    frameStartRow: 0,
    framesPerDirection: metadata.framesPerDirection,
    fps: metadata.playbackFps?.run || 12,
  };
  const idleAnimation = metadata.animations?.find(animation => animation?.name === 'idle') || null;
  const locomotionTracker = createRendererLocomotionTracker(battlefield.capacity);
  let lastUpdateAt = Number.NEGATIVE_INFINITY;
  return {
    mode: 'legacy-individual-sprites',
    diagnostics,
    update(time, force = false) {
      if (!force && time - lastUpdateAt < 1 / profile.updateHz) return;
      const started = performance.now();
      let active = 0;
      for (let slot = 0; slot < capacity; slot += 1) {
        const id = slotIds[slot];
        const type = battlefield.type?.[id] || 0;
        const alive = isRenderableEnemy(battlefield, id) && !suppressedIds?.has(id);
        const sprite = sprites[slot];
        sprite.isVisible = alive;
        if (!alive) continue;
        sprite.position.x = battlefield.x[id];
        sprite.position.z = battlefield.z[id];
        const layout = legacySpriteLayoutForType(type, {
          width: displayWidth,
          height: displayHeight,
          z: battlefield.z[id],
          gateZ: battlefield.world?.gateZ,
        });
        const deathProgress = battlefield.status?.[id] === (battlefield.DYING ?? 3)
          ? Math.max(0, Math.min(1, battlefield.stateProgress?.[id] ?? 0))
          : 0;
        const lifeMotion = 1 - deathProgress;
        const flightOffset = layout.y - layout.height * 0.5;
        sprite.width = layout.width * (1 + deathProgress * 0.18);
        sprite.height = layout.height * (1 - deathProgress * 0.72);
        sprite.position.y = sprite.height * 0.5 + flightOffset * lifeMotion - deathProgress * 0.38;
        const tint = preservesAuthoredColor ? [1, 1, 1] : legacyTintMultiplierForType(type);
        const tone = 0.72 + (((Math.imul(id + 1, 2654435761) >>> 0) / 0xffffffff) * 0.32);
        const hitAge = Math.max(0, (battlefield.elapsed || 0) - (battlefield.lastHitTime?.[id] ?? -1000));
        const hitT = Math.max(0, Math.min(1, hitAge / 0.12));
        const hitFlash = (battlefield.lastHitTime?.[id] ?? -1000) > -999
          ? 1 - hitT * hitT * (3 - 2 * hitT)
          : 0;
        const engagementReadability = approachReadabilityAtZ(battlefield.z[id]);
        const base = gradeHostSpriteColor(
          tint.map(channel => Math.min(1, channel * tone * HOST_SPRITE_READABILITY.brightness)),
          {
            engagement: engagementReadability,
            rearRank: 1 - engagementReadability,
            sap: engagementReadability,
            sapStrength: HOST_SAP_READABILITY_GRADE.legacyStrength,
          },
        );
        const luminance = base[0] * 0.2126 + base[1] * 0.7152 + base[2] * 0.0722;
        for (let channel = 0; channel < 3; channel += 1) {
          const desaturated = base[channel] + (luminance * 0.62 - base[channel]) * deathProgress * 0.82;
          const hitColor = [1, 0.88, 0.62][channel];
          const value = desaturated + (hitColor - desaturated) * hitFlash * 0.72;
          if (channel === 0) sprite.color.r = value;
          else if (channel === 1) sprite.color.g = value;
          else sprite.color.b = value;
        }
        const motionPlanted = locomotionTracker.sample({
          id,
          x: battlefield.x[id],
          z: battlefield.z[id],
          time: battlefield.elapsed || 0,
          role: battlefield.engagementRole?.[id],
          visible: alive,
        });
        const engagement = rendererEngagementPresentation(battlefield, id, motionPlanted);
        const planted = engagement.planted;
        const useIdleAtlas = Boolean(planted && idleAnimation);
        const actualSpeed = planted ? 0 : Math.hypot(battlefield.vx[id], battlefield.vz[id]);
        const intentSpeed = Math.hypot(battlefield.desiredVx?.[id] ?? 0, battlefield.desiredVz?.[id] ?? 0);
        const speed = !useIdleAtlas && !planted && actualSpeed < 0.2 ? intentSpeed : actualSpeed;
        const animation = useIdleAtlas ? idleAnimation : runAnimation;
        const locomotionRate = useIdleAtlas
          ? GROUNDED_ENEMY_MOTION.idleAnimationRate
          : planted || speed < 0.2
            ? GROUNDED_ENEMY_MOTION.plantedFallbackFps / Math.min(GROUNDED_ENEMY_MOTION.maximumAnimationFps, animation.fps)
            : 1;
        const animationFps = Math.min(GROUNDED_ENEMY_MOTION.maximumAnimationFps, animation.fps);
        let frame = planted && !idleAnimation
          ? 0
          : Math.floor(time * animationFps * locomotionRate + id * (useIdleAtlas ? 0.37 : 0.71))
            % animation.framesPerDirection;
        const attack = legacyAttackPresentation({
          elapsed: battlefield.elapsed || 0,
          lastAttackTime: engagement.attacks ? battlefield.lastAttackTime?.[id] ?? -1000 : -1000,
          active: battlefield.status?.[id] === (battlefield.ACTIVE ?? 1),
          framesPerDirection: animation.framesPerDirection,
        });
        if (attack.attacking) {
          frame = attack.frame;
        }
        const legacyAttackGrade = gradeHostSpriteColor(
          [sprite.color.r, sprite.color.g, sprite.color.b],
          {
            attack: attack.readability
              * ATTACK_READABILITY_GRADE.legacyStrength
              * (1 - hitFlash)
              * (1 - deathProgress),
          },
        );
        sprite.color.r = legacyAttackGrade[0];
        sprite.color.g = legacyAttackGrade[1];
        sprite.color.b = legacyAttackGrade[2];
        const facing = rendererFacingVelocity(battlefield, id, true);
        const facingLength = Math.hypot(facing.x, facing.z);
        sprite.position.x = battlefield.x[id]
          + (facingLength > 0.001 ? facing.x / facingLength : 0) * attack.lunge;
        sprite.position.z = battlefield.z[id]
          + (facingLength > 0.001 ? facing.z / facingLength : -1) * attack.lunge;
        const direction = legacyAtlasDirection({
          velocityX: facing.x,
          velocityZ: facing.z,
          z: battlefield.z[id],
          gateZ: battlefield.world?.gateZ || 0,
          directionCount: metadata.directionCount,
        });
        sprite.cellIndex = (animation.frameStartRow + frame) * metadata.directionCount + direction;
        active += 1;
      }
      diagnostics.activeSprites = active;
      diagnostics.lastUpdateMs = performance.now() - started;
      lastUpdateAt = time;
    },
    dispose() {
      for (const sprite of sprites) sprite.dispose();
      manager.dispose();
    }
  };
}

function createCompositeRenderer(renderers, mode) {
  const selectedSprites = renderers.reduce((sum, renderer) => sum + renderer.diagnostics.selectedSprites, 0);
  const diagnostics = createRendererDiagnostics(selectedSprites, mode);
  diagnostics.partitions = renderers.map(renderer => renderer.diagnostics);
  return {
    mode,
    diagnostics,
    update(time, force = false) {
      let activeSprites = 0;
      let bufferUploads = 0;
      let lastUpdateMs = 0;
      for (const renderer of renderers) {
        renderer.update(time, force);
        activeSprites += renderer.diagnostics.activeSprites;
        bufferUploads += renderer.diagnostics.bufferUploads;
        lastUpdateMs += renderer.diagnostics.lastUpdateMs;
      }
      diagnostics.activeSprites = activeSprites;
      diagnostics.bufferUploads = bufferUploads;
      diagnostics.lastUpdateMs = lastUpdateMs;
    },
    setPaused(paused) {
      for (const renderer of renderers) renderer.setPaused?.(paused);
    },
    dispose() {
      for (const renderer of renderers) renderer.dispose();
    },
  };
}

function createHybridEnemyRenderer(spriteRenderer, animatedRenderer) {
  const diagnostics = createRendererDiagnostics(
    spriteRenderer.diagnostics.selectedSprites,
    'hybrid-animated-3d',
  );
  diagnostics.spriteRenderer = spriteRenderer.diagnostics;
  diagnostics.animated3d = animatedRenderer.diagnostics;
  diagnostics.animated3dBodies = 0;
  diagnostics.spriteBodies = 0;
  return {
    mode: 'hybrid-animated-3d',
    diagnostics,
    update(time, force = false) {
      // Select and suppress the near-field 3D cohort before the sprite buffers
      // are committed, so one logical enemy is never drawn twice.
      animatedRenderer.update(time, force);
      spriteRenderer.update(time, force);
      diagnostics.animated3dBodies = animatedRenderer.diagnostics.activeBodies;
      diagnostics.spriteBodies = spriteRenderer.diagnostics.activeSprites;
      diagnostics.activeSprites = diagnostics.spriteBodies + diagnostics.animated3dBodies;
      diagnostics.droppedSprites = Math.max(0, diagnostics.selectedSprites - diagnostics.activeSprites);
      diagnostics.bufferUploads = spriteRenderer.diagnostics.bufferUploads;
      diagnostics.lastUpdateMs = spriteRenderer.diagnostics.lastUpdateMs
        + animatedRenderer.diagnostics.lastUpdateMs;
    },
    setPaused(paused) {
      spriteRenderer.setPaused?.(paused);
      animatedRenderer.setPaused?.(paused);
    },
    dispose() {
      animatedRenderer.dispose();
      spriteRenderer.dispose();
    },
  };
}

export async function createEnemyRenderer({
  BABYLON,
  scene,
  camera,
  battlefield,
  profile,
  textureUrl = 'assets/sprites/briarbound-meshy-run.webp',
  metadataUrl = 'assets/sprites/briarbound-meshy-run.json',
  stateTextureUrl = 'assets/sprites/briarbound-meshy-combat.webp',
  stateMetadataUrl = 'assets/sprites/briarbound-meshy-combat.json',
  bruteTextureUrl = 'assets/sprites/barkhide-brute-meshy-run.webp',
  bruteMetadataUrl = 'assets/sprites/barkhide-brute-meshy-run.json',
  bruteStateTextureUrl = 'assets/sprites/barkhide-brute-meshy-combat.webp',
  bruteStateMetadataUrl = 'assets/sprites/barkhide-brute-meshy-combat.json',
  mossguardTextureUrl = 'assets/sprites/mossguard-shield-meshy-run.webp',
  mossguardMetadataUrl = 'assets/sprites/mossguard-shield-meshy-run.json',
  mossguardStateTextureUrl = 'assets/sprites/mossguard-shield-meshy-combat.webp',
  mossguardStateMetadataUrl = 'assets/sprites/mossguard-shield-meshy-combat.json',
  sporewingTextureUrl = 'assets/sprites/sporewing-hunter-meshy-flight.webp',
  sporewingMetadataUrl = 'assets/sprites/sporewing-hunter-meshy-flight.json',
  sporewingStateTextureUrl = 'assets/sprites/sporewing-hunter-meshy-combat.webp',
  sporewingStateMetadataUrl = 'assets/sprites/sporewing-hunter-meshy-combat.json',
  wickerTextureUrl = 'assets/sprites/wicker-colossus-meshy-run.webp',
  wickerMetadataUrl = 'assets/sprites/wicker-colossus-meshy-run.json',
  wickerStateTextureUrl = 'assets/sprites/wicker-colossus-meshy-combat.webp',
  wickerStateMetadataUrl = 'assets/sprites/wicker-colossus-meshy-combat.json',
  forceLegacy = false,
  animated3dLimit = 0,
}) {
  const suppressedIds = new Set();
  const disposedResources = new WeakSet();
  const disposeResource = resource => {
    if (!resource || typeof resource.dispose !== 'function' || disposedResources.has(resource)) return;
    disposedResources.add(resource);
    resource.dispose();
  };
  const constructedGpuRenderers = [];
  const attachAnimatedLayer = async (spriteRenderer) => {
    if (!(Number(animated3dLimit) > 0)) return spriteRenderer;
    try {
      const animatedRenderer = await createAnimatedEnemyRenderer({
        BABYLON,
        scene,
        camera,
        battlefield,
        limit: animated3dLimit,
        suppressedIds,
      });
      return createHybridEnemyRenderer(spriteRenderer, animatedRenderer);
    } catch (error) {
      suppressedIds.clear();
      console.warn('[Briarhold renderer] Animated 3D enemies unavailable; using sprites.', error);
      return spriteRenderer;
    }
  };
  const optionalAtlas = (metadataUrl, textureUrl) =>
    loadOptionalAtlas(BABYLON, scene, metadataUrl, textureUrl);
  const activeTypes = new Set(Array.from(
    battlefield.type.slice(0, Math.min(battlefield.slotCount, battlefield.capacity))
  ));
  const [
    metadata,
    texture,
    stateAsset,
    bruteAsset,
    bruteStateAsset,
    mossguardAsset,
    mossguardStateAsset,
    sporewingAsset,
    sporewingStateAsset,
    wickerAsset,
    wickerStateAsset,
  ] = await Promise.all([
    fetch(metadataUrl).then(response => {
      if (!response.ok) throw new Error(`Atlas metadata failed: ${response.status}`);
      return response.json();
    }),
    loadTexture(BABYLON, scene, textureUrl),
    activeTypes.has(0) ? optionalAtlas(stateMetadataUrl, stateTextureUrl) : null,
    activeTypes.has(1) ? optionalAtlas(bruteMetadataUrl, bruteTextureUrl) : null,
    activeTypes.has(1) && !forceLegacy ? optionalAtlas(bruteStateMetadataUrl, bruteStateTextureUrl) : null,
    activeTypes.has(2) ? optionalAtlas(mossguardMetadataUrl, mossguardTextureUrl) : null,
    activeTypes.has(2) && !forceLegacy ? optionalAtlas(mossguardStateMetadataUrl, mossguardStateTextureUrl) : null,
    activeTypes.has(3) ? optionalAtlas(sporewingMetadataUrl, sporewingTextureUrl) : null,
    activeTypes.has(3) && !forceLegacy ? optionalAtlas(sporewingStateMetadataUrl, sporewingStateTextureUrl) : null,
    activeTypes.has(5) ? optionalAtlas(wickerMetadataUrl, wickerTextureUrl) : null,
    activeTypes.has(5) ? optionalAtlas(wickerStateMetadataUrl, wickerStateTextureUrl) : null,
  ]);
  if (!forceLegacy) {
    try {
      if (bruteAsset || mossguardAsset || sporewingAsset || wickerAsset) {
        const excludedPrimaryTypes = [
          ...(bruteAsset ? [1] : []),
          ...(mossguardAsset ? [2] : []),
          ...(sporewingAsset ? [3] : []),
          ...(wickerAsset ? [5] : []),
        ];
        const primary = await createGpuRenderer({
          BABYLON,
          scene,
          camera,
          battlefield,
          texture,
          metadata,
          stateAsset,
          profile,
          excludeType: excludedPrimaryTypes,
          name: 'briar-host',
          suppressedIds,
          disposeResource,
        });
        const renderers = [primary];
        constructedGpuRenderers.push(primary);
        if (bruteAsset) renderers.push(await createGpuRenderer({
            BABYLON,
            scene,
            camera,
            battlefield,
            texture: bruteAsset.texture,
            metadata: bruteAsset.metadata,
            stateAsset: bruteStateAsset,
            profile,
            typeFilter: 1,
            name: 'barkhide-host',
            displayWidth: 2.15,
            displayHeight: 2.9,
            bruteVisualScale: 0.82,
            tintStrength: 0.12,
            suppressedIds,
            disposeResource,
          }));
        if (renderers.length > constructedGpuRenderers.length) constructedGpuRenderers.push(renderers.at(-1));
        if (mossguardAsset) renderers.push(await createGpuRenderer({
            BABYLON,
            scene,
            camera,
            battlefield,
            texture: mossguardAsset.texture,
            metadata: mossguardAsset.metadata,
            stateAsset: mossguardStateAsset,
            profile,
            typeFilter: 2,
            name: 'mossguard-host',
            displayWidth: 2.35,
            displayHeight: 2.65,
            tintStrength: 0.08,
            suppressedIds,
            disposeResource,
          }));
        if (renderers.length > constructedGpuRenderers.length) constructedGpuRenderers.push(renderers.at(-1));
        if (sporewingAsset) renderers.push(await createGpuRenderer({
            BABYLON,
            scene,
            camera,
            battlefield,
            texture: sporewingAsset.texture,
            metadata: sporewingAsset.metadata,
            stateAsset: sporewingStateAsset,
            profile,
            typeFilter: 3,
            name: 'sporewing-host',
            displayWidth: 3.45,
            displayHeight: 3.6,
            tintStrength: 0.08,
            suppressedIds,
            disposeResource,
          }));
        if (renderers.length > constructedGpuRenderers.length) constructedGpuRenderers.push(renderers.at(-1));
        if (wickerAsset) renderers.push(await createGpuRenderer({
            BABYLON,
            scene,
            camera,
            battlefield,
            texture: wickerAsset.texture,
            metadata: wickerAsset.metadata,
            stateAsset: wickerStateAsset,
            profile,
            typeFilter: 5,
            name: 'wicker-colossus',
            displayWidth: DEFAULT_ENEMY_DISPLAY.width,
            displayHeight: DEFAULT_ENEMY_DISPLAY.height,
            tintStrength: 0.05,
            suppressedIds,
            disposeResource,
          }));
        if (renderers.length > constructedGpuRenderers.length) constructedGpuRenderers.push(renderers.at(-1));
        return await attachAnimatedLayer(createCompositeRenderer(renderers, 'gpu-atlas-multi'));
      }
      const gpuRenderer = await createGpuRenderer({
        BABYLON,
        scene,
        camera,
        battlefield,
        texture,
        metadata,
        stateAsset,
        profile,
        suppressedIds,
        disposeResource,
      });
      return await attachAnimatedLayer(gpuRenderer);
    } catch (error) {
      for (const renderer of constructedGpuRenderers) renderer.dispose();
      console.warn('[Briarhold renderer] GPU atlas state unavailable; using individual sprite fallback.', error);
    }
  }
  disposeResource(texture);
  disposeResource(stateAsset?.texture);
  disposeResource(bruteAsset?.texture);
  disposeResource(bruteStateAsset?.texture);
  disposeResource(mossguardAsset?.texture);
  disposeResource(mossguardStateAsset?.texture);
  disposeResource(sporewingAsset?.texture);
  disposeResource(sporewingStateAsset?.texture);
  disposeResource(wickerAsset?.texture);
  disposeResource(wickerStateAsset?.texture);
  const primary = createLegacyRenderer({
    BABYLON,
    scene,
    battlefield,
    profile,
    textureUrl,
    metadata,
    excludeType: [
      ...(bruteAsset ? [1] : []),
      ...(mossguardAsset ? [2] : []),
      ...(sporewingAsset ? [3] : []),
      ...(wickerAsset ? [5] : []),
    ],
    suppressedIds,
  });
  const renderers = [primary];
  if (bruteAsset) renderers.push(createLegacyRenderer({
      BABYLON,
      scene,
      battlefield,
      profile,
      textureUrl: bruteTextureUrl,
      metadata: bruteAsset.metadata,
      typeFilter: 1,
      name: 'barkhide-host',
      displayWidth: 2.15,
      displayHeight: 2.9,
      suppressedIds,
    }));
  if (mossguardAsset) renderers.push(createLegacyRenderer({
      BABYLON,
      scene,
      battlefield,
      profile,
      textureUrl: mossguardTextureUrl,
      metadata: mossguardAsset.metadata,
      typeFilter: 2,
      name: 'mossguard-host',
      displayWidth: 2.35,
      displayHeight: 2.65,
      suppressedIds,
    }));
  if (sporewingAsset) renderers.push(createLegacyRenderer({
      BABYLON,
      scene,
      battlefield,
      profile,
      textureUrl: sporewingTextureUrl,
      metadata: sporewingAsset.metadata,
      typeFilter: 3,
      name: 'sporewing-host',
      displayWidth: 3.45,
      displayHeight: 3.6,
      suppressedIds,
    }));
  if (wickerAsset) renderers.push(createLegacyRenderer({
      BABYLON,
      scene,
      battlefield,
      profile,
      textureUrl: wickerTextureUrl,
      metadata: wickerAsset.metadata,
      typeFilter: 5,
      name: 'wicker-colossus',
      displayWidth: 3.4,
      displayHeight: 4.6,
      suppressedIds,
    }));
  const spriteRenderer = renderers.length === 1
    ? primary
    : createCompositeRenderer(renderers, 'legacy-multi-atlas');
  return await attachAnimatedLayer(spriteRenderer);
}

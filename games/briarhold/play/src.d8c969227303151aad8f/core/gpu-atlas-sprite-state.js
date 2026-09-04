import {
  SPOREWING_BASE_FLIGHT_Y,
  SPOREWING_GATE_CLEARANCE_Y,
  SPOREWING_GATE_CLIMB_DISTANCE,
  sporewingFlightOffsetAtGate,
} from '../enemy-presentation.js';

export const ATLAS_SPRITE_TYPE = Object.freeze({
  normal: 0,
  brute: 1,
  powder: 2,
  shield: 3,
  jetpack: 4,
  mech: 5
});

export const ENEMY_HIT_FLASH_SECONDS = 0.12;
export const ENEMY_HIT_ANIMATION_SECONDS = 0.24;
export const ENEMY_ATTACK_ANIMATION_SECONDS = 0.52;
export const PROCEDURAL_ATTACK_PRESENTATION = Object.freeze({
  windupEnd: 0.32,
  strikeStart: 0.22,
  lunge: 0.34,
  recoil: 0.055,
  windupScaleX: 0.045,
  windupScaleY: 0.08,
  strikeScaleX: 0.025,
  strikeScaleY: 0.055,
  strikeFrameAt: 0.3,
  recoverFrameAt: 0.64,
  strikeFrameFraction: 0.55,
});

// Ground troops should read as a marching army, not thousands of independently
// buzzing sprites. Keep this contract shared by the GPU and legacy renderers.
export const GROUNDED_ENEMY_MOTION = Object.freeze({
  maximumAnimationFps: 5,
  plantedFallbackFps: 2,
  nearAnimationRate: 1,
  farAnimationRate: 1,
  speedDivisor: 6.5,
  maxLocomotionRate: 1,
  idleAnimationRate: 0.6,
  farReadabilityDesktop: 0.96,
  farReadabilityMobile: 0.92,
  normalBobRate: 2.35,
  normalBobAmount: 0.012,
  heavyBobRate: 2.1,
  heavyBobAmount: 0.018,
  normalWriggleXRate: 1.35,
  normalWriggleXAmount: 0.004,
  normalWriggleZRate: 1.1,
  normalWriggleZAmount: 0.002,
  heavyWriggleXRate: 1.55,
  heavyWriggleXAmount: 0.008,
  heavyWriggleZRate: 1.35,
  heavyWriggleZAmount: 0.004,
});

export const ATLAS_SPRITE_STRIDES = Object.freeze({
  motion: 4,
  kinematics: 4,
  traits: 4,
  feedback: 4,
  action: 2,
  compactBytesPerInstance: 72,
  dynamicBytesPerInstance: 56,
  staticBytesPerInstance: 16,
  legacyMatrixAndCellBytesPerInstance: 80
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (left, right, amount) => left + (right - left) * amount;
const positiveModulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function atlasMotionInterpolationDuration(baseStep, schedulerStride, matrixFrameInterval, alwaysUpdated = false) {
  const outerStep = Math.max(1 / 240, finite(baseStep, 1 / 30));
  const stride = alwaysUpdated ? 1 : Math.max(1, Math.floor(finite(schedulerStride, 1)));
  const frameEvery = Math.max(1, Math.floor(finite(matrixFrameInterval, 1)));
  const observationCalls = Math.ceil(stride / frameEvery) * frameEvery;
  return Math.max(outerStep, observationCalls * outerStep);
}

function checkedSlot(buffers, value) {
  const slot = Math.floor(Number(value));
  if (!Number.isFinite(slot) || slot < 0 || slot >= buffers.capacity) {
    throw new RangeError(`Atlas sprite slot ${value} is outside capacity ${buffers.capacity}.`);
  }
  return slot;
}

export function atlasSpriteTypeCode(value) {
  if (typeof value === 'string' && Object.hasOwn(ATLAS_SPRITE_TYPE, value)) {
    return ATLAS_SPRITE_TYPE[value];
  }
  return clamp(Math.floor(finite(value)), ATLAS_SPRITE_TYPE.normal, ATLAS_SPRITE_TYPE.mech);
}

export function createGpuAtlasSpriteBuffers(capacity) {
  const safeCapacity = Math.max(1, Math.floor(Number(capacity) || 1));
  const motion = new Float32Array(safeCapacity * ATLAS_SPRITE_STRIDES.motion);
  const kinematics = new Float32Array(safeCapacity * ATLAS_SPRITE_STRIDES.kinematics);
  const traits = new Float32Array(safeCapacity * ATLAS_SPRITE_STRIDES.traits);
  const feedback = new Float32Array(safeCapacity * ATLAS_SPRITE_STRIDES.feedback);
  const action = new Float32Array(safeCapacity * ATLAS_SPRITE_STRIDES.action);
  action.fill(-1000);
  return {
    capacity: safeCapacity,
    motion,
    kinematics,
    traits,
    feedback,
    action,
    byteLength: motion.byteLength + kinematics.byteLength + traits.byteLength + feedback.byteLength + action.byteLength,
    dynamicByteLength: motion.byteLength + kinematics.byteLength + feedback.byteLength + action.byteLength,
    staticByteLength: traits.byteLength
  };
}

export function writeGpuAtlasSpriteState(buffers, slotValue, state = {}) {
  const slot = checkedSlot(buffers, slotValue);
  writeGpuAtlasSpriteMovement(buffers, slot, state);
  writeGpuAtlasSpriteTraits(buffers, slot, state);
  writeGpuAtlasSpriteFeedback(buffers, slot, state);
  writeGpuAtlasSpriteAction(buffers, slot, state);
  return slot;
}

export function writeGpuAtlasSpriteMovement(buffers, slotValue, state = {}) {
  const slot = checkedSlot(buffers, slotValue);
  const offset = slot * 4;
  buffers.motion[offset] = finite(state.previousX, finite(state.targetX));
  buffers.motion[offset + 1] = finite(state.previousZ, finite(state.targetZ));
  buffers.motion[offset + 2] = finite(state.targetX);
  buffers.motion[offset + 3] = finite(state.targetZ);
  buffers.kinematics[offset] = finite(state.velocityX);
  buffers.kinematics[offset + 1] = finite(state.velocityZ);
  buffers.kinematics[offset + 2] = finite(state.motionStart);
  buffers.kinematics[offset + 3] = Math.max(0.001, finite(state.motionDuration, 0.001));
  return slot;
}

export function writeGpuAtlasSpriteTraits(buffers, slotValue, state = {}) {
  const slot = checkedSlot(buffers, slotValue);
  const offset = slot * 4;
  buffers.traits[offset] = finite(state.seed);
  const logicalType = clamp(Math.floor(finite(state.logicalType)), 0, 6);
  buffers.traits[offset + 1] = atlasSpriteTypeCode(state.type) + logicalType * 0.01;
  buffers.traits[offset + 2] = Math.max(0, finite(state.depthBias));
  buffers.traits[offset + 3] = finite(state.swarmPhase);
  return slot;
}

export function proceduralAttackPresentation(progress = 0, framesPerDirection = 1) {
  const p = clamp(finite(progress), 0, 1);
  const windupPhase = clamp(p / PROCEDURAL_ATTACK_PRESENTATION.windupEnd, 0, 1);
  const strikePhase = clamp(
    (p - PROCEDURAL_ATTACK_PRESENTATION.strikeStart)
      / (1 - PROCEDURAL_ATTACK_PRESENTATION.strikeStart),
    0,
    1,
  );
  const windup = Math.sin(windupPhase * Math.PI);
  const strike = Math.sin(strikePhase * Math.PI);
  const frameCount = Math.max(1, Math.floor(finite(framesPerDirection, 1)));
  let frame = 0;
  if (frameCount > 1) {
    if (p < PROCEDURAL_ATTACK_PRESENTATION.strikeFrameAt) frame = Math.min(frameCount - 1, 1);
    else if (p < PROCEDURAL_ATTACK_PRESENTATION.recoverFrameAt) {
      frame = Math.max(1, Math.round((frameCount - 1) * PROCEDURAL_ATTACK_PRESENTATION.strikeFrameFraction));
    } else frame = Math.min(frameCount - 1, 2);
  }
  return {
    progress: p,
    windup,
    strike,
    lunge: strike * PROCEDURAL_ATTACK_PRESENTATION.lunge
      - windup * PROCEDURAL_ATTACK_PRESENTATION.recoil,
    scaleX: 1 + windup * PROCEDURAL_ATTACK_PRESENTATION.windupScaleX
      - strike * PROCEDURAL_ATTACK_PRESENTATION.strikeScaleX,
    scaleY: 1 - windup * PROCEDURAL_ATTACK_PRESENTATION.windupScaleY
      + strike * PROCEDURAL_ATTACK_PRESENTATION.strikeScaleY,
    frame,
  };
}

export function attackReadabilityForPresentation(presentation = {}, active = true) {
  if (active !== true) return 0;
  return clamp(
    finite(presentation.windup) * 0.55 + finite(presentation.strike),
    0,
    1,
  );
}

export function writeGpuAtlasSpriteFeedback(buffers, slotValue, state = {}) {
  const slot = checkedSlot(buffers, slotValue);
  const offset = slot * 4;
  buffers.feedback[offset] = finite(state.lastHitTime, -1000);
  // -2 is an active planted idle, -1 is active locomotion, and 0..1 is the
  // authoritative dying progression. This preserves the compact 64-byte body.
  buffers.feedback[offset + 1] = clamp(finite(state.stateProgress, -1), -2, 1);
  buffers.feedback[offset + 2] = finite(state.facingVelocityX);
  buffers.feedback[offset + 3] = finite(state.facingVelocityZ);
  return slot;
}

export function writeGpuAtlasSpriteAction(buffers, slotValue, state = {}) {
  const slot = checkedSlot(buffers, slotValue);
  const offset = slot * ATLAS_SPRITE_STRIDES.action;
  buffers.action[offset] = finite(state.lastAttackTime, -1000);
  buffers.action[offset + 1] = finite(state.attackVariant);
  return slot;
}

export function atlasSpriteBufferByteAccounting(instanceCount) {
  const count = Math.max(0, Math.floor(Number(instanceCount) || 0));
  const compactDynamicBytes = count * ATLAS_SPRITE_STRIDES.dynamicBytesPerInstance;
  const compactStaticBytes = count * ATLAS_SPRITE_STRIDES.staticBytesPerInstance;
  const compactTotalBytes = compactDynamicBytes + compactStaticBytes;
  const legacyDynamicBytes = count * ATLAS_SPRITE_STRIDES.legacyMatrixAndCellBytesPerInstance;
  const dynamicSavingsBytes = legacyDynamicBytes - compactDynamicBytes;
  return {
    instanceCount: count,
    compactDynamicBytes,
    compactStaticBytes,
    compactTotalBytes,
    legacyDynamicBytes,
    totalSavingsBytes: legacyDynamicBytes - compactTotalBytes,
    dynamicSavingsBytes,
    totalSavingsRatio: legacyDynamicBytes > 0 ? (legacyDynamicBytes - compactTotalBytes) / legacyDynamicBytes : 0,
    dynamicSavingsRatio: legacyDynamicBytes > 0 ? dynamicSavingsBytes / legacyDynamicBytes : 0
  };
}

function animationRecord(meta, name) {
  const animations = Array.isArray(meta?.animations) ? meta.animations : [];
  return animations.find(record => record?.name === name) || null;
}

function projectionHeightFromBounds(meta) {
  const size = meta?.modelScale?.sourceBounds?.size;
  const frameWidth = finite(meta?.frameWidth);
  const frameHeight = finite(meta?.frameHeight);
  if (!Array.isArray(size) || size.length < 3 || frameWidth <= 0 || frameHeight <= 0) return 0;
  const x = Math.max(0, finite(size[0]));
  const y = Math.max(0, finite(size[1]));
  const z = Math.max(0, finite(size[2]));
  const aspect = frameWidth / frameHeight;
  return Math.max(0.1, y * 1.16, Math.hypot(x, z) / aspect * 1.16);
}

/** Orthographic camera span used when an atlas animation was baked. */
export function atlasAnimationProjectionHeight(meta, animation = 'run') {
  const record = animationRecord(meta, animation);
  const stored = finite(record?.projectionHeight);
  if (stored > 0) return stored;
  // Backward compatibility for single-animation atlases written before the
  // per-animation field existed. A multi-source state atlas must store each
  // clip because modelScale describes only its first animation source.
  if ((meta?.animations?.length || 0) <= 1 || record === meta?.animations?.[0]) {
    return projectionHeightFromBounds(meta);
  }
  return 0;
}

/** Draw-neutral scale that restores a state clip to its run-atlas projection. */
export function atlasStateProjectionScale(runMeta, stateMeta, animation) {
  // Apply correction only when both atlases explicitly record their bake
  // projection. Older bundles may have been authored under a different camera
  // rule, so reconstructing one side from bounds could introduce a new pop.
  const referenceHeight = finite(animationRecord(runMeta, 'run')?.projectionHeight);
  const stateHeight = finite(animationRecord(stateMeta, animation)?.projectionHeight);
  if (!(referenceHeight > 0) || !(stateHeight > 0)) return 1;
  return stateHeight / referenceHeight;
}

function normalizedBounds(record, frameWidth, frameHeight) {
  if (!record) return { minX: 0, minY: 0, maxX: 1, maxY: 1, anchorX: 0, anchorY: 0 };
  const pixelBounds = Number.isFinite(Number(record.xPx))
    || Number.isFinite(Number(record.yPx))
    || Number.isFinite(Number(record.widthPx))
    || Number.isFinite(Number(record.heightPx));
  const minX = pixelBounds ? finite(record.xPx) / frameWidth : finite(record.minX);
  const minY = pixelBounds ? finite(record.yPx) / frameHeight : finite(record.minY);
  const maxX = pixelBounds
    ? (finite(record.xPx) + finite(record.widthPx, frameWidth)) / frameWidth
    : finite(record.maxX, 1);
  const maxY = pixelBounds
    ? (finite(record.yPx) + finite(record.heightPx, frameHeight)) / frameHeight
    : finite(record.maxY, 1);
  const anchorX = Number.isFinite(Number(record.anchorXPx))
    ? Number(record.anchorXPx) / frameWidth
    : finite(record.anchorX);
  const anchorY = Number.isFinite(Number(record.anchorYPx))
    ? Number(record.anchorYPx) / frameHeight
    : finite(record.anchorY);
  return {
    minX: clamp(minX, 0, 1),
    minY: clamp(minY, 0, 1),
    maxX: clamp(Math.max(minX, maxX), 0, 1),
    maxY: clamp(Math.max(minY, maxY), 0, 1),
    anchorX,
    anchorY
  };
}

/**
 * Packs each direction/frame into three RGBA rows suitable for a tiny float
 * metadata texture:
 *   row 0: atlas UV rectangle (u, v, w, h)
 *   row 1: alpha trim in original top-left cell space (minX, minY, maxX, maxY)
 *   row 2: anchor offset in original plane space (x, y, 0, 0)
 */
export function buildAtlasFrameMetadata(meta, options = {}) {
  const animation = options.animation || 'run';
  const animationInfo = animationRecord(meta, animation);
  const directionCount = Math.max(1, Math.floor(finite(meta?.directionCount, 1)));
  const framesPerDirection = Math.max(1, Math.floor(finite(
    animationInfo?.framesPerDirection,
    meta?.framesPerDirection || 1
  )));
  const frameWidth = Math.max(1, finite(meta?.frameWidth, 1));
  const frameHeight = Math.max(1, finite(meta?.frameHeight, 1));
  const cellCount = directionCount * framesPerDirection;
  const textureRows = 3;
  const data = new Float32Array(cellCount * textureRows * 4);
  const frameRecords = Array.isArray(meta?.frameUVs) ? meta.frameUVs : [];
  const boundsRecords = Array.isArray(options.alphaBounds) ? options.alphaBounds : [];
  const frameByCell = new Array(cellCount);
  const boundsByCell = new Array(cellCount);

  for (const record of frameRecords) {
    if (record?.animation !== animation) continue;
    const direction = Math.floor(finite(record.direction, -1));
    const frame = Math.floor(finite(record.frameIndex, -1));
    if (direction < 0 || direction >= directionCount || frame < 0 || frame >= framesPerDirection) continue;
    frameByCell[frame * directionCount + direction] = record;
  }
  for (const record of boundsRecords) {
    if (record?.animation && record.animation !== animation) continue;
    const direction = Math.floor(finite(record.direction, -1));
    const frame = Math.floor(finite(record.frameIndex, -1));
    if (direction < 0 || direction >= directionCount || frame < 0 || frame >= framesPerDirection) continue;
    boundsByCell[frame * directionCount + direction] = record;
  }

  for (let frame = 0; frame < framesPerDirection; frame += 1) {
    for (let direction = 0; direction < directionCount; direction += 1) {
      const cell = frame * directionCount + direction;
      const frameRecord = frameByCell[cell];
      if (!frameRecord) throw new Error(`Missing ${animation} atlas cell direction=${direction} frame=${frame}.`);
      const uvOffset = cell * 4;
      data[uvOffset] = clamp(finite(frameRecord.u), 0, 1);
      data[uvOffset + 1] = clamp(finite(frameRecord.v), 0, 1);
      data[uvOffset + 2] = clamp(finite(frameRecord.w), 0, 1);
      data[uvOffset + 3] = clamp(finite(frameRecord.h), 0, 1);
      const trim = normalizedBounds(boundsByCell[cell], frameWidth, frameHeight);
      const trimOffset = (cellCount + cell) * 4;
      data[trimOffset] = trim.minX;
      data[trimOffset + 1] = trim.minY;
      data[trimOffset + 2] = trim.maxX;
      data[trimOffset + 3] = trim.maxY;
      const anchorOffset = (cellCount * 2 + cell) * 4;
      data[anchorOffset] = trim.anchorX;
      data[anchorOffset + 1] = trim.anchorY;
    }
  }
  return {
    animation,
    directionCount,
    framesPerDirection,
    fps: Math.max(1, finite(animationInfo?.fps, 12)),
    cellCount,
    textureWidth: cellCount,
    textureHeight: textureRows,
    data
  };
}

export function readAtlasFrameMetadata(frameMetadata, directionValue, frameValue, out = new Float32Array(12)) {
  const direction = positiveModulo(Math.floor(finite(directionValue)), frameMetadata.directionCount);
  const frame = positiveModulo(Math.floor(finite(frameValue)), frameMetadata.framesPerDirection);
  const cell = frame * frameMetadata.directionCount + direction;
  for (let row = 0; row < 3; row += 1) {
    const source = (row * frameMetadata.cellCount + cell) * 4;
    out.set(frameMetadata.data.subarray(source, source + 4), row * 4);
  }
  return out;
}

export function float32ToFloat16Bits(value) {
  const source = new Float32Array(1);
  const bits = new Uint32Array(source.buffer);
  source[0] = Number(value) || 0;
  const word = bits[0];
  const sign = (word >>> 16) & 0x8000;
  const exponent = ((word >>> 23) & 0xff) - 127 + 15;
  const mantissa = word & 0x7fffff;
  if (exponent <= 0) {
    if (exponent < -10) return sign;
    const subnormal = (mantissa | 0x800000) >>> (1 - exponent);
    return sign | ((subnormal + 0x1000) >>> 13);
  }
  if (exponent >= 31) {
    return sign | (mantissa ? 0x7e00 : 0x7c00);
  }
  return sign | (exponent << 10) | ((mantissa + 0x1000) >>> 13);
}

export function buildAtlasFrameTexturePayload(frameMetadata, textureType = 'float') {
  if (textureType === 'half-float') {
    const data = new Uint16Array(frameMetadata.data.length);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = float32ToFloat16Bits(frameMetadata.data[index]);
    }
    return { data, textureType: 'half-float', bytes: data.byteLength };
  }
  return {
    data: frameMetadata.data,
    textureType: 'float',
    bytes: frameMetadata.data.byteLength
  };
}

export function evaluateTrimmedFrameVertex(frameValues, uValue, vValue, out = {}) {
  const u = clamp(finite(uValue), 0, 1);
  const v = clamp(finite(vValue), 0, 1);
  const minX = frameValues[4];
  const minY = frameValues[5];
  const maxX = frameValues[6];
  const maxY = frameValues[7];
  const topLeftX = lerp(minX, maxX, u);
  const topLeftY = lerp(maxY, minY, v);
  out.localX = topLeftX - 0.5 + frameValues[8];
  out.localY = 0.5 - topLeftY + frameValues[9];
  out.atlasU = frameValues[0] + topLeftX * frameValues[2];
  out.atlasV = frameValues[1] + topLeftY * frameValues[3];
  return out;
}

export function atlasDirectionReference(input = {}) {
  const directionCount = Math.max(1, Math.floor(finite(input.directionCount, 8)));
  const type = atlasSpriteTypeCode(input.type);
  const x = finite(input.x);
  const z = finite(input.z);
  let velocityX = finite(input.facingVelocityX, finite(input.velocityX));
  let velocityZ = finite(input.facingVelocityZ, finite(input.velocityZ));
  const travel = Math.hypot(velocityX, velocityZ);

  if (type === ATLAS_SPRITE_TYPE.mech) {
    const corridorCenterX = finite(input.corridorCenterX);
    const intentX = clamp((corridorCenterX - x) * 0.16, -0.42, 0.42);
    const travelX = travel > 0.05 ? velocityX / travel : 0;
    const travelZ = travel > 0.05 ? velocityZ / travel : -1;
    const angle = Math.atan2(intentX * 0.78 + travelX * 0.22, -0.78 + travelZ * 0.22);
    return positiveModulo(Math.floor(positiveModulo(angle, Math.PI * 2) / (Math.PI * 2) * directionCount), directionCount);
  }
  if (z < finite(input.gateZ) + 14) return Math.floor(directionCount * 0.5) % directionCount;
  if (Math.abs(velocityX) + Math.abs(velocityZ) < 0.06) velocityZ = -1;
  if (directionCount === 8) {
    const absX = Math.abs(velocityX);
    const absZ = Math.abs(velocityZ);
    if (absX < absZ * 0.4142) return velocityZ >= 0 ? 0 : 4;
    if (absZ < absX * 0.4142) return velocityX >= 0 ? 2 : 6;
    if (velocityX >= 0) return velocityZ >= 0 ? 1 : 3;
    return velocityZ >= 0 ? 7 : 5;
  }
  const angle = Math.atan2(velocityX, velocityZ);
  return positiveModulo(Math.floor(positiveModulo(angle, Math.PI * 2) / (Math.PI * 2) * directionCount), directionCount);
}

export function atlasAnimationFrameReference(input = {}) {
  const frameCount = Math.max(1, Math.floor(finite(input.framesPerDirection, 1)));
  const fps = Math.min(GROUNDED_ENEMY_MOTION.maximumAnimationFps, Math.max(1, finite(input.fps, 12)));
  const seed = finite(input.seed);
  const speed = Math.hypot(finite(input.velocityX), finite(input.velocityZ));
  const depth = clamp(
    (finite(input.z) - finite(input.gateZ)) / Math.max(1, finite(input.spawnMaxZ) - finite(input.gateZ)),
    0,
    1
  );
  const distanceRate = lerp(
    GROUNDED_ENEMY_MOTION.nearAnimationRate,
    GROUNDED_ENEMY_MOTION.farAnimationRate,
    depth
  );
  const locomotionRate = speed < 0.2
    ? GROUNDED_ENEMY_MOTION.plantedFallbackFps / fps
    : 1;
  const type = atlasSpriteTypeCode(input.type);
  let rate = distanceRate * locomotionRate;
  let phase = seed * 13.37;
  if (type === ATLAS_SPRITE_TYPE.jetpack) return 0;
  if (type === ATLAS_SPRITE_TYPE.brute) {
    rate *= 0.82;
  } else if (type === ATLAS_SPRITE_TYPE.powder) {
    rate *= clamp(0.8 + speed / 11, 0.9, 2.1);
    phase = seed * 11.73;
  }
  return positiveModulo(Math.floor(finite(input.time) * fps * rate + phase), frameCount);
}

export function evaluateGpuAtlasSpriteReference(input = {}, out = {}) {
  const duration = Math.max(0.001, finite(input.motionDuration, 0.001));
  const motionAlpha = clamp((finite(input.time) - finite(input.motionStart)) / duration, 0, 1);
  const logicalX = lerp(finite(input.previousX, input.targetX), finite(input.targetX), motionAlpha);
  const logicalZ = lerp(finite(input.previousZ, input.targetZ), finite(input.targetZ), motionAlpha);
  const velocityX = finite(input.velocityX);
  const velocityZ = finite(input.velocityZ);
  const speed = Math.hypot(velocityX, velocityZ);
  const seed = finite(input.seed);
  const time = finite(input.time);
  const type = atlasSpriteTypeCode(input.type);
  const mobile = input.mobile === true;
  const isBrute = type === ATLAS_SPRITE_TYPE.brute;
  const isPowder = type === ATLAS_SPRITE_TYPE.powder;
  const isShield = type === ATLAS_SPRITE_TYPE.shield;
  const isJetpack = type === ATLAS_SPRITE_TYPE.jetpack;
  const isMech = type === ATLAS_SPRITE_TYPE.mech;
  const logicalType = clamp(Math.floor(finite(input.logicalType)), 0, 6);
  const encodedStateProgress = clamp(finite(input.stateProgress, -1), -2, 1);
  const waiting = encodedStateProgress < -1.5;
  const dying = encodedStateProgress >= 0;
  const deathProgress = dying ? encodedStateProgress : 0;
  const lastHitTime = finite(input.lastHitTime, -1000);
  const feedbackTime = finite(input.feedbackTime, time);
  const hitAge = Math.max(0, feedbackTime - lastHitTime);
  const hitT = clamp(hitAge / ENEMY_HIT_FLASH_SECONDS, 0, 1);
  const hitFlash = lastHitTime > -999 ? 1 - hitT * hitT * (3 - 2 * hitT) : 0;
  const lastAttackTime = finite(input.lastAttackTime, -1000);
  const attackAge = Math.max(0, feedbackTime - lastAttackTime);
  const hasStateAnimations = input.hasStateAnimations === true;
  const hasIdleAnimation = input.hasIdleAnimation === true;
  const authoredDeath = hasStateAnimations && dying;
  const authoredHit = hasStateAnimations && !dying
    && lastHitTime > -999 && hitAge < ENEMY_HIT_ANIMATION_SECONDS;
  const authoredAttack = hasStateAnimations && !dying && !authoredHit
    && lastAttackTime > -999 && attackAge < ENEMY_ATTACK_ANIMATION_SECONDS;
  const proceduralAttack = !hasStateAnimations && !dying
    && lastAttackTime > -999 && attackAge < ENEMY_ATTACK_ANIMATION_SECONDS;
  const attackProgress = clamp(attackAge / ENEMY_ATTACK_ANIMATION_SECONDS, 0, 1);
  const attackPresentation = proceduralAttackPresentation(
    attackProgress,
    finite(input.framesPerDirection, 1),
  );
  const attackReadability = attackReadabilityForPresentation(
    attackPresentation,
    authoredAttack || proceduralAttack,
  );
  const authoredState = authoredDeath ? 'death' : authoredHit ? 'hit' : authoredAttack ? 'attack' : null;
  const authoredProjectionScale = authoredState === 'death'
    ? Math.max(0.001, finite(input.deathProjectionScale, 1))
    : authoredState === 'hit'
      ? Math.max(0.001, finite(input.hitProjectionScale, 1))
      : authoredState === 'attack'
        ? Math.max(0.001, finite(input.attackProjectionScale, 1))
        : 1;
  const groundedMotion = clamp(speed / 0.6, 0, 1);
  const plantedMotion = waiting ? 0 : 1;
  const bob = Math.sin(time * (
    isJetpack ? 7.5
      : isPowder ? 11
        : isBrute || isMech ? GROUNDED_ENEMY_MOTION.heavyBobRate : GROUNDED_ENEMY_MOTION.normalBobRate
  ) + seed)
    * (isJetpack ? 0.18
      : isPowder ? 0.075
        : isBrute || isMech ? GROUNDED_ENEMY_MOTION.heavyBobAmount : GROUNDED_ENEMY_MOTION.normalBobAmount)
    * (isJetpack || isPowder ? 1 : groundedMotion)
    * plantedMotion;
  const wriggleX = Math.sin(
    time * (isPowder ? 5.2
      : isJetpack ? 2.2
        : isBrute || isMech ? GROUNDED_ENEMY_MOTION.heavyWriggleXRate : GROUNDED_ENEMY_MOTION.normalWriggleXRate)
    + seed * (isBrute || isMech ? 3.6 : 4.1)
    + finite(input.swarmPhase)
  ) * (isPowder ? 0.16
    : isJetpack ? 0.055
      : isBrute || isMech ? GROUNDED_ENEMY_MOTION.heavyWriggleXAmount : GROUNDED_ENEMY_MOTION.normalWriggleXAmount)
    * (isPowder || isJetpack ? 1 : groundedMotion)
    * plantedMotion;
  const wriggleZ = Math.cos(
    time * (isPowder ? 4.6
      : isJetpack ? 1.9
        : isBrute || isMech ? GROUNDED_ENEMY_MOTION.heavyWriggleZRate : GROUNDED_ENEMY_MOTION.normalWriggleZRate)
    + seed * (isBrute || isMech ? 2.2 : 2.7)
    + finite(input.swarmPhase) * (isBrute || isMech ? 0.9 : 0.7)
  ) * (isPowder ? 0.08
    : isJetpack ? 0.035
      : isBrute || isMech ? GROUNDED_ENEMY_MOTION.heavyWriggleZAmount : GROUNDED_ENEMY_MOTION.normalWriggleZAmount)
    * (isPowder || isJetpack ? 1 : groundedMotion)
    * plantedMotion;
  let visualScale;
  if (isMech) visualScale = 1;
  else if (isJetpack) visualScale = mobile ? 0.92 : 1.02;
  else if (isShield) visualScale = mobile ? 0.9 : 1.04;
  else if (isBrute) visualScale = (mobile ? 1.08 : 1.28) * Math.max(0.001, finite(input.bruteVisualScale, input.typeScale || 1));
  else if (isPowder) visualScale = mobile ? 1.12 : 1.04;
  else {
    const statureNoise = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    const statureHash = ((statureNoise % 1) + 1) % 1;
    const stableStature = 0.88 + 0.24 * statureHash;
    visualScale = (mobile ? 0.95 : 1)
      * stableStature
      * (1 + Math.min(0.08, speed * 0.01));
  }
  const logicalScaleX = logicalType >= 5 ? 3.4 / 1.5 : 1;
  const logicalScaleY = logicalType >= 5 ? 4.6 / 2.25 : 1;
  const fixedScale = isBrute || isPowder || isShield || isJetpack || isMech;
  const baseScaleY = Math.max(0.001,
    finite(input.displayHeight, 1)
    * finite(input.frameScale, 1)
    * visualScale
  );
  const cameraDistance = Math.hypot(
    logicalX - finite(input.cameraX),
    baseScaleY * 0.5 - finite(input.cameraY),
    logicalZ - finite(input.cameraZ),
  );
  const farReadability = mobile
    ? GROUNDED_ENEMY_MOTION.farReadabilityMobile
    : GROUNDED_ENEMY_MOTION.farReadabilityDesktop;
  const distanceReadability = lerp(1, farReadability, clamp((cameraDistance - 55) / 60, 0, 1));
  const proceduralDeathProgress = authoredDeath ? 0 : deathProgress;
  let scaleX = Math.max(0.001,
    finite(input.displayWidth, 1) * finite(input.frameScale, 1) * visualScale * logicalScaleX * distanceReadability
      * (1 + proceduralDeathProgress * 0.18)
  );
  let scaleY = Math.max(0.001,
    baseScaleY * logicalScaleY * distanceReadability * (1 - proceduralDeathProgress * 0.72)
  );
  if (proceduralAttack) {
    scaleX *= attackPresentation.scaleX;
    scaleY *= attackPresentation.scaleY;
  }
  scaleX *= authoredProjectionScale;
  scaleY *= authoredProjectionScale;
  const lifeMotion = 1 - proceduralDeathProgress;
  const flightY = (isJetpack
    ? sporewingFlightOffsetAtGate(logicalZ, finite(input.gateZ))
      + Math.sin(time * 1.9 + seed) * 0.38
    : 0) * lifeMotion;
  const deathDrop = proceduralDeathProgress * 0.38;
  const facingVelocityX = finite(input.facingVelocityX, velocityX);
  const facingVelocityZ = finite(input.facingVelocityZ, velocityZ);
  const facingLength = Math.hypot(facingVelocityX, facingVelocityZ);
  const attackLunge = proceduralAttack ? attackPresentation.lunge : 0;
  const attackOffsetX = facingLength > 0.001 ? facingVelocityX / facingLength * attackLunge : 0;
  const attackOffsetZ = facingLength > 0.001 ? facingVelocityZ / facingLength * attackLunge : -attackLunge;
  let centerX = logicalX + wriggleX * lifeMotion + attackOffsetX;
  let centerY = scaleY * 0.5 + bob * lifeMotion + flightY - deathDrop;
  let centerZ = logicalZ + wriggleZ * lifeMotion + attackOffsetZ;
  const cameraX = finite(input.cameraX);
  const cameraY = finite(input.cameraY);
  const cameraZ = finite(input.cameraZ);
  let dx = centerX - cameraX;
  let dy = centerY - cameraY;
  let dz = centerZ - cameraZ;
  const viewLength = Math.max(0.001, Math.hypot(dx, dy, dz));
  const nx = dx / viewLength;
  const ny = dy / viewLength;
  const nz = dz / viewLength;
  const depthBias = Math.max(0, finite(input.depthBias));
  centerX -= nx * depthBias;
  centerY -= ny * depthBias;
  centerZ -= nz * depthBias;
  const horizontal = Math.hypot(nx, nz);
  const rightX = horizontal > 0.001 ? nz / horizontal : 1;
  const rightZ = horizontal > 0.001 ? -nx / horizontal : 0;
  // First-person cameras can pitch steeply. Keep feet anchored and bodies
  // vertical instead of letting spherical billboards lean toward the camera.
  const upX = 0;
  const upY = 1;
  const upZ = 0;
  const direction = atlasDirectionReference({...input, x: logicalX, z: logicalZ});
  let frame = waiting && !hasIdleAnimation
    ? 0
    : atlasAnimationFrameReference({...input, z: logicalZ});
  if (proceduralAttack) {
    frame = attackPresentation.frame;
  }

  Object.assign(out, {
    motionAlpha, logicalX, logicalZ, speed, bob, wriggleX, wriggleZ, visualScale,
    logicalType, logicalScaleX, logicalScaleY, distanceReadability,
    waiting, dying, deathProgress, proceduralDeathProgress, deathDrop, hitAge, hitFlash,
    attackAge, attackProgress, attackReadability, authoredState, authoredProjectionScale, proceduralAttack, attackLunge,
    attackWindup: attackPresentation.windup, attackStrike: attackPresentation.strike,
    scaleX, scaleY, flightY, centerX, centerY, centerZ,
    rightX, rightY: 0, rightZ, upX, upY, upZ,
    direction, frame,
    cellIndex: frame * Math.max(1, Math.floor(finite(input.directionCount, 8))) + direction
  });
  return out;
}

export function buildGpuAtlasSpriteShaderSources(options = {}) {
  const corridorCenterExpression = options.corridorCenterExpression || '0.0';
  const vertex = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
attribute vec4 spriteMotion;
attribute vec4 spriteKinematics;
attribute vec4 spriteTraits;
attribute vec4 spriteFeedback;
attribute vec2 spriteAction;
uniform mat4 viewProjection;
uniform vec3 cameraPosition;
uniform float visualTime;
uniform float feedbackTime;
uniform float gateZ;
uniform float spawnMaxZ;
uniform float directionCount;
uniform float framesPerDirection;
uniform float animationFps;
uniform float frameMetaWidth;
uniform float idleFramesPerDirection;
uniform float idleAnimationFps;
uniform float idleFrameMetaWidth;
uniform float hasIdleAnimation;
uniform float hasStateAnimations;
uniform float attackFramesPerDirection;
uniform float hitFramesPerDirection;
uniform float deathFramesPerDirection;
uniform float attackFrameMetaWidth;
uniform float hitFrameMetaWidth;
uniform float deathFrameMetaWidth;
uniform float attackProjectionScale;
uniform float hitProjectionScale;
uniform float deathProjectionScale;
uniform float stressMode;
uniform float mobileMode;
uniform float displayWidth;
uniform float displayHeight;
uniform float frameScale;
uniform float bruteVisualScale;
uniform sampler2D frameMetaSampler;
uniform sampler2D idleFrameMetaSampler;
uniform sampler2D attackFrameMetaSampler;
uniform sampler2D hitFrameMetaSampler;
uniform sampler2D deathFrameMetaSampler;
varying vec2 vUV;
varying float vHitFlash;
varying float vDeathProgress;
varying float vUseStateAtlas;
varying float vAttackReadability;

float saturate(float value) { return clamp(value, 0.0, 1.0); }
float corridorCenterAt(float worldZ) { return ${corridorCenterExpression}; }
vec4 frameMeta(float cell, float row) {
  return texture2D(frameMetaSampler, vec2((cell + 0.5) / frameMetaWidth, (row + 0.5) / 3.0));
}
vec4 idleFrameMeta(float cell, float row) {
  return texture2D(idleFrameMetaSampler, vec2((cell + 0.5) / idleFrameMetaWidth, (row + 0.5) / 3.0));
}
vec4 attackFrameMeta(float cell, float row) {
  return texture2D(attackFrameMetaSampler, vec2((cell + 0.5) / attackFrameMetaWidth, (row + 0.5) / 3.0));
}
vec4 hitFrameMeta(float cell, float row) {
  return texture2D(hitFrameMetaSampler, vec2((cell + 0.5) / hitFrameMetaWidth, (row + 0.5) / 3.0));
}
vec4 deathFrameMeta(float cell, float row) {
  return texture2D(deathFrameMetaSampler, vec2((cell + 0.5) / deathFrameMetaWidth, (row + 0.5) / 3.0));
}
float directionFor(vec2 worldXZ, vec2 velocity, float typeCode) {
  float travel = length(velocity);
  if (typeCode > 4.5) {
    float intentX = clamp((corridorCenterAt(worldXZ.y) - worldXZ.x) * 0.16, -0.42, 0.42);
    vec2 travelDirection = travel > 0.05 ? velocity / travel : vec2(0.0, -1.0);
    float angle = atan(intentX * 0.78 + travelDirection.x * 0.22, -0.78 + travelDirection.y * 0.22);
    return mod(floor(mod(angle + 6.28318530718, 6.28318530718) / 6.28318530718 * directionCount), directionCount);
  }
  if (worldXZ.y < gateZ + 14.0) return mod(floor(directionCount * 0.5), directionCount);
  if (abs(velocity.x) + abs(velocity.y) < 0.06) velocity = vec2(0.0, -1.0);
  if (abs(directionCount - 8.0) < 0.5) {
    float absX = abs(velocity.x);
    float absZ = abs(velocity.y);
    if (absX < absZ * 0.4142) return velocity.y >= 0.0 ? 0.0 : 4.0;
    if (absZ < absX * 0.4142) return velocity.x >= 0.0 ? 2.0 : 6.0;
    if (velocity.x >= 0.0) return velocity.y >= 0.0 ? 1.0 : 3.0;
    return velocity.y >= 0.0 ? 7.0 : 5.0;
  }
  float angle = atan(velocity.x, velocity.y);
  return mod(floor(mod(angle + 6.28318530718, 6.28318530718) / 6.28318530718 * directionCount), directionCount);
}
float frameFor(vec2 worldXZ, vec2 velocity, float seed, float typeCode) {
  float rate = 1.0;
  float phase = seed * 13.37;
  float speed = length(velocity);
  if (typeCode > 3.5 && typeCode < 4.5) return 0.0;
  if (speed < 0.2) rate = ${GROUNDED_ENEMY_MOTION.plantedFallbackFps.toFixed(1)} / max(1.0, animationFps);
  if (typeCode > 0.5 && typeCode < 1.5) {
    rate *= 0.82;
  } else if (typeCode > 1.5 && typeCode < 2.5) {
    rate *= clamp(0.8 + speed / 11.0, 0.9, 2.1);
    phase = seed * 11.73;
  }
  return mod(floor(visualTime * animationFps * rate + phase), framesPerDirection);
}

float sporewingFlightOffset(float worldZ) {
  return mix(
    ${SPOREWING_GATE_CLEARANCE_Y.toFixed(2)},
    ${SPOREWING_BASE_FLIGHT_Y.toFixed(2)},
    smoothstep(0.0, ${SPOREWING_GATE_CLIMB_DISTANCE.toFixed(2)}, abs(worldZ - gateZ))
  );
}

void main(void) {
  float typeCode = floor(spriteTraits.y + 0.5);
  float logicalType = floor(fract(spriteTraits.y) * 100.0 + 0.5);
  float motionAlpha = saturate((visualTime - spriteKinematics.z) / max(0.001, spriteKinematics.w));
  vec2 logicalXZ = mix(spriteMotion.xy, spriteMotion.zw, motionAlpha);
  vec2 velocity = spriteKinematics.xy;
  float speed = length(velocity);
  float seed = spriteTraits.x;
  float encodedStateProgress = clamp(spriteFeedback.y, -2.0, 1.0);
  float waiting = 1.0 - step(-1.5, encodedStateProgress);
  float deathProgress = encodedStateProgress < 0.0 ? 0.0 : encodedStateProgress;
  float hitAge = max(0.0, feedbackTime - spriteFeedback.x);
  float hitFlash = spriteFeedback.x > -999.0
    ? 1.0 - smoothstep(0.0, ${ENEMY_HIT_FLASH_SECONDS.toFixed(2)}, hitAge)
    : 0.0;
  float attackAge = max(0.0, feedbackTime - spriteAction.x);
  float useDeathState = hasStateAnimations * step(0.0, encodedStateProgress);
  float useHitState = hasStateAnimations * (1.0 - useDeathState)
    * step(-999.0, spriteFeedback.x)
    * (1.0 - step(${ENEMY_HIT_ANIMATION_SECONDS.toFixed(2)}, hitAge));
  float useAttackState = hasStateAnimations * (1.0 - useDeathState) * (1.0 - useHitState)
    * step(-999.0, spriteAction.x)
    * (1.0 - step(${ENEMY_ATTACK_ANIMATION_SECONDS.toFixed(2)}, attackAge));
  float proceduralAttack = (1.0 - hasStateAnimations) * (1.0 - step(0.0, encodedStateProgress))
    * step(-999.0, spriteAction.x)
    * (1.0 - step(${ENEMY_ATTACK_ANIMATION_SECONDS.toFixed(2)}, attackAge));
  float attackProgress = saturate(attackAge / ${ENEMY_ATTACK_ANIMATION_SECONDS.toFixed(2)});
  float useStateAtlas = min(1.0, useDeathState + useHitState + useAttackState);
  float stateProjectionScale = mix(attackProjectionScale, hitProjectionScale, useHitState);
  stateProjectionScale = mix(stateProjectionScale, deathProjectionScale, useDeathState);
  stateProjectionScale = mix(1.0, stateProjectionScale, useStateAtlas);
  float proceduralDeathProgress = deathProgress * (1.0 - useDeathState);
  float isBrute = step(0.5, typeCode) * (1.0 - step(1.5, typeCode));
  float isPowder = step(1.5, typeCode) * (1.0 - step(2.5, typeCode));
  float isShield = step(2.5, typeCode) * (1.0 - step(3.5, typeCode));
  float isJetpack = step(3.5, typeCode) * (1.0 - step(4.5, typeCode));
  float isMech = step(4.5, typeCode);
  float isHeavy = min(1.0, isBrute + isMech);
  float groundedMotion = clamp(speed / 0.6, 0.0, 1.0);
  float plantedMotion = 1.0 - waiting;
  float bobRate = isJetpack > 0.5 ? 7.5 : isPowder > 0.5 ? 11.0
    : isHeavy > 0.5 ? ${GROUNDED_ENEMY_MOTION.heavyBobRate.toFixed(1)} : ${GROUNDED_ENEMY_MOTION.normalBobRate.toFixed(2)};
  float bobAmount = isJetpack > 0.5 ? 0.18 : isPowder > 0.5 ? 0.075
    : isHeavy > 0.5 ? ${GROUNDED_ENEMY_MOTION.heavyBobAmount.toFixed(3)} : ${GROUNDED_ENEMY_MOTION.normalBobAmount.toFixed(3)};
  float bob = sin(visualTime * bobRate + seed) * bobAmount
    * mix(groundedMotion, 1.0, min(1.0, isJetpack + isPowder)) * plantedMotion;
  float wriggleX = sin(visualTime * (isPowder > 0.5 ? 5.2 : isJetpack > 0.5 ? 2.2
      : isHeavy > 0.5 ? ${GROUNDED_ENEMY_MOTION.heavyWriggleXRate.toFixed(2)} : ${GROUNDED_ENEMY_MOTION.normalWriggleXRate.toFixed(2)})
    + seed * (isHeavy > 0.5 ? 3.6 : 4.1) + spriteTraits.w)
    * (isPowder > 0.5 ? 0.16 : isJetpack > 0.5 ? 0.055
      : isHeavy > 0.5 ? ${GROUNDED_ENEMY_MOTION.heavyWriggleXAmount.toFixed(3)} : ${GROUNDED_ENEMY_MOTION.normalWriggleXAmount.toFixed(3)})
    * mix(groundedMotion, 1.0, min(1.0, isPowder + isJetpack)) * plantedMotion;
  float wriggleZ = cos(visualTime * (isPowder > 0.5 ? 4.6 : isJetpack > 0.5 ? 1.9
      : isHeavy > 0.5 ? ${GROUNDED_ENEMY_MOTION.heavyWriggleZRate.toFixed(2)} : ${GROUNDED_ENEMY_MOTION.normalWriggleZRate.toFixed(2)})
    + seed * (isHeavy > 0.5 ? 2.2 : 2.7) + spriteTraits.w * (isHeavy > 0.5 ? 0.9 : 0.7))
    * (isPowder > 0.5 ? 0.08 : isJetpack > 0.5 ? 0.035
      : isHeavy > 0.5 ? ${GROUNDED_ENEMY_MOTION.heavyWriggleZAmount.toFixed(3)} : ${GROUNDED_ENEMY_MOTION.normalWriggleZAmount.toFixed(3)})
    * mix(groundedMotion, 1.0, min(1.0, isPowder + isJetpack)) * plantedMotion;
  float stableStature = mix(0.88, 1.12, fract(sin(seed * 12.9898 + 78.233) * 43758.5453));
  float normalScale = mix(1.0, 0.95, mobileMode)
    * stableStature
    * (1.0 + min(0.08, speed * 0.01));
  float visualScale = normalScale;
  if (isBrute > 0.5) visualScale = mix(1.28, 1.08, mobileMode) * bruteVisualScale;
  else if (isPowder > 0.5) visualScale = mix(1.04, 1.12, mobileMode);
  else if (isShield > 0.5) visualScale = mix(1.04, 0.9, mobileMode);
  else if (isJetpack > 0.5) visualScale = mix(1.02, 0.92, mobileMode);
  else if (isMech > 0.5) visualScale = 1.0;
  float fixedScale = min(1.0, isBrute + isPowder + isShield + isJetpack + isMech);
  float scaleX = displayWidth * frameScale * visualScale;
  float scaleY = displayHeight * frameScale * visualScale;
  float flightY = isJetpack > 0.5
    ? sporewingFlightOffset(logicalXZ.y) + sin(visualTime * 1.9 + seed) * 0.38
    : 0.0;
  vec2 facingVelocity = length(spriteFeedback.zw) >= 0.06 ? spriteFeedback.zw : velocity;
  vec2 attackDirection = length(facingVelocity) > 0.001 ? normalize(facingVelocity) : vec2(0.0, -1.0);
  float attackWindupPhase = clamp(attackProgress / ${PROCEDURAL_ATTACK_PRESENTATION.windupEnd.toFixed(2)}, 0.0, 1.0);
  float attackStrikePhase = clamp((attackProgress - ${PROCEDURAL_ATTACK_PRESENTATION.strikeStart.toFixed(2)}) / ${(1 - PROCEDURAL_ATTACK_PRESENTATION.strikeStart).toFixed(2)}, 0.0, 1.0);
  float attackWindup = sin(attackWindupPhase * 3.14159265359);
  float attackStrike = sin(attackStrikePhase * 3.14159265359);
  float attackActive = max(useAttackState, proceduralAttack);
  float attackReadability = attackActive
    * clamp(attackWindup * 0.55 + attackStrike, 0.0, 1.0);
  float attackLunge = (attackStrike * ${PROCEDURAL_ATTACK_PRESENTATION.lunge.toFixed(3)}
    - attackWindup * ${PROCEDURAL_ATTACK_PRESENTATION.recoil.toFixed(3)}) * proceduralAttack;
  float attackScaleX = 1.0 + (attackWindup * ${PROCEDURAL_ATTACK_PRESENTATION.windupScaleX.toFixed(3)}
    - attackStrike * ${PROCEDURAL_ATTACK_PRESENTATION.strikeScaleX.toFixed(3)}) * proceduralAttack;
  float attackScaleY = 1.0 + (-attackWindup * ${PROCEDURAL_ATTACK_PRESENTATION.windupScaleY.toFixed(3)}
    + attackStrike * ${PROCEDURAL_ATTACK_PRESENTATION.strikeScaleY.toFixed(3)}) * proceduralAttack;
  vec3 center = vec3(
    logicalXZ.x + wriggleX + attackDirection.x * attackLunge,
    scaleY * 0.5 + bob + flightY,
    logicalXZ.y + wriggleZ + attackDirection.y * attackLunge
  );
  float cameraDistance = length(center - cameraPosition);
  float farReadability = mix(
    ${GROUNDED_ENEMY_MOTION.farReadabilityDesktop.toFixed(2)},
    ${GROUNDED_ENEMY_MOTION.farReadabilityMobile.toFixed(2)},
    mobileMode
  );
  float distanceReadability = mix(1.0, farReadability, smoothstep(55.0, 115.0, cameraDistance));
  if (logicalType > 4.5) {
    scaleX *= 2.2666667;
    scaleY *= 2.0444444;
  }
  scaleX *= distanceReadability;
  scaleY *= distanceReadability;
  scaleX *= stateProjectionScale;
  scaleY *= stateProjectionScale;
  scaleX *= 1.0 + proceduralDeathProgress * 0.18;
  scaleY *= 1.0 - proceduralDeathProgress * 0.72;
  scaleX *= attackScaleX;
  scaleY *= attackScaleY;
  float lifeMotion = 1.0 - proceduralDeathProgress;
  center.x = logicalXZ.x + wriggleX * lifeMotion + attackDirection.x * attackLunge;
  center.z = logicalXZ.y + wriggleZ * lifeMotion + attackDirection.y * attackLunge;
  center.y = scaleY * 0.5 + bob * lifeMotion + flightY * lifeMotion - proceduralDeathProgress * 0.38;
  vec3 viewDirection = normalize(center - cameraPosition);
  center -= viewDirection * spriteTraits.z;
  float horizontal = length(viewDirection.xz);
  vec3 right = horizontal > 0.001
    ? vec3(viewDirection.z / horizontal, 0.0, -viewDirection.x / horizontal)
    : vec3(1.0, 0.0, 0.0);
  vec3 up = vec3(0.0, 1.0, 0.0);
  float direction = directionFor(logicalXZ, facingVelocity, typeCode);
  float useIdle = waiting * hasIdleAnimation * (1.0 - isJetpack);
  float runFrame = mix(
    frameFor(logicalXZ, velocity, seed, typeCode),
    0.0,
    waiting * (1.0 - hasIdleAnimation)
  );
  float idleFrame = mod(floor(visualTime * idleAnimationFps * ${GROUNDED_ENEMY_MOTION.idleAnimationRate.toFixed(2)} + seed * 5.73), idleFramesPerDirection);
  float frame = mix(runFrame, idleFrame, useIdle);
  float fallbackWindupFrame = min(framesPerDirection - 1.0, 1.0);
  float fallbackStrikeFrame = max(1.0, floor((framesPerDirection - 1.0) * ${PROCEDURAL_ATTACK_PRESENTATION.strikeFrameFraction.toFixed(2)} + 0.5));
  float fallbackRecoverFrame = min(framesPerDirection - 1.0, 2.0);
  float fallbackAttackFrame = mix(
    fallbackWindupFrame,
    fallbackStrikeFrame,
    step(${PROCEDURAL_ATTACK_PRESENTATION.strikeFrameAt.toFixed(2)}, attackProgress)
  );
  fallbackAttackFrame = mix(
    fallbackAttackFrame,
    fallbackRecoverFrame,
    step(${PROCEDURAL_ATTACK_PRESENTATION.recoverFrameAt.toFixed(2)}, attackProgress)
  );
  frame = mix(frame, fallbackAttackFrame, proceduralAttack);
  float cell = frame * directionCount + direction;
  vec4 uvRect = mix(frameMeta(cell, 0.0), idleFrameMeta(cell, 0.0), useIdle);
  vec4 trim = mix(frameMeta(cell, 1.0), idleFrameMeta(cell, 1.0), useIdle);
  vec2 anchor = mix(frameMeta(cell, 2.0).xy, idleFrameMeta(cell, 2.0).xy, useIdle);
  float hitProgress = saturate(hitAge / ${ENEMY_HIT_ANIMATION_SECONDS.toFixed(2)});
  float attackStateFrame = floor(attackProgress * max(0.0, attackFramesPerDirection - 1.0) + 0.0001);
  float hitStateFrame = floor(hitProgress * max(0.0, hitFramesPerDirection - 1.0) + 0.0001);
  float deathStateFrame = floor(deathProgress * max(0.0, deathFramesPerDirection - 1.0) + 0.0001);
  float attackCell = attackStateFrame * directionCount + direction;
  float hitCell = hitStateFrame * directionCount + direction;
  float deathCell = deathStateFrame * directionCount + direction;
  vec4 stateUVRect = mix(attackFrameMeta(attackCell, 0.0), hitFrameMeta(hitCell, 0.0), useHitState);
  stateUVRect = mix(stateUVRect, deathFrameMeta(deathCell, 0.0), useDeathState);
  vec4 stateTrim = mix(attackFrameMeta(attackCell, 1.0), hitFrameMeta(hitCell, 1.0), useHitState);
  stateTrim = mix(stateTrim, deathFrameMeta(deathCell, 1.0), useDeathState);
  vec2 stateAnchor = mix(attackFrameMeta(attackCell, 2.0).xy, hitFrameMeta(hitCell, 2.0).xy, useHitState);
  stateAnchor = mix(stateAnchor, deathFrameMeta(deathCell, 2.0).xy, useDeathState);
  uvRect = mix(uvRect, stateUVRect, useStateAtlas);
  trim = mix(trim, stateTrim, useStateAtlas);
  anchor = mix(anchor, stateAnchor, useStateAtlas);
  vec2 topLeft = vec2(mix(trim.x, trim.z, uv.x), mix(trim.w, trim.y, uv.y));
  vec2 local = vec2(topLeft.x - 0.5, 0.5 - topLeft.y) + anchor;
  vec3 worldPosition = center + right * local.x * scaleX + up * local.y * scaleY;
  gl_Position = viewProjection * vec4(worldPosition, 1.0);
  vUV = uvRect.xy + topLeft * uvRect.zw;
  vHitFlash = hitFlash;
  vDeathProgress = deathProgress;
  vUseStateAtlas = useStateAtlas;
  vAttackReadability = attackReadability;
}`;
  const fragment = `
precision highp float;
uniform sampler2D atlasSampler;
uniform sampler2D stateAtlasSampler;
uniform float alphaCutoff;
uniform float brightness;
varying vec2 vUV;
varying float vHitFlash;
varying float vDeathProgress;
varying float vUseStateAtlas;
varying float vAttackReadability;
void main(void) {
  vec4 color = vUseStateAtlas > 0.5
    ? texture2D(stateAtlasSampler, vUV)
    : texture2D(atlasSampler, vUV);
  if (color.a < alphaCutoff) discard;
  vec3 graded = color.rgb * brightness;
  float luminance = dot(graded, vec3(0.2126, 0.7152, 0.0722));
  float attackSapPixel = clamp((luminance - 0.24) * 2.0, 0.0, 1.0);
  float attackSapResponse = clamp(vAttackReadability, 0.0, 1.0)
    * (0.24 + 0.76 * attackSapPixel);
  graded *= mix(vec3(1.0), vec3(1.14, 1.20, 1.02), attackSapResponse);
  graded = mix(graded, vec3(luminance) * 0.62, vDeathProgress * 0.82);
  graded = mix(graded, vec3(1.0, 0.88, 0.62), vHitFlash * 0.72);
  gl_FragColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
}`;
  return {
    vertex,
    fragment,
    attributes: ['position', 'uv', 'spriteMotion', 'spriteKinematics', 'spriteTraits', 'spriteFeedback', 'spriteAction'],
    uniforms: [
      'viewProjection', 'cameraPosition', 'visualTime', 'feedbackTime', 'gateZ', 'spawnMaxZ',
      'directionCount', 'framesPerDirection', 'animationFps', 'frameMetaWidth',
      'idleFramesPerDirection', 'idleAnimationFps', 'idleFrameMetaWidth', 'hasIdleAnimation', 'stressMode',
      'hasStateAnimations', 'attackFramesPerDirection', 'hitFramesPerDirection', 'deathFramesPerDirection',
      'attackFrameMetaWidth', 'hitFrameMetaWidth', 'deathFrameMetaWidth',
      'attackProjectionScale', 'hitProjectionScale', 'deathProjectionScale',
      'mobileMode', 'displayWidth', 'displayHeight', 'frameScale', 'bruteVisualScale',
      'alphaCutoff', 'brightness', 'tintStrength'
    ],
    samplers: [
      'atlasSampler', 'stateAtlasSampler', 'frameMetaSampler', 'idleFrameMetaSampler',
      'attackFrameMetaSampler', 'hitFrameMetaSampler', 'deathFrameMetaSampler'
    ]
  };
}

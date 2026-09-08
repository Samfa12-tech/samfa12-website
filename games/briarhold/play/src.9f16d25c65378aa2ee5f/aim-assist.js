import {INPUT_SOURCES} from "./contracts.js";

export const TOUCH_AIM_ASSIST_CONE_DEGREES = 4;
export const TOUCH_AIM_ASSIST_FRICTION = 0.15;
export const TOUCH_AIM_ASSIST_MAX_DISTANCE = 120;
export const TOUCH_AIM_ASSIST_OCCLUSION_BUDGET = 6;
export const TOUCH_AUTO_FIRE_CONE_DEGREES = TOUCH_AIM_ASSIST_CONE_DEGREES;
export const TOUCH_AUTO_FIRE_SCAN_INTERVAL = 1 / 15;

/**
 * Touch-capable coarse-pointer sessions can transiently report mouse input
 * after source arbitration (for example, a hardware keyboard on Android).
 * Preserve touch auto-fire there, but never inherit it into gamepad play.
 */
export function touchAutomaticFireAvailable(inputFrame, {coarse = false} = {}) {
  if (!inputFrame) return false;
  return Boolean(
    inputFrame.source === INPUT_SOURCES.TOUCH
    || (coarse && inputFrame.source !== INPUT_SOURCES.GAMEPAD)
  );
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalized(vector) {
  const x = finite(vector?.x);
  const y = finite(vector?.y);
  const z = finite(vector?.z);
  const length = Math.hypot(x, y, z);
  if (length <= 1e-9) return null;
  return {x: x / length, y: y / length, z: z / length};
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function targetPoint(target) {
  return target.aimPoint ?? target.position;
}

/**
 * Chooses the point where the current reticle ray crosses a tall target's
 * visible vertical body. Flyers can therefore be acquired by pointing at any
 * part of their silhouette instead of one elevated centre pixel.
 */
export function reticleClampedTargetHeight({
  origin,
  aimDirection,
  targetX,
  targetZ,
  centerY,
  halfHeight,
} = {}) {
  const aim = normalized(aimDirection);
  const middle = finite(centerY);
  const extent = Math.max(0, finite(halfHeight));
  if (!aim || !origin) return middle;
  const horizontalSquared = aim.x * aim.x + aim.z * aim.z;
  if (horizontalSquared <= 1e-12) return middle;
  const dx = finite(targetX) - finite(origin.x);
  const dz = finite(targetZ) - finite(origin.z);
  const rayDistance = (dx * aim.x + dz * aim.z) / horizontalSquared;
  if (!Number.isFinite(rayDistance) || rayDistance < 0) return middle;
  const rayY = finite(origin.y) + aim.y * rayDistance;
  return Math.max(middle - extent, Math.min(middle + extent, rayY));
}

function ranksBefore(alignment, distanceSquared, id, candidate) {
  if (alignment > candidate.alignment + 1e-12) return true;
  if (alignment < candidate.alignment - 1e-12) return false;
  if (distanceSquared < candidate.distanceSquared - 1e-9) return true;
  if (distanceSquared > candidate.distanceSquared + 1e-9) return false;
  return id < candidate.id;
}

/**
 * Ranks the small set of enemies worth testing against world geometry. The
 * battlefield can contain thousands of bodies, so this pass deliberately uses
 * only typed-array maths and never performs a scene pick per body.
 */
export function rankTouchAimAssistCandidateIds({
  origin,
  aimDirection,
  x = [],
  z = [],
  type = [],
  status = [],
  slotCount = 0,
  activeStatus = 1,
  aimHeight = () => 0,
  coneDegrees = TOUCH_AIM_ASSIST_CONE_DEGREES,
  maxDistance = TOUCH_AIM_ASSIST_MAX_DISTANCE,
  maxCandidates = TOUCH_AIM_ASSIST_OCCLUSION_BUDGET,
} = {}) {
  const aim = normalized(aimDirection);
  if (!aim || !origin) return [];

  const count = Math.max(0, Math.min(
    Math.floor(finite(slotCount)),
    status?.length ?? 0,
    x?.length ?? 0,
    z?.length ?? 0,
  ));
  const candidateLimit = Math.max(0, Math.min(64, Math.floor(finite(maxCandidates))));
  if (count === 0 || candidateLimit === 0) return [];

  const cone = Math.max(0, finite(coneDegrees, TOUCH_AIM_ASSIST_CONE_DEGREES)) * Math.PI / 180;
  const minimumAlignment = Math.cos(Math.min(Math.PI, cone));
  const distanceLimit = Math.max(0, finite(maxDistance, TOUCH_AIM_ASSIST_MAX_DISTANCE));
  const distanceLimitSquared = distanceLimit * distanceLimit;
  const originX = finite(origin.x);
  const originY = finite(origin.y);
  const originZ = finite(origin.z);
  const ranked = [];

  for (let id = 0; id < count; id++) {
    if (status[id] !== activeStatus) continue;
    const dx = finite(x[id]) - originX;
    const dy = finite(aimHeight(type[id], id)) - originY;
    const dz = finite(z[id]) - originZ;
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    if (distanceSquared <= 1e-18 || distanceSquared > distanceLimitSquared) continue;
    const inverseDistance = 1 / Math.sqrt(distanceSquared);
    const alignment = aim.x * dx * inverseDistance + aim.y * dy * inverseDistance + aim.z * dz * inverseDistance;
    if (alignment < minimumAlignment - 1e-12) continue;

    let insertionIndex = ranked.length;
    while (
      insertionIndex > 0 &&
      ranksBefore(alignment, distanceSquared, id, ranked[insertionIndex - 1])
    ) {
      insertionIndex--;
    }
    if (insertionIndex >= candidateLimit) continue;

    if (ranked.length < candidateLimit) {
      ranked.push({id, alignment, distanceSquared});
    } else {
      const recycled = ranked[ranked.length - 1];
      recycled.id = id;
      recycled.alignment = alignment;
      recycled.distanceSquared = distanceSquared;
    }
    for (let index = ranked.length - 1; index > insertionIndex; index--) {
      const swap = ranked[index];
      ranked[index] = ranked[index - 1];
      ranked[index - 1] = swap;
    }
  }

  return ranked.map((candidate) => candidate.id);
}

/** Resolves ranked candidates lazily and stops after the first visible target. */
export function selectFirstVisibleTouchAimAssistTarget({
  candidateIds = [],
  targetForId,
  isOccluded = () => false,
} = {}) {
  if (typeof targetForId !== "function") return null;
  for (const id of candidateIds) {
    const target = targetForId(id);
    const point = target ? targetPoint(target) : null;
    if (!target || target.active === false || !point) continue;
    if (!isOccluded(target, point)) return target;
  }
  return null;
}

/** Returns the closest-to-reticle eligible target inside the touch assist cone. */
export function selectTouchAimAssistTarget({
  origin,
  aimDirection,
  targets = [],
  coneDegrees = TOUCH_AIM_ASSIST_CONE_DEGREES,
  maxDistance = TOUCH_AIM_ASSIST_MAX_DISTANCE,
} = {}) {
  const aim = normalized(aimDirection);
  if (!aim || !origin) return null;
  const cone = Math.max(0, finite(coneDegrees, TOUCH_AIM_ASSIST_CONE_DEGREES)) * Math.PI / 180;
  const distanceLimit = Math.max(0, finite(maxDistance, TOUCH_AIM_ASSIST_MAX_DISTANCE));
  let selected = null;
  for (const target of targets) {
    const point = targetPoint(target);
    if (target?.active === false || target?.occluded === true || !point) continue;
    const dx = finite(point.x) - finite(origin.x);
    const dy = finite(point.y) - finite(origin.y);
    const dz = finite(point.z) - finite(origin.z);
    const distance = Math.hypot(dx, dy, dz);
    if (distance <= 1e-9 || distance > distanceLimit) continue;
    const targetDirection = {x: dx / distance, y: dy / distance, z: dz / distance};
    const angle = Math.acos(Math.max(-1, Math.min(1, dot(aim, targetDirection))));
    if (angle > cone + 1e-9) continue;
    if (
      !selected ||
      angle < selected.angle - 1e-9 ||
      (Math.abs(angle - selected.angle) <= 1e-9 && distance < selected.distance)
    ) {
      selected = {target, targetDirection, angle, distance};
    }
  }
  return selected;
}

/**
 * Applies a small direction blend only for touch. Fire is copied verbatim, so
 * target acquisition can never become autofire.
 */
export function applyTouchAimAssist({
  inputFrame,
  origin,
  aimDirection,
  targets = [],
  strength = 1,
  coneDegrees = TOUCH_AIM_ASSIST_CONE_DEGREES,
  maxDistance = TOUCH_AIM_ASSIST_MAX_DISTANCE,
} = {}) {
  const originalDirection = normalized(aimDirection) ?? {x: 0, y: 0, z: 1};
  const fire = Boolean(inputFrame?.fire);
  if (inputFrame?.source !== INPUT_SOURCES.TOUCH) {
    return Object.freeze({direction: Object.freeze(originalDirection), targetId: null, assisted: false, fire});
  }
  const selected = selectTouchAimAssistTarget({origin, aimDirection: originalDirection, targets, coneDegrees, maxDistance});
  if (!selected) {
    return Object.freeze({direction: Object.freeze(originalDirection), targetId: null, assisted: false, fire});
  }
  const amount = Math.max(0, Math.min(1, finite(strength, 1))) * TOUCH_AIM_ASSIST_FRICTION;
  const assistedDirection = normalized({
    x: originalDirection.x * (1 - amount) + selected.targetDirection.x * amount,
    y: originalDirection.y * (1 - amount) + selected.targetDirection.y * amount,
    z: originalDirection.z * (1 - amount) + selected.targetDirection.z * amount,
  });
  return Object.freeze({
    direction: Object.freeze(assistedDirection),
    targetId: selected.target.id ?? null,
    assisted: amount > 0,
    fire,
  });
}

/**
 * Auto-fire uses the same bounded cone as manual aim friction. The target must
 * therefore be under the player's reticle before a shot can resolve to it.
 */
export function touchAutomaticFireDirection({
  inputFrame,
  origin,
  aimDirection,
  target,
  coneDegrees = TOUCH_AUTO_FIRE_CONE_DEGREES,
} = {}) {
  const originalDirection = normalized(aimDirection) ?? {x: 0, y: 0, z: 1};
  const point = target ? targetPoint(target) : null;
  if (
    inputFrame?.source !== INPUT_SOURCES.TOUCH
    || !origin
    || !point
    || target?.active === false
    || target?.occluded === true
  ) return Object.freeze(originalDirection);
  const targetDirection = normalized({
    x: finite(point.x) - finite(origin.x),
    y: finite(point.y) - finite(origin.y),
    z: finite(point.z) - finite(origin.z),
  });
  if (!targetDirection) return Object.freeze(originalDirection);
  const cone = Math.max(0, finite(coneDegrees, TOUCH_AUTO_FIRE_CONE_DEGREES)) * Math.PI / 180;
  if (dot(originalDirection, targetDirection) < Math.cos(Math.min(Math.PI, cone)) - 1e-12) {
    return Object.freeze(originalDirection);
  }
  return Object.freeze(targetDirection);
}

/**
 * Optional touch accessibility policy. Manual fire is always preserved;
 * automatic fire requires a visible assisted target and pauses while the
 * weapon is overheated so the ordinary recovery threshold remains decisive.
 */
export function resolveTouchAutomaticFire({inputFrame, enabled = false, target = null, overheated = false} = {}) {
  if (inputFrame?.fire) return true;
  return Boolean(
    enabled
    && inputFrame?.source === INPUT_SOURCES.TOUCH
    && target
    && !overheated
  );
}

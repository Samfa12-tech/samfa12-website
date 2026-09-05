import {PLAYER_DEFAULTS, WEAPON_SLOTS} from "./contracts.js";
import {enemyArchetype} from "./enemies.js";
import {EMPTY_INPUT_FRAME, normalizeInputFrame} from "./input-frame.js";
import {BRIARHOLD_FIRST_PERSON_MAP, sampleSolidRampFill, sampleWalkableGround} from "./map-definition.js";

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export const PLAYER_CROWD_CONTACT = Object.freeze({
  activeStatus: 1,
  verticalTolerance: 1.25,
  separationPadding: 0.08,
  response: 0.72,
  maximumCorrection: 0.14,
  correctionSpeed: 4.2,
});

export function createPlayerState({
  mapDefinition = BRIARHOLD_FIRST_PERSON_MAP,
  position = mapDefinition.playerSpawn,
  facing = mapDefinition.playerSpawn,
  maxHp = PLAYER_DEFAULTS.maxHp,
  hp = maxHp,
  activeWeapon = PLAYER_DEFAULTS.activeWeapon,
} = {}) {
  const safeMaxHp = Math.max(1, finite(maxHp, PLAYER_DEFAULTS.maxHp));
  return {
    position: {
      x: finite(position?.x, mapDefinition.playerSpawn.x),
      y: finite(position?.y, mapDefinition.playerSpawn.y),
      z: finite(position?.z, mapDefinition.playerSpawn.z),
    },
    velocity: {x: 0, y: 0, z: 0},
    facing: {
      yaw: finite(facing?.yaw, mapDefinition.playerSpawn.yaw),
      pitch: clamp(
        finite(facing?.pitch, mapDefinition.playerSpawn.pitch),
        PLAYER_DEFAULTS.minPitch,
        PLAYER_DEFAULTS.maxPitch,
      ),
    },
    grounded: true,
    eyeHeight: PLAYER_DEFAULTS.eyeHeight,
    sliding: false,
    slideTimer: 0,
    slideDirection: {x: 0, z: 0},
    mantleState: null,
    jumpHeld: false,
    slideHeld: false,
    hp: clamp(finite(hp, safeMaxHp), 0, safeMaxHp),
    maxHp: safeMaxHp,
    activeWeapon:
      Number.isInteger(activeWeapon) && activeWeapon >= WEAPON_SLOTS.ARBALEST && activeWeapon <= WEAPON_SLOTS.RUNEBOLT
        ? activeWeapon
        : PLAYER_DEFAULTS.activeWeapon,
    heat: [0, 0, 0],
    healAvailable: true,
    damageCooldown: 0,
  };
}

/** True once a defender has physically fallen below the authored map volume. */
export function isPlayerBelowNavigationBounds(
  state,
  mapDefinition = BRIARHOLD_FIRST_PERSON_MAP,
) {
  const playerY = Number(state?.position?.y);
  const minimumY = Number(mapDefinition?.navigationBounds?.min?.y);
  return Number.isFinite(playerY) && Number.isFinite(minimumY) && playerY < minimumY;
}

function movementCandidate(state, frame, seconds, speed) {
  const {x: right, y: forward} = frame.move;
  const sin = Math.sin(state.facing.yaw);
  const cos = Math.cos(state.facing.yaw);
  const velocityX = (right * cos + forward * sin) * speed;
  const velocityZ = (forward * cos - right * sin) * speed;
  return {
    x: state.position.x + velocityX * seconds,
    z: state.position.z + velocityZ * seconds,
    velocityX,
    velocityZ,
  };
}

function collisionVerticalRange(volume, mapDefinition, position) {
  if (volume.appearance !== "ramp-rail") return {min: volume.min.y, max: volume.max.y};
  const surface = mapDefinition.walkableSurfaces?.find(item => item.id === volume.surfaceId);
  if (!surface || surface.kind !== "ramp") return {min: volume.min.y, max: volume.max.y};
  const coordinate = clamp(
    finite(position?.[surface.axis], surface.min[surface.axis]),
    surface.min[surface.axis],
    surface.max[surface.axis],
  );
  const amount = (coordinate - surface.min[surface.axis])
    / Math.max(1e-6, surface.max[surface.axis] - surface.min[surface.axis]);
  const surfaceY = surface.startY + (surface.endY - surface.startY) * amount;
  // The visible rail is now an attached low masonry curb rather than a
  // detached beam. Keep collision local to the sampled slope so the authored
  // AABB cannot become a many-metres-high wall beneath the ramp.
  return {min: surfaceY - 0.04, max: surfaceY + 1.02};
}

function overlapsHeight(volume, feetY, capsuleHeight, mapDefinition, position) {
  const range = collisionVerticalRange(volume, mapDefinition, position);
  return feetY < range.max - 1e-6 && feetY + capsuleHeight > range.min + 1e-6;
}

function blocksPlayer(volume) {
  return volume?.playerSolid !== false;
}

function resolveRampFillAxis(position, target, axis, mapDefinition, radius, maxStepHeight) {
  const targetPosition = {...position, [axis]: target};
  const options = {feetY: position.y, radius, maxStepHeight};
  const targetFill = sampleSolidRampFill(mapDefinition, targetPosition.x, targetPosition.z, options);
  if (!targetFill) return target;
  const startFill = sampleSolidRampFill(mapDefinition, position.x, position.z, options);
  if (startFill) {
    return targetFill.clearance < startFill.clearance - 1e-6 ? target : position[axis];
  }
  let clear = position[axis];
  let blocked = target;
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const middle = (clear + blocked) * 0.5;
    const probe = {...position, [axis]: middle};
    if (sampleSolidRampFill(mapDefinition, probe.x, probe.z, options)) blocked = middle;
    else clear = middle;
  }
  return clear;
}

function resolveAxisMove(position, target, axis, mapDefinition, radius, capsuleHeight, maxStepHeight, disabledCollisionIds) {
  const otherAxis = axis === "x" ? "z" : "x";
  const direction = Math.sign(target - position[axis]);
  if (direction === 0) return position[axis];
  let resolved = target;
  for (const volume of mapDefinition.collisionVolumes ?? []) {
    if (!blocksPlayer(volume) || disabledCollisionIds?.has(volume.id)) continue;
    const probe = {...position, [axis]: clamp(target, volume.min[axis], volume.max[axis])};
    if (!overlapsHeight(volume, position.y, capsuleHeight, mapDefinition, probe)) continue;
    if (
      position[otherAxis] < volume.min[otherAxis] - radius ||
      position[otherAxis] > volume.max[otherAxis] + radius
    ) {
      continue;
    }
    const near = direction > 0 ? volume.min[axis] - radius : volume.max[axis] + radius;
    if (
      (direction > 0 && position[axis] <= near && resolved > near) ||
      (direction < 0 && position[axis] >= near && resolved < near)
    ) {
      resolved = direction > 0 ? Math.min(resolved, near) : Math.max(resolved, near);
    }
  }
  return resolveRampFillAxis(position, resolved, axis, mapDefinition, radius, maxStepHeight);
}

function resolveHorizontalMove(state, candidate, mapDefinition, options) {
  const radius = finite(options.capsuleRadius, PLAYER_DEFAULTS.capsuleRadius);
  const capsuleHeight = finite(options.capsuleHeight, PLAYER_DEFAULTS.capsuleHeight);
  const maxStepHeight = finite(options.maxStepHeight, PLAYER_DEFAULTS.maxStepHeight);
  const disabledCollisionIds = options.disabledCollisionIds;
  const x = resolveAxisMove(state.position, candidate.x, "x", mapDefinition, radius, capsuleHeight, maxStepHeight, disabledCollisionIds);
  const afterX = {...state.position, x};
  const z = resolveAxisMove(afterX, candidate.z, "z", mapDefinition, radius, capsuleHeight, maxStepHeight, disabledCollisionIds);
  return {x, z};
}

function positionIsClear(position, mapDefinition, radius, capsuleHeight, disabledCollisionIds) {
  if (sampleSolidRampFill(mapDefinition, position.x, position.z, {feetY: position.y, radius})) return false;
  return !(mapDefinition.collisionVolumes ?? []).some((volume) => {
    if (!blocksPlayer(volume) || disabledCollisionIds?.has(volume.id)) return false;
    if (!overlapsHeight(volume, position.y, capsuleHeight, mapDefinition, position)) return false;
    return position.x > volume.min.x - radius
      && position.x < volume.max.x + radius
      && position.z > volume.min.z - radius
      && position.z < volume.max.z + radius;
  });
}

function fallbackCrowdNormal(id) {
  const angle = ((Math.max(0, Math.trunc(id)) * 0.61803398875) % 1) * Math.PI * 2;
  return {x: Math.cos(angle), z: Math.sin(angle)};
}

/**
 * Applies a small positional response when a grounded Warden overlaps active
 * grounded enemies. Enemy state is never mutated, so the player cannot push or
 * body-block the authoritative horde. The correction is revalidated through
 * authored world collision and walkable support before it reaches the camera.
 */
export function resolvePlayerCrowdContact(
  state,
  crowd,
  deltaSeconds = 0,
  {
    mapDefinition = BRIARHOLD_FIRST_PERSON_MAP,
    capsuleRadius = PLAYER_DEFAULTS.capsuleRadius,
    capsuleHeight = PLAYER_DEFAULTS.capsuleHeight,
    maxStepHeight = PLAYER_DEFAULTS.maxStepHeight,
    disabledCollisionIds = null,
    activeStatus = PLAYER_CROWD_CONTACT.activeStatus,
    verticalTolerance = PLAYER_CROWD_CONTACT.verticalTolerance,
    separationPadding = PLAYER_CROWD_CONTACT.separationPadding,
    response = PLAYER_CROWD_CONTACT.response,
    maximumCorrection = PLAYER_CROWD_CONTACT.maximumCorrection,
    correctionSpeed = PLAYER_CROWD_CONTACT.correctionSpeed,
    diagnostics = null,
  } = {},
) {
  if (diagnostics) {
    diagnostics.scanned = 0;
    diagnostics.contacts = 0;
    diagnostics.correction = 0;
  }
  if (!state?.position || !state.grounded || state.mantleState) return 0;
  const seconds = clamp(finite(deltaSeconds, 0), 0, 0.1);
  if (seconds <= 0 || state.position.y > Math.max(0, finite(verticalTolerance, 1.25))) return 0;
  if (!crowd?.status || !crowd?.x || !crowd?.z || !crowd?.type) return 0;

  const count = Math.max(0, Math.min(
    Math.trunc(finite(crowd.slotCount, 0)),
    crowd.status.length,
    crowd.x.length,
    crowd.z.length,
    crowd.type.length,
  ));
  let contacts = 0;
  let pushX = 0;
  let pushZ = 0;
  let maximumPenetration = 0;
  let nearestDistanceSq = Number.POSITIVE_INFINITY;
  let nearestId = -1;
  let nearestNormalX = 0;
  let nearestNormalZ = 0;
  const playerRadius = Math.max(0.1, finite(capsuleRadius, PLAYER_DEFAULTS.capsuleRadius));
  const padding = Math.max(0, finite(separationPadding, PLAYER_CROWD_CONTACT.separationPadding));

  for (let id = 0; id < count; id += 1) {
    if (crowd.status[id] !== activeStatus) continue;
    const archetype = enemyArchetype(crowd.type[id]);
    if (archetype.flying) continue;
    const dx = state.position.x - finite(crowd.x[id], state.position.x);
    const dz = state.position.z - finite(crowd.z[id], state.position.z);
    const minimumDistance = playerRadius + Math.max(0.1, finite(archetype.radius, 0.66)) + padding;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= minimumDistance * minimumDistance) continue;
    const distance = Math.sqrt(distanceSq);
    const fallback = distance > 1e-6 ? null : fallbackCrowdNormal(id);
    const normalX = fallback ? fallback.x : dx / distance;
    const normalZ = fallback ? fallback.z : dz / distance;
    const penetration = minimumDistance - distance;
    pushX += normalX * penetration;
    pushZ += normalZ * penetration;
    maximumPenetration = Math.max(maximumPenetration, penetration);
    contacts += 1;
    if (distanceSq < nearestDistanceSq - 1e-9 || (Math.abs(distanceSq - nearestDistanceSq) <= 1e-9 && id < nearestId)) {
      nearestDistanceSq = distanceSq;
      nearestId = id;
      nearestNormalX = normalX;
      nearestNormalZ = normalZ;
    }
  }
  if (diagnostics) {
    diagnostics.scanned = count;
    diagnostics.contacts = contacts;
  }
  if (contacts === 0) return 0;

  let directionX = pushX;
  let directionZ = pushZ;
  let directionLength = Math.hypot(directionX, directionZ);
  if (directionLength < 1e-6) {
    directionX = nearestNormalX;
    directionZ = nearestNormalZ;
    directionLength = Math.hypot(directionX, directionZ);
  }
  if (directionLength < 1e-6) return 0;
  directionX /= directionLength;
  directionZ /= directionLength;
  const correction = Math.min(
    Math.max(0, finite(maximumCorrection, PLAYER_CROWD_CONTACT.maximumCorrection)),
    Math.max(0, finite(correctionSpeed, PLAYER_CROWD_CONTACT.correctionSpeed)) * seconds,
    maximumPenetration * clamp(finite(response, PLAYER_CROWD_CONTACT.response), 0, 1),
  );
  if (correction <= 1e-6) return 0;

  const candidate = {
    x: state.position.x + directionX * correction,
    z: state.position.z + directionZ * correction,
  };
  const horizontal = resolveHorizontalMove(state, candidate, mapDefinition, {
    capsuleRadius: playerRadius,
    capsuleHeight,
    maxStepHeight,
    disabledCollisionIds,
  });
  const support = sampleWalkableGround(mapDefinition, horizontal.x, horizontal.z, {
    currentY: state.position.y,
    radius: playerRadius,
    maxStepHeight,
    maxDropHeight: maxStepHeight,
    preferHighest: true,
  });
  if (!support || Math.abs(support.y - state.position.y) > Math.max(0, finite(maxStepHeight, PLAYER_DEFAULTS.maxStepHeight)) + 1e-6) {
    return 0;
  }
  const appliedX = horizontal.x - state.position.x;
  const appliedZ = horizontal.z - state.position.z;
  const applied = Math.hypot(appliedX, appliedZ);
  if (applied <= 1e-6) return 0;
  state.position.x = horizontal.x;
  state.position.z = horizontal.z;
  if (diagnostics) diagnostics.correction = applied;
  return applied;
}

function tryStartMantle(state, candidate, horizontal, mapDefinition, options) {
  const blockedX = Math.abs(horizontal.x - candidate.x) > 1e-6;
  const blockedZ = Math.abs(horizontal.z - candidate.z) > 1e-6;
  if (!blockedX && !blockedZ) return false;
  const dx = candidate.x - state.position.x;
  const dz = candidate.z - state.position.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return false;
  const direction = {x: dx / length, z: dz / length};
  const radius = finite(options.capsuleRadius, PLAYER_DEFAULTS.capsuleRadius);
  const capsuleHeight = finite(options.capsuleHeight, PLAYER_DEFAULTS.capsuleHeight);
  const maxStepHeight = finite(options.maxStepHeight, PLAYER_DEFAULTS.maxStepHeight);
  const mantleHeight = finite(options.mantleHeight, PLAYER_DEFAULTS.mantleHeight);
  const disabledCollisionIds = options.disabledCollisionIds;

  for (const volume of mapDefinition.collisionVolumes ?? []) {
    // Mantling is an authored traversal link, not an inference from collision
    // height. Safety parapets and other low structural solids can otherwise
    // become accidental launch points when there happens to be support beyond.
    if (!blocksPlayer(volume) || volume.mantleable !== true) continue;
    if (disabledCollisionIds?.has(volume.id)
      || !overlapsHeight(volume, state.position.y, capsuleHeight, mapDefinition, state.position)) continue;
    const obstacleHeight = volume.max.y - state.position.y;
    if (obstacleHeight <= maxStepHeight + 0.04 || obstacleHeight > mantleHeight) continue;
    const touchesX = blockedX
      && state.position.z >= volume.min.z - radius
      && state.position.z <= volume.max.z + radius;
    const touchesZ = blockedZ
      && state.position.x >= volume.min.x - radius
      && state.position.x <= volume.max.x + radius;
    if (!touchesX && !touchesZ) continue;

    let landingX = candidate.x;
    let landingZ = candidate.z;
    if (touchesX && (!touchesZ || Math.abs(direction.x) >= Math.abs(direction.z))) {
      landingX = direction.x > 0 ? volume.max.x + radius + 0.08 : volume.min.x - radius - 0.08;
      const travel = Math.abs((landingX - state.position.x) / (direction.x || 1e-6));
      landingZ = state.position.z + direction.z * travel;
    } else {
      landingZ = direction.z > 0 ? volume.max.z + radius + 0.08 : volume.min.z - radius - 0.08;
      const travel = Math.abs((landingZ - state.position.z) / (direction.z || 1e-6));
      landingX = state.position.x + direction.x * travel;
    }
    const support = sampleWalkableGround(mapDefinition, landingX, landingZ, {
      currentY: state.position.y,
      radius,
      maxStepHeight: mantleHeight + 0.1,
      maxDropHeight: mantleHeight + 0.25,
      preferHighest: true,
    });
    if (!support || Math.abs(support.y - state.position.y) > mantleHeight) continue;
    const target = {x: landingX, y: support.y, z: landingZ};
    if (!positionIsClear(target, mapDefinition, radius, capsuleHeight, disabledCollisionIds)) continue;
    state.mantleState = {
      elapsed: 0,
      duration: Math.max(0.12, finite(options.mantleDuration, PLAYER_DEFAULTS.mantleDuration)),
      start: {...state.position},
      target,
      obstacleTop: volume.max.y,
    };
    state.slideTimer = 0;
    state.sliding = false;
    state.velocity.x = 0;
    state.velocity.y = 0;
    state.velocity.z = 0;
    state.grounded = false;
    return true;
  }
  return false;
}

function advanceMantle(state, seconds) {
  const mantle = state.mantleState;
  mantle.elapsed = Math.min(mantle.duration, mantle.elapsed + seconds);
  const raw = mantle.duration > 0 ? mantle.elapsed / mantle.duration : 1;
  const t = raw * raw * (3 - 2 * raw);
  const previous = {...state.position};
  state.position.x = mantle.start.x + (mantle.target.x - mantle.start.x) * t;
  state.position.z = mantle.start.z + (mantle.target.z - mantle.start.z) * t;
  const baseY = mantle.start.y + (mantle.target.y - mantle.start.y) * t;
  const clearance = Math.max(0.16, mantle.obstacleTop - Math.max(mantle.start.y, mantle.target.y) + 0.12);
  state.position.y = baseY + Math.sin(Math.PI * raw) * clearance;
  const inverseSeconds = seconds > 0 ? 1 / seconds : 0;
  state.velocity.x = (state.position.x - previous.x) * inverseSeconds;
  state.velocity.y = (state.position.y - previous.y) * inverseSeconds;
  state.velocity.z = (state.position.z - previous.z) * inverseSeconds;
  state.eyeHeight = PLAYER_DEFAULTS.eyeHeight;
  if (raw >= 1) {
    state.position.y = mantle.target.y;
    state.velocity.y = 0;
    state.grounded = true;
    state.mantleState = null;
  }
}

/**
 * Advances the mutable PlayerState from normalised intent. Horizontal collision
 * uses authored solids; vertical movement follows authored floors and ramps or
 * deterministic gravity when the capsule moves beyond their support.
 */
export function updatePlayerController(
  state,
  inputFrame = EMPTY_INPUT_FRAME,
  deltaSeconds = 0,
  {
    mapDefinition = BRIARHOLD_FIRST_PERSON_MAP,
    walkSpeed = PLAYER_DEFAULTS.walkSpeed,
    sprintSpeed = PLAYER_DEFAULTS.sprintSpeed,
    capsuleRadius = PLAYER_DEFAULTS.capsuleRadius,
    capsuleHeight = PLAYER_DEFAULTS.capsuleHeight,
    maxStepHeight = PLAYER_DEFAULTS.maxStepHeight,
    gravity = 24,
    terminalVelocity = 45,
    groundSnapDistance = PLAYER_DEFAULTS.maxStepHeight,
    disabledCollisionIds = null,
    jumpVelocity = PLAYER_DEFAULTS.jumpVelocity,
    mantleHeight = PLAYER_DEFAULTS.mantleHeight,
    mantleDuration = PLAYER_DEFAULTS.mantleDuration,
    slideSpeed = PLAYER_DEFAULTS.slideSpeed,
    slideDuration = PLAYER_DEFAULTS.slideDuration,
    slideCapsuleHeight = PLAYER_DEFAULTS.slideCapsuleHeight,
  } = {},
) {
  if (!state?.position || !state?.facing || !state?.velocity) {
    throw new TypeError("updatePlayerController requires a PlayerState");
  }
  const frame = normalizeInputFrame(inputFrame);
  const seconds = clamp(finite(deltaSeconds, 0), 0, 0.1);

  state.facing.yaw += frame.look.yaw;
  state.facing.pitch = clamp(
    state.facing.pitch + frame.look.pitch,
    PLAYER_DEFAULTS.minPitch,
    PLAYER_DEFAULTS.maxPitch,
  );
  if (frame.selectedWeapon !== null) state.activeWeapon = frame.selectedWeapon;

  const jumpPressed = frame.jump && !state.jumpHeld;
  const slidePressed = frame.slide && !state.slideHeld;
  state.jumpHeld = frame.jump;
  state.slideHeld = frame.slide;

  if (state.mantleState) {
    advanceMantle(state, seconds);
    state.damageCooldown = Math.max(0, finite(state.damageCooldown, 0) - seconds);
    return state;
  }

  const moveMagnitude = Math.hypot(frame.move.x, frame.move.y);
  if (jumpPressed && state.sliding) {
    state.slideTimer = 0;
    state.sliding = false;
  }
  if (slidePressed && state.grounded && moveMagnitude > 0.25 && (frame.sprint || Math.hypot(state.velocity.x, state.velocity.z) > walkSpeed)) {
    const preview = movementCandidate(state, frame, 1, 1);
    const previewLength = Math.hypot(preview.velocityX, preview.velocityZ) || 1;
    state.slideDirection.x = preview.velocityX / previewLength;
    state.slideDirection.z = preview.velocityZ / previewLength;
    state.slideTimer = Math.max(0.1, finite(slideDuration, PLAYER_DEFAULTS.slideDuration));
    state.sliding = true;
  }

  let speed = frame.sprint ? sprintSpeed : walkSpeed;
  let candidate;
  if (state.sliding && state.slideTimer > 0) {
    const progress = state.slideTimer / Math.max(0.1, finite(slideDuration, PLAYER_DEFAULTS.slideDuration));
    speed = sprintSpeed + (Math.max(sprintSpeed, finite(slideSpeed, PLAYER_DEFAULTS.slideSpeed)) - sprintSpeed) * progress;
    candidate = {
      x: state.position.x + state.slideDirection.x * speed * seconds,
      z: state.position.z + state.slideDirection.z * speed * seconds,
      velocityX: state.slideDirection.x * speed,
      velocityZ: state.slideDirection.z * speed,
    };
  } else {
    state.slideTimer = 0;
    state.sliding = false;
    candidate = movementCandidate(state, frame, seconds, speed);
  }
  const activeCapsuleHeight = state.sliding ? slideCapsuleHeight : capsuleHeight;
  let horizontal = resolveHorizontalMove(state, candidate, mapDefinition, {capsuleRadius, capsuleHeight: activeCapsuleHeight, maxStepHeight, disabledCollisionIds});
  if (jumpPressed && state.grounded && moveMagnitude > 0.2 && tryStartMantle(state, candidate, horizontal, mapDefinition, {
    capsuleRadius, capsuleHeight, maxStepHeight, mantleHeight, mantleDuration, disabledCollisionIds,
  })) {
    advanceMantle(state, seconds);
    state.damageCooldown = Math.max(0, finite(state.damageCooldown, 0) - seconds);
    return state;
  }
  const previousY = state.position.y;
  let nextY = previousY;
  let nextVerticalVelocity = state.velocity.y;
  let grounded = false;

  if (jumpPressed && state.grounded) {
    state.grounded = false;
    nextVerticalVelocity = Math.max(0.1, finite(jumpVelocity, PLAYER_DEFAULTS.jumpVelocity));
  }

  if (state.grounded && !jumpPressed) {
    const support = sampleWalkableGround(mapDefinition, horizontal.x, horizontal.z, {
      currentY: previousY,
      radius: capsuleRadius,
      maxStepHeight,
      maxDropHeight: groundSnapDistance,
      preferHighest: true,
    });
    if (support) {
      nextY = support.y;
      nextVerticalVelocity = seconds > 0 ? (nextY - previousY) / seconds : 0;
      grounded = true;
    }
  }

  if (!grounded) {
    nextVerticalVelocity = Math.max(
      -Math.abs(finite(terminalVelocity, 45)),
      finite(nextVerticalVelocity, 0) - Math.abs(finite(gravity, 24)) * seconds,
    );
    nextY = previousY + nextVerticalVelocity * seconds;
    const landing = sampleWalkableGround(mapDefinition, horizontal.x, horizontal.z, {
      currentY: previousY,
      radius: capsuleRadius,
      maxStepHeight: 0,
    });
    if (landing && previousY >= landing.y - 1e-6 && nextY <= landing.y + 1e-6) {
      nextY = landing.y;
      nextVerticalVelocity = 0;
      grounded = true;
    }
  }

  const next = {x: horizontal.x, y: nextY, z: horizontal.z};
  const inverseSeconds = seconds > 0 ? 1 / seconds : 0;
  state.velocity.x = (next.x - state.position.x) * inverseSeconds;
  state.velocity.y = nextVerticalVelocity;
  state.velocity.z = (next.z - state.position.z) * inverseSeconds;
  state.position.x = next.x;
  state.position.y = next.y;
  state.position.z = next.z;
  state.grounded = grounded;
  state.slideTimer = Math.max(0, finite(state.slideTimer, 0) - seconds);
  state.sliding = grounded && state.slideTimer > 0;
  state.eyeHeight = state.sliding ? PLAYER_DEFAULTS.slideEyeHeight : PLAYER_DEFAULTS.eyeHeight;
  state.damageCooldown = Math.max(0, finite(state.damageCooldown, 0) - seconds);
  return state;
}

export function damagePlayer(state, amount, cooldown = 0.35) {
  if (state.damageCooldown > 0 || state.hp <= 0) return 0;
  const applied = Math.min(state.hp, Math.max(0, finite(amount, 0)));
  state.hp -= applied;
  if (applied > 0) state.damageCooldown = Math.max(0, finite(cooldown, 0.35));
  return applied;
}

export function useEmergencyHeal(state) {
  if (!state.healAvailable || state.hp <= 0 || state.hp >= state.maxHp) return 0;
  const restored = Math.min(PLAYER_DEFAULTS.emergencyHealAmount, state.maxHp - state.hp);
  state.hp += restored;
  state.healAvailable = false;
  return restored;
}

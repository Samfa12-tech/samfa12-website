function finiteVector(value, label) {
  if (!value || !["x", "y", "z"].every(key => Number.isFinite(value[key]))) {
    throw new TypeError(`${label} must contain finite x, y and z coordinates`);
  }
  return value;
}

function rayBoxDistance(origin, direction, volume, maximumDistance) {
  let near = 0;
  let far = maximumDistance;
  for (const axis of ["x", "y", "z"]) {
    const component = direction[axis];
    if (Math.abs(component) <= 1e-12) {
      if (origin[axis] < volume.min[axis] || origin[axis] > volume.max[axis]) return null;
      continue;
    }
    let first = (volume.min[axis] - origin[axis]) / component;
    let second = (volume.max[axis] - origin[axis]) / component;
    if (first > second) [first, second] = [second, first];
    near = Math.max(near, first);
    far = Math.min(far, second);
    if (near > far) return null;
  }
  return near <= maximumDistance && far >= 0 ? Math.max(0, near) : null;
}

/** Return the closest renderer-independent authored collision hit. */
export function firstMapRayHit(originValue, directionValue, maximumDistance, {
  mapDefinition,
  disabledCollisionIds = null,
} = {}) {
  const origin = finiteVector(originValue, "ray origin");
  const inputDirection = finiteVector(directionValue, "ray direction");
  const length = Math.hypot(inputDirection.x, inputDirection.y, inputDirection.z);
  if (length <= 1e-12) throw new RangeError("ray direction must be non-zero");
  if (!Number.isFinite(maximumDistance) || maximumDistance < 0) {
    throw new RangeError("maximumDistance must be non-negative and finite");
  }
  if (!mapDefinition || !Array.isArray(mapDefinition.collisionVolumes)) {
    throw new TypeError("mapDefinition must provide collisionVolumes");
  }
  const direction = {
    x: inputDirection.x / length,
    y: inputDirection.y / length,
    z: inputDirection.z / length,
  };
  let nearest = null;
  for (const volume of mapDefinition.collisionVolumes) {
    if (disabledCollisionIds?.has?.(volume.id)) continue;
    const distance = rayBoxDistance(origin, direction, volume, maximumDistance);
    if (distance === null || (nearest && distance >= nearest.distance)) continue;
    nearest = {
      id: volume.id,
      distance,
      point: {
        x: origin.x + direction.x * distance,
        y: origin.y + direction.y * distance,
        z: origin.z + direction.z * distance,
      },
    };
  }
  return nearest ? Object.freeze({
    ...nearest,
    point: Object.freeze(nearest.point),
  }) : null;
}

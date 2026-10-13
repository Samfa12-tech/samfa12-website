export const SPRITE_COHORT = Object.freeze({
  near: 0,
  mid: 1,
  far: 2
});

export const SPRITE_COHORT_NAMES = Object.freeze(['near', 'mid', 'far']);

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function createSpriteUpdateCohorts(capacity, options = {}) {
  const safeCapacity = Math.max(1, Math.floor(Number(capacity) || 1));
  const cohortById = new Uint8Array(safeCapacity);
  cohortById.fill(SPRITE_COHORT.far);
  const assigned = new Uint8Array(safeCapacity);
  const lastUpdateAt = new Float64Array(safeCapacity);
  lastUpdateAt.fill(Number.NEGATIVE_INFINITY);
  const nearDistance = Math.max(1, finite(options.nearDistance, 42));
  const midDistance = Math.max(nearDistance + 1, finite(options.midDistance, 96));
  const hysteresis = Math.max(0, finite(options.hysteresis, 8));
  const updateHz = new Float64Array([
    Math.max(1, finite(options.nearHz, 30)),
    Math.max(1, finite(options.midHz, 15)),
    Math.max(1, finite(options.farHz, 8))
  ]);
  const counts = new Uint32Array(3);

  const classify = (id, input = {}) => {
    if (id < 0 || id >= safeCapacity) return SPRITE_COHORT.near;
    const forcedNear =
      input.priority === true ||
      input.special === true ||
      input.gateContact === true;
    const distance = Math.max(0, finite(input.distanceFromGate));
    const previous = cohortById[id];
    let next = previous;
    if (forcedNear) {
      next = SPRITE_COHORT.near;
    } else if (!assigned[id]) {
      next =
        distance <= nearDistance
          ? SPRITE_COHORT.near
          : distance <= midDistance
            ? SPRITE_COHORT.mid
            : SPRITE_COHORT.far;
    } else if (previous === SPRITE_COHORT.near) {
      if (distance > nearDistance + hysteresis) next = SPRITE_COHORT.mid;
    } else if (previous === SPRITE_COHORT.mid) {
      if (distance < nearDistance - hysteresis) next = SPRITE_COHORT.near;
      else if (distance > midDistance + hysteresis) next = SPRITE_COHORT.far;
    } else if (distance < midDistance - hysteresis) {
      next = SPRITE_COHORT.mid;
    }
    cohortById[id] = next;
    assigned[id] = 1;
    return next;
  };

  const shouldUpdate = (id, nowSeconds, force = false) => {
    if (id < 0 || id >= safeCapacity) return true;
    const cohort = cohortById[id];
    const now = finite(nowSeconds);
    if (
      force ||
      !Number.isFinite(lastUpdateAt[id]) ||
      now - lastUpdateAt[id] + 1e-9 >= 1 / updateHz[cohort]
    ) {
      lastUpdateAt[id] = now;
      return true;
    }
    return false;
  };

  return {
    capacity: safeCapacity,
    cohortById,
    assigned,
    lastUpdateAt,
    updateHz,
    classify,
    shouldUpdate,
    beginCount() {
      counts.fill(0);
    },
    count(id) {
      if (id >= 0 && id < safeCapacity) counts[cohortById[id]] += 1;
    },
    snapshot() {
      return {
        near: counts[SPRITE_COHORT.near],
        mid: counts[SPRITE_COHORT.mid],
        far: counts[SPRITE_COHORT.far],
        nearUpdateHz: updateHz[SPRITE_COHORT.near],
        midUpdateHz: updateHz[SPRITE_COHORT.mid],
        farUpdateHz: updateHz[SPRITE_COHORT.far]
      };
    },
    reset() {
      cohortById.fill(SPRITE_COHORT.far);
      assigned.fill(0);
      lastUpdateAt.fill(Number.NEGATIVE_INFINITY);
      counts.fill(0);
    }
  };
}

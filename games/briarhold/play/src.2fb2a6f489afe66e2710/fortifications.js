export const FORTIFICATION_DEFINITIONS = Object.freeze({
  barricade: Object.freeze({
    id: 'barricade',
    name: 'Briar barricade',
    cost: 32,
    description: 'Redirects and compresses the approach stream.',
    routeShift: 3.8,
    charges: Number.POSITIVE_INFINITY
  }),
  thornSnare: Object.freeze({
    id: 'thornSnare',
    name: 'Thorn snare',
    cost: 24,
    description: 'Slows the first packed ranks that cross it.',
    radius: 4.2,
    slow: 0.48,
    charges: 8
  }),
  firePot: Object.freeze({
    id: 'firePot',
    name: 'Sunfire pot',
    cost: 38,
    description: 'Shoot the vessel to detonate it across the surrounding Host.',
    radius: 6.4,
    damage: 210,
    charges: 1
  }),
  wardLantern: Object.freeze({
    id: 'wardLantern',
    name: 'Ward lantern',
    cost: 45,
    description: 'Reveals and weakens spectral attackers nearby.',
    radius: 13,
    charges: Number.POSITIVE_INFINITY
  }),
  ballista: Object.freeze({
    id: 'ballista',
    name: 'Crewed ballista',
    cost: 70,
    description: 'Automatically strikes one priority target at a measured cadence.',
    range: 46,
    interval: 1.25,
    damage: 130,
    charges: Number.POSITIVE_INFINITY
  })
});

export const FORTIFICATION_SOCKET_IDS = Object.freeze([
  'west-outer',
  'west-middle',
  'west-rear',
  'east-outer',
  'east-middle',
  'east-rear'
]);

function fortificationFactId(eventId, suffix) {
  const tail = String(suffix).toLowerCase().replace(/[^a-z0-9-]+/gu, '-').replace(/^-+|-+$/gu, '');
  const head = eventId.slice(0, Math.max(1, 127 - tail.length)).replace(/-+$/u, '');
  return `${head}-${tail}`;
}

/** Project one authoritative fortification activation into goal-engine facts. */
export function createFortificationGoalEvents({
  eventId,
  fortificationId,
  socketId,
  targets = [],
} = {}) {
  if (typeof eventId !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/u.test(eventId)) {
    throw new RangeError('fortification goal facts require a stable bounded eventId');
  }
  if (typeof socketId !== 'string' || !socketId || !FORTIFICATION_DEFINITIONS[fortificationId]) return [];
  const boundedTargets = (Array.isArray(targets) ? targets : [])
    .filter(target => Number.isInteger(target?.enemyId) && target.enemyId >= 0);
  const facts = [];
  if (fortificationId === 'thornSnare') {
    for (const target of boundedTargets) {
      facts.push({
        type: 'snare',
        eventId: fortificationFactId(eventId, `snare-${target.enemyId}`),
        fortificationId,
        socketId,
        enemyId: `enemy-${target.enemyId}`,
      });
    }
  }
  const killCount = boundedTargets.filter(target => target.killed === true).length;
  if (fortificationId === 'firePot') {
    facts.push({
      type: 'detonation',
      eventId: fortificationFactId(eventId, 'detonation'),
      fortificationId,
      socketId,
      killCount,
    });
  }
  for (const target of boundedTargets.filter(target => target.killed === true)) {
    facts.push({
      type: 'fortification-kill',
      eventId: fortificationFactId(eventId, `kill-${target.enemyId}`),
      fortificationId,
      socketId,
      enemyId: `enemy-${target.enemyId}`,
      killCount: 1,
    });
  }
  return facts;
}

/** Return the nearest charged fire pot intersected by a ray, or null. */
export function nearestFirePotRayHit(placements, sockets, origin, direction, maxDistance = Infinity, radius = 0.9) {
  const originX = Number(origin?.x);
  const originY = Number(origin?.y);
  const originZ = Number(origin?.z);
  const directionX = Number(direction?.x);
  const directionY = Number(direction?.y);
  const directionZ = Number(direction?.z);
  const directionLength = Math.hypot(directionX, directionY, directionZ);
  if (![originX, originY, originZ, directionLength].every(Number.isFinite) || directionLength <= 0) return null;

  const unitX = directionX / directionLength;
  const unitY = directionY / directionLength;
  const unitZ = directionZ / directionLength;
  const limit = Number.isFinite(Number(maxDistance)) ? Math.max(0, Number(maxDistance)) : Infinity;
  const hitRadius = Math.max(0.001, Number(radius) || 0.9);
  let nearest = null;
  for (const placement of Array.isArray(placements) ? placements : []) {
    if (placement?.type !== 'firePot' || (Number.isFinite(placement.charges) && placement.charges <= 0)) continue;
    const socket = (Array.isArray(sockets) ? sockets : []).find(item => item?.id === placement.socketId);
    if (!socket) continue;
    const offsetX = originX - Number(socket.x);
    const offsetY = originY - (Number(socket.y ?? 0) + 0.9);
    const offsetZ = originZ - Number(socket.z);
    const along = -(offsetX * unitX + offsetY * unitY + offsetZ * unitZ);
    if (along < 0 || along > limit) continue;
    const missDistance = Math.hypot(
      offsetX + unitX * along,
      offsetY + unitY * along,
      offsetZ + unitZ * along,
    );
    if (missDistance > hitRadius) continue;
    const distance = Math.max(0, along - Math.sqrt(Math.max(0, hitRadius ** 2 - missDistance ** 2)));
    if (!nearest || distance < nearest.distance) {
      nearest = {
        socketId: placement.socketId,
        distance,
        point: {
          x: originX + unitX * distance,
          y: originY + unitY * distance,
          z: originZ + unitZ * distance,
        },
      };
    }
  }
  return nearest;
}

export function createFortificationPlan(existing = {}) {
  const placements = {};
  for (const socketId of FORTIFICATION_SOCKET_IDS) {
    const placement = existing?.placements?.[socketId];
    if (placement && FORTIFICATION_DEFINITIONS[placement.type]) {
      placements[socketId] = {
        type: placement.type,
        charges: Number.isFinite(placement.charges)
          ? Math.max(0, Math.floor(placement.charges))
          : FORTIFICATION_DEFINITIONS[placement.type].charges
      };
    }
  }
  return { placements };
}

export function installFortification(plan, supplies, socketId, type) {
  if (!FORTIFICATION_SOCKET_IDS.includes(socketId)) throw new RangeError(`unknown socket ${socketId}`);
  const definition = FORTIFICATION_DEFINITIONS[type];
  if (!definition) throw new RangeError(`unknown fortification ${type}`);
  if (plan.placements[socketId]) throw new Error(`${socketId} is already occupied`);
  if (supplies < definition.cost) throw new Error('not enough Supplies');
  return {
    plan: {
      placements: {
        ...plan.placements,
        [socketId]: { type, charges: definition.charges }
      }
    },
    supplies: supplies - definition.cost
  };
}

export function removeFortification(plan, socketId) {
  const placements = { ...plan.placements };
  delete placements[socketId];
  return { placements };
}

export function consumeFortificationCharge(plan, socketId) {
  const placement = plan.placements[socketId];
  if (!placement || !Number.isFinite(placement.charges)) return plan;
  const placements = {
    ...plan.placements,
    [socketId]: { ...placement, charges: Math.max(0, placement.charges - 1) }
  };
  if (placements[socketId].charges === 0) delete placements[socketId];
  return { placements };
}

/**
 * Consume one or more charges from the serialisable RunState placement list.
 * Depleted mechanisms remain installed so the Trapper can restore them during
 * the next build break; unlimited/null charges are deliberately unchanged.
 */
export function consumeRunFortificationCharge(placements, socketId, amount = 1) {
  const index = Array.isArray(placements)
    ? placements.findIndex(placement => placement?.socketId === socketId)
    : -1;
  if (index < 0) return {placements, consumed: false, depleted: false, remaining: null};
  const placement = placements[index];
  if (!Number.isFinite(placement.charges) || placement.charges <= 0) {
    return {
      placements,
      consumed: false,
      depleted: Number.isFinite(placement.charges) && placement.charges <= 0,
      remaining: placement.charges,
    };
  }
  const decrement = Math.max(1, Math.floor(Number(amount) || 1));
  const remaining = Math.max(0, placement.charges - decrement);
  const next = placements.slice();
  next[index] = {...placement, charges: remaining};
  return {placements: next, consumed: true, depleted: remaining === 0, remaining};
}

export function routeShiftForApproach(plan, approach) {
  const prefix = `${approach}-`;
  let shift = 0;
  for (const [socketId, placement] of Object.entries(plan.placements)) {
    if (socketId.startsWith(prefix) && placement.type === 'barricade') {
      const direction = socketId.endsWith('middle') ? -1 : 1;
      shift += FORTIFICATION_DEFINITIONS.barricade.routeShift * direction;
    }
  }
  return Math.max(-6, Math.min(6, shift));
}

/**
 * Steer a gate-bound lane away from a placed barricade.  The socket offset is
 * measured from the lane centre, so the safe route is always on the opposite
 * side of the obstruction.  Keeping this policy in one tested helper avoids a
 * sign inversion that can drive enemies directly into the barricade face.
 */
export function routeShiftAwayFromSocket(socketX, laneCenter, maximumShift = 5.5) {
  const x = Number(socketX);
  const centre = Number(laneCenter);
  const limit = Math.max(0, Number(maximumShift) || 0);
  if (!Number.isFinite(x) || !Number.isFinite(centre) || limit === 0) return 0;
  return Math.max(-limit, Math.min(limit, (centre - x) * 0.45));
}

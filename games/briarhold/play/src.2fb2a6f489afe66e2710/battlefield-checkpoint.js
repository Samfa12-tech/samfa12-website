import {MAX_PLAYER_TARGETS} from './battlefield.js';

const CHECKPOINT_VERSION = 2;

const BODY_ARRAY_FIELDS = Object.freeze([
  'ids',
  'x',
  'z',
  'vx',
  'vz',
  'type',
  'status',
  'hp',
  'maxHp',
  'threatMass',
  'gatePressure',
  'rewardShare',
  'approach',
  'zone',
  'attackCooldown',
  'deathTimer',
  'lastHitTime',
  'lastAttackTime',
  'stateProgress',
  'desiredVx',
  'desiredVz',
  'marchStartTime',
  'companyIndex',
  'companyReleaseAt',
  'engagementRole',
  'waitingRank',
  'dedicatedHunter',
  'huntingPlayer',
  'generatedSpawn',
  'generatedMarchDelay',
  'formationPace',
  'outerOverflowRank',
  'outerFormationRank',
  'outerFormationStopZ',
  'heartOverflowRank',
  'obstacleRouteIndex',
  'obstacleRouteSide',
  'obstacleRouteDirection',
  'obstacleRouteTargetX',
  'obstacleRouteTargetZ',
]);

const OBSTACLE_ROUTE_ARRAY_FIELDS = Object.freeze([
  'obstacleRouteIndex',
  'obstacleRouteSide',
  'obstacleRouteDirection',
  'obstacleRouteTargetX',
  'obstacleRouteTargetZ',
]);

const SWARM_ARRAY_FIELDS = Object.freeze([
  'playerTargetIndexById',
  'playerSwarmSlotById',
  'playerSwarmIdBySlot',
  'playerSwarmFreeSlots',
]);

const FINITE_BODY_ARRAY_FIELDS = Object.freeze([
  'x',
  'z',
  'vx',
  'vz',
  'hp',
  'maxHp',
  'threatMass',
  'gatePressure',
  'rewardShare',
  'attackCooldown',
  'deathTimer',
  'lastHitTime',
  'lastAttackTime',
  'stateProgress',
  'desiredVx',
  'desiredVz',
  'marchStartTime',
  'companyReleaseAt',
  'formationPace',
]);

const CHECKPOINT_SCALARS = Object.freeze([
  'activeCount',
  'slotCount',
  'accumulator',
  'elapsed',
  'fixedTicks',
  'firstCompanyCrossedAt',
  'heartGateHp',
  'pendingPlayerDamage',
  'outerOverflowNext',
  'heartOverflowNext',
  'playerSwarmFreeCount',
  'playerSwarmNextSlot',
]);

// The render-frame accumulator is required to resume a local process exactly,
// but it is deliberately absent from cross-client divergence hashes. Different
// frame chunking may leave sub-tick floating residue while producing the same
// authoritative fixed ticks and gameplay state.
const HASHED_SCALARS = Object.freeze(CHECKPOINT_SCALARS.filter(field => field !== 'accumulator'));

function finite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}

function integer(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} is out of range`);
  }
  return value;
}

function cloneRecord(record = {}) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value]));
}

function cloneRecords(records = []) {
  return records.map(record => cloneRecord(record));
}

function cloneTypedPrefix(value, length, label) {
  if (!ArrayBuffer.isView(value) || value instanceof DataView || value.length < length) {
    throw new TypeError(`${label} must be a typed array with ${length} entries`);
  }
  return value.slice(0, length);
}

function checkpointArray(checkpoint, field, Constructor, length) {
  const value = checkpoint.arrays?.[field];
  if (!(value instanceof Constructor) || value.length !== length) {
    throw new TypeError(`checkpoint array ${field} must be ${Constructor.name}[${length}]`);
  }
  return value;
}

function clonePlayerTarget(target = {}) {
  const normalized = {
    enabled: target.enabled === true,
    playerId: target.playerId ?? 'player-0',
    x: finite(target.x, 'playerTarget.x'),
    y: finite(target.y, 'playerTarget.y'),
    z: finite(target.z, 'playerTarget.z'),
    radius: finite(target.radius, 'playerTarget.radius'),
    exposed: target.exposed === true,
    aggroRadius: finite(target.aggroRadius, 'playerTarget.aggroRadius'),
    retainRadius: finite(target.retainRadius, 'playerTarget.retainRadius'),
  };
  if (normalized.radius < 0.1
    || normalized.aggroRadius < 0
    || normalized.retainRadius < normalized.aggroRadius) {
    throw new RangeError('playerTarget radii are invalid');
  }
  return normalized;
}

function clonePlayerTargets(targets, legacyTarget) {
  if (!Array.isArray(targets)) return clonePlayerTarget(legacyTarget);
  return targets.map(target => clonePlayerTarget(target));
}

export function createBattlefieldCheckpoint(battlefield) {
  if (!battlefield || !Number.isInteger(battlefield.capacity)) {
    throw new TypeError('A Battlefield instance is required');
  }
  battlefield.assertIntegrity();
  const slotCount = integer(battlefield.slotCount, 0, battlefield.capacity, 'slotCount');
  const arrays = {};
  for (const field of BODY_ARRAY_FIELDS) {
    arrays[field] = cloneTypedPrefix(battlefield[field], slotCount, field);
  }
  for (const field of SWARM_ARRAY_FIELDS) {
    arrays[field] = cloneTypedPrefix(battlefield[field], battlefield.capacity, field);
  }
  arrays.outerGateHp = cloneTypedPrefix(battlefield.outerGateHp, 2, 'outerGateHp');
  arrays.outerGateBreached = cloneTypedPrefix(battlefield.outerGateBreached, 2, 'outerGateBreached');

  return {
    version: CHECKPOINT_VERSION,
    capacity: battlefield.capacity,
    fixedStep: battlefield.fixedStep,
    maxSubSteps: battlefield.maxSubSteps,
    playerSwarmCap: battlefield.playerSwarmCap,
    outerGatePressureScale: battlefield.outerGatePressureScale,
    outerGateContactPressureScale: battlefield.outerGateContactPressureScale,
    initialSpawnBounds: {...battlefield.initialSpawnBounds},
    scalars: Object.fromEntries(CHECKPOINT_SCALARS.map(field => [field, battlefield[field]])),
    playerTarget: clonePlayerTarget(battlefield.playerTarget),
    playerTargets: clonePlayerTargets(battlefield.playerTargets, battlefield.playerTarget),
    pendingPlayerDamageByPlayer: cloneRecord(battlefield.pendingPlayerDamageByPlayer),
    arrays,
    barricades: battlefield.barricades.map(lane => cloneRecords(lane)),
    enemyObstacles: cloneRecords(battlefield.enemyObstacles),
    playerDamageEvents: cloneRecords(battlefield.playerDamageEvents),
    diagnostics: cloneRecord(battlefield.diagnostics),
    breachSolvers: battlefield.breachSolvers.map(solver => solver.createCheckpoint()),
    heartBreachSolver: battlefield.heartBreachSolver.createCheckpoint(),
  };
}

function validateCheckpointShape(battlefield, checkpoint) {
  if (!checkpoint || checkpoint.version !== CHECKPOINT_VERSION) {
    throw new TypeError('Unsupported battlefield checkpoint');
  }
  if (checkpoint.capacity !== battlefield.capacity
    || checkpoint.fixedStep !== battlefield.fixedStep
    || checkpoint.maxSubSteps !== battlefield.maxSubSteps
    || checkpoint.playerSwarmCap !== battlefield.playerSwarmCap
    || checkpoint.outerGatePressureScale !== battlefield.outerGatePressureScale
    || (checkpoint.outerGateContactPressureScale ?? 1) !== battlefield.outerGateContactPressureScale) {
    throw new RangeError('Battlefield checkpoint configuration mismatch');
  }
  const slotCount = integer(checkpoint.scalars?.slotCount, 0, battlefield.capacity, 'slotCount');
  const routeArrayCount = OBSTACLE_ROUTE_ARRAY_FIELDS
    .filter(field => checkpoint.arrays?.[field] !== undefined).length;
  if (routeArrayCount !== 0 && routeArrayCount !== OBSTACLE_ROUTE_ARRAY_FIELDS.length) {
    throw new TypeError('Battlefield checkpoint obstacle route arrays must be all present or all absent');
  }
  integer(checkpoint.scalars?.activeCount, 0, slotCount, 'activeCount');
  integer(checkpoint.scalars?.fixedTicks, 0, Number.MAX_SAFE_INTEGER, 'fixedTicks');
  integer(checkpoint.scalars?.playerSwarmFreeCount, 0, battlefield.capacity, 'playerSwarmFreeCount');
  integer(checkpoint.scalars?.playerSwarmNextSlot, 0, battlefield.capacity, 'playerSwarmNextSlot');
  integer(checkpoint.scalars?.outerOverflowNext, 0, Number.MAX_SAFE_INTEGER, 'outerOverflowNext');
  integer(checkpoint.scalars?.heartOverflowNext, 0, Number.MAX_SAFE_INTEGER, 'heartOverflowNext');
  for (const field of ['accumulator', 'elapsed', 'heartGateHp', 'pendingPlayerDamage']) {
    finite(checkpoint.scalars?.[field], field);
  }
  clonePlayerTarget(checkpoint.playerTarget);
  const playerTargets = checkpoint.playerTargets ?? [checkpoint.playerTarget];
  if (!Array.isArray(playerTargets) || playerTargets.length > MAX_PLAYER_TARGETS) {
    throw new RangeError('Battlefield checkpoint player target count is invalid');
  }
  for (const target of playerTargets) clonePlayerTarget(target);
  const emptySpawnBounds = slotCount === 0
    && checkpoint.initialSpawnBounds?.minZ === null
    && checkpoint.initialSpawnBounds?.maxZ === null;
  const finiteSpawnBounds = Number.isFinite(checkpoint.initialSpawnBounds?.minZ)
    && Number.isFinite(checkpoint.initialSpawnBounds?.maxZ)
    && checkpoint.initialSpawnBounds.minZ <= checkpoint.initialSpawnBounds.maxZ;
  if (!emptySpawnBounds && !finiteSpawnBounds) {
    throw new TypeError('Battlefield checkpoint initial spawn bounds are invalid');
  }

  for (const field of BODY_ARRAY_FIELDS) {
    // Version 2 checkpoints written before the authored hunter-role field
    // remain loadable. Their Sporewings retain the historical all-hunter
    // interpretation during restore.
    if ((field === 'dedicatedHunter' || field === 'obstacleRouteIndex' || field === 'obstacleRouteSide'
      || field === 'obstacleRouteDirection' || field === 'obstacleRouteTargetX'
      || field === 'obstacleRouteTargetZ')
      && !checkpoint.arrays?.[field]) continue;
    checkpointArray(checkpoint, field, battlefield[field].constructor, slotCount);
  }
  for (const field of SWARM_ARRAY_FIELDS) {
    if (field === 'playerTargetIndexById' && !checkpoint.arrays?.[field]) continue;
    checkpointArray(checkpoint, field, battlefield[field].constructor, battlefield.capacity);
  }
  checkpointArray(checkpoint, 'outerGateHp', battlefield.outerGateHp.constructor, 2);
  checkpointArray(checkpoint, 'outerGateBreached', battlefield.outerGateBreached.constructor, 2);
  for (let id = 0; id < slotCount; id += 1) {
    if (checkpoint.arrays.ids[id] !== id) throw new RangeError(`Stable checkpoint ID mismatch at ${id}`);
    for (const field of FINITE_BODY_ARRAY_FIELDS) {
      if (!Number.isFinite(checkpoint.arrays[field][id])) {
        throw new TypeError(`checkpoint array ${field} contains non-finite state at ${id}`);
      }
    }
    if (checkpoint.arrays.maxHp[id] <= 0
      || checkpoint.arrays.hp[id] < 0
      || checkpoint.arrays.hp[id] > checkpoint.arrays.maxHp[id]) {
      throw new RangeError(`checkpoint HP is invalid at ${id}`);
    }
    const targetIndex = checkpoint.arrays.playerTargetIndexById?.[id] ?? -1;
    if (!Number.isInteger(targetIndex) || targetIndex < -1 || targetIndex > 1) {
      throw new RangeError(`checkpoint player target assignment is invalid at ${id}`);
    }
  }
  for (const hp of checkpoint.arrays.outerGateHp) {
    if (!Number.isFinite(hp) || hp < 0) throw new RangeError('checkpoint outer gate HP is invalid');
  }
  if (!Array.isArray(checkpoint.barricades) || checkpoint.barricades.length !== 2) {
    throw new TypeError('Battlefield checkpoint requires two barricade lanes');
  }
  if (!Array.isArray(checkpoint.enemyObstacles)
    || !Array.isArray(checkpoint.playerDamageEvents)
    || !Array.isArray(checkpoint.breachSolvers)
    || checkpoint.breachSolvers.length !== battlefield.breachSolvers.length) {
    throw new TypeError('Battlefield checkpoint collections are invalid');
  }
  return slotCount;
}

export function restoreBattlefieldCheckpoint(battlefield, checkpoint) {
  if (!battlefield || typeof battlefield.reset !== 'function') {
    throw new TypeError('A Battlefield instance is required');
  }
  const slotCount = validateCheckpointShape(battlefield, checkpoint);
  battlefield.reset();

  for (const field of BODY_ARRAY_FIELDS) {
    if ((field === 'dedicatedHunter' || field === 'obstacleRouteIndex' || field === 'obstacleRouteSide'
      || field === 'obstacleRouteDirection' || field === 'obstacleRouteTargetX'
      || field === 'obstacleRouteTargetZ')
      && !checkpoint.arrays[field]) continue;
    battlefield[field].set(checkpoint.arrays[field], 0);
  }
  if (!checkpoint.arrays.dedicatedHunter) {
    for (let id = 0; id < slotCount; id += 1) {
      battlefield.dedicatedHunter[id] = battlefield.type[id] === 3 ? 1 : 0;
    }
  }
  if (!checkpoint.arrays.obstacleRouteIndex) battlefield.obstacleRouteIndex.fill(-1);
  if (!checkpoint.arrays.obstacleRouteSide) battlefield.obstacleRouteSide.fill(0);
  if (!checkpoint.arrays.obstacleRouteDirection) battlefield.obstacleRouteDirection.fill(0);
  if (!checkpoint.arrays.obstacleRouteTargetX) battlefield.obstacleRouteTargetX.fill(Number.NaN);
  if (!checkpoint.arrays.obstacleRouteTargetZ) battlefield.obstacleRouteTargetZ.fill(Number.NaN);
  for (const field of SWARM_ARRAY_FIELDS) {
    if (field === 'playerTargetIndexById' && !checkpoint.arrays[field]) {
      battlefield[field].fill(-1);
    } else {
      battlefield[field].set(checkpoint.arrays[field], 0);
    }
  }
  battlefield.outerGateHp.set(checkpoint.arrays.outerGateHp);
  battlefield.outerGateBreached.set(checkpoint.arrays.outerGateBreached);
  for (const field of CHECKPOINT_SCALARS) battlefield[field] = checkpoint.scalars[field];
  battlefield._configureOuterPressureFormation(battlefield.slotCount);
  battlefield.initialSpawnBounds = Object.freeze({...checkpoint.initialSpawnBounds});
  battlefield.setPlayerTargets(checkpoint.playerTargets ?? (checkpoint.playerTarget.enabled
    ? [checkpoint.playerTarget]
    : []));
  battlefield.playerTargetIndexById.set(checkpoint.arrays.playerTargetIndexById ?? new Int8Array(battlefield.capacity));
  if (!checkpoint.arrays.playerTargetIndexById) battlefield.playerTargetIndexById.fill(-1);
  for (let lane = 0; lane < checkpoint.barricades.length; lane += 1) {
    for (const barricade of checkpoint.barricades[lane]) battlefield.setBarricade(lane, barricade);
  }
  for (const obstacle of checkpoint.enemyObstacles) battlefield.setEnemyObstacle(obstacle);
  // Registering sorted obstacles invalidates live route indices. Once the exact
  // checkpoint collection exists again, restore the matching authoritative
  // commitment so replay resumes on the same side of a paired obstruction.
  if (checkpoint.arrays.obstacleRouteIndex) {
    battlefield.obstacleRouteIndex.set(checkpoint.arrays.obstacleRouteIndex, 0);
    battlefield.obstacleRouteSide.set(checkpoint.arrays.obstacleRouteSide, 0);
    battlefield.obstacleRouteDirection.set(checkpoint.arrays.obstacleRouteDirection, 0);
    if (checkpoint.arrays.obstacleRouteTargetX) battlefield.obstacleRouteTargetX.set(checkpoint.arrays.obstacleRouteTargetX, 0);
    if (checkpoint.arrays.obstacleRouteTargetZ) battlefield.obstacleRouteTargetZ.set(checkpoint.arrays.obstacleRouteTargetZ, 0);
  }
  battlefield.playerDamageEvents.push(...cloneRecords(checkpoint.playerDamageEvents));
  battlefield.pendingPlayerDamageByPlayer = cloneRecord(checkpoint.pendingPlayerDamageByPlayer);
  for (const key of Object.keys(battlefield.diagnostics)) {
    const value = checkpoint.diagnostics?.[key];
    battlefield.diagnostics[key] = Number.isFinite(value) ? value : 0;
  }
  for (let lane = 0; lane < battlefield.breachSolvers.length; lane += 1) {
    battlefield.breachSolvers[lane].restoreCheckpoint(checkpoint.breachSolvers[lane]);
  }
  battlefield.heartBreachSolver.restoreCheckpoint(checkpoint.heartBreachSolver);
  battlefield.assertIntegrity();
  return battlefield;
}

class CanonicalHashWriter {
  constructor() {
    this.left = 0x811c9dc5;
    this.right = 0x9e3779b9;
    this.buffer = new ArrayBuffer(8);
    this.view = new DataView(this.buffer);
    this.bytes = new Uint8Array(this.buffer);
    this.encoder = new TextEncoder();
  }

  byte(value) {
    const byte = value & 0xff;
    this.left = Math.imul(this.left ^ byte, 0x01000193) >>> 0;
    this.right = Math.imul(this.right ^ byte, 0x85ebca6b) >>> 0;
  }

  bytesOf(bytes) {
    for (let index = 0; index < bytes.length; index += 1) this.byte(bytes[index]);
  }

  uint32(value) {
    this.view.setUint32(0, value >>> 0, true);
    this.bytesOf(this.bytes.subarray(0, 4));
  }

  float64(value) {
    if (Number.isNaN(value)) {
      // Battlefield formation arrays use NaN as an authored "unassigned"
      // sentinel. Encode one explicit quiet-NaN bit pattern so browser and
      // server runtimes cannot disagree about implementation-specific NaNs.
      this.view.setUint32(0, 0, true);
      this.view.setUint32(4, 0x7ff80000, true);
    } else {
      this.view.setFloat64(0, Object.is(value, -0) ? 0 : Number(value), true);
    }
    this.bytesOf(this.bytes);
  }

  string(value) {
    const bytes = this.encoder.encode(String(value));
    this.uint32(bytes.length);
    this.bytesOf(bytes);
  }

  value(value) {
    if (value === null) {
      this.byte(0);
    } else if (typeof value === 'boolean') {
      this.byte(value ? 2 : 1);
    } else if (typeof value === 'number') {
      this.byte(3);
      this.float64(value);
    } else if (typeof value === 'string') {
      this.byte(4);
      this.string(value);
    } else if (Array.isArray(value)) {
      this.byte(5);
      this.uint32(value.length);
      for (const item of value) this.value(item);
    } else if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      this.byte(6);
      this.string(value.constructor.name);
      this.uint32(value.length);
      for (let index = 0; index < value.length; index += 1) this.float64(value[index]);
    } else if (value && typeof value === 'object') {
      this.byte(7);
      const keys = Object.keys(value).sort();
      this.uint32(keys.length);
      for (const key of keys) {
        this.string(key);
        this.value(value[key]);
      }
    } else {
      throw new TypeError(`Unsupported canonical value: ${typeof value}`);
    }
  }

  digest() {
    return `${this.left.toString(16).padStart(8, '0')}${this.right.toString(16).padStart(8, '0')}`;
  }
}

export function hashBattlefieldCheckpoint(checkpoint) {
  if (!checkpoint || checkpoint.version !== CHECKPOINT_VERSION) {
    throw new TypeError('Unsupported battlefield checkpoint');
  }
  const writer = new CanonicalHashWriter();
  writer.string('briarhold-battlefield-checkpoint-v1');
  writer.value({
    version: checkpoint.version,
    capacity: checkpoint.capacity,
    fixedStep: checkpoint.fixedStep,
    maxSubSteps: checkpoint.maxSubSteps,
    playerSwarmCap: checkpoint.playerSwarmCap,
    outerGatePressureScale: checkpoint.outerGatePressureScale,
    outerGateContactPressureScale: checkpoint.outerGateContactPressureScale ?? 1,
    initialSpawnBounds: checkpoint.initialSpawnBounds,
    scalars: Object.fromEntries(HASHED_SCALARS.map(field => [field, checkpoint.scalars[field]])),
    playerTarget: checkpoint.playerTarget,
    playerTargets: checkpoint.playerTargets ?? [checkpoint.playerTarget],
    pendingPlayerDamageByPlayer: checkpoint.pendingPlayerDamageByPlayer ?? {},
    arrays: checkpoint.arrays,
    barricades: checkpoint.barricades,
    enemyObstacles: checkpoint.enemyObstacles,
    playerDamageEvents: checkpoint.playerDamageEvents,
    breachSolvers: checkpoint.breachSolvers.map(solver => ({
      version: solver.version,
      capacity: solver.capacity,
      maxEnemies: solver.maxEnemies,
      tick: solver.tick,
      ids: solver.ids,
    })),
    heartBreachSolver: {
      version: checkpoint.heartBreachSolver.version,
      capacity: checkpoint.heartBreachSolver.capacity,
      maxEnemies: checkpoint.heartBreachSolver.maxEnemies,
      tick: checkpoint.heartBreachSolver.tick,
      ids: checkpoint.heartBreachSolver.ids,
    },
  });
  return `bf1-${writer.digest()}`;
}

export function hashBattlefieldState(battlefield) {
  return hashBattlefieldCheckpoint(createBattlefieldCheckpoint(battlefield));
}

export const BATTLEFIELD_CHECKPOINT_VERSION = CHECKPOINT_VERSION;

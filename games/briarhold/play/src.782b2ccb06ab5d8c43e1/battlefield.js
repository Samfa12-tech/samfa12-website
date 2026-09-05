import {
  BRIARBOUND,
  ROOT_SAPPER,
  SPOREWING,
  WICKER_COLOSSUS,
  enemyArchetype,
  enemyTypeFrom,
  isBreachEligible
} from "./enemies.js";
import {createBreachSolver} from "./breach-solver.js";
import {HOST_EMERGENCE_PROFILE} from "./map-definition.js";

export const DORMANT = 0;
export const ACTIVE = 1;
export const DEAD = 2;
export const DYING = 3;
export const ENEMY_DEATH_SECONDS = 0.65;
export const ENEMY_ATTACK_VISUAL_SECONDS = 0.52;
export const ENEMY_ATTACK_IMPACT_FRACTION = 0.58;

// Authoritative enemy intent is deliberately separate from locomotion and
// animation. In particular, a planted reserve and a planted gate attacker
// can both have zero physical velocity while requiring opposite presentation
// and damage semantics.
export const ENGAGEMENT_RESERVE = 0;
export const ENGAGEMENT_MARCHING = 1;
export const ENGAGEMENT_GATE_QUEUE = 2;
export const ENGAGEMENT_GATE_ATTACK = 3;
export const ENGAGEMENT_PLAYER_ATTACK = 4;
export const ENGAGEMENT_HUNTER = 5;
export const ENEMY_ENGAGEMENT_ROLES = Object.freeze({
  RESERVE: ENGAGEMENT_RESERVE,
  MARCHING: ENGAGEMENT_MARCHING,
  GATE_QUEUE: ENGAGEMENT_GATE_QUEUE,
  GATE_ATTACK: ENGAGEMENT_GATE_ATTACK,
  PLAYER_ATTACK: ENGAGEMENT_PLAYER_ATTACK,
  HUNTER: ENGAGEMENT_HUNTER,
});
export const ENEMY_ENGAGEMENT_ROLE_NAMES = Object.freeze([
  'reserve',
  'marching',
  'gateQueue',
  'gateAttack',
  'playerAttack',
  'hunter',
]);

export const APPROACH_ZONE = 0;
export const COURTYARD_ZONE = 1;

export const WEST = 0;
export const EAST = 1;
// Match the proven granular gate budget used by the 2K/6K Last Guard profiles.
// A normal Night 1 company now enters one physical swarm instead of parking
// most of its visible bodies in a 48-slot wait-your-turn formation. True stress
// overflow remains bounded and keeps the existing stable authored ranks.
export const DEFAULT_BREACH_PACKING_CAPACITY = 512;
export const CAMPAIGN_GATE_PRESSURE_MAX_BODIES = 256;
// Sporewing art is a 3.45 m-wide billboard. A logical radius alone therefore
// lets a hunter's visible wings cross the first-person near plane even while
// its centre remains outside the Warden capsule. Keep the physical centre far
// enough away for the complete billboard, plus a small combat-readability gap.
export const HUNTER_CAMERA_CLEARANCE = 4.4;
export const HUNTER_ORBIT_PADDING = 3.95;
export const MAX_PLAYER_TARGETS = 8;

/**
 * Stable ranged-assault slots for lane Sporewings. Their attack is an airborne
 * spore cast, so they should surround a gate instead of occupying the one
 * ground-contact point used by melee bodies.
 */
export function sporewingGateAttackTarget(id, gateX, gateZ = 0) {
  const slot = Math.max(0, Math.trunc(Number(id) || 0)) % 64;
  const column = slot % 8;
  const row = Math.floor(slot / 8);
  return Object.freeze({
    x: finite(gateX) + (column - 3.5) * 1.6,
    z: finite(gateZ) + 1.6 + row * 0.9,
  });
}

// The Wicker Colossus is substantially taller than the ordinary ground host.
// Keep its centre out of the low gatehouse passage until it has cleared the
// west side of the overhead deck, then rejoin the ordinary gate route. This
// is a movement-only clearance envelope; ordinary enemies retain the authored
// straight assault lane.
export const WICKER_LOW_PASSAGE_ROUTE = Object.freeze({
  minX: -22.4,
  maxX: -13.6,
  minZ: 3.2,
  maxZ: 10.4,
  bypassX: -24.6,
  rejoinZ: 2.2,
});

export function wickerLowPassageWaypoint({x = 0, z = 0} = {}) {
  const route = WICKER_LOW_PASSAGE_ROUTE;
  const currentX = finite(x, 0);
  const currentZ = finite(z, 0);
  const lookAhead = 2.4;
  if (currentZ <= route.rejoinZ || currentZ > route.maxZ + lookAhead) return null;
  // Keep returning the bypass waypoint while crossing the narrow band between
  // the passage envelope and the cleared threshold. Without this overlap, the
  // ordinary gate target pulls the Colossus back into the passage for one tick
  // and the two targets make it oscillate forever.
  const insidePassage = currentX >= route.bypassX + 0.6 && currentX <= route.maxX + 1.5;
  const clearedWest = currentX <= route.bypassX + 0.6;
  if (!insidePassage && !clearedWest) return null;
  return clearedWest
    ? {x: route.bypassX, z: route.rejoinZ}
    : {x: route.bypassX, z: route.maxZ + 1};
}

export const DEFAULT_WORLD = Object.freeze({
  westGateX: -16,
  westGateHalfWidth: 3.1,
  eastGateX: 16,
  gateZ: 0,
  spawnZ: 110,
  // The host begins behind the rear tree line and emerges in authored
  // companies. No enemy is placed on the open killing field at wave start.
  spawnNearZ: HOST_EMERGENCE_PROFILE.spawnNearZ,
  spawnFarZ: HOST_EMERGENCE_PROFILE.spawnFarZ,
  spawnNearBandEndZ: HOST_EMERGENCE_PROFILE.spawnNearBandEndZ,
  spawnMiddleBandEndZ: HOST_EMERGENCE_PROFILE.spawnMiddleBandEndZ,
  // Keep a readable vanguard in front while the full individual army remains
  // present in deep middle and rear companies.
  // Spread the full army through the whole approach instead of parking almost
  // three quarters of it in the final thirty metres.  The old weighting made
  // the rear host read as one flat crop of sprites from the firing gallery.
  spawnNearShare: 0.22,
  spawnMiddleShare: 0.48,
  spawnMinX: -50,
  spawnMaxX: 50,
  spawnNearHalfWidth: 10,
  // Keep clear lanes between companies so the horde reads as attacking ranks
  // rather than one rectangular crowd texture from the firing gallery.
  spawnNearBattalionGap: 0.26,
  spawnMiddleBattalionGap: 0.28,
  spawnFarBattalionGap: 0.20,
  vanguardMinSpeedScale: 0.68,
  marchDelayMax: 12,
  exposedPlayerAggroRadius: 12,
  exposedPlayerRetainRadius: 17,
  // A field Warden draws a lethal raiding party, not the entire authored
  // host. The remaining bodies keep marching on and pressuring the gates.
  exposedPlayerAttackerCap: 8,
  spawnHalfWidth: 32,
  // Each approach owns a gate-centred field envelope. Using the full
  // 100-metre map width for one West-Gate wave turned 35-body companies into
  // flat horizon-wide strips and made the individual army read sparse.
  overflowHalfWidth: 32,
  overflowQueueSpacing: 1.52,
  overflowStagingDepth: 10,
  // The solver owns a deep admission volume so bodies can funnel without
  // snapping, but released companies should queue immediately behind the
  // physical gate pack rather than idling at the volume's distant rear edge.
  outerQueueFrontDepth: 8.8,
  courtyardEntryZ: -4,
  heartGateX: 0,
  heartGateZ: -18
});

export function approachMarchSpeedScale(z, world = DEFAULT_WORLD) {
  const nearZ = finite(world.marchFullSpeedZ, 45);
  const farZ = Math.max(nearZ + 1, finite(world.spawnFarZ, DEFAULT_WORLD.spawnFarZ));
  const farScale = clamp(finite(world.marchFarSpeedScale, 0.4), 0.2, 1);
  const depth = clamp((finite(z, nearZ) - nearZ) / (farZ - nearZ), 0, 1);
  return 1 + (farScale - 1) * depth;
}

export function approachVanguardSpeedScale(id, z, world = DEFAULT_WORLD) {
  const spawnNearZ = finite(world.spawnNearZ, DEFAULT_WORLD.spawnNearZ);
  const nearEndZ = Math.max(spawnNearZ + 1, finite(world.spawnNearBandEndZ, DEFAULT_WORLD.spawnNearBandEndZ));
  const depth = clamp((finite(z, nearEndZ) - spawnNearZ) / (nearEndZ - spawnNearZ), 0, 1);
  const minScale = clamp(finite(world.vanguardMinSpeedScale, DEFAULT_WORLD.vanguardMinSpeedScale), 0.4, 1);
  const individualPace = minScale + (1 - minScale) * hash01(Math.max(0, Math.trunc(finite(id, 0))), 397);
  return individualPace + (1 - individualPace) * depth;
}

export function approachFormationHold(z, world = DEFAULT_WORLD) {
  const gateZ = finite(world.gateZ, DEFAULT_WORLD.gateZ);
  const funnelStartZ = gateZ + Math.max(8, finite(world.overflowStagingDepth, DEFAULT_WORLD.overflowStagingDepth) + 8);
  const farZ = Math.max(funnelStartZ + 1, finite(world.spawnFarZ, DEFAULT_WORLD.spawnFarZ));
  return Math.pow(clamp((finite(z, funnelStartZ) - funnelStartZ) / (farZ - funnelStartZ), 0, 1), 1.35);
}

export function isPlayerExposedToApproachHorde(position = {}, world = DEFAULT_WORLD) {
  const gateZ = finite(world.gateZ, DEFAULT_WORLD.gateZ);
  return finite(position.y, 0) <= 1.6 && finite(position.z, gateZ) >= gateZ + 2;
}

export function exposedPlayerSwarmSlot(rankValue, playerTarget = {}, bodyRadius = 0.66) {
  let remaining = Math.max(0, Math.floor(finite(rankValue, 0)));
  let ring = 1;
  while (remaining >= ring * 6) {
    remaining -= ring * 6;
    ring++;
  }
  const slotsInRing = ring * 6;
  const phase = hash01(ring, 719) * Math.PI * 2;
  const angle = phase + remaining / slotsInRing * Math.PI * 2;
  const radius = Math.max(0.1, finite(playerTarget.radius, 0.48))
    + Math.max(0.1, finite(bodyRadius, 0.66))
    + 0.28
    + (ring - 1) * 1.58;
  return {
    x: finite(playerTarget.x, 0) + Math.cos(angle) * radius,
    z: finite(playerTarget.z, 0) + Math.sin(angle) * radius,
    ring,
  };
}

/**
 * Dedicated flyers retain their own threat budget, but should not all resolve
 * to the exact centre of a first-person camera. Give each stable hunter rank a
 * deterministic orbit point. Six hunters fit on the first ring; higher caps
 * add wider rings without changing IDs, damage, or attack cadence.
 */
export function hunterPlayerOrbitTarget(rankValue, playerTarget = {}, bodyRadius = 0.55) {
  let remaining = Math.max(0, Math.floor(finite(rankValue, 0)));
  let ring = 1;
  while (remaining >= ring * 6) {
    remaining -= ring * 6;
    ring++;
  }
  const slotsInRing = ring * 6;
  const phase = hash01(ring, 911) * Math.PI * 2;
  const angle = phase + remaining / slotsInRing * Math.PI * 2;
  const radius = Math.max(0.1, finite(playerTarget.radius, 0.48))
    + Math.max(0.1, finite(bodyRadius, 0.55))
    + HUNTER_ORBIT_PADDING
    + (ring - 1) * 4.6;
  return {
    x: finite(playerTarget.x, 0) + Math.cos(angle) * radius,
    z: finite(playerTarget.z, 0) + Math.sin(angle) * radius,
    radius,
    ring,
  };
}

export function spawnDepthRatio(id, world = DEFAULT_WORLD) {
  const spawnNearZ = finite(world.spawnNearZ, DEFAULT_WORLD.spawnNearZ);
  const spawnFarZ = Math.max(spawnNearZ + 1, finite(world.spawnFarZ, DEFAULT_WORLD.spawnFarZ));
  const nearEnd = clamp(finite(world.spawnNearBandEndZ, DEFAULT_WORLD.spawnNearBandEndZ), spawnNearZ, spawnFarZ);
  const middleEnd = clamp(finite(world.spawnMiddleBandEndZ, DEFAULT_WORLD.spawnMiddleBandEndZ), nearEnd, spawnFarZ);
  const nearShare = clamp(finite(world.spawnNearShare, DEFAULT_WORLD.spawnNearShare), 0, 1);
  const middleShare = clamp(finite(world.spawnMiddleShare, DEFAULT_WORLD.spawnMiddleShare), 0, 1 - nearShare);
  const selector = hash01(id, 31);
  const withinBand = hash01(id, 59);
  let startZ;
  let endZ;
  if (selector < nearShare) {
    startZ = spawnNearZ;
    endZ = nearEnd;
  } else if (selector < nearShare + middleShare) {
    startZ = nearEnd;
    endZ = middleEnd;
  } else {
    startZ = middleEnd;
    endZ = spawnFarZ;
  }
  return clamp((startZ + (endZ - startZ) * withinBand - spawnNearZ) / (spawnFarZ - spawnNearZ), 0, 1);
}

export function spawnBattalionOffset(id, battalionCount = 5, gapRatio = 0.1) {
  const count = Math.max(1, Math.floor(finite(battalionCount, 5)));
  const gap = clamp(finite(gapRatio, 0.1), 0, count > 1 ? 1.5 / (count - 1) : 0);
  const segmentWidth = (2 - gap * (count - 1)) / count;
  const battalion = Math.min(count - 1, Math.floor(hash01(id, 211) * count));
  return -1
    + battalion * (segmentWidth + gap)
    + hash01(id, 157) * segmentWidth;
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function resolveGateDurability(capacity = 2000) {
  const armySize = positiveInteger(capacity, 2000);
  return Object.freeze({
    outerGateHp: Math.max(1200, armySize * 140),
    heartGateHp: Math.max(2200, armySize * 160)
  });
}

function hash01(id, salt = 0) {
  let hash = Math.imul((id + 1) ^ salt, 0x45d9f3b);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x45d9f3b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x100000000;
}

function overflowFormationGrid(world, solver, continuousGatePressure = false) {
  const authoredHalfWidth = finite(world.overflowHalfWidth, 52);
  // Campaign-sized companies should read as one host converging on the gate,
  // not as a horizon-wide planted reservoir. Stress rosters retain the broad
  // stable formation that keeps thousands of bodies granular and bounded.
  const halfWidth = continuousGatePressure
    ? Math.max(solver.corridorHalfWidth + 6, Math.min(18, authoredHalfWidth))
    : Math.max(solver.corridorHalfWidth + 6, authoredHalfWidth);
  const spacing = Math.max(1.32, finite(world.overflowQueueSpacing, 1.52));
  const edgeMargin = 1.8;
  const companyCount = 5;
  const companyGap = 5;
  const rowSpacing = 1.16;
  const depthGap = 3.8;
  const usableWidth = halfWidth * 2 - edgeMargin * 2 - companyGap * (companyCount - 1);
  const columns = Math.max(companyCount, Math.floor(usableWidth / spacing) + 1);
  return {halfWidth, spacing, edgeMargin, companyCount, companyGap, columns, rowSpacing, depthGap};
}

function heartOverflowFormationGrid(world, solver) {
  // The courtyard queue must actually feed the bounded Heart solver. Reusing
  // the 64-metre outer-field grid parked transferred bodies outside its
  // 13-metre corridor at z=-3 forever: the Outer Gate was breached, but the
  // Heart Gate could never receive an attack. Three compact columns-of-
  // companies preserve individual ranks while keeping every target eligible
  // to funnel into the final chokepoint.
  const halfWidth = Math.max(solver.gateHalfWidth + 4, solver.corridorHalfWidth - 1);
  const spacing = Math.max(1.32, finite(world.overflowQueueSpacing, 1.52));
  const edgeMargin = 1.2;
  const companyCount = 3;
  const companyGap = 2;
  const rowSpacing = 1.16;
  const depthGap = 3.8;
  const usableWidth = halfWidth * 2 - edgeMargin * 2 - companyGap * (companyCount - 1);
  const columns = Math.max(companyCount, Math.floor(usableWidth / spacing) + 1);
  return {halfWidth, spacing, edgeMargin, companyCount, companyGap, columns, rowSpacing, depthGap};
}

function closestAvailableColumn(available, target) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < available.length; index++) {
    const distance = Math.abs(available[index] - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return available.splice(bestIndex, 1)[0];
}

function battalionColumnOffsets(columns, companyCount, gapRatio) {
  const count = Math.max(companyCount, columns);
  const segmentWidth = (2 - gapRatio * (companyCount - 1)) / companyCount;
  return Array.from({length: count}, (_, column) => {
    const company = Math.min(companyCount - 1, Math.floor(column * companyCount / count));
    const first = Math.floor(company * count / companyCount);
    const end = Math.floor((company + 1) * count / companyCount);
    const withinCompany = (column - first + 0.5) / Math.max(1, end - first);
    return {
      company,
      segmentWidth,
      offset: -1 + company * (segmentWidth + gapRatio) + withinCompany * segmentWidth,
    };
  });
}

class Battlefield {
  constructor(options = {}) {
    this.capacity = positiveInteger(options.capacity, 2000);
    this.fixedStep = Math.max(1 / 240, finite(options.fixedStep, 1 / 30));
    this.maxSubSteps = positiveInteger(options.maxSubSteps, 8);
    this.world = Object.freeze({...DEFAULT_WORLD, ...(options.world ?? {})});
    this.outerGateMaxHp = Math.max(1, finite(options.outerGateHp, 1200));
    this.heartGateMaxHp = Math.max(1, finite(options.heartGateHp, 2200));
    this.breachPressureDamageScale = Math.max(0, finite(options.breachPressureDamageScale, 0.12));
    this.outerGatePressureScale = Math.max(0, finite(options.outerGatePressureScale, 1));
    this.outerGateContactPressureScale = Math.max(0, finite(options.outerGateContactPressureScale, 1));
    this.continuousGatePressure = false;

    this.ids = new Uint32Array(this.capacity);
    this.x = new Float32Array(this.capacity);
    this.z = new Float32Array(this.capacity);
    this.vx = new Float32Array(this.capacity);
    this.vz = new Float32Array(this.capacity);
    this.type = new Uint8Array(this.capacity);
    this.status = new Uint8Array(this.capacity);
    this.hp = new Float32Array(this.capacity);
    this.maxHp = new Float32Array(this.capacity);
    this.threatMass = new Float32Array(this.capacity);
    this.gatePressure = new Float32Array(this.capacity);
    this.rewardShare = new Float32Array(this.capacity);
    this.approach = new Uint8Array(this.capacity);
    this.zone = new Uint8Array(this.capacity);
    this.attackCooldown = new Float32Array(this.capacity);
    this.deathTimer = new Float32Array(this.capacity);
    this.lastHitTime = new Float32Array(this.capacity);
    this.lastAttackTime = new Float32Array(this.capacity);
    this.stateProgress = new Float32Array(this.capacity);
    this.desiredVx = new Float32Array(this.capacity);
    this.desiredVz = new Float32Array(this.capacity);
    this.marchStartTime = new Float32Array(this.capacity);
    this.companyIndex = new Uint16Array(this.capacity);
    this.companyReleaseAt = new Float32Array(this.capacity);
    this.engagementRole = new Uint8Array(this.capacity);
    this.waitingRank = new Uint8Array(this.capacity);
    // Sporewing is an archetype; dedicated player hunting is an authored role.
    // Keeping the role explicit prevents density-subdivided lane flyers from
    // each inheriting full hunter damage.
    this.dedicatedHunter = new Uint8Array(this.capacity);
    this.huntingPlayer = new Uint8Array(this.capacity);
    this.playerTargetIndexById = new Int8Array(this.capacity);
    this.playerSwarmSlotById = new Int32Array(this.capacity);
    this.playerSwarmIdBySlot = new Int32Array(this.capacity);
    this.playerSwarmFreeSlots = new Int32Array(this.capacity);
    this.playerSwarmSlotById.fill(-1);
    this.playerSwarmIdBySlot.fill(-1);
    this.playerSwarmFreeCount = 0;
    this.playerSwarmNextSlot = 0;
    this.playerSwarmCap = Math.min(
      this.capacity,
      positiveInteger(
        options.playerSwarmCap,
        this.world.exposedPlayerAttackerCap,
      ),
    );
    this.generatedSpawn = new Uint8Array(this.capacity);
    this.generatedMarchDelay = new Uint8Array(this.capacity);
    this.formationPace = new Float32Array(this.capacity);

    this.playerTarget = {
      enabled: false,
      playerId: 'player-0',
      x: 0,
      y: 0,
      z: -10,
      radius: 0.48,
      exposed: false,
      aggroRadius: Math.max(8, finite(this.world.exposedPlayerAggroRadius, 12)),
      retainRadius: Math.max(8, finite(this.world.exposedPlayerRetainRadius, 17)),
    };
    this.playerTargets = [];
    this.pendingPlayerDamage = 0;
    this.pendingPlayerDamageByPlayer = Object.create(null);
    this.playerDamageEvents = [];
    this.attackTelemetryBuffers = [this._emptyAttackTelemetry(), this._emptyAttackTelemetry()];
    this.attackTelemetryBufferIndex = 0;
    this.attackTelemetry = this.attackTelemetryBuffers[0];

    this.ACTIVE = ACTIVE;
    this.DYING = DYING;
    this.APPROACH_ZONE = APPROACH_ZONE;
    this.activeCount = 0;
    this.slotCount = 0;
    this.accumulator = 0;
    this.elapsed = 0;
    this.fixedTicks = 0;
    this.firstCompanyCrossedAt = -1;
    this.initialSpawnBounds = Object.freeze({minZ: null, maxZ: null});
    this.outerGateHp = new Float32Array(2);
    this.outerGateBreached = new Uint8Array(2);
    this.heartGateHp = this.heartGateMaxHp;
    this.barricades = [[], []];
    this.enemyObstacles = [];
    this.obstacleRouteIndex = new Int32Array(this.capacity);
    this.obstacleRouteSide = new Int8Array(this.capacity);
    this.obstacleRouteDirection = new Int8Array(this.capacity);
    this.obstacleRouteTargetX = new Float32Array(this.capacity);
    this.obstacleRouteTargetZ = new Float32Array(this.capacity);
    this.outerOverflowRank = new Int32Array(this.capacity);
    this.outerFormationRank = new Int32Array(this.capacity);
    this.outerFormationStopZ = new Float32Array(this.capacity);
    this.heartOverflowRank = new Int32Array(this.capacity);
    this.outerOverflowNext = 0;
    this.heartOverflowNext = 0;
    // The gate aperture, not the platform body budget, determines how many
    // bodies can occupy the physical granular solve at once. Admitting an
    // entire small wave made every body converge on the same wall cells while
    // bypassing the authored reserve ranks. All other bodies remain active and
    // visible in the stable overflow formation until a physical slot opens.
    const solverCapacity = Math.min(
      this.capacity,
      positiveInteger(options.breachCapacity, DEFAULT_BREACH_PACKING_CAPACITY)
    );
    const standardPacking = solverCapacity <= DEFAULT_BREACH_PACKING_CAPACITY;
    // Briarhold's mixed-radius solver is intentionally smaller than the Last
    // Guard implementation; a fourth bounded pass supplies its equivalent
    // severe-overlap cleanup for the standard 512-body profile.
    const packingIterations = standardPacking ? 4 : 2;
    const packingCorrectionBudget = standardPacking ? 0.7 : 0.18;
    this.breachSolvers = [
      createBreachSolver({
        maxEnemies: this.capacity,
        capacity: solverCapacity,
        gateX: this.world.westGateX,
        gateZ: this.world.gateZ,
        gateHalfWidth: this.world.westGateHalfWidth,
        iterations: packingIterations,
        correctionBudget: packingCorrectionBudget,
      }),
      createBreachSolver({
        maxEnemies: this.capacity,
        capacity: solverCapacity,
        gateX: this.world.eastGateX,
        gateZ: this.world.gateZ,
        iterations: packingIterations,
        correctionBudget: packingCorrectionBudget,
      })
    ];
    this.heartBreachSolver = createBreachSolver({
      maxEnemies: this.capacity,
      capacity: solverCapacity,
      gateX: this.world.heartGateX,
      gateZ: this.world.heartGateZ,
      entryDepth: 18,
      exitDepth: 24,
      corridorHalfWidth: 13,
      gateHalfWidth: 4.8,
      iterations: packingIterations,
      correctionBudget: standardPacking ? 0.7 : 0.3,
      zone: COURTYARD_ZONE,
    });
    this._configureOuterPressureFormation(0);
    this.heartOverflowGrid = heartOverflowFormationGrid(this.world, this.heartBreachSolver);
    this.diagnostics = {
      spawned: 0,
      killed: 0,
      transferredToCourtyard: 0,
      outerGateBreaches: 0,
      heartGateDamage: 0,
      playerDamage: 0,
      hunterAttacks: 0,
      droppedTime: 0
    };
    this.reset();
  }

  reset() {
    this.status.fill(DORMANT);
    this.hp.fill(0);
    this.maxHp.fill(0);
    this.threatMass.fill(0);
    this.gatePressure.fill(0);
    this.rewardShare.fill(0);
    this.vx.fill(0);
    this.vz.fill(0);
    this.attackCooldown.fill(0);
    this.deathTimer.fill(0);
    this.lastHitTime.fill(-1000);
    this.lastAttackTime.fill(-1000);
    this.stateProgress.fill(0);
    this.marchStartTime.fill(0);
    this.companyIndex.fill(0xffff);
    this.companyReleaseAt.fill(0);
    this.engagementRole.fill(ENGAGEMENT_RESERVE);
    this.waitingRank.fill(0);
    this.dedicatedHunter.fill(0);
    this.huntingPlayer.fill(0);
    this.playerTargetIndexById.fill(-1);
    this.playerSwarmSlotById.fill(-1);
    this.playerSwarmIdBySlot.fill(-1);
    this.playerSwarmFreeCount = 0;
    this.playerSwarmNextSlot = 0;
    this.generatedSpawn.fill(0);
    this.generatedMarchDelay.fill(0);
    this.formationPace.fill(0);
    this.activeCount = 0;
    this.slotCount = 0;
    this.accumulator = 0;
    this.elapsed = 0;
    this.fixedTicks = 0;
    this.firstCompanyCrossedAt = -1;
    this.initialSpawnBounds = Object.freeze({minZ: null, maxZ: null});
    this.playerTargets.length = 0;
    this.playerTarget = {
      enabled: false,
      playerId: 'player-0',
      x: 0,
      y: 0,
      z: -10,
      radius: 0.48,
      exposed: false,
      aggroRadius: Math.max(8, finite(this.world.exposedPlayerAggroRadius, 12)),
      retainRadius: Math.max(8, finite(this.world.exposedPlayerRetainRadius, 17)),
    };
    this.outerGateHp.fill(this.outerGateMaxHp);
    this.outerGateBreached.fill(0);
    this.heartGateHp = this.heartGateMaxHp;
    this.pendingPlayerDamage = 0;
    this.pendingPlayerDamageByPlayer = Object.create(null);
    this.playerDamageEvents.length = 0;
    this.attackTelemetryBufferIndex = 0;
    for (const telemetry of this.attackTelemetryBuffers) this._resetAttackTelemetry(telemetry);
    this.attackTelemetry = this.attackTelemetryBuffers[0];
    this.barricades[WEST].length = 0;
    this.barricades[EAST].length = 0;
    this.enemyObstacles.length = 0;
    this.obstacleRouteIndex.fill(-1);
    this.obstacleRouteSide.fill(0);
    this.obstacleRouteDirection.fill(0);
    this.obstacleRouteTargetX.fill(Number.NaN);
    this.obstacleRouteTargetZ.fill(Number.NaN);
    this.breachSolvers[WEST].reset();
    this.breachSolvers[EAST].reset();
    this.heartBreachSolver.reset();
    this.outerOverflowRank.fill(-1);
    this.outerFormationRank.fill(-1);
    this.outerFormationStopZ.fill(Number.NaN);
    this.heartOverflowRank.fill(-1);
    this.outerOverflowNext = 0;
    this.heartOverflowNext = 0;
    for (const key of Object.keys(this.diagnostics)) this.diagnostics[key] = 0;
    return this;
  }

  initialize(enemySpecs = []) {
    this.reset();
    for (const spec of enemySpecs) this.spawnEnemy(spec);
    this._configureOuterPressureFormation(this.slotCount);
    this._arrangeGeneratedSpawns();
    this._assignOuterFormationRanks();
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (let id = 0; id < this.slotCount; id++) {
      minZ = Math.min(minZ, this.z[id]);
      maxZ = Math.max(maxZ, this.z[id]);
    }
    this.initialSpawnBounds = Object.freeze({
      minZ: this.slotCount ? minZ : null,
      maxZ: this.slotCount ? maxZ : null,
    });
    return this;
  }

  _configureOuterPressureFormation(bodyCount = this.slotCount) {
    this.continuousGatePressure = bodyCount > 0
      && bodyCount <= CAMPAIGN_GATE_PRESSURE_MAX_BODIES;
    this.outerOverflowGrids = this.breachSolvers.map(solver => (
      overflowFormationGrid(this.world, solver, this.continuousGatePressure)
    ));
  }

  _typeAwareRowAssignment(rowIds, columns, row) {
    const available = Array.from({length: rowIds.length}, (_, index) => (
      Math.min(columns - 1, Math.floor((index + 0.5) * columns / rowIds.length))
    ));
    const assignment = new Map();
    const types = [...new Set(rowIds.map(id => this.type[id]))]
      .sort((left, right) => enemyArchetype(right).radius - enemyArchetype(left).radius || left - right);
    for (const type of types) {
      const group = rowIds.filter(id => this.type[id] === type).sort((left, right) => left - right);
      const phase = ((row * 0.381966 + type * 0.173) % 1) - 0.5;
      for (let index = 0; index < group.length; index++) {
        const target = clamp((index + 0.5 + phase) / group.length * columns, 0, columns - 1);
        assignment.set(closestAvailableColumn(available, target), group[index]);
      }
    }
    return assignment;
  }

  _arrangeGeneratedSpawns() {
    const spawnNearZ = finite(this.world.spawnNearZ, this.world.spawnZ);
    const spawnFarZ = Math.max(spawnNearZ, finite(this.world.spawnFarZ, spawnNearZ + 8));
    const nearEndZ = clamp(finite(this.world.spawnNearBandEndZ, 50), spawnNearZ, spawnFarZ);
    const middleEndZ = clamp(finite(this.world.spawnMiddleBandEndZ, 88), nearEndZ, spawnFarZ);
    const spawnMinX = finite(this.world.spawnMinX, -50);
    const spawnMaxX = Math.max(spawnMinX, finite(this.world.spawnMaxX, 50));
    const mapHalfWidth = Math.max(6, (spawnMaxX - spawnMinX) * 0.5);
    const bands = [
      {minZ: spawnNearZ, maxZ: nearEndZ, companies: 3, gap: finite(this.world.spawnNearBattalionGap, DEFAULT_WORLD.spawnNearBattalionGap)},
      {minZ: nearEndZ, maxZ: middleEndZ, companies: 4, gap: finite(this.world.spawnMiddleBattalionGap, DEFAULT_WORLD.spawnMiddleBattalionGap)},
      {minZ: middleEndZ, maxZ: spawnFarZ, companies: 5, gap: finite(this.world.spawnFarBattalionGap, DEFAULT_WORLD.spawnFarBattalionGap)},
    ];

    // Authored wave companies own chronological depth bands. Treating their
    // interleaved stable IDs as one generic cloud let the release-zero company
    // leak across all three depth bands, so most of the "vanguard" remained
    // invisible behind later forest ranks. Explicit fixtures retain the generic
    // distribution; real rosters use their company metadata.
    const authoredCompanyCount = Array.from(
      this.companyIndex.subarray(0, this.slotCount),
    ).reduce((largest, companyIndex) => (
      companyIndex === 0xffff ? largest : Math.max(largest, companyIndex + 1)
    ), 0);
    const authoredCompanyBands = authoredCompanyCount > 0
      ? Array.from({length: authoredCompanyCount}, (_, companyIndex) => ({
          companyIndex,
          minZ: spawnNearZ + (spawnFarZ - spawnNearZ) * companyIndex / authoredCompanyCount,
          maxZ: spawnNearZ + (spawnFarZ - spawnNearZ) * (companyIndex + 1) / authoredCompanyCount,
          companies: companyIndex === 0 ? 3 : Math.min(5, companyIndex + 3),
          gap: companyIndex === 0
            ? finite(this.world.spawnNearBattalionGap, DEFAULT_WORLD.spawnNearBattalionGap)
            : companyIndex === authoredCompanyCount - 1
              ? finite(this.world.spawnFarBattalionGap, DEFAULT_WORLD.spawnFarBattalionGap)
              : finite(this.world.spawnMiddleBattalionGap, DEFAULT_WORLD.spawnMiddleBattalionGap),
        }))
      : null;
    const layoutBands = authoredCompanyBands ?? bands;

    for (const lane of [WEST, EAST]) {
      const gateX = lane === WEST ? this.world.westGateX : this.world.eastGateX;
      const boundaryHalfWidth = Math.max(6, Math.min(gateX - spawnMinX, spawnMaxX - gateX));
      const fullHalfWidth = Math.min(
        mapHalfWidth,
        boundaryHalfWidth,
        Math.max(6, finite(this.world.spawnHalfWidth, DEFAULT_WORLD.spawnHalfWidth)),
      );
      const nearHalfWidth = Math.min(fullHalfWidth, Math.max(6, finite(this.world.spawnNearHalfWidth, 10)));
      for (let bandIndex = 0; bandIndex < layoutBands.length; bandIndex++) {
        const band = layoutBands[bandIndex];
        const ids = [];
        for (let id = 0; id < this.slotCount; id++) {
          if (!this.generatedSpawn[id] || this.status[id] !== ACTIVE || this.approach[id] !== lane) continue;
          const inside = authoredCompanyBands
            ? this.companyIndex[id] === band.companyIndex
            : this.z[id] >= band.minZ
              && (bandIndex === layoutBands.length - 1 ? this.z[id] <= band.maxZ : this.z[id] < band.maxZ);
          if (inside) ids.push(id);
        }
        if (!ids.length) continue;
        ids.sort((left, right) => this.z[left] - this.z[right] || left - right);

        const endDepth = clamp((band.maxZ - spawnNearZ) / Math.max(1, spawnFarZ - spawnNearZ), 0, 1);
        const spread = Math.pow(endDepth, 1.35);
        const halfWidth = nearHalfWidth + (fullHalfWidth - nearHalfWidth) * spread;
        const centerX = gateX;
        const usableWidth = halfWidth * 2 - halfWidth * band.gap * (band.companies - 1);
        const availableColumns = Math.max(band.companies, Math.floor(usableWidth / 1.28));
        // A chronological company should read as a formation with depth, not a
        // nearly full front row followed by one or two isolated bodies. Keep
        // generic fixtures unchanged, but balance authored companies across at
        // least three filled ranks. This preserves every stable body, release
        // time, approach envelope, movement speed and pressure budget.
        const minimumRows = authoredCompanyBands ? Math.min(3, ids.length) : 1;
        const rows = Math.max(minimumRows, Math.ceil(ids.length / availableColumns));
        const columns = Math.max(band.companies, Math.ceil(ids.length / rows));
        const columnOffsets = battalionColumnOffsets(columns, band.companies, band.gap);
        const margin = Math.min(0.55, (band.maxZ - band.minZ) * 0.04);
        const usableDepth = Math.max(0, band.maxZ - band.minZ - margin * 2);
        const rowStep = rows > 1 ? usableDepth / (rows - 1) : 0;

        for (let row = 0; row < rows; row++) {
          const rowIds = ids.slice(row * columns, (row + 1) * columns);
          const assignment = this._typeAwareRowAssignment(rowIds, columns, row);

          const marchingIds = rowIds.filter(id => isBreachEligible(this.type[id]));
          const rowPace = marchingIds.reduce(
            (slowest, id) => Math.min(slowest, enemyArchetype(this.type[id]).speed),
            Number.POSITIVE_INFINITY,
          );
          for (const [column, id] of assignment) {
            const columnMeta = columnOffsets[column];
            const segmentLeft = -1 + columnMeta.company * (columnMeta.segmentWidth + band.gap);
            const segmentRight = segmentLeft + columnMeta.segmentWidth;
            const companyColumns = Math.max(1, columns / band.companies);
            const stagger = (row & 1 ? 1 : -1) * columnMeta.segmentWidth / companyColumns * 0.42;
            const offset = clamp(columnMeta.offset + stagger, segmentLeft + 0.01, segmentRight - 0.01);
            this.x[id] = clamp(centerX + offset * halfWidth, spawnMinX, spawnMaxX);
            this.z[id] = rows > 1 ? band.minZ + margin + row * rowStep : (band.minZ + band.maxZ) * 0.5;
            this.formationPace[id] = isBreachEligible(this.type[id]) && Number.isFinite(rowPace) ? rowPace : 0;
            if (this.generatedMarchDelay[id]) {
              const delayDepth = clamp((this.z[id] - nearEndZ) / Math.max(1, spawnFarZ - nearEndZ), 0, 1);
              this.marchStartTime[id] = hash01(id, 131)
                * Math.max(0, finite(this.world.marchDelayMax, 18))
                * Math.pow(delayDepth, 1.2);
            }
          }
        }
      }
    }
  }

  _assignOuterFormationRanks() {
    this.outerFormationRank.fill(-1);
    let largestLaneFormation = 0;
    for (const lane of [WEST, EAST]) {
      const ids = [];
      for (let id = 0; id < this.slotCount; id++) {
        if (this.status[id] !== ACTIVE
          || this.approach[id] !== lane
          || !isBreachEligible(this.type[id])) continue;
        ids.push(id);
      }
      ids.sort((left, right) => this.z[left] - this.z[right] || this.x[left] - this.x[right] || left - right);
      const columns = this.outerOverflowGrids[lane].columns;
      let laneFormationEnd = 0;
      for (let row = 0; row < Math.ceil(ids.length / columns); row++) {
        const rowIds = ids.slice(row * columns, (row + 1) * columns);
        for (const [column, id] of this._typeAwareRowAssignment(rowIds, columns, row)) {
          const rank = row * columns + column;
          this.outerFormationRank[id] = rank;
          laneFormationEnd = Math.max(laneFormationEnd, rank + 1);
        }
      }
      for (const id of ids) {
        this.outerFormationStopZ[id] = Math.min(
          this.z[id],
          this._outerFormationTargetZ(id, this.breachSolvers[lane]),
        );
      }
      largestLaneFormation = Math.max(largestLaneFormation, laneFormationEnd);
    }
    this.outerOverflowNext = largestLaneFormation;
  }

  spawnEnemy(spec = {}) {
    if (this.slotCount >= this.capacity) {
      throw new RangeError(`Battlefield capacity ${this.capacity} exhausted`);
    }
    const id = this.slotCount++;
    const enemyType = enemyTypeFrom(spec.type, BRIARBOUND);
    const archetype = enemyArchetype(enemyType);
    const lane = spec.approach === EAST || spec.approach === "east" ? EAST : WEST;
    const gateX = lane === WEST ? this.world.westGateX : this.world.eastGateX;
    this.ids[id] = id;
    this.type[id] = enemyType;
    this.dedicatedHunter[id] = enemyType === SPOREWING
      && spec.targetMode !== "lane"
      && spec.hunter !== false ? 1 : 0;
    this.status[id] = ACTIVE;
    this.zone[id] = APPROACH_ZONE;
    this.approach[id] = lane;
    this.maxHp[id] = Math.max(1, finite(spec.maxHp, archetype.maxHp));
    this.hp[id] = clamp(finite(spec.hp, this.maxHp[id]), 0, this.maxHp[id]);
    this.threatMass[id] = Math.max(0, finite(spec.threatMass, 1));
    this.gatePressure[id] = Math.max(0, finite(spec.gatePressure, 1));
    this.rewardShare[id] = Math.max(0, finite(spec.rewardShare, 0));
    this.generatedSpawn[id] = Number.isFinite(spec.x) || Number.isFinite(spec.z) ? 0 : 1;
    this.generatedMarchDelay[id] = Number.isFinite(spec.releaseAt) || Number.isFinite(spec.marchStartTime) ? 0 : 1;
    const spawnNearZ = finite(this.world.spawnNearZ, this.world.spawnZ);
    const spawnFarZ = Math.max(spawnNearZ, finite(this.world.spawnFarZ, spawnNearZ + 8));
    const companyCount = positiveInteger(spec.companyCount, 0);
    const companyIndex = Number.isInteger(spec.companyIndex) && spec.companyIndex >= 0
      ? Math.min(0xfffe, spec.companyIndex)
      : 0xffff;
    const companyDepthRatio = companyCount > 0 && companyIndex !== 0xffff
      ? clamp((companyIndex + hash01(id, 59) * 0.82) / companyCount, 0, 1)
      : null;
    const depthRatio = companyDepthRatio ?? spawnDepthRatio(id, this.world);
    this.z[id] = finite(spec.z, spawnNearZ + depthRatio * (spawnFarZ - spawnNearZ));
    const spawnHalfWidth = Math.max(6, finite(this.world.spawnHalfWidth, 32));
    const spawnMinX = finite(this.world.spawnMinX, gateX - spawnHalfWidth);
    const spawnMaxX = Math.max(spawnMinX, finite(this.world.spawnMaxX, gateX + spawnHalfWidth));
    const fullHalfWidth = Math.max(6, (spawnMaxX - spawnMinX) * 0.5);
    const fullCenterX = (spawnMinX + spawnMaxX) * 0.5;
    const nearHalfWidth = Math.min(fullHalfWidth, Math.max(6, finite(this.world.spawnNearHalfWidth, 10)));
    const nearBandEndZ = clamp(finite(this.world.spawnNearBandEndZ, 50), spawnNearZ, spawnFarZ);
    const middleBandEndZ = clamp(finite(this.world.spawnMiddleBandEndZ, 88), nearBandEndZ, spawnFarZ);
    const authoredDepth = clamp((this.z[id] - spawnNearZ) / Math.max(1, spawnFarZ - spawnNearZ), 0, 1);
    const spread = Math.pow(authoredDepth, 1.35);
    const spawnCenterX = gateX + (fullCenterX - gateX) * spread;
    const spawnWidth = nearHalfWidth + (fullHalfWidth - nearHalfWidth) * spread;
    const battalionCount = authoredDepth < (nearBandEndZ - spawnNearZ) / Math.max(1, spawnFarZ - spawnNearZ)
      ? 3
      : authoredDepth < (middleBandEndZ - spawnNearZ) / Math.max(1, spawnFarZ - spawnNearZ)
        ? 4
        : 5;
    const battalionGap = battalionCount === 3
      ? finite(this.world.spawnNearBattalionGap, DEFAULT_WORLD.spawnNearBattalionGap)
      : battalionCount === 4
        ? finite(this.world.spawnMiddleBattalionGap, DEFAULT_WORLD.spawnMiddleBattalionGap)
        : finite(this.world.spawnFarBattalionGap, DEFAULT_WORLD.spawnFarBattalionGap);
    this.x[id] = finite(spec.x, clamp(
      spawnCenterX + spawnBattalionOffset(id, battalionCount, battalionGap) * spawnWidth,
      spawnMinX,
      spawnMaxX,
    ));
    const marchDelayMax = Math.max(0, finite(this.world.marchDelayMax, 18));
    const delayDepth = clamp((this.z[id] - nearBandEndZ) / Math.max(1, spawnFarZ - nearBandEndZ), 0, 1);
    const authoredReleaseAt = Number.isFinite(spec.releaseAt) ? spec.releaseAt : spec.marchStartTime;
    this.marchStartTime[id] = Math.max(0, finite(
      authoredReleaseAt,
      hash01(id, 131) * marchDelayMax * Math.pow(delayDepth, 1.2),
    ));
    this.companyIndex[id] = companyIndex;
    this.companyReleaseAt[id] = this.marchStartTime[id];
    this._setEngagementRole(
      id,
      this.marchStartTime[id] > this.elapsed ? ENGAGEMENT_RESERVE : ENGAGEMENT_MARCHING,
    );
    this.vx[id] = finite(spec.vx, 0);
    this.vz[id] = finite(spec.vz, 0);
    this.attackCooldown[id] = finite(spec.attackCooldown, hash01(id, 47) * archetype.attackInterval);
    this.deathTimer[id] = 0;
    this.lastHitTime[id] = -1000;
    this.lastAttackTime[id] = -1000;
    this.stateProgress[id] = this.hp[id] <= 0 ? 1 : 0;
    if (this.hp[id] <= 0) {
      this.status[id] = DEAD;
    } else {
      this.activeCount++;
    }
    this.diagnostics.spawned++;
    return id;
  }

  _setEngagementRole(id, role, settled = false) {
    this.engagementRole[id] = role;
    this.waitingRank[id] = role === ENGAGEMENT_RESERVE
      || (role === ENGAGEMENT_GATE_QUEUE && settled && !this.continuousGatePressure)
      ? 1
      : 0;
  }

  _outerQueueFrontZ(solver) {
    if (!this.continuousGatePressure) return this.world.gateZ + solver.entryDepth + 0.5;
    return this.world.gateZ + Math.min(
      solver.entryDepth,
      Math.max(2, finite(this.world.outerQueueFrontDepth, DEFAULT_WORLD.outerQueueFrontDepth)),
    );
  }

  setPlayerTarget(target = null) {
    if (!target || target.enabled === false) {
      this.setPlayerTargets([]);
      return false;
    }
    const previous = this.playerTarget ?? {};
    this.setPlayerTargets([{
      ...previous,
      ...target,
      enabled: true,
      playerId: target.playerId ?? previous.playerId ?? 'player-0',
    }]);
    return true;
  }

  setPlayerTargets(targets = []) {
    if (!Array.isArray(targets)) throw new TypeError('Player targets must be an array');
    if (targets.length > MAX_PLAYER_TARGETS) {
      throw new RangeError(`At most ${MAX_PLAYER_TARGETS} player targets are supported`);
    }
    const previousById = new Map(this.playerTargets.map(target => [target.playerId, target]));
    const normalized = targets
      .filter(target => target && target.enabled !== false)
      .map((target, index) => {
        const previous = previousById.get(target.playerId);
        const playerId = target.playerId ?? `player-${index}`;
        const position = target.position ?? {};
        if (typeof playerId !== 'string' && typeof playerId !== 'number') {
          throw new TypeError('Player target playerId must be a string or number');
        }
        const aggroRadius = Math.max(
          8,
          finite(target.aggroRadius ?? target.aggro, previous?.aggroRadius ?? this.world.exposedPlayerAggroRadius),
        );
        return {
          enabled: true,
          playerId,
          x: finite(target.x, finite(position.x, previous?.x ?? 0)),
          y: finite(target.y, finite(position.y, previous?.y ?? 0)),
          z: finite(target.z, finite(position.z, previous?.z ?? -10)),
          radius: Math.max(0.1, finite(target.radius, previous?.radius ?? 0.48)),
          exposed: target.exposed === true,
          aggroRadius,
          retainRadius: Math.max(
            aggroRadius,
            finite(target.retainRadius ?? target.retain, previous?.retainRadius ?? this.world.exposedPlayerRetainRadius),
          ),
        };
      });
    const seen = new Set();
    for (const target of normalized) {
      const key = String(target.playerId);
      if (seen.has(key)) throw new RangeError(`Duplicate player target ID ${key}`);
      seen.add(key);
    }
    normalized.sort((left, right) => String(left.playerId).localeCompare(String(right.playerId)));

    const oldAssignments = this.playerTargetIndexById;
    const oldTargets = this.playerTargets;
    const nextIndexById = new Map(normalized.map((target, index) => [target.playerId, index]));
    for (let id = 0; id < this.slotCount; id++) {
      const oldIndex = oldAssignments[id];
      const oldTarget = oldIndex >= 0 ? oldTargets[oldIndex] : null;
      const nextIndex = oldTarget ? nextIndexById.get(oldTarget.playerId) : undefined;
      this.playerTargetIndexById[id] = nextIndex === undefined ? -1 : nextIndex;
      if (nextIndex === undefined) this._releasePlayerSwarmSlot(id);
    }
    this.playerTargets = normalized;
    this.playerTarget = normalized[0] ?? {
      ...this.playerTarget,
      enabled: false,
    };
    return this.playerTargets.map(target => ({...target}));
  }

  consumePlayerDamage() {
    const amount = this.pendingPlayerDamage;
    const events = this.playerDamageEvents.splice(0);
    const byPlayer = {...this.pendingPlayerDamageByPlayer};
    for (const target of this.playerTargets) {
      const key = String(target.playerId);
      if (!(key in byPlayer)) byPlayer[key] = 0;
    }
    this.pendingPlayerDamage = 0;
    this.pendingPlayerDamageByPlayer = Object.create(null);
    return {amount, events, byPlayer};
  }

  _emptyAttackTelemetry() {
    return {
      player: {count: 0, hunterCount: 0, panWeightedSum: 0, weight: 0, nearestDistance: Number.POSITIVE_INFINITY},
      outerGate: {westCount: 0, eastCount: 0, westIntensity: 0, eastIntensity: 0},
      heartGate: {count: 0, intensity: 0},
    };
  }

  consumeAttackTelemetry() {
    const telemetry = this.attackTelemetry;
    this.attackTelemetryBufferIndex ^= 1;
    this.attackTelemetry = this.attackTelemetryBuffers[this.attackTelemetryBufferIndex];
    this._resetAttackTelemetry(this.attackTelemetry);
    return telemetry;
  }

  _resetAttackTelemetry(telemetry) {
    telemetry.player.count = 0;
    telemetry.player.hunterCount = 0;
    telemetry.player.panWeightedSum = 0;
    telemetry.player.weight = 0;
    telemetry.player.nearestDistance = Number.POSITIVE_INFINITY;
    telemetry.outerGate.westCount = 0;
    telemetry.outerGate.eastCount = 0;
    telemetry.outerGate.westIntensity = 0;
    telemetry.outerGate.eastIntensity = 0;
    telemetry.heartGate.count = 0;
    telemetry.heartGate.intensity = 0;
    return telemetry;
  }

  _recordAttackStart(id, target) {
    const telemetry = this.attackTelemetry;
    const intensity = Math.max(0.05, this.threatMass[id] || this.gatePressure[id] || 1);
    if (target === "player") {
      const playerTarget = this._playerTargetForEnemy(id) ?? this.playerTarget;
      const dx = this.x[id] - playerTarget.x;
      const dz = this.z[id] - playerTarget.z;
      const distance = Math.hypot(dx, dz);
      telemetry.player.count++;
      if (this.dedicatedHunter[id]) telemetry.player.hunterCount++;
      telemetry.player.nearestDistance = Math.min(telemetry.player.nearestDistance, distance);
      telemetry.player.panWeightedSum += clamp(dx / Math.max(1, distance), -1, 1) * intensity;
      telemetry.player.weight += intensity;
      return;
    }
    if (target === "heart") {
      telemetry.heartGate.count++;
      telemetry.heartGate.intensity += intensity;
      return;
    }
    const laneKey = this.approach[id] === EAST ? "east" : "west";
    telemetry.outerGate[`${laneKey}Count`]++;
    telemetry.outerGate[`${laneKey}Intensity`] += intensity;
  }

  setBarricade(approach, barricade) {
    const lane = approach === EAST || approach === "east" ? EAST : WEST;
    if (!barricade || !Number.isFinite(barricade.z) || !Number.isFinite(barricade.shiftX)) {
      throw new TypeError("Barricade requires finite z and shiftX");
    }
    const item = {
      id: barricade.id ?? `barricade-${lane}-${this.barricades[lane].length}`,
      z: barricade.z,
      shiftX: clamp(barricade.shiftX, -10, 10),
      influence: Math.max(4, finite(barricade.influence, 22)),
      enabled: barricade.enabled !== false
    };
    const existing = this.barricades[lane].findIndex((entry) => entry.id === item.id);
    if (existing >= 0) this.barricades[lane][existing] = item;
    else this.barricades[lane].push(item);
    this.barricades[lane].sort((a, b) => b.z - a.z || String(a.id).localeCompare(String(b.id)));
    return item.id;
  }

  removeBarricade(approach, id) {
    const lane = approach === EAST || approach === "east" ? EAST : WEST;
    const index = this.barricades[lane].findIndex((entry) => entry.id === id);
    if (index < 0) return false;
    this.barricades[lane].splice(index, 1);
    return true;
  }

  clearBarricades() {
    this.barricades[WEST].length = 0;
    this.barricades[EAST].length = 0;
  }

  setEnemyObstacle(obstacle) {
    if (!obstacle || obstacle.id == null || !Number.isFinite(obstacle.x) || !Number.isFinite(obstacle.z)) {
      throw new TypeError("Enemy obstacle requires id and finite x/z coordinates");
    }
    const item = {
      id: String(obstacle.id),
      x: finite(obstacle.x, 0),
      z: finite(obstacle.z, 0),
      yaw: finite(obstacle.yaw, 0),
      halfWidth: Math.max(0.1, finite(obstacle.halfWidth, 0.5)),
      halfDepth: Math.max(0.1, finite(obstacle.halfDepth, 0.5)),
      solid: obstacle.solid !== false,
      slowScale: clamp(finite(obstacle.slowScale, 1), 0.1, 1),
      enabled: obstacle.enabled !== false,
      cosine: Math.cos(finite(obstacle.yaw, 0)),
      sine: Math.sin(finite(obstacle.yaw, 0)),
    };
    const existing = this.enemyObstacles.findIndex(entry => entry.id === item.id);
    if (existing >= 0) this.enemyObstacles[existing] = item;
    else this.enemyObstacles.push(item);
    this.enemyObstacles.sort((left, right) => left.id.localeCompare(right.id));
    this.obstacleRouteIndex.fill(-1);
    this.obstacleRouteSide.fill(0);
    this.obstacleRouteDirection.fill(0);
    this.obstacleRouteTargetX.fill(Number.NaN);
    this.obstacleRouteTargetZ.fill(Number.NaN);
    return item.id;
  }

  removeEnemyObstacle(id) {
    const index = this.enemyObstacles.findIndex(entry => entry.id === String(id));
    if (index < 0) return false;
    this.enemyObstacles.splice(index, 1);
    this.obstacleRouteIndex.fill(-1);
    this.obstacleRouteSide.fill(0);
    this.obstacleRouteDirection.fill(0);
    this.obstacleRouteTargetX.fill(Number.NaN);
    this.obstacleRouteTargetZ.fill(Number.NaN);
    return true;
  }

  clearEnemyObstacles() {
    this.enemyObstacles.length = 0;
    this.obstacleRouteIndex.fill(-1);
    this.obstacleRouteSide.fill(0);
    this.obstacleRouteDirection.fill(0);
    this.obstacleRouteTargetX.fill(Number.NaN);
    this.obstacleRouteTargetZ.fill(Number.NaN);
  }

  _obstacleLocal(obstacle, x, z) {
    const cosine = obstacle.cosine;
    const sine = obstacle.sine;
    const dx = x - obstacle.x;
    const dz = z - obstacle.z;
    return {
      x: dx * cosine + dz * sine,
      z: -dx * sine + dz * cosine,
      cosine,
      sine,
    };
  }

  _enemySpeedScaleAt(id) {
    if (this.type[id] === SPOREWING) return 1;
    const radius = enemyArchetype(this.type[id]).radius;
    let scale = 1;
    for (const obstacle of this.enemyObstacles) {
      if (!obstacle.enabled || obstacle.solid || obstacle.slowScale >= scale) continue;
      const local = this._obstacleLocal(obstacle, this.x[id], this.z[id]);
      if (Math.abs(local.x) <= obstacle.halfWidth + radius
        && Math.abs(local.z) <= obstacle.halfDepth + radius) {
        scale = obstacle.slowScale;
      }
    }
    return scale;
  }

  _steerAroundSolidObstaclesLegacy(id) {
    if (this.type[id] === SPOREWING || !this.enemyObstacles.length) return false;
    const desiredX = this.desiredVx[id];
    const desiredZ = this.desiredVz[id];
    const speed = Math.hypot(desiredX, desiredZ);
    if (speed < 0.05) return false;
    const radius = enemyArchetype(this.type[id]).radius;
    let bestDistance = Infinity;
    let bestX = 0;
    let bestZ = 0;
    for (const obstacle of this.enemyObstacles) {
      if (!obstacle.enabled || !obstacle.solid) continue;
      const cosine = obstacle.cosine;
      const sine = obstacle.sine;
      const dx = this.x[id] - obstacle.x;
      const dz = this.z[id] - obstacle.z;
      const localX = dx * cosine + dz * sine;
      const localZ = -dx * sine + dz * cosine;
      const localVx = desiredX * cosine + desiredZ * sine;
      const localVz = -desiredX * sine + desiredZ * cosine;
      const halfWidth = obstacle.halfWidth + radius;
      const halfDepth = obstacle.halfDepth + radius;
      const lookAhead = Math.max(3.5, speed * 0.9);
      const approachingFromPositiveZ = localVz < -0.05 && localZ >= -halfDepth - 0.35
        && localZ - halfDepth <= lookAhead;
      const approachingFromNegativeZ = localVz > 0.05 && localZ <= halfDepth + 0.35
        && -localZ - halfDepth <= lookAhead;
      if (Math.abs(localX) > halfWidth + 0.8
        || (!approachingFromPositiveZ && !approachingFromNegativeZ)) continue;
      const laneGateX = this.approach[id] === WEST ? this.world.westGateX : this.world.eastGateX;
      const gateLocalX = (laneGateX - obstacle.x) * cosine;
      const side = Math.abs(gateLocalX) > 0.1 ? Math.sign(gateLocalX)
        : Math.abs(localX) > 0.1 ? Math.sign(localX)
          : Math.abs(localVx) > 0.05 ? Math.sign(localVx)
            : (hash01(id, 677) < 0.5 ? -1 : 1);
      const waypointLocalX = side * (halfWidth + 0.45);
      const crossingToSide = Math.abs(localX) > 0.1 && Math.sign(localX) !== side;
      const waypointLocalZ = approachingFromPositiveZ
        ? (crossingToSide ? halfDepth + 0.35 : -halfDepth - 0.35)
        : halfDepth + 0.35;
      const waypointX = obstacle.x + waypointLocalX * cosine - waypointLocalZ * sine;
      const waypointZ = obstacle.z + waypointLocalX * sine + waypointLocalZ * cosine;
      const waypointDx = waypointX - this.x[id];
      const waypointDz = waypointZ - this.z[id];
      const waypointLength = Math.hypot(waypointDx, waypointDz) || 1;
      if (waypointLength < bestDistance) {
        bestDistance = waypointLength;
        bestX = waypointDx / waypointLength * speed;
        bestZ = waypointDz / waypointLength * speed;
      }
    }
    if (bestDistance < Infinity) {
      this.desiredVx[id] = bestX;
      this.desiredVz[id] = bestZ;
      return true;
    }
    return false;
  }

  _steerAroundSolidObstacles(id, retainRoute = false, routeTarget = null) {
    if (!retainRoute) return this._steerAroundSolidObstaclesLegacy(id);
    if (this.type[id] === SPOREWING || !this.enemyObstacles.length) return false;
    if (routeTarget && Number.isFinite(this.obstacleRouteTargetX[id])
      && Math.hypot(
        routeTarget.x - this.obstacleRouteTargetX[id],
        routeTarget.z - this.obstacleRouteTargetZ[id],
      ) > 2.5) {
      this.obstacleRouteIndex[id] = -1;
      this.obstacleRouteSide[id] = 0;
      this.obstacleRouteDirection[id] = 0;
      this.obstacleRouteTargetX[id] = Number.NaN;
      this.obstacleRouteTargetZ[id] = Number.NaN;
    }
    let desiredX = this.desiredVx[id];
    let desiredZ = this.desiredVz[id];
    const speed = Math.hypot(desiredX, desiredZ);
    if (speed < 0.05) return false;
    const radius = enemyArchetype(this.type[id]).radius;
    const blockers = [];
    for (let obstacleIndex = 0; obstacleIndex < this.enemyObstacles.length; obstacleIndex++) {
      const obstacle = this.enemyObstacles[obstacleIndex];
      if (!obstacle.enabled || !obstacle.solid) continue;
      const cosine = obstacle.cosine;
      const sine = obstacle.sine;
      const dx = this.x[id] - obstacle.x;
      const dz = this.z[id] - obstacle.z;
      const localX = dx * cosine + dz * sine;
      const localZ = -dx * sine + dz * cosine;
      const localVx = desiredX * cosine + desiredZ * sine;
      const localVz = -desiredX * sine + desiredZ * cosine;
      const halfWidth = obstacle.halfWidth + radius;
      const halfDepth = obstacle.halfDepth + radius;
      const lookAhead = Math.max(3.5, speed * 0.9);
      const lateralGuard = halfWidth + 0.8;

      // Approach traffic primarily crosses the local Z faces. Hold a stable
      // side waypoint until the body has cleared the far face; otherwise its
      // lane target can pull it back into the footprint every tick and pin it
      // forever. Existing lateral intent chooses the side, then current side,
      // then a stable-ID tie-breaker.
      const approachingFromPositiveZ = localVz < -0.05
        && localZ >= -halfDepth - 0.35
        && localZ - halfDepth <= lookAhead;
      const approachingFromNegativeZ = localVz > 0.05
        && localZ <= halfDepth + 0.35
        && -localZ - halfDepth <= lookAhead;
      const routeDirection = this.obstacleRouteDirection[id];
      const routeNotCleared = routeDirection < 0
        ? localZ >= -halfDepth - 0.3
        : routeDirection > 0 && localZ <= halfDepth + 0.3;
      const activeRoute = retainRoute && this.obstacleRouteIndex[id] === obstacleIndex
        && Math.abs(localX) <= halfWidth + 1.1 && routeNotCleared;
      if (!activeRoute && (Math.abs(localX) > lateralGuard
        || (!approachingFromPositiveZ && !approachingFromNegativeZ))) continue;

      const surfaceDistance = Math.hypot(
        Math.max(0, Math.abs(localX) - halfWidth),
        Math.max(0, Math.abs(localZ) - halfDepth),
      );
      blockers.push({
        obstacle,
        obstacleIndex,
        cosine,
        sine,
        localX,
        localZ,
        localVx,
        localVz,
        halfWidth,
        halfDepth,
        approachingFromPositiveZ,
        approachingFromNegativeZ,
        activeRoute,
        surfaceDistance,
      });
    }

    if (!blockers.length) {
      this.obstacleRouteIndex[id] = -1;
      this.obstacleRouteSide[id] = 0;
      this.obstacleRouteDirection[id] = 0;
      this.obstacleRouteTargetX[id] = Number.NaN;
      this.obstacleRouteTargetZ[id] = Number.NaN;
      return false;
    }
    blockers.sort((left, right) => left.activeRoute === right.activeRoute
      ? left.surfaceDistance - right.surfaceDistance || left.obstacleIndex - right.obstacleIndex
      : left.activeRoute ? -1 : 1);

    let bestSteer = null;
    for (const blocker of retainRoute ? blockers.slice(0, 2) : blockers) {
      const {
        obstacle, obstacleIndex, cosine, sine, localX, localVx,
        halfWidth, halfDepth, approachingFromPositiveZ, activeRoute,
      } = blocker;

      const laneGateX = this.approach[id] === WEST ? this.world.westGateX : this.world.eastGateX;
      const gateLocalX = (laneGateX - obstacle.x) * cosine;
      // Prefer the gate-facing side of field dressing. Following the body's
      // current side can steer outer ranks farther out until the granular
      // corridor clamps them against a prop face.
      const preferredSide = activeRoute && this.obstacleRouteSide[id]
        ? this.obstacleRouteSide[id]
        : Math.abs(gateLocalX) > 0.1
        ? Math.sign(gateLocalX)
        : Math.abs(localX) > 0.1
          ? Math.sign(localX)
          : Math.abs(localVx) > 0.05
            ? Math.sign(localVx)
            : (hash01(id, 677) < 0.5 ? -1 : 1);
      const sides = retainRoute && !activeRoute ? [preferredSide, -preferredSide] : [preferredSide];
      for (const side of sides) {
        const routingFromPositiveZ = activeRoute
          ? this.obstacleRouteDirection[id] < 0
          : approachingFromPositiveZ;
        const waypointLocalX = side * (halfWidth + 0.45);
        const crossingToSide = Math.abs(localX) > 0.1 && Math.sign(localX) !== side;
        const waypointLocalZ = routingFromPositiveZ
          ? (crossingToSide ? halfDepth + 0.35 : -halfDepth - 0.35)
          : halfDepth + 0.35;
        const waypointX = obstacle.x + waypointLocalX * cosine - waypointLocalZ * sine;
        const waypointZ = obstacle.z + waypointLocalX * sine + waypointLocalZ * cosine;
        const waypointDx = waypointX - this.x[id];
        const waypointDz = waypointZ - this.z[id];
        const waypointLength = Math.hypot(waypointDx, waypointDz) || 1;
        let blockedPenalty = 0;
        let clearance = 4;
        for (const other of blockers.slice(0, 2)) {
          if (other.obstacleIndex === obstacleIndex) continue;
          // Score clearance along the candidate leg, not only at its endpoint.
          // A waypoint beyond a paired prop can still cut through that prop's
          // expanded footprint on the way there.
          for (let sample = 1; sample <= 4; sample++) {
            const ratio = sample / 4;
            const sampleX = this.x[id] + waypointDx * ratio;
            const sampleZ = this.z[id] + waypointDz * ratio;
            const local = this._obstacleLocal(other.obstacle, sampleX, sampleZ);
            const outsideX = Math.max(0, Math.abs(local.x) - other.halfWidth);
            const outsideZ = Math.max(0, Math.abs(local.z) - other.halfDepth);
            if (outsideX === 0 && outsideZ === 0) blockedPenalty += 1000;
            clearance = Math.min(clearance, Math.hypot(outsideX, outsideZ));
          }
        }
        const directRemaining = routeTarget
          ? Math.hypot(routeTarget.x - this.x[id], routeTarget.z - this.z[id])
          : 0;
        const waypointRemaining = routeTarget
          ? Math.hypot(routeTarget.x - waypointX, routeTarget.z - waypointZ)
          : 0;
        const progress = directRemaining - waypointRemaining;
        const routeLength = waypointLength + waypointRemaining;
        const score = blockedPenalty + routeLength - progress * 0.25
          - Math.min(clearance, 4) * 0.1 + (side === preferredSide ? 0 : 0.2);
        if (!bestSteer || score < bestSteer.score) {
          bestSteer = {
            score,
            obstacleIndex,
            side,
            direction: activeRoute
              ? this.obstacleRouteDirection[id]
              : routingFromPositiveZ ? -1 : 1,
            x: waypointDx / waypointLength * speed,
            z: waypointDz / waypointLength * speed,
          };
        }
      }
    }
    if (bestSteer) {
      this.desiredVx[id] = bestSteer.x;
      this.desiredVz[id] = bestSteer.z;
      if (retainRoute) {
        this.obstacleRouteIndex[id] = bestSteer.obstacleIndex;
        this.obstacleRouteSide[id] = bestSteer.side;
        this.obstacleRouteDirection[id] = bestSteer.direction;
        if (!Number.isFinite(this.obstacleRouteTargetX[id]) && routeTarget) {
          this.obstacleRouteTargetX[id] = routeTarget.x;
          this.obstacleRouteTargetZ[id] = routeTarget.z;
        }
      }
    }
    return bestSteer !== null;
  }

  _resolveEnemyObstacles(id, dt) {
    if (this.type[id] === SPOREWING || !this.enemyObstacles.length) return false;
    const radius = enemyArchetype(this.type[id]).radius;
    let collided = false;
    for (const obstacle of this.enemyObstacles) {
      if (!obstacle.enabled || !obstacle.solid) continue;
      const local = this._obstacleLocal(obstacle, this.x[id], this.z[id]);
      const halfWidth = obstacle.halfWidth + radius;
      const halfDepth = obstacle.halfDepth + radius;
      if (Math.abs(local.x) >= halfWidth || Math.abs(local.z) >= halfDepth) continue;
      const previous = this._obstacleLocal(
        obstacle,
        this.x[id] - this.vx[id] * dt,
        this.z[id] - this.vz[id] * dt,
      );
      const penetrationX = halfWidth - Math.abs(local.x);
      const penetrationZ = halfDepth - Math.abs(local.z);
      const crossedX = Math.abs(previous.x) >= halfWidth;
      const crossedZ = Math.abs(previous.z) >= halfDepth;
      const resolveX = crossedX !== crossedZ ? crossedX : penetrationX < penetrationZ;
      let localX = local.x;
      let localZ = local.z;
      let localVx = this.vx[id] * local.cosine + this.vz[id] * local.sine;
      let localVz = -this.vx[id] * local.sine + this.vz[id] * local.cosine;
      const gatePier = obstacle.id === "map:west-gate-pier" || obstacle.id === "map:west-gate-pier-east";
      const correctionLimit = gatePier ? 0.05 : Infinity;
      if (resolveX) {
        const direction = Math.sign(previous.x || local.x || (hash01(id, 607) - 0.5)) || 1;
        const targetLocalX = direction * halfWidth;
        localX += clamp(targetLocalX - localX, -correctionLimit, correctionLimit);
        localVx = 0;
      } else {
        const direction = Math.sign(previous.z || local.z || (hash01(id, 613) - 0.5)) || 1;
        const targetLocalZ = direction * halfDepth;
        localZ += clamp(targetLocalZ - localZ, -correctionLimit, correctionLimit);
        localVz = 0;
      }
      this.x[id] = obstacle.x + localX * local.cosine - localZ * local.sine;
      this.z[id] = obstacle.z + localX * local.sine + localZ * local.cosine;
      this.vx[id] = localVx * local.cosine - localVz * local.sine;
      this.vz[id] = localVx * local.sine + localVz * local.cosine;
      collided = true;
    }
    return collided;
  }

  _playerTargetForEnemy(id) {
    const index = this.playerTargetIndexById[id];
    return index >= 0 ? this.playerTargets[index] ?? null : null;
  }

  _playerTargetIdForEnemy(id) {
    return this._playerTargetForEnemy(id)?.playerId ?? this.playerTarget.playerId ?? 'player-0';
  }

  _playerTargetDistance(id, target) {
    return Math.hypot(this.x[id] - target.x, this.z[id] - target.z);
  }

  _selectPlayerTarget(id) {
    if (!this.playerTargets.length) {
      this.playerTargetIndexById[id] = -1;
      this._releasePlayerSwarmSlot(id);
      return -1;
    }
    const assignedIndex = this.playerTargetIndexById[id];
    const assigned = assignedIndex >= 0 ? this.playerTargets[assignedIndex] : null;
    const archetype = enemyArchetype(this.type[id]);
    if (assigned) {
      const retained = this.type[id] === SPOREWING
        ? true
        : assigned.exposed
          && (this.zone[id] === APPROACH_ZONE || this.zone[id] === COURTYARD_ZONE)
          && this._playerTargetDistance(id, assigned)
            <= assigned.retainRadius + archetype.radius;
      if (retained) return assignedIndex;
      this.playerTargetIndexById[id] = -1;
      this._releasePlayerSwarmSlot(id);
    }
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < this.playerTargets.length; index++) {
      const target = this.playerTargets[index];
      if (this.type[id] !== SPOREWING
        && (!target.exposed || (this.zone[id] !== APPROACH_ZONE && this.zone[id] !== COURTYARD_ZONE))) continue;
      const distance = this._playerTargetDistance(id, target);
      const range = target.aggroRadius + archetype.radius;
      if (this.type[id] !== SPOREWING && distance > range) continue;
      if (distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    }
    this.playerTargetIndexById[id] = bestIndex;
    return bestIndex;
  }

  _shouldPursuePlayer(id) {
    if (this.type[id] === SPOREWING && !this.dedicatedHunter[id]) {
      this.playerTargetIndexById[id] = -1;
      this._releasePlayerSwarmSlot(id);
      return false;
    }
    const targetIndex = this._selectPlayerTarget(id);
    const target = targetIndex >= 0 ? this.playerTargets[targetIndex] : null;
    if (!target) return false;
    // Dedicated hunters are authored into the same staggered companies as the
    // lane host. They must not begin steering or attacking before their
    // company has actually entered the encounter.
    if (this.type[id] === SPOREWING) {
      return this.elapsed + 1e-6 >= this.companyReleaseAt[id];
    }
    if (!target.exposed || (this.zone[id] !== APPROACH_ZONE && this.zone[id] !== COURTYARD_ZONE)) return false;
    const assigned = targetIndex >= 0;
    const range = (assigned ? target.retainRadius : target.aggroRadius)
      + enemyArchetype(this.type[id]).radius;
    if (this._playerTargetDistance(id, target) > range) return false;
    return assigned
      || this.playerSwarmFreeCount > 0
      || this.playerSwarmNextSlot < this.playerSwarmCap;
  }

  _claimPlayerSwarmSlot(id) {
    if (this.playerSwarmSlotById[id] >= 0) return this.playerSwarmSlotById[id];
    const slot = this.playerSwarmFreeCount > 0
      ? this.playerSwarmFreeSlots[--this.playerSwarmFreeCount]
      : this.playerSwarmNextSlot++;
    if (slot >= this.playerSwarmCap) {
      this.playerSwarmNextSlot = Math.min(this.playerSwarmNextSlot, this.playerSwarmCap);
      return -1;
    }
    this.playerSwarmSlotById[id] = slot;
    this.playerSwarmIdBySlot[slot] = id;
    // Phase the first contact ring across one authored attack interval. Stable
    // IDs can otherwise produce a clump whose impacts all land inside the
    // player's damage cooldown, making an eight-body assault read and resolve
    // like a single attacker after the nearest roster changes.
    const interval = Math.max(0.1, enemyArchetype(this.type[id]).attackInterval);
    const contactRingSlots = Math.max(1, Math.min(6, this.playerSwarmCap));
    const visualLead = Math.min(interval, ENEMY_ATTACK_VISUAL_SECONDS * ENEMY_ATTACK_IMPACT_FRACTION);
    const phase = (slot % contactRingSlots) / contactRingSlots;
    this.attackCooldown[id] = visualLead + phase * Math.max(0, interval - visualLead);
    return slot;
  }

  _releasePlayerSwarmSlot(id) {
    const slot = this.playerSwarmSlotById[id];
    if (slot < 0) return;
    this.playerSwarmSlotById[id] = -1;
    this.playerSwarmIdBySlot[slot] = -1;
    this.playerSwarmFreeSlots[this.playerSwarmFreeCount++] = slot;
  }

  _playerSwarmTarget(id) {
    const slot = this.playerSwarmSlotById[id];
    if (slot < 0) return null;
    const target = this._playerTargetForEnemy(id) ?? this.playerTarget;
    return exposedPlayerSwarmSlot(slot, target, enemyArchetype(this.type[id]).radius);
  }

  _hunterPlayerTarget(id) {
    let rank = 0;
    // Stable IDs are monotonic for the run. Counting prior hunter IDs keeps
    // orbit ownership deterministic even when an earlier hunter dies.
    for (let candidate = 0; candidate < id; candidate++) {
      if (this.dedicatedHunter[candidate]) rank++;
    }
    const target = this._playerTargetForEnemy(id) ?? this.playerTarget;
    return hunterPlayerOrbitTarget(rank, target, enemyArchetype(this.type[id]).radius);
  }

  _resolveHunterPlayerClearance(id) {
    const playerTarget = this._playerTargetForEnemy(id) ?? this.playerTarget;
    if (!this.dedicatedHunter[id] || !this.huntingPlayer[id] || !playerTarget.enabled) return false;
    const dx = this.x[id] - playerTarget.x;
    const dz = this.z[id] - playerTarget.z;
    const distance = Math.hypot(dx, dz);
    if (distance >= HUNTER_CAMERA_CLEARANCE) return false;
    const target = this._hunterPlayerTarget(id);
    const fallbackX = target.x - playerTarget.x;
    const fallbackZ = target.z - playerTarget.z;
    const divisor = distance > 1e-6 ? distance : Math.hypot(fallbackX, fallbackZ) || 1;
    const normalX = distance > 1e-6 ? dx / divisor : fallbackX / divisor;
    const normalZ = distance > 1e-6 ? dz / divisor : fallbackZ / divisor;
    this.x[id] = playerTarget.x + normalX * HUNTER_CAMERA_CLEARANCE;
    this.z[id] = playerTarget.z + normalZ * HUNTER_CAMERA_CLEARANCE;
    const inwardSpeed = this.vx[id] * normalX + this.vz[id] * normalZ;
    if (inwardSpeed < 0) {
      this.vx[id] -= normalX * inwardSpeed;
      this.vz[id] -= normalZ * inwardSpeed;
    }
    return true;
  }

  _routeShift(id) {
    if (this.type[id] === SPOREWING) return 0;
    let shift = 0;
    const enemyZ = this.z[id];
    for (const barricade of this.barricades[this.approach[id]]) {
      if (!barricade.enabled) continue;
      const distance = Math.abs(enemyZ - barricade.z);
      if (distance >= barricade.influence) continue;
      shift += barricade.shiftX * (1 - distance / barricade.influence);
    }
    return clamp(shift, -10, 10);
  }

  _setApproachVelocity(id) {
    const archetype = enemyArchetype(this.type[id]);
    let pursuingPlayer = this._shouldPursuePlayer(id);
    if (pursuingPlayer && this.type[id] !== SPOREWING && this._claimPlayerSwarmSlot(id) < 0) {
      pursuingPlayer = false;
    }
    this.huntingPlayer[id] = pursuingPlayer ? 1 : 0;
    if (pursuingPlayer) {
      if (this.type[id] === SPOREWING) this._releasePlayerSwarmSlot(id);
      this._setEngagementRole(
        id,
        this.type[id] === SPOREWING ? ENGAGEMENT_HUNTER : ENGAGEMENT_PLAYER_ATTACK,
      );
      const target = this.type[id] === SPOREWING
        ? this._hunterPlayerTarget(id)
        : this._playerSwarmTarget(id) || this._playerTargetForEnemy(id) || this.playerTarget;
      const dx = target.x - this.x[id];
      const dz = target.z - this.z[id];
      const length = Math.hypot(dx, dz) || 1;
      const speed = archetype.speed * this._enemySpeedScaleAt(id);
      if (length < 0.12) {
        this.desiredVx[id] = 0;
        this.desiredVz[id] = 0;
      } else {
        this.desiredVx[id] = dx / length * speed;
        this.desiredVz[id] = dz / length * speed;
      }
      this._steerAroundSolidObstacles(id);
      return;
    }
    this._releasePlayerSwarmSlot(id);
    if (this.elapsed + 1e-6 < this.marchStartTime[id]) {
      this._setEngagementRole(id, ENGAGEMENT_RESERVE);
      this.desiredVx[id] = 0;
      this.desiredVz[id] = 0;
      return;
    }
    this._setEngagementRole(id, ENGAGEMENT_MARCHING);
    const lane = this.approach[id];
    const gateX = lane === WEST ? this.world.westGateX : this.world.eastGateX;
    const routeX = gateX + this._routeShift(id);
    const formationHold = approachFormationHold(this.z[id], this.world);
    const sporewingGateTarget = this.type[id] === SPOREWING
      && !this.dedicatedHunter[id]
      && !this.outerGateBreached[lane]
      ? sporewingGateAttackTarget(id, gateX, this.world.gateZ)
      : null;
    const wickerWaypoint = this.type[id] === WICKER_COLOSSUS && lane === WEST && !this.outerGateBreached[lane]
      ? wickerLowPassageWaypoint({x: this.x[id], z: this.z[id]})
      : null;
    const targetX = sporewingGateTarget
      ? sporewingGateTarget.x
      : wickerWaypoint
      ? wickerWaypoint.x
      : routeX + (this.x[id] - routeX) * formationHold;
    const targetZ = sporewingGateTarget
      ? sporewingGateTarget.z
      : wickerWaypoint
      ? wickerWaypoint.z
      : this.outerGateBreached[lane] ? this.world.courtyardEntryZ - 2 : this.world.gateZ;
    const dx = targetX - this.x[id];
    const dz = targetZ - this.z[id];
    const length = Math.hypot(dx, dz) || 1;
    const individualPace = archetype.speed * (this.type[id] === BRIARBOUND
      ? approachVanguardSpeedScale(id, this.z[id], this.world)
      : 1);
    const rowPace = this.formationPace[id] > 0 ? this.formationPace[id] : individualPace;
    const basePace = individualPace + (rowPace - individualPace) * formationHold;
    const depthScale = this.formationPace[id] > 0 || this.type[id] === BRIARBOUND
      ? approachMarchSpeedScale(this.z[id], this.world)
      : 1;
    const marchSpeed = basePace * depthScale * this._enemySpeedScaleAt(id);
    this.desiredVx[id] = dx / length * marchSpeed;
    this.desiredVz[id] = dz / length * marchSpeed;
    // The clearance waypoint is already the deliberate west-side route around
    // the gatehouse. Generic look-ahead steering sees the west pier from the
    // safe side and chooses its gate-facing side instead, sending the Colossus
    // back across the waypoint and into an endless left/right oscillation.
    if (!wickerWaypoint) this._steerAroundSolidObstacles(id);
  }

  _setCourtyardVelocity(id) {
    const archetype = enemyArchetype(this.type[id]);
    let pursuingPlayer = this._shouldPursuePlayer(id);
    if (pursuingPlayer && this.type[id] !== SPOREWING && this._claimPlayerSwarmSlot(id) < 0) {
      pursuingPlayer = false;
    }
    this.huntingPlayer[id] = pursuingPlayer ? 1 : 0;
    if (pursuingPlayer) {
      if (this.type[id] === SPOREWING) this._releasePlayerSwarmSlot(id);
      this.huntingPlayer[id] = 1;
      this._setEngagementRole(
        id,
        this.type[id] === SPOREWING ? ENGAGEMENT_HUNTER : ENGAGEMENT_PLAYER_ATTACK,
      );
      const target = this.type[id] === SPOREWING
        ? this._hunterPlayerTarget(id)
        : this._playerSwarmTarget(id) || this._playerTargetForEnemy(id) || this.playerTarget;
      const dx = target.x - this.x[id];
      const dz = target.z - this.z[id];
      const length = Math.hypot(dx, dz) || 1;
      this.desiredVx[id] = dx / length * archetype.speed;
      this.desiredVz[id] = dz / length * archetype.speed;
      this._steerAroundSolidObstacles(id, true, target);
      return;
    }
    this._releasePlayerSwarmSlot(id);
    this._setEngagementRole(id, ENGAGEMENT_MARCHING);
    // Crossing the outer threshold changes the logical zone before a body has
    // physically cleared the deep stone piers. Heading diagonally at the Heart
    // Gate from that point drives the body back into a pier and leaves it
    // pinned on the collision edge. Continue through the aperture first, then
    // turn into the courtyard assault.
    const outerGateX = this.approach[id] === WEST ? this.world.westGateX : this.world.eastGateX;
    const outerGateHalfWidth = this.approach[id] === WEST
      ? this.world.westGateHalfWidth
      : this.world.eastGateHalfWidth;
    const clearingOuterPassage = this.z[id] > this.world.courtyardEntryZ - 2
      && Math.abs(this.x[id] - outerGateX) <= outerGateHalfWidth + archetype.radius;
    const targetX = clearingOuterPassage ? outerGateX : this.world.heartGateX;
    const targetZ = clearingOuterPassage ? this.world.courtyardEntryZ - 2 : this.world.heartGateZ;
    const dx = targetX - this.x[id];
    const dz = targetZ - this.z[id];
    const length = Math.hypot(dx, dz) || 1;
    const speed = archetype.speed * this._enemySpeedScaleAt(id);
    // Once inside the aperture, avoid repeatedly crossing the exact gate
    // centreline while obstacle steering is resolving the pier edge. A small
    // deadband removes the visible left/right chatter without changing the
    // authored route or collision caps.
    this.desiredVx[id] = clearingOuterPassage && Math.abs(dx) < 0.35
      ? 0
      : dx / length * speed;
    this.desiredVz[id] = dz / length * speed;
    this._steerAroundSolidObstacles(id);
  }

  _holdOuterOverflow(id, dt, solver) {
    this._setEngagementRole(id, ENGAGEMENT_GATE_QUEUE);
    const archetype = enemyArchetype(this.type[id]);
    const grid = this.outerOverflowGrids[this.approach[id]];
    const {halfWidth, spacing, edgeMargin, columns} = grid;
    const newlyAssigned = this.outerOverflowRank[id] < 0;
    if (newlyAssigned) {
      const formationRank = this.outerFormationRank[id];
      this.outerOverflowRank[id] = formationRank >= 0 ? formationRank : this.outerOverflowNext++;
    }
    const queueIndex = this.outerOverflowRank[id];
    const row = Math.floor(queueIndex / columns);
    const rawColumn = queueIndex % columns;
    // Formation ranks are already ordered left-to-right within each depth
    // row. Reversing odd rows made every other company cross through itself.
    const column = rawColumn;
    const company = Math.min(grid.companyCount - 1, Math.floor(column * grid.companyCount / columns));
    const fullSpan = (columns - 1) * spacing + (grid.companyCount - 1) * grid.companyGap;
    const rawX = -fullSpan * 0.5 + column * spacing + company * grid.companyGap;
    const depthGap = Math.floor(row / 16) * grid.depthGap;
    const jitterX = (hash01(id, 83) - 0.5) * spacing * 0.3;
    const jitterZ = (hash01(id, 97) - 0.5) * spacing * 0.3;
    const rowOffset = row & 1 ? spacing * 0.48 : 0;
    const formationBend = Math.sin(row * 1.7 + column * 0.53) * spacing * 0.18;
    const queueFrontZ = this._outerQueueFrontZ(solver);
    const authoredTargetZ = Math.min(
      finite(this.world.spawnFarZ, 118) - edgeMargin,
      queueFrontZ + row * grid.rowSpacing + depthGap + jitterZ + formationBend,
    );
    if (newlyAssigned || !Number.isFinite(this.outerFormationStopZ[id])) {
      this.outerFormationStopZ[id] = Math.min(this.z[id], authoredTargetZ);
    }
    const rawTargetZ = this.outerFormationStopZ[id];
    // Admission order is stable but not depth-sorted. Never send a body back
    // toward a distant row after it has already marched closer to the gate.
    const startZ = this.z[id];
    const canAdvanceToRow = rawTargetZ <= startZ + 0.001;
    const targetZ = canAdvanceToRow ? rawTargetZ : startZ;
    // Reserve ranks must keep at least body-width column spacing. Scaling a
    // 60-column field formation down to the corridor width put adjacent
    // centres only a few centimetres apart and reproduced the fused sprite
    // mass seen in playtests. The active solver performs the actual funnel;
    // reserves occupy the full authored approach and advance when admitted.
    const spawnMinX = finite(this.world.spawnMinX, -halfWidth);
    const spawnMaxX = Math.max(spawnMinX, finite(this.world.spawnMaxX, halfWidth));
    const gateX = this.approach[id] === WEST ? this.world.westGateX : this.world.eastGateX;
    const boundaryHalfWidth = Math.max(1, Math.min(gateX - spawnMinX, spawnMaxX - gateX));
    const availableHalfWidth = Math.max(1, Math.min(
      boundaryHalfWidth,
      finite(this.world.spawnHalfWidth, DEFAULT_WORLD.spawnHalfWidth),
    ) - edgeMargin);
    const widthScale = Math.min(1, availableHalfWidth / Math.max(1, halfWidth - edgeMargin));
    const targetX = gateX
      + rawX * widthScale
      + rowOffset * 0.35
      + jitterX;
    const dx = targetX - this.x[id];
    const dz = targetZ - this.z[id];
    const distance = Math.hypot(dx, dz);
    const queueSpeed = archetype.speed * 0.72;
    const desiredX = distance > 0.05 ? dx / distance * Math.min(queueSpeed, distance / Math.max(dt, 1 / 240)) : 0;
    const desiredZ = distance > 0.05 ? dz / distance * Math.min(queueSpeed, distance / Math.max(dt, 1 / 240)) : 0;
    this.vx[id] += (desiredX - this.vx[id]) * 0.24;
    this.vz[id] += (desiredZ - this.vz[id]) * 0.24;
    // Overflow staging can slow or fan sideways, but it must never send a
    // visible body back toward the forest after it has approached the hold.
    this.vz[id] = Math.min(0, this.vz[id]);
    this.x[id] += this.vx[id] * dt;
    this.z[id] += this.vz[id] * dt;
    // Stop on the owned row instead of coasting through it and silently
    // accepting the overshoot as a new, denser target on the next tick.
    if (canAdvanceToRow && this.z[id] < rawTargetZ) {
      this.z[id] = rawTargetZ;
      this.vz[id] = 0;
    }
    const settledDistance = Math.hypot(targetX - this.x[id], targetZ - this.z[id]);
    if (settledDistance < 0.14 && Math.hypot(this.vx[id], this.vz[id]) < 0.3) {
      this.vx[id] = 0;
      this.vz[id] = 0;
      this._setEngagementRole(id, ENGAGEMENT_GATE_QUEUE, true);
    }
  }

  _outerFormationTargetZ(id, solver) {
    const rank = this.outerFormationRank[id];
    if (rank < 0) {
      return this._outerQueueFrontZ(solver);
    }
    const grid = this.outerOverflowGrids[this.approach[id]];
    const {spacing, edgeMargin} = grid;
    const row = Math.floor(rank / grid.columns);
    const rawColumn = rank % grid.columns;
    const column = rawColumn;
    const depthGap = Math.floor(row / 16) * grid.depthGap;
    const jitterZ = (hash01(id, 97) - 0.5) * spacing * 0.3;
    const formationBend = Math.sin(row * 1.7 + column * 0.53) * spacing * 0.18;
    const queueFrontZ = this._outerQueueFrontZ(solver);
    return Math.min(
      finite(this.world.spawnFarZ, 118) - edgeMargin,
      queueFrontZ + row * grid.rowSpacing + depthGap + jitterZ + formationBend,
    );
  }

  _holdHeartOverflow(id, dt, solver) {
    this._setEngagementRole(id, ENGAGEMENT_GATE_QUEUE);
    const archetype = enemyArchetype(this.type[id]);
    const grid = this.heartOverflowGrid;
    const {spacing} = grid;
    if (this.heartOverflowRank[id] < 0) this.heartOverflowRank[id] = this.heartOverflowNext++;
    const queueIndex = this.heartOverflowRank[id];
    const row = Math.floor(queueIndex / grid.columns);
    const rawColumn = queueIndex % grid.columns;
    const column = row & 1 ? grid.columns - 1 - rawColumn : rawColumn;
    const company = Math.min(grid.companyCount - 1, Math.floor(column * grid.companyCount / grid.columns));
    const fullSpan = (grid.columns - 1) * spacing + (grid.companyCount - 1) * grid.companyGap;
    const rawX = -fullSpan * 0.5 + column * spacing + company * grid.companyGap;
    const depthGap = Math.floor(row / 16) * grid.depthGap;
    const jitterX = (hash01(id, 109) - 0.5) * spacing * 0.3;
    const jitterZ = (hash01(id, 127) - 0.5) * spacing * 0.3;
    const rowOffset = row & 1 ? spacing * 0.48 : 0;
    const formationBend = Math.sin(row * 1.9 + column * 0.47) * spacing * 0.18;
    const outerGateX = this.approach[id] === WEST ? this.world.westGateX : this.world.eastGateX;
    const outerGateHalfWidth = this.approach[id] === WEST
      ? this.world.westGateHalfWidth
      : this.world.eastGateHalfWidth;
    const clearingOuterPassage = this.z[id] > this.world.courtyardEntryZ - 2
      && Math.abs(this.x[id] - outerGateX) <= outerGateHalfWidth + archetype.radius;
    const targetX = clearingOuterPassage
      ? outerGateX
      : this.world.heartGateX + rawX + rowOffset + jitterX;
    // Keep bodies that cannot yet enter the bounded Heart solver streaming in
    // through the breached outer threshold instead of converging into one
    // invisible coordinate at the Heart Gate.
    const targetZ = clearingOuterPassage
      ? this.world.courtyardEntryZ - 2
      : Math.min(
        this.world.courtyardEntryZ - 2,
        this.world.courtyardEntryZ - 2
          - row * grid.rowSpacing - depthGap + jitterZ + formationBend,
      );
    const dx = targetX - this.x[id];
    const dz = targetZ - this.z[id];
    const distance = Math.hypot(dx, dz);
    const queueSpeed = archetype.speed * 0.72;
    const desiredX = distance > 0.05 ? dx / distance * Math.min(queueSpeed, distance / Math.max(dt, 1 / 240)) : 0;
    const desiredZ = distance > 0.05 ? dz / distance * Math.min(queueSpeed, distance / Math.max(dt, 1 / 240)) : 0;
    this.vx[id] += (desiredX - this.vx[id]) * 0.24;
    this.vz[id] += (desiredZ - this.vz[id]) * 0.24;
    this.x[id] += this.vx[id] * dt;
    this.z[id] += this.vz[id] * dt;
    if (distance < 0.14 && Math.hypot(this.vx[id], this.vz[id]) < 0.3) {
      this.vx[id] = 0;
      this.vz[id] = 0;
      this._setEngagementRole(id, ENGAGEMENT_GATE_QUEUE, true);
    }
  }

  _isOuterPressureFront(id, lane = this.approach[id]) {
    const archetype = enemyArchetype(this.type[id]);
    const gateX = lane === WEST ? this.world.westGateX : this.world.eastGateX;
    const radialContactRange = archetype.radius + (this.type[id] === ROOT_SAPPER ? 2.2 : 1);
    const pressureDepth = radialContactRange + Math.max(1.2, archetype.radius * 2);
    const solver = this.breachSolvers[lane];
    return this.zone[id] === APPROACH_ZONE
      && this.z[id] <= this.world.gateZ + pressureDepth
      && Math.abs(this.x[id] - gateX) <= solver.gateHalfWidth + archetype.radius * 2;
  }

  _attackPlayer(id, dt) {
    const playerTarget = this._playerTargetForEnemy(id) ?? this.playerTarget;
    if (!playerTarget.enabled) return false;
    const archetype = enemyArchetype(this.type[id]);
    const dedicatedHunter = this.dedicatedHunter[id] === 1;
    if (dedicatedHunter && this.elapsed + 1e-6 < this.companyReleaseAt[id]) return false;
    if (!dedicatedHunter && !this.huntingPlayer[id]) return false;
    let assignedSwarmAttacker = false;
    let hunterOrbitRadius = 0;
    if (dedicatedHunter) {
      const target = this._hunterPlayerTarget(id);
      hunterOrbitRadius = target.radius;
      if (Math.hypot(this.x[id] - target.x, this.z[id] - target.z) > 0.42) return false;
    } else {
      const slot = this.playerSwarmSlotById[id];
      const target = this._playerSwarmTarget(id);
      assignedSwarmAttacker = slot >= 0;
      if (assignedSwarmAttacker && (!target
        || Math.hypot(this.x[id] - target.x, this.z[id] - target.z) > 0.36)) return false;
    }
    const distance = Math.hypot(
      this.x[id] - playerTarget.x,
      this.z[id] - playerTarget.z
    );
    const contactRange = dedicatedHunter
      ? hunterOrbitRadius + 0.42
      : archetype.radius + playerTarget.radius + 0.45;
    if (distance > contactRange) return false;
    this.vx[id] = 0;
    this.vz[id] = 0;
    this._advanceAttackCycle(id, dt, "player");
    if (this.attackCooldown[id] > 0) return true;
    const bodyScale = dedicatedHunter ? 1 : Math.max(0, this.threatMass[id]);
    const damage = dedicatedHunter
      ? Math.max(1, archetype.attackDamage)
      // A claimed assault slot is a fixed tactical role. Scaling it by the
      // per-sprite subdivision mass made the eight attackers in a 140-body
      // wave deal less damage together than one authored enemy, so leaving the
      // ramparts was effectively safe. Unassigned/direct fixtures retain
      // threat-mass scaling; the bounded assault party keeps authored lethality
      // independent of the visual subdivision profile.
      : assignedSwarmAttacker
        ? archetype.attackDamage * 1.05
        : archetype.attackDamage * 0.45 * bodyScale;
    this.pendingPlayerDamage += damage;
    const targetPlayerId = playerTarget.playerId ?? 'player-0';
    const key = String(targetPlayerId);
    this.pendingPlayerDamageByPlayer[key] = (this.pendingPlayerDamageByPlayer[key] ?? 0) + damage;
    this.diagnostics.playerDamage += damage;
    if (dedicatedHunter) this.diagnostics.hunterAttacks++;
    this.playerDamageEvents.push({id, type: this.type[id], damage, dedicatedHunter, targetPlayerId});
    this.attackCooldown[id] += archetype.attackInterval;
    return true;
  }

  _attackOuterGate(id, dt) {
    const lane = this.approach[id];
    if (this.outerGateBreached[lane]) return;
    const archetype = enemyArchetype(this.type[id]);
    const gateX = lane === WEST ? this.world.westGateX : this.world.eastGateX;
    const rangedTarget = this.type[id] === SPOREWING && !this.dedicatedHunter[id]
      ? sporewingGateAttackTarget(id, gateX, this.world.gateZ)
      : null;
    const distance = Math.hypot(
      this.x[id] - (rangedTarget?.x ?? gateX),
      this.z[id] - (rangedTarget?.z ?? this.world.gateZ),
    );
    const contactRange = rangedTarget ? 0.72 : archetype.radius + (this.type[id] === ROOT_SAPPER ? 2.2 : 1);
    if (distance > contactRange) return;
    this._setEngagementRole(id, ENGAGEMENT_GATE_ATTACK);
    this._advanceAttackCycle(id, dt, "outer");
    if (this.attackCooldown[id] > 0) return;
    const pressure = Math.max(0, this.gatePressure[id]);
    this.outerGateHp[lane] = Math.max(
      0,
      this.outerGateHp[lane] - archetype.attackDamage * pressure * this.outerGateContactPressureScale,
    );
    this.attackCooldown[id] += archetype.attackInterval;
  }

  _attackHeartGate(id, dt, packed = false) {
    const archetype = enemyArchetype(this.type[id]);
    const atGate = packed
      ? this.z[id] <= this.world.heartGateZ + archetype.radius + 0.08
        && Math.abs(this.x[id] - this.world.heartGateX) <= this.heartBreachSolver.gateHalfWidth
      : Math.hypot(this.x[id] - this.world.heartGateX, this.z[id] - this.world.heartGateZ) <= archetype.radius + 1;
    if (!atGate) {
      if (packed) {
        const pressureDepth = archetype.radius + 1 + Math.max(1.2, archetype.radius * 2);
        const touchesPressureFront = this.z[id] <= this.world.heartGateZ + pressureDepth
          && Math.abs(this.x[id] - this.world.heartGateX)
            <= this.heartBreachSolver.gateHalfWidth + archetype.radius * 2;
        if (touchesPressureFront) {
          this._setEngagementRole(id, ENGAGEMENT_GATE_ATTACK);
          this._advancePressureAttackCycle(id, dt, "heart");
        } else {
          this._setEngagementRole(id, ENGAGEMENT_GATE_QUEUE, true);
        }
      }
      return false;
    }
    this._setEngagementRole(id, ENGAGEMENT_GATE_ATTACK);
    if (!packed) {
      this.x[id] += (this.world.heartGateX - this.x[id]) * 0.1;
      this.z[id] = Math.max(this.z[id], this.world.heartGateZ + archetype.radius);
    }
    this.vx[id] = 0;
    this.vz[id] = 0;
    this._advanceAttackCycle(id, dt, "heart");
    if (this.attackCooldown[id] <= 0 && this.heartGateHp > 0) {
      const pressure = Math.max(0, this.gatePressure[id]);
      const damage = Math.min(this.heartGateHp, archetype.attackDamage * pressure);
      this.heartGateHp -= damage;
      this.diagnostics.heartGateDamage += damage;
      this.attackCooldown[id] += archetype.attackInterval;
    }
    return true;
  }

  _advanceAttackCycle(id, dt, target = null) {
    this.attackCooldown[id] -= dt;
    const visualLead = ENEMY_ATTACK_VISUAL_SECONDS * ENEMY_ATTACK_IMPACT_FRACTION;
    const previousVisualFinished = this.elapsed - this.lastAttackTime[id] >= ENEMY_ATTACK_VISUAL_SECONDS;
    if (this.attackCooldown[id] <= visualLead && previousVisualFinished) {
      this.lastAttackTime[id] = this.elapsed;
      if (target) this._recordAttackStart(id, target);
    }
  }

  _advancePressureAttackCycle(id, dt, target = null) {
    // Supporting pressure rows do not resolve a discrete damage strike, so
    // their cooldown is never reset by _attackOuterGate/_attackHeartGate.
    // Preserve that cooldown countdown for a later exact-contact promotion,
    // but pace the presentational strike at the archetype's authored attack
    // interval instead of restarting as soon as the 0.52s animation ends.
    this.attackCooldown[id] -= dt;
    const visualLead = ENEMY_ATTACK_VISUAL_SECONDS * ENEMY_ATTACK_IMPACT_FRACTION;
    const attackInterval = Math.max(
      ENEMY_ATTACK_VISUAL_SECONDS,
      enemyArchetype(this.type[id]).attackInterval,
    );
    const previousVisualFinished = this.elapsed - this.lastAttackTime[id] >= attackInterval;
    if (this.attackCooldown[id] <= visualLead && previousVisualFinished) {
      this.lastAttackTime[id] = this.elapsed;
      if (target) this._recordAttackStart(id, target);
    }
  }

  _markOuterBreaches() {
    for (const lane of [WEST, EAST]) {
      if (!this.outerGateBreached[lane] && this.outerGateHp[lane] <= 0) {
        this.outerGateHp[lane] = 0;
        this.outerGateBreached[lane] = 1;
        this.diagnostics.outerGateBreaches++;
      }
    }
  }

  _step(dt) {
    for (let id = 0; id < this.slotCount; id++) {
      if (this.status[id] !== DYING) continue;
      this._releasePlayerSwarmSlot(id);
      this.deathTimer[id] = Math.max(0, this.deathTimer[id] - dt);
      this.stateProgress[id] = clamp(1 - this.deathTimer[id] / ENEMY_DEATH_SECONDS, 0, 1);
      if (this.deathTimer[id] <= 0) {
        this.stateProgress[id] = 1;
        this.status[id] = DEAD;
      }
    }
    for (let id = 0; id < this.slotCount; id++) {
      if (this.status[id] !== ACTIVE) continue;
      if (this.zone[id] === APPROACH_ZONE) this._setApproachVelocity(id);
      else this._setCourtyardVelocity(id);
    }

    for (const lane of [WEST, EAST]) {
      const solver = this.breachSolvers[lane];
      for (let id = 0; id < this.slotCount; id++) {
        if (this.status[id] !== ACTIVE || this.approach[id] !== lane) continue;
        if (this.huntingPlayer[id] || this.waitingRank[id]) {
          solver.deactivate(id);
          continue;
        }
        solver.consider(id, this);
      }
      const solverStats = solver.step(this, dt, {
        wallEnabled: !this.outerGateBreached[lane],
        desiredVx: this.desiredVx,
        desiredVz: this.desiredVz,
        settleAtCapacity: solver.capacity >= 8,
      });
      let pressureFrontCount = 0;
      let pressureFrontBudget = 0;
      for (let slot = 0; slot < solver.activeCount; slot++) {
        const id = solver.idBySlot[slot];
        const physicalSpeed = Math.hypot(
          this.x[id] - solver.previousX[slot],
          this.z[id] - solver.previousZ[slot],
        ) / Math.max(dt, 1 / 240);
        if (this.huntingPlayer[id]) continue;
        if (this.outerGateBreached[lane]) {
          // The wall is gone: every admitted body is traversing the threshold,
          // so release the planted gate-pressure presentation immediately.
          this._setEngagementRole(id, ENGAGEMENT_MARCHING);
        } else if (this._isOuterPressureFront(id, lane)) {
          this._setEngagementRole(id, ENGAGEMENT_GATE_ATTACK);
          pressureFrontCount++;
          pressureFrontBudget += this.gatePressure[id];
          if (this.lastAttackTime[id] <= -999) {
            // A body promoted into the visible strike front must begin with an
            // authored wind-up rather than holding an unanimated attack role
            // until its inherited cooldown happens to expire.
            this.attackCooldown[id] = Math.min(
              this.attackCooldown[id],
              ENEMY_ATTACK_VISUAL_SECONDS * ENEMY_ATTACK_IMPACT_FRACTION,
            );
          }
          const archetype = enemyArchetype(this.type[id]);
          const gateX = lane === WEST ? this.world.westGateX : this.world.eastGateX;
          const contactRange = archetype.radius + (this.type[id] === ROOT_SAPPER ? 2.2 : 1);
          const exactContact = Math.hypot(
            this.x[id] - gateX,
            this.z[id] - this.world.gateZ,
          ) <= contactRange;
          // Exact contact is advanced once by _attackOuterGate below. Only the
          // shallow supporting pressure row needs a presentational strike here.
          if (!exactContact) this._advancePressureAttackCycle(id, dt, "outer");
        } else if (this.z[id] - this.world.gateZ <= 14 || physicalSpeed < 0.2) {
          // Once a solver member joins the compact physical pack, it is
          // pressing rather than traversing even if separation produces small
          // per-tick shuffles. This prevents a granular jam from presenting as
          // a new row of logical marchers while retaining continuous swarm
          // locomotion presentation for campaign pressure.
          this._setEngagementRole(id, ENGAGEMENT_GATE_QUEUE, true);
        } else {
          this._setEngagementRole(id, ENGAGEMENT_MARCHING);
        }
      }
      if (!this.outerGateBreached[lane]) {
        if (solverStats.pressure > 0 && pressureFrontCount > 0) {
          const subdivisionScale = pressureFrontBudget / pressureFrontCount;
          this.outerGateHp[lane] = Math.max(
            0,
            this.outerGateHp[lane]
              - solverStats.pressure * subdivisionScale * this.breachPressureDamageScale * dt
                * this.outerGatePressureScale
          );
        }
      }
    }

    for (let id = 0; id < this.slotCount; id++) {
      if (this.status[id] !== ACTIVE || this.zone[id] !== COURTYARD_ZONE) continue;
      if (this.huntingPlayer[id]) this.heartBreachSolver.deactivate(id);
      else this.heartBreachSolver.consider(id, this);
    }
    this.heartBreachSolver.step(this, dt, {
      wallEnabled: true,
      desiredVx: this.desiredVx,
      desiredVz: this.desiredVz,
      settleAtCapacity: this.heartBreachSolver.capacity >= 8,
    });

    for (let id = 0; id < this.slotCount; id++) {
      if (this.status[id] !== ACTIVE) continue;
      const pursuingPlayer = Boolean(this.huntingPlayer[id]);
      const contactingPlayer = this._attackPlayer(id, dt);
      const eligibleSolver = this.zone[id] === APPROACH_ZONE
        && isBreachEligible(this.type[id])
        && this.breachSolvers[this.approach[id]].contains(id);
      if (eligibleSolver) this.outerOverflowRank[id] = -1;
      const outerSolver = this.breachSolvers[this.approach[id]];
      const outerFormationTargetZ = this._outerFormationTargetZ(id, outerSolver);
      const waitingForOuterPacking = this.zone[id] === APPROACH_ZONE
        && isBreachEligible(this.type[id])
        && !pursuingPlayer
        && !this.outerGateBreached[this.approach[id]]
        && !eligibleSolver
        && outerSolver.activeCount >= outerSolver.capacity
        && this.z[id] <= Math.max(
          this.world.gateZ + outerSolver.entryDepth + Math.max(2, finite(this.world.overflowStagingDepth, 10)),
          outerFormationTargetZ + Math.max(0.5, enemyArchetype(this.type[id]).radius),
        );
      const heartPacked = this.zone[id] === COURTYARD_ZONE
        && isBreachEligible(this.type[id])
        && this.heartBreachSolver.contains(id);
      const waitingForHeartPacking = this.zone[id] === COURTYARD_ZONE
        && isBreachEligible(this.type[id])
        && !pursuingPlayer
        && !heartPacked
        && this.z[id] - this.world.heartGateZ <= this.heartBreachSolver.entryDepth;
      if (this.zone[id] === APPROACH_ZONE) {
        if (waitingForOuterPacking && !contactingPlayer) {
          // The full logical and visual army remains present, but overflow
          // forms readable authored ranks instead of occupying one gate point.
          this._holdOuterOverflow(id, dt, outerSolver);
        } else if (!eligibleSolver && !contactingPlayer) {
          this.vx[id] += (this.desiredVx[id] - this.vx[id]) * 0.3;
          this.vz[id] += (this.desiredVz[id] - this.vz[id]) * 0.3;
          this.x[id] += this.vx[id] * dt;
          this.z[id] += this.vz[id] * dt;
        }
        this._resolveEnemyObstacles(id, dt);
        if (!this.outerGateBreached[this.approach[id]]) {
          if (!pursuingPlayer) this._attackOuterGate(id, dt);
          const gateX = this.approach[id] === WEST ? this.world.westGateX : this.world.eastGateX;
          const radius = enemyArchetype(this.type[id]).radius;
          if (!pursuingPlayer
            && !eligibleSolver
            && !waitingForOuterPacking
            && this.z[id] < this.world.gateZ + radius) {
            this.z[id] = this.world.gateZ + radius;
            this.x[id] += (gateX - this.x[id]) * 0.08;
            this.vz[id] = 0;
          }
        } else if (this.z[id] <= this.world.courtyardEntryZ) {
          this.breachSolvers[this.approach[id]].deactivate(id);
          this.zone[id] = COURTYARD_ZONE;
          this.diagnostics.transferredToCourtyard++;
        }
      } else if (heartPacked) {
        this._attackHeartGate(id, dt, true);
      } else if (waitingForHeartPacking) {
        this._holdHeartOverflow(id, dt, this.heartBreachSolver);
      } else if (!contactingPlayer && !this._attackHeartGate(id, dt)) {
        this.vx[id] += (this.desiredVx[id] - this.vx[id]) * 0.35;
        this.vz[id] += (this.desiredVz[id] - this.vz[id]) * 0.35;
        this.x[id] += this.vx[id] * dt;
        this.z[id] += this.vz[id] * dt;
      }
      if (this.zone[id] === COURTYARD_ZONE) this._resolveEnemyObstacles(id, dt);
      this._resolveHunterPlayerClearance(id);
    }

    // Calculate staged pressure from the physical granular pack. Only its
    // visible front strikes, while solver members behind it supply the authored
    // crowd pressure. Remote reserves and genuinely marching companies remain
    // outside the solver and contribute zero.
    const stagedOuterPressure = [0, 0];
    const visibleFrontPressure = [0, 0];
    const visibleFrontDps = [0, 0];
    for (let id = 0; id < this.slotCount; id++) {
      if (this.status[id] !== ACTIVE
        || this.zone[id] !== APPROACH_ZONE
        || this.huntingPlayer[id]
        || this.outerGateBreached[this.approach[id]]) continue;
      const role = this.engagementRole[id];
      const lane = this.approach[id];
      const solverMember = this.breachSolvers[lane].contains(id);
      if (!solverMember
        && role !== ENGAGEMENT_GATE_QUEUE
        && role !== ENGAGEMENT_GATE_ATTACK) continue;
      const pressure = Math.max(0, this.gatePressure[id]);
      stagedOuterPressure[lane] += pressure;
      if (role !== ENGAGEMENT_GATE_ATTACK) continue;
      visibleFrontPressure[lane] += pressure;
      const archetype = enemyArchetype(this.type[id]);
      visibleFrontDps[lane] += archetype.attackDamage
        / Math.max(0.1, archetype.attackInterval)
        * pressure;
    }
    const authoredPressureDps = stagedOuterPressure.map((staged, lane) => (
      visibleFrontPressure[lane] > 1e-9
        ? visibleFrontDps[lane] * staged / visibleFrontPressure[lane]
        : 0
    ));
    if (!this.outerGateBreached[WEST]) {
      this.outerGateHp[WEST] = Math.max(
        0,
        this.outerGateHp[WEST] - authoredPressureDps[WEST] * dt * this.outerGatePressureScale,
      );
    }
    if (!this.outerGateBreached[EAST]) {
      this.outerGateHp[EAST] = Math.max(
        0,
        this.outerGateHp[EAST] - authoredPressureDps[EAST] * dt * this.outerGatePressureScale,
      );
    }
    this._markOuterBreaches();
    this.elapsed += dt;
    this.fixedTicks++;
    if (this.firstCompanyCrossedAt < 0) {
      let crossed = 0;
      for (let id = 0; id < this.slotCount; id++) {
        if (this.status[id] !== ACTIVE
          || this.companyIndex[id] !== 0
          || this.elapsed + 1e-6 < this.companyReleaseAt[id]
          || this.z[id] > HOST_EMERGENCE_PROFILE.treeLineZ) continue;
        crossed++;
      }
      if (crossed >= HOST_EMERGENCE_PROFILE.firstVisibleCompanyTarget) {
        this.firstCompanyCrossedAt = this.elapsed;
      }
    }
  }

  update(deltaSeconds) {
    let dt = finite(deltaSeconds, 0);
    if (dt <= 0) return 0;
    dt = Math.min(dt, this.fixedStep * this.maxSubSteps * 2);
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator + 1e-12 >= this.fixedStep && steps < this.maxSubSteps) {
      this._step(this.fixedStep);
      this.accumulator -= this.fixedStep;
      steps++;
    }
    if (steps === this.maxSubSteps && this.accumulator >= this.fixedStep) {
      const kept = this.accumulator % this.fixedStep;
      this.diagnostics.droppedTime += this.accumulator - kept;
      this.accumulator = kept;
    }
    return steps;
  }

  queryHits(query = {}) {
    const originX = finite(query.x, 0);
    const originZ = finite(query.z, 0);
    const radius = Math.max(0, finite(query.radius, 0));
    const maxResults = positiveInteger(query.maxResults, this.capacity);
    const typeFilter = query.types == null
      ? null
      : new Set(Array.isArray(query.types) ? query.types : [query.types]);
    const matches = [];
    for (let id = 0; id < this.slotCount; id++) {
      if (this.status[id] !== ACTIVE) continue;
      if (query.approach != null && this.approach[id] !== query.approach) continue;
      if (query.zone != null && this.zone[id] !== query.zone) continue;
      if (typeFilter && !typeFilter.has(this.type[id])) continue;
      const dx = this.x[id] - originX;
      const dz = this.z[id] - originZ;
      const distanceSquared = dx * dx + dz * dz;
      const hitRadius = radius + enemyArchetype(this.type[id]).radius;
      if (distanceSquared <= hitRadius * hitRadius) matches.push({id, distanceSquared});
    }
    matches.sort((a, b) => a.distanceSquared - b.distanceSquared || a.id - b.id);
    return matches.slice(0, maxResults).map((entry) => entry.id);
  }

  queryRayHits(query = {}) {
    const origin = query.origin || {};
    const direction = query.direction || {};
    const ox = finite(origin.x, 0);
    const oy = finite(origin.y, 0);
    const oz = finite(origin.z, 0);
    let dx = finite(direction.x, 0);
    let dy = finite(direction.y, 0);
    let dz = finite(direction.z, 1);
    const directionLength = Math.hypot(dx, dy, dz) || 1;
    dx /= directionLength;
    dy /= directionLength;
    dz /= directionLength;
    const maxDistance = Math.max(0, finite(query.maxDistance, 160));
    const padding = Math.max(0, finite(query.padding, 0));
    const maxResults = positiveInteger(query.maxResults, this.capacity);
    const matches = [];
    for (let id = 0; id < this.slotCount; id++) {
      if (this.status[id] !== ACTIVE) continue;
      const archetype = enemyArchetype(this.type[id]);
      const height = this.type[id] === SPOREWING
        ? 3.6
        : this.type[id] >= WICKER_COLOSSUS ? 3.1 : this.type[id] === 1 ? 1.75 : 1.25;
      const ex = this.x[id];
      const ey = height;
      const ez = this.z[id];
      const vx = ex - ox;
      const vy = ey - oy;
      const vz = ez - oz;
      const distance = vx * dx + vy * dy + vz * dz;
      if (distance < 0 || distance > maxDistance) continue;
      const closestX = ox + dx * distance;
      const closestY = oy + dy * distance;
      const closestZ = oz + dz * distance;
      const missDistance = Math.hypot(ex - closestX, ey - closestY, ez - closestZ);
      const hitRadius = archetype.radius + padding;
      if (missDistance <= hitRadius) matches.push({id, distance, missDistance});
    }
    matches.sort((a, b) => a.distance - b.distance || a.missDistance - b.missDistance || a.id - b.id);
    return matches.slice(0, maxResults);
  }

  queryConeHits(query = {}) {
    const originX = finite(query.x, 0);
    const originZ = finite(query.z, 0);
    let directionX = finite(query.directionX, 0);
    let directionZ = finite(query.directionZ, 1);
    const directionLength = Math.hypot(directionX, directionZ) || 1;
    directionX /= directionLength;
    directionZ /= directionLength;
    const range = Math.max(0, finite(query.range, 12));
    const halfAngle = clamp(finite(query.halfAngle, Math.PI / 8), 0, Math.PI);
    const minimumDot = Math.cos(halfAngle);
    const maxResults = positiveInteger(query.maxResults, this.capacity);
    const matches = [];
    for (let id = 0; id < this.slotCount; id++) {
      if (this.status[id] !== ACTIVE) continue;
      const vx = this.x[id] - originX;
      const vz = this.z[id] - originZ;
      const distance = Math.hypot(vx, vz);
      if (distance > range + enemyArchetype(this.type[id]).radius) continue;
      const dot = distance > 1e-6 ? (vx * directionX + vz * directionZ) / distance : 1;
      if (dot >= minimumDot) matches.push({id, distance, dot});
    }
    matches.sort((a, b) => a.distance - b.distance || b.dot - a.dot || a.id - b.id);
    return matches.slice(0, maxResults).map(entry => entry.id);
  }

  damageEnemy(id, amount) {
    if (!Number.isInteger(id) || id < 0 || id >= this.slotCount || this.status[id] !== ACTIVE) {
      return {id, hit: false, killed: false, hp: 0};
    }
    const damage = Math.max(0, finite(amount, 0));
    this.hp[id] = Math.max(0, this.hp[id] - damage);
    if (damage > 0) this.lastHitTime[id] = this.elapsed;
    let killed = false;
    if (this.hp[id] <= 0) {
      this.status[id] = DYING;
      this.deathTimer[id] = ENEMY_DEATH_SECONDS;
      this.stateProgress[id] = 0;
      this.vx[id] = 0;
      this.vz[id] = 0;
      this.activeCount--;
      this.diagnostics.killed++;
      this.breachSolvers[this.approach[id]].deactivate(id, "death");
      this.heartBreachSolver.deactivate(id, "death");
      killed = true;
    }
    return {id, hit: damage > 0, killed, hp: this.hp[id]};
  }

  damageInRadius(query, amount) {
    return this.queryHits(query).map((id) => this.damageEnemy(id, amount));
  }

  assertIntegrity() {
    let counted = 0;
    const seen = new Set();
    for (let slot = 0; slot < this.slotCount; slot++) {
      const id = this.ids[slot];
      if (id !== slot) throw new Error(`Stable ID mismatch at slot ${slot}: ${id}`);
      if (seen.has(id)) throw new Error(`Duplicate enemy ID ${id}`);
      seen.add(id);
      if (this.status[id] === ACTIVE) {
        counted++;
        if (this.engagementRole[id] >= ENEMY_ENGAGEMENT_ROLE_NAMES.length) {
          throw new Error(`Invalid engagement role ${this.engagementRole[id]} for active enemy ${id}`);
        }
        if (this.zone[id] !== APPROACH_ZONE && this.zone[id] !== COURTYARD_ZONE) {
          throw new Error(`Invalid zone ${this.zone[id]} for active enemy ${id}`);
        }
      }
    }
    if (counted !== this.activeCount) {
      throw new Error(`activeCount ${this.activeCount} does not match typed state ${counted}`);
    }
    for (const solver of this.breachSolvers) {
      for (let slot = 0; slot < solver.activeCount; slot++) {
        const id = solver.idBySlot[slot];
        if (this.status[id] !== ACTIVE || !isBreachEligible(this.type[id])) {
          throw new Error(`Invalid solver member ${id}`);
        }
      }
    }
    for (let slot = 0; slot < this.heartBreachSolver.activeCount; slot++) {
      const id = this.heartBreachSolver.idBySlot[slot];
      if (this.status[id] !== ACTIVE || this.zone[id] !== COURTYARD_ZONE || !isBreachEligible(this.type[id])) {
        throw new Error(`Invalid Heart solver member ${id}`);
      }
    }
    return true;
  }

  stats() {
    const byApproach = [0, 0];
    const byZone = [0, 0];
    let dead = 0;
    let waitingCount = 0;
    let huntingPlayerCount = 0;
    const engagementCounts = Object.fromEntries(ENEMY_ENGAGEMENT_ROLE_NAMES.map(name => [name, 0]));
    let releasedBodies = 0;
    let bodiesBeforeTreeLine = 0;
    let bodiesInsideVisibleRoad = 0;
    for (let id = 0; id < this.slotCount; id++) {
      if (this.status[id] === ACTIVE) {
        byApproach[this.approach[id]]++;
        byZone[this.zone[id]]++;
        waitingCount += this.waitingRank[id];
        huntingPlayerCount += this.huntingPlayer[id];
        engagementCounts[ENEMY_ENGAGEMENT_ROLE_NAMES[this.engagementRole[id]]]++;
        if (this.elapsed >= this.companyReleaseAt[id]) {
          releasedBodies++;
          if (this.z[id] <= HOST_EMERGENCE_PROFILE.treeLineZ) bodiesBeforeTreeLine++;
          if (this.z[id] <= HOST_EMERGENCE_PROFILE.roadVisualMaxZ) bodiesInsideVisibleRoad++;
        }
      } else if (this.status[id] === DEAD || this.status[id] === DYING) {
        dead++;
      }
    }
    return {
      capacity: this.capacity,
      slotCount: this.slotCount,
      activeCount: this.activeCount,
      deadCount: dead,
      dyingCount: Array.from(this.status.subarray(0, this.slotCount)).filter(status => status === DYING).length,
      waitingCount,
      continuousGatePressure: this.continuousGatePressure,
      huntingPlayerCount,
      engagementCounts,
      enemyObstacleCount: this.enemyObstacles.length,
      byApproach,
      byZone,
      fixedStep: this.fixedStep,
      fixedTicks: this.fixedTicks,
      elapsed: this.elapsed,
      accumulator: this.accumulator,
      outerGateHp: Array.from(this.outerGateHp),
      outerGateBreached: Array.from(this.outerGateBreached, Boolean),
      heartGateHp: this.heartGateHp,
      heartGateDestroyed: this.heartGateHp <= 0,
      breach: this.breachSolvers.map((solver) => solver.stats()),
      heartBreach: this.heartBreachSolver.stats(),
      hostEmergence: {
        initialSpawnBounds: this.initialSpawnBounds,
        treeLineZ: HOST_EMERGENCE_PROFILE.treeLineZ,
        visibleRoadMaxZ: HOST_EMERGENCE_PROFILE.roadVisualMaxZ,
        releasedBodies,
        bodiesBeforeTreeLine,
        bodiesInsideVisibleRoad,
        firstCompanyCrossedAt: this.firstCompanyCrossedAt >= 0 ? this.firstCompanyCrossedAt : null,
      },
      ...this.diagnostics
    };
  }
}

export function createBattlefield(options) {
  return new Battlefield(options);
}

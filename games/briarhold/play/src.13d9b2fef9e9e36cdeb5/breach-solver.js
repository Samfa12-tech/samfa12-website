import {
  BARKHIDE_BRUTE,
  BRIARBOUND,
  MOSSGUARD_SHIELD,
  enemyArchetype,
  isBreachEligible
} from "./enemies.js";

const EMPTY = -1;
const TWO_PI = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function integer(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function separationNormal(idA, idB) {
  let hash = Math.imul(idA + 1, 0x9e3779b1) ^ Math.imul(idB + 1, 0x85ebca77);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  const angle = (hash >>> 0) / 0x100000000 * TWO_PI;
  return [Math.cos(angle), Math.sin(angle)];
}

class BreachSolver {
  constructor(options = {}) {
    this.maxEnemies = integer(options.maxEnemies, 6000);
    this.capacity = Math.min(this.maxEnemies, integer(options.capacity, 512));
    this.gateX = finite(options.gateX, 0);
    this.gateZ = finite(options.gateZ, 0);
    this.zone = Number.isInteger(options.zone) ? options.zone : 0;
    this.entryDepth = Math.max(2, finite(options.entryDepth, 46));
    this.exitDepth = Math.max(this.entryDepth + 1, finite(options.exitDepth, 52));
    this.corridorHalfWidth = Math.max(2, finite(options.corridorHalfWidth, 8));
    this.gateHalfWidth = Math.max(0.5, finite(options.gateHalfWidth, 3.4));
    this.iterations = clamp(integer(options.iterations, 2), 1, 4);
    this.maxCandidatesPerBody = integer(options.maxCandidatesPerBody, 48);
    this.maxCorrection = Math.max(0.05, finite(options.maxCorrection, 0.7));
    this.correctionBudget = Math.max(0.05, finite(options.correctionBudget, 0.18));
    this.lateralSlideRate = Math.max(0, finite(options.lateralSlideRate, 4.5));
    this.maxLateralSlide = Math.max(0, finite(options.maxLateralSlide, 0.24));
    this.velocityBlend = clamp(finite(options.velocityBlend, 0.35), 0, 1);
    this.velocityDamping = clamp(finite(options.velocityDamping, 0.94), 0, 1);
    this.cellSize = Math.max(2.1, finite(options.cellSize, 2.1));
    this.columns = Math.max(1, Math.ceil(this.corridorHalfWidth * 2 / this.cellSize) + 2);
    this.rows = Math.max(1, Math.ceil(this.exitDepth / this.cellSize) + 3);

    this.idBySlot = new Int32Array(this.capacity);
    this.slotById = new Int32Array(this.maxEnemies);
    this.slotById.fill(-1);
    this.nextBySlot = new Int32Array(this.capacity);
    this.cellHeads = new Int32Array(this.columns * this.rows);
    this.predictedX = new Float32Array(this.capacity);
    this.predictedZ = new Float32Array(this.capacity);
    this.previousX = new Float32Array(this.capacity);
    this.previousZ = new Float32Array(this.capacity);
    this.solveOriginX = new Float32Array(this.capacity);
    this.solveOriginZ = new Float32Array(this.capacity);
    this.activeCount = 0;
    this.tick = 0;
    this.liveStats = {
      activeBodies: 0,
      capacity: this.capacity,
      entries: 0,
      exits: 0,
      deaths: 0,
      overflowCount: 0,
      pairsVisited: 0,
      pairsResolved: 0,
      candidateLimitHits: 0,
      wallContacts: 0,
      pressure: 0,
      maxOverlap: 0,
      tick: 0
    };
  }

  reset() {
    this.activeCount = 0;
    this.tick = 0;
    this.slotById.fill(-1);
    for (const key of Object.keys(this.liveStats)) {
      this.liveStats[key] = key === "capacity" ? this.capacity : 0;
    }
  }

  createCheckpoint() {
    return Object.freeze({
      version: 1,
      capacity: this.capacity,
      maxEnemies: this.maxEnemies,
      tick: this.tick,
      ids: Object.freeze(Array.from(this.idBySlot.subarray(0, this.activeCount))),
      stats: Object.freeze({...this.liveStats}),
    });
  }

  restoreCheckpoint(checkpoint) {
    if (!checkpoint || checkpoint.version !== 1) {
      throw new TypeError('Unsupported breach-solver checkpoint');
    }
    if (checkpoint.capacity !== this.capacity || checkpoint.maxEnemies !== this.maxEnemies) {
      throw new RangeError('Breach-solver checkpoint configuration mismatch');
    }
    if (!Array.isArray(checkpoint.ids) || checkpoint.ids.length > this.capacity) {
      throw new RangeError('Invalid breach-solver checkpoint membership');
    }
    const seen = new Set();
    for (const id of checkpoint.ids) {
      if (!Number.isInteger(id) || id < 0 || id >= this.maxEnemies || seen.has(id)) {
        throw new RangeError(`Invalid breach-solver checkpoint id: ${id}`);
      }
      seen.add(id);
    }
    if (!Number.isInteger(checkpoint.tick) || checkpoint.tick < 0) {
      throw new RangeError('Invalid breach-solver checkpoint tick');
    }

    this.reset();
    this.activeCount = checkpoint.ids.length;
    for (let slot = 0; slot < checkpoint.ids.length; slot += 1) {
      const id = checkpoint.ids[slot];
      this.idBySlot[slot] = id;
      this.slotById[id] = slot;
    }
    this.tick = checkpoint.tick;
    const sourceStats = checkpoint.stats && typeof checkpoint.stats === 'object'
      ? checkpoint.stats
      : {};
    for (const key of Object.keys(this.liveStats)) {
      const value = sourceStats[key];
      this.liveStats[key] = Number.isFinite(value) ? value : 0;
    }
    this.liveStats.capacity = this.capacity;
    this.liveStats.activeBodies = this.activeCount;
    this.liveStats.tick = this.tick;
    return this;
  }

  contains(id) {
    return Number.isInteger(id)
      && id >= 0
      && id < this.maxEnemies
      && this.slotById[id] >= 0;
  }

  tryActivate(id, type) {
    if (!Number.isInteger(id) || id < 0 || id >= this.maxEnemies || !isBreachEligible(type)) {
      return false;
    }
    if (this.contains(id)) return true;
    if (this.activeCount >= this.capacity) {
      this.liveStats.overflowCount++;
      return false;
    }
    const slot = this.activeCount++;
    this.idBySlot[slot] = id;
    this.slotById[id] = slot;
    this.liveStats.entries++;
    this.liveStats.activeBodies = this.activeCount;
    return true;
  }

  deactivate(id, reason = "exit") {
    if (!this.contains(id)) return false;
    const slot = this.slotById[id];
    const last = --this.activeCount;
    const movedId = this.idBySlot[last];
    this.slotById[id] = -1;
    if (slot !== last) {
      this.idBySlot[slot] = movedId;
      this.slotById[movedId] = slot;
    }
    if (reason === "death") this.liveStats.deaths++;
    else this.liveStats.exits++;
    this.liveStats.activeBodies = this.activeCount;
    return true;
  }

  consider(id, state) {
    if (!Number.isInteger(id) || id < 0 || id >= this.maxEnemies) return false;
    const alive = state.status[id] === state.ACTIVE;
    if (!alive || !isBreachEligible(state.type[id])) {
      if (this.contains(id)) this.deactivate(id, alive ? "exit" : "death");
      return false;
    }
    const depth = state.z[id] - this.gateZ;
    if (this.contains(id)) {
      if (!Number.isFinite(depth) || depth > this.exitDepth || state.zone[id] !== this.zone) {
        this.deactivate(id);
        return false;
      }
      return true;
    }
    const radius = this._radius(state, id);
    const insideCorridor = Number.isFinite(state.x[id])
      && Math.abs(state.x[id] - this.gateX) <= Math.max(0, this.corridorHalfWidth - radius);
    return Number.isFinite(depth)
      && insideCorridor
      && depth <= this.entryDepth
      && depth >= -4
      && this.tryActivate(id, state.type[id]);
  }

  _radius(state, id) {
    return enemyArchetype(state.type[id]).radius;
  }

  _mass(state, id) {
    return enemyArchetype(state.type[id]).mass;
  }

  _buildHash(reverse) {
    this.cellHeads.fill(EMPTY);
    for (let offset = 0; offset < this.activeCount; offset++) {
      const slot = reverse ? this.activeCount - 1 - offset : offset;
      const column = clamp(
        Math.floor((this.predictedX[slot] - (this.gateX - this.corridorHalfWidth)) / this.cellSize),
        0,
        this.columns - 1
      );
      const row = clamp(
        Math.floor((this.predictedZ[slot] - this.gateZ) / this.cellSize),
        0,
        this.rows - 1
      );
      const cell = row * this.columns + column;
      this.nextBySlot[slot] = this.cellHeads[cell];
      this.cellHeads[cell] = slot;
    }
  }

  _resolvePair(state, slotA, slotB) {
    const idA = this.idBySlot[slotA];
    const idB = this.idBySlot[slotB];
    let dx = this.predictedX[slotB] - this.predictedX[slotA];
    let dz = this.predictedZ[slotB] - this.predictedZ[slotA];
    let distanceSquared = dx * dx + dz * dz;
    const minimum = this._radius(state, idA) + this._radius(state, idB);
    if (distanceSquared >= minimum * minimum) return;
    let distance = 0;
    if (distanceSquared <= 1e-10 || !Number.isFinite(distanceSquared)) {
      [dx, dz] = separationNormal(idA, idB);
    } else {
      distance = Math.sqrt(distanceSquared);
      dx /= distance;
      dz /= distance;
    }
    const overlap = minimum - distance;
    if (overlap > this.liveStats.maxOverlap) this.liveStats.maxOverlap = overlap;
    const inverseA = 1 / this._mass(state, idA);
    const inverseB = 1 / this._mass(state, idB);
    const correction = Math.min(this.maxCorrection, Math.max(0, overlap - 0.002));
    const moveA = correction * inverseA / (inverseA + inverseB);
    const moveB = correction * inverseB / (inverseA + inverseB);
    this.predictedX[slotA] -= dx * moveA;
    this.predictedZ[slotA] -= dz * moveA;
    this.predictedX[slotB] += dx * moveB;
    this.predictedZ[slotB] += dz * moveB;
    this.liveStats.pairsResolved++;
  }

  _visitPairs(state, reverse) {
    for (let offset = 0; offset < this.activeCount; offset++) {
      const slotA = reverse ? this.activeCount - 1 - offset : offset;
      const idA = this.idBySlot[slotA];
      const column = clamp(
        Math.floor((this.predictedX[slotA] - (this.gateX - this.corridorHalfWidth)) / this.cellSize),
        0,
        this.columns - 1
      );
      const row = clamp(
        Math.floor((this.predictedZ[slotA] - this.gateZ) / this.cellSize),
        0,
        this.rows - 1
      );
      let candidates = 0;
      let limited = false;
      for (let rz = -1; rz <= 1 && !limited; rz++) {
        const nearRow = row + rz;
        if (nearRow < 0 || nearRow >= this.rows) continue;
        for (let cx = -1; cx <= 1 && !limited; cx++) {
          const nearColumn = column + cx;
          if (nearColumn < 0 || nearColumn >= this.columns) continue;
          let slotB = this.cellHeads[nearRow * this.columns + nearColumn];
          while (slotB !== EMPTY) {
            const idB = this.idBySlot[slotB];
            if (idA < idB) {
              if (candidates >= this.maxCandidatesPerBody) {
                limited = true;
                this.liveStats.candidateLimitHits++;
                break;
              }
              candidates++;
              this.liveStats.pairsVisited++;
              this._resolvePair(state, slotA, slotB);
            }
            slotB = this.nextBySlot[slotB];
          }
        }
      }
    }
  }

  _capAccumulatedCorrection(slot) {
    const dx = this.predictedX[slot] - this.solveOriginX[slot];
    const dz = this.predictedZ[slot] - this.solveOriginZ[slot];
    const distanceSquared = dx * dx + dz * dz;
    const budgetSquared = this.correctionBudget * this.correctionBudget;
    if (distanceSquared <= budgetSquared || distanceSquared <= 1e-12) return;
    const scale = this.correctionBudget / Math.sqrt(distanceSquared);
    this.predictedX[slot] = this.solveOriginX[slot] + dx * scale;
    this.predictedZ[slot] = this.solveOriginZ[slot] + dz * scale;
  }

  step(state, dt, context = {}) {
    const wallEnabled = context.wallEnabled !== false;
    this.liveStats.pairsVisited = 0;
    this.liveStats.pairsResolved = 0;
    this.liveStats.candidateLimitHits = 0;
    this.liveStats.wallContacts = 0;
    this.liveStats.pressure = 0;
    this.liveStats.maxOverlap = 0;

    let slot = 0;
    while (slot < this.activeCount) {
      const id = this.idBySlot[slot];
      if (
        state.status[id] !== state.ACTIVE
        || state.zone[id] !== this.zone
        || !isBreachEligible(state.type[id])
      ) {
        this.deactivate(id, state.status[id] === state.ACTIVE ? "exit" : "death");
        continue;
      }
      slot++;
    }

    // A full solver must not freeze every admitted body. Membership begins at
    // entryDepth (46 m on the outer approach), so a global zero here stranded
    // most of the visible assault column tens of metres from the gate. Only
    // the compact front packing zone settles; bodies behind it retain authored
    // forward intent until they actually join the jam.
    const settlingFront = wallEnabled
      && context.settleAtCapacity === true
      && this.activeCount >= this.capacity;
    for (slot = 0; slot < this.activeCount; slot++) {
      const id = this.idBySlot[slot];
      const wallContactDepth = this._radius(state, id) + Math.max(0.02, finite(context.settleSkin, 0.06));
      const depth = state.z[id] - this.gateZ;
      // Yield progressively as the granular column compresses. Last Guard's
      // mature solver receives this through crowd-steered desired velocity;
      // Briarhold keeps the same principle local and deterministic.
      const compressionDepth = this.activeCount > 160 ? this.entryDepth * 2 : 11;
      const packingFlow = wallEnabled
        ? clamp((depth - wallContactDepth) / compressionDepth, 0.18, 1)
        : 1;
      const admissionFlow = settlingFront && depth <= wallContactDepth
        ? 0
        : packingFlow;
      const desiredX = (context.desiredVx ? finite(context.desiredVx[id], 0) : 0) * admissionFlow;
      const desiredZ = (context.desiredVz
        ? finite(context.desiredVz[id], -enemyArchetype(state.type[id]).speed)
        : 0) * admissionFlow;
      state.vx[id] += (desiredX - state.vx[id]) * this.velocityBlend;
      state.vz[id] += (desiredZ - state.vz[id]) * this.velocityBlend;
      this.previousX[slot] = state.x[id];
      this.previousZ[slot] = state.z[id];
      this.predictedX[slot] = state.x[id] + state.vx[id] * dt;
      this.predictedZ[slot] = state.z[id] + state.vz[id] * dt;
      this.solveOriginX[slot] = this.predictedX[slot];
      this.solveOriginZ[slot] = this.predictedZ[slot];
    }

    const reverse = (this.tick & 1) !== 0;
    for (let iteration = 0; iteration < this.iterations; iteration++) {
      const passReverse = iteration & 1 ? !reverse : reverse;
      this._buildHash(passReverse);
      this._visitPairs(state, passReverse);
      for (slot = 0; slot < this.activeCount; slot++) {
        this._capAccumulatedCorrection(slot);
        const id = this.idBySlot[slot];
        const radius = this._radius(state, id);
        const passageDepth = 6;
        // Begin opening the post-breach funnel one metre before the logical
        // threshold. The collision-backed piers then supply exact clearance
        // without a late solver clamp that throws packed bodies sideways.
        const passageLead = 1;
        const funnel = wallEnabled
          ? 0
          : clamp((this.gateZ + passageDepth + passageLead - this.predictedZ[slot]) / passageDepth, 0, 1);
        const activeHalfWidth = this.corridorHalfWidth
          + (this.gateHalfWidth - this.corridorHalfWidth) * funnel;
        this.predictedX[slot] = clamp(
          this.predictedX[slot],
          this.gateX - activeHalfWidth + radius,
          this.gateX + activeHalfWidth - radius
        );
        if (wallEnabled && this.predictedZ[slot] < this.gateZ + radius) {
          const denied = this.gateZ + radius - this.predictedZ[slot];
          this.predictedZ[slot] = this.gateZ + radius;
          if (
            this.predictedX[slot] >= this.gateX - this.gateHalfWidth + radius
            && this.predictedX[slot] <= this.gateX + this.gateHalfWidth - radius
          ) {
            this.liveStats.wallContacts++;
            this.liveStats.pressure += denied / Math.max(dt, 1 / 240) * this._mass(state, id);
          }
        }
        // Bodies that meet the wall outside the aperture keep sliding across
        // its face into the gate pack. This is the granular swarm behaviour
        // used by The Last Guard: the wall supplies a physical constraint, not
        // a set of planted queue slots that wait for a front body to disappear.
        if (wallEnabled && this.predictedZ[slot] <= this.gateZ + radius + 0.035) {
          const laneMin = this.gateX - this.gateHalfWidth + radius;
          const laneMax = this.gateX + this.gateHalfWidth - radius;
          let lateralCorrection = 0;
          if (this.predictedX[slot] < laneMin) lateralCorrection = laneMin - this.predictedX[slot];
          else if (this.predictedX[slot] > laneMax) lateralCorrection = laneMax - this.predictedX[slot];
          if (lateralCorrection !== 0) {
            const amount = Math.sign(lateralCorrection) * Math.min(
              Math.abs(lateralCorrection),
              this.maxLateralSlide,
              this.lateralSlideRate * dt,
            );
            this.predictedX[slot] = clamp(
              this.predictedX[slot] + amount,
              this.gateX - activeHalfWidth + radius,
              this.gateX + activeHalfWidth - radius,
            );
          }
        }
      }
    }

    for (slot = 0; slot < this.activeCount; slot++) {
      const id = this.idBySlot[slot];
      state.x[id] = this.predictedX[slot];
      state.z[id] = this.predictedZ[slot];
      // Separation is a positional packing correction, not locomotion intent.
      // Feeding it back into velocity makes the next fixed step amplify a crowd
      // nudge into a lateral dart, especially in the densest gate ranks.
      state.vx[id] = (this.solveOriginX[slot] - this.previousX[slot]) / dt * this.velocityDamping;
      state.vz[id] = (this.solveOriginZ[slot] - this.previousZ[slot]) / dt * this.velocityDamping;
      const radius = this._radius(state, id);
      const passageDepth = 6;
      const passageLead = 1;
      const funnel = wallEnabled
        ? 0
        : clamp((this.gateZ + passageDepth + passageLead - state.z[id]) / passageDepth, 0, 1);
      const activeHalfWidth = this.corridorHalfWidth
        + (this.gateHalfWidth - this.corridorHalfWidth) * funnel;
      const left = this.gateX - activeHalfWidth + radius;
      const right = this.gateX + activeHalfWidth - radius;
      if (state.x[id] <= left + 0.001 && state.vx[id] < 0) state.vx[id] = 0;
      if (state.x[id] >= right - 0.001 && state.vx[id] > 0) state.vx[id] = 0;
      if (wallEnabled && this.liveStats.wallContacts > 0 && state.z[id] <= this.gateZ + this._radius(state, id) + 0.01) {
        state.vz[id] = Math.max(0, state.vz[id]);
      }
    }

    this.tick++;
    this.liveStats.tick = this.tick;
    this.liveStats.activeBodies = this.activeCount;
    return this.liveStats;
  }

  stats() {
    this.liveStats.activeBodies = this.activeCount;
    return {...this.liveStats};
  }
}

export function createBreachSolver(options) {
  return new BreachSolver(options);
}

export const BREACH_BODY_TYPES = Object.freeze([
  BRIARBOUND,
  BARKHIDE_BRUTE,
  MOSSGUARD_SHIELD
]);

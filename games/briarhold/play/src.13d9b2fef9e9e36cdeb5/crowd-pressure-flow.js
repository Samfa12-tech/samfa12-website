import {enemyArchetype} from './enemies.js';

// Local contact queries cover neighbouring four-metre cells only. Scratch data
// is rebuilt from authoritative positions each fixed step, so checkpoints need
// no extra state and a large host never introduces an all-pairs crowd pass.
export class CrowdPressureFlow {
  constructor(capacity, world) {
    this.cellSize = 4;
    this.minX = Math.min(-60, world.spawnMinX - 8);
    this.minZ = Math.min(-40, world.heartGateZ - 12);
    this.columns = Math.ceil((Math.max(60, world.spawnMaxX + 8) - this.minX) / this.cellSize);
    this.rows = Math.ceil((Math.max(180, world.spawnFarZ + 8) - this.minZ) / this.cellSize);
    this.counts = new Int32Array(this.columns * this.rows);
    this.starts = new Int32Array(this.counts.length);
    this.cursors = new Int32Array(this.counts.length);
    this.ids = new Int32Array(capacity);
    this.neighbours = new Int32Array(64);
    this.cellOffsets = [0, 0, -1, 0, 1, 0, 0, -1, 0, 1, -1, -1, 1, -1, -1, 1, 1, 1];
    this.queries = 0;
    this.visited = 0;
  }

  cellX(x) {return Math.max(0, Math.min(this.columns - 1, Math.floor((x - this.minX) / this.cellSize)));}
  cellZ(z) {return Math.max(0, Math.min(this.rows - 1, Math.floor((z - this.minZ) / this.cellSize)));}

  build(state) {
    this.counts.fill(0);
    this.queries = 0;
    this.visited = 0;
    for (let id = 0; id < state.slotCount; id += 1) {
      if (state.status[id] !== state.ACTIVE || enemyArchetype(state.type[id]).flying) continue;
      const cell = this.cellZ(state.z[id]) * this.columns + this.cellX(state.x[id]);
      this.counts[cell] += 1;
    }
    let start = 0;
    for (let cell = 0; cell < this.counts.length; cell += 1) {
      this.starts[cell] = start;
      this.cursors[cell] = start;
      start += this.counts[cell];
    }
    for (let id = 0; id < state.slotCount; id += 1) {
      if (state.status[id] !== state.ACTIVE || enemyArchetype(state.type[id]).flying) continue;
      const cell = this.cellZ(state.z[id]) * this.columns + this.cellX(state.x[id]);
      this.ids[this.cursors[cell]++] = id;
    }
  }

  advance(state, id, dt) {
    const x = state.x[id], z = state.z[id];
    const radius = enemyArchetype(state.type[id]).radius;
    const cx = this.cellX(x), cz = this.cellZ(z);
    let count = 0;
    // Scan no more than 64 local candidates, including coincident stress input.
    for (let offset = 0; offset < this.cellOffsets.length && count < 64; offset += 2) {
      const column = cx + this.cellOffsets[offset], row = cz + this.cellOffsets[offset + 1];
      if (column < 0 || column >= this.columns || row < 0 || row >= this.rows) continue;
      const cell = row * this.columns + column;
      const total = this.counts[cell];
      // Dense-cell offsets are O(1), unlike walking past an unbounded linked
      // list. Every stable ID gets contact coverage over successive fixed steps.
      const first = total > 64 ? (Math.imul(id + 1, 17) + state.fixedTicks * 31) % total : 0;
      for (let index = 0; index < total && count < 64; index += 1) {
        const other = this.ids[this.starts[cell] + (first + index) % total];
        if (other !== id) this.neighbours[count++] = other;
      }
    }
    this.queries += 1;
    this.visited += count;
    let vx = state.desiredVx[id], vz = Math.min(0, state.desiredVz[id]);
    const speed = Math.hypot(vx, vz);
    let blockedAhead = false;
    for (let index = 0; index < count; index += 1) {
      const other = this.neighbours[index];
      const dx = state.x[other] - x, dz = state.z[other] - z;
      const clearance = radius + enemyArchetype(state.type[other]).radius;
      if (dz < 0 && dz > -clearance - 0.35 && Math.abs(dx) < clearance * 0.7) blockedAhead = true;
    }
    if (blockedAhead) {
      // A stable side preference opens adjacent free space without changing
      // sides every tick when the nearest contact changes in a packed swarm.
      const side = id & 1 ? 1 : -1;
      const preference = 0.32 + ((Math.imul(id + 1, 2654435761) >>> 0) / 4294967295) * 0.2;
      vx += side * speed * preference;
    }
    const steeredSpeed = Math.hypot(vx, vz);
    if (steeredSpeed > speed && speed > 0) {vx *= speed / steeredSpeed; vz *= speed / steeredSpeed;}
    vx = state.vx[id] + (vx - state.vx[id]) * 0.22;
    vz = state.vz[id] + (vz - state.vz[id]) * 0.22;
    // Remove velocity into existing contacts. Separation remains a positional
    // correction; it must never become momentum and produce lateral darts.
    for (let pass = 0; pass < 2; pass += 1) {
      for (let index = 0; index < count; index += 1) {
        const other = this.neighbours[index];
        const dx = x - state.x[other], dz = z - state.z[other];
        const distance = Math.hypot(dx, dz);
        const clearance = radius + enemyArchetype(state.type[other]).radius;
        if (distance < 0.001 || distance > clearance + 0.09) continue;
        const inward = (vx * dx + vz * dz) / distance;
        if (inward < 0) {vx -= inward * dx / distance; vz -= inward * dz / distance;}
      }
    }
    if (Math.abs(vx) < 0.035) vx = 0;
    if (Math.abs(vz) < 0.035) vz = 0;
    vz = Math.min(0, vz);
    const wallZ = state.zone[id] === 1 ? state.world.heartGateZ + radius
      : !state.outerGateBreached[state.approach[id]] ? state.world.gateZ + radius : -Infinity;
    let nextX = x + vx * dt, nextZ = Math.max(wallZ, z + vz * dt);
    const originX = nextX, originZ = nextZ;
    const correctionBudget = Math.min(0.09, dt * 2.4);
    for (let pass = 0; pass < 2; pass += 1) {
      for (let index = 0; index < count; index += 1) {
        const other = this.neighbours[index];
        let dx = nextX - state.x[other], dz = nextZ - state.z[other];
        const clearance = radius + enemyArchetype(state.type[other]).radius;
        let distance = Math.hypot(dx, dz);
        if (distance >= clearance - 0.025) continue;
        if (distance < 0.001) {
          const sign = id < other ? -1 : 1;
          const angle = ((Math.imul(Math.min(id, other) + 1, 73856093) ^ Math.imul(Math.max(id, other) + 1, 19349663)) >>> 0) * 0.000001;
          dx = Math.cos(angle) * sign; dz = Math.sin(angle) * sign; distance = 1;
        }
        const overlap = Math.min(0.12, (clearance - Math.hypot(nextX - state.x[other], nextZ - state.z[other]) - 0.025) * 0.5);
        nextX += dx / distance * overlap;
        nextZ += dz / distance * overlap;
        const correctionX = nextX - originX, correctionZ = nextZ - originZ;
        const total = Math.hypot(correctionX, correctionZ);
        if (total > correctionBudget) {
          nextX = originX + correctionX / total * correctionBudget;
          nextZ = originZ + correctionZ / total * correctionBudget;
        }
        // Contact projection must obey the wall during each pass. Clamping
        // only afterwards let crowded bodies separate into the wall, then
        // collapse back onto exactly the same visible position every tick.
        nextZ = Math.max(wallZ, nextZ);
      }
    }
    state.x[id] = Math.max(state.world.spawnMinX + radius, Math.min(state.world.spawnMaxX - radius, nextX));
    state.z[id] = nextZ;
    state.vx[id] = vx;
    state.vz[id] = vz;
  }
}

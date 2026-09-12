import {sampleWalkableGround} from './map-definition.js';
import {positionIsClear} from './player-controller.js';

export const SUPPLY_ORB_VALUE = 2;
export const SUPPLY_ORB_LIMIT = 12;
const MAX_ELIGIBLE = 12000;
const exact = (v, keys) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k))) throw new TypeError('invalid supply orb record');
};
const integer = (v, min, max) => {
  if (!Number.isSafeInteger(v) || v < min || v > max) throw new RangeError('invalid supply orb integer');
  return v;
};
export function supplyDeathMilestones(total) {
  integer(total, 0, MAX_ELIGIBLE);
  const count = Math.min(SUPPLY_ORB_LIMIT, total);
  return Array.from({length: count}, (_, i) => Math.ceil((i + 1) * total / count));
}
export function supplyRosterIdentity(roster) {
  const ids = roster.enemies.map(e => `crowd:${roster.night}:${roster.waveIndex}:${e.groupId}:${e.groupBodyIndex}`);
  for (const actor of roster.bossActors ?? []) ids.push(`boss:${actor.id}`);
  if (new Set(ids).size !== ids.length) throw new RangeError('duplicate authored supply identity');
  let hash = 2166136261;
  for (const character of ids.join('|')) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return {total: ids.length, rosterKey: `${roster.night}:${roster.waveIndex}:${hash.toString(16)}`};
}
export function normalizeSupplyOrbState(input) {
  if (input == null) return null;
  exact(input, ['version', 'night', 'wave', 'rosterKey', 'total', 'bodyCount', 'densityProfile', 'deaths', 'count', 'consumed', 'live', 'explained']);
  if (input.version !== 1 || typeof input.rosterKey !== 'string' || !/^\d+:\d+:[a-f0-9]+$/u.test(input.rosterKey)) throw new RangeError('invalid supply orb version/roster');
  const total = integer(input.total, 0, MAX_ELIGIBLE);
  integer(input.bodyCount, Math.max(0,total-2), total);
  if (!['mobile','desktop'].includes(input.densityProfile)) throw new RangeError('invalid supply density profile');
  if (typeof input.deaths !== 'string' || input.deaths.length !== Math.ceil(total / 4) || !/^[0-9a-f]*$/u.test(input.deaths)) throw new RangeError('invalid supply death bitmap');
  const count = [...input.deaths].reduce((sum, n) => sum + [0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4][parseInt(n, 16)], 0);
  if (count !== input.count || count > total) throw new RangeError('supply death count mismatch');
  const milestones = supplyDeathMilestones(total);
  const valid = id => Number.isSafeInteger(id) && milestones.includes(id) && id <= count;
  if (!Array.isArray(input.consumed) || input.consumed.length > 12 || input.consumed.some(id => !valid(id)) || new Set(input.consumed).size !== input.consumed.length) throw new RangeError('invalid consumed supply milestones');
  const live = normalizeSupplyOrbPresentation(input.live);
  if (live.some(orb => !valid(orb.id) || input.consumed.includes(orb.id))) throw new RangeError('invalid live supply milestone');
  if (typeof input.explained !== 'boolean') throw new TypeError('invalid supply explanation');
  return {...input, night: integer(input.night, 1, 7), wave: integer(input.wave, 0, 2), consumed: [...input.consumed], live};
}
export function normalizeSupplyOrbPresentation(input = []) {
  if (!Array.isArray(input) || input.length > 12) throw new RangeError('invalid supply orb presentation');
  const ids = new Set();
  return input.map(orb => {
    exact(orb, ['id', 'x', 'y', 'z']);
    integer(orb.id, 1, MAX_ELIGIBLE);
    if (ids.has(orb.id)) throw new RangeError('duplicate supply orb');
    ids.add(orb.id);
    for (const key of ['x', 'y', 'z']) if (!Number.isFinite(orb[key]) || Math.abs(orb[key]) > 10000) throw new RangeError('invalid supply position');
    return {...orb};
  });
}
export function supplyOrbPresentationForRun(run) {
  const state = run?.supplyOrbs;
  const activeWave = run?.phase === 'combat'
    ? run.wave
    : run?.phase === 'interwave_recovery'
      ? run.wave - 1
      : null;
  return state && state.night === run.night && state.wave === activeWave ? state.live : [];
}
export function clearLiveSupplyOrbs(run) {
  if (!run?.supplyOrbs || run.supplyOrbs.live.length === 0) return run;
  return {...run, supplyOrbs: {...run.supplyOrbs, live: []}};
}
export function prepareSupplyOrbs(run, roster) {
  const identity = supplyRosterIdentity(roster);
  const prior = normalizeSupplyOrbState(run.supplyOrbs);
  if (prior?.night === roster.night && prior.wave === roster.waveIndex) {
    if (prior.rosterKey !== identity.rosterKey || prior.total !== identity.total) throw new RangeError('saved supply roster differs from authored wave');
    return prior;
  }
  return {version: 1, night: roster.night, wave: roster.waveIndex, ...identity,
    bodyCount: roster.enemies.length, densityProfile: roster.profile?.id ?? 'desktop',
    deaths: '0'.repeat(Math.ceil(identity.total / 4)), count: 0, consumed: [], live: [], explained: prior?.explained ?? false};
}
/** A preference change applies next wave: current-wave replay keeps authored IDs and milestones. */
export function supplyRecoveryRoster(run, wave, selectedProfile, options = {}) {
  const state = run?.supplyOrbs;
  return state?.night === run.night && state.wave === wave
    ? {profile: state.densityProfile, options: {...options, targetBodies: state.bodyCount, maxBodies: state.bodyCount}}
    : {profile: selectedProfile, options};
}
/** One authoritative edge for any killer. Summons have no authored index. */
export function recordSupplyDeath(state, index, point, place) {
  if (!state || !Number.isInteger(index) || index < 0 || index >= state.total) return false;
  const digit = Math.floor(index / 4), mask = 1 << (index % 4), old = parseInt(state.deaths[digit], 16);
  if (old & mask) return false;
  state.deaths = state.deaths.slice(0, digit) + (old | mask).toString(16) + state.deaths.slice(digit + 1);
  state.count++;
  if (!supplyDeathMilestones(state.total).includes(state.count)) return false;
  const position = place(point);
  if (!position) return false; // This milestone remains spent, even when unreachable.
  state.live.push({id: state.count, ...position});
  return true;
}
export function projectSupplyOrb(point, map, blocked = () => false) {
  for (const [dx, dz] of [[0,0],[.75,0],[-.75,0],[0,.75],[0,-.75]]) {
    const x = point.x + dx, z = point.z + dz;
    const support = sampleWalkableGround(map, x, z, {currentY: point.y, maxStepHeight: .2, maxDropHeight: Infinity});
    if (!support) continue;
    const candidate = {x, y: support.y, z};
    if (!positionIsClear(candidate, map) || blocked(candidate)) continue;
    return candidate;
  }
  return null;
}
/** Host positions use feet; no vertical or through-wall pickup and no sweep. */
export function collectSupplyOrbs(run, actors, obstructed) {
  const state = run?.supplyOrbs;
  if (!state || supplyOrbPresentationForRun(run) !== state.live) return [];
  const picked = [];
  state.live = state.live.filter(orb => {
    const actor = actors.find(a => a.hp > 0 && Math.abs(a.position.y - orb.y) <= .6
      && Math.hypot(a.position.x - orb.x, a.position.z - orb.z) <= 2
      && !obstructed({...a.position, y: a.position.y + .4}, {...orb, y: orb.y + .4}));
    if (!actor || state.consumed.includes(orb.id)) return true;
    state.consumed.push(orb.id);
    run.supplies += SUPPLY_ORB_VALUE;
    picked.push({id: orb.id, actorId: actor.playerId ?? 'solo'});
    return false;
  });
  return picked;
}
export function createSupplyOrbRenderer(BABYLON, scene) {
  const material = new BABYLON.StandardMaterial('supply-orb-glow', scene);
  material.diffuseColor = BABYLON.Color3.FromHexString('#95ffd0');
  material.emissiveColor = BABYLON.Color3.FromHexString('#49c891');
  material.disableLighting = true;
  const texture = new BABYLON.DynamicTexture('supply-orb-halo-gradient', {width: 32, height: 32}, scene, false);
  const context = texture.getContext();
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(190,255,225,0.8)');
  gradient.addColorStop(.3, 'rgba(115,255,185,0.35)');
  gradient.addColorStop(1, 'rgba(90,255,170,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 32, 32); texture.hasAlpha = true; texture.update();
  const haloMaterial = new BABYLON.StandardMaterial('supply-orb-halo', scene);
  haloMaterial.diffuseTexture = texture; haloMaterial.emissiveTexture = texture;
  haloMaterial.useAlphaFromDiffuseTexture = true; haloMaterial.disableLighting = true;
  haloMaterial.backFaceCulling = false; haloMaterial.disableDepthWrite = true;
  const halos = [];
  const meshes = Array.from({length: 12}, (_, i) => {
    const mesh = BABYLON.MeshBuilder.CreateSphere(`supply-orb-${i}`, {diameter: .24, segments: 6}, scene);
    mesh.material = material; mesh.isPickable = false; mesh.setEnabled(false);
    const halo = BABYLON.MeshBuilder.CreatePlane(`supply-orb-halo-${i}`, {size: 1}, scene);
    halo.material = haloMaterial; halo.isPickable = false; halo.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    halo.setEnabled(false); halos.push(halo);
    return mesh;
  });
  return {update(orbs = []) { meshes.forEach((mesh, i) => {
    const orb = orbs[i]; mesh.setEnabled(Boolean(orb)); halos[i].setEnabled(Boolean(orb));
    if (orb) { mesh.position.set(orb.x, orb.y + .4, orb.z); halos[i].position.copyFrom(mesh.position); }
  }); }, dispose() { [...meshes,...halos].forEach(m => m.dispose()); material.dispose(); haloMaterial.dispose(); texture.dispose(); }};
}

import {
  ENGAGEMENT_GATE_ATTACK,
  ENGAGEMENT_PLAYER_ATTACK,
  ENGAGEMENT_HUNTER,
} from './battlefield.js';
import {sporewingFlightOffsetAtGate} from './enemy-presentation.js';

const ACTIVE = 1;
const DYING = 3;
const OFFSCREEN = 100000;
const SELECTION_INTERVAL_SECONDS = 0.2;
export const ANIMATED_ENEMY_CLONE_OPTIONS = Object.freeze({doNotInstantiate: true});
export const ANIMATED_ENEMY_MODEL_YAW_OFFSET = Math.PI;

/** The generated rigs reuse colour as an emissive map and omit metallic
 * factors (glTF defaults to metal). Keep the painted detail, but let organic
 * bodies receive the same moonlight/firelight separation as the fortress. */
export function applyAnimatedEnemySurface(material, type) {
  if (!material) return;
  material.metallic = type === 'mossguard' ? 0.15 : 0;
  material.roughness = type === 'mossguard' ? 0.8 : 0.88;
  material.directIntensity = 1.15;
  material.environmentIntensity = 0.8;
  material.emissiveIntensity = 0.22;
  material.maxSimultaneousLights = 4;
}

export const ANIMATED_ENEMY_MODELS = Object.freeze({
  0: Object.freeze({
    key: 'briarbound',
    asset: 'assets/meshy/runtime/enemy-briarbound-3d-512.glb',
    share: 12,
    y: 0,
  }),
  1: Object.freeze({
    key: 'barkhide',
    asset: 'assets/meshy/runtime/enemy-barkhide-3d-512.glb',
    share: 4,
    y: 0,
  }),
  2: Object.freeze({
    key: 'mossguard',
    asset: 'assets/meshy/runtime/enemy-mossguard-3d-512.glb',
    share: 4,
    y: 0,
  }),
  3: Object.freeze({
    key: 'sporewing',
    asset: 'assets/meshy/runtime/enemy-sporewing-3d-512.glb',
    share: 3,
    y: 1.35,
  }),
  5: Object.freeze({
    key: 'wicker',
    asset: 'assets/meshy/runtime/enemy-wicker-3d-512.glb',
    share: 1,
    y: 0,
  }),
});

export function animatedEnemyFlightY(type, z, gateZ = 0, models = ANIMATED_ENEMY_MODELS) {
  const enemyType = Math.max(0, Math.floor(Number(type) || 0));
  const model = models[enemyType];
  if (!model) return 0;
  return enemyType === 3 ? sporewingFlightOffsetAtGate(z, gateZ) : model.y;
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/** Meshy runtime rigs face -Z at yaw zero; Babylon movement headings assume +Z. */
export function animatedEnemyYaw(vx, vz, modelYawOffset = ANIMATED_ENEMY_MODEL_YAW_OFFSET) {
  const yaw = Math.atan2(finite(vx), finite(vz)) + finite(modelYawOffset, Math.PI);
  return Math.atan2(Math.sin(yaw), Math.cos(yaw));
}

function splitAssetPath(asset) {
  const normalized = String(asset || '').replaceAll('\\', '/');
  const slash = normalized.lastIndexOf('/');
  return {
    rootUrl: slash >= 0 ? normalized.slice(0, slash + 1) : '',
    fileName: slash >= 0 ? normalized.slice(slash + 1) : normalized,
  };
}

function renderable(battlefield, id) {
  const status = battlefield.status?.[id];
  return status === (battlefield.ACTIVE ?? ACTIVE)
    || status === (battlefield.DYING ?? DYING);
}

export function animatedEnemyTypeLimits(limitValue, models = ANIMATED_ENEMY_MODELS) {
  const limit = Math.max(0, Math.floor(finite(limitValue)));
  const entries = Object.entries(models);
  if (!limit || !entries.length) return Object.freeze({});
  const ordered = [...entries].sort(([typeA, a], [typeB, b]) =>
    b.share - a.share || Number(typeA) - Number(typeB));
  const result = Object.fromEntries(entries.map(([type]) => [type, 0]));
  // Preserve one silhouette of every available type when the cap permits it.
  for (const [type] of [...entries].sort(([, a], [, b]) => a.share - b.share)) {
    if (limit < entries.length) break;
    result[type] = 1;
  }

  const shareTotal = entries.reduce((sum, [, definition]) => sum + definition.share, 0);
  const targets = ordered.map(([type, definition]) => {
    const exact = limit * definition.share / shareTotal;
    const base = Math.min(definition.share, Math.max(result[type], Math.floor(exact)));
    result[type] = base;
    return {type, definition, exact, fraction: exact - Math.floor(exact)};
  });

  let remaining = limit - Object.values(result).reduce((sum, value) => sum + value, 0);
  targets.sort((a, b) => b.fraction - a.fraction
    || b.definition.share - a.definition.share
    || Number(a.type) - Number(b.type));
  while (remaining > 0) {
    const next = targets.find(({type, definition}) => result[type] < definition.share);
    if (!next) break;
    result[next.type] += 1;
    remaining -= 1;
    next.fraction -= 1;
    targets.sort((a, b) => b.fraction - a.fraction
      || b.definition.share - a.definition.share
      || Number(a.type) - Number(b.type));
  }
  return Object.freeze(result);
}

export function nearestAnimatedEnemyIds({
  battlefield,
  type,
  limit,
  cameraPosition,
  retainedIds = null,
} = {}) {
  const count = Math.max(0, Math.floor(finite(limit)));
  if (!battlefield || !count) return Int32Array.from([]);
  const cameraX = finite(cameraPosition?.x);
  const cameraZ = finite(cameraPosition?.z);
  const slotCount = Math.max(0, Math.min(
    Number.isInteger(battlefield.slotCount) ? battlefield.slotCount : battlefield.capacity || 0,
    battlefield.capacity || 0,
  ));
  const selected = [];
  const selectedSet = new Set();
  for (const idValue of retainedIds ?? []) {
    const id = Math.trunc(Number(idValue));
    if (selected.length >= count) break;
    if (selectedSet.has(id)) continue;
    if (id < 0 || id >= slotCount || battlefield.type?.[id] !== Number(type)) continue;
    if (!renderable(battlefield, id)) continue;
    selected.push(id);
    selectedSet.add(id);
  }
  const candidates = [];
  for (let id = 0; id < slotCount; id += 1) {
    if (selectedSet.has(id)
      || battlefield.type?.[id] !== Number(type)
      || !renderable(battlefield, id)) continue;
    const dx = finite(battlefield.x?.[id], OFFSCREEN) - cameraX;
    const dz = finite(battlefield.z?.[id], OFFSCREEN) - cameraZ;
    candidates.push({id, distanceSquared: dx * dx + dz * dz});
  }
  candidates.sort((a, b) => a.distanceSquared - b.distanceSquared || a.id - b.id);
  selected.push(...candidates.slice(0, count - selected.length).map(({id}) => id));
  return Int32Array.from(selected);
}

export function animatedEnemyClipRole(battlefield, id, simulationTime = battlefield?.elapsed) {
  const time = finite(simulationTime, finite(battlefield?.elapsed));
  if (battlefield.status?.[id] === (battlefield.DYING ?? DYING)) return 'death';
  if (time - finite(battlefield.lastHitTime?.[id], -1000) <= 0.24) return 'hit';
  const role = battlefield.engagementRole?.[id];
  const attacks = role === ENGAGEMENT_GATE_ATTACK
    || role === ENGAGEMENT_PLAYER_ATTACK
    || role === ENGAGEMENT_HUNTER;
  if (attacks && time - finite(battlefield.lastAttackTime?.[id], -1000) <= 0.72) return 'attack';
  return 'run';
}

function clipKey(name) {
  const normalized = String(name || '').toLowerCase();
  return ['run', 'attack', 'hit', 'death'].find(key => normalized === key || normalized.endsWith(`|${key}`)
    || normalized.includes(`-${key}`)) || null;
}

/** Pause only the currently selected clips, preserving their exact frame. */
export function setAnimatedEnemyClipsPaused(slots, paused) {
  let changed = 0;
  for (const slot of slots ?? []) {
    if (!slot?.role) continue;
    const clip = slot.clips?.[slot.role];
    if (!clip) continue;
    if (paused) clip.pause?.();
    else clip.play?.();
    changed += 1;
  }
  return changed;
}

function cloneTemplate(template, name) {
  const bySource = new Map();
  const root = template.root.instantiateHierarchy(
    null,
    ANIMATED_ENEMY_CLONE_OPTIONS,
    (source, clone) => bySource.set(source, clone),
  );
  if (!root) throw new Error(`${template.key} hierarchy could not be instantiated`);
  bySource.set(template.root, root);
  root.name = name;
  root.setEnabled?.(false);
  const skeleton = template.skeleton.clone(`${name}:skeleton`);
  for (let index = 0; index < skeleton.bones.length; index += 1) {
    const sourceNode = template.skeleton.bones[index]?.getTransformNode?.();
    const cloneNode = sourceNode ? bySource.get(sourceNode) : null;
    if (cloneNode) skeleton.bones[index].linkTransformNode(cloneNode);
  }
  for (const [source, clone] of bySource) {
    if (source?.skeleton === template.skeleton && 'skeleton' in clone) clone.skeleton = skeleton;
  }
  const clips = {};
  for (const [role, source] of Object.entries(template.clips)) {
    const clone = source.clone(`${name}:${role}`, target => bySource.get(target) ?? null);
    clone.enableBlending = true;
    clone.blendingSpeed = 0.1;
    clone.stop?.();
    clips[role] = clone;
  }
  return {root, skeleton, clips, id: -1, role: null, visible: false};
}

/**
 * Meshy exports the skinned render mesh below a transform-node rig.  Cloning
 * the first imported mesh alone leaves the cloned skeleton disconnected from
 * the animated bone nodes, which renders the authored neutral pose forever.
 * Keep the complete rig hierarchy as the instance root so animation-group
 * target remapping and skeleton links cover the same nodes as the source.
 */
export function animatedEnemyRootNode(imported) {
  const meshes = imported?.meshes ?? [];
  const skinnedMesh = meshes.find(mesh => mesh?.skeleton) ?? meshes[0] ?? null;
  let root = skinnedMesh?.parent ?? null;
  while (root?.parent) root = root.parent;
  if (root?.instantiateHierarchy) return root;
  const transformRoot = (imported?.transformNodes ?? [])
    .find(node => !node?.parent && node?.getChildMeshes?.().some(mesh => meshes.includes(mesh)));
  return transformRoot?.instantiateHierarchy ? transformRoot : skinnedMesh;
}

function playSlot(slot, role, paused = false) {
  const resolved = slot.clips[role] ? role : 'run';
  if (slot.role === resolved) return;
  if (slot.role) slot.clips[slot.role]?.stop?.();
  slot.role = resolved;
  const clip = slot.clips[resolved];
  if (!clip) return;
  const loop = resolved === 'run';
  clip.start?.(loop, 1, clip.from, clip.to, false);
  if (paused) clip.pause?.();
}

async function loadTemplate({BABYLON, scene, definition}) {
  const {rootUrl, fileName} = splitAssetPath(definition.asset);
  const imported = await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene);
  const root = animatedEnemyRootNode(imported);
  if (!root?.instantiateHierarchy) throw new Error(`${definition.key} has no cloneable root`);
  const skeleton = imported.skeletons?.[0];
  if (!skeleton?.clone) throw new Error(`${definition.key} has no cloneable skeleton`);
  const clips = {};
  for (const group of imported.animationGroups ?? []) {
    group.stop?.();
    const role = clipKey(group.name);
    if (role && !clips[role]) clips[role] = group;
  }
  for (const required of ['run', 'attack', 'hit', 'death']) {
    if (!clips[required]) throw new Error(`${definition.key} is missing ${required}`);
  }
  let triangles = 0;
  for (const mesh of imported.meshes ?? []) {
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    triangles += Math.floor(finite(mesh.getTotalIndices?.()) / 3);
    const material = mesh.material;
    if (material) {
      applyAnimatedEnemySurface(material, definition.key);
    }
  }
  root.setEnabled?.(false);
  return {key: definition.key, definition, imported, root, skeleton, clips, triangles};
}

export async function createAnimatedEnemyRenderer({
  BABYLON,
  scene,
  camera,
  battlefield,
  limit = 24,
  suppressedIds = new Set(),
  models = ANIMATED_ENEMY_MODELS,
  dynamicTypes = false,
} = {}) {
  if (!BABYLON?.SceneLoader?.ImportMeshAsync || !scene || !battlefield) {
    throw new TypeError('Animated enemies require Babylon SceneLoader, a scene, and a battlefield');
  }
  const typeLimits = animatedEnemyTypeLimits(limit, models);
  const activeTypes = new Set(dynamicTypes ? Object.keys(models).map(Number) : Array.from(
    battlefield.type.slice(0, Math.min(battlefield.slotCount, battlefield.capacity)),
  ));
  const records = [];
  const errors = [];
  for (const [type, definition] of Object.entries(models)) {
    const poolSize = typeLimits[type] || 0;
    if (!poolSize || !activeTypes.has(Number(type))) continue;
    try {
      const template = await loadTemplate({BABYLON, scene, definition});
      const slots = Array.from({length: poolSize}, (_, index) => (
        cloneTemplate(template, `enemy-3d:${definition.key}:${index}`)
      ));
      records.push({type: Number(type), template, slots, selected: Int32Array.from([])});
    } catch (error) {
      errors.push(`${definition.key}: ${error?.message || error}`);
    }
  }
  if (!records.length) throw new Error(errors.join('; ') || 'No animated enemy models were available');

  const capacity = records.reduce((sum, record) => sum + record.slots.length, 0);
  const diagnostics = {
    mode: 'animated-3d-nearby',
    capacity,
    activeBodies: 0,
    trianglesPerFrame: 0,
    sourceTriangles: Object.fromEntries(records.map(record => [record.template.key, record.template.triangles])),
    loadedModels: records.length,
    skeletons: records.reduce((sum, record) => sum + record.slots.length, 0),
    lastUpdateMs: 0,
    loadErrors: errors,
  };
  let nextSelectionAt = Number.NEGATIVE_INFINITY;
  let paused = false;
  const priorTypes = dynamicTypes ? new Uint8Array(battlefield.capacity).fill(255) : null;
  const priorPresentationIds = dynamicTypes ? new Array(battlefield.capacity).fill(null) : null;

  function refreshSelection(time) {
    if (time < nextSelectionAt) return;
    nextSelectionAt = time + SELECTION_INTERVAL_SECONDS;
    suppressedIds.clear();
    const cameraPosition = camera.globalPosition || camera.position;
    for (const record of records) {
      record.selected = nearestAnimatedEnemyIds({
        battlefield,
        type: record.type,
        limit: record.slots.length,
        cameraPosition,
        retainedIds: record.selected,
      });
      for (const id of record.selected) suppressedIds.add(id);
    }
  }

  return {
    mode: 'animated-3d-nearby',
    diagnostics,
    update(time) {
      const started = performance.now();
      if (priorTypes) {
        for (let id = 0; id < battlefield.slotCount; id += 1) {
          if (priorTypes[id] !== battlefield.type[id]
            || priorPresentationIds[id] !== battlefield.presentationIds?.[id]) nextSelectionAt = Number.NEGATIVE_INFINITY;
          priorTypes[id] = battlefield.type[id];
          priorPresentationIds[id] = battlefield.presentationIds?.[id];
        }
      }
      refreshSelection(time);
      let activeBodies = 0;
      let trianglesPerFrame = 0;
      for (const record of records) {
        for (let index = 0; index < record.slots.length; index += 1) {
          const slot = record.slots[index];
          const id = record.selected[index] ?? -1;
          if (id < 0 || !renderable(battlefield, id)) {
            if (slot.visible) slot.root.setEnabled?.(false);
            slot.visible = false;
            slot.id = -1;
            continue;
          }
          const presentationId = dynamicTypes ? battlefield.presentationIds?.[id] : null;
          if (slot.id !== id || slot.presentationId !== presentationId) {
            if (slot.role) slot.clips[slot.role]?.stop?.();
            slot.role = null;
            slot.id = id;
            slot.presentationId = presentationId;
          }
          const x = finite(battlefield.x?.[id], OFFSCREEN);
          const z = finite(battlefield.z?.[id], OFFSCREEN);
          const y = animatedEnemyFlightY(record.type, z, battlefield.world?.gateZ);
          slot.root.position?.copyFromFloats?.(x, y, z);
          if (slot.root.position && !slot.root.position.copyFromFloats) {
            Object.assign(slot.root.position, {x, y, z});
          }
          const vx = finite(battlefield.desiredVx?.[id], battlefield.vx?.[id]);
          const vz = finite(battlefield.desiredVz?.[id], battlefield.vz?.[id]);
          if (slot.root.rotationQuaternion) slot.root.rotationQuaternion = null;
          if (slot.root.rotation && Math.hypot(vx, vz) >= 0.02) {
            slot.root.rotation.y = animatedEnemyYaw(vx, vz);
          }
          if (!slot.visible) slot.root.setEnabled?.(true);
          slot.visible = true;
          playSlot(slot, animatedEnemyClipRole(battlefield, id), paused);
          activeBodies += 1;
          trianglesPerFrame += record.template.triangles;
        }
      }
      diagnostics.activeBodies = activeBodies;
      diagnostics.trianglesPerFrame = trianglesPerFrame;
      diagnostics.lastUpdateMs = performance.now() - started;
    },
    setPaused(nextPaused) {
      const next = Boolean(nextPaused);
      if (next === paused) return 0;
      paused = next;
      return setAnimatedEnemyClipsPaused(
        records.flatMap(record => record.slots),
        paused,
      );
    },
    dispose() {
      suppressedIds.clear();
      for (const record of records) {
        for (const slot of record.slots) {
          for (const clip of Object.values(slot.clips)) clip.dispose?.();
          slot.skeleton.dispose?.();
          slot.root.dispose?.(false, false);
        }
        for (const group of record.template.imported.animationGroups ?? []) group.dispose?.();
        record.template.root.dispose?.(false, true);
        for (const skeleton of record.template.imported.skeletons ?? []) skeleton.dispose?.();
      }
    },
  };
}

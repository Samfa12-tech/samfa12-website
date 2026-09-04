/**
 * Optional authored boss presentation assets.
 *
 * This module is deliberately presentation-only.  The director owns actor
 * identity, position, phase, animationState, damage, and defeat.  A GLB can
 * improve the visual representation of that state, but it can never create or
 * mutate authority.  Runtime files are intentionally future-facing: the
 * manifest is safe to ship before the processed Meshy assets are present.
 */

const RUNTIME_ROOT = "assets/meshy/runtime/";
const STABLE_CLIPS = Object.freeze(["idle", "walk", "run", "attack", "hit", "death", "flap", "glide", "breath", "fall"]);

const RAW_BOSS_ASSETS = {
  "moss-crowned-matron": {
    asset: `${RUNTIME_ROOT}boss-moss-crowned-matron.glb`,
    animationStateToClip: {idle: "idle", shield_rotate: "idle", hit: "hit", collapse: "death"},
  },
  "root-sapper-prime": {
    asset: `${RUNTIME_ROOT}boss-root-sapper-prime.glb`,
    animationStateToClip: {idle: "idle", attack: "attack", hit: "hit", collapse: "death"},
  },
  "ashwing-matriarch": {
    asset: `${RUNTIME_ROOT}boss-ashwing-matriarch.glb`,
    animationStateToClip: {
      idle: "idle", dive_windup: "attack", grounded: "idle", airborne: "run", hit: "hit", collapse: "death",
    },
  },
  "moonless-herald": {
    asset: `${RUNTIME_ROOT}boss-moonless-herald.glb`,
    yawOffset: Math.PI / 2,
    animationStateToClip: {idle: "idle", attack: "attack", hit: "hit", collapse: "death"},
  },
  "caravan-eater": {
    asset: `${RUNTIME_ROOT}boss-caravan-eater.glb`,
    animationStateToClip: {idle: "idle", attack: "attack", hit: "hit", collapse: "death"},
  },
  "hollow-hart": {
    asset: `${RUNTIME_ROOT}boss-hollow-hart.glb`,
    animationStateToClip: {idle: "idle", attack: "attack", hit: "hit", collapse: "death"},
  },
  cinderwing: {
    asset: `${RUNTIME_ROOT}boss-cinderwing.glb`,
    animationStateToClip: {flap: "flap", glide: "glide", breath: "breath", hit: "hit", fall: "fall"},
  },
};

function freezeDefinition(definition) {
  const stateToClip = Object.freeze({...definition.animationStateToClip});
  const clipAliases = Object.freeze(Object.fromEntries(STABLE_CLIPS.map(clip => [clip, Object.freeze([
    clip,
    clip === "death" ? "collapse" : clip,
    clip === "hit" ? "hurt" : clip,
    clip === "idle" ? "neutral" : clip,
  ].filter((value, index, values) => values.indexOf(value) === index))])));
  return Object.freeze({
    id: definition.id,
    asset: definition.asset,
    yawOffset: Number(definition.yawOffset) || 0,
    animationStateToClip: stateToClip,
    clipAliases,
  });
}

export const BOSS_RUNTIME_ASSET_IDS = Object.freeze(Object.keys(RAW_BOSS_ASSETS));

export const BOSS_RUNTIME_ASSETS = Object.freeze(Object.fromEntries(
  Object.entries(RAW_BOSS_ASSETS).map(([id, definition]) => [id, freezeDefinition({id, ...definition})]),
));

export function bossRuntimeAssetDefinition(id, manifest = BOSS_RUNTIME_ASSETS) {
  return manifest?.[id] ?? null;
}

export function splitBossAssetPath(asset) {
  const normalized = String(asset ?? "").replaceAll("\\", "/");
  const slash = normalized.lastIndexOf("/");
  return {
    rootUrl: slash >= 0 ? normalized.slice(0, slash + 1) : "",
    fileName: slash >= 0 ? normalized.slice(slash + 1) : normalized,
  };
}

export function bossAnimationClipName(id, animationState, manifest = BOSS_RUNTIME_ASSETS) {
  const definition = bossRuntimeAssetDefinition(id, manifest);
  if (!definition) return null;
  return definition.animationStateToClip[animationState]
    ?? definition.animationStateToClip.idle
    ?? definition.animationStateToClip.flap
    ?? null;
}

function normaliseClipName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replace(/[^a-z0-9|.-]+/gu, "-");
}

function clipMatches(groupName, alias) {
  const name = normaliseClipName(groupName);
  const candidate = normaliseClipName(alias);
  return name === candidate
    || name.endsWith(`|${candidate}`)
    || name.endsWith(`-${candidate}`)
    || name.includes(`-${candidate}-`);
}

function importedRoot({BABYLON, scene, imported, id}) {
  const root = BABYLON?.TransformNode && scene
    ? new BABYLON.TransformNode(`boss-asset:${id}`, scene)
    : null;
  if (!root) return null;
  for (const node of [...(imported?.transformNodes ?? []), ...(imported?.meshes ?? [])]) {
    if (!node?.parent) node.parent = root;
  }
  root.setEnabled?.(false);
  return root;
}

function disposeImported(imported, root) {
  for (const group of imported?.animationGroups ?? []) {
    group.stop?.();
    group.dispose?.();
  }
  root?.dispose?.(false, true);
  for (const mesh of imported?.meshes ?? []) mesh?.dispose?.(false, true);
  for (const node of imported?.transformNodes ?? []) node?.dispose?.(false, true);
  for (const skeleton of imported?.skeletons ?? []) skeleton?.dispose?.();
}

function mapStableClips(definition, animationGroups) {
  const clips = new Map();
  for (const stable of STABLE_CLIPS) {
    const aliases = definition.clipAliases?.[stable] ?? [stable];
    const group = (animationGroups ?? []).find(candidate => aliases.some(alias => clipMatches(candidate?.name, alias)));
    if (group) clips.set(stable, group);
  }
  return clips;
}

function vectorRecord(vector) {
  return vector && [vector.x, vector.y, vector.z].every(Number.isFinite)
    ? Object.freeze({x: vector.x, y: vector.y, z: vector.z})
    : null;
}

function assetGeometryDiagnostics(record) {
  const meshes = record.imported?.meshes ?? [];
  let bounds = null;
  try {
    const measured = record.root?.getHierarchyBoundingVectors?.(true);
    if (measured?.min && measured?.max) bounds = Object.freeze({
      min: vectorRecord(measured.min),
      max: vectorRecord(measured.max),
      span: vectorRecord(measured.max.subtract?.(measured.min)),
    });
  } catch { /* diagnostics must not affect presentation */ }
  return Object.freeze({
    enabled: record.root?.isEnabled?.() === true,
    rootParent: record.root?.parent?.name ?? null,
    bounds,
    meshes: Object.freeze(meshes.map(mesh => Object.freeze({
      name: mesh?.name ?? null,
      enabled: mesh?.isEnabled?.() === true,
      visible: mesh?.isVisible !== false && Number(mesh?.visibility ?? 1) > 0,
      parent: mesh?.parent?.name ?? null,
      absolutePosition: vectorRecord(mesh?.absolutePosition),
    }))),
  });
}

function tuneImportedMaterial(mesh) {
  const material = mesh?.material;
  if (!material) return;
  material.backFaceCulling = false;
  if ("metallic" in material) material.metallic = Math.min(Number(material.metallic) || 0, 0.12);
  if ("roughness" in material) material.roughness = Math.max(Number(material.roughness) || 0, 0.68);
  if ("environmentIntensity" in material) material.environmentIntensity = Math.max(Number(material.environmentIntensity) || 0, 0.9);
}

/**
 * Optional, failure-contained Babylon loader for one presentation asset per
 * boss actor.  It does no loading unless `enabled: true` is supplied.
 */
export function createBossRuntimeAssetAdapter({
  BABYLON,
  scene,
  manifest = BOSS_RUNTIME_ASSETS,
  enabled = false,
} = {}) {
  const records = new Map();
  const pending = new Map();
  const errors = new Map();
  const canLoad = enabled === true && Boolean(BABYLON?.SceneLoader?.ImportMeshAsync && scene && BABYLON?.TransformNode);

  const statusFor = id => records.has(id) ? "ready" : errors.has(id) ? "fallback" : canLoad ? "idle" : "offline";

  async function load(id) {
    const definition = bossRuntimeAssetDefinition(id, manifest);
    if (!definition) return null;
    if (records.has(id)) return records.get(id);
    if (pending.has(id)) return pending.get(id);
    if (!canLoad) return null;
    const promise = (async () => {
      let imported = null;
      let root = null;
      try {
        const {rootUrl, fileName} = splitBossAssetPath(definition.asset);
        imported = await BABYLON.SceneLoader.ImportMeshAsync("", rootUrl, fileName, scene);
        if (!Array.isArray(imported?.meshes) || imported.meshes.length === 0) {
          throw new Error("asset has no renderable meshes");
        }
        root = importedRoot({BABYLON, scene, imported, id});
        if (!root) throw new Error("asset has no cloneable presentation root");
        root.rotation.y = definition.yawOffset;
        for (const mesh of imported.meshes) {
          mesh.isPickable = false;
          mesh.receiveShadows = true;
          // Skinned boss vertices move outside their imported bind-pose box;
          // keep the small fixed roster active so Babylon cannot cull a live
          // rig while its logical actor and presentation root remain onscreen.
          mesh.alwaysSelectAsActiveMesh = true;
          tuneImportedMaterial(mesh);
        }
        // ImportMeshAsync resolves once the hierarchy exists, before all GLB
        // textures and material effects are necessarily ready to draw.
        await scene.whenReadyAsync?.();
        for (const group of imported.animationGroups ?? []) group.stop?.();
        let groundOffset = 0;
        try {
          const importedBounds = root.getHierarchyBoundingVectors?.(true);
          if (Number.isFinite(importedBounds?.min?.y)) groundOffset = -importedBounds.min.y;
        } catch { /* retain centred fallback */ }
        const record = {
          id,
          asset: definition.asset,
          root,
          groundOffset,
          imported,
          clips: mapStableClips(definition, imported.animationGroups),
          activeClip: null,
          play(animationState) {
            const stable = bossAnimationClipName(id, animationState, manifest);
            const group = stable ? this.clips.get(stable) : null;
            if (!group) return false;
            if (this.activeClip === stable) return true;
            if (this.activeClip) this.clips.get(this.activeClip)?.stop?.();
            this.activeClip = stable;
            group.start?.(["idle", "walk", "run", "flap", "glide"].includes(stable), 1, group.from, group.to, false);
            return true;
          },
          dispose() {
            disposeImported(imported, root);
          },
        };
        root.setEnabled?.(false);
        records.set(id, record);
        return record;
      } catch (error) {
        errors.set(id, String(error?.message ?? error));
        disposeImported(imported, root);
        return null;
      } finally {
        pending.delete(id);
      }
    })();
    pending.set(id, promise);
    return promise;
  }

  return {
    enabled: canLoad,
    manifest,
    load,
    status(id) { return statusFor(id); },
    diagnostics() {
      return Object.freeze({
        enabled: canLoad,
        statuses: Object.freeze(Object.fromEntries(BOSS_RUNTIME_ASSET_IDS.map(id => [id, statusFor(id)]))),
        loaded: records.size,
        activeClips: Object.freeze(Object.fromEntries([...records].map(([id, record]) => {
          const group = record.activeClip ? record.clips.get(record.activeClip) : null;
          return [id, Object.freeze({clip: record.activeClip, playing: group?.isPlaying === true})];
        }))),
        geometry: Object.freeze(Object.fromEntries([...records].map(([id, record]) => [id, assetGeometryDiagnostics(record)]))),
        errors: Object.freeze(Object.fromEntries(errors)),
      });
    },
    dispose() {
      for (const record of records.values()) record.dispose();
      records.clear();
      errors.clear();
    },
  };
}

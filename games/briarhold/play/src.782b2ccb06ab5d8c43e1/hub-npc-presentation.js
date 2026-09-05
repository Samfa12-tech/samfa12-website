import {NARRATIVE_SHOT_IDS} from './narrative-content.js';

export const HUB_NPC_SERVICE_ICON = Object.freeze({
  minDistance: 1.5,
  maxDistance: 28,
  height: 2.42,
  size: 0.42,
});

export const HUB_NPC_LIGHTING = Object.freeze({
  directIntensity: 1.15,
  environmentIntensity: 0.8,
  emissiveIntensity: 0.22,
  maxSimultaneousLights: 4,
});

export const HUB_NPC_LOOK = Object.freeze({
  headHeight: 1.58,
  fullWeightDistance: 3.5,
  maxDistance: 6,
  maxViewYaw: 60 * Math.PI / 180,
  maxYaw: 35 * Math.PI / 180,
  maxPitch: 15 * Math.PI / 180,
  smoothing: 7.5,
  neckShare: 0.38,
});

export const HUB_NPC_ATTACK_SECONDS = 0.34;

export const HUB_NPC_MODELS = Object.freeze({
  bellkeeper: Object.freeze({
    asset: 'assets/meshy/runtime/hub-npc-bellkeeper-512.glb',
    clip: 'NPC|bellkeeper|idle',
    silhouette: 'bell-cowl',
  }),
  mason: Object.freeze({
    asset: 'assets/meshy/runtime/hub-npc-mason-512.glb',
    clip: 'NPC|mason|idle',
    silhouette: 'mason-apron',
  }),
  quartermaster: Object.freeze({
    asset: 'assets/meshy/runtime/hub-npc-quartermaster-512.glb',
    clip: 'NPC|quartermaster|idle',
    silhouette: 'stores-coat',
  }),
  trapper: Object.freeze({
    asset: 'assets/meshy/runtime/hub-npc-trapper-512.glb',
    clip: 'NPC|trapper|idle',
    silhouette: 'hunter-cowl',
  }),
  greenwarden: Object.freeze({
    asset: 'assets/meshy/runtime/hub-npc-greenwarden-512.glb',
    clip: 'NPC|greenwarden|idle',
    silhouette: 'branch-crown',
  }),
});

const HUB_NPC_TABLEAU_SHARES = Object.freeze({
  'first-person': Object.freeze({lookWeight: 0, poseWeight: 0}),
  'bell-wide': Object.freeze({lookWeight: 0.72, poseWeight: 0.18}),
  'speaker-close': Object.freeze({lookWeight: 1, poseWeight: 0.12}),
  'speaker-medium': Object.freeze({lookWeight: 0.9, poseWeight: 0.1}),
  'two-shot': Object.freeze({lookWeight: 0.76, poseWeight: 0.08}),
  'gate-overlook': Object.freeze({lookWeight: 0.42, poseWeight: 0.06}),
  'courtyard-wide': Object.freeze({lookWeight: 0.5, poseWeight: 0.08}),
  'stores-medium': Object.freeze({lookWeight: 0.84, poseWeight: 0.12}),
  'workbench-medium': Object.freeze({lookWeight: 0.84, poseWeight: 0.12}),
  'grove-medium': Object.freeze({lookWeight: 0.84, poseWeight: 0.12}),
  'fortress-wide': Object.freeze({lookWeight: 0.34, poseWeight: 0.05}),
});

const HUB_NPC_TABLEAU_POSES = Object.freeze(Object.fromEntries(Object.keys(HUB_NPC_MODELS).map(npcId => [
  npcId,
  Object.freeze(Object.fromEntries(NARRATIVE_SHOT_IDS.map(shotId => {
    const share = HUB_NPC_TABLEAU_SHARES[shotId] ?? HUB_NPC_TABLEAU_SHARES['first-person'];
    return [shotId, Object.freeze({shotId, npcId, ...share, fallback: false})];
  }))),
])));
const HUB_NPC_NEUTRAL_POSES = Object.freeze(Object.fromEntries(Object.keys(HUB_NPC_MODELS).map(npcId => [
  npcId,
  Object.freeze({shotId: 'first-person', npcId, lookWeight: 0, poseWeight: 0, fallback: true}),
])));

/** Presentation-only pose shares layered over the existing live idle/look rig. */
export function hubNpcTableauPose({shotId = 'first-person', npcId = 'bellkeeper'} = {}) {
  const poses = HUB_NPC_TABLEAU_POSES[npcId];
  return poses?.[shotId] ?? HUB_NPC_NEUTRAL_POSES[npcId] ?? Object.freeze({
    shotId: 'first-person', npcId: null, lookWeight: 0, poseWeight: 0, fallback: true,
  });
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function wrappedAngle(value) {
  let angle = finite(value);
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function nodeQuaternion(BABYLON, node) {
  return node.rotationQuaternion?.clone?.()
    ?? BABYLON.Quaternion.FromEulerAngles(
      finite(node.rotation?.x), finite(node.rotation?.y), finite(node.rotation?.z),
    );
}

export function createHubNpcLookNodeBinding(BABYLON, node, {animated = false} = {}) {
  if (!node) return null;
  return Object.freeze({
    node,
    animated: animated === true,
    restingQuaternion: nodeQuaternion(BABYLON, node),
  });
}

/** Apply one bounded look offset without compounding it on an unanimated node. */
export function applyHubNpcLookNode(BABYLON, binding, look, share = 1) {
  if (!binding?.node) return false;
  const base = binding.animated
    ? nodeQuaternion(BABYLON, binding.node)
    : binding.restingQuaternion.clone();
  const weight = clamp(finite(look?.weight), 0, 1);
  const portion = clamp(finite(share, 1), 0, 1);
  const additive = BABYLON.Quaternion.FromEulerAngles(
    finite(look?.pitch) * weight * portion,
    finite(look?.yaw) * weight * portion,
    0,
  );
  binding.node.rotationQuaternion = base.multiply(additive);
  return true;
}

function applyHubNpcPoseNode(BABYLON, binding, {pitch = 0, yaw = 0, roll = 0} = {}) {
  if (!binding?.node) return false;
  const base = binding.animated
    ? nodeQuaternion(BABYLON, binding.node)
    : binding.restingQuaternion.clone();
  binding.node.rotationQuaternion = base.multiply(BABYLON.Quaternion.FromEulerAngles(
    finite(pitch),
    finite(yaw),
    finite(roll),
  ));
  return true;
}

/** A readable upper-body firing pose layered over each NPC's authored idle. */
export function hubNpcCombatPose(actionTime = 0, {reducedMotion = false} = {}) {
  const remaining = clamp(finite(actionTime), 0, HUB_NPC_ATTACK_SECONDS);
  if (remaining <= 0) return Object.freeze({
    weight: 0,
    spinePitch: 0,
    rightArmPitch: 0,
    rightArmRoll: 0,
    leftArmPitch: 0,
    leftArmRoll: 0,
  });
  const phase = remaining / HUB_NPC_ATTACK_SECONDS;
  const weight = Math.sin(phase * Math.PI);
  const recoil = Math.exp(-Math.pow((phase - 0.62) / 0.16, 2));
  const motionScale = reducedMotion ? 0.55 : 1;
  return Object.freeze({
    weight,
    spinePitch: (-0.15 * weight + 0.05 * recoil) * motionScale,
    rightArmPitch: (-0.72 * weight + 0.22 * recoil) * motionScale,
    rightArmRoll: -0.16 * weight * motionScale,
    leftArmPitch: (-0.48 * weight + 0.08 * recoil) * motionScale,
    leftArmRoll: 0.22 * weight * motionScale,
  });
}

export function resolveHubNpcLookTarget({
  station,
  playerPosition,
  occluded = false,
  reducedMotion = false,
} = {}) {
  const neutral = Object.freeze({engaged: false, yaw: 0, pitch: 0, weight: 0});
  if (!station?.position || !playerPosition || occluded || reducedMotion) return neutral;
  const dx = finite(playerPosition.x) - finite(station.position.x);
  const dz = finite(playerPosition.z) - finite(station.position.z);
  const horizontalDistance = Math.hypot(dx, dz);
  if (horizontalDistance < 0.35 || horizontalDistance > HUB_NPC_LOOK.maxDistance) return neutral;
  const yaw = wrappedAngle(Math.atan2(dx, dz) - finite(station.facing));
  if (Math.abs(yaw) > HUB_NPC_LOOK.maxViewYaw) return neutral;
  const eyeDelta = finite(playerPosition.y) - (finite(station.position.y) + HUB_NPC_LOOK.headHeight);
  const pitch = Math.atan2(eyeDelta, horizontalDistance);
  const rangeWeight = horizontalDistance <= HUB_NPC_LOOK.fullWeightDistance
    ? 1
    : 1 - (horizontalDistance - HUB_NPC_LOOK.fullWeightDistance)
      / (HUB_NPC_LOOK.maxDistance - HUB_NPC_LOOK.fullWeightDistance);
  const viewWeight = 1 - Math.max(0, Math.abs(yaw) - HUB_NPC_LOOK.maxYaw)
    / (HUB_NPC_LOOK.maxViewYaw - HUB_NPC_LOOK.maxYaw);
  return Object.freeze({
    engaged: true,
    yaw: clamp(yaw, -HUB_NPC_LOOK.maxYaw, HUB_NPC_LOOK.maxYaw),
    pitch: clamp(pitch, -HUB_NPC_LOOK.maxPitch, HUB_NPC_LOOK.maxPitch),
    weight: clamp(rangeWeight * viewWeight, 0, 1),
  });
}

export function stepHubNpcLook(current, target, deltaSeconds = 0) {
  const dt = clamp(finite(deltaSeconds), 0, 0.1);
  const alpha = 1 - Math.exp(-HUB_NPC_LOOK.smoothing * dt);
  const nextTarget = target?.engaged ? target : {yaw: 0, pitch: 0, weight: 0};
  return Object.freeze({
    yaw: finite(current?.yaw) + (finite(nextTarget.yaw) - finite(current?.yaw)) * alpha,
    pitch: finite(current?.pitch) + (finite(nextTarget.pitch) - finite(current?.pitch)) * alpha,
    weight: clamp(
      finite(current?.weight) + (finite(nextTarget.weight) - finite(current?.weight)) * alpha,
      0,
      1,
    ),
  });
}

export function hubNpcServiceIconVisible({show = false, active = false, distance = Infinity} = {}) {
  const range = finite(distance, Infinity);
  return show === true
    && active === true
    && range >= HUB_NPC_SERVICE_ICON.minDistance
    && range <= HUB_NPC_SERVICE_ICON.maxDistance;
}

/** Resolve the pure presentation policy for one surviving hub NPC. */
export function hubNpcVisibilityForPhase({phase = 'menu', active = false} = {}) {
  const surviving = active === true;
  const buildBreak = phase === 'build_break' || phase === 'daytime';
  const combat = phase === 'combat';
  return Object.freeze({
    visible: surviving && (buildBreak || combat),
    serviceIconsVisible: surviving && buildBreak,
  });
}

export function hubNpcAssetPath(npcId, {mobileTextures = false} = {}) {
  const definition = HUB_NPC_MODELS[npcId];
  if (!definition) throw new TypeError(`Unknown hub NPC ${npcId}`);
  const asset = mobileTextures
    ? definition.asset.replace(/-512\.glb$/u, '-256.glb')
    : definition.asset;
  const slash = asset.lastIndexOf('/');
  return Object.freeze({
    rootUrl: asset.slice(0, slash + 1),
    fileName: asset.slice(slash + 1),
  });
}

export function hubNpcStateForStation(station) {
  if (!station?.npcId || !station.position) throw new TypeError('Hub NPC station requires npcId and position');
  if (!HUB_NPC_MODELS[station.npcId]) throw new TypeError(`Unknown hub NPC ${station.npcId}`);
  return Object.freeze({
    npcId: station.npcId,
    position: Object.freeze({
      x: finite(station.position.x),
      y: finite(station.position.y),
      z: finite(station.position.z),
    }),
    facing: finite(station.facing),
  });
}

function createServiceIconMaterial(BABYLON, scene) {
  const texture = new BABYLON.DynamicTexture(
    'hub-npc-service-icon-texture',
    {width: 128, height: 128},
    scene,
    false,
  );
  const context = texture.getContext();
  context.clearRect(0, 0, 128, 128);
  context.beginPath();
  context.moveTo(64, 5);
  context.lineTo(123, 64);
  context.lineTo(64, 123);
  context.lineTo(5, 64);
  context.closePath();
  context.fillStyle = '#f2c86b';
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = '#2b2118';
  context.stroke();
  context.fillStyle = '#2b2118';
  context.font = 'bold 82px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('!', 64, 65);
  texture.hasAlpha = true;
  texture.update(false);

  const material = new BABYLON.StandardMaterial('hub-npc-service-icon-material', scene);
  material.diffuseColor = BABYLON.Color3.Black();
  material.emissiveColor = BABYLON.Color3.Black();
  material.emissiveTexture = texture;
  material.opacityTexture = texture;
  material.disableLighting = true;
  material.disableDepthWrite = true;
  material.backFaceCulling = false;
  return {material, texture};
}

function createServiceIcon(BABYLON, scene, material, npcId, position) {
  const icon = BABYLON.MeshBuilder.CreatePlane(
    `hub-npc-service-icon:${npcId}`,
    {
      width: HUB_NPC_SERVICE_ICON.size,
      height: HUB_NPC_SERVICE_ICON.size,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE,
    },
    scene,
  );
  icon.position?.copyFromFloats?.(
    finite(position?.x),
    finite(position?.y) + HUB_NPC_SERVICE_ICON.height,
    finite(position?.z),
  );
  if (icon.position && !icon.position.copyFromFloats) {
    icon.position.x = finite(position?.x);
    icon.position.y = finite(position?.y) + HUB_NPC_SERVICE_ICON.height;
    icon.position.z = finite(position?.z);
  }
  icon.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  icon.material = material;
  icon.isPickable = false;
  icon.renderingGroupId = 2;
  icon.alphaIndex = 10;
  icon.setEnabled?.(false);
  return icon;
}

function stopAndDisposeImport(imported) {
  for (const group of imported?.animationGroups ?? []) {
    group.stop?.();
    group.dispose?.();
  }
  imported?.meshes?.[0]?.dispose?.(false, true);
  for (const skeleton of imported?.skeletons ?? []) skeleton.dispose?.();
}

async function loadHubNpcCharacter({BABYLON, scene, station, mobileTextures = false}) {
  const state = hubNpcStateForStation(station);
  const definition = HUB_NPC_MODELS[state.npcId];
  const {rootUrl, fileName} = hubNpcAssetPath(state.npcId, {mobileTextures});
  const imported = await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene);
  const sourceRoot = imported.meshes?.[0];
  const idle = (imported.animationGroups ?? []).find(group => group.name === definition.clip);
  if (!sourceRoot || !idle) {
    stopAndDisposeImport(imported);
    throw new Error(`${state.npcId} is missing its root or ${definition.clip} animation`);
  }

  const root = new BABYLON.TransformNode(`hub-npc:${state.npcId}`, scene);
  sourceRoot.parent = root;
  root.position?.copyFromFloats?.(state.position.x, state.position.y, state.position.z);
  if (root.position && !root.position.copyFromFloats) Object.assign(root.position, state.position);
  if (root.rotation) root.rotation.y = state.facing;
  for (const mesh of imported.meshes ?? []) {
    mesh.isPickable = false;
    mesh.receiveShadows = true;
  }
  const materials = new Set((imported.meshes ?? []).map(mesh => mesh.material).filter(Boolean));
  for (const material of materials) {
    material.directIntensity = HUB_NPC_LIGHTING.directIntensity;
    material.environmentIntensity = HUB_NPC_LIGHTING.environmentIntensity;
    material.emissiveIntensity = HUB_NPC_LIGHTING.emissiveIntensity;
    material.maxSimultaneousLights = HUB_NPC_LIGHTING.maxSimultaneousLights;
  }
  for (const group of imported.animationGroups ?? []) group.stop?.();
  root.setEnabled?.(false);
  const transformNodes = imported.transformNodes ?? [];
  const neck = transformNodes.find(node => String(node?.name).toLowerCase() === 'neck') ?? null;
  const head = transformNodes.find(node => String(node?.name).toLowerCase() === 'head') ?? null;
  const spine = transformNodes.find(node => String(node?.name).toLowerCase() === 'spine02') ?? null;
  const rightArm = transformNodes.find(node => String(node?.name).toLowerCase() === 'rightarm') ?? null;
  const leftArm = transformNodes.find(node => String(node?.name).toLowerCase() === 'leftarm') ?? null;
  const animatedTargets = new Set((imported.animationGroups ?? []).flatMap(group => (
    (group.targetedAnimations ?? []).map(animation => animation?.target).filter(Boolean)
  )));

  return {
    npcId: state.npcId,
    asset: `${rootUrl}${fileName}`,
    state,
    definition,
    imported,
    root,
    idle,
    active: false,
    actionTime: 0,
    hitTime: 0,
    combatPose: hubNpcCombatPose(0),
    look: Object.freeze({yaw: 0, pitch: 0, weight: 0}),
    lookTarget: Object.freeze({engaged: false, yaw: 0, pitch: 0, weight: 0}),
    lookNodes: Object.freeze({
      neck: createHubNpcLookNodeBinding(BABYLON, neck, {animated: animatedTargets.has(neck)}),
      head: createHubNpcLookNodeBinding(BABYLON, head, {animated: animatedTargets.has(head)}),
    }),
    combatNodes: Object.freeze({
      spine: createHubNpcLookNodeBinding(BABYLON, spine, {animated: animatedTargets.has(spine)}),
      rightArm: createHubNpcLookNodeBinding(BABYLON, rightArm, {animated: animatedTargets.has(rightArm)}),
      leftArm: createHubNpcLookNodeBinding(BABYLON, leftArm, {animated: animatedTargets.has(leftArm)}),
    }),
    dispose() {
      root.dispose?.(true);
      stopAndDisposeImport(imported);
    },
  };
}

/**
 * Hub and breach-defence presentation. Each active NPC owns one distinct
 * textured Meshy model and a native looping idle, with small procedural attack
 * and hit accents. Characters load sequentially to bound peak GPU memory.
 */
export async function createHubNpcPresentation({
  BABYLON,
  scene,
  stations = [],
  mobileTextures = false,
} = {}) {
  if (!BABYLON?.SceneLoader?.ImportMeshAsync || !BABYLON?.TransformNode || !scene) {
    throw new TypeError('Babylon SceneLoader, TransformNode, and a scene are required');
  }
  if (!Array.isArray(stations)) throw new TypeError('Hub stations must be an array');
  const npcStations = stations.filter(station => station?.npcId && station.position);
  const serviceIcon = npcStations.length ? createServiceIconMaterial(BABYLON, scene) : null;
  const entries = new Map();
  try {
    for (const station of npcStations) {
      const character = await loadHubNpcCharacter({BABYLON, scene, station, mobileTextures});
      const icon = createServiceIcon(
        BABYLON,
        scene,
        serviceIcon.material,
        character.npcId,
        character.state.position,
      );
      entries.set(character.npcId, {...character, icon});
    }
  } catch (error) {
    for (const entry of entries.values()) {
      entry.icon.dispose?.(false, false);
      entry.dispose();
    }
    serviceIcon?.material.dispose?.();
    serviceIcon?.texture.dispose?.();
    throw error;
  }

  let visible = false;
  let serviceIconsVisible = true;
  let activeNpcIds = new Set();
  const applyPresentationRotations = () => {
    for (const entry of entries.values()) {
      if (!entry.active) continue;
      const shares = [
        [entry.lookNodes.neck, HUB_NPC_LOOK.neckShare],
        [entry.lookNodes.head, 1 - HUB_NPC_LOOK.neckShare],
      ];
      for (const [binding, share] of shares) applyHubNpcLookNode(BABYLON, binding, entry.look, share);
      applyHubNpcPoseNode(BABYLON, entry.combatNodes.spine, {pitch: entry.combatPose.spinePitch});
      applyHubNpcPoseNode(BABYLON, entry.combatNodes.rightArm, {
        pitch: entry.combatPose.rightArmPitch,
        roll: entry.combatPose.rightArmRoll,
      });
      applyHubNpcPoseNode(BABYLON, entry.combatNodes.leftArm, {
        pitch: entry.combatPose.leftArmPitch,
        roll: entry.combatPose.leftArmRoll,
      });
    }
  };
  // Run after skeleton animation evaluation so animated look bones contribute
  // their fresh authored pose before the bounded procedural offset is applied.
  const lookObservable = scene.onAfterAnimationsObservable ?? scene.onBeforeRenderObservable;
  const lookObserver = lookObservable?.add?.(applyPresentationRotations) ?? null;
  const refresh = () => {
    const cameraPosition = scene.activeCamera?.globalPosition ?? scene.activeCamera?.position;
    for (const [npcId, entry] of entries) {
      const active = visible && activeNpcIds.has(npcId);
      if (active && !entry.active) entry.idle.start?.(true, 1, entry.idle.from, entry.idle.to, false);
      if (!active && entry.active) entry.idle.stop?.();
      entry.root.setEnabled?.(active);
      entry.active = active;
      const dx = finite(cameraPosition?.x) - entry.state.position.x;
      const dy = finite(cameraPosition?.y) - entry.state.position.y;
      const dz = finite(cameraPosition?.z) - entry.state.position.z;
      entry.icon.setEnabled?.(hubNpcServiceIconVisible({
        show: visible && serviceIconsVisible,
        active,
        distance: cameraPosition ? Math.hypot(dx, dy, dz) : Infinity,
      }));
    }
  };

  return Object.freeze({
    get count() { return entries.size; },
    get diagnostics() {
      return Object.freeze([...entries.values()].map(entry => Object.freeze({
        npcId: entry.npcId,
        asset: entry.asset,
        silhouette: entry.definition.silhouette,
        active: entry.active,
        animation: entry.definition.clip,
        animationPlaying: entry.idle.isPlaying === true,
        rotationY: finite(entry.root.rotation?.y),
        lookYaw: entry.look.yaw,
        lookPitch: entry.look.pitch,
        lookWeight: entry.look.weight,
        lookBones: Number(Boolean(entry.lookNodes.neck?.node)) + Number(Boolean(entry.lookNodes.head?.node)),
        combatBones: Object.values(entry.combatNodes).filter(binding => binding?.node).length,
        attackActive: entry.actionTime > 0,
      })));
    },
    sync({activeNpcs = [], show = true, showServiceIcons = true} = {}) {
      activeNpcIds = new Set(activeNpcs);
      visible = show === true;
      serviceIconsVisible = showServiceIcons === true;
      refresh();
      return Object.freeze({
        active: [...activeNpcIds].filter(npcId => entries.has(npcId)),
        visible,
      });
    },
    signalAttack(npcId, target) {
      const entry = entries.get(npcId);
      if (!entry?.active) return false;
      entry.actionTime = HUB_NPC_ATTACK_SECONDS;
      if (entry.root.rotation && target) {
        entry.root.rotation.y = Math.atan2(
          finite(target.x) - entry.state.position.x,
          finite(target.z) - entry.state.position.z,
        );
      }
      return true;
    },
    signalHit(npcId) {
      const entry = entries.get(npcId);
      if (!entry?.active) return false;
      entry.hitTime = .22;
      return true;
    },
    update(deltaSeconds = 0, {
      playerPosition = null,
      reducedMotion = false,
      isOccluded = () => false,
    } = {}) {
      const dt = Math.max(0, finite(deltaSeconds));
      for (const entry of entries.values()) {
        entry.actionTime = Math.max(0, entry.actionTime - dt);
        entry.hitTime = Math.max(0, entry.hitTime - dt);
        entry.combatPose = hubNpcCombatPose(entry.actionTime, {reducedMotion});
        const kick = entry.combatPose.weight * (reducedMotion ? 0.008 : 0.018);
        const flinch = entry.hitTime > 0 ? Math.sin((entry.hitTime / .22) * Math.PI * 2) * .025 : 0;
        if (entry.root.position) entry.root.position.y = entry.state.position.y + kick;
        if (entry.root.rotation) entry.root.rotation.x = flinch;
        const headOrigin = {
          x: entry.state.position.x,
          y: entry.state.position.y + HUB_NPC_LOOK.headHeight,
          z: entry.state.position.z,
        };
        const candidateLook = resolveHubNpcLookTarget({
          station: entry.state,
          playerPosition,
          reducedMotion,
        });
        const occluded = Boolean(
          entry.active
          && candidateLook.engaged
          && isOccluded(headOrigin, playerPosition),
        );
        entry.lookTarget = occluded || entry.actionTime > 0 || entry.hitTime > 0
          ? resolveHubNpcLookTarget({station: entry.state})
          : candidateLook;
        entry.look = stepHubNpcLook(entry.look, entry.lookTarget, dt);
      }
      refresh();
    },
    hide() {
      visible = false;
      refresh();
    },
    dispose() {
      if (lookObserver) lookObservable?.remove?.(lookObserver);
      for (const entry of entries.values()) {
        entry.icon.dispose?.(false, false);
        entry.dispose();
      }
      entries.clear();
      serviceIcon?.material.dispose?.();
      serviceIcon?.texture.dispose?.();
    },
  });
}

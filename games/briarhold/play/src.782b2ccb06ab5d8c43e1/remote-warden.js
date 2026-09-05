export const REMOTE_WARDEN_ASSET = 'assets/meshy/runtime/briarhold-warden-1k.glb';
export const REMOTE_WARDEN_INTERPOLATION_SECONDS = 0.1;
export const REMOTE_WARDEN_SNAPSHOT_LIMIT = 32;
export const REMOTE_WARDEN_LIGHTING = Object.freeze({
  directIntensity: 1.35,
  environmentIntensity: 1.1,
  emissiveIntensity: 1.05,
  maxSimultaneousLights: 5,
});

export const REMOTE_WARDEN_CLIPS = Object.freeze({
  idle: 'Warden|idle',
  walk: 'Warden|walk',
  run: 'Warden|run',
  jump: 'Warden|jump',
  fall: 'Warden|fall',
  slide: 'Warden|slide',
  mantle: 'Warden|mantle',
});

export const REMOTE_WARDEN_CLIP_LOOPS = Object.freeze({
  idle: true,
  walk: true,
  run: true,
  jump: false,
  fall: true,
  slide: true,
  mantle: false,
});

export const REMOTE_WARDEN_SOCKETS = Object.freeze([
  'socket_right_hand',
  'socket_off_hand',
  'socket_weapon',
  'socket_muzzle',
]);

// The processed GLB was authored facing -Z, while replicated Warden yaw uses
// +Z as forward. Keep that asset-space correction at the presentation edge so
// network movement and first-person aiming retain their existing convention.
export const REMOTE_WARDEN_MODEL_YAW_OFFSET = Math.PI;

const DIRECT_TEMPLATE_INSTANCES = new WeakSet();

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteTick(value, label) {
  const tick = Number(value);
  if (!Number.isFinite(tick) || tick < 0) throw new RangeError(`${label} must be a non-negative finite tick`);
  return tick;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, finite(value)));
}

function lerp(left, right, alpha) {
  return left + (right - left) * alpha;
}

function shortestAngleDelta(left, right) {
  let delta = (right - left) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function interpolationState(left, right, alpha, targetTick) {
  const blend = clamp01(alpha);
  const discrete = Number(right.animationStartedTick) <= targetTick ? right : left;
  return Object.freeze({
    ...discrete,
    position: Object.freeze({
      x: lerp(left.position.x, right.position.x, blend),
      y: lerp(left.position.y, right.position.y, blend),
      z: lerp(left.position.z, right.position.z, blend),
    }),
    velocity: Object.freeze({
      x: lerp(left.velocity.x, right.velocity.x, blend),
      y: lerp(left.velocity.y, right.velocity.y, blend),
      z: lerp(left.velocity.z, right.velocity.z, blend),
    }),
    facing: Object.freeze({
      yaw: left.facing.yaw + shortestAngleDelta(left.facing.yaw, right.facing.yaw) * blend,
      pitch: lerp(left.facing.pitch, right.facing.pitch, blend),
    }),
    hp: lerp(left.hp, right.hp, blend),
    heat: Object.freeze(left.heat.map((amount, index) => lerp(amount, right.heat[index], blend))),
  });
}

/**
 * Small render-only snapshot buffer. The server remains authoritative: this
 * buffer never predicts damage or locomotion and never writes to session state.
 */
export function createRemoteWardenInterpolationBuffer({
  tickRate = 30,
  interpolationSeconds = REMOTE_WARDEN_INTERPOLATION_SECONDS,
  maxSnapshots = REMOTE_WARDEN_SNAPSHOT_LIMIT,
} = {}) {
  const rate = finiteTick(tickRate, 'tickRate');
  if (rate <= 0) throw new RangeError('tickRate must be greater than zero');
  const delayTicks = finiteTick(interpolationSeconds, 'interpolationSeconds') * rate;
  if (!Number.isInteger(maxSnapshots) || maxSnapshots < 2 || maxSnapshots > 256) {
    throw new RangeError('maxSnapshots must be an integer from 2 to 256');
  }
  const snapshots = [];
  let playerId = null;

  return Object.freeze({
    get size() {
      return snapshots.length;
    },
    get delayTicks() {
      return delayTicks;
    },
    push(tick, state) {
      const normalizedTick = finiteTick(tick, 'snapshot.tick');
      if (!state?.playerId || !state.position || !state.velocity || !state.facing) {
        throw new TypeError('Remote Warden snapshot requires a NetworkPlayerState');
      }
      if (playerId === null) playerId = state.playerId;
      if (state.playerId !== playerId) throw new RangeError('Remote Warden buffer cannot mix player IDs');
      const previous = snapshots.at(-1);
      if (previous && normalizedTick <= previous.tick) {
        throw new RangeError('Remote Warden snapshot ticks must increase monotonically');
      }
      snapshots.push(Object.freeze({tick: normalizedTick, state}));
      if (snapshots.length > maxSnapshots) snapshots.splice(0, snapshots.length - maxSnapshots);
      return snapshots.length;
    },
    sample(estimatedServerTick) {
      if (!snapshots.length) return null;
      const targetTick = Math.max(0, finiteTick(estimatedServerTick, 'estimatedServerTick') - delayTicks);
      if (snapshots.length === 1 || targetTick <= snapshots[0].tick) {
        return Object.freeze({tick: targetTick, alpha: 0, state: snapshots[0].state});
      }
      const newest = snapshots.at(-1);
      if (targetTick >= newest.tick) {
        return Object.freeze({tick: targetTick, alpha: 1, state: newest.state});
      }
      let rightIndex = 1;
      while (rightIndex < snapshots.length && snapshots[rightIndex].tick < targetTick) rightIndex += 1;
      const left = snapshots[rightIndex - 1];
      const right = snapshots[rightIndex];
      const alpha = (targetTick - left.tick) / Math.max(1e-6, right.tick - left.tick);
      return Object.freeze({
        tick: targetTick,
        alpha,
        state: interpolationState(left.state, right.state, alpha, targetTick),
      });
    },
    clear() {
      snapshots.length = 0;
      playerId = null;
    },
  });
}

/** Selects the locomotion clip from replicated intent, never bone state. */
export function remoteWardenLocomotionClip({
  speed = 0,
  verticalSpeed = 0,
  sprint = false,
  grounded = true,
  traversal = null,
} = {}) {
  if (traversal === 'mantling') return REMOTE_WARDEN_CLIPS.mantle;
  if (traversal === 'sliding') return REMOTE_WARDEN_CLIPS.slide;
  if (grounded !== true || traversal === 'airborne') {
    return finite(verticalSpeed) < -0.1 ? REMOTE_WARDEN_CLIPS.fall : REMOTE_WARDEN_CLIPS.jump;
  }
  const planarSpeed = Math.max(0, finite(speed));
  if (planarSpeed < 0.15) return REMOTE_WARDEN_CLIPS.idle;
  if (sprint === true || planarSpeed >= 5.2) return REMOTE_WARDEN_CLIPS.run;
  return REMOTE_WARDEN_CLIPS.walk;
}

export function splitRemoteWardenAssetPath(asset = REMOTE_WARDEN_ASSET) {
  const normalized = String(asset || '').replaceAll('\\', '/');
  const slash = normalized.lastIndexOf('/');
  if (slash < 0 || !normalized.toLowerCase().endsWith('.glb')) {
    throw new TypeError('Remote Warden asset must be a GLB path');
  }
  return {rootUrl: normalized.slice(0, slash + 1), fileName: normalized.slice(slash + 1)};
}

/**
 * Lazily loads one verified Warden template for future remote-player instances.
 * Solo play does not import or call this module, so the avatar adds no frame or
 * network cost until a multiplayer room actually needs it.
 */
export async function loadRemoteWardenTemplate({BABYLON, scene, asset = REMOTE_WARDEN_ASSET} = {}) {
  if (!BABYLON?.SceneLoader?.ImportMeshAsync || !scene) {
    throw new TypeError('Babylon SceneLoader and a scene are required');
  }
  const {rootUrl, fileName} = splitRemoteWardenAssetPath(asset);
  const imported = await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene);
  const animationByName = new Map((imported.animationGroups ?? []).map((group) => [group.name, group]));
  const nodeByName = new Map([
    ...(imported.meshes ?? []),
    ...(imported.transformNodes ?? []),
  ].map((node) => [node.name, node]));

  for (const clip of Object.values(REMOTE_WARDEN_CLIPS)) {
    if (!animationByName.has(clip)) throw new Error(`Remote Warden is missing animation ${clip}`);
  }
  for (const socket of REMOTE_WARDEN_SOCKETS) {
    if (!nodeByName.has(socket)) throw new Error(`Remote Warden is missing socket ${socket}`);
  }

  const materials = new Set((imported.meshes ?? []).map(mesh => mesh.material).filter(Boolean));
  for (const mesh of imported.meshes ?? []) mesh.receiveShadows = true;
  for (const material of materials) {
    material.directIntensity = Math.max(finite(material.directIntensity, 1), REMOTE_WARDEN_LIGHTING.directIntensity);
    material.environmentIntensity = Math.max(
      finite(material.environmentIntensity, 1),
      REMOTE_WARDEN_LIGHTING.environmentIntensity,
    );
    material.emissiveIntensity = Math.max(
      finite(material.emissiveIntensity, 1),
      REMOTE_WARDEN_LIGHTING.emissiveIntensity,
    );
    material.maxSimultaneousLights = REMOTE_WARDEN_LIGHTING.maxSimultaneousLights;
  }
  for (const group of animationByName.values()) group.stop?.();
  imported.meshes?.[0]?.setEnabled?.(false);

  return Object.freeze({
    asset,
    root: imported.meshes?.[0] ?? null,
    meshes: Object.freeze([...(imported.meshes ?? [])]),
    skeleton: imported.skeletons?.[0] ?? null,
    clips: Object.freeze(Object.fromEntries(
      Object.entries(REMOTE_WARDEN_CLIPS).map(([role, name]) => [role, animationByName.get(name)]),
    )),
    sockets: Object.freeze(Object.fromEntries(
      REMOTE_WARDEN_SOCKETS.map((name) => [name, nodeByName.get(name)]),
    )),
  });
}

function clonedNodeMap(sourceRoot) {
  const bySource = new Map();
  const cloneRoot = sourceRoot.instantiateHierarchy(
    null,
    {doNotInstantiate: false},
    (source, clone) => bySource.set(source, clone),
  );
  if (!cloneRoot) throw new Error('Remote Warden hierarchy could not be instantiated');
  bySource.set(sourceRoot, cloneRoot);
  return {root: cloneRoot, bySource};
}

export function remoteWardenClipRoleForState(state) {
  if (Object.hasOwn(REMOTE_WARDEN_CLIPS, state?.animationState)) return state.animationState;
  return Object.entries(REMOTE_WARDEN_CLIPS)
    .find(([, name]) => name === remoteWardenLocomotionClip({
      speed: Math.hypot(finite(state?.velocity?.x), finite(state?.velocity?.z)),
      verticalSpeed: finite(state?.velocity?.y),
      sprint: state?.sprinting === true,
      grounded: state?.grounded === true,
      traversal: state?.traversal,
    }))?.[0] ?? 'idle';
}

/**
 * Instantiate and drive one remote third-person Warden. It is deliberately
 * client-presentational and consumes only replicated NetworkPlayerState data.
 */
export function createRemoteWardenAvatar({template, playerId, tickRate = 30, useTemplateInstance = false} = {}) {
  if (!template?.root?.instantiateHierarchy) throw new TypeError('A loaded Remote Warden template is required');
  if (!playerId) throw new TypeError('Remote Warden playerId is required');
  const direct = useTemplateInstance === true;
  if (direct && DIRECT_TEMPLATE_INSTANCES.has(template)) {
    throw new Error('Remote Warden template instance is already in use');
  }
  if (direct) DIRECT_TEMPLATE_INSTANCES.add(template);
  const {root, bySource} = direct
    ? {root: template.root, bySource: null}
    : clonedNodeMap(template.root);
  root.name = `remote-warden:${playerId}`;
  root.setEnabled?.(false);

  const clips = Object.freeze(Object.fromEntries(Object.entries(template.clips).map(([role, source]) => {
    const clip = direct
      ? source
      : source?.clone?.(`${root.name}:${role}`, target => bySource.get(target) ?? null);
    if (!clip) throw new TypeError(`Remote Warden clip ${role} cannot be ${direct ? 'used' : 'cloned'}`);
    clip.enableBlending = true;
    clip.blendingSpeed = 0.12;
    clip.stop?.();
    return [role, clip];
  })));
  const sockets = Object.freeze(Object.fromEntries(Object.entries(template.sockets).map(([name, source]) => (
    [name, direct ? source : bySource.get(source) ?? null]
  ))));
  for (const [name, socket] of Object.entries(sockets)) {
    if (!socket) throw new Error(`Remote Warden clone is missing socket ${name}`);
  }
  const interpolation = createRemoteWardenInterpolationBuffer({tickRate});
  let activeRole = null;
  let visible = false;

  function play(role, {restart = false} = {}) {
    if (role === activeRole && !restart) return;
    if (activeRole) clips[activeRole]?.stop?.();
    activeRole = role;
    const clip = clips[role] ?? clips.idle;
    const loop = REMOTE_WARDEN_CLIP_LOOPS[role] !== false;
    if (clip?.start) clip.start(loop);
    else clip?.play?.(loop);
  }

  return Object.freeze({
    playerId,
    root,
    clips,
    sockets,
    interpolation,
    get activeClipRole() {
      return activeRole;
    },
    playClip(role, options) {
      const resolvedRole = Object.hasOwn(clips, role) ? role : 'idle';
      play(resolvedRole, options);
      return activeRole;
    },
    push(tick, state) {
      return interpolation.push(tick, state);
    },
    update(estimatedServerTick) {
      const sample = interpolation.sample(estimatedServerTick);
      if (!sample) return null;
      const {state} = sample;
      root.position?.copyFromFloats?.(state.position.x, state.position.y, state.position.z);
      if (root.position && !root.position.copyFromFloats) {
        root.position.x = state.position.x;
        root.position.y = state.position.y;
        root.position.z = state.position.z;
      }
      if (root.rotationQuaternion) root.rotationQuaternion = null;
      if (root.rotation) root.rotation.y = state.facing.yaw + REMOTE_WARDEN_MODEL_YAW_OFFSET;
      if (!visible) {
        root.setEnabled?.(true);
        visible = true;
      }
      play(remoteWardenClipRoleForState(state));
      return sample;
    },
    dispose() {
      interpolation.clear();
      for (const clip of Object.values(clips)) {
        clip.stop?.();
        if (!direct) clip.dispose?.();
      }
      if (direct) {
        root.setEnabled?.(false);
        DIRECT_TEMPLATE_INSTANCES.delete(template);
      } else {
        // Clones share the lazily loaded template material/texture payload; one
        // departing player must not invalidate the remaining remote Wardens.
        root.dispose?.(false, false);
      }
    },
  });
}

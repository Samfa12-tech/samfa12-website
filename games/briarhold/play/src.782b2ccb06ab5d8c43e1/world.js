import { BRIARHOLD_FIRST_PERSON_MAP, HOST_EMERGENCE_PROFILE } from './map-definition.js';
import { HUB_FEATURE_IDS, HUB_NPC_IDS } from './hub.js';
import {advanceWalkBob, createWalkBobState} from './camera-motion.js';
import {
  lightingPresentationProfile,
  lightingProfileForQuality,
  sampleFlameFlicker,
  selectFireLightSources,
  worldCelestialPresentation,
} from './lighting.js';

const NARRATIVE_VIEW_DEFINITIONS = Object.freeze({
  'first-person': Object.freeze({anchorId: 'player', offset: Object.freeze([0, 0, 0]), lookAtId: 'live-view', easeSeconds: 0, movesCamera: false}),
  'bell-wide': Object.freeze({anchorId: 'bell', offset: Object.freeze([0, 1.45, -4.8]), lookAtId: 'bellkeeper', easeSeconds: 0.42, movesCamera: true}),
  'speaker-close': Object.freeze({anchorId: 'speaker', offset: Object.freeze([0.18, 1.58, -1.65]), lookAtId: 'speaker-head', easeSeconds: 0.28, movesCamera: true}),
  'speaker-medium': Object.freeze({anchorId: 'speaker', offset: Object.freeze([0.46, 1.62, -2.55]), lookAtId: 'speaker-upper-body', easeSeconds: 0.34, movesCamera: true}),
  'two-shot': Object.freeze({anchorId: 'speaker-pair', offset: Object.freeze([0, 1.7, -3.5]), lookAtId: 'speaker-pair', easeSeconds: 0.38, movesCamera: true}),
  'gate-overlook': Object.freeze({anchorId: 'west-overlook', offset: Object.freeze([0, 1.7, 0]), lookAtId: 'west-gate', easeSeconds: 0.46, movesCamera: true}),
  'courtyard-wide': Object.freeze({anchorId: 'courtyard', offset: Object.freeze([0, 2.2, -5.8]), lookAtId: 'courtyard', easeSeconds: 0.46, movesCamera: true}),
  'stores-medium': Object.freeze({anchorId: 'quartermaster', offset: Object.freeze([0.6, 1.6, -2.8]), lookAtId: 'quartermaster', easeSeconds: 0.34, movesCamera: true}),
  'workbench-medium': Object.freeze({anchorId: 'mason', offset: Object.freeze([-0.5, 1.55, -2.7]), lookAtId: 'mason', easeSeconds: 0.34, movesCamera: true}),
  'grove-medium': Object.freeze({anchorId: 'greenwarden', offset: Object.freeze([0.65, 1.62, -2.9]), lookAtId: 'greenwarden', easeSeconds: 0.34, movesCamera: true}),
  'fortress-wide': Object.freeze({anchorId: 'heart-gate', offset: Object.freeze([0, 4.2, -10.5]), lookAtId: 'fortress', easeSeconds: 0.5, movesCamera: true}),
});

function presentationView(shotId, definition, {reducedMotion = false, fallback = false} = {}) {
  return Object.freeze({
    shotId,
    anchorId: definition.anchorId,
    offset: definition.offset,
    lookAtId: definition.lookAtId,
    easeSeconds: reducedMotion ? 0 : definition.easeSeconds,
    movesCamera: definition.movesCamera,
    fallback,
  });
}

const NARRATIVE_WORLD_VIEWS = Object.freeze(Object.fromEntries(Object.entries(NARRATIVE_VIEW_DEFINITIONS)
  .map(([shotId, definition]) => [shotId, presentationView(shotId, definition)])));
const REDUCED_NARRATIVE_WORLD_VIEWS = Object.freeze(Object.fromEntries(Object.entries(NARRATIVE_VIEW_DEFINITIONS)
  .map(([shotId, definition]) => [shotId, presentationView(shotId, definition, {reducedMotion: true})])));
const UNKNOWN_NARRATIVE_WORLD_VIEW = presentationView('first-person', NARRATIVE_VIEW_DEFINITIONS['first-person'], {fallback: true});

export function resolveNarrativeWorldView(shotId, {reducedMotion = false} = {}) {
  const views = reducedMotion ? REDUCED_NARRATIVE_WORLD_VIEWS : NARRATIVE_WORLD_VIEWS;
  return views[shotId] ?? UNKNOWN_NARRATIVE_WORLD_VIEW;
}

export function worldPresentationProfile(profileId = 'night', options = {}) {
  const lighting = lightingPresentationProfile(profileId, options);
  return WORLD_PRESENTATION_PROFILES[lighting.key] ?? WORLD_PRESENTATION_PROFILES.night;
}

export const WORLD_PRESENTATION_PROFILES = Object.freeze(Object.fromEntries([
  lightingPresentationProfile('day'),
  lightingPresentationProfile('day', {shadowsEnabled: false}),
  lightingPresentationProfile('night'),
  lightingPresentationProfile('night', {shadowsEnabled: false}),
].map(profile => [profile.key, Object.freeze({
  ...profile,
  skyLuminance: profile.key.startsWith('day') ? 0.78 : 0.16,
  daylightGeometryFloor: profile.minimumMaterialAmbient,
})])));

export const WORLD_COORDINATES = Object.freeze({
  westGate: Object.freeze({ x: -16, z: 0 }),
  eastGate: Object.freeze({ x: 16, z: 0 }),
  heartGate: Object.freeze({ x: 0, z: -18 }),
  westStation: Object.freeze({ x: -13, y: 9.8, z: -11.5 }),
  eastStation: Object.freeze({ x: 13, y: 9.8, z: -11.5 }),
  spawnZ: 110
});

const WALL_SIGHTLINE_Z = -2.2;
const PARAPET_TOP_Y = 10.4;
export const AIM_PLANE_Y = 0.85;
export const MAX_WORLD_LIGHTS_PER_MATERIAL = 5;
export const WORLD_GLOBAL_LIGHT_COUNT = 2;
export const WARDEN_LIGHT_COUNT = 1;
export const MAX_LOCAL_TORCH_LIGHTS = 2;
export const LOW_SPEC_LOCAL_LIGHTS = 1;
export const MAX_STANDARD_WORLD_LIGHTS = WORLD_GLOBAL_LIGHT_COUNT + WARDEN_LIGHT_COUNT + MAX_LOCAL_TORCH_LIGHTS;

export const FIRST_PERSON_EYE_SMOOTHING = Object.freeze({
  downSeconds: 0.082,
  upSeconds: 0.118,
});

export function smoothPresentedEyeHeight(
  current,
  target,
  deltaSeconds,
  options = FIRST_PERSON_EYE_SMOOTHING
) {
  const next = Number(target);
  const previous = Number(current);
  const dt = Number(deltaSeconds);
  if (!Number.isFinite(next)) return Number.isFinite(previous) ? previous : 1.62;
  if (!Number.isFinite(previous) || !Number.isFinite(dt) || dt <= 0) return next;
  const tau = next < previous ? Number(options?.downSeconds) : Number(options?.upSeconds);
  const alpha = 1 - Math.exp(-dt / Math.max(0.001, Number.isFinite(tau) ? tau : 0.1));
  return previous + (next - previous) * alpha;
}

export const MESHY_FIELD_DEFENCE_ASSETS = Object.freeze({
  barricade: 'assets/meshy/runtime/briarhold-barricade-512.glb',
  thornSnare: 'assets/meshy/runtime/briarhold-thorn-snare-512.glb',
  firePot: 'assets/meshy/runtime/briarhold-fire-pot-512.glb',
  wardLantern: 'assets/meshy/runtime/briarhold-ward-lantern-512.glb',
});
export const MESHY_BATTLEFIELD_VERGE_ASSET = 'assets/meshy/runtime/briarhold-battlefield-verge-512.glb';
export const MESHY_HUB_WAVE_BELL_ASSET = 'assets/meshy/runtime/briarhold-wave-bell-512.glb';
export const MESHY_COURTYARD_SERVICE_ARCADE_ASSET = 'assets/meshy/runtime/briarhold-courtyard-service-arcade-512.glb';

/** Select the texture-only mobile derivative of a static Meshy world asset. */
export function runtimeWorldAsset(assetPath, mobileTextures = false) {
  return mobileTextures ? assetPath.replace(/-512\.glb$/u, '-256.glb') : assetPath;
}
export const COURTYARD_SERVICE_ARCADE_SIZE = Object.freeze({width: 5.8, height: 3.2, depth: 1.4});
export const COURTYARD_SERVICE_ARCADE_TRANSFORMS = Object.freeze([
  // Runtime local width runs on X. Rotate 90 degrees so that width follows Z
  // and the shallow depth remains inside the authored collision footprint.
  // Keep Mason's arcade in the open courtyard, beside the bench rather than
  // beneath the west stair's rendered envelope.
  Object.freeze({id: 'service-arcade-mason', x: -21.7, y: -0.18, z: -9.7, ry: Math.PI * 0.5}),
  Object.freeze({id: 'service-arcade-quartermaster', x: 2.3, y: -0.18, z: -12.9, ry: -Math.PI * 0.5}),
]);
export const BATTLEFIELD_VERGE_ENVELOPE = Object.freeze({width: 3.2, height: 0.35, depth: 2.2});

export const HUB_LANDMARK_PLACEMENTS = Object.freeze({
  bell: Object.freeze({type: 'waveBell', x: -15, y: 0.03, z: -17.65, facing: Math.PI}),
  mason: Object.freeze({type: 'barricade', x: -21.4, y: 0.02, z: -10.55, facing: Math.PI * 0.5, scale: 0.35}),
  quartermaster: Object.freeze({type: 'firePot', x: 4.7, y: 0.02, z: -15.65, facing: Math.PI, scale: 0.55}),
  trapper: Object.freeze({type: 'thornSnare', x: -21.7, y: 0.02, z: -20.45, facing: 0.2, scale: 0.35}),
  greenwarden: Object.freeze({type: 'wardLantern', x: -16.2, y: 0.02, z: -26.5, facing: 0, scale: 0.62}),
});

function featureIsRepaired(features, featureId) {
  return features?.[featureId]?.repaired === true;
}

function gateIntegrityRatio(gates, gateId) {
  const gate = gates?.[gateId];
  const integrity = Number(gate?.integrity);
  const maximum = Number(gate?.maxIntegrity);
  return Number.isFinite(integrity) && Number.isFinite(maximum) && maximum > 0
    ? Math.max(0, Math.min(1, integrity / maximum))
    : 0;
}

/** Resolve persisted hub state into a small render-only landmark contract. */
export function resolveHubPresentationState({phase = 'menu', activeNpcs = [], features = {}, gates = {}} = {}) {
  const active = new Set(Array.isArray(activeNpcs) ? activeNpcs : []);
  const worldVisible = phase !== 'menu';
  const outerRepaired = featureIsRepaired(features, HUB_FEATURE_IDS.OUTER_GATE_BRACING)
    && gateIntegrityRatio(gates, 'outer') > 0.5;
  const heartRepaired = featureIsRepaired(features, HUB_FEATURE_IDS.HEART_GATE_MASONRY)
    && gateIntegrityRatio(gates, 'heart') > 0.5;
  return Object.freeze({
    worldVisible,
    outerGateBracing: outerRepaired ? 'repaired' : 'damaged',
    heartGateMasonry: heartRepaired ? 'repaired' : 'damaged',
    quartermasterStores: !active.has(HUB_NPC_IDS.QUARTERMASTER)
      ? 'hidden'
      : featureIsRepaired(features, HUB_FEATURE_IDS.QUARTERMASTER_STORES) ? 'ready' : 'closed',
    trapperWorkshop: !active.has(HUB_NPC_IDS.TRAPPER)
      ? 'hidden'
      : featureIsRepaired(features, HUB_FEATURE_IDS.TRAPPER_WORKSHOP) ? 'ready' : 'closed',
    greenwardenShrine: !active.has(HUB_NPC_IDS.GREENWARDEN)
      ? 'hidden'
      : featureIsRepaired(features, HUB_FEATURE_IDS.WARD_LANTERN_NETWORK) ? 'awake' : 'sleeping',
    activeNpcs: Object.freeze([...active].sort()),
  });
}

export const MESHY_FIELD_DEFENCE_ENVELOPES = Object.freeze({
  barricade: Object.freeze({width: 5.4, height: 2.6, depth: 1.5}),
  thornSnare: Object.freeze({width: 5.4, height: 0.9, depth: 5.4}),
  firePot: Object.freeze({width: 1.7, height: 1.8, depth: 1.7}),
  wardLantern: Object.freeze({width: 1.8, height: 3.8, depth: 1.8}),
});

export function worldLightCountForProfile({lowSpec = false} = {}) {
  return WORLD_GLOBAL_LIGHT_COUNT + WARDEN_LIGHT_COUNT + (lowSpec ? LOW_SPEC_LOCAL_LIGHTS : MAX_LOCAL_TORCH_LIGHTS);
}

export const WORLD_MATERIAL_TINTS = Object.freeze({
  // The Poly Haven brick source is naturally warm/red. These cool multipliers
  // bring its rendered average into the same grey-green family as the Meshy
  // wall-bay, watchtower and gatehouse albedo instead of producing patchwork
  // brown fallback walls beside charcoal imported masonry.
  stone: '#536c69',
  stoneDark: '#374844',
  killzone: '#3b352d',
  courtyard: '#626760',
  ground: '#263b2b',
  path: '#4b513c',
  hostRoad: '#3f3323',
  roadStone: '#877c64',
});
export const WORLD_ATMOSPHERE = Object.freeze({
  fogDensity: 0.0051,
  fogColor: '#1b3038',
  threatFogGain: 0.0014,
  contrast: 1.1,
  exposure: 1.22,
  vignetteWeight: 0.42,
  vignetteStretch: 0.12,
  hemiIntensity: 0.7,
  moonIntensity: 1.82,
});
export const KILLZONE_APRON = Object.freeze({
  id: 'west-killzone-apron',
  x: -16,
  y: 0.04,
  z: 35.05,
  width: 64,
  depth: 26.1,
  minZ: 22,
  maxZ: 48.1,
  material: 'killzone',
});
export const WEST_FOREST_ROAD = Object.freeze({
  id: 'west-forest-road',
  x: -16,
  y: 0.035,
  z: (48.1 + HOST_EMERGENCE_PROFILE.roadVisualMaxZ) * 0.5,
  width: 15,
  depth: HOST_EMERGENCE_PROFILE.roadVisualMaxZ - 48.1,
  minZ: 48.1,
  maxZ: HOST_EMERGENCE_PROFILE.roadVisualMaxZ,
  material: 'path',
});
export const EAST_FOREST_ROAD = Object.freeze({
  id: 'east-forest-road',
  x: 16,
  y: 0.035,
  z: 59,
  width: 15,
  depth: 118,
  minZ: 0,
  maxZ: 118,
  material: 'path',
});
export const APPROACH_SURFACES = Object.freeze([
  KILLZONE_APRON,
  WEST_FOREST_ROAD,
  EAST_FOREST_ROAD,
]);
export const BATTLEFIELD_VERGE_PLACEMENTS = Object.freeze([
  Object.freeze({group: 'killzone-west', x: -41, y: 0.05, z: 25, yaw: 0.3, scale: 0.92}),
  Object.freeze({group: 'killzone-west', x: -35, y: 0.05, z: 32, yaw: -0.5, scale: 1.05}),
  Object.freeze({group: 'killzone-west', x: -29, y: 0.05, z: 40, yaw: 0.2, scale: 0.88}),
  Object.freeze({group: 'killzone-east', x: -3, y: 0.05, z: 24, yaw: -0.35, scale: 0.95}),
  Object.freeze({group: 'killzone-east', x: 3, y: 0.05, z: 31, yaw: 0.55, scale: 1.08}),
  Object.freeze({group: 'killzone-east', x: 9, y: 0.05, z: 39, yaw: -0.2, scale: 0.9}),
  Object.freeze({group: 'road-verges', x: -28, y: 0.04, z: 56, yaw: 0.4, scale: 0.98}),
  Object.freeze({group: 'road-verges', x: -4, y: 0.04, z: 58, yaw: -0.5, scale: 0.9}),
  Object.freeze({group: 'road-verges', x: -27, y: 0.04, z: 74, yaw: -0.3, scale: 1.06}),
  Object.freeze({group: 'road-verges', x: -5, y: 0.04, z: 77, yaw: 0.65, scale: 0.94}),
  Object.freeze({group: 'road-verges', x: -27, y: 0.04, z: 95, yaw: 0.2, scale: 0.9}),
  Object.freeze({group: 'road-verges', x: -5, y: 0.04, z: 99, yaw: -0.55, scale: 1.04}),
]);

export function battlefieldVergeTransforms() {
  return BATTLEFIELD_VERGE_PLACEMENTS.map(placement => Object.freeze({
    group: placement.group,
    x: placement.x,
    y: placement.y,
    z: placement.z,
    ry: placement.yaw,
    sx: placement.scale,
    sy: Math.min(1, placement.scale),
    sz: placement.scale,
  }));
}
export const DEFAULT_VIEWMODEL_MUZZLE = Object.freeze({
  viewportX: 0.548,
  viewportY: 0.584,
  depth: 1.1
});
export const VIEWMODEL_MUZZLES = Object.freeze({
  arbalest: Object.freeze({...DEFAULT_VIEWMODEL_MUZZLE, imageX: 0.462, imageY: 0.313}),
  sunfire: Object.freeze({viewportX: 0.564, viewportY: 0.533, imageX: 0.488, imageY: 0.233, depth: 1.1}),
  runebolt: Object.freeze({viewportX: 0.557, viewportY: 0.576, imageX: 0.453, imageY: 0.292, depth: 1.1})
});

export function resolveRenderedViewmodelMuzzle(rect, muzzle = DEFAULT_VIEWMODEL_MUZZLE, options = {}) {
  const width = Math.max(1, Number(rect?.width) || Number(rect?.right) - Number(rect?.left) || 1);
  const height = Math.max(1, Number(rect?.height) || Number(rect?.bottom) - Number(rect?.top) || 1);
  const right = Number.isFinite(Number(rect?.right)) ? Number(rect.right) : Number(rect?.left || 0) + width;
  const bottom = Number.isFinite(Number(rect?.bottom)) ? Number(rect.bottom) : Number(rect?.top || 0) + height;
  const imageAspect = Math.max(0.1, Number(options.imageAspectRatio) || 16 / 9);
  const boxAspect = width / height;
  const renderedWidth = boxAspect > imageAspect ? height * imageAspect : width;
  const renderedHeight = boxAspect > imageAspect ? height : width / imageAspect;
  const imageLeft = right - renderedWidth;
  const imageTop = bottom - renderedHeight;
  const viewportWidth = Math.max(1, Number(options.viewportWidth) || globalThis.innerWidth || width);
  const viewportHeight = Math.max(1, Number(options.viewportHeight) || globalThis.innerHeight || height);
  return Object.freeze({
    viewportX: clamp((imageLeft + clamp(Number(muzzle.imageX), 0, 1) * renderedWidth) / viewportWidth, 0, 1),
    viewportY: clamp((imageTop + clamp(Number(muzzle.imageY), 0, 1) * renderedHeight) / viewportHeight, 0, 1),
    depth: Math.max(0.2, Number(muzzle.depth) || DEFAULT_VIEWMODEL_MUZZLE.depth),
  });
}
export const BATTLEFIELD_AIM_BOUNDS = Object.freeze({
  minX: -30,
  maxX: 30,
  minZ: -18,
  maxZ: 112
});
export const FORTIFICATION_SOCKET_COORDINATES = Object.freeze([
  Object.freeze({ id: 'west-outer', x: -16, z: 58 }),
  Object.freeze({ id: 'west-middle', x: -16, z: 38 }),
  Object.freeze({ id: 'west-rear', x: -16, z: 19 }),
  Object.freeze({ id: 'east-outer', x: 16, z: 58 }),
  Object.freeze({ id: 'east-middle', x: 16, z: 38 }),
  Object.freeze({ id: 'east-rear', x: 16, z: 19 })
]);

const LEGACY_SOCKET_IDS = FORTIFICATION_SOCKET_COORDINATES.map(socket => socket.id);
const AUTHORED_TYPE_ALIASES = Object.freeze({
  'thorn-snare': 'thornSnare',
  'fire-pot': 'firePot',
  'ward-lantern': 'wardLantern'
});

function runtimeFortificationType(type) {
  return AUTHORED_TYPE_ALIASES[type] ?? type;
}

/**
 * The six legacy lane IDs remain exported above for the fixed-station camera
 * tests and v1 plan migration. Runtime meshes use these authored map sockets.
 */
export const AUTHORED_FORTIFICATION_SOCKET_COORDINATES = Object.freeze(
  BRIARHOLD_FIRST_PERSON_MAP.buildSockets.map((socket, index) => Object.freeze({
    id: socket.id,
    legacyId: LEGACY_SOCKET_IDS[index] ?? null,
    approach: 'west',
    x: socket.position.x,
    y: socket.position.y,
    z: socket.position.z,
    facing: socket.facing ?? 0,
    allowedTypes: Object.freeze(socket.allowed.map(runtimeFortificationType)),
    authoredAllowedTypes: socket.allowed
  }))
);

export const LEGACY_FORTIFICATION_SOCKET_ALIASES = Object.freeze(
  Object.fromEntries(
    AUTHORED_FORTIFICATION_SOCKET_COORDINATES
      .filter(socket => socket.legacyId)
      .map(socket => [socket.legacyId, socket.id])
  )
);

export function resolveFortificationSocketCoordinate(socketId) {
  const authoredId = LEGACY_FORTIFICATION_SOCKET_ALIASES[socketId] ?? socketId;
  return AUTHORED_FORTIFICATION_SOCKET_COORDINATES.find(socket => socket.id === authoredId) ?? null;
}

export function fortificationSocketSnapshot(socket) {
  if (!socket) return null;
  return Object.freeze({
    id: socket.id,
    legacyId: socket.legacyId ?? null,
    approach: socket.approach,
    x: socket.x,
    y: socket.y,
    z: socket.z,
    facing: socket.facing,
    allowedTypes: Object.freeze([...socket.allowedTypes])
  });
}

const CAMERA_PROFILES = Object.freeze({
  landscape: Object.freeze({
    minimumY: 27,
    minimumZ: -2,
    targetY: AIM_PLANE_Y,
    maximumTargetZ: 16,
    minimumFieldOfView: 1.65
  }),
  portrait: Object.freeze({
    minimumY: 30,
    minimumZ: -2,
    targetY: AIM_PLANE_Y,
    maximumTargetZ: 16,
    minimumFieldOfView: 1.68
  })
});

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function transientEffectScale(age, life, expansion = 0) {
  const safeLife = Math.max(0.001, Number(life) || 0.001);
  const progress = clamp((Number(age) || 0) / safeLife, 0, 1);
  return 1 + progress * Math.max(0, Number(expansion) || 0) * 2.4;
}

export function resolveStationCamera(station = 'west', layout = null) {
  const east = station === 'east';
  const portrait = layout?.orientation === 'portrait';
  const profile = layout?.camera;
  const worldProfile = CAMERA_PROFILES[portrait ? 'portrait' : 'landscape'];
  return Object.freeze({
    position: Object.freeze({
      x: east ? 16 : -16,
      y: Math.max(profile?.position?.[1] ?? 0, worldProfile.minimumY),
      z: Math.max(profile?.position?.[2] ?? Number.NEGATIVE_INFINITY, worldProfile.minimumZ)
    }),
    target: Object.freeze({
      x: east ? 16 : -16,
      y: worldProfile.targetY,
      z: Math.min(profile?.target?.[2] ?? Number.POSITIVE_INFINITY, worldProfile.maximumTargetZ)
    }),
    fieldOfView: Math.max(profile?.fieldOfView ?? 0, worldProfile.minimumFieldOfView)
  });
}

export function resolvePlanningCamera(layout = null, selectedSocketId = null) {
  const portrait = layout?.orientation === 'portrait';
  const selected = FORTIFICATION_SOCKET_COORDINATES.find(socket => socket.id === selectedSocketId)
    ?? resolveFortificationSocketCoordinate(selectedSocketId);
  const selectedLaneX = selected?.x ?? (selectedSocketId === 'west' ? -16 : selectedSocketId === 'east' ? 16 : null);
  const focusX = portrait && selectedLaneX != null ? selectedLaneX : 0;
  return Object.freeze({
    position: Object.freeze({ x: focusX, y: portrait ? 72 : 68, z: -5 }),
    target: Object.freeze({ x: focusX, y: 0, z: 38 }),
    fieldOfView: portrait ? 1.08 : 1
  });
}

export function sightlineClearanceAtWall(cameraProfile) {
  const { position, target } = cameraProfile;
  const travel = target.z - position.z;
  if (Math.abs(travel) < 0.001) return Number.NEGATIVE_INFINITY;
  const progress = (WALL_SIGHTLINE_Z - position.z) / travel;
  const sightlineY = position.y + (target.y - position.y) * progress;
  return sightlineY - PARAPET_TOP_Y;
}

export function projectWorldPointToCamera(cameraProfile, point, aspectRatio = 1) {
  const position = cameraProfile?.position;
  const target = cameraProfile?.target;
  const fieldOfView = Number(cameraProfile?.fieldOfView);
  const aspect = Number(aspectRatio);
  if (!position || !target || !point || !Number.isFinite(fieldOfView) || fieldOfView <= 0 || !Number.isFinite(aspect) || aspect <= 0) return null;
  const forwardX = target.x - position.x;
  const forwardY = target.y - position.y;
  const forwardZ = target.z - position.z;
  const forwardLength = Math.hypot(forwardX, forwardY, forwardZ);
  if (!(forwardLength > 0)) return null;
  const fx = forwardX / forwardLength;
  const fy = forwardY / forwardLength;
  const fz = forwardZ / forwardLength;
  const rightLength = Math.hypot(fz, fx);
  if (!(rightLength > 0)) return null;
  const rx = fz / rightLength;
  const rz = -fx / rightLength;
  const ux = fy * rz;
  const uy = fz * rx - fx * rz;
  const uz = -fy * rx;
  const dx = point.x - position.x;
  const dy = point.y - position.y;
  const dz = point.z - position.z;
  const depth = dx * fx + dy * fy + dz * fz;
  if (!(depth > 0)) return Object.freeze({ x: Number.NaN, y: Number.NaN, depth, visible: false });
  const tangent = Math.tan(fieldOfView / 2);
  const x = (dx * rx + dz * rz) / (depth * tangent * aspect);
  const y = (dx * ux + dy * uy + dz * uz) / (depth * tangent);
  return Object.freeze({
    x,
    y,
    depth,
    visible: Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 1 && Math.abs(y) <= 1
  });
}

/**
 * Converts the muzzle's viewport position into camera-local offsets. Keeping
 * this independent of world position means a tracer always begins on the
 * first-person weapon, even after the player turns or changes elevation.
 */
export function resolveViewmodelMuzzleOffset({
  viewportX = DEFAULT_VIEWMODEL_MUZZLE.viewportX,
  viewportY = DEFAULT_VIEWMODEL_MUZZLE.viewportY,
  depth = DEFAULT_VIEWMODEL_MUZZLE.depth,
  fieldOfView,
  aspectRatio
} = {}) {
  const x = Number(viewportX);
  const y = Number(viewportY);
  const distance = Number(depth);
  const fov = Number(fieldOfView);
  const aspect = Number(aspectRatio);
  if (![x, y, distance, fov, aspect].every(Number.isFinite)
    || distance <= 0 || fov <= 0 || fov >= Math.PI || aspect <= 0) return null;
  const tangent = Math.tan(fov / 2);
  return Object.freeze({
    right: (x * 2 - 1) * distance * tangent * aspect,
    up: (1 - y * 2) * distance * tangent,
    forward: distance
  });
}

/**
 * Resolve the authored muzzle anchor in world space without unprojecting a
 * render-buffer pixel. Adaptive resolution can change backing-buffer size at
 * any time; camera-local projection remains stable for the visible viewport.
 */
export function resolveViewmodelMuzzleWorldPoint({
  position,
  forward,
  right,
  up,
  ...projection
} = {}) {
  const offset = resolveViewmodelMuzzleOffset(projection);
  const vectors = [position, forward, right, up];
  if (!offset || vectors.some(vector => !vector
    || ![vector.x, vector.y, vector.z].every(Number.isFinite))) return null;
  return Object.freeze({
    x: position.x + forward.x * offset.forward + right.x * offset.right + up.x * offset.up,
    y: position.y + forward.y * offset.forward + right.y * offset.right + up.y * offset.up,
    z: position.z + forward.z * offset.forward + right.z * offset.right + up.z * offset.up,
  });
}

/** Convert the authored muzzle viewport point to Babylon's render-buffer pixels. */
export function viewmodelMuzzleRenderCoordinates({
  viewportX = DEFAULT_VIEWMODEL_MUZZLE.viewportX,
  viewportY = DEFAULT_VIEWMODEL_MUZZLE.viewportY,
  renderWidth,
  renderHeight,
} = {}) {
  const x = Number(viewportX);
  const y = Number(viewportY);
  const width = Number(renderWidth);
  const height = Number(renderHeight);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return Object.freeze({
    x: clamp(x, 0, 1) * width,
    y: clamp(y, 0, 1) * height,
  });
}

export function mapClientPointToRender(clientX, clientY, rect, renderWidth, renderHeight) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0) || !(renderWidth > 0) || !(renderHeight > 0)) return null;
  const numericX = Number(clientX);
  const numericY = Number(clientY);
  if (!Number.isFinite(numericX) || !Number.isFinite(numericY)) return null;
  const normalizedX = clamp((numericX - rect.left) / rect.width, 0, 1);
  const normalizedY = clamp((numericY - rect.top) / rect.height, 0, 1);
  return Object.freeze({
    x: normalizedX * renderWidth,
    y: normalizedY * renderHeight,
    normalizedX,
    normalizedY
  });
}

export function intersectRayWithAimPlane(ray, { planeY = AIM_PLANE_Y, bounds = BATTLEFIELD_AIM_BOUNDS } = {}) {
  const origin = ray?.origin;
  const direction = ray?.direction;
  const denominator = Number(direction?.y);
  if (!origin || !direction || !Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(origin.z) || !Number.isFinite(direction.x) || !Number.isFinite(denominator) || !Number.isFinite(direction.z) || Math.abs(denominator) < 1e-8) return null;
  const distance = (planeY - origin.y) / denominator;
  if (!Number.isFinite(distance) || distance < 0) return null;
  const rawX = origin.x + direction.x * distance;
  const rawZ = origin.z + direction.z * distance;
  const x = clamp(rawX, bounds.minX, bounds.maxX);
  const z = clamp(rawZ, bounds.minZ, bounds.maxZ);
  return Object.freeze({
    x,
    y: planeY,
    z,
    distance,
    clamped: x !== rawX || z !== rawZ
  });
}

function material(BABYLON, scene, name, color, roughness = 1) {
  const output = new BABYLON.PBRMaterial(name, scene);
  output.albedoColor = BABYLON.Color3.FromHexString(color);
  output.roughness = roughness;
  output.metallic = 0;
  output.maxSimultaneousLights = MAX_WORLD_LIGHTS_PER_MATERIAL;
  return output;
}

function emissiveMaterial(BABYLON, scene, name, color, alpha = 1) {
  const output = new BABYLON.StandardMaterial(name, scene);
  output.diffuseColor = BABYLON.Color3.Black();
  output.emissiveColor = BABYLON.Color3.FromHexString(color);
  output.disableLighting = true;
  output.alpha = alpha;
  return output;
}

function runtimeTextureSet(BABYLON, scene, assetId, tiling = 1, lowSpec = false, mobileTextures = false) {
  const root = `assets/textures/polyhaven/runtime/${assetId}`;
  const textureEdge = mobileTextures ? 256 : 512;
  const create = (suffix, useSrgb) => {
    const texture = new BABYLON.Texture(
      `${root}_${suffix}_${textureEdge}.webp`,
      scene,
      false,
      false,
      lowSpec ? BABYLON.Texture.BILINEAR_SAMPLINGMODE : BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
    );
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.uScale = tiling;
    texture.vScale = tiling;
    texture.gammaSpace = useSrgb;
    return texture;
  };
  return {
    diffuse: create("diff", true),
    normal: create("nor_gl", false),
    orm: create("orm", false),
  };
}

function applyRuntimeTextureSet(materialInstance, set, lowSpec = false) {
  materialInstance.albedoTexture = set.diffuse;
  materialInstance.bumpTexture = lowSpec ? null : set.normal;
  materialInstance.metallicTexture = lowSpec ? null : set.orm;
  materialInstance.useAmbientOcclusionFromMetallicTextureRed = !lowSpec;
  materialInstance.useRoughnessFromMetallicTextureGreen = !lowSpec;
  materialInstance.useMetallnessFromMetallicTextureBlue = !lowSpec;
  materialInstance.metallic = 0;
  materialInstance.roughness = 1;
}

function addBox(BABYLON, scene, name, size, position, mat) {
  const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
  mesh.position.copyFromFloats(position.x, position.y, position.z);
  mesh.material = mat;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  return mesh;
}

function markWorldOccluder(mesh) {
  if (!mesh) return mesh;
  mesh.isPickable = true;
  mesh.metadata = { ...(mesh.metadata || {}), worldOccluder: true };
  return mesh;
}

export const NON_RENDERED_TRAVERSAL_SURFACES = Object.freeze(new Set([
  'killing-field',
  'western-approach',
  // This logical side-mouth joins two already rendered ground surfaces; a
  // third coplanar deck would flicker without adding any visible information.
  'west-postern-courtyard-entry',
]));

export function shouldRenderTraversalSurface(surface) {
  return Boolean(surface?.id) && !NON_RENDERED_TRAVERSAL_SURFACES.has(surface.id);
}

export const GROUND_TRAVERSAL_VISUAL_TOP = 0.085;

export function traversalSurfaceVisualTop(surface) {
  const authoredY = Number(surface?.y) || 0;
  return authoredY <= 0.1 ? authoredY + GROUND_TRAVERSAL_VISUAL_TOP : authoredY;
}

export function traversalSurfaceVisualBounds(surface) {
  return {
    min: surface?.visualMin ?? surface?.min,
    max: surface?.visualMax ?? surface?.max,
  };
}

export const TRANSIENT_EFFECT_POOL_SIZE = 4;

export function transientEffectPoolIndex(records = []) {
  const inactive = records.findIndex(record => record?.active !== true);
  if (inactive >= 0) return inactive;
  let oldest = 0;
  for (let index = 1; index < records.length; index += 1) {
    if ((records[index]?.born ?? Infinity) < (records[oldest]?.born ?? Infinity)) oldest = index;
  }
  return oldest;
}

export const TRAVERSAL_DECK_THICKNESS = 0.42;
export const ELEVATED_DECK_FASCIA_HEIGHT = 0.9;
export const ELEVATED_DECK_FASCIA_DEPTH = 0.22;
export const ELEVATED_RAMP_STRINGER_HEIGHT = 0.9;
export const ELEVATED_RAMP_STRINGER_WIDTH = 0.28;
export const MAIN_STAIR_TARGET_RISER_HEIGHT = 0.4;
export const WEST_POSTERN_PASSAGE_SURFACE_ID = 'west-postern-passage';
export const WEST_POSTERN_MIN_HEADROOM = 2.65;

function subtractCoveredIntervals(start, end, covers) {
  const ordered = covers
    .map(([coverStart, coverEnd]) => [Math.max(start, coverStart), Math.min(end, coverEnd)])
    .filter(([coverStart, coverEnd]) => coverEnd - coverStart > 1e-6)
    .sort((left, right) => left[0] - right[0]);
  const exposed = [];
  let cursor = start;
  for (const [coverStart, coverEnd] of ordered) {
    if (coverStart > cursor + 1e-6) exposed.push([cursor, coverStart]);
    cursor = Math.max(cursor, coverEnd);
  }
  if (cursor < end - 1e-6) exposed.push([cursor, end]);
  return exposed;
}

/**
 * Give every exposed elevated deck edge a shallow masonry/timber fascia.
 *
 * The fascia is derived from the exact rendered rectangles, sits wholly
 * inside their footprint, and ends at the deck underside. Shared seams and
 * signed ramp mouths are subtracted, so this cannot cover a stair, overlook
 * descent, or route. It removes the floating-slab/sky slivers that were most
 * obvious when looking across the gatehouse at oblique first-person angles.
 */
export function elevatedDeckFasciaTransforms(mapDefinition = BRIARHOLD_FIRST_PERSON_MAP) {
  const flats = (mapDefinition.walkableSurfaces ?? [])
    .filter(surface => surface.kind === 'flat'
      && shouldRenderTraversalSurface(surface)
      // The lower timber firing gallery is intentionally open underneath and
      // can be reached by a jumping player. Keep fascia on the eight-metre
      // fortress shell, where its lowest edge remains far above player space.
      && traversalSurfaceVisualTop(surface) >= 7.5);
  const ramps = (mapDefinition.walkableSurfaces ?? []).filter(surface => surface.kind === 'ramp');
  const transforms = [];
  const epsilon = 1e-6;

  for (const surface of flats) {
    const bounds = traversalSurfaceVisualBounds(surface);
    const top = traversalSurfaceVisualTop(surface) - TRAVERSAL_DECK_THICKNESS;
    const material = surface.appearance === 'timber-overlook' ? 'wood' : 'stone';
    const edges = [
      {edge: 'west', axis: 'z', fixedAxis: 'x', fixed: bounds.min.x, opposite: 'max', start: bounds.min.z, end: bounds.max.z},
      {edge: 'east', axis: 'z', fixedAxis: 'x', fixed: bounds.max.x, opposite: 'min', start: bounds.min.z, end: bounds.max.z},
      {edge: 'south', axis: 'x', fixedAxis: 'z', fixed: bounds.min.z, opposite: 'max', start: bounds.min.x, end: bounds.max.x},
      {edge: 'north', axis: 'x', fixedAxis: 'z', fixed: bounds.max.z, opposite: 'min', start: bounds.min.x, end: bounds.max.x},
    ];

    for (const edge of edges) {
      const covers = [];
      for (const other of flats) {
        if (other === surface || Math.abs(traversalSurfaceVisualTop(other) - traversalSurfaceVisualTop(surface)) > epsilon) continue;
        const otherBounds = traversalSurfaceVisualBounds(other);
        if (Math.abs(otherBounds[edge.opposite][edge.fixedAxis] - edge.fixed) > epsilon) continue;
        covers.push([otherBounds.min[edge.axis], otherBounds.max[edge.axis]]);
      }
      for (const ramp of ramps) {
        if (ramp.axis !== edge.fixedAxis) continue;
        const rampBounds = traversalSurfaceVisualBounds(ramp);
        const endpoint = edge.opposite === 'min' ? rampBounds.min[edge.fixedAxis] : rampBounds.max[edge.fixedAxis];
        const endpointY = edge.opposite === 'min' ? Number(ramp.startY) : Number(ramp.endY);
        if (Math.abs(endpoint - edge.fixed) > epsilon || Math.abs(endpointY - traversalSurfaceVisualTop(surface)) > epsilon) continue;
        covers.push([rampBounds.min[edge.axis], rampBounds.max[edge.axis]]);
      }

      for (const [start, end] of subtractCoveredIntervals(edge.start, edge.end, covers)) {
        const length = end - start;
        if (length <= 0.04) continue;
        const depth = Math.min(ELEVATED_DECK_FASCIA_DEPTH, length);
        const transform = {
          surfaceId: surface.id,
          edge: edge.edge,
          material,
          x: 0,
          y: top - ELEVATED_DECK_FASCIA_HEIGHT * 0.5,
          z: 0,
          sx: edge.axis === 'x' ? length : depth,
          sy: ELEVATED_DECK_FASCIA_HEIGHT,
          sz: edge.axis === 'z' ? length : depth,
        };
        if (edge.axis === 'x') {
          transform.x = (start + end) * 0.5;
          transform.z = edge.edge === 'south' ? edge.fixed + depth * 0.5 : edge.fixed - depth * 0.5;
        } else {
          transform.x = edge.edge === 'west' ? edge.fixed + depth * 0.5 : edge.fixed - depth * 0.5;
          transform.z = (start + end) * 0.5;
        }
        transforms.push(transform);
      }
    }
  }
  return transforms;
}

/**
 * Add a masonry stringer below each exposed side of the two main stone stairs.
 *
 * These strips occupy the same side bands as the authored ramp-rail collision
 * volumes, so they reveal existing structure instead of creating a new hidden
 * blocker. The imported timber overlook stair is deliberately excluded: its
 * GLB already supplies its own steps, rails and underside.
 */
export function elevatedRampStringerTransforms(mapDefinition = BRIARHOLD_FIRST_PERSON_MAP) {
  const collisionBySurface = new Map();
  for (const volume of mapDefinition.collisionVolumes ?? []) {
    if (volume.appearance !== 'ramp-rail' || !volume.surfaceId) continue;
    const items = collisionBySurface.get(volume.surfaceId) ?? [];
    items.push(volume);
    collisionBySurface.set(volume.surfaceId, items);
  }

  const transforms = [];
  for (const surface of mapDefinition.walkableSurfaces ?? []) {
    if (surface.kind !== 'ramp' || surface.appearance === 'timber-overlook') continue;
    if (Math.max(Number(surface.startY), Number(surface.endY)) < 7.5) continue;
    const ramp = traversalRampVisualTransform(surface);
    if (!ramp) continue;
    const rails = collisionBySurface.get(surface.id) ?? [];
    const normalOffset = (TRAVERSAL_DECK_THICKNESS + ELEVATED_RAMP_STRINGER_HEIGHT) * 0.5;
    const normalY = Math.cos(ramp.angle) * normalOffset;
    const normalRun = Math.sin(ramp.angle) * normalOffset;
    for (const rail of rails) {
      const centreX = (rail.min.x + rail.max.x) * 0.5;
      const centreZ = (rail.min.z + rail.max.z) * 0.5;
      transforms.push({
        surfaceId: surface.id,
        collisionId: rail.id,
        material: 'stone',
        x: ramp.position.x + (surface.axis === 'x' ? normalRun : 0),
        y: ramp.position.y - normalY,
        z: ramp.position.z + (surface.axis === 'z' ? normalRun : 0),
        sx: surface.axis === 'z'
          ? Math.min(ELEVATED_RAMP_STRINGER_WIDTH, rail.max.x - rail.min.x)
          : ramp.size.width,
        sy: ELEVATED_RAMP_STRINGER_HEIGHT,
        sz: surface.axis === 'z'
          ? ramp.size.depth
          : Math.min(ELEVATED_RAMP_STRINGER_WIDTH, rail.max.z - rail.min.z),
        rx: ramp.rotation.x,
        rz: ramp.rotation.z,
        // Centre the strip on the matching collision rail's narrow axis.
        ...(surface.axis === 'z' ? {x: centreX} : {z: centreZ}),
      });
    }
  }
  return transforms;
}

/**
 * Turn the two smooth logical access ramps into readable masonry stairs.
 *
 * Player grounding still samples the continuous authored ramp, so movement is
 * stable and accessible. These boxes are presentation-only, sit below that
 * surface, and expose horizontal treads instead of one giant roof-like plane.
 */
export function mainRampStairStepTransforms(mapDefinition = BRIARHOLD_FIRST_PERSON_MAP) {
  const transforms = [];
  for (const surface of mapDefinition.walkableSurfaces ?? []) {
    if (surface.kind !== 'ramp' || surface.appearance === 'timber-overlook') continue;
    const rise = Number(surface.endY) - Number(surface.startY);
    if (Math.abs(rise) < 7.5) continue;
    const bounds = traversalSurfaceVisualBounds(surface);
    const underpasses = surface.id === 'west-stair-ramp'
      ? (surface.underpassSurfaceIds
        ?? (surface.underpassSurfaceId ? [surface.underpassSurfaceId] : []))
        .map(id => mapDefinition.walkableSurfaces.find(item => item.id === id))
        .filter(Boolean)
      : [];
    const run = bounds.max[surface.axis] - bounds.min[surface.axis];
    const steps = Math.max(2, Math.ceil(Math.abs(rise) / MAIN_STAIR_TARGET_RISER_HEIGHT));
    const tread = run / steps;
    const signedRise = rise / steps;
    for (let index = 0; index < steps; index += 1) {
      const axisStart = bounds.min[surface.axis] + index * tread;
      // Adjacent presentation treads must meet without overlapping. The
      // previous safety lip made every seam z-fight on mobile GPUs.
      const axisEnd = axisStart + tread;
      // Use the centre of the continuous grounding segment, keeping the
      // presentation within half a riser of the authoritative player height.
      const treadTop = Number(surface.startY) + signedRise * (index + 0.5);
      const stepHeight = treadTop - Math.min(surface.startY, surface.endY);
      const base = {
        surfaceId: surface.id,
        step: index,
        z: surface.axis === 'z' ? (axisStart + axisEnd) * 0.5 : (bounds.min.z + bounds.max.z) * 0.5,
        sz: surface.axis === 'z' ? axisEnd - axisStart : bounds.max.z - bounds.min.z,
      };
      const openIntervals = underpasses
        .filter((underpass) => {
          // Carve the stair against the complete logical route. The postern's
          // decorative floor is deliberately shorter where it overlaps the
          // courtyard, but using those visual floor bounds here left a solid
          // stair face across a valid player passage.
          const routeMin = underpass.extendsToRampEnds
            ? Math.min(underpass.min[surface.axis], surface.min[surface.axis])
            : underpass.min[surface.axis];
          const routeMax = underpass.extendsToRampEnds
            ? Math.max(underpass.max[surface.axis], surface.max[surface.axis])
            : underpass.max[surface.axis];
          return surface.axis === 'z'
            && axisEnd > routeMin
            && axisStart < routeMax
            && treadTop - TRAVERSAL_DECK_THICKNESS >= WEST_POSTERN_MIN_HEADROOM;
        })
        .map(underpass => ({
          min: Math.max(bounds.min.x, underpass.min.x),
          max: Math.min(bounds.max.x, underpass.max.x),
        }))
        .filter(interval => interval.max > interval.min)
        .sort((left, right) => left.min - right.min)
        .reduce((merged, interval) => {
          const previous = merged.at(-1);
          if (previous && interval.min <= previous.max + 1e-9) previous.max = Math.max(previous.max, interval.max);
          else merged.push({...interval});
          return merged;
        }, []);
      if (openIntervals.length > 0) {
        let shoulderStart = bounds.min.x;
        for (const interval of openIntervals) {
          if (interval.min > shoulderStart + 1e-9) {
            transforms.push({
              ...base,
              role: 'solid-step-shoulder',
              x: (shoulderStart + interval.min) * 0.5,
              y: Math.min(surface.startY, surface.endY) + stepHeight * 0.5 - 0.025,
              sx: interval.min - shoulderStart,
              sy: stepHeight + 0.05,
            });
          }
          transforms.push({
            ...base,
            role: 'postern-ceiling',
            x: (interval.min + interval.max) * 0.5,
            y: treadTop - TRAVERSAL_DECK_THICKNESS * 0.5,
            sx: interval.max - interval.min,
            sy: TRAVERSAL_DECK_THICKNESS,
          });
          shoulderStart = Math.max(shoulderStart, interval.max);
        }
        if (shoulderStart < bounds.max.x - 1e-9) {
          transforms.push({
            ...base,
            role: 'solid-step-shoulder',
            x: (shoulderStart + bounds.max.x) * 0.5,
            y: Math.min(surface.startY, surface.endY) + stepHeight * 0.5 - 0.025,
            sx: bounds.max.x - shoulderStart,
            sy: stepHeight + 0.05,
          });
        }
        continue;
      }
      transforms.push({
        ...base,
        role: 'solid-step',
        x: surface.axis === 'x' ? (axisStart + axisEnd) * 0.5 : (bounds.min.x + bounds.max.x) * 0.5,
        y: Math.min(surface.startY, surface.endY) + stepHeight * 0.5 - 0.025,
        sx: surface.axis === 'x' ? axisEnd - axisStart : bounds.max.x - bounds.min.x,
        sy: stepHeight + 0.05,
      });
    }
  }
  return transforms;
}

/**
 * Babylon rotates boxes around their centre. Offset a ramp by the vertical
 * projection of half its thickness so its upper face lands exactly on the
 * authored start/end heights. This prevents the deck from poking above its
 * landings or exposing a large, apparently missing triangle below them.
 */
export function traversalRampVisualTransform(surface, thickness = TRAVERSAL_DECK_THICKNESS) {
  if (!surface || surface.kind !== 'ramp') return null;
  const visualBounds = traversalSurfaceVisualBounds(surface);
  const width = visualBounds.max.x - visualBounds.min.x;
  const depth = visualBounds.max.z - visualBounds.min.z;
  const rise = Number(surface.endY) - Number(surface.startY);
  const run = surface.axis === 'z' ? depth : width;
  if (!(run > 0) || !Number.isFinite(rise)) return null;
  const slopeLength = Math.hypot(run, rise);
  const angle = Math.atan2(rise, run);
  const halfThicknessVertical = Math.cos(angle) * thickness * 0.5;
  return {
    position: {
      x: (visualBounds.min.x + visualBounds.max.x) * 0.5,
      y: (Number(surface.startY) + Number(surface.endY)) * 0.5 - halfThicknessVertical,
      z: (visualBounds.min.z + visualBounds.max.z) * 0.5,
    },
    size: surface.axis === 'z'
      ? {width, height: thickness, depth: slopeLength}
      : {width: slopeLength, height: thickness, depth},
    rotation: surface.axis === 'z'
      ? {x: -angle, z: 0}
      : {x: 0, z: angle},
    angle,
  };
}

function buildFirstPersonTraversal(BABYLON, scene, mats, mapDefinition = BRIARHOLD_FIRST_PERSON_MAP) {
  const meshes = [];
  for (const surface of mapDefinition.walkableSurfaces) {
    const visualBounds = traversalSurfaceVisualBounds(surface);
    const width = visualBounds.max.x - visualBounds.min.x;
    const depth = visualBounds.max.z - visualBounds.min.z;
    const x = (visualBounds.min.x + visualBounds.max.x) * 0.5;
    const z = (visualBounds.min.z + visualBounds.max.z) * 0.5;
    if (!shouldRenderTraversalSurface(surface)) continue;
    if (surface.kind === 'flat') {
      const visualTop = traversalSurfaceVisualTop(surface);
      const deck = addBox(
        BABYLON,
        scene,
        `walkable-${surface.id}`,
        { width, height: TRAVERSAL_DECK_THICKNESS, depth },
        { x, y: visualTop - TRAVERSAL_DECK_THICKNESS * 0.5, z },
        surface.appearance === 'courtyard-stone'
          ? mats.courtyard
          : surface.y > 1 ? mats.stoneDark : mats.path
      );
      markWorldOccluder(deck);
      meshes.push(deck);
      if (surface.appearance === 'timber-overlook') {
        for (const transform of timberOverlookSupportTransforms(mapDefinition, surface.id)) {
          const support = addBox(
            BABYLON,
            scene,
            transform.id,
            transform.size,
            transform.position,
            mats.wood,
          );
          support.metadata = {...support.metadata, collisionId: transform.collisionId};
          markWorldOccluder(support);
          meshes.push(support);
        }
      }
      continue;
    }
    if (surface.appearance !== 'timber-overlook' && Math.abs(Number(surface.endY) - Number(surface.startY)) >= 7.5) {
      // The logical ramp remains authoritative for grounding, but is hidden
      // behind a solid stair silhouette instead of reading as a floating roof.
      continue;
    }
    const rampTransform = traversalRampVisualTransform(surface);
    if (!rampTransform) continue;
    const ramp = addBox(
      BABYLON,
      scene,
      `walkable-${surface.id}`,
      rampTransform.size,
      rampTransform.position,
      mats.stoneDark
    );
    ramp.rotation.x = rampTransform.rotation.x;
    ramp.rotation.z = rampTransform.rotation.z;
    markWorldOccluder(ramp);
    meshes.push(ramp);
  }
  return meshes;
}

function buildElevatedDeckFascia(BABYLON, scene, mats, mapDefinition = BRIARHOLD_FIRST_PERSON_MAP) {
  const transforms = [
    ...elevatedDeckFasciaTransforms(mapDefinition),
    ...elevatedRampStringerTransforms(mapDefinition),
  ];
  const meshes = [];
  for (const material of ['stone', 'wood']) {
    const group = transforms.filter(transform => transform.material === material);
    if (group.length === 0) continue;
    const source = BABYLON.MeshBuilder.CreateBox(`elevated-deck-${material}-fascia-source`, {size: 1}, scene);
    source.material = material === 'wood' ? mats.wood : mats.stoneDark;
    source.isPickable = false;
    source.receiveShadows = true;
    source.thinInstanceSetBuffer('matrix', composeMatrices(BABYLON, group), 16, true);
    source.thinInstanceRefreshBoundingInfo?.(true);
    markWorldOccluder(source);
    meshes.push(source);
  }
  const stairSteps = mainRampStairStepTransforms(mapDefinition);
  if (stairSteps.length > 0) {
    const source = BABYLON.MeshBuilder.CreateBox('main-masonry-stair-source', {size: 1}, scene);
    source.material = mats.stoneDark;
    source.isPickable = false;
    source.receiveShadows = true;
    source.thinInstanceSetBuffer('matrix', composeMatrices(BABYLON, stairSteps), 16, true);
    source.thinInstanceRefreshBoundingInfo?.(true);
    markWorldOccluder(source);
    meshes.push(source);
  }
  return meshes;
}

/**
 * Render timber posts directly from their authoritative collision volumes.
 * The earlier inferred corner posts drifted from these volumes as the overlook
 * was lowered, leaving invisible blockers beside separate non-solid posts.
 */
export function timberOverlookSupportTransforms(mapDefinition = BRIARHOLD_FIRST_PERSON_MAP, surfaceId = '') {
  const prefix = `support-${surfaceId}-`;
  return (mapDefinition.collisionVolumes ?? [])
    .filter(volume => volume.id.startsWith(prefix))
    .map(volume => ({
      id: `visible-${volume.id}`,
      collisionId: volume.id,
      size: {
        width: volume.max.x - volume.min.x,
        height: volume.max.y - volume.min.y,
        depth: volume.max.z - volume.min.z,
      },
      position: {
        x: (volume.min.x + volume.max.x) * 0.5,
        y: (volume.min.y + volume.max.y) * 0.5,
        z: (volume.min.z + volume.max.z) * 0.5,
      },
    }));
}

export const BRIAR_FENCE_POST_THICKNESS = 0.3;
export const BRIAR_FENCE_RAIL_THICKNESS = 0.2;

export function briarFencePostTransforms(mapDefinition = BRIARHOLD_FIRST_PERSON_MAP) {
  const transforms = [];
  for (const volume of mapDefinition.collisionVolumes ?? []) {
    if (volume.appearance !== 'briar-fence') continue;
    const width = volume.max.x - volume.min.x;
    const height = volume.max.y - volume.min.y;
    const depth = volume.max.z - volume.min.z;
    if (!(width > 0 && height > 0 && depth > 0)) continue;
    const longAxis = width >= depth ? 'x' : 'z';
    const length = Math.max(width, depth);
    const count = Math.max(2, Math.ceil(length / 5));
    const sx = Math.min(BRIAR_FENCE_POST_THICKNESS, width);
    const sz = Math.min(BRIAR_FENCE_POST_THICKNESS, depth);
    const start = volume.min[longAxis] + (longAxis === 'x' ? sx : sz) * 0.5;
    const end = volume.max[longAxis] - (longAxis === 'x' ? sx : sz) * 0.5;
    for (let index = 0; index <= count; index += 1) {
      const amount = index / count;
      transforms.push({
        collisionId: volume.id,
        x: longAxis === 'x'
          ? start + (end - start) * amount
          : (volume.min.x + volume.max.x) * 0.5,
        y: volume.min.y + height * 0.5,
        z: longAxis === 'z'
          ? start + (end - start) * amount
          : (volume.min.z + volume.max.z) * 0.5,
        sx,
        sy: height,
        sz,
      });
    }
  }
  return transforms;
}

export function briarFenceRailTransforms(mapDefinition = BRIARHOLD_FIRST_PERSON_MAP) {
  const transforms = [];
  for (const volume of mapDefinition.collisionVolumes ?? []) {
    if (volume.appearance !== 'briar-fence') continue;
    const width = volume.max.x - volume.min.x;
    const height = volume.max.y - volume.min.y;
    const depth = volume.max.z - volume.min.z;
    if (!(width > 0 && height > 0 && depth > 0)) continue;
    const longAxis = width >= depth ? 'x' : 'z';
    for (const heightRatio of [0.36, 0.7]) {
      transforms.push({
        collisionId: volume.id,
        x: (volume.min.x + volume.max.x) * 0.5,
        y: volume.min.y + height * heightRatio,
        z: (volume.min.z + volume.max.z) * 0.5,
        sx: longAxis === 'x' ? width : Math.min(BRIAR_FENCE_RAIL_THICKNESS, width),
        sy: Math.min(BRIAR_FENCE_RAIL_THICKNESS, height),
        sz: longAxis === 'z' ? depth : Math.min(BRIAR_FENCE_RAIL_THICKNESS, depth),
      });
    }
  }
  return transforms;
}

function buildTraversalBarriers(
  BABYLON,
  scene,
  mats,
  mapDefinition = BRIARHOLD_FIRST_PERSON_MAP,
  lowSpec = false,
) {
  const meshes = [];
  for (const volume of mapDefinition.collisionVolumes ?? []) {
    if (!['stone-parapet', 'briar-fence', 'ramp-rail', 'defender-cache', 'defender-brazier', 'service-arcade'].includes(volume.appearance)) continue;
    const width = volume.max.x - volume.min.x;
    const height = volume.max.y - volume.min.y;
    const depth = volume.max.z - volume.min.z;
    const position = {
      x: (volume.min.x + volume.max.x) * 0.5,
      y: (volume.min.y + volume.max.y) * 0.5,
      z: (volume.min.z + volume.max.z) * 0.5,
    };
    if (volume.appearance === 'ramp-rail') {
      const surface = mapDefinition.walkableSurfaces.find(item => item.id === volume.surfaceId);
      if (!surface || surface.kind !== 'ramp') continue;
      const surfaceRun = surface.max[surface.axis] - surface.min[surface.axis];
      const alongStart = Math.max(surface.min[surface.axis], volume.min[surface.axis]);
      const alongEnd = Math.min(surface.max[surface.axis], volume.max[surface.axis]);
      const startAmount = (alongStart - surface.min[surface.axis]) / surfaceRun;
      const endAmount = (alongEnd - surface.min[surface.axis]) / surfaceRun;
      const startY = surface.startY + (surface.endY - surface.startY) * startAmount;
      const endY = surface.startY + (surface.endY - surface.startY) * endAmount;
      const run = alongEnd - alongStart;
      const rise = endY - startY;
      const railHeight = 0.9;
      const rail = addBox(
        BABYLON,
        scene,
        `traversal-barrier-${volume.id}`,
        surface.axis === 'z'
          ? {width, height: railHeight, depth: Math.hypot(run, rise)}
          : {width: Math.hypot(run, rise), height: railHeight, depth},
        {
          x: surface.axis === 'x' ? (alongStart + alongEnd) * 0.5 : position.x,
          y: (startY + endY) * 0.5 + railHeight * 0.5,
          z: surface.axis === 'z' ? (alongStart + alongEnd) * 0.5 : position.z,
        },
        mats.stoneDark,
      );
      if (surface.axis === 'z') rail.rotation.x = -Math.atan2(rise, run);
      else rail.rotation.z = Math.atan2(rise, run);
      markWorldOccluder(rail);
      meshes.push(rail);
      continue;
    }
    if (volume.appearance === 'defender-cache') {
      const fallback = addBox(
        BABYLON,
        scene,
        `defender-cache-fallback-${volume.id}`,
        {width, height, depth},
        position,
        mats.wood,
      );
      markWorldOccluder(fallback);
      meshes.push(fallback);
      continue;
    }
    if (volume.appearance === 'defender-brazier') {
      // The collision volume is intentionally larger than the brazier so both
      // the player capsule and the enemy horde flow around it.  Rendering that
      // volume produced the conspicuous green cubes seen beside the loaded
      // Meshy props.  Keep collision authoritative in the map definition and
      // use a small recognisable fallback only while the GLB is loading.
      const stand = BABYLON.MeshBuilder.CreateCylinder(
        `defender-brazier-fallback-${volume.id}-stand`,
        {height: 0.64, diameterTop: 0.46, diameterBottom: 0.7, tessellation: 10},
        scene,
      );
      stand.position.set(position.x, volume.min.y + 0.32, position.z);
      stand.material = mats.metal;
      const bowl = BABYLON.MeshBuilder.CreateCylinder(
        `defender-brazier-fallback-${volume.id}-bowl`,
        {height: 0.5, diameterTop: 1.18, diameterBottom: 0.72, tessellation: 12},
        scene,
      );
      bowl.position.set(position.x, volume.min.y + 0.82, position.z);
      bowl.material = mats.metal;
      for (const mesh of [stand, bowl]) {
        markWorldOccluder(mesh);
        meshes.push(mesh);
      }
      continue;
    }
    if (volume.appearance === 'service-arcade') {
      // Keep a visible, collision-matched dark timber stall while the authored
      // GLB loads.  It is atomically hidden once the Meshy arcade is ready.
      const fallback = addBox(
        BABYLON,
        scene,
        `service-arcade-fallback-${volume.id}`,
        {width, height, depth},
        position,
        mats.wood,
      );
      markWorldOccluder(fallback);
      meshes.push(fallback);
      continue;
    }
    if (volume.appearance === 'briar-fence') {
      // Logical collision remains the complete authored volume, but a solid
      // green cuboid reads as a placeholder wall.  The visible boundary is
      // built below as one dark timber post/rail thin-instance batch.
      continue;
    }
    const barrier = addBox(
      BABYLON,
      scene,
      `traversal-barrier-${volume.id}`,
      {width, height, depth},
      position,
      volume.appearance === 'stone-parapet' ? mats.stoneDark : mats.leaves,
    );
    markWorldOccluder(barrier);
    meshes.push(barrier);

  }
  const fenceTransforms = [
    ...briarFenceRailTransforms(mapDefinition),
    ...(lowSpec ? [] : briarFencePostTransforms(mapDefinition)),
  ];
  if (fenceTransforms.length > 0) {
    const post = BABYLON.MeshBuilder.CreateBox('traversal-briar-fence-source', {size: 1}, scene);
    post.material = mats.wood;
    post.receiveShadows = true;
    post.isPickable = false;
    post.thinInstanceSetBuffer('matrix', composeMatrices(BABYLON, fenceTransforms), 16, true);
    post.thinInstanceRefreshBoundingInfo?.(true);
    meshes.push(post);
  }
  return meshes;
}

function composeMatrices(BABYLON, transforms) {
  const matrices = new Float32Array(transforms.length * 16);
  transforms.forEach((item, index) => {
    BABYLON.Matrix.Compose(
      new BABYLON.Vector3(item.sx ?? 1, item.sy ?? 1, item.sz ?? 1),
      BABYLON.Quaternion.RotationYawPitchRoll(item.ry ?? 0, item.rx ?? 0, item.rz ?? 0),
      new BABYLON.Vector3(item.x ?? 0, item.y ?? 0, item.z ?? 0)
    ).copyToArray(matrices, index * 16);
  });
  return matrices;
}

export const FOREST_FORTRESS_CLEARING = Object.freeze({
  minX: -52,
  maxX: 52,
  minZ: -28,
  maxZ: 22
});

export function isForestScatterAllowed(xValue, zValue) {
  const x = Number(xValue);
  const z = Number(zValue);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const insideFortressClearing = x >= FOREST_FORTRESS_CLEARING.minX
    && x <= FOREST_FORTRESS_CLEARING.maxX
    && z >= FOREST_FORTRESS_CLEARING.minZ
    && z <= FOREST_FORTRESS_CLEARING.maxZ;
  if (insideFortressClearing) return false;
  const westLane = Math.abs(x + 16) < 8.8;
  const eastLane = Math.abs(x - 16) < 8.8;
  return !westLane && !eastLane && !(Math.abs(x) < 8 && z > 0);
}

function buildHubRepairPresentation(BABYLON, scene, mats) {
  const source = (name, materialInstance, transforms) => {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, {size: 1}, scene);
    mesh.material = materialInstance;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    mesh.thinInstanceSetBuffer('matrix', composeMatrices(BABYLON, transforms), 16, true);
    mesh.thinInstanceRefreshBoundingInfo?.(true);
    mesh.setEnabled(false);
    return mesh;
  };

  const outerDamaged = source('hub-outer-bracing-damaged', mats.wood, [
    {x: -20.75, y: 0.42, z: -0.66, sx: 1.55, sy: 0.28, sz: 0.28, rz: 0.18},
    {x: -11.25, y: 0.38, z: -0.66, sx: 1.4, sy: 0.28, sz: 0.28, rz: -0.22},
  ]);
  const outerRepaired = source('hub-outer-bracing-repaired', mats.woodLight, [
    {x: -16, y: 2.9, z: -0.82, sx: 0.38, sy: 7.2, sz: 0.32, rz: 0.72},
    {x: -16, y: 2.9, z: -0.84, sx: 0.38, sy: 7.2, sz: 0.32, rz: -0.72},
  ]);
  const heartDamaged = source('hub-heart-masonry-damaged', mats.stoneDark, [
    {x: -4.75, y: 0.26, z: -17.21, sx: 1.2, sy: 0.42, sz: 0.22, ry: 0.08},
    {x: 4.72, y: 0.22, z: -17.21, sx: 1.15, sy: 0.36, sz: 0.22, ry: -0.1},
  ]);
  const heartRepaired = source('hub-heart-masonry-repaired', mats.stone, [
    ...[-4.82, 4.82].flatMap(x => [0.42, 1.02, 1.62].map((y, index) => ({
      x: x + (index % 2 ? 0.1 : -0.06),
      y,
      z: -17.21,
      sx: 1.15,
      sy: 0.48,
      sz: 0.22,
    }))),
  ]);
  const storesClosed = source('hub-quartermaster-stores-closed', mats.wood, [
    {x: 4.72, y: 0.34, z: -15.72, sx: 1.05, sy: 0.65, sz: 0.82},
    {x: 5.58, y: 0.25, z: -15.75, sx: 0.58, sy: 0.48, sz: 0.62, ry: 0.08},
  ]);
  const storesReady = source('hub-quartermaster-stores-ready', mats.woodLight, [
    {x: 4.55, y: 0.34, z: -15.72, sx: 0.95, sy: 0.65, sz: 0.78},
    {x: 5.5, y: 0.3, z: -15.75, sx: 0.72, sy: 0.56, sz: 0.7, ry: 0.06},
    {x: 4.95, y: 0.84, z: -15.74, sx: 0.62, sy: 0.38, sz: 0.58, ry: -0.08},
    {x: 6.02, y: 0.18, z: -15.8, sx: 0.28, sy: 0.34, sz: 0.42},
  ]);

  const variants = {
    outerDamaged,
    outerRepaired,
    heartDamaged,
    heartRepaired,
    storesClosed,
    storesReady,
  };
  let activeState = resolveHubPresentationState();
  function apply(state) {
    activeState = state;
    const enabled = state.worldVisible;
    outerDamaged.setEnabled(enabled && state.outerGateBracing === 'damaged');
    outerRepaired.setEnabled(enabled && state.outerGateBracing === 'repaired');
    heartDamaged.setEnabled(enabled && state.heartGateMasonry === 'damaged');
    heartRepaired.setEnabled(enabled && state.heartGateMasonry === 'repaired');
    storesClosed.setEnabled(enabled && state.quartermasterStores === 'closed');
    storesReady.setEnabled(enabled && state.quartermasterStores === 'ready');
    return state;
  }
  return {
    variants,
    apply,
    diagnostics: () => ({
      state: {...activeState, activeNpcs: [...activeState.activeNpcs]},
      enabledVariants: Object.entries(variants).filter(([, mesh]) => mesh.isEnabled()).map(([name]) => name),
      draws: Object.values(variants).filter(mesh => mesh.isEnabled()).length,
      lights: 0,
    }),
  };
}

export const MESHY_FOREST_TREE_ASSET = 'assets/meshy/runtime/briarhold-forest-tree-512.glb';
export const FOREST_TREE_SIZE = Object.freeze({width: 5.2, height: 9, depth: 5.2});
export const FOREST_TREE_TRUNK_RADIUS = 0.48;
export const FOREST_TREE_BANDS = Object.freeze({
  west: Object.freeze({x: -51.72, minZ: 23, maxZ: 115}),
  east: Object.freeze({x: 51.72, minZ: 23, maxZ: 115}),
  north: Object.freeze({z: HOST_EMERGENCE_PROFILE.treeLineZ, minX: -49, maxX: 49}),
});

function forestBandCounts(treeCount) {
  if (treeCount === 190) return {west: 72, east: 72, north: 46};
  if (treeCount === 72) return {west: 27, east: 27, north: 18};
  const west = Math.floor(treeCount * 72 / 190);
  const east = Math.floor(treeCount * 72 / 190);
  return {west, east, north: Math.max(0, treeCount - west - east)};
}

export function forestTreeTransforms(treeCount = 190) {
  const count = Math.max(0, Math.floor(Number(treeCount) || 0));
  const counts = forestBandCounts(count);
  const transforms = [];
  const appendBand = (band, bandCount) => {
    const profile = FOREST_TREE_BANDS[band];
    for (let index = 0; index < bandCount; index += 1) {
      const globalIndex = transforms.length;
      const amount = bandCount <= 1 ? 0.5 : index / (bandCount - 1);
      const lateralJitter = Math.sin((globalIndex + 1) * 12.9898) * 0.08;
      const alongJitter = Math.sin((globalIndex + 1) * 78.233) * 0.38;
      const scale = 0.78 + ((globalIndex * 37) % 39) / 100;
      let x = band === 'north'
        ? clamp(profile.minX + amount * (profile.maxX - profile.minX) + alongJitter, profile.minX, profile.maxX)
        : profile.x + lateralJitter;
      // Keep a real forest wall while cutting one authored western road gap.
      // Trees that would occupy the lane are deterministically wrapped to the
      // two flanks, preserving the exact batch count and draw budget.
      if (band === 'north' && Math.abs(x - HOST_EMERGENCE_PROFILE.laneCenterX) < HOST_EMERGENCE_PROFILE.treeLaneHalfWidth) {
        const side = index % 2 === 0 ? -1 : 1;
        x = HOST_EMERGENCE_PROFILE.laneCenterX
          + side * (HOST_EMERGENCE_PROFILE.treeLaneHalfWidth + 1.8 + (index % 3) * 1.25);
      }
      const z = band === 'north'
        ? profile.z + Math.abs(lateralJitter) + (index % 3) * 4.2
        : clamp(profile.minZ + amount * (profile.maxZ - profile.minZ) + alongJitter, profile.minZ, profile.maxZ);
      transforms.push({
        band,
        x,
        y: -0.04,
        z,
        ry: (globalIndex * 2.399963229728653) % (Math.PI * 2),
        sx: scale,
        sy: scale,
        sz: scale,
      });
    }
  };
  appendBand('west', counts.west);
  appendBand('east', counts.east);
  appendBand('north', counts.north);
  return transforms;
}

function applyRegularInstanceTransform(mesh, transform) {
  mesh.position.set(transform.x, transform.y, transform.z);
  mesh.scaling.set(transform.sx, transform.sy, transform.sz);
  mesh.rotationQuaternion = null;
  mesh.rotation.set(0, transform.ry, 0);
}

/**
 * Static dressing uses Babylon hardware instances rather than thin-instance
 * matrix buffers. The source itself owns the first authored transform, so an
 * identity-source presentation is structurally impossible while a graphics
 * context is warming. Remaining members share geometry and material.
 */
export function createRegularInstanceBatch(source, transforms, options = {}) {
  const name = options.name || source.name || 'forest-tree';
  const authored = Array.isArray(transforms) ? transforms : [];
  const instances = [];
  source.setEnabled(false);
  if (authored.length > 0) {
    applyRegularInstanceTransform(source, authored[0]);
    for (let index = 1; index < authored.length; index += 1) {
      const instance = source.createInstance(`${name}-${index}`);
      applyRegularInstanceTransform(instance, authored[index]);
      instances.push(instance);
    }
  }
  const members = authored.length > 0 ? [source, ...instances] : [];
  const batch = {
    source,
    instances,
    count: authored.length,
    setEnabled(enabled) {
      for (const member of members) member.setEnabled(enabled);
    },
    dispose() {
      for (const instance of instances) instance.dispose();
      source.dispose(false, false);
    },
  };
  batch.setEnabled(options.enabled !== false);
  return batch;
}

export function createForestInstanceBatch(source, transforms, options = {}) {
  return createRegularInstanceBatch(source, transforms, options);
}

function buildForest(BABYLON, scene, mats, treeCount = 190) {
  const transforms = forestTreeTransforms(treeCount);
  const trunk = BABYLON.MeshBuilder.CreateCylinder('forest-trunk-source', {
    height: 5,
    diameterTop: 0.42,
    diameterBottom: 0.82,
    tessellation: 7
  }, scene);
  trunk.material = mats.wood;
  const crown = BABYLON.MeshBuilder.CreatePolyhedron('forest-crown-source', {
    type: 2,
    size: 2.5
  }, scene);
  crown.material = mats.leaves;
  const trunkBatch = createForestInstanceBatch(trunk, transforms.map(transform => ({
    ...transform,
    y: transform.y + 2.5 * transform.sx,
  })), {name: 'forest-trunk'});
  const crownBatch = createForestInstanceBatch(crown, transforms.map(transform => ({
    ...transform,
    y: transform.y + 6.1 * transform.sx,
    sx: transform.sx * 1.04,
    sz: transform.sz * 1.04,
  })), {name: 'forest-crown'});
  trunk.isPickable = crown.isPickable = false;
  return {trunk: trunkBatch, crown: crownBatch, transforms, count: transforms.length};
}

function buildPortcullisGate(BABYLON, scene, mats, x) {
  const root = new BABYLON.Mesh('west-gate', scene);
  root.position.set(x, 3.5, -1.35);
  for (let index = -3; index <= 3; index += 1) {
    const bar = addBox(
      BABYLON,
      scene,
      `west-gate-portcullis-bar-${index + 3}`,
      {width: 0.38, height: 7, depth: 0.42},
      {x: index * 1.3, y: 0, z: 0},
      mats.metal,
    );
    bar.parent = root;
  }
  for (const y of [-2.15, 0, 2.15]) {
    const brace = addBox(
      BABYLON,
      scene,
      `west-gate-portcullis-brace-${y}`,
      {width: 8.3, height: 0.34, depth: 0.48},
      {x: 0, y, z: 0},
      mats.metal,
    );
    brace.parent = root;
  }
  return root;
}

export const HEART_GATE_VISUAL = Object.freeze({
  width: 11,
  height: 8,
  depth: 1.5,
  plankCount: 11,
  strapCount: 3,
  stileCount: 3,
  drawSources: 3,
});

function buildHeartGate(BABYLON, scene, mats) {
  const root = new BABYLON.Mesh('heart-gate', scene);
  root.position.set(0, 4, -18);
  const heartMetal = mats.metal.clone('heart-gate-metal-mat');

  // The run-ending gate must read as a built defensive door, not a single
  // fog-coloured box. Narrow, slightly inset planks retain the exact logical
  // collision envelope while giving the timber texture enough edges and
  // shadow breaks to remain legible from the courtyard.
  const source = (name, materialInstance, transforms) => {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, {size: 1}, scene);
    mesh.material = materialInstance;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    mesh.parent = root;
    mesh.thinInstanceSetBuffer('matrix', composeMatrices(BABYLON, transforms), 16, true);
    mesh.thinInstanceRefreshBoundingInfo?.(true);
    return mesh;
  };
  source('heart-gate-plank-source', mats.heart, Array.from({length: HEART_GATE_VISUAL.plankCount}, (_, itemIndex) => {
    const index = itemIndex - 5;
    return {x: index * 0.96, y: 0, z: index % 2 === 0 ? 0.03 : -0.03, sx: 0.91, sy: 7.55, sz: 0.46};
  }));
  source('heart-gate-strap-source', heartMetal, [-2.45, 0, 2.45].map(y => (
    {x: 0, y, z: -0.3, sx: 10.35, sy: 0.24, sz: 0.56}
  )));
  source('heart-gate-stile-source', heartMetal, [-5.05, 0, 5.05].map(x => (
    {x, y: 0, z: -0.31, sx: 0.3, sy: 7.8, sz: 0.58}
  )));
  return root;
}

// These remain authoritative colliders, but their visible masonry is already
// owned by the procedural stair shoulders. Rendering castle bodies too would
// duplicate the same volume and reintroduce z-fighting.
export const STAIR_OWNED_CASTLE_COLLISION_IDS = Object.freeze([
  'west-postern-jamb-west',
  'west-postern-jamb-east',
]);

export const VISIBLE_CASTLE_COLLISION_IDS = Object.freeze([
  'west-curtain-a',
  'west-battlement-support-inner',
  'west-stair-east-abutment',
  'centre-curtain',
  'east-stair-west-abutment',
  'east-stair-east-abutment',
  'east-gate-east-abutment',
  'east-curtain',
  'west-tower',
  'inner-west-tower',
  'east-tower',
  'west-gate-pier',
  'west-gate-pier-east',
  'field-gate-arch-west',
  'field-gate-arch-east',
  'field-gate-arch-lintel',
  'field-gate-wing-west',
  'field-gate-wing-east',
  'field-gate-tower-west',
  'field-gate-tower-east',
  'west-overlook-flank-tower',
  'east-overlook-flank-tower',
  'inner-keep',
  'keep-crown'
]);

export const MESHY_FORTRESS_WALL_ASSET = 'assets/meshy/runtime/briarhold-wall-bay-512.glb';
export const MESHY_FORTRESS_WALL_COLLISION_IDS = Object.freeze([
  'centre-curtain',
  'east-curtain',
  'field-gate-wing-west',
  'field-gate-wing-east',
]);
export const MESHY_KEEP_CROWN_WALL_COLLISION_ID = 'keep-crown';
export const MESHY_INNER_KEEP_WALL_COLLISION_ID = 'inner-keep';
export const FORTRESS_WALL_BAY_SIZE = Object.freeze({width: 8, height: 8, depth: 2});
export const MESHY_FORTRESS_WATCHTOWER_ASSET = 'assets/meshy/runtime/briarhold-watchtower-512.glb';
export const MESHY_FIRING_GALLERY_FLANK_TOWER_COLLISION_IDS = Object.freeze([
  'west-overlook-flank-tower',
  'east-overlook-flank-tower',
]);
export const MESHY_FORTRESS_WATCHTOWER_COLLISION_IDS = Object.freeze([
  'west-tower',
  'inner-west-tower',
  'east-tower',
  'field-gate-tower-west',
  'field-gate-tower-east',
  ...MESHY_FIRING_GALLERY_FLANK_TOWER_COLLISION_IDS,
]);
export const FORTRESS_WATCHTOWER_SIZE = Object.freeze({width: 7, height: 12, depth: 7});
export const MESHY_FORTRESS_GATE_ARCH_ASSET = 'assets/meshy/runtime/briarhold-west-gatehouse-512.glb';
export const FORTRESS_GATE_ARCH_SIZE = Object.freeze({width: 12, height: 9.5, depth: 3});
export const MESHY_RAMPART_STAIR_ASSET = 'assets/meshy/runtime/briarhold-rampart-stair-512.glb';
export const RAMPART_STAIR_SIZE = Object.freeze({width: 4.8, height: 4.5, depth: 8.8});
export const RAMPART_STAIR_SURFACE_ID = 'west-gate-overlook-descent';
export const RAMPART_STAIR_TRANSFORM = Object.freeze({
  x: -16,
  y: 3.5,
  z: 12.8,
  ry: 0,
});
export const MESHY_BALLISTA_ASSET = 'assets/meshy/runtime/briarhold-ballista-512.glb';
export const MESHY_BALLISTA_SIZE = Object.freeze({width: 4.8, height: 3.2, depth: 4.6});
// The Blender derivative is bottom-centred. This offset aligns its bolt channel
// with the existing socket-forward convention used by procedural defences.
export const MESHY_BALLISTA_YAW_OFFSET = Math.PI * 0.5;
export const MESHY_DEFENDER_CACHE_ASSET = 'assets/meshy/runtime/briarhold-defender-cache-512.glb';
export const MESHY_DEFENDER_CACHE_SIZE = Object.freeze({width: 4.6, height: 3.2, depth: 3.2});
export const MESHY_DEFENDER_CACHE_MATERIAL_TUNING = Object.freeze({
  directIntensity: 1.35,
  albedoMultiplier: Object.freeze([1.18, 1.1, 0.98]),
  emissiveMultiplier: Object.freeze([1, 0.55, 0.18]),
});
export const DEFENDER_CACHE_COLLISION_IDS = Object.freeze([
  'defender-cache-overlook-west',
  'defender-cache-overlook-east',
  'defender-cache-field-west',
  'defender-cache-field-east',
  'defender-cache-gate-west',
  'defender-cache-gate-east',
  'defender-cache-west-battlement',
  'defender-cache-east-battlement',
  'defender-cache-courtyard-rear',
  'defender-cache-courtyard-west',
]);
export const MESHY_BRAZIER_ASSET = 'assets/meshy/runtime/briarhold-brazier-512.glb';
export const MESHY_BRAZIER_SIZE = Object.freeze({width: 1.4, height: 1.55, depth: 1.4});
export const MESHY_BRAZIER_MATERIAL_TUNING = Object.freeze({
  directIntensity: 1.6,
  albedoMultiplier: Object.freeze([1.16, 1.08, 0.94]),
  emissiveLift: Object.freeze([0.11, 0.045, 0.012]),
});
export const BRAZIER_PLACEMENTS = Object.freeze([
  Object.freeze({role: 'overlook-west', hostCollisionId: 'parapet-west-overlook-north-left', x: -20.4, y: 4.38, z: 21.85, scale: 0.68}),
  Object.freeze({role: 'overlook-east', hostCollisionId: 'parapet-west-overlook-north-right', x: -11.6, y: 4.38, z: 21.85, scale: 0.68}),
  Object.freeze({role: 'field-west', collisionId: 'defender-brazier-field-near', x: -24.4, y: 0.03, z: 29.5, scale: 1}),
  // A right-third mid-ground fire reveals host depth without blocking the
  // centre aiming lane. Mesh, flame, physical light and enemy obstacle all
  // share this authored collision-backed placement.
  Object.freeze({role: 'field-east', collisionId: 'defender-brazier-field-far', x: -8.5, y: 0.03, z: 35, scale: 1.55}),
]);
export const FIELD_EAST_BRAZIER = BRAZIER_PLACEMENTS.find(({role}) => role === 'field-east');
export const DEFENDER_BRAZIER_COLLISION_IDS = Object.freeze(
  BRAZIER_PLACEMENTS
    .map(placement => placement.collisionId)
    .filter(Boolean),
);

export function brazierTransforms() {
  return BRAZIER_PLACEMENTS.map((placement, index) => ({
    ...placement,
    ry: index % 2 === 0 ? 0 : Math.PI,
    sx: placement.scale,
    sy: placement.scale,
    sz: placement.scale,
  }));
}
export const FORTRESS_GATE_ARCH_COLLISION_IDS = Object.freeze([
  'west-gate-pier',
  'west-gate-pier-east',
  'field-gate-arch-west',
  'field-gate-arch-east',
  'field-gate-arch-lintel',
]);
export const FORTRESS_GATE_ARCH_TRANSFORM = Object.freeze({
  x: WORLD_COORDINATES.westGate.x,
  y: 0,
  z: -2.85,
  sx: 1,
  sy: 1,
  sz: 1,
});
export const FIELD_GATE_ARCH_TRANSFORM = Object.freeze({
  x: WORLD_COORDINATES.westGate.x,
  y: 0,
  z: 46,
  sx: 2.4,
  sy: 1.3,
  sz: 1.4,
});
export const MESHY_GATE_MATERIAL_TUNING = Object.freeze({
  metallic: 0,
  roughness: 0.82,
  directIntensity: 1.25,
  // Keep the imported fieldstone in the fortress' cool charcoal family.
  // Authored torch lights supply the warm pools; lifting the red base channel
  // makes both arches read as flat honey-brown landmarks in first person.
  albedoMultiplier: Object.freeze([0.78, 0.84, 0.82]),
  ambientLift: Object.freeze([0.018, 0.021, 0.019]),
});
export const MESHY_FORTRESS_MATERIAL_TUNING = Object.freeze({
  metallic: 0,
  roughness: 0.9,
  directIntensity: 1.12,
  albedoMultiplier: Object.freeze([1.0, 1.04, 1.06]),
});
export const PROCEDURAL_FORTRESS_MATERIAL_TUNING = Object.freeze({
  metallic: MESHY_FORTRESS_MATERIAL_TUNING.metallic,
  roughness: MESHY_FORTRESS_MATERIAL_TUNING.roughness,
  directIntensity: MESHY_FORTRESS_MATERIAL_TUNING.directIntensity,
});
export const INNER_KEEP_FLANK_TOWER_WIDTH = 6.5;
export const INNER_KEEP_FLANK_TOWER_PROFILES = Object.freeze([
  Object.freeze({role: 'keep-flank-west', height: 15, zOffset: -1.25}),
  Object.freeze({role: 'keep-flank-east', height: 13.5, zOffset: 1.25}),
]);
export const MESHY_PROCEDURAL_TOP_CLEARANCE = 0.06;
export const MESHY_SKINNED_COLLISION_IDS = Object.freeze([
  ...MESHY_FORTRESS_WALL_COLLISION_IDS,
  ...MESHY_FORTRESS_WATCHTOWER_COLLISION_IDS,
  ...FORTRESS_GATE_ARCH_COLLISION_IDS,
  'inner-keep',
  MESHY_KEEP_CROWN_WALL_COLLISION_ID,
]);

export function fortressGateArchTransform() {
  return {...FORTRESS_GATE_ARCH_TRANSFORM};
}

export function fortressGateArchTransforms() {
  return [
    {...FORTRESS_GATE_ARCH_TRANSFORM},
    {...FIELD_GATE_ARCH_TRANSFORM},
  ];
}

export function defenderCacheTransforms(mapDefinition = BRIARHOLD_FIRST_PERSON_MAP) {
  return DEFENDER_CACHE_COLLISION_IDS.flatMap((collisionId, index) => {
    const volume = mapDefinition.collisionVolumes.find(item => item.id === collisionId);
    if (!volume || volume.appearance !== 'defender-cache') return [];
    const width = volume.max.x - volume.min.x;
    const height = volume.max.y - volume.min.y;
    const depth = volume.max.z - volume.min.z;
    return [{
      collisionId,
      x: (volume.min.x + volume.max.x) * 0.5,
      y: volume.min.y,
      z: (volume.min.z + volume.max.z) * 0.5,
      sx: width / MESHY_DEFENDER_CACHE_SIZE.width,
      sy: height / MESHY_DEFENDER_CACHE_SIZE.height,
      sz: depth / MESHY_DEFENDER_CACHE_SIZE.depth,
      ry: index % 2 === 0 ? 0 : Math.PI,
    }];
  });
}

/**
 * Repeat the authored wall bay across both visible faces while keeping every
 * textured triangle inside a collision-backed curtain. The procedural body
 * remains behind it as a solid fallback and distance fill.
 */
export function fortressWallBayTransforms(mapDefinition = BRIARHOLD_FIRST_PERSON_MAP) {
  const transforms = [];
  for (const collisionId of MESHY_FORTRESS_WALL_COLLISION_IDS) {
    const volume = mapDefinition.collisionVolumes.find(item => item.id === collisionId);
    if (!volume) continue;
    const width = volume.max.x - volume.min.x;
    const height = volume.max.y - volume.min.y;
    const depth = volume.max.z - volume.min.z;
    if (!(width > 0 && height > 0 && depth >= FORTRESS_WALL_BAY_SIZE.depth * 2)) continue;
    const bayCount = Math.max(1, Math.ceil(width / FORTRESS_WALL_BAY_SIZE.width));
    const bayWidth = width / bayCount;
    for (let index = 0; index < bayCount; index += 1) {
      const x = volume.min.x + bayWidth * (index + 0.5);
      for (const face of ['outer', 'inner']) {
        transforms.push({
          collisionId,
          face,
          x,
          // The prepared GLB has a bottom-centred origin. Its instance
          // translation is therefore the collider floor, not its centre.
          y: volume.min.y,
          z: face === 'outer'
            ? volume.max.z - FORTRESS_WALL_BAY_SIZE.depth * 0.5
            : volume.min.z + FORTRESS_WALL_BAY_SIZE.depth * 0.5,
          sx: bayWidth / FORTRESS_WALL_BAY_SIZE.width,
          sy: height / FORTRESS_WALL_BAY_SIZE.height,
          sz: 1,
          ry: face === 'outer' ? 0 : Math.PI,
        });
      }
    }
  }

  // The courtyard-facing body of the keep used to remain one enormous dark
  // procedural box. Dress all four collision-backed faces with the same
  // authored wall bay so turning inward retains the masonry, buttresses and
  // moss language of the outer hold without adding another material/draw.
  const keep = mapDefinition.collisionVolumes.find(
    item => item.id === MESHY_INNER_KEEP_WALL_COLLISION_ID,
  );
  if (keep) {
    const width = keep.max.x - keep.min.x;
    const height = keep.max.y - keep.min.y;
    const depth = keep.max.z - keep.min.z;
    const frontBayCount = Math.max(1, Math.ceil(width / FORTRESS_WALL_BAY_SIZE.width));
    const frontBayWidth = width / frontBayCount;
    for (let index = 0; index < frontBayCount; index += 1) {
      const x = keep.min.x + frontBayWidth * (index + 0.5);
      for (const face of ['courtyard', 'rear']) {
        transforms.push({
          collisionId: keep.id,
          face,
          role: 'inner-keep-wall',
          x,
          y: keep.min.y,
          z: face === 'courtyard'
            ? keep.max.z - FORTRESS_WALL_BAY_SIZE.depth * 0.5
            : keep.min.z + FORTRESS_WALL_BAY_SIZE.depth * 0.5,
          sx: frontBayWidth / FORTRESS_WALL_BAY_SIZE.width,
          sy: height / FORTRESS_WALL_BAY_SIZE.height,
          sz: 1,
          ry: face === 'courtyard' ? 0 : Math.PI,
        });
      }
    }
    const sideBayCount = Math.max(1, Math.ceil(depth / FORTRESS_WALL_BAY_SIZE.width));
    const sideBayWidth = depth / sideBayCount;
    for (let index = 0; index < sideBayCount; index += 1) {
      const z = keep.min.z + sideBayWidth * (index + 0.5);
      for (const side of [-1, 1]) {
        transforms.push({
          collisionId: keep.id,
          face: side < 0 ? 'west-side' : 'east-side',
          role: 'inner-keep-wall-side',
          x: side < 0
            ? keep.min.x + FORTRESS_WALL_BAY_SIZE.depth * 0.5
            : keep.max.x - FORTRESS_WALL_BAY_SIZE.depth * 0.5,
          y: keep.min.y,
          z,
          sx: sideBayWidth / FORTRESS_WALL_BAY_SIZE.width,
          sy: height / FORTRESS_WALL_BAY_SIZE.height,
          sz: 1,
          ry: side < 0 ? -Math.PI * 0.5 : Math.PI * 0.5,
        });
      }
    }
  }

  const crown = mapDefinition.collisionVolumes.find(
    item => item.id === MESHY_KEEP_CROWN_WALL_COLLISION_ID,
  );
  if (crown) {
    const width = crown.max.x - crown.min.x;
    const height = crown.max.y - crown.min.y;
    const depth = crown.max.z - crown.min.z;
    if (width > 0 && height > 0 && depth >= FORTRESS_WALL_BAY_SIZE.depth * 2) {
      const bayCount = 2;
      const bayWidth = width / bayCount;
      for (let index = 0; index < bayCount; index += 1) {
        const x = crown.min.x + bayWidth * (index + 0.5);
        for (const face of ['outer', 'inner']) {
          transforms.push({
            collisionId: crown.id,
            face,
            role: 'keep-crown',
            x,
            y: crown.min.y,
            z: face === 'outer'
              ? crown.max.z - FORTRESS_WALL_BAY_SIZE.depth * 0.5
              : crown.min.z + FORTRESS_WALL_BAY_SIZE.depth * 0.5,
            sx: bayWidth / FORTRESS_WALL_BAY_SIZE.width,
            sy: height / FORTRESS_WALL_BAY_SIZE.height,
            sz: 1,
            ry: face === 'outer' ? 0 : Math.PI,
          });
        }
      }
      // Reuse the same wall-bay source around the crown sides. The two extra
      // thin instances add oblique silhouette depth without a new draw call or
      // any geometry outside the authored keep-crown collision.
      for (const side of [-1, 1]) {
        transforms.push({
          collisionId: crown.id,
          face: side < 0 ? 'west-side' : 'east-side',
          role: 'keep-crown-side',
          x: side < 0
            ? crown.min.x + FORTRESS_WALL_BAY_SIZE.depth * 0.5
            : crown.max.x - FORTRESS_WALL_BAY_SIZE.depth * 0.5,
          y: crown.min.y,
          z: (crown.min.z + crown.max.z) * 0.5,
          sx: depth / FORTRESS_WALL_BAY_SIZE.width,
          sy: height / FORTRESS_WALL_BAY_SIZE.height,
          sz: 1,
          ry: side < 0 ? -Math.PI * 0.5 : Math.PI * 0.5,
        });
      }
    }
  }
  return transforms;
}

export function fortressWatchtowerTransforms(mapDefinition = BRIARHOLD_FIRST_PERSON_MAP) {
  const transforms = [];
  for (const collisionId of MESHY_FORTRESS_WATCHTOWER_COLLISION_IDS) {
    const volume = mapDefinition.collisionVolumes.find(item => item.id === collisionId);
    if (!volume) continue;
    const width = volume.max.x - volume.min.x;
    const height = volume.max.y - volume.min.y;
    const depth = volume.max.z - volume.min.z;
    if (!(width > 0 && height > 0 && depth > 0)) continue;
    transforms.push({
      collisionId,
      role: MESHY_FIRING_GALLERY_FLANK_TOWER_COLLISION_IDS.includes(collisionId)
        ? 'firing-gallery-flank'
        : 'curtain-tower',
      x: (volume.min.x + volume.max.x) * 0.5,
      // Watchtowers share the same bottom-centred preparation contract.
      y: volume.min.y,
      z: (volume.min.z + volume.max.z) * 0.5,
      sx: width / FORTRESS_WATCHTOWER_SIZE.width,
      sy: height / FORTRESS_WATCHTOWER_SIZE.height,
      sz: depth / FORTRESS_WATCHTOWER_SIZE.depth,
    });
  }

  const keep = mapDefinition.collisionVolumes.find(item => item.id === 'inner-keep');
  if (keep) {
    const depth = keep.max.z - keep.min.z;
    const halfWidth = INNER_KEEP_FLANK_TOWER_WIDTH * 0.5;
    const centreZ = (keep.min.z + keep.max.z) * 0.5;
    for (let index = 0; index < INNER_KEEP_FLANK_TOWER_PROFILES.length; index += 1) {
      const profile = INNER_KEEP_FLANK_TOWER_PROFILES[index];
      const side = index === 0 ? -1 : 1;
      transforms.push({
        collisionId: keep.id,
        role: profile.role,
        x: side < 0 ? keep.min.x + halfWidth : keep.max.x - halfWidth,
        y: keep.min.y,
        z: centreZ + profile.zOffset,
        sx: INNER_KEEP_FLANK_TOWER_WIDTH / FORTRESS_WATCHTOWER_SIZE.width,
        sy: profile.height / FORTRESS_WATCHTOWER_SIZE.height,
        sz: Math.min(FORTRESS_WATCHTOWER_SIZE.depth, depth) / FORTRESS_WATCHTOWER_SIZE.depth,
      });
    }
  }
  return transforms;
}

export const CASTLE_FACADE_TRIM_DEPTH = 0.36;

/**
 * Dark stone bands add readable depth without inventing new collision. Every
 * transform is wholly contained by the collision volume named on the record.
 */
export function collisionBackedCastleTrimTransforms(
  mapDefinition = BRIARHOLD_FIRST_PERSON_MAP,
) {
  const transforms = [];
  for (const collisionId of VISIBLE_CASTLE_COLLISION_IDS) {
    if (MESHY_SKINNED_COLLISION_IDS.includes(collisionId)) continue;
    const volume = mapDefinition.collisionVolumes.find(item => item.id === collisionId);
    if (!volume) continue;
    const width = volume.max.x - volume.min.x;
    const height = volume.max.y - volume.min.y;
    const depth = volume.max.z - volume.min.z;
    // Even a narrow stair abutment needs the same visible stone contract as
    // its collider. Scaling the existing columns is preferable to leaving a
    // plain slit (or skipping the mesh entirely) between larger wall pieces.
    if (!(width > 0 && height > 1 && depth > 0.4)) continue;

    const trimDepth = Math.min(CASTLE_FACADE_TRIM_DEPTH, depth * 0.5);
    const trimWidth = Math.min(0.72, width * 0.32);
    const trimHeight = Math.max(0.8, height - 0.56);
    const trimY = volume.min.y + 0.28 + trimHeight * 0.5;
    const columns = Math.max(1, Math.min(6, Math.ceil(width / 5.5)));
    for (let index = 0; index < columns; index += 1) {
      const amount = columns === 1 ? 0.5 : index / (columns - 1);
      const x = volume.min.x + trimWidth * 0.5
        + amount * Math.max(0, width - trimWidth);
      transforms.push({
        kind: 'column',
        collisionId,
        x,
        y: trimY,
        z: volume.max.z - trimDepth * 0.5,
        sx: trimWidth,
        sy: trimHeight,
        sz: trimDepth,
      });
      transforms.push({
        kind: 'column',
        collisionId,
        x,
        y: trimY,
        z: volume.min.z + trimDepth * 0.5,
        sx: trimWidth,
        sy: trimHeight,
        sz: trimDepth,
      });
    }

    const bandHeight = Math.min(0.34, height * 0.1);
    const bandY = Math.min(
      volume.max.y - bandHeight * 0.5,
      volume.min.y + height * 0.72,
    );
    const bandFaceInset = Math.min(0.04, trimDepth * 0.2);
    const bandDepth = Math.max(0.08, trimDepth - bandFaceInset * 2);
    for (const z of [
      volume.min.z + bandFaceInset + bandDepth * 0.5,
      volume.max.z - bandFaceInset - bandDepth * 0.5,
    ]) {
      transforms.push({
        kind: 'band',
        collisionId,
        x: (volume.min.x + volume.max.x) * 0.5,
        y: bandY,
        z,
        sx: width,
        sy: bandHeight,
        sz: bandDepth,
      });
    }
  }
  return transforms;
}

function buildThinInstancedMeshyAsset(BABYLON, scene, assetPath, transforms, sourceName) {
  const state = {status: 'loading', instances: 0, meshes: 0, error: null};
  const assetUrl = new URL(`../${assetPath}`, import.meta.url);
  const slash = assetUrl.href.lastIndexOf('/') + 1;
  const rootUrl = assetUrl.href.slice(0, slash);
  const fileName = assetUrl.href.slice(slash);
  const ready = BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene)
    .then(result => {
      const source = result.meshes
        .filter(mesh => typeof mesh.getTotalVertices === 'function')
        .sort((left, right) => right.getTotalVertices() - left.getTotalVertices())[0];
      if (!source || source.getTotalVertices() < 100) {
        throw new Error(`${sourceName} did not contain usable geometry`);
      }

      source.computeWorldMatrix(true);
      const bakedWorld = source.getWorldMatrix().clone();
      source.parent = null;
      source.bakeTransformIntoVertices(bakedWorld);
      source.position.setAll(0);
      source.scaling.setAll(1);
      source.rotation.setAll(0);
      source.rotationQuaternion = null;
      source.name = sourceName;
      const collisionBacked = sourceName === 'meshy-fortress-gate-arch-source'
        || sourceName === 'meshy-defender-cache-source'
        || sourceName === 'meshy-brazier-source'
        || sourceName === 'meshy-courtyard-service-arcade-source';
      source.isPickable = collisionBacked;
      source.thinInstanceEnablePicking = collisionBacked;
      if (collisionBacked) source.metadata = {worldOccluder: true, collisionBacked: true};
      source.receiveShadows = true;
      if (source.material) source.material.maxSimultaneousLights = MAX_WORLD_LIGHTS_PER_MATERIAL;
      if ((sourceName === 'meshy-fortress-wall-bay-source'
        || sourceName === 'meshy-fortress-watchtower-source') && source.material) {
        const tuning = MESHY_FORTRESS_MATERIAL_TUNING;
        if ('metallic' in source.material) source.material.metallic = tuning.metallic;
        if ('roughness' in source.material) source.material.roughness = tuning.roughness;
        if ('directIntensity' in source.material) source.material.directIntensity = tuning.directIntensity;
        source.material.albedoColor?.set?.(...tuning.albedoMultiplier);
      }
      if (sourceName === 'meshy-fortress-gate-arch-source' && source.material) {
        const tuning = MESHY_GATE_MATERIAL_TUNING;
        if ('metallic' in source.material) source.material.metallic = tuning.metallic;
        if ('roughness' in source.material) source.material.roughness = tuning.roughness;
        if ('directIntensity' in source.material) source.material.directIntensity = tuning.directIntensity;
        source.material.albedoColor?.set?.(...tuning.albedoMultiplier);
        source.material.emissiveColor?.set?.(...tuning.ambientLift);
      }
      if (sourceName === 'meshy-defender-cache-source' && source.material) {
        const tuning = MESHY_DEFENDER_CACHE_MATERIAL_TUNING;
        if ('directIntensity' in source.material) source.material.directIntensity = tuning.directIntensity;
        source.material.albedoColor?.set?.(...tuning.albedoMultiplier);
        source.material.emissiveColor?.set?.(...tuning.emissiveMultiplier);
      }
      if (sourceName === 'meshy-brazier-source' && source.material) {
        const tuning = MESHY_BRAZIER_MATERIAL_TUNING;
        if ('directIntensity' in source.material) source.material.directIntensity = tuning.directIntensity;
        source.material.albedoColor?.set?.(...tuning.albedoMultiplier);
        source.material.emissiveColor?.set?.(...tuning.emissiveLift);
      }
      if (sourceName === 'meshy-hub-wave-bell-source' && source.material) {
        if ('metallic' in source.material) source.material.metallic = 0.42;
        if ('roughness' in source.material) source.material.roughness = 0.72;
        if ('directIntensity' in source.material) source.material.directIntensity = 1.12;
        source.material.albedoColor?.set?.(0.72, 0.76, 0.68);
        source.material.backFaceCulling = true;
      }
      if (sourceName === 'meshy-courtyard-service-arcade-source' && source.material) {
        if ('metallic' in source.material) source.material.metallic = 0;
        if ('roughness' in source.material) source.material.roughness = 0.9;
        if ('directIntensity' in source.material) source.material.directIntensity = 1.15;
        source.material.albedoColor?.set?.(0.82, 0.86, 0.8);
        source.material.backFaceCulling = true;
      }
      source.thinInstanceSetBuffer('matrix', composeMatrices(BABYLON, transforms), 16, true);
      source.thinInstanceRefreshBoundingInfo?.(true);

      for (const mesh of result.meshes) {
        if (mesh !== source) mesh.dispose(false, false);
      }
      state.status = 'ready';
      state.instances = transforms.length;
      state.meshes = 1;
      return source;
    })
    .catch(error => {
      state.status = 'fallback';
      state.error = String(error?.message || error);
      return null;
    });
  return {ready, state};
}

function buildMeshyFortressWall(BABYLON, scene, mobileTextures = false) {
  return buildThinInstancedMeshyAsset(
    BABYLON,
    scene,
    runtimeWorldAsset(MESHY_FORTRESS_WALL_ASSET, mobileTextures),
    fortressWallBayTransforms(),
    'meshy-fortress-wall-bay-source',
  );
}

function buildMeshyFortressWatchtowers(BABYLON, scene, mobileTextures = false) {
  return buildThinInstancedMeshyAsset(
    BABYLON,
    scene,
    runtimeWorldAsset(MESHY_FORTRESS_WATCHTOWER_ASSET, mobileTextures),
    fortressWatchtowerTransforms(),
    'meshy-fortress-watchtower-source',
  );
}

function buildMeshyFortressGateArch(BABYLON, scene, mobileTextures = false) {
  return buildThinInstancedMeshyAsset(
    BABYLON,
    scene,
    runtimeWorldAsset(MESHY_FORTRESS_GATE_ARCH_ASSET, mobileTextures),
    fortressGateArchTransforms(),
    'meshy-fortress-gate-arch-source',
  );
}

function buildMeshyDefenderCaches(BABYLON, scene, mobileTextures = false) {
  return buildThinInstancedMeshyAsset(
    BABYLON,
    scene,
    runtimeWorldAsset(MESHY_DEFENDER_CACHE_ASSET, mobileTextures),
    defenderCacheTransforms(),
    'meshy-defender-cache-source',
  );
}

function buildMeshyBraziers(BABYLON, scene, mobileTextures = false) {
  return buildThinInstancedMeshyAsset(
    BABYLON,
    scene,
    runtimeWorldAsset(MESHY_BRAZIER_ASSET, mobileTextures),
    brazierTransforms(),
    'meshy-brazier-source',
  );
}

function buildMeshyHubWaveBell(BABYLON, scene, mobileTextures = false) {
  const placement = HUB_LANDMARK_PLACEMENTS.bell;
  return buildThinInstancedMeshyAsset(
    BABYLON,
    scene,
    runtimeWorldAsset(MESHY_HUB_WAVE_BELL_ASSET, mobileTextures),
    [{x: placement.x, y: placement.y, z: placement.z, ry: placement.facing}],
    'meshy-hub-wave-bell-source',
  );
}

function buildMeshyCourtyardServiceArcades(BABYLON, scene, mobileTextures = false) {
  return buildThinInstancedMeshyAsset(
    BABYLON,
    scene,
    runtimeWorldAsset(MESHY_COURTYARD_SERVICE_ARCADE_ASSET, mobileTextures),
    COURTYARD_SERVICE_ARCADE_TRANSFORMS,
    'meshy-courtyard-service-arcade-source',
  );
}

function buildMeshyForest(BABYLON, scene, proceduralForest, mobileTextures = false) {
  const state = {status: 'loading', instances: 0, meshes: 0, batches: 0, error: null};
  const assetUrl = new URL(`../${runtimeWorldAsset(MESHY_FOREST_TREE_ASSET, mobileTextures)}`, import.meta.url);
  const slash = assetUrl.href.lastIndexOf('/') + 1;
  const rootUrl = assetUrl.href.slice(0, slash);
  const fileName = assetUrl.href.slice(slash);
  const ready = BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene)
    .then(result => {
      const source = result.meshes
        .filter(mesh => typeof mesh.getTotalVertices === 'function')
        .sort((left, right) => right.getTotalVertices() - left.getTotalVertices())[0];
      if (!source || source.getTotalVertices() < 100) {
        throw new Error('Meshy forest tree did not contain usable geometry');
      }

      source.computeWorldMatrix(true);
      const bakedWorld = source.getWorldMatrix().clone();
      source.parent = null;
      source.bakeTransformIntoVertices(bakedWorld);
      source.position.setAll(0);
      source.scaling.setAll(1);
      source.rotation.setAll(0);
      source.rotationQuaternion = null;
      source.isPickable = false;
      source.receiveShadows = true;
      if (source.material) {
        source.material.maxSimultaneousLights = MAX_WORLD_LIGHTS_PER_MATERIAL;
        if ('directIntensity' in source.material) source.material.directIntensity = 1.18;
        source.material.albedoColor?.set?.(0.78, 0.84, 0.76);
        source.material.backFaceCulling = true;
      }

      const bands = ['west', 'east', 'north'];
      const batchSources = bands.map((band, index) => {
        const batchSource = index === 0 ? source : source.clone(`meshy-forest-tree-${band}-source`, null, true);
        if (!batchSource) throw new Error(`Meshy forest ${band} batch could not be cloned`);
        batchSource.name = `meshy-forest-tree-${band}-source`;
        return batchSource;
      });
      const batches = bands.map((band, index) => {
        const transforms = proceduralForest.transforms.filter(transform => transform.band === band);
        return createForestInstanceBatch(batchSources[index], transforms, {
          name: `meshy-forest-tree-${band}`,
          enabled: false,
        });
      });

      for (const mesh of result.meshes) {
        if (mesh !== source) mesh.dispose(false, false);
      }

      // The swap is deliberately synchronous: no frame can contain both the
      // old procedural blobs and the imported tree geometry.
      proceduralForest.trunk.setEnabled(false);
      proceduralForest.crown.setEnabled(false);
      batches.forEach(batch => batch.setEnabled(true));
      proceduralForest.trunk.dispose();
      proceduralForest.crown.dispose();
      state.status = 'ready';
      state.instances = proceduralForest.transforms.length;
      state.meshes = batches.length;
      state.batches = batches.length;
      return batches;
    })
    .catch(error => {
      state.status = 'fallback';
      state.error = String(error?.message || error);
      return [];
    });
  return {ready, state};
}

function buildMeshyBattlefieldVerge(BABYLON, scene, mobileTextures = false) {
  const state = {status: 'loading', instances: 0, meshes: 0, batches: 0, error: null};
  const assetUrl = new URL(`../${runtimeWorldAsset(MESHY_BATTLEFIELD_VERGE_ASSET, mobileTextures)}`, import.meta.url);
  const slash = assetUrl.href.lastIndexOf('/') + 1;
  const rootUrl = assetUrl.href.slice(0, slash);
  const fileName = assetUrl.href.slice(slash);
  const ready = BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene)
    .then(result => {
      const source = result.meshes
        .filter(mesh => typeof mesh.getTotalVertices === 'function')
        .sort((left, right) => right.getTotalVertices() - left.getTotalVertices())[0];
      if (!source || source.getTotalVertices() < 100) {
        throw new Error('Meshy battlefield verge did not contain usable geometry');
      }

      source.computeWorldMatrix(true);
      const bakedWorld = source.getWorldMatrix().clone();
      source.parent = null;
      source.bakeTransformIntoVertices(bakedWorld);
      source.position.setAll(0);
      source.scaling.setAll(1);
      source.rotation.setAll(0);
      source.rotationQuaternion = null;
      source.isPickable = false;
      source.receiveShadows = true;
      if (source.material) {
        source.material.maxSimultaneousLights = MAX_WORLD_LIGHTS_PER_MATERIAL;
        if ('metallic' in source.material) source.material.metallic = 0;
        if ('roughness' in source.material) source.material.roughness = 0.94;
        if ('directIntensity' in source.material) source.material.directIntensity = 0.92;
        source.material.backFaceCulling = true;
      }

      const transforms = battlefieldVergeTransforms();
      const groups = [...new Set(transforms.map(transform => transform.group))];
      const sources = groups.map((group, index) => {
        const groupSource = index === 0 ? source : source.clone(`meshy-battlefield-verge-${group}-source`, null, true);
        if (!groupSource) throw new Error(`Meshy battlefield verge ${group} batch could not be cloned`);
        groupSource.name = `meshy-battlefield-verge-${group}-source`;
        return groupSource;
      });
      const batches = groups.map((group, index) => createRegularInstanceBatch(
        sources[index],
        transforms.filter(transform => transform.group === group),
        {name: `meshy-battlefield-verge-${group}`},
      ));

      for (const mesh of result.meshes) {
        if (mesh !== source) mesh.dispose(false, false);
      }
      state.status = 'ready';
      state.instances = transforms.length;
      state.meshes = batches.length;
      state.batches = batches.length;
      return batches;
    })
    .catch(error => {
      state.status = 'fallback';
      state.error = String(error?.message || error);
      return [];
    });
  return {ready, state};
}

export function suppressLoadedDefenderCacheFallbacks(meshes, loadedCache) {
  if (!loadedCache) return 0;
  let suppressed = 0;
  for (const mesh of meshes ?? []) {
    if (!String(mesh?.name ?? '').startsWith('defender-cache-fallback-')) continue;
    mesh.setEnabled?.(false);
    suppressed += 1;
  }
  return suppressed;
}

export function suppressLoadedServiceArcadeFallbacks(meshes, loadedArcades) {
  if (!loadedArcades) return 0;
  let suppressed = 0;
  for (const mesh of meshes ?? []) {
    if (!String(mesh?.name ?? '').startsWith('service-arcade-fallback-')) continue;
    mesh.setEnabled?.(false);
    suppressed += 1;
  }
  return suppressed;
}

export function suppressLoadedBrazierFallbacks(meshes, loadedBraziers) {
  if (!loadedBraziers) return 0;
  const collisionIds = new Set(DEFENDER_BRAZIER_COLLISION_IDS);
  let suppressed = 0;
  for (const mesh of meshes ?? []) {
    const match = /^defender-brazier-fallback-(.+)-(?:stand|bowl)$/u.exec(String(mesh?.name ?? ''));
    if (!match || !collisionIds.has(match[1])) continue;
    mesh.setEnabled?.(false);
    suppressed += 1;
  }
  return suppressed;
}

function buildMeshyBallistaTemplate(BABYLON, scene, mats, mobileTextures = false) {
  const state = {status: 'loading', instances: 0, meshes: 0, error: null};
  let source = null;
  const assetUrl = new URL(`../${runtimeWorldAsset(MESHY_BALLISTA_ASSET, mobileTextures)}`, import.meta.url);
  const slash = assetUrl.href.lastIndexOf('/') + 1;
  const rootUrl = assetUrl.href.slice(0, slash);
  const fileName = assetUrl.href.slice(slash);
  const ready = BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene)
    .then(result => {
      source = result.meshes
        .filter(mesh => typeof mesh.getTotalVertices === 'function')
        .sort((left, right) => right.getTotalVertices() - left.getTotalVertices())[0];
      if (!source || source.getTotalVertices() < 100) {
        throw new Error('Meshy ballista did not contain usable geometry');
      }
      source.computeWorldMatrix(true);
      const bakedWorld = source.getWorldMatrix().clone();
      source.parent = null;
      source.bakeTransformIntoVertices(bakedWorld);
      source.position.setAll(0);
      source.scaling.setAll(1);
      source.rotation.setAll(0);
      source.rotationQuaternion = null;
      source.name = 'meshy-ballista-template';
      source.isPickable = false;
      source.receiveShadows = true;
      if (source.material) {
        source.material.maxSimultaneousLights = MAX_WORLD_LIGHTS_PER_MATERIAL;
        if ('roughness' in source.material) source.material.roughness = 0.72;
        if ('directIntensity' in source.material) source.material.directIntensity = 1.28;
      }
      source.setEnabled(false);
      for (const mesh of result.meshes) {
        if (mesh !== source) mesh.dispose(false, false);
      }
      state.status = 'ready';
      state.meshes = 1;
      return source;
    })
    .catch(error => {
      state.status = 'fallback';
      state.error = String(error?.message || error);
      source = null;
      return null;
    });

  function createInstance(name, socket, {preview = false} = {}) {
    if (!source || state.status !== 'ready') return null;
    const mesh = source.clone(name, null, false);
    if (!mesh) return null;
    mesh.setEnabled(true);
    mesh.position.set(socket.x, socket.y, socket.z);
    mesh.rotationQuaternion = null;
    mesh.rotation.set(0, socket.facing - MESHY_BALLISTA_YAW_OFFSET, 0);
    mesh.scaling.setAll(1);
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.visibility = preview ? 0.86 : 1;
    if (preview) mesh.material = mats.preview;
    mesh.metadata = {fortification: 'ballista', meshy: true, preview};
    state.instances += 1;
    return mesh;
  }

  return {ready, state, createInstance};
}

function buildMeshyFieldDefenceTemplates(BABYLON, scene, mats, mobileTextures = false) {
  const state = {
    status: 'loading',
    templates: 0,
    instances: 0,
    meshes: 0,
    error: null,
    byType: Object.fromEntries(
      Object.keys(MESHY_FIELD_DEFENCE_ASSETS).map(type => [type, {status: 'loading'}]),
    ),
  };
  const templates = new Map();

  const loads = Object.entries(MESHY_FIELD_DEFENCE_ASSETS).map(async ([type, path]) => {
    const assetUrl = new URL(`../${runtimeWorldAsset(path, mobileTextures)}`, import.meta.url);
    const slash = assetUrl.href.lastIndexOf('/') + 1;
    const rootUrl = assetUrl.href.slice(0, slash);
    const fileName = assetUrl.href.slice(slash);
    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene);
      const source = result.meshes
        .filter(mesh => typeof mesh.getTotalVertices === 'function')
        .sort((left, right) => right.getTotalVertices() - left.getTotalVertices())[0];
      if (!source || source.getTotalVertices() < 100) {
        throw new Error(`${type} did not contain usable geometry`);
      }
      source.computeWorldMatrix(true);
      const bakedWorld = source.getWorldMatrix().clone();
      source.parent = null;
      source.bakeTransformIntoVertices(bakedWorld);
      source.position.setAll(0);
      source.scaling.setAll(1);
      source.rotation.setAll(0);
      source.rotationQuaternion = null;
      source.name = `meshy-${type}-template`;
      source.isPickable = false;
      source.receiveShadows = true;
      if (source.material) {
        source.material.maxSimultaneousLights = MAX_WORLD_LIGHTS_PER_MATERIAL;
        if ('roughness' in source.material) source.material.roughness = Math.max(0.62, source.material.roughness ?? 0.72);
        if ('directIntensity' in source.material) source.material.directIntensity = 1.16;
        if ('environmentIntensity' in source.material) source.material.environmentIntensity = 0.72;
        if ('albedoColor' in source.material) {
          const tone = type === 'firePot' ? 0.72 : type === 'wardLantern' ? 0.66 : 0.62;
          source.material.albedoColor = source.material.albedoColor.scale(tone);
        }
      }
      source.setEnabled(false);
      for (const mesh of result.meshes) {
        if (mesh !== source) mesh.dispose(false, false);
      }
      templates.set(type, source);
      state.byType[type] = {status: 'ready', vertices: source.getTotalVertices()};
      state.templates = templates.size;
      state.meshes = templates.size;
      return source;
    } catch (error) {
      const message = String(error?.message || error);
      state.byType[type] = {status: 'fallback', error: message};
      return null;
    }
  });

  const ready = Promise.all(loads).then(results => {
    const failures = Object.entries(state.byType)
      .filter(([, value]) => value.status !== 'ready')
      .map(([type]) => type);
    state.status = failures.length === 0 ? 'ready' : templates.size > 0 ? 'partial' : 'fallback';
    state.error = failures.length > 0 ? `Fallback retained for ${failures.join(', ')}` : null;
    return results.filter(Boolean);
  });

  function createInstance(type, name, socket, {preview = false} = {}) {
    const source = templates.get(type);
    if (!source || state.byType[type]?.status !== 'ready') return null;
    const mesh = source.clone(name, null, false);
    if (!mesh) return null;
    mesh.setEnabled(true);
    mesh.position.set(socket.x, socket.y, socket.z);
    mesh.rotationQuaternion = null;
    mesh.rotation.set(0, socket.facing, 0);
    mesh.scaling.setAll(1);
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.visibility = preview ? 0.74 : 1;
    if (preview) mesh.material = mats.preview;
    mesh.metadata = {fortification: type, meshy: true, fieldDefence: true, preview};
    state.instances += 1;
    return mesh;
  }

  function releaseInstance(mesh) {
    if (!mesh?.metadata?.fieldDefence) return false;
    state.instances = Math.max(0, state.instances - 1);
    return true;
  }

  return {ready, state, createInstance, releaseInstance};
}

function buildCollisionBackedCastleTrim(BABYLON, scene, mats) {
  const trim = BABYLON.MeshBuilder.CreateBox('collision-backed-facade-trim-source', {
    size: 1,
  }, scene);
  trim.material = mats.stoneDark;
  trim.isPickable = false;
  const transforms = collisionBackedCastleTrimTransforms();
  if (transforms.length > 0) {
    trim.thinInstanceSetBuffer('matrix', composeMatrices(BABYLON, transforms), 16, true);
  } else {
    trim.setEnabled(false);
  }
  return {mesh: trim, count: transforms.length};
}

export function collisionBackedCastleBodyBox(volume) {
  if (!volume?.min || !volume?.max) return null;
  const width = volume.max.x - volume.min.x;
  const depth = volume.max.z - volume.min.z;
  const height = volume.max.y - volume.min.y;
  if (!(width > 0 && depth > 0 && height > 0)) return null;
  const insetDepth = Math.min(CASTLE_FACADE_TRIM_DEPTH, depth * 0.5);
  const topClearance = MESHY_SKINNED_COLLISION_IDS.includes(volume.id)
    ? Math.min(MESHY_PROCEDURAL_TOP_CLEARANCE, height * 0.1)
    : 0;
  const bodyHeight = height - topClearance;
  return {
    size: {
      width,
      height: bodyHeight,
      depth: Math.max(Math.min(0.2, depth), depth - insetDepth),
    },
    position: {
      x: (volume.min.x + volume.max.x) * 0.5,
      y: volume.min.y + bodyHeight * 0.5,
      z: (volume.min.z + volume.max.z) * 0.5,
    },
    topClearance,
  };
}

function buildCastle(BABYLON, scene, mats) {
  const wallParts = [];
  for (const id of VISIBLE_CASTLE_COLLISION_IDS) {
    const volume = BRIARHOLD_FIRST_PERSON_MAP.collisionVolumes.find(item => item.id === id);
    if (!volume) continue;
    const body = collisionBackedCastleBodyBox(volume);
    if (!body) continue;
    const mesh = addBox(
      BABYLON,
      scene,
      `collision-backed-${id}`,
      body.size,
      body.position,
      id === 'inner-keep' || id === 'keep-crown' || id.includes('overlook-flank-tower')
        ? mats.stoneDark
        : mats.stone,
    );
    mesh.metadata = {...mesh.metadata, collisionId: id, proceduralCastleFallback: true};
    markWorldOccluder(mesh);
    wallParts.push(mesh);
  }
  const gates = {
    west: buildPortcullisGate(BABYLON, scene, mats, -16),
    east: addBox(BABYLON, scene, 'east-gate', { width: 9, height: 7, depth: 1.3 }, { x: 16, y: 3.5, z: -1.35 }, mats.gate),
    heart: buildHeartGate(BABYLON, scene, mats),
  };
  return { gates, wallParts };
}

export function suppressLoadedGateArchFallbacks(wallParts, loadedGateArch) {
  if (!loadedGateArch) return 0;
  let suppressed = 0;
  for (const mesh of wallParts ?? []) {
    if (!FORTRESS_GATE_ARCH_COLLISION_IDS.includes(mesh?.metadata?.collisionId)) continue;
    mesh.setEnabled?.(false);
    suppressed += 1;
  }
  return suppressed;
}

// The procedural castle boxes are useful while an authored Meshy facade is
// loading, but leaving both visible produces z-fighting and oversized blocks
// at the gatehouse corners.  Once the matching instanced asset is ready, hide
// only the fallback bodies backed by that asset's collision IDs.
export function suppressLoadedCastleFallbacks(wallParts, loadedAsset, collisionIds) {
  if (!loadedAsset || !Array.isArray(collisionIds)) return 0;
  const ids = new Set(collisionIds);
  let suppressed = 0;
  for (const mesh of wallParts ?? []) {
    if (!ids.has(mesh?.metadata?.collisionId)) continue;
    mesh.setEnabled?.(false);
    suppressed += 1;
  }
  return suppressed;
}

export const PRIMARY_APPROACH_X = -16;
export const SECONDARY_APPROACH_X = 16;
export const ROAD_STONE_COLUMNS = Object.freeze([-2.55, 0, 2.55]);
export const HOST_ROAD_VISUAL = Object.freeze({
  centerX: PRIMARY_APPROACH_X,
  // The stone kill-zone apron already owns the foreground. Beginning just
  // beyond it avoids a second surface competing for the same pixels and lets
  // the worn road read as the army's route out of the forest.
  minZ: KILLZONE_APRON.maxZ + 0.1,
  maxZ: HOST_EMERGENCE_PROFILE.roadVisualMaxZ,
  y: 0.055,
  segments: 18,
  nearHalfWidth: 6.2,
  farHalfWidth: 13.5,
  edgeJitter: 0.72,
});

export function hostRoadRibbonPoints(segments = HOST_ROAD_VISUAL.segments) {
  const count = Math.max(3, Math.floor(Number(segments) || HOST_ROAD_VISUAL.segments));
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const progress = index / count;
    const z = HOST_ROAD_VISUAL.minZ
      + (HOST_ROAD_VISUAL.maxZ - HOST_ROAD_VISUAL.minZ) * progress;
    const halfWidth = HOST_ROAD_VISUAL.nearHalfWidth
      + (HOST_ROAD_VISUAL.farHalfWidth - HOST_ROAD_VISUAL.nearHalfWidth) * progress;
    const jitterScale = HOST_ROAD_VISUAL.edgeJitter * (0.35 + progress * 0.65);
    const leftJitter = Math.sin(index * 1.73 + 0.45) * jitterScale;
    const rightJitter = Math.cos(index * 1.41 + 0.9) * jitterScale;
    points.push(Object.freeze({
      z,
      y: HOST_ROAD_VISUAL.y,
      leftX: HOST_ROAD_VISUAL.centerX - halfWidth + leftJitter,
      rightX: HOST_ROAD_VISUAL.centerX + halfWidth + rightJitter,
    }));
  }
  return points;
}

export function roadToGateStoneTransforms(stoneRows = 58) {
  const rows = Math.max(2, Math.floor(Number(stoneRows) || 2));
  const transforms = [];
  for (let row = 0; row < rows; row += 1) {
    const z = 3 + row * (109 / Math.max(1, rows - 1));
    for (let column = 0; column < ROAD_STONE_COLUMNS.length; column += 1) {
      // Leave deterministic gaps so the old road reads as scattered repairs,
      // not three mechanically perfect dotted lines.
      if ((row + column * 2) % 3 === 1) continue;
      const irregular = Math.sin((row + 1) * (column + 2) * 1.713);
      transforms.push({
        role: 'primary',
        x: PRIMARY_APPROACH_X + ROAD_STONE_COLUMNS[column] + irregular * 0.34,
        y: 0.07,
        // Deliberately stagger each broken flagstone along the road. Keeping
        // every column on one cross-row made the approach read as railway
        // sleepers from the firing gallery instead of old, repaired paving.
        z: z + (column - 1) * 0.82 + Math.cos(row * 1.17 + column * 1.91) * 0.46,
        ry: irregular * 0.58,
        sx: 0.54 + ((row + column) % 5) * 0.075,
        sz: 0.48 + ((row * 2 + column) % 4) * 0.09,
      });
    }

    // The unused eastern approach stays legible as an old secondary track,
    // while three quarters of the stone budget pulls the eye to the West Gate.
    if (row % 3 === 0) {
      transforms.push({
        role: 'secondary',
        x: SECONDARY_APPROACH_X + (row % 2 ? -2.35 : 2.35),
        y: 0.065,
        z: z + Math.sin(row * 1.17) * 0.35,
        ry: Math.sin(row * 0.81) * 0.38,
        sx: 0.7 + (row % 4) * 0.08,
        sz: 0.66 + (row % 3) * 0.1,
      });
    }
  }
  return transforms;
}

function buildRoadStones(BABYLON, scene, mats, stoneRows = 58) {
  const stone = BABYLON.MeshBuilder.CreateBox('road-stone-source', {
    width: 1.55,
    height: 0.1,
    depth: 0.92
  }, scene);
  stone.material = mats.roadStone;
  stone.isPickable = false;
  const transforms = roadToGateStoneTransforms(stoneRows);
  stone.thinInstanceSetBuffer('matrix', composeMatrices(BABYLON, transforms), 16, true);
  return stone;
}

function buildHostRoad(BABYLON, scene, mats) {
  const points = hostRoadRibbonPoints();
  const road = BABYLON.MeshBuilder.CreateRibbon('west-host-mud-road', {
    pathArray: [
      points.map(point => new BABYLON.Vector3(point.leftX, point.y, point.z)),
      points.map(point => new BABYLON.Vector3(point.rightX, point.y, point.z)),
    ],
    closeArray: false,
    closePath: false,
    sideOrientation: BABYLON.Mesh.FRONTSIDE,
  }, scene);
  road.material = mats.hostRoad;
  road.receiveShadows = true;
  road.isPickable = false;
  road.metadata = {decorativeGround: true};
  return road;
}

function buildBriars(BABYLON, scene, lineCount = 18) {
  const meshes = [];
  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const side = lineIndex % 2 ? -1 : 1;
    const outer = 31 + (lineIndex % 4) * 4.5;
    const points = [];
    for (let step = 0; step < 13; step += 1) {
      points.push(new BABYLON.Vector3(
        side * outer + Math.sin(step * 1.31 + lineIndex) * 2.8,
        0.12 + Math.abs(Math.sin(step * 0.77 + lineIndex)) * 0.16,
        -2 + step * 10.2
      ));
    }
    const line = BABYLON.MeshBuilder.CreateLines(`briar-line-${lineIndex}`, { points }, scene);
    line.color = BABYLON.Color3.FromHexString(lineIndex % 3 === 0 ? '#49734e' : '#29482f');
    line.alpha = 0.72;
    line.isPickable = false;
    meshes.push(line);
  }
  return meshes;
}

export const MOON_LANDMARK = Object.freeze({
  // Keep the approved spawn composition while placing the disc behind the
  // full horde and forest, so it reads as a sky landmark rather than a pale
  // cut-out passing in front of distant bodies.
  position: Object.freeze({x: 10.41, y: 64.72, z: 150}),
  radius: 15.19,
});
export const MOON_TEXTURE_ASSET = 'assets/world/briarhold-moon-512.webp';
export const STORM_SKY_TEXTURE_ASSET = 'assets/world/briarhold-storm-sky-1k.webp';
export const MOBILE_MOON_TEXTURE_ASSET = 'assets/world/briarhold-moon-256.webp';
export const MOBILE_STORM_SKY_TEXTURE_ASSET = 'assets/world/briarhold-storm-sky-mobile-512.webp';
export const STORM_SKY_TEXTURE_TRANSFORM = Object.freeze({uScale: 1, uOffset: 0});
export const STORM_SKY_MOTION = Object.freeze({
  cycleSeconds: 300,
  amplitude: 0.012,
});

/**
 * Drift the existing panorama by at most twelve texture pixels at 1K.
 *
 * A slow sine keeps the approved sky composition centred, returns exactly to
 * the authored offset every cycle, and costs only one texture-uniform update.
 */
export function stormSkyTextureOffset(elapsedSeconds, reducedMotion = false) {
  if (reducedMotion) return STORM_SKY_TEXTURE_TRANSFORM.uOffset;
  const seconds = Number(elapsedSeconds);
  if (!Number.isFinite(seconds)) return STORM_SKY_TEXTURE_TRANSFORM.uOffset;
  const phase = seconds * Math.PI * 2 / STORM_SKY_MOTION.cycleSeconds;
  return STORM_SKY_TEXTURE_TRANSFORM.uOffset + Math.sin(phase) * STORM_SKY_MOTION.amplitude;
}

export function moonLandmarkViewFromSpawn(
  mapDefinition = BRIARHOLD_FIRST_PERSON_MAP,
  eyeHeight = 1.62,
) {
  const spawn = mapDefinition.playerSpawn;
  const deltaX = MOON_LANDMARK.position.x - spawn.x;
  const deltaY = MOON_LANDMARK.position.y - (spawn.y + eyeHeight);
  const deltaZ = MOON_LANDMARK.position.z - spawn.z;
  const horizontalDistance = Math.hypot(deltaX, deltaZ);
  const distance = Math.hypot(horizontalDistance, deltaY);
  return Object.freeze({
    yawOffset: Math.atan2(deltaX, deltaZ) - spawn.yaw,
    pitchOffset: Math.atan2(deltaY, horizontalDistance) - spawn.pitch,
    angularRadius: Math.asin(Math.min(1, MOON_LANDMARK.radius / distance)),
    distance,
  });
}

function buildMoon(BABYLON, scene, mats) {
  const moon = BABYLON.MeshBuilder.CreateDisc('briar-moon', {
    radius: MOON_LANDMARK.radius,
    tessellation: 64,
    sideOrientation: BABYLON.Mesh.DOUBLESIDE
  }, scene);
  moon.position.set(
    MOON_LANDMARK.position.x,
    MOON_LANDMARK.position.y,
    MOON_LANDMARK.position.z,
  );
  moon.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  moon.material = mats.moon;
  moon.isPickable = false;
  return moon;
}

function buildFireflies(BABYLON, scene, mats, moteCount = 84) {
  const mote = BABYLON.MeshBuilder.CreateSphere('spore-mote-source', { diameter: 0.13, segments: 4 }, scene);
  mote.material = mats.spore;
  mote.isPickable = false;
  const transforms = [];
  for (let index = 0; index < moteCount; index += 1) {
    const side = index % 2 ? -1 : 1;
    const lane = index % 5 === 0 ? 16 : 29 + (index % 7) * 2.2;
    transforms.push({
      x: side * lane + Math.sin(index * 2.31) * 4,
      y: 0.8 + (index % 11) * 0.52,
      z: 3 + (index * 19.71) % 116,
      sx: 0.7 + (index % 4) * 0.18,
      sy: 0.7 + (index % 4) * 0.18,
      sz: 0.7 + (index % 4) * 0.18
    });
  }
  mote.thinInstanceSetBuffer('matrix', composeMatrices(BABYLON, transforms), 16, true);
  return mote;
}

export const TORCH_PLACEMENTS = Object.freeze([
  Object.freeze([-21.25, 5.45, -4.72]),
  Object.freeze([-10.75, 5.45, -4.72]),
  Object.freeze([-21.25, 5.45, 0.42]),
  Object.freeze([-10.75, 5.45, 0.42]),
  Object.freeze([-30.8, 9.25, 1.25]),
  // East return rail: the old x=8.2 placement sat in the open stair void.
  Object.freeze([10.25, 9.25, 0.5]),
  Object.freeze([-8, 11.2, -7.78]),
  // East gate pier: the old high sconce was above the ramp with no wall
  // behind it.  This lower mount shares the east gate's authored pier.
  Object.freeze([11.8, 5.45, -1.35]),
  Object.freeze([0, 9, -18.86]),
  // Warm silhouettes on the inward faces of the new overlook towers make the
  // opening legible without spending additional point lights.
  Object.freeze([-21.82, 5.35, 19.4]),
  Object.freeze([-10.18, 5.35, 19.4]),
  // Emissive-only flames pull the new outer threshold into the same warm
  // visual language without increasing the four-light runtime budget.
  Object.freeze([-26.95, 6.05, 43.62]),
  Object.freeze([-5.05, 6.05, 43.62]),
  Object.freeze([-23.5, 4.35, 43.62]),
  Object.freeze([-8.5, 4.35, 43.62]),
  // The outer tower pair are emissive skyline anchors only; they reuse the
  // existing bracket/flame thin-instance batches and spend no extra lights.
  Object.freeze([-38.72, 8.15, 43.38]),
  Object.freeze([6.72, 8.15, 43.38]),
  // Emissive-only courtyard anchors break up the broad inner keep facade and
  // reveal the service route without spending another point light.
  Object.freeze([-7.8, 4.4, -18.86]),
  Object.freeze([7.8, 4.4, -18.86]),
  // Paired emissive sconces identify the ground-level Warden's Postern beneath
  // the west stair. They reuse the existing bracket/flame batches and spend
  // no additional point lights.
  Object.freeze([-28.95, 2.25, 0.22]),
  Object.freeze([-24.25, 2.25, 0.22]),
]);
export const TORCH_FLAME_TEXTURE_ASSET = 'assets/world/briarhold-torch-flame-256.webp';
export const TORCH_FLAME_SIZE = Object.freeze({width: 1.02, height: 1.58});
export const TORCH_FLAME_MATERIAL_TUNING = Object.freeze({
  // StandardMaterial adds emissiveColor to emissiveTexture; black preserves
  // the authored flame colours instead of filling the alpha silhouette.
  emissiveColor: '#000000',
  alphaCutOff: 0.24,
  diffuseContribution: false,
});
export const BRAZIER_FLAME_Y_OFFSET = 1.18;
export const FIELD_BRAZIER_FLAME_SCALE = Object.freeze({x: 1.55, y: 1.85, z: 1.55});
export const WARDEN_LIGHT_PROFILE = Object.freeze({
  color: '#ffd19a',
  intensity: 760,
  range: 14,
  angle: 2.18,
  exponent: 1.15,
  forwardOffset: 0.32,
  verticalOffset: -0.34,
  downwardBias: -0.2,
});
export const FIRE_LIGHT_SELECTION_INTERVAL = 0.24;
export const FIRE_LIGHT_FADE_SPEED = 6.5;
export const FIRE_HALO_SIZE = Object.freeze({width: 2.45, height: 2.45});
export const FIELD_BONFIRE_EXTRA_FLAMES = Object.freeze([
  Object.freeze({dx: -0.38, dy: -0.16, dz: 0.16, sx: 0.62, sy: 0.72, sz: 0.62, ry: 0.37}),
  Object.freeze({dx: 0.36, dy: -0.22, dz: -0.14, sx: 0.56, sy: 0.66, sz: 0.56, ry: -0.41}),
]);
export function defensiveFlameTransforms() {
  const brazierFlames = BRAZIER_PLACEMENTS.flatMap(({role, x, y, z, scale}) => {
    const primary = {
      x,
      y: y + BRAZIER_FLAME_Y_OFFSET * scale,
      z,
      sx: role.startsWith('field-') ? FIELD_BRAZIER_FLAME_SCALE.x * scale : 1.08 * scale,
      sy: role.startsWith('field-') ? FIELD_BRAZIER_FLAME_SCALE.y * scale : 1.08 * scale,
      sz: role.startsWith('field-') ? FIELD_BRAZIER_FLAME_SCALE.z * scale : 1.08 * scale,
    };
    if (role !== 'field-east') return [primary];
    return [
      primary,
      ...FIELD_BONFIRE_EXTRA_FLAMES.map(tongue => ({
        x: x + tongue.dx,
        y: primary.y + tongue.dy,
        z: z + tongue.dz,
        sx: primary.sx * tongue.sx,
        sy: primary.sy * tongue.sy,
        sz: primary.sz * tongue.sz,
        ry: tongue.ry,
      })),
    ];
  });
  return [
    ...TORCH_PLACEMENTS.map(([x, y, z]) => ({x, y, z})),
    ...brazierFlames,
  ];
}

export function defensiveFireLightSources() {
  const sconces = TORCH_PLACEMENTS.map(([x, y, z], index) => Object.freeze({
    id: `sconce-${index + 1}`,
    kind: 'sconce',
    x,
    y,
    z,
    intensity: 1_150,
    range: 14,
    flameIndex: index,
  }));
  const braziers = BRAZIER_PLACEMENTS.map((placement, index) => {
    const field = placement.role.startsWith('field-');
    const anchor = placement.role === 'field-east';
    return Object.freeze({
      id: `brazier-${placement.role}`,
      kind: 'brazier',
      x: placement.x,
      y: placement.y + BRAZIER_FLAME_Y_OFFSET * placement.scale + 0.35,
      z: placement.z,
      intensity: anchor ? 6_400 : field ? 3_400 : 2_200,
      range: anchor ? 34 : field ? 22 : 17,
      flameIndex: TORCH_PLACEMENTS.length + index,
    });
  });
  return Object.freeze([...sconces, ...braziers]);
}

function defensiveFireHaloTransforms() {
  const sconces = TORCH_PLACEMENTS.map(([x, y, z]) => {
    const sideWall = z === 1.25;
    return {
      x: x + (sideWall ? 0.025 : 0),
      y: y - 0.12,
      z: z + (sideWall ? 0 : 0.025),
      ry: sideWall ? Math.PI * 0.5 : 0,
      sx: 1.35,
      sy: 1.15,
      sz: 1,
    };
  });
  const braziers = BRAZIER_PLACEMENTS.map(({x, y, z, scale}) => ({
    x,
    y: y + 0.035,
    z,
    rx: Math.PI * 0.5,
    sx: 1.8 * scale,
    sy: 1.8 * scale,
    sz: 1,
  }));
  return [...sconces, ...braziers];
}

function buildStormSky(BABYLON, scene, mats) {
  const sky = BABYLON.MeshBuilder.CreateSphere('briar-storm-sky', {
    diameter: 500,
    segments: 32,
    sideOrientation: BABYLON.Mesh.BACKSIDE,
  }, scene);
  // The whole authored navigation volume remains well inside this fixed dome.
  // Keeping it finite avoids driver-specific infinite-distance clipping rings.
  sky.position.set(0, 24, 42);
  sky.infiniteDistance = false;
  sky.material = mats.sky;
  sky.isPickable = false;
  sky.applyFog = false;
  sky.renderingGroupId = 0;
  return sky;
}
export const HOST_KILLZONE_LIGHT_GRADE = Object.freeze({
  positionXZ: Object.freeze([FIELD_EAST_BRAZIER.x, FIELD_EAST_BRAZIER.z]),
  innerRadius: 6,
  outerRadius: 34,
  // Tint lit midtones without filling black bark outlines with flat amber.
  // Values above one behave like a warm light colour multiplier rather than
  // an emissive constant, preserving the authored Meshy atlas shadows.
  warmTint: Object.freeze([1.32, 1.11, 0.87]),
});

export function hostKillzoneWarmthAt(x, z) {
  const dx = Number(x) - HOST_KILLZONE_LIGHT_GRADE.positionXZ[0];
  const dz = Number(z) - HOST_KILLZONE_LIGHT_GRADE.positionXZ[1];
  const distanceSquared = dx * dx + dz * dz;
  const innerSquared = HOST_KILLZONE_LIGHT_GRADE.innerRadius ** 2;
  const outerSquared = HOST_KILLZONE_LIGHT_GRADE.outerRadius ** 2;
  const t = Math.max(0, Math.min(1, (distanceSquared - innerSquared) / (outerSquared - innerSquared)));
  const smooth = t * t * (3 - 2 * t);
  return 1 - smooth;
}
function buildTorches(BABYLON, scene, mats) {
  const sources = defensiveFireLightSources();
  const brazierSources = sources.filter(source => source.kind === 'brazier');
  const selectableSources = sources.map(source => ({...source, visible: true}));
  const sourcePoints = selectableSources.map(source => new BABYLON.Vector3(source.x, source.y, source.z));
  const identityMatrix = BABYLON.Matrix.Identity();
  const lights = [];
  const slots = [];
  const bracket = BABYLON.MeshBuilder.CreateCylinder('torch-bracket-source', {
    height: 1.1,
    diameter: 0.18,
    tessellation: 7
  }, scene);
  bracket.material = mats.metal;
  bracket.isPickable = false;
  bracket.thinInstanceSetBuffer('matrix', composeMatrices(BABYLON, TORCH_PLACEMENTS.map(([x, y, z]) => ({
    x,
    y: y - 0.48,
    z,
  }))), 16, true);
  bracket.thinInstanceRefreshBoundingInfo?.(true);

  const flameFront = BABYLON.MeshBuilder.CreatePlane('defensive-flame-front-source', {
    width: TORCH_FLAME_SIZE.width,
    height: TORCH_FLAME_SIZE.height,
    sideOrientation: BABYLON.Mesh.DOUBLESIDE,
  }, scene);
  const flameSide = BABYLON.MeshBuilder.CreatePlane('defensive-flame-side-source', {
    width: TORCH_FLAME_SIZE.width,
    height: TORCH_FLAME_SIZE.height,
    sideOrientation: BABYLON.Mesh.DOUBLESIDE,
  }, scene);
  flameSide.rotation.y = Math.PI * 0.5;
  const flame = BABYLON.Mesh.MergeMeshes([flameFront, flameSide], true, true, undefined, false, true);
  if (!flame) throw new Error('defensive flame cross could not be merged');
  flame.name = 'defensive-flame-source';
  flame.material = mats.flame;
  flame.isPickable = false;
  const flameTransforms = defensiveFlameTransforms();
  const flameMatrices = composeMatrices(BABYLON, flameTransforms);
  const flameColors = new Float32Array(flameTransforms.length * 4);
  flameColors.fill(1);
  flame.thinInstanceSetBuffer('matrix', flameMatrices, 16, true);
  flame.thinInstanceSetBuffer('instanceColor', flameColors, 4, true);
  flame.thinInstanceRefreshBoundingInfo?.(true);

  const haloTexture = new BABYLON.DynamicTexture('fire-halo-texture', {width: 64, height: 64}, scene, false);
  const haloContext = haloTexture.getContext();
  const haloGradient = haloContext.createRadialGradient(32, 32, 2, 32, 32, 31);
  haloGradient.addColorStop(0, 'rgba(255, 190, 96, 0.42)');
  haloGradient.addColorStop(0.34, 'rgba(255, 132, 48, 0.18)');
  haloGradient.addColorStop(1, 'rgba(255, 92, 24, 0)');
  haloContext.fillStyle = haloGradient;
  haloContext.fillRect(0, 0, 64, 64);
  haloTexture.hasAlpha = true;
  haloTexture.update(false);
  const haloMaterial = new BABYLON.StandardMaterial('fire-halo-mat', scene);
  haloMaterial.diffuseColor = BABYLON.Color3.Black();
  haloMaterial.emissiveColor = BABYLON.Color3.FromHexString('#ff9b46');
  haloMaterial.emissiveTexture = haloTexture;
  haloMaterial.opacityTexture = haloTexture;
  haloMaterial.disableLighting = true;
  haloMaterial.alpha = 0.24;
  haloMaterial.backFaceCulling = false;
  const halo = BABYLON.MeshBuilder.CreatePlane('fire-surface-halo-source', {
    width: FIRE_HALO_SIZE.width,
    height: FIRE_HALO_SIZE.height,
    sideOrientation: BABYLON.Mesh.DOUBLESIDE,
  }, scene);
  halo.material = haloMaterial;
  halo.isPickable = false;
  halo.alphaIndex = 1;
  halo.thinInstanceSetBuffer('matrix', composeMatrices(BABYLON, defensiveFireHaloTransforms()), 16, true);
  halo.thinInstanceRefreshBoundingInfo?.(true);

  const emberMaterial = emissiveMaterial(BABYLON, scene, 'fire-ember-mat', '#ffb05a');
  const ember = BABYLON.MeshBuilder.CreatePolyhedron('fire-ember-source', {
    type: 0,
    size: 0.065,
  }, scene);
  ember.material = emberMaterial;
  ember.isPickable = false;
  const maxEmbers = 28;
  const emberMatrices = composeMatrices(BABYLON, Array.from({length: maxEmbers}, () => ({sx: 0, sy: 0, sz: 0})));
  ember.thinInstanceSetBuffer('matrix', emberMatrices, 16, true);
  ember.setEnabled(false);

  for (let index = 0; index < MAX_LOCAL_TORCH_LIGHTS; index += 1) {
    const light = new BABYLON.PointLight(`fire-light-proxy-${index + 1}`, BABYLON.Vector3.Zero(), scene);
    light.diffuse = BABYLON.Color3.FromHexString('#f2a84c');
    light.specular = BABYLON.Color3.FromHexString('#6f3b18');
    light.intensity = 0;
    light.range = 1;
    light.intensityMode = BABYLON.Light.INTENSITYMODE_LUMINOUSPOWER;
    light.falloffType = BABYLON.Light.FALLOFF_PHYSICAL;
    light.metadata = {role: 'fire-proxy', slot: index};
    lights.push(light);
    slots.push({
      light,
      source: null,
      pendingSource: null,
      flicker: sampleFlameFlicker(0, index),
    });
  }
  let profile = lightingProfileForQuality('balanced');
  let presentation = lightingPresentationProfile('night');
  let reducedMotion = false;
  let lastSelectionAt = -Infinity;
  let activeSources = [];
  const flameSamples = Array.from({length: flameTransforms.length}, () => ({}));
  const animatedFlame = {};
  const matrixScale = BABYLON.Vector3.One();
  const matrixRotation = BABYLON.Quaternion.Identity();
  const matrixTranslation = BABYLON.Vector3.Zero();
  const matrix = BABYLON.Matrix.Identity();

  function writeMatrix(target, offset, item) {
    matrixScale.set(item.sx ?? 1, item.sy ?? 1, item.sz ?? 1);
    if (BABYLON.Quaternion.RotationYawPitchRollToRef) {
      BABYLON.Quaternion.RotationYawPitchRollToRef(
        item.ry ?? 0,
        item.rx ?? 0,
        item.rz ?? 0,
        matrixRotation,
      );
    } else {
      matrixRotation.copyFrom(BABYLON.Quaternion.RotationYawPitchRoll(
        item.ry ?? 0,
        item.rx ?? 0,
        item.rz ?? 0,
      ));
    }
    matrixTranslation.set(item.x ?? 0, item.y ?? 0, item.z ?? 0);
    BABYLON.Matrix.ComposeToRef(matrixScale, matrixRotation, matrixTranslation, matrix);
    matrix.copyToArray(target, offset);
  }

  function updateFlames(now) {
    flameTransforms.forEach((base, index) => {
      const flicker = sampleFlameFlicker(now, index, {reducedMotion, target: flameSamples[index]});
      animatedFlame.x = base.x + Math.sin(now * 4.3 + index * 1.17) * flicker.sway * 0.11;
      animatedFlame.y = base.y + flicker.lift;
      animatedFlame.z = base.z;
      animatedFlame.sx = (base.sx ?? 1) * flicker.stretchX;
      animatedFlame.sy = (base.sy ?? 1) * flicker.stretchY;
      animatedFlame.sz = (base.sz ?? 1) * flicker.stretchX;
      animatedFlame.rx = base.rx ?? 0;
      animatedFlame.ry = (base.ry ?? 0) + flicker.sway;
      animatedFlame.rz = base.rz ?? 0;
      writeMatrix(flameMatrices, index * 16, animatedFlame);
      const colorOffset = index * 4;
      flameColors[colorOffset] = flicker.brightness * (0.96 + flicker.warmth * 0.08);
      flameColors[colorOffset + 1] = flicker.brightness * (0.83 + flicker.warmth * 0.17);
      flameColors[colorOffset + 2] = flicker.brightness * (0.68 + flicker.warmth * 0.24);
      flameColors[colorOffset + 3] = 1;
    });
    flame.thinInstanceBufferUpdated?.('matrix');
    flame.thinInstanceBufferUpdated?.('instanceColor');
  }

  function updateEmbers(now) {
    const count = reducedMotion ? 0 : profile.emberCount;
    ember.setEnabled(count > 0);
    if (count <= 0) return;
    for (let index = 0; index < maxEmbers; index += 1) {
      if (index >= count) {
        writeMatrix(emberMatrices, index * 16, {sx: 0, sy: 0, sz: 0});
        continue;
      }
      const source = brazierSources[index % brazierSources.length];
      const phase = index * 0.61803398875;
      const life = (now * (0.28 + (index % 5) * 0.025) + phase) % 1;
      const radius = 0.09 + (index % 4) * 0.055;
      const scale = (0.55 + (index % 3) * 0.16) * (1 - life * 0.72);
      writeMatrix(emberMatrices, index * 16, {
        x: source.x + Math.sin(phase * 9 + now * 1.7) * radius * (0.4 + life),
        y: source.y + 0.08 + life * (1.25 + (index % 4) * 0.15),
        z: source.z + Math.cos(phase * 7 + now * 1.3) * radius * (0.4 + life),
        sx: scale,
        sy: scale * 1.4,
        sz: scale,
      });
    }
    ember.thinInstanceBufferUpdated?.('matrix');
  }

  function chooseSources(now, camera) {
    if (now - lastSelectionAt < FIRE_LIGHT_SELECTION_INTERVAL) return;
    lastSelectionAt = now;
    const ray = camera.getForwardRay?.(1);
    const engine = scene.getEngine();
    const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    selectableSources.forEach((source, index) => {
      const projected = BABYLON.Vector3.Project(
        sourcePoints[index],
        identityMatrix,
        scene.getTransformMatrix(),
        viewport,
      );
      source.visible = projected.z >= 0 && projected.z <= 1
        && projected.x >= viewport.x && projected.x <= viewport.x + viewport.width
        && projected.y >= viewport.y && projected.y <= viewport.y + viewport.height;
    });
    const selected = selectFireLightSources(
      selectableSources,
      camera.position,
      ray?.direction ?? {x: 0, z: 1},
      activeSources.map(source => source.id),
      profile.fireLightCount,
    );
    activeSources = [...selected];
    slots.forEach((slot, index) => {
      slot.pendingSource = activeSources[index] ?? null;
    });
  }

  function updateLights(now, dt, camera, threat = 0) {
    chooseSources(now, camera);
    slots.forEach((slot, index) => {
      if (index >= profile.fireLightCount) {
        slot.light.intensity += (0 - slot.light.intensity) * Math.min(1, dt * FIRE_LIGHT_FADE_SPEED);
        return;
      }
      if (slot.pendingSource?.id !== slot.source?.id) {
        slot.light.intensity += (0 - slot.light.intensity) * Math.min(1, dt * FIRE_LIGHT_FADE_SPEED * 1.6);
        if (slot.light.intensity > 8) return;
        slot.source = slot.pendingSource;
        if (slot.source) slot.light.position.copyFromFloats(slot.source.x, slot.source.y, slot.source.z);
        else slot.light.intensity = 0;
      }
      const source = slot.source;
      if (!source) return;
      const flicker = sampleFlameFlicker(now, source.flameIndex, {
        reducedMotion,
        target: slot.flicker,
      });
      const targetIntensity = source.intensity * presentation.torchProminence * flicker.brightness * (1 + threat * 0.12);
      slot.light.intensity += (targetIntensity - slot.light.intensity) * Math.min(1, dt * FIRE_LIGHT_FADE_SPEED);
      slot.light.range = source.range + threat * 3;
      slot.light.diffuse.copyFromFloats(
        1,
        0.58 + flicker.warmth * 0.12,
        0.22 + flicker.warmth * 0.08,
      );
      slot.flicker = flicker;
    });
  }

  function setProfile(nextProfile) {
    profile = nextProfile;
    lastSelectionAt = -Infinity;
    slots.forEach((slot, index) => {
      slot.light.setEnabled(index < profile.fireLightCount);
      if (index >= profile.fireLightCount) slot.light.intensity = 0;
    });
  }

  function update(now, dt, camera, threat = 0) {
    updateFlames(now);
    updateEmbers(now);
    updateLights(now, dt, camera, threat);
  }

  return {
    lights,
    sources,
    slots,
    flames: [flame],
    flame,
    halo,
    ember,
    bracket,
    flameCount: flameTransforms.length,
    bracketCount: TORCH_PLACEMENTS.length,
    setProfile,
    setPresentationProfile(nextProfile) { presentation = nextProfile; },
    setReducedMotion(value) { reducedMotion = value === true; },
    update,
    diagnostics() {
      return {
        activeSources: activeSources.map(source => source.id),
        sourceCount: sources.length,
        surfaceHaloCount: sources.length,
        fireLightCount: profile.fireLightCount,
        emberCount: reducedMotion ? 0 : profile.emberCount,
        flicker: slots
          .filter(slot => slot.source)
          .map(slot => ({id: slot.source.id, brightness: slot.flicker.brightness})),
        visualFlicker: flameSamples.slice(0, 4).map((sample, index) => ({
          index,
          ...sample,
          color: Array.from(flameColors.slice(index * 4, index * 4 + 3)),
        })),
      };
    },
  };
}

export const BANNER_PLACEMENTS = Object.freeze([
  Object.freeze([-21.25, 6.45, -4.62]),
  Object.freeze([-10.75, 6.45, -4.62]),
  // The inward cloth ends below the y=8 walk. At the old y=6.45 centres its
  // alpha silhouette sliced through the deck and appeared as blocking grass.
  Object.freeze([-21.25, 4.9, 0.22]),
  Object.freeze([-10.75, 4.9, 0.22]),
  // Hang two standards on the inward tower faces framing the firing gallery.
  // Their quarter-turns keep them flush with collision-backed masonry and
  // break up the large plain slabs visible in the first-person composition.
  Object.freeze([-21.97, 6.25, 19.4, Math.PI * 0.5]),
  Object.freeze([-10.03, 6.25, 19.4, -Math.PI * 0.5]),
  Object.freeze([-26.95, 8.05, 43.58]),
  Object.freeze([-5.05, 8.05, 43.58]),
  // Two inward standards make the old keep read as an inhabited defensive
  // landmark rather than an undifferentiated greybox wall.
  Object.freeze([-8, 8.2, -18.82]),
  Object.freeze([8, 8.2, -18.82]),
]);
export const BANNER_TEXTURE_ASSET = 'assets/world/briarhold-banner-512.webp';
export const MOBILE_BANNER_TEXTURE_ASSET = 'assets/world/briarhold-banner-256.webp';

function buildBanners(BABYLON, scene, mats) {
  return BANNER_PLACEMENTS.map(([x, y, z, rotationY = 0], index) => {
    const banner = BABYLON.MeshBuilder.CreatePlane(`hold-banner-${index}`, {
      width: 2.4,
      height: 5.2,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, scene);
    banner.position.set(x, y, z);
    banner.rotation.y = rotationY;
    banner.material = mats.banner;
    banner.isPickable = false;
    return banner;
  });
}

function buildFortificationSockets(BABYLON, scene, mats) {
  return AUTHORED_FORTIFICATION_SOCKET_COORDINATES.map(socketDefinition => {
    const { id, legacyId, approach, x, y, z, facing, allowedTypes } = socketDefinition;
    const ring = BABYLON.MeshBuilder.CreateTorus(`socket-${id}`, {
      diameter: 2.7,
      thickness: 0.12,
      tessellation: 24
    }, scene);
    ring.position.set(x, y + 0.12, z);
    // Babylon toruses are already horizontal (XZ). Keeping the authored ring
    // flat prevents it towering through a first-person view like a portal.
    ring.material = mats.socket;
    ring.isPickable = false;
    const pickMesh = BABYLON.MeshBuilder.CreateDisc(`socket-pick-${id}`, {
      radius: 3.8,
      tessellation: 24,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, scene);
    pickMesh.position.set(x, y + 0.14, z);
    pickMesh.rotation.x = Math.PI / 2;
    pickMesh.material = mats.socket;
    pickMesh.visibility = 0.001;
    pickMesh.isPickable = false;
    return {
      id,
      legacyId,
      approach,
      x,
      y,
      z,
      facing,
      allowedTypes,
      mesh: ring,
      pickMesh
    };
  });
}

export function createWorld(BABYLON, engine, canvas, {lowSpec = false, mobileTextures = false} = {}) {
  const scene = new BABYLON.Scene(engine);
  let lightingProfile = lightingProfileForQuality(lowSpec ? 'performance' : 'balanced');
  let presentationProfile = worldPresentationProfile('night', {shadowsEnabled: lightingProfile.moonShadowMapSize > 0});
  scene.skipPointerMovePicking = true;
  scene.clearColor = BABYLON.Color4.FromHexString('#0c1a18ff');
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = WORLD_ATMOSPHERE.fogDensity;
  scene.fogColor = BABYLON.Color3.FromHexString(WORLD_ATMOSPHERE.fogColor);
  scene.imageProcessingConfiguration.contrast = WORLD_ATMOSPHERE.contrast;
  scene.imageProcessingConfiguration.exposure = WORLD_ATMOSPHERE.exposure;
  scene.imageProcessingConfiguration.toneMappingEnabled = !lowSpec;
  scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.vignetteEnabled = !lowSpec;
  scene.imageProcessingConfiguration.vignetteWeight = WORLD_ATMOSPHERE.vignetteWeight;
  scene.imageProcessingConfiguration.vignetteStretch = WORLD_ATMOSPHERE.vignetteStretch;
  scene.imageProcessingConfiguration.vignetteColor = BABYLON.Color4.FromHexString('#020503cc');

  const initialCameraProfile = resolveStationCamera('west');
  const camera = new BABYLON.FreeCamera(
    'battlement-camera',
    new BABYLON.Vector3(
      initialCameraProfile.position.x,
      initialCameraProfile.position.y,
      initialCameraProfile.position.z
    ),
    scene
  );
  camera.minZ = 0.1;
  camera.maxZ = 600;
  camera.fov = initialCameraProfile.fieldOfView;
  camera.inputs.clear();
  camera.setTarget(new BABYLON.Vector3(
    initialCameraProfile.target.x,
    initialCameraProfile.target.y,
    initialCameraProfile.target.z
  ));
  scene.activeCamera = camera;

  const hemi = new BABYLON.HemisphericLight('moon-fill', new BABYLON.Vector3(0.1, 1, 0.2), scene);
  hemi.intensity = WORLD_ATMOSPHERE.hemiIntensity;
  hemi.diffuse = BABYLON.Color3.FromHexString('#93b8a5');
  hemi.groundColor = BABYLON.Color3.FromHexString('#15170f');
  const moonLight = new BABYLON.DirectionalLight('moon-light', new BABYLON.Vector3(-0.2, -0.9, -0.3), scene);
  moonLight.position.set(35, 70, 35);
  moonLight.intensity = WORLD_ATMOSPHERE.moonIntensity;
  moonLight.diffuse = BABYLON.Color3.FromHexString('#b9d6c8');
  const wardenLight = new BABYLON.SpotLight(
    'warden-lantern-light',
    BABYLON.Vector3.Zero(),
    new BABYLON.Vector3(0, WARDEN_LIGHT_PROFILE.downwardBias, 1),
    WARDEN_LIGHT_PROFILE.angle,
    WARDEN_LIGHT_PROFILE.exponent,
    scene,
  );
  wardenLight.diffuse = BABYLON.Color3.FromHexString(WARDEN_LIGHT_PROFILE.color);
  wardenLight.specular = BABYLON.Color3.FromHexString('#5e351c');
  wardenLight.intensity = WARDEN_LIGHT_PROFILE.intensity;
  wardenLight.range = WARDEN_LIGHT_PROFILE.range;
  wardenLight.intensityMode = BABYLON.Light.INTENSITYMODE_LUMINOUSPOWER;
  wardenLight.falloffType = BABYLON.Light.FALLOFF_PHYSICAL;
  wardenLight.metadata = {role: 'warden'};
  wardenLight.setEnabled(false);
  const mats = {
    ground: material(BABYLON, scene, 'ground-mat', '#24391f'),
    path: material(BABYLON, scene, 'path-mat', '#514a32'),
    hostRoad: material(BABYLON, scene, 'host-road-mat', '#3f3323'),
    courtyard: material(BABYLON, scene, 'courtyard-mat', '#7d8177'),
    roadStone: material(BABYLON, scene, 'road-stone-mat', '#777362'),
    stone: material(BABYLON, scene, 'stone-mat', '#59615a'),
    stoneDark: material(BABYLON, scene, 'stone-dark-mat', '#343d38'),
    killzone: material(BABYLON, scene, 'killzone-mat', '#3b352d'),
    wood: material(BABYLON, scene, 'wood-mat', '#3a2819'),
    woodLight: material(BABYLON, scene, 'wood-light-mat', '#684424'),
    leaves: material(BABYLON, scene, 'leaf-mat', '#173f29'),
    gate: material(BABYLON, scene, 'gate-mat', '#5a3c22'),
    heart: material(BABYLON, scene, 'heart-mat', '#6f8f78'),
    metal: material(BABYLON, scene, 'metal-mat', '#4d5a55', 0.72),
    socket: emissiveMaterial(BABYLON, scene, 'socket-mat', '#d8bd68', 0.55),
    preview: emissiveMaterial(BABYLON, scene, 'fortification-preview-mat', '#d7c17a', 0.72),
    banner: material(BABYLON, scene, 'banner-mat', '#285037', 0.88),
    sky: emissiveMaterial(BABYLON, scene, 'storm-sky-mat', '#ffffff'),
    moon: emissiveMaterial(BABYLON, scene, 'moon-mat', '#c8e0d5', 0.92),
    flame: emissiveMaterial(BABYLON, scene, 'flame-mat', '#ffb14a'),
    spore: emissiveMaterial(BABYLON, scene, 'spore-mat', '#79d68f', 0.78)
  };
  const textureSets = {
    ground: runtimeTextureSet(BABYLON, scene, 'forrest_ground_01', 24, lowSpec, mobileTextures),
    stone: runtimeTextureSet(BABYLON, scene, 'castle_brick_01', 8, lowSpec, mobileTextures),
    wood: runtimeTextureSet(BABYLON, scene, 'wooden_planks', 2.4, lowSpec, mobileTextures),
  };
  applyRuntimeTextureSet(mats.ground, textureSets.ground, lowSpec);
  applyRuntimeTextureSet(mats.path, textureSets.ground, lowSpec);
  applyRuntimeTextureSet(mats.hostRoad, textureSets.ground, lowSpec);
  applyRuntimeTextureSet(mats.courtyard, textureSets.stone, lowSpec);
  applyRuntimeTextureSet(mats.stone, textureSets.stone, lowSpec);
  applyRuntimeTextureSet(mats.stoneDark, textureSets.stone, lowSpec);
  applyRuntimeTextureSet(mats.killzone, textureSets.stone, lowSpec);
  applyRuntimeTextureSet(mats.roadStone, textureSets.stone, lowSpec);
  applyRuntimeTextureSet(mats.gate, textureSets.wood, lowSpec);
  applyRuntimeTextureSet(mats.heart, textureSets.wood, lowSpec);
  applyRuntimeTextureSet(mats.wood, textureSets.wood, lowSpec);
  applyRuntimeTextureSet(mats.woodLight, textureSets.wood, lowSpec);
  mats.stone.albedoColor = BABYLON.Color3.FromHexString(WORLD_MATERIAL_TINTS.stone);
  mats.stoneDark.albedoColor = BABYLON.Color3.FromHexString(WORLD_MATERIAL_TINTS.stoneDark);
  mats.killzone.albedoColor = BABYLON.Color3.FromHexString(WORLD_MATERIAL_TINTS.killzone);
  mats.killzone.directIntensity = 0.92;
  mats.courtyard.albedoColor = BABYLON.Color3.FromHexString(WORLD_MATERIAL_TINTS.courtyard);
  mats.ground.albedoColor = BABYLON.Color3.FromHexString(WORLD_MATERIAL_TINTS.ground);
  mats.path.albedoColor = BABYLON.Color3.FromHexString(WORLD_MATERIAL_TINTS.path);
  mats.hostRoad.albedoColor = BABYLON.Color3.FromHexString(WORLD_MATERIAL_TINTS.hostRoad);
  mats.roadStone.albedoColor = BABYLON.Color3.FromHexString(WORLD_MATERIAL_TINTS.roadStone);
  mats.heart.albedoColor = BABYLON.Color3.FromHexString('#263d33');
  mats.heart.roughness = 0.86;
  mats.heart.directIntensity = 0.94;
  for (const fortressMaterial of [mats.stone, mats.stoneDark, mats.courtyard]) {
    fortressMaterial.metallic = PROCEDURAL_FORTRESS_MATERIAL_TUNING.metallic;
    fortressMaterial.roughness = PROCEDURAL_FORTRESS_MATERIAL_TUNING.roughness;
    fortressMaterial.directIntensity = PROCEDURAL_FORTRESS_MATERIAL_TUNING.directIntensity;
  }
  // Let the authored cloth texture carry its own forest-green colour instead
  // of multiplying it by the old near-black placeholder-plane tint.
  mats.banner.albedoColor = BABYLON.Color3.FromHexString('#a4afa5');
  mats.banner.emissiveColor = BABYLON.Color3.FromHexString('#020604');
  const bannerTexture = new BABYLON.Texture(
    mobileTextures ? MOBILE_BANNER_TEXTURE_ASSET : BANNER_TEXTURE_ASSET,
    scene,
    false,
    false,
    lowSpec ? BABYLON.Texture.BILINEAR_SAMPLINGMODE : BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
  );
  bannerTexture.hasAlpha = true;
  bannerTexture.gammaSpace = true;
  bannerTexture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
  bannerTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  mats.banner.albedoTexture = bannerTexture;
  mats.banner.useAlphaFromAlbedoTexture = true;
  mats.banner.transparencyMode = BABYLON.Material.MATERIAL_ALPHATESTANDBLEND;
  mats.banner.alphaCutOff = 0.28;
  mats.banner.backFaceCulling = false;
  const skyTexture = new BABYLON.Texture(
    mobileTextures ? MOBILE_STORM_SKY_TEXTURE_ASSET : STORM_SKY_TEXTURE_ASSET,
    scene,
    false,
    false,
    lowSpec ? BABYLON.Texture.BILINEAR_SAMPLINGMODE : BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
  );
  skyTexture.hasAlpha = false;
  skyTexture.gammaSpace = true;
  skyTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  skyTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  // Negative texture scales split this sphere into smeared hemispheres on
  // some mobile/low-resolution WebGL paths. The cloud panorama is symmetric
  // enough that a positive, wrap-safe transform preserves composition.
  skyTexture.uScale = STORM_SKY_TEXTURE_TRANSFORM.uScale;
  skyTexture.uOffset = STORM_SKY_TEXTURE_TRANSFORM.uOffset;
  mats.sky.diffuseTexture = skyTexture;
  mats.sky.emissiveTexture = skyTexture;
  mats.sky.diffuseColor = BABYLON.Color3.Black();
  mats.sky.emissiveColor = BABYLON.Color3.FromHexString('#889c9c');
  mats.sky.disableLighting = true;
  mats.sky.fogEnabled = false;
  mats.sky.backFaceCulling = false;
  mats.sky.disableDepthWrite = true;
  const flameTexture = new BABYLON.Texture(
    TORCH_FLAME_TEXTURE_ASSET,
    scene,
    false,
    false,
    lowSpec ? BABYLON.Texture.BILINEAR_SAMPLINGMODE : BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
  );
  flameTexture.hasAlpha = true;
  flameTexture.gammaSpace = true;
  flameTexture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
  flameTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  mats.flame.emissiveTexture = flameTexture;
  mats.flame.opacityTexture = flameTexture;
  mats.flame.diffuseTexture = TORCH_FLAME_MATERIAL_TUNING.diffuseContribution ? flameTexture : null;
  mats.flame.emissiveColor = BABYLON.Color3.FromHexString(TORCH_FLAME_MATERIAL_TUNING.emissiveColor);
  mats.flame.useAlphaFromDiffuseTexture = TORCH_FLAME_MATERIAL_TUNING.diffuseContribution;
  mats.flame.transparencyMode = BABYLON.Material.MATERIAL_ALPHATESTANDBLEND;
  mats.flame.alphaCutOff = TORCH_FLAME_MATERIAL_TUNING.alphaCutOff;
  mats.flame.backFaceCulling = false;
  const moonTexture = new BABYLON.Texture(
    mobileTextures ? MOBILE_MOON_TEXTURE_ASSET : MOON_TEXTURE_ASSET,
    scene,
    false,
    false,
    lowSpec ? BABYLON.Texture.BILINEAR_SAMPLINGMODE : BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
  );
  moonTexture.hasAlpha = true;
  moonTexture.gammaSpace = true;
  moonTexture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
  moonTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  mats.moon.diffuseTexture = moonTexture;
  mats.moon.emissiveTexture = moonTexture;
  mats.moon.opacityTexture = moonTexture;
  mats.moon.diffuseColor = BABYLON.Color3.White();
  mats.moon.emissiveColor = BABYLON.Color3.FromHexString('#b9c8ad');
  mats.moon.disableLighting = true;
  mats.moon.fogEnabled = false;
  mats.moon.useAlphaFromDiffuseTexture = true;
  mats.moon.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
  mats.moon.alphaCutOff = 0.16;
  mats.moon.backFaceCulling = false;
  textureSets.stone.normal.level = 0.65;
  mats.socket.emissiveColor = BABYLON.Color3.FromHexString('#b89a4e');
  // A tiny green-black lift keeps the Heart readable without turning its full
  // eight-metre face into a self-lit fog-coloured slab.
  mats.heart.emissiveColor = BABYLON.Color3.FromHexString('#010604');
  mats.metal.albedoColor = BABYLON.Color3.FromHexString('#252b28');
  mats.metal.metallic = 0.72;
  mats.metal.roughness = 0.48;
  // Lighting quality can change at runtime. Keep lit materials mutable so
  // Babylon can rebuild shadow/light defines when generators are swapped.

  const ground = BABYLON.MeshBuilder.CreateGround('killing-field', { width: 104, height: 216, subdivisions: 2 }, scene);
  ground.position.z = 88;
  ground.material = mats.ground;
  ground.receiveShadows = true;
  ground.isPickable = true;
  ground.metadata = { worldOccluder: true };
  const hostRoad = buildHostRoad(BABYLON, scene, mats);

  for (const surface of APPROACH_SURFACES) {
    const path = BABYLON.MeshBuilder.CreateGround(surface.id, {
      width: surface.width,
      height: surface.depth,
      subdivisions: 1,
    }, scene);
    path.position.set(surface.x, surface.y, surface.z);
    path.material = mats[surface.material];
    path.receiveShadows = true;
    path.isPickable = true;
    path.metadata = {worldOccluder: true, approachSurface: true};
  }

  const castle = buildCastle(BABYLON, scene, mats);
  const meshyFortressWall = buildMeshyFortressWall(BABYLON, scene, mobileTextures);
  const meshyFortressWatchtowers = buildMeshyFortressWatchtowers(BABYLON, scene, mobileTextures);
  const meshyFortressWallReady = meshyFortressWall.ready.then(mesh => {
    suppressLoadedCastleFallbacks(castle.wallParts, mesh, MESHY_FORTRESS_WALL_COLLISION_IDS);
    return mesh;
  });
  const meshyFortressWatchtowersReady = meshyFortressWatchtowers.ready.then(mesh => {
    suppressLoadedCastleFallbacks(castle.wallParts, mesh, MESHY_FORTRESS_WATCHTOWER_COLLISION_IDS);
    return mesh;
  });
  const meshyFortressGateArch = buildMeshyFortressGateArch(BABYLON, scene, mobileTextures);
  const meshyFortressGateArchReady = meshyFortressGateArch.ready.then(mesh => {
    suppressLoadedGateArchFallbacks(castle.wallParts, mesh);
    return mesh;
  });
  const meshyBallista = buildMeshyBallistaTemplate(BABYLON, scene, mats, mobileTextures);
  const meshyFieldDefences = buildMeshyFieldDefenceTemplates(BABYLON, scene, mats, mobileTextures);
  const meshyHubWaveBell = buildMeshyHubWaveBell(BABYLON, scene, mobileTextures);
  const meshyCourtyardServiceArcades = buildMeshyCourtyardServiceArcades(BABYLON, scene, mobileTextures);
  const hubRepairPresentation = buildHubRepairPresentation(BABYLON, scene, mats);
  const hubLandmarkState = {status: 'loading', instances: 0, meshes: 0, lights: 0, error: null};
  const hubLandmarkMeshes = new Map();
  const hubLandmarksReady = meshyFieldDefences.ready.then(() => {
    for (const [npcId, placement] of [
      [HUB_NPC_IDS.MASON, HUB_LANDMARK_PLACEMENTS.mason],
      [HUB_NPC_IDS.QUARTERMASTER, HUB_LANDMARK_PLACEMENTS.quartermaster],
      [HUB_NPC_IDS.TRAPPER, HUB_LANDMARK_PLACEMENTS.trapper],
      [HUB_NPC_IDS.GREENWARDEN, HUB_LANDMARK_PLACEMENTS.greenwarden],
    ]) {
      const mesh = meshyFieldDefences.createInstance(
        placement.type,
        `hub-landmark-${npcId}`,
        placement,
      );
      if (!mesh) continue;
      mesh.scaling.setAll(placement.scale ?? 1);
      mesh.metadata = {...mesh.metadata, hubLandmark: npcId};
      mesh.setEnabled(false);
      hubLandmarkMeshes.set(npcId, mesh);
    }
    hubLandmarkState.instances = hubLandmarkMeshes.size + 1;
    hubLandmarkState.meshes = hubLandmarkMeshes.size + 1;
    hubLandmarkState.status = hubLandmarkMeshes.size === 4 ? 'ready' : 'partial';
    if (hubLandmarkMeshes.size !== 4) {
      hubLandmarkState.error = `Loaded ${hubLandmarkMeshes.size} of 4 service landmarks`;
    }
    applyHubLandmarkVisibility();
    return [...hubLandmarkMeshes.values()];
  }).catch(error => {
    hubLandmarkState.status = 'fallback';
    hubLandmarkState.error = String(error?.message || error);
    return [];
  });
  const castleTrim = buildCollisionBackedCastleTrim(BABYLON, scene, mats);
  const traversal = [
    ...buildFirstPersonTraversal(BABYLON, scene, mats),
    ...buildElevatedDeckFascia(BABYLON, scene, mats),
    ...buildTraversalBarriers(BABYLON, scene, mats, BRIARHOLD_FIRST_PERSON_MAP, lowSpec),
  ];
  // The authored overlook ramp is already rendered by the collision-backed
  // procedural traversal batch. The current Meshy stair still contains a
  // malformed undercroft at this pose, so do not fetch/decode an asset that
  // would be hidden immediately after loading. Keep its source/provenance
  // contract available for a future corrected replacement.
  const meshyRampartStair = {
    state: {status: 'procedural', instances: 0, meshes: 0, error: null},
  };
  const meshyDefenderCaches = buildMeshyDefenderCaches(BABYLON, scene, mobileTextures);
  const meshyDefenderCachesReady = meshyDefenderCaches.ready.then(mesh => {
    suppressLoadedDefenderCacheFallbacks(traversal, mesh);
    return mesh;
  });
  const meshyCourtyardServiceArcadesReady = meshyCourtyardServiceArcades.ready.then(mesh => {
    suppressLoadedServiceArcadeFallbacks(traversal, mesh);
    return mesh;
  });
  const forest = buildForest(BABYLON, scene, mats, lowSpec ? 72 : 190);
  const meshyForest = buildMeshyForest(BABYLON, scene, forest, mobileTextures);
  const meshyBattlefieldVerge = buildMeshyBattlefieldVerge(BABYLON, scene, mobileTextures);
  const meshyBraziers = buildMeshyBraziers(BABYLON, scene, mobileTextures);
  const meshyBraziersReady = meshyBraziers.ready.then(mesh => {
    suppressLoadedBrazierFallbacks(traversal, mesh);
    return mesh;
  });
  const roadStones = buildRoadStones(BABYLON, scene, mats, lowSpec ? 24 : 58);
  const briars = buildBriars(BABYLON, scene, lowSpec ? 8 : 18);
  const sky = buildStormSky(BABYLON, scene, mats);
  const moon = buildMoon(BABYLON, scene, mats);
  const motes = buildFireflies(BABYLON, scene, mats, lowSpec ? 24 : 84);
  // Every authored fire animates; a bounded physical light pool follows the
  // nearest visible sources so mobile materials never see an unbounded list.
  const torches = buildTorches(BABYLON, scene, mats);
  torches.setProfile(lightingProfile);
  const banners = buildBanners(BABYLON, scene, mats);
  const sockets = buildFortificationSockets(BABYLON, scene, mats);
  const socketsById = new Map();
  for (const socket of sockets) {
    socketsById.set(socket.id, socket);
    if (socket.legacyId) socketsById.set(socket.legacyId, socket);
  }
  const socketForId = socketId => socketsById.get(socketId) ?? null;
  for (const mesh of scene.meshes) {
    if (/wall|gate|tower|keep|pier|lintel/u.test(mesh.name)) markWorldOccluder(mesh);
  }
  const effects = [];
  const effectColors = new Map();
  const effectColor = color => {
    if (!effectColors.has(color)) effectColors.set(color, BABYLON.Color3.FromHexString(color));
    return effectColors.get(color);
  };
  const impactPool = Array.from({length: TRANSIENT_EFFECT_POOL_SIZE}, (_, index) => {
    const mesh = BABYLON.MeshBuilder.CreateSphere(`impact-pool-${index}`, {
      diameter: 0.7,
      segments: 8,
    }, scene);
    const mat = emissiveMaterial(BABYLON, scene, `impact-pool-mat-${index}`, '#ffffff');
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    const record = {kind: 'impact', mesh, mat, born: -1000, life: 0.24, scale: 1, active: false};
    effects.push(record);
    return record;
  });
  const tracerPool = Array.from({length: TRANSIENT_EFFECT_POOL_SIZE}, (_, index) => {
    const mesh = BABYLON.MeshBuilder.CreateCylinder(`tracer-pool-${index}`, {
      height: 1,
      diameter: 1,
      tessellation: 5,
      cap: BABYLON.Mesh.CAP_ALL,
    }, scene);
    const mat = emissiveMaterial(BABYLON, scene, `tracer-pool-mat-${index}`, '#ffffff');
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
    mesh.setEnabled(false);
    const record = {kind: 'tracer', mesh, mat, born: -1000, life: 0.16, scale: 0, active: false};
    effects.push(record);
    return record;
  });
  const fortificationVisuals = new Map();
  const socketPickMeshes = new Set(sockets.map(socket => socket.pickMesh));
  let fortificationPreview = null;
  let planningEnabled = false;
  let planningLayout = null;
  let selectedSocketId = null;
  let activeStation = 'west';
  let planningPickCount = 0;
  let planningPickHits = 0;
  let lastPlanningPick = null;
  let fortificationTriggers = 0;
  let aimProjectionCount = 0;
  let lastAimProjection = null;
  let targetThreat = 0;
  let displayedThreat = 0;
  let presentedEyeHeight = null;
  let walkBobState = createWalkBobState();
  const firstPersonBasePosition = {x: 0, y: 1.62, z: 0};
  let hubPresentationState = resolveHubPresentationState();
  let lastEffectsAt = performance.now() / 1000;
  let reducedMotion = false;
  let budgetMaterialCount = -1;
  const shadowState = {
    moonGenerator: null,
    wardenGenerator: null,
    casters: [],
    wardenCasters: [],
    lastRefreshAt: -Infinity,
    moonType: 'none',
  };

  function shadowMapFor(generator) {
    return generator?.getShadowMap?.() ?? null;
  }

  function eligibleShadowCaster(mesh) {
    if (!mesh?.isEnabled?.()) return false;
    if (!(mesh.getTotalVertices?.() > 0) && !(mesh.thinInstanceCount > 0)) return false;
    if (/(?:sky|moon|flame|halo|ember|mote|banner|socket|impact|tracer|preview|pick|killing-field|west-killzone-apron|west-forest-road|east-forest-road|host-road)/iu.test(mesh.name || '')) return false;
    const materialInstance = mesh.material;
    if (!materialInstance || materialInstance.disableLighting === true) return false;
    if (materialInstance.needAlphaBlending?.()) return false;
    if (lightingProfile.key !== 'high' && /(?:forest|tree)/iu.test(mesh.name || '')) return false;
    return true;
  }

  function updateMaterialLightBudgets(force = false) {
    if (!force && budgetMaterialCount === scene.materials.length) return;
    budgetMaterialCount = scene.materials.length;
    for (const materialInstance of scene.materials) {
      if (
        'maxSimultaneousLights' in materialInstance
        && materialInstance.disableLighting !== true
        && materialInstance.maxSimultaneousLights !== lightingProfile.maxMaterialLights
      ) {
        materialInstance.maxSimultaneousLights = lightingProfile.maxMaterialLights;
      }
    }
  }

  function configureShadowGenerator(generator, {cascaded = false, warden = false} = {}) {
    if (!generator) return;
    generator.bias = warden ? 0.0012 : 0.0008;
    generator.normalBias = warden ? 0.028 : 0.018;
    generator.darkness = warden ? 0.42 : 0.34;
    generator.transparencyShadow = false;
    generator.filteringQuality = lightingProfile.key === 'high'
      ? BABYLON.ShadowGenerator.QUALITY_MEDIUM
      : BABYLON.ShadowGenerator.QUALITY_LOW;
    if (cascaded) {
      generator.numCascades = lightingProfile.moonShadowCascades;
      generator.stabilizeCascades = true;
      generator.lambda = 0.68;
      generator.cascadeBlendPercentage = 0.08;
      generator.shadowMaxZ = 185;
      generator.autoCalcDepthBounds = false;
      generator.usePercentageCloserFiltering = true;
    } else {
      generator.usePercentageCloserFiltering = true;
    }
    const map = shadowMapFor(generator);
    if (map) map.refreshRate = 1;
  }

  function rebuildShadowGenerators() {
    shadowState.moonGenerator?.dispose?.();
    shadowState.wardenGenerator?.dispose?.();
    shadowState.moonGenerator = null;
    shadowState.wardenGenerator = null;
    const wantsCascades = lightingProfile.moonShadowType === 'cascaded';
    const supportsCascades = Boolean(BABYLON.CascadedShadowGenerator?.IsSupported);
    const maxTextureSize = Math.max(256, Number(engine.getCaps?.().maxTextureSize) || 2048);
    const moonMapSize = Math.min(lightingProfile.moonShadowMapSize, maxTextureSize);
    const wardenMapSize = Math.min(lightingProfile.wardenShadowMapSize, maxTextureSize);
    if (moonMapSize <= 0) {
      shadowState.moonType = 'none';
    } else if (wantsCascades && supportsCascades) {
      shadowState.moonGenerator = new BABYLON.CascadedShadowGenerator(
        moonMapSize,
        moonLight,
      );
      shadowState.moonType = 'cascaded';
      configureShadowGenerator(shadowState.moonGenerator, {cascaded: true});
    } else {
      shadowState.moonGenerator = new BABYLON.ShadowGenerator(
        moonMapSize,
        moonLight,
      );
      shadowState.moonType = 'standard';
      configureShadowGenerator(shadowState.moonGenerator);
    }
    if (wardenMapSize > 0) {
      shadowState.wardenGenerator = new BABYLON.ShadowGenerator(
        wardenMapSize,
        wardenLight,
      );
      configureShadowGenerator(shadowState.wardenGenerator, {warden: true});
    }
    shadowState.lastRefreshAt = -Infinity;
    refreshShadowCasters(performance.now() / 1000, true);
  }

  function refreshShadowCasters(now, force = false) {
    if (!force && now - shadowState.lastRefreshAt < 0.35) return;
    shadowState.lastRefreshAt = now;
    updateMaterialLightBudgets();
    const nextCasters = scene.meshes.filter(eligibleShadowCaster);
    shadowState.casters.splice(0, shadowState.casters.length, ...nextCasters);
    const moonMap = shadowMapFor(shadowState.moonGenerator);
    if (moonMap && moonMap.renderList !== shadowState.casters) moonMap.renderList = shadowState.casters;
    const wardenMap = shadowMapFor(shadowState.wardenGenerator);
    if (!wardenMap) {
      shadowState.wardenCasters.length = 0;
      return;
    }
    const nextWardenCasters = shadowState.casters.filter(mesh => {
      if (/(?:forest|tree|walkable|floor|road|ground|apron|landing|deck)/iu.test(mesh.name || '')) return false;
      if (mesh.metadata?.approachSurface || mesh.metadata?.decorativeGround) return false;
      const sphere = mesh.getBoundingInfo?.().boundingSphere;
      const centre = sphere?.centerWorld;
      const radius = Number(sphere?.radiusWorld) || 0;
      if (!centre) return false;
      return BABYLON.Vector3.DistanceSquared(centre, camera.position)
        <= (24 + radius) * (24 + radius);
    });
    shadowState.wardenCasters.splice(0, shadowState.wardenCasters.length, ...nextWardenCasters);
    if (wardenMap.renderList !== shadowState.wardenCasters) wardenMap.renderList = shadowState.wardenCasters;
  }

  function setLightingQuality(value, options = {}) {
    const next = lightingProfileForQuality(value, options);
    const rebuild = !shadowState.moonGenerator
      || next.key !== lightingProfile.key
      || next.moonShadowMapSize !== lightingProfile.moonShadowMapSize
      || next.wardenShadowMapSize !== lightingProfile.wardenShadowMapSize;
    lightingProfile = next;
    torches.setProfile(lightingProfile);
    updateMaterialLightBudgets(true);
    if (rebuild) rebuildShadowGenerators();
    setWorldPresentationProfile(presentationProfile.key.startsWith('day') ? 'day' : 'night');
    return lightingProfile;
  }

  function setWorldPresentationProfile(profileId) {
    presentationProfile = worldPresentationProfile(profileId, {shadowsEnabled: lightingProfile.moonShadowMapSize > 0});
    torches.setPresentationProfile(presentationProfile);
    scene.clearColor = BABYLON.Color4.FromHexString(`${presentationProfile.skyColor}ff`);
    scene.fogColor = BABYLON.Color3.FromHexString(presentationProfile.fogColor);
    scene.fogDensity = presentationProfile.fogDensity;
    hemi.intensity = presentationProfile.hemiIntensity;
    const celestial = worldCelestialPresentation(presentationProfile);
    // A neutral daylight fill preserves moss and leather. At night a blue
    // hemisphere separates stone from the existing amber torch pools without
    // adding lights, shadow maps, or a post-processing dependency.
    hemi.diffuse = BABYLON.Color3.FromHexString(celestial.fillLightColor);
    hemi.groundColor = BABYLON.Color3.FromHexString(celestial.groundLightColor);
    moonLight.intensity = celestial.keyLightIntensity;
    moonLight.diffuse = BABYLON.Color3.FromHexString(celestial.keyLightColor);
    mats.sky.diffuseTexture = celestial.stormTextureVisible ? skyTexture : null;
    mats.sky.emissiveTexture = celestial.stormTextureVisible ? skyTexture : null;
    mats.sky.emissiveColor = BABYLON.Color3.FromHexString(celestial.skyEmissiveColor);
    moon.setEnabled(celestial.moonVisible);
    return presentationProfile;
  }

  function setReducedMotion(value) {
    reducedMotion = value === true;
    torches.setReducedMotion(reducedMotion);
    return reducedMotion;
  }

  function applyHubLandmarkVisibility() {
    const visible = hubPresentationState.worldVisible;
    for (const [npcId, mesh] of hubLandmarkMeshes) {
      mesh.setEnabled(visible && hubPresentationState.activeNpcs.includes(npcId));
      if (npcId === HUB_NPC_IDS.QUARTERMASTER) {
        mesh.visibility = hubPresentationState.quartermasterStores === 'ready' ? 1 : 0.5;
      } else if (npcId === HUB_NPC_IDS.TRAPPER) {
        mesh.visibility = hubPresentationState.trapperWorkshop === 'ready' ? 1 : 0.58;
      } else if (npcId === HUB_NPC_IDS.GREENWARDEN) {
        mesh.visibility = hubPresentationState.greenwardenShrine === 'awake' ? 1 : 0.4;
      } else {
        mesh.visibility = 1;
      }
    }
  }

  function setHubPresentation(input = {}) {
    hubPresentationState = resolveHubPresentationState(input);
    wardenLight.setEnabled(hubPresentationState.worldVisible);
    hubRepairPresentation.apply(hubPresentationState);
    applyHubLandmarkVisibility();
    return hubPresentationState;
  }

  function applyCameraProfile(profile) {
    camera.position.set(profile.position.x, profile.position.y, profile.position.z);
    camera.fov = profile.fieldOfView;
    camera.setTarget(new BABYLON.Vector3(profile.target.x, profile.target.y, profile.target.z));
    camera.computeWorldMatrix(true);
    return profile;
  }

  function stationCamera(station, layout) {
    activeStation = station === 'east' ? 'east' : 'west';
    return applyCameraProfile(resolveStationCamera(activeStation, layout));
  }

  function setFirstPersonPose(player, deltaSeconds = null, {aiming = false} = {}) {
    const targetEyeHeight = Number(player?.eyeHeight) || 1.62;
    presentedEyeHeight = smoothPresentedEyeHeight(
      presentedEyeHeight,
      targetEyeHeight,
      deltaSeconds
    );
    firstPersonBasePosition.x = Number(player?.position?.x) || 0;
    firstPersonBasePosition.y = (Number(player?.position?.y) || 0) + presentedEyeHeight;
    firstPersonBasePosition.z = Number(player?.position?.z) || 0;
    const bob = advanceWalkBob(walkBobState, {
      deltaSeconds,
      horizontalSpeed: Math.hypot(Number(player?.velocity?.x) || 0, Number(player?.velocity?.z) || 0),
      grounded: player?.grounded === true,
      sliding: player?.sliding === true,
      mantling: Boolean(player?.mantleState),
      aiming,
      reducedMotion,
    });
    walkBobState = bob.state;
    const yaw = Number(player?.facing?.yaw) || 0;
    camera.position.set(
      firstPersonBasePosition.x + Math.cos(yaw) * bob.offset.right,
      firstPersonBasePosition.y + bob.offset.up,
      firstPersonBasePosition.z - Math.sin(yaw) * bob.offset.right
    );
    camera.rotation.set(
      Number(player?.facing?.pitch) || 0,
      Number(player?.facing?.yaw) || 0,
      0
    );
    camera.fov = Number(player?.fieldOfView) || 1.12;
    camera.computeWorldMatrix(true);
    const forward = camera.getDirection(BABYLON.Axis.Z);
    wardenLight.position.copyFrom(camera.position);
    wardenLight.position.addInPlace(forward.scale(WARDEN_LIGHT_PROFILE.forwardOffset));
    wardenLight.position.y += WARDEN_LIGHT_PROFILE.verticalOffset;
    wardenLight.direction.copyFrom(forward);
    wardenLight.direction.y += WARDEN_LIGHT_PROFILE.downwardBias;
    wardenLight.direction.normalize();
    return {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      facing: { yaw: camera.rotation.y, pitch: camera.rotation.x }
    };
  }

  function firstPersonRay(maxDistance = 160) {
    const length = Math.max(0.1, Number(maxDistance) || 160);
    const cameraRay = camera.getForwardRay(length);
    const ray = new BABYLON.Ray(
      new BABYLON.Vector3(firstPersonBasePosition.x, firstPersonBasePosition.y, firstPersonBasePosition.z),
      cameraRay.direction,
      length,
    );
    return {
      origin: { x: ray.origin.x, y: ray.origin.y, z: ray.origin.z },
      direction: { x: ray.direction.x, y: ray.direction.y, z: ray.direction.z },
      length: ray.length,
      babylonRay: ray
    };
  }

  function firstPersonMuzzlePoint(options = {}) {
    const viewportX = clamp(
      Number.isFinite(Number(options.viewportX)) ? Number(options.viewportX) : DEFAULT_VIEWMODEL_MUZZLE.viewportX,
      0,
      1
    );
    const viewportY = clamp(
      Number.isFinite(Number(options.viewportY)) ? Number(options.viewportY) : DEFAULT_VIEWMODEL_MUZZLE.viewportY,
      0,
      1
    );
    const depth = Math.max(
      0.2,
      Number.isFinite(Number(options.depth)) ? Number(options.depth) : DEFAULT_VIEWMODEL_MUZZLE.depth
    );
    const viewportWidth = Number(canvas.clientWidth) || Number(canvas.getBoundingClientRect?.().width)
      || engine.getRenderWidth();
    const viewportHeight = Number(canvas.clientHeight) || Number(canvas.getBoundingClientRect?.().height)
      || engine.getRenderHeight();
    const point = resolveViewmodelMuzzleWorldPoint({
      position: camera.position,
      forward: camera.getDirection(BABYLON.Axis.Z),
      right: camera.getDirection(BABYLON.Axis.X),
      up: camera.getDirection(BABYLON.Axis.Y),
      viewportX,
      viewportY,
      depth,
      fieldOfView: camera.fov,
      aspectRatio: viewportWidth / Math.max(1, viewportHeight),
    });
    return point
      ? new BABYLON.Vector3(point.x, point.y, point.z)
      : camera.position.clone();
  }

  function isWorldOccluded(origin, target, padding = 0.08) {
    if (!origin || !target) return false;
    const start = new BABYLON.Vector3(origin.x, origin.y, origin.z);
    const end = new BABYLON.Vector3(target.x, target.y, target.z);
    const direction = end.subtract(start);
    const distance = direction.length();
    if (!(distance > padding)) return false;
    const ray = new BABYLON.Ray(start, direction.normalize(), Math.max(0.01, distance - padding));
    // The ray ends at the logical target, so any accepted world hit proves
    // occlusion. Fast-check avoids walking the rest of the static fortress
    // after Babylon finds the first blocker.
    const pick = scene.pickWithRay(ray, mesh => mesh.metadata?.worldOccluder === true, true);
    return Boolean(pick?.hit && pick.distance < distance - padding);
  }

  function firstWorldRayHit(origin, direction, maxDistance = 160) {
    if (!origin || !direction) return null;
    const start = new BABYLON.Vector3(origin.x, origin.y, origin.z);
    const vector = new BABYLON.Vector3(direction.x, direction.y, direction.z);
    const length = Math.max(0, Number(maxDistance) || 0);
    if (!(length > 0) || !(vector.lengthSquared() > 1e-12)) return null;
    const normalized = vector.normalize();
    const ray = new BABYLON.Ray(start, normalized, length);
    const pick = scene.pickWithRay(ray, mesh => mesh.metadata?.worldOccluder === true, true);
    if (!pick?.hit) return null;
    const distance = Number(pick.distance);
    if (!Number.isFinite(distance) || distance < 0 || distance > length) return null;
    const point = pick.pickedPoint || start.add(normalized.scale(distance));
    return Object.freeze({
      distance,
      point: Object.freeze({x: point.x, y: point.y, z: point.z}),
    });
  }

  function planningCamera(area = selectedSocketId, layout = planningLayout) {
    const focus = typeof area === 'string' ? area : null;
    return applyCameraProfile(resolvePlanningCamera(layout, focus));
  }

  function screenToAimPoint(clientX, clientY, options = {}) {
    const rect = canvas?.getBoundingClientRect?.();
    const renderPoint = mapClientPointToRender(
      clientX,
      clientY,
      rect,
      engine.getRenderWidth(),
      engine.getRenderHeight()
    );
    if (!renderPoint) return null;
    const ray = scene.createPickingRay(
      renderPoint.x,
      renderPoint.y,
      BABYLON.Matrix.Identity(),
      camera,
      false
    );
    const projected = intersectRayWithAimPlane(ray, options);
    if (projected) {
      aimProjectionCount += 1;
      lastAimProjection = projected;
    }
    return projected;
  }

  function socketSnapshot(socket) {
    return fortificationSocketSnapshot(socket);
  }

  function refreshSocketAppearance() {
    for (const socket of sockets) {
      const selected = socket.id === selectedSocketId;
      const occupied = fortificationVisuals.has(socket.id);
      socket.mesh.visibility = planningEnabled
        ? selected ? 0.82 : occupied ? 0.2 : 0.48
        : occupied ? 0.12 : 0;
      const scale = selected && planningEnabled ? 1.16 : planningEnabled ? 0.9 : 1;
      socket.mesh.scaling.setAll(scale);
      socket.mesh.position.y = socket.y + (selected && planningEnabled ? 0.28 : 0.12);
      socket.mesh.isPickable = false;
      socket.pickMesh.isPickable = planningEnabled;
      socket.pickMesh.visibility = planningEnabled ? 0.001 : 0;
    }
  }

  function clearFortificationPreview() {
    if (!fortificationPreview) return false;
    fortificationPreview.meshes.forEach(mesh => {
      if (meshyFieldDefences.releaseInstance(mesh)) {
        // Field-template accounting is handled by the shared loader.
      } else if (mesh.metadata?.meshy && meshyBallista.state.instances > 0) {
        meshyBallista.state.instances -= 1;
      }
      mesh.dispose();
    });
    fortificationPreview = null;
    refreshSocketAppearance();
    return true;
  }

  function createPreviewMeshes(socket, type) {
    const name = `fortification-preview-${socket.id}-${type}`;
    const meshes = [];
    const meshyFieldDefence = Object.hasOwn(MESHY_FIELD_DEFENCE_ASSETS, type)
      ? meshyFieldDefences.createInstance(type, name, socket, {preview: true})
      : null;
    if (meshyFieldDefence) {
      meshes.push(meshyFieldDefence);
    } else if (type === 'barricade') {
      const beam = addBox(BABYLON, scene, `${name}-beam`, { width: 5.4, height: 0.9, depth: 1.1 }, { x: socket.x, y: socket.y + 0.55, z: socket.z }, mats.woodLight);
      beam.rotation.z = 0.12;
      meshes.push(beam);
    } else if (type === 'thornSnare') {
      const snare = BABYLON.MeshBuilder.CreateTorus(`${name}-thorns`, { diameter: 5.4, thickness: 0.34, tessellation: 18 }, scene);
      snare.position.set(socket.x, socket.y + 0.18, socket.z);
      snare.rotation.x = Math.PI / 2;
      snare.material = mats.leaves;
      snare.isPickable = false;
      meshes.push(snare);
    } else if (type === 'firePot') {
      const pot = BABYLON.MeshBuilder.CreateCylinder(`${name}-pot`, { height: 1.35, diameterTop: 0.92, diameterBottom: 1.35, tessellation: 10 }, scene);
      pot.position.set(socket.x, socket.y + 0.68, socket.z);
      pot.material = mats.wood;
      pot.isPickable = false;
      meshes.push(pot);
    } else if (type === 'wardLantern') {
      const post = BABYLON.MeshBuilder.CreateCylinder(`${name}-post`, { height: 3.4, diameter: 0.24, tessellation: 8 }, scene);
      post.position.set(socket.x, socket.y + 1.7, socket.z);
      post.material = mats.metal;
      post.isPickable = false;
      const lantern = BABYLON.MeshBuilder.CreateSphere(`${name}-lantern`, { diameter: 0.72, segments: 8 }, scene);
      lantern.position.set(socket.x, socket.y + 3.42, socket.z);
      lantern.material = mats.spore;
      lantern.isPickable = false;
      meshes.push(post, lantern);
    } else if (type === 'ballista') {
      const meshy = meshyBallista.createInstance(name, socket, {preview: true});
      if (meshy) {
        meshes.push(meshy);
      } else {
        const base = addBox(BABYLON, scene, `${name}-base`, { width: 2.5, height: 0.65, depth: 2.5 }, { x: socket.x, y: socket.y + 0.34, z: socket.z }, mats.metal);
        const stock = addBox(BABYLON, scene, `${name}-stock`, { width: 0.55, height: 0.55, depth: 4.4 }, { x: socket.x, y: socket.y + 1.35, z: socket.z + 0.35 }, mats.woodLight);
        meshes.push(base, stock);
      }
    } else {
      throw new RangeError(`unknown fortification visual ${type}`);
    }
    meshes.forEach(mesh => {
      if (type !== 'ballista' || !mesh.metadata?.meshy) mesh.material = mats.preview;
      mesh.visibility = 0.86;
      mesh.isPickable = false;
      if (!mesh.metadata?.meshy) mesh.rotation.y += socket.facing;
    });
    return meshes;
  }

  function previewFortification(socketId, type = null) {
    clearFortificationPreview();
    if (type == null) return null;
    const socket = socketForId(socketId);
    if (
      !planningEnabled ||
      !socket ||
      fortificationVisuals.has(socket.id) ||
      !socket.allowedTypes.includes(type)
    ) return null;
    const meshes = createPreviewMeshes(socket, type);
    fortificationPreview = { socket, type, meshes };
    refreshSocketAppearance();
    return Object.freeze({ socketId: socket.id, legacyId: socket.legacyId, type, valid: true });
  }

  function setSelectedSocket(socketId = null) {
    const socket = socketId == null ? null : socketForId(socketId);
    if (socketId != null && !socket) {
      throw new RangeError(`unknown fortification socket ${socketId}`);
    }
    if (fortificationPreview && fortificationPreview.socket.id !== socket?.id) clearFortificationPreview();
    selectedSocketId = socket?.id ?? null;
    refreshSocketAppearance();
    if (planningEnabled) planningCamera(selectedSocketId, planningLayout);
    return socketSnapshot(socket);
  }

  function setPlanningMode(enabled, layout = planningLayout) {
    planningEnabled = Boolean(enabled);
    if (layout) planningLayout = layout;
    if (!planningEnabled) clearFortificationPreview();
    refreshSocketAppearance();
    if (planningEnabled) planningCamera(selectedSocketId, planningLayout);
    else stationCamera(activeStation, layout ?? planningLayout);
    return planningEnabled;
  }

  function pickFortificationSocket(clientX, clientY) {
    if (!planningEnabled) return null;
    const rect = canvas?.getBoundingClientRect?.();
    const renderPoint = mapClientPointToRender(
      clientX, clientY, rect, engine.getRenderWidth(), engine.getRenderHeight()
    );
    if (!renderPoint) return null;
    planningPickCount += 1;
    const result = scene.pick(
      renderPoint.x,
      renderPoint.y,
      mesh => socketPickMeshes.has(mesh),
      false,
      camera
    );
    const socket = result?.hit
      ? sockets.find(item => item.pickMesh === result.pickedMesh)
      : null;
    if (socket) planningPickHits += 1;
    lastPlanningPick = {
      clientX: Number(clientX),
      clientY: Number(clientY),
      renderX: renderPoint.x,
      renderY: renderPoint.y,
      socketId: socket?.id ?? null
    };
    return socketSnapshot(socket);
  }

  function updateGateVisual(id, ratio, breached = false) {
    const mesh = castle.gates[id];
    if (!mesh) return;
    mesh.scaling.y = breached ? 0.12 : Math.max(0.2, Math.min(1, ratio));
    mesh.position.y = breached ? 0.42 : (id === 'heart' ? 4 : 3.5) * mesh.scaling.y;
    const emissive = breached
      ? BABYLON.Color3.FromHexString('#5e160f')
      : BABYLON.Color3.FromHexString(ratio < 0.3 ? '#402016' : id === 'heart' ? '#010604' : '#000000');
    const materials = [mesh.material, ...mesh.getChildMeshes(false).map(child => child.material)];
    for (const gateMaterial of new Set(materials.filter(Boolean))) {
      if ('emissiveColor' in gateMaterial) gateMaterial.emissiveColor = emissive;
    }
  }

  function clearFortificationVisual(socketId) {
    const socket = socketForId(socketId);
    const record = socket ? fortificationVisuals.get(socket.id) : null;
    if (!record) return false;
    record.meshes.forEach(mesh => {
      if (meshyFieldDefences.releaseInstance(mesh)) {
        // Field-template accounting is handled by the shared loader.
      } else if (mesh.metadata?.meshy && meshyBallista.state.instances > 0) {
        meshyBallista.state.instances -= 1;
      }
      mesh.dispose();
    });
    fortificationVisuals.delete(record.socket.id);
    refreshSocketAppearance();
    return true;
  }

  function updateFortificationStatus(socketId, status = {}) {
    const socket = socketForId(socketId);
    const record = socket ? fortificationVisuals.get(socket.id) : null;
    if (!record) return null;
    record.status = { ...record.status, ...status };
    const disabled = record.status.disabled === true || record.status.active === false;
    const requestedIntegrity = Number(record.status.integrityRatio ?? 1);
    const integrity = Number.isFinite(requestedIntegrity) ? clamp(requestedIntegrity, 0, 1) : 1;
    record.meshes.forEach(mesh => {
      mesh.visibility = disabled ? 0.35 : Math.max(0.18, integrity);
    });
    return Object.freeze({ socketId: record.socket.id, legacyId: record.socket.legacyId, type: record.type, status: { ...record.status } });
  }

  function placeFortificationVisual(socketId, type, status = {}) {
    const socket = socketForId(socketId);
    if (!socket) throw new RangeError(`unknown fortification socket ${socketId}`);
    if (!['barricade', 'thornSnare', 'firePot', 'wardLantern', 'ballista'].includes(type)) {
      throw new RangeError(`unknown fortification visual ${type}`);
    }
    if (!socket.allowedTypes.includes(type)) {
      throw new RangeError(`${type} is not allowed at fortification socket ${socket.id}`);
    }
    clearFortificationVisual(socket.id);
    const meshes = [];
    const name = `fortification-${socketId}-${type}`;
    const meshyFieldDefence = Object.hasOwn(MESHY_FIELD_DEFENCE_ASSETS, type)
      ? meshyFieldDefences.createInstance(type, name, socket)
      : null;
    if (meshyFieldDefence) {
      meshes.push(meshyFieldDefence);
    } else if (type === 'barricade') {
      for (const [index, offset] of [-0.65, 0, 0.65].entries()) {
        const beam = addBox(
          BABYLON, scene, `${name}-beam-${index}`,
          { width: 5.4, height: 0.48, depth: 0.5 },
          { x: socket.x, y: socket.y + 0.55 + index * 0.42, z: socket.z + offset },
          mats.woodLight
        );
        beam.rotation.z = index === 1 ? 0.13 : -0.13;
        meshes.push(beam);
      }
    } else if (type === 'thornSnare') {
      const snare = BABYLON.MeshBuilder.CreateTorus(`${name}-thorns`, {
        diameter: 5.4, thickness: 0.34, tessellation: 18
      }, scene);
      snare.position.set(socket.x, socket.y + 0.18, socket.z);
      snare.rotation.x = Math.PI / 2;
      snare.material = mats.leaves;
      snare.isPickable = false;
      meshes.push(snare);
    } else if (type === 'firePot') {
      const pot = BABYLON.MeshBuilder.CreateCylinder(`${name}-pot`, {
        height: 1.35, diameterTop: 0.92, diameterBottom: 1.35, tessellation: 10
      }, scene);
      pot.position.set(socket.x, socket.y + 0.68, socket.z);
      pot.material = mats.wood;
      pot.isPickable = false;
      const flame = BABYLON.MeshBuilder.CreateSphere(`${name}-flame`, { diameter: 0.55, segments: 6 }, scene);
      flame.position.set(socket.x, socket.y + 1.58, socket.z);
      flame.material = mats.flame;
      flame.isPickable = false;
      meshes.push(pot, flame);
    } else if (type === 'wardLantern') {
      const post = BABYLON.MeshBuilder.CreateCylinder(`${name}-post`, {
        height: 3.4, diameter: 0.24, tessellation: 8
      }, scene);
      post.position.set(socket.x, socket.y + 1.7, socket.z);
      post.material = mats.metal;
      post.isPickable = false;
      const lantern = BABYLON.MeshBuilder.CreateSphere(`${name}-lantern`, { diameter: 0.72, segments: 8 }, scene);
      lantern.position.set(socket.x, socket.y + 3.42, socket.z);
      lantern.material = mats.spore;
      lantern.isPickable = false;
      meshes.push(post, lantern);
    } else {
      const meshy = meshyBallista.createInstance(name, socket);
      if (meshy) {
        meshes.push(meshy);
      } else {
        const base = addBox(BABYLON, scene, `${name}-base`, { width: 2.5, height: 0.65, depth: 2.5 }, { x: socket.x, y: socket.y + 0.34, z: socket.z }, mats.metal);
        const stock = addBox(BABYLON, scene, `${name}-stock`, { width: 0.55, height: 0.55, depth: 4.4 }, { x: socket.x, y: socket.y + 1.35, z: socket.z + 0.35 }, mats.woodLight);
        const bow = addBox(BABYLON, scene, `${name}-bow`, { width: 4.6, height: 0.34, depth: 0.34 }, { x: socket.x, y: socket.y + 1.5, z: socket.z + 1.55 }, mats.metal);
        meshes.push(base, stock, bow);
      }
    }
    meshes.forEach(mesh => {
      if (!mesh.metadata?.meshy) mesh.rotation.y += socket.facing;
    });
    const record = { socket, type, meshes, status: {}, pulseUntil: 0 };
    fortificationVisuals.set(socket.id, record);
    if (fortificationPreview?.socket.id === socket.id) clearFortificationPreview();
    refreshSocketAppearance();
    return updateFortificationStatus(socketId, status);
  }

  function triggerFortificationVisual(socketId, status = null) {
    const socket = socketForId(socketId);
    const record = socket ? fortificationVisuals.get(socket.id) : null;
    if (!record) return false;
    if (status) updateFortificationStatus(socketId, status);
    record.pulseUntil = performance.now() / 1000 + 0.28;
    fortificationTriggers += 1;
    const color = record.type === 'firePot' ? '#ff7b32' : record.type === 'wardLantern' ? '#79d68f' : '#d8f0c8';
    impact(new BABYLON.Vector3(record.socket.x, record.socket.y + 0.7, record.socket.z), color, record.type === 'firePot' ? 3.2 : 1.4);
    return true;
  }

  function clearFortificationVisuals() {
    for (const socketId of [...fortificationVisuals.keys()]) clearFortificationVisual(socketId);
  }

  function updateFortification(socketId, placement = null) {
    const socket = socketForId(socketId);
    if (!socket) throw new RangeError(`unknown fortification socket ${socketId}`);
    if (fortificationPreview?.socket.id === socket.id) clearFortificationPreview();
    if (!placement) {
      clearFortificationVisual(socket.id);
      return null;
    }
    const type = placement.type;
    const existing = fortificationVisuals.get(socket.id);
    if (!existing || existing.type !== type) return placeFortificationVisual(socket.id, type, placement);
    return updateFortificationStatus(socket.id, placement);
  }

  function setFortifications(plan = {}) {
    const placements = plan?.placements ?? {};
    for (const socket of sockets) {
      updateFortification(socket.id, placements[socket.id] ?? placements[socket.legacyId] ?? null);
    }
    return Object.freeze({ placed: fortificationVisuals.size });
  }

  function triggerFortification(socketId, kindOrState = null, state = null) {
    const socket = socketForId(socketId);
    if (!socket) return false;
    if (typeof kindOrState === 'string') {
      const existing = fortificationVisuals.get(socket.id);
      if (!existing || existing.type !== kindOrState) {
        placeFortificationVisual(socket.id, kindOrState, state ?? {});
      } else if (state) {
        updateFortificationStatus(socket.id, state);
      }
    } else if (kindOrState && typeof kindOrState === 'object') {
      updateFortificationStatus(socket.id, kindOrState);
    }
    return triggerFortificationVisual(socket.id);
  }

  function upgradeLoadedFieldDefenceFallbacks() {
    let upgraded = 0;
    for (const record of [...fortificationVisuals.values()]) {
      if (
        !Object.hasOwn(MESHY_FIELD_DEFENCE_ASSETS, record.type)
        || record.meshes.some(mesh => mesh.metadata?.fieldDefence)
        || meshyFieldDefences.state.byType[record.type]?.status !== 'ready'
      ) continue;
      placeFortificationVisual(record.socket.id, record.type, {...record.status});
      upgraded += 1;
    }
    if (
      fortificationPreview
      && Object.hasOwn(MESHY_FIELD_DEFENCE_ASSETS, fortificationPreview.type)
      && !fortificationPreview.meshes.some(mesh => mesh.metadata?.fieldDefence)
      && meshyFieldDefences.state.byType[fortificationPreview.type]?.status === 'ready'
    ) {
      const {socket, type} = fortificationPreview;
      clearFortificationPreview();
      fortificationPreview = {socket, type, meshes: createPreviewMeshes(socket, type)};
      upgraded += 1;
    }
    meshyFieldDefences.state.upgrades = upgraded;
    return upgraded;
  }

  const meshyFieldDefencesReady = meshyFieldDefences.ready.then(meshes => {
    upgradeLoadedFieldDefenceFallbacks();
    return meshes;
  });

  function impact(position, color = '#ffb454', scale = 1) {
    const record = impactPool[transientEffectPoolIndex(impactPool)];
    record.mesh.position.copyFrom(position);
    record.mesh.scaling.setAll(1);
    record.mat.emissiveColor.copyFrom(effectColor(color));
    record.mat.alpha = 1;
    record.born = performance.now() / 1000;
    record.life = 0.24;
    record.scale = scale;
    record.active = true;
    record.mesh.setEnabled(true);
  }

  function tracer(origin, target, color = '#ffe0a1', options = {}) {
    // `origin` remains in the public signature for compatibility with callers,
    // but a camera-origin line starts behind the near plane and can project as
    // a diagonal streak. Start at the rendered viewmodel's muzzle instead.
    const start = options.cameraRelative === false ? origin : firstPersonMuzzlePoint(options.muzzle);
    const record = tracerPool[transientEffectPoolIndex(tracerPool)];
    const direction = target.subtract(start);
    const length = direction.length();
    if (length < 0.001) return;
    direction.scaleInPlace(1 / length);
    const radius = Math.max(0.008, Number(options.radius) || 0.016);
    record.mesh.position.copyFrom(start).addInPlace(target).scaleInPlace(0.5);
    record.mesh.scaling.copyFromFloats(radius * 2, length, radius * 2);
    const axis = BABYLON.Vector3.Cross(BABYLON.Axis.Y, direction);
    const dot = Math.max(-1, Math.min(1, BABYLON.Vector3.Dot(BABYLON.Axis.Y, direction)));
    if (axis.lengthSquared() < 1e-8) {
      record.mesh.rotationQuaternion.copyFrom(dot >= 0
        ? BABYLON.Quaternion.Identity()
        : BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, Math.PI));
    } else {
      axis.normalize();
      record.mesh.rotationQuaternion.copyFrom(BABYLON.Quaternion.RotationAxis(axis, Math.acos(dot)));
    }
    record.mat.emissiveColor.copyFrom(effectColor(color));
    record.mat.alpha = 1;
    record.born = performance.now() / 1000;
    record.life = 0.16;
    record.scale = 0;
    record.active = true;
    record.mesh.setEnabled(true);
    // Tracers are authored in absolute world coordinates. Scaling their mesh
    // would scale both endpoints around the world origin and make the bolt
    // appear to sweep in from unrelated parts of the screen.
  }

  function setThreat(value) {
    targetThreat = Math.max(0, Math.min(1, Number(value) || 0));
  }

  function updateEffects(now) {
    const dt = Math.max(0, Math.min(0.1, now - lastEffectsAt));
    lastEffectsAt = now;
    skyTexture.uOffset = stormSkyTextureOffset(now, reducedMotion);
    displayedThreat += (targetThreat - displayedThreat) * Math.min(1, dt * 2.8);
    const celestial = worldCelestialPresentation(presentationProfile);
    moonLight.intensity = Math.max(0, celestial.keyLightIntensity - displayedThreat * 0.18);
    hemi.intensity = Math.max(0, presentationProfile.hemiIntensity - displayedThreat * 0.05);
    torches.update(now, dt, camera, displayedThreat);
    refreshShadowCasters(now);
    scene.fogDensity = presentationProfile.fogDensity + displayedThreat * WORLD_ATMOSPHERE.threatFogGain;
    mats.spore.alpha = 0.62 + Math.sin(now * 1.7) * 0.13 + displayedThreat * 0.12;
    mats.flame.alpha = 0.98;
    banners.forEach((banner, index) => {
      banner.rotation.y = Math.sin(now * 0.62 + index) * 0.055;
    });
    if (planningEnabled) {
      sockets.forEach((socket, index) => {
        const selected = socket.id === selectedSocketId;
        const base = selected ? 1.16 : 0.9;
        const pulse = 1 + Math.sin(now * 3.2 + index * 0.7) * (selected ? 0.09 : 0.055);
        socket.mesh.scaling.setAll(base * pulse);
      });
      if (fortificationPreview) {
        const previewPulse = 0.78 + Math.sin(now * 4.6) * 0.12;
        fortificationPreview.meshes.forEach(mesh => { mesh.visibility = previewPulse; });
      }
    }
    for (const record of fortificationVisuals.values()) {
      const pulse = now < record.pulseUntil ? 1 + Math.sin((record.pulseUntil - now) * 34) * 0.12 : 1;
      record.meshes.forEach(mesh => {
        mesh.scaling.x = pulse;
        mesh.scaling.y = pulse;
        mesh.scaling.z = pulse;
      });
    }
    for (let index = effects.length - 1; index >= 0; index -= 1) {
      const effect = effects[index];
      if (!effect.active) continue;
      const age = now - effect.born;
      if (age >= effect.life) {
        effect.active = false;
        effect.mesh.setEnabled(false);
        continue;
      }
      if (effect.kind !== 'tracer') {
        effect.mesh.scaling.setAll(transientEffectScale(age, effect.life, effect.scale));
      }
      if (effect.mat) effect.mat.alpha = 1 - age / effect.life;
    }
  }

  setLightingQuality(lowSpec ? 'performance' : 'balanced');
  setReducedMotion(false);
  refreshSocketAppearance();

  return {
    scene,
    camera,
    ground,
    hostRoad,
    environmentReady: Promise.all([
      meshyFortressWallReady,
      meshyFortressWatchtowersReady,
      meshyFortressGateArchReady,
      meshyBallista.ready,
      meshyFieldDefencesReady,
      meshyDefenderCachesReady,
      meshyForest.ready,
      meshyBattlefieldVerge.ready,
      meshyBraziersReady,
      meshyHubWaveBell.ready,
      meshyCourtyardServiceArcadesReady,
      hubLandmarksReady,
    ]),
    assetState: {
      meshyForest: meshyForest.state,
      meshyBattlefieldVerge: meshyBattlefieldVerge.state,
      meshyBraziers: meshyBraziers.state,
      meshyFieldDefences: meshyFieldDefences.state,
      meshyHubWaveBell: meshyHubWaveBell.state,
      meshyCourtyardServiceArcades: meshyCourtyardServiceArcades.state,
      meshyRampartStair: meshyRampartStair.state,
      hubLandmarks: hubLandmarkState,
    },
    sockets,
    coordinates: WORLD_COORDINATES,
    stationCamera,
    setFirstPersonPose,
    firstPersonRay,
    firstPersonMuzzlePoint,
    firstWorldRayHit,
    isWorldOccluded,
    planningCamera,
    setPlanningMode,
    pickFortificationSocket,
    setSelectedSocket,
    previewFortification,
    clearFortificationPreview,
    screenToAimPoint,
    updateGateVisual,
    setHubPresentation,
    setLightingQuality,
    setWorldPresentationProfile,
    setReducedMotion,
    setFortifications,
    updateFortification,
    triggerFortification,
    placeFortificationVisual,
    updateFortificationStatus,
    triggerFortificationVisual,
    clearFortificationVisual,
    clearFortificationVisuals,
    setThreat,
    impact,
    tracer,
    updateEffects,
    diagnostics() {
      const target = camera.getTarget();
      const cameraProfile = {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: target.x, y: target.y, z: target.z },
        fieldOfView: camera.fov
      };
      const aspectRatio = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
      const nearGateProjection = projectWorldPointToCamera(cameraProfile, {
        x: target.x, y: AIM_PLANE_Y, z: 0
      }, aspectRatio);
      const farSpawnProjection = projectWorldPointToCamera(cameraProfile, {
        x: target.x, y: AIM_PLANE_Y, z: BATTLEFIELD_AIM_BOUNDS.maxZ
      }, aspectRatio);
      return {
        trees: forest.count,
        meshyForest: {...meshyForest.state},
        meshyBattlefieldVerge: {...meshyBattlefieldVerge.state},
        meshyBraziers: {...meshyBraziers.state},
        meshyFortressWall: {...meshyFortressWall.state},
        meshyFortressWatchtowers: {...meshyFortressWatchtowers.state},
        meshyFortressGateArch: {...meshyFortressGateArch.state},
        meshyRampartStair: {...meshyRampartStair.state},
        meshyBallista: {...meshyBallista.state},
        meshyFieldDefences: {
          ...meshyFieldDefences.state,
          byType: Object.fromEntries(
            Object.entries(meshyFieldDefences.state.byType).map(([type, value]) => [type, {...value}]),
          ),
        },
        meshyDefenderCaches: {...meshyDefenderCaches.state},
        meshyHubWaveBell: {...meshyHubWaveBell.state},
        meshyCourtyardServiceArcades: {...meshyCourtyardServiceArcades.state},
        hubLandmarks: {
          ...hubLandmarkState,
          ...hubRepairPresentation.diagnostics(),
          activeMeshes: [...hubLandmarkMeshes.entries()]
            .filter(([, mesh]) => mesh.isEnabled())
            .map(([npcId]) => npcId),
        },
        castleTrimInstances: castleTrim.count,
        traversalMeshes: traversal.length,
        roadStoneInstances: roadStones.thinInstanceCount,
        briarLines: briars.length,
        sporeInstances: motes.thinInstanceCount,
        defensiveFlameInstances: torches.flameCount,
        torchBracketInstances: torches.bracketCount,
        lighting: {
          profile: lightingProfile.key,
          reducedMotion,
          materialLightBudget: lightingProfile.maxMaterialLights,
          moonShadowType: shadowState.moonType,
          moonShadowMapSize: shadowState.moonGenerator?.mapSize ?? 0,
          moonShadowCascades: shadowState.moonType === 'cascaded'
            ? shadowState.moonGenerator?.numCascades ?? 0
            : Number(Boolean(shadowState.moonGenerator)),
          moonCasterCount: shadowState.casters.length,
          wardenShadowMapSize: shadowState.wardenGenerator?.mapSize ?? 0,
          wardenCasterCount: shadowState.wardenCasters.length,
          wardenLight: {
            enabled: wardenLight.isEnabled(),
            position: [wardenLight.position.x, wardenLight.position.y, wardenLight.position.z],
            direction: [wardenLight.direction.x, wardenLight.direction.y, wardenLight.direction.z],
            intensity: wardenLight.intensity,
          },
          fire: torches.diagnostics(),
        },
        targetThreat,
        displayedThreat,
        effects: effects.reduce((count, effect) => count + Number(effect.active), 0),
        effectPoolSize: effects.length,
        moon: Boolean(moon),
        stormSky: Boolean(sky),
        render: {
          width: engine.getRenderWidth(),
          height: engine.getRenderHeight(),
          hardwareScalingLevel: engine.getHardwareScalingLevel?.() ?? null,
          canvasWidth: canvas?.width ?? null,
          canvasHeight: canvas?.height ?? null,
          clientWidth: canvas?.clientWidth ?? null,
          clientHeight: canvas?.clientHeight ?? null
        },
        aimProjection: {
          count: aimProjectionCount,
          last: lastAimProjection ? { ...lastAimProjection } : null,
          planeY: AIM_PLANE_Y,
          bounds: { ...BATTLEFIELD_AIM_BOUNDS }
        },
        planning: {
          enabled: planningEnabled,
          selectedSocketId,
          sockets: sockets.map(socketSnapshot),
          preview: fortificationPreview ? {
            socketId: fortificationPreview.socket.id,
            type: fortificationPreview.type
          } : null,
          picks: planningPickCount,
          pickHits: planningPickHits,
          lastPick: lastPlanningPick ? { ...lastPlanningPick } : null,
          pickableSockets: sockets.filter(socket => socket.pickMesh.isPickable).length
        },
        fortifications: {
          placed: fortificationVisuals.size,
          triggers: fortificationTriggers,
          sockets: [...fortificationVisuals.values()].map(record => ({
            socketId: record.socket.id,
            legacySocketId: record.socket.legacyId,
            x: record.socket.x,
            y: record.socket.y,
            z: record.socket.z,
            allowedTypes: [...record.socket.allowedTypes],
            type: record.type,
            status: { ...record.status }
          }))
        },
        camera: {
          ...cameraProfile,
          parapetClearance: sightlineClearanceAtWall(cameraProfile),
          nearGateProjection,
          farSpawnProjection
        }
      };
    },
    dispose() {
      clearFortificationPreview();
      clearFortificationVisuals();
      scene.dispose();
    }
  };
}

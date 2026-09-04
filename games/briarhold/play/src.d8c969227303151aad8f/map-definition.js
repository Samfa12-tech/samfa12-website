const VALID_SURFACE_KINDS = new Set(["flat", "ramp"]);
const VALID_COLLISION_APPEARANCES = new Set([
  "briar-fence",
  "ramp-rail",
  "stone-parapet",
  "defender-cache",
  "defender-brazier",
  "service-arcade",
]);

// One shared world contract keeps horde staging, the visible forest road, and
// the rear-tree opening in agreement. The vanguard starts behind the trees and
// becomes readable within the opening seconds; later companies still occupy
// deep ranks and retain their authored release cadence.
export const HOST_EMERGENCE_PROFILE = Object.freeze({
  lane: "west",
  laneCenterX: -16,
  treeLineZ: 117.72,
  treeLaneHalfWidth: 7.5,
  // The first company waits immediately behind the rear forest, then breaks
  // through as one broad rank in the opening seconds. Deeper companies keep
  // the authored forest depth without starting so far away that the player
  // sees an empty road through the West Gate.
  spawnNearZ: 119.2,
  spawnNearBandEndZ: 128,
  spawnMiddleBandEndZ: 148,
  spawnFarZ: 168,
  roadVisualMaxZ: 172,
  firstVisibleCompanyTarget: 26,
  firstEmergenceSeconds: 5,
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function assertFiniteVector(name, value, keys) {
  if (!value || keys.some((key) => !Number.isFinite(value[key]))) {
    throw new TypeError(`${name} must contain finite ${keys.join(", ")} coordinates`);
  }
}

function validateSurface(surface) {
  if (!surface?.id || !VALID_SURFACE_KINDS.has(surface.kind)) {
    throw new TypeError("Walkable surfaces require an id and flat/ramp kind");
  }
  assertFiniteVector(`${surface.id}.min`, surface.min, ["x", "z"]);
  assertFiniteVector(`${surface.id}.max`, surface.max, ["x", "z"]);
  if (surface.min.x >= surface.max.x || surface.min.z >= surface.max.z) {
    throw new RangeError(`${surface.id} must have positive x/z area`);
  }
  if (surface.kind === "flat" && !Number.isFinite(surface.y)) {
    throw new TypeError(`${surface.id}.y must be finite`);
  }
  if (
    surface.kind === "ramp" &&
    (!Number.isFinite(surface.startY) ||
      !Number.isFinite(surface.endY) ||
      !["x", "z"].includes(surface.axis))
  ) {
    throw new TypeError(`${surface.id} requires startY, endY and an x/z axis`);
  }
  if (surface.solidBelow !== undefined && typeof surface.solidBelow !== "boolean") {
    throw new TypeError(`${surface.id}.solidBelow must be a boolean when provided`);
  }
  if (surface.solidBelow === true && surface.kind !== "ramp") {
    throw new TypeError(`${surface.id}.solidBelow requires an authored ramp`);
  }
  if (surface.extendsToRampEnds !== undefined && typeof surface.extendsToRampEnds !== "boolean") {
    throw new TypeError(`${surface.id}.extendsToRampEnds must be a boolean when provided`);
  }
  if (surface.underpassSurfaceId !== undefined && typeof surface.underpassSurfaceId !== "string") {
    throw new TypeError(`${surface.id}.underpassSurfaceId must be a string when provided`);
  }
  if (surface.underpassSurfaceIds !== undefined && (
    !Array.isArray(surface.underpassSurfaceIds)
    || surface.underpassSurfaceIds.length === 0
    || surface.underpassSurfaceIds.some(id => typeof id !== "string" || !id)
  )) {
    throw new TypeError(`${surface.id}.underpassSurfaceIds must be a non-empty string array when provided`);
  }
  if (surface.underpassSurfaceId !== undefined && surface.underpassSurfaceIds !== undefined) {
    throw new TypeError(`${surface.id} cannot provide both underpassSurfaceId and underpassSurfaceIds`);
  }
}

function validateCollisionVolume(volume) {
  if (!volume?.id) throw new TypeError("Collision volumes require an id");
  assertFiniteVector(`${volume.id}.min`, volume.min, ["x", "y", "z"]);
  assertFiniteVector(`${volume.id}.max`, volume.max, ["x", "y", "z"]);
  if (
    volume.min.x >= volume.max.x ||
    volume.min.y >= volume.max.y ||
    volume.min.z >= volume.max.z
  ) {
    throw new RangeError(`${volume.id} must have positive volume`);
  }
  if (volume.appearance !== undefined && !VALID_COLLISION_APPEARANCES.has(volume.appearance)) {
    throw new TypeError(`${volume.id}.appearance is not a supported visible collision type`);
  }
  if (volume.playerSolid !== undefined && typeof volume.playerSolid !== "boolean") {
    throw new TypeError(`${volume.id}.playerSolid must be a boolean when provided`);
  }
  if (volume.mantleable !== undefined && typeof volume.mantleable !== "boolean") {
    throw new TypeError(`${volume.id}.mantleable must be a boolean when provided`);
  }
  if (volume.appearance === "ramp-rail" && !volume.surfaceId) {
    throw new TypeError(`${volume.id} ramp rails require a surfaceId`);
  }
}

function validateHubPoint(label, point) {
  if (!point?.id) throw new TypeError(`${label} requires an id`);
  assertFiniteVector(`${point.id}.position`, point.position, ["x", "y", "z"]);
  if (!Number.isFinite(point.facing)) {
    throw new TypeError(`${point.id}.facing must be finite`);
  }
}

function assertUniqueIds(label, values) {
  const ids = new Set();
  for (const value of values) {
    if (ids.has(value.id)) throw new TypeError(`${label} ids must be unique`);
    ids.add(value.id);
  }
}

/** Validate and freeze a renderer-independent authored map contract. */
export function createMapDefinition(definition) {
  if (!definition?.id || !definition?.playerSpawn || !definition?.navigationBounds) {
    throw new TypeError("MapDefinition requires id, playerSpawn and navigationBounds");
  }
  assertFiniteVector("playerSpawn", definition.playerSpawn, ["x", "y", "z", "yaw", "pitch"]);
  const bounds = definition.navigationBounds;
  assertFiniteVector("navigationBounds.min", bounds.min, ["x", "y", "z"]);
  assertFiniteVector("navigationBounds.max", bounds.max, ["x", "y", "z"]);
  if (bounds.min.x >= bounds.max.x || bounds.min.y >= bounds.max.y || bounds.min.z >= bounds.max.z) {
    throw new RangeError("navigationBounds must have positive volume");
  }
  if (!Array.isArray(definition.walkableSurfaces) || definition.walkableSurfaces.length === 0) {
    throw new TypeError("MapDefinition requires at least one walkable surface");
  }
  for (const surface of definition.walkableSurfaces) validateSurface(surface);
  if (definition.collisionVolumes !== undefined && !Array.isArray(definition.collisionVolumes)) {
    throw new TypeError("MapDefinition collisionVolumes must be an array");
  }
  const surfacesById = new Map(definition.walkableSurfaces.map((surface) => [surface.id, surface]));
  for (const surface of definition.walkableSurfaces) {
    const underpassIds = surface.underpassSurfaceIds
      ?? (surface.underpassSurfaceId !== undefined ? [surface.underpassSurfaceId] : []);
    for (const underpassId of underpassIds) {
      const underpass = surfacesById.get(underpassId);
      if (surface.kind !== "ramp" || surface.solidBelow !== true || underpass?.kind !== "flat") {
        throw new TypeError(`${surface.id}.underpassSurfaceId requires a solid ramp and an authored flat surface`);
      }
    }
  }
  for (const volume of definition.collisionVolumes ?? []) {
    validateCollisionVolume(volume);
    if (volume.appearance === "ramp-rail" && surfacesById.get(volume.surfaceId)?.kind !== "ramp") {
      throw new TypeError(`${volume.id}.surfaceId must identify an authored ramp`);
    }
  }
  if (!Array.isArray(definition.lanePaths) || definition.lanePaths.length === 0) {
    throw new TypeError("MapDefinition requires at least one enemy lane path");
  }
  for (const lane of definition.lanePaths) {
    if (!lane?.id || !Array.isArray(lane.points) || lane.points.length < 2) {
      throw new TypeError("Each lane path requires an id and at least two points");
    }
    for (const [index, point] of lane.points.entries()) {
      assertFiniteVector(`${lane.id}.points[${index}]`, point, ["x", "y", "z"]);
    }
  }
  const hubStations = definition.hubStations ?? [];
  const npcSpawnPoints = definition.npcSpawnPoints ?? [];
  const npcShelterPoints = definition.npcShelterPoints ?? [];
  const repairableFeatures = definition.repairableFeatures ?? [];
  for (const [label, values] of [
    ["hubStations", hubStations],
    ["npcSpawnPoints", npcSpawnPoints],
    ["npcShelterPoints", npcShelterPoints],
    ["repairableFeatures", repairableFeatures],
  ]) {
    if (!Array.isArray(values)) throw new TypeError(`MapDefinition ${label} must be an array`);
    assertUniqueIds(label, values);
  }
  const shelterIds = new Set(npcShelterPoints.map(point => point.id));
  const stationIds = new Set(hubStations.map(station => station.id));
  for (const station of hubStations) {
    validateHubPoint("Hub station", station);
    if (!station.kind || !Number.isFinite(station.interactionRadius) || station.interactionRadius <= 0) {
      throw new TypeError(`${station.id} requires kind and positive interactionRadius`);
    }
    if (!shelterIds.has(station.shelterPointId)) {
      throw new TypeError(`${station.id}.shelterPointId must identify an NPC shelter point`);
    }
  }
  for (const spawn of npcSpawnPoints) {
    validateHubPoint("NPC spawn point", spawn);
    if (!spawn.npcId || !spawn.arrivalCondition || !stationIds.has(spawn.stationId)) {
      throw new TypeError(`${spawn.id} requires npcId, arrivalCondition and a hub station`);
    }
  }
  for (const shelter of npcShelterPoints) {
    validateHubPoint("NPC shelter point", shelter);
    if (!stationIds.has(shelter.stationId)) {
      throw new TypeError(`${shelter.id}.stationId must identify a hub station`);
    }
  }
  for (const feature of repairableFeatures) {
    if (
      !feature?.id
      || !stationIds.has(feature.stationId)
      || !feature.serviceId
      || !feature.unlockCondition
      || !Number.isFinite(feature.maxIntegrity)
      || feature.maxIntegrity <= 0
      || !Number.isFinite(feature.repairCost)
      || feature.repairCost < 0
    ) {
      throw new TypeError(`${feature?.id ?? "repairable feature"} requires a station, service, unlock, integrity and cost`);
    }
  }
  return deepFreeze(structuredClone(definition));
}

/**
 * Samples authored player ground independently from enemy lane navigation.
 * The closest vertically reachable overlapping surface wins, keeping ramps
 * continuous where they meet floors and battlements.
 */
export function sampleWalkableGround(
  mapDefinition,
  x,
  z,
  {
    currentY = 0,
    radius = 0,
    maxStepHeight = Infinity,
    maxDropHeight = Infinity,
    preferHighest = false,
  } = {},
) {
  const candidates = [];
  for (const surface of mapDefinition.walkableSurfaces) {
    if (
      x < surface.min.x + radius ||
      x > surface.max.x - radius ||
      z < surface.min.z + radius ||
      z > surface.max.z - radius
    ) {
      continue;
    }
    let y = surface.y;
    if (surface.kind === "ramp") {
      const min = surface.min[surface.axis];
      const max = surface.max[surface.axis];
      const amount = Math.max(0, Math.min(1, ((surface.axis === "x" ? x : z) - min) / (max - min)));
      y = surface.startY + (surface.endY - surface.startY) * amount;
    }
    if (y - currentY <= maxStepHeight + 1e-6 && currentY - y <= maxDropHeight + 1e-6) {
      candidates.push({surfaceId: surface.id, y, distance: Math.abs(y - currentY)});
    }
  }
  candidates.sort((a, b) =>
    (preferHighest ? b.y - a.y : a.distance - b.distance) ||
    b.y - a.y ||
    a.surfaceId.localeCompare(b.surfaceId),
  );
  return candidates[0] ?? null;
}

function rampHeightAt(surface, x, z) {
  const coordinate = surface.axis === "x" ? x : z;
  const min = surface.min[surface.axis];
  const max = surface.max[surface.axis];
  const amount = Math.max(0, Math.min(1, (coordinate - min) / Math.max(1e-6, max - min)));
  return surface.startY + (surface.endY - surface.startY) * amount;
}

function capsuleFitsUnderpass(surface, underpass, x, z, feetY, radius, maxStepHeight) {
  if (!underpass || feetY > underpass.y + maxStepHeight + 1e-6) return false;
  const along = surface.axis;
  const across = along === "x" ? "z" : "x";
  const point = {x, z};
  const passageMin = (underpass.extendsToRampEnds
    ? Math.min(underpass.min[along], surface.min[along])
    : underpass.min[along]) - radius;
  const passageMax = (underpass.extendsToRampEnds
    ? Math.max(underpass.max[along], surface.max[along])
    : underpass.max[along]) + radius;
  return point[along] >= passageMin
    && point[along] <= passageMax
    && point[across] >= underpass.min[across] + radius
    && point[across] <= underpass.max[across] - radius;
}

/**
 * Returns the visible ramp fill that blocks a capsule below its authored top.
 * Normal stair ascent remains clear while the next sampled top is within the
 * player's step height. Explicit underpass surfaces carve only their signed
 * ground-level route through the fill.
 */
export function sampleSolidRampFill(
  mapDefinition,
  x,
  z,
  {feetY = 0, radius = 0, maxStepHeight = 0} = {},
) {
  const safeFeetY = Number.isFinite(feetY) ? feetY : 0;
  const safeRadius = Math.max(0, Number.isFinite(radius) ? radius : 0);
  const safeStep = Math.max(0, Number.isFinite(maxStepHeight) ? maxStepHeight : 0);
  let blocking = null;
  for (const surface of mapDefinition?.walkableSurfaces ?? []) {
    if (surface.kind !== "ramp" || surface.solidBelow !== true) continue;
    if (
      x < surface.min.x - safeRadius || x > surface.max.x + safeRadius
      || z < surface.min.z - safeRadius || z > surface.max.z + safeRadius
    ) continue;
    const underpassIds = surface.underpassSurfaceIds
      ?? (surface.underpassSurfaceId ? [surface.underpassSurfaceId] : []);
    const underpasses = underpassIds.map(id => (
      mapDefinition.walkableSurfaces.find(item => item.id === id)
    ));
    if (underpasses.some(underpass => (
      capsuleFitsUnderpass(surface, underpass, x, z, safeFeetY, safeRadius, safeStep)
    ))) continue;
    const topY = rampHeightAt(surface, x, z);
    const clearance = topY - safeFeetY - safeStep;
    if (clearance <= 1e-6) continue;
    if (!blocking || clearance > blocking.clearance) {
      blocking = {surfaceId: surface.id, topY, clearance};
    }
  }
  return blocking;
}

export const BRIARHOLD_FIRST_PERSON_MAP = createMapDefinition({
  id: "briarhold-western-hold",
  label: "Briarhold · Western Hold",
  // Begin on the West Gate overlook with a clean firing vista across the full
  // approach. A broad stair now runs straight back through the gatehouse walk,
  // while the two flank ramps keep longer circulation routes available.
  playerSpawn: {x: -16, y: 3.5, z: 17, yaw: 0, pitch: 0.045},
  navigationBounds: {
    min: {x: -52, y: -48, z: -30},
    max: {x: 52, y: 18, z: 118},
  },
  walkableSurfaces: [
    // Matches the visible killing-field mesh. Surface edges are fall edges, not
    // invisible blockers; solid architecture is authored below instead.
    {id: "killing-field", kind: "flat", min: {x: -52, z: -20}, max: {x: 52, z: 118}, y: 0},
    {id: "courtyard-floor", kind: "flat", appearance: "courtyard-stone", min: {x: -26, z: -29}, max: {x: 3, z: -5}, y: 0},
    {id: "west-stair-landing", kind: "flat", min: {x: -30, z: -29}, max: {x: -25.2, z: -19}, visualMax: {x: -26, z: -19}, y: 0},
    // The east stair now lands in the open courtyard, clear of the closed
    // Heart Gate.  A small x overlap with the courtyard is intentional: it
    // gives a capsule a real ground-level join instead of a one-edge touch.
    {id: "east-stair-landing", kind: "flat", min: {x: 2.2, z: -18.8}, max: {x: 11, z: -16.6}, visualMin: {x: 3.05, z: -18.8}, visualMax: {x: 11, z: -16.6}, y: 0},
    {id: "gatehouse-passage", kind: "flat", appearance: "courtyard-stone", min: {x: -22, z: -5}, max: {x: -10, z: 10}, y: 0},
    // The Warden's Postern is a real ground-level return from the battlefield.
    // It passes beneath the rising west stair, then joins that same stair on
    // the courtyard side. Keeping the two surfaces separate lets the Warden
    // use both the undercroft and the ramp without a vertical teleport.
    {id: "west-postern-passage", kind: "flat", appearance: "courtyard-stone", min: {x: -28.5, z: -6.8}, max: {x: -24.9, z: 2}, visualMin: {x: -28.5, z: -5}, visualMax: {x: -24.9, z: 2}, y: 0},
    // A short L-shaped mouth joins the courtyard approach to the narrow
    // longitudinal postern. It carves only the reported side entrance rather
    // than making the complete masonry stair hollow beneath every tread.
    {id: "west-postern-courtyard-entry", kind: "flat", appearance: "courtyard-stone", min: {x: -26, z: -6.2}, max: {x: -22.2, z: -3.4}, y: 0},
    {id: "western-approach", kind: "flat", min: {x: -43, z: 8}, max: {x: 11, z: 117}, y: 0},
    {id: "west-stair-ramp", kind: "ramp", min: {x: -30, z: -20}, max: {x: -23, z: 2}, axis: "z", startY: 0, endY: 8, solidBelow: true, underpassSurfaceIds: ["west-postern-passage", "west-postern-courtyard-entry"]},
    {id: "west-battlement", kind: "flat", min: {x: -43, z: -24}, max: {x: -33.2, z: 10}, visualMax: {x: -34, z: 10}, y: 8},
    {id: "west-ramp-top-landing", kind: "flat", min: {x: -34.8, z: 1.62}, max: {x: -30.2, z: 10}, visualMin: {x: -34, z: 2}, visualMax: {x: -31, z: 10}, y: 8},
    {id: "gatehouse-walk-west", kind: "flat", min: {x: -31.8, z: 1.1}, max: {x: -21.6, z: 10.38}, visualMin: {x: -31, z: 2}, visualMax: {x: -22.4, z: 10}, y: 8},
    {id: "gatehouse-walk", kind: "flat", min: {x: -22.78, z: -2.38}, max: {x: 4, z: 4}, visualMin: {x: -22.4, z: -2}, y: 8},
    // The front-west deck overlaps the west walk by 0.8 m logically, while
    // both rendered decks meet exactly at x=-22.4. The prior authored boxes
    // merely touched at x=-21.6 but their visuals stopped 0.8 m apart, leaving
    // a real hole that a first-person capsule could fall through.
    {id: "gatehouse-walk-front-west", kind: "flat", min: {x: -22.4, z: 3.2}, max: {x: -18.4, z: 10.38}, visualMin: {x: -22.4, z: 4}, visualMax: {x: -18.4, z: 10}, y: 8},
    {id: "gatehouse-walk-front-east", kind: "flat", min: {x: -13.6, z: 3.2}, max: {x: 4, z: 10.38}, visualMin: {x: -13.6, z: 4}, visualMax: {x: 4, z: 10}, y: 8},
    {id: "gatehouse-walk-east", kind: "flat", min: {x: 3.2, z: 1.1}, max: {x: 10.8, z: 10.38}, visualMin: {x: 4, z: 2}, visualMax: {x: 10, z: 10}, y: 8},
    // The east stair begins in the open courtyard rather than inside the keep
    // collision. This makes its low end genuinely reachable in play.
    // Stop short of the closed Heart Gate and begin from the authored landing
    // in the courtyard.  The old -18.5 m endpoint visually ran into the keep.
    {id: "east-stair-ramp", kind: "ramp", min: {x: 4, z: -16.8}, max: {x: 10, z: 2}, axis: "z", startY: 0, endY: 8, solidBelow: true},
    {id: "east-battlement", kind: "flat", min: {x: 9.62, z: -2}, max: {x: 43, z: 10}, visualMin: {x: 10, z: -2}, y: 8},
    // The West Gate firing bay sits below the wall walk so enemies read at
    // first-person scale instead of as a top-down texture. A broad timber
    // descent keeps the gallery connected to every existing rampart route.
    {id: "west-gate-overlook-descent", kind: "ramp", appearance: "timber-overlook", min: {x: -18.4, z: 3.2}, max: {x: -13.6, z: 12.8}, visualMin: {x: -18.4, z: 4}, axis: "z", startY: 8, endY: 3.5},
    {id: "west-gate-overlook", kind: "flat", appearance: "timber-overlook", min: {x: -22, z: 12}, max: {x: -10, z: 22}, visualMin: {x: -22, z: 12.8}, y: 3.5},
    {id: "east-gate-overlook", kind: "flat", appearance: "timber-overlook", min: {x: 10, z: 9.2}, max: {x: 22, z: 16}, visualMin: {x: 10, z: 10}, y: 8},
  ],
  collisionVolumes: [
    // Low wall bodies stop a ground-level capsule while allowing traversal on
    // the authored y=8 wall walks. The western stair gap is intentionally open.
    // Keep a low ground-level curtain body, but do not draw a full-height bay
    // across the y=8 west battlement route.
    {id: "west-curtain-a", min: {x: -50, y: 0, z: -4}, max: {x: -30.4, y: 1.4, z: 0}},
    // Masonry jambs turn the existing west-stair undercroft into a readable
    // Warden-sized postern. The 3.6 m centre remains open from field to
    // courtyard; the enemy lane stays at the closed West Gate to the east.
    // No separate lintel is authored because the rising stair itself is the
    // ceiling and must remain traversable above the passage.
    {id: "west-postern-jamb-west", min: {x: -29.4, y: 0, z: -6.4}, max: {x: -28.5, y: 7.8, z: -0.2}},
    {id: "west-postern-jamb-east", min: {x: -24.9, y: 0, z: -3}, max: {x: -23.6, y: 7.8, z: -0.2}},
    // Narrow masonry abutments close genuine holes between the curtain pieces
    // without entering either stair.  These are structural shell, not hidden
    // navigation blockers: each one is rendered from the same authored box.
    {id: "west-stair-east-abutment", min: {x: -23, y: 0, z: -4}, max: {x: -22.4, y: 7.8, z: 0}},
    // Ends before the east stair, whose visible ramp passes through this wall.
    {id: "centre-curtain", min: {x: -10, y: 0, z: -4}, max: {x: 3.6, y: 7.8, z: 0}},
    {id: "east-stair-west-abutment", min: {x: 3.6, y: 0, z: -4}, max: {x: 4, y: 7.8, z: 0}},
    {id: "east-stair-east-abutment", min: {x: 10, y: 0, z: -4}, max: {x: 11.5, y: 7.8, z: 0}},
    {id: "west-tower", min: {x: -33.5, y: 0, z: -7.5}, max: {x: -30.4, y: 13, z: -0.5}},
    {id: "inner-west-tower", min: {x: -9.5, y: 0, z: -7.5}, max: {x: -2.5, y: 13, z: -0.5}},
    // The ImageGen-guided Meshy threshold measures a 6.25 m clear base
    // opening after mobile normalization. These solid jambs meet that visible
    // stone instead of letting the player walk through either textured pier.
    {id: "west-gate-pier", min: {x: -22.4, y: 0, z: -4.6}, max: {x: -19.1, y: 7.8, z: 0.2}},
    // The upper walk passes beside this pier.  Its lower masonry remains
    // solid, while the stray imported base foliage can no longer become an
    // invisible y=8 blocker at the reported gatehouse position.
    {id: "west-gate-pier-east", min: {x: -12.9, y: 0, z: -4.6}, max: {x: -9.6, y: 7.8, z: 0.2}},
    // These two solid flank towers turn the exposed firing platform into a
    // readable gatehouse bay. Their inner faces meet (but never overlap) the
    // authored overlook, so every visible stone edge has matching collision
    // while the full twelve-metre firing lane stays open.
    {id: "west-overlook-flank-tower", min: {x: -29, y: 0, z: 16}, max: {x: -22, y: 10.5, z: 23}},
    {id: "east-overlook-flank-tower", min: {x: -10, y: 0, z: 16}, max: {x: -3, y: 10.5, z: 23}},
    // A narrow inner pier carries the otherwise unsupported west-battlement
    // projection.  It ends at the authored battlement edge, so it cannot
    // steal space from the ramp or wall-walk route.
    {id: "west-battlement-support-inner", min: {x: -35.2, y: 0, z: -18}, max: {x: -33.2, y: 7.8, z: -10}},
    {id: "west-portcullis", min: {x: -20.4, y: 0, z: -1.75}, max: {x: -11.6, y: 7, z: -0.95}},
    {id: "east-gate", min: {x: 11.5, y: 0, z: -2}, max: {x: 20.5, y: 7, z: -0.7}},
    {id: "east-gate-east-abutment", min: {x: 20.5, y: 0, z: -4}, max: {x: 22.5, y: 7.8, z: 0}},
    {id: "east-curtain", min: {x: 26, y: 0, z: -4}, max: {x: 50, y: 7.8, z: 0}},
    {id: "east-tower", min: {x: 22.5, y: 0, z: -7.5}, max: {x: 29.5, y: 13, z: -0.5}},
    {id: "inner-keep", min: {x: -14, y: 0, z: -29}, max: {x: 14, y: 15, z: -19}},
    {id: "keep-crown", min: {x: -7.5, y: 15, z: -28}, max: {x: 7.5, y: 22.5, z: -20}},
    {id: "heart-gate", min: {x: -5.5, y: 0, z: -18.75}, max: {x: 5.5, y: 8, z: -17.25}},
    // Continuous, visible field fences prevent leaving the authored ground.
    // The south openings line up with the courtyard and both stair approaches.
    {id: "field-boundary-west", appearance: "briar-fence", min: {x: -52, y: 0, z: -20}, max: {x: -51, y: 2.6, z: 118}},
    {id: "field-boundary-east", appearance: "briar-fence", min: {x: 51, y: 0, z: -20}, max: {x: 52, y: 2.6, z: 118}},
    {id: "field-boundary-north", appearance: "briar-fence", min: {x: -52, y: 0, z: 117}, max: {x: 52, y: 2.6, z: 118}},
    // One low ruined wall keeps mantle as an authored live-map traversal move.
    // It sits clear of the enemy lane and fortress safety parapets, with flat
    // supported ground on both sides.
    {id: "western-field-mantle-wall", appearance: "stone-parapet", mantleable: true, min: {x: -42, y: 0, z: 18}, max: {x: -34, y: 1, z: 18.6}},
    // A second broad stone threshold frames the killing field without narrowing
    // the twelve-metre host lane. It reuses the same open Meshy gatehouse as
    // the West Gate at 2.4x width: the measured 6.25 m opening becomes 15 m,
    // leaving 1.5 m of visual clearance beyond either lane edge. The three
    // authored boxes back only the two jambs and high lintel, so player and
    // camera movement remain genuinely open through the middle.
    {id: "field-gate-arch-west", min: {x: -30.4, y: 0, z: 43.9}, max: {x: -23.5, y: 12.35, z: 48.1}},
    {id: "field-gate-arch-east", min: {x: -8.5, y: 0, z: 43.9}, max: {x: -1.6, y: 12.35, z: 48.1}},
    {id: "field-gate-arch-lintel", min: {x: -23.5, y: 8.45, z: 43.9}, max: {x: -8.5, y: 12.35, z: 48.1}},
    // Symmetric collision-backed wings make the threshold part of the hold
    // rather than a freestanding prop. Their outer ends remain walk-around
    // routes for a field player; the horde's central authored lane is clear.
    {id: "field-gate-wing-west", min: {x: -46, y: 0, z: 43.9}, max: {x: -30.4, y: 7.8, z: 48.1}},
    {id: "field-gate-wing-east", min: {x: -1.6, y: 0, z: 43.9}, max: {x: 14, y: 7.8, z: 48.1}},
    // Taller end towers give the outer line a readable fortress silhouette.
    // They overlap the final wing bays by design, so no thin visual can imply
    // a walkable gap that the authoritative player collision does not share.
    {id: "field-gate-tower-west", min: {x: -46, y: 0, z: 42.5}, max: {x: -39, y: 14, z: 49.5}},
    {id: "field-gate-tower-east", min: {x: 7, y: 0, z: 42.5}, max: {x: 14, y: 14, z: 49.5}},
    // A foreground pair of real braziers frames the firing lane before the
    // second cache layer. The large east fire deliberately occupies the
    // right edge of the host lane, leaving a broad route on its west side;
    // both player and horde use the same authored footprint.
    {id: "defender-brazier-field-near", appearance: "defender-brazier", min: {x: -25.15, y: 0, z: 28.75}, max: {x: -23.65, y: 1.7, z: 30.25}},
    // The east brazier is the large battlefield fire landmark visible through
    // the West Gate. Its collider matches the enlarged Meshy instance while
    // retaining more than a capsule diameter from the host lane and cache.
    {id: "defender-brazier-field-far", appearance: "defender-brazier", min: {x: -9.7, y: 0, z: 33.8}, max: {x: -7.3, y: 2.55, z: 36.2}},
    // Real defender caches create readable siege lanes around the host without
    // entering the six-metre enemy corridor or stealing a build socket. They
    // are player-solid, fully ground-supported, and share the existing Meshy
    // cache draw/material rather than adding decorative placeholder boxes.
    {id: "defender-cache-field-west", appearance: "defender-cache", min: {x: -30.4, y: 0, z: 32.4}, max: {x: -25.8, y: 3.2, z: 35.6}},
    {id: "defender-cache-field-east", appearance: "defender-cache", min: {x: -6.2, y: 0, z: 32.4}, max: {x: -1.6, y: 3.2, z: 35.6}},
    // A closer collision-backed staging pair breaks the empty foreground into
    // defended shoulders while leaving the host corridor and nearby build
    // socket clear. These reuse the same Meshy cache batch and also become
    // authoritative horde obstacles through BRIARHOLD_ENEMY_GROUND_OBSTACLES.
    {id: "defender-cache-gate-west", appearance: "defender-cache", min: {x: -27.9, y: 0, z: 18.9}, max: {x: -23.3, y: 3.2, z: 22.1}},
    {id: "defender-cache-gate-east", appearance: "defender-cache", min: {x: -8.7, y: 0, z: 16.9}, max: {x: -4.1, y: 3.2, z: 20.1}},
    // Overlaps the west ramp by 0.4 m so the capsule cannot slip between the
    // visible fence and the inset edge of the authored ramp support.
    {id: "field-boundary-south-west", appearance: "briar-fence", min: {x: -52, y: 0, z: -20}, max: {x: -29.6, y: 2.6, z: -19}},
    {id: "field-boundary-south-east", appearance: "briar-fence", min: {x: 11, y: 0, z: -20}, max: {x: 52, y: 2.6, z: -19}},
    {id: "courtyard-rear-retaining", appearance: "stone-parapet", min: {x: -30, y: 0, z: -29}, max: {x: -14, y: 1.4, z: -28.6}},
    {id: "west-landing-retaining", appearance: "stone-parapet", min: {x: -30, y: 0, z: -29}, max: {x: -29.6, y: 1.4, z: -19}},
    // Rails begin on the first tread rather than hanging over the lower
    // landing.  Their 0.55 m inset is also reflected by the visible stringers.
    {id: "west-ramp-rail-left", appearance: "ramp-rail", surfaceId: "west-stair-ramp", min: {x: -30, y: 0, z: -19.45}, max: {x: -29.4, y: 9.15, z: 2}},
    {id: "west-ramp-rail-right", appearance: "ramp-rail", surfaceId: "west-stair-ramp", min: {x: -23.6, y: 0, z: -19.45}, max: {x: -23, y: 9.15, z: 2}},
    // Leave the first 1.5 m open on the courtyard side. The Heart Gate blocks
    // access around the stair's south end, so a full-length left rail made the
    // otherwise valid lower landing unreachable from the reported approach.
    // Leave the upper deck join clear too.  The rail used to reach the deck at
    // z=2, so a capsule already standing on the walk could never take the
    // signed east-stair route: its radius contacted the rail before it could
    // transfer onto the ramp.  Stopping at the matching z=1.1 return preserves
    // the rail along the climbing edge while making the authored entry real.
    {id: "east-ramp-rail-left", appearance: "ramp-rail", surfaceId: "east-stair-ramp", min: {x: 4, y: 0, z: -15.3}, max: {x: 4.6, y: 9.15, z: 1.1}},
    {id: "east-ramp-rail-right", appearance: "ramp-rail", surfaceId: "east-stair-ramp", min: {x: 9.4, y: 0, z: -16.8}, max: {x: 10, y: 9.15, z: 2}},
    // Authored parapets match the reachable elevated footprint. Gaps are left
    // only where ramps or overlooks join the main wall walk.
    {id: "parapet-west-outer", appearance: "stone-parapet", min: {x: -43, y: 7.75, z: -24}, max: {x: -42.4, y: 9.15, z: 10}},
    {id: "parapet-west-rear", appearance: "stone-parapet", min: {x: -43, y: 7.75, z: -24}, max: {x: -31, y: 9.15, z: -23.4}},
    // Guard the actual inner edge of the west rampart. The previous rail sat
    // 1.6 m beyond the walkable surface, so it behaved like an invisible wall
    // while leaving the visible edge open to a lethal fall. The opening north
    // of z=-2 remains the signed route across the top landing to the stair.
    {id: "parapet-west-inner", appearance: "stone-parapet", min: {x: -33.2, y: 7.75, z: -24}, max: {x: -32.6, y: 9.15, z: 1.2}},
    // Frame the west stair opening and visibly close the two false drops on
    // either side. The seven-metre ramp itself remains completely open.
    {id: "parapet-west-top-landing-south", appearance: "stone-parapet", min: {x: -34, y: 7.75, z: 1.4}, max: {x: -30, y: 9.15, z: 2}},
    {id: "parapet-west-ramp-return", appearance: "stone-parapet", min: {x: -23, y: 7.75, z: 1.4}, max: {x: -22.4, y: 9.15, z: 2}},
    {id: "parapet-gatehouse-west-side-return", appearance: "stone-parapet", min: {x: -22.4, y: 7.75, z: 0.2}, max: {x: -21.8, y: 9.15, z: 2}},
    {id: "parapet-walk-rear-centre", appearance: "stone-parapet", min: {x: -22.4, y: 7.75, z: -2}, max: {x: 4, y: 9.15, z: -1.4}},
    {id: "parapet-walk-rear-east", appearance: "stone-parapet", min: {x: 10, y: 7.75, z: -2}, max: {x: 43, y: 9.15, z: -1.4}},
    // At lower ramp elevations the adjacent y=8 decks formerly exposed open
    // side drops. These returns meet the existing rear walls and stop exactly
    // where each top landing begins, so neither signed stair route is narrowed.
    {id: "parapet-gatehouse-east-ramp-return", appearance: "stone-parapet", min: {x: 3.4, y: 7.75, z: -1.4}, max: {x: 4, y: 9.15, z: 1.1}},
    {id: "parapet-east-ramp-return", appearance: "stone-parapet", min: {x: 10, y: 7.75, z: -1.4}, max: {x: 10.6, y: 9.15, z: 1.1}},
    {id: "parapet-east-outer", appearance: "stone-parapet", min: {x: 42.4, y: 7.75, z: -2}, max: {x: 43, y: 9.15, z: 10}},
    {id: "parapet-front-west", appearance: "stone-parapet", min: {x: -43, y: 7.75, z: 9.4}, max: {x: -22.4, y: 9.15, z: 10}},
    {id: "parapet-front-centre", appearance: "stone-parapet", min: {x: -10, y: 7.75, z: 9.4}, max: {x: 10, y: 9.15, z: 10}},
    {id: "parapet-front-east", appearance: "stone-parapet", min: {x: 22, y: 7.75, z: 9.4}, max: {x: 43, y: 9.15, z: 10}},
    // The y=8 decks flank the authored timber descent. Close their north and
    // side edges while leaving a clean 4.8 m opening onto the slope at z=4.
    {id: "parapet-gatehouse-overlook-west-front", appearance: "stone-parapet", min: {x: -22.4, y: 7.75, z: 9.4}, max: {x: -18.4, y: 9.15, z: 10}},
    {id: "parapet-gatehouse-overlook-east-front", appearance: "stone-parapet", min: {x: -13.6, y: 7.75, z: 9.4}, max: {x: -10, y: 9.15, z: 10}},
    {id: "parapet-gatehouse-overlook-west-side", appearance: "stone-parapet", min: {x: -19, y: 7.75, z: 4}, max: {x: -18.4, y: 9.15, z: 9.4}},
    {id: "parapet-gatehouse-overlook-east-side", appearance: "stone-parapet", min: {x: -13.6, y: 7.75, z: 4}, max: {x: -13, y: 9.15, z: 9.4}},
    // The centre is a low, collision-backed firing sill. It keeps ordinary
    // movement on the platform while revealing near host ranks that the old
    // continuous waist-high wall hid completely from first-person view.
    {id: "parapet-west-overlook-north", appearance: "stone-parapet", min: {x: -18.8, y: 3.25, z: 21.4}, max: {x: -13.2, y: 3.85, z: 22}},
    {id: "parapet-west-overlook-north-left", appearance: "stone-parapet", min: {x: -22, y: 3.25, z: 21.4}, max: {x: -18.8, y: 4.35, z: 22}},
    {id: "parapet-west-overlook-north-right", appearance: "stone-parapet", min: {x: -13.2, y: 3.25, z: 21.4}, max: {x: -10, y: 4.35, z: 22}},
    {id: "parapet-west-overlook-left", appearance: "stone-parapet", min: {x: -22, y: 3.25, z: 12}, max: {x: -21.4, y: 4.65, z: 22}},
    {id: "parapet-west-overlook-right", appearance: "stone-parapet", min: {x: -10.6, y: 3.25, z: 12}, max: {x: -10, y: 4.65, z: 22}},
    // Guard the lower overlook's two false south edges. The centre opening is
    // exactly the width of the timber descent and remains the sole route down.
    {id: "parapet-west-overlook-south-left", appearance: "stone-parapet", min: {x: -21.4, y: 3.25, z: 12.4}, max: {x: -18.4, y: 4.65, z: 13}},
    {id: "parapet-west-overlook-south-right", appearance: "stone-parapet", min: {x: -13.6, y: 3.25, z: 12.4}, max: {x: -10.6, y: 4.65, z: 13}},
    {id: "west-overlook-descent-rail-left", appearance: "ramp-rail", surfaceId: "west-gate-overlook-descent", min: {x: -18.4, y: 3.25, z: 3.2}, max: {x: -17.8, y: 9.15, z: 12.8}},
    {id: "west-overlook-descent-rail-right", appearance: "ramp-rail", surfaceId: "west-gate-overlook-descent", min: {x: -14.2, y: 3.25, z: 3.2}, max: {x: -13.6, y: 9.15, z: 12.8}},
    {id: "parapet-east-overlook-north", appearance: "stone-parapet", min: {x: 10, y: 7.75, z: 15.4}, max: {x: 22, y: 8.85, z: 16}},
    {id: "parapet-east-overlook-left", appearance: "stone-parapet", min: {x: 10, y: 7.75, z: 10}, max: {x: 10.6, y: 9.15, z: 16}},
    {id: "parapet-east-overlook-right", appearance: "stone-parapet", min: {x: 21.4, y: 7.75, z: 10}, max: {x: 22, y: 9.15, z: 16}},
    // Collision-backed defender staging clusters dress broad empty floors while
    // preserving the signed central routes, interaction points and build sockets.
    // These elevated cache bodies are visible staging props on the overlook;
    // keep their physical footprints aligned with the Meshy render.
    {id: "defender-cache-overlook-west", appearance: "defender-cache", min: {x: -21.6, y: 3.5, z: 18}, max: {x: -18.4, y: 5.9, z: 20.4}},
    {id: "defender-cache-overlook-east", appearance: "defender-cache", min: {x: -13.6, y: 3.5, z: 18}, max: {x: -10.4, y: 5.9, z: 20.4}},
    // Block the bell and central cross-frame while leaving its open front and
    // Bellkeeper interaction point usable. A full rectangular asset envelope
    // would turn the A-frame's intentional gaps into an invisible wall.
    {id: "wave-bell", min: {x: -15.45, y: 0, z: -18.25}, max: {x: -14.55, y: 2.65, z: -17.05}},
    {id: "defender-cache-west-battlement", appearance: "defender-cache", min: {x: -41.8, y: 8, z: -19.6}, max: {x: -37.2, y: 11.2, z: -16.4}},
    {id: "defender-cache-east-battlement", appearance: "defender-cache", min: {x: 35.7, y: 8, z: 4}, max: {x: 40.3, y: 11.2, z: 7.2}},
    {id: "defender-cache-courtyard-rear", appearance: "defender-cache", min: {x: -25.8, y: 0, z: -27.1}, max: {x: -21.2, y: 3.2, z: -23.9}},
    {id: "defender-cache-courtyard-west", appearance: "defender-cache", min: {x: -22.3, y: 0, z: -15}, max: {x: -17.7, y: 3.2, z: -11.8}},
    // Real Meshy service arcades turn the hub stations into collision-backed
    // places rather than freestanding menu markers.  Both shallow footprints
    // sit against existing courtyard boundaries and leave the signed station
    // routes, NPC interaction radii and central Heart Gate approach open.
    // Place Mason's shallow service arcade beside the bench in the open
    // courtyard; the prior placement was buried beneath the west stair.
    {id: "service-arcade-mason", appearance: "service-arcade", min: {x: -22.4, y: 0, z: -12.6}, max: {x: -21, y: 3.2, z: -6.8}},
    {id: "service-arcade-quartermaster", appearance: "service-arcade", min: {x: 1.6, y: 0, z: -15.8}, max: {x: 3, y: 3.2, z: -10}},
    {id: "support-west-gate-overlook-sw", min: {x: -21.24, y: 0, z: 10.76}, max: {x: -20.76, y: 7.58, z: 11.24}},
    {id: "support-west-gate-overlook-nw", min: {x: -21.24, y: 0, z: 21.46}, max: {x: -20.76, y: 3.08, z: 21.94}},
    {id: "support-west-gate-overlook-se", min: {x: -11.24, y: 0, z: 10.76}, max: {x: -10.76, y: 7.58, z: 11.24}},
    {id: "support-west-gate-overlook-ne", min: {x: -11.24, y: 0, z: 21.46}, max: {x: -10.76, y: 3.08, z: 21.94}},
    {id: "support-east-gate-overlook-sw", min: {x: 10.76, y: 0, z: 10.76}, max: {x: 11.24, y: 7.58, z: 11.24}},
    {id: "support-east-gate-overlook-nw", min: {x: 10.76, y: 0, z: 14.76}, max: {x: 11.24, y: 7.58, z: 15.24}},
    {id: "support-east-gate-overlook-se", min: {x: 20.76, y: 0, z: 10.76}, max: {x: 21.24, y: 7.58, z: 11.24}},
    {id: "support-east-gate-overlook-ne", min: {x: 20.76, y: 0, z: 14.76}, max: {x: 21.24, y: 7.58, z: 15.24}},
  ],
  lanePaths: [
    {
      id: "west-host-lane",
      width: 12,
      points: [
        {x: -16, y: 0, z: 112},
        {x: -16, y: 0, z: 52},
        {x: -16, y: 0, z: 10},
        {x: -16, y: 0, z: 0},
        {x: -12, y: 0, z: -8},
        {x: 0, y: 0, z: -18},
      ],
      chokepoints: ["west-outer-gate", "heart-gate"],
    },
  ],
  gates: [
    {id: "west-outer-gate", kind: "outer", position: {x: -16, y: 0, z: 0}, runEnding: false},
    {id: "heart-gate", kind: "heart", position: {x: 0, y: 0, z: -18}, runEnding: true},
  ],
  buildSockets: [
    {id: "approach-barricade-a", position: {x: -22, y: 0, z: 36}, facing: 0, allowed: ["barricade", "thorn-snare"]},
    {id: "approach-barricade-b", position: {x: -10, y: 0, z: 24}, facing: 0, allowed: ["barricade", "thorn-snare"]},
    // Reserve the only gate cauldron socket for its Wave 3 unlock. Letting an
    // earlier snare occupy it permanently made the Sunfire-pot lesson
    // impossible without an uninstall flow.
    {id: "gate-fire-pot", position: {x: -23, y: 0, z: 7}, facing: 0, allowed: ["fire-pot"]},
    {id: "gate-ballista", position: {x: -25, y: 8, z: 4}, facing: 0, allowed: ["ballista", "ward-lantern"]},
    {id: "courtyard-barricade", position: {x: -10, y: 0, z: -11}, facing: 0.65, allowed: ["barricade", "thorn-snare"]},
    {id: "heart-ballista", position: {x: -2, y: 8, z: 4}, facing: 0, allowed: ["ballista", "ward-lantern"]},
  ],
  hunterZones: [
    {id: "approach-airspace", min: {x: -42, y: 1, z: 2}, max: {x: 10, y: 18, z: 116}},
    {id: "courtyard-airspace", min: {x: -33, y: 1, z: -28}, max: {x: 10, y: 18, z: 4}},
  ],
  // Hub services are metadata on existing walkable ground. NPCs remain
  // non-solid, so this loop adds no collision and cannot close a player,
  // stair, build-socket, or enemy route.
  hubStations: [
    {
      id: "bell-platform",
      kind: "bellkeeper",
      position: {x: -15, y: 0, z: -16.5},
      facing: 0,
      interactionRadius: 2.2,
      shelterPointId: "bellkeeper-shelter",
    },
    {
      id: "masons-bench",
      kind: "mason",
      position: {x: -20.3, y: 0, z: -8.5},
      facing: 1.5707963267948966,
      interactionRadius: 2.2,
      shelterPointId: "mason-shelter",
    },
    {
      id: "quartermaster-stores",
      kind: "quartermaster",
      position: {x: 2.5, y: 0, z: -9.4},
      facing: -1.5707963267948966,
      interactionRadius: 2.2,
      shelterPointId: "quartermaster-shelter",
    },
    {
      id: "trappers-workshop",
      kind: "trapper",
      position: {x: -21, y: 0, z: -18},
      facing: 1.2,
      interactionRadius: 2.2,
      shelterPointId: "trapper-shelter",
    },
    {
      id: "greenwardens-shrine",
      kind: "greenwarden",
      position: {x: -18, y: 0, z: -25},
      facing: 0,
      interactionRadius: 2.2,
      shelterPointId: "greenwarden-shelter",
    },
  ],
  repairableFeatures: [
    {id: "outer-gate-bracing", stationId: "masons-bench", serviceId: "gate-repair", unlockCondition: "night-1-start", maxIntegrity: 1, repairCost: 20},
    {id: "heart-gate-masonry", stationId: "masons-bench", serviceId: "gate-repair", unlockCondition: "night-1-start", maxIntegrity: 1, repairCost: 25},
    {id: "field-infirmary", stationId: "quartermaster-stores", serviceId: "field-readiness", unlockCondition: "night-1-wave-1-cleared", maxIntegrity: 1, repairCost: 30},
    {id: "quartermaster-stores", stationId: "quartermaster-stores", serviceId: "field-readiness", unlockCondition: "night-1-wave-1-cleared", maxIntegrity: 1, repairCost: 0},
    {id: "trapper-workshop", stationId: "trappers-workshop", serviceId: "defence-workshop", unlockCondition: "night-1-wave-2-cleared", maxIntegrity: 1, repairCost: 0},
    {id: "ballista-loft", stationId: "trappers-workshop", serviceId: "defence-workshop", unlockCondition: "night-1-wave-2-cleared", maxIntegrity: 1, repairCost: 0},
    {id: "ward-lantern-network", stationId: "greenwardens-shrine", serviceId: "boon-choice", unlockCondition: "night-1-wave-3-cleared", maxIntegrity: 1, repairCost: 0},
  ],
  npcSpawnPoints: [
    // Face each service character toward the open approach where the Warden
    // naturally meets them, rather than away from an abstract station anchor.
    {id: "bellkeeper-spawn", npcId: "bellkeeper", stationId: "bell-platform", position: {x: -17.1, y: 0, z: -16}, facing: Math.atan2(1.548, 2.606), arrivalCondition: "profile-start"},
    {id: "mason-spawn", npcId: "mason", stationId: "masons-bench", position: {x: -20.3, y: 0, z: -9.1}, facing: Math.atan2(1.68, 0.249), arrivalCondition: "failure-or-echo-arrival"},
    {id: "quartermaster-spawn", npcId: "quartermaster", stationId: "quartermaster-stores", position: {x: 2, y: 0, z: -9.2}, facing: Math.atan2(-6, -2.8), arrivalCondition: "failure-or-echo-arrival"},
    {id: "trapper-spawn", npcId: "trapper", stationId: "trappers-workshop", position: {x: -20.5, y: 0, z: -18.6}, facing: Math.atan2(4.948, 5.206), arrivalCondition: "failure-or-echo-arrival"},
    {id: "greenwarden-spawn", npcId: "greenwarden", stationId: "greenwardens-shrine", position: {x: -18, y: 0, z: -25.6}, facing: Math.atan2(2, 5.6), arrivalCondition: "failure-or-echo-arrival"},
  ],
  npcShelterPoints: [
    {id: "bellkeeper-shelter", stationId: "bell-platform", position: {x: -16.5, y: 0, z: -18.5}, facing: 0},
    {id: "mason-shelter", stationId: "masons-bench", position: {x: -20.3, y: 0, z: -10.3}, facing: 0},
    {id: "quartermaster-shelter", stationId: "quartermaster-stores", position: {x: 2.5, y: 0, z: -7.5}, facing: 3.141592653589793},
    {id: "trapper-shelter", stationId: "trappers-workshop", position: {x: -20, y: 0, z: -21.5}, facing: 0},
    {id: "greenwarden-shelter", stationId: "greenwardens-shrine", position: {x: -18, y: 0, z: -22.7}, facing: 0},
  ],
  interactions: [
    {id: "repair-west-gate", kind: "repair", targetId: "west-outer-gate", position: {x: -16, y: 0, z: -4}, radius: 2.4},
    {id: "repair-east-gate", kind: "repair", targetId: "east-outer-gate", position: {x: 16, y: 0, z: -4}, radius: 2.4},
    {id: "repair-heart-gate", kind: "repair", targetId: "heart-gate", position: {x: 0, y: 0, z: -13}, radius: 2.4},
    {id: "field-medicine", kind: "emergency-heal", position: {x: 6, y: 0, z: -16}, radius: 1.8},
  ],
});

function enemyGroundObstacle(sourceCollisionId, sourceCollisionIds) {
  const sourceIds = Object.freeze([...sourceCollisionIds]);
  const volumes = sourceIds.map(sourceId => (
    BRIARHOLD_FIRST_PERSON_MAP.collisionVolumes.find(volume => volume.id === sourceId)
  ));
  if (volumes.some(volume => !volume)) throw new Error(`Unknown enemy obstacle source: ${sourceCollisionId}`);
  const minX = Math.min(...volumes.map(volume => volume.min.x));
  const maxX = Math.max(...volumes.map(volume => volume.max.x));
  const minZ = Math.min(...volumes.map(volume => volume.min.z));
  const maxZ = Math.max(...volumes.map(volume => volume.max.z));
  return Object.freeze({
    id: `map:${sourceCollisionId}`,
    sourceCollisionId,
    ...(sourceIds.length > 1 ? {sourceCollisionIds: sourceIds} : {}),
    x: (minX + maxX) * 0.5,
    z: (minZ + maxZ) * 0.5,
    halfWidth: (maxX - minX) * 0.5,
    halfDepth: (maxZ - minZ) * 0.5,
    solid: true,
  });
}

// Ground-level field dressing is physical for the horde as well as the
// player. The field-gate shoulders are composite boxes: registering their
// abutting arch, wing and tower pieces individually creates solver seams,
// while omitting the wings lets off-lane bodies walk through visible masonry.
const FIELD_GATE_ENEMY_SHOULDERS = Object.freeze([
  enemyGroundObstacle("field-gate-shoulder-west", [
    "field-gate-arch-west", "field-gate-wing-west", "field-gate-tower-west",
  ]),
  enemyGroundObstacle("field-gate-shoulder-east", [
    "field-gate-arch-east", "field-gate-wing-east", "field-gate-tower-east",
  ]),
]);

const FIELD_GATEHOUSE_ENEMY_OBSTACLES = ["west-gate-pier", "west-gate-pier-east"]
  .map(id => enemyGroundObstacle(id, [id]));

const FIELD_DRESSING_ENEMY_OBSTACLES = BRIARHOLD_FIRST_PERSON_MAP.collisionVolumes
  .filter(volume => (
    (volume.appearance === "defender-brazier" || volume.appearance === "defender-cache")
    && volume.min.y <= 0.05
    && volume.min.z >= 0
  ))
  .map(volume => enemyGroundObstacle(volume.id, [volume.id]));

export const BRIARHOLD_ENEMY_GROUND_OBSTACLES = Object.freeze([
  ...FIELD_GATEHOUSE_ENEMY_OBSTACLES,
  ...FIELD_GATE_ENEMY_SHOULDERS,
  ...FIELD_DRESSING_ENEMY_OBSTACLES,
]);

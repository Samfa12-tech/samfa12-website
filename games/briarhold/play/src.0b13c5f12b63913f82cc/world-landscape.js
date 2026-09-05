import {BRIARHOLD_FIRST_PERSON_MAP, HOST_EMERGENCE_PROFILE} from './map-definition.js';

// The field continues behind the playable north limit for the staged host.
// Surround that full visible ground, not just the player's navigation bounds.
export const LANDSCAPE_PROFILE = Object.freeze({
  inner: Object.freeze({
    minX: BRIARHOLD_FIRST_PERSON_MAP.navigationBounds.min.x,
    maxX: BRIARHOLD_FIRST_PERSON_MAP.navigationBounds.max.x,
    minZ: BRIARHOLD_FIRST_PERSON_MAP.navigationBounds.min.z,
    maxZ: Math.max(196, HOST_EMERGENCE_PROFILE.roadVisualMaxZ + 24),
  }),
  outerMargin: 270,
  rings: 16,
  lowRings: 10,
  sideSegments: 26,
  lowSideSegments: 18,
  trees: 16,
  lowTrees: 8,
  rocks: 24,
  lowRocks: 12,
});

const smoothstep = (low, high, value) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

function distanceOutsideField(x, z) {
  const bounds = LANDSCAPE_PROFILE.inner;
  return Math.hypot(
    Math.max(bounds.minX - x, 0, x - bounds.maxX),
    Math.max(bounds.minZ - z, 0, z - bounds.maxZ),
  );
}

/** Smooth wooded foothills, with a low skirt meeting the existing ground. */
export function landscapeHeightAt(x, z) {
  const outside = distanceOutsideField(x, z);
  const ridge = (cx, cz, width, depth, height) => height * Math.exp(
    -(((x - cx) / width) ** 2) - ((z - cz) / depth) ** 2,
  );
  const hills = ridge(-149, 107, 70, 123, 30)
    + ridge(163, 38, 92, 82, 40)
    + ridge(95, 279, 112, 80, 42)
    + ridge(-118, -136, 103, 83, 34)
    + ridge(141, -173, 96, 68, 24);
  const folds = Math.sin(x * 0.025 + Math.sin(z * 0.012) * 1.4) * 3.3
    + Math.sin(z * 0.039 - x * 0.016) * 2.2
    + Math.sin(x * 0.087 + z * 0.048) * 0.65;
  return -0.16 + smoothstep(0, 34, outside) * Math.max(-1.2, hills + folds);
}

/** A hole at the centre keeps decorative terrain out of every authored lane. */
export function buildLandscapeTerrainData({lowSpec = false} = {}) {
  const profile = LANDSCAPE_PROFILE;
  const bounds = profile.inner;
  const rings = lowSpec ? profile.lowRings : profile.rings;
  const sideSegments = lowSpec ? profile.lowSideSegments : profile.sideSegments;
  const perimeterCount = sideSegments * 4;
  const positions = [], indices = [], uvs = [], colors = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    // Spend vertices where the ground transition is visible; fog softens the
    // wide outer cells and finally hides the terrain's distant termination.
    const margin = profile.outerMargin * (ring / rings) ** 1.5;
    const corners = [
      [bounds.minX - margin, bounds.minZ - margin],
      [bounds.maxX + margin, bounds.minZ - margin],
      [bounds.maxX + margin, bounds.maxZ + margin],
      [bounds.minX - margin, bounds.maxZ + margin],
    ];
    for (let side = 0; side < 4; side += 1) {
      const from = corners[side], to = corners[(side + 1) % 4];
      for (let segment = 0; segment < sideSegments; segment += 1) {
        const amount = segment / sideSegments;
        const x = from[0] + (to[0] - from[0]) * amount;
        const z = from[1] + (to[1] - from[1]) * amount;
        const height = landscapeHeightAt(x, z);
        positions.push(x, height, z);
        // Continue the existing forest-ground texture density without loading
        // another material or texture set.
        uvs.push((x + 52) / 104, (z + 20) / 216);
        const moss = 0.84 + Math.sin(x * 0.055 + Math.sin(z * 0.034)) * 0.055;
        colors.push(moss * 0.95, moss, moss * 0.94, 1);
      }
    }
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < perimeterCount; segment += 1) {
      const next = (segment + 1) % perimeterCount;
      const a = ring * perimeterCount + segment;
      const b = ring * perimeterCount + next;
      const c = (ring + 1) * perimeterCount + segment;
      const d = (ring + 1) * perimeterCount + next;
      indices.push(a, d, b, a, c, d);
    }
  }
  return {positions, indices, uvs, colors, rings, perimeterCount};
}

/** Sparse taller trees extend the existing woodland, using its loaded GLB. */
export function landscapeTreeTransforms({lowSpec = false} = {}) {
  const count = lowSpec ? LANDSCAPE_PROFILE.lowTrees : LANDSCAPE_PROFILE.trees;
  return Array.from({length: count}, (_, index) => {
    const side = index % 4;
    const row = Math.floor(index / 4);
    const rows = count / 4;
    const amount = (row + 0.35 + (side % 2) * 0.17) / rows;
    const offset = 22 + (row % 2) * 17;
    const bounds = LANDSCAPE_PROFILE.inner;
    const x = side === 0 ? bounds.minX - offset : side === 1 ? bounds.maxX + offset
      : -90 + amount * 180;
    const z = side === 2 ? bounds.minZ - offset : side === 3 ? bounds.maxZ + offset
      : -12 + amount * 197;
    const scale = 1.15 + ((index * 17) % 40) / 100;
    return {x, y: landscapeHeightAt(x, z) - 0.25, z,
      ry: index * 2.399963229728653, sx: scale, sy: scale * 1.15, sz: scale};
  });
}

function decorateMesh(mesh) {
  mesh.isPickable = false;
  mesh.checkCollisions = false;
  mesh.receiveShadows = false;
  mesh.metadata = {...mesh.metadata, decorativeLandscape: true, worldOccluder: false,
    shadowCaster: false, gameplayCollision: false};
  return mesh;
}

function applyTransform(mesh, transform) {
  mesh.position.set(transform.x, transform.y, transform.z);
  mesh.scaling.set(transform.sx, transform.sy, transform.sz);
  mesh.rotationQuaternion = null;
  mesh.rotation.set(0, transform.ry, 0);
  decorateMesh(mesh);
  mesh.freezeWorldMatrix();
}

export function createWorldLandscape(BABYLON, scene, mats, {lowSpec = false} = {}) {
  const data = buildLandscapeTerrainData({lowSpec});
  const terrain = decorateMesh(new BABYLON.Mesh('landscape-wooded-foothills', scene));
  const vertexData = new BABYLON.VertexData();
  vertexData.positions = data.positions;
  vertexData.indices = data.indices;
  vertexData.uvs = data.uvs;
  vertexData.colors = data.colors;
  vertexData.normals = [];
  BABYLON.VertexData.ComputeNormals(data.positions, data.indices, vertexData.normals);
  vertexData.applyToMesh(terrain, false);
  terrain.material = mats.ground;
  terrain.freezeWorldMatrix();

  // Smooth weathered stones add a nearer layer behind the existing trees.
  // Hardware instances reuse one tiny sphere and the fortress's mossy stone.
  const rock = decorateMesh(BABYLON.MeshBuilder.CreateSphere('landscape-mossy-stone', {
    segments: 3, diameter: 2,
  }, scene));
  rock.material = mats.stoneDark;
  const rocks = [rock];
  const rockCount = lowSpec ? LANDSCAPE_PROFILE.lowRocks : LANDSCAPE_PROFILE.rocks;
  for (let index = 0; index < rockCount; index += 1) {
    const mesh = index === 0 ? rock : rock.createInstance(`landscape-mossy-stone-${index}`);
    if (index > 0) rocks.push(mesh);
    const x = (index % 2 ? -1 : 1) * (60 + (index % 3) * 3.5);
    const z = -22 + (index / rockCount) * 215;
    applyTransform(mesh, {x, z, y: landscapeHeightAt(x, z) - 0.22,
      sx: 1.5 + (index % 3) * 0.7, sy: 0.65 + (index % 4) * 0.19,
      sz: 1.3 + (index % 2) * 1.1, ry: index * 2.399963229728653});
  }

  let trees = [];
  let treeSource = null;
  let treeTriangleCount = 0;
  let disposed = false;
  const disposeTrees = () => {
    for (const tree of trees.slice(1)) tree.dispose();
    treeSource?.dispose(false, false);
    trees = [];
    treeSource = null;
    treeTriangleCount = 0;
  };
  return {
    terrain,
    // Call after the existing Meshy forest resolves. No second GLB request,
    // cloned geometry, or fallback tree swap is introduced here.
    setForestSource(source) {
      if (disposed || !source?.clone || !(source.getTotalVertices?.() > 0)) return 0;
      disposeTrees();
      // Babylon instances inherit shadow reception from their source. Use a
      // separate source with shared geometry/material so distant decoration
      // cannot change reception on the close gameplay forest.
      treeSource = source.clone('landscape-woodland-tree-source', null, true);
      if (!treeSource) return 0;
      treeSource.unfreezeWorldMatrix();
      trees = landscapeTreeTransforms({lowSpec}).map((transform, index) => {
        const tree = index === 0 ? treeSource : treeSource.createInstance(`landscape-woodland-tree-${index}`);
        applyTransform(tree, transform);
        tree.setEnabled(true);
        return tree;
      });
      treeTriangleCount = (source.getTotalIndices?.() ?? 0) / 3 * trees.length;
      return trees.length;
    },
    diagnostics() {
      return {terrainTriangles: data.indices.length / 3,
        rockInstances: rocks.length, rockTriangles: rock.getTotalIndices() / 3 * rocks.length,
        treeInstances: trees.length, treeTriangles: treeTriangleCount,
        // Terrain, one shared stone batch, and an optional forest batch with
        // its existing geometry/material. Visibility can reduce actual draws.
        addedMaterialBatches: treeSource ? 3 : 2, addedTextures: 0, addedLights: 0,
        castsShadows: false, decorativeOnly: true};
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeTrees();
      for (const stone of rocks.slice(1)) stone.dispose();
      rock.dispose(false, false);
      terrain.dispose(false, false);
    },
  };
}

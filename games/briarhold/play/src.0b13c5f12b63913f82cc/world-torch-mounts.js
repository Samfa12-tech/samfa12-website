import {BRIARHOLD_FIRST_PERSON_MAP} from './map-definition.js';

// A sconce owns a face on actual fortress masonry. The arm bridges that face
// to the torch stem, including the inward-facing field arch pair reported
// from the killing field. Coordinates along each face are authored explicitly.
const definitions = [
  ['west-gate-pier', 'minZ', -21.25, 5.45],
  ['west-gate-pier-east', 'minZ', -10.75, 5.45],
  ['west-gate-pier', 'maxZ', -21.25, 5.45],
  ['west-gate-pier-east', 'maxZ', -10.75, 5.45],
  ['west-tower', 'maxZ', -30.8, 9.25],
  ['parapet-east-ramp-return', 'maxX', 0.5, 9.25],
  ['inner-west-tower', 'minZ', -8, 11.2],
  ['east-stair-east-abutment', 'maxX', -0.35, 5.45],
  ['inner-keep', 'maxZ', 0, 9],
  ['west-overlook-flank-tower', 'maxX', 19.4, 5.35],
  ['east-overlook-flank-tower', 'minX', 19.4, 5.35],
  ['field-gate-arch-west', 'minZ', -26.95, 6.05],
  ['field-gate-arch-east', 'minZ', -5.05, 6.05],
  ['field-gate-arch-west', 'maxX', 45.5, 4.35],
  ['field-gate-arch-east', 'minX', 45.5, 4.35],
  ['field-gate-tower-west', 'maxX', 44.4, 8.15],
  ['field-gate-tower-east', 'minX', 44.4, 8.15],
  ['inner-keep', 'maxZ', -7.8, 4.4],
  ['inner-keep', 'maxZ', 7.8, 4.4],
  // The visible undercroft entrance is at the forward stair shoulders, not
  // the inset logical jamb boxes beneath it.
  ['west-ramp-rail-left', 'maxZ', -29.7, 2.25],
  ['west-ramp-rail-right', 'maxZ', -23.3, 2.25],
];

export const TORCH_STANDOFF = 0.45;
export const TORCH_MOUNTS = Object.freeze(definitions.map(([collisionId, face, along, y]) => {
  const volume = BRIARHOLD_FIRST_PERSON_MAP.collisionVolumes.find(item => item.id === collisionId);
  const onX = face.endsWith('X');
  const sign = face.startsWith('max') ? 1 : -1;
  const boundary = sign === 1 ? volume.max : volume.min;
  const normal = Object.freeze({x: onX ? sign : 0, z: onX ? 0 : sign});
  const anchor = Object.freeze({x: onX ? boundary.x : along, y: y - 1.10, z: onX ? along : boundary.z});
  return Object.freeze({collisionId, face, normal, anchor,
    x: anchor.x + normal.x * TORCH_STANDOFF, y, z: anchor.z + normal.z * TORCH_STANDOFF,
  });
}));

export const TORCH_PLACEMENTS = Object.freeze(TORCH_MOUNTS.map(({x, y, z}) => Object.freeze([x, y, z])));

export function torchHardwareTransforms(mounts = TORCH_MOUNTS) {
  return mounts.flatMap(({x, y, z, normal, anchor}) => {
    const ry = Math.atan2(normal.x, normal.z);
    return [
      {x: anchor.x, y: anchor.y, z: anchor.z, ry, sx: 0.34, sy: 0.6, sz: 0.09},
      {x: (anchor.x + x) / 2, y: anchor.y, z: (anchor.z + z) / 2, ry, sx: 0.11, sy: 0.12, sz: Math.hypot(anchor.x - x, anchor.z - z) + 0.10},
      {x, y: y - 0.71, z, ry, sx: 0.32, sy: 0.12, sz: 0.32},
    ];
  });
}

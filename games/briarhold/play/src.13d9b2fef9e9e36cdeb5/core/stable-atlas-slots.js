const EMPTY_SLOT = -1;

export function stableDepthBias(id) {
  const hashed = Math.imul((id | 0) + 1, 0x9e3779b1) >>> 0;
  return 0.00015 + (hashed / 0xffffffff) * 0.00045;
}

export function createStableAtlasSlots(ids, totalIds) {
  const slotById = new Int32Array(Math.max(1, totalIds | 0));
  slotById.fill(EMPTY_SLOT);
  const frameBySlot = new Int16Array(ids.length);
  const directionBySlot = new Int16Array(ids.length);
  const visibleBySlot = new Uint8Array(ids.length);
  let dirtyTransformSlots = 0;
  let dirtyAnimationSlots = 0;
  let transformBufferUploads = 0;
  let animationBufferUploads = 0;
  let slotReassignments = 0;

  for (let slot = 0; slot < ids.length; slot += 1) {
    const id = ids[slot];
    if (id >= 0 && id < slotById.length) slotById[id] = slot;
  }

  const slotFor = (id) => (id >= 0 && id < slotById.length ? slotById[id] : EMPTY_SLOT);

  return {
    capacity: ids.length,
    slotFor,
    stableDepthBias,
    setAnimation(id, direction, frame) {
      const slot = slotFor(id);
      if (slot === EMPTY_SLOT) return false;
      if (directionBySlot[slot] === direction && frameBySlot[slot] === frame) return false;
      directionBySlot[slot] = direction;
      frameBySlot[slot] = frame;
      dirtyAnimationSlots += 1;
      return true;
    },
    setVisible(id, visible) {
      const slot = slotFor(id);
      if (slot === EMPTY_SLOT) return false;
      const next = visible ? 1 : 0;
      if (visibleBySlot[slot] === next) return false;
      visibleBySlot[slot] = next;
      dirtyTransformSlots += 1;
      return true;
    },
    markTransform(id) {
      const slot = slotFor(id);
      if (slot === EMPTY_SLOT) return false;
      dirtyTransformSlots += 1;
      return true;
    },
    flush({ transform = false, animation = false } = {}) {
      const result = { dirtyTransformSlots, dirtyAnimationSlots };
      if (transform && dirtyTransformSlots > 0) transformBufferUploads += 1;
      if (animation && dirtyAnimationSlots > 0) animationBufferUploads += 1;
      dirtyTransformSlots = 0;
      dirtyAnimationSlots = 0;
      return {
        ...result,
        transformBufferUploads,
        animationBufferUploads,
        slotReassignments
      };
    },
    snapshot() {
      let activeSlotCount = 0;
      for (let i = 0; i < visibleBySlot.length; i += 1) activeSlotCount += visibleBySlot[i];
      return {
        stableSlotCount: ids.length,
        activeSlotCount,
        slotReassignments,
        transformBufferUploads,
        animationBufferUploads,
        dirtyTransformSlots,
        dirtyAnimationSlots
      };
    }
  };
}

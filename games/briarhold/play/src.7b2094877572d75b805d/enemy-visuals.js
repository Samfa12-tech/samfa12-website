import {
  BRIARBOUND,
  enemyArchetype,
  enemyArchetypes,
  isEnemyType
} from './enemies.js';

export const ENEMY_VISUAL_STATES = Object.freeze({
  WAITING: 'waiting',
  ACTIVE: 'active',
  DYING: 'dying',
  DEAD: 'dead'
});

const BRIARBOUND_ATLAS = deepFreeze({
  sourceArchetype: 'briarbound',
  metadataUrl: 'assets/sprites/briarbound-meshy-run.json',
  textures: {
    preferred: 'ktx2',
    // The current atlas predates the KTX2 pipeline. Leaving this explicit
    // avoids a speculative request while allowing generated bundles to add it.
    ktx2: null,
    webp: 'assets/sprites/briarbound-meshy-run.webp',
    png: 'assets/sprites/briarbound-meshy-run.png'
  },
  layout: {
    frameWidth: 176,
    frameHeight: 208,
    directionCount: 8,
    atlasColumns: 8,
    atlasRows: 18
  },
  animations: {
    run: {
      name: 'run',
      fps: 12,
      frameStartRow: 0,
      framesPerDirection: 10,
      loop: true
    },
    idle: {
      name: 'idle',
      fps: 6,
      frameStartRow: 10,
      framesPerDirection: 8,
      loop: true
    }
  },
  combatAtlas: {
    metadataUrl: 'assets/sprites/briarbound-meshy-combat.json',
    textures: {
      preferred: 'webp',
      ktx2: null,
      webp: 'assets/sprites/briarbound-meshy-combat.webp',
      png: 'assets/sprites/briarbound-meshy-combat.png'
    },
    layout: {
      frameWidth: 144,
      frameHeight: 176,
      directionCount: 8,
      atlasColumns: 8,
      atlasRows: 20
    },
    animations: {
      attack: {name: 'attack', fps: 16, frameStartRow: 0, framesPerDirection: 8, loop: false},
      hit: {name: 'hit', fps: 14, frameStartRow: 8, framesPerDirection: 4, loop: false},
      death: {name: 'death', fps: 12, frameStartRow: 12, framesPerDirection: 8, loop: false}
    }
  },
  stateAnimations: {
    waiting: { preferred: 'idle', fallback: 'run', playback: 'loop' },
    active: { preferred: 'run', fallback: 'run', playback: 'loop' },
    dying: { preferred: 'death', fallback: 'run', playback: 'once' },
    dead: { preferred: 'death', fallback: 'run', playback: 'hold-last' }
  }
});

const BARKHIDE_ATLAS = deepFreeze({
  sourceArchetype: 'barkhide-brute',
  metadataUrl: 'assets/sprites/barkhide-brute-meshy-run.json',
  textures: {
    preferred: 'webp',
    ktx2: null,
    webp: 'assets/sprites/barkhide-brute-meshy-run.webp',
    png: 'assets/sprites/barkhide-brute-meshy-run.png'
  },
  layout: {
    frameWidth: 192,
    frameHeight: 224,
    directionCount: 8,
    atlasColumns: 8,
    atlasRows: 10
  },
  animations: {
    run: {name: 'run', fps: 10, frameStartRow: 0, framesPerDirection: 10, loop: true}
  },
  combatAtlas: {
    metadataUrl: 'assets/sprites/barkhide-brute-meshy-combat.json',
    textures: {
      preferred: 'webp',
      ktx2: null,
      webp: 'assets/sprites/barkhide-brute-meshy-combat.webp',
      png: 'assets/sprites/barkhide-brute-meshy-combat.png'
    },
    layout: {
      frameWidth: 192,
      frameHeight: 224,
      directionCount: 8,
      atlasColumns: 8,
      atlasRows: 17
    },
    animations: {
      attack: {name: 'attack', fps: 10, frameStartRow: 0, framesPerDirection: 6, loop: false},
      hit: {name: 'hit', fps: 10, frameStartRow: 6, framesPerDirection: 3, loop: false},
      death: {name: 'death', fps: 8, frameStartRow: 9, framesPerDirection: 8, loop: false}
    }
  },
  stateAnimations: {
    waiting: {preferred: 'idle', fallback: 'run', playback: 'loop'},
    active: {preferred: 'run', fallback: 'run', playback: 'loop'},
    dying: {preferred: 'death', fallback: 'run', playback: 'once'},
    dead: {preferred: 'death', fallback: 'run', playback: 'hold-last'}
  }
});

const SPOREWING_ATLAS = deepFreeze({
  sourceArchetype: 'sporewing-hunter',
  metadataUrl: 'assets/sprites/sporewing-hunter-meshy-flight.json',
  textures: {
    preferred: 'webp',
    ktx2: null,
    webp: 'assets/sprites/sporewing-hunter-meshy-flight.webp',
    png: 'assets/sprites/sporewing-hunter-meshy-flight.png'
  },
  layout: {
    frameWidth: 256,
    frameHeight: 256,
    directionCount: 8,
    atlasColumns: 8,
    atlasRows: 16
  },
  animations: {
    run: {name: 'run', fps: 5, frameStartRow: 0, framesPerDirection: 8, loop: true},
    idle: {name: 'idle', fps: 5, frameStartRow: 8, framesPerDirection: 8, loop: true}
  },
  combatAtlas: {
    metadataUrl: 'assets/sprites/sporewing-hunter-meshy-combat.json',
    textures: {
      preferred: 'webp',
      ktx2: null,
      webp: 'assets/sprites/sporewing-hunter-meshy-combat.webp',
      png: 'assets/sprites/sporewing-hunter-meshy-combat.png'
    },
    layout: {
      frameWidth: 256,
      frameHeight: 256,
      directionCount: 8,
      atlasColumns: 8,
      atlasRows: 17
    },
    animations: {
      attack: {name: 'attack', fps: 10, frameStartRow: 0, framesPerDirection: 6, loop: false},
      hit: {name: 'hit', fps: 10, frameStartRow: 6, framesPerDirection: 3, loop: false},
      death: {name: 'death', fps: 8, frameStartRow: 9, framesPerDirection: 8, loop: false}
    }
  },
  stateAnimations: {
    waiting: {preferred: 'idle', fallback: 'run', playback: 'loop'},
    active: {preferred: 'run', fallback: 'run', playback: 'loop'},
    dying: {preferred: 'death', fallback: 'run', playback: 'once'},
    dead: {preferred: 'death', fallback: 'run', playback: 'hold-last'}
  }
});

const MOSSGUARD_ATLAS = deepFreeze({
  sourceArchetype: 'mossguard-shield',
  metadataUrl: 'assets/sprites/mossguard-shield-meshy-run.json',
  textures: {
    preferred: 'webp',
    ktx2: null,
    webp: 'assets/sprites/mossguard-shield-meshy-run.webp',
    png: 'assets/sprites/mossguard-shield-meshy-run.png'
  },
  layout: {
    frameWidth: 208,
    frameHeight: 224,
    directionCount: 8,
    atlasColumns: 8,
    atlasRows: 10
  },
  animations: {
    run: {name: 'run', fps: 10, frameStartRow: 0, framesPerDirection: 10, loop: true}
  },
  combatAtlas: {
    metadataUrl: 'assets/sprites/mossguard-shield-meshy-combat.json',
    textures: {
      preferred: 'webp',
      ktx2: null,
      webp: 'assets/sprites/mossguard-shield-meshy-combat.webp',
      png: 'assets/sprites/mossguard-shield-meshy-combat.png'
    },
    layout: {
      frameWidth: 208,
      frameHeight: 224,
      directionCount: 8,
      atlasColumns: 8,
      atlasRows: 17
    },
    animations: {
      attack: {name: 'attack', fps: 10, frameStartRow: 0, framesPerDirection: 6, loop: false},
      hit: {name: 'hit', fps: 10, frameStartRow: 6, framesPerDirection: 3, loop: false},
      death: {name: 'death', fps: 8, frameStartRow: 9, framesPerDirection: 8, loop: false}
    }
  },
  stateAnimations: {
    waiting: {preferred: 'idle', fallback: 'run', playback: 'loop'},
    active: {preferred: 'run', fallback: 'run', playback: 'loop'},
    dying: {preferred: 'death', fallback: 'run', playback: 'once'},
    dead: {preferred: 'death', fallback: 'run', playback: 'hold-last'}
  }
});

const WICKER_COLOSSUS_ATLAS = deepFreeze({
  sourceArchetype: 'wicker-colossus',
  metadataUrl: 'assets/sprites/wicker-colossus-meshy-run.json',
  textures: {
    preferred: 'webp',
    ktx2: null,
    webp: 'assets/sprites/wicker-colossus-meshy-run.webp',
    png: 'assets/sprites/wicker-colossus-meshy-run.png'
  },
  layout: {
    frameWidth: 176,
    frameHeight: 224,
    directionCount: 8,
    atlasColumns: 8,
    atlasRows: 8
  },
  animations: {
    run: {name: 'run', fps: 8, frameStartRow: 0, framesPerDirection: 8, loop: true}
  },
  combatAtlas: {
    metadataUrl: 'assets/sprites/wicker-colossus-meshy-combat.json',
    textures: {
      preferred: 'webp',
      ktx2: null,
      webp: 'assets/sprites/wicker-colossus-meshy-combat.webp',
      png: 'assets/sprites/wicker-colossus-meshy-combat.png'
    },
    layout: {
      frameWidth: 176,
      frameHeight: 224,
      directionCount: 8,
      atlasColumns: 8,
      atlasRows: 17
    },
    animations: {
      attack: {name: 'attack', fps: 12, frameStartRow: 0, framesPerDirection: 6, loop: false},
      hit: {name: 'hit', fps: 12, frameStartRow: 6, framesPerDirection: 3, loop: false},
      death: {name: 'death', fps: 8, frameStartRow: 9, framesPerDirection: 8, loop: false}
    }
  },
  stateAnimations: {
    waiting: {preferred: 'idle', fallback: 'run', playback: 'loop'},
    active: {preferred: 'run', fallback: 'run', playback: 'loop'},
    dying: {preferred: 'death', fallback: 'run', playback: 'once'},
    dead: {preferred: 'death', fallback: 'run', playback: 'hold-last'}
  }
});

const ARCHETYPE_ALIASES = Object.freeze({
  barkhide: 'barkhide-brute',
  mossguard: 'mossguard-shield',
  barkbreaker: 'wicker-colossus'
});

const KNOWN_ARCHETYPE_KEYS = new Set(enemyArchetypes().map(({ key }) => key));

function fallbackBundle(archetype) {
  return {
    id: `${archetype}-atlas-v1`,
    archetype,
    fallback: archetype !== 'briarbound',
    ...BRIARBOUND_ATLAS
  };
}

/**
 * Renderer-independent atlas declarations. Replace one entry at a time as its
 * authored Meshy atlas is generated; consumers do not need to special-case a
 * missing archetype asset.
 */
export const ENEMY_ATLAS_BUNDLES = deepFreeze(Object.fromEntries(
  enemyArchetypes().map(({key}) => {
    if (key === 'barkhide-brute') {
      return [key, {id: 'barkhide-brute-atlas-v1', archetype: key, fallback: false, ...BARKHIDE_ATLAS}];
    }
    if (key === 'sporewing') {
      return [key, {id: 'sporewing-hunter-atlas-v2', archetype: key, fallback: false, ...SPOREWING_ATLAS}];
    }
    if (key === 'mossguard-shield') {
      return [key, {id: 'mossguard-shield-atlas-v1', archetype: key, fallback: false, ...MOSSGUARD_ATLAS}];
    }
    if (key === 'wicker-colossus') {
      return [key, {id: 'wicker-colossus-atlas-v1', archetype: key, fallback: false, ...WICKER_COLOSSUS_ATLAS}];
    }
    return [key, fallbackBundle(key)];
  })
));

/**
 * First-slice Night 1 deliberately preloads every demonstrated archetype.
 * Later entries preserve the authored campaign's current roster requirements.
 */
export const NIGHT_ATLAS_ARCHETYPES = deepFreeze({
  1: ['briarbound', 'mossguard-shield', 'barkhide-brute', 'sporewing', 'wicker-colossus'],
  2: ['briarbound', 'mossguard-shield'],
  3: ['briarbound', 'barkhide-brute', 'root-sapper', 'wicker-colossus'],
  4: ['briarbound', 'mossguard-shield', 'sporewing'],
  5: ['briarbound', 'wicker-colossus'],
  6: ['briarbound', 'barkhide-brute', 'root-sapper', 'sporewing'],
  7: enemyArchetypes().map(({ key }) => key)
});

export function normalizeEnemyVisualArchetype(value) {
  if (isEnemyType(value)) return enemyArchetype(value).key;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    const candidate = ARCHETYPE_ALIASES[normalized] || normalized;
    if (KNOWN_ARCHETYPE_KEYS.has(candidate)) return candidate;
  }
  return enemyArchetype(BRIARBOUND).key;
}

export function enemyAtlasBundle(archetype) {
  return ENEMY_ATLAS_BUNDLES[normalizeEnemyVisualArchetype(archetype)];
}

export function atlasBundlesForNight(night = 1) {
  const requested = requestedArchetypesForNight(night);
  const seen = new Set();
  const bundles = [];
  for (const value of requested) {
    const key = normalizeEnemyVisualArchetype(value);
    if (seen.has(key)) continue;
    seen.add(key);
    bundles.push(ENEMY_ATLAS_BUNDLES[key]);
  }
  return Object.freeze(bundles);
}

/**
 * Choose one upload source. KTX2 wins only when both the runtime and the bundle
 * support it; otherwise WebP, then PNG, provides an offline-safe fallback.
 */
export function selectAtlasTexture(bundle, capabilities = {}) {
  const textures = bundle?.textures || {};
  if (capabilities.supportsKtx2 === true && textures.ktx2) {
    return Object.freeze({ format: 'ktx2', url: textures.ktx2 });
  }
  if (capabilities.supportsWebP !== false && textures.webp) {
    return Object.freeze({ format: 'webp', url: textures.webp });
  }
  if (textures.png) return Object.freeze({ format: 'png', url: textures.png });
  throw new Error(`atlas bundle ${bundle?.id || '<unknown>'} has no compatible texture`);
}

/**
 * URLs are intentionally deduplicated: while archetypes share the current
 * fallback atlas, a night fetches its JSON and selected texture only once.
 */
export function preloadUrlsForNight(night = 1, capabilities = {}) {
  const urls = [];
  const seen = new Set();
  for (const bundle of atlasBundlesForNight(night)) {
    const combatTexture = bundle.combatAtlas
      ? selectAtlasTexture(bundle.combatAtlas, capabilities).url
      : null;
    for (const url of [
      bundle.metadataUrl,
      selectAtlasTexture(bundle, capabilities).url,
      bundle.combatAtlas?.metadataUrl,
      combatTexture,
    ]) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
  }
  return Object.freeze(urls);
}

export function normalizeEnemyVisualState(state) {
  const normalized = typeof state === 'string' ? state.trim().toLowerCase() : '';
  return Object.values(ENEMY_VISUAL_STATES).includes(normalized)
    ? normalized
    : ENEMY_VISUAL_STATES.ACTIVE;
}

/**
 * Resolve a stable atlas frame from authoritative simulation state. Times are
 * seconds. The fallback run atlas loops for active enemies, plays once while
 * dying, and holds its last frame for dead enemies until death art is added.
 */
export function resolveEnemyVisualState(input = {}) {
  const archetype = normalizeEnemyVisualArchetype(input.archetype ?? input.type);
  const bundle = ENEMY_ATLAS_BUNDLES[archetype];
  const state = normalizeEnemyVisualState(input.state);
  const stateAnimation = bundle.stateAnimations[state];
  const combatAnimation = bundle.combatAtlas?.animations?.[stateAnimation.preferred] || null;
  const animation = combatAnimation
    || bundle.animations[stateAnimation.preferred]
    || bundle.animations[stateAnimation.fallback]
    || Object.values(bundle.animations)[0];
  if (!animation) throw new Error(`atlas bundle ${bundle.id} has no animations`);

  const animationLayout = combatAnimation ? bundle.combatAtlas.layout : bundle.layout;
  const directionCount = positiveInteger(animationLayout.directionCount, 1);
  const direction = wrapInteger(input.direction, directionCount);
  const stateStart = finiteNumber(input.stateStart, 0);
  const now = Math.max(stateStart, finiteNumber(input.now, stateStart));
  const elapsed = now - stateStart;
  const frameCount = positiveInteger(animation.framesPerDirection, 1);
  const rawFrame = Math.floor(elapsed * Math.max(0, finiteNumber(animation.fps, 0)));
  let frameIndex;
  if (stateAnimation.playback === 'hold-last') frameIndex = frameCount - 1;
  else if (stateAnimation.playback === 'once') frameIndex = Math.min(frameCount - 1, rawFrame);
  else frameIndex = rawFrame % frameCount;

  const row = Math.max(0, Math.trunc(animation.frameStartRow || 0)) + frameIndex;
  const columns = positiveInteger(animationLayout.atlasColumns, directionCount);
  const rows = positiveInteger(animationLayout.atlasRows, frameCount);

  return Object.freeze({
    archetype,
    bundleId: bundle.id,
    fallbackAtlas: bundle.fallback,
    state,
    animation: animation.name,
    fallbackAnimation: animation.name !== stateAnimation.preferred,
    playback: stateAnimation.playback,
    direction,
    frameIndex,
    atlasFrameIndex: row * columns + direction,
    elapsed,
    uv: Object.freeze({
      u: direction / columns,
      v: row / rows,
      w: 1 / columns,
      h: 1 / rows
    })
  });
}

function requestedArchetypesForNight(night) {
  if (Array.isArray(night)) return night;
  if (night && typeof night === 'object') {
    const roster = Array.isArray(night.visualArchetypes)
      ? night.visualArchetypes
      : (Array.isArray(night.enemies) ? night.enemies : []);
    return night.boss ? [...roster, night.boss] : roster;
  }
  const nightId = Number(night);
  if (!Number.isInteger(nightId) || !NIGHT_ATLAS_ARCHETYPES[nightId]) {
    throw new RangeError(`unknown night atlas roster: ${night}`);
  }
  return NIGHT_ATLAS_ARCHETYPES[nightId];
}

function wrapInteger(value, length) {
  const integer = Math.trunc(finiteNumber(value, 0));
  return ((integer % length) + length) % length;
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

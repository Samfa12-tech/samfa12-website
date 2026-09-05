const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software|microsoft basic render|\bwarp\b/iu;

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normaliseGraphicsInfo(value = {}) {
  return Object.freeze({
    vendor: String(value.vendor || "unknown"),
    renderer: String(value.renderer || "unknown"),
    version: String(value.version || "unknown"),
  });
}

export function graphicsInfoForEngine(engine) {
  try { return normaliseGraphicsInfo(engine?.getGlInfo?.() || {}); }
  catch { return normaliseGraphicsInfo(); }
}

export function isSoftwareGraphics(info) {
  const safe = normaliseGraphicsInfo(info);
  return SOFTWARE_RENDERER.test(`${safe.vendor} ${safe.renderer}`);
}

export function maximumRenderScale({coarse = false, software = false} = {}) {
  // Beyond 3x, software WebGL can corrupt Babylon's resized framebuffer and
  // phones become too soft to aim accurately. Density remains untouched; if a
  // device is still slow at this floor, we optimise rendering rather than
  // degrading the picture into an unstable 3.5-4x target.
  return coarse || software ? 3 : 4;
}

/**
 * Keeps touch/mobile presentation work bounded on high-refresh displays while
 * leaving simulation time tied to presented frames. The deadline advances by
 * a fixed interval so 90 Hz panels average the requested rate instead of
 * falling to half refresh, and resets after a long stall rather than trying to
 * catch up with a burst of frames.
 */
export function createFramePacer({targetFps = 0, startAt = 0} = {}) {
  const fps = Math.max(0, finite(targetFps, 0));
  return {
    interval: fps > 0 ? 1 / fps : 0,
    nextFrameAt: Math.max(0, finite(startAt, 0)),
  };
}

export function resetFramePacer(state, now = 0) {
  if (!state) return;
  state.nextFrameAt = Math.max(0, finite(now, 0));
}

export function setFramePacerTarget(state, targetFps = 0, now = 0) {
  if (!state) return;
  const fps = Math.max(0, finite(targetFps, 0));
  state.interval = fps > 0 ? 1 / fps : 0;
  resetFramePacer(state, now);
}

export function shouldPresentFrame(state, now) {
  if (!state || state.interval <= 0) return true;
  const time = Math.max(0, finite(now, 0));
  // Half a millisecond absorbs normal requestAnimationFrame timestamp jitter
  // without materially exceeding the target presentation rate.
  if (time + 0.0005 < state.nextFrameAt) return false;
  if (time - state.nextFrameAt > state.interval * 4) {
    state.nextFrameAt = time + state.interval;
  } else {
    state.nextFrameAt += state.interval;
  }
  return true;
}

/**
 * Frame-time governor for embedded/software WebGL paths. It never changes
 * simulation density; only render resolution is lowered, and only after
 * consecutive measured slow frames. External browsers that remain fast stay
 * at their authored hardware scale.
 */
export function createRenderGovernor({
  baseScale = 2,
  maxScale = 4,
  software = false,
  enabled = true,
  targetFps = 60,
} = {}) {
  const minimum = Math.max(1, finite(baseScale, 2));
  const maximum = Math.max(minimum, finite(maxScale, 4));
  const frameBudget = 1 / Math.max(20, finite(targetFps, 60));
  return {
    enabled: Boolean(enabled),
    baseScale: minimum,
    maxScale: maximum,
    scale: Boolean(enabled) && software ? Math.min(maximum, Math.max(minimum, 3)) : minimum,
    software: Boolean(software),
    slowScore: 0,
    fastScore: 0,
    slowSeconds: 0,
    fastSeconds: 0,
    cooldownSeconds: 0,
    adjustments: 0,
    observedFrames: 0,
    frameBudget,
  };
}

export function updateRenderGovernor(state, frameSeconds) {
  if (!state?.enabled) return {changed: false, scale: state?.scale ?? 1};
  const seconds = Math.max(0, finite(frameSeconds, 0));
  const budget = Math.max(1 / 120, finite(state.frameBudget, 1 / 60));
  state.observedFrames += 1;
  state.cooldownSeconds = Math.max(0, finite(state.cooldownSeconds, 0) - Math.min(seconds, 0.25));
  const slow = seconds >= budget * 1.15;
  const fast = seconds > 0 && seconds <= budget * 1.05;
  if (slow) state.slowSeconds += Math.min(seconds, 0.25);
  else state.slowSeconds = Math.max(0, state.slowSeconds - Math.min(seconds, 0.25) * 2);
  if (fast) state.fastSeconds += Math.min(seconds, 0.25);
  else state.fastSeconds = Math.max(0, state.fastSeconds - Math.min(seconds, 0.25) * 2);
  // Retain the original counters for diagnostics/backward-compatible callers;
  // decisions use wall-clock evidence rather than refresh-rate-dependent counts.
  state.slowScore = state.slowSeconds;
  state.fastScore = state.fastSeconds;

  if (state.cooldownSeconds > 0) {
    return {changed: false, scale: state.scale};
  }

  if (state.fastSeconds >= 5 && state.scale > state.baseScale) {
    state.scale = Math.max(state.baseScale, state.scale - 0.25);
    state.slowScore = 0;
    state.fastScore = 0;
    state.slowSeconds = 0;
    state.fastSeconds = 0;
    state.cooldownSeconds = 2;
    state.adjustments += 1;
    return {changed: true, scale: state.scale};
  }

  if (state.slowSeconds < 2 || state.scale >= state.maxScale) {
    return {changed: false, scale: state.scale};
  }
  state.scale = Math.min(state.maxScale, state.scale + 0.25);
  state.slowScore = 0;
  state.fastScore = 0;
  state.slowSeconds = 0;
  state.fastSeconds = 0;
  state.cooldownSeconds = 2;
  state.adjustments += 1;
  return {changed: true, scale: state.scale};
}

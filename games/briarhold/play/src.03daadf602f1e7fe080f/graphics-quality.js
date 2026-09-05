export const GRAPHICS_QUALITY = Object.freeze({
  AUTO: "auto",
  HIGH: "high",
  BALANCED: "balanced",
  PERFORMANCE: "performance",
});

export const FRAME_RATE_LIMIT = Object.freeze({
  FPS_60: "60",
  UNCAPPED: "uncapped",
});

const VALID_QUALITY = new Set(Object.values(GRAPHICS_QUALITY));

export function normaliseGraphicsQuality(value) {
  const quality = String(value || "").toLowerCase();
  return VALID_QUALITY.has(quality) ? quality : GRAPHICS_QUALITY.AUTO;
}

export function normaliseFrameRateLimit(value, {coarse = false} = {}) {
  if (value === FRAME_RATE_LIMIT.FPS_60 || value === FRAME_RATE_LIMIT.UNCAPPED) return value;
  return coarse ? FRAME_RATE_LIMIT.FPS_60 : FRAME_RATE_LIMIT.UNCAPPED;
}

/** Babylon hardware scale: 1 is native; larger values trade resolution for speed. */
export function graphicsScaleForQuality(value, {
  coarse = false,
  devicePixelRatio = 1,
  software = false,
} = {}) {
  const quality = normaliseGraphicsQuality(value);
  if (quality === GRAPHICS_QUALITY.HIGH) return 1;
  if (quality === GRAPHICS_QUALITY.BALANCED) return 1.5;
  if (quality === GRAPHICS_QUALITY.PERFORMANCE) return 2;
  if (software) return 2.5;
  // Auto begins at native resolution and moves down only after measured,
  // sustained pressure. This makes it the highest stable quality policy rather
  // than a pre-emptive resolution downgrade based on device class or DPR.
  return 1;
}

export function graphicsQualityUsesGovernor(value) {
  return normaliseGraphicsQuality(value) === GRAPHICS_QUALITY.AUTO;
}

export function graphicsResolutionLabel({quality, width, height, scale, renderer = ""} = {}) {
  const safeWidth = Math.max(1, Math.round(Number(width) || 1));
  const safeHeight = Math.max(1, Math.round(Number(height) || 1));
  const safeScale = Math.max(1, Number(scale) || 1);
  const qualityName = {
    [GRAPHICS_QUALITY.AUTO]: "Auto",
    [GRAPHICS_QUALITY.HIGH]: "High",
    [GRAPHICS_QUALITY.BALANCED]: "Balanced",
    [GRAPHICS_QUALITY.PERFORMANCE]: "Performance",
  }[normaliseGraphicsQuality(quality)];
  const rendererName = String(renderer || "").replace(/^ANGLE \(/u, "").split(",")[0].trim();
  return `${qualityName} · ${safeWidth}×${safeHeight} · ${safeScale.toFixed(2)}×${rendererName ? ` · ${rendererName}` : ""}`;
}

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

/** App hardware scale: 1 renders at CSS viewport resolution before pixel caps;
 * larger values trade resolution for speed. Device DPR does not raise this floor. */
export function graphicsScaleForQuality(value, {
  coarse = false,
  devicePixelRatio = 1,
  software = false,
} = {}) {
  const quality = normaliseGraphicsQuality(value);
  if (quality === GRAPHICS_QUALITY.HIGH) return 1;
  if (quality === GRAPHICS_QUALITY.BALANCED) return coarse && !software ? 1.15 : 1.5;
  if (quality === GRAPHICS_QUALITY.PERFORMANCE) return coarse && !software ? 1.25 : 2;
  if (software) return 2.5;
  // Auto begins at CSS viewport resolution and moves down only after measured,
  // sustained pressure. This makes it the highest stable quality policy rather
  // than a pre-emptive resolution downgrade based on device class or DPR.
  return 1;
}

export function graphicsQualityUsesGovernor(value) {
  return normaliseGraphicsQuality(value) === GRAPHICS_QUALITY.AUTO;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** Describe observed buffer dimensions, never infer them from the quality preset
 * or hardware scale. CSS viewport and DPR are separate measurements. */
export function graphicsResolutionInfo({width, height, cssWidth, cssHeight, devicePixelRatio} = {}) {
  const renderWidth = Math.max(1, Math.round(positiveNumber(width) ?? 1));
  const renderHeight = Math.max(1, Math.round(positiveNumber(height) ?? 1));
  const viewportWidth = positiveNumber(cssWidth);
  const viewportHeight = positiveNumber(cssHeight);
  const pixelRatio = positiveNumber(devicePixelRatio);
  const viewportRatio = viewportWidth && viewportHeight
    ? Math.sqrt(renderWidth * renderHeight / (viewportWidth * viewportHeight))
    : null;
  return {
    width: renderWidth,
    height: renderHeight,
    cssWidth: viewportWidth,
    cssHeight: viewportHeight,
    devicePixelRatio: pixelRatio,
    pixelsPerCssPixel: viewportRatio,
    pixelsPerDevicePixel: viewportRatio && pixelRatio ? viewportRatio / pixelRatio : null,
  };
}

export function graphicsResolutionLabel({quality, renderer = "", ...measurements} = {}) {
  const resolution = graphicsResolutionInfo(measurements);
  const qualityName = {
    [GRAPHICS_QUALITY.AUTO]: "Auto",
    [GRAPHICS_QUALITY.HIGH]: "High",
    [GRAPHICS_QUALITY.BALANCED]: "Balanced",
    [GRAPHICS_QUALITY.PERFORMANCE]: "Performance",
  }[normaliseGraphicsQuality(quality)];
  const rendererName = String(renderer || "").replace(/^ANGLE \(/u, "").split(",")[0].trim();
  const viewport = resolution.cssWidth && resolution.cssHeight
    ? ` · ${Math.round(resolution.cssWidth)}×${Math.round(resolution.cssHeight)} viewport`
    : "";
  const dpr = resolution.devicePixelRatio
    ? ` · DPR ${Number(resolution.devicePixelRatio.toFixed(3))}`
    : "";
  return `${qualityName} · ${resolution.width}×${resolution.height} render${viewport}${dpr}${rendererName ? ` · ${rendererName}` : ""}`;
}

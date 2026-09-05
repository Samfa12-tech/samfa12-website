export const IOS_RENDER_PIXEL_BUDGETS = Object.freeze({
  battery: 1_050_000,
  balanced: 1_350_000,
  sharp: 1_800_000
});

// A phone WebView can lose its compositor context under GPU-memory pressure
// even while frame timing remains stable. These are absolute drawing-buffer
// ceilings, independent of the adaptive FPS governor and the selected mode.
export const MOBILE_RENDER_PIXEL_BUDGETS = Object.freeze({
  auto: 1_800_000,
  high: 1_800_000,
  balanced: 1_350_000,
  performance: 1_050_000,
});

const finite = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function resolveRenderPixelBudget(options = {}) {
  const cssWidth = Math.max(1, finite(options.cssWidth, 1));
  const cssHeight = Math.max(1, finite(options.cssHeight, 1));
  const devicePixelRatio = clamp(finite(options.devicePixelRatio, 1), 1, 8);
  const requestedDownscale = clamp(
    finite(options.requestedDownscale, 1),
    0.25,
    8
  );
  const useDevicePixels = options.useDevicePixels === true;
  const sourcePixelRatio = useDevicePixels ? devicePixelRatio : 1;
  const sourceWidth = cssWidth * sourcePixelRatio;
  const sourceHeight = cssHeight * sourcePixelRatio;
  const sourcePixels = sourceWidth * sourceHeight;
  const requestedPixels =
    sourcePixels / (requestedDownscale * requestedDownscale);
  const configuredBudget = finite(options.maxCanvasPixels, Number.POSITIVE_INFINITY);
  const pixelBudget =
    configuredBudget > 0 ? configuredBudget : Number.POSITIVE_INFINITY;
  const minimumWidth = Math.max(1, finite(options.minimumWidth, 480));
  const minimumHeight = Math.max(1, finite(options.minimumHeight, 270));
  const minimumPixels = Math.min(
    sourcePixels,
    Math.max(minimumWidth * minimumHeight, 1)
  );
  const targetPixels = clamp(
    Math.min(requestedPixels, pixelBudget),
    minimumPixels,
    sourcePixels
  );
  const actualDownscale = Math.max(1, Math.sqrt(sourcePixels / targetPixels));
  const hardwareScalingLevel = actualDownscale / sourcePixelRatio;
  const renderWidth = Math.max(1, Math.round(cssWidth / hardwareScalingLevel));
  const renderHeight = Math.max(1, Math.round(cssHeight / hardwareScalingLevel));
  const renderPixelCount = renderWidth * renderHeight;

  return {
    cssWidth,
    cssHeight,
    devicePixelRatio,
    sourcePixelRatio,
    requestedDownscale,
    actualDownscale,
    requestedHardwareScalingLevel: requestedDownscale / sourcePixelRatio,
    hardwareScalingLevel,
    sourcePixels: Math.round(sourcePixels),
    requestedPixels: Math.round(requestedPixels),
    pixelBudget: Number.isFinite(pixelBudget) ? Math.round(pixelBudget) : null,
    renderWidth,
    renderHeight,
    renderPixelCount,
    budgetLimited: Number.isFinite(pixelBudget) && requestedPixels > pixelBudget
  };
}
export function renderPixelBudgetForDevice({
  appleMobile = false,
  coarse = false,
  graphicsQuality = 'balanced',
  override
} = {}) {
  const explicit = Number(override);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  if (!appleMobile && !coarse) return Number.POSITIVE_INFINITY;
  const quality = String(graphicsQuality || 'auto').toLowerCase();
  if (appleMobile && !coarse) {
    return IOS_RENDER_PIXEL_BUDGETS[quality] || IOS_RENDER_PIXEL_BUDGETS.balanced;
  }
  return MOBILE_RENDER_PIXEL_BUDGETS[quality] || MOBILE_RENDER_PIXEL_BUDGETS.auto;
}

const INTERACTIVE_MOUSE_TARGETS = [
  "button",
  "input",
  "select",
  "textarea",
  "a",
  "[role='dialog']",
  ".build-panel",
  ".menu-drawer",
  "[data-pointer-lock-block]",
].join(",");

const CAPTURE_PHASES = new Set(["daytime", "combat", "interwave_recovery", "build_break"]);
export const POINTER_LOCK_FALLBACK_DELAY_MS = 160;

export function shouldCaptureGameplayMouse(event, {
  phase,
  paused = false,
  portrait = false,
} = {}) {
  if (!event || paused || portrait || !CAPTURE_PHASES.has(phase)) return false;
  if (event.pointerType && event.pointerType !== "mouse") return false;
  if (event.button !== 0) return false;
  const target = event.target;
  return !target?.closest?.(INTERACTIVE_MOUSE_TARGETS);
}

export function requestGameplayPointerLock(
  canvas,
  onFallback = () => {},
  {
    isLocked = () => false,
    scheduleFallback = (callback, delay) => setTimeout(callback, delay),
    fallbackDelayMs = POINTER_LOCK_FALLBACK_DELAY_MS,
  } = {},
) {
  let fallbackUsed = false;
  const fallback = () => {
    if (fallbackUsed) return;
    fallbackUsed = true;
    onFallback();
  };

  try {
    if (typeof canvas?.requestPointerLock !== "function") {
      fallback();
      return false;
    }
    const request = canvas.requestPointerLock();
    request?.catch?.(fallback);
    // Embedded and older Pointer Lock implementations return undefined and
    // can silently refuse capture without dispatching pointerlockerror. Verify
    // the observable lock state after a short grace period so trackpads still
    // receive the hover/drag aiming fallback in that host failure mode.
    scheduleFallback(() => {
      if (!isLocked()) fallback();
    }, Math.max(0, Number(fallbackDelayMs) || 0));
    return true;
  } catch {
    fallback();
    return false;
  }
}

/**
 * Distinguishes a real mouse/trackpad gesture from touch and programmatic
 * controller/menu activation. Pointer lock must only be requested from a
 * trusted desktop gesture or mobile browsers can show a spurious denial.
 */
export function isDesktopMouseCaptureGesture(event) {
  if (!event || event.isTrusted === false) return false;
  if (event.pointerType && event.pointerType !== "mouse") return false;
  if (event.sourceCapabilities?.firesTouchEvents) return false;
  return true;
}

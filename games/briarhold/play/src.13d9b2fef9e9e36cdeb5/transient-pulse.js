/** Clear one transient presentation and its queued RAF before hiding its HUD. */
export function clearTransientPulse(element, className, pendingPulses, {
  cancelFrame = globalThis.cancelAnimationFrame,
} = {}) {
  if (!element?.classList || !className) return false;
  const pending = pendingPulses?.get(element);
  const active = element.classList.contains(className);
  if (pending !== undefined) {
    cancelFrame?.(pending);
    pendingPulses.delete(element);
  }
  element.classList.remove(className);
  return active || pending !== undefined;
}

/** An unrelated animation or a newer queued pulse must not finish this pulse. */
export function finishTransientPulse(event, {
  element,
  className,
  animationName,
  pendingPulses,
} = {}) {
  if (!element?.classList || !className || event?.target !== element
    || event.animationName !== animationName || pendingPulses?.has(element)) return false;
  const active = element.classList.contains(className);
  element.classList.remove(className);
  return active;
}

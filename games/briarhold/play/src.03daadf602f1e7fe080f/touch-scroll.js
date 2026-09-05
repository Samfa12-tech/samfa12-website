const INTERACTIVE_SELECTOR = "input, select, button, textarea, a, label.toggle-row, [data-touch-scroll-native]";
const HORIZONTAL_CONTROL_SELECTOR = 'input[type="range"], [data-touch-scroll-native]';

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * Gives constrained WebViews a deterministic one-finger drag path for a
 * nested scroll panel. Vertical drags scroll even when they start on a
 * control, while taps and horizontal range gestures retain native behaviour.
 */
export function installTouchDragScroll(element, {minimumDrag = 3} = {}) {
  if (!element?.addEventListener) return () => {};

  let activePointer = null;
  let startX = 0;
  let startY = 0;
  let lastY = 0;
  let dragging = false;
  let interactiveStart = false;
  let horizontalControlStart = false;
  let captured = false;
  let suppressClick = false;
  let clearClickSuppression = null;

  function capturePointer(pointerId) {
    if (captured) return;
    try {
      element.setPointerCapture?.(pointerId);
      captured = true;
    } catch { /* Pointer capture is an enhancement. */ }
  }

  function resetPointer({release = true} = {}) {
    if (release && captured && activePointer !== null) {
      try { element.releasePointerCapture?.(activePointer); } catch { /* Cancellation may release it first. */ }
    }
    activePointer = null;
    dragging = false;
    interactiveStart = false;
    horizontalControlStart = false;
    captured = false;
  }

  function pointerDown(event) {
    if (event.pointerType !== "touch" || activePointer !== null || !Number.isFinite(event.clientY)) return;
    activePointer = event.pointerId;
    startX = Number.isFinite(event.clientX) ? event.clientX : 0;
    startY = event.clientY;
    lastY = event.clientY;
    dragging = false;
    interactiveStart = Boolean(event.target?.closest?.(INTERACTIVE_SELECTOR));
    horizontalControlStart = Boolean(event.target?.closest?.(HORIZONTAL_CONTROL_SELECTOR));
    if (!interactiveStart) {
      event.preventDefault?.();
      capturePointer(event.pointerId);
    }
  }

  function pointerMove(event) {
    if (event.pointerId !== activePointer || !Number.isFinite(event.clientY)) return;
    if (!dragging) {
      const deltaX = (Number.isFinite(event.clientX) ? event.clientX : startX) - startX;
      const deltaY = event.clientY - startY;
      const horizontalDistance = Math.abs(deltaX);
      const verticalDistance = Math.abs(deltaY);
      if (verticalDistance < minimumDrag || verticalDistance < horizontalDistance) {
        // A range slider keeps a horizontal gesture. Other starts remain
        // eligible in case the user's swipe becomes vertically dominant.
        if (horizontalControlStart && horizontalDistance >= minimumDrag && horizontalDistance > verticalDistance) {
          resetPointer({release: false});
        }
        return;
      }
      dragging = true;
      capturePointer(event.pointerId);
    }
    const deltaY = event.clientY - lastY;
    lastY = event.clientY;
    const maximum = Math.max(0, Number(element.scrollHeight) - Number(element.clientHeight));
    element.scrollTop = clamp(Number(element.scrollTop) - deltaY, 0, maximum);
    event.preventDefault?.();
  }

  function releasePointer(event) {
    if (event.pointerId !== activePointer) return;
    if (dragging && interactiveStart) {
      suppressClick = true;
      clearTimeout(clearClickSuppression);
      clearClickSuppression = setTimeout(() => { suppressClick = false; }, 0);
    }
    resetPointer();
  }

  function suppressDraggedControlClick(event) {
    if (!suppressClick) return;
    suppressClick = false;
    clearTimeout(clearClickSuppression);
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    event.stopPropagation?.();
  }

  element.classList?.add("is-touch-drag-scroll");
  element.addEventListener("pointerdown", pointerDown, {passive: false});
  element.addEventListener("pointermove", pointerMove, {passive: false});
  element.addEventListener("pointerup", releasePointer);
  element.addEventListener("pointercancel", releasePointer);
  element.addEventListener("click", suppressDraggedControlClick, true);

  return () => {
    clearTimeout(clearClickSuppression);
    element.classList?.remove("is-touch-drag-scroll");
    element.removeEventListener("pointerdown", pointerDown);
    element.removeEventListener("pointermove", pointerMove);
    element.removeEventListener("pointerup", releasePointer);
    element.removeEventListener("pointercancel", releasePointer);
    element.removeEventListener("click", suppressDraggedControlClick, true);
  };
}

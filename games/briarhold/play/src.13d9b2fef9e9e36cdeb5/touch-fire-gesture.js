// One pointer owns Fire. A hot weapon reserves a short tap for cooling, while
// a hold keeps firing. Active timing never converts a hold into a cooling tap.
export const TOUCH_FIRE_HOLD_SECONDS = 0.16;
const TAP_DRAG_PIXELS = 12;

export function createTouchFireGesture() {
  let gesture = null;
  function valid(context) {
    if (gesture && (!context.enabled || context.key !== gesture.key)) gesture = null;
    return gesture;
  }
  return {
    begin(pointerId, now, point, context) {
      if (!context.enabled || gesture) return false;
      gesture = {pointerId, at: now, x: point.x, y: point.y, key: context.key,
        role: context.role, attempt: context.attempt, dragged: false, held: context.role === 'fire'};
      return true;
    },
    move(pointerId, point) {
      if (!gesture || pointerId !== gesture.pointerId) return;
      if (Math.hypot(point.x - gesture.x, point.y - gesture.y) > TAP_DRAG_PIXELS) {
        gesture.dragged = true;
        if (gesture.role === 'start') gesture.held = true;
      }
    },
    read(now, context) {
      const current = valid(context);
      if (!current) return {fire: false, blocksAutomaticFire: false};
      if (now - current.at >= TOUCH_FIRE_HOLD_SECONDS) current.held = true;
      // Cancellation cannot turn a held timing pointer into fire. It stays
      // inert until released, even if the authority attempt ends in the meantime.
      const fire = current.held && current.role !== 'timing';
      return {fire, blocksAutomaticFire: !fire};
    },
    end(pointerId, now, context, {cancelled = false, inside = true} = {}) {
      const current = valid(context);
      if (!current || pointerId !== current.pointerId) return false;
      gesture = null;
      return !cancelled && inside && !current.dragged && !current.held
        && now - current.at >= 0 && now - current.at < TOUCH_FIRE_HOLD_SECONDS
        && current.role !== 'fire' && current.role === context.role
        && current.attempt === context.attempt;
    },
    cancel() { gesture = null; },
  };
}

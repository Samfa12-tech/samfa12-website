export const PRESENTATION_BLEND_SECONDS = 2;
// Native audio ramps continue through render hitches. Presentation must account
// for the same elapsed time rather than discard time using a simulation cap.
export function advancePresentationElapsed(elapsed, deltaSeconds) {
  const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  const next = Math.min(PRESENTATION_BLEND_SECONDS, Math.max(0, elapsed) + delta);
  return PRESENTATION_BLEND_SECONDS - next < 1e-8 ? PRESENTATION_BLEND_SECONDS : next;
}
const mix = (a, b, t) => a + (b - a) * t;
export function blendPresentation(from, to, elapsed) {
  const t = Math.max(0, Math.min(1, elapsed / PRESENTATION_BLEND_SECONDS));
  if (t === 0) return {...from};
  if (t === 1) return {...to};
  return Object.fromEntries(Object.entries(to).map(([key, value]) => {
    if (typeof value === 'number') return [key, mix(from[key], value, t)];
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
      const rgb = [1, 3, 5].map(i => Math.round(mix(parseInt(from[key].slice(i, i + 2), 16), parseInt(value.slice(i, i + 2), 16), t)).toString(16).padStart(2, '0'));
      return [key, '#' + rgb.join('')];
    }
    return [key, value];
  }));
}

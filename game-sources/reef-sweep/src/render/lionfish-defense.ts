/** Renderer-local, per-fish cosmetic state. Never store renderer state in saves. */
export interface LionfishDefense { active: boolean; value: number }
export const makeLionfishDefense = (): LionfishDefense => ({ active: false, value: 0 });
/** Distances in world metres, measured diver chest/camera to fish centre.
 * Cosmetic values are tuning defaults, not a biological distance claim.
 * Advance with gameplay dt, not wall time, so pause freezes the display.
 */
export function updateLionfishDefense(s: LionfishDefense, distance: number, dt: number, visibleAlive = true): number {
    if (!Number.isFinite(distance) || !visibleAlive) s.active = false;
    else if (!s.active && distance < 3.2) s.active = true;
    else if (s.active && distance > 4.4) s.active = false;
    const target = s.active ? 1 : 0;
    const rate = s.active ? 4.0 : 2.0;
    const elapsed = Number.isFinite(dt) ? Math.max(0, Math.min(dt, .1)) : 0;
    s.value += (target - s.value) * (1 - Math.exp(-rate * elapsed));
    s.value = Math.min(1, Math.max(0, s.value));
    return s.value;
}

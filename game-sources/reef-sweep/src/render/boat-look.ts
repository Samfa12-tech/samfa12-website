import { clamp } from '../game/math.js';

/** Trip-local presentation state. Never written into a career or a dive. */
export class BoatLook {
    yaw = 0;
    pitch = .35;
    update(lookX: number, lookY: number) {
        if (Number.isFinite(lookX)) this.yaw = Math.atan2(Math.sin(this.yaw + lookX), Math.cos(this.yaw + lookX));
        if (Number.isFinite(lookY)) this.pitch = clamp(this.pitch + lookY, .08, 1.05);
    }
}

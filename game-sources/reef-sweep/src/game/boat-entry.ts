import type { Run, SiteId } from './types.js';

export interface BoatDiveSelection { site: SiteId; order: Run['order']; night: boolean; distance: number }
/** Presentation-only: an interrupted entry has not created or saved a dive. */
export class BoatEntrySequence {
    elapsed = 0;
    private taken = false;
    readonly selection: Readonly<BoatDiveSelection>;
    constructor(selection: BoatDiveSelection, readonly duration: number) { this.selection = Object.freeze({ ...selection }); }
    advance(dt: number, paused: boolean) { if (!paused && !this.taken) this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, Math.min(.083, dt))); }
    take(skip = false): Readonly<BoatDiveSelection> | null {
        if (this.taken || !skip && this.elapsed < this.duration) return null;
        this.taken = true;
        return this.selection;
    }
    cancel() { this.taken = true; }
}

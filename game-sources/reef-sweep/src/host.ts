export function wavedashHost(url: string, referrer = '') {
    const trusted = (value: string) => { try { const host = new URL(value).hostname; return host === 'wavedash.com' || host.endsWith('.wavedash.com'); } catch { return false; } };
    return trusted(url) || trusted(referrer);
}
export function fullscreenAvailable(doc: any, root: any, hosted: boolean) {
    return !hosted && (doc.fullscreenEnabled !== false && typeof root.requestFullscreen === 'function' || doc.webkitFullscreenEnabled === true && typeof root.webkitRequestFullscreen === 'function');
}
/** Only sustained visible active gameplay is sampled. Warmup/pauses/hitches cannot prompt. */
export class PerformanceSuggestion {
    warmup = 0; samples: number[] = []; slowWindows = 0;
    update(seconds: number, active: boolean, suppressed: boolean, quality: string) {
        if (!active) { this.samples = []; this.slowWindows = 0; return false; }
        if (suppressed || quality === 'low') return false;
        this.warmup += Math.min(seconds, .1); if (this.warmup < 30) return false;
        if (seconds <= 0 || seconds > .2) return false;
        this.samples.push(seconds); if (this.samples.reduce((a,b)=>a+b,0) < 12) return false;
        const ordered = this.samples.slice().sort((a,b)=>a-b), median = ordered[Math.floor(ordered.length/2)];
        this.samples = []; this.slowWindows = median > .04 ? this.slowWindows + 1 : 0;
        return this.slowWindows >= 3;
    }
}

import type { ReefProgress, Run } from './types.js';

/**
 * Recovery advances between productive visits. The first two stages are subtle;
 * denser native life only appears after a diver has returned to do more work.
 */
export const RECOVERY_THRESHOLDS = [
    { visits: 1, clearances: 2 },
    { visits: 2, clearances: 5 },
    { visits: 3, clearances: 9 },
    { visits: 4, clearances: 13 },
    { visits: 5, clearances: 17 }
] as const;

/** Fraction used by presentation to scale native-life density for a captured stage. */
const POPULATION_SHARE = [0, .04, .09, .2, .34, .5] as const;

function inferredProductiveVisits(progress: Pick<ReefProgress, 'removed' | 'visits'>) {
    // Legacy saves did not record which visits contained removals. Two clearances
    // per productive trip is a conservative estimate capped by completed visits.
    return Math.min(Math.floor(progress.visits), Math.floor(progress.removed.length / 2));
}

export function recoveryFromProgress(progress: Pick<ReefProgress, 'removed' | 'visits' | 'productiveVisits'>): number {
    const productiveVisits = progress.productiveVisits ?? inferredProductiveVisits(progress);
    const cleared = progress.removed.length;
    let stage = 0;
    for (const threshold of RECOVERY_THRESHOLDS) {
        if (productiveVisits >= threshold.visits && cleared >= threshold.clearances) stage++;
        else break;
    }
    return stage;
}

/**
 * Return the immutable ecology stage for a run. New runs carry their start
 * snapshot. For schema-1 runs created before snapshots existed, remove this
 * outing's tail entries from persistent clearance before estimating the stage.
 */
export function recoveryForRun(
    run: Pick<Run, 'removed' | 'recoveryStage'>,
    progress: Pick<ReefProgress, 'removed' | 'visits' | 'productiveVisits'>
): number {
    if (Number.isInteger(run.recoveryStage) && run.recoveryStage! >= 0 && run.recoveryStage! <= 5) return run.recoveryStage!;
    const outingRemovals = Math.max(0, Math.min(Math.floor(run.removed), progress.removed.length));
    const priorRemoved = progress.removed.slice(0, progress.removed.length - outingRemovals);
    const legacyVisits = progress.productiveVisits ?? Math.min(Math.floor(progress.visits), Math.floor(priorRemoved.length / 2));
    return recoveryFromProgress({ ...progress, removed: priorRemoved, productiveVisits: legacyVisits });
}

export function recoveryPopulationShare(stage: number): number {
    const index = Math.max(0, Math.min(5, Math.floor(Number.isFinite(stage) ? stage : 0)));
    return POPULATION_SHARE[index];
}

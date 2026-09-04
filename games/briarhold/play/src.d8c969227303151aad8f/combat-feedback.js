export const HIT_FEEDBACK = Object.freeze({
  NONE: 'none',
  HIT: 'hit',
  ARMOUR: 'armour',
  KILL: 'kill',
});

const PRIORITY = Object.freeze({
  [HIT_FEEDBACK.NONE]: 0,
  [HIT_FEEDBACK.HIT]: 1,
  [HIT_FEEDBACK.ARMOUR]: 2,
  [HIT_FEEDBACK.KILL]: 3,
});

export function createShotFeedbackSummary(weaponId = null) {
  return {
    weaponId: typeof weaponId === 'string' ? weaponId : null,
    hits: 0,
    kills: 0,
    armourResists: 0,
    strongest: HIT_FEEDBACK.NONE,
  };
}

export function recordShotFeedback(summary, result, feedback = HIT_FEEDBACK.HIT) {
  if (!summary || !result?.hit) return summary;
  summary.hits += 1;
  if (result.killed) summary.kills += 1;
  if (feedback === HIT_FEEDBACK.ARMOUR) summary.armourResists += 1;
  const candidate = result.killed ? HIT_FEEDBACK.KILL : feedback;
  if ((PRIORITY[candidate] || 0) > (PRIORITY[summary.strongest] || 0)) summary.strongest = candidate;
  return summary;
}

export function shotFeedbackPresentation(summary) {
  if (!summary || summary.hits <= 0 || summary.strongest === HIT_FEEDBACK.NONE) return null;
  return Object.freeze({
    weaponId: summary.weaponId,
    kind: summary.strongest,
    hits: summary.hits,
    kills: summary.kills,
    armourResists: summary.armourResists,
  });
}

function wrapRadians(angle) {
  const tau = Math.PI * 2;
  return ((angle + Math.PI) % tau + tau) % tau - Math.PI;
}

/**
 * Collapse one authoritative damage batch into a single camera-relative cue.
 * Sources are weighted by authored damage, not sprite count, so subdivision
 * profiles cannot change the direction shown to the player.
 */
export function playerDamagePresentation(sources = [], player = {}) {
  const playerX = Number(player?.position?.x);
  const playerZ = Number(player?.position?.z);
  const yaw = Number(player?.facing?.yaw);
  if (!Number.isFinite(playerX) || !Number.isFinite(playerZ) || !Number.isFinite(yaw)) return null;

  let right = 0;
  let forward = 0;
  let strongest = null;
  let sourceCount = 0;
  for (const source of sources) {
    const x = Number(source?.x);
    const z = Number(source?.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const dx = x - playerX;
    const dz = z - playerZ;
    if (Math.hypot(dx, dz) < 0.001) continue;
    const relative = wrapRadians(Math.atan2(dx, dz) - yaw);
    const weight = Math.max(0.01, Number(source?.damage) || 1);
    right += Math.sin(relative) * weight;
    forward += Math.cos(relative) * weight;
    sourceCount += 1;
    if (!strongest || weight > strongest.weight) strongest = {relative, weight};
  }
  if (!sourceCount) return null;

  const relative = Math.hypot(right, forward) > 0.001
    ? Math.atan2(right, forward)
    : strongest.relative;
  return Object.freeze({
    angleDegrees: relative * 180 / Math.PI,
    pan: Math.max(-0.7, Math.min(0.7, Math.sin(relative) * 0.7)),
    sourceCount,
  });
}

/**
 * Resolve one hitscan projectile against the logical enemy volumes and the
 * first static-world blocker. The caller performs one Babylon world query;
 * this pure comparison prevents a separate scene pick for every candidate.
 */
export function resolveProjectileRayHit(
  candidates = [],
  worldHit = null,
  {maxDistance = 160, blockerPadding = 0.08} = {},
) {
  const range = Math.max(0, Number(maxDistance) || 0);
  const padding = Math.max(0, Number(blockerPadding) || 0);
  const blockerDistance = Number(worldHit?.distance);
  const worldIsInRange = Number.isFinite(blockerDistance)
    && blockerDistance >= 0
    && blockerDistance <= range;
  const enemyLimit = worldIsInRange ? Math.max(0, blockerDistance - padding) : range;
  let enemyHit = null;
  for (const candidate of candidates) {
    const distance = Number(candidate?.distance);
    if (!Number.isFinite(distance) || distance < 0 || distance > enemyLimit) continue;
    if (!enemyHit || distance < enemyHit.distance || (distance === enemyHit.distance && candidate.id < enemyHit.id)) {
      enemyHit = candidate;
    }
  }
  if (enemyHit) return Object.freeze({kind: 'enemy', enemyHit, worldHit: null});
  if (worldIsInRange) return Object.freeze({kind: 'world', enemyHit: null, worldHit});
  return Object.freeze({kind: 'miss', enemyHit: null, worldHit: null});
}

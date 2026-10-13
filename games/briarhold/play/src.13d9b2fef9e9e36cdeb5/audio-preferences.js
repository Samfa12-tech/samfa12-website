export const SFX_VOLUME_MIN = 0;
export const SFX_VOLUME_MAX = 100;
export const SFX_VOLUME_DEFAULT = 100;

/** Device preference in percent; 100 retains the existing effects mix. */
export function normaliseSfxVolume(value) {
  if (value === null || value === undefined || typeof value === 'boolean'
    || (typeof value === 'string' && value.trim() === '')) return SFX_VOLUME_DEFAULT;
  const number = Number(value);
  if (!Number.isFinite(number)) return SFX_VOLUME_DEFAULT;
  return Math.max(SFX_VOLUME_MIN, Math.min(SFX_VOLUME_MAX, Math.round(number)));
}

export function sfxVolumeGain(value) {
  return normaliseSfxVolume(value) / SFX_VOLUME_MAX;
}

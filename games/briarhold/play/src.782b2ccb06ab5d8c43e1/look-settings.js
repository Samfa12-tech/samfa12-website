export const LOOK_SENSITIVITY_MIN = 50;
export const LOOK_SENSITIVITY_MAX = 200;
export const LOOK_SENSITIVITY_DEFAULT = 100;

export function normaliseLookSensitivity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return LOOK_SENSITIVITY_DEFAULT;
  return Math.max(LOOK_SENSITIVITY_MIN, Math.min(LOOK_SENSITIVITY_MAX, Math.round(number)));
}

export function lookSensitivityMultiplier(value) {
  return normaliseLookSensitivity(value) / LOOK_SENSITIVITY_DEFAULT;
}

export function applyLookPreferences({yaw = 0, pitch = 0} = {}, {
  sensitivity = LOOK_SENSITIVITY_DEFAULT,
  invertVertical = false,
} = {}) {
  const multiplier = lookSensitivityMultiplier(sensitivity);
  return {
    yaw: (Number(yaw) || 0) * multiplier,
    pitch: (Number(pitch) || 0) * multiplier * (invertVertical ? -1 : 1),
  };
}

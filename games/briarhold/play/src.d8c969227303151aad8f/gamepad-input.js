import {
  buttonIndicesPressed,
  defaultControllerMapping,
  mappedAxisValue,
  normaliseControllerMapping,
} from "./controller-mapping.js";

const DEFAULT_DEADZONE = 0.14;
const LOOK_DEADZONE = 0.2;
const CALIBRATION_SECONDS = 0.2;
const CALIBRATION_SAMPLES = 8;

const EMPTY_ACTIONS = Object.freeze({
  fire: false,
  aim: false,
  interact: false,
  context: false,
  build: false,
  pause: false,
  confirm: false,
  back: false,
  weaponPrevious: false,
  weaponNext: false,
  weaponSelect0: false,
  weaponSelect1: false,
  weaponSelect2: false,
  navigatePrevious: false,
  navigateNext: false,
  adjustPrevious: false,
  adjustNext: false,
  jump: false,
  slide: false,
  sprint: false,
  melee: false,
});

function axisBindingPressed(axes, bindings, centers) {
  return (bindings || []).some((binding) => {
    const current = axisValue(axes, binding.index);
    const center = axisValue(centers, binding.index);
    const target = Number(binding.value);
    if (!Number.isFinite(target)) return false;
    const travel = Math.abs(target - center);
    const tolerance = Math.max(0.07, travel * 0.24);
    return travel >= 0.1 && Math.abs(current - target) <= tolerance;
  });
}

function actionsForMapping(buttons, axes, mapping, centers) {
  const pressed = (action) => buttonIndicesPressed(buttons, mapping.buttons[action])
    || axisBindingPressed(axes, mapping.axisButtons?.[action], centers);
  const context = pressed("interact");
  return {
    fire: pressed("fire"),
    aim: pressed("aim"),
    interact: context,
    context,
    build: context,
    pause: pressed("pause"),
    confirm: pressed("confirm"),
    back: pressed("back"),
    jump: pressed("jump"),
    slide: pressed("slide"),
    sprint: pressed("sprint"),
    melee: pressed("melee"),
    weaponPrevious: pressed("weaponPrevious"),
    weaponNext: pressed("weaponNext"),
    weaponSelect0: pressed("weaponSelect0"),
    weaponSelect1: pressed("weaponSelect1"),
    weaponSelect2: pressed("weaponSelect2"),
    navigatePrevious: pressed("navigatePrevious"),
    navigateNext: pressed("navigateNext"),
  };
}

function rising(current, previous, key) {
  return Boolean(current[key]) && !Boolean(previous?.[key]);
}

function selectedWeaponFromActions(actions, previous) {
  if (rising(actions, previous, "weaponSelect0")) return 0;
  if (rising(actions, previous, "weaponSelect1")) return 1;
  if (rising(actions, previous, "weaponSelect2")) return 2;
  return null;
}

function axisValue(axes, index) {
  const value = Number(axes?.[index]);
  return Number.isFinite(value) ? value : 0;
}

function applyDeadzone(value, deadzone = DEFAULT_DEADZONE) {
  return Math.abs(value) < deadzone ? 0 : value;
}

function clampAxis(value) {
  return Math.max(-1, Math.min(1, value));
}

function recenterAxis(value, center = 0) {
  const shifted = value - center;
  const span = shifted >= 0 ? 1 - center : 1 + center;
  return clampAxis(span > 0.001 ? shifted / span : 0);
}

function applyRadialDeadzone(x, y, deadzone = LOOK_DEADZONE) {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= deadzone) return {x: 0, y: 0};
  const scaledMagnitude = Math.min(1, (magnitude - deadzone) / (1 - deadzone));
  const scale = scaledMagnitude / magnitude;
  return {x: x * scale, y: y * scale};
}

function median(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function chooseLookAxes(pad, centers) {
  const standardLooksCentred = pad.mapping === "standard"
    && Math.abs(centers[2] || 0) < 0.5
    && Math.abs(centers[3] || 0) < 0.5;
  if (standardLooksCentred) return [2, 3];

  // Some USB/mobile controllers expose trigger axes at -1 between the two
  // right-stick axes. Prefer the first two centred axes after the left stick.
  const centred = centers
    .map((value, index) => ({value, index}))
    .filter(({value, index}) => index >= 2 && Math.abs(value) < 0.5)
    .map(({index}) => index);
  return centred.length >= 2 ? centred.slice(0, 2) : [2, 3];
}

/** Mutable per-connection calibration state. Keep one beside the active pad. */
export function createGamepadCalibration() {
  return {
    key: null,
    elapsed: 0,
    samples: [],
    centers: [],
    lookAxes: [2, 3],
    ready: false,
  };
}

function mappingSignature(mapping) {
  if (!mapping) return "auto";
  return ["moveX", "moveY", "lookX", "lookY"]
    .map((action) => `${mapping.axes?.[action]?.index}:${mapping.axes?.[action]?.sign}`)
    .join("|");
}

/** Explicitly discards neutral-centre samples without discarding a saved map. */
export function resetGamepadCalibration(calibration, pad = null, mapping = null) {
  calibration.key = pad ? `${pad.index}:${pad.id || "gamepad"}:${mappingSignature(mapping)}` : null;
  calibration.elapsed = 0;
  calibration.samples = [];
  calibration.centers = [];
  calibration.lookAxes = [2, 3];
  calibration.ready = false;
}

function updateCalibration(calibration, pad, seconds, mapping = null) {
  const key = `${pad.index}:${pad.id || "gamepad"}:${mappingSignature(mapping)}`;
  if (calibration.key !== key) resetGamepadCalibration(calibration, pad, mapping);
  if (calibration.ready) return true;

  calibration.samples.push(Array.from(pad.axes || [], (value) => axisValue([value], 0)));
  calibration.elapsed += seconds;
  if (calibration.elapsed < CALIBRATION_SECONDS || calibration.samples.length < CALIBRATION_SAMPLES) return false;

  const axisCount = Math.max(4, ...calibration.samples.map((sample) => sample.length));
  calibration.centers = Array.from({length: axisCount}, (_, index) => (
    median(calibration.samples.map((sample) => axisValue(sample, index)))
  ));
  calibration.lookAxes = mapping
    ? [mapping.axes.lookX.index, mapping.axes.lookY.index]
    : chooseLookAxes(pad, calibration.centers);
  calibration.ready = true;
  calibration.samples = [];
  return true;
}

/** Finds a connected controller without assuming the browser assigned slot zero. */
export function selectConnectedGamepad(gamepads, preferredIndex = null) {
  const connected = Array.from(gamepads || []).filter((pad) => Boolean(pad) && pad.connected !== false);
  return connected.find((pad) => pad.index === preferredIndex) || connected[0] || null;
}

/**
 * Normalises a standard controller/Backbone into Briarhold input. Discrete
 * actions are rising-edge signals so holding a button cannot retrigger them;
 * movement, look, sprint, aim and fire remain continuous.
 */
export function readGamepadInput(pad, previous = {}, deltaSeconds = 1 / 60, calibration = null, controllerMapping = null) {
  if (!pad) return {active: false, input: null, buttons: {...EMPTY_ACTIONS}};
  const axes = pad.axes || [];
  const buttons = pad.buttons || [];
  const mapping = controllerMapping ? normaliseControllerMapping(controllerMapping, pad) : null;
  const seconds = Math.max(0, Math.min(0.1, Number(deltaSeconds) || 0));
  // A guided map already contains deliberate neutral samples. Use those
  // immediately so a player moving as gameplay resumes cannot accidentally
  // teach the live calibrator that an active stick position is its centre.
  if (calibration && !mapping && !updateCalibration(calibration, pad, seconds)) {
    return {active: false, calibrating: true, input: null, buttons: {...EMPTY_ACTIONS}};
  }
  const centers = mapping?.axisCenters || calibration?.centers || [];
  const [lookXAxis, lookYAxis] = mapping
    ? [mapping.axes.lookX.index, mapping.axes.lookY.index]
    : calibration?.lookAxes || [2, 3];
  const moveX = mapping
    ? applyDeadzone(mappedAxisValue(axes, mapping.axes.moveX, centers[mapping.axes.moveX.index]))
    : applyDeadzone(recenterAxis(axisValue(axes, 0), centers[0]));
  const moveY = mapping
    ? applyDeadzone(mappedAxisValue(axes, mapping.axes.moveY, centers[mapping.axes.moveY.index]))
    : -applyDeadzone(recenterAxis(axisValue(axes, 1), centers[1]));
  const look = applyRadialDeadzone(
    mapping
      ? mappedAxisValue(axes, mapping.axes.lookX, centers[lookXAxis])
      : recenterAxis(axisValue(axes, lookXAxis), centers[lookXAxis]),
    mapping
      ? mappedAxisValue(axes, mapping.axes.lookY, centers[lookYAxis])
      : recenterAxis(axisValue(axes, lookYAxis), centers[lookYAxis]),
  );
  const lookX = look.x;
  const lookY = look.y;
  const buttonMapping = mapping || defaultControllerMapping(pad);
  const actions = actionsForMapping(buttons, axes, buttonMapping, centers);
  const fire = actions.fire;
  const aim = actions.aim;
  const sprint = actions.sprint;
  // UI navigation is deliberately independent from gameplay weapon changes.
  // The left stick and D-pad navigate menus, while mapped shoulders remain a
  // convenient fallback. A rising edge requires a return to neutral before
  // another item is selected.
  const navigationActions = {
    ...actions,
    navigatePrevious: moveY > 0.55 || actions.navigatePrevious || actions.weaponPrevious,
    navigateNext: moveY < -0.55 || actions.navigateNext || actions.weaponNext,
    adjustPrevious: moveX < -0.55,
    adjustNext: moveX > 0.55,
  };
  const anyButton = Array.from(buttons).some((button) => button?.pressed || Number(button?.value) >= 0.5)
    || Object.values(buttonMapping.axisButtons || {}).some(bindings => axisBindingPressed(axes, bindings, centers));
  const active = Boolean(moveX || moveY || lookX || lookY || anyButton);

  const interact = rising(actions, previous, "interact");
  const pause = rising(actions, previous, "pause");
  const confirm = rising(actions, previous, "confirm");
  const back = rising(actions, previous, "back");
  const jump = rising(actions, previous, "jump");
  const slide = rising(actions, previous, "slide");
  const melee = rising(actions, previous, "melee");
  const weaponPrevious = rising(actions, previous, "weaponPrevious");
  const weaponNext = rising(actions, previous, "weaponNext");
  const navigatePrevious = rising(navigationActions, previous, "navigatePrevious");
  const navigateNext = rising(navigationActions, previous, "navigateNext");
  const adjustPrevious = rising(navigationActions, previous, "adjustPrevious");
  const adjustNext = rising(navigationActions, previous, "adjustNext");
  const selectedWeapon = selectedWeaponFromActions(actions, previous);

  return {
    active,
    buttons: navigationActions,
    input: active ? {
      move: {x: moveX, y: moveY},
      look: {yaw: lookX * 2.7 * seconds, pitch: lookY * 2.15 * seconds},
      fire,
      aim,
      interact,
      context: interact,
      build: interact,
      sprint,
      pause,
      confirm,
      back,
      jump,
      slide,
      melee,
      weaponPrevious,
      weaponNext,
      navigatePrevious,
      navigateNext,
      adjustPrevious,
      adjustNext,
      selectedWeapon,
    } : null,
  };
}

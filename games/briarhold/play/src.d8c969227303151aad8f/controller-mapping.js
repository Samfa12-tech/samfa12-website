export const CONTROLLER_MAPPING_VERSION = 4;
export const CONTROLLER_MAPPING_STORAGE_KEY = "briarhold.controller-mappings.v4";
export const CONTROLLER_MAPPING_CANCEL_HOLD_SECONDS = 1;
export const AUXILIARY_AXIS_CAPTURE_THRESHOLD = 0.12;

const AXIS_ACTIONS = Object.freeze(["moveX", "moveY", "lookX", "lookY"]);
const BUTTON_ACTIONS = Object.freeze([
  "fire",
  "aim",
  "interact",
  "pause",
  "weaponPrevious",
  "weaponNext",
  "navigatePrevious",
  "navigateNext",
  "confirm",
  "back",
  "sprint",
  "melee",
  "jump",
  "slide",
]);

const AXIS_STEPS = Object.freeze([
  {action: "moveX", prompt: "Push the LEFT stick fully RIGHT"},
  {action: "moveY", prompt: "Push the LEFT stick fully UP"},
  {action: "lookX", prompt: "Push the RIGHT stick fully RIGHT"},
  {action: "lookY", prompt: "Push the RIGHT stick fully DOWN"},
]);

const BUTTON_PROMPTS = Object.freeze({
  fire: "Press FIRE / right trigger",
  aim: "Press AIM / left trigger",
  interact: "Press INTERACT / build",
  pause: "Press PAUSE / menu",
  weaponPrevious: "Press PREVIOUS WEAPON",
  weaponNext: "Press NEXT WEAPON",
  navigatePrevious: "Press MENU UP / D-pad up",
  navigateNext: "Press MENU DOWN / D-pad down",
  confirm: "Press CONFIRM",
  back: "Press BACK / cancel",
  sprint: "Press SPRINT",
  melee: "Press KNIFE / right-stick click",
  jump: "Press JUMP / mantle",
  slide: "Press SLIDE / crouch",
});

const STANDARD_BUTTON_LABELS = Object.freeze([
  "A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Menu",
  "LS", "RS", "D-pad up", "D-pad down", "D-pad left", "D-pad right", "Home",
]);

/** Human-readable action prompt derived from the mapping currently in use. */
export function controllerActionLabel(mapping, action) {
  const index = normaliseButtonIndices(mapping?.buttons?.[action])[0];
  if (!Number.isInteger(index)) return action === "interact" ? "X" : "Button";
  const standard = String(mapping?.browserMapping || "").toLowerCase() === "standard";
  if (standard && STANDARD_BUTTON_LABELS[index]) return STANDARD_BUTTON_LABELS[index];
  if (/\bbackbone\b/iu.test(String(mapping?.controllerId || "")) && index === 0) return "A";
  return `Button ${index + 1}`;
}

/** Privacy-minimised controller topology for local playtest evidence. */
export function controllerReportMappingKey(mapping) {
  if (!mapping) return "unmapped";
  const id = String(mapping.controllerId || "");
  const family = /\bbackbone\b/iu.test(id)
    ? "backbone"
    : String(mapping.browserMapping || "").toLowerCase() === "standard"
      ? "standard"
      : "generic";
  const browserMapping = String(mapping.browserMapping || "raw").toLowerCase() || "raw";
  const axisCount = Math.max(0, Math.trunc(Number(mapping.axisCount) || 0));
  const buttonCount = Math.max(0, Math.trunc(Number(mapping.buttonCount) || 0));
  return `${family}::${browserMapping}::a${axisCount}::b${buttonCount}`;
}

function finiteAxis(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(-1, Math.min(1, number)) : 0;
}

function median(values) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function normaliseButtonIndices(value) {
  const source = Array.isArray(value) ? value : Number.isInteger(value) ? [value] : [];
  return [...new Set(source.filter((index) => Number.isInteger(index) && index >= 0 && index < 128))];
}

function normaliseAxisButtonBindings(value) {
  const source = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
  return source.flatMap((binding) => {
    if (!Number.isInteger(binding?.index) || binding.index < 0 || binding.index >= 128) return [];
    const target = finiteAxis(binding.value);
    return [{index: binding.index, value: target}];
  });
}

function hasOwn(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function buttonActionsMayShare(first, second) {
  return (first === "interact" && second === "confirm")
    || (first === "confirm" && second === "interact")
    || (first === "jump" && second === "confirm")
    || (first === "confirm" && second === "jump")
    || (first === "slide" && second === "back")
    || (first === "back" && second === "slide");
}

function normaliseAxisBinding(value, fallback) {
  const index = Number.isInteger(value?.index) && value.index >= 0 ? value.index : fallback.index;
  return {index, sign: Number(value?.sign) < 0 ? -1 : 1};
}

/** Stable across browser gamepad slots; suitable for an object/localStorage key. */
export function controllerMappingKey(pad) {
  const id = String(pad?.id || "Unknown gamepad").trim().replace(/\s+/g, " ");
  const mapping = String(pad?.mapping || "raw").trim().toLowerCase() || "raw";
  const axisCount = Math.max(0, Number(pad?.axisCount ?? pad?.axes?.length) || 0);
  const buttonCount = Math.max(0, Number(pad?.buttonCount ?? pad?.buttons?.length) || 0);
  return `${id || "Unknown gamepad"}::${mapping}::a${axisCount}::b${buttonCount}`;
}

/**
 * Safe fallback used before a controller has been guided through mapping.
 * Standard pads follow the W3C layout. The raw fallback preserves the known
 * Backbone Windows HID layout without claiming it is universal.
 */
export function defaultControllerMapping(pad = {}) {
  const standard = pad.mapping === "standard";
  return {
    version: CONTROLLER_MAPPING_VERSION,
    key: controllerMappingKey(pad),
    controllerId: String(pad.id || "Unknown gamepad"),
    browserMapping: String(pad.mapping || ""),
    axisCount: Math.max(0, Number(pad.axes?.length) || 0),
    buttonCount: Math.max(0, Number(pad.buttons?.length) || 0),
    axes: {
      moveX: {index: 0, sign: 1},
      moveY: {index: 1, sign: -1},
      lookX: {index: 2, sign: 1},
      lookY: {index: 3, sign: 1},
    },
    axisCenters: Array.from(pad.axes || [], finiteAxis),
    axisButtons: {},
    buttons: {
      fire: [standard ? 7 : 9],
      // Standard Gamepad exposes LT as button 6. The captured raw Backbone
      // profile does not identify its left trigger, so raw pads learn AIM in
      // the guided mapper instead of inheriting a guessed binding.
      aim: standard ? [6] : [],
      interact: [2],
      pause: [standard ? 9 : 7],
      weaponPrevious: [4],
      weaponNext: [5, 3],
      weaponSelect0: [12],
      weaponSelect1: [14],
      weaponSelect2: [13],
      navigatePrevious: [12],
      navigateNext: [13],
      confirm: [0],
      back: standard ? [1, 8] : [1],
      sprint: [10],
      melee: [11],
      jump: [0],
      slide: [1],
    },
  };
}

/** Rejects malformed storage data and returns a complete JSON-safe profile. */
export function normaliseControllerMapping(value, pad = {}) {
  const fallback = defaultControllerMapping(pad);
  if (!value || typeof value !== "object") return fallback;
  const axes = {};
  for (const action of AXIS_ACTIONS) {
    axes[action] = normaliseAxisBinding(value.axes?.[action], fallback.axes[action]);
  }
  const buttons = {};
  const actionNames = new Set([...Object.keys(fallback.buttons), ...Object.keys(value.buttons || {})]);
  for (const action of actionNames) {
    // An explicitly empty binding is meaningful: guided profiles use it to
    // disable inherited D-pad weapon shortcuts that collide with a physical
    // button the player deliberately assigned to another action.
    buttons[action] = hasOwn(value.buttons, action)
      ? normaliseButtonIndices(value.buttons[action])
      : fallback.buttons[action] || [];
  }
  if (!hasOwn(value.buttons, "melee")) {
    const usedByStoredAction = BUTTON_ACTIONS.some(action => action !== "melee"
      && (buttons[action] || []).includes(11));
    buttons.melee = usedByStoredAction ? [] : [11];
  }
  const primaryIndices = new Set(
    BUTTON_ACTIONS.flatMap((action) => buttons[action] || []),
  );
  for (const action of ["weaponSelect0", "weaponSelect1", "weaponSelect2"]) {
    buttons[action] = (buttons[action] || []).filter((index) => !primaryIndices.has(index));
  }
  const axisButtons = {};
  const axisButtonActions = new Set([...BUTTON_ACTIONS, ...Object.keys(value.axisButtons || {})]);
  for (const action of axisButtonActions) {
    axisButtons[action] = normaliseAxisButtonBindings(value.axisButtons?.[action]);
  }
  return {
    version: CONTROLLER_MAPPING_VERSION,
    key: controllerMappingKey(pad.id ? pad : {id: value.controllerId || value.key}),
    controllerId: String(value.controllerId || pad.id || fallback.controllerId),
    browserMapping: String(value.browserMapping ?? pad.mapping ?? ""),
    axisCount: Math.max(0, Number(value.axisCount) || fallback.axisCount),
    buttonCount: Math.max(0, Number(value.buttonCount) || fallback.buttonCount),
    axes,
    axisCenters: Array.from(value.axisCenters || fallback.axisCenters, finiteAxis),
    axisButtons,
    buttons,
  };
}

/**
 * Promoted from an owner-guided Backbone One USB mapping. Keep the match
 * topology-specific: phone browsers and standard-mapped Backbone devices may
 * expose different axes even when the physical controls look identical.
 */
export function builtInControllerMapping(pad = {}) {
  const id = String(pad.id || "");
  const browserMapping = String(pad.mapping || "");
  const axisCount = Math.max(0, Number(pad.axisCount ?? pad.axes?.length) || 0);
  const buttonCount = Math.max(0, Number(pad.buttonCount ?? pad.buttons?.length) || 0);
  if (!/\bbackbone\b/iu.test(id) || browserMapping || axisCount !== 10 || buttonCount !== 17) return null;
  return normaliseControllerMapping({
    version: CONTROLLER_MAPPING_VERSION,
    controllerId: id,
    browserMapping,
    axisCount,
    buttonCount,
    axes: {
      moveX: {index: 0, sign: 1},
      moveY: {index: 1, sign: -1},
      lookX: {index: 2, sign: 1},
      lookY: {index: 5, sign: 1},
    },
    axisCenters: [0, 0, -0.0038148164749145508, -1, -1, 0, 0, 0, 0, 1],
    axisButtons: {
      navigatePrevious: [{index: 9, value: -1}],
      navigateNext: [{index: 9, value: 0.14285719394683838}],
    },
    buttons: {
      fire: [9],
      aim: [],
      interact: [0],
      pause: [11],
      weaponPrevious: [6],
      weaponNext: [7],
      weaponSelect0: [],
      weaponSelect1: [],
      weaponSelect2: [],
      navigatePrevious: [12],
      navigateNext: [13],
      confirm: [0],
      back: [1],
      sprint: [13],
      melee: [14],
      jump: [4],
      slide: [3],
    },
  }, pad);
}

export function buttonIndicesPressed(buttons, indices) {
  return normaliseButtonIndices(indices).some((index) => {
    const button = buttons?.[index];
    return Boolean(button?.pressed) || Number(button?.value) >= 0.5;
  });
}

export function mappedAxisValue(axes, binding, center = 0) {
  const value = finiteAxis(axes?.[binding?.index]);
  const neutral = finiteAxis(center);
  const shifted = value - neutral;
  const span = shifted >= 0 ? 1 - neutral : 1 + neutral;
  const recentered = span > 0.001 ? shifted / span : 0;
  return finiteAxis(recentered * (binding?.sign < 0 ? -1 : 1));
}

/**
 * Finds the two axes that actually moved between neutral and stick samples.
 * Trigger axes resting at -1 are harmless because an unchanged axis scores 0.
 */
export function detectAxisPair(neutralSamples, movementSamples, excludedAxes = []) {
  const samples = Array.isArray(neutralSamples) ? neutralSamples : [];
  const motion = Array.isArray(movementSamples) ? movementSamples : [];
  const axisCount = Math.max(0, ...samples.map((row) => row?.length || 0), ...motion.map((row) => row?.length || 0));
  const excluded = new Set(excludedAxes);
  const centers = Array.from({length: axisCount}, (_, index) => median(samples.map((row) => finiteAxis(row?.[index]))));
  const ranked = Array.from({length: axisCount}, (_, index) => {
    const deltas = motion.map((row) => Math.abs(finiteAxis(row?.[index]) - centers[index]));
    return {index, score: deltas.length ? Math.max(...deltas) : 0};
  }).filter(({index}) => !excluded.has(index)).sort((a, b) => b.score - a.score || a.index - b.index);
  if (ranked.length < 2 || ranked[1].score < 0.3) return null;
  return [ranked[0].index, ranked[1].index];
}

function snapshotAxes(pad) {
  return Array.from(pad?.axes || [], finiteAxis);
}

function pressedButtonIndices(pad) {
  return Array.from(pad?.buttons || [], (button, index) => (
    Boolean(button?.pressed) || Number(button?.value) >= 0.5 ? index : -1
  )).filter((index) => index >= 0);
}

function auxiliaryAxisCandidate(session, axes) {
  const used = new Set(Object.values(session.axes).map((binding) => binding.index));
  const ranked = axes.map((value, index) => ({
    index,
    value,
    delta: value - finiteAxis(session.axisCenters[index]),
  })).filter(({index}) => !used.has(index))
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.index - right.index);
  return ranked.length && Math.abs(ranked[0].delta) >= AUXILIARY_AXIS_CAPTURE_THRESHOLD
    ? ranked[0]
    : null;
}

function auxiliaryAxesReleased(session, axes) {
  const used = new Set(Object.values(session.axes).map((binding) => binding.index));
  return axes.every((value, index) => used.has(index)
    || Math.abs(value - finiteAxis(session.axisCenters[index])) < AUXILIARY_AXIS_CAPTURE_THRESHOLD * 0.55);
}

function wizardStep(session) {
  if (session.phase === "neutral") return {kind: "neutral", prompt: "Release both sticks and all buttons"};
  if (session.phase === "axis") return {kind: "axis", ...AXIS_STEPS[session.axisStep]};
  if (session.phase === "button") {
    const action = BUTTON_ACTIONS[session.buttonStep];
    const conflict = session.buttonConflict;
    const prompt = conflict?.action === action
      ? `That button is already used for ${BUTTON_PROMPTS[conflict.assignedAction].replace(/^Press /, "")} · ${BUTTON_PROMPTS[action]}`
      : BUTTON_PROMPTS[action];
    return {kind: "button", action, prompt, conflict: Boolean(conflict)};
  }
  return {kind: "complete", prompt: "Controller mapping complete"};
}

/** Mutable, DOM-free wizard state. Feed it one current Gamepad snapshot per frame. */
export function createControllerMappingSession(pad) {
  return {
    version: CONTROLLER_MAPPING_VERSION,
    key: controllerMappingKey(pad),
    controllerId: String(pad?.id || "Unknown gamepad"),
    browserMapping: String(pad?.mapping || ""),
    axisCount: Math.max(0, Number(pad?.axes?.length) || 0),
    buttonCount: Math.max(0, Number(pad?.buttons?.length) || 0),
    phase: "neutral",
    axisStep: 0,
    buttonStep: 0,
    waitingForRelease: false,
    neutralSamples: [],
    axisCenters: [],
    axes: {},
    axisButtons: {},
    buttons: {},
    buttonConflict: null,
    cancelHoldSeconds: 0,
    cancelRequested: false,
    profile: null,
  };
}

export function controllerMappingStep(session) {
  return wizardStep(session);
}

function allAxesReleased(session, pad) {
  return Array.from(pad?.axes || []).every((value, index) => (
    Math.abs(finiteAxis(value) - finiteAxis(session.axisCenters[index])) < 0.28
  ));
}

function completeWizard(session, pad) {
  const mappedButtons = {};
  for (const [action, index] of Object.entries(session.buttons)) mappedButtons[action] = [index];
  // Direct weapon slots are not wizard actions, so a guided profile must not
  // inherit them. On several raw USB layouts a stick click can share one of
  // those browser button indices; inheritance made Sprint also change weapon.
  session.profile = normaliseControllerMapping({
    ...defaultControllerMapping(pad),
    key: session.key,
    controllerId: session.controllerId,
    browserMapping: session.browserMapping,
    axisCount: session.axisCount,
    buttonCount: session.buttonCount,
    axes: session.axes,
    axisCenters: session.axisCenters,
    axisButtons: session.axisButtons,
    buttons: {
      ...mappedButtons,
      weaponSelect0: [],
      weaponSelect1: [],
      weaponSelect2: [],
    },
  }, pad);
  session.phase = "complete";
}

export function updateControllerMappingSession(session, pad, deltaSeconds = 1 / 60) {
  if (!session || session.phase === "complete") return session;
  if (controllerMappingKey(pad) !== session.key) return session;
  const axes = snapshotAxes(pad);
  const pressed = pressedButtonIndices(pad);
  const cancelHeld = buttonIndicesPressed(pad?.buttons, defaultControllerMapping(pad).buttons.back);
  session.cancelHoldSeconds = cancelHeld
    ? session.cancelHoldSeconds + Math.max(0, Math.min(0.1, Number(deltaSeconds) || 0))
    : 0;
  if (session.cancelHoldSeconds >= CONTROLLER_MAPPING_CANCEL_HOLD_SECONDS) {
    session.cancelRequested = true;
    return session;
  }

  if (session.phase === "neutral") {
    if (pressed.length) {
      session.neutralSamples = [];
      return session;
    }
    session.neutralSamples.push(axes);
    if (session.neutralSamples.length >= 12) {
      const count = Math.max(session.axisCount, ...session.neutralSamples.map((sample) => sample.length));
      session.axisCenters = Array.from({length: count}, (_, index) => (
        median(session.neutralSamples.map((sample) => finiteAxis(sample[index])))
      ));
      session.phase = "axis";
    }
    return session;
  }

  if (session.phase === "axis") {
    if (session.waitingForRelease) {
      if (allAxesReleased(session, pad)) session.waitingForRelease = false;
      return session;
    }
    const used = new Set(Object.values(session.axes).map((binding) => binding.index));
    const ranked = axes.map((value, index) => ({
      index,
      delta: value - finiteAxis(session.axisCenters[index]),
    })).filter(({index}) => !used.has(index)).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    if (!ranked.length || Math.abs(ranked[0].delta) < 0.52) return session;
    const step = AXIS_STEPS[session.axisStep];
    session.axes[step.action] = {index: ranked[0].index, sign: ranked[0].delta < 0 ? -1 : 1};
    session.axisStep += 1;
    session.waitingForRelease = true;
    if (session.axisStep >= AXIS_STEPS.length) {
      session.phase = "button";
      session.waitingForRelease = pressed.length > 0;
    }
    return session;
  }

  if (session.phase === "button") {
    if (session.waitingForRelease) {
      if (!pressed.length && auxiliaryAxesReleased(session, axes)) session.waitingForRelease = false;
      return session;
    }
    const action = BUTTON_ACTIONS[session.buttonStep];
    if (pressed.length) {
      const index = pressed[0];
      const conflict = Object.entries(session.buttons).find(([assignedAction, assignedIndex]) => (
        assignedIndex === index && !buttonActionsMayShare(action, assignedAction)
      ));
      if (conflict) {
        session.buttonConflict = {action, assignedAction: conflict[0], index};
        session.waitingForRelease = true;
        return session;
      }
      session.buttonConflict = null;
      session.buttons[action] = index;
    } else {
      const candidate = auxiliaryAxisCandidate(session, axes);
      if (!candidate) return session;
      const conflict = Object.entries(session.axisButtons).find(([assignedAction, bindings]) => (
        !buttonActionsMayShare(action, assignedAction)
        && bindings.some(binding => binding.index === candidate.index && Math.abs(binding.value - candidate.value) < 0.06)
      ));
      if (conflict) {
        session.buttonConflict = {action, assignedAction: conflict[0], index: candidate.index};
        session.waitingForRelease = true;
        return session;
      }
      session.buttonConflict = null;
      session.axisButtons[action] = [{index: candidate.index, value: candidate.value}];
    }
    session.buttonStep += 1;
    session.waitingForRelease = true;
    if (session.buttonStep >= BUTTON_ACTIONS.length) completeWizard(session, pad);
  }
  return session;
}

/** Re-starts guided mapping; use removeControllerMapping for a defaults reset. */
export function recalibrateControllerMapping(pad) {
  return createControllerMappingSession(pad);
}

export function createControllerMappingStore(value = null) {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { parsed = null; }
  }
  const controllers = {};
  if (parsed?.version === CONTROLLER_MAPPING_VERSION && parsed.controllers && typeof parsed.controllers === "object") {
    for (const [key, profile] of Object.entries(parsed.controllers)) {
      if (!profile || typeof profile !== "object") continue;
      const normalised = normaliseControllerMapping(profile, {
        id: profile.controllerId || key,
        mapping: profile.browserMapping || "",
        axisCount: profile.axisCount,
        buttonCount: profile.buttonCount,
      });
      controllers[normalised.key] = normalised;
    }
  }
  return {version: CONTROLLER_MAPPING_VERSION, controllers};
}

export function controllerMappingForPad(store, pad) {
  const profile = store?.controllers?.[controllerMappingKey(pad)];
  return profile ? normaliseControllerMapping(profile, pad) : null;
}

export function saveControllerMapping(store, mapping) {
  const safeStore = createControllerMappingStore(store);
  const profile = normaliseControllerMapping(mapping, {
    id: mapping?.controllerId || mapping?.key,
    mapping: mapping?.browserMapping || "",
    axisCount: mapping?.axisCount,
    buttonCount: mapping?.buttonCount,
  });
  return {
    version: CONTROLLER_MAPPING_VERSION,
    controllers: {...safeStore.controllers, [profile.key]: profile},
  };
}

export function removeControllerMapping(store, padOrKey) {
  const safeStore = createControllerMappingStore(store);
  const key = typeof padOrKey === "string" ? padOrKey : controllerMappingKey(padOrKey);
  const controllers = {...safeStore.controllers};
  delete controllers[key];
  return {version: CONTROLLER_MAPPING_VERSION, controllers};
}

export function serialiseControllerMappings(store) {
  return JSON.stringify(createControllerMappingStore(store));
}

import {INPUT_SOURCES, WEAPON_SLOTS, isInputSource} from "./contracts.js";

const MAX_LOOK_DELTA = Math.PI;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeMove(move) {
  let x = finite(move?.x);
  let y = finite(move?.y);
  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }
  return Object.freeze({x, y});
}

function normalizeLook(look) {
  const yaw = Math.max(-MAX_LOOK_DELTA, Math.min(MAX_LOOK_DELTA, finite(look?.yaw)));
  const pitch = Math.max(-MAX_LOOK_DELTA, Math.min(MAX_LOOK_DELTA, finite(look?.pitch)));
  return Object.freeze({yaw, pitch});
}

function normalizeWeaponSlot(value) {
  if (value === null || value === undefined) return null;
  const slot = Number(value);
  return Number.isInteger(slot) && slot >= WEAPON_SLOTS.ARBALEST && slot <= WEAPON_SLOTS.RUNEBOLT
    ? slot
    : null;
}

/**
 * Converts DOM, touch or gamepad adapter output into the canonical InputFrame.
 * Move magnitude is capped to one and invalid look spikes cannot turn farther
 * than half a revolution in one frame.
 */
export function createInputFrame(value = {}) {
  return Object.freeze({
    move: normalizeMove(value.move),
    look: normalizeLook(value.look),
    fire: Boolean(value.fire),
    aim: Boolean(value.aim),
    melee: Boolean(value.melee),
    selectedWeapon: normalizeWeaponSlot(value.selectedWeapon),
    interact: Boolean(value.interact),
    sprint: Boolean(value.sprint),
    jump: Boolean(value.jump),
    slide: Boolean(value.slide),
    pause: Boolean(value.pause),
    source: isInputSource(value.source) ? value.source : INPUT_SOURCES.MOUSE,
  });
}

export const EMPTY_INPUT_FRAME = createInputFrame();

/** Alias kept explicit for callers normalising reusable adapter objects. */
export const normalizeInputFrame = createInputFrame;

const DESKTOP_GAMEPLAY_KEYS = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD",
  "ShiftLeft", "ShiftRight",
  "ControlLeft", "ControlRight", "KeyC", "Space",
  "KeyE", "KeyF", "KeyQ", "Digit1", "Digit2", "Digit3",
]);

export function keyboardHasGameplayIntent(keyboard = {}) {
  return Boolean(
    finite(keyboard.x) !== 0
    || finite(keyboard.y) !== 0
    || keyboard.sprint
    || keyboard.jump
    || keyboard.slide
  );
}

export function keyboardCodeClaimsDesktopInput(code) {
  return DESKTOP_GAMEPLAY_KEYS.has(code);
}

/**
 * Active stick/button input owns the frame. Once the pad is idle, any held
 * keyboard locomotion immediately reclaims desktop control without requiring
 * an unrelated mouse movement first.
 */
export function resolveFrameInputSource(currentSource, {gamepadActive = false, keyboard} = {}) {
  if (gamepadActive) return INPUT_SOURCES.GAMEPAD;
  if (keyboardHasGameplayIntent(keyboard)) return INPUT_SOURCES.MOUSE;
  return isInputSource(currentSource) ? currentSource : INPUT_SOURCES.MOUSE;
}

/**
 * Merges simultaneous adapters without inventing fire or interaction input.
 * The last non-idle move and look inputs win independently; edge actions
 * combine. This lets separate touch pointers own the two virtual sticks.
 */
export function mergeInputFrames(...values) {
  const frames = values.map(createInputFrame);
  if (frames.length === 0) return EMPTY_INPUT_FRAME;
  let move = frames[0].move;
  let look = frames[0].look;
  let source = frames[0].source;
  let weapon = null;
  let fire = false;
  let aim = false;
  let melee = false;
  let interact = false;
  let sprint = false;
  let jump = false;
  let slide = false;
  let pause = false;
  for (const frame of frames) {
    if (frame.move.x !== 0 || frame.move.y !== 0) {
      move = frame.move;
      source = frame.source;
    }
    if (frame.look.yaw !== 0 || frame.look.pitch !== 0) {
      look = frame.look;
      source = frame.source;
    }
    if (frame.selectedWeapon !== null) weapon = frame.selectedWeapon;
    fire ||= frame.fire;
    aim ||= frame.aim;
    melee ||= frame.melee;
    interact ||= frame.interact;
    sprint ||= frame.sprint;
    jump ||= frame.jump;
    slide ||= frame.slide;
    pause ||= frame.pause;
  }
  return createInputFrame({
    move,
    look,
    fire,
    aim,
    melee,
    selectedWeapon: weapon,
    interact,
    sprint,
    jump,
    slide,
    pause,
    source,
  });
}

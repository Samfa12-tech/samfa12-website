import {GAME_PHASES, INPUT_SOURCES} from "./contracts.js";

export const CONTROLLER_UI_SCOPES = Object.freeze({
  NONE: "none",
  DIALOGUE: "dialogue",
  GOALS: "goals",
  MAPPING: "mapping",
  QUIT: "quit",
  OATH_HALL: "oath_hall",
  SERVICE: "service",
  PAUSE: "pause",
  SETTINGS: "settings",
  COOP: "coop",
  HOW: "how",
  MENU: "menu",
  BUILD: "build",
  BOON: "boon",
  RESULT: "result",
  REPORT: "report",
  UPDATE: "update",
});

export function controllerInputSourceForPresence(connected, coarsePointer = false) {
  if (connected) return INPUT_SOURCES.GAMEPAD;
  return coarsePointer ? INPUT_SOURCES.TOUCH : INPUT_SOURCES.MOUSE;
}

/**
 * Standard and guided controller maps may intentionally share B between Back
 * and Slide. During active play the physical action is Slide; menu and overlay
 * navigation still retain the familiar B-to-go-back behavior.
 */
export function controllerBackNavigates(input, {phase, paused = false} = {}) {
  if (!input?.back) return false;
  const activeGameplay = !paused
    && (phase === GAME_PHASES.DAYTIME || phase === GAME_PHASES.BUILD_BREAK
      || phase === GAME_PHASES.COMBAT || phase === GAME_PHASES.INTERWAVE_RECOVERY);
  return !(activeGameplay && input.slide);
}

export function resolveControllerUiScope(state = {}) {
  if (state.reportOpen) return CONTROLLER_UI_SCOPES.REPORT;
  if (state.updateOpen) return CONTROLLER_UI_SCOPES.UPDATE;
  if (state.dialogueOpen) return CONTROLLER_UI_SCOPES.DIALOGUE;
  if (state.goalsOpen) return CONTROLLER_UI_SCOPES.GOALS;
  if (state.mappingOpen) return CONTROLLER_UI_SCOPES.MAPPING;
  if (state.quitOpen) return CONTROLLER_UI_SCOPES.QUIT;
  const daytimeAccess = state.phase === GAME_PHASES.DAYTIME || state.phase === GAME_PHASES.BUILD_BREAK;
  if (state.oathHallOpen && (daytimeAccess || state.phase === GAME_PHASES.MENU)) return CONTROLLER_UI_SCOPES.OATH_HALL;
  if (state.serviceOpen && daytimeAccess) return CONTROLLER_UI_SCOPES.SERVICE;
  if (state.paused) return state.settingsOpen ? CONTROLLER_UI_SCOPES.SETTINGS : CONTROLLER_UI_SCOPES.PAUSE;
  if (state.phase === GAME_PHASES.MENU) {
    if (state.coopOpen) return CONTROLLER_UI_SCOPES.COOP;
    if (state.settingsOpen) return CONTROLLER_UI_SCOPES.SETTINGS;
    if (state.howOpen) return CONTROLLER_UI_SCOPES.HOW;
    return CONTROLLER_UI_SCOPES.MENU;
  }
  if (state.phase === GAME_PHASES.DAYTIME || state.phase === GAME_PHASES.BUILD_BREAK) return CONTROLLER_UI_SCOPES.BUILD;
  if (state.phase === GAME_PHASES.BOON_CHOICE) return CONTROLLER_UI_SCOPES.BOON;
  if (state.phase === GAME_PHASES.RUN_FAILED || state.phase === GAME_PHASES.NIGHT_COMPLETE
    || state.phase === GAME_PHASES.CAMPAIGN_COMPLETE) {
    return CONTROLLER_UI_SCOPES.RESULT;
  }
  return CONTROLLER_UI_SCOPES.NONE;
}

/** Choose the nearest element in the requested vertical direction, retaining
 * the current horizontal column where possible. */
export function spatialControllerIndex(elements, currentIndex, direction = 0, axis = "vertical") {
  if (!elements.length) return -1;
  const current = elements[currentIndex] ?? elements[0];
  if (!current?.getBoundingClientRect) return wrappedControllerIndex(elements.length, currentIndex, direction);
  const from = current.getBoundingClientRect();
  const sign = Math.sign(Number(direction) || 0);
  if (!sign) return currentIndex >= 0 ? currentIndex : 0;
  const candidates = elements.map((element, index) => ({element, index, rect: element.getBoundingClientRect()}))
    .filter(({index, rect}) => index !== currentIndex && sign * ((axis === "horizontal" ? rect.left : rect.top) - (axis === "horizontal" ? from.left : from.top)) > 1);
  if (!candidates.length) return wrappedControllerIndex(elements.length, currentIndex, direction);
  candidates.sort((a, b) => {
    const primaryA = axis === "horizontal" ? a.rect.left : a.rect.top;
    const primaryB = axis === "horizontal" ? b.rect.left : b.rect.top;
    const crossA = axis === "horizontal" ? a.rect.top : a.rect.left;
    const crossB = axis === "horizontal" ? b.rect.top : b.rect.left;
    const fromCross = axis === "horizontal" ? from.top : from.left;
    return (Math.abs(crossA - fromCross) - Math.abs(crossB - fromCross)) || (sign * (primaryA - primaryB));
  });
  return candidates[0].index;
}

export function wrappedControllerIndex(length, currentIndex, direction = 0) {
  const count = Math.max(0, Math.floor(Number(length) || 0));
  if (!count) return -1;
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= count) return 0;
  return (currentIndex + Math.sign(Number(direction) || 0) + count) % count;
}

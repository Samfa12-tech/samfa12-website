/**
 * Register lifecycle behaviour shared by the browser build and the Capacitor
 * shell. This deliberately uses the optional Capacitor global rather than a
 * bare module import so the exact same unbundled ESM build remains playable on
 * itch and offline over a local HTTP server.
 */
export function installNativeLifecycle({
  documentTarget = document,
  windowTarget = window,
  shouldPause = () => true,
  pause = () => {},
  resume = () => {},
  foreground = () => {},
  back = null,
  now = () => Date.now(),
} = {}) {
  let backgrounded = false;
  const pauseIfPlaying = (reason) => {
    if (shouldPause()) {
      backgrounded = true;
      pause(reason);
    }
  };

  const resumeIfBackgrounded = (reason) => {
    if (!backgrounded) return;
    backgrounded = false;
    resume(reason);
  };

  const onVisibilityChange = () => {
    if (documentTarget.hidden) pauseIfPlaying("background");
    else {
      resumeIfBackgrounded("foreground");
      foreground("foreground");
    }
  };
  let lastBackAt = Number.NEGATIVE_INFINITY;
  const onCordovaBack = (event) => {
    event?.preventDefault?.();
    const currentBackAt = Number(now()) || 0;
    // Capacitor Android can surface one hardware press through both the App
    // plugin and the Cordova-compatible document event. Consume it once so a
    // single Back cannot close a drawer and immediately open the quit prompt.
    if (currentBackAt - lastBackAt < 250) return;
    lastBackAt = currentBackAt;
    if (typeof back === "function") back("android-back");
    else pauseIfPlaying("android-back");
  };
  const onAppState = ({isActive}) => {
    if (!isActive) pauseIfPlaying("app-background");
    else {
      resumeIfBackgrounded("app-foreground");
      foreground("app-foreground");
    }
  };

  documentTarget.addEventListener("visibilitychange", onVisibilityChange);
  // Supported by Capacitor's Android bridge and harmless in a normal browser.
  documentTarget.addEventListener("backbutton", onCordovaBack);

  let removeBackListener = null;
  let removeStateListener = null;
  const app = windowTarget.Capacitor?.Plugins?.App;
  if (app?.addListener) {
    const attach = (eventName, store) => {
      try {
        const handle = app.addListener(eventName, store);
        Promise.resolve(handle).then((listener) => {
          if (eventName === "backButton") removeBackListener = listener?.remove?.bind(listener) || null;
          else removeStateListener = listener?.remove?.bind(listener) || null;
        }).catch(() => {});
      } catch {
        // Browser globals from partial Capacitor bridges are optional.
      }
    };
    attach("backButton", onCordovaBack);
    attach("appStateChange", onAppState);
  }

  return () => {
    documentTarget.removeEventListener("visibilitychange", onVisibilityChange);
    documentTarget.removeEventListener("backbutton", onCordovaBack);
    removeBackListener?.();
    removeStateListener?.();
  };
}

export const GAME_BACK_ACTIONS = Object.freeze({
  CLOSE_DIALOGUE: "close_dialogue",
  CLOSE_REPORT: "close_report",
  CLOSE_GOALS: "close_goals",
  CLOSE_UPDATE: "close_update",
  CLOSE_QUIT: "close_quit",
  CANCEL_MAPPING: "cancel_mapping",
  CLOSE_BUILD_SHEET: "close_build_sheet",
  CLOSE_SETTINGS: "close_settings",
  CLOSE_HOW: "close_how",
  PAUSE: "pause",
  OPEN_QUIT: "open_quit",
});

/**
 * Resolve one Back press without mutating game state. Keeping this hierarchy
 * pure prevents the Android bridge and controller Back button from drifting
 * into different menu behaviour.
 */
export function resolveGameBackAction({
  dialogueOpen = false,
  reportOpen = false,
  goalsOpen = false,
  updateOpen = false,
  quitOpen = false,
  mappingOpen = false,
  buildSheetOpen = false,
  settingsOpen = false,
  howOpen = false,
  paused = false,
  phase = "menu",
} = {}) {
  if (dialogueOpen) return GAME_BACK_ACTIONS.CLOSE_DIALOGUE;
  if (reportOpen) return GAME_BACK_ACTIONS.CLOSE_REPORT;
  if (goalsOpen) return GAME_BACK_ACTIONS.CLOSE_GOALS;
  if (updateOpen) return GAME_BACK_ACTIONS.CLOSE_UPDATE;
  if (quitOpen) return GAME_BACK_ACTIONS.CLOSE_QUIT;
  if (mappingOpen) return GAME_BACK_ACTIONS.CANCEL_MAPPING;
  if (buildSheetOpen) return GAME_BACK_ACTIONS.CLOSE_BUILD_SHEET;
  if (settingsOpen) return GAME_BACK_ACTIONS.CLOSE_SETTINGS;
  if (howOpen) return GAME_BACK_ACTIONS.CLOSE_HOW;
  if (paused) return GAME_BACK_ACTIONS.OPEN_QUIT;
  if (["daytime", "build_break", "combat", "interwave_recovery"].includes(phase)) return GAME_BACK_ACTIONS.PAUSE;
  return GAME_BACK_ACTIONS.OPEN_QUIT;
}

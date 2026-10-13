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
  let disposed = false;
  let backgrounded = false;
  const pauseIfPlaying = (reason) => {
    if (disposed) return;
    if (shouldPause() && !disposed) {
      backgrounded = true;
      pause(reason);
    }
  };

  const resumeIfBackgrounded = (reason) => {
    if (disposed || !backgrounded) return;
    backgrounded = false;
    resume(reason);
  };

  const onVisibilityChange = () => {
    if (disposed) return;
    if (documentTarget.hidden) pauseIfPlaying("background");
    else {
      resumeIfBackgrounded("foreground");
      if (!disposed) foreground("foreground");
    }
  };
  let lastBackAt = Number.NEGATIVE_INFINITY;
  const onCordovaBack = (event) => {
    if (disposed) return;
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
    if (disposed) return;
    if (!isActive) pauseIfPlaying("app-background");
    else {
      resumeIfBackgrounded("app-foreground");
      if (!disposed) foreground("app-foreground");
    }
  };

  documentTarget.addEventListener("visibilitychange", onVisibilityChange);
  // Supported by Capacitor's Android bridge and harmless in a normal browser.
  documentTarget.addEventListener("backbutton", onCordovaBack);

  const nativeRemovers = new Set();
  const removeNativeListener = (remove) => {
    try {
      Promise.resolve(remove()).catch(() => {});
    } catch {
      // A failed optional bridge removal must not block the other listeners.
    }
  };
  const retainNativeListener = (listener) => {
    if (typeof listener?.remove !== "function") return;
    const remove = listener.remove.bind(listener);
    // Capacitor may resolve a registration after the owning game is gone.
    if (disposed) removeNativeListener(remove);
    else nativeRemovers.add(remove);
  };
  const app = windowTarget.Capacitor?.Plugins?.App;
  if (app?.addListener) {
    const attach = (eventName, store) => {
      try {
        const handle = app.addListener(eventName, store);
        if (typeof handle?.then === "function") {
          Promise.resolve(handle).then(retainNativeListener).catch(() => {});
        } else retainNativeListener(handle);
      } catch {
        // Browser globals from partial Capacitor bridges are optional.
      }
    };
    attach("backButton", onCordovaBack);
    attach("appStateChange", onAppState);
  }

  return () => {
    if (disposed) return;
    disposed = true;
    backgrounded = false;
    documentTarget.removeEventListener("visibilitychange", onVisibilityChange);
    documentTarget.removeEventListener("backbutton", onCordovaBack);
    for (const remove of nativeRemovers) removeNativeListener(remove);
    nativeRemovers.clear();
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

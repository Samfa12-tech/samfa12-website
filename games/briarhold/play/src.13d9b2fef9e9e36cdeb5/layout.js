const PORTRAIT_BREAKPOINT = 1;

const DEFAULT_SAFE_AREA = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

const PROFILE_DEFINITIONS = Object.freeze({
  portrait: Object.freeze({
    id: "portrait",
    orientation: "portrait",
    camera: Object.freeze({
      position: Object.freeze([0, 16.6, -9.5]),
      target: Object.freeze([0, 0.45, 36]),
      fieldOfView: 1.02,
      yawLimit: 0.46,
      pitchLimit: Object.freeze([-0.2, 0.24]),
      activeApproachFraming: "centered",
      inactiveApproachVisibility: "threat-strip",
    }),
    hud: Object.freeze({
      density: "stacked",
      healthPlacement: "top",
      statusPlacement: "below-health",
      threatPlacement: "top-strip",
      weaponPlacement: "bottom-center",
      actionPlacement: "bottom-split",
      showBothApproaches: false,
    }),
    controls: Object.freeze({
      minimumTargetSize: 52,
      fireDiameter: 104,
      stationSwitchMode: "single-next-station",
      pointerAimScale: 0.9,
    }),
  }),
  landscape: Object.freeze({
    id: "landscape",
    orientation: "landscape",
    camera: Object.freeze({
      position: Object.freeze([0, 14.4, -9.5]),
      target: Object.freeze([0, 0.8, 48]),
      fieldOfView: 0.82,
      yawLimit: 0.58,
      pitchLimit: Object.freeze([-0.18, 0.22]),
      activeApproachFraming: "wide",
      inactiveApproachVisibility: "peripheral-status",
    }),
    hud: Object.freeze({
      density: "wide",
      healthPlacement: "top-left",
      statusPlacement: "top-center",
      threatPlacement: "top-center",
      weaponPlacement: "bottom-center",
      actionPlacement: "bottom-corners",
      showBothApproaches: true,
    }),
    controls: Object.freeze({
      minimumTargetSize: 46,
      fireDiameter: 96,
      stationSwitchMode: "direct-station",
      pointerAimScale: 1,
    }),
  }),
});

function finiteDimension(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteInset(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizedSafeArea(safeArea = DEFAULT_SAFE_AREA) {
  return Object.freeze({
    top: finiteInset(safeArea.top),
    right: finiteInset(safeArea.right),
    bottom: finiteInset(safeArea.bottom),
    left: finiteInset(safeArea.left),
  });
}

/**
 * Returns an immutable camera and HUD description for a viewport.
 * It derives view geometry only; campaign and combat state are intentionally
 * neither accepted nor retained.
 */
export function resolveLayoutProfile({
  width,
  height,
  coarsePointer = false,
  safeArea = DEFAULT_SAFE_AREA,
} = {}) {
  const viewportWidth = finiteDimension(width, 1280);
  const viewportHeight = finiteDimension(height, 720);
  const orientation =
    viewportWidth / viewportHeight < PORTRAIT_BREAKPOINT
      ? "portrait"
      : "landscape";
  const definition = PROFILE_DEFINITIONS[orientation];

  return Object.freeze({
    ...definition,
    viewport: Object.freeze({
      width: viewportWidth,
      height: viewportHeight,
      aspectRatio: viewportWidth / viewportHeight,
      safeArea: normalizedSafeArea(safeArea),
    }),
    input: Object.freeze({
      coarsePointer: Boolean(coarsePointer),
      minimumTargetSize: coarsePointer
        ? Math.max(52, definition.controls.minimumTargetSize)
        : definition.controls.minimumTargetSize,
    }),
  });
}

function readWindowViewport(windowRef) {
  return {
    width: windowRef.innerWidth,
    height: windowRef.innerHeight,
    coarsePointer: Boolean(
      windowRef.matchMedia?.("(pointer: coarse)")?.matches,
    ),
  };
}

export function applyLayoutProfile(root, profile) {
  if (!root || !profile) return profile;
  root.dataset.layout = profile.id;
  root.style?.setProperty("--layout-aspect", String(profile.viewport.aspectRatio));
  root.style?.setProperty(
    "--minimum-target",
    `${profile.input.minimumTargetSize}px`,
  );
  return profile;
}

/**
 * Observes viewport changes and emits profiles. The observer owns only the
 * current view profile, so orientation changes cannot reset simulation state.
 */
export function createLayoutObserver({
  windowRef = globalThis.window,
  root = globalThis.document?.documentElement,
  onChange = () => {},
  readViewport = readWindowViewport,
} = {}) {
  if (!windowRef?.addEventListener || !windowRef?.removeEventListener) {
    throw new TypeError("createLayoutObserver requires a window-like event target");
  }

  let current = null;
  let started = false;

  const refresh = () => {
    const next = resolveLayoutProfile(readViewport(windowRef));
    current = next;
    applyLayoutProfile(root, next);
    onChange(next);
    return next;
  };

  const start = () => {
    if (started) return current;
    started = true;
    windowRef.addEventListener("resize", refresh, { passive: true });
    windowRef.addEventListener("orientationchange", refresh, { passive: true });
    return refresh();
  };

  const stop = () => {
    if (!started) return;
    started = false;
    windowRef.removeEventListener("resize", refresh);
    windowRef.removeEventListener("orientationchange", refresh);
  };

  return Object.freeze({
    start,
    stop,
    refresh,
    get current() {
      return current;
    },
  });
}

export const LAYOUT_PROFILES = PROFILE_DEFINITIONS;

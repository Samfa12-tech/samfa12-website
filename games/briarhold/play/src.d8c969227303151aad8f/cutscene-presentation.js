import {resolveNarrativeAudioCue} from "./audio.js";
import {resolveNarrativeWorldView} from "./world.js";

const DIALOGUE_IDS = Object.freeze({
  dialog: "narrativeDialog",
  speaker: "narrativeSpeaker",
  role: "narrativeRole",
  portrait: "narrativePortrait",
  text: "narrativeText",
  responses: "narrativeResponses",
  primary: "narrativeResponsePrimary",
  secondary: "narrativeResponseSecondary",
  continue: "narrativeContinue",
  skip: "narrativeSkip",
});

function element(documentTarget, id) {
  return documentTarget?.getElementById?.(id) ?? null;
}

function boundedInteger(value, minimum, maximum) {
  const number = Number(value);
  return Math.max(minimum, Math.min(maximum, Number.isFinite(number) ? Math.floor(number) : minimum));
}

function focusableElements(root) {
  return [...(root?.querySelectorAll?.("button:not([hidden]):not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") ?? [])]
    .filter(candidate => candidate?.hidden !== true && candidate?.disabled !== true);
}

function canRestoreFocus(element) {
  if (!element?.focus || element.isConnected === false) return false;
  return !element.closest?.('[hidden], [aria-hidden="true"]');
}

function restorePointerOwner(pointerOwner) {
  if (!pointerOwner?.requestPointerLock) return;
  try {
    Promise.resolve(pointerOwner.requestPointerLock()).catch(() => {});
  } catch {
    // Pointer lock can be unavailable outside a fresh browser gesture.
  }
}

/**
 * Local-only scene presentation. The caller owns narrative authority and may
 * choose what to do with the returned IDs after this adapter closes.
 */
export function createCutscenePresentation({
  capturePose,
  applyView,
  restorePose,
  documentTarget = globalThis.document,
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis) ?? (callback => callback()),
  playCue = () => {},
  onResult = () => {},
  captureLocalState = () => null,
  restoreLocalState = () => {},
} = {}) {
  if (typeof capturePose !== "function" || typeof applyView !== "function" || typeof restorePose !== "function") {
    throw new TypeError("capturePose, applyView, and restorePose are required");
  }
  const controls = Object.fromEntries(Object.entries(DIALOGUE_IDS).map(([key, id]) => [key, element(documentTarget, id)]));
  if (!controls.dialog || !controls.text || !controls.continue || !controls.skip) {
    throw new TypeError("narrative dialogue DOM is incomplete");
  }

  let session = null;
  let frameToken = 0;

  const removeTrap = () => documentTarget?.removeEventListener?.("keydown", onKeyDown);
  const restoreSession = () => {
    if (!session) return null;
    const closing = session;
    session = null;
    frameToken += 1;
    controls.dialog.hidden = true;
    controls.dialog.removeAttribute?.("data-reduced-motion");
    controls.dialog.removeAttribute?.("data-waiting-for-host");
    removeTrap();
    restorePose(closing.pose);
    restoreLocalState(closing.localState);
    if (canRestoreFocus(closing.previousFocus)) closing.previousFocus.focus();
    restorePointerOwner(closing.pointerOwner);
    return closing;
  };

  const close = (kind, {reason = null, responseId = null, responseTag = null} = {}) => {
    const closing = restoreSession();
    if (!closing) return null;
    const result = {
      kind,
      ...(reason === null ? {} : {reason}),
      sceneId: closing.sceneId,
      beatId: closing.beatId,
      responseId,
      responseTag,
      localState: closing.localState,
    };
    onResult(result);
    return result;
  };

  function onKeyDown(event) {
    if (!session) return;
    if (event?.key === "Escape") {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      close("interrupted", {reason: "escape"});
      return;
    }
    if (event?.key !== "Tab") return;
    const candidates = focusableElements(controls.dialog);
    if (!candidates.length) return;
    const currentIndex = candidates.indexOf(documentTarget?.activeElement);
    const direction = event.shiftKey ? -1 : 1;
    const nextIndex = currentIndex < 0
      ? 0
      : (currentIndex + direction + candidates.length) % candidates.length;
    event.preventDefault?.();
    candidates[nextIndex].focus?.();
  }

  const setResponse = (button, response) => {
    if (!button) return;
    button.hidden = !response;
    button.disabled = !response;
    button.textContent = response?.text ?? "";
    button.dataset.responseId = response?.id ?? "";
    button.dataset.responseTag = response?.tag ?? "";
  };

  controls.primary?.addEventListener?.("click", () => {
    if (!session) return;
    close("response", {
      responseId: controls.primary.dataset.responseId || null,
      responseTag: controls.primary.dataset.responseTag || null,
    });
  });
  controls.secondary?.addEventListener?.("click", () => {
    if (!session) return;
    close("response", {
      responseId: controls.secondary.dataset.responseId || null,
      responseTag: controls.secondary.dataset.responseTag || null,
    });
  });
  controls.continue.addEventListener?.("click", () => close("complete"));
  controls.skip.addEventListener?.("click", () => close("skip"));

  return Object.freeze({
    get isOpen() { return session !== null; },
    begin({
      sceneId = null,
      beatId = null,
      shotId = "first-person",
      cueId = "none",
      speaker = "",
      role = "",
      portraitId = null,
      text = "",
      responses = [],
      continueLabel = "Continue",
      skipLabel = "Skip",
      waitingForHost = false,
      reducedMotion = false,
      localState = undefined,
    } = {}) {
      if (session) close("interrupted", {reason: "replaced"});
      const pose = capturePose();
      const pointerOwner = documentTarget?.pointerLockElement ?? null;
      const previousFocus = documentTarget?.activeElement ?? null;
      const view = resolveNarrativeWorldView(shotId, {reducedMotion});
      const cue = resolveNarrativeAudioCue(cueId);
      const savedLocalState = localState === undefined ? captureLocalState() : localState;
      session = {sceneId, beatId, pose, pointerOwner, previousFocus, localState: savedLocalState};
      controls.dialog.hidden = false;
      controls.dialog.setAttribute?.("data-reduced-motion", reducedMotion ? "true" : "false");
      if (controls.speaker) controls.speaker.textContent = String(speaker ?? "");
      if (controls.role) controls.role.textContent = String(role ?? "");
      if (controls.portrait) {
        const safePortrait = String(portraitId || role || "bellkeeper").toLowerCase().replace(/[^a-z0-9-]/gu, "");
        controls.portrait.src = `assets/ui/portraits/${safePortrait}.webp`;
        controls.portrait.alt = speaker ? `${speaker}, ${role}` : "";
        controls.dialog.dataset.speaker = safePortrait;
        controls.portrait.onerror = () => { controls.portrait.hidden = true; };
        controls.portrait.hidden = false;
      }
      controls.text.textContent = String(text ?? "");
      const boundedResponses = waitingForHost ? [] : Array.isArray(responses) ? responses.slice(0, 2) : [];
      setResponse(controls.primary, boundedResponses[0]);
      setResponse(controls.secondary, boundedResponses[1]);
      if (controls.responses) controls.responses.hidden = boundedResponses.length === 0;
      controls.continue.hidden = false;
      controls.continue.disabled = false;
      controls.continue.textContent = String(continueLabel ?? "Continue");
      controls.skip.hidden = false;
      controls.skip.disabled = true;
      controls.skip.textContent = String(skipLabel ?? "Skip");
      controls.dialog.setAttribute?.("data-waiting-for-host", waitingForHost ? "true" : "false");
      documentTarget?.exitPointerLock?.();
      if (view.movesCamera) applyView(view, {hardCut: reducedMotion === true});
      playCue(cue.id);
      documentTarget?.addEventListener?.("keydown", onKeyDown);
      const initialFocus = boundedResponses.length ? controls.primary : controls.continue;
      initialFocus?.focus?.();
      const token = ++frameToken;
      requestFrame(() => {
        if (session && token === frameToken) controls.skip.disabled = false;
      });
      return Object.freeze({
        shotId: view.shotId,
        cueId: cue.id,
        hardCut: reducedMotion === true,
        fallback: view.fallback === true || cue.fallback === true,
      });
    },
    finish() { return close("complete"); },
    skip() { return close("skip"); },
    interrupt(reason = "interrupted") { return close("interrupted", {reason}); },
  });
}

export function createGoalsPresentation({documentTarget = globalThis.document} = {}) {
  const panel = element(documentTarget, "goalsPanel");
  const list = element(documentTarget, "goalsList");
  const closeButton = element(documentTarget, "goalsClose");
  if (!panel || !list || !closeButton) throw new TypeError("Goals DOM is incomplete");
  let previousFocus = null;
  let model = Object.freeze([]);

  const close = () => {
    if (panel.hidden) return false;
    panel.hidden = true;
    documentTarget?.removeEventListener?.("keydown", onKeyDown);
    previousFocus?.focus?.();
    previousFocus = null;
    return true;
  };
  function onKeyDown(event) {
    if (panel.hidden) return;
    if (event?.key === "Escape") {
      event.preventDefault?.();
      close();
    } else if (event?.key === "Tab") {
      event.preventDefault?.();
      closeButton.focus?.();
    }
  }
  closeButton.addEventListener?.("click", close);

  return Object.freeze({
    get isOpen() { return panel.hidden === false; },
    get model() { return model; },
    open(goals = []) {
      previousFocus = documentTarget?.activeElement ?? null;
      const byNpc = new Map();
      for (const goal of Array.isArray(goals) ? goals : []) {
        const npcId = String(goal?.npcId ?? "");
        if (!npcId) continue;
        const existing = byNpc.get(npcId);
        if (!existing || (goal?.ready === true && existing?.ready !== true)) byNpc.set(npcId, goal);
      }
      model = Object.freeze([...byNpc.values()].slice(0, 5).map(goal => {
        const target = boundedInteger(goal?.target, 0, 1_000_000);
        return Object.freeze({
          npcId: String(goal?.npcId ?? ""),
          npcName: String(goal?.npcName ?? ""),
          title: String(goal?.title ?? ""),
          current: boundedInteger(goal?.current, 0, target),
          target,
          reset: String(goal?.reset ?? ""),
          reward: String(goal?.reward ?? ""),
          ready: goal?.ready === true,
        });
      }));
      list.textContent = model.map(goal => (
        `${goal.npcName} — ${goal.title}: ${goal.current} / ${goal.target}. ${goal.reset} Reward: ${goal.reward}${goal.ready ? " Ready to report." : ""}`
      )).join("\n");
      panel.hidden = false;
      documentTarget?.addEventListener?.("keydown", onKeyDown);
      closeButton.focus?.();
      return model;
    },
    close,
  });
}

export function createRecoveryPresentation({documentTarget = globalThis.document} = {}) {
  const bark = element(documentTarget, "recoveryBark");
  const warning = element(documentTarget, "recoveryWarning");
  const countdown = element(documentTarget, "recoveryCountdown");
  if (!bark || !warning || !countdown) throw new TypeError("recovery HUD DOM is incomplete");
  return Object.freeze({
    show({warning: warningText = "", remainingMs = 0} = {}) {
      const boundedRemaining = boundedInteger(remainingMs, 0, 12_000);
      const model = Object.freeze({
        warning: String(warningText ?? ""),
        remainingMs: boundedRemaining,
        remainingSeconds: Math.ceil(boundedRemaining / 1000),
      });
      warning.textContent = model.warning;
      countdown.textContent = String(model.remainingSeconds);
      bark.hidden = false;
      return model;
    },
    hide() { bark.hidden = true; },
  });
}

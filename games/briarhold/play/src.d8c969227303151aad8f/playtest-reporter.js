export const PLAYTEST_REPORT_ENDPOINT = "/__briarhold/playtest-report";
export const PLAYTEST_REMOTE_REPORT_ENDPOINT = "https://briarhold-signal.samfa12.com/api/playtest-reports";
export const PLAYTEST_REMOTE_TIMEOUT_MS = 10000;
export const PLAYTEST_TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
export const DEBUG_DIAGNOSTICS_PLUGIN = "DebugDiagnostics";

export function createPlaytestReportId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `report-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createPlaytestTurnstileTokenProvider({
  siteKey,
  container,
  documentTarget = globalThis.document,
  windowTarget = globalThis.window,
  timeoutMs = 20000,
}) {
  let scriptPromise = null;
  let widgetId = null;
  let inFlight = null;
  let activeResolve = null;
  let activeReject = null;
  let activeTimer = null;

  const settle = (callback, value) => {
    if (!callback) return;
    clearTimeout(activeTimer);
    activeTimer = null;
    activeResolve = null;
    activeReject = null;
    callback(value);
  };

  const ensureScript = () => {
    if (windowTarget?.turnstile?.render) return Promise.resolve(windowTarget.turnstile);
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const existing = documentTarget?.querySelector?.('script[data-briarhold-turnstile="true"]');
      const script = existing ?? documentTarget?.createElement?.("script");
      if (!script || !documentTarget?.head?.appendChild) {
        reject(new Error("Anti-spam verification is unavailable"));
        return;
      }
      script.dataset.briarholdTurnstile = "true";
      script.src = PLAYTEST_TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => windowTarget?.turnstile?.render
        ? resolve(windowTarget.turnstile)
        : reject(new Error("Anti-spam verification did not start"));
      script.onerror = () => reject(new Error("Anti-spam verification could not load"));
      if (!existing) documentTarget.head.appendChild(script);
    });
    return scriptPromise;
  };

  return function getTurnstileToken() {
    if (typeof siteKey !== "string" || !siteKey.trim() || !container) {
      return Promise.reject(new Error("Anti-spam verification is not configured"));
    }
    if (inFlight) return inFlight;
    inFlight = ensureScript().then((turnstile) => new Promise((resolve, reject) => {
      activeResolve = (token) => settle(resolve, token);
      activeReject = (message) => settle(reject, new Error(message));
      activeTimer = setTimeout(() => activeReject?.("Anti-spam verification timed out"), timeoutMs);
      try {
        if (widgetId === null) {
          widgetId = turnstile.render(container, {
            sitekey: siteKey.trim(),
            execution: "execute",
            appearance: "interaction-only",
            theme: "dark",
            callback: (token) => typeof token === "string" && token
              ? activeResolve?.(token)
              : activeReject?.("Anti-spam verification failed"),
            "error-callback": () => { activeReject?.("Anti-spam verification failed"); return true; },
            "expired-callback": () => activeReject?.("Anti-spam verification expired; try again"),
          });
        } else {
          turnstile.reset(widgetId);
        }
        turnstile.execute(widgetId);
      } catch {
        activeReject?.("Anti-spam verification failed");
      }
    })).finally(() => { inFlight = null; });
    return inFlight;
  };
}

function isProductionAlpha(documentTarget, windowTarget) {
  try {
    const channel = documentTarget?.querySelector?.('meta[name="briarhold-release-channel"]')?.getAttribute("content")?.trim();
    const page = new URL(windowTarget?.location?.href);
    const securePage = page.protocol === "https:";
    const loopbackPreview = page.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(page.hostname);
    return channel === "production-alpha" && (securePage || loopbackPreview);
  } catch {
    return false;
  }
}

export const PLAYTEST_REPORT_CATEGORIES = Object.freeze([
  "collision",
  "layout",
  "stairs",
  "npc",
  "animation",
  "lighting",
  "other",
]);

export const PLAYTEST_REPORT_IMPACTS = Object.freeze([
  "blocks-run",
  "major-friction",
  "minor-friction",
  "polish",
]);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, places = 3) => Number(finite(value).toFixed(places));

function axisDistance(value, min, max) {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

export function distanceToCollisionVolume(position, volume) {
  const dx = axisDistance(finite(position?.x), finite(volume?.min?.x), finite(volume?.max?.x));
  const dy = axisDistance(finite(position?.y), finite(volume?.min?.y), finite(volume?.max?.y));
  const dz = axisDistance(finite(position?.z), finite(volume?.min?.z), finite(volume?.max?.z));
  return Math.hypot(dx, dy, dz);
}

export function nearestCollisionVolumes(mapDefinition, position, limit = 6) {
  return [...(mapDefinition?.collisionVolumes ?? [])]
    .map((volume) => ({id: String(volume.id), distance: round(distanceToCollisionVolume(position, volume), 2)}))
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, Math.trunc(limit)));
}

export function nearestHubPoints(mapDefinition, position, limit = 3) {
  return [...(mapDefinition?.npcSpawnPoints ?? [])]
    .map((point) => ({
      id: String(point.id),
      npcId: String(point.npcId),
      stationId: String(point.stationId),
      distance: round(Math.hypot(
        finite(point.position?.x) - finite(position?.x),
        finite(point.position?.y) - finite(position?.y),
        finite(point.position?.z) - finite(position?.z),
      ), 2),
    }))
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, Math.trunc(limit)));
}

export function reportScreenshotSize(width, height, maxWidth = 1600, maxHeight = 900) {
  const safeWidth = Math.max(1, Math.round(finite(width, 1)));
  const safeHeight = Math.max(1, Math.round(finite(height, 1)));
  const scale = Math.min(1, maxWidth / safeWidth, maxHeight / safeHeight);
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function canvasPngDataUrl(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Could not encode the screenshot"));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the encoded screenshot"));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    }, "image/png");
  });
}

export async function capturePlaytestScreenshot({engine, scene, documentTarget = globalThis.document}) {
  const width = Math.max(1, Math.round(finite(engine?.getRenderWidth?.(), 1)));
  const height = Math.max(1, Math.round(finite(engine?.getRenderHeight?.(), 1)));
  const gl = engine?._gl;
  if (!gl || typeof gl.readPixels !== "function") throw new Error("WebGL frame capture is unavailable");
  // preserveDrawingBuffer is deliberately disabled for runtime memory use. Render and
  // read back synchronously so the evidence is captured before the buffer is cleared.
  for (let index = 0; index < 16 && gl.getError() !== gl.NO_ERROR; index += 1) { /* drain prior runtime errors */ }
  scene?.render?.();
  for (let index = 0; index < 16 && gl.getError() !== gl.NO_ERROR; index += 1) { /* isolate readback errors */ }
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  if (gl.getError() !== gl.NO_ERROR) throw new Error("WebGL could not read the current frame");

  const source = documentTarget.createElement("canvas");
  source.width = width;
  source.height = height;
  const sourceContext = source.getContext("2d");
  if (!sourceContext) throw new Error("2D screenshot encoding is unavailable");
  const image = sourceContext.createImageData(width, height);
  const rowBytes = width * 4;
  for (let sourceY = 0; sourceY < height; sourceY += 1) {
    const targetY = height - sourceY - 1;
    image.data.set(pixels.subarray(sourceY * rowBytes, (sourceY + 1) * rowBytes), targetY * rowBytes);
  }
  sourceContext.putImageData(image, 0, 0);

  const size = reportScreenshotSize(width, height);
  let encodedCanvas = source;
  if (size.width !== width || size.height !== height) {
    encodedCanvas = documentTarget.createElement("canvas");
    encodedCanvas.width = size.width;
    encodedCanvas.height = size.height;
    const scaledContext = encodedCanvas.getContext("2d");
    if (!scaledContext) throw new Error("2D screenshot scaling is unavailable");
    scaledContext.drawImage(source, 0, 0, size.width, size.height);
  }
  const dataUrl = await canvasPngDataUrl(encodedCanvas);
  return {dataUrl, ...size};
}

export async function detectPlaytestReportReceiver(
  fetchImpl = globalThis.fetch,
  documentTarget = globalThis.document,
  windowTarget = globalThis.window,
) {
  if (typeof fetchImpl !== "function") return null;
  if (isProductionAlpha(documentTarget, windowTarget)) {
    return {
      enabled: true,
      remote: true,
      endpoint: PLAYTEST_REMOTE_REPORT_ENDPOINT,
      folder: "production-alpha",
    };
  }
  const native = windowTarget?.Capacitor?.Plugins?.[DEBUG_DIAGNOSTICS_PLUGIN];
  if (typeof native?.getStatus === "function") {
    try {
      const status = await native.getStatus();
      if (status?.enabled === true) return {...status, native: true};
    } catch { /* normal browsers and release builds have no receiver */ }
  }
  // The local preview server injects this marker into index.html. Production
  // and packaged builds omit it, so they never probe a nonexistent private
  // endpoint or add a harmless-but-noisy 404 to the browser console.
  if (documentTarget?.querySelector) {
    const marker = documentTarget.querySelector('meta[name="briarhold-playtest-receiver"]');
    const folder = marker?.getAttribute("content")?.trim();
    if (!folder) return null;
  }
  let endpoint = PLAYTEST_REPORT_ENDPOINT;
  try {
    const pageUrl = new URL(windowTarget?.location?.href);
    const bootstrapToken = pageUrl.searchParams.get("reportToken") ?? "";
    if (/^[A-Za-z0-9_-]{32,}$/u.test(bootstrapToken)) {
      endpoint = `${PLAYTEST_REPORT_ENDPOINT}?token=${encodeURIComponent(bootstrapToken)}`;
      pageUrl.searchParams.delete("reportToken");
      windowTarget?.history?.replaceState?.(null, "", pageUrl.href);
    }
  } catch { /* URL cleanup is optional in embedded and test environments */ }
  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: {Accept: "application/json"},
      cache: "no-store",
    });
    if (!response.ok) return null;
    const status = await response.json();
    return status?.enabled === true ? status : null;
  } catch {
    return null;
  }
}

export async function submitPlaytestReport(payload, fetchImpl = globalThis.fetch, windowTarget = globalThis.window) {
  const options = arguments[3] ?? {};
  const native = windowTarget?.Capacitor?.Plugins?.[DEBUG_DIAGNOSTICS_PLUGIN];
  const remote = options.receiver?.remote === true;
  if (!remote && typeof native?.saveReport === "function") return native.saveReport(payload);
  const endpoint = remote ? PLAYTEST_REMOTE_REPORT_ENDPOINT : PLAYTEST_REPORT_ENDPOINT;
  let requestPayload = payload;
  if (remote) {
    const token = await (options.getTurnstileToken ?? windowTarget?.briarholdTurnstile?.getToken)?.();
    if (!token || typeof token !== "string") throw new Error("Turnstile verification is required");
    requestPayload = {...payload, turnstileToken: token};
  }
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let timeout;
  const timeoutError = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller?.abort();
      reject(new Error("Report submission timed out"));
    }, options.timeoutMs ?? PLAYTEST_REMOTE_TIMEOUT_MS);
  });
  let response;
  try {
    response = await Promise.race([fetchImpl(endpoint, {
    method: "POST",
    headers: {"Content-Type": "application/json", Accept: "application/json"},
    body: JSON.stringify(requestPayload),
    ...(controller ? {signal: controller.signal} : {}),
    }), timeoutError]);
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Report submission timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Report receiver returned ${response.status}`);
  return result;
}

export function createPlaytestReporter({
  elements,
  captureScreenshot,
  captureContext,
  suspendGame,
  canOpen = () => true,
  announce = () => {},
  fetchImpl = globalThis.fetch,
  windowTarget = globalThis.window,
  getTurnstileToken,
  createReportId = createPlaytestReportId,
  now = () => new Date().toISOString(),
}) {
  let receiver = null;
  let open = false;
  let screenshot = null;
  let context = null;
  let restoreGame = null;
  let restoreFocus = null;
  let pendingReportIdentity = null;
  let captureSequence = 0;
  const screenshotConsent = elements.screenshotConsent ?? elements.overlay.querySelector?.("#playtestReportScreenshotConsent");
  const diagnosticsConsent = elements.diagnosticsConsent ?? elements.overlay.querySelector?.("#playtestReportDiagnosticsConsent");
  const remoteOptions = elements.remoteOptions ?? elements.overlay.querySelector?.("#playtestReportRemoteOptions");

  const setStatus = (message, state = "") => {
    elements.status.textContent = message;
    elements.status.dataset.state = state;
  };

  const setBusy = (busy) => {
    elements.save.disabled = busy;
    elements.retake.disabled = busy;
    elements.cancel.disabled = busy;
    elements.overlay.setAttribute("aria-busy", String(busy));
  };

  const takeScreenshot = async () => {
    const sequence = ++captureSequence;
    setBusy(true);
    setStatus("Capturing the current view…");
    try {
      const captured = await captureScreenshot();
      if (!open || sequence !== captureSequence) return;
      screenshot = captured;
      elements.preview.src = captured.dataUrl;
      elements.preview.hidden = false;
      setStatus(`Screenshot captured · ${captured.width}×${captured.height}`, "ready");
    } catch (error) {
      if (!open || sequence !== captureSequence) return;
      screenshot = null;
      elements.preview.removeAttribute("src");
      elements.preview.hidden = true;
      setStatus(`Screenshot failed: ${error.message}`, "error");
    } finally {
      if (open && sequence === captureSequence) setBusy(false);
    }
  };

  const close = ({saved = false} = {}) => {
    if (!open) return;
    open = false;
    captureSequence += 1;
    elements.overlay.hidden = true;
    elements.note.value = "";
    if (screenshotConsent) screenshotConsent.checked = false;
    if (diagnosticsConsent) diagnosticsConsent.checked = false;
    elements.preview.removeAttribute("src");
    elements.preview.hidden = true;
    screenshot = null;
    context = null;
    pendingReportIdentity = null;
    const restore = restoreGame;
    restoreGame = null;
    restore?.();
    const focusTarget = restoreFocus;
    restoreFocus = null;
    if (focusTarget?.focus) queueMicrotask(() => focusTarget.focus());
    if (saved) announce("Playtest report saved · keep playing");
  };

  const show = async () => {
    if (open || !receiver) return false;
    if (!canOpen()) return false;
    restoreFocus = windowTarget.document?.activeElement ?? null;
    context = captureContext();
    restoreGame = suspendGame();
    open = true;
    screenshot = null;
    pendingReportIdentity = null;
    elements.note.value = "";
    elements.category.value = "collision";
    elements.impact.value = "major-friction";
    elements.preview.hidden = true;
    elements.overlay.hidden = false;
    setStatus("Freezing the moment…");
    queueMicrotask(() => elements.note.focus());
    void takeScreenshot();
    return true;
  };

  const save = async () => {
    const note = elements.note.value.trim();
    if (!note) {
      setStatus("Add a short note before saving.", "error");
      elements.note.focus();
      return false;
    }
    const remote = receiver?.remote === true;
    if (!screenshot && !remote) {
      setStatus("Retake the screenshot before saving.", "error");
      return false;
    }
    if (remote && screenshotConsent?.checked && !screenshot) {
      setStatus("Retake the screenshot or turn off screenshot sharing.", "error");
      return false;
    }
    setBusy(true);
    setStatus("Saving report to the playtest inbox…");
    try {
      const identity = pendingReportIdentity ?? {
        reportId: createReportId(),
        capturedAt: now(),
      };
      pendingReportIdentity = identity;
      const report = {
        schemaVersion: 1,
        ...identity,
        note,
        category: elements.category.value,
        impact: elements.impact.value,
        ...(remote ? {
          includeScreenshot: screenshotConsent?.checked === true,
          includeDiagnostics: diagnosticsConsent?.checked === true,
        } : {}),
        ...(remote ? (screenshotConsent?.checked ? {screenshot} : {}) : {screenshot}),
        ...(remote ? (diagnosticsConsent?.checked ? {context} : {}) : {context}),
      };
      const result = await submitPlaytestReport(report, fetchImpl, windowTarget, {
        receiver,
        getTurnstileToken,
      });
      setStatus(`Saved · ${result.id}`, "saved");
      close({saved: true});
      return true;
    } catch (error) {
      setStatus(`Could not save: ${error.message}`, "error");
      return false;
    } finally {
      if (open) setBusy(false);
    }
  };

  const handleKeydown = (event) => {
    if (open) {
      if (event.code === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      }
      if (event.key === "Tab") {
        const focusables = [elements.note, elements.category, elements.impact, elements.retake, elements.save, elements.cancel]
          .filter((element) => element && !element.disabled && !element.hidden);
        if (focusables.length) {
          const current = focusables.indexOf(windowTarget.document?.activeElement);
          const next = (current + (event.shiftKey ? -1 : 1) + focusables.length) % focusables.length;
          event.preventDefault();
          focusables[next].focus();
        }
      }
      return;
    }
    if (event.code !== "F8" || event.repeat || !receiver) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void show();
  };

  const handleKeyup = (event) => {
    if (!open || event.code !== "Escape") return;
    event.stopImmediatePropagation();
  };

  elements.open.addEventListener("click", () => void show());
  elements.cancel.addEventListener("click", () => close());
  elements.retake.addEventListener("click", () => void takeScreenshot());
  elements.save.addEventListener("click", () => void save());
  windowTarget.addEventListener("keydown", handleKeydown, true);
  windowTarget.addEventListener("keyup", handleKeyup, true);

  const ready = detectPlaytestReportReceiver(fetchImpl, windowTarget.document, windowTarget).then((status) => {
    receiver = status;
    if (receiver) {
      elements.open.hidden = false;
      elements.open.title = receiver.remote
        ? "Send an alpha playtest report to the Briarhold developer"
        : `Save screenshot and note to ${receiver.folder}`;
      if (remoteOptions) remoteOptions.hidden = !receiver.remote;
      if (receiver.remote) elements.save.textContent = "Send report";
    }
    return receiver;
  });

  return Object.freeze({
    ready,
    get isOpen() { return open; },
    get receiver() { return receiver; },
    open: show,
    close,
    save,
    retake: takeScreenshot,
  });
}

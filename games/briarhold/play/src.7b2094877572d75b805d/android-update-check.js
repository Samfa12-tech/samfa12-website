export const ANDROID_UPDATE_MANIFEST_URL =
  "https://samfa12.com/games/briarhold/releases/latest.json";

export const UPDATE_SNOOZE_MS = 24 * 60 * 60 * 1000;
const UPDATE_SNOOZE_KEY = "briarhold.android-update-snooze.v1";
const EXPECTED_APP_ID = "com.samfa.briarhold";
const EXPECTED_CHANNEL = "alpha";
const TRUSTED_UPDATE_HOSTS = new Set(["samfa12.com", "www.samfa12.com"]);

function manifestError(message) {
  return new TypeError(`Invalid Android update manifest: ${message}`);
}

function boundedText(value, field, maxLength, {optional = false} = {}) {
  if (optional && value == null) return "";
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw manifestError(field);
  }
  return value.trim();
}

export function trustedUpdateUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && TRUSTED_UPDATE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function validateAndroidUpdateManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw manifestError("object");
  if (value.schemaVersion !== 1) throw manifestError("schemaVersion");
  if (value.appId !== EXPECTED_APP_ID) throw manifestError("appId");
  if (value.channel !== EXPECTED_CHANNEL) throw manifestError("channel");
  if (!Number.isSafeInteger(value.versionCode) || value.versionCode < 1) {
    throw manifestError("versionCode");
  }
  boundedText(value.versionName, "versionName", 64);
  boundedText(value.title, "title", 100);
  boundedText(value.notes, "notes", 600, {optional: true});
  if (!trustedUpdateUrl(value.updateUrl)) throw manifestError("updateUrl");
  return value;
}

function installedVersionCode(info) {
  const build = String(info?.build ?? "");
  if (!/^\d+$/u.test(build)) return null;
  const value = Number(build);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

function isAndroid(windowTarget) {
  const capacitor = windowTarget?.Capacitor;
  try {
    return capacitor?.getPlatform?.() === "android";
  } catch {
    return false;
  }
}

export async function checkForAndroidUpdate({
  windowTarget = window,
  fetchFn = fetch,
  manifestUrl = ANDROID_UPDATE_MANIFEST_URL,
  timeoutMs = 5000,
} = {}) {
  if (!isAndroid(windowTarget)) return {status: "unsupported"};
  const app = windowTarget.Capacitor?.Plugins?.App;
  if (typeof app?.getInfo !== "function" || typeof fetchFn !== "function") {
    return {status: "unsupported"};
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const info = await app.getInfo();
    const versionCode = installedVersionCode(info);
    if (info?.id !== EXPECTED_APP_ID || versionCode == null) return {status: "unavailable"};
    const response = await fetchFn(manifestUrl, {
      cache: "no-store",
      headers: {Accept: "application/json"},
      ...(controller ? {signal: controller.signal} : {}),
    });
    if (!response?.ok) return {status: "unavailable"};
    const manifest = validateAndroidUpdateManifest(await response.json());
    if (manifest.versionCode <= versionCode) {
      return {status: "current", installedVersionCode: versionCode, manifest};
    }
    return {status: "available", installedVersionCode: versionCode, manifest};
  } catch {
    return {status: "unavailable"};
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function snoozeUpdate(storage, versionCode, now = Date.now()) {
  try {
    storage?.setItem?.(UPDATE_SNOOZE_KEY, JSON.stringify({versionCode, at: now}));
  } catch {
    // Storage is optional; declining an update must never block play.
  }
}

export function isUpdateSnoozed(storage, versionCode, now = Date.now()) {
  try {
    const value = JSON.parse(storage?.getItem?.(UPDATE_SNOOZE_KEY) || "null");
    return value?.versionCode === versionCode
      && Number.isFinite(value?.at)
      && now - value.at >= 0
      && now - value.at < UPDATE_SNOOZE_MS;
  } catch {
    return false;
  }
}

export async function openTrustedUpdateUrl(url, {windowTarget = window} = {}) {
  if (!trustedUpdateUrl(url)) return false;
  const browser = windowTarget.Capacitor?.Plugins?.Browser;
  if (typeof browser?.open === "function") {
    try {
      await browser.open({url});
      return true;
    } catch {
      // Fall through to the normal browser path if the native bridge is partial.
    }
  }
  try {
    return Boolean(windowTarget.open?.(url, "_blank", "noopener,noreferrer"));
  } catch {
    return false;
  }
}

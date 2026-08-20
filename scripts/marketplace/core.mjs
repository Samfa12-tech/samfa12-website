import { readFile } from "node:fs/promises";
import path from "node:path";

export const PUBLIC_STATS_SCHEMA_VERSION = 1;
export const GOOGLE_PLAY_READ_ONLY_SCOPE = "https://www.googleapis.com/auth/devstorage.read_only";

const BANNED_PUBLIC_KEY = /(?:revenue|earning|gross[_-]?sales|net[_-]?sales|tax|price|currency|country|email|order[_-]?number|customer|partnerid|financial)/i;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export function parseEnvFile(source = "") {
  const values = {};
  for (const rawLine of String(source).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[name] = value;
  }
  return values;
}

export async function loadMarketplaceConfig({ cwd = process.cwd(), env = process.env } = {}) {
  let fileValues = {};
  const envPath = path.join(cwd, ".env.marketplace");
  try {
    fileValues = parseEnvFile(await readFile(envPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const value = (name, fallback = "") => String(env[name] || fileValues[name] || fallback).trim();
  return {
    itchApiKey: value("ITCH_API_KEY"),
    steamFinancialApiKey: value("STEAM_FINANCIAL_API_KEY"),
    googlePlayServiceAccountJson: value("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"),
    googlePlayServiceAccountJsonPath: value("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH"),
    googlePlaySalesUri: value("GOOGLE_PLAY_SALES_URI", "gs://pubsite_prod_7761853381809168545/sales/"),
    envPath,
  };
}

export function validateMarketplaceConfig(config) {
  const missing = validateItchAndSteamConfig(config);
  if (!config.googlePlayServiceAccountJson && !config.googlePlayServiceAccountJsonPath) {
    missing.push("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON or GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH");
  }
  if (!parseGoogleStorageUri(config.googlePlaySalesUri)) missing.push("GOOGLE_PLAY_SALES_URI (valid gs:// bucket/prefix)");
  return missing;
}

export function validateItchAndSteamConfig(config) {
  const missing = [];
  if (!config.itchApiKey) missing.push("ITCH_API_KEY");
  if (!config.steamFinancialApiKey) missing.push("STEAM_FINANCIAL_API_KEY");
  return missing;
}

export function parseGoogleStorageUri(value) {
  const match = /^gs:\/\/([a-z0-9._-]+)(?:\/(.*))?$/i.exec(String(value || "").trim());
  if (!match) return null;
  return { bucket: match[1], prefix: match[2] || "" };
}

export async function requestJson({ fetchImpl = fetch, url, options = {}, label = "Provider", attempts = 3 }) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, options);
      if (RETRYABLE_STATUSES.has(response.status) && attempt < attempts) {
        await response.arrayBuffer();
        await wait(200 * (2 ** (attempt - 1)));
        continue;
      }
      const text = await response.text();
      if (!response.ok) throw new Error(`${label} request failed (HTTP ${response.status}).`);
      try {
        return text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`${label} returned malformed JSON.`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(`${label} request failed.`);
      if (attempt < attempts && !/HTTP (?:401|403|404)/.test(lastError.message)) {
        await wait(200 * (2 ** (attempt - 1)));
      } else {
        break;
      }
    }
  }
  throw new Error(lastError?.message?.replace(/https?:\/\/\S+/g, "[redacted URL]") || `${label} request failed.`);
}

export function finiteInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

export function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, finiteInteger(value, fallback));
}

export function assertNoSensitivePublicData(value, pathLabel = "public output") {
  const visit = (item, trail) => {
    if (Array.isArray(item)) return item.forEach((child, index) => visit(child, `${trail}[${index}]`));
    if (!item || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item)) {
      if (BANNED_PUBLIC_KEY.test(key)) throw new Error(`${pathLabel} contains prohibited field: ${trail}.${key}`);
      visit(child, `${trail}.${key}`);
    }
  };
  visit(value, "$" );
  return value;
}

export function assertPublicStats(value) {
  assertNoSensitivePublicData(value);
  if (!value || typeof value !== "object" || value.schemaVersion !== PUBLIC_STATS_SCHEMA_VERSION) {
    throw new Error("Public stats must use the current versioned schema.");
  }
  if (value.status === "uninitialised") return value;
  if (Number.isNaN(Date.parse(value.generatedAt))) throw new Error("Public stats generatedAt must be an ISO timestamp.");
  const countPaths = [
    ["totals.itch.views", value.totals?.itch?.views], ["totals.itch.downloads", value.totals?.itch?.downloads], ["totals.itch.purchases", value.totals?.itch?.purchases],
    ["totals.steam.grossUnits", value.totals?.steam?.grossUnits], ["totals.steam.returnedUnits", value.totals?.steam?.returnedUnits], ["totals.steam.netUnits", value.totals?.steam?.netUnits],
    ["totals.googlePlay.grossPaidAppPurchases", value.totals?.googlePlay?.grossPaidAppPurchases], ["totals.googlePlay.fullyRefundedPaidAppOrders", value.totals?.googlePlay?.fullyRefundedPaidAppOrders], ["totals.googlePlay.netPaidAppPurchases", value.totals?.googlePlay?.netPaidAppPurchases],
    ["totals.combined.paidUnits", value.totals?.combined?.paidUnits],
  ];
  for (const [label, count] of countPaths) {
    if (!Number.isInteger(count) || count < 0) throw new Error(`Public stats ${label} must be a non-negative integer.`);
  }
  const deltaPaths = [
    ["change.sincePreviousSnapshot.itch.views", value.change?.sincePreviousSnapshot?.itch?.views], ["change.sincePreviousSnapshot.itch.downloads", value.change?.sincePreviousSnapshot?.itch?.downloads], ["change.sincePreviousSnapshot.itch.purchases", value.change?.sincePreviousSnapshot?.itch?.purchases],
    ["change.sincePreviousSnapshot.steam.netUnits", value.change?.sincePreviousSnapshot?.steam?.netUnits], ["change.sincePreviousSnapshot.googlePlay.netPaidAppPurchases", value.change?.sincePreviousSnapshot?.googlePlay?.netPaidAppPurchases], ["change.sincePreviousSnapshot.combined.paidUnits", value.change?.sincePreviousSnapshot?.combined?.paidUnits],
  ];
  for (const [label, count] of deltaPaths) {
    if (!Number.isInteger(count)) throw new Error(`Public stats ${label} must be an integer.`);
  }
  for (const provider of ["itch", "steam", "googlePlay"]) {
    if (!Array.isArray(value.projects?.[provider])) throw new Error(`Public stats projects.${provider} must be an array.`);
  }
  return value;
}

export function assertHistory(value) {
  assertNoSensitivePublicData(value, "public history");
  if (!value || typeof value !== "object" || value.schemaVersion !== PUBLIC_STATS_SCHEMA_VERSION || !Array.isArray(value.snapshots)) {
    throw new Error("Public stats history must be a versioned snapshots object.");
  }
  const seen = new Set();
  for (const snapshot of value.snapshots) {
    if (Number.isNaN(Date.parse(snapshot?.capturedAt))) throw new Error("Marketplace history contains an invalid capturedAt timestamp.");
    if (seen.has(snapshot.capturedAt)) throw new Error("Marketplace history contains duplicate capturedAt timestamps.");
    seen.add(snapshot.capturedAt);
    const countPaths = [
      ["itch.views", snapshot.itch?.views], ["itch.downloads", snapshot.itch?.downloads], ["itch.purchases", snapshot.itch?.purchases],
      ["steam.netUnits", snapshot.steam?.netUnits], ["googlePlay.netPaidAppPurchases", snapshot.googlePlay?.netPaidAppPurchases], ["combined.paidUnits", snapshot.combined?.paidUnits],
    ];
    for (const [label, count] of countPaths) {
      if (!Number.isInteger(count) || count < 0) throw new Error(`Marketplace history ${label} must be a non-negative integer.`);
    }
  }
  return value;
}

export function projectMappings(projects = []) {
  const maps = { itch: new Map(), steam: new Map(), googlePlay: new Map() };
  for (const project of projects) {
    if (!project || typeof project !== "object" || typeof project.title !== "string") continue;
    for (const link of Array.isArray(project.links) ? project.links : []) {
      const rawUrl = String(link?.url || "");
      try {
        const url = new URL(rawUrl);
        if (url.hostname.endsWith("itch.io")) maps.itch.set(canonicalUrl(url), project.title);
        const appId = /\/app\/(\d+)/.exec(url.pathname)?.[1];
        if (url.hostname.endsWith("steampowered.com") && appId) maps.steam.set(appId, project.title);
        const packageId = url.hostname.endsWith("play.google.com") ? url.searchParams.get("id") : null;
        if (packageId) maps.googlePlay.set(packageId, project.title);
      } catch {
        // Project URL validation is handled by the catalogue validator.
      }
    }
  }
  return maps;
}

export function canonicalUrl(url) {
  const copy = new URL(url);
  copy.search = "";
  copy.hash = "";
  copy.pathname = copy.pathname.replace(/\/+$/, "") || "/";
  return copy.toString().replace(/\/$/, "");
}

export function newSteamState() {
  return { schemaVersion: 1, changedDatesHighwatermark: "0", daily: {} };
}

export function sanitizeSteamState(state) {
  const result = newSteamState();
  if (!state || typeof state !== "object") return result;
  result.changedDatesHighwatermark = String(state.changedDatesHighwatermark || "0");
  for (const [date, appTotals] of Object.entries(state.daily || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !appTotals || typeof appTotals !== "object") continue;
    result.daily[date] = {};
    for (const [appId, values] of Object.entries(appTotals)) {
      if (!/^\d+$/.test(appId)) continue;
      result.daily[date][appId] = {
        grossUnits: nonNegativeInteger(values?.grossUnits),
        returnedUnits: nonNegativeInteger(values?.returnedUnits),
        netUnits: finiteInteger(values?.netUnits),
      };
    }
  }
  return result;
}

export function marketplaceChanges(previous, totals) {
  const before = previous || { itch: {}, steam: {}, googlePlay: {}, combined: {} };
  const deltaGroup = (current, old = {}) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, value - (old[key] || 0)]));
  return {
    itch: deltaGroup(totals.itch, before.itch),
    steam: { netUnits: totals.steam.netUnits - (before.steam?.netUnits || 0) },
    googlePlay: { netPaidAppPurchases: totals.googlePlay.netPaidAppPurchases - (before.googlePlay?.netPaidAppPurchases || 0) },
    combined: { paidUnits: totals.combined.paidUnits - (before.combined?.paidUnits || 0) },
  };
}

export function equivalentMarketplaceSnapshot(previous, next) {
  return Boolean(previous) && JSON.stringify({ ...previous, capturedAt: "" }) === JSON.stringify({ ...next, capturedAt: "" });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

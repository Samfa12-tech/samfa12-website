import { readFile } from "node:fs/promises";
import path from "node:path";

export const CLARITY_ENDPOINT = "https://www.clarity.ms/export-data/api/v1/project-live-insights";
export const CLOUDFLARE_GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
export const CLOUDFLARE_ZONES_ENDPOINT = "https://api.cloudflare.com/client/v4/zones";

const CLOUDFLARE_QUERY = `
  query Samfa12Analytics(
    $zoneTag: string
    $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject
  ) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        daily: httpRequestsAdaptiveGroups(filter: $filter, limit: 1000) {
          count
          sum { visits }
          dimensions { datetimeHour }
        }
        topPaths: httpRequestsAdaptiveGroups(
          filter: $filter
          limit: 100
          orderBy: [count_DESC]
        ) {
          count
          sum { visits }
          dimensions { clientRequestPath }
        }
        devices: httpRequestsAdaptiveGroups(
          filter: $filter
          limit: 20
          orderBy: [count_DESC]
        ) {
          count
          sum { visits }
          dimensions { clientDeviceType }
        }
        statuses: httpRequestsAdaptiveGroups(
          filter: $filter
          limit: 100
          orderBy: [count_DESC]
        ) {
          count
          dimensions { edgeResponseStatus }
        }
      }
    }
  }
`;

export async function loadAnalyticsConfig({ cwd = process.cwd(), env = process.env } = {}) {
  let fileValues = {};
  const envPath = path.join(cwd, ".env.analytics");
  try {
    fileValues = parseEnvFile(await readFile(envPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const value = (name, fallback = "") => env[name] || fileValues[name] || fallback;
  return {
    clarityApiToken: value("CLARITY_API_TOKEN"),
    cloudflareApiToken: value("CLOUDFLARE_API_TOKEN"),
    cloudflareZoneId: value("CLOUDFLARE_ZONE_ID"),
    hostname: value("ANALYTICS_HOSTNAME", "samfa12.com").trim().toLowerCase(),
    lookbackDays: boundedInteger(value("CLOUDFLARE_LOOKBACK_DAYS", "8"), 1, 8, 8),
    envPath,
  };
}

export function validateAnalyticsConfig(config) {
  const missing = [];
  if (!config.clarityApiToken) missing.push("CLARITY_API_TOKEN");
  if (!config.cloudflareApiToken) missing.push("CLOUDFLARE_API_TOKEN");
  if (!config.hostname) missing.push("ANALYTICS_HOSTNAME");
  return missing;
}

export async function collectClarity({ apiToken, days = 1, fetchImpl = fetch }) {
  const numOfDays = boundedInteger(days, 1, 3, 1);
  const url = new URL(CLARITY_ENDPOINT);
  url.searchParams.set("numOfDays", String(numOfDays));
  url.searchParams.set("dimension1", "URL");
  url.searchParams.set("dimension2", "Device");
  url.searchParams.set("dimension3", "Source");

  const payload = await requestJson({
    fetchImpl,
    url,
    label: "Clarity",
    options: { headers: { Authorization: `Bearer ${apiToken}`, Accept: "application/json" } },
  });
  return {
    lookbackDays: numOfDays,
    dimensions: ["URL", "Device", "Source"],
    metrics: sanitizeAggregateData(payload),
  };
}

export async function collectCloudflare({
  apiToken,
  zoneId,
  hostname,
  lookbackDays = 8,
  now = new Date(),
  fetchImpl = fetch,
}) {
  const resolvedZoneId = zoneId || await resolveCloudflareZoneId({ apiToken, hostname, fetchImpl });
  const end = new Date(now);
  const boundarySafetyMilliseconds = 300_000;
  const start = new Date(
    end.getTime()
      - boundedInteger(lookbackDays, 1, 8, 8) * 86_400_000
      + boundarySafetyMilliseconds
  );
  const slices = [];
  for (let sliceStart = start; sliceStart < end; sliceStart = new Date(sliceStart.getTime() + 86_400_000)) {
    const sliceEnd = new Date(Math.min(end.getTime(), sliceStart.getTime() + 86_400_000));
    slices.push({ start: sliceStart, end: sliceEnd });
  }
  const zones = await Promise.all(slices.map(({ start: sliceStart, end: sliceEnd }) =>
    queryCloudflareRange({
      apiToken,
      zoneId: resolvedZoneId,
      hostname,
      start: sliceStart,
      end: sliceEnd,
      fetchImpl,
    })
  ));
  const zone = {
    daily: zones.flatMap((item) => item.daily || []),
    topPaths: zones.flatMap((item) => item.topPaths || []),
    devices: zones.flatMap((item) => item.devices || []),
    statuses: zones.flatMap((item) => item.statuses || []),
  };

  return {
    hostname,
    zoneId: resolvedZoneId,
    range: { start: start.toISOString(), end: end.toISOString() },
    daily: normalizeCloudflareDaily(zone.daily),
    topPaths: normalizeCloudflarePaths(zone.topPaths),
    devices: normalizeCloudflareDevices(zone.devices),
    statuses: normalizeCloudflareStatuses(zone.statuses),
  };
}

export async function resolveCloudflareZoneId({ apiToken, hostname, fetchImpl = fetch }) {
  const url = new URL(CLOUDFLARE_ZONES_ENDPOINT);
  url.searchParams.set("name", hostname);
  url.searchParams.set("status", "active");
  url.searchParams.set("per_page", "5");
  const payload = await requestJson({
    fetchImpl,
    url,
    label: "Cloudflare zone lookup",
    options: { headers: { Authorization: `Bearer ${apiToken}`, Accept: "application/json" } },
  });
  if (payload.success === false) {
    throw new Error(`Cloudflare zone lookup failed: ${formatApiErrors(payload.errors)}`);
  }
  const exact = payload.result?.find((zone) => zone.name?.toLowerCase() === hostname.toLowerCase());
  if (!exact?.id) {
    throw new Error(`Cloudflare could not find an active ${hostname} zone available to this token.`);
  }
  return exact.id;
}

export function normalizeCloudflareDaily(rows = []) {
  const byDate = new Map();
  for (const row of rows || []) {
    const date = String(row.dimensions?.datetimeHour || "").slice(0, 10);
    if (!date) continue;
    const current = byDate.get(date) || { date, requests: 0, visits: 0 };
    current.requests += numeric(row.count);
    current.visits += numeric(row.sum?.visits);
    byDate.set(date, current);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeCloudflarePaths(rows = []) {
  const byPath = new Map();
  for (const row of rows || []) {
    const pagePath = safePath(row.dimensions?.clientRequestPath);
    if (!isLikelyPagePath(pagePath)) continue;
    const current = byPath.get(pagePath) || { path: pagePath, requests: 0, visits: 0 };
    current.requests += numeric(row.count);
    current.visits += numeric(row.sum?.visits);
    byPath.set(pagePath, current);
  }
  return [...byPath.values()]
    .sort((a, b) => b.visits - a.visits || b.requests - a.requests)
    .slice(0, 30);
}

export function normalizeCloudflareDevices(rows = []) {
  const byDevice = new Map();
  for (const row of rows || []) {
    const device = String(row.dimensions?.clientDeviceType || "unknown").toLowerCase();
    const current = byDevice.get(device) || { device, requests: 0, visits: 0 };
    current.requests += numeric(row.count);
    current.visits += numeric(row.sum?.visits);
    byDevice.set(device, current);
  }
  return [...byDevice.values()]
    .sort((a, b) => b.visits - a.visits || b.requests - a.requests);
}

export function normalizeCloudflareStatuses(rows = []) {
  const groups = new Map();
  for (const row of rows || []) {
    const status = numeric(row.dimensions?.edgeResponseStatus);
    const family = status >= 100 ? `${Math.floor(status / 100)}xx` : "unknown";
    groups.set(family, (groups.get(family) || 0) + numeric(row.count));
  }
  return [...groups.entries()]
    .map(([status, requests]) => ({ status, requests }))
    .sort((a, b) => a.status.localeCompare(b.status));
}

export function summarizeClarity(metrics = []) {
  const result = [];
  for (const metric of Array.isArray(metrics) ? metrics : []) {
    const name = String(metric.metricName || "Unknown metric");
    const rows = Array.isArray(metric.information) ? metric.information : [];
    const countKeys = new Set();
    let total = 0;
    for (const row of rows) {
      for (const [key, value] of Object.entries(row || {})) {
        if (/count$/i.test(key) && !/bot/i.test(key) && Number.isFinite(Number(value))) {
          countKeys.add(key);
          total += Number(value);
        }
      }
    }
    result.push({ name, total, countKeys: [...countKeys].sort(), rows: rows.slice(0, 10) });
  }
  return result;
}

export function buildAnalyticsReport(snapshots, { generatedAt = new Date() } = {}) {
  if (!snapshots.length) return "# Samfa12 analytics report\n\nNo analytics snapshots are available yet.\n";
  const latest = [...snapshots]
    .sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)))
    .at(-1);
  const daily = mergeSnapshotDaily(snapshots);
  const currentRows = daily.slice(-7);
  const previousRows = daily.slice(-14, -7);
  const current = sumDaily(currentRows);
  const previous = sumDaily(previousRows);
  const claritySummary = summarizeClarity(latest.clarity?.metrics);
  const actions = recommendationLines({ latest, current, previous, claritySummary });

  const lines = [
    "# Samfa12 analytics report",
    "",
    `Generated: ${generatedAt.toISOString()}`,
    `Latest snapshot: ${latest.capturedAt}`,
    "",
    "This report contains aggregate data only. Clarity represents consenting visitors; Cloudflare is the traffic baseline.",
    "",
    "## Traffic",
    "",
    "| Period | Visits | Requests |",
    "| --- | ---: | ---: |",
    `| Latest ${Math.min(7, daily.length)} days | ${formatNumber(current.visits)} | ${formatNumber(current.requests)} |`,
    `| Previous ${Math.min(7, Math.max(0, daily.length - 7))} days | ${formatNumber(previous.visits)} | ${formatNumber(previous.requests)} |`,
    "",
    trendSentence("Visits", current.visits, previous.visits, currentRows.length, previousRows.length),
    "",
    "## Top pages",
    "",
    "| Path | Visits | Requests |",
    "| --- | ---: | ---: |",
    ...(latest.cloudflare?.topPaths || []).slice(0, 12).map((row) =>
      `| ${escapeTable(row.path)} | ${formatNumber(row.visits)} | ${formatNumber(row.requests)} |`
    ),
    "",
    "## Devices",
    "",
    "| Device | Visits | Requests |",
    "| --- | ---: | ---: |",
    ...(latest.cloudflare?.devices || []).map((row) =>
      `| ${escapeTable(row.device)} | ${formatNumber(row.visits)} | ${formatNumber(row.requests)} |`
    ),
    "",
    "## Clarity signals",
    "",
    "| Metric | Aggregate count fields | Total |",
    "| --- | --- | ---: |",
    ...claritySummary.filter((metric) => metric.countKeys.length).map((metric) =>
      `| ${escapeTable(metric.name)} | ${escapeTable(metric.countKeys.join(", "))} | ${formatNumber(metric.total)} |`
    ),
    "",
    "## Suggested actions",
    "",
    ...actions.map((action) => `- ${action}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function recommendationLines({ latest, current, previous, claritySummary }) {
  const actions = [];
  const statuses = latest.cloudflare?.statuses || [];
  const fourHundreds = statuses.find((row) => row.status === "4xx")?.requests || 0;
  const fiveHundreds = statuses.find((row) => row.status === "5xx")?.requests || 0;
  if (fiveHundreds > 0) {
    actions.push(`Cloudflare recorded ${formatNumber(fiveHundreds)} 5xx requests. Check whether they recur before attributing them to a specific page or app.`);
  }
  if (fourHundreds > 0) {
    actions.push(`Cloudflare recorded ${formatNumber(fourHundreds)} 4xx requests across all edge traffic; bots, probes, and missing assets may be included, so treat this as a triage signal rather than proof of broken public pages.`);
  }
  const devices = latest.cloudflare?.devices || [];
  const mobileVisits = devices.find((row) => row.device === "mobile")?.visits || 0;
  const desktopVisits = devices.find((row) => row.device === "desktop")?.visits || 0;
  if (mobileVisits + desktopVisits > 0 && mobileVisits / (mobileVisits + desktopVisits) >= 0.4) {
    actions.push("Mobile accounts for at least 40% of measured visits; validate important navigation and hosted-app launch paths on mobile before desktop-only refinements.");
  }
  if (!claritySummary.some((metric) => metric.rows.length)) {
    actions.push("Clarity returned no consenting-visitor rows for this snapshot, so do not infer heatmap or interaction behaviour yet.");
  }
  const frictionRules = [
    [/rage click/i, "Review the URLs producing rage clicks for controls that look clickable but do not respond."],
    [/dead click|error click/i, "Check dead/error-click pages for unclear links, overlays, or broken controls."],
    [/script error/i, "Reproduce script errors on the affected URL and device combinations."],
    [/quickback/i, "Check quick-back landing pages for a mismatch between referral promise and visible content."],
    [/excessive scroll/i, "Improve navigation or page structure where excessive scrolling is concentrated."],
  ];
  for (const [pattern, message] of frictionRules) {
    if (claritySummary.some((metric) => pattern.test(metric.name) && metric.total > 0)) actions.push(message);
  }
  if (previous.visits > 0 && current.visits < previous.visits * 0.75) {
    actions.push("Traffic visits fell by more than 25%; compare top paths and recent release/referral activity before changing the homepage.");
  }
  if (!actions.length) {
    actions.push("No high-confidence issue crossed the automatic thresholds; review the top-page mix and Clarity URL breakdown before making design changes.");
  }
  return [...new Set(actions)];
}

function sumDaily(rows) {
  return rows.reduce((totals, row) => ({
    requests: totals.requests + numeric(row.requests),
    visits: totals.visits + numeric(row.visits),
  }), { requests: 0, visits: 0 });
}

function mergeSnapshotDaily(snapshots) {
  const byDate = new Map();
  for (const snapshot of [...snapshots].sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)))) {
    for (const row of snapshot.cloudflare?.daily || []) {
      const current = byDate.get(row.date) || { date: row.date, requests: 0, visits: 0 };
      byDate.set(row.date, {
        date: row.date,
        requests: Math.max(numeric(current.requests), numeric(row.requests)),
        visits: Math.max(numeric(current.visits), numeric(row.visits)),
      });
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function trendSentence(label, current, previous, currentDays, previousDays) {
  if (!previous || currentDays !== previousDays) {
    return `${label}: a like-for-like seven-day comparison will appear after enough daily snapshots have accumulated.`;
  }
  const change = ((current - previous) / previous) * 100;
  return `${label}: ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}% versus the previous period.`;
}

function sanitizeAggregateData(value, key = "") {
  if (Array.isArray(value)) return value.map((item) => sanitizeAggregateData(item, key));
  if (!value || typeof value !== "object") {
    return /url/i.test(key) && typeof value === "string" ? stripUrlQuery(value) : value;
  }
  return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
    childKey,
    sanitizeAggregateData(childValue, childKey),
  ]));
}

function stripUrlQuery(value) {
  try {
    const parsed = new URL(value, "https://samfa12.com");
    return parsed.origin === "https://samfa12.com" ? parsed.pathname : `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(value).split(/[?#]/, 1)[0];
  }
}

function safePath(value) {
  const raw = String(value || "/");
  return raw.startsWith("/") ? raw.split(/[?#]/, 1)[0] : `/${raw.split(/[?#]/, 1)[0]}`;
}

function isLikelyPagePath(value) {
  if (!value || value.startsWith("/cdn-cgi/")) return false;
  const lastSegment = value.split("/").at(-1) || "";
  return !lastSegment.includes(".") || /\.html?$/i.test(lastSegment);
}

function parseEnvFile(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return values;
}

async function requestJson({ fetchImpl, url, options = {}, label, attempts = 3 }) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, options);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
      await delay(200 * (2 ** (attempt - 1)));
      continue;
    }
    if (isRetryableStatus(response.status) && attempt < attempts) {
      await response.text();
      await delay(200 * (2 ** (attempt - 1)));
      continue;
    }
    return await readJsonResponse(response, label);
  }
  throw lastError;
}

function isRetryableStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readJsonResponse(response, label) {
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label} returned non-JSON data (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const detail = formatApiErrors(payload?.errors) || payload?.message || response.statusText;
    throw new Error(`${label} request failed (HTTP ${response.status}): ${detail}`);
  }
  return payload;
}

function formatApiErrors(errors) {
  return Array.isArray(errors) ? errors.map((error) => error?.message || String(error)).join("; ") : "";
}

function boundedInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value) {
  return Math.round(numeric(value)).toLocaleString("en-AU");
}

function escapeTable(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

async function queryCloudflareRange({ apiToken, zoneId, hostname, start, end, fetchImpl }) {
  const filter = {
    datetime_geq: start.toISOString(),
    datetime_leq: end.toISOString(),
    clientRequestHTTPHost: hostname,
    requestSource: "eyeball",
  };
  const payload = await requestJson({
    fetchImpl,
    url: CLOUDFLARE_GRAPHQL_ENDPOINT,
    label: "Cloudflare",
    options: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: CLOUDFLARE_QUERY, variables: { zoneTag: zoneId, filter } }),
    },
  });
  if (payload.errors?.length) {
    throw new Error(`Cloudflare GraphQL error: ${payload.errors.map((item) => item.message).join("; ")}`);
  }
  const zone = payload.data?.viewer?.zones?.[0];
  if (!zone) throw new Error("Cloudflare returned no analytics zone data.");
  return zone;
}

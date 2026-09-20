import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DAY = 86_400_000;
const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const GAME_PATH = '/games/briarhold/play/';
const QUERY = `query BriarholdPageLoads($zoneTag: string, $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject) {
  viewer { zones(filter: { zoneTag: $zoneTag }) {
    pageLoads: httpRequestsAdaptiveGroups(filter: $filter, limit: 1) { count }
  } }
}`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function dailyCount({ apiToken, zoneId, filter, fetchImpl, sleep }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { zoneTag: zoneId, filter } }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      if (attempt === 2) throw new Error('Cloudflare analytics network request failed.');
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw new Error(describeCloudflareHttpFailure(response.status));
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`Cloudflare API response failure: expected JSON (HTTP ${response.status}).`);
    }
    if (payload?.errors?.length) throw new Error(describeCloudflareGraphqlFailure(payload.errors));
    const zones = payload?.data?.viewer?.zones;
    const rows = zones?.[0]?.pageLoads;
    if (!Array.isArray(zones) || zones.length !== 1) {
      throw new Error('Cloudflare API response failure: expected exactly one accessible analytics zone.');
    }
    if (!Array.isArray(rows) || rows.length > 1) {
      throw new Error('Cloudflare API response failure: game-page dataset was incomplete.');
    }
    const count = rows.length ? rows[0]?.count : 0;
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid Cloudflare game-page count.');
    return count;
  }
}

// Independent of the opt-in Clarity sample and the collector's truncated topPaths list.
export async function collectBriarholdBrowserStats({
  apiToken, zoneId, hostname = 'samfa12.com', now = new Date(), fetchImpl = fetch, sleep = delay,
}) {
  if (!apiToken) throw new Error('Missing CLOUDFLARE_API_TOKEN. Set the GitHub Actions secret or the ignored local .env.analytics value.');
  if (!zoneId) throw new Error('Missing CLOUDFLARE_ZONE_ID. Set the GitHub Actions variable or secret, or allow automatic lookup with Zone > Zone > Read.');
  if (hostname !== 'samfa12.com') throw new Error('Briarhold statistics must use samfa12.com.');
  const capturedAt = new Date(now);
  if (!Number.isFinite(+capturedAt)) throw new Error('Invalid collection date.');
  const end = Date.UTC(capturedAt.getUTCFullYear(), capturedAt.getUTCMonth(), capturedAt.getUTCDate());
  const start = end - 7 * DAY;
  let count = 0;
  // Seven complete UTC days fit inside the existing zone's eight-day retention.
  // Half-open, one-day queries neither overlap nor include a partial current day.
  for (let cursor = start; cursor < end; cursor += DAY) {
    count += await dailyCount({ apiToken, zoneId, fetchImpl, sleep, filter: {
      datetime_geq: new Date(cursor).toISOString(),
      datetime_lt: new Date(cursor + DAY).toISOString(),
      clientRequestHTTPHost: hostname,
      clientRequestPath_in: [GAME_PATH, `${GAME_PATH}index.html`],
      clientRequestHTTPMethodName: 'GET',
      requestSource: 'eyeball',
      edgeResponseStatus_in: [200, 304],
    } });
    if (!Number.isSafeInteger(count)) throw new Error('Combined game-page count is too large.');
  }
  return {
    schemaVersion: 1, status: 'ok', source: 'Cloudflare', hostname,
    path: GAME_PATH, metric: 'game-page-requests', count,
    updatedAt: capturedAt.toISOString(),
    period: { start: new Date(start).toISOString(), end: new Date(end).toISOString(), timeZone: 'UTC' },
  };
}

export async function updateBriarholdBrowserStats({ cwd = process.cwd(), ...options }) {
  // Fetch and validate all days BEFORE touching the last published snapshot.
  const snapshot = await collectBriarholdBrowserStats(options);
  const directory = path.join(cwd, 'data');
  const target = path.join(directory, 'briarhold-browser-stats.json');
  const temporary = `${target}.${process.pid}.tmp`;
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    await rename(temporary, target);
  } finally { await rm(temporary, { force: true }); }
  return snapshot;
}

// Reuse the existing private .env.analytics loader and zone lookup. No Clarity
// token is needed for this command; no token or zone ID enters the public JSON.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { loadAnalyticsConfig, resolveCloudflareZoneId } = await import('./analytics-core.mjs');
    const config = await loadAnalyticsConfig();
    if (!config.cloudflareApiToken) throw new Error('Missing CLOUDFLARE_API_TOKEN. Set the GitHub Actions secret or the ignored local .env.analytics value.');
    let zoneId = config.cloudflareZoneId;
    if (!zoneId) {
      try {
        zoneId = await resolveCloudflareZoneId({ apiToken: config.cloudflareApiToken, hostname: config.hostname });
      } catch (error) {
        throw new Error(describeZoneLookupFailure(error));
      }
    }
    const snapshot = await updateBriarholdBrowserStats({ apiToken: config.cloudflareApiToken, zoneId, hostname: config.hostname });
    console.log(`Published ${snapshot.count} estimated browser plays for ${snapshot.period.start} to ${snapshot.period.end} (end exclusive).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function describeCloudflareHttpFailure(status) {
  if (status === 401) return 'Cloudflare authentication failure (HTTP 401). Verify CLOUDFLARE_API_TOKEN is valid and unexpired.';
  if (status === 403) return 'Cloudflare permission failure (HTTP 403). The token cannot read the requested analytics resource; check the documented read-only permissions and samfa12.com zone scope.';
  return `Cloudflare API response failure (HTTP ${status}). Check the provider response, query limits and retention window.`;
}

function describeCloudflareGraphqlFailure(errors) {
  const messages = errors.map((error) => String(error?.message || '')).join('; ');
  if (/401|unauthor|invalid token|authentication/i.test(messages)) {
    return 'Cloudflare authentication failure in the GraphQL response. Verify CLOUDFLARE_API_TOKEN is valid and unexpired.';
  }
  if (/403|forbidden|permission|not authorized|access denied|cannot access/i.test(messages)) {
    return 'Cloudflare permission failure in the GraphQL response. Check the documented read-only permissions and samfa12.com zone scope.';
  }
  return messages
    ? `Cloudflare GraphQL response failure: ${messages}`
    : 'Cloudflare GraphQL response failure: the provider returned an error without details.';
}

function describeZoneLookupFailure(error) {
  const message = String(error?.message || '');
  if (/401|unauthor|invalid token|authentication/i.test(message)) {
    return 'Cloudflare authentication failure while resolving CLOUDFLARE_ZONE_ID. Verify CLOUDFLARE_API_TOKEN is valid and unexpired.';
  }
  if (/403|forbidden|permission|not authorized|access denied/i.test(message)) {
    return 'Cloudflare permission failure while resolving CLOUDFLARE_ZONE_ID. Set the ID explicitly or grant Zone > Zone > Read to the read-only token.';
  }
  if (/could not find an active/i.test(message)) {
    return 'Missing or inaccessible CLOUDFLARE_ZONE_ID. Set the GitHub Actions variable or secret to the active samfa12.com zone ID.';
  }
  return `Cloudflare zone lookup failure while resolving CLOUDFLARE_ZONE_ID: ${message || 'provider returned no details.'}`;
}

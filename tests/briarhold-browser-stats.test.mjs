import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const moduleUrl = new URL('../scripts/briarhold-browser-stats.mjs', import.meta.url);
const clientUrl = new URL('../briarhold-browser-stats.js', import.meta.url);
const now = new Date('2026-09-14T03:00:00Z');
const base = { apiToken: 'private-test-token', zoneId: 'zone-test', now, sleep: async () => {} };
const ok = (rows = [{ count: 2 }]) => ({ ok: true, json: async () => ({ data: { viewer: { zones: [{ pageLoads: rows }] } } }) });
const sample = {
  schemaVersion: 1, status: 'ok', source: 'Cloudflare',
  hostname: 'samfa12.com', path: '/games/briarhold/play/', metric: 'game-page-requests',
  count: 1234, updatedAt: now.toISOString(),
  period: { start: '2026-09-07T00:00:00.000Z', end: '2026-09-14T00:00:00.000Z', timeZone: 'UTC' },
};
const load = async () => {
  assert.ok(existsSync(moduleUrl), 'A browser-page collector must be implemented');
  return import(moduleUrl.href);
};

test('collects seven complete, non-overlapping UTC days of successful game-page GETs', async () => {
  const { collectBriarholdBrowserStats } = await load();
  const calls = [];
  const result = await collectBriarholdBrowserStats({ ...base, fetchImpl: async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return ok();
  } });
  assert.equal(result.count, 14);
  assert.deepEqual(result.period, sample.period);
  assert.equal(calls.length, 7);
  for (let i = 0; i < calls.length; i++) {
    const { url, options, body } = calls[i];
    assert.equal(url, 'https://api.cloudflare.com/client/v4/graphql');
    assert.equal(options.headers.Authorization, 'Bearer private-test-token');
    assert.equal(body.variables.filter.clientRequestHTTPHost, 'samfa12.com');
    assert.deepEqual(body.variables.filter.clientRequestPath_in, ['/games/briarhold/play/', '/games/briarhold/play/index.html']);
    assert.equal(body.variables.filter.clientRequestHTTPMethodName, 'GET');
    assert.equal(body.variables.filter.requestSource, 'eyeball');
    assert.deepEqual(body.variables.filter.edgeResponseStatus_in, [200, 304]);
    assert.doesNotMatch(body.query, /sum\s*\{|visits|topPaths/);
    assert.equal(Date.parse(body.variables.filter.datetime_lt) - Date.parse(body.variables.filter.datetime_geq), 86400000);
    if (i) assert.equal(body.variables.filter.datetime_geq, calls[i - 1].body.variables.filter.datetime_lt);
  }
  assert.doesNotMatch(JSON.stringify(result), /private-test-token|zone-test|Authorization/);
});

test('a verified empty result is a real zero, not missing data', async () => {
  const { collectBriarholdBrowserStats } = await load();
  assert.equal((await collectBriarholdBrowserStats({ ...base, fetchImpl: async () => ok([]) })).count, 0);
});

for (const [name, response] of [
  ['missing zone', { ok: true, json: async () => ({ data: { viewer: { zones: [] } } }) }],
  ['missing dataset', { ok: true, json: async () => ({ data: { viewer: { zones: [{}] } } }) }],
  ['GraphQL error with HTTP 200', { ok: true, json: async () => ({ errors: [{ message: 'restricted' }] }) }],
  ['negative count', ok([{ count: -1 }])],
  ['string count', ok([{ count: '1' }])],
  ['fractional count', ok([{ count: 1.5 }])],
  ['unexpected multiple totals', ok([{ count: 1 }, { count: 2 }])],
  ['overflow', ok([{ count: Number.MAX_SAFE_INTEGER }])],
]) {
  test(`rejects ${name} without publishing a partial total`, async () => {
    const { collectBriarholdBrowserStats } = await load();
    await assert.rejects(collectBriarholdBrowserStats({ ...base, fetchImpl: async () => response }));
  });
}

test('retries transient failures but not authentication failures', async () => {
  const { collectBriarholdBrowserStats } = await load();
  let calls = 0;
  const result = await collectBriarholdBrowserStats({ ...base, fetchImpl: async () => ++calls === 1 ? { ok: false, status: 429 } : ok() });
  assert.equal(result.count, 14);
  assert.equal(calls, 8);
  calls = 0;
  await assert.rejects(collectBriarholdBrowserStats({ ...base, fetchImpl: async () => { calls++; return { ok: false, status: 403 }; } }));
  assert.equal(calls, 1);
});

test('distinguishes missing configuration and Cloudflare access failures', async () => {
  const { collectBriarholdBrowserStats } = await load();
  await assert.rejects(
    collectBriarholdBrowserStats({ ...base, apiToken: '' }),
    /Missing CLOUDFLARE_API_TOKEN/
  );
  await assert.rejects(
    collectBriarholdBrowserStats({ ...base, zoneId: '' }),
    /Missing CLOUDFLARE_ZONE_ID/
  );
  await assert.rejects(
    collectBriarholdBrowserStats({ ...base, fetchImpl: async () => ({ ok: false, status: 401 }) }),
    /authentication failure.*401/i
  );
  await assert.rejects(
    collectBriarholdBrowserStats({ ...base, fetchImpl: async () => ({ ok: false, status: 403 }) }),
    /permission failure.*403/i
  );
  await assert.rejects(
    collectBriarholdBrowserStats({ ...base, fetchImpl: async () => ({ ok: true, json: async () => ({ errors: [{ message: 'field not available' }] }) }) }),
    /GraphQL response failure: field not available/
  );
});

test('does not overwrite the last good file when any daily query fails', async () => {
  const { updateBriarholdBrowserStats } = await load();
  const cwd = await mkdtemp(path.join(tmpdir(), 'briarhold-stats-'));
  try {
    await mkdir(path.join(cwd, 'data'));
    const file = path.join(cwd, 'data/briarhold-browser-stats.json');
    await writeFile(file, JSON.stringify(sample));
    let calls = 0;
    await assert.rejects(updateBriarholdBrowserStats({ ...base, cwd, fetchImpl: async () => ++calls === 4 ? { ok: false, status: 403 } : ok() }));
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), sample);
    const result = await updateBriarholdBrowserStats({ ...base, cwd, fetchImpl: async () => ok() });
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), result);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

async function render(data = sample, { fail = false, date = now, missing = false } = {}) {
  assert.ok(existsSync(clientUrl), 'The browser counter reader must be implemented');
  const count = { textContent: '—' };
  const status = { textContent: 'Awaiting first analytics update.' };
  const calls = [];
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [date])); } static now() { return +date; } }
  await vm.runInNewContext(readFileSync(clientUrl, 'utf8'), {
    document: { querySelector: (selector) => missing ? null : selector === '[data-briarhold-browser-count]' ? count : status },
    fetch: async (url, options) => { calls.push({ url, options }); if (fail) throw new Error('offline'); return { ok: true, json: async () => data }; },
    AbortController, setTimeout, clearTimeout, Intl, Date: Clock,
  });
  return { count: count.textContent, status: status.textContent, calls };
}

test('renders a formatted total with explicit UTC coverage and update date', async () => {
  const result = await render();
  assert.equal(result.count, '1,234');
  assert.match(result.status, /7 Sept? 2026.*13 Sept? 2026.*UTC/);
  assert.match(result.status, /Updated 14 Sept? 2026/);
  assert.equal(result.calls[0].url, '/data/briarhold-browser-stats.json');
  assert.equal(result.calls[0].options.credentials, 'omit');
});

test('renders confirmed zero and leaves unavailable data as a dash', async () => {
  assert.equal((await render({ ...sample, count: 0 })).count, '0');
  assert.equal((await render({ schemaVersion: 1, status: 'pending', count: null })).count, '—');
  assert.equal((await render(sample, { fail: true })).count, '—');
});

for (const [name, data] of [
  ['invalid count', { ...sample, count: -1 }],
  ['wrong page', { ...sample, path: '/games/briarhold/' }],
  ['wrong metric', { ...sample, metric: 'visits' }],
  ['wrong hostname', { ...sample, hostname: 'other.example' }],
  ['invalid date', { ...sample, updatedAt: 'bad' }],
  ['incomplete range', { ...sample, period: { ...sample.period, end: '2026-09-13T00:00:00.000Z' } }],
  ['future range', { ...sample, period: { ...sample.period, start: '2026-09-14T00:00:00.000Z', end: '2026-09-21T00:00:00.000Z' } }],
]) {
  test(`does not display ${name} as a valid play count`, async () => { assert.equal((await render(data)).count, '—'); });
}

test('labels stale data and does nothing on pages without the counter', async () => {
  assert.match((await render(sample, { date: new Date('2026-09-20T00:00:00Z') })).status, /Update delayed/);
  assert.equal((await render(sample, { missing: true })).calls.length, 0);
});

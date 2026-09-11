import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../games/briarhold/index.html', import.meta.url), 'utf8');
const script = html.match(/<script id="briarhold-stats-script">([\s\S]*?)<\/script>/)?.[1];
const apk = (id, count, extra = {}) => ({ id, name: 'app-debug.apk', state: 'uploaded', download_count: count, ...extra });
const release = (assets, extra = {}) => ({ tag_name: 'briarhold-alpha.99', draft: false, assets, ...extra });
const ok = (data) => ({ ok: true, json: async () => data });

async function render(responses) {
  assert.ok(script, 'Briarhold needs an isolated statistics script');
  const count = { textContent: '31' };
  const status = { textContent: 'Last checked 11 Sep 2026.' };
  const calls = [];
  await vm.runInNewContext(script, {
    document: { querySelector: (selector) => selector === '[data-briarhold-android-count]' ? count : status },
    fetch: async (url, options) => {
      calls.push({ url, options });
      const response = responses[calls.length - 1];
      if (response instanceof Error) throw response;
      assert.ok(response, `Unexpected extra request: ${url}`);
      return response;
    },
    AbortController, setTimeout, clearTimeout, Intl, Date, URL,
  });
  return { count: count.textContent, status: status.textContent, calls };
}

test('shows a dated download snapshot and an honest unavailable browser-play state', () => {
  assert.match(html, /data-briarhold-android-count[^>]*>31<\/dd>/);
  assert.match(html, /Browser plays/);
  assert.match(html, /Play totals are not available yet/);
  assert.match(html, /Page views are not counted as plays/);
  assert.match(html, /Last checked 11 Sep 2026/);
});

test('sums all eight observed Briarhold APK assets, not other projects or archives', async () => {
  // GitHub Releases observed 2026-09-11: Alpha.99, .98, .97, .96, .95, .93, .92, .91.
  const rows = [5, 4, 6, 2, 5, 5, 2, 2].map((n, i) => release([apk(i + 1, n)]));
  rows.push(release([apk(9, 999)], { tag_name: 'other-game-v1' }));
  rows.push(release([apk(10, 999)], { draft: true }));
  rows.push(release([apk(11, 999, { name: 'source.zip' })]));
  rows.push(release([apk(12, 999, { state: 'new' })]));
  const result = await render([ok(rows)]);
  assert.equal(result.count, '31');
  assert.match(result.status, /Updated from GitHub/);
});

test('includes future prereleases automatically and formats large counts', async () => {
  const result = await render([ok([release([apk(1, 12345)], { tag_name: 'briarhold-alpha.100', prerelease: true })])]);
  assert.equal(result.count, '12,345');
});

test('paginates the full release list and deduplicates asset IDs', async () => {
  const first = Array.from({ length: 100 }, (_, i) => release([apk(i + 1, 2)]));
  const second = [release([apk(1, 2), apk(101, 7)])];
  const result = await render([ok(first), ok(second)]);
  assert.equal(result.count, '207');
  assert.equal(new URL(result.calls[1].url).searchParams.get('page'), '2');
  assert.equal(new URL(result.calls[0].url).searchParams.get('per_page'), '100');
});

test('preserves the dated snapshot when a later page fails instead of publishing a partial count', async () => {
  const first = Array.from({ length: 100 }, (_, i) => release([apk(i + 1, 2)]));
  const result = await render([ok(first), { ok: false }]);
  assert.equal(result.count, '31');
  assert.match(result.status, /Last checked 11 Sep 2026/);
  assert.match(result.status, /Live refresh unavailable/);
});

for (const [name, response] of [
  ['GitHub rate limit', { ok: false }],
  ['network failure', new Error('offline')],
  ['invalid JSON shape', ok({ message: 'not releases' })],
  ['missing assets array', ok([release(null)])],
  ['invalid counter type', ok([release([apk(1, '4')])])],
  ['negative counter', ok([release([apk(1, -1)])])],
  ['non-integer counter', ok([release([apk(1, 1.5)])])],
  ['unsafe total', ok([release([apk(1, Number.MAX_SAFE_INTEGER), apk(2, 1)])])],
  ['empty response', ok([])],
]) {
  test(`keeps the verified fallback on ${name}`, async () => {
    const result = await render([response]);
    assert.equal(result.count, '31');
    assert.match(result.status, /Live refresh unavailable/);
  });
}

test('a real zero is valid when GitHub supplies an APK with zero downloads', async () => {
  assert.equal((await render([ok([release([apk(1, 0)])])])).count, '0');
});

test('requests public aggregate data without credentials, referrers or tracking writes', async () => {
  const result = await render([ok([release([apk(1, 1)])])]);
  assert.equal(result.calls[0].options.credentials, 'omit');
  assert.equal(result.calls[0].options.referrerPolicy, 'no-referrer');
  assert.equal(result.calls[0].options.method ?? 'GET', 'GET');
  assert.equal(new URL(result.calls[0].url).origin, 'https://api.github.com');
  assert.doesNotMatch(script, /localStorage|sessionStorage|sendBeacon|innerHTML/);
});

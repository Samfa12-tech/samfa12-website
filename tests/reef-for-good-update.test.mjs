import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../reef-for-good/index.html', import.meta.url), 'utf8');
test('Chrome Coalition joins the November pledge without inventing a donation', () => {
  assert.match(page, /id="chrome-coalition-update-2026-11-11"/);
  assert.match(page, /href="https:\/\/wavedash\.com\/games\/chrome-coalition"/);
  assert.match(page, /<dt>Chrome Coalition<\/dt><dd>November statement pending<\/dd>/);
  assert.doesNotMatch(page, /four-game breakdown|across all four of my games/);
  assert.match(page, /No donation has been recorded yet/);
});

test('seven-day campaign activity is dated and distinct from donations', () => {
  const activity = page.match(/<section id="activity"[\s\S]*?<\/section>/)?.[0];
  assert.ok(activity);
  for (const text of ['6–12 November 2026', 'Australia/Sydney', '10:23–10:25 am AEDT', '12 November is partial', 'not a full November-to-date total', '300 plays · 19h 40m 45s', '51 plays · 1h 44m 7s', '7 plays · 8m 32s', '2 plays · 4m 17s', '0 plays · 0 playtime', '360 plays · 21h 37m 41s', 'not Creator Fund earnings or a donation amount']) assert.ok(activity.includes(text), `Missing ${text}`);
});

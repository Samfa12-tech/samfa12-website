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

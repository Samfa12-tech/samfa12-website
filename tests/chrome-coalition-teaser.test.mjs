import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const page = fs.readFileSync(new URL('../games/chrome-coalition-warlords/index.html', import.meta.url), 'utf8');

test('teaser contains only the approved title, status and image in main', () => {
  const main = page.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
  const visibleText = main.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.equal(visibleText, 'Chrome Coalition: Warlords Coming soon to Wavedash');
  assert.equal((main.match(/<img\b/g) || []).length, 1);
  assert.match(main, /src="\/assets\/chrome-coalition\/Chrome-Neon-Teaser-Loop\.gif"/);
  assert.equal((page.match(/<h1\b/g) || []).length, 1);
  assert.doesNotMatch(main, /<a\b|<button\b|<iframe\b|<video\b/);
});

test('teaser has canonical metadata and no guessed store destination', () => {
  assert.match(page, /<link rel="canonical" href="https:\/\/samfa12\.com\/games\/chrome-coalition-warlords\/">/);
  assert.match(page, /name="viewport"/);
  assert.match(page, /href="\/assets\/favicon\.png"/);
  assert.doesNotMatch(page, /https?:\/\/(?:www\.)?wavedash\.com/);
  for (const block of page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => JSON.parse(block[1]));
});

test('approved GIF has been supplied before publication', () => {
  const gifPath = new URL('../assets/chrome-coalition/Chrome-Neon-Teaser-Loop.gif', import.meta.url);
  assert.ok(fs.existsSync(gifPath), 'Save the approved teaser GIF at assets/chrome-coalition/Chrome-Neon-Teaser-Loop.gif before publication');
  const data = fs.readFileSync(gifPath);
  assert.match(data.subarray(0, 6).toString('ascii'), /^GIF8[79]a$/);
  assert.equal(data.length, 12903754, 'Use the approved, unchanged GIF');
  assert.equal(createHash('sha256').update(data).digest('hex'), '8bf16e121559cebca6379a8b9948a141eb2cecf076a8c16e6ac078d491bf3e0f');
});

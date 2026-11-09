import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const page = fs.readFileSync(new URL('../games/chrome-coalition-warlords/index.html', import.meta.url), 'utf8');
const main = page.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
const visibleText = main.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

test('landing page uses the approved title and description with development status', () => {
  assert.match(page, /<h1>Chrome Coalition<\/h1>/);
  assert.equal((page.match(/<h1\b/g) || []).length, 1);
  assert.doesNotMatch(visibleText, /Warlords|Online Destruction Shooter|Play now/i);
  for (const copy of [
    'In development · Browser FPS',
    'The AI took control. The Chrome Coalition is fighting back.',
    'Battle across a neon-lit canyon where the battlefield won’t stay the same for long.',
    'Blast through walls, carve tunnels through solid rock and find a new way into the enemy base.',
    'Just remember: your opponents can do the same.',
    'Chrome Coalition is an in-development browser FPS inspired by the chaotic multiplayer battles and destructible environments of the PS2 era.',
    'Choose a side in the fight between the human resistance and the machines, grab weapons around the map and make your own path through the battlefield.',
    'Planned multiplayer',
    'The initial target is 4v4 online multiplayer, with bots filling empty spots.',
    'Team Deathmatch, Deathmatch and Capture the Flag are planned as development progresses.',
    'Coming soon to Wavedash.'
  ]) assert.ok(visibleText.includes(copy), `Missing approved copy: ${copy}`);
  assert.match(main, /Cover artwork\. Game in development\./);
  assert.doesNotMatch(main, /<button\b|<iframe\b|<video\b/);
});

test('landing page preserves its URL and uses cover social metadata without a premature store link', () => {
  assert.match(page, /<link rel="canonical" href="https:\/\/samfa12\.com\/games\/chrome-coalition-warlords\/">/);
  assert.match(page, /name="viewport"/);
  assert.match(page, /href="\/assets\/favicon\.png"/);
  assert.doesNotMatch(page, /https?:\/\/(?:www\.)?wavedash\.com/);
  assert.match(page, /property="og:image" content="https:\/\/samfa12\.com\/assets\/chrome-coalition\/chrome-coalition-social-1200\.jpg"/);
  for (const block of page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const graph = JSON.parse(block[1])['@graph'];
    const webPage = graph.find(node => node['@type'] === 'WebPage');
    assert.equal(webPage.name, 'Chrome Coalition');
    assert.equal(webPage.dateModified, '2026-11-09');
    assert.match(webPage.description, /in-development/);
  }
  const games = fs.readFileSync(new URL('../games/index.html', import.meta.url), 'utf8');
  assert.match(games, /href="\/games\/chrome-coalition-warlords\/">Chrome Coalition<\/a>/);
});

test('approved original cover is unchanged and responsive variants are supplied', () => {
  const cover = fs.readFileSync(new URL('../assets/chrome-coalition/chrome-coalition-cover.png', import.meta.url));
  assert.equal(createHash('sha256').update(cover).digest('hex'), '1c10012100692843a5b014c1431bf00071f192cbeaf74f39cd41bd4305113dde');
  assert.equal(cover.readUInt32BE(16), 1672);
  assert.equal(cover.readUInt32BE(20), 941);
  assert.match(main, /width="1672" height="941" fetchpriority="high"/);
  assert.match(page, /\.coalition-cover img \{[^}]*width: 100%; height: auto;/);
  for (const file of ['chrome-coalition-cover.webp', 'chrome-coalition-cover-960.webp']) {
    const variant = fs.readFileSync(new URL(`../assets/chrome-coalition/${file}`, import.meta.url));
    assert.equal(variant.subarray(8, 12).toString('ascii'), 'WEBP');
    assert.ok(variant.length < 550000, 'Keep the cover lightweight for phone layouts');
    assert.ok(page.includes(file));
  }
});


test('social preview uses an absolute, compact JPEG with intact cover', () => {
  const url = 'https://samfa12.com/assets/chrome-coalition/chrome-coalition-social-1200.jpg';
  assert.ok(page.includes(`property="og:image" content="${url}"`));
  assert.ok(page.includes(`name="twitter:image" content="${url}"`));
  assert.match(page, /name="twitter:card" content="summary_large_image"/);
  assert.match(page, /property="og:image:type" content="image\/jpeg"/);
  assert.match(page, /property="og:image:width" content="1200"/);
  assert.match(page, /property="og:image:height" content="630"/);
  const image = fs.readFileSync(new URL('../assets/chrome-coalition/chrome-coalition-social-1200.jpg', import.meta.url));
  assert.equal(image.subarray(0, 3).toString('hex'), 'ffd8ff');
  assert.ok(image.length < 500000, 'Keep the social preview lightweight');
  let offset = 2, dimensions;
  while (offset < image.length) {
    assert.equal(image[offset], 0xff);
    const marker = image[offset + 1], length = image.readUInt16BE(offset + 2);
    if ([0xc0, 0xc2].includes(marker)) { dimensions = [image.readUInt16BE(offset + 7), image.readUInt16BE(offset + 5)]; break; }
    offset += 2 + length;
  }
  assert.deepEqual(dimensions, [1200, 630]);
});

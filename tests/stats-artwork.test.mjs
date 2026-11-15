import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { statsArtwork, statsThumbnail } from '../scripts/stats-artwork.mjs';
const catalogue = JSON.parse(readFileSync(new URL('../data/projects.json', import.meta.url)));
test('stats art respects game, book and soundtrack identities', () => {
 assert.equal(statsArtwork('Dust on the River','Wavedash',catalogue).projectId,'game-dust-on-the-river');
 assert.equal(statsArtwork('Dust on the River','Amazon KDP',catalogue).projectId,'book-dust-on-the-river');
 assert.equal(statsArtwork('Drink Original Soundtrack','Steam',catalogue).projectId,'music-drink-ost');
 assert.equal(statsArtwork('Chrome Coalition: Spawn Edition','Spawn',catalogue).projectId,'game-chrome-coalition');
 assert.equal(statsArtwork('Sober: A novel set in the world of Drink (Amazon)','itch.io',catalogue).projectId,'book-sober');
 assert.equal(statsArtwork('Red Line: Parkour and Surf','Spawn',catalogue).projectId,'game-red-line');
});
test('unknown or missing artwork has a graceful non-image fallback', () => {
 assert.equal(statsArtwork('Unknown','Spawn',catalogue), null);
 assert.match(statsThumbnail('Unknown','Spawn',catalogue), /stats-thumbnail-fallback/);
 assert.doesNotMatch(statsThumbnail('Unknown','Spawn',catalogue), /<img/);
 assert.match(statsThumbnail('Reef Sweep','Wavedash',catalogue), /loading="lazy"/);
 assert.match(statsThumbnail('Reef Sweep','Wavedash',catalogue), /alt="" width="64" height="64"/);
});

test('Spawn covers never substitute another edition artwork', () => {
 assert.match(statsArtwork('Chrome Coalition: Spawn Edition','Spawn',catalogue).src, /game-chrome-coalition-spawn-stats/);
 assert.notEqual(statsArtwork('Chrome Coalition: Spawn Edition','Spawn',catalogue).src,statsArtwork('Chrome Coalition','Wavedash',catalogue).src);
 assert.equal(statsArtwork('Reef Sweep','Spawn',catalogue),null);
});

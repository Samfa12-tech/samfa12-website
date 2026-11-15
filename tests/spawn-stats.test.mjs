import test from 'node:test';
import assert from 'node:assert/strict';
import { games, sanitiseNumbers, collectSpawn } from '../scripts/update-spawn-stats.mjs';
const fixture = () => ({ ok: true, data: { asOf: '2026-11-14', earnings: { secret: 'private' }, games: Object.keys(games).map(appId => ({ appId, seatOwner: 'samfa12', email: 'private', windows: { all: { plays: 3, players: 2, likes: 1 } } })) } });
test('strict allowlist excludes raw/private fields and never sums players', () => {
 const result = sanitiseNumbers(fixture(), '2026-11-15T00:00:00.000Z');
 assert.equal(result.projects.length, 6);
 assert.ok(!JSON.stringify(result).includes('private'));
 assert.equal(result.players, undefined);
 assert.equal(result.period, 'provider-all-time');
});
test('missing, duplicate and malformed coverage fail closed', () => {
 for (const mutate of [r => r.data.games.pop(), r => r.data.games.push(r.data.games[0]), r => r.data.games[0].windows.all.plays = null, r => r.data.games[0].seatOwner = 'other']) {
  const raw = fixture(); mutate(raw); assert.throws(() => sanitiseNumbers(raw));
 }
});
test('unknown games are not silently published', () => {
 const raw = fixture(); raw.data.games.push({appId:'unreviewed',seatOwner:'samfa12'});
 assert.equal(sanitiseNumbers(raw).projects.length,6);
});
test('HTTP and network errors never include credentials or response body', async () => {
 await assert.rejects(collectSpawn({ token: 'private', fetchImpl: async () => ({ok:false,status:401}) }), /HTTP 401/);
 await assert.rejects(collectSpawn({ token: 'private', fetchImpl: async () => { throw new Error('private'); } }), e => !e.message.includes('private'));
});

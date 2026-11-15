import { readFile, writeFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const games = {
 '0d62202a-8fea-415d-9176-29c61aa05958': ['The Last Guard: Spawn Edition', 'samfa12-s-the-last-guard-spawn-edition'],
 '897a32b9-03c4-48f3-bb85-bdab75c8fe3d': ['Chrome Coalition: Spawn Edition', 'samfa12-s-chrome-coalition-spawn-edition'],
 '9ed586e2-8d65-42f8-8a7d-a5d44a835297': ['Briarhold: Fortress Defence', 'samfa12-s-briarhold-fortress-defence'],
 '460aa904-7820-4cc4-8e18-00dd1161b9bd': ['Pocket Chordsmith: Spawn Edition', 'samfa12-s-pocket-chordsmith-make-music-in-spawn'],
 'a6b1f574-034a-44e7-9311-67d60169450f': ['Spin Vector: Spawn Edition', 'samfa12-s-spin-vector-spawn-edition'],
 '8706054d-b0cb-474e-ac69-ed9cf2a220ad': ['Red Line: Parkour and Surf', 'red-line-parkour-and-surf'],
};
const integer = value => {
 if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid aggregate metric; previous snapshot retained.');
 return value;
};
export function sanitiseNumbers(raw, capturedAt = new Date().toISOString()) {
 const data = raw?.data;
 if (raw?.ok !== true || !Array.isArray(data?.games) || !/^\d{4}-\d{2}-\d{2}$/.test(data.asOf || '')) throw new Error('Invalid Spawn response.');
 const seen = new Set();
 const projects = data.games.filter(game => game.seatOwner === 'samfa12' && games[game.appId]).map(game => {
  if (seen.has(game.appId)) throw new Error('Duplicate game.');
  seen.add(game.appId);
  const [title] = games[game.appId];
  return { id: game.appId, title, plays: integer(game.windows?.all?.plays), players: integer(game.windows?.all?.players), likes: integer(game.windows?.all?.likes) };
 });
 if (projects.length !== Object.keys(games).length) throw new Error('Spawn coverage changed; review before updating.');
 return { schemaVersion: 1, capturedAt, providerAsOf: data.asOf, period: 'provider-all-time', source: 'https://www.spawn.co/api/agent/v1/me/numbers', note: 'All-time figures reported by Spawn for the listed editions. Provider cut-off timezone is unconfirmed; some counters may include live activity. Players are per game, not unique people across games. No revenue or personal data is included.', projects };
}
export async function collectSpawn({ fetchImpl = fetch, token, capturedAt } = {}) {
 if (!token) throw new Error('Existing Spawn credential unavailable.');
 let response;
 try { response = await fetchImpl('https://www.spawn.co/api/agent/v1/me/numbers', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) }); }
 catch { throw new Error('Spawn request failed; previous snapshot retained.'); }
 if (!response.ok) throw new Error(`Spawn HTTP ${response.status}; previous snapshot retained.`);
 let raw;
 try { raw = await response.json(); } catch { throw new Error('Invalid Spawn JSON.'); }
 return sanitiseNumbers(raw, capturedAt);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 try {
  const token = (process.env.SPAWN_TOKEN || await readFile(process.env.SPAWN_TOKEN_FILE || path.join(homedir(), '.spawn', 'token'), 'utf8')).trim();
  const snapshot = await collectSpawn({ token });
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const target = path.join(root, 'data', 'spawn-stats.json');
  await writeFile(`${target}.tmp`, JSON.stringify(snapshot, null, 2) + '\n');
  await rename(`${target}.tmp`, target);
  console.log(`Updated sanitised Spawn snapshot (${snapshot.projects.length} editions).`);
 } catch (error) { console.error(error.code === 'ENOENT' ? 'Existing Spawn credential unavailable; previous snapshot retained.' : error.message); process.exitCode = 1; }
}

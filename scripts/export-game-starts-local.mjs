// Review export only: loopback input, fixture output under ignored output/, no credentials.
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateStartStats} from '../assets/game-starts-model.js';
const source = new URL(process.argv[2] || 'http://127.0.0.1:8029/api/game-starts/v1/stats');
if (!['127.0.0.1','localhost','[::1]'].includes(source.hostname) || source.pathname !== '/api/game-starts/v1/stats'
  || source.protocol !== 'http:' || source.username || source.password || source.search || source.hash) throw Error('Only a loopback local stats source is permitted');
const response = await fetch(source, {credentials:'omit',signal:AbortSignal.timeout(5000)});
if (!response.ok) throw Error(`Local collector unavailable (HTTP ${response.status})`);
const value=validateStartStats(await response.json());
if (!value || value.status !== 'ok') throw Error('Invalid or unavailable local aggregates');
const clean={schemaVersion:1,source:'first-party-game-starts',status:'fixture',updatedAt:value.updatedAt,
  games:value.games.map(game=>({gameId:game.gameId,trackingSince:game.trackingSince,
    daily:game.daily.map(row=>({day:row.day,starts:row.starts,coverage:row.coverage}))}))};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'output','game-starts','local-stats.json');
await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(clean,null,2)+'\n');
console.log(`Saved LOCAL FIXTURE only: ${output}`);

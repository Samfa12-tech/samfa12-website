// Disposable local review server. No provider calls, credentials, or durable files.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLocalStorage} from './game-starts-local-storage.mjs';
import {StartStore} from '../workers/game-starts/sql-store.js';
import {handleRequest, GAMES} from '../workers/game-starts/core.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.GAME_STARTS_LOCAL_PORT || 8029);
const origin = `http://127.0.0.1:${port}`;
const start = new Date().toISOString();
const env = {ENABLE_GAME_STARTS:'true',ALLOWED_ORIGIN:origin,TRACKING_STARTS:JSON.stringify(Object.fromEntries(GAMES.map(g=>[g,start])))};
const stores = new Map(GAMES.map(g=>[g,new StartStore(createLocalStorage(),g,start)]));
const server = createServer(async (req,res) => {
  try {
    const url = new URL(req.url,origin);
    if (url.pathname.startsWith('/api/game-starts/')) {
      const request = new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:req,duplex:'half'}:{})});
      const response = await handleRequest(request,env,g=>stores.get(g));
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
    }
    const destination = path.resolve(root, '.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));
    if (!destination.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
    if (url.pathname === '/data/game-start-stats.json' && url.searchParams.has('fixture')) {
      const file = await readFile(path.join(root,'tests/fixtures/game-starts/stats.json'));
      res.writeHead(200,{'Content-Type':'application/json'});res.end(file);return;
    }
    const file=await readFile(destination);
    const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
    res.writeHead(200,{'Content-Type':types[path.extname(destination)]||'application/octet-stream'});res.end(file);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local-only review server ${origin}; disposable SQLite; transmission enabled only for local mock endpoint.`));

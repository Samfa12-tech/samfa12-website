import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGameStartTracker, CONSENT_KEY} from '../assets/game-starts-client.js';
import {validateStartStats, summarizeGame} from '../assets/game-starts-model.js';
import {handleRequest, validateEvent, receiptHash, RECEIPT_MS, MINUTE_CAP} from '../workers/game-starts/core.js';
import {StartStore} from '../workers/game-starts/sql-store.js';
import {createLocalStorage} from '../scripts/game-starts-local-storage.mjs';
const at = Date.parse('2026-10-13T12:00:00.000Z');
const activation = '2026-10-06T00:00:00.000Z';
const eventId = 'b6e9307b-128a-4023-8170-b8816caa9341';
const event = (changes={}) => ({schemaVersion:1,gameId:'briarhold',eventId,startedAt:new Date(at).toISOString(),...changes});
function memoryStorage() { const data = new Map(); return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}; }
function browser(granted=true) {
  const localStorage=memoryStorage(), sessionStorage=memoryStorage(), events=new Map();
  if(granted) localStorage.setItem(CONSENT_KEY,'granted');
  return {localStorage,sessionStorage,location:new URL('http://127.0.0.1:8029/game/'),
    addEventListener:(name,cb)=>events.set(name,cb),removeEventListener:name=>events.delete(name),events};
}
function client(options={}) {
  let clock=at, calls=[];
  const windowRef=options.windowRef||browser();
  const tracker=createGameStartTracker({gameId:'briarhold',enabled:true,endpoint:'/api/game-starts/v1/start',windowRef,
    now:()=>clock,uuid:()=>eventId,timeoutSignal:()=>new AbortController().signal,
    fetchImpl:async(url,request)=>{calls.push(JSON.parse(request.body));return Response.json({schemaVersion:1,gameId:'briarhold',status:'accepted',day:'2026-10-13'});},...options});
  return {tracker,windowRef,calls,advance:ms=>{clock+=ms;}};
}
function api() {
  const storage=createLocalStorage(), store=new StartStore(storage,'briarhold',activation);
  const env={ENABLE_GAME_STARTS:'true',ALLOWED_ORIGIN:'https://samfa12.com',TRACKING_STARTS:JSON.stringify({briarhold:activation,'reef-sweep':activation})};
  return {storage,store,env,call:(value=event(), changes={},time=at)=>handleRequest(new Request('https://samfa12.com/api/game-starts/v1/start',{
    method:'POST',headers:{Origin:'https://samfa12.com','Content-Type':'application/json'},body:JSON.stringify(value),...changes}),env,()=>store,time)};
}

test('shipping defaults make no sends or tracking records',async()=>{
  const c=client({enabled:false});c.tracker.markReady();assert.equal((await c.tracker.start()).status,'inactive');assert.equal(c.calls.length,0);
  assert.equal(c.windowRef.sessionStorage.getItem('samfa12:game-start:v1:briarhold'),null);
});
test('ready gate and first genuine start count once through repeated start/resume',async()=>{
  const c=client();assert.equal((await c.tracker.start()).status,'inactive');c.tracker.markReady();await c.tracker.start();await c.tracker.start();await c.tracker.flush();assert.equal(c.calls.length,1);
  assert.deepEqual(Object.keys(c.calls[0]).sort(),['eventId','gameId','schemaVersion','startedAt']);
});
test('reload reuses acknowledgement instead of sending again',async()=>{
  const c=client();c.tracker.markReady();await c.tracker.start();c.tracker.dispose();
  const reload=client({windowRef:c.windowRef});reload.tracker.markReady();await reload.tracker.start();assert.equal(reload.calls.length,0);
});
test('refused start is never sent retrospectively after granting consent',async()=>{
  const c=client({windowRef:browser(false)});c.tracker.markReady();assert.equal((await c.tracker.start()).status,'consent-required');
  c.windowRef.localStorage.setItem(CONSENT_KEY,'granted');c.tracker.syncConsent();await c.tracker.start();assert.equal(c.calls.length,0);
  c.advance(30*60_000);await c.tracker.start();assert.equal(c.calls.length,1);
});
test('revocation removes pending event and aborts in-flight delivery',async()=>{
  let signal;
  const c=client({fetchImpl:(_url,request)=>new Promise((_resolve,reject)=>{signal=request.signal;signal.addEventListener('abort',()=>reject(new Error('aborted')));})});
  c.tracker.markReady();const pending=c.tracker.start();
  c.windowRef.localStorage.setItem(CONSENT_KEY,'denied');c.tracker.syncConsent();await pending;
  assert.equal(signal.aborted,true);assert.equal(c.windowRef.sessionStorage.getItem('samfa12:game-start:v1:briarhold'),null);
});
test('failed network uses same immutable event, backoff and four-attempt bound',async()=>{
  const payloads=[];const c=client({fetchImpl:async(_url,req)=>{payloads.push(req.body);throw new Error('offline');}});c.tracker.markReady();
  await c.tracker.start();await c.tracker.flush();assert.equal(payloads.length,1);
  for(let i=0;i<6;i++){c.advance(60_000);await c.tracker.flush();}assert.equal(payloads.length,4);assert.equal(new Set(payloads).size,1);
});
test('reload after response loss retains event for idempotent retry',async()=>{
  const w=browser();const first=client({windowRef:w,fetchImpl:async()=>{throw new Error('lost response');}});first.tracker.markReady();await first.tracker.start();first.tracker.dispose();
  let captured;const reload=client({windowRef:w,now:()=>at+10_000,fetchImpl:async(_url,req)=>{captured=JSON.parse(req.body);return Response.json({schemaVersion:1,gameId:'briarhold',status:'duplicate',day:'2026-10-13'});}});
  reload.tracker.markReady();await reload.tracker.start();assert.equal(captured.eventId,eventId);assert.equal(captured.startedAt,new Date(at).toISOString());
});
test('storage failure never throws or blocks gameplay; consent failure sends nothing',async()=>{
  const w=browser();w.sessionStorage={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}};
  const c=client({windowRef:w});c.tracker.markReady();await c.tracker.start();await c.tracker.start();assert.equal(c.calls.length,1);
  w.localStorage.getItem=()=>{throw Error();};await c.tracker.flush();
});
test('active updates preserve session; inactivity allows a fresh genuine start',async()=>{
  let ids=0;const c=client({uuid:()=>`b6e9307b-128a-4023-8170-b8816caa934${ids++}`});c.tracker.markReady();await c.tracker.start();
  c.advance(29*60_000);c.tracker.activity();c.advance(29*60_000);await c.tracker.start();assert.equal(c.calls.length,1);
  c.advance(31*60_000);await c.tracker.start();assert.equal(c.calls.length,2);
});
test('external or wrong endpoints remain inactive',async()=>{
  for(const endpoint of ['https://elsewhere.test/api/game-starts/v1/start','/wrong','/api/game-starts/v1/start?key=x']){const c=client({endpoint});c.tracker.markReady();await c.tracker.start();assert.equal(c.calls.length,0);}
});
test('SQLite receipt and daily increment deduplicate concurrent requests',async()=>{
  const a=api();const results=await Promise.all(Array.from({length:12},()=>a.call()));
  assert.equal(results.filter(r=>r.status===200).length,12);const bodies=await Promise.all(results.map(r=>r.json()));assert.equal(bodies.filter(r=>r.status==='accepted').length,1);
  assert.equal(a.store.snapshot(at).daily[0].starts,1);a.storage.db.close();
});
test('retry across midnight stays assigned to original UTC day',async()=>{
  const a=api(),time=Date.parse('2026-10-13T23:59:59.000Z');const e=event({startedAt:new Date(time).toISOString()});
  await a.call(e,{},time);const retry=await (await a.call(e,{},time+2000)).json();assert.equal(retry.status,'duplicate');assert.equal(retry.day,'2026-10-13');assert.equal(a.store.snapshot(time+2000).daily.length,1);a.storage.db.close();
});
test('receipt expiry does not permit stale HTTP retries to count again',async()=>{
  const a=api();await a.call();assert.equal(a.storage.sql.exec('SELECT * FROM receipts').toArray().length,1);
  a.store.prune(at+RECEIPT_MS);assert.equal(a.storage.sql.exec('SELECT * FROM receipts').toArray().length,0);
  assert.equal((await a.call(event(),{},at+RECEIPT_MS)).status,400);assert.equal(a.store.snapshot(at+RECEIPT_MS).daily[0].starts,1);a.storage.db.close();
});
test('storage error rolls back receipt before retry',()=>{
  const a=api();const original=a.storage.sql.exec;a.storage.sql.exec=(query,...args)=>{if(query.startsWith('INSERT INTO daily(day,starts)'))throw Error('disk');return original(query,...args);};
  assert.throws(()=>a.store.accept('2026-10-13','hash',at));a.storage.sql.exec=original;
  assert.equal(a.storage.sql.exec('SELECT * FROM receipts').toArray().length,0);assert.equal(a.store.accept('2026-10-13','hash',at).status,'accepted');a.storage.db.close();
});
test('origin, body, method, unknown fields and invalid times are rejected',async()=>{
  const a=api();assert.equal((await a.call(event(),{headers:{Origin:'https://attacker.test','Content-Type':'application/json'}})).status,403);
  assert.equal((await a.call(event({save:'private'}))).status,400);assert.equal((await a.call(event({gameId:'unknown'}))).status,400);
  assert.equal((await a.call(event({startedAt:new Date(at+300_001).toISOString()}))).status,400);
  assert.equal((await a.call(event({startedAt:new Date(at-86_400_001).toISOString()}))).status,400);
  assert.equal((await a.call(event({eventId:'x'.repeat(600)}))).status,413);
  assert.equal((await a.call(event(),{method:'PUT'})).status,405);a.storage.db.close();
});
test('disabled/unavailable return failures instead of successful zero statistics',async()=>{
  const a=api();a.env.ENABLE_GAME_STARTS='false';assert.equal((await a.call()).status,503);a.env.ENABLE_GAME_STARTS='true';
  const request=new Request('https://samfa12.com/api/game-starts/v1/stats');const unavailable=await handleRequest(request,a.env,()=>({snapshot(){throw Error('offline');}}),at);assert.equal(unavailable.status,503);a.storage.db.close();
});
test('minute abuse cap preserves duplicates and marks incomplete day',()=>{
  const a=api();for(let i=0;i<MINUTE_CAP;i++)assert.equal(a.store.accept('2026-10-13',`hash${i}`,at).status,'accepted');
  assert.equal(a.store.accept('2026-10-13','extra',at).status,'capped');assert.equal(a.store.accept('2026-10-13','hash0',at).status,'duplicate');
  const row=a.store.snapshot(at).daily[0];assert.equal(row.starts,MINUTE_CAP);assert.equal(row.coverage,'capped');assert.throws(()=>a.store.setCoverage('2026-10-13','complete',at+86_400_000));a.storage.db.close();
});
test('daily cap rejects a new event without creating a receipt',()=>{
  const a=api();a.storage.sql.exec("INSERT INTO daily(day,starts) VALUES('2026-10-13',10000)");
  assert.equal(a.store.accept('2026-10-13','newhash',at).status,'capped');assert.equal(a.storage.sql.exec('SELECT * FROM receipts').toArray().length,0);assert.equal(a.store.snapshot(at).daily[0].starts,10000);a.storage.db.close();
});
test('skewed future UTC day cannot create a future aggregate',()=>{
  const midnight=Date.parse('2026-10-13T23:59:59.000Z');assert.throws(()=>validateEvent(event({startedAt:'2026-10-14T00:00:01.000Z'}),midnight,activation));
});
test('missing dates remain absent; only explicit operator coverage creates a zero day',()=>{
  const a=api();assert.deepEqual(a.store.snapshot(at).daily,[]);a.store.setCoverage('2026-10-12','complete',at);assert.equal(a.store.snapshot(at).daily[0].starts,0);assert.throws(()=>a.store.setCoverage('2026-10-13','complete',at));a.storage.db.close();
});
test('activation persists once and receipt hashes contain no raw event ID',async()=>{
  const a=api();await a.call();const reload=new StartStore(a.storage,'briarhold','2026-10-10T00:00:00.000Z');assert.equal(reload.trackingSince,activation);
  const stored=JSON.stringify(a.storage.sql.exec('SELECT * FROM receipts').toArray());assert.ok(!stored.includes(eventId));assert.equal((await receiptHash('briarhold',eventId)).length,64);a.storage.db.close();
});
test('fixture aggregation distinguishes complete weeks from gaps and observed cumulative',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/game-starts/stats.json',import.meta.url)));
  assert.ok(validateStartStats(fixture));const briar=summarizeGame(fixture.games[0],fixture.updatedAt);assert.equal(briar.weekly,17);assert.equal(briar.cumulativeObserved,20);assert.equal(briar.lifetimeGaps,1);
  const reef=summarizeGame(fixture.games[1],fixture.updatedAt);assert.equal(reef.weekly,null);assert.equal(reef.cumulativeObserved,7);assert.ok(reef.missing.includes('2026-10-13'));
});
test('duplicate aggregate dates and invalid or fabricated dates reject snapshot',()=>{
  const value={schemaVersion:1,source:'first-party-game-starts',status:'ok',updatedAt:new Date(at).toISOString(),games:[{gameId:'briarhold',trackingSince:activation,daily:[{day:'2026-10-12',starts:1,coverage:'complete'},{day:'2026-10-12',starts:2,coverage:'complete'}]}]};
  assert.equal(validateStartStats(value),null);value.games[0].daily=[{day:'2026-02-30',starts:1,coverage:'complete'}];assert.equal(validateStartStats(value),null);
});
test('published marker is disabled and production routes/transmission are unconfigured',async()=>{
  const value=JSON.parse(await readFile(new URL('../data/game-start-stats.json',import.meta.url)));assert.equal(value.status,'disabled');assert.deepEqual(value.games,[]);
  const config=JSON.parse(await readFile(new URL('../workers/game-starts/wrangler.jsonc',import.meta.url)));assert.equal(config.vars.ENABLE_GAME_STARTS,'false');assert.deepEqual(config.routes,[]);assert.equal(config.workers_dev,false);
});

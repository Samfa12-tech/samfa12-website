import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGameStartLifecycle,prepareWebsiteGameStartHook} from '../build/analytics/game-start.js';
import {createGameStartTracker} from '../build/analytics/shared-game-starts-client.js';
import {MemoryStorage} from '../build/game/profile.js';

function fixture(consent='granted') {
 const listeners=new Map(),sessionStorage=new MemoryStorage(),localStorage=new MemoryStorage();
 if(consent!==null)localStorage.setItem('samfa12:analytics-consent',consent);
 const win={location:{href:'https://samfa12.com/games/reef-sweep/play/',origin:'https://samfa12.com'},sessionStorage,localStorage,
 addEventListener(name,fn){listeners.set(name,fn)},removeEventListener(name){listeners.delete(name)}};
 let now=Date.parse('2026-10-14T00:00:00.000Z');const requests=[];
 const options={gameId:'reef-sweep',enabled:true,endpoint:'/api/game-starts/v1/start',windowRef:win,now:()=>now,
 uuid:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',timeoutSignal:()=>new AbortController().signal,
 fetchImpl:async(url,init)=>{requests.push({url,init,body:JSON.parse(init.body)});return {ok:true,json:async()=>({schemaVersion:1,gameId:'reef-sweep',status:'accepted',day:'2026-10-14'})}}};
 return {win,listeners,options,requests,advance(ms){now+=ms}};
}
test('only a ready genuine start counts, once across new runs and reload',async()=>{
 const f=fixture(),tracker=createGameStartTracker(f.options);
 assert.equal((await tracker.start()).status,'inactive');assert.equal(f.requests.length,0);
 tracker.markReady();await tracker.start();await tracker.start();tracker.activity();
 tracker.dispose();const reload=createGameStartTracker(f.options);reload.markReady();await reload.start();
 assert.equal(f.requests.length,1);
 assert.deepEqual(f.requests[0].body,{schemaVersion:1,gameId:'reef-sweep',eventId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',startedAt:'2026-10-14T00:00:00.000Z'});
 assert.equal(f.requests[0].init.credentials,'omit');assert.equal(f.requests[0].init.referrerPolicy,'no-referrer');
});
test('shipping adapter is disabled with an empty endpoint and exact shared client',async()=>{
 const source=fs.readFileSync(new URL('../src/analytics/game-start.ts',import.meta.url),'utf8');
 assert.match(source,/gameId:'reef-sweep',enabled:false,endpoint:''/);
 assert.match(fs.readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),/if\(!debug\)gameStarts.start\(\)/);
 const f=fixture();f.options.enabled=false;f.options.endpoint='';const t=createGameStartTracker(f.options);t.markReady();await t.start();t.activity();assert.equal(f.requests.length,0);assert.equal(f.win.sessionStorage.length,0);
 assert.doesNotThrow(()=>prepareWebsiteGameStartHook().markReady());
});
test('consent refusal is not retrospectively transmitted; a fresh session can count',async()=>{
 const f=fixture('denied'),t=createGameStartTracker(f.options);t.markReady();await t.start();
 f.win.localStorage.setItem('samfa12:analytics-consent','granted');f.listeners.get('samfa12:analytics-consent')();await t.start();assert.equal(f.requests.length,0);
 f.advance(30*60_000);await t.start();assert.equal(f.requests.length,1);
});
test('30-minute inactivity ends session, while active updates preserve it across reload',async()=>{
 const f=fixture(),t=createGameStartTracker(f.options);t.markReady();await t.start();
 f.advance(29*60_000);t.activity();f.advance(2*60_000);t.dispose();const reload=createGameStartTracker(f.options);reload.markReady();await reload.start();assert.equal(f.requests.length,1);
 f.advance(30*60_000);await reload.start();assert.equal(f.requests.length,2);
});
test('revocation erases pending state and aborts in-flight transmission',async()=>{
 const f=fixture();let signal;f.options.fetchImpl=(_,init)=>new Promise((_,reject)=>{signal=init.signal;init.signal.addEventListener('abort',()=>reject(Error('revoked')))});
 const t=createGameStartTracker(f.options);t.markReady();const pending=t.start();
 f.win.localStorage.setItem('samfa12:analytics-consent','denied');f.listeners.get('storage')({key:'samfa12:analytics-consent'});
 assert.equal(signal.aborted,true);await pending;assert.equal(f.win.sessionStorage.length,0);
});
test('retries keep immutable delivery token/time and stop after four attempts',async()=>{
 const f=fixture();f.options.fetchImpl=async(url,init)=>{f.requests.push(JSON.parse(init.body));throw Error('offline')};
 const t=createGameStartTracker(f.options);t.markReady();await t.start();
 for(let i=0;i<8;i++){f.advance(60_000);await t.flush()}
 assert.equal(f.requests.length,4);for(const body of f.requests)assert.deepEqual(body,f.requests[0]);
});
test('cross-origin/unapproved endpoints, absent consent and unreadable consent cannot send',async()=>{
 for(const endpoint of ['https://other.test/api/game-starts/v1/start','/invented','/api/game-starts/v1/start?data=yes']){
  const f=fixture(),t=createGameStartTracker({...f.options,endpoint});t.markReady();await t.start();assert.equal(f.requests.length,0);
 }
 for(const consent of [null,'denied']){const f=fixture(consent),t=createGameStartTracker(f.options);t.markReady();await t.start();assert.equal(f.requests.length,0)}
 const f=fixture();f.win.localStorage.getItem=()=>{throw Error('blocked')};const t=createGameStartTracker(f.options);t.markReady();await t.start();assert.equal(f.requests.length,0);
});
test('storage and arbitrary synchronous/rejected adapter failures cannot enter gameplay',async()=>{
 const f=fixture();f.win.sessionStorage.getItem=()=>{throw Error('blocked')};f.win.sessionStorage.setItem=()=>{throw Error('blocked')};
 const t=createGameStartTracker(f.options);t.markReady();await t.start();await t.start();assert.equal(f.requests.length,1);
 for(const fail of [()=>{throw Error('unavailable')},()=>Promise.reject(Error('offline'))]){
  const hook=createGameStartLifecycle({markReady:fail,start:fail,activity:fail,dispose:fail});assert.doesNotThrow(()=>{hook.start();hook.markReady();hook.start();hook.activity();hook.dispose()});
 }
 await new Promise(resolve=>setTimeout(resolve,0));
});

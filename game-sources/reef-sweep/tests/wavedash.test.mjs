import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const root=new URL('../release/wavedash/',import.meta.url),read=name=>fs.readFileSync(new URL(name,root));
test('Wavedash build retains source game bytes, analytics and exact version',()=>{
 const source=JSON.parse(fs.readFileSync(new URL('../dist/build-manifest.json',import.meta.url))),manifest=JSON.parse(read('build-manifest.json'));
 assert.equal(manifest.version,source.version);assert.equal(manifest.platform,'Wavedash');assert.match(manifest.sourceCommit,/^[0-9a-f]{40}$/);
 assert.ok(read('game.js').equals(fs.readFileSync(new URL('../dist/game.js',import.meta.url))));
 for(const [name,entry] of Object.entries(manifest.files)){const b=read(name);assert.equal(b.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),entry.sha256);}
 assert.match(read('game.js').toString(),/enabled: false/);
});
test('platform readiness is absent-safe, boot-success-only and idempotent',()=>{
 const source=read('wavedash-ready.js').toString();new vm.Script(source);
 for(const sdkPresent of [false,true])for(const ready of [false,true]){let calls=0;const window=sdkPresent?{Wavedash:{init(){calls++;}}}:{};const context=vm.createContext({window,document:{getElementById(){return {style:{display:ready?'none':'grid'}};}}});vm.runInContext(source,context);vm.runInContext(source,context);assert.equal(calls,sdkPresent&&ready?1:0);}
 const html=read('index.html').toString(),version=JSON.parse(read('build-manifest.json')).version;
 assert.ok(html.includes('game.js?v='+version));assert.match(html,/game\.js\?v=[^"\s]+[\s\S]*wavedash-ready\.js/);
});

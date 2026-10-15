import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),source=path.join(root,'dist'),target=path.join(root,'release/wavedash');
const manifest=JSON.parse(fs.readFileSync(path.join(source,'build-manifest.json'),'utf8'));
for(const [name,entry] of Object.entries(manifest.files)){const b=fs.readFileSync(path.join(source,name));if(b.length!==entry.bytes||crypto.createHash('sha256').update(b).digest('hex')!==entry.sha256)throw Error('Stale source distribution: '+name);}
// Owned generated destination only. No uploads or publication from this script.
if(!target.startsWith(root+path.sep)||target!==path.resolve(root,'release','wavedash')||[path.join(root,'release'),target].some(p=>fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink()))throw Error('Unsafe generated package destination.');
fs.rmSync(target,{recursive:true,force:true});fs.mkdirSync(target,{recursive:true});fs.cpSync(source,target,{recursive:true});
const adapter=`// Wavedash injects its SDK before the game entrypoint.\n(()=>{if(window.__REEF_WAVEDASH_READY__)return;const sdk=window.Wavedash;const loading=document.getElementById('loading');if(sdk&&typeof sdk.init==='function'&&loading&&loading.style.display==='none'){window.__REEF_WAVEDASH_READY__=true;sdk.init();}})();\n`;
fs.writeFileSync(path.join(target,'wavedash-ready.js'),adapter);
const html=fs.readFileSync(path.join(target,'index.html'),'utf8').replace('</body>','<script src="wavedash-ready.js"></script></body>');fs.writeFileSync(path.join(target,'index.html'),html);
manifest.platform='Wavedash';manifest.sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
for(const name of ['index.html','wavedash-ready.js']){const b=fs.readFileSync(path.join(target,name));manifest.files[name]={bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};}
fs.writeFileSync(path.join(target,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared existing Reef Sweep game j97806qxc5fftj6qb2bjj5y5998g7s22, ${manifest.version}; no upload/publication.`);

import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const repo=path.resolve(import.meta.dirname,'..'),source=path.join(repo,'game-sources/reef-sweep/dist');
const siteRoot=path.resolve(process.env.REEF_SWEEP_SITE_ROOT || repo),target=path.join(siteRoot,'games/reef-sweep/play');
const verify=process.argv.includes('--verify'),manifest=JSON.parse(fs.readFileSync(path.join(source,'build-manifest.json'),'utf8'));
const expected=['LICENSE-BABYLON.txt','THIRD_PARTY_NOTICES.md','babylon.js','game.js','icon-192.png','icon-512.png','index.html','music/room-for-life.pcs.json','style.css'];
if(manifest.version!==JSON.parse(fs.readFileSync(path.join(repo,'game-sources/reef-sweep/package.json'),'utf8')).version)throw Error('Distribution version differs from canonical source.');
if(manifest.game!=='Reef Sweep'||manifest.engine!=='Babylon.js 9.26.1 custom source closure'||manifest.saveSchema!==1||!/^\d+\.\d+\.\d+-preview\.\d+$/.test(manifest.version)||JSON.stringify(Object.keys(manifest.files).sort())!==JSON.stringify([...expected].sort()))throw Error('Unrecognised Reef Sweep distribution manifest.');
const inventory=dir=>fs.readdirSync(dir,{recursive:true}).filter(n=>fs.statSync(path.join(dir,n)).isFile()).map(n=>n.replaceAll('\\','/')).sort();
const all=[...expected,'build-manifest.json'].sort();
if(JSON.stringify(inventory(source))!==JSON.stringify(all))throw Error('Unexpected files in Reef Sweep distribution.');
for(const name of expected){const raw=fs.readFileSync(path.join(source,name)),entry=manifest.files[name];if(raw.length!==entry.bytes||crypto.createHash('sha256').update(raw).digest('hex')!==entry.sha256)throw Error('Source hash mismatch: '+name);}
if(!verify){
 if(target!==path.join(repo,'games/reef-sweep/play'))throw Error('Sync is restricted to the canonical hosted route.');
 fs.mkdirSync(target,{recursive:true});
 if(JSON.stringify(inventory(target))!==JSON.stringify(all))throw Error('Unexpected files in existing hosted route; review manually.');
 for(const name of all)fs.copyFileSync(path.join(source,name),path.join(target,name));
}
if(JSON.stringify(inventory(target))!==JSON.stringify(all))throw Error('Hosted distribution inventory differs.');
for(const name of all)if(!fs.readFileSync(path.join(source,name)).equals(fs.readFileSync(path.join(target,name))))throw Error('Hosted Reef Sweep differs from built source: '+name);
console.log(`Reef Sweep ${manifest.version}: ${all.length} hosted files match the canonical build byte for byte.`);

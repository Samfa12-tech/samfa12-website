import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const require=createRequire(import.meta.url);const {bundle}=require('./bundle.cjs');
const dist=path.join(root,'dist');fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
fs.writeFileSync(path.join(root,'public/game.js'),bundle('main.ts'));
// Version the changing assets so returning browsers cannot combine releases.
const page=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\r\n?/g,'\n').replace('href="style.css"',`href="style.css?v=${version}"`).replace('src="game.js"',`src="game.js?v=${version}"`);
fs.writeFileSync(path.join(dist,'index.html'),page);
fs.writeFileSync(path.join(dist,'style.css'),fs.readFileSync(path.join(root,'style.css'),'utf8').replace(/\r\n?/g,'\n'));
for(const name of ['babylon.js','game.js'])fs.copyFileSync(path.join(root,'public',name),path.join(dist,name));
for(const name of ['icon-192.png','icon-512.png'])fs.copyFileSync(path.join(root,'public',name),path.join(dist,name));
fs.cpSync(path.join(root,'public/music'),path.join(dist,'music'),{recursive:true});
for(const name of ['THIRD_PARTY_NOTICES.md','LICENSE-BABYLON.txt'])if(fs.existsSync(path.join(root,name)))fs.writeFileSync(path.join(dist,name),fs.readFileSync(path.join(root,name),'utf8').replace(/\r\n?/g,'\n'));
const escapeScript=s=>s.replace(/<\/script/gi,'<\\/script');
let standalone=page.replace(`<link rel="stylesheet" href="style.css?v=${version}">`,()=>'<style>'+fs.readFileSync(path.join(root,'style.css'),'utf8')+'</style>');
for(const name of ['icon-192.png','icon-512.png'])standalone=standalone.replaceAll(`href="${name}"`,`href="data:image/png;base64,${fs.readFileSync(path.join(root,'public',name)).toString('base64')}"`);
for(const name of ['babylon.js','game.js'])standalone=standalone.replace(`<script src="${name}${name==='game.js'?'?v='+version:''}"></script>`,()=>`<script>\n${escapeScript(fs.readFileSync(path.join(dist,name),'utf8'))}\n</script>`);
const license=fs.existsSync(path.join(root,'LICENSE-BABYLON.txt'))?fs.readFileSync(path.join(root,'LICENSE-BABYLON.txt'),'utf8'):'';
standalone=standalone.replace('<head>',()=>'<head>\n<!-- Babylon.js 9.26.1, Copyright Microsoft Corporation and contributors.\nApache License 2.0.\n'+license+'\n-->');
fs.writeFileSync(path.join(root,'Reef-Sweep.html'),standalone);
const files={};for(const name of fs.readdirSync(dist,{recursive:true}).sort()){const f=path.join(dist,name);if(fs.statSync(f).isFile())files[name.replaceAll('\\','/')]= {bytes:fs.statSync(f).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')};}
fs.writeFileSync(path.join(dist,'build-manifest.json'),JSON.stringify({game:'Reef Sweep',version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,engine:'Babylon.js 9.26.1 custom source closure',saveSchema:1,musicSchema:16,files},null,2));
console.log('Built dist/ and self-contained Reef-Sweep.html. No network requests are needed at runtime.');

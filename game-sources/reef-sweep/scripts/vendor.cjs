const fs=require('fs'),path=require('path'),ts=(()=>{try{return require('typescript')}catch{return require('/usr/local/slides_js/node_modules/typescript')}})();
const root=path.resolve(__dirname,'../vendor/babylon/src');let modules={},missing=new Set();
function visit(id){id=path.posix.normalize(id);if(modules[id])return;let file=path.join(root,id+'.ts');let source;if(fs.existsSync(file))source=fs.readFileSync(file,'utf8');else if(fs.existsSync(file.replace(/\.ts$/,'.pure.ts'))){source=`export * from './${path.basename(id)}.pure';`;let pure=fs.readFileSync(file.replace(/\.ts$/,'.pure.ts'),'utf8');const regs=[...pure.matchAll(/export function (Register\w+)\(\)/g)].map(x=>x[1]);if(regs.length===1)source+=`import {${regs[0]}} from './${path.basename(id)}.pure';${regs[0]}();`;}
else{missing.add(id);modules[id]='';return;}
let text=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true,removeComments:true,importHelpers:false}}).outputText;
modules[id]=text;
for(const match of text.matchAll(/require\(["']([^"']+)["']\)/g)){let dep=match[1];if(dep.startsWith('core/')){visit(dep.slice(5));continue;}if(!dep.startsWith('.')){missing.add(dep);continue;}dep=path.posix.normalize(path.posix.join(path.posix.dirname(id),dep)).replace(/\.js$/,'');visit(dep);}}
visit('entry');console.log('modules',Object.keys(modules).length,'missing',missing.size,[...missing]);
fs.writeFileSync(path.resolve(__dirname,'../vendor/babylon/modules.generated.json'),JSON.stringify(modules));
if(!missing.size){const out=`/* Babylon.js 9.26.1. Apache-2.0. See THIRD_PARTY_NOTICES.md.\n * Reconstructed from official source contents in an upstream CI source map. */\n(function(){const modules={\n`+Object.entries(modules).map(([id,s])=>JSON.stringify(id)+':function(require,module,exports){\n'+s+'\n}').join(',\n')+`};const cache={};function resolve(from,id){if(id.startsWith('core/'))return id.slice(5);if(!id.startsWith('.'))return id;const a=(from.split('/').slice(0,-1).join('/')+'/'+id).split('/'),o=[];for(const x of a){if(x==='..')o.pop();else if(x&&x!=='.')o.push(x);}return o.join('/').replace(/\\.js$/,'');}function load(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};if(!modules[id])throw Error('Missing Babylon module '+id);modules[id](dep=>load(resolve(id,dep)),m,m.exports);return m.exports;}globalThis.BABYLON=load('entry');})();`;
fs.writeFileSync(path.resolve(__dirname,'../public/babylon.js'),out);console.log('Wrote vendor runtime',out.length);}

if(missing.size)process.exitCode=1;

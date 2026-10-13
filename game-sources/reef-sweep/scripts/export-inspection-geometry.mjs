import fs from 'node:fs';
import {shipwreckGeometry,sewagePipeGeometry,seaweedGeometry,fishGeometry} from '../build/render/geometry.js';
const objects={wreck:shipwreckGeometry(),outfall:sewagePipeGeometry(),seaweed:seaweedGeometry(417,1.5),shark:fishGeometry('shark')};
fs.writeFileSync(new URL('../../../inspection-geometry.json',import.meta.url),JSON.stringify(Object.fromEntries(Object.entries(objects).map(([name,g])=>[name,{positions:g.positions,indices:g.indices,colors:g.colors}]))));
console.log('Exported native source meshes for Blender inspection.');

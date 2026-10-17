import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLionfishDefense, updateLionfishDefense } from '../build/render/lionfish-defense.js';
import { lionfishGeometry, bindLionfishDraw } from '../build/render/lionfish.js';

test('independent lionfish defense has smoothed rise, hysteresis, retreat and bounded values',()=>{
 const near=makeLionfishDefense(),far=makeLionfishDefense();
 for(let i=0;i<60;i++){updateLionfishDefense(near,2,1/60);updateLionfishDefense(far,8,1/60)}
 assert.ok(near.value>.98);assert.equal(far.value,0);
 for(let i=0;i<60;i++)updateLionfishDefense(near,3.8,1/60);assert.equal(near.active,true);
 const value=near.value;updateLionfishDefense(near,2,0);assert.equal(near.value,value);
 for(let i=0;i<180;i++)updateLionfishDefense(near,5,1/60);assert.ok(near.value<.003);assert.equal(near.active,false);
 updateLionfishDefense(near,3.8,1/60);assert.equal(near.active,false);
 for(const dt of [-1,NaN,Infinity,100]){updateLionfishDefense(near,1,dt);assert.ok(near.value>=0&&near.value<=1)}
});
test('the selected colour or shadow effect receives each mesh scalar on every draw',()=>{
 const effects=[],engine={currentRenderPassId:0,_currentEffect:{setFloat:(name,value)=>effects.push([0,name,value])}};
 const mesh=()=>({material:{_reefMode:2},_lionfishBindings:{},onBeforeDrawObservable:{add(fn){this.draw=fn}}});
 const near=mesh(),far=mesh();bindLionfishDraw(near,engine,{active:true,value:.9});bindLionfishDraw(far,engine,{active:false,value:0});
 near.onBeforeDrawObservable.draw();far.onBeforeDrawObservable.draw();
 engine.currentRenderPassId=7;engine._currentEffect={setFloat:(name,value)=>effects.push([7,name,value])};
 near.onBeforeDrawObservable.draw();far.onBeforeDrawObservable.draw();
 assert.deepEqual(effects,[[0,'uLionfishDefense',.9],[0,'uLionfishDefense',0],[7,'uLionfishDefense',.9],[7,'uLionfishDefense',0]]);
 near.material._reefMode=12;near.onBeforeDrawObservable.draw();assert.equal(effects.at(-1)[2],0);
});
test('authored static geometry retains part tags and a single optional scale conversion',()=>{
 const g=lionfishGeometry(),scaled=lionfishGeometry(.65),n=g.positions.length/3;
 assert.equal(n,5539);assert.equal(g.indices.length/3,8125);assert.equal(g.normals.length,n*3);assert.equal(g.colors.length,n*4);assert.equal(g.uvs.length,n*2);
 assert.ok([...g.positions,...g.normals,...g.colors,...g.uvs].every(Number.isFinite));assert.ok(g.indices.every(i=>Number.isInteger(i)&&i>=0&&i<n));
 assert.ok(g.uvs.every((v,i)=>i%2||v===5));
 const tags=new Set(g.uvs.filter((_,i)=>i%2));for(let i=10;i<=22;i++)assert.ok(tags.has(i));
 g.positions.forEach((v,i)=>assert.equal(scaled.positions[i],v*.65));scaled.positions[0]=100;assert.notEqual(g.positions[0],100);
});

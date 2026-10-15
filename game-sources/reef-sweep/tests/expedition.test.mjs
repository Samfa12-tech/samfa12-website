import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProfile, SaveStore, MemoryStorage, validateProfile } from '../build/game/profile.js';
import { SITES } from '../build/game/data.js';
import { startRun, Simulation, settleRun } from '../build/game/simulation.js';
import { layoutChartLabels } from '../build/ui/chart-labels.js';
import { wavedashHost, fullscreenAvailable, PerformanceSuggestion } from '../build/host.js';
import { fishSize, restaurantValue, travelCosts, outingExpenses, heldCatches, CHARMS, discoverCharm, equipCharm, outbreakAvailable, completeCooking, newBoat, updateBoatTravel, arrivalSite, BAY_SITES, oceanHeight } from '../build/game/expedition.js';
import { EMPTY_INPUT } from '../build/game/simulation.js';
import { contractOptions } from '../build/game/campaign.js';
import { skiffGeometry } from '../build/render/boat-travel.js';
const tick=(s,t,input={})=>{for(let i=0;i<t*60;i++)s.update(1/60,{...EMPTY_INPUT,...input});};

test('exhausted-reef settlement on any day commits once and permits a harbour preview', () => {
 for(const day of [1,2,3,4,6,21]) {
  const p=freshProfile();p.day=day;
  const r=startRun(p,'gardens','none');
  p.reefs.gardens.removed=r.fish.map(f=>f.id);
  r.cargo=[{id:r.fish[0].id,weight:1,value:20}];r.removed=1;
  new Simulation(p,r).finish(false);
  const receipt=settleRun(p,r,{sell:1,eat:0,donate:0},[]), cash=p.cash;
  assert.ok(receipt.earned>0);assert.equal(p.day,day+1);assert.equal(p.pending,null);
  assert.throws(()=>settleRun(p,r,{sell:1,eat:0,donate:0},[]),/already/);assert.equal(p.cash,cash);
  const loaded=validateProfile(p);startRun(structuredClone(loaded),'gardens','none');
 }
});
test('chart labels stay bounded and separated for all maps, clustered long names and repeat layouts',()=>{
 for(const site of Object.values(SITES))for(const size of [360,600]){
  const labels=site.landmarks.map(l=>({name:l.name,x:size/2+l.p.x*size/(site.radius*2+20),y:size/2-l.p.z*size/(site.radius*2+20)}));
  labels.push({name:'Long field station beside the offshore drop',x:size-8,y:size-12});
  labels.push({name:'Outfall survey',x:size-9,y:size-14});
  const packed=layoutChartLabels(labels,size,t=>t.length*8);
  assert.deepEqual(packed,layoutChartLabels(labels,size,t=>t.length*8));
  packed.forEach((l,i)=>{assert.ok(l.left>=0&&l.top>=0&&l.left+l.width<=size&&l.top+l.height<=size-40);for(const other of packed.slice(i+1))assert.ok(l.left+l.width+4<=other.left||other.left+other.width+4<=l.left||l.top+l.height+4<=other.top||other.top+other.height+4<=l.top);});
 }
});
test('fullscreen is host and capability aware',()=>{
 assert.ok(wavedashHost('https://games.wavedash.com/a'));assert.ok(wavedashHost('https://cdn.example/game','https://wavedash.com/games/reef-sweep'));
 assert.equal(wavedashHost('https://wavedash.com.evil.test/'),false);
 assert.equal(fullscreenAvailable({}, {},false),false);
 assert.equal(fullscreenAvailable({fullscreenEnabled:false},{requestFullscreen(){}},false),false);
 assert.equal(fullscreenAvailable({fullscreenEnabled:true},{requestFullscreen(){}},true),false);
 assert.equal(fullscreenAvailable({fullscreenEnabled:true},{requestFullscreen(){}},false),true);
});
test('High default preserves saved quality and performance consent suppression',()=>{
 const storage=new MemoryStorage(),store=new SaveStore(storage);assert.equal(store.settings().quality,'high');
 const s=store.settings();s.quality='low';s.performancePromptDismissed=true;store.saveSettings(s);
 assert.equal(store.settings().quality,'low');assert.equal(store.settings().performancePromptDismissed,true);
});
test('performance suggestion ignores menus, loading, single hitches and short dips',()=>{
 const meter=new PerformanceSuggestion();for(let i=0;i<1000;i++)assert.equal(meter.update(.08,false,false,'high'),false);
 for(let i=0;i<500;i++)assert.equal(meter.update(1/60,true,false,'high'),false);
 assert.equal(meter.update(2,true,false,'high'),false);
 for(let i=0;i<300;i++)assert.equal(meter.update(.05,true,false,'high'),false);
 let prompted=false;for(let i=0;i<2000;i++)prompted ||= meter.update(.05,true,false,'high');assert.ok(prompted);
 assert.equal(meter.update(.05,true,true,'high'),false);
});
test('two actual catches retain size/identity across save, Shishkabob triggers once and both secure once',()=>{
 const p=freshProfile();p.tutorial=1;const r=startRun(p,'gardens','none'),s=new Simulation(p,r);r.p={x:0,y:8,z:-41};r.yaw=0;r.pitch=0;
 for(const f of r.fish)f.p=f.home={x:40,y:8,z:40};
 const first=r.fish[0],second=r.fish[1];first.p=first.home={x:0,y:8,z:-39};s.strike(1);assert.equal(r.exposed.id,first.id);assert.equal(r.exposed.size,first.size);
 tick(s,.8);second.p=second.home={x:r.p.x,y:r.p.y,z:r.p.z+2};r.yaw=0;r.pitch=0;s.strike(1);
 assert.equal(heldCatches(r).length,2);assert.equal(r.skewered[0].id,second.id);assert.equal(r.skewered[0].size,second.size);assert.equal(r.clips.filter(c=>c.kind==='shishkabob').length,1);
 const restored=validateProfile(p);assert.equal(restored.active.skewered[0].size,second.size);
 const resumed=new Simulation(restored,restored.active);tick(resumed,1.5,{interact:true});assert.equal(restored.active.cargo.length,2);assert.equal(restored.active.exposed,null);assert.deepEqual(restored.active.skewered,[]);
 tick(resumed,3,{interact:true});assert.equal(restored.active.cargo.length,2);
});
test('juveniles earn eradication but no restaurant price, large fish fill viable early orders',()=>{
 for(const site of Object.values(SITES)){
  const sizes=Array.from({length:24},(_,i)=>fishSize(site.seed,i));assert.ok(Math.min(...sizes)<.6&&Math.max(...sizes)>1.1);assert.ok(sizes.slice(0,4).every(s=>s>=.84));
  assert.equal(restaurantValue(.2,.5),0);assert.ok(restaurantValue(.8,1)>0);
  const p=freshProfile();p.reputation=100;const r=startRun(p,site.id,'catch');r.cargo=r.fish.slice(0,4).map(f=>({id:f.id,size:f.size,weight:f.weight,value:restaurantValue(f.weight,f.size)}));new Simulation(p,r).finish(false);
  const result=settleRun(p,r,{sell:4,eat:0,donate:0},[]);assert.equal(result.contract,45);assert.ok(result.earned>result.expenses,site.id);
 }
});
test('both fuel costs follow authored distances, detours increase boat fuel and rescue stays bounded',()=>{
 const garden=travelCosts('gardens'),cenote=travelCosts('cenote');assert.ok(cenote.tow>garden.tow&&cenote.boat>garden.boat);assert.ok(travelCosts('gardens',900).boat>garden.boat);
 const p=freshProfile();p.cash=0;const r=startRun(p,'gardens','none');r.boatDistance=200;new Simulation(p,r).finish(true);assert.equal(outingExpenses(r,0),85);settleRun(p,r,{sell:0,eat:0,donate:0},[]);assert.ok(startRun(p,'gardens','none'));
});
test('five finite keepsakes persist, equip requires discovery, and Marlow has one home site',()=>{
 assert.equal(CHARMS.length,5);const p=freshProfile();assert.throws(()=>equipCharm(p,CHARMS[0].id));assert.equal(discoverCharm(p,CHARMS[0].id),true);assert.equal(discoverCharm(p,CHARMS[0].id),false);equipCharm(p,CHARMS[0].id);assert.equal(validateProfile(p).equippedCharm,CHARMS[0].id);
 for(const site of Object.keys(SITES)){const career=freshProfile();career.reputation=100;const r=startRun(career,site,'none');assert.equal(r.animals.some(a=>a.id==='marlow'),site==='gardens');assert.equal(r.jobs.filter(j=>j.kind==='charm').length,1);}
});
test('outbreak requires later progression and uses a release-safety-inject sequence with one bounty',()=>{
 const p=freshProfile();assert.equal(outbreakAvailable(p),false);p.day=8;p.reputation=20;p.totalRemoved=18;p.tutorial=1;
 const r=startRun(p,'gardens','none'),s=new Simulation(p,r),j=r.jobs.find(j=>j.kind==='outbreak');assert.ok(j);s.aim={kind:'job',id:j.id,distance:2,label:'target',hint:'',valid:true};
 for(let i=0;i<90;i++)s.work(1/60,true);assert.equal(j.stage,1);assert.equal(j.done,false);for(let i=0;i<200;i++)s.work(1/60,true);assert.equal(j.done,false);
 s.work(1/60,false);assert.equal(j.stage,2);for(let i=0;i<110;i++)s.work(1/60,true);assert.equal(j.done,true);assert.equal(r.treated,1);
 for(let i=0;i<120;i++)s.work(1/60,true);assert.equal(r.treated,1);new Simulation(p,r).finish(false);const result=settleRun(p,r,{sell:0,eat:0,donate:0},[]);assert.equal(result.boatPay,14);
});
test('cooking each recipe persists once and offsets meals only when a fish is kept',()=>{
 for(const recipe of ['citrus','stew']){const p=freshProfile(),r=startRun(p,'gardens','none');r.cargo=[{id:'one',weight:1,value:20}];new Simulation(p,r).finish(false);completeCooking(p,recipe,[1,.8,.9]);assert.equal(validateProfile(p).pending.cooking.recipe,recipe);assert.throws(()=>completeCooking(p,recipe,[1,1,1]));assert.equal(outingExpenses(r,0)-outingExpenses(r,1),12);}
});
test('boat steering and stopping govern all five buoy arrivals; analytic swell is continuous',()=>{
 const b=newBoat();for(let i=0;i<600;i++)updateBoatTravel(b,1/60,1,.2);assert.ok(b.distance>80);assert.notEqual(b.yaw,.4);assert.ok(Math.abs(oceanHeight(2,3,4.001)-oceanHeight(2,3,4))<.01);
 for(const [id,point] of Object.entries(BAY_SITES)){Object.assign(b,{x:point.x,z:point.z,speed:8});assert.equal(arrivalSite(b),null);b.speed=0;assert.equal(arrivalSite(b),id);}
 const boat=skiffGeometry();assert.ok(boat.indices.length/3<10000&&boat.indices.length/3>4000);assert.ok(boat.positions.every(Number.isFinite));
});

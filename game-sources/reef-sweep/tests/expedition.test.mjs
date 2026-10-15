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
import { collectionMotion, CollectionRig } from '../build/render/collection-motion.js';
import { EXPLORATION_ROUTES } from '../build/game/site-authorship.js';
import { siteForRun, floorHeight, freePoint, siteTerrainKey, healthOfReef, clearedDebris } from '../build/game/data.js';
import { clearSegment, homeRoute } from '../build/game/navigation.js';
import { acceptMilestoneOpportunity, milestoneObjectiveStatus } from '../build/game/campaign.js';
import { outbreakPlan } from '../build/game/expedition.js';
import { nextCharacterMoment, receiptView } from '../build/ui/campaign-ui.js';
import { seaStar } from '../build/render/marine-life.js';
import { equipment } from '../build/render/geometry.js';
const tick=(s,t,input={})=>{for(let i=0;i<t*60;i++)s.update(1/60,{...EMPTY_INPUT,...input});};

test('five new terrain layouts have open authored exploration routes, distinct relief and revision-safe saves',()=>{
 const signatures=[];
 for(const site of Object.values(SITES)){
  const old=siteForRun({site:site.id,siteRevision:2});assert.notEqual(siteTerrainKey(old),siteTerrainKey(site));
  let changed=0;for(let x=-40;x<=40;x+=8)for(let z=-40;z<=48;z+=8)if(Math.abs(floorHeight(x,z,site)-floorHeight(x,z,old))>1)changed++;
  assert.ok(changed>=10,site.id+' has meaningful new landforms');
  signatures.push([-30,-15,0,15,30].map(x=>floorHeight(x,12,site).toFixed(1)).join(','));
  for(const route of EXPLORATION_ROUTES[site.id]){
   const points=route.points.map(([x,y,z])=>({x,y,z}));
   points.forEach((point,i)=>{assert.ok(freePoint(point,site,.85),site.id+'/'+i+' swimming clearance');if(i)assert.ok(clearSegment(points[i-1],point,site),site.id+'/'+i+' route segment');});
   for(const point of points){const home=homeRoute(point,site);for(let i=1;i<home.length;i++)assert.ok(clearSegment(home[i-1],home[i],site),site.id+' return from '+JSON.stringify(point));}
  }
  const p=freshProfile();p.reputation=100;p.totalRemoved=100;p.tutorial=1;const r=startRun(p,site.id,'none');
  assert.equal(r.siteRevision,3);assert.equal(validateProfile(p).active.siteRevision,3);
  r.siteRevision=2;assert.equal(siteForRun(validateProfile(p).active),old,'old outings retain exact terrain object');
 }
 assert.equal(new Set(signatures).size,5);
});
test('a flooded mask cannot block home boarding with less than two bar, including affordable boundary',()=>{
 for(const air of [.01,.2,1.5,2,5]){
  const p=freshProfile();p.tutorial=1;const r=startRun(p,'gardens','none'),s=new Simulation(p,r);r.p={...s.site.landmarks[0].p,y:s.site.surface+.25};r.air=air;r.maskFlood=.24;r.cargo=[{id:'safe',value:20,weight:1}];
  s.updateAim();assert.equal(s.aim.kind,'boat');assert.equal(s.aim.valid,true);
  tick(s,1.3,{interact:true});assert.ok(r.finished);assert.equal(r.rescued,false);assert.equal(r.cargo.length,1);
 }
});
test('treatment cohorts never impersonate rubbish progress or grant accidental reef health',()=>{
 const p=freshProfile();p.audience=160;p.reputation=8;
 for(const site of Object.values(SITES))p.reefs[site.id].cleaned=site.worksites.debris.map((_,i)=>'debris-'+i);
 p.reefs.gardens.cleaned.pop();const health=healthOfReef(p,'gardens');
 p.reefs.gardens.cleaned.push('outbreak-2-0','outbreak-2-1','outbreak-2-2','debris-999');
 assert.equal(clearedDebris(p,'gardens'),SITES.gardens.worksites.debris.length-1);assert.equal(healthOfReef(p,'gardens'),health);
 const loaded=validateProfile(p);assert.equal(loaded.reefs.gardens.treatments.length,3);assert.ok(!loaded.reefs.gardens.cleaned.some(id=>id.startsWith('outbreak')));
 assert.ok(acceptMilestoneOpportunity(loaded,'recognition-160').ok);loaded.published.push('turtle');assert.equal(milestoneObjectiveStatus(loaded,'recognition-160').complete,false);
 loaded.reefs.gardens.cleaned.push('debris-'+(SITES.gardens.worksites.debris.length-1));assert.equal(milestoneObjectiveStatus(loaded,'recognition-160').complete,true);
});
test('mixed size sales select market fish before juveniles regardless of capture order and reject juvenile sales',async()=>{
 const {allocateCatch}=await import('../build/game/expedition.js');
 for(const offset of [0,1,2,3,4]){
  const p=freshProfile(),r=startRun(p,'gardens','catch');r.cargo=Array.from({length:4},(_,i)=>({id:'adult-'+i,weight:1,value:20}));r.cargo.splice(offset,0,{id:'juvenile',weight:.2,value:0,size:.5});
  const before=structuredClone(r.cargo),a=allocateCatch(r.cargo,{sell:4,eat:1,donate:0});assert.equal(a.eat[0].id,'juvenile');assert.equal(a.sell.length,4);assert.deepEqual(r.cargo,before);
  const donations=allocateCatch(r.cargo,{sell:3,eat:1,donate:1});assert.equal(donations.eat[0].id,'juvenile');assert.equal(donations.donate.length,1);
  assert.throws(()=>allocateCatch(r.cargo,{sell:5,eat:0,donate:0}),/market-size/);
  new Simulation(p,r).finish(false);const out=settleRun(p,r,{sell:4,eat:1,donate:0},[]);assert.equal(out.sales,80);assert.equal(out.contract,45);
 }
});

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
  for(let i=0;i<3;i++)labels.push({name:'T'+(i+1)+' response',x:size*.45+i*6,y:size*.70+i*3});
  labels.push({name:'Long field station beside the offshore drop',x:size-8,y:size-12});
  labels.push({name:'Outfall survey',x:size-9,y:size-14});
  const packed=layoutChartLabels(labels,size,t=>t.length*8);
  assert.deepEqual(packed,layoutChartLabels(labels,size,t=>t.length*8));
  packed.forEach((l,i)=>{assert.ok(!(l.x>l.left&&l.x<l.left+l.width&&l.y>l.top&&l.y<l.top+l.height),'label must not cover its own marker');assert.ok(l.left>=0&&l.top>=0&&l.left+l.width<=size&&l.top+l.height<=size-40);for(const other of packed.slice(i+1))assert.ok(l.left+l.width+4<=other.left||other.left+other.width+4<=l.left||l.top+l.height+4<=other.top||other.top+other.height+4<=l.top);});
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
test('field reports visit one site per window, use varied terrain anchors and remember completed cohorts',()=>{
 const p=freshProfile();p.reputation=100;p.totalRemoved=100;p.tutorial=1;const sites=[];
 for(const day of [8,12,16,20,24]){
  p.day=day;const report=outbreakPlan(p);sites.push(report.site);
  for(const id of Object.keys(SITES)){p.active=null;const r=startRun(p,id,'none'),jobs=r.jobs.filter(j=>j.kind==='outbreak');assert.equal(jobs.length,id===report.site?3:0);for(const j of jobs)assert.ok(freePoint(j.p,SITES[id],.15));}
  p.reefs[report.site].treatments=report.targets.map(t=>t.id);assert.equal(outbreakPlan(p).remaining,0);p.active=null;
  assert.equal(startRun(p,report.site,'none').jobs.filter(j=>j.kind==='outbreak').length,0);
 }
 assert.equal(new Set(sites).size,5);const young=freshProfile();young.day=24;young.reputation=20;young.totalRemoved=18;assert.notEqual(outbreakPlan(young).site,'harbour','reports only ask for reachable sites');p.active=null;p.day=28;assert.equal(outbreakPlan(p).site,'gardens');assert.equal(outbreakPlan(p).remaining,3);assert.notDeepEqual(outbreakPlan(p).targets.map(t=>[t.x,t.z]),[[-6,-17],[23,19],[-27,27]]);
 assert.equal(nextCharacterMoment(p).id,'outbreak-report');
 const target=seaStar(true),ambient=seaStar(false);assert.ok(target.indices.length/3<3000);assert.ok(target.indices.length>ambient.indices.length);assert.ok(target.positions.every(Number.isFinite));
});
test('staged treatment safely yields to looking away, spear draw and scooter, then resumes without rewards',()=>{
 const p=freshProfile();p.day=8;p.reputation=20;p.totalRemoved=18;p.tutorial=1;p.upgrades=['scooter'];
 const r=startRun(p,'gardens','none'),s=new Simulation(p,r),j=r.jobs.find(j=>j.kind==='outbreak');
 s.aim={kind:'job',id:j.id,distance:2,label:'target',hint:'',valid:true};for(let i=0;i<90;i++)s.work(1/60,true);assert.equal(r.treatmentTarget,j.id);s.work(1/60,false);assert.equal(j.stage,2);
 s.aim={kind:'none',id:'',distance:0,label:'',hint:'',valid:false};s.work(1/60,false);assert.equal(r.treatmentTarget,undefined);assert.equal(j.stage,2);
 s.aim={kind:'job',id:j.id,distance:2,label:'target',hint:'',valid:true};s.work(1/60,true);assert.equal(r.treatmentTarget,j.id);
 r.charge=.4;s.work(1/60,true);assert.equal(r.treatmentTarget,undefined);assert.equal(j.done,false);r.charge=0;
 s.work(1/60,true);s.toggleScooter();assert.equal(r.treatmentTarget,undefined);assert.equal(r.scooter,true);for(let i=0;i<120;i++)s.work(1/60,true);assert.equal(j.done,false);
 s.toggleScooter();for(let i=0;i<110;i++)s.work(1/60,true);assert.equal(j.done,true);assert.equal(r.treated,1);assert.equal(r.treatmentTarget,undefined);assert.equal(validateProfile(p).active.treated,1);
 s.finish(false);const result=settleRun(p,r,{sell:0,eat:0,donate:0},[]);assert.equal(result.treatmentPay,14);assert.match(receiptView(p,result),/1 marked outbreak targets treated/);
});
test('cooking each recipe persists once and offsets meals only when a fish is kept',()=>{
 for(const recipe of ['citrus','stew']){const p=freshProfile(),r=startRun(p,'gardens','none');r.cargo=[{id:'one',weight:1,value:20}];new Simulation(p,r).finish(false);completeCooking(p,recipe,[1,.8,.9]);assert.equal(validateProfile(p).pending.cooking.recipe,recipe);assert.throws(()=>completeCooking(p,recipe,[1,1,1]));assert.equal(outingExpenses(r,0)-outingExpenses(r,1),12);}
});
test('boat steering and stopping govern all five buoy arrivals; analytic swell is continuous',()=>{
 const b=newBoat();for(let i=0;i<600;i++)updateBoatTravel(b,1/60,1,.2);assert.ok(b.distance>80);assert.notEqual(b.yaw,.4);assert.ok(Math.abs(oceanHeight(2,3,4.001)-oceanHeight(2,3,4))<.01);
 for(const [id,point] of Object.entries(BAY_SITES)){Object.assign(b,{x:point.x,z:point.z,speed:8});assert.equal(arrivalSite(b),null);b.speed=0;assert.equal(arrivalSite(b),id);}
 const boat=skiffGeometry();assert.ok(boat.indices.length/3<10000&&boat.indices.length/3>4000);assert.ok(boat.positions.every(Number.isFinite));
});
test('collection motion joins insertion to withdrawal continuously and raises the portrait tube before insertion',()=>{
 const p=freshProfile(),r=startRun(p,'gardens','none');r.exposed={id:'f',weight:1,value:20};r.interactionId='held';r.interaction=1;
 const inserted=collectionMotion(r),portrait=collectionMotion(r,.46);assert.ok(portrait.mouth.x>inserted.mouth.x);assert.equal(inserted.insert,.8);
 r.transfer={catches:[r.exposed],started:r.time};r.exposed=null;
 const committed=collectionMotion(r);assert.deepEqual(committed.spear,inserted.spear);assert.equal(committed.approach,inserted.approach);
 r.time+=1.35;const withdrawn=collectionMotion(r);assert.ok(Math.hypot(...Object.values(withdrawn.spear))<1e-8);
});
test('portrait rig stows the entire tube below view, raises before approaching and eases cancelled holds and rotation',()=>{
 const p=freshProfile(),r=startRun(p,'gardens','none'),rig=new CollectionRig();
 let pose=rig.update(r,.46,1/60);assert.ok(pose.tubeAngle>1.3);
 // Project every barrel vertex against the vertical half-FOV, including its rim.
 const tube=equipment('tube'),co=Math.cos(pose.tubeAngle),si=Math.sin(pose.tubeAngle);
 for(let i=0;i<tube.positions.length;i+=3){const y=tube.positions[i+1]*co-tube.positions[i+2]*si+pose.tubePosition.y,z=tube.positions[i+1]*si+tube.positions[i+2]*co+pose.tubePosition.z;assert.ok(y/z < -Math.tan(100*Math.PI/360),'tube stays below central portrait view');}
 r.exposed={id:'one',weight:1,value:1};r.interactionId='held';r.interaction=.24;pose=rig.update(r,.46,1/60);assert.equal(pose.tubeAngle,0);assert.equal(pose.approach,0);
 r.interaction=.65;pose=rig.update(r,.46,1/60);const before=pose.spear.x;r.interaction=0;r.interactionId='';pose=rig.update(r,.46,1/60);assert.ok(pose.spear.x<0&&pose.spear.x>before,'cancel retracts instead of snapping');assert.equal(r.cargo.length,0);
 for(let i=0;i<90;i++)pose=rig.update(r,.46,1/60);assert.ok(pose.tubeAngle>1.39);assert.equal(pose.approach,0);
 pose=rig.update(r,2.16,1/60);assert.ok(pose.tubeAngle>0&&pose.tubeAngle<1.40,'rotation is eased');for(let i=0;i<90;i++)pose=rig.update(r,2.16,1/60);assert.ok(pose.tubeAngle<.001);assert.ok(Math.abs(pose.mouth.x+.64)<.001);
});
test('an exposed fish near the home buoy can be stashed before ascending',()=>{
 const p=freshProfile();p.tutorial=1;const r=startRun(p,'gardens','none'),s=new Simulation(p,r);r.exposed={id:'fish-0',weight:1,value:20};r.p={...SITES.gardens.entry};s.updateAim();assert.equal(s.aim.id,'held');tick(s,1.5,{interact:true});assert.equal(r.cargo.length,1);
});
test('Shishkabob retains its automatic capture trigger even after eight earlier photos',()=>{
 const p=freshProfile(),r=startRun(p,'gardens','none'),s=new Simulation(p,r);for(let i=0;i<8;i++)s.highlight('prior-'+i,'Earlier moment','fixture',40+i);s.highlight('shishkabob','Shishkabob','two catches',95);assert.equal(r.clips.length,8);assert.ok(r.clips.some(c=>c.kind==='shishkabob'));assert.ok(s.events.some(e=>e.type==='highlight'&&e.text==='Shishkabob'));
});

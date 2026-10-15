// Deterministic economic fixtures. Activity completion is injected; this is
// settlement/progression evidence, not a natural playthrough or travel-time test.
import fs from 'node:fs';
import {freshProfile,buy} from '../build/game/profile.js';
import {startRun,settleRun,Simulation,prepareFillets} from '../build/game/simulation.js';
import {SITES,siteUnlocked} from '../build/game/data.js';
import {contractOptions,approachResearch,acceptResearch,recordSurveyStation} from '../build/game/campaign.js';
import {restaurantValue} from '../build/game/expedition.js';
const scenarios=[];
for(const style of ['careful-kitchen','conservation-only']){
 const p=freshProfile();p.tutorial=1;const rows=[];
 for(let day=0;day<15;day++){
  if(p.reputation>=8){approachResearch(p);acceptResearch(p);}
  const sites=Object.keys(SITES).filter(id=>siteUnlocked(p,id)).sort((a,b)=>p.reefs[a].visits-p.reefs[b].visits),site=sites[0];
  const options=contractOptions(p,site),kinds=style==='careful-kitchen'?['catch','cleanup','restore','research','none']:['cleanup','restore','research','none'];
  const order=kinds.find(kind=>options.some(o=>o.kind===kind&&o.available));
  const run=startRun(p,site,order),reef=p.reefs[site];run.time=480;
  if(style==='careful-kitchen'){
   const fish=run.fish.filter(f=>f.alive&&restaurantValue(f.weight,f.size)>0).slice(0,4);
   run.cargo=fish.map(f=>({id:f.id,size:f.size,weight:f.weight,value:restaurantValue(f.weight,f.size)}));run.removed=fish.length;p.totalRemoved+=fish.length;reef.removed.push(...fish.map(f=>f.id));
  }
  for(const kind of ['debris','coral']){
   const limit=(order==='cleanup'&&kind==='debris'||order==='restore'&&kind==='coral')?2:1;
   for(const j of run.jobs.filter(j=>j.kind===kind&&!j.done).slice(0,limit)){j.done=true;if(kind==='debris'){run.cleaned++;p.totalCleaned++;reef.cleaned.push(j.id);}else{run.restored++;p.totalRestored++;run.fragments--;reef.restored[j.id]=p.day;j.stage=1;}}
  }
  if(order==='research')for(const j of run.jobs.filter(j=>j.kind==='survey').slice(0,2)){if(recordSurveyStation(p,run,j.id).ok){j.done=true;run.surveyed++;reef.surveys++;}}
  new Simulation(p,run).finish(false);if(run.cargo.length)prepareFillets(p,.65);
  const result=settleRun(p,run,{sell:run.cargo.length,eat:0,donate:0},[]),purchases=[];
  if(style==='careful-kitchen')for(const id of ['fins','scooter'])if(!p.upgrades.includes(id)&&buy(p,id))purchases.push(id);
  rows.push({day:run.day,site,order,marketFish:run.cargo.length,earned:result.earned,expenses:result.expenses,towingFuel:result.towingFuel,boatFuel:result.boatFuel,cash:p.cash,debt:p.debt,reputation:p.reputation,purchases});
 }
 if(rows.some(r=>r.debt>0))throw Error(style+' economic fixture enters debt');
 scenarios.push({style,rows});
}
const kitchen=scenarios[0].rows;
if(!kitchen.some(r=>r.day<=4&&r.purchases.includes('scooter')))throw Error('Early scooter pacing fixture regressed');
fs.mkdirSync('qa-output/expedition',{recursive:true});fs.writeFileSync('qa-output/expedition/balance.json',JSON.stringify({scope:'15-outing injected economic fixtures, production prices/fuel/contracts; not human pacing',scenarios},null,2));
console.log(JSON.stringify(scenarios.map(s=>({style:s.style,final:s.rows.at(-1),purchases:s.rows.filter(r=>r.purchases.length).map(r=>({day:r.day,purchases:r.purchases}))})),null,2));

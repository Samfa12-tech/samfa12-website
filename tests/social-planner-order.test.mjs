import {readFileSync} from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
const raw = readFileSync(new URL('../scripts/social-post.mjs', import.meta.url), 'utf8');
function planner(count = 10) {
  const source = raw.replace(/^import .*;\r?\n/gm, '').replace(/await main\(\);\s*$/, '').replaceAll('import.meta.url', JSON.stringify(new URL('../scripts/social-post.mjs', import.meta.url).href));
  return new Function('fs', 'crypto', 'process', source + '\nreturn { buildWeekPlan, weeklySlotTemplates };')({}, crypto, {env: {SOCIAL_WEEKLY_POST_COUNT: String(count)}});
}
const bank = {posts: Array.from({length:30}, (_,i)=>({id:`post-${i}`,project:`project-${i}`,category:i%2?'book':'game',text:`Text ${i}`}))};
test('ten slots remain chronological and use distinct posts across morning/evening',()=>{
 const {buildWeekPlan}=planner();
 for(let d=1;d<=28;d++){
  const plan=buildWeekPlan(bank,{posts:[]},`2026-11-${String(d).padStart(2,'0')}`);
  assert.equal(plan.length,10);
  assert.equal(new Set(plan.map(s=>s.post.id)).size,10);
  assert.deepEqual(plan.map(s=>s.dueAt),plan.map(s=>s.dueAt).sort());
 }
});
test('slot inventory and blocked queue entries are preserved',()=>{
 const {buildWeekPlan,weeklySlotTemplates}=planner();
 const blocked=new Set(['2026-11-03|17:15']);
 const plan=buildWeekPlan(bank,{posts:[]},'2026-11-02',blocked);
 assert.equal(plan.filter(s=>s.skipped).length,1);
 assert.equal(plan.filter(s=>!s.skipped).length,9);
 assert.deepEqual(plan.map(s=>`${s.date}|${s.hour}:${s.minute}`).sort(),weeklySlotTemplates().map(s=>`2026-11-${String(2+s.dayOffset).padStart(2,'0')}|${s.hour}:${s.minute}`).sort());
});
test('bank/history untouched, reuse restrictions retained, seven-post cadence unchanged',()=>{
 const history={posts:[{id:'post-0',project:'project-0',category:'game',date:'2026-11-01'}]};
 const before=JSON.stringify({bank,history});
 const plan=planner(7).buildWeekPlan(bank,history,'2026-11-02');
 assert.equal(plan.length,7);assert.ok(plan.every(s=>s.hour===8));assert.ok(plan.every(s=>s.post.id!=='post-0'));
 assert.equal(JSON.stringify({bank,history}),before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {preserveWithdrawnItch} from '../scripts/marketplace/withdrawn-itch.mjs';
test('withdrawn itch destinations removed, counts retained, surviving links untouched',()=>{
 const old={id:'1',title:'ToKnight',url:'https://samfa12.itch.io/toknight',views:100,downloads:5,purchases:2};
 const sober={...old,id:'2',title:'Sober',url:'https://samfa12.itch.io/sober'};
 const result=preserveWithdrawnItch({projects:[sober]},[old]);
 assert.equal(result.projects.find(p=>p.id==='1').url,'');assert.equal(result.projects.find(p=>p.id==='1').listingStatus,'withdrawn');assert.equal(result.projects.find(p=>p.id==='2').url,sober.url);assert.equal(result.totals.views,200);
 const again=preserveWithdrawnItch({projects:[sober]},result.projects);assert.deepEqual(again,result);
});
test('all platforms have individual static cards in the same release grid',async()=>{
 const html=await readFile(new URL('../stats/index.html',import.meta.url),'utf8');
 assert.ok(!html.includes('audience-title'));assert.ok(!html.includes('Played on Spawn'));assert.equal((html.match(/data-marketplace-projects/g)||[]).length,1);
 for(const platform of ['itch.io','Steam','Google Play','Amazon KDP','Wavedash','Spawn'])assert.ok(html.includes(`<p class="technical-label">${platform}</p>`));
 assert.ok(html.includes('15h 29m 34s'));assert.ok(html.includes('final day partial'));assert.ok(!html.includes('Historical listing: no longer available'));
 assert.ok(!html.includes('href="https://samfa12.itch.io/toknight'));
 const js=await readFile(new URL('../script.js',import.meta.url),'utf8');assert.ok(!js.includes('marketplaceProjects.replaceChildren'));
});

test('withdrawn itch book cards stay hidden while supported exceptions remain', async () => {
 const html = await readFile(new URL('../stats/index.html', import.meta.url), 'utf8');
 const stats = JSON.parse(await readFile(new URL('../data/public-stats.json', import.meta.url), 'utf8'));
 const cards = [...html.matchAll(/<article class="stats-project-panel">[\s\S]*?<\/article>/g)].map(match => match[0]).filter(card => card.includes('<p class="technical-label">itch.io</p>'));
 for (const project of stats.projects.itch.filter(project => project.listingStatus === 'withdrawn')) {
   assert.ok(!cards.some(card => card.includes(`<h3>${project.title}</h3>`)), project.title);
 }
 for (const title of ['Article 18', 'Backwater (Vertical Slice Prototype)', 'Dust on the River', 'Sober: A novel set in the world of Drink (Amazon)']) {
   assert.ok(cards.some(card => card.includes(`<h3>${title}</h3>`)), title);
 }
 assert.equal(cards.length, stats.projects.itch.filter(project => project.listingStatus !== 'withdrawn').length);
});

import { isWithdrawnItch } from './marketplace/withdrawn-itch.mjs';
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const file = new URL('stats/index.html', root);
const load = async name => JSON.parse(await readFile(new URL(`data/${name}.json`, root), 'utf8'));
const [spawn, wavedash, market] = await Promise.all(['spawn-stats','wavedash-stats','public-stats'].map(load));
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const format = value => typeof value === 'number' ? new Intl.NumberFormat('en-AU').format(value) : value;
const card = (title, platform, period, values, note = '') => `<article class="stats-project-panel"><p class="technical-label">${escape(platform)}</p><h3>${escape(title)}</h3><p class="stats-panel-note">${escape(period)}</p>${values.length ? `<dl class="stats-release-metrics">${values.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(format(value))}</dd></div>`).join('')}</dl>` : '<p>Not collected for this update.</p>'}${note ? `<p class="stats-panel-note">${escape(note)}</p>` : ''}</article>`;
const cards = [];
for (const [key, label, metrics] of [
 ['itch','itch.io',[['Views','views'],['Downloads','downloads'],['Purchases','purchases']]],
 ['steam','Steam',[['Gross units','grossUnits'],['Returned','returnedUnits'],['Net units','netUnits']]],
 ['googlePlay','Google Play',[['Gross purchases','grossPaidAppPurchases'],['Fully refunded','fullyRefundedPaidAppOrders'],['Net purchases','netPaidAppPurchases']]],
 ['amazon','Amazon KDP',[['Net sales','netUnits'],['KENP read','pagesRead']]],
]) for (const game of market.projects[key] || []) {
 // Keep historical source counters, but never advertise withdrawn itch releases.
 if (key === 'itch' && isWithdrawnItch(game)) continue;
 cards.push(card(game.title,label,`Lifetime figures; refreshed ${market.generatedAt.slice(0,10)} (UTC)`,metrics.map(([name,field])=>[name,game[field]])));
}
for (const game of wavedash.projects) cards.push(card(game.title,'Wavedash',`${wavedash.period}; ${wavedash.timezone}; final day partial`,game.unavailable ? [] : [['Players',game.players],['Plays',game.plays],['Time played',game.timePlayed]],'Dated snapshot, not lifetime totals.'));
for (const game of spawn.projects) cards.push(card(game.title,'Spawn',`All-time; captured ${spawn.capturedAt.slice(0,10)} (UTC); provider date ${spawn.providerAsOf}`,[['Plays',game.plays],['Players',game.players],['Likes',game.likes]]));
const block = `<!-- SPAWN STATS START -->
      <section class="section stats-projects" aria-labelledby="stats-projects-title"><div class="container">
        <div class="section-head"><div><p class="eyebrow">Project detail</p><h2 id="stats-projects-title">Stats by release and platform</h2><p class="section-intro">Each card represents one release on one platform. Reporting periods are shown on the cards; plays, downloads and sales are different measures.</p></div></div>
        <div class="stats-project-grid" data-marketplace-projects>${cards.join('\n')}</div>
        <details><summary>Reporting periods and sources</summary><p>Wavedash: ${escape(wavedash.note)}</p><p>Spawn: ${escape(spawn.note)}</p><p>Spawn snapshots refresh on Mondays when source access is available. Capture dates show the latest successful refresh. Per-game player counts must not be added together as unique people.</p><p>Storefront figures retain their original lifetime counters. Withdrawn itch.io listings are omitted from release cards; historical lifetime totals are preserved.</p></details>
      </div></section>
      <!-- SPAWN STATS END -->`;
const html = await readFile(file, 'utf8');
const updated = html.replace(/<!-- SPAWN STATS START -->[\s\S]*?<!-- SPAWN STATS END -->/, block);
if (!html.includes('<!-- SPAWN STATS START -->')) throw new Error('Stats fragment marker missing.');
if (process.argv.includes('--check')) { if (html !== updated) throw new Error('Statistics HTML is stale.'); }
else await writeFile(file, updated);

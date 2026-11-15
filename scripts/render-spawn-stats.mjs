import { statsThumbnail } from './stats-artwork.mjs';
import { isWithdrawnItch } from './marketplace/withdrawn-itch.mjs';
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const file = new URL('stats/index.html', root);
const load = async name => JSON.parse(await readFile(new URL(`data/${name}.json`, root), 'utf8'));
const [spawn, wavedash, market] = await Promise.all(['spawn-stats','wavedash-stats','public-stats'].map(load));
const steamReport = await load('steam-sales-report');
const catalogue = await load('projects');
const steamReportMatches = market.projects.steam.length === 1 && market.projects.steam[0].appId === '4419290' && ['grossUnits','returnedUnits','netUnits'].every(key => steamReport.totals[key] === market.totals.steam[key]);
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const format = value => typeof value === 'number' ? new Intl.NumberFormat('en-AU').format(value) : value;
const card = (title, platform, period, values, note = '') => `<article class="stats-project-panel"><div class="stats-card-heading">${statsThumbnail(title,platform,catalogue)}<div><p class="technical-label">${escape(platform)}</p><h3>${escape(title)}</h3></div></div><p class="stats-panel-note">${escape(period)}</p>${values.length ? `<dl class="stats-release-metrics">${values.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(format(value))}</dd></div>`).join('')}</dl>` : '<p>Not collected for this update.</p>'}${note ? `<p class="stats-panel-note">${escape(note)}</p>` : ''}</article>`;
const cards = [];
for (const [key, label, metrics] of [
 ['itch','itch.io',[['Views','views'],['Downloads','downloads'],['Purchases','purchases']]],
 ['steam','Steam',[['Gross units','grossUnits'],['Returned','returnedUnits'],['Net units','netUnits']]],
 ['googlePlay','Google Play',[['Gross purchases','grossPaidAppPurchases'],['Fully refunded','fullyRefundedPaidAppOrders'],['Net purchases','netPaidAppPurchases']]],
 ['amazon','Amazon KDP',[['Net sales','netUnits'],['KENP read','pagesRead']]],
]) for (const game of market.projects[key] || []) {
 // Keep historical source counters, but never advertise withdrawn itch releases.
 if (key === 'itch' && isWithdrawnItch(game)) continue;
 if (key === 'steam' && steamReportMatches) continue;
 cards.push(card(game.title,label,`Lifetime figures; refreshed ${market.generatedAt.slice(0,10)} (UTC)`,metrics.map(([name,field])=>[name,game[field]]),game.pagesReadUpdatedAt ? `KENP read updated ${game.pagesReadUpdatedAt}; other counters retain their original refresh date.` : ''));
}
if (steamReportMatches) for (const game of steamReport.projects) cards.push(card(game.title,'Steam',`${steamReport.periodStart} to ${steamReport.periodEnd}; report received ${steamReport.capturedAt}`, [['Gross units',game.grossUnits],['Returned',game.returnedUnits],['Net units',game.netUnits]], 'Paid units, not unique customers; press and review keys excluded.'));
for (const game of wavedash.projects) cards.push(card(game.title,'Wavedash',game.unavailable ? 'Metrics pending verification' : `${wavedash.period}; ${wavedash.timezone}; final day partial`,game.unavailable ? [] : [['Players',game.players],['Plays',game.plays],['Time played',game.timePlayed]],game.unavailable ? 'No verified figures available; this does not mean zero activity.' : 'Dated snapshot, not lifetime totals.'));
for (const game of spawn.projects) cards.push(card(game.title,'Spawn',`All-time; captured ${spawn.capturedAt.slice(0,10)} (UTC); provider date ${spawn.providerAsOf}`,[['Plays',game.plays],['Players',game.players],['Likes',game.likes]]));

const availableWavedash = wavedash.projects.filter(game => !game.unavailable);
const seconds = value => { const match = /^(\d+)h (\d+)m (\d+)s$/.exec(value); if (!match) throw new Error('Invalid playtime'); return +match[1]*3600 + +match[2]*60 + +match[3]; };
const playedSeconds = availableWavedash.reduce((sum,game)=>sum+seconds(game.timePlayed),0);
const duration = `${Math.floor(playedSeconds/3600)}h ${Math.floor(playedSeconds%3600/60)}m ${playedSeconds%60}s`;
const summary = (platform, label, value, details, note) => `<article class="marketplace-stat-card"><p class="technical-label">${platform}</p><dl class="marketplace-stat-primary"><div class="marketplace-stat-metric"><dt>${label}</dt><dd>${format(value)}</dd></div></dl><p>${escape(details)}</p><p class="marketplace-stat-change">${escape(note)}</p></article>`;
const browserOverview = summary('Wavedash','Plays in reporting period',availableWavedash.reduce((sum,game)=>sum+game.plays,0),`${duration} played across ${availableWavedash.length} tracked games.`,`${wavedash.period}; ${wavedash.timezone}; final day partial. Rolling snapshot, not lifetime.`) + summary('Spawn','Provider all-time plays',spawn.projects.reduce((sum,game)=>sum+game.plays,0),`Across ${spawn.projects.length} tracked editions. Playtime not supplied.`,`Captured ${spawn.capturedAt.slice(0,10)} UTC; provider date ${spawn.providerAsOf}. Provider cut-off timezone unconfirmed.`);

const block = `<!-- SPAWN STATS START -->
      <template data-browser-platform-summary>${browserOverview}</template>
      <section class="section stats-projects" aria-labelledby="stats-projects-title"><div class="container">
        <div class="section-head"><div><p class="eyebrow">Project detail</p><h2 id="stats-projects-title">Stats by release and platform</h2><p class="section-intro">Each card represents one release on one platform. Reporting periods are shown on the cards; plays, downloads and sales are different measures.</p></div></div>
        <div class="catalogue-controls" data-stats-filters hidden></div>
        <p data-stats-filter-status role="status" aria-live="polite" hidden></p>
        <div id="stats-release-grid" class="stats-project-grid" data-marketplace-projects>${cards.join('\n')}</div>
        <p data-stats-empty hidden>No releases match. Try a different platform or clear your search.</p>
        <details><summary>Reporting periods and sources</summary><p>Wavedash: ${escape(wavedash.note)}</p><p>Spawn: ${escape(spawn.note)}</p><p>Spawn snapshots refresh on Mondays when source access is available. Capture dates show the latest successful refresh. Per-game player counts must not be added together as unique people.</p><p>Storefront figures retain their original lifetime counters. Withdrawn itch.io listings are omitted from release cards; historical lifetime totals are preserved.</p></details>
      </div></section>
      <!-- SPAWN STATS END -->`;
const html = await readFile(file, 'utf8');
const updated = html.replace(/<!-- SPAWN STATS START -->[\s\S]*?<!-- SPAWN STATS END -->/, block);
if (!html.includes('<!-- SPAWN STATS START -->')) throw new Error('Stats fragment marker missing.');
if (process.argv.includes('--check')) { if (html !== updated) throw new Error('Statistics HTML is stale.'); }
else await writeFile(file, updated);

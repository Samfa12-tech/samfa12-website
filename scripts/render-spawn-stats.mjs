import { readFile, writeFile } from 'node:fs/promises';
const file = new URL('../stats/index.html', import.meta.url);
const snapshot = JSON.parse(await readFile(new URL('../data/spawn-stats.json', import.meta.url), 'utf8'));
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const format = value => new Intl.NumberFormat('en-AU').format(value);
const block = `<!-- SPAWN STATS START -->
      <section class="section" aria-labelledby="spawn-stats-title"><div class="container">
        <div class="section-head"><div><p class="eyebrow">Spawn editions</p><h2 id="spawn-stats-title">Played on Spawn</h2>
        <p class="section-intro">All-time activity for these six editions, kept separate from marketplace sales and Wavedash plays.</p></div></div>
        <p>Snapshot captured ${escape(snapshot.capturedAt.slice(0,10))} (UTC). Spawn reporting date: ${escape(snapshot.providerAsOf)}.</p>
        <div class="stats-project-grid">${snapshot.projects.map(game => `<article class="stats-project-panel"><h3>${escape(game.title)}</h3><p>${format(game.plays)} plays � ${format(game.players)} players � ${format(game.likes)} likes</p></article>`).join('\n')}</div>
        <p class="section-intro">${escape(snapshot.note)}</p>
        <p>Refreshed on Mondays when source access is available. The capture date above shows the latest successful refresh.</p>
      </div></section>
      <!-- SPAWN STATS END -->`;
const html = await readFile(file, 'utf8');
const updated = html.includes('<!-- SPAWN STATS START -->') ? html.replace(/<!-- SPAWN STATS START -->[\s\S]*?<!-- SPAWN STATS END -->/, block) : html.replace('    </main>', `      ${block}\n    </main>`);
if (process.argv.includes('--check')) { if (html !== updated) throw new Error('Spawn statistics HTML is stale.'); }
else await writeFile(file,updated);

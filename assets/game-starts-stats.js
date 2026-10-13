import {validateStartStats, summarizeGame} from './game-starts-model.js';

function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
export function renderStartStats(root, value) {
  const data = validateStartStats(value);
  root.replaceChildren();
  if (!data || !['ok', 'fixture'].includes(data.status)) {
    root.append(element('p', data?.status === 'disabled'
      ? 'Start tracking is not enabled yet. Briarhold and Reef Sweep totals will appear after tracking begins.'
      : 'Start statistics are unavailable. Missing data is not counted as zero.'));
    return;
  }
  root.append(element('p', data.status === 'fixture' ? 'LOCAL TEST FIXTURE — these numbers are invented for testing, not player activity.' : `Updated ${data.updatedAt} · UTC`, 'stats-panel-note'));
  if (data.status === 'ok' && Date.now() - Date.parse(data.updatedAt) > 3 * 86_400_000)
    root.append(element('p', 'This snapshot is over three days old. Today means its update date, not current live activity.', 'stats-panel-note'));
  for (const game of data.games) {
    const summary = summarizeGame(game, data.updatedAt);
    const article = element('article', undefined, 'stats-trend-panel');
    article.append(element('h3', summary.title));
    const table = element('table', undefined, 'game-starts-table');
    const caption = element('caption', `Consenting browser starts since ${summary.trackingSince} · not unique players`);
    table.append(caption);
    const head = element('thead'), header = element('tr');
    for (const label of ['Period', 'Recorded starts', 'Coverage']) { const th = element('th', label); th.scope='col'; header.append(th); }
    head.append(header); table.append(head);
    const body = element('tbody');
    const addRow = (period, count, coverage) => {
      const row = element('tr'); const th = element('th',period); th.scope='row';
      row.append(th,element('td', count === null ? 'Unavailable' : String(count)), element('td',coverage)); body.append(row);
    };
    addRow('Today (partial UTC day)', summary.today?.starts ?? null, summary.today?.coverage || 'Missing');
    addRow('Previous 7 complete UTC days', summary.weekly, summary.missing.length ? `${summary.missing.length} day${summary.missing.length === 1 ? '' : 's'} incomplete; ${summary.weeklyObserved} starts observed` : 'Complete');
    addRow('Since tracking began', summary.cumulativeObserved, summary.lifetimeGaps ? `${summary.lifetimeGaps} day${summary.lifetimeGaps === 1 ? '' : 's'} incomplete; observed total` : 'Observed total; today is partial');
    for (const row of summary.daily) addRow(row.day, row.starts, row.coverage);
    table.append(body); article.append(table); root.append(article);
  }
  if (!data.games.length) root.append(element('p','No games have verified tracking activation data yet.'));
}
export async function loadStartStats(root, {fetchImpl = fetch} = {}) {
  try {
    const response = await fetchImpl('/data/game-start-stats.json', {cache: 'no-store', signal: AbortSignal.timeout(5000)});
    renderStartStats(root, response.ok ? await response.json() : null);
  } catch { renderStartStats(root, null); }
}
if (typeof document !== 'undefined') {
  const root = document.querySelector('[data-game-start-stats]');
  if (root) void loadStartStats(root);
}

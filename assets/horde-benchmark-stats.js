import {loadPublicPage, PUBLIC_FILTERS} from './horde-public-api.js';

const FRAME_SCOPES = new Set(['completed-owning-render-entry-through-present', 'whole-frame-cycle']);
const known = value => value && value !== 'Unknown';
const titleCase = value => known(value) ? value.charAt(0).toUpperCase() + value.slice(1) : 'Not reported';
const number = value => new Intl.NumberFormat('en', {maximumFractionDigits: 2}).format(value);

// The service exposes medians, not an arithmetic mean or a measured gameplay FPS.
// Only use the owning frame's timing. GPU ray-tracing duration is never a fallback.
export function fpsEstimate(row) {
  if (!FRAME_SCOPES.has(row.cpuTimingScope) || !Number.isFinite(row.frameMedianMs) || row.frameMedianMs <= 0) return null;
  return Math.round(1000 / row.frameMedianMs);
}

export function hardwareName(row) {
  return known(row.model) ? row.model : known(row.gpu) ? row.gpu : 'Device not reported';
}

export function matchesHardware(row, search) {
  return `${known(row.model) ? row.model : ''} ${known(row.gpu) ? row.gpu : ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
}

export function mountPublicResults(root, transport) {
  if (!root) return;
  const doc = root.ownerDocument;
  const find = selector => root.querySelector(selector);
  const form = find('[data-public-filters]');
  const status = find('[data-public-status]');
  const results = find('[data-public-results]');
  const next = find('[data-public-next]');
  const retry = find('[data-public-retry]');
  const search = find('[data-hardware-search]');
  const sort = find('[data-sort-order]');
  const count = find('[data-public-count]');
  const searchHelp = find('[data-search-help]');
  let generation = 0, cursor = null, rows = [], matchingCount = 0, loading = false, retryPaging = false;

  function el(tag, text, className) {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function message(title, body) {
    const panel = el('div', undefined, 'benchmark-empty');
    panel.append(el('h3', title), el('p', body));
    results.replaceChildren(panel);
  }

  function report(row, index) {
    const card = el('article', undefined, 'benchmark-result');
    const body = el('div', undefined, 'benchmark-result-body');
    const hardware = el('div', undefined, 'benchmark-result-hardware');
    const meta = el('div', undefined, 'benchmark-result-meta');
    const date = el('time', row.dateUtc);
    // The service's public date is day-granular; no local timezone conversion.
    if (/^\d{4}-\d{2}-\d{2}$/.test(row.dateUtc)) date.dateTime = row.dateUtc;
    meta.append(el('span', row.platform, 'benchmark-platform'), date);
    const heading = el('h3', hardwareName(row));
    heading.id = `benchmark-report-${index}`;
    card.setAttribute('aria-labelledby', heading.id);
    hardware.append(meta, heading);
    if (known(row.model) && known(row.gpu) && row.model !== row.gpu) hardware.append(el('p', row.gpu, 'benchmark-secondary'));

    const setup = el('div', undefined, 'benchmark-result-setup');
    setup.append(el('p', 'Test settings', 'benchmark-setup-label'), el('p', `${row.internal} · Custom`, 'benchmark-resolution'));
    const quality = el('p', undefined, 'benchmark-quality');
    for (const [label, value] of [['Water', row.water], ['Glass', row.dielectric], ['Fire', row.fire]]) quality.append(el('span', `${label}: ${titleCase(value)}`));
    setup.append(quality);

    const fps = fpsEstimate(row);
    const performance = el('div', undefined, 'benchmark-fps');
    performance.append(el('p', 'Estimated FPS', 'benchmark-fps-label'));
    const value = el('span', fps === null ? '—' : `~${number(fps)}`, 'benchmark-fps-number');
    if (fps !== null) value.append(el('small', ' FPS'));
    performance.append(value, el('p', fps === null ? 'Frame timing unavailable' : 'Based on typical rendering time', 'benchmark-fps-note'), el('p', 'Average FPS: not reported', 'benchmark-average'));
    body.append(hardware, setup, performance);

    const details = el('details', undefined, 'benchmark-result-details');
    details.append(el('summary', 'Details & original timings'));
    const content = el('div', undefined, 'benchmark-detail-content');
    content.append(el('p', fps === null
      ? 'This report has no usable owning-frame timing, so an FPS estimate is unavailable. GPU time is not used to fill in the missing value.'
      : `The ~${number(fps)} FPS estimate is 1,000 divided by the median recorded rendering time (${number(row.frameMedianMs)} ms). It describes typical rendering throughput, not average FPS or measured screen output. Work outside this timing can make gameplay slower.`));
    content.append(el('p', 'Custom settings · Unverified community report · Not ranked. Test revisions and output policy are unavailable, so matching hardware or resolution does not establish an identical test.'));
    const list = el('dl');
    const ms = value => value === null ? 'Not reported' : `${number(value)} ms`;
    const fields = [
      ['Average FPS', 'Not reported; cannot be calculated from a median and a 95th percentile.'],
      ['Frame time (median)', ms(row.frameMedianMs)],
      ['Slow frame time (95th percentile)', ms(row.frameP95Ms)],
      ['GPU time (median)', ms(row.gpuMedianMs)],
      ['Recorded frames', number(row.sampleCount)],
      ['Render resolution', row.internal], ['Output resolution', row.output],
      ['Device model', row.model], ['Graphics card', row.gpu], ['Platform', row.platform],
      ['Graphics profile', row.profile], ['Rendering backend', row.backend],
      ['Game build', row.build], ['Shader versions', row.shaderPair],
      ['Configuration ID', row.bucket], ['Frame timing scope', row.cpuTimingScope],
      ['GPU timing scope', row.gpuTimingScope], ['Report ID', row.resultId],
    ];
    for (const [key, value] of fields) list.append(el('dt', key), el('dd', value));
    content.append(list);
    details.append(content);
    card.append(body, details);
    return card;
  }

  function render() {
    const visible = rows.filter(row => matchesHardware(row, search.value));
    results.replaceChildren(...visible.map(report));
    count.textContent = `${matchingCount} ${matchingCount === 1 ? 'report' : 'reports'}`;
    searchHelp.hidden = !cursor;
    next.hidden = !cursor;
    if (!visible.length) {
      message(search.value.trim() ? 'No matching hardware in these results' : 'No results yet', cursor ? 'Try another search, reset the filters, or load more results below.' : 'Try another device or platform, or reset the filters to see all reports.');
    }
    status.textContent = `${visible.length} ${visible.length === 1 ? 'result' : 'results'} shown${cursor ? ` · ${rows.length} of ${matchingCount} reports loaded` : ''}.`;
  }

  async function load(paging = false) {
    const token = ++generation;
    loading = true;
    retryPaging = paging;
    const query = {};
    for (const [key, value] of new FormData(form)) if (PUBLIC_FILTERS.includes(key) && value.trim()) query[key] = value.trim();
    query.limit = 100;
    query.sort = 'date';
    query.order = sort.value;
    if (paging && cursor) query.cursor = cursor;
    if (!paging) { rows = []; cursor = null; matchingCount = 0; results.replaceChildren(); count.textContent = 'Community reports'; }
    status.textContent = paging ? 'Loading more results…' : 'Loading results…';
    results.setAttribute('aria-busy', 'true');
    next.hidden = true;
    retry.hidden = true;
    searchHelp.hidden = true;
    try {
      const response = await loadPublicPage(query, transport);
      if (token !== generation) return;
      if (response.state === 'ready' || response.state === 'empty') {
        const page = response.page;
        const seen = new Set(rows.map(row => row.resultId));
        rows.push(...page.rows.filter(row => !seen.has(row.resultId)));
        cursor = page.nextCursor;
        matchingCount = page.matchingReportCount;
        render();
      } else {
        const states = {
          unavailable: ['Results are not available yet', 'The community results service is not connected. Please check back later.'],
          pending: ['Results are on their way', 'There are no new published results to show yet. Please try again later.'],
          error: ['We couldn’t load the results', 'Please try again in a moment.'],
          'restart-required': ['The results have changed', 'Refresh the list to see the latest reports.'],
        };
        const [title, description] = states[response.state] || states.error;
        if (!paging || !rows.length) message(title, description);
        status.textContent = `${title}. ${description}`;
        // Expired cursors must restart; transient failures retry the same page.
        if (response.state === 'restart-required') retryPaging = false;
        retry.hidden = false;
        retry.textContent = response.state === 'restart-required' ? 'Refresh results' : 'Try again';
      }
    } catch {
      if (token !== generation) return;
      if (!paging || !rows.length) message('We couldn’t load the results', 'Please try again in a moment.');
      status.textContent = 'Results could not be loaded safely. Please try again.';
      retry.hidden = false;
      retry.textContent = 'Try again';
    } finally {
      if (token === generation) { loading = false; results.setAttribute('aria-busy', 'false'); }
    }
  }

  form.addEventListener('submit', event => { event.preventDefault(); load(); });
  form.addEventListener('reset', () => setTimeout(() => load(), 0));
  form.elements.platform.addEventListener('change', () => load());
  sort.addEventListener('change', () => load());
  search.addEventListener('input', () => { if (!loading && rows.length) render(); });
  next.addEventListener('click', () => { if (!loading) load(true); });
  retry.addEventListener('click', () => { if (!loading) load(retryPaging); });
  load();
}

const endpoint = 'https://briarhold-signal.samfa12.com/api/horde-benchmark-stats';
const transport = query => fetch(`${endpoint}?${query}`, {
  method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
  headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(10000),
});
if (typeof document !== 'undefined') mountPublicResults(document.querySelector('.benchmark'), transport);

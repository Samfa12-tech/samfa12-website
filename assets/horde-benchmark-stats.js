import {loadPublicPage} from './horde-public-api.js?v=20261103-hardware-names';
import {fpsEstimate, aggregateResults, friendlyDeviceName, gpuName, isPublicHardwareIdentified} from './horde-benchmark-summary.js?v=20261103-hardware-names';
import {optionCatalog, matchesOptions, gameVersion} from './horde-benchmark-filters.js?v=20261103-hardware-names';
export {fpsEstimate} from './horde-benchmark-summary.js?v=20261103-hardware-names';

const known = value => value && value !== 'Unknown';
const titleCase = value => known(value) ? value.charAt(0).toUpperCase() + value.slice(1) : 'Not reported';
const number = value => new Intl.NumberFormat('en', {maximumFractionDigits: 2}).format(value);

// The service exposes medians, not an arithmetic mean or a measured gameplay FPS.
// Only use the owning frame's timing. GPU ray-tracing duration is never a fallback.
export function hardwareName(row) {
  return friendlyDeviceName(row.model) || (known(row.gpu) ? row.gpu : 'Device not reported');
}

export function matchesHardware(row, search) {
  return `${known(row.model) ? row.model : ''} ${hardwareName(row)} ${known(row.gpu) ? row.gpu : ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
}

export function gpuChoices(rows) {
  return [...new Set(rows.map(row => row.gpu).filter(known))]
    .sort((a, b) => a.localeCompare(b, 'en', {numeric: true}))
    .map(value => ({value, label: gpuName(value)}));
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
  const gpu = find('[data-gpu-filter]');
  const sort = find('[data-sort-order]');
  const count = find('[data-public-count]');
  const searchHelp = find('[data-search-help]');
  const optionFilters = [...root.querySelectorAll('[data-option-filter]')];
  const seenReports = new Set(), unrecognizedReports = new Set();
  const hardwareNotice = find('[data-public-hardware-notice]');
  function updateHardwareNotice() {
    if (!hardwareNotice) return;
    hardwareNotice.hidden = unrecognizedReports.size === 0;
    hardwareNotice.querySelector('summary').textContent = `${unrecognizedReports.size} shared ${unrecognizedReports.size === 1 ? 'report needs' : 'reports need'} a hardware name check`;
    const references = hardwareNotice.querySelector('[data-hardware-references]');
    references.replaceChildren(...[...unrecognizedReports].map(id => el('li', id)));
  }
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

  function updateGPUChoices() {
    const selected = gpu.value;
    const choices = gpuChoices(rows);
    const all = el('option', choices.length ? 'All GPUs' : 'No GPUs reported');
    all.value = '';
    gpu.replaceChildren(all, ...choices.map(choice => {
      const option = el('option', choice.label);
      option.value = choice.value;
      return option;
    }));
    if (choices.some(choice => choice.value === selected)) gpu.value = selected;
    gpu.disabled = !choices.length;
  }

  function updateOptionChoices() {
    const catalog = optionCatalog(rows);
    for (const select of optionFilters) {
      const selected = select.value;
      const choices = catalog[select.dataset.optionFilter] || [];
      const all = el('option', select.dataset.anyLabel);
      all.value = '';
      select.replaceChildren(all, ...choices.map(choice => {
        const option = el('option', choice.label);
        option.value = choice.value;
        return option;
      }));
      if (choices.some(choice => choice.value === selected)) select.value = selected;
      select.disabled = !choices.length;
    }
  }

  function report(row, index) {
    const card = el('article', undefined, 'benchmark-run');
    const body = el('div', undefined, 'benchmark-result-body');
    const hardware = el('div', undefined, 'benchmark-result-hardware');
    const meta = el('div', undefined, 'benchmark-result-meta');
    const date = el('time', row.dateUtc);
    // The service's public date is day-granular; no local timezone conversion.
    if (/^\d{4}-\d{2}-\d{2}$/.test(row.dateUtc)) date.dateTime = row.dateUtc;
    meta.append(el('span', row.platform, 'benchmark-platform'), date);
    const heading = el('h4', hardwareName(row));
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

  function hardwareSummary(group, index) {
    const card = el('article', undefined, 'benchmark-result');
    const body = el('div', undefined, 'benchmark-result-body');
    const primary = group.primary, row = primary.rows[0], stats = primary.stats;
    const hardware = el('div', undefined, 'benchmark-result-hardware');
    const meta = el('div', undefined, 'benchmark-result-meta');
    meta.append(el('span', group.platform === 'Android' ? 'Mobile' : group.platform, 'benchmark-platform'), el('span', `${group.rows.length} ${group.rows.length === 1 ? 'run' : 'runs'}`));
    const heading = el('h3', group.title);
    heading.id = `benchmark-hardware-${index}`;
    card.setAttribute('aria-labelledby', heading.id);
    hardware.append(meta, heading);
    if (group.platform === 'Android' && known(row.gpu)) hardware.append(el('p', gpuName(row.gpu), 'benchmark-secondary'));
    const versions = primary.rows.map(run => gameVersion(run.build));
    if (versions.some(version => version.value.startsWith('build:'))) hardware.append(el('p', 'Game version not fully identified', 'benchmark-secondary'));
    else if (new Set(versions.map(version => version.value)).size > 1) hardware.append(el('p', 'Across different game versions', 'benchmark-secondary'));
    if (stats.used < 5) hardware.append(el('p', stats.used === 1 ? 'Early result · 1 usable run' : 'Small sample · more runs will help', 'benchmark-secondary'));

    const setup = el('div', undefined, 'benchmark-result-setup');
    setup.append(el('p', group.settings.length > 1 ? 'Most reported settings' : 'Test settings', 'benchmark-setup-label'), el('p', `${row.internal} · Custom`, 'benchmark-resolution'));
    const quality = el('p', undefined, 'benchmark-quality');
    for (const [label, value] of [['Water', row.water], ['Glass', row.dielectric], ['Fire', row.fire]]) quality.append(el('span', `${label}: ${titleCase(value)}`));
    setup.append(quality);
    if (group.settings.length > 1) setup.append(el('p', `${primary.rows.length} runs at these settings · ${group.settings.length - 1} other ${group.settings.length === 2 ? 'setup' : 'setups'} in details`, 'benchmark-secondary'));

    const performance = el('div', undefined, 'benchmark-fps');
    performance.append(el('p', 'Average estimated FPS', 'benchmark-fps-label'));
    const value = el('span', stats.mean === null ? '—' : `~${number(Math.round(stats.mean))}`, 'benchmark-fps-number');
    if (stats.mean !== null) value.append(el('small', ' FPS'));
    const range = stats.used > 1 ? `Range: ${number(Math.round(stats.low))}–${number(Math.round(stats.high))} FPS` : stats.used === 1 ? 'More runs needed for a range' : 'Frame timing unavailable';
    performance.append(value, el('p', range, 'benchmark-fps-note'));
    const sample = `${stats.used} ${stats.used === 1 ? 'run' : 'runs'} used${stats.excludedIds.length ? ` · ${stats.excludedIds.length} unusual ${stats.excludedIds.length === 1 ? 'run' : 'runs'} excluded` : ''}${stats.missing ? ` · ${stats.missing} missing timings` : ''}`;
    performance.append(el('p', sample, 'benchmark-average'));
    body.append(hardware, setup, performance);

    const details = el('details', undefined, 'benchmark-result-details');
    details.append(el('summary', `Runs & details (${group.rows.length})`));
    const content = el('div', undefined, 'benchmark-detail-content');
    content.append(el('p', 'The average gives each usable run equal weight. Each run contributes an FPS estimate from its median rendering time; this is not a measured average gameplay FPS. The range is the lowest to highest estimate retained in the summary.'));
    content.append(el('p', 'Unusual runs are excluded only when at least five runs have usable timings at the same reported settings. We use the usual 1.5× interquartile-range rule. When the middle half is identical, a 10% (at least 1 FPS) tolerance avoids removing small variations. Original reports remain available below.'));
    content.append(el('p', 'These are unverified community summaries, not a leaderboard. Resolution, graphics profile, rendering backend and shader versions are matched before averaging. Game builds can differ; missing test revisions and output rules prevent a verified like-for-like comparison. Run counts are not unique people or devices.'));
    if (group.settings.length > 1) {
      content.append(el('h4', 'Other test settings'));
      const list = el('dl');
      for (const setting of group.settings.slice(1)) {
        const sampleRow = setting.rows[0], summary = setting.stats;
        list.append(el('dt', `${sampleRow.internal} · Water ${titleCase(sampleRow.water)} · Glass ${titleCase(sampleRow.dielectric)} · Fire ${titleCase(sampleRow.fire)}`), el('dd', summary.mean === null ? `${setting.rows.length} runs · FPS unavailable` : `~${number(Math.round(summary.mean))} FPS average estimate · ${summary.used} runs used${summary.excludedIds.length ? ` · ${summary.excludedIds.length} excluded` : ''}`));
      }
      content.append(list);
    }
    const runs = el('details', undefined, 'benchmark-run-list');
    runs.append(el('summary', `View ${group.rows.length} individual ${group.rows.length === 1 ? 'run' : 'runs'}`));
    const excluded = new Set(group.settings.flatMap(setting => setting.stats.excludedIds));
    group.rows.forEach((run, runIndex) => {
      const original = report(run, index * 10000 + runIndex);
      if (excluded.has(run.resultId)) original.prepend(el('p', 'Unusual run · excluded from the summary', 'benchmark-excluded'));
      runs.append(original);
    });
    content.append(runs);
    details.append(content);
    card.append(body, details);
    return card;
  }

  function render() {
    updateHardwareNotice();
    const filters = Object.fromEntries(optionFilters.map(select => [select.dataset.optionFilter, select.value]));
    const visible = rows.filter(row => (!gpu.value || row.gpu === gpu.value) && matchesHardware(row, search.value) && matchesOptions(row, filters));
    const groups = aggregateResults(visible);
    results.replaceChildren(...groups.map(hardwareSummary));
    count.textContent = `${groups.length} ${groups.length === 1 ? 'model' : 'models'} · ${visible.length} ${visible.length === 1 ? 'run' : 'runs'}`;
    searchHelp.hidden = !cursor;
    next.hidden = !cursor;
    if (!visible.length) {
      const title = Object.values(filters).some(Boolean) ? 'No results match these filters' : search.value.trim() || gpu.value ? 'No matching hardware in these results' : 'No results yet';
      const help = !rows.length && seenReports.size ? 'Reports without shared GPU details or a mobile model are not shown.' : 'Try another choice or reset the filters to see all reports.';
      message(title, cursor ? 'Try another choice, reset the filters, or load more results below.' : help);
    }
    status.textContent = `${groups.length} hardware ${groups.length === 1 ? 'summary' : 'summaries'} from ${visible.length} ${visible.length === 1 ? 'run' : 'runs'}${cursor ? ` · ${seenReports.size} of ${matchingCount} reports loaded; summaries cover loaded runs` : ''}.`;
  }

  async function load(paging = false) {
    const token = ++generation;
    loading = true;
    retryPaging = paging;
    const query = {};
    // Filter the public platform data locally. This preserves every available
    // dropdown choice and lets one readable version cover multiple package IDs.
    if (form.elements.platform.value) query.platform = form.elements.platform.value;
    query.limit = 100;
    query.sort = 'date';
    query.order = sort.value;
    if (paging && cursor) query.cursor = cursor;
    if (!paging) { seenReports.clear(); unrecognizedReports.clear(); updateHardwareNotice(); rows = []; cursor = null; matchingCount = 0; results.replaceChildren(); count.textContent = 'Community reports'; }
    status.textContent = paging ? 'Loading more results…' : 'Loading results…';
    results.setAttribute('aria-busy', 'true');
    next.hidden = true;
    retry.hidden = true;
    searchHelp.hidden = true;
    gpu.disabled = true;
    try {
      const response = await loadPublicPage(query, transport);
      if (token !== generation) return;
      if (response.state === 'ready' || response.state === 'empty') {
        const page = response.page;
        for (const row of page.rows) {
          if (!seenReports.has(row.resultId)) {
            seenReports.add(row.resultId);
            if (row.hardwareLabelStatus === 'unrecognized') unrecognizedReports.add(row.resultId);
            if (isPublicHardwareIdentified(row)) rows.push(row);
          }
        }
        cursor = page.nextCursor;
        matchingCount = page.matchingReportCount;
        updateGPUChoices();
        updateOptionChoices();
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
      if (token === generation) { loading = false; results.setAttribute('aria-busy', 'false'); if (rows.length) gpu.disabled = !gpuChoices(rows).length; }
    }
  }

  form.addEventListener('submit', event => { event.preventDefault(); load(); });
  form.addEventListener('reset', () => setTimeout(() => load(), 0));
  form.elements.platform.addEventListener('change', () => {
    const option = el('option', 'Loading graphics cards…');
    option.value = '';
    gpu.replaceChildren(option);
    load();
  });
  gpu.addEventListener('change', () => { if (!loading && rows.length) render(); });
  for (const select of optionFilters) select.addEventListener('change', () => { if (!loading && rows.length) render(); });
  sort.addEventListener('change', () => load());
  search.addEventListener('input', () => { if (!loading && rows.length) render(); });
  next.addEventListener('click', () => { if (!loading) load(true); });
  retry.addEventListener('click', () => { if (!loading) load(retryPaging); });
  updateOptionChoices();
  load();
}

const endpoint = 'https://briarhold-signal.samfa12.com/api/horde-benchmark-stats';
const transport = query => fetch(`${endpoint}?${query}`, {
  method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
  headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(10000),
});
if (typeof document !== 'undefined') mountPublicResults(document.querySelector('.benchmark'), transport);

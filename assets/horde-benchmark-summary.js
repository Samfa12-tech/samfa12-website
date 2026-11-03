const known = value => typeof value === 'string' && value.trim().length > 0 && value.trim().toLowerCase() !== 'unknown';
const FRAME_SCOPES = new Set(['completed-owning-render-entry-through-present', 'whole-frame-cycle']);

export function frameRateEstimate(row) {
  if (!FRAME_SCOPES.has(row.cpuTimingScope) || !Number.isFinite(row.frameMedianMs) || row.frameMedianMs <= 0) return null;
  const fps = 1000 / row.frameMedianMs;
  return Number.isFinite(fps) ? fps : null;
}

export function fpsEstimate(row) {
  const fps = frameRateEstimate(row);
  return fps === null ? null : Math.round(fps);
}

// Samsung identifies the S948 model codes as Galaxy S26 Ultra; the owner
// confirmed SM-S928B as Galaxy S24 Ultra. Unknown codes remain unchanged.
// https://doc.samsungmobile.com/SM-S948B/037405260313/eng.html
// https://doc.samsungmobile.com/SM-S948U/CCT/doc.html
const PHONE_NAMES = new Map([['SM-S928B', 'Galaxy S24 Ultra'], ['SM-S948B', 'Galaxy S26 Ultra'], ['SM-S948U', 'Galaxy S26 Ultra']]);
export function friendlyDeviceName(model) {
  if (!known(model)) return null;
  const text = model.trim();
  if (PHONE_NAMES.has(text.toUpperCase())) return PHONE_NAMES.get(text.toUpperCase());
  const galaxy = /^(?:Samsung\s+)?Galaxy\s+S(24|26)\s+Ultra$/i.exec(text);
  if (galaxy) return `Galaxy S${galaxy[1]} Ultra`;
  return text;
}

export function gpuName(value) {
  return known(value) ? value.replace(/^NVIDIA GeForce /i, '').replace(/\s*\(TM\)/gi, '').replace(/ GPU$/i, '') : null;
}

// Display guard for legacy responses. Publication consent is enforced by the service.
export function isPublicHardwareIdentified(row) {
  return known(row.gpu) && (row.platform !== 'Android' || known(row.model));
}

function quantile(sorted, fraction) {
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
}

export function summariseRuns(rows) {
  const valid = rows.map(row => ({row, fps: frameRateEstimate(row)})).filter(sample => sample.fps !== null);
  const sorted = valid.map(sample => sample.fps).sort((a, b) => a - b);
  let lower = -Infinity, upper = Infinity;
  // Small samples do not establish a dependable normal range. Keep every run.
  if (sorted.length >= 5) {
    const q1 = quantile(sorted, .25), q3 = quantile(sorted, .75), iqr = q3 - q1;
    if (iqr > 0) { lower = q1 - 1.5 * iqr; upper = q3 + 1.5 * iqr; }
    else {
      // Repeated/rounded identical timings can make IQR zero. Allow normal small
      // variation rather than discarding everything different from the median.
      const tolerance = Math.max(1, q1 * .1);
      lower = q1 - tolerance; upper = q3 + tolerance;
    }
  }
  const included = valid.filter(sample => sample.fps >= lower && sample.fps <= upper);
  const excluded = valid.filter(sample => sample.fps < lower || sample.fps > upper);
  return {
    total: rows.length, used: included.length, missing: rows.length - valid.length,
    excludedIds: excluded.map(sample => sample.row.resultId),
    mean: included.length ? included.reduce((mean, sample, index) => mean + (sample.fps - mean) / (index + 1), 0) : null,
    low: included.length ? Math.min(...included.map(sample => sample.fps)) : null,
    high: included.length ? Math.max(...included.map(sample => sample.fps)) : null,
  };
}

function identity(row) {
  const phone = friendlyDeviceName(row.model);
  if (row.platform === 'Android' && phone) return {key: `Android:model:${phone.toLowerCase()}`, title: phone};
  if (row.platform !== 'Android' && known(row.gpu)) return {key: `${row.platform}:gpu:${row.gpu.trim().toLowerCase()}`, title: gpuName(row.gpu)};
  if (row.platform !== 'Android' && phone) return {key: `${row.platform}:model:${phone.toLowerCase()}`, title: phone};
  // Missing phone identities must never combine unrelated phones sharing a GPU.
  return {key: `${row.platform}:unknown:${row.resultId}`, title: phone || 'Device not reported'};
}

function settingsKey(row) {
  // Summaries match the settings we actually receive. Build/version uncertainty
  // is disclosed; these are community summaries, not verified comparison buckets.
  return JSON.stringify([row.internal, row.output, row.profile, row.backend, row.water, row.dielectric, row.fire, row.shaderPair, row.platform === 'Android' ? row.gpu : null]);
}

export function aggregateResults(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!isPublicHardwareIdentified(row)) continue;
    const hardware = identity(row);
    if (!groups.has(hardware.key)) groups.set(hardware.key, {...hardware, platform: row.platform, rows: [], settings: new Map()});
    const group = groups.get(hardware.key);
    group.rows.push(row);
    const signature = settingsKey(row);
    if (!group.settings.has(signature)) group.settings.set(signature, []);
    group.settings.get(signature).push(row);
  }
  return [...groups.values()].map(group => {
    const settings = [...group.settings.values()].map(runs => ({rows: runs, stats: summariseRuns(runs), latest: runs.reduce((latest, row) => row.dateUtc > latest ? row.dateUtc : latest, '')}));
    settings.sort((a, b) => b.rows.length - a.rows.length || b.latest.localeCompare(a.latest));
    return {...group, settings, primary: settings[0]};
  });
}

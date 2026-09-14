(async () => {
  // Read-only aggregate JSON. No credentials, cookies, identifiers or game events.
  const countNode = document.querySelector('[data-briarhold-browser-count]');
  const statusNode = document.querySelector('[data-briarhold-browser-status]');
  if (!countNode || !statusNode) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('/data/briarhold-browser-stats.json', {
      credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache', signal: controller.signal,
    });
    if (!response.ok) throw new Error('Snapshot unavailable');
    const data = await response.json();
    if (data?.schemaVersion === 1 && data.status === 'pending') {
      statusNode.textContent = 'Awaiting first analytics update.';
      return;
    }
    const start = Date.parse(data?.period?.start);
    const end = Date.parse(data?.period?.end);
    const updated = Date.parse(data?.updatedAt);
    const day = 86_400_000;
    if (data?.schemaVersion !== 1 || data.status !== 'ok' || data.source !== 'Cloudflare'
      || data.hostname !== 'samfa12.com' || data.path !== '/games/briarhold/play/'
      || data.metric !== 'game-page-requests' || !Number.isSafeInteger(data.count) || data.count < 0
      || data.period?.timeZone !== 'UTC' || !Number.isFinite(start) || !Number.isFinite(end)
      || start % day !== 0 || end - start !== 7 * day || !Number.isFinite(updated)
      || updated < end || updated > Date.now() + 300_000) {
      throw new Error('Invalid snapshot');
    }
    const date = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const stale = Date.now() - updated > 3 * day ? ' Update delayed; showing the last available period.' : '';
    countNode.textContent = new Intl.NumberFormat('en-AU').format(data.count);
    statusNode.textContent = `${date.format(new Date(start))} – ${date.format(new Date(end - day))} (UTC) · Updated ${date.format(new Date(updated))}.${stale}`;
  } catch {
    // Unavailable must never look like a measured zero.
    statusNode.textContent = 'Browser-play statistics temporarily unavailable.';
  } finally { clearTimeout(timeout); }
})();

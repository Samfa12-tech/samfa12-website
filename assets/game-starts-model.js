export const GAME_NAMES = {briarhold: 'Briarhold', 'reef-sweep': 'Reef Sweep'};
const DAY = 86_400_000;
export function validateStartStats(value) {
  if (!value || value.schemaVersion !== 1 || value.source !== 'first-party-game-starts'
    || !['ok', 'disabled', 'unavailable', 'fixture'].includes(value.status) || !Array.isArray(value.games)) return null;
  if (!['ok', 'fixture'].includes(value.status)) return {...value, games: []};
  if (!Number.isFinite(Date.parse(value.updatedAt))) return null;
  const ids = new Set();
  for (const game of value.games) {
    if (!game || !GAME_NAMES[game.gameId] || ids.has(game.gameId) || !Array.isArray(game.daily)
      || !Number.isFinite(Date.parse(game.trackingSince))
      || Date.parse(game.trackingSince) > Date.parse(value.updatedAt)
      || Date.parse(value.updatedAt) - Date.parse(game.trackingSince) > 36600 * DAY) return null;
    ids.add(game.gameId);
    const days = new Set();
    for (const row of game.daily) {
      if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(row.day) || !Number.isFinite(Date.parse(`${row.day}T00:00:00Z`)) || new Date(`${row.day}T00:00:00Z`).toISOString().slice(0,10) !== row.day
        || days.has(row.day) || row.day < game.trackingSince.slice(0,10)
        || row.day > value.updatedAt.slice(0,10) || !Number.isSafeInteger(row.starts) || row.starts < 0
        || !['complete', 'partial', 'unverified', 'gap', 'capped'].includes(row.coverage)) return null;
      days.add(row.day);
    }
  }
  return value;
}
export function summarizeGame(game, updatedAt) {
  const today = updatedAt.slice(0, 10), end = Date.parse(`${today}T00:00:00Z`);
  const rows = new Map(game.daily.map(row => [row.day, row]));
  const weekDays = Array.from({length: 7}, (_, i) => new Date(end - (7-i)*DAY).toISOString().slice(0,10));
  const missing = weekDays.filter(day => rows.get(day)?.coverage !== 'complete');
  const weeklyObserved = weekDays.reduce((sum, day) => sum + (rows.get(day)?.starts || 0), 0);
  const since = Date.parse(`${game.trackingSince.slice(0,10)}T00:00:00Z`);
  let lifetimeGaps = 0;
  for (let t = since; t < end; t += DAY) if (rows.get(new Date(t).toISOString().slice(0,10))?.coverage !== 'complete') lifetimeGaps++;
  return {gameId: game.gameId, title: GAME_NAMES[game.gameId], trackingSince: game.trackingSince,
    today: rows.get(today) || null, weekly: missing.length ? null : weeklyObserved, weeklyObserved,
    missing, cumulativeObserved: game.daily.reduce((sum,row) => sum + row.starts, 0), lifetimeGaps,
    daily: [...game.daily].sort((a,b) => b.day.localeCompare(a.day)).slice(0,14)};
}

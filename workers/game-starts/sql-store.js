import {DAILY_CAP, MINUTE_CAP, RECEIPT_MS} from './core.js';

// ctx.storage.transactionSync is supplied by the DO; local tests use real SQLite transactions.
export class StartStore {
  constructor(storage, gameId, trackingSince = null) {
    this.storage = storage; this.sql = storage.sql; this.gameId = gameId; this.trackingSince = trackingSince;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS receipts(hash TEXT PRIMARY KEY, day TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS daily(day TEXT PRIMARY KEY, starts INTEGER NOT NULL DEFAULT 0, coverage TEXT NOT NULL DEFAULT 'unverified');
      CREATE TABLE IF NOT EXISTS budget(minute INTEGER PRIMARY KEY, requests INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    const old = this.sql.exec("SELECT value FROM metadata WHERE key='trackingSince'").toArray()[0];
    if (old) this.trackingSince = old.value;
    else if (trackingSince && Number.isFinite(Date.parse(trackingSince))) this.sql.exec("INSERT INTO metadata VALUES('trackingSince', ?)", trackingSince);
  }
  accept(day, hash, now) {
    return this.storage.transactionSync(() => {
      this.prune(now);
      const previous = this.sql.exec('SELECT day FROM receipts WHERE hash=?', hash).toArray()[0];
      if (previous) return {status: 'duplicate', day: previous.day};
      const minute = Math.floor(now / 60_000);
      const minuteCount = this.sql.exec('SELECT requests FROM budget WHERE minute=?', minute).toArray()[0]?.requests || 0;
      const dayCount = this.sql.exec('SELECT starts FROM daily WHERE day=?', day).toArray()[0]?.starts || 0;
      if (minuteCount >= MINUTE_CAP || dayCount >= DAILY_CAP) {
        this.sql.exec("INSERT INTO daily(day,coverage) VALUES(?, 'capped') ON CONFLICT(day) DO UPDATE SET coverage='capped'", day);
        return {status: 'capped', day};
      }
      this.sql.exec('INSERT INTO receipts VALUES(?,?,?)', hash, day, now + RECEIPT_MS);
      this.sql.exec('INSERT INTO daily(day,starts) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET starts=starts+1', day);
      this.sql.exec('INSERT INTO budget VALUES(?,1) ON CONFLICT(minute) DO UPDATE SET requests=requests+1', minute);
      return {status: 'accepted', day};
    });
  }
  prune(now) {
    this.sql.exec('DELETE FROM receipts WHERE expires <= ?', now);
    this.sql.exec('DELETE FROM budget WHERE minute < ?', Math.floor(now / 60_000) - 1);
  }
  // Operator reconciliation only; never exposed on the public HTTP collector.
  setCoverage(day, coverage, now) {
    if (!['complete', 'gap', 'partial', 'unverified'].includes(coverage)
      || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !this.trackingSince
      || day < this.trackingSince.slice(0,10) || day > new Date(now).toISOString().slice(0,10)
      || (coverage === 'complete' && (day >= new Date(now).toISOString().slice(0,10)
        || (day === this.trackingSince.slice(0,10) && this.trackingSince.slice(11) !== '00:00:00.000Z'))))
      throw new Error('invalid-coverage');
    if (this.sql.exec('SELECT coverage FROM daily WHERE day=?', day).toArray()[0]?.coverage === 'capped') throw new Error('capped-coverage');
    this.sql.exec('INSERT INTO daily(day,coverage) VALUES(?,?) ON CONFLICT(day) DO UPDATE SET coverage=excluded.coverage', day, coverage);
  }
  snapshot(now) {
    this.prune(now);
    return {gameId: this.gameId, trackingSince: this.trackingSince, daily: this.sql.exec('SELECT day, starts, coverage FROM daily ORDER BY day').toArray()};
  }
}

import {DatabaseSync} from 'node:sqlite';
export function createLocalStorage(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  return {db, sql: {exec(query, ...args) {
    if (!args.length && query.includes(';')) { db.exec(query); return {toArray: () => []}; }
    const statement = db.prepare(query);
    const rows = /^\s*(SELECT|PRAGMA)/i.test(query) ? statement.all(...args) : (statement.run(...args), []);
    return {toArray: () => rows};
  }}, transactionSync(callback) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = callback(); db.exec('COMMIT'); return result; }
    catch(error) { db.exec('ROLLBACK'); throw error; }
  }};
}

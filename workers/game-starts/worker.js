import {DurableObject} from 'cloudflare:workers';
import {handleRequest, RECEIPT_MS} from './core.js';
import {StartStore} from './sql-store.js';

export class GameStarts extends DurableObject {
  store(gameId) {
    const starts = JSON.parse(this.env.TRACKING_STARTS || '{}');
    return new StartStore(this.ctx.storage, gameId, starts[gameId]);
  }
  async accept(gameId, day, hash, now) {
    const result = this.store(gameId).accept(day, hash, now);
    if (await this.ctx.storage.getAlarm() === null) await this.ctx.storage.setAlarm(now + RECEIPT_MS);
    return result;
  }
  snapshot(gameId, now) { return this.store(gameId).snapshot(now); }
  async alarm() {
    // Each object's schema is shared by one game only. Pruning does not need a game ID.
    new StartStore(this.ctx.storage, '').prune(Date.now());
    const next = this.ctx.storage.sql.exec('SELECT MIN(expires) AS expires FROM receipts').toArray()[0]?.expires;
    if (next) await this.ctx.storage.setAlarm(next);
  }
}
export default {
  fetch(request, env) {
    return handleRequest(request, env, gameId => {
      const stub = env.GAME_STARTS.getByName(gameId);
      return {accept: (day, hash, now) => stub.accept(gameId, day, hash, now), snapshot: now => stub.snapshot(gameId, now)};
    });
  },
};

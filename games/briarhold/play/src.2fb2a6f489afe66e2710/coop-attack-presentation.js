const MAX_PENDING_PREDICTIONS = 128;
const MAX_AUTHORITY_EVENTS = 128;

function attackType(value = {}) {
  const kind = value.kind === 'melee_strike' ? 'melee_strike' : 'weapon_fired';
  const weaponId = kind === 'melee_strike'
    ? 'knife'
    : String(value.weaponId ?? value.payload?.weaponId ?? 'arbalest');
  return {kind, weaponId};
}

function authoritativeKey(event) {
  const {kind, weaponId} = attackType(event);
  const sequence = kind === 'melee_strike'
    ? event.payload?.meleeSequence ?? event.sequence
    : event.payload?.shotSequence ?? event.sequence;
  return `${event.actorId}:${kind}:${weaponId}:${sequence}`;
}

/**
 * Reconciles immediate owner-only cosmetic prediction with later host events.
 * It never predicts hit results, damage, heat refunds, kills, or shared state.
 */
export function createCoopAttackPresentationLedger({
  localActorId,
  predictionWindowMs = 2000,
} = {}) {
  if (typeof localActorId !== 'string' || !localActorId) throw new TypeError('localActorId is required');
  if (!Number.isFinite(predictionWindowMs) || predictionWindowMs < 100 || predictionWindowMs > 10000) {
    throw new RangeError('predictionWindowMs must be bounded');
  }
  const pending = [];
  const authorityKeys = new Set();
  const authorityOrder = [];
  let fireWindow = null;
  let lastObservedCommand = -1;
  const counts = {predicted: 0, reconciled: 0, expiredPredictions: 0, authorityPresented: 0, duplicateAuthority: 0};

  function purge(now) {
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      if (pending[index].commandSequence !== null || now - pending[index].at <= predictionWindowMs) continue;
      pending.splice(index, 1);
      counts.expiredPredictions += 1;
    }
  }

  return Object.freeze({
    observeCommand({commandSequence, fire, weaponId}) {
      if (!Number.isInteger(commandSequence) || commandSequence <= lastObservedCommand) return false;
      lastObservedCommand = commandSequence;
      if (fireWindow && (!fire || fireWindow.weaponId !== weaponId)) {
        fireWindow.last = commandSequence - 1;
        fireWindow = null;
      }
      if (fire && !fireWindow) fireWindow = {first: commandSequence, last: null, weaponId};
      return true;
    },
    predict(attack, nowMs) {
      const now = Number(nowMs);
      if (!Number.isFinite(now)) throw new TypeError('prediction time must be finite');
      const type = attackType(attack);
      const commandSequence = Number.isInteger(attack?.commandSequence) && attack.commandSequence >= 0
        ? attack.commandSequence : null;
      const attackSequence = Number.isInteger(attack?.attackSequence) && attack.attackSequence >= 1
        ? attack.attackSequence : null;
      purge(now);
      pending.push({...type, commandSequence, attackSequence,
        fireWindow: type.kind === 'weapon_fired' && fireWindow?.weaponId === type.weaponId ? fireWindow : null,
        at: now});
      while (pending.length > MAX_PENDING_PREDICTIONS) {
        pending.shift();
        counts.expiredPredictions += 1;
      }
      counts.predicted += 1;
      return Object.freeze({present: true, source: 'local-prediction', key: null});
    },
    reconcile(event, nowMs) {
      const now = Number(nowMs);
      if (!Number.isFinite(now)) throw new TypeError('reconciliation time must be finite');
      purge(now);
      const key = authoritativeKey(event);
      if (authorityKeys.has(key)) {
        counts.duplicateAuthority += 1;
        return Object.freeze({present: false, source: 'duplicate-authority', key});
      }
      authorityKeys.add(key);
      authorityOrder.push(key);
      if (authorityOrder.length > MAX_AUTHORITY_EVENTS) authorityKeys.delete(authorityOrder.shift());
      if (event.actorId === localActorId) {
        const type = attackType(event);
        const commandSequence = event.payload?.commandSequence;
        const attackSequence = type.kind === 'melee_strike'
          ? event.payload?.meleeSequence : event.payload?.shotSequence;
        const exactCommand = Number.isInteger(commandSequence)
          ? pending.findIndex(item => item.kind === type.kind && item.weaponId === type.weaponId
            && item.commandSequence === commandSequence)
          : -1;
        const match = exactCommand >= 0 ? exactCommand : pending.findIndex(item => {
          if (item.kind !== type.kind || item.weaponId !== type.weaponId) return false;
          if (!Number.isInteger(commandSequence)) return item.commandSequence === null;
          // Host/client cooldowns can select adjacent input frames for the
          // same numbered shot. Match its ordinal only inside the actual
          // continuous fire interval, never across release or weapon change.
          if (type.kind !== 'weapon_fired' || !Number.isInteger(attackSequence)
            || item.attackSequence !== attackSequence || !item.fireWindow) return false;
          return commandSequence >= item.fireWindow.first
            && (item.fireWindow.last === null || commandSequence <= item.fireWindow.last)
            && now >= item.at && now - item.at <= predictionWindowMs;
        });
        if (match >= 0) {
          pending.splice(match, 1);
          counts.reconciled += 1;
          return Object.freeze({present: false, source: 'predicted-owner', key});
        }
      }
      counts.authorityPresented += 1;
      return Object.freeze({present: true, source: event.actorId === localActorId ? 'authority-owner' : 'authority-remote', key});
    },
    reset() {
      pending.length = 0;
      authorityKeys.clear();
      authorityOrder.length = 0;
      fireWindow = null;
      lastObservedCommand = -1;
    },
    diagnostics() {
      return Object.freeze({...counts, pendingPredictions: pending.length, authoritativeEvents: authorityKeys.size});
    },
  });
}

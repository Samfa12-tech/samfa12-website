import {GAME_PHASES} from './contracts.js';
import {shouldPublishCoopAuthorityPhase} from './coop-campaign-authority.js';
import {EMPTY_INPUT_FRAME} from './input-frame.js';

export function allowsPresentedMovement(phase) {
  return phase === GAME_PHASES.DAYTIME
    || phase === GAME_PHASES.INTERWAVE_RECOVERY
    || phase === GAME_PHASES.COMBAT;
}

// One owner advances the session after recovery has resolved this frame's phase.
// Other published phases still exchange state, but cannot carry gameplay input.
export function advanceCoopPresentedFrame({session, paused, phase, dt, frame, aiming = false, issueCaptureOpen = false}) {
  if (paused || !session?.connected || !shouldPublishCoopAuthorityPhase(phase)) return false;
  const input = allowsPresentedMovement(phase) && !issueCaptureOpen
    ? {...frame, aiming, manualVent: false}
    : EMPTY_INPUT_FRAME;
  session.update(dt, input);
  return true;
}

import {GAME_PHASES} from './contracts.js';
import {DAYWORK_DEFINITIONS, FIELD_MEDICINE_AUTO_HEAL_THRESHOLD} from './daywork.js';

const MEDICINE = DAYWORK_DEFINITIONS['field-medicine'];
const HUD_PHASES = new Set([GAME_PHASES.DAYTIME, GAME_PHASES.COMBAT, GAME_PHASES.INTERWAVE_RECOVERY, GAME_PHASES.BUILD_BREAK]);

/** Compact charge information beside health; activation is exclusively automatic. */
export function fieldMedicineStatus({phase, night, medicine, hp, maxHp, shared = false} = {}) {
  const prepared = Number.isInteger(night) && night > 0 && medicine?.night === night && medicine.prepared === true;
  const available = prepared && medicine.available === true;
  const living = Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0 && hp > 0 && hp <= maxHp;
  const atThreshold = living && hp / maxHp <= FIELD_MEDICINE_AUTO_HEAL_THRESHOLD;
  const state = !prepared ? 'unprepared' : !available ? 'spent' : 'armed';
  const label = state === 'armed' ? `Medicine: auto at 10%${shared ? ' (shared)' : ''}`
    : state === 'spent' ? 'Medicine: spent' : 'Medicine: not prepared';
  const instruction = available
    ? `Automatically restores up to ${MEDICINE.healing} Health at 10% Health while alive during combat.`
    : state === 'spent' ? 'Prepare another charge during the next daytime.'
      : `Prepare at the Quartermaster during daytime (${MEDICINE.supplyCost} Supplies).`;
  return Object.freeze({state, label, instruction,
    detail: `${shared ? 'One shared charge' : 'One charge'} this night. Restores up to ${MEDICINE.healing} Health.`,
    visible: HUD_PHASES.has(phase), prepared, available, living, atThreshold,
    automaticEligible: available && phase === GAME_PHASES.COMBAT && atThreshold,
    healing: MEDICINE.healing});
}

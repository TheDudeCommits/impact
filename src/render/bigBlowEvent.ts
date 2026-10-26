import { comboMove, type ComboKey } from '../game/combos';
import { moveFor } from '../game/awakening';
import { isBigBlow } from '../game/bigBlow';
import type { CombatEvent } from '../game/types';

export function bigBlowOf(event: CombatEvent, awakened = false) {
  if (event.kind !== 'hit' || !event.slot || !event.fighter) return false;
  const move = (event.branch ? comboMove(event.fighter, event.branch as ComboKey, awakened) : undefined) ?? moveFor(event.fighter, event.slot, awakened);
  const count = move?.contacts.length ?? 1;
  const last = count <= 1 || event.contactIndex === undefined || event.contactIndex >= count - 1;
  return isBigBlow(event.slot, event.branch, event.chain, last);
}

export function cinematicBlowOf(event: CombatEvent, awakened = false) {
  if (event.kind !== 'hit' || event.slot !== 'ultimate' || !event.fighter || event.branch) return false;
  const move = moveFor(event.fighter, 'ultimate', awakened);
  return !!move.confirm && (event.contactIndex ?? 0) >= 1;
}

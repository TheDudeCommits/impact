import type { AttackSlot } from './types';
import { RUSH_STAGES } from './moves';

export function isBigBlow(slot: AttackSlot | undefined, branch: unknown, stage: number | undefined, lastContact: boolean) {
  if (!lastContact || !slot) return false;
  return slot === 'special' || slot === 'ultimate' || !!branch || slot === 'light' && (stage ?? 0) >= RUSH_STAGES - 1;
}

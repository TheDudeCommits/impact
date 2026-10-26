import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const YUJI_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Soul Jab', duration: .42, contacts: [.152], damage: 23,
    range: 2.15, radius: .64, stamina: 8, cooldown: .42, stun: .28,
    knockback: 2.8, lunge: 4.1, style: 'melee' },
  heavy: { name: 'Divergent Fist', duration: .79, contacts: [.38], damage: 64,
    range: 2.4, radius: .84, stamina: 24, cooldown: 1.15, stun: .62,
    knockback: 8.5, lunge: 4.8, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Blood Convergence', duration: 1.12, contacts: [.65], damage: 118,
    range: 2.55, radius: .92, stamina: 30, cooldown: 4.8, stun: .78,
    knockback: 10, lunge: 9.8, style: 'melee', outcome: 'wallBounce' },
  ultimate: { name: 'Eightfold Black Flash', duration: 3.4,
    contacts: [.43, .78, 1.09, 1.40, 1.71, 2.02, 2.35, 2.74],
    schedule: [20, 20, 20, 20, 20, 20, 20, 508], damage: 20, finisherDamage: 150,
    range: 2.5, radius: 1.02, stamina: 0, cooldown: 22,
    stun: .52, finisherStun: 2.3, knockback: 0, finisherKnockback: 16,
    lunge: 4.8, style: 'melee', guardBreak: true, confirm: { recovery: .55 } },
};
export const YUJI_COMBOS: ComboRow = {
  lh: { name: 'Liver Hook', range: 2.3, radius: .78 },
  llh: { name: 'Rising Soul', range: 2.35, radius: .82 },
  lllh: { name: 'Elbow Breaker', range: 2.5, radius: .90 },
  llls: { name: 'Shrine Palm', range: 2.6, radius: .95 },
  airHeavy: { name: 'Descending Hammer', range: 2.5, radius: .90 },
  airSpecial: { name: 'Crimson Impact', radius: 3 },
};
export const YUJI_CONTACTS = {
  light: .18/.42, heavy: .38/.79, special: .65/1.12,
  ultimate: [.43/3.4,.78/3.4,1.09/3.4,1.40/3.4,1.71/3.4,2.02/3.4,2.35/3.4,2.74/3.4],
  rush: [.38/.79,.52,.55],
  combos: {lh:.48,llh:.52,lllh:.55,llls:.58,airHeavy:.55,airSpecial:.58},
} as const;
export const YUJI_AWAKENING = {
  name: 'Awakened Soul', clip: 'Soul Resolve', duration: 1.8,
  beats: { palmClasp:.40, focus:.86, fistIgnition:1.16, settle:1.62 },
  manualOnly: true,
} as const;

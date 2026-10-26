import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const DOFLAMINGO_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Five-Color Strings', duration: .45, contacts: [.168], damage: 22,
    range: 2.4, radius: .78, stamina: 11, cooldown: .45, stun: .30,
    knockback: 3.2, lunge: 3.7, style: 'melee' },
  heavy: { name: 'Athlete Thread', duration: 1, contacts: [.55], damage: 65,
    range: 2.7, radius: .92, stamina: 27, cooldown: 1.25, stun: .78,
    knockback: 9, lunge: 4.5, style: 'melee', outcome: 'groundBounce' },
  special: { name: 'Overheat', duration: 1.26, contacts: [.63], damage: 120,
    range: 27, radius: .9, stamina: 35, cooldown: 5.7, stun: .82,
    knockback: 10, speed: 29, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'Sixteen Holy Bullets: God Thread', duration: 3.88,
    contacts: [.56, 1.60, 3.18], schedule: [42, 68, 239], damage: 42,
    finisherDamage: 216, range: 2.7, radius: 1.15, stamina: 0, cooldown: 25,
    stun: 1.1, finisherStun: 2.3, knockback: 0, finisherKnockback: 16,
    lunge: 5.1, close: 6, style: 'melee', guardBreak: true,
    confirm: { recovery: .58 } },
};
export const DOFLAMINGO_COMBOS: ComboRow = {
  lh: { name: 'Puppet Reversal', range: 2.6, radius: .85 },
  llh: { name: 'String Guillotine', range: 2.65, radius: .9 },
  lllh: { name: 'Tamaito Burst', range: 2.8, radius: 1.05 },
  llls: { name: 'Parasite Snare', range: 2.9, radius: 1.15 },
  airHeavy: { name: 'Sky String Heel', range: 2.65, radius: .95 },
  airSpecial: { name: 'White Breaker', radius: 3.45 },
};
export const DOFLAMINGO_CONTACTS = {
  light: .26 / .54, heavy: .55 / 1.02, special: .63 / 1.26,
  ultimate: [.56 / 3.88, 1.60 / 3.88, 3.18 / 3.88],
  rush: [.22 / .52, .27 / .60, .32 / .72],
  combos: { lh: .30 / .72, llh: .40 / .88, lllh: .55 / 1.12,
    llls: .60 / 1.20, airHeavy: .46 / .94, airSpecial: .56 / 1.10 },
} as const;
export const DOFLAMINGO_AWAKENING = {
  name: 'Ever White', clip: 'Ever White', duration: 1.8, entryDuration: .9,
  beats: { gather: .16, unfurl: .34, command: .56, crown: .77 },
  manualOnly: true,
} as const;

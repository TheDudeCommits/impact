import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const BLACKBEARD_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Yami Jab', duration: .47, contacts: [.168], damage: 22,
    range: 2.25, radius: .7, stamina: 11, cooldown: .47, stun: .31,
    knockback: 3.1, lunge: 3.6, style: 'melee' },
  heavy: { name: 'Gura Hammer', duration: 1, contacts: [.60], damage: 65,
    range: 2.7, radius: 1.05, stamina: 28, cooldown: 1.23, stun: .8,
    knockback: 10, lunge: 4.0, style: 'melee', outcome: 'groundBounce' },
  special: { name: 'Black Hole', duration: 1.42, contacts: [.72], damage: 116,
    range: 23, radius: 1.1, stamina: 35, cooldown: 5.6, stun: .95,
    knockback: -11, speed: 18, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'Liberation: Worldbreaker', duration: 3.92,
    contacts: [.52, 1.53, 3.25], schedule: [43, 70, 235], damage: 43,
    finisherDamage: 214, range: 2.65, radius: 1.2, stamina: 0, cooldown: 25,
    stun: 1.1, finisherStun: 2.3, knockback: 0, finisherKnockback: 16,
    lunge: 5, close: 6, style: 'melee', guardBreak: true,
    confirm: { recovery: .58 } },
};
export const BLACKBEARD_COMBOS: ComboRow = {
  lh: { name: 'Dark Backfist', range: 2.5, radius: .8 },
  llh: { name: 'Quake Uppercut', range: 2.6, radius: .85 },
  lllh: { name: 'Island Breaker', range: 2.9, radius: 1.1 },
  llls: { name: 'Gravity Crash', range: 2.9, radius: 1.1 },
  airHeavy: { name: 'Emperor Heel', range: 2.55, radius: 1 },
  airSpecial: { name: 'Dark Descent', radius: 3.5 },
};
export const BLACKBEARD_CONTACTS = {
  light: .24 / .56, heavy: .60 / 1.10, special: .72 / 1.42,
  ultimate: [.52 / 3.92, 1.53 / 3.92, 3.25 / 3.92],
  rush: [.22 / .52, .27 / .60, .32 / .72],
  combos: { lh: .30 / .72, llh: .39 / .86, lllh: .55 / 1.12,
    llls: .59 / 1.20, airHeavy: .46 / .94, airSpecial: .56 / 1.1 },
} as const;
export const BLACKBEARD_AWAKENING = {
  name: "Emperor's Ambition", clip: 'Emperor Ambition', duration: 1.8,
  entryDuration: .9, beats: { coil: .18, darkness: .36, quake: .55, dominion: .76 },
  manualOnly: true,
} as const;

import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const YUTA_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Cursed Katana', duration: .44, contacts: [.168], damage: 20, range: 2.65, radius: .67,
    stamina: 10, cooldown: .44, stun: .3, knockback: 3.1, lunge: 3.9, style: 'melee' },
  heavy: { name: 'Severing Resolve', duration: .88, contacts: [.4928], damage: 63, range: 2.85, radius: .84,
    stamina: 25, cooldown: 1.25, stun: .7, knockback: 8, lunge: 4.3, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Cursed Speech', duration: 1, contacts: [.55], damage: 118, range: 22, radius: .95,
    stamina: 32, cooldown: 4.8, stun: .85, knockback: 8, speed: 32, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'Pure Love', duration: 3.2, contacts: [.576, 1.44, 2.592], schedule: [44, 44, 251],
    damage: 44, finisherDamage: 202, range: 2.95, radius: 1.1, stamina: 0, cooldown: 23, stun: .72,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 5.2, close: 5.2,
    style: 'melee', guardBreak: true, confirm: { recovery: .52 } },
};
export const YUTA_COMBOS: ComboRow = {
  lh: { name: 'Return Cut', range: 2.7, radius: .78 },
  llh: { name: 'Rising Resolve', range: 2.7, radius: .8 },
  lllh: { name: 'Falling Resolve', range: 2.9, radius: .92 },
  llls: { name: 'Echo Command', range: 2.65, radius: .95 },
  airHeavy: { name: 'Air Sever', range: 2.8, radius: .9 },
  airSpecial: { name: 'Air Command', radius: 3.2 },
};
export const YUTA_CONTACTS = {
  light: .48, heavy: .56, special: .55, ultimate: [.18, .45, .81],
  rush: [.48, .56, .48], combos: { lh: .48, llh: .48, lllh: .56, llls: .55, airHeavy: .56, airSpecial: .55 },
} as const;
export const YUTA_AWAKENING = {
  name: 'Queen of Curses', clip: 'Ring Pact', duration: 2,
  beats: { ring: .36, vow: .72, manifestation: 1.12 }, manualOnly: true,
} as const;

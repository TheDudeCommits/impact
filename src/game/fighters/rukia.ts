import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const RUKIA_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'White Moon Cut', duration: .44, contacts: [.168], damage: 19, range: 2.45, radius: .62,
    stamina: 9, cooldown: .44, stun: .3, knockback: 3.2, lunge: 3.8, style: 'melee' },
  heavy: { name: 'Some no Mai: Tsukishiro', duration: .94, contacts: [.51], damage: 59, range: 2.75, radius: .9,
    stamina: 24, cooldown: 1.35, stun: .76, knockback: 7.8, lunge: 3.4, style: 'melee', outcome: 'launch', lift: 5.8 },
  special: { name: 'Tsugi no Mai: Hakuren', duration: 1.12, contacts: [.64], damage: 119, range: 25, radius: 1.15,
    stamina: 32, cooldown: 4.7, stun: .84, knockback: 8.8, speed: 29, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'Shirayuki: White Haze', duration: 3.15, contacts: [.54, 1.58, 2.54], schedule: [54, 54, 228],
    damage: 54, finisherDamage: 182, range: 2.9, radius: .95, stamina: 0, cooldown: 23,
    stun: 1.25, finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 5.8, close: 5.8,
    style: 'melee', guardBreak: true, confirm: { recovery: .48 } },
};
export const RUKIA_COMBOS: ComboRow = {
  lh: { name: 'Snow Reverse Cut', range: 2.55, radius: .72 },
  llh: { name: 'Snow Rising Cut', range: 2.55, radius: .75 },
  lllh: { name: 'White Moon Descent', range: 2.65, radius: .84 },
  llls: { name: 'San no Mai: Shirafune', range: 2.7, radius: .8 },
  airHeavy: { name: 'Falling Snow Cut', range: 2.6, radius: .8 },
  airSpecial: { name: 'Snowfall Landing', radius: 3.2 },
};
export const RUKIA_AWAKEN_BEATS = Object.freeze({ still: .18, lift: .36, release: .585, settle: .81 });

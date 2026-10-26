import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const TODOROKI_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Ice Knuckle', duration: .44, contacts: [.168], damage: 22,
    range: 2.4, radius: .65, stamina: 10, cooldown: .44, stun: .3,
    knockback: 3.4, lunge: 3.8, style: 'melee' },
  heavy: { name: 'Flame Arc', duration: .96, contacts: [.5184], damage: 65,
    range: 2.9, radius: .95, stamina: 26, cooldown: 1.25, stun: .7,
    knockback: 8.5, lunge: 4.4, style: 'melee', outcome: 'wallBounce' },
  special: { name: 'Heaven-Piercing Ice Wall', duration: 1.2, contacts: [.672], damage: 120,
    range: 24, radius: 1.05, stamina: 33, cooldown: 4.7, stun: .9,
    knockback: 8, speed: 23, style: 'projectile', outcome: 'knockdown', aimOnRelease: true },
  ultimate: { name: 'Great Glacial Aegir', duration: 3.6,
    contacts: [.558, 1.656, 2.916], schedule: [42, 58, 238], damage: 42, finisherDamage: 206,
    range: 2.8, radius: 1.1, stamina: 0, cooldown: 23, stun: 1.15,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 5.5, close: 6,
    style: 'melee', guardBreak: true, confirm: { recovery: .52 } },
};
export const TODOROKI_COMBOS: ComboRow = {
  lh: { name: 'Frost Backfist', range: 2.45, radius: .8 },
  llh: { name: 'Ice Fang', range: 2.55, radius: .85 },
  lllh: { name: 'Flame Hammer', range: 2.8, radius: .95 },
  llls: { name: 'Flashfire Palm', range: 3, radius: .98 },
  airHeavy: { name: 'Aerial Flame Arc', range: 2.65, radius: .9 },
  airSpecial: { name: 'Glacial Landing', radius: 3.3 },
};
export const todorokiStrikesLeft = (action: string, ender: string | undefined): boolean => action === 'heavy' && !ender;
export const TODOROKI_CONTACTS = {
  light: .48, heavy: .54, special: .56, ultimate: [.155, .46, .81],
  rush: [.48, .49, .54],
  combos: { lh: .49, llh: .55, lllh: .57, llls: .54, airHeavy: .57, airSpecial: .56 },
} as const;
export const TODOROKI_AWAKENING = {
  name: 'Phosphor', clip: 'Phosphor', duration: 1.8, entryDuration: .9,
  beats: { draw: .18, balance: .423, ignition: .585, open: .747 },
  manualOnly: true,
} as const;

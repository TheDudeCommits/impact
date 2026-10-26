import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const YAMATO_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Takeru Sweep', duration: .47, contacts: [.168], damage: 23,
    range: 2.85, radius: .75, stamina: 11, cooldown: .47, stun: .32,
    knockback: 3.8, lunge: 4.2, style: 'melee' },
  heavy: { name: 'Oni Hammer', duration: 1.01, contacts: [.56], damage: 65,
    range: 3.15, radius: .95, stamina: 28, cooldown: 1.22, stun: .75,
    knockback: 9, lunge: 4.3, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Narikabura Arrow', duration: 1.30, contacts: [.66], damage: 122,
    range: 25, radius: .78, stamina: 35, cooldown: 5.2, stun: .85,
    knockback: 8.5, speed: 29, style: 'projectile', outcome: 'wallBounce', aimOnRelease: true },
  ultimate: { name: 'Thunder Bagua', duration: 3.72, contacts: [.54, 1.54, 3.12],
    schedule: [45, 66, 238], damage: 45, finisherDamage: 210,
    range: 3.05, radius: 1.05, stamina: 0, cooldown: 24, stun: 1.15,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 5.5, close: 6,
    style: 'melee', guardBreak: true, confirm: { recovery: .54 } },
};
export const YAMATO_COMBOS: ComboRow = {
  lh: { name: 'Oni Backhand', range: 2.9, radius: .85 },
  llh: { name: 'Rising Kanabo', range: 2.95, radius: .9 },
  lllh: { name: 'Wano Crusher', range: 3.2, radius: 1 },
  llls: { name: 'Thunder Sweep', range: 3.2, radius: 1 },
  airHeavy: { name: 'Ogre Descent', range: 2.95, radius: 1 },
  airSpecial: { name: 'Wano Groundbreak', radius: 3.5 },
};
export const YAMATO_CONTACTS = {
  light: .24 / .58, heavy: .56 / 1.08, special: .66 / 1.30,
  ultimate: [.54 / 3.72, 1.54 / 3.72, 3.12 / 3.72],
  rush: [.22 / .52, .24 / .56, .30 / .68],
  combos: { lh: .31 / .72, llh: .37 / .82, lllh: .49, llls: .57 / 1.12, airHeavy: .5, airSpecial: .5 },
} as const;
export const YAMATO_AWAKENING = {
  name: 'Oni Resolve', clip: 'Oni Resolve', duration: 1.8, entryDuration: .9,
  beats: { coil: .225, breath: .425, ignition: .55, point: .75 },
  manualOnly: true,
} as const;
export const YAMATO_CINEMATIC = {
  opener: { clip: 'Thunder Bagua', at: .54 / 3.72 },
  cine: { from: .54 / 3.72, at: 3.12 / 3.72,
    windows: [[.54 / 3.72, .57, 1.54 / 3.72], [.57, 1, 3.12 / 3.72]] },
} as const;

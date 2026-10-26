import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const DENJI_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Saw Rake', duration: .42, contacts: [.152], damage: 21,
    range: 2.35, radius: .68, stamina: 9, cooldown: .42, stun: .29,
    knockback: 3, lunge: 3.8, style: 'melee' },
  heavy: { name: 'Cross Saw', duration: .85, contacts: [.47], damage: 64,
    range: 2.55, radius: .92, stamina: 25, cooldown: 1.25, stun: .68,
    knockback: 8, lunge: 4.2, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Ripcord Rush', duration: 1.2, contacts: [1.2 * .7 / 1.15], damage: 124,
    range: 2.65, radius: 1, stamina: 30, cooldown: 4.6, stun: .78,
    knockback: 10, lunge: 11, style: 'melee', outcome: 'wallBounce' },
  ultimate: { name: 'Devil’s Engine', duration: 2.81, contacts: [.48, 1, 1.4, 2.2],
    schedule: [38, 34, 34, 265], damage: 38, finisherDamage: 176,
    range: 2.7, radius: 1.1, stamina: 0, cooldown: 22, stun: .6,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 5,
    style: 'melee', guardBreak: true, confirm: { recovery: .5 } },
};

export const DENJI_COMBOS: ComboRow = {
  lh: { name: 'Reverse Rake', range: 2.35, radius: .8 },
  llh: { name: 'Rising Saw', range: 2.4, radius: .82 },
  lllh: { name: 'Crosscut Downstroke', range: 2.55, radius: .9 },
  llls: { name: 'Engine Drive', range: 2.65, radius: .9 },
  airHeavy: { name: 'Falling Chainsaw', range: 2.5, radius: .9 },
  airSpecial: { name: 'Devil’s Landing', radius: 3.1 },
};


export const DENJI_AWAKENING = {
  name: 'Ripcord Overdrive', clip: 'Ripcord Awakening', duration: 2,
  beats: { grip: .4, pull: 1.04, engine: 1.4 }, manualOnly: true,
} as const;

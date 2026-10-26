import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const ALL_MIGHT_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Texas Jab', duration: .44, contacts: [.168], damage: 22,
    range: 2.2, radius: .78, stamina: 9, cooldown: .44, stun: .33,
    knockback: 3.5, lunge: 3.4, style: 'melee' },
  heavy: { name: 'Carolina Smash', duration: .96, contacts: [.4992], damage: 65,
    range: 2.25, radius: .95, stamina: 25, cooldown: 1.21, stun: .72,
    knockback: 10, lunge: 3, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Detroit Smash', duration: 1.25, contacts: [.7], damage: 112,
    range: 24, radius: 1.05, stamina: 29, cooldown: 4.6, stun: .72,
    knockback: 10, speed: 28, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'United States of Smash', duration: 3.4, contacts: [.51, 1.326, 2.72],
    schedule: [40, 51, 261], damage: 40, finisherDamage: 220,
    range: 2.35, radius: 1, stamina: 0, cooldown: 23, stun: .9,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16,
    close: 7, lunge: 11, style: 'melee', guardBreak: true,
    confirm: { recovery: .65 } },
};

export const ALL_MIGHT_COMBOS: ComboRow = {
  lh: { name: 'Hero Backfist', range: 2.2, radius: .85 },
  llh: { name: 'Hero Uppercut', range: 2.25, radius: .9 },
  lllh: { name: 'Double Hammer', range: 2.3, radius: 1 },
  llls: { name: 'Pressure Smash', range: 2.35, radius: .95 },
  airHeavy: { name: 'Aerial Hammer', range: 2.3, radius: .95 },
  airSpecial: { name: 'Meteor Landing', radius: 3.4 },
};


export const ALL_MIGHT_AWAKENING = {
  name: 'One For All', clip: 'One For All', sourceDuration: 1.5,
  runtimeDuration: .9, model: '/assets/fighters/all-might-mhur1.glb', height: 2.2,
  beats: { gather: .162, brace: .333, release: .54, settle: .711 },
  manualOnly: true,
} as const;

export const ALL_MIGHT_ULTIMATE_BEATS = {
  confirm: .51, cross: 1.326, gather: 1.734, overhead: 2.142,
  release: 2.72, recover: 3.06, end: 3.4,
} as const;

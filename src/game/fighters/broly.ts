import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const BROLY_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Berserker Hook', duration: .44, contacts: [.168], damage: 24,
    range: 2.15, radius: .8, stamina: 10, cooldown: .44, stun: .34,
    knockback: 3.5, lunge: 3.4, style: 'melee' },
  heavy: { name: 'Crushing Hammer', duration: .92, contacts: [.4968], damage: 65,
    range: 2.3, radius: .95, stamina: 26, cooldown: 1.11, stun: .72,
    knockback: 10, lunge: 3.2, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Eraser Blow', duration: 1.2, contacts: [.672], damage: 114,
    range: 25, radius: 1, stamina: 29, cooldown: 4.5, stun: .7,
    knockback: 9, speed: 26, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'Gigantic Roar', duration: 3.24, contacts: [.47952, 1.2636, 2.4948],
    schedule: [36, 40, 266], damage: 36, finisherDamage: 218,
    range: 2.4, radius: 1, stamina: 0, cooldown: 23, stun: .9,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16,
    close: 7, lunge: 12, style: 'melee', guardBreak: true,
    confirm: { recovery: .65 } },
};

export const BROLY_COMBOS: ComboRow = {
  lh: { name: 'Crushing Backfist', range: 2.2, radius: .9 },
  llh: { name: 'Gigantic Rising Fist', range: 2.25, radius: .9 },
  lllh: { name: 'Gigantic Hammer', range: 2.3, radius: 1 },
  llls: { name: 'Eraser Cannon', range: 2.3, radius: .9 },
  airHeavy: { name: 'Aerial Hammer', range: 2.25, radius: .95 },
  airSpecial: { name: 'Meteor Landing', radius: 3.3 },
};

export const BROLY_CONTACTS = {
  light: .48, heavy: .54, special: .56,
  ultimate: [.148, .39, .77], rush: [.48, .48, .54],
  combos: { lh: .48, llh: .52, lllh: .54, llls: .56, airHeavy: .54, airSpecial: .54 },
} as const;

export const BROLY_AWAKENING = {
  name: 'Full Power Super Saiyan', clip: 'Unbound Fury', duration: 1.5,
  baseModel: '/assets/fighters/broly-base-df1.glb',
  model: '/assets/fighters/broly-lssj-df1.glb',
  baseHeight: 2.1, awakenedHeight: 2.26,
  beats: { gather: .27, strain: .54, transform: .795, settle: 1.17 },
  transformAt: .53, manualOnly: true,
} as const;

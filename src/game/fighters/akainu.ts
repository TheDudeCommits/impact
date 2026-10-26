import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const AKAINU_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Magma Knuckle', duration: .45, contacts: [.168], damage: 21, range: 2.45, radius: .65,
    stamina: 11, cooldown: .45, stun: .3, knockback: 3.3, lunge: 4.2, style: 'melee' },
  heavy: { name: 'Great Eruption', duration: .96, contacts: [.45 * 1.02 / 1.04], damage: 64, range: 3.05, radius: .92,
    stamina: 27, cooldown: 1.3, stun: .72, knockback: 8.6, lunge: 4.4, style: 'melee', outcome: 'wallBounce' },
  special: { name: 'Crimson Hound Bite', duration: 1.65, contacts: [.74], damage: 124, range: 25, radius: 1.12,
    stamina: 34, cooldown: 4.7, stun: .86, knockback: 9.2, speed: 24, style: 'projectile', outcome: 'wallBounce', aimOnRelease: true },
  ultimate: { name: 'Meteor Volcano', duration: 3.95, contacts: [.44, 1.51, 3.15], schedule: [48, 72, 226],
    damage: 48, finisherDamage: 203, range: 3.1, radius: 1.15, stamina: 0, cooldown: 24,
    stun: 1.25, finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 6, close: 6,
    style: 'melee', guardBreak: true, confirm: { recovery: .55 } },
};

export const AKAINU_COMBOS: ComboRow = {
  lh: { name: 'Magma Backfist', range: 2.6, radius: .85 },
  llh: { name: 'Eruption Uppercut', range: 2.55, radius: .88 },
  lllh: { name: 'Magma Hammer', range: 2.85, radius: .95 },
  llls: { name: 'Hound Burst', range: 3, radius: 1 },
  airHeavy: { name: 'Molten Descent', range: 2.7, radius: .95 },
  airSpecial: { name: 'Volcanic Landing', radius: 3.5 },
};

export const AKAINU_CONTACTS = {
  light: 8 / 24, heavy: 13 / 33, special: 22 / 60, ultimate: .44 / 3.95,
  rush1: 8 / 20, rush2: 8 / 23, rush3: 10 / 30,
  combos: { lh: 8 / 23, llh: 8 / 20, lllh: 10 / 30, llls: 13 / 51,
    airHeavy: 10 / 30, airSpecial: 7 / 42 },
} as const;


export const AKAINU_AWAKENING = {
  name: 'ABSOLUTE JUSTICE', clip: 'Absolute Justice', duration: 44 / 30, entryDuration: .9,
  beats: { gather: .08, fistRaise: .16, magmaSwap: .35, release: .38 },
  manualOnly: true,
  canonScope: 'Gameplay magma-focus state; no claim that a canonical Devil Fruit awakening has been revealed.',
} as const;

export const AKAINU_CINEMATIC = {
  opener: { clip: 'Meteor Volcano', at: .44 / 3.95 },
  cine: { from: .44 / 3.95, at: 3.15 / 3.95,
    windows: [[.44 / 3.95, 2.55 / 3.95, 1.51 / 3.95], [2.55 / 3.95, 1, 3.15 / 3.95]] },
} as const;

export type AkainuArmVariant = 'Normal' | 'Magma' | 'Hound';
export function akainuArmVariants(action: string, elapsed: number, awakened = false, clip?: string): readonly [AkainuArmVariant, AkainuArmVariant] {
  if (action === 'awaken') return elapsed >= AKAINU_AWAKENING.beats.magmaSwap ? ['Magma', 'Magma'] : ['Normal', 'Normal'];
  const rest: AkainuArmVariant = awakened ? 'Magma' : 'Normal';
  if (clip === 'Volcanic Landing' && action === 'special') return ['Magma', 'Magma'];
  if (clip === 'Hound Burst' && action === 'special') return elapsed >= .12 && elapsed < .46 ? ['Hound', rest] : [rest, rest];
  const right = clip === 'Rush 2' || clip === 'Magma Backfist' || clip === 'Eruption Uppercut';
  if (action === 'special' && elapsed >= .28 && elapsed < .79) return ['Hound', rest];
  if (action === 'light' && elapsed >= .08 && elapsed < .43) return right ? [rest, 'Magma'] : ['Magma', rest];
  if (action === 'heavy' && elapsed >= .12 && elapsed < .9) return right ? [rest, 'Magma'] : ['Magma', rest];
  if (action === 'ultimate') return elapsed >= .82 && elapsed < 2.75 ? ['Normal', 'Normal'] : ['Magma', 'Magma'];
  return [rest, rest];
}

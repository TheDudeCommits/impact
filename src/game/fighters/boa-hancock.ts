import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';
import type { AwakeningDefinition } from '../awakening';

export const BOA_HANCOCK_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Pistol Kiss', duration: .44, contacts: [.152], damage: 19, range: 12, radius: .32,
    stamina: 10, cooldown: .44, stun: .26, knockback: 2.6, speed: 32, style: 'projectile', aimOnRelease: true },
  heavy: { name: 'Perfume Femur', duration: 1, contacts: [.28, .52, .78], damage: 22, finisherDamage: 33,
    range: 2.25, radius: .72, stamina: 25, cooldown: 1.3, stun: .34, finisherStun: .65,
    knockback: 1.5, finisherKnockback: 8, lunge: 4.2, style: 'melee', outcome: 'wallBounce' },
  special: { name: 'Slave Arrow', duration: 1.28, contacts: [.54], damage: 116, range: 28, radius: 1.1,
    stamina: 32, cooldown: 4.6, stun: .85, knockback: 5, speed: 31, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'Perfume Femur: Empress', duration: 2.85, contacts: [.42, 1.86], schedule: [52, 253],
    damage: 52, finisherDamage: 230, range: 2.35, radius: .9, stamina: 0, cooldown: 23,
    stun: 1.3, finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 5.8,
    close: 5.8, style: 'melee', guardBreak: true, confirm: { recovery: .5 } },
};

export const BOA_HANCOCK_COMBOS: ComboRow = {
  lh: { name: 'Perfume Sweep', range: 2.25, radius: .8 },
  llh: { name: 'Empress Rising Heel', range: 2.1, radius: .72 },
  lllh: { name: 'Empress Heel Drop', range: 2.15, radius: .8 },
  llls: { name: 'Slave Arrow Volley', range: 15, radius: .8, style: 'projectile', speed: 31, aimOnRelease: true },
  airHeavy: { name: 'Perfume Air Kick', range: 2.25, radius: .8 },
  airSpecial: { name: 'Empress Landing', radius: 3.0 },
};

export const BOA_HANCOCK_AWAKENING: AwakeningDefinition = {
  name: 'PIRATE EMPRESS', kind: 'aura', aura: [0xffe5ef, 0xe54b94], auraGlow: .22,
  clips: ['Pirate Empress'], swapAt: .38,
};

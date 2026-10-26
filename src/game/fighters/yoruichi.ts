import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';
import type { AwakeningDefinition } from '../awakening';

export const YORUICHI_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Hakuda Palm', duration: .42, contacts: [.152], damage: 23,
    range: 1.85, radius: .64, stamina: 9, cooldown: .42, stun: .29,
    knockback: 2.5, lunge: 3.5, style: 'melee' },
  heavy: { name: 'Flash Heel', duration: .78, contacts: [.4212], damage: 65,
    range: 2.15, radius: .75, stamina: 24, cooldown: 1.18, stun: .65,
    knockback: 8.5, lunge: 4.5, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Shunko Strike', duration: 1.08, contacts: [.594], damage: 118,
    range: 2.25, radius: .85, stamina: 31, cooldown: 4.4, stun: .7,
    knockback: 9, lunge: 12, close: 6, style: 'melee' },
  ultimate: { name: 'Shunko: Raijin Senkei', duration: 3, contacts: [.42, 1.05, 1.62, 2.34],
    schedule: [32, 55, 56, 222], damage: 32, finisherDamage: 194,
    range: 2.25, radius: .85, stamina: 0, cooldown: 23, stun: 1.05,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16,
    close: 6.5, lunge: 11, style: 'melee', guardBreak: true,
    confirm: { recovery: .48 } },
};
export const YORUICHI_COMBOS: ComboRow = {
  lh: { name: 'Hakuda Elbow', range: 1.95, radius: .7 },
  llh: { name: 'Rising Flash', range: 2.1, radius: .72 },
  lllh: { name: 'Thunder Heel', range: 2.2, radius: .78 },
  llls: { name: 'Shunko Palm', range: 2.2, radius: .8 },
  airHeavy: { name: 'Aerial Flash Heel', range: 2.15, radius: .78 },
  airSpecial: { name: 'Thunder Descent', radius: 3.1 },
};
export const YORUICHI_CONTACTS = {
  light: .44, heavy: .54, special: .55, ultimate: [.14, .35, .54, .78],
  rush: [.44, .48, .54],
  combos: { lh: .48, llh: .52, lllh: .54, llls: .55, airHeavy: .54, airSpecial: .54 },
} as const;
export const YORUICHI_AWAKENING: AwakeningDefinition = {
  name: 'SHUNKO', kind: 'aura', aura: [0xf4eaff, 0xa663ee], auraGlow: .22,
  clips: ['Shunko Release'], swapAt: .486,
};

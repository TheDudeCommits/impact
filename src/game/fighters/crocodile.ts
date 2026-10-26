import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';
export const CROCODILE_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Hook Slash', duration: .47, contacts: [.168], damage: 22, range: 2.65, radius: .78, stamina: 11, cooldown: .47, stun: .33, knockback: 3.6, lunge: 4, style: 'melee' },
  heavy: { name: 'Desert Spada', duration: .96, contacts: [.44], damage: 65, range: 3.05, radius: .96, stamina: 28, cooldown: 1.25, stun: .75, knockback: 8.5, lunge: 3.5, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Sables', duration: 1.35, contacts: [.58], damage: 118, range: 24, radius: 1.05, stamina: 35, cooldown: 5.2, stun: .8, knockback: 9, speed: 22, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'Ground Death', duration: 3.3, contacts: [.34, 1.315, 2.298], schedule: [45, 65, 239], damage: 45, finisherDamage: 210, range: 3.15, radius: 1.16, stamina: 0, cooldown: 24, stun: 1.2, finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 5.6, close: 6, style: 'melee', guardBreak: true, confirm: { recovery: .57 } },
};
export const CROCODILE_COMBOS: ComboRow = {
  lh: { name: 'Golden Hook', range: 2.8, radius: .84 },
  llh: { name: 'Desert Girasole', range: 2.8, radius: .88 },
  lllh: { name: 'Desert Encierro', range: 3, radius: .97 },
  llls: { name: 'Sandstorm Burst', range: 3.1, radius: 1 },
  airHeavy: { name: 'Dune Breaker', range: 2.95, radius: .97 },
  airSpecial: { name: 'Desert Landing', radius: 3.6 },
};
export const CROCODILE_AWAKENING = { name: 'DESERT SOVEREIGN', clip: 'Desert Sovereign', duration: 44 / 30, entryDuration: .9, beats: { raise: .25, release: .46, settle: .78 }, manualOnly: true, canonScope: 'Gameplay Logia mastery stance; not a canonical physical transformation.' } as const;
export const CROCODILE_CONTACTS = { light: .25 / .58, heavy: .44 / 1.1, special: .58 / 1.35, ultimate: [.34 / 4.1, 1.48 / 4.1, 3.10 / 4.1], rush: [.24 / .52, .25 / .58, .36 / .74], combos: { lh: .34 / .76, llh: .38 / .84, lllh: .47, llls: .55 / 1.1, airHeavy: .47, airSpecial: .5 } } as const;
export function crocodileStrikeSide(action: string, elapsed = 0, clip?: string): 'Left' | 'Right' {
  if (clip && ['Hook Slash', 'Rush 1', 'Rush 2', 'Golden Hook', 'Desert Girasole'].includes(clip)) return 'Left';
  if (action === 'special' || action === 'heavy' || action === 'ultimate' && elapsed >= .8 || clip && ['Rush 3', 'Desert Encierro', 'Sandstorm Burst', 'Dune Breaker', 'Desert Landing'].includes(clip)) return 'Right';
  return 'Left';
}

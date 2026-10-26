import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const BAKUGO_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Palm Burst', duration: .42, contacts: [.152], damage: 22,
    range: 1.95, radius: .68, stamina: 9, cooldown: .42, stun: .3,
    knockback: 3.1, lunge: 4.1, style: 'melee' },
  heavy: { name: 'Stun Grenade', duration: .92, contacts: [.4784], damage: 64,
    range: 2.25, radius: .95, stamina: 23, cooldown: 1.2, stun: .68,
    knockback: 8.5, lunge: 2.8, style: 'melee', outcome: 'knockdown' },
  special: { name: 'AP Shot', duration: 1.05, contacts: [.5985], damage: 98,
    range: 29, radius: .62, stamina: 26, cooldown: 4.25, stun: .55,
    knockback: 8, speed: 36, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'Howitzer Impact', duration: 3.4, contacts: [.544, 1.632, 2.652],
    schedule: [32, 44, 266], damage: 32, finisherDamage: 226,
    range: 2.2, radius: .9, stamina: 0, cooldown: 23, stun: .85,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16,
    close: 7, lunge: 13, style: 'melee', guardBreak: true,
    confirm: { recovery: .6 } },
};
export const BAKUGO_COMBOS: ComboRow = {
  lh: { name: 'Blast Cross', range: 2.05, radius: .75 },
  llh: { name: 'Rising Detonation', range: 2.15, radius: .8 },
  lllh: { name: 'Gauntlet Cannon', range: 2.25, radius: .95 },
  llls: { name: 'AP Shot Burst', range: 2.1, radius: .75 },
  airHeavy: { name: 'Aerial Detonation', range: 2.25, radius: .95 },
  airSpecial: { name: 'Blast Landing', radius: 3.1 },
};
export const BAKUGO_CONTACTS = {
  light: .46, heavy: .52, special: .57, ultimate: [.16, .48, .78],
  rush: [.46, .46, .52],
  combos: { lh: .46, llh: .54, lllh: .52, llls: .57, airHeavy: .52, airSpecial: .52 },
} as const;
export const BAKUGO_AWAKENING = {
  name: 'Cluster', clip: 'Cluster Ignition', duration: 1.6, entryDuration: .9,
  beats: { compress: .18, strain: .342, release: .549, guard: .747 },
  manualOnly: true, model: '/assets/fighters/bakugo-mhur1.glb', height: 1.9,
  identity: 'Crossed grenade gauntlets open into a twin-palm detonation; compact orange sparks stay at the palms. No costume swap or automatic explosions.',
} as const;

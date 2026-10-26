import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const MIHAWK_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Yoru Slash', duration: .44, contacts: [.168], damage: 20, range: 2.7, radius: .65,
    stamina: 10, cooldown: .44, stun: .29, knockback: 3.2, lunge: 3.8, style: 'melee' },
  heavy: { name: 'Black Blade Cleave', duration: .9, contacts: [.375], damage: 61, range: 2.9, radius: .85,
    stamina: 25, cooldown: 1.25, stun: .7, knockback: 8, lunge: 4.5, style: 'melee', outcome: 'wallBounce' },
  special: { name: 'Black Blade: Night', duration: 1.48, contacts: [.74], damage: 126, range: 32, radius: 1.25,
    stamina: 32, cooldown: 4.6, stun: .9, knockback: 9, speed: 30, style: 'projectile', outcome: 'wallBounce', aimOnRelease: true },
  ultimate: { name: "I Won’t Hold Back", duration: 2.8, contacts: [.55, 1.95], schedule: [58, 255], damage: 58, finisherDamage: 232, range: 3.2, radius: 1.25,
    stamina: 0, cooldown: 22, stun: 1.35, finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 6, close: 6, style: 'melee', guardBreak: true, confirm: { recovery: .5 } },
};

export const MIHAWK_COMBOS: ComboRow = {
  lh: { name: 'Yoru Backcut', range: 2.8, radius: .8 },
  llh: { name: 'Rising Black Blade', range: 2.8, radius: .8 },
  lllh: { name: 'Yoru Downstroke', range: 2.9, radius: .9 },
  llls: { name: 'Yoru Downward Cut', range: 2.4, radius: .75 },
  airHeavy: { name: 'Descending Yoru', range: 2.8, radius: .9 },
  airSpecial: { name: 'Black Blade Landing', radius: 3.4 },
};

import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const HINATA_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Gentle Palm', duration: .42, contacts: [.152], damage: 22, range: 2.15, radius: .56,
    stamina: 8, cooldown: .44, stun: .30, knockback: 2.8, lunge: 4.1, style: 'melee' },
  heavy: { name: 'Eight Trigrams Twin Palm', duration: .8, contacts: [.432], damage: 62, range: 2.5, radius: .74,
    stamina: 24, cooldown: 1.08, stun: .69, knockback: 7.1, lunge: 4.5, style: 'melee', outcome: 'launch' },
  special: { name: 'Eight Trigrams Vacuum Palm', duration: 1.05, contacts: [.588], damage: 108, range: 22, radius: .85,
    stamina: 31, cooldown: 4.5, stun: .75, knockback: 7.8, style: 'beam', aimOnRelease: true },
  ultimate: { name: 'Twin Lion Sixty-Four Palms', duration: 3.7, contacts: [.36, .88, 1.38, 1.9, 2.48, 3.1],
    schedule: [25, 25, 26, 27, 28, 333], damage: 25, finisherDamage: 165, range: 2.7, radius: .90,
    stamina: 0, cooldown: 24, stun: 1.0, finisherStun: 2.3, knockback: 0, finisherKnockback: 16,
    lunge: 6, close: 6, style: 'melee', guardBreak: true, confirm: { recovery: .56 } },
};
export const HINATA_COMBOS: ComboRow = {
  lh: { name: 'Tenketsu Backpalm', range: 2.35, radius: .65 },
  llh: { name: 'Rising Gentle Palm', range: 2.4, radius: .75 },
  lllh: { name: 'Eight Trigrams Sweep', range: 2.65, radius: .84 },
  llls: { name: 'Vacuum Burst', range: 2.9, radius: .84 },
  airHeavy: { name: 'Aerial Twin Palm', range: 2.4, radius: .79 },
  airSpecial: { name: 'Guardian Descent', radius: 3.1 },
};
export type HinataStrikeSide='Left'|'Right'|'Both';
const HINATA_ULT_SIDES:readonly HinataStrikeSide[]=['Left','Right','Left','Right','Left','Both'];
export function hinataStrikeSide(action:string,elapsed=0,clip?:string,contactIndex?:number):HinataStrikeSide{
 if(action==='ultimate'&&(!clip||clip==='Twin Lion Sixty-Four Palms')){
  const index=contactIndex===undefined?[.62,1.13,1.64,2.19,2.79].filter(t=>elapsed>=t).length:Math.max(0,Math.min(5,Math.floor(contactIndex)));
  return HINATA_ULT_SIDES[index];
 }
 if(clip==='Eight Trigrams Twin Palm'||clip==='Rush 3'||clip==='Aerial Twin Palm'||clip==='Guardian Descent')return 'Both';
 if(clip==='Rush 1'||clip==='Vacuum Palm'||clip==='Vacuum Burst'||clip==='Rising Gentle Palm')return 'Right';
 if(clip==='Gentle Palm'||clip==='Rush 2'||clip==='Tenketsu Backpalm'||clip==='Eight Trigrams Sweep')return 'Left';
 return action==='heavy'?'Both':action==='special'?'Right':'Left';
}
export const HINATA_AWAKENING = {
  name: 'TWIN LION FISTS', clip: 'Twin Lion Release', duration: 1.5, entryDuration: .9,
  beats: { seal: .162, focus: .288, unfold: .459, release: .63 }, manualOnly: true,
  canonScope: 'Gameplay Byakugan and Twin Lion focus; no new canonical body transformation.',
} as const;
export const HINATA_CINEMATIC = {
  opener: { clip: 'Twin Lion Sixty-Four Palms', at: .10 },
  cine: { from: .10, at: .861111, windows: [[.10, .34, .244444], [.34, .48, .383333], [.48, .62, .527778], [.62, .79, .688889], [.79, 1, .861111]] },
} as const;

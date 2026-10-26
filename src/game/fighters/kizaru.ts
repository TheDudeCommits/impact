import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';
import type { AwakeningDefinition } from '../awakening';

export const KIZARU_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Glint Kick', duration: .47, contacts: [.168], damage: 21,
    range: 2.35, radius: .65, stamina: 10, cooldown: .47, stun: .31,
    knockback: 3, lunge: 3.8, style: 'melee' },
  heavy: { name: 'Lightspeed Heel', duration: .85, contacts: [.46896551724], damage: 65,
    range: 2.55, radius: .78, stamina: 25, cooldown: 1.28, stun: .65,
    knockback: 6.5, lunge: 4, style: 'melee', outcome: 'spin' },
  special: { name: 'Finger Laser', duration: 1.05, contacts: [.4515], damage: 118,
    range: 26, radius: .57, stamina: 32, cooldown: 4.4, stun: .7,
    knockback: 8, style: 'beam', outcome: 'wallBounce' },
  ultimate: { name: 'Yasakani no Magatama', duration: 3.45, contacts: [.39, 1.32, 1.92, 2.74],
    schedule: [30, 70, 65, 196], damage: 30, finisherDamage: 200,
    range: 2.5, radius: .9, stamina: 0, cooldown: 24, stun: 1.05,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16,
    close: 6.5, lunge: 11, style: 'melee', guardBreak: true,
    confirm: { recovery: .48 } },
};
export const KIZARU_COMBOS: ComboRow = {
  lh: { name: 'Photon Roundhouse', range: 2.45, radius: .75 },
  llh: { name: 'Rising Ray', range: 2.5, radius: .75 },
  lllh: { name: 'Flash Heel Drop', range: 2.6, radius: .82 },
  llls: { name: 'Radiant Kick', range: 2.4, radius: .78 },
  airHeavy: { name: 'Aerial Light Wheel', range: 2.5, radius: .8 },
  airSpecial: { name: 'Sunfall', radius: 3.2 },
};
export const KIZARU_CONTACTS = {
  light: 14.5 / 32, heavy: 16 / 29, special: .43,
  ultimate: [.39 / 3.45, 1.32 / 3.45, 1.92 / 3.45, 2.74 / 3.45],
  rush: [14.5 / 31, 16 / 29, 23.5 / 43],
  combos: { lh: 16 / 29, llh: 17 / 30, lllh: 23.5 / 43, llls: 14.5 / 32, airHeavy: 16 / 29, airSpecial: 23.5 / 43 },
} as const;
export const KIZARU_AWAKENING: AwakeningDefinition = {
  name: 'GLINT OVERDRIVE', kind: 'aura', aura: [0xfffbe4, 0xf9c238], auraGlow: .17,
  clips: ['Glint Overdrive'], swapAt: .36,
};
export const KIZARU_CINEMATIC = {
  opener: { clip: 'Yasakani no Magatama', at: .39 / 3.45 },
  cine: { from: .66 / 3.45, at: 2.74 / 3.45,
    windows: [[.66 / 3.45, 1.62 / 3.45, 1.32 / 3.45], [1.62 / 3.45, 2.3 / 3.45, 1.92 / 3.45], [2.3 / 3.45, 1, 2.74 / 3.45]] },
} as const;
export type KizaruHand = 'Open' | 'Point' | 'Beads';
export function kizaruHandVariants(action: string, elapsed: number, clip?: string): readonly [KizaruHand, KizaruHand] {
  if (action === 'ultimate' && clip === 'Yasakani no Magatama' && elapsed >= .86 && elapsed < 2.8) return ['Beads', 'Beads'];
  if (action === 'special' && clip === 'Finger Laser') return ['Open', 'Point'];
  if (action === 'awaken') return ['Open', 'Point'];
  return ['Open', 'Open'];
}
export function kizaruStrikeJoint(clip: string | undefined, clipTime = 0, index = 0): string {
  if (clip === 'Glint Kick' || clip === 'Rush 1' || clip === 'Rush 3' || clip === 'Flash Heel Drop' || clip === 'Radiant Kick' || clip === 'Sunfall') return 'RightFoot';
  if (clip === 'Lightspeed Heel' || clip === 'Rush 2' || clip === 'Photon Roundhouse' || clip === 'Aerial Light Wheel') return 'LeftFoot';
  if (clip === 'Rising Ray') return 'LeftLeg';
  if (clip === 'Yasakani no Magatama') return clipTime < .66 ? 'RightFoot' : index % 2 ? 'LeftHand' : 'RightHand';
  return 'RightHand';
}
export function kizaruAuthoredKick(clip: string | undefined, clipTime = 0): boolean {
  const joint = kizaruStrikeJoint(clip, clipTime);
  return joint === 'RightFoot' || joint === 'LeftFoot' || joint === 'LeftLeg';
}

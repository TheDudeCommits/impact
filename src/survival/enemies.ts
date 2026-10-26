import type { MoveDefinition, SlotMoves } from '../game/moves';
import type { AttackSlot, FighterId } from '../game/types';

export type EnemyRole = 'fodder' | 'gunner' | 'brute' | 'elite' | 'boss';
export type BrainKind = 'swarm' | 'gunner' | 'brute' | 'boss';

export interface EnemyMove extends MoveDefinition {
  slot: AttackSlot;
  clip: string[];
  clipSeconds?: number;
  chain?: string[];
  minRange?: number;
  maxRange?: number;
  weight?: number;
  phase?: number;
  rest?: number;
  telegraph?: 'ring' | 'cone' | 'line' | 'target';
  callout?: boolean;
  show?: RegExp;
  conceal?: RegExp;
  element?: 'steel' | 'fire' | 'magma' | 'light' | 'ice' | 'lightning' | 'dark' | 'ki' | 'sound' | 'blood' | 'cero' | 'jade';
  rain?: Rain;
}

export interface Rain { count: number; every: number; lead: number; spread: number; radius: number; damage: number; start?: number; knockback?: number }

export interface EnemyClips {
  idle: string[];
  run: string[];
  walk?: string[];
  hit: string[];
  down: string[];
  getup: string[];
  stun?: string[];
  blown?: string[];
  land?: string[];
  death?: string[];
  dash?: string[];
  jump?: string[];
  fall?: string[];
  taunt?: string[];
  guard?: string[];
  intro?: string[];
}

export interface EnemyDefinition {
  id: string;
  name: string;
  title?: string;
  series: string;
  role: EnemyRole;
  brain: BrainKind;
  model: string;
  height: number;
  size?: number;
  yaw?: number;
  hp: number;
  poise?: number;
  speed: number;
  damageIn?: number;
  knockbackIn?: number;
  stunIn?: number;
  breaker?: boolean;
  moves: EnemyMove[];
  clips: EnemyClips;
  xp: number;
  score: number;
  cost: number;
  color: number;
  tint?: number;
  runSpeed?: number;
  hide?: RegExp;
  blink?: { every: number; beyond: number };
  anchored?: boolean;
  girth?: number;
  transform?: { into: string };
  rival?: FighterId;
  motion?: 'humanoid';
}

const melee = (name: string, slot: AttackSlot, clip: string[], duration: number, contact: number, damage: number, extra: Partial<EnemyMove> = {}): EnemyMove => ({
  name, slot, clip, duration, contacts: [contact], damage, range: 1.8, radius: .55, stamina: 0,
  cooldown: .2, stun: .32, knockback: 3.2, style: 'melee', lunge: 2.6, minRange: 0, maxRange: 2.4, weight: 1, ...extra,
});
const shot = (name: string, slot: AttackSlot, clip: string[], duration: number, contact: number, damage: number, extra: Partial<EnemyMove> = {}): EnemyMove => ({
  name, slot, clip, duration, contacts: [contact], damage, range: 18, radius: .45, stamina: 0,
  cooldown: .2, stun: .35, knockback: 4, style: 'projectile', speed: 26, minRange: 4, maxRange: 16, weight: 1, ...extra,
});

const brClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['_idle_a', '_idle'], run: ['_run'], hit: ['_damage'], down: ['_down'], getup: ['_down_end'],
  stun: ['_stun'], blown: ['_blownback_lp'], land: ['_blownback_end', '_slammed'], dash: ['_boost', '_dodge'],
  jump: ['_jump'], fall: ['_jump_lp'], taunt: ['_boost'], ...extra,
});

const MARINE_CREDIT = 'One Piece Bounty Rush marine by emperor_prime (primalfrom12), CC Attribution';

export const ENEMIES: Record<string, EnemyDefinition> = {
  marine: {
    id: 'marine', name: 'Marine', series: 'One Piece', role: 'fodder', brain: 'swarm',
    model: '/assets/survival/enemies/marine.glb', height: 1.72, hp: 120, speed: .6,
    moves: [
      melee('Bayonet Thrust', 'light', ['_combo_b'], 1.23, .64, 22, { range: 2.1, cooldown: 1.2, knockback: 3.6 }),
      melee('Rifle Butt', 'heavy', ['_combo_c'], 1.8, .6, 34, { range: 1.9, cooldown: 3, knockback: 5.5, stun: .45, weight: .35 }),
    ],
    clips: brClips(), xp: 1, score: 40, cost: 1, color: 0x3d6fb8,
  },
  'marine-rifleman': {
    id: 'marine-rifleman', name: 'Marine Rifleman', series: 'One Piece', role: 'gunner', brain: 'gunner',
    model: '/assets/survival/enemies/marine.glb', height: 1.72, hp: 95, speed: .56,
    moves: [
      shot('Musket Volley', 'special', ['_combo_a'], 2.5, 1.5, 24, { cooldown: 4.2, element: 'steel' }),
      melee('Bayonet Thrust', 'light', ['_combo_b'], 1.23, .64, 20, { range: 2.1, cooldown: 1.4, maxRange: 2.2 }),
    ],
    clips: brClips(), xp: 2, score: 60, cost: 2, color: 0x6b8fcf, tint: 0xd8e4ff,
  },
  'marine-brute': {
    id: 'marine-brute', name: 'Marine Lieutenant', series: 'One Piece', role: 'brute', brain: 'brute',
    model: '/assets/survival/enemies/marine.glb', height: 2.25, size: 1.3, hp: 520, poise: 160, speed: .5,
    knockbackIn: .5, stunIn: .8, breaker: true,
    moves: [
      melee('Crushing Butt', 'heavy', ['_combo_c'], 1.95, .7, 60, { range: 2.5, radius: .8, cooldown: 2.4, knockback: 8, stun: .6, guardBreak: true, lunge: 3.2, maxRange: 2.9 }),
      melee('Lunging Bayonet', 'light', ['_combo_b'], 1.3, .68, 44, { range: 2.6, cooldown: 1.6, knockback: 5, lunge: 4.5, maxRange: 3.4 }),
    ],
    clips: brClips(), xp: 6, score: 240, cost: 4, color: 0x1f3f7a, tint: 0x8a93b8,
  },
};

const BR = (name: string) => `One Piece Bounty Rush ${name} by emperor_prime (primalfrom12), CC Attribution`;
const multi = (base: EnemyMove, contacts: number[], finisherDamage?: number): EnemyMove => ({ ...base, contacts, finisherDamage });

ENEMIES.jabra = {
  id: 'jabra', name: 'Jabra', title: 'CP9 · Wolf-Wolf Fruit', series: 'One Piece', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/jabra.glb', height: 2.05, size: 1.15, hp: 1300, poise: 200, speed: .82, knockbackIn: .45, stunIn: .7, breaker: true,
  moves: [
    melee('Iron Body Fist', 'light', ['_combo_a'], 1.13, .55, 46, { range: 2.1, lunge: 4, knockback: 4, maxRange: 2.8, rest: .4 }),
    melee('Wolf Claw', 'heavy', ['_combo_c'], 1.37, .8, 66, { range: 2.4, radius: .75, lunge: 5.5, knockback: 7, maxRange: 3.4, rest: 1.5 }),
    melee('Tekkai Lunge', 'special', ['_skill_b'], 1.5, .62, 84, { range: 2.5, radius: .8, lunge: 8, close: 8, knockback: 9, guardBreak: true, telegraph: 'cone', minRange: 2, maxRange: 8, rest: 4 }),
  ],
  clips: brClips({ intro: ['_opening'], death: ['_lose'] }), xp: 14, score: 1500, cost: 6, color: 0x5b3a2a,
};
ENEMIES.blueno = {
  id: 'blueno', name: 'Blueno', title: 'CP9 · Door-Door Fruit', series: 'One Piece', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/blueno.glb', height: 2.2, size: 1.15, hp: 1400, poise: 260, speed: .7, knockbackIn: .4, stunIn: .7, breaker: true,
  moves: [
    melee('Tekkai Jab', 'light', ['_combo_a'], .97, .42, 40, { range: 2.1, lunge: 3.5, maxRange: 2.7, rest: .3 }),
    melee('Air Door Kick', 'heavy', ['_combo_c'], 1.17, .47, 58, { range: 2.3, lunge: 8, close: 8, knockback: 6, maxRange: 7, minRange: 1.5, rest: 2.5, telegraph: 'line' }),
    melee('Rankyaku Slam', 'special', ['_combo_b'], 1.23, .56, 72, { range: 2.4, radius: .9, knockback: 8, guardBreak: true, maxRange: 3, rest: 3.5, telegraph: 'cone' }),
  ],
  clips: brClips({ intro: ['_opening'], death: ['_lose'] }), xp: 14, score: 1500, cost: 6, color: 0x1c1f2a,
};
ENEMIES.kaku = {
  id: 'kaku', name: 'Kaku', title: 'CP0 · The Long Nose', series: 'One Piece', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/kaku.glb', height: 1.95, size: 1.05, hp: 1200, poise: 180, speed: .84, knockbackIn: .45, stunIn: .7, breaker: true,
  moves: [
    melee('Rankyaku Snap', 'light', ['_combo_b'], .93, .5, 42, { range: 2.3, lunge: 4.5, maxRange: 2.9, rest: .3 }),
    melee('Flip Kick', 'heavy', ['_combo_c'], 1.33, .55, 60, { range: 2.2, knockback: 7, lunge: 4, maxRange: 2.8, rest: 1.8 }),
    multi(melee('Amane Dachi', 'special', ['_skill_a_lp'], 2.2, .5, 34, { range: .2, radius: 2.3, knockback: 5, lunge: 0, maxRange: 2.6, rest: 5, telegraph: 'ring', clipSeconds: 2.2 }), [.5, .9, 1.3, 1.7], 60),
  ],
  clips: brClips({ intro: ['_boost'], death: ['_lose'] }), xp: 14, score: 1500, cost: 6, color: 0xe8e6e0,
};
ENEMIES.lucci = {
  id: 'lucci', name: 'Rob Lucci', title: 'CP9 · Cat-Cat Fruit, Leopard Model', series: 'One Piece', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/lucci-leopard.glb', height: 2.3, size: 1.3, hp: 6000, poise: 480, speed: .92, knockbackIn: .25, stunIn: .6, breaker: true,
  blink: { every: 8, beyond: 9 },
  moves: [
    melee('Leopard Claw', 'light', ['_combo_a'], 1.13, .5, 64, { range: 2.4, radius: .7, lunge: 5, knockback: 4, maxRange: 3.2, rest: .2 }),
    melee('Soru', 'heavy', ['_combo_b'], 1.13, .45, 82, { range: 2.6, radius: .75, lunge: 9, close: 10, knockback: 7, maxRange: 10, minRange: 2.5, rest: 2.2, telegraph: 'line' }),
    multi(shot('Rankyaku: Tempest Kick', 'special', ['_skill_b'], 1.83, .55, 58, { speed: 30, range: 22, radius: .75, knockback: 5, minRange: 4.5, maxRange: 20, rest: 4.5, element: 'steel', callout: true }), [.55, .8, 1.05], 58),
    melee('Rokuogan', 'ultimate', ['_skill_a'], 1.63, .9, 190, { range: 2.8, radius: 1.5, knockback: 13, lunge: 3, guardBreak: true, telegraph: 'cone', maxRange: 3.6, rest: 7, callout: true, element: 'sound' }),
    multi(melee('Shigan Barrage', 'heavy', ['_combo_c'], 1.1, .3, 30, { range: 2.3, lunge: 5, knockback: 2, maxRange: 3, rest: 3, phase: 1 }), [.3, .46, .62], 70),
  ],
  clips: brClips({ intro: ['_victory'], death: ['_down'], taunt: ['_victory'] }), xp: 60, score: 12000, cost: 0, color: 0xd9a33a,
};

const MAGMA_ARMS = /arms_magma|hand_fist_magma|body_magma/;
const PLAIN_ARMS = /\b[lr]_arms_pl_|\b[lr]_hand_(fist|open)_pl_/;
ENEMIES.kizaru = {
  id: 'kizaru', name: 'Kizaru', title: 'Admiral · Glint-Glint Fruit', series: 'One Piece', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/kizaru.glb', height: 2.45, size: 1.2, hp: 1900, poise: 260, speed: .88, knockbackIn: .4, stunIn: .7, breaker: true,
  blink: { every: 5.5, beyond: 6.5 },
  moves: [
    melee('Light Kick', 'light', ['_combo_a'], 1.37, .48, 50, { range: 2.3, lunge: 5, knockback: 4, maxRange: 3, rest: .3, element: 'light', show: /light_(leg|shoes)/ }),
    melee('Speed of Light Kick', 'heavy', ['_combo_b'], 1.17, .55, 74, { range: 2.5, radius: .8, lunge: 10, close: 11, knockback: 9, minRange: 2.5, maxRange: 11, rest: 2.5, telegraph: 'line', element: 'light', show: /light_(leg|shoes)/ }),
    multi(shot('Light Bullets', 'special', ['_skill_b'], 2.4, .8, 24, { clipSeconds: 4.97, speed: 48, range: 24, radius: .45, knockback: 2, stun: .25, minRange: 3.5, maxRange: 20, rest: 4.5, element: 'light', show: /hand_yasakani/ }), [.8, 1, 1.2, 1.4, 1.6, 1.8], 44),
    melee('Yasakani no Magatama', 'ultimate', ['_skill_a'], 2, .73, 40, { range: 1.2, radius: 1.9, lunge: 0, knockback: 6, maxRange: 16, rest: 9, telegraph: 'ring', element: 'light', callout: true,
      rain: { count: 12, every: .13, lead: .8, spread: 5, radius: 1.5, damage: 34, start: .35 } }),
  ],
  clips: brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] }), xp: 18, score: 2400, cost: 6, color: 0xffd21e,
};
ENEMIES.aokiji = {
  id: 'aokiji', name: 'Aokiji', title: 'Admiral · Chilly-Chilly Fruit', series: 'One Piece', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/aokiji.glb', height: 2.45, size: 1.2, hp: 2100, poise: 300, speed: .78, knockbackIn: .4, stunIn: .7, breaker: true,
  moves: [
    melee('Ice Saber', 'light', ['_combo_a'], 1.3, .53, 50, { range: 2.6, radius: .7, lunge: 4, knockback: 4, maxRange: 3.2, rest: .3, element: 'ice' }),
    melee('Ice Saber: Crescent', 'heavy', ['_combo_c'], 1.7, .77, 70, { range: 2.8, radius: .9, lunge: 5, knockback: 8, maxRange: 3.4, rest: 1.8, element: 'ice' }),
    melee('Ice Age', 'special', ['_skill_a'], 2.37, 1.38, 92, { range: 6.5, radius: 2.2, lunge: 0, knockback: 5, stun: 1.2, maxRange: 7.5, rest: 6, telegraph: 'cone', element: 'ice', callout: true }),
    shot('Pheasant Beak', 'ultimate', ['_skill_b'], 2.6, 1.25, 130, { clipSeconds: 4.3, speed: 20, range: 26, radius: 1.5, knockback: 12, stun: .8, guardBreak: true, minRange: 4, maxRange: 22, rest: 8, telegraph: 'line', element: 'ice', callout: true }),
  ],
  hide: /\b[lr]_arm_pl_/,
  clips: brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] }), xp: 18, score: 2400, cost: 6, color: 0x7fd8ff,
};
ENEMIES.sentomaru = {
  id: 'sentomaru', name: 'Sentomaru', title: 'Commander of the Science Unit', series: 'One Piece', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/sentomaru.glb', height: 2.55, size: 1.35, hp: 2400, poise: 380, speed: .66, knockbackIn: .3, stunIn: .6, breaker: true,
  moves: [
    melee('Axe Cleave', 'light', ['_combo_a'], 1.3, .53, 56, { range: 2.7, radius: .9, lunge: 3.5, knockback: 5, maxRange: 3.3, rest: .4 }),
    melee('Ashigara Dokkoi', 'heavy', ['_combo_c'], 1.37, .6, 88, { range: 2.5, radius: 1, lunge: 4.5, knockback: 13, stun: .7, guardBreak: true, maxRange: 3.2, rest: 3, telegraph: 'cone', callout: true }),
    melee('Giant Axe Slam', 'special', ['_skill_a'], 2.4, 1.05, 104, { range: 1.6, radius: 2.8, lunge: 6, close: 7, knockback: 9, maxRange: 8, rest: 5, telegraph: 'ring' }),
  ],
  hide: /\bweapon_pl|[lr]_weapon|hand_weapon|dendenmushi|wood_pl|icosphere/i,
  clips: brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] }), xp: 18, score: 2400, cost: 6, color: 0xc8303a,
};
ENEMIES.akainu = {
  id: 'akainu', name: 'Akainu', title: 'Admiral · Magma-Magma Fruit', series: 'One Piece', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/akainu.glb', height: 2.5, size: 1.35, hp: 7200, poise: 560, speed: .8, knockbackIn: .22, stunIn: .55, breaker: true,
  moves: [
    melee('Magma Fist', 'light', ['_combo_a'], 1.37, .45, 66, { range: 2.5, radius: .8, lunge: 5, knockback: 5, maxRange: 3.2, rest: .2, element: 'magma' }),
    melee('Magma Uppercut', 'light', ['_combo_b'], 1.33, .47, 72, { range: 2.4, radius: .8, lunge: 4.5, knockback: 6, maxRange: 3, rest: 1.2, element: 'magma' }),
    melee('Hell Hound', 'heavy', ['_combo_c'], 2.13, 1.12, 104, { range: 2.8, radius: 1, lunge: 7, close: 8, knockback: 11, guardBreak: true, minRange: 1.5, maxRange: 8, rest: 3, telegraph: 'line', element: 'magma', show: MAGMA_ARMS, conceal: PLAIN_ARMS }),
    shot('Great Eruption', 'special', ['_skill_a'], 2.6, 1.07, 150, { speed: 24, range: 26, radius: 1.7, knockback: 12, stun: .9, minRange: 3.5, maxRange: 22, rest: 5, telegraph: 'line', element: 'magma', callout: true, show: MAGMA_ARMS, conceal: PLAIN_ARMS }),
    melee('Meteor Volcano', 'ultimate', ['_skill_b'], 2.07, .55, 60, { range: .5, radius: 2.8, lunge: 0, knockback: 9, maxRange: 18, rest: 9, telegraph: 'ring', element: 'magma', callout: true, phase: 1, show: MAGMA_ARMS, conceal: PLAIN_ARMS,
      rain: { count: 14, every: .16, lead: 1, spread: 6, radius: 1.9, damage: 72, start: .5, knockback: 8 } }),
  ],
  clips: brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] }), xp: 70, score: 16000, cost: 0, color: 0xff3a0a,
};

const bleachClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['idle'], run: ['run'], hit: ['strike_1'], down: ['back', 'die'], getup: ['idle'], stun: ['strike_1'],
  blown: ['back'], land: ['back'], death: ['die'], dash: ['run'], jump: ['run'], fall: ['back'], taunt: ['stay_show'], intro: ['stay_show'], ...extra,
});
const WITS = (name: string) => `${name} by witsanusuperball, CC Attribution`;
const hollowClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['idle'], run: ['run'], walk: ['walk'], hit: ['hit'], down: ['knockdown'], getup: ['getup'], stun: ['hit'],
  blown: ['knockdown'], land: ['knockdown'], death: ['die'], dash: ['run'], jump: ['run'], fall: ['knockdown'], taunt: ['roar'], ...extra,
});
const HOLLOW_CREDIT = 'Hollow: generated for Rift Arena with Meshy';
ENEMIES.hollow = {
  id: 'hollow', name: 'Hollow', series: 'Bleach', role: 'fodder', brain: 'swarm',
  model: '/assets/survival/enemies/hollow.glb', height: 1.95, hp: 150, speed: .7,
  moves: [
    melee('Claw Swipe', 'light', ['claw'], 1.2, .59, 26, { clipSeconds: 2.23, range: 2.1, cooldown: 1.2, knockback: 3.8, element: 'blood' }),
    multi(melee('Frenzy', 'heavy', ['combo'], 1.6, .69, 22, { clipSeconds: 2.33, range: 2.2, cooldown: 3, knockback: 5.5, stun: .45, weight: .35, element: 'blood' }), [.69, .93], 30),
  ],
  clips: hollowClips(), xp: 1, score: 45, cost: 1, color: 0x1a1a22,
};
ENEMIES['hollow-cero'] = {
  id: 'hollow-cero', name: 'Cero Hollow', series: 'Bleach', role: 'gunner', brain: 'gunner',
  model: '/assets/survival/enemies/hollow.glb', height: 1.95, hp: 115, speed: .62,
  moves: [
    shot('Cero', 'special', ['roar'], 2.2, 1.54, 26, { clipSeconds: 2.43, speed: 30, radius: .6, cooldown: 4.2, element: 'cero' }),
    melee('Claw Swipe', 'light', ['claw'], 1.2, .59, 22, { clipSeconds: 2.23, range: 2.1, cooldown: 1.4, maxRange: 2.2, element: 'blood' }),
  ],
  clips: hollowClips(), xp: 2, score: 70, cost: 2, color: 0xff1e3c, tint: 0xffd0d8,
};
ENEMIES['hollow-menos'] = {
  id: 'hollow-menos', name: 'Menos Grande', series: 'Bleach', role: 'brute', brain: 'brute',
  model: '/assets/survival/enemies/hollow.glb', height: 3.1, size: 1.55, hp: 640, poise: 200, speed: .45,
  knockbackIn: .4, stunIn: .7, breaker: true,
  moves: [
    melee('Crushing Claw', 'heavy', ['combo'], 1.9, 1.1, 60, { clipSeconds: 2.33, range: 3, radius: 1, cooldown: 2.4, knockback: 9, stun: .6, guardBreak: true, lunge: 3, maxRange: 3.4, telegraph: 'cone', element: 'blood' }),
    shot('Gran Cero', 'special', ['roar'], 2.6, 1.82, 56, { clipSeconds: 2.43, speed: 24, radius: 1.1, cooldown: 5, minRange: 4, maxRange: 18, telegraph: 'line', element: 'cero' }),
  ],
  clips: hollowClips(), xp: 7, score: 280, cost: 4, color: 0x2a2a3a, tint: 0xb8b8c8,
};
ENEMIES.grimmjow = {
  id: 'grimmjow', name: 'Grimmjow', title: 'Sexta Espada · Pantera', series: 'Bleach', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/grimmjow.glb', height: 2.05, size: 1.1, hp: 2300, poise: 300, speed: .98, knockbackIn: .4, stunIn: .7, breaker: true,
  blink: { every: 6, beyond: 7 },
  moves: [
    multi(melee('Pantera Claws', 'light', ['CommonAttack'], 2, .55, 30, { range: 2.4, radius: .7, lunge: 5, knockback: 3, maxRange: 3, rest: .3, element: 'ki' }), [.55, 1.07], 44),
    melee('Pantera Pounce', 'heavy', ['attack_3'], 2.03, 1.03, 78, { range: 2.6, radius: .8, lunge: 8, close: 10, knockback: 9, minRange: 2, maxRange: 10, rest: 2.2, telegraph: 'line', element: 'ki' }),
    multi(shot('Garra de la Pantera', 'special', ['skill_3_3'], 2.8, 1.2, 28, { chain: ['skill_3_1', 'skill_3_2', 'skill_3_3'], speed: 42, radius: .5, knockback: 2, stun: .25, minRange: 3.5, maxRange: 20, rest: 5, element: 'ki', callout: true }), [1.2, 1.36, 1.52, 1.68, 1.84], 44),
    multi(melee('Desgarrón', 'ultimate', ['skill_4_3'], 2.8, 1, 30, { chain: ['skill_4_1', 'skill_4_2', 'skill_4_3'], range: 4, radius: 2, lunge: 4, knockback: 4, guardBreak: true, maxRange: 5, rest: 9, telegraph: 'cone', element: 'ki', callout: true }), [1, 1.2, 1.4, 1.6, 1.8], 80),
  ],
  clips: bleachClips(), xp: 20, score: 2800, cost: 6, color: 0x3a9cff,
};
ENEMIES.ulquiorra = {
  id: 'ulquiorra', name: 'Ulquiorra', title: 'Cuarta Espada · Murciélago', series: 'Bleach', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/ulquiorra.glb', height: 2.1, size: 1.1, hp: 2400, poise: 320, speed: .85, knockbackIn: .4, stunIn: .7, breaker: true,
  blink: { every: 5, beyond: 7 },
  moves: [
    melee('Tail Lash', 'light', ['CommonAttack'], 1.83, .7, 52, { range: 2.9, radius: .8, lunge: 4, knockback: 5, maxRange: 3.4, rest: .3, element: 'jade' }),
    { ...shot('Cero Oscuras', 'heavy', ['attack_3'], 1.7, .93, 96, { range: 20, radius: .9, knockback: 10, minRange: 3, maxRange: 18, rest: 3.5, telegraph: 'line', element: 'jade' }), style: 'beam' },
    multi(shot('Luz de la Luna', 'special', ['skill_1'], 3.2, 1.2, 40, { clipSeconds: 5.07, speed: 34, radius: .7, knockback: 5, minRange: 3, maxRange: 20, rest: 5, element: 'jade' }), [1.2, 1.7, 2.2], 60),
    { ...shot('Lanza del Relámpago', 'ultimate', ['skill_3_3'], 3.2, 2.2, 170, { chain: ['skill_3_1', 'skill_3_2', 'skill_3_3'], speed: 30, range: 26, radius: 3, knockback: 13, guardBreak: true, minRange: 4, maxRange: 22, rest: 9, telegraph: 'target', element: 'jade', callout: true }), style: 'bomb' },
  ],
  clips: bleachClips(), xp: 20, score: 2800, cost: 6, color: 0x2ee88a,
};
ENEMIES.kenpachi = {
  id: 'kenpachi', name: 'Kenpachi Zaraki', title: 'Captain of the Eleventh', series: 'Bleach', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/kenpachi.glb', height: 2.25, size: 1.2, hp: 2800, poise: 420, speed: .82, knockbackIn: .3, stunIn: .6, breaker: true,
  moves: [
    melee('Wild Slash', 'light', ['CommonAttack'], 1.15, .5, 58, { clipSeconds: 1, range: 2.9, radius: .9, lunge: 5, knockback: 5, maxRange: 3.4, rest: .2, element: 'light' }),
    multi(melee('Nozarashi Flurry', 'heavy', ['skill_1_6'], 2.2, .35, 30, { chain: ['skill_1_1', 'skill_1_2', 'skill_1_3', 'skill_1_4', 'skill_1_5', 'skill_1_6', 'skill_1_7'], range: 2.8, radius: 1, lunge: 6, close: 7, knockback: 3, maxRange: 6, rest: 3, element: 'light' }), [.35, .7, 1.05, 1.4, 1.75], 70),
    melee('Kendō', 'special', ['skill_3'], 2.3, 1.25, 150, { clipSeconds: 2.03, range: 7, radius: 2.1, lunge: 2, knockback: 13, stun: .8, guardBreak: true, maxRange: 7.5, rest: 7, telegraph: 'cone', element: 'light', callout: true }),
  ],
  clips: bleachClips(), xp: 20, score: 2800, cost: 6, color: 0xffd21e,
};
ENEMIES['hollow-ichigo'] = {
  id: 'hollow-ichigo', name: 'White Ichigo', title: 'The Hollow Within', series: 'Bleach', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/hollow-ichigo.glb', height: 2.0, size: 1.05, hp: 2200, poise: 280, speed: .95, knockbackIn: .45, stunIn: .7, breaker: true,
  blink: { every: 6, beyond: 8 },
  moves: [
    multi(melee('Zangetsu Rush', 'light', ['CommonAttack'], 1.87, .6, 32, { range: 2.7, radius: .8, lunge: 5, knockback: 3, maxRange: 3.2, rest: .3, element: 'blood' }), [.6, 1.1], 46),
    melee('Shunpo Cleave', 'heavy', ['attack_3'], 1.7, .9, 80, { range: 2.8, radius: .9, lunge: 8, close: 9, knockback: 9, minRange: 2, maxRange: 9, rest: 2.4, telegraph: 'line', element: 'blood' }),
    shot('Getsuga Tenshō', 'special', ['skill_3_3'], 2.2, 1.1, 115, { clipSeconds: 2.83, speed: 32, range: 26, radius: 1.3, knockback: 10, minRange: 3.5, maxRange: 22, rest: 5, telegraph: 'line', element: 'blood', callout: true }),
    { ...shot('Hollow Cero', 'ultimate', ['skill_1_3'], 2.8, 1.45, 150, { clipSeconds: 4.47, range: 22, radius: 1.1, knockback: 12, guardBreak: true, minRange: 3, maxRange: 20, rest: 9, telegraph: 'line', element: 'cero', callout: true }), style: 'beam' },
  ],
  clips: bleachClips(), xp: 20, score: 2800, cost: 6, color: 0xe0142e,
};
ENEMIES.aizen = {
  id: 'aizen', name: 'Sōsuke Aizen', title: 'Transcendent · Fused with the Hōgyoku', series: 'Bleach', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/aizen.glb', height: 2.2, size: 1.25, hp: 7800, poise: 620, speed: .74, knockbackIn: .22, stunIn: .55, breaker: true,
  blink: { every: 4.5, beyond: 6 },
  moves: [
    melee('Kyōka Suigetsu', 'light', ['CommonAttack'], 1.67, .8, 72, { range: 2.7, radius: .8, lunge: 5, knockback: 6, maxRange: 3.3, rest: .2, element: 'dark' }),
    melee('Flash Step Cut', 'heavy', ['attack_1'], 1.67, .78, 96, { range: 2.8, radius: .9, lunge: 9, close: 10, knockback: 10, minRange: 2, maxRange: 10, rest: 2.6, telegraph: 'line', element: 'dark' }),
    multi(shot('Wing Blades', 'special', ['skill_1_3'], 3.4, 1.3, 34, { chain: ['skill_1_1', 'skill_1_2', 'skill_1_3'], speed: 36, radius: .6, knockback: 3, stun: .3, minRange: 3, maxRange: 22, rest: 5, element: 'dark', callout: true }), [1.3, 1.5, 1.7, 1.9, 2.1, 2.3], 60),
    { ...melee('Hadō #90: Kurohitsugi', 'ultimate', ['skill_3_3'], 3.4, 2.4, 190, { chain: ['skill_3_1', 'skill_3_2', 'skill_3_3'], range: 24, radius: 2.4, knockback: 12, stun: 1, guardBreak: true, minRange: 2, maxRange: 20, rest: 10, telegraph: 'target', element: 'dark', callout: true }), style: 'field' },
    melee('Senjū Kōten Taihō', 'special', ['skill_1_2'], 2.4, .5, 40, { chain: ['skill_1_1', 'skill_1_2', 'stay_show'], range: .5, radius: 2.6, knockback: 8, maxRange: 18, rest: 10, telegraph: 'ring', element: 'light', callout: true, phase: 1,
      rain: { count: 16, every: .12, lead: .9, spread: 6, radius: 1.4, damage: 64, start: .4, knockback: 7 } }),
  ],
  clips: bleachClips({ intro: ['stay_show'], taunt: ['stay_show'] }), xp: 80, score: 20000, cost: 0, color: 0x7a3cff,
};

const dioClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['_Idle'], run: ['Run'], walk: ['Walk'], hit: ['Hit 01'], down: ['Die fall'], getup: ['down_end'], stun: ['stun'],
  blown: ['slammed'], land: ['down_end'], death: ['Die fall'], dash: ['Dash'], jump: ['jump'], fall: ['Jump Fall'], guard: ['Block'], taunt: ['shake'], intro: ['Za Warudo'], ...extra,
});
ENEMIES.dio = {
  id: 'dio', name: 'DIO', title: 'The World · Master of Stopped Time', series: 'JoJo', role: 'boss', brain: 'boss',
  model: '/assets/fighters/dio-eoh1.glb', height: 2.25, size: 1.15, hp: 7000, poise: 560, speed: .9, knockbackIn: .3, stunIn: .6, breaker: true,
  blink: { every: 5, beyond: 7 },
  moves: [
    melee('Muda Punch', 'light', ['Muda Punch'], .83, .38, 64, { range: 2.7, radius: .8, lunge: 5, knockback: 6, maxRange: 3.3, rest: .25, element: 'light' }),
    multi(melee('Muda Muda Barrage', 'heavy', ['Muda Barrage'], 3.08, .5, 24, { range: 2.9, radius: 1, lunge: 7, close: 8, knockback: 3, stun: .25, maxRange: 6, rest: 3.2, telegraph: 'cone', element: 'light', callout: true }), [.5, .78, 1.06, 1.34, 1.62, 1.9, 2.18], 92),
    multi(shot('Knife Throw', 'special', ['Knife Throw'], 1.33, .55, 34, { speed: 38, radius: .5, knockback: 3, stun: .3, minRange: 3, maxRange: 20, rest: 4, element: 'steel', callout: true }), [.55, .7, .85], 48),
    { ...melee('ZA WARUDO', 'ultimate', ['Za Warudo'], 4.79, 2.7, 190, { range: 5, radius: 4.4, knockback: 13, stun: 1, guardBreak: true, maxRange: 9, rest: 9, telegraph: 'ring', element: 'light', callout: true }), style: 'field' },
  ],
  clips: dioClips(), xp: 80, score: 20000, cost: 0, color: 0xf2c94c,
};

const libraryClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['idle'], run: ['run'], walk: ['walk'], hit: ['hit'], down: ['knockdown'], getup: ['getup'], stun: ['hit'],
  blown: ['knockdown'], land: ['knockdown'], death: ['die'], dash: ['run-sprint'], jump: ['run'], fall: ['knockdown'], taunt: ['roar'], intro: ['roar2'], ...extra,
});
ENEMIES.sukuna = {
  id: 'sukuna', name: 'Ryōmen Sukuna', title: 'The King of Curses', series: 'Jujutsu Kaisen', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/sukuna.glb', motion: 'humanoid', height: 2.2, size: 1.15, hp: 7600, poise: 600, speed: .92, knockbackIn: .28, stunIn: .55, breaker: true,
  blink: { every: 5, beyond: 7 },
  moves: [
    melee('Dismantle Cut', 'light', ['hand-slash', 'jab'], 1, .4, 62, { clipSeconds: 1.58, range: 2.8, radius: .9, lunge: 5, knockback: 5, maxRange: 3.3, rest: .25, element: 'blood' }),
    multi(melee('Cleave', 'heavy', ['combo'], 1.7, .73, 58, { clipSeconds: 2.3, range: 3.2, radius: 1.2, lunge: 6, close: 7, knockback: 8, maxRange: 5, rest: 2.6, telegraph: 'cone', element: 'blood', callout: true }), [.73, .99], 70),
    multi(shot('Dismantle', 'special', ['sweep', 'claw'], 1.6, .78, 40, { clipSeconds: 1.54, speed: 44, radius: .8, knockback: 4, stun: .3, minRange: 3, maxRange: 20, rest: 4.5, element: 'blood', callout: true }), [.78, .95, 1.12], 56),
    { ...shot('Open: Fuga', 'ultimate', ['bow-shot', 'roar'], 2.6, 1.82, 200, { clipSeconds: 3, speed: 22, range: 26, radius: 1.6, knockback: 13, stun: .9, guardBreak: true, minRange: 4, maxRange: 22, rest: 9, telegraph: 'line', element: 'fire', callout: true }), style: 'bomb' },
  ],
  clips: libraryClips(), xp: 80, score: 20000, cost: 0, color: 0xd81f3a,
};
ENEMIES.griffith = {
  id: 'griffith', name: 'Griffith', title: 'The White Hawk', series: 'Berserk', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/griffith.glb', motion: 'humanoid', height: 2.15, size: 1.1, hp: 6800, poise: 540, speed: 1, knockbackIn: .32, stunIn: .6, breaker: true,
  blink: { every: 4.5, beyond: 6 },
  moves: [
    melee('Sabre Thrust', 'light', ['thrust', 'jab'], .95, .38, 60, { clipSeconds: 1.35, range: 3, radius: .7, lunge: 6, knockback: 5, maxRange: 3.5, rest: .2, element: 'steel' }),
    multi(melee("Hawk's Flurry", 'heavy', ['combo'], 1.6, .69, 36, { clipSeconds: 2.3, range: 3, radius: 1, lunge: 7, close: 8, knockback: 4, stun: .3, maxRange: 5, rest: 2.4, telegraph: 'cone', element: 'steel', callout: true }), [.69, .93, 1.17], 72),
    melee('Falcon Dive', 'special', ['charged-slash', 'kick'], 1.4, .58, 110, { clipSeconds: 3, range: 3, radius: 1.2, lunge: 12, close: 12, knockback: 11, stun: .6, minRange: 3, maxRange: 12, rest: 5, telegraph: 'line', element: 'light', callout: true }),
    { ...melee('The Eclipse', 'ultimate', ['spell', 'roar2'], 3, 1.95, 190, { clipSeconds: 1.31, range: 5, radius: 4.8, knockback: 12, stun: 1, guardBreak: true, maxRange: 8, rest: 10, telegraph: 'ring', element: 'dark', callout: true }), style: 'field' },
  ],
  clips: libraryClips({ idle: ['parry', 'idle'] }), xp: 80, score: 20000, cost: 0, color: 0xdfe8ff,
};
ENEMIES.meruem = {
  id: 'meruem', name: 'Meruem', title: 'King of the Chimera Ants', series: 'Hunter × Hunter', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/meruem-v2.glb', motion: 'humanoid', height: 2.45, size: 1.25, hp: 8000, poise: 640, speed: .95, knockbackIn: .25, stunIn: .5, breaker: true,
  blink: { every: 4, beyond: 6 },
  moves: [
    melee('Tail Whip', 'light', ['roundhouse', 'claw'], 1.15, .57, 66, { clipSeconds: 2.12, range: 3.4, radius: 1.1, lunge: 4, knockback: 6, maxRange: 3.8, rest: .3, element: 'jade' }),
    melee('Royal Strike', 'heavy', ['uppercut'], 1.2, .7, 120, { clipSeconds: 1.03, range: 2.9, radius: 1, lunge: 7, close: 8, knockback: 12, stun: .6, guardBreak: true, maxRange: 5, rest: 2.8, telegraph: 'line', element: 'jade', callout: true }),
    multi(melee('Tail Lance', 'special', ['blade-spin', 'combo'], 1.7, .73, 44, { clipSeconds: 1.86, range: 4.6, radius: 1, lunge: 3, knockback: 5, stun: .35, maxRange: 5.5, rest: 4, telegraph: 'cone', element: 'jade', callout: true }), [.73, .99, 1.25], 80),
    { ...melee("King's Decree", 'ultimate', ['judgment', 'roar'], 2.6, 1.82, 200, { clipSeconds: 1.57, range: 5, radius: 5.2, knockback: 14, stun: 1.1, guardBreak: true, maxRange: 9, rest: 10, telegraph: 'ring', element: 'jade', callout: true }), style: 'field' },
  ],
  clips: libraryClips({ idle: ['stance', 'idle'] }), xp: 80, score: 20000, cost: 0, color: 0x3ae88a,
};

const szClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['STD_G_LP'], run: ['STD_F_LP'], hit: ['bw2_1in0'], down: ['bw2_3HT0'], getup: ['bw1_0DEM', 'STD_G_LP'], stun: ['bw2_1in0'],
  blown: ['bw2_3HT0'], land: ['bw2_3HT0'], death: ['bw2_3HT0'], dash: ['STD_F_LP'], jump: ['STD_F_LP'], fall: ['STD_F_LP'], taunt: ['MKWME_LP'], intro: ['MKWME_LP'], ...extra,
});
const rush = (n: number) => [`R1_${n}_IN`, `R1_${n}_HT`];
const RUSH = [...rush(1), ...rush(2), ...rush(3), ...rush(4), ...rush(5), 'R1_5_OT'];
const smash = (code: string) => [`${code}_1IN`, `${code}_2CG`, `${code}_3HT`, `${code}_4OT`];
const BLAST = ['ry1_1IN1', 'ry1_2CG1', 'ry1_3HT1', 'ry1_6OT2'];
const SZ = (name: string) => `${name} (Dragon Ball Sparking! Zero) by King_45, CC Attribution`;
ENEMIES['cell-jr'] = {
  id: 'cell-jr', name: 'Cell Jr.', series: 'Dragon Ball', role: 'fodder', brain: 'swarm',
  model: '/assets/survival/enemies/cell-jr.glb', height: 1.45, size: .9, hp: 140, speed: .82,
  moves: [
    multi(melee('Brood Rush', 'light', ['R1_1_HT'], .95, .12, 14, { chain: [...rush(1), ...rush(2), 'R1_2_OT'], range: 1.9, cooldown: 1.1, knockback: 2.5, element: 'ki' }), [.12, .4], 22),
    melee('Hammer Smash', 'heavy', ['SMF_3HT'], 1.25, .64, 36, { chain: smash('SMF'), range: 2, cooldown: 3, knockback: 6, stun: .45, weight: .4, element: 'ki' }),
  ],
  clips: szClips(), xp: 1, score: 50, cost: 1, color: 0x7fb84a,
};
ENEMIES['cell-jr-blaster'] = {
  id: 'cell-jr-blaster', name: 'Cell Jr. Blaster', series: 'Dragon Ball', role: 'gunner', brain: 'gunner',
  model: '/assets/survival/enemies/cell-jr.glb', height: 1.45, size: .9, hp: 110, speed: .7,
  moves: [
    shot('Ki Blast', 'special', ['ry1_3HT1'], 2.2, 1.3, 20, { chain: BLAST, speed: 36, radius: .55, cooldown: 4.2, element: 'ki' }),
    multi(melee('Brood Rush', 'light', ['R1_1_HT'], .95, .12, 12, { chain: [...rush(1), ...rush(2), 'R1_2_OT'], range: 1.9, cooldown: 1.4, maxRange: 2.1, element: 'ki' }), [.12, .4], 18),
  ],
  clips: szClips(), xp: 2, score: 75, cost: 2, color: 0x3a9cff, tint: 0xd8ecff,
};
ENEMIES['cell-jr-elder'] = {
  id: 'cell-jr-elder', name: 'Elder Cell Jr.', series: 'Dragon Ball', role: 'brute', brain: 'brute',
  model: '/assets/survival/enemies/cell-jr.glb', height: 2.5, size: 1.4, hp: 620, poise: 190, speed: .55,
  knockbackIn: .45, stunIn: .75, breaker: true,
  moves: [
    melee('Crushing Smash', 'heavy', ['SMF_3HT'], 1.5, .78, 52, { chain: smash('SMF'), range: 2.7, radius: 1, cooldown: 2.4, knockback: 9, stun: .6, guardBreak: true, lunge: 3.5, maxRange: 3.2, telegraph: 'cone', element: 'ki' }),
    shot('Kamehameha', 'special', ['ry1_3HT1'], 2.8, 1.7, 58, { chain: BLAST, speed: 30, radius: 1, cooldown: 5, minRange: 4, maxRange: 18, telegraph: 'line', element: 'ki' }),
  ],
  clips: szClips(), xp: 7, score: 300, cost: 4, color: 0x2e6a2a, tint: 0xa8c098,
};
ENEMIES['goku-black'] = {
  id: 'goku-black', name: 'Goku Black', title: 'Rosé · The Zero Mortals Plan', series: 'Dragon Ball', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/goku-black.glb', height: 2.0, size: 1.1, hp: 2600, poise: 320, speed: .92, knockbackIn: .4, stunIn: .7, breaker: true,
  blink: { every: 5, beyond: 6.5 },
  moves: [
    multi(melee('Black Rush', 'light', ['R1_1_HT'], 2, .12, 26, { chain: RUSH, range: 2.4, radius: .8, lunge: 4, knockback: 2, maxRange: 3, rest: .3, element: 'dark' }), [.12, .46, .8, 1.14, 1.5], 50),
    melee('Violent Rush', 'heavy', ['ex3FI'], 1.2, .7, 92, { chain: ['ex1IN', 'ex2CG', 'ex3FI', 'ex4OT'], range: 2.6, radius: .9, lunge: 9, close: 10, knockback: 10, minRange: 2, maxRange: 10, rest: 2.6, telegraph: 'line', element: 'dark' }),
    melee('Divine Blade', 'special', ['SKL2_HT'], 2.15, 1.12, 120, { chain: ['SKL2_IN', 'SKL2_HT', 'SKL2_OT'], range: 3.6, radius: 1.5, lunge: 5, knockback: 11, guardBreak: true, maxRange: 4.4, rest: 6, telegraph: 'cone', element: 'dark', callout: true }),
    { ...shot('Black Kamehameha', 'ultimate', ['ry1_3HT1'], 3.4, 1.7, 170, { chain: BLAST, range: 22, radius: 1.2, knockback: 13, guardBreak: true, minRange: 3, maxRange: 20, rest: 9, telegraph: 'line', element: 'dark', callout: true }), style: 'beam' },
  ],
  clips: szClips(), xp: 22, score: 3200, cost: 6, color: 0xe86ad8,
};
ENEMIES['golden-frieza'] = {
  id: 'golden-frieza', name: 'Golden Frieza', title: 'Emperor of the Universe', series: 'Dragon Ball', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/golden-frieza.glb', height: 1.95, size: 1.05, hp: 2500, poise: 300, speed: .9, knockbackIn: .4, stunIn: .7, breaker: true,
  blink: { every: 5.5, beyond: 7 },
  moves: [
    multi(melee("Emperor's Rush", 'light', ['R1_1_HT'], 1.6, .08, 26, { chain: RUSH, range: 2.3, radius: .8, lunge: 4, knockback: 2, maxRange: 3, rest: .3, element: 'fire' }), [.08, .34, .6, .96, 1.24], 48),
    melee('Tail Smash', 'heavy', ['SMF_3HT'], 1.2, .62, 84, { chain: smash('SMF'), range: 2.6, radius: .9, lunge: 5, knockback: 11, guardBreak: true, maxRange: 3.2, rest: 2.2, telegraph: 'cone', element: 'fire' }),
    multi(shot('Death Beam', 'special', ['SKL2_HT'], 2.1, 1.1, 40, { chain: ['SKL2_IN', 'SKL2_HT', 'SKL2_OT'], speed: 64, radius: .35, knockback: 3, stun: .4, minRange: 3, maxRange: 22, rest: 4.5, element: 'dark', callout: true }), [1.1, 1.28, 1.46], 60),
    { ...shot('Death Ball', 'ultimate', ['ry1_3HT1'], 3.2, 1.9, 190, { chain: BLAST, speed: 13, range: 24, radius: 3.4, knockback: 14, guardBreak: true, minRange: 4, maxRange: 20, rest: 10, telegraph: 'target', element: 'fire', callout: true }), style: 'bomb' },
  ],
  clips: szClips(), xp: 22, score: 3200, cost: 6, color: 0xffc21e,
};
ENEMIES.jiren = {
  id: 'jiren', name: 'Jiren', title: 'The Pride Troopers · Universe 11', series: 'Dragon Ball', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/jiren.glb', height: 2.35, size: 1.3, hp: 8600, poise: 700, speed: .8, knockbackIn: .2, stunIn: .5, breaker: true,
  blink: { every: 4, beyond: 6 },
  moves: [
    multi(melee('Pride Rush', 'light', ['R1_1_HT'], 1.8, .1, 30, { chain: RUSH, range: 2.5, radius: .8, lunge: 4, knockback: 2, maxRange: 3.2, rest: .2, element: 'blood' }), [.1, .35, .6, 1.0, 1.35], 60),
    melee('Power Smash', 'heavy', ['SMF_3HT'], 1.2, .62, 110, { chain: smash('SMF'), range: 2.8, radius: 1, lunge: 6, knockback: 12, guardBreak: true, maxRange: 3.6, rest: 2.4, telegraph: 'cone', element: 'blood' }),
    melee('Dash Smash', 'heavy', ['DSM_3HT'], 1.55, .9, 120, { chain: smash('DSM'), range: 2.8, radius: 1, lunge: 10, close: 12, knockback: 13, minRange: 3, maxRange: 12, rest: 3, telegraph: 'line', element: 'blood' }),
    melee('Glare', 'special', ['KAH_3HT'], 2.3, 1.25, 90, { chain: smash('KAH'), range: .5, radius: 4, lunge: 0, knockback: 12, guardBreak: true, maxRange: 4.2, rest: 6, telegraph: 'ring', element: 'blood', callout: true }),
    { ...shot('Power Impact', 'ultimate', ['ry1_3HT1'], 3.4, 1.6, 200, { chain: BLAST, speed: 30, range: 26, radius: 2.6, knockback: 14, guardBreak: true, minRange: 3, maxRange: 22, rest: 9, telegraph: 'target', element: 'blood', callout: true }), style: 'bomb' },
    melee('Infinity Rush', 'special', ['R1_3_HT'], 2.4, .5, 40, { chain: [...RUSH], range: .5, radius: 2.4, knockback: 8, maxRange: 18, rest: 10, telegraph: 'ring', element: 'blood', callout: true, phase: 1,
      rain: { count: 14, every: .14, lead: .85, spread: 5.5, radius: 1.6, damage: 70, start: .3, knockback: 8 } }),
  ],
  clips: szClips({ intro: ['SKL2_HT'] }), xp: 90, score: 24000, cost: 0, color: 0xe0142e,
};

const gifterClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['idle'], run: ['run'], walk: ['walk'], hit: ['hit'], down: ['knockdown'], getup: ['getup'], stun: ['hit'],
  blown: ['knockdown'], land: ['knockdown'], death: ['die'], dash: ['run'], jump: ['run'], fall: ['knockdown'], taunt: ['roar'], ...extra,
});
const GIFTER_CREDIT = 'Beast Pirates Gifter: generated for Rift Arena with Meshy';
ENEMIES.gifter = {
  id: 'gifter', name: 'Gifter', series: 'One Piece', role: 'fodder', brain: 'swarm',
  model: '/assets/survival/enemies/gifter.glb', height: 2, hp: 170, speed: .66,
  moves: [
    melee('Iron Kick', 'light', ['kick'], 1.2, .5, 28, { clipSeconds: 1.43, range: 2.1, cooldown: 1.2, knockback: 4.5 }),
    melee('Horn Uppercut', 'heavy', ['uppercut'], 1.2, .7, 40, { clipSeconds: 1.03, range: 2, cooldown: 3, knockback: 6.5, stun: .5, weight: .35 }),
  ],
  clips: gifterClips(), xp: 1, score: 50, cost: 1, color: 0x5a2a6a,
};
ENEMIES['gifter-roar'] = {
  id: 'gifter-roar', name: 'Roaring Gifter', series: 'One Piece', role: 'gunner', brain: 'gunner',
  model: '/assets/survival/enemies/gifter.glb', height: 2, hp: 130, speed: .6,
  moves: [
    shot('Beast Roar', 'special', ['roar'], 2.2, 1.7, 24, { clipSeconds: 2.6, speed: 26, radius: .7, cooldown: 4.2, element: 'sound' }),
    melee('Iron Kick', 'light', ['kick'], 1.2, .5, 24, { clipSeconds: 1.43, range: 2.1, cooldown: 1.4, maxRange: 2.2 }),
  ],
  clips: gifterClips(), xp: 2, score: 80, cost: 2, color: 0xe86ad8, tint: 0xf0d0ff,
};
ENEMIES['gifter-giant'] = {
  id: 'gifter-giant', name: 'Giant Gifter', series: 'One Piece', role: 'brute', brain: 'brute',
  model: '/assets/survival/enemies/gifter.glb', height: 3.2, size: 1.6, hp: 700, poise: 220, speed: .45,
  knockbackIn: .4, stunIn: .7, breaker: true,
  moves: [
    melee('Crushing Knuckle', 'heavy', ['uppercut'], 1.8, 1.05, 62, { clipSeconds: 1.03, range: 3, radius: 1.1, cooldown: 2.4, knockback: 10, stun: .6, guardBreak: true, lunge: 3, maxRange: 3.4, telegraph: 'cone' }),
    melee('Stomp', 'heavy', ['kick'], 1.6, .8, 52, { clipSeconds: 1.47, range: 1.2, radius: 2.6, cooldown: 3.5, knockback: 8, maxRange: 3, telegraph: 'ring' }),
  ],
  clips: gifterClips(), xp: 7, score: 320, cost: 4, color: 0x3a1a4a, tint: 0xc0a8c8,
};
ENEMIES.king = {
  id: 'king', name: 'King', title: 'All-Star · The Wildfire', series: 'One Piece', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/king.glb', height: 2.75, size: 1.35, hp: 2900, poise: 400, speed: .82, knockbackIn: .35, stunIn: .65, breaker: true,
  blink: { every: 7, beyond: 9 },
  hide: /\b[lr]_arm_sp|hand_(close_)?sp_/,
  moves: [
    melee('Wildfire Cut', 'light', ['_combo_a'], .97, .38, 62, { range: 2.8, radius: .9, lunge: 5, knockback: 5, maxRange: 3.4, rest: .3, element: 'fire' }),
    melee('Imperial Sword', 'heavy', ['_combo_c'], 1, .45, 84, { range: 3, radius: 1, lunge: 7, close: 8, knockback: 9, maxRange: 7, rest: 2.2, telegraph: 'line', element: 'fire' }),
    shot('Dragon Twister: Gale', 'special', ['_skill_a'], 1.8, .7, 110, { speed: 24, radius: 1.4, range: 24, knockback: 10, minRange: 3.5, maxRange: 20, rest: 5, telegraph: 'line', element: 'fire', callout: true }),
    { ...melee('Pteranodon Dive', 'ultimate', ['_skill_b'], 2.3, 1.1, 150, { range: 22, radius: 2.6, knockback: 13, guardBreak: true, minRange: 3, maxRange: 18, rest: 8, telegraph: 'target', element: 'fire', callout: true }), style: 'field' },
  ],
  clips: brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] }), xp: 24, score: 3600, cost: 6, color: 0xff6a1e,
};
ENEMIES.bigmom = {
  id: 'bigmom', name: 'Big Mom', title: 'Emperor · Soul-Soul Fruit', series: 'One Piece', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/bigmom.glb', height: 3, size: 1.42, hp: 3400, poise: 480, speed: .7, knockbackIn: .3, stunIn: .6, breaker: true,
  hide: /hand_sp/,
  moves: [
    melee('Napoleon Slash', 'light', ['_combo_a'], 1.13, .45, 66, { range: 3, radius: 1, lunge: 4, knockback: 6, maxRange: 3.5, rest: .3, element: 'fire' }),
    melee('Soul Pocus', 'heavy', ['_combo_c'], 1.6, .9, 92, { range: 3, radius: 1.3, lunge: 5, knockback: 10, guardBreak: true, maxRange: 3.6, rest: 2.6, telegraph: 'cone', element: 'dark' }),
    shot('Heavenly Fire', 'special', ['_skill_a'], 1.97, 1, 120, { speed: 18, radius: 1.8, range: 24, knockback: 11, minRange: 3.5, maxRange: 20, rest: 5, telegraph: 'line', element: 'fire', callout: true }),
    { ...melee('Zeus Breeze Tempo', 'ultimate', ['_skill_b'], 1.9, 1.2, 130, { clipSeconds: 1.57, range: 22, radius: 2.4, knockback: 12, stun: .9, guardBreak: true, minRange: 2, maxRange: 18, rest: 8, telegraph: 'target', element: 'lightning', callout: true }), style: 'field' },
  ],
  clips: brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] }), xp: 24, score: 3600, cost: 6, color: 0xff7ab8,
};
ENEMIES.katakuri = {
  id: 'katakuri', name: 'Katakuri', title: 'Sweet Commander · Mochi-Mochi', series: 'One Piece', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/katakuri.glb', height: 2.85, size: 1.35, hp: 3000, poise: 420, speed: .86, knockbackIn: .35, stunIn: .65, breaker: true,
  blink: { every: 6, beyond: 8 },
  hide: /donut|power_mochi|spear_0/,
  moves: [
    melee('Mogura Thrust', 'light', ['_combo_a'], 1, .42, 64, { range: 3.2, radius: .8, lunge: 5, knockback: 5, maxRange: 3.8, rest: .3 }),
    melee('Mochi Spin', 'heavy', ['_combo_c'], 1.5, .87, 86, { range: 1.2, radius: 2.8, lunge: 2, knockback: 9, maxRange: 3.2, rest: 2.4, telegraph: 'ring' }),
    melee('Zan Giri Mochi', 'special', ['_skill_a'], 2, 1.27, 124, { range: 3.2, radius: 1.3, lunge: 9, close: 11, knockback: 12, guardBreak: true, minRange: 2, maxRange: 11, rest: 5, telegraph: 'line', callout: true, show: /power_mochi/ }),
    multi(melee('Buzz Cut Mochi', 'ultimate', ['_skill_b'], 1.9, .7, 44, { clipSeconds: 1.67, range: 3.4, radius: 1.8, lunge: 6, close: 8, knockback: 4, guardBreak: true, maxRange: 8, rest: 8, telegraph: 'cone', callout: true }), [.7, .95, 1.2, 1.45], 90),
  ],
  clips: brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] }), xp: 24, score: 3600, cost: 6, color: 0xb8202a,
};
ENEMIES.kaido = {
  id: 'kaido', name: 'Kaido', title: 'Emperor · King of the Beasts', series: 'One Piece', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/kaido.glb', height: 3.2, size: 1.5, hp: 7000, poise: 700, speed: .74, knockbackIn: .18, stunIn: .5, breaker: true,
  transform: { into: 'kaido-hybrid' },
  moves: [
    melee('Kanabō Swing', 'light', ['_combo_a'], 1.1, .5, 80, { range: 3.2, radius: 1.2, lunge: 5, knockback: 7, maxRange: 3.8, rest: .2, element: 'dark' }),
    melee('Ragnaraku', 'heavy', ['_combo_b'], 1, .45, 110, { clipSeconds: .8, range: 3.2, radius: 1.3, lunge: 9, close: 11, knockback: 12, guardBreak: true, minRange: 2.5, maxRange: 11, rest: 2.6, telegraph: 'line', element: 'dark' }),
    { ...melee('Kaido Leap', 'special', ['_skill_a'], 2.3, 1.45, 130, { range: 22, radius: 3, knockback: 13, stun: .8, minRange: 3, maxRange: 18, rest: 6, telegraph: 'target', element: 'dark', callout: true }), style: 'field' },
    melee('Thunder Bagua', 'ultimate', ['_skill_b'], 2.8, 2.2, 210, { range: 1.5, radius: 3.4, lunge: 3, knockback: 16, stun: 1, guardBreak: true, maxRange: 4.5, rest: 8, telegraph: 'ring', element: 'lightning', callout: true }),
  ],
  clips: brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] }), xp: 60, score: 16000, cost: 0, color: 0x6a3cff,
};
ENEMIES['kaido-hybrid'] = {
  id: 'kaido-hybrid', name: 'Kaido', title: 'Man-Beast Form · Fish-Fish Fruit, Azure Dragon', series: 'One Piece', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/kaido-hybrid.glb', height: 3.5, size: 1.62, hp: 8000, poise: 800, speed: .82, knockbackIn: .15, stunIn: .45, breaker: true,
  blink: { every: 7, beyond: 10 },
  hide: /c_kanabo/,
  moves: [
    melee('Tail Sweep', 'light', ['_combo_a'], 1, .36, 84, { clipSeconds: .9, range: 1, radius: 3, lunge: 2, knockback: 9, maxRange: 3.6, rest: .4, telegraph: 'ring', element: 'dark' }),
    melee('Dragon Rush', 'heavy', ['_combo_b'], 1.05, .45, 110, { clipSeconds: .93, range: 3.4, radius: 1.4, lunge: 10, close: 12, knockback: 12, guardBreak: true, minRange: 2.5, maxRange: 12, rest: 2.4, telegraph: 'line', element: 'dark' }),
    melee('Thunder Bagua', 'heavy', ['_combo_c'], 1.6, .8, 150, { clipSeconds: 1.57, range: 3.4, radius: 1.8, lunge: 4, knockback: 15, guardBreak: true, maxRange: 4.2, rest: 4, telegraph: 'cone', element: 'lightning' }),
    { ...shot('Bolo Breath', 'ultimate', ['_opening'], 3, 1.7, 180, { clipSeconds: 2.97, range: 24, radius: 1.6, knockback: 14, guardBreak: true, minRange: 3, maxRange: 22, rest: 8, telegraph: 'line', element: 'fire', callout: true }), style: 'beam' },
    melee('Fire Rain', 'special', ['_skill_a_end'], 2.3, .6, 60, { range: .5, radius: 3, knockback: 9, maxRange: 20, rest: 9, telegraph: 'ring', element: 'fire', callout: true,
      rain: { count: 18, every: .13, lead: .95, spread: 6.5, radius: 1.9, damage: 76, start: .4, knockback: 9 } }),
  ],
  clips: brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] }), xp: 100, score: 30000, cost: 0, color: 0x3a6aff,
};

const ZETSU_CREDIT = 'White Zetsu: generated for Rift Arena with Meshy';
const zetsuClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['idle'], run: ['run'], walk: ['walk'], hit: ['hit'], down: ['knockdown'], getup: ['getup'], stun: ['hit'],
  blown: ['knockdown'], land: ['knockdown'], death: ['die'], dash: ['run'], jump: ['run'], fall: ['knockdown'], taunt: ['roar'], ...extra,
});
ENEMIES.zetsu = {
  id: 'zetsu', name: 'White Zetsu', series: 'Naruto Shippuden', role: 'fodder', brain: 'swarm',
  model: '/assets/survival/enemies/zetsu.glb', height: 1.8, hp: 130, speed: .72,
  moves: [
    melee('Grasping Strike', 'light', ['punch'], 1.2, .59, 24, { clipSeconds: 2.2, range: 2, cooldown: 1.2, knockback: 3.8 }),
    melee('Wood Kick', 'heavy', ['kick'], 1.2, .5, 34, { clipSeconds: 1.43, range: 2.1, cooldown: 3, knockback: 6, stun: .45, weight: .35 }),
  ],
  clips: zetsuClips(), xp: 1, score: 45, cost: 1, color: 0xe8f0e0,
};
ENEMIES['zetsu-spore'] = {
  id: 'zetsu-spore', name: 'Spore Zetsu', series: 'Naruto Shippuden', role: 'gunner', brain: 'gunner',
  model: '/assets/survival/enemies/zetsu.glb', height: 1.8, hp: 105, speed: .64,
  moves: [
    shot('Chakra Spore', 'special', ['roar'], 2.2, 1.54, 22, { clipSeconds: 2.4, speed: 24, radius: .6, cooldown: 4.2, element: 'jade' }),
    melee('Grasping Strike', 'light', ['punch'], 1.2, .59, 20, { clipSeconds: 2.2, range: 2, cooldown: 1.4, maxRange: 2.2 }),
  ],
  clips: zetsuClips(), xp: 2, score: 70, cost: 2, color: 0x7affb8, tint: 0xd8ffe0,
};
ENEMIES['zetsu-giant'] = {
  id: 'zetsu-giant', name: 'Giant Zetsu', series: 'Naruto Shippuden', role: 'brute', brain: 'brute',
  model: '/assets/survival/enemies/zetsu.glb', height: 3.1, size: 1.55, hp: 620, poise: 200, speed: .46,
  knockbackIn: .4, stunIn: .7, breaker: true,
  moves: [
    melee('Crushing Grasp', 'heavy', ['punch'], 1.9, 1.05, 58, { clipSeconds: 2.2, range: 3, radius: 1.1, cooldown: 2.4, knockback: 9, stun: .6, guardBreak: true, lunge: 3, maxRange: 3.4, telegraph: 'cone' }),
    melee('Stomp', 'heavy', ['kick'], 1.6, .8, 50, { clipSeconds: 1.43, range: 1.2, radius: 2.6, cooldown: 3.5, knockback: 8, maxRange: 3, telegraph: 'ring' }),
  ],
  clips: zetsuClips(), xp: 7, score: 280, cost: 4, color: 0x9ab88a, tint: 0xc8d8c0,
};
const KURAMA = (clip: string) => [`Armature|${clip}`, clip];
ENEMIES.jabba = {
  id: 'jabba', name: 'Jabba the Hutt', title: 'Crime Lord of Tatooine', series: 'Star Wars', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/jabba.glb', height: 2.2, size: 1.36, girth: 1.5, hp: 1600, poise: 320, speed: .42, knockbackIn: .12, stunIn: .6, breaker: true, anchored: true,
  moves: [
    melee('Tail Sweep', 'light', ['_tail'], 1.4, .7, 46, { range: 1, radius: 3.4, lunge: 0, knockback: 9, maxRange: 3.6, rest: .6, telegraph: 'ring' }),
    shot('Slime Spit', 'heavy', ['_spit'], 1.2, .74, 40, { speed: 20, range: 16, radius: .6, knockback: 4, minRange: 3, maxRange: 14, rest: 1.4, element: 'jade' }),
    melee('Belly Slam', 'special', ['_slam'], 1.6, 1.04, 70, { range: .5, radius: 3.2, lunge: 0, knockback: 11, stun: .7, maxRange: 3.4, rest: 4, telegraph: 'ring', callout: true }),
    melee('Thermal Detonators', 'ultimate', ['_laugh'], 2, .5, 40, { range: .5, radius: 2, lunge: 0, knockback: 8, maxRange: 18, rest: 8, telegraph: 'ring', element: 'fire', callout: true,
      rain: { count: 8, every: .22, lead: 1, spread: 5.5, radius: 1.8, damage: 55, start: .4, knockback: 8 } }),
  ],
  clips: { idle: ['_idle'], run: ['_run'], hit: ['_hit'], down: ['_hit'], getup: ['_idle'], stun: ['_hit'], blown: ['_hit'], land: ['_hit'],
    death: ['_die'], dash: ['_run'], jump: ['_idle'], fall: ['_idle'], taunt: ['_laugh'], intro: ['_laugh'] },
  xp: 18, score: 1600, cost: 6, color: 0x7a8a3a,
};
ENEMIES.whitebeard = {
  id: 'whitebeard', name: 'Whitebeard', title: 'Emperor · Quake-Quake Fruit', series: 'One Piece', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/whitebeard.glb', height: 3.3, size: 1.48, hp: 7400, poise: 720, speed: .7, knockbackIn: .16, stunIn: .5, breaker: true,
  moves: [
    melee('Bisento Sweep', 'light', ['_combo_a'], 1.13, .57, 80, { range: 3.4, radius: 1.3, lunge: 4, knockback: 8, maxRange: 4, rest: .3, element: 'steel' }),
    melee('Murakumogiri', 'heavy', ['_combo_b'], 1.33, .73, 108, { range: 3.8, radius: 1.8, lunge: 5, knockback: 12, guardBreak: true, maxRange: 4.6, rest: 2.2, telegraph: 'cone', element: 'steel' }),
    melee('Quake Punch', 'heavy', ['_combo_c'], 1.63, .63, 124, { range: 1.5, radius: 3.4, lunge: 2, knockback: 15, stun: .8, maxRange: 4, rest: 3.4, telegraph: 'ring', element: 'sound' }),
    { ...shot('Seaquake', 'special', ['_skill_a'], 2.3, 1.17, 150, { speed: 30, range: 24, radius: 1.8, knockback: 13, stun: .9, minRange: 3.5, maxRange: 22, rest: 5, telegraph: 'line', element: 'sound', callout: true }), style: 'beam' },
    melee('Island-Splitter', 'ultimate', ['_skill_b'], 3.13, 1.33, 70, { range: .5, radius: 3, lunge: 0, knockback: 10, maxRange: 20, rest: 9, telegraph: 'ring', element: 'sound', callout: true, phase: 1,
      rain: { count: 14, every: .17, lead: 1, spread: 7, radius: 2.3, damage: 82, start: .6, knockback: 10 } }),
  ],
  clips: brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] }), xp: 68, score: 17000, cost: 0, color: 0xf4f0e2,
};
ENEMIES.blackbeard = {
  id: 'blackbeard', name: 'Blackbeard', title: 'Emperor · Dark-Dark and Quake-Quake', series: 'One Piece', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/blackbeard.glb', height: 2.9, size: 1.36, hp: 6400, poise: 560, speed: .78, knockbackIn: .22, stunIn: .55, breaker: true,
  moves: [
    melee('Darkness Grab', 'light', ['_combo_a'], 1, .35, 62, { range: 3, radius: 1, lunge: 6, knockback: 5, maxRange: 3.6, rest: .3, element: 'dark' }),
    melee('Black Hole Rush', 'heavy', ['_combo_b'], 1.17, .5, 92, { range: 3.2, radius: 1.3, lunge: 8, close: 9, knockback: 11, guardBreak: true, minRange: 2, maxRange: 9, rest: 2.4, telegraph: 'line', element: 'dark' }),
    melee('Stolen Quake', 'heavy', ['_combo_c'], 1.3, .6, 110, { range: 1.4, radius: 2.9, lunge: 3, knockback: 13, stun: .7, maxRange: 3.8, rest: 3.2, telegraph: 'ring', element: 'sound' }),
    melee('Black Vortex', 'special', ['_skill_a'], 2.57, 1.1, 130, { range: .5, radius: 4.4, lunge: 0, knockback: 6, stun: 1, maxRange: 4.4, rest: 6, telegraph: 'ring', element: 'dark', callout: true }),
    melee('Liberation', 'ultimate', ['_skill_b'], 2.8, 1.2, 60, { range: .5, radius: 2.8, lunge: 0, knockback: 9, maxRange: 18, rest: 9, telegraph: 'ring', element: 'dark', callout: true, phase: 1,
      rain: { count: 16, every: .14, lead: .95, spread: 7, radius: 2, damage: 70, start: .5, knockback: 8 } }),
  ],
  clips: brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] }), xp: 62, score: 15000, cost: 0, color: 0x2a0a3a,
};
ENEMIES.madara = {
  id: 'madara', name: 'Madara Uchiha', title: 'The Ghost of the Uchiha', series: 'Naruto Shippuden', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/madara.glb', height: 2.3, size: 1.2, hp: 6800, poise: 560, speed: .86, knockbackIn: .25, stunIn: .55, breaker: true,
  blink: { every: 8, beyond: 11 },
  moves: [
    melee('Gunbai Strike', 'light', ['_atk01'], 1.83, .87, 72, { clipSeconds: 1.83, range: 2.8, radius: 1, lunge: 4.5, knockback: 7, maxRange: 3.4, rest: .5, element: 'steel' }),
    { ...shot('Majestic Destroyer Flame', 'special', ['_skl01'], 2, .9, 140, { clipSeconds: 2, speed: 22, range: 22, radius: 2, knockback: 12, stun: .8, minRange: 3, maxRange: 20, rest: 5, telegraph: 'line', element: 'fire', callout: true }), style: 'beam' },
    melee('Tengai Shinsei', 'ultimate', ['_skl02'], 3.17, 1.33, 70, { clipSeconds: 3.17, range: .5, radius: 3, lunge: 0, knockback: 12, maxRange: 20, rest: 10, telegraph: 'ring', element: 'fire', callout: true,
      rain: { count: 8, every: .3, lead: 1.25, spread: 7, radius: 3, damage: 110, start: .5, knockback: 13 } }),
  ],
  clips: { idle: ['_idle'], run: ['_run'], hit: ['_hit01'], down: ['_back'], getup: ['_go'], stun: ['_hit02'], blown: ['_back'], land: ['_back'],
    death: ['_die'], dash: ['_run'], jump: ['_run'], fall: ['_back'], taunt: ['_show'], intro: ['_show'] },
  xp: 64, score: 16000, cost: 0, color: 0xc01020,
};
ENEMIES.kurama = {
  id: 'kurama', name: 'Kurama', title: 'The Nine-Tailed Demon Fox', series: 'Naruto Shippuden', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/kurama.glb', height: 3.8, size: 1.85, girth: 2.4, hp: 9000, poise: 800, speed: .62, knockbackIn: .12, stunIn: .4, breaker: true, anchored: true,
  moves: [
    melee('Demon Claw', 'light', KURAMA('attack01'), 1.8, .75, 90, { clipSeconds: 2.4, range: 4.5, radius: 2, lunge: 4, knockback: 10, maxRange: 5.5, rest: .4, element: 'fire' }),
    multi(melee('Tail Storm', 'heavy', KURAMA('skill01_1'), 2.8, .8, 44, { clipSeconds: 3.9, range: 1, radius: 6, lunge: 0, knockback: 9, maxRange: 6.5, rest: 4, telegraph: 'ring', element: 'fire' }), [.8, 1.3, 1.8, 2.3], 90),
    melee('Fox Pounce', 'special', KURAMA('skill03'), 2, .85, 130, { clipSeconds: 2.4, range: 4.5, radius: 2.4, lunge: 12, close: 14, knockback: 13, guardBreak: true, minRange: 4, maxRange: 14, rest: 5, telegraph: 'line', element: 'fire', callout: true }),
    { ...shot('Tailed Beast Bomb', 'ultimate', KURAMA('skill02'), 3.3, 2.2, 230, { speed: 20, range: 28, radius: 5.5, knockback: 15, guardBreak: true, minRange: 5, maxRange: 26, rest: 10, telegraph: 'target', element: 'dark', callout: true }), style: 'bomb' },
    melee('Chakra Storm', 'special', KURAMA('skill02'), 2.4, .6, 50, { clipSeconds: 3.3, range: .5, radius: 5, knockback: 9, maxRange: 20, rest: 10, telegraph: 'ring', element: 'fire', callout: true, phase: 1,
      rain: { count: 16, every: .13, lead: .9, spread: 7, radius: 2.2, damage: 70, start: .4, knockback: 9 } }),
  ],
  clips: {
    idle: KURAMA('stand'), run: KURAMA('run'), hit: KURAMA('hurt01'), down: KURAMA('hurt01'), getup: KURAMA('atstand'), stun: KURAMA('hurt01'),
    blown: KURAMA('hurt01'), land: KURAMA('hurt01'), death: KURAMA('hurt01'), dash: KURAMA('run'), jump: KURAMA('run'), fall: KURAMA('run'),
    taunt: KURAMA('skill02'), intro: KURAMA('skill02'),
  },
  xp: 80, score: 20000, cost: 0, color: 0xff7a1e, runSpeed: 9,
};

const RIVALS: readonly (readonly [FighterId, string, string])[] = [
  ['goku', 'Goku', 'Dragon Ball'], ['vegeta', 'Vegeta', 'Dragon Ball'], ['naruto', 'Naruto', 'Naruto Shippuden'],
  ['sasuke', 'Sasuke', 'Naruto Shippuden'], ['kakashi', 'Kakashi', 'Naruto Shippuden'], ['luffy', 'Luffy', 'One Piece'],
  ['zoro', 'Zoro', 'One Piece'], ['sanji', 'Sanji', 'One Piece'], ['ace', 'Ace', 'One Piece'], ['law', 'Law', 'One Piece'],
  ['ichigo', 'Ichigo', 'Bleach'], ['jotaro', 'Jotaro', 'JoJo'], ['dio', 'DIO', 'JoJo'], ['gojo', 'Gojo', 'Jujutsu Kaisen'],
  ['guts', 'Guts', 'Berserk'], ['killua', 'Killua', 'Hunter × Hunter'],
];
for (const [fighter, name, series] of RIVALS) {
  ENEMIES[`shadow-${fighter}`] = {
    id: `shadow-${fighter}`, name: `Shadow ${name}`, title: 'Turned by the Rift', series, role: 'elite', brain: 'boss',
    model: '', height: 1.8, hp: 2300, speed: 1, moves: [], clips: brClips(), rival: fighter,
    xp: 22, score: 3200, cost: 6, color: 0x6a2aff,
  };
}
export const SHADOW_RIVALS = RIVALS.map(([fighter]) => `shadow-${fighter}`);

export const enemy = (id: string): EnemyDefinition => {
  const def = ENEMIES[id];
  if (!def) throw new Error(`Unknown enemy ${id}`);
  return def;
};

export function kitOf(def: EnemyDefinition): SlotMoves {
  const first = def.moves[0];
  const pick = (slot: AttackSlot) => def.moves.find(move => move.slot === slot) ?? { ...first, slot };
  return { light: pick('light'), heavy: pick('heavy'), special: pick('special'), ultimate: pick('ultimate') };
}

export const modelsOf = (ids: readonly string[]) => [...new Set(ids.map(id => enemy(id).model).filter(Boolean))];

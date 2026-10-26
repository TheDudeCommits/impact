export type GruntRole = 'fodder' | 'gunner' | 'brute' | 'charger' | 'exploder' | 'shield' | 'healer' | 'summoner' | 'sniper' | 'diver';
export type GruntElement = 'steel' | 'blood' | 'fire' | 'ki' | 'cero' | 'jade' | 'laser' | 'dark' | 'sound' | 'blaster';
export type Ichor = 'red' | 'black' | 'white' | 'green' | 'oil' | 'purple';

export interface GruntMove {
  name: string;
  clip: string;
  duration: number;
  contact: number;
  range: number;
  arc: number;
  damage: number;
  knockback: number;
  stun: number;
  kind: 'melee' | 'shot' | 'slam' | 'explode' | 'charge' | 'mend' | 'summon' | 'dive';
  radius?: number;
  speed?: number;
  lunge?: number;
  cooldown: number;
  heavy?: boolean;
  minRange?: number;
  maxRange?: number;
  weight?: number;
  element?: GruntElement;
}

export interface GruntKind {
  id: string;
  name: string;
  series: string;
  role: GruntRole;
  hp: number;
  speed: number;
  radius: number;
  height: number;
  mass: number;
  poise?: number;
  damageIn?: number;
  moves: GruntMove[];
  xp: number;
  score: number;
  cost: number;
  ichor: Ichor;
  hover?: number;
  shield?: boolean;
}

const melee = (name: string, clip: string, duration: number, contact: number, damage: number, extra: Partial<GruntMove> = {}): GruntMove =>
  ({ name, clip, duration, contact, damage, range: 1.7, arc: .35, knockback: 3.2, stun: .3, kind: 'melee', lunge: 1.4, cooldown: 1.1, ...extra });
const shot = (name: string, clip: string, duration: number, contact: number, damage: number, extra: Partial<GruntMove> = {}): GruntMove =>
  ({ name, clip, duration, contact, damage, range: 18, arc: .8, knockback: 3.5, stun: .3, kind: 'shot', radius: .35, speed: 24, cooldown: 3.4, minRange: 4.5, maxRange: 15, ...extra });

const CLAW = (damage: number, extra: Partial<GruntMove> = {}) => melee('Claw', 'claw', 1.2, .59, damage, extra);
const FRENZY = (damage: number, extra: Partial<GruntMove> = {}) => melee('Frenzy', 'combo', 1.6, .69, damage, { knockback: 5, stun: .45, cooldown: 2.2, weight: .45, ...extra });
const KICK = (damage: number, extra: Partial<GruntMove> = {}) => melee('Kick', 'kick', 1.2, .5, damage, { knockback: 4.5, ...extra });
const PUNCH = (damage: number, extra: Partial<GruntMove> = {}) => melee('Strike', 'punch', 1.2, .59, damage, extra);
const UPPERCUT = (damage: number, extra: Partial<GruntMove> = {}) => melee('Uppercut', 'uppercut', 1.2, .7, damage, { knockback: 6, stun: .45, cooldown: 2.2, weight: .4, ...extra });
const ROAR_SHOT = (name: string, damage: number, element: GruntElement, extra: Partial<GruntMove> = {}) => shot(name, 'roar', 2.2, 1.54, damage, { element, ...extra });

export const GRUNTS: readonly GruntKind[] = [
  { id: 'marine', name: 'Marine', series: 'One Piece', role: 'fodder', hp: 110, speed: 5.2, radius: .42, height: 1.75, mass: 1,
    moves: [CLAW(18, { name: 'Cutlass Slash', element: 'steel', clip: 'slash' }), KICK(22, { weight: .5 })], xp: 1, score: 40, cost: 1, ichor: 'red' },
  { id: 'marine-rifle', name: 'Marine Rifleman', series: 'One Piece', role: 'gunner', hp: 90, speed: 4.8, radius: .42, height: 1.75, mass: 1,
    moves: [ROAR_SHOT('Musket Volley', 20, 'steel', { speed: 34, radius: .25 }), PUNCH(16, { name: 'Bayonet', maxRange: 2.2, clip: 'thrust' })], xp: 2, score: 60, cost: 2, ichor: 'red' },
  { id: 'pacifista', name: 'Pacifista', series: 'One Piece', role: 'brute', hp: 760, speed: 3.6, radius: .8, height: 3.1, mass: 3.2, poise: 170, damageIn: .9,
    moves: [
      { ...shot('Paw Laser', 'roar', 2.2, 1.54, 46, { element: 'laser', speed: 40, radius: .45, knockback: 8, heavy: true, cooldown: 4 }) },
      melee('Iron Palm', 'uppercut', 1.7, 1, 52, { range: 2.6, arc: .1, knockback: 9, stun: .6, heavy: true, lunge: 2.2, cooldown: 2.6 }),
    ], xp: 8, score: 320, cost: 5, ichor: 'oil' },
  { id: 'beast-pirate', name: 'Beast Pirate', series: 'One Piece', role: 'fodder', hp: 150, speed: 5, radius: .46, height: 1.9, mass: 1.2,
    moves: [KICK(22, { name: 'Iron Kick' }), UPPERCUT(30, { name: 'Horn Uppercut' })], xp: 1, score: 50, cost: 1, ichor: 'red' },
  { id: 'chess-soldier', name: 'Chess Peacekeeper', series: 'One Piece', role: 'fodder', hp: 140, speed: 5, radius: .44, height: 1.95, mass: 1.1,
    moves: [CLAW(24, { name: 'Pike Thrust', element: 'steel', range: 2.3, lunge: 1.8, clip: 'thrust' }), KICK(20)], xp: 1, score: 50, cost: 1, ichor: 'red' },
  { id: 'gifter-brute', name: 'Gifter Brute', series: 'One Piece', role: 'brute', hp: 820, speed: 3.4, radius: .85, height: 3.1, mass: 3.4, poise: 200,
    moves: [
      melee('Crushing Knuckle', 'hammer', 1.8, 1.5, 56, { range: 2.7, arc: .1, knockback: 10, stun: .6, heavy: true, lunge: 2.4, cooldown: 2.6 }),
      { ...melee('Stomp', 'kick', 1.6, .8, 46, { knockback: 8, heavy: true, cooldown: 3.4 }), kind: 'slam', radius: 2.6, range: 1.2 },
    ], xp: 8, score: 320, cost: 5, ichor: 'red' },
  { id: 'hollow', name: 'Hollow', series: 'Bleach', role: 'fodder', hp: 130, speed: 5.6, radius: .44, height: 1.95, mass: 1,
    moves: [CLAW(20, { element: 'blood' }), FRENZY(16, { element: 'blood' })], xp: 1, score: 45, cost: 1, ichor: 'black' },
  { id: 'hollow-cero', name: 'Cero Hollow', series: 'Bleach', role: 'gunner', hp: 100, speed: 5, radius: .44, height: 1.95, mass: 1,
    moves: [ROAR_SHOT('Cero', 24, 'cero', { speed: 30, radius: .5 }), CLAW(16, { maxRange: 2.2 })], xp: 2, score: 70, cost: 2, ichor: 'black' },
  { id: 'menos', name: 'Menos Grande', series: 'Bleach', role: 'brute', hp: 900, speed: 3.2, radius: .95, height: 3.6, mass: 3.8, poise: 220,
    moves: [
      shot('Gran Cero', 'roar', 2.6, 1.82, 50, { element: 'cero', speed: 26, radius: .9, knockback: 9, heavy: true, cooldown: 4.5 }),
      melee('Crushing Claw', 'combo', 1.9, 1.1, 54, { range: 2.8, arc: .15, knockback: 9, stun: .6, heavy: true, lunge: 2.4, cooldown: 2.6 }),
    ], xp: 9, score: 340, cost: 5, ichor: 'black' },
  { id: 'saibaman', name: 'Saibaman', series: 'Dragon Ball', role: 'exploder', hp: 80, speed: 6.4, radius: .38, height: 1.35, mass: .8,
    moves: [
      CLAW(16, { name: 'Acid Claw' }),
      { ...melee('Self-Destruct', 'roar', 1.4, 1.2, 70, { knockback: 9, stun: .5, heavy: true, cooldown: 9, minRange: 0, maxRange: 1.8, weight: .6 }), kind: 'explode', radius: 2.6 },
    ], xp: 1, score: 55, cost: 1, ichor: 'green' },
  { id: 'frieza-soldier', name: 'Frieza Force Soldier', series: 'Dragon Ball', role: 'gunner', hp: 100, speed: 5, radius: .44, height: 1.85, mass: 1,
    moves: [ROAR_SHOT('Ki Blast', 20, 'ki', { speed: 36, radius: .3 }), PUNCH(16, { maxRange: 2.2 })], xp: 2, score: 65, cost: 2, ichor: 'purple' },
  { id: 'cell-jr', name: 'Cell Jr.', series: 'Dragon Ball', role: 'fodder', hp: 120, speed: 6.6, radius: .36, height: 1.4, mass: .8,
    moves: [PUNCH(18, { name: 'Rush' }), KICK(22, { name: 'Spin Kick' })], xp: 1, score: 55, cost: 1, ichor: 'purple' },
  { id: 'white-zetsu', name: 'White Zetsu', series: 'Naruto', role: 'fodder', hp: 115, speed: 5.4, radius: .42, height: 1.8, mass: 1,
    moves: [PUNCH(18, { name: 'Grasping Strike' }), KICK(22, { name: 'Wood Kick' })], xp: 1, score: 45, cost: 1, ichor: 'white' },
  { id: 'rogue-ninja', name: 'Rogue Ninja', series: 'Naruto', role: 'gunner', hp: 95, speed: 6, radius: .42, height: 1.78, mass: .9,
    moves: [shot('Kunai Volley', 'claw', 1.2, .55, 16, { element: 'steel', speed: 38, radius: .2, cooldown: 1.9, minRange: 3.5 }), KICK(18, { maxRange: 2.2 })], xp: 2, score: 60, cost: 2, ichor: 'red' },
  { id: 'gamorrean', name: 'Gamorrean Guard', series: 'Star Wars', role: 'charger', hp: 260, speed: 4.4, radius: .6, height: 2.0, mass: 1.8, poise: 40,
    moves: [
      melee('Axe Chop', 'chop', 1.6, .69, 30, { range: 2.1, knockback: 6, stun: .45, heavy: false, cooldown: 1.8, element: 'steel' }),
      { ...melee('Boar Rush', 'run', 1.3, .2, 34, { range: 1.6, arc: .5, knockback: 8, stun: .5, heavy: true, cooldown: 5, minRange: 4, maxRange: 11, weight: 1.4 }), kind: 'charge', lunge: 11 },
    ], xp: 3, score: 110, cost: 2, ichor: 'green' },
  { id: 'skiff-guard', name: 'Skiff Guard', series: 'Star Wars', role: 'gunner', hp: 95, speed: 5, radius: .42, height: 1.8, mass: 1,
    moves: [ROAR_SHOT('Blaster Bolt', 18, 'blaster', { speed: 44, radius: .22, cooldown: 1.8, duration: 1.1, contact: .55, clip: 'punch' }), CLAW(16, { name: 'Vibro-axe', maxRange: 2.2, element: 'steel', clip: 'spin' })], xp: 2, score: 60, cost: 2, ichor: 'red' },
  { id: 'husk', name: 'Hollow Husk', series: 'The Rift', role: 'fodder', hp: 100, speed: 6, radius: .42, height: 1.8, mass: .9,
    moves: [CLAW(18, { element: 'dark' }), FRENZY(14, { element: 'dark' })], xp: 1, score: 40, cost: 1, ichor: 'black' },
  { id: 'apostle-spawn', name: 'Apostle Spawn', series: 'The Rift', role: 'brute', hp: 980, speed: 3.6, radius: 1, height: 3.4, mass: 4, poise: 240,
    moves: [
      melee('Rending Claws', 'combo', 1.9, 1.1, 58, { range: 2.9, arc: .15, knockback: 10, stun: .6, heavy: true, lunge: 2.6, cooldown: 2.4, element: 'blood' }),
      { ...melee('Ground Slam', 'slam', 1.8, 1.05, 50, { knockback: 9, heavy: true, cooldown: 3.6 }), kind: 'slam', radius: 3 },
    ], xp: 10, score: 380, cost: 5, ichor: 'black' },
];

const MEND = (damage: number, extra: Partial<GruntMove> = {}): GruntMove => ({ ...melee('Mend', 'cast', 2, 1.5, damage, { cooldown: 5.5, minRange: 0, maxRange: 40, weight: 1.6, lunge: 0 }), kind: 'mend', radius: 8, ...extra });
const SUMMON = (count: number, extra: Partial<GruntMove> = {}): GruntMove => ({ ...melee('Rift Call', 'cast', 2.4, 1.9, count, { cooldown: 9, minRange: 0, maxRange: 40, weight: 1.4, lunge: 0 }), kind: 'summon', ...extra });
const SNIPE = (name: string, damage: number, element: GruntElement, extra: Partial<GruntMove> = {}) => shot(name, 'roar', 2.6, 2.2, damage, { element, speed: 70, radius: .3, range: 34, maxRange: 30, minRange: 8, knockback: 8, stun: .5, heavy: true, cooldown: 5.5, ...extra });
const DIVE = (damage: number, extra: Partial<GruntMove> = {}): GruntMove => ({ ...melee('Dive', 'kick', 1.7, 1.45, damage, { knockback: 7, stun: .5, heavy: true, cooldown: 5.5, minRange: 3.5, maxRange: 13, weight: 1.5 }), kind: 'dive', radius: 2.3, ...extra });
const SHIELD_BASH = (damage: number, extra: Partial<GruntMove> = {}) => melee('Shield Bash', 'punch', 1.3, .62, damage, { knockback: 6, stun: .45, cooldown: 1.8, ...extra });

{
  const add = (kind: GruntKind) => (GRUNTS as GruntKind[]).push(kind);
  add({ id: 'marine-shield', name: 'Marine Shieldbearer', series: 'One Piece', role: 'shield', hp: 170, speed: 4.4, radius: .48, height: 1.8, mass: 1.5, shield: true,
    moves: [SHIELD_BASH(20), CLAW(18, { name: 'Cutlass Slash', element: 'steel', clip: 'slash' })], xp: 2, score: 80, cost: 2, ichor: 'red' });
  add({ id: 'marine-sniper', name: 'Marine Sharpshooter', series: 'One Piece', role: 'sniper', hp: 85, speed: 4.6, radius: .42, height: 1.75, mass: 1,
    moves: [SNIPE('Long Shot', 44, 'steel'), PUNCH(14, { name: 'Bayonet', maxRange: 2.2, clip: 'thrust' })], xp: 3, score: 90, cost: 2, ichor: 'red' });
  add({ id: 'beast-leaper', name: 'Gifter Leaper', series: 'One Piece', role: 'diver', hp: 140, speed: 5.4, radius: .46, height: 1.9, mass: 1.2,
    moves: [DIVE(29, { name: 'Leaping Stomp' }), KICK(20, { name: 'Iron Kick' })], xp: 2, score: 80, cost: 2, ichor: 'red' });
  add({ id: 'beast-medic', name: 'Smile Doctor', series: 'One Piece', role: 'healer', hp: 110, speed: 4.6, radius: .44, height: 1.9, mass: 1,
    moves: [MEND(.3), KICK(16, { maxRange: 2.2 })], xp: 3, score: 110, cost: 2, ichor: 'red' });
  add({ id: 'chess-rook', name: 'Chess Rook', series: 'One Piece', role: 'shield', hp: 200, speed: 4.2, radius: .5, height: 2, mass: 1.7, shield: true,
    moves: [SHIELD_BASH(22), CLAW(22, { name: 'Pike Thrust', element: 'steel', range: 2.3, lunge: 1.8, clip: 'thrust' })], xp: 2, score: 90, cost: 2, ichor: 'red' });
  add({ id: 'chess-bishop', name: 'Chess Bishop', series: 'One Piece', role: 'healer', hp: 120, speed: 4.4, radius: .44, height: 1.95, mass: 1,
    moves: [MEND(.32), KICK(16, { maxRange: 2.2 })], xp: 3, score: 110, cost: 2, ichor: 'red' });
  add({ id: 'hollow-diver', name: 'Bat Hollow', series: 'Bleach', role: 'diver', hp: 120, speed: 6, radius: .44, height: 1.95, mass: 1,
    moves: [DIVE(30, { name: 'Dive', element: 'blood' }), CLAW(18, { element: 'blood' })], xp: 2, score: 80, cost: 2, ichor: 'black' });
  add({ id: 'hollow-caller', name: 'Hollow Caller', series: 'Bleach', role: 'summoner', hp: 130, speed: 4.6, radius: .44, height: 1.95, mass: 1,
    moves: [SUMMON(3), CLAW(16, { maxRange: 2.2 })], xp: 4, score: 130, cost: 3, ichor: 'black' });
  add({ id: 'frieza-sniper', name: 'Frieza Force Sniper', series: 'Dragon Ball', role: 'sniper', hp: 90, speed: 4.8, radius: .44, height: 1.85, mass: 1,
    moves: [SNIPE('Scouter Shot', 46, 'ki'), PUNCH(14, { maxRange: 2.2 })], xp: 3, score: 95, cost: 2, ichor: 'purple' });
  add({ id: 'saibaman-diver', name: 'Leaping Saibaman', series: 'Dragon Ball', role: 'diver', hp: 80, speed: 6.6, radius: .38, height: 1.35, mass: .8,
    moves: [DIVE(27, { name: 'Pounce' }), CLAW(16, { name: 'Acid Claw' })], xp: 2, score: 75, cost: 2, ichor: 'green' });
  add({ id: 'medic-ninja', name: 'Medical Ninja', series: 'Naruto', role: 'healer', hp: 100, speed: 5.6, radius: .42, height: 1.78, mass: .9,
    moves: [MEND(.3), KICK(16, { maxRange: 2.2 })], xp: 3, score: 110, cost: 2, ichor: 'red' });
  add({ id: 'summoner-ninja', name: 'Summoning Ninja', series: 'Naruto', role: 'summoner', hp: 110, speed: 5.2, radius: .42, height: 1.78, mass: .9,
    moves: [SUMMON(3), KICK(16, { maxRange: 2.2 })], xp: 4, score: 130, cost: 3, ichor: 'red' });
  add({ id: 'gamorrean-shield', name: 'Gamorrean Shieldbearer', series: 'Star Wars', role: 'shield', hp: 300, speed: 4, radius: .6, height: 2, mass: 2, shield: true,
    moves: [SHIELD_BASH(26), melee('Axe Chop', 'chop', 1.6, .69, 28, { range: 2.1, knockback: 6, stun: .45, cooldown: 1.8, element: 'steel' })], xp: 3, score: 120, cost: 3, ichor: 'green' });
  add({ id: 'skiff-sniper', name: 'Skiff Sniper', series: 'Star Wars', role: 'sniper', hp: 85, speed: 5, radius: .42, height: 1.8, mass: 1,
    moves: [SNIPE('Blaster Rifle', 41, 'blaster', { clip: 'punch', duration: 2.4, contact: 2 }), CLAW(14, { name: 'Vibro-axe', maxRange: 2.2, element: 'steel', clip: 'spin' })], xp: 3, score: 90, cost: 2, ichor: 'red' });
  add({ id: 'husk-diver', name: 'Falling Husk', series: 'The Rift', role: 'diver', hp: 95, speed: 6.2, radius: .42, height: 1.8, mass: .9,
    moves: [DIVE(29, { element: 'dark' }), CLAW(16, { element: 'dark' })], xp: 2, score: 70, cost: 2, ichor: 'black' });
  add({ id: 'husk-priest', name: 'Husk Priest', series: 'The Rift', role: 'summoner', hp: 120, speed: 4.6, radius: .42, height: 1.8, mass: .9,
    moves: [SUMMON(3), CLAW(14, { element: 'dark', maxRange: 2.2 })], xp: 4, score: 120, cost: 3, ichor: 'black' });
}

export const GRUNT_INDEX = new Map(GRUNTS.map((kind, i) => [kind.id, i] as const));
export const WEARS: Record<string, string> = {
  'marine-shield': 'marine', 'marine-sniper': 'marine-rifle', 'beast-leaper': 'beast-pirate', 'beast-medic': 'beast-pirate', 'chess-rook': 'chess-soldier', 'chess-bishop': 'chess-soldier',
  'hollow-diver': 'hollow', 'hollow-caller': 'hollow-cero', 'frieza-sniper': 'frieza-soldier', 'saibaman-diver': 'saibaman', 'medic-ninja': 'rogue-ninja', 'summoner-ninja': 'rogue-ninja',
  'gamorrean-shield': 'gamorrean', 'skiff-sniper': 'skiff-guard', 'husk-diver': 'husk', 'husk-priest': 'husk',
};
export function gruntKind(id: string): GruntKind {
  const index = GRUNT_INDEX.get(id);
  if (index === undefined) throw new Error(`Unknown grunt kind ${id}`);
  return GRUNTS[index];
}

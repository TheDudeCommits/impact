export const MAX_DEPTH = 15;

export interface DepthRule {
  name: string;
  line: string;
}

export const DEPTH_RULES: readonly DepthRule[] = [
  { name: 'SHARPER TEETH', line: 'The horde hits 10% harder.' },
  { name: 'THICKER HIDES', line: 'The horde has 15% more health.' },
  { name: 'THE HUNT QUICKENS', line: 'One more elite pack comes each round.' },
  { name: 'THIN BLOOD', line: 'Every heal is 20% weaker.' },
  { name: 'IRON MASTERS', line: 'Bosses have 15% more health.' },
  { name: 'SWIFT DEAD', line: 'The horde moves 8% faster.' },
  { name: 'DRY ROAD', line: 'No healing springs at the fork.' },
  { name: 'RELENTLESS', line: 'Bosses throw their set pieces 20% more often.' },
  { name: 'THE HORDE THICKENS', line: 'The field is 15% more crowded.' },
  { name: 'CRUEL MASTERS', line: 'Bosses hit 15% harder.' },
  { name: 'NO QUARTER', line: 'No health back between rounds.' },
  { name: 'TWO MASTERS', line: 'From rank A the Rift sends its bosses two at a time.' },
  { name: 'EARLY WRATH', line: 'Bosses awaken at two-thirds of their health.' },
  { name: 'ELITE LEGION', line: 'Elites among the horde are twice as common.' },
  { name: 'THE ABYSS', line: 'Everything in the Rift hits 15% harder again.' },
];

export interface DepthMods {
  hordeHp: number; hordeDamage: number; hordeSpeed: number; crowd: number;
  bossHp: number; bossDamage: number;
  heal: number;
  elites: number; eliteChance: number;
  springs: boolean;
  sigPace: number;
  roundHeal: boolean;
  doubleFrom: number;
  awaken: number;
}

export function depthMods(depth: number): DepthMods {
  const d = Math.max(0, Math.min(MAX_DEPTH, Math.floor(depth)));
  const at = (n: number) => d >= n;
  const abyss = at(15) ? 1.15 : 1;
  return {
    hordeDamage: (at(1) ? 1.1 : 1) * abyss, hordeHp: at(2) ? 1.15 : 1, hordeSpeed: at(6) ? 1.08 : 1, crowd: at(9) ? 1.15 : 1,
    bossHp: at(5) ? 1.15 : 1, bossDamage: (at(10) ? 1.15 : 1) * abyss,
    heal: at(4) ? .8 : 1, elites: at(3) ? 1 : 0, eliteChance: at(14) ? 2 : 1,
    springs: !at(7), sigPace: at(8) ? .8 : 1, roundHeal: !at(11), doubleFrom: at(12) ? 5 : 99, awaken: at(13) ? 2 / 3 : .5,
  };
}

export const depthPay = (depth: number) => 1 + .15 * Math.max(0, Math.min(MAX_DEPTH, Math.floor(depth)));

export const openDepth = (sealed: number) => Math.max(0, Math.min(MAX_DEPTH, Math.floor(sealed) + 1));
export const clampDepth = (depth: unknown, sealed: number) => typeof depth === 'number' && Number.isFinite(depth) ? Math.max(0, Math.min(openDepth(sealed), Math.floor(depth))) : 0;

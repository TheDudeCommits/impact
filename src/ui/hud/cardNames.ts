import type { MoveDefinition } from '../../game/moves';
import { areaCardOf } from '../../engine/sim/areaMoves';
const SHORT: Readonly<Record<string, string>> = {
  'BIG BALL RASENGAN BARRAGE': 'BIG BALL RASENGAN',
  'WATER STYLE: GREAT WATERFALL TECHNIQUE': 'GREAT WATERFALL',
  'GUM-GUM ELEPHANT GATLING': 'ELEPHANT GATLING',
};

export function cardLines(name: string, perLine = 14) {
  let count = 1, line = 0;
  for (const word of name.split(' ')) {
    if (line && line + 1 + word.length > perLine) { count++; line = word.length; }
    else line += (line ? 1 : 0) + word.length;
  }
  return count;
}

export function areaCardName(name: string) {
  const upper = name.toUpperCase();
  if (SHORT[upper]) return SHORT[upper];
  if (cardLines(upper) <= 2 || !upper.includes(':')) return upper;
  return upper.slice(upper.lastIndexOf(':') + 1).trim();
}

export const areaMoveCard = (move: Pick<MoveDefinition, 'name' | 'area'>) => areaCardName(areaCardOf(move));

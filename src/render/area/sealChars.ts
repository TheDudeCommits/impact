import { MOVES } from '../../game/moves';
import { moveFor } from '../../game/awakening';
import { FIGHTER_IDS } from '../../engine/sim/registry';
import { areaJaOf } from '../../engine/sim/areaMoves';
import { EMBLEMS, emblemText } from './emblems';
import { charsOf, ringLatin } from './glyphText';

export function wantedChars(): string[] {
  const want = new Set<string>();
  for (const id of FIGHTER_IDS) {
    for (const c of charsOf(emblemText(EMBLEMS[id]))) want.add(c);
    for (const move of new Set([MOVES[id].area, moveFor(id, 'area', true)])) {
      for (const c of charsOf(areaJaOf(id, move))) want.add(c);
      for (const c of charsOf(ringLatin(move.name))) want.add(c);
    }
  }
  return [...want].sort();
}

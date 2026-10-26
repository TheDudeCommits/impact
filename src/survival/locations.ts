import type { StageId } from '../game/stages';
import { loopOf } from './bosses';

export interface LocationDefinition {
  id: string;
  stage: StageId;
  name: string;
  subtitle: string;
  kanji: string;
  line: string; again: string;
}

const ROAD = [{ place: 0, rounds: 4 }, { place: 1, rounds: 4 }, { place: 2, rounds: 4 }, { place: 3, rounds: 2 }] as const;
export const RIFT_ROUNDS_PER_PLACE = 2;
export const FINAL_ROUND = ROAD.reduce((sum, leg) => sum + leg.rounds, 0);

export const LOCATIONS: readonly LocationDefinition[] = [
  { id: 'burning-village', stage: 'rift-village', name: 'The Burning Village', subtitle: 'Where the sky first tore open', kanji: '焼村',
    line: 'The rift opened here first. Nobody in this village saw the morning.', again: 'The fires never went out. Something is still feeding them.' },
  { id: 'hill-of-swords', stage: 'rift-swords', name: 'The Hill of Swords', subtitle: 'A thousand graves, and room for more', kanji: '剣の丘',
    line: 'A blade for every grave. The rift has come to dig them up.', again: 'There are more swords on the hill than there were. Yours is not one of them. Yet.' },
  { id: 'black-fortress', stage: 'rift-fortress', name: 'The Black Fortress', subtitle: 'The last wall between the dark and the living', kanji: '黒砦',
    line: 'The last wall between the dark and the living. It is already falling.', again: 'The wall fell. Whatever holds the gate now is not human.' },
  { id: 'the-eclipse', stage: 'rift-eclipse', name: 'The Eclipse', subtitle: 'Where the rift is widest', kanji: '蝕',
    line: 'Where the rift is widest. The black sun is watching.', again: 'The sun has not moved since you left. It was waiting for you.' },
  { id: 'frozen-shrine', stage: 'rift-frost', name: 'The Frozen Shrine', subtitle: 'Where the last prayers froze', kanji: '凍社',
    line: 'The priests prayed for the rift to close. The cold answered instead.', again: 'The ice has grown. Some of the statues were not statues before.' },
  { id: 'crimson-grove', stage: 'rift-grove', name: 'The Crimson Grove', subtitle: 'Bamboo that drinks blood', kanji: '血竹',
    line: 'The bamboo here grows red. Nobody who came to find out why walked back out.', again: 'The grove is thicker than you left it. It has been fed.' },
  { id: 'ashen-wastes', stage: 'rift-wastes', name: 'The Ashen Wastes', subtitle: 'Where the old gods fell', kanji: '灰原',
    line: 'Something older than the rift died here. The rift wears its bones.', again: 'The ash is still warm. The god is not as dead as it looks.' },
  { id: 'drowned-harbor', stage: 'rift-harbor', name: 'The Drowned Harbor', subtitle: 'The tide brought the dead back in', kanji: '沈港',
    line: 'The sea took the harbour in a single night. The tide brings back what it took.', again: 'The water is higher. The wrecks are closer. Their crews are coming ashore.' },
];

export function dungeonOrder(seed: number, rounds = 64): number[] {
  let s = (Math.floor(seed) % 2147483646 + 2147483646) % 2147483646 + 1;
  const random = () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
  const order: number[] = [];
  while (order.length < rounds) {
    const deck = LOCATIONS.map((_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    if (order.length && deck[0] === order[order.length - 1]) [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
    order.push(...deck);
  }
  return order;
}

export function dungeonFor(seed: number, round: number) {
  const r = Math.max(1, Math.floor(round));
  const place = dungeonOrder(seed, r)[r - 1];
  return { location: LOCATIONS[place], index: r - 1, loop: loopOf(r), first: true, progress: 0 };
}

export function locationFor(round: number) {
  const r = Math.max(1, Math.floor(round));
  let start = 1;
  for (let i = 0; i < ROAD.length; i++) {
    const leg = ROAD[i];
    if (r < start + leg.rounds) {
      const step = r - start;
      return { location: LOCATIONS[leg.place], index: i, loop: 0, first: step === 0, progress: leg.rounds > 1 ? step / (leg.rounds - 1) : 1 };
    }
    start += leg.rounds;
  }
  const past = r - start, stop = Math.floor(past / RIFT_ROUNDS_PER_PLACE), step = past % RIFT_ROUNDS_PER_PLACE;
  return { location: LOCATIONS[stop % LOCATIONS.length], index: ROAD.length + stop, loop: 1 + Math.floor(stop / LOCATIONS.length), first: step === 0,
    progress: step / (RIFT_ROUNDS_PER_PLACE - 1) };
}

import type { FighterId, RoomMode } from './types';

import { FIGHTER_SERIES } from './fighterSeries';
export { FIGHTER_SERIES };

export type StageId = 'harbor' | 'enies-lobby' | 'chunin-final' | 'martial-arts-tournament'
  | 'hidden-leaf' | 'blood-citadel' | 'galactic-arena' | 'chunin-exam-room' | 'hueco-mundo' | 'onigashima' | 'null-realm'
  | 'kami-lookout' | 'valley-of-the-end' | 'malevolent-shrine' | 'shiganshina'
  | 'rift-village' | 'rift-swords' | 'rift-fortress' | 'rift-eclipse'
  | 'rift-frost' | 'rift-grove' | 'rift-wastes' | 'rift-harbor' | 'rift-war'
  | 'marineford'
  | 'shibuya'
  | 'infinity-castle' | 'pains-crater' | 'heavens-arena';

export interface StageDefinition {
  id: StageId;
  name: string;
  scene: string;
  model: string | null;
  halfX: number;
  halfZ: number;
  spawnRadius: number;
  cameraFar: number;
  fog: readonly [number, number];
  background?: number;
  doubleSided?: boolean;
  duelAxis?: number;
  seatTurn?: number;
}

const define = (stage: StageDefinition) => stage;

export const STAGES: Record<StageId, StageDefinition> = {
  'rift-war': define({id:'rift-war',name:'Valley of the End · Rift War',scene:'Dawn Shrine against Eclipse Keep',model:null,halfX:84,halfZ:84,spawnRadius:12,cameraFar:650,fog:[145,560],background:0xc9d8d1}),
  'blood-citadel': define({id:'blood-citadel',name:'The Fallen Citadel',scene:'Bad Blood beneath the broken moon',model:null,halfX:30,halfZ:24,spawnRadius:13,cameraFar:480,fog:[90,350]}),
  'hidden-leaf': define({id:'hidden-leaf',name:'Hidden Leaf Village',scene:'Last Stand at the village gates',model:null,halfX:40,halfZ:44,spawnRadius:15,cameraFar:500,fog:[110,430]}),
  harbor: define({
    id: 'harbor', name: 'Manga Harbour', scene: 'Neutral ground',
    model: null, halfX: 80, halfZ: 80, spawnRadius: 36,
    cameraFar: 340, fog: [90, 340],
  }),
  'enies-lobby': define({
    id: 'enies-lobby', name: 'Enies Lobby', scene: 'The Bridge of Hesitation',
    model: '/assets/stages/enies-lobby.glb', halfX: 13, halfZ: 52, spawnRadius: 12,
    cameraFar: 1400, fog: [140, 1250],
  }),
  'chunin-final': define({
    id: 'chunin-final', name: 'Chūnin Exam Arena', scene: 'Under the Hokage faces',
    model: '/assets/stages/chunin-final.glb', halfX: 48, halfZ: 48, spawnRadius: 26,
    cameraFar: 1200, fog: [150, 1100],
  }),
  'martial-arts-tournament': define({
    id: 'martial-arts-tournament', name: 'World Martial Arts Tournament', scene: 'The tournament ring',
    model: '/assets/stages/martial-arts-tournament.glb', halfX: 13, halfZ: 13, spawnRadius: 9,
    cameraFar: 900, fog: [120, 800],
    duelAxis: 0,
  }),
  'galactic-arena': define({
    id: 'galactic-arena', name: 'Galactic Arena', scene: 'The Universe tournament ring',
    model: '/assets/stages/galactic-arena.glb', halfX: 10.5, halfZ: 10.5, spawnRadius: 7,
    cameraFar: 340, fog: [80, 320], background: 0x0b1424,
    duelAxis: 0,
  }),
  'chunin-exam-room': define({
    id: 'chunin-exam-room', name: 'Exam Hall', scene: 'Where the Chūnin Exams begin',
    model: '/assets/stages/chunin-exam-room.glb', halfX: 6.5, halfZ: 7, spawnRadius: 4.5,
    cameraFar: 340, fog: [60, 300], doubleSided: true,
  }),
  'kami-lookout': define({
    id: 'kami-lookout', name: "Kami's Lookout", scene: 'High above the clouds',
    model: '/assets/stages/kami-lookout.glb', halfX: 38, halfZ: 38, spawnRadius: 26,
    cameraFar: 1500, fog: [170, 1400],
  }),
  'valley-of-the-end': define({
    id: 'valley-of-the-end', name: 'Valley of the End', scene: 'Between the First Hokage and Madara',
    model: '/assets/stages/valley-of-the-end.glb', halfX: 18, halfZ: 45, spawnRadius: 14,
    cameraFar: 1200, fog: [130, 1100],
  }),
  'malevolent-shrine': define({
    id: 'malevolent-shrine', name: 'Malevolent Shrine', scene: "Inside the King of Curses' domain",
    model: '/assets/stages/malevolent-shrine.glb', halfX: 38, halfZ: 42, spawnRadius: 22,
    cameraFar: 900, fog: [55, 700],
  }),
  shiganshina: define({
    id: 'shiganshina', name: 'Shiganshina District', scene: 'The day the wall was breached',
    model: '/assets/stages/shiganshina.glb', halfX: 38, halfZ: 38, spawnRadius: 26,
    cameraFar: 1300, fog: [150, 1200],
  }),
  'hueco-mundo': define({
    id: 'hueco-mundo', name: 'Hueco Mundo', scene: 'The white desert under Las Noches',
    model: '/assets/stages/hueco-mundo.glb', halfX: 26, halfZ: 26, spawnRadius: 16,
    cameraFar: 1600, fog: [170, 1450],
  }),
  onigashima: define({
    id: 'onigashima', name: 'Onigashima', scene: 'The roof of the Skull Dome',
    model: '/assets/stages/onigashima.glb', halfX: 28, halfZ: 28, spawnRadius: 17,
    cameraFar: 1500, fog: [150, 1300],
  }),
  'null-realm': define({
    id: 'null-realm', name: 'The Null Realm', scene: 'The Tournament of Power',
    model: '/assets/stages/null-realm.glb', halfX: 23, halfZ: 23, spawnRadius: 15,
    cameraFar: 1200, fog: [160, 1100],
  }),
  'rift-village': define({
    id: 'rift-village', name: 'The Burning Village', scene: 'Where the sky first tore open',
    model: null, halfX: 34, halfZ: 34, spawnRadius: 18, cameraFar: 700, fog: [26, 260],
  }),
  'rift-swords': define({
    id: 'rift-swords', name: 'The Hill of Swords', scene: 'A thousand graves, and room for more',
    model: null, halfX: 34, halfZ: 34, spawnRadius: 18, cameraFar: 700, fog: [22, 240],
  }),
  'rift-fortress': define({
    id: 'rift-fortress', name: 'The Black Fortress', scene: 'The last wall between the dark and the living',
    model: null, halfX: 32, halfZ: 32, spawnRadius: 18, cameraFar: 700, fog: [24, 250],
  }),
  'rift-eclipse': define({
    id: 'rift-eclipse', name: 'The Eclipse', scene: 'Where the rift is widest',
    model: null, halfX: 32, halfZ: 32, spawnRadius: 18, cameraFar: 900, fog: [30, 380],
  }),
  'rift-frost': define({
    id: 'rift-frost', name: 'The Frozen Shrine', scene: 'Where the last prayers froze',
    model: null, halfX: 32, halfZ: 32, spawnRadius: 18, cameraFar: 700, fog: [24, 250],
  }),
  'rift-grove': define({
    id: 'rift-grove', name: 'The Crimson Grove', scene: 'Bamboo that drinks blood',
    model: null, halfX: 32, halfZ: 32, spawnRadius: 18, cameraFar: 700, fog: [20, 220],
  }),
  'rift-wastes': define({
    id: 'rift-wastes', name: 'The Ashen Wastes', scene: 'Where the old gods fell',
    model: null, halfX: 34, halfZ: 34, spawnRadius: 18, cameraFar: 800, fog: [26, 320],
  }),
  'rift-harbor': define({
    id: 'rift-harbor', name: 'The Drowned Harbor', scene: 'The tide brought the dead back in',
    model: null, halfX: 32, halfZ: 32, spawnRadius: 18, cameraFar: 700, fog: [18, 210],
  }),
  marineford: define({
    id: 'marineford', name: 'Marineford', scene: 'The Summit War',
    model: '/assets/stages/marineford.glb', halfX: 38, halfZ: 38, spawnRadius: 26,
    cameraFar: 1500, fog: [420, 1500],
    duelAxis: .45,
  }),
  shibuya: define({
    id: 'shibuya', name: 'Shibuya at Night', scene: 'The Scramble Crossing under the curtain',
    model: '/assets/stages/shibuya.glb', halfX: 38, halfZ: 38, spawnRadius: 26,
    cameraFar: 900, fog: [70, 820],
  }),
  'infinity-castle': define({
    id: 'infinity-castle', name: 'Infinity Castle', scene: "Nakime's endless fortress",
    model: '/assets/stages/infinity-castle.glb', halfX: 38, halfZ: 38, spawnRadius: 26,
    cameraFar: 900, fog: [26, 400],
  }),
  'pains-crater': define({
    id: 'pains-crater', name: "Pain's Crater", scene: 'The Hidden Leaf after Shinra Tensei',
    model: '/assets/stages/pains-crater.glb', halfX: 38, halfZ: 38, spawnRadius: 26,
    cameraFar: 1400, fog: [260, 1350],
    duelAxis: 0,
  }),
  'heavens-arena': define({
    id: 'heavens-arena', name: 'Heavens Arena', scene: 'The 200th floor',
    model: '/assets/stages/heavens-arena.glb', halfX: 13, halfZ: 13, spawnRadius: 9,
    cameraFar: 400, fog: [40, 280], background: 0x09090c,
  }),
};

export const ROYALE_STAGES: readonly StageId[] = [
  'kami-lookout', 'valley-of-the-end', 'malevolent-shrine', 'shiganshina', 'chunin-final', 'enies-lobby',
  'marineford',
  'shibuya',
  'infinity-castle',
  'pains-crater',
];

const SERIES_ARENA: Record<string, StageId> = {
  'One Piece': 'enies-lobby',
  'Naruto Shippuden': 'valley-of-the-end',
  'Dragon Ball': 'kami-lookout',
  'Jujutsu Kaisen': 'malevolent-shrine',
  'Attack on Titan': 'shiganshina',
  'Demon Slayer': 'infinity-castle',
};
const SERIES_FAMILY: Record<string, string> = { Naruto: 'Naruto Shippuden' };
const SERIES_DUEL: Record<string, StageId> = {
  'Dragon Ball': 'galactic-arena',
};

function dominantSeries(fighters: readonly FighterId[]): string | null {
  const counts = new Map<string, number>();
  for (const fighter of fighters) {
    const raw = FIGHTER_SERIES[fighter], series = raw ? SERIES_FAMILY[raw] ?? raw : raw;
    if (series) counts.set(series, (counts.get(series) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [top, second] = ranked;
  if (!top) return null;
  if (second && second[1] === top[1]) return null;
  return top[1] * 5 >= fighters.length * 2 ? top[0] : null;
}

export function seriesStage(fighters: readonly FighterId[]): StageId | undefined {
  if (fighters.length < 3) return undefined;
  const series = dominantSeries(fighters);
  return series ? SERIES_ARENA[series] : undefined;
}

export function dealRoyaleStage(pick: (pool: readonly StageId[]) => StageId, previous?: StageId): StageId {
  const pool = ROYALE_STAGES.filter(stage => stage !== previous);
  return pick(pool.length ? pool : ROYALE_STAGES);
}

export const SMALL_ROYALE_STAGES: Partial<Record<StageId, number>> = {
  'martial-arts-tournament': 6, 'galactic-arena': 4, 'null-realm': 8,
  'heavens-arena': 6,
};
export function royalePool(field?: number): StageId[] {
  return [...ROYALE_STAGES, ...(field ? (Object.entries(SMALL_ROYALE_STAGES) as [StageId, number][]).filter(([, most]) => field <= most).map(([stage]) => stage) : [])];
}
export class RoyaleDeck {
  private readonly decks = new Map<string, StageId[]>();
  private last?: StageId;
  deal(pick: (pool: readonly StageId[]) => StageId, field?: number): StageId {
    const pool = royalePool(field), key = pool.join();
    let deck = this.decks.get(key);
    if (!deck?.length) deck = [...pool];
    const choices = deck.filter(stage => stage !== this.last);
    const stage = pick(choices.length ? choices : deck);
    deck.splice(deck.indexOf(stage), 1);
    this.decks.set(key, deck);
    this.last = stage;
    return stage;
  }
}

export const ONLINE_DUEL_STAGES: readonly StageId[] = ['martial-arts-tournament', 'galactic-arena', 'heavens-arena'];
export class DuelDeck {
  private deck: StageId[] = [];
  private last?: StageId;
  constructor(private readonly pool: readonly StageId[] = ONLINE_DUEL_STAGES) {}
  deal(pick: (pool: readonly StageId[]) => StageId): StageId {
    if (!this.deck.length) this.deck = [...this.pool];
    const choices = this.deck.filter(stage => stage !== this.last);
    const stage = pick(choices.length ? choices : this.deck);
    this.deck.splice(this.deck.indexOf(stage), 1);
    this.last = stage;
    return stage;
  }
}

function rosterPick(fighters: readonly FighterId[]) {
  let hash = 2166136261;
  for (const id of [...fighters].sort()) for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return (pool: readonly StageId[]) => pool[(hash >>> 0) % pool.length];
}

export function chooseStage(fighters: readonly FighterId[], mode: RoomMode, pick?: (pool: readonly StageId[]) => StageId): StageId {
  if (mode === 'training') return 'chunin-exam-room';
  if (fighters.length === 2) {
    const series = dominantSeries(fighters);
    const same = series !== null && fighters.every(f => (SERIES_FAMILY[FIGHTER_SERIES[f]] ?? FIGHTER_SERIES[f]) === series);
    const duel = same && series ? SERIES_DUEL[series] : undefined;
    return duel ?? 'chunin-exam-room';
  }
  return seriesStage(fighters) ?? dealRoyaleStage(pick ?? rosterPick(fighters));
}

import { ENEMIES } from './enemies';

export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
export type Rank = (typeof RANKS)[number];

export const RANK_HP: Record<Rank, number> = { F: 2400, E: 3900, D: 5100, C: 6500, B: 8300, A: 13200, S: 21500 };
export const RANK_DAMAGE: Record<Rank, number> = { F: .7, E: .77, D: .94, C: 1.01, B: 1.18, A: 1.54, S: 2.1 };
export const RANK_HORDE: Record<Rank, number> = { F: 1, E: 1.12, D: 1.25, C: 1.4, B: 1.55, A: 1.95, S: 2.2 };

export interface Escort { fodder: readonly (readonly [string, number])[]; gunners: readonly (readonly [string, number])[]; brutes: readonly (readonly [string, number])[];
  specials?: readonly (readonly [string, number])[] }
export const ESCORTS = {
  marines: { fodder: [['marine', 1]], gunners: [['marine-rifle', 1]], brutes: [['pacifista', 1]], specials: [['marine-shield', 1], ['marine-sniper', .7]] },
  beasts: { fodder: [['beast-pirate', 1]], gunners: [['beast-pirate', 1]], brutes: [['gifter-brute', 1]], specials: [['beast-leaper', 1], ['beast-medic', .6]] },
  chess: { fodder: [['chess-soldier', 1]], gunners: [['chess-soldier', 1]], brutes: [['chess-soldier', 1]], specials: [['chess-rook', 1], ['chess-bishop', .6]] },
  hollows: { fodder: [['hollow', 1]], gunners: [['hollow-cero', 1]], brutes: [['menos', 1]], specials: [['hollow-diver', 1], ['hollow-caller', .45]] },
  saiyans: { fodder: [['saibaman', 1], ['cell-jr', .8]], gunners: [['frieza-soldier', 1]], brutes: [['cell-jr', 1]], specials: [['frieza-sniper', .8], ['saibaman-diver', 1]] },
  shinobi: { fodder: [['white-zetsu', 1]], gunners: [['rogue-ninja', 1]], brutes: [['white-zetsu', 1]], specials: [['medic-ninja', .6], ['summoner-ninja', .5]] },
  hutts: { fodder: [['gamorrean', 1]], gunners: [['skiff-guard', 1]], brutes: [['gamorrean', 1]], specials: [['gamorrean-shield', 1], ['skiff-sniper', .8]] },
  damned: { fodder: [['husk', 1]], gunners: [['hollow-cero', .4]], brutes: [['apostle-spawn', 1]], specials: [['husk-diver', 1], ['husk-priest', .45]] },
} as const satisfies Record<string, Escort>;
export type EscortId = keyof typeof ESCORTS;

export interface BossEntry {
  id: string;
  rank: Rank;
  escort: EscortId;
  epithet: string;
  universe: string;
}

export const BOSSES: readonly BossEntry[] = [
  { id: 'kaku', rank: 'F', escort: 'marines', epithet: 'CP9 · THE GIRAFFE', universe: 'ONE PIECE' },
  { id: 'jabra', rank: 'F', escort: 'marines', epithet: 'CP9 · THE WOLF', universe: 'ONE PIECE' },
  { id: 'blueno', rank: 'F', escort: 'marines', epithet: 'CP9 · THE DOOR', universe: 'ONE PIECE' },
  { id: 'jabba', rank: 'F', escort: 'hutts', epithet: 'THE CRIME LORD OF TATOOINE', universe: 'STAR WARS' },
  { id: 'sentomaru', rank: 'E', escort: 'marines', epithet: 'THE PACIFISTA COMMANDER', universe: 'ONE PIECE' },
  { id: 'grimmjow', rank: 'E', escort: 'hollows', epithet: 'SEXTA ESPADA', universe: 'BLEACH' },
  { id: 'hollow-ichigo', rank: 'E', escort: 'hollows', epithet: 'THE HOLLOW WITHIN', universe: 'BLEACH' },
  { id: 'lucci', rank: 'D', escort: 'marines', epithet: 'THE LEOPARD OF CP9', universe: 'ONE PIECE' },
  { id: 'ulquiorra', rank: 'D', escort: 'hollows', epithet: 'CUARTA ESPADA', universe: 'BLEACH' },
  { id: 'king', rank: 'D', escort: 'beasts', epithet: 'KING OF THE WILDFIRE', universe: 'ONE PIECE' },
  { id: 'kenpachi', rank: 'C', escort: 'hollows', epithet: 'THE DEMON OF THE ELEVENTH', universe: 'BLEACH' },
  { id: 'katakuri', rank: 'C', escort: 'chess', epithet: 'THE MOCHI TYRANT', universe: 'ONE PIECE' },
  { id: 'aokiji', rank: 'C', escort: 'marines', epithet: 'ADMIRAL OF ICE', universe: 'ONE PIECE' },
  { id: 'kizaru', rank: 'C', escort: 'marines', epithet: 'ADMIRAL OF LIGHT', universe: 'ONE PIECE' },
  { id: 'akainu', rank: 'B', escort: 'marines', epithet: 'ADMIRAL OF MAGMA', universe: 'ONE PIECE' },
  { id: 'bigmom', rank: 'B', escort: 'chess', epithet: 'EMPEROR OF THE SEA', universe: 'ONE PIECE' },
  { id: 'goku-black', rank: 'B', escort: 'saiyans', epithet: 'THE ZERO MORTALS PLAN', universe: 'DRAGON BALL' },
  { id: 'golden-frieza', rank: 'B', escort: 'saiyans', epithet: 'EMPEROR OF THE UNIVERSE', universe: 'DRAGON BALL' },
  { id: 'aizen', rank: 'A', escort: 'hollows', epithet: 'THE TRANSCENDENT', universe: 'BLEACH' },
  { id: 'kurama', rank: 'A', escort: 'shinobi', epithet: 'THE NINE-TAILED DEMON FOX', universe: 'NARUTO' },
  { id: 'blackbeard', rank: 'A', escort: 'beasts', epithet: 'THE MAN WHO STOLE AN EARTHQUAKE', universe: 'ONE PIECE' },
  { id: 'madara', rank: 'A', escort: 'shinobi', epithet: 'THE GHOST OF THE UCHIHA', universe: 'NARUTO' },
  { id: 'dio', rank: 'A', escort: 'damned', epithet: 'THE WORLD · MASTER OF STOPPED TIME', universe: "JOJO'S BIZARRE ADVENTURE" },
  { id: 'griffith', rank: 'A', escort: 'damned', epithet: 'THE WHITE HAWK · THE FIFTH GOD HAND', universe: 'BERSERK' },
  { id: 'jiren', rank: 'S', escort: 'saiyans', epithet: 'THE PRIDE OF UNIVERSE 11', universe: 'DRAGON BALL' },
  { id: 'kaido', rank: 'S', escort: 'beasts', epithet: 'THE STRONGEST CREATURE ALIVE', universe: 'ONE PIECE' },
  { id: 'whitebeard', rank: 'S', escort: 'beasts', epithet: 'THE STRONGEST MAN IN THE WORLD', universe: 'ONE PIECE' },
  { id: 'sukuna', rank: 'S', escort: 'hollows', epithet: 'THE KING OF CURSES', universe: 'JUJUTSU KAISEN' },
  { id: 'meruem', rank: 'S', escort: 'beasts', epithet: 'KING OF THE CHIMERA ANTS', universe: 'HUNTER × HUNTER' },
];

export const bossEntry = (id: string) => BOSSES.find(entry => entry.id === id);

export function rankFor(round: number): Rank {
  const index = Math.floor((round - 1) / 2);
  return index < RANKS.length ? RANKS[index] : 'S';
}
export const loopOf = (round: number) => Math.max(0, Math.floor((round - 1) / 2) - RANKS.length + 1);

export const RESTING: ReadonlySet<string> = new Set(['kurama', 'jabba']);

export const OPENERS: ReadonlySet<string> = new Set(['jabra', 'blueno', 'grimmjow', 'hollow-ichigo']);

export function drawBoss(round: number, met: readonly string[], random: () => number, avoid: ReadonlySet<string> = new Set()): BossEntry {
  const loop = loopOf(round);
  const rank: Rank = loop > 0 ? (random() < Math.min(.8, .45 + loop * .1) ? 'S' : 'A') : rankFor(round);
  const all = round === 1 && loop === 0
    ? BOSSES.filter(entry => OPENERS.has(entry.id) && ENEMIES[entry.id] && !RESTING.has(entry.id)).map(entry => ({ ...entry, rank }))
    : BOSSES.filter(entry => entry.rank === rank && ENEMIES[entry.id] && !RESTING.has(entry.id));
  const pool = all.filter(entry => !avoid.has(entry.id)).length ? all.filter(entry => !avoid.has(entry.id)) : all;
  const fresh = pool.filter(entry => !met.includes(entry.id));
  const from = fresh.length ? fresh : pool;
  const seen = (universe: string) => met.reduce((n, id) => n + (BOSSES.find(entry => entry.id === id)?.universe === universe ? 1 : 0), 0);
  const weights = from.map(entry => 1 / (1 + seen(entry.universe) * 1.5));
  let roll = random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < from.length; i++) { roll -= weights[i]; if (roll <= 0) return from[i]; }
  return from[from.length - 1];
}

export const EARLY_ARMIES: readonly EscortId[] = ['hollows', 'shinobi', 'chess'];
export function armyFor(boss: BossEntry, round: number, fielded: readonly EscortId[], random: () => number): EscortId {
  const early = !loopOf(round) && RANKS.indexOf(rankFor(round)) <= RANKS.indexOf('E');
  if (!early || boss.escort !== fielded[fielded.length - 1]) return boss.escort;
  const fresh = EARLY_ARMIES.filter(id => !fielded.includes(id));
  return fresh.length ? fresh[Math.floor(random() * fresh.length)] : boss.escort;
}

export const doubleBoss = (round: number, random: () => number) => loopOf(round) > 0 && random() < Math.min(.7, .25 + loopOf(round) * .15);
